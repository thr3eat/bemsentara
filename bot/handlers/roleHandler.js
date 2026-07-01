const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const User = require("../../models/User");
const { BASE_URL, ADMIN_IDS } = require("../../config");
const { findUserByDiscordId, hasRobloxLink } = require("../../utils/userLink");
const { syncMemberRoles, buildSyncPlan, MAIN_GROUP_ID } = require("../services/roleSyncService");
const { logUpdate } = require("../services/commandLog");
const { deferEphemeral, replyEphemeral } = require("../utils/interaction");

function formatRoleList(roles) {
  if (!roles.length) return "None";
  return roles.map((r) => `<@&${r.id}>`).join("\n");
}

function buildUpdateEmbed(member, result) {
  return new EmbedBuilder()
    .setColor(result.success ? 0x5865f2 : 0xed4245)
    .setTitle("Update")
    .addFields(
      { name: "Nickname", value: result.nickname || member.user.username, inline: false },
      { name: "Added Roles", value: formatRoleList(result.added || []), inline: false },
      { name: "Removed Roles", value: formatRoleList(result.removed || []), inline: false }
    )
    .setFooter({ text: "Sentara • Rol Senkronizasyonu" })
    .setTimestamp();
}

async function syncBranchServerRoles(guild, member, robloxUserId) {
  const db = require("../../models/db");
  if (!db.isMongoActive()) {
    return { success: false, message: "Bu sunucu için aktif bir kurulum (ServerSetup) bulunamadı (Veritabanı aktif değil)." };
  }

  const ServerSetup = require("../../models/ServerSetup");
  const setupDoc = await ServerSetup.findOne({ guildId: guild.id, status: "active" });
  if (!setupDoc) {
    return { success: false, message: "Bu sunucu için aktif bir kurulum (ServerSetup) bulunamadı." };
  }

  const noblox = require("noblox.js");
  const rank = await noblox.getRankInGroup(setupDoc.robloxGroupId, parseInt(robloxUserId, 10)).catch(() => 0);

  // Mapped role ID(s)
  const mappedVal = setupDoc.roleMappings instanceof Map ? setupDoc.roleMappings.get(rank.toString()) : setupDoc.roleMappings[rank.toString()];
  const mappedRoleIds = Array.isArray(mappedVal) ? mappedVal : (typeof mappedVal === "string" ? mappedVal.split(",") : []);

  // Find all possible roles in the mapping to remove old ones
  let allMappedRoleIds = [];
  const rawValues = setupDoc.roleMappings instanceof Map ? Array.from(setupDoc.roleMappings.values()) : Object.values(setupDoc.roleMappings);
  for (const val of rawValues) {
    if (Array.isArray(val)) {
      allMappedRoleIds.push(...val);
    } else if (typeof val === "string" && val) {
      allMappedRoleIds.push(...val.split(","));
    }
  }
  // Keep unique values
  allMappedRoleIds = Array.from(new Set(allMappedRoleIds));

  const toAdd = [];
  const toRemove = [];

  for (const rid of mappedRoleIds) {
    if (rid && !member.roles.cache.has(rid)) {
      toAdd.push(rid);
    }
  }

  for (const rid of allMappedRoleIds) {
    if (rid && !mappedRoleIds.includes(rid) && member.roles.cache.has(rid)) {
      toRemove.push(rid);
    }
  }

  if (toAdd.length > 0) {
    await member.roles.add(toAdd, "Branch server rank update").catch(() => {});
  }

  if (toRemove.length > 0) {
    await member.roles.remove(toRemove, "Branch server rank update").catch(() => {});
  }

  // Update nickname: RobloxUsername [RankName]
  const rbxRoles = await noblox.getRoles(setupDoc.robloxGroupId).catch(() => []);
  const rankObj = rbxRoles.find(r => r.rank === rank);
  const rankName = rankObj ? rankObj.name : "Guest";
  const robloxUsername = await noblox.getUsernameFromId(parseInt(robloxUserId, 10)).catch(() => null);

  if (robloxUsername) {
    const newNickname = `${robloxUsername} [${rankName}]`.slice(0, 32);
    await member.setNickname(newNickname, "Branch server rank update").catch(() => {});
  }

  return {
    success: true,
    added: toAdd.map(id => guild.roles.cache.get(id)).filter(Boolean),
    removed: toRemove.map(id => guild.roles.cache.get(id)).filter(Boolean),
    nickname: robloxUsername ? `${robloxUsername} [${rankName}]` : null,
    rankName
  };
}

async function runSyncForMember(interaction, { ephemeral = true, commandName = "update" } = {}) {
  const { guild, member, user } = interaction;

  if (!guild) {
    return interaction.reply(replyEphemeral("❌ Bu komut yalnızca sunucuda kullanılabilir."));
  }

  const dbUser = await findUserByDiscordId(user.id);

  if (!hasRobloxLink(dbUser)) {
    const authUrl = `${BASE_URL}/auth/authorize?discordId=${user.id}`;
    logUpdate(interaction, { commandName, dbUser, notLinked: true });
    return interaction.reply(
      replyEphemeral(
        `❌ Roblox hesabınız sisteme kayıtlı görünmüyor.\n\n` +
          `1. \`/authorize\` → bağlantıya tıkla\n` +
          `2. **Aynı Discord hesabıyla** siteye giriş yap\n` +
          `3. Roblox'u bağla, sonra \`/verify\` veya \`/update\`\n\n` +
          `🔗 [Bağlantı](${authUrl})`
      )
    );
  }

  // Sunucu kontrolleri
  const { TMT_GUILD_ID, TARGET_GUILD_ID, ALLIED_GUILD_ID, GUILD2_ID } = require("../../config");
  const normalizedGuildId = String(guild.id).trim();
  const normalizedTMT = String(TMT_GUILD_ID).trim();
  const normalizedBEM = String(TARGET_GUILD_ID).trim();
  const normalizedAllied = String(ALLIED_GUILD_ID).trim();
  const normalizedEKO = String(GUILD2_ID).trim();

  // Branch Sunucu Kontrolü (ServerSetup ile kurulmuş)
  const db = require("../../models/db");
  let setupDoc = null;
  if (db.isMongoActive()) {
    const ServerSetup = require("../../models/ServerSetup");
    setupDoc = await ServerSetup.findOne({ guildId: normalizedGuildId, status: "active" });
  }

  if (setupDoc) {
    await interaction.deferReply(ephemeral ? deferEphemeral() : {});
    try {
      const fullMember = member.partial ? await member.fetch() : member;
      const result = await syncBranchServerRoles(guild, fullMember, dbUser.robloxId);
      if (result && result.success) {
        const embed = buildUpdateEmbed(fullMember, result);
        return interaction.editReply({ embeds: [embed] });
      } else {
        return interaction.editReply({
          content: `❌ Roller senkronize edilemedi: ${result.message || 'Bilinmeyen hata'}`
        });
      }
    } catch (err) {
      console.error("[BranchSync] error:", err);
      return interaction.editReply({
        content: `❌ Bir hata oluştu: ${err.message}`,
      });
    }
  }

  // TMT Sunucusu
  if (normalizedGuildId === normalizedTMT) {
    await interaction.deferReply(ephemeral ? deferEphemeral() : {});
    try {
      const { syncTMTRoles } = require("../services/tmtRoleSyncService");
      const fullMember = member.partial ? await member.fetch() : member;
      const result = await syncTMTRoles(
        interaction.client,
        user.id,
        dbUser.robloxId,
        fullMember
      );

      if (result && result.success) {
        const embed = buildUpdateEmbed(fullMember, result);
        
        if (result.tier) {
          embed.addFields({
            name: "🎖️ Seviye Rolü",
            value: result.tier,
            inline: true,
          });
        }

        if (result.unresolved && result.unresolved.length > 0) {
          embed.addFields({
            name: "⚠️ Eşleşmeyen Roller",
            value: result.unresolved.map((n) => `\`${n}\``).join(", ").slice(0, 1024),
            inline: false,
          });
        }
        
        return interaction.editReply({ embeds: [embed] });
      } else {
        return interaction.editReply({
          content: "❌ Roller senkronize edilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        });
      }
    } catch (err) {
      console.error("[TMT] Role sync error:", err);
      return interaction.editReply({
        content: `❌ Bir hata oluştu: ${err.message}`,
      });
    }
  }

  // Allied veya EKOYILDIZ Sunucusu
  if (normalizedGuildId === normalizedAllied || normalizedGuildId === normalizedEKO) {
    await interaction.deferReply(ephemeral ? deferEphemeral() : {});
    try {
      const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
      const fullMember = member.partial ? await member.fetch() : member;
      const result = await syncAlliedRoles(
        interaction.client,
        user.id,
        parseInt(dbUser.robloxId, 10),
        fullMember
      );

      if (result && result.success) {
        const embed = buildUpdateEmbed(fullMember, result);
        
        if (result.tier) {
          embed.addFields({
            name: "🎖️ Tier Rolü",
            value: result.tier,
            inline: true,
          });
        }

        if (result.unresolved && result.unresolved.length > 0) {
          embed.addFields({
            name: "⚠️ Eşleşmeyen Roller",
            value: result.unresolved.map((n) => `\`${n}\``).join(", ").slice(0, 1024),
            inline: false,
          });
        }
        
        return interaction.editReply({ embeds: [embed] });
      } else {
        return interaction.editReply({
          content: "❌ Roller senkronize edilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        });
      }
    } catch (err) {
      console.error("[Allied/EKO] Role sync error:", err);
      return interaction.editReply({
        content: `❌ Bir hata oluştu: ${err.message}`,
      });
    }
  }

  // BEM Sunucusu (varsayılan)
  await interaction.deferReply(ephemeral ? deferEphemeral() : {});

  try {
    const fullMember = member.partial ? await member.fetch() : member;
    const result = await syncMemberRoles(
      guild,
      fullMember,
      parseInt(dbUser.robloxId, 10),
      dbUser.robloxUsername
    );

    if (!result.success) {
      logUpdate(interaction, { commandName, dbUser, result });
      return interaction.editReply({
        content: result.message,
      });
    }

    logUpdate(interaction, { commandName, dbUser, result });

    if (dbUser.groupRole !== result.rankName) {
      dbUser.groupRole = result.rankName;
      await dbUser.save();
    }

    const embed = buildUpdateEmbed(fullMember, result);

    if (result.tier) {
      embed.addFields({
        name: "🎖️ Seviye Rolü",
        value: result.tier,
        inline: true,
      });
    }

    if (result.unresolved?.length) {
      embed.addFields({
        name: "⚠️ Eşleşmeyen Roller",
        value: result.unresolved.map((n) => `\`${n}\``).join(", ").slice(0, 1024),
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[BEM] Role sync error:", err);
    logUpdate(interaction, {
      commandName,
      dbUser: await findUserByDiscordId(user.id),
      error: err.message,
    });
    return interaction.editReply({
      content: `❌ Bir hata oluştu: ${err.message}`,
    });
  }
}

async function handleVerify(interaction) {
  return runSyncForMember(interaction, { ephemeral: true, commandName: "verify" });
}

async function handleUpdate(interaction) {
  return runSyncForMember(interaction, { ephemeral: false, commandName: "update" });
}

function formatDebugList(items, empty = "—") {
  if (!items?.length) return empty;
  return items
    .slice(0, 15)
    .map((r) => (typeof r === "string" ? r : `<@&${r.id}> \`${r.name}\``))
    .join("\n")
    .slice(0, 1024);
}

function buildDebugEmbed(targetMember, dbUser, syncPlan, { applied }) {
  const embed = new EmbedBuilder()
    .setColor(syncPlan.success ? 0xfbbf24 : 0xed4245)
    .setTitle(`🔧 Debug Update${applied ? " (uygulandı)" : " (önizleme)"}`)
    .setDescription(`Hedef: ${targetMember} (\`${targetMember.id}\`)`)
    .setTimestamp();

  if (!dbUser?.robloxId) {
    embed.addFields({
      name: "Veritabanı",
      value: "❌ Roblox bağlı değil",
      inline: false,
    });
    return embed;
  }

  embed.addFields(
    {
      name: "Roblox",
      value: `**${dbUser.robloxUsername || "?"}**\nID: \`${dbUser.robloxId}\``,
      inline: true,
    },
    {
      name: "DB",
      value: `Yetkili: ${dbUser.isAuthorized ? "✅" : "❌"}\nKayıtlı rütbe: \`${dbUser.groupRole || "—"}\``,
      inline: true,
    }
  );

  if (!syncPlan.success) {
    embed.addFields({
      name: "Hata",
      value: syncPlan.message || syncPlan.error,
      inline: false,
    });
    return embed;
  }

  const groupList = syncPlan.userGroups
    .slice(0, 12)
    .map((g) => `• ${g.group.name}: **${g.role.name}**`)
    .join("\n");

  embed.addFields(
    {
      name: "Ana grup rütbesi",
      value: `**${syncPlan.rankName}** (grup \`${MAIN_GROUP_ID}\`)`,
      inline: false,
    },
    {
      name: "Seviye / Branş",
      value: `Seviye: \`${syncPlan.tier || "—"}\`\nBranş: \`${syncPlan.branch?.departmentRoleName || "Branşsız"}\``,
      inline: true,
    },
    {
      name: "Takma ad",
      value: syncPlan.nicknameWouldChange
        ? `→ \`${syncPlan.nickname}\``
        : `\`${syncPlan.nickname || "—"}\` (değişmez)`,
      inline: true,
    },
    {
      name: "Roblox grupları",
      value: (groupList || "—").slice(0, 1024),
      inline: false,
    },
    {
      name: "Hedef roller",
      value: syncPlan.desiredNames.map((n) => `\`${n}\``).join(", ").slice(0, 1024),
      inline: false,
    },
    {
      name: "Çözümleme",
      value:
        syncPlan.resolved
          .map((r) => `${r.ok ? "✅" : "❌"} ${r.name}${r.id ? ` (${r.id})` : ""}`)
          .join("\n")
          .slice(0, 1024) || "—",
      inline: false,
    }
  );

  if (syncPlan.unresolved?.length) {
    embed.addFields({
      name: "⚠️ Eşleşmeyen",
      value: syncPlan.unresolved.map((n) => `\`${n}\``).join(", ").slice(0, 1024),
      inline: false,
    });
  }

  embed.addFields(
    {
      name: applied ? "Eklenen" : "Eklenecek",
      value: formatDebugList(applied ? syncPlan.added : syncPlan.toAdd, "None"),
      inline: true,
    },
    {
      name: applied ? "Kaldırılan" : "Kaldırılacak",
      value: formatDebugList(applied ? syncPlan.removed : syncPlan.toRemove, "None"),
      inline: true,
    },
    {
      name: "Yönetilen rol havuzu",
      value: `\`${syncPlan.managedCount}\` rol`,
      inline: true,
    }
  );

  return embed;
}

async function handleDebugUpdate(interaction) {
  const isAdmin =
    ADMIN_IDS.includes(interaction.user.id) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

  if (!isAdmin) {
    return interaction.reply(replyEphemeral("❌ Bu komut yalnızca yöneticiler içindir."));
  }

  if (!interaction.guild) {
    return interaction.reply(replyEphemeral("❌ Bu komut yalnızca sunucuda kullanılabilir."));
  }

  const targetUser = interaction.options.getUser("kullanici") || interaction.user;
  const apply = interaction.options.getBoolean("uygula") ?? false;

  await interaction.deferReply(deferEphemeral());

  try {
    const dbUser = await findUserByDiscordId(targetUser.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id);

    if (!hasRobloxLink(dbUser)) {
      const embed = buildDebugEmbed(targetMember, dbUser, { success: false }, { applied: false });
      return interaction.editReply({ embeds: [embed] });
    }

    const plan = await buildSyncPlan(
      interaction.guild,
      targetMember,
      parseInt(dbUser.robloxId, 10),
      dbUser.robloxUsername
    );

    if (apply && plan.success) {
      const result = await syncMemberRoles(
        interaction.guild,
        targetMember,
        parseInt(dbUser.robloxId, 10),
        dbUser.robloxUsername
      );

      if (result.success && dbUser.groupRole !== result.rankName) {
        dbUser.groupRole = result.rankName;
        await dbUser.save();
      }

      const embed = buildDebugEmbed(
        targetMember,
        dbUser,
        { ...plan, added: result.added, removed: result.removed, success: result.success, message: result.message },
        { applied: true }
      );
      return interaction.editReply({ embeds: [embed] });
    }

    const embed = buildDebugEmbed(targetMember, dbUser, plan, { applied: false });
    embed.setFooter({ text: "Önizleme — uygulamak için uygula: true" });

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("Debug update error:", err);
    return interaction.editReply({
      content: `❌ Debug hatası: ${err.message}`,
    });
  }
}

module.exports = {
  handleVerify,
  handleUpdate,
  handleDebugUpdate,
  runSyncForMember,
  buildUpdateEmbed,
};
