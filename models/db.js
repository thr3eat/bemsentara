/**
 * MongoDB bağlantı yöneticisi.
 * MONGODB_URI env değişkeni varsa MongoDB kullanır,
 * yoksa eski dosya tabanlı persistence devam eder.
 */

const mongoose = require("mongoose");

let connected = false;
let usesMongo = false;

const MONGODB_URI = process.env.MONGODB_URI || null;

// ── Mongoose şemaları ────────────────────────────────────────────────────────

const recordSchema = new mongoose.Schema(
  {
    _storeId: { type: String, required: true, unique: true }, // InMemoryCollection'daki _id
    collection: { type: String, required: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);
recordSchema.index({ collection: 1, _storeId: 1 }, { unique: true });

let Record;

async function connectMongo() {
  if (!MONGODB_URI) return false;
  if (connected) return true;

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    Record = mongoose.model("StoreRecord", recordSchema);
    connected = true;
    usesMongo = true;
    console.log("[db] MongoDB bağlantısı kuruldu.");
    return true;
  } catch (err) {
    console.error("[db] MongoDB bağlanamadı, dosya sistemi kullanılacak:", err.message);
    return false;
  }
}

function isMongoActive() {
  return usesMongo && connected;
}

function getRecord() {
  return Record;
}

// ── Koleksiyon verilerini MongoDB'den yükle ──────────────────────────────────

async function loadCollectionFromMongo(collectionName) {
  if (!isMongoActive()) return null;
  try {
    const docs = await Record.find({ collection: collectionName }).lean();
    const result = {};
    for (const doc of docs) {
      result[doc._storeId] = doc.data;
    }
    return result;
  } catch (err) {
    console.error(`[db] ${collectionName} yüklenemedi:`, err.message);
    return null;
  }
}

// ── Tek kayıt kaydet/güncelle ────────────────────────────────────────────────

async function upsertRecord(collectionName, storeId, data) {
  if (!isMongoActive()) return;
  try {
    // _id gibi mongoose özel alanlarını temizle
    const clean = JSON.parse(JSON.stringify(data));
    delete clean.save;

    await Record.findOneAndUpdate(
      { collection: collectionName, _storeId: storeId },
      { $set: { data: clean } },
      { upsert: true, new: true, session: null }
    );
  } catch (err) {
    console.error(`[db] Kayıt güncellenemedi (${collectionName}/${storeId}):`, err.message);
  }
}

// ── Tüm koleksiyonu toplu kaydet ─────────────────────────────────────────────

async function saveCollectionToMongo(collectionName, map) {
  if (!isMongoActive()) return;
  try {
    const ops = [];
    for (const [storeId, data] of map.entries()) {
      const clean = JSON.parse(JSON.stringify(data));
      delete clean.save;
      ops.push({
        updateOne: {
          filter: { collection: collectionName, _storeId: storeId },
          update: { $set: { data: clean } },
          upsert: true,
        },
      });
    }
    if (ops.length > 0) {
      await Record.bulkWrite(ops, { ordered: false, session: null });
    }
  } catch (err) {
    console.error(`[db] Toplu kayıt hatası (${collectionName}):`, err.message);
  }
}

module.exports = {
  connectMongo,
  isMongoActive,
  getRecord,
  loadCollectionFromMongo,
  upsertRecord,
  saveCollectionToMongo,
};
