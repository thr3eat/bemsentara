'use strict';

/**
 * DM Ticket Sistemi
 * - Kullanıcı bot'a DM yazar → AI sorunu anlar → Ticket kanalı açar (sadece yetkililer)
 * - Yetkili kanaldan yazar → bot kullanıcıya DM atar
 * - Kullanıcı DM'den yazar → bot kanalda gösterir
 */

const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { chatWithAI } = require('./aiService');
const Ticket = require('../../models/Ticket');
const { generateTicketId } = require('../../utils/ticketId');
const { TARGET_GUILD_ID, TARGET_CHANNEL_ID, GUILD2_ID, GUILD2_TICKET_CATEGORY_ID } = require('../../config');

// DM konuşma geçmişi: userId → [{role, content}]
const dmConversations = new Map();
// Aktif DM ticket'ları: userId → { ticketId, channelId, guildId }
const activeDMTickets = new Map();

const DM_SYSTEM_PROMPT = `Sen Sentara destek sisteminin yapay zeka asistanısın.
Görevin: Kullanıcıyla DM üzerinden konuşarak destek talebini anlamak.
Kurallar:
- Türkçe konuş, samimi ve yardımsever ol.
- Kullanıcının sorununu 2-3 mesajda net olarak anla.
- Sorun net olduğunda cevabının başına tam olarak [HAZIR] yaz ve sorunu 1-2 cümleyle özetle.
- Asla kendin çözüm önerme, yetkililere ilet.
- Kısa ve net mesajlar yaz (max 150 karakter).
- İlk mesajda: "Merhaba! Nasıl yardımcı olabilirim?" diye sor.`;

/**
 * Bot'a DM gelen mesajı işle
 */
async function handleDMMessage(message, client) {
  const userId = message.author.id;

  // Zaten aktif ticket'ı var mı? → Kanaldan devam
  if (activeDMTickets.has(userId)) {
    await forwardDMToChannel(message, client);
    return;
  }

  // Yeni veya devam eden AI konuşması
  if (!dmConversations.has(userId)) {
    // İlk mesaj — karşılama
    dmConversations.set(userId, []);
    
    try {
      await message.author.sendTyping();
      const history = dmConversations.get(userId);
      history.push({ role: 'user', content: message.content });

      const aiReply = await chatWithAI(history, DM_SYSTEM_PROMPT);
      history.push({ role: 'assistant', content: aiReply });

      const cleanReply = aiReply.replace('[HAZIR]', '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      if (aiReply.includes('[HAZIR]')) {
        await createDMTicket(message.author, cleanReply, history, client);
      } else {
        await message.author.send(cleanReply);
      }
    } catch (err) {
      console.error('[dmTicket] İlk mesaj hatası:', err.message);
      await message.author.send('Merhaba! Destek sistemine hoş geldiniz. Sorununuzu anlatın, yetkiliye aktaracağım.').catch(() => {});
    }
    return;
  }

  // Devam eden AI konuşması
  const history = dmConversations.get(userId);
  if (history.length >= 10) {
    // Çok uzadı — direkt ticket aç
    await createDMTicket(message.author, 'Kullanıcı destek talep etti.', history, client);
    return;
  }

  history.push({ role: 'user', content: message.content });

  try {
    await message.author.sendTyping();
    const aiReply = await chatWithAI(history, DM_SYSTEM_PROMPT);
    history.push({ role: 'assistant', content: aiReply });

    const cleanReply = aiReply.replace('[HAZIR]', '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    if (aiReply.includes('[HAZIR]')) {
      await createDMTicket(message.author, cleanReply, history, client);
    } else {
      await message.author.send(cleanReply);
    }
  } catch (err) {
    console.error('[dmTicket] AI yanıt hatası:', err.message);
    await message.author.send('Bir sorun oluştu, sizi hemen yetkililere bağlıyorum...').catch(() => {});
    await createDMTicket(message.author, 'AI hatası nedeniyle direkt aktarım.', history || [], client);
  }
}

/**
 * DM ticket kanalı oluştur — sadece yetkililer görür
 */
async function createDMTicket(user, summary, history, client) {
  const userId = user.id;
  dmConversations.delete(userId);

  try {
    // Kullanıcıya bildir
    await user.send(
      '⏳ **Yetkiliye aktarılıyorsunuz...**\n\nBekleyin, yetkili size yazdığında DM üzerinden bildirim alacaksınız.'
    ).catch(() => {});

    const ticketId = generateTicketId();

    // Her iki sunucuda kanal aç — sadece yetkililer görür
    const targets = [
      { id: TARGET_GUILD_ID, categoryId: TARGET_CHANNEL_ID },
      { id: GUILD2_ID,       categoryId: GUILD2_TICKET_CATEGORY_ID },
    ];

    let createdChannel = null;
    let createdGuildId = null;

    for (const target of targets) {
      try {
        const guild = await client.guilds.fetch(target.id).catch(() => null);
        if (!guild) continue;

        // İzinler: @everyone göremez, ManageMessages'a sahip olanlar görebilir
        const permissionOverwrites = [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        ];

        // ManageMessages iznine sahip rolleri ekle
        const manageRoles = guild.roles.cache.filter(r =>
          r.permissions.has(PermissionFlagsBits.ManageMessages) && !r.managed
        );
        manageRoles.forEach(r => {
          permissionOverwrites.push({
            id: r.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          });
        });

        // Kategori bul
        let parentId = null;
        if (target.categoryId) {
          const ch = await guild.channels.fetch(target.categoryId).catch(() => null);
          if (ch?.type === ChannelType.GuildCategory) parentId = ch.id;
          else if (ch?.type === ChannelType.GuildText) parentId = ch.parentId;
        }
        if (!parentId) {
          let cat = guild.channels.cache.find(c => c.name.toLowerCase().includes('destek') && c.type === ChannelType.GuildCategory);
          if (!cat) cat = await guild.channels.create({ name: 'DM TİCKETLAR', type: ChannelType.GuildCategory });
          parentId = cat.id;
        }

        const channel = await guild.channels.create({
          name: `dm-${ticketId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: parentId,
          permissionOverwrites,
          topic: `DM Ticket | Kullanıcı: ${user.tag} (${userId})`,
        });

        // Konuşma geçmişini özet olarak gönder
        const conversationText = history
          .filter(m => m.role === 'user')
          .map(m => `> ${m.content}`)
          .join('\n')
          .slice(0, 800) || 'Mesaj yok.';

        const embed = new EmbedBuilder()
          .setColor(0x7c6af7)
          .setTitle(`📩 DM Ticket — ${ticketId}`)
          .setDescription(
            `**Kullanıcı:** <@${userId}> (${user.tag})\n` +
            `**AI Özeti:** ${summary}\n\n` +
            `**Konuşma Geçmişi:**\n${conversationText}`
          )
          .addFields(
            { name: '📌 Nasıl çalışır?', value: 'Bu kanala yazdığınız mesajlar kullanıcıya DM olarak iletilir.\nKullanıcının DM yanıtları da bu kanala düşer.', inline: false }
          )
          .setFooter({ text: `DM Ticket Sistemi • ${user.tag}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        if (!createdChannel) {
          createdChannel = channel;
          createdGuildId = guild.id;
        }
      } catch (chErr) {
        console.warn(`[dmTicket] ${target.id} kanalı açılamadı:`, chErr.message);
      }
    }

    if (!createdChannel) {
      await user.send('❌ Ticket kanalı oluşturulamadı. Lütfen Discord sunucusundan destek alın.').catch(() => {});
      return;
    }

    // Ticket kaydet
    const ticket = new Ticket({
      ticketId,
      userId,
      userName: user.username,
      category: 'dm',
      subject: summary.slice(0, 100),
      description: summary,
      priority: 'medium',
      channelId: createdChannel.id,
      guildId: createdGuildId,
      source: 'dm',
    });
    await ticket.save();

    // Aktif DM ticket'a kaydet
    activeDMTickets.set(userId, {
      ticketId,
      channelId: createdChannel.id,
      guildId: createdGuildId,
    });

    console.log(`[dmTicket] ${user.tag} → DM ticket oluşturuldu: ${ticketId}`);

  } catch (err) {
    console.error('[dmTicket] createDMTicket hata:', err.message);
    await user.send('Bir hata oluştu. Lütfen sunucudan destek talep edin.').catch(() => {});
  }
}

/**
 * DM'den gelen mesajı ticket kanalına ilet
 */
async function forwardDMToChannel(message, client) {
  const userId = message.author.id;
  const dmInfo = activeDMTickets.get(userId);
  if (!dmInfo) return;

  try {
    const guild = await client.guilds.fetch(dmInfo.guildId).catch(() => null);
    if (!guild) return;
    const channel = await guild.channels.fetch(dmInfo.channelId).catch(() => null);
    if (!channel) {
      activeDMTickets.delete(userId);
      await message.author.send('Ticket kanalı bulunamadı. Ticket\'ınız kapatılmış olabilir.').catch(() => {});
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x4ade80)
      .setAuthor({ name: `${message.author.tag} (DM)`, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content)
      .setFooter({ text: '📩 DM\'den gelen mesaj' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[dmTicket] forwardDMToChannel hata:', err.message);
  }
}

/**
 * Ticket kanalından gelen mesajı kullanıcıya DM olarak ilet
 * index.js'deki messageCreate'den çağrılır
 */
async function forwardChannelToDM(message, client) {
  // dm- ile başlayan kanallarda çalış
  if (!message.channel.name?.startsWith('dm-')) return false;

  const channelId = message.channel.id;

  // Bu kanalın hangi DM ticket'ına ait olduğunu bul
  let targetUserId = null;
  for (const [userId, info] of activeDMTickets.entries()) {
    if (info.channelId === channelId) {
      targetUserId = userId;
      break;
    }
  }

  // Aktif map'te yoksa DB'den ticket topic'inden bul
  if (!targetUserId && message.channel.topic) {
    const match = message.channel.topic.match(/\((\d+)\)/);
    if (match) targetUserId = match[1];
  }

  if (!targetUserId) return false;

  try {
    const user = await client.users.fetch(targetUserId).catch(() => null);
    if (!user) return false;

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setAuthor({ name: `${message.author.tag} — Yetkili`, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content)
      .setFooter({ text: 'Sentara Destek • Bu mesaj bir yetkili tarafından gönderildi.' })
      .setTimestamp();

    await user.send({ embeds: [embed] });

    // Kanala iletildiğini belirt
    await message.react('✅').catch(() => {});
    return true;
  } catch (err) {
    console.error('[dmTicket] forwardChannelToDM hata:', err.message);
    return false;
  }
}

/**
 * DM ticket'ı kapat
 */
async function closeDMTicket(userId) {
  activeDMTickets.delete(userId);
  dmConversations.delete(userId);
}

module.exports = {
  handleDMMessage,
  forwardChannelToDM,
  closeDMTicket,
  activeDMTickets,
};
