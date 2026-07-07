'use strict';

const mongoose = require('mongoose');

const investigationSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  targetUserId: { type: String, required: true, index: true },
  reason: { type: String, required: true },
  creatorId: { type: String, required: true },
  judgeId: { type: String, default: null },
  lawyerId: { type: String, default: null },
  status: { 
    type: String, 
    default: 'pending_agreement', 
    enum: ['pending_agreement', 'ongoing', 'paused', 'resolved', 'closed', 'rejected'] 
  },
  addedModerators: [{ type: String }],
  messages: [{
    senderId: String,
    senderName: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  syncEnabled: { type: Boolean, default: true },
  lastMessageAt: { type: Date, default: Date.now },
  lastMentionAt: { type: Date, default: null },
  lastMentionReminderAt: { type: Date, default: null },
  penaltyApplied: { type: String, default: null },
  rejectCount: { type: Number, default: 0 }
}, { timestamps: true });

const Investigation = mongoose.models.Investigation 
  || mongoose.model('Investigation', investigationSchema);

module.exports = Investigation;
