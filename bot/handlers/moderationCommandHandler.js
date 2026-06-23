const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { deferEphemeral } = require("../utils/interaction");

async function handleModerationCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;

  if (!["mesaj_sil", "sustur", "susturma_kaldir", "yasakla", "yasaklama_kaldir", "modislem", "tamban", "tamban_kaldir"].includes(commandName)) return null;

  await interaction.deferReply(deferEphemeral());

  try {
    const isHardBanCommand = ["tamban", "tamban_kaldir"].includes(commandName);
    if (isHardBanCommand) {
      if (interaction.user.id !== "1031620522406072350" && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: "❌ Bu komutu kullanmak için Eko veya Yönetici olmalısınız!" });
      }
    } else {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({ content: "❌ Mesaj Yöneticisi izni gerekli" });
      }
    }

    if (commandName === "mesaj_sil") {
      const miktar = interaction.options.getNumber("miktar");

      if (miktar < 1 || miktar > 100) {
        return interaction.editReply({ content: "❌ 1-100 arasında bir sayı girin" });
      }

      await interaction.channel.bulkDelete(miktar);

      const { TMT_GUILD_ID } = require("../../config");
      if (interaction.guild.id === TMT_GUILD_ID) {
        const { logTMTModAction } = require("../services/tmtLogger");
        await logTMTModAction(interaction, commandName, null, `${miktar} mesaj silindi.`);
      } else if (interaction.guild.id === "1483482948320891074") {
        const { logAlliedModAction } = require("../services/alliedRoleSyncService");
        await logAlliedModAction(interaction, commandName, null, `${miktar} mesaj silindi.`);
      }

      const embed = new EmbedBuilder()
        .setTitle("✅ Mesajlar Silindi")
        .setColor(0xed4245)
        .setDescription(`${miktar} mesaj başarıyla silindi.`)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "sustur") {
      const kullanici = interaction.options.getUser("kullanici");
      const sure = interaction.options.getString("sure");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";

      const member = await interaction.guild.members.fetch(kullanici.id).catch(() => null);
      if (!member) {
        return interaction.editReply({ content: "❌ Kullanıcı sunucuda bulunamadı" });
      }

      const duration = parseDuration(sure || "10m");
      await member.timeout(duration, `Sebep: ${sebep}`);

      const { TMT_GUILD_ID } = require("../../config");
      if (interaction.guild.id === TMT_GUILD_ID) {
        const { logTMTModAction } = require("../services/tmtLogger");
        await logTMTModAction(interaction, commandName, kullanici, `Süre: ${sure || "10 dakika"}, Sebep: ${sebep}`);
      } else if (interaction.guild.id === "1483482948320891074") {
        const { logAlliedModAction } = require("../services/alliedRoleSyncService");
        await logAlliedModAction(interaction, commandName, kullanici, `Süre: ${sure || "10 dakika"}, Sebep: ${sebep}`);
      }

      const embed = new EmbedBuilder()
        .setTitle("🔇 Kullanıcı Susturuldu")
        .setColor(0xed4245)
        .addFields(
          { name: "Kullanıcı", value: kullanici.toString(), inline: false },
          { name: "Süre", value: sure || "10 dakika", inline: true },
          { name: "Sebep", value: sebep, inline: true }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "susturma_kaldir") {
      const kullanici = interaction.options.getUser("kullanici");
      const member = await interaction.guild.members.fetch(kullanici.id).catch(() => null);

      if (!member) {
        return interaction.editReply({ content: "❌ Kullanıcı sunucuda bulunamadı" });
      }

      await member.timeout(null);

      const { TMT_GUILD_ID } = require("../../config");
      if (interaction.guild.id === TMT_GUILD_ID) {
        const { logTMTModAction } = require("../services/tmtLogger");
        await logTMTModAction(interaction, commandName, kullanici, `Susturma kaldırıldı.`);
      } else if (interaction.guild.id === "1483482948320891074") {
        const { logAlliedModAction } = require("../services/alliedRoleSyncService");
        await logAlliedModAction(interaction, commandName, kullanici, `Susturma kaldırıldı.`);
      }

      const embed = new EmbedBuilder()
        .setTitle("🔊 Susturma Kaldırıldı")
        .setColor(0x4ade80)
        .setDescription(`${kullanici} kullanıcısının susturması kaldırıldı.`)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "yasakla") {
      const kullanici = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";

      try {
        await interaction.guild.members.ban(kullanici.id, { reason: sebep });

        const { TMT_GUILD_ID } = require("../../config");
        if (interaction.guild.id === TMT_GUILD_ID) {
          const { logTMTModAction } = require("../services/tmtLogger");
          await logTMTModAction(interaction, commandName, kullanici, `Sebep: ${sebep}`);
        } else if (interaction.guild.id === "1483482948320891074") {
          const { logAlliedModAction } = require("../services/alliedRoleSyncService");
          await logAlliedModAction(interaction, commandName, kullanici, `Sebep: ${sebep}`);
        }

        // Site ban da uygula
        try {
          const User = require("../../models/User");
          const { saveStoreNow } = require("../../models/Store");
          const dbUser = await User.findOne({ discordId: kullanici.id });
          if (dbUser) {
            dbUser.isBanned = true;
            dbUser.banReason = sebep;
            dbUser.bannedAt = new Date();
            dbUser.bannedBy = interaction.user.id;
            await dbUser.save();
            saveStoreNow();
          }
        } catch (siteErr) {
          console.warn("[yasakla] Site ban uygulanamadı:", siteErr.message);
        }

        const embed = new EmbedBuilder()
          .setTitle("🚫 Kullanıcı Yasaklandı")
          .setColor(0xed4245)
          .addFields(
            { name: "Kullanıcı", value: `${kullanici.toString()} \`${kullanici.id}\``, inline: false },
            { name: "Yetkili", value: `${interaction.user.toString()}`, inline: true },
            { name: "Sebep", value: sebep, inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Yasaklama başarısız: ${err.message}` });
      }
    }

    if (commandName === "yasaklama_kaldir") {
      const kullanici = interaction.options.getUser("kullanici");

      try {
        await interaction.guild.bans.remove(kullanici.id);

        const { TMT_GUILD_ID } = require("../../config");
        if (interaction.guild.id === TMT_GUILD_ID) {
          const { logTMTModAction } = require("../services/tmtLogger");
          await logTMTModAction(interaction, commandName, kullanici, `Yasaklama kaldırıldı.`);
        } else if (interaction.guild.id === "1483482948320891074") {
          const { logAlliedModAction } = require("../services/alliedRoleSyncService");
          await logAlliedModAction(interaction, commandName, kullanici, `Yasaklama kaldırıldı.`);
        }

        // Site ban da kaldır
        try {
          const User = require("../../models/User");
          const { saveStoreNow } = require("../../models/Store");
          const dbUser = await User.findOne({ discordId: kullanici.id });
          if (dbUser && dbUser.isBanned) {
            dbUser.isBanned = false;
            dbUser.banReason = null;
            dbUser.bannedAt = null;
            dbUser.bannedBy = null;
            await dbUser.save();
            saveStoreNow();
          }
        } catch (siteErr) {
          console.warn("[yasaklama_kaldir] Site ban kaldırılamadı:", siteErr.message);
        }

        const embed = new EmbedBuilder()
          .setTitle("✅ Yasak Kaldırıldı")
          .setColor(0x4ade80)
          .setDescription(`${kullanici} kullanıcısının yasağı kaldırıldı.`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Yasak kaldırma başarısız: ${err.message}` });
      }
    }

    if (commandName === "modislem") {
      const kullanici = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep");
      const kanit = interaction.options.getAttachment("kanit") || null;

      if (!kullanici || !sebep) {
        return interaction.editReply({ content: "❌ Kullanıcı ve sebep belirtilmelidir." });
      }

      const { executeModAction } = require("../services/modActionService");
      return executeModAction(interaction, kullanici, sebep, kanit);
    }

    if (commandName === "tamban") {
      const inputId = interaction.options.getString("kullanici_id");
      let targetUserId = inputId.replace(/[<@!>]/g, "");
      const seviye = interaction.options.getString("seviye");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";

      const User = require("../../models/User");
      const noblox = require("noblox.js");
      const { ROBLOX_GROUPS } = require("../services/robloxGroupManager");
      const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");

      // Resolve numeric ID if a username/mention was typed
      if (!/^\d+$/.test(targetUserId)) {
        const allUsers = await User.find({});
        const found = allUsers.find(u => 
          (u.discordUsername && u.discordUsername.toLowerCase() === targetUserId.toLowerCase()) ||
          (u.robloxUsername && u.robloxUsername.toLowerCase() === targetUserId.toLowerCase())
        );
        if (found) {
          targetUserId = found.discordId;
        } else {
          // Check guild members cache
          const memberFound = interaction.guild.members.cache.find(m => 
            m.user.username.toLowerCase() === targetUserId.toLowerCase() || 
            (m.nickname && m.nickname.toLowerCase() === targetUserId.toLowerCase())
          );
          if (memberFound) {
            targetUserId = memberFound.id;
          } else {
            return interaction.editReply({ content: `❌ Kullanıcı ID veya kullanıcı adı bulunamadı: \`${inputId}\`` });
          }
        }
      }

      let dbUser = await User.findOne({ discordId: targetUserId });
      if (!dbUser) {
        dbUser = new User({
          discordId: targetUserId,
          discordUsername: "Bilinmiyor",
          isBanned: true,
          banReason: sebep,
          bannedAt: new Date(),
          bannedBy: interaction.user.id,
          banLevel: seviye
        });
        await dbUser.save();
      } else {
        dbUser.isBanned = true;
        dbUser.banReason = sebep;
        dbUser.bannedAt = new Date();
        dbUser.bannedBy = interaction.user.id;
        dbUser.banLevel = seviye;
        await dbUser.save();
      }

      let robloxId = dbUser?.robloxId;
      let robloxUsername = dbUser?.robloxUsername;

      let robloxLogs = [];
      let discordLogs = [];
      let savedGroupRanks = {};

      if (robloxId && seviye !== "very_low") {
        const robloxUserId = parseInt(robloxId);
        if (!isNaN(robloxUserId)) {
          for (const [groupId, groupName] of Object.entries(ROBLOX_GROUPS)) {
            try {
              const rankInGroup = await noblox.getRankInGroup(parseInt(groupId), robloxUserId);
              if (rankInGroup > 0) {
                if (seviye === "very_high") {
                  savedGroupRanks[groupId] = {
                    oldRank: rankInGroup,
                    exiled: true
                  };
                  await noblox.exile(parseInt(groupId), robloxUserId);
                  robloxLogs.push(`${groupName} (Sürgün Edildi)`);
                } else {
                  const roles = await noblox.getRoles(parseInt(groupId));
                  const lowest = roles.filter(r => r.rank > 0).sort((a, b) => a.rank - b.rank)[0];
                  if (lowest && rankInGroup !== lowest.rank) {
                    savedGroupRanks[groupId] = {
                      oldRank: rankInGroup,
                      oldRoleId: lowest.rank
                    };
                    await noblox.setRank({ group: parseInt(groupId), target: robloxUserId, rank: lowest.rank });
                    robloxLogs.push(`${groupName} (Rütbe Düşürüldü)`);
                  }
                }
              }
            } catch (err) {
              console.warn(`[tamban] Roblox group ${groupId} demotion/exile error:`, err.message);
            }
          }
        }
      }

      if (dbUser && Object.keys(savedGroupRanks).length > 0) {
        dbUser.tambanSavedRanks = savedGroupRanks;
        await dbUser.save();
      }

      const targetUserObj = await interaction.client.users.fetch(targetUserId).catch(() => null);
      if (targetUserObj && dbUser && dbUser.discordUsername === "Bilinmiyor") {
        dbUser.discordUsername = targetUserObj.username;
        await dbUser.save();
      }

      const dmSent = { success: false };

      const getNormalMemberRole = (guild) => {
        const { TMT_GUILD_ID, TMT_VERIFIED_ROLE_ID, TARGET_GUILD_ID, ALLIED_GUILD_ID } = require("../../config");
        if (guild.id === TMT_GUILD_ID) {
          const role = guild.roles.cache.get(TMT_VERIFIED_ROLE_ID);
          if (role) return role;
        }
        if (guild.id === TARGET_GUILD_ID) {
          const role = guild.roles.cache.find(r => r.name === "Teşkilat Personeli") || guild.roles.cache.get("1505511498095788063");
          if (role) return role;
        }
        if (guild.id === ALLIED_GUILD_ID) {
          const role = guild.roles.cache.get("1483483253720616971");
          if (role) return role;
        }
        const namesToSearch = ["üye", "member", "personel", "onaylı", "onaylanmış hesap", "kullanıcı"];
        for (const name of namesToSearch) {
          const role = guild.roles.cache.find(r => r.name.toLowerCase() === name && !r.managed);
          if (role) return role;
        }
        const sortedRoles = Array.from(guild.roles.cache.values())
          .filter(r => r.id !== guild.id && !r.managed)
          .sort((a, b) => a.position - b.position);
        return sortedRoles[0] || null;
      };

      const rbxListText = robloxLogs.length > 0 ? robloxLogs.join(", ") : "Yok";
      const discGuildNames = [];

      for (const guild of interaction.client.guilds.cache.values()) {
        try {
          const member = await guild.members.fetch(targetUserId).catch(() => null);

          if (seviye === "very_high" || seviye === "high") {
            await guild.bans.create(targetUserId, { reason: `Tam Ban (${seviye}): ${sebep}` }).catch(() => {});
            if (member) {
              discGuildNames.push(guild.name);
              discordLogs.push(`${guild.name} (Banlandı)`);
            } else {
              discordLogs.push(`${guild.name} (Gıyabında Banlandı)`);
            }
          } else if (seviye === "medium") {
            const { TMT_GUILD_ID } = require("../../config");
            const isMain = guild.id === TMT_GUILD_ID || guild.id === "1367646464804655104";
            if (isMain) {
              await guild.bans.create(targetUserId, { reason: `Tam Ban (Orta): ${sebep}` }).catch(() => {});
              if (member) {
                discGuildNames.push(guild.name);
                discordLogs.push(`${guild.name} (Banlandı)`);
              } else {
                discordLogs.push(`${guild.name} (Gıyabında Banlandı)`);
              }
            } else {
              if (member) {
                discGuildNames.push(guild.name);
                await member.kick(`Tam Ban (Orta): ${sebep}`).catch(() => {});
                discordLogs.push(`${guild.name} (Atıldı)`);
              }
            }
          } else if (seviye === "low") {
            if (member) {
              discGuildNames.push(guild.name);
              await member.kick(`Tam Ban (Düşük): ${sebep}`).catch(() => {});
              discordLogs.push(`${guild.name} (Atıldı)`);
            }
          } else if (seviye === "very_low") {
            if (member) {
              discGuildNames.push(guild.name);
              const editableRoles = member.roles.cache.filter(role => 
                role.id !== guild.id && !role.managed && role.editable
              );
              if (editableRoles.size > 0) {
                await member.roles.remove(Array.from(editableRoles.keys()), `Tam Ban (Çok Düşük): ${sebep}`).catch(() => {});
              }
              const basicRole = getNormalMemberRole(guild);
              if (basicRole) {
                await member.roles.add(basicRole, `Tam Ban (Çok Düşük): ${sebep}`).catch(() => {});
              }
              discordLogs.push(`${guild.name} (Roller Sıfırlandı)`);
            }
          }
        } catch (gErr) {
          console.warn(`[tamban] Guild ${guild.name} action error:`, gErr.message);
        }
      }

      const statusText = `👤 **Kullanıcı ID:** \`${targetUserId}\` (${targetUserObj?.tag || "Bilinmiyor"})\n` +
        `📂 **Ban Seviyesi:** \`${seviye.toUpperCase()}\`\n` +
        `📋 **Gerekçe:** ${sebep}\n` +
        `🤖 **Roblox Bağlantısı:** ${robloxId ? `Evet (\`${robloxUsername || robloxId}\`)` : "Hayır"}\n\n` +
        `🛡️ **Roblox İşlemleri:** ${robloxLogs.length > 0 ? robloxLogs.join(", ") : "Yapılmadı."}\n` +
        `🏠 **Discord İşlemleri:** ${discordLogs.length > 0 ? discordLogs.join(", ") : "Herhangi bir sunucuda bulunamadı."}\n` +
        `📬 **DM Durumu:** Devre Dışı`;

      const resEmbed = new EmbedBuilder()
        .setTitle("🔨 Tam Banlama Uygulandı")
        .setColor(0xed4245)
        .setDescription(statusText)
        .setTimestamp();

      return interaction.editReply({ embeds: [resEmbed] });
    }

    if (commandName === "tamban_kaldir") {
      const inputId = interaction.options.getString("kullanici_id");
      let targetUserId = inputId.replace(/[<@!>]/g, "");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";

      const User = require("../../models/User");
      const noblox = require("noblox.js");

      // Resolve numeric ID if a username/mention was typed
      if (!/^\d+$/.test(targetUserId)) {
        const allUsers = await User.find({});
        const found = allUsers.find(u => 
          (u.discordUsername && u.discordUsername.toLowerCase() === targetUserId.toLowerCase()) ||
          (u.robloxUsername && u.robloxUsername.toLowerCase() === targetUserId.toLowerCase())
        );
        if (found) {
          targetUserId = found.discordId;
        } else {
          // Check guild members cache
          const memberFound = interaction.guild.members.cache.find(m => 
            m.user.username.toLowerCase() === targetUserId.toLowerCase() || 
            (m.nickname && m.nickname.toLowerCase() === targetUserId.toLowerCase())
          );
          if (memberFound) {
            targetUserId = memberFound.id;
          } else {
            return interaction.editReply({ content: `❌ Kullanıcı ID veya kullanıcı adı bulunamadı: \`${inputId}\`` });
          }
        }
      }

      let dbUser = await User.findOne({ discordId: targetUserId });
      
      let robloxLogs = [];
      let discordLogs = [];

      if (dbUser && dbUser.tambanSavedRanks && dbUser.robloxId) {
        const robloxUserId = parseInt(dbUser.robloxId);
        if (!isNaN(robloxUserId)) {
          const { ROBLOX_GROUPS } = require("../services/robloxGroupManager");
          for (const [groupId, rankInfo] of Object.entries(dbUser.tambanSavedRanks)) {
            try {
              const groupName = ROBLOX_GROUPS[groupId] || `Grup ${groupId}`;
              const oldRank = rankInfo.oldRank;
              if (rankInfo.exiled) {
                robloxLogs.push(`${groupName} (Sürgün edilmişti - Geri katıldığında rütbe ${oldRank} yapılmalı)`);
              } else if (oldRank) {
                await noblox.setRank({ group: parseInt(groupId), target: robloxUserId, rank: oldRank });
                robloxLogs.push(`${groupName} (Rütbe İade Edildi)`);
              }
            } catch (err) {
              console.warn(`[tamban_kaldir] Roblox group ${groupId} restore error:`, err.message);
            }
          }
        }
        dbUser.tambanSavedRanks = undefined;
      }

      if (dbUser) {
        dbUser.isBanned = false;
        dbUser.banReason = null;
        dbUser.bannedAt = null;
        dbUser.bannedBy = null;
        dbUser.banLevel = null;
        await dbUser.save();
      }

      for (const guild of interaction.client.guilds.cache.values()) {
        try {
          const ban = await guild.bans.fetch(targetUserId).catch(() => null);
          if (ban) {
            await guild.bans.remove(targetUserId, `Tam Ban Kaldırma: ${sebep}`).catch(() => {});
            discordLogs.push(`${guild.name}`);
          }
        } catch (gErr) {
          console.warn(`[tamban_kaldir] Guild ${guild.name} unban error:`, gErr.message);
        }
      }

      const statusText = `👤 **Kullanıcı ID:** \`${targetUserId}\`\n` +
        `📋 **Gerekçe:** ${sebep}\n\n` +
        `🛡️ **Roblox Rütbe İadeleri:** ${robloxLogs.length > 0 ? robloxLogs.join(", ") : "Yapılmadı."}\n` +
        `🏠 **Discord Yasağı Kaldırılan Sunucular:** ${discordLogs.length > 0 ? discordLogs.join(", ") : "Hiçbir sunucuda aktif yasak bulunamadı."}`;

      const resEmbed = new EmbedBuilder()
        .setTitle("✅ Tam Banlama Kaldırıldı")
        .setColor(0x4ade80)
        .setDescription(statusText)
        .setTimestamp();

      return interaction.editReply({ embeds: [resEmbed] });
    }

    return null;
  } catch (err) {
    console.error(`[${commandName}] Hata:`, err);
    return interaction.editReply({ content: `❌ Hata: ${err.message}` });
  }
}

function parseDuration(timeStr) {
  const matches = timeStr.match(/(\d+)([smhd])/);
  if (!matches) return 10 * 60 * 1000;

  const value = parseInt(matches[1]);
  const unit = matches[2];

  const unitMap = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (unitMap[unit] || 1000);
}

module.exports = { handleModerationCommand };
