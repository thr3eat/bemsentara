const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const { BAN_LOG_CHANNEL_ID, TARGET_GUILD_ID } = require("../../config");
const { getDiscordClient } = require("../discordClient");

async function sendBanLog(embed) {
  const client = getDiscordClient();
  if (!client?.isReady() || !BAN_LOG_CHANNEL_ID) return;

  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    const channel = await guild.channels.fetch(BAN_LOG_CHANNEL_ID);
    if (channel?.isSendable()) await channel.send({ embeds: [embed] });
  } catch (err) {
    console.warn("[banLog]", err.message);
  }
}

async function fetchBanExecutor(guild, userId, type) {
  try {
    const logs = await guild.fetchAuditLogs({
      type: type === "ban" ? AuditLogEvent.MemberBanAdd : AuditLogEvent.MemberBanRemove,
      limit: 5,
    });
    const entry = logs.entries.find(
      (e) => e.target?.id === userId && Date.now() - e.createdTimestamp < 15000
    );
    return entry?.executor || null;
  } catch {
    return null;
  }
}

function logBanAdd(ban) {
  fetchBanExecutor(ban.guild, ban.user.id, "ban").then((executor) => {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("🚫 Kullanıcı Yasaklandı")
      .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "Kullanıcı", value: `${ban.user.tag}\n\`${ban.user.id}\``, inline: true },
        {
          name: "Yetkili",
          value: executor ? `${executor.tag}\n\`${executor.id}\`` : "Bilinmiyor",
          inline: true,
        },
        { name: "Sebep", value: ban.reason || "Belirtilmedi", inline: false }
      )
      .setFooter({ text: "Sentara • Ban Log" })
      .setTimestamp();
    sendBanLog(embed);
  });
}

function logBanRemove(ban) {
  fetchBanExecutor(ban.guild, ban.user.id, "unban").then((executor) => {
    const embed = new EmbedBuilder()
      .setColor(0x4ade80)
      .setTitle("✅ Yasak Kaldırıldı")
      .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "Kullanıcı", value: `${ban.user.tag}\n\`${ban.user.id}\``, inline: true },
        {
          name: "Yetkili",
          value: executor ? `${executor.tag}\n\`${executor.id}\`` : "Bilinmiyor",
          inline: true,
        }
      )
      .setFooter({ text: "Sentara • Ban Log" })
      .setTimestamp();
    sendBanLog(embed);
  });
}

module.exports = { logBanAdd, logBanRemove, sendBanLog };
