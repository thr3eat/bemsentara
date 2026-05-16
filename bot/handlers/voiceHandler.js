const { logBanAdd, logBanRemove } = require("../services/banLog");
const { handleJoinToCreate, handleVoiceLeave } = require("../services/voiceManager");

function initializeVoiceAndBanHandlers(client) {
  client.on("guildBanAdd", (ban) => logBanAdd(ban));
  client.on("guildBanRemove", (ban) => logBanRemove(ban));

  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      if (newState.guild.id !== oldState.guild.id) return;
      await handleJoinToCreate(oldState, newState);
      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        await handleVoiceLeave(oldState, newState);
      }
    } catch (err) {
      console.error("[voiceStateUpdate]", err.message);
    }
  });
}

module.exports = { initializeVoiceAndBanHandlers };
