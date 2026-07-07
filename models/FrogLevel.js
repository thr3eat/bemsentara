'use strict';

const mongoose = require('mongoose');

/**
 * Kurbağa seviye sistemi — EkoYıldız sunucusu
 * XP kaynakları: mesaj yazma + seste kalma
 */
const frogLevelSchema = new mongoose.Schema({
  userId:  { type: String, required: true, unique: true, index: true },
  guildId: { type: String, required: true },

  xp:      { type: Number, default: 0 },   // Toplam XP
  level:   { type: Number, default: 0 },   // Mevcut seviye (0 = Yavru Kurbağa)

  // Spam koruması: son mesaj zamanı
  lastMessageAt: { type: Date, default: null },

  // XP Boost
  doubleXpUntil: { type: Date, default: null },
  lastBoostNotificationAt: { type: Date, default: null },

  // İstatistikler
  totalMessages:    { type: Number, default: 0 },
  totalVoiceMinutes:{ type: Number, default: 0 },

  // Terfi geçmişi
  promotions: [{ level: Number, date: Date }],

  // Ayrıcalıklar / Kişiselleştirme
  profileColor:  { type: String, default: null },
  profileBio:    { type: String, default: null },
  customRoleId:  { type: String, default: null },
}, { timestamps: true });

const FrogLevel = mongoose.models.FrogLevel
  || mongoose.model('FrogLevel', frogLevelSchema);

module.exports = FrogLevel;
