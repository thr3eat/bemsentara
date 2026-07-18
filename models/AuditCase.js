'use strict';

const mongoose = require('mongoose');

const auditCaseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true, index: true },
  actionType: { type: String, required: true }, // 'DISMISS', 'WARN'
  targetUserId: { type: String, required: true },
  reason: { type: String, required: true },
  issuedBy: { type: String, required: true },
  approvals: { type: [String], default: [] }, // Onaylayan bağımsız yöneticiler (User ID'leri)
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] }
}, { timestamps: true });

module.exports = mongoose.models.AuditCase || mongoose.model('AuditCase', auditCaseSchema);
