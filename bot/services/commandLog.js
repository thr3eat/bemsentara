const { EmbedBuilder } = require("discord.js");
const { LOG_CHANNEL_ID, TARGET_GUILD_ID } = require("../../config");
const { getDiscordClient } = require("../discordClient");

function formatRoles(roles) {
  if (!roles?.length) return "None";
  return roles.map((r) => `<@&${r.id}>`).join("\n").slice(0, 1024);
}

async function sendCommandLog(embed) {
  const client = getDiscordClient();
  if (!client?.isReady() || !LOG_CHANNEL_ID) return;

  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    const channel = await guild.channels.fetch(LOG_CHANNEL_ID);
    if (channel?.isSendable()) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.warn("[commandLog] Kanala yazılamadı:", err.message);
  }
}

function logAuthorize(interaction, { authUrl, dbUser }) {
  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle("🔐 /authorize")
    .setDescription(`<@${interaction.user.id}> yetkilendirme bağlantısı istedi.`)
    .addFields(
      { name: "Discord", value: `<@${interaction.user.id}>\n\`${interaction.user.id}\``, inline: true },
      {
        name: "Roblox (DB)",
        value: dbUser?.robloxId
          ? `✅ ${dbUser.robloxUsername || "?"}\n\`${dbUser.robloxId}\``
          : "❌ Henüz bağlı değil",
        inline: true,
      },
      { name: "Kanal", value: `<#${interaction.channelId}>`, inline: true },
      { name: "Bağlantı", value: authUrl, inline: false }
    )
    .setFooter({ text: "Sentara • Komut Logu" })
    .setTimestamp();

  sendCommandLog(embed);
}

function logUpdate(interaction, { commandName, result, dbUser, error, notLinked }) {
  const cmd = commandName === "verify" ? "/verify" : "/update";
  const color = notLinked || error || result?.success === false ? 0xed4245 : 0x5865f2;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(notLinked ? `${cmd} — Bağlı değil` : `${cmd} — ${result?.success ? "Update" : "Hata"}`)
    .setDescription(`<@${interaction.user.id}> komutu kullandı.`)
    .addFields(
      { name: "Discord", value: `<@${interaction.user.id}>\n\`${interaction.user.id}\``, inline: true },
      {
        name: "Roblox",
        value: dbUser?.robloxId
          ? `**${dbUser.robloxUsername || "?"}**\n\`${dbUser.robloxId}\``
          : "—",
        inline: true,
      },
      { name: "Kanal", value: `<#${interaction.channelId}>`, inline: true }
    )
    .setFooter({ text: "Sentara • Komut Logu" })
    .setTimestamp();

  if (notLinked) {
    embed.addFields({
      name: "Durum",
      value: "❌ Roblox hesabı bağlı değil",
      inline: false,
    });
  } else if (error) {
    embed.addFields({
      name: "Durum",
      value: `❌ ${error}`,
      inline: false,
    });
  } else if (result && !result.success) {
    embed.addFields({
      name: "Durum",
      value: `❌ ${result.message || result.error}`,
      inline: false,
    });
  } else if (result?.success) {
    embed.addFields(
      {
        name: "Nickname",
        value: result.nickname || interaction.user.username,
        inline: false,
      },
      {
        name: "Rütbe",
        value: result.rankName || "—",
        inline: true,
      },
      {
        name: "Seviye",
        value: result.tier || "—",
        inline: true,
      },
      {
        name: "Branş",
        value: result.branch?.departmentRoleName || "Branşsız",
        inline: true,
      },
      {
        name: "Added Roles",
        value: formatRoles(result.added),
        inline: false,
      },
      {
        name: "Removed Roles",
        value: formatRoles(result.removed),
        inline: false,
      }
    );

    if (result.unresolved?.length) {
      embed.addFields({
        name: "⚠️ Eşleşmeyen",
        value: result.unresolved.map((n) => `\`${n}\``).join(", ").slice(0, 1024),
        inline: false,
      });
    }
  }

  sendCommandLog(embed);
}

module.exports = { logAuthorize, logUpdate, sendCommandLog };
