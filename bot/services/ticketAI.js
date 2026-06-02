'use strict';

/**
 * Ticket AI Yöneticisi
 * - Ticket açılınca AI karşılar, sorunu anlar
 * - [HAZIR] etiketi görünce yetkilileri etiketler
 * - İnaktivite (10 dk) → DM + kanal kapatma
 */

const { EmbedBuilder } = require('discord.js');
const { chatWithAI } = require('./aiService');
const Ticket = require('../../models/Ticket');
const { buildCloseButton } = require('../embeds');

// Her ticket için AI konuşma geçmişi: ticketId → [{role, content}]
const conversationHistory = new Map();

// İnaktivite timer'ları: ticketId → NodeJS.Timeout
const inactivityTimers = new Map();

// AI'ın konuştuğu ticketlar: ticketId → {channelId, guildId, userId}
const activeAITickets = new Map();

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 dakika
const MAX_AI_TURNS = 6; // AI en fazla 6 tur konuşur sonra yetkilileri çağırır

/**
 * Ticket açılınca çağrılır — AI karşılama mesajı gönderir
 */
async function startAIConversation(channel, ticket, client) {
  try {
    // Konuşma geçmişini başlat
    conversationHistory.set(ticket.ticketId, []);
    activeAITickets.set(ticket.ticketId, {
      channelId: channel.id,
      guildId: channel.guild?.id,
      userId: ticket.userId,
      turns: 0,
    });

    // Kullanıcının ilk mesajını (konu + açıklama) konuşma geçmişine ekle
    const userContext = `Ticket konusu: "${ticket.subject}"\nAçıklama: "${ticket.description}"`;
    const history = conversationHistory.get(ticket.ticketId);
    history.push({ role: 'user', content: userContext });

    // AI'dan ilk yanıtı al
    const aiReply = await chatWithAI(history);
    history.push({ role: 'assistant', content: aiReply });

    // [HAZIR] kontrolü
    const info = activeAITickets.get(ticket.ticketId);
    if (aiReply.includes('[HAZIR]')) {
      info.turns = MAX_AI_TURNS; // Bitir
      await notifyStaff(channel, ticket, aiReply, client);
      return;
    }

    // AI mesajını gönder
    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setAuthor({ name: '🤖 Sentara AI', iconURL: client.user?.displayAvatarURL() })
      .setDescription(cleanAIMessage(aiReply))
      .setFooter({ text: 'Sorunuzu açıklayın, yetkililere ileteceğim.' });

    await channel.send({ content: `<@${ticket.userId}>`, embeds: [embed] });

    // İnaktivite timer başlat
    resetInactivityTimer(ticket.ticketId, channel, ticket, client);

  } catch (err) {
    console.error('[ticketAI] startAIConversation hata:', err.message);
    // AI hata verirse direkt yetkililere ilet
    await fallbackNotifyStaff(channel, ticket, client);
  }
}

/**
 * Kullanıcı ticket kanalına mesaj attığında çağrılır
 */
async function handleUserMessage(message, client) {
  const channelId = message.channel.id;

  // Bu kanalda aktif AI ticket'ı var mı?
  let matchedTicketId = null;
  for (const [ticketId, info] of activeAITickets.entries()) {
    if (info.channelId === channelId && info.userId === message.author.id) {
      matchedTicketId = ticketId;
      break;
    }
  }

  if (!matchedTicketId) return false;

  const info = activeAITickets.get(matchedTicketId);
  const history = conversationHistory.get(matchedTicketId);
  if (!history) return false;

  // Max tur kontrolü — zaten bitmişse AI cevap vermesin
  if (info.turns >= MAX_AI_TURNS) return false;

  // İnaktivite timer'ı sıfırla
  resetInactivityTimer(matchedTicketId, message.channel, null, client);

  info.turns++;
  history.push({ role: 'user', content: message.content });

  try {
    // Typing göstergesi
    await message.channel.sendTyping();

    const aiReply = await chatWithAI(history);
    history.push({ role: 'assistant', content: aiReply });

    // [HAZIR] etiketi var mı?
    if (aiReply.includes('[HAZIR]') || info.turns >= MAX_AI_TURNS) {
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
      .setDescription(cleanAIMessage(aiReply));

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

/**
 * AI sorunu anlayınca yetkilileri etiketler
 */
async function notifyStaff(channel, ticket, aiSummary, client) {
  try {
    // [HAZIR] etiketini ve sonrasını özetle
    const summaryRaw = aiSummary.replace('[HAZIR]', '').trim();
    const summary = summaryRaw.slice(0, 800) || 'Kullanıcı sorunu açıkladı.';

    // Ticket modeline özeti kaydet
    if (ticket) {
      ticket.aiSummary = summary;
      await ticket.save();
    }

    // Sunucudaki yetkili rollerini bul — ManageMessages iznine sahip olanlar
    const guild = channel.guild;
    const staffMentions = [];
    try {
      const members = await guild.members.fetch();
      const staffMembers = members.filter(m =>
        !m.user.bot &&
        m.permissions.has('ManageMessages') &&
        m.presence?.status && m.presence.status !== 'offline'
      );
      staffMembers.first(3).forEach(m => staffMentions.push(`<@${m.id}>`));
    } catch (_) {}

    const embed = new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('👨‍💼 Yetkili Gerekiyor')
      .setDescription(
        `**🤖 AI Özeti:**\n${summary}\n\n` +
        `**Ticket:** \`${ticket?.ticketId || 'Bilinmiyor'}\`\n` +
        `**Kullanıcı:** <@${ticket?.userId || 'Bilinmiyor'}>\n` +
        `**Konu:** ${ticket?.subject || '—'}`
      )
      .setFooter({ text: 'Sentara AI • Sorun analiz edildi, yetkili bekleniyor' })
      .setTimestamp();

    const content = staffMentions.length
      ? `${staffMentions.join(' ')} — Yeni bir destek talebi var!`
      : '📢 Aktif yetkili bulunamadı, lütfen kontrol edin.';

    await channel.send({ content, embeds: [embed] });

  } catch (err) {
    console.error('[ticketAI] notifyStaff hata:', err.message);
  }
}

/**
 * AI çalışmazsa direkt yetkili bildir
 */
async function fallbackNotifyStaff(channel, ticket, client) {
  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle('👨‍💼 Yetkili Gerekiyor')
    .setDescription(
      `**Kullanıcı:** <@${ticket?.userId || '?'}>\n` +
      `**Konu:** ${ticket?.subject || '—'}\n\n` +
      `AI şu anda yanıt veremiyor. Lütfen kullanıcıyla doğrudan ilgilenin.`
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

/**
 * İnaktivite timer'ı başlat/sıfırla
 */
function resetInactivityTimer(ticketId, channel, ticket, client) {
  clearInactivityTimer(ticketId);

  const timer = setTimeout(async () => {
    try {
      const t = ticket || await Ticket.findOne({ ticketId });
      if (!t || t.status === 'closed') return;

      // Kullanıcıya DM
      try {
        const user = await client.users.fetch(t.userId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('⏰ Ticket\'ınız Kapatıldı')
          .setDescription(
            'Ticket kanalında **10 dakika** boyunca aktif olmadığınız için ticket\'ınız otomatik olarak kapatıldı.\n\n' +
            'İstediğiniz zaman yeni bir ticket açabilir veya mevcut ticket\'ınızı yeniden açabilirsiniz.'
          )
          .addFields({ name: '🎫 Ticket ID', value: `\`${t.ticketId}\``, inline: true })
          .setFooter({ text: 'Sentara Support' })
          .setTimestamp();

        const { buildReopenAndRateRow } = require('../embeds');
        await user.send({ embeds: [dmEmbed], components: [buildReopenAndRateRow(ticketId)] });
      } catch (_) {}

      // Ticket'ı kapat
      t.status = 'closed';
      t.closedAt = new Date();
      t.closeReason = 'İnaktivite — AI tarafından otomatik kapatıldı';
      t.closedBy = 'AI';
      t.closedByName = 'Sentara AI';
      await t.save();

      // Kanala bildirim
      const closeEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('⏰ Ticket İnaktivite Nedeniyle Kapatıldı')
        .setDescription('10 dakika boyunca yanıt alınamadı. Ticket otomatik kapatıldı.')
        .setTimestamp();

      await channel.send({ embeds: [closeEmbed] }).catch(() => {});
      await channel.permissionOverwrites.edit(t.userId, {
        ViewChannel: false, SendMessages: false,
      }).catch(() => {});

      // 5 dk sonra sil
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

/**
 * Ticket kapandığında AI durumu temizle
 */
function cleanupTicketAI(ticketId) {
  clearInactivityTimer(ticketId);
  activeAITickets.delete(ticketId);
  conversationHistory.delete(ticketId);
}

/**
 * AI mesajından [HAZIR] ve gereksiz etiketleri temizle
 */
function cleanAIMessage(text) {
  return text.replace('[HAZIR]', '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

module.exports = {
  startAIConversation,
  handleUserMessage,
  cleanupTicketAI,
};
