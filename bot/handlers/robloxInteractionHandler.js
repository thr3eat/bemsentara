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
  // ─── 0. ARKADAŞ İSTEĞİ İLE HESAP DOĞRULAMA (2. YÖNTEM) ──────────────────────
  if (interaction.customId === "rbx_btn_verify_friend_start") {
    const modal = new ModalBuilder()
      .setCustomId("rbx_mod_verify_friend_username")
      .setTitle("Roblox Arkadaş Doğrulaması");

    const usernameInput = new TextInputBuilder()
      .setCustomId("rbx_username_input")
      .setLabel("Roblox Kullanıcı Adınız")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("örn: RobloxUser")
      .setRequired(true)
      .setMaxLength(50);

    modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
    return interaction.showModal(modal);
  }

  if (interaction.customId === "rbx_mod_verify_friend_username") {
    await interaction.deferReply({ ephemeral: true });
    const username = interaction.fields.getTextInputValue("rbx_username_input").trim();
    try {
      const robloxId = await noblox.getIdFromUsername(username);
      if (!robloxId) {
        return interaction.editReply({ content: "❌ Roblox kullanıcı adı bulunamadı. Lütfen doğru yazdığınızdan emin olun." });
      }

      // Arkadaşlık isteği gönder
      const { getFriendJar, getOrFetchFriendBotId } = require("../services/robloxGroupManager");
      const friendJar = getFriendJar();
      
      let requestSent = false;
      try {
        await noblox.sendFriendRequest({ userId: robloxId, jar: friendJar });
        requestSent = true;
      } catch (err) {
        const errMsg = err.message || "";
        if (errMsg.includes("already friends") || errMsg.includes("Cannot send friend request to friends") || errMsg.includes("are already friends")) {
          requestSent = true;
        } else {
          console.error("sendFriendRequest error:", err);
          return interaction.editReply({ 
            content: `❌ Arkadaşlık isteği gönderilemedi.\n**Neden:** Roblox profilinizin arkadaşlık isteklerine açık olduğundan veya botun arkadaşlık isteği limitlerinin dolmadığından emin olun.\n*Hata detayı:* \`${errMsg}\`` 
          });
        }
      }

      // Bot Roblox ID'sini al
      const botRobloxId = await getOrFetchFriendBotId();
      const botProfileUrl = botRobloxId ? `https://www.roblox.com/users/${botRobloxId}/profile` : "https://www.roblox.com";

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("🤖 Roblox Arkadaşlık Doğrulaması")
        .setDescription(
          `**${username}** (ID: \`${robloxId}\`) hesabına arkadaşlık isteği gönderildi.\n\n` +
          `**Yapılması Gerekenler:**\n` +
          `1. Roblox hesabınıza giriş yapın.\n` +
          `2. **[Botun Roblox Profiline Gitmek İçin Tıklayın](${botProfileUrl})** ve gelen arkadaşlık isteğini kabul edin.\n` +
          `3. İsteği kabul ettikten sonra aşağıdaki **Doğrulamayı Tamamla** butonuna tıklayın.\n\n` +
          `*Not: Doğrulama tamamlandıktan sonra bot sizi otomatik olarak arkadaşlıktan çıkaracaktır.*`
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`rbx_btn_verify_friend_confirm_${robloxId}_${username}`)
          .setLabel("✅ Doğrulamayı Tamamla")
          .setStyle(ButtonStyle.Success)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error("Verification start error:", err);
      return interaction.editReply({ content: `❌ Bir hata oluştu: \`${err.message}\`` });
    }
  }

  if (interaction.customId && interaction.customId.startsWith("rbx_btn_verify_friend_confirm_")) {
    await interaction.deferReply({ ephemeral: true });
    const parts = interaction.customId.split("_");
    const robloxId = parts[5];
    const username = parts.slice(6).join("_");

    try {
      const { getFriendJar, getOrFetchFriendBotId } = require("../services/robloxGroupManager");
      const botRobloxId = await getOrFetchFriendBotId();
      const friendJar = getFriendJar();
      if (!botRobloxId || !friendJar) {
        return interaction.editReply({ content: "❌ Botun Roblox bağlantısı şu an aktif değil. Lütfen daha sonra tekrar deneyin." });
      }

      // Arkadaşlık listesini kontrol et
      const friends = await noblox.getFriends({ userId: botRobloxId, jar: friendJar });
      const isFriend = friends && friends.data && friends.data.some(f => String(f.id) === String(robloxId));

      if (!isFriend) {
        return interaction.editReply({ 
          content: "❌ **Arkadaşlık isteği kabul edilmemiş.** Lütfen botun gönderdiği arkadaşlık isteğini kabul ettiğinizden emin olun ve tekrar deneyin." 
        });
      }

      // Veritabanına kaydet
      const User = require("../../models/User");
      const { saveStoreNow } = require("../../models/Store");
      let dbUser = await User.findOne({ discordId: interaction.user.id });
      if (!dbUser) {
        const { ensureDiscordUser } = require("../../utils/userLink");
        dbUser = await ensureDiscordUser(interaction.user);
      }

      dbUser.robloxId = String(robloxId);
      dbUser.robloxUsername = username;
      dbUser.isAuthorized = true;
      await dbUser.save();
      saveStoreNow();

      // Sunucuya göre rolleri senkronize et
      const { TARGET_GUILD_ID, TMT_GUILD_ID, ALLIED_GUILD_ID, GUILD2_ID } = require("../../config");
      const guild = interaction.guild;
      let syncSuccess = false;

      if (guild) {
        const guildId = String(guild.id).trim();
        const normalizedTMT = String(TMT_GUILD_ID).trim();
        const normalizedBEM = String(TARGET_GUILD_ID).trim();
        const normalizedEKO = String(GUILD2_ID).trim();
        const normalizedAllied = String(ALLIED_GUILD_ID).trim();
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);

        if (member) {
          if (guildId === normalizedAllied) {
            const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
            const result = await syncAlliedRoles(interaction.client, interaction.user.id, parseInt(robloxId, 10), guild);
            syncSuccess = result.success;
          } else if (guildId === normalizedTMT) {
            const { syncTMTRoles } = require("../services/tmtRoleSyncService");
            const result = await syncTMTRoles(interaction.client, interaction.user.id, parseInt(robloxId, 10), member);
            syncSuccess = result?.success || false;
          } else if (guildId === normalizedBEM) {
            const { syncMemberRoles } = require("../services/roleSyncService");
            const result = await syncMemberRoles(guild, member, parseInt(robloxId, 10), username);
            syncSuccess = result?.success || false;
          } else if (guildId === normalizedEKO) {
            const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
            const result = await syncAlliedRoles(interaction.client, interaction.user.id, parseInt(robloxId, 10), guild);
            syncSuccess = result?.success || false;
          }
        }
      }

      // Arkadaşlıktan çıkar
      const { unfriendUser } = require("../services/robloxGroupManager");
      await unfriendUser(parseInt(robloxId, 10));

      if (syncSuccess) {
        return interaction.editReply({ 
          content: `✅ **Doğrulama Başarılı!**\nRoblox hesabınız (**${username}**) başarıyla doğrulandı ve bağlandı. Rolleriniz senkronize edildi.` 
        });
      } else {
        return interaction.editReply({ 
          content: `✅ **Hesap Doğrulandı!**\nRoblox hesabınız (**${username}**) başarıyla bağlandı fakat rolleriniz senkronize edilirken bir sorun oluştu. Lütfen \`/verify\` komutunu kullanarak tekrar deneyin.` 
        });
      }
    } catch (err) {
      console.error("Verification confirm error:", err);
      return interaction.editReply({ content: `❌ Bir hata oluştu: \`${err.message}\`` });
    }
  }

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

// ─── Abuse Buton Handler'ları ─────────────────────────────────────────────────
/**
 * Abuse şüphesi butonlarını işler.
 * customId: rbx_abuse_demote_{groupId}_{targetUserId}
 * customId: rbx_abuse_ignore_{groupId}_{targetUserId}
 */
async function handleAbuseButton(interaction) {
  if (!isUserAuthorized(interaction.member)) {
    return interaction.reply({ content: "❌ Bu butonu kullanmak için Yönetici yetkisi gereklidir.", ephemeral: true });
  }

  const parts     = interaction.customId.split("_");
  // Format: rbx_abuse_demote/ignore_{groupId}_{targetUserId}
  const action    = parts[2]; // "demote" veya "ignore"
  const groupId   = parts[3];
  const targetId  = parseInt(parts[4]);
  const groupName = ROBLOX_GROUPS[groupId] || `Grup ${groupId}`;

  // Butonları hemen devre dışı bırak
  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rbx_abuse_demote_${groupId}_${targetId}`)
      .setLabel(action === "demote" ? "✅ Rütbe İndirildi" : "✅ EVET ÇEK — En Düşük Rütbeye İndir")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🚨")
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`rbx_abuse_ignore_${groupId}_${targetId}`)
      .setLabel(action === "ignore" ? "🚫 Yoksayıldı" : "❌ Yoksay — Şüphe Yok")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🚫")
      .setDisabled(true)
  );

  // ── YOKSAY ──────────────────────────────────────────────────────────────────
  if (action === "ignore") {
    await interaction.update({
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x95A5A6)
          .setTitle("🚫 Abuse Şüphesi — Yoksayıldı")
          .setDescription(
            (interaction.message.embeds[0].description || "") +
            `\n\n✅ **${interaction.user.toString()}** tarafından yoksayıldı.`
          )
      ],
      components: [disabledRow]
    });
    return;
  }

  // ── RÜTBE İNDİR ─────────────────────────────────────────────────────────────
  await interaction.deferUpdate();

  try {
    // 1. Gruptaki tüm rütbeleri al
    const roles = await noblox.getRoles(parseInt(groupId));

    // 2. En düşük rütbeyi bul (rank > 0, misafir değil)
    const lowest = roles
      .filter(r => r.rank > 0)
      .sort((a, b) => a.rank - b.rank)[0];

    if (!lowest) {
      return interaction.editReply({ content: "❌ Grupta geçerli bir düşük rütbe bulunamadı." });
    }

    // 3. Kullanıcının mevcut rütbesini al
    let oldRoleName = "Bilinmiyor";
    try { oldRoleName = await noblox.getRankNameInGroup(parseInt(groupId), targetId); } catch (_) {}

    // 4. Kullanıcı adını al
    let targetUsername = `ID:${targetId}`;
    try { targetUsername = await noblox.getUsernameFromId(targetId); } catch (_) {}

    // 5. Rütbeyi en düşüğe çek
    await noblox.setRank({ group: parseInt(groupId), target: targetId, rank: lowest.rank });

    // 6. Log embedi
    const logEmbed = new EmbedBuilder()
      .setTitle("🚨 Abuse Müdahalesi — Rütbe En Düşüğe Çekildi")
      .setColor(0xFF6B00)
      .addFields(
        { name: "👤 Müdahaleyi Yapan",    value: `${interaction.user.toString()}\n\`${interaction.user.tag}\``, inline: true },
        { name: "🏢 Grup",                value: `**${groupName}**\nID: \`${groupId}\``,                       inline: true },
        { name: "🎯 Hedef Kullanıcı",     value: `**${targetUsername}**\nID: \`${targetId}\``,                  inline: true },
        { name: "⏪ İndirilmeden Önceki", value: `**${oldRoleName}**`,                                          inline: true },
        { name: "🆕 Çekilen Rütbe",       value: `**${lowest.name}** (Rank \`${lowest.rank}\`)`,                inline: true }
      )
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${targetId}&width=150&height=150&format=png`)
      .setTimestamp()
      .setFooter({ text: "Roblox Abuse Müdahale Sistemi", iconURL: interaction.client.user.displayAvatarURL() });

    await sendRobloxLog(interaction, logEmbed);

    // 7. Alert mesajını güncelle
    await interaction.editReply({
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xFF6B00)
          .setTitle("🚨 Abuse Müdahalesi Gerçekleştirildi")
          .setDescription(
            (interaction.message.embeds[0].description || "") +
            `\n\n✅ **${interaction.user.toString()}** tarafından müdahale edildi.\n` +
            `**${targetUsername}** kullanıcısının rütbesi **${lowest.name}** (Rank \`${lowest.rank}\`) olarak güncellendi.`
          )
      ],
      components: [disabledRow]
    });

    console.log(`[AbuseButton] 🚨 Müdahale: Grup ${groupId} — ${targetUsername} (${targetId}) → ${lowest.name} (${lowest.rank})`);
  } catch (err) {
    console.error("[AbuseButton] Rütbe indirme hatası:", err);
    const detailedError = getDetailedRobloxError(err);
    await interaction.editReply({
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xE74C3C)
          .setTitle("❌ Abuse Müdahalesi Başarısız")
          .setDescription(
            (interaction.message.embeds[0].description || "") +
            `\n\n❌ **Hata:** ${detailedError}`
          )
      ],
      components: [disabledRow]
    });
  }
}

module.exports = { handleRobloxInteractions, handleAbuseButton };
