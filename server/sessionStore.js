const session = require("express-session");
const fs = require("fs");
const path = require("path");

class FileSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.filePath = options.filePath || path.join(__dirname, "../data/sessions.json");
    this.sessions = new Map();
    this.loadLocal();
  }

  loadLocal() {
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
  }

  saveLocal() {
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
  }

  get(sid, callback) {
    const db = require("../models/db");
    if (db.isMongoActive()) {
      const Record = db.getRecord();
      if (Record) {
        Record.findOne({ collection: "sessions", _storeId: sid }).lean()
          .then(doc => {
            if (!doc) {
              // Try in-memory fallback
              return this.getFallback(sid, callback);
            }
            const sess = doc.data;
            if (sess.cookie && sess.cookie.expires && new Date(sess.cookie.expires) < new Date()) {
              Record.deleteOne({ collection: "sessions", _storeId: sid }).catch(() => {});
              return callback(null, null);
            }
            // Keep in-memory sync
            this.sessions.set(sid, sess);
            callback(null, sess);
          })
          .catch(err => {
            console.error("[SessionStore] MongoDB get error:", err.message);
            this.getFallback(sid, callback);
          });
        return;
      }
    }
    this.getFallback(sid, callback);
  }

  getFallback(sid, callback) {
    const sess = this.sessions.get(sid);
    if (!sess) return callback(null, null);

    if (sess.cookie && sess.cookie.expires && new Date(sess.cookie.expires) < new Date()) {
      this.sessions.delete(sid);
      this.saveLocal();
      return callback(null, null);
    }

    callback(null, sess);
  }

  set(sid, sess, callback) {
    // 1. Sync to memory & local file
    this.sessions.set(sid, sess);
    this.saveLocal();

    // 2. Sync to MongoDB asynchronously
    const db = require("../models/db");
    if (db.isMongoActive()) {
      const Record = db.getRecord();
      if (Record) {
        const clean = JSON.parse(JSON.stringify(sess));
        Record.findOneAndUpdate(
          { collection: "sessions", _storeId: sid },
          { $set: { data: clean } },
          { upsert: true, new: true, session: null }
        )
          .then(() => callback(null))
          .catch(err => {
            console.error("[SessionStore] MongoDB set error:", err.message);
            callback(null);
          });
        return;
      }
    }
    callback(null);
  }

  destroy(sid, callback) {
    // 1. Sync to memory & local file
    this.sessions.delete(sid);
    this.saveLocal();

    // 2. Sync to MongoDB asynchronously
    const db = require("../models/db");
    if (db.isMongoActive()) {
      const Record = db.getRecord();
      if (Record) {
        Record.deleteOne({ collection: "sessions", _storeId: sid })
          .then(() => callback(null))
          .catch(err => {
            console.error("[SessionStore] MongoDB destroy error:", err.message);
            callback(null);
          });
        return;
      }
    }
    callback(null);
  }
}

module.exports = FileSessionStore;
