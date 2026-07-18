'use strict';

const mongoose = require('mongoose');

const malpracticeSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true, index: true },
  targetUserId: { type: String, required: true },
  reason: { type: String, required: true },
  fineAmount: { type: Number, default: 0 },
  status: { type: String, default: 'pending', enum: ['pending', 'settled', 'resolved'] },
  defenseText: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.MalpracticeCase || mongoose.model('MalpracticeCase', malpracticeSchema);
