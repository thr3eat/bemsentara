const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  xpAmount: { type: Number, required: true },
  endsAt: { type: Date, required: true },
  participants: [{ type: String }],
  isActive: { type: Boolean, default: true },
  winners: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Giveaway', giveawaySchema);
