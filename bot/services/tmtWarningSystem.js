const { EmbedBuilder } = require("discord.js");
const User = require("../../models/User");
const { saveStoreNow } = require("../../models/Store");

const TMT_WARN_LOG_CHANNEL_ID = "1514583180173381682";

async function handleTMTAutoModViolation(execution, client) {
  try {
    const { ruleId, userId, content, matchedKeyword } = execution;
    const guild = execution.guild;
    
    // Fetch the rule to check its name
    const rule = await guild.autoModerationRules.fetch(ruleId).catch(() => null);
    if (!rule) return;

    // Ignore 1.0 Kişisel Bilgiler because it has its own instant ban handler
    if (rule.name.includes("1.0 Kişisel Bilgiler")) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member || member.user.bot) return;

    // Get or create user from DB/Store
    let dbUser = await User.findOne({ discordId: userId });
    if (!dbUser) {
      dbUser = await User.create({ discordId: userId, robloxUsername: member.user.username });
    }

    // Initialize/Increment warnings
    if (!dbUser.tmtWarnings) {
      dbUser.tmtWarnings = 0;
    }
    dbUser.tmtWarnings += 1;
    await dbUser.save();
    saveStoreNow();

    const warnCount = dbUser.tmtWarnings;
    let actionTaken = "Uyarı";
    let durationText = "";
    let timeoutMs = 0;
    let shouldBan = false;

    if (warnCount === 4) {
      timeoutMs = 10 * 60 * 1000; // 10 minutes
      actionTaken = "10 Dakika Susturma";
      durationText = "10 dakika";
    } else if (warnCount === 5) {
      timeoutMs = 60 * 60 * 1000; // 1 hour
      actionTaken = "1 Saat Susturma";
      durationText = "1 saat";
    } else if (warnCount === 6) {
      timeoutMs = 24 * 60 * 60 * 1000; // 1 day
      actionTaken = "1 Gün Susturma";
      durationText = "1 gün";
    } else if (warnCount >= 7) {
      shouldBan = true;
      actionTaken = "Sunucudan Yasaklama (Ban)";
    }

    // DM Warning
    let dmMsg = `⚠️ **[TMT] AutoMod Uyarısı!**\n` +
      `TMT sunucusunda **${rule.name}** kuralını ihlal ettiniz.\n` +
      `**İhlal Edilen Mesaj:** \`${content || "Mesaj içeriği bulunamadı"}\`\n` +
      `**Toplam Uyarı Sayınız:** ${warnCount}/3 (3 uyarıdan sonra cezai işlem uygulanır.)\n\n`;

    if (timeoutMs > 0) {
      dmMsg += `❌ Çok fazla kural ihlali yaptığınız için **${durationText}** boyunca susturuldunuz.`;
    } else if (shouldBan) {
      dmMsg += `🚫 Sınırı aştığınız için sunucudan süresiz olarak yasaklandınız.`;
    } else {
      dmMsg += `Lütfen kurallara dikkat edin, aksi takdirde susturma veya ban cezası alacaksınız.`;
    }

    await member.user.send(dmMsg).catch(() => {
      console.log(`[TMT Warning] Could not send DM to user ${member.user.tag}`);
    });

    // Apply Punishment on Discord
    if (timeoutMs > 0 && member.moderatable) {
      await member.timeout(timeoutMs, `TMT AutoMod: 3+ Kural İhlali (${warnCount}. Uyarı)`).catch(err => {
        console.error(`[TMT Warning] Timeout error:`, err.message);
      });
    } else if (shouldBan && member.bannable) {
      await member.ban({ reason: `TMT AutoMod: Çok Fazla Kural İhlali (${warnCount}. Uyarı)` }).catch(err => {
        console.error(`[TMT Warning] Ban error:`, err.message);
      });
    }

    // Log to Warning Channel
    const warnChannel = await guild.channels.fetch(TMT_WARN_LOG_CHANNEL_ID).catch(() => null);
    if (warnChannel && warnChannel.isSendable()) {
      const logEmbed = new EmbedBuilder()
        .setTitle("⚠️ TMT AutoMod İhlal Kaydı")
        .setColor(shouldBan ? 0xed4245 : timeoutMs > 0 ? 0xe67e22 : 0xf1c40f)
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: "Kullanıcı", value: `${member.toString()}\n\`${member.id}\``, inline: true },
          { name: "Kural", value: rule.name, inline: true },
          { name: "Uyarı Sayısı", value: `**${warnCount}**`, inline: true },
          { name: "Tetikleyen Kelime", value: matchedKeyword || "Regex/Spam", inline: true },
          { name: "Uygulanan İşlem", value: `**${actionTaken}**`, inline: true },
          { name: "Mesaj İçeriği", value: `\`\`\`${content || "İçerik Yok"}\`\`\``, inline: false }
        )
        .setFooter({ text: "TMT Otomatik Moderasyon Sistemi" })
        .setTimestamp();

      await warnChannel.send({ embeds: [logEmbed] });
    }

  } catch (error) {
    console.error("[TMT Warning System Error]", error);
  }
}

module.exports = { handleTMTAutoModViolation };
