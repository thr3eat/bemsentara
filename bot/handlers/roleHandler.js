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
        name: "Seviye Rolü",
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
    console.error("Role sync error:", err);
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
