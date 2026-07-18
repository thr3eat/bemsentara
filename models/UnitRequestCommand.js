'use strict';

const mongoose = require('mongoose');

const unitRequestCommandSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  senderId: { type: String, required: true, index: true },
  receiverId: { type: String, required: true, index: true }, // Can be specific user or role ID
  type: { type: String, required: true, enum: ['leave_request', 'task_request', 'command'] },
  originalContent: { type: String, required: true },
  aiImprovedContent: { type: String, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'accepted', 'rejected', 'completed'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: null }
}, { timestamps: true });

const UnitRequestCommand = mongoose.models.UnitRequestCommand
  || mongoose.model('UnitRequestCommand', unitRequestCommandSchema);

module.exports = UnitRequestCommand;
