const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Ticket = require("../../models/Ticket");
const {
  getSupportMenuEmbed,
  getCategorySelectMenu,
  buildCloseReasonModal,
  buildRatingModal,
  buildCloseButton,
} = require("../embeds");
const { BASE_URL } = require("../../config");

async function handleButtonInteraction(interaction) {
  // ── Doğrulama yardım butonu ──────────────────────────────────────────────
  if (interaction.customId === "verify_help_refresh") {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📋 Komut Özeti")
      .setDescription(
        "**`/authorize`** — Roblox hesabını bağla\n" +
          "**`/verify`** — İlk rol doğrulaması (gizli)\n" +
          "**`/update`** — Rolleri yeniden senkronize et\n\n" +
          `🌐 Web: [${BASE_URL}/dashboard](${BASE_URL}/dashboard)`
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── Destek menüsü butonu ─────────────────────────────────────────────────
  if (interaction.customId === "open_support_menu") {
    const embed = getSupportMenuEmbed();
    const selectMenu = getCategorySelectMenu();
    return interaction.reply({ embeds: [embed], components: [selectMenu], ephemeral: true });
  }

  // ── Ticket kapat butonu → sebep modal'ı aç ──────────────────────────────
  if (interaction.customId.startsWith("close_ticket_")) {
    const ticketId = interaction.customId.replace("close_ticket_", "");
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
    }

    if (ticket.status === "closed") {
      return interaction.reply({ content: "❌ Bu ticket zaten kapalı", ephemeral: true });
    }

    if (
      ticket.userId !== interaction.user.id &&
      !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
    ) {
      return interaction.reply({ content: "❌ Bunu yapmaya yetkili değilsiniz", ephemeral: true });
    }

    // Kapatma sebebini soran modal'ı göster
    const modal = buildCloseReasonModal(ticketId);
    return interaction.showModal(modal);
  }

  // ── Ticket tekrar aç butonu ──────────────────────────────────────────────
  if (interaction.customId.startsWith("reopen_ticket_")) {
    const ticketId = interaction.customId.replace("reopen_ticket_", "");
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
    }

    if (ticket.status === "open") {
      return interaction.reply({ content: "❌ Bu ticket zaten açık", ephemeral: true });
    }

    if (ticket.userId !== interaction.user.id) {
      return interaction.reply({ content: "❌ Bu ticket size ait değil", ephemeral: true });
    }

    // Kanalı bul ve izinleri geri ver
    try {
      const guild = await interaction.client.guilds.fetch(
        require("../../config").TARGET_GUILD_ID
      );
      const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);

      if (channel) {
        await channel.permissionOverwrites.edit(ticket.userId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });

        const reopenEmbed = new EmbedBuilder()
          .setTitle("🔓 Ticket Yeniden Açıldı")
          .setDescription(`<@${ticket.userId}> tarafından yeniden açıldı.`)
          .setColor(0x4ade80)
          .setTimestamp();

        const closeButton = buildCloseButton(ticketId);
        await channel.send({ embeds: [reopenEmbed], components: [closeButton] });
      }

      ticket.status = "open";
      ticket.closedAt = null;
      ticket.closeReason = null;
      await ticket.save();

      // Silme kuyruğunu iptal et
      const { cancelTicketDeletion } = require("../services/ticketCleanup");
      cancelTicketDeletion(ticketId);

      return interaction.reply({
        content: "✅ Ticket yeniden açıldı.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("[reopen_ticket] Hata:", err);
      return interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
    }
  }

  // ── Değerlendirme butonu → rating modal'ı aç ────────────────────────────
  if (interaction.customId.startsWith("rate_ticket_")) {
    const ticketId = interaction.customId.replace("rate_ticket_", "");
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

    const modal = buildRatingModal(ticketId);
    return interaction.showModal(modal);
  }

  return null;
}

module.exports = { handleButtonInteraction };
