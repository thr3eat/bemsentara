'use strict';

const mongoose = require('mongoose');

const serverConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  economyEnabled: { type: Boolean, default: true },
  moderationEnabled: { type: Boolean, default: true },
  funEnabled: { type: Boolean, default: true }
}, { timestamps: true });

const ServerConfig = mongoose.models.ServerConfig 
  || mongoose.model('ServerConfig', serverConfigSchema);

module.exports = ServerConfig;
