'use strict';

const { PermissionFlagsBits } = require("discord.js");
const StaffProgress = require("../../models/StaffProgress");
const { renderPanel } = require("../services/mainPanelService");

async function handlePanelSlashCommand(interaction) {
  // Defer reply as ephemeral for privacy and responsiveness
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  try {
    const allowedUsers = ["1031620522406072350", "1492888195807969510"];
    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.editReply({ content: "❌ Bu paneli kullanmaya yetkiniz bulunmamaktadır!" });
    }

    // Load initial home panel screen
    return renderPanel(interaction, "home");
  } catch (error) {
    console.error("[panelCommandHandler] Error:", error);
    return interaction.editReply({ content: `❌ Paneli yüklerken bir hata oluştu: ${error.message}` });
  }
}

module.exports = { handlePanelSlashCommand };
