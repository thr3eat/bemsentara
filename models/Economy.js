// Economy model - in-memory replacement for Mongoose model
const { economies } = require("./Store");

const Economy = {
  findOne(query) {
    return Promise.resolve(economies.findOne(query));
  },

  findById(id) {
    return Promise.resolve(economies.findById(id));
  },

  find(query) {
    return Promise.resolve(economies.find(query));
  },
};

// Constructor-like: new Economy({...}) then .save()
function EconomyConstructor(data) {
  const defaults = {
    wallet: 0,
    bank: 0,
    inventory: [],
    lastDailyClaimAt: null,
    gamesPlayed: 0,
    gamesWon: 0,
    totalEarnings: 0,
  };
  const merged = { ...defaults, ...data };
  merged.save = function () {
    if (merged._id) {
      const stored = economies.findOne({ _id: merged._id });
      if (stored) {
        Object.assign(stored, merged);
        stored.save();
        return Promise.resolve(merged);
      }
    }
    const created = economies.create(merged);
    Object.assign(merged, created);
    return Promise.resolve(merged);
  };
  return merged;
}

EconomyConstructor.findOne = Economy.findOne;
EconomyConstructor.findById = Economy.findById;
EconomyConstructor.find = Economy.find;

module.exports = EconomyConstructor;
