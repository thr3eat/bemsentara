'use strict';

const mongoose = require('mongoose');

const redactedOpSchema = new mongoose.Schema({
  opId: { type: String, required: true, unique: true, index: true },
  targetUserId: { type: String, required: true },
  passcode: { type: String, required: true },
  decrypted: { type: Boolean, default: false },
  details: { type: String, required: true },
  intelReport: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.RedactedOp || mongoose.model('RedactedOp', redactedOpSchema);
