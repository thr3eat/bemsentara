'use strict';

const {
  EmbedBuilder, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { chatWithAI } = require('./aiService');
const Ticket = require('../../models/Ticket');
const { generateTicketId } = require('../../utils/ticketId');
const {
  TARGET_GUILD_ID, TARGET_CHANNEL_ID,
  GUILD2_ID, GUILD2_TICKET_CATEGORY_ID,
} = require('../../config');

// userId → [{role, content}]
const dmConversations = new Map();
// userId → { ticketId, channelId, guildId }
const activeDMTickets = new Map();
// Onay bekleyen kullanıcılar: userId → true
const pendingConfirmation = new Map();

const DM_SYSTEM_PROMPT = `Sen Sentara destek botunun yapay zeka asistanısın.
Kullanıcıyla kısa bir sohbet yap ve destek talebini anla.
Kurallar:
- Türkçe konuş, samimi ve nazik ol.
- 2-3 mesajda sorunu öğren.
- Sorunu anladıktan sonra YALNIZCA şu formatta yanıt ver (başka hiçbir şey yazma):
  [HAZIR] <sorunun özeti tek cümle>
- Çözüm önerme, yetkililere ilet.
- Yanıtlar maksimum 200 karakter olsun.`;

function isReady(text) {
  return /^\s*\[HAZIR\]/i.test(text.trim());
}

function cleanAI(text) {
  return text
    .replace(/^\s*\[HAZIR\]\s*/i, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
}

// ── Kapatma butonu ──────────────────────────────────────────────────────────
function buildDMCloseButton(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dm_close_${ticketId}`)
      .setLabel('🔒 DM Ticket\'ı Kapat')
      .setStyle(ButtonStyle.Danger)
  );
}

// ── Bot'a DM gelen mesajı işle ──────────────────────────────────────────────
async function handleDMMessage(message, client) {
  const userId = message.author.id;

  // Aktif ticket varsa → kanala ilet (Map'te veya DB'de)
  if (activeDMTickets.has(userId)) {
    await forwardDMToChannel(message, client);
    return;
  }

  // Map'te yok ama DB'de açık DM ticket olabilir (bot restart sonrası)
  try {
    const existing = await Ticket.findOne({ userId, status: 'open', source: 'dm' });
    if (existing && existing.channelId && existing.guildId) {
      activeDMTickets.set(userId, {
        ticketId:  existing.ticketId,
        channelId: existing.channelId,
        guildId:   existing.guildId,
      });
      await forwardDMToChannel(message, client);
      return;
    }
  } catch (_) {}

  // Onay bekleniyor → mesaj yazarsa tekrar sor (buton beklesin)
  if (pendingConfirmation.has(userId)) {
    await message.author.send(
      '👆 Lütfen yukarıdaki butonlardan birini seçin.'
    ).catch(() => {});
    return;
  }

  // İlk kez yazıyor → Evet/Hayır sor
  if (!dmConversations.has(userId)) {
    pendingConfirmation.set(userId, true);

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle('👋 Merhaba!')
      .setDescription(
        'Sentara Destek sistemine hoş geldiniz.\n\n' +
        '**Destek talebi açmak istiyor musunuz?**'
      )
      .setFooter({ text: 'Sentara Destek' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dm_confirm_yes_${userId}`)
        .setLabel('✅ Evet, destek istiyorum')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`dm_confirm_no_${userId}`)
        .setLabel('❌ Hayır')
        .setStyle(ButtonStyle.Secondary)
    );

    await message.author.send({ embeds: [embed], components: [row] }).catch((err) => {
      console.error('[dmTicket] Karşılama gönderilemedi:', err.message);
    });
    return;
  }

  // Devam eden AI konuşması
  await continueAIConversation(message, client);
}

// ── AI konuşmasını devam ettir ──────────────────────────────────────────────
async function continueAIConversation(message, client) {
  const userId = message.author.id;
  const history = dmConversations.get(userId);

  if (history.length >= 14) {
    await createDMTicket(message.author, 'Kullanıcı destek talep etti.', history, client);
    return;
  }

  history.push({ role: 'user', content: message.content });

  try {
    const dmCh = await message.author.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});
  } catch (_) {}

  let aiReply;
  try {
    aiReply = await chatWithAI(history, DM_SYSTEM_PROMPT);
    history.push({ role: 'assistant', content: aiReply });
  } catch (err) {
    console.error('[dmTicket] AI hata:', err.message);
    await message.author.send(
      '⚠️ Asistan şu an çevrimdışı. Sizi direkt yetkililere bağlıyorum...'
    ).catch(() => {});
    await createDMTicket(message.author, message.content.slice(0, 200), history, client);
    return;
  }

  if (isReady(aiReply)) {
    const summary = cleanAI(aiReply);
    await createDMTicket(message.author, summary, history, client);
  } else {
    const cleanReply = cleanAI(aiReply) || aiReply;
    await message.author.send(cleanReply).catch(() => {});
  }
}

// ── Evet/Hayır buton işleyici ────────────────────────────────────────────────
async function handleDMConfirmButton(interaction, client) {
  const customId = interaction.customId;

  if (!customId.startsWith('dm_confirm_yes_') && !customId.startsWith('dm_confirm_no_')) {
    return false;
  }

  const userId = interaction.user.id;
  pendingConfirmation.delete(userId);

  if (customId.startsWith('dm_confirm_no_')) {
    await interaction.update({
      content: '👍 Tamam! İstediğiniz zaman tekrar yazabilirsiniz.',
      embeds: [],
      components: [],
    }).catch(() => {});
    return true;
  }

  // Evet — AI konuşmasını başlat
  dmConversations.set(userId, []);

  await interaction.update({
    content: '✅ Harika! Sorununuzu anlatın, size yardımcı olmaya çalışacağım.',
    embeds: [],
    components: [],
  }).catch(() => {});

  return true;
}

// ── DM ticket kanalı oluştur ────────────────────────────────────────────────
async function createDMTicket(user, summary, history, client) {
  const userId = user.id;
  dmConversations.delete(userId);

  // Kullanıcıya bildir
  await user.send(
    '⏳ **Yetkiliye aktarılıyorsunuz...**\n\n' +
    'Bekleyin — yetkili size yazdığında DM üzerinden bildirim alacaksınız.'
  ).catch(() => {});

  const ticketId = generateTicketId();

  const targets = [
    { id: TARGET_GUILD_ID, categoryId: TARGET_CHANNEL_ID },
    { id: GUILD2_ID,       categoryId: GUILD2_TICKET_CATEGORY_ID },
  ];

  let createdChannel = null;
  let createdGuildId  = null;

  for (const target of targets) {
    try {
      const guild = await client.guilds.fetch(target.id).catch(() => null);
      if (!guild) continue;

      // İzinler: @everyone göremez, ManageMessages'lı roller görebilir
      const permissionOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      ];
      guild.roles.cache
        .filter(r => r.permissions.has(PermissionFlagsBits.ManageMessages) && !r.managed)
        .forEach(r => permissionOverwrites.push({
          id: r.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        }));

      // Kategori
      let parentId = null;
      if (target.categoryId) {
        const ch = await guild.channels.fetch(target.categoryId).catch(() => null);
        if (ch?.type === ChannelType.GuildCategory) parentId = ch.id;
        else if (ch?.type === ChannelType.GuildText) parentId = ch.parentId;
      }
      if (!parentId) {
        let cat = guild.channels.cache.find(
          c => c.name.toLowerCase().includes('destek') && c.type === ChannelType.GuildCategory
        );
        if (!cat) cat = await guild.channels.create({ name: 'DM TİCKETLAR', type: ChannelType.GuildCategory });
        parentId = cat.id;
      }

      const channel = await guild.channels.create({
        name: `dm-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: parentId,
        permissionOverwrites,
        topic: `DM Ticket | ${user.tag} (${userId})`,
      });

      // Konuşma geçmişi
      const convText = history
        .filter(m => m.role === 'user')
        .map(m => `> ${m.content}`)
        .join('\n')
        .slice(0, 900) || 'Mesaj yok.';

      const embed = new EmbedBuilder()
        .setColor(0x7c6af7)
        .setTitle(`📩 DM Ticket — ${ticketId}`)
        .setDescription(
          `**Kullanıcı:** <@${userId}> (${user.tag})\n` +
          `**Özet:** ${summary || '—'}\n\n` +
          `**DM Konuşması:**\n${convText}`
        )
        .addFields({
          name: '📌 Nasıl çalışır?',
          value:
            '• Bu kanala yazdığınız mesajlar kullanıcıya **DM** olarak iletilir.\n' +
            '• Kullanıcının DM yanıtları bu kanala düşer.\n' +
            '• Kapatmak için 🔒 butonuna basın.',
        })
        .setFooter({ text: `DM Ticket • ${user.tag}` })
        .setTimestamp();

      const closeBtn = buildDMCloseButton(ticketId);
      await channel.send({ embeds: [embed], components: [closeBtn] });

      if (!createdChannel) {
        createdChannel = channel;
        createdGuildId  = guild.id;
      }
    } catch (err) {
      console.warn(`[dmTicket] ${target.id} kanalı açılamadı:`, err.message);
    }
  }

  if (!createdChannel) {
    await user.send('❌ Ticket kanalı oluşturulamadı. Sunucudan destek alın.').catch(() => {});
    return;
  }

  // Ticket DB'ye kaydet
  const ticket = new Ticket({
    ticketId,
    userId,
    userName: user.username,
    category: 'dm',
    subject: (summary || 'DM destek talebi').slice(0, 100),
    description: summary || 'DM destek talebi',
    priority: 'medium',
    channelId: createdChannel.id,
    guildId: createdGuildId,
    source: 'dm',
  });
  await ticket.save();

  activeDMTickets.set(userId, {
    ticketId,
    channelId: createdChannel.id,
    guildId: createdGuildId,
  });

  console.log(`[dmTicket] ${user.tag} → DM ticket: ${ticketId}`);
}

// ── DM → Kanal iletimi ──────────────────────────────────────────────────────
async function forwardDMToChannel(message, client) {
  const userId = message.author.id;

  // Önce memory map'e bak
  let dmInfo = activeDMTickets.get(userId);

  // Map'te yoksa DB'den aç DM ticket'ı bul (bot restart sonrası)
  if (!dmInfo) {
    try {
      const ticket = await Ticket.findOne({ userId, status: 'open', source: 'dm' });
      if (ticket && ticket.channelId && ticket.guildId) {
        // Map'i yeniden doldur
        dmInfo = {
          ticketId:  ticket.ticketId,
          channelId: ticket.channelId,
          guildId:   ticket.guildId,
        };
        activeDMTickets.set(userId, dmInfo);
        console.log(`[dmTicket] DB'den yüklendi: ${ticket.ticketId}`);
      }
    } catch (err) {
      console.warn('[dmTicket] DB ticket araması hatası:', err.message);
    }
  }

  if (!dmInfo) return; // Aktif DM ticket yok

  const guild = await client.guilds.fetch(dmInfo.guildId).catch(() => null);
  if (!guild) return;

  const channel = await guild.channels.fetch(dmInfo.channelId).catch(() => null);
  if (!channel) {
    activeDMTickets.delete(userId);
    await message.author.send(
      '📭 Ticket kanalınız bulunamadı. Kapatılmış olabilir.\n' +
      'Yeni destek için tekrar yazabilirsiniz.'
    ).catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x4ade80)
    .setAuthor({ name: `${message.author.tag} (DM)`, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content || '*(ek dosya)*')
    .setFooter({ text: '📩 Kullanıcıdan DM' })
    .setTimestamp();

  const sendOpts = { embeds: [embed] };

  // Resim/dosya varsa ekle
  if (message.attachments.size > 0) {
    sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
  }

  await channel.send(sendOpts).catch(() => {});
}

// ── Kanal → DM iletimi ──────────────────────────────────────────────────────
async function forwardChannelToDM(message, client) {
  if (!message.channel.name?.startsWith('dm-')) return false;

  const channelId = message.channel.id;

  // userId'yi bul: önce memory map, yoksa channel topic'ten
  let targetUserId = null;
  for (const [uid, info] of activeDMTickets.entries()) {
    if (info.channelId === channelId) { targetUserId = uid; break; }
  }
  if (!targetUserId && message.channel.topic) {
    const m = message.channel.topic.match(/\((\d{17,20})\)/);
    if (m) targetUserId = m[1];
  }
  if (!targetUserId) return false;

  const user = await client.users.fetch(targetUserId).catch(() => null);
  if (!user) return false;

  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setAuthor({ name: `${message.author.displayName} — Yetkili`, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content)
    .setFooter({ text: 'Sentara Destek • Yetkili mesajı' })
    .setTimestamp();

  await user.send({ embeds: [embed] }).catch(() => {});
  await message.react('✅').catch(() => {});
  return true;
}

// ── DM Ticket Kapat (butona basınca) ────────────────────────────────────────
async function handleDMCloseButton(interaction, client) {
  if (!interaction.customId?.startsWith('dm_close_')) return false;

  const ticketId = interaction.customId.replace('dm_close_', '');

  // DB'den ticket bul
  const ticket = await Ticket.findOne({ ticketId }).catch(() => null);
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket bulunamadı.', ephemeral: true });
    return true;
  }
  if (ticket.status === 'closed') {
    await interaction.reply({ content: 'ℹ️ Bu ticket zaten kapalı.', ephemeral: true });
    return true;
  }

  // Ticket'ı kapat
  ticket.status  = 'closed';
  ticket.closedAt = new Date();
  ticket.closeReason = `DM ticket kapatıldı — ${interaction.user.tag}`;
  ticket.closedBy   = interaction.user.id;
  ticket.closedByName = interaction.user.username;
  await ticket.save();

  // Memory map'ten userId bul
  let targetUserId = ticket.userId;
  activeDMTickets.delete(targetUserId);
  dmConversations.delete(targetUserId);

  await interaction.reply({ content: '✅ DM Ticket kapatıldı.', ephemeral: true });

  // Kanala kapanış mesajı
  const closeEmbed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🔒 DM Ticket Kapatıldı')
    .setDescription(
      `**Kapatan:** ${interaction.user.tag}\n` +
      `⏳ Kanal 5 dakika içinde silinecek.`
    )
    .setTimestamp();

  await interaction.channel.send({ embeds: [closeEmbed] }).catch(() => {});

  // Kullanıcıya DM — kapandı + 5 yıldız hatırlatması
  try {
    const user = await client.users.fetch(targetUserId);
    const dmEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔒 Destek Talebiniz Kapatıldı')
      .setDescription(
        `Destek talebiniz **${interaction.user.username}** tarafından kapatıldı.\n\n` +
        `⭐ **Değerlendirme yapmayı unutmayın!**\n` +
        `Aldığınız hizmeti değerlendirmek için aşağıdaki butona basın.\n` +
        `5 yıldız verirseniz çok mutlu oluruz! 😊`
      )
      .setFooter({ text: 'Sentara Destek • Tekrar ihtiyaç duyarsanız bize yazın.' })
      .setTimestamp();

    const rateBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rate_ticket_${ticketId}`)
        .setLabel('⭐ Değerlendir')
        .setStyle(ButtonStyle.Primary)
    );

    await user.send({ embeds: [dmEmbed], components: [rateBtn] }).catch(() => {});
  } catch (_) {}

  // 5 dakika sonra kanalı sil
  const channelToDelete = interaction.channel;
  const channelId = channelToDelete.id;
  const guildId   = channelToDelete.guild?.id;

  setTimeout(async () => {
    try {
      // Kanalı yeniden fetch et (restart veya cache sıfırlamasına karşı)
      if (guildId) {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          const ch = await guild.channels.fetch(channelId).catch(() => null);
          if (ch) {
            await ch.delete('DM Ticket kapatıldı — 5 dk sonra silindi');
            console.log(`[dmTicket] Kanal silindi: ${channelId}`);
          }
        }
      } else {
        await channelToDelete.delete('DM Ticket kapatıldı').catch(() => {});
      }
    } catch (err) {
      console.warn('[dmTicket] Kanal silinemedi:', err.message);
    }
  }, 5 * 60 * 1000);

  return true;
}

module.exports = {
  handleDMMessage,
  handleDMConfirmButton,
  forwardChannelToDM,
  handleDMCloseButton,
  activeDMTickets,
};
