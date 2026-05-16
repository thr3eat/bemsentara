// Veri deposu — bellek + disk (data/store.json), yeniden başlatmada korunur

const crypto = require("crypto");
const { loadIntoCollections, scheduleSave, flushSave } = require("./persistence");

class InMemoryCollection {
  constructor(name, onMutate) {
    this.name = name;
    this.data = new Map();
    this.onMutate = onMutate;
  }

  persist() {
    if (this.onMutate) this.onMutate();
  }

  _persist() {
    this.persist();
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
    this._persist();
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
      if (value === undefined) continue;
      const a = record[key];
      const b = value;
      if (key === "discordId" || key === "robloxId" || key === "_id") {
        if (String(a) !== String(b)) return false;
      } else if (a !== b) {
        return false;
      }
    }
    return true;
  }

  _wrap(record) {
    const self = this;
    const wrapped = { ...record };
    wrapped.save = function () {
      wrapped.updatedAt = new Date();
      const stored = { ...wrapped };
      delete stored.save;
      self.data.set(wrapped._id, stored);
      self._persist();
      return Promise.resolve(wrapped);
    };
    return wrapped;
  }
}

const collections = {
  users: null,
  tickets: null,
  economies: null,
  wikis: null,
};

function onStoreMutate() {
  scheduleSave(collections);
}

collections.users = new InMemoryCollection("users", onStoreMutate);
collections.tickets = new InMemoryCollection("tickets", onStoreMutate);
collections.economies = new InMemoryCollection("economies", onStoreMutate);
collections.wikis = new InMemoryCollection("wikis", onStoreMutate);

const users = collections.users;
const tickets = collections.tickets;
const economies = collections.economies;
const wikis = collections.wikis;

function initStore() {
  const counts = loadIntoCollections(collections);
  return counts;
}

function saveStoreNow() {
  flushSave(collections);
}

module.exports = {
  users,
  tickets,
  economies,
  wikis,
  InMemoryCollection,
  initStore,
  saveStoreNow,
};
