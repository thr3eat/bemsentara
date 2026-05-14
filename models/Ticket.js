// Ticket model - in-memory replacement for Mongoose model
const { tickets } = require("./Store");

const Ticket = {
  findOne(query) {
    return Promise.resolve(tickets.findOne(query));
  },

  findById(id) {
    return Promise.resolve(tickets.findById(id));
  },

  find(query) {
    const results = tickets.find(query);
    return Promise.resolve(results);
  },
};

// Constructor-like: new Ticket({...}) then .save()
function TicketConstructor(data) {
  const defaults = {
    status: "open",
    priority: "medium",
    messages: [],
    createdAt: new Date(),
    closedAt: null,
    closeReason: null,
  };
  const merged = { ...defaults, ...data };
  merged.save = function () {
    // Check if already in store (update) or new (create)
    if (merged._id) {
      const stored = tickets.findOne({ _id: merged._id });
      if (stored) {
        // Update existing
        Object.assign(stored, merged);
        stored.save();
        return Promise.resolve(merged);
      }
    }
    const created = tickets.create(merged);
    Object.assign(merged, created);
    return Promise.resolve(merged);
  };
  return merged;
}

TicketConstructor.findOne = Ticket.findOne;
TicketConstructor.findById = Ticket.findById;
TicketConstructor.find = Ticket.find;

module.exports = TicketConstructor;
