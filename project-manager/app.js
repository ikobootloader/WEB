// ..............................................................
//  GESTIONNAIRE DE PROJETS ?" app.js
//  Stockage : IndexedDB + AES-256-GCM (Web Crypto API native)
//  + File System Access API (sauvegarde automatique sur disque)
// ..............................................................

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

// "?"? ?tat global "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
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
{{SUJET}}{{ORDER}}========================================

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
{{SUJET}}{{ORDER}}========================================

Pourriez-vous nous apporter les informations suivantes :

[Votre message ici]


Cordialement,
TaskMDA - Gestion de taches`
    }
  },
  appearance: {       // Préférences d'apparence
    darkMode: false,
    highContrast: false
  },
  emailSignature: {   // Signature email personnalisable
    text: '',
    image: null       // { data: base64, type: mime, name: filename }
  },
  branding: {         // Personnalisation de l'identité
    appName: 'TaskMDA',
    appTagline: 'Gestion de Projets'
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
let isMarkingCompleted = false; // Protection contre les doubles clics sur "Marquer réalisé"
let isSaving = false; // Protection contre les sauvegardes simultanées
let ganttViewMode = 'month'; // 'week' | 'month' | 'quarter'

// ............................................................
//  D?MARRAGE
// ............................................................

window.addEventListener('DOMContentLoaded', async () => {
  initUI();
  initEventListeners();

  // Initialize IndexedDB
  await initDB();

  // Initialize FSA database
  await initFSADB();

  // Migrate from localStorage if needed
  await migrateFromLocalStorage();

  // Check if data exists in IndexedDB
  const hasSavedData = !!(await idbGet('salt'));

  // Marquer l'app comme chargée pour masquer le loader et afficher le lock screen
  document.body.classList.add('app-loaded');

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
  applyAppearanceSettings();
  updateAppBranding();  // Apply custom app name and tagline
  initProjectStatusPills();
  checkBackupReminder();
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
  document.getElementById('btnChangePassword')?.addEventListener('click', openChangePasswordModal);
  document.getElementById('btnLockApp')?.addEventListener('click', lockApp);
  document.getElementById('btnClearAll')?.addEventListener('click', clearAllTasks);

  // Security question dropdown - show/hide custom question field
  document.getElementById('lockSecurityQuestion')?.addEventListener('change', (e) => {
    const customWrap = document.getElementById('customQuestionWrap');
    if (customWrap) {
      if (e.target.value === 'custom') {
        customWrap.classList.remove('hidden');
      } else {
        customWrap.classList.add('hidden');
      }
    }
  });

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
    // Mettre à jour les champs spécifiques (hebdo/mensuel) si activé
    if (e.target.checked) {
      updateRecurringFields();
    }
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

  // Multi-select for Requesters and Types
  document.querySelectorAll('.requester-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const selected = Array.from(document.querySelectorAll('.requester-checkbox:checked')).map(cb => cb.value);
      document.getElementById('taskRequester').value = selected.join(', ');
    });
  });

  document.querySelectorAll('.type-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const selected = Array.from(document.querySelectorAll('.type-checkbox:checked')).map(cb => cb.value);
      document.getElementById('taskType').value = selected.join(', ');
    });
  });

  // Mobile menu
  document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleMobileMenu);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeMobileMenu);

  // Projects events
  document.getElementById('btnNewProject')?.addEventListener('click', () => openProjectModal());
  document.getElementById('btnSaveProject')?.addEventListener('click', submitProjectForm);
  document.getElementById('btnArchiveProject')?.addEventListener('click', archiveProject);
  document.getElementById('viewQuarter')?.addEventListener('click', () => setGanttViewMode('quarter'));
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

// ............................................................
//  MOBILE MENU
// ............................................................

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

// ............................................................
//  SIDEBAR COUNTS UPDATE
// ............................................................

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

// ............................................................
//  NAVIGATION PAR VUES
// ............................................................

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
  else if (view === 'settings') {
    loadEmailSignature();
    loadAppBrandingSettings();
  }
}

// ............................................................
//  RENDU DASHBOARD
// ............................................................

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
        <div class="col-span-full text-center py-12">
          <span class="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block opacity-40">folder_open</span>
          <p class="text-on-surface-variant text-base">Aucun projet actif</p>
          <p class="text-on-surface-variant text-sm mt-2">Créez votre premier projet pour commencer</p>
        </div>
      `;
    } else {
      projectsContainer.innerHTML = '';
      activeProjects.forEach(project => {
        // Enhanced colors for WCAG AA compliance
        const statusColors = {
          'en-cours': { bg: '#0891b2', label: 'EN COURS', dot: '#0891b2', border: '#0891b2' },
          'planifie': { bg: '#6366f1', label: 'PLANIFIÉ', dot: '#6366f1', border: '#6366f1' },
          'urgent': { bg: '#dc2626', label: 'URGENT', dot: '#dc2626', border: '#dc2626' }
        };
        const color = statusColors[project.status] || statusColors['en-cours'];

        const endDate = new Date(project.endDate);
        const today = new Date();
        const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        const card = document.createElement('div');
        card.className = 'bg-surface-container-low rounded-xl p-4 border-l-[5px] hover:shadow-md transition-all cursor-pointer group relative';
        card.style.borderLeft = `5px solid ${color.border}`;
        card.style.borderBottom = '1px solid rgba(0, 0, 0, 0.1)';
        card.style.borderRight = '1px solid rgba(0, 0, 0, 0.1)';
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
        <span class="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block opacity-40">inbox</span>
        <p class="text-on-surface-variant text-base">Aucune tâche à afficher</p>
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

      // Update active state and icon colors
      document.querySelectorAll('.filter-btn').forEach(b => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);

        // Get the icon inside the button
        const icon = b.querySelector('.material-symbols-outlined');
        if (icon) {
          if (isActive) {
            // Force icon color to white when active
            icon.style.setProperty('color', 'white', 'important');
          } else {
            // Restore original icon color based on urgency
            const colors = { low: '#16a34a', medium: '#f59e0b', high: '#ef4444' };
            const filter = b.dataset.filter;
            if (colors[filter]) {
              icon.style.setProperty('color', colors[filter], 'important');
            }
          }
        }
      });

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

// ............................................................
//  ?CRAN DE VERROUILLAGE
// ............................................................

function showLockScreen(mode) {
  const screen = document.getElementById('lockScreen');
  screen.dataset.mode = mode;
  document.getElementById('lockError').textContent = '';
  document.getElementById('lockPassword').value    = '';
  document.getElementById('lockConfirm').value     = '';

  const lockBtn = document.getElementById('lockBtn');
  const lockIcon = lockBtn.querySelector('.material-symbols-outlined');
  const lockText = lockBtn.querySelector('span:last-child');

  // Show/hide security question fields based on mode
  const securityWrap = document.getElementById('lockSecurityWrap');
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');

  if (mode === 'create') {
    document.getElementById('lockTitle').textContent = 'Créer un mot de passe';
    document.getElementById('lockSub').textContent   = 'Vos données seront chiffrées (AES-256-GCM). Sans ce mot de passe, elles sont illisibles.';
    document.getElementById('lockConfirmWrap').classList.remove('hidden');
    if (securityWrap) securityWrap.classList.remove('hidden');
    if (forgotPasswordLink) forgotPasswordLink.classList.add('hidden');
    if (lockIcon) lockIcon.textContent = 'lock_open';
    if (lockText) lockText.textContent = 'Créer & déverrouiller';
  } else {
    document.getElementById('lockTitle').textContent = 'Déverrouiller';
    document.getElementById('lockSub').textContent   = 'Entrez votre mot de passe pour déchiffrer vos données localement.';
    document.getElementById('lockConfirmWrap').classList.add('hidden');
    if (securityWrap) securityWrap.classList.add('hidden');
    if (forgotPasswordLink) forgotPasswordLink.classList.remove('hidden');
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

  // Validate security question in create mode
  if (mode === 'create') {
    const securityQuestion = document.getElementById('lockSecurityQuestion').value;
    const customQuestion = document.getElementById('lockCustomQuestion').value;
    const securityAnswer = document.getElementById('lockSecurityAnswer').value;

    if (!securityQuestion) {
      err.textContent = 'Veuillez choisir une question de sécurité.';
      shake(document.getElementById('lockSecurityQuestion'));
      return;
    }

    if (securityQuestion === 'custom' && !customQuestion.trim()) {
      err.textContent = 'Veuillez saisir votre question personnalisée.';
      shake(document.getElementById('lockCustomQuestion'));
      return;
    }

    if (!securityAnswer.trim()) {
      err.textContent = 'Veuillez fournir une réponse à la question de sécurité.';
      shake(document.getElementById('lockSecurityAnswer'));
      return;
    }
  }

  btn.disabled = true;
  const btnText = btn.querySelector('span:last-child');
  if (btnText) btnText.textContent = 'Chargement...';

  try {
    if (mode === 'create') {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      await idbSet('salt', bufToHex(salt));
      cryptoKey = await deriveKey(pwd, salt);

      // Store security question and hashed answer
      const securityQuestion = document.getElementById('lockSecurityQuestion').value;
      const customQuestion = document.getElementById('lockCustomQuestion').value;
      const securityAnswer = document.getElementById('lockSecurityAnswer').value;

      const questionToStore = securityQuestion === 'custom' ? customQuestion : securityQuestion;
      const answerHash = await hashSecurityAnswer(securityAnswer);

      await idbSet('securityQuestion', questionToStore);
      await idbSet('securityAnswerHash', answerHash);

      tasks = window.initialTasks || [];
      await saveToStorage();
    } else {
      const saltHex = await idbGet('salt');
      if (!saltHex) { err.textContent = 'Données corrompues (sel manquant).'; return; }
      cryptoKey = await deriveKey(pwd, hexToBuf(saltHex));
      await loadFromStorage();
    }

    // Hide lock screen and show main content
    const screen = document.getElementById('lockScreen');
    screen.classList.add('hidden');
    screen.classList.remove('flex');
    document.body.classList.add('auth-verified');

    // Initialize custom lists in forms
    updateRequesterSelects();
    updateTypeSelects();

    // Update sidebar counts and notification badge
    updateSidebarCounts();

    // Show dashboard
    switchView('dashboard');

    // Initialize notification system
    initNotificationSystem();

    // Check and restore folder connection (after successful unlock)
    await checkFolderConnection();

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
  if (!newPwd || newPwd.length < 4) { showToast('Trop court'); return; }
  if (prompt('Confirmer :') !== newPwd) { showToast('Ne correspond pas'); return; }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await idbSet('salt', bufToHex(salt));
  cryptoKey = await deriveKey(newPwd, salt);
  await saveToStorage();
  showToast('Le mot de passe a été changé avec succès');
}

// ............................................................
//  PASSWORD RECOVERY SYSTEM
// ............................................................

// Hash security answer for secure storage
async function hashSecurityAnswer(answer) {
  const normalized = answer.trim().toLowerCase(); // Normalize for case-insensitive comparison
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(new Uint8Array(hashBuffer));
}

// Show password recovery modal
async function showPasswordRecovery() {
  const securityQuestion = await idbGet('securityQuestion');

  if (!securityQuestion) {
    showToast('Aucune question de sécurité configurée.');
    return;
  }

  const modal = document.getElementById('recoveryModal');
  const questionDisplay = document.getElementById('recoveryQuestionDisplay');

  // Map predefined questions to their display text
  const questionMap = {
    'city': 'Dans quelle ville êtes-vous né(e) ?',
    'pet': 'Quel était le nom de votre premier animal de compagnie ?',
    'school': 'Quel était le nom de votre école primaire ?',
    'teacher': 'Quel était le nom de votre premier enseignant ?',
    'street': 'Dans quelle rue avez-vous grandi ?'
  };

  questionDisplay.textContent = questionMap[securityQuestion] || securityQuestion;

  // Reset modal state
  document.getElementById('recoveryStep1').classList.remove('hidden');
  document.getElementById('recoveryStep2').classList.add('hidden');
  document.getElementById('securityAnswer').value = '';
  document.getElementById('recoveryError').textContent = '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    document.getElementById('securityAnswer').focus();

    // Add Enter key listener to security answer field
    const answerField = document.getElementById('securityAnswer');
    answerField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifySecurityAnswer();
      }
    });
  }, 150);
}

function closeRecoveryModal() {
  const modal = document.getElementById('recoveryModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// Verify security answer
async function verifySecurityAnswer() {
  const answer = document.getElementById('securityAnswer').value;
  const errorEl = document.getElementById('recoveryError');

  if (!answer.trim()) {
    errorEl.textContent = 'Veuillez saisir votre réponse.';
    shake(document.getElementById('securityAnswer'));
    return;
  }

  try {
    const storedHash = await idbGet('securityAnswerHash');
    const providedHash = await hashSecurityAnswer(answer);

    if (providedHash === storedHash) {
      // Answer is correct, show step 2
      document.getElementById('recoveryStep1').classList.add('hidden');
      document.getElementById('recoveryStep2').classList.remove('hidden');
      document.getElementById('newPassword').value = '';
      document.getElementById('newPasswordConfirm').value = '';
      document.getElementById('newPasswordError').textContent = '';
      setTimeout(() => {
        document.getElementById('newPassword').focus();

        // Add Enter key listeners for new password fields
        const newPwdField = document.getElementById('newPassword');
        const confirmPwdField = document.getElementById('newPasswordConfirm');

        newPwdField.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmPwdField.focus();
          }
        });

        confirmPwdField.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            resetPassword();
          }
        });
      }, 150);
    } else {
      errorEl.textContent = 'Réponse incorrecte. Veuillez réessayer.';
      shake(document.getElementById('securityAnswer'));
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de la réponse:', error);
    errorEl.textContent = 'Une erreur est survenue. Veuillez réessayer.';
  }
}

// Reset password after successful verification
async function resetPassword() {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('newPasswordConfirm').value;
  const errorEl = document.getElementById('newPasswordError');

  errorEl.textContent = '';

  if (!newPassword || newPassword.length < 4) {
    errorEl.textContent = 'Le mot de passe doit contenir au moins 4 caractères.';
    shake(document.getElementById('newPassword'));
    return;
  }

  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'Les mots de passe ne correspondent pas.';
    shake(document.getElementById('newPasswordConfirm'));
    return;
  }

  try {
    // Generate new salt and derive new key
    const salt = crypto.getRandomValues(new Uint8Array(16));
    await idbSet('salt', bufToHex(salt));
    const newKey = await deriveKey(newPassword, salt);

    // Re-encrypt all data with new key
    const oldKey = cryptoKey;
    cryptoKey = newKey;
    await saveToStorage();

    closeRecoveryModal();
    showToast('Mot de passe réinitialisé avec succès !');

    // Reload to re-lock the app
    setTimeout(() => {
      location.reload();
    }, 1500);

  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe:', error);
    errorEl.textContent = 'Une erreur est survenue. Veuillez réessayer.';
  }
}

// ............................................................
//  PASSWORD CHANGE SYSTEM
// ............................................................

function openChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');

  // Reset form
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPasswordChange').value = '';
  document.getElementById('newPasswordChangeConfirm').value = '';
  document.getElementById('changePasswordError').textContent = '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    document.getElementById('currentPassword').focus();

    // Add Enter key listeners to password change fields
    const currentPwd = document.getElementById('currentPassword');
    const newPwd = document.getElementById('newPasswordChange');
    const confirmPwd = document.getElementById('newPasswordChangeConfirm');

    currentPwd.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        newPwd.focus();
      }
    });

    newPwd.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmPwd.focus();
      }
    });

    confirmPwd.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitChangePassword();
      }
    });
  }, 150);
}

function closeChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function submitChangePassword() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPasswordChange').value;
  const confirmNewPassword = document.getElementById('newPasswordChangeConfirm').value;
  const errorEl = document.getElementById('changePasswordError');

  errorEl.textContent = '';

  if (!currentPassword) {
    errorEl.textContent = 'Veuillez saisir votre mot de passe actuel.';
    shake(document.getElementById('currentPassword'));
    return;
  }

  if (!newPassword || newPassword.length < 4) {
    errorEl.textContent = 'Le nouveau mot de passe doit contenir au moins 4 caractères.';
    shake(document.getElementById('newPasswordChange'));
    return;
  }

  if (newPassword !== confirmNewPassword) {
    errorEl.textContent = 'Les nouveaux mots de passe ne correspondent pas.';
    shake(document.getElementById('newPasswordChangeConfirm'));
    return;
  }

  if (currentPassword === newPassword) {
    errorEl.textContent = 'Le nouveau mot de passe doit être différent de l\'ancien.';
    shake(document.getElementById('newPasswordChange'));
    return;
  }

  try {
    // Verify current password
    const saltHex = await idbGet('salt');
    if (!saltHex) {
      errorEl.textContent = 'Données corrompues.';
      return;
    }

    const currentKey = await deriveKey(currentPassword, hexToBuf(saltHex));

    // Try to decrypt data with current password to verify it's correct
    try {
      const storedData = await idbGet('tasks');
      if (storedData) {
        const tempKey = cryptoKey;
        cryptoKey = currentKey;
        await decrypt(storedData);
        cryptoKey = tempKey; // Restore original key
      }
    } catch (decryptError) {
      errorEl.textContent = 'Mot de passe actuel incorrect.';
      shake(document.getElementById('currentPassword'));
      return;
    }

    // Generate new salt and derive new key
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    await idbSet('salt', bufToHex(newSalt));
    cryptoKey = await deriveKey(newPassword, newSalt);

    // Re-encrypt all data with new key
    await saveToStorage();

    closeChangePasswordModal();
    showToast('Mot de passe modifié avec succès !');

  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    errorEl.textContent = 'Une erreur est survenue. Veuillez réessayer.';
  }
}

// ............................................................
//  CRYPTO ?" PBKDF2 → AES-256-GCM
// ............................................................

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

// ............................................................
//  INDEXEDDB WRAPPER
// ............................................................

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

// ............................................................
//  FILE SYSTEM ACCESS API (FSA) - SAUVEGARDE AUTOMATIQUE
// ............................................................

const FSA_DB_NAME = 'TaskMDA_FSA';
const FSA_DB_VERSION = 1;
const FSA_STORE_NAME = 'directory_handles';
let fsaDB = null;

// ?tat de connexion FSA
let linkedDirectoryHandle = null;
let fsaConnected = false;

// Initialiser la base FSA pour stocker le DirectoryHandle
async function initFSADB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FSA_DB_NAME, FSA_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      fsaDB = request.result;
      resolve(fsaDB);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(FSA_STORE_NAME)) {
        db.createObjectStore(FSA_STORE_NAME);
      }
    };
  });
}

// Récupérer le DirectoryHandle stocké
async function getStoredDirectoryHandle() {
  if (!fsaDB) await initFSADB();

  return new Promise((resolve, reject) => {
    const transaction = fsaDB.transaction([FSA_STORE_NAME], 'readonly');
    const store = transaction.objectStore(FSA_STORE_NAME);
    const request = store.get('backup-folder');

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Stocker le DirectoryHandle
async function storeDirectoryHandle(dirHandle) {
  if (!fsaDB) await initFSADB();

  return new Promise((resolve, reject) => {
    const transaction = fsaDB.transaction([FSA_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FSA_STORE_NAME);
    const request = store.put(dirHandle, 'backup-folder');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Supprimer le DirectoryHandle stocké
async function removeStoredDirectoryHandle() {
  if (!fsaDB) await initFSADB();

  return new Promise((resolve, reject) => {
    const transaction = fsaDB.transaction([FSA_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FSA_STORE_NAME);
    const request = store.delete('backup-folder');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Stocker les informations du dossier (nom)
async function storeDirectoryInfo(dirName) {
  if (!fsaDB) await initFSADB();

  return new Promise((resolve, reject) => {
    const transaction = fsaDB.transaction([FSA_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FSA_STORE_NAME);
    const info = { name: dirName, linkedAt: new Date().toISOString() };
    const request = store.put(info, 'backup-folder-info');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Récupérer les informations du dossier
async function getDirectoryInfo() {
  if (!fsaDB) await initFSADB();

  return new Promise((resolve, reject) => {
    const transaction = fsaDB.transaction([FSA_STORE_NAME], 'readonly');
    const store = transaction.objectStore(FSA_STORE_NAME);
    const request = store.get('backup-folder-info');

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Supprimer les informations du dossier
async function removeDirectoryInfo() {
  if (!fsaDB) await initFSADB();

  return new Promise((resolve, reject) => {
    const transaction = fsaDB.transaction([FSA_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FSA_STORE_NAME);
    const request = store.delete('backup-folder-info');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Vérifier les permissions du dossier
async function verifyDirectoryPermission(dirHandle, requestIfNeeded = false) {
  const opts = { mode: 'readwrite' };

  // Vérifier la permission actuelle
  if ((await dirHandle.queryPermission(opts)) === 'granted') {
    return true;
  }

  // Demander la permission si nécessaire
  if (requestIfNeeded && (await dirHandle.requestPermission(opts)) === 'granted') {
    return true;
  }

  return false;
}

// Lier un dossier de sauvegarde
async function linkBackupFolder() {
  try {
    // Vérifier le support FSA
    if (!('showDirectoryPicker' in window)) {
      alert('Votre navigateur ne supporte pas l\'API File System Access.\nVeuillez utiliser Chrome, Edge ou un navigateur compatible.');
      return false;
    }

    // Ouvrir le sélecteur de dossier
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    // Vérifier les permissions
    const hasPermission = await verifyDirectoryPermission(dirHandle, true);
    if (!hasPermission) {
      alert('Permission refusée pour accéder au dossier.');
      return false;
    }

    // Stocker le handle et le nom du dossier
    await storeDirectoryHandle(dirHandle);
    await storeDirectoryInfo(dirHandle.name);
    linkedDirectoryHandle = dirHandle;
    fsaConnected = true;

    // Mettre à jour l'UI
    updateFSAStatus();

    // Sauvegarder immédiatement
    await saveToLinkedFolder();

    alert('Dossier de sauvegarde lié avec succès !\nVos données seront automatiquement sauvegardées dans ce dossier.');
    return true;

  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Erreur lors de la liaison du dossier:', err);
      alert('Erreur lors de la liaison du dossier: ' + err.message);
    }
    return false;
  }
}

// Délier le dossier de sauvegarde
async function unlinkBackupFolder() {
  try {
    await removeStoredDirectoryHandle();
    await removeDirectoryInfo();
    linkedDirectoryHandle = null;
    fsaConnected = false;
    updateFSAStatus();
    alert('Dossier de sauvegarde délié avec succès.');
  } catch (err) {
    console.error('Erreur lors du déliage du dossier:', err);
    alert('Erreur lors du déliage du dossier: ' + err.message);
  }
}

// Vérifier et restaurer la connexion au dossier au démarrage
async function checkFolderConnection() {
  try {
    const dirHandle = await getStoredDirectoryHandle();
    const dirInfo = await getDirectoryInfo();

    if (!dirHandle) {
      fsaConnected = false;
      updateFSAStatus();
      return false;
    }

    // Vérifier les permissions (sans demander)
    const hasPermission = await verifyDirectoryPermission(dirHandle, false);
    if (hasPermission) {
      linkedDirectoryHandle = dirHandle;
      fsaConnected = true;
      updateFSAStatus();
      console.log('✅ Connexion au dossier de sauvegarde restaurée');
      return true;
    } else {
      // Permission perdue - proposer de redemander les permissions sur le handle existant
      fsaConnected = false;
      updateFSAStatus();
      console.log('⚠️ Permission dossier perdue - reconnexion nécessaire');

      // Proposer de redemander les permissions (après un délai pour que l'UI soit chargée)
      if (dirInfo && dirInfo.name) {
        setTimeout(async () => {
          const reconnect = confirm(
            `Vous aviez précédemment lié le dossier "${dirInfo.name}" pour les sauvegardes automatiques.\n\n` +
            `Souhaitez-vous vous reconnecter à ce dossier maintenant ?\n\n` +
            `(Les permissions d'accès au dossier ont expiré et doivent être renouvelées)`
          );

          if (reconnect) {
            // Demander à nouveau les permissions sur le handle existant
            const hasPermission = await verifyDirectoryPermission(dirHandle, true);
            if (hasPermission) {
              linkedDirectoryHandle = dirHandle;
              fsaConnected = true;
              updateFSAStatus();
              showToast('✅ Reconnexion au dossier de sauvegarde réussie !');
              console.log('✅ Reconnexion réussie via requestPermission()');
            } else {
              showToast('❌ Permission refusée. Vous pouvez réessayer depuis les paramètres.', 5000);
            }
          }
        }, 2000);
      }

      return false;
    }
  } catch (err) {
    console.error('Erreur lors de la vérification du dossier:', err);
    fsaConnected = false;
    updateFSAStatus();
    return false;
  }
}

// Sauvegarder toutes les données dans le dossier lié
async function saveToLinkedFolder() {
  if (!linkedDirectoryHandle || !fsaConnected) return;

  try {
    // Préparer les données
    const data = {
      tasks: tasks,
      projects: projects,
      versions: versions,
      config: config,
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0'
    };

    // Créer/écrire le fichier de sauvegarde complète
    const fileHandle = await linkedDirectoryHandle.getFileHandle('taskmda-backup.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();

    // Créer des fichiers séparés pour chaque type de données
    await writeFSAFile(linkedDirectoryHandle, 'taskmda-tasks.json', tasks);
    await writeFSAFile(linkedDirectoryHandle, 'taskmda-projects.json', projects);
    await writeFSAFile(linkedDirectoryHandle, 'taskmda-versions.json', versions);
    await writeFSAFile(linkedDirectoryHandle, 'taskmda-config.json', config);

    console.log('✅ Sauvegarde automatique effectuée dans le dossier lié');

  } catch (err) {
    console.error('Erreur lors de la sauvegarde dans le dossier:', err);
    // Ne pas alerter l'utilisateur pour chaque erreur de sauvegarde auto
  }
}

// Fonction utilitaire pour écrire un fichier JSON
async function writeFSAFile(dirHandle, filename, data) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

// Restaurer les données depuis le dossier lié
async function restoreFromLinkedFolder() {
  if (!linkedDirectoryHandle || !fsaConnected) {
    alert('Aucun dossier de sauvegarde lié.');
    return;
  }

  try {
    // Vérifier les permissions
    const hasPermission = await verifyDirectoryPermission(linkedDirectoryHandle, true);
    if (!hasPermission) {
      alert('Permission refusée pour accéder au dossier.');
      return;
    }

    // Lire le fichier de sauvegarde complète
    const fileHandle = await linkedDirectoryHandle.getFileHandle('taskmda-backup.json');
    const file = await fileHandle.getFile();
    const content = await file.text();
    const data = JSON.parse(content);

    // Demander confirmation
    const confirm = window.confirm(
      `Restaurer les données depuis le dossier ?\n\n` +
      `Date d'export: ${new Date(data.exportDate).toLocaleString()}\n` +
      `Tâches: ${data.tasks?.length || 0}\n` +
      `Projets: ${data.projects?.length || 0}\n\n` +
      `⚠️ Cette action écrasera vos données actuelles !`
    );

    if (!confirm) return;

    // Restaurer les données
    if (data.tasks) tasks = data.tasks;
    if (data.projects) projects = data.projects;
    if (data.versions) versions = data.versions;
    if (data.config) config = { ...config, ...data.config };

    // Sauvegarder dans IndexedDB
    await saveToStorage();

    // Rafraîchir l'affichage
    renderCurrentView();
    updateSidebarCounts();

    alert('Données restaurées avec succès depuis le dossier de sauvegarde !');

  } catch (err) {
    console.error('Erreur lors de la restauration depuis le dossier:', err);
    alert('Erreur lors de la restauration: ' + err.message);
  }
}

// Mettre à jour l'indicateur de statut FSA dans l'UI
function updateFSAStatus() {
  const statusIndicator = document.getElementById('fsaStatus');
  const statusText = document.getElementById('fsaStatusText');
  const btnLink = document.getElementById('btnLinkFolder');
  const btnUnlink = document.getElementById('btnUnlinkFolder');
  const btnRestore = document.getElementById('btnRestoreFromFolder');

  if (statusIndicator && statusText) {
    if (fsaConnected) {
      statusIndicator.className = 'w-3 h-3 rounded-full bg-green-500';
      statusText.textContent = 'Connecté';
    } else {
      statusIndicator.className = 'w-3 h-3 rounded-full bg-gray-400';
      statusText.textContent = 'Non connecté';
    }
  }

  if (btnUnlink) btnUnlink.classList.toggle('hidden', !fsaConnected);
  if (btnRestore) btnRestore.classList.toggle('hidden', !fsaConnected);
}

// ............................................................
//  MIGRATION FROM LOCALSTORAGE
// ............................................................

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

// ............................................................
//  STOCKAGE
// ............................................................

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
{{SUJET}}{{ORDER}}========================================

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
{{SUJET}}{{ORDER}}========================================

Pourriez-vous nous apporter les informations suivantes :

[Votre message ici]

Cordialement,
TaskMDA - Gestion de taches`
        }
      },
      appearance: {
        darkMode: false,
        highContrast: false
      },
      emailSignature: {
        text: '',
        image: null
      },
      branding: {
        appName: 'TaskMDA',
        appTagline: 'Gestion de Projets'
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
{{SUJET}}{{ORDER}}========================================

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
{{SUJET}}{{ORDER}}========================================

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
    // Ensure email signature exists for backwards compatibility
    if (!config.emailSignature) {
      config.emailSignature = {
        text: '',
        image: null
      };
    }
    // Ensure branding exists for backwards compatibility
    if (!config.branding) {
      config.branding = {
        appName: 'TaskMDA',
        appTagline: 'Gestion de Projets'
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
    console.log(`Y ${duplicatesCount} doublon(s) supprimé(s)`);
    tasks = deduplicated;
  }
}

async function saveToStorage() {
  if (!cryptoKey) return;

  // Protection contre les sauvegardes simultanées
  if (isSaving) {
    console.warn('Sauvegarde déjà en cours, opération ignorée');
    return;
  }

  isSaving = true;

  try {
    // Sauvegarde SYNCHRONE dans IndexedDB (chiffré)
    await idbSet('tasks', await encrypt(tasks));
    await idbSet('versions', await encrypt(versions));
    await idbSet('projects', await encrypt(projects));
    await idbSet('config', await encrypt(config));

    // Sauvegarde ASYNCHRONE dans le dossier lié (en arrière-plan, transparent pour l'utilisateur)
    if (fsaConnected && linkedDirectoryHandle) {
      // Afficher l'indicateur de synchronisation
      const syncIcon = document.getElementById('fsaSyncIcon');
      if (syncIcon) syncIcon.classList.add('sync-active');

      saveToLinkedFolder()
        .then(() => {
          // Masquer l'indicateur après sauvegarde réussie
          if (syncIcon) syncIcon.classList.remove('sync-active');
        })
        .catch(err => {
          console.error('Erreur lors de la sauvegarde FSA en arrière-plan:', err);
          // Masquer l'indicateur même en cas d'erreur
          if (syncIcon) syncIcon.classList.remove('sync-active');
        });
    }
  } finally {
    isSaving = false;
  }
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


// ............................................................
//  MODAL
// ............................................................

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
    document.getElementById('taskOrder').value         = task.order       || '';

    // Set requester checkboxes
    const requesters = (task.requester || '').split(',').map(r => r.trim()).filter(Boolean);
    document.querySelectorAll('.requester-checkbox').forEach(cb => {
      cb.checked = requesters.includes(cb.value);
    });
    document.getElementById('taskRequester').value = task.requester || '';

    // Set type checkboxes
    const types = (task.type || '').split(',').map(t => t.trim()).filter(Boolean);
    document.querySelectorAll('.type-checkbox').forEach(cb => {
      cb.checked = types.includes(cb.value);
    });
    document.getElementById('taskType').value = task.type || '';

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

// ............................................................
//  TASK DETAIL VIEW MODAL
// ............................................................

let currentDetailTaskId = null;

function openTaskDetailModal(taskId, isArchive = false) {
  console.log('🔍 [openTaskDetailModal] taskId:', taskId, 'isArchive:', isArchive);
  currentDetailTaskId = taskId;
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  console.log('🔍 [openTaskDetailModal] task.status:', task.status, 'task.archivedAt:', task.archivedAt);

  const overlay = document.getElementById('taskDetailOverlay');

  // Update title and index
  document.getElementById('detailTitle').textContent = task.title || 'Sans titre';
  const displayIndex = task.order ? `#${task.order}` : `#${String(taskId).padStart(2,'0')}`;
  document.getElementById('detailIndex').textContent = displayIndex;

  // Update badges
  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };

  const urgencyBadge = document.getElementById('detailBadgeUrgency');
  const urgencyColors = { low: 'badge-urgency-low', medium: 'badge-urgency-medium', high: 'badge-urgency-high' };
  urgencyBadge.className = `px-3 py-1 rounded-full text-xs font-bold uppercase ${urgencyColors[task.urgency || 'low']}`;
  const urgencyIcon = task.urgency === 'low' ? 'eco' : task.urgency === 'medium' ? 'warning' : 'local_fire_department';
  urgencyBadge.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle; color: white;">${urgencyIcon}</span> ${urgencyLabels[task.urgency] || task.urgency}`;

  const statusBadge = document.getElementById('detailBadgeStatus');
  const statusColors = { 'en-cours': 'badge-status-encours', 'en-attente': 'badge-status-enattente', 'realise': 'badge-status-realise' };
  statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold uppercase ${statusColors[task.status] || 'bg-surface-container text-on-surface-variant'}`;
  statusBadge.textContent = statusLabels[task.status] || task.status;

  const typeBadge = document.getElementById('detailBadgeType');
  if (task.type) {
    typeBadge.textContent = task.type;
    typeBadge.classList.remove('hidden');
  } else {
    typeBadge.classList.add('hidden');
  }

  const recurringBadge = document.getElementById('detailBadgeRecurring');
  if (task.recurring) {
    const recurringFreqLabels = { daily: 'Quotidien', weekly: 'Hebdomadaire', monthly: 'Mensuel', yearly: 'Annuel' };
    recurringBadge.textContent = `🔄 ${recurringFreqLabels[task.recurring.frequency] || task.recurring.frequency}`;
    recurringBadge.classList.remove('hidden');
  } else {
    recurringBadge.classList.add('hidden');
  }

  // Update description
  const descSection = document.getElementById('detailDescriptionSection');
  const descContent = document.getElementById('detailDescription');
  if (task.comment && task.comment.trim()) {
    descContent.innerHTML = marked.parse(task.comment);
    descSection.classList.remove('hidden');
  } else {
    descSection.classList.add('hidden');
  }

  // Format date helper
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Update requester
  const requesterSection = document.getElementById('detailRequesterSection');
  const requesterContent = document.getElementById('detailRequester');
  if (task.requester) {
    requesterContent.querySelector('span:last-child').textContent = task.requester;
    requesterSection.classList.remove('hidden');
  } else {
    requesterSection.classList.add('hidden');
  }

  // Update request date
  const requestDateSection = document.getElementById('detailRequestDateSection');
  const requestDateContent = document.getElementById('detailRequestDate');
  if (task.requestDate) {
    requestDateContent.querySelector('span:last-child').textContent = formatDate(task.requestDate);
    requestDateSection.classList.remove('hidden');
  } else {
    requestDateSection.classList.add('hidden');
  }

  // Update deadline
  const deadlineSection = document.getElementById('detailDeadlineSection');
  const deadlineContent = document.getElementById('detailDeadline');
  if (task.deadline) {
    deadlineContent.querySelector('span:last-child').textContent = formatDate(task.deadline);
    deadlineSection.classList.remove('hidden');
  } else {
    deadlineSection.classList.add('hidden');
  }

  // Update created date
  const createdSection = document.getElementById('detailCreatedSection');
  const createdContent = document.getElementById('detailCreated');
  if (task.createdAt || task.id) {
    const createdDate = task.createdAt ? formatDate(task.createdAt) : formatDate(task.id);
    createdContent.querySelector('span:last-child').textContent = createdDate;
    createdSection.classList.remove('hidden');
  } else {
    createdSection.classList.add('hidden');
  }

  // Update updated date
  const updatedSection = document.getElementById('detailUpdatedSection');
  const updatedContent = document.getElementById('detailUpdated');
  if (task.updatedAt && task.createdAt && task.updatedAt !== task.createdAt) {
    updatedContent.querySelector('span:last-child').textContent = formatDate(task.updatedAt);
    updatedSection.classList.remove('hidden');
  } else {
    updatedSection.classList.add('hidden');
  }

  // Update archived date
  const archivedSection = document.getElementById('detailArchivedSection');
  const archivedContent = document.getElementById('detailArchived');
  if (isArchive && task.archivedAt) {
    archivedContent.querySelector('span:last-child').textContent = formatDate(task.archivedAt);
    archivedSection.classList.remove('hidden');
  } else {
    archivedSection.classList.add('hidden');
  }

  // Update files
  const filesSection = document.getElementById('detailFilesSection');
  const filesList = document.getElementById('detailFilesList');
  const filesCount = document.getElementById('detailFilesCount');
  if (task.files && task.files.length > 0) {
    filesCount.textContent = task.files.length;
    filesList.innerHTML = task.files.map((file, idx) => `
      <div class="flex items-center justify-between p-3 bg-surface-container rounded-lg">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-primary">description</span>
          <div>
            <p class="font-semibold text-sm">${escHtml(file.name)}</p>
            <p class="text-xs text-on-surface-variant">${(file.size / 1024).toFixed(1)} Ko</p>
          </div>
        </div>
        <a href="${file.data}" download="${file.name}" class="px-3 py-1.5 bg-primary-gradient text-white rounded-lg text-xs font-semibold flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">download</span>
          Télécharger
        </a>
      </div>
    `).join('');
    filesSection.classList.remove('hidden');
  } else {
    filesSection.classList.add('hidden');
  }

  // Update action buttons based on context
  const btnEmailInquiry = document.getElementById('detailBtnEmailInquiry');
  const btnEmailCompletion = document.getElementById('detailBtnEmailCompletion');
  const btnComplete = document.getElementById('detailBtnComplete');
  const btnRestore = document.getElementById('detailBtnRestore');

  console.log('YZ [openTaskDetailModal] Configuration des boutons - isArchive:', isArchive);

  if (isArchive) {
    console.log('YZ [openTaskDetailModal] Mode ARCHIVE - cachant btnComplete');
    btnEmailInquiry.classList.add('hidden');
    btnEmailCompletion.classList.add('hidden');
    btnComplete.classList.add('hidden');
    btnRestore.classList.remove('hidden');
    console.log('YZ [openTaskDetailModal] btnComplete classes après:', btnComplete.className);
  } else {
    console.log('YZ [openTaskDetailModal] Mode ACTIF - affichant btnComplete');
    btnComplete.classList.remove('hidden');
    btnRestore.classList.add('hidden');

    // Show email buttons if task has requester and email is configured
    if (task.requester && canSendEmailForTask(task)) {
      btnEmailInquiry.classList.remove('hidden');
      // Show completion email only if task is completed
      if (task.status === 'realise') {
        btnEmailCompletion.classList.remove('hidden');
      } else {
        btnEmailCompletion.classList.add('hidden');
      }
    } else {
      btnEmailInquiry.classList.add('hidden');
      btnEmailCompletion.classList.add('hidden');
    }
    console.log('YZ [openTaskDetailModal] btnComplete classes après:', btnComplete.className);
  }

  overlay.classList.remove('hidden');
}

function closeTaskDetailModal() {
  document.getElementById('taskDetailOverlay').classList.add('hidden');
  currentDetailTaskId = null;
}

function handleTaskDetailOverlayClick(e) {
  if (e.target === document.getElementById('taskDetailOverlay')) {
    closeTaskDetailModal();
  }
}

// Action button handlers
function editTaskFromDetail() {
  const taskId = currentDetailTaskId;
  closeTaskDetailModal();
  openModal(taskId);
}

async function markAsCompletedFromDetail() {
  if (!currentDetailTaskId) return;
  const taskId = currentDetailTaskId;
  closeTaskDetailModal();
  await markAsCompleted(taskId);
}

async function restoreTaskFromDetail() {
  if (!currentDetailTaskId) return;
  const taskId = currentDetailTaskId;
  closeTaskDetailModal();
  await restoreTask(taskId);
}

function deleteTaskFromDetail() {
  if (!currentDetailTaskId) return;
  const taskId = currentDetailTaskId;
  closeTaskDetailModal();
  confirmDelete(taskId);
}

function sendTaskInquiryEmailFromDetail() {
  if (!currentDetailTaskId) return;
  sendTaskInquiryEmail(currentDetailTaskId);
}

function sendTaskCompletionEmailFromDetail() {
  if (!currentDetailTaskId) return;
  sendTaskCompletionEmail(currentDetailTaskId);
}

// ............................................................
//  PROJECT DETAIL MODAL
// ............................................................

let currentDetailProjectId = null;

function openProjectDetailModal(projectId, isArchive = false) {
  console.log('🔍 [openProjectDetailModal] projectId:', projectId, 'isArchive:', isArchive);
  currentDetailProjectId = projectId;
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  const overlay = document.getElementById('projectDetailOverlay');

  // Update title
  document.getElementById('projectDetailTitle').textContent = project.name || 'Sans titre';

  // Update status badge
  const statusBadge = document.getElementById('projectDetailStatus');
  const statusColors = { active: 'bg-green-600 text-white', archived: 'bg-gray-600 text-white' };
  statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold ${statusColors[project.status] || 'bg-surface-container text-on-surface-variant'}`;
  statusBadge.textContent = project.status === 'archived' ? 'Archivé' : 'Actif';

  // Update requesters
  const requesters = project.requesters && project.requesters.length > 0
    ? `Demandeurs: ${project.requesters.join(', ')}`
    : '';
  document.getElementById('projectDetailRequesters').textContent = requesters;

  // Update description
  const descSection = document.getElementById('projectDetailDescriptionSection');
  const descContent = document.getElementById('projectDetailDescription');
  if (project.description && project.description.trim()) {
    descContent.innerHTML = marked.parse(project.description);
    descSection.classList.remove('hidden');
  } else {
    descSection.classList.add('hidden');
  }

  // Format date helper
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  // Update start date
  document.getElementById('projectDetailStart').querySelector('span:last-child').textContent =
    project.startDate ? formatDate(project.startDate) : 'Non définie';

  // Update end date
  document.getElementById('projectDetailEnd').querySelector('span:last-child').textContent =
    project.endDate ? formatDate(project.endDate) : 'Non définie';

  // Update created date
  const createdDate = project.createdAt ? formatDate(project.createdAt) :
    (project.id ? formatDate(project.id) : 'Non définie');
  document.getElementById('projectDetailCreated').querySelector('span:last-child').textContent = createdDate;

  // Update archived date
  const archivedSection = document.getElementById('projectDetailArchivedSection');
  const archivedContent = document.getElementById('projectDetailArchived');
  if (isArchive && project.archivedAt) {
    archivedContent.querySelector('span:last-child').textContent = formatDate(project.archivedAt);
    archivedSection.classList.remove('hidden');
  } else {
    archivedSection.classList.add('hidden');
  }

  // Update progress
  const progress = project.progress || 0;
  document.getElementById('projectDetailProgressBar').style.width = `${progress}%`;
  document.getElementById('projectDetailProgressText').textContent = `${progress}%`;

  // Update action buttons based on context
  const btnArchive = document.getElementById('projectDetailBtnArchive');
  const btnRestore = document.getElementById('projectDetailBtnRestore');
  const btnEmailInquiry = document.getElementById('projectDetailBtnEmailInquiry');

  if (isArchive) {
    btnArchive.classList.add('hidden');
    btnRestore.classList.remove('hidden');
    btnEmailInquiry.classList.add('hidden');
  } else {
    btnArchive.classList.remove('hidden');
    btnRestore.classList.add('hidden');

    // Show email button if project has requesters with email configured
    if (canSendEmailForProject(project)) {
      btnEmailInquiry.classList.remove('hidden');
    } else {
      btnEmailInquiry.classList.add('hidden');
    }
  }

  overlay.classList.remove('hidden');
}

function closeProjectDetailModal() {
  document.getElementById('projectDetailOverlay').classList.add('hidden');
  currentDetailProjectId = null;
}

function handleProjectDetailOverlayClick(event) {
  if (event.target.id === 'projectDetailOverlay') {
    closeProjectDetailModal();
  }
}

function editProjectFromDetail() {
  const projectId = currentDetailProjectId;
  closeProjectDetailModal();
  openProjectModal(projectId);
}

async function archiveProjectFromDetail() {
  if (!currentDetailProjectId) return;
  const projectId = currentDetailProjectId;
  closeProjectDetailModal();
  await archiveProject(projectId);
}

async function restoreProjectFromDetail() {
  if (!currentDetailProjectId) return;
  const projectId = currentDetailProjectId;
  closeProjectDetailModal();
  await restoreProject(projectId);
}

async function deleteProjectFromDetail() {
  if (!currentDetailProjectId) return;
  const projectId = currentDetailProjectId;
  closeProjectDetailModal();
  await deleteProject(projectId);
}

function canSendEmailForProject(project) {
  if (!project || !project.requesters || project.requesters.length === 0) return false;

  // Check if ALL requesters have an email configured
  return project.requesters.every(requesterName => {
    const requester = config.requesters.find(r => r.name === requesterName);
    return requester && requester.email && requester.email.trim().length > 0;
  });
}

function sendProjectInquiryEmailFromDetail() {
  if (!currentDetailProjectId) return;
  sendProjectInquiryEmail(currentDetailProjectId);
}

function sendProjectInquiryEmail(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  // Get all requesters with emails
  const requestersWithEmail = (project.requesters || [])
    .map(requesterName => config.requesters.find(r => r.name === requesterName))
    .filter(requester => requester && requester.email && requester.email.trim().length > 0);

  if (requestersWithEmail.length === 0) {
    showToast('⚠️ Aucun email configuré pour les demandeurs de ce projet');
    return;
  }

  // Get template and replace variables
  const template = config.emailTemplates.inquiry;
  const subject = replaceTemplateVariablesForProject(template.subject, project);
  const body = replaceTemplateVariablesForProject(template.body, project);

  // Prepare email addresses (multiple recipients separated by semicolons)
  const emailAddresses = requestersWithEmail.map(r => r.email).join(';');

  // URL encode for mailto
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body).replace(/%0A/g, '%0D%0A');

  // Open email client
  window.location.href = `mailto:${emailAddresses}?subject=${encodedSubject}&body=${encodedBody}`;

  showToast(`Email prêt pour le projet "${project.name}"`);
}

function replaceTemplateVariablesForProject(text, project) {
  if (!text) return '';

  const requesters = (project.requesters || []).join(', ');
  const startDate = project.startDate ? new Date(project.startDate).toLocaleDateString('fr-FR') : 'Non définie';
  const endDate = project.endDate ? new Date(project.endDate).toLocaleDateString('fr-FR') : 'Non définie';

  text = text.replace(/\{nom_projet\}/g, project.name || '');
  text = text.replace(/\{demandeurs\}/g, requesters);
  text = text.replace(/\{date_debut\}/g, startDate);
  text = text.replace(/\{date_fin\}/g, endDate);
  text = text.replace(/\{progression\}/g, (project.progress || 0) + '%');
  text = text.replace(/\{statut\}/g, project.status || '');
  text = text.replace(/\{description\}/g, project.description || '');

  // Add signature if configured
  if (config.emailSignature) {
    const signature = buildEmailSignature();
    if (signature) {
      text += '\n\n' + signature;
    }
  }

  return text;
}

// ............................................................
//  PILLS
// ............................................................

function initUrgencyPills() {
  document.querySelectorAll('.urgency-pill').forEach(pill =>
    pill.addEventListener('click', () => setUrgencyPill(pill.dataset.urgency))
  );
}

function setUrgencyPill(value) {
  document.querySelectorAll('.urgency-pill').forEach(p => {
    const isSelected = p.dataset.urgency === value;
    p.classList.toggle('active', isSelected);

    // Get the icon inside the pill
    const icon = p.querySelector('.material-symbols-outlined');

    // Add/remove Tailwind classes for selected state
    if (isSelected) {
      p.classList.add('bg-primary-gradient', 'text-white', 'shadow-sm');
      p.classList.remove('bg-surface-container', 'text-on-surface-variant');
      // Force icon color to white with !important flag
      if (icon) icon.style.setProperty('color', 'white', 'important');
    } else {
      p.classList.remove('bg-primary-gradient', 'text-white', 'shadow-sm');
      p.classList.add('bg-surface-container', 'text-on-surface-variant');
      // Restore original icon color based on urgency
      if (icon) {
        const colors = { low: '#16a34a', medium: '#f59e0b', high: '#ef4444' };
        icon.style.setProperty('color', colors[p.dataset.urgency] || '#16a34a', 'important');
      }
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

// ............................................................
//  FILTRE + TRI
// ............................................................

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

function toLocalDateInputValue(dateLike = new Date()) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateInputValue(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isTaskScheduledInFuture(task, referenceDate = new Date()) {
  const taskDate = parseDateInputValue(task?.requestDate);
  if (!taskDate) return false;
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return taskDate.getTime() > ref.getTime();
}

function getActiveTasks() {
  // Taches actives = non realisees et prevues au plus tard aujourd'hui
  const activeTasks = tasks.filter(t => t.status !== 'realise' && !isTaskScheduledInFuture(t));
  console.log('📊 [getActiveTasks] Total tasks:', tasks.length);
  console.log('📊 [getActiveTasks] Active tasks:', activeTasks.length, activeTasks.map(t => ({ id: t.id, title: t.title, status: t.status })));
  console.log('📊 [getActiveTasks] All statuses:', tasks.map(t => ({ id: t.id, status: t.status, title: t.title })));
  return activeTasks;
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

// ............................................................
//  CRUD
// ............................................................

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

    // Conserver la date demandée saisie par l'utilisateur.
    // Pour une nouvelle tâche sans date, utiliser aujourd'hui comme valeur par défaut.
    let calculatedRequestDate = requestDate || toLocalDateInputValue(new Date());

    // Validation du titre
    if (!title) {
      const titleInput = document.getElementById('taskTitle');
      shake(titleInput);
      showToast('Le titre de la tâche est obligatoire');
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
      showToast('Veuillez sélectionner un demandeur');
      document.getElementById('taskRequester').focus();
      return;
    }

    // Validation du type
    if (!type) {
      showToast('Veuillez sélectionner un type de tâche');
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
      showToast(`La tâche "${title}" a été archivée - consultez l'onglet Archives`);
    }
  } finally {
    isSubmitting = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function markAsCompleted(id) {
  // Protection contre les doubles clics
  if (isMarkingCompleted) {
    return;
  }
  isMarkingCompleted = true;

  try {
    const now = new Date().toISOString();

    console.log('🔍 [DEBUG] ID reçu:', id, 'Type:', typeof id);
    console.log('🔍 [DEBUG] Liste des IDs dans tasks:', tasks.map(t => ({ id: t.id, type: typeof t.id, title: t.title })));

    // Convertir l'ID en nombre pour une comparaison fiable
    const numId = Number(id);
    const task = tasks.find(t => Number(t.id) === numId || t.id === id);

    // Vérifier que la tâche existe
    if (!task) {
      console.error('❌ [DEBUG] Tâche introuvable! ID recherché:', id);
      console.error('❌ [DEBUG] IDs disponibles:', tasks.map(t => t.id));
      showToast('che introuvable');
      return;
    }

    console.log('✅ [DEBUG] Tâche trouvée:', { id: task.id, title: task.title, urgency: task.urgency, status: task.status, recurring: task.recurring });

    // Empecher l'archivage d'une occurrence planifiee dans le futur
    if (isTaskScheduledInFuture(task)) {
      showToast(`⏳ Cette occurrence est planifiée pour le ${formatDate(task.requestDate)} et ne peut pas être archivée avant cette date`);
      return;
    }

    // Vérifier si la tâche n'est pas déjà archivée (éviter les doublons)
    if (task.status === 'realise' && task.archivedAt) {
      console.warn('⚠️ [DEBUG] Tâche déjà archivée:', task.title);
      showToast(`⚠️ La tâche "${task.title}" est déjà archivée`);
      return;
    }

    console.log('🔍 [DEBUG] Nombre de tâches AVANT:', tasks.length);

    // Si tâche récurrente, créer la prochaine occurrence AVANT de modifier la tâche actuelle
    if (task.recurring) {
      console.log('🔄 [DEBUG] Création prochaine occurrence');
      createNextRecurrence(task, task.recurring);
      console.log('🔍 [DEBUG] Nombre de tâches APRÈS createNextRecurrence:', tasks.length);
    }

    // Modifier la tâche pour la marquer comme réalisée
    console.log('🔄 [DEBUG] Modification du statut...');
    tasks = tasks.map(t => (Number(t.id) === numId || t.id === id) ? { ...t, status: 'realise', updatedAt: now, archivedAt: now } : t);

    console.log('🔍 [DEBUG] Nombre de tâches APRÈS map:', tasks.length);
    console.log('📊 [DEBUG] Actives:', tasks.filter(t => t.status !== 'realise').length, 'Archivées:', tasks.filter(t => t.status === 'realise').length);

    await saveToStorage();
    updateSidebarCounts();

    // Propose d'envoyer un email aux demandeurs si des emails sont configurés
    if (task.requester && canSendEmailForTask(task)) {
      // Get all requesters with emails
      const requesterNames = task.requester.split(',').map(r => r.trim()).filter(Boolean);
      const requestersWithEmail = requesterNames
        .map(name => config.requesters.find(r => r.name === name))
        .filter(requester => requester && requester.email && requester.email.trim().length > 0);

      if (requestersWithEmail.length > 0) {
        // Show confirmation modal for email sending
        showEmailConfirmation(task, requestersWithEmail);
      }
    }

    // SOLUTION D?FINITIVE : basculer IMM?DIATEMENT vers les archives
    // Cela évite tous les problèmes de rafraîchissement des vues tasks/dashboard
    showToast(`✅ La tâche "${task.title}" a été marquée comme réalisée et archivée`);
    switchView('archives');
  } finally {
    // Réinitialiser le flag après un court délai
    setTimeout(() => {
      isMarkingCompleted = false;
    }, 500);
  }
}

function showEmailConfirmation(task, requestersWithEmail) {
  // Format requester list with emails
  const requesterList = requestersWithEmail
    .map(r => `<strong class="text-on-surface">${escHtml(r.name)}</strong> (<a href="mailto:${escHtml(r.email)}" class="text-primary hover:underline">${escHtml(r.email)}</a>)`)
    .join(', ');

  const content = `
    <div class="space-y-4">
      <p class="text-on-surface-variant">
        Souhaitez-vous notifier ${requesterList}
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

  const title = requestersWithEmail.length > 1 ? '📧 Notification aux demandeurs' : '📧 Notification au demandeur';
  showModal(title, content);
}

function canSendEmailForTask(task) {
  if (!task || !task.requester) return false;

  // Split multiple requesters (comma-separated)
  const requesterNames = task.requester.split(',').map(r => r.trim()).filter(Boolean);

  // Check if ALL requesters have an email configured
  return requesterNames.every(requesterName => {
    const requester = config.requesters.find(r => r.name === requesterName);
    return requester && requester.email && requester.email.trim().length > 0;
  });
}

function sendTaskCompletionEmail(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  // Split multiple requesters (comma-separated)
  const requesterNames = task.requester.split(',').map(r => r.trim()).filter(Boolean);

  // Get all requesters with emails
  const requestersWithEmail = requesterNames
    .map(name => config.requesters.find(r => r.name === name))
    .filter(requester => requester && requester.email && requester.email.trim().length > 0);

  if (requestersWithEmail.length === 0) {
    showToast(`⚠️ Aucun email configuré pour les demandeurs`);
    return;
  }

  // Get template and replace variables
  const template = config.emailTemplates.completion;
  const subject = replaceTemplateVariables(template.subject, task);
  const body = replaceTemplateVariables(template.body, task);

  // Prepare email addresses (multiple recipients separated by semicolons)
  const emailAddresses = requestersWithEmail.map(r => r.email).join(';');

  // URL encode for mailto
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body).replace(/%0A/g, '%0D%0A');

  // Open email client
  window.location.href = `mailto:${emailAddresses}?subject=${encodedSubject}&body=${encodedBody}`;

  showToast(`Email de notification prêt pour la tâche "${task.title}"`);
}

function sendTaskInquiryEmail(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  // Split multiple requesters (comma-separated)
  const requesterNames = task.requester.split(',').map(r => r.trim()).filter(Boolean);

  // Get all requesters with emails
  const requestersWithEmail = requesterNames
    .map(name => config.requesters.find(r => r.name === name))
    .filter(requester => requester && requester.email && requester.email.trim().length > 0);

  if (requestersWithEmail.length === 0) {
    showToast(`⚠️ Aucun email configuré pour les demandeurs`);
    return;
  }

  // Get template and replace variables
  const template = config.emailTemplates.inquiry;
  const subject = replaceTemplateVariables(template.subject, task);
  const body = replaceTemplateVariables(template.body, task);

  // Prepare email addresses (multiple recipients separated by semicolons)
  const emailAddresses = requestersWithEmail.map(r => r.email).join(';');

  // URL encode for mailto
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body).replace(/%0A/g, '%0D%0A');

  // Open email client
  window.location.href = `mailto:${emailAddresses}?subject=${encodedSubject}&body=${encodedBody}`;

  showToast(`Email de demande d'informations prêt pour la tâche "${task.title}"`);
}

async function restoreTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task || !task.archivedAt) return;

  // Restaurer la tâche : supprimer archivedAt et remettre le statut à 'en-cours'
  tasks = tasks.map(t => t.id === id ? { ...t, status: 'en-cours', archivedAt: null, updatedAt: new Date().toISOString() } : t);

  await saveToStorage();
  updateSidebarCounts();

  showToast(`↩️ La tâche "${task.title}" a été restaurée avec succès`);

  // Refresh current view
  if (activeView === 'archives') {
    renderArchives();
  } else {
    renderTasks();
  }
}

function calculateNextRecurrenceDate(recurring, fromDate = new Date()) {
  if (!recurring) return null;

  const baseDate = typeof fromDate === 'string' ? (parseDateInputValue(fromDate) || new Date(fromDate)) : new Date(fromDate);
  if (Number.isNaN(baseDate.getTime())) return null;
  let nextDate = new Date(baseDate);

  switch (recurring.frequency) {
    case 'daily':
      // Pour quotidien, la prochaine occurrence est demain
      nextDate.setDate(nextDate.getDate() + recurring.interval);
      break;

    case 'weekly':
      // Si un jour de la semaine est spécifié
      if (recurring.weekday !== null && recurring.weekday !== undefined) {
        const targetWeekday = recurring.weekday; // 0=Dimanche, 1=Lundi, etc.
        const currentWeekday = baseDate.getDay();

        // Calculer les jours jusqu'au prochain jour cible
        let daysUntilTarget = targetWeekday - currentWeekday;
        if (daysUntilTarget <= 0) {
          daysUntilTarget += 7; // Passer à la semaine suivante
        }

        nextDate.setDate(baseDate.getDate() + daysUntilTarget);
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

  // Utiliser la date de l'occurrence terminée comme base de calcul
  const recurrenceBaseDate = task.requestDate || task.createdAt || task.updatedAt || task.id;
  const nextDate = calculateNextRecurrenceDate(recurring, recurrenceBaseDate);
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
    newDeadline = toLocalDateInputValue(new Date(nextDate.getTime() + diff));
  }

  const newTask = {
    id: Date.now() + Math.floor(Math.random() * 10000), // ?viter les collisions avec un entier
    title: task.title,
    comment: task.comment,
    urgency: task.urgency,
    status: 'en-cours',
    deadline: newDeadline,
    requestDate: toLocalDateInputValue(nextDate),
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

  showToast('che restaurée en cours');
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
    showToast(`🗑️ La tâche "${taskTitle}" a été supprimée définitivement`);
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
    showToast(`🗑️ Toutes les tâches ont été effacées définitivement (${count} tâche(s))`);
  };
}

// ............................................................
//  APPARENCE ?" DARK MODE & HIGH CONTRAST
// ............................................................

async function toggleDarkMode(e) {
  const enabled = e.target.checked;
  config.appearance.darkMode = enabled;

  if (enabled) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  await saveToStorage();
  showToast(enabled ? 'Mode sombre activé' : 'Mode clair activé');
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
  showToast(enabled ? 'Contraste renforcé activé' : 'Contraste normal activé');
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

// ............................................................
//  ACCORDÉON PARAMÈTRES
// ............................................................

function toggleSettingsSection(sectionName) {
  const content = document.getElementById(`${sectionName}Content`);
  const chevron = document.getElementById(`${sectionName}Chevron`);

  if (!content || !chevron) return;

  const isHidden = content.classList.contains('hidden');

  if (isHidden) {
    // Ouvrir la section
    content.classList.remove('hidden');
    chevron.style.transform = 'rotate(180deg)';
  } else {
    // Fermer la section
    content.classList.add('hidden');
    chevron.style.transform = 'rotate(0deg)';
  }
}

// ............................................................
//  SYST^ME DE NOTIFICATIONS
// ............................................................

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
          title: `Y Fin de projet aujourd'hui`,
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
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">Y>️</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">Y>️</text></svg>',
        tag: `taskmda-${notif.type}-${notif.taskId || notif.projectId}`,
        requireInteraction: false
      });
    }, index * 1000); // Stagger notifications by 1 second
  });
}

function showNotificationsSummary(notifications) {
  if (notifications.length === 0) return;

  const summary = notifications.map(n => `${n.title}: ${n.message}`).join('\n');
  showToast(`🔄 ${notifications.length} notification(s) - Voir les détails`, 5000);

  // Log to console for debugging
  console.log('🔔 Notifications TaskMDA:', notifications);
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

// ............................................................
//  RENDU ?" T,CHES ACTIVES
// ............................................................

function renderTasks() {
  console.log('🎨 [renderTasks] DÉBUT du rendu des tâches');
  const container = document.getElementById('tasks');
  container.innerHTML = '';
  console.log('🎨 [renderTasks] Conteneur vidé');

  const urgFilter = activeFilter;
  const sort = document.getElementById('sortSelect')?.value || 'date-asc';
  const searchQuery = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

  let list = applyFilters(getActiveTasks(), urgFilter, 'all', 'all');
  console.log('🎨 [renderTasks] Après filtres, liste:', list.length, 'tâches', list.map(t => t.title));

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
    const hasFilters = urgFilter !== 'all' || searchQuery;
    container.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-16 px-4">
        ${hasFilters ? `
          <div class="empty-state">
            <div class="big-icon">📋</div>
            <strong>Aucune tâche ici</strong>
            <p>Aucune tâche pour ces critères.</p>
          </div>
        ` : `
          <div class="max-w-2xl w-full bg-surface-container-low border-2 border-dashed border-outline-variant rounded-3xl p-12 text-center">
            <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-container flex items-center justify-center">
              <span class="material-symbols-outlined text-5xl text-primary">add</span>
            </div>
            <h3 class="text-2xl font-bold text-on-surface mb-3">Créer votre première tâche</h3>
            <p class="text-on-surface-variant mb-6 max-w-md mx-auto">
              Organisez votre travail en créant des tâches avec des niveaux d'urgence, des échéances et des suivis personnalisés.
            </p>
            <button onclick="openModal()" class="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
              <span class="material-symbols-outlined">add</span>
              Nouvelle tâche
            </button>
          </div>
        `}
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

// ............................................................
//  RENDU ?" ARCHIVES
// ............................................................

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
        <div class="big-icon">✓</div>
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
      <div class="col-span-full empty-state">
        <div class="big-icon">📁</div>
        <strong>Aucun projet archivé</strong>
        <p>Les projets archivés apparaîtront ici.</p>
      </div>
    `;
    return;
  }

  // Enhanced colors for WCAG AA compliance
  const statusColors = {
    'en-cours': { bg: 'bg-[#0891b2]', text: 'text-white', label: 'EN COURS', dot: '#0891b2', border: '#0891b2' },
    'planifie': { bg: 'bg-[#6366f1]', text: 'text-white', label: 'PLANIFIÉ', dot: '#6366f1', border: '#6366f1' },
    'urgent': { bg: 'bg-[#dc2626]', text: 'text-white', label: 'URGENT', dot: '#dc2626', border: '#dc2626' },
    'termine': { bg: 'bg-[#16a34a]', text: 'text-white', label: 'TERMINÉ', dot: '#16a34a', border: '#16a34a' }
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
      <div class="bg-surface-container-low rounded-2xl p-4 shadow-sm opacity-75 group border-l-[5px] cursor-pointer" style="border-color: ${color.border}" onclick="openProjectDetailModal(${project.id}, true)">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <h3 class="font-bold text-on-surface text-lg mb-2">${escHtml(project.name)}</h3>
            <div class="flex items-center gap-2 mb-2">
              <span class="w-2 h-2 rounded-full" style="background-color: ${color.dot}"></span>
              <span class="text-xs font-medium text-on-surface-variant uppercase">${color.label}</span>
            </div>
          </div>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="event.stopPropagation(); restoreProject(${project.id})" title="Restaurer le projet" class="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-primary transition-colors">
              <span class="material-symbols-outlined text-sm">restore</span>
            </button>
            <button onclick="event.stopPropagation(); deleteProject(${project.id})" title="Supprimer définitivement" class="p-2 hover:bg-error-container rounded-lg text-on-surface-variant hover:text-error transition-colors">
              <span class="material-symbols-outlined text-sm">delete</span>
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

// ............................................................
//  TRONCATURE INTELLIGENTE DU TEXTE
// ............................................................

/**
 * Calcule le nombre de caractères maximum pour un texte selon le mode de vue
 * Pour éviter overflow hidden qui coupe les jambages descendants
 */
function calculateMaxTextLength(viewMode) {
  // Estimation basée sur la largeur réelle des colonnes
  // Augmentation significative pour permettre 3 lignes complètes
  const charsPerLine = {
    1: 150, // 1 colonne = texte très large
    2: 100,  // 2 colonnes = texte moyennement large
    3: 85,  // 3 colonnes = environ 85 caractères par ligne
    4: 40   // 4 colonnes = texte très compact
  };

  const linesPerView = {
    1: 4, // 4 lignes
    2: 2, // 2 lignes
    3: 3, // 3 lignes
    4: 1  // 1 ligne
  };

  const charsPerLineForMode = charsPerLine[viewMode] || 85;
  const lines = linesPerView[viewMode] || 3;

  return charsPerLineForMode * lines;
}

/**
 * Tronque intelligemment un texte pour qu'il tienne dans l'espace alloué
 * sans être coupé par overflow hidden
 */
function truncateText(text, viewMode) {
  if (!text) return '';

  const maxLength = calculateMaxTextLength(viewMode);

  if (text.length <= maxLength) {
    return text;
  }

  // Tronquer au dernier espace avant maxLength pour éviter de couper un mot
  let truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) { // Si l'espace est assez proche
    truncated = truncated.substring(0, lastSpace);
  }

  return truncated + '...';
}

// ............................................................
//  CONSTRUCTION D'UNE CARTE
// ............................................................

function buildCard(task, idx, isArchive) {
  const p  = progressPercent(task.deadline);

  const urgencyLabels = { low:'Faible', medium:'Moyenne', high:'Urgente' };
  const statusLabels  = { 'en-cours':'En cours', 'en-attente':'En attente', 'realise':'Réalisé' };

  // Enhanced border colors for better contrast (WCAG AA)
  const urgencyColors = {
    low: 'border-[#0891b2]',      // Cyan - stronger contrast
    medium: 'border-[#f59e0b]',   // Orange - more visible
    high: 'border-[#dc2626]'      // Red - high contrast
  };

  // Adapter le padding et hauteur selon le mode de vue
  const paddingClass = taskViewMode === 4 ? 'p-3' : taskViewMode === 1 ? 'p-8' : 'p-6';
  const heightClass = taskViewMode === 4 ? 'task-card-compact' : taskViewMode === 3 ? 'task-card-standard' : '';

  const card = document.createElement('div');
  card.className = `group bg-surface-container-lowest ${paddingClass} rounded-xl relative border-l-4 ${urgencyColors[task.urgency || 'low']} shadow-sm hover:shadow-md transition-all duration-300 task-card ${heightClass} cursor-pointer`;
  card.style.animationDelay = `${idx * 0.04}s`;

  // Make card clickable to open detail modal
  card.onclick = (e) => {
    // Don't open modal if clicking on action buttons
    if (e.target.closest('button')) return;
    openTaskDetailModal(task.id, isArchive);
  };

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
    ? `🔄 ${recurringFreqLabels[task.recurring.frequency] || task.recurring.frequency}${task.recurring.interval > 1 ? ` -${task.recurring.interval}` : ''}`
    : '';

  // WCAG AA compliant badge colors
  const urgencyChipBg = {
    low: 'badge-urgency-low',
    medium: 'badge-urgency-medium',
    high: 'badge-urgency-high'
  };

  const statusChipBg = {
    'en-cours': 'badge-status-encours',
    'en-attente': 'badge-status-enattente',
    'realise': 'badge-status-realise'
  };

  // Déterminer le niveau de détail selon le mode de vue
  const titleSize = taskViewMode === 1 ? 'text-xl' : taskViewMode === 4 ? 'text-sm' : 'text-lg';
  const commentTextSize = taskViewMode === 1 ? 'text-base' : 'text-sm'; // Taille lisible
  const showFullMetadata = taskViewMode === 1; // Montrer dates complètes en mode détaillé
  const badgeSize = taskViewMode === 4 ? 'px-2 py-0.5 text-[8px]' : 'px-3 py-1 text-[10px]';
  const gapSize = taskViewMode === 4 ? 'gap-1' : 'gap-2';

  // Tronquer le texte intelligemment pour qu'il ne soit pas coupé par overflow
  const truncatedComment = truncateText(task.comment, taskViewMode);

  card.innerHTML = `
    <div class="flex justify-between items-start ${taskViewMode === 4 ? 'mb-1' : 'mb-4'}">
      <div class="flex flex-wrap ${gapSize}">
        <span class="${badgeSize} ${urgencyChipBg[task.urgency || 'low']} font-bold rounded-full uppercase tracking-tight flex items-center gap-1">
          ${taskViewMode === 4
            ? (urgencyLabels[task.urgency]||task.urgency)
            : `<span class="material-symbols-outlined" style="font-size: 14px; color: white;">${task.urgency === 'low' ? 'eco' : task.urgency === 'medium' ? 'warning' : 'local_fire_department'}</span> ${urgencyLabels[task.urgency]||task.urgency}`}
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
        <button onclick="event.stopPropagation(); openModal(${task.id})" title="Modifier la tâche" class="${taskViewMode === 4 ? 'p-1' : 'p-2'} hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined ${taskViewMode === 4 ? 'text-xs' : 'text-sm'}">edit</span>
        </button>
        ${!isArchive && task.requester && canSendEmailForTask(task) && taskViewMode <= 2 ? `<button onclick="event.stopPropagation(); sendTaskInquiryEmail(${task.id})" title="Contacter le demandeur" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">email</span>
        </button>` : ''}
        ${!isArchive ? `<button onclick="event.stopPropagation(); markAsCompleted(${task.id})" title="Marquer comme réalisé" class="${taskViewMode === 4 ? 'p-1' : 'p-2'} hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined ${taskViewMode === 4 ? 'text-xs' : 'text-sm'}">check</span>
        </button>` : ''}
        ${isArchive && task.requester && canSendEmailForTask(task) && taskViewMode <= 2 ? `<button onclick="event.stopPropagation(); sendTaskCompletionEmail(${task.id})" title="Notifier le demandeur par email" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">email</span>
        </button>` : ''}
        ${isArchive && taskViewMode !== 4 ? `<button onclick="event.stopPropagation(); restoreTask(${task.id})" title="Restaurer la tâche" class="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">restore</span>
        </button>` : ''}
        <button onclick="event.stopPropagation(); confirmDelete(${task.id})" title="Supprimer la tâche" class="${taskViewMode === 4 ? 'p-1' : 'p-2'} hover:bg-surface-container-low rounded-lg text-on-surface-variant hover:text-tertiary transition-colors">
          <span class="material-symbols-outlined ${taskViewMode === 4 ? 'text-xs' : 'text-sm'}">delete</span>
        </button>
      </div>
    </div>

    ${taskViewMode !== 4 ? `<div class="mb-2 flex items-center gap-2">
      <span class="text-xs text-on-surface-variant font-semibold">${escHtml(displayIndex)}</span>
    </div>` : ''}

    <h4 class="${titleSize} font-bold text-on-surface ${taskViewMode === 4 ? 'mb-1 line-clamp-2' : 'mb-2'}">${escHtml(task.title)}</h4>

    ${task.comment && taskViewMode !== 3 && taskViewMode !== 4 ? `
      <p class="${commentTextSize} text-secondary-improved mb-4 break-words leading-relaxed">${escHtml(truncatedComment)}</p>
    ` : ''}

    ${showFullMetadata && (createdDate || requestDate || updatedDate) ? `
      <div class="mb-4 flex flex-wrap gap-3 text-xs text-on-surface-variant">
        ${createdDate ? `<div class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span> Créé: ${createdDate}</div>` : ''}
        ${requestDate ? `<div class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">event</span> Demandé: ${requestDate}</div>` : ''}
        ${updatedDate ? `<div class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">update</span> Modifié: ${updatedDate}</div>` : ''}
      </div>
    ` : ''}

    <div class="flex items-center justify-between mt-auto ${taskViewMode === 4 ? 'pt-1 border-t-0' : 'pt-4 border-t'} border-surface-container-low">
      <div class="flex items-center ${taskViewMode === 4 ? 'gap-1.5' : 'gap-4'} overflow-hidden">
        ${task.requester && taskViewMode !== 4 ? `<div class="flex items-center gap-1.5 text-xs text-secondary-improved overflow-hidden">
          <span class="material-symbols-outlined text-base flex-shrink-0">folder</span>
          <span class="truncate">${escHtml(task.requester)}</span>
        </div>` : ''}
        ${task.files && task.files.length > 0 ? `<div class="flex items-center gap-1 ${taskViewMode === 4 ? 'text-[10px]' : 'text-xs'} text-secondary-improved">
          <span class="material-symbols-outlined ${taskViewMode === 4 ? 'text-xs' : 'text-base'}">attach_file</span>
          <span>${task.files.length}</span>
        </div>` : ''}
      </div>
      ${task.deadline && !isArchive && taskViewMode !== 4 ? getDeadlineProgress(task) : ''}
      ${task.deadline && !isArchive && taskViewMode === 4 ? getDeadlineProgressCompact(task, task.urgency) : ''}
    </div>
  `;
  return card;
}

// ............................................................
//  DEADLINE PROGRESS INDICATOR
// ............................................................

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

function getDeadlineProgressCompact(task, urgency = 'low') {
  if (!task.deadline) return '';

  const now = new Date();
  const deadline = new Date(task.deadline);

  // Calculer les jours restants
  const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

  // Utiliser la même couleur que le badge d'urgence
  const urgencyColors = {
    low: 'bg-[#0891b2]',      // Cyan (Faible)
    medium: 'bg-[#f59e0b]',   // Orange (Moyenne)
    high: 'bg-[#dc2626]'      // Rouge (Urgente)
  };

  const bgClass = urgencyColors[urgency || 'low'];

  const deadlineFormatted = new Date(task.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const daysLabel = Math.abs(daysRemaining) > 1 ? 'j' : 'j';

  return `
    <div class="flex items-center gap-1">
      <div class="${bgClass} text-white px-2 py-1 rounded-md text-[10px] font-bold shadow-sm" title="Échéance : ${deadlineFormatted}">
        ${Math.abs(daysRemaining)}${daysLabel}
      </div>
    </div>
  `;
}

// ............................................................
//  STATS + COMPTEURS ONGLETS
// ............................................................

// Removed obsolete functions - replaced by renderDashboard()

// ............................................................
//  UTILITAIRES
// ............................................................

function resetForm() {
  document.getElementById('taskTitle').value         = '';
  document.getElementById('taskComment').value       = '';
  document.getElementById('taskDeadline').value      = '';
  document.getElementById('taskRequestDate').value   = toLocalDateInputValue(new Date()); // Date du jour
  document.getElementById('taskRequester').value     = '';
  document.getElementById('taskType').value          = '';
  document.getElementById('taskOrder').value         = '';

  // Reset checkboxes
  document.querySelectorAll('.requester-checkbox, .type-checkbox').forEach(cb => cb.checked = false);
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

// ............................................................
//  GESTION DES FICHIERS JOINTS
// ............................................................

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
  showToast(`🗑️ Le fichier "${file.name}" a été supprimé`);
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
  if (!text) return '';

  // Si marked n'est pas disponible, échapper le HTML
  if (typeof marked === 'undefined') return escHtml(text);

  try {
    // Configure marked pour plus de sécurité
    marked.setOptions({ breaks: true, gfm: true });

    // Parse le Markdown
    const dirty = marked.parse(text);

    // Sanitize avec DOMPurify pour prévenir les attaques XSS
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                       'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'a', 'hr', 'table', 'thead',
                       'tbody', 'tr', 'th', 'td', 'img'],
        ALLOWED_ATTR: ['href', 'title', 'alt', 'src'],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ALLOW_DATA_ATTR: false
      });
    }

    // Fallback si DOMPurify n'est pas disponible (ne devrait pas arriver)
    return dirty;
  } catch (error) {
    console.error('Erreur lors du rendu Markdown:', error);
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
        <h3 class="font-bold text-lg mb-2">🔒 Sécurité et stockage</h3>
        <p class="text-sm text-on-surface-variant mb-2">Vos données sont chiffrées localement avec <strong>AES-256-GCM</strong> et stockées dans <strong>IndexedDB</strong>.</p>
        <ul class="text-xs text-on-surface-variant space-y-1 ml-4">
          <li>🔑 Chiffrement : PBKDF2 avec 310 000 itérations</li>
          <li>💾 Stockage : 100% local dans votre navigateur</li>
          <li>🔌 Aucune connexion serveur requise</li>
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
        <h3 class="font-bold text-lg mb-2">↩️ Archives</h3>
        <p class="text-sm text-on-surface-variant">Archivez vos tâches et projets terminés. Vous pouvez les restaurer à tout moment en passant la souris sur la carte et en cliquant sur l'icône de restauration.</p>
      </div>
      <div>
        <h3 class="font-bold text-lg mb-2">📥📤 Import/Export</h3>
        <p class="text-sm text-on-surface-variant">Exportez vos données en JSON ou Excel depuis Import/Export. Le format JSON inclut toutes vos données chiffrées (tâches, projets, versions, configuration).</p>
      </div>
      <div class="pt-4 border-t border-outline-variant">
        <p class="text-xs text-on-surface-variant text-center">
          <strong>TaskMDA v5.0</strong> - Application développée par <strong>Frédérick MURAT</strong><br>
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

// ............................................................
//  IMPORT / EXPORT
// ............................................................

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
        statusEl.textContent = '❌- JSON invalide';
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
  showToast(`Export JSON réussi (${tasks.length} tâche(s) + ${projects.length} projet(s))`);
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
    'Archive_le':  t.archivedAt  ? new Date(t.archivedAt).toLocaleDateString('fr-FR') : ''
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
    'Date_debut':  p.startDate ? new Date(p.startDate).toLocaleDateString('fr-FR') : '',
    Date_fin:    p.endDate ? new Date(p.endDate).toLocaleDateString('fr-FR') : '',
    Progression: p.progress + '%',
    Description: p.description || '',
    'Archive_le':  p.archivedAt ? new Date(p.archivedAt).toLocaleDateString('fr-FR') : ''
  })));
  XLSX.utils.book_append_sheet(wb, wsProjects, 'Projets');

  // Export
  XLSX.writeFile(wb, 'TaskMDA_Export.xlsx');
  showToast(`Export Excel réussi (${tasks.length} tâche(s) + ${projects.length} projet(s))`);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'),{href:url,download:name});
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// "?"? Anim shake "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
document.head.insertAdjacentHTML('beforeend',`<style>
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
</style>`);

// "?"? Show/hide password "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
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

// ............................................................
//  GESTION DES VERSIONS
// ............................................................

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
    showToast('Veuillez remplir tous les champs');
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
  showToast(`🗑️ La version ${software} a été supprimée avec succès`);
}

function renderVersionsList() {
  const container = document.getElementById('versionsList');
  if (!container) return;

  const entries = Object.entries(versions);

  if (entries.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--muted);">
        <div style="font-size:2rem;margin-bottom:0.5rem;opacity:0.4;">📋</div>
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
        <button class="btn btn-danger btn-sm" onclick="deleteVersion('${escHtml(software)}')">🗑️</button>
      </div>`;
  });
  html += '</div>';

  container.innerHTML = html;
}

// ............................................................
//  GESTION DES DEMANDEURS
// ............................................................

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
    showToast('Veuillez saisir un nom');
    return;
  }

  // Check if already exists
  if (config.requesters.some(r => r.name.toLowerCase() === name.toLowerCase())) {
    showToast('Ce demandeur existe déjà');
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
  showToast(`🗑️ Le demandeur "${name}" a été supprimé avec succès`);

  // Refresh forms
  updateRequesterSelects();
}

async function updateRequester(oldName, newName, newEmail) {
  const requester = config.requesters.find(r => r.name === oldName);
  if (!requester) return;

  if (!newName.trim()) {
    showToast('Le nom ne peut pas être vide');
    return;
  }

  // Check if new name already exists (but not the same one)
  if (newName !== oldName && config.requesters.some(r => r.name.toLowerCase() === newName.toLowerCase())) {
    showToast('Ce nom existe déjà');
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

// ............................................................
//  GESTION DES TYPES
// ............................................................

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
    showToast('Veuillez saisir un type');
    return;
  }

  // Check if already exists
  if (config.types.some(t => t.toLowerCase() === name.toLowerCase())) {
    showToast('Ce type existe déjà');
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
  showToast(`🗑️ Le type "${name}" a été supprimé avec succès`);

  // Refresh forms
  updateTypeSelects();
}

async function updateType(oldName, newName) {
  const index = config.types.findIndex(t => t === oldName);
  if (index === -1) return;

  if (!newName.trim()) {
    showToast('Le nom ne peut pas être vide');
    return;
  }

  // Check if new name already exists (but not the same one)
  if (newName !== oldName && config.types.some(t => t.toLowerCase() === newName.toLowerCase())) {
    showToast('Ce nom existe déjà');
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
        <div class="text-4xl mb-2 opacity-40">🏷️</div>
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

// ............................................................
//  GESTION DES TEMPLATES D'EMAILS
// ............................................................

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
{{SUJET}}{{ORDER}}========================================

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
{{SUJET}}{{ORDER}}========================================

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
    showToast('Veuillez remplir l\'objet et le corps de l\'email');
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

  showToast('Le template a été réinitialisé (cliquez sur "Enregistrer" pour confirmer)');
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

  // Replace {{SUJET}} (with conditional display)
  if (task.type && task.type.trim()) {
    text = text.replace(/\{\{SUJET\}\}/g, `- Sujet : ${task.type}\n`);
  } else {
    text = text.replace(/\{\{SUJET\}\}/g, '');
  }

  // Legacy support for {{TYPE}}
  if (task.type && task.type.trim()) {
    text = text.replace(/\{\{TYPE\}\}/g, `- Sujet : ${task.type}\n`);
  } else {
    text = text.replace(/\{\{TYPE\}\}/g, '');
  }

  // Replace {{ORDER}} (with conditional display)
  if (task.order && task.order.trim()) {
    text = text.replace(/\{\{ORDER\}\}/g, `- Reference : ${task.order}\n`);
  } else {
    text = text.replace(/\{\{ORDER\}\}/g, '');
  }

  // Add signature if configured
  if (config.emailSignature) {
    const signature = buildEmailSignature();
    if (signature) {
      text += '\n\n' + signature;
    }
  }

  return text;
}

// ............................................................
//  EMAIL SIGNATURE MANAGEMENT
// ............................................................

function buildEmailSignature() {
  if (!config.emailSignature) return '';

  let signature = '';

  if (config.emailSignature.text) {
    signature = config.emailSignature.text;
  }

  // Note: Les images ne peuvent pas être intégrées dans les liens mailto:
  // L'utilisateur devra ajouter l'image manuellement dans son client email

  return signature;
}

async function saveEmailSignature() {
  const text = document.getElementById('emailSignatureText').value.trim();

  if (!config.emailSignature) {
    config.emailSignature = {};
  }

  config.emailSignature.text = text;

  await saveToStorage();
  showToast('Signature email enregistrée avec succès');
}

// Load signature on settings view
function loadEmailSignature() {
  const textArea = document.getElementById('emailSignatureText');

  if (textArea && config.emailSignature?.text) {
    textArea.value = config.emailSignature.text;
  }
}

// ............................................................
//  APP BRANDING MANAGEMENT
// ............................................................

async function saveAppBranding() {
  const name = document.getElementById('appNameInput').value.trim();
  const tagline = document.getElementById('appTaglineInput').value.trim();

  if (!name) {
    showToast('Le nom de l\'application ne peut pas être vide');
    return;
  }

  if (!config.branding) {
    config.branding = {};
  }

  config.branding.appName = name;
  config.branding.appTagline = tagline;

  await saveToStorage();
  updateAppBranding();
  showToast('Identité de l\'application enregistrée');
}

function updateAppBranding() {
  const appName = document.getElementById('appName');
  const appTagline = document.getElementById('appTagline');

  if (appName && config.branding?.appName) {
    appName.textContent = config.branding.appName;
  }

  if (appTagline) {
    if (config.branding?.appTagline) {
      appTagline.textContent = config.branding.appTagline;
    } else if (!config.branding?.appName) {
      // Keep default if no custom branding
      appTagline.textContent = 'Gestion de Projets';
    }
  }
}

function loadAppBrandingSettings() {
  const nameInput = document.getElementById('appNameInput');
  const taglineInput = document.getElementById('appTaglineInput');

  if (nameInput) {
    nameInput.value = config.branding?.appName || 'TaskMDA';
  }

  if (taglineInput) {
    taglineInput.value = config.branding?.appTagline || 'Gestion de Projets';
  }
}

// ............................................................
//  PROJECTS & GANTT CHART
// ............................................................

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

  modal.classList.remove('hidden');
}

function closeProjectModal() {
  document.getElementById('projectModal').classList.add('hidden');
  editingProjectId = null;
}

async function archiveProject(id) {
  // Si appelé depuis le modal d'édition, utiliser editingProjectId
  // Si appelé depuis le modal de détail, utiliser le paramètre id
  const projectId = id || editingProjectId;
  if (!projectId) return;

  const project = projects.find(p => p.id === projectId);
  if (!project || project.archivedAt) return;

  // Archive the project
  const projectName = project.name;
  project.archivedAt = new Date().toISOString();

  await saveToStorage();
  closeProjectModal();
  updateProjectCount();
  renderGanttChart();
  renderProjectCards();
  renderArchivedProjects();
  showToast(`📦 Le projet "${projectName}" a été archivé avec succès`);
}

async function restoreProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project || !project.archivedAt) return;

  // Restaurer le projet : supprimer archivedAt
  projects = projects.map(p => p.id === id ? { ...p, archivedAt: null, updatedAt: new Date().toISOString() } : p);

  await saveToStorage();
  updateProjectCount();

  showToast(`↩️ Le projet "${project.name}" a été restauré avec succès`);

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
    showToast('Le nom du projet est obligatoire');
    nameInput.focus();
    return;
  }

  // Validation de la date de début
  if (!startDate) {
    const startDateInput = document.getElementById('projectStartDate');
    shake(startDateInput);
    showToast('La date de début est obligatoire');
    startDateInput.focus();
    return;
  }

  // Validation de la date de fin
  if (!endDate) {
    const endDateInput = document.getElementById('projectEndDate');
    shake(endDateInput);
    showToast('La date de fin est obligatoire');
    endDateInput.focus();
    return;
  }

  // Validation de la cohérence des dates
  if (new Date(endDate) < new Date(startDate)) {
    const endDateInput = document.getElementById('projectEndDate');
    shake(endDateInput);
    showToast('La date de fin doit être après la date de début');
    endDateInput.focus();
    return;
  }

  // Validation des demandeurs
  if (!requesters || requesters.length === 0) {
    showToast('Veuillez sélectionner au moins un demandeur');
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
  ganttViewMode = mode === 'weeks' ? 'week' : mode;

  // Update button states
  const quarterBtn = document.getElementById('viewQuarter');
  const monthBtn = document.getElementById('viewMonth');
  const weeksBtn = document.getElementById('viewWeeks');

  // Reset all buttons
  [quarterBtn, monthBtn, weeksBtn].forEach(btn => {
    if (btn) {
      btn.classList.remove('bg-primary', 'text-white');
      btn.classList.add('text-on-surface-variant', 'hover:bg-surface-container');
    }
  });

  // Activate current button
  const activeBtn = mode === 'quarter' ? quarterBtn : mode === 'month' ? monthBtn : weeksBtn;
  if (activeBtn) {
    activeBtn.classList.add('bg-primary', 'text-white');
    activeBtn.classList.remove('text-on-surface-variant', 'hover:bg-surface-container');
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
    const hasSearch = searchQuery.length > 0;
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 px-4">
        ${hasSearch ? `
          <div class="text-center">
            <span class="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block opacity-40">folder_open</span>
            <p class="text-lg font-semibold text-on-surface mb-2">Aucun projet</p>
            <p class="text-on-surface-variant">Aucun projet ne correspond à votre recherche</p>
          </div>
        ` : `
          <div class="max-w-2xl w-full bg-surface-container-low border-2 border-dashed border-outline-variant rounded-3xl p-12 text-center">
            <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-container flex items-center justify-center">
              <span class="material-symbols-outlined text-5xl text-primary">add</span>
            </div>
            <h3 class="text-2xl font-bold text-on-surface mb-3">Créer votre premier projet</h3>
            <p class="text-on-surface-variant mb-6 max-w-md mx-auto">
              Visualisez l'avancement et les échéances de vos initiatives stratégiques.
            </p>
            <button onclick="openProjectModal()" class="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
              <span class="material-symbols-outlined">add</span>
              Nouveau projet
            </button>
          </div>
        `}
      </div>
    `;
    return;
  }

  // Calculate timeline range
  const allDates = activeProjects.flatMap(p => [new Date(p.startDate), new Date(p.endDate)]);
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));

  // Extend range to show full context based on zoom level
  if (ganttViewMode === 'quarter') {
    minDate.setMonth(minDate.getMonth() - 3);
    maxDate.setMonth(maxDate.getMonth() + 3);
  } else if (ganttViewMode === 'month') {
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 1);
  } else {
    // weeks
    minDate.setDate(minDate.getDate() - 14);
    maxDate.setDate(maxDate.getDate() + 14);
  }

  // Get appropriate time labels
  let timeLabels;
  if (ganttViewMode === 'quarter') {
    timeLabels = getQuartersBetween(minDate, maxDate);
  } else if (ganttViewMode === 'month') {
    timeLabels = getMonthsBetween(minDate, maxDate);
  } else {
    // SEMAINES : ajuster minDate au lundi AVANT de générer les semaines
    const day = minDate.getDay();
    const diff = minDate.getDate() - day + (day === 0 ? -6 : 1);
    minDate.setDate(diff);
    minDate.setHours(0, 0, 0, 0);

    timeLabels = getWeeksBetween(minDate, maxDate);

    // Ajuster maxDate pour être à la fin de la dernière semaine
    const lastWeekEnd = new Date(minDate);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + (timeLabels.length * 7));
    maxDate.setTime(lastWeekEnd.getTime());
  }

  // Build HTML with responsive grid
  const totalColumns = timeLabels.length;

  // Pour les semaines, utiliser une largeur fixe pour forcer le scroll
  // Pour mois/trimestres, utiliser 1fr pour s'adapter
  const columnWidth = ganttViewMode === 'week' ? '100px' : '1fr';

  // Calculer la largeur totale en mode semaines
  const totalWidth = ganttViewMode === 'week' ? `${(totalColumns * 100) + 256}px` : '100%';
  const wrapperDisplay = ganttViewMode === 'week' ? 'inline-block' : 'block';

  // Wrapper - en mode semaines, on force une largeur fixe avec inline-block pour ne pas forcer le parent
  let html = `<div style="width: ${totalWidth}; display: ${wrapperDisplay};">`;

  // Header row with time labels
  if (ganttViewMode === 'month' || ganttViewMode === 'quarter') {
    // Mode MOIS/TRIMESTRES : affichage simple sur une ligne
    html += '<div class="flex border-b border-surface-container min-w-0">';
    html += '<div class="w-48 lg:w-64 p-3 lg:p-4 font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-r border-surface-container shrink-0">Nom du projet</div>';
    html += `<div class="flex-1 grid border-l border-surface-container/30 min-w-0" style="grid-template-columns: repeat(${totalColumns}, ${columnWidth});">`;
    timeLabels.forEach(label => {
      const displayLabel = typeof label === 'string' ? label : label.day;
      html += `<div class="p-2 lg:p-4 font-label text-[9px] lg:text-[10px] font-bold text-on-surface-variant text-center border-r border-surface-container/30 last:border-r-0">${displayLabel}</div>`;
    });
    html += '</div>';
    html += '</div>';
  } else {
    // Mode SEMAINES : affichage sur deux lignes (mois + semaines)
    // Ligne 1 : Les mois (avec fusion des colonnes pour chaque mois)
    html += '<div class="flex border-b border-surface-container/50">';
    html += '<div class="w-48 lg:w-64 font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-r border-surface-container shrink-0"></div>';
    html += '<div class="flex border-l border-surface-container/30">';

    // Grouper par mois
    let currentMonthLabel = null;
    let currentMonthSpan = 0;

    timeLabels.forEach((weekData, index) => {
      if (weekData.monthLabel !== currentMonthLabel) {
        // Afficher le mois précédent si nécessaire
        if (currentMonthLabel !== null) {
          html += `<div class="p-2 lg:p-3 font-label text-[9px] lg:text-[10px] font-bold text-on-surface-variant text-center border-r border-surface-container/30 bg-surface-container/30" style="width: ${currentMonthSpan * 100}px;">${currentMonthLabel}</div>`;
        }
        // Commencer un nouveau mois
        currentMonthLabel = weekData.monthLabel;
        currentMonthSpan = 1;
      } else {
        currentMonthSpan++;
      }

      // Dernier élément : afficher le mois en cours
      if (index === timeLabels.length - 1) {
        html += `<div class="p-2 lg:p-3 font-label text-[9px] lg:text-[10px] font-bold text-on-surface-variant text-center border-r-0 bg-surface-container/30" style="width: ${currentMonthSpan * 100}px;">${currentMonthLabel}</div>`;
      }
    });

    html += '</div>';
    html += '</div>';

    // Ligne 2 : Les numéros de semaines
    html += '<div class="flex border-b border-surface-container">';
    html += '<div class="w-48 lg:w-64 p-3 lg:p-4 font-label text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-r border-surface-container shrink-0">Nom du projet</div>';
    html += `<div class="grid border-l border-surface-container/30" style="grid-template-columns: repeat(${totalColumns}, ${columnWidth});">`;
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
    const timelineClass = ganttViewMode === 'week' ? '' : 'flex-1';
    html += `<div class="${timelineClass} relative h-20 lg:h-24 py-6 lg:py-8 grid" style="grid-template-columns: repeat(${totalColumns}, ${columnWidth});">`;

    // Calculate bar position
    let barPositionStyle;
    if (ganttViewMode === 'week') {
      // En mode SEMAINES : utiliser des positions en pixels
      const totalWidth = totalColumns * 100; // 100px par colonne
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
      const startDays = (projectStart - minDate) / (1000 * 60 * 60 * 24);
      const durationDays = (projectEnd - projectStart) / (1000 * 60 * 60 * 24);
      const leftPx = (startDays / totalDays) * totalWidth;
      const widthPx = (durationDays / totalDays) * totalWidth;
      barPositionStyle = `left: ${Math.max(0, leftPx)}px; width: ${Math.max(20, widthPx)}px;`;
    } else {
      // En mode MOIS/TRIMESTRES : utiliser des pourcentages
      const bar = calculateBarPosition(project, minDate, maxDate, timeLabels.length);
      barPositionStyle = `left: ${bar.left}%; width: ${bar.width}%;`;
    }

    const barStyle = project.status === 'en-cours'
      ? `background: ${color.bgGradient}`
      : `background-color: ${color.bg}`;

    html += `
      <div class="absolute h-6 lg:h-8 rounded-full flex items-center justify-center px-2 lg:px-4 shadow-sm cursor-pointer transition-all hover:shadow-md col-span-full"
           style="${barPositionStyle} ${barStyle}; color: ${color.text}; top: 50%; transform: translateY(-50%);"
           onclick="openProjectDetailModal(${project.id}, false)"
           title="${escHtml(project.name)} - ${project.progress}%">
        <span class="text-[10px] lg:text-[11px] font-bold">${project.progress}%</span>
      </div>
    `;
    html += '</div>';

    html += '</div>';
  });

  html += '</div>'; // Ferme le div des projets
  html += '</div>'; // Ferme le wrapper
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
    const hasSearch = searchQuery.length > 0;
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 px-4">
        ${hasSearch ? `
          <div class="text-center">
            <span class="material-symbols-outlined text-6xl text-on-surface-variant mb-4 block opacity-40">folder_open</span>
            <p class="text-lg font-semibold text-on-surface mb-2">Aucun projet</p>
            <p class="text-on-surface-variant">Aucun projet ne correspond à votre recherche</p>
          </div>
        ` : `
          <div class="max-w-2xl w-full bg-surface-container-low border-2 border-dashed border-outline-variant rounded-3xl p-12 text-center">
            <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-container flex items-center justify-center">
              <span class="material-symbols-outlined text-5xl text-primary">add</span>
            </div>
            <h3 class="text-2xl font-bold text-on-surface mb-3">Démarrer un nouveau projet</h3>
            <p class="text-on-surface-variant mb-6 max-w-md mx-auto">
              Créez un projet solo ou collaboratif pour organiser les tâches, documents et échanges de votre équipe.
            </p>
            <button onclick="openProjectModal()" class="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
              <span class="material-symbols-outlined">add</span>
              Nouveau projet
            </button>
          </div>
        `}
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
      <div class="bg-surface-container-low rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer" onclick="openProjectDetailModal(${project.id}, false)">
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

function getDaysBetween(start, end) {
  const days = [];
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const current = new Date(start);
  const currentYear = new Date().getFullYear();
  const spansMultipleYears = start.getFullYear() !== end.getFullYear();

  let lastMonth = -1;
  let lastYear = -1;

  while (current <= end) {
    const currentMonth = current.getMonth();
    const month = monthNames[currentMonth];
    const year = current.getFullYear();
    const day = current.getDate();

    const dayData = {
      month: currentMonth,
      year: year,
      monthLabel: (spansMultipleYears || year !== currentYear) ? `${month} ${year}` : month,
      day: day,
      isNewMonth: currentMonth !== lastMonth || year !== lastYear
    };

    days.push(dayData);

    lastMonth = currentMonth;
    lastYear = year;
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function getQuartersBetween(start, end) {
  const quarters = [];
  const current = new Date(start);
  const currentYear = new Date().getFullYear();
  const spansMultipleYears = start.getFullYear() !== end.getFullYear();

  // Move to start of quarter
  const startQuarter = Math.floor(current.getMonth() / 3);
  current.setMonth(startQuarter * 3);
  current.setDate(1);

  while (current <= end) {
    const year = current.getFullYear();
    const quarter = Math.floor(current.getMonth() / 3) + 1;
    const label = `Q${quarter}`;

    if (spansMultipleYears || year !== currentYear) {
      quarters.push(`${label} ${year}`);
    } else {
      quarters.push(label);
    }

    current.setMonth(current.getMonth() + 3);
  }

  return quarters;
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





