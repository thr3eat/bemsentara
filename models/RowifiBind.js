const mongoose = require('mongoose');

const rowifiBindSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  type: { type: String, required: true, enum: ['rank', 'group'] },
  groupId: { type: Number, required: true },
  rank: { type: Number, default: 0 }, // 0 = Guest / Not in group. 1-255 = Rank ID
  roleId: { type: String, required: true },
  template: { type: String, default: '{roblox_username}' },
  priority: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('RowifiBind', rowifiBindSchema);
