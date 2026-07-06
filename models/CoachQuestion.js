'use strict';

const mongoose = require('mongoose');

const coachQuestionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  question: { type: String, required: true },
  category: { type: String, default: 'general' }
}, { timestamps: true });

const CoachQuestion = mongoose.models.CoachQuestion 
  || mongoose.model('CoachQuestion', coachQuestionSchema);

module.exports = CoachQuestion;
