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
