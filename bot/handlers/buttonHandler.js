const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Ticket = require("../../models/Ticket");
const { getSupportMenuEmbed, getCategorySelectMenu } = require("../embeds");

async function handleButtonInteraction(interaction) {
  if (interaction.customId === "verify_help_refresh") {
    const { BASE_URL } = require("../../config");
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

  if (interaction.customId === "open_support_menu") {
    const embed = getSupportMenuEmbed();
    const selectMenu = getCategorySelectMenu();
    return interaction.reply({ embeds: [embed], components: [selectMenu], ephemeral: true });
  }

  if (interaction.customId.startsWith("close_ticket_")) {
    const ticketId = interaction.customId.replace("close_ticket_", "");
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
    }

    if (
      ticket.userId !== interaction.user.id &&
      !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
    ) {
      return interaction.reply({ content: "❌ Bunu yapmaya yetkili değilsiniz", ephemeral: true });
    }

    ticket.status = "closed";
    ticket.closedAt = new Date();
    await ticket.save();

    const { logTicketClosed } = require("../services/ticketLog");
    logTicketClosed(ticket, {
      closedBy: interaction.user.id,
      closedByName: interaction.user.username,
      source: "Discord Kapat Butonu",
    });

    const channel = await interaction.guild.channels.fetch(ticket.channelId);
    if (channel) {
      const closeEmbed = new EmbedBuilder()
        .setTitle("🔒 Ticket Kapatıldı")
        .setDescription(`Bu ticket kapatılmıştır.`)
        .setColor(0xed4245)
        .setTimestamp();

      await channel.send({ embeds: [closeEmbed] });
      await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: false,
        SendMessages: false,
      });
    }

    return interaction.reply({ content: "✅ Ticket kapatıldı", ephemeral: true });
  }

  return null;
}

module.exports = { handleButtonInteraction };
