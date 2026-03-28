/**
 * FSA (File System Access API) Module
 * Gestion de la persistance du DirectoryHandle et sauvegarde automatique
 * Adapté de la stratégie TaskMDA pour Contingence Local
 *
 * @author Frédérick MURAT
 * @license MIT
 * @year 2026
 */

const FSA = (() => {
  // Configuration
  const FSA_DB_NAME = "Contingence_FSA";
  const FSA_DB_VERSION = 1;
  const STORE_NAME = "directory_handles";

  // État
  let fsaDB = null;
  let directoryHandle = null;
  let isConnected = false;
  let folderInfo = null;

  /**
   * Initialise la base de données FSA
   */
  async function initFSADatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FSA_DB_NAME, FSA_DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        fsaDB = request.result;
        resolve(fsaDB);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  /**
   * Sauvegarde le handle dans IndexedDB
   */
  async function saveHandle(handle) {
    if (!fsaDB) {
      throw new Error("FSA Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const tx = fsaDB.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      store.put(handle, "backup-folder");

      const info = {
        name: handle.name,
        linkedAt: new Date().toISOString(),
      };
      store.put(info, "backup-folder-info");

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Récupère le handle depuis IndexedDB
   */
  async function loadHandle() {
    if (!fsaDB) {
      throw new Error("FSA Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const tx = fsaDB.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      const handleRequest = store.get("backup-folder");
      const infoRequest = store.get("backup-folder-info");

      tx.oncomplete = () => {
        resolve({
          handle: handleRequest.result,
          info: infoRequest.result,
        });
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Supprime le handle de IndexedDB
   */
  async function clearHandle() {
    if (!fsaDB) {
      throw new Error("FSA Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const tx = fsaDB.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      store.delete("backup-folder");
      store.delete("backup-folder-info");

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Vérifie si l'API FSA est supportée
   */
  function isSupported() {
    return "showDirectoryPicker" in window;
  }

  /**
   * Vérifie les permissions du handle
   */
  async function checkPermission(handle, mode = "readwrite") {
    if (!handle) return "prompt";

    try {
      const permission = await handle.queryPermission({ mode });
      return permission;
    } catch (err) {
      console.error("Error checking permission:", err);
      return "prompt";
    }
  }

  /**
   * Demande les permissions pour le handle
   */
  async function requestPermission(handle, mode = "readwrite") {
    if (!handle) return false;

    try {
      const permission = await handle.requestPermission({ mode });
      return permission === "granted";
    } catch (err) {
      console.error("Error requesting permission:", err);
      return false;
    }
  }

  /**
   * Lie un dossier via le sélecteur de fichiers
   */
  async function linkFolder() {
    if (!isSupported()) {
      throw new Error("File System Access API not supported");
    }

    try {
      // Ouvre le sélecteur de dossier
      const handle = await window.showDirectoryPicker({
        mode: "readwrite",
        startIn: "documents",
      });

      // Sauvegarde le handle
      await saveHandle(handle);

      directoryHandle = handle;
      folderInfo = {
        name: handle.name,
        linkedAt: new Date().toISOString(),
      };
      isConnected = true;

      return {
        success: true,
        folderName: handle.name,
      };
    } catch (err) {
      if (err.name === "AbortError") {
        return { success: false, cancelled: true };
      }
      throw err;
    }
  }

  /**
   * Délie le dossier
   */
  async function unlinkFolder() {
    await clearHandle();
    directoryHandle = null;
    folderInfo = null;
    isConnected = false;

    return { success: true };
  }

  /**
   * Vérifie la connexion au dossier au démarrage
   */
  async function checkConnection() {
    try {
      const { handle, info } = await loadHandle();

      if (!handle) {
        isConnected = false;
        return {
          connected: false,
          requiresSetup: true,
        };
      }

      // Vérifie les permissions
      const permission = await checkPermission(handle);

      if (permission === "granted") {
        directoryHandle = handle;
        folderInfo = info;
        isConnected = true;

        return {
          connected: true,
          folderName: info?.name || handle.name,
        };
      } else if (permission === "prompt") {
        // Demande les permissions
        const granted = await requestPermission(handle);

        if (granted) {
          directoryHandle = handle;
          folderInfo = info;
          isConnected = true;

          return {
            connected: true,
            folderName: info?.name || handle.name,
            permissionRestored: true,
          };
        } else {
          return {
            connected: false,
            requiresPermission: true,
            folderName: info?.name || handle.name,
          };
        }
      } else {
        return {
          connected: false,
          requiresPermission: true,
          folderName: info?.name || handle.name,
        };
      }
    } catch (err) {
      console.error("Error checking connection:", err);
      return {
        connected: false,
        error: err.message,
      };
    }
  }

  /**
   * Sauvegarde un fichier JSON dans le dossier lié
   */
  async function saveFile(filename, data) {
    if (!isConnected || !directoryHandle) {
      throw new Error("No folder connected");
    }

    try {
      // Crée ou récupère le fichier
      const fileHandle = await directoryHandle.getFileHandle(filename, {
        create: true,
      });

      // Crée un writable stream
      const writable = await fileHandle.createWritable();

      // Écrit les données
      const jsonString = JSON.stringify(data, null, 2);
      await writable.write(jsonString);
      await writable.close();

      return { success: true };
    } catch (err) {
      console.error("Error saving file:", err);
      throw err;
    }
  }

  /**
   * Lit un fichier JSON depuis le dossier lié
   */
  async function loadFile(filename) {
    if (!isConnected || !directoryHandle) {
      throw new Error("No folder connected");
    }

    try {
      const fileHandle = await directoryHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (err) {
      if (err.name === "NotFoundError") {
        return null;
      }
      console.error("Error loading file:", err);
      throw err;
    }
  }

  /**
   * Sauvegarde complète de toutes les données
   */
  async function backupAll(plans, settings) {
    if (!isConnected) {
      return { success: false, notConnected: true };
    }

    try {
      // Fichier principal de backup
      const backupData = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        plans: plans,
        settings: settings,
      };
      await saveFile("contingence-backup.json", backupData);

      // Fichier séparé pour les plans (pour faciliter la lecture)
      await saveFile("contingence-plans.json", plans);

      // Fichier de métadonnées
      const metadata = {
        lastBackup: new Date().toISOString(),
        planCount: plans.length,
        criticalCount: plans.filter((p) => p.criticality === "critique").length,
      };
      await saveFile("contingence-metadata.json", metadata);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error("Error during backup:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Restaure les données depuis le backup
   */
  async function restoreAll() {
    if (!isConnected) {
      return { success: false, notConnected: true };
    }

    try {
      const backupData = await loadFile("contingence-backup.json");

      if (!backupData) {
        return { success: false, noBackupFound: true };
      }

      return {
        success: true,
        data: backupData,
      };
    } catch (err) {
      console.error("Error during restore:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Exporte un plan individuel
   */
  async function exportPlan(plan) {
    if (!isConnected) {
      return { success: false, notConnected: true };
    }

    try {
      const filename = `plan-${plan.id}-${Date.now()}.json`;
      await saveFile(filename, plan);

      return {
        success: true,
        filename: filename,
      };
    } catch (err) {
      console.error("Error exporting plan:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Initialise le module FSA
   */
  async function init() {
    if (!isSupported()) {
      console.warn("File System Access API not supported");
      return {
        supported: false,
        connected: false,
      };
    }

    try {
      await initFSADatabase();
      const connectionStatus = await checkConnection();

      return {
        supported: true,
        ...connectionStatus,
      };
    } catch (err) {
      console.error("Error initializing FSA:", err);
      return {
        supported: true,
        connected: false,
        error: err.message,
      };
    }
  }

  // API Publique
  return {
    init,
    isSupported,
    linkFolder,
    unlinkFolder,
    checkConnection,
    backupAll,
    restoreAll,
    exportPlan,
    saveFile,
    loadFile,
    getStatus: () => ({
      connected: isConnected,
      folderName: folderInfo?.name,
      linkedAt: folderInfo?.linkedAt,
    }),
  };
})();

// Export pour utilisation dans app.js
window.FSA = FSA;
