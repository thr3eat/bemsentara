'use strict';

const mongoose = require('mongoose');

const errorReportSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  errorName: { type: String, default: 'Error' },
  errorMessage: { type: String, required: true },
  errorStack: { type: String, default: null },
  context: { type: String, default: 'Unknown' },
  guildId: { type: String, default: null },
  userId: { type: String, default: null },
  reported: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

const ErrorReport = mongoose.models.ErrorReport
  || mongoose.model('ErrorReport', errorReportSchema);

module.exports = ErrorReport;
