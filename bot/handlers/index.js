const { handleButtonInteraction } = require("./buttonHandler");
const { handleSelectInteraction } = require("./selectHandler");
const { handleModalSubmit } = require("./modalHandler");
const { handleGeneralCommand } = require("./generalCommandHandler");
const { handleEconomyCommand } = require("./economyCommandHandler");
const { handleFunCommand } = require("./funCommandHandler");
const { handleModerationCommand } = require("./moderationCommandHandler");

function initializeDiscordHandlers(client) {
  const { initializeVoiceAndBanHandlers } = require("./voiceHandler");
  initializeVoiceAndBanHandlers(client);

  client.once("ready", async () => {
    const { ensureVerifyHelpMessage } = require("../services/verifyHelpMessage");
    const { ensureVoicePanelMessage } = require("../services/voicePanelMessage");
    await ensureVerifyHelpMessage(client);
    await ensureVoicePanelMessage(client);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === "!tumrollerveidleriveisimleri") {
      const roles = message.guild.roles.cache.sort((a, b) => b.position - a.position);
      let replyText = "**Sunucudaki Rollerdir:**\n\n";
      
      roles.forEach((role) => {
        replyText += `**İsim:** ${role.name} | **ID:** ${role.id}\n`;
      });

      if (replyText.length > 2000) {
        const chunks = replyText.match(/[\s\S]{1,1999}/g) || [];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(replyText);
      }
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
      const { handleVoiceButton } = require("./voiceButtonHandler");
      const voiceResult = await handleVoiceButton(interaction);
      if (voiceResult !== null) return voiceResult;
      return handleButtonInteraction(interaction);
    }

    if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isRoleSelectMenu()) {
      const { handleVoiceSelect } = require("./voiceButtonHandler");
      const voiceSel = await handleVoiceSelect(interaction);
      if (voiceSel !== null) return voiceSel;
      return handleSelectInteraction(interaction);
    }

    if (interaction.isModalSubmit()) {
      const { handleVoiceModal } = require("./voiceButtonHandler");
      const voiceModal = await handleVoiceModal(interaction);
      if (voiceModal !== null) return voiceModal;
      return handleModalSubmit(interaction);
    }

    if (interaction.isChatInputCommand()) {
      let result = await handleGeneralCommand(interaction);
      if (result !== null) return result;

      result = await handleEconomyCommand(interaction);
      if (result !== null) return result;

      result = await handleFunCommand(interaction);
      if (result !== null) return result;

      result = await handleModerationCommand(interaction);
      if (result !== null) return result;

      return null;
    }

    return null;
  });
}

module.exports = { initializeDiscordHandlers };
