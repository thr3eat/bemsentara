// In-memory data store - replaces MongoDB/Mongoose
// Data will reset on server restart, but no external database needed

const crypto = require("crypto");

class InMemoryCollection {
  constructor() {
    this.data = new Map();
  }

  _generateId() {
    return crypto.randomBytes(12).toString("hex");
  }

  create(doc) {
    const id = this._generateId();
    const now = new Date();
    const record = {
      _id: id,
      ...doc,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    };
    this.data.set(id, record);
    return this._wrap(record);
  }

  findOne(query) {
    for (const record of this.data.values()) {
      if (this._matches(record, query)) {
        return this._wrap(record);
      }
    }
    return null;
  }

  find(query) {
    const results = [];
    for (const record of this.data.values()) {
      if (this._matches(record, query)) {
        results.push(this._wrap(record));
      }
    }
    // Add sort method to results array
    results.sort = function (sortObj) {
      const key = Object.keys(sortObj)[0];
      const dir = sortObj[key];
      return this.slice().sort((a, b) => {
        if (dir === -1) return (b[key] || 0) > (a[key] || 0) ? 1 : -1;
        return (a[key] || 0) > (b[key] || 0) ? 1 : -1;
      });
    };
    return results;
  }

  findById(id) {
    const record = this.data.get(id);
    return record ? this._wrap(record) : null;
  }

  _matches(record, query) {
    for (const [key, value] of Object.entries(query)) {
      if (record[key] !== value) return false;
    }
    return true;
  }

  _wrap(record) {
    const self = this;
    // Make a copy with a save method
    const wrapped = { ...record };
    wrapped.save = function () {
      wrapped.updatedAt = new Date();
      // Update the stored record with current values
      const stored = { ...wrapped };
      delete stored.save;
      self.data.set(wrapped._id, stored);
      return Promise.resolve(wrapped);
    };
    return wrapped;
  }
}

// Singleton stores
const users = new InMemoryCollection();
const tickets = new InMemoryCollection();
const economies = new InMemoryCollection();
const wikis = new InMemoryCollection();

module.exports = { users, tickets, economies, wikis, InMemoryCollection };
