'use strict';

/**
 * Ticket AI Yöneticisi
 * - Ticket açılınca AI sorunu çözmeye çalışır
 * - Ban talebi: kanıt ister, resim varsa kanıt kanalına atar, Evet/Hayır sorar
 * - Reklam fiyatı soruları: bilgi verir
 * - "Canlı temsilci" isterse yetkililere aktarır
 * - [HAZIR] → yetkililere aktar
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { chatWithAI } = require('./aiService');
const Ticket = require('../../models/Ticket');
const { buildCloseButton } = require('../embeds');

const conversationHistory = new Map();
const inactivityTimers    = new Map();
const activeAITickets     = new Map();
// Bekleyen ban talepleri: ticketId → { targetUserId, evidence[] }
const pendingBanRequests  = new Map();

const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
const MAX_AI_TURNS = 8;

// Kanıt kanalı ID
const EVIDENCE_CHANNEL_ID = process.env.EVIDENCE_CHANNEL_ID || '1511411777521455256';
const EVIDENCE_GUILD_ID   = process.env.EVIDENCE_GUILD_ID   || '1367646464804655104';

const TICKET_AI_SYSTEM = `Sen Sentara/EkoYıldız destek botunun yapay zeka asistanısın.
Görevlerin:
1. Kullanıcının sorununu anla ve mümkünse kendin çöz.
2. Çözemezsen [HAZIR] etiketiyle yetkililere aktar.
3. "Canlı temsilci" veya "yetkili" isterse hemen [HAZIR] yaz.

Çözebileceğin durumlar:
- Ban talebi: Kullanıcıdan küfür eden kişinin kullanıcı adı/ID'sini ve kanıt iste.
  Kanıt aldıktan sonra: [BAN_ONAY] <hedef_kullanıcı_adı_veya_id>
- Reklam fiyatları sorusu:
  💰 Reklam Fiyat Listesi:
  • 30₺ — Shorts (kısa video)
  • 50₺ — Uzun video alt kısım sponsor yazısı
  • 100₺ — Uzun video sponsor yazısı + orta bölme
  Bu sistem 2 ay önce finansal destek için açıldı.
- Genel sorular: Kısa ve net yanıt ver.
- Teknik/hesap/grup sorunları: Kısa yardım et, çözemezsen [HAZIR] aktar.

Kurallar:
- Türkçe konuş, samimi ve profesyonel ol.
- Max 300 karakter yanıt ver.
- Asla hakaret etme.
- [HAZIR] veya [BAN_ONAY] etiketleri dışında başka köşeli parantez kullanma.`;

function isReady(text)   { return /\[HAZIR\]/i.test(text); }
function isBanReady(text){ return /\[BAN_ONAY\]/i.test(text); }
function cleanMsg(text) {
  return text
    .replace(/\[HAZIR\]/gi, '')
    .replace(/\[BAN_ONAY\][^\n]*/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
}
function extractBanTarget(text) {
  const m = text.match(/\[BAN_ONAY\]\s*(.+)/i);
  return m ? m[1].trim() : null;
}

// ── Ticket açılınca AI karşılar ─────────────────────────────────────────────
async function startAIConversation(channel, ticket, client) {
  try {
    conversationHistory.set(ticket.ticketId, []);
    activeAITickets.set(ticket.ticketId, {
      channelId: channel.id,
      guildId: channel.guild?.id,
      userId: ticket.userId,
      turns: 0,
    });

    const userContext = `Ticket konusu: "${ticket.subject}"\nAçıklama: "${ticket.description}"`;
    const history = conversationHistory.get(ticket.ticketId);
    history.push({ role: 'user', content: userContext });

    const aiReply = await chatWithAI(history, TICKET_AI_SYSTEM);
    history.push({ role: 'assistant', content: aiReply });

    const info = activeAITickets.get(ticket.ticketId);

    if (isBanReady(aiReply)) {
      const target = extractBanTarget(aiReply);
      await handleBanRequest(channel, ticket, target, [], client, aiReply);
      return;
    }

    if (isReady(aiReply)) {
      info.turns = MAX_AI_TURNS;
      await notifyStaff(channel, ticket, aiReply, client);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setAuthor({ name: '🤖 Sentara AI', iconURL: client.user?.displayAvatarURL() })
      .setDescription(cleanMsg(aiReply))
      .setFooter({ text: 'Sorun çözülmezse yetkililere aktarılırsınız.' });

    await channel.send({ content: `<@${ticket.userId}>`, embeds: [embed] });
    resetInactivityTimer(ticket.ticketId, channel, ticket, client);

  } catch (err) {
    console.error('[ticketAI] startAIConversation hata:', err.message, err.stack?.split('\n')[1] || '');
    await fallbackNotifyStaff(channel, ticket, client);
  }
}

// ── Kullanıcı mesaj attığında ───────────────────────────────────────────────
async function handleUserMessage(message, client) {
  const channelId = message.channel.id;

  let matchedTicketId = null;
  for (const [tid, info] of activeAITickets.entries()) {
    if (info.channelId === channelId && info.userId === message.author.id) {
      matchedTicketId = tid;
      break;
    }
  }
  if (!matchedTicketId) return false;

  const info    = activeAITickets.get(matchedTicketId);
  const history = conversationHistory.get(matchedTicketId);
  if (!history || info.turns >= MAX_AI_TURNS) return false;

  resetInactivityTimer(matchedTicketId, message.channel, null, client);
  info.turns++;

  // Resim/dosya varsa kanıt kanalına gönder
  const attachments = [...message.attachments.values()];
  if (attachments.length > 0) {
    await handleEvidence(message, matchedTicketId, attachments, client);
  }

  const userContent = message.content || (attachments.length > 0 ? '[Görsel/Dosya paylaşıldı]' : '');
  history.push({ role: 'user', content: userContent });

  try {
    await message.channel.sendTyping();
    const aiReply = await chatWithAI(history, TICKET_AI_SYSTEM);
    history.push({ role: 'assistant', content: aiReply });

    if (isBanReady(aiReply)) {
      const target = extractBanTarget(aiReply);
      const ticket = await Ticket.findOne({ ticketId: matchedTicketId });
      clearInactivityTimer(matchedTicketId);
      await handleBanRequest(message.channel, ticket, target, attachments, client, aiReply);
      activeAITickets.delete(matchedTicketId);
      conversationHistory.delete(matchedTicketId);
      return true;
    }

    if (isReady(aiReply) || info.turns >= MAX_AI_TURNS) {
      const ticket = await Ticket.findOne({ ticketId: matchedTicketId });
      clearInactivityTimer(matchedTicketId);
      await notifyStaff(message.channel, ticket, aiReply, client);
      activeAITickets.delete(matchedTicketId);
      conversationHistory.delete(matchedTicketId);
      return true;
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setAuthor({ name: '🤖 Sentara AI', iconURL: client.user?.displayAvatarURL() })
      .setDescription(cleanMsg(aiReply));

    await message.channel.send({ embeds: [embed] });
    return true;

  } catch (err) {
    console.error('[ticketAI] handleUserMessage hata:', err.message);
    const ticket = await Ticket.findOne({ ticketId: matchedTicketId });
    clearInactivityTimer(matchedTicketId);
    await fallbackNotifyStaff(message.channel, ticket, client);
    activeAITickets.delete(matchedTicketId);
    conversationHistory.delete(matchedTicketId);
    return true;
  }
}

// ── Kanıt kanalına resim gönder ─────────────────────────────────────────────
async function handleEvidence(message, ticketId, attachments, client) {
  try {
    const guild = await client.guilds.fetch(EVIDENCE_GUILD_ID).catch(() => null);
    if (!guild) return;
    const evCh = await guild.channels.fetch(EVIDENCE_CHANNEL_ID).catch(() => null);
    if (!evCh?.isSendable()) return;

    const ticket = await Ticket.findOne({ ticketId });
    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`🔍 Kanıtlar — ${ticketId}`)
      .setDescription(
        `**Kullanıcı:** <@${message.author.id}> (${message.author.tag})\n` +
        `**Ticket:** \`${ticketId}\`\n` +
        `**Konu:** ${ticket?.subject || '—'}\n\n` +
        `Kanıtlar bunlar:`
      )
      .setTimestamp();

    const files = attachments.map(a => a.url);
    await evCh.send({ embeds: [embed], files: files.slice(0, 10) });
    await message.channel.send('📎 Kanıtlarınız ilgili kanala iletildi.').catch(() => {});
  } catch (err) {
    console.warn('[ticketAI] handleEvidence hata:', err.message);
  }
}

// ── Ban talep akışı ─────────────────────────────────────────────────────────
async function handleBanRequest(channel, ticket, target, attachments, client, aiSummary) {
  const ticketId = ticket?.ticketId || 'bilinmiyor';

  // Kullanıcının isteği: Banlama gerçekleşsin mi?
  const embed = new EmbedBuilder()
    .setColor(0xff6b6b)
    .setTitle('🚨 Ban Talebi')
    .setDescription(
      `**Hedef:** ${target || 'Belirsiz'}\n` +
      `**Talep eden:** <@${ticket?.userId || '?'}>\n\n` +
      `**Kullanıcının isteği:** Banlama gerçekleşsin mi?`
    )
    .setFooter({ text: 'Yetkililer bu isteği değerlendirecek.' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ban_approve_${ticketId}`)
      .setLabel('✅ Evet, Banla')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ban_reject_${ticketId}`)
      .setLabel('❌ Hayır, Reddet')
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });

  pendingBanRequests.set(ticketId, {
    target,
    userId: ticket?.userId,
    channelId: channel.id,
    guildId: channel.guild?.id,
  });
}

// ── Ban onayla/reddet butonu ─────────────────────────────────────────────────
async function handleBanButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('ban_approve_') && !cid.startsWith('ban_reject_')) return false;

  const ticketId = cid.replace('ban_approve_', '').replace('ban_reject_', '');
  const banInfo  = pendingBanRequests.get(ticketId);

  if (!banInfo) {
    await interaction.reply({ content: '❌ Ban talebi bulunamadı.', ephemeral: true });
    return true;
  }

  if (cid.startsWith('ban_reject_')) {
    pendingBanRequests.delete(ticketId);
    await interaction.update({
      content: '❌ Ban talebi reddedildi.',
      embeds: [],
      components: [],
    }).catch(() => {});

    // Kullanıcıya bildir
    try {
      const u = await client.users.fetch(banInfo.userId);
      await u.send('❌ Ban talebiniz reddedildi. Başka bir isteğiniz varsa bize yazın.');
    } catch (_) {}
    return true;
  }

  // Onayla — ban uygula
  await interaction.deferUpdate().catch(() => {});

  try {
    const guild = await client.guilds.fetch(banInfo.guildId).catch(() => null);
    let banned = false;
    let bannedTag = banInfo.target;

    if (guild && banInfo.target) {
      try {
        // ID mi yoksa username mı?
        const isId = /^\d{17,20}$/.test(banInfo.target.trim());
        let memberId = null;

        if (isId) {
          memberId = banInfo.target.trim();
        } else {
          const members = await guild.members.fetch().catch(() => null);
          const found = members?.find(m =>
            m.user.username.toLowerCase() === banInfo.target.toLowerCase() ||
            m.user.tag.toLowerCase() === banInfo.target.toLowerCase()
          );
          if (found) memberId = found.id;
        }

        if (memberId) {
          await guild.members.ban(memberId, {
            reason: `Ticket ${ticketId} — Yetkili: ${interaction.user.tag}`,
          });
          banned = true;
          bannedTag = `<@${memberId}>`;
        }
      } catch (banErr) {
        console.warn('[ticketAI] Ban uygulanamadı:', banErr.message);
      }
    }

    pendingBanRequests.delete(ticketId);

    const resultEmbed = new EmbedBuilder()
      .setColor(banned ? 0x4ade80 : 0xfbbf24)
      .setTitle(banned ? '✅ Ban Uygulandı' : '⚠️ Ban Uygulanamadı')
      .setDescription(
        banned
          ? `${bannedTag} başarıyla banlandı.`
          : `Kullanıcı bulunamadı veya banlanamadı: \`${banInfo.target}\``
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed], components: [] }).catch(() => {});

    // Kullanıcıya bildir
    try {
      const u = await client.users.fetch(banInfo.userId);
      await u.send(
        banned
          ? `✅ **Sorununuz çözüldü!** Kişi banlandı.\n\n` +
            `Başka bir isteğiniz var mı?\n` +
            `⭐ Hizmeti değerlendirmeyi unutmayın! 5 yıldız verirseniz çok mutlu oluruz 😊`
          : `⚠️ Hedef kullanıcı bulunamadı. Yetkililere aktarılıyorsunuz.`
      );
    } catch (_) {}

  } catch (err) {
    console.error('[ticketAI] handleBanButton hata:', err.message);
    await interaction.editReply({ content: '❌ Ban işlemi sırasında hata oluştu.', components: [] }).catch(() => {});
  }

  return true;
}

// ── Yetkililere aktar ───────────────────────────────────────────────────────
async function notifyStaff(channel, ticket, aiSummary, client) {
  try {
    const summary = cleanMsg(aiSummary).slice(0, 800) || 'Kullanıcı sorunu açıkladı.';
    if (ticket) { ticket.aiSummary = summary; await ticket.save(); }

    const guild = channel.guild;
    const staffMentions = [];
    try {
      const members = await guild.members.fetch();
      members
        .filter(m => !m.user.bot && m.permissions.has('ManageMessages') && m.presence?.status !== 'offline')
        .first(3)
        .forEach(m => staffMentions.push(`<@${m.id}>`));
    } catch (_) {}

    const embed = new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('👨‍💼 Yetkili Gerekiyor')
      .setDescription(
        `**🤖 AI Özeti:** ${summary}\n\n` +
        `**Ticket:** \`${ticket?.ticketId || '—'}\`\n` +
        `**Kullanıcı:** <@${ticket?.userId || '?'}>\n` +
        `**Konu:** ${ticket?.subject || '—'}`
      )
      .setFooter({ text: 'Sentara AI • Yetkili bekleniyor' })
      .setTimestamp();

    await channel.send({
      content: staffMentions.length
        ? `${staffMentions.join(' ')} — Destek talebi!`
        : '📢 Aktif yetkili bulunamadı.',
      embeds: [embed],
    });
  } catch (err) {
    console.error('[ticketAI] notifyStaff hata:', err.message);
  }
}

async function fallbackNotifyStaff(channel, ticket, client) {
  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('👨‍💼 Yetkili Gerekiyor')
      .setDescription(`**Kullanıcı:** <@${ticket?.userId || '?'}>\n**Konu:** ${ticket?.subject || '—'}\n\nAI yanıt veremiyor. Lütfen doğrudan ilgilenin.`)
      .setTimestamp()],
  }).catch(() => {});
}

// ── Timer ───────────────────────────────────────────────────────────────────
function resetInactivityTimer(ticketId, channel, ticket, client) {
  clearInactivityTimer(ticketId);
  const timer = setTimeout(async () => {
    try {
      const t = ticket || await Ticket.findOne({ ticketId });
      if (!t || t.status === 'closed') return;
      try {
        const user = await client.users.fetch(t.userId);
        await user.send({
          embeds: [new EmbedBuilder()
            .setColor(0xed4245).setTitle('⏰ Ticket Kapatıldı')
            .setDescription('10 dakika aktif olmadığınız için ticket kapatıldı. İstediğiniz zaman tekrar açabilirsiniz.')
            .setTimestamp()],
        });
      } catch (_) {}
      t.status = 'closed'; t.closedAt = new Date();
      t.closeReason = 'İnaktivite'; t.closedBy = 'AI';
      await t.save();
      await channel.send('⏰ İnaktivite nedeniyle kapatıldı.').catch(() => {});
      await channel.permissionOverwrites.edit(t.userId, { ViewChannel: false, SendMessages: false }).catch(() => {});
      const { scheduleTicketDeletion } = require('./ticketCleanup');
      scheduleTicketDeletion(ticketId);
    } catch (err) {
      console.error('[ticketAI] inactivity timer hata:', err.message);
    }
    activeAITickets.delete(ticketId);
    conversationHistory.delete(ticketId);
  }, INACTIVITY_TIMEOUT);
  inactivityTimers.set(ticketId, timer);
}

function clearInactivityTimer(ticketId) {
  const t = inactivityTimers.get(ticketId);
  if (t) { clearTimeout(t); inactivityTimers.delete(ticketId); }
}

function cleanupTicketAI(ticketId) {
  clearInactivityTimer(ticketId);
  activeAITickets.delete(ticketId);
  conversationHistory.delete(ticketId);
  pendingBanRequests.delete(ticketId);
}

module.exports = {
  startAIConversation,
  handleUserMessage,
  handleBanButton,
  cleanupTicketAI,
};
