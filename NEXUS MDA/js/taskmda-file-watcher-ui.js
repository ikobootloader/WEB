// ============================================================================
// TASKMDA FILE WATCHER UI - Interface utilisateur pour la surveillance de fichiers
// ============================================================================

(function(window) {
  'use strict';

  let currentEditingWatcherId = null;
  let currentDetailWatcherId = null;
  let currentFolderHandle = null;
  let currentEventFilter = 'all';
  let isInitialized = false;

  // ============================================================================
  // UTILITAIRES
  // ============================================================================

  function debugLog(...args) {
    const APP_DEBUG = localStorage.getItem('taskmda_debug') === '1';
    if (APP_DEBUG) console.log('[FileWatcherUI]', ...args);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatInterval(ms) {
    if (ms < 60000) return `${ms / 1000}s`;
    if (ms < 3600000) return `${ms / 60000}min`;
    return `${ms / 3600000}h`;
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'Jamais';
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR');
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  // ============================================================================
  // GESTION DES PATTERNS
  // ============================================================================

  function getSelectedPatterns() {
    const patterns = [];
    const checks = document.querySelectorAll('.file-pattern-check:checked');
    checks.forEach(check => {
      const type = check.value;
      if (window.TaskMdaFileWatcher && window.TaskMdaFileWatcher.FILE_PATTERNS[type]) {
        patterns.push(...window.TaskMdaFileWatcher.FILE_PATTERNS[type]);
      }
    });

    // Ajouter les patterns personnalisés
    const customInput = document.getElementById('file-watcher-custom-patterns');
    if (customInput && customInput.value.trim()) {
      const customPatterns = customInput.value.split(',').map(p => p.trim()).filter(Boolean);
      patterns.push(...customPatterns);
    }

    return patterns.length > 0 ? patterns : ['*.*'];
  }

  function setSelectedPatterns(patterns) {
    // Décocher tous
    document.querySelectorAll('.file-pattern-check').forEach(check => {
      check.checked = false;
    });

    // Cocher selon les patterns
    const FILE_PATTERNS = window.TaskMdaFileWatcher?.FILE_PATTERNS || {};
    const customPatterns = [];

    patterns.forEach(pattern => {
      let found = false;
      for (const [type, typePatterns] of Object.entries(FILE_PATTERNS)) {
        if (typePatterns.includes(pattern)) {
          const check = document.querySelector(`.file-pattern-check[value="${type}"]`);
          if (check) check.checked = true;
          found = true;
          break;
        }
      }
      if (!found && pattern !== '*.*') {
        customPatterns.push(pattern);
      }
    });

    // Patterns personnalisés
    const customInput = document.getElementById('file-watcher-custom-patterns');
    if (customInput) {
      customInput.value = customPatterns.join(', ');
    }
  }

  // ============================================================================
  // RENDU DE LA LISTE
  // ============================================================================

  async function renderFileWatchersList() {
    const listContainer = document.getElementById('file-watchers-list');
    const emptyContainer = document.getElementById('file-watchers-empty');

    if (!listContainer || !emptyContainer) return;

    try {
      const db = await getDatabase();
      const watchers = await db.getAll('fileWatchers');

      if (watchers.length === 0) {
        listContainer.classList.add('hidden');
        emptyContainer.classList.remove('hidden');
        return;
      }

      listContainer.classList.remove('hidden');
      emptyContainer.classList.add('hidden');

      listContainer.innerHTML = watchers.map(watcher => `
        <div class="panel p-4 cursor-pointer hover:shadow-lg transition-shadow" data-watcher-id="${watcher.id}">
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-2xl ${watcher.enabled ? 'text-emerald-600' : 'text-slate-400'}">
                ${watcher.enabled ? 'folder_supervised' : 'folder_off'}
              </span>
              <div>
                <h5 class="font-bold text-slate-800">${escapeHtml(watcher.name)}</h5>
                <p class="text-xs text-slate-500">${formatInterval(watcher.pollInterval || 60000)}</p>
              </div>
            </div>
            <span class="text-xs px-2 py-1 rounded-full ${watcher.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
              ${watcher.enabled ? 'Actif' : 'Pausé'}
            </span>
          </div>
          <div class="text-xs text-slate-600 space-y-1">
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-1 font-semibold mb-0.5">
                <span class="material-symbols-outlined text-sm">schedule</span>
                <span>Dernières vérifications:</span>
              </div>
              ${(watcher.checkHistory || [watcher.lastCheckAt]).filter(Boolean).slice(0, 3).map(ts => `
                <div class="flex items-center gap-1 pl-5 text-[10px] text-slate-500">
                  <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>${formatDate(ts)}</span>
                </div>
              `).join('')}
              ${!(watcher.checkHistory?.length) && !watcher.lastCheckAt ? '<span class="pl-5 text-slate-400 italic">Aucune vérification</span>' : ''}
            </div>
            <div class="flex items-center gap-1 pt-1 border-t border-slate-100 mt-1">
              <span class="material-symbols-outlined text-sm">filter_alt</span>
              <span>${(watcher.patterns || ['*.*']).length} pattern(s)</span>
            </div>
          </div>
        </div>
      `).join('');

      // Événements clic
      listContainer.querySelectorAll('[data-watcher-id]').forEach(card => {
        card.addEventListener('click', () => {
          const watcherId = card.dataset.watcherId;
          openWatcherDetail(watcherId);
        });
      });

    } catch (error) {
      console.error('Error rendering file watchers:', error);
    }
  }

  // ============================================================================
  // CRÉATION/ÉDITION
  // ============================================================================

  function openCreateWatcherModal() {
    currentEditingWatcherId = null;
    currentFolderHandle = null;

    const modal = document.getElementById('modal-file-watcher-edit');
    const title = document.getElementById('file-watcher-edit-title');
    const form = document.getElementById('file-watcher-edit-form');

    if (!modal || !title || !form) return;

    title.textContent = 'Créer un observateur';
    form.reset();
    document.getElementById('file-watcher-edit-id').value = '';
    document.getElementById('file-watcher-folder-name').value = '';

    // Patterns par défaut
    document.querySelectorAll('.file-pattern-check').forEach(check => {
      check.checked = ['excel', 'word', 'pdf', 'csv'].includes(check.value);
    });

    // Réinitialiser l'option notification temps réel
    const realtimeCheck = document.getElementById('file-watcher-realtime-notify');
    if (realtimeCheck) realtimeCheck.checked = false;

    modal.classList.remove('hidden');
  }

  async function openEditWatcherModal(watcherId) {
    if (!watcherId) {
      console.error('openEditWatcherModal: watcherId is required');
      showToast('Erreur: ID observateur manquant', 'error');
      return;
    }

    try {
      const db = await getDatabase();
      const watcher = await db.get('fileWatchers', watcherId);

      if (!watcher) {
        showToast('Observateur introuvable', 'error');
        return;
      }

      currentEditingWatcherId = watcherId;
      currentFolderHandle = watcher.folderHandle;

      const modal = document.getElementById('modal-file-watcher-edit');
      const title = document.getElementById('file-watcher-edit-title');

      if (!modal || !title) return;

      title.textContent = 'Modifier l\'observateur';

      document.getElementById('file-watcher-edit-id').value = watcher.id;
      document.getElementById('file-watcher-name').value = watcher.name || '';
      document.getElementById('file-watcher-folder-name').value = watcher.folderHandle?.name || 'Dossier sélectionné';
      document.getElementById('file-watcher-poll-interval').value = watcher.pollInterval || 60000;
      document.getElementById('file-watcher-recursive').checked = watcher.recursive || false;
      document.getElementById('file-watcher-notify-create').checked = watcher.notifyOnCreate !== false;
      document.getElementById('file-watcher-notify-modify').checked = watcher.notifyOnModify !== false;
      document.getElementById('file-watcher-notify-delete').checked = watcher.notifyOnDelete !== false;

      const realtimeCheck = document.getElementById('file-watcher-realtime-notify');
      if (realtimeCheck) realtimeCheck.checked = !!watcher.realtimeNotify;

      setSelectedPatterns(watcher.patterns || ['*.*']);

      modal.classList.remove('hidden');

    } catch (error) {
      console.error('Error opening edit modal:', error);
      showToast('Erreur lors du chargement', 'error');
    }
  }

  async function saveFileWatcher(formData) {
    try {
      if (!currentFolderHandle) {
        showToast('Veuillez sélectionner un dossier', 'error');
        return;
      }

      const db = await getDatabase();
      const watcherId = formData.id || uuidv4();
      const isNew = !formData.id;

      const watcher = {
        id: watcherId,
        name: formData.name,
        folderHandle: currentFolderHandle,
        patterns: formData.patterns,
        pollInterval: formData.pollInterval,
        recursive: formData.recursive,
        enabled: true,
        notifyOnCreate: formData.notifyOnCreate,
        notifyOnModify: formData.notifyOnModify,
        notifyOnDelete: formData.notifyOnDelete,
        realtimeNotify: formData.realtimeNotify || false,
        createdAt: isNew ? Date.now() : undefined,
        createdBy: getCurrentUserId(),
        updatedAt: Date.now()
      };

      // Merge avec l'existant si édition
      if (!isNew) {
        const existing = await db.get('fileWatchers', watcherId);
        Object.assign(watcher, existing, watcher);
      }

      await db.put('fileWatchers', watcher);

      // Démarrer le polling
      if (window.TaskMdaFileWatcher) {
        window.TaskMdaFileWatcher.startPolling(watcher);
      }

      showToast(isNew ? 'Observateur créé avec succès' : 'Observateur mis à jour', 'success');
      closeFileWatcherEditModal();
      await renderFileWatchersList();

    } catch (error) {
      console.error('Error saving file watcher:', error);
      showToast('Erreur lors de l\'enregistrement', 'error');
    }
  }

  function closeFileWatcherEditModal() {
    const modal = document.getElementById('modal-file-watcher-edit');
    if (modal) modal.classList.add('hidden');
    currentEditingWatcherId = null;
    currentFolderHandle = null;
  }

  // ============================================================================
  // DÉTAIL
  // ============================================================================

  async function openWatcherDetail(watcherId) {
    if (!watcherId) {
      console.error('openWatcherDetail: watcherId is required');
      showToast('Erreur: ID observateur manquant', 'error');
      return;
    }

    try {
      const db = await getDatabase();
      const watcher = await db.get('fileWatchers', watcherId);

      if (!watcher) {
        showToast('Observateur introuvable', 'error');
        return;
      }

      currentDetailWatcherId = watcherId;

      const modal = document.getElementById('modal-file-watcher-detail');
      const title = document.getElementById('file-watcher-detail-title');

      if (!modal || !title) return;

      title.textContent = watcher.name;

      // Informations
      document.getElementById('file-watcher-detail-status').textContent = watcher.enabled ? 'Actif' : 'Pausé';
      document.getElementById('file-watcher-detail-status').className = watcher.enabled ? 'text-emerald-600' : 'text-slate-500';
      document.getElementById('file-watcher-detail-interval').textContent = formatInterval(watcher.pollInterval || 60000);
      document.getElementById('file-watcher-detail-recursive').textContent = watcher.recursive ? 'Oui' : 'Non';
      document.getElementById('file-watcher-detail-last-check').textContent = formatDate(watcher.lastCheckAt);

      const realtimeEl = document.getElementById('file-watcher-detail-realtime');
      if (realtimeEl) {
        realtimeEl.textContent = watcher.realtimeNotify ? 'Activé' : 'Désactivé';
        realtimeEl.className = watcher.realtimeNotify ? 'font-semibold text-emerald-600' : 'text-slate-500';
      }

      // Bouton toggle
      const toggleBtn = document.getElementById('btn-watcher-toggle');
      const toggleLabel = document.getElementById('btn-watcher-toggle-label');
      if (toggleBtn && toggleLabel) {
        toggleBtn.querySelector('.material-symbols-outlined').textContent = watcher.enabled ? 'pause' : 'play_arrow';
        toggleLabel.textContent = watcher.enabled ? 'Mettre en pause' : 'Reprendre';
      }

      // Charger les fichiers et événements
      await loadWatcherFiles(watcherId);
      await loadWatcherEvents(watcherId);

      modal.classList.remove('hidden');

    } catch (error) {
      console.error('Error opening watcher detail:', error);
      showToast('Erreur lors du chargement', 'error');
    }
  }

  async function loadWatcherFiles(watcherId) {
    if (!watcherId) {
      console.error('loadWatcherFiles: watcherId is required');
      return;
    }

    try {
      const db = await getDatabase();
      const tx = db.transaction('fileWatcherSnapshots', 'readonly');
      const store = tx.objectStore('fileWatcherSnapshots');
      const index = store.index('watcherId');
      const snapshots = await index.getAll(watcherId);

      const activeSnapshots = snapshots.filter(s => s.status === 'active');
      const count = document.getElementById('file-watcher-files-count');
      const list = document.getElementById('file-watcher-files-list');

      if (count) count.textContent = activeSnapshots.length;

      if (!list) return;

      if (activeSnapshots.length === 0) {
        list.innerHTML = '<p class="text-sm text-slate-500 p-3">Aucun fichier détecté</p>';
        return;
      }

      list.innerHTML = activeSnapshots.map(snap => `
        <div class="flex items-center justify-between p-2 border-b border-slate-100 hover:bg-slate-50">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="material-symbols-outlined text-base text-slate-400">description</span>
            <span class="text-sm text-slate-700 truncate">${escapeHtml(snap.fileName)}</span>
          </div>
          <div class="text-xs text-slate-500 whitespace-nowrap ml-2">
            ${formatFileSize(snap.size)}
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading watcher files:', error);
    }
  }

  async function loadWatcherEvents(watcherId, filter = 'all') {
    if (!watcherId) {
      console.error('loadWatcherEvents: watcherId is required');
      return;
    }

    try {
      const db = await getDatabase();
      const tx = db.transaction('fileWatcherEvents', 'readonly');
      const store = tx.objectStore('fileWatcherEvents');
      const index = store.index('watcherId');
      let events = await index.getAll(watcherId);

      // Filtrer par type
      if (filter !== 'all') {
        events = events.filter(e => e.eventType === filter);
      }

      // Trier par date décroissante
      events.sort((a, b) => b.detectedAt - a.detectedAt);

      const count = document.getElementById('file-watcher-events-count');
      const list = document.getElementById('file-watcher-events-list');

      if (count) count.textContent = events.length;

      if (!list) return;

      if (events.length === 0) {
        list.innerHTML = '<p class="text-sm text-slate-500 p-3">Aucun changement détecté</p>';
        return;
      }

      const icons = {
        created: '📄',
        modified: '✏️',
        deleted: '🗑️'
      };

      const labels = {
        created: 'Créé',
        modified: 'Modifié',
        deleted: 'Supprimé'
      };

      list.innerHTML = events.map(event => `
        <div class="flex items-start gap-2 p-2 border-b border-slate-100">
          <span class="text-lg">${icons[event.eventType] || '📁'}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-slate-700 truncate">${escapeHtml(event.fileName)}</div>
            <div class="text-xs text-slate-500">${labels[event.eventType]} • ${formatDate(event.detectedAt)}</div>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading watcher events:', error);
    }
  }

  async function toggleWatcher(watcherId) {
    if (!watcherId) {
      console.error('toggleWatcher: watcherId is required');
      showToast('Erreur: ID observateur manquant', 'error');
      return;
    }

    try {
      const db = await getDatabase();
      const watcher = await db.get('fileWatchers', watcherId);

      if (!watcher) return;

      watcher.enabled = !watcher.enabled;
      watcher.updatedAt = Date.now();

      await db.put('fileWatchers', watcher);

      if (watcher.enabled && window.TaskMdaFileWatcher) {
        window.TaskMdaFileWatcher.startPolling(watcher);
      } else if (window.TaskMdaFileWatcher) {
        window.TaskMdaFileWatcher.stopPolling(watcherId);
      }

      showToast(watcher.enabled ? 'Observateur activé' : 'Observateur mis en pause', 'success');

      // Rafraîchir
      await openWatcherDetail(watcherId);
      await renderFileWatchersList();

    } catch (error) {
      console.error('Error toggling watcher:', error);
      showToast('Erreur lors du basculement', 'error');
    }
  }

  async function checkWatcherNow(watcherId) {
    if (!watcherId) {
      console.error('checkWatcherNow: watcherId is required');
      return;
    }

    if (!window.TaskMdaFileWatcher) return;

    showToast('Vérification en cours...', 'info');

    try {
      await window.TaskMdaFileWatcher.checkWatcher(watcherId);
      showToast('Vérification terminée', 'success');

      // Rafraîchir les données
      await loadWatcherFiles(watcherId);
      await loadWatcherEvents(watcherId);

    } catch (error) {
      console.error('Error checking watcher:', error);
      showToast('Erreur lors de la vérification', 'error');
    }
  }

  async function deleteWatcher(watcherId) {
    if (!watcherId) {
      console.error('deleteWatcher: watcherId is required');
      showToast('Erreur: ID observateur manquant', 'error');
      return;
    }

    if (!confirm('Voulez-vous vraiment supprimer cet observateur ?')) return;

    try {
      const db = await getDatabase();

      // Arrêter le polling
      if (window.TaskMdaFileWatcher) {
        window.TaskMdaFileWatcher.stopPolling(watcherId);
      }

      // Supprimer l'observateur
      await db.delete('fileWatchers', watcherId);

      // Supprimer les snapshots associés
      const tx = db.transaction('fileWatcherSnapshots', 'readwrite');
      const store = tx.objectStore('fileWatcherSnapshots');
      const index = store.index('watcherId');
      const snapshots = await index.getAll(watcherId);
      for (const snap of snapshots) {
        await store.delete(snap.id);
      }
      await tx.done;

      showToast('Observateur supprimé', 'success');

      // Fermer la modale et rafraîchir
      closeWatcherDetailModal();
      await renderFileWatchersList();

    } catch (error) {
      console.error('Error deleting watcher:', error);
      showToast('Erreur lors de la suppression', 'error');
    }
  }

  function closeWatcherDetailModal() {
    const modal = document.getElementById('modal-file-watcher-detail');
    if (modal) modal.classList.add('hidden');
    currentDetailWatcherId = null;
  }

  // ============================================================================
  // GESTION DU DOSSIER
  // ============================================================================

  async function selectWatcherFolder() {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('Votre navigateur ne supporte pas la sélection de dossiers.\nUtilisez Chrome ou Edge récent.');
        return;
      }

      const handle = await window.showDirectoryPicker({
        mode: 'read'
      });

      currentFolderHandle = handle;

      const folderNameInput = document.getElementById('file-watcher-folder-name');
      if (folderNameInput) {
        folderNameInput.value = handle.name;
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting folder:', error);
        showToast('Erreur lors de la sélection du dossier', 'error');
      }
    }
  }

  // ============================================================================
  // GESTION DES ONGLETS RÉFÉRENTIELS
  // ============================================================================

  function initSettingsTabs() {
    const tabs = document.querySelectorAll('[id^="global-settings-tab-"]');
    const cards = document.querySelectorAll('[class*="global-settings-card-"]');

    if (tabs.length === 0 || cards.length === 0) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Activer l'onglet
        tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
        tab.setAttribute('aria-selected', 'true');

        // Afficher la carte correspondante
        const tabId = tab.id.replace('global-settings-tab-', '');
        cards.forEach(card => {
          if (card.classList.contains(`global-settings-card-${tabId}`)) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });

        // Si onglet file-watcher, charger la liste
        if (tabId === 'file-watcher') {
          renderFileWatchersList();
        }
      });
    });

    // Cacher toutes les cartes sauf branding par défaut
    cards.forEach(card => {
      if (!card.classList.contains('global-settings-card-branding')) {
        card.classList.add('hidden');
      }
    });
  }

  // ============================================================================
  // INITIALISATION
  // ============================================================================

  function initFileWatcherUI() {
    // Éviter la double initialisation
    if (isInitialized) {
      debugLog('FileWatcherUI already initialized, skipping');
      return;
    }

    // Gestion des onglets
    initSettingsTabs();

    // Bouton créer
    const btnCreate = document.getElementById('btn-create-file-watcher');
    if (btnCreate) {
      btnCreate.addEventListener('click', openCreateWatcherModal);
    }

    // Sélection dossier
    const btnSelectFolder = document.getElementById('btn-select-watcher-folder');
    if (btnSelectFolder) {
      btnSelectFolder.addEventListener('click', selectWatcherFolder);
    }

    // Formulaire
    const form = document.getElementById('file-watcher-edit-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
          id: document.getElementById('file-watcher-edit-id').value || null,
          name: document.getElementById('file-watcher-name').value,
          patterns: getSelectedPatterns(),
          pollInterval: parseInt(document.getElementById('file-watcher-poll-interval').value),
          recursive: document.getElementById('file-watcher-recursive').checked,
          notifyOnCreate: document.getElementById('file-watcher-notify-create').checked,
          notifyOnModify: document.getElementById('file-watcher-notify-modify').checked,
          notifyOnDelete: document.getElementById('file-watcher-notify-delete').checked,
          realtimeNotify: document.getElementById('file-watcher-realtime-notify')?.checked || false
        };

        await saveFileWatcher(formData);
      });
    }

    // Boutons fermeture modales
    const btnCloseEdit = document.getElementById('btn-close-file-watcher-edit');
    const btnCancelEdit = document.getElementById('btn-cancel-file-watcher-edit');
    if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeFileWatcherEditModal);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeFileWatcherEditModal);

    const btnCloseDetail = document.getElementById('btn-close-file-watcher-detail');
    if (btnCloseDetail) btnCloseDetail.addEventListener('click', closeWatcherDetailModal);

    // Actions dans la modale détail
    const btnToggle = document.getElementById('btn-watcher-toggle');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        if (currentDetailWatcherId) toggleWatcher(currentDetailWatcherId);
      });
    }

    const btnCheckNow = document.getElementById('btn-watcher-check-now');
    if (btnCheckNow) {
      btnCheckNow.addEventListener('click', () => {
        if (currentDetailWatcherId) checkWatcherNow(currentDetailWatcherId);
      });
    }

    const btnEdit = document.getElementById('btn-watcher-edit');
    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        if (currentDetailWatcherId) {
          const watcherIdToEdit = currentDetailWatcherId;
          closeWatcherDetailModal();
          openEditWatcherModal(watcherIdToEdit);
        } else {
          console.warn('Cannot edit: no watcher selected');
          showToast('Aucun observateur sélectionné', 'error');
        }
      });
    }

    const btnDelete = document.getElementById('btn-watcher-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (currentDetailWatcherId) deleteWatcher(currentDetailWatcherId);
      });
    }

    // Filtres événements
    document.querySelectorAll('.filter-event-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        currentEventFilter = filter;

        // Activer le bouton
        document.querySelectorAll('.filter-event-btn').forEach(b => {
          b.classList.toggle('bg-primary', b === btn);
          b.classList.toggle('text-white', b === btn);
          b.classList.toggle('border-primary', b === btn);
        });

        // Recharger les événements
        if (currentDetailWatcherId) {
          loadWatcherEvents(currentDetailWatcherId, filter);
        }
      });
    });

    // Écouter les mises à jour en temps réel
    window.addEventListener('taskmda:file-watcher-updated', async (e) => {
      // Rafraîchir la liste si l'onglet est actif
      const tab = document.getElementById('global-settings-tab-file-watcher');
      if (tab && tab.getAttribute('aria-selected') === 'true') {
        await renderFileWatchersList();
      }

      // Rafraîchir le détail si c'est le watcher ouvert
      if (currentDetailWatcherId && currentDetailWatcherId === e.detail.watcherId) {
        await openWatcherDetail(currentDetailWatcherId);
      }
    });

    // Marquer comme initialisé
    isInitialized = true;
    debugLog('FileWatcherUI initialized');
  }

  // ============================================================================
  // EXPORTS
  // ============================================================================

  window.TaskMdaFileWatcherUI = {
    init: initFileWatcherUI,
    renderList: renderFileWatchersList,
    openCreate: openCreateWatcherModal,
    openEdit: openEditWatcherModal,
    openDetail: openWatcherDetail
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFileWatcherUI);
  } else {
    initFileWatcherUI();
  }

})(window);
