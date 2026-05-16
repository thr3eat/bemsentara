const { EmbedBuilder } = require("discord.js");
const User = require("../../models/User");
const { BASE_URL } = require("../../config");
const { syncMemberRoles } = require("../services/roleSyncService");

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

async function runSyncForMember(interaction, { ephemeral = true } = {}) {
  const { guild, member, user } = interaction;

  if (!guild) {
    return interaction.reply({
      content: "❌ Bu komut yalnızca sunucuda kullanılabilir.",
      ephemeral: true,
    });
  }

  const dbUser = await User.findOne({ discordId: user.id });

  if (!dbUser?.robloxId) {
    const authUrl = `${BASE_URL}/auth/authorize?discordId=${user.id}`;
    return interaction.reply({
      content: `❌ Roblox hesabınız bağlı değil. Önce hesabınızı bağlayın:\n🔗 [Roblox Hesabını Bağla](${authUrl})\nveya \`/authorize\` komutunu kullanın.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral });

  try {
    const fullMember = member.partial ? await member.fetch() : member;
    const result = await syncMemberRoles(
      guild,
      fullMember,
      parseInt(dbUser.robloxId, 10),
      dbUser.robloxUsername
    );

    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.message}`,
      });
    }

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
    return interaction.editReply({
      content: `❌ Bir hata oluştu: ${err.message}`,
    });
  }
}

async function handleVerify(interaction) {
  return runSyncForMember(interaction, { ephemeral: true });
}

async function handleUpdate(interaction) {
  return runSyncForMember(interaction, { ephemeral: false });
}

module.exports = {
  handleVerify,
  handleUpdate,
  runSyncForMember,
  buildUpdateEmbed,
};
