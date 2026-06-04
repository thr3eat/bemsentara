'use strict';

/**
 * Bekleyen anket davetleri — bot restart'ta kaybolmaz.
 * customId 100 char limitini aşmamak için bilgiyi MongoDB'de saklıyoruz.
 * Key: targetUserId
 */

const mongoose = require('mongoose');

const surveyPendingSchema = new mongoose.Schema({
  targetUserId:  { type: String, required: true, unique: true, index: true },
  requesterId:   { type: String, required: true },
  guildId:       { type: String, required: true },
  topic:         { type: String, required: true },
  createdAt:     { type: Date,   default: Date.now, expires: 86400 }, // 24 saat sonra otomatik sil
});

// Model zaten tanımlıysa tekrar tanımlama (hot-reload için)
const SurveyPending = mongoose.models.SurveyPending
  || mongoose.model('SurveyPending', surveyPendingSchema);

module.exports = SurveyPending;
