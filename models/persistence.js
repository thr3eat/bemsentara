const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "joinedAt",
  "closedAt",
]);

function reviveDates(record) {
  if (!record || typeof record !== "object") return record;
  const out = { ...record };
  for (const key of DATE_FIELDS) {
    if (out[key] && typeof out[key] === "string") {
      out[key] = new Date(out[key]);
    }
  }
  if (Array.isArray(out.messages)) {
    out.messages = out.messages.map((m) => {
      if (m?.createdAt && typeof m.createdAt === "string") {
        return { ...m, createdAt: new Date(m.createdAt) };
      }
      return m;
    });
  }
  return out;
}

function loadStoreFromDisk() {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[persistence] Yükleme hatası:", err.message);
    return null;
  }
}

function serializeMap(map) {
  return Object.fromEntries(map.entries());
}

let saveTimer = null;
let pendingCollections = null;

function scheduleSave(collections) {
  pendingCollections = collections;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    flushSave(pendingCollections);
    pendingCollections = null;
  }, 400);
}

function flushSave(collections) {
  if (!collections) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      users: serializeMap(collections.users.data),
      tickets: serializeMap(collections.tickets.data),
      economies: serializeMap(collections.economies.data),
      wikis: serializeMap(collections.wikis.data),
    };
    const tmp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, STORE_FILE);
  } catch (err) {
    console.error("[persistence] Kaydetme hatası:", err.message);
  }
}

function hydrateCollection(collection, records) {
  if (!records || typeof records !== "object") return 0;
  let count = 0;
  for (const [, record] of Object.entries(records)) {
    if (!record?._id) continue;
    collection.data.set(record._id, reviveDates(record));
    count++;
  }
  return count;
}

function loadIntoCollections(collections) {
  const saved = loadStoreFromDisk();
  if (!saved) return { users: 0, tickets: 0, economies: 0, wikis: 0 };

  return {
    users: hydrateCollection(collections.users, saved.users),
    tickets: hydrateCollection(collections.tickets, saved.tickets),
    economies: hydrateCollection(collections.economies, saved.economies),
    wikis: hydrateCollection(collections.wikis, saved.wikis),
  };
}

module.exports = {
  STORE_FILE,
  loadIntoCollections,
  scheduleSave,
  flushSave,
};
