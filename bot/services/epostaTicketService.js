'use strict';

const {
  EmbedBuilder, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const Ticket = require('../../models/Ticket');
const { generateTicketId } = require('../../utils/ticketId');
const { GUILD2_ID, GUILD2_TICKET_CATEGORY_ID } = require('../../config');
const { ROLES } = require('./staffSystem');
const { startTicketClaimRouting } = require('./reklamTicketService');

/**
 * Handles support category select menu interception for kullanici_destek and diger_destek on Eko Yildiz
 */
async function handleEpostaSupportSelect(interaction, category) {
  const categoryNames = {
    kullanici_destek: "Kullanıcı Destek",
    diger_destek: "Diğer Destek"
  };
  const categoryName = categoryNames[category] || "Destek";

  const mailEmbed = new EmbedBuilder()
    .setTitle(`📨 E-POSTA ALICISI: Eko Yıldız ${categoryName} Departmanı`)
    .setDescription(
      `**Eko Yıldız ${categoryName} Hizmetlerine Hoş Geldiniz!**\n\n` +
      "Sanki yeni bir resmi e-posta yazıyormuş gibi aşağıdaki butona tıklayarak Destek Talep Formu'nu doldurun.\n\n" +
      "📝 **Sistem Durumu:** Çevrimiçi\n" +
      "📧 **Departman:** Müşteri Memnuniyeti & Destek"
    )
    .setColor(0x3498DB)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ekoyildiz_eposta_form_button_${category}`)
      .setLabel("Yeni Destek Talebi")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📨")
  );

  return interaction.reply({ embeds: [mailEmbed], components: [row], ephemeral: true });
}

/**
 * Shows the form modal when they click the button
 */
async function triggerEpostaFormModal(interaction, category) {
  const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require("discord.js");
  const modal = new ModalBuilder()
    .setCustomId(`ekoyildiz_eposta_form_modal_${category}`)
    .setTitle("Destek E-Postası Gönder");

  const subjectInput = new TextInputBuilder()
    .setCustomId("eposta_konu")
    .setLabel("E-Posta Konusu (Kısa Başlık)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Örn: Rütbe sorunu / Hata bildirim")
    .setRequired(true);

  const detailInput = new TextInputBuilder()
    .setCustomId("eposta_detay")
    .setLabel("E-Posta İçeriği (Detaylı Açıklama)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Talebinizi, sorununuzu veya şikayetinizi detaylıca buraya yazın.")
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(subjectInput),
    new ActionRowBuilder().addComponents(detailInput)
  );

  return interaction.showModal(modal);
}

/**
 * Handles submit of the e-posta support modal
 */
async function handleEpostaModalSubmit(interaction, category) {
  const subject = interaction.fields.getTextInputValue("eposta_konu").trim();
  const description = interaction.fields.getTextInputValue("eposta_detay").trim();

  await interaction.reply({
    content: "📬 **Talebiniz alındı!** Sizin için özel bir e-posta kutusu kanalı oluşturuluyor. Lütfen sol taraftaki kanalları kontrol edin.",
    ephemeral: true
  });

  const ticketId = generateTicketId();

  try {
    const targetGuild = await interaction.client.guilds.fetch(GUILD2_ID);
    if (!targetGuild) throw new Error("Eko Yıldız sunucusu bulunamadı.");

    // Channel A: User's Private Mail Channel (NO MODERATORS ALLOWED)
    const userPermissions = [
      { id: targetGuild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      }
    ];

    const channelA = await targetGuild.channels.create({
      name: `eposta-${interaction.user.username.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: GUILD2_TICKET_CATEGORY_ID || undefined,
      permissionOverwrites: userPermissions,
    });

    // Channel B: Moderators' Support Channel (NO USER ALLOWED)
    const modPermissions = [
      { id: targetGuild.id, deny: [PermissionFlagsBits.ViewChannel] }
    ];
    for (const roleId of Object.values(ROLES)) {
      if (roleId && targetGuild.roles.cache.has(roleId)) {
        modPermissions.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }
    }

    const channelB = await targetGuild.channels.create({
      name: `ticket-${ticketId.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: GUILD2_TICKET_CATEGORY_ID || undefined,
      permissionOverwrites: modPermissions,
    });

    // Save ticket in DB
    const ticket = new Ticket({
      ticketId,
      userId: interaction.user.id,
      userName: interaction.user.username,
      category,
      subject,
      description,
      channelId: channelB.id,
      userChannelId: channelA.id,
      status: 'open',
      guildId: GUILD2_ID,
      source: 'eposta',
    });
    await ticket.save();

    // Welcome embed in Channel A (User mailbox)
    const userEmbed = new EmbedBuilder()
      .setTitle("📨 GÖNDERİLEN E-POSTA KUTUSU")
      .setDescription(
        `Merhaba <@${interaction.user.id}>,\n` +
        `Destek talebiniz için oluşturulmuş özel e-posta kutusundasınız.\n\n` +
        `🔹 **Talep Konusu:** ${subject}\n` +
        `🔹 **Açıklama:** ${description}\n\n` +
        `💬 **Nasıl Çalışır?**\n` +
        `Bu kanala yazdığınız her şey doğrudan destek ekibimize iletilir. Yetkililerimizin cevapları da buraya e-posta biçiminde düşer.\n\n` +
        `İşlemleri yönetmek için aşağıdaki gerçekçi butonları kullanabilirsiniz.`
      )
      .setColor(0x3498DB)
      .setTimestamp();

    const rowUser = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_ticket_${ticketId}`)
        .setLabel("🔒 E-Postayı Arşivle (Kapat)")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`eposta_scan_${ticketId}`)
        .setLabel("🛡️ Güvenlik Taraması")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`eposta_print_${ticketId}`)
        .setLabel("🖨️ Yazıcıdan Çıkart")
        .setStyle(ButtonStyle.Secondary)
    );

    await channelA.send({ embeds: [userEmbed], components: [rowUser] });

    // Welcome embed in Channel B (Mod view)
    const modEmbed = new EmbedBuilder()
      .setTitle(`🎫 E-Posta Destek Talebi — ${ticketId}`)
      .setDescription(
        `👤 **Kullanıcı:** <@${interaction.user.id}> (${interaction.user.username})\n` +
        `📋 **Konu:** ${subject}\n` +
        `📝 **Açıklama:** ${description}\n\n` +
        `📌 **Yetkili Paneli:**\n` +
        `• Bu kanala yazacağınız her mesaj kullanıcının özel e-posta kanalına iletilir.\n` +
        `• Kullanıcının kendi kanalına yazdığı mesajlar buraya düşer.\n` +
        `• Ticket'ı yönetmek için aşağıdaki RP paneli butonlarını kullanabilirsiniz.`
      )
      .setColor(0xF1C40F)
      .setTimestamp();

    const rowMod = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_ticket_${ticketId}`)
        .setLabel("📦 Arşive Taşı (Kapat)")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`claim_ticket_${ticketId}`)
        .setLabel("🙋‍♂️ Üstlen")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`eposta_print_${ticketId}`)
        .setLabel("🖨️ E-Postayı Yazdır")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`eposta_spam_${ticketId}`)
        .setLabel("⚠️ Spam Rapor Et")
        .setStyle(ButtonStyle.Secondary)
    );

    await channelB.send({ embeds: [modEmbed], components: [rowMod] });

    // Start claim routing for active staff members
    await startTicketClaimRouting(ticket, targetGuild, interaction.client).catch(err => {
      console.error("[epostaTicketService] Claim routing failed:", err.message);
    });

  } catch (err) {
    console.error("[epostaTicketService] Support setup failed:", err.message);
  }
}

/**
 * Forwards user message in their eposta channel to the moderation channel (SADE İLETİM)
 */
async function forwardUserToModChannel(message, client) {
  const channelId = message.channel.id;
  const ticket = await Ticket.findOne({ userChannelId: channelId, status: 'open' });
  if (!ticket) return false;

  const targetChannel = await client.channels.fetch(ticket.channelId).catch(() => null);
  if (!targetChannel) return false;

  let replyText = null;
  if (message.reference && message.reference.messageId) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (refMsg) {
        const embed = refMsg.embeds?.[0];
        const content = embed ? (embed.description || embed.title) : refMsg.content;
        replyText = content ? (content.length > 100 ? content.slice(0, 100) + '...' : content) : '*(ek dosya)*';
      }
    } catch (_) {}
  }

  const embed = new EmbedBuilder()
    .setColor(0x4ade80)
    .setAuthor({ name: `${message.author.tag} (E-Posta)`, iconURL: message.author.displayAvatarURL() })
    .setDescription((replyText ? `↩️ **Cevaplanan Mesaj:** *"${replyText}"*\n\n` : '') + (message.content || '*(ek dosya)*'))
    .setFooter({ text: '📩 EkoMail Gateway' })
    .setTimestamp();

  const sendOpts = { embeds: [embed] };
  if (message.attachments.size > 0) {
    sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
  }

  await targetChannel.send(sendOpts).catch(() => {});
  await message.react('✅').catch(() => {});
  return true;
}

/**
 * Forwards moderator message in moderator channel to user eposta channel (SADE İLETİM)
 */
async function forwardModToUserChannel(message, client) {
  const channelId = message.channel.id;
  const ticket = await Ticket.findOne({ channelId, status: 'open' });
  if (!ticket || !ticket.userChannelId) return false;

  const targetChannel = await client.channels.fetch(ticket.userChannelId).catch(() => null);
  if (!targetChannel) return false;

  let replyText = null;
  if (message.reference && message.reference.messageId) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (refMsg) {
        const embed = refMsg.embeds?.[0];
        const content = embed ? (embed.description || embed.title) : refMsg.content;
        replyText = content ? (content.length > 100 ? (content.includes('Cevaplanan Mesaj:') ? content.split('\n\n').slice(1).join('\n\n') : content).slice(0, 100) + '...' : content) : '*(ek dosya)*';
      }
    } catch (_) {}
  }

  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setAuthor({ name: `${message.author.displayName} — Yetkili`, iconURL: message.author.displayAvatarURL() })
    .setDescription((replyText ? `↩️ **Cevaplanan Mesajınız:** *"${replyText}"*\n\n` : '') + (message.content || '*(ek dosya)*'))
    .setFooter({ text: 'Eko Yıldız Müşteri Hizmetleri' })
    .setTimestamp();

  const sendOpts = { embeds: [embed] };
  if (message.attachments.size > 0) {
    sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
  }

  await targetChannel.send(sendOpts).catch(() => {});
  await message.react('✅').catch(() => {});
  return true;
}

async function archiveEkoYildizTicket(ticket, interaction, reason) {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
  const guild = await interaction.client.guilds.fetch(ticket.guildId);
  const archiveCategoryId = "1525218080068730991";

  // 1. Archive Moderator Channel (ticket-)
  const modChannel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (modChannel) {
    await modChannel.setParent(archiveCategoryId, { lockPermissions: false }).catch(() => {});
    
    const modClosedEmbed = new EmbedBuilder()
      .setTitle("📦 Ticket Arşive Taşındı")
      .setDescription(
        `**Arşivleyen:** ${interaction.user.username}\n` +
        `**Sebep:** ${reason || 'Belirtilmedi'}\n\n` +
        `📌 **Kontroller:**\n` +
        `• Yetkililer bu talebi yeniden açabilir.\n` +
        `• "Yeniden Açılışı Engelle" butonuna basarak kullanıcının bu talebi kendi başına açmasını önleyebilirsiniz.`
      )
      .setColor(0x7f8c8d)
      .setTimestamp();

    const rowMod = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reopen_ticket_${ticket.ticketId}`)
        .setLabel("🔓 Yeniden Aç")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`eposta_lock_reopen_${ticket.ticketId}`)
        .setLabel("🚫 Yeniden Açılışı Engelle")
        .setStyle(ButtonStyle.Danger)
    );

    await modChannel.send({ embeds: [modClosedEmbed], components: [rowMod] });
  }

  // 2. Archive User Channel (eposta-)
  if (ticket.userChannelId) {
    const userChannel = await guild.channels.fetch(ticket.userChannelId).catch(() => null);
    if (userChannel) {
      await userChannel.setParent(archiveCategoryId, { lockPermissions: false }).catch(() => {});
      
      // Make channel read-only for user
      await userChannel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: false,
      }).catch(() => {});

      if (ticket.additionalUsers) {
        for (const addUserId of ticket.additionalUsers) {
          await userChannel.permissionOverwrites.edit(addUserId, {
            ViewChannel: true,
            SendMessages: false,
          }).catch(() => {});
        }
      }
    }
  }

  // 3. Archive additional users private channels if they exist
  if (ticket.additionalChannels) {
    for (const chanId of ticket.additionalChannels) {
      const extraChan = await guild.channels.fetch(chanId).catch(() => null);
      if (extraChan) {
        await extraChan.setParent(archiveCategoryId, { lockPermissions: false }).catch(() => {});
        // Get username from channel name
        const match = extraChan.name.match(/eposta-(.+)/);
        if (match) {
          const targetMember = guild.members.cache.find(m => m.user.username.toLowerCase() === match[1]);
          if (targetMember) {
            await extraChan.permissionOverwrites.edit(targetMember.id, {
              ViewChannel: true,
              SendMessages: false,
            }).catch(() => {});
          }
        }
      }
    }
  }

  // Welcomes reopen embed in User Channel (Channel A)
  if (ticket.userChannelId) {
    const userChannel = await guild.channels.fetch(ticket.userChannelId).catch(() => null);
    if (userChannel) {
      const userClosedEmbed = new EmbedBuilder()
        .setTitle("🔒 E-Posta Talebiniz Arşivlendi")
        .setDescription(
          `Bu destek talebi başarıyla arşivlenmiştir.\n\n` +
          `💬 **Tarihçe:** Bu kanaldaki geçmiş e-postaları okumaya devam edebilirsiniz.\n` +
          `🔄 **Yeniden Açma:** İhtiyacınız olduğunda aşağıdaki butona tıklayarak talebi tekrar aktif hale getirebilirsiniz.`
        )
        .setColor(0x95a5a6)
        .setTimestamp();

      const rowUser = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reopen_ticket_${ticket.ticketId}`)
          .setLabel("🔄 Yeniden Aç")
          .setStyle(ButtonStyle.Primary)
      );

      await userChannel.send({ embeds: [userClosedEmbed], components: [rowUser] });
    }
  }

  // For Reklam tickets:
  if (ticket.category === 'reklam_destek') {
    const reklamChannel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (reklamChannel) {
      await reklamChannel.setParent(archiveCategoryId, { lockPermissions: false }).catch(() => {});
      
      await reklamChannel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: false,
      }).catch(() => {});

      const reklamClosedEmbed = new EmbedBuilder()
        .setTitle("🔒 Reklam Talebi Arşivlendi")
        .setDescription(
          `Bu reklam destek talebi arşive taşınmıştır.\n\n` +
          `🔄 Yeniden açmak isterseniz aşağıdaki butona tıklayabilirsiniz.`
        )
        .setColor(0x95a5a6)
        .setTimestamp();

      const rowReklam = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reopen_ticket_${ticket.ticketId}`)
          .setLabel("🔄 Yeniden Aç")
          .setStyle(ButtonStyle.Primary)
      );

      await reklamChannel.send({ embeds: [reklamClosedEmbed], components: [rowReklam] });
    }
  }
}

async function reopenEkoYildizTicket(ticket, interaction) {
  const { EmbedBuilder } = require("discord.js");
  const guild = await interaction.client.guilds.fetch(ticket.guildId);
  const ticketCategoryId = "1518716275239551046";

  // Reopen User Channel
  if (ticket.userChannelId) {
    const userChannel = await guild.channels.fetch(ticket.userChannelId).catch(() => null);
    if (userChannel) {
      await userChannel.setParent(ticketCategoryId, { lockPermissions: false }).catch(() => {});
      
      // Allow user to send messages again
      await userChannel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: true,
      }).catch(() => {});

      if (ticket.additionalUsers) {
        for (const addUserId of ticket.additionalUsers) {
          await userChannel.permissionOverwrites.edit(addUserId, {
            ViewChannel: true,
            SendMessages: true,
          }).catch(() => {});
        }
      }

      await userChannel.send("🔄 **E-Posta Talebi Yeniden Açıldı.** Artık yazmaya devam edebilirsiniz.");
    }
  }

  // Reopen all additional users private channels if they exist
  if (ticket.additionalChannels) {
    for (const chanId of ticket.additionalChannels) {
      const extraChan = await guild.channels.fetch(chanId).catch(() => null);
      if (extraChan) {
        await extraChan.setParent(ticketCategoryId, { lockPermissions: false }).catch(() => {});
        const match = extraChan.name.match(/eposta-(.+)/);
        if (match) {
          const targetMember = guild.members.cache.find(m => m.user.username.toLowerCase() === match[1]);
          if (targetMember) {
            await extraChan.permissionOverwrites.edit(targetMember.id, {
              ViewChannel: true,
              SendMessages: true,
            }).catch(() => {});
          }
        }
        await extraChan.send("🔄 **E-Posta Talebi Yeniden Açıldı.** Artık yazmaya devam edebilirsiniz.");
      }
    }
  }

  // Reopen Mod/Staff Channel
  const modChannel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (modChannel) {
    await modChannel.setParent(ticketCategoryId, { lockPermissions: false }).catch(() => {});
    await modChannel.send(`🔄 **Ticket Yeniden Açıldı.** (Açan: ${interaction.user.username})`);
  }

  // Reopen Reklam Channel (if reklam ticket)
  if (ticket.category === 'reklam_destek') {
    const reklamChannel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (reklamChannel) {
      await reklamChannel.setParent(ticketCategoryId, { lockPermissions: false }).catch(() => {});
      await reklamChannel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: true,
      }).catch(() => {});
      await reklamChannel.send("🔄 **Reklam Talebi Yeniden Açıldı.** Artık yazmaya devam edebilirsiniz.");
    }
  }

  // Update DB status
  ticket.status = 'open';
  ticket.closedAt = null;
  ticket.closeReason = null;
  await ticket.save();
}

module.exports = {
  handleEpostaSupportSelect,
  triggerEpostaFormModal,
  handleEpostaModalSubmit,
  forwardUserToModChannel,
  forwardModToUserChannel,
  archiveEkoYildizTicket,
  reopenEkoYildizTicket
};
