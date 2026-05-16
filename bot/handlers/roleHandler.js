const axios = require("axios");
const { EmbedBuilder } = require("discord.js");

const MAIN_GROUP_ID = 8505535;

// Fetch user's rank in a Roblox group
async function getUserGroupRank(userId) {
  try {
    const response = await axios.get(
      `https://groups.roblox.com/v1/users/${userId}/groups/roles`,
      { timeout: 5000 }
    );
    
    const groupRole = response.data.data.find(g => g.group.id === MAIN_GROUP_ID);
    if (groupRole) {
      return {
        rankId: groupRole.role.id,
        rankName: groupRole.role.name,
      };
    }
    return null;
  } catch (err) {
    console.error(`Error fetching rank for user ${userId}:`, err.message);
    return null;
  }
}

// Fetch all ranks in a group
async function getGroupRanks() {
  try {
    const response = await axios.get(
      `https://groups.roblox.com/v1/groups/${MAIN_GROUP_ID}/roles`,
      { timeout: 5000 }
    );
    return response.data.roles;
  } catch (err) {
    console.error(`Error fetching group ${MAIN_GROUP_ID} ranks:`, err.message);
    return [];
  }
}

// Find Discord role by name (matches Roblox rank name)
function findDiscordRole(guild, rankName) {
  return guild.roles.cache.find(
    r => r.name.toLowerCase() === rankName.toLowerCase() &&
         !r.managed && 
         r.id !== guild.id
  );
}

// Handle /verify command
async function handleVerify(interaction) {
  const { user, guild, member } = interaction;

  // Fetch user from database to get Roblox ID
  const User = require("../../models/User");
  const dbUser = await User.findOne({ discordId: user.id });

  if (!dbUser || !dbUser.robloxId) {
    return interaction.reply({
      content: "❌ Roblox hesabınız bağlı değil! `/authorize` komutu ile bağlantı yapın.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get user's rank in group
    const rank = await getUserGroupRank(parseInt(dbUser.robloxId));

    if (!rank) {
      return interaction.editReply({
        content: `❌ Siz bu grubun üyesi değilsiniz!`,
      });
    }

    // Find matching Discord role
    const discordRole = findDiscordRole(guild, rank.rankName);

    if (!discordRole) {
      return interaction.editReply({
        content: `⚠️ Roblox rankunuz: **${rank.rankName}**\n\nAncak bu rütbe adında Discord rolü bulunamadı. Sunucu yöneticisine başvurun.`,
      });
    }

    // Add role to user
    if (!member.roles.cache.has(discordRole.id)) {
      await member.roles.add(discordRole);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Rol Senkronize Edildi!")
      .setDescription(`Roblox rankunuz: **${rank.rankName}**`)
      .addFields(
        { name: "Discord Rolü", value: `<@&${discordRole.id}>`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("Verify command error:", err);
    return interaction.editReply({
      content: `❌ Bir hata oluştu: ${err.message}`,
    });
  }
}

// Handle /update command (update all members)
async function handleUpdate(interaction) {
  const { guild } = interaction;

  if (!interaction.memberPermissions.has("ADMINISTRATOR")) {
    return interaction.reply({
      content: "❌ Bu komutu kullanmak için yönetici izniniz gerekiyor!",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("🔄 Roller Güncelleniyor...")
      .setDescription("Tüm sunucu üyelerinin Roblox rolleri senkronize ediliyor.");

    await interaction.editReply({ embeds: [embed] });

    const User = require("../../models/User");
    let processed = 0;
    let updated = 0;
    let errors = 0;

    // Get all members
    const members = await guild.members.fetch();

    for (const [, member] of members) {
      try {
        if (member.user.bot) continue;

        // Fetch user from database
        const dbUser = await User.findOne({ discordId: member.id });

        if (!dbUser || !dbUser.robloxId) {
          processed++;
          continue;
        }

        // Get user's rank in group
        const rank = await getUserGroupRank(parseInt(dbUser.robloxId));

        if (rank) {
          const discordRole = findDiscordRole(guild, rank.rankName);

          if (discordRole) {
            if (!member.roles.cache.has(discordRole.id)) {
              await member.roles.add(discordRole);
              updated++;
            }
          }
        }

        processed++;

        // Rate limit protection
        if (processed % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Error updating member ${member.id}:`, err.message);
        errors++;
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Rol Güncelleme Tamamlandı!")
      .addFields(
        { name: "İşlenen Üyeler", value: `${processed}`, inline: true },
        { name: "Güncellenen Roller", value: `${updated}`, inline: true },
        { name: "Hatalar", value: `${errors}`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [resultEmbed] });
  } catch (err) {
    console.error("Update command error:", err);
    return interaction.editReply({
      content: `❌ Bir hata oluştu: ${err.message}`,
    });
  }
}

module.exports = {
  handleVerify,
  handleUpdate,
  getUserGroupRank,
  getGroupRanks,
  findDiscordRole,
};