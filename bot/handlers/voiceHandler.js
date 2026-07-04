const { logBanAdd, logBanRemove } = require("../services/banLog");
const { handleJoinToCreate, handleVoiceLeave } = require("../services/voiceManager");
const { TMT_GUILD_ID } = require("../../config");

function initializeVoiceAndBanHandlers(client) {
  client.on("guildBanAdd", async (ban) => {
    if (ban.guild.id === TMT_GUILD_ID) {
      const { logTMTBanAdd } = require("../services/tmtLogger");
      logTMTBanAdd(ban);
    } else {
      logBanAdd(ban);
    }
    let dbUser = null;
    try {
      const User = require("../../models/User");
      dbUser = await User.findOne({ discordId: ban.user.id });
    } catch (err) {
      console.warn("[guildBanAdd] DB query error:", err.message);
    }

    // Discord'dan ban atılınca site ban da uygula
    try {
      if (dbUser && !dbUser.isBanned) {
        const { saveStoreNow } = require("../../models/Store");
        dbUser.isBanned = true;
        dbUser.banReason = ban.reason || "Discord üzerinden yasaklandı";
        dbUser.bannedAt = new Date();
        await dbUser.save();
        saveStoreNow();
      }
    } catch (err) {
      console.warn("[guildBanAdd] Site ban uygulanamadı:", err.message);
    }

    // Banlanan kullanıcıya itiraz DM'i gönder (Tam Ban hariç)
    try {
      const isTamBan = (ban.reason && ban.reason.includes("Tam Ban")) || (dbUser && dbUser.banLevel);
      if (!isTamBan) {
        const { sendAppealDM } = require("../services/banAppeal");
        await sendAppealDM(
          ban.user,
          ban.guild.name,
          ban.guild.id,
          ban.reason || "Belirtilmedi",
          "ban"
        );
      } else {
        console.log(`[guildBanAdd] Tam Ban tespit edildi, DM gönderimi atlandı: ${ban.user.tag}`);
      }
    } catch (err) {
      console.warn("[guildBanAdd] İtiraz DM gönderilemedi:", err.message);
    }
  });

  client.on("guildBanRemove", async (ban) => {
    if (ban.guild.id === TMT_GUILD_ID) {
      const { logTMTBanRemove } = require("../services/tmtLogger");
      logTMTBanRemove(ban);
    } else {
      logBanRemove(ban);
    }
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

      // ── Hapis Ses Kanalı Engelleme Kontrolü ─────────────────────────────────
      if (newState.channelId && newState.member && !newState.member.user.bot) {
        const hasHapisRole = newState.member.roles.cache.some(r => r.name.toLowerCase() === "hapis");
        let isUserJailed = hasHapisRole;
        if (!isUserJailed) {
          const User = require("../../models/User");
          const dbUser = await User.findOne({ discordId: newState.member.id });
          if (dbUser && dbUser.isJailed) {
            isUserJailed = true;
          }
        }

        if (isUserJailed) {
          const isJailCategory = newState.channel && newState.channel.parentId === "1521501154339586078";
          if (!isJailCategory) {
            await newState.disconnect("Hapiste olan kullanıcı ses kanalına katılamaz.").catch(() => {});
            await newState.member.send("❌ Hapiste olduğunuz için bu ses kanalına katılamazsınız!").catch(() => {});
            return;
          }
        }
      }

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
