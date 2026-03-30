// ══════════════════════════════════════════════════════════════
//  GESTIONNAIRE DE PROJETS — app.js
//  Stockage : IndexedDB + AES-256-GCM (Web Crypto API native)
//  + File System Access API avec handle persistant (IndexedDB)
// ══════════════════════════════════════════════════════════════

const DB_NAME    = 'projets_db';
const DB_VERSION = 1;
const STORE_KV   = 'keyvalue';   // object store clé-valeur générique

const KEY_TASKS    = 'tasks_enc';  // données chiffrées (objet {iv, ct})
const KEY_SALT     = 'salt';       // Uint8Array — sel PBKDF2
const KEY_FSA      = 'fsa_handle'; // FileSystemFileHandle sérialisé par IDB
const KEY_FSA_NAME = 'fsa_name';   // string — nom du fichier lié
const KEY_HEADER   = 'app_header'; // {title, subtitle} — labels header

const ITER_COUNT  = 310_000;
const PAGE_SIZE   = 15;            // tâches par page

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
//  DÉMARRAGE
// ════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', async () => {
  initUrgencyPills();
  initStatusPills();
  initFilterTabs();
  document.getElementById('jsonLoader').addEventListener('change', importJSON);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDetail(); }
    if (e.key === 'Enter' && document.getElementById('lockScreen').classList.contains('open'))
      submitPassword();
  });
  const hasSavedData = !!(await dbGet(KEY_TASKS));
  showLockScreen(hasSavedData ? 'unlock' : 'create');

  // Sur Chrome/Edge, "Importer JSON" est redondant avec "Ouvrir tasks.json"
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

// Réinitialiser la recherche lors d'un changement de filtre urgent via les filter-tabs
// (la query reste active entre les changements de filtre, c'est voulu)

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

    screen.classList.remove('open');
    document.getElementById('appContent').style.display = 'block';
    renderTasks();
    renderStats();
    updateTabCounts();
    await loadHeader();

    // Reconnexion silencieuse au fichier FSA (si handle stocké)
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

// On stocke {iv, ct} en tant qu'ArrayBuffers dans IndexedDB — pas de conversion hex
async function encrypt(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, cryptoKey,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return { iv: iv.buffer, ct };   // ArrayBuffers — IndexedDB les sérialise nativement
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
//  FILE SYSTEM ACCESS API — Handle persistant
// ════════════════════════════════════════════════════════════

/**
 * Tentative de reconnexion automatique au fichier FSA après déverrouillage.
 *
 * Scénarios :
 *  A) Pas de handle stocké → rien à faire.
 *  B) Handle stocké, permission déjà "granted" → reconnexion silencieuse ✓
 *  C) Handle stocké, permission "prompt" → affichage du banner
 *     (l'utilisateur clique "Re-autoriser" → requestPermission, PAS showSaveFilePicker)
 *  D) Handle stocké, permission "denied" ou handle invalide → nettoyage IDB
 */
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
      // Pas besoin d'afficher le banner
      document.getElementById('refileBanner').style.display = 'none';
      return;
    }

    if (perm === 'prompt') {
      // Besoin d'un geste utilisateur : afficher le banner "Re-autoriser"
      const fname = await dbGet(KEY_FSA_NAME);
      if (fname) document.getElementById('refileName').textContent = fname;
      document.getElementById('refileBanner').style.display = 'flex';
      updateFsaBtnState();
      return;
    }

    // perm === 'denied' — nettoyer IDB
    await dbDelete(KEY_FSA);
    await dbDelete(KEY_FSA_NAME);
    updateFsaBtnState();

  } catch {
    // Handle devenu invalide entre deux sessions
    await dbDelete(KEY_FSA);
    await dbDelete(KEY_FSA_NAME);
    updateFsaBtnState();
  }
}

/**
 * Appelé par le banner "Re-autoriser".
 * Utilise requestPermission() sur le handle existant — pas de sélecteur fichier.
 * Fallback vers linkFile() si le handle n'est plus valide.
 */
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
      // L'utilisateur a refusé la permission
      showToast('⚠️ Permission refusée');
      return;
    } catch {
      // Handle invalide → on nettoie et on propose la re-sélection
      await dbDelete(KEY_FSA);
      await dbDelete(KEY_FSA_NAME);
    }
  }

  // Aucun handle valide → sélection d'un nouveau fichier
  await linkFile();
}

/**
 * Sélectionne un nouveau fichier et persiste le handle dans IndexedDB.
 */
async function linkFile() {
  if (!fsaSupported) { showToast('⚠️ Non supporté sur Firefox — utilisez Chrome/Edge'); return; }
  try {
    const fname = await dbGet(KEY_FSA_NAME);
    const handle = await window.showSaveFilePicker({
      suggestedName: fname || 'tasks.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    // Persistance du handle (IDB sérialise nativement les FileSystemHandle)
    await dbSet(KEY_FSA, handle);
    await dbSet(KEY_FSA_NAME, handle.name);
    fileHandle = handle;
    document.getElementById('refileBanner').style.display = 'none';
    updateFsaBtnState();
    await writeToFile();
    showToast('📁 Fichier lié — sauvegarde automatique activée');
  } catch (e) {
    if (e.name !== 'AbortError') showToast('❌ ' + e.message);
  }
}

/**
 * Supprime la liaison fichier (IDB + mémoire).
 */
async function unlinkFile() {
  fileHandle = null;
  await dbDelete(KEY_FSA);
  await dbDelete(KEY_FSA_NAME);
  updateFsaBtnState();
  showToast('🔗 Liaison fichier supprimée');
}

/**
 * Écriture en clair dans le fichier lié.
 */
async function writeToFile() {
  if (!fileHandle) return;
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(tasks, null, 2));
    await writable.close();
  } catch (e) {
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
      showToast('⚠️ Permission expirée — re-autorisez via le banner');
      fileHandle = null;
      updateFsaBtnState();
      // Réafficher le banner
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
    btn.textContent = '⚠️ Non supporté (Firefox)';
    btn.disabled    = true;
    if (info) info.textContent = 'Utilisez Chrome/Edge.';
    return;
  }
  if (fileHandle) {
    btn.textContent = '🔗 Délier le fichier';
    btn.onclick     = unlinkFile;
    btn.className   = 'btn btn-ghost btn-sm';
    if (info) { info.textContent = '✓ Auto → ' + fileHandle.name; info.style.color = 'var(--low)'; }
  } else {
    btn.textContent = '📁 Lier un fichier disque';
    btn.onclick     = linkFile;
    btn.className   = 'btn btn-outline btn-sm';
    dbGet(KEY_FSA_NAME).then(fname => {
      if (!info) return;
      info.textContent = fname ? ('⚠️ ' + fname + ' (re-autorisez)') : '';
      info.style.color = 'var(--medium)';
    });
  }
}

// ════════════════════════════════════════════════════════════
//  MODAL
// ════════════════════════════════════════════════════════════

function openModal(id = null) {
  editingId = id;
  const overlay = document.getElementById('modalOverlay');
  const title   = document.getElementById('modalTitle');
  const btn     = document.getElementById('submitBtn');

  if (id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('taskTitle').value     = task.title;
    document.getElementById('taskComment').value   = task.comment   || '';
    document.getElementById('deadline').value      = task.deadline  || '';
    document.getElementById('taskRequester').value = task.requester || '';
    document.getElementById('taskType').value      = task.type      || '';
    setUrgencyPill(task.urgency || 'low');
    setStatusPill(task.status   || 'en-cours');
    title.innerHTML = 'Modifier la tâche <span class="edit-badge">édition</span>';
    btn.textContent = 'Enregistrer';
  } else {
    resetForm();
    title.textContent = 'Nouvelle tâche';
    btn.textContent   = 'Ajouter la tâche';
  }

  overlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ════════════════════════════════════════════════════════════
//  PILLS
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
  return list.filter(t =>
    (t.title      || '').toLowerCase().includes(q) ||
    (t.comment    || '').toLowerCase().includes(q) ||
    (t.requester  || '').toLowerCase().includes(q) ||
    (t.type       || '').toLowerCase().includes(q)
  );
}

// Debounce pour éviter un rendu à chaque frappe
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

function applySort(list, sort) {
  if      (sort === 'date-asc')     list.sort((a,b) => a.id - b.id);
  else if (sort === 'date-desc')    list.sort((a,b) => b.id - a.id);
  else if (sort === 'deadline-asc') list.sort((a,b) => {
    if (!a.deadline) return 1; if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });
  else if (sort === 'urgency') list.sort((a,b) =>
    ({high:0,medium:1,low:2}[a.urgency]??1) - ({high:0,medium:1,low:2}[b.urgency]??1)
  );
  return list;
}

// ════════════════════════════════════════════════════════════
//  CRUD
// ════════════════════════════════════════════════════════════

async function submitForm() {
  const title     = document.getElementById('taskTitle').value.trim();
  const comment   = document.getElementById('taskComment').value.trim();
  const urgency   = getSelectedUrgency();
  const status    = getSelectedStatus();
  const deadline  = document.getElementById('deadline').value;
  const requester = document.getElementById('taskRequester').value;
  const type      = document.getElementById('taskType').value;

  if (!title) { shake(document.getElementById('taskTitle')); return; }

  const wasArchived = editingId && tasks.find(t => t.id === editingId)?.status === 'realise';

  if (editingId) {
    tasks = tasks.map(t => t.id === editingId
      ? { ...t, title, comment, urgency, status, deadline, requester, type,
          archivedAt: status === 'realise' ? (t.archivedAt || new Date().toISOString()) : null }
      : t
    );
    showToast('✏️ Tâche modifiée');
  } else {
    tasks.push({
      id: Date.now(), title, comment, urgency, status, deadline, requester, type,
      archivedAt: status === 'realise' ? new Date().toISOString() : null
    });
    showToast('✅ Tâche ajoutée');
  }

  await saveToStorage();
  renderTasks();
  if (activePage === 'archives') renderArchives();
  renderStats();
  updateTabCounts();
  closeModal();

  if (status === 'realise' && !wasArchived)
    showToast("🗄 Tâche archivée — consultez l'onglet Archives");
}

async function restoreTask(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, status: 'en-cours', archivedAt: null } : t);
  await saveToStorage();
  renderArchives(); renderTasks(); renderStats(); updateTabCounts();
  showToast('↩️ Tâche restaurée en cours');
}

function confirmDelete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('confirmTitle').textContent = 'Confirmer la suppression';
  document.getElementById('confirmMsg').textContent   = `Supprimer « ${task.title} » ? Cette action est irréversible.`;
  document.getElementById('confirmOverlay').classList.add('open');
  document.getElementById('confirmYes').onclick = async () => {
    tasks = tasks.filter(t => t.id !== id);
    await saveToStorage();
    renderTasks(); renderArchives(); renderStats(); updateTabCounts(); closeConfirm();
    showToast('🗑 Tâche supprimée');
  };
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
}

function clearAllTasks() {
  if (!tasks.length) return;
  document.getElementById('confirmTitle').textContent = 'Effacer toutes les tâches ?';
  document.getElementById('confirmMsg').textContent   = `${tasks.length} tâche(s) seront supprimées définitivement.`;
  document.getElementById('confirmOverlay').classList.add('open');
  document.getElementById('confirmYes').onclick = async () => {
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
  const dc = deadlineLabel(task.deadline);
  const p  = progressPercent(task.deadline);

  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };

  const card = document.createElement('div');
  card.className        = `task-card ${task.urgency || 'low'}${isArchive ? ' archived' : ''}`;
  card.style.animationDelay = `${idx * 0.04}s`;
  // Clic sur la carte hors boutons → modale de détail (ajouté après innerHTML)

  const archivedDateHtml = isArchive && task.archivedAt
    ? `<span class="archive-date-chip">✅ Réalisé le ${new Date(task.archivedAt).toLocaleDateString('fr-FR')}</span>`
    : '';

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
    </div>
    <div class="card-meta-row">
      ${task.deadline ? `<div class="card-deadline-chip ${dc.cls}">📅 ${dc.label}</div>` : ''}
      ${archivedDateHtml}
    </div>
    ${task.comment ? `<p class="card-comment">${escHtml(task.comment)}</p>` : ''}
    ${!isArchive && task.deadline ? `
      <div class="progress-wrap">
        <div class="progress-info"><span>Avancement deadline</span><span>${Math.round(p)}%</span></div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${p}%;background:${progressColor(p)}"></div>
        </div>
      </div>` : ''}
    <div class="card-actions">
      <button class="btn btn-ghost btn-sm" onclick="openModal(${task.id})">✏️ Modifier</button>
      ${isArchive ? `<button class="btn btn-info btn-sm" onclick="restoreTask(${task.id})">↩️ Restaurer</button>` : ''}
      <button class="btn btn-danger btn-sm" onclick="confirmDelete(${task.id})">🗑 Supprimer</button>
    </div>
  `;

  // Clic sur la carte (hors boutons) → modale de détail
  card.addEventListener('click', e => {
    if (!e.target.closest('button')) openDetail(task.id);
  });

  return card;
}

// ════════════════════════════════════════════════════════════
//  MODALE DE DÉTAIL (lecture)
// ════════════════════════════════════════════════════════════

function openDetail(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const isArchive     = task.status === 'realise';
  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };
  const dc = deadlineLabel(task.deadline);
  const p  = progressPercent(task.deadline);

  // Bandeau couleur
  const modal = document.getElementById('detailModal');
  modal.className = `detail-modal ${task.urgency || 'low'}`;

  // Titre
  document.getElementById('detailTitle').textContent = task.title;

  // Badges
  document.getElementById('detailBadges').innerHTML = `
    <span class="urgency-badge ${task.urgency}">${urgencyLabels[task.urgency] || task.urgency}</span>
    <span class="status-badge ${task.status}">${statusLabels[task.status] || task.status}</span>
    ${task.requester ? `<span class="requester-badge">${escHtml(task.requester)}</span>` : ''}
    ${task.type      ? `<span class="type-badge">${escHtml(task.type)}</span>`           : ''}
  `;

  // Grille de champs
  const addedDate = new Date(task.id).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const archivedDate = task.archivedAt
    ? new Date(task.archivedAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
    : null;

  const field = (label, value, empty = false) => `
    <div class="detail-field">
      <span class="df-label">${label}</span>
      <span class="df-value${empty ? ' empty' : ''}">${value}</span>
    </div>`;

  document.getElementById('detailGrid').innerHTML =
    field('Demandeur',     task.requester || '—', !task.requester) +
    field('Type',          task.type      || '—', !task.type) +
    field('Créée le',      addedDate) +
    (task.deadline
      ? field('Deadline', `📅 ${dc.label}`, false)
      : field('Deadline', '—', true)) +
    (archivedDate ? field('Réalisée le', archivedDate) : '');

  // Commentaire
  const commentBlock = document.getElementById('detailCommentBlock');
  commentBlock.innerHTML = task.comment
    ? `<div class="detail-comment-block">
        <span class="df-label">Description</span>
        <p>${escHtml(task.comment)}</p>
       </div>`
    : '';

  // Barre de progression (tâches actives avec deadline seulement)
  const progressBlock = document.getElementById('detailProgressBlock');
  progressBlock.innerHTML = (!isArchive && task.deadline)
    ? `<div class="detail-progress-block">
        <span class="df-label">Avancement deadline</span>
        <div class="detail-progress-info">
          <span>${dc.label}</span><span>${Math.round(p)} %</span>
        </div>
        <div class="detail-progress-bar">
          <div class="detail-progress-fill" style="width:${p}%;background:${progressColor(p)}"></div>
        </div>
       </div>`
    : '';

  // Footer — boutons d'action
  document.getElementById('detailFooter').innerHTML = `
    ${isArchive
      ? `<button class="btn btn-info btn-sm" onclick="restoreTask(${task.id});closeDetail()">↩️ Restaurer</button>`
      : ''}
    <button class="btn btn-danger btn-sm" onclick="confirmDelete(${task.id});closeDetail()">🗑 Supprimer</button>
    <button class="btn btn-primary btn-sm" onclick="closeDetail();openModal(${task.id})">✏️ Modifier</button>
  `;

  document.getElementById('detailOverlay').classList.add('open');
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('open');
}

function handleDetailOverlayClick(e) {
  if (e.target === document.getElementById('detailOverlay')) closeDetail();
}



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

/**
 * Génère les boutons de pagination dans le conteneur ciblé.
 * @param {string} containerId  - id du div .pagination
 * @param {number} total        - nb total d'éléments filtrés
 * @param {number} current      - page courante (1-based)
 * @param {function} onPage     - callback(newPage)
 */
function renderPagination(containerId, total, current, onPage) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (totalPages <= 1) {
    el.innerHTML = '';
    el.classList.add('hidden');
    return;
  }

  el.classList.remove('hidden');
  el.innerHTML = '';

  const add = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.textContent = label;
    btn.disabled = disabled;
    if (!disabled && !active) btn.addEventListener('click', () => onPage(page));
    el.appendChild(btn);
  };

  // ← Précédent
  add('←', current - 1, current === 1);

  // Numéros de pages avec ellipses
  const pages = buildPageRange(current, totalPages);
  pages.forEach(p => {
    if (p === '…') {
      const span = document.createElement('span');
      span.className = 'page-info';
      span.textContent = '…';
      el.appendChild(span);
    } else {
      add(p, p, false, p === current);
    }
  });

  // → Suivant
  add('→', current + 1, current === totalPages);

  // Info texte
  const info = document.createElement('span');
  info.className = 'page-info';
  const start = (current - 1) * PAGE_SIZE + 1;
  const end   = Math.min(current * PAGE_SIZE, total);
  info.textContent = `${start}–${end} / ${total}`;
  el.appendChild(info);
}

/**
 * Construit la liste des numéros à afficher avec ellipses.
 * Ex : [1, 2, 3, …, 10] ou [1, …, 4, 5, 6, …, 10]
 */
function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1].filter(p => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
}

// ════════════════════════════════════════════════════════════
//  HEADER ÉDITABLE
// ════════════════════════════════════════════════════════════

async function loadHeader() {
  const stored = await dbGet(KEY_HEADER);
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

  // Récupérer les valeurs actuelles (sans le ".")
  const currentTitle = titleEl.textContent.replace(/\.$/, '').trim();
  const currentSub   = subEl.textContent.trim();

  // Remplacer h1 par un input
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

  // Remplacer <p> par un input
  const subInput = document.createElement('input');
  subInput.className = 'header-sub-input';
  subInput.value     = currentSub;
  subInput.maxLength = 80;
  subEl.replaceWith(subInput);

  // Masquer le bouton crayon
  const editBtn = document.querySelector('.header-edit-btn');
  if (editBtn) editBtn.style.display = 'none';

  // Boutons Valider / Annuler
  const btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display:flex;gap:.4rem;margin-top:.5rem;';
  btnWrap.innerHTML = `
    <button class="btn btn-primary btn-sm" id="headerSaveBtn">✓ Valider</button>
    <button class="btn btn-ghost btn-sm" id="headerCancelBtn">Annuler</button>
  `;
  subInput.insertAdjacentElement('afterend', btnWrap);

  document.getElementById('headerSaveBtn').addEventListener('click',
    () => saveHeader(titleInput.value.trim() || 'Projets', subInput.value.trim(), btnWrap, titleEl, subInput)
  );
  document.getElementById('headerCancelBtn').addEventListener('click',
    () => cancelEditHeader(currentTitle, currentSub, btnWrap, titleEl, subInput, editBtn)
  );

  // Entrée sur le titre → focus sous-titre
  titleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') subInput.focus();
    if (e.key === 'Escape') document.getElementById('headerCancelBtn').click();
  });
  subInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('headerSaveBtn').click();
    if (e.key === 'Escape') document.getElementById('headerCancelBtn').click();
  });

  titleInput.focus();
  titleInput.select();
}

async function saveHeader(title, subtitle, btnWrap, titleEl, subInput) {
  await dbSet(KEY_HEADER, { title, subtitle });
  btnWrap.remove();
  // Restaurer le <p> sous-titre
  const p = document.createElement('p');
  p.id = 'appSubDisplay';
  subInput.replaceWith(p);
  applyHeader(title, subtitle);
  // Réafficher le bouton crayon
  const editBtn = document.querySelector('.header-edit-btn');
  if (editBtn) editBtn.style.display = '';
  showToast('✏️ En-tête mis à jour');
}

function cancelEditHeader(title, subtitle, btnWrap, titleEl, subInput, editBtn) {
  btnWrap.remove();
  const p = document.createElement('p');
  p.id = 'appSubDisplay';
  subInput.replaceWith(p);
  applyHeader(title, subtitle);
  if (editBtn) editBtn.style.display = '';
}

// ════════════════════════════════════════════════════════════
//  UTILITAIRES
// ════════════════════════════════════════════════════════════

function resetForm() {
  document.getElementById('taskTitle').value     = '';
  document.getElementById('taskComment').value   = '';
  document.getElementById('deadline').value      = '';
  document.getElementById('taskRequester').value = '';
  document.getElementById('taskType').value      = '';
  setUrgencyPill('low');
  setStatusPill('en-cours');
}

const escHtml = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function progressPercent(deadline) {
  if (!deadline) return 0;
  return Math.max(0, Math.min(100,
    (1 - (new Date(deadline) - new Date()) / (1000 * 3600 * 24) / 30) * 100
  ));
}

function progressColor(p) {
  return p < 50 ? 'var(--low)' : p < 80 ? 'var(--medium)' : 'var(--high)';
}

function deadlineLabel(dateStr) {
  if (!dateStr) return { label:'', cls:'' };
  const now = new Date(); now.setHours(0,0,0,0);
  const d   = new Date(dateStr); d.setHours(0,0,0,0);
  const dif = Math.round((d - now) / (1000 * 3600 * 24));
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

/**
 * Ouvre un tasks.json via showOpenFilePicker (FSA) :
 *  - lit et importe les tâches
 *  - persiste le handle comme cible de sauvegarde automatique
 *  - met à jour l'UI en conséquence
 * Utilisé par le bouton "📂 Ouvrir tasks.json".
 */
async function openAndLinkFile() {
  if (!fsaSupported) {
    // Fallback : input file classique (Firefox)
    document.getElementById('jsonLoader').click();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });

    // Lire le contenu
    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('Format invalide — tableau attendu');

    // Demander la permission en écriture pour pouvoir sauvegarder vers ce fichier
    const writePerm = await handle.requestPermission({ mode: 'readwrite' });

    tasks = data;
    await saveToStorage();   // chiffre dans IDB + écrit dans le fichier si permission ok

    // Persister le handle comme cible FSA
    if (writePerm === 'granted') {
      await dbSet(KEY_FSA, handle);
      await dbSet(KEY_FSA_NAME, handle.name);
      fileHandle = handle;
      document.getElementById('refileBanner').style.display = 'none';
      updateFsaBtnState();
      showToast(`📂 ${data.length} tâche(s) chargées · sauvegarde auto → ${handle.name}`);
    } else {
      // Lecture réussie mais pas d'écriture : on importe sans lier
      showToast(`📂 ${data.length} tâche(s) importées (lecture seule — liaison non activée)`);
    }

    renderTasks(); renderArchives(); renderStats(); updateTabCounts();
    setImportStatus(`✓ ${data.length} tâche(s) chargées`, true);

  } catch (e) {
    if (e.name === 'AbortError') return;
    setImportStatus('✗ ' + (e.message || 'Erreur de lecture'), false);
    showToast('❌ ' + (e.message || 'Fichier invalide'));
  }
}

/**
 * Import classique via <input type="file"> (fallback ou usage manuel).
 * Ne touche pas au handle FSA existant.
 */
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
    } catch {
      setImportStatus('✗ JSON invalide', false);
    }
  };
  reader.readAsText(file);
}

function setImportStatus(msg, ok) {
  const el = document.getElementById('importStatus');
  if (!el) return;
  el.textContent  = msg;
  el.style.color  = ok ? 'var(--low)' : 'var(--high)';
  el.style.fontSize = '.75rem';
  el.style.fontWeight = '600';
}

function exportJSON() {
  downloadBlob(
    new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' }),
    'tasks.json'
  );
  showToast('⬇ JSON exporté (non chiffré)');
}

function exportExcel() {
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };
  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const ws = XLSX.utils.json_to_sheet(tasks.map(t => ({
    Titre:       t.title,
    Demandeur:   t.requester   || '',
    Type:        t.type        || '',
    Urgence:     urgencyLabels[t.urgency] || t.urgency,
    Statut:      statusLabels[t.status]  || t.status,
    Deadline:    t.deadline    || '',
    Commentaire: t.comment     || '',
    Archivé_le:  t.archivedAt ? new Date(t.archivedAt).toLocaleDateString('fr-FR') : ''
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tâches');
  XLSX.writeFile(wb, 'tasks.xlsx');
  showToast('⬇ Excel exporté');
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Animation shake ─────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
  @keyframes shake {
    0%,100%{ transform:translateX(0)  }
    20%    { transform:translateX(-6px) }
    40%    { transform:translateX(6px)  }
    60%    { transform:translateX(-4px) }
    80%    { transform:translateX(4px)  }
  }
</style>`);

// ── Affichage / masquage mot de passe ────────────────────────
function togglePwd(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; btn.textContent = '👁'; }
}
