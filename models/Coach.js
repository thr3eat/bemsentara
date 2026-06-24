// Coach model - Unit coach management
const { users } = require("./Store");

const Coach = {
  findOne(query) {
    return Promise.resolve(users.findOne(query));
  },

  findById(id) {
    return Promise.resolve(users.findById(id));
  },

  find(query) {
    return Promise.resolve(users.find(query));
  },

  create(data) {
    const defaults = {
      role: "coach",
      assignedBranches: [],
      createdAt: new Date(),
    };
    return Promise.resolve(users.create({ ...defaults, ...data }));
  },
};

// Constructor-like: new Coach({...}) then .save()
function CoachConstructor(data) {
  const defaults = {
    discordId: null,
    name: null,
    role: "coach",
    assignedBranches: [],  // ["BAN_BIRIMI", "SES_BIRIMI", "SOHBET_BIRIMI"]
    isActive: true,
    createdAt: new Date(),
  };
  const merged = { ...defaults, ...data };
  
  merged.save = function () {
    // If this coach already exists (has _id), update it
    if (merged._id && users.data.has(merged._id)) {
      merged.updatedAt = new Date();
      const stored = { ...merged };
      delete stored.save;
      users.data.set(merged._id, stored);
      users.persist();
      return Promise.resolve(merged);
    }
    // Otherwise create a new coach
    const created = users.create(merged);
    // Copy _id back
    Object.assign(merged, created);
    return Promise.resolve(merged);
  };
  
  return merged;
}

// Support both: Coach.findOne() and new Coach()
CoachConstructor.findOne = Coach.findOne;
CoachConstructor.findById = Coach.findById;
CoachConstructor.find = Coach.find;
CoachConstructor.create = Coach.create;

module.exports = CoachConstructor;
