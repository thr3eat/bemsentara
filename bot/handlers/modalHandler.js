const {
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Ticket = require("../../models/Ticket");
const { generateTicketId } = require("../../utils/ticketId");
const { SUPPORT_CATEGORIES, TARGET_GUILD_ID, TARGET_CHANNEL_ID } = require("../../config");
const {
  buildTicketEmbed,
  buildCloseButton,
  buildReopenAndRateRow,
} = require("../embeds");

async function handleModalSubmit(interaction) {
  // ── Ticket oluşturma modal'ı ─────────────────────────────────────────────
  if (interaction.customId.startsWith("support_modal_")) {
    return handleSupportModal(interaction);
  }

  // ── Ticket kapatma sebebi modal'ı ────────────────────────────────────────
  if (interaction.customId.startsWith("close_reason_modal_")) {
    return handleCloseReasonModal(interaction);
  }

  // ── Değerlendirme modal'ı ────────────────────────────────────────────────
  if (interaction.customId.startsWith("rating_modal_")) {
    return handleRatingModal(interaction);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Yeni ticket oluşturma
// ─────────────────────────────────────────────────────────────────────────────
async function handleSupportModal(interaction) {
  const category = interaction.customId.replace("support_modal_", "");
  const subject = interaction.fields.getTextInputValue("support_subject");
  const description = interaction.fields.getTextInputValue("support_description");
  let priority = interaction.fields.getTextInputValue("support_priority") || "medium";

  if (!["low", "medium", "high"].includes(priority)) {
    priority = "medium";
  }

  try {
    const ticketId = generateTicketId();
    const targetGuild = await interaction.client.guilds.fetch(TARGET_GUILD_ID);
    if (!targetGuild) throw new Error("Hedef sunucu bulunamadı.");

    const configuredChannel = TARGET_CHANNEL_ID
      ? await targetGuild.channels.fetch(TARGET_CHANNEL_ID).catch(() => null)
      : null;

    let ticketChannel;
    const permissionOverwrites = [
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
      },
    ];

    if (configuredChannel?.type === ChannelType.GuildCategory) {
      ticketChannel = await targetGuild.channels.create({
        name: `ticket-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: configuredChannel.id,
        permissionOverwrites,
      });
    } else if (configuredChannel?.type === ChannelType.GuildText) {
      ticketChannel = await targetGuild.channels.create({
        name: `ticket-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: configuredChannel.parentId,
        permissionOverwrites,
      });
    } else {
      let ticketCategory = targetGuild.channels.cache.find(
        (c) => c.name.toLowerCase() === "destek talepleri" && c.type === ChannelType.GuildCategory
      );

      if (!ticketCategory) {
        ticketCategory = await targetGuild.channels.create({
          name: "DESTEK TALEPLERİ",
          type: ChannelType.GuildCategory,
        });
      }

      ticketChannel = await targetGuild.channels.create({
        name: `ticket-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites,
      });
    }

    const ticket = new Ticket({
      ticketId,
      userId: interaction.user.id,
      userName: interaction.user.username,
      category,
      subject,
      description,
      priority,
      channelId: ticketChannel.id,
    });

    await ticket.save();

    const ticketEmbed = buildTicketEmbed(ticket);
    const closeButton = buildCloseButton(ticketId);
    await ticketChannel.send({ embeds: [ticketEmbed], components: [closeButton] });

    const { logTicketCreated } = require("../services/ticketLog");
    logTicketCreated(ticket, {
      source: "Discord Destek Menüsü",
      ticketChannelId: ticketChannel.id,
    });

    return interaction.reply({ content: `✅ Ticket oluşturuldu: ${ticketChannel}`, ephemeral: true });
  } catch (err) {
    console.error("Ticket oluşturma hatası:", err);
    return interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticket kapatma sebebi işleme
// ─────────────────────────────────────────────────────────────────────────────
async function handleCloseReasonModal(interaction) {
  const ticketId = interaction.customId.replace("close_reason_modal_", "");
  const reason = interaction.fields.getTextInputValue("close_reason");

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
  }

  if (ticket.status === "closed") {
    return interaction.reply({ content: "❌ Bu ticket zaten kapalı", ephemeral: true });
  }

  // Ticket'ı kapat
  ticket.status = "closed";
  ticket.closedAt = new Date();
  ticket.closeReason = reason;
  ticket.closedBy = interaction.user.id;
  ticket.closedByName = interaction.user.username;
  await ticket.save();

  // Önce etkileşimi onayla
  await interaction.reply({ content: "✅ Ticket kapatılıyor...", ephemeral: true });

  try {
    const guild = await interaction.client.guilds.fetch(TARGET_GUILD_ID);
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);

    // 1) Kanal mesajlarını log kanalına gönder
    const { logTicketClosed, logTicketMessages } = require("../services/ticketLog");

    if (channel) {
      await logTicketMessages(channel, ticket);
    }

    // 2) Ticket kapanma kaydını log kanalına gönder
    logTicketClosed(ticket, {
      closedBy: interaction.user.id,
      closedByName: interaction.user.username,
      reason,
      source: "Discord Kapat Butonu",
    });

    // 3) Ticket sahibine DM gönder
    try {
      const ticketOwner = await interaction.client.users.fetch(ticket.userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🔒 Ticket'ınız Kapatıldı")
        .setDescription(
          `Ticket'ınız **${interaction.user.username}** adlı kişi tarafından kapatıldı.\n\n` +
            `**Sebep:** ${reason}\n\n` +
            `Ticket'ı yeniden açmak veya destek ekibini değerlendirmek için aşağıdaki butonları kullanabilirsiniz.`
        )
        .addFields(
          { name: "🎫 Ticket ID", value: `\`${ticket.ticketId}\``, inline: true },
          { name: "📋 Konu", value: ticket.subject, inline: true }
        )
        .setFooter({ text: "Sentara Support • Gizlilik politikamız gereği değerlendirme notunuz anonim tutulur." })
        .setTimestamp();

      const dmButtons = buildReopenAndRateRow(ticketId);
      await ticketOwner.send({ embeds: [dmEmbed], components: [dmButtons] });
    } catch (dmErr) {
      console.warn("[closeTicket] Kullanıcıya DM gönderilemedi:", dmErr.message);
    }

    // 4) Kanalı kapat (izinleri kaldır ve kapatıldı mesajı gönder)
    if (channel) {
      const closeEmbed = new EmbedBuilder()
        .setTitle("🔒 Ticket Kapatıldı")
        .setDescription(
          `**Kapatan:** ${interaction.user.username}\n**Sebep:** ${reason}`
        )
        .setColor(0xed4245)
        .setTimestamp();

      await channel.send({ embeds: [closeEmbed] });
      await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: false,
        SendMessages: false,
      });
    }
  } catch (err) {
    console.error("[closeTicket] Hata:", err);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Değerlendirme modal'ı işleme
// ─────────────────────────────────────────────────────────────────────────────
async function handleRatingModal(interaction) {
  const ticketId = interaction.customId.replace("rating_modal_", "");
  const rawScore = interaction.fields.getTextInputValue("rating_score").trim();
  const note = interaction.fields.getTextInputValue("rating_note").trim() || null;

  const score = parseInt(rawScore, 10);
  if (isNaN(score) || score < 1 || score > 5) {
    return interaction.reply({
      content: "❌ Geçersiz puan. Lütfen 1 ile 5 arasında bir sayı girin.",
      ephemeral: true,
    });
  }

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
  }

  if (ticket.userId !== interaction.user.id) {
    return interaction.reply({ content: "❌ Bu ticket size ait değil", ephemeral: true });
  }

  if (ticket.rated) {
    return interaction.reply({ content: "❌ Bu ticket'ı zaten değerlendirdiniz", ephemeral: true });
  }

  // Değerlendirmeyi kaydet
  ticket.rated = true;
  ticket.ratingScore = score;
  ticket.ratingNote = note;
  await ticket.save();

  // Ticket'ı üstlenen kişiye DM gönder (closedBy veya claimedBy)
  const staffId = ticket.claimedBy || ticket.closedBy;
  if (staffId) {
    try {
      const staffUser = await interaction.client.users.fetch(staffId);
      const stars = "⭐".repeat(score) + "☆".repeat(5 - score);

      const ratingEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("⭐ Yeni Bir Değerlendirme Aldınız!")
        .setDescription(
          `**Ticket:** \`${ticket.ticketId}\`\n` +
            `**Konu:** ${ticket.subject}\n\n` +
            `**Puan:** ${stars} (${score}/5)\n` +
            (note ? `**Değerlendirme Notu:** ${note}` : "")
        )
        .setFooter({
          text: "Sentara Support • Gizlilik politikamız gereği puan veren kişinin adı paylaşılmaz.",
        })
        .setTimestamp();

      await staffUser.send({ embeds: [ratingEmbed] });
    } catch (dmErr) {
      console.warn("[ratingModal] Personele DM gönderilemedi:", dmErr.message);
    }
  }

  // Kullanıcıya onay
  const stars = "⭐".repeat(score) + "☆".repeat(5 - score);
  return interaction.reply({
    content: `✅ Değerlendirmeniz alındı! ${stars} (${score}/5)\nTeşekkür ederiz.`,
    ephemeral: true,
  });
}

module.exports = { handleModalSubmit };
