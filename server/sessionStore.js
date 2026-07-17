const session = require("express-session");
const fs = require("fs");
const path = require("path");

class FileSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.filePath = options.filePath || path.join(__dirname, "../data/sessions.json");
    this.sessions = new Map();
    this.load();
  }

  async load() {
    // 1. Load from local file if exists
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf8");
        const parsed = JSON.parse(data);
        for (const [sid, sess] of Object.entries(parsed)) {
          if (sess.cookie && sess.cookie.expires) {
            sess.cookie.expires = new Date(sess.cookie.expires);
          }
          this.sessions.set(sid, sess);
        }
      }
    } catch (err) {
      console.error("[SessionStore] Failed to load local sessions:", err.message);
    }

    // 2. Load from MongoDB if active
    try {
      const db = require("../models/db");
      if (db.isMongoActive()) {
        const Record = db.getRecord();
        if (Record) {
          const docs = await Record.find({ collection: "sessions" }).lean();
          for (const doc of docs) {
            const sess = doc.data;
            if (sess.cookie && sess.cookie.expires) {
              sess.cookie.expires = new Date(sess.cookie.expires);
            }
            this.sessions.set(doc._storeId, sess);
          }
          console.log(`[SessionStore] Loaded ${docs.length} sessions from MongoDB.`);
        }
      }
    } catch (err) {
      console.error("[SessionStore] Failed to load sessions from MongoDB:", err.message);
    }
  }

  save(sid, isDelete = false) {
    // 1. Save to local file
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const obj = {};
      for (const [key, value] of this.sessions.entries()) {
        obj[key] = value;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), "utf8");
    } catch (err) {
      console.error("[SessionStore] Failed to save sessions locally:", err.message);
    }

    // 2. Save/Delete in MongoDB
    try {
      const db = require("../models/db");
      if (db.isMongoActive()) {
        const Record = db.getRecord();
        if (Record) {
          if (isDelete) {
            Record.deleteOne({ collection: "sessions", _storeId: sid }).catch(() => {});
          } else {
            const sess = this.sessions.get(sid);
            if (sess) {
              const clean = JSON.parse(JSON.stringify(sess));
              Record.findOneAndUpdate(
                { collection: "sessions", _storeId: sid },
                { $set: { data: clean } },
                { upsert: true, new: true, session: null }
              ).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.error("[SessionStore] Failed to sync session to MongoDB:", err.message);
    }
  }

  get(sid, callback) {
    const sess = this.sessions.get(sid);
    if (!sess) return callback(null, null);

    if (sess.cookie && sess.cookie.expires && new Date(sess.cookie.expires) < new Date()) {
      this.sessions.delete(sid);
      this.save(sid, true);
      return callback(null, null);
    }

    callback(null, sess);
  }

  set(sid, sess, callback) {
    this.sessions.set(sid, sess);
    this.save(sid, false);
    callback(null);
  }

  destroy(sid, callback) {
    this.sessions.delete(sid);
    this.save(sid, true);
    callback(null);
  }
}

module.exports = FileSessionStore;
