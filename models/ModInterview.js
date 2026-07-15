'use strict';

const mongoose = require('mongoose');

const modInterviewSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  adminId: { type: String, required: true },
  guildId: { type: String, required: true },
  history: { type: [Object], default: [] },
  answeredCount: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  startTime: { type: Date, default: Date.now },
  responses: { type: [Object], default: [] },
  username: { type: String, default: '' },
}, { timestamps: true });

const ModInterview = mongoose.models.ModInterview
  || mongoose.model('ModInterview', modInterviewSchema);

module.exports = ModInterview;
