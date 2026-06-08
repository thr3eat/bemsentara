'use strict';

const mongoose = require('mongoose');

/**
 * Personel ilerleme takip modeli
 */
const staffProgressSchema = new mongoose.Schema({
  userId:    { type: String, required: true, unique: true, index: true },
  guildId:   { type: String, required: true },

  // Mevcut rol seviyesi (1=Stajyer, 2=Personel, 3=Gelişmiş, 4=Sekreter)
  level:     { type: Number, default: 1 },

  // Günlük görev takibi
  daily: {
    date:          { type: String, default: '' },   // YYYY-MM-DD
    greeted:       { type: Boolean, default: false },
    voiceMinutes:  { type: Number, default: 0 },
  },

  // İstatistikler (terfi için)
  stats: {
    ticketsSolved:    { type: Number, default: 0 },
    surveysCompleted: { type: Number, default: 0 },
    activeDays:       { type: Number, default: 0 },
    consecutiveDays:  { type: Number, default: 0 },
    moderationActions:{ type: Number, default: 0 }, // Mod işlemleri
    weeklyReports:    { type: Number, default: 0 },  // Haftalık rapor sayısı
    lastCompleteDay:  { type: String, default: '' }, // Son tamamlanan gün
    dailyTicketsToday:{ type: Number, default: 0 },
    breakCredits:     { type: Number, default: 0 },  // İzin kredileri
  },

  // İzin Sistemi (Yeni)
  leaves: {
    totalCredits:      { type: Number, default: 0 },  // Toplam izin kredileri
    usedDays:          { type: [String], default: [] }, // Kullanılan izin günleri [YYYY-MM-DD]
    pendingRequests:   { type: [Object], default: [] },  // Bekleyen izin talepleri
    lastLeaveDate:     { type: String, default: null },   // Son izin tarihi
    monthlyLeaveUsed:  { type: Number, default: 0 },      // Bu ay kullanılan izin günü
    weeklyLeaveUsed:   { type: Number, default: 0 },      // Bu hafta kullanılan izin günü
  },

  // Uyarı sistemi
  warnings: {
    count:        { type: Number, default: 0 },    // Kaç gün üst üste görev yapılmadı
    lastWarned:   { type: Date, default: null },
    warnedDays:   { type: [String], default: [] }, // Uyarı atılan günler
  },

  // Terfi tarihleri
  promotedAt: { type: Date, default: null },
  joinedAt:   { type: Date, default: Date.now },

  // İstifa / Emeklilik / Kov
  status:       { type: String, default: 'active', enum: ['active', 'resigned', 'retired', 'dismissed'] },
  resignedAt:   { type: Date, default: null },
  resignReason: { type: String, default: null },
  retiredAt:    { type: Date, default: null },
  dismissedAt:  { type: Date, default: null },
  dismissReason:{ type: String, default: null },
}, { timestamps: true });

const StaffProgress = mongoose.models.StaffProgress
  || mongoose.model('StaffProgress', staffProgressSchema);

module.exports = StaffProgress;
