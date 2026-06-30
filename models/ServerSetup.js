'use strict';

const mongoose = require('mongoose');

const serverSetupSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  guildName: { type: String, required: true },
  robloxGroupId: { type: Number, required: true },
  robloxGroupName: { type: String, required: true },
  roleMappings: { type: Map, of: String, default: {} }, // Rank (as string number) -> Discord Role ID
  adminChannelId: { type: String },
  verifyHelpChannelId: { type: String },
  rulesChannelId: { type: String },
  branchChef: { type: String }, // Discord user ID / username
  branchChefAssistant: { type: String }, // Discord user ID / username
  archiveChannelId: { type: String },
  status: { type: String, enum: ['draft', 'active'], default: 'draft' }
}, { timestamps: true });

const ServerSetup = mongoose.models.ServerSetup 
  || mongoose.model('ServerSetup', serverSetupSchema);

module.exports = ServerSetup;
