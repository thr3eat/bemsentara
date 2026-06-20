'use strict';

const mongoose = require('mongoose');

/**
 * Personel Birim Takip Modeli
 */
const staffUnitSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  unitName: { type: String, default: null }, // 'BAN', 'SES', 'SOHBET'
  rank: { type: Number, default: 0 }, // 1 - 15
  joinedAt: { type: Date, default: null },
  dailyTasksCompleted: { type: Number, default: 0 },
  lastAutoPromoDate: { type: String, default: null }, // 'YYYY-MM-DD'
  
  // Sınav Durumu
  exam: {
    status: { type: String, default: 'none', enum: ['none', 'ongoing', 'passed', 'failed'] },
    unit: { type: String, default: null },
    questions: { type: [Object], default: [] },
    currentIndex: { type: Number, default: 0 },
    answers: { type: [Number], default: [] },
    startedAt: { type: Date, default: null }
  }
}, { timestamps: true });

const StaffUnit = mongoose.models.StaffUnit
  || mongoose.model('StaffUnit', staffUnitSchema);

module.exports = StaffUnit;
