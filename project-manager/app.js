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
let activeView   = 'dashboard';   // 'dashboard' | 'tasks' | 'archives' | 'import-export' | 'settings'
let cryptoKey    = null;
let fileHandle   = null;
let fsaSupported = typeof window.showSaveFilePicker === 'function';
let currentPage  = 1;
let itemsPerPage = 12;
let isSubmitting = false; // Protection contre les doubles soumissions

// ════════════════════════════════════════════════════════════
//  DÉMARRAGE
// ════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
  initUI();
  initEventListeners();

  // Hide main content initially
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  if (sidebar) sidebar.style.display = 'none';
  if (mainContent) mainContent.style.display = 'none';

  const hasSavedData = !!localStorage.getItem(STORAGE_KEY);
  if (hasSavedData) {
    showLockScreen('unlock');
  } else {
    showLockScreen('create');
  }
});

function initUI() {
  initUrgencyPills();
  initStatusPills();
  initNavigation();
  initFilterButtons();
}

function initEventListeners() {
  // Modal events
  document.getElementById('btnNewTask')?.addEventListener('click', () => openModal());
  document.getElementById('btnSaveTask')?.addEventListener('click', submitForm);

  // Import/Export events
  document.getElementById('importFile')?.addEventListener('change', importJSON);
  document.getElementById('btnExportJSON')?.addEventListener('click', exportJSON);
  document.getElementById('btnExportExcel')?.addEventListener('click', exportExcel);

  // Settings events
  document.getElementById('btnSetPassword')?.addEventListener('click', () => showLockScreen('create'));
  document.getElementById('btnChangePassword')?.addEventListener('click', changePassword);
  document.getElementById('btnLockApp')?.addEventListener('click', lockApp);
  document.getElementById('btnClearAll')?.addEventListener('click', clearAllTasks);

  // File attachments
  document.getElementById('taskFiles')?.addEventListener('change', handleFileSelection);

  // Search
  document.getElementById('searchInput')?.addEventListener('input', handleSearch);

  // Sort
  document.getElementById('sortSelect')?.addEventListener('change', () => renderTasks());

  // Header buttons
  document.getElementById('btnFsaHeader')?.addEventListener('click', handleFsaHeaderClick);
  document.getElementById('btnHelp')?.addEventListener('click', showHelpModal);
  document.getElementById('btnNotifications')?.addEventListener('click', showNotifications);

  // Dashboard buttons
  document.getElementById('btnRefresh')?.addEventListener('click', () => {
    if (activeView === 'dashboard') renderDashboard();
  });
  document.getElementById('btnFilterDashboard')?.addEventListener('click', () => {
    // Switch to tasks view where filters are available
    switchView('tasks');
  });

  // Recurring task toggle
  document.getElementById('isRecurring')?.addEventListener('change', (e) => {
    document.getElementById('recurringFields').classList.toggle('hidden', !e.target.checked);
  });

  // Mobile menu
  document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleMobileMenu);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeMobileMenu);

  // Global keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeMobileMenu();
    }
    if (e.key === 'Enter' && document.querySelector('#modalOverlay:not(.hidden)')) {
      const lockScreen = document.querySelector('#modalOverlay:not(.hidden)');
      if (lockScreen) submitPassword();
    }
  });
}

// ════════════════════════════════════════════════════════════
//  MOBILE MENU
// ════════════════════════════════════════════════════════════

function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
}

function closeMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  sidebar.classList.add('-translate-x-full');
  overlay.classList.add('hidden');
}

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('href').substring(1);
      switchView(view);
      closeMobileMenu(); // Fermer le menu mobile après navigation
    });
  });
}

// ════════════════════════════════════════════════════════════
//  SIDEBAR COUNTS UPDATE
// ════════════════════════════════════════════════════════════

function updateSidebarCounts() {
  const active = getActiveTasks();
  const archived = getArchivedTasks();

  const taskCountEl = document.getElementById('taskCount');
  const archiveCountEl = document.getElementById('archiveCount');

  if (taskCountEl) taskCountEl.textContent = active.length;
  if (archiveCountEl) archiveCountEl.textContent = archived.length;
}

// ════════════════════════════════════════════════════════════
//  NAVIGATION PAR VUES
// ════════════════════════════════════════════════════════════

function switchView(view) {
  activeView = view;

  // Update navigation active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    item.classList.remove('text-primary', 'font-semibold', 'bg-primary-fixed');
    item.classList.add('text-on-surface-variant');
  });

  const activeNav = document.querySelector(`[href="#${view}"]`);
  if (activeNav) {
    activeNav.classList.add('active', 'text-primary', 'font-semibold', 'bg-primary-fixed');
    activeNav.classList.remove('text-on-surface-variant');
  }

  // Hide all views
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.add('hidden');
  });

  // Show active view
  const viewMap = {
    'dashboard': 'viewDashboard',
    'tasks': 'viewTasks',
    'archives': 'viewArchives',
    'import-export': 'viewImportExport',
    'settings': 'viewSettings'
  };

  const targetView = document.getElementById(viewMap[view]);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // Render appropriate content
  if (view === 'dashboard') renderDashboard();
  else if (view === 'tasks') renderTasks();
  else if (view === 'archives') renderArchives();
}

// ════════════════════════════════════════════════════════════
//  RENDU DASHBOARD
// ════════════════════════════════════════════════════════════

function renderDashboard() {
  const active = getActiveTasks();
  const archived = getArchivedTasks();
  const urgent = active.filter(t => t.urgency === 'high');
  const completed = archived.filter(t => t.status === 'realise');

  // Update statistics cards
  document.getElementById('statTotal').textContent = active.length;
  document.getElementById('statUrgent').textContent = urgent.length;
  document.getElementById('statCompleted').textContent = completed.length;

  // Update summary text
  const summaryEl = document.getElementById('dashboardSummary');
  if (summaryEl) {
    if (active.length === 0) {
      summaryEl.textContent = "Aucune tâche active. Créez votre première tâche !";
    } else {
      const urgentText = urgent.length === 0 ? "aucune urgente" :
                         urgent.length === 1 ? "1 urgente" :
                         `${urgent.length} urgentes`;
      summaryEl.textContent = `${active.length} tâche${active.length > 1 ? 's' : ''} active${active.length > 1 ? 's' : ''}, ${urgentText}`;
    }
  }

  // Update sidebar navigation badges
  document.getElementById('taskCount').textContent = active.length;
  document.getElementById('archiveCount').textContent = archived.length;

  // Render recent tasks (last 6 active tasks)
  const container = document.getElementById('dashboardTasks');
  if (!container) return;

  // Sort by creation date (most recent first) or by last modified date
  const recentTasks = active
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .slice(0, 6);

  container.innerHTML = '';
  if (recentTasks.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <span class="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block">inbox</span>
        <p class="text-on-surface-variant text-lg">Aucune tâche à afficher</p>
        <p class="text-on-surface-variant text-sm mt-2">Cliquez sur "Nouvelle tâche" pour commencer</p>
      </div>
    `;
  } else {
    recentTasks.forEach(task => {
      container.appendChild(buildCard(task, tasks.indexOf(task), false));
    });
  }
}

function initFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPage = 1;
      renderTasks();
    });
  });
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

  const lockBtn = document.getElementById('lockBtn');
  const lockIcon = lockBtn.querySelector('.material-symbols-outlined');
  const lockText = lockBtn.querySelector('span:last-child');

  if (mode === 'create') {
    document.getElementById('lockTitle').textContent = 'Créer un mot de passe';
    document.getElementById('lockSub').textContent   = 'Vos données seront chiffrées (AES-256-GCM). Sans ce mot de passe, elles sont illisibles.';
    document.getElementById('lockConfirmWrap').classList.remove('hidden');
    if (lockIcon) lockIcon.textContent = 'lock_open';
    if (lockText) lockText.textContent = 'Créer & déverrouiller';
  } else {
    document.getElementById('lockTitle').textContent = 'Déverrouiller';
    document.getElementById('lockSub').textContent   = 'Entrez votre mot de passe pour déchiffrer vos données localement.';
    document.getElementById('lockConfirmWrap').classList.add('hidden');
    if (lockIcon) lockIcon.textContent = 'lock_open';
    if (lockText) lockText.textContent = 'Déverrouiller';
  }

  screen.classList.remove('hidden');
  screen.classList.add('flex');
  setTimeout(() => document.getElementById('lockPassword').focus(), 150);

  // Add Enter key support on password fields
  const lockPassword = document.getElementById('lockPassword');
  const lockConfirm = document.getElementById('lockConfirm');

  // Remove any existing listeners to avoid duplicates
  lockPassword.replaceWith(lockPassword.cloneNode(true));
  lockConfirm.replaceWith(lockConfirm.cloneNode(true));

  // Get fresh references after cloning
  const newLockPassword = document.getElementById('lockPassword');
  const newLockConfirm = document.getElementById('lockConfirm');

  // Add Enter key listener to password field
  newLockPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitPassword();
    }
  });

  // Add Enter key listener to confirm field (for create mode)
  newLockConfirm.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitPassword();
    }
  });
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

  btn.disabled = true;
  const btnText = btn.querySelector('span:last-child');
  if (btnText) btnText.textContent = 'Chargement…';

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

    // Hide lock screen
    screen.classList.add('hidden');
    screen.classList.remove('flex');

    // Show main content
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    if (sidebar) sidebar.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'block';

    // Show dashboard
    switchView('dashboard');
    updateFsaBtnState();
    showRefileBannerIfNeeded();

  } catch {
    err.textContent = mode === 'unlock' ? 'Mot de passe incorrect.' : 'Erreur inattendue.';
    cryptoKey = null;
    shake(document.getElementById('lockPassword'));
  } finally {
    btn.disabled = false;
    const btnText = btn.querySelector('span:last-child');
    if (btnText) {
      btnText.textContent = mode === 'create' ? 'Créer & déverrouiller' : 'Déverrouiller';
    }
  }
}

function lockApp() {
  cryptoKey = null;
  tasks = [];

  // Hide main content
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  if (sidebar) sidebar.style.display = 'none';
  if (mainContent) mainContent.style.display = 'none';

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

  // Dédoublonner les tâches par ID
  deduplicateTasks();
}

function deduplicateTasks() {
  const seen = new Map();
  const deduplicated = [];

  for (const task of tasks) {
    if (!seen.has(task.id)) {
      seen.set(task.id, true);
      deduplicated.push(task);
    }
  }

  const duplicatesCount = tasks.length - deduplicated.length;
  if (duplicatesCount > 0) {
    console.log(`🧹 ${duplicatesCount} doublon(s) supprimé(s)`);
    tasks = deduplicated;
  }
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
    const data = {
      tasks: tasks,
      versions: versions,
      exportedAt: new Date().toISOString(),
      format: 'TaskArchitect v4'
    };
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch(e) {
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
      showToast('⚠️ Permission fichier expirée — re-liez le fichier');
      fileHandle = null;
      updateFsaBtnState();
      showRefileBannerIfNeeded();
    }
  }
}

function showRefileBannerIfNeeded() {
  const banner = document.getElementById('refileBanner');
  if (!banner) return;

  const fname = localStorage.getItem('fsa_filename');
  if (fsaSupported && fname && !fileHandle) {
    // Update banner text with filename
    banner.querySelector('p').textContent = `⚠️ Fichier "${fname}" déconnecté — Reliez-le pour continuer la sauvegarde auto`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function updateFsaBtnState() {
  const btn = document.getElementById('fsaBtn');
  const statusDiv = document.getElementById('fsaStatus');
  const fileNameSpan = document.getElementById('fsaFileName');

  if (!btn) return;

  // Get button content elements
  const icon = btn.querySelector('.material-symbols-outlined');
  const text = btn.querySelector('span:last-child');

  if (!fsaSupported) {
    if (icon) icon.textContent = 'warning';
    if (text) text.textContent = 'Non supporté (utilisez Chrome/Edge)';
    btn.disabled = true;
    btn.className = 'w-full px-4 py-3 bg-surface-container text-on-surface-variant rounded-xl font-semibold flex items-center justify-center gap-2 opacity-50 cursor-not-allowed';
    if (statusDiv) statusDiv.classList.add('hidden');
    return;
  }

  if (fileHandle) {
    // Show status
    if (statusDiv) statusDiv.classList.remove('hidden');
    if (fileNameSpan) fileNameSpan.textContent = fileHandle.name;

    // Update button to unlink
    if (icon) icon.textContent = 'link_off';
    if (text) text.textContent = `Délier ${fileHandle.name}`;
    btn.onclick = unlinkFile;
    btn.className = 'w-full px-4 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors';
  } else {
    // Hide status
    if (statusDiv) statusDiv.classList.add('hidden');

    // Update button to link
    if (icon) icon.textContent = 'folder_open';
    if (text) text.textContent = 'Choisir un répertoire et lier le fichier JSON';
    btn.onclick = linkFile;
    btn.className = 'w-full px-4 py-3 bg-primary-gradient text-white rounded-xl font-semibold flex items-center justify-center gap-2';
  }

  // Also update header button
  updateFsaHeaderBtn();
}

function updateFsaHeaderBtn() {
  const headerBtn = document.getElementById('btnFsaHeader');
  if (!headerBtn) return;

  const icon = headerBtn.querySelector('.material-symbols-outlined');

  if (!fsaSupported) {
    if (icon) icon.textContent = 'warning';
    headerBtn.title = 'File System Access non supporté';
    headerBtn.className = 'w-10 h-10 flex items-center justify-center bg-surface-container text-on-surface-variant rounded-xl cursor-not-allowed';
    headerBtn.disabled = true;
  } else if (fileHandle) {
    // Linked state - green/success appearance with filled icon
    if (icon) {
      icon.textContent = 'link';
      icon.style.fontVariationSettings = "'FILL' 1"; // Filled version
    }
    headerBtn.title = `Fichier lié : ${fileHandle.name}`;
    headerBtn.className = 'w-10 h-10 flex items-center justify-center bg-primary-fixed text-primary rounded-xl hover:bg-primary-fixed-dim transition-all';
    headerBtn.disabled = false;
  } else {
    // Not linked - warning appearance
    if (icon) {
      icon.textContent = 'link_off';
      icon.style.fontVariationSettings = "'FILL' 0"; // Outlined version
    }
    headerBtn.title = 'Aucun fichier lié - Cliquez pour lier';
    headerBtn.className = 'w-10 h-10 flex items-center justify-center bg-tertiary-container text-on-tertiary-container rounded-xl hover:bg-tertiary-container/80 transition-all';
    headerBtn.disabled = false;
  }
}

function handleFsaHeaderClick() {
  // Navigate to settings view
  switchView('settings');

  // Scroll to FSA section if needed
  setTimeout(() => {
    const fsaSection = document.getElementById('fsaBtn');
    if (fsaSection) {
      fsaSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

// ════════════════════════════════════════════════════════════
//  MODAL
// ════════════════════════════════════════════════════════════

function openModal(id = null) {
  editingId = id;
  const overlay = document.getElementById('modalOverlay');
  const title   = document.getElementById('modalTitle');
  const btn     = document.getElementById('btnSaveTask');

  // Re-initialize pill event listeners every time modal opens
  initUrgencyPills();
  initStatusPills();

  if (id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('taskTitle').value         = task.title;
    document.getElementById('taskComment').value       = task.comment     || '';
    document.getElementById('taskDeadline').value      = task.deadline    || '';
    document.getElementById('taskRequestDate').value   = task.requestDate || '';
    document.getElementById('taskRequester').value     = task.requester   || '';
    document.getElementById('taskType').value          = task.type        || '';
    document.getElementById('taskOrder').value         = task.order       || '';

    const isRecurring = !!task.recurring;
    document.getElementById('isRecurring').checked = isRecurring;
    const recurringFields = document.getElementById('recurringFields');
    if (isRecurring) {
      recurringFields.classList.remove('hidden');
      document.getElementById('recurringFrequency').value = task.recurring.frequency || 'weekly';
      document.getElementById('recurringInterval').value = task.recurring.interval || 1;
    } else {
      recurringFields.classList.add('hidden');
    }

    // Afficher les fichiers existants
    renderExistingFiles(task.files || []);

    setUrgencyPill(task.urgency || 'low');
    setStatusPill(task.status   || 'en-cours');
    title.innerHTML = 'Modifier la tâche <span class="px-2 py-1 bg-primary-fixed text-on-primary-fixed text-xs rounded-full ml-2">édition</span>';
    btn.textContent = 'Enregistrer';
  } else {
    resetForm();
    // Set default values for new task
    setUrgencyPill('low');
    setStatusPill('en-cours');
    title.textContent = 'Nouvelle tâche';
    btn.textContent   = 'Ajouter la tâche';
  }

  overlay.classList.remove('hidden');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  editingId = null;
  attachedFiles = [];
  const preview = document.getElementById('filePreview');
  if (preview) preview.innerHTML = '';
}
function handleOverlayClick(e) { if (e.target === document.getElementById('modalOverlay')) closeModal(); }

// ════════════════════════════════════════════════════════════
//  PILLS
// ════════════════════════════════════════════════════════════

function initUrgencyPills() {
  document.querySelectorAll('.urgency-pill').forEach(pill =>
    pill.addEventListener('click', () => setUrgencyPill(pill.dataset.urgency))
  );
}

function setUrgencyPill(value) {
  document.querySelectorAll('.urgency-pill').forEach(p => {
    const isSelected = p.dataset.urgency === value;
    p.classList.toggle('active', isSelected);
    // Add/remove Tailwind classes for selected state
    if (isSelected) {
      p.classList.add('bg-primary-gradient', 'text-white', 'shadow-sm');
      p.classList.remove('bg-surface-container', 'text-on-surface-variant');
    } else {
      p.classList.remove('bg-primary-gradient', 'text-white', 'shadow-sm');
      p.classList.add('bg-surface-container', 'text-on-surface-variant');
    }
  });
}

function getSelectedUrgency() {
  return document.querySelector('.urgency-pill.active')?.dataset.urgency || 'low';
}

function initStatusPills() {
  document.querySelectorAll('.status-pill').forEach(pill =>
    pill.addEventListener('click', () => setStatusPill(pill.dataset.status))
  );
}

function setStatusPill(value) {
  document.querySelectorAll('.status-pill').forEach(p => {
    const isSelected = p.dataset.status === value;
    p.classList.toggle('active', isSelected);
    // Add/remove Tailwind classes for selected state
    if (isSelected) {
      p.classList.add('bg-primary-gradient', 'text-white', 'shadow-sm');
      p.classList.remove('bg-surface-container', 'text-on-surface-variant');
    } else {
      p.classList.remove('bg-primary-gradient', 'text-white', 'shadow-sm');
      p.classList.add('bg-surface-container', 'text-on-surface-variant');
    }
  });
}

function getSelectedStatus() {
  return document.querySelector('.status-pill.active')?.dataset.status || 'en-cours';
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
  else if (sort === 'deadline')     list.sort((a,b) => { if (!a.deadline) return 1; if (!b.deadline) return -1; return new Date(a.deadline)-new Date(b.deadline); });
  else if (sort === 'deadline-asc') list.sort((a,b) => { if (!a.deadline) return 1; if (!b.deadline) return -1; return new Date(a.deadline)-new Date(b.deadline); });
  else if (sort === 'urgency')      list.sort((a,b) => ({high:0,medium:1,low:2}[a.urgency]??1)-({high:0,medium:1,low:2}[b.urgency]??1));
  return list;
}

// ════════════════════════════════════════════════════════════
//  CRUD
// ════════════════════════════════════════════════════════════

async function submitForm() {
  // Protection contre les doubles soumissions
  if (isSubmitting) return;
  isSubmitting = true;

  const saveBtn = document.getElementById('btnSaveTask');
  if (saveBtn) saveBtn.disabled = true;

  try {
    const title       = document.getElementById('taskTitle').value.trim();
    const comment     = document.getElementById('taskComment').value.trim();
    const urgency     = getSelectedUrgency();
    const status      = getSelectedStatus();
    const deadline    = document.getElementById('taskDeadline').value;
    const requestDate = document.getElementById('taskRequestDate').value;
    const requester   = document.getElementById('taskRequester').value;
    const type        = document.getElementById('taskType').value;
    const order       = document.getElementById('taskOrder').value.trim() || null;

    const isRecurring = document.getElementById('isRecurring').checked;
    const recurring = isRecurring ? {
      frequency: document.getElementById('recurringFrequency').value,
      interval: parseInt(document.getElementById('recurringInterval').value) || 1
    } : null;

    if (!title) {
      shake(document.getElementById('taskTitle'));
      return;
    }

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
    updateSidebarCounts();

    // Refresh current view
    if (activeView === 'dashboard') {
      renderDashboard();
    } else if (activeView === 'tasks') {
      renderTasks();
    } else if (activeView === 'archives') {
      renderArchives();
    }

    closeModal();

    // Si la tâche vient d'être réalisée, basculer vers archives
    if (status === 'realise' && !wasArchived) {
      showToast('🗄 Tâche archivée — consultez l\'onglet Archives');
    }
  } finally {
    isSubmitting = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function markAsCompleted(id) {
  const now = new Date().toISOString();
  const task = tasks.find(t => t.id === id);

  // Vérifier si la tâche n'est pas déjà archivée (éviter les doublons)
  if (task && task.status === 'realise' && task.archivedAt) {
    showToast('⚠️ Tâche déjà archivée');
    return;
  }

  tasks = tasks.map(t => t.id === id ? { ...t, status: 'realise', updatedAt: now, archivedAt: now } : t);

  // Si tâche récurrente, créer la prochaine occurrence
  if (task && task.recurring) {
    createNextRecurrence(task, task.recurring);
  }

  await saveToStorage();
  updateSidebarCounts();

  // Automatically switch to archives view to show the completed task
  if (activeView === 'tasks' || activeView === 'dashboard') {
    showToast('✅ Tâche marquée comme réalisée et archivée');
    switchView('archives');
  } else {
    // If already in archives, just refresh
    renderArchives();
    showToast('✅ Tâche marquée comme réalisée');
  }
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
  updateSidebarCounts();

  // Refresh current view
  if (activeView === 'dashboard') renderDashboard();
  else if (activeView === 'archives') renderArchives();
  else if (activeView === 'tasks') renderTasks();

  showToast('↩️ Tâche restaurée en cours');
}

function confirmDelete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('confirmTitle').textContent = 'Confirmer la suppression';
  document.getElementById('confirmMsg').textContent   = `Supprimer « ${task.title} » ? Cette action est irréversible.`;
  document.getElementById('confirmOverlay').classList.remove('hidden');
  document.getElementById('confirmYes').onclick = async () => {
    tasks = tasks.filter(t => t.id !== id);
    await saveToStorage();
    updateSidebarCounts();
    if (activeView === 'dashboard') renderDashboard();
    else if (activeView === 'tasks') renderTasks();
    else if (activeView === 'archives') renderArchives();
    closeConfirm();
    showToast('🗑 Tâche supprimée');
  };
}

function closeConfirm() { document.getElementById('confirmOverlay').classList.add('hidden'); }

function clearAllTasks() {
  if (!tasks.length) return;
  document.getElementById('confirmTitle').textContent = 'Effacer toutes les tâches ?';
  document.getElementById('confirmMsg').textContent   = `${tasks.length} tâche(s) seront supprimées définitivement.`;
  document.getElementById('confirmOverlay').classList.add('open');
  document.getElementById('confirmYes').onclick = async () => {
    tasks = [];
    await saveToStorage();
    if (activeView === 'dashboard') renderDashboard();
    else if (activeView === 'tasks') renderTasks();
    else if (activeView === 'archives') renderArchives();
    closeConfirm();
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
  const sort = document.getElementById('sortSelect')?.value || 'date-asc';
  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

  let list = applyFilters(getActiveTasks(), urgFilter, 'all', 'all');

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
        <p>${urgFilter !== 'all' || searchQuery ? 'Aucune tâche pour ces critères.' : 'Commencez par créer votre première tâche.'}</p>
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

function handleSearch() {
  currentPage = 1; // Reset to first page on search

  // Switch to tasks view to show search results
  if (activeView !== 'tasks') {
    switchView('tasks');
  } else {
    renderTasks();
  }
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

  const urgencyColors = {
    low: 'border-secondary-fixed',
    medium: 'border-primary-container',
    high: 'border-tertiary'
  };

  const card = document.createElement('div');
  card.className = `group bg-surface-container-lowest p-6 rounded-xl relative border-l-4 ${urgencyColors[task.urgency || 'low']} shadow-sm hover:shadow-md transition-all duration-300 task-card`;
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

  const urgencyChipBg = {
    low: 'bg-secondary-container text-on-secondary-container',
    medium: 'bg-secondary-container text-on-secondary-container',
    high: 'bg-tertiary-container text-on-tertiary-container'
  };

  const statusChipBg = {
    'en-cours': 'bg-primary-fixed text-on-primary-fixed-variant',
    'en-attente': 'bg-secondary-container text-on-secondary-container',
    'realise': 'bg-primary-fixed text-on-primary-fixed-variant'
  };

  card.innerHTML = `
    <div class="flex justify-between items-start mb-4">
      <div class="flex flex-wrap gap-2">
        <span class="px-3 py-1 ${urgencyChipBg[task.urgency || 'low']} text-[10px] font-bold rounded-full uppercase tracking-tight">
          ${task.urgency === 'low' ? '🌿' : task.urgency === 'medium' ? '⚠️' : '🔥'} ${urgencyLabels[task.urgency]||task.urgency}
        </span>
        ${!isArchive ? `<span class="px-3 py-1 ${statusChipBg[task.status] || 'bg-secondary-container text-on-secondary-container'} text-[10px] font-bold rounded-full uppercase tracking-tight">
          ${statusLabels[task.status]||task.status}
        </span>` : ''}
        ${task.type ? `<span class="px-3 py-1 bg-surface-container text-on-surface-variant text-[10px] font-bold rounded-full uppercase tracking-tight">
          ${escHtml(task.type)}
        </span>` : ''}
        ${recurringText ? `<span class="px-3 py-1 bg-surface-container text-on-surface-variant text-[10px] font-bold rounded-full tracking-tight">
          ${recurringText}
        </span>` : ''}
      </div>
      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onclick="openModal(${task.id})" title="Modifier la tâche" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">edit</span>
        </button>
        ${!isArchive ? `<button onclick="markAsCompleted(${task.id})" title="Marquer comme réalisé" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">check</span>
        </button>` : ''}
        ${isArchive ? `<button onclick="restoreTask(${task.id})" title="Restaurer la tâche" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">restore</span>
        </button>` : ''}
        <button onclick="confirmDelete(${task.id})" title="Supprimer la tâche" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-tertiary transition-colors">
          <span class="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>
    </div>

    <div class="mb-2 flex items-center gap-2">
      <span class="text-xs text-on-surface-variant font-semibold">${escHtml(displayIndex)}</span>
    </div>

    <h4 class="text-lg font-bold text-on-surface mb-2">${escHtml(task.title)}</h4>

    ${task.comment ? `
      <p class="text-sm text-on-surface-variant mb-6 line-clamp-2">${escHtml(task.comment.substring(0, 150))}${task.comment.length > 150 ? '...' : ''}</p>
    ` : ''}

    <div class="flex items-center justify-between mt-auto pt-4 border-t border-surface-container-low">
      <div class="flex items-center gap-4">
        ${task.requester ? `<div class="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span class="material-symbols-outlined text-base">folder</span>
          <span>${escHtml(task.requester)}</span>
        </div>` : ''}
        ${task.files && task.files.length > 0 ? `<div class="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span class="material-symbols-outlined text-base">attach_file</span>
          <span>${task.files.length}</span>
        </div>` : ''}
      </div>
      ${task.deadline && !isArchive ? getDeadlineProgress(task) : ''}
    </div>
  `;
  return card;
}

// ════════════════════════════════════════════════════════════
//  DEADLINE PROGRESS INDICATOR
// ════════════════════════════════════════════════════════════

function getDeadlineProgress(task) {
  if (!task.deadline) return '';

  const now = new Date();
  const deadline = new Date(task.deadline);
  const created = task.createdAt ? new Date(task.createdAt) : new Date(task.id);

  // Calculer le temps total et le temps écoulé
  const totalTime = deadline - created;
  const elapsedTime = now - created;
  const percentage = Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));

  // Calculer les jours restants
  const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

  // Déterminer la couleur selon l'urgence
  let colorClass = 'text-primary';
  let strokeColor = '#006c4a';

  if (daysRemaining < 0) {
    // Dépassé
    colorClass = 'text-error';
    strokeColor = '#ba1a1a';
  } else if (daysRemaining <= 2) {
    // Critique (moins de 2 jours)
    colorClass = 'text-tertiary';
    strokeColor = '#dc362e';
  } else if (percentage > 75) {
    // Attention (plus de 75% du temps écoulé)
    colorClass = 'text-on-tertiary-container';
    strokeColor = '#ff9800';
  }

  // Créer le SVG du cercle de progression
  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const deadlineFormatted = new Date(task.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const daysLabel = Math.abs(daysRemaining) > 1 ? 'jours' : 'jour';
  const statusLabel = daysRemaining < 0 ? 'de retard' : (daysRemaining > 1 ? 'restants' : 'restant');

  return `
    <div class="flex items-center gap-2">
      <div class="relative" style="width: ${size}px; height: ${size}px;" title="Échéance : ${deadlineFormatted} (${Math.abs(daysRemaining)} ${daysLabel} ${statusLabel})">
        <svg class="transform -rotate-90" width="${size}" height="${size}">
          <circle
            cx="${size / 2}"
            cy="${size / 2}"
            r="${radius}"
            stroke="#e0e0e0"
            stroke-width="${strokeWidth}"
            fill="none"
          />
          <circle
            cx="${size / 2}"
            cy="${size / 2}"
            r="${radius}"
            stroke="${strokeColor}"
            stroke-width="${strokeWidth}"
            fill="none"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"
            stroke-linecap="round"
            style="transition: stroke-dashoffset 0.3s ease"
          />
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[10px] font-bold ${colorClass}">${Math.abs(daysRemaining)} j</span>
        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
//  STATS + COMPTEURS ONGLETS
// ════════════════════════════════════════════════════════════

// Removed obsolete functions - replaced by renderDashboard()

// ════════════════════════════════════════════════════════════
//  UTILITAIRES
// ════════════════════════════════════════════════════════════

function resetForm() {
  document.getElementById('taskTitle').value         = '';
  document.getElementById('taskComment').value       = '';
  document.getElementById('taskDeadline').value      = '';
  document.getElementById('taskRequestDate').value   = new Date().toISOString().split('T')[0]; // Date du jour
  document.getElementById('taskRequester').value     = '';
  document.getElementById('taskType').value          = '';
  document.getElementById('taskOrder').value         = '';
  document.getElementById('isRecurring').checked     = false;
  document.getElementById('recurringFields').classList.add('hidden');
  document.getElementById('recurringFrequency').value = 'weekly';
  document.getElementById('recurringInterval').value  = '1';

  const taskFiles = document.getElementById('taskFiles');
  if (taskFiles) taskFiles.value = '';

  const filePreview = document.getElementById('filePreview');
  if (filePreview) filePreview.innerHTML = '';

  const existingFiles = document.getElementById('existingFiles');
  if (existingFiles) existingFiles.innerHTML = '';

  attachedFiles = [];
  setUrgencyPill('low');
  setStatusPill('en-cours');
}

function toggleRecurringFields() {
  const isChecked = document.getElementById('isRecurring').checked;
  const fields = document.getElementById('recurringFields');
  if (fields) {
    fields.classList.toggle('hidden', !isChecked);
  }
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
  if (!container) return;

  if (attachedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '<p class="text-xs text-on-surface-variant font-semibold mb-2">Nouveaux fichiers à joindre :</p>';
  attachedFiles.forEach((file, idx) => {
    const isImage = file.type.startsWith('image/');
    const icon = isImage ? 'image' : file.name.endsWith('.pdf') ? 'picture_as_pdf' : 'attach_file';
    const sizeKB = Math.round(file.size / 1024);

    html += `
      <div class="flex items-center gap-2 bg-primary-fixed/30 border border-primary/20 rounded-xl p-3">
        <span class="material-symbols-outlined text-primary">${icon}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-on-surface truncate">${escHtml(file.name)}</div>
          <div class="text-xs text-on-surface-variant">${sizeKB} Ko</div>
        </div>
        <button onclick="removeAttachedFile(${idx})" title="Retirer" class="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-error transition-colors">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </div>`;
  });

  container.innerHTML = html;
}

function renderExistingFiles(files) {
  const container = document.getElementById('existingFiles');
  if (!container) return;

  if (!files || files.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '<p class="text-xs text-on-surface-variant font-semibold mb-2">Fichiers existants :</p>';
  files.forEach((file, idx) => {
    const isImage = file.type.startsWith('image/');
    const icon = isImage ? 'image' : file.name.endsWith('.pdf') ? 'picture_as_pdf' : 'attach_file';
    const sizeKB = Math.round(file.size / 1024);

    html += `
      <div class="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-xl p-3">
        <span class="material-symbols-outlined text-primary">${icon}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-on-surface truncate">${escHtml(file.name)}</div>
          <div class="text-xs text-on-surface-variant">${sizeKB} Ko</div>
        </div>
        <button onclick="downloadFile('${escHtml(file.name)}', '${file.data}')" title="Télécharger" class="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">download</span>
        </button>
        <button onclick="removeExistingFile(${editingId}, ${idx})" title="Supprimer" class="p-2 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-error transition-colors">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
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
function showHelpModal() {
  const content = `
    <div class="space-y-4">
      <div>
        <h3 class="font-bold text-lg mb-2">🔐 Sécurité</h3>
        <p class="text-sm text-on-surface-variant">Vos données sont chiffrées localement avec AES-256-GCM. Sans votre mot de passe, elles sont illisibles.</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">💾 Sauvegarde automatique</h3>
        <p class="text-sm text-on-surface-variant">Vos tâches sont enregistrées dans le localStorage. Pour une sauvegarde automatique dans un fichier JSON, allez dans Paramètres → Liaison fichier et sélectionnez un répertoire.</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">🔄 Tâches récurrentes</h3>
        <p class="text-sm text-on-surface-variant">Créez des tâches qui se répètent automatiquement (quotidien, hebdomadaire, mensuel, annuel).</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">📎 Pièces jointes</h3>
        <p class="text-sm text-on-surface-variant">Attachez jusqu'à 5 fichiers par tâche (max 5 Mo chacun). Ils sont stockés en base64 dans le localStorage.</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">📊 Export</h3>
        <p class="text-sm text-on-surface-variant">Exportez vos tâches en JSON ou Excel depuis l'onglet Import/Export.</p>
      </div>
    </div>
  `;

  showModal('Aide', content);
}

function showNotifications() {
  // Count urgent and approaching deadline tasks
  const activeTasks = getActiveTasks();
  const urgentTasks = activeTasks.filter(t => t.urgency === 'high');
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  const approachingDeadline = activeTasks.filter(t => {
    if (!t.deadline) return false;
    const deadlineDate = new Date(t.deadline);
    const diff = deadlineDate - now;
    return diff > 0 && diff <= threeDays;
  });

  let notifContent = '';

  if (urgentTasks.length === 0 && approachingDeadline.length === 0) {
    notifContent = '<p class="text-on-surface-variant text-center py-8">Aucune notification pour le moment</p>';
  } else {
    notifContent = '<div class="space-y-4">';

    if (urgentTasks.length > 0) {
      notifContent += `
        <div class="bg-tertiary-container/20 p-4 rounded-xl">
          <h3 class="font-bold text-sm mb-2 flex items-center gap-2">
            <span class="material-symbols-outlined text-tertiary">priority_high</span>
            ${urgentTasks.length} tâche${urgentTasks.length > 1 ? 's' : ''} urgente${urgentTasks.length > 1 ? 's' : ''}
          </h3>
          <ul class="space-y-1 text-sm">
            ${urgentTasks.slice(0, 5).map(t => `<li>• ${t.title}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    if (approachingDeadline.length > 0) {
      notifContent += `
        <div class="bg-secondary-container/20 p-4 rounded-xl">
          <h3 class="font-bold text-sm mb-2 flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary">schedule</span>
            ${approachingDeadline.length} échéance${approachingDeadline.length > 1 ? 's' : ''} dans les 3 jours
          </h3>
          <ul class="space-y-1 text-sm">
            ${approachingDeadline.slice(0, 5).map(t => `<li>• ${t.title} (${new Date(t.deadline).toLocaleDateString('fr-FR')})</li>`).join('')}
          </ul>
        </div>
      `;
    }

    notifContent += '</div>';
  }

  showModal('Notifications', notifContent);
}

function showModal(title, content) {
  // Create a temporary modal for help/notifications
  const existingTempModal = document.getElementById('tempModal');
  if (existingTempModal) existingTempModal.remove();

  const modalHTML = `
    <div id="tempModal" class="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div class="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl p-6" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold font-headline">${title}</h2>
          <button onclick="document.getElementById('tempModal').remove()" class="w-10 h-10 flex items-center justify-center hover:bg-surface-container rounded-lg transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div>${content}</div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Close on overlay click
  document.getElementById('tempModal').addEventListener('click', (e) => {
    if (e.target.id === 'tempModal') {
      document.getElementById('tempModal').remove();
    }
  });
}

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
      updateSidebarCounts();
      if (activeView === 'dashboard') renderDashboard();
      else if (activeView === 'tasks') renderTasks();
      const statusEl = document.getElementById('importStatus');
      if (statusEl) {
        statusEl.className = 'text-sm text-primary';
        statusEl.textContent = `✓ ${data.length} tâche(s) importées`;
      }
      showToast(`📂 ${data.length} tâche(s) importées`);
    } catch {
      const statusEl = document.getElementById('importStatus');
      if (statusEl) {
        statusEl.className = 'text-sm text-error';
        statusEl.textContent = '✗ JSON invalide';
      }
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
  const icon = btn.querySelector('.material-symbols-outlined');
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) icon.textContent = 'visibility_off';
  } else {
    inp.type = 'password';
    if (icon) icon.textContent = 'visibility';
  }
}

// ════════════════════════════════════════════════════════════
//  GESTION DES VERSIONS
// ════════════════════════════════════════════════════════════

function openVersionsModal() {
  document.getElementById('versionsOverlay').classList.remove('hidden');
  renderVersionsList();
}

function closeVersionsModal() {
  document.getElementById('versionsOverlay').classList.add('hidden');
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
