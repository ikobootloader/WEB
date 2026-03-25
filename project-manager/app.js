// ══════════════════════════════════════════════════════════════
//  GESTIONNAIRE DE PROJETS — app.js
//  Stockage : IndexedDB + AES-256-GCM (Web Crypto API native)
//  + File System Access API (sauvegarde automatique sur disque)
// ══════════════════════════════════════════════════════════════

// IndexedDB Configuration
const DB_NAME = 'TaskMDA_DB';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted_data';

// Legacy keys for migration from localStorage
const LEGACY_STORAGE_KEY = 'projets_tasks_v4_enc';
const LEGACY_SALT_KEY    = 'projets_salt_v4';
const LEGACY_VERSIONS_KEY = 'projets_versions_v4_enc';
const LEGACY_PROJECTS_KEY = 'projets_projects_v4_enc';
const LEGACY_CONFIG_KEY = 'projets_config_v4_enc';

const ITER_COUNT  = 310_000;

// ── État global ──────────────────────────────────────────────
let tasks        = [];
let versions     = {}; // { "SOLIS": "2.4.1", "MULTIGEST": "1.2.0" }
let projects     = []; // Liste des projets avec timeline Gantt
let config       = {   // Configuration personnalisée
  requesters: [        // Liste des demandeurs avec emails
    { name: 'S3AD', email: '' },
    { name: 'SE2S', email: '' },
    { name: 'MDA', email: '' },
    { name: 'PSS', email: '' },
    { name: 'ASG', email: '' },
    { name: 'Autres', email: '' }
  ],
  types: ['SOLIS', 'MULTIGEST', 'BO', 'Courriers', 'Autres'],  // Liste des types de demande
  emailTemplates: {    // Templates d'emails personnalisables
    completion: {
      subject: 'Tache realisee : {{TITLE}}',
      body: `Bonjour,

Nous vous informons que la tache suivante a ete realisee :

========================================
TITRE
{{TITLE}}

{{DESCRIPTION}}INFORMATIONS
- Date de demande : {{REQUEST_DATE}}
- Date d'echeance : {{DEADLINE}}
- Date de realisation : {{COMPLETION_DATE}}
- Urgence : {{URGENCY}}
{{TYPE}}{{ORDER}}========================================

Cordialement,
TaskMDA - Gestion de taches`
    },
    inquiry: {
      subject: 'Demande d\'informations : {{TITLE}}',
      body: `Bonjour,

Nous revenons vers vous concernant la tache suivante et aurions besoin de precisions supplementaires :

========================================
TITRE
{{TITLE}}

{{DESCRIPTION}}INFORMATIONS
- Statut : {{STATUS}}
- Date de demande : {{REQUEST_DATE}}
- Date d'echeance : {{DEADLINE}}
- Urgence : {{URGENCY}}
{{TYPE}}{{ORDER}}========================================

Pourriez-vous nous apporter les informations suivantes :

[Votre message ici]


Cordialement,
TaskMDA - Gestion de taches`
    }
  },
  appearance: {       // Préférences d'apparence
    darkMode: false,
    highContrast: false
  }
};
let editingId    = null;
let editingProjectId = null;
let attachedFiles = []; // Fichiers temporaires avant sauvegarde
let activeFilter = 'all';
let activeView   = 'dashboard';   // 'dashboard' | 'tasks' | 'projects' | 'archives' | 'import-export' | 'settings'
let taskViewMode = 3; // 1 (détaillé) | 2 | 3 (défaut) | 4 (compact)
let cryptoKey    = null;
let currentPage  = 1;
let itemsPerPage = 12;
let isSubmitting = false; // Protection contre les doubles soumissions
let ganttViewMode = 'month'; // 'month' | 'weeks'

// ════════════════════════════════════════════════════════════
//  DÉMARRAGE
// ════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', async () => {
  initUI();
  initEventListeners();

  // Hide main content initially
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  if (sidebar) sidebar.style.display = 'none';
  if (mainContent) mainContent.style.display = 'none';

  // Initialize IndexedDB
  await initDB();

  // Migrate from localStorage if needed
  await migrateFromLocalStorage();

  // Check if data exists in IndexedDB
  const hasSavedData = !!(await idbGet('salt'));
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
  initViewButtons();
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

  // Appearance events
  document.getElementById('darkModeToggle')?.addEventListener('change', toggleDarkMode);
  document.getElementById('highContrastToggle')?.addEventListener('change', toggleHighContrast);

  // File attachments
  document.getElementById('taskFiles')?.addEventListener('change', handleFileSelection);

  // Search - listen to multiple events to catch all cases
  const searchInput = document.getElementById('searchInput');
  searchInput?.addEventListener('input', handleSearch);
  searchInput?.addEventListener('keyup', handleSearch);
  searchInput?.addEventListener('search', handleSearch); // For when clearing with X button

  // Sort
  document.getElementById('sortSelect')?.addEventListener('change', () => renderTasks());

  // Header buttons
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

  // Recurring frequency change - show/hide specific fields
  document.getElementById('recurringFrequency')?.addEventListener('change', updateRecurringFields);

  // Recurring infinite toggle
  document.getElementById('recurringInfinite')?.addEventListener('change', (e) => {
    const endField = document.getElementById('recurringEndField');
    if (endField) {
      endField.classList.toggle('hidden', e.target.checked);
      if (e.target.checked) {
        document.getElementById('recurringEndDate').value = '';
      }
    }
  });

  // Mobile menu
  document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleMobileMenu);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeMobileMenu);

  // Projects events
  document.getElementById('btnNewProject')?.addEventListener('click', () => openProjectModal());
  document.getElementById('btnSaveProject')?.addEventListener('click', submitProjectForm);
  document.getElementById('btnArchiveProject')?.addEventListener('click', archiveProject);
  document.getElementById('viewMonth')?.addEventListener('click', () => setGanttViewMode('month'));
  document.getElementById('viewWeeks')?.addEventListener('click', () => setGanttViewMode('weeks'));
  document.getElementById('projectProgress')?.addEventListener('input', updateProjectProgressBar);

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

  updateProjectCount();
  updateNotificationBadge();
}

function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  if (!badge) return;

  // Count urgent tasks and approaching deadlines
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

  const totalNotifications = urgentTasks.length + approachingDeadline.length;

  if (totalNotifications > 0) {
    badge.textContent = totalNotifications > 9 ? '9+' : totalNotifications;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
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
    'projects': 'viewProjects',
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
  else if (view === 'projects') renderGanttChart();
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

  // Update tasks statistics cards
  document.getElementById('statTotal').textContent = active.length;
  document.getElementById('statUrgent').textContent = urgent.length;
  document.getElementById('statCompleted').textContent = completed.length;

  // Update projects statistics cards
  const activeProjectsList = getActiveProjects();
  const activeProjects = activeProjectsList.filter(p => p.status !== 'termine');
  const urgentProjects = activeProjectsList.filter(p => p.status === 'urgent');
  const completedProjects = activeProjectsList.filter(p => p.status === 'termine');

  document.getElementById('statProjectsActive').textContent = activeProjects.length;
  document.getElementById('statProjectsUrgent').textContent = urgentProjects.length;
  document.getElementById('statProjectsCompleted').textContent = completedProjects.length;

  // Update summary text with tasks and projects
  const summaryEl = document.getElementById('dashboardSummary');
  if (summaryEl) {
    const activeProjects = getActiveProjects().filter(p => p.status !== 'termine');
    const urgentProjects = getActiveProjects().filter(p => p.status === 'urgent');

    if (active.length === 0 && activeProjects.length === 0) {
      summaryEl.textContent = "Aucune tâche ni projet actif. Commencez dès maintenant !";
    } else {
      let summary = '';

      // Tasks summary
      if (active.length > 0) {
        const urgentText = urgent.length === 0 ? "aucune urgente" :
                           urgent.length === 1 ? "1 urgente" :
                           `${urgent.length} urgentes`;
        summary = `${active.length} tâche${active.length > 1 ? 's' : ''} active${active.length > 1 ? 's' : ''}, ${urgentText}`;
      }

      // Projects summary
      if (activeProjects.length > 0) {
        if (summary) summary += ' • ';
        const projectUrgentText = urgentProjects.length > 0
          ? `, ${urgentProjects.length} urgent${urgentProjects.length > 1 ? 's' : ''}`
          : '';
        summary += `${activeProjects.length} projet${activeProjects.length > 1 ? 's' : ''} en cours${projectUrgentText}`;
      }

      summaryEl.textContent = summary;
    }
  }

  // Update sidebar navigation badges
  document.getElementById('taskCount').textContent = active.length;
  // Archive count is updated by updateProjectCount to include both tasks and projects
  updateProjectCount();

  // Render active projects (max 3)
  const projectsContainer = document.getElementById('dashboardProjects');
  if (projectsContainer) {
    const activeProjects = getActiveProjects().filter(p => p.status !== 'termine').slice(0, 3);

    if (activeProjects.length === 0) {
      projectsContainer.innerHTML = `
        <div class="col-span-full text-center py-8">
          <span class="material-symbols-outlined text-5xl text-on-surface-variant mb-2 block opacity-40">folder_open</span>
          <p class="text-on-surface-variant text-sm">Aucun projet actif</p>
        </div>
      `;
    } else {
      projectsContainer.innerHTML = '';
      activeProjects.forEach(project => {
        const statusColors = {
          'en-cours': { bg: '#006c4a', label: 'EN COURS', dot: '#006c4a' },
          'planifie': { bg: '#6366f1', label: 'PLANIFIÉ', dot: '#6366f1' },
          'urgent': { bg: '#ef4444', label: 'URGENT', dot: '#ef4444' }
        };
        const color = statusColors[project.status] || statusColors['en-cours'];

        const endDate = new Date(project.endDate);
        const today = new Date();
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        const card = document.createElement('div');
        card.className = 'bg-surface-container-low rounded-xl p-4 border-l-4 hover:shadow-md transition-all cursor-pointer group relative';
        card.style.borderColor = color.bg;
        card.onclick = (e) => {
          // Prevent navigation if clicking on action buttons
          if (e.target.closest('.action-btn')) return;
          switchView('projects');
        };

        card.innerHTML = `
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 pr-20">
              <h4 class="font-bold text-on-surface mb-1">${escHtml(project.name)}</h4>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="w-2 h-2 rounded-full" style="background-color: ${color.dot}"></span>
                <span class="text-[11px] font-semibold uppercase tracking-tight" style="color: ${color.dot}">${color.label}</span>
                ${(project.requesters || (project.requester ? [project.requester] : [])).map(req =>
                  `<span class="text-[10px] px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant">${escHtml(req)}</span>`
                ).join('')}
              </div>
            </div>

            <!-- Action buttons on hover -->
            <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
              <button onclick="event.stopPropagation(); openProjectModal(${project.id})" title="Modifier le projet" class="action-btn p-1.5 hover:bg-surface-container rounded-lg transition-colors">
                <span class="material-symbols-outlined text-sm text-on-surface-variant">edit</span>
              </button>
              <button onclick="event.stopPropagation(); quickArchiveProject(${project.id})" title="Archiver le projet" class="action-btn p-1.5 hover:bg-surface-container rounded-lg transition-colors">
                <span class="material-symbols-outlined text-sm text-on-surface-variant">archive</span>
              </button>
              <button onclick="event.stopPropagation(); deleteProject(${project.id})" title="Supprimer le projet" class="action-btn p-1.5 hover:bg-error-container rounded-lg transition-colors">
                <span class="material-symbols-outlined text-sm text-error">delete</span>
              </button>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-on-surface-variant">Progression</span>
              <span class="font-bold text-on-surface">${project.progress}%</span>
            </div>
            <div class="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all" style="width: ${project.progress}%; background-color: ${color.bg}"></div>
            </div>
            <div class="text-xs ${daysRemaining > 0 ? 'text-on-surface-variant' : 'text-error'} font-medium">
              ${daysRemaining > 0 ? `${daysRemaining} jours restants` : `Échéance dépassée`}
            </div>
          </div>
        `;

        projectsContainer.appendChild(card);
      });
    }
  }

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

  // Check if backup reminder should be shown
  checkBackupReminder();
}

async function checkBackupReminder() {
  const banner = document.getElementById('backupReminderBanner');
  if (!banner) return;

  const lastDismissed = await idbGet('backupReminderDismissed');

  if (lastDismissed) {
    const dismissedDate = new Date(lastDismissed);
    const now = new Date();
    const daysSinceDismissed = Math.floor((now - dismissedDate) / (1000 * 60 * 60 * 24));

    // Show again after 7 days
    if (daysSinceDismissed < 7) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'flex';
    }
  } else {
    // First time - show the banner
    banner.style.display = 'flex';
  }
}

async function dismissBackupReminder() {
  const banner = document.getElementById('backupReminderBanner');
  if (banner) {
    banner.style.display = 'none';
    // Save dismissal date
    await idbSet('backupReminderDismissed', new Date().toISOString());
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

function initViewButtons() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      taskViewMode = parseInt(btn.dataset.view);
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Mettre à jour les classes de grille pour tous les conteneurs de tâches
      const gridClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 xl:grid-cols-2',
        3: 'grid-cols-1 xl:grid-cols-3',
        4: 'grid-cols-1 xl:grid-cols-4'
      };

      ['tasks', 'dashboardTasks', 'archives'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
          // Retirer toutes les anciennes classes de grille
          container.className = container.className.replace(/grid-cols-\d+/g, '').replace(/xl:grid-cols-\d+/g, '').trim();
          // Ajouter les nouvelles classes
          container.className = `grid ${gridClasses[taskViewMode]} gap-6${containerId === 'dashboardTasks' ? ' mt-4' : ''}`;
        }
      });

      // Sauvegarder la préférence
      saveViewPreference();

      // Re-render pour ajuster le niveau de détail
      if (activeView === 'dashboard') renderDashboard();
      else if (activeView === 'tasks') renderTasks();
      else if (activeView === 'archives') renderArchives();
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
      await idbSet('salt', bufToHex(salt));
      cryptoKey = await deriveKey(pwd, salt);
      tasks = window.initialTasks || [];
      await saveToStorage();
    } else {
      const saltHex = await idbGet('salt');
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

    // Initialize custom lists in forms
    updateRequesterSelects();
    updateTypeSelects();
    if (mainContent) mainContent.style.display = 'block';

    // Update sidebar counts and notification badge
    updateSidebarCounts();

    // Show dashboard
    switchView('dashboard');

    // Initialize notification system
    initNotificationSystem();

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
  await idbSet('salt', bufToHex(salt));
  cryptoKey = await deriveKey(newPwd, salt);
  await saveToStorage();
  showToast('🔑 Le mot de passe a été changé avec succès');
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
//  INDEXEDDB WRAPPER
// ════════════════════════════════════════════════════════════

let db = null;

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

async function idbGet(key) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key, value) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function idbRemove(key) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function idbClear() {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ════════════════════════════════════════════════════════════
//  MIGRATION FROM LOCALSTORAGE
// ════════════════════════════════════════════════════════════

async function migrateFromLocalStorage() {
  // Check if data exists in localStorage
  const hasLegacyData = !!localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!hasLegacyData) return false;

  console.log('🔄 Migration des données depuis localStorage vers IndexedDB...');

  try {
    // Migrate salt
    const salt = localStorage.getItem(LEGACY_SALT_KEY);
    if (salt) {
      await idbSet('salt', salt);
    }

    // Migrate encrypted data
    const tasks = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (tasks) {
      await idbSet('tasks', tasks);
    }

    const versions = localStorage.getItem(LEGACY_VERSIONS_KEY);
    if (versions) {
      await idbSet('versions', versions);
    }

    const projects = localStorage.getItem(LEGACY_PROJECTS_KEY);
    if (projects) {
      await idbSet('projects', projects);
    }

    const config = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (config) {
      await idbSet('config', config);
    }

    console.log('✅ Migration réussie ! Nettoyage de localStorage...');

    // Clear legacy localStorage data
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SALT_KEY);
    localStorage.removeItem(LEGACY_VERSIONS_KEY);
    localStorage.removeItem(LEGACY_PROJECTS_KEY);
    localStorage.removeItem(LEGACY_CONFIG_KEY);

    console.log('✅ localStorage nettoyé');

    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    return false;
  }
}

// ════════════════════════════════════════════════════════════
//  STOCKAGE
// ════════════════════════════════════════════════════════════

async function loadFromStorage() {
  const raw = await idbGet('tasks');
  if (!raw) { tasks = []; } else { tasks = await decrypt(raw); }

  const rawVersions = await idbGet('versions');
  if (!rawVersions) { versions = {}; } else { versions = await decrypt(rawVersions); }

  const rawProjects = await idbGet('projects');
  if (!rawProjects) { projects = []; } else { projects = await decrypt(rawProjects); }

  const rawConfig = await idbGet('config');
  if (!rawConfig) {
    // Default config if not exists
    config = {
      requesters: [
        { name: 'S3AD', email: '' },
        { name: 'SE2S', email: '' },
        { name: 'MDA', email: '' },
        { name: 'PSS', email: '' },
        { name: 'ASG', email: '' },
        { name: 'Autres', email: '' }
      ],
      types: ['SOLIS', 'MULTIGEST', 'BO', 'Courriers', 'Autres'],
      emailTemplates: {
        completion: {
          subject: 'Tache realisee : {{TITLE}}',
          body: `Bonjour,

Nous vous informons que la tache suivante a ete realisee :

========================================
TITRE
{{TITLE}}

{{DESCRIPTION}}INFORMATIONS
- Date de demande : {{REQUEST_DATE}}
- Date d'echeance : {{DEADLINE}}
- Date de realisation : {{COMPLETION_DATE}}
- Urgence : {{URGENCY}}
{{TYPE}}{{ORDER}}========================================

Cordialement,
TaskMDA - Gestion de taches`
        },
        inquiry: {
          subject: 'Demande d\'informations : {{TITLE}}',
          body: `Bonjour,

Nous revenons vers vous concernant la tache suivante et aurions besoin de precisions supplementaires :

========================================
TITRE
{{TITLE}}

{{DESCRIPTION}}INFORMATIONS
- Statut : {{STATUS}}
- Date de demande : {{REQUEST_DATE}}
- Date d'echeance : {{DEADLINE}}
- Urgence : {{URGENCY}}
{{TYPE}}{{ORDER}}========================================

Pourriez-vous nous apporter les informations suivantes :

[Votre message ici]

Cordialement,
TaskMDA - Gestion de taches`
        }
      },
      appearance: {
        darkMode: false,
        highContrast: false
      }
    };
  } else {
    config = await decrypt(rawConfig);
    // Ensure emailTemplates exist for backwards compatibility
    if (!config.emailTemplates) {
      config.emailTemplates = {
        completion: {
          subject: 'Tache realisee : {{TITLE}}',
          body: `Bonjour,

Nous vous informons que la tache suivante a ete realisee :

========================================
TITRE
{{TITLE}}

{{DESCRIPTION}}INFORMATIONS
- Date de demande : {{REQUEST_DATE}}
- Date d'echeance : {{DEADLINE}}
- Date de realisation : {{COMPLETION_DATE}}
- Urgence : {{URGENCY}}
{{TYPE}}{{ORDER}}========================================

Cordialement,
TaskMDA - Gestion de taches`
        },
        inquiry: {
          subject: 'Demande d\'informations : {{TITLE}}',
          body: `Bonjour,

Nous revenons vers vous concernant la tache suivante et aurions besoin de precisions supplementaires :

========================================
TITRE
{{TITLE}}

{{DESCRIPTION}}INFORMATIONS
- Statut : {{STATUS}}
- Date de demande : {{REQUEST_DATE}}
- Date d'echeance : {{DEADLINE}}
- Urgence : {{URGENCY}}
{{TYPE}}{{ORDER}}========================================

Pourriez-vous nous apporter les informations suivantes :

[Votre message ici]

Cordialement,
TaskMDA - Gestion de taches`
        }
      };
    }
    // Ensure appearance settings exist for backwards compatibility
    if (!config.appearance) {
      config.appearance = {
        darkMode: false,
        highContrast: false
      };
    }
  }

  // Load view preference
  const savedViewMode = await idbGet('taskViewMode');
  if (savedViewMode !== null) {
    taskViewMode = savedViewMode;
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.view) === taskViewMode);
    });
    // Apply grid classes
    updateGridClasses();
  }

  // Dédoublonner les tâches par ID
  deduplicateTasks();

  updateProjectCount();

  // Apply appearance settings
  applyAppearanceSettings();
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
  await idbSet('tasks', await encrypt(tasks));
  await idbSet('versions', await encrypt(versions));
  await idbSet('projects', await encrypt(projects));
  await idbSet('config', await encrypt(config));
}

async function saveViewPreference() {
  await idbSet('taskViewMode', taskViewMode);
}

function updateGridClasses() {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 xl:grid-cols-2',
    3: 'grid-cols-1 xl:grid-cols-3',
    4: 'grid-cols-1 xl:grid-cols-4'
  };

  ['tasks', 'dashboardTasks', 'archives'].forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
      // Retirer toutes les anciennes classes de grille
      container.className = container.className.replace(/grid-cols-\d+/g, '').replace(/xl:grid-cols-\d+/g, '').trim();
      // Ajouter les nouvelles classes
      container.className = `grid ${gridClasses[taskViewMode]} gap-6${containerId === 'dashboardTasks' ? ' mt-4' : ''}`;
    }
  });
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

      // Set weekday if applicable
      if (task.recurring.weekday !== null && task.recurring.weekday !== undefined) {
        document.getElementById('recurringWeekday').value = task.recurring.weekday.toString();
      }

      // Set monthday if applicable
      if (task.recurring.monthday !== null && task.recurring.monthday !== undefined) {
        document.getElementById('recurringMonthday').value = task.recurring.monthday.toString();
      }

      // Set infinite and endDate
      const isInfinite = task.recurring.infinite || false;
      document.getElementById('recurringInfinite').checked = isInfinite;
      document.getElementById('recurringEndDate').value = task.recurring.endDate || '';

      // Show/hide end date field based on infinite
      const endField = document.getElementById('recurringEndField');
      if (endField) {
        endField.classList.toggle('hidden', isInfinite);
      }

      // Update conditional fields visibility
      updateRecurringFields();
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

function getActiveProjects() {
  return projects.filter(p => !p.archivedAt);
}

function getArchivedProjects() {
  return projects.filter(p => p.archivedAt);
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
      interval: parseInt(document.getElementById('recurringInterval').value) || 1,
      weekday: document.getElementById('recurringWeekday')?.value ? parseInt(document.getElementById('recurringWeekday').value) : null,
      monthday: document.getElementById('recurringMonthday')?.value ? parseInt(document.getElementById('recurringMonthday').value) : null,
      infinite: document.getElementById('recurringInfinite')?.checked || false,
      endDate: document.getElementById('recurringEndDate')?.value || null
    } : null;

    // Si tâche récurrente avec jour spécifique, calculer la prochaine date
    let calculatedRequestDate = requestDate;
    if (isRecurring && recurring) {
      const nextDate = calculateNextRecurrenceDate(recurring);
      if (nextDate) {
        calculatedRequestDate = nextDate.toISOString().split('T')[0];
      }
    }

    // Validation du titre
    if (!title) {
      const titleInput = document.getElementById('taskTitle');
      shake(titleInput);
      showToast('⚠️ Le titre de la tâche est obligatoire');
      titleInput.focus();
      return;
    }

    // Validation de la deadline (optionnelle mais avertissement si absente)
    if (!deadline) {
      // Pour les tâches, la deadline n'est pas strictement obligatoire,
      // mais on peut afficher un avertissement si l'utilisateur le souhaite
      // console.log('⚠️ Aucune deadline définie pour cette tâche');
    }

    // Validation du demandeur
    if (!requester) {
      showToast('⚠️ Veuillez sélectionner un demandeur');
      document.getElementById('taskRequester').focus();
      return;
    }

    // Validation du type
    if (!type) {
      showToast('⚠️ Veuillez sélectionner un type de tâche');
      document.getElementById('taskType').focus();
      return;
    }

    const wasArchived = editingId && tasks.find(t => t.id === editingId)?.status === 'realise';
    const now = new Date().toISOString();

    if (editingId) {
      const existingTask = tasks.find(t => t.id === editingId);
      const existingFiles = existingTask.files || [];
      tasks = tasks.map(t => t.id === editingId
        ? { ...t, title, comment, urgency, status, deadline, requestDate: calculatedRequestDate, requester, type, order, recurring,
            files: [...existingFiles, ...attachedFiles],
            updatedAt: now,
            archivedAt: status === 'realise' ? (t.archivedAt || now) : null }
        : t
      );

      // Si tâche récurrente marquée comme réalisée, créer la prochaine occurrence
      if (status === 'realise' && !wasArchived && recurring) {
        createNextRecurrence(existingTask, recurring);
      }

      showToast(`✏️ La tâche "${title}" a été modifiée avec succès`);
    } else {
      tasks.push({
        id: Date.now(), title, comment, urgency, status, deadline, requestDate: calculatedRequestDate, requester, type, order, recurring,
        files: attachedFiles,
        createdAt: now,
        updatedAt: now,
        archivedAt: status === 'realise' ? now : null
      });

      // Message personnalisé si tâche récurrente avec jour spécifique
      if (isRecurring && recurring && (recurring.weekday !== null || recurring.monthday !== null)) {
        const dateLabel = new Date(calculatedRequestDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        showToast(`✅ Tâche récurrente créée : première occurrence le ${dateLabel}`);
      } else {
        showToast(`✅ La tâche "${title}" a été créée avec succès`);
      }
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
      showToast(`🗄 La tâche "${title}" a été archivée — consultez l'onglet Archives`);
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
    showToast(`⚠️ La tâche "${task.title}" est déjà archivée`);
    return;
  }

  tasks = tasks.map(t => t.id === id ? { ...t, status: 'realise', updatedAt: now, archivedAt: now } : t);

  // Si tâche récurrente, créer la prochaine occurrence
  if (task && task.recurring) {
    createNextRecurrence(task, task.recurring);
  }

  await saveToStorage();
  updateSidebarCounts();

  // Propose d'envoyer un email au demandeur si un email est configuré
  if (task && task.requester) {
    const requester = config.requesters.find(r => r.name === task.requester);
    if (requester && requester.email) {
      // Show confirmation modal for email sending
      showEmailConfirmation(task, requester.email);
    }
  }

  // Automatically switch to archives view to show the completed task
  if (activeView === 'tasks' || activeView === 'dashboard') {
    showToast(`✅ La tâche "${task.title}" a été marquée comme réalisée et archivée`);
    switchView('archives');
  } else {
    // If already in archives, just refresh
    renderArchives();
    showToast(`✅ La tâche "${task.title}" a été marquée comme réalisée`);
  }
}

function showEmailConfirmation(task, email) {
  const content = `
    <div class="space-y-4">
      <p class="text-on-surface-variant">
        Souhaitez-vous notifier <strong class="text-on-surface">${escHtml(task.requester)}</strong>
        (<a href="mailto:${escHtml(email)}" class="text-primary hover:underline">${escHtml(email)}</a>)
        que la tâche <strong class="text-on-surface">"${escHtml(task.title)}"</strong> a été réalisée ?
      </p>
      <div class="flex gap-3">
        <button onclick="sendTaskCompletionEmail(${task.id}); document.getElementById('tempModal').remove();"
                class="flex-1 px-6 py-3 bg-primary-gradient text-white rounded-xl font-bold hover:opacity-90 transition-opacity">
          <span class="material-symbols-outlined text-base align-middle mr-2">email</span>
          Envoyer l'email
        </button>
        <button onclick="document.getElementById('tempModal').remove()"
                class="flex-1 px-6 py-3 bg-surface-container hover:bg-surface-container-high rounded-xl font-semibold transition-colors">
          Ignorer
        </button>
      </div>
    </div>
  `;

  showModal('📧 Notification au demandeur', content);
}

function canSendEmailForTask(task) {
  if (!task || !task.requester) return false;
  const requester = config.requesters.find(r => r.name === task.requester);
  return requester && requester.email && requester.email.trim().length > 0;
}

function sendTaskCompletionEmail(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const requester = config.requesters.find(r => r.name === task.requester);
  if (!requester || !requester.email) {
    showToast(`⚠️ Aucun email configuré pour le demandeur "${task.requester}"`);
    return;
  }

  // Get template and replace variables
  const template = config.emailTemplates.completion;
  const subject = replaceTemplateVariables(template.subject, task);
  const body = replaceTemplateVariables(template.body, task);

  // URL encode for mailto
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body).replace(/%0A/g, '%0D%0A');

  // Open email client
  window.location.href = `mailto:${requester.email}?subject=${encodedSubject}&body=${encodedBody}`;

  showToast(`📧 Email de notification prêt pour la tâche "${task.title}"`);
}

function sendTaskInquiryEmail(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const requester = config.requesters.find(r => r.name === task.requester);
  if (!requester || !requester.email) {
    showToast(`⚠️ Aucun email configuré pour le demandeur "${task.requester}"`);
    return;
  }

  // Get template and replace variables
  const template = config.emailTemplates.inquiry;
  const subject = replaceTemplateVariables(template.subject, task);
  const body = replaceTemplateVariables(template.body, task);

  // URL encode for mailto
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body).replace(/%0A/g, '%0D%0A');

  // Open email client
  window.location.href = `mailto:${requester.email}?subject=${encodedSubject}&body=${encodedBody}`;

  showToast(`📧 Email de demande d'informations prêt pour la tâche "${task.title}"`);
}

async function restoreTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task || !task.archivedAt) return;

  // Restaurer la tâche : supprimer archivedAt et remettre le statut à 'en-cours'
  tasks = tasks.map(t => t.id === id ? { ...t, status: 'en-cours', archivedAt: null, updatedAt: new Date().toISOString() } : t);

  await saveToStorage();
  updateSidebarCounts();

  showToast(`♻️ La tâche "${task.title}" a été restaurée avec succès`);

  // Refresh current view
  if (activeView === 'archives') {
    renderArchives();
  } else {
    renderTasks();
  }
}

function calculateNextRecurrenceDate(recurring) {
  if (!recurring) return null;

  const today = new Date();
  let nextDate = new Date(today);

  switch (recurring.frequency) {
    case 'daily':
      // Pour quotidien, la prochaine occurrence est demain
      nextDate.setDate(nextDate.getDate() + recurring.interval);
      break;

    case 'weekly':
      // Si un jour de la semaine est spécifié
      if (recurring.weekday !== null && recurring.weekday !== undefined) {
        const targetWeekday = recurring.weekday; // 0=Dimanche, 1=Lundi, etc.
        const currentWeekday = today.getDay();

        // Calculer les jours jusqu'au prochain jour cible
        let daysUntilTarget = targetWeekday - currentWeekday;
        if (daysUntilTarget <= 0) {
          daysUntilTarget += 7; // Passer à la semaine suivante
        }

        nextDate.setDate(today.getDate() + daysUntilTarget);
      } else {
        // Par défaut : ajouter des semaines
        nextDate.setDate(nextDate.getDate() + (7 * recurring.interval));
      }
      break;

    case 'monthly':
      // Si un jour du mois est spécifié
      if (recurring.monthday !== null && recurring.monthday !== undefined) {
        // Passer au mois suivant d'abord
        nextDate.setMonth(nextDate.getMonth() + recurring.interval);

        if (recurring.monthday === -1) {
          // Dernier jour du mois
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(0); // Définit au dernier jour du mois précédent
        } else {
          // Jour spécifique du mois
          const daysInMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
          const targetDay = Math.min(recurring.monthday, daysInMonth);
          nextDate.setDate(targetDay);
        }
      } else {
        // Par défaut : ajouter des mois
        nextDate.setMonth(nextDate.getMonth() + recurring.interval);
      }
      break;

    case 'yearly':
      // Ajouter des années
      nextDate.setFullYear(nextDate.getFullYear() + recurring.interval);
      break;

    default:
      return null;
  }

  return nextDate;
}

function createNextRecurrence(task, recurring) {
  if (!recurring) return;

  // Check if end date is reached
  if (recurring.endDate && !recurring.infinite) {
    const endDate = new Date(recurring.endDate);
    const today = new Date();
    if (today > endDate) {
      showToast(`⏸️ Récurrence terminée pour "${task.title}" (date de fin atteinte)`);
      return;
    }
  }

  const now = new Date();

  // Utiliser la fonction centralisée pour calculer la prochaine date
  const nextDate = calculateNextRecurrenceDate(recurring);
  if (!nextDate) {
    console.error('Impossible de calculer la prochaine occurrence');
    return;
  }

  // Check if next date exceeds end date
  if (recurring.endDate && !recurring.infinite) {
    const endDate = new Date(recurring.endDate);
    if (nextDate > endDate) {
      showToast(`⏸️ Récurrence terminée pour "${task.title}" (date de fin atteinte)`);
      return;
    }
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

  const infiniteLabel = recurring.infinite ? ' (infinie)' : '';
  const endDateLabel = recurring.endDate && !recurring.infinite ? ` (jusqu'au ${new Date(recurring.endDate).toLocaleDateString('fr-FR')})` : '';
  showToast(`🔄 Prochaine occurrence créée pour "${task.title}"${infiniteLabel}${endDateLabel}`);
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
    const taskTitle = task.title;
    tasks = tasks.filter(t => t.id !== id);
    await saveToStorage();
    updateSidebarCounts();
    if (activeView === 'dashboard') renderDashboard();
    else if (activeView === 'tasks') renderTasks();
    else if (activeView === 'archives') renderArchives();
    closeConfirm();
    showToast(`🗑 La tâche "${taskTitle}" a été supprimée définitivement`);
  };
}

function closeConfirm() { document.getElementById('confirmOverlay').classList.add('hidden'); }

function clearAllTasks() {
  if (!tasks.length) return;
  document.getElementById('confirmTitle').textContent = 'Effacer toutes les tâches ?';
  document.getElementById('confirmMsg').textContent   = `${tasks.length} tâche(s) seront supprimées définitivement.`;
  document.getElementById('confirmOverlay').classList.add('open');
  document.getElementById('confirmYes').onclick = async () => {
    const count = tasks.length;
    tasks = [];
    await saveToStorage();
    if (activeView === 'dashboard') renderDashboard();
    else if (activeView === 'tasks') renderTasks();
    else if (activeView === 'archives') renderArchives();
    closeConfirm();
    showToast(`🗑 Toutes les tâches ont été effacées définitivement (${count} tâche(s))`);
  };
}

// ════════════════════════════════════════════════════════════
//  APPARENCE — DARK MODE & HIGH CONTRAST
// ════════════════════════════════════════════════════════════

async function toggleDarkMode(e) {
  const enabled = e.target.checked;
  config.appearance.darkMode = enabled;

  if (enabled) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  await saveToStorage();
  showToast(enabled ? '🌙 Mode sombre activé' : '☀️ Mode clair activé');
}

async function toggleHighContrast(e) {
  const enabled = e.target.checked;
  config.appearance.highContrast = enabled;

  if (enabled) {
    document.body.classList.add('high-contrast');
  } else {
    document.body.classList.remove('high-contrast');
  }

  await saveToStorage();
  showToast(enabled ? '🔲 Contraste renforcé activé' : '🔳 Contraste normal activé');
}

function applyAppearanceSettings() {
  // Apply dark mode - on <html> element for Tailwind
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (config.appearance?.darkMode) {
    document.documentElement.classList.add('dark');
    if (darkModeToggle) darkModeToggle.checked = true;
  } else {
    document.documentElement.classList.remove('dark');
    if (darkModeToggle) darkModeToggle.checked = false;
  }

  // Apply high contrast - on <body> element
  const highContrastToggle = document.getElementById('highContrastToggle');
  if (config.appearance?.highContrast) {
    document.body.classList.add('high-contrast');
    if (highContrastToggle) highContrastToggle.checked = true;
  } else {
    document.body.classList.remove('high-contrast');
    if (highContrastToggle) highContrastToggle.checked = false;
  }
}

// ════════════════════════════════════════════════════════════
//  SYSTÈME DE NOTIFICATIONS
// ════════════════════════════════════════════════════════════

function checkNotifications() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let notifications = [];

  // Check for recurring tasks due today
  const activeTasks = getActiveTasks();
  activeTasks.forEach(task => {
    if (task.recurring && task.requestDate) {
      const taskDate = new Date(task.requestDate);
      taskDate.setHours(0, 0, 0, 0);

      if (taskDate.getTime() === today.getTime()) {
        notifications.push({
          type: 'recurring_task',
          title: `🔄 Tâche récurrente aujourd'hui`,
          message: `"${task.title}" est prévue pour aujourd'hui`,
          taskId: task.id
        });
      }
    }
  });

  // Check for projects ending today
  const activeProjects = getActiveProjects();
  activeProjects.forEach(project => {
    if (project.endDate) {
      const endDate = new Date(project.endDate);
      endDate.setHours(0, 0, 0, 0);

      if (endDate.getTime() === today.getTime()) {
        notifications.push({
          type: 'project_end',
          title: `🏁 Fin de projet aujourd'hui`,
          message: `Le projet "${project.name}" se termine aujourd'hui`,
          projectId: project.id
        });
      }
    }
  });

  // Check for projects ending in next 3 days
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  activeProjects.forEach(project => {
    if (project.endDate) {
      const endDate = new Date(project.endDate);
      endDate.setHours(0, 0, 0, 0);

      if (endDate > today && endDate <= threeDaysLater) {
        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        notifications.push({
          type: 'project_ending_soon',
          title: `⏰ Projet se termine bientôt`,
          message: `Le projet "${project.name}" se termine dans ${daysLeft} jour(s)`,
          projectId: project.id
        });
      }
    }
  });

  // Display notifications if any
  if (notifications.length > 0) {
    displayNotifications(notifications);
  }

  return notifications;
}

function displayNotifications(notifications) {
  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.log('Notifications non supportées par ce navigateur');
    return;
  }

  // Only send browser notifications if already granted (don't ask every time)
  if (Notification.permission === 'granted') {
    sendBrowserNotifications(notifications);
  }

  // Show in-app notification (always)
  showNotificationsSummary(notifications);
}

function sendBrowserNotifications(notifications) {
  notifications.forEach((notif, index) => {
    setTimeout(() => {
      new Notification(notif.title, {
        body: notif.message,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🏛️</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🏛️</text></svg>',
        tag: `taskmda-${notif.type}-${notif.taskId || notif.projectId}`,
        requireInteraction: false
      });
    }, index * 1000); // Stagger notifications by 1 second
  });
}

function showNotificationsSummary(notifications) {
  if (notifications.length === 0) return;

  const summary = notifications.map(n => `${n.title}: ${n.message}`).join('\n');
  showToast(`🔔 ${notifications.length} notification(s) - Voir les détails`, 5000);

  // Log to console for debugging
  console.log('📬 Notifications TaskMDA:', notifications);
}

// Check notifications on load and every hour
function initNotificationSystem() {
  // Check immediately
  checkNotifications();

  // Check every hour
  setInterval(checkNotifications, 60 * 60 * 1000);

  // Also check when switching views
  const originalSwitchView = window.switchView;
  if (originalSwitchView) {
    window.switchView = function(...args) {
      const result = originalSwitchView.apply(this, args);
      checkNotifications();
      return result;
    };
  }
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

  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

  // Search in current view
  if (activeView === 'tasks') {
    renderTasks();
  } else if (activeView === 'projects') {
    renderGanttChart();
  } else if (activeView === 'dashboard') {
    // From dashboard: always use renderGlobalSearchResults to handle show/hide
    renderGlobalSearchResults();
  } else {
    // If in another view without search, switch to tasks
    switchView('tasks');
  }
}

function renderGlobalSearchResults() {
  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

  const dashboardContainer = document.getElementById('viewDashboard');
  if (!dashboardContainer) return;

  // Check if search results container exists
  let searchContainer = document.getElementById('globalSearchResults');
  const normalDashboard = document.getElementById('normalDashboard');

  if (!searchQuery) {
    // Show normal dashboard, hide search results
    if (searchContainer) searchContainer.classList.add('hidden');
    if (normalDashboard) {
      normalDashboard.classList.remove('hidden');
      renderDashboard(); // Refresh dashboard data
    }
    return;
  }

  // Search in tasks
  const matchingTasks = getActiveTasks().filter(t => {
    const matchTitle = t.title?.toLowerCase().includes(searchQuery);
    const matchComment = t.comment?.toLowerCase().includes(searchQuery);
    const matchRequester = t.requester?.toLowerCase().includes(searchQuery);
    const matchType = t.type?.toLowerCase().includes(searchQuery);
    return matchTitle || matchComment || matchRequester || matchType;
  });

  // Search in projects
  const matchingProjects = getActiveProjects().filter(p => {
    const matchName = p.name?.toLowerCase().includes(searchQuery);
    const matchDescription = p.description?.toLowerCase().includes(searchQuery);
    const matchRequesters = p.requesters?.some(r => r.toLowerCase().includes(searchQuery));
    const matchStatus = p.status?.toLowerCase().includes(searchQuery);
    return matchName || matchDescription || matchRequesters || matchStatus;
  });

  // Hide normal dashboard
  if (normalDashboard) normalDashboard.classList.add('hidden');

  // Create or update search results container
  if (!searchContainer) {
    searchContainer = document.createElement('div');
    searchContainer.id = 'globalSearchResults';
    dashboardContainer.appendChild(searchContainer);
  }
  searchContainer.classList.remove('hidden');

  // Populate search results
  searchContainer.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl md:text-3xl font-extrabold font-headline tracking-tight text-on-surface mb-2">
        Résultats de recherche : "${escHtml(searchQuery)}"
      </h2>
      <p class="text-on-surface-variant">
        ${matchingTasks.length} tâche${matchingTasks.length > 1 ? 's' : ''} •
        ${matchingProjects.length} projet${matchingProjects.length > 1 ? 's' : ''}
      </p>
    </div>

    <!-- Tasks Results -->
    ${matchingTasks.length > 0 ? `
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-primary">task_alt</span>
        <h3 class="text-xl font-bold font-headline text-on-surface">Tâches trouvées (${matchingTasks.length})</h3>
      </div>
      <div id="searchTasksResults" class="grid grid-cols-1 xl:grid-cols-2 gap-6"></div>
    </div>
    ` : `
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-on-surface-variant">task_alt</span>
        <h3 class="text-xl font-bold font-headline text-on-surface-variant">Aucune tâche trouvée</h3>
      </div>
    </div>
    `}

    <!-- Projects Results -->
    ${matchingProjects.length > 0 ? `
    <div>
      <div class="flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-primary">folder_open</span>
        <h3 class="text-xl font-bold font-headline text-on-surface">Projets trouvés (${matchingProjects.length})</h3>
      </div>
      <div id="searchProjectsResults" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
    </div>
    ` : `
    <div>
      <div class="flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-on-surface-variant">folder_open</span>
        <h3 class="text-xl font-bold font-headline text-on-surface-variant">Aucun projet trouvé</h3>
      </div>
    </div>
    `}
  `;

  // Render matching tasks
  if (matchingTasks.length > 0) {
    const tasksContainer = document.getElementById('searchTasksResults');
    matchingTasks.slice(0, 10).forEach((task, idx) => {
      tasksContainer.appendChild(buildCard(task, idx, false));
    });
  }

  // Render matching projects
  if (matchingProjects.length > 0) {
    const projectsContainer = document.getElementById('searchProjectsResults');
    const statusColors = {
      'en-cours': { bg: 'bg-[#006c4a]', text: 'text-white', label: 'EN COURS', dot: '#006c4a' },
      'planifie': { bg: 'bg-[#6366f1]', text: 'text-white', label: 'PLANIFIÉ', dot: '#6366f1' },
      'urgent': { bg: 'bg-[#ef4444]', text: 'text-white', label: 'URGENT', dot: '#ef4444' },
      'termine': { bg: 'bg-[#9ca3af]', text: 'text-white', label: 'TERMINÉ', dot: '#9ca3af' }
    };

    matchingProjects.slice(0, 10).forEach(project => {
      const color = statusColors[project.status] || statusColors['en-cours'];
      const startDate = new Date(project.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      const endDate = new Date(project.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

      const requesters = project.requesters || (project.requester ? [project.requester] : []);
      const requesterBadges = requesters.map(req =>
        `<span class="text-xs px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant font-semibold">${escHtml(req)}</span>`
      ).join('');

      const projectCard = `
        <div class="bg-surface-container-low rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer" onclick="openProjectModal(${project.id})">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <h3 class="font-bold text-on-surface text-lg mb-2">${escHtml(project.name)}</h3>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="w-2 h-2 rounded-full" style="background-color: ${color.dot}"></span>
                <span class="text-xs font-medium text-on-surface-variant uppercase">${color.label}</span>
              </div>
            </div>
          </div>

          <div class="space-y-2 mb-3">
            <div class="flex items-center gap-2 text-sm text-on-surface-variant">
              <span class="material-symbols-outlined text-base">calendar_month</span>
              <span>${startDate} → ${endDate}</span>
            </div>
          </div>

          ${requesters.length > 0 ? `
          <div class="flex flex-wrap gap-2 mb-3">
            ${requesterBadges}
          </div>
          ` : ''}

          <div class="pt-3 border-t border-surface-container">
            <div class="flex items-center justify-between text-sm mb-2">
              <span class="text-on-surface-variant font-medium">Progression</span>
              <span class="font-bold text-on-surface">${project.progress}%</span>
            </div>
            <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden">
              <div class="${color.bg} h-full rounded-full transition-all" style="width: ${project.progress}%"></div>
            </div>
          </div>
        </div>
      `;
      projectsContainer.innerHTML += projectCard;
    });
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
  } else {
    list.forEach((task, idx) => container.appendChild(buildCard(task, idx, true)));
  }

  // Render archived projects (always, regardless of archived tasks)
  renderArchivedProjects();
}

function renderArchivedProjects() {
  const container = document.getElementById('archivedProjects');
  if (!container) return;

  const archivedProjects = getArchivedProjects();

  if (archivedProjects.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-8">
        <span class="material-symbols-outlined text-5xl text-on-surface-variant mb-2 block opacity-40">folder_open</span>
        <p class="text-on-surface-variant text-sm">Aucun projet archivé</p>
      </div>
    `;
    return;
  }

  const statusColors = {
    'en-cours': { bg: 'bg-[#006c4a]', text: 'text-white', label: 'EN COURS', dot: '#006c4a' },
    'planifie': { bg: 'bg-[#6366f1]', text: 'text-white', label: 'PLANIFIÉ', dot: '#6366f1' },
    'urgent': { bg: 'bg-[#ef4444]', text: 'text-white', label: 'URGENT', dot: '#ef4444' },
    'termine': { bg: 'bg-[#9ca3af]', text: 'text-white', label: 'TERMINÉ', dot: '#9ca3af' }
  };

  let html = '';
  archivedProjects.forEach(project => {
    const color = statusColors[project.status] || statusColors['termine'];
    const startDate = new Date(project.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const endDate = new Date(project.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const archivedDate = project.archivedAt ? new Date(project.archivedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    const requesters = project.requesters || (project.requester ? [project.requester] : []);
    const requesterBadges = requesters.map(req =>
      `<span class="text-xs px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant font-semibold">${escHtml(req)}</span>`
    ).join('');

    html += `
      <div class="bg-surface-container-low rounded-2xl p-4 shadow-sm opacity-75 group">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <h3 class="font-bold text-on-surface text-lg mb-2">${escHtml(project.name)}</h3>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-2 h-2 rounded-full" style="background-color: ${color.dot}"></span>
              <span class="text-xs font-medium text-on-surface-variant uppercase">${color.label}</span>
            </div>
          </div>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="restoreProject(${project.id})" title="Restaurer le projet" class="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-primary transition-colors">
              <span class="material-symbols-outlined text-sm">restore</span>
            </button>
          </div>
        </div>

        <div class="space-y-2 mb-3">
          <div class="flex items-center gap-2 text-sm text-on-surface-variant">
            <span class="material-symbols-outlined text-base">calendar_month</span>
            <span>${startDate} → ${endDate}</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-on-surface-variant">
            <span class="material-symbols-outlined text-base">archive</span>
            <span>Archivé le ${archivedDate}</span>
          </div>
        </div>

        ${requesters.length > 0 ? `
        <div class="flex flex-wrap gap-2 mb-3">
          ${requesterBadges}
        </div>
        ` : ''}

        <div class="pt-3 border-t border-surface-container">
          <div class="flex items-center justify-between text-sm mb-2">
            <span class="text-on-surface-variant font-medium">Progression</span>
            <span class="font-bold text-on-surface">${project.progress}%</span>
          </div>
          <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden">
            <div class="${color.bg} h-full rounded-full transition-all" style="width: ${project.progress}%"></div>
          </div>
        </div>

        ${project.description ? `
        <div class="mt-3 pt-3 border-t border-surface-container">
          <p class="text-sm text-on-surface-variant line-clamp-2">${escHtml(project.description)}</p>
        </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
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

  // Adapter le padding selon le mode de vue
  const paddingClass = taskViewMode === 4 ? 'p-4' : taskViewMode === 1 ? 'p-8' : 'p-6';

  const card = document.createElement('div');
  card.className = `group bg-surface-container-lowest ${paddingClass} rounded-xl relative border-l-4 ${urgencyColors[task.urgency || 'low']} shadow-sm hover:shadow-md transition-all duration-300 task-card`;
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

  // Déterminer le niveau de détail selon le mode de vue
  const titleSize = taskViewMode === 1 ? 'text-xl' : taskViewMode === 4 ? 'text-base' : 'text-lg';
  const commentMaxLength = taskViewMode === 1 ? 300 : taskViewMode === 2 ? 150 : taskViewMode === 3 ? 100 : 60;
  const showFullMetadata = taskViewMode === 1; // Montrer dates complètes en mode détaillé
  const badgeSize = taskViewMode === 4 ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]';

  card.innerHTML = `
    <div class="flex justify-between items-start ${taskViewMode === 4 ? 'mb-2' : 'mb-4'}">
      <div class="flex flex-wrap gap-2">
        <span class="${badgeSize} ${urgencyChipBg[task.urgency || 'low']} font-bold rounded-full uppercase tracking-tight">
          ${task.urgency === 'low' ? '🌿' : task.urgency === 'medium' ? '⚠️' : '🔥'} ${taskViewMode === 4 ? '' : urgencyLabels[task.urgency]||task.urgency}
        </span>
        ${!isArchive && taskViewMode !== 4 ? `<span class="${badgeSize} ${statusChipBg[task.status] || 'bg-secondary-container text-on-secondary-container'} font-bold rounded-full uppercase tracking-tight">
          ${statusLabels[task.status]||task.status}
        </span>` : ''}
        ${task.type && taskViewMode !== 4 ? `<span class="${badgeSize} bg-surface-container text-on-surface-variant font-bold rounded-full uppercase tracking-tight">
          ${escHtml(task.type)}
        </span>` : ''}
        ${recurringText && taskViewMode <= 2 ? `<span class="${badgeSize} bg-surface-container text-on-surface-variant font-bold rounded-full tracking-tight">
          ${recurringText}
        </span>` : ''}
      </div>
      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onclick="openModal(${task.id})" title="Modifier la tâche" class="${taskViewMode === 4 ? 'p-1' : 'p-2'} hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined ${taskViewMode === 4 ? 'text-xs' : 'text-sm'}">edit</span>
        </button>
        ${!isArchive && task.requester && canSendEmailForTask(task) && taskViewMode <= 2 ? `<button onclick="sendTaskInquiryEmail(${task.id})" title="Contacter le demandeur" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">email</span>
        </button>` : ''}
        ${!isArchive ? `<button onclick="markAsCompleted(${task.id})" title="Marquer comme réalisé" class="${taskViewMode === 4 ? 'p-1' : 'p-2'} hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined ${taskViewMode === 4 ? 'text-xs' : 'text-sm'}">check</span>
        </button>` : ''}
        ${isArchive && task.requester && canSendEmailForTask(task) && taskViewMode <= 2 ? `<button onclick="sendTaskCompletionEmail(${task.id})" title="Notifier le demandeur par email" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">email</span>
        </button>` : ''}
        ${isArchive && taskViewMode !== 4 ? `<button onclick="restoreTask(${task.id})" title="Restaurer la tâche" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">restore</span>
        </button>` : ''}
        <button onclick="confirmDelete(${task.id})" title="Supprimer la tâche" class="${taskViewMode === 4 ? 'p-1' : 'p-2'} hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-tertiary transition-colors">
          <span class="material-symbols-outlined ${taskViewMode === 4 ? 'text-xs' : 'text-sm'}">delete</span>
        </button>
      </div>
    </div>

    ${taskViewMode !== 4 ? `<div class="mb-2 flex items-center gap-2">
      <span class="text-xs text-on-surface-variant font-semibold">${escHtml(displayIndex)}</span>
    </div>` : ''}

    <h4 class="${titleSize} font-bold text-on-surface ${taskViewMode === 4 ? 'mb-1' : 'mb-2'}">${escHtml(task.title)}</h4>

    ${task.comment && taskViewMode <= 3 ? `
      <p class="text-sm text-on-surface-variant ${taskViewMode === 4 ? 'mb-2' : 'mb-6'} ${taskViewMode === 1 ? 'line-clamp-4' : 'line-clamp-2'}">${escHtml(task.comment.substring(0, commentMaxLength))}${task.comment.length > commentMaxLength ? '...' : ''}</p>
    ` : ''}

    ${showFullMetadata && (createdDate || requestDate || updatedDate) ? `
      <div class="mb-4 flex flex-wrap gap-3 text-xs text-on-surface-variant">
        ${createdDate ? `<div class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span> Créé: ${createdDate}</div>` : ''}
        ${requestDate ? `<div class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">event</span> Demandé: ${requestDate}</div>` : ''}
        ${updatedDate ? `<div class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">update</span> Modifié: ${updatedDate}</div>` : ''}
      </div>
    ` : ''}

    <div class="flex items-center justify-between mt-auto ${taskViewMode === 4 ? 'pt-2' : 'pt-4'} border-t border-surface-container-low">
      <div class="flex items-center ${taskViewMode === 4 ? 'gap-2' : 'gap-4'}">
        ${task.requester && taskViewMode !== 4 ? `<div class="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span class="material-symbols-outlined text-base">folder</span>
          <span>${escHtml(task.requester)}</span>
        </div>` : ''}
        ${task.files && task.files.length > 0 ? `<div class="flex items-center gap-1.5 text-xs text-on-surface-variant">
          <span class="material-symbols-outlined ${taskViewMode === 4 ? 'text-sm' : 'text-base'}">attach_file</span>
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
  document.getElementById('recurringWeekday').value = new Date().getDay().toString();
  document.getElementById('recurringMonthday').value = new Date().getDate().toString();
  document.getElementById('recurringInfinite').checked = false;
  document.getElementById('recurringEndDate').value = '';

  // Hide conditional fields
  const weeklyField = document.getElementById('weeklyDayField');
  const monthlyField = document.getElementById('monthlyDayField');
  const endField = document.getElementById('recurringEndField');
  if (weeklyField) weeklyField.classList.add('hidden');
  if (monthlyField) monthlyField.classList.add('hidden');
  if (endField) endField.classList.remove('hidden');

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

function updateRecurringFields() {
  const frequency = document.getElementById('recurringFrequency').value;
  const weeklyField = document.getElementById('weeklyDayField');
  const monthlyField = document.getElementById('monthlyDayField');

  // Hide all conditional fields
  if (weeklyField) weeklyField.classList.add('hidden');
  if (monthlyField) monthlyField.classList.add('hidden');

  // Show relevant field based on frequency
  if (frequency === 'weekly' && weeklyField) {
    weeklyField.classList.remove('hidden');
    // Set default to current day of week if not set
    const weekdaySelect = document.getElementById('recurringWeekday');
    if (weekdaySelect && !weekdaySelect.value) {
      const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
      weekdaySelect.value = today.toString();
    }
  } else if (frequency === 'monthly' && monthlyField) {
    monthlyField.classList.remove('hidden');
    // Set default to current day of month if not set
    const monthdaySelect = document.getElementById('recurringMonthday');
    if (monthdaySelect && !monthdaySelect.value) {
      const today = new Date().getDate();
      monthdaySelect.value = today.toString();
    }
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
  showToast(`🗑 Le fichier "${file.name}" a été supprimé`);
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
        <h3 class="font-bold text-lg mb-2">🔐 Sécurité et stockage</h3>
        <p class="text-sm text-on-surface-variant mb-2">Vos données sont chiffrées localement avec <strong>AES-256-GCM</strong> et stockées dans <strong>IndexedDB</strong>.</p>
        <ul class="text-xs text-on-surface-variant space-y-1 ml-4">
          <li>• Chiffrement : PBKDF2 avec 310 000 itérations</li>
          <li>• Stockage : 100% local dans votre navigateur</li>
          <li>• Aucune connexion serveur requise</li>
          <li>• Sans votre mot de passe, les données sont illisibles</li>
        </ul>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">💾 Sauvegarde des données</h3>
        <p class="text-sm text-on-surface-variant">Vos données sont automatiquement sauvegardées dans IndexedDB. Pour une sauvegarde externe, utilisez <strong>Export JSON</strong> dans Import/Export.</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">🔄 Tâches récurrentes</h3>
        <p class="text-sm text-on-surface-variant">Créez des tâches qui se répètent automatiquement (quotidien, hebdomadaire, mensuel, annuel) avec intervalles personnalisés.</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">📎 Pièces jointes</h3>
        <p class="text-sm text-on-surface-variant">Attachez jusqu'à 5 fichiers par tâche (max 5 Mo chacun). Ils sont chiffrés et stockés avec vos données.</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">📊 Gestion de projets</h3>
        <p class="text-sm text-on-surface-variant">Visualisez vos projets avec un diagramme de Gantt interactif. Basculez entre vue mensuelle et hebdomadaire pour une meilleure visibilité.</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">♻️ Archives</h3>
        <p class="text-sm text-on-surface-variant">Archivez vos tâches et projets terminés. Vous pouvez les restaurer à tout moment en passant la souris sur la carte et en cliquant sur l'icône de restauration.</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">📥📤 Import/Export</h3>
        <p class="text-sm text-on-surface-variant">Exportez vos données en JSON ou Excel depuis Import/Export. Le format JSON inclut toutes vos données chiffrées (tâches, projets, versions, configuration).</p>
      </div>
      <div class="pt-4 border-t border-outline-variant">
        <p class="text-xs text-on-surface-variant text-center">
          <strong>TaskMDA v5.0</strong> — Application développée par <strong>Frédérick MURAT</strong><br>
          Mars 2026 • Licence MIT • Stockage IndexedDB
        </p>
      </div>
    </div>
  `;

  showModal('Aide', content);
}

function showNotifications() {
  // Hide notification badge when user views notifications
  const badge = document.getElementById('notificationBadge');
  if (badge) {
    badge.classList.add('hidden');
  }

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
      <div class="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center p-6 pb-4 shrink-0">
          <h2 class="text-2xl font-bold font-headline">${title}</h2>
          <button onclick="document.getElementById('tempModal').remove()" class="w-10 h-10 flex items-center justify-center hover:bg-surface-container rounded-lg transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="px-6 pb-6 overflow-y-auto">${content}</div>
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

      // Support both old format (array) and new format (object with tasks/versions/projects)
      if (Array.isArray(data)) {
        tasks = data;
      } else if (data.tasks) {
        tasks = data.tasks || [];
        versions = data.versions || {};
        projects = data.projects || [];
        // Import config if available, otherwise keep current
        if (data.config) {
          config = data.config;
        }
      } else {
        throw new Error('Invalid JSON format');
      }

      await saveToStorage();
      updateSidebarCounts();
      updateRequesterSelects();
      updateTypeSelects();
      if (activeView === 'dashboard') renderDashboard();
      else if (activeView === 'tasks') renderTasks();
      else if (activeView === 'projects') renderGanttChart();

      const statusEl = document.getElementById('importStatus');
      if (statusEl) {
        statusEl.className = 'text-sm text-primary';
        const itemsCount = tasks.length + (projects?.length || 0);
        statusEl.textContent = `✓ ${tasks.length} tâche(s) + ${projects?.length || 0} projet(s) importé(s)`;
      }
      showToast(`📂 ${tasks.length} tâche(s) + ${projects?.length || 0} projet(s) importé(s)`);
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
  const data = {
    tasks: tasks,
    versions: versions,
    projects: projects,
    config: config,
    exportedAt: new Date().toISOString(),
    format: 'TaskMDA v4'
  };
  downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}), 'tasks.json');
  showToast(`⬇ Export JSON réussi (${tasks.length} tâche(s) + ${projects.length} projet(s))`);
}

function exportExcel() {
  const wb = XLSX.utils.book_new();

  // Feuille 1 : Tâches
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };
  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const wsTasks = XLSX.utils.json_to_sheet(tasks.map(t => ({
    Ordre:       t.order       || '',
    Titre:       t.title,
    Demandeur:   t.requester   || '',
    Type:        t.type        || '',
    Urgence:     urgencyLabels[t.urgency] || t.urgency,
    Statut:      statusLabels[t.status]  || t.status,
    Date_demande: t.requestDate || '',
    Deadline:    t.deadline    || '',
    Commentaire: t.comment     || '',
    Archivé_le:  t.archivedAt  ? new Date(t.archivedAt).toLocaleDateString('fr-FR') : ''
  })));
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Tâches');

  // Feuille 2 : Projets
  const projectStatusLabels = {
    'en-cours': 'En cours',
    'planifie': 'Planifié',
    'urgent': 'Urgent',
    'termine': 'Terminé'
  };
  const wsProjects = XLSX.utils.json_to_sheet(projects.map(p => ({
    Nom:         p.name,
    Demandeurs:  (p.requesters || []).join(', '),
    Statut:      projectStatusLabels[p.status] || p.status,
    Date_début:  p.startDate ? new Date(p.startDate).toLocaleDateString('fr-FR') : '',
    Date_fin:    p.endDate ? new Date(p.endDate).toLocaleDateString('fr-FR') : '',
    Progression: p.progress + '%',
    Description: p.description || '',
    Archivé_le:  p.archivedAt ? new Date(p.archivedAt).toLocaleDateString('fr-FR') : ''
  })));
  XLSX.utils.book_append_sheet(wb, wsProjects, 'Projets');

  // Export
  XLSX.writeFile(wb, 'TaskMDA_Export.xlsx');
  showToast(`⬇ Export Excel réussi (${tasks.length} tâche(s) + ${projects.length} projet(s))`);
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
  showToast(`✅ La version ${software} ${number} a été enregistrée avec succès`);
}

async function deleteVersion(software) {
  delete versions[software];
  await saveToStorage();
  renderVersionsList();
  showToast(`🗑 La version ${software} a été supprimée avec succès`);
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

// ════════════════════════════════════════════════════════════
//  GESTION DES DEMANDEURS
// ════════════════════════════════════════════════════════════

function openRequestersModal() {
  document.getElementById('requestersOverlay').classList.remove('hidden');
  renderRequestersList();
}

function closeRequestersModal() {
  document.getElementById('requestersOverlay').classList.add('hidden');
  document.getElementById('requesterName').value = '';
  document.getElementById('requesterEmail').value = '';
}

function handleRequestersOverlayClick(e) {
  if (e.target === document.getElementById('requestersOverlay')) closeRequestersModal();
}

async function addRequester() {
  const name = document.getElementById('requesterName').value.trim();
  const email = document.getElementById('requesterEmail').value.trim();

  if (!name) {
    showToast('⚠️ Veuillez saisir un nom');
    return;
  }

  // Check if already exists
  if (config.requesters.some(r => r.name.toLowerCase() === name.toLowerCase())) {
    showToast('⚠️ Ce demandeur existe déjà');
    return;
  }

  config.requesters.push({ name, email: email || '' });
  await saveToStorage();
  renderRequestersList();
  document.getElementById('requesterName').value = '';
  document.getElementById('requesterEmail').value = '';
  showToast(`✅ Le demandeur "${name}" a été ajouté avec succès`);

  // Refresh forms that use requesters
  updateRequesterSelects();
}

async function deleteRequester(name) {
  if (!confirm(`Supprimer le demandeur "${name}" ?\n\nAttention : cela ne supprimera pas les tâches associées.`)) return;

  config.requesters = config.requesters.filter(r => r.name !== name);
  await saveToStorage();
  renderRequestersList();
  showToast(`🗑 Le demandeur "${name}" a été supprimé avec succès`);

  // Refresh forms
  updateRequesterSelects();
}

async function updateRequester(oldName, newName, newEmail) {
  const requester = config.requesters.find(r => r.name === oldName);
  if (!requester) return;

  if (!newName.trim()) {
    showToast('⚠️ Le nom ne peut pas être vide');
    return;
  }

  // Check if new name already exists (but not the same one)
  if (newName !== oldName && config.requesters.some(r => r.name.toLowerCase() === newName.toLowerCase())) {
    showToast('⚠️ Ce nom existe déjà');
    return;
  }

  requester.name = newName.trim();
  requester.email = newEmail.trim();

  await saveToStorage();
  renderRequestersList();
  showToast(`✏️ Le demandeur "${newName}" a été mis à jour avec succès`);

  // Refresh forms
  updateRequesterSelects();
}

function renderRequestersList() {
  const container = document.getElementById('requestersList');
  if (!container) return;

  if (config.requesters.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-on-surface-variant">
        <div class="text-4xl mb-2 opacity-40">👥</div>
        <p class="text-sm">Aucun demandeur enregistré</p>
      </div>`;
    return;
  }

  let html = '<div class="space-y-2">';
  config.requesters.forEach((requester) => {
    html += `
      <div class="bg-surface-container p-4 rounded-xl flex items-center gap-3">
        <div class="flex-1">
          <input type="text"
                 value="${escHtml(requester.name)}"
                 id="req_name_${escHtml(requester.name)}"
                 class="w-full px-3 py-1.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 outline-none font-semibold mb-2">
          <input type="email"
                 value="${escHtml(requester.email || '')}"
                 id="req_email_${escHtml(requester.name)}"
                 placeholder="Email (optionnel)"
                 class="w-full px-3 py-1.5 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm">
        </div>
        <button onclick="updateRequester('${escHtml(requester.name)}', document.getElementById('req_name_${escHtml(requester.name)}').value, document.getElementById('req_email_${escHtml(requester.name)}').value)"
                class="px-3 py-2 bg-primary-gradient text-white rounded-lg font-semibold flex items-center gap-1 text-sm">
          <span class="material-symbols-outlined text-base">save</span>
          Enreg.
        </button>
        <button onclick="deleteRequester('${escHtml(requester.name)}')"
                class="w-9 h-9 flex items-center justify-center hover:bg-error-container hover:text-on-error-container rounded-lg transition-colors">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>`;
  });
  html += '</div>';

  container.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
//  GESTION DES TYPES
// ════════════════════════════════════════════════════════════

function openTypesModal() {
  document.getElementById('typesOverlay').classList.remove('hidden');
  renderTypesList();
}

function closeTypesModal() {
  document.getElementById('typesOverlay').classList.add('hidden');
  document.getElementById('typeName').value = '';
}

function handleTypesOverlayClick(e) {
  if (e.target === document.getElementById('typesOverlay')) closeTypesModal();
}

async function addType() {
  const name = document.getElementById('typeName').value.trim();

  if (!name) {
    showToast('⚠️ Veuillez saisir un type');
    return;
  }

  // Check if already exists
  if (config.types.some(t => t.toLowerCase() === name.toLowerCase())) {
    showToast('⚠️ Ce type existe déjà');
    return;
  }

  config.types.push(name);
  await saveToStorage();
  renderTypesList();
  document.getElementById('typeName').value = '';
  showToast(`✅ Le type "${name}" a été ajouté avec succès`);

  // Refresh forms
  updateTypeSelects();
}

async function deleteType(name) {
  if (!confirm(`Supprimer le type "${name}" ?\n\nAttention : cela ne supprimera pas les tâches associées.`)) return;

  config.types = config.types.filter(t => t !== name);
  await saveToStorage();
  renderTypesList();
  showToast(`🗑 Le type "${name}" a été supprimé avec succès`);

  // Refresh forms
  updateTypeSelects();
}

async function updateType(oldName, newName) {
  const index = config.types.findIndex(t => t === oldName);
  if (index === -1) return;

  if (!newName.trim()) {
    showToast('⚠️ Le nom ne peut pas être vide');
    return;
  }

  // Check if new name already exists (but not the same one)
  if (newName !== oldName && config.types.some(t => t.toLowerCase() === newName.toLowerCase())) {
    showToast('⚠️ Ce nom existe déjà');
    return;
  }

  config.types[index] = newName.trim();

  await saveToStorage();
  renderTypesList();
  showToast(`✏️ Le type "${newName}" a été mis à jour avec succès`);

  // Refresh forms
  updateTypeSelects();
}

function renderTypesList() {
  const container = document.getElementById('typesList');
  if (!container) return;

  if (config.types.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-on-surface-variant">
        <div class="text-4xl mb-2 opacity-40">📋</div>
        <p class="text-sm">Aucun type enregistré</p>
      </div>`;
    return;
  }

  let html = '<div class="space-y-2">';
  config.types.forEach((type) => {
    html += `
      <div class="bg-surface-container p-4 rounded-xl flex items-center gap-3">
        <input type="text"
               value="${escHtml(type)}"
               id="type_${escHtml(type)}"
               class="flex-1 px-3 py-2 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/20 outline-none font-semibold">
        <button onclick="updateType('${escHtml(type)}', document.getElementById('type_${escHtml(type)}').value)"
                class="px-3 py-2 bg-primary-gradient text-white rounded-lg font-semibold flex items-center gap-1">
          <span class="material-symbols-outlined text-base">save</span>
          Enregistrer
        </button>
        <button onclick="deleteType('${escHtml(type)}')"
                class="w-9 h-9 flex items-center justify-center hover:bg-error-container hover:text-on-error-container rounded-lg transition-colors">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>`;
  });
  html += '</div>';

  container.innerHTML = html;
}

// Update datalists in forms when config changes
function updateRequesterSelects() {
  const datalist = document.getElementById('requesterList');
  if (!datalist) return;

  datalist.innerHTML = config.requesters.map(r =>
    `<option value="${escHtml(r.name)}">`
  ).join('');
}

function updateTypeSelects() {
  const datalist = document.getElementById('typeList');
  if (!datalist) return;

  datalist.innerHTML = config.types.map(t =>
    `<option value="${escHtml(t)}">`
  ).join('');
}

// ════════════════════════════════════════════════════════════
//  GESTION DES TEMPLATES D'EMAILS
// ════════════════════════════════════════════════════════════

let currentTemplateType = null; // 'completion' or 'inquiry'

const defaultTemplates = {
  completion: {
    subject: 'Tache realisee : {{TITLE}}',
    body: `Bonjour,

Nous vous informons que la tache suivante a ete realisee :

========================================
TITRE
{{TITLE}}

{{DESCRIPTION}}INFORMATIONS
- Date de demande : {{REQUEST_DATE}}
- Date d'echeance : {{DEADLINE}}
- Date de realisation : {{COMPLETION_DATE}}
- Urgence : {{URGENCY}}
{{TYPE}}{{ORDER}}========================================

Cordialement,
TaskMDA - Gestion de taches`
  },
  inquiry: {
    subject: 'Demande d\'informations : {{TITLE}}',
    body: `Bonjour,

Nous revenons vers vous concernant la tache suivante et aurions besoin de precisions supplementaires :

========================================
TITRE
{{TITLE}}

{{DESCRIPTION}}INFORMATIONS
- Statut : {{STATUS}}
- Date de demande : {{REQUEST_DATE}}
- Date d'echeance : {{DEADLINE}}
- Urgence : {{URGENCY}}
{{TYPE}}{{ORDER}}========================================

Pourriez-vous nous apporter les informations suivantes :

[Votre message ici]

Cordialement,
TaskMDA - Gestion de taches`
  }
};

function openEmailTemplateModal(templateType) {
  currentTemplateType = templateType;

  const titles = {
    completion: 'Template : Email de réalisation',
    inquiry: 'Template : Email de demande d\'informations'
  };

  document.getElementById('emailTemplateTitle').textContent = titles[templateType] || 'Modifier le template';
  document.getElementById('emailTemplateOverlay').classList.remove('hidden');

  // Load current template values
  const template = config.emailTemplates[templateType];
  document.getElementById('templateSubject').value = template.subject;
  document.getElementById('templateBody').value = template.body;
}

function closeEmailTemplateModal() {
  document.getElementById('emailTemplateOverlay').classList.add('hidden');
  currentTemplateType = null;
}

function handleEmailTemplateOverlayClick(e) {
  if (e.target === document.getElementById('emailTemplateOverlay')) {
    closeEmailTemplateModal();
  }
}

async function saveEmailTemplate() {
  if (!currentTemplateType) return;

  const subject = document.getElementById('templateSubject').value.trim();
  const body = document.getElementById('templateBody').value.trim();

  if (!subject || !body) {
    showToast('⚠️ Veuillez remplir l\'objet et le corps de l\'email');
    return;
  }

  // Save to config
  config.emailTemplates[currentTemplateType] = { subject, body };
  await saveToStorage();

  const typeNames = {
    completion: 'réalisation',
    inquiry: 'demande d\'informations'
  };

  showToast(`✅ Le template d'email de ${typeNames[currentTemplateType]} a été enregistré avec succès`);
  closeEmailTemplateModal();
}

async function resetEmailTemplate() {
  if (!currentTemplateType) return;

  if (!confirm('Réinitialiser ce template à sa valeur par défaut ?')) return;

  const defaultTemplate = defaultTemplates[currentTemplateType];

  document.getElementById('templateSubject').value = defaultTemplate.subject;
  document.getElementById('templateBody').value = defaultTemplate.body;

  showToast('🔄 Le template a été réinitialisé (cliquez sur "Enregistrer" pour confirmer)');
}

// Helper function to replace template variables with actual task data
function replaceTemplateVariables(template, task) {
  let text = template;

  // Replace {{TITLE}}
  text = text.replace(/\{\{TITLE\}\}/g, task.title || '');

  // Replace {{DESCRIPTION}} (with conditional display)
  if (task.comment && task.comment.trim()) {
    text = text.replace(/\{\{DESCRIPTION\}\}/g, `DESCRIPTION\n${task.comment}\n\n`);
  } else {
    text = text.replace(/\{\{DESCRIPTION\}\}/g, '');
  }

  // Replace {{REQUEST_DATE}}
  text = text.replace(/\{\{REQUEST_DATE\}\}/g, task.requestDate || 'Non specifiee');

  // Replace {{DEADLINE}}
  text = text.replace(/\{\{DEADLINE\}\}/g, task.deadline || 'Non specifiee');

  // Replace {{COMPLETION_DATE}}
  const completionDate = task.archivedAt ? new Date(task.archivedAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
  text = text.replace(/\{\{COMPLETION_DATE\}\}/g, completionDate);

  // Replace {{URGENCY}}
  const urgencyLabels = { high: 'Haute', medium: 'Moyenne', low: 'Faible' };
  text = text.replace(/\{\{URGENCY\}\}/g, urgencyLabels[task.urgency] || task.urgency || 'Non specifiee');

  // Replace {{STATUS}}
  const statusLabels = { 'en-cours': 'En cours', 'en-attente': 'En attente', 'realise': 'Realisee' };
  text = text.replace(/\{\{STATUS\}\}/g, statusLabels[task.status] || task.status || 'Non specifie');

  // Replace {{TYPE}} (with conditional display)
  if (task.type && task.type.trim()) {
    text = text.replace(/\{\{TYPE\}\}/g, `- Type : ${task.type}\n`);
  } else {
    text = text.replace(/\{\{TYPE\}\}/g, '');
  }

  // Replace {{ORDER}} (with conditional display)
  if (task.order && task.order.trim()) {
    text = text.replace(/\{\{ORDER\}\}/g, `- Reference : ${task.order}\n`);
  } else {
    text = text.replace(/\{\{ORDER\}\}/g, '');
  }

  return text;
}

// ════════════════════════════════════════════════════════════
//  PROJECTS & GANTT CHART
// ════════════════════════════════════════════════════════════

function openProjectModal(id = null) {
  editingProjectId = id;
  const modal = document.getElementById('projectModal');
  const title = document.getElementById('projectModalTitle');
  const archiveBtn = document.getElementById('btnArchiveProject');

  if (id) {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    title.textContent = 'Modifier le projet';
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectStartDate').value = project.startDate;
    document.getElementById('projectEndDate').value = project.endDate;
    document.getElementById('projectProgress').value = project.progress;
    document.getElementById('projectDescription').value = project.description || '';

    // Handle legacy single requester or new multiple requesters
    const requesters = project.requesters || (project.requester ? [project.requester] : []);
    setSelectedRequesters(requesters);

    updateProjectProgressBar();

    // Set active status pill
    document.querySelectorAll('.project-status-pill').forEach(pill => {
      if (pill.dataset.status === project.status) {
        pill.classList.add('bg-primary-fixed', 'text-on-primary-fixed-variant', 'border-primary');
        pill.classList.remove('bg-surface-container', 'text-on-surface-variant', 'border-transparent');
      } else {
        pill.classList.remove('bg-primary-fixed', 'text-on-primary-fixed-variant', 'border-primary');
        pill.classList.add('bg-surface-container', 'text-on-surface-variant', 'border-transparent');
      }
    });

    // Show archive button if not already archived
    if (!project.archivedAt) {
      archiveBtn.classList.remove('hidden');
    } else {
      archiveBtn.classList.add('hidden');
    }
  } else {
    title.textContent = 'Nouveau projet';
    resetProjectForm();
    archiveBtn.classList.add('hidden');
  }

  // Init status pills
  initProjectStatusPills();

  modal.classList.remove('hidden');
}

function closeProjectModal() {
  document.getElementById('projectModal').classList.add('hidden');
  editingProjectId = null;
}

async function archiveProject() {
  if (!editingProjectId) return;

  const project = projects.find(p => p.id === editingProjectId);
  if (!project || project.archivedAt) return;

  // Archive the project
  const projectName = project.name;
  project.archivedAt = new Date().toISOString();

  await saveToStorage();
  closeProjectModal();
  updateProjectCount();
  renderGanttChart();
  renderProjectCards();
  showToast(`📦 Le projet "${projectName}" a été archivé avec succès`);
}

async function restoreProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project || !project.archivedAt) return;

  // Restaurer le projet : supprimer archivedAt
  projects = projects.map(p => p.id === id ? { ...p, archivedAt: null, updatedAt: new Date().toISOString() } : p);

  await saveToStorage();
  updateProjectCount();

  showToast(`♻️ Le projet "${project.name}" a été restauré avec succès`);

  // Refresh current view
  if (activeView === 'archives') {
    renderArchives();
  } else if (activeView === 'projects') {
    renderGanttChart();
  }
}

async function quickArchiveProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project || project.archivedAt) return;

  if (!confirm(`Archiver le projet "${project.name}" ?\n\nVous pourrez le restaurer depuis l'onglet Archives.`)) return;

  // Archive the project
  const projectName = project.name;
  project.archivedAt = new Date().toISOString();

  await saveToStorage();
  updateProjectCount();

  // Refresh current view
  if (activeView === 'dashboard') {
    renderDashboard();
  } else if (activeView === 'projects') {
    renderGanttChart();
    renderProjectCards();
  }

  showToast(`📦 Le projet "${projectName}" a été archivé avec succès`);
}

async function deleteProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;

  if (!confirm(`⚠️ ATTENTION : Supprimer définitivement le projet "${project.name}" ?\n\nCette action est irréversible !`)) return;

  const projectName = project.name;
  projects = projects.filter(p => p.id !== id);

  await saveToStorage();
  updateProjectCount();

  showToast(`🗑️ Le projet "${projectName}" a été supprimé définitivement`);

  // Refresh current view
  if (activeView === 'dashboard') {
    renderDashboard();
  } else if (activeView === 'archives') {
    renderArchives();
  } else if (activeView === 'projects') {
    renderGanttChart();
    renderProjectCards();
  }
}

function resetProjectForm() {
  document.getElementById('projectName').value = '';
  document.getElementById('projectStartDate').value = '';
  document.getElementById('projectEndDate').value = '';
  document.getElementById('projectProgress').value = 0;
  document.getElementById('projectDescription').value = '';
  updateProjectProgressBar();

  // Reset status pills
  document.querySelectorAll('.project-status-pill').forEach((pill, idx) => {
    if (idx === 0) {
      pill.classList.add('bg-primary-fixed', 'text-on-primary-fixed-variant', 'border-primary');
      pill.classList.remove('bg-surface-container', 'text-on-surface-variant', 'border-transparent');
    } else {
      pill.classList.remove('bg-primary-fixed', 'text-on-primary-fixed-variant', 'border-primary');
      pill.classList.add('bg-surface-container', 'text-on-surface-variant', 'border-transparent');
    }
  });

  // Reset requester pills
  setSelectedRequesters([]);
}

function initProjectStatusPills() {
  // Status pills (single selection)
  document.querySelectorAll('.project-status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.project-status-pill').forEach(p => {
        p.classList.remove('bg-primary-fixed', 'text-on-primary-fixed-variant', 'border-primary');
        p.classList.add('bg-surface-container', 'text-on-surface-variant', 'border-transparent');
      });
      pill.classList.add('bg-primary-fixed', 'text-on-primary-fixed-variant', 'border-primary');
      pill.classList.remove('bg-surface-container', 'text-on-surface-variant', 'border-transparent');
    });
  });

  // Requester pills (multiple selection)
  document.querySelectorAll('.requester-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('bg-primary');
      pill.classList.toggle('text-white');
      pill.classList.toggle('border-primary');
      pill.classList.toggle('bg-surface-container');
      pill.classList.toggle('text-on-surface-variant');
      updateSelectedRequestersDisplay();
    });
  });
}

function updateSelectedRequestersDisplay() {
  const container = document.getElementById('selectedRequesters');
  const selectedPills = document.querySelectorAll('.requester-pill.bg-primary');

  if (selectedPills.length === 0) {
    container.innerHTML = '<span class="text-sm text-on-surface-variant">Aucun demandeur sélectionné</span>';
  } else {
    container.innerHTML = '';
    selectedPills.forEach(pill => {
      const badge = document.createElement('span');
      badge.className = 'px-3 py-1 bg-primary text-white rounded-full text-xs font-semibold flex items-center gap-1.5';
      badge.innerHTML = `
        ${pill.dataset.requester}
        <button type="button" class="hover:bg-primary-container/20 rounded-full p-0.5 transition-colors" onclick="event.stopPropagation(); removeRequester('${pill.dataset.requester}')">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      `;
      container.appendChild(badge);
    });
  }
}

function removeRequester(requester) {
  const pill = document.querySelector(`.requester-pill[data-requester="${requester}"]`);
  if (pill) {
    pill.classList.remove('bg-primary', 'text-white', 'border-primary');
    pill.classList.add('bg-surface-container', 'text-on-surface-variant');
    updateSelectedRequestersDisplay();
  }
}

function getSelectedRequesters() {
  const selectedPills = document.querySelectorAll('.requester-pill.bg-primary');
  return Array.from(selectedPills).map(pill => pill.dataset.requester);
}

function setSelectedRequesters(requesters) {
  // Reset all pills
  document.querySelectorAll('.requester-pill').forEach(pill => {
    pill.classList.remove('bg-primary', 'text-white', 'border-primary');
    pill.classList.add('bg-surface-container', 'text-on-surface-variant');
  });

  // Select specified requesters
  if (requesters && requesters.length > 0) {
    requesters.forEach(req => {
      const pill = document.querySelector(`.requester-pill[data-requester="${req}"]`);
      if (pill) {
        pill.classList.add('bg-primary', 'text-white', 'border-primary');
        pill.classList.remove('bg-surface-container', 'text-on-surface-variant');
      }
    });
  }

  updateSelectedRequestersDisplay();
}

function getSelectedProjectStatus() {
  const selected = document.querySelector('.project-status-pill.bg-primary-fixed');
  return selected ? selected.dataset.status : 'en-cours';
}

function updateProjectProgressBar() {
  const value = document.getElementById('projectProgress').value;
  const bar = document.getElementById('projectProgressBar');
  if (bar) bar.style.width = `${value}%`;
}

async function submitProjectForm() {
  const name = document.getElementById('projectName').value.trim();
  const startDate = document.getElementById('projectStartDate').value;
  const endDate = document.getElementById('projectEndDate').value;
  const progress = parseInt(document.getElementById('projectProgress').value) || 0;
  const description = document.getElementById('projectDescription').value.trim();
  const requesters = getSelectedRequesters();
  const status = getSelectedProjectStatus();

  // Validation du nom
  if (!name) {
    const nameInput = document.getElementById('projectName');
    shake(nameInput);
    showToast('⚠️ Le nom du projet est obligatoire');
    nameInput.focus();
    return;
  }

  // Validation de la date de début
  if (!startDate) {
    const startDateInput = document.getElementById('projectStartDate');
    shake(startDateInput);
    showToast('⚠️ La date de début est obligatoire');
    startDateInput.focus();
    return;
  }

  // Validation de la date de fin
  if (!endDate) {
    const endDateInput = document.getElementById('projectEndDate');
    shake(endDateInput);
    showToast('⚠️ La date de fin est obligatoire');
    endDateInput.focus();
    return;
  }

  // Validation de la cohérence des dates
  if (new Date(endDate) < new Date(startDate)) {
    const endDateInput = document.getElementById('projectEndDate');
    shake(endDateInput);
    showToast('⚠️ La date de fin doit être après la date de début');
    endDateInput.focus();
    return;
  }

  // Validation des demandeurs
  if (!requesters || requesters.length === 0) {
    showToast('⚠️ Veuillez sélectionner au moins un demandeur');
    return;
  }

  const now = new Date().toISOString();

  if (editingProjectId) {
    projects = projects.map(p => p.id === editingProjectId
      ? { ...p, name, startDate, endDate, progress, description, requesters, status, updatedAt: now }
      : p
    );
    showToast(`✏️ Le projet "${name}" a été modifié avec succès`);
  } else {
    projects.push({
      id: Date.now(),
      name,
      startDate,
      endDate,
      progress,
      description,
      requesters,
      status,
      createdAt: now,
      updatedAt: now
    });
    showToast(`✅ Le projet "${name}" a été créé avec succès`);
  }

  await saveToStorage();
  updateProjectCount();

  // Refresh current view
  if (activeView === 'dashboard') {
    renderDashboard();
  } else if (activeView === 'projects') {
    renderGanttChart();
    renderProjectCards();
  }

  closeProjectModal();
}

function updateProjectCount() {
  const activeProjects = getActiveProjects().filter(p => p.status !== 'termine');
  const countEl = document.getElementById('projectCount');
  if (countEl) countEl.textContent = activeProjects.length;

  // Update archive count to include both tasks and projects
  const archivedTasks = getArchivedTasks().length;
  const archivedProjects = getArchivedProjects().length;
  const archiveCountEl = document.getElementById('archiveCount');
  if (archiveCountEl) archiveCountEl.textContent = archivedTasks + archivedProjects;
}

function setGanttViewMode(mode) {
  ganttViewMode = mode;

  // Update button states
  const monthBtn = document.getElementById('viewMonth');
  const weeksBtn = document.getElementById('viewWeeks');

  if (mode === 'month') {
    monthBtn.classList.add('bg-primary', 'text-white');
    monthBtn.classList.remove('text-on-surface-variant', 'hover:bg-surface-container');
    weeksBtn.classList.remove('bg-primary', 'text-white');
    weeksBtn.classList.add('text-on-surface-variant', 'hover:bg-surface-container');
  } else {
    weeksBtn.classList.add('bg-primary', 'text-white');
    weeksBtn.classList.remove('text-on-surface-variant', 'hover:bg-surface-container');
    monthBtn.classList.remove('bg-primary', 'text-white');
    monthBtn.classList.add('text-on-surface-variant', 'hover:bg-surface-container');
  }

  renderGanttChart();
}

function renderGanttChart() {
  const container = document.getElementById('ganttChart');
  if (!container) return;

  let activeProjects = getActiveProjects();

  // Apply search filter
  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  if (searchQuery) {
    activeProjects = activeProjects.filter(p => {
      const matchName = p.name?.toLowerCase().includes(searchQuery);
      const matchDescription = p.description?.toLowerCase().includes(searchQuery);
      const matchRequesters = p.requesters?.some(r => r.toLowerCase().includes(searchQuery));
      const matchStatus = p.status?.toLowerCase().includes(searchQuery);
      return matchName || matchDescription || matchRequesters || matchStatus;
    });
  }

  if (activeProjects.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 px-4">
        <span class="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block opacity-40">folder_open</span>
        <p class="text-lg font-semibold text-on-surface mb-2">Aucun projet</p>
        <p class="text-on-surface-variant">Créez votre premier projet pour commencer</p>
      </div>
    `;
    return;
  }

  // Calculate timeline range
  const allDates = activeProjects.flatMap(p => [new Date(p.startDate), new Date(p.endDate)]);
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));

  // Extend range to show full context
  if (ganttViewMode === 'month') {
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 1);
  } else {
    minDate.setDate(minDate.getDate() - 14); // 2 weeks before
    maxDate.setDate(maxDate.getDate() + 14); // 2 weeks after
  }

  const timeLabels = ganttViewMode === 'month'
    ? getMonthsBetween(minDate, maxDate)
    : getWeeksBetween(minDate, maxDate);

  // Build HTML with responsive grid
  const totalColumns = timeLabels.length;
  let html = '';

  // Header row with time labels (months or weeks)
  if (ganttViewMode === 'month') {
    // Mode MOIS : affichage simple sur une ligne
    html += '<div class="flex border-b border-surface-container overflow-hidden">';
    html += '<div class="w-48 lg:w-64 p-3 lg:p-4 font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-r border-surface-container shrink-0">Nom du projet</div>';
    html += '<div class="flex-1 grid border-l border-surface-container/30" style="grid-template-columns: repeat(' + totalColumns + ', minmax(0, 1fr));">';
    timeLabels.forEach(label => {
      html += `<div class="p-2 lg:p-4 font-label text-[9px] lg:text-[10px] font-bold text-on-surface-variant text-center border-r border-surface-container/30 last:border-r-0">${label}</div>`;
    });
    html += '</div>';
    html += '</div>';
  } else {
    // Mode SEMAINES : affichage sur deux lignes (mois + semaines)
    // Ligne 1 : Les mois (avec fusion des colonnes pour chaque mois)
    html += '<div class="flex border-b border-surface-container/50 overflow-hidden">';
    html += '<div class="w-48 lg:w-64 font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-r border-surface-container shrink-0"></div>';
    html += '<div class="flex-1 flex border-l border-surface-container/30">';

    // Grouper les semaines par mois
    let currentMonthLabel = null;
    let currentMonthSpan = 0;

    timeLabels.forEach((weekData, index) => {
      if (weekData.monthLabel !== currentMonthLabel) {
        // Afficher le mois précédent si nécessaire
        if (currentMonthLabel !== null) {
          html += `<div class="p-2 lg:p-3 font-label text-[9px] lg:text-[10px] font-bold text-on-surface-variant text-center border-r border-surface-container/30 bg-surface-container/30" style="flex: 0 0 ${(100 / totalColumns) * currentMonthSpan}%;">${currentMonthLabel}</div>`;
        }
        // Commencer un nouveau mois
        currentMonthLabel = weekData.monthLabel;
        currentMonthSpan = 1;
      } else {
        currentMonthSpan++;
      }

      // Dernier élément : afficher le mois en cours
      if (index === timeLabels.length - 1) {
        html += `<div class="p-2 lg:p-3 font-label text-[9px] lg:text-[10px] font-bold text-on-surface-variant text-center border-r-0 bg-surface-container/30" style="flex: 0 0 ${(100 / totalColumns) * currentMonthSpan}%;">${currentMonthLabel}</div>`;
      }
    });

    html += '</div>';
    html += '</div>';

    // Ligne 2 : Les numéros de semaines
    html += '<div class="flex border-b border-surface-container overflow-hidden">';
    html += '<div class="w-48 lg:w-64 p-3 lg:p-4 font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-r border-surface-container shrink-0">Nom du projet</div>';
    html += '<div class="flex-1 grid border-l border-surface-container/30" style="grid-template-columns: repeat(' + totalColumns + ', minmax(0, 1fr));">';
    timeLabels.forEach(weekData => {
      html += `<div class="p-2 lg:p-4 font-label text-[9px] lg:text-[10px] font-bold text-on-surface-variant text-center border-r border-surface-container/30 last:border-r-0">S${weekData.weekNumber}</div>`;
    });
    html += '</div>';
    html += '</div>';
  }

  // Project rows (wrapped in divide-y container)
  html += '<div class="divide-y divide-surface-container">';

  activeProjects.forEach(project => {
    const statusColors = {
      'en-cours': { bg: '#006c4a', bgGradient: 'linear-gradient(135deg, #006c4a 0%, #3fb687 100%)', text: '#ffffff', label: 'EN COURS', dot: '#006c4a', bar: '#006c4a' },
      'planifie': { bg: '#6366f1', bgGradient: '#6366f1', text: '#ffffff', label: 'PLANIFIÉ', dot: '#6366f1', bar: '#6366f1' },
      'urgent': { bg: '#ef4444', bgGradient: '#ef4444', text: '#ffffff', label: 'URGENT', dot: '#ef4444', bar: '#ef4444' },
      'termine': { bg: '#9ca3af', bgGradient: '#9ca3af', text: '#ffffff', label: 'TERMINÉ', dot: '#9ca3af', bar: '#9ca3af' }
    };

    const color = statusColors[project.status] || statusColors['en-cours'];

    html += '<div class="flex group hover:bg-surface-container-low transition-colors duration-200 overflow-hidden">';

    // Project name column with vertical colored bar
    const requesters = project.requesters || (project.requester ? [project.requester] : []);
    const requesterBadges = requesters.map(req =>
      `<span class="text-[8px] lg:text-[10px] px-1.5 lg:px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant font-semibold">${escHtml(req)}</span>`
    ).join('');

    html += `
      <div class="w-48 lg:w-64 p-3 lg:p-6 border-r border-surface-container shrink-0 relative">
        <div class="absolute left-0 top-0 bottom-0 w-1" style="background-color: ${color.bar}"></div>

        <!-- Action buttons on hover (top right) -->
        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
          <button onclick="openProjectModal(${project.id})" title="Modifier le projet" class="p-1 hover:bg-surface-container rounded-lg transition-colors">
            <span class="material-symbols-outlined text-sm text-on-surface-variant">edit</span>
          </button>
          <button onclick="quickArchiveProject(${project.id})" title="Archiver le projet" class="p-1 hover:bg-surface-container rounded-lg transition-colors">
            <span class="material-symbols-outlined text-sm text-on-surface-variant">archive</span>
          </button>
          <button onclick="deleteProject(${project.id})" title="Supprimer le projet" class="p-1 hover:bg-error-container rounded-lg transition-colors">
            <span class="material-symbols-outlined text-sm text-error">delete</span>
          </button>
        </div>

        <h4 class="font-headline font-bold text-on-surface mb-1 text-sm lg:text-base truncate pr-24" title="${escHtml(project.name)}">${escHtml(project.name)}</h4>
        <div class="flex items-center gap-2 mb-1">
          <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${color.dot}"></span>
          <span class="text-[10px] lg:text-[11px] font-medium text-on-surface-variant uppercase tracking-tighter">${color.label}</span>
        </div>
        <div class="flex flex-wrap gap-1">${requesterBadges}</div>
      </div>
    `;

    // Timeline column with responsive grid
    html += '<div class="flex-1 relative h-20 lg:h-24 py-6 lg:py-8 grid" style="grid-template-columns: repeat(' + totalColumns + ', minmax(0, 1fr));">';
    const bar = calculateBarPosition(project, minDate, maxDate, timeLabels.length);
    const barStyle = project.status === 'en-cours'
      ? `background: ${color.bgGradient}`
      : `background-color: ${color.bg}`;

    html += `
      <div class="absolute h-6 lg:h-8 rounded-full flex items-center justify-center px-2 lg:px-4 shadow-sm cursor-pointer transition-all hover:shadow-md col-span-full"
           style="left: ${bar.left}%; width: ${bar.width}%; ${barStyle}; color: ${color.text}; top: 50%; transform: translateY(-50%);"
           onclick="openProjectModal(${project.id})"
           title="${escHtml(project.name)} - ${project.progress}%">
        <span class="text-[10px] lg:text-[11px] font-bold">${project.progress}%</span>
      </div>
    `;
    html += '</div>';

    html += '</div>';
  });

  html += '</div>';
  container.innerHTML = html;

  // Render mobile card view
  renderProjectCards();
}

function renderProjectCards() {
  const container = document.getElementById('projectCardList');
  if (!container) return;

  let activeProjects = getActiveProjects();

  // Apply search filter
  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  if (searchQuery) {
    activeProjects = activeProjects.filter(p => {
      const matchName = p.name?.toLowerCase().includes(searchQuery);
      const matchDescription = p.description?.toLowerCase().includes(searchQuery);
      const matchRequesters = p.requesters?.some(r => r.toLowerCase().includes(searchQuery));
      const matchStatus = p.status?.toLowerCase().includes(searchQuery);
      return matchName || matchDescription || matchRequesters || matchStatus;
    });
  }

  if (activeProjects.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 px-4">
        <span class="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block opacity-40">folder_open</span>
        <p class="text-lg font-semibold text-on-surface mb-2">Aucun projet</p>
        <p class="text-on-surface-variant">Créez votre premier projet pour commencer</p>
      </div>
    `;
    return;
  }

  const statusColors = {
    'en-cours': { bg: 'bg-[#006c4a]', text: 'text-white', label: 'EN COURS', dot: '#006c4a' },
    'planifie': { bg: 'bg-[#6366f1]', text: 'text-white', label: 'PLANIFIÉ', dot: '#6366f1' },
    'urgent': { bg: 'bg-[#ef4444]', text: 'text-white', label: 'URGENT', dot: '#ef4444' },
    'termine': { bg: 'bg-[#9ca3af]', text: 'text-white', label: 'TERMINÉ', dot: '#9ca3af' }
  };

  let html = '';
  activeProjects.forEach(project => {
    const color = statusColors[project.status] || statusColors['en-cours'];
    const startDate = new Date(project.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const endDate = new Date(project.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

    // Calculate days remaining
    const today = new Date();
    const end = new Date(project.endDate);
    const daysRemaining = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    const daysText = daysRemaining > 0 ? `${daysRemaining} jours restants` : `Échéance dépassée de ${Math.abs(daysRemaining)} jours`;
    const daysColor = daysRemaining > 0 ? 'text-on-surface-variant' : 'text-error';

    html += `
      <div class="bg-surface-container-low rounded-2xl p-4 shadow-sm hover:shadow-md transition-all" onclick="openProjectModal(${project.id})">
        <!-- Header -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <h3 class="font-bold text-on-surface text-lg mb-2">${escHtml(project.name)}</h3>
            <div class="flex items-center gap-2 flex-wrap">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" style="background-color: ${color.dot}"></span>
                <span class="text-xs font-semibold" style="color: ${color.dot}">${color.label}</span>
              </div>
              ${(project.requesters || (project.requester ? [project.requester] : [])).map(req =>
                `<span class="text-xs px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant font-semibold">${escHtml(req)}</span>`
              ).join('')}
            </div>
          </div>
          <button onclick="event.stopPropagation(); openProjectModal(${project.id})" class="p-2 hover:bg-surface-container rounded-lg transition-colors">
            <span class="material-symbols-outlined text-lg text-on-surface-variant">edit</span>
          </button>
        </div>

        <!-- Dates -->
        <div class="flex items-center gap-4 mb-3 text-sm">
          <div class="flex items-center gap-1.5 text-on-surface-variant">
            <span class="material-symbols-outlined text-base">event</span>
            <span>${startDate} → ${endDate}</span>
          </div>
        </div>

        <!-- Days remaining -->
        <div class="mb-3 text-sm ${daysColor} font-medium">
          ${daysText}
        </div>

        <!-- Progress Bar -->
        <div class="mb-2">
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="text-on-surface-variant font-medium">Progression</span>
            <span class="font-bold text-on-surface">${project.progress}%</span>
          </div>
          <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden">
            <div class="${color.bg} h-full rounded-full transition-all" style="width: ${project.progress}%"></div>
          </div>
        </div>

        ${project.description ? `
        <div class="mt-3 pt-3 border-t border-surface-container">
          <p class="text-sm text-on-surface-variant line-clamp-2">${escHtml(project.description)}</p>
        </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

function getMonthsBetween(start, end) {
  const months = [];
  const monthNames = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];

  const current = new Date(start);
  const currentYear = new Date().getFullYear();
  const spansMultipleYears = start.getFullYear() !== end.getFullYear();

  while (current <= end) {
    const monthName = monthNames[current.getMonth()];
    const year = current.getFullYear();

    // Show year if: timeline spans multiple years OR project year is not current year
    if (spansMultipleYears || year !== currentYear) {
      months.push(`${monthName} ${year}`);
    } else {
      months.push(monthName);
    }

    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

function getWeeksBetween(start, end) {
  const weeks = [];
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  // Start from the Monday of the week containing start date
  const current = new Date(start);
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  current.setDate(diff);

  const currentYear = new Date().getFullYear();
  const spansMultipleYears = start.getFullYear() !== end.getFullYear();

  let lastMonth = -1;
  let lastYear = -1;
  let weekInMonth = 0;

  while (current <= end) {
    const currentMonth = current.getMonth();
    const month = monthNames[currentMonth];
    const year = current.getFullYear();

    // Check if month/year changed
    if (currentMonth !== lastMonth || year !== lastYear) {
      weekInMonth = 1;
      lastMonth = currentMonth;
      lastYear = year;
    } else {
      weekInMonth++;
    }

    // Store week data with month and year info
    const weekData = {
      month: currentMonth,
      year: year,
      monthLabel: (spansMultipleYears || year !== currentYear) ? `${month} ${year}` : month,
      weekNumber: weekInMonth
    };

    weeks.push(weekData);

    current.setDate(current.getDate() + 7); // Next week
  }

  return weeks;
}

function calculateBarPosition(project, minDate, maxDate, totalMonths) {
  const projectStart = new Date(project.startDate);
  const projectEnd = new Date(project.endDate);

  const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
  const startDays = (projectStart - minDate) / (1000 * 60 * 60 * 24);
  const durationDays = (projectEnd - projectStart) / (1000 * 60 * 60 * 24);

  const left = (startDays / totalDays) * 100;
  const width = (durationDays / totalDays) * 100;

  return { left: Math.max(0, left), width: Math.min(100 - left, width) };
}
