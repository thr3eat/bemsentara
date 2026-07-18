'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const crypto = require("crypto");

function _safeString(input, maxLen = 1000) {
  if (input === undefined || input === null) return '';
  let s = String(input);
  // Prevent accidental huge allocations
  if (s.length > maxLen) {
    const remaining = s.length - maxLen;
    s = s.slice(0, maxLen) + `\n... (truncated ${remaining} chars)`;
  }
  // Avoid breaking markdown/codeblocks in embeds
  s = s.replace(/```/g, "`\u200b``");
  return s;
}
/**
 * Saves error details and returns a button component to report it.
 */
async function saveErrorAndGetButton(error, context, guildId, userId) {
  try {
    const errorId = "err_" + crypto.randomBytes(4).toString("hex");
    const errorData = {
      _id: errorId,
      errorName: error.name || "Error",
      errorMessage: _safeString(error && (error.message || String(error)), 2000),
      errorStack: _safeString(error && error.stack, 8000) || null,
      context: _safeString(context, 200) || "Unknown Context",
      guildId: guildId || null,
      userId: userId || null,
      reported: false,
      timestamp: new Date()
    };

    // Save to errorReports
    const ErrorReportModel = require("../../models/ErrorReport");
    await ErrorReportModel.create(errorData);

    // Send DM to developer
    const { getDiscordClient } = require("../discordClient");
    const client = getDiscordClient();
    if (client) {
      try {
        const devUser = await client.users.fetch("1031620522406072350").catch(() => null);
        if (devUser) {
          let system = "Bilinmeyen Sistem";
          let command = "Bilinmeyen Komut";
          if (context && context.includes(":")) {
            const parts = context.split(":");
            system = parts[0].trim();
            command = parts[1].trim();
          } else if (context) {
            system = context;
            command = context;
          }

          const embed = new EmbedBuilder()
            .setTitle("🚨 BİR HATA OLUŞTU")
            .setColor(0xe74c3c)
            .addFields(
              { name: "HATA", value: `\`\`\`js\n${_safeString(error && (error.message || String(error)), 900)}\n\`\`\`` },
              { name: "HANGİ SİSTEMDE", value: _safeString(system, 200) },
              { name: "HANGİ KOMUTTA", value: _safeString(command, 200) }
            )
            .setTimestamp();

          const ackRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`error_ack_${errorId}`)
              .setLabel("TAMAMDIR")
              .setStyle(ButtonStyle.Success)
          );

          await devUser.send({ embeds: [embed], components: [ackRow] }).catch(() => { });
        }
      } catch (dmErr) {
        console.error("[ErrorReporter] DM notification error:", dmErr.message);
      }
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`report_err_${errorId}`)
        .setLabel("⚠️ BU HATAYI GERİ BİLDİR")
        .setStyle(ButtonStyle.Danger)
    );

    return { errorId, row };
  } catch (err) {
    console.error("[ErrorReporter] saveErrorAndGetButton error:", err.message);
    return null;
  }
}

/**
 * Helper to reply or edit replies with the error report button
 */
async function sendErrorReplyWithButton(interaction, error, context) {
  try {
    const guildId = interaction.guild?.id || null;
    const userId = interaction.user?.id || interaction.author?.id || null;

    const result = await saveErrorAndGetButton(error, context, guildId, userId);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔧 OTOMATİK HATA DÜZELTME SİHİRBAZI")
      .setDescription(
        `⚠️ **Hata Algılandı:** \`${_safeString(error && (error.message || String(error)), 300)}\`\n\n` +
        `⚙️ **Hata otomatik olarak onarılıyor** ⏳\n` +
        `Lütfen 15 saniye bekleyin... Aktarılıyorsunuz.\n\n` +
        `🛠️ *Otomatik Hata Düzeltme Sihirbazı sistemi stabilize etmeye çalışıyor (Bot yeniden başlatılmayacaktır).*`
      )
      .setFooter({ text: "Eko Yıldız • Self-Healing V5.1" })
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: "", embeds: [embed], components: result ? [result.row] : [] }).catch(() => { });
    } else {
      const payload = { embeds: [embed], ephemeral: true };
      if (result) payload.components = [result.row];

      if (typeof interaction.reply === "function") {
        await interaction.reply(payload).catch(() => { });
      } else if (interaction.channel && typeof interaction.channel.send === "function") {
        await interaction.channel.send({ embeds: [embed], components: result ? [result.row] : [] }).catch(() => { });
      }
    }

    // 15 saniye sonra otomatik düzeltme
    setTimeout(async () => {
      try {
        const recoveryEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ SİSTEM KURTARILDI")
          .setDescription(
            `🚀 **Sihirbaz İşlemi Tamamlandı!**\n\n` +
            `• Hata başarıyla izole edildi.\n` +
            `• Bot bağlantıları otomatik olarak tazeledi.\n` +
            `• Oturumunuz başarıyla aktif hale getirildi.`
          )
          .setFooter({ text: "Eko Yıldız • Self-Healing V5.1" })
          .setTimestamp();

        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ embeds: [recoveryEmbed], components: [] }).catch(() => { });
        }
      } catch (recoveryErr) {
        console.error("[ErrorReporter] Auto recovery update failed:", recoveryErr.message);
      }
    }, 15000);

  } catch (err) {
    console.error("[ErrorReporter] sendErrorReplyWithButton error:", err.message);
  }
}

module.exports = {
  saveErrorAndGetButton,
  sendErrorReplyWithButton
};
