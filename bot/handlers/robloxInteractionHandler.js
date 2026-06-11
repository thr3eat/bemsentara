const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder
} = require("discord.js");
const noblox = require("noblox.js");
const { ROBLOX_GROUPS } = require("../services/robloxGroupManager");

// Müttefik Orduları sunucusundaki grup yönetimi log kanalı
const ALLIED_ROBLOX_LOG_CHANNEL_ID = "1514682098819137727";
const ALLIED_GUILD_ID = "1483482948320891074";

/**
 * Tüm kayıtlı Roblox log kanallarına (TMT + Müttefik) embed gönderir.
 */
async function sendRobloxLog(interaction, embed) {
  const targets = [];

  // 1. TMT log kanalı
  try {
    const { TMT_GUILD_ID, TMT_ROBLOX_RANK_LOG_CHANNEL_ID } = require("../../config");
    const tmtGuild = interaction.client.guilds.cache.get(TMT_GUILD_ID);
    if (tmtGuild) {
      const ch = tmtGuild.channels.cache.get(TMT_ROBLOX_RANK_LOG_CHANNEL_ID);
      if (ch && ch.isTextBased()) targets.push(ch);
    }
  } catch (_) {}

  // 2. Müttefik Orduları log kanalı
  try {
    const alliedGuild = interaction.client.guilds.cache.get(ALLIED_GUILD_ID);
    if (alliedGuild) {
      const ch = alliedGuild.channels.cache.get(ALLIED_ROBLOX_LOG_CHANNEL_ID);
      if (ch && ch.isTextBased()) targets.push(ch);
    }
  } catch (_) {}

  for (const ch of targets) {
    await ch.send({ embeds: [embed] }).catch(err =>
      console.error(`[RobloxLog] ${ch.id} kanalına log gönderilemedi:`, err.message)
    );
  }
}

/**
 * Gelişmiş güvenlik kontrolü.
 * Şu anlık sunucu yöneticisi (Administrator) olanların kullanımına açık.
 */
function isUserAuthorized(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function getDetailedRobloxError(err) {
  const msg = err.message || String(err);
  let detail = `**Orijinal Hata:** \`${msg}\`\n\n`;

  if (msg.includes("You are not logged in") || msg.includes("Cookie") || msg.includes("login") || msg.includes("401")) {
    detail += "🔑 **Muhtemel Neden:** Botun Roblox oturumu (TMTCOOKIE) geçersiz, süresi dolmuş veya hatalı tanımlanmış.\n" +
              "💡 **Çözüm:** `.env` dosyasındaki veya Render.com'daki `TMTCOOKIE` değerini güncelleyin ve botu yeniden başlatın.";
  } else if (msg.includes("403") || msg.includes("Forbidden") || msg.includes("permission") || msg.includes("cannot set the rank") || msg.includes("Roleset is not assignable")) {
    detail += "🚫 **Muhtemel Neden:** Yetki yetersizliği. Botun Roblox grubundaki rütbesi bu işlemi yapmaya yetmiyor.\n" +
              "💡 **Çözüm:** Botun Roblox hesabının grupta **'Manage Lower Ranks' (Alt Rütbeleri Yönet)** yetkisine sahip olduğundan ve hedef kullanıcının rütbesinin botun rütbesinden düşük olduğundan emin olun. (Bot grup sahibinin veya kendisinden üst/eşit bir rütbenin rolünü değiştiremez).";
  } else if (msg.includes("not in group") || msg.includes("is not in group") || msg.includes("400")) {
    detail += "👤 **Muhtemel Neden:** Hedef kullanıcı belirtilen Roblox grubunun üyesi değil veya gruptan çıkmış/atılmış.\n" +
              "💡 **Çözüm:** Kullanıcının gruba katıldığından emin olun.";
  } else if (msg.includes("Too many requests") || msg.includes("429") || msg.includes("rate limit")) {
    detail += "⏳ **Muhtemel Neden:** Roblox API istek sınırı (Rate Limit) aşıldı.\n" +
              "💡 **Çözüm:** Lütfen birkaç dakika bekleyin ve işlemi tekrar deneyin.";
  } else {
    detail += "❓ **Muhtemel Neden:** Roblox API sunucularından kaynaklı geçici bir bağlantı sorunu veya bilinmeyen bir hata oluştu.\n" +
              "💡 **Çözüm:** Giriş bilgilerini ve grup ID'lerini kontrol edip tekrar deneyin.";
  }

  return detail;
}


async function handleRobloxInteractions(interaction) {
  // --- 1. SEÇİM MENÜLERİ (GRUP VE RÜTBE SEÇİMİ) ---
  if (interaction.isStringSelectMenu()) {
    if (!isUserAuthorized(interaction.member)) {
      return interaction.reply({ content: "❌ Bu menüyü kullanmak için yeterli yetkiniz (Yönetici) bulunmuyor.", ephemeral: true });
    }

    if (interaction.customId === "roblox_group_select") {
      const selectedValue = interaction.values[0]; // rbx_grp_ID
      const groupId = selectedValue.replace("rbx_grp_", "");
      const groupName = ROBLOX_GROUPS[groupId] || "Bilinmeyen Grup";

      const embed = new EmbedBuilder()
        .setTitle(`🏢 Seçilen Grup: ${groupName}`)
        .setDescription(`Aşağıdaki butonları kullanarak **${groupName}** (ID: \`${groupId}\`) grubunda işlemler yapabilirsiniz.\n\nLütfen işlem yapmadan önce "Rütbe Listesi" butonuna tıklayarak gruptaki tüm rütbe adlarını/ID'lerini kontrol edin.`)
        .setColor(0x3498DB)
        .setFooter({ text: "İşlemler Roblox API üzerinden anlık olarak gerçekleştirilir." });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`rbx_btn_ranks_${groupId}`)
          .setLabel("Rütbe Listesi")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("📜"),
        new ButtonBuilder()
          .setCustomId(`rbx_btn_changerank_${groupId}`)
          .setLabel("Rütbe Değiştir")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🪖"),
        new ButtonBuilder()
          .setCustomId(`rbx_btn_manual_${groupId}`)
          .setLabel("Manuel İstek")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("➕")
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`rbx_btn_acceptall_${groupId}`)
          .setLabel("Tüm İstekleri Kabul Et")
          .setStyle(ButtonStyle.Success)
          .setEmoji("✅"),
        new ButtonBuilder()
          .setCustomId(`rbx_btn_denyall_${groupId}`)
          .setLabel("Tüm İstekleri Reddet")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("❌")
      );

      return interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
    }

    if (interaction.customId.startsWith("roblox_rank_select")) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const parts = interaction.values[0].split("_");
        // Format: rbx_rank_groupId_userId_newRankId
        const groupId = parts[2];
        const userId = parseInt(parts[3]);
        const newRankId = parseInt(parts[4]);

        const username = await noblox.getUsernameFromId(userId).catch(() => `User:${userId}`);
        
        let oldRoleName = "Bilinmiyor / Grupta Değil";
        try {
          oldRoleName = await noblox.getRankNameInGroup(parseInt(groupId), userId);
        } catch (_) {}

        const newRole = await noblox.setRank({ group: parseInt(groupId), target: userId, rank: newRankId });

        // Ayrıntılı Loglama → TMT + Müttefik kanallarına
        try {
          const groupName = ROBLOX_GROUPS[groupId] || `Grup ID: ${groupId}`;
          const logEmbed = new EmbedBuilder()
            .setTitle("🪖 Roblox Rütbe Değişikliği")
            .setColor(0x2ECC71)
            .addFields(
              { name: "👤 Yetkili", value: `${interaction.user.toString()}\n\`${interaction.user.tag}\``, inline: true },
              { name: "🆔 Yetkili ID", value: `\`${interaction.user.id}\``, inline: true },
              { name: "🏢 Grup", value: `**${groupName}**\nID: \`${groupId}\``, inline: true },
              { name: "👤 Hedef Kullanıcı", value: `**${username}**\nID: \`${userId}\``, inline: true },
              { name: "⏪ Eski Rütbe", value: `**${oldRoleName}**`, inline: true },
              { name: "🆕 Yeni Rütbe", value: `**${newRole.name}**\nRank ID: \`${newRankId}\``, inline: true }
            )
            .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
            .setTimestamp()
            .setFooter({ text: "Roblox Grup Yönetim Sistemi", iconURL: interaction.client.user.displayAvatarURL() });

          await sendRobloxLog(interaction, logEmbed);
        } catch (logErr) {
          console.error("[Roblox Rank Select Log Error]", logErr);
        }

        return interaction.editReply({ content: `✅ İşlem Başarılı!\n**${username}** kullanıcısının rütbesi başarıyla **${newRole.name}** yapıldı.` });
      } catch (err) {
        console.error("[Roblox Rank Select Error]", err);
        const detailedError = getDetailedRobloxError(err);
        return interaction.editReply({ content: `❌ **Rütbe Değiştirme Hatası**\n\n${detailedError}` });
      }
    }
  }

  // --- 2. BUTONLAR ---
  if (interaction.isButton() && interaction.customId.startsWith("rbx_btn_")) {
    if (!isUserAuthorized(interaction.member)) {
      return interaction.reply({ content: "❌ Yetkiniz yok.", ephemeral: true });
    }

    const parts = interaction.customId.split("_");
    const action = parts[2]; // ranks, changerank, manual, acceptall, denyall
    const groupId = parts[3];
    const groupName = ROBLOX_GROUPS[groupId] || "Grup";

    if (action === "ranks") {
      await interaction.deferReply({ ephemeral: true });
      try {
        const roles = await noblox.getRoles(parseInt(groupId));
        const rolesText = roles.map(r => `• **${r.name}** (Rank ID: ${r.rank})`).join("\n");
        const embed = new EmbedBuilder()
          .setTitle(`📜 ${groupName} - Tüm Rütbeler`)
          .setDescription(`Gruptaki tüm rütbeler listelenmiştir:\n\n${rolesText}`)
          .setColor(0x2ECC71);
        
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error("[Roblox Get Ranks Error]", err);
        const detailedError = getDetailedRobloxError(err);
        return interaction.editReply({ content: `❌ **Rütbe Listesi Çekilemedi**\n\n${detailedError}` });
      }
    }

    if (action === "changerank") {
      const modal = new ModalBuilder()
        .setCustomId(`rbx_mod_username_${groupId}`)
        .setTitle("🪖 Rütbe Değiştir");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("roblox_username")
            .setLabel("Roblox Kullanıcı Adı")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    if (action === "manual") {
      const modal = new ModalBuilder()
        .setCustomId(`rbx_mod_manual_${groupId}`)
        .setTitle("➕ İstek Yönetimi (Manuel)");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("roblox_username")
            .setLabel("İstek Atan Kullanıcı Adı")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("action_type")
            .setLabel("Kabul için: evet, Reddetmek için: hayır")
            .setPlaceholder("evet / hayır")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    if (action === "acceptall" || action === "denyall") {
      await interaction.deferReply({ ephemeral: true });
      const isAccept = action === "acceptall";
      try {
        const reqs = await noblox.getJoinRequests({ group: parseInt(groupId), limit: 100 });
        if (!reqs || !reqs.data || reqs.data.length === 0) {
          return interaction.editReply({ content: "ℹ️ Bekleyen katılım isteği bulunmuyor." });
        }

        let count = 0;
        const userList = [];
        for (const r of reqs.data) {
          await noblox.handleJoinRequest(parseInt(groupId), r.requester.userId, isAccept).catch(() => {});
          userList.push(`• ${r.requester.username} (\`${r.requester.userId}\`)`);
          count++;
        }

        // Log → TMT + Müttefik kanallarına
        try {
          const logEmbed = new EmbedBuilder()
            .setTitle(isAccept ? "✅ Toplu Katılım İstekleri Kabul Edildi" : "❌ Toplu Katılım İstekleri Reddedildi")
            .setColor(isAccept ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              { name: "👤 Yetkili", value: `${interaction.user.toString()}\n\`${interaction.user.tag}\``, inline: true },
              { name: "🆔 Yetkili ID", value: `\`${interaction.user.id}\``, inline: true },
              { name: "🏢 Grup", value: `**${groupName}**\nID: \`${groupId}\``, inline: true },
              { name: `📋 ${isAccept ? "Kabul Edilen" : "Reddedilen"} Kullanıcılar (${count})`, value: userList.slice(0, 20).join("\n") + (count > 20 ? `\n...ve ${count - 20} kişi daha` : "") || "—", inline: false }
            )
            .setTimestamp()
            .setFooter({ text: "Roblox Grup Yönetim Sistemi", iconURL: interaction.client.user.displayAvatarURL() });

          await sendRobloxLog(interaction, logEmbed);
        } catch (logErr) {
          console.error("[Roblox AcceptAll/DenyAll Log Error]", logErr);
        }

        return interaction.editReply({ content: `✅ İşlem Başarılı! Toplam **${count}** bekleyen istek **${isAccept ? "kabul edildi" : "reddedildi"}**.` });
      } catch (err) {
        console.error("[Roblox Handle Join Requests Error]", err);
        const detailedError = getDetailedRobloxError(err);
        return interaction.editReply({ content: `❌ **Katılım İstekleri İşlenirken Hata Oluştu**\n\n${detailedError}` });
      }
    }
  }

  // --- 3. MODALLAR (FORM GÖNDERİMİ) ---
  if (interaction.isModalSubmit() && interaction.customId.startsWith("rbx_mod_")) {
    if (!isUserAuthorized(interaction.member)) {
      return interaction.reply({ content: "❌ Yetkiniz yok.", ephemeral: true });
    }

    const parts = interaction.customId.split("_");
    const action = parts[2]; // username, manual
    const groupId = parts[3];

    await interaction.deferReply({ ephemeral: true });

    try {
      if (action === "username") {
        const username = interaction.fields.getTextInputValue("roblox_username").trim();
        const userId = await noblox.getIdFromUsername(username).catch(() => null);
        if (!userId) {
          return interaction.editReply({ content: `❌ **${username}** adında bir Roblox kullanıcısı bulunamadı.` });
        }

        const roles = await noblox.getRoles(parseInt(groupId));
        let currentRoleName = "Grupta Değil";
        try {
          currentRoleName = await noblox.getRankNameInGroup(parseInt(groupId), userId);
        } catch (_) {}

        const selectRows = [];
        const chunkSize = 25;
        for (let i = 0; i < roles.length; i += chunkSize) {
          const chunk = roles.slice(i, i + chunkSize);
          const options = chunk.map(r => ({
            label: `${r.name} (Rank: ${r.rank})`,
            value: `rbx_rank_${groupId}_${userId}_${r.rank}_${r.id}`,
            description: `Rütbe ID: ${r.rank}`
          }));

          const part = Math.floor(i / chunkSize) + 1;
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`roblox_rank_select_${part}`)
            .setPlaceholder(`Yeni rütbeyi seçin (Kısım ${part})...`)
            .addOptions(options);

          selectRows.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        const embed = new EmbedBuilder()
          .setTitle("🪖 Rütbe Değiştir (Aşama 2)")
          .setDescription(`**Kullanıcı:** ${username} (\`${userId}\`)\n**Mevcut Rütbe:** ${currentRoleName}\n\nAşağıdaki menüden atamak istediğiniz yeni rütbeyi seçin:`)
          .setColor(0x3498DB);

        return interaction.editReply({ embeds: [embed], components: selectRows });
      }

      if (action === "manual") {
        const username = interaction.fields.getTextInputValue("roblox_username").trim();
        const actionType = interaction.fields.getTextInputValue("action_type").trim().toLowerCase();
        const isAccept = actionType === "evet" || actionType === "yes" || actionType === "kabul";

        const userId = await noblox.getIdFromUsername(username).catch(() => null);
        if (!userId) {
          return interaction.editReply({ content: `❌ **${username}** adında bir Roblox kullanıcısı bulunamadı.` });
        }

        await noblox.handleJoinRequest(parseInt(groupId), userId, isAccept);

        // Log → TMT + Müttefik kanallarına
        try {
          const manualGroupName = ROBLOX_GROUPS[groupId] || `Grup ID: ${groupId}`;
          const logEmbed = new EmbedBuilder()
            .setTitle(isAccept ? "✅ Manuel Katılım İsteği Onaylandı" : "❌ Manuel Katılım İsteği Reddedildi")
            .setColor(isAccept ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              { name: "👤 Yetkili", value: `${interaction.user.toString()}\n\`${interaction.user.tag}\``, inline: true },
              { name: "🆔 Yetkili ID", value: `\`${interaction.user.id}\``, inline: true },
              { name: "🏢 Grup", value: `**${manualGroupName}**\nID: \`${groupId}\``, inline: true },
              { name: "👤 Hedef Roblox Kullanıcısı", value: `**${username}**\nID: \`${userId}\``, inline: true },
              { name: "📋 İşlem", value: isAccept ? "Gruba Katılım Onaylandı" : "Gruba Katılım Reddedildi", inline: true }
            )
            .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
            .setTimestamp()
            .setFooter({ text: "Roblox Grup Yönetim Sistemi", iconURL: interaction.client.user.displayAvatarURL() });

          await sendRobloxLog(interaction, logEmbed);
        } catch (logErr) {
          console.error("[Roblox Manual Join Log Error]", logErr);
        }

        return interaction.editReply({ content: `✅ İşlem Başarılı!\n**${username}** kullanıcısının gruba katılma isteği başarıyla **${isAccept ? "Onaylandı" : "Reddedildi"}**.` });
      }
    } catch (err) {
      console.error("[Roblox Interaction Error]", err);
      const detailedError = getDetailedRobloxError(err);
      return interaction.editReply({ content: `❌ **İşlem Formu Gönderim Hatası**\n\n${detailedError}` });
    }
  }

  return null;
}

module.exports = { handleRobloxInteractions };
