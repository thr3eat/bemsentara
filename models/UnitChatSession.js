'use strict';

const mongoose = require('mongoose');

const unitChatSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  senderId: { type: String, required: true, index: true },
  receiverId: { type: String, required: true, index: true },
  unitName: { type: String, required: true }, // 'BAN_BIRIMI', 'SES_BIRIMI', 'SOHBET_BIRIMI'
  senderRole: { type: String, required: true }, // 'member', 'assistant', 'boss', 'coach'
  receiverRole: { type: String, required: true },
  status: { type: String, default: 'active', enum: ['active', 'closed'] },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null }
});

const UnitChatSession = mongoose.models.UnitChatSession
  || mongoose.model('UnitChatSession', unitChatSessionSchema);

module.exports = UnitChatSession;
