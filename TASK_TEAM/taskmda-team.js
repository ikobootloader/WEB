    // ============================================================================
    // TASKMDA TEAM - STANDALONE VERSION
    // Toutes les fonctionnalités event-sourcing dans un seul fichier HTML
    // ============================================================================

    // Vérifier que les dépendances sont chargées
    function checkDependencies() {
      if (!window.uuidv4 || !window.idb || !window.marked) {
        console.error('❌ Dépendances manquantes:', {
          uuidv4: !!window.uuidv4,
          idb: !!window.idb,
          marked: !!window.marked
        });
        alert('❌ Erreur: Dépendances CDN non chargées.\n\nVérifiez votre connexion internet.');
        return false;
      }
      debugLog('Dependances CDN chargees');
      return true;
    }

    // Charger les dépendances
    const uuidv4 = window.uuidv4;
    const { openDB } = window.idb;
    const APP_DEBUG = localStorage.getItem('taskmda_debug') === '1';

    function debugLog(...args) {
      if (!APP_DEBUG) return;
      console.log(...args);
    }

    // ============================================================================
    // MODULE 1: DATABASE (IndexedDB)
    // ============================================================================

    const DB_NAME = 'taskmda-team-standalone';
    const DB_VERSION = 7; // Incremente: + annuaire local auto-alimente + groupes utilisateurs
    const DATA_EXPORT_STORES = {
      events: 'eventId',
      processedEvents: 'eventId',
      snapshots: 'snapshotId',
      localState: 'projectId',
      users: 'userId',
      sharedKeys: 'projectId',
      globalTasks: 'id',
      globalDocs: 'id',
      globalCalendarItems: 'id',
      globalThemes: 'themeKey',
      globalGroups: 'groupKey',
      directoryUsers: 'userId'
    };
    let dbInstance = null;

    async function initDatabase() {
      if (!dbInstance) {
        dbInstance = await openDB(DB_NAME, DB_VERSION, {
          upgrade(db) {
            // Events store
            if (!db.objectStoreNames.contains('events')) {
              const eventsStore = db.createObjectStore('events', { keyPath: 'eventId' });
              eventsStore.createIndex('timestamp', 'timestamp');
              eventsStore.createIndex('projectId', 'projectId');
              eventsStore.createIndex('projectId_timestamp', ['projectId', 'timestamp']);
            }

            // Processed events
            if (!db.objectStoreNames.contains('processedEvents')) {
              db.createObjectStore('processedEvents', { keyPath: 'eventId' });
            }

            // Snapshots
            if (!db.objectStoreNames.contains('snapshots')) {
              const snapshotsStore = db.createObjectStore('snapshots', { keyPath: 'snapshotId' });
              snapshotsStore.createIndex('projectId', 'projectId');
              snapshotsStore.createIndex('timestamp', 'timestamp');
            }

            // Local state
            if (!db.objectStoreNames.contains('localState')) {
              db.createObjectStore('localState', { keyPath: 'projectId' });
            }

            // Users
            if (!db.objectStoreNames.contains('users')) {
              db.createObjectStore('users', { keyPath: 'userId' });
            }

            // Annuaire local des utilisateurs connus (sync + local)
            if (!db.objectStoreNames.contains('directoryUsers')) {
              const directoryUsers = db.createObjectStore('directoryUsers', { keyPath: 'userId' });
              directoryUsers.createIndex('name', 'name');
              directoryUsers.createIndex('lastSeenAt', 'lastSeenAt');
            }

            // Shared keys (pour chiffrement E2E)
            if (!db.objectStoreNames.contains('sharedKeys')) {
              db.createObjectStore('sharedKeys', { keyPath: 'projectId' });
            }

            // Tâches hors projet (vue transverse)
            if (!db.objectStoreNames.contains('globalTasks')) {
              const globalTasks = db.createObjectStore('globalTasks', { keyPath: 'id' });
              globalTasks.createIndex('createdAt', 'createdAt');
              globalTasks.createIndex('status', 'status');
              globalTasks.createIndex('theme', 'theme');
            }

            // Documents hors projet (classement thématique)
            if (!db.objectStoreNames.contains('globalDocs')) {
              const globalDocs = db.createObjectStore('globalDocs', { keyPath: 'id' });
              globalDocs.createIndex('createdAt', 'createdAt');
              globalDocs.createIndex('theme', 'theme');
            }

            // Informations calendrier hors projet (agenda transverse)
            if (!db.objectStoreNames.contains('globalCalendarItems')) {
              const globalCalendarItems = db.createObjectStore('globalCalendarItems', { keyPath: 'id' });
              globalCalendarItems.createIndex('createdAt', 'createdAt');
              globalCalendarItems.createIndex('date', 'date');
              globalCalendarItems.createIndex('theme', 'theme');
            }

            // Catalogue global des thematiques reutilisables
            if (!db.objectStoreNames.contains('globalThemes')) {
              const globalThemes = db.createObjectStore('globalThemes', { keyPath: 'themeKey' });
              globalThemes.createIndex('name', 'name');
              globalThemes.createIndex('updatedAt', 'updatedAt');
            }

            // Catalogue global des groupes reutilisables
            if (!db.objectStoreNames.contains('globalGroups')) {
              const globalGroups = db.createObjectStore('globalGroups', { keyPath: 'groupKey' });
              globalGroups.createIndex('name', 'name');
              globalGroups.createIndex('updatedAt', 'updatedAt');
            }

            debugLog('Database initialized');
          }
        });
      }
      return dbInstance;
    }

    function getDatabase() {
      if (!dbInstance) {
        throw new Error('Database not initialized. Call initDatabase() first.');
      }
      return dbInstance;
    }

    // ============================================================================
    // DATABASE CRYPTO WRAPPERS
    // ============================================================================

    function isValidIdbKey(key) {
      if (key === null || key === undefined) return false;
      if (typeof key === 'number') return Number.isFinite(key);
      if (key instanceof Date) return Number.isFinite(key.getTime());
      if (Array.isArray(key)) return key.length > 0 && key.every(isValidIdbKey);
      return true;
    }

    /**
     * Sauvegarde chiffrée dans IndexedDB
     */
    async function putEncrypted(storeName, obj, idField) {
      const db = getDatabase();

      if (window.TaskMDACrypto && window.TaskMDACrypto.isUnlocked()) {
        const encrypted = await window.TaskMDACrypto.encryptForDB(obj, idField);
        return await db.put(storeName, encrypted);
      } else {
        // Fallback sans chiffrement si non déverrouillé
        return await db.put(storeName, obj);
      }
    }

    /**
     * Lecture déchiffrée depuis IndexedDB
     */
    async function getDecrypted(storeName, id, idField) {
      if (!isValidIdbKey(id)) return null;
      const db = getDatabase();
      const obj = await db.get(storeName, id);

      if (!obj) return null;

      if (window.TaskMDACrypto && window.TaskMDACrypto.isUnlocked() && obj._isEncrypted) {
        return await window.TaskMDACrypto.decryptFromDB(obj, idField);
      } else {
        return obj;
      }
    }

    /**
     * Lecture de tous les objets déchiffrés
     */
    async function getAllDecrypted(storeName, idField) {
      const db = getDatabase();
      const objs = await db.getAll(storeName);

      if (!objs || objs.length === 0) return [];

      if (window.TaskMDACrypto && window.TaskMDACrypto.isUnlocked()) {
        return await Promise.all(
          objs.map(obj => {
            if (obj._isEncrypted) {
              return window.TaskMDACrypto.decryptFromDB(obj, idField);
            }
            return obj;
          })
        );
      } else {
        return objs;
      }
    }

    /**
     * Lecture par index déchiffrée
     */
    async function getAllFromIndexDecrypted(storeName, indexName, query, idField) {
      const db = getDatabase();
      const objs = await db.getAllFromIndex(storeName, indexName, query);

      if (!objs || objs.length === 0) return [];

      if (window.TaskMDACrypto && window.TaskMDACrypto.isUnlocked()) {
        return await Promise.all(
          objs.map(obj => {
            if (obj._isEncrypted) {
              return window.TaskMDACrypto.decryptFromDB(obj, idField);
            }
            return obj;
          })
        );
      } else {
        return objs;
      }
    }

    // ============================================================================
    // MODULE 2: EVENT TYPES
    // ============================================================================

    const EventTypes = {
      CREATE_PROJECT: 'CREATE_PROJECT',
      UPDATE_PROJECT: 'UPDATE_PROJECT',
      DELETE_PROJECT: 'DELETE_PROJECT',
      CREATE_TASK: 'CREATE_TASK',
      UPDATE_TASK: 'UPDATE_TASK',
      DELETE_TASK: 'DELETE_TASK',
      SEND_MESSAGE: 'SEND_MESSAGE',
      UPDATE_MESSAGE: 'UPDATE_MESSAGE',
      DELETE_MESSAGE: 'DELETE_MESSAGE',
      ADD_MEMBER: 'ADD_MEMBER',
      REMOVE_MEMBER: 'REMOVE_MEMBER',
      CREATE_INVITE: 'CREATE_INVITE',
      UPDATE_INVITE: 'UPDATE_INVITE',
      CREATE_GROUP: 'CREATE_GROUP',
      DELETE_GROUP: 'DELETE_GROUP',
      CREATE_USER_GROUP: 'CREATE_USER_GROUP',
      UPDATE_USER_GROUP: 'UPDATE_USER_GROUP',
      DELETE_USER_GROUP: 'DELETE_USER_GROUP',
      ADD_THEME: 'ADD_THEME',
      REMOVE_THEME: 'REMOVE_THEME'
    };

    // ============================================================================
    // MODULE 3: EVENT STORE
    // ============================================================================

    function createEvent(type, projectId, author, payload) {
      return {
        eventId: uuidv4(),
        type,
        projectId,
        author,
        timestamp: Date.now(),
        payload,
        metadata: {
          appVersion: '1.0-standalone',
          clientId: getCurrentClientId()
        }
      };
    }

    async function publishEvent(event) {
      // Sauvegarder localement (chiffré)
      await putEncrypted('events', event, 'eventId');

      // Traiter immédiatement
      await processEvent(event);

      debugLog('Event published:', event.type);
    }

    async function processEvent(event) {
      const db = getDatabase();

      // Vérifier si déjà traité (pas besoin de déchiffrer, juste vérifier l'existence)
      const processed = await db.get('processedEvents', event.eventId);
      if (processed) return;

      // Appliquer à l'état
      await applyEventToState(event);
      await ingestDirectoryFromEvent(event);

      // Marquer comme traité (chiffré)
      await putEncrypted('processedEvents', { eventId: event.eventId, processedAt: Date.now() }, 'eventId');

      debugLog('Event processed:', event.type);
    }

    async function applyEventToState(event) {
      // Charger l'état (déchiffré)
      let state = await getDecrypted('localState', event.projectId, 'projectId') || {
        projectId: event.projectId,
        tasks: [],
        messages: [],
        members: [],
        invites: [],
        groups: [],
        userGroups: [],
        themes: [],
        project: null
      };

      if (!Array.isArray(state.tasks)) state.tasks = [];
      if (!Array.isArray(state.messages)) state.messages = [];
      if (!Array.isArray(state.members)) state.members = [];
      if (!Array.isArray(state.invites)) state.invites = [];
      if (!Array.isArray(state.groups)) state.groups = [];
      if (!Array.isArray(state.userGroups)) state.userGroups = [];
      if (!Array.isArray(state.themes)) state.themes = [];

      // Appliquer selon le type
      switch (event.type) {
        case EventTypes.CREATE_PROJECT:
          state.project = {
            projectId: event.projectId,
            ...event.payload,
            createdBy: event.author,
            createdAt: event.timestamp
          };
          break;

        case EventTypes.UPDATE_PROJECT:
          if (state.project) {
            state.project = { ...state.project, ...event.payload.changes, updatedAt: event.timestamp };
          }
          break;

        case EventTypes.DELETE_PROJECT:
          if (state.project) {
            state.project = { ...state.project, deletedAt: event.timestamp, status: 'deleted' };
          }
          break;

        case EventTypes.CREATE_TASK:
          state.tasks.push({
            taskId: event.payload.taskId || uuidv4(),
            ...event.payload,
            createdBy: event.payload.createdBy || event.author,
            createdAt: event.timestamp
          });
          break;

        case EventTypes.UPDATE_TASK:
          state.tasks = state.tasks.map(t =>
            t.taskId === event.payload.taskId ? { ...t, ...event.payload.changes, updatedAt: event.timestamp } : t
          );
          break;

        case EventTypes.DELETE_TASK:
          state.tasks = state.tasks.filter(t => t.taskId !== event.payload.taskId);
          break;

        case EventTypes.SEND_MESSAGE:
          state.messages.push({ messageId: event.eventId, author: event.author, ...event.payload, timestamp: event.timestamp });
          break;

        case EventTypes.UPDATE_MESSAGE:
          state.messages = state.messages.map(m =>
            m.messageId === event.payload.messageId
              ? { ...m, content: event.payload.content, editedAt: event.timestamp }
              : m
          );
          break;

        case EventTypes.DELETE_MESSAGE:
          state.messages = state.messages.filter(m => m.messageId !== event.payload.messageId);
          break;

        case EventTypes.ADD_MEMBER:
          if (!state.members.find(m => m.userId === event.payload.userId)) {
            state.members.push({
              ...event.payload,
              role: normalizeProjectRole(event.payload.role),
              joinedAt: event.timestamp
            });
          }
          break;

        case EventTypes.REMOVE_MEMBER:
          state.members = state.members.filter(m => m.userId !== event.payload.userId);
          state.userGroups = state.userGroups.map(g => ({
            ...g,
            memberUserIds: (g.memberUserIds || []).filter(id => id !== event.payload.userId)
          }));
          break;

        case EventTypes.CREATE_INVITE:
          if (!state.invites.find(i => i.inviteId === event.payload.inviteId)) {
            state.invites.push({ ...event.payload, invitedAt: event.timestamp });
          }
          break;

        case EventTypes.UPDATE_INVITE:
          state.invites = state.invites.map(inv =>
            inv.inviteId === event.payload.inviteId
              ? { ...inv, ...event.payload.changes, updatedAt: event.timestamp }
              : inv
          );
          break;

        case EventTypes.CREATE_GROUP:
          if (!state.groups.find(g => g.groupId === event.payload.groupId)) {
            state.groups.push({ ...event.payload, createdAt: event.timestamp });
          }
          break;

        case EventTypes.DELETE_GROUP:
          state.groups = state.groups.filter(g => g.groupId !== event.payload.groupId);
          state.tasks = state.tasks.map(t => t.groupId === event.payload.groupId ? { ...t, groupId: null } : t);
          break;

        case EventTypes.CREATE_USER_GROUP:
          if (!state.userGroups.find(g => g.groupId === event.payload.groupId)) {
            state.userGroups.push({
              groupId: event.payload.groupId,
              name: event.payload.name,
              memberUserIds: Array.isArray(event.payload.memberUserIds) ? [...new Set(event.payload.memberUserIds)] : [],
              createdAt: event.timestamp
            });
          }
          break;

        case EventTypes.UPDATE_USER_GROUP:
          state.userGroups = state.userGroups.map(g =>
            g.groupId === event.payload.groupId
              ? { ...g, ...event.payload.changes, updatedAt: event.timestamp }
              : g
          );
          break;

        case EventTypes.DELETE_USER_GROUP:
          state.userGroups = state.userGroups.filter(g => g.groupId !== event.payload.groupId);
          break;

        case EventTypes.ADD_THEME:
          if (!state.themes.find(t => normalizeSearch(t) === normalizeSearch(event.payload.theme))) {
            state.themes.push(event.payload.theme);
          }
          break;

        case EventTypes.REMOVE_THEME:
          state.themes = state.themes.filter(t => normalizeSearch(t) !== normalizeSearch(event.payload.theme));
          break;
      }

      state.lastUpdated = Date.now();

      // Sauvegarder l'état (chiffré)
      await putEncrypted('localState', state, 'projectId');
    }

    function hasProjectAccess(state, userId = getCurrentUserId()) {
      if (!state || !state.project || state.project.deletedAt) return false;
      const members = Array.isArray(state.members) ? state.members : [];
      const normalizedMode = normalizeSharingMode(state.project.sharingMode, 'private');
      const isMember = members.some(m => m.userId === userId);
      if (isMember) return true;
      if (state.project.createdBy && state.project.createdBy === userId) return true;
      if (members.length === 0 && !state.project.createdBy) return true; // compatibilitÃ© anciens jeux de donnÃ©es
      if (normalizedMode === 'private') return false;
      return false;
    }

    async function getProjectState(projectId, options = {}) {
      if (!isValidIdbKey(projectId)) return null;
      const state = await getDecrypted('localState', projectId, 'projectId');
      if (!state) return null;
      if (options.ignoreAccessCheck) return state;
      return hasProjectAccess(state) ? state : null;
    }

    async function getProjectEvents(projectId) {
      try {
        const events = await getAllFromIndexDecrypted('events', 'projectId', projectId, 'eventId');
        return events.sort((a, b) => b.timestamp - a.timestamp);
      } catch (error) {
        console.error('Error getting project events:', error);
        return [];
      }
    }

    async function getAllProjects() {
      try {
        const states = await getAllDecrypted('localState', 'projectId');
        return states
          .filter(s => s && s.project && !s.project.deletedAt)
          .filter(s => hasProjectAccess(s))
          .map(s => s.project);
      } catch (error) {
        console.error('Error getting projects:', error);
        return [];
      }
    }

    // ============================================================================
    // MODULE 4: USERS
    // ============================================================================

    function detectOsUsernameGuess() {
      try {
        const rawPath = decodeURIComponent(window.location.pathname || '');
        const normalized = rawPath.replace(/\\/g, '/');

        const windowsMatch = normalized.match(/\/Users\/([^/]+)/i);
        const unixMatch = normalized.match(/\/home\/([^/]+)/i);
        const picked = windowsMatch?.[1] || unixMatch?.[1] || '';
        if (!picked) return null;

        const clean = picked.replace(/[._-]+/g, ' ').trim();
        if (!clean) return null;

        return clean
          .split(' ')
          .filter(Boolean)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      } catch {
        return null;
      }
    }

    async function initializeCurrentUser() {
      let userId = localStorage.getItem('userId');

      if (!userId) {
        userId = uuidv4();
        localStorage.setItem('userId', userId);
      }

      let user = await getDecrypted('users', userId, 'userId');

      if (!user) {
        const nameGuess = detectOsUsernameGuess();
        user = {
          userId,
          name: nameGuess || ('Utilisateur ' + Math.floor(Math.random() * 1000)),
          createdAt: Date.now()
        };
        await putEncrypted('users', user, 'userId');
      }

      return user;
    }

    function getCurrentUserId() {
      return localStorage.getItem('userId');
    }

    function getCurrentClientId() {
      let clientId = localStorage.getItem('clientId');
      if (!clientId) {
        clientId = uuidv4();
        localStorage.setItem('clientId', clientId);
      }
      return clientId;
    }

    function getInitials(name) {
      if (!name) return '?';
      const parts = name.trim().split(' ');
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    function stringToColor(str) {
      const colors = ['#006c4a', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6'];
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
    }

    function fallbackDirectoryName(userId) {
      const raw = String(userId || '').trim();
      if (!raw) return 'Utilisateur';
      return `Utilisateur ${raw.slice(0, 8)}`;
    }

    async function upsertDirectoryUser({ userId, name, email = '', source = 'unknown', lastSeenAt = Date.now() }) {
      const id = String(userId || '').trim();
      if (!id) return;
      const existing = await getDecrypted('directoryUsers', id, 'userId');
      const cleanName = String(name || '').trim();
      const mergedName = cleanName || existing?.name || fallbackDirectoryName(id);
      await putEncrypted('directoryUsers', {
        userId: id,
        name: mergedName,
        email: String(email || existing?.email || '').trim(),
        source: source || existing?.source || 'unknown',
        firstSeenAt: existing?.firstSeenAt || Date.now(),
        lastSeenAt: Math.max(Number(existing?.lastSeenAt || 0), Number(lastSeenAt || Date.now()))
      }, 'userId');
    }

    async function ingestDirectoryFromEvent(event) {
      if (!event) return;
      await upsertDirectoryUser({
        userId: event.author,
        name: event.payload?.authorName || '',
        source: 'event',
        lastSeenAt: event.timestamp || Date.now()
      });
      if (event.type === EventTypes.ADD_MEMBER && event.payload?.userId) {
        await upsertDirectoryUser({
          userId: event.payload.userId,
          name: event.payload.displayName || '',
          source: 'event_add_member',
          lastSeenAt: event.timestamp || Date.now()
        });
      }
    }

    async function refreshDirectoryFromKnownSources() {
      const users = await getAllDecrypted('users', 'userId');
      for (const user of users || []) {
        await upsertDirectoryUser({
          userId: user.userId,
          name: user.name,
          email: user.email,
          source: 'users_store',
          lastSeenAt: user.updatedAt || user.createdAt || Date.now()
        });
      }

      const states = await getAllDecrypted('localState', 'projectId');
      for (const state of states || []) {
        for (const member of state?.members || []) {
          await upsertDirectoryUser({
            userId: member.userId,
            name: member.displayName || '',
            source: 'project_member',
            lastSeenAt: member.joinedAt || Date.now()
          });
        }
        for (const msg of state?.messages || []) {
          await upsertDirectoryUser({
            userId: msg.author,
            name: msg.authorName || '',
            source: 'message',
            lastSeenAt: msg.timestamp || Date.now()
          });
        }
      }
    }

    async function refreshKnownUsersCache() {
      const [users, directoryUsers] = await Promise.all([
        getAllDecrypted('users', 'userId'),
        getAllDecrypted('directoryUsers', 'userId')
      ]);
      const map = new Map();
      (users || []).forEach(user => {
        if (!user?.userId) return;
        map.set(user.userId, {
          userId: user.userId,
          name: String(user.name || '').trim(),
          avatarDataUrl: String(user.avatarDataUrl || '').trim()
        });
      });
      (directoryUsers || []).forEach(user => {
        if (!user?.userId) return;
        const existing = map.get(user.userId) || {};
        map.set(user.userId, {
          userId: user.userId,
          name: existing.name || String(user.name || '').trim(),
          avatarDataUrl: existing.avatarDataUrl || ''
        });
      });
      if (currentUser?.userId) {
        const existing = map.get(currentUser.userId) || {};
        map.set(currentUser.userId, {
          userId: currentUser.userId,
          name: String(currentUser.name || existing.name || '').trim(),
          avatarDataUrl: String(currentUser.avatarDataUrl || existing.avatarDataUrl || '').trim()
        });
      }
      knownUsersCache = map;
    }

    function resolveKnownUserIdentity(userId, fallbackName = '') {
      const id = String(userId || '').trim();
      const known = id ? knownUsersCache.get(id) : null;
      const name = String(known?.name || fallbackName || (id ? fallbackDirectoryName(id) : 'Utilisateur')).trim();
      return {
        userId: id,
        name,
        avatarDataUrl: String(known?.avatarDataUrl || '').trim()
      };
    }

    function renderParticipantsStack(participants, maxVisible = 3) {
      const normalized = [];
      const seen = new Set();
      (participants || []).forEach(item => {
        const uid = String(item?.userId || '').trim();
        const key = uid || `name:${normalizeSearch(item?.name || '')}`;
        if (!key || seen.has(key)) return;
        seen.add(key);
        normalized.push(resolveKnownUserIdentity(uid, String(item?.name || '').trim()));
      });
      if (normalized.length === 0) return '';
      const visible = normalized.slice(0, Math.max(1, maxVisible));
      const extra = Math.max(0, normalized.length - visible.length);
      return `
        <div class="participants-stack" title="${escapeHtml(normalized.map(p => p.name).join(', '))}">
          ${visible.map((p, idx) => {
            const avatarUrl = String(p.avatarDataUrl || '').replace(/'/g, '%27');
            const style = p.avatarDataUrl
              ? `background-image:url('${avatarUrl}'); background-size:cover; background-position:center; color:transparent;`
              : `background:${stringToColor(p.userId || p.name || String(idx))};`;
            return `<span class="participant-chip" style="${style}" aria-label="${escapeHtml(p.name)}">${escapeHtml(getInitials(p.name))}</span>`;
          }).join('')}
          ${extra > 0 ? `<span class="participant-chip participant-chip-more">+${extra}</span>` : ''}
        </div>
      `;
    }

    // ============================================================================
    // MODULE 5: FILE SYSTEM (Synchronisation)
    // ============================================================================

    let sharedFolderHandle = null;
    let projectFolders = new Map();
    let isPolling = false;
    let pollInterval = null;
    let knownEventIds = new Set();

    function isFileSystemSupported() {
      return 'showDirectoryPicker' in window;
    }

    async function selectSharedFolder() {
      if (!isFileSystemSupported()) {
        throw new Error('File System Access API non supporté');
      }

      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' });

      if (permission !== 'granted') {
        throw new Error('Permission refusée');
      }

      sharedFolderHandle = dirHandle;

      await saveSharedFolderHandle(dirHandle);

      debugLog('Shared folder selected:', dirHandle.name);
      return dirHandle;
    }

    async function saveSharedFolderHandle(handle) {
      if (!handle) return;
      try {
        const db = await openDB('taskmda-handles', 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains('handles')) {
              db.createObjectStore('handles', { keyPath: 'key' });
            }
          }
        });
        await db.put('handles', { key: 'sharedFolder', handle });
      } catch (error) {
        console.warn('Could not save handle:', error);
      }
    }

    async function clearSavedSharedFolderHandle() {
      try {
        const db = await openDB('taskmda-handles', 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains('handles')) {
              db.createObjectStore('handles', { keyPath: 'key' });
            }
          }
        });
        await db.delete('handles', 'sharedFolder');
      } catch (error) {
        console.warn('Could not clear saved handle:', error);
      }
    }

    async function registerProject(projectId) {
      if (!sharedFolderHandle) return;

      try {
        const projectsDir = await sharedFolderHandle.getDirectoryHandle('projects', { create: true });
        const projectDir = await projectsDir.getDirectoryHandle(projectId, { create: true });
        const eventsDir = await projectDir.getDirectoryHandle('events', { create: true });
        const snapshotsDir = await projectDir.getDirectoryHandle('snapshots', { create: true });

        projectFolders.set(projectId, { eventsDir, snapshotsDir });
        debugLog('Project registered:', projectId);
      } catch (error) {
        console.error('Error registering project:', error);
      }
    }

    /**
     * Découvre et charge tous les projets existants dans le dossier partagé
     * Appelé lors de la connexion initiale au dossier
     */
    async function discoverAndLoadExistingProjects() {
      if (!sharedFolderHandle) return;

      debugLog('Discovering existing projects...');

      try {
        const projectsDir = await sharedFolderHandle.getDirectoryHandle('projects', { create: true });

        // Parcourir tous les dossiers de projets
        for await (const entry of projectsDir.values()) {
          if (entry.kind !== 'directory') continue;

          const projectId = entry.name;
          debugLog('Found project:', projectId);

          // Enregistrer le projet
          await registerProject(projectId);

          // Charger tous les événements de ce projet (onlyNew = false pour tout charger)
          const events = await readEventsFromSharedFolder(projectId, false);

          debugLog(`Loading ${events.length} events from project ${projectId}`);

          // Traiter tous les événements dans l'ordre chronologique
          for (const event of events) {
            await processEvent(event);
            knownEventIds.add(event.eventId);
          }
        }

        debugLog('All existing projects loaded');
      } catch (error) {
        console.error('❌ Error discovering projects:', error);
      }
    }

    async function getSavedSharedFolderHandle() {
      try {
        const handlesDb = await openDB('taskmda-handles', 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains('handles')) {
              db.createObjectStore('handles', { keyPath: 'key' });
            }
          }
        });
        const row = await handlesDb.get('handles', 'sharedFolder');
        return row?.handle || null;
      } catch (error) {
        console.warn('Could not load saved handle:', error);
        return null;
      }
    }

    async function connectSharedFolderHandle(handle, showNotice = true) {
      if (!handle) return false;
      sharedFolderHandle = handle;
      projectFolders = new Map();
      knownEventIds = new Set();
      await discoverAndLoadExistingProjects();
      if (!isPolling) startPolling();
      updateSyncStatus('connected');
      await refreshStats();
      await renderProjects();
      if (showNotice) {
        showToast('Connecte au dossier partage');
        addNotification('Connexion', 'Dossier partage connecte', null);
      }
      return true;
    }

    async function tryConnectSavedFolder() {
      if (!isFileSystemSupported()) return false;
      const savedHandle = await getSavedSharedFolderHandle();
      if (!savedHandle) {
        updateFolderButtons();
        return false;
      }
      try {
        let permission = await savedHandle.queryPermission({ mode: 'readwrite' });
        if (permission === 'prompt') {
          permission = await savedHandle.requestPermission({ mode: 'readwrite' });
        }
        if (permission !== 'granted') {
          updateFolderButtons();
          return false;
        }
        await connectSharedFolderHandle(savedHandle, false);
        return true;
      } catch (error) {
        console.warn('Saved folder re-connection failed:', error);
        await clearSavedSharedFolderHandle();
        updateFolderButtons();
        return false;
      }
    }

    async function disconnectSharedFolder(forgetSavedHandle = true) {
      sharedFolderHandle = null;
      projectFolders = new Map();
      knownEventIds = new Set();
      stopPolling();
      if (forgetSavedHandle) {
        await clearSavedSharedFolderHandle();
      }
      updateSyncStatus('disconnected');
      updateFolderButtons();
      await refreshStats();
      await renderProjects();
      showToast('Mode solo actif');
    }

    async function writeEventToSharedFolder(projectId, event) {
      const folders = projectFolders.get(projectId);
      if (!folders) return;

      try {
        // Récupérer la clé partagée du projet
        const sharedKeyData = await getDecrypted('sharedKeys', projectId, 'projectId');
        if (!sharedKeyData) {
          console.warn('No shared key for project (might be private):', projectId);
          return;
        }

        const sharedKey = await window.TaskMDACrypto.importSharedKey(sharedKeyData.sharedKey);

        // Chiffrer l'événement avec la clé partagée
        const encryptedEvent = await window.TaskMDACrypto.encryptWithSharedKey(event, sharedKey);

        // Wrapper pour le fichier JSON
        const wrapper = {
          eventId: event.eventId,
          projectId: event.projectId,
          timestamp: event.timestamp,
          encrypted: encryptedEvent,
          version: 'v1-e2e-encrypted'
        };

        const fileName = `${event.timestamp}_${event.eventId}.json`;
        const fileHandle = await folders.eventsDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(wrapper));
        await writable.close();

        knownEventIds.add(event.eventId);
        debugLog('E2E encrypted event written to shared folder:', fileName);
      } catch (error) {
        console.error('Error writing encrypted event:', error);
      }
    }

    async function readEventsFromSharedFolder(projectId, onlyNew = true) {
      const folders = projectFolders.get(projectId);
      if (!folders) return [];

      const events = [];

      // Récupérer la clé partagée du projet
      const sharedKeyData = await getDecrypted('sharedKeys', projectId, 'projectId');
      if (!sharedKeyData) {
        console.warn('No shared key for project:', projectId);
        return [];
      }

      const sharedKey = await window.TaskMDACrypto.importSharedKey(sharedKeyData.sharedKey);

      try {
        for await (const entry of folders.eventsDir.values()) {
          if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;

          const file = await entry.getFile();
          const content = await file.text();
          const wrapper = JSON.parse(content);

          let event = null;

          // Vérifier le format
          if (wrapper.version === 'v1-e2e-encrypted' && wrapper.encrypted) {
            // Nouveau format : chiffré E2E
            event = await window.TaskMDACrypto.decryptWithSharedKey(wrapper.encrypted, sharedKey);
          } else if (wrapper.eventId && wrapper.type) {
            // Ancien format : JSON clair (compatibilité)
            event = wrapper;
          }

          // Si onlyNew=false, charger tous les événements (lors de la découverte initiale)
          // Si onlyNew=true, charger uniquement les nouveaux (polling)
          if (event && (!onlyNew || !knownEventIds.has(event.eventId))) {
            events.push(event);
          }
        }
      } catch (error) {
        console.error('Error reading encrypted events:', error);
      }

      return events.sort((a, b) => a.timestamp - b.timestamp);
    }

    async function startPolling() {
      if (isPolling) return;
      isPolling = true;

      pollInterval = setInterval(async () => {
        for (const [projectId] of projectFolders) {
          const newEvents = await readEventsFromSharedFolder(projectId, true); // onlyNew = true

          for (const event of newEvents) {
            debugLog('New event from shared folder:', event.type);
            await processEvent(event);
            knownEventIds.add(event.eventId);
            notifyNewEvent(projectId);
          }
        }
      }, 5000); // 5 secondes

      debugLog('Polling started');
    }

    function stopPolling() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        isPolling = false;
        debugLog('Polling stopped');
      }
    }

    // ============================================================================
    // MODULE 6: UI MANAGEMENT
    // ============================================================================

    let currentUser = null;
    let pendingProfilePhotoDataUrl = '';
    let pendingProfilePhotoDirty = false;

    function showLoading(show) {
      document.getElementById('loading').classList.toggle('hidden', !show);
    }

    function showSetupError(message) {
      const errorEl = document.getElementById('setup-error');
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }

    function showMainContent() {
      document.getElementById('setup-screen').classList.add('hidden');
      document.getElementById('main-content').classList.remove('hidden');
      setActiveSidebarNav('dashboard');
      startDueReminders();
      startBackupReminders();
      ensureBrowserNotificationPermission();
    }

    function getStoredThemeChoice() {
      if (window.TaskMDATheme?.getStoredThemeChoice) {
        return window.TaskMDATheme.getStoredThemeChoice();
      }
      const value = localStorage.getItem('taskmda_theme_choice');
      return (value === 'light' || value === 'dark') ? value : 'system';
    }

    function setThemeIcon(isDark) {
      if (window.TaskMDATheme?.setThemeIcon) {
        window.TaskMDATheme.setThemeIcon(isDark);
        return;
      }
      const icon = document.getElementById('theme-toggle-icon');
      const btn = document.getElementById('btn-theme-toggle');
      if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
      if (btn) {
        const label = isDark ? 'Activer le mode clair' : 'Activer le mode sombre';
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
      }
    }

    function applyTheme(choice, persist = true) {
      if (window.TaskMDATheme?.applyTheme) {
        window.TaskMDATheme.applyTheme(choice, persist);
        return;
      }
      const value = (choice === 'light' || choice === 'dark') ? choice : 'system';
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDark = value === 'dark' || (value === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', useDark);
      document.documentElement.classList.toggle('light', !useDark);
      setThemeIcon(useDark);
      if (!persist) return;
      if (value === 'system') localStorage.removeItem('taskmda_theme_choice');
      else localStorage.setItem('taskmda_theme_choice', value);
    }

    function toggleTheme() {
      if (window.TaskMDATheme?.toggleTheme) {
        window.TaskMDATheme.toggleTheme();
        return;
      }
      const isDark = document.documentElement.classList.contains('dark');
      applyTheme(isDark ? 'light' : 'dark', true);
    }

    function initTheme() {
      if (window.TaskMDATheme?.initTheme) {
        window.TaskMDATheme.initTheme();
        return;
      }
      applyTheme(getStoredThemeChoice(), false);
    }

    function openMobileSidebar() {
      document.getElementById('sidebar')?.classList.add('open');
      document.getElementById('mobile-overlay')?.classList.remove('hidden');
    }

    function closeMobileSidebar() {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('mobile-overlay')?.classList.add('hidden');
    }

    function updateSyncStatus(status) {
      const statusEl = document.getElementById('sync-status');
      const statusConfig = {
        connected: { class: 'bg-green-100 text-green-700', icon: 'cloud_done', text: 'Connecté' },
        disconnected: { class: 'bg-red-100 text-red-700', icon: 'cloud_off', text: 'Non connecté' },
        syncing: { class: 'bg-yellow-100 text-yellow-700', icon: 'cloud_sync', text: 'Synchronisation...' }
      };

      const config = statusConfig[status];
      statusEl.className = `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${config.class}`;
      statusEl.innerHTML = `
        <span class="material-symbols-outlined text-lg">${config.icon}</span>
        <span>${config.text}</span>
      `;
      updateFolderButtons();
    }

    function updateFolderButtons() {
      const linkBtn = document.getElementById('btn-link-folder');
      const unlinkBtn = document.getElementById('btn-unlink-folder');
      const sidebarLinkBtn = document.getElementById('sidebar-link-folder');
      const supported = isFileSystemSupported();
      if (linkBtn) {
        linkBtn.disabled = !supported;
        linkBtn.classList.toggle('opacity-50', !supported);
        linkBtn.textContent = supported
          ? (sharedFolderHandle ? 'Changer dossier' : 'Lier un dossier')
          : 'Dossier non supporte';
      }
      if (unlinkBtn) {
        unlinkBtn.classList.toggle('hidden', !sharedFolderHandle);
      }
      if (sidebarLinkBtn) {
        sidebarLinkBtn.disabled = !supported;
        sidebarLinkBtn.classList.toggle('opacity-50', !supported);
      }
    }

    function updateUserInfo() {
      if (!currentUser) return;

      const userInfo = document.getElementById('user-info');
      const userAvatar = document.getElementById('user-avatar');
      const userName = document.getElementById('user-name');

      if (currentUser.avatarDataUrl) {
        userAvatar.textContent = '';
        userAvatar.style.background = `center / cover no-repeat url('${currentUser.avatarDataUrl}')`;
      } else {
        userAvatar.textContent = getInitials(currentUser.name);
        userAvatar.style.background = stringToColor(currentUser.userId);
      }
      userName.textContent = currentUser.name;

      userInfo.classList.remove('hidden');
    }

    function escapeCsvValue(value) {
      const raw = String(value ?? '');
      if (/[;"\n\r]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    }

    function toCsv(rows, headers) {
      const head = headers.map(escapeCsvValue).join(';');
      const lines = rows.map(row => headers.map(h => escapeCsvValue(row[h])).join(';'));
      return '\uFEFF' + [head, ...lines].join('\n');
    }

    function downloadBlobFile(content, filename, mimeType = 'application/octet-stream') {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function formatExportDateTag() {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}${mm}${dd}_${hh}${mi}`;
    }

    async function exportUserDataJson() {
      const snapshot = {
        meta: {
          app: 'TaskMDA Team',
          exportedAt: new Date().toISOString(),
          exportedByUserId: currentUser?.userId || null,
          version: 1
        },
        stores: {}
      };
      for (const [storeName, idField] of Object.entries(DATA_EXPORT_STORES)) {
        snapshot.stores[storeName] = await getAllDecrypted(storeName, idField);
      }
      const tag = formatExportDateTag();
      downloadBlobFile(
        JSON.stringify(snapshot, null, 2),
        `taskmda_user_backup_${tag}.json`,
        'application/json;charset=utf-8'
      );
      showToast('Export JSON généré');
    }

    async function importUserDataJsonFromFile(file) {
      if (!file) return;
      const raw = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('Fichier JSON invalide');
      }
      if (!parsed || typeof parsed !== 'object' || !parsed.stores || typeof parsed.stores !== 'object') {
        throw new Error('Format de sauvegarde non reconnu');
      }

      const db = getDatabase();
      for (const storeName of Object.keys(DATA_EXPORT_STORES)) {
        await db.clear(storeName);
      }

      for (const [storeName, idField] of Object.entries(DATA_EXPORT_STORES)) {
        const rows = Array.isArray(parsed.stores[storeName]) ? parsed.stores[storeName] : [];
        for (const row of rows) {
          await putEncrypted(storeName, row, idField);
        }
      }

      const preferredUserId = parsed?.meta?.exportedByUserId;
      if (preferredUserId) {
        localStorage.setItem('userId', preferredUserId);
      }

      await refreshGlobalTaxonomyCache();
      await refreshDirectoryFromKnownSources();
      currentUser = await initializeCurrentUser();
      updateUserInfo();
      await refreshStats();
      await renderProjects();
      showToast('Import JSON terminé');
    }

    async function exportProjectsAndTasksCsv() {
      const states = await getAllProjectStates();
      const projectsRows = states.map(state => {
        const tasks = (state.tasks || []);
        const visibleTasks = tasks.filter(t => !t.archivedAt);
        const done = visibleTasks.filter(t => t.status === 'termine').length;
        return {
          project_id: state.project?.projectId || '',
          projet: state.project?.name || '',
          statut: state.project?.status || '',
          mode: normalizeSharingMode(state.project?.sharingMode, 'private') === 'shared' ? 'Collaboratif' : 'Solo',
          date_creation: state.project?.createdAt ? new Date(state.project.createdAt).toLocaleString('fr-FR') : '',
          membres: (state.members || []).length,
          taches: visibleTasks.length,
          taches_terminees: done,
          description: state.project?.description || ''
        };
      });

      const tasksRows = [];
      states.forEach(state => {
        (state.tasks || []).forEach(task => {
          tasksRows.push({
            projet: state.project?.name || '',
            task_id: task.taskId || '',
            titre: task.title || '',
            assigne: getTaskAssigneeName(task, state) || '',
            statut: task.status || 'todo',
            urgence: task.urgency || '',
            echeance: task.dueDate ? formatDate(task.dueDate) : '',
            thematique: task.theme || '',
            groupe_thematique: getTaskGroupName(task, state) || '',
            archivee: task.archivedAt ? 'Oui' : 'Non',
            mode_projet: normalizeSharingMode(state.project?.sharingMode, 'private') === 'shared' ? 'Collaboratif' : 'Solo',
            description: task.description || ''
          });
        });
      });

      const tag = formatExportDateTag();
      const projectsCsv = toCsv(projectsRows, ['project_id', 'projet', 'statut', 'mode', 'date_creation', 'membres', 'taches', 'taches_terminees', 'description']);
      const tasksCsv = toCsv(tasksRows, ['projet', 'task_id', 'titre', 'assigne', 'statut', 'urgence', 'echeance', 'thematique', 'groupe_thematique', 'archivee', 'mode_projet', 'description']);
      downloadBlobFile(projectsCsv, `taskmda_projets_${tag}.csv`, 'text/csv;charset=utf-8');
      downloadBlobFile(tasksCsv, `taskmda_taches_${tag}.csv`, 'text/csv;charset=utf-8');
      showToast('Exports Excel (CSV) générés');
    }

    function normalizeSearch(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    }

    function normalizeCatalogKey(value) {
      return normalizeSearch(value).trim();
    }

    async function refreshGlobalTaxonomyCache() {
      const themes = await getAllDecrypted('globalThemes', 'themeKey');
      const groups = await getAllDecrypted('globalGroups', 'groupKey');
      globalThemeCatalog = (themes || [])
        .filter(item => item && item.themeKey && item.name)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'));
      globalGroupCatalog = (groups || [])
        .filter(item => item && item.groupKey && item.name)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'));
    }

    async function upsertGlobalTheme(theme) {
      const name = String(theme || '').trim();
      const themeKey = normalizeCatalogKey(name);
      if (!themeKey) return;
      const existing = await getDecrypted('globalThemes', themeKey, 'themeKey');
      await putEncrypted('globalThemes', {
        themeKey,
        name,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now()
      }, 'themeKey');
    }

    async function upsertGlobalGroup(group) {
      const name = String(group?.name || '').trim();
      const description = String(group?.description || '').trim();
      const memberUserIds = Array.from(new Set((group?.memberUserIds || []).map(id => String(id || '').trim()).filter(Boolean)));
      const groupKey = normalizeCatalogKey(name);
      if (!groupKey) return;
      const existing = await getDecrypted('globalGroups', groupKey, 'groupKey');
      await putEncrypted('globalGroups', {
        groupKey,
        name,
        description: description || existing?.description || '',
        memberUserIds,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now()
      }, 'groupKey');
    }

    function toDomSafeKey(value) {
      return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function getGlobalGroupMembersSelectId(groupKey) {
      return `global-group-members-${toDomSafeKey(groupKey)}`;
    }

    function readSelectedUserIdsFromSelect(selectId) {
      const select = document.getElementById(selectId);
      if (!select) return [];
      return Array.from(select.selectedOptions || [])
        .map(opt => String(opt.value || '').trim())
        .filter(Boolean);
    }

    async function getKnownUsersForGlobalGroups() {
      await refreshKnownUsersCache();
      return Array.from(knownUsersCache.values())
        .filter(u => u && u.userId && u.name)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'));
    }

    async function renderGlobalGroupMembersInputOptions(selectedIds = []) {
      const select = document.getElementById('global-group-members-input');
      if (!select) return;
      const selected = new Set((selectedIds || []).map(id => String(id || '').trim()).filter(Boolean));
      const users = await getKnownUsersForGlobalGroups();
      if (users.length === 0) {
        select.disabled = true;
        select.innerHTML = '<option value="" disabled>Aucun utilisateur connu</option>';
        return;
      }
      select.disabled = false;
      select.innerHTML = users
        .map(user => `<option value="${escapeHtml(user.userId)}" ${selected.has(user.userId) ? 'selected' : ''}>${escapeHtml(user.name)}</option>`)
        .join('');
    }

    async function refreshGroupSelectorsAfterCatalogChange() {
      await populateProjectGroupPresetOptions('project-group-presets');
      if (currentProjectState) {
        await refreshTaskAssigneeOptionsMulti(currentProjectState);
        refreshTaskMetadataOptions(currentProjectState);
      }
    }

    async function deleteGlobalThemeByKey(themeKey) {
      if (!isValidIdbKey(themeKey)) return;
      const db = getDatabase();
      await db.delete('globalThemes', themeKey);
    }

    async function deleteGlobalGroupByKey(groupKey) {
      if (!isValidIdbKey(groupKey)) return;
      const db = getDatabase();
      await db.delete('globalGroups', groupKey);
    }

    async function createGlobalThemeFromSettings() {
      const input = document.getElementById('global-theme-name-input');
      const name = (input?.value || '').trim();
      if (!name) {
        showToast('Thématique requise');
        return;
      }
      await upsertGlobalTheme(name);
      await refreshGlobalTaxonomyCache();
      if (input) input.value = '';
      showToast('Thématique globale ajoutée');
      await renderGlobalSettings();
      await refreshGroupSelectorsAfterCatalogChange();
    }

    async function createGlobalGroupFromSettings() {
      const nameInput = document.getElementById('global-group-name-input');
      const descInput = document.getElementById('global-group-description-input');
      const name = (nameInput?.value || '').trim();
      const description = (descInput?.value || '').trim();
      const memberUserIds = readSelectedUserIdsFromSelect('global-group-members-input');
      if (!name) {
        showToast('Nom de groupe requis');
        return;
      }
      await upsertGlobalGroup({ name, description, memberUserIds });
      await refreshGlobalTaxonomyCache();
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      const membersInput = document.getElementById('global-group-members-input');
      if (membersInput) {
        Array.from(membersInput.options || []).forEach(opt => { opt.selected = false; });
      }
      showToast('Groupe global ajouté');
      await renderGlobalSettings();
      await refreshGroupSelectorsAfterCatalogChange();
    }

    async function editGlobalTheme(themeKey) {
      const key = String(themeKey || '').trim();
      const current = (globalThemeCatalog || []).find(t => t.themeKey === key);
      if (!current) return;
      const nextName = (window.prompt('Modifier la thématique', current.name || '') || '').trim();
      if (!nextName || normalizeCatalogKey(nextName) === key) return;
      await deleteGlobalThemeByKey(key);
      await upsertGlobalTheme(nextName);
      await refreshGlobalTaxonomyCache();
      showToast('Thématique globale modifiée');
      await renderGlobalSettings();
      await refreshGroupSelectorsAfterCatalogChange();
    }

    async function deleteGlobalTheme(themeKey) {
      const key = String(themeKey || '').trim();
      if (!key) return;
      const current = (globalThemeCatalog || []).find(t => t.themeKey === key);
      if (!current) return;
      if (!confirm(`Supprimer la thématique globale "${current.name}" ?`)) return;
      await deleteGlobalThemeByKey(key);
      await refreshGlobalTaxonomyCache();
      showToast('Thématique globale supprimée');
      await renderGlobalSettings();
      await refreshGroupSelectorsAfterCatalogChange();
    }

    async function editGlobalGroup(groupKey) {
      const key = String(groupKey || '').trim();
      const current = (globalGroupCatalog || []).find(g => g.groupKey === key);
      if (!current) return;
      const nextName = (window.prompt('Modifier le nom du groupe', current.name || '') || '').trim();
      if (!nextName) return;
      const nextDescription = (window.prompt('Modifier la description du groupe', current.description || '') || '').trim();
      const nextKey = normalizeCatalogKey(nextName);
      if (nextKey !== key) {
        await deleteGlobalGroupByKey(key);
      }
      await upsertGlobalGroup({
        name: nextName,
        description: nextDescription,
        memberUserIds: current.memberUserIds || []
      });
      await refreshGlobalTaxonomyCache();
      showToast('Groupe global modifié');
      await renderGlobalSettings();
      await refreshGroupSelectorsAfterCatalogChange();
    }

    async function deleteGlobalGroup(groupKey) {
      const key = String(groupKey || '').trim();
      if (!key) return;
      const current = (globalGroupCatalog || []).find(g => g.groupKey === key);
      if (!current) return;
      if (!confirm(`Supprimer le groupe global "${current.name}" ?`)) return;
      await deleteGlobalGroupByKey(key);
      await refreshGlobalTaxonomyCache();
      showToast('Groupe global supprimé');
      await renderGlobalSettings();
      await refreshGroupSelectorsAfterCatalogChange();
    }

    async function saveGlobalGroupMembers(groupKey) {
      const key = String(groupKey || '').trim();
      if (!key) return;
      const current = (globalGroupCatalog || []).find(g => g.groupKey === key);
      if (!current) return;
      const selectId = getGlobalGroupMembersSelectId(key);
      const memberUserIds = readSelectedUserIdsFromSelect(selectId);
      await upsertGlobalGroup({
        name: current.name,
        description: current.description || '',
        memberUserIds
      });
      await refreshGlobalTaxonomyCache();
      showToast('Membres du groupe mis à jour');
      await renderGlobalSettings();
    }

    async function renderGlobalSettings() {
      await refreshGlobalTaxonomyCache();
      const themesList = document.getElementById('global-themes-admin-list');
      const groupsList = document.getElementById('global-groups-admin-list');
      if (!themesList || !groupsList) return;
      const knownUsers = await getKnownUsersForGlobalGroups();
      await renderGlobalGroupMembersInputOptions();

      const filteredThemes = (globalThemeCatalog || [])
        .filter(item => matchesQuery([item?.name], globalSearchQuery));
      const filteredGroups = (globalGroupCatalog || [])
        .filter(item => matchesQuery([item?.name, item?.description], globalSearchQuery));

      themesList.innerHTML = filteredThemes.length === 0
        ? '<p class="text-xs text-slate-500">Aucune thématique globale.</p>'
        : filteredThemes.map(item => `
            <div class="rounded-lg border border-slate-200 bg-white p-2 flex items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-700 truncate">${escapeHtml(item.name)}</span>
              <div class="flex items-center gap-1 shrink-0">
                <button onclick="editGlobalTheme('${escapeHtml(item.themeKey)}')" class="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">Modifier</button>
                <button onclick="deleteGlobalTheme('${escapeHtml(item.themeKey)}')" class="text-xs px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>
              </div>
            </div>
          `).join('');

      groupsList.innerHTML = filteredGroups.length === 0
        ? '<p class="text-xs text-slate-500">Aucun groupe global.</p>'
        : filteredGroups.map(item => `
            <div class="rounded-lg border border-slate-200 bg-white p-2">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-700 truncate">${escapeHtml(item.name)}</p>
                  <p class="text-xs text-slate-500 truncate">${escapeHtml(item.description || 'Sans description')}</p>
                  <p class="text-[11px] text-slate-500 mt-1">${(item.memberUserIds || []).length} membre(s)</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button onclick="editGlobalGroup('${escapeHtml(item.groupKey)}')" class="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">Modifier</button>
                  <button onclick="deleteGlobalGroup('${escapeHtml(item.groupKey)}')" class="text-xs px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>
                </div>
              </div>
              <div class="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                <select id="${escapeHtml(getGlobalGroupMembersSelectId(item.groupKey))}" multiple class="global-group-members-select px-3 py-2 border border-slate-300 rounded-lg text-xs min-h-[84px]">
                  ${knownUsers.map(user => `
                    <option value="${escapeHtml(user.userId)}" ${(item.memberUserIds || []).includes(user.userId) ? 'selected' : ''}>
                      ${escapeHtml(user.name)}
                    </option>
                  `).join('')}
                </select>
                <button onclick="saveGlobalGroupMembers('${escapeHtml(item.groupKey)}')" class="text-xs px-3 py-2 rounded bg-blue-100 text-blue-700 font-semibold">Sauver membres</button>
              </div>
            </div>
          `).join('');
    }

    function readSelectedGlobalGroups(selectId) {
      const select = document.getElementById(selectId);
      if (!select) return [];
      const selectedKeys = Array.from(select.selectedOptions || [])
        .map(opt => String(opt.value || '').trim())
        .filter(Boolean);
      const byKey = new Map((globalGroupCatalog || []).map(g => [String(g.groupKey || ''), g]));
      return selectedKeys
        .map(key => byKey.get(key))
        .filter(Boolean)
        .map(g => ({ name: String(g.name || '').trim(), description: String(g.description || '').trim() }))
        .filter(g => g.name);
    }

    async function populateProjectGroupPresetOptions(selectId, selectedNames = []) {
      const select = document.getElementById(selectId);
      if (!select) return;
      await refreshGlobalTaxonomyCache();
      const selectedKeys = new Set((selectedNames || []).map(name => normalizeCatalogKey(name)).filter(Boolean));
      const rows = (globalGroupCatalog || []).filter(g => g && g.groupKey && g.name);
      if (rows.length === 0) {
        select.innerHTML = '<option value="" disabled>Aucun groupe global disponible</option>';
        select.disabled = true;
        return;
      }
      select.disabled = false;
      select.innerHTML = rows
        .map(g => `<option value="${escapeHtml(g.groupKey)}" ${selectedKeys.has(g.groupKey) ? 'selected' : ''}>${escapeHtml(g.name)}</option>`)
        .join('');
    }

    async function syncProjectTaxonomyToGlobal(state) {
      if (!state?.project) return;
      const themes = state.themes || [];
      const groups = state.groups || [];
      for (const theme of themes) {
        await upsertGlobalTheme(theme);
      }
      for (const group of groups) {
        await upsertGlobalGroup(group);
      }
      await refreshGlobalTaxonomyCache();
    }

    function matchesQuery(fields, query) {
      if (!query) return true;
      const needle = normalizeSearch(query);
      return fields
        .filter(v => v !== null && v !== undefined)
        .some(v => normalizeSearch(v).includes(needle));
    }

    function setActiveSidebarNav(navKey) {
      const links = {
        dashboard: document.getElementById('nav-dashboard'),
        projects: document.getElementById('nav-projects'),
        tasks: document.getElementById('nav-tasks'),
        calendar: document.getElementById('nav-calendar'),
        docs: document.getElementById('nav-docs'),
        settings: document.getElementById('nav-settings')
      };
      Object.entries(links).forEach(([key, link]) => {
        if (!link) return;
        link.classList.toggle('active', key === navKey);
      });
    }

    async function rerenderCurrentContext() {
      if (currentProjectId && currentProjectState) {
        renderTasks(currentProjectState.tasks || []);
        renderKanban(currentProjectState.tasks || []);
        renderTimeline(currentProjectState.tasks || []);
        renderDocuments(currentProjectState.tasks || []);
        renderMessages(currentProjectState.messages || []);
        renderActivity(currentProjectEvents || []);
        applyLiveSearchFilter();
        return;
      }
      await renderProjects();
      applyLiveSearchFilter();
    }

    function applyLiveSearchFilter() {
      const query = (globalSearchQuery || '').trim().toLowerCase();
      const targets = currentProjectId
        ? [
            ['tasks-container', '#tasks-container > div', 'Aucune tache ne correspond a votre recherche'],
            ['kanban-board', '#kanban-board .kanban-col .bg-white', 'Aucune tache ne correspond a votre recherche'],
            ['timeline-container', '#timeline-container > div', 'Aucune tache ne correspond a votre recherche'],
            ['documents-container', '#documents-container > div', 'Aucun document ne correspond a votre recherche'],
            ['messages-container', '#messages-container > div', 'Aucun message ne correspond a votre recherche'],
            ['activity-container', '#activity-container > div', 'Aucune activite ne correspond a votre recherche']
          ]
        : [
            ['projects-container', '#projects-container > div', 'Aucun projet ne correspond a votre recherche']
          ];

      targets.forEach(([containerId, selector, emptyText]) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const cards = Array.from(document.querySelectorAll(selector));
        const hintId = `${containerId}-search-empty`;
        const existingHint = document.getElementById(hintId);

        if (!query) {
          cards.forEach(card => card.classList.remove('hidden'));
          if (existingHint) existingHint.remove();
          return;
        }

        let visibleCount = 0;
        cards.forEach(card => {
          const visible = (card.textContent || '').toLowerCase().includes(query);
          card.classList.toggle('hidden', !visible);
          if (visible) visibleCount += 1;
        });

        if (visibleCount === 0) {
          if (!existingHint) {
            const hint = document.createElement('p');
            hint.id = hintId;
            hint.className = 'text-slate-500 text-center py-6';
            hint.textContent = emptyText;
            container.appendChild(hint);
          }
        } else if (existingHint) {
          existingHint.remove();
        }
      });
    }

    async function refreshStats() {
      try {
        const projects = await getAllProjects();
        document.getElementById('stat-projects').textContent = projects.length;

        let totalTasks = 0;
        let totalMessages = 0;
        const uniqueMembers = new Set();
        for (const project of projects) {
          const state = await getProjectState(project.projectId);
          if (state) {
            totalTasks += state.tasks.length;
            totalMessages += state.messages.length;
            (state.members || []).forEach(member => {
              if (member?.userId) uniqueMembers.add(member.userId);
            });
          }
        }
        const standaloneTasks = await getAllDecrypted('globalTasks', 'id');
        totalTasks += (standaloneTasks || []).length;

        document.getElementById('stat-tasks').textContent = totalTasks;
        document.getElementById('stat-messages').textContent = totalMessages;
        document.getElementById('stat-members').textContent = Math.max(1, uniqueMembers.size);
      } catch (error) {
        console.error('Error refreshing stats:', error);
        document.getElementById('stat-projects').textContent = '0';
        document.getElementById('stat-tasks').textContent = '0';
        document.getElementById('stat-messages').textContent = '0';
        document.getElementById('stat-members').textContent = '1';
      }
    }

    function loadNotifications() {
      if (window.TaskMDANotifications?.load) {
        notifications = window.TaskMDANotifications.load('taskmda_notifications', 120);
        return;
      }
      try {
        const raw = localStorage.getItem('taskmda_notifications');
        notifications = raw ? JSON.parse(raw) : [];
      } catch {
        notifications = [];
      }
      if (!Array.isArray(notifications)) notifications = [];
      notifications = notifications.slice(0, 120);
    }

    function saveNotifications() {
      if (window.TaskMDANotifications?.save) {
        window.TaskMDANotifications.save(notifications, 'taskmda_notifications', 120);
        return;
      }
      try {
        localStorage.setItem('taskmda_notifications', JSON.stringify(notifications.slice(0, 120)));
      } catch {
        // ignore quota/storage errors
      }
    }

    function renderNotifications() {
      const list = document.getElementById('notifications-list');
      const badge = document.getElementById('notif-badge');
      if (!list || !badge) return;

      const unread = window.TaskMDANotifications?.unreadCount
        ? window.TaskMDANotifications.unreadCount(notifications)
        : notifications.filter(n => !n.read).length;
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.classList.toggle('hidden', unread === 0);

      if (notifications.length === 0) {
        list.innerHTML = '<p class="text-sm text-slate-500 text-center py-6">Aucune notification</p>';
        return;
      }

      list.innerHTML = notifications.map(item => `
        <button onclick="openNotification('${item.id}')" class="w-full text-left rounded-xl border px-3 py-2 ${
          item.read ? 'border-slate-100 bg-white' : 'border-blue-200 bg-blue-50'
        } hover:bg-slate-50">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold text-slate-800">${escapeHtml(item.title || 'Information')}</p>
            <span class="text-[10px] text-slate-500">${new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p class="text-xs text-slate-600 mt-1">${escapeHtml(item.body || '')}</p>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              <span class="material-symbols-outlined text-[13px]">person</span>
              <span>${escapeHtml(item.actorName || 'Système')}</span>
            </span>
            ${item.linkLabel ? `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                <span class="material-symbols-outlined text-[13px]">link</span>
                <span>${escapeHtml(item.linkLabel)}</span>
              </span>
            ` : ''}
          </div>
        </button>
      `).join('');
    }

    function addNotification(title, body, projectId = null, meta = {}) {
      const payload = meta && typeof meta === 'object' ? meta : {};
      const nextNotification = {
        id: uuidv4(),
        title: String(title || 'Notification'),
        body: String(body || ''),
        projectId: projectId || null,
        actorName: String(payload.actorName || currentUser?.name || 'Système'),
        targetType: payload.targetType || null,
        targetId: payload.targetId || null,
        targetView: payload.targetView || null,
        linkLabel: payload.linkLabel || null,
        timestamp: Date.now(),
        read: false
      };
      notifications = window.TaskMDANotifications?.add
        ? window.TaskMDANotifications.add(notifications, nextNotification, 120)
        : [nextNotification, ...notifications].slice(0, 120);
      saveNotifications();
      renderNotifications();
    }

    function toggleNotificationsPanel(forceOpen = null) {
      const panel = document.getElementById('notifications-panel');
      if (!panel) return;
      notificationsOpen = typeof forceOpen === 'boolean' ? forceOpen : !notificationsOpen;
      panel.classList.toggle('hidden', !notificationsOpen);
      if (notificationsOpen) {
        notifications = window.TaskMDANotifications?.markAllRead
          ? window.TaskMDANotifications.markAllRead(notifications)
          : notifications.map(n => ({ ...n, read: true }));
        saveNotifications();
        renderNotifications();
      }
    }

    async function openNotification(notificationId) {
      const notif = notifications.find(n => n.id === notificationId);
      if (!notif) return;
      notifications = window.TaskMDANotifications?.markRead
        ? window.TaskMDANotifications.markRead(notifications, notificationId)
        : notifications.map(n => n.id === notificationId ? { ...n, read: true } : n);
      saveNotifications();
      renderNotifications();
      if (notif.projectId) {
        await showProjectDetail(notif.projectId);
        if (notif.targetView) {
          setProjectView(notif.targetView);
        }
      } else if (notif.targetView === 'profile') {
        document.getElementById('btn-edit-user-name')?.click();
      } else if (notif.targetView === 'global-tasks') {
        await showGlobalWorkspace('tasks');
      } else if (notif.targetView === 'global-calendar') {
        await showGlobalWorkspace('calendar');
      } else if (notif.targetView === 'global-docs') {
        await showGlobalWorkspace('docs');
      }
      if (notif.targetType === 'task' && notif.targetId) {
        const target = document.getElementById(`task-card-${notif.targetId}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (notif.targetType === 'message' && notif.targetId) {
        const target = document.getElementById(`message-item-${notif.targetId}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      toggleNotificationsPanel(false);
    }

    function markAllNotificationsRead() {
      notifications = window.TaskMDANotifications?.markAllRead
        ? window.TaskMDANotifications.markAllRead(notifications)
        : notifications.map(n => ({ ...n, read: true }));
      saveNotifications();
      renderNotifications();
    }

    function clearNotifications() {
      notifications = [];
      saveNotifications();
      renderNotifications();
    }

    function loadReminderMemory() {
      try {
        const raw = localStorage.getItem('taskmda_due_reminders');
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
      } catch {
        return {};
      }
    }

    function saveReminderMemory() {
      try {
        localStorage.setItem('taskmda_due_reminders', JSON.stringify(dueReminderMemory));
      } catch {
        // ignore quota/storage errors
      }
    }

    function shouldEmitReminder(key, cooldownMs = 20 * 60 * 60 * 1000) {
      const lastTs = Number(dueReminderMemory[key] || 0);
      if (!Number.isFinite(lastTs) || lastTs <= 0) return true;
      return (Date.now() - lastTs) > cooldownMs;
    }

    function markReminderSent(key) {
      dueReminderMemory[key] = Date.now();
      const cutoff = Date.now() - (45 * 24 * 60 * 60 * 1000);
      Object.keys(dueReminderMemory).forEach((k) => {
        if (Number(dueReminderMemory[k] || 0) < cutoff) delete dueReminderMemory[k];
      });
      saveReminderMemory();
    }

    async function ensureBrowserNotificationPermission() {
      if (browserNotifPermissionChecked) return;
      browserNotifPermissionChecked = true;
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'default') return;
      const notifPromptKey = 'taskmda_notif_prompted_v1';
      if (localStorage.getItem(notifPromptKey) === '1') return;
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('Browser notification permission failed:', error);
      } finally {
        localStorage.setItem(notifPromptKey, '1');
      }
    }

    function emitBrowserNotification(title, body, tag) {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      try {
        const n = new Notification(title, {
          body,
          tag: tag || undefined,
          renotify: false
        });
        setTimeout(() => n.close(), 9000);
      } catch (error) {
        console.warn('Browser notification failed:', error);
      }
    }

    async function runDueReminderCheck() {
      if (dueReminderBusy) return;
      dueReminderBusy = true;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const scopedTasks = [];
        const projects = await getAllProjects();
        for (const project of projects) {
          const state = await getProjectState(project.projectId);
          (state?.tasks || []).forEach((task) => {
            scopedTasks.push({
              task,
              scope: project.name || 'Projet',
              scopeId: project.projectId || null
            });
          });
        }

        const globalTasks = await getAllDecrypted('globalTasks', 'id');
        (globalTasks || []).forEach((task) => {
          scopedTasks.push({
            task,
            scope: 'Hors projet',
            scopeId: null
          });
        });

        scopedTasks.forEach(({ task, scope, scopeId }) => {
          if (!task || task.status === 'termine') return;
          const dueKey = taskDueDateKey(task);
          if (!dueKey) return;
          const dueDate = new Date(`${dueKey}T00:00:00`);
          if (Number.isNaN(dueDate.getTime())) return;
          const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

          let level = null;
          if (diffDays < 0) level = 'overdue';
          else if (diffDays === 0) level = 'today';
          else if (diffDays === 1) level = 'tomorrow';
          if (!level) return;

          const reminderKey = `${task.id || task.taskId || task.title || 'task'}:${level}`;
          if (!shouldEmitReminder(reminderKey)) return;

          const taskTitle = String(task.title || 'Tache');
          const body = level === 'overdue'
            ? `${taskTitle} est en retard (${scope}).`
            : level === 'today'
              ? `${taskTitle} arrive a echeance aujourd'hui (${scope}).`
              : `${taskTitle} arrive a echeance demain (${scope}).`;
          const title = level === 'overdue' ? 'Tache en retard' : 'Rappel echeance';

          addNotification(title, body, scopeId, {
            actorName: 'Système',
            targetType: 'task',
            targetId: task.taskId || task.id || null,
            targetView: scopeId ? 'list' : 'global-tasks',
            linkLabel: scopeId ? 'Ouvrir la tâche' : 'Ouvrir les tâches'
          });
          emitBrowserNotification(title, body, reminderKey);
          markReminderSent(reminderKey);
        });
      } catch (error) {
        console.warn('Due reminder check failed:', error);
      } finally {
        dueReminderBusy = false;
      }
    }

    function startDueReminders() {
      if (dueReminderInterval) return;
      runDueReminderCheck();
      dueReminderInterval = setInterval(() => {
        runDueReminderCheck();
      }, 60000);
    }

    function stopDueReminders() {
      if (!dueReminderInterval) return;
      clearInterval(dueReminderInterval);
      dueReminderInterval = null;
    }

    function loadBackupReminderLastTs() {
      const raw = localStorage.getItem('taskmda_backup_reminder_last_ts');
      const ts = Number(raw || 0);
      return Number.isFinite(ts) ? ts : 0;
    }

    function markBackupReminderShown() {
      localStorage.setItem('taskmda_backup_reminder_last_ts', String(Date.now()));
    }

    function shouldShowBackupReminder(cooldownMs = 36 * 60 * 60 * 1000) {
      const lastTs = loadBackupReminderLastTs();
      if (!lastTs) return true;
      return (Date.now() - lastTs) >= cooldownMs;
    }

    async function hasBackupWorthyData() {
      const [projects, globalTasks, globalDocs, globalCalendarItems] = await Promise.all([
        getAllProjects(),
        getAllDecrypted('globalTasks', 'id'),
        getAllDecrypted('globalDocs', 'id'),
        getAllDecrypted('globalCalendarItems', 'id')
      ]);
      return (projects?.length || 0) > 0
        || (globalTasks?.length || 0) > 0
        || (globalDocs?.length || 0) > 0
        || (globalCalendarItems?.length || 0) > 0;
    }

    async function runBackupReminderCheck() {
      try {
        if (!shouldShowBackupReminder()) return;
        if (Math.random() > 0.33) return;
        if (!(await hasBackupWorthyData())) return;
        const body = 'Exportez vos donnees utilisateur en JSON pour limiter le risque de perte en cas de suppression des donnees de site (IndexedDB incluse).';
        showToast('Sauvegarde conseillee: export JSON disponible dans le profil');
        addNotification('Sauvegarde conseillee', body, null, {
          actorName: 'Système',
          targetView: 'profile',
          linkLabel: 'Ouvrir profil (export JSON)'
        });
        markBackupReminderShown();
      } catch (error) {
        console.warn('Backup reminder check failed:', error);
      }
    }

    function startBackupReminders() {
      if (backupReminderInterval) return;
      setTimeout(() => {
        runBackupReminderCheck();
      }, 45000);
      backupReminderInterval = setInterval(() => {
        runBackupReminderCheck();
      }, 20 * 60 * 1000);
    }

    function stopBackupReminders() {
      if (!backupReminderInterval) return;
      clearInterval(backupReminderInterval);
      backupReminderInterval = null;
    }

    function showToast(message, duration = 3000) {
      if (window.TaskMDAUI?.showToast) {
        window.TaskMDAUI.showToast(message, duration);
        return;
      }
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = message;
      toast.classList.remove('hidden');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, duration);
    }

    async function notifyNewEvent(projectId) {
      showToast('🔄 Nouvelle mise à jour reçue');
      addNotification('Synchronisation', 'Une mise a jour distante a ete recue', projectId);
      await refreshStats();

      // Si on est dans la vue détaillée de ce projet, la rafraîchir
      if (currentProjectId === projectId) {
        await showProjectDetail(projectId);
      } else {
        await renderProjects();
        applyLiveSearchFilter();
      }
    }

    async function renderProjects() {
      await refreshKnownUsersCache();
      const projects = await getAllProjects();
      const container = document.getElementById('projects-container');
      const projectsList = document.getElementById('projects-list');
      const paginationContainer = document.getElementById('projects-pagination');
      const isListView = projectsViewMode === 'list';
      container.className = isListView
        ? 'space-y-3'
        : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
      updateProjectsViewButtons();
      const filteredProjects = projects.filter(project => matchesQuery([
        project.name,
        project.description,
        project.status,
        project.sharingMode
      ], globalSearchQuery));
      if (paginationContainer) paginationContainer.innerHTML = '';

      if (projects.length === 0) {
        projectsList.classList.add('hidden');
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
      }

      projectsList.classList.remove('hidden');
      if (filteredProjects.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8">Aucun projet ne correspond à la recherche</p>';
        return;
      }

      const pagination = paginateItems(filteredProjects, projectsPage, paginationConfig.projectsPerPage);
      projectsPage = pagination.currentPage;
      const pageStates = await Promise.all(
        pagination.pageItems.map(async (project) => {
          const state = await getProjectState(project.projectId);
          return [project.projectId, state];
        })
      );
      const stateByProjectId = new Map(pageStates);
      container.innerHTML = pagination.pageItems.map(project => {
        const state = stateByProjectId.get(project.projectId);
        const canEdit = canEditProjectMeta(state);
        const canDelete = canDeleteProjectMeta(state);
        const isPrivate = project.sharingMode === 'private';
        const icon = isPrivate ? 'lock' : 'groups';
        const badge = isPrivate
          ? '<span class="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-full font-semibold whitespace-nowrap">PRIVE</span>'
          : '<span class="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-semibold whitespace-nowrap">PARTAGE</span>';
        const status = String(project.status || 'en-cours');
        const statusBadge = status === 'urgent'
          ? '<span class="text-[10px] px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold uppercase whitespace-nowrap">Urgent</span>'
          : status === 'termine'
            ? '<span class="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold uppercase whitespace-nowrap">Termine</span>'
            : status === 'planifie'
              ? '<span class="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold uppercase whitespace-nowrap">Planifie</span>'
              : '<span class="text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold uppercase whitespace-nowrap">En&nbsp;cours</span>';
        const progressClass = status === 'urgent'
          ? 'bg-red-500 w-[82%]'
          : status === 'termine'
            ? 'bg-emerald-500 w-full'
            : status === 'planifie'
              ? 'bg-amber-500 w-[28%]'
              : 'bg-primary w-[58%]';
        const participantRows = (state?.members || []).map(member => ({
          userId: member.userId,
          name: member.displayName || ''
        }));
        if (participantRows.length === 0 && project?.createdBy) {
          participantRows.push({ userId: project.createdBy, name: '' });
        }
        const participantsHtml = renderParticipantsStack(participantRows, 3);

        return `
          <div class="project-card rounded-xl p-6 cursor-pointer ${isListView ? 'project-card-list' : ''}" onclick="showProjectDetail('${project.projectId}')">
            <div class="flex items-start justify-between mb-2 gap-3">
              <h4 class="text-xl font-bold font-headline text-slate-900 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-lg">${icon}</span>
                <span>${project.name}</span>
              </h4>
              <div class="flex items-center gap-1">${badge}${statusBadge}</div>
            </div>
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">${project.description || 'Aucune description'}</p>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-sm text-gray-500">
                <span class="material-symbols-outlined text-lg">calendar_today</span>
                <span>${new Date(project.createdAt).toLocaleDateString('fr-FR')}</span>
              </div>
              <div class="flex items-center gap-2">
                ${participantsHtml}
                <span class="text-[11px] font-semibold text-slate-500">${isPrivate ? 'Mode solo' : 'Mode collaboratif'}</span>
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button
                class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 ${canEdit ? 'bg-white text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}"
                ${canEdit ? '' : 'disabled title="Reserve aux owners/managers"'}
                onclick="event.stopPropagation(); openEditProjectModalFromDashboard('${project.projectId}')"
              >Modifier</button>
              <button
                class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${canDelete ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'}"
                ${canDelete ? '' : 'disabled title="Reserve au owner"'}
                onclick="event.stopPropagation(); deleteProjectFromDashboard('${project.projectId}')"
              >Supprimer</button>
            </div>
            <div class="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full ${progressClass}"></div>
            </div>
            <div class="mt-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">${status}</div>
          </div>
        `;
      }).join('');
      renderPagination('projects-pagination', pagination, 'setProjectsPage', 'projets');
    }

    let currentProjectId = null;
    let currentProjectState = null;
    let currentProjectEvents = [];
    let workspaceMode = 'dashboard'; // dashboard | project | global
    let globalWorkspaceView = 'tasks'; // tasks | calendar | docs | settings
    let projectDetailMode = 'work'; // work | settings
    let projectPermissionDetailsOpen = false;
    let activeProjectView = 'list';
    let editingTaskId = null;
    let draggedTaskId = null;
    let timelineFilter = 'all';
    let calendarCursor = new Date();
    let selectedCalendarDayKey = null;
    let calendarDayFilterEnabled = false;
    let editingMessageId = null;
    let editingMessageDraft = '';
    let messagePreviewEnabled = false;
    let emojiPickerOpen = false;
    let messageFilters = { query: '', onlyMine: false };
    let globalSearchQuery = '';
    let docsFilters = { query: '', type: 'all', sort: 'recent' };
    let activityFilters = { type: 'all', author: '', period: 'all' };
    let notifications = [];
    let notificationsOpen = false;
    let dueReminderInterval = null;
    let backupReminderInterval = null;
    let dueReminderBusy = false;
    let editProjectFromDashboard = false;
    let dueReminderMemory = {};
    let browserNotifPermissionChecked = false;
    let standaloneTaskMode = false;
    let globalTasksViewMode = localStorage.getItem('taskmda_global_tasks_view') || 'cards'; // cards | list | kanban | timeline
    let globalCalendarViewMode = 'list'; // list | grid
    let globalCalendarSelectedDay = null;
    let editingGlobalCalendarItemId = null;
    let selectedUserGroupId = null;
    let editingStandaloneTaskId = null;
    let archivedTasksExpanded = false;
    let globalThemeCatalog = [];
    let globalGroupCatalog = [];
    let knownUsersCache = new Map();
    let projectsViewMode = localStorage.getItem('taskmda_projects_view') === 'list' ? 'list' : 'grid';
    const paginationConfig = {
      projectsPerPage: 6,
      tasksPerPage: 8,
      globalTasksPerPage: 10
    };
    let projectsPage = 1;
    let tasksPage = 1;
    let globalTasksPage = 1;
    let draggedGlobalTaskRef = null;
    const chatEmojiPalette = [
      '😀', '😄', '🙂', '😉', '😊', '😍', '😎', '🤝',
      '👍', '👏', '🙌', '🙏', '💡', '✅', '⚠️', '🚀',
      '📌', '📅', '📎', '📝', '📣', '🎯', '🔥', '💬'
    ];

    function escapeHtml(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatDate(dateValue) {
      if (!dateValue) return 'Non définie';
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return 'Non définie';
      return date.toLocaleDateString('fr-FR');
    }

    function normalizeSharingMode(mode, fallback = 'private') {
      return mode === 'shared' || mode === 'private' ? mode : fallback;
    }

    function sharingModeLabel(mode) {
      return normalizeSharingMode(mode, 'private') === 'shared' ? 'Collaboratif' : 'Solo';
    }

    function sharingModeBadge(mode) {
      const normalized = normalizeSharingMode(mode, 'private');
      if (normalized === 'shared') {
        return '<span class="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Collaboratif</span>';
      }
      return '<span class="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">Solo</span>';
    }

    function toYmd(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function taskDueDateKey(task) {
      if (!task?.dueDate) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) return task.dueDate;
      const d = new Date(task.dueDate);
      if (Number.isNaN(d.getTime())) return null;
      return toYmd(d);
    }

    function formatFileSize(size) {
      if (!size) return '0 o';
      if (size < 1024) return `${size} o`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
      return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
    }

    function paginateItems(items, page, pageSize) {
      const totalItems = items.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const currentPage = Math.min(Math.max(1, page), totalPages);
      const start = (currentPage - 1) * pageSize;
      const end = Math.min(totalItems, start + pageSize);
      const pageItems = items.slice(start, start + pageSize);
      return { totalItems, totalPages, currentPage, start, end, pageItems };
    }

    function renderPagination(containerId, pagination, setPageFunctionName, label) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const { totalItems, totalPages, currentPage, start, end } = pagination;
      if (totalItems === 0) {
        container.innerHTML = '';
        return;
      }

      const info = `Affichage ${start + 1}-${end} sur ${totalItems} ${label}`;
      if (totalPages <= 1) {
        container.innerHTML = `<span>${info}</span><span></span>`;
        return;
      }

      container.innerHTML = `
        <span>${info}</span>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 ${currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : ''}"
            ${currentPage <= 1 ? 'disabled' : `onclick="${setPageFunctionName}(${currentPage - 1})"`}
          >
            Précédent
          </button>
          <span class="text-xs text-slate-500">Page ${currentPage}/${totalPages}</span>
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 ${currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
            ${currentPage >= totalPages ? 'disabled' : `onclick="${setPageFunctionName}(${currentPage + 1})"`}
          >
            Suivant
          </button>
        </div>
      `;
    }

    async function setProjectsPage(page) {
      projectsPage = Math.max(1, Number(page) || 1);
      await renderProjects();
    }

    function updateProjectsViewButtons() {
      const gridBtn = document.getElementById('projects-view-grid');
      const listBtn = document.getElementById('projects-view-list');
      if (!gridBtn || !listBtn) return;
      gridBtn.classList.toggle('view-tab-active', projectsViewMode === 'grid');
      listBtn.classList.toggle('view-tab-active', projectsViewMode === 'list');
    }

    async function setProjectsViewMode(mode) {
      const next = mode === 'list' ? 'list' : 'grid';
      projectsViewMode = next;
      localStorage.setItem('taskmda_projects_view', next);
      updateProjectsViewButtons();
      await renderProjects();
    }

    async function setTasksPage(page) {
      tasksPage = Math.max(1, Number(page) || 1);
      renderTasks(currentProjectState?.tasks || []);
    }

    async function setGlobalTasksPage(page) {
      globalTasksPage = Math.max(1, Number(page) || 1);
      await renderGlobalTasks();
    }

    function updateGlobalTasksViewButtons() {
      const buttons = {
        cards: document.getElementById('global-tasks-view-cards'),
        list: document.getElementById('global-tasks-view-list'),
        kanban: document.getElementById('global-tasks-view-kanban'),
        timeline: document.getElementById('global-tasks-view-timeline')
      };
      Object.entries(buttons).forEach(([mode, btn]) => {
        if (!btn) return;
        btn.classList.toggle('view-tab-active', mode === globalTasksViewMode);
      });
    }

    function getViewButtons() {
      return {
        list: document.getElementById('view-list'),
        kanban: document.getElementById('view-kanban'),
        timeline: document.getElementById('view-timeline'),
        docs: document.getElementById('view-docs'),
        chat: document.getElementById('view-chat'),
        activity: document.getElementById('view-activity')
      };
    }

    function renderSafeMarkdown(text) {
      let html = escapeHtml(text || '');
      html = html.replace(/^### (.*)$/gm, '<h4>$1</h4>');
      html = html.replace(/^## (.*)$/gm, '<h3>$1</h3>');
      html = html.replace(/^# (.*)$/gm, '<h2>$1</h2>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(/`(.+?)`/g, '<code>$1</code>');
      html = html.replace(/\n/g, '<br>');
      return html;
    }

    function focusElementById(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.focus();
      if (typeof el.select === 'function') {
        el.select();
      }
    }

    function setProjectDetailMode(mode) {
      const nextMode = mode === 'settings' ? 'settings' : 'work';
      projectDetailMode = nextMode;
      const workPanel = document.getElementById('project-work-panel');
      const settingsPanel = document.getElementById('project-settings-panel');
      const workBtn = document.getElementById('project-mode-work');
      const settingsBtn = document.getElementById('project-mode-settings');
      const addTaskBtn = document.getElementById('btn-add-task');

      if (workPanel) workPanel.classList.toggle('hidden', nextMode !== 'work');
      if (settingsPanel) settingsPanel.classList.toggle('hidden', nextMode !== 'settings');
      if (addTaskBtn) addTaskBtn.classList.toggle('hidden', nextMode !== 'work');
      if (workBtn) workBtn.classList.toggle('view-tab-active', nextMode === 'work');
      if (settingsBtn) settingsBtn.classList.toggle('view-tab-active', nextMode === 'settings');
    }

    function setProjectView(view) {
      if (view === 'activity' && !canReadProjectActivity(currentProjectState)) {
        showToast('Action non autorisee');
        view = 'list';
      }
      activeProjectView = view;

      const sections = {
        list: document.getElementById('task-list-section'),
        kanban: document.getElementById('kanban-section'),
        timeline: document.getElementById('timeline-section'),
        docs: document.getElementById('documents-section'),
        chat: document.getElementById('discussion-section'),
        activity: document.getElementById('activity-section')
      };

      Object.entries(sections).forEach(([key, el]) => {
        if (!el) return;
        el.classList.toggle('hidden', key !== view);
      });

      const buttons = getViewButtons();
      Object.entries(buttons).forEach(([key, btn]) => {
        if (!btn) return;
        if (key === 'activity' && !canReadProjectActivity(currentProjectState)) {
          btn.classList.add('opacity-50');
          btn.setAttribute('aria-disabled', 'true');
          btn.setAttribute('title', 'Reserve aux owners/managers');
        } else if (key === 'activity') {
          btn.classList.remove('opacity-50');
          btn.removeAttribute('aria-disabled');
          btn.removeAttribute('title');
        }
        if (key === view) {
          btn.classList.add('view-tab-active');
          btn.setAttribute('aria-selected', 'true');
          btn.setAttribute('tabindex', '0');
        } else {
          btn.classList.remove('view-tab-active');
          btn.setAttribute('aria-selected', 'false');
          btn.setAttribute('tabindex', '-1');
        }
      });

      if (workspaceMode === 'project') {
        setActiveSidebarNav('projects');
      } else {
        const navKey = view === 'docs'
          ? 'docs'
          : view === 'timeline'
            ? 'calendar'
            : 'tasks';
        setActiveSidebarNav(navKey);
      }
      applyLiveSearchFilter();
    }

    async function getDirectoryUsersMap() {
      const directoryUsers = await getAllDecrypted('directoryUsers', 'userId');
      return new Map((directoryUsers || []).map(u => [u.userId, u]));
    }

    async function getProjectMembersResolved(state) {
      const directoryMap = await getDirectoryUsersMap();
      const users = await getAllDecrypted('users', 'userId');
      const usersMap = new Map((users || []).map(u => [u.userId, u]));
      return (state?.members || []).map(member => {
        const known = usersMap.get(member.userId) || directoryMap.get(member.userId);
        return {
          ...member,
          displayNameResolved: member.displayName || known?.name || fallbackDirectoryName(member.userId)
        };
      });
    }

    function bindProjectKpiActions() {
      const actions = [
        {
          valueId: 'project-kpi-tasks',
          onClick: () => {
            setProjectDetailMode('work');
            setProjectView('list');
            document.getElementById('task-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        },
        {
          valueId: 'project-kpi-done',
          onClick: () => {
            setProjectDetailMode('work');
            timelineFilter = 'milestone';
            setProjectView('timeline');
            renderTimeline((currentProjectState?.tasks || []).filter(t => !t.archivedAt));
            document.getElementById('timeline-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        },
        {
          valueId: 'project-kpi-messages',
          onClick: () => {
            setProjectDetailMode('work');
            setProjectView('chat');
            document.getElementById('discussion-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      ];

      actions.forEach(({ valueId, onClick }) => {
        const value = document.getElementById(valueId);
        const block = value?.parentElement;
        if (!block) return;
        block.classList.add('project-kpi-action');
        block.setAttribute('role', 'button');
        block.setAttribute('tabindex', '0');
        block.onclick = onClick;
        block.onkeydown = (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          onClick();
        };
      });
    }

    async function renderMemberDirectoryAutocomplete(state) {
      const input = document.getElementById('member-name-input');
      const list = document.getElementById('member-name-options');
      if (!input || !list) return;
      const directoryUsers = await getAllDecrypted('directoryUsers', 'userId');
      const existingMemberIds = new Set((state?.members || []).map(m => m.userId));
      const names = Array.from(new Set(
        (directoryUsers || [])
          .filter(u => u && u.userId && !existingMemberIds.has(u.userId))
          .map(u => String(u.name || '').trim())
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b, 'fr'));
      list.innerHTML = names.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
    }

    async function refreshTaskAssigneeOptions(state, selectedUserId = '', selectedName = '') {
      const assigneeSelect = document.getElementById('task-assignee');
      if (!assigneeSelect) return;
      const legacyName = String(selectedName || '').trim();

      if (!state?.project) {
        const currentName = currentUser?.name || 'Moi';
        let html = `
          <option value="">Non assigné</option>
          <option value="${escapeHtml(currentUser?.userId || '')}">${escapeHtml(currentName)}</option>
        `;
        if (!selectedUserId && legacyName && normalizeSearch(legacyName) !== normalizeSearch(currentName)) {
          html += `<option value="legacy:${escapeHtml(legacyName)}">${escapeHtml(`${legacyName} (hors annuaire)`)}</option>`;
        }
        assigneeSelect.innerHTML = html;
        assigneeSelect.value = selectedUserId || (legacyName ? `legacy:${legacyName}` : '');
        return;
      }

      const members = await getProjectMembersResolved(state);
      const options = ['<option value="">Non assigné</option>', ...members.map(m => `<option value="${escapeHtml(m.userId)}">${escapeHtml(m.displayNameResolved)}</option>`)];
      assigneeSelect.innerHTML = options.join('');

      let value = selectedUserId || '';
      if (!value && selectedName) {
        const matched = members.find(m => normalizeSearch(m.displayNameResolved) === normalizeSearch(selectedName));
        value = matched?.userId || '';
      }
      if (!value && legacyName) {
        const legacyValue = `legacy:${legacyName}`;
        assigneeSelect.innerHTML += `<option value="${escapeHtml(legacyValue)}">${escapeHtml(`${legacyName} (hors annuaire)`)}</option>`;
        value = legacyValue;
      }
      assigneeSelect.value = value;
    }

    function parseManualAssigneeNames(value) {
      return String(value || '')
        .split(/\n|,/g)
        .map(v => v.trim())
        .filter(Boolean);
    }

    async function refreshTaskAssigneeOptionsMulti(state, selectedUserIds = []) {
      const assigneeSelect = document.getElementById('task-assignee');
      if (!assigneeSelect) return;
      const selectedSet = new Set((selectedUserIds || []).filter(Boolean));

      if (!state?.project) {
        const currentName = currentUser?.name || 'Moi';
        assigneeSelect.innerHTML = `<option value="${escapeHtml(currentUser?.userId || '')}">${escapeHtml(currentName)}</option>`;
        Array.from(assigneeSelect.options || []).forEach(opt => {
          opt.selected = selectedSet.has(opt.value);
        });
        return;
      }

      const members = await getProjectMembersResolved(state);
      assigneeSelect.innerHTML = members.map(m => `<option value="${escapeHtml(m.userId)}">${escapeHtml(m.displayNameResolved)}</option>`).join('');
      Array.from(assigneeSelect.options || []).forEach(opt => {
        opt.selected = selectedSet.has(opt.value);
      });
    }

    async function renderUserGroupMemberSelect(state) {
      const select = document.getElementById('user-group-members-input');
      if (!select) return;
      const members = await getProjectMembersResolved(state);
      select.innerHTML = members.map(member => `
        <option value="${escapeHtml(member.userId)}">${escapeHtml(member.displayNameResolved)}</option>
      `).join('');
    }

    async function renderProjectUserGroups(state) {
      const list = document.getElementById('project-user-groups-list');
      const createBtn = document.getElementById('btn-create-user-group');
      const updateBtn = document.getElementById('btn-update-user-group');
      const membersSelect = document.getElementById('user-group-members-input');
      if (!list || !createBtn || !updateBtn || !membersSelect) return;

      const canManage = canManageProjectCollaboration(state);
      createBtn.disabled = !canManage;
      createBtn.classList.toggle('opacity-50', !canManage);
      updateBtn.disabled = !canManage;
      updateBtn.classList.toggle('opacity-50', !canManage);
      membersSelect.disabled = !canManage;

      await renderUserGroupMemberSelect(state);
      const members = await getProjectMembersResolved(state);
      const byId = new Map(members.map(m => [m.userId, m.displayNameResolved]));
      const userGroups = state?.userGroups || [];

      if (userGroups.length === 0) {
        list.innerHTML = `
          <div class="empty-state-card">
            <p class="empty-state-title">Aucun groupe utilisateurs</p>
            <p class="empty-state-text">Regroupez des membres pour assigner plus vite les tâches collaboratives.</p>
            ${canManage ? '<button class="empty-state-cta" onclick="focusElementById(\'user-group-name-input\')">Créer un groupe utilisateurs</button>' : ''}
          </div>
        `;
        selectedUserGroupId = null;
        return;
      }

      if (!selectedUserGroupId || !userGroups.find(g => g.groupId === selectedUserGroupId)) {
        selectedUserGroupId = userGroups[0].groupId;
      }

      list.innerHTML = userGroups.map(group => {
        const active = group.groupId === selectedUserGroupId;
        const memberNames = (group.memberUserIds || []).map(id => byId.get(id) || fallbackDirectoryName(id));
        return `
          <div class="rounded-lg border ${active ? 'border-primary bg-blue-50' : 'border-slate-200 bg-white'} p-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-slate-800">${escapeHtml(group.name || 'Groupe')}</p>
                <p class="text-xs text-slate-500 mt-1">${escapeHtml(memberNames.join(', ') || 'Aucun membre')}</p>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <button onclick="selectUserGroup('${group.groupId}')" class="px-2 py-1 rounded bg-slate-100 text-slate-700">Selectionner</button>
                ${canManage ? `<button onclick="deleteUserGroup('${group.groupId}')" class="px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      const selected = userGroups.find(g => g.groupId === selectedUserGroupId);
      const selectedIds = new Set(selected?.memberUserIds || []);
      Array.from(membersSelect.options || []).forEach(opt => {
        opt.selected = selectedIds.has(opt.value);
      });
    }

    async function renderProjectMembers(state) {
      const container = document.getElementById('project-members-list');
      const addBtn = document.getElementById('btn-add-member');
      const nameInput = document.getElementById('member-name-input');
      const roleInput = document.getElementById('member-role-input');
      if (!container || !addBtn || !nameInput || !roleInput) return;

      const members = await getProjectMembersResolved(state);
      const canManage = canManageProjectCollaboration(state);
      const myRole = normalizeProjectRole(getMyProjectRole(state));

      addBtn.disabled = !canManage;
      addBtn.classList.toggle('opacity-50', !canManage);
      nameInput.disabled = !canManage;
      roleInput.disabled = !canManage;
      await renderMemberDirectoryAutocomplete(state);

      if (members.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500">Aucun membre dans ce projet.</p>';
        return;
      }

      container.innerHTML = members.map(member => {
        const displayName = escapeHtml(member.displayNameResolved || fallbackDirectoryName(member.userId));
        const normalizedRole = normalizeProjectRole(member.role);
        const role = escapeHtml(normalizedRole);
        const canRemoveMember = canManage
          && member.userId !== currentUser?.userId
          && (myRole === 'owner' || normalizedRole === 'member');
        const removeBtn = canRemoveMember
          ? `<button onclick="removeProjectMember('${escapeHtml(member.userId)}')" class="text-red-600 hover:underline text-xs">Retirer</button>`
          : '';
        return `
          <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-800 truncate">${displayName}</p>
              <p class="text-xs text-slate-500">Rôle: ${role}</p>
            </div>
            ${removeBtn}
          </div>
        `;
      }).join('');
    }

    function renderProjectPermissionMatrix(state) {
      const tbody = document.getElementById('project-permissions-matrix');
      const roleBadge = document.getElementById('project-permission-role-badge');
      const summary = document.getElementById('project-permission-summary');
      const details = document.getElementById('project-permissions-details');
      const toggle = document.getElementById('btn-toggle-permissions-details');
      if (!tbody) return;

      const role = normalizeProjectRole(getMyProjectRole(state));
      const roleLabel = role === 'owner' ? 'Owner' : role === 'manager' ? 'Manager' : role === 'member' ? 'Member' : 'Aucun';
      if (roleBadge) {
        roleBadge.textContent = `Role: ${roleLabel}`;
        roleBadge.className = `text-xs font-semibold px-2 py-1 rounded-full ${
          role === 'owner'
            ? 'bg-amber-100 text-amber-800'
            : role === 'manager'
              ? 'bg-blue-100 text-blue-800'
              : role === 'member'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-700'
        }`;
      }

      const rows = [
        { action: 'Lire le projet (taches, docs, discussion)', owner: true, manager: true, member: true },
        { action: 'Modifier les infos projet', owner: true, manager: true, member: false },
        { action: 'Supprimer le projet', owner: true, manager: false, member: false },
        { action: 'Creer une tache', owner: true, manager: true, member: true },
        { action: 'Editer/supprimer ses taches', owner: true, manager: true, member: true },
        { action: 'Editer/supprimer toutes les taches', owner: true, manager: true, member: false },
        { action: 'Changer statut de toute tache', owner: true, manager: true, member: false },
        { action: 'Envoyer un message', owner: true, manager: true, member: true },
        { action: 'Editer/supprimer tous les messages', owner: true, manager: true, member: false },
        { action: 'Consulter le journal activite', owner: true, manager: true, member: false },
        { action: 'Invitations / Groupes utilisateurs / Groupes thematiques / Thematiques', owner: true, manager: true, member: false },
        { action: 'Gerer les membres du projet*', owner: true, manager: true, member: false }
      ];

      const roleRules = {
        owner: { label: 'Owner', description: 'Pilotage complet du projet', allowed: rows.filter(r => r.owner).length, total: rows.length, chip: 'bg-amber-100 text-amber-800' },
        manager: { label: 'Manager', description: 'Gestion opérationnelle avancée', allowed: rows.filter(r => r.manager).length, total: rows.length, chip: 'bg-blue-100 text-blue-800' },
        member: { label: 'Member', description: 'Exécution et contribution', allowed: rows.filter(r => r.member).length, total: rows.length, chip: 'bg-emerald-100 text-emerald-800' }
      };
      if (summary) {
        summary.innerHTML = ['owner', 'manager', 'member'].map((key) => {
          const rr = roleRules[key];
          const active = role === key ? ' ring-2 ring-indigo-200' : '';
          return `
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2${active}">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-semibold text-slate-800">${rr.label}</p>
                <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold ${rr.chip}">${rr.allowed}/${rr.total}</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">${rr.description}</p>
            </div>
          `;
        }).join('');
      }

      const renderCell = (allowed, isCurrentCol) => {
        const base = 'py-2 px-2 border-b border-slate-100';
        const current = isCurrentCol ? ' bg-indigo-50' : '';
        if (allowed) {
          return `<td class="${base}${current}"><span class="inline-flex items-center text-emerald-700 font-semibold" title="Autorisé"><span class="material-symbols-outlined text-base">check_circle</span></span></td>`;
        }
        return `<td class="${base}${current}"><span class="inline-flex items-center text-slate-400 font-semibold" title="Non autorisé"><span class="material-symbols-outlined text-base">remove_circle</span></span></td>`;
      };

      tbody.innerHTML = rows.map((row) => `
        <tr>
          <td class="py-2 pr-3 border-b border-slate-100 text-slate-700">${escapeHtml(row.action)}</td>
          ${renderCell(row.owner, role === 'owner')}
          ${renderCell(row.manager, role === 'manager')}
          ${renderCell(row.member, role === 'member')}
        </tr>
      `).join('');

      if (details) {
        details.classList.toggle('hidden', !projectPermissionDetailsOpen);
      }
      if (toggle) {
        toggle.textContent = projectPermissionDetailsOpen ? 'Masquer le détail des droits' : 'Voir le détail des droits';
      }
    }

    function getMyProjectRole(state = currentProjectState) {
      if (!state?.project || !currentUser?.userId) return null;
      const member = (state?.members || []).find(m => m.userId === currentUser?.userId);
      if (member?.role) return member.role;
      if (state.project.createdBy && state.project.createdBy === currentUser.userId) return 'owner';
      return null;
    }

    function normalizeProjectRole(role) {
      if (role === 'owner' || role === 'manager' || role === 'member') return role;
      return 'member';
    }

    function hasProjectRole(state = currentProjectState) {
      return Boolean(getMyProjectRole(state));
    }

    function isProjectOwner(state = currentProjectState) {
      return normalizeProjectRole(getMyProjectRole(state)) === 'owner';
    }

    function isProjectManagerOrOwner(state = currentProjectState) {
      const role = normalizeProjectRole(getMyProjectRole(state));
      return role === 'owner' || role === 'manager';
    }

    function canEditProjectMeta(state = currentProjectState) {
      return isProjectManagerOrOwner(state);
    }

    function canDeleteProjectMeta(state = currentProjectState) {
      return isProjectOwner(state);
    }

    function canCreateTaskInProject(state = currentProjectState) {
      return hasProjectRole(state);
    }

    function canEditTaskInProject(task, state = currentProjectState) {
      if (!task) return false;
      if (isProjectManagerOrOwner(state)) return true;
      return task.createdBy === currentUser?.userId;
    }

    function canChangeTaskStatus(task, state = currentProjectState) {
      if (!task) return false;
      if (canEditTaskInProject(task, state)) return true;
      const assigneeEntries = getTaskAssigneeEntries(task, state);
      if (assigneeEntries.some(a => a.userId && a.userId === currentUser?.userId)) return true;
      const me = normalizeSearch(currentUser?.name || '');
      return assigneeEntries.some(a => normalizeSearch(a.name || '') === me);
    }

    function canDeleteTaskInProject(task, state = currentProjectState) {
      if (!task) return false;
      if (isProjectManagerOrOwner(state)) return true;
      return task.createdBy === currentUser?.userId;
    }

    function canSendProjectMessage(state = currentProjectState) {
      return hasProjectRole(state);
    }

    function canEditProjectMessage(msg, state = currentProjectState) {
      if (!msg) return false;
      if (isProjectManagerOrOwner(state)) return true;
      return msg.author === currentUser?.userId;
    }

    function canDeleteProjectMessage(msg, state = currentProjectState) {
      return canEditProjectMessage(msg, state);
    }

    function canReadProjectActivity(state = currentProjectState) {
      return isProjectManagerOrOwner(state);
    }

    function canManageProjectCollaboration(state = currentProjectState) {
      return isProjectManagerOrOwner(state);
    }

    function getGroupNameById(state, groupId) {
      if (!groupId) return '';
      const group = (state?.groups || []).find(g => g.groupId === groupId);
      return group?.name || '';
    }

    function getTaskGroupName(task, state = currentProjectState) {
      if (!task) return '';
      if (task.groupName) return String(task.groupName);
      return getGroupNameById(state, task.groupId);
    }

    function getTaskAssigneeEntries(task, state = currentProjectState) {
      if (!task) return [];
      const memberMap = new Map((state?.members || []).map(m => [m.userId, m.displayName || '']));
      if (Array.isArray(task.assignees) && task.assignees.length > 0) {
        const dedup = [];
        const seen = new Set();
        task.assignees.forEach((entry) => {
          const userId = String(entry?.userId || '').trim();
          const fallbackName = userId ? (memberMap.get(userId) || '') : '';
          const name = String(entry?.name || fallbackName || '').trim();
          const key = `${userId}|${normalizeSearch(name)}`;
          if (!userId && !name) return;
          if (seen.has(key)) return;
          seen.add(key);
          dedup.push({ userId: userId || null, name });
        });
        return dedup;
      }
      const member = (state?.members || []).find(m => m.userId === task.assigneeUserId);
      const legacyName = task.assignee || member?.displayName || '';
      if (!task.assigneeUserId && !legacyName) return [];
      return [{ userId: task.assigneeUserId || null, name: String(legacyName || '').trim() }];
    }

    function getTaskAssigneeNames(task, state = currentProjectState) {
      return getTaskAssigneeEntries(task, state)
        .map(a => String(a.name || '').trim())
        .filter(Boolean);
    }

    function getTaskAssigneeName(task, state = currentProjectState, firstOnly = false) {
      const names = getTaskAssigneeNames(task, state);
      if (names.length === 0) return '';
      return firstOnly ? names[0] : names.join(', ');
    }

    function buildGlobalTaskRef(task) {
      return encodeURIComponent(JSON.stringify({
        sourceType: task?.sourceType || '',
        sourceProjectId: task?.sourceProjectId || null,
        taskId: task?.taskId || null,
        id: task?.id || null
      }));
    }

    function parseGlobalTaskRef(ref) {
      try {
        return JSON.parse(decodeURIComponent(ref || ''));
      } catch {
        return null;
      }
    }

    async function resolveGlobalTaskFromRef(ref) {
      const parsed = parseGlobalTaskRef(ref);
      if (!parsed) return null;
      if (parsed.sourceType === 'standalone' && parsed.id) {
        const task = await getDecrypted('globalTasks', parsed.id, 'id');
        if (!task) return null;
        return { task, sourceType: 'standalone' };
      }
      if (parsed.sourceType === 'project' && parsed.sourceProjectId && parsed.taskId) {
        const state = await getProjectState(parsed.sourceProjectId);
        if (!state?.project) return null;
        const task = (state.tasks || []).find(t => t.taskId === parsed.taskId);
        if (!task) return null;
        return { task, state, sourceType: 'project', projectId: parsed.sourceProjectId };
      }
      return null;
    }

    function collectProjectRecipientEmails(state = currentProjectState) {
      return Array.from(new Set(
        (state?.invites || [])
          .filter(inv => inv.email && inv.status !== 'declined')
          .map(inv => String(inv.email).trim())
          .filter(Boolean)
      ));
    }

    function normalizeMailText(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/\u2026/g, '...');
    }

    function openMailto({ to = [], subject = '', body = '' }) {
      const toValue = Array.isArray(to) ? to.join(',') : String(to || '');
      // Outlook/clients Windows can misread UTF-8 percent-encoding in mailto.
      // We normalize to ASCII-safe text to avoid mojibake in generated drafts.
      const safeSubject = normalizeMailText(subject);
      const safeBody = normalizeMailText(body);
      const mailto = `mailto:${encodeURIComponent(toValue)}?subject=${encodeURIComponent(safeSubject)}&body=${encodeURIComponent(safeBody)}`;
      window.location.href = mailto;
    }

    async function sendInvitationEmail(inviteId) {
      if (!currentProjectId) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Seuls owner/manager peuvent envoyer des invitations');
        return;
      }
      const state = await getProjectState(currentProjectId);
      const invite = (state?.invites || []).find(i => i.inviteId === inviteId);
      if (!invite) return;

      const projectName = state?.project?.name || 'Projet';
      const roleLabel = invite.role === 'owner' ? 'owner' : invite.role === 'manager' ? 'manager' : 'membre';
      const typeLabel = invite.inviteType === 'agent' ? 'agent' : 'utilisateur';
      const subject = `[TaskMDA Team] Invitation projet: ${projectName}`;
      const body = [
        `Bonjour ${invite.displayName || ''},`,
        '',
        `Vous êtes invité(e) en tant que ${typeLabel} (${roleLabel}) sur le projet "${projectName}".`,
        '',
        'Merci de confirmer votre disponibilité et votre prise en charge.',
        '',
        `Envoyé par: ${currentUser?.name || 'Equipe projet'}`,
        `Date: ${new Date().toLocaleDateString('fr-FR')}`
      ].join('\n');

      openMailto({ to: [invite.email], subject, body });

      const event = createEvent(
        EventTypes.UPDATE_INVITE,
        currentProjectId,
        currentUser.userId,
        { inviteId, changes: { status: 'sent', lastSentAt: Date.now() } }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      await showProjectDetail(currentProjectId);
    }

    async function updateInviteStatus(inviteId, status) {
      if (!currentProjectId || !inviteId) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Seuls owner/manager peuvent mettre à jour les invitations');
        return;
      }
      const normalized = ['pending', 'sent', 'accepted', 'declined'].includes(status) ? status : 'pending';
      const invite = (currentProjectState?.invites || []).find(i => i.inviteId === inviteId);
      const myRole = normalizeProjectRole(getMyProjectRole(currentProjectState));
      if (normalized === 'accepted' && myRole === 'manager' && normalizeProjectRole(invite?.role) !== 'member') {
        showToast('Action non autorisee');
        return;
      }
      const event = createEvent(
        EventTypes.UPDATE_INVITE,
        currentProjectId,
        currentUser.userId,
        { inviteId, changes: { status: normalized } }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      if (normalized === 'accepted' && invite) {
        const users = await getAllDecrypted('users', 'userId');
        let user = users.find(u => normalizeSearch(u.name) === normalizeSearch(invite.displayName));
        if (!user) {
          user = { userId: uuidv4(), name: invite.displayName, email: invite.email, createdAt: Date.now() };
          await putEncrypted('users', user, 'userId');
        }
        await upsertDirectoryUser({
          userId: user.userId,
          name: user.name,
          email: user.email || '',
          source: 'invite_accept',
          lastSeenAt: Date.now()
        });
        const memberExists = (currentProjectState?.members || []).some(m => m.userId === user.userId);
        if (!memberExists) {
          const memberEvent = createEvent(
            EventTypes.ADD_MEMBER,
            currentProjectId,
            currentUser.userId,
            { userId: user.userId, role: invite.role || 'member', displayName: user.name }
          );
          await publishEvent(memberEvent);
          if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, memberEvent);
        }
      }
      showToast(`Invitation marquée: ${normalized}`);
      await showProjectDetail(currentProjectId);
    }

    async function addProjectInvite() {
      if (!currentProjectId || !currentProjectState) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Seuls owner/manager peuvent inviter');
        return;
      }

      const nameInput = document.getElementById('invite-name-input');
      const emailInput = document.getElementById('invite-email-input');
      const typeInput = document.getElementById('invite-type-input');
      const roleInput = document.getElementById('invite-role-input');
      const displayName = (nameInput?.value || '').trim();
      const email = (emailInput?.value || '').trim().toLowerCase();
      const inviteType = (typeInput?.value || 'user').trim();
      const role = normalizeProjectRole((roleInput?.value || 'member').trim());
      const myRole = normalizeProjectRole(getMyProjectRole(currentProjectState));
      if (myRole === 'manager' && role !== 'member') {
        showToast('Action non autorisee');
        return;
      }

      if (!displayName) {
        showToast('Nom invité requis');
        return;
      }
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk) {
        showToast('Email professionnel invalide');
        return;
      }
      const exists = (currentProjectState.invites || []).some(inv => normalizeSearch(inv.email) === normalizeSearch(email));
      if (exists) {
        showToast('Cette adresse est déjà invitée');
        return;
      }

      const event = createEvent(
        EventTypes.CREATE_INVITE,
        currentProjectId,
        currentUser.userId,
        {
          inviteId: uuidv4(),
          displayName,
          email,
          inviteType: inviteType === 'agent' ? 'agent' : 'user',
          role,
          status: 'pending'
        }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);

      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      showToast('Invitation créée');
      addNotification('Invitation', `${displayName} invité(e)`, currentProjectId);
      await showProjectDetail(currentProjectId);
    }

    function renderProjectInvitations(state) {
      const container = document.getElementById('project-invites-list');
      const btn = document.getElementById('btn-send-invite');
      if (!container || !btn) return;
      const canManage = canManageProjectCollaboration(state);
      const myRole = normalizeProjectRole(getMyProjectRole(state));
      btn.disabled = !canManage;
      btn.classList.toggle('opacity-50', !canManage);

      const invites = state?.invites || [];
      if (invites.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <p class="empty-state-title">Aucune invitation envoyée</p>
            <p class="empty-state-text">Invitez un utilisateur ou un agent pour activer la collaboration.</p>
            ${canManage ? '<button class="empty-state-cta" onclick="focusElementById(\'invite-email-input\')">Envoyer une invitation</button>' : ''}
          </div>
        `;
        return;
      }

      const statusClass = {
        pending: 'bg-amber-100 text-amber-700',
        sent: 'bg-blue-100 text-blue-700',
        accepted: 'bg-emerald-100 text-emerald-700',
        declined: 'bg-rose-100 text-rose-700'
      };

      container.innerHTML = invites
        .slice()
        .sort((a, b) => (b.invitedAt || 0) - (a.invitedAt || 0))
        .map(inv => `
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-slate-800">${escapeHtml(inv.displayName || 'Invité')}</p>
                <p class="text-xs text-slate-500">${escapeHtml(inv.email || '')} • ${(inv.inviteType === 'agent' ? 'Agent' : 'Utilisateur')} • ${escapeHtml(inv.role || 'member')}</p>
              </div>
              <span class="text-[10px] px-2 py-1 rounded-full font-semibold ${statusClass[inv.status] || statusClass.pending}">${escapeHtml(inv.status || 'pending')}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 text-xs">
              ${canManage ? `<button onclick="sendInvitationEmail('${inv.inviteId}')" class="px-2 py-1 rounded bg-slate-100 text-slate-700">Email</button>` : ''}
              ${canManage && (myRole === 'owner' || normalizeProjectRole(inv.role) === 'member') ? `<button onclick="updateInviteStatus('${inv.inviteId}','accepted')" class="px-2 py-1 rounded bg-emerald-100 text-emerald-700">Accepté</button>` : ''}
              ${canManage ? `<button onclick="updateInviteStatus('${inv.inviteId}','declined')" class="px-2 py-1 rounded bg-rose-100 text-rose-700">Refusé</button>` : ''}
            </div>
          </div>
        `).join('');
    }

    async function createProjectGroup() {
      if (!currentProjectId || !currentProjectState) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Seuls owner/manager peuvent créer des groupes');
        return;
      }
      const nameInput = document.getElementById('group-name-input');
      const descInput = document.getElementById('group-description-input');
      const name = (nameInput?.value || '').trim();
      const description = (descInput?.value || '').trim();
      if (!name) {
        showToast('Nom de groupe requis');
        return;
      }
      const exists = (currentProjectState.groups || []).some(g => normalizeSearch(g.name) === normalizeSearch(name));
      if (exists) {
        showToast('Ce groupe existe déjà');
        return;
      }

      const event = createEvent(
        EventTypes.CREATE_GROUP,
        currentProjectId,
        currentUser.userId,
        { groupId: uuidv4(), name, description }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      await upsertGlobalGroup({ name, description });
      await refreshGlobalTaxonomyCache();
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      showToast('Groupe créé');
      addNotification('Groupe', `Groupe ${name} créé`, currentProjectId);
      await showProjectDetail(currentProjectId);
    }

    async function deleteProjectGroup(groupId) {
      if (!currentProjectId || !currentProjectState || !groupId) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Seuls owner/manager peuvent supprimer des groupes');
        return;
      }
      const groupName = getGroupNameById(currentProjectState, groupId) || 'ce groupe';
      if (!confirm(`Supprimer le groupe "${groupName}" ?`)) return;

      const event = createEvent(
        EventTypes.DELETE_GROUP,
        currentProjectId,
        currentUser.userId,
        { groupId }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      showToast('Groupe supprimé');
      await showProjectDetail(currentProjectId);
    }

    function renderProjectGroups(state) {
      const container = document.getElementById('project-groups-list');
      const btn = document.getElementById('btn-create-group');
      if (!container || !btn) return;
      const canManage = canManageProjectCollaboration(state);
      btn.disabled = !canManage;
      btn.classList.toggle('opacity-50', !canManage);

      const groups = state?.groups || [];
      if (groups.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <p class="empty-state-title">Aucun groupe configuré</p>
            <p class="empty-state-text">Créez des groupes métier pour structurer les tâches et les documents.</p>
            ${canManage ? '<button class="empty-state-cta" onclick="focusElementById(\'group-name-input\')">Créer un groupe</button>' : ''}
          </div>
        `;
        return;
      }

      container.innerHTML = groups.map(group => {
        const assignedCount = (state?.tasks || []).filter(t => t.groupId === group.groupId).length;
        return `
          <div class="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(group.name)}</p>
              <p class="text-xs text-slate-500 truncate">${escapeHtml(group.description || 'Sans description')}</p>
              <p class="text-[11px] text-slate-500 mt-1">${assignedCount} tâche(s)</p>
            </div>
            ${canManage ? `<button onclick="deleteProjectGroup('${group.groupId}')" class="text-xs px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>` : ''}
          </div>
        `;
      }).join('');
    }

    async function addProjectTheme() {
      if (!currentProjectId || !currentProjectState) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Seuls owner/manager peuvent gérer les thèmes');
        return;
      }
      const input = document.getElementById('theme-name-input');
      const theme = (input?.value || '').trim();
      if (!theme) {
        showToast('Thématique requise');
        return;
      }
      const exists = (currentProjectState.themes || []).some(t => normalizeSearch(t) === normalizeSearch(theme));
      if (exists) {
        showToast('Thématique déjà présente');
        return;
      }

      const event = createEvent(
        EventTypes.ADD_THEME,
        currentProjectId,
        currentUser.userId,
        { theme }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      await upsertGlobalTheme(theme);
      await refreshGlobalTaxonomyCache();
      if (input) input.value = '';
      showToast('Thématique ajoutée');
      await showProjectDetail(currentProjectId);
    }

    async function removeProjectTheme(theme) {
      if (!currentProjectId || !currentProjectState || !theme) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Seuls owner/manager peuvent gérer les thèmes');
        return;
      }
      const event = createEvent(
        EventTypes.REMOVE_THEME,
        currentProjectId,
        currentUser.userId,
        { theme }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      showToast('Thématique retirée');
      await showProjectDetail(currentProjectId);
    }

    function renderProjectThemes(state) {
      const container = document.getElementById('project-themes-list');
      const btn = document.getElementById('btn-add-theme');
      if (!container || !btn) return;
      const canManage = canManageProjectCollaboration(state);
      btn.disabled = !canManage;
      btn.classList.toggle('opacity-50', !canManage);
      const themes = state?.themes || [];
      if (themes.length === 0) {
        container.innerHTML = `
          <div class="empty-state-card">
            <p class="empty-state-title">Aucune thématique définie</p>
            <p class="empty-state-text">Ajoutez des thématiques pour faciliter la recherche transverse.</p>
            ${canManage ? '<button class="empty-state-cta" onclick="focusElementById(\'theme-name-input\')">Ajouter une thématique</button>' : ''}
          </div>
        `;
        return;
      }
      container.innerHTML = themes.map(theme => `
        <span class="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700">
          ${escapeHtml(theme)}
          ${canManage ? `<button onclick="removeProjectTheme(decodeURIComponent('${encodeURIComponent(theme)}'))" class="text-slate-600 hover:text-rose-700">x</button>` : ''}
        </span>
      `).join('');
    }

    function refreshTaskMetadataOptions(state) {
      const groupSelect = document.getElementById('task-group');
      const themeInput = document.getElementById('task-theme');
      if (!groupSelect) return;
      const groups = state?.groups || [];
      const projectGroupRows = groups.map(g => ({
        value: g.groupId,
        label: g.name,
        scope: 'project',
        key: normalizeCatalogKey(g.name),
        groupName: g.name
      }));
      const projectKeys = new Set(projectGroupRows.map(g => g.key).filter(Boolean));
      const globalGroupRows = (globalGroupCatalog || [])
        .filter(g => g && g.groupKey && g.name)
        .filter(g => !projectKeys.has(g.groupKey))
        .map(g => ({
          value: `global:${g.groupKey}`,
          label: `${g.name} (global)`,
          scope: 'global',
          key: g.groupKey,
          groupName: g.name
        }));

      const options = ['<option value="">Aucun groupe</option>'];
      if (projectGroupRows.length > 0) {
        options.push('<optgroup label="Groupes du projet">');
        options.push(...projectGroupRows.map(g => `<option value="${escapeHtml(g.value)}" data-group-scope="${g.scope}" data-group-name="${escapeHtml(g.groupName)}">${escapeHtml(g.label)}</option>`));
        options.push('</optgroup>');
      }
      if (globalGroupRows.length > 0) {
        options.push('<optgroup label="Groupes globaux">');
        options.push(...globalGroupRows.map(g => `<option value="${escapeHtml(g.value)}" data-group-scope="${g.scope}" data-group-name="${escapeHtml(g.groupName)}">${escapeHtml(g.label)}</option>`));
        options.push('</optgroup>');
      }
      groupSelect.innerHTML = options.join('');

      if (themeInput) {
        const projectThemes = (state?.themes || []).map(t => String(t || '').trim()).filter(Boolean);
        const globalThemes = (globalThemeCatalog || []).map(t => String(t.name || '').trim()).filter(Boolean);
        const uniqThemes = Array.from(new Set([...projectThemes, ...globalThemes].map(t => `${normalizeCatalogKey(t)}|||${t}`)))
          .map(item => item.split('|||')[1])
          .filter(Boolean);

        let datalist = document.getElementById('task-theme-options');
        if (!datalist) {
          datalist = document.createElement('datalist');
          datalist.id = 'task-theme-options';
          document.body.appendChild(datalist);
        }
        datalist.innerHTML = uniqThemes.map(theme => `<option value="${escapeHtml(theme)}"></option>`).join('');
        themeInput.setAttribute('list', 'task-theme-options');
      }
    }

    async function addProjectMember() {
      if (!currentProjectId || !currentProjectState) return;

      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Action non autorisee');
        return;
      }

      const input = document.getElementById('member-name-input');
      const roleInput = document.getElementById('member-role-input');
      const name = (input?.value || '').trim();
      const role = normalizeProjectRole((roleInput?.value || 'member').trim());
      const myRole = normalizeProjectRole(getMyProjectRole(currentProjectState));
      if (myRole === 'manager' && role !== 'member') {
        showToast('Action non autorisee');
        return;
      }
      if (!name) {
        showToast('Saisissez le nom du membre');
        input?.focus();
        return;
      }

      const users = await getAllDecrypted('users', 'userId');
      const directoryUsers = await getAllDecrypted('directoryUsers', 'userId');
      const byName = (entry) => normalizeSearch(entry?.name || '') === normalizeSearch(name);
      let user = users.find(byName);
      const directoryUser = directoryUsers.find(byName);
      if (!user && directoryUser) {
        user = {
          userId: directoryUser.userId,
          name: directoryUser.name,
          email: directoryUser.email || '',
          createdAt: Date.now()
        };
        await putEncrypted('users', user, 'userId');
      }
      if (!user) {
        user = { userId: uuidv4(), name, createdAt: Date.now() };
        await putEncrypted('users', user, 'userId');
      }
      await upsertDirectoryUser({
        userId: user.userId,
        name: user.name,
        email: user.email || '',
        source: 'member_add',
        lastSeenAt: Date.now()
      });

      const exists = (currentProjectState.members || []).some(m => m.userId === user.userId);
      if (exists) {
        showToast('Ce membre est déjà dans le projet');
        return;
      }

      const event = createEvent(
        EventTypes.ADD_MEMBER,
        currentProjectId,
        currentUser.userId,
        { userId: user.userId, role, displayName: user.name }
      );
      await publishEvent(event);
      if (sharedFolderHandle) {
        await writeEventToSharedFolder(projectId, event);
      }

      input.value = '';
      showToast('Membre ajouté');
      addNotification('Membre', `${user.name} a ete ajoute au projet`, currentProjectId);
      await showProjectDetail(currentProjectId);
    }

    async function removeProjectMember(userId) {
      if (!currentProjectId || !currentProjectState || !userId) return;
      if (userId === currentUser.userId) {
        showToast('Vous ne pouvez pas vous retirer vous-même');
        return;
      }

      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Action non autorisee');
        return;
      }

      const target = (currentProjectState.members || []).find(m => m.userId === userId);
      if (!target) return;
      const myRole = normalizeProjectRole(getMyProjectRole(currentProjectState));
      const targetRole = normalizeProjectRole(target.role);
      if (myRole === 'manager' && targetRole !== 'member') {
        showToast('Action non autorisee');
        return;
      }
      if (!confirm(`Retirer ${target.displayName || userId} du projet ?`)) return;

      const event = createEvent(
        EventTypes.REMOVE_MEMBER,
        currentProjectId,
        currentUser.userId,
        { userId }
      );
      await publishEvent(event);
      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, event);
      }
      showToast('Membre retiré');
      addNotification('Membre', 'Un membre a ete retire du projet', currentProjectId);
      await showProjectDetail(currentProjectId);
    }

    window.removeProjectMember = removeProjectMember;
    window.focusElementById = focusElementById;
    window.editGlobalTheme = editGlobalTheme;
    window.deleteGlobalTheme = deleteGlobalTheme;
    window.editGlobalGroup = editGlobalGroup;
    window.deleteGlobalGroup = deleteGlobalGroup;
    window.saveGlobalGroupMembers = saveGlobalGroupMembers;

    async function createUserGroup() {
      if (!currentProjectId || !currentProjectState) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Action non autorisee');
        return;
      }
      const nameInput = document.getElementById('user-group-name-input');
      const membersSelect = document.getElementById('user-group-members-input');
      const name = (nameInput?.value || '').trim();
      if (!name) {
        showToast('Nom de groupe utilisateurs requis');
        return;
      }
      const exists = (currentProjectState.userGroups || []).some(g => normalizeSearch(g.name) === normalizeSearch(name));
      if (exists) {
        showToast('Ce groupe utilisateurs existe deja');
        return;
      }
      const selectedIds = Array.from(membersSelect?.selectedOptions || []).map(o => o.value).filter(Boolean);
      const event = createEvent(
        EventTypes.CREATE_USER_GROUP,
        currentProjectId,
        currentUser.userId,
        { groupId: uuidv4(), name, memberUserIds: selectedIds }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      if (nameInput) nameInput.value = '';
      showToast('Groupe utilisateurs cree');
      await showProjectDetail(currentProjectId);
    }

    async function updateUserGroupSelection() {
      if (!currentProjectId || !currentProjectState || !selectedUserGroupId) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Action non autorisee');
        return;
      }
      const exists = (currentProjectState.userGroups || []).some(g => g.groupId === selectedUserGroupId);
      if (!exists) {
        showToast('Selectionnez un groupe utilisateurs');
        return;
      }
      const membersSelect = document.getElementById('user-group-members-input');
      const selectedIds = Array.from(membersSelect?.selectedOptions || []).map(o => o.value).filter(Boolean);
      const event = createEvent(
        EventTypes.UPDATE_USER_GROUP,
        currentProjectId,
        currentUser.userId,
        { groupId: selectedUserGroupId, changes: { memberUserIds: [...new Set(selectedIds)] } }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      showToast('Groupe utilisateurs mis a jour');
      await showProjectDetail(currentProjectId);
    }

    async function deleteUserGroup(groupId) {
      if (!currentProjectId || !currentProjectState || !groupId) return;
      if (!canManageProjectCollaboration(currentProjectState)) {
        showToast('Action non autorisee');
        return;
      }
      const group = (currentProjectState.userGroups || []).find(g => g.groupId === groupId);
      if (!group) return;
      if (!confirm(`Supprimer le groupe utilisateurs "${group.name}" ?`)) return;
      const event = createEvent(
        EventTypes.DELETE_USER_GROUP,
        currentProjectId,
        currentUser.userId,
        { groupId }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      if (selectedUserGroupId === groupId) selectedUserGroupId = null;
      showToast('Groupe utilisateurs supprime');
      await showProjectDetail(currentProjectId);
    }

    function selectUserGroup(groupId) {
      selectedUserGroupId = groupId || null;
      renderProjectUserGroups(currentProjectState);
    }

    window.selectUserGroup = selectUserGroup;
    window.deleteUserGroup = deleteUserGroup;

    function parseSubtasks(textValue) {
      if (window.TaskMDATasks?.parseSubtasks) {
        return window.TaskMDATasks.parseSubtasks(textValue, uuidv4);
      }
      if (!textValue) return [];
      return textValue
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(label => ({ id: uuidv4(), label, done: false }));
    }

    function openTaskModal(task = null) {
      const modal = document.getElementById('modal-new-task');
      modal.classList.remove('hidden');
      const titleEl = modal.querySelector('h3');
      const standaloneModeWrap = document.getElementById('task-standalone-mode-wrap');
      const standaloneModeInput = document.getElementById('task-standalone-mode');
      const metadataWrap = document.getElementById('task-project-metadata-wrap');
      const taskThemeInput = document.getElementById('task-theme');
      const taskGroupInput = document.getElementById('task-group');
      if (standaloneModeWrap) {
        standaloneModeWrap.classList.toggle('hidden', !standaloneTaskMode);
      }
      if (metadataWrap) {
        metadataWrap.classList.toggle('hidden', standaloneTaskMode);
      }
      if (!standaloneTaskMode) {
        refreshTaskMetadataOptions(currentProjectState);
      }
      const currentAssignees = getTaskAssigneeEntries(task, standaloneTaskMode ? null : currentProjectState);
      refreshTaskAssigneeOptionsMulti(
        standaloneTaskMode ? null : currentProjectState,
        currentAssignees.map(a => a.userId).filter(Boolean)
      );
      if (titleEl) {
        titleEl.textContent = standaloneTaskMode ? 'Nouvelle tâche hors projet' : 'Nouvelle tâche';
      }

      if (task) {
        editingTaskId = task.taskId;
        editingStandaloneTaskId = standaloneTaskMode ? (task.id || editingStandaloneTaskId || null) : null;
        document.getElementById('task-title').value = task.title || '';
        document.getElementById('task-description').value = task.description || '';
        const manualAssignees = currentAssignees
          .filter(a => !a.userId && a.name)
          .map(a => a.name);
        document.getElementById('task-assignee-manual').value = manualAssignees.join('\n');
        document.getElementById('task-request-date').value = task.requestDate || (task.createdAt ? toYmd(new Date(task.createdAt)) : '');
        document.getElementById('task-due-date').value = task.dueDate || '';
        document.getElementById('task-status').value = task.status || 'todo';
        document.getElementById('task-urgency').value = task.urgency || 'medium';
        document.getElementById('task-subtasks').value = (task.subtasks || []).map(st => st.label).join('\n');
        document.getElementById('task-files').value = '';
        document.getElementById('task-share-docs').checked = true;
        document.getElementById('btn-save-task').textContent = 'Mettre à jour';
        if (standaloneModeInput) standaloneModeInput.value = normalizeSharingMode(task.sharingMode, 'private');
        if (taskThemeInput) taskThemeInput.value = task.theme || '';
        if (taskGroupInput) {
          if (task.groupId) {
            taskGroupInput.value = task.groupId;
          } else if (task.groupName) {
            const wanted = normalizeCatalogKey(task.groupName);
            const option = Array.from(taskGroupInput.options || [])
              .find(opt => String(opt.value || '').startsWith('global:') && normalizeCatalogKey(opt.dataset.groupName || '') === wanted);
            if (option) {
              taskGroupInput.value = option.value;
            } else {
              taskGroupInput.value = '';
            }
          } else {
            taskGroupInput.value = '';
          }
        }
      } else {
        editingTaskId = null;
        editingStandaloneTaskId = null;
        document.getElementById('task-title').value = '';
        document.getElementById('task-description').value = '';
        document.getElementById('task-assignee-manual').value = '';
        document.getElementById('task-request-date').value = toYmd(new Date());
        document.getElementById('task-due-date').value = '';
        document.getElementById('task-status').value = 'todo';
        document.getElementById('task-urgency').value = 'medium';
        document.getElementById('task-subtasks').value = '';
        document.getElementById('task-files').value = '';
        document.getElementById('task-share-docs').checked = true;
        document.getElementById('btn-save-task').textContent = 'Créer';
        if (standaloneModeInput) standaloneModeInput.value = 'private';
        if (taskThemeInput) taskThemeInput.value = (currentProjectState?.themes || [])[0] || '';
        if (taskGroupInput) taskGroupInput.value = '';
      }
    }

    async function renderProjectSequentialNav(currentId) {
      const navWrap = document.getElementById('project-sequential-nav');
      const prevBtn = document.getElementById('btn-project-prev');
      const nextBtn = document.getElementById('btn-project-next');
      const prevLabel = document.getElementById('project-prev-label');
      const nextLabel = document.getElementById('project-next-label');
      if (!navWrap || !prevBtn || !nextBtn || !prevLabel || !nextLabel) return;

      const projects = await getAllProjects();
      const list = (projects || []).filter(p => p && p.projectId);
      const idx = list.findIndex(p => p.projectId === currentId);
      if (idx < 0 || list.length <= 1) {
        navWrap.classList.add('hidden');
        return;
      }

      const prev = idx > 0 ? list[idx - 1] : null;
      const next = idx < list.length - 1 ? list[idx + 1] : null;

      prevLabel.textContent = prev ? `Précédent: ${prev.name || 'Projet'}` : 'Aucun projet précédent';
      nextLabel.textContent = next ? `Suivant: ${next.name || 'Projet'}` : 'Aucun projet suivant';
      prevBtn.disabled = !prev;
      nextBtn.disabled = !next;
      prevBtn.onclick = prev ? (() => showProjectDetail(prev.projectId)) : null;
      nextBtn.onclick = next ? (() => showProjectDetail(next.projectId)) : null;
      navWrap.classList.remove('hidden');
    }

    async function showProjectDetail(projectId) {
      workspaceMode = 'project';
      const previousProjectId = currentProjectId;
      currentProjectId = projectId;
      if (previousProjectId !== projectId) {
        projectDetailMode = 'work';
      }
      tasksPage = 1;
      const state = await getProjectState(projectId);
      closeMobileSidebar();

      if (!state || !state.project) {
        showToast('Acces refuse ou projet introuvable');
        showDashboard();
        return;
      }
      if (state.project.deletedAt) {
        showToast('❌ Ce projet a été supprimé');
        showDashboard();
        return;
      }
      await refreshKnownUsersCache();

      // Hide dashboard, show detail
      document.getElementById('global-hub')?.classList.add('hidden');
      document.getElementById('projects-list').classList.add('hidden');
      document.getElementById('dashboard-head')?.classList.add('hidden');
      document.getElementById('dashboard-title')?.classList.add('hidden');
      document.getElementById('dashboard-stats')?.classList.add('hidden');
      document.getElementById('dashboard-quick-actions')?.classList.add('hidden');
      document.getElementById('project-detail').classList.remove('hidden');

      // Update project info
      document.getElementById('project-title').textContent = state.project.name;
      document.getElementById('project-description-display').textContent = state.project.description || 'Aucune description';
      document.getElementById('project-date').textContent = new Date(state.project.createdAt).toLocaleDateString('fr-FR');
      document.getElementById('project-members-count').textContent = `${state.members.length} membre${state.members.length > 1 ? 's' : ''}`;
      const visibleTasks = (state.tasks || []).filter(t => !t.archivedAt);
      document.getElementById('project-kpi-tasks').textContent = String(visibleTasks.length);
      document.getElementById('project-kpi-done').textContent = String(visibleTasks.filter(t => t.status === 'termine').length);
      document.getElementById('project-kpi-messages').textContent = String((state.messages || []).length);
      bindProjectKpiActions();
      await renderProjectSequentialNav(projectId);
      await renderProjectMembers(state);
      await renderProjectUserGroups(state);
      renderProjectPermissionMatrix(state);
      renderProjectInvitations(state);
      renderProjectGroups(state);
      renderProjectThemes(state);
      await syncProjectTaxonomyToGlobal(state);
      refreshTaskMetadataOptions(state);
      await refreshTaskAssigneeOptionsMulti(state);
      const btnEditProject = document.getElementById('btn-edit-project');
      const btnDeleteProject = document.getElementById('btn-delete-project');
      if (btnEditProject) {
        const allowed = canEditProjectMeta(state);
        btnEditProject.disabled = !allowed;
        btnEditProject.classList.toggle('opacity-50', !allowed);
        btnEditProject.title = allowed ? '' : 'Reserve aux owners/managers';
      }
      if (btnDeleteProject) {
        const allowed = canDeleteProjectMeta(state);
        btnDeleteProject.disabled = !allowed;
        btnDeleteProject.classList.toggle('opacity-50', !allowed);
        btnDeleteProject.title = allowed ? '' : 'Reserve au owner';
      }

      currentProjectState = state;
      const canSendChat = canSendProjectMessage(state);
      const btnSendMessage = document.getElementById('btn-send-message');
      const messageInput = document.getElementById('message-input');
      const messageFiles = document.getElementById('message-files');
      if (btnSendMessage) {
        btnSendMessage.disabled = !canSendChat;
        btnSendMessage.classList.toggle('opacity-50', !canSendChat);
        btnSendMessage.title = canSendChat ? '' : 'Reserve aux membres du projet';
      }
      if (messageInput) {
        messageInput.disabled = !canSendChat;
        messageInput.placeholder = canSendChat ? 'Tapez votre message...' : 'Lecture seule (droits insuffisants)';
      }
      if (messageFiles) {
        messageFiles.disabled = !canSendChat;
      }
      renderTasks(visibleTasks);
      renderArchivedTasks(state.tasks || []);
      renderKanban(visibleTasks);
      renderTimeline(visibleTasks);
      renderCalendar(visibleTasks);
      renderDocuments(visibleTasks);
      renderMessages(state.messages);
      const events = await getProjectEvents(projectId);
      currentProjectEvents = events;
      await renderActivity(events);
      setProjectDetailMode(projectDetailMode);
      setProjectView(activeProjectView);
      applyLiveSearchFilter();
    }

    function resolveProjectIdInput(projectId, fallbackId = currentProjectId) {
      if (isValidIdbKey(projectId)) return projectId;
      if (projectId && typeof projectId === 'object' && 'preventDefault' in projectId) {
        return fallbackId;
      }
      return fallbackId;
    }

    async function openEditProjectModal(projectId = currentProjectId, fromDashboard = false) {
      projectId = resolveProjectIdInput(projectId, currentProjectId);
      if (!projectId) return;
      const state = await getProjectState(projectId);
      if (!state?.project || state.project.deletedAt) return;
      if (!canEditProjectMeta(state)) {
        showToast('Action non autorisee');
        return;
      }
      currentProjectId = projectId;
      currentProjectState = state;
      editProjectFromDashboard = fromDashboard === true;
      document.getElementById('edit-project-name').value = state.project.name || '';
      document.getElementById('edit-project-description').value = state.project.description || '';
      document.getElementById('edit-project-status').value = state.project.status || 'en-cours';
      await populateProjectGroupPresetOptions('edit-project-group-presets', (state.groups || []).map(g => g.name));
      document.getElementById('modal-edit-project').classList.remove('hidden');
      document.getElementById('edit-project-name').focus();
    }

    async function openEditProjectModalFromDashboard(projectId) {
      await openEditProjectModal(projectId, true);
    }

    async function saveProjectEdits() {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      if (!state?.project || !canEditProjectMeta(state)) {
        showToast('Action non autorisee');
        return;
      }
      const name = (document.getElementById('edit-project-name').value || '').trim();
      if (!name) {
        showToast('Le nom du projet est requis');
        return;
      }
      const changes = {
        name,
        description: (document.getElementById('edit-project-description').value || '').trim(),
        status: document.getElementById('edit-project-status').value || 'en-cours'
      };
      const selectedGlobalGroups = readSelectedGlobalGroups('edit-project-group-presets');
      const existingGroupKeys = new Set((state.groups || []).map(g => normalizeCatalogKey(g.name)));

      const event = createEvent(
        EventTypes.UPDATE_PROJECT,
        currentProjectId,
        currentUser.userId,
        { changes }
      );
      await publishEvent(event);
      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, event);
      }
      let addedGroupsCount = 0;
      for (const group of selectedGlobalGroups) {
        const groupKey = normalizeCatalogKey(group.name);
        if (!groupKey || existingGroupKeys.has(groupKey)) continue;
        existingGroupKeys.add(groupKey);
        const addGroupEvent = createEvent(
          EventTypes.CREATE_GROUP,
          currentProjectId,
          currentUser.userId,
          { groupId: uuidv4(), name: group.name, description: group.description || '' }
        );
        await publishEvent(addGroupEvent);
        if (sharedFolderHandle) {
          await writeEventToSharedFolder(currentProjectId, addGroupEvent);
        }
        addedGroupsCount += 1;
      }
      document.getElementById('modal-edit-project').classList.add('hidden');
      showToast('Projet mis à jour');
      if (addedGroupsCount > 0) {
        addNotification('Groupe', `${addedGroupsCount} groupe(s) global(aux) associe(s) au projet`, currentProjectId);
      }
      addNotification('Projet', 'Informations projet mises à jour', currentProjectId);
      if (editProjectFromDashboard || workspaceMode === 'dashboard') {
        editProjectFromDashboard = false;
        await refreshStats();
        await renderProjects();
        applyLiveSearchFilter();
        return;
      }
      await showProjectDetail(currentProjectId);
      await refreshStats();
      await renderProjects();
    }

    async function deleteCurrentProject(projectId = currentProjectId, fromDashboard = false) {
      projectId = resolveProjectIdInput(projectId, currentProjectId);
      if (!projectId) return;
      const state = await getProjectState(projectId);
      if (!state?.project || !canDeleteProjectMeta(state)) {
        showToast('Action non autorisee');
        return;
      }
      currentProjectId = projectId;
      currentProjectState = state;
      const pname = state?.project?.name || 'ce projet';
      if (!confirm(`Supprimer définitivement ${pname} ?`)) return;

      const event = createEvent(
        EventTypes.DELETE_PROJECT,
        currentProjectId,
        currentUser.userId,
        { reason: 'manual_delete' }
      );
      await publishEvent(event);
      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, event);
      }
      addNotification('Projet', 'Projet supprimé', projectId);
      showToast('Projet supprimé');
      if (fromDashboard || workspaceMode === 'dashboard') {
        currentProjectId = null;
        currentProjectState = null;
        await refreshStats();
        await renderProjects();
        applyLiveSearchFilter();
        return;
      }
      showDashboard();
      await refreshStats();
      await renderProjects();
    }

    async function deleteProjectFromDashboard(projectId) {
      await deleteCurrentProject(projectId, true);
    }

    async function sendProjectStatusEmail(doneOnly = false) {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      if (!state?.project) return;
      const tasks = state.tasks || [];
      const done = tasks.filter(t => t.status === 'termine').length;
      const inProgress = tasks.filter(t => t.status === 'en-cours').length;
      const todo = tasks.filter(t => (t.status || 'todo') === 'todo').length;
      const recipients = collectProjectRecipientEmails(state);
      const subject = doneOnly
        ? `[TaskMDA Team] Projet achevé: ${state.project.name}`
        : `[TaskMDA Team] Point statut projet: ${state.project.name}`;
      const body = doneOnly
        ? [
            `Bonjour,`,
            '',
            `Le projet "${state.project.name}" est déclaré achevé.`,
            '',
            `Synthèse finale:`,
            `- Tâches totales: ${tasks.length}`,
            `- Terminées: ${done}`,
            '',
            `Date de clôture: ${new Date().toLocaleDateString('fr-FR')}`,
            `Responsable: ${currentUser?.name || 'N/A'}`
          ].join('\n')
        : [
            `Bonjour,`,
            '',
            `Point de situation pour le projet "${state.project.name}":`,
            '',
            `- Tâches à faire: ${todo}`,
            `- Tâches en cours: ${inProgress}`,
            `- Tâches terminées: ${done}`,
            '',
            `Statut projet: ${state.project.status || 'en-cours'}`,
            `Date du point: ${new Date().toLocaleDateString('fr-FR')}`,
            '',
            `Cordialement,`,
            `${currentUser?.name || 'Equipe projet'}`
          ].join('\n');
      openMailto({ to: recipients, subject, body });
    }

    async function sendTaskStatusEmail(taskId, doneOnly = false) {
      if (!currentProjectId || !taskId) return;
      const state = await getProjectState(currentProjectId);
      if (!state?.project) return;
      const task = (state.tasks || []).find(t => t.taskId === taskId);
      if (!task) return;
      const recipients = collectProjectRecipientEmails(state);
      const groupName = getTaskGroupName(task, state) || 'Aucun groupe';
      const subject = doneOnly
        ? `[TaskMDA Team] Tâche achevée: ${task.title}`
        : `[TaskMDA Team] Statut tâche: ${task.title}`;
      const body = doneOnly
        ? [
            `Bonjour,`,
            '',
            `La tâche "${task.title}" est achevée.`,
            '',
            `Projet: ${state.project.name}`,
            `Thématique: ${task.theme || 'Non renseignée'}`,
            `Groupe: ${groupName}`,
            `Assigné à: ${getTaskAssigneeName(task, state) || 'Non assigné'}`,
            `Date de clôture: ${new Date().toLocaleDateString('fr-FR')}`,
            '',
            `Commentaire: ${task.description || 'N/A'}`
          ].join('\n')
        : [
            `Bonjour,`,
            '',
            `Point sur la tâche "${task.title}":`,
            '',
            `Projet: ${state.project.name}`,
            `Statut: ${task.status || 'todo'}`,
            `Urgence: ${task.urgency || 'medium'}`,
            `Thématique: ${task.theme || 'Non renseignée'}`,
            `Groupe: ${groupName}`,
            `Assigné à: ${getTaskAssigneeName(task, state) || 'Non assigné'}`,
            `Échéance: ${formatDate(task.dueDate)}`,
            '',
            `Description: ${task.description || 'N/A'}`
          ].join('\n');
      openMailto({ to: recipients, subject, body });
    }

    function showDashboard() {
      closeMobileSidebar();
      workspaceMode = 'dashboard';
      projectsPage = 1;
      document.getElementById('project-detail').classList.add('hidden');
      document.getElementById('global-hub')?.classList.add('hidden');
      document.getElementById('projects-list').classList.remove('hidden');
      document.getElementById('dashboard-head')?.classList.remove('hidden');
      document.getElementById('dashboard-title')?.classList.add('hidden');
      if (document.getElementById('dashboard-title')) {
        document.getElementById('dashboard-title').textContent = 'Tableau de bord';
      }
      document.getElementById('dashboard-stats')?.classList.remove('hidden');
      document.getElementById('dashboard-quick-actions')?.classList.remove('hidden');
      currentProjectId = null;
      currentProjectState = null;
      editingMessageId = null;
      editingMessageDraft = '';
      setActiveSidebarNav('dashboard');
      refreshStats();
      renderProjects();
      applyLiveSearchFilter();
    }

    async function showProjectsWorkspace() {
      closeMobileSidebar();
      workspaceMode = 'dashboard';
      projectsPage = 1;
      document.getElementById('project-detail').classList.add('hidden');
      document.getElementById('global-hub')?.classList.add('hidden');
      document.getElementById('projects-list').classList.remove('hidden');
      document.getElementById('dashboard-head')?.classList.remove('hidden');
      document.getElementById('dashboard-title')?.classList.remove('hidden');
      if (document.getElementById('dashboard-title')) {
        document.getElementById('dashboard-title').textContent = 'Mes projets';
      }
      document.getElementById('dashboard-stats')?.classList.add('hidden');
      document.getElementById('dashboard-quick-actions')?.classList.add('hidden');
      currentProjectId = null;
      currentProjectState = null;
      editingMessageId = null;
      editingMessageDraft = '';
      setActiveSidebarNav('projects');
      await renderProjects();
      applyLiveSearchFilter();
    }

    async function getAllProjectStates() {
      const states = await getAllDecrypted('localState', 'projectId');
      return (states || [])
        .filter(s => s && s.project && !s.project.deletedAt)
        .filter(s => hasProjectAccess(s));
    }

    async function getGlobalTasksList() {
      const states = await getAllProjectStates();
      const fromProjects = [];
      states.forEach(state => {
        (state.tasks || []).forEach(task => {
          fromProjects.push({
            ...task,
            sourceType: 'project',
            sourceProjectId: state.project.projectId,
            sourceProjectName: state.project.name,
            theme: task.theme || state.project.name,
            sharingMode: state.project.sharingMode || 'shared'
          });
        });
      });

      const standalone = await getAllDecrypted('globalTasks', 'id');
      const fromStandalone = (standalone || []).map(item => ({
        ...item,
        sourceType: 'standalone',
        sourceProjectId: null,
        sourceProjectName: 'Hors projet',
        theme: item.theme || 'Général',
        sharingMode: item.sharingMode || 'private'
      }));

      return [...fromProjects, ...fromStandalone].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    async function getGlobalDocumentsList() {
      const states = await getAllProjectStates();
      const docs = [];
      states.forEach(state => {
        (state.tasks || []).forEach(task => {
          (task.attachments || []).forEach((file, attachmentIndex) => {
            if (file.shareToDocs !== false) {
              docs.push({
                id: `${state.project.projectId}:${task.taskId}:${attachmentIndex}`,
                name: file.name,
                type: file.type,
                size: file.size,
                data: file.data,
                theme: task.theme || state.project.name || 'Projet',
                sourceProjectName: state.project.name,
                sourceType: 'project',
                sharingMode: state.project.sharingMode || 'shared',
                createdAt: task.updatedAt || task.createdAt || state.project.createdAt || 0
              });
            }
          });
        });
      });

      const standaloneDocs = await getAllDecrypted('globalDocs', 'id');
      (standaloneDocs || []).forEach(doc => {
        docs.push({
          ...doc,
          sourceProjectName: 'Hors projet',
          sharingMode: doc.sharingMode || 'private',
          sourceType: 'standalone'
        });
      });

      return docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    async function renderGlobalTasks() {
      const container = document.getElementById('global-tasks-container');
      const paginationContainer = document.getElementById('global-tasks-pagination');
      if (!container) return;
      if (paginationContainer) paginationContainer.innerHTML = '';
      updateGlobalTasksViewButtons();
      const all = await getGlobalTasksList();
      const allProjectStates = await getAllProjectStates();
      const stateByProjectId = new Map(allProjectStates.map(s => [s.project?.projectId, s]));

      const query = `${globalSearchQuery} ${document.getElementById('global-task-search')?.value || ''}`.trim();
      const status = document.getElementById('global-task-status')?.value || 'all';
      const theme = document.getElementById('global-task-theme')?.value || '';

      let filtered = all.filter(task => matchesQuery([
        task.title,
        task.description,
        task.sourceProjectName,
        task.theme,
        getTaskAssigneeName(task, stateByProjectId.get(task.sourceProjectId)),
        sharingModeLabel(task.sharingMode)
      ], query));
      if (status !== 'all') filtered = filtered.filter(task => (task.status || 'todo') === status);
      if (theme.trim()) filtered = filtered.filter(task => matchesQuery([task.theme], theme));
      filtered = filtered.filter(task => !task.archivedAt);

      if (filtered.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8">Aucune tâche trouvée</p>';
        return;
      }

      const mode = ['cards', 'list', 'kanban', 'timeline'].includes(globalTasksViewMode) ? globalTasksViewMode : 'cards';
      if (paginationContainer) paginationContainer.classList.toggle('hidden', mode === 'kanban' || mode === 'timeline');
      if (mode !== 'cards') {
        const prepared = filtered.map(task => {
          const taskRef = buildGlobalTaskRef(task);
          let canEdit = task.sourceType === 'standalone';
          let canDelete = task.sourceType === 'standalone';
          let canArchive = task.sourceType === 'standalone';
          if (task.sourceType === 'project') {
            const projectState = stateByProjectId.get(task.sourceProjectId);
            canEdit = canEditTaskInProject(task, projectState);
            canDelete = canDeleteTaskInProject(task, projectState);
            canArchive = canEditTaskInProject(task, projectState);
          }
          const dueTs = task.dueDate ? new Date(task.dueDate).getTime() : Number.POSITIVE_INFINITY;
          return {
            ...task,
            _taskRef: taskRef,
            _canEdit: canEdit,
            _canDelete: canDelete,
            _canArchive: canArchive,
            _statusKey: task.status || 'todo',
            _assigneeName: getTaskAssigneeName(task, stateByProjectId.get(task.sourceProjectId)) || 'Non assigne',
            _dueTs: Number.isFinite(dueTs) ? dueTs : Number.POSITIVE_INFINITY
          };
        });
        const taskActions = (task) => `
          ${task._canEdit ? `<button onclick="editGlobalTask('${task._taskRef}')" class="px-2 py-1 rounded bg-slate-100 text-slate-700">Modifier</button>` : ''}
          ${task._canArchive ? `<button onclick="archiveGlobalTask('${task._taskRef}')" class="px-2 py-1 rounded bg-amber-100 text-amber-700">Archiver</button>` : ''}
          ${task._canDelete ? `<button onclick="deleteGlobalTask('${task._taskRef}')" class="px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>` : ''}
        `;
        const taskCard = (task) => `
          <div class="global-task-card rounded-xl border border-slate-200 bg-white p-4 cursor-grab active:cursor-grabbing" draggable="true" ondragstart="startGlobalKanbanDrag(event, '${task._taskRef}')">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h4 class="font-bold text-slate-800">${escapeHtml(task.title || 'Tache')}</h4>
                <p class="text-xs text-slate-500 mt-1">${escapeHtml(task.sourceProjectName || 'Hors projet')} - ${escapeHtml(task.theme || 'General')}</p>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-1">
                ${sharingModeBadge(task.sharingMode)}
                <span class="text-[10px] px-2 py-1 rounded-full font-semibold ${
                  task._statusKey === 'termine' ? 'bg-emerald-100 text-emerald-700' : task._statusKey === 'en-cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                }">${escapeHtml(task._statusKey)}</span>
              </div>
            </div>
            <p class="text-sm text-slate-600 mt-2">${escapeHtml(task.description || '')}</p>
            ${buildSubtaskProgressHtml(task, true)}
            <div class="mt-2 text-xs text-slate-500 flex flex-wrap gap-3">
              <span>Demande: ${formatDate(task.requestDate)}</span>
              <span>Echeance: ${formatDate(task.dueDate)}</span>
              <span>Assigne: ${escapeHtml(task._assigneeName)}</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2 text-xs">${taskActions(task)}</div>
          </div>
        `;
        if (mode === 'list') {
          const pagination = paginateItems(prepared, globalTasksPage, paginationConfig.globalTasksPerPage);
          globalTasksPage = pagination.currentPage;
          container.className = 'space-y-3';
          container.innerHTML = `
            <div class="rounded-xl border border-slate-200 bg-white overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="text-left text-slate-500 border-b border-slate-200">
                    <th class="px-3 py-2 font-semibold">Tache</th>
                    <th class="px-3 py-2 font-semibold">Projet</th>
                    <th class="px-3 py-2 font-semibold">Statut</th>
                    <th class="px-3 py-2 font-semibold">Echeance</th>
                    <th class="px-3 py-2 font-semibold">Assigne</th>
                    <th class="px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${pagination.pageItems.map(task => `
                    <tr class="border-b border-slate-100 align-top">
                      <td class="px-3 py-2">
                        <p class="font-semibold text-slate-800">${escapeHtml(task.title || 'Tache')}</p>
                        <p class="text-xs text-slate-500">${escapeHtml(task.theme || 'General')}</p>
                        ${buildSubtaskProgressHtml(task, true)}
                      </td>
                      <td class="px-3 py-2 text-slate-600">${escapeHtml(task.sourceProjectName || 'Hors projet')}</td>
                      <td class="px-3 py-2 text-slate-600">${escapeHtml(task._statusKey)}</td>
                      <td class="px-3 py-2 text-slate-600">${formatDate(task.dueDate)}</td>
                      <td class="px-3 py-2 text-slate-600">${escapeHtml(task._assigneeName)}</td>
                      <td class="px-3 py-2"><div class="flex flex-wrap gap-1 text-xs">${taskActions(task)}</div></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
          renderPagination('global-tasks-pagination', pagination, 'setGlobalTasksPage', 'taches');
          return;
        }
        if (mode === 'kanban') {
          container.className = 'grid grid-cols-1 lg:grid-cols-3 gap-4';
          const cols = [{ key: 'todo', label: 'A faire' }, { key: 'en-cours', label: 'En cours' }, { key: 'termine', label: 'Termine' }];
          container.innerHTML = cols.map(col => {
            const items = prepared.filter(task => task._statusKey === col.key);
            return `
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-3" ondragover="allowKanbanDrop(event)" ondrop="dropGlobalKanbanTask(event, '${col.key}')">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-bold text-slate-700">${col.label}</h4>
                  <span class="text-xs text-slate-500">${items.length}</span>
                </div>
                <div class="space-y-2">
                  ${items.length > 0 ? items.map(taskCard).join('') : '<p class="text-xs text-slate-400 py-2">Aucune tache</p>'}
                </div>
              </div>
            `;
          }).join('');
          return;
        }
        container.className = 'space-y-4';
        const withDate = prepared.filter(task => Number.isFinite(task._dueTs)).sort((a, b) => a._dueTs - b._dueTs);
        const withoutDate = prepared.filter(task => !Number.isFinite(task._dueTs));
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const todayEnd = todayStart + (24 * 60 * 60 * 1000) - 1;
        const overdue = withDate.filter(task => task._dueTs < todayStart);
        const today = withDate.filter(task => task._dueTs >= todayStart && task._dueTs <= todayEnd);
        const upcoming = withDate.filter(task => task._dueTs > todayEnd);
        const group = (title, items) => `
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-bold text-slate-800">${title}</h4>
              <span class="text-xs text-slate-500">${items.length}</span>
            </div>
            <div class="space-y-2">
              ${items.length > 0 ? items.map(taskCard).join('') : '<p class="text-xs text-slate-400">Aucune tache</p>'}
            </div>
          </div>
        `;
        container.innerHTML = [group('En retard', overdue), group('Aujourd hui', today), group('A venir', upcoming), group('Sans echeance', withoutDate)].join('');
        return;
      }

      const pagination = paginateItems(filtered, globalTasksPage, paginationConfig.globalTasksPerPage);
      globalTasksPage = pagination.currentPage;
      container.className = 'space-y-3';
      container.innerHTML = pagination.pageItems.map(task => {
        const taskRef = buildGlobalTaskRef(task);
        let canEdit = task.sourceType === 'standalone';
        let canDelete = task.sourceType === 'standalone';
        let canArchive = task.sourceType === 'standalone';
        if (task.sourceType === 'project') {
          const projectState = stateByProjectId.get(task.sourceProjectId);
          canEdit = canEditTaskInProject(task, projectState);
          canDelete = canDeleteTaskInProject(task, projectState);
          canArchive = canEditTaskInProject(task, projectState);
        }
        return `
        <div class="global-task-card rounded-xl border border-slate-200 bg-white p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h4 class="font-bold text-slate-800">${escapeHtml(task.title || 'Tâche')}</h4>
              <p class="text-xs text-slate-500 mt-1">${escapeHtml(task.sourceProjectName || 'Hors projet')} • ${escapeHtml(task.theme || 'Général')}</p>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-1">
              ${sharingModeBadge(task.sharingMode)}
              <span class="text-[10px] px-2 py-1 rounded-full font-semibold ${
                (task.status || 'todo') === 'termine' ? 'bg-emerald-100 text-emerald-700' : (task.status || 'todo') === 'en-cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
              }">${escapeHtml(task.status || 'todo')}</span>
            </div>
          </div>
          <p class="text-sm text-slate-600 mt-2">${escapeHtml(task.description || '')}</p>
          ${buildSubtaskProgressHtml(task, true)}
          <div class="mt-2 text-xs text-slate-500 flex flex-wrap gap-3">
            <span>Demande: ${formatDate(task.requestDate)}</span>
            <span>Échéance: ${formatDate(task.dueDate)}</span>
            <span>Assigné: ${escapeHtml(getTaskAssigneeName(task, stateByProjectId.get(task.sourceProjectId)) || 'Non assigné')}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            ${canEdit ? `<button onclick="editGlobalTask('${taskRef}')" class="px-2 py-1 rounded bg-slate-100 text-slate-700">Modifier</button>` : ''}
            ${canArchive ? `<button onclick="archiveGlobalTask('${taskRef}')" class="px-2 py-1 rounded bg-amber-100 text-amber-700">Archiver</button>` : ''}
            ${canDelete ? `<button onclick="deleteGlobalTask('${taskRef}')" class="px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>` : ''}
          </div>
        </div>
      `;
      }).join('');
      renderPagination('global-tasks-pagination', pagination, 'setGlobalTasksPage', 'taches');
    }

    async function renderGlobalCalendar() {
      const container = document.getElementById('global-calendar-container');
      const monthInput = document.getElementById('global-calendar-month');
      const listWrap = document.getElementById('global-calendar-list-wrap');
      const gridWrap = document.getElementById('global-calendar-grid-wrap');
      const grid = document.getElementById('global-calendar-grid');
      const dayDetails = document.getElementById('global-calendar-day-details');
      const btnViewList = document.getElementById('global-calendar-view-list');
      const btnViewGrid = document.getElementById('global-calendar-view-grid');
      if (!container || !monthInput || !listWrap || !gridWrap || !grid || !dayDetails) return;

      if (monthInput.options.length === 0) {
        const base = new Date();
        const options = [];
        for (let offset = -12; offset <= 12; offset++) {
          const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
          const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
          options.push(`<option value="${value}">${label}</option>`);
        }
        monthInput.innerHTML = options.join('');
        monthInput.value = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
      }

      const all = await getGlobalTasksList();
      const q = `${globalSearchQuery} ${document.getElementById('global-calendar-search')?.value || ''}`.trim();
      let month = monthInput.value || toYmd(new Date()).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(String(month))) {
        const now = new Date();
        month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        monthInput.value = month;
      }

      const standaloneItems = await getAllDecrypted('globalCalendarItems', 'id');
      const taskEntries = all
        .filter(task => task.dueDate && !task.archivedAt)
        .map(task => ({
          entryType: 'task',
          date: taskDueDateKey(task),
          title: task.title || 'Tache',
          description: task.description || '',
          theme: task.theme || 'General',
          source: task.sourceProjectName || 'Hors projet',
          sharingMode: task.sharingMode || (task.sourceType === 'standalone' ? 'private' : 'shared'),
          sortDate: new Date(task.dueDate).getTime()
        }));
      const infoEntries = (standaloneItems || []).map(item => ({
        entryType: 'info',
        id: item.id,
        date: item.date,
        title: item.title || 'Information',
        description: item.notes || '',
        theme: item.theme || 'General',
        source: 'Hors projet',
        sharingMode: item.sharingMode || 'private',
        archivedAt: item.archivedAt || null,
        sortDate: item.date ? new Date(item.date).getTime() : 0
      }));
      const mixed = [...taskEntries, ...infoEntries]
        .filter(entry => !entry.archivedAt)
        .filter(entry => String(entry.date || '').startsWith(month))
        .filter(entry => matchesQuery([entry.title, entry.description, entry.theme, entry.source, sharingModeLabel(entry.sharingMode)], q))
        .sort((a, b) => a.sortDate - b.sortDate);
      const isSharedEntry = (entry) => normalizeSharingMode(entry?.sharingMode, 'private') === 'shared';

      const isGrid = globalCalendarViewMode === 'grid';
      listWrap.classList.toggle('hidden', isGrid);
      gridWrap.classList.toggle('hidden', !isGrid);
      if (btnViewList && btnViewGrid) {
        btnViewList.classList.toggle('view-tab-active', !isGrid);
        btnViewGrid.classList.toggle('view-tab-active', isGrid);
      }

      if (!isGrid && mixed.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8">Aucune echeance pour ces criteres</p>';
        return;
      }

      if (isGrid) {
        const [yearStr, monthStr] = month.split('-');
        let year = Number(yearStr);
        let monthIndex = Number(monthStr) - 1;
        if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
          const fallback = new Date();
          year = fallback.getFullYear();
          monthIndex = fallback.getMonth();
          month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
          monthInput.value = month;
        }
        const firstDay = new Date(year, monthIndex, 1);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) {
          grid.innerHTML = '<div class="col-span-7 text-center text-sm text-slate-500 py-4">Mois invalide, reinitialisation appliquee.</div>';
          dayDetails.innerHTML = '';
          return;
        }
        const todayKey = toYmd(new Date());
        const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

        const entriesByDay = new Map();
        mixed.forEach(entry => {
          const key = String(entry.date || '');
          if (!entriesByDay.has(key)) entriesByDay.set(key, []);
          entriesByDay.get(key).push(entry);
        });

        if (!globalCalendarSelectedDay || !String(globalCalendarSelectedDay).startsWith(monthPrefix)) {
          globalCalendarSelectedDay = todayKey.startsWith(monthPrefix)
            ? todayKey
            : `${monthPrefix}-01`;
        }

        const dayHeaders = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
          .map(label => `<div class="text-center text-[11px] font-semibold text-slate-500 py-1">${label}</div>`)
          .join('');
        const blanks = Array.from({ length: startOffset }).map(() => '<div></div>').join('');
        const dayCells = Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const dayKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;
          const dayEntries = entriesByDay.get(dayKey) || [];
          const sharedCount = dayEntries.filter(isSharedEntry).length;
          const privateCount = Math.max(0, dayEntries.length - sharedCount);
          const isToday = dayKey === todayKey;
          const isSelected = dayKey === globalCalendarSelectedDay;
          return `
            <button class="global-cal-day min-h-[72px] rounded-lg border p-1 text-left ${isSelected ? 'border-primary bg-blue-50' : 'border-slate-200 bg-white'} ${isToday ? 'ring-1 ring-amber-300' : ''}" data-day="${dayKey}">
              <div class="text-[11px] font-semibold ${isToday ? 'text-amber-700' : 'text-slate-700'}">${day}</div>
              <div class="mt-1 space-y-1">
                ${(dayEntries || []).slice(0, 2).map(item => `<div class="text-[10px] truncate ${isSharedEntry(item) ? 'text-emerald-700' : 'text-slate-700'}">${escapeHtml(item.title || '')}</div>`).join('')}
                ${dayEntries.length > 2 ? `<div class="text-[10px] text-slate-500">+${dayEntries.length - 2}</div>` : ''}
              </div>
              ${(sharedCount + privateCount) > 0 ? `
                <div class="mt-1 flex items-center gap-1 text-[9px]">
                  ${sharedCount > 0 ? `<span class="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Collab ${sharedCount}</span>` : ''}
                  ${privateCount > 0 ? `<span class="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">Solo ${privateCount}</span>` : ''}
                </div>
              ` : ''}
            </button>
          `;
        }).join('');
        grid.innerHTML = `${dayHeaders}${blanks}${dayCells}`;
        grid.querySelectorAll('.global-cal-day').forEach(btn => {
          btn.addEventListener('click', () => {
            globalCalendarSelectedDay = btn.getAttribute('data-day');
            renderGlobalCalendar();
          });
        });

        const selectedEntries = entriesByDay.get(globalCalendarSelectedDay) || [];
        if (selectedEntries.length === 0) {
          dayDetails.innerHTML = `
            <div class="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">
              Aucun element le ${formatDate(globalCalendarSelectedDay)}.
            </div>
          `;
          return;
        }
        dayDetails.innerHTML = selectedEntries.map(entry => `
          <div class="rounded-lg border ${isSharedEntry(entry) ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/70'} p-3">
            <div class="flex items-center justify-between gap-2">
              <p class="font-semibold text-slate-800">${escapeHtml(entry.title || 'Element')}</p>
              <span class="inline-flex text-[10px] px-2 py-1 rounded-full font-semibold ${isSharedEntry(entry) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}">${isSharedEntry(entry) ? 'Collaboratif' : 'Solo'}</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">${escapeHtml(entry.source || 'Hors projet')} - ${escapeHtml(entry.theme || 'General')}</p>
            <p class="text-sm text-slate-600 mt-1">${escapeHtml(entry.description || '')}</p>
            ${entry.entryType === 'info' && entry.id ? `
              <div class="mt-2 flex flex-wrap gap-2 text-xs">
                <button onclick="editStandaloneCalendarItem('${entry.id}')" class="px-2 py-1 rounded bg-slate-100 text-slate-700">Modifier</button>
                <button onclick="archiveStandaloneCalendarItem('${entry.id}')" class="px-2 py-1 rounded bg-amber-100 text-amber-700">Archiver</button>
                <button onclick="deleteStandaloneCalendarItem('${entry.id}')" class="px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>
              </div>
            ` : ''}
          </div>
        `).join('');
        return;
      }

      container.innerHTML = mixed.map(entry => `
        <div class="rounded-xl border ${isSharedEntry(entry) ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'} p-4">
          <div class="flex items-center justify-between gap-2">
            <h4 class="font-semibold text-slate-800">${escapeHtml(entry.title || 'Element')}</h4>
            <span class="text-xs text-slate-500">${formatDate(entry.date)}</span>
          </div>
          <p class="text-xs text-slate-500 mt-1">${escapeHtml(entry.source || 'Hors projet')} • ${escapeHtml(entry.theme || 'General')}</p>
          <p class="text-sm text-slate-600 mt-1">${escapeHtml(entry.description || '')}</p>
          <div class="mt-2 flex flex-wrap gap-1">
            <span class="inline-flex text-[10px] px-2 py-1 rounded-full ${entry.entryType === 'task' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'} font-semibold">
              ${entry.entryType === 'task' ? 'Echeance tache' : 'Info hors projet'}
            </span>
            <span class="inline-flex text-[10px] px-2 py-1 rounded-full font-semibold ${isSharedEntry(entry) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}">${isSharedEntry(entry) ? 'Collaboratif' : 'Solo'}</span>
          </div>
          ${entry.entryType === 'info' && entry.id ? `
            <div class="mt-2 flex flex-wrap gap-2 text-xs">
              <button onclick="editStandaloneCalendarItem('${entry.id}')" class="px-2 py-1 rounded bg-slate-100 text-slate-700">Modifier</button>
              <button onclick="archiveStandaloneCalendarItem('${entry.id}')" class="px-2 py-1 rounded bg-amber-100 text-amber-700">Archiver</button>
              <button onclick="deleteStandaloneCalendarItem('${entry.id}')" class="px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>
            </div>
          ` : ''}
        </div>
      `).join('');
      return;

    }

    async function editGlobalTask(taskRef) {
      const resolved = await resolveGlobalTaskFromRef(taskRef);
      if (!resolved?.task) return;
      if (resolved.sourceType === 'standalone') {
        standaloneTaskMode = true;
        openTaskModal({ ...resolved.task, taskId: null });
        editingStandaloneTaskId = resolved.task.id;
        return;
      }
      if (!canEditTaskInProject(resolved.task, resolved.state)) {
        showToast('Action non autorisee');
        return;
      }
      await showProjectDetail(resolved.projectId);
      await editTask(resolved.task.taskId);
    }

    async function archiveGlobalTask(taskRef) {
      const resolved = await resolveGlobalTaskFromRef(taskRef);
      if (!resolved?.task) return;
      if (resolved.sourceType === 'standalone') {
        await putEncrypted('globalTasks', {
          ...resolved.task,
          status: 'termine',
          archivedAt: Date.now(),
          updatedAt: Date.now()
        }, 'id');
        showToast('Tache archivee');
        await renderGlobalTasks();
        await refreshStats();
        return;
      }
      if (!canEditTaskInProject(resolved.task, resolved.state)) {
        showToast('Action non autorisee');
        return;
      }
      const event = createEvent(
        EventTypes.UPDATE_TASK,
        resolved.projectId,
        currentUser.userId,
        { taskId: resolved.task.taskId, changes: { status: 'termine', archivedAt: Date.now() } }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(resolved.projectId, event);
      showToast('Tache archivee');
      if (workspaceMode === 'global') {
        await renderGlobalTasks();
        await refreshStats();
      } else {
        await showProjectDetail(resolved.projectId);
      }
    }

    async function deleteGlobalTask(taskRef) {
      const resolved = await resolveGlobalTaskFromRef(taskRef);
      if (!resolved?.task) return;
      if (resolved.sourceType === 'standalone') {
        if (!confirm('Supprimer cette tache hors projet ?')) return;
        const db = getDatabase();
        await db.delete('globalTasks', resolved.task.id);
        showToast('Tache supprimee');
        await renderGlobalTasks();
        await refreshStats();
        return;
      }
      if (!canDeleteTaskInProject(resolved.task, resolved.state)) {
        showToast('Action non autorisee');
        return;
      }
      if (!confirm('Supprimer cette tache ?')) return;
      const event = createEvent(
        EventTypes.DELETE_TASK,
        resolved.projectId,
        currentUser.userId,
        { taskId: resolved.task.taskId }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(resolved.projectId, event);
      showToast('Tache supprimee');
      if (workspaceMode === 'global') {
        await renderGlobalTasks();
        await refreshStats();
      } else {
        await showProjectDetail(resolved.projectId);
      }
    }

    window.editGlobalTask = editGlobalTask;
    window.archiveGlobalTask = archiveGlobalTask;
    window.deleteGlobalTask = deleteGlobalTask;
    window.editStandaloneCalendarItem = editStandaloneCalendarItem;
    window.archiveStandaloneCalendarItem = archiveStandaloneCalendarItem;
    window.deleteStandaloneCalendarItem = deleteStandaloneCalendarItem;

    function setGlobalCalendarItemFormEditing(isEditing) {
      const form = document.getElementById('global-calendar-item-form');
      if (!form) return;
      form.classList.toggle('is-editing', !!isEditing);
    }

    function resetStandaloneCalendarForm() {
      const titleInput = document.getElementById('global-calendar-item-title');
      const dateInput = document.getElementById('global-calendar-item-date');
      const themeInput = document.getElementById('global-calendar-item-theme');
      const notesInput = document.getElementById('global-calendar-item-notes');
      const modeInput = document.getElementById('global-calendar-item-mode');
      const submitBtn = document.getElementById('btn-global-calendar-add');
      if (titleInput) titleInput.value = '';
      if (dateInput) dateInput.value = '';
      if (themeInput) themeInput.value = '';
      if (notesInput) notesInput.value = '';
      if (modeInput) modeInput.value = 'private';
      editingGlobalCalendarItemId = null;
      if (submitBtn) submitBtn.textContent = 'Ajouter info hors projet';
      setGlobalCalendarItemFormEditing(false);
    }

    async function editStandaloneCalendarItem(itemId) {
      const id = String(itemId || '').trim();
      if (!id) return;
      const item = await getDecrypted('globalCalendarItems', id, 'id');
      if (!item) {
        showToast('Information introuvable');
        return;
      }
      document.getElementById('global-calendar-item-title').value = item.title || '';
      document.getElementById('global-calendar-item-date').value = item.date || '';
      document.getElementById('global-calendar-item-theme').value = item.theme || '';
      document.getElementById('global-calendar-item-notes').value = item.notes || '';
      document.getElementById('global-calendar-item-mode').value = normalizeSharingMode(item.sharingMode, 'private');
      editingGlobalCalendarItemId = id;
      const submitBtn = document.getElementById('btn-global-calendar-add');
      if (submitBtn) submitBtn.textContent = 'Enregistrer info';
      setGlobalCalendarItemFormEditing(true);
      document.getElementById('global-calendar-item-title')?.focus();
    }

    async function archiveStandaloneCalendarItem(itemId) {
      const id = String(itemId || '').trim();
      if (!id) return;
      const item = await getDecrypted('globalCalendarItems', id, 'id');
      if (!item) return;
      await putEncrypted('globalCalendarItems', {
        ...item,
        archivedAt: Date.now(),
        updatedAt: Date.now()
      }, 'id');
      if (editingGlobalCalendarItemId === id) {
        resetStandaloneCalendarForm();
      }
      showToast('Information archivee');
      addNotification('Calendrier', 'Information hors projet archivee', null);
      await renderGlobalCalendar();
    }

    async function deleteStandaloneCalendarItem(itemId) {
      const id = String(itemId || '').trim();
      if (!id) return;
      if (!confirm('Supprimer cette information hors projet ?')) return;
      const db = getDatabase();
      await db.delete('globalCalendarItems', id);
      if (editingGlobalCalendarItemId === id) {
        resetStandaloneCalendarForm();
      }
      showToast('Information supprimee');
      addNotification('Calendrier', 'Information hors projet supprimee', null);
      await renderGlobalCalendar();
    }

    async function addStandaloneCalendarItem() {
      const title = (document.getElementById('global-calendar-item-title')?.value || '').trim();
      const date = document.getElementById('global-calendar-item-date')?.value || '';
      const theme = (document.getElementById('global-calendar-item-theme')?.value || '').trim() || 'General';
      const notes = (document.getElementById('global-calendar-item-notes')?.value || '').trim();
      const sharingMode = document.getElementById('global-calendar-item-mode')?.value || 'private';
      if (!title || !date) {
        showToast('Sujet et date sont requis');
        return;
      }
      const editId = String(editingGlobalCalendarItemId || '').trim();
      const existing = editId ? await getDecrypted('globalCalendarItems', editId, 'id') : null;
      await putEncrypted('globalCalendarItems', {
        id: existing?.id || uuidv4(),
        title,
        date,
        theme,
        notes,
        sharingMode: normalizeSharingMode(sharingMode, 'private'),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
        archivedAt: null
      }, 'id');

      resetStandaloneCalendarForm();
      showToast(existing ? 'Information calendrier mise a jour' : 'Information calendrier ajoutee');
      addNotification('Calendrier', existing ? 'Information hors projet mise a jour' : 'Information hors projet ajoutee', null);
      await renderGlobalCalendar();
    }

    async function renderGlobalDocs() {
      const container = document.getElementById('global-docs-container');
      if (!container) return;
      const all = await getGlobalDocumentsList();

      const q = `${globalSearchQuery} ${document.getElementById('global-doc-search')?.value || ''}`.trim();
      const themeFilter = document.getElementById('global-doc-theme')?.value || '';
      const filtered = all.filter(doc => matchesQuery([doc.name, doc.sourceProjectName, doc.theme, doc.type, sharingModeLabel(doc.sharingMode)], q))
        .filter(doc => !themeFilter.trim() || matchesQuery([doc.theme], themeFilter));

      if (filtered.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-8 col-span-full">Aucun document trouvé</p>';
        return;
      }

      container.innerHTML = filtered.map(doc => `
        <div class="doc-card bg-surface-container-low rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="material-symbols-outlined text-primary">description</span>
            <div class="flex items-center gap-1">
              ${sharingModeBadge(doc.sharingMode)}
              <span class="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-white">${escapeHtml(getDocumentCategory(doc))}</span>
            </div>
          </div>
          <h4 class="font-semibold text-sm truncate">${escapeHtml(doc.name || 'document')}</h4>
          <p class="text-xs text-slate-500 mt-1">${escapeHtml(doc.sourceProjectName || 'Hors projet')} • ${escapeHtml(doc.theme || 'Général')}</p>
          <div class="mt-3 flex items-center justify-between text-xs">
            <span class="text-slate-500">${formatFileSize(doc.size || 0)}</span>
            <a class="text-primary font-semibold hover:underline" href="${doc.data || '#'}" download="${escapeHtml(doc.name || 'document')}">Télécharger</a>
          </div>
        </div>
      `).join('');
    }

    async function addStandaloneDocuments() {
      const filesInput = document.getElementById('global-doc-files');
      const themeInput = document.getElementById('global-doc-theme');
      const modeInput = document.getElementById('global-doc-mode');
      const files = Array.from(filesInput?.files || []);
      const theme = themeInput?.value?.trim() || 'General';
      const sharingMode = modeInput?.value || 'private';
      if (files.length === 0) {
        showToast('Sélectionnez au moins un document');
        return;
      }

      const maxFileSize = 8 * 1024 * 1024;
      for (const file of files) {
        if (file.size > maxFileSize) {
          showToast(`Le fichier ${file.name} dépasse 8 Mo`);
          return;
        }
      }

      for (const file of files) {
        const data = await fileToDataUrl(file);
        await putEncrypted('globalDocs', {
          id: uuidv4(),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data,
          theme,
          sharingMode: normalizeSharingMode(sharingMode, 'private'),
          createdAt: Date.now()
        }, 'id');
      }

      if (filesInput) filesInput.value = '';
      if (modeInput) modeInput.value = 'private';
      showToast('Documents hors projet ajoutés');
      addNotification('Documents', `${files.length} document(s) hors projet ajouté(s)`, null);
      await renderGlobalDocs();
    }

    function setGlobalHubView(view) {
      globalWorkspaceView = view;
      const mapping = {
        tasks: ['Vue Tâches (Tous projets)', 'Pilotage transversal des tâches, y compris hors projet.'],
        calendar: ['Vue Calendrier (Tous projets)', 'Échéances consolidées avec recherche thématique/sujet.'],
        docs: ['Vue Documents (Tous projets)', 'Référentiel documentaire projet + thématique hors projet.'],
        settings: ['Référentiels globaux', 'Gestion transverse des groupes et thématiques réutilisables.']
      };
      const [title, subtitle] = mapping[view] || mapping.tasks;
      document.getElementById('global-hub-title').textContent = title;
      document.getElementById('global-hub-subtitle').textContent = subtitle;
      document.getElementById('global-tasks-section')?.classList.toggle('hidden', view !== 'tasks');
      document.getElementById('global-calendar-section')?.classList.toggle('hidden', view !== 'calendar');
      document.getElementById('global-docs-section')?.classList.toggle('hidden', view !== 'docs');
      document.getElementById('global-settings-section')?.classList.toggle('hidden', view !== 'settings');
    }

    async function showGlobalWorkspace(view) {
      workspaceMode = 'global';
      globalTasksPage = 1;
      currentProjectId = null;
      currentProjectState = null;
      document.getElementById('project-detail').classList.add('hidden');
      document.getElementById('projects-list').classList.add('hidden');
      document.getElementById('global-hub').classList.remove('hidden');
      document.getElementById('dashboard-head')?.classList.add('hidden');
      document.getElementById('dashboard-title')?.classList.remove('hidden');
      if (document.getElementById('dashboard-title')) {
        document.getElementById('dashboard-title').textContent = 'Vue transverse';
      }
      document.getElementById('dashboard-stats')?.classList.add('hidden');
      document.getElementById('dashboard-quick-actions')?.classList.add('hidden');
      setGlobalHubView(view);
      setActiveSidebarNav(view === 'tasks'
        ? 'tasks'
        : view === 'calendar'
          ? 'calendar'
          : view === 'docs'
            ? 'docs'
            : 'settings');

      if (view === 'tasks') await renderGlobalTasks();
      if (view === 'calendar') await renderGlobalCalendar();
      if (view === 'docs') await renderGlobalDocs();
      if (view === 'settings') await renderGlobalSettings();
      closeMobileSidebar();
    }

    function getSubtaskProgress(task) {
      if (window.TaskMDATasks?.getSubtaskProgress) {
        return window.TaskMDATasks.getSubtaskProgress(task);
      }
      const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];
      const total = subtasks.length;
      const done = subtasks.filter(st => Boolean(st?.done)).length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      return { total, done, percent };
    }

    function buildSubtaskProgressHtml(task, compact = false) {
      if (window.TaskMDATasks?.buildSubtaskProgressHtml) {
        return window.TaskMDATasks.buildSubtaskProgressHtml(task, compact);
      }
      const { total, done, percent } = getSubtaskProgress(task);
      if (!total) return '';
      const wrapperClass = compact ? 'subtask-progress subtask-progress-compact' : 'subtask-progress';
      return `
        <div class="${wrapperClass}">
          <div class="subtask-progress-head">
            <span class="subtask-progress-title">Sous-taches (${done}/${total})</span>
            <span class="subtask-progress-percent">${percent}%</span>
          </div>
          <div class="subtask-progress-track">
            <div class="subtask-progress-fill" style="width:${percent}%"></div>
          </div>
        </div>
      `;
    }

    function mergeSubtasksWithExisting(existingSubtasks, subtasksParsed) {
      if (window.TaskMDATasks?.mergeSubtasksWithExisting) {
        return window.TaskMDATasks.mergeSubtasksWithExisting(existingSubtasks, subtasksParsed, normalizeSearch, uuidv4);
      }
      if (!Array.isArray(subtasksParsed)) return [];
      const existing = Array.isArray(existingSubtasks) ? existingSubtasks : [];
      const used = new Set();
      return subtasksParsed.map((nextSt) => {
        const matchIndex = existing.findIndex((oldSt, idx) => !used.has(idx) && normalizeSearch(oldSt?.label || '') === normalizeSearch(nextSt?.label || ''));
        if (matchIndex >= 0) {
          used.add(matchIndex);
          const matched = existing[matchIndex];
          return {
            id: matched?.id || nextSt.id || uuidv4(),
            label: nextSt.label || '',
            done: Boolean(matched?.done)
          };
        }
        return {
          id: nextSt.id || uuidv4(),
          label: nextSt.label || '',
          done: false
        };
      });
    }

    function renderTasks(tasks) {
      const container = document.getElementById('tasks-container');
      const paginationContainer = document.getElementById('tasks-pagination');
      if (paginationContainer) paginationContainer.innerHTML = '';
      const filteredTasks = (tasks || []).filter(task => matchesQuery([
        task.title,
        task.description,
        getTaskAssigneeName(task, currentProjectState),
        task.theme,
        getTaskGroupName(task, currentProjectState)
      ], globalSearchQuery));

      if (filteredTasks.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Aucune tâche pour le moment</p>';
        return;
      }

      const statusColors = {
        'todo': 'bg-gray-100 text-gray-700',
        'en-cours': 'bg-blue-100 text-blue-700',
        'termine': 'bg-green-100 text-green-700'
      };

      const statusLabels = {
        'todo': 'À faire',
        'en-cours': 'En cours',
        'termine': 'Terminé'
      };

      const urgencyColors = {
        'low': 'text-green-600',
        'medium': 'text-yellow-600',
        'high': 'text-red-600'
      };

      const canCreate = canCreateTaskInProject(currentProjectState);
      const addTaskBtn = document.getElementById('btn-add-task');
      if (addTaskBtn) {
        addTaskBtn.disabled = !canCreate;
        addTaskBtn.classList.toggle('opacity-50', !canCreate);
      }

      const pagination = paginateItems(filteredTasks, tasksPage, paginationConfig.tasksPerPage);
      tasksPage = pagination.currentPage;
      container.innerHTML = pagination.pageItems.map(task => {
        const participants = getTaskAssigneeEntries(task, currentProjectState).map((a) => ({
          userId: a.userId || '',
          name: a.name || fallbackDirectoryName(a.userId)
        }));
        if (task.createdBy) {
          participants.push({ userId: task.createdBy, name: '' });
        }
        const participantsHtml = renderParticipantsStack(participants, 2);
        return `
        <div id="task-card-${task.taskId}" class="task-list-card rounded-lg p-4 bg-white">
          <div class="flex justify-between items-start mb-2">
            <h4 class="text-lg font-bold">${escapeHtml(task.title)}</h4>
            <div class="flex items-center gap-2">
              <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColors[task.status] || statusColors['todo']}">
                ${statusLabels[task.status] || 'À faire'}
              </span>
              ${canEditTaskInProject(task, currentProjectState) ? `<button onclick="editTask('${task.taskId}')" class="text-slate-500 hover:text-primary" title="Éditer">
                <span class="material-symbols-outlined text-base">edit</span>
              </button>` : ''}
              ${canDeleteTaskInProject(task, currentProjectState) ? `<button onclick="deleteTask('${task.taskId}')" class="text-slate-500 hover:text-red-600" title="Supprimer">
                <span class="material-symbols-outlined text-base">delete</span>
              </button>` : ''}
            </div>
          </div>
          <p class="text-gray-600 text-sm mb-3">${escapeHtml(task.description || '')}</p>
          <div class="text-xs text-slate-500 flex flex-wrap gap-2 mb-3">
            ${task.theme ? `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700">Thème: ${escapeHtml(task.theme)}</span>` : ''}
            ${getTaskGroupName(task, currentProjectState) ? `<span class="px-2 py-1 rounded-full bg-blue-100 text-blue-700">Groupe: ${escapeHtml(getTaskGroupName(task, currentProjectState) || 'N/A')}</span>` : ''}
          </div>
          <div class="text-xs text-gray-500 flex flex-wrap items-center gap-3 mb-3">
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-base">event_note</span>
              Demande: ${formatDate(task.requestDate)}
            </span>
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-base">event</span>
              ${formatDate(task.dueDate)}
            </span>
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-base">person</span>
              ${escapeHtml(getTaskAssigneeName(task, currentProjectState) || 'Non assigné')}
            </span>
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-base">attach_file</span>
              ${(task.attachments || []).length} fichier(s)
            </span>
          </div>
          <div class="flex items-center justify-between text-sm gap-3 flex-wrap">
            <span class="flex items-center gap-1 ${urgencyColors[task.urgency] || urgencyColors['medium']}">
              <span class="material-symbols-outlined text-lg">priority_high</span>
              <span>${task.urgency === 'high' ? 'Haute' : task.urgency === 'low' ? 'Basse' : 'Moyenne'}</span>
            </span>
            ${participantsHtml}
            <div class="flex items-center gap-3">
              <button onclick="sendTaskStatusEmail('${task.taskId}', false)" class="text-slate-600 hover:underline">Email statut</button>
              ${task.status === 'termine' ? `<button onclick="sendTaskStatusEmail('${task.taskId}', true)" class="text-emerald-700 hover:underline">Email achevée</button>` : ''}
              ${canChangeTaskStatus(task, currentProjectState) ? `<button onclick="toggleTaskStatus('${task.taskId}')" class="text-primary hover:underline">Changer statut</button>` : ''}
            </div>
          </div>
          ${(task.subtasks && task.subtasks.length > 0) ? `
            <div class="mt-3 border-t border-gray-100 pt-3">
              ${buildSubtaskProgressHtml(task, false)}
              <div class="mt-2 space-y-1.5">
              ${task.subtasks.map(st => `
                <label class="subtask-item">
                  <input class="subtask-checkbox" type="checkbox" ${st.done ? 'checked' : ''} ${canEditTaskInProject(task, currentProjectState) ? '' : 'disabled'} onchange="toggleSubtask('${task.taskId}','${st.id}', this.checked)">
                  <span class="subtask-label ${st.done ? 'subtask-label-done' : ''}">${escapeHtml(st.label)}</span>
                </label>
              `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      }).join('');
      renderPagination('tasks-pagination', pagination, 'setTasksPage', 'taches');
    }

    function renderArchivedTasks(tasks) {
      const countEl = document.getElementById('archived-tasks-count');
      const container = document.getElementById('archived-tasks-container');
      const toggleBtn = document.getElementById('btn-toggle-archived-tasks');
      const archived = (tasks || []).filter(task => task?.archivedAt);
      if (countEl) {
        countEl.textContent = `(${archived.length})`;
      }
      if (toggleBtn) {
        toggleBtn.textContent = archivedTasksExpanded ? 'Masquer' : 'Afficher';
      }
      if (!container) return;
      container.classList.toggle('hidden', !archivedTasksExpanded);
      if (!archivedTasksExpanded) return;

      if (archived.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500">Aucune tache archivee.</p>';
        return;
      }

      container.innerHTML = archived
        .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0))
        .map(task => {
          const canEdit = canEditTaskInProject(task, currentProjectState);
          const canDelete = canDeleteTaskInProject(task, currentProjectState);
          return `
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-slate-800">${escapeHtml(task.title || 'Tache')}</p>
                  <p class="text-xs text-slate-500 mt-1">Archivee le ${task.archivedAt ? new Date(task.archivedAt).toLocaleString('fr-FR') : '-'}</p>
                </div>
                <div class="flex items-center gap-2 text-xs">
                  ${canEdit ? `<button onclick="restoreArchivedTask('${task.taskId}')" class="px-2 py-1 rounded bg-emerald-100 text-emerald-700">Restaurer</button>` : ''}
                  ${canDelete ? `<button onclick="deleteTask('${task.taskId}')" class="px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');
    }

    async function restoreArchivedTask(taskId) {
      if (!currentProjectId || !taskId) return;
      const state = await getProjectState(currentProjectId);
      const task = (state?.tasks || []).find(t => t.taskId === taskId);
      if (!task) return;
      if (!canEditTaskInProject(task, state)) {
        showToast('Action non autorisee');
        return;
      }
      const event = createEvent(
        EventTypes.UPDATE_TASK,
        currentProjectId,
        currentUser.userId,
        {
          taskId,
          changes: {
            archivedAt: null
          }
        }
      );
      await publishEvent(event);
      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, event);
      }
      showToast('Tache restauree');
      await showProjectDetail(currentProjectId);
    }

    function renderKanban(tasks) {
      const board = document.getElementById('kanban-board');
      if (!board) return;

      const columns = [
        { key: 'todo', label: 'À faire' },
        { key: 'en-cours', label: 'En cours' },
        { key: 'termine', label: 'Terminé' }
      ];

      board.innerHTML = columns.map(col => {
        const items = tasks.filter(t => (t.status || 'todo') === col.key);
        const cards = items.length === 0
          ? '<p class="text-sm text-gray-500 text-center py-4">Aucune tâche</p>'
          : items.map(task => `
            <div class="kanban-card bg-white rounded-lg p-3 cursor-grab active:cursor-grabbing" draggable="true" ondragstart="startKanbanDrag(event, '${task.taskId}')">
              <h4 class="font-semibold text-sm mb-1">${escapeHtml(task.title)}</h4>
              <p class="text-xs text-gray-500 mb-2">${escapeHtml(task.description || '')}</p>
              ${buildSubtaskProgressHtml(task, true)}
              <div class="mb-2 flex flex-wrap gap-1">
                ${task.theme ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">${escapeHtml(task.theme)}</span>` : ''}
                ${getTaskGroupName(task, currentProjectState) ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">${escapeHtml(getTaskGroupName(task, currentProjectState) || 'Groupe')}</span>` : ''}
              </div>
              <div class="text-xs text-gray-500 flex items-center justify-between">
                <span>${escapeHtml(getTaskAssigneeName(task, currentProjectState) || 'Non assigné')}</span>
                <span>${formatDate(task.dueDate)}</span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                ${canEditTaskInProject(task, currentProjectState) ? `<button onclick="event.stopPropagation(); editTask('${task.taskId}')" class="px-2 py-1 rounded bg-slate-100 text-slate-700">Modifier</button>` : ''}
                ${canEditTaskInProject(task, currentProjectState) ? `<button onclick="event.stopPropagation(); archiveTask('${task.taskId}')" class="px-2 py-1 rounded bg-amber-100 text-amber-700">Archiver</button>` : ''}
                ${canDeleteTaskInProject(task, currentProjectState) ? `<button onclick="event.stopPropagation(); deleteTask('${task.taskId}')" class="px-2 py-1 rounded bg-rose-100 text-rose-700">Supprimer</button>` : ''}
              </div>
            </div>
          `).join('');

        return `
          <div class="kanban-col rounded-xl p-3" data-col="${col.key}" ondragover="allowKanbanDrop(event)" ondrop="dropKanbanTask(event, '${col.key}')">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-bold text-sm">${col.label}</h4>
              <span class="text-xs px-2 py-1 rounded-full bg-white">${items.length}</span>
            </div>
            <div class="space-y-3">${cards}</div>
          </div>
        `;
      }).join('');
    }

    function renderTimeline(tasks) {
      const container = document.getElementById('timeline-container');
      if (!container) return;

      const now = Date.now();
      let items = [...tasks].sort((a, b) => {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });

      if (timelineFilter === 'milestone') {
        items = items.filter(task => task.status === 'termine' || task.urgency === 'high');
      } else if (timelineFilter === 'urgent') {
        items = items.filter(task => task.urgency === 'high');
      } else if (timelineFilter === 'overdue') {
        items = items.filter(task => task.dueDate && new Date(task.dueDate).getTime() < now && task.status !== 'termine');
      }

      if (calendarDayFilterEnabled && selectedCalendarDayKey) {
        items = items.filter(task => taskDueDateKey(task) === selectedCalendarDayKey);
      }

      const filters = [
        ['timeline-filter-all', 'all'],
        ['timeline-filter-milestone', 'milestone'],
        ['timeline-filter-urgent', 'urgent'],
        ['timeline-filter-overdue', 'overdue']
      ];
      filters.forEach(([id, key]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('view-tab-active', timelineFilter === key);
      });

      if (items.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Aucune tâche planifiée</p>';
        return;
      }

      container.innerHTML = items.map(task => {
        const progress = task.status === 'termine' ? 100 : task.status === 'en-cours' ? 55 : 10;
        const isMilestone = task.status === 'termine' || task.urgency === 'high';
        return `
          <div class="bg-surface-container-low rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-semibold">${escapeHtml(task.title)}</h4>
              <div class="flex items-center gap-2">
                ${isMilestone ? '<span class="text-[10px] px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold">Jalon</span>' : ''}
                <span class="text-xs text-gray-600">${formatDate(task.dueDate)}</span>
              </div>
            </div>
            <div class="h-2 bg-white rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full" style="width: ${progress}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    function renderCalendar(tasks) {
      const grid = document.getElementById('calendar-grid');
      const monthLabel = document.getElementById('calendar-month-label');
      const agenda = document.getElementById('calendar-day-agenda');
      if (!grid || !monthLabel || !agenda) return;

      const year = calendarCursor.getFullYear();
      const month = calendarCursor.getMonth();
      const firstDay = new Date(year, month, 1);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const leading = (firstDay.getDay() + 6) % 7;
      const todayKey = toYmd(new Date());

      monthLabel.textContent = firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

      const tasksByDay = new Map();
      (tasks || []).forEach(task => {
        const key = taskDueDateKey(task);
        if (!key) return;
        if (!tasksByDay.has(key)) tasksByDay.set(key, []);
        tasksByDay.get(key).push(task);
      });

      const headers = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        .map(day => `<div class="text-center font-semibold text-slate-500 py-1">${day}</div>`)
        .join('');

      const cells = [];
      for (let i = 0; i < leading; i++) {
        cells.push('<div class="min-h-[70px] rounded-lg bg-slate-100/70 border border-slate-100"></div>');
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const key = toYmd(new Date(year, month, day));
        const count = (tasksByDay.get(key) || []).length;
        const isToday = key === todayKey;
        const isSelected = key === selectedCalendarDayKey;
        const badge = count > 0
          ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">${count}</span>`
          : '';
        cells.push(`
          <button onclick="selectCalendarDay('${key}')" class="min-h-[70px] text-left rounded-lg border p-2 transition ${
            isSelected ? 'border-primary bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
          }">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold ${isToday ? 'text-primary' : 'text-slate-700'}">${day}</span>
              ${badge}
            </div>
          </button>
        `);
      }

      grid.innerHTML = `${headers}${cells.join('')}`;

      if (!selectedCalendarDayKey || !selectedCalendarDayKey.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
        selectedCalendarDayKey = todayKey.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
          ? todayKey
          : toYmd(new Date(year, month, 1));
      }

      const selectedTasks = tasksByDay.get(selectedCalendarDayKey) || [];
      const selectedDate = new Date(selectedCalendarDayKey);
      agenda.innerHTML = `
        <div class="rounded-xl border border-slate-200 bg-white p-3">
          <div class="flex items-center justify-between gap-2 mb-2">
            <p class="text-sm font-bold text-slate-800">Agenda du ${selectedDate.toLocaleDateString('fr-FR')}</p>
            <div class="flex items-center gap-2">
              ${calendarDayFilterEnabled ? '<span class="text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">Filtre jour actif</span>' : ''}
              <button onclick="clearCalendarDayFilter()" class="px-2 py-1 text-[10px] rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Voir tout le mois</button>
            </div>
          </div>
          ${
            selectedTasks.length === 0
              ? '<p class="text-sm text-slate-500">Aucune tâche planifiée ce jour.</p>'
              : `<div class="space-y-2">${selectedTasks.map(task => `
                  <div class="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <p class="text-sm font-semibold text-slate-800">${escapeHtml(task.title)}</p>
                    <p class="text-xs text-slate-500">${escapeHtml(getTaskAssigneeName(task, currentProjectState) || 'Non assigné')}</p>
                  </div>
                `).join('')}</div>`
          }
        </div>
      `;
    }

    function selectCalendarDay(dayKey) {
      selectedCalendarDayKey = dayKey;
      calendarDayFilterEnabled = true;
      renderCalendar(currentProjectState?.tasks || []);
      renderTimeline(currentProjectState?.tasks || []);
    }

    function clearCalendarDayFilter() {
      calendarDayFilterEnabled = false;
      renderCalendar(currentProjectState?.tasks || []);
      renderTimeline(currentProjectState?.tasks || []);
    }

    window.selectCalendarDay = selectCalendarDay;
    window.clearCalendarDayFilter = clearCalendarDayFilter;
    window.openNotification = openNotification;

    function startGlobalKanbanDrag(event, taskRef) {
      draggedGlobalTaskRef = taskRef;
      try {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', taskRef);
      } catch {
        // Ignore dataTransfer failures on some browsers
      }
    }

    async function updateGlobalTaskStatusFromRef(taskRef, targetStatus) {
      const resolved = await resolveGlobalTaskFromRef(taskRef);
      if (!resolved?.task) return false;
      if ((resolved.task.status || 'todo') === targetStatus) return false;

      if (resolved.sourceType === 'standalone') {
        await putEncrypted('globalTasks', {
          ...resolved.task,
          status: targetStatus,
          updatedAt: Date.now()
        }, 'id');
        return true;
      }

      if (!canChangeTaskStatus(resolved.task, resolved.state)) {
        showToast('Action non autorisee');
        return false;
      }
      const eventUpdate = createEvent(
        EventTypes.UPDATE_TASK,
        resolved.projectId,
        currentUser.userId,
        { taskId: resolved.task.taskId, changes: { status: targetStatus } }
      );
      await publishEvent(eventUpdate);
      if (sharedFolderHandle) {
        await writeEventToSharedFolder(resolved.projectId, eventUpdate);
      }
      return true;
    }

    async function dropGlobalKanbanTask(event, targetStatus) {
      event.preventDefault();
      const taskRef = draggedGlobalTaskRef || event.dataTransfer?.getData('text/plain');
      draggedGlobalTaskRef = null;
      if (!taskRef) return;
      const updated = await updateGlobalTaskStatusFromRef(taskRef, targetStatus);
      if (!updated) return;
      showToast('✅ Tâche déplacée');
      if (workspaceMode === 'global') {
        await renderGlobalTasks();
        await refreshStats();
      }
    }

    window.startGlobalKanbanDrag = startGlobalKanbanDrag;
    window.dropGlobalKanbanTask = dropGlobalKanbanTask;

    function startKanbanDrag(event, taskId) {
      draggedTaskId = taskId;
      try {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', taskId);
      } catch {
        // Ignore dataTransfer failures on some browsers
      }
    }

    function allowKanbanDrop(event) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }

    async function dropKanbanTask(event, targetStatus) {
      event.preventDefault();
      if (!currentProjectId) return;

      const taskId = draggedTaskId || event.dataTransfer?.getData('text/plain');
      draggedTaskId = null;
      if (!taskId) return;

      const state = await getProjectState(currentProjectId);
      const task = (state.tasks || []).find(t => t.taskId === taskId);
      if (!task || task.status === targetStatus) return;
      if (!canChangeTaskStatus(task, state)) {
        showToast('Action non autorisee');
        return;
      }

      const eventUpdate = createEvent(
        EventTypes.UPDATE_TASK,
        currentProjectId,
        currentUser.userId,
        { taskId, changes: { status: targetStatus } }
      );

      await publishEvent(eventUpdate);
      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, eventUpdate);
      }
      showToast('✅ Tâche déplacée');
      await showProjectDetail(currentProjectId);
    }

    function getDocumentCategory(doc) {
      const type = (doc.type || '').toLowerCase();
      const name = (doc.name || '').toLowerCase();
      if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) return 'image';
      if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
      if (
        type.includes('spreadsheet') ||
        type.includes('word') ||
        type.includes('presentation') ||
        /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/.test(name)
      ) return 'office';
      return 'other';
    }

    function isDocumentPreviewable(doc) {
      const category = getDocumentCategory(doc);
      return category === 'image' || category === 'pdf' || (doc.type || '').startsWith('text/');
    }

    function openDocumentPreview(dataEncoded, nameEncoded, typeEncoded) {
      const modal = document.getElementById('modal-doc-preview');
      const title = document.getElementById('doc-preview-title');
      const content = document.getElementById('doc-preview-content');
      if (!modal || !title || !content) return;

      const data = decodeURIComponent(dataEncoded || '');
      const name = decodeURIComponent(nameEncoded || '');
      const type = decodeURIComponent(typeEncoded || '');
      title.textContent = `Aperçu: ${name || 'document'}`;

      if (!data) {
        content.innerHTML = '<p class="text-sm text-slate-500">Aucun contenu disponible pour ce document.</p>';
      } else if ((type || '').startsWith('image/')) {
        content.innerHTML = `<img src="${data}" alt="${escapeHtml(name || 'image')}" class="max-w-full h-auto rounded-lg mx-auto">`;
      } else if ((type || '').includes('pdf') || String(name || '').toLowerCase().endsWith('.pdf')) {
        content.innerHTML = `<iframe src="${data}" class="w-full h-[70vh] rounded-lg border border-slate-200" title="${escapeHtml(name || 'PDF')}"></iframe>`;
      } else if ((type || '').startsWith('text/')) {
        content.innerHTML = `<iframe src="${data}" class="w-full h-[70vh] rounded-lg border border-slate-200 bg-white" title="${escapeHtml(name || 'Texte')}"></iframe>`;
      } else {
        content.innerHTML = '<p class="text-sm text-slate-500">Prévisualisation non disponible. Utilisez Télécharger.</p>';
      }

      modal.classList.remove('hidden');
    }

    function closeDocumentPreview() {
      const modal = document.getElementById('modal-doc-preview');
      const content = document.getElementById('doc-preview-content');
      if (content) content.innerHTML = '';
      modal?.classList.add('hidden');
    }

    window.openDocumentPreview = openDocumentPreview;

    function renderDocuments(tasks) {
      const container = document.getElementById('documents-container');
      if (!container) return;

      const docs = [];
      tasks.forEach(task => {
        (task.attachments || []).forEach((file, attachmentIndex) => {
          if (file.shareToDocs !== false) {
            docs.push({
              taskTitle: task.title,
              taskId: task.taskId,
              attachmentIndex,
              uploadedAt: task.updatedAt || task.createdAt || 0,
              ...file
            });
          }
        });
      });

      let filtered = [...docs];
      if (docsFilters.query.trim()) {
        const q = docsFilters.query.trim().toLowerCase();
        filtered = filtered.filter(doc => [doc.name, doc.taskTitle, doc.type].some(v => String(v || '').toLowerCase().includes(q)));
      }
      if (docsFilters.type !== 'all') {
        filtered = filtered.filter(doc => getDocumentCategory(doc) === docsFilters.type);
      }

      filtered.sort((a, b) => {
        if (docsFilters.sort === 'oldest') return (a.uploadedAt || 0) - (b.uploadedAt || 0);
        if (docsFilters.sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
        if (docsFilters.sort === 'size-asc') return (a.size || 0) - (b.size || 0);
        if (docsFilters.sort === 'size-desc') return (b.size || 0) - (a.size || 0);
        return (b.uploadedAt || 0) - (a.uploadedAt || 0);
      });

      if (filtered.length === 0) {
        const empty = docs.length === 0 ? 'Aucun document partagé' : 'Aucun document ne correspond aux filtres';
        container.innerHTML = `<p class="text-gray-500 text-center py-8 col-span-full">${empty}</p>`;
        return;
      }

      container.innerHTML = filtered.map((doc, idx) => `
        <div class="doc-card bg-surface-container-low rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="material-symbols-outlined text-primary">description</span>
            <span class="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-white">${escapeHtml(getDocumentCategory(doc))}</span>
          </div>
          <h4 class="font-semibold text-sm truncate mb-1">${escapeHtml(doc.name || `document-${idx + 1}`)}</h4>
          <p class="text-xs text-gray-500 mb-2">Source: ${escapeHtml(doc.taskTitle || 'Tâche')}</p>
          <div class="text-[11px] text-slate-500 mb-3">${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('fr-FR') : ''}</div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500">${formatFileSize(doc.size || 0)}</span>
            <div class="flex items-center gap-2">
              ${isDocumentPreviewable(doc) ? `<button onclick="openDocumentPreview('${encodeURIComponent(doc.data || '')}','${encodeURIComponent(doc.name || '')}','${encodeURIComponent(doc.type || '')}')" class="text-slate-700 hover:underline">Aperçu</button>` : ''}
              <a class="text-primary font-semibold hover:underline" href="${doc.data || '#'}" download="${escapeHtml(doc.name || 'document')}">Télécharger</a>
              ${canEditTaskInProject((currentProjectState?.tasks || []).find(t => t.taskId === doc.taskId), currentProjectState) ? `<button onclick="removeAttachment('${doc.taskId}', ${doc.attachmentIndex})" class="text-red-600 hover:underline">Suppr.</button>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }

    async function renderActivity(events) {
      const container = document.getElementById('activity-container');
      if (!container) return;
      if (!canReadProjectActivity(currentProjectState)) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Acces reserve aux managers/owners.</p>';
        return;
      }

      if (!events || events.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Aucune activité</p>';
        return;
      }

      const users = await getAllDecrypted('users', 'userId');
      const usersById = new Map(users.map(u => [u.userId, u.name]));

      const labels = {
        CREATE_PROJECT: 'Création de projet',
        UPDATE_PROJECT: 'Mise à jour du projet',
        DELETE_PROJECT: 'Suppression de projet',
        CREATE_TASK: 'Création de tâche',
        UPDATE_TASK: 'Mise à jour de tâche',
        DELETE_TASK: 'Suppression de tâche',
        SEND_MESSAGE: 'Nouveau message',
        UPDATE_MESSAGE: 'Message modifié',
        DELETE_MESSAGE: 'Message supprimé',
        ADD_MEMBER: 'Ajout membre',
        REMOVE_MEMBER: 'Retrait membre',
        CREATE_INVITE: 'Invitation creee',
        UPDATE_INVITE: 'Mise a jour invitation',
        CREATE_GROUP: 'Creation groupe',
        DELETE_GROUP: 'Suppression groupe',
        CREATE_USER_GROUP: 'Creation groupe utilisateurs',
        UPDATE_USER_GROUP: 'Maj groupe utilisateurs',
        DELETE_USER_GROUP: 'Suppression groupe utilisateurs',
        ADD_THEME: 'Ajout thematique',
        REMOVE_THEME: 'Retrait thematique'
      };

      const now = Date.now();
      let filtered = [...events];

      if (activityFilters.type !== 'all') {
        filtered = filtered.filter(evt => evt.type === activityFilters.type);
      }
      if (activityFilters.author.trim()) {
        const q = activityFilters.author.trim().toLowerCase();
        filtered = filtered.filter(evt => {
          const authorName = (usersById.get(evt.author) || evt.payload?.authorName || evt.author || '').toLowerCase();
          return authorName.includes(q);
        });
      }
      if (activityFilters.period !== 'all') {
        const delta = activityFilters.period === '24h'
          ? 24 * 60 * 60 * 1000
          : activityFilters.period === '7d'
            ? 7 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000;
        filtered = filtered.filter(evt => now - evt.timestamp <= delta);
      }

      if (filtered.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Aucun événement pour ces filtres</p>';
        return;
      }

      container.innerHTML = filtered.slice(0, 120).map(evt => `
        <div class="activity-card bg-surface-container-low rounded-lg p-3 border border-slate-100">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-semibold text-slate-800">${labels[evt.type] || evt.type}</span>
            <span class="text-xs text-slate-500">${new Date(evt.timestamp).toLocaleString('fr-FR')}</span>
          </div>
          <div class="text-xs text-slate-500 mt-1">auteur: ${escapeHtml(usersById.get(evt.author) || evt.payload?.authorName || evt.author || 'inconnu')}</div>
          <div class="text-xs text-slate-500 mt-1 break-all">eventId: ${escapeHtml(evt.eventId || '')}</div>
        </div>
      `).join('');
    }

    function renderMessageAttachments(attachments) {
      if (!attachments || attachments.length === 0) return '';
      return `
        <div class="mt-2 flex flex-wrap gap-2">
          ${attachments.map((att, idx) => {
            const isImage = String(att.type || '').startsWith('image/');
            const label = escapeHtml(att.name || `fichier-${idx + 1}`);
            return `
              <a href="${att.data || '#'}" download="${label}" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs hover:bg-slate-200">
                <span class="material-symbols-outlined text-sm">${isImage ? 'image' : 'attach_file'}</span>
                <span class="max-w-[180px] truncate">${label}</span>
              </a>
            `;
          }).join('')}
        </div>
      `;
    }

    function renderMessages(messages) {
      const container = document.getElementById('messages-container');
      if (!container) return;

      let filtered = [...(messages || [])];
      if (messageFilters.query.trim()) {
        const q = messageFilters.query.trim().toLowerCase();
        filtered = filtered.filter(msg => {
          return [msg.content, msg.authorName].some(v => String(v || '').toLowerCase().includes(q));
        });
      }
      if (messageFilters.onlyMine && currentUser?.userId) {
        filtered = filtered.filter(msg => msg.author === currentUser.userId);
      }

      if (filtered.length === 0) {
        const emptyLabel = (messages || []).length === 0
          ? 'Aucun message'
          : 'Aucun message ne correspond aux filtres';
        container.innerHTML = `<p class="text-gray-500 text-center py-8">${emptyLabel}</p>`;
        return;
      }

      container.innerHTML = filtered.map(msg => `
        <div id="message-item-${msg.messageId}" class="border-l-4 border-primary pl-4 py-2">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold text-sm">${escapeHtml(msg.authorName || 'Utilisateur')}</span>
            <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleString('fr-FR')}</span>
            ${msg.editedAt ? '<span class="text-[10px] text-gray-400">(modifié)</span>' : ''}
          </div>
          ${editingMessageId === msg.messageId ? `
            <div class="space-y-2">
              <textarea id="message-edit-input-${msg.messageId}" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">${escapeHtml(editingMessageDraft)}</textarea>
              <div class="flex items-center gap-3 text-xs">
                <button onclick="saveEditedMessage('${msg.messageId}')" class="text-primary hover:underline">Enregistrer</button>
                <button onclick="cancelEditMessage()" class="text-slate-600 hover:underline">Annuler</button>
              </div>
            </div>
          ` : `
            <div class="markdown-content text-gray-700">${renderSafeMarkdown(msg.content)}</div>
            ${renderMessageAttachments(msg.attachments)}
            <div class="mt-1 flex items-center gap-3 text-xs">
              ${canEditProjectMessage(msg, currentProjectState) ? `<button onclick="startEditMessage('${msg.messageId}')" class="text-primary hover:underline">Éditer</button>` : ''}
              ${canDeleteProjectMessage(msg, currentProjectState) ? `<button onclick="deleteMessage('${msg.messageId}')" class="text-red-600 hover:underline">Supprimer</button>` : ''}
            </div>
          `}
        </div>
      `).join('');

      // Scroll to bottom
      container.scrollTop = container.scrollHeight;
    }

    async function toggleTaskStatus(taskId) {
      if (!currentProjectId) return;

      const state = await getProjectState(currentProjectId);
      const task = state.tasks.find(t => t.taskId === taskId);

      if (!task) return;
      if (!canChangeTaskStatus(task, state)) {
        showToast('Action non autorisee');
        return;
      }

      // Cycle through statuses
      const statuses = ['todo', 'en-cours', 'termine'];
      const currentIndex = statuses.indexOf(task.status);
      const newStatus = statuses[(currentIndex + 1) % statuses.length];

      const event = createEvent(
        EventTypes.UPDATE_TASK,
        currentProjectId,
        currentUser.userId,
        {
          taskId: taskId,
          changes: { status: newStatus }
        }
      );

      await publishEvent(event);

      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, event);
      }

      showToast('✅ Statut mis à jour');
      await showProjectDetail(currentProjectId);
    }

    async function editTask(taskId) {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      const task = state.tasks.find(t => t.taskId === taskId);
      if (!task) return;
      if (!canEditTaskInProject(task, state)) {
        showToast('Action non autorisee');
        return;
      }
      openTaskModal(task);
    }

    async function deleteTask(taskId) {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      const task = state.tasks.find(t => t.taskId === taskId);
      if (!task) return;
      if (!canDeleteTaskInProject(task, state)) {
        showToast('Action non autorisee');
        return;
      }
      if (!confirm('Supprimer cette tâche ?')) return;

      const event = createEvent(
        EventTypes.DELETE_TASK,
        currentProjectId,
        currentUser.userId,
        { taskId }
      );

      await publishEvent(event);
      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, event);
      }
      showToast('✅ Tâche supprimée');
      addNotification('Tache', 'Une tache a ete supprimee', currentProjectId, {
        targetView: 'list',
        linkLabel: 'Ouvrir le projet'
      });
      await showProjectDetail(currentProjectId);
    }

    async function archiveTask(taskId) {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      const task = state.tasks.find(t => t.taskId === taskId);
      if (!task) return;
      if (!canEditTaskInProject(task, state)) {
        showToast('Action non autorisee');
        return;
      }
      if (!confirm('Archiver cette tâche ?')) return;

      const event = createEvent(
        EventTypes.UPDATE_TASK,
        currentProjectId,
        currentUser.userId,
        {
          taskId,
          changes: {
            status: 'termine',
            archivedAt: Date.now()
          }
        }
      );
      await publishEvent(event);
      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, event);
      }
      showToast('✅ Tâche archivée');
      await showProjectDetail(currentProjectId);
    }

    async function toggleSubtask(taskId, subtaskId, done) {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      const task = state.tasks.find(t => t.taskId === taskId);
      if (!task) return;
      if (!canEditTaskInProject(task, state)) {
        showToast('Action non autorisee');
        return;
      }

      const subtasks = (task.subtasks || []).map(st => st.id === subtaskId ? { ...st, done } : st);
      const event = createEvent(
        EventTypes.UPDATE_TASK,
        currentProjectId,
        currentUser.userId,
        { taskId, changes: { subtasks } }
      );

      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      await showProjectDetail(currentProjectId);
    }

    async function removeAttachment(taskId, attachmentIndex) {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      const task = state.tasks.find(t => t.taskId === taskId);
      if (!task) return;
      if (!canEditTaskInProject(task, state)) {
        showToast('Action non autorisee');
        return;
      }

      const attachments = [...(task.attachments || [])];
      attachments.splice(attachmentIndex, 1);

      const event = createEvent(
        EventTypes.UPDATE_TASK,
        currentProjectId,
        currentUser.userId,
        { taskId, changes: { attachments } }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      showToast('✅ Document supprimé');
      await showProjectDetail(currentProjectId);
    }

    function startEditMessage(messageId) {
      if (!currentProjectState) return;
      const msg = (currentProjectState.messages || []).find(m => m.messageId === messageId);
      if (!msg) return;
      if (!canEditProjectMessage(msg, currentProjectState)) {
        showToast('Action non autorisee');
        return;
      }
      editingMessageId = messageId;
      editingMessageDraft = msg.content || '';
      renderMessages(currentProjectState.messages || []);
      setTimeout(() => {
        const input = document.getElementById(`message-edit-input-${messageId}`);
        if (input) input.focus();
      }, 0);
    }

    function cancelEditMessage() {
      editingMessageId = null;
      editingMessageDraft = '';
      if (currentProjectState) {
        renderMessages(currentProjectState.messages || []);
      }
    }

    async function saveEditedMessage(messageId) {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      const msg = (state?.messages || []).find(m => m.messageId === messageId);
      if (!msg || !canEditProjectMessage(msg, state)) {
        showToast('Action non autorisee');
        return;
      }
      const input = document.getElementById(`message-edit-input-${messageId}`);
      const trimmed = (input?.value || '').trim();
      if (!trimmed) {
        showToast('❌ Le message ne peut pas être vide');
        return;
      }

      const event = createEvent(
        EventTypes.UPDATE_MESSAGE,
        currentProjectId,
        currentUser.userId,
        { messageId, content: trimmed }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      editingMessageId = null;
      editingMessageDraft = '';
      showToast('✅ Message modifié');
      addNotification('Message', 'Un message a ete modifie', currentProjectId, {
        targetType: 'message',
        targetId: messageId,
        targetView: 'chat',
        linkLabel: 'Ouvrir le message'
      });
      await showProjectDetail(currentProjectId);
    }

    async function deleteMessage(messageId) {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      const msg = (state?.messages || []).find(m => m.messageId === messageId);
      if (!msg || !canDeleteProjectMessage(msg, state)) {
        showToast('Action non autorisee');
        return;
      }
      if (!confirm('Supprimer ce message ?')) return;

      const event = createEvent(
        EventTypes.DELETE_MESSAGE,
        currentProjectId,
        currentUser.userId,
        { messageId }
      );
      await publishEvent(event);
      if (sharedFolderHandle) await writeEventToSharedFolder(currentProjectId, event);
      if (editingMessageId === messageId) {
        editingMessageId = null;
        editingMessageDraft = '';
      }
      showToast('✅ Message supprimé');
      addNotification('Message', 'Un message a ete supprime', currentProjectId, {
        targetView: 'chat',
        linkLabel: 'Ouvrir la discussion'
      });
      await showProjectDetail(currentProjectId);
    }

    // ============================================================================
    // MODULE 6.5: ENCRYPTED DATA PERSISTENCE
    // ============================================================================

    async function saveEncryptedConfig() {
      if (!window.TaskMDACrypto || !window.TaskMDACrypto.isUnlocked()) {
        return; // Crypto not available or not unlocked
      }

      const dataToEncrypt = {
        config: {
          userId: getCurrentUserId(),
          clientId: getCurrentClientId(),
          userName: currentUser ? currentUser.name : ''
        },
        version: '1.0-encrypted',
        lastSaved: Date.now()
      };

      await window.TaskMDACrypto.saveEncryptedData(dataToEncrypt);
    }

    // ============================================================================
    // MODULE 7: APPLICATION LIFECYCLE
    // ============================================================================

    async function initApp() {
      debugLog('Initializing TaskMDA Team...');

      try {
        showLoading(true);

        // Load encrypted config if exists
        if (window.TaskMDACrypto && window.TaskMDACrypto.isUnlocked()) {
          const encryptedData = await window.TaskMDACrypto.loadEncryptedData();
          if (encryptedData && encryptedData.config) {
            // Restore user config
            if (encryptedData.config.userId) {
              localStorage.setItem('userId', encryptedData.config.userId);
            }
            if (encryptedData.config.clientId) {
              localStorage.setItem('clientId', encryptedData.config.clientId);
            }
          }
        }

        // Init database
        await initDatabase();
        await refreshGlobalTaxonomyCache();

        // Init user
        currentUser = await initializeCurrentUser();
        await upsertDirectoryUser({
          userId: currentUser.userId,
          name: currentUser.name,
          source: 'current_user',
          lastSeenAt: Date.now()
        });
        await refreshDirectoryFromKnownSources();
        if (window.TaskMDACrypto && window.TaskMDACrypto.isUnlocked()) {
          const encryptedData = await window.TaskMDACrypto.loadEncryptedData();
          if (encryptedData && encryptedData.config && encryptedData.config.userName) {
            currentUser.name = encryptedData.config.userName;
          }
        }
        updateUserInfo();
        loadNotifications();
        dueReminderMemory = loadReminderMemory();
        renderNotifications();

        // Save encrypted config after initialization
        await saveEncryptedConfig();
        showMainContent();
        showDashboard();
        updateSyncStatus('disconnected');
        await tryConnectSavedFolder();
        if (!isFileSystemSupported()) {
          showToast('File System Access API non supporte: mode solo uniquement');
        }
        showLoading(false);
        debugLog('App initialized');
        return;

        // Check File System API support
        if (!isFileSystemSupported()) {
          showSetupError('❌ File System Access API non supporté. Utilisez Chrome 86+ ou Edge 86+.');
          showLoading(false);
          return;
        }

        showMainContent();
        showDashboard();
        updateSyncStatus('disconnected');
        await tryConnectSavedFolder();
        if (!isFileSystemSupported()) {
          showToast('File System Access API non supporte: mode solo uniquement');
        }
        showLoading(false);

        debugLog('App initialized');
      } catch (error) {
        console.error('❌ Init error:', error);
        showSetupError(`Erreur: ${error.message}`);
        showLoading(false);
      }
    }

    async function handleSelectFolder() {
      try {
        showLoading(true);

        const handle = await selectSharedFolder();
        await connectSharedFolderHandle(handle, true);
        showLoading(false);
        return;
        sharedFolderHandle = handle;

        // Découvrir et charger tous les projets existants
        await discoverAndLoadExistingProjects();

        // Démarrer le polling pour les nouveaux événements
        if (!isPolling) {
          startPolling();
        }

        updateSyncStatus('connected');
        showMainContent();
        await refreshStats();
        await renderProjects();

        showToast('✅ Connecté au dossier partagé');
        addNotification('Connexion', 'Dossier partage connecte', null);
        showLoading(false);
      } catch (error) {
        // L'utilisateur a fermé le sélecteur: ce n'est pas une erreur applicative.
        if (error?.name === 'AbortError') {
          console.info('Sélection de dossier annulée par l’utilisateur.');
          showToast('Sélection du dossier annulée');
          showLoading(false);
          return;
        }

        console.error('Error:', error);
        showToast(`Erreur dossier partage: ${error.message}`);
        showLoading(false);
      }
    }

    async function handleContinueWithoutFolder() {
      try {
        await disconnectSharedFolder();
        return;
        sharedFolderHandle = null;
        stopPolling();
        updateSyncStatus('disconnected');
        showMainContent();
        await refreshStats();
        await renderProjects();
        showToast('Mode solo activé (sans dossier partagé)');
      } catch (error) {
        console.error('Error:', error);
        showToast(`Erreur deconnexion dossier: ${error.message}`);
      }
    }

    async function handleLogout() {
      if (!confirm('Se déconnecter de l’application maintenant ?')) return;
      try {
        closeMobileSidebar();
        toggleNotificationsPanel(false);
        stopPolling();
        stopDueReminders();
        stopBackupReminders();
        currentProjectId = null;
        currentProjectState = null;
        currentProjectEvents = [];
        editingTaskId = null;
        editingStandaloneTaskId = null;
        editingMessageId = null;
        projectDetailMode = 'work';
        activeProjectView = 'list';

        if (window.TaskMDACrypto) {
          if (typeof window.TaskMDACrypto.lock === 'function') {
            window.TaskMDACrypto.lock();
          }
          window.TaskMDACrypto.showLockScreen('unlock');
          const lockBtn = document.getElementById('lockBtn');
          if (lockBtn) {
            lockBtn.onclick = () => {
              window.TaskMDACrypto.submitPassword(async () => {
                await initApp();
              });
            };
          }
        }

        document.getElementById('setup-screen')?.classList.add('hidden');
        document.getElementById('main-content')?.classList.add('hidden');
      } catch (error) {
        console.error('Logout error:', error);
        showToast(`Erreur déconnexion: ${error.message}`);
      }
    }

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================

    document.getElementById('btn-select-folder').addEventListener('click', handleSelectFolder);
    document.getElementById('btn-continue-local')?.addEventListener('click', handleContinueWithoutFolder);
    document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('btn-link-folder')?.addEventListener('click', handleSelectFolder);
    document.getElementById('btn-unlink-folder')?.addEventListener('click', handleContinueWithoutFolder);
    document.getElementById('sidebar-link-folder')?.addEventListener('click', handleSelectFolder);
    document.getElementById('sidebar-logout')?.addEventListener('click', handleLogout);
    document.getElementById('btn-back-to-dashboard').addEventListener('click', showDashboard);
    document.getElementById('btn-edit-project')?.addEventListener('click', () => openEditProjectModal());
    document.getElementById('btn-delete-project')?.addEventListener('click', () => deleteCurrentProject());
    document.getElementById('mobile-menu-btn')?.addEventListener('click', openMobileSidebar);
    document.getElementById('mobile-overlay')?.addEventListener('click', closeMobileSidebar);
    document.getElementById('btn-notifications')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotificationsPanel();
    });
    document.getElementById('btn-notif-mark-read')?.addEventListener('click', markAllNotificationsRead);
    document.getElementById('btn-notif-clear')?.addEventListener('click', clearNotifications);
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('notifications-panel');
      const btn = document.getElementById('btn-notifications');
      if (!panel || panel.classList.contains('hidden')) return;
      if (panel.contains(e.target) || btn?.contains(e.target)) return;
      toggleNotificationsPanel(false);
    });
    document.getElementById('sidebar-create-project')?.addEventListener('click', () => {
      document.getElementById('btn-create-project').click();
      closeMobileSidebar();
    });
    document.getElementById('nav-dashboard')?.addEventListener('click', (e) => {
      e.preventDefault();
      showDashboard();
      closeMobileSidebar();
    });
    document.getElementById('nav-projects')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await showProjectsWorkspace();
      document.getElementById('projects-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closeMobileSidebar();
    });
    document.getElementById('projects-view-grid')?.addEventListener('click', async () => {
      await setProjectsViewMode('grid');
    });
    document.getElementById('projects-view-list')?.addEventListener('click', async () => {
      await setProjectsViewMode('list');
    });
    document.getElementById('nav-tasks')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await showGlobalWorkspace('tasks');
      closeMobileSidebar();
    });
    document.getElementById('nav-calendar')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await showGlobalWorkspace('calendar');
      closeMobileSidebar();
    });
    document.getElementById('nav-docs')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await showGlobalWorkspace('docs');
      closeMobileSidebar();
    });
    document.getElementById('nav-settings')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await showGlobalWorkspace('settings');
      closeMobileSidebar();
    });

    document.getElementById('search-input')?.addEventListener('input', async (e) => {
      globalSearchQuery = (e.target.value || '').trim();
      if (workspaceMode === 'global') {
        if (globalWorkspaceView === 'tasks') {
          globalTasksPage = 1;
          await renderGlobalTasks();
        }
        if (globalWorkspaceView === 'calendar') await renderGlobalCalendar();
        if (globalWorkspaceView === 'docs') await renderGlobalDocs();
        if (globalWorkspaceView === 'settings') await renderGlobalSettings();
      } else {
        if (workspaceMode === 'dashboard') projectsPage = 1;
        if (workspaceMode === 'project') tasksPage = 1;
        await rerenderCurrentContext();
      }
    });
    document.getElementById('global-task-search')?.addEventListener('input', () => {
      globalTasksPage = 1;
      renderGlobalTasks();
    });
    document.getElementById('global-task-status')?.addEventListener('change', () => {
      globalTasksPage = 1;
      renderGlobalTasks();
    });
    document.getElementById('global-task-theme')?.addEventListener('input', () => {
      globalTasksPage = 1;
      renderGlobalTasks();
    });
    document.getElementById('global-tasks-view-cards')?.addEventListener('click', () => {
      globalTasksViewMode = 'cards';
      localStorage.setItem('taskmda_global_tasks_view', globalTasksViewMode);
      globalTasksPage = 1;
      renderGlobalTasks();
    });
    document.getElementById('global-tasks-view-list')?.addEventListener('click', () => {
      globalTasksViewMode = 'list';
      localStorage.setItem('taskmda_global_tasks_view', globalTasksViewMode);
      globalTasksPage = 1;
      renderGlobalTasks();
    });
    document.getElementById('global-tasks-view-kanban')?.addEventListener('click', () => {
      globalTasksViewMode = 'kanban';
      localStorage.setItem('taskmda_global_tasks_view', globalTasksViewMode);
      renderGlobalTasks();
    });
    document.getElementById('global-tasks-view-timeline')?.addEventListener('click', () => {
      globalTasksViewMode = 'timeline';
      localStorage.setItem('taskmda_global_tasks_view', globalTasksViewMode);
      renderGlobalTasks();
    });
    document.getElementById('global-calendar-search')?.addEventListener('input', () => renderGlobalCalendar());
    document.getElementById('global-calendar-month')?.addEventListener('change', () => {
      globalCalendarSelectedDay = null;
      renderGlobalCalendar();
    });
    document.getElementById('global-calendar-view-list')?.addEventListener('click', () => {
      globalCalendarViewMode = 'list';
      renderGlobalCalendar();
    });
    document.getElementById('global-calendar-view-grid')?.addEventListener('click', () => {
      globalCalendarViewMode = 'grid';
      renderGlobalCalendar();
    });
    document.getElementById('btn-global-calendar-add')?.addEventListener('click', addStandaloneCalendarItem);
    document.getElementById('global-calendar-reset')?.addEventListener('click', () => {
      document.getElementById('global-calendar-search').value = '';
      const base = new Date();
      const month = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
      document.getElementById('global-calendar-month').value = month;
      resetStandaloneCalendarForm();
      globalCalendarSelectedDay = null;
      renderGlobalCalendar();
    });
    document.getElementById('global-doc-search')?.addEventListener('input', () => renderGlobalDocs());
    document.getElementById('global-doc-theme')?.addEventListener('input', () => renderGlobalDocs());
    document.getElementById('global-doc-reset')?.addEventListener('click', () => {
      document.getElementById('global-doc-search').value = '';
      document.getElementById('global-doc-theme').value = '';
      document.getElementById('global-doc-files').value = '';
      document.getElementById('global-doc-mode').value = 'private';
      renderGlobalDocs();
    });
    document.getElementById('btn-global-doc-add')?.addEventListener('click', addStandaloneDocuments);
    document.getElementById('btn-global-theme-add')?.addEventListener('click', createGlobalThemeFromSettings);
    document.getElementById('btn-global-group-add')?.addEventListener('click', createGlobalGroupFromSettings);
    document.getElementById('global-theme-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await createGlobalThemeFromSettings();
      }
    });
    document.getElementById('global-group-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await createGlobalGroupFromSettings();
      }
    });
    document.getElementById('btn-add-member')?.addEventListener('click', addProjectMember);
    document.getElementById('member-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await addProjectMember();
      }
    });
    document.getElementById('btn-send-invite')?.addEventListener('click', addProjectInvite);
    document.getElementById('btn-create-user-group')?.addEventListener('click', createUserGroup);
    document.getElementById('btn-update-user-group')?.addEventListener('click', updateUserGroupSelection);
    document.getElementById('user-group-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await createUserGroup();
      }
    });
    document.getElementById('invite-email-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await addProjectInvite();
      }
    });
    document.getElementById('btn-create-group')?.addEventListener('click', createProjectGroup);
    document.getElementById('group-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await createProjectGroup();
      }
    });
    document.getElementById('btn-add-theme')?.addEventListener('click', addProjectTheme);
    document.getElementById('theme-name-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await addProjectTheme();
      }
    });
    document.getElementById('btn-email-project-status')?.addEventListener('click', () => sendProjectStatusEmail(false));
    document.getElementById('btn-email-project-complete')?.addEventListener('click', () => sendProjectStatusEmail(true));
    document.getElementById('project-mode-work')?.addEventListener('click', () => setProjectDetailMode('work'));
    document.getElementById('project-mode-settings')?.addEventListener('click', () => setProjectDetailMode('settings'));
    document.getElementById('btn-toggle-permissions-details')?.addEventListener('click', () => {
      projectPermissionDetailsOpen = !projectPermissionDetailsOpen;
      renderProjectPermissionMatrix(currentProjectState);
    });

    // Project creation
    document.getElementById('btn-create-project').addEventListener('click', async () => {
      document.getElementById('modal-new-project').classList.remove('hidden');
      document.getElementById('project-name').value = '';
      document.getElementById('project-description-input').value = '';
      document.getElementById('project-status').value = 'en-cours';
      await populateProjectGroupPresetOptions('project-group-presets');
      document.getElementById('project-name').focus();
    });

    document.getElementById('btn-cancel-project').addEventListener('click', () => {
      document.getElementById('modal-new-project').classList.add('hidden');
    });

    // Toggle passphrase section based on sharing mode
    document.querySelectorAll('input[name="sharing-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const passphraseSection = document.getElementById('passphrase-section');
        if (e.target.value === 'shared') {
          passphraseSection.classList.remove('hidden');
        } else {
          passphraseSection.classList.add('hidden');
        }
      });
    });

    // Edit user profile
    document.getElementById('btn-edit-user-name').addEventListener('click', () => {
      const modal = document.getElementById('modal-edit-user-name');
      const nameInput = document.getElementById('edit-user-name-input');
      const photoInput = document.getElementById('profile-photo-input');
      const importInput = document.getElementById('import-user-json-input');
      modal.classList.remove('hidden');
      nameInput.value = currentUser.name;
      nameInput.focus();
      pendingProfilePhotoDataUrl = currentUser.avatarDataUrl || '';
      pendingProfilePhotoDirty = false;
      if (photoInput) photoInput.value = '';
      if (importInput) importInput.value = '';
    });

    document.getElementById('edit-user-name-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-save-user-name').click();
      }
    });

    document.getElementById('profile-photo-input')?.addEventListener('change', async (e) => {
      const file = e?.target?.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image trop lourde (max 2 Mo)');
        e.target.value = '';
        return;
      }
      try {
        pendingProfilePhotoDataUrl = await fileToDataUrl(file);
        pendingProfilePhotoDirty = true;
        showToast('Photo de profil prete a etre enregistree');
      } catch (error) {
        console.error('Error reading profile photo:', error);
        showToast('Impossible de lire la photo');
      }
    });

    document.getElementById('btn-remove-profile-photo')?.addEventListener('click', () => {
      pendingProfilePhotoDataUrl = '';
      pendingProfilePhotoDirty = true;
      const photoInput = document.getElementById('profile-photo-input');
      if (photoInput) photoInput.value = '';
      showToast('La photo sera retiree a l enregistrement');
    });

    document.getElementById('btn-export-user-json')?.addEventListener('click', async () => {
      try {
        await exportUserDataJson();
      } catch (error) {
        console.error('Error exporting user JSON:', error);
        showToast('Erreur export JSON');
      }
    });

    document.getElementById('btn-import-user-json')?.addEventListener('click', () => {
      document.getElementById('import-user-json-input')?.click();
    });

    document.getElementById('import-user-json-input')?.addEventListener('change', async (e) => {
      const file = e?.target?.files?.[0];
      if (!file) return;
      const confirmed = window.confirm('Importer cette sauvegarde remplacera les donnees locales actuelles. Continuer ?');
      if (!confirmed) {
        e.target.value = '';
        return;
      }
      try {
        showLoading(true);
        await importUserDataJsonFromFile(file);
        document.getElementById('modal-edit-user-name').classList.add('hidden');
        showDashboard();
      } catch (error) {
        console.error('Error importing user JSON:', error);
        showToast(error?.message || 'Erreur import JSON');
      } finally {
        e.target.value = '';
        showLoading(false);
      }
    });

    document.getElementById('btn-export-excel')?.addEventListener('click', async () => {
      try {
        await exportProjectsAndTasksCsv();
      } catch (error) {
        console.error('Error exporting Excel CSV:', error);
        showToast('Erreur export Excel');
      }
    });

    document.getElementById('btn-cancel-user-name').addEventListener('click', () => {
      pendingProfilePhotoDirty = false;
      document.getElementById('modal-edit-user-name').classList.add('hidden');
    });
    document.getElementById('btn-cancel-edit-project')?.addEventListener('click', () => {
      editProjectFromDashboard = false;
      document.getElementById('modal-edit-project').classList.add('hidden');
    });
    document.getElementById('btn-save-edit-project')?.addEventListener('click', saveProjectEdits);

    document.getElementById('btn-save-user-name').addEventListener('click', async () => {
      const newName = document.getElementById('edit-user-name-input').value.trim();
      if (!newName) {
        showToast('❌ Le nom est requis');
        document.getElementById('edit-user-name-input').focus();
        return;
      }

      try {
        showLoading(true);

        // Mettre à jour le nom dans currentUser
        currentUser.name = newName;
        if (pendingProfilePhotoDirty) {
          currentUser.avatarDataUrl = pendingProfilePhotoDataUrl || '';
        }

        // Sauvegarder dans IndexedDB (chiffré)
        await putEncrypted('users', currentUser, 'userId');
        await upsertDirectoryUser({
          userId: currentUser.userId,
          name: currentUser.name,
          source: 'user_rename',
          lastSeenAt: Date.now()
        });

        // Sauvegarder dans la config chiffrée
        await saveEncryptedConfig();

        // Mettre à jour l'affichage
        updateUserInfo();

        document.getElementById('modal-edit-user-name').classList.add('hidden');
        pendingProfilePhotoDirty = false;
        showToast('✅ Nom mis à jour');
        showLoading(false);
      } catch (error) {
        console.error('Error updating name:', error);
        showToast('❌ Erreur lors de la mise à jour');
        showLoading(false);
      }
    });

    document.getElementById('btn-save-project').addEventListener('click', async () => {
      const name = document.getElementById('project-name').value.trim();
      if (!name) {
        showToast('❌ Le nom du projet est requis');
        document.getElementById('project-name').focus();
        return;
      }
      const selectedGlobalGroups = readSelectedGlobalGroups('project-group-presets');

      try {
        showLoading(true);

        const projectId = `project-${Date.now()}`;
        const sharingMode = document.querySelector('input[name="sharing-mode"]:checked').value;
        const passphrase = document.getElementById('project-passphrase').value.trim();

        let sharedKey = null;
        let sharedKeyHex = null;

        // Générer/dériver la clé partagée si projet partagé
        if (sharingMode === 'shared') {
          if (passphrase) {
            // Dériver depuis passphrase
            sharedKey = await window.TaskMDACrypto.deriveSharedKeyFromPassphrase(passphrase, projectId);
          } else {
            // Générer aléatoirement
            sharedKey = await window.TaskMDACrypto.generateSharedKey();
          }

          sharedKeyHex = await window.TaskMDACrypto.exportSharedKey(sharedKey);

          // Stocker la clé partagée dans IndexedDB (chiffrée)
          await putEncrypted('sharedKeys', {
            projectId: projectId,
            sharedKey: sharedKeyHex,
            passphrase: passphrase || null,
            createdAt: Date.now()
          }, 'projectId');

          debugLog('Shared key generated for project:', projectId);
        }

        // Create project event
        const createProjectEvent = createEvent(
          EventTypes.CREATE_PROJECT,
          projectId,
          currentUser.userId,
          {
            name: name,
            description: document.getElementById('project-description-input').value.trim(),
            status: document.getElementById('project-status').value,
            sharingMode: sharingMode,
            joinPassphrase: passphrase || null
          }
        );

        await publishEvent(createProjectEvent);

        // Add current user as member
        const addMemberEvent = createEvent(
          EventTypes.ADD_MEMBER,
          projectId,
          currentUser.userId,
          { userId: currentUser.userId, role: 'owner' }
        );

        await publishEvent(addMemberEvent);
        const createGroupEvents = selectedGlobalGroups.map(group => createEvent(
          EventTypes.CREATE_GROUP,
          projectId,
          currentUser.userId,
          { groupId: uuidv4(), name: group.name, description: group.description || '' }
        ));
        for (const event of createGroupEvents) {
          await publishEvent(event);
        }

        // Register for sync ET write to shared folder uniquement si partagé
        if (sharingMode === 'shared') {
          await registerProject(projectId);

          if (sharedFolderHandle) {
            await writeEventToSharedFolder(projectId, createProjectEvent);
            await writeEventToSharedFolder(projectId, addMemberEvent);
            for (const event of createGroupEvents) {
              await writeEventToSharedFolder(projectId, event);
            }

            // Start polling if not already started
            if (!isPolling) {
              startPolling();
            }
          }
        }

        await refreshStats();
        await renderProjects();

        document.getElementById('modal-new-project').classList.add('hidden');
        const modeText = sharingMode === 'private' ? 'privé' : 'partagé et chiffré E2E';
        showToast(`✅ Projet ${modeText} créé !`);
        addNotification('Projet', `Projet ${name} cree (${sharingMode})`, projectId);
        showLoading(false);

        // Ouvrir automatiquement le projet créé
        await showProjectDetail(projectId);
      } catch (error) {
        console.error('Error:', error);
        showToast('❌ Erreur lors de la création du projet');
        showLoading(false);
      }
    });

    // Task modal
    document.getElementById('btn-add-task').addEventListener('click', () => {
      standaloneTaskMode = false;
      openTaskModal();
    });
    document.getElementById('btn-toggle-archived-tasks')?.addEventListener('click', () => {
      archivedTasksExpanded = !archivedTasksExpanded;
      renderArchivedTasks(currentProjectState?.tasks || []);
    });
    document.getElementById('btn-global-add-task')?.addEventListener('click', () => {
      standaloneTaskMode = true;
      openTaskModal();
    });

    document.getElementById('btn-cancel-task').addEventListener('click', () => {
      document.getElementById('modal-new-task').classList.add('hidden');
      editingTaskId = null;
      editingStandaloneTaskId = null;
      standaloneTaskMode = false;
      const standaloneModeInput = document.getElementById('task-standalone-mode');
      if (standaloneModeInput) standaloneModeInput.value = 'private';
      const taskThemeInput = document.getElementById('task-theme');
      const taskGroupInput = document.getElementById('task-group');
      const taskAssigneeManualInput = document.getElementById('task-assignee-manual');
      if (taskThemeInput) taskThemeInput.value = '';
      if (taskGroupInput) taskGroupInput.value = '';
      if (taskAssigneeManualInput) taskAssigneeManualInput.value = '';
    });

    document.getElementById('btn-save-task').addEventListener('click', async () => {
      if (!currentProjectId && !standaloneTaskMode) return;

      const title = document.getElementById('task-title').value.trim();
      if (!title) {
        showToast('❌ Le titre est requis');
        return;
      }

      let attachments = [];
      try {
        attachments = await readTaskFiles();
      } catch (error) {
        showToast(`❌ ${error.message}`);
        return;
      }

      const subtasksText = document.getElementById('task-subtasks').value;
      const subtasksParsed = parseSubtasks(subtasksText);
      const state = standaloneTaskMode ? null : await getProjectState(currentProjectId);
      if (!standaloneTaskMode && !state?.project) {
        showToast('Action non autorisee');
        return;
      }
      const existingTask = (!standaloneTaskMode && editingTaskId)
        ? (state.tasks || []).find(t => t.taskId === editingTaskId)
        : null;
      if (!standaloneTaskMode) {
        if (existingTask) {
          if (!canEditTaskInProject(existingTask, state)) {
            showToast('Action non autorisee');
            return;
          }
        } else if (!canCreateTaskInProject(state)) {
          showToast('Action non autorisee');
          return;
        }
      }

      const groupSelectEl = document.getElementById('task-group');
      const selectedGroupOption = groupSelectEl?.options?.[groupSelectEl.selectedIndex] || null;
      const selectedGroupScope = String(selectedGroupOption?.dataset?.groupScope || '');
      const selectedGroupName = String(selectedGroupOption?.dataset?.groupName || '').trim();
      const rawGroupValue = String(groupSelectEl?.value || '');
      const resolvedGroupId = selectedGroupScope === 'project' ? rawGroupValue || null : null;
      const resolvedGroupName = rawGroupValue ? (selectedGroupName || null) : null;
      const assigneeSelectEl = document.getElementById('task-assignee');
      const manualAssigneeInput = document.getElementById('task-assignee-manual');
      const selectedAssigneeUserIds = Array.from(assigneeSelectEl?.selectedOptions || [])
        .map(opt => String(opt.value || '').trim())
        .filter(Boolean);
      const selectedAssigneesFromMembers = selectedAssigneeUserIds.map((userId) => {
        let name = '';
        if (!standaloneTaskMode) {
          const member = (state?.members || []).find(m => m.userId === userId);
          name = member?.displayName || '';
        } else if (userId === currentUser?.userId) {
          name = currentUser?.name || '';
        }
        if (!name) {
          const option = Array.from(assigneeSelectEl?.options || []).find(opt => opt.value === userId);
          name = String(option?.textContent || '').trim();
        }
        return { userId, name };
      });
      const manualAssigneeNames = parseManualAssigneeNames(manualAssigneeInput?.value || '');
      const seenAssignees = new Set();
      const assignees = [...selectedAssigneesFromMembers, ...manualAssigneeNames.map(name => ({ userId: null, name }))]
        .filter((entry) => entry.userId || entry.name)
        .filter((entry) => {
          const key = `${entry.userId || ''}|${normalizeSearch(entry.name || '')}`;
          if (seenAssignees.has(key)) return false;
          seenAssignees.add(key);
          return true;
        });
      const primaryAssignee = assignees[0] || { userId: null, name: '' };

      const payload = {
        title: title,
        assignee: primaryAssignee.name || '',
        assigneeUserId: primaryAssignee.userId || null,
        assignees,
        description: document.getElementById('task-description').value.trim(),
        requestDate: document.getElementById('task-request-date').value || null,
        dueDate: document.getElementById('task-due-date').value || null,
        status: document.getElementById('task-status').value,
        urgency: document.getElementById('task-urgency').value,
        theme: (document.getElementById('task-theme')?.value || '').trim(),
        groupId: resolvedGroupId,
        groupName: resolvedGroupName,
        subtasks: existingTask
          ? mergeSubtasksWithExisting(existingTask.subtasks || [], subtasksParsed)
          : subtasksParsed
      };

      if (existingTask) {
        payload.subtasks = mergeSubtasksWithExisting(existingTask.subtasks || [], subtasksParsed);
        if (attachments.length > 0) {
          payload.attachments = [...(existingTask.attachments || []), ...attachments];
        }
      } else {
        payload.attachments = attachments;
      }

      if (standaloneTaskMode) {
        const standaloneSharingMode = normalizeSharingMode(
          document.getElementById('task-standalone-mode')?.value || 'private',
          'private'
        );
        const isEditStandalone = Boolean(editingStandaloneTaskId);
        const existingStandalone = isEditStandalone
          ? await getDecrypted('globalTasks', editingStandaloneTaskId, 'id')
          : null;
        const mergedStandaloneSubtasks = isEditStandalone
          ? mergeSubtasksWithExisting(existingStandalone?.subtasks || [], subtasksParsed)
          : subtasksParsed;
        const standaloneTask = {
          id: isEditStandalone ? editingStandaloneTaskId : uuidv4(),
          title: payload.title,
          assignee: payload.assignee,
          assigneeUserId: payload.assigneeUserId,
          assignees: payload.assignees || [],
          description: payload.description,
          requestDate: payload.requestDate,
          dueDate: payload.dueDate,
          status: payload.status,
          urgency: payload.urgency,
          subtasks: mergedStandaloneSubtasks,
          attachments: attachments.length > 0
            ? ([...(existingStandalone?.attachments || []), ...attachments])
            : (existingStandalone?.attachments || payload.attachments || []),
          theme: payload.theme || document.getElementById('global-task-theme')?.value?.trim() || 'General',
          groupId: payload.groupId || null,
          groupName: payload.groupName || null,
          sharingMode: standaloneSharingMode,
          createdAt: existingStandalone?.createdAt || Date.now(),
          updatedAt: Date.now(),
          archivedAt: existingStandalone?.archivedAt || null
        };
        await putEncrypted('globalTasks', standaloneTask, 'id');
        document.getElementById('modal-new-task').classList.add('hidden');
        if (standaloneSharingMode === 'shared' && !sharedFolderHandle) {
          showToast('Mode collaboratif actif: connectez un dossier partagé pour synchroniser.');
        }
        showToast(isEditStandalone ? '✅ Tâche hors projet mise à jour' : '✅ Tâche hors projet créée');
        addNotification('Tache', isEditStandalone ? 'Tache hors projet mise a jour' : 'Nouvelle tache hors projet creee', null, {
          targetType: 'task',
          targetId: standaloneTask.id,
          targetView: 'global-tasks',
          linkLabel: 'Ouvrir les tâches'
        });
        standaloneTaskMode = false;
        editingStandaloneTaskId = null;
        await renderGlobalTasks();
        await refreshStats();
        return;
      }

      const event = editingTaskId
        ? createEvent(
            EventTypes.UPDATE_TASK,
            currentProjectId,
            currentUser.userId,
            { taskId: editingTaskId, changes: payload }
          )
        : createEvent(
            EventTypes.CREATE_TASK,
            currentProjectId,
            currentUser.userId,
            { taskId: uuidv4(), createdBy: currentUser.userId, ...payload }
          );

      await publishEvent(event);

      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, event);
      }

      document.getElementById('modal-new-task').classList.add('hidden');
      showToast(editingTaskId ? '✅ Tâche mise à jour' : '✅ Tâche créée');
      editingTaskId = null;
      addNotification('Tache', event.type === EventTypes.UPDATE_TASK ? 'Tache mise a jour' : 'Nouvelle tache creee', currentProjectId, {
        targetType: 'task',
        targetId: event.payload?.taskId || null,
        targetView: 'list',
        linkLabel: 'Ouvrir la tâche'
      });
      await showProjectDetail(currentProjectId);
    });

    // Send message
    document.getElementById('btn-send-message').addEventListener('click', async () => {
      await sendMessage();
    });

    document.getElementById('message-input').addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        await sendMessage();
      }
    });

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.getElementById('modal-new-project').classList.add('hidden');
        document.getElementById('modal-new-task').classList.add('hidden');
        document.getElementById('modal-edit-user-name').classList.add('hidden');
        pendingProfilePhotoDirty = false;
        document.getElementById('modal-edit-project').classList.add('hidden');
        editProjectFromDashboard = false;
        document.getElementById('modal-doc-preview').classList.add('hidden');
        toggleNotificationsPanel(false);
        toggleEmojiPicker(false);
        editingTaskId = null;
        editingStandaloneTaskId = null;
        closeMobileSidebar();
      }
    });

    // Close modals on overlay click
    document.getElementById('modal-new-project').addEventListener('click', (e) => {
      if (e.target.id === 'modal-new-project') {
        document.getElementById('modal-new-project').classList.add('hidden');
      }
    });

    document.getElementById('modal-new-task').addEventListener('click', (e) => {
      if (e.target.id === 'modal-new-task') {
        document.getElementById('modal-new-task').classList.add('hidden');
        editingTaskId = null;
        editingStandaloneTaskId = null;
      }
    });

    document.getElementById('modal-edit-user-name').addEventListener('click', (e) => {
      if (e.target.id === 'modal-edit-user-name') {
        document.getElementById('modal-edit-user-name').classList.add('hidden');
        pendingProfilePhotoDirty = false;
      }
    });
    document.getElementById('modal-edit-project')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-edit-project') {
        editProjectFromDashboard = false;
        document.getElementById('modal-edit-project').classList.add('hidden');
      }
    });

    // Project views
    document.getElementById('view-list').addEventListener('click', () => setProjectView('list'));
    document.getElementById('view-kanban').addEventListener('click', () => setProjectView('kanban'));
    document.getElementById('view-timeline').addEventListener('click', () => setProjectView('timeline'));
    document.getElementById('view-docs').addEventListener('click', () => setProjectView('docs'));
    document.getElementById('view-chat').addEventListener('click', () => setProjectView('chat'));
    document.getElementById('view-activity').addEventListener('click', async () => {
      if (!canReadProjectActivity(currentProjectState)) {
        showToast('Action non autorisee');
        setProjectView('list');
        return;
      }
      setProjectView('activity');
      if (!currentProjectId) return;
      currentProjectEvents = await getProjectEvents(currentProjectId);
      await renderActivity(currentProjectEvents);
    });

    const orderedViews = ['list', 'kanban', 'timeline', 'docs', 'chat', 'activity'];
    orderedViews.forEach((viewKey, idx) => {
      const btn = document.getElementById(`view-${viewKey === 'docs' ? 'docs' : viewKey}`);
      if (!btn) return;
      btn.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const nextIdx = e.key === 'ArrowRight'
          ? (idx + 1) % orderedViews.length
          : (idx - 1 + orderedViews.length) % orderedViews.length;
        let nextKey = orderedViews[nextIdx];
        if (nextKey === 'activity' && !canReadProjectActivity(currentProjectState)) {
          nextKey = 'list';
        }
        const nextBtn = document.getElementById(`view-${nextKey === 'docs' ? 'docs' : nextKey}`);
        if (nextBtn) {
          nextBtn.focus();
          setProjectView(nextKey);
        }
      });
    });

    document.getElementById('timeline-filter-all')?.addEventListener('click', () => {
      timelineFilter = 'all';
      renderTimeline(currentProjectState?.tasks || []);
    });
    document.getElementById('timeline-filter-milestone')?.addEventListener('click', () => {
      timelineFilter = 'milestone';
      renderTimeline(currentProjectState?.tasks || []);
    });
    document.getElementById('timeline-filter-urgent')?.addEventListener('click', () => {
      timelineFilter = 'urgent';
      renderTimeline(currentProjectState?.tasks || []);
    });
    document.getElementById('timeline-filter-overdue')?.addEventListener('click', () => {
      timelineFilter = 'overdue';
      renderTimeline(currentProjectState?.tasks || []);
    });
    document.getElementById('calendar-prev-month')?.addEventListener('click', () => {
      calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
      calendarDayFilterEnabled = false;
      renderCalendar(currentProjectState?.tasks || []);
      renderTimeline(currentProjectState?.tasks || []);
    });
    document.getElementById('calendar-next-month')?.addEventListener('click', () => {
      calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
      calendarDayFilterEnabled = false;
      renderCalendar(currentProjectState?.tasks || []);
      renderTimeline(currentProjectState?.tasks || []);
    });
    document.getElementById('calendar-today')?.addEventListener('click', () => {
      calendarCursor = new Date();
      selectedCalendarDayKey = toYmd(new Date());
      calendarDayFilterEnabled = false;
      renderCalendar(currentProjectState?.tasks || []);
      renderTimeline(currentProjectState?.tasks || []);
    });

    document.getElementById('btn-toggle-message-preview')?.addEventListener('click', () => {
      messagePreviewEnabled = !messagePreviewEnabled;
      const preview = document.getElementById('message-preview');
      const toggle = document.getElementById('btn-toggle-message-preview');
      if (!preview) return;
      preview.classList.toggle('hidden', !messagePreviewEnabled);
      if (toggle) {
        toggle.textContent = messagePreviewEnabled ? 'Masquer aperçu' : 'Aperçu';
      }
      if (messagePreviewEnabled) {
        preview.innerHTML = renderSafeMarkdown(document.getElementById('message-input').value);
      }
    });

    document.getElementById('message-input')?.addEventListener('input', () => {
      if (!messagePreviewEnabled) return;
      const preview = document.getElementById('message-preview');
      if (preview) {
        preview.innerHTML = renderSafeMarkdown(document.getElementById('message-input').value);
      }
    });
    document.getElementById('btn-toggle-emoji-picker')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleEmojiPicker();
    });
    document.getElementById('emoji-picker-panel')?.addEventListener('click', (e) => {
      const button = e.target.closest('[data-emoji]');
      if (!button) return;
      const input = document.getElementById('message-input');
      insertTextAtCursor(input, button.dataset.emoji || '');
    });
    document.addEventListener('click', (e) => {
      if (!emojiPickerOpen) return;
      const panel = document.getElementById('emoji-picker-panel');
      const trigger = document.getElementById('btn-toggle-emoji-picker');
      const target = e.target;
      if (panel?.contains(target) || trigger?.contains(target)) return;
      toggleEmojiPicker(false);
    });
    document.getElementById('chat-search-input')?.addEventListener('input', () => {
      messageFilters.query = document.getElementById('chat-search-input').value || '';
      renderMessages(currentProjectState?.messages || []);
    });
    document.getElementById('chat-filter-mine')?.addEventListener('change', () => {
      messageFilters.onlyMine = !!document.getElementById('chat-filter-mine').checked;
      renderMessages(currentProjectState?.messages || []);
    });
    document.getElementById('chat-filter-reset')?.addEventListener('click', () => {
      messageFilters = { query: '', onlyMine: false };
      document.getElementById('chat-search-input').value = '';
      document.getElementById('chat-filter-mine').checked = false;
      renderMessages(currentProjectState?.messages || []);
    });
    document.getElementById('message-files')?.addEventListener('change', () => {
      const input = document.getElementById('message-files');
      const list = document.getElementById('message-files-list');
      if (!input || !list) return;
      const files = Array.from(input.files || []);
      if (files.length === 0) {
        list.textContent = 'Aucun fichier sélectionné';
        return;
      }
      list.textContent = files.map(f => `${f.name} (${formatFileSize(f.size)})`).join(' • ');
    });

    document.getElementById('activity-filter-type')?.addEventListener('change', async (e) => {
      activityFilters.type = e.target.value;
      await renderActivity(currentProjectEvents);
    });
    document.getElementById('activity-filter-author')?.addEventListener('input', async (e) => {
      activityFilters.author = e.target.value;
      await renderActivity(currentProjectEvents);
    });
    document.getElementById('activity-filter-period')?.addEventListener('change', async (e) => {
      activityFilters.period = e.target.value;
      await renderActivity(currentProjectEvents);
    });
    document.getElementById('activity-filter-reset')?.addEventListener('click', async () => {
      activityFilters = { type: 'all', author: '', period: 'all' };
      document.getElementById('activity-filter-type').value = 'all';
      document.getElementById('activity-filter-author').value = '';
      document.getElementById('activity-filter-period').value = 'all';
      await renderActivity(currentProjectEvents);
    });

    document.getElementById('docs-search-input')?.addEventListener('input', () => {
      docsFilters.query = document.getElementById('docs-search-input').value || '';
      renderDocuments(currentProjectState?.tasks || []);
    });
    document.getElementById('docs-type-filter')?.addEventListener('change', () => {
      docsFilters.type = document.getElementById('docs-type-filter').value || 'all';
      renderDocuments(currentProjectState?.tasks || []);
    });
    document.getElementById('docs-sort')?.addEventListener('change', () => {
      docsFilters.sort = document.getElementById('docs-sort').value || 'recent';
      renderDocuments(currentProjectState?.tasks || []);
    });
    document.getElementById('docs-filter-reset')?.addEventListener('click', () => {
      docsFilters = { query: '', type: 'all', sort: 'recent' };
      document.getElementById('docs-search-input').value = '';
      document.getElementById('docs-type-filter').value = 'all';
      document.getElementById('docs-sort').value = 'recent';
      renderDocuments(currentProjectState?.tasks || []);
    });
    document.getElementById('btn-close-doc-preview')?.addEventListener('click', closeDocumentPreview);
    document.getElementById('modal-doc-preview')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-doc-preview') {
        closeDocumentPreview();
      }
    });

    async function readTaskFiles() {
      const input = document.getElementById('task-files');
      const shareToDocs = document.getElementById('task-share-docs').checked;
      const files = Array.from(input.files || []);
      const maxFileSize = 5 * 1024 * 1024;

      const attachments = [];
      for (const file of files) {
        if (file.size > maxFileSize) {
          throw new Error(`Le fichier "${file.name}" dépasse 5 Mo`);
        }
        const data = await fileToDataUrl(file);
        attachments.push({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          shareToDocs,
          data
        });
      }
      return attachments;
    }

    async function readMessageFiles() {
      const input = document.getElementById('message-files');
      const files = Array.from(input?.files || []);
      const maxFileSize = 3 * 1024 * 1024;

      const attachments = [];
      for (const file of files) {
        if (file.size > maxFileSize) {
          throw new Error(`Le fichier "${file.name}" dépasse 3 Mo`);
        }
        const data = await fileToDataUrl(file);
        attachments.push({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          data
        });
      }
      return attachments;
    }

    function fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Impossible de lire le fichier "${file.name}"`));
        reader.readAsDataURL(file);
      });
    }

    function insertTextAtCursor(input, text) {
      if (!input) return;
      const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
      const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
      const before = input.value.slice(0, start);
      const after = input.value.slice(end);
      input.value = `${before}${text}${after}`;
      const nextPos = start + text.length;
      input.selectionStart = nextPos;
      input.selectionEnd = nextPos;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }

    function renderEmojiPicker() {
      const panel = document.getElementById('emoji-picker-panel');
      if (!panel || panel.dataset.ready === '1') return;
      panel.innerHTML = chatEmojiPalette
        .map((emoji) => `<button type="button" class="emoji-picker-btn" data-emoji="${emoji}" aria-label="Insérer ${emoji}">${emoji}</button>`)
        .join('');
      panel.dataset.ready = '1';
    }

    function toggleEmojiPicker(forceOpen) {
      const panel = document.getElementById('emoji-picker-panel');
      const toggle = document.getElementById('btn-toggle-emoji-picker');
      if (!panel) return;
      const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !emojiPickerOpen;
      emojiPickerOpen = nextOpen;
      panel.classList.toggle('hidden', !nextOpen);
      if (toggle) {
        toggle.classList.toggle('bg-primary', nextOpen);
        toggle.classList.toggle('text-white', nextOpen);
        toggle.classList.toggle('bg-slate-100', !nextOpen);
        toggle.classList.toggle('text-slate-700', !nextOpen);
      }
      if (nextOpen) {
        renderEmojiPicker();
      }
    }

    async function sendMessage() {
      if (!currentProjectId) return;
      const state = await getProjectState(currentProjectId);
      if (!state?.project || !canSendProjectMessage(state)) {
        showToast('Action non autorisee');
        return;
      }

      const input = document.getElementById('message-input');
      const filesInput = document.getElementById('message-files');
      const filesList = document.getElementById('message-files-list');
      const content = input.value.trim();
      let attachments = [];

      try {
        attachments = await readMessageFiles();
      } catch (error) {
        showToast(`❌ ${error.message}`);
        return;
      }

      if (!content && attachments.length === 0) return;

      const event = createEvent(
        EventTypes.SEND_MESSAGE,
        currentProjectId,
        currentUser.userId,
        {
          content: content,
          authorName: currentUser.name,
          attachments
        }
      );

      await publishEvent(event);

      if (sharedFolderHandle) {
        await writeEventToSharedFolder(currentProjectId, event);
      }
      addNotification('Message', attachments.length > 0 ? 'Message envoye avec pieces jointes' : 'Nouveau message envoye', currentProjectId, {
        targetType: 'message',
        targetId: event.eventId,
        targetView: 'chat',
        linkLabel: 'Ouvrir le message'
      });

      input.value = '';
      toggleEmojiPicker(false);
      if (filesInput) filesInput.value = '';
      if (filesList) filesList.textContent = 'Aucun fichier sélectionné';
      const preview = document.getElementById('message-preview');
      if (preview) {
        preview.innerHTML = '';
      }
      await showProjectDetail(currentProjectId);
    }

    // ============================================================================
    // STARTUP
    // ============================================================================

    function startApp() {
      initTheme();
      if (!checkDependencies()) {
        return;
      }

      // Initialize crypto UI
      if (window.TaskMDACrypto) {
        window.TaskMDACrypto.initCryptoUI();

        // Check if encrypted data exists
        const hasSalt = window.TaskMDACrypto.hasSalt();

        if (hasSalt) {
          // User has already set a password - show unlock screen
          window.TaskMDACrypto.showLockScreen('unlock');

          // Setup unlock button
          const lockBtn = document.getElementById('lockBtn');
          if (lockBtn) {
            lockBtn.onclick = () => {
              window.TaskMDACrypto.submitPassword(async (result) => {
                // Password verified, initialize app
                await initApp();
              });
            };
          }
        } else {
          // First time - create password
          window.TaskMDACrypto.showLockScreen('create');

          // Setup create button
          const lockBtn = document.getElementById('lockBtn');
          if (lockBtn) {
            lockBtn.onclick = () => {
              window.TaskMDACrypto.submitPassword(async (result) => {
                if (result.isNewUser) {
                  // New password created, initialize app
                  await initApp();
                }
              });
            };
          }
        }
      } else {
        // Crypto module not available, start without encryption
        console.warn('⚠️ Crypto module not loaded, starting without encryption');
        initApp();
      }
    }

    // Démarrer l'application
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startApp);
    } else {
      startApp();
    }

    debugLog('TaskMDA Team loaded');
