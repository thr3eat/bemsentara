'use strict';

const mongoose = require('mongoose');

/**
 * Personel ilerleme takip modeli
 */
const staffProgressSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  guildId: { type: String, required: true },

  // Yönetim ve Roblox entegrasyonu (YENİ!)
  robloxVerified: { type: Boolean, default: false },
  guildJoined: { type: Boolean, default: false },

  // Mevcut rol seviyesi (1=Stajyer, 2=Personel, 3=Gelişmiş, 4=Sekreter)
  level: { type: Number, default: 1 },

  // Günlük görev takibi
  daily: {
    date: { type: String, default: '' },   // YYYY-MM-DD
    startedToday: { type: Boolean, default: false },
    greeted: { type: Boolean, default: false },
    greetCount: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    chosenTask: { type: String, default: '' },   // Seçilen görevin ID'si
    chosenTaskCompleted: { type: Boolean, default: false }, // Görev tamamlandı mı?
    chatMessagesToday: { type: Number, default: 0 },    // Bugün atılan mesajlar
    ticketsSolvedToday: { type: Number, default: 0 },   // Bugün çözülen ticketlar
    moderationActionsToday: { type: Number, default: 0 },   // Bugün yapılan mod işlemleri
    
    // Ek Mesai & Ek Görev Alanları
    overtimeActive: { type: Boolean, default: false },
    overtimeTask: { type: String, default: '' }, // 'overtime_voice', 'task_chat', etc.
    overtimeCompleted: { type: Boolean, default: false },
    overtimeProgress: { type: Number, default: 0 },
    overtimeTarget: { type: Number, default: 0 },
    nightShiftActive: { type: Boolean, default: false },
    nightShiftAcceptedAt: { type: Date, default: null },

    // Görev Eksiltme & Sonraya Aktarma
    postponedToday: { type: Boolean, default: false },
    transferredVoiceMinutes: { type: Number, default: 0 },
    transferredGreets: { type: Number, default: 0 },
    transferToTomorrowVoice: { type: Number, default: 0 },
    transferToTomorrowGreets: { type: Number, default: 0 },

    // Yeni İlerleme ve Takip Alanları (V5.1)
    greetMessageId: { type: String, default: '' },
    wordGamesPlayed: { type: Number, default: 0 },
    bomGamesPlayed: { type: Number, default: 0 }
  },

  // İstatistikler (terfi için)
  stats: {
    ticketsSolved: { type: Number, default: 0 },
    chatMessages: { type: Number, default: 0 }, // YENİ: Sohbet mesaj sayısı
    totalVoiceMinutes: { type: Number, default: 0 }, // YENİ: Toplam sesli kanal süresi
    activeDays: { type: Number, default: 0 },
    consecutiveDays: { type: Number, default: 0 },
    moderationActions: { type: Number, default: 0 }, // Mod işlemleri
    weeklyReports: { type: Number, default: 0 },  // Haftalık rapor sayısı
    lastCompleteDay: { type: String, default: '' }, // Son tamamlanan gün
    dailyTicketsToday: { type: Number, default: 0 },
    breakCredits: { type: Number, default: 0 },  // İzin kredileri
    lastDayPostponed: { type: Boolean, default: false },
  },

  // İzin Sistemi (Yeni)
  leaves: {
    totalCredits: { type: Number, default: 0 },  // Toplam izin kredileri
    usedDays: { type: [String], default: [] }, // Kullanılan izin günleri [YYYY-MM-DD]
    pendingRequests: { type: [Object], default: [] },  // Bekleyen izin talepleri
    inactivityRequests: { type: [Object], default: [] }, // İnaktiflik talepleri
    lastInactivityOfferDate: { type: String, default: null }, // Son inaktiflik teklifinin günü
    lastLeaveDate: { type: String, default: null },   // Son izin tarihi
    monthlyLeaveUsed: { type: Number, default: 0 },      // Bu ay kullanılan izin günü
    weeklyLeaveUsed: { type: Number, default: 0 },      // Bu hafta kullanılan izin günü
  },

  // Gamification Sistemi (YENİ!)
  gamification: {
    totalPoints: { type: Number, default: 0 },     // Toplam puan
    level: { type: Number, default: 1 },     // XP Seviyesi (1-50)
    currentXP: { type: Number, default: 0 },     // Mevcut XP
    ecoCoins: { type: Number, default: 0 },     // YENİ: EkoCoin bakiyesi
    systemIntroduced: { type: Boolean, default: false }, // YENİ: Yeni sistem tanıtımı yapıldı mı?
    badges: {          // Rozetler
      firstTicket: { type: Boolean, default: false }, // İlk ticket çözümü
      weekWarrior: { type: Boolean, default: false }, // 7 gün ardışık
      monthMaster: { type: Boolean, default: false }, // 30 gün ardışık
      ticketHero: { type: Boolean, default: false }, // 50 ticket
      supportStar: { type: Boolean, default: false }, // 100 ticket
      legendaryHelper: { type: Boolean, default: false }, // 250 ticket
      perfectWeek: { type: Boolean, default: false }, // 7 gün 100% başarı
      chatterbox: { type: Boolean, default: false }, // 500 mesaj
      moderator: { type: Boolean, default: false }, // 30 mod işlem
      speedRunner: { type: Boolean, default: false }, // Aynı gün 5 ticket
      noMissWeek: { type: Boolean, default: false }, // 7 gün uyarısız
    },
    streak: {          // Kayıt (Streak)
      current: { type: Number, default: 0 },     // Şu anki
      longest: { type: Number, default: 0 },     // En uzun
      brokenDays: { type: Number, default: 0 },     // Kaç kez kırıldı
    },
    challengesCompleted: { type: Number, default: 0 },   // Tamamlanan haftalk zorluklar
    lastChallengeWeek: { type: Number, default: 0 },   // Son challenge haftası
    lastDailyClaim: { type: String, default: '' },   // Son günlük ödül alma tarihi YYYY-MM-DD
    lastWeeklyBriefingClaim: { type: String, default: '' }, // Son haftalık brifing ödül tarihi (YYYY-Www)
    lastMonthlyBriefingClaim: { type: String, default: '' }, // Son aylık brifing ödül tarihi (YYYY-MM)
    systemIntroducedV4: { type: Boolean, default: false },   // V4.0 tanıtımı yapıldı mı?
    versionRewardClaimedV4: { type: Boolean, default: false }, // V4.0 ödülü alındı mı?
    systemIntroducedV5: { type: Boolean, default: false },   // V5.0 tanıtımı yapıldı mı?
    versionRewardClaimedV5: { type: Boolean, default: false }, // V5.0 ödülü alındı mı?
  },

  // Moderasyon Rapor Takip Sistemi
  modReports: {
    unloggedCount: { type: Number, default: 0 },     // Loglanmamış işlem sayısı
    totalReports: { type: Number, default: 0 },      // Toplam rapor sayısı
    totalPenalties: { type: Number, default: 0 },      // Toplam ceza sayısı
    lastPenaltyDate: { type: String, default: null },   // Son ceza tarihi
  },

  // Sınav Sistemi (Genel Koordinatör için)
  exam: {
    status: { type: String, default: 'none', enum: ['none', 'scheduled', 'ongoing', 'passed', 'failed'] },
    scheduledAt: { type: Date, default: null },
    questions: { type: [Object], default: [] },
    currentQuestionIndex: { type: Number, default: 0 },
    answers: { type: [Number], default: [] },
    lastExamAttempt: { type: Date, default: null }
  },

  // Uyarı sistemi
  warnings: {
    count: { type: Number, default: 0 },    // Kaç gün üst üste görev yapılmadı
    lastWarned: { type: Date, default: null },
    warnedDays: { type: [String], default: [] }, // Uyarı atılan günler
  },

  // Sunucu Etiketi Ödülü (EKO etiketi)
  hasReceivedTagReward: { type: Boolean, default: false },

  // Terfi tarihleri
  promotedAt: { type: Date, default: null },
  joinedAt: { type: Date, default: Date.now },

  // Koç Belleği ve Soru Takibi
  coachMemory: { type: Map, of: String, default: {} },
  currentQuestion: { type: String, default: '' },
  currentQuestionKey: { type: String, default: '' },
  postponeBlocked: { type: Boolean, default: false },

  // İstifa / Emeklilik / Kov
  status: { type: String, default: 'active', enum: ['active', 'resigned', 'retired', 'dismissed'] },
  resignedAt: { type: Date, default: null },
  resignReason: { type: String, default: null },
  retiredAt: { type: Date, default: null },
  dismissedAt: { type: Date, default: null },
  dismissReason: { type: String, default: null },
  lastSalaryClaimedAt: { type: Date, default: null },

  // Bildirim ve Tercih Ayarları
  settings: {
    dailyBriefingEnabled: { type: Boolean, default: true },
    warningsEnabled: { type: Boolean, default: true }
  },

  // Moderatör Okulu Sistemi
  schoolSystem: {
    status: { type: String, default: 'none', enum: ['none', 'pending_contract', 'in_school', 'phase1_blocks_completed', 'phase1_exam_submitted', 'phase1_completed', 'phase2_blocks_completed', 'phase2_exam_submitted', 'phase2_completed', 'exam_passed', 'graduated'] },
    originalLevel: { type: Number, default: 1 },
    originalRoles: { type: [String], default: [] },
    phase: { type: Number, default: 0 },
    step: { type: Number, default: 0 },
    reminderState: { type: String, default: 'none', enum: ['none', 'pending_initial', 'pending_fastpass', 'pending_confirm', 'declined', 'accepted'] },
    reminderAttempts: { type: Number, default: 0 },
    reminderLastSentAt: { type: Date, default: null },
    fastPassUsed: { type: Boolean, default: false },
    robloxUsername: { type: String, default: '' },
    robloxUserId: { type: Number, default: 0 },
    examAnswers: { type: [String], default: [] },
    examQuestionIndex: { type: Number, default: 0 },
    completedAt: { type: Date, default: null }
  },

  // Nöbet (Duty) Yönetim Sistemi (V6.0)
  duty: {
    isActive: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    sessionVoiceMinutes: { type: Number, default: 0 },
    sessionTicketsSolved: { type: Number, default: 0 },
    sessionModerationActions: { type: Number, default: 0 },
    isBreakActive: { type: Boolean, default: false },
    breakStartedAt: { type: Date, default: null }
  },

  // Performans KPI Değerlendirmeleri (V6.0)
  performance: {
    weeklyKpi: { type: Number, default: 100 },
    lastKpiCalculationDate: { type: String, default: '' },
    kpiHistory: { type: [Object], default: [] }
  },

  // Sicil ve Disiplin Sistemi (V6.0)
  disciplinary: {
    warns: { type: [Object], default: [] },        // { date, reason, issuedBy }
    commendations: { type: [Object], default: [] }  // { date, reason, issuedBy }
  },

  // Konum Bilgisi (V6.1)
  city: { type: String, default: '' }
}, { timestamps: true });

const StaffProgress = mongoose.models.StaffProgress
  || mongoose.model('StaffProgress', staffProgressSchema);

module.exports = StaffProgress;
