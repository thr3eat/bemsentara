const fs = require("fs");
const path = require("path");

const { DATA_DIR: CONFIG_DATA_DIR } = require("../config");
const DATA_DIR = process.env.DATA_DIR || CONFIG_DATA_DIR || path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "joinedAt",
  "closedAt",
  "timestamp",
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
  if (Array.isArray(out.comments)) {
    out.comments = out.comments.map((c) => {
      if (c?.createdAt && typeof c.createdAt === "string") {
        return { ...c, createdAt: new Date(c.createdAt) };
      }
      return c;
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
      version: 2,
      savedAt: new Date().toISOString(),
      users: serializeMap(collections.users.data),
      tickets: serializeMap(collections.tickets.data),
      economies: serializeMap(collections.economies.data),
      wikiArticles: serializeMap(collections.wikiArticles.data),
      errorReports: serializeMap(collections.errorReports.data),
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

function migrateLegacyWikis(collections, saved) {
  const legacy = saved?.wikis;
  if (!legacy || typeof legacy !== "object") return 0;
  if (collections.wikiArticles.data.size > 0) return 0;

  let count = 0;
  for (const [, record] of Object.entries(legacy)) {
    if (!record?._id) continue;
    const article = {
      _id: record._id,
      title: record.title || "Eski paylaşım",
      body: record.body || record.content || "",
      imageUrl: record.imageUrl || null,
      authorId: record.userId || record.authorId,
      authorName: record.username || record.authorName || "Bilinmiyor",
      authorAvatar: record.avatar || record.authorAvatar || null,
      comments: Array.isArray(record.comments) ? record.comments : [],
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    };
    collections.wikiArticles.data.set(article._id, reviveDates(article));
    count++;
  }
  if (count > 0) {
    flushSave(collections);
    console.log(`[persistence] ${count} eski wiki kaydı makaleye taşındı.`);
  }
  return count;
}

function loadIntoCollections(collections) {
  const saved = loadStoreFromDisk();
  if (!saved) return { users: 0, tickets: 0, economies: 0, wikiArticles: 0 };

  const counts = {
    users: hydrateCollection(collections.users, saved.users),
    tickets: hydrateCollection(collections.tickets, saved.tickets),
    economies: hydrateCollection(collections.economies, saved.economies),
    wikiArticles: hydrateCollection(
      collections.wikiArticles,
      saved.wikiArticles || saved.wikis
    ),
    errorReports: hydrateCollection(collections.errorReports, saved.errorReports),
  };

  migrateLegacyWikis(collections, saved);
  return counts;
}

module.exports = {
  DATA_DIR,
  STORE_FILE,
  loadIntoCollections,
  scheduleSave,
  flushSave,
};
