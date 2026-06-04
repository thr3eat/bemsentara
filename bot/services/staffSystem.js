'use strict';

const { EmbedBuilder } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');

// ── Konfigürasyon ──────────────────────────────────────────────────────────
const GUILD_ID = process.env.STAFF_GUILD_ID || '1367646464804655104';

// Rol ID'leri — Discord'dan !tumrollerveidleriveisimleri ile alabilirsin
const ROLES = {
  1: process.env.ROLE_STAJYER     || '1475082184896548864', // Stajyer Personel
  2: process.env.ROLE_PERSONEL    || '1417530761774366821',    // Personel
  3: process.env.ROLE_GELISMIS    || '1417533740892291214',    // Gelişmiş Personel
  4: process.env.ROLE_SEKRETER    || '1419688146689593415',    // Sekreter
};

const ROLE_NAMES = {
  1: 'Stajyer Personel',
  2: 'Personel',
  3: 'Gelişmiş Personel',
  4: 'Sekreter',
};

// Her seviyenin günlük zorunlulukları (gün geçtikçe ikiye katlanır)
// multiplier = 2^(consecutiveDays/30) — her 30 günde ikiye katlanır
function getDailyRequirements(level, consecutiveDays = 0) {
  const multiplier = Math.pow(2, Math.floor(consecutiveDays / 30));
  const base = {
    1: { greets: 1,  voiceMinutes: 5  },
    2: { greets: 2,  voiceMinutes: 10 },
    3: { greets: 4,  voiceMinutes: 20 },
    4: { greets: 8,  voiceMinutes: 40 },
  };
  const b = base[level] || base[1];
  return {
    greets:       Math.min(b.greets * multiplier, 20),       // max 20 selam
    voiceMinutes: Math.min(b.voiceMinutes * multiplier, 120), // max 2 saat
  };
}

// Her seviyenin terfi şartları
const PROMOTION_REQUIREMENTS = {
  1: { // Stajyer → Personel
    ticketsSolved:    2,
    surveysCompleted: 0,
    activeDays:       7,
    description: '2 ticket çöz + 7 gün aktif ol',
  },
  2: { // Personel → Gelişmiş Personel
    ticketsSolved:    10,
    surveysCompleted: 3,
    activeDays:       21,
    description: '10 ticket çöz + 3 anket yürüt + 21 gün aktif ol',
  },
  3: { // Gelişmiş → Sekreter (ÇOK ZOR)
    ticketsSolved:    30,
    surveysCompleted: 10,
    activeDays:       60,
    description: '30 ticket çöz + 10 anket + 60 gün kesintisiz aktif ol',
  },
  4: null, // Sekreter = son seviye
};

// ── Bugünün tarihi ─────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// ── Kullanıcının progress'ini al veya oluştur ──────────────────────────────
async function getOrCreate(userId, guildId) {
  let p = await StaffProgress.findOne({ userId });
  if (!p) {
    p = new StaffProgress({ userId, guildId: guildId || GUILD_ID });
    await p.save();
  }
  return p;
}

// ── Günlük sıfırlama ───────────────────────────────────────────────────────
function resetDaily(progress) {
  const today = todayStr();
  if (progress.daily.date !== today) {
    // Dün tamamlandı mı kontrol et
    progress.daily.date         = today;
    progress.daily.greeted      = false;
    progress.daily.voiceMinutes = 0;
  }
}

// ── Sohbette selam kaydı ───────────────────────────────────────────────────
async function recordGreet(userId, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  resetDaily(p);
  if (!p.daily.greeted) {
    p.daily.greeted = true;
    await p.save();
    await checkDailyCompletion(p, client);
  }
}

// ── Ses dakikası ekle ──────────────────────────────────────────────────────
async function addVoiceMinutes(userId, minutes, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  resetDaily(p);
  p.daily.voiceMinutes += minutes;
  await p.save();
  await checkDailyCompletion(p, client);
}

// ── Günlük görev tamamlandı mı kontrol et ─────────────────────────────────
async function checkDailyCompletion(progress, client) {
  const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays);
  const greetDone = progress.daily.greeted;
  const voiceDone = progress.daily.voiceMinutes >= req.voiceMinutes;

  if (greetDone && voiceDone) {
    // Bugün tamamlandı
    const today = todayStr();
    if (!progress.stats.lastCompleteDay || progress.stats.lastCompleteDay !== today) {
      progress.stats.activeDays      = (progress.stats.activeDays || 0) + 1;
      progress.stats.consecutiveDays = (progress.stats.consecutiveDays || 0) + 1;
      progress.stats.lastCompleteDay  = today;
      progress.warnings.count         = 0; // Uyarı sıfırla
      await progress.save();

      console.log(`[staffSystem] ${progress.userId} günlük görev tamamlandı — toplam: ${progress.stats.activeDays} gün`);

      // Terfi kontrolü
      await checkPromotion(progress, client);
    }
  }
}

// ── Ticket çözme kaydı ─────────────────────────────────────────────────────
async function recordTicketSolved(userId, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  p.stats.ticketsSolved = (p.stats.ticketsSolved || 0) + 1;
  await p.save();
  await checkPromotion(p, client);
}

// ── Anket tamamlama kaydı ──────────────────────────────────────────────────
async function recordSurveyCompleted(userId, client) {
  const p = await getOrCreate(userId, GUILD_ID);
  p.stats.surveysCompleted = (p.stats.surveysCompleted || 0) + 1;
  await p.save();
  await checkPromotion(p, client);
}

// ── Terfi kontrolü ─────────────────────────────────────────────────────────
async function checkPromotion(progress, client) {
  const currentLevel = progress.level || 1;
  const req = PROMOTION_REQUIREMENTS[currentLevel];
  if (!req) return; // Sekreter = son seviye

  const stats = progress.stats;
  const meetsTickets  = (stats.ticketsSolved || 0)    >= req.ticketsSolved;
  const meetsSurveys  = (stats.surveysCompleted || 0) >= req.surveysCompleted;
  const meetsActive   = (stats.activeDays || 0)       >= req.activeDays;

  if (meetsTickets && meetsSurveys && meetsActive) {
    await promote(progress, client);
  }
}

// ── Terfi uygula ────────────────────────────────────────────────────────────
async function promote(progress, client) {
  const oldLevel = progress.level;
  const newLevel = oldLevel + 1;

  if (newLevel > 4) return; // Zaten en üstte

  progress.level       = newLevel;
  progress.promotedAt  = new Date();
  // İstatistikleri sıfırla (bir sonraki seviye için sayaç baştan)
  progress.stats.ticketsSolved    = 0;
  progress.stats.surveysCompleted = 0;
  progress.stats.activeDays       = 0;
  await progress.save();

  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch(progress.userId).catch(() => null);
    if (!member) return;

    // Eski rolü kaldır, yeni rol ver
    const oldRoleId = ROLES[oldLevel];
    const newRoleId = ROLES[newLevel];

    if (oldRoleId && oldRoleId !== 'PERSONEL_ROLE_ID' && oldRoleId !== 'GELISMIS_ROLE_ID' && oldRoleId !== 'SEKRETER_ROLE_ID') {
      await member.roles.remove(oldRoleId, 'Terfi').catch(() => {});
    }
    if (newRoleId && newRoleId !== 'PERSONEL_ROLE_ID' && newRoleId !== 'GELISMIS_ROLE_ID' && newRoleId !== 'SEKRETER_ROLE_ID') {
      await member.roles.add(newRoleId, 'Terfi').catch(() => {});
    }

    // Kullanıcıya DM ile tebrik
    const isFinal = newLevel === 4;
    const embed = new EmbedBuilder()
      .setColor(isFinal ? 0xffd700 : 0x4ade80)
      .setTitle(isFinal ? '🏆 TEBRİKLER! En Üst Seviyeye Ulaştın!' : `🎉 TERFİ ETTIN! ${ROLE_NAMES[newLevel]}`)
      .setDescription(
        isFinal
          ? `**Harika bir başarı!** 👑\n\nEko Yıldız sunucusunda **Sekreter** rolüne ulaştın.\nBu çok zor bir hedefe ulaştığın için tebrikler!\nEkibimizin en değerli üyelerindensin. 🙏`
          : `Tebrikler! **${ROLE_NAMES[oldLevel]}** → **${ROLE_NAMES[newLevel]}** oldun.\n\n` +
            `📋 **Yeni görevlerin:**\n${getNextRequirementsText(newLevel)}`
      )
      .addFields(
        { name: '📅 Terfi Tarihi', value: `<t:${Math.floor(Date.now()/1000)}:f>`, inline: true },
        { name: '📊 Seviye', value: `${oldLevel} → ${newLevel}`, inline: true },
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    await client.users.fetch(progress.userId)
      .then(u => u.send({ embeds: [embed] }))
      .catch(() => {});

    console.log(`[staffSystem] ${progress.userId} → Seviye ${newLevel} (${ROLE_NAMES[newLevel]})`);
  } catch (err) {
    console.error('[staffSystem] Terfi hatası:', err.message);
  }
}

// ── Sonraki seviye gereksinimlerini metin olarak ver ───────────────────────
function getNextRequirementsText(level) {
  const req = PROMOTION_REQUIREMENTS[level];
  if (!req) return '🏆 En üst seviyeye ulaştın!';
  const lines = [];
  if (req.ticketsSolved > 0)    lines.push(`• ${req.ticketsSolved} ticket çöz`);
  if (req.surveysCompleted > 0) lines.push(`• ${req.surveysCompleted} anket yürüt`);
  if (req.activeDays > 0)       lines.push(`• ${req.activeDays} gün aktif ol (günlük görevleri tamamla)`);
  const dailyReq = getDailyRequirements(level);
  lines.push(`\n📅 **Günlük zorunluluk:**`);
  lines.push(`• Sohbete en az ${dailyReq.greets}x selam ver`);
  lines.push(`• Ses kanalında en az ${dailyReq.voiceMinutes} dk kal`);
  lines.push(`\n⚠️ 5 gün üst üste görev yapmazsan rolün alınır.`);
  return lines.join('\n');
}

// ── Günlük kontrol — her gece çalışır ─────────────────────────────────────
async function runDailyCheck(client) {
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  console.log('[staffSystem] Günlük kontrol başladı...');

  try {
    // Tüm aktif personelleri bul
    const allProgress = await StaffProgress.find({ level: { $gte: 1, $lte: 4 } });

    for (const p of allProgress) {
      // Dün görev yapıldı mı?
      const completedYesterday = p.stats.lastCompleteDay === yesterday;

      if (!completedYesterday) {
        // Görev yapılmadı
        p.stats.consecutiveDays = 0; // Seri sıfırla
        p.warnings.count = (p.warnings.count || 0) + 1;

        if (p.warnings.count >= 5) {
          // 5 gün uyarı → rol al
          await removeRole(p, client);
        } else {
          // Her gün uyarı DM gönder
          await sendWarningDM(p, client);
        }

        await p.save();
      } else {
        // Dün görev yapıldı — iyi gidiyor
        // Gereksinim artışını bildir (her 30 günde)
        if (p.stats.consecutiveDays > 0 && p.stats.consecutiveDays % 30 === 0) {
          await sendRequirementIncreaseDM(p, client);
        }
      }
    }

    console.log(`[staffSystem] Günlük kontrol tamamlandı — ${allProgress.length} personel kontrol edildi`);
  } catch (err) {
    console.error('[staffSystem] Günlük kontrol hatası:', err.message);
  }
}

// ── Uyarı DM gönder ────────────────────────────────────────────────────────
async function sendWarningDM(progress, client) {
  const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays);
  const embed = new EmbedBuilder()
    .setColor(0xff6b6b)
    .setTitle('⚠️ Günlük Görev Uyarısı')
    .setDescription(
      `Dün günlük görevlerini **tamamlamadın**.\n\n` +
      `**Kalan süre:** ${5 - progress.warnings.count} gün daha yapmazsan rolün alınır.\n\n` +
      `📋 **Günlük zorunlulukların:**\n` +
      `• Sohbete **${req.greets}x** selam ver\n` +
      `• Ses kanalında **${req.voiceMinutes} dk** kal\n\n` +
      `Bugün yaparsan uyarı sayacın sıfırlanır.`
    )
    .addFields(
      { name: '⚠️ Uyarı Sayısı', value: `${progress.warnings.count}/5`, inline: true },
      { name: '📊 Seviye', value: `${ROLE_NAMES[progress.level]}`, inline: true },
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
    console.log(`[staffSystem] Uyarı DM: ${progress.userId} (${progress.warnings.count}/5)`);
  } catch (_) {}
}

// ── Gereksinim artış bilgisi gönder ───────────────────────────────────────
async function sendRequirementIncreaseDM(progress, client) {
  const req = getDailyRequirements(progress.level, progress.stats.consecutiveDays);
  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle('📈 Görev Gereksinimlerin Arttı!')
    .setDescription(
      `${progress.stats.consecutiveDays} gün aktif kaldığın için görev gereksinimlerin ikiye katlandı.\n\n` +
      `📋 **Yeni günlük zorunlulukların:**\n` +
      `• Sohbete **${req.greets}x** selam ver\n` +
      `• Ses kanalında **${req.voiceMinutes} dk** kal\n\n` +
      `Bu artış aktif kalmanın ödülü — terfi için de sayaçların daha hızlı dolacak! 💪`
    )
    .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(progress.userId);
    await user.send({ embeds: [embed] });
  } catch (_) {}
}

// ── Rol al ─────────────────────────────────────────────────────────────────
async function removeRole(progress, client) {
  try {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch(progress.userId).catch(() => null);
    if (!member) return;

    const roleId = ROLES[progress.level];
    if (roleId) await member.roles.remove(roleId, '5 gün görev yapmadı').catch(() => {});

    // Kullanıcıya bildir
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('❌ Personel Rolün Alındı')
      .setDescription(
        `5 gün üst üste günlük görevlerini tamamlamadığın için **${ROLE_NAMES[progress.level]}** rolün alındı.\n\n` +
        `Tekrar personel olmak istiyorsan yöneticilere başvurabilirsin.`
      )
      .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
      .setTimestamp();

    const user = await client.users.fetch(progress.userId).catch(() => null);
    if (user) await user.send({ embeds: [embed] }).catch(() => {});

    // DB'den sil
    await StaffProgress.deleteOne({ userId: progress.userId });

    console.log(`[staffSystem] Rol alındı: ${progress.userId}`);
  } catch (err) {
    console.error('[staffSystem] Rol alma hatası:', err.message);
  }
}

// ── Scheduler: her gece 00:05'te kontrol ──────────────────────────────────
function startStaffScheduler(client) {
  // İlk çalıştırma zamanını hesapla (yarın 00:05)
  function scheduleNextRun() {
    const now = new Date();
    const next = new Date();
    next.setDate(now.getDate() + 1);
    next.setHours(0, 5, 0, 0);
    const delay = next - now;

    setTimeout(async () => {
      await runDailyCheck(client);
      scheduleNextRun(); // Sonraki gün için tekrar planla
    }, delay);

    console.log(`[staffSystem] Bir sonraki kontrol: ${next.toLocaleString('tr-TR')}`);
  }

  scheduleNextRun();
}

module.exports = {
  getOrCreate,
  recordGreet,
  addVoiceMinutes,
  recordTicketSolved,
  recordSurveyCompleted,
  checkPromotion,
  startStaffScheduler,
  ROLES,
  ROLE_NAMES,
  getDailyRequirements,
  getNextRequirementsText,
  GUILD_ID,
};
