// User model - in-memory replacement for Mongoose model
const { users } = require("./Store");

const User = {
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
      isAuthorized: false,
      isStaff: false,
      isAdmin: false,
      groupRole: null,
      canSetRole: false,
      canManageMembers: false,
      canManageTickets: false,
      profileBio: null,
      profileColor: "#7c6af7",
      joinedAt: new Date(),
    };
    return Promise.resolve(users.create({ ...defaults, ...data }));
  },
};

// Constructor-like: new User({...}) then .save()
function UserConstructor(data) {
  const defaults = {
    isAuthorized: false,
    isStaff: false,
    isAdmin: false,
    groupRole: null,
    canSetRole: false,
    canManageMembers: false,
    canManageTickets: false,
    profileBio: null,
    profileColor: "#7c6af7",
    joinedAt: new Date(),
  };
  const merged = { ...defaults, ...data };
    merged.save = function () {
      // If this user already exists (has _id), update it
      if (merged._id && users.data.has(merged._id)) {
        merged.updatedAt = new Date();
        const stored = { ...merged };
        delete stored.save;
        users.data.set(merged._id, stored);
        users.persist();
        return Promise.resolve(merged);
      }
    // Otherwise create a new user
    const created = users.create(merged);
    // Copy _id back
    Object.assign(merged, created);
    return Promise.resolve(merged);
  };
  return merged;
}

// Support both: User.findOne() and new User()
UserConstructor.findOne = User.findOne;
UserConstructor.findById = User.findById;
UserConstructor.find = User.find;
UserConstructor.create = User.create;

module.exports = UserConstructor;
