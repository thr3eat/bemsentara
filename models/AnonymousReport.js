'use strict';

const mongoose = require('mongoose');

const anonymousReportSchema = new mongoose.Schema({
  reportId: { type: String, required: true, unique: true, index: true },
  reporterHash: { type: String, required: true },
  realUserId: { type: String, default: null },
  subject: { type: String, required: true },
  details: { type: String, required: true },
  threadId: { type: String, default: null } // Kriptolu kanal/thread ID'si
}, { timestamps: true });

module.exports = mongoose.models.AnonymousReport || mongoose.model('AnonymousReport', anonymousReportSchema);
