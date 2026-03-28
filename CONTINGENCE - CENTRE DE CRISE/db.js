(() => {
const DB_NAME = "contingence_local_db";
const DB_VERSION = 1;

const STORES = {
  plans: "plans",
  settings: "settings",
  exportsHistory: "exportsHistory",
  auditLog: "auditLog"
};

let dbPromise;

function openDb() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORES.plans)) {
        const plans = db.createObjectStore(STORES.plans, { keyPath: "id" });
        plans.createIndex("category", "category", { unique: false });
        plans.createIndex("criticality", "criticality", { unique: false });
        plans.createIndex("status", "status", { unique: false });
        plans.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(STORES.exportsHistory)) {
        const exportsHistory = db.createObjectStore(STORES.exportsHistory, {
          keyPath: "id",
          autoIncrement: true
        });
        exportsHistory.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.auditLog)) {
        const auditLog = db.createObjectStore(STORES.auditLog, {
          keyPath: "id",
          autoIncrement: true
        });
        auditLog.createIndex("at", "at", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

async function tx(storeName, mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tr = db.transaction(storeName, mode);
    const store = tr.objectStore(storeName);

    let result;
    try {
      result = callback(store);
    } catch (err) {
      reject(err);
      return;
    }

    tr.oncomplete = () => resolve(result);
    tr.onerror = () => reject(tr.error);
    tr.onabort = () => reject(tr.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listPlans() {
  return tx(STORES.plans, "readonly", (store) => reqToPromise(store.getAll()));
}

async function getPlan(id) {
  return tx(STORES.plans, "readonly", (store) => reqToPromise(store.get(id)));
}

async function upsertPlan(plan) {
  return tx(STORES.plans, "readwrite", (store) => {
    store.put(plan);
  });
}

async function deletePlan(id) {
  return tx(STORES.plans, "readwrite", (store) => {
    store.delete(id);
  });
}

async function clearPlans() {
  return tx(STORES.plans, "readwrite", (store) => store.clear());
}

async function setSetting(key, value) {
  return tx(STORES.settings, "readwrite", (store) => store.put({ key, value }));
}

async function getSetting(key) {
  const record = await tx(STORES.settings, "readonly", (store) =>
    reqToPromise(store.get(key))
  );
  return record ? record.value : null;
}

async function listAllSettings() {
  return tx(STORES.settings, "readonly", (store) => reqToPromise(store.getAll()));
}

async function addExportHistory(entry) {
  return tx(STORES.exportsHistory, "readwrite", (store) => store.add(entry));
}

async function listExportHistory() {
  return tx(STORES.exportsHistory, "readonly", (store) => reqToPromise(store.getAll()));
}

async function addAuditLog(entry) {
  return tx(STORES.auditLog, "readwrite", (store) => store.add(entry));
}

async function listAuditLogs() {
  return tx(STORES.auditLog, "readonly", (store) => reqToPromise(store.getAll()));
}

window.DBAPI = {
  listPlans,
  getPlan,
  upsertPlan,
  deletePlan,
  clearPlans,
  setSetting,
  getSetting,
  listAllSettings,
  addExportHistory,
  listExportHistory,
  addAuditLog,
  listAuditLogs
};
})();
