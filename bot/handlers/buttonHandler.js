const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
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
            : `🔗 **Roblox hesabını bağlamak için:**\n\n[Buraya Tıklayarak Yetkilendir](${BASE_URL}/auth/roblox)\n\nSonra \`/verify\` komutunu çalıştırın!`
        )
        .setFooter({ text: "TMT Yetkilendirme Sistemi" })
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error("[authorize_button] Error:", error);
      return interaction.reply({ content: "❌ Bir hata oluştu.", ephemeral: true });
    }
  }

  // ── TMT Rol Senkronizasyon Butonu ────────────────────────────────────────
  if (interaction.customId === "verify_button") {
    const User = require("../../models/User");
    
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
      
      // Rolleri senkronize et
      const success = await syncTMTRoles(interaction.client, interaction.user.id, user.robloxId);
      
      if (success) {
        const embed = new EmbedBuilder()
          .setColor(0x00AA00)
          .setTitle("✅ Roller Güncellendi")
          .setDescription("Roblox hesabınızdan rolleriniz başarıyla senkronize edildi!")
          .setFooter({ text: "TMT Rol Sistemi" })
          .setTimestamp();
        
        return interaction.editReply({ embeds: [embed] });
      } else {
        return interaction.editReply({
          content: "❌ Roller senkronize edilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("[verify_button] Error:", error);
      return interaction.editReply({
        content: "❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        ephemeral: true,
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

    if (ticket.status === "closed") {
      return interaction.reply({ content: "ℹ️ Bu ticket zaten kapatılmış.", ephemeral: true });
    }

    if (
      ticket.userId !== interaction.user.id &&
      !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
    ) {
      return interaction.reply({ content: "❌ Bunu yapmaya yetkili değilsiniz.", ephemeral: true });
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

  return null;
}

module.exports = { handleButtonInteraction };
