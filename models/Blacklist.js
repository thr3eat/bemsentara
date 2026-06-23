'use strict';

const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true, enum: ['person', 'group'] },
  reason: { type: String, default: '' },
  status: { type: String, required: true, default: 'active', enum: ['active', 'removed'] },
  addedAt: { type: Date, default: Date.now },
  removedAt: { type: Date, default: null },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

const Blacklist = mongoose.models.Blacklist 
  || mongoose.model('Blacklist', blacklistSchema);

module.exports = Blacklist;
