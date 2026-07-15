'use strict';

/**
 * Moderasyon Rapor Takip Servisi
 * 
 * Tüm moderasyon işlemleri (mute, ban, kick, timeout) otomatik olarak tespit edilir
 * ve 1498009677743788155 kanalına loglanır.
 * 
 * - /modislem komutu → otomatik log
 * - Discord audit log (el ile yapılan ban/kick/timeout) → otomatik log
 * - Eğer bir personel 1 saat içinde loglanmayan bir işlem yaparsa → uyarı
 * - 2'den fazla loglanmamış işlem → XP cezası
 */

const { EmbedBuilder } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');

// ── Konfigürasyon ──────────────────────────────────────────────────────────
const REPORT_GUILD_ID    = '1367646464804655104';
const REPORT_LOG_CHANNEL = '1518693023934844959';
const REPORT_DEADLINE_MS = 60 * 60 * 1000; // 1 saat
const XP_PENALTY         = 50;
const POINTS_PENALTY     = 25;
const PENALTY_THRESHOLD  = 2; // 2'den fazla loglanmamış işlem olunca ceza başlar

// ── Personel Rolleri ───────────────────────────────────────────────────────
const STAFF_ROLE_IDS = [
  '1518692395774906648', // Stajyer Personel
  '1518692394495643830', // Personel
  '1518692393660973186', // Kıdemli Personel
  '1518692392415395971', // Sekreter
  '1518709348506013706', // Kıdemli Sekreter
  '1518692391312298045', // Genel Koordinatör
];

// ── In-Memory: Loglanmış işlem takibi ──────────────────────────────────────
// Son loglanmış işlemleri takip et (çift log'u engellemek için)
// Map<string, number> → "staffId:targetId:actionType" → timestamp
const recentlyLogged = new Map();
const DEDUP_WINDOW_MS = 30_000; // 30 saniyelik çift log penceresi

// Bekleyen (henüz loglanmamış) işlemler
// Map<actionId, { staffId, actionType, targetUserId, targetTag, details, timestamp, timer }>
const pendingActions = new Map();

let _client = null;

// ── İşlem Tipi Etiketleri ──────────────────────────────────────────────────
const ACTION_LABELS = {
  ban:           '🔴 Ban',
  unban:         '🟢 Ban Kaldırma',
  kick:          '🟡 Kick',
  timeout:       '⏱️ Timeout',
  mute:          '🔇 Mute',
  yazma_engeli:  '✏️ Yazma Engeli',
  foto_engeli:   '🖼️ Fotoğraf Engeli',
  modislem:      '🛡️ Mod İşlem',
};

const ACTION_COLORS = {
  ban:          0xe74c3c,
  unban:        0x2ecc71,
  kick:         0xf39c12,
  timeout:      0xe67e22,
  mute:         0x95a5a6,
  yazma_engeli: 0x3498db,
  foto_engeli:  0x9b59b6,
  modislem:     0x2ecc71,
};

// ── Yardımcı Fonksiyonlar ──────────────────────────────────────────────────

function generateActionId() {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isStaffMember(member) {
  if (!member?.roles?.cache) return false;
  return STAFF_ROLE_IDS.some(rid => member.roles.cache.has(rid));
}

async function getReportChannel(client) {
  try {
    const guild = await client.guilds.fetch(REPORT_GUILD_ID).catch(() => null);
    if (!guild) return null;
    const channel = await guild.channels.fetch(REPORT_LOG_CHANNEL).catch(() => null);
    return channel?.isSendable() ? channel : null;
  } catch {
    return null;
  }
}

/**
 * Çift log'u engelle — aynı işlem kısa süre içinde tekrar loglanmasın
 */
function isDuplicate(staffId, targetId, actionType) {
  const key = `${staffId}:${targetId}:${actionType}`;
  const lastTime = recentlyLogged.get(key);
  if (lastTime && (Date.now() - lastTime) < DEDUP_WINDOW_MS) {
    return true;
  }
  recentlyLogged.set(key, Date.now());
  // Eski kayıtları temizle
  if (recentlyLogged.size > 500) {
    const now = Date.now();
    for (const [k, v] of recentlyLogged) {
      if (now - v > DEDUP_WINDOW_MS) recentlyLogged.delete(k);
    }
  }
  return false;
}

// ── Ana Fonksiyon: Moderasyon İşlemi Kaydet ve Otomatik Logla ──────────────

/**
 * Moderasyon işlemi kaydeder ve otomatik olarak rapor kanalına loglar.
 * 
 * @param {string} staffId - İşlemi yapan personelin Discord ID'si
 * @param {string} actionType - İşlem tipi (ban, mute, kick, timeout, vb.)
 * @param {string} targetUserId - İşlem yapılan kullanıcının ID'si
 * @param {string} targetTag - İşlem yapılan kullanıcının tag'i
 * @param {string} [details=''] - Ek detaylar (sebep, süre, vb.)
 * @param {boolean} [isCommandBased=false] - /modislem gibi komut tabanlı mı
 */
async function recordModAction(staffId, actionType, targetUserId, targetTag, details = '', isCommandBased = false) {
  if (!_client || !staffId || !targetUserId) return null;

  // Çift log kontrolü
  if (isDuplicate(staffId, targetUserId, actionType)) {
    console.log(`[modReportTracker] Çift log engellendi: ${staffId} → ${targetUserId} (${actionType})`);
    return null;
  }

  const actionId = generateActionId();

  console.log(`[modReportTracker] İşlem tespit edildi: ${actionId} | Personel: ${staffId} | Tip: ${actionType} | Hedef: ${targetUserId} | Komut: ${isCommandBased}`);

  // ── Otomatik olarak rapor kanalına logla ──────────────────────────────
  await sendActionLog(staffId, actionType, targetUserId, targetTag, details, isCommandBased);

  // ── StaffProgress güncelle (rapor sayısını artır) ─────────────────────
  try {
    const p = await StaffProgress.findOne({ userId: staffId });
    if (p) {
      if (!p.modReports) p.modReports = {};
      p.modReports.totalReports = (p.modReports.totalReports || 0) + 1;
      await p.save();

      // Raporlama komutunun kendisi hariç ('modislem'), tüm asıl cezaları ('ban', 'kick', 'timeout' vb.) 
      // personel sistemi günlük/terfi ilerlemesine yansıtıp ödüllendiriyoruz.
      if (actionType !== 'modislem') {
        try {
          const { recordModerationAction } = require('./staffSystem');
          await recordModerationAction(staffId, _client, targetUserId, actionType);
        } catch (subErr) {
          console.error('[modReportTracker] recordModerationAction tetikleme hatası:', subErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[modReportTracker] StaffProgress güncelleme hatası:', err.message);
  }

  // ── Eğer komut tabanlı DEĞİLSE (el ile yapılan işlem), 1 saatlik zamanlayıcı ──
  // El ile yapılan işlemlerde personelin farkında olması için DM bildirim gönder
  if (!isCommandBased) {
    const timer = setTimeout(() => {
      handleUnreportedAction(actionId);
    }, REPORT_DEADLINE_MS);

    pendingActions.set(actionId, {
      staffId,
      actionType,
      targetUserId,
      targetTag: targetTag || 'Bilinmiyor',
      details: details || '',
      timestamp: Date.now(),
      timer,
    });

    // Personele DM ile bilgilendirme
    notifyStaffAboutAction(staffId, actionType, targetUserId, targetTag).catch(() => {});
  }

  return actionId;
}

// ── Rapor Log Embed'leri ───────────────────────────────────────────────────

/**
 * Otomatik rapor logu — tüm işlemler bu fonksiyonla kanala gönderilir
 */
async function sendActionLog(staffId, actionType, targetUserId, targetTag, details, isCommandBased) {
  const channel = await getReportChannel(_client);
  if (!channel) return;

  const color = ACTION_COLORS[actionType] || 0x7c6af7;
  const label = ACTION_LABELS[actionType] || actionType;
  const source = isCommandBased ? '`/modislem` Komutu' : '🖱️ Discord (El ile)';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${label} — Moderasyon Log`)
    .addFields(
      { name: '🛡️ Yetkili', value: `<@${staffId}>`, inline: true },
      { name: '🎯 İşlem', value: label, inline: true },
      { name: '📡 Kaynak', value: source, inline: true },
      { name: '👤 Hedef Kullanıcı', value: `<@${targetUserId}>\n\`${targetTag || targetUserId}\``, inline: true },
      { name: '📅 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: '📝 Detay / Sebep', value: details || 'Belirtilmedi', inline: false },
    )
    .setFooter({ text: 'Eko Yıldız • Moderasyon Rapor Sistemi' })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(err => {
    console.error('[modReportTracker] Log gönderme hatası:', err.message);
  });

  try {
    const { logToModChannel } = require('./modChannelService');
    await logToModChannel(_client, staffId, embed).catch(() => {});
  } catch (err) {
    console.error('[modReportTracker] Özel kanal log gönderme hatası:', err.message);
  }
}

// ── 1 Saat Sonra Loglanmamış İşlem Kontrolü ────────────────────────────────

/**
 * El ile yapılan ve 1 saat içinde staffSystem'e kaydedilmeyen işlemler için uyarı
 */
async function handleUnreportedAction(actionId) {
  const pending = pendingActions.get(actionId);
  if (!pending) return;

  pendingActions.delete(actionId);

  const { staffId, actionType, targetUserId, targetTag, details } = pending;

  console.log(`[modReportTracker] ⚠️ El ile yapılan işlem uyarısı — Personel: ${staffId} | İşlem: ${actionType}`);

  // StaffProgress güncelle — loglanmamış sayacını artır
  let unloggedCount = 0;
  try {
    const p = await StaffProgress.findOne({ userId: staffId });
    if (p) {
      if (!p.modReports) p.modReports = {};
      p.modReports.unloggedCount = (p.modReports.unloggedCount || 0) + 1;
      unloggedCount = p.modReports.unloggedCount;

      // 2'den fazla → XP cezası
      if (unloggedCount > PENALTY_THRESHOLD) {
        if (!p.gamification) {
          p.gamification = { totalPoints: 0, level: 1, currentXP: 0 };
        }
        p.gamification.currentXP = Math.max(0, (p.gamification.currentXP || 0) - XP_PENALTY);
        p.gamification.totalPoints = Math.max(0, (p.gamification.totalPoints || 0) - POINTS_PENALTY);
        p.modReports.totalPenalties = (p.modReports.totalPenalties || 0) + 1;
        p.modReports.lastPenaltyDate = new Date().toISOString().split('T')[0];

        console.log(`[modReportTracker] 🔻 XP Cezası: ${staffId} → -${XP_PENALTY} XP, -${POINTS_PENALTY} Puan`);
      }

      await p.save();
    }
  } catch (err) {
    console.error('[modReportTracker] StaffProgress güncelleme hatası:', err.message);
  }

  // Personele DM uyarısı
  await sendWarningDM(staffId, actionType, targetUserId, targetTag, unloggedCount);

  // Rapor kanalına uyarı gönder
  await sendPenaltyLog(staffId, actionType, targetUserId, targetTag, details, unloggedCount);
}

/**
 * Personele DM — uyarı veya ceza bildirimi
 */
async function sendWarningDM(staffId, actionType, targetUserId, targetTag, unloggedCount) {
  try {
    const user = await _client.users.fetch(staffId);
    const isPenalized = unloggedCount > PENALTY_THRESHOLD;
    const label = ACTION_LABELS[actionType] || actionType;

    const embed = new EmbedBuilder()
      .setColor(isPenalized ? 0xe74c3c : 0xff9500)
      .setTitle(isPenalized ? '🔻 Rapor Cezası!' : '⚠️ Moderasyon Uyarısı')
      .setDescription(
        `Discord üzerinden el ile bir moderasyon işlemi yaptın.\n` +
        `Sistem bu işlemi otomatik olarak tespit etti ve logladı, ancak **\`/modislem\` komutu** kullanman tercih edilir.\n\n` +
        `**İşlem:** ${label}\n` +
        `**Hedef:** <@${targetUserId}> (\`${targetTag}\`)\n\n` +
        (isPenalized
          ? `❌ **Ceza uygulandı!** El ile yapılan loglanmamış işlem sayın: **${unloggedCount}**\n` +
            `🔻 **-${XP_PENALTY} XP** ve **-${POINTS_PENALTY} Puan** kesildi!\n\n` +
            `Lütfen bundan sonra \`/modislem\` komutunu kullan.`
          : `📊 El ile yapılan işlem sayın: **${unloggedCount}/${PENALTY_THRESHOLD}**\n` +
            `⚠️ **${PENALTY_THRESHOLD}**'yi geçersen XP cezası almaya başlarsın!\n\n` +
            `💡 **İpucu:** \`/modislem\` komutunu kullanarak işlem yaparsan otomatik olarak loglanır ve uyarı almazsın.`)
      )
      .setFooter({ text: 'Eko Yıldız • Moderasyon Rapor Sistemi' })
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => {});
  } catch (_) {}
}

/**
 * İşlem tespit edildiğinde personele kısa bilgilendirme DM'i
 */
async function notifyStaffAboutAction(staffId, actionType, targetUserId, targetTag) {
  try {
    const user = await _client.users.fetch(staffId);
    const label = ACTION_LABELS[actionType] || actionType;

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('📋 Moderasyon İşlemi Tespit Edildi')
      .setDescription(
        `Discord üzerinden yaptığın bir moderasyon işlemi tespit edildi ve **otomatik olarak loglandı**.\n\n` +
        `**İşlem:** ${label}\n` +
        `**Hedef:** <@${targetUserId}> (\`${targetTag || 'Bilinmiyor'}\`)\n\n` +
        `💡 **Öneri:** Bir sonraki seferde \`/modislem\` komutunu kullanarak işlemi yapabilirsin. Bu şekilde uyarı almazsın.`
      )
      .setFooter({ text: 'Eko Yıldız • Moderasyon Rapor Sistemi' })
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => {});
  } catch (_) {}
}

/**
 * Rapor kanalına ceza/uyarı logu gönder
 */
async function sendPenaltyLog(staffId, actionType, targetUserId, targetTag, details, unloggedCount) {
  const channel = await getReportChannel(_client);
  if (!channel) return;

  const isPenalized = unloggedCount > PENALTY_THRESHOLD;
  const label = ACTION_LABELS[actionType] || actionType;

  const embed = new EmbedBuilder()
    .setColor(isPenalized ? 0xe74c3c : 0xff9500)
    .setTitle(isPenalized ? '🔻 Personel Ceza Aldı — /modislem Kullanılmadı' : '⚠️ Personel Uyarıldı — /modislem Kullanılmadı')
    .setDescription(
      `Personel moderasyon işlemini \`/modislem\` yerine Discord üzerinden el ile yaptı.` +
      (isPenalized ? `\n**-${XP_PENALTY} XP** ve **-${POINTS_PENALTY} Puan** cezası uygulandı.` : '')
    )
    .addFields(
      { name: '🛡️ Personel', value: `<@${staffId}>`, inline: true },
      { name: '🎯 İşlem', value: label, inline: true },
      { name: '👤 Hedef', value: `<@${targetUserId}>\n\`${targetTag}\``, inline: true },
      { name: '📊 Toplam El ile İşlem', value: `**${unloggedCount}** kez`, inline: true },
      { name: '📝 Detay', value: details || 'Belirtilmedi', inline: false },
    )
    .setFooter({ text: 'Eko Yıldız • Moderasyon Rapor Sistemi' })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});

  try {
    const { logToModChannel } = require('./modChannelService');
    await logToModChannel(_client, staffId, embed).catch(() => {});
  } catch (err) {
    console.error('[modReportTracker] Özel kanal ceza log gönderme hatası:', err.message);
  }
}

// ── Başlatma ───────────────────────────────────────────────────────────────

function startReportTracker(client) {
  _client = client;
  console.log('✅ Moderasyon Rapor Takip Sistemi başlatıldı!');
  console.log(`   📋 Rapor log kanalı: ${REPORT_LOG_CHANNEL}`);
  console.log(`   ⏱️ El ile işlem uyarı süresi: ${REPORT_DEADLINE_MS / 60000} dakika`);
  console.log(`   🔻 Ceza eşiği: ${PENALTY_THRESHOLD} el ile işlem`);
}

module.exports = {
  startReportTracker,
  recordModAction,
  isStaffMember,
  REPORT_GUILD_ID,
  STAFF_ROLE_IDS,
};
