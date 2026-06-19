'use strict';

const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  
  // Trackers
  nightChatMsgs: { type: Number, default: 0 },
  dailyChatMsgs: { type: Number, default: 0 },
  editorEdits: { type: Number, default: 0 },
  photoCount: { type: Number, default: 0 },
  botFriendCmds: { type: Number, default: 0 },
  reactionCount: { type: Number, default: 0 },
  pingCount: { type: Number, default: 0 },
  philanthropyTransfers: { type: Number, default: 0 },

  // Last update dates for daily reset logic if needed
  lastDailyChatDate: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.models.AchievementProgress || mongoose.model('AchievementProgress', achievementSchema);
