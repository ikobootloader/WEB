// PATCH POUR ARCHIVAGE DES PROJETS
// Ce code doit être intégré dans taskmda-team.js

// ====================================================================
// VARIABLES ET ÉTAT
// ====================================================================
let projectsViewMode = 'grid'; // 'grid' | 'list' | 'archives'

// ====================================================================
// FONCTIONS D'ARCHIVAGE
// ====================================================================

/**
 * Archive un projet
 */
async function archiveProject(projectId) {
  if (!projectId) return false;

  const confirmed = window.confirm('Archiver ce projet ?\n\nLe projet sera masqué de la liste principale mais restera accessible dans les archives.');
  if (!confirmed) return false;

  const project = await getDecrypted('projects', projectId, 'projectId');
  if (!project) {
    showToast('❌ Projet introuvable');
    return false;
  }

  project.archivedAt = Date.now();
  project.archivedBy = currentUser?.userId || null;

  await putEncrypted('projects', project, 'projectId');

  await logActivity({
    projectId,
    type: 'ARCHIVE_PROJECT',
    userId: currentUser?.userId,
    userName: currentUser?.name || 'Utilisateur',
    details: { projectName: project.name }
  });

  showToast('✅ Projet archivé avec succès');

  // Si on est sur la page de détail du projet, retourner à la liste
  if (workspaceMode === 'project' && currentProjectId === projectId) {
    showDashboard();
  } else {
    // Recharger la liste des projets
    await renderProjects();
  }

  return true;
}

/**
 * Restaure un projet archivé
 */
async function restoreProject(projectId) {
  if (!projectId) return false;

  const confirmed = window.confirm('Restaurer ce projet ?\n\nLe projet redeviendra visible dans la liste principale.');
  if (!confirmed) return false;

  const project = await getDecrypted('projects', projectId, 'projectId');
  if (!project) {
    showToast('❌ Projet introuvable');
    return false;
  }

  delete project.archivedAt;
  delete project.archivedBy;

  await putEncrypted('projects', project, 'projectId');

  await logActivity({
    projectId,
    type: 'RESTORE_PROJECT',
    userId: currentUser?.userId,
    userName: currentUser?.name || 'Utilisateur',
    details: { projectName: project.name }
  });

  showToast('✅ Projet restauré avec succès');

  // Si on est sur la page de détail du projet, recharger
  if (workspaceMode === 'project' && currentProjectId === projectId) {
    await showProject(projectId);
  } else {
    // Recharger la liste des projets
    if (projectsViewMode === 'archives') {
      await renderProjectsArchives();
    } else {
      await renderProjects();
    }
  }

  return true;
}

// ====================================================================
// RENDU DES ARCHIVES
// ====================================================================

/**
 * Affiche la section des projets archivés
 */
async function renderProjectsArchives() {
  const section = document.getElementById('projects-archives-section');
  const container = document.getElementById('projects-archives-container');
  const emptyState = document.getElementById('projects-archives-empty');
  const countEl = document.getElementById('projects-archives-count');
  const projectsList = document.getElementById('projects-list');
  const carousel = document.getElementById('projects-carousel');
  const newsSection = document.getElementById('dashboard-news');

  if (!section || !container) return;

  // Masquer les autres vues
  if (projectsList) projectsList.classList.add('hidden');
  if (carousel) carousel.classList.add('hidden');
  if (newsSection) newsSection.classList.add('hidden');

  // Afficher la section archives
  section.classList.remove('hidden');

  // Récupérer tous les projets archivés
  const allProjects = await getAllDecrypted('projects', 'projectId') || [];
  const archivedProjects = allProjects.filter(p => p.archivedAt && !p.deletedAt);

  // Mettre à jour le compteur
  if (countEl) {
    const count = archivedProjects.length;
    countEl.textContent = `${count} projet${count !== 1 ? 's' : ''} archivé${count !== 1 ? 's' : ''}`;
  }

  if (archivedProjects.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  // Trier par date d'archivage (plus récents en premier)
  archivedProjects.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));

  // Récupérer l'état de chaque projet
  const stateByProjectId = new Map();
  for (const project of archivedProjects) {
    const state = await getProjectState(project.projectId);
    if (state) {
      stateByProjectId.set(project.projectId, state);
    }
  }

  // Générer le HTML
  container.innerHTML = archivedProjects.map(project => {
    const state = stateByProjectId.get(project.projectId);
    const isPrivate = project.sharingMode === 'private';
    const icon = isPrivate ? 'lock' : 'groups';
    const badge = isPrivate
      ? '<span class="workspace-chip workspace-chip-private">PRIVE</span>'
      : '<span class="workspace-chip workspace-chip-shared">PARTAGE</span>';

    const visibleTasks = (state?.tasks || []).filter(t => !t.archivedAt);
    const completedTasks = visibleTasks.filter(t => t.status === 'termine');
    const progress = visibleTasks.length > 0
      ? Math.round((completedTasks.length / visibleTasks.length) * 100)
      : 0;
    const progressClass = progress === 100 ? 'bg-emerald-500' : 'bg-primary';
    const progressStyle = `width: ${progress}%`;

    const archivedDate = new Date(project.archivedAt).toLocaleDateString('fr-FR');

    // Participants
    const memberIds = new Set((state?.members || [])
      .map((member) => String(member?.userId || '').trim())
      .filter(Boolean));
    const hasCreatedByFallback = !memberIds.size && String(project?.createdBy || '').trim();
    const displayedMembersCount = memberIds.size + (hasCreatedByFallback ? 1 : 0);
    const participantsHtml = displayedMembersCount > 0
      ? `<span class="material-symbols-outlined text-[18px]">group</span>`
      : '';
    const creatorTooltip = displayedMembersCount > 0
      ? `${displayedMembersCount} membre${displayedMembersCount > 1 ? 's' : ''}`
      : 'Aucun membre';

    return `
      <div class="project-card workspace-card-shell rounded-xl border transition-all cursor-pointer" data-project-id="${escapeHtml(project.projectId)}" onclick="showProject('${escapeHtml(project.projectId)}')">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-slate-400">${icon}</span>
            ${badge}
            <span class="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-semibold bg-amber-100 text-amber-700">
              <span class="material-symbols-outlined text-[12px]">archive</span>
              <span>Archivé le ${escapeHtml(archivedDate)}</span>
            </span>
          </div>
          <button class="card-quick-btn card-quick-btn-success" onclick="event.stopPropagation(); restoreProject('${escapeHtml(project.projectId)}')" title="Restaurer le projet">
            <span class="material-symbols-outlined">unarchive</span>
          </button>
        </div>
        <h3 class="workspace-card-title text-lg font-bold text-gray-900 mb-2">${escapeHtml(project.name)}</h3>
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <span class="material-symbols-outlined text-lg">calendar_today</span>
            <span>${new Date(project.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
          <div class="flex items-center gap-2">
            <span title="${escapeHtml(creatorTooltip)}" aria-label="${escapeHtml(creatorTooltip)}">${participantsHtml}</span>
            <span class="text-[11px] font-semibold text-slate-500">${isPrivate ? 'Visibilité privée' : 'Visibilité collaborative'}</span>
          </div>
        </div>
        <div class="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full ${progressClass}" style="${progressStyle}"></div>
        </div>
        <div class="mt-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">${progress}% complété</div>
      </div>
    `;
  }).join('');
}

// ====================================================================
// GESTION DES VUES
// ====================================================================

/**
 * Bascule entre les différentes vues de projets
 */
function setProjectsViewMode(mode) {
  projectsViewMode = mode;

  const gridBtn = document.getElementById('projects-view-grid');
  const listBtn = document.getElementById('projects-view-list');
  const archivesBtn = document.getElementById('projects-view-archives');

  // Mettre à jour les boutons actifs
  if (gridBtn) gridBtn.classList.toggle('view-tab-active', mode === 'grid');
  if (listBtn) listBtn.classList.toggle('view-tab-active', mode === 'list');
  if (archivesBtn) archivesBtn.classList.toggle('view-tab-active', mode === 'archives');

  // Afficher la vue correspondante
  if (mode === 'archives') {
    renderProjectsArchives();
  } else {
    // Masquer la section archives
    const archivesSection = document.getElementById('projects-archives-section');
    if (archivesSection) archivesSection.classList.add('hidden');

    // Afficher la liste normale
    const projectsList = document.getElementById('projects-list');
    if (projectsList) projectsList.classList.remove('hidden');

    renderProjects();
  }
}

// ====================================================================
// INITIALISATION DES EVENT LISTENERS
// ====================================================================

// À ajouter dans la fonction d'initialisation principale
function initProjectArchives() {
  // Boutons de vue
  const gridBtn = document.getElementById('projects-view-grid');
  const listBtn = document.getElementById('projects-view-list');
  const archivesBtn = document.getElementById('projects-view-archives');

  if (gridBtn) {
    gridBtn.addEventListener('click', () => setProjectsViewMode('grid'));
  }

  if (listBtn) {
    listBtn.addEventListener('click', () => setProjectsViewMode('list'));
  }

  if (archivesBtn) {
    archivesBtn.addEventListener('click', () => setProjectsViewMode('archives'));
  }

  // Boutons d'archivage/restauration dans la vue détail
  const btnArchive = document.getElementById('btn-archive-project');
  const btnRestore = document.getElementById('btn-restore-project');

  if (btnArchive) {
    btnArchive.addEventListener('click', async () => {
      if (currentProjectId) {
        await archiveProject(currentProjectId);
      }
    });
  }

  if (btnRestore) {
    btnRestore.addEventListener('click', async () => {
      if (currentProjectId) {
        await restoreProject(currentProjectId);
      }
    });
  }
}

// Appeler initProjectArchives() dans le DOMContentLoaded

// ====================================================================
// MODIFICATION DE LA FONCTION renderProjects EXISTANTE
// ====================================================================

// Dans la fonction renderProjects(), ajouter ce filtre au début :
// const allProjects = await getAllDecrypted('projects', 'projectId') || [];
// const projects = allProjects.filter(p => !p.deletedAt && !p.archivedAt); // Exclure les archivés

// ====================================================================
// MODIFICATION DE LA FONCTION showProject EXISTANTE
// ====================================================================

// Dans showProject(), après avoir chargé le projet, afficher/masquer les boutons :
/*
const btnArchive = document.getElementById('btn-archive-project');
const btnRestore = document.getElementById('btn-restore-project');

if (btnArchive && btnRestore) {
  const isArchived = !!state.project.archivedAt;
  btnArchive.classList.toggle('hidden', isArchived);
  btnRestore.classList.toggle('hidden', !isArchived);
}
*/
