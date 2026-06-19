const { EmbedBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Ticket = require("../../models/Ticket");
const {
  getSupportMenuEmbed,
  getCategorySelectMenu,
  buildCloseReasonModal,
  buildRatingModal,
  buildCloseButton,
} = require("../embeds");
const { BASE_URL } = require("../../config");
const { syncTMTRoles } = require("../services/tmtRoleSyncService");

async function handleButtonInteraction(interaction) {
  // ── TMT Yetkilendirme Butonu ─────────────────────────────────────────────
  if (interaction.customId === "authorize_button") {
    const User = require("../../models/User");
    
    try {
      const user = await User.findOne({ discordId: interaction.user.id });
      
      const embed = new EmbedBuilder()
        .setColor(0x4169E1)
        .setTitle("🔐 Roblox Hesap Bağlama")
        .setDescription(
          user?.robloxId
            ? `✅ **Zaten Bağlı!**\n\nRoblox ID: \`${user.robloxId}\`\n\nRollerinizi güncellemek için aşağıdaki butona tıklayın.`
            : `🔗 **Roblox Hesabını Bağlamak İçin Yöntem Seçin:**\n\n` +
              `**1. Yöntem (Web):** [Buraya Tıklayarak Yetkilendir](${BASE_URL}/auth/roblox) ve ardından \`/verify\` komutunu çalıştırın.\n\n` +
              `**2. Yöntem (Arkadaş İsteği):** Aşağıdaki **Arkadaş İsteği ile Doğrula** butonuna tıklayarak Roblox kullanıcı adınızı girin. Bot size arkadaşlık isteği göndererek hesabınızı doğrular.`
        )
        .setFooter({ text: "TMT Yetkilendirme Sistemi" })
        .setTimestamp();
      
      if (user?.robloxId) {
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("🌐 Web ile Yetkilendir")
            .setStyle(ButtonStyle.Link)
            .setURL(`${BASE_URL}/auth/roblox`),
          new ButtonBuilder()
            .setCustomId("rbx_btn_verify_friend_start")
            .setLabel("🤖 Arkadaş İsteği ile Doğrula")
            .setStyle(ButtonStyle.Primary)
        );
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
    } catch (error) {
      console.error("[authorize_button] Error:", error);
      return interaction.reply({ content: "❌ Bir hata oluştu.", ephemeral: true });
    }
  }

  // ── TMT Rol Senkronizasyon Butonu ────────────────────────────────────────
  if (interaction.customId === "verify_button") {
    const User = require("../../models/User");
    const { TARGET_GUILD_ID, TMT_GUILD_ID, ALLIED_GUILD_ID, GUILD2_ID } = require("../../config");
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
      console.log(`[verify_button] User ${interaction.user.id} requesting role sync...`);
      const user = await User.findOne({ discordId: interaction.user.id });
      
      if (!user) {
        console.log(`[verify_button] User ${interaction.user.id} not found in database`);
        return interaction.editReply({
          content: "❌ Roblox hesabınız bağlı değil! Önce yetkilendirme butonunu kullanın.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!user.robloxId) {
        console.log(`[verify_button] User ${interaction.user.id} has no robloxId`);
        return interaction.editReply({
          content: "❌ Roblox hesabınız bağlı değil! Önce yetkilendirme butonunu kullanın.",
          flags: MessageFlags.Ephemeral,
        });
      }

      console.log(`[verify_button] Found user: Discord=${interaction.user.id}, Roblox=${user.robloxId}`);
      
      // Sunucuya özel rol senkronizasyonu
      let result;
      const normalizedGuildId = String(interaction.guild?.id || "").trim();
      const normalizedTMT = String(TMT_GUILD_ID).trim();
      const normalizedBEM = String(TARGET_GUILD_ID).trim();
      const normalizedEKO = String(GUILD2_ID).trim();
      const normalizedAllied = String(ALLIED_GUILD_ID).trim();

      console.log(`[verify_button] Sunucu Kontrolü:`);
      console.log(`  Mevcut Guild ID: "${normalizedGuildId}"`);
      console.log(`  Allied ID: "${normalizedAllied}" ${normalizedGuildId === normalizedAllied ? '✓ EŞLEŞTI' : ''}`);
      console.log(`  TMT ID: "${normalizedTMT}" ${normalizedGuildId === normalizedTMT ? '✓ EŞLEŞTI' : ''}`);
      console.log(`  BEM ID: "${normalizedBEM}" ${normalizedGuildId === normalizedBEM ? '✓ EŞLEŞTI' : ''}`);
      console.log(`  EKO ID: "${normalizedEKO}" ${normalizedGuildId === normalizedEKO ? '✓ EŞLEŞTI' : ''}`);
      
      if (normalizedGuildId === normalizedAllied) {
        console.log(`[verify_button] ✓ Müttefik Orduları algılandı - Allied sync başlatılıyor`);
        const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
        result = await syncAlliedRoles(interaction.client, interaction.user.id, parseInt(user.robloxId, 10), interaction.guild);
        console.log(`[verify_button] Allied sync tamamlandı`);
      } else if (normalizedGuildId === normalizedEKO) {
        console.log(`[verify_button] ✓ EKOYILDIZ algılandı - Allied sync başlatılıyor`);
        const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
        result = await syncAlliedRoles(interaction.client, interaction.user.id, parseInt(user.robloxId, 10), interaction.guild);
        console.log(`[verify_button] EKOYILDIZ sync tamamlandı`);
      } else if (normalizedGuildId === normalizedTMT) {
        console.log(`[verify_button] ✓ TMT algılandı - TMT sync başlatılıyor`);
        const { syncTMTRoles } = require("../services/tmtRoleSyncService");
        result = await syncTMTRoles(interaction.client, interaction.user.id, user.robloxId);
        console.log(`[verify_button] TMT sync tamamlandı`);
      } else if (normalizedGuildId === normalizedBEM) {
        console.log(`[verify_button] ✓ BEM algılandı - BEM sync başlatılıyor`);
        const { syncMemberRoles } = require("../services/roleSyncService");
        result = await syncMemberRoles(interaction.client, interaction.user.id, user.robloxId);
        console.log(`[verify_button] BEM sync tamamlandı`);
      } else {
        console.error(`[verify_button] ✗ Sunucu tanınmadı! Guild ID: "${normalizedGuildId}"`);
        return interaction.editReply({
          content: `❌ Sunucu tanınmadı. Guild ID: ${normalizedGuildId}`,
          flags: MessageFlags.Ephemeral,
        });
      }
      
      if (result && result.success) {
        const formatRoleList = (roles) => {
          if (!roles || !roles.length) return "None";
          return roles.map((r) => `<@&${r.id}>`).join("\n");
        };

        const embed = new EmbedBuilder()
          .setColor(0x00AA00)
          .setTitle("✅ Rolleri Senkronize Et")
          .addFields(
            { name: "👤 Kullanıcı", value: result.nickname || interaction.user.username, inline: false },
            { name: "➕ Eklenen Roller", value: formatRoleList(result.added || []), inline: false },
            { name: "➖ Kaldırılan Roller", value: formatRoleList(result.removed || []), inline: false }
          )
          .setFooter({ text: "Rol Senkronizasyonu Tamamlandı" })
          .setTimestamp();
        
        if (result.tier) {
          embed.addFields({
            name: "🎖️ Seviye Rolü",
            value: result.tier,
            inline: true,
          });
        }

        if (result.unresolved && result.unresolved.length > 0) {
          embed.addFields({
            name: "⚠️ Eşleşmeyen Roller",
            value: result.unresolved.map((n) => `\`${n}\``).join(", ").slice(0, 1024),
            inline: false,
          });
        }
        
        return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        return interaction.editReply({
          content: "❌ Roller senkronize edilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error("[verify_button] Error:", error);
      return interaction.editReply({
        content: "❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // ── Doğrulama yardım butonu ──────────────────────────────────────────────
  if (interaction.customId === "verify_help_refresh") {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📋 Komut Özeti")
      .setDescription(
        "**`/authorize`** — Roblox hesabını bağla\n" +
          "**`/verify`** — İlk rol doğrulaması (gizli)\n" +
          "**`/update`** — Rolleri yeniden senkronize et\n\n" +
          `🌐 Web: [${BASE_URL}/dashboard](${BASE_URL}/dashboard)`
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── Destek menüsü butonu ─────────────────────────────────────────────────
  if (interaction.customId === "open_support_menu") {
    const embed = getSupportMenuEmbed();
    const selectMenu = getCategorySelectMenu();
    return interaction.reply({ embeds: [embed], components: [selectMenu], ephemeral: true });
  }

  // ── Ticket kapat butonu → sebep modal'ı aç ──────────────────────────────
  if (interaction.customId.startsWith("close_ticket_")) {
    const ticketId = interaction.customId.replace("close_ticket_", "");

    // Fresh veri çek — cache'deki stale veriyi önle
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return interaction.reply({ content: "❌ Ticket bulunamadı.", ephemeral: true });
    }

    if (
      ticket.userId !== interaction.user.id &&
      !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
    ) {
      return interaction.reply({ content: "❌ Bunu yapmaya yetkili değilsiniz.", ephemeral: true });
    }

    if (ticket.status === "closed") {
      try {
        if (interaction.channel) {
          await interaction.reply({ content: "⏳ Bu ticket zaten kapatılmış. Kanal siliniyor...", ephemeral: true });
          setTimeout(async () => {
            try {
              await interaction.channel.delete("Ticket zaten kapatılmış, kanal siliniyor.");
            } catch (err) {
              console.error("Delayed channel deletion error:", err);
            }
          }, 1000);
        }
      } catch (err) {
        console.error("Already closed ticket channel deletion error:", err);
        try {
          return interaction.reply({ content: "❌ Kanal silinirken bir hata oluştu.", ephemeral: true });
        } catch (_) {}
      }
      return;
    }

    // Kapatma sebebini soran modal'ı göster
    const modal = buildCloseReasonModal(ticketId);
    return interaction.showModal(modal);
  }

  // ── Ticket tekrar aç butonu ──────────────────────────────────────────────
  if (interaction.customId.startsWith("reopen_ticket_")) {
    const ticketId = interaction.customId.replace("reopen_ticket_", "");
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
    }

    if (ticket.status === "open") {
      return interaction.reply({ content: "❌ Bu ticket zaten açık", ephemeral: true });
    }

    if (ticket.userId !== interaction.user.id) {
      return interaction.reply({ content: "❌ Bu ticket size ait değil", ephemeral: true });
    }

    // Kanalı bul ve izinleri geri ver
    try {
      const { TARGET_GUILD_ID, GUILD2_ID, GUILD2_TICKET_CATEGORY_ID, TARGET_CHANNEL_ID } = require("../../config");
      const { ChannelType, PermissionFlagsBits: PF } = require("discord.js");
      const guildId = ticket.guildId || TARGET_GUILD_ID;
      const guild = await interaction.client.guilds.fetch(guildId);
      let channel = ticket.channelId && !ticket.channelDeleted
        ? await guild.channels.fetch(ticket.channelId).catch(() => null)
        : null;

      if (channel) {
        // Kanal var — izinleri geri ver
        await channel.permissionOverwrites.edit(ticket.userId, {
          ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
        });
        const reopenEmbed = new EmbedBuilder()
          .setTitle("🔓 Ticket Yeniden Açıldı")
          .setDescription(`<@${ticket.userId}> tarafından yeniden açıldı.`)
          .setColor(0x4ade80)
          .setTimestamp();
        const closeButton = buildCloseButton(ticketId);
        await channel.send({ embeds: [reopenEmbed], components: [closeButton] });
      } else {
        // Kanal silinmiş — sadece GUILD2'de yeniden oluştur
        const targets = [
          { id: GUILD2_ID, categoryId: GUILD2_TICKET_CATEGORY_ID },
        ];
        for (const target of targets) {
          try {
            const tGuild = await interaction.client.guilds.fetch(target.id).catch(() => null);
            if (!tGuild) continue;
            const permissionOverwrites = [
              { id: tGuild.id, deny: [PF.ViewChannel] },
              { id: ticket.userId, allow: [PF.ViewChannel, PF.SendMessages, PF.ReadMessageHistory, PF.AttachFiles, PF.EmbedLinks] },
            ];
            let parentId = null;
            if (target.categoryId) {
              const ch = await tGuild.channels.fetch(target.categoryId).catch(() => null);
              if (ch?.type === ChannelType.GuildCategory) parentId = ch.id;
              else if (ch?.type === ChannelType.GuildText) parentId = ch.parentId;
            }
            if (!parentId) {
              let cat = tGuild.channels.cache.find(ch => ch.name.toLowerCase() === "destek talepleri" && ch.type === ChannelType.GuildCategory);
              if (!cat) cat = await tGuild.channels.create({ name: "DESTEK TALEPLERİ", type: ChannelType.GuildCategory });
              parentId = cat.id;
            }
            const newCh = await tGuild.channels.create({
              name: `ticket-${ticketId.toLowerCase()}`,
              type: ChannelType.GuildText,
              parent: parentId,
              permissionOverwrites,
            });
            const closeButton = buildCloseButton(ticketId);
            await newCh.send({
              content: `<@${ticket.userId}> ticket'ın yeniden açıldı!`,
              components: [closeButton],
            });
            if (!ticket.channelId || ticket.channelDeleted) {
              ticket.channelId = newCh.id;
              ticket.guildId = tGuild.id;
              ticket.channelDeleted = false;
              ticket.channelDeletedAt = null;
            }
          } catch (chErr) {
            console.warn(`[reopen_ticket] ${target.id} kanalı açılamadı:`, chErr.message);
          }
        }
      }

      ticket.status = "open";
      ticket.closedAt = null;
      ticket.closeReason = null;
      await ticket.save();

      // Silme kuyruğunu iptal et
      const { cancelTicketDeletion } = require("../services/ticketCleanup");
      cancelTicketDeletion(ticketId);

      return interaction.reply({
        content: "✅ Ticket yeniden açıldı.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("[reopen_ticket] Hata:", err);
      return interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
    }
  }

  // ── Değerlendirme butonu → rating modal'ı aç ────────────────────────────
  if (interaction.customId.startsWith("rate_ticket_")) {
    const ticketId = interaction.customId.replace("rate_ticket_", "");
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
    }

    if (ticket.userId !== interaction.user.id) {
      return interaction.reply({ content: "❌ Bu ticket size ait değil", ephemeral: true });
    }

    if (ticket.rated) {
      return interaction.reply({ content: "❌ Bu ticket'ı zaten değerlendirdiniz", ephemeral: true });
    }

    const modal = buildRatingModal(ticketId);
    return interaction.showModal(modal);
  }

  // ── Abone Doğrulama: "HAYIR ABONE DEĞİL" butonu ────────────────────────
  if (interaction.customId.startsWith('abone_no_')) {
    try {
      const { handleNoSubscriberButton } = require('../services/photoVerification');
      await handleNoSubscriberButton(interaction, interaction.client);
    } catch (err) {
      console.error('[photoVerification] Button hata:', err.message);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
        }
      } catch (_) {}
    }
  }

  // ── Admin Form Modals ──────────────────────────────────────────────────
  if (interaction.customId === 'btn_leave_form') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('modal_leave_form').setTitle('İzin Formu');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('leave_reason').setLabel('İzin Sebebi').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('leave_duration').setLabel('Kaç Gün').setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'btn_suggestion_form') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('modal_suggestion_form').setTitle('Tavsiye & Öneri Formu');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('suggestion_text').setLabel('Öneriniz').setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'btn_resign_form') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('modal_resign_form').setTitle('İstifa Formu');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('resign_reason').setLabel('İstifa Sebebiniz').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('resign_confirm').setLabel('Onaylıyorum (Evet yazın)').setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'btn_modaction_form') {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('modal_modaction_form').setTitle('Moderatör İşlem Formu');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mod_user').setLabel('İşlem Yapılan Kullanıcı (ID/İsim)').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mod_action').setLabel('İşlem (Ban/Mute/Kick vb.)').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mod_reason').setLabel('Sebep ve Kanıt Linki').setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  return null;
}

module.exports = { handleButtonInteraction };
