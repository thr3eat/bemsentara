'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const crypto = require("crypto");

/**
 * Saves error details and returns a button component to report it.
 */
async function saveErrorAndGetButton(error, context, guildId, userId) {
  try {
    const errorId = "err_" + crypto.randomBytes(4).toString("hex");
    const errorData = {
      _id: errorId,
      errorName: error.name || "Error",
      errorMessage: error.message || String(error),
      errorStack: error.stack || null,
      context: context || "Unknown Context",
      guildId: guildId || null,
      userId: userId || null,
      reported: false,
      timestamp: new Date()
    };
    
    // Save to errorReports
    const ErrorReportModel = require("../../models/ErrorReport");
    await ErrorReportModel.create(errorData);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`report_err_${errorId}`)
        .setLabel("⚠️ BU HATAYI GERİ BİLDİR")
        .setStyle(ButtonStyle.Danger)
    );
    
    return { errorId, row };
  } catch (err) {
    console.error("[ErrorReporter] saveErrorAndGetButton error:", err.message);
    return null;
  }
}

/**
 * Helper to reply or edit replies with the error report button
 */
async function sendErrorReplyWithButton(interaction, error, context) {
  try {
    const guildId = interaction.guild?.id || null;
    const userId = interaction.user?.id || interaction.author?.id || null;
    
    const result = await saveErrorAndGetButton(error, context, guildId, userId);
    
    const content = `❌ **Bir hata oluştu!**\n> \`${error.message || String(error)}\`\n\nLütfen aşağıdaki butona tıklayarak hatayı geliştirici ekibine bildirin.`;
    
    if (interaction.replied || interaction.deferred) {
      if (result) {
        await interaction.editReply({ content, components: [result.row] }).catch(() => {});
      } else {
        await interaction.editReply({ content, components: [] }).catch(() => {});
      }
    } else {
      const payload = { content, ephemeral: true };
      if (result) payload.components = [result.row];
      
      if (typeof interaction.reply === "function") {
        await interaction.reply(payload).catch(() => {});
      } else if (interaction.channel && typeof interaction.channel.send === "function") {
        await interaction.channel.send({ content: `❌ **Bir hata oluştu!**\n> \`${error.message || String(error)}\``, components: result ? [result.row] : [] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[ErrorReporter] sendErrorReplyWithButton error:", err.message);
  }
}

module.exports = {
  saveErrorAndGetButton,
  sendErrorReplyWithButton
};
