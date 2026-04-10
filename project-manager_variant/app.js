// ══════════════════════════════════════════════════════════════
//  GESTIONNAIRE DE PROJETS — app.js
//  Stockage : IndexedDB + AES-256-GCM (Web Crypto API native)
//  + File System Access API avec handle persistant (IndexedDB)
// ══════════════════════════════════════════════════════════════

const DB_NAME        = 'projets_db';
const DB_VERSION     = 2;
const STORE_KV       = 'keyvalue';
const STORE_ATT      = 'attachments'; // { id, taskId, name, type, size, iv, ct }

const ATT_MAX_SIZE   = 10 * 1024 * 1024; // 10 Mo par fichier
const ATT_MAX_COUNT  = 5;                // pièces jointes max par tâche

const KEY_TASKS      = 'tasks_enc';
const KEY_SALT       = 'salt';
const KEY_FSA        = 'fsa_handle';
const KEY_FSA_NAME   = 'fsa_name';
const KEY_HEADER     = 'app_header';
const KEY_REQUESTERS = 'custom_requesters'; // string[]
const KEY_TYPES      = 'custom_types';      // string[]

const ITER_COUNT = 310_000;
const PAGE_SIZE  = 15;

// Valeurs système — toujours présentes, non supprimables
const DEFAULT_REQUESTERS = ['S3AD', 'SE2S', 'MDA', 'Autres'];
const DEFAULT_TYPES      = ['SOLIS', 'MULTIGEST', 'BO', 'Courriers', 'Autres'];

// ── État global ──────────────────────────────────────────────
let tasks        = [];
let editingId    = null;
let activeFilter = 'all';
let activePage   = 'tasks';
let cryptoKey    = null;
let fileHandle   = null;
let fsaSupported = typeof window.showSaveFilePicker === 'function';
let currentPageTasks    = 1;
let currentPageArchives = 1;
let searchQueryTasks    = '';
let searchQueryArchives = '';

// Listes dynamiques (chargées depuis IDB au démarrage)
let customRequesters = [];
let customTypes      = [];

// Pièces jointes en attente (création, avant que l'id de tâche soit connu)
let pendingAttachments = []; // File[]

// Instance Quill pour la modale de création/modification
let quillModal = null;

// ════════════════════════════════════════════════════════════
//  INDEXEDDB
// ════════════════════════════════════════════════════════════

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_KV))
        db.createObjectStore(STORE_KV);
      // v2 — store pièces jointes chiffrées
      if (!db.objectStoreNames.contains(STORE_ATT)) {
        const attStore = db.createObjectStore(STORE_ATT, { keyPath: 'id' });
        attStore.createIndex('taskId', 'taskId', { unique: false });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_KV, 'readonly').objectStore(STORE_KV).get(key);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_KV, 'readwrite').objectStore(STORE_KV).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function dbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_KV, 'readwrite').objectStore(STORE_KV).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

// ════════════════════════════════════════════════════════════
//  PIÈCES JOINTES — INDEXEDDB (store "attachments")
// ════════════════════════════════════════════════════════════

async function attAdd(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_ATT, 'readwrite').objectStore(STORE_ATT).put(record);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function attGetByTask(taskId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const idx = db.transaction(STORE_ATT, 'readonly').objectStore(STORE_ATT).index('taskId');
    const req = idx.getAll(taskId);
    req.onsuccess = e => resolve(e.target.result || []);
    req.onerror   = e => reject(e.target.error);
  });
}

async function attDelete(attId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_ATT, 'readwrite').objectStore(STORE_ATT).delete(attId);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function attDeleteAllForTask(taskId) {
  const records = await attGetByTask(taskId);
  for (const r of records) await attDelete(r.id);
}

/** Chiffre un ArrayBuffer et retourne { id, taskId, name, type, size, iv, ct } */
async function encryptAttachment(taskId, file) {
  const buffer = await file.arrayBuffer();
  const iv     = crypto.getRandomValues(new Uint8Array(12));
  const ct     = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, buffer);
  return {
    id:     `att_${taskId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    taskId,
    name:   file.name,
    type:   file.type || 'application/octet-stream',
    size:   file.size,
    iv:     iv.buffer,
    ct,
  };
}

/** Déchiffre un record et retourne un Blob */
async function decryptAttachment(record) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(record.iv) },
    cryptoKey,
    record.ct
  );
  return new Blob([plain], { type: record.type });
}

/** Icône selon extension */
function attIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊',
    ppt:'📊', pptx:'📊', txt:'📄', csv:'📄',
    png:'🖼', jpg:'🖼', jpeg:'🖼', gif:'🖼', webp:'🖼', svg:'🖼',
    zip:'🗜', rar:'🗜', '7z':'🗜',
    mp4:'🎬', avi:'🎬', mov:'🎬',
    mp3:'🎵', wav:'🎵',
  };
  return map[ext] || '📎';
}

/** Formate une taille en octets */
function fmtSize(bytes) {
  if (bytes < 1024)        return bytes + ' o';
  if (bytes < 1024*1024)   return (bytes/1024).toFixed(1) + ' Ko';
  return (bytes/(1024*1024)).toFixed(1) + ' Mo';
}

/**
 * Traite une liste de File objects à attacher à une tâche.
 * Vérifie taille et quota, chiffre, stocke dans IDB,
 * met à jour task.attachments (métadonnées), sauvegarde.
 */
async function processAttachFiles(taskId, files) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const existing = await attGetByTask(taskId);
  const slot     = ATT_MAX_COUNT - existing.length;
  if (slot <= 0) { showToast(`⚠️ Limite atteinte (${ATT_MAX_COUNT} pièces jointes max)`); return; }

  let added = 0;
  let skipped = 0;
  const fileArr = Array.from(files).slice(0, slot);

  for (const file of fileArr) {
    if (file.size > ATT_MAX_SIZE) {
      showToast(`⚠️ ${file.name} trop volumineux (max 10 Mo)`);
      skipped++;
      continue;
    }
    try {
      const record = await encryptAttachment(taskId, file);
      await attAdd(record);
      // Ajoute les métadonnées dans la tâche (pas le contenu binaire)
      if (!task.attachments) task.attachments = [];
      task.attachments.push({ id: record.id, name: record.name, type: record.type, size: record.size });
      added++;
    } catch (err) {
      showToast(`❌ Erreur lors de l'ajout de ${file.name}`);
    }
  }

  if (added > 0) {
    tasks = tasks.map(t => t.id === taskId ? task : t);
    await saveToStorage();
    showToast(`📎 ${added} fichier${added>1?'s':''} ajouté${added>1?'s':''}`);
    // Rafraîchir la modale si ouverte sur cette tâche
    if (_detailTaskId === taskId) _renderDetail(taskId);
    renderTasks(); if (activePage === 'archives') renderArchives();
  }
  if (files.length > slot) {
    showToast(`⚠️ Seuls ${slot} fichier${slot>1?'s':''} ont été ajoutés (limite ${ATT_MAX_COUNT})`);
  }
}

/** Télécharge une pièce jointe (déchiffrement à la volée) */
async function downloadAttachment(attId) {
  const db = await openDB();
  const record = await new Promise((res, rej) => {
    const req = db.transaction(STORE_ATT, 'readonly').objectStore(STORE_ATT).get(attId);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
  if (!record) { showToast('❌ Pièce jointe introuvable'); return; }
  try {
    const blob = await decryptAttachment(record);
    downloadBlob(blob, record.name);
  } catch {
    showToast('❌ Erreur de déchiffrement');
  }
}

/** Supprime une pièce jointe (IDB + métadonnées tâche) */
async function removeAttachment(taskId, attId) {
  await attDelete(attId);
  const task = tasks.find(t => t.id === taskId);
  if (task && task.attachments) {
    task.attachments = task.attachments.filter(a => a.id !== attId);
    tasks = tasks.map(t => t.id === taskId ? task : t);
    await saveToStorage();
  }
  showToast('🗑 Pièce jointe supprimée');
  if (_detailTaskId === taskId) _renderDetail(taskId);
  renderTasks(); if (activePage === 'archives') renderArchives();
}

/**
 * Construit le bloc pièces jointes pour la modale de détail.
 * Rendu asynchrone : injecte le HTML final dans le conteneur cible.
 */
async function renderAttachmentsBlock(taskId, container) {
  const task    = tasks.find(t => t.id === taskId);
  const attMeta = task?.attachments || [];
  const count   = attMeta.length;

  container.innerHTML = '';

  // ── En-tête section ──
  const section = document.createElement('div');
  section.className = 'att-section';

  const header = document.createElement('div');
  header.className = 'att-header';
  header.innerHTML = `
    <span class="df-label">Pièces jointes <span class="att-count">${count}/${ATT_MAX_COUNT}</span></span>
  `;

  // Bouton "Ajouter" via input file
  const addBtn = document.createElement('label');
  addBtn.className = 'btn btn-ghost btn-sm att-add-btn';
  addBtn.title     = 'Ajouter des fichiers';
  addBtn.innerHTML = `<input type="file" multiple style="display:none" class="att-file-input"> 📎 Ajouter`;
  const fileInput  = addBtn.querySelector('input');
  fileInput.addEventListener('change', async () => {
    if (fileInput.files.length) await processAttachFiles(taskId, fileInput.files);
    fileInput.value = ''; // reset pour permettre le même fichier à nouveau
  });
  header.appendChild(addBtn);
  section.appendChild(header);

  // ── Zone drag & drop ──
  const dropZone = document.createElement('div');
  dropZone.className = 'att-dropzone';
  dropZone.innerHTML = `<span class="att-drop-hint">📂 Glissez vos fichiers ici ou cliquez sur « Ajouter »</span>`;

  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', e => { dropZone.classList.remove('drag-over'); });
  dropZone.addEventListener('drop',      async e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) await processAttachFiles(taskId, files);
  });

  // ── Liste des fichiers existants ──
  if (attMeta.length > 0) {
    const list = document.createElement('div');
    list.className = 'att-list';
    attMeta.forEach(att => {
      const row = document.createElement('div');
      row.className = 'att-row';
      row.innerHTML = `
        <span class="att-icon">${attIcon(att.name)}</span>
        <span class="att-name" title="${escHtml(att.name)}">${escHtml(att.name)}</span>
        <span class="att-size">${fmtSize(att.size)}</span>
        <button class="btn btn-ghost btn-sm att-dl-btn" title="Télécharger">⬇</button>
        <button class="btn btn-danger btn-sm att-rm-btn" title="Supprimer">✕</button>
      `;
      row.querySelector('.att-dl-btn').addEventListener('click', () => downloadAttachment(att.id));
      row.querySelector('.att-rm-btn').addEventListener('click', () => removeAttachment(taskId, att.id));
      list.appendChild(row);
    });
    section.appendChild(list);
  }

  section.appendChild(dropZone);
  container.appendChild(section);
}

// ════════════════════════════════════════════════════════════
//  LISTES DYNAMIQUES — DEMANDEURS & TYPES
// ════════════════════════════════════════════════════════════

function allRequesters() { return [...DEFAULT_REQUESTERS, ...customRequesters]; }
function allTypes()      { return [...DEFAULT_TYPES,      ...customTypes]; }

async function loadLists() {
  customRequesters = (await dbGet(KEY_REQUESTERS)) || [];
  customTypes      = (await dbGet(KEY_TYPES))      || [];
}

async function saveLists() {
  await dbSet(KEY_REQUESTERS, customRequesters);
  await dbSet(KEY_TYPES,      customTypes);
}

/**
 * Peuple tous les <select> d'une catégorie (requester / type).
 * Conserve la valeur sélectionnée si elle est toujours présente.
 */
function populateSelect(selectId, values, placeholder = '— Sélectionner —', includeAll = false) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const current = el.value;
  el.innerHTML = '';
  if (includeAll) {
    const opt = document.createElement('option');
    opt.value = 'all'; opt.textContent = placeholder;
    el.appendChild(opt);
  } else {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = placeholder;
    el.appendChild(opt);
  }
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    el.appendChild(opt);
  });
  if (current && [...el.options].some(o => o.value === current)) el.value = current;
}

function refreshAllSelects() {
  const reqs  = allRequesters();
  const types = allTypes();
  // Formulaire
  populateSelect('taskRequester',          reqs,  '— Sélectionner —', false);
  populateSelect('taskType',               types, '— Sélectionner —', false);
  // Filtres tâches
  populateSelect('filterRequester',        reqs,  'Tous demandeurs',  true);
  populateSelect('filterType',             types, 'Tous types',       true);
  // Filtres archives
  populateSelect('archiveFilterRequester', reqs,  'Tous demandeurs',  true);
  populateSelect('archiveFilterType',      types, 'Tous types',       true);
}

/** Ouvre la modale de gestion des listes */
function openListManager() {
  renderListManager();
  document.getElementById('listManagerOverlay').classList.add('open');
}
function closeListManager() {
  document.getElementById('listManagerOverlay').classList.remove('open');
}

function renderListManager() {
  const body = document.getElementById('listManagerBody');
  body.innerHTML = '';

  const buildSection = (kind, label, items, defaults) => {
    const section = document.createElement('div');
    section.className = 'lm-section';

    // Titre
    const title = document.createElement('div');
    title.className   = 'lm-section-title';
    title.textContent = label;
    section.appendChild(title);

    // Liste
    const list = document.createElement('div');
    list.className = 'lm-list';
    if (!items.length) {
      list.innerHTML = '<span class="lm-empty">Aucun</span>';
    } else {
      items.forEach((v, i) => {
        const isDefault = defaults.includes(v);
        const row = document.createElement('div');
        row.className = 'lm-row';

        const lbl = document.createElement('span');
        lbl.className   = 'lm-label';
        lbl.textContent = v;
        row.appendChild(lbl);

        if (isDefault) {
          const tag = document.createElement('span');
          tag.className   = 'lm-default-tag';
          tag.textContent = 'système';
          row.appendChild(tag);
        } else {
          const del = document.createElement('button');
          del.className   = 'btn btn-danger btn-sm lm-del';
          del.textContent = '✕';
          del.addEventListener('click', async () => {
            const customList = kind === 'requester' ? customRequesters : customTypes;
            const idx = customList.indexOf(v);
            if (idx === -1) return;
            customList.splice(idx, 1);
            await saveLists();
            refreshAllSelects();
            renderListManager();
            showToast('🗑 Supprimé');
          });
          row.appendChild(del);
        }
        list.appendChild(row);
      });
    }
    section.appendChild(list);

    // Ligne d'ajout
    const addRow = document.createElement('div');
    addRow.className = 'lm-add-row';

    const inp = document.createElement('input');
    inp.className   = 'lm-input';
    inp.type        = 'text';
    inp.placeholder = 'Nouveau…';
    inp.maxLength   = 40;
    addRow.appendChild(inp);

    const addBtn = document.createElement('button');
    addBtn.className   = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Ajouter';

    const doAdd = async () => {
      const v = inp.value.trim();
      if (!v) return;
      const all     = kind === 'requester' ? allRequesters() : allTypes();
      if (all.includes(v)) { showToast('⚠️ Déjà existant'); return; }
      const customList = kind === 'requester' ? customRequesters : customTypes;
      customList.push(v);
      await saveLists();
      refreshAllSelects();
      renderListManager();
      showToast(kind === 'requester' ? '✅ Demandeur ajouté' : '✅ Type ajouté');
    };

    addBtn.addEventListener('click', doAdd);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    addRow.appendChild(addBtn);
    section.appendChild(addRow);

    return section;
  };

  body.appendChild(buildSection('requester', 'Demandeurs', allRequesters(), DEFAULT_REQUESTERS));

  const divider = document.createElement('hr');
  divider.className = 'lm-divider';
  body.appendChild(divider);

  body.appendChild(buildSection('type', 'Types de demande', allTypes(), DEFAULT_TYPES));
}

// ════════════════════════════════════════════════════════════
//  DÉMARRAGE
// ════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', async () => {
  initUrgencyPills();
  initStatusPills();
  initRecurrencePills();
  initDayPills();
  initFilterTabs();
  document.getElementById('jsonLoader').addEventListener('change', importJSON);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDetail(); closeListManager(); }
    if (e.key === 'Enter' && document.getElementById('lockScreen').classList.contains('open'))
      submitPassword();
  });
  // ── Initialisation Quill (modale) ───────────────────────────
  quillModal = new Quill('#taskCommentEditor', {
    theme: 'snow',
    placeholder: 'Détails, notes, contexte…',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'clean']
      ]
    }
  });

  const hasSavedData = !!(await dbGet(KEY_TASKS));
  showLockScreen(hasSavedData ? 'unlock' : 'create');

  const importLabel = document.getElementById('jsonImportLabel');
  if (importLabel) importLabel.style.display = fsaSupported ? 'none' : '';
});

// ════════════════════════════════════════════════════════════
//  NAVIGATION PAR ONGLETS
// ════════════════════════════════════════════════════════════

function switchPage(page) {
  activePage = page;
  document.querySelectorAll('.page-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.page === page)
  );
  document.getElementById('pageTasks').style.display    = page === 'tasks'    ? '' : 'none';
  document.getElementById('pageArchives').style.display = page === 'archives' ? '' : 'none';
  if (page === 'archives') renderArchives();
}

function toggleTasksPanel() {
  const panel = document.getElementById('topPanel');
  const btn   = document.getElementById('panelToggleBtn');
  const collapsed = panel.classList.toggle('collapsed');
  btn.classList.toggle('collapsed', collapsed);
  btn.title = collapsed ? 'Déplier le panneau' : 'Réduire le panneau';
}

// ════════════════════════════════════════════════════════════
//  ÉCRAN DE VERROUILLAGE
// ════════════════════════════════════════════════════════════

function showLockScreen(mode) {
  const screen = document.getElementById('lockScreen');
  screen.dataset.mode = mode;
  document.getElementById('lockError').textContent = '';
  document.getElementById('lockPassword').value    = '';
  document.getElementById('lockConfirm').value     = '';

  if (mode === 'create') {
    document.getElementById('lockTitle').textContent         = 'Créer un mot de passe';
    document.getElementById('lockSub').textContent           = 'Vos données seront chiffrées (AES-256-GCM). Sans ce mot de passe, elles sont illisibles.';
    document.getElementById('lockConfirmWrap').style.display = 'block';
    document.getElementById('lockBtn').textContent           = 'Créer & déverrouiller';
  } else {
    document.getElementById('lockTitle').textContent         = 'Déverrouiller';
    document.getElementById('lockSub').textContent           = 'Entrez votre mot de passe pour déchiffrer vos données localement.';
    document.getElementById('lockConfirmWrap').style.display = 'none';
    document.getElementById('lockBtn').textContent           = 'Déverrouiller';
  }

  screen.classList.add('open');
  setTimeout(() => document.getElementById('lockPassword').focus(), 150);
}

async function submitPassword() {
  const screen = document.getElementById('lockScreen');
  const mode   = screen.dataset.mode;
  const pwd    = document.getElementById('lockPassword').value;
  const conf   = document.getElementById('lockConfirm').value;
  const err    = document.getElementById('lockError');
  const btn    = document.getElementById('lockBtn');

  err.textContent = '';
  if (!pwd || pwd.length < 4) {
    err.textContent = 'Mot de passe trop court (4 min.).';
    shake(document.getElementById('lockPassword')); return;
  }
  if (mode === 'create' && pwd !== conf) {
    err.textContent = 'Les mots de passe ne correspondent pas.';
    shake(document.getElementById('lockConfirm')); return;
  }

  btn.disabled = true; btn.textContent = 'Chargement…';

  try {
    if (mode === 'create') {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      await dbSet(KEY_SALT, salt);
      cryptoKey = await deriveKey(pwd, salt);
      tasks = window.initialTasks || [];
      await saveToStorage();
    } else {
      const salt = await dbGet(KEY_SALT);
      if (!salt) { err.textContent = 'Données corrompues (sel manquant).'; return; }
      cryptoKey = await deriveKey(pwd, salt);
      await loadFromStorage();
    }

    await loadLists();
    refreshAllSelects();

    screen.classList.remove('open');
    document.getElementById('appContent').style.display = 'block';
    renderTasks();
    renderStats();
    updateTabCounts();
    await loadHeader();
    await restoreFsaHandle();

  } catch {
    err.textContent = mode === 'unlock' ? 'Mot de passe incorrect.' : 'Erreur inattendue.';
    cryptoKey = null;
    shake(document.getElementById('lockPassword'));
  } finally {
    btn.disabled    = false;
    btn.textContent = mode === 'create' ? 'Créer & déverrouiller' : 'Déverrouiller';
  }
}

function lockApp() {
  cryptoKey = null; tasks = []; fileHandle = null;
  document.getElementById('appContent').style.display = 'none';
  showLockScreen('unlock');
}

async function changePassword() {
  const newPwd = prompt('Nouveau mot de passe (4 car. min) :');
  if (!newPwd || newPwd.length < 4) { showToast('❌ Trop court'); return; }
  if (prompt('Confirmer :') !== newPwd) { showToast('❌ Ne correspond pas'); return; }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await dbSet(KEY_SALT, salt);
  cryptoKey = await deriveKey(newPwd, salt);
  await saveToStorage();
  showToast('🔑 Mot de passe mis à jour');
}

// ════════════════════════════════════════════════════════════
//  CRYPTO — PBKDF2 → AES-256-GCM
// ════════════════════════════════════════════════════════════

async function deriveKey(password, salt) {
  const raw = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER_COUNT, hash: 'SHA-256' },
    raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function encrypt(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, cryptoKey,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return { iv: iv.buffer, ct };
}

async function decrypt(stored) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(stored.iv) },
    cryptoKey,
    stored.ct
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

// ════════════════════════════════════════════════════════════
//  STOCKAGE
// ════════════════════════════════════════════════════════════

async function loadFromStorage() {
  const raw = await dbGet(KEY_TASKS);
  if (!raw) { tasks = []; return; }
  tasks = await decrypt(raw);
}

async function saveToStorage() {
  if (!cryptoKey) return;
  await dbSet(KEY_TASKS, await encrypt(tasks));
  await writeToFile();
}

// ════════════════════════════════════════════════════════════
//  FILE SYSTEM ACCESS API
// ════════════════════════════════════════════════════════════

async function restoreFsaHandle() {
  if (!fsaSupported) { updateFsaBtnState(); return; }
  const stored = await dbGet(KEY_FSA);
  if (!stored) { updateFsaBtnState(); return; }
  try {
    const perm = await stored.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      fileHandle = stored;
      updateFsaBtnState();
      showToast('📁 Sauvegarde auto reconnectée → ' + stored.name);
      document.getElementById('refileBanner').style.display = 'none';
      return;
    }
    if (perm === 'prompt') {
      const fname = await dbGet(KEY_FSA_NAME);
      if (fname) document.getElementById('refileName').textContent = fname;
      document.getElementById('refileBanner').style.display = 'flex';
      updateFsaBtnState();
      return;
    }
    await dbDelete(KEY_FSA); await dbDelete(KEY_FSA_NAME); updateFsaBtnState();
  } catch {
    await dbDelete(KEY_FSA); await dbDelete(KEY_FSA_NAME); updateFsaBtnState();
  }
}

async function relinkFile() {
  if (!fsaSupported) return;
  const stored = await dbGet(KEY_FSA);
  if (stored) {
    try {
      const perm = await stored.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        fileHandle = stored;
        document.getElementById('refileBanner').style.display = 'none';
        updateFsaBtnState();
        await writeToFile();
        showToast('✅ Sauvegarde auto réactivée → ' + stored.name);
        return;
      }
      showToast('⚠️ Permission refusée'); return;
    } catch {
      await dbDelete(KEY_FSA); await dbDelete(KEY_FSA_NAME);
    }
  }
  await linkFile();
}

async function linkFile() {
  if (!fsaSupported) { showToast('⚠️ Non supporté sur Firefox — utilisez Chrome/Edge'); return; }
  try {
    const fname = await dbGet(KEY_FSA_NAME);
    const handle = await window.showSaveFilePicker({
      suggestedName: fname || 'tasks.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    await dbSet(KEY_FSA, handle); await dbSet(KEY_FSA_NAME, handle.name);
    fileHandle = handle;
    document.getElementById('refileBanner').style.display = 'none';
    updateFsaBtnState();
    await writeToFile();
    showToast('📁 Fichier lié — sauvegarde automatique activée');
  } catch (e) {
    if (e.name !== 'AbortError') showToast('❌ ' + e.message);
  }
}

async function unlinkFile() {
  fileHandle = null;
  await dbDelete(KEY_FSA); await dbDelete(KEY_FSA_NAME);
  updateFsaBtnState();
  showToast('🔗 Liaison fichier supprimée');
}

async function writeToFile() {
  if (!fileHandle) return;
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(tasks, null, 2));
    await writable.close();
  } catch (e) {
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
      showToast('⚠️ Permission expirée — re-autorisez via le banner');
      fileHandle = null; updateFsaBtnState();
      const fname = await dbGet(KEY_FSA_NAME);
      if (fname) {
        document.getElementById('refileName').textContent = fname;
        document.getElementById('refileBanner').style.display = 'flex';
      }
    }
  }
}

function updateFsaBtnState() {
  const btn  = document.getElementById('fsaBtn');
  const info = document.getElementById('fsaInfo');
  if (!btn) return;
  if (!fsaSupported) {
    btn.textContent = '⚠️ Non supporté (Firefox)'; btn.disabled = true;
    if (info) info.textContent = 'Utilisez Chrome/Edge.'; return;
  }
  if (fileHandle) {
    btn.textContent = '🔗 Délier le fichier'; btn.onclick = unlinkFile;
    btn.className   = 'btn btn-ghost btn-sm';
    if (info) { info.textContent = '✓ Auto → ' + fileHandle.name; info.style.color = 'var(--low)'; }
  } else {
    btn.textContent = '📁 Lier un fichier disque'; btn.onclick = linkFile;
    btn.className   = 'btn btn-outline btn-sm';
    dbGet(KEY_FSA_NAME).then(fname => {
      if (!info) return;
      info.textContent = fname ? ('⚠️ ' + fname + ' (re-autorisez)') : '';
      info.style.color = 'var(--medium)';
    });
  }
}

// ════════════════════════════════════════════════════════════
//  MODAL FORMULAIRE
// ════════════════════════════════════════════════════════════

function openModal(id = null) {
  editingId = id;
  pendingAttachments = [];
  const overlay = document.getElementById('modalOverlay');
  const title   = document.getElementById('modalTitle');
  const btn     = document.getElementById('submitBtn');

  refreshAllSelects();

  if (id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('taskTitle').value     = task.title;
    document.getElementById('taskRef').value       = task.customRef  || '';
    // Quill : charger le HTML du commentaire
    quillModal.setContents([]);
    if (task.comment) quillModal.clipboard.dangerouslyPasteHTML(task.comment);
    document.getElementById('deadline').value      = task.deadline  || '';
    document.getElementById('taskRequester').value = task.requester || '';
    document.getElementById('taskType').value      = task.type      || '';
    setUrgencyPill(task.urgency || 'low');
    setStatusPill(task.status   || 'en-cours');
    // Récurrence
    const rec = task.recurrence || null;
    setRecurrencePill(rec ? rec.type : 'none');
    fillRecurrenceFields(rec);
    title.innerHTML = 'Modifier la tâche <span class="edit-badge">édition</span>';
    btn.textContent = 'Enregistrer';
    // Pièces jointes existantes
    renderModalAttachments(id);
  } else {
    resetForm();
    title.textContent = 'Nouvelle tâche';
    btn.textContent   = 'Ajouter la tâche';
    renderModalAttachments(null);
  }

  overlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
  pendingAttachments = [];
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ════════════════════════════════════════════════════════════
//  PIÈCES JOINTES DANS LE FORMULAIRE
// ════════════════════════════════════════════════════════════

/**
 * Rend le bloc pièces jointes dans le formulaire de création/modification.
 * - taskId null  → mode création : accumule dans pendingAttachments
 * - taskId défini → mode édition  : attache directement via processAttachFiles
 */
async function renderModalAttachments(taskId) {
  const container = document.getElementById('modalAttachments');
  if (!container) return;
  container.innerHTML = '';

  // Métadonnées à afficher
  let attMeta = [];
  if (taskId) {
    const task = tasks.find(t => t.id === taskId);
    attMeta = task?.attachments || [];
  } else {
    // En création : liste des fichiers en attente
    attMeta = pendingAttachments.map((f, i) => ({
      id: `pending_${i}`, name: f.name, size: f.size, type: f.type, _pending: true
    }));
  }

  const count = attMeta.length;
  const maxReached = count >= ATT_MAX_COUNT;

  // ── En-tête ──
  const header = document.createElement('div');
  header.className = 'matt-header';
  header.innerHTML = `
    <span class="matt-label">📎 Pièces jointes <span class="att-count">${count}/${ATT_MAX_COUNT}</span></span>
  `;

  // Bouton Ajouter (masqué si quota atteint)
  if (!maxReached) {
    const addLabel = document.createElement('label');
    addLabel.className = 'btn btn-ghost btn-sm';
    addLabel.style.cursor = 'pointer';
    addLabel.innerHTML = `+ Ajouter <input type="file" multiple style="display:none">`;
    const inp = addLabel.querySelector('input');
    inp.addEventListener('change', async () => {
      if (!inp.files.length) return;
      if (taskId) {
        await processAttachFiles(taskId, inp.files);
        renderModalAttachments(taskId);
      } else {
        _addPending(inp.files);
      }
      inp.value = '';
    });
    header.appendChild(addLabel);
  }
  container.appendChild(header);

  // ── Liste des fichiers ──
  if (attMeta.length > 0) {
    const list = document.createElement('div');
    list.className = 'matt-list';
    attMeta.forEach((att, i) => {
      const row = document.createElement('div');
      row.className = 'matt-row';
      row.innerHTML = `
        <span class="att-icon">${attIcon(att.name)}</span>
        <span class="matt-name" title="${escHtml(att.name)}">${escHtml(att.name)}</span>
        <span class="att-size">${fmtSize(att.size)}</span>
        <button type="button" class="btn btn-danger btn-sm">✕</button>
      `;
      row.querySelector('button').addEventListener('click', async () => {
        if (att._pending) {
          pendingAttachments.splice(i, 1);
          renderModalAttachments(null);
        } else {
          await removeAttachment(taskId, att.id);
          renderModalAttachments(taskId);
        }
      });
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  // ── Zone drop ──
  const dropZone = document.createElement('div');
  dropZone.className = 'matt-drop';
  dropZone.innerHTML = maxReached
    ? `<span class="att-drop-hint" style="color:var(--medium)">Limite de ${ATT_MAX_COUNT} fichiers atteinte</span>`
    : `<span class="att-drop-hint">📂 Glissez des fichiers ici</span>`;

  if (!maxReached) {
    dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', async e => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      if (!e.dataTransfer.files.length) return;
      if (taskId) {
        await processAttachFiles(taskId, e.dataTransfer.files);
        renderModalAttachments(taskId);
      } else {
        _addPending(e.dataTransfer.files);
      }
    });
  }
  container.appendChild(dropZone);
}

/** Ajoute des File dans pendingAttachments avec validation taille/quota, puis re-rend */
function _addPending(files) {
  const available = ATT_MAX_COUNT - pendingAttachments.length;
  let added = 0;
  Array.from(files).slice(0, available).forEach(f => {
    if (f.size > ATT_MAX_SIZE) { showToast(`⚠️ ${f.name} trop volumineux (max 10 Mo)`); return; }
    pendingAttachments.push(f);
    added++;
  });
  if (files.length > available) showToast(`⚠️ Limite de ${ATT_MAX_COUNT} fichiers atteinte`);
  renderModalAttachments(null);
}

// ════════════════════════════════════════════════════════════
//  PILLS — URGENCE & STATUT
// ════════════════════════════════════════════════════════════

function initUrgencyPills() {
  document.querySelectorAll('.urgency-pill').forEach(pill =>
    pill.addEventListener('click', () => setUrgencyPill(pill.dataset.value))
  );
}
function setUrgencyPill(value) {
  document.querySelectorAll('.urgency-pill').forEach(p =>
    p.classList.toggle('selected', p.dataset.value === value)
  );
}
function getSelectedUrgency() {
  return document.querySelector('.urgency-pill.selected')?.dataset.value || 'low';
}

function initStatusPills() {
  document.querySelectorAll('.status-pill').forEach(pill =>
    pill.addEventListener('click', () => setStatusPill(pill.dataset.value))
  );
}
function setStatusPill(value) {
  document.querySelectorAll('.status-pill').forEach(p =>
    p.classList.toggle('selected', p.dataset.value === value)
  );
}
function getSelectedStatus() {
  return document.querySelector('.status-pill.selected')?.dataset.value || 'en-cours';
}

// ════════════════════════════════════════════════════════════
//  RÉCURRENCE
// ════════════════════════════════════════════════════════════

/**
 * Structure recurrence sur une tâche :
 *  { type: 'none'|'weekly'|'monthly'|'yearly'|'infinite',
 *    interval: number (tous les N),
 *    endDate: 'YYYY-MM-DD'|null }
 *
 * type 'none'     → pas de récurrence (deadline normale)
 * type 'weekly'   → tous les N semaines à partir de la deadline
 * type 'monthly'  → tous les N mois
 * type 'yearly'   → tous les N ans
 * type 'infinite' → récurrence sans fin (hebdo par défaut, interval 1)
 *
 * Quand markAsRealise() est appelé sur une tâche récurrente :
 *  - on calcule la prochaine deadline
 *  - on remet le statut à 'en-cours'
 *  - aucune archive créée
 */

function initDayPills() {
  document.querySelectorAll('.day-pill').forEach(pill =>
    pill.addEventListener('click', () => pill.classList.toggle('selected'))
  );
}

function initRecurrencePills() {
  document.querySelectorAll('.recurrence-pill').forEach(pill =>
    pill.addEventListener('click', () => {
      setRecurrencePill(pill.dataset.value);
      updateRecurrencePanel();
    })
  );
}

function setRecurrencePill(value) {
  document.querySelectorAll('.recurrence-pill').forEach(p =>
    p.classList.toggle('selected', p.dataset.value === value)
  );
}

function getSelectedRecurrence() {
  return document.querySelector('.recurrence-pill.selected')?.dataset.value || 'none';
}

function updateRecurrencePanel() {
  const type  = getSelectedRecurrence();
  const panel = document.getElementById('recurrencePanel');
  if (!panel) return;
  panel.style.display = (type === 'none') ? 'none' : '';
  const daysWrap  = document.getElementById('recDaysWrap');
  const endWrap   = document.getElementById('recEndWrap');
  const noEndChk  = document.getElementById('recNoEnd');
  if (daysWrap) daysWrap.style.display = (type === 'weekly') ? '' : 'none';
  // Masquer le champ date de fin si "sans fin" est coché
  if (endWrap && noEndChk) endWrap.style.display = noEndChk.checked ? 'none' : '';
}

function fillRecurrenceFields(rec) {
  const intervalEl = document.getElementById('recInterval');
  const endEl      = document.getElementById('recEndDate');
  const noEndChk   = document.getElementById('recNoEnd');
  if (intervalEl) intervalEl.value = rec?.interval || 1;
  // "sans fin" si type infinite (ancien format) ou endDate absent
  const isNoEnd = rec ? (rec.type === 'infinite' || !rec.endDate) : false;
  if (noEndChk) noEndChk.checked = isNoEnd;
  if (endEl)    endEl.value      = (!isNoEnd && rec?.endDate) ? rec.endDate : '';
  // Jours hebdo
  const days = rec?.days || [];
  document.querySelectorAll('.day-pill').forEach(p =>
    p.classList.toggle('selected', days.includes(Number(p.dataset.day)))
  );
  updateRecurrencePanel();
}

function getRecurrenceFromForm() {
  const type = getSelectedRecurrence();
  if (type === 'none') return null;
  const interval  = parseInt(document.getElementById('recInterval')?.value) || 1;
  const noEnd     = document.getElementById('recNoEnd')?.checked ?? false;
  const endDate   = noEnd ? null : (document.getElementById('recEndDate')?.value || null);
  const days = type === 'weekly'
    ? [...document.querySelectorAll('.day-pill.selected')].map(p => Number(p.dataset.day))
    : [];
  return { type, interval, days, endDate };
}

/**
 * Calcule la prochaine deadline à partir de la deadline actuelle.
 * Pour weekly avec des jours spécifiques : trouve le prochain jour coché.
 * Rétrocompat : type 'infinite' (ancien format) traité comme weekly sans fin.
 * Retourne une string 'YYYY-MM-DD', ou null si récurrence terminée.
 */
function nextDeadline(deadlineStr, rec) {
  if (!rec || rec.type === 'none') return deadlineStr;
  const now = new Date(); now.setHours(0,0,0,0);

  // Helper : construire une Date locale depuis 'YYYY-MM-DD'
  const localDate = s => { const [y,m,d] = s.split('-'); return new Date(+y, +m-1, +d); };
  // Helper : formater une Date locale en 'YYYY-MM-DD'
  const toYMD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  // Rétrocompat : type 'infinite' → hebdo sans fin
  const type     = rec.type === 'infinite' ? 'weekly' : rec.type;
  const interval = rec.interval || 1;

  // ── Cas sans deadline (récurrence hebdo avec jours spécifiques) ──
  // On cherche le prochain jour coché à partir de demain.
  if (!deadlineStr) {
    if (type === 'weekly' && rec.days && rec.days.length > 0) {
      const sortedDays = [...rec.days].sort((a, b) => a - b);
      const base = new Date(now);
      base.setDate(base.getDate() + 1); // demain
      for (let i = 0; i < 7 * interval * 54; i++) {
        const candidate = new Date(base);
        candidate.setDate(base.getDate() + i);
        if (sortedDays.includes(candidate.getDay())) {
          if (rec.endDate && candidate > localDate(rec.endDate)) return null;
          return toYMD(candidate);
        }
      }
      return null;
    }
    // Hebdo sans jours spécifiques et sans deadline → prochain semaine
    if (type === 'weekly') {
      const next = new Date(now);
      next.setDate(next.getDate() + 7 * interval);
      if (rec.endDate && next > localDate(rec.endDate)) return null;
      return toYMD(next);
    }
    // Mensuel/annuel sans deadline → pas de base pour calculer
    return null;
  }

  // ── Cas avec deadline ──

  // Cas weekly avec jours spécifiques
  if (type === 'weekly' && rec.days && rec.days.length > 0) {
    const sortedDays = [...rec.days].sort((a, b) => a - b);
    const base = localDate(deadlineStr);
    base.setDate(base.getDate() + 1);
    const maxDays = interval * 7 * 54; // ~1 an max
    for (let i = 0; i < maxDays; i++) {
      const candidate = new Date(base);
      candidate.setDate(base.getDate() + i);
      if (sortedDays.includes(candidate.getDay()) && candidate >= now) {
        if (rec.endDate && candidate > localDate(rec.endDate)) return null;
        return toYMD(candidate);
      }
    }
    return null;
  }

  // Cas général (weekly sans jours, monthly, yearly)
  const d = localDate(deadlineStr);
  let iterations = 0;
  while (d <= now && iterations < 1000) {
    if      (type === 'weekly')  d.setDate(d.getDate() + 7 * interval);
    else if (type === 'monthly') d.setMonth(d.getMonth() + interval);
    else if (type === 'yearly')  d.setFullYear(d.getFullYear() + interval);
    iterations++;
  }
  if (rec.endDate && d > localDate(rec.endDate)) return null;
  return toYMD(d);
}

// Label et badge récurrence
function recurrenceLabel(rec) {
  if (!rec || rec.type === 'none') return null;
  const DAY_NAMES = { 0:'Dim', 1:'Lun', 2:'Mar', 3:'Mer', 4:'Jeu', 5:'Ven', 6:'Sam' };
  const endSuffix = rec.endDate ? ` → ${new Date(rec.endDate).toLocaleDateString('fr-FR')}` : ' ∞';
  // Rétrocompat : type 'infinite' (ancien format)
  if (rec.type === 'infinite') return '🔁 Hebdo ×1 ∞';
  if (rec.type === 'weekly') {
    const n        = rec.interval || 1;
    const daysPart = rec.days && rec.days.length
      ? ' · ' + [...rec.days].sort((a,b)=>a-b).map(d => DAY_NAMES[d]).join(', ')
      : '';
    return `🔁 Hebdo ×${n}${daysPart}${endSuffix}`;
  }
  const typeLabels = { monthly:'mens.', yearly:'annuel' };
  const n = rec.interval || 1;
  return `🔁 Tous les ${n} ${typeLabels[rec.type] || rec.type}${endSuffix}`;
}

// ════════════════════════════════════════════════════════════
//  FILTRE + TRI
// ════════════════════════════════════════════════════════════

function initFilterTabs() {
  document.querySelectorAll('.filter-tab').forEach(tab =>
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter;
      renderTasks(true);
    })
  );
}

function getActiveTasks()   { return tasks.filter(t => t.status !== 'realise'); }
function getArchivedTasks() { return tasks.filter(t => t.status === 'realise'); }

function applyFilters(list, urgFilter, reqFilter, typeFilter) {
  if (urgFilter  && urgFilter  !== 'all') list = list.filter(t => t.urgency   === urgFilter);
  if (reqFilter  && reqFilter  !== 'all') list = list.filter(t => t.requester === reqFilter);
  if (typeFilter && typeFilter !== 'all') list = list.filter(t => t.type      === typeFilter);
  return list;
}

function applySearch(list, query) {
  if (!query) return list;
  const q = query.toLowerCase().trim();
  return list.filter(t => {
    const commentText = t.comment
      ? (new DOMParser().parseFromString(t.comment, 'text/html').body.textContent || '').toLowerCase()
      : '';
    return (
      (t.title     || '').toLowerCase().includes(q) ||
      commentText.includes(q) ||
      (t.requester || '').toLowerCase().includes(q) ||
      (t.type      || '').toLowerCase().includes(q) ||
      (t.customRef || '').toLowerCase().includes(q)
    );
  });
}

let _searchTimer;
function onSearchTasks(input) {
  const wrap = document.getElementById('searchWrapTasks');
  wrap.classList.toggle('has-value', input.value.length > 0);
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => { searchQueryTasks = input.value; renderTasks(true); }, 180);
}
function onSearchArchives(input) {
  const wrap = document.getElementById('searchWrapArchives');
  wrap.classList.toggle('has-value', input.value.length > 0);
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => { searchQueryArchives = input.value; renderArchives(true); }, 180);
}
function clearSearch(inputId, wrapId) {
  const input = document.getElementById(inputId);
  const wrap  = document.getElementById(wrapId);
  input.value = '';
  wrap.classList.remove('has-value');
  if (inputId === 'searchTasks')    { searchQueryTasks    = ''; renderTasks(true); }
  if (inputId === 'searchArchives') { searchQueryArchives = ''; renderArchives(true); }
  input.focus();
}

/**
 * Tri principal : les tâches échues (deadline ≤ aujourd'hui) remontent toujours en premier,
 * triées entre elles par urgence décroissante.
 * Les autres suivent selon le tri sélectionné.
 */
function applySort(list, sort) {
  const now = new Date(); now.setHours(0,0,0,0);
  const urgOrder = { high:0, medium:1, low:2 };

  const isDue = t => isTaskDueToday(t);

  const due    = list.filter(isDue);
  const notDue = list.filter(t => !isDue(t));

  // Les échues / dues aujourd'hui → urgence décroissante, puis deadline ASC
  due.sort((a,b) => {
    const ud = (urgOrder[a.urgency]??1) - (urgOrder[b.urgency]??1);
    if (ud !== 0) return ud;
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  // Les autres → tri choisi
  if      (sort === 'date-asc')     notDue.sort((a,b) => a.id - b.id);
  else if (sort === 'date-desc')    notDue.sort((a,b) => b.id - a.id);
  else if (sort === 'deadline-asc') notDue.sort((a,b) => {
    if (!a.deadline) return 1; if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });
  else if (sort === 'urgency') notDue.sort((a,b) =>
    (urgOrder[a.urgency]??1) - (urgOrder[b.urgency]??1)
  );

  return [...due, ...notDue];
}

// ════════════════════════════════════════════════════════════
//  CRUD
// ════════════════════════════════════════════════════════════

async function submitForm() {
  const title      = document.getElementById('taskTitle').value.trim();
  const customRef  = document.getElementById('taskRef').value.trim();
  // Lire le HTML Quill ; si vide (seul <p><br></p>), on stocke ''
  const quillHTML  = quillModal.getSemanticHTML();
  const comment    = (quillModal.getText().trim() === '') ? '' : quillHTML;
  const urgency    = getSelectedUrgency();
  const status     = getSelectedStatus();
  const deadline   = document.getElementById('deadline').value;
  const requester  = document.getElementById('taskRequester').value;
  const type       = document.getElementById('taskType').value;
  const recurrence = getRecurrenceFromForm();

  if (!title) { shake(document.getElementById('taskTitle')); return; }

  const wasArchived = editingId && tasks.find(t => t.id === editingId)?.status === 'realise';

  // Si l'utilisateur marque "Réalisé" mais que la tâche est récurrente,
  // on calcule la prochaine deadline et on force le statut à "en-cours".
  let effectiveStatus  = status;
  let effectiveDeadline = deadline;
  let recurrenceToast  = null;

  if (status === 'realise' && recurrence && recurrence.type !== 'none') {
    const next = nextDeadline(deadline, recurrence);
    if (next) {
      effectiveStatus   = 'en-cours';
      effectiveDeadline = next;
      recurrenceToast   = `🔁 Récurrence : prochaine échéance le ${new Date(next).toLocaleDateString('fr-FR')}`;
    }
    // Si next === null (récurrence terminée) → on laisse archiver normalement
  }

  if (editingId) {
    tasks = tasks.map(t => t.id === editingId
      ? { ...t, title, comment, urgency, status: effectiveStatus, deadline: effectiveDeadline,
          requester, type, customRef, recurrence,
          archivedAt: effectiveStatus === 'realise' ? (t.archivedAt || new Date().toISOString()) : null }
      : t
    );
    await saveToStorage();
    // Pièces jointes ajoutées dans le formulaire de modification
    // (processAttachFiles fait son propre save + toast)
    if (pendingAttachments.length > 0) {
      await processAttachFiles(editingId, pendingAttachments);
      pendingAttachments = [];
    }
    showToast('✏️ Tâche modifiée');
  } else {
    const newId = Date.now();
    tasks.push({
      id: newId, title, comment, urgency, status: effectiveStatus,
      deadline: effectiveDeadline, requester, type, customRef, recurrence,
      archivedAt: effectiveStatus === 'realise' ? new Date().toISOString() : null
    });
    await saveToStorage();
    // Pièces jointes en attente → maintenant qu'on a l'id, on les attache
    if (pendingAttachments.length > 0) {
      await processAttachFiles(newId, pendingAttachments);
      pendingAttachments = [];
    }
    showToast('✅ Tâche ajoutée');
  }

  renderTasks(); if (activePage === 'archives') renderArchives();
  renderStats(); updateTabCounts(); closeModal();

  if (recurrenceToast) {
    showToast(recurrenceToast);
  } else if (effectiveStatus === 'realise' && !wasArchived) {
    showToast("🗄 Tâche archivée — consultez l'onglet Archives");
  }
}

async function restoreTask(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, status: 'en-cours', archivedAt: null } : t);
  await saveToStorage();
  renderArchives(); renderTasks(); renderStats(); updateTabCounts();
  showToast('↩️ Tâche restaurée en cours');
}

/**
 * Marque une tâche réalisée.
 * Si elle est récurrente → recalcule la deadline et remet en cours (pas d'archive).
 * Sinon → comportement classique (archive).
 */
async function markAsRealise(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  if (task.recurrence && task.recurrence.type !== 'none') {
    const next = nextDeadline(task.deadline, task.recurrence);
    if (next) {
      // Récurrence active : remettre en cours avec la prochaine deadline
      tasks = tasks.map(t => t.id === id
        ? { ...t, status: 'en-cours', deadline: next, archivedAt: null }
        : t
      );
      await saveToStorage();
      renderTasks(); renderStats(); updateTabCounts();
      showToast(`🔁 Récurrence : prochaine échéance le ${new Date(next).toLocaleDateString('fr-FR')}`);
      return;
    } else {
      // Récurrence terminée (endDate dépassée) → archiver normalement
      showToast('🔁 Récurrence terminée — tâche archivée');
    }
  }

  tasks = tasks.map(t => t.id === id
    ? { ...t, status: 'realise', archivedAt: t.archivedAt || new Date().toISOString() }
    : t
  );
  await saveToStorage();
  renderTasks(); renderArchives(); renderStats(); updateTabCounts();
  showToast("✅ Tâche réalisée — consultez l'onglet Archives");
}

function confirmDelete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('confirmTitle').textContent = 'Confirmer la suppression';
  document.getElementById('confirmMsg').textContent   = `Supprimer « ${task.title} » ? Cette action est irréversible.`;
  document.getElementById('confirmOverlay').classList.add('open');
  document.getElementById('confirmYes').onclick = async () => {
    await attDeleteAllForTask(id);
    tasks = tasks.filter(t => t.id !== id);
    await saveToStorage();
    renderTasks(); renderArchives(); renderStats(); updateTabCounts(); closeConfirm();
    showToast('🗑 Tâche supprimée');
  };
}

function closeConfirm() { document.getElementById('confirmOverlay').classList.remove('open'); }

function clearAllTasks() {
  if (!tasks.length) return;
  document.getElementById('confirmTitle').textContent = 'Effacer toutes les tâches ?';
  document.getElementById('confirmMsg').textContent   = `${tasks.length} tâche(s) seront supprimées définitivement.`;
  document.getElementById('confirmOverlay').classList.add('open');
  document.getElementById('confirmYes').onclick = async () => {
    // Supprimer toutes les pièces jointes de chaque tâche
    for (const t of tasks) await attDeleteAllForTask(t.id);
    tasks = [];
    await saveToStorage();
    renderTasks(); renderArchives(); renderStats(); updateTabCounts(); closeConfirm();
    showToast('🗑 Toutes les tâches effacées');
  };
}

// ════════════════════════════════════════════════════════════
//  RENDU — TÂCHES ACTIVES
// ════════════════════════════════════════════════════════════

function renderTasks(resetPage = false) {
  if (resetPage) currentPageTasks = 1;

  const container = document.getElementById('tasks');
  container.innerHTML = '';

  const urgFilter  = activeFilter;
  const reqFilter  = document.getElementById('filterRequester')?.value  || 'all';
  const typeFilter = document.getElementById('filterType')?.value       || 'all';
  const sort       = document.getElementById('sortSelect')?.value       || 'date-asc';

  let list = applyFilters(getActiveTasks(), urgFilter, reqFilter, typeFilter);
  list = applySearch(list, searchQueryTasks);
  list = applySort(list, sort);

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">📋</div>
        <strong>Aucune tâche ici</strong>
        <p>${urgFilter !== 'all' || reqFilter !== 'all' || typeFilter !== 'all'
          ? 'Aucune tâche pour ces filtres.'
          : 'Commencez par créer votre première tâche.'}</p>
      </div>`;
    renderPagination('paginationTasks', 0, currentPageTasks, () => renderTasks());
    return;
  }

  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  currentPageTasks = Math.min(currentPageTasks, totalPages);
  const start = (currentPageTasks - 1) * PAGE_SIZE;
  const page  = list.slice(start, start + PAGE_SIZE);

  page.forEach((task, idx) => container.appendChild(buildCard(task, start + idx, false)));
  renderPagination('paginationTasks', list.length, currentPageTasks, p => {
    currentPageTasks = p; renderTasks();
    document.getElementById('pageTasks').scrollIntoView({ behavior:'smooth', block:'start' });
  });
}

// ════════════════════════════════════════════════════════════
//  RENDU — ARCHIVES
// ════════════════════════════════════════════════════════════

function renderArchives(resetPage = false) {
  if (resetPage) currentPageArchives = 1;

  const container = document.getElementById('archives');
  container.innerHTML = '';

  const reqFilter  = document.getElementById('archiveFilterRequester')?.value || 'all';
  const typeFilter = document.getElementById('archiveFilterType')?.value      || 'all';
  const sort       = document.getElementById('archiveSortSelect')?.value      || 'date-desc';

  let list = applyFilters(getArchivedTasks(), 'all', reqFilter, typeFilter);
  list = applySearch(list, searchQueryArchives);

  if      (sort === 'date-desc') list.sort((a,b) => new Date(b.archivedAt||0) - new Date(a.archivedAt||0));
  else if (sort === 'date-asc')  list.sort((a,b) => new Date(a.archivedAt||0) - new Date(b.archivedAt||0));
  else if (sort === 'urgency')   list.sort((a,b) =>
    ({high:0,medium:1,low:2}[a.urgency]??1) - ({high:0,medium:1,low:2}[b.urgency]??1)
  );

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">🗄</div>
        <strong>Aucune tâche archivée</strong>
        <p>Les tâches marquées "Réalisé" apparaîtront ici.</p>
      </div>`;
    renderPagination('paginationArchives', 0, currentPageArchives, () => renderArchives());
    return;
  }

  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  currentPageArchives = Math.min(currentPageArchives, totalPages);
  const start = (currentPageArchives - 1) * PAGE_SIZE;
  const page  = list.slice(start, start + PAGE_SIZE);

  page.forEach((task, idx) => container.appendChild(buildCard(task, start + idx, true)));
  renderPagination('paginationArchives', list.length, currentPageArchives, p => {
    currentPageArchives = p; renderArchives();
    document.getElementById('pageArchives').scrollIntoView({ behavior:'smooth', block:'start' });
  });
}

// ════════════════════════════════════════════════════════════
//  CONSTRUCTION D'UNE CARTE
// ════════════════════════════════════════════════════════════

function buildCard(task, idx, isArchive) {
  const dc  = deadlineLabel(task.deadline);
  const p   = progressPercent(task.deadline);
  const now = new Date(); now.setHours(0,0,0,0);
  const isDue = !isArchive && isTaskDueToday(task);

  // Pour les récurrentes sans deadline mais dues aujourd'hui → chip spécial
  const isRecDueNoDeadline = !isArchive && !task.deadline && isDue;

  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };

  const card = document.createElement('div');
  // Classe due-today pour le fond coloré urgence
  card.className = `task-card ${task.urgency || 'low'}${isArchive ? ' archived' : ''}${isDue ? ' due-today' : ''}`;
  card.style.animationDelay = `${idx * 0.04}s`;

  const archivedDateHtml = isArchive && task.archivedAt
    ? `<span class="archive-date-chip">✅ Réalisé le ${new Date(task.archivedAt).toLocaleDateString('fr-FR')}</span>`
    : '';

  const recLabel = recurrenceLabel(task.recurrence);
  const recBadge = recLabel ? `<span class="recurrence-badge">${recLabel}</span>` : '';
  const attCount = (task.attachments || []).length;
  const attBadge = attCount > 0 ? `<span class="att-badge">📎 ${attCount}</span>` : '';

  // Chip deadline : soit deadline classique, soit "Aujourd'hui" pour récurrence sans deadline
  const deadlineChipHtml = task.deadline
    ? `<div class="card-deadline-chip ${dc.cls}">📅 ${dc.label}</div>`
    : (isRecDueNoDeadline ? `<div class="card-deadline-chip overdue">📅 Aujourd'hui</div>` : '');

  card.innerHTML = `
    <div class="card-header">
      <span class="card-index">#${String(idx+1).padStart(2,'0')}</span>
      <div class="card-title">${escHtml(task.title)}</div>
    </div>
    <div class="card-badges">
      <span class="urgency-badge ${task.urgency}">${urgencyLabels[task.urgency]||task.urgency}</span>
      ${!isArchive ? `<span class="status-badge ${task.status}">${statusLabels[task.status]||task.status}</span>` : ''}
      ${task.requester ? `<span class="requester-badge">${escHtml(task.requester)}</span>` : ''}
      ${task.type      ? `<span class="type-badge">${escHtml(task.type)}</span>`           : ''}
      ${task.customRef ? `<span class="ref-badge">🔖 ${escHtml(task.customRef)}</span>`   : ''}
      ${recBadge}
      ${attBadge}
    </div>
    <div class="card-meta-row">
      ${deadlineChipHtml}
      ${archivedDateHtml}
    </div>
    ${task.comment ? `<div class="card-comment-html">${task.comment}</div>` : ''}
    ${!isArchive && task.deadline ? `
      <div class="progress-wrap">
        <div class="progress-info"><span>Avancement deadline</span><span>${Math.round(p)}%</span></div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${p}%;background:${progressColor(p)}"></div>
        </div>
      </div>` : ''}
    <div class="card-actions">
      <button class="btn btn-ghost btn-sm" onclick="openModal(${task.id})">✏️ Modifier</button>
      ${isArchive
        ? `<button class="btn btn-info btn-sm" onclick="restoreTask(${task.id})">↩️ Restaurer</button>`
        : `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();markAsRealise(${task.id})">✅ Réalisé</button>`}
      <button class="btn btn-danger btn-sm" onclick="confirmDelete(${task.id})">🗑 Supprimer</button>
    </div>
  `;

  card.addEventListener('click', e => {
    if (!e.target.closest('button')) openDetail(task.id);
  });

  // ── Drag & drop pièces jointes directement sur la carte ──
  card.addEventListener('dragover', e => {
    e.preventDefault(); e.stopPropagation();
    card.classList.add('card-dragover');
  });
  card.addEventListener('dragleave', e => {
    card.classList.remove('card-dragover');
  });
  card.addEventListener('drop', async e => {
    e.preventDefault(); e.stopPropagation();
    card.classList.remove('card-dragover');
    if (e.dataTransfer.files.length) await processAttachFiles(task.id, e.dataTransfer.files);
  });

  return card;
}

// ════════════════════════════════════════════════════════════
//  MODALE DE DÉTAIL — LECTURE + ÉDITION INLINE
// ════════════════════════════════════════════════════════════

// ID de la tâche actuellement affichée dans la modale de détail
let _detailTaskId = null;

function openDetail(id) {
  _detailTaskId = id;
  _renderDetail(id);
  document.getElementById('detailOverlay').classList.add('open');
}

function _renderDetail(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const isArchive     = task.status === 'realise';
  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };
  const dc = deadlineLabel(task.deadline);
  const p  = progressPercent(task.deadline);

  const modal = document.getElementById('detailModal');
  modal.className = `detail-modal ${task.urgency || 'low'}`;

  // ── Titre (inline-editable) ──────────────────────────────
  const titleEl = document.getElementById('detailTitle');
  titleEl.textContent = task.title;
  titleEl.classList.add('inline-editable');
  titleEl.title = 'Cliquer pour modifier';
  titleEl.onclick = () => inlineEditText(titleEl, task.title, async val => {
    if (!val) return;
    tasks = tasks.map(t => t.id === id ? { ...t, title: val } : t);
    await saveToStorage(); renderTasks(); if (activePage==='archives') renderArchives();
    showToast('✏️ Titre mis à jour');
    titleEl.textContent = val;
    titleEl.classList.add('inline-editable');
  });

  // ── Badges ──────────────────────────────────────────────
  const recLabel = recurrenceLabel(task.recurrence);
  document.getElementById('detailBadges').innerHTML = `
    <span class="urgency-badge ${task.urgency} inline-editable" title="Modifier l'urgence"
      onclick="inlineEditUrgency(${id})">${urgencyLabels[task.urgency] || task.urgency}</span>
    <span class="status-badge ${task.status} inline-editable" title="Modifier le statut"
      onclick="inlineEditStatus(${id})">${statusLabels[task.status] || task.status}</span>
    ${task.requester ? `<span class="requester-badge">${escHtml(task.requester)}</span>` : ''}
    ${task.type      ? `<span class="type-badge">${escHtml(task.type)}</span>`           : ''}
    ${task.customRef ? `<span class="ref-badge inline-editable" title="Modifier la référence" onclick="inlineEditRef(${id})">🔖 ${escHtml(task.customRef)}</span>` : `<span class="ref-badge" style="opacity:.45;cursor:pointer;" title="Ajouter une référence" onclick="inlineEditRef(${id})">🔖 Ajouter une réf.</span>`}
    ${recLabel       ? `<span class="recurrence-badge">${recLabel}</span>`               : ''}
  `;

  // ── Grille de champs ────────────────────────────────────
  const addedDate    = new Date(task.id).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const archivedDate = task.archivedAt
    ? new Date(task.archivedAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
    : null;

  document.getElementById('detailGrid').innerHTML = `
    <div class="detail-field inline-editable" title="Modifier le demandeur" onclick="inlineEditSelect(${id},'requester')">
      <span class="df-label">Demandeur <span class="df-edit-hint">✎</span></span>
      <span class="df-value${!task.requester?' empty':''}">${task.requester || '—'}</span>
    </div>
    <div class="detail-field inline-editable" title="Modifier le type" onclick="inlineEditSelect(${id},'type')">
      <span class="df-label">Type <span class="df-edit-hint">✎</span></span>
      <span class="df-value${!task.type?' empty':''}">${task.type || '—'}</span>
    </div>
    <div class="detail-field">
      <span class="df-label">Créée le</span>
      <span class="df-value">${addedDate}</span>
    </div>
    <div class="detail-field inline-editable" title="Modifier la deadline" onclick="inlineEditDeadline(${id})">
      <span class="df-label">Deadline <span class="df-edit-hint">✎</span></span>
      <span class="df-value${!task.deadline?' empty':''}">${task.deadline ? '📅 ' + dc.label : '—'}</span>
    </div>
    ${archivedDate ? `<div class="detail-field"><span class="df-label">Réalisée le</span><span class="df-value">${archivedDate}</span></div>` : ''}
  `;

  // ── Commentaire (inline-editable) ───────────────────────
  const commentBlock = document.getElementById('detailCommentBlock');
  commentBlock.innerHTML = `
    <div class="detail-comment-block inline-editable" title="Modifier la description" onclick="inlineEditComment(${id})">
      <span class="df-label">Description <span class="df-edit-hint">✎</span></span>
      <div class="detail-comment-html">${task.comment || '<em style="color:var(--muted);font-style:italic">Cliquer pour ajouter une description…</em>'}</div>
    </div>`;

  // ── Barre de progression ────────────────────────────────
  const progressBlock = document.getElementById('detailProgressBlock');
  progressBlock.innerHTML = (!isArchive && task.deadline)
    ? `<div class="detail-progress-block">
        <span class="df-label">Avancement deadline</span>
        <div class="detail-progress-info"><span>${dc.label}</span><span>${Math.round(p)} %</span></div>
        <div class="detail-progress-bar">
          <div class="detail-progress-fill" style="width:${p}%;background:${progressColor(p)}"></div>
        </div>
       </div>`
    : '';

  // ── Pièces jointes ───────────────────────────────────────
  const attContainer = document.getElementById('detailAttachments');
  if (attContainer) renderAttachmentsBlock(id, attContainer);

  // ── Footer ──────────────────────────────────────────────
  document.getElementById('detailFooter').innerHTML = `
    ${isArchive
      ? `<button class="btn btn-info btn-sm" onclick="restoreTask(${task.id});closeDetail()">↩️ Restaurer</button>`
      : `<button class="btn btn-success btn-sm" onclick="markAsRealise(${task.id});closeDetail()">✅ Marquer réalisé</button>`}
    <button class="btn btn-danger btn-sm" onclick="confirmDelete(${task.id});closeDetail()">🗑 Supprimer</button>
    <button class="btn btn-primary btn-sm" onclick="closeDetail();openModal(${task.id})">✏️ Modifier</button>
  `;
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('open');
  _detailTaskId = null;
}

function handleDetailOverlayClick(e) {
  if (e.target === document.getElementById('detailOverlay')) closeDetail();
}

// ── Helpers d'édition inline ─────────────────────────────

/**
 * Remplace el par un input texte, valide sur Enter/blur, annule sur Escape.
 */
function inlineEditText(el, currentValue, onSave) {
  if (el.querySelector('input')) return; // déjà en édition
  const input = document.createElement('input');
  input.className = 'inline-input';
  input.value     = currentValue;
  input.maxLength = 120;
  el.innerHTML = '';
  el.appendChild(input);
  el.onclick = null;
  input.focus(); input.select();

  const commit = async () => {
    const val = input.value.trim();
    await onSave(val);
  };
  const cancel = () => {
    el.textContent = currentValue;
    el.classList.add('inline-editable');
    el.onclick = () => inlineEditText(el, currentValue, onSave);
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
}

/** Édition inline d'un select (demandeur / type) */
async function inlineEditSelect(id, field) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const values   = field === 'requester' ? allRequesters() : allTypes();
  const label    = field === 'requester' ? 'Demandeur' : 'Type';
  const current  = task[field] || '';

  // Créer un select flottant
  const sel = document.createElement('select');
  sel.className = 'inline-select';
  const emptyOpt = document.createElement('option');
  emptyOpt.value = ''; emptyOpt.textContent = '— Aucun —';
  sel.appendChild(emptyOpt);
  values.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    if (v === current) o.selected = true;
    sel.appendChild(o);
  });

  // Trouver le champ dans le detailGrid
  const grid = document.getElementById('detailGrid');
  const fields = grid.querySelectorAll('.detail-field');
  let targetField = null;
  fields.forEach(f => { if (f.querySelector('.df-label')?.textContent.startsWith(label)) targetField = f; });
  if (!targetField) return;

  const valueEl = targetField.querySelector('.df-value');
  const origHTML = targetField.innerHTML;
  targetField.innerHTML = '';
  targetField.appendChild(sel);
  targetField.onclick = null;

  sel.focus();

  const commit = async () => {
    const val = sel.value;
    tasks = tasks.map(t => t.id === id ? { ...t, [field]: val } : t);
    await saveToStorage();
    renderTasks(); if (activePage === 'archives') renderArchives();
    showToast(`✏️ ${label} mis à jour`);
    _renderDetail(id);
  };
  sel.addEventListener('change', commit);
  sel.addEventListener('blur', () => { setTimeout(() => _renderDetail(id), 100); });
  sel.addEventListener('keydown', e => {
    if (e.key === 'Escape') { targetField.innerHTML = origHTML; _renderDetail(id); }
  });
}

/** Édition inline de la deadline */
function inlineEditDeadline(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const grid = document.getElementById('detailGrid');
  const fields = grid.querySelectorAll('.detail-field');
  let targetField = null;
  fields.forEach(f => { if (f.querySelector('.df-label')?.textContent.startsWith('Deadline')) targetField = f; });
  if (!targetField) return;

  const origHTML = targetField.innerHTML;
  targetField.innerHTML = '';
  targetField.onclick = null;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;';

  const inp = document.createElement('input');
  inp.type      = 'date';
  inp.className = 'inline-input';
  inp.value     = task.deadline || '';

  const clearBtn = document.createElement('button');
  clearBtn.className   = 'btn btn-ghost btn-sm';
  clearBtn.textContent = '✕ Effacer';
  clearBtn.style.fontSize = '.7rem';

  wrap.appendChild(inp); wrap.appendChild(clearBtn);
  targetField.appendChild(wrap);
  inp.focus();

  const commit = async (val) => {
    tasks = tasks.map(t => t.id === id ? { ...t, deadline: val } : t);
    await saveToStorage();
    renderTasks(); if (activePage === 'archives') renderArchives();
    showToast('✏️ Deadline mise à jour');
    _renderDetail(id);
  };
  inp.addEventListener('change', () => commit(inp.value));
  inp.addEventListener('blur', () => setTimeout(() => _renderDetail(id), 200));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') { _renderDetail(id); }
    if (e.key === 'Enter')  { commit(inp.value); }
  });
  clearBtn.addEventListener('click', () => commit(''));
}

/** Édition inline du commentaire */
function inlineEditComment(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const block = document.querySelector('#detailCommentBlock .detail-comment-block');
  if (!block) return;
  if (block.querySelector('.inline-quill-wrap')) return; // déjà ouvert

  // Remplacer le contenu par un éditeur Quill inline
  block.onclick = null;
  block.classList.remove('inline-editable');
  block.title = '';

  const lbl = block.querySelector('.df-label');
  if (lbl) lbl.innerHTML = 'Description';

  // Supprimer l'ancien contenu (sauf le label)
  [...block.children].forEach(c => { if (!c.classList.contains('df-label')) c.remove(); });

  // Créer le conteneur Quill
  const wrap = document.createElement('div');
  wrap.className = 'inline-quill-wrap';
  const editorDiv = document.createElement('div');
  wrap.appendChild(editorDiv);
  block.appendChild(wrap);

  const q = new Quill(editorDiv, {
    theme: 'snow',
    placeholder: 'Détails, notes, contexte…',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'clean']
      ]
    }
  });
  if (task.comment) q.clipboard.dangerouslyPasteHTML(task.comment);
  q.focus();

  // Boutons Valider / Annuler
  const actions = document.createElement('div');
  actions.className = 'inline-quill-actions';
  const btnOk = document.createElement('button');
  btnOk.className = 'btn btn-primary btn-sm';
  btnOk.textContent = '✔ Valider';
  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-ghost btn-sm';
  btnCancel.textContent = 'Annuler';
  actions.appendChild(btnOk);
  actions.appendChild(btnCancel);
  block.appendChild(actions);

  const commit = async () => {
    const html = q.getSemanticHTML();
    const val  = q.getText().trim() === '' ? '' : html;
    tasks = tasks.map(t => t.id === id ? { ...t, comment: val } : t);
    await saveToStorage();
    renderTasks(); if (activePage === 'archives') renderArchives();
    showToast('✏️ Description mise à jour');
    _renderDetail(id);
  };

  btnOk.addEventListener('click', commit);
  btnCancel.addEventListener('click', () => _renderDetail(id));
}

/** Édition inline de la référence personnalisée */
function inlineEditRef(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const badges = document.getElementById('detailBadges');
  // Trouver le badge ref dans les badges
  const refBadge = [...badges.querySelectorAll('.ref-badge')][0];
  if (!refBadge) return;

  const origHTML = refBadge.outerHTML;
  const inp = document.createElement('input');
  inp.className   = 'inline-input';
  inp.type        = 'text';
  inp.value       = task.customRef || '';
  inp.maxLength   = 40;
  inp.placeholder = 'Ex : REF-001…';
  inp.style.cssText = 'font-size:.8rem;font-weight:600;font-family:var(--font-body);width:160px;padding:.25rem .5rem;';
  refBadge.replaceWith(inp);
  inp.focus(); inp.select();

  const commit = async () => {
    const val = inp.value.trim();
    tasks = tasks.map(t => t.id === id ? { ...t, customRef: val } : t);
    await saveToStorage();
    renderTasks(); if (activePage === 'archives') renderArchives();
    showToast('✏️ Référence mise à jour');
    _renderDetail(id);
  };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { _renderDetail(id); }
  });
}

/** Sélecteur inline urgence (popup pills) */
function inlineEditUrgency(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const urgencies = ['low','medium','high'];
  const labels    = { low:'🟢 Faible', medium:'🟡 Moyenne', high:'🔴 Urgente' };
  _showInlinePicker(
    document.getElementById('detailBadges'),
    urgencies.map(u => ({ value: u, label: labels[u], current: u === task.urgency })),
    async val => {
      tasks = tasks.map(t => t.id === id ? { ...t, urgency: val } : t);
      await saveToStorage();
      renderTasks(); if (activePage === 'archives') renderArchives();
      document.getElementById('detailModal').className = `detail-modal ${val}`;
      showToast('✏️ Urgence mise à jour');
      _renderDetail(id);
    }
  );
}

/** Sélecteur inline statut (popup pills) */
function inlineEditStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const statuses = ['en-cours','en-attente','realise'];
  const labels   = { 'en-cours':'🔵 En cours', 'en-attente':'⏳ En attente', 'realise':'✅ Réalisé' };
  _showInlinePicker(
    document.getElementById('detailBadges'),
    statuses.map(s => ({ value: s, label: labels[s], current: s === task.status })),
    async val => {
      tasks = tasks.map(t => t.id === id
        ? { ...t, status: val, archivedAt: val === 'realise' ? (t.archivedAt || new Date().toISOString()) : null }
        : t
      );
      await saveToStorage();
      renderTasks(); if (activePage === 'archives') renderArchives();
      updateTabCounts(); renderStats();
      showToast('✏️ Statut mis à jour');
      _renderDetail(id);
    }
  );
}

/** Affiche un picker de pills inline sous l'élément cible */
function _showInlinePicker(anchorEl, options, onPick) {
  // Supprimer un picker déjà ouvert
  document.querySelectorAll('.inline-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'inline-picker';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'inline-picker-btn' + (opt.current ? ' current' : '');
    btn.textContent = opt.label;
    btn.addEventListener('click', e => { e.stopPropagation(); picker.remove(); onPick(opt.value); });
    picker.appendChild(btn);
  });

  anchorEl.appendChild(picker);

  // Fermer si clic hors du picker
  const close = e => { if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close, true); } };
  setTimeout(() => document.addEventListener('click', close, true), 0);
}

// ════════════════════════════════════════════════════════════
//  STATS & COMPTEURS
// ════════════════════════════════════════════════════════════

function renderStats() {
  const active  = getActiveTasks();
  const arch    = getArchivedTasks();
  const urgent  = active.filter(t => t.urgency === 'high').length;
  const waiting = active.filter(t => t.status === 'en-attente').length;
  const overdue = active.filter(t => t.deadline && new Date(t.deadline) < new Date()).length;

  document.getElementById('statsBar').innerHTML = `
    <div class="stat-card"><span class="label">En cours</span><span class="value">${active.length}</span></div>
    <div class="stat-card urgent"><span class="label">Urgentes</span><span class="value">${urgent}</span></div>
    <div class="stat-card soon"><span class="label">En attente</span><span class="value">${waiting}</span></div>
    <div class="stat-card ok"><span class="label">En retard</span><span class="value">${overdue}</span></div>
    <div class="stat-card arch"><span class="label">Archivées</span><span class="value">${arch.length}</span></div>
  `;
}

function updateTabCounts() {
  const el1 = document.getElementById('tabCountTasks');
  const el2 = document.getElementById('tabCountArchives');
  if (el1) el1.textContent = getActiveTasks().length;
  if (el2) el2.textContent = getArchivedTasks().length;
}

// ════════════════════════════════════════════════════════════
//  PAGINATION
// ════════════════════════════════════════════════════════════

function renderPagination(containerId, total, current, onPage) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { el.innerHTML = ''; el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.innerHTML = '';

  const add = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.textContent = label; btn.disabled = disabled;
    if (!disabled && !active) btn.addEventListener('click', () => onPage(page));
    el.appendChild(btn);
  };

  add('←', current - 1, current === 1);
  buildPageRange(current, totalPages).forEach(p => {
    if (p === '…') {
      const span = document.createElement('span');
      span.className = 'page-info'; span.textContent = '…'; el.appendChild(span);
    } else { add(p, p, false, p === current); }
  });
  add('→', current + 1, current === totalPages);

  const info = document.createElement('span');
  info.className = 'page-info';
  const start = (current - 1) * PAGE_SIZE + 1;
  const end   = Math.min(current * PAGE_SIZE, total);
  info.textContent = `${start}–${end} / ${total}`;
  el.appendChild(info);
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current-1, current+1].filter(p => p>=1 && p<=total));
  const sorted = [...pages].sort((a,b) => a-b);
  const result = []; let prev = 0;
  for (const p of sorted) { if (p - prev > 1) result.push('…'); result.push(p); prev = p; }
  return result;
}

// ════════════════════════════════════════════════════════════
//  HEADER ÉDITABLE
// ════════════════════════════════════════════════════════════

async function loadHeader() {
  const stored   = await dbGet(KEY_HEADER);
  const title    = stored?.title    || 'Projets';
  const subtitle = stored?.subtitle || 'Gestionnaire de tâches — stockage chiffré local';
  applyHeader(title, subtitle);
}

function applyHeader(title, subtitle) {
  const titleEl = document.getElementById('appTitleDisplay');
  const subEl   = document.getElementById('appSubDisplay');
  if (titleEl) titleEl.innerHTML = escHtml(title) + '<span>.</span>';
  if (subEl)   subEl.textContent = subtitle;
  document.title = title;
}

function startEditHeader() {
  const titleEl = document.getElementById('appTitleDisplay');
  const subEl   = document.getElementById('appSubDisplay');
  if (!titleEl || !subEl) return;
  const currentTitle = titleEl.textContent.replace(/\.$/, '').trim();
  const currentSub   = subEl.textContent.trim();

  titleEl.innerHTML = '';
  const titleInput = document.createElement('input');
  titleInput.className   = 'header-input';
  titleInput.value       = currentTitle;
  titleInput.maxLength   = 32;
  titleInput.style.width = Math.max(currentTitle.length, 4) + 'ch';
  titleInput.addEventListener('input', () => {
    titleInput.style.width = Math.max(titleInput.value.length || 4, 4) + 'ch';
  });
  titleEl.appendChild(titleInput);

  const subInput = document.createElement('input');
  subInput.className = 'header-sub-input';
  subInput.value     = currentSub;
  subInput.maxLength = 80;
  subEl.replaceWith(subInput);

  const editBtn = document.querySelector('.header-edit-btn');
  if (editBtn) editBtn.style.display = 'none';

  const btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display:flex;gap:.4rem;margin-top:.5rem;';
  btnWrap.innerHTML = `
    <button class="btn btn-primary btn-sm" id="headerSaveBtn">✓ Valider</button>
    <button class="btn btn-ghost btn-sm" id="headerCancelBtn">Annuler</button>
  `;
  subInput.insertAdjacentElement('afterend', btnWrap);

  document.getElementById('headerSaveBtn').addEventListener('click',
    () => saveHeader(titleInput.value.trim()||'Projets', subInput.value.trim(), btnWrap, titleEl, subInput)
  );
  document.getElementById('headerCancelBtn').addEventListener('click',
    () => cancelEditHeader(currentTitle, currentSub, btnWrap, titleEl, subInput, editBtn)
  );
  titleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  subInput.focus();
    if (e.key === 'Escape') document.getElementById('headerCancelBtn').click();
  });
  subInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  document.getElementById('headerSaveBtn').click();
    if (e.key === 'Escape') document.getElementById('headerCancelBtn').click();
  });
  titleInput.focus(); titleInput.select();
}

async function saveHeader(title, subtitle, btnWrap, titleEl, subInput) {
  await dbSet(KEY_HEADER, { title, subtitle });
  btnWrap.remove();
  const p = document.createElement('p'); p.id = 'appSubDisplay';
  subInput.replaceWith(p);
  applyHeader(title, subtitle);
  const editBtn = document.querySelector('.header-edit-btn');
  if (editBtn) editBtn.style.display = '';
  showToast('✏️ En-tête mis à jour');
}

function cancelEditHeader(title, subtitle, btnWrap, titleEl, subInput, editBtn) {
  btnWrap.remove();
  const p = document.createElement('p'); p.id = 'appSubDisplay';
  subInput.replaceWith(p);
  applyHeader(title, subtitle);
  if (editBtn) editBtn.style.display = '';
}

// ════════════════════════════════════════════════════════════
//  UTILITAIRES
// ════════════════════════════════════════════════════════════

function resetForm() {
  document.getElementById('taskTitle').value     = '';
  document.getElementById('taskRef').value       = '';
  quillModal.setContents([]);
  document.getElementById('deadline').value      = '';
  document.getElementById('taskRequester').value = '';
  document.getElementById('taskType').value      = '';
  setUrgencyPill('low');
  setStatusPill('en-cours');
  setRecurrencePill('none');
  document.querySelectorAll('.day-pill').forEach(p => p.classList.remove('selected'));
  const noEndChk = document.getElementById('recNoEnd');
  if (noEndChk) noEndChk.checked = false;
  updateRecurrencePanel();
}

const escHtml = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/**
 * Détermine si une tâche est « due aujourd'hui ».
 * Deux cas :
 *  1) deadline classique ≤ aujourd'hui
 *  2) tâche récurrente hebdo sans deadline dont aujourd'hui est un des jours cochés
 */
function isTaskDueToday(task) {
  const now = new Date(); now.setHours(0,0,0,0);

  // Cas 1 — deadline classique (parsing local)
  if (task.deadline) {
    const [y,m,d] = task.deadline.split('-');
    return new Date(+y, +m-1, +d) <= now;
  }

  // Cas 2 — récurrence sans deadline
  const rec = task.recurrence;
  if (!rec || rec.type === 'none') return false;

  // Vérifier que la récurrence n'est pas terminée
  if (rec.endDate) {
    const [ey,em,ed] = rec.endDate.split('-');
    if (new Date(+ey, +em-1, +ed) < now) return false;
  }

  const type = rec.type === 'infinite' ? 'weekly' : rec.type;

  if (type === 'weekly') {
    const today = now.getDay(); // 0=Dim … 6=Sam
    // Si des jours spécifiques sont cochés, vérifier si aujourd'hui en fait partie
    if (rec.days && rec.days.length > 0) return rec.days.includes(today);
    // Hebdo sans jours spécifiques → considérer comme due chaque jour
    return true;
  }

  // Mensuel / annuel sans deadline : pas de jour de référence → pas de mise en avant
  return false;
}

function progressPercent(deadline) {
  if (!deadline) return 0;
  return Math.max(0, Math.min(100,
    (1 - (new Date(deadline) - new Date()) / (1000*3600*24) / 30) * 100
  ));
}

function progressColor(p) {
  return p < 50 ? 'var(--low)' : p < 80 ? 'var(--medium)' : 'var(--high)';
}

function deadlineLabel(dateStr) {
  if (!dateStr) return { label:'', cls:'' };
  const now = new Date(); now.setHours(0,0,0,0);
  const [y,m,dd] = dateStr.split('-');
  const d = new Date(+y, +m-1, +dd);
  const dif = Math.round((d - now) / (1000*3600*24));
  if (dif < 0)   return { label:`En retard de ${Math.abs(dif)} j`, cls:'overdue' };
  if (dif === 0) return { label:"Aujourd'hui",                      cls:'overdue' };
  if (dif <= 7)  return { label:`Dans ${dif} j`,                   cls:'soon' };
  return { label: d.toLocaleDateString('fr-FR'), cls:'' };
}

function shake(el) {
  el.style.animation = 'none'; el.getBoundingClientRect();
  el.style.animation = 'shake .3s ease';
  el.style.borderColor = 'var(--high)';
  setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 500);
}

let _toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ════════════════════════════════════════════════════════════
//  IMPORT / EXPORT
// ════════════════════════════════════════════════════════════

async function openAndLinkFile() {
  if (!fsaSupported) { document.getElementById('jsonLoader').click(); return; }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('Format invalide — tableau attendu');
    const writePerm = await handle.requestPermission({ mode: 'readwrite' });
    tasks = data;
    await saveToStorage();
    if (writePerm === 'granted') {
      await dbSet(KEY_FSA, handle); await dbSet(KEY_FSA_NAME, handle.name);
      fileHandle = handle;
      document.getElementById('refileBanner').style.display = 'none';
      updateFsaBtnState();
      showToast(`📂 ${data.length} tâche(s) chargées · sauvegarde auto → ${handle.name}`);
    } else {
      showToast(`📂 ${data.length} tâche(s) importées (lecture seule)`);
    }
    renderTasks(); renderArchives(); renderStats(); updateTabCounts();
    setImportStatus(`✓ ${data.length} tâche(s) chargées`, true);
  } catch (e) {
    if (e.name === 'AbortError') return;
    setImportStatus('✗ ' + (e.message || 'Erreur de lecture'), false);
    showToast('❌ ' + (e.message || 'Fichier invalide'));
  }
}

function importJSON(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error('Format invalide');
      tasks = data;
      await saveToStorage();
      renderTasks(); renderArchives(); renderStats(); updateTabCounts();
      setImportStatus(`✓ ${data.length} tâche(s) importées`, true);
      showToast(`📂 ${data.length} tâche(s) importées`);
    } catch { setImportStatus('✗ JSON invalide', false); }
  };
  reader.readAsText(file);
}

function setImportStatus(msg, ok) {
  const el = document.getElementById('importStatus');
  if (!el) return;
  el.textContent = msg; el.style.color = ok ? 'var(--low)' : 'var(--high)';
  el.style.fontSize = '.75rem'; el.style.fontWeight = '600';
}

function exportJSON() {
  downloadBlob(new Blob([JSON.stringify(tasks, null, 2)], { type:'application/json' }), 'tasks.json');
  showToast('⬇ JSON exporté (non chiffré)');
}

function exportExcel() {
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };
  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const ws = XLSX.utils.json_to_sheet(tasks.map(t => ({
    Référence:   t.customRef    || '',
    Titre:       t.title,
    Demandeur:   t.requester   || '',
    Type:        t.type        || '',
    Urgence:     urgencyLabels[t.urgency] || t.urgency,
    Statut:      statusLabels[t.status]  || t.status,
    Deadline:    t.deadline    || '',
    Récurrence:  t.recurrence ? recurrenceLabel(t.recurrence) : '',
    Commentaire: t.comment ? (new DOMParser().parseFromString(t.comment, 'text/html').body.textContent || '') : '',
    Archivé_le:  t.archivedAt ? new Date(t.archivedAt).toLocaleDateString('fr-FR') : ''
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tâches');
  XLSX.writeFile(wb, 'tasks.xlsx');
  showToast('⬇ Excel exporté');
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href:url, download:name });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Animations ───────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
  @keyframes shake {
    0%,100%{ transform:translateX(0) }
    20%    { transform:translateX(-6px) }
    40%    { transform:translateX(6px) }
    60%    { transform:translateX(-4px) }
    80%    { transform:translateX(4px) }
  }
</style>`);

// ── Mot de passe ─────────────────────────────────────────────
function togglePwd(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; btn.textContent = '👁'; }
}
