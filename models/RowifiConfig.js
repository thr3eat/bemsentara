const mongoose = require('mongoose');

const rowifiConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  autoDetection: { type: Boolean, default: false },
  lastSync: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('RowifiConfig', rowifiConfigSchema);
