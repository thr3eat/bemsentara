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
        `Talebi kapatmak isterseniz aşağıdaki butonu kullanabilirsiniz.`
      )
      .setColor(0x3498DB)
      .setTimestamp();

    const rowUser = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_ticket_${ticketId}`)
        .setLabel("E-POSTA TALEBİNİ KAPAT")
        .setStyle(ButtonStyle.Danger)
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
        `• Ticket'ı üstlenmek için aşağıdaki butona basın.`
      )
      .setColor(0xF1C40F)
      .setTimestamp();

    const rowMod = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_ticket_${ticketId}`)
        .setLabel("🔒 Ticket'ı Kapat")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`claim_ticket_${ticketId}`)
        .setLabel("🙋‍♂️ Üstlen")
        .setStyle(ButtonStyle.Success)
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
 * Forwards user message in their eposta channel to the moderation channel
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
    .setFooter({ text: '📩 Kullanıcının Posta Kutusu' })
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
 * Forwards moderator message in moderator channel to user eposta channel
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
    .setFooter({ text: 'Eko Yıldız Destek Ekibi' })
    .setTimestamp();

  const sendOpts = { embeds: [embed] };
  if (message.attachments.size > 0) {
    sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
  }

  await targetChannel.send(sendOpts).catch(() => {});
  await message.react('✅').catch(() => {});
  return true;
}

module.exports = {
  handleEpostaSupportSelect,
  triggerEpostaFormModal,
  handleEpostaModalSubmit,
  forwardUserToModChannel,
  forwardModToUserChannel
};
