'use strict';

const mongoose = require('mongoose');

const signOffSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true, index: true },
  actionType: { type: String, required: true }, // 'BAN_REMOVE', 'BUDGET_SPEND'
  details: { type: Object, default: {} },
  signatures: { type: [String], default: [] }, // İmzayı atan yönetici ID'leri
  vetoed: { type: Boolean, default: false },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] }
}, { timestamps: true });

module.exports = mongoose.models.SignOffRequest || mongoose.model('SignOffRequest', signOffSchema);
