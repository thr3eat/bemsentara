'use strict';

const { EmbedBuilder } = require('discord.js');
const StaffProgress    = require('../../models/StaffProgress');
const { chatWithAI }   = require('./aiService');
const staffAutomation  = require('./staffAutomation');

// ── Konfigürasyon ──────────────────────────────────────────────────────────
const GUILD_ID = process.env.STAFF_GUILD_ID || '1367646464804655104';

const ROLES = {
  1: process.env.ROLE_STAJYER  || '1475082184896548864', // Stajyer Personel
  2: process.env.ROLE_PERSONEL || '1417530761774366821', // Personel
  3: process.env.ROLE_GELISMIS || '1417533740892291214', // Gelişmiş Personel
  4: process.env.ROLE_SEKRETER || '1419688146689593415', // Sekreter
};

const ROLE_NAMES = {
  1: '🎓 Stajyer Personel',
  2: '👔 Personel',
  3: '⭐ Gelişmiş Personel',
  4: '👑 Sekreter',
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
      '📊 Anket yönet (haftada 2)',
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
    rewards: '👑 En üst roldeyiz. Saygınlık ve sorumluluk sende.',
    penalties: '⏰ 3 gün görev yapmazsan Sekreterlik gözden geçirilir',
    tips: 'Sen en üst personelsin. Sunucunun yüzüsün. Disiplin ve liderlik göster!',
  },
};

// ── Günlük gereksinimler (gün geçtikçe katlanır) ──────────────────────────
function getDailyRequirements(level, consecutiveDays = 0) {
  const multiplier = Math.pow(2, Math.floor(consecutiveDays / 30));
  const base = {
    1: { greets: 2, voiceMinutes: 10 },
    2: { greets: 4, voiceMinutes: 20 },
    3: { greets: 6, voiceMinutes: 30 },
    4: { greets: 10, voiceMinutes: 60 },
  };
  const b = base[level] || base[1];
  return {
    greets:       Math.min(b.greets * multiplier, 20),
    voiceMinutes: Math.min(b.voiceMinutes * multiplier, 120),
  };
}

// ── Aktif gün az uyarı (< 2 gün) ──────────────────────────────────────────
async function checkLowActivityWarning(progress, client) {
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
    } catch (_) {}
    
    progress.warnings.lowActivityNotified = true;
    await progress.save();
  }
}

// ── Terfi gereksinimleri (ZOR) ─────────────────────────────────────────────
const PROMOTION_REQUIREMENTS = {
  1: {
    ticketsSolved:    8,
    surveysCompleted: 0,
    activeDays:       15,
    moderationActions: 5,
    weeklyReports:    0,
    description: '8 ticket + 5 mod işlem + 15 gün aktif',
    promotionBonus: { points: 250, xp: 350 },
  },
  2: {
    ticketsSolved:    30,
    surveysCompleted: 10,
    activeDays:       50,
    moderationActions: 20,
    weeklyReports:    5,
    description: '30 ticket + 10 anket + 20 mod işlem + 5 rapor + 50 gün aktif',
    promotionBonus: { points: 500, xp: 750 },
  },
  3: {
    ticketsSolved:    100,
    surveysCompleted: 25,
    activeDays:       120,
    moderationActions: 50,
    weeklyReports:    15,
    description: '100 ticket + 25 anket + 50 mod işlem + 15 rapor + 120 gün aktif',
    promotionBonus: { points: 1000, xp: 1500 },
  },
  4: { promotionBonus: { points: 2000, xp: 3000 } },
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── Kullanıcı al/oluştur ──────────────────────────────────────────────────
async function getOrCreate(userId, guildId) {
  let p = await StaffProgress.findOne({ userId });
  if (!p) {
    p = new StaffProgress({ userId, guildId: guildId || GUILD_ID });
    await p.save();
  }
  return p;
}

function resetDaily(progress) {
  const today = todayStr();
  
  // 🔧 Güvenlik: daily objesi tanımlı değilse oluştur
  if (!progress.daily) {
    progress.daily = {
      date: today,
      greeted: false,
      voiceMinutes: 0,
    };
    return;
  }
  
  // Tarih değişmişse sıfırla
  if (progress.daily.date !== today) {
    progress.daily.date = today;
    progress.daily.greeted = false;
    progress.daily.voiceMinutes = 0;
  }
}

async function recordGreet(userId, client) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordGreet: Invalid userId');
      return;
    }
    
    const p = await getOrCreate(userId, GUILD_ID).catch(err => {
      console.error('[staffSystem] getOrCreate failed in recordGreet:', err.message);
      return null;
    });
    
    if (!p) {
      console.warn(`[staffSystem] recordGreet: Cannot create/fetch record for ${userId}`);
      return;
    }
    
    resetDaily(p);
    if (!p.daily.greeted) {
      p.daily.greeted = true;
      await p.save().catch(err => {
        console.error('[staffSystem] Save failed in recordGreet:', err.message);
        return;
      });
      await checkDailyCompletion(p, client).catch(err => {
        console.error('[staffSystem] checkDailyCompletion failed:', err.message);
      });
    }
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
    
    const p = await getOrCreate(userId, GUILD_ID).catch(err => {
      console.error('[staffSystem] getOrCreate failed in addVoiceMinutes:', err.message);
      return null;
    });
    
    if (!p) {
      console.warn(`[staffSystem] addVoiceMinutes: Cannot create/fetch record for ${userId}`);
      return;
    }
    
    resetDaily(p);
    p.daily.voiceMinutes += minutes;
    await p.save().catch(err => {
      console.error('[staffSystem] Save failed in addVoiceMinutes:', err.message);
      return;
    });
    await checkDailyCompletion(p, client).catch(err => {
      console.error('[staffSystem] checkDailyCompletion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] addVoiceMinutes error:', err.message);
  }
}

// ── Mod işlem kaydı (yeni) ─────────────────────────────────────────────────
async function recordModerationAction(userId, client) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordModerationAction: Invalid userId');
      return;
    }
    
    const p = await getOrCreate(userId, GUILD_ID).catch(err => {
      console.error('[staffSystem] getOrCreate failed:', err.message);
      return null;
    });
    
    if (!p) return;
    
    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);
    
    p.stats.moderationActions = (p.stats.moderationActions || 0) + 1;
    await p.save().catch(err => {
      console.error('[staffSystem] Save failed:', err.message);
    });
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
    
    const p = await getOrCreate(userId, GUILD_ID).catch(err => {
      console.error('[staffSystem] getOrCreate failed:', err.message);
      return null;
    });
    
    if (!p) return;
    
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

async function checkDailyCompletion(progress, client) {
  // 🔧 Güvenlik: Objeler tanımlı değilse oluştur
  if (!progress.stats) progress.stats = {};
  if (!progress.daily) progress.daily = { date: '', greeted: false, voiceMinutes: 0 };
  if (!progress.warnings) progress.warnings = { count: 0 };
  
  const today = todayStr();
  const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays || 0);
  const greetDone = progress.daily.greeted;
  const voiceDone = progress.daily.voiceMinutes >= req.voiceMinutes;

  // ✅ BUGFIX: lastCompleteDay'in bugün olup olmadığını kontrol et
  const alreadyCompletedToday = progress.stats.lastCompleteDay === today;

  if (greetDone && voiceDone && !alreadyCompletedToday) {
    // Görev tamamlandı ve bugün ilk kez tamamlanıyor
    progress.stats.activeDays      = (progress.stats.activeDays || 0) + 1;
    progress.stats.consecutiveDays = (progress.stats.consecutiveDays || 0) + 1;
    progress.stats.lastCompleteDay = today;
    progress.warnings.count = 0;
    
    // 🎮 Gamification: Günlük görev tamamlama ödülü
    if (!progress.gamification) {
      progress.gamification = { totalPoints: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0 } };
    }
    const levelMultiplier = 1 + (progress.level * 0.25); // Seviye arttıkça daha fazla ödül
    progress.gamification.totalPoints = (progress.gamification.totalPoints || 0) + Math.floor(25 * levelMultiplier); // Günlük 25+ puan
    progress.gamification.currentXP = (progress.gamification.currentXP || 0) + Math.floor(100 * levelMultiplier); // Günlük 100+ XP
    
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
        } catch (_) {}
      }
    }
    
    await progress.save().catch(err => {
      console.error('[staffSystem] Save failed in checkDailyCompletion:', err.message);
    });
    
    console.log(`[staffSystem] ${progress.userId} günlük görev tamamlandı — ${progress.stats.activeDays} gün`);
    await checkPromotion(progress, client);
  }
}

async function recordTicketSolved(userId, client) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordTicketSolved: Invalid userId');
      return;
    }
    
    const p = await getOrCreate(userId, GUILD_ID).catch(err => {
      console.error('[staffSystem] getOrCreate failed in recordTicketSolved:', err.message);
      return null;
    });
    
    if (!p) {
      console.warn(`[staffSystem] recordTicketSolved: Cannot create/fetch record for ${userId}`);
      return;
    }
    
    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);
    
    p.stats.ticketsSolved = (p.stats.ticketsSolved || 0) + 1;
    
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
        } catch (_) {}
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
    
    await p.save().catch(err => {
      console.error('[staffSystem] Save failed in recordTicketSolved:', err.message);
      return;
    });
    
    // Rozetleri kontrol et
    await checkAndUnlockBadges(p, client).catch(() => {});
    
    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordTicketSolved error:', err.message);
  }
}

async function recordSurveyCompleted(userId, client) {
  try {
    if (!userId) {
      console.warn('[staffSystem] recordSurveyCompleted: Invalid userId');
      return;
    }
    
    const p = await getOrCreate(userId, GUILD_ID).catch(err => {
      console.error('[staffSystem] getOrCreate failed:', err.message);
      return null;
    });
    
    if (!p) return;
    
    // 🔧 Günü sıfırla (gün değişmişse günlük görevler sıfırlanır)
    resetDaily(p);
    
    p.stats.surveysCompleted = (p.stats.surveysCompleted || 0) + 1;
    await p.save().catch(err => {
      console.error('[staffSystem] Save failed:', err.message);
    });
    await checkPromotion(p, client).catch(err => {
      console.error('[staffSystem] checkPromotion failed:', err.message);
    });
  } catch (err) {
    console.error('[staffSystem] recordSurveyCompleted error:', err.message);
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
      (stats.ticketsSolved    || 0) >= req.ticketsSolved    &&
      (stats.surveysCompleted || 0) >= req.surveysCompleted &&
      (stats.activeDays       || 0) >= req.activeDays       &&
      (stats.moderationActions|| 0) >= req.moderationActions &&
      (stats.weeklyReports    || 0) >= req.weeklyReports;

    if (ok) {
      await promote(progress, client).catch(err => {
        console.error('[staffSystem] promote failed:', err.message);
      });
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
    if (newLevel > 4) return;

    // 🎁 Terfi bonusu ekle
    const req = PROMOTION_REQUIREMENTS[oldLevel];
    if (req && req.promotionBonus) {
      progress.gamification.totalPoints = (progress.gamification.totalPoints || 0) + req.promotionBonus.points;
      progress.gamification.currentXP = (progress.gamification.currentXP || 0) + req.promotionBonus.xp;
    }

    progress.level      = newLevel;
    progress.promotedAt = new Date();
    // İstatistik sıfırla
    progress.stats.ticketsSolved     = 0;
    progress.stats.surveysCompleted  = 0;
    progress.stats.activeDays        = 0;
    progress.stats.moderationActions = 0;
    progress.stats.weeklyReports     = 0;
    
    await progress.save().catch(err => {
      console.error('[staffSystem] Save failed in promote:', err.message);
      return;
    });

    // ── Role management ──────────────────────────────────────────────────────
    const guild  = await client.guilds.fetch(GUILD_ID).catch(err => {
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

    const isFinal = newLevel === 4;
    const embed = new EmbedBuilder()
      .setColor(isFinal ? 0xffd700 : 0x4ade80)
      .setTitle(isFinal ? '🏆 TEBRİKLER! Sekreter oldun!' : `🎉 TERFİ! ${ROLE_NAMES[newLevel]}`)
      .setDescription(
        isFinal
          ? `Eko Yıldız'ın en üst personel rolüne ulaştın! Sekreter görevlerin çok önemli. �`
          : `**${ROLE_NAMES[oldLevel]}** → **${ROLE_NAMES[newLevel]}**\n\n${getNextRequirementsText(newLevel)}`
      )
      .addFields(
        { name: '📅 Tarih',  value: `<t:${Math.floor(Date.now()/1000)}:f>`, inline: true },
        { name: '📊 Seviye', value: `${oldLevel} → ${newLevel}`,            inline: true },
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

function getNextRequirementsText(level) {
  const req = PROMOTION_REQUIREMENTS[level];
  if (!req) return '🏆 En üst seviyeye ulaştın! Sunucu seni sayıyor! 💫';
  const lines = [
    req.ticketsSolved     > 0 && `• ${req.ticketsSolved} ticket çöz (Her biri insanı mutlu ediyor!)`,
    req.surveysCompleted  > 0 && `• ${req.surveysCompleted} anket yürüt (Sunucunun sesi sen!)`,
    req.moderationActions > 0 && `• ${req.moderationActions} moderasyon işlemi (Adil ve nazik ol!)`,
    req.weeklyReports     > 0 && `• ${req.weeklyReports} haftalık rapor (Yöneticilere görünürlük!)`,
    req.activeDays        > 0 && `• ${req.activeDays} gün aktif ol (Haftaları taksitle yapabilirsin!)`,
  ].filter(Boolean);
  const dailyReq = getDailyRequirements(level);
  lines.push(`\n📅 **Günlük (Çok Kolay):**\n• ${dailyReq.greets}x selam\n• ${dailyReq.voiceMinutes} dk ses`);
  lines.push(`\n💪 **Başarabilirsin!** İlk başta zor görünür ama yavaş yavaş alışırsın.`);
  return lines.join('\n');
}

// ── AI Sabah Brifing DM'i ─────────────────────────────────────────────────
async function sendMorningBriefing(progress, client) {
  const levelInfo = LEVEL_TASKS[progress.level] || LEVEL_TASKS[1];
  const req       = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const nextReq   = PROMOTION_REQUIREMENTS[progress.level];
  const MAX_WARNINGS = 3; // 5 → 3 gün (sıkılaştırıldı)
  const daysLeft  = progress.warnings?.count > 0 ? MAX_WARNINGS - progress.warnings.count : null;

  // AI'dan kişiselleştirilmiş briefing al
  let aiMessage = '';
  try {
    const prompt = `Sen Eko Yıldız Discord sunucusunun AI Personel Koçusun.
${progress.level === 1 ? '⚠️ Bu kişi YENİ bir stajyer, çok motive et ve cesaretlen!' : ''}
Bu personelin günlük brifingini yapıcı ve motive edici olacak şekilde yaz. Kısa (max 150 karakter), neşeli, Türkçe.
Seviyesi: ${ROLE_NAMES[progress.level]}
Arka arkaya aktif gün: ${progress.stats?.consecutiveDays || 0}
Uyarı sayısı: ${progress.warnings?.count || 0}/7
${daysLeft !== null ? `Bu kişiye ${daysLeft} gün daha sabırla davran.` : ''}
Bugünkü görevleri hatırlat ve cesaretlen.`;

    aiMessage = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
    aiMessage = aiMessage?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) {}

  const embed = new EmbedBuilder()
    .setColor(progress.warnings?.count > 0 ? 0xff9500 : progress.level === 1 ? 0x7c6af7 : 0x4ade80)
    .setTitle(`☀️ Günaydın! ${ROLE_NAMES[progress.level]} — Günlük Brifing`)
    .setDescription(
      (aiMessage ? `🤖 **AI Koçun:** "${aiMessage}"\n\n` : '') +
      `Bugün yapacakların açık. Başlayabilirsin! 💪\n\n` +
      `---\n**📋 Bugünün Zorunlu Görevleri:**`
    )
    .addFields(
      {
        name: '⚡ Yapman Gerekenler',
        value: `✅ ${req.greets}x sohbete selam\n🎤 ${req.voiceMinutes} dk ses kanalı\n\n💪 Kolay! Senin için cinayeti işlemesi!`,
        inline: false,
      },
      {
        name: '🎯 Ekstra Görevler (Seçimli)',
        value: levelInfo.dailyTasks.slice(2).join('\n') || '—',
        inline: false,
      },
      {
        name: '🏆 Ödülü',
        value: levelInfo.rewards,
        inline: false,
      },
    );

  if (daysLeft !== null && daysLeft > 0) {
    embed.addFields({
      name: '⏰ Dikkat',
      value: `**${daysLeft} gün daha yapmazsan** rolün geçici olarak alınır. Ama endişelenme, geri gelmek kolay! 💪`,
      inline: false,
    });
  }

  // Terfi sayaçları — Rütbe Atlamaya Teşvik!
  if (nextReq) {
    const s = progress.stats || {};
    const ticketsNeeded = Math.max(0, nextReq.ticketsSolved - (s.ticketsSolved || 0));
    const surveyNeeded = Math.max(0, nextReq.surveysCompleted - (s.surveysCompleted || 0));
    const daysNeeded = Math.max(0, nextReq.activeDays - (s.activeDays || 0));
    const modsNeeded = Math.max(0, (nextReq.moderationActions || 0) - (s.moderationActions || 0));
    const reportsNeeded = Math.max(0, (nextReq.weeklyReports || 0) - (s.weeklyReports || 0));
    
    // Terfi yüzdesi hesapla
    const maxTickets = nextReq.ticketsSolved || 1;
    const ticketProgress = Math.min(100, Math.floor(((s.ticketsSolved || 0) / maxTickets) * 100));
    const progressBar = '█'.repeat(Math.floor(ticketProgress / 10)) + '░'.repeat(10 - Math.floor(ticketProgress / 10));
    
    embed.addFields({
      name: '🚀 Rütbe Atlaması',
      value: 
        `${progress.level < 4 ? `🎫 Ticket: ${s.ticketsSolved||0}/${nextReq.ticketsSolved} ${ticketsNeeded > 0 ? `(${ticketsNeeded} kaldı!)` : '✅'}\n` : ''}` +
        `${nextReq.surveysCompleted ? `📊 Anket: ${s.surveysCompleted||0}/${nextReq.surveysCompleted} ${surveyNeeded > 0 ? `(${surveyNeeded} kaldı!)` : '✅'}\n` : ''}` +
        `📅 Aktif: ${s.activeDays||0}/${nextReq.activeDays} gün ${daysNeeded > 0 ? `(${daysNeeded} gün kaldı!)` : '✅'}\n` +
        `${nextReq.moderationActions ? `🛡️ Moderasyon: ${s.moderationActions||0}/${nextReq.moderationActions} ${modsNeeded > 0 ? `(${modsNeeded} kaldı!)` : '✅'}\n` : ''}` +
        `${nextReq.weeklyReports ? `📋 Rapor: ${s.weeklyReports||0}/${nextReq.weeklyReports} ${reportsNeeded > 0 ? `(${reportsNeeded} kaldı!)` : '✅'}\n` : ''}` +
        `\n💪 **${Math.floor((100 - ticketProgress) * 0.5)}% daha çaba!** Başarabilirsin!`,
      inline: false,
    });
  }

  embed
    .addFields({ name: '💡 İpuçları', value: levelInfo.tips, inline: false })
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Başarılar! 🌟' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
    console.log(`[staffSystem] Sabah brifing gönderildi: ${progress.userId}`);
  } catch (_) {}
}

// ── Uyarı DM ──────────────────────────────────────────────────────────────
async function sendWarningDM(progress, client) {
  const req      = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const MAX_WARNINGS = 3; // 5 → 3 gün (sıkılaştırıldı)
  const warnLeft = MAX_WARNINGS - (progress.warnings?.count || 0);

  // AI'dan uyarı mesajı
  let aiWarn = '';
  try {
    const prompt = `Eko Yıldız personeli ${ROLE_NAMES[progress.level]} günlük görevlerini yapmadı.
Bu ${progress.warnings?.count || 1}. uyarısı. ${warnLeft} hakkı kaldı.
Kısa (max 100 karakter), sakin ama yapıcı Türkçe uyarı yaz. Anlayışlı ol!`;
    aiWarn = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
    aiWarn = aiWarn?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) {}

  const embed = new EmbedBuilder()
    .setColor(warnLeft <= 1 ? 0xff6b6b : warnLeft <= 2 ? 0xff9500 : 0xfbbf24)
    .setTitle(`⏰ Günlük Görev Uyarısı — ${progress.warnings?.count}/${MAX_WARNINGS}`)
    .setDescription(
      (aiWarn ? `🤖 **AI Koçu:** ${aiWarn}\n\n` : '') +
      `Bugün günlük görevlerini tamamlamadın. 😟 Sorun var mı?\n\n` +
      `**🕐 ${warnLeft === 1 ? '⚠️ SON UYARI!' : `${warnLeft} gün daha`} yapmazsan rolün geçici alınır.** (Ama geri gelmen çok kolay!)\n\n` +
      `📋 **Bugün yapman gerekenler:**\n` +
      `• Sohbete **${req.greets}x** selam\n` +
      `• Ses kanalında **${req.voiceMinutes} dk** kal\n\n` +
      `💡 **Meşgulsen, yöneticilere yazabilirsin!** İzin isteyebilirsin. 😊\n` +
      `Bugün yaparsan uyarı sayacın sıfırlanır! İçin rahat olsun. 💚`
    )
    .addFields(
      { name: '⚠️ Uyarı', value: `${progress.warnings?.count}/${MAX_WARNINGS}`, inline: true },
      { name: '📊 Seviye', value: ROLE_NAMES[progress.level], inline: true },
      { name: '🕐 Kalan Hakkı', value: warnLeft === 1 ? '🔴 1 gün (SON)' : `${warnLeft} gün`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz! 💚' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
  } catch (_) {}
}

async function sendRequirementIncreaseDM(progress, client) {
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
  } catch (_) {}
}

// ── Sert çalışma ödülü: 1 gün izin kredisi ─────────────────────────────────
async function sendBreakRewardDM(progress, client) {
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
  } catch (_) {}
}

// ── Motivasyon mesajları: rasgele teşvik ─────────────────────────────────
async function sendRandomMotivationDM(progress, client) {
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
  } catch (_) {}
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
    const guild  = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return;
    const member = await guild.members.fetch(progress.userId).catch(() => null);
    if (!member) return;
    const roleId = ROLES[progress.level];
    if (roleId) await member.roles.remove(roleId, '3 gün görev yapmadı').catch(() => {});

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
    if (user) await user.send({ embeds: [embed] }).catch(() => {});
    await StaffProgress.deleteOne({ userId: progress.userId });
    console.log(`[staffSystem] Rol alındı (5 gün): ${progress.userId}`);
  } catch (err) {
    console.error('[staffSystem] Rol alma hatası:', err.message);
  }
}

// ── Öğlen hatırlatma (13:00) ──────────────────────────────────────────────
async function sendMidDayReminder(progress, client) {
  const today = todayStr();
  const req   = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const isGreetDone = progress.daily?.date === today && progress.daily?.greeted;
  const voiceDone   = progress.daily?.date === today && (progress.daily?.voiceMinutes || 0) >= req.voiceMinutes;

  const missing = [];
  if (!isGreetDone) missing.push(`✅ Sohbete ${req.greets}x selam ver`);
  if (!voiceDone)   missing.push(`🎤 ${req.voiceMinutes - (progress.daily?.voiceMinutes || 0)} dk daha ses kanalında kal`);

  if (missing.length === 0) return; // Zaten tamamlamış

  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle('🌤️ Öğlen Hatırlatması — Biraz Daha Kaldı!')
    .setDescription(
      `Günün yarısı geçti! Hâlâ yapman gerekenler var ama merak etme, çok az kaldı:\n\n` +
      missing.map(m => `• ${m}`).join('\n') +
      `\n\n☕ Bir ara ver, sonra bitir. Zaman yeter! 💪`
    )
    .addFields(
      { name: '📊 Seviye',       value: ROLE_NAMES[progress.level], inline: true },
      { name: '🎤 Ses (bugün)',  value: `${progress.daily?.voiceMinutes || 0}/${req.voiceMinutes} dk`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz!' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
  } catch (_) {}
}

// ── Akşam son uyarı (19:00) ───────────────────────────────────────────────
async function sendEveningWarning(progress, client) {
  const today = todayStr();
  const req   = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const isGreetDone = progress.daily?.date === today && progress.daily?.greeted;
  const voiceDone   = progress.daily?.date === today && (progress.daily?.voiceMinutes || 0) >= req.voiceMinutes;

  if (isGreetDone && voiceDone) return; // Tamamlamış

  const warnCount = progress.warnings?.count || 0;

  // AI acil uyarı mesajı
  let aiMsg = '';
  try {
    const prompt = `Eko Yıldız personeli ${ROLE_NAMES[progress.level]} akşam 19:00'da hâlâ günlük görevini yapmamış.
Bu kişinin ${warnCount} uyarısı var. Çok kısa (max 80 karakter), sakin ve anlayışlı Türkçe uyarı yaz.`;
    aiMsg = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
    aiMsg = aiMsg?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) {}

  const embed = new EmbedBuilder()
    .setColor(0xff9500)
    .setTitle('🌙 Akşam Son Uyarısı (19:00)')
    .setDescription(
      (aiMsg ? `🤖 **AI:** ${aiMsg}\n\n` : '') +
      `**Gece 23:30'a kadar** görevlerini tamamlamazsan yarın uyarı sayacın artacak!\n\n` +
      `📋 **Yapman gerekenler:**\n` +
      (!isGreetDone ? `• ✅ Sohbete ${req.greets}x selam ver\n` : '') +
      (!voiceDone   ? `• 🎤 ${req.voiceMinutes - (progress.daily?.voiceMinutes || 0)} dk daha ses kanalında kal\n` : '') +
      `\n🕐 **${7 - warnCount} uyarı hakkın kaldı.** (Sonra rol geçici olarak alınır)\n\n` +
      `Meşgulsen, yapabilecekten bile yararlı! Kısmi tamamlama da iyi!`
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Seninle çözeriz!' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
  } catch (_) {}
}

// ── KÖV (KOV) SİSTEMİ — Yönetici tarafından personel alınması ────────────────
async function dismissStaff(userId, reason, dismissedBy, client) {
  const p = await StaffProgress.findOne({ userId });
  if (!p) return { success: false, message: 'Personel sisteminde kayıtlı değil.' };
  if (p.status !== 'active') return { success: false, message: 'Zaten aktif değil.' };

  const levelName = ROLE_NAMES[p.level];
  
  // Kov kaydı
  p.status       = 'dismissed';
  p.dismissedAt  = new Date();
  p.dismissReason = reason?.slice(0, 300) || 'Belirtilmedi';
  await p.save();

  // Rolleri kaldır
  try {
    const guild  = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member) {
      for (const roleId of Object.values(ROLES)) {
        if (roleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, `Kov: ${reason || 'Yönetici Kararı'}`).catch(() => {});
        }
      }
    }
  } catch (_) {}

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
  } catch (_) {}

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
    await admin.send({ embeds: [embed] }).catch(() => {});
  } catch (_) {}

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

  // Rolleri kaldır
  try {
    const guild  = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member) {
      for (const roleId of Object.values(ROLES)) {
        if (roleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, 'İstifa').catch(() => {});
        }
      }
    }
  } catch (_) {}

  // İstifa kaydını işle
  if (canRetire) {
    // 90+ gün: Emeklilik statüsüne çevir, kaydı tut
    p.status     = 'retired';
    p.retiredAt  = new Date();
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
  } catch (_) {}

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

  const levelName  = ROLE_NAMES[p.level];
  const oldLevel   = p.level;

  // Emeklilik kaydı
  p.status     = 'retired';
  p.retiredAt  = new Date();
  p.retiredAt  = new Date();
  await p.save();

  // Staff rollerini kaldır, emekli rolü ver
  try {
    const guild  = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (member) {
      for (const roleId of Object.values(ROLES)) {
        if (roleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, 'Emeklilik').catch(() => {});
        }
      }
      if (RETIREMENT_ROLE_ID) {
        await member.roles.add(RETIREMENT_ROLE_ID, 'Emeklilik').catch(() => {});
      }
    }
  } catch (_) {}

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
        { name: '⏰ Toplam Aktif Gün',  value: `${totalDays} gün`, inline: true },
        { name: '📊 Son Seviye',        value: levelName,           inline: true },
        { name: '🎫 Çözülen Ticket',   value: `${p.stats?.ticketsSolved || 0}+`, inline: true },
      )
      .setFooter({ text: 'Eko Yıldız • Emeklilik Belgesi 🎖️' })
      .setTimestamp();
    await user.send({ embeds: [embed] });
  } catch (_) {}

  console.log(`[staffSystem] Emeklilik: ${userId} (${levelName}, ${totalDays} gün)`);
  return { success: true, totalDays, levelName };
}
async function runDailyCheck(client) {
  const today = todayStr();
  console.log('[staffSystem] Günlük kontrol başladı...');

  try {
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });

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
      p.stats.surveysCompleted = p.stats.surveysCompleted || 0;
      p.stats.activeDays = p.stats.activeDays || 0;
      p.stats.consecutiveDays = p.stats.consecutiveDays || 0;
      p.stats.moderationActions = p.stats.moderationActions || 0;
      p.stats.weeklyReports = p.stats.weeklyReports || 0;
      p.stats.lastCompleteDay = p.stats.lastCompleteDay || '';
      p.stats.breakCredits = p.stats.breakCredits || 0;
      
      // 🔧 Günü sıfırla (ertesi gün başlasın temiz)
      resetDaily(p);
      
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
      
      // 🔧 BUG FIX: Bugünün görevleri tamamlandı mı kontrol et (dün değil)
      const completedToday = p.stats.lastCompleteDay === today;
      const activeDays = p.stats?.activeDays || 0;

      if (!completedToday) {
        // Bugün görev yapılmadı — uyarı ver
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
        // ✅ Sabah brifing — görevi yapanlara da gönder (motive et)
        await sendMorningBriefing(p, client);
      }
      
      // ⚠️ Aktif gün < 2 uyarısı
      if (activeDays < 2) {
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
  // Belirli saatte çalışacak görev planla
  function scheduleAt(hour, minute, callback) {
    function run() {
      const now  = new Date();
      const next = new Date();
      // Bugün o saat geçtiyse yarın planla
      next.setHours(hour, minute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const delay = next - now;
      setTimeout(async () => {
        try { await callback(); } catch (err) { console.error('[staffSystem] Scheduler hata:', err.message); }
        run(); // Ertesi gün için tekrar planla
      }, delay);
    }
    run();
  }

  // 09:00 — Sabah brifing (tüm personele)
  scheduleAt(9, 0, async () => {
    console.log('[staffSystem] 09:00 sabah brifing gönderiliyor...');
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    for (const p of allProgress) {
      await sendMorningBriefing(p, client).catch(() => {});
    }
  });

  // 13:00 — Öğlen hatırlatma (görevi tamamlamamış olanlara)
  scheduleAt(13, 0, async () => {
    console.log('[staffSystem] 13:00 öğlen hatırlatması...');
    const today        = todayStr();
    const allProgress  = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    for (const p of allProgress) {
      const isComplete = p.daily?.date === today && p.daily?.greeted && p.daily?.voiceMinutes >= getDailyRequirements(p.level, p.stats?.consecutiveDays || 0).voiceMinutes;
      if (!isComplete) {
        await sendMidDayReminder(p, client).catch(() => {});
      }
    }
  });

  // 19:00 — Akşam uyarısı (hâlâ tamamlamamışlara)
  scheduleAt(19, 0, async () => {
    console.log('[staffSystem] 19:00 akşam uyarısı...');
    const today       = todayStr();
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    for (const p of allProgress) {
      const req        = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const isComplete = p.daily?.date === today && p.daily?.greeted && (p.daily?.voiceMinutes || 0) >= req.voiceMinutes;
      if (!isComplete) {
        await sendEveningWarning(p, client).catch(() => {});
      }
    }
  });

  // 15:00 — Öğleden sonra motivasyon mesajı (aktif olan personele)
  scheduleAt(15, 0, async () => {
    console.log('[staffSystem] 15:00 motivasyon mesajları gönderiliyor...');
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    for (const p of allProgress) {
      // %50 şansla motivasyon gönder (tüm gruba yazarsak spam olur)
      if (Math.random() > 0.5) {
        await sendRandomMotivationDM(p, client).catch(() => {});
      }
    }
  });

  // 18:00 — Akşam eğlenceleri (gamification fun message'ları)
  scheduleAt(18, 0, async () => {
    console.log('[staffSystem] 18:00 eğlenceli mesajları gönderiliyor...');
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    for (const p of allProgress) {
      // %60 şansla eğlenceli mesaj gönder
      if (Math.random() > 0.4) {
        await sendFunMessage(p.userId, client).catch(() => {});
      }
    }
  });

  // 21:00 — Akşam geç saatlerde teşvik mesajı
  scheduleAt(21, 0, async () => {
    console.log('[staffSystem] 21:00 gece motivasyonu...');
    const today       = todayStr();
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    for (const p of allProgress) {
      const req        = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const isComplete = p.daily?.date === today && p.daily?.greeted && (p.daily?.voiceMinutes || 0) >= req.voiceMinutes;
      
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
        } catch (_) {}
      }
    }
  });

  // 23:30 — Günlük kapanış kontrol + uyarı
  scheduleAt(23, 30, async () => {
    console.log('[staffSystem] 23:30 günlük kapanış...');
    await runDailyCheck(client);
  });

  // 17:00 — Doğrulama kontrolü
  scheduleAt(17, 0, async () => {
    console.log('[staffSystem] 17:00 doğrulama kontrolü...');
    await checkStaffVerifications(client);
  });

  console.log('[staffSystem] Scheduler başlatıldı (09:00 / 13:00 / 17:00 / 19:00 / 23:30)');
  
  // Başlangıçta hemen doğrulama kontrolünü bir defa yap
  setTimeout(() => checkStaffVerifications(client), 10000); // 10 saniye sonra
}

// ── PERSONEL DOĞRULAMA KONTROLÜ (ROBLOX & DISCORD) ─────────────────────────
async function checkStaffVerifications(client) {
  try {
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });
    const User = require('../../models/User');
    const { BASE_URL } = require('../../config');
    let notifiedCount = 0;

    for (const p of allProgress) {
      const user = await User.findOne({ discordId: p.userId });
      
      const missingRoblox = !user || !user.robloxId;
      const missingGuild = !p.guildJoined; // guildJoined is in StaffProgress

      if (missingRoblox || missingGuild) {
        const embed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('🚨 DİKKAT: Eksik Doğrulama İşlemi')
          .setDescription(
            `Merhaba <@${p.userId}>, EkoYıldız moderatör ekibinde bulunuyorsun ancak sistemlerimizde **doğrulamanın eksik olduğu tespit edildi.**\n\n` +
            `Görevinize devam edebilmeniz ve yetkilerinizi alabilmeniz için aşağıdaki işlemleri **hemen yapmanız gerekmektedir:**\n\n` +
            `${missingRoblox ? `❌ **Roblox Hesabı Bağlı Değil:** [Buraya Tıklayarak](${BASE_URL}/dashboard) hesabınızı hemen bağlayın.\n` : ''}` +
            `${missingGuild ? `❌ **Yönetim Sunucusunda Değilsiniz:** Hemen yönetim sunucumuza katılın: https://discord.gg/fjwjMgH54N\n` : ''}` +
            `\nBu uyarıyı dikkate almazsanız yetkileriniz sistem tarafından otomatik olarak alınabilir.`
          )
          .setFooter({ text: 'EkoYıldız Yüksek Güvenlikli Otomasyon Sistemi' })
          .setTimestamp();

        try {
          const discordUser = await client.users.fetch(p.userId);
          if (discordUser) {
            await discordUser.send({ embeds: [embed] });
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
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });

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
        if (user) await user.send({ embeds: [embed] }).catch(() => {});
      } catch (_) {}
    }

    console.log(`[staffSystem] ${allProgress.length} personele güncelleme bildirimi gönderildi`);
  } catch (err) {
    console.error('[staffSystem] Bildirim hatası:', err.message);
  }
}

// Başlangıçta çalışacak - tüm personele sistem yükseltmesi hakkında bildir
async function sendSystemUpdateNotification(client) {
  try {
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 }, status: 'active' });

    const embed = new EmbedBuilder()
      .setColor(0x4ade80)
      .setTitle('✨ Personel Sistemi 2.0 - BÜYÜK GÜNCELLEME!')
      .setDescription('Personel sisteminde çok önemli iyileştirmeler yapıldı. Seni daha yumuşak davranacağız! 💚')
      .addFields(
        {
          name: '🎁 Yeni Özellikler',
          value: 
            '✅ İzin sistemi (aylık + haftalık)\n' +
            '✅ İzin kredileri (3+ ticket/gün)\n' +
            '✅ Softer uyarı sistemi (5 → 7 gün)\n' +
            '✅ Kişiselleştirilmiş AI koçu\n' +
            '✅ Anlaşılı ve destekleyici mesajlar',
          inline: false,
        },
        {
          name: '💚 Nasıl Farklı Oldu?',
          value:
            '• Hata yapsan bile anlıyoruz 👍\n' +
            '• İzin talep edebilirsin ☕\n' +
            '• Uyarı sistemi daha insancı ✨\n' +
            '• Yöneticiler yardımcı olacak 🤝\n' +
            '• Rol alındığında geri gelis kolay 🔄',
          inline: false,
        },
        {
          name: '📖 Rehber İçin',
          value: 'DM\'de rehber dosyasını görmek için `/koc` komutu kullan!',
          inline: false,
        }
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi | Yeni Dönem = Daha İyi Sistem' })
      .setTimestamp();

    for (const p of allProgress) {
      try {
        const user = await client.users.fetch(p.userId);
        if (user) await user.send({ embeds: [embed] }).catch(() => {});
      } catch (_) {}
    }

    console.log(`[staffSystem] ${allProgress.length} personele sistem 2.0 bildirimi gönderildi`);
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

  // Yeni rozetler için gönder
  if (newBadges.length > 0) {
    for (const badgeId of newBadges) {
      await sendBadgeUnlockedDM(progress, badgeId, client).catch(() => {});
    }
  }

  await progress.save().catch(() => {});
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
  } catch (_) {}
}

/**
 * Leaderboard al (Top 10)
 */
async function getLeaderboard() {
  try {
    const allProgress = await StaffProgress.find({ status: 'active' })
      .sort({ 'gamification.totalPoints': -1 })
      .limit(10)
      .select('userId gamification stats level ROLE_NAMES');

    return allProgress.map((p, idx) => ({
      rank: idx + 1,
      userId: p.userId,
      points: p.gamification?.totalPoints || 0,
      level: p.level,
      xpLevel: p.gamification?.level || 1,
      tickets: p.stats?.ticketsSolved || 0,
      badges: Object.values(p.gamification?.badges || {}).filter(Boolean).length,
    }));
  } catch (err) {
    console.error('[staffSystem] Leaderboard hatası:', err.message);
    return [];
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
    id: 'surveyMaster',
    name: '📊 Anket Ustası',
    goal: 5,
    description: 'Bu hafta 5 anket yürüt!',
    reward: 500, // 300 → 500 (artırıldı)
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
  } catch (_) {}
}

module.exports = {
  getOrCreate,
  recordGreet,
  addVoiceMinutes,
  recordTicketSolved,
  recordSurveyCompleted,
  recordModerationAction,
  recordWeeklyReport,
  checkPromotion,
  promote,
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
};