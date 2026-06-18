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

  load() {
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
      console.error("[SessionStore] Failed to load sessions:", err.message);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const obj = {};
      for (const [sid, sess] of this.sessions.entries()) {
        obj[sid] = sess;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), "utf8");
    } catch (err) {
      console.error("[SessionStore] Failed to save sessions:", err.message);
    }
  }

  get(sid, callback) {
    const sess = this.sessions.get(sid);
    if (!sess) return callback(null, null);

    if (sess.cookie && sess.cookie.expires && new Date(sess.cookie.expires) < new Date()) {
      this.sessions.delete(sid);
      this.save();
      return callback(null, null);
    }

    callback(null, sess);
  }

  set(sid, sess, callback) {
    this.sessions.set(sid, sess);
    this.save();
    callback(null);
  }

  destroy(sid, callback) {
    this.sessions.delete(sid);
    this.save();
    callback(null);
  }
}

module.exports = FileSessionStore;
