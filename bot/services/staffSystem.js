'use strict';

const { EmbedBuilder } = require('discord.js');
const StaffProgress    = require('../../models/StaffProgress');
const { chatWithAI }   = require('./aiService');

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
      '✅ Sohbet kanalına selam ver (zorunlu)',
      '🎤 Ses kanalında en az 5 dk kal (zorunlu)',
      '📚 Sunucu kurallarını oku ve hatırla',
      '👀 Diğer personelin nasıl çalıştığını izle',
    ],
    rewards: '✨ Her tamamlanan gün terfi sayacına eklenir',
    penalties: '⚠️ 5 gün üst üste yapmazsan rolün alınır',
    tips: 'Stajyer olarak öğrenme dönemindeysin. Hatalar normal ama kuralları öğren!',
  },
  2: {
    name: 'Personel',
    dailyTasks: [
      '✅ Sohbet kanalına 2x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 10 dk kal (zorunlu)',
      '🎫 En az 1 ticket çözmeye çalış',
      '🚨 Kural ihlallerini raporla',
      '💬 Yeni üyelere yardımcı ol',
    ],
    rewards: '✨ Her ticket çözümü terfi sayacına eklenir. Hızlı terfi!',
    penalties: '⚠️ 5 gün görev yapmazsan Stajyer\'e düşersin',
    tips: 'Personel olarak aktif olman bekleniyor. Ticket çözümü en önemli metrik.',
  },
  3: {
    name: 'Gelişmiş Personel',
    dailyTasks: [
      '✅ Sohbet kanalına 4x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 20 dk kal (zorunlu)',
      '🎫 Günde 2+ ticket çözmeye çalış',
      '📊 Anket yönet (haftada 1)',
      '🛡️ Moderasyon kararlarında diğerlerine örnek ol',
      '📝 Sunucu gelişim önerisi yap (haftada 1)',
    ],
    rewards: '✨ Sekreterlik yolunda ilerliyor. En prestijli roldür!',
    penalties: '⚠️ Performans düşerse Personele gerileme olabilir',
    tips: 'Bu seviyede liderlik becerilerin önemli. Ekibi yönlendir!',
  },
  4: {
    name: 'Sekreter',
    dailyTasks: [
      '✅ Sohbet kanalına 8x selam ver (zorunlu)',
      '🎤 Ses kanalında en az 40 dk kal (zorunlu)',
      '🎫 Ticket kalitesini denetle ve yönet',
      '👥 Stajyerleri eğit',
      '📋 Haftalık personel raporu hazırla',
      '🔍 Sunucu güvenliğini aktif izle',
      '💡 Yöneticilere sunucu gelişim önerisi sun',
    ],
    rewards: '👑 En üst roldeyiz. Saygınlık ve sorumluluk sende.',
    penalties: '⚠️ Sekreter görevleri ihmal edilirse yönetici müdahale eder',
    tips: 'Sen en üst personelsin. Sunucunun yüzüsün. Her hareketini düşün!',
  },
};

// ── Günlük gereksinimler (gün geçtikçe katlanır) ──────────────────────────
function getDailyRequirements(level, consecutiveDays = 0) {
  const multiplier = Math.pow(2, Math.floor(consecutiveDays / 30));
  const base = {
    1: { greets: 1, voiceMinutes: 5  },
    2: { greets: 2, voiceMinutes: 10 },
    3: { greets: 4, voiceMinutes: 20 },
    4: { greets: 8, voiceMinutes: 40 },
  };
  const b = base[level] || base[1];
  return {
    greets:       Math.min(b.greets * multiplier, 20),
    voiceMinutes: Math.min(b.voiceMinutes * multiplier, 120),
  };
}

// ── Terfi gereksinimleri (ZOR) ─────────────────────────────────────────────
const PROMOTION_REQUIREMENTS = {
  1: {
    ticketsSolved:    3,
    surveysCompleted: 0,
    activeDays:       10,
    moderationActions: 0,
    weeklyReports:    0,
    description: '3 ticket + 10 gün aktif',
  },
  2: {
    ticketsSolved:    15,
    surveysCompleted: 5,
    activeDays:       30,
    moderationActions: 10,
    weeklyReports:    2,
    description: '15 ticket + 5 anket + 10 mod işlem + 2 rapor + 30 gün aktif',
  },
  3: {
    ticketsSolved:    50,
    surveysCompleted: 15,
    activeDays:       90,
    moderationActions: 30,
    weeklyReports:    8,
    description: '50 ticket + 15 anket + 30 mod işlem + 8 rapor + 90 gün aktif',
  },
  4: null,
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
  if (progress.daily.date !== today) {
    progress.daily.date         = today;
    progress.daily.greeted      = false;
    progress.daily.voiceMinutes = 0;
  }
}

async function recordGreet(userId, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  resetDaily(p);
  if (!p.daily.greeted) {
    p.daily.greeted = true;
    await p.save();
    await checkDailyCompletion(p, client);
  }
}

async function addVoiceMinutes(userId, minutes, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  resetDaily(p);
  p.daily.voiceMinutes += minutes;
  await p.save();
  await checkDailyCompletion(p, client);
}

// ── Mod işlem kaydı (yeni) ─────────────────────────────────────────────────
async function recordModerationAction(userId, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  p.stats.moderationActions = (p.stats.moderationActions || 0) + 1;
  await p.save();
  await checkPromotion(p, client);
}

// ── Haftalık rapor kaydı (yeni) ────────────────────────────────────────────
async function recordWeeklyReport(userId, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  p.stats.weeklyReports = (p.stats.weeklyReports || 0) + 1;
  await p.save();
  await checkPromotion(p, client);
}

async function checkDailyCompletion(progress, client) {
  const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays || 0);
  const greetDone = progress.daily.greeted;
  const voiceDone = progress.daily.voiceMinutes >= req.voiceMinutes;

  if (greetDone && voiceDone) {
    const today = todayStr();
    if (!progress.stats.lastCompleteDay || progress.stats.lastCompleteDay !== today) {
      progress.stats.activeDays      = (progress.stats.activeDays || 0) + 1;
      progress.stats.consecutiveDays = (progress.stats.consecutiveDays || 0) + 1;
      progress.stats.lastCompleteDay  = today;
      progress.warnings.count         = 0;
      await progress.save();
      console.log(`[staffSystem] ${progress.userId} günlük görev tamamlandı — ${progress.stats.activeDays} gün`);
      await checkPromotion(progress, client);
    }
  }
}

async function recordTicketSolved(userId, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  p.stats.ticketsSolved = (p.stats.ticketsSolved || 0) + 1;
  await p.save();
  await checkPromotion(p, client);
}

async function recordSurveyCompleted(userId, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  p.stats.surveysCompleted = (p.stats.surveysCompleted || 0) + 1;
  await p.save();
  await checkPromotion(p, client);
}

async function checkPromotion(progress, client) {
  const currentLevel = progress.level || 1;
  const req = PROMOTION_REQUIREMENTS[currentLevel];
  if (!req) return;

  const stats = progress.stats;
  const ok =
    (stats.ticketsSolved    || 0) >= req.ticketsSolved    &&
    (stats.surveysCompleted || 0) >= req.surveysCompleted &&
    (stats.activeDays       || 0) >= req.activeDays       &&
    (stats.moderationActions|| 0) >= req.moderationActions &&
    (stats.weeklyReports    || 0) >= req.weeklyReports;

  if (ok) await promote(progress, client);
}

async function promote(progress, client) {
  const oldLevel = progress.level;
  const newLevel = oldLevel + 1;
  if (newLevel > 4) return;

  progress.level      = newLevel;
  progress.promotedAt = new Date();
  // İstatistik sıfırla
  progress.stats.ticketsSolved     = 0;
  progress.stats.surveysCompleted  = 0;
  progress.stats.activeDays        = 0;
  progress.stats.moderationActions = 0;
  progress.stats.weeklyReports     = 0;
  await progress.save();

  try {
    const guild  = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return;
    const member = await guild.members.fetch(progress.userId).catch(() => null);
    if (!member) return;

    const oldRoleId = ROLES[oldLevel];
    const newRoleId = ROLES[newLevel];
    if (oldRoleId) await member.roles.remove(oldRoleId, 'Terfi').catch(() => {});
    if (newRoleId) await member.roles.add(newRoleId,    'Terfi').catch(() => {});

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

    await client.users.fetch(progress.userId).then(u => u.send({ embeds: [embed] })).catch(() => {});
    console.log(`[staffSystem] ${progress.userId} → Seviye ${newLevel}`);
  } catch (err) {
    console.error('[staffSystem] Terfi hatası:', err.message);
  }
}

function getNextRequirementsText(level) {
  const req = PROMOTION_REQUIREMENTS[level];
  if (!req) return '🏆 En üst seviyeye ulaştın!';
  const lines = [
    req.ticketsSolved     > 0 && `• ${req.ticketsSolved} ticket çöz`,
    req.surveysCompleted  > 0 && `• ${req.surveysCompleted} anket yürüt`,
    req.moderationActions > 0 && `• ${req.moderationActions} moderasyon işlemi yap`,
    req.weeklyReports     > 0 && `• ${req.weeklyReports} haftalık rapor hazırla`,
    req.activeDays        > 0 && `• ${req.activeDays} gün aktif ol`,
  ].filter(Boolean);
  const dailyReq = getDailyRequirements(level);
  lines.push(`\n📅 **Günlük:**\n• ${dailyReq.greets}x selam\n• ${dailyReq.voiceMinutes} dk ses`);
  lines.push(`⚠️ 5 gün görev yapmazsan rol alınır.`);
  return lines.join('\n');
}

// ── AI Sabah Brifing DM'i ─────────────────────────────────────────────────
async function sendMorningBriefing(progress, client) {
  const levelInfo = LEVEL_TASKS[progress.level] || LEVEL_TASKS[1];
  const req       = getDailyRequirements(progress.level, progress.stats?.consecutiveDays || 0);
  const nextReq   = PROMOTION_REQUIREMENTS[progress.level];
  const daysLeft  = progress.warnings?.count > 0 ? 5 - progress.warnings.count : null;

  // AI'dan kişiselleştirilmiş briefing al
  let aiMessage = '';
  try {
    const prompt = `Sen Eko Yıldız Discord sunucusunun personel yönetim sistemisin.
${progress.level === 1 ? '⚠️ Bu kişi YENİ bir stajyer, özellikle motive et ve öğret.' : ''}
Personelin günlük brifingini yaz. Kısa (max 150 karakter), motive edici, Türkçe.
Seviyesi: ${ROLE_NAMES[progress.level]}
Arka arkaya aktif gün: ${progress.stats?.consecutiveDays || 0}
Uyarı sayısı: ${progress.warnings?.count || 0}/5
${daysLeft !== null ? `DİKKAT: ${daysLeft} gün daha yapmazsa rolü alınır!` : ''}
Bugünkü görevleri hatırlat ve cesaretlen.`;

    aiMessage = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
    aiMessage = aiMessage?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) {}

  const embed = new EmbedBuilder()
    .setColor(progress.warnings?.count > 0 ? 0xff6b6b : progress.level === 1 ? 0x7c6af7 : 0x4ade80)
    .setTitle(`☀️ Günaydın! ${ROLE_NAMES[progress.level]} — Günlük Brifing`)
    .setDescription(
      (aiMessage ? `🤖 **AI Koçundan:** ${aiMessage}\n\n` : '') +
      `---\n**📋 Bugünün Görevleri:**`
    )
    .addFields(
      {
        name: '⚡ Zorunlu',
        value: `✅ ${req.greets}x sohbete selam\n🎤 ${req.voiceMinutes} dk ses kanalı`,
        inline: true,
      },
      {
        name: '🎯 Ekstra',
        value: levelInfo.dailyTasks.slice(2).join('\n') || '—',
        inline: true,
      },
      {
        name: '🏆 Ödül',
        value: levelInfo.rewards,
        inline: false,
      },
      {
        name: '⚠️ Yapmazsan',
        value: daysLeft !== null
          ? `**UYARI: ${5 - (progress.warnings?.count || 0)} gün daha yapmazsan rolün alınır!**\n${levelInfo.penalties}`
          : levelInfo.penalties,
        inline: false,
      },
    );

  // Terfi sayaçları
  if (nextReq) {
    const s = progress.stats || {};
    embed.addFields({
      name: '📈 Terfi İlerlemen',
      value:
        `Ticket: ${s.ticketsSolved||0}/${nextReq.ticketsSolved} ` +
        `• Anket: ${s.surveysCompleted||0}/${nextReq.surveysCompleted} ` +
        `• Aktif: ${s.activeDays||0}/${nextReq.activeDays} gün`,
      inline: false,
    });
  }

  embed
    .addFields({ name: '💡 İpucu', value: levelInfo.tips, inline: false })
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
  const warnLeft = 5 - (progress.warnings?.count || 0);

  // AI'dan uyarı mesajı
  let aiWarn = '';
  try {
    const prompt = `Eko Yıldız personeli ${ROLE_NAMES[progress.level]} günlük görevlerini yapmadı.
Bu ${progress.warnings?.count || 1}. uyarısı. ${warnLeft} hakkı kaldı.
Kısa (max 100 karakter), ciddi ama yapıcı Türkçe uyarı yaz.`;
    aiWarn = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
    aiWarn = aiWarn?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  } catch (_) {}

  const embed = new EmbedBuilder()
    .setColor(warnLeft <= 2 ? 0xff0000 : 0xff6b6b)
    .setTitle(`🚨 Görev Uyarısı — ${progress.warnings?.count}/5`)
    .setDescription(
      (aiWarn ? `🤖 **AI Koçu:** ${aiWarn}\n\n` : '') +
      `Dün günlük görevlerini tamamlamadın!\n\n` +
      `**⏰ ${warnLeft} gün daha yapmazsan rolün alınır.**\n\n` +
      `📋 **Bugün yapman gerekenler:**\n` +
      `• Sohbete **${req.greets}x** selam\n` +
      `• Ses kanalında **${req.voiceMinutes} dk** kal\n\n` +
      `Bugün yaparsan uyarı sayacın sıfırlanır!`
    )
    .addFields(
      { name: '⚠️ Uyarı', value: `${progress.warnings?.count}/5`, inline: true },
      { name: '📊 Seviye', value: ROLE_NAMES[progress.level], inline: true },
      { name: '🕐 Kalan Süre', value: `${warnLeft} gün`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
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

async function removeRole(progress, client) {
  try {
    const guild  = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return;
    const member = await guild.members.fetch(progress.userId).catch(() => null);
    if (!member) return;
    const roleId = ROLES[progress.level];
    if (roleId) await member.roles.remove(roleId, '5 gün görev yapmadı').catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('❌ Personel Rolün Alındı')
      .setDescription(
        `5 gün üst üste görevlerini tamamlamadığın için **${ROLE_NAMES[progress.level]}** rolün alındı.\n\n` +
        `Tekrar başvurmak istersen yöneticilere yazabilirsin.`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    const user = await client.users.fetch(progress.userId).catch(() => null);
    if (user) await user.send({ embeds: [embed] }).catch(() => {});
    await StaffProgress.deleteOne({ userId: progress.userId });
    console.log(`[staffSystem] Rol alındı: ${progress.userId}`);
  } catch (err) {
    console.error('[staffSystem] Rol alma hatası:', err.message);
  }
}

// ── Günlük kontrol + sabah brifing ────────────────────────────────────────
async function runDailyCheck(client) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  console.log('[staffSystem] Günlük kontrol başladı...');

  try {
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 } });

    for (const p of allProgress) {
      const completedYesterday = p.stats.lastCompleteDay === yesterday;

      if (!completedYesterday) {
        p.stats.consecutiveDays = 0;
        p.warnings.count = (p.warnings.count || 0) + 1;

        if (p.warnings.count >= 5) {
          await removeRole(p, client);
        } else {
          await sendWarningDM(p, client);
          await p.save();
        }
      } else {
        if (p.stats.consecutiveDays > 0 && p.stats.consecutiveDays % 30 === 0) {
          await sendRequirementIncreaseDM(p, client);
        }
        // ✅ Sabah brifing — görevi yapanlara da gönder (motive et)
        await sendMorningBriefing(p, client);
      }
    }

    console.log(`[staffSystem] Tamamlandı — ${allProgress.length} personel kontrol edildi`);
  } catch (err) {
    console.error('[staffSystem] Günlük kontrol hatası:', err.message);
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────
function startStaffScheduler(client) {
  function scheduleNextRun() {
    const now  = new Date();
    const next = new Date();
    next.setDate(now.getDate() + 1);
    next.setHours(8, 0, 0, 0); // Sabah 08:00 brifing
    const delay = next - now;
    setTimeout(async () => {
      await runDailyCheck(client);
      scheduleNextRun();
    }, delay);
    console.log(`[staffSystem] Bir sonraki brifing: ${next.toLocaleString('tr-TR')}`);
  }
  scheduleNextRun();
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
  startStaffScheduler,
  ROLES,
  ROLE_NAMES,
  LEVEL_TASKS,
  PROMOTION_REQUIREMENTS,
  getDailyRequirements,
  getNextRequirementsText,
  GUILD_ID,
};
