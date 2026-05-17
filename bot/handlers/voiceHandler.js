const { logBanAdd, logBanRemove } = require("../services/banLog");
const { handleJoinToCreate, handleVoiceLeave } = require("../services/voiceManager");

function initializeVoiceAndBanHandlers(client) {
  client.on("guildBanAdd", async (ban) => {
    logBanAdd(ban);
    // Discord'dan ban atılınca site ban da uygula
    try {
      const User = require("../../models/User");
      const { saveStoreNow } = require("../../models/Store");
      const dbUser = await User.findOne({ discordId: ban.user.id });
      if (dbUser && !dbUser.isBanned) {
        dbUser.isBanned = true;
        dbUser.banReason = ban.reason || "Discord üzerinden yasaklandı";
        dbUser.bannedAt = new Date();
        await dbUser.save();
        saveStoreNow();
      }
    } catch (err) {
      console.warn("[guildBanAdd] Site ban uygulanamadı:", err.message);
    }
  });

  client.on("guildBanRemove", async (ban) => {
    logBanRemove(ban);
    // Discord'dan ban kaldırılınca site ban da kaldır
    try {
      const User = require("../../models/User");
      const { saveStoreNow } = require("../../models/Store");
      const dbUser = await User.findOne({ discordId: ban.user.id });
      if (dbUser && dbUser.isBanned) {
        dbUser.isBanned = false;
        dbUser.banReason = null;
        dbUser.bannedAt = null;
        dbUser.bannedBy = null;
        await dbUser.save();
        saveStoreNow();
      }
    } catch (err) {
      console.warn("[guildBanRemove] Site ban kaldırılamadı:", err.message);
    }
  });

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
