'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');
const { GUILD_ID } = require('./staffSystem');

/**
 * Calculates a staff member's Key Performance Indicator (KPI) score (0-100)
 */
function calculateKpi(progress) {
  if (!progress) return 100;
  
  let score = 100;

  // 1. Düşüşler: Sicil uyarıları (-10 puan her biri)
  const disciplinaryWarns = progress.disciplinary?.warns || [];
  score -= (disciplinaryWarns.length * 10);

  // 2. Artışlar: Teşekkürler (+5 puan her biri)
  const commendations = progress.disciplinary?.commendations || [];
  score += (commendations.length * 5);

  // 3. Düşüşler: Görev ihlali uyarıları (-5 puan her biri)
  const taskWarnings = progress.warnings?.count || 0;
  score -= (taskWarnings * 5);

  // Limitler (0 - 100)
  score = Math.max(0, Math.min(100, score));
  return score;
}

/**
 * Gets a text evaluation grade based on KPI score
 */
function getKpiGrade(score) {
  if (score >= 95) return { label: '🌟 ÜSTÜN PERFORMANS (Efsanevi)', color: 0x2ecc71 };
  if (score >= 80) return { label: '🟢 BAŞARILI (Ortalama Üstü)', color: 0x2ecc71 };
  if (score >= 60) return { label: '🟡 YETERLİ (Gereksinimleri Karşılıyor)', color: 0xf1c40f };
  if (score >= 40) return { label: '🟠 GELİŞTİRİLMELİ', color: 0xe67e22 };
  return { label: '🔴 KRİTİK SEVİYE / PERFORMANS UYARISI', color: 0xe74c3c };
}

/**
 * Logs duty-related events to the nöbet-log channel
 */
async function sendDutyLog(client, embed) {
  try {
    const { GUILD2_ID } = require('../../config');
    const guild = await client.guilds.fetch(GUILD2_ID).catch(() => null);
    if (!guild) return;
    
    const categoryId = "1518692460233228431"; // EkoYıldız log kategorisi
    let channel = guild.channels.cache.find(c => c.parentId === categoryId && c.name === 'nöbet-log');
    if (!channel) {
      channel = await guild.channels.create({
        name: 'nöbet-log',
        type: 0, // text channel
        parent: categoryId,
        topic: 'Yetkili Nöbet Giriş/Çıkış ve Aktivite log kanalı.'
      }).catch(() => null);
    }
    
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[staffDutyService] sendDutyLog error:', err.message);
  }
}

/**
 * Staff starts their duty session
 */
async function startDuty(interaction, client) {
  const userId = interaction.user.id;
  try {
    const p = await StaffProgress.findOne({ userId });
    if (!p) return interaction.reply({ content: '❌ Personel kaydınız bulunamadı.', ephemeral: true });

    if (p.duty?.isActive) {
      return interaction.reply({ content: '⚠️ Zaten aktif bir nöbettesiniz!', ephemeral: true });
    }

    p.duty = {
      isActive: true,
      startedAt: new Date(),
      sessionVoiceMinutes: 0,
      sessionTicketsSolved: 0,
      sessionModerationActions: 0
    };

    await p.save();

    const logEmbed = new EmbedBuilder()
      .setTitle('⚡ Nöbet Başlatıldı')
      .setDescription(`**${interaction.user.tag}** (\`${userId}\`) aktif olarak nöbete başladı!`)
      .setColor(0x3498db)
      .addFields(
        { name: '🎖️ Seviye / Seviye', value: `Seviye ${p.level}`, inline: true },
        { name: '⏰ Başlangıç Zamanı', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setTimestamp();

    await sendDutyLog(client, logEmbed);

    return interaction.reply({
      content: '⚡ **Nöbet Başlatıldı!** Ses kanallarındaki aktifliğiniz ve çözdüğünüz biletler bu nöbet oturumunuza işlenecektir. Kolay gelsin! 🫡',
      ephemeral: true
    });
  } catch (err) {
    console.error('[staffDutyService] startDuty error:', err.message);
    return interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
  }
}

/**
 * Staff ends their duty session
 */
async function endDuty(interaction, client, handoverNotes = null) {
  const userId = interaction.user.id;
  const isDeferred = interaction.deferred || interaction.replied;
  try {
    const p = await StaffProgress.findOne({ userId });
    if (!p) {
      const msg = '❌ Personel kaydınız bulunamadı.';
      return isDeferred ? interaction.editReply({ content: msg }) : interaction.reply({ content: msg, ephemeral: true });
    }

    if (!p.duty?.isActive || !p.duty.startedAt) {
      const msg = '⚠️ Aktif bir nöbetiniz bulunmuyor!';
      return isDeferred ? interaction.editReply({ content: msg }) : interaction.reply({ content: msg, ephemeral: true });
    }

    const durationMs = Date.now() - new Date(p.duty.startedAt).getTime();
    const durationMins = Math.floor(durationMs / 1000 / 60);
    const durationHours = Math.floor(durationMins / 60);
    const remainingMins = durationMins % 60;

    const voiceMins = p.duty.sessionVoiceMinutes || 0;
    const tickets = p.duty.sessionTicketsSolved || 0;
    const mods = p.duty.sessionModerationActions || 0;

    // Calculate XP and points rewards based on performance during duty
    const xpReward = Math.floor((durationHours * 5) + (tickets * 10) + (mods * 5) + (voiceMins * 1));
    const coinReward = Math.floor((durationHours * 2) + (tickets * 5) + (mods * 2));

    p.duty.isActive = false;
    p.duty.startedAt = null;

    p.daily = p.daily || {};
    p.daily.dutyMinutesToday = (p.daily.dutyMinutesToday || 0) + durationMins;
    if (handoverNotes) {
      p.daily.incidentReportsToday = (p.daily.incidentReportsToday || 0) + 1;
    }

    if (!p.gamification) {
      p.gamification = { totalPoints: 0, ecoCoins: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 } };
    }
    p.gamification.currentXP = (p.gamification.currentXP || 0) + xpReward;
    p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + coinReward;

    await p.save();

    const { checkChosenTaskCompletion } = require('./staffSystem');
    await checkChosenTaskCompletion(p, client).catch(() => {});

    const logFields = [
      { name: '⏱️ Toplam Süre', value: `${durationHours} saat ${remainingMins} dakika`, inline: true },
      { name: '🎤 Ses Aktifliği', value: `${voiceMins} dakika`, inline: true },
      { name: '🎫 Çözülen Bilet', value: `${tickets} adet`, inline: true },
      { name: '🛡️ Mod İşlemleri', value: `${mods} adet`, inline: true },
      { name: '🎁 Kazanılan Ödüller', value: `✨ **+${xpReward} Elmas (💎)**\n🪙 **+${coinReward} TL**`, inline: false }
    ];

    if (handoverNotes) {
      logFields.push({ name: '📝 Vardiya Devir Notları', value: `\`\`\`. ${handoverNotes}\`\`\``, inline: false });
    }

    const logEmbed = new EmbedBuilder()
      .setTitle('🛑 Nöbet Tamamlandı (Vardiya Devri)')
      .setDescription(`**${interaction.user.tag}** (\`${userId}\`) nöbetini tamamladı ve vardiyayı devretti.`)
      .setColor(0xe74c3c)
      .addFields(logFields)
      .setTimestamp();

    await sendDutyLog(client, logEmbed);

    const replyContent = `🛑 **Nöbetinizi Bitirdiniz!**\n\n` +
      `⏱️ **Süre:** ${durationHours} sa ${remainingMins} dk\n` +
      `🎙️ **Ses:** ${voiceMins} dk | 🎫 **Bilet:** ${tickets} | 🛡️ **Mod:** ${mods}\n` +
      (handoverNotes ? `📝 **Devir Notu:** \`${handoverNotes}\`\n` : '') +
      `🎁 **Kazanılan:** +${xpReward} Elmas (💎), +${coinReward} TL!\n\n` +
      `Emeğiniz için teşekkürler! 💚`;

    return isDeferred ? interaction.editReply({ content: replyContent }) : interaction.reply({ content: replyContent, ephemeral: true });
  } catch (err) {
    console.error('[staffDutyService] endDuty error:', err.message);
    const msg = `❌ Hata: ${err.message}`;
    return isDeferred ? interaction.editReply({ content: msg }) : interaction.reply({ content: msg, ephemeral: true });
  }
}

/**
 * Handles duty buttons click
 */
async function handleDutyButton(interaction) {
  const { customId, client } = interaction;
  if (customId === 'staff_duty_start') {
    return startDuty(interaction, client);
  }
  if (customId === 'staff_duty_end') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_duty_end_handover')
      .setTitle('🛑 Nöbeti Bitir & Devret');

    const input = new TextInputBuilder()
      .setCustomId('handover_notes')
      .setLabel('Nöbet Devir Notları (Neler Yaşandı?)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Örn: Spam yapan 2 kişiyi muteledim, destek biletlerinde reklam satın almak isteyen biri bekliyor, genel durum sakin.')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }
}

/**
 * Adds a formal commendation to a staff member
 */
async function addCommendation(userId, reason, issuedBy) {
  const p = await StaffProgress.findOne({ userId, status: 'active' });
  if (!p) return { success: false, error: 'Aktif personel bulunamadı.' };

  if (!p.disciplinary) {
    p.disciplinary = { warns: [], commendations: [] };
  }

  p.disciplinary.commendations.push({
    date: new Date(),
    reason,
    issuedBy
  });

  await p.save();
  return { success: true, newKpi: calculateKpi(p) };
}

/**
 * Adds a disciplinary warning to a staff member
 */
async function addDisciplinaryWarn(userId, reason, issuedBy) {
  const p = await StaffProgress.findOne({ userId, status: 'active' });
  if (!p) return { success: false, error: 'Aktif personel bulunamadı.' };

  if (!p.disciplinary) {
    p.disciplinary = { warns: [], commendations: [] };
  }

  p.disciplinary.warns.push({
    date: new Date(),
    reason,
    issuedBy
  });

  await p.save();
  return { success: true, newKpi: calculateKpi(p) };
}

/**
 * Increments active stats in current duty session if active
 */
async function logDutyActivity(userId, activityType, amount = 1) {
  try {
    const p = await StaffProgress.findOne({ userId, 'duty.isActive': true });
    if (!p || !p.duty) return;

    if (activityType === 'voice') {
      p.duty.sessionVoiceMinutes = (p.duty.sessionVoiceMinutes || 0) + amount;
    } else if (activityType === 'ticket') {
      p.duty.sessionTicketsSolved = (p.duty.sessionTicketsSolved || 0) + amount;
    } else if (activityType === 'mod') {
      p.duty.sessionModerationActions = (p.duty.sessionModerationActions || 0) + amount;
    }

    await p.save();
  } catch (err) {
    console.error('[staffDutyService] logDutyActivity error:', err.message);
  }
}

module.exports = {
  calculateKpi,
  getKpiGrade,
  startDuty,
  endDuty,
  handleDutyButton,
  addCommendation,
  addDisciplinaryWarn,
  logDutyActivity
};
