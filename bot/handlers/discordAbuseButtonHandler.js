const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const { MONITORED_GUILDS } = require("../services/discordAbuseDetector");

/**
 * Discord Abuse butonlarını işler.
 * customId formatları:
 *   disc_abuse_removeroles_{guildId}_{userId}
 *   disc_abuse_kick_{guildId}_{userId}
 *   disc_abuse_ban_{guildId}_{userId}
 *   disc_abuse_ignore_{guildId}_{userId}
 */
async function handleDiscordAbuseButton(interaction) {
  // Sadece yöneticiler ve sistem sahibi kullanabilir
  const { ADMIN_IDS } = require("../../config");
  const isOwner = interaction.user.id === "1031620522406072350";
  const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.Administrator) 
               || ADMIN_IDS.includes(interaction.user.id) 
               || isOwner;

  if (!isAdmin) {
    return interaction.reply({ content: "❌ Bu butonu kullanmak için **Yönetici** yetkisi gereklidir.", ephemeral: true });
  }

  const parts    = interaction.customId.split("_");
  // disc_abuse_{action}_{guildId}_{userId}
  const action   = parts[2]; // removeroles | kick | ban | ignore
  const guildId  = parts[3];
  const userId   = parts[4];
  const gName    = MONITORED_GUILDS[guildId] || `Sunucu \`${guildId}\``;

  // Gece modu sayacını iptal et (eğer varsa)
  const { cancelPendingNightBan } = require("../services/discordAbuseDetector");
  cancelPendingNightBan(guildId, userId);

  // Tüm butonları devre dışı bırak
  function makeDisabledRow(chosenAction) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`disc_abuse_removeroles_${guildId}_${userId}`)
        .setLabel("🗑️ Rolleri Al")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`disc_abuse_kick_${guildId}_${userId}`)
        .setLabel("At")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`disc_abuse_ban_${guildId}_${userId}`)
        .setLabel("Banla")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`disc_abuse_ignore_${guildId}_${userId}`)
        .setLabel(chosenAction === "ignore" ? "🚫 Yoksayıldı" : "🚫 Yoksay")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  }

  // If this is a test simulation, handle it immediately
  if (guildId === "test" || userId === "test") {
    const actionLabel = action === "removeroles" ? "Roller Alındı" : action === "kick" ? "Üye Atıldı" : action === "ban" ? "Üye Banlandı" : "Yoksayıldı";
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(action === "ignore" ? 0x95A5A6 : 0x2ECC71)
      .setTitle(`🚨 Abuse Müdahalesi Gerçekleştirildi (TEST - ${actionLabel})`)
      .setDescription(
        (interaction.message.embeds[0].description || "") +
        `\n\n> **${interaction.user.toString()}** tarafından **TEST** müdahalesi yapıldı: **${action.toUpperCase()}**`
      );
    return interaction.update({ embeds: [updatedEmbed], components: [makeDisabledRow(action)] });
  }


  // ── YOKSAY ──────────────────────────────────────────────────────────────────
  if (action === "ignore") {
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x95A5A6)
      .setTitle("🚫 Abuse Şüphesi — Yoksayıldı")
      .setDescription(
        (interaction.message.embeds[0].description || "") +
        `\n\n> ✅ **${interaction.user.toString()}** tarafından yoksayıldı.`
      );
    return interaction.update({ embeds: [updatedEmbed], components: [makeDisabledRow("ignore")] });
  }

  await interaction.deferUpdate();

  // Hedef sunucuyu al
  let targetGuild = null;
  try {
    targetGuild = interaction.client.guilds.cache.get(guildId)
      || await interaction.client.guilds.fetch(guildId).catch(() => null);
  } catch (_) {}

  if (!targetGuild) {
    return interaction.editReply({
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xE74C3C)
          .setDescription((interaction.message.embeds[0].description || "") + "\n\n❌ **Hata:** Hedef sunucuya erişilemiyor.")
      ],
      components: [makeDisabledRow(action)]
    });
  }

  // Hedef üyeyi al
  let targetMember = null;
  try {
    targetMember = await targetGuild.members.fetch(userId).catch(() => null);
  } catch (_) {}

  let resultText = "";
  let resultColor = 0xFF6B00;

  try {
    // ── ROLLERİ AL ────────────────────────────────────────────────────────────
    if (action === "removeroles") {
      if (!targetMember) {
        resultText = "❌ Kullanıcı sunucuda bulunamadı.";
        resultColor = 0xE74C3C;
      } else {
        const removable = targetMember.roles.cache.filter(r =>
          r.id !== targetGuild.id && // @everyone değil
          !r.managed &&             // Bot tarafından yönetilmiyor
          targetGuild.members.me?.roles.highest.comparePositionTo(r) > 0 // Botun altında
        );

        if (removable.size === 0) {
          resultText = "ℹ️ Alınabilecek rol bulunamadı (tüm roller botun üstünde veya yönetilen roller).";
          resultColor = 0xF39C12;
        } else {
          await targetMember.roles.remove(removable, `Abuse müdahalesi — ${interaction.user.tag} tarafından`);
          resultText =
            `✅ **${targetMember.user.tag}** kullanıcısından **${removable.size}** rol başarıyla alındı.\n` +
            `Alınan Roller: ${removable.map(r => `\`${r.name}\``).join(", ").slice(0, 500)}`;
          resultColor = 0x2ECC71;
        }
      }
    }

    // ── AT ────────────────────────────────────────────────────────────────────
    if (action === "kick") {
      if (!targetMember) {
        resultText = "❌ Kullanıcı sunucuda bulunamadı (zaten ayrılmış olabilir).";
        resultColor = 0xE74C3C;
      } else if (!targetMember.kickable) {
        resultText = "❌ Kullanıcı atılamıyor (üst rütbe veya bot koruması).";
        resultColor = 0xE74C3C;
      } else {
        await targetMember.kick(`Abuse müdahalesi — ${interaction.user.tag} tarafından`);
        resultText  = `✅ **${targetMember.user.tag}** kullanıcısı **${gName}** sunucusundan başarıyla atıldı.`;
        resultColor = 0x2ECC71;
      }
    }

    // ── BANLA ─────────────────────────────────────────────────────────────────
    if (action === "ban") {
      // Üye sunucuda olmasa da banlanabilir
      const bannable = targetMember ? targetMember.bannable : true;
      if (!bannable) {
        resultText  = "❌ Kullanıcı banlanamıyor (üst rütbe veya bot koruması).";
        resultColor = 0xE74C3C;
      } else {
        await targetGuild.members.ban(userId, {
          reason:      `Abuse müdahalesi — ${interaction.user.tag} tarafından`,
          deleteMessageSeconds: 86400 // Son 1 günlük mesajları sil
        });
        const tag   = targetMember?.user.tag || `ID: ${userId}`;
        resultText  = `✅ **${tag}** kullanıcısı **${gName}** sunucusundan başarıyla **banlandı**. (Son 24 saatlik mesajları silindi.)`;
        resultColor = 0x2ECC71;
      }
    }
  } catch (err) {
    console.error(`[DiscordAbuseButton] ${action} işlemi başarısız:`, err.message);
    resultText  = `❌ İşlem başarısız: \`${err.message}\``;
    resultColor = 0xE74C3C;
  }

  // Log embed — TMT log kanalına da gönder
  try {
    const logEmbed = new EmbedBuilder()
      .setTitle(`🚨 Discord Abuse Müdahalesi — ${action === "removeroles" ? "Roller Alındı" : action === "kick" ? "Üye Atıldı" : "Üye Banlandı"}`)
      .setColor(resultColor)
      .addFields(
        { name: "👤 Müdahaleyi Yapan",    value: `${interaction.user.toString()}\n\`${interaction.user.tag}\``,         inline: true },
        { name: "🏠 Müdahale Edilen Sunucu", value: `**${gName}**\nID: \`${guildId}\``,                                 inline: true },
        { name: "🎯 Hedef Kullanıcı",     value: `<@${userId}> (\`${userId}\`)`,                                        inline: true },
        { name: "📋 Sonuç",               value: resultText.slice(0, 1024),                                              inline: false }
      )
      .setTimestamp()
      .setFooter({ text: "Sentara Discord Abuse Müdahale Sistemi", iconURL: interaction.client.user.displayAvatarURL() });

    const { TMT_GUILD_ID, TMT_ROBLOX_RANK_LOG_CHANNEL_ID } = require("../../config");
    const tmtGuild = interaction.client.guilds.cache.get(TMT_GUILD_ID);
    if (tmtGuild) {
      const logCh = tmtGuild.channels.cache.get(TMT_ROBLOX_RANK_LOG_CHANNEL_ID);
      if (logCh && logCh.isTextBased()) await logCh.send({ embeds: [logEmbed] }).catch(() => {});
    }
  } catch (_) {}

  // Alert mesajını güncelle
  const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(resultColor)
    .setTitle("🚨 Abuse Müdahalesi Gerçekleştirildi")
    .setDescription(
      (interaction.message.embeds[0].description || "") +
      `\n\n> **${interaction.user.toString()}** tarafından müdahale edildi:\n> ${resultText}`
    );

  await interaction.editReply({
    embeds:     [updatedEmbed],
    components: [makeDisabledRow(action)]
  });
}

module.exports = { handleDiscordAbuseButton };
