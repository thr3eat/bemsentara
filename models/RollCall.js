const mongoose = require("mongoose");

const rollCallSchema = new mongoose.Schema({
  messageId: { type: String, required: true },
  channelId: { type: String, required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  participants: { type: [String], default: [] }, // Array of discord user IDs
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  month: { type: String, required: true } // e.g. "Haziran 2026"
});

module.exports = mongoose.model("RollCall", rollCallSchema);
