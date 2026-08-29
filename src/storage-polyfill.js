// Only activates outside Claude's artifact runtime (where window.storage
// already exists). This makes HomeBase.jsx portable: the exact same component
// file works unmodified both as a Claude artifact and as this standalone app.
// Must be imported BEFORE HomeBase.jsx so window.storage exists by the time
// the component's useEffect calls it.

const DB_NAME = "gutlog-db";
const STORE = "kv";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function fullKey(key, shared) {
  return (shared ? "shared:" : "priv:") + key;
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbAllKeys() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key, shared = false) {
      const value = await idbGet(fullKey(key, shared));
      if (value === undefined) return null;
      return { key, value, shared };
    },
    async set(key, value, shared = false) {
      await idbSet(fullKey(key, shared), value);
      return { key, value, shared };
    },
    async delete(key, shared = false) {
      const existing = await idbGet(fullKey(key, shared));
      await idbDelete(fullKey(key, shared));
      return { key, deleted: existing !== undefined, shared };
    },
    async list(prefix = "", shared = false) {
      const all = await idbAllKeys();
      const tag = shared ? "shared:" : "priv:";
      const pfx = tag + prefix;
      const keys = all.filter((k) => typeof k === "string" && k.startsWith(pfx)).map((k) => k.slice(tag.length));
      return { keys, prefix, shared };
    },
  };
}
