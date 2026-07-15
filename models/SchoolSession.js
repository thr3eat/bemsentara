'use strict';

const mongoose = require('mongoose');

const schoolSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  
  // For training session
  training: {
    phase: { type: Number },
    step: { type: Number },
    lastMessageId: { type: String }
  },

  // For exam session
  exam: {
    questionIndex: { type: Number },
    answers: { type: [String], default: [] },
    phase: { type: Number },
    questions: { type: [String], default: [] }
  }
}, { timestamps: true });

const SchoolSession = mongoose.models.SchoolSession
  || mongoose.model('SchoolSession', schoolSessionSchema);

module.exports = SchoolSession;
