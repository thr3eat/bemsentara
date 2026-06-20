'use strict';

const mongoose = require('mongoose');

/**
 * Birim Alımı Takip Modeli
 */
const unitRecruitmentSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  birim: { type: String, required: true }, // 'BAN', 'SES', 'SOHBET'
  announcementDate: { type: Date, default: Date.now },
  startDate: { type: Date, required: true }, // Alımın başlayacağı sabah
  endDate: { type: Date, required: true }, // Alımın sonlanacağı akşam
  examTips: { type: String, default: '' }, // AI tarafından üretilen sınav ipuçları
  examQuestions: { type: [Object], default: [] } // AI tarafından üretilen sınav soruları
}, { timestamps: true });

const UnitRecruitment = mongoose.models.UnitRecruitment
  || mongoose.model('UnitRecruitment', unitRecruitmentSchema);

module.exports = UnitRecruitment;
