'use strict';

const { EmbedBuilder } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');
const { chatWithAI } = require('./aiService');
const staffAutomation = require('./staffAutomation');

// ── Konfigürasyon ──────────────────────────────────────────────────────────
const GUILD_ID = process.env.STAFF_GUILD_ID || '1367646464804655104';

const CHOSEN_TASKS = {
  'task_chat': '💬 Aktif Sohbetçi: Sohbette en az 15 mesaj gönder.',
  'task_double_chat': '💬 Çift Sohbet: Sohbette en az 30 mesaj gönder.',
  'task_voice': '🎤 Ses Meraklısı: Ses kanallarında fazladan 15 dakika geçir.',
  'task_double_voice': '🎤 Ses Sever: Ses kanallarında fazladan 30 dakika geçir.',
  'task_ticket': '🎫 Destekçi: Bugün en az 1 ticket çöz.',
  'task_mod': '🛡️ Koruyucu: Bugün en az 1 moderasyon işlemi gerçekleştir.',
  'task_greet': '👋 Hoş Geldin Elçisi: Bugün en az 5 yeni üyeye hoş geldin de.',
  'task_double_greet': '👋 Hoş Geldin Lideri: Bugün en az 10 yeni üyeye hoş geldin de.',
  'task_word_game': '🔤 Kelime Avcısı: Kelime oyununda en az 5 doğru kelime yaz.',
  'task_bom_game': '💣 BOM Ustası: BOM oyununda en az 5 doğru sayı/bom yaz.',
  'task_chat_with_people': '💬 Sohbet Dostu: Sohbette insanlarla aktif olarak 20 mesaj yazış.'
};

const ROLES = {
  1: process.env.ROLE_STAJYER || '1518692395774906648', // Stajyer Personel
  2: process.env.ROLE_PERSONEL || '1518692394495643830', // Personel
  3: process.env.ROLE_GELISMIS || '1518692393660973186', // Kıdemli Personel
  4: process.env.ROLE_SEKRETER || '1518692392415395971', // Sekreter
  5: '1518709348506013706',                             // Kıdemli Sekreter
  6: '1518692391312298045',                             // Genel Koordinatör
};

const ROLE_NAMES = {
  1: '🎓 Stajyer Personel',
  2: '👔 Personel',
  3: '⭐ Kıdemli Personel',
  4: '👑 Sekreter',
  5: '👨‍✈️ Kıdemli Sekreter',
  6: '💼 Genel Koordinatör',
};

// ── Seviyeye özgü günlük görevler ─────────────────────────────────────────
const LEVEL_TASKS = {
  1: {
    name: 'Stajyer',
    dailyTasks: [
      '✅ Sohbet kanalına 2x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 10 dk kal (zorunlu)',
      '📚 Sunucu kurallarını oku ve hatırla',
      '👀 Diğer personelin nasıl çalıştığını izle',
      '💬 Sorularında yardım iste — öğrenmek normaldir!',
      '🎫 Ticket çözmeye başla (terfi için gerekli!)',
    ],
    rewards: '✨ Her tamamlanan gün terfi sayacına eklenir. Başarılı başlangıç yap!',
    penalties: '⏰ 3 gün görev yapmazsan rol alınır — disiplini koru!',
    tips: 'Stajyer olarak öğrenme dönemindeysin ama görevlerini aksatma!',
  },
  2: {
    name: 'Personel',
    dailyTasks: [
      '✅ Sohbet kanalına 4x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 20 dk kal (zorunlu)',
      '🎫 En az 2 ticket çözmeye çalış',
      '🚨 Kural ihlallerini raporla',
      '🛡️ En az 1 moderasyon işlemi yap',
      '💬 Yeni üyelere yardımcı ol',
    ],
    rewards: '✨ Her ticket çözümü terfi sayacına eklenir.',
    penalties: '⏰ 3 gün görev yapmazsan Stajyer\'e düşersin',
    tips: 'Personel olarak aktif olman ve moderasyon yapman bekleniyor. Sorumluluk artıyor!',
  },
  3: {
    name: 'Gelişmiş Personel',
    dailyTasks: [
      '✅ Sohbet kanalına 6x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 30 dk kal (zorunlu)',
      '🎫 Günde 3+ ticket çözmeye çalış',
      '💬 Sohbette aktif ol (haftada en az 50 mesaj)',
      '🛡️ Moderasyon kararlarında diğerlerine örnek ol',
      '📝 Sunucu gelişim önerisi yap (haftada 2)',
      '👥 Stajyerlere rehberlik et — liderlik göster!',
    ],
    rewards: '✨ Sekreterlik yolunda ilerliyor. En prestijli roldür!',
    penalties: '⏰ 3 gün görev yapmazsan Personele gerileme olur',
    tips: 'Bu seviyede liderlik becerilerin kritik. Ekibi yönet ve örnek ol!',
  },
  4: {
    name: 'Sekreter',
    dailyTasks: [
      '✅ Sohbet kanalına 10x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 60 dk kal (zorunlu)',
      '🎫 Ticket kalitesini denetle ve yönet',
      '👥 Stajyerleri eğit ve motive et',
      '📋 Haftalık personel raporu hazırla',
      '🔍 Sunucu güvenliğini aktif izle',
      '💡 Yöneticilere sunucu gelişim önerisi sun',
      '🤝 Ekibin moral duvarı ol — destek ver!',
    ],
    rewards: '👑 Sekreter rütbesinin getirdiği saygınlık ve sorumluluk sende.',
    penalties: '⏰ 3 gün görev yapmazsan Sekreterlik gözden geçirilir',
    tips: 'Sunucunun yüzüsün. Disiplin ve liderlik göster!',
  },
  5: {
    name: "Kıdemli Sekreter",
    dailyTasks: [
      '✅ Sohbet kanalına 12x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 90 dk kal (zorunlu)',
      '🛡️ Tüm moderatör ekibini denetle ve yönet',
      '📈 Sunucu istatistiklerini raporla',
      '🤝 Yöneticilerle koordineli çalış'
    ],
    rewards: '👨‍✈️ Yüksek kademe yönetim rolü.',
    penalties: '⏰ 3 gün görev yapmazsan Sekreterliğe gerileme olur',
    tips: 'Liderliği elden bırakma ve ekibi koordine et!'
  },
  6: {
    name: 'Genel Koordinatör',
    dailyTasks: [
      '✅ Sohbet kanalına 15x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 120 dk kal (zorunlu)',
      '👑 Tüm personel ve moderasyon operasyonlarını koordine et',
      '🎓 Yeni personellerin sınav süreçlerini tasarla',
      '📊 Haftalık/Aylık genel sunucu denetimini gerçekleştir'
    ],
    rewards: '💼 En üst ve en zorlu yetkili rütbesi.',
    penalties: '⏰ 3 gün görev yapmazsan Sekreter\'in Babası rütbesine gerilersin',
    tips: 'En üst rütbedesin, ekibin tüm sorumluluğu senin omuzlarında!'
  }
};

// ── Günlük gereksinimler (gün geçtikçe katlanır) ──────────────────────────
function getDailyRequirements(level, consecutiveDays = 0) {
  const multiplier = Math.pow(2, Math.floor(consecutiveDays / 30));
  const base = {
    1: { greets: 2, voiceMinutes: 10 },
    2: { greets: 4, voiceMinutes: 20 },
    3: { greets: 6, voiceMinutes: 30 },
    4: { greets: 10, voiceMinutes: 60 },
    5: { greets: 12, voiceMinutes: 90 },
    6: { greets: 15, voiceMinutes: 120 },
  };
  const b = base[level] || base[1];
  return {
    greets: Math.min(b.greets * multiplier, 20),
    voiceMinutes: Math.min(b.voiceMinutes * multiplier, 180),
  };
}

// ── Aktif gün az uyarı (< 2 gün) ──────────────────────────────────────────
async function checkLowActivityWarning(progress, client) {
  if (progress.settings?.warningsEnabled === false) {
    console.log(`[staffSystem] Warnings disabled for user ${progress.userId}. Skipping DM.`);
    return;
  }
  const activeDays = progress.stats?.activeDays || 0;
  const level = progress.level || 1;

  // Sadece 1 gün aktifse özel uyarı gönder
  if (activeDays === 1 && !progress.warnings?.lowActivityNotified) {
    const embed = new EmbedBuilder()
      .setColor(0xff9500)
      .setTitle('⚠️ Az Aktivite Uyarısı')
      .setDescription(
        `${ROLE_NAMES[level]} olarak **sadece 1 gün aktif** oldun. Biraz daha hareket etmemiz gerekecek!\n\n` +
        `Ne biraz acı? Hata mı yaptın? Problem var mı? Yöneticilere yazabilirsin. ✨\n\n` +
        `Şimdi **en az 2 gün aktif ol** ki sistemde dengeli kalalım. Başarabilirsin! 💪`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz!' })
      .setTimestamp();

    try {
      const user = await client.users.fetch(progress.userId);
      await user.send({ embeds: [embed] });
    } catch (_) { }

    progress.warnings.lowActivityNotified = true;
    await progress.save();
  }
}

// ── Terfi gereksinimleri (ZOR) ─────────────────────────────────────────────
const PROMOTION_REQUIREMENTS = {
  1: {
    ticketsSolved: 10,
    chatMessages: 50,
    totalVoiceMinutes: 120,
    activeDays: 10,
    moderationActions: 10,
    weeklyReports: 0,
    description: '10 ticket + 50 mesaj + 120 dk ses + 10 mod işlem + 10 gün aktif',
    promotionBonus: { points: 250, xp: 350 },
  },
  2: {
    ticketsSolved: 50,
    chatMessages: 200,
    totalVoiceMinutes: 500,
    activeDays: 25,
    moderationActions: 30,
    weeklyReports: 5,
    description: '50 ticket + 200 mesaj + 500 dk ses + 30 mod işlem + 5 rapor + 25 gün aktif',
    promotionBonus: { points: 500, xp: 750 },
  },
  3: {
    ticketsSolved: 150,
    chatMessages: 750,
    totalVoiceMinutes: 1500,
    activeDays: 45,
    moderationActions: 80,
    weeklyReports: 15,
    description: '150 ticket + 750 mesaj + 1500 dk ses + 80 mod işlem + 15 rapor + 45 gün aktif',
    promotionBonus: { points: 1000, xp: 1500 },
  },
  4: {
    ticketsSolved: 350,
    chatMessages: 1500,
    totalVoiceMinutes: 2500,
    activeDays: 60,
    moderationActions: 150,
    weeklyReports: 30,
    description: '350 ticket + 1500 mesaj + 2500 dk ses + 150 mod işlem + 30 rapor + 60 gün aktif',
    promotionBonus: { points: 2000, xp: 3000 }
  },
  5: {
    ticketsSolved: 500,
    chatMessages: 3000,
    totalVoiceMinutes: 5000,
    activeDays: 90,
    moderationActions: 250,
    weeklyReports: 45,
    description: '500 ticket + 3000 mesaj + 5000 dk ses + 250 mod işlem + 45 rapor + 90 gün aktif',
    promotionBonus: { points: 4000, xp: 5000 }
  },
  6: {
    ticketsSolved: 750,
    chatMessages: 5000,
    totalVoiceMinutes: 7500,
    activeDays: 120,
    moderationActions: 350,
    weeklyReports: 60,
    description: 'Maksimum Seviye Aylık Kotası: 750 ticket + 5000 mesaj + 7500 dk ses + 120 gün aktif (Aylık/Dönemlik)',
    promotionBonus: { points: 6000, xp: 7500 }
  }
};

function todayStr() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function getTargetCheckDate() {
  const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const hour = tzDate.getHours();
  if (hour < 4) {
    tzDate.setDate(tzDate.getDate() - 1);
  }
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tzDate);
}

async function hasInactivityRole(userId, client) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return false;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;

    return member.roles.cache.some(role => {
      const name = role.name.toLowerCase();
      return name.includes('inaktif') ||
        name.includes('izinli') ||
        name.includes('inactive') ||
        name.includes('inactivity') ||
        name.includes('mazeretli') ||
        name.includes('mâzeretli');
    });
  } catch (err) {
    console.error('[staffSystem] hasInactivityRole error:', err.message);
    return false;
  }
}

async function verifyActiveStaffRole(userId, client, guildId) {
  try {
    const targetGuildId = guildId || GUILD_ID;
    const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
    if (!guild) {
      console.warn(`[staffSystem] verifyActiveStaffRole: Guild ${targetGuildId} not found. Defaulting to true.`);
      return true; // Safety fallback
    }

    let member = null;
    try {
      member = await guild.members.fetch(userId);
    } catch (e) {
      if (e.code === 10007 || e.status === 404) {
        // Unknown Member (explicitly left the server)
        console.log(`[staffSystem] verifyActiveStaffRole: User ${userId} is not a member of the guild.`);
        return false;
      }
      // Any other error (network/timeout/rate limit): treat as safety fallback (return true)
      console.warn(`[staffSystem] verifyActiveStaffRole: Failed to fetch member ${userId} due to error: ${e.message}. Defaulting to true.`);
      return true;
    }

    if (!member) return false;

    // Check if member is Administrator
    if (member.permissions.has('Administrator')) return true;

    // Check if member has at least one of the staff roles defined in ROLES
    const staffRoleIds = Object.values(ROLES);
    return staffRoleIds.some(roleId => roleId && member.roles.cache.has(roleId));
  } catch (err) {
    console.error('[staffSystem] verifyActiveStaffRole fatal error:', err.message);
    return true; // Safety fallback
  }
}

async function syncAndFilterActiveStaff(allProgress, client) {
  // Moderatör okulu sürecindeki kişilere moderatör ekibi bildirimleri gönderilmemeli
  const SCHOOL_ACTIVE_STATUSES = [
    'pending_contract',
    'in_school',
    'phase1_blocks_completed',
    'phase1_exam_submitted',
    'phase1_completed',
    'phase2_blocks_completed',
    'phase2_exam_submitted',
    'phase2_completed',
  ];
  return allProgress.filter(p => {
    const schoolStatus = p.schoolSystem?.status;
    if (schoolStatus && SCHOOL_ACTIVE_STATUSES.includes(schoolStatus)) {
      return false; // Okul sürecindeyse moderatör ekibi bildirimlerinden çıkar
    }
    return true;
  });
}

function getDailyTaskCompletionStats(progress) {
  const today = todayStr();
  const isToday = progress.daily?.date === today;
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);

  const targetVoice = req.voiceMinutes + (isToday ? (progress.daily?.transferredVoiceMinutes || 0) : 0);
  const targetGreets = req.greets + (isToday ? (progress.daily?.transferredGreets || 0) : 0);

  const greeted = isToday && progress.daily?.greeted;
  const greetsSent = isToday ? (progress.daily?.greetCount || 0) : 0;
  const voiceMinutes = isToday ? (progress.daily?.voiceMinutes || 0) : 0;

  const greetPercent = targetGreets > 0 ? Math.min(100, Math.round((greetsSent / targetGreets) * 100)) : 100;
  const voicePercent = targetVoice > 0 ? Math.min(100, Math.round((voiceMinutes / targetVoice) * 100)) : 100;

  const totalPercent = Math.round(greetPercent * 0.5 + voicePercent * 0.5);

  const filledBars = Math.min(10, totalPercent > 0 ? Math.max(1, Math.floor(totalPercent / 10)) : 0);
  const emptyBars = 10 - filledBars;
  const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

  return {
    greetPercent,
    voicePercent,
    totalPercent,
    progressBar,
    greetProgress: `${greetsSent}/${targetGreets}`,
    voiceProgress: `${voiceMinutes}/${targetVoice} dk`,
    greetsSent,
    targetGreets,
    voiceMinutes,
    targetVoice
  };
}

// ── Kullanıcı al/oluştur ──────────────────────────────────────────────────
async function getOrCreate(userId, guildId, client) {
  if (!client) {
    try {
      const { getDiscordClient } = require('../discordClient');
      client = getDiscordClient();
    } catch (_) {}
  }

  let p = await StaffProgress.findOne({ userId });

  if (p) {
    const terminalStatuses = ['dismissed', 'resigned', 'retired'];
    if (terminalStatuses.includes(p.status)) {
      return null;
    }

    if (p.status !== 'active') {
      let hasStaffRole = false;
      if (client) {
        try {
          const targetGuildId = guildId || GUILD_ID;
          const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
          if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
              const staffRoleIds = Object.values(ROLES);
              hasStaffRole = member.permissions.has('Administrator') || staffRoleIds.some(roleId => roleId && member.roles.cache.has(roleId));
            }
          }
        } catch (_) {}
      }

      if (hasStaffRole) {
        p.status = 'active';
        p.dismissedAt = null;
        p.dismissReason = null;
        await p.save();
      } else {
        return null;
      }
    }
    return p;
  }

  let initialLevel = null;
  let hasStaffRole = false;
  if (client) {
    try {
      const targetGuildId = guildId || GUILD_ID;
      const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          // En yüksek seviyeli rolü bul
          for (let lvl = 6; lvl >= 1; lvl--) {
            const roleId = ROLES[lvl];
            if (roleId && member.roles.cache.has(roleId)) {
              initialLevel = lvl;
              hasStaffRole = true;
              break;
            }
          }
          if (member.permissions.has('Administrator')) {
            hasStaffRole = true;
            if (!initialLevel) initialLevel = 1;
          }
        }
      }
    } catch (err) {
      console.error('[staffSystem] Error detecting initial staff level in getOrCreate:', err.message);
    }
  }

  if (!hasStaffRole) {
    return null;
  }

  p = new StaffProgress({
    userId,
    guildId: guildId || GUILD_ID,
    level: initialLevel || 1,
    status: 'active'
  });
  await p.save();
  return p;
}

function resetDaily(progress) {
  const today = todayStr();

  // 🔧 Güvenlik: daily objesi tanımlı değilse oluştur
  if (!progress.daily) {
    const taskKeys = ['task_chat', 'task_double_chat', 'task_voice', 'task_double_voice', 'task_ticket', 'task_mod', 'task_greet', 'task_double_greet', 'task_word_game', 'task_bom_game', 'task_chat_with_people'];
    const randomTask = taskKeys[Math.floor(Math.random() * taskKeys.length)];
    progress.daily = {
      date: today,
      startedToday: false,
      greeted: false,
      greetCount: 0,
      voiceMinutes: 0,
      chosenTask: randomTask,
      chosenTaskCompleted: false,
      chatMessagesToday: 0,
      ticketsSolvedToday: 0,
      moderationActionsToday: 0,
      overtimeActive: false,
      overtimeTask: '',
      overtimeCompleted: false,
      overtimeProgress: 0,
      overtimeTarget: 0,
      nightShiftActive: false,
      nightShiftAcceptedAt: null,
      postponedToday: false,
      transferredVoiceMinutes: 0,
      transferredGreets: 0,
      transferToTomorrowVoice: 0,
      transferToTomorrowGreets: 0,
      greetMessageId: '',
      wordGamesPlayed: 0,
      bomGamesPlayed: 0
    };
    return;
  }

  // Tarih değişmişse sıfırla
  if (progress.daily.date !== today) {
    progress.stats = progress.stats || {};
    progress.stats.lastDayPostponed = !!progress.daily.postponedToday;

    const taskKeys = ['task_chat', 'task_double_chat', 'task_voice', 'task_double_voice', 'task_ticket', 'task_mod', 'task_greet', 'task_double_greet', 'task_word_game', 'task_bom_game', 'task_chat_with_people'];
    
    // Filtrele: Dünün göreviyle aynı olmasın
    const prevTask = progress.daily.chosenTask;
    let filteredKeys = taskKeys;
    if (prevTask) {
      filteredKeys = taskKeys.filter(k => k !== prevTask);
    }
    if (filteredKeys.length === 0) filteredKeys = taskKeys;
    const randomTask = filteredKeys[Math.floor(Math.random() * filteredKeys.length)];

    // Dünün ertelenen hedeflerini bugüne aktar
    const nextTransferredVoice = progress.daily.transferToTomorrowVoice || 0;
    const nextTransferredGreets = progress.daily.transferToTomorrowGreets || 0;

    progress.daily.date = today;
    progress.daily.startedToday = false;
    progress.daily.greeted = false;
    progress.daily.greetCount = 0;
    progress.daily.voiceMinutes = 0;
    progress.daily.chosenTask = randomTask;
    progress.daily.chosenTaskCompleted = false;
    progress.daily.chatMessagesToday = 0;
    progress.daily.ticketsSolvedToday = 0;
    progress.daily.moderationActionsToday = 0;

    // Ek Mesai alanlarını sıfırla
    progress.daily.overtimeActive = false;
    progress.daily.overtimeTask = '';
    progress.daily.overtimeCompleted = false;
    progress.daily.overtimeProgress = 0;
    progress.daily.overtimeTarget = 0;
    progress.daily.nightShiftActive = false;
    progress.daily.nightShiftAcceptedAt = null;

    // Görev eksiltme/aktarma alanlarını güncelle
    progress.daily.postponedToday = false;
    progress.daily.transferredVoiceMinutes = nextTransferredVoice;
    progress.daily.transferredGreets = nextTransferredGreets;
    progress.daily.transferToTomorrowVoice = 0;
    progress.daily.transferToTomorrowGreets = 0;
    
    // İlerleme ve Takip Alanlarını Sıfırla
    progress.daily.greetMessageId = '';
    progress.daily.wordGamesPlayed = 0;
    progress.daily.bomGamesPlayed = 0;
  }
}

async function recordGreet(userId, client, guildId = null) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordGreet: Invalid userId');
      return;
    }

    const p = await getOrCreate(userId, guildId || GUILD_ID, client);
    if (!p || p.status !== 'active') {
      return;
    }

    resetDaily(p);

    if (p.daily.greeted) {
      return;
    }

    const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
    const targetGreets = req.greets + (p.daily.transferredGreets || 0);

    p.daily.greetCount = (p.daily.greetCount || 0) + 1;
    const isGreetDoneNow = p.daily.greetCount >= targetGreets;

    if (isGreetDoneNow) {
      p.daily.greeted = true;

      // EkoCoin İyileştirmesi: Selamlaşma için +15 EkoCoin verelim (Seri çarpanı ile!)
      if (!p.gamification) {
        p.gamification = { totalPoints: 0, ecoCoins: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 }, lastDailyClaim: '' };
      }
      const consecutiveDays = p.stats?.consecutiveDays || 0;
      const streakMultiplier = consecutiveDays >= 30 ? 2.0 : (consecutiveDays >= 15 ? 1.5 : (consecutiveDays >= 5 ? 1.2 : 1.0));
      const baseGreetCoins = 15;
      const greetCoins = Math.floor(baseGreetCoins * streakMultiplier);
      p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + greetCoins;

      await p.save().catch(err => {
        console.error('[staffSystem] Save failed in recordGreet:', err.message);
      });

      // DM Bildirimi gönder
      try {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (discordUser) {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🌅 1. Görev (Selamlaşma) Başarıyla Tamamlandı!')
            .setDescription(
              `Merhaba <@${userId}>,\n\n` +
              `Moderatör ekibi kanalına bugünün tüm gerekli selamlarını gönderdin ve günlük selamlaşma görevin (1. Görev) başarıyla tamamlandı! (${targetGreets}/${targetGreets}) 🎉\n\n` +
              (streakMultiplier > 1.0 ? `🔥 **Seri Çarpanı Aktif:** \`${consecutiveDays} Gün\` ardışık aktifliğin sayesinde **x${streakMultiplier}** ödül kazandın!\n\n` : "") +
              `💰 **+${greetCoins} EkoCoin (E.C.)** cüzdanına eklendi!\n` +
              `💳 Güncel Bakiyen: \`${p.gamification.ecoCoins} E.C.\``
            )
            .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('staff_update_progress')
              .setLabel('👤 Moderatör Anasayfası')
              .setStyle(ButtonStyle.Primary)
          );

          await discordUser.send({ embeds: [embed], components: [row] }).catch(() => { });
        }
      } catch (dmErr) {
        console.warn(`[staffSystem] Greet DM error:`, dmErr.message);
      }

      // Eko Milyoneri Başarımı Kontrolü
      try {
        const { checkEcoMillionaire } = require('./achievementManager');
        await checkEcoMillionaire(userId, p.gamification.ecoCoins, client).catch(() => { });
      } catch (_) { }

      await checkDailyCompletion(p, client).catch(err => {
        console.error('[staffSystem] checkDailyCompletion failed:', err.message);
      });
    } else {
      await p.save().catch(err => {
        console.error('[staffSystem] Save failed in recordGreet progress:', err.message);
      });

      // Send a DM notification updating the user on their greet progress (Only ONCE!)
      if (!p.daily.greetMessageId) {
        try {
          const discordUser = await client.users.fetch(userId).catch(() => null);
          if (discordUser) {
            const embed = generateGreetProgressEmbed(p);
            const components = getGreetProgressComponents();
            const sentMsg = await discordUser.send({ embeds: [embed], components }).catch(() => null);
            if (sentMsg) {
              p.daily.greetMessageId = sentMsg.id;
              await p.save().catch(() => {});
            }
          }
        } catch (dmErr) {
          console.warn(`[staffSystem] Greet progress DM error:`, dmErr.message);
        }
      }
    }
    await checkChosenTaskCompletion(p, client).catch(() => { });
  } catch (err) {
    console.error('[staffSystem] recordGreet error:', err.message);
  }
}

async function addVoiceMinutes(userId, minutes, client) {
  try {
    if (!userId || !minutes || minutes <= 0) {
      console.warn('[staffSystem] addVoiceMinutes: Invalid parameters', { userId, minutes });
      return;
    }

    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') {
      return;
    }

    resetDaily(p);
    const req = getDailyRequirements(p.level, p.stats.consecutiveDays || 0);
    const targetVoice = req.voiceMinutes + (p.daily.transferredVoiceMinutes || 0);
    const wasVoiceDoneBefore = (p.daily.voiceMinutes || 0) >= targetVoice;

    p.daily.voiceMinutes += minutes;
    p.stats.totalVoiceMinutes = (p.stats.totalVoiceMinutes || 0) + minutes;

    const isVoiceDoneNow = (p.daily.voiceMinutes || 0) >= targetVoice;

    if (!wasVoiceDoneBefore && isVoiceDoneNow) {
      try {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (discordUser) {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎙️ 2. Görev (Ses Aktifliği) Başarıyla Tamamlandı!')
            .setDescription(
              `Merhaba <@${userId}>,\n\n` +
              `Bugünkü ses aktifliği göreviniz (**${targetVoice} dakika**) başarıyla tamamlandı! 🎉\n\n` +
              `Ses kanallarında aktif kalarak görevinizi yerine getirdiniz. Tebrikler! 🎤`
            )
            .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('staff_update_progress')
              .setLabel('👤 Moderatör Anasayfası')
              .setStyle(ButtonStyle.Primary)
          );

          await discordUser.send({ embeds: [embed], components: [row] }).catch(() => { });
        }
      } catch (dmErr) {
        console.warn(`[staffSystem] Voice task completion DM error:`, dmErr.message);
      }
    }

    // Ek Mesai / Ek Görev (Ses) İlerlemesi
    if (p.daily.overtimeActive && !p.daily.overtimeCompleted && (p.daily.overtimeTask === 'task_voice' || p.daily.overtimeTask === 'overtime_voice')) {
      p.daily.overtimeProgress = (p.daily.overtimeProgress || 0) + minutes;
      if (p.daily.overtimeProgress >= p.daily.overtimeTarget) {
        await completeOvertime(p, client).catch(() => { });
      }
    }

    // YENİ: Ses aktifliği için E.C. kazanımı (Saatte 15 E.C. -> Dakikada 0.25 E.C.)
    // Bunu sadece 60'ın katlarında veya saat başı hesaplayabiliriz ya da küsüratlı verip gösterebiliriz.
    // Şimdilik 60 dakikada bir toplu ödül verelim:
    const oldHours = Math.floor((p.stats.totalVoiceMinutes - minutes) / 60);
    const newHours = Math.floor(p.stats.totalVoiceMinutes / 60);
    if (newHours > oldHours) {
      const hoursGained = newHours - oldHours;
      const ecGained = hoursGained * 15;
      await addEkoCoin(p, ecGained, client, 'Sesli Kanal Aktifliği');
    }

    await p.save().catch(err => {
      console.error('[staffSystem] Save failed in addVoiceMinutes:', err.message);
      return;
    });
    await checkChosenTaskCompletion(p, client).catch(() => { });
    await checkDailyCompletion(p, client).catch(err => {
      console.error('[staffSystem] checkDailyCompletion failed:', err.message);
    });
    try {
      const { checkAutoPromotion } = require('./unitService');
      await checkAutoPromotion(userId, client, 'voice').catch(() => { });
    } catch (_) { }
  } catch (err) {
    console.error('[staffSystem] addVoiceMinutes error:', err.message);
  }
}

// ── EkoCoin Ekleme ve Bildirim ─────────────────────────────────────────────
async function addEkoCoin(progress, amount, client, reason) {
  progress.gamification = progress.gamification || {};
  progress.gamification.ecoCoins = (progress.gamification.ecoCoins || 0) + amount;

  if (client) {
    try {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
      const user = await client.users.fetch(progress.userId);
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🎯 Görev Tamamlandı!')
        .setDescription(`**${reason}** görevini başarıyla bitirdin. Diğer göreve başlamak için aşağıdaki butona tıklayabilirsin!`)
        .setFooter({ text: 'Eko Yıldız • Personel Sistemi' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('talk_to_coach')
          .setLabel('💬 Koçla Konuş')
          .setStyle(ButtonStyle.Primary)
      );

      await user.send({ embeds: [embed], components: [row] }).catch(() => { });
    } catch (_) { }
  }
}

// ── Mod işlem kaydı (yeni) ─────────────────────────────────────────────────
const recentlyRewardedModActions = new Map();
const REWARD_DEDUP_WINDOW_MS = 10000; // 10 saniye

async function recordModerationAction(userId, client, targetUserId = null, actionType = null) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordModerationAction: Invalid userId');
      return;
    }

    // Mükerrer ödüllendirme/sayma kontrolü (10 saniye içinde aynı yetkili ve aynı hedef kullanıcı için tekil işlem)
    if (targetUserId && actionType) {
      const key = `${userId}:${targetUserId}`;
      const lastTime = recentlyRewardedModActions.get(key);
      if (lastTime && (Date.now() - lastTime) < REWARD_DEDUP_WINDOW_MS) {
        console.log(`[staffSystem] Duplicate moderation action reward blocked for ${userId} on ${targetUserId} (${actionType})`);
        return;
      }
      recentlyRewardedModActions.set(key, Date.now());

      // Bellek temizliği
      if (recentlyRewardedModActions.size > 500) {
        const now = Date.now();
        for (const [k, v] of recentlyRewardedModActions) {
          if (now - v > REWARD_DEDUP_WINDOW_MS) recentlyRewardedModActions.delete(k);
        }
      }
    }

    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);

    p.stats.moderationActions = (p.stats.moderationActions || 0) + 1;
    p.daily.moderationActionsToday = (p.daily.moderationActionsToday || 0) + 1;

    // Ek Görev (Mod) İlerlemesi
    if (p.daily.overtimeActive && !p.daily.overtimeCompleted && p.daily.overtimeTask === 'task_mod') {
      p.daily.overtimeProgress = (p.daily.overtimeProgress || 0) + 1;
      if (p.daily.overtimeProgress >= p.daily.overtimeTarget) {
        await completeOvertime(p, client).catch(() => { });
      }
    }

    // YENİ: E.C. Kazandır
    await addEkoCoin(p, 10, client, 'Moderasyon İşlemi');

    await p.save().catch(err => {
      console.error('[staffSystem] Save failed:', err.message);
    });
    await checkChosenTaskCompletion(p, client).catch(() => { });
    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordModerationAction error:', err.message);
  }
}

// ── Haftalık rapor kaydı (yeni) ────────────────────────────────────────────
async function recordWeeklyReport(userId, client) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordWeeklyReport: Invalid userId');
      return;
    }

    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);

    p.stats.weeklyReports = (p.stats.weeklyReports || 0) + 1;
    await p.save().catch(err => {
      console.error('[staffSystem] Save failed:', err.message);
    });
    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordWeeklyReport error:', err.message);
  }
}

function addChatMessage(p) {
  if (p && p.stats) {
    p.stats.chatMessages = (p.stats.chatMessages || 0) + 1;
  }
}

async function checkDailyCompletion(progress, client) {
  // 🔧 Güvenlik: Objeler tanımlı değilse oluştur
  if (!progress.stats) progress.stats = {};
  if (!progress.daily) progress.daily = { date: '', greeted: false, voiceMinutes: 0 };
  if (!progress.warnings) progress.warnings = { count: 0 };

  const today = todayStr();
  const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays || 0);
  const targetVoice = req.voiceMinutes + (progress.daily.transferredVoiceMinutes || 0);

  const greetDone = progress.daily.greeted;
  const voiceDone = progress.daily.voiceMinutes >= targetVoice;

  // ✅ BUGFIX: lastCompleteDay'in bugün olup olmadığını kontrol et
  const alreadyCompletedToday = progress.stats.lastCompleteDay === today;

  if (greetDone && voiceDone && !alreadyCompletedToday) {
    // Görev tamamlandı ve bugün ilk kez tamamlanıyor
    progress.stats.activeDays = (progress.stats.activeDays || 0) + 1;
    progress.stats.consecutiveDays = (progress.stats.consecutiveDays || 0) + 1;
    progress.stats.lastCompleteDay = today;
    progress.warnings.count = 0;

    // 🎮 Gamification: Günlük görev tamamlama ödülü
    if (!progress.gamification) {
      progress.gamification = { totalPoints: 0, ecoCoins: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 }, lastDailyClaim: '' };
    }
    const levelMultiplier = 1 + (progress.level * 0.25); // Seviye arttıkça daha fazla ödül
    progress.gamification.totalPoints = (progress.gamification.totalPoints || 0) + Math.floor(25 * levelMultiplier); // Günlük 25+ puan
    progress.gamification.currentXP = (progress.gamification.currentXP || 0) + Math.floor(100 * levelMultiplier); // Günlük 100+ XP

    // EkoCoin İyileştirmesi: Tüm görevlerin tamamlanması halinde EkoCoin ödülü (Seri çarpanı ile!)
    const consecutiveDays = progress.stats?.consecutiveDays || 0;
    const streakMultiplier = consecutiveDays >= 30 ? 2.0 : (consecutiveDays >= 15 ? 1.5 : (consecutiveDays >= 5 ? 1.2 : 1.0));
    const baseCoinReward = Math.floor(40 * levelMultiplier);
    const coinReward = Math.floor(baseCoinReward * streakMultiplier);
    progress.gamification.ecoCoins = (progress.gamification.ecoCoins || 0) + coinReward;

    // Görev tamamlama mesajı gönder
    if (client) {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const taskEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🎉 GÜNLÜK GÖREVLER TAMAMLANDI!')
        .setDescription(
          `Tebrikler <@${progress.userId}>, bugünün tüm günlük görevlerini (Selamlaşma + Ses Aktifliği) başarıyla tamamladın!\n\n` +
          `✨ **+${Math.floor(100 * levelMultiplier)} XP** kazanıldı!\n` +
          (streakMultiplier > 1.0 ? `🔥 **Seri Çarpanı Aktif:** \`${consecutiveDays} Gün\` ardışık aktifliğin sayesinde **x${streakMultiplier}** ödül kazandın!\n\n` : "") +
          `💰 **+${coinReward} EkoCoin (E.C.)** kazanıldı!\n` +
          `💳 Güncel Bakiyen: \`${progress.gamification.ecoCoins} E.C.\``
        )
        .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('staff_update_progress')
          .setLabel('👤 Moderatör Anasayfası')
          .setStyle(ButtonStyle.Primary)
      );

      try {
        const user = await client.users.fetch(progress.userId);
        await user.send({ embeds: [taskEmbed], components: [row] }).catch(() => { });
      } catch (_) { }
    }

    // Eko Milyoneri Başarımı Kontrolü
    try {
      const { checkEcoMillionaire } = require('./achievementManager');
      await checkEcoMillionaire(progress.userId, progress.gamification.ecoCoins, client).catch(() => { });
    } catch (_) { }

    // Level up kontrol et
    const nextLevelXp = getXpForLevel((progress.gamification.level || 1) + 1);
    if (progress.gamification.currentXP >= nextLevelXp) {
      progress.gamification.level = (progress.gamification.level || 1) + 1;
      progress.gamification.currentXP = 0;

      // Level up mesajı gönder
      if (client && progress.gamification.level > 1) {
        const levelEmbed = new EmbedBuilder()
          .setColor(0xff006e)
          .setTitle(`🎉 LEVEL UP! ${progress.gamification.level}`)
          .setDescription(`Seni görüyoruz! Her görev seni daha güçlü yapıyor! 🚀`)
          .setFooter({ text: 'Eko Yıldız • Gamification' })
          .setTimestamp();

        try {
          const user = await client.users.fetch(progress.userId);
          await user.send({ embeds: [levelEmbed] });
        } catch (_) { }
      }
    }

    await progress.save().catch(err => {
      console.error('[staffSystem] Save failed in checkDailyCompletion:', err.message);
    });

    console.log(`[staffSystem] ${progress.userId} günlük görev tamamlandı — ${progress.stats.activeDays} gün`);
    await checkPromotion(progress, client);
  }
}

async function checkChosenTaskCompletion(progress, client) {
  try {
    if (!progress.daily || !progress.daily.chosenTask || progress.daily.chosenTaskCompleted) return;

    let completed = false;
    const task = progress.daily.chosenTask;

    if (task === 'task_chat') {
      if ((progress.daily.chatMessagesToday || 0) >= 15) {
        completed = true;
      }
    } else if (task === 'task_double_chat') {
      if ((progress.daily.chatMessagesToday || 0) >= 30) {
        completed = true;
      }
    } else if (task === 'task_voice') {
      const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays || 0);
      if ((progress.daily.voiceMinutes || 0) >= req.voiceMinutes + 15) {
        completed = true;
      }
    } else if (task === 'task_double_voice') {
      const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays || 0);
      if ((progress.daily.voiceMinutes || 0) >= req.voiceMinutes + 30) {
        completed = true;
      }
    } else if (task === 'task_ticket') {
      if ((progress.daily.ticketsSolvedToday || 0) >= 1) {
        completed = true;
      }
    } else if (task === 'task_mod') {
      if ((progress.daily.moderationActionsToday || 0) >= 1) {
        completed = true;
      }
    } else if (task === 'task_greet') {
      if ((progress.daily.greetCount || 0) >= 5) {
        completed = true;
      }
    } else if (task === 'task_double_greet') {
      if ((progress.daily.greetCount || 0) >= 10) {
        completed = true;
      }
    } else if (task === 'task_word_game') {
      if ((progress.daily.wordGamesPlayed || 0) >= 5) {
        completed = true;
      }
    } else if (task === 'task_bom_game') {
      if ((progress.daily.bomGamesPlayed || 0) >= 5) {
        completed = true;
      }
    } else if (task === 'task_chat_with_people') {
      if ((progress.daily.chatMessagesToday || 0) >= 20) {
        completed = true;
      }
    }

    if (completed) {
      progress.daily.chosenTaskCompleted = true;

      // %25 terfi katkısı ekle
      const nextReq = PROMOTION_REQUIREMENTS[progress.level];
      if (nextReq) {
        const ticketsBonus = Math.ceil((nextReq.ticketsSolved || 0) * 0.25);
        const chatBonus = Math.ceil((nextReq.chatMessages || 0) * 0.25);
        const voiceBonus = Math.ceil((nextReq.totalVoiceMinutes || 0) * 0.25);
        const activeDaysBonus = Math.ceil((nextReq.activeDays || 0) * 0.25);
        const modsBonus = Math.ceil((nextReq.moderationActions || 0) * 0.25);
        const reportsBonus = Math.ceil((nextReq.weeklyReports || 0) * 0.25);

        progress.stats.ticketsSolved = (progress.stats.ticketsSolved || 0) + ticketsBonus;
        progress.stats.chatMessages = (progress.stats.chatMessages || 0) + chatBonus;
        progress.stats.totalVoiceMinutes = (progress.stats.totalVoiceMinutes || 0) + voiceBonus;
        progress.stats.activeDays = (progress.stats.activeDays || 0) + activeDaysBonus;
        progress.stats.moderationActions = (progress.stats.moderationActions || 0) + modsBonus;
        progress.stats.weeklyReports = (progress.stats.weeklyReports || 0) + reportsBonus;
      }

      await progress.save().catch(err => {
        console.error('[staffSystem] Save failed in checkChosenTaskCompletion:', err.message);
      });

      try {
        const { addNotification } = require("../../utils/notification");
        await addNotification(progress.userId, {
          title: "🎯 Seçmeli Görev Tamamlandı!",
          message: `Bugünün seçimli görevi olan "${CHOSEN_TASKS[task] || task}" başarıyla tamamlandı. Terfi hedeflerinize %25 doğrudan katkı sağlandı!`,
          icon: "🎉"
        });
      } catch (nErr) {
        console.error("[staffSystem] checkChosenTaskCompletion notification error:", nErr.message);
      }

      // DM tebrik mesajı gönder
      if (client) {
        const discordUser = await client.users.fetch(progress.userId).catch(() => null);
        if (discordUser) {
          const taskLabel = CHOSEN_TASKS[task] || task;
          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎯 Seçmeli Görev Başarıyla Tamamlandı!')
            .setDescription(
              `Tebrikler <@${progress.userId}>, bugünün seçimli görevi olan **"${taskLabel}"** başarıyla tamamlandı! 🎉\n\n` +
              `🚀 **Ödülünüz:** Bir sonraki rütbeye terfi etmeniz için gereken hedeflerinize **%25 doğrudan ilerleme katkısı** sağlandı! Tebrikler! 💪`
            )
            .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
            .setTimestamp();

          await discordUser.send({ embeds: [embed] }).catch(() => { });
        }
      }

      // Terfi durumunu kontrol et
      await checkPromotion(progress, client).catch(() => { });
    }
  } catch (err) {
    console.error('[staffSystem] checkChosenTaskCompletion error:', err.message);
  }
}

async function recordTicketSolved(userId, client) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordTicketSolved: Invalid userId');
      return;
    }

    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);

    p.stats.ticketsSolved = (p.stats.ticketsSolved || 0) + 1;
    p.daily.ticketsSolvedToday = (p.daily.ticketsSolvedToday || 0) + 1;

    // Ek Görev (Ticket) İlerlemesi
    if (p.daily.overtimeActive && !p.daily.overtimeCompleted && p.daily.overtimeTask === 'task_ticket') {
      p.daily.overtimeProgress = (p.daily.overtimeProgress || 0) + 1;
      if (p.daily.overtimeProgress >= p.daily.overtimeTarget) {
        await completeOvertime(p, client).catch(() => { });
      }
    }

    // 🎮 Gamification: XP ve Puan ekle
    if (!p.gamification) {
      p.gamification = {
        totalPoints: 0,
        level: 1,
        currentXP: 0,
        badges: {},
        streak: { current: 0, longest: 0, brokenDays: 0 },
        challengeProgress: {},
      };
    }

    // 📊 Seviye-bazlı puan artışı (sınıflandırma teşviki) - ⬆️ ARTTIRILDI
    const levelMultiplier = 1 + (p.level * 0.25); // Level arttıkça daha fazla puan (0.2 → 0.25)
    const xpGain = Math.floor(85 * levelMultiplier); // Ticket başına 85+ XP (55 → 85)
    const pointsGain = Math.floor(20 * levelMultiplier); // Ticket başına 20+ puan (12 → 20)
    p.gamification.totalPoints = (p.gamification.totalPoints || 0) + pointsGain;
    p.gamification.currentXP = (p.gamification.currentXP || 0) + xpGain;

    // Level up kontrol et
    const nextLevelXp = getXpForLevel((p.gamification.level || 1) + 1);
    if (p.gamification.currentXP >= nextLevelXp) {
      p.gamification.level = (p.gamification.level || 1) + 1;
      p.gamification.currentXP = 0;

      // Level up mesajı gönder
      if (client && p.gamification.level > 1) {
        const levelEmbed = new EmbedBuilder()
          .setColor(0xff006e)
          .setTitle(`🎉 LEVEL UP! ${p.gamification.level}`)
          .setDescription(`Seni görüyoruz! Her ticket seni daha güçlü yapıyor! 🚀`)
          .setFooter({ text: 'Eko Yıldız • Gamification' })
          .setTimestamp();

        try {
          const user = await client.users.fetch(userId);
          await user.send({ embeds: [levelEmbed] });
        } catch (_) { }
      }
    }

    // Sert çalışma takibi: gün içinde 3+ ticket = haftada 1 gün izin hediyesi
    if (!p.stats.dailyTicketsToday) p.stats.dailyTicketsToday = 0;
    p.stats.dailyTicketsToday += 1;

    if (p.stats.dailyTicketsToday % 2 === 0) {
      p.stats.breakCredits = (p.stats.breakCredits || 0) + 1;
      await sendBreakRewardDM(p, client).catch(err => {
        console.warn(`[staffSystem] sendBreakRewardDM error for ${userId}:`, err.message);
      });
    }

    // Hız ustası rozeti kontrol et
    if (p.stats.dailyTicketsToday === 5 && !p.gamification.badges?.speedRunner) {
      await checkAndUnlockBadges(p, client);
    }

    // YENİ: Gizli Başarım (Günde 30 Ticket)
    if (p.stats.dailyTicketsToday === 30) {
      try {
        const user = await client.users.fetch(userId);
        const secretEmbed = new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle('🔥 GİZLİ BAŞARIM AÇILDI: Efsanevi Çalışan!')
          .setDescription('Bugün tam 30 ticket çözdün! Bu muazzam bir başarı! Sana özel **+1000 E.C.** bonus hediye ediyoruz!')
          .setFooter({ text: 'Eko Yıldız • Gizli Başarımlar' });
        await user.send({ embeds: [secretEmbed] }).catch(() => { });
        await addEkoCoin(p, 1000, client, 'GİZLİ BAŞARIM: Efsanevi Çalışan (30 Ticket)');
      } catch (_) { }
    }

    // YENİ: E.C. Kazandır
    await addEkoCoin(p, 5, client, 'Ticket Çözümü');

    await p.save().catch(err => {
      console.error('[staffSystem] Save failed in recordTicketSolved:', err.message);
      return;
    });

    // Rozetleri kontrol et
    await checkAndUnlockBadges(p, client).catch(() => { });
    await checkChosenTaskCompletion(p, client).catch(() => { });

    // 🎫 Ticket görevi ilerleme DM'i
    await sendTicketTaskProgressDM(p, client).catch(() => { });

    try {
      const { checkAutoPromotion } = require('./unitService');
      await checkAutoPromotion(userId, client, 'ticket').catch(() => { });
    } catch (_) { }

    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordTicketSolved error:', err.message);
  }
}

/**
 * Ticket çözümü sonrası personele görev ilerleme DM'i gönderir.
 * - Ticket görevi varsa: progress bar + kaç tane kaldı
 * - Ticket görevi yoksa: EK GÖREV mesajı + %30 bonus teklifi
 */
async function sendTicketTaskProgressDM(p, client) {
  if (!client) return;
  const discordUser = await client.users.fetch(p.userId).catch(() => null);
  if (!discordUser) return;

  const hasTicketTask = p.daily?.chosenTask === 'task_ticket';
  const nextReq = PROMOTION_REQUIREMENTS[p.level];
  const solved = p.stats.ticketsSolved || 0;
  const required = nextReq?.ticketsSolved || 1;
  const pct = Math.min(100, Math.round((solved / required) * 100));

  // Progress bar oluştur (20 blok)
  const filled = Math.round(pct / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);

  if (hasTicketTask && !p.daily?.chosenTaskCompleted) {
    // Görev var ve henüz tamamlanmadı — ilerleme göster
    const solvedToday = p.daily?.ticketsSolvedToday || 0;
    const taskTarget = 1; // task_ticket = 1 ticket
    const taskPct = Math.min(100, Math.round((solvedToday / taskTarget) * 100));
    const taskFilled = Math.round(taskPct / 5);
    const taskBar = '█'.repeat(taskFilled) + '░'.repeat(20 - taskFilled);

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('🎫 Ticket Görevi — İlerleme Güncellendi')
      .setDescription(
        `**Bugünkü Ticket Görevi Durumu:**\n` +
        `\`[${taskBar}] ${taskPct}%\`\n` +
        `📊 Bugün: **${solvedToday}/${taskTarget}** ticket çözüldü\n\n` +
        `**Terfi İlerlemen (Ticket):**\n` +
        `\`[${bar}] ${pct}%\`\n` +
        `🎯 Toplam: **${solved}/${required}** ticket\n\n` +
        `💪 Devam et! Görevi tamamlamak **%25 terfi katkısı** sağlıyor!`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    await discordUser.send({ embeds: [embed] }).catch(() => {});

  } else if (!hasTicketTask) {
    // Ticket görevi YOK — özel bonus mesajı
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🎫 TİCKET GÖREVİN YOKKEN TİCKET GÖREVİNİ YAPTIN!')
      .setDescription(
        `Tebrikler! Bugün seçmeli görevin **ticket çözümü** olmadığı hâlde ticket çözdün! 🔥\n\n` +
        `**Terfi İlerlemen (Ticket):**\n` +
        `\`[${bar}] ${pct}%\`\n` +
        `🎯 Toplam: **${solved}/${required}** ticket\n\n` +
        `🎁 **EK GÖREV TAMAMLADIN!**\n` +
        `1 tane daha ek görev yaparsan **dilediğin rütbe terfi alma görevin** yapılmış olarak sayılacak!\n\n` +
        `> 💡 **%30 bonus** - Bu extra görevi tamamladığında terfi gereksinimlerinin **%30'u** otomatik olarak doldurulur.`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi — Ek Görev Sistemi' })
      .setTimestamp();

    await discordUser.send({ embeds: [embed] }).catch(() => {});

    // %30 bonus ekle (extra görev ödülü olarak işaretle)
    if (!p.daily) p.daily = {};
    if (!p.daily.extraTicketBonusGiven) {
      p.daily.extraTicketBonusGiven = true;
      // Terfi istatistiklerine %30 katkı
      if (nextReq) {
        const bonus30 = (val, req) => Math.ceil((req || 0) * 0.30);
        p.stats.ticketsSolved = (p.stats.ticketsSolved || 0) + bonus30(null, nextReq.ticketsSolved);
        p.stats.chatMessages = (p.stats.chatMessages || 0) + bonus30(null, nextReq.chatMessages);
        p.stats.totalVoiceMinutes = (p.stats.totalVoiceMinutes || 0) + bonus30(null, nextReq.totalVoiceMinutes);
        p.stats.activeDays = (p.stats.activeDays || 0) + bonus30(null, nextReq.activeDays);
        p.stats.moderationActions = (p.stats.moderationActions || 0) + bonus30(null, nextReq.moderationActions);
      }
      await p.save().catch(() => {});
    }
  }
  // Görev zaten tamamlandıysa sessizce çık (checkChosenTaskCompletion kendi DM'ini gönderir)
}

async function recordChatMessage(userId, client, guildId = null) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordChatMessage: Invalid userId');
      return;
    }

    const p = await getOrCreate(userId, guildId || GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);

    p.stats.chatMessages = (p.stats.chatMessages || 0) + 1;
    p.daily.chatMessagesToday = (p.daily.chatMessagesToday || 0) + 1;

    // Ek Görev (Sohbet) İlerlemesi
    if (p.daily.overtimeActive && !p.daily.overtimeCompleted && p.daily.overtimeTask === 'task_chat') {
      p.daily.overtimeProgress = (p.daily.overtimeProgress || 0) + 1;
      if (p.daily.overtimeProgress >= p.daily.overtimeTarget) {
        await completeOvertime(p, client).catch(() => { });
      }
    }

    await p.save().catch(err => {
      console.error('[staffSystem] Save failed:', err.message);
    });
    await checkAndUnlockBadges(p, client).catch(() => { });
    await checkChosenTaskCompletion(p, client).catch(() => { });
    try {
      const { checkAutoPromotion } = require('./unitService');
      await checkAutoPromotion(userId, client, 'chat').catch(() => { });
    } catch (_) { }
    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordChatMessage error:', err.message);
  }
}

async function checkPromotion(progress, client) {
  try {
    if (!progress || !progress.stats) {
      console.warn('[staffSystem] checkPromotion: Invalid progress object');
      return;
    }

    const currentLevel = progress.level || 1;
    const req = PROMOTION_REQUIREMENTS[currentLevel];
    if (!req) {
      console.debug(`[staffSystem] No promotion requirements for level ${currentLevel}`);
      return;
    }

    const stats = progress.stats;
    const ok =
      (stats.ticketsSolved || 0) >= req.ticketsSolved &&
      (stats.chatMessages || 0) >= req.chatMessages &&
      (stats.totalVoiceMinutes || 0) >= req.totalVoiceMinutes &&
      (stats.activeDays || 0) >= req.activeDays &&
      (stats.moderationActions || 0) >= req.moderationActions &&
      (stats.weeklyReports || 0) >= req.weeklyReports;

    if (ok) {
      if (currentLevel >= 6) {
        return;
      }

      // Her rütbe geçişinde terfi yerine sınav sürecini başlat
      if (!progress.exam || progress.exam.status === 'none') {
        try {
          const targetLevel = currentLevel + 1;
          const targetRoleName = ROLE_NAMES[targetLevel] || `Seviye ${targetLevel}`;

          const { generateExamQuestions } = require('./aiExamService');
          const questions = await generateExamQuestions(targetLevel);

          const scheduled = new Date();
          scheduled.setDate(scheduled.getDate() + 2); // 2 gün sonra
          scheduled.setHours(12, 0, 0, 0); // Öğlen 12:00

          progress.exam = {
            status: 'scheduled',
            scheduledAt: scheduled,
            questions: questions,
            currentQuestionIndex: 0,
            answers: [],
            lastExamAttempt: null
          };
          await progress.save();

          try {
            const { addNotification } = require("../../utils/notification");
            await addNotification(progress.userId, {
              title: "🎓 Terfi Sınavına Hak Kazandınız!",
              message: `Tebrikler! ${targetRoleName} rütbesine terfi etmek için gerekli tüm koşulları başarıyla tamamladınız ve sınava hak kazandınız.`,
              icon: "🎓"
            });
          } catch (nErr) {
            console.error("[staffSystem] checkPromotion notification error:", nErr.message);
          }

          // DM Gönder
          const user = await client.users.fetch(progress.userId).catch(() => null);
          if (user) {
            const infoEmbed = new EmbedBuilder()
              .setColor(0xf39c12)
              .setTitle(`🎓 TEBRİKLER! ${targetRoleName} Terfi Sınavına Hak Kazandın!`)
              .setDescription(
                `Merhaba <@${progress.userId}>, **${targetRoleName}** rütbesine terfi etmek için gerekli tüm koşulları başarıyla tamamladın!\n\n` +
                `Bu yeni rütbeye ulaşabilmen için **10 soruluk çoktan seçmeli bir Yapay Zeka Sınavı**'nı başarıyla geçmen gerekiyor.\n\n` +
                `📅 **Sınav Tarihi:** ${scheduled.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (Öğlen 12:00)\n\n` +
                `📋 **Sınav İpuçları & Bilgileri:**\n` +
                `• Sınavda en az **8 doğru** yapman gerekmektedir.\n` +
                `• Konular: Yetki düzeyinize uygun moderasyon standartları, sunucu kuralları ve yönetim rehberi.\n` +
                `• Sınav saati geldiğinde bot sana otomatik olarak bir DM gönderecektir.\n\n` +
                `Hazırlanmak için 2 günün var, bol şans! 💪`
              )
              .setFooter({ text: 'Eko Yıldız • Sınav ve Eğitim Sistemi' })
              .setTimestamp();
            await user.send({ embeds: [infoEmbed] }).catch(() => { });
          }
          console.log(`[staffSystem] ${progress.userId} has qualified for Level ${targetLevel} exam. Scheduled at: ${scheduled}`);
        } catch (e) {
          console.error('[staffSystem] Sınav planlanırken hata:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('[staffSystem] checkPromotion error:', err.message);
  }
}

async function promote(progress, client) {
  try {
    if (!progress || !client) {
      console.warn('[staffSystem] promote: Missing progress or client');
      return;
    }

    const oldLevel = progress.level || 1;
    const newLevel = oldLevel + 1;
    if (newLevel > 6) return;

    // 🎁 Terfi bonusu ekle
    const req = PROMOTION_REQUIREMENTS[oldLevel];
    if (req && req.promotionBonus) {
      progress.gamification.totalPoints = (progress.gamification.totalPoints || 0) + req.promotionBonus.points;
      progress.gamification.currentXP = (progress.gamification.currentXP || 0) + req.promotionBonus.xp;
    }

    progress.level = newLevel;
    progress.promotedAt = new Date();
    // İstatistik sıfırla
    progress.stats.ticketsSolved = 0;
    progress.stats.chatMessages = 0;
    progress.stats.totalVoiceMinutes = 0;
    progress.stats.activeDays = 0;
    progress.stats.moderationActions = 0;
    progress.stats.weeklyReports = 0;

    await progress.save().catch(err => {
      console.error('[staffSystem] Save failed in promote:', err.message);
      return;
    });

    // ── Role management ──────────────────────────────────────────────────────
    const guild = await client.guilds.fetch(GUILD_ID).catch(err => {
      console.warn(`[staffSystem] Guild ${GUILD_ID} not found:`, err.code);
      return null;
    });

    if (!guild) {
      console.error(`[staffSystem] Cannot access guild ${GUILD_ID} for role assignment`);
      return;
    }

    const member = await guild.members.fetch(progress.userId).catch(err => {
      console.warn(`[staffSystem] Member ${progress.userId} not found:`, err.code);
      return null;
    });
    if (!member) {
      console.warn(`[staffSystem] Cannot access member ${progress.userId} for role assignment`);
      return;
    }

    const oldRoleId = ROLES[oldLevel];
    const newRoleId = ROLES[newLevel];

    // Eski rolü kaldır
    if (oldRoleId) {
      await member.roles.remove(oldRoleId, 'Terfi').catch(roleErr => {
        console.warn(`[staffSystem] Cannot remove old role (${oldRoleId}):`, roleErr.code, roleErr.message);
        if (roleErr.code === 50) {
          console.error('[staffSystem] ⚠️ Bot missing ManageRoles permission');
        }
      });
    }

    // Yeni rolü ekle
    if (newRoleId) {
      await member.roles.add(newRoleId, 'Terfi').catch(roleErr => {
        console.warn(`[staffSystem] Cannot add new role (${newRoleId}):`, roleErr.code, roleErr.message);
        if (roleErr.code === 50) {
          console.error('[staffSystem] ⚠️ Bot missing ManageRoles permission');
        }
      });
    }

    await staffAutomation.syncMainGuildRoles(client, progress.userId).catch(() => { });

    const isFinal = newLevel === 6;
    const embed = new EmbedBuilder()
      .setColor(isFinal ? 0xffd700 : 0x4ade80)
      .setTitle(isFinal ? '🏆 TEBRİKLER! Genel Koordinatör oldun!' : `🎉 TERFİ! ${ROLE_NAMES[newLevel]}`)
      .setDescription(
        isFinal
          ? `Eko Yıldız'ın en üst yetkili rütbesi olan **Genel Koordinatör** rütbesine ulaştın! Bu sınavı geçerek yetkinliğini kanıtladın. Başarılar dileriz! 💼`
          : `**${ROLE_NAMES[oldLevel]}** → **${ROLE_NAMES[newLevel]}**\n\n${getNextRequirementsText(newLevel)}`
      )
      .addFields(
        { name: '📅 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
        { name: '📊 Seviye', value: `${oldLevel} → ${newLevel}`, inline: true },
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    try {
      const user = await client.users.fetch(progress.userId);
      await user.send({ embeds: [embed] });
    } catch (dmErr) {
      console.warn(`[staffSystem] Cannot send promotion DM to ${progress.userId}:`, dmErr.code);
    }

    // YENİ: Roblox Rütbelerini Senkronize Et
    await staffAutomation.syncStaffRobloxRanks(client, progress.userId);

    // YENİ: Yönetim Discorduna Log Gönder
    await staffAutomation.sendAdminLog(client, 'TERFI_LOG', embed);

    // YENİ: Yönetim Listesini Güncelle
    await staffAutomation.updateDynamicModList(client);

    console.log(`[staffSystem] ${progress.userId} promoted to level ${newLevel}`);
  } catch (err) {
    console.error('[staffSystem] promote error:', err.message);
  }
}

async function demote(progress, client, reason = "Belirtilmedi") {
  try {
    const oldLevel = progress.level;
    const newLevel = oldLevel - 1;

    if (newLevel < 1) {
      console.warn(`[staffSystem] Personel ${progress.userId} zaten en düşük rütbede.`);
      return false;
    }

    progress.level = newLevel;
    progress.promotedAt = new Date();
    await progress.save();

    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return false;

    const member = await guild.members.fetch(progress.userId).catch(() => null);
    if (!member) return false;

    const oldRoleId = ROLES[oldLevel];
    const newRoleId = ROLES[newLevel];

    if (oldRoleId) {
      await member.roles.remove(oldRoleId, `Tenzilat: ${reason}`).catch(() => { });
    }
    if (newRoleId) {
      await member.roles.add(newRoleId, `Tenzilat: ${reason}`).catch(() => { });
    }

    const embed = new EmbedBuilder()
      .setColor(0xff3333)
      .setTitle(`📉 TENZİLAT! ${ROLE_NAMES[newLevel]}`)
      .setDescription(`**${ROLE_NAMES[oldLevel]}** → **${ROLE_NAMES[newLevel]}**\n\nMaalesef rütben düşürüldü.\n**Sebep:** ${reason}`)
      .addFields(
        { name: '📅 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
        { name: '📊 Seviye', value: `${oldLevel} → ${newLevel}`, inline: true },
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    try {
      const user = await client.users.fetch(progress.userId);
      await user.send({ embeds: [embed] });
    } catch (dmErr) { }

    const staffAutomation = require('./staffAutomation');
    await staffAutomation.syncStaffRobloxRanks(client, progress.userId);
    await staffAutomation.syncStaffDiscordRoles(client, progress.userId);
    await staffAutomation.sendAdminLog(client, 'TERFI_LOG', embed);
    await staffAutomation.updateDynamicModList(client);

    return true;
  } catch (err) {
    console.error('[staffSystem] demote error:', err.message);
    return false;
  }
}

function getNextRequirementsText(level) {
  const req = PROMOTION_REQUIREMENTS[level];
  if (!req) return '🏆 En üst seviyeye ulaştın! Sunucu seni sayıyor! 💫';
  const lines = [
    req.ticketsSolved > 0 && `• ${req.ticketsSolved} ticket çöz (Her biri insanı mutlu ediyor!)`,
    req.chatMessages > 0 && `• ${req.chatMessages} mesaj gönder (Sohbet kanalında aktif ol!)`,
    req.totalVoiceMinutes > 0 && `• ${req.totalVoiceMinutes} dk sesli sohbette bulun (Oyuncularla iç içe!)`,
    req.moderationActions > 0 && `• ${req.moderationActions} moderasyon işlemi (Adil ve nazik ol!)`,
    req.weeklyReports > 0 && `• ${req.weeklyReports} haftalık rapor (Yöneticilere görünürlük!)`,
    req.activeDays > 0 && `• ${req.activeDays} gün aktif ol (Haftaları taksitle yapabilirsin!)`,
  ].filter(Boolean);
  const dailyReq = getDailyRequirements(level);
  lines.push(`\n📅 **Günlük (Çok Kolay):**\n• ${dailyReq.greets}x selam\n• ${dailyReq.voiceMinutes} dk ses`);
  lines.push(`\n💪 **Başarabilirsin!** İlk başta zor görünür ama yavaş yavaş alışırsın.`);
  return lines.join('\n');
}

// ── AI Sabah Brifing DM'i ─────────────────────────────────────────────────
async function sendMorningBriefing(progress, client) {
  if (progress.settings?.dailyBriefingEnabled === false) {
    console.log(`[staffSystem] Daily briefing disabled for user ${progress.userId}. Skipping DM.`);
    return;
  }
  if (await hasInactivityRole(progress.userId, client)) return;

  const StaffUnit = require('../../models/StaffUnit');
  let userUnit = null;
  try {
    userUnit = await StaffUnit.findOne({ userId: progress.userId });
  } catch (err) {
    console.error('[staffSystem] sendMorningBriefing unit fetch error:', err.message);
  }

  resetDaily(progress);

  let allowedTasks = ['task_chat', 'task_double_chat', 'task_voice', 'task_double_voice', 'task_ticket', 'task_mod', 'task_greet', 'task_double_greet', 'task_word_game', 'task_bom_game', 'task_chat_with_people'];
  if (userUnit && userUnit.unitName) {
    if (userUnit.unitName === 'BAN_BIRIMI') {
      allowedTasks = ['task_ticket', 'task_mod'];
    } else if (userUnit.unitName === 'SES_BIRIMI') {
      allowedTasks = ['task_voice', 'task_double_voice'];
    } else if (userUnit.unitName === 'SOHBET_BIRIMI') {
      allowedTasks = ['task_chat', 'task_double_chat', 'task_greet', 'task_double_greet', 'task_word_game', 'task_bom_game', 'task_chat_with_people'];
    }
  }

  if (!progress.daily.chosenTask || !allowedTasks.includes(progress.daily.chosenTask)) {
    const prevTask = progress.daily.chosenTask;
    let filteredTasks = allowedTasks;
    if (prevTask) {
      filteredTasks = allowedTasks.filter(t => t !== prevTask);
    }
    if (filteredTasks.length === 0) filteredTasks = allowedTasks;
    
    const randomTask = filteredTasks[Math.floor(Math.random() * filteredTasks.length)];
    progress.daily.chosenTask = randomTask;
    progress.daily.chosenTaskCompleted = false;
    await progress.save().catch(() => { });
  }

  // AI'dan kısa motivasyon mesajı al
  let aiMessage = '';
  try {
    const prompt = `Bu kişi henüz günlük görevlerine başlamadı. Ona sıcak, kişisel ve tatlı bir motivasyon mesajı yaz. İçinde ismi olmasa bile samimi bir dil kullan, nazikçe harekete geçmesini iste.`;
    aiMessage = await chatWithAI([{ role: 'user', content: prompt }], PERSONAL_ASSISTANT_SYSTEM_PROMPT).catch(() => '');
    aiMessage = aiMessage?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) { }

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const embed = new EmbedBuilder()
      .setColor(0xff3e3e)
      .setTitle('⚠️ GÖREVLERE HALA BAŞLAMADIN!')
      .setDescription(
        `Merhaba <@${progress.userId}>,\n\n` +
        `Bugünkü günlük görevlerini henüz başlatmadın. Görevlerini aktif etmek, brifingini almak ve ilerleme takip panelini kurmak için aşağıdaki butona bas!\n\n` +
        (aiMessage ? `🤖 **AI Koçun:** *"${aiMessage}"*` : '')
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`staff_start_task_1`)
        .setLabel('🚀 1. GÖREVİ BAŞLAT')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('👤 Moderatör Anasayfası')
        .setStyle(ButtonStyle.Primary)
    );

    await user.send({ embeds: [embed], components: [row] });
    console.log(`[staffSystem] Göreve başlamadı uyarısı gönderildi: ${progress.userId}`);
  } catch (_) { }
}

async function ensureCoachQuestionsPool() {
  try {
    const CoachQuestion = require('../../models/CoachQuestion');
    const count = await CoachQuestion.countDocuments().catch(() => 0);
    if (count < 40) {
      console.log(`[staffSystem] Coach questions count (${count}) is low. Generating new questions with AI...`);
      const prompt = [
        {
          role: 'user',
          content: `Sen EkoYıldız Discord sunucusunun AI Personel Koçusun.
Moderatörlerimizi daha iyi tanımak, onlarla samimi bağ kurmak ve eğlenceli sohbetler başlatmak için kısa soru havuzu hazırlayacaksın.
Sorular şunlar gibi olmalı: "En sevdiğin tatlı nedir?", "Boş zamanlarında ne yaparsın?", "Seni en çok ne güldürür?", "Moderatörlük yaparken en keyif aldığın an neydi?", "En sevdiğin film karakteri hangisi?" vb.
Senden 30 adet benzersiz, samimi, eğlenceli ve yaratıcı Türkçe soru üretmeni istiyorum.
Her soru için kısa, İngilizce/Türkçe karakter uyumlu benzersiz bir anahtar kelime (key) ve soru metni (question) belirle.
Yanıtı SADECE geçerli bir JSON array formatında ver. Markdown, açıklama veya ek hiçbir metin ekleme.

JSON formatı:
[
  { "key": "favorite_dessert", "question": "En sevdiğin tatlı nedir?" },
  ...
]`
        }
      ];

      const aiResponse = await chatWithAI(prompt, 'Sen bir JSON üretecisin. Sadece geçerli JSON array döndür.').catch(() => '');
      if (aiResponse) {
        const cleaned = aiResponse.replace(/```json|```/gi, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let added = 0;
          for (const item of parsed) {
            if (item.key && item.question) {
              const exists = await CoachQuestion.findOne({ key: item.key });
              if (!exists) {
                await CoachQuestion.create({
                  key: item.key,
                  question: item.question,
                  category: 'ai_generated'
                }).catch(() => { });
                added++;
              }
            }
          }
          console.log(`[staffSystem] AI generated and saved ${added} new coach questions to database.`);
        }
      }
    }
  } catch (err) {
    console.error('[staffSystem] ensureCoachQuestionsPool error:', err.message);
  }
}

async function generateMorningBriefingEmbed(progress, client) {
  const StaffUnit = require('../../models/StaffUnit');
  let userUnit = null;
  try {
    userUnit = await StaffUnit.findOne({ userId: progress.userId });
  } catch (_) { }

  resetDaily(progress);

  const levelInfo = LEVEL_TASKS[progress.level] || LEVEL_TASKS[1];
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const nextReq = PROMOTION_REQUIREMENTS[progress.level];
  const MAX_WARNINGS = 3;
  const daysLeft = progress.warnings?.count > 0 ? MAX_WARNINGS - progress.warnings.count : null;

  const stats = getDailyTaskCompletionStats(progress);

  if (!progress.currentQuestion) {
    await ensureCoachQuestionsPool().catch(() => { });

    const memory = progress.coachMemory ? (progress.coachMemory instanceof Map ? Object.fromEntries(progress.coachMemory) : progress.coachMemory) : {};
    const CoachQuestion = require('../../models/CoachQuestion');
    const dbQuestions = await CoachQuestion.find({}).catch(() => []);

    const DEFAULT_QUESTIONS = [
      { question: "Hangi futbol takımını tutuyorsun?", key: "favorite_team" },
      { question: "En çok hangi bilgisayar veya Roblox oyununu seversin?", key: "favorite_game" },
      { question: "Şu an hangi şehirde yaşıyorsun?", key: "city" },
      { question: "En sevdiğin yemek nedir?", key: "favorite_food" },
      { question: "En büyük hobin nedir?", key: "hobby" },
      { question: "En çok hangi müzik türünü dinlersin?", key: "favorite_music" }
    ];

    const pool = dbQuestions.length > 0 ? dbQuestions : DEFAULT_QUESTIONS;
    const unanswered = pool.filter(q => !memory[q.key]);

    if (unanswered.length > 0) {
      if (Math.random() < 0.4) {
        const selected = unanswered[Math.floor(Math.random() * unanswered.length)];
        progress.currentQuestion = selected.question;
        progress.currentQuestionKey = selected.key;
        await progress.save().catch(() => { });
      }
    }
  }

  // AI'dan kişiselleştirilmiş briefing al
  let aiMessage = '';
  try {
    const prompt = `Bu personel için kısa, samimi ve kişiye özel bir görev brifingi hazırla.
- Moderatör seviyesi: ${ROLE_NAMES[progress.level]}
- Sürekli aktif gün: ${progress.stats?.consecutiveDays || 0}
- Uyarı sayısı: ${progress.warnings?.count || 0}/7
- Bugünkü hedef: selamlaşma + ses aktifliği ve mevcut görevi tamamlamak.
Nazikçe motive et, cesaret ver ve günün pozitif geçmesi için destekleyici bir soru sor.`;
    aiMessage = await chatWithAI([{ role: 'user', content: prompt }], PERSONAL_ASSISTANT_SYSTEM_PROMPT).catch(() => '');
    aiMessage = aiMessage?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) { }

  const nextLevelName = ROLE_NAMES[progress.level + 1] || 'Maksimum Seviye';

  const embed = new EmbedBuilder()
    .setColor(progress.warnings?.count > 0 ? 0xff9500 : progress.level === 1 ? 0x7c6af7 : 0x4ade80)
    .setTitle(`☀️ Günlük Görev Brifingi & İlerleme`)
    .setDescription(
      (aiMessage ? `🤖 **AI Koçun:** "${aiMessage}"\n\n` : '') +
      `Bugünün görevleri aktif edildi! Sitede veya ses kanallarında aktif kalarak hedeflerini tamamla. 💪`
    );

  const fields = [];

  // ── FIELD 1: BUGÜNKÜ GÖREVLER & İLERLEME ────────────────────────────────────
  let tasksText = '';
  tasksText += `💬 **Selamlaşma:** \`${stats.greetProgress}\` (${stats.greetPercent}%) ${progress.daily?.greeted ? '✅' : '❌'} *(Gereken: ${req.greets}x selam)*\n`;
  tasksText += `🎤 **Ses Aktifliği:** \`${stats.voiceProgress}\` (${stats.voicePercent}%) *(Gereken: ${req.voiceMinutes} dk)*\n`;
  
  if (progress.daily?.chosenTask) {
    tasksText += `🎯 **Seçimli Görev:** ${CHOSEN_TASKS[progress.daily.chosenTask] || progress.daily.chosenTask} ${progress.daily?.chosenTaskCompleted ? '✅' : '❌'}\n`;
  }
  
  if (userUnit && userUnit.unitName) {
    const { UNIT_CONFIG } = require('./unitService');
    const unitConf = UNIT_CONFIG[userUnit.unitName];
    if (unitConf) {
      tasksText += `🛡️ **Birim Görevi (${unitConf.label}):** ${unitConf.tasks} *(Birim Rütben: Rütbe ${userUnit.rank || 1})*\n`;
    }
  }

  fields.push({
    name: `📊 BUGÜNKÜ HEDEFLER & İLERLEME  [${stats.progressBar}] %${stats.totalPercent}`,
    value: tasksText.trim() || '—',
    inline: false
  });

  // ── FIELD 2: TERFİ HEDEFLERİ ─────────────────────────────────────────────
  if (nextReq) {
    const s = progress.stats || {};
    const ticketsNeeded = Math.max(0, nextReq.ticketsSolved - (s.ticketsSolved || 0));
    const chatNeeded = Math.max(0, nextReq.chatMessages - (s.chatMessages || 0));
    const voiceNeeded = Math.max(0, (nextReq.totalVoiceMinutes || 0) - (s.totalVoiceMinutes || 0));
    const daysNeeded = Math.max(0, nextReq.activeDays - (s.activeDays || 0));
    const modsNeeded = Math.max(0, (nextReq.moderationActions || 0) - (s.moderationActions || 0));
    const reportsNeeded = Math.max(0, (nextReq.weeklyReports || 0) - (s.weeklyReports || 0));

    const maxTickets = nextReq.ticketsSolved || 1;
    const ticketProgress = Math.min(100, Math.floor(((s.ticketsSolved || 0) / maxTickets) * 100));

    let promotionText = '';
    if (progress.level < 4) {
      promotionText += `• 🎫 **Ticket Çözümü:** \`${s.ticketsSolved || 0} / ${nextReq.ticketsSolved}\` ${ticketsNeeded > 0 ? `*(${ticketsNeeded} kaldı!)*` : '✅'}\n`;
    }
    if (nextReq.chatMessages) {
      promotionText += `• 💬 **Mesaj Sayısı:** \`${s.chatMessages || 0} / ${nextReq.chatMessages}\` ${chatNeeded > 0 ? `*(${chatNeeded} kaldı!)*` : '✅'}\n`;
    }
    promotionText += `• 📅 **Aktif Gün Sayısı:** \`${s.activeDays || 0} / ${nextReq.activeDays} gün\` ${daysNeeded > 0 ? `*(${daysNeeded} gün kaldı!)*` : '✅'}\n`;
    if (nextReq.moderationActions) {
      promotionText += `• 🛡️ **Mod İşlemi:** \`${s.moderationActions || 0} / ${nextReq.moderationActions}\` ${modsNeeded > 0 ? `*(${modsNeeded} kaldı!)*` : '✅'}\n`;
    }
    if (nextReq.weeklyReports) {
      promotionText += `• 📋 **Durum Raporu:** \`${s.weeklyReports || 0} / ${nextReq.weeklyReports}\` ${reportsNeeded > 0 ? `*(${reportsNeeded} kaldı!)*` : '✅'}\n`;
    }

    promotionText += `\n📈 **Atlama İlerlemesi:** %${ticketProgress} tamamlandı! *(Terfi için %${Math.floor((100 - ticketProgress) * 0.5)} daha çaba)*\n`;
    promotionText += `🎁 **Terfi Ödülü:** ${levelInfo.rewards}\n`;
    promotionText += `💡 **İpucu:** *${levelInfo.tips}*`;

    fields.push({
      name: `🚀 TERFİ YOLU (${ROLE_NAMES[progress.level]} ➔ ${nextLevelName})`,
      value: promotionText.trim(),
      inline: false
    });
  }

  // ── FIELD 3: KOÇUN SORUSU (Eğer Varsa) ────────────────────────────────────
  if (progress.currentQuestion) {
    fields.push({
      name: '❓ KOÇUN SORUSU',
      value: `> **"${progress.currentQuestion}"**\n*(Aşağıdaki butonla cevaplayabilirsiniz!)*`,
      inline: false
    });
  }

  // ── FIELD 4: DİKKAT / UYARI ────────────────────────────────────────────────
  if (daysLeft !== null && daysLeft > 0) {
    fields.push({
      name: '⚠️ UYARI LİMİTİ',
      value: `🚨 **Son ${daysLeft} aktif olmayan gün hakkınız kaldı!** Sonrasında rolünüz geçici olarak alınır. Aktif kalmaya özen gösterin.`,
      inline: false
    });
  }

  embed.addFields(fields).setTimestamp();

  return embed;
}

async function getMorningBriefingComponents(progress) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_update_progress')
      .setLabel('🔄 GÜNCELLE')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`coach_ekgorev_${progress.userId}`)
      .setLabel('💪 Ek Görev Al')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`coach_ekmesai_${progress.userId}`)
      .setLabel('⚡ Ek Mesai Yap')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('talk_to_coach')
      .setLabel('💬 Koç AI ile Konuş')
      .setStyle(ButtonStyle.Primary)
  );

  if (progress.currentQuestion) {
    rowButtons.addComponents(
      new ButtonBuilder()
        .setCustomId('staff_answer_coach_question')
        .setLabel('❓ CEVAPLA')
        .setStyle(ButtonStyle.Primary)
    );
  } else if (!progress.postponeBlocked) {
    rowButtons.addComponents(
      new ButtonBuilder()
        .setCustomId(`coach_eksilt_${progress.userId}`)
        .setLabel('⏳ Görev Eksilt')
        .setStyle(ButtonStyle.Danger)
    );
  }

  const allOptions = [
    {
      label: '💬 Aktif Sohbetçi',
      description: 'Sohbette en az 15 mesaj gönder',
      value: 'task_chat'
    },
    {
      label: '🎤 Ses Meraklısı',
      description: 'Ses kanallarında fazladan 15 dakika geçir',
      value: 'task_voice'
    },
    {
      label: '🎫 Destekçi',
      description: 'Bugün en az 1 ticket çöz',
      value: 'task_ticket'
    },
    {
      label: '🛡️ Koruyucu',
      description: 'Bugün en az 1 moderasyon işlemi gerçekleştir',
      value: 'task_mod'
    },
    {
      label: '🔤 Kelime Avcısı',
      description: 'Kelime oyununda en az 5 doğru kelime yaz',
      value: 'task_word_game'
    },
    {
      label: '💣 BOM Ustası',
      description: 'BOM oyununda en az 5 doğru sayı/bom yaz',
      value: 'task_bom_game'
    },
    {
      label: '💬 Sohbet Dostu',
      description: 'Sohbette insanlarla aktif olarak 20 mesaj yazış',
      value: 'task_chat_with_people'
    }
  ];

  let options = allOptions;
  try {
    const StaffUnit = require('../../models/StaffUnit');
    const userUnit = await StaffUnit.findOne({ userId: progress.userId });
    if (userUnit && userUnit.unitName) {
      if (userUnit.unitName === 'BAN_BIRIMI') {
        options = allOptions.filter(o => o.value === 'task_ticket' || o.value === 'task_mod');
      } else if (userUnit.unitName === 'SES_BIRIMI') {
        options = allOptions.filter(o => o.value === 'task_voice');
      } else if (userUnit.unitName === 'SOHBET_BIRIMI') {
        options = allOptions.filter(o => o.value === 'task_chat' || o.value === 'task_word_game' || o.value === 'task_bom_game' || o.value === 'task_chat_with_people');
      }
    }
  } catch (_) { }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_daily_task')
    .setPlaceholder('🎯 Seçimli Görevi Değiştir')
    .addOptions(options);
  const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

  const rowSettings = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_settings')
      .setLabel('⚙️ Ayarlar')
      .setStyle(ButtonStyle.Secondary)
  );

  return [rowButtons, rowSelect, rowSettings];
}

// ── Uyarı DM ──────────────────────────────────────────────────────────────
async function sendWarningDM(progress, client) {
  if (progress.settings?.warningsEnabled === false) {
    console.log(`[staffSystem] Warnings disabled for user ${progress.userId}. Skipping DM.`);
    return;
  }
  if (await hasInactivityRole(progress.userId, client)) return;

  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const MAX_WARNINGS = 3; // 5 → 3 gün (sıkılaştırıldı)
  const warnCount = progress.warnings?.count || 0;
  const warnLeft = Math.max(0, MAX_WARNINGS - warnCount);

  try {
    const { addNotification } = require("../../utils/notification");
    await addNotification(progress.userId, {
      title: `⏰ Görev İhmali Uyarısı (${warnCount}/${MAX_WARNINGS})`,
      message: `Bugün günlük görevlerinizi tamamlamadınız. Rolünüzün alınmasına ${warnLeft} gün kaldı. Lütfen görevlerinizi tamamlayın!`,
      icon: "⏰"
    });
  } catch (nErr) {
    console.error("[staffSystem] sendWarningDM notification error:", nErr.message);
  }

  // AI'dan uyarı mesajı
  let aiWarn = '';
  try {
    const prompt = `Eko Yıldız personeli ${ROLE_NAMES[progress.level]} günlük görevlerini yapmadı.
Bu ${warnCount || 1}. uyarısı. ${warnLeft} hakkı kaldı.
Kısa (max 100 karakter), sakin ama yapıcı Türkçe uyarı yaz. Anlayışlı ol!`;
    aiWarn = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
    aiWarn = aiWarn?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) { }

  const today = todayStr();
  const isGreetDone = progress.daily?.date === today && progress.daily?.greeted;
  const voiceDone = progress.daily?.date === today && (progress.daily?.voiceMinutes || 0) >= req.voiceMinutes;

  const greetsSent = progress.daily?.greetCount || 0;
  const voiceMins = progress.daily?.voiceMinutes || 0;

  const taskStatusText =
    `• **Selamlaşma Görevi:** ${isGreetDone ? '✅ Tamamlandı' : '❌ Eksik'} (${greetsSent}/${req.greets} selam)\n` +
    `• **Ses Aktifliği Görevi:** ${voiceDone ? '✅ Tamamlandı' : '❌ Eksik'} (${voiceMins}/${req.voiceMinutes} dk)`;

  const stats = getDailyTaskCompletionStats(progress);
  const bothTasksDone = isGreetDone && voiceDone;

  const embed = new EmbedBuilder()
    .setColor(warnLeft <= 1 ? 0xff6b6b : warnLeft <= 2 ? 0xff9500 : 0xfbbf24)
    .setTitle(`⏰ Günlük Görev Uyarısı — ${warnCount}/${MAX_WARNINGS}`)
    .setDescription(
      (aiWarn ? `🤖 **AI Koçu:** ${aiWarn}\n\n` : '') +
      (bothTasksDone 
        ? `Görevlerini tamamladın ama sistem uyarısı alıyorsun. 😟 Bu bir hata olabilir.\n\n` 
        : `Bugün günlük görevlerini tamamlamadın. 😟 Sorun var mı?\n\n`) +
      `**🕐 ${warnLeft === 1 ? '⚠️ SON UYARI!' : `${warnLeft} gün daha`} yapmazsan rolün geçici alınır.** (Ama geri gelmen çok kolay!)\n\n` +
      `📊 **Görev İlerlemesi:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**\n\n` +
      `📋 **Görevlerinin Durumu:**\n` +
      `${taskStatusText}\n\n` +
      `💡 **Meşgulsen, yöneticilere yazabilirsin!** İzin isteyebilirsin. 😊\n` +
      `Bugün yaparsan uyarı sayacın sıfırlanır! İçin rahat olsun. 💚`
    )
    .addFields(
      { name: '⚠️ Uyarı', value: `${warnCount}/${MAX_WARNINGS}`, inline: true },
      { name: '📊 Seviye', value: ROLE_NAMES[progress.level], inline: true },
      { name: '🕐 Kalan Hakkı', value: warnLeft === 1 ? '🔴 1 gün (SON)' : `${warnLeft} gün`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz! 💚' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('👤 Moderatör Anasayfası')
        .setStyle(ButtonStyle.Primary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

function shouldOfferInactivitySupport(progress) {
  if (!progress || !progress.stats) return false;
  const highStreak = (progress.stats.consecutiveDays || 0) >= 7;
  const highPerformance = progress.level >= 3 || (progress.stats.ticketsSolved || 0) >= 75 || (progress.stats.activeDays || 0) >= 14;
  return highStreak && highPerformance;
}

async function offerInactivitySupportIfNeeded(progress, client) {
  if (!shouldOfferInactivitySupport(progress)) return;
  const today = todayStr();
  if (!progress.leaves) progress.leaves = {};
  if (progress.leaves.lastInactivityOfferDate === today) return;
  progress.leaves.lastInactivityOfferDate = today;
  await progress.save().catch(() => { });
  await sendInactivityOfferDM(progress, client).catch(() => { });
}

async function sendInactivityOfferDM(progress, client) {
  if (await hasInactivityRole(progress.userId, client)) return;
  const prompt = `Eko Yıldız personeli ${ROLE_NAMES[progress.level]} uzun süredir düzenli aktif değil. Bu kişinin geçmişteki yüksek performansı ve streaki yüksek. Türkçe, üzgün ama anlayışlı bir destek mesajı yaz. Mesajın sonunda kullanıcının "İnaktiflik Talep Et" butonuna basmasını iste.`;
  let aiMessage = '';
  try {
    aiMessage = await chatWithAI([{ role: 'user', content: prompt }], 'Sen nazik, destekleyici ve empatik bir çalışan koçusun.');
    aiMessage = aiMessage?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) { aiMessage = ''; }

  const embed = new EmbedBuilder()
    .setColor(0x6f42c1)
    .setTitle('😔 N’oldu? Neden aktif değilsin?')
    .setDescription(
      `${aiMessage || 'Uzun süredir seni sunucuda göremiyoruz. N’oldu? Neden aktif değilsin?'}\n\n` +
      `Eğer istersen inaktiflik talep edebilirsin. Sebebini aşağıdan paylaş, böylece seni daha doğru anlayalım.`
    )
    .addFields(
      { name: '⭐ Seviyen', value: ROLE_NAMES[progress.level], inline: true },
      { name: '🔥 Ardışık Günler', value: `${progress.stats?.consecutiveDays || 0}`, inline: true },
      { name: '🏆 Toplam Ticket', value: `${progress.stats?.ticketsSolved || 0}`, inline: true }
    )
    .setFooter({ text: 'Eko Yıldız • Personel Desteği' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_inactivity_request')
        .setLabel('İnaktiflik Talep Et')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('👤 Moderatör Anasayfası')
        .setStyle(ButtonStyle.Secondary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

function reasonNeedsProof(reason) {
  if (!reason) return false;
  return /sağlık|okul|ders|hastalık|ameliyat|tedavi|psikolojik|mental|aile|kardeş|cenaze|yakın|baba|anne|çocuk|engelli|rapor|rehabilitasyon|okul|sınav|kaza/i.test(reason);
}

function getLatestPendingInactivityRequest(progress) {
  if (!progress.leaves || !Array.isArray(progress.leaves.inactivityRequests)) return null;
  return progress.leaves.inactivityRequests
    .filter(req => req.type === 'inactivity' && req.status === 'pending')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

async function saveInactivitySummary(progress, request) {
  if (!progress.coachMemory) progress.coachMemory = new Map();
  const summary = `İnaktiflik sebebi: ${request.reason || 'Belirtilmedi'}\nKanıt: ${request.evidence || 'Yok'}\nKendini iyi hissediyor mu: ${request.wellbeingResponse || 'Henüz yanıtlanmadı'}`;
  progress.coachMemory.set(`inactivity_${request.id}`, summary);
}

async function approveInactivityRequest(progress, request, client) {
  if (!progress.leaves) progress.leaves = {};
  request.status = 'approved';
  request.approved = true;
  request.approvedAt = new Date();
  request.type = 'inactivity';
  if (!progress.leaves.inactivityRequests) progress.leaves.inactivityRequests = [];
  if (!progress.leaves.usedDays) progress.leaves.usedDays = [];
  const today = todayStr();
  if (!progress.leaves.usedDays.includes(today)) {
    progress.leaves.usedDays.push(today);
  }
  await saveInactivitySummary(progress, request).catch(() => {});
  await progress.save().catch(() => {});
  await sendInactivityWellbeingPrompt(progress, request, client).catch(() => {});
  return true;
}

async function sendInactivityProofRequestDM(progress, request, client) {
  const embed = new EmbedBuilder()
    .setColor(0xff9500)
    .setTitle('📎 İnaktiflik için kanıt gerekli')
    .setDescription(
      `Sebebine göre bu inaktiflik talebi sağlık, okul veya benzeri hassas bir durum içeriyor. Lütfen aşağıdan kanıt veya ek açıklama paylaş.`
    )
    .addFields(
      { name: 'Sebep', value: request.reason || 'Belirtilmedi' },
      { name: 'Nasıl paylaşabilirsin?', value: 'Buraya link, belge ya da kısa açıklama ekle. Eğer dosya eklemek istersen direkt bu DM kanalına da gönderebilirsin.' }
    )
    .setFooter({ text: 'Eko Yıldız • İnaktiflik Desteği' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_inactivity_proof')
        .setLabel('Kanıt / Ek Açıklama Gönder')
        .setStyle(ButtonStyle.Primary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

async function sendInactivityWellbeingPrompt(progress, request, client) {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('💚 Kendini iyi hissediyor musun?')
    .setDescription(
      `İnaktiflik talebin onaylandı. Şu anda biraz dinlenebilirsin. Sana bir soru soracağız çünkü sağlığın ve ruh halin bizim için önemli.

` +
      `🔹 Eğer kendini iyi hissetmiyorsan, bize haber ver. Eğer iyisen de bunu bilmek güzel.`
    )
    .setFooter({ text: 'Eko Yıldız • İyi Olman Önemli' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_inactivity_wellbeing_yes')
        .setLabel('Evet, iyiyim')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('staff_inactivity_wellbeing_no')
        .setLabel('Hayır, iyi değilim')
        .setStyle(ButtonStyle.Danger)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

async function submitInactivityRequest(userId, reason, evidence, client) {
  try {
    const progress = await getOrCreate(userId, GUILD_ID, client);
    if (!progress || progress.status !== 'active') {
      return { success: false, message: 'Aktif personel değil misin? Bu işlemi yapamazsın.' };
    }
    if (!progress.leaves) progress.leaves = {};
    if (!progress.leaves.inactivityRequests) progress.leaves.inactivityRequests = [];

    const request = {
      id: `inactivity_${Date.now()}`,
      createdAt: new Date(),
      reason: reason?.trim() || '',
      evidence: evidence?.trim() || '',
      status: 'pending',
      approved: false,
      approvedAt: null,
      proofRequestedAt: null,
      wellbeingResponse: null,
      wellbeingAnsweredAt: null,
      type: 'inactivity'
    };
    progress.leaves.inactivityRequests.push(request);
    const needsProof = reasonNeedsProof(request.reason);
    if (needsProof && !request.evidence) {
      request.proofRequestedAt = new Date();
      await progress.save();
      await sendInactivityProofRequestDM(progress, request, client).catch(() => {});
      return {
        success: true,
        message: 'Talebiniz alındı. Sağlık/okul gibi bir durum görüyoruz; lütfen kanıt veya ek açıklama gönderin.'
      };
    }
    if (!request.evidence && !needsProof) {
      // Yine de onayla, çünkü istek destek amaçlıdır.
      await approveInactivityRequest(progress, request, client);
      return { success: true, message: 'İnaktiflik talebin onaylandı. Bugün dinlenebilirsin.' };
    }
    // Sağlık/okul gibi durumsa kanıt varsa onayla
    if (needsProof && request.evidence) {
      await approveInactivityRequest(progress, request, client);
      return { success: true, message: 'İnaktiflik talebin kanıtla birlikte alındı ve onaylandı.' };
    }
    // Genel durum, yeterli.
    await approveInactivityRequest(progress, request, client);
    return { success: true, message: 'İnaktiflik talebin onaylandı. Bugün dinlenebilirsin.' };
  } catch (err) {
    console.error('[staffSystem] submitInactivityRequest error:', err.message);
    return { success: false, message: 'İnaktiflik talebin işlenirken hata oluştu.' };
  }
}

async function handleInactivitySupportModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const reason = interaction.fields.getTextInputValue('inactivity_reason');
    const evidence = interaction.fields.getTextInputValue('inactivity_evidence');
    const result = await submitInactivityRequest(interaction.user.id, reason, evidence, client);
    await interaction.editReply({ content: result.message });
  } catch (err) {
    console.error('[staffSystem] handleInactivitySupportModal error:', err.message);
    await interaction.editReply({ content: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
  }
}

async function handleInactivityProofModal(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const evidence = interaction.fields.getTextInputValue('proof_link');
    const progress = await getOrCreate(interaction.user.id, GUILD_ID, client);
    if (!progress) {
      return interaction.editReply({ content: 'Personel kaydın bulunamadı.' });
    }
    const request = getLatestPendingInactivityRequest(progress);
    if (!request) {
      return interaction.editReply({ content: 'Gönderilecek bekleyen bir inaktiflik talebin yok.' });
    }
    request.evidence = evidence?.trim() || request.evidence;
    await progress.save();
    const result = await submitInactivityRequest(interaction.user.id, request.reason, request.evidence, client);
    await interaction.editReply({ content: result.message });
  } catch (err) {
    console.error('[staffSystem] handleInactivityProofModal error:', err.message);
    await interaction.editReply({ content: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
  }
}

async function recordInactivityWellbeingResponse(userId, response, client) {
  try {
    const progress = await getOrCreate(userId, GUILD_ID, client);
    if (!progress) return { success: false, message: 'Personel kaydın bulunamadı.' };
    const request = progress.leaves?.inactivityRequests?.slice().reverse().find(r => r.type === 'inactivity' && r.approved);
    if (!request) {
      return { success: false, message: 'Onaylanmış bir inaktiflik talebin yok.' };
    }
    request.wellbeingResponse = response;
    request.wellbeingAnsweredAt = new Date();
    await saveInactivitySummary(progress, request).catch(() => {});
    await progress.save().catch(() => {});

    const supportPrompt = `Bu kişi inaktiflik için izin aldı. Sebebi: ${request.reason}. Kanıt: ${request.evidence || 'Yok'}. Kendini iyi hissediyor musun? sorusuna verdiği cevap: ${response}. Kısa, nazik ve destekleyici bir mesaj yaz.`;
    let aiResponse = '';
    try {
      aiResponse = await chatWithAI([{ role: 'user', content: supportPrompt }], 'Sen şefkatli ve destekleyici bir iş koçusun.');
      aiResponse = aiResponse?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
    } catch (_) { aiResponse = ''; }

    if (client) {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('💬 Durum Güncellemesi Kaydedildi')
          .setDescription(aiResponse || 'Cevabınız kaydedildi. Kendine iyi bak, buradayız.')
          .setFooter({ text: 'Eko Yıldız • Seninle birlikteyiz' })
          .setTimestamp();
        await user.send({ embeds: [embed] }).catch(() => { });
      }
    }
    return { success: true, message: 'Cevabın kaydedildi. Sana destek mesajı gönderdim.' };
  } catch (err) {
    console.error('[staffSystem] recordInactivityWellbeingResponse error:', err.message);
    return { success: false, message: 'Cevabın kaydedilirken hata oluştu.' };
  }
}

async function handleInactivityButtonResponse(interaction, client, response) {
  await interaction.deferReply({ ephemeral: true });
  const result = await recordInactivityWellbeingResponse(interaction.user.id, response, client);
  await interaction.editReply({ content: result.message });
}

async function handleInactivityRequestButton(interaction, client) {
  const modal = new (require('discord.js').ModalBuilder)()
    .setCustomId('modal_inactivity_support')
    .setTitle('İnaktiflik Talep Formu');
  const { TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
  const reasonInput = new TextInputBuilder()
    .setCustomId('inactivity_reason')
    .setLabel('Neden aktif değilsin?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
  const evidenceInput = new TextInputBuilder()
    .setCustomId('inactivity_evidence')
    .setLabel('Kanıt / Ek Açıklama (opsiyonel)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);
  modal.addComponents(
    new ActionRowBuilder().addComponents(reasonInput),
    new ActionRowBuilder().addComponents(evidenceInput)
  );
  return interaction.showModal(modal);
}

async function handleInactivityProofButton(interaction, client) {
  const modal = new (require('discord.js').ModalBuilder)()
    .setCustomId('modal_inactivity_proof')
    .setTitle('İnaktiflik Kanıtı Gönder');
  const { TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
  const proofInput = new TextInputBuilder()
    .setCustomId('proof_link')
    .setLabel('Kanıt Linki / Açıklama')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(proofInput));
  return interaction.showModal(modal);
}

async function handleInactivityWellbeingButton(interaction, client, response) {
  await interaction.deferReply({ ephemeral: true });
  const result = await recordInactivityWellbeingResponse(interaction.user.id, response, client);
  await interaction.editReply({ content: result.message });
}

async function handleInactivitySupportRequest(interaction, client) {
  return handleInactivityRequestButton(interaction, client);
}

async function sendRequirementIncreaseDM(progress, client) {
  if (await hasInactivityRole(progress.userId, client)) return;
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle('📈 Görev Gereksinimlerin Arttı!')
    .setDescription(
      `${progress.stats?.consecutiveDays} gün aktif kaldığın için gereksinimler ikiye katlandı!\n\n` +
      `📋 **Yeni günlük zorunlulukların:**\n` +
      `• Sohbete **${req.greets}x** selam\n` +
      `• Ses kanalında **${req.voiceMinutes} dk** kal\n\n` +
      `Bu zor — ama güçlü olduğunu biliyoruz! 💪`
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
  } catch (_) { }
}

// ── Sert çalışma ödülü: 1 gün izin kredisi ─────────────────────────────────
async function sendBreakRewardDM(progress, client) {
  if (await hasInactivityRole(progress.userId, client)) return;
  const totalCredits = progress.stats?.breakCredits || 0;
  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🎁 SEVİYE ATLAMA ÖDÜLÜ: 1 Günlük İzin!')
    .setDescription(
      `Harika bir iş çıkardın! 🌟 **${totalCredits === 1 ? 'İlk' : totalCredits}.** kez bu başarıyı başardın!\n\n` +
      `**Ödülün:** 📅 **1 Günlük İzin Kredisi**\n\n` +
      `Yarın veya sonraki gün kalmak istersen bu krediyi kullanabilirsin.\n` +
      `Yöneticilere "izin kredisi kullanmak istiyorum" diyerek haberdar et.\n\n` +
      `Toplam kreditin: **${totalCredits}**\n\n` +
      `💪 Devam et, bu hız çok iyi!`
    )
    .addFields(
      { name: '🎯 Başarı', value: 'Bu gün 3+ Ticket çözdün!', inline: false },
      { name: '📊 Seviyesi', value: ROLE_NAMES[progress.level], inline: true },
      { name: '🏆 Toplam Ödülü', value: `${totalCredits} gün izin`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Ödül Sistemi' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
    console.log(`[staffSystem] Break reward gönderildi: ${progress.userId} (total: ${totalCredits})`);
  } catch (_) { }
}

// ── Motivasyon mesajları: rasgele teşvik ─────────────────────────────────
async function sendRandomMotivationDM(progress, client) {
  if (await hasInactivityRole(progress.userId, client)) return;
  const motivations = [
    {
      title: '💪 Devam Et!',
      messages: [
        `${ROLE_NAMES[progress.level]}, sizi sunucuda görmek harika! Hızınızı korumanız çok önemli.`,
        `Bugün ${progress.stats?.ticketsSolved || 0} ticket çözdüğünüz için teşekkürler! Sunucumuzu daha iyi bir yer yapıyorsunuz.`,
        `Aktif olduğunuz için teşekkürler! Eko Yıldız'ın sizi gerek duyuyor. 🌟`,
      ]
    },
    {
      title: '🎯 Hedef Hatırlatması',
      messages: [
        `Terfi olmak için hâlâ ${((PROMOTION_REQUIREMENTS[progress.level]?.ticketsSolved || 0) - (progress.stats?.ticketsSolved || 0))} ticket çözmek gerekli. Yaklaşıyor!`,
        `Sekreter olmak istiyorsanız, her ticket'ı çözmek sizi bir adım ileriye götürüyor.`,
        `Bu seviyedeki son hedefine yaklaşıyorsun. Biraz daha çaba!`,
      ]
    },
    {
      title: '🌈 İlham Verici',
      messages: [
        `Eko Yıldız'ın en iyi personelleri sizin gibi çalışanlardır. Başarılı bir ekibin parçasısınız!`,
        `Her ticket'ın çözülmesi bir kullanıcıyı mutlu ediyor. Teşekkürler! 😊`,
        `Sunucuda sesiniz duyuluyor ve saygınlık kazanıyorsunuz. Devam edin!`,
      ]
    }
  ];

  const motiv = motivations[Math.floor(Math.random() * motivations.length)];
  const msg = motiv.messages[Math.floor(Math.random() * motiv.messages.length)];

  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle(motiv.title)
    .setDescription(msg)
    .addFields(
      { name: '📊 Seviye', value: ROLE_NAMES[progress.level], inline: true },
      { name: '⭐ Aktif Gün', value: `${progress.stats?.consecutiveDays || 0} gün`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Motivasyon Mesajı ✨' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
  } catch (_) { }
}

// ── İZİN SİSTEMİ — Personele ara ara izin ────────────────────────────────────
/**
 * İzin günü kullandığını kaydet
 * @param {String} userId - Personel ID'si
 * @param {Date} leaveDate - İzin tarihi (YYYY-MM-DD)
 * @param {String} reason - İzin sebebi
 */
async function requestLeave(userId, leaveDate, reason) {
  try {
    const p = await getOrCreate(userId, GUILD_ID);

    if (p.status !== 'active') {
      return { success: false, message: 'Aktif personel değilsin.' };
    }

    const monthlyLimit = 2; // Ayda maksimum 2 gün izin (sıkılaştırıldı)
    const weeklyLimit = 1;  // Haftada maksimum 1 gün izin

    if ((p.leaves.monthlyLeaveUsed || 0) >= monthlyLimit) {
      return { success: false, message: `Bu ayın izin hakkını kullandın (Limit: ${monthlyLimit} gün)` };
    }

    if ((p.leaves.weeklyLeaveUsed || 0) >= weeklyLimit) {
      return { success: false, message: `Bu haftanın izin hakkını kullandın (Limit: ${weeklyLimit} gün)` };
    }

    if (!p.leaves.usedDays) p.leaves.usedDays = [];
    if (p.leaves.usedDays.includes(leaveDate)) {
      return { success: false, message: 'Bu gün için zaten izin kullanmışsın.' };
    }

    // İzin günü ekle
    p.leaves.usedDays.push(leaveDate);
    p.leaves.monthlyLeaveUsed = (p.leaves.monthlyLeaveUsed || 0) + 1;
    p.leaves.weeklyLeaveUsed = (p.leaves.weeklyLeaveUsed || 0) + 1;
    p.leaves.lastLeaveDate = leaveDate;
    p.leaves.totalCredits = (p.leaves.totalCredits || 0) + 1;

    await p.save();

    return {
      success: true,
      message: `İzin onaylandı: ${leaveDate}`,
      remaining: monthlyLimit - p.leaves.monthlyLeaveUsed
    };
  } catch (err) {
    console.error('[staffSystem] İzin hatası:', err.message);
    return { success: false, message: 'İzin işleminde hata oluştu.' };
  }
}

/**
 * İzin durmunu göster
 */
async function getLeaveStatus(userId) {
  try {
    const p = await getOrCreate(userId, GUILD_ID);

    const monthlyLimit = 2; // Sıkılaştırıldı
    const weeklyLimit = 1;

    return {
      totalCredits: p.leaves.totalCredits || 0,
      monthlyUsed: p.leaves.monthlyLeaveUsed || 0,
      monthlyRemaining: Math.max(0, monthlyLimit - (p.leaves.monthlyLeaveUsed || 0)),
      weeklyUsed: p.leaves.weeklyLeaveUsed || 0,
      weeklyRemaining: Math.max(0, weeklyLimit - (p.leaves.weeklyLeaveUsed || 0)),
      usedDays: p.leaves.usedDays || [],
    };
  } catch (err) {
    console.error('[staffSystem] İzin durum hatası:', err.message);
    return null;
  }
}

/**
 * İzin kredileri ile günü skip et
 */
async function useLeaveCredit(userId) {
  try {
    const p = await StaffProgress.findOne({ userId });
    if (!p) return { success: false, message: 'Kayıt bulunamadı.' };

    if ((p.stats?.breakCredits || 0) <= 0) {
      return { success: false, message: 'İzin kredtin yok.' };
    }

    // Günü skip et (görevleri yapmamış gibi say ama uyarı verme)
    p.stats.breakCredits = (p.stats.breakCredits || 1) - 1;
    p.daily.greeted = true;
    p.daily.voiceMinutes = getDailyRequirements(p.level, p.stats.consecutiveDays || 0).voiceMinutes;
    p.daily.date = todayStr();
    p.stats.lastCompleteDay = todayStr();

    await p.save();

    return {
      success: true,
      message: 'Bugün izin kredisi kullanarak skip ettirdin!',
      creditsRemaining: p.stats.breakCredits
    };
  } catch (err) {
    console.error('[staffSystem] Kredi hata:', err.message);
    return { success: false, message: 'İşlem başarısız.' };
  }
}

async function removeRole(progress, client) {
  try {
    try {
      const { addNotification } = require("../../utils/notification");
      await addNotification(progress.userId, {
        title: "⏸️ Rolünüz Askıya Alındı",
        message: "3 gün üst üste günlük görev yapılmadığı için personel rolleriniz askıya alındı. Yöneticilerle görüşerek tekrar başlayabilirsiniz.",
        icon: "⚠️"
      });
    } catch (nErr) {
      console.error("[staffSystem] removeRole notification error:", nErr.message);
    }

    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return;
    const member = await guild.members.fetch(progress.userId).catch(() => null);
    if (!member) return;
    // Alınması gereken tüm yetkili ve mod rolleri
    const rolesToRemove = [
      ...Object.values(ROLES),
      '1518709348506013706', // Kıdemli Sekreter (Level 5)
      '1518692389169135666', // Moderatör Ekibi
      '1518708137920823327', // modizm
      '1518707673846251691', // adminizm
      '1518692384928567456'  // Kaptan
    ];

    for (const rId of rolesToRemove) {
      if (member.roles.cache.has(rId)) {
        await member.roles.remove(rId, '3 gün üst üste görev yapmadı - Sistemden atıldı').catch(() => { });
      }
    }

    // Ayrıca ana sunucudan da (1367646464804655104) Level 5 vb. kalıcı rolleri silelim
    try {
      const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
      if (mainGuild) {
        const mainMember = await mainGuild.members.fetch(progress.userId).catch(() => null);
        if (mainMember) {
          for (const rId of rolesToRemove) {
            if (mainMember.roles.cache.has(rId)) {
              await mainMember.roles.remove(rId, 'Görev yapılmadığı için sistemden silindi').catch(() => { });
            }
          }
        }
      }
    } catch (e) { }
    const embed = new EmbedBuilder()
      .setColor(0xff9500)
      .setTitle('⏸️ Personel Rolü Duraklatıldı — Geri Dön!')
      .setDescription(
        `**3 gün üst üste görev yapamadığın** için **${ROLE_NAMES[progress.level]}** rolün alındı. ⚠️\n\n` +
        `💡 **Ama endişelenme! Geri gelmek ÇOOOOK basit:**\n` +
        `🤝 Yöneticilere yazabilirsin\n` +
        `💬 Neden yapamadığını anlatabilirsin\n` +
        `📋 Plan yapabilirsiniz\n` +
        `✨ Sonra tekrar başlarsın!\n\n` +
        `🎁 **Meşgulseniz:**\n` +
        `İzin sistemi var! İzin talep edebilirsin. Anlıyoruz!\n\n` +
        `😊 Herkes ara sıra durgunluk yaşıyor. Sorun değil!\n` +
        `Biz seninle çözeriz. Geri dön! 💪`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seni özleyeceğiz! 💚' })
      .setTimestamp();

    const user = await client.users.fetch(progress.userId).catch(() => null);
    if (user) await user.send({ embeds: [embed] }).catch(() => { });
    await StaffProgress.deleteOne({ userId: progress.userId });
    console.log(`[staffSystem] Rol alındı (5 gün): ${progress.userId}`);
  } catch (err) {
    console.error('[staffSystem] Rol alma hatası:', err.message);
  }
}

// ── Öğlen hatırlatma (13:00) ──────────────────────────────────────────────
async function sendMidDayReminder(progress, client) {
  if (progress.settings?.warningsEnabled === false) {
    console.log(`[staffSystem] Warnings disabled for user ${progress.userId}. Skipping DM.`);
    return;
  }
  if (await hasInactivityRole(progress.userId, client)) return;
  const today = todayStr();
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const isGreetDone = progress.daily?.date === today && progress.daily?.greeted;
  const voiceDone = progress.daily?.date === today && (progress.daily?.voiceMinutes || 0) >= req.voiceMinutes;

  const greetsSent = progress.daily?.date === today ? (progress.daily?.greetCount || 0) : 0;
  const voiceMinutes = progress.daily?.date === today ? (progress.daily?.voiceMinutes || 0) : 0;
  
  const missing = [];
  if (!isGreetDone) missing.push(`✅ Sohbete ${req.greets - greetsSent}x daha selam ver (Gereken: ${req.greets})`);
  if (!voiceDone) missing.push(`🎤 ${req.voiceMinutes - voiceMinutes} dk daha ses kanalında kal (Gereken: ${req.voiceMinutes} dk)`);

  if (missing.length === 0) return; // Zaten tamamlamış

  const stats = getDailyTaskCompletionStats(progress);

  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle('🌤️ Öğlen Hatırlatması — Biraz Daha Kaldı!')
    .setDescription(
      `Günün yarısı geçti! Hâlâ yapman gerekenler var ama merak etme, çok az kaldı:\n\n` +
      missing.map(m => `• ${m}`).join('\n') +
      `\n\n📊 **Görev İlerlemesi:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**` +
      `\n\n☕ Bir ara ver, sonra bitir. Zaman yeter! 💪`
    )
    .addFields(
      { name: '📊 Seviye', value: ROLE_NAMES[progress.level], inline: true },
      { name: '🎤 Ses (bugün)', value: `${voiceMinutes}/${req.voiceMinutes} dk`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz!' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('👤 Moderatör Anasayfası')
        .setStyle(ButtonStyle.Primary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

// ── Akşam son uyarı (19:00) ───────────────────────────────────────────────
async function sendEveningWarning(progress, client) {
  if (progress.settings?.warningsEnabled === false) {
    console.log(`[staffSystem] Warnings disabled for user ${progress.userId}. Skipping DM.`);
    return;
  }
  if (await hasInactivityRole(progress.userId, client)) return;
  const today = todayStr();
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const isGreetDone = progress.daily?.date === today && progress.daily?.greeted;
  const voiceDone = progress.daily?.date === today && (progress.daily?.voiceMinutes || 0) >= req.voiceMinutes;

  if (isGreetDone && voiceDone) return; // Tamamlamış

  const stats = getDailyTaskCompletionStats(progress);
  const warnCount = progress.warnings?.count || 0;

  // AI acil uyarı mesajı
  let aiMsg = '';
  try {
    const prompt = `Eko Yıldız personeli ${ROLE_NAMES[progress.level]} akşam 19:00'da hâlâ günlük görevini yapmamış.
Bu kişinin ${warnCount} uyarısı var. Çok kısa (max 80 karakter), sakin ve anlayışlı Türkçe uyarı yaz.`;
    aiMsg = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
    aiMsg = aiMsg?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) { }

  const greetsSent = progress.daily?.date === today ? (progress.daily?.greetCount || 0) : 0;
  const voiceMinutes = progress.daily?.date === today ? (progress.daily?.voiceMinutes || 0) : 0;

  const embed = new EmbedBuilder()
    .setColor(0xff9500)
    .setTitle('🌙 Akşam Son Uyarısı (19:00)')
    .setDescription(
      (aiMsg ? `🤖 **AI:** ${aiMsg}\n\n` : '') +
      `**Gece 23:30'a kadar** görevlerini tamamlamazsan yarın uyarı sayacın artacak!\n\n` +
      `📊 **Görev İlerlemesi:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**\n\n` +
      `📋 **Yapman gerekenler:**\n` +
      (!isGreetDone ? `• ✅ Sohbete **${req.greets - greetsSent}x** daha selam ver (Gereken: ${req.greets})\n` : '') +
      (!voiceDone ? `• 🎤 **${req.voiceMinutes - voiceMinutes} dk** daha ses kanalında kal (Gereken: ${req.voiceMinutes} dk)\n` : '') +
      `\n🕐 **${7 - warnCount} uyarı hakkın kaldı.** (Sonra rol geçici olarak alınır)\n\n` +
      `Meşgulsen, yapabilecekten bile yararlı! Kısmi tamamlama da iyi!`
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz!' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_update_progress')
        .setLabel('👤 Moderatör Anasayfası')
        .setStyle(ButtonStyle.Primary)
    );
    await user.send({ embeds: [embed], components: [row] });
  } catch (_) { }
}

// ── KÖV (KOV) SİSTEMİ — Yönetici tarafından personel alınması ────────────────
async function dismissStaff(userId, reason, dismissedBy, client) {
  const p = await StaffProgress.findOne({ userId });
  if (!p) return { success: false, message: 'Personel sisteminde kayıtlı değil.' };
  if (p.status !== 'active') return { success: false, message: 'Zaten aktif değil.' };

  const levelName = ROLE_NAMES[p.level];

  // Kov kaydı
  p.status = 'dismissed';
  p.dismissedAt = new Date();
  p.dismissReason = reason?.slice(0, 300) || 'Yönetici Kararı';
  await p.save();

  // Rolleri kaldır
  const rolesToRemove = [
    ...Object.values(ROLES),
    '1518709348506013706', // Kıdemli Sekreter (Level 5)
    '1518692389169135666', // Moderatör Ekibi
    '1518708137920823327', // modizm
    '1518707673846251691', // adminizm
  ];

  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member) {
      for (const roleId of rolesToRemove) {
        if (roleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, `Kov: ${reason || 'Yönetici Kararı'}`).catch(() => { });
        }
      }
    }

    const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
    if (mainGuild) {
      const mainMember = await mainGuild.members.fetch(userId).catch(() => null);
      if (mainMember) {
        for (const roleId of rolesToRemove) {
          if (roleId && mainMember.roles.cache.has(roleId)) {
            await mainMember.roles.remove(roleId, `Kov: ${reason || 'Yönetici Kararı'}`).catch(() => { });
          }
        }
      }
    }
  } catch (_) { }

  // Kullanıcıya DM
  try {
    const user = await client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle('⛔ Personel Sisteminden Çıkarıldın')
      .setDescription(
        `**${levelName}** görevinden yönetici tarafından çıkarıldın.\n\n` +
        `**Sebep:** ${reason || 'Belirtilmedi'}\n\n` +
        `Bu kararı itiraz etmek veya daha fazla bilgi almak için yöneticilere yazabilirsin.`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();
    await user.send({ embeds: [embed] });
  } catch (_) { }

  // Yönetici bildirim
  try {
    const admin = await client.users.fetch(dismissedBy);
    const embed = new EmbedBuilder()
      .setColor(0xff9500)
      .setTitle('✅ Personel Kov İşlemi Tamamlandı')
      .setDescription(
        `**Kişi:** <@${userId}>\n` +
        `**Seviye:** ${levelName}\n` +
        `**Sebep:** ${reason || 'Belirtilmedi'}`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();
    await admin.send({ embeds: [embed] }).catch(() => { });
  } catch (_) { }

  console.log(`[staffSystem] Kov: ${userId} (${levelName}) - Sebep: ${reason}`);
  return { success: true, levelName };
}

// ── İSTİFA sistemi ─────────────────────────────────────────────────────────
async function resignFromStaff(userId, reason, client) {
  const p = await StaffProgress.findOne({ userId });
  if (!p) return { success: false, message: 'Personel sisteminde kayıtlı değilsin.' };
  if (p.status === 'resigned') return { success: false, message: 'Zaten istifa etmişsin.' };
  if (p.status === 'retired') return { success: false, message: 'Zaten emeklisin.' };

  const levelName = ROLE_NAMES[p.level];
  const totalDays = (p.stats?.activeDays || 0) + (p.stats?.consecutiveDays || 0);

  // Emeklilik hakkı var mı kontrol (90+ gün = emekli olabilir)
  const canRetire = totalDays >= 90;

  const rolesToRemove = [
    ...Object.values(ROLES),
    '1517656567481372772', '1517651154220355836', // Level 5 rolleri
    '1467082387933499524', '1480592150273200330', '1479818628152168479', '1467082891556163727', // Temel mod rollerimiz
    '1467082280035160269', '1467082211839836344', '1467082157800423515', '1467079795711148062', // Ranklar
    '1467076700415328266', '1467076595507527834', '1467076260441231401', '1467073280237371527', // Ranklar
    '1467077436532457545', '1479839884075073567', '1479840791454154782', '1466948998463225859', // Kaptan vb.
    '1467152505862357250', // Security bypass
    '1517919240861257758', '1517919442279858307' // Seviye Rol Eşlemeleri
  ];

  // Rolleri kaldır
  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member) {
      for (const roleId of rolesToRemove) {
        if (roleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, 'İstifa').catch(() => { });
        }
      }
    }

    const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
    if (mainGuild) {
      const mainMember = await mainGuild.members.fetch(userId).catch(() => null);
      if (mainMember) {
        for (const roleId of rolesToRemove) {
          if (roleId && mainMember.roles.cache.has(roleId)) {
            await mainMember.roles.remove(roleId, 'İstifa').catch(() => { });
          }
        }
      }
    }
  } catch (_) { }

  // İstifa kaydını işle
  if (canRetire) {
    // 90+ gün: Emeklilik statüsüne çevir, kaydı tut
    p.status = 'retired';
    p.retiredAt = new Date();
    await p.save();
    console.log(`[staffSystem] İstifa → Emeklilik: ${userId} (${levelName})`);
  } else {
    // 90 günden az: Önce status'u güncelle (silme başarısız olursa DM gitmemesi için), sonra kaydı sil
    p.status = 'resigned';
    p.resignedAt = new Date();
    p.resignReason = reason?.slice(0, 300) || 'Belirtilmedi';
    await p.save();
    await StaffProgress.deleteOne({ userId });
    console.log(`[staffSystem] İstifa & Kayıt Silinme: ${userId} (${levelName})`);
  }

  // Kullanıcıya DM
  try {
    const user = await client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('👋 İstifan Alındı')
      .setDescription(
        `**${levelName}** görevinden istifa ettin.\n\n` +
          `**Geçirdiğin süre:** ${totalDays}+ aktif gün\n` +
          `**Sebep:** ${reason || 'Belirtilmedi'}\n\n` +
          canRetire
          ? `🏅 **90+ gün aktif kaldığın için** emeklilik statüsüne geçtiniz!\n**Kaydın sistemde korunmaktadır.**\n\`/emeklilik\` komutunu kullanarak resmi olarak emekli olabilirsin.`
          : `Tekrar başvurmak istersen yöneticilere yazabilirsin. Başarılar!`
      )
      .setFooter({ text: 'Eko Yıldız • Teşekkürler!' })
      .setTimestamp();
    await user.send({ embeds: [embed] });
  } catch (_) { }

  return { success: true, canRetire, recordDeleted: !canRetire };
}

// ── EMEKLİLİK sistemi ──────────────────────────────────────────────────────
const RETIREMENT_ROLE_ID = process.env.RETIREMENT_ROLE_ID || ''; // Emekli Personel rolü (opsiyonel)
const RETIREMENT_MIN_DAYS = 90; // Emeklilik için minimum aktif gün

async function retireFromStaff(userId, client) {
  const p = await StaffProgress.findOne({ userId });
  if (!p) return { success: false, message: 'Personel sisteminde kayıtlı değilsin.' };
  if (p.status === 'retired') return { success: false, message: 'Zaten emeklisin.' };

  const totalDays = (p.stats?.activeDays || 0);
  if (totalDays < RETIREMENT_MIN_DAYS) {
    return {
      success: false,
      message: `Emeklilik için en az **${RETIREMENT_MIN_DAYS} aktif gün** gerekli. Şu an: ${totalDays} gün.`,
    };
  }

  const levelName = ROLE_NAMES[p.level];
  const oldLevel = p.level;

  // Emeklilik kaydı
  p.status = 'retired';
  p.retiredAt = new Date();
  p.retiredAt = new Date();
  await p.save();

  // Staff rollerini kaldır, emekli rolü ver
  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member) {
      for (const roleId of Object.values(ROLES)) {
        if (roleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, 'Emeklilik').catch(() => { });
        }
      }
      if (RETIREMENT_ROLE_ID) {
        await member.roles.add(RETIREMENT_ROLE_ID, 'Emeklilik').catch(() => { });
      }
    }
  } catch (_) { }

  // Emeklilik DM
  try {
    const user = await client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🏅 EMEKLİLİK — Tebrikler!')
      .setDescription(
        `**${totalDays} aktif gün** sonra emekli oldun!\n\n` +
        `**Son görevin:** ${levelName}\n\n` +
        `Eko Yıldız topluluğuna verdiğin emek için çok teşekkürler! 🙏\n` +
        `Emekli olsan da her zaman burasının bir parçasısın. ❤️\n\n` +
        (RETIREMENT_ROLE_ID ? `🎖️ **Emekli Personel** rozeti verildi!` : '')
      )
      .addFields(
        { name: '⏰ Toplam Aktif Gün', value: `${totalDays} gün`, inline: true },
        { name: '📊 Son Seviye', value: levelName, inline: true },
        { name: '🎫 Çözülen Ticket', value: `${p.stats?.ticketsSolved || 0}+`, inline: true },
      )
      .setFooter({ text: 'Eko Yıldız • Emeklilik Belgesi 🎖️' })
      .setTimestamp();
    await user.send({ embeds: [embed] });
  } catch (_) { }

  console.log(`[staffSystem] Emeklilik: ${userId} (${levelName}, ${totalDays} gün)`);
  return { success: true, totalDays, levelName };
}
async function runDailyCheck(client) {
  if (global.SPAM_STOPPED) {
    console.log('[staffSystem] runDailyCheck skipped (global.SPAM_STOPPED is true)');
    return;
  }
  const checkDate = getTargetCheckDate();
  console.log(`[staffSystem] Günlük kontrol başladı (Hedef Tarih: ${checkDate})...`);

  try {
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);

    for (const p of allProgress) {
      // 🔧 Güvenlik: Objeler tanımlı değilse oluştur
      if (!p.stats) p.stats = {};
      if (!p.daily) p.daily = { date: '', greeted: false, voiceMinutes: 0 };
      if (!p.warnings) p.warnings = { count: 0 };
      if (!p.leaves) p.leaves = { totalCredits: 0, usedDays: [], lastLeaveDate: null, monthlyLeaveUsed: 0, weeklyLeaveUsed: 0 };
      if (!p.gamification) p.gamification = { totalPoints: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 } };

      // İstatistik alanlarını başlat
      p.stats.dailyTicketsToday = p.stats.dailyTicketsToday || 0;
      p.stats.ticketsSolved = p.stats.ticketsSolved || 0;
      p.stats.chatMessages = p.stats.chatMessages || 0;
      p.stats.activeDays = p.stats.activeDays || 0;
      p.stats.consecutiveDays = p.stats.consecutiveDays || 0;
      p.stats.moderationActions = p.stats.moderationActions || 0;
      p.stats.weeklyReports = p.stats.weeklyReports || 0;
      p.stats.lastCompleteDay = p.stats.lastCompleteDay || '';
      p.stats.breakCredits = p.stats.breakCredits || 0;

      // Günlük ticket sayacını sıfırla
      p.stats.dailyTicketsToday = 0;

      // Aylık/haftalık izin sayacını sıfırla
      const todayDate = new Date();
      const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
      const startOfWeek = new Date(todayDate);
      startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());

      // Aylık izin sayıldı mı kontrol et
      if (p.leaves.lastLeaveDate) {
        const lastLeaveDate = new Date(p.leaves.lastLeaveDate);
        if (lastLeaveDate < startOfMonth) {
          p.leaves.monthlyLeaveUsed = 0;
        }
        if (lastLeaveDate < startOfWeek) {
          p.leaves.weeklyLeaveUsed = 0;
        }
      }

      // Bugünü veya hedef günü kontrol et (görevi tamamladı mı?)
      const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const targetVoice = req.voiceMinutes + (p.daily?.transferredVoiceMinutes || 0);
      const greetDone = p.daily?.date === checkDate && p.daily?.greeted;
      const voiceDone = p.daily?.date === checkDate && (p.daily?.voiceMinutes || 0) >= targetVoice;
      const completedToday = (p.stats.lastCompleteDay === checkDate) || (greetDone && voiceDone);

      const activeDays = p.stats?.activeDays || 0;
      const isOnLeave = p.leaves?.usedDays?.includes(checkDate);
      const isUserInactive = isOnLeave || (await hasInactivityRole(p.userId, client));

      if (isUserInactive) {
        // İzinli/inaktif gün — uyarı veya ceza verilmez, streak sıfırlanmaz.
        await p.save();
      } else if (!completedToday) {
        // Bugün görev yapılmadı ve izinli değil — uyarı ver
        p.stats.consecutiveDays = 0;
        p.warnings.count = (p.warnings.count || 0) + 1;
        p.warnings.lowActivityNotified = false; // Aktif gün < 2 kontrolü için sıfırla

        // 3 gün uyarısı sonrası rol al (5 → 3 sıkılaştırıldı)
        if (p.warnings.count >= 3) {
          await removeRole(p, client);
        } else {
          await sendWarningDM(p, client);
          await p.save();
        }
      } else {
        // Bugün görev yapıldı — devam ettir
        if (p.stats.consecutiveDays > 0 && p.stats.consecutiveDays % 30 === 0) {
          await sendRequirementIncreaseDM(p, client);
        }
        // ✅ BUGFIX: Gece 23:30'da morning briefing atmayı engelle, verileri kaydet
        await p.save().catch(() => { });
      }

      // ⚠️ Aktif gün < 2 uyarısı (Bugün görevler yapıldıysa veya izinli/inaktifse gönderme!)
      if (activeDays < 2 && !isUserInactive && !completedToday) {
        await checkLowActivityWarning(p, client);
      }
    }

    console.log(`[staffSystem] Tamamlandı — ${allProgress.length} personel kontrol edildi`);
  } catch (err) {
    console.error('[staffSystem] Günlük kontrol hatası:', err.message);
  }
}

// ── Scheduler — sabah brifing + gün içi hatırlatmalar ──────────────────────
function startStaffScheduler(client) {
  function scheduleAt(hour, minute, callback) {
    function run() {
      if (global.SPAM_STOPPED) {
        console.log(`[staffSystem] scheduleAt skipped for ${hour}:${minute} (global.SPAM_STOPPED is true)`);
        return;
      }
      const now = new Date();
      // Turkey is permanently UTC+3
      const nowGmt3 = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const currentYear = nowGmt3.getUTCFullYear();
      const currentMonth = nowGmt3.getUTCMonth();
      const currentDate = nowGmt3.getUTCDate();

      // Target time in Turkey timezone (using UTC methods on GMT+3 shifted date)
      const targetGmt3 = new Date(Date.UTC(currentYear, currentMonth, currentDate, hour, minute, 0, 0));
      if (targetGmt3 <= nowGmt3) {
        targetGmt3.setUTCDate(targetGmt3.getUTCDate() + 1);
      }
      
      const delay = targetGmt3.getTime() - nowGmt3.getTime();
      
      console.log(`[staffSystem] Scheduled task for ${hour}:${minute} (Istanbul time). Real execution in ${Math.round(delay / 1000 / 60)} minutes.`);

      setTimeout(async () => {
        if (global.SPAM_STOPPED) return;
        try {
          await callback();
        } catch (err) {
          console.error('[staffSystem] Scheduler hata:', err.message);
        }
        run(); // Ertesi gün için tekrar planla
      }, delay);
    }
    run();
  }

  // 09:00 — Sabah brifing (tüm personele)
  scheduleAt(9, 0, async () => {
    console.log('[staffSystem] 09:00 sabah brifing gönderiliyor...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      await sendMorningBriefing(p, client).catch(() => { });
    }
  });

  // 13:00 — Öğlen hatırlatma (görevi tamamlamamış olanlara)
  scheduleAt(13, 0, async () => {
    console.log('[staffSystem] 13:00 öğlen hatırlatması...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const targetVoice = req.voiceMinutes + (p.daily?.transferredVoiceMinutes || 0);
      const isComplete = p.daily?.date === today && p.daily?.greeted && p.daily?.voiceMinutes >= targetVoice;
      if (!isComplete) {
        await sendMidDayReminder(p, client).catch(() => { });
      }
    }
  });

  // 19:00 — Akşam uyarısı (hâlâ tamamlamamışlara)
  scheduleAt(19, 0, async () => {
    console.log('[staffSystem] 19:00 akşam uyarısı...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const targetVoice = req.voiceMinutes + (p.daily?.transferredVoiceMinutes || 0);
      const isComplete = p.daily?.date === today && p.daily?.greeted && (p.daily?.voiceMinutes || 0) >= targetVoice;
      if (!isComplete) {
        await sendEveningWarning(p, client).catch(() => { });
      }
    }
  });

  // 15:00 — Öğleden sonra motivasyon mesajı (aktif olan personele)
  scheduleAt(15, 0, async () => {
    console.log('[staffSystem] 15:00 motivasyon mesajları gönderiliyor...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      // %50 şansla motivasyon gönder (tüm gruba yazarsak spam olur)
      if (Math.random() > 0.5) {
        await sendRandomMotivationDM(p, client).catch(() => { });
      }
    }
  });

  // 18:00 — Akşam eğlenceleri (gamification fun message'ları)
  scheduleAt(18, 0, async () => {
    console.log('[staffSystem] 18:00 eğlenceli mesajları gönderiliyor...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      // %60 şansla eğlenceli mesaj gönder
      if (Math.random() > 0.4) {
        await sendFunMessage(p.userId, client).catch(() => { });
      }
    }
  });

  // 21:00 — Akşam geç saatlerde teşvik mesajı
  scheduleAt(21, 0, async () => {
    console.log('[staffSystem] 21:00 gece motivasyonu...');
    const today = todayStr();
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const activeVoice = new Set();
    if (guild) {
      guild.voiceStates.cache.forEach((voiceState, userId) => {
        if (voiceState.channelId && !voiceState.member?.user.bot) {
          activeVoice.add(userId);
        }
      });
    }

    for (const p of allProgress) {
      const isOnLeave = p.leaves?.usedDays?.includes(today) || (await hasInactivityRole(p.userId, client));
      if (isOnLeave) continue;
      const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const targetVoice = req.voiceMinutes + (p.daily?.transferredVoiceMinutes || 0);
      const isComplete = p.daily?.date === today && p.daily?.greeted && (p.daily?.voiceMinutes || 0) >= targetVoice;

      // Gece aktif olanlara önce gece mesaisi teklifi gönder
      if (!isComplete && activeVoice.has(p.userId) && !p.daily?.overtimeActive) {
        await sendNightShiftOffer(p, client).catch(() => { });
        continue;
      }

      // Tamamlayanları tebrik et, tamamlayamayanlara son çağrı yap
      if (isComplete) {
        const embed = new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('✅ Günlük Görevleri Tamamladın!')
          .setDescription(`Muhteşem! Bugünün görevlerini başarıyla tamamladın! 🌟\n\nYarın da bu tempoyu koruyabilirsin. İyi geceler!`)
          .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
          .setTimestamp();
        try {
          const user = await client.users.fetch(p.userId);
          await user.send({ embeds: [embed] });
        } catch (_) { }
      } else {
        const today = todayStr();
        const stats = getDailyTaskCompletionStats(p);
        const targetVoice = req.voiceMinutes + (p.daily?.date === today ? (p.daily?.transferredVoiceMinutes || 0) : 0);
        const targetGreets = req.greets + (p.daily?.date === today ? (p.daily?.transferredGreets || 0) : 0);

        const isGreetDone = p.daily?.date === today && p.daily?.greeted;
        const greetsSent = p.daily?.date === today ? (p.daily?.greetCount || 0) : 0;
        const voiceMinutes = p.daily?.date === today ? (p.daily?.voiceMinutes || 0) : 0;

        const embed = new EmbedBuilder()
          .setColor(0xff3333)
          .setTitle('🚨 SON ÇAĞRI: Günlük Görevler İçin Son 2.5 Saat!')
          .setDescription(
            `Hey <@${p.userId}>, bugünün günlük görevlerini tamamlaman için **son 2.5 saat** kaldı! ⏰\n\n` +
            `Görevin gece **23:30'da** sıfırlanacak ve kontrol edilecektir. Haklarının yanmaması için lütfen kalan hedeflerini tamamla!\n\n` +
            `📊 **Mevcut İlerlemen:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**\n\n` +
            `📋 **Kalan Görevlerin:**\n` +
            (!isGreetDone ? `• 👋 **${targetGreets - greetsSent}x** daha yeni üyeye hoş geldin de (Gereken: ${targetGreets}x)\n` : '') +
            (voiceMinutes < targetVoice ? `• 🎤 **${targetVoice - voiceMinutes} dk** daha ses kanalında kal (Gereken: ${targetVoice} dk)\n` : '') +
            (p.daily?.chosenTask && !p.daily?.chosenTaskCompleted ? `• 🎯 Seçmeli Görev: **${CHOSEN_TASKS[p.daily.chosenTask] || p.daily.chosenTask}**\n` : '') +
            `\n⚠️ **Unutma:** Görevleri tamamlamazsan uyarı alabilirsin. Şu anki ardışık günlerin: **${p.stats?.consecutiveDays || 0} gün**.`
          )
          .setFooter({ text: 'Eko Yıldız • Son Hatırlatma Sistemi' })
          .setTimestamp();

        try {
          const user = await client.users.fetch(p.userId);
          await user.send({ embeds: [embed] });
        } catch (_) { }
      }
    }
  });

  // 23:30 — Günlük kapanış kontrol + uyarı
  scheduleAt(23, 30, async () => {
    console.log('[staffSystem] 23:30 günlük kapanış...');
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    for (const p of rawProgress) {
      await applyNightShiftMorningCarryover(p).catch(() => { });
      await p.save().catch(() => { });
    }
    await runDailyCheck(client);
  });

  // 17:00 — Doğrulama kontrolü
  scheduleAt(17, 0, async () => {
    console.log('[staffSystem] 17:00 doğrulama kontrolü...');
    await checkStaffVerifications(client);
  });

  // 12:00 — Günlük sınav kontrolü
  scheduleAt(12, 0, async () => {
    console.log('[staffSystem] 12:00 sınav kontrolü...');
    try {
      const { checkActiveExams } = require('./aiExamService');
      await checkActiveExams(client);
    } catch (err) {
      console.error('[staffSystem] Sınav kontrolü hatası:', err.message);
    }
  });

  // Her 1 dakikada bir ses aktifliği kontrolü
  setInterval(async () => {
    if (global.SPAM_STOPPED) return;
    try {
      const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
      if (!guild) return;

      const staffRoleIds = Object.values(ROLES);

      // Tüm aktif yetkilileri veritabanından al
      const allActiveStaff = await StaffProgress.find({ status: 'active' }).catch(() => []);
      const activeStaffIds = new Set(allActiveStaff.map(p => p.userId));

      // Sunucudaki tüm ses kanallarını gez
      const voiceStates = guild.voiceStates.cache;
      for (const [userId, voiceState] of voiceStates) {
        // Eğer bir kanaldaysa, bot değilse
        if (voiceState.channelId && !voiceState.member?.user.bot) {
          // Üye önbellekte yoksa fetch et
          const member = voiceState.member || await guild.members.fetch(userId).catch(() => null);
          if (!member) continue;

          // Veritabanında aktifse, Discord üzerinde yetkili rolü varsa veya Administrator ise yetkili kabul et
          const isStaff = activeStaffIds.has(userId) ||
            member.permissions.has('Administrator') ||
            staffRoleIds.some(rid =>
              rid && !['PERSONEL_ROLE_ID', 'GELISMIS_ROLE_ID', 'SEKRETER_ROLE_ID'].includes(rid)
              && member.roles.cache.has(rid)
            );

          if (isStaff) {
            // 1 dakika ses aktifliği ekle
            await addVoiceMinutes(userId, 1, client).catch(err => {
              console.error(`[staffSystem] addVoiceMinutes interval error for ${userId}:`, err.message);
            });
          }
        }
      }
    } catch (err) {
      console.error('[staffSystem] Ses aktifliği interval hatası:', err.message);
    }
  }, 60000).unref();

  console.log('[staffSystem] Scheduler başlatıldı (09:00 / 12:00 / 13:00 / 17:00 / 19:00 / 23:30)');

  // Başlangıçta hemen doğrulama kontrolünü bir defa yap
  setTimeout(() => checkStaffVerifications(client), 10000); // 10 saniye sonra
  setTimeout(() => {
    try {
      const { checkActiveExams } = require('./aiExamService');
      checkActiveExams(client);
    } catch (_) { }
  }, 15000); // 15 saniye sonra
}

// ── PERSONEL DOĞRULAMA KONTROLÜ (ROBLOX & DISCORD) ─────────────────────────
async function checkStaffVerifications(client) {
  try {
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);
    const User = require('../../models/User');
    const { BASE_URL } = require('../../config');
    let notifiedCount = 0;
    const { fetchUserGroups } = require('./roleSyncService');
    const { ROBLOX, ADMIN_GUILD_ID } = require('./staffAutomation');

    for (const p of allProgress) {
      const user = await User.findOne({ discordId: p.userId });

      const missingRoblox = !user || !user.robloxId;
      const missingGuild = !p.guildJoined; // guildJoined is in StaffProgress
      let missingRobloxGroup = false;

      if (!missingRoblox) {
        try {
          const userGroups = await fetchUserGroups(user.robloxId);
          if (!userGroups.some(g => g.group.id === ROBLOX.EKOYILDIZ_MOD)) {
            missingRobloxGroup = true;
          }
        } catch (err) {
          console.warn(`[checkStaffVerifications] Grup kontrolü yapılamadı (User: ${user.robloxId}):`, err.message);
        }
      }

      // EĞER KULLANICI MODERATÖR SUNUCUSUNDAYSA UYARIYI ATMA
      let inModeratorServer = false;
      try {
        const modGuild = await client.guilds.fetch(ADMIN_GUILD_ID).catch(() => null);
        if (modGuild) {
          const modMember = await modGuild.members.fetch(p.userId).catch(() => null);
          if (modMember) inModeratorServer = true;
        }
      } catch (e) { }

      if (inModeratorServer) continue; // Kullanıcı sunucuda ise DM atma!

      if (missingRoblox || missingGuild || missingRobloxGroup) {
        let instructionText = "";
        if (missingRoblox) {
          instructionText = `❌ **Aşama 1 - Roblox Hesabını Bağla:** [Buraya Tıklayarak](${BASE_URL}/dashboard) hesabınızı hemen bağlayın.\n\n*(Bu aşamayı tamamladıktan sonra sıradaki adım size iletilecektir)*`;
        } else if (missingRobloxGroup) {
          instructionText = `❌ **Aşama 2 - Roblox Moderatör Grubuna Katıl:** Hemen yetkili grubumuza katılın: https://www.roblox.com/communities/130659145/EkoY-ld-z-Moderat-r-Ekibi#!/about\n\n*(Gruba katılma isteği gönderdikten sonra aşağıdaki **"✅ Doğrulamayı Tamamla"** butonuna tıklayarak veya sunucuda \`/personel-dogrula\` yazarak işleminizi anında onaylatabilirsiniz!)*`;
        } else if (missingGuild) {
          instructionText = `❌ **Aşama 3 - Yönetim Sunucusuna Katıl:** Hemen yönetim sunucumuza katılın: https://discord.gg/fjwjMgH54N\n\n*(Bu son adımdır, tamamladığınızda yetkileriniz aktif kalacaktır)*`;
        }

        const embed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('🚨 DİKKAT: Eksik Doğrulama İşlemi')
          .setDescription(
            `Merhaba <@${p.userId}>, EkoYıldız moderatör ekibinde bulunuyorsun ancak sistemlerimizde **doğrulamanın eksik olduğu tespit edildi.**\n\n` +
            `Görevinize devam edebilmeniz ve yetkilerinizi alabilmeniz için işlemleri aşama aşama tamamlamanız gerekmektedir. Lütfen aşağıdaki adımı gerçekleştirin:\n\n` +
            instructionText +
            `\n\nBu uyarıyı dikkate almazsanız yetkileriniz sistem tarafından otomatik olarak alınabilir.`
          )
          .setFooter({ text: 'EkoYıldız Yüksek Güvenlikli Otomasyon Sistemi' })
          .setTimestamp();

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("btn_personel_check")
            .setLabel("✅ Doğrulamayı Tamamla")
            .setStyle(ButtonStyle.Success)
        );

        try {
          const discordUser = await client.users.fetch(p.userId);
          if (discordUser) {
            await discordUser.send({ embeds: [embed], components: [row] });
            notifiedCount++;
          }
        } catch (_) { }
      }
    }
    console.log(`[staffSystem] Personel doğrulamaları kontrol edildi. ${notifiedCount} kişiye uyarı gönderildi.`);
  } catch (err) {
    console.error('[staffSystem] checkStaffVerifications hatası:', err.message);
  }
}

// ── SİSTEM GÜNCELLEME BİLDİRİMLERİ ─────────────────────────────────────────
/**
 * Tüm personele sistem güncellemesi hakkında bildir
 */
async function notifyAllStaffAboutUpdate(title, description, changes, client) {
  try {
    const rawProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle(`🔄 Personel Sistemi Güncellendi - ${title}`)
      .setDescription(description)
      .addFields({
        name: '📝 Yapılan Değişiklikler',
        value: changes.join('\n'),
        inline: false,
      })
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Sürüm Güncelleme' })
      .setTimestamp();

    for (const p of allProgress) {
      try {
        const user = await client.users.fetch(p.userId);
        if (user) await user.send({ embeds: [embed] }).catch(() => { });
      } catch (_) { }
    }

    console.log(`[staffSystem] ${allProgress.length} personele güncelleme bildirimi gönderildi`);
  } catch (err) {
    console.error('[staffSystem] Bildirim hatası:', err.message);
  }
}

// Başlangıçta çalışacak - tüm personele sistem yükseltmesi hakkında bildir
async function sendSystemUpdateNotification(client) {
  try {
    // Sadece systemIntroducedV5: false veya undefined olanları bul
    const rawProgress = await StaffProgress.find({
      level: { $gte: 1, $lte: 5 },
      status: 'active',
      $or: [
        { 'gamification.systemIntroducedV5': false },
        { 'gamification.systemIntroducedV5': { $exists: false } }
      ]
    });
    const allProgress = await syncAndFilterActiveStaff(rawProgress, client);

    if (allProgress.length === 0) return;

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const embed = new EmbedBuilder()
      .setColor(0x00b4d8)
      .setTitle('🚀 EKOYILDIZ Moderasyon Personel Sistemi V5.0')
      .setDescription(
        'Hoşgeldiniz moderatörler.. Ben Sentara, EkoYıldız\'ın yeni nesil personel ve moderasyon botuyum. Sistemimiz V5.0 sürümüne yükseltildi! İşte bu güncellemede gelen yenilikler:\n\n' +
        '**🌴 İnaktiflik & İzin Koruma Sistemi:**\n' +
        '• Artık sunucuda inaktiflik, mazeret veya izin rolleri olan yetkililerimize hiçbir bildirim, hatırlatma veya uyarı gitmez.\n\n' +
        '**⏰ Saat Dilimi & Gece Koruma Algoritması:**\n' +
        '• Gece yarısı/sabah erken saatlerdeki görev kontrolü sıfırlanma bugları düzeltildi. Saat 04:00\'e kadar olan kontroller dün yapılmış gibi değerlendirilir.\n\n' +
        '**📊 Görev İlerleme Yüzdeleri & Grafik İlerleme Barı:**\n' +
        '• Artık `/profil`, `/personeldurum` ve DM hatırlatma mesajlarında günlük görevlerinizin yüzde kaçını tamamladığınızı gösteren bir grafik barı (`[██████░░░░]`) bulunuyor!\n\n' +
        '**🛡️ Koç Spam Koruması & node-cron Entegrasyonu:**\n' +
        '• Aylık koç sınav bildirimlerindeki spam bugları düzeltildi ve her ay kullanıcı başına maksimum 1 mesaj limiti getirildi.\n\n' +
        '**🤖 Gerçekçi Moderasyon & AI Koç Roleplay Sistemi:**\n' +
        '• AI Koçlarınız artık birer disiplinli, deneyimli ve gerçekçi moderatör rolünde sizinle konuşur! Kuralları, analizleri ve sunucu hedeflerini gerçekçi bir mentor gibi yönlendirir.\n\n' +
        '**🔒 Sistem Güvenliği (Self-Shutdown):**\n' +
        '• Discord yasaklamalarını önlemek için bot, herhangi bir spam döngüsü tespit ettiğinde kendini güvenli bir şekilde kapatır.\n\n' +
        '**🎁 Versiyon V5.0 Güncelleme Ödülünüz:**\n' +
        '• Yeni sürüme hoş geldiniz hediyesi olarak **300 EkoCoin** ve **800 XP** sizi bekliyor! Aşağıdaki **ÖDÜLÜ AL** butonuna basarak claim edebilirsiniz.'
      )
      .setFooter({ text: 'Eko Yıldız • Personel Yönetim Sistemi V5.0' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('claim_version_reward')
        .setLabel('🎁 ÖDÜLÜ AL')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('test_features')
        .setLabel('🚀 ÖZELLİKLERİ TEST ET')
        .setStyle(ButtonStyle.Primary)
    );

    for (const p of allProgress) {
      try {
        const user = await client.users.fetch(p.userId);
        if (user) {
          await user.send({ embeds: [embed], components: [row] }).catch(() => { });

          p.gamification = p.gamification || {};
          p.gamification.systemIntroducedV5 = true;
          await p.save().catch(() => { });
        }
      } catch (_) { }
    }

    console.log(`[staffSystem] ${allProgress.length} personele V5.0 güncelleme bildirimi gönderildi`);
  } catch (err) {
    console.error('[staffSystem] Sistem bildirimi hatası:', err.message);
  }
}

/**
 * Belirli bir personele özel bildirim gönder
 */
async function notifyStaff(userId, title, message, color = 0x7c6af7, client) {
  try {
    const user = await client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(message)
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    await user.send({ embeds: [embed] });
  } catch (err) {
    console.warn(`[staffSystem] Bildirim gönderilemedi (${userId}):`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// 🎮 GAMİFİCATION SİSTEMİ (OYUNLAŞTIRMA)
// ═══════════════════════════════════════════════════════════════════════════════════

// Rozet tanımları
const BADGES = {
  firstTicket: { name: '🎫 İlk Ticket', desc: 'İlk ticket\'ini çözdün!', xp: 50 },
  weekWarrior: { name: '⚔️ Hafta Savaşçısı', desc: '7 gün ardışık başarı!', xp: 200 },
  monthMaster: { name: '👑 Ay Hakimi', desc: '30 gün ardışık başarı!', xp: 500 },
  ticketHero: { name: '🦸 Ticket Kahramanı', desc: '50 ticket çözdün!', xp: 300 },
  supportStar: { name: '⭐ Destek Yıldızı', desc: '100 ticket çözdün!', xp: 750 },
  legendaryHelper: { name: '🌟 Efsane Yardımcı', desc: '250 ticket çözdün!', xp: 2000 },
  perfectWeek: { name: '💯 Mükemmel Hafta', desc: '7 gün 100% başarı!', xp: 400 },
  socialButterfly: { name: '🦋 Sosyal Kelebeği', desc: '10 anket yönettin!', xp: 300 },
  moderator: { name: '🛡️ Moderatör', desc: '30 moderasyon işlemi!', xp: 350 },
  speedRunner: { name: '⚡ Hız Ustası', desc: 'Aynı gün 5 ticket!', xp: 250 },
  noMissWeek: { name: '🎯 Hedefçi', desc: '7 gün uyarısız!', xp: 300 },
  chatterbox: { name: '💬 Muhabbetçi', desc: 'Sohbette 500 mesaj gönderdin!', xp: 300 },
};

/**
 * XP ve seviye hesapla
 */
function getXpForLevel(level) {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

/**
 * Rozetleri kontrol et ve kilidi aç
 */
async function checkAndUnlockBadges(progress, client) {
  if (!progress.gamification) {
    progress.gamification = {
      totalPoints: 0,
      level: 1,
      currentXP: 0,
      badges: {},
      streak: { current: 0, longest: 0, brokenDays: 0 },
    };
  }

  const badges = progress.gamification.badges || {};
  const stats = progress.stats || {};
  let newBadges = [];

  // Rozetleri kontrol et
  if (stats.ticketsSolved === 1 && !badges.firstTicket) {
    badges.firstTicket = true;
    newBadges.push('firstTicket');
  }

  if (stats.consecutiveDays === 7 && !badges.weekWarrior) {
    badges.weekWarrior = true;
    newBadges.push('weekWarrior');
  }

  if (stats.consecutiveDays === 30 && !badges.monthMaster) {
    badges.monthMaster = true;
    newBadges.push('monthMaster');
  }

  if ((stats.ticketsSolved || 0) >= 50 && !badges.ticketHero) {
    badges.ticketHero = true;
    newBadges.push('ticketHero');
  }

  if ((stats.ticketsSolved || 0) >= 100 && !badges.supportStar) {
    badges.supportStar = true;
    newBadges.push('supportStar');
  }

  if ((stats.ticketsSolved || 0) >= 250 && !badges.legendaryHelper) {
    badges.legendaryHelper = true;
    newBadges.push('legendaryHelper');
  }

  if ((stats.surveysCompleted || 0) >= 10 && !badges.socialButterfly) {
    badges.socialButterfly = true;
    newBadges.push('socialButterfly');
  }

  if ((stats.moderationActions || 0) >= 30 && !badges.moderator) {
    badges.moderator = true;
    newBadges.push('moderator');
  }

  if (!badges.noMissWeek && progress.warnings?.count === 0 && stats.consecutiveDays === 7) {
    badges.noMissWeek = true;
    newBadges.push('noMissWeek');
  }

  if ((stats.dailyTicketsToday || 0) >= 5 && !badges.speedRunner) {
    badges.speedRunner = true;
    newBadges.push('speedRunner');
  }

  if ((stats.chatMessages || 0) >= 500 && !badges.chatterbox) {
    badges.chatterbox = true;
    newBadges.push('chatterbox');
  }

  // Yeni rozetler için gönder
  if (newBadges.length > 0) {
    for (const badgeId of newBadges) {
      await sendBadgeUnlockedDM(progress, badgeId, client).catch(() => { });
    }
  }

  await progress.save().catch(() => { });
  return newBadges;
}

/**
 * Rozet açıldığında bildir
 */
async function sendBadgeUnlockedDM(progress, badgeId, client) {
  const badge = BADGES[badgeId];
  if (!badge) return;

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`🏆 ROZET AÇILDI: ${badge.name}`)
    .setDescription(
      `\`\`\`\n${badge.name}\n\`\`\`\n\n` +
      `**${badge.desc}**\n\n` +
      `✨ +${badge.xp} XP kazandın!\n\n` +
      `Harika bir başarı! Bu rozeti taşı gurulla! 💪`
    )
    .setFooter({ text: 'Eko Yıldız • Gamification' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
    console.log(`[staffSystem] Rozet açıldı: ${progress.userId} → ${badgeId}`);
  } catch (_) { }
}

/**
 * Leaderboard al (Top 25) - Geliştirilmiş versiyon
 */
async function getLeaderboard(category = 'points') {
  try {
    let sortField;
    switch (category) {
      case 'xp':
        sortField = { 'gamification.currentXP': -1 };
        break;
      case 'level':
        sortField = { 'level': -1 };
        break;
      case 'badges':
        sortField = { 'gamification.badges': -1 };
        break;
      case 'streak':
        sortField = { 'gamification.streak.current': -1 };
        break;
      default: // points
        sortField = { 'gamification.totalPoints': -1 };
    }

    const allProgress = await StaffProgress.find({ status: 'active' })
      .sort(sortField)
      .limit(25)
      .select('userId gamification stats level');

    const { getDiscordClient } = require('../discordClient');
    const client = getDiscordClient();

    const leaderboardData = await Promise.all(
      allProgress.map(async (p, idx) => {
        let username = `Kullanıcı #${p.userId}`;
        if (client) {
          const userObj = await client.users.fetch(p.userId).catch(() => null);
          if (userObj) {
            username = userObj.username;
          }
        }
        return {
          rank: idx + 1,
          userId: p.userId,
          username: username,
          points: p.gamification?.totalPoints || 0,
          level: p.level,
          xpLevel: p.gamification?.level || 1,
          xp: p.gamification?.currentXP || 0,
          tickets: p.stats?.ticketsSolved || 0,
          badges: Object.values(p.gamification?.badges || {}).filter(Boolean).length,
          streak: p.gamification?.streak?.current || 0,
          isPremium: false
        };
      })
    );

    return leaderboardData;
  } catch (err) {
    console.error('[staffSystem] Leaderboard hatası:', err.message);
    return [];
  }
}

/**
 * Kullanıcının leaderboard sırasını bul
 */
async function getUserLeaderboardRank(userId, category = 'points') {
  try {
    let sortField;
    switch (category) {
      case 'xp':
        sortField = { 'gamification.currentXP': -1 };
        break;
      case 'level':
        sortField = { 'level': -1 };
        break;
      case 'badges':
        sortField = { 'gamification.badges': -1 };
        break;
      case 'streak':
        sortField = { 'gamification.streak.current': -1 };
        break;
      default:
        sortField = { 'gamification.totalPoints': -1 };
    }

    const allProgress = await StaffProgress.find({ status: 'active' })
      .sort(sortField)
      .select('userId gamification stats level');

    const userRank = allProgress.findIndex(p => p.userId === userId) + 1;
    const userData = allProgress.find(p => p.userId === userId);

    if (!userData) return null;

    const { getDiscordClient } = require('../discordClient');
    const client = getDiscordClient();
    let username = `Kullanıcı #${userData.userId}`;
    if (client) {
      const userObj = await client.users.fetch(userData.userId).catch(() => null);
      if (userObj) {
        username = userObj.username;
      }
    }

    return {
      rank: userRank,
      total: allProgress.length,
      userId: userData.userId,
      username: username,
      points: userData.gamification?.totalPoints || 0,
      level: userData.level,
      xpLevel: userData.gamification?.level || 1,
      xp: userData.gamification?.currentXP || 0,
      tickets: userData.stats?.ticketsSolved || 0,
      badges: Object.values(userData.gamification?.badges || {}).filter(Boolean).length,
      streak: userData.gamification?.streak?.current || 0,
    };
  } catch (err) {
    console.error('[staffSystem] getUserLeaderboardRank hatası:', err.message);
    return null;
  }
}

/**
 * Haftalık Challenge (Zorluk) sistemi
 */
const WEEKLY_CHALLENGES = [
  {
    id: 'ticketBlitz',
    name: '🚀 Ticket Patlaması',
    goal: 10,
    description: 'Bu hafta 10 ticket çöz!',
    reward: 750, // 500 → 750 (artırıldı)
    xpReward: 400,
  },
  {
    id: 'perfectStreak',
    name: '💯 Mükemmel Hafta',
    goal: 7,
    description: '7 gün uyarısız kalmayı başar!',
    reward: 600, // 400 → 600 (artırıldı)
    xpReward: 350,
  },
  {
    id: 'chat_50',
    name: '💬 Geveze Personel',
    goal: 100,
    description: 'Bu hafta sohbet kanalına 100 mesaj gönder!',
    reward: 500,
    xpReward: 300,
  },
  {
    id: 'socialStar',
    name: '⭐ Sosyal Yıldız',
    goal: 4,
    description: 'Her gün sohbete 5+ selam ver!',
    reward: 400, // 250 → 400 (artırıldı)
    xpReward: 250,
  },
  {
    id: 'moderationMaster',
    name: '🛡️ Moderasyon Ustası',
    goal: 8,
    description: '8 moderasyon işlemi yap!',
    reward: 550,
    xpReward: 320,
  },
  {
    id: 'endlessHelper',
    name: '♾️ Sonsuz Yardımcı',
    goal: 15,
    description: 'Haftada 15 ticket çöz (zorlu!)',
    reward: 1000, // Yeni, çok cazip
    xpReward: 600,
  },
];

/**
 * Mevcut hafta challenge'ı döndür
 */
function getWeeklyChallenge() {
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % WEEKLY_CHALLENGES.length;
  return WEEKLY_CHALLENGES[week];
}

/**
 * Personele eğlenceli mesaj gönder
 */
async function sendFunMessage(userId, client) {
  if (await hasInactivityRole(userId, client)) return;
  const funMessages = [
    {
      title: '🎮 OYUN ZAMANINDA!',
      desc: 'Sende kaç puan var? Leaderboard\'a bak! `/leaderboard`',
      color: 0x9d4edd,
    },
    {
      title: '⚡ ÇOK HIZLISSIN!',
      desc: 'Şu hızla gidersen sekreter olursun! Devam et! 💨',
      color: 0x00b4d8,
    },
    {
      title: '🌟 ROZETLER KAZAN!',
      desc: 'Biraz daha ilerlersen yeni rozetler açılacak! Heyecanlı mı? 🏆',
      color: 0xffd60a,
    },
    {
      title: '🎯 HAFTALIK CHALLENGE!',
      desc: `Bu hafta "${getWeeklyChallenge().name}" challenge\'ı var. Başarabilir misin?`,
      color: 0xff006e,
    },
    {
      title: '💪 BÜ GÜZEL!',
      desc: 'Seni sunucuda görmek çok mutlu ediyor! Devam et! 😊',
      color: 0x06ffa5,
    },
  ];

  const msg = funMessages[Math.floor(Math.random() * funMessages.length)];
  const embed = new EmbedBuilder()
    .setColor(msg.color)
    .setTitle(msg.title)
    .setDescription(msg.desc)
    .setFooter({ text: 'Eko Yıldız • Eğlence' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
  } catch (_) { }
}

async function completeOvertime(progress, client) {
  try {
    progress.daily.overtimeCompleted = true;
    progress.daily.overtimeActive = false;

    const isNightShift = progress.daily.nightShiftActive && progress.daily.overtimeTask === 'overtime_voice';
    if (isNightShift) {
      progress.daily.nightShiftActive = false;
      progress.daily.nightShiftAcceptedAt = null;
    }

    // Determine rewards
    let coinsReward = 50;
    let xpReward = 150;
    let taskNameText = 'Ek Görev';

    if (progress.daily.overtimeTask === 'overtime_voice') {
      if (isNightShift) {
        coinsReward = 150;
        xpReward = 450;
        taskNameText = 'Gece Mesaisi (20 Dakika)';
      } else {
        coinsReward = 100;
        xpReward = 300;
        taskNameText = 'Ses Ek Mesaisi (20 Dakika)';
      }
    } else {
      const taskLabels = {
        'task_chat': 'Ek Sohbet Görevi (10 Mesaj)',
        'task_voice': 'Ek Ses Görevi (15 Dakika)',
        'task_ticket': 'Ek Ticket Görevi (1 Çözüm)',
        'task_mod': 'Ek Moderasyon Görevi (1 İşlem)'
      };
      taskNameText = taskLabels[progress.daily.overtimeTask] || 'Ek Görev';
    }

    // Add EkoCoins and XP
    progress.gamification = progress.gamification || {};
    progress.gamification.ecoCoins = (progress.gamification.ecoCoins || 0) + coinsReward;
    progress.gamification.currentXP = (progress.gamification.currentXP || 0) + xpReward;

    // Check level up
    const nextLevelXp = getXpForLevel((progress.gamification.level || 1) + 1);
    if (progress.gamification.currentXP >= nextLevelXp) {
      progress.gamification.level = (progress.gamification.level || 1) + 1;
      progress.gamification.currentXP = 0;
    }

    await progress.save();

    // Send DM
    if (client) {
      try {
        const user = await client.users.fetch(progress.userId).catch(() => null);
        if (user) {
          const embed = new EmbedBuilder()
            .setColor(0xfbbf24)
            .setTitle('🔥 EK GÖREV / EK MESAİ TAMAMLANDI!')
            .setDescription(
              `Tebrikler <@${progress.userId}>, bugünün **"${taskNameText}"** ek mesai görevini başarıyla tamamladın!\n\n` +
              `✨ **+${xpReward} XP** kazanıldı!\n` +
              `💰 **+${coinsReward} EkoCoin (E.C.)** kazanıldı!\n` +
              `💳 Güncel Bakiyen: \`${progress.gamification.ecoCoins} E.C.\``
            )
            .setFooter({ text: 'Eko Yıldız • Ek Görev Sistemi' })
            .setTimestamp();
          await user.send({ embeds: [embed] }).catch(() => { });
        }
      } catch (dmErr) {
        console.warn(`[staffSystem] Overtime completion DM error:`, dmErr.message);
      }
    }
  } catch (err) {
    console.error('[staffSystem] completeOvertime error:', err.message);
  }
}

async function sendNightShiftOffer(progress, client) {
  if (!progress || !client) return;
  if (progress.daily?.overtimeActive || progress.daily?.nightShiftActive) return;
  if (await hasInactivityRole(progress.userId, client)) return;

  try {
    const user = await client.users.fetch(progress.userId).catch(() => null);
    if (!user) return;

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
    const today = todayStr();
    const greetsDone = progress.daily?.date === today ? (progress.daily?.greetCount || 0) : 0;
    const voiceDone = progress.daily?.date === today ? (progress.daily?.voiceMinutes || 0) : 0;
    const remainingGreets = Math.max(0, req.greets - greetsDone);

    const embed = new EmbedBuilder()
      .setColor(0x6b21a8)
      .setTitle('🌙 GECE MESAİSİ TEKLİFİ')
      .setDescription(
        `Selam <@${progress.userId}>, gece aktif olduğunu gördüm. Eğer bu gece ekstra bir mesai yaparsan **1.5x ödül** kazanabilirsin! 💫\n\n` +
        `Bu gece saat 23:30'a kadar kalan günlük görevlerini bitirirsen, ayrıca ek gece mesaisi bonusu kazanabilirsin.`
      )
      .addFields(
        { name: '📌 Kalan Hedeflerin', value: `• Selamlaşma: **${remainingGreets}** adet\n• Ses: **${Math.max(0, req.voiceMinutes - voiceDone)}** dk`, inline: false },
        { name: '⚡ Gece Mesaisi Avantajı', value: '• +150 E.C. ve +450 XP bonuslu ek görev\n• Gece aktifliğini kazanca dönüştür', inline: false }
      )
      .setFooter({ text: 'Eko Yıldız • Gece Mesaisi Sistemi' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_accept_nightshift')
        .setLabel('⚡ Gece Mesaisi Al')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('staff_decline_nightshift')
        .setLabel('❌ Bu Gece Dinlen')
        .setStyle(ButtonStyle.Secondary)
    );

    await user.send({ embeds: [embed], components: [row] }).catch(() => { });
  } catch (err) {
    console.error('[staffSystem] sendNightShiftOffer error:', err.message);
  }
}

async function applyNightShiftMorningCarryover(progress) {
  if (!progress || !progress.daily || !progress.daily.nightShiftActive) return;

  const today = todayStr();
  if (progress.daily.date !== today) return;

  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const remainingVoice = Math.max(0, req.voiceMinutes - (progress.daily.voiceMinutes || 0));
  const remainingGreets = progress.daily.greeted ? 0 : req.greets;

  if (remainingVoice > 0) {
    progress.daily.transferToTomorrowVoice = (progress.daily.transferToTomorrowVoice || 0) + remainingVoice;
  }
  if (remainingGreets > 0) {
    progress.daily.transferToTomorrowGreets = (progress.daily.transferToTomorrowGreets || 0) + remainingGreets;
  }

  progress.daily.nightShiftActive = false;
  progress.daily.nightShiftAcceptedAt = null;
}

async function recordOvertimeTask(userId, type, client) {
  try {
    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') {
      return { success: false, message: 'Aktif personel bulunamadı.' };
    }

    resetDaily(p);

    if (p.daily.overtimeActive) {
      return { success: false, message: 'Bugün zaten aktif bir ek göreviniz veya ek mesainiz var!' };
    }

    if (type === 'night_shift') {
      p.daily.overtimeActive = true;
      p.daily.overtimeTask = 'overtime_voice';
      p.daily.overtimeTarget = 20; // 20 dk seste kal
      p.daily.overtimeProgress = 0;
      p.daily.overtimeCompleted = false;
      p.daily.nightShiftActive = true;
      p.daily.nightShiftAcceptedAt = new Date();
      await p.save();

      return {
        success: true,
        taskName: '🌙 Gece Mesaisi',
        description: 'Gece aktifliğini ekstra ödüle çevir. Ses kanallarında fazladan **20 dakika** kal.',
        reward: '💰 +150 E.C. ve ✨ +450 XP (1.5x bonus)'
      };
    }

    if (type === 'ek_mesai') {
      // Ses Ek Mesaisi
      p.daily.overtimeActive = true;
      p.daily.overtimeTask = 'overtime_voice';
      p.daily.overtimeTarget = 20; // 20 dk seste kal
      p.daily.overtimeProgress = 0;
      p.daily.overtimeCompleted = false;
      await p.save();

      return {
        success: true,
        taskName: '⚡ Ses Ek Mesaisi',
        description: 'Ses kanallarında fazladan **20 dakika** geçir.',
        reward: '💰 +100 E.C. ve ✨ +300 XP'
      };
    } else {
      // Ek Görev
      const taskKeys = ['task_chat', 'task_voice', 'task_ticket', 'task_mod'];
      const randomTask = taskKeys[Math.floor(Math.random() * taskKeys.length)];

      p.daily.overtimeActive = true;
      p.daily.overtimeTask = randomTask;
      p.daily.overtimeCompleted = false;
      p.daily.overtimeProgress = 0;

      let taskName = '';
      let description = '';
      let target = 0;

      if (randomTask === 'task_chat') {
        target = 10;
        taskName = '💬 Ek Sohbet Görevi';
        description = 'Sohbette fazladan **10 mesaj** gönder.';
      } else if (randomTask === 'task_voice') {
        target = 15;
        taskName = '🎤 Ek Ses Görevi';
        description = 'Ses kanallarında fazladan **15 dakika** geçir.';
      } else if (randomTask === 'task_ticket') {
        target = 1;
        taskName = '🎫 Ek Ticket Görevi';
        description = 'Bugün fazladan **1 ticket** çöz.';
      } else if (randomTask === 'task_mod') {
        target = 1;
        taskName = '🛡️ Ek Moderasyon Görevi';
        description = 'Bugün fazladan **1 moderasyon işlemi** gerçekleştir.';
      }

      p.daily.overtimeTarget = target;
      await p.save();

      return {
        success: true,
        taskName,
        description,
        reward: '💰 +50 E.C. ve ✨ +150 XP'
      };
    }
  } catch (err) {
    console.error('[staffSystem] recordOvertimeTask error:', err.message);
    return { success: false, message: 'Ek görev tanımlanırken hata oluştu.' };
  }
}

async function postponeDailyTask(userId, client) {
  try {
    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') {
      return { success: false, message: 'Aktif personel bulunamadı.' };
    }

    resetDaily(p);

    if (p.postponeBlocked) {
      return { success: false, message: 'Görev eksiltme yetkiniz AI Koç tarafından askıya alınmıştır!' };
    }

    if (p.stats && p.stats.lastDayPostponed) {
      return { success: false, message: 'Görev erteleme/eksiltme hakkını üst üste iki gün kullanamazsınız!' };
    }

    if (p.daily.postponedToday) {
      return { success: false, message: 'Bugün zaten görev eksiltme hakkınızı kullandınız!' };
    }

    const req = getDailyRequirements(p.level, p.stats.consecutiveDays || 0);
    const todayTargetVoice = req.voiceMinutes + (p.daily.transferredVoiceMinutes || 0);

    const remainingVoice = Math.max(0, todayTargetVoice - (p.daily.voiceMinutes || 0));

    // Selamlaşma için: eğer selam verilmemişse selamı ertele
    const remainingGreets = p.daily.greeted ? 0 : 1;

    if (remainingVoice <= 0 && remainingGreets <= 0) {
      return { success: false, message: 'Bugünkü tüm görevlerinizi zaten tamamladınız, eksiltecek görev kalmadı!' };
    }

    let resultText = '';

    if (remainingVoice > 0) {
      p.daily.transferToTomorrowVoice = (p.daily.transferToTomorrowVoice || 0) + remainingVoice;
      p.daily.transferredVoiceMinutes = (p.daily.transferredVoiceMinutes || 0) - remainingVoice;
      resultText += `• **${remainingVoice} dakika** ses aktifliği yarınki görevinize aktarıldı.\n`;
    }

    if (remainingGreets > 0) {
      p.daily.transferToTomorrowGreets = (p.daily.transferToTomorrowGreets || 0) + remainingGreets;
      p.daily.transferredGreets = (p.daily.transferredGreets || 0) - remainingGreets;
      // Bugün tamamlanmış sayılması için greeted'ı true yapalım
      p.daily.greeted = true;
      resultText += `• **Selamlaşma görevi** yarınki görevinize aktarıldı.\n`;
    }

    p.daily.postponedToday = true;
    await p.save();

    // Günlük görevin tamamlanıp tamamlanmadığını kontrol et
    await checkDailyCompletion(p, client).catch(() => { });

    return {
      success: true,
      message: resultText
    };
  } catch (err) {
    console.error('[staffSystem] postponeDailyTask error:', err.message);
    return { success: false, message: 'Görev erteleme işlemi sırasında hata oluştu.' };
  }
}

// ── V5.1 HATA GIDERME VE AYARLAR YENILIKLERI ──

function generateGreetProgressEmbed(progress) {
  const req = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const targetGreets = req.greets + (progress.daily?.transferredGreets || 0);
  const stats = getDailyTaskCompletionStats(progress);
  
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('🌅 Selamlaşma İlerlemesi')
    .setDescription(
      `Merhaba <@${progress.userId}>,\n\n` +
      `Grupta selam verdin! Selamlaşma görevi ilerlemen: **${progress.daily.greetCount}/${targetGreets}**\n\n` +
      `📊 **Genel Görev İlerlemen:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**`
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
    .setTimestamp();
}

function getGreetProgressComponents() {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_update_greet_progress')
      .setLabel('🔄 Güncelle')
      .setStyle(ButtonStyle.Primary)
  );
  return [row];
}

function generateSettingsEmbed(progress) {
  const briefingStatus = progress.settings?.dailyBriefingEnabled !== false ? '🟢 Açık' : '🔴 Kapalı';
  const warningsStatus = progress.settings?.warningsEnabled !== false ? '🟢 Açık' : '🔴 Kapalı';
  
  return new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle('⚙️ Personel Bildirim & Görev Ayarları')
    .setDescription(
      `Buradan bot bildirimlerinizi ve ayarlarınızı yapılandırabilirsiniz.\n\n` +
      `📅 **Sabah Brifingi:** Günlük görevlerinizin başladığını hatırlatan sabah mesajları.\n` +
      `⚠️ **Uyarı Bildirimleri:** Görevlerinizi yapmadığınızda gelen hatırlatma ve uyarı mesajları.`
    )
    .addFields(
      { name: 'Sabah Brifingi', value: briefingStatus, inline: true },
      { name: 'Uyarı Bildirimleri', value: warningsStatus, inline: true }
    )
    .setFooter({ text: 'Eko Yıldız • Ayarlar' })
    .setTimestamp();
}

function getSettingsComponents(progress) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  
  const briefingLabel = progress.settings?.dailyBriefingEnabled !== false 
    ? '📅 Sabah Brifingi: Kapat' 
    : '📅 Sabah Brifingi: Aç';
  const briefingStyle = progress.settings?.dailyBriefingEnabled !== false 
    ? ButtonStyle.Danger 
    : ButtonStyle.Success;

  const warningsLabel = progress.settings?.warningsEnabled !== false 
    ? '⚠️ Uyarılar: Kapat' 
    : '⚠️ Uyarılar: Aç';
  const warningsStyle = progress.settings?.warningsEnabled !== false 
    ? ButtonStyle.Danger 
    : ButtonStyle.Success;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('staff_toggle_briefing')
      .setLabel(briefingLabel)
      .setStyle(briefingStyle),
    new ButtonBuilder()
      .setCustomId('staff_toggle_warnings')
      .setLabel(warningsLabel)
      .setStyle(warningsStyle),
    new ButtonBuilder()
      .setCustomId('staff_settings_back')
      .setLabel('◀️ Geri Dön')
      .setStyle(ButtonStyle.Secondary)
  );
  
  return [row];
}

async function recordGamePlay(userId, gameType, client) {
  try {
    if (!userId) return;
    const p = await getOrCreate(userId, GUILD_ID, client);
    if (!p || p.status !== 'active') return;

    resetDaily(p);

    if (gameType === 'word') {
      p.daily.wordGamesPlayed = (p.daily.wordGamesPlayed || 0) + 1;
    } else if (gameType === 'bom') {
      p.daily.bomGamesPlayed = (p.daily.bomGamesPlayed || 0) + 1;
    }

    await p.save().catch(() => {});
    await checkChosenTaskCompletion(p, client).catch(() => {});
  } catch (err) {
    console.error('[staffSystem] recordGamePlay error:', err.message);
  }
}

module.exports = {
  getOrCreate,
  recordGreet,
  addVoiceMinutes,
  recordTicketSolved,
  recordModerationAction,
  recordChatMessage,
  recordWeeklyReport,
  checkPromotion,
  promote,
  demote,
  startStaffScheduler,
  resignFromStaff,
  retireFromStaff,
  dismissStaff,
  sendBreakRewardDM,
  sendRandomMotivationDM,
  requestLeave,
  getLeaveStatus,
  useLeaveCredit,
  notifyAllStaffAboutUpdate,
  sendSystemUpdateNotification,
  notifyStaff,
  // Gamification
  checkAndUnlockBadges,
  sendBadgeUnlockedDM,
  getLeaderboard,
  getUserLeaderboardRank,
  getWeeklyChallenge,
  sendFunMessage,
  BADGES,
  WEEKLY_CHALLENGES,
  getXpForLevel,
  ROLES,
  ROLE_NAMES,
  LEVEL_TASKS,
  PROMOTION_REQUIREMENTS,
  getDailyRequirements,
  getNextRequirementsText,
  GUILD_ID,
  CHOSEN_TASKS,
  checkChosenTaskCompletion,
  checkDailyCompletion,
  getDailyTaskCompletionStats,
  hasInactivityRole,
  getTargetCheckDate,
  completeOvertime,
  recordOvertimeTask,
  postponeDailyTask,
  generateMorningBriefingEmbed,
  getMorningBriefingComponents,
  generateGreetProgressEmbed,
  getGreetProgressComponents,
  generateSettingsEmbed,
  getSettingsComponents,
  recordGamePlay,
  resetDaily,
  addEkoCoin,
  handleInactivitySupportRequest,
  handleInactivityProofButton,
  handleInactivityWellbeingButton,
  handleInactivitySupportModal,
  handleInactivityProofModal,
};
