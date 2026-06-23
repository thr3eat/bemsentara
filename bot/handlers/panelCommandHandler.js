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
    const isOwner = interaction.user.id === "1031620522406072350";
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isManager = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
    const isMod = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) || 
                  interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers);

    // Also check if they are active staff in database
    const staff = await StaffProgress.findOne({ userId: interaction.user.id });
    const isStaff = staff && staff.status === 'active';

    if (!isOwner && !isAdmin && !isManager && !isMod && !isStaff) {
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
