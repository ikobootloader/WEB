// ══════════════════════════════════════════════════════════════
//  GESTIONNAIRE DE PROJETS — app.js
//  Stockage : localStorage + AES-256-GCM (Web Crypto API native)
//  + File System Access API (sauvegarde automatique sur disque)
// ══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'projets_tasks_v4_enc';
const SALT_KEY    = 'projets_salt_v4';
const VERSIONS_KEY = 'projets_versions_v4_enc';
const ITER_COUNT  = 310_000;

// ── État global ──────────────────────────────────────────────
let tasks        = [];
let versions     = {}; // { "SOLIS": "2.4.1", "MULTIGEST": "1.2.0" }
let editingId    = null;
let attachedFiles = []; // Fichiers temporaires avant sauvegarde
let activeFilter = 'all';
let activePage   = 'tasks';   // 'tasks' | 'archives'
let cryptoKey    = null;
let fileHandle   = null;
let fsaSupported = typeof window.showSaveFilePicker === 'function';
let currentPage  = 1;
let itemsPerPage = 12;

// ════════════════════════════════════════════════════════════
//  DÉMARRAGE
// ════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
  initUrgencyPills();
  initStatusPills();
  initFilterTabs();
  document.getElementById('jsonLoader').addEventListener('change', importJSON);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && document.getElementById('lockScreen').classList.contains('open'))
      submitPassword();
  });
  const hasSavedData = !!localStorage.getItem(STORAGE_KEY);
  showLockScreen(hasSavedData ? 'unlock' : 'create');
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
  if (!pwd || pwd.length < 4) { err.textContent = 'Mot de passe trop court (4 min).'; shake(document.getElementById('lockPassword')); return; }
  if (mode === 'create' && pwd !== conf) { err.textContent = 'Les mots de passe ne correspondent pas.'; shake(document.getElementById('lockConfirm')); return; }

  btn.disabled = true; btn.textContent = 'Chargement…';

  try {
    if (mode === 'create') {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      localStorage.setItem(SALT_KEY, bufToHex(salt));
      cryptoKey = await deriveKey(pwd, salt);
      tasks = window.initialTasks || [];
      await saveToStorage();
    } else {
      const saltHex = localStorage.getItem(SALT_KEY);
      if (!saltHex) { err.textContent = 'Données corrompues (sel manquant).'; return; }
      cryptoKey = await deriveKey(pwd, hexToBuf(saltHex));
      await loadFromStorage();
    }

    screen.classList.remove('open');
    document.getElementById('appContent').style.display = 'block';
    renderTasks();
    renderStats();
    updateTabCounts();
    updateFsaBtnState();
    showRefileBannerIfNeeded();

  } catch {
    err.textContent = mode === 'unlock' ? 'Mot de passe incorrect.' : 'Erreur inattendue.';
    cryptoKey = null;
    shake(document.getElementById('lockPassword'));
  } finally {
    btn.disabled = false;
    btn.textContent = mode === 'create' ? 'Créer & déverrouiller' : 'Déverrouiller';
  }
}

function lockApp() {
  cryptoKey = null; tasks = [];
  document.getElementById('appContent').style.display = 'none';
  showLockScreen('unlock');
}

async function changePassword() {
  const newPwd = prompt('Nouveau mot de passe (4 car. min) :');
  if (!newPwd || newPwd.length < 4) { showToast('❌ Trop court'); return; }
  if (prompt('Confirmer :') !== newPwd) { showToast('❌ Ne correspond pas'); return; }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, bufToHex(salt));
  cryptoKey = await deriveKey(newPwd, salt);
  await saveToStorage();
  showToast('🔑 Mot de passe mis à jour');
}

// ════════════════════════════════════════════════════════════
//  CRYPTO — PBKDF2 → AES-256-GCM
// ════════════════════════════════════════════════════════════

async function deriveKey(password, salt) {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER_COUNT, hash: 'SHA-256' },
    raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function encrypt(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(JSON.stringify(data)));
  return bufToHex(iv) + ':' + bufToHex(new Uint8Array(ct));
}

async function decrypt(stored) {
  const [ivHex, ctHex] = stored.split(':');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBuf(ivHex) }, cryptoKey, hexToBuf(ctHex));
  return JSON.parse(new TextDecoder().decode(plain));
}

const bufToHex = b => Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
function hexToBuf(h) { const a = new Uint8Array(h.length/2); for (let i=0;i<a.length;i++) a[i]=parseInt(h.slice(i*2,i*2+2),16); return a; }

// ════════════════════════════════════════════════════════════
//  STOCKAGE
// ════════════════════════════════════════════════════════════

async function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { tasks = []; } else { tasks = await decrypt(raw); }

  const rawVersions = localStorage.getItem(VERSIONS_KEY);
  if (!rawVersions) { versions = {}; } else { versions = await decrypt(rawVersions); }
}

async function saveToStorage() {
  if (!cryptoKey) return;
  localStorage.setItem(STORAGE_KEY, await encrypt(tasks));
  localStorage.setItem(VERSIONS_KEY, await encrypt(versions));
  await writeToFile();
}

// ════════════════════════════════════════════════════════════
//  FILE SYSTEM ACCESS API
// ════════════════════════════════════════════════════════════

async function linkFile() {
  if (!fsaSupported) { showToast('⚠️ Non supporté sur Firefox — utilisez Chrome/Edge'); return; }
  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: 'tasks.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    localStorage.setItem('fsa_filename', fileHandle.name);
    updateFsaBtnState();
    await writeToFile();
    showToast('📁 Fichier lié — sauvegarde automatique activée');
  } catch(e) { if (e.name !== 'AbortError') showToast('❌ ' + e.message); }
}

async function unlinkFile() {
  fileHandle = null;
  localStorage.removeItem('fsa_filename');
  updateFsaBtnState();
  showToast('🔗 Liaison fichier supprimée');
}

async function relinkFile() {
  if (!fsaSupported) return;
  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: localStorage.getItem('fsa_filename') || 'tasks.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    localStorage.setItem('fsa_filename', fileHandle.name);
    document.getElementById('refileBanner').style.display = 'none';
    updateFsaBtnState();
    await writeToFile();
    showToast('✅ Sauvegarde auto réactivée → ' + fileHandle.name);
  } catch(e) { if (e.name !== 'AbortError') showToast('❌ ' + e.message); }
}

async function writeToFile() {
  if (!fileHandle) return;
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(tasks, null, 2));
    await writable.close();
  } catch(e) {
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
      showToast('⚠️ Permission fichier expirée — re-liez le fichier');
      fileHandle = null; updateFsaBtnState();
    }
  }
}

function showRefileBannerIfNeeded() {
  const banner = document.getElementById('refileBanner');
  const fname  = localStorage.getItem('fsa_filename');
  if (fsaSupported && fname && !fileHandle) {
    document.getElementById('refileName').textContent = fname;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function updateFsaBtnState() {
  const btn  = document.getElementById('fsaBtn');
  const info = document.getElementById('fsaInfo');
  if (!btn) return;
  if (!fsaSupported) {
    btn.textContent = '⚠️ Non supporté (Firefox)'; btn.disabled = true;
    if (info) info.textContent = 'Utilisez Chrome/Edge.';
    return;
  }
  if (fileHandle) {
    btn.textContent = '🔗 Délier le fichier'; btn.onclick = unlinkFile; btn.className = 'btn btn-ghost btn-sm';
    if (info) { info.textContent = '✓ Auto → ' + fileHandle.name; info.style.color = 'var(--low)'; }
  } else {
    btn.textContent = '📁 Lier un fichier disque'; btn.onclick = linkFile; btn.className = 'btn btn-outline btn-sm';
    const fname = localStorage.getItem('fsa_filename');
    if (info) { info.textContent = fname ? ('⚠️ ' + fname + ' (re-liez)') : ''; info.style.color = 'var(--medium)'; }
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
    document.getElementById('taskComment').value   = task.comment     || '';
    document.getElementById('deadline').value      = task.deadline    || '';
    document.getElementById('requestDate').value   = task.requestDate || '';
    document.getElementById('taskRequester').value = task.requester   || '';
    document.getElementById('taskType').value      = task.type        || '';
    document.getElementById('taskOrder').value     = task.order       || '';

    const isRecurring = !!task.recurring;
    document.getElementById('isRecurring').checked = isRecurring;
    if (isRecurring) {
      document.getElementById('recurringFields').style.display = 'block';
      document.getElementById('recurringFrequency').value = task.recurring.frequency || 'weekly';
      document.getElementById('recurringInterval').value = task.recurring.interval || 1;
    } else {
      document.getElementById('recurringFields').style.display = 'none';
    }

    // Afficher les fichiers existants
    renderExistingFiles(task.files || []);

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
  attachedFiles = [];
  document.getElementById('filePreview').innerHTML = '';
}
function handleOverlayClick(e) { if (e.target === document.getElementById('modalOverlay')) closeModal(); }

// ════════════════════════════════════════════════════════════
//  PILLS
// ════════════════════════════════════════════════════════════

function initUrgencyPills() {
  document.querySelectorAll('.urgency-pill').forEach(pill =>
    pill.addEventListener('click', () => setUrgencyPill(pill.dataset.value))
  );
}

function setUrgencyPill(value) {
  document.querySelectorAll('.urgency-pill').forEach(p => p.classList.toggle('selected', p.dataset.value === value));
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
  document.querySelectorAll('.status-pill').forEach(p => p.classList.toggle('selected', p.dataset.value === value));
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
      currentPage = 1; // Reset page on filter change
      renderTasks();
    })
  );
}

function getActiveTasks() {
  // Tâches actives = tout sauf "réalisé"
  return tasks.filter(t => t.status !== 'realise');
}

function getArchivedTasks() {
  return tasks.filter(t => t.status === 'realise');
}

function applyFilters(list, urgFilter, reqFilter, typeFilter) {
  if (urgFilter && urgFilter !== 'all') list = list.filter(t => t.urgency === urgFilter);
  if (reqFilter && reqFilter !== 'all') list = list.filter(t => t.requester === reqFilter);
  if (typeFilter && typeFilter !== 'all') list = list.filter(t => t.type === typeFilter);
  return list;
}

function applySort(list, sort) {
  if      (sort === 'order')        list.sort((a,b) => {
    if (!a.order && !b.order) return a.id - b.id;
    if (!a.order) return 1;
    if (!b.order) return -1;
    // Tri alphanumérique naturel (ex: "2026-1" < "2026-10" < "2026-256")
    return a.order.localeCompare(b.order, undefined, {numeric: true, sensitivity: 'base'});
  });
  else if (sort === 'date-asc')     list.sort((a,b) => a.id - b.id);
  else if (sort === 'date-desc')    list.sort((a,b) => b.id - a.id);
  else if (sort === 'request-asc')  list.sort((a,b) => { if (!a.requestDate) return 1; if (!b.requestDate) return -1; return new Date(a.requestDate)-new Date(b.requestDate); });
  else if (sort === 'request-desc') list.sort((a,b) => { if (!a.requestDate) return -1; if (!b.requestDate) return 1; return new Date(b.requestDate)-new Date(a.requestDate); });
  else if (sort === 'deadline-asc') list.sort((a,b) => { if (!a.deadline) return 1; if (!b.deadline) return -1; return new Date(a.deadline)-new Date(b.deadline); });
  else if (sort === 'urgency')      list.sort((a,b) => ({high:0,medium:1,low:2}[a.urgency]??1)-({high:0,medium:1,low:2}[b.urgency]??1));
  return list;
}

// ════════════════════════════════════════════════════════════
//  CRUD
// ════════════════════════════════════════════════════════════

async function submitForm() {
  const title       = document.getElementById('taskTitle').value.trim();
  const comment     = document.getElementById('taskComment').value.trim();
  const urgency     = getSelectedUrgency();
  const status      = getSelectedStatus();
  const deadline    = document.getElementById('deadline').value;
  const requestDate = document.getElementById('requestDate').value;
  const requester   = document.getElementById('taskRequester').value;
  const type        = document.getElementById('taskType').value;
  const order       = document.getElementById('taskOrder').value.trim() || null;

  const isRecurring = document.getElementById('isRecurring').checked;
  const recurring = isRecurring ? {
    frequency: document.getElementById('recurringFrequency').value,
    interval: parseInt(document.getElementById('recurringInterval').value) || 1
  } : null;

  if (!title) { shake(document.getElementById('taskTitle')); return; }

  const wasArchived = editingId && tasks.find(t => t.id === editingId)?.status === 'realise';
  const now = new Date().toISOString();

  if (editingId) {
    const existingTask = tasks.find(t => t.id === editingId);
    const existingFiles = existingTask.files || [];
    tasks = tasks.map(t => t.id === editingId
      ? { ...t, title, comment, urgency, status, deadline, requestDate, requester, type, order, recurring,
          files: [...existingFiles, ...attachedFiles],
          updatedAt: now,
          archivedAt: status === 'realise' ? (t.archivedAt || now) : null }
      : t
    );

    // Si tâche récurrente marquée comme réalisée, créer la prochaine occurrence
    if (status === 'realise' && !wasArchived && recurring) {
      createNextRecurrence(existingTask, recurring);
    }

    showToast('✏️ Tâche modifiée');
  } else {
    tasks.push({
      id: Date.now(), title, comment, urgency, status, deadline, requestDate, requester, type, order, recurring,
      files: attachedFiles,
      createdAt: now,
      updatedAt: now,
      archivedAt: status === 'realise' ? now : null
    });
    showToast('✅ Tâche ajoutée');
  }

  attachedFiles = [];

  await saveToStorage();
  renderTasks();
  if (activePage === 'archives') renderArchives();
  renderStats();
  updateTabCounts();
  closeModal();

  // Si la tâche vient d'être réalisée, basculer vers archives
  if (status === 'realise' && !wasArchived) {
    showToast('🗄 Tâche archivée — consultez l\'onglet Archives');
  }
}

async function markAsCompleted(id) {
  const now = new Date().toISOString();
  const task = tasks.find(t => t.id === id);

  tasks = tasks.map(t => t.id === id ? { ...t, status: 'realise', updatedAt: now, archivedAt: now } : t);

  // Si tâche récurrente, créer la prochaine occurrence
  if (task && task.recurring) {
    createNextRecurrence(task, task.recurring);
  }

  await saveToStorage();
  renderTasks();
  renderArchives();
  renderStats();
  updateTabCounts();
  showToast('✅ Tâche marquée comme réalisée');
}

function createNextRecurrence(task, recurring) {
  if (!recurring) return;

  const now = new Date();
  let nextDate = new Date();

  switch (recurring.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + recurring.interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (7 * recurring.interval));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + recurring.interval);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + recurring.interval);
      break;
  }

  // Calculer la nouvelle deadline si applicable
  let newDeadline = null;
  if (task.deadline) {
    const oldDeadline = new Date(task.deadline);
    const diff = oldDeadline - new Date(task.createdAt || task.id);
    newDeadline = new Date(nextDate.getTime() + diff).toISOString().split('T')[0];
  }

  const newTask = {
    id: Date.now() + Math.random(), // Éviter les collisions
    title: task.title,
    comment: task.comment,
    urgency: task.urgency,
    status: 'en-cours',
    deadline: newDeadline,
    requestDate: nextDate.toISOString().split('T')[0],
    requester: task.requester,
    type: task.type,
    order: task.order,
    recurring: recurring,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null
  };

  tasks.push(newTask);
  showToast('🔄 Prochaine occurrence créée');
}

async function restoreTask(id) {
  const now = new Date().toISOString();
  tasks = tasks.map(t => t.id === id ? { ...t, status: 'en-cours', updatedAt: now, archivedAt: null } : t);
  await saveToStorage();
  renderArchives();
  renderTasks();
  renderStats();
  updateTabCounts();
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

function closeConfirm() { document.getElementById('confirmOverlay').classList.remove('open'); }

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

function renderTasks() {
  const container = document.getElementById('tasks');
  container.innerHTML = '';

  const urgFilter = activeFilter;
  const reqFilter = document.getElementById('filterRequester')?.value || 'all';
  const typeFilter = document.getElementById('filterType')?.value || 'all';
  const sort = document.getElementById('sortSelect')?.value || 'date-asc';
  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

  let list = applyFilters(getActiveTasks(), urgFilter, reqFilter, typeFilter);

  // Appliquer la recherche
  if (searchQuery) {
    list = list.filter(t =>
      t.title.toLowerCase().includes(searchQuery) ||
      (t.comment && t.comment.toLowerCase().includes(searchQuery)) ||
      (t.requester && t.requester.toLowerCase().includes(searchQuery)) ||
      (t.type && t.type.toLowerCase().includes(searchQuery))
    );
  }

  list = applySort(list, sort);

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">📋</div>
        <strong>Aucune tâche ici</strong>
        <p>${urgFilter !== 'all' || reqFilter !== 'all' || typeFilter !== 'all' || searchQuery ? 'Aucune tâche pour ces critères.' : 'Commencez par créer votre première tâche.'}</p>
      </div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  // Pagination
  const totalPages = Math.ceil(list.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = 1;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedList = list.slice(startIdx, endIdx);

  paginatedList.forEach((task, idx) => {
    const globalIdx = startIdx + idx;
    container.appendChild(buildCard(task, globalIdx, false));
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const paginationEl = document.getElementById('pagination');
  if (!paginationEl) return;

  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  let html = `
    <button class="btn btn-ghost btn-sm" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>‹ Précédent</button>
    <span style="font-size:.85rem;color:var(--muted);padding:0 .5rem;">Page ${currentPage} / ${totalPages}</span>
    <button class="btn btn-ghost btn-sm" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Suivant ›</button>
  `;

  paginationEl.innerHTML = html;
}

function goToPage(page) {
  const totalPages = Math.ceil(getActiveTasks().length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTasks();
}

// ════════════════════════════════════════════════════════════
//  RENDU — ARCHIVES
// ════════════════════════════════════════════════════════════

function renderArchives() {
  const container = document.getElementById('archives');
  container.innerHTML = '';

  const reqFilter  = document.getElementById('archiveFilterRequester')?.value || 'all';
  const typeFilter = document.getElementById('archiveFilterType')?.value || 'all';
  const sort       = document.getElementById('archiveSortSelect')?.value || 'date-desc';

  let list = applyFilters(getArchivedTasks(), 'all', reqFilter, typeFilter);

  // Tri archives
  if (sort === 'date-desc') list.sort((a,b) => new Date(b.archivedAt||0) - new Date(a.archivedAt||0));
  else if (sort === 'date-asc') list.sort((a,b) => new Date(a.archivedAt||0) - new Date(b.archivedAt||0));
  else if (sort === 'urgency') list.sort((a,b) => ({high:0,medium:1,low:2}[a.urgency]??1)-({high:0,medium:1,low:2}[b.urgency]??1));

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">🗄</div>
        <strong>Aucune tâche archivée</strong>
        <p>Les tâches marquées "Réalisé" apparaîtront ici.</p>
      </div>`;
    return;
  }

  list.forEach((task, idx) => container.appendChild(buildCard(task, idx, true)));
}

// ════════════════════════════════════════════════════════════
//  CONSTRUCTION D'UNE CARTE
// ════════════════════════════════════════════════════════════

function buildCard(task, idx, isArchive) {
  const p  = progressPercent(task.deadline);

  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };

  const card = document.createElement('div');
  card.className = `task-card ${task.urgency || 'low'}${isArchive ? ' archived' : ''}`;
  card.style.animationDelay = `${idx * 0.04}s`;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // Dates en format compact pour la colonne droite
  const createdDate = task.id ? formatDate(task.id) : '';
  const requestDate = task.requestDate ? formatDate(task.requestDate) : '';
  const updatedDate = task.updatedAt && task.createdAt && task.updatedAt !== task.createdAt ? formatDate(task.updatedAt) : '';
  const archivedDate = isArchive && task.archivedAt ? formatDate(task.archivedAt) : '';

  const recurringFreqLabels = { daily: 'Quotidien', weekly: 'Hebdomadaire', monthly: 'Mensuel', yearly: 'Annuel' };

  const displayIndex = task.order ? `#${task.order}` : `#${String(idx+1).padStart(2,'0')}`;

  const recurringText = task.recurring
    ? `🔄 ${recurringFreqLabels[task.recurring.frequency] || task.recurring.frequency}${task.recurring.interval > 1 ? ` ×${task.recurring.interval}` : ''}`
    : '';

  card.innerHTML = `
    <div class="card-header-row">
      <span class="card-index">${escHtml(displayIndex)}</span>
      ${recurringText ? `<span class="card-recurring">${recurringText}</span>` : ''}
    </div>
    <div class="card-title" title="${escHtml(task.title)}">${escHtml(task.title)}</div>

    <div class="card-row-badges-dates">
      <div class="card-badges">
        <span class="urgency-badge ${task.urgency}">
          ${task.urgency === 'low' ? '🌿' : task.urgency === 'medium' ? '⚠️' : '🔥'} ${urgencyLabels[task.urgency]||task.urgency}
        </span>
        ${!isArchive ? `<span class="status-badge ${task.status}">
          🔵 ${statusLabels[task.status]||task.status}
        </span>` : ''}
        ${task.requester ? `<span class="team-badge">
          ${task.requester === 'S3AD' ? '📋' : task.requester === 'SE2S' ? '🩺' : '👥'} ${escHtml(task.requester)}
        </span>` : ''}
        ${task.type ? `<span class="type-badge">${escHtml(task.type)}</span>` : ''}
      </div>

      <div class="card-dates-column">
        ${createdDate ? `<div class="date-item"><span class="date-label">Créé:</span> <span class="date-value">${createdDate}</span></div>` : ''}
        ${requestDate ? `<div class="date-item"><span class="date-label">Demandé:</span> <span class="date-value">${requestDate}</span></div>` : ''}
        ${updatedDate ? `<div class="date-item"><span class="date-label">Modifié:</span> <span class="date-value">${updatedDate}</span></div>` : ''}
        ${archivedDate ? `<div class="date-item"><span class="date-label">Réalisé:</span> <span class="date-value">${archivedDate}</span></div>` : ''}
      </div>
    </div>

    ${task.comment ? `<div class="card-comment-wrapper">
      <div class="card-comment" data-task-id="${task.id}">${renderMarkdown(task.comment)}</div>
      <div class="comment-actions">
        <button class="see-more-btn" onclick="toggleComment(${task.id})">Voir plus</button>
        ${task.files && task.files.length > 0 ? `<span class="files-indicator">📎 ${task.files.length}</span>` : ''}
      </div>
    </div>` : task.files && task.files.length > 0 ? `<div class="files-only"><span class="files-indicator">📎 ${task.files.length}</span></div>` : ''}

    ${!isArchive && task.deadline ? `
      <div class="deadline-section">
        <div class="deadline-content">
          <span class="deadline-text">📅 Échéance: ${new Date(task.deadline).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit', year: 'numeric'})}</span>
          <div class="progress-circle-container">
            <svg class="progress-ring" width="40" height="40">
              <circle class="progress-ring-circle-bg" cx="20" cy="20" r="16" />
              <circle class="progress-ring-circle" cx="20" cy="20" r="16"
                stroke-dasharray="${2 * Math.PI * 16}"
                stroke-dashoffset="${2 * Math.PI * 16 * (1 - p / 100)}" />
            </svg>
            <span class="progress-text">${Math.round(p)}%</span>
          </div>
        </div>
      </div>` : ''}

    <div class="card-actions">
      <button class="btn btn-ghost btn-sm" onclick="openModal(${task.id})">✏️ Modifier</button>
      ${!isArchive ? `<button class="btn btn-success btn-sm" onclick="markAsCompleted(${task.id})">✅ Réalisé</button>` : ''}
      ${isArchive ? `<button class="btn btn-info btn-sm" onclick="restoreTask(${task.id})">↩️ Restaurer</button>` : ''}
      <button class="btn btn-danger btn-sm" onclick="confirmDelete(${task.id})">🗑 Supprimer</button>
    </div>
  `;
  return card;
}

// ════════════════════════════════════════════════════════════
//  STATS + COMPTEURS ONGLETS
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
//  UTILITAIRES
// ════════════════════════════════════════════════════════════

function resetForm() {
  document.getElementById('taskTitle').value     = '';
  document.getElementById('taskComment').value   = '';
  document.getElementById('deadline').value      = '';
  document.getElementById('requestDate').value   = new Date().toISOString().split('T')[0]; // Date du jour
  document.getElementById('taskRequester').value = '';
  document.getElementById('taskType').value      = '';
  document.getElementById('taskOrder').value     = '';
  document.getElementById('isRecurring').checked = false;
  document.getElementById('recurringFields').style.display = 'none';
  document.getElementById('recurringFrequency').value = 'weekly';
  document.getElementById('recurringInterval').value = '1';
  document.getElementById('taskFiles').value = '';
  document.getElementById('filePreview').innerHTML = '';
  attachedFiles = [];
  setUrgencyPill('low');
  setStatusPill('en-cours');
}

function toggleRecurringFields() {
  const isChecked = document.getElementById('isRecurring').checked;
  document.getElementById('recurringFields').style.display = isChecked ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════════
//  GESTION DES FICHIERS JOINTS
// ════════════════════════════════════════════════════════════

async function handleFileSelection() {
  const input = document.getElementById('taskFiles');
  const files = Array.from(input.files);

  for (const file of files) {
    // Limiter la taille à 5 Mo par fichier
    if (file.size > 5 * 1024 * 1024) {
      showToast(`⚠️ ${file.name} est trop volumineux (max 5 Mo)`);
      continue;
    }

    const base64 = await fileToBase64(file);
    attachedFiles.push({
      name: file.name,
      type: file.type,
      size: file.size,
      data: base64
    });
  }

  renderFilePreview();
  input.value = ''; // Reset input
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderFilePreview() {
  const container = document.getElementById('filePreview');
  if (attachedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  attachedFiles.forEach((file, idx) => {
    const isImage = file.type.startsWith('image/');
    const icon = isImage ? '🖼️' : file.name.endsWith('.pdf') ? '📄' : '📎';
    const sizeKB = Math.round(file.size / 1024);

    html += `
      <div style="display:flex;align-items:center;gap:.5rem;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.5rem;">
        <span style="font-size:1.2rem;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.8rem;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(file.name)}</div>
          <div style="font-size:.7rem;color:var(--muted);">${sizeKB} Ko</div>
        </div>
        <button class="btn btn-danger btn-sm" style="padding:.25rem .5rem;font-size:.7rem;" onclick="removeAttachedFile(${idx})">✕</button>
      </div>`;
  });

  container.innerHTML = html;
}

function renderExistingFiles(files) {
  const container = document.getElementById('filePreview');
  attachedFiles = [];

  if (!files || files.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '<div style="margin-bottom:.5rem;font-size:.75rem;color:var(--muted);font-weight:500;">Fichiers existants :</div>';
  files.forEach((file, idx) => {
    const isImage = file.type.startsWith('image/');
    const icon = isImage ? '🖼️' : file.name.endsWith('.pdf') ? '📄' : '📎';
    const sizeKB = Math.round(file.size / 1024);

    html += `
      <div style="display:flex;align-items:center;gap:.5rem;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:.5rem;">
        <span style="font-size:1.2rem;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.8rem;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(file.name)}</div>
          <div style="font-size:.7rem;color:var(--muted);">${sizeKB} Ko</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="padding:.25rem .5rem;font-size:.7rem;" onclick="downloadFile('${escHtml(file.name)}', '${file.data}')">⬇</button>
        <button class="btn btn-danger btn-sm" style="padding:.25rem .5rem;font-size:.7rem;" onclick="removeExistingFile(${editingId}, ${idx})">✕</button>
      </div>`;
  });

  container.innerHTML = html;
}

function removeAttachedFile(idx) {
  attachedFiles.splice(idx, 1);
  renderFilePreview();
}

async function removeExistingFile(taskId, fileIdx) {
  tasks = tasks.map(t => {
    if (t.id === taskId && t.files) {
      const newFiles = [...t.files];
      newFiles.splice(fileIdx, 1);
      return { ...t, files: newFiles, updatedAt: new Date().toISOString() };
    }
    return t;
  });

  await saveToStorage();
  const task = tasks.find(t => t.id === taskId);
  renderExistingFiles(task.files || []);
  showToast('🗑 Fichier supprimé');
}

function downloadFile(filename, base64Data) {
  const link = document.createElement('a');
  link.href = base64Data;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function renderMarkdown(text) {
  if (!text || typeof marked === 'undefined') return escHtml(text);
  try {
    // Configure marked pour plus de sécurité
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text);
  } catch {
    return escHtml(text);
  }
}

function toggleComment(taskId) {
  const wrapper = document.querySelector(`.card-comment[data-task-id="${taskId}"]`)?.parentElement;
  if (!wrapper) return;

  const btn = wrapper.querySelector('.see-more-btn');

  if (wrapper.classList.contains('expanded')) {
    wrapper.classList.remove('expanded');
    btn.textContent = 'Voir plus';
  } else {
    wrapper.classList.add('expanded');
    btn.textContent = 'Voir moins';
  }
}

function progressPercent(deadline) {
  if (!deadline) return 0;
  return Math.max(0, Math.min(100, (1-(new Date(deadline)-new Date())/(1000*3600*24)/30)*100));
}

function progressColor(p) { return p<50?'var(--low)':p<80?'var(--medium)':'var(--high)'; }

function deadlineLabel(dateStr) {
  if (!dateStr) return { label:'', cls:'' };
  const now = new Date(); now.setHours(0,0,0,0);
  const d   = new Date(dateStr); d.setHours(0,0,0,0);
  const dif = Math.round((d-now)/(1000*3600*24));
  if (dif < 0)   return { label:`Échéance: En retard de ${Math.abs(dif)} j`, cls:'overdue' };
  if (dif === 0) return { label:"Échéance: Aujourd'hui",                      cls:'overdue' };
  if (dif <= 7)  return { label:`Échéance: Dans ${dif} j`,                   cls:'soon' };
  return { label: `Échéance: ${d.toLocaleDateString('fr-FR')}`, cls:'' };
}

function shake(el) {
  el.style.animation = 'none'; el.getBoundingClientRect();
  el.style.animation = 'shake .3s ease'; el.style.borderColor = 'var(--high)';
  setTimeout(() => { el.style.borderColor=''; el.style.animation=''; }, 500);
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

function importJSON(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error();
      tasks = data;
      await saveToStorage();
      renderTasks(); renderStats(); updateTabCounts();
      document.getElementById('importStatus').style.color = 'var(--low)';
      document.getElementById('importStatus').textContent = `✓ ${data.length} tâche(s) importées`;
      showToast(`📂 ${data.length} tâche(s) importées`);
    } catch {
      document.getElementById('importStatus').style.color = 'var(--high)';
      document.getElementById('importStatus').textContent = '✗ JSON invalide';
    }
  };
  reader.readAsText(file);
}

function exportJSON() {
  downloadBlob(new Blob([JSON.stringify(tasks,null,2)],{type:'application/json'}), 'tasks.json');
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
    Archivé_le:  t.archivedAt  ? new Date(t.archivedAt).toLocaleDateString('fr-FR') : ''
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tâches');
  XLSX.writeFile(wb, 'tasks.xlsx');
  showToast('⬇ Excel exporté');
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'),{href:url,download:name});
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Anim shake ──────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend',`<style>
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
</style>`);

// ── Show/hide password ───────────────────────────────────────
function togglePwd(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

// ════════════════════════════════════════════════════════════
//  GESTION DES VERSIONS
// ════════════════════════════════════════════════════════════

function openVersionsModal() {
  document.getElementById('versionsOverlay').classList.add('open');
  renderVersionsList();
}

function closeVersionsModal() {
  document.getElementById('versionsOverlay').classList.remove('open');
  document.getElementById('versionSoftware').value = '';
  document.getElementById('versionNumber').value = '';
}

function handleVersionsOverlayClick(e) {
  if (e.target === document.getElementById('versionsOverlay')) closeVersionsModal();
}

async function addVersion() {
  const software = document.getElementById('versionSoftware').value.trim();
  const number = document.getElementById('versionNumber').value.trim();

  if (!software || !number) {
    showToast('⚠️ Veuillez remplir tous les champs');
    return;
  }

  versions[software] = number;
  await saveToStorage();
  renderVersionsList();
  document.getElementById('versionSoftware').value = '';
  document.getElementById('versionNumber').value = '';
  showToast(`✅ Version ${software} ${number} ajoutée`);
}

async function deleteVersion(software) {
  delete versions[software];
  await saveToStorage();
  renderVersionsList();
  showToast(`🗑 Version ${software} supprimée`);
}

function renderVersionsList() {
  const container = document.getElementById('versionsList');
  if (!container) return;

  const entries = Object.entries(versions);

  if (entries.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--muted);">
        <div style="font-size:2rem;margin-bottom:0.5rem;opacity:0.4;">📦</div>
        <p style="font-size:0.85rem;">Aucune version enregistrée</p>
      </div>`;
    return;
  }

  let html = '<div style="display:grid;gap:0.5rem;">';
  entries.sort((a, b) => a[0].localeCompare(b[0])).forEach(([software, number]) => {
    html += `
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.75rem 1rem;">
        <div>
          <strong style="font-size:0.9rem;color:var(--text)">${escHtml(software)}</strong>
          <span style="margin-left:0.75rem;color:var(--accent);font-family:monospace;font-size:0.85rem;">${escHtml(number)}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteVersion('${escHtml(software)}')">🗑</button>
      </div>`;
  });
  html += '</div>';

  container.innerHTML = html;
}
