const { handleButtonInteraction } = require("./buttonHandler");
const { handleSelectInteraction } = require("./selectHandler");
const { handleModalSubmit } = require("./modalHandler");
const { handleSlashCommand } = require("./slashHandler");

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
      return handleSlashCommand(interaction);
    }

    return null;
  });
}

module.exports = { initializeDiscordHandlers };
