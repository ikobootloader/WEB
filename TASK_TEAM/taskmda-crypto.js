// ══════════════════════════════════════════════════════════════
//  TASKMDA CRYPTO MODULE - AES-256-GCM Encryption
//  Chiffrement local des métadonnées utilisateur
//  Compatible avec TaskMDA Team Standalone
// ══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTES
  // ============================================================================

  const STORAGE_KEY_ENCRYPTED = 'taskmda-team-encrypted-data';
  const SALT_KEY = 'taskmda-team-salt';
  const RECOVERY_KEY_BLOB = 'taskmda-team-recovery-blob';
  const ITER_COUNT = 310_000; // PBKDF2 iterations (OWASP 2024)

  let cryptoKey = null; // Clé de chiffrement en mémoire uniquement

  // ============================================================================
  // CRYPTO — PBKDF2 → AES-256-GCM
  // ============================================================================

  async function deriveKey(password, salt) {
    const raw = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITER_COUNT, hash: 'SHA-256' },
      raw,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async function deriveRecoveryKey(recoveryCode, salt) {
    const raw = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(String(recoveryCode || '').trim()),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
      raw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(data) {
    if (!cryptoKey) throw new Error('Crypto key not initialized');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      new TextEncoder().encode(JSON.stringify(data))
    );
    return bufToHex(iv) + ':' + bufToHex(new Uint8Array(ct));
  }

  async function decrypt(stored) {
    if (!cryptoKey) throw new Error('Crypto key not initialized');
    const [ivHex, ctHex] = stored.split(':');
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBuf(ivHex) },
      cryptoKey,
      hexToBuf(ctHex)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function encryptWithAesKey(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = new TextEncoder().encode(JSON.stringify(data));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
    return { iv: bufToHex(iv), ct: bufToHex(new Uint8Array(ct)) };
  }

  async function decryptWithAesKey(stored, key) {
    const iv = hexToBuf(stored.iv || '');
    const ct = hexToBuf(stored.ct || '');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function generateRecoveryCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 3) {
      chunks.push(Array.from(bytes.slice(i, i + 3)).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase());
    }
    return chunks.join('-');
  }

  async function setupRecoveryForCurrentKey() {
    if (!cryptoKey) throw new Error('Crypto key not initialized');
    const recoveryCode = generateRecoveryCode();
    const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
    const recoveryKey = await deriveRecoveryKey(recoveryCode, recoverySalt);
    const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);
    const wrapped = await encryptWithAesKey({
      keyHex: bufToHex(new Uint8Array(rawKey))
    }, recoveryKey);
    localStorage.setItem(RECOVERY_KEY_BLOB, JSON.stringify({
      version: 1,
      saltHex: bufToHex(recoverySalt),
      wrapped
    }));
    return recoveryCode;
  }

  async function rotatePassword(newPassword) {
    if (!cryptoKey) throw new Error('Crypto key not initialized');
    const pwd = String(newPassword || '');
    if (pwd.length < 4) throw new Error('Le mot de passe doit contenir au moins 4 caractères');
    const payload = await loadEncryptedData();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const nextKey = await deriveKey(pwd, salt);
    localStorage.setItem(SALT_KEY, bufToHex(salt));
    cryptoKey = nextKey;
    await saveEncryptedData(payload || { config: {}, version: '1.0-encrypted', updatedAt: Date.now() });
    const recoveryCode = await setupRecoveryForCurrentKey();
    return { recoveryCode };
  }

  async function recoverAccessWithRecoveryCode(recoveryCode, newPassword) {
    const blobRaw = localStorage.getItem(RECOVERY_KEY_BLOB);
    if (!blobRaw) throw new Error('Aucune clé de récupération enregistrée');
    const blob = JSON.parse(blobRaw);
    const recoverySalt = hexToBuf(String(blob?.saltHex || ''));
    const recoveryKey = await deriveRecoveryKey(recoveryCode, recoverySalt);
    const unwrapped = await decryptWithAesKey(blob.wrapped, recoveryKey);
    const rawHex = String(unwrapped?.keyHex || '').trim();
    if (!rawHex) throw new Error('Clé de récupération invalide');
    const recoveredKey = await crypto.subtle.importKey(
      'raw',
      hexToBuf(rawHex),
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
    cryptoKey = recoveredKey;
    await loadEncryptedData();
    return await rotatePassword(newPassword);
  }

  async function verifyPassword(password) {
    const saltHex = localStorage.getItem(SALT_KEY);
    if (!saltHex) return false;
    const encrypted = localStorage.getItem(STORAGE_KEY_ENCRYPTED);
    if (!encrypted) return false;
    try {
      const testKey = await deriveKey(password, hexToBuf(saltHex));
      const [ivHex, ctHex] = encrypted.split(':');
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBuf(ivHex) },
        testKey,
        hexToBuf(ctHex)
      );
      return true;
    } catch {
      return false;
    }
  }

  const bufToHex = b => Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');

  function hexToBuf(h) {
    const a = new Uint8Array(h.length/2);
    for (let i=0; i<a.length; i++) a[i]=parseInt(h.slice(i*2,i*2+2),16);
    return a;
  }

  // ============================================================================
  // STOCKAGE CHIFFRÉ
  // ============================================================================

  async function saveEncryptedData(dataToEncrypt) {
    if (!cryptoKey) {
      console.error('Cannot save: crypto key not initialized');
      return;
    }

    const encrypted = await encrypt(dataToEncrypt);
    localStorage.setItem(STORAGE_KEY_ENCRYPTED, encrypted);
  }

  async function loadEncryptedData() {
    const encrypted = localStorage.getItem(STORAGE_KEY_ENCRYPTED);
    if (!encrypted) {
      return null; // Pas de données chiffrées
    }

    return await decrypt(encrypted);
  }

  // ============================================================================
  // ÉCRAN DE VERROUILLAGE
  // ============================================================================

  function showLockScreen(mode) {
    const screen = document.getElementById('lockScreen');
    if (!screen) {
      console.error('Lock screen element not found');
      return;
    }

    screen.dataset.mode = mode;

    const lockError = document.getElementById('lockError');
    if (lockError) {
      lockError.textContent = '';
      lockError.classList.add('hidden');
    }

    const lockPassword = document.getElementById('lockPassword');
    const lockConfirm = document.getElementById('lockConfirm');

    if (lockPassword) lockPassword.value = '';
    if (lockConfirm) lockConfirm.value = '';

    const lockBtn = document.getElementById('lockBtn');
    const lockIcon = lockBtn?.querySelector('.material-symbols-outlined');
    const lockText = lockBtn?.querySelector('span:last-child');
    const forgotBtn = document.getElementById('lockForgotBtn');

    if (mode === 'create') {
      const lockTitle = document.getElementById('lockTitle');
      const lockSub = document.getElementById('lockSub');
      const lockConfirmWrap = document.getElementById('lockConfirmWrap');

      if (lockTitle) lockTitle.textContent = 'Créer un mot de passe';
      if (lockSub) lockSub.textContent = 'Vos données seront chiffrées (AES-256-GCM). Sans ce mot de passe, elles sont illisibles.';
      if (lockConfirmWrap) lockConfirmWrap.classList.remove('hidden');
      if (lockIcon) lockIcon.textContent = 'lock_open';
      if (lockText) lockText.textContent = 'Créer & déverrouiller';
      if (forgotBtn) forgotBtn.classList.add('hidden');
    } else {
      const lockTitle = document.getElementById('lockTitle');
      const lockSub = document.getElementById('lockSub');
      const lockConfirmWrap = document.getElementById('lockConfirmWrap');

      if (lockTitle) lockTitle.textContent = 'Déverrouiller';
      if (lockSub) lockSub.textContent = 'Entrez votre mot de passe pour déchiffrer vos données localement.';
      if (lockConfirmWrap) lockConfirmWrap.classList.add('hidden');
      if (lockIcon) lockIcon.textContent = 'lock_open';
      if (lockText) lockText.textContent = 'Déverrouiller';
      if (forgotBtn) forgotBtn.classList.remove('hidden');
    }

    screen.classList.remove('hidden');
    screen.classList.add('flex');
    setTimeout(() => lockPassword?.focus(), 150);
  }

  function hideLockScreen() {
    const screen = document.getElementById('lockScreen');
    if (screen) {
      screen.classList.add('hidden');
      screen.classList.remove('flex');
    }
  }

  async function submitPassword(onSuccess) {
    const lockError = document.getElementById('lockError');
    const lockPassword = document.getElementById('lockPassword');
    const lockConfirm = document.getElementById('lockConfirm');
    const lockScreen = document.getElementById('lockScreen');

    if (!lockPassword || !lockScreen) {
      console.error('Lock screen elements not found');
      return;
    }

    const pwd = lockPassword.value;
    const mode = lockScreen.dataset.mode;

    if (pwd.length < 4) {
      if (lockError) {
        lockError.textContent = '❌ Le mot de passe doit contenir au moins 4 caractères';
        lockError.classList.remove('hidden');
      }
      return;
    }

    if (mode === 'create') {
      const confirm = lockConfirm?.value || '';
      if (pwd !== confirm) {
        if (lockError) {
          lockError.textContent = '❌ Les mots de passe ne correspondent pas';
          lockError.classList.remove('hidden');
        }
        return;
      }

      // Create new encryption key
      const salt = crypto.getRandomValues(new Uint8Array(16));
      localStorage.setItem(SALT_KEY, bufToHex(salt));
      cryptoKey = await deriveKey(pwd, salt);

      // Initialize empty encrypted storage
      await saveEncryptedData({
        config: {},
        version: '1.0-encrypted',
        createdAt: Date.now()
      });

      const recoveryCode = await setupRecoveryForCurrentKey();

      hideLockScreen();

      // Call success callback if provided
      if (typeof onSuccess === 'function') {
        onSuccess({ isNewUser: true, recoveryCode });
      }
    } else {
      // Unlock existing data
      const saltHex = localStorage.getItem(SALT_KEY);
      if (!saltHex) {
        if (lockError) {
          lockError.textContent = '❌ Aucune donnée chiffrée trouvée';
          lockError.classList.remove('hidden');
        }
        return;
      }

      try {
        const salt = hexToBuf(saltHex);
        cryptoKey = await deriveKey(pwd, salt);

        // Try to decrypt data to verify password
        const decryptedData = await loadEncryptedData();

        hideLockScreen();

        // Call success callback if provided
        if (typeof onSuccess === 'function') {
          onSuccess({ isNewUser: false, data: decryptedData });
        }
      } catch (e) {
        console.error('Decryption error:', e);
        if (lockError) {
          lockError.textContent = '❌ Mot de passe incorrect';
          lockError.classList.remove('hidden');
        }
        cryptoKey = null;
      }
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  function initCryptoUI() {
    // Toggle password visibility
    const toggleBtn = document.getElementById('toggleLockPassword');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const input = document.getElementById('lockPassword');
        const icon = toggleBtn.querySelector('.material-symbols-outlined');
        if (input && icon) {
          if (input.type === 'password') {
            input.type = 'text';
            icon.textContent = 'visibility_off';
          } else {
            input.type = 'password';
            icon.textContent = 'visibility';
          }
        }
      });
    }

    // Enter key support on password field
    const lockPassword = document.getElementById('lockPassword');
    if (lockPassword) {
      lockPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const mode = document.getElementById('lockScreen')?.dataset.mode;
          if (mode === 'create') {
            document.getElementById('lockConfirm')?.focus();
          } else {
            document.getElementById('lockBtn')?.click();
          }
        }
      });
    }

    // Enter key support on confirm field
    const lockConfirm = document.getElementById('lockConfirm');
    if (lockConfirm) {
      lockConfirm.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('lockBtn')?.click();
        }
      });
    }

    const forgotBtn = document.getElementById('lockForgotBtn');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', async () => {
        try {
          const code = window.prompt('Saisissez votre clé de récupération');
          if (!code) return;
          const newPwd = window.prompt('Nouveau mot de passe (min 4 caractères)');
          if (!newPwd) return;
          const confirmPwd = window.prompt('Confirmez le nouveau mot de passe');
          if (!confirmPwd) return;
          if (newPwd !== confirmPwd) {
            const lockError = document.getElementById('lockError');
            if (lockError) {
              lockError.textContent = '❌ Les mots de passe ne correspondent pas';
              lockError.classList.remove('hidden');
            }
            return;
          }
          const result = await recoverAccessWithRecoveryCode(code, newPwd);
          alert(`Accès restauré. Nouvelle clé de récupération:\n\n${result.recoveryCode}\n\nConservez-la hors ligne.`);
          hideLockScreen();
          window.dispatchEvent(new CustomEvent('taskmda-crypto-recovered'));
        } catch (error) {
          const lockError = document.getElementById('lockError');
          if (lockError) {
            lockError.textContent = '❌ Clé de récupération invalide';
            lockError.classList.remove('hidden');
          }
        }
      });
    }
  }

  // ============================================================================
  // CHIFFREMENT INDEXEDDB
  // ============================================================================

  /**
   * Chiffre un objet pour IndexedDB
   * Conserve l'ID en clair pour l'indexation, chiffre le reste dans _encrypted
   */
  async function encryptForDB(obj, idField) {
    if (!cryptoKey) {
      throw new Error('Crypto key not initialized');
    }

    const id = obj[idField];
    if (!id) {
      throw new Error(`Missing ID field: ${idField}`);
    }

    // Créer une copie pour ne pas modifier l'original
    const toEncrypt = { ...obj };
    delete toEncrypt[idField];

    const encrypted = await encrypt(toEncrypt);

    return {
      [idField]: id,
      _encrypted: encrypted,
      _isEncrypted: true
    };
  }

  /**
   * Déchiffre un objet depuis IndexedDB
   */
  async function decryptFromDB(obj, idField) {
    if (!obj) return null;

    // Si l'objet n'est pas chiffré, le retourner tel quel (compatibilité)
    if (!obj._isEncrypted) {
      return obj;
    }

    if (!cryptoKey) {
      throw new Error('Crypto key not initialized - cannot decrypt');
    }

    const decrypted = await decrypt(obj._encrypted);
    decrypted[idField] = obj[idField];

    return decrypted;
  }

  // ============================================================================
  // CHIFFREMENT E2E POUR PROJETS PARTAGÉS
  // ============================================================================

  /**
   * Génère une nouvelle clé de partage pour un projet
   */
  async function generateSharedKey() {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Exporte une clé de partage en hex
   */
  async function exportSharedKey(key) {
    const raw = await crypto.subtle.exportKey('raw', key);
    return bufToHex(new Uint8Array(raw));
  }

  /**
   * Importe une clé de partage depuis hex
   */
  async function importSharedKey(hexKey) {
    const raw = hexToBuf(hexKey);
    return await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Dérive une clé de partage depuis une passphrase
   * Utilise projectId comme salt pour garantir une clé unique par projet
   */
  async function deriveSharedKeyFromPassphrase(passphrase, projectId) {
    const salt = new TextEncoder().encode(projectId);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Chiffre des données avec une clé partagée
   */
  async function encryptWithSharedKey(data, sharedKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      new TextEncoder().encode(JSON.stringify(data))
    );
    return bufToHex(iv) + ':' + bufToHex(new Uint8Array(encrypted));
  }

  /**
   * Déchiffre des données avec une clé partagée
   */
  async function decryptWithSharedKey(encrypted, sharedKey) {
    const [ivHex, ctHex] = encrypted.split(':');
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBuf(ivHex) },
      sharedKey,
      hexToBuf(ctHex)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  // ============================================================================
  // API PUBLIQUE
  // ============================================================================

  window.TaskMDACrypto = {
    // Fonctions de chiffrement localStorage
    saveEncryptedData,
    loadEncryptedData,

    // Fonctions de chiffrement IndexedDB
    encryptForDB,
    decryptFromDB,

    // Fonctions bas niveau (pour usage avancé)
    encrypt,
    decrypt,

    // Gestion de l'écran de verrouillage
    showLockScreen,
    hideLockScreen,
    submitPassword,
    rotatePassword,
    setupRecoveryForCurrentKey,
    recoverAccessWithRecoveryCode,
    verifyPassword,

    // Initialisation de l'UI
    initCryptoUI,

    // Vérifier si des données chiffrées existent
    hasEncryptedData() {
      return !!localStorage.getItem(STORAGE_KEY_ENCRYPTED);
    },

    // Vérifier si un salt existe (= mot de passe configuré)
    hasSalt() {
      return !!localStorage.getItem(SALT_KEY);
    },

    hasRecoveryKey() {
      return !!localStorage.getItem(RECOVERY_KEY_BLOB);
    },

    // Vérifier si la clé crypto est initialisée
    isUnlocked() {
      return cryptoKey !== null;
    },

    lock() {
      cryptoKey = null;
    },

    // Nettoyer tout (en cas de reset)
    clearAll() {
      localStorage.removeItem(STORAGE_KEY_ENCRYPTED);
      localStorage.removeItem(SALT_KEY);
      cryptoKey = null;
    },

    // Chiffrement E2E pour projets partagés
    generateSharedKey,
    exportSharedKey,
    importSharedKey,
    deriveSharedKeyFromPassphrase,
    encryptWithSharedKey,
    decryptWithSharedKey
  };

  // Log de chargement
  console.log('🔒 TaskMDA Crypto Module loaded');
})();
