'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { chatWithAI } = require('./aiService');
const Ticket = require('../../models/Ticket');

const conversationHistory = new Map();
const inactivityTimers    = new Map();
const activeAITickets     = new Map();
const pendingBanRequests  = new Map();
const pendingAdRequests   = new Map(); // ticketId → { adType, price, topic, channelId, guildId, userId }
const pendingAdEvidence   = new Map(); // ticketId → { ...adInfo, link }

const INACTIVITY_TIMEOUT  = 10 * 60 * 1000;
const MAX_AI_TURNS        = 10;

const EVIDENCE_CHANNEL_ID = process.env.EVIDENCE_CHANNEL_ID || '1511411777521455256';
const EVIDENCE_GUILD_ID   = process.env.EVIDENCE_GUILD_ID   || '1367646464804655104';
const AD_SALES_CHANNEL_ID = process.env.AD_SALES_CHANNEL_ID || '1511411777521455256';
const AD_SALES_GUILD_ID   = process.env.AD_SALES_GUILD_ID   || '1367646464804655104';

const SYSTEM = `Sen Sentara/EkoYıldız destek botunun yapay zeka asistanısın.
Kullanıcıyla konuş ve sorununu çöz. Çözemezsen [HAZIR] ile yetkililere aktar.

Yapabileceklerin:
- BAN TALEBİ: Hedef kişiyi ve kanıt iste. Kanıt alınca: [BAN_ONAY] <hedef>
- REKLAM: Fiyat listesi ver, tür ve konuyu öğren, sonra: [REKLAM_ONAY] <tür>|<fiyat>|<konu>
  Fiyatlar: 30₺=Shorts, 50₺=Uzun video alt sponsor, 100₺=Uzun video orta bölme+sponsor
  Not: 2 ay önce finansal destek için açıldı.
- GENEL SORULAR: Kısa yanıt ver.
- YETKİLİ İSTEĞİ: Hemen [HAZIR] yaz. Asla HAZIR deme [HAZIR] de.
- KANIT: Kanıt alınca [BAN_ONAY] <hedef> yaz. Kanıt yoksa [REKLAM_ONAY] <tür>|<fiyat>|<konu> yaz.

Kurallar: Türkçe, max 300 karakter, [HAZIR]/[BAN_ONAY]/[REKLAM_ONAY] dışında köşeli parantez kullanma.`;

function isReady(t)   { return /\[HAZIR\]/i.test(t); }
function isBan(t)     { return /\[BAN_ONAY\]/i.test(t); }
function isAd(t)      { return /\[REKLAM_ONAY\]/i.test(t); }

function cleanMsg(t) {
  return t
    .replace(/\[HAZIR\]/gi, '')
    .replace(/\[BAN_ONAY\][^\n]*/gi, '')
    .replace(/\[REKLAM_ONAY\][^\n]*/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
}

function extractBanTarget(t) {
  const m = t.match(/\[BAN_ONAY\]\s*(.+)/i);
  return m ? m[1].trim() : null;
}

function extractAdInfo(t) {
  const m = t.match(/\[REKLAM_ONAY\]\s*(.+)/i);
  if (!m) return null;
  const parts = m[1].split('|').map(s => s.trim());
  return { adType: parts[0] || '?', price: parts[1] || '?', topic: parts[2] || '?' };
}

// ── Ticket açılınca AI başlar ────────────────────────────────────────────────
async function startAIConversation(channel, ticket, client) {
  try {
    conversationHistory.set(ticket.ticketId, []);
    activeAITickets.set(ticket.ticketId, {
      channelId: channel.id,
      guildId: channel.guild?.id,
      userId: ticket.userId,
      turns: 0,
    });

    const ctx = `Ticket konusu: "${ticket.subject}"\nAçıklama: "${ticket.description}"`;
    const history = conversationHistory.get(ticket.ticketId);
    history.push({ role: 'user', content: ctx });

    const reply = await chatWithAI(history, SYSTEM);
    history.push({ role: 'assistant', content: reply });

    if (isBan(reply)) {
      await handleBanRequest(channel, ticket, extractBanTarget(reply), [], client);
      return;
    }
    if (isAd(reply)) {
      const info = extractAdInfo(reply);
      await handleAdRequest(channel, ticket, info, client);
      return;
    }
    if (isReady(reply)) {
      activeAITickets.get(ticket.ticketId).turns = MAX_AI_TURNS;
      await notifyStaff(channel, ticket, reply, client);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setAuthor({ name: '🤖 Sentara AI', iconURL: client.user?.displayAvatarURL() })
      .setDescription(cleanMsg(reply))
      .setFooter({ text: 'Çözülmezse yetkililere aktarılırsınız.' });

    await channel.send({ content: `<@${ticket.userId}>`, embeds: [embed] });
    resetInactivityTimer(ticket.ticketId, channel, ticket, client);
  } catch (err) {
    console.error('[ticketAI] startAI hata:', err.message);
    await fallbackNotify(channel, ticket);
  }
}

// ── Kullanıcı mesaj attığında ────────────────────────────────────────────────
async function handleUserMessage(message, client) {
  const channelId = message.channel.id;
  let matchedId = null;
  for (const [tid, info] of activeAITickets.entries()) {
    if (info.channelId === channelId && info.userId === message.author.id) {
      matchedId = tid; break;
    }
  }
  if (!matchedId) return false;

  const info = activeAITickets.get(matchedId);
  const history = conversationHistory.get(matchedId);
  if (!history || info.turns >= MAX_AI_TURNS) return false;

  resetInactivityTimer(matchedId, message.channel, null, client);
  info.turns++;

  // Resim/dosya → kanıt kanalına gönder
  const attachments = [...message.attachments.values()];
  if (attachments.length) await sendEvidence(message, matchedId, attachments, client);

  // Reklam kanıt bekleniyor mu?
  if (pendingAdEvidence.has(matchedId) && attachments.length) {
    await finalizeAdWithEvidence(message, matchedId, attachments, client);
    return true;
  }

  const content = message.content || (attachments.length ? '[Görsel paylaşıldı]' : '');
  history.push({ role: 'user', content });

  try {
    await message.channel.sendTyping();
    const reply = await chatWithAI(history, SYSTEM);
    history.push({ role: 'assistant', content: reply });

    if (isBan(reply)) {
      const ticket = await Ticket.findOne({ ticketId: matchedId });
      clearInactivityTimer(matchedId);
      await handleBanRequest(message.channel, ticket, extractBanTarget(reply), attachments, client);
      activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
      return true;
    }
    if (isAd(reply)) {
      const ticket = await Ticket.findOne({ ticketId: matchedId });
      clearInactivityTimer(matchedId);
      await handleAdRequest(message.channel, ticket, extractAdInfo(reply), client);
      activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
      return true;
    }
    if (isReady(reply) || info.turns >= MAX_AI_TURNS) {
      const ticket = await Ticket.findOne({ ticketId: matchedId });
      clearInactivityTimer(matchedId);
      await notifyStaff(message.channel, ticket, reply, client);
      activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
      return true;
    }

    await message.channel.send({
      embeds: [new EmbedBuilder().setColor(0x7c6af7)
        .setAuthor({ name: '🤖 Sentara AI', iconURL: client.user?.displayAvatarURL() })
        .setDescription(cleanMsg(reply))],
    });
    return true;
  } catch (err) {
    console.error('[ticketAI] handleUserMessage hata:', err.message);
    const ticket = await Ticket.findOne({ ticketId: matchedId });
    clearInactivityTimer(matchedId);
    await fallbackNotify(message.channel, ticket);
    activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
    return true;
  }
}

// ── Reklam akışı ─────────────────────────────────────────────────────────────
async function handleAdRequest(channel, ticket, adInfo, client) {
  if (!adInfo) { await fallbackNotify(channel, ticket); return; }

  const { adType, price, topic } = adInfo;
  const ticketId = ticket?.ticketId || 'bilinmiyor';

  // Özel kanala bildir
  try {
    const guild = await client.guilds.fetch(AD_SALES_GUILD_ID).catch(() => null);
    if (guild) {
      const adCh = await guild.channels.fetch(AD_SALES_CHANNEL_ID).catch(() => null);
      if (adCh?.isSendable()) {
        await adCh.send({
          embeds: [new EmbedBuilder()
            .setColor(0xfbbf24)
            .setTitle('💰 İTEM SATIŞ: REKLAM')
            .addFields(
              { name: 'KONU',           value: topic,   inline: true },
              { name: 'HANGİ TÜR',      value: adType,  inline: true },
              { name: 'FİYAT',          value: `${price}₺`, inline: true },
              { name: 'KULLANICI',      value: `<@${ticket?.userId}>`, inline: true },
              { name: 'TİCKET',        value: `\`${ticketId}\``, inline: true },
            )
            .setDescription('LÜTFEN LİNK GİRİN')
            .setTimestamp()],
        });
      }
    }
  } catch (_) {}

  // Ticket kanalında "Link Girin" butonu
  pendingAdRequests.set(ticketId, {
    adType, price, topic,
    channelId: channel.id,
    guildId: channel.guild?.id,
    userId: ticket?.userId,
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ad_link_${ticketId}`)
      .setLabel('🔗 Link Girin')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('✅ Reklam Talebi Alındı')
      .setDescription(
        `**Tür:** ${adType}\n**Fiyat:** ${price}₺\n**Konu:** ${topic}\n\n` +
        `Lütfen aşağıdaki butona basarak **reklam linkini** girin.`
      )],
    components: [row],
  });
}

// ── "Link Girin" butona basınca modal aç ─────────────────────────────────────
async function handleAdLinkButton(interaction, client) {
  if (!interaction.customId?.startsWith('ad_link_')) return false;
  const ticketId = interaction.customId.replace('ad_link_', '');

  const modal = new ModalBuilder()
    .setCustomId(`ad_link_modal_${ticketId}`)
    .setTitle('Reklam Linki')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ad_link_input')
          .setLabel('Reklamı yapılacak linki girin')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://...')
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
  return true;
}

// ── Modal submit: link girildi ────────────────────────────────────────────────
async function handleAdLinkModal(interaction, client) {
  if (!interaction.customId?.startsWith('ad_link_modal_')) return false;
  const ticketId = interaction.customId.replace('ad_link_modal_', '');
  const link = interaction.fields.getTextInputValue('ad_link_input').trim();

  const adInfo = pendingAdRequests.get(ticketId);
  pendingAdRequests.delete(ticketId);

  if (!adInfo) {
    await interaction.reply({ content: '❌ Reklam talebi bulunamadı.', ephemeral: true });
    return true;
  }

  // Kanıt bekleme moduna geç
  pendingAdEvidence.set(ticketId, { ...adInfo, link });

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x4ade80)
      .setTitle('🔗 Link Alındı')
      .setDescription(
        `**Link:** ${link}\n\n` +
        `✅ Ödeme yaptıktan sonra **ekran görüntüsü (SSI)** atın.\n` +
        `SSI alındıktan sonra yetkililere yönlendirileceksiniz.`
      )],
    ephemeral: false,
  });
  return true;
}

// ── SSI (kanıt) gelince yetkililere aktar ─────────────────────────────────────
async function finalizeAdWithEvidence(message, ticketId, attachments, client) {
  const adInfo = pendingAdEvidence.get(ticketId);
  if (!adInfo) return;
  pendingAdEvidence.delete(ticketId);

  const ticket = await Ticket.findOne({ ticketId });

  // Kanıt kanalına gönder
  try {
    const guild = await client.guilds.fetch(AD_SALES_GUILD_ID).catch(() => null);
    if (guild) {
      const evCh = await guild.channels.fetch(AD_SALES_CHANNEL_ID).catch(() => null);
      if (evCh?.isSendable()) {
        await evCh.send({
          embeds: [new EmbedBuilder()
            .setColor(0x4ade80)
            .setTitle(`✅ Reklam Ödeme Kanıtı — ${ticketId}`)
            .addFields(
              { name: 'TÜR',    value: adInfo.adType, inline: true },
              { name: 'FİYAT',  value: `${adInfo.price}₺`, inline: true },
              { name: 'KONU',   value: adInfo.topic,   inline: true },
              { name: 'LİNK',   value: adInfo.link,    inline: false },
              { name: 'KULLANICI', value: `<@${adInfo.userId}>`, inline: true },
            )],
          files: attachments.map(a => a.url).slice(0, 5),
        });
      }
    }
  } catch (_) {}

  // Yetkililere aktar
  await notifyStaff(message.channel, ticket, `Reklam ödeme kanıtı alındı. Tür: ${adInfo.adType}, Fiyat: ${adInfo.price}₺`, client);
  await message.channel.send('✅ Kanıtınız alındı! Yetkili ekibimiz en kısa sürede sizinle ilgilenecek.').catch(() => {});
}

// ── Ban akışı ─────────────────────────────────────────────────────────────────
async function handleBanRequest(channel, ticket, target, attachments, client) {
  const ticketId = ticket?.ticketId || 'bilinmiyor';
  pendingBanRequests.set(ticketId, {
    target, userId: ticket?.userId,
    channelId: channel.id, guildId: channel.guild?.id,
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ban_approve_${ticketId}`).setLabel('✅ Evet, Banla').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ban_reject_${ticketId}`).setLabel('❌ Hayır, Reddet').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xff6b6b).setTitle('🚨 Ban Talebi')
      .setDescription(`**Hedef:** ${target || 'Belirsiz'}\n**Talep eden:** <@${ticket?.userId}>\n\n**Banlama gerçekleşsin mi?'`)
      .setTimestamp()],
    components: [row],
  });
}

async function handleBanButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('ban_approve_') && !cid.startsWith('ban_reject_')) return false;
  const ticketId = cid.replace('ban_approve_', '').replace('ban_reject_', '');
  const info = pendingBanRequests.get(ticketId);
  if (!info) { await interaction.reply({ content: '❌ Ban talebi bulunamadı.', ephemeral: true }); return true; }

  if (cid.startsWith('ban_reject_')) {
    pendingBanRequests.delete(ticketId);
    await interaction.update({ content: '❌ Ban talebi reddedildi.', embeds: [], components: [] }).catch(() => {});
    try { const u = await client.users.fetch(info.userId); await u.send('❌ Ban talebiniz reddedildi.'); } catch (_) {}
    return true;
  }

  await interaction.deferUpdate().catch(() => {});
  let banned = false;
  let bannedTag = info.target;
  try {
    const guild = await client.guilds.fetch(info.guildId).catch(() => null);
    if (guild && info.target) {
      const isId = /^\d{17,20}$/.test(info.target.trim());
      let memberId = isId ? info.target.trim() : null;
      if (!memberId) {
        const members = await guild.members.fetch().catch(() => null);
        const found = members?.find(m =>
          m.user.username.toLowerCase() === info.target.toLowerCase() ||
          m.user.tag.toLowerCase() === info.target.toLowerCase()
        );
        if (found) memberId = found.id;
      }
      if (memberId) {
        await guild.members.ban(memberId, { reason: `Ticket ${ticketId} — ${interaction.user.tag}` });
        banned = true; bannedTag = `<@${memberId}>`;
      }
    }
  } catch (err) { console.warn('[ticketAI] ban hata:', err.message); }

  pendingBanRequests.delete(ticketId);
  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(banned ? 0x4ade80 : 0xfbbf24)
      .setTitle(banned ? '✅ Ban Uygulandı' : '⚠️ Ban Uygulanamadı')
      .setDescription(banned ? `${bannedTag} banlandı.` : `Kullanıcı bulunamadı: \`${info.target}\``)
      .setTimestamp()],
    components: [],
  }).catch(() => {});

  try {
    const u = await client.users.fetch(info.userId);
    await u.send(banned
      ? '✅ **Sorununuz çözüldü!** Kişi banlandı.\n\nBaşka bir isteğiniz var mı? ⭐ 5 yıldız vermeyi unutmayın! 😊'
      : '⚠️ Hedef kullanıcı bulunamadı. Yetkililere aktarılıyorsunuz.'
    );
  } catch (_) {}
  return true;
}

// ── Kanıt kanalına resim gönder ───────────────────────────────────────────────
async function sendEvidence(message, ticketId, attachments, client) {
  try {
    const guild = await client.guilds.fetch(EVIDENCE_GUILD_ID).catch(() => null);
    if (!guild) return;
    const ch = await guild.channels.fetch(EVIDENCE_CHANNEL_ID).catch(() => null);
    if (!ch?.isSendable()) return;
    const ticket = await Ticket.findOne({ ticketId });
    await ch.send({
      embeds: [new EmbedBuilder().setColor(0xff6b6b)
        .setTitle(`🔍 Kanıtlar — ${ticketId}`)
        .setDescription(`**Kullanıcı:** <@${message.author.id}>\n**Konu:** ${ticket?.subject || '—'}\nKanıtlar bunlar:`)
        .setTimestamp()],
      files: attachments.map(a => a.url).slice(0, 10),
    });
    await message.channel.send('📎 Kanıtlarınız ilgili kanala iletildi.').catch(() => {});
  } catch (err) { console.warn('[ticketAI] sendEvidence hata:', err.message); }
}

// ── Yetkililere aktar ─────────────────────────────────────────────────────────
async function notifyStaff(channel, ticket, summary, client) {
  try {
    const clean = cleanMsg(summary).slice(0, 800) || '—';
    if (ticket) { ticket.aiSummary = clean; await ticket.save(); }
    const guild = channel.guild;
    const mentions = [];
    try {
      const members = await guild.members.fetch();
      members
        .filter(m => {
          if (m.user.bot) return false;
          if (!m.permissions.has('ManageMessages')) return false;
          // Presence opsiyonel — GuildPresences intent yoksa crash'i önle
          try { return m.presence?.status !== 'offline'; } catch (_) { return true; }
        })
        .first(3)
        .forEach(m => mentions.push(`<@${m.id}>`));
    } catch (_) {}
    await channel.send({
      content: mentions.length ? `${mentions.join(' ')} — Destek talebi!` : '📢 Aktif yetkili bulunamadı.',
      embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle('👨‍💼 Yetkili Gerekiyor')
        .setDescription(`**Özet:** ${clean}\n**Ticket:** \`${ticket?.ticketId || '—'}\`\n**Kullanıcı:** <@${ticket?.userId || '?'}>`)
        .setTimestamp()],
    });
  } catch (err) { console.error('[ticketAI] notifyStaff hata:', err.message); }
}

async function fallbackNotify(channel, ticket) {
  await channel.send({
    embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle('👨‍💼 Yetkili Gerekiyor')
      .setDescription(`**Kullanıcı:** <@${ticket?.userId || '?'}>\n**Konu:** ${ticket?.subject || '—'}\nAI yanıt veremiyor.`)
      .setTimestamp()],
  }).catch(() => {});
}

// ── İnaktivite timer ──────────────────────────────────────────────────────────
function resetInactivityTimer(ticketId, channel, ticket, client) {
  clearInactivityTimer(ticketId);
  const timer = setTimeout(async () => {
    try {
      const t = ticket || await Ticket.findOne({ ticketId });
      if (!t || t.status === 'closed') return;
      try {
        const u = await client.users.fetch(t.userId);
        await u.send({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('⏰ Ticket Kapatıldı')
          .setDescription('10 dakika aktif olmadığınız için ticket kapatıldı.').setTimestamp()] });
      } catch (_) {}
      t.status = 'closed'; t.closedAt = new Date();
      t.closeReason = 'İnaktivite'; t.closedBy = 'AI'; await t.save();
      await channel.send('⏰ İnaktivite — ticket kapatıldı.').catch(() => {});
      await channel.permissionOverwrites.edit(t.userId, { ViewChannel: false, SendMessages: false }).catch(() => {});
      const { scheduleTicketDeletion } = require('./ticketCleanup');
      scheduleTicketDeletion(ticketId);
    } catch (err) { console.error('[ticketAI] inactivity hata:', err.message); }
    activeAITickets.delete(ticketId); conversationHistory.delete(ticketId);
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
  pendingAdRequests.delete(ticketId);
  pendingAdEvidence.delete(ticketId);
}

module.exports = {
  startAIConversation,
  handleUserMessage,
  handleBanButton,
  handleAdLinkButton,
  handleAdLinkModal,
  cleanupTicketAI,
};
