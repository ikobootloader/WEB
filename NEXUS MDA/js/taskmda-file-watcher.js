// ============================================================================
// TASKMDA FILE WATCHER - Surveillance de fichiers avec polling
// ============================================================================
// Module autonome pour observer les modifications de fichiers dans des dossiers
// Utilise File System Access API + polling (pas de watch natif en navigateur)
// ============================================================================

(function(window) {
  'use strict';

  // Configuration par défaut
  const DEFAULT_POLL_INTERVAL = 60000; // 1 minute
  const MIN_POLL_INTERVAL = 30000; // 30 secondes minimum
  const MAX_POLL_INTERVAL = 3600000; // 1 heure maximum

  // Patterns de fichiers supportés par catégorie
  const FILE_PATTERNS = {
    excel: ['*.xlsx', '*.xls', '*.xlsm', '*.xlsb'],
    word: ['*.docx', '*.doc', '*.docm'],
    pdf: ['*.pdf'],
    csv: ['*.csv'],
    text: ['*.txt', '*.md'],
    image: ['*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg'],
    all: ['*.*']
  };

  // État global
  let pollTimers = new Map(); // watcherId -> intervalId
  let isPollingActive = false;

  function debugLog(...args) {
    if (localStorage.getItem('taskmda_debug') === '1') {
      console.log('[FileWatcher]', ...args);
    }
  }

  // ============================================================================
  // UTILITAIRES
  // ============================================================================

  /**
   * Convertit un pattern en regex (simple wildcard)
   * Ex: "*.xlsx" -> /^.*\.xlsx$/i
   */
  function patternToRegex(pattern) {
    const escaped = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Vérifie si un nom de fichier correspond aux patterns
   */
  function matchesPatterns(fileName, patterns) {
    if (!patterns || patterns.length === 0) return true;
    return patterns.some(pattern => {
      const regex = patternToRegex(pattern);
      return regex.test(fileName);
    });
  }

  /**
   * Calcule un hash simple basé sur lastModified + size
   * (suffisant pour détecter les modifications)
   */
  function computeFileHash(lastModified, size) {
    return `${lastModified}-${size}`;
  }

  /**
   * Récupère tous les fichiers d'un dossier (récursif optionnel)
   */
  async function scanDirectory(dirHandle, recursive = false, basePath = '') {
    const files = [];

    try {
      for await (const entry of dirHandle.values()) {
        const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name;

        if (entry.kind === 'file') {
          try {
            const file = await entry.getFile();
            files.push({
              handle: entry,
              file,
              path: fullPath,
              name: entry.name,
              lastModified: file.lastModified,
              size: file.size
            });
          } catch (error) {
            console.warn(`Cannot access file ${fullPath}:`, error);
          }
        } else if (entry.kind === 'directory' && recursive) {
          try {
            const subFiles = await scanDirectory(entry, true, fullPath);
            files.push(...subFiles);
          } catch (error) {
            console.warn(`Cannot access directory ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error);
    }

    return files;
  }

  // ============================================================================
  // GESTION DES SNAPSHOTS
  // ============================================================================

  /**
   * Charge les snapshots d'un observateur
   */
  async function loadSnapshots(watcherId) {
    const db = await getDatabase();
    const tx = db.transaction('fileWatcherSnapshots', 'readonly');
    const store = tx.objectStore('fileWatcherSnapshots');
    const index = store.index('watcherId');
    const snapshots = await index.getAll(watcherId);

    // Convertir en Map pour accès rapide
    const snapshotMap = new Map();
    snapshots.forEach(snap => {
      snapshotMap.set(snap.filePath, snap);
    });

    return snapshotMap;
  }

  /**
   * Met à jour ou crée un snapshot
   */
  async function updateSnapshot(watcherId, fileData) {
    const db = await getDatabase();
    const snapshot = {
      id: `${watcherId}:${fileData.path}`,
      watcherId,
      filePath: fileData.path,
      fileName: fileData.name,
      lastModified: fileData.lastModified,
      size: fileData.size,
      hash: computeFileHash(fileData.lastModified, fileData.size),
      status: 'active',
      lastCheckedAt: Date.now()
    };

    await db.put('fileWatcherSnapshots', snapshot);
    return snapshot;
  }

  /**
   * Marque les snapshots comme supprimés
   */
  async function markSnapshotsAsDeleted(watcherId, pathsToDelete) {
    if (pathsToDelete.length === 0) return;

    const db = await getDatabase();
    const tx = db.transaction('fileWatcherSnapshots', 'readwrite');
    const store = tx.objectStore('fileWatcherSnapshots');

    for (const path of pathsToDelete) {
      const id = `${watcherId}:${path}`;
      const snapshot = await store.get(id);
      if (snapshot) {
        snapshot.status = 'deleted';
        snapshot.lastCheckedAt = Date.now();
        await store.put(snapshot);
      }
    }

    await tx.done;
  }

  // ============================================================================
  // DÉTECTION DES CHANGEMENTS
  // ============================================================================

  /**
   * Compare les fichiers actuels avec les snapshots et détecte les changements
   */
  async function detectChanges(watcherId, currentFiles, snapshots) {
    const events = [];
    const now = Date.now();
    const currentPaths = new Set();

    // Vérifier les fichiers actuels (nouveaux ou modifiés)
    for (const fileData of currentFiles) {
      currentPaths.add(fileData.path);
      const snapshot = snapshots.get(fileData.path);
      const currentHash = computeFileHash(fileData.lastModified, fileData.size);

      if (!snapshot) {
        // Nouveau fichier
        events.push({
          id: uuidv4(),
          watcherId,
          filePath: fileData.path,
          fileName: fileData.name,
          eventType: 'created',
          detectedAt: now,
          notified: false,
          newSize: fileData.size,
          newModified: fileData.lastModified
        });
      } else if (snapshot.hash !== currentHash) {
        // Fichier modifié
        events.push({
          id: uuidv4(),
          watcherId,
          filePath: fileData.path,
          fileName: fileData.name,
          eventType: 'modified',
          detectedAt: now,
          notified: false,
          oldSize: snapshot.size,
          newSize: fileData.size,
          oldModified: snapshot.lastModified,
          newModified: fileData.lastModified
        });
      }
    }

    // Vérifier les fichiers supprimés
    for (const [path, snapshot] of snapshots.entries()) {
      if (snapshot.status === 'active' && !currentPaths.has(path)) {
        events.push({
          id: uuidv4(),
          watcherId,
          filePath: path,
          fileName: snapshot.fileName,
          eventType: 'deleted',
          detectedAt: now,
          notified: false,
          oldSize: snapshot.size,
          oldModified: snapshot.lastModified
        });
      }
    }

    return events;
  }

  /**
   * Enregistre les événements détectés
   */
  async function saveEvents(events) {
    if (events.length === 0) return;

    const db = await getDatabase();
    const tx = db.transaction('fileWatcherEvents', 'readwrite');
    const store = tx.objectStore('fileWatcherEvents');

    for (const event of events) {
      await store.add(event);
    }

    await tx.done;
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  /**
   * Crée une notification pour un événement de fichier
   * Injecte dans le panneau Notifications (cloche) via le bridge CustomEvent
   */
  function createNotificationForEvent(watcher, event) {
    const labels = {
      created: 'Nouveau fichier détecté',
      modified: 'Fichier modifié',
      deleted: 'Fichier supprimé'
    };
    const icons = {
      created: '📄',
      modified: '✏️',
      deleted: '🗑️'
    };

    const title = `${icons[event.eventType] || '📁'} ${labels[event.eventType] || 'Changement fichier'}`;
    const body = `${event.fileName} — Observateur : ${watcher.name}`;

    // Injection dans le panneau Notifications (cloche) via le bridge
    window.dispatchEvent(new CustomEvent('taskmda:inject-notification', {
      detail: {
        title,
        body,
        projectId: null,
        actorIcon: 'notifications',
        meta: {
          actorName: 'Surveillance fichiers',
          allowSelf: true,
          targetType: 'file-watcher',
          targetId: watcher.id,
          targetView: null,
          linkLabel: watcher.name,
          dedupeKey: `fw:${event.id}`
        }
      }
    }));

    // Marquer l'événement comme notifié en DB
    (async () => {
      try {
        const db = await getDatabase();
        const storedEvent = await db.get('fileWatcherEvents', event.id);
        if (storedEvent) {
          storedEvent.notified = true;
          await db.put('fileWatcherEvents', storedEvent);
        }
      } catch (err) {
        console.warn('Error marking event as notified:', err);
      }
    })();
  }

  /**
   * Affiche un toast visuel temps réel pour un événement fichier
   */
  function showRealtimeToastForEvent(watcher, event) {
    const labels = {
      created: '📄 Nouveau fichier',
      modified: '✏️ Fichier modifié',
      deleted: '🗑️ Fichier supprimé'
    };
    const msg = `${labels[event.eventType] || 'Changement'} : ${event.fileName}`;
    if (typeof showToast === 'function') {
      showToast(msg);
    }
  }

  // ============================================================================
  // CYCLE DE VÉRIFICATION (POLLING)
  // ============================================================================

  /**
   * Effectue une vérification complète d'un observateur
   */
  async function checkWatcher(watcherId) {
    try {
      const db = await getDatabase();
      const watcher = await db.get('fileWatchers', watcherId);

      if (!watcher || !watcher.enabled) {
        debugLog(`Watcher ${watcherId} disabled or not found`);
        return;
      }

      // Vérifier les permissions du dossier
      if (!watcher.folderHandle) {
        console.warn(`Watcher ${watcherId}: no folder handle`);
        return;
      }

      // Demander la permission si nécessaire
      try {
        const permission = await watcher.folderHandle.queryPermission({ mode: 'read' });
        if (permission !== 'granted') {
          const newPermission = await watcher.folderHandle.requestPermission({ mode: 'read' });
          if (newPermission !== 'granted') {
            console.warn(`Watcher ${watcherId}: permission denied`);
            return;
          }
        }
      } catch (error) {
        console.error(`Watcher ${watcherId}: permission check failed:`, error);
        return;
      }

      debugLog(`Checking watcher: ${watcher.name}`);

      // Scanner le dossier
      const currentFiles = await scanDirectory(
        watcher.folderHandle,
        watcher.recursive || false
      );

      // Filtrer selon les patterns
      const patterns = watcher.patterns || ['*.*'];
      const filteredFiles = currentFiles.filter(f => matchesPatterns(f.name, patterns));

      debugLog(`Found ${filteredFiles.length} matching files`);

      // Charger les snapshots
      const snapshots = await loadSnapshots(watcherId);

      // Détecter les changements
      const events = await detectChanges(watcherId, filteredFiles, snapshots);

      debugLog(`Detected ${events.length} changes`);

      // Sauvegarder les événements
      if (events.length > 0) {
        await saveEvents(events);

        // Créer les notifications
        const shouldNotify = {
          created: watcher.notifyOnCreate !== false,
          modified: watcher.notifyOnModify !== false,
          deleted: watcher.notifyOnDelete !== false
        };

        for (const event of events) {
          if (shouldNotify[event.eventType]) {
            await createNotificationForEvent(watcher, event);

            // Notification navigateur temps réel
            if (watcher.realtimeNotify) {
              showRealtimeToastForEvent(watcher, event);
            }
          }
        }
      }

      // Mettre à jour les snapshots
      for (const fileData of filteredFiles) {
        await updateSnapshot(watcherId, fileData);
      }

      // Marquer les fichiers supprimés
      const deletedPaths = events
        .filter(e => e.eventType === 'deleted')
        .map(e => e.filePath);
      await markSnapshotsAsDeleted(watcherId, deletedPaths);

      // Mettre à jour la date de dernière vérification et l'historique
      watcher.lastCheckAt = Date.now();
      watcher.checkHistory = watcher.checkHistory || [];
      watcher.checkHistory.unshift(watcher.lastCheckAt);
      watcher.checkHistory = watcher.checkHistory.slice(0, 5); // Garder les 5 derniers
      
      await db.put('fileWatchers', watcher);

      // Notifier l'UI qu'un changement a eu lieu
      window.dispatchEvent(new CustomEvent('taskmda:file-watcher-updated', {
        detail: { watcherId: watcher.id }
      }));

    } catch (error) {
      console.error(`Error checking watcher ${watcherId}:`, error);
    }
  }

  /**
   * Démarre le polling pour un observateur
   */
  function startPolling(watcher) {
    if (!watcher.enabled) return;

    // Arrêter le polling existant si présent
    stopPolling(watcher.id);

    const interval = Math.max(
      MIN_POLL_INTERVAL,
      Math.min(MAX_POLL_INTERVAL, watcher.pollInterval || DEFAULT_POLL_INTERVAL)
    );

    debugLog(`Starting polling for watcher ${watcher.id} (interval: ${interval}ms)`);

    // Première vérification immédiate
    checkWatcher(watcher.id);

    // Puis polling régulier
    const timerId = setInterval(() => {
      checkWatcher(watcher.id);
    }, interval);

    pollTimers.set(watcher.id, timerId);
  }

  /**
   * Arrête le polling pour un observateur
   */
  function stopPolling(watcherId) {
    if (pollTimers.has(watcherId)) {
      clearInterval(pollTimers.get(watcherId));
      pollTimers.delete(watcherId);
      debugLog(`Stopped polling for watcher ${watcherId}`);
    }
  }

  /**
   * Démarre tous les observateurs actifs
   */
  async function startAllWatchers() {
    if (isPollingActive) return;

    // Vérifier que la DB est disponible
    if (typeof getDatabase !== 'function') {
      debugLog('Database function not yet available, retrying in 2s...');
      setTimeout(() => startAllWatchers(), 2000);
      return;
    }

    try {
      const db = await getDatabase();

      // Vérifier que le store existe
      if (!db.objectStoreNames.contains('fileWatchers')) {
        debugLog('fileWatchers store not yet available, retrying in 2s...');
        setTimeout(() => startAllWatchers(), 2000);
        return;
      }

      const tx = db.transaction('fileWatchers', 'readonly');
      const watchers = await tx.objectStore('fileWatchers').getAll();

      for (const watcher of watchers) {
        if (watcher.enabled) {
          startPolling(watcher);
        }
      }

      isPollingActive = true;
      debugLog(`Started ${pollTimers.size} file watchers`);
    } catch (error) {
      // Si la DB n'est pas encore initialisée, réessayer
      if (error.message && error.message.includes('not initialized')) {
        debugLog('Database not yet initialized, retrying in 2s...');
        setTimeout(() => startAllWatchers(), 2000);
      } else {
        console.error('Error starting file watchers:', error);
        // Réessayer après 2s pour les autres erreurs aussi
        if (!isPollingActive) {
          setTimeout(() => startAllWatchers(), 2000);
        }
      }
    }
  }

  /**
   * Arrête tous les observateurs
   */
  function stopAllWatchers() {
    for (const watcherId of pollTimers.keys()) {
      stopPolling(watcherId);
    }
    isPollingActive = false;
    debugLog('Stopped all file watchers');
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================

  window.TaskMdaFileWatcher = {
    // Utilitaires
    FILE_PATTERNS,
    patternToRegex,
    matchesPatterns,

    // Gestion du polling
    startPolling,
    stopPolling,
    startAllWatchers,
    stopAllWatchers,
    checkWatcher,

    // Snapshots
    loadSnapshots,
    updateSnapshot,

    // Événements
    detectChanges,
    saveEvents,

    // État
    isActive: () => isPollingActive,
    getActiveWatchers: () => Array.from(pollTimers.keys())
  };

  // Démarrer automatiquement au chargement (avec délai pour attendre l'init de la DB)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => startAllWatchers(), 5000);
    });
  } else {
    setTimeout(() => startAllWatchers(), 5000);
  }

  // Arrêter proprement avant déchargement de la page
  window.addEventListener('beforeunload', () => {
    stopAllWatchers();
  });

})(window);

/* --- taskmda-file-watcher-ui.js --- */

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

    // Ajouter les patterns personnalisÃ©s
    const customInput = document.getElementById('file-watcher-custom-patterns');
    if (customInput && customInput.value.trim()) {
      const customPatterns = customInput.value.split(',').map(p => p.trim()).filter(Boolean);
      patterns.push(...customPatterns);
    }

    return patterns.length > 0 ? patterns : ['*.*'];
  }

  function setSelectedPatterns(patterns) {
    // DÃ©cocher tous
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

    // Patterns personnalisÃ©s
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
              ${watcher.enabled ? 'Actif' : 'PausÃ©'}
            </span>
          </div>
          <div class="text-xs text-slate-600 space-y-1">
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-1 font-semibold mb-0.5">
                <span class="material-symbols-outlined text-sm">schedule</span>
                <span>DerniÃ¨res vÃ©rifications:</span>
              </div>
              ${(watcher.checkHistory || [watcher.lastCheckAt]).filter(Boolean).slice(0, 3).map(ts => `
                <div class="flex items-center gap-1 pl-5 text-[10px] text-slate-500">
                  <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>${formatDate(ts)}</span>
                </div>
              `).join('')}
              ${!(watcher.checkHistory?.length) && !watcher.lastCheckAt ? '<span class="pl-5 text-slate-400 italic">Aucune vÃ©rification</span>' : ''}
            </div>
            <div class="flex items-center gap-1 pt-1 border-t border-slate-100 mt-1">
              <span class="material-symbols-outlined text-sm">filter_alt</span>
              <span>${(watcher.patterns || ['*.*']).length} pattern(s)</span>
            </div>
          </div>
        </div>
      `).join('');

      // Ã‰vÃ©nements clic
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
  // CRÃ‰ATION/Ã‰DITION
  // ============================================================================

  function openCreateWatcherModal() {
    currentEditingWatcherId = null;
    currentFolderHandle = null;

    const modal = document.getElementById('modal-file-watcher-edit');
    const title = document.getElementById('file-watcher-edit-title');
    const form = document.getElementById('file-watcher-edit-form');

    if (!modal || !title || !form) return;

    title.textContent = 'CrÃ©er un observateur';
    form.reset();
    document.getElementById('file-watcher-edit-id').value = '';
    document.getElementById('file-watcher-folder-name').value = '';

    // Patterns par dÃ©faut
    document.querySelectorAll('.file-pattern-check').forEach(check => {
      check.checked = ['excel', 'word', 'pdf', 'csv'].includes(check.value);
    });

    // RÃ©initialiser l'option notification temps rÃ©el
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
      document.getElementById('file-watcher-folder-name').value = watcher.folderHandle?.name || 'Dossier sÃ©lectionnÃ©';
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
        showToast('Veuillez sÃ©lectionner un dossier', 'error');
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

      // Merge avec l'existant si Ã©dition
      if (!isNew) {
        const existing = await db.get('fileWatchers', watcherId);
        Object.assign(watcher, existing, watcher);
      }

      await db.put('fileWatchers', watcher);

      // DÃ©marrer le polling
      if (window.TaskMdaFileWatcher) {
        window.TaskMdaFileWatcher.startPolling(watcher);
      }

      showToast(isNew ? 'Observateur crÃ©Ã© avec succÃ¨s' : 'Observateur mis Ã  jour', 'success');
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
  // DÃ‰TAIL
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
      document.getElementById('file-watcher-detail-status').textContent = watcher.enabled ? 'Actif' : 'PausÃ©';
      document.getElementById('file-watcher-detail-status').className = watcher.enabled ? 'text-emerald-600' : 'text-slate-500';
      document.getElementById('file-watcher-detail-interval').textContent = formatInterval(watcher.pollInterval || 60000);
      document.getElementById('file-watcher-detail-recursive').textContent = watcher.recursive ? 'Oui' : 'Non';
      document.getElementById('file-watcher-detail-last-check').textContent = formatDate(watcher.lastCheckAt);

      const realtimeEl = document.getElementById('file-watcher-detail-realtime');
      if (realtimeEl) {
        realtimeEl.textContent = watcher.realtimeNotify ? 'ActivÃ©' : 'DÃ©sactivÃ©';
        realtimeEl.className = watcher.realtimeNotify ? 'font-semibold text-emerald-600' : 'text-slate-500';
      }

      // Bouton toggle
      const toggleBtn = document.getElementById('btn-watcher-toggle');
      const toggleLabel = document.getElementById('btn-watcher-toggle-label');
      if (toggleBtn && toggleLabel) {
        toggleBtn.querySelector('.material-symbols-outlined').textContent = watcher.enabled ? 'pause' : 'play_arrow';
        toggleLabel.textContent = watcher.enabled ? 'Mettre en pause' : 'Reprendre';
      }

      // Charger les fichiers et Ã©vÃ©nements
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
        list.innerHTML = '<p class="text-sm text-slate-500 p-3">Aucun fichier dÃ©tectÃ©</p>';
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

      // Trier par date dÃ©croissante
      events.sort((a, b) => b.detectedAt - a.detectedAt);

      const count = document.getElementById('file-watcher-events-count');
      const list = document.getElementById('file-watcher-events-list');

      if (count) count.textContent = events.length;

      if (!list) return;

      if (events.length === 0) {
        list.innerHTML = '<p class="text-sm text-slate-500 p-3">Aucun changement dÃ©tectÃ©</p>';
        return;
      }

      const icons = {
        created: 'ðŸ“„',
        modified: 'âœï¸',
        deleted: 'ðŸ—‘ï¸'
      };

      const labels = {
        created: 'CrÃ©Ã©',
        modified: 'ModifiÃ©',
        deleted: 'SupprimÃ©'
      };

      list.innerHTML = events.map(event => `
        <div class="flex items-start gap-2 p-2 border-b border-slate-100">
          <span class="text-lg">${icons[event.eventType] || 'ðŸ“'}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-slate-700 truncate">${escapeHtml(event.fileName)}</div>
            <div class="text-xs text-slate-500">${labels[event.eventType]} â€¢ ${formatDate(event.detectedAt)}</div>
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

      showToast(watcher.enabled ? 'Observateur activÃ©' : 'Observateur mis en pause', 'success');

      // RafraÃ®chir
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

    showToast('VÃ©rification en cours...', 'info');

    try {
      await window.TaskMdaFileWatcher.checkWatcher(watcherId);
      showToast('VÃ©rification terminÃ©e', 'success');

      // RafraÃ®chir les donnÃ©es
      await loadWatcherFiles(watcherId);
      await loadWatcherEvents(watcherId);

    } catch (error) {
      console.error('Error checking watcher:', error);
      showToast('Erreur lors de la vÃ©rification', 'error');
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

      // ArrÃªter le polling
      if (window.TaskMdaFileWatcher) {
        window.TaskMdaFileWatcher.stopPolling(watcherId);
      }

      // Supprimer l'observateur
      await db.delete('fileWatchers', watcherId);

      // Supprimer les snapshots associÃ©s
      const tx = db.transaction('fileWatcherSnapshots', 'readwrite');
      const store = tx.objectStore('fileWatcherSnapshots');
      const index = store.index('watcherId');
      const snapshots = await index.getAll(watcherId);
      for (const snap of snapshots) {
        await store.delete(snap.id);
      }
      await tx.done;

      showToast('Observateur supprimÃ©', 'success');

      // Fermer la modale et rafraÃ®chir
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
        alert('Votre navigateur ne supporte pas la sÃ©lection de dossiers.\nUtilisez Chrome ou Edge rÃ©cent.');
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
        showToast('Erreur lors de la sÃ©lection du dossier', 'error');
      }
    }
  }

  // ============================================================================
  // GESTION DES ONGLETS RÃ‰FÃ‰RENTIELS
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

    // Cacher toutes les cartes sauf branding par dÃ©faut
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
    // Ã‰viter la double initialisation
    if (isInitialized) {
      debugLog('FileWatcherUI already initialized, skipping');
      return;
    }

    // Gestion des onglets
    initSettingsTabs();

    // Bouton crÃ©er
    const btnCreate = document.getElementById('btn-create-file-watcher');
    if (btnCreate) {
      btnCreate.addEventListener('click', openCreateWatcherModal);
    }

    // SÃ©lection dossier
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

    // Actions dans la modale dÃ©tail
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
          showToast('Aucun observateur sÃ©lectionnÃ©', 'error');
        }
      });
    }

    const btnDelete = document.getElementById('btn-watcher-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        if (currentDetailWatcherId) deleteWatcher(currentDetailWatcherId);
      });
    }

    // Filtres Ã©vÃ©nements
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

        // Recharger les Ã©vÃ©nements
        if (currentDetailWatcherId) {
          loadWatcherEvents(currentDetailWatcherId, filter);
        }
      });
    });

    // Ã‰couter les mises Ã  jour en temps rÃ©el
    window.addEventListener('taskmda:file-watcher-updated', async (e) => {
      // RafraÃ®chir la liste si l'onglet est actif
      const tab = document.getElementById('global-settings-tab-file-watcher');
      if (tab && tab.getAttribute('aria-selected') === 'true') {
        await renderFileWatchersList();
      }

      // RafraÃ®chir le dÃ©tail si c'est le watcher ouvert
      if (currentDetailWatcherId && currentDetailWatcherId === e.detail.watcherId) {
        await openWatcherDetail(currentDetailWatcherId);
      }
    });

    // Marquer comme initialisÃ©
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
