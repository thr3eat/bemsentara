const mongoose = require("mongoose");

const guildAuthSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  inviterId: { type: String },
  authorized: { type: Boolean, default: false },
  checkedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("GuildAuth", guildAuthSchema);
