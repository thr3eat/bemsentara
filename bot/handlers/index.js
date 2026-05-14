const { handleButtonInteraction } = require("./buttonHandler");
const { handleSelectInteraction } = require("./selectHandler");
const { handleModalSubmit } = require("./modalHandler");
const { handleGeneralCommand } = require("./generalCommandHandler");
const { handleEconomyCommand } = require("./economyCommandHandler");
const { handleFunCommand } = require("./funCommandHandler");
const { handleModerationCommand } = require("./moderationCommandHandler");

function initializeDiscordHandlers(client) {
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
      return handleButtonInteraction(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      return handleSelectInteraction(interaction);
    }

    if (interaction.isModalSubmit()) {
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
