// handleButtonInteraction.js

const {
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
} = require("discord.js");

const Ticket = require("../../models/Ticket");
const {
  getSupportMenuEmbed,
  getCategorySelectMenu,
  buildCloseReasonModal,
  buildRatingModal,
  buildCloseButton,
} = require("../embeds");
const { BASE_URL, TARGET_GUILD_ID, TMT_GUILD_ID, ALLIED_GUILD_ID, GUILD2_ID, GUILD2_TICKET_CATEGORY_ID } = require("../../config");
const { handleRollCallButton } = require("../services/rollCallService");

// ─── Yardımcı: Modal oluşturucu ──────────────────────────────────────────────

/**
 * Tekil bir TextInput satırı içeren ActionRow döner.
 */
function textRow(customId, label, style, required = true) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required)
  );
}

/**
 * Basit modal oluşturur. fields: [{ id, label, style }]
 */
function buildModal(customId, title, fields) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  modal.addComponents(
    ...fields.map(({ id, label, style }) =>
      textRow(id, label, style)
    )
  );
  return modal;
}

async function safeErrorReply(interaction, message) {
  try {
    const { sendErrorReplyWithButton } = require("../services/errorReporter");
    const cleanMsg = typeof message === "string" ? message.replace(/^❌\s*/, "") : "Beklenmedik bir hata oluştu.";
    const err = new Error(cleanMsg);
    await sendErrorReplyWithButton(interaction, err, "buttonHandler safeErrorReply");
  } catch (_) {
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: message });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    } catch (__) { }
  }
}

// ─── Handler Map: Guild ID → Sync Servis ─────────────────────────────────────

const GUILD_SYNC_MAP = {
  [String(ALLIED_GUILD_ID).trim()]: async (client, userId, robloxId, guild) => {
    const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
    return syncAlliedRoles(client, userId, parseInt(robloxId, 10), guild);
  },
  [String(GUILD2_ID).trim()]: async (client, userId, robloxId, guild) => {
    const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
    return syncAlliedRoles(client, userId, parseInt(robloxId, 10), guild);
  },
  [String(TMT_GUILD_ID).trim()]: async (client, userId, robloxId) => {
    const { syncTMTRoles } = require("../services/tmtRoleSyncService");
    return syncTMTRoles(client, userId, robloxId);
  },
  [String(TARGET_GUILD_ID).trim()]: async (client, userId, robloxId) => {
    const { syncMemberRoles } = require("../services/roleSyncService");
    return syncMemberRoles(client, userId, robloxId);
  },
};

// ─── Ana Handler ──────────────────────────────────────────────────────────────

async function handleButtonInteraction(interaction) {
  const { customId } = interaction;

  // ── Hata Sihirbazı Butonları ────────────────────────────────────────────
  if (customId.startsWith("wizard_ack_") || customId.startsWith("wizard_resolve_") || customId.startsWith("wizard_reply_") || customId.startsWith("wizard_ai_detail_")) {
    const { handleWizardButton } = require("../services/errorWizardService");
    return handleWizardButton(interaction);
  }

  // ── Okul Sistemi Butonları ──────────────────────────────────────────────
  if (customId.startsWith("school_confirm_req_")) {
    const { handleTrainingRequestConfirm } = require("../services/moderatorSchool");
    return handleTrainingRequestConfirm(interaction, interaction.client);
  }

  if (customId.startsWith("school_")) {
    const { handleSchoolButtons } = require("../services/moderatorSchool");
    return handleSchoolButtons(interaction, interaction.client);
  }

  if (customId.startsWith("staff_claim_accept_")) {
    const parts = customId.replace("staff_claim_accept_", "").split("_");
    const ticketId = parts[0];
    const targetStaffId = parts[1];

    if (interaction.user.id !== targetStaffId) {
      return interaction.reply({ content: "❌ Bu işlemi yapmaya yetkiniz yok.", ephemeral: true });
    }

    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return interaction.update({ content: "❌ Destek talebi bulunamadı.", embeds: [], components: [] });
    }

    if (ticket.status === "closed") {
      return interaction.update({ content: "❌ Bu destek talebi kapatılmış.", embeds: [], components: [] });
    }

    if (ticket.claimedBy) {
      return interaction.update({ content: `❌ Bu destek talebi zaten <@${ticket.claimedBy}> tarafından üstlenilmiş.`, embeds: [], components: [] });
    }

    // Accept and claim
    ticket.claimedBy = interaction.user.id;
    ticket.claimedByName = interaction.user.username;
    await ticket.save();

    try {
      const { addNotification } = require("../../utils/notification");
      await addNotification(ticket.userId, {
        title: "🙋 Destek Talebi Üstlenildi",
        message: `\`${ticket.ticketId}\` numaralı destek talebiniz ${interaction.user.username} tarafından üstlenildi.`,
        icon: "🙋"
      });
    } catch (err) {
      console.error("[buttonHandler] Claim notification error:", err.message);
    }

    // Clean up active claim routing
    const { activeTicketClaims, deleteActiveClaimDmMessage } = require("../services/reklamTicketService");
    await deleteActiveClaimDmMessage(ticketId);
    activeTicketClaims.delete(ticketId);

    // Send a new fresh message with the channel link
    await interaction.user.send({
      content: `✅ **Destek talebini başarıyla üstlendiniz!** Kanala gitmek için: <#${ticket.channelId}>`
    }).catch(() => {});

    // Notify ticket channel
    try {
      const guild = await interaction.client.guilds.fetch(ticket.guildId).catch(() => null);
      if (guild) {
        const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
        if (channel) {
          await channel.send(`🙋‍♂️ <@${interaction.user.id}> bu talebi DM üzerinden gelen bildirimle üstlendi.`);

          // Try to update channel welcome message claim button
          // Find welcome message in channel history
          const messages = await channel.messages.fetch({ limit: 20 }).catch(() => []);
          const welcomeMsg = messages.find(m => m.author.id === interaction.client.user.id && m.components.length > 0);
          if (welcomeMsg) {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
            const originalRow = welcomeMsg.components[0];
            const newComponents = [];
            if (originalRow) {
              const updatedRow = new ActionRowBuilder();
              originalRow.components.forEach(comp => {
                if (comp.customId.startsWith("claim_ticket_")) {
                  updatedRow.addComponents(
                    new ButtonBuilder()
                      .setCustomId(`claimed_ticket_disabled_${ticketId}`)
                      .setLabel(`Üstlendi: ${interaction.user.username}`)
                      .setStyle(ButtonStyle.Secondary)
                      .setDisabled(true)
                  );
                } else {
                  updatedRow.addComponents(ButtonBuilder.from(comp));
                }
              });
              newComponents.push(updatedRow);
            }
            await welcomeMsg.edit({ components: newComponents }).catch(() => { });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to notify channel/edit message on DM claim:", err.message);
    }
    return;
  }

  if (customId.startsWith("staff_claim_reject_")) {
    const parts = customId.replace("staff_claim_reject_", "").split("_");
    const ticketId = parts[0];
    const targetStaffId = parts[1];

    if (interaction.user.id !== targetStaffId) {
      return interaction.reply({ content: "❌ Bu işlemi yapmaya yetkiniz yok.", ephemeral: true });
    }

    // Inform staff
    await interaction.update({
      content: "❌ Talebi incelemeyi reddettiniz. Talep sıradaki aktif yetkiliye iletiliyor...",
      embeds: [],
      components: []
    });

    // Send to next staff member in queue
    const { routeNextClaimRequest } = require("../services/reklamTicketService");
    await routeNextClaimRequest(ticketId, interaction.client);
    return;
  }

  if (customId.startsWith("eposta_add_user_")) {
    const ticketId = customId.replace("eposta_add_user_", "");
    const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require("discord.js");
    const modal = new ModalBuilder()
      .setCustomId(`eposta_add_user_modal_${ticketId}`)
      .setTitle("Görüşmeye Katılımcı Ekle");

    const input = new TextInputBuilder()
      .setCustomId("target_user_input")
      .setLabel("Kullanıcı ID veya Kullanıcı Adı")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Örn: 1031620522406072350 veya emre")
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId.startsWith("eposta_remove_user_")) {
    const ticketId = customId.replace("eposta_remove_user_", "");
    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.reply({ content: "❌ Hata: E-posta bulunamadı.", ephemeral: true });

    if (!ticket.additionalUsers || ticket.additionalUsers.length === 0) {
      return interaction.reply({ content: "❌ Görüşmede çıkarılabilecek ek bir kişi bulunmuyor.", ephemeral: true });
    }

    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require("discord.js");
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`eposta_remove_select_${ticketId}`)
      .setPlaceholder("Çıkarmak istediğiniz kişiyi seçin...");

    for (const userId of ticket.additionalUsers) {
      const user = await interaction.client.users.fetch(userId).catch(() => null);
      if (user) {
        selectMenu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(user.username)
            .setValue(user.id)
            .setDescription(`ID: ${user.id}`)
        );
      }
    }

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.reply({ content: "👤 Çıkarmak istediğiniz grup üyesini seçin:", components: [row], ephemeral: true });
  }

  if (customId.startsWith("eposta_leave_ticket_")) {
    const ticketId = customId.replace("eposta_leave_ticket_", "");
    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.reply({ content: "❌ Hata: E-posta bulunamadı.", ephemeral: true });

    try {
      const guild = await interaction.client.guilds.fetch(ticket.guildId);
      const modChan = await guild.channels.fetch(ticket.channelId).catch(() => null);
      if (modChan) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
        const leaveEmbed = new EmbedBuilder()
          .setTitle("🚪 Görüşmeden Ayrılma Talebi")
          .setDescription(`👤 <@${interaction.user.id}> (${interaction.user.username}) e-posta destek grubundan ayrılmak istiyor.`)
          .setColor(0xe67e22)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`eposta_leave_accept_${ticketId}_${interaction.user.id}`)
            .setLabel("✅ Kabul Et (Çıkart)")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`eposta_leave_reject_${ticketId}_${interaction.user.id}`)
            .setLabel("❌ Reddet")
            .setStyle(ButtonStyle.Danger)
        );

        await modChan.send({ embeds: [leaveEmbed], components: [row] });
        return interaction.reply({ content: "⏳ Ayrılma talebiniz destek ekibine iletildi. Onay verildiğinde bu kanalınız silinecektir.", ephemeral: true });
      }
    } catch (err) {
      console.error("[eposta_leave_ticket] Error:", err.message);
    }
  }

  if (customId.startsWith("eposta_leave_accept_")) {
    const parts = customId.replace("eposta_leave_accept_", "").split("_");
    const ticketId = parts[0];
    const targetUserId = parts[1];

    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.reply({ content: "❌ Destek talebi bulunamadı.", ephemeral: true });

    try {
      const guild = await interaction.client.guilds.fetch(ticket.guildId);
      if (ticket.additionalUsers) {
        const idx = ticket.additionalUsers.indexOf(targetUserId);
        if (idx !== -1) {
          const chanId = ticket.additionalChannels[idx];
          if (chanId) {
            const ch = await guild.channels.fetch(chanId).catch(() => null);
            if (ch) await ch.delete("Gruptan ayrıldı").catch(() => { });
          }
          ticket.additionalUsers.splice(idx, 1);
          ticket.additionalChannels.splice(idx, 1);
        }
      }
      await ticket.save();

      await interaction.update({ content: `✅ <@${targetUserId}> görüşmeden çıkartıldı ve kanalı silindi.`, embeds: [], components: [] });

      if (ticket.userChannelId) {
        const mainChan = await guild.channels.fetch(ticket.userChannelId).catch(() => null);
        if (mainChan) await mainChan.send(`🚪 <@${targetUserId}> e-posta grubundan ayrıldı.`);
      }
    } catch (err) {
      console.error("[eposta_leave_accept] Error:", err.message);
    }
    return;
  }

  if (customId.startsWith("eposta_leave_reject_")) {
    const parts = customId.replace("eposta_leave_reject_", "").split("_");
    const ticketId = parts[0];
    const targetUserId = parts[1];

    await interaction.update({ content: `❌ Ayrılma talebi reddedildi.`, embeds: [], components: [] });

    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (ticket && ticket.additionalUsers) {
      const idx = ticket.additionalUsers.indexOf(targetUserId);
      if (idx !== -1) {
        const chanId = ticket.additionalChannels[idx];
        if (chanId) {
          const ch = await interaction.client.channels.fetch(chanId).catch(() => null);
          if (ch) await ch.send(`❌ Ayrılma talebiniz destek ekibi tarafından reddedildi.`);
        }
      }
    }
    return;
  }

  if (customId.startsWith("reopen_ticket_")) {
    const ticketId = customId.replace("reopen_ticket_", "");
    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.reply({ content: "❌ Destek talebi bulunamadı.", ephemeral: true });

    const isStaff = !((ticket.userId === interaction.user.id) || (ticket.additionalUsers?.includes(interaction.user.id)));

    if (!isStaff && ticket.lockReopen) {
      return interaction.reply({ content: "❌ Bu destek talebini yeniden açma yetkiniz kilitlenmiştir. Açılması için bir yöneticinin izin vermesi gerekir.", ephemeral: true });
    }

    const { reopenEkoYildizTicket } = require("../../bot/services/epostaTicketService");
    await reopenEkoYildizTicket(ticket, interaction);

    if (interaction.channel) {
      await interaction.reply({ content: "🔄 Destek talebi yeniden açıldı!", ephemeral: true });
      try {
        await interaction.message.delete().catch(() => { });
      } catch (_) { }
    } else {
      await interaction.reply({ content: "🔄 Destek talebi yeniden açıldı!", ephemeral: true });
    }
    return;
  }

  if (customId.startsWith("eposta_lock_reopen_")) {
    const ticketId = customId.replace("eposta_lock_reopen_", "");
    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.reply({ content: "❌ Destek talebi bulunamadı.", ephemeral: true });

    ticket.lockReopen = true;
    await ticket.save();

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    const updatedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reopen_ticket_${ticketId}`)
        .setLabel("🔓 Yeniden Aç")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reopen_allow_${ticketId}`)
        .setLabel("🔓 Yeniden Açma İzni Ver (Yönetici)")
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.update({
      content: `🚫 **Kullanıcıların bu talebi yeniden açması engellendi.** (Kilitlendi)\n*Sadece yöneticiler tekrar izin verebilir.*`,
      components: [updatedRow]
    });
  }

  if (customId.startsWith("reopen_allow_")) {
    const ticketId = customId.replace("reopen_allow_", "");
    const { PermissionFlagsBits } = require("discord.js");
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Bu işlemi yalnızca sunucudaki **Yönetici** yetkisine sahip yetkililer yapabilir.", ephemeral: true });
    }

    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.reply({ content: "❌ Destek talebi bulunamadı.", ephemeral: true });

    ticket.lockReopen = false;
    await ticket.save();

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    const updatedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reopen_ticket_${ticketId}`)
        .setLabel("🔓 Yeniden Aç")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`eposta_lock_reopen_${ticketId}`)
        .setLabel("🚫 Yeniden Açılışı Engelle")
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.update({
      content: `✅ **Kullanıcıların bu talebi yeniden açması serbest bırakıldı.**`,
      components: [updatedRow]
    });
  }

  if (customId.startsWith("eposta_scan_")) {
    const ticketId = customId.replace("eposta_scan_", "");
    const Ticket = require("../../models/Ticket");
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.reply({ content: "❌ Ticket bulunamadı.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    // Küfür / hakaret kelime listesi
    const PROFANITY_LIST = [
      "sik", "orospu", "piç", "göt", "oğlan", "bok", "salak", "aptal",
      "gerizekalı", "mal", "kaltak", "fahişe", "ibne", "eşek", "beyinsiz",
      "fuck", "shit", "bitch", "asshole", "bastard", "idiot", "moron",
      "amk", "amına", "ananı", "amcık", "götveren", "kahpe", "sürtük",
      "siktir", "oç", "bok", "yarrak", "meret", "döl", "gavat"
    ];

    let violations = [];
    let scannedCount = 0;

    // Hem kullanıcı kanalı hem mod kanalını tara
    const channelIds = [ticket.userChannelId, ticket.channelId].filter(Boolean);
    for (const chanId of channelIds) {
      try {
        const chan = await interaction.client.channels.fetch(chanId).catch(() => null);
        if (!chan) continue;
        const msgs = await chan.messages.fetch({ limit: 50 });
        scannedCount += msgs.size;
        for (const [, msg] of msgs) {
          if (msg.author.bot) continue;
          const lower = msg.content.toLowerCase();
          for (const word of PROFANITY_LIST) {
            if (lower.includes(word)) {
              violations.push({
                author: `${msg.author.tag} (<@${msg.author.id}>)`,
                content: msg.content.slice(0, 200),
                word,
                timestamp: msg.createdAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
                channel: chan.name,
              });
              break; // Tek mesaj için bir kez raporla
            }
          }
        }
      } catch (_) {}
    }

    if (violations.length === 0) {
      return interaction.editReply({
        content:
          `🛡️ **EkoYıldız Destek Sistemi — Güvenlik Taraması Tamamlandı**\n` +
          "```\n" +
          `[TARAMA] ${scannedCount} mesaj analiz edildi.\n` +
          `[ANALİZ] Küfür / hakaret taraması yapıldı.\n` +
          `[SONUÇ]  Herhangi bir ihlal tespit edilmedi. ✅\n` +
          "```",
      });
    }

    // İhlal bulundu — mod kanalına rapor gönder
    try {
      const { GUILD2_ID } = require("../../config");
      const guild = await interaction.client.guilds.fetch(GUILD2_ID).catch(() => null);
      const reportChannel = guild ? await guild.channels.fetch("1518684031275761719").catch(() => null) : null;

      if (reportChannel) {
        const reportEmbed = new EmbedBuilder()
          .setTitle("🚨 Güvenlik Taraması — Küfür / Hakaret İhlali Tespit Edildi!")
          .setColor(0xe74c3c)
          .setDescription(
            `**Ticket ID:** \`${ticket.ticketId}\`\n` +
            `**Taramayı Yapan:** <@${interaction.user.id}> (${interaction.user.username})\n` +
            `**Taranan Mesaj Sayısı:** ${scannedCount}\n` +
            `**İhlal Sayısı:** ${violations.length}\n\n` +
            `**Rapor Edilen Mesajlar:**\n` +
            violations.slice(0, 5).map((v, i) =>
              `**${i + 1}.** ${v.author}\n` +
              `> 🕐 ${v.timestamp} | #${v.channel}\n` +
              `> 💬 \`${v.content.replace(/`/g, "'")}\``
            ).join("\n\n") +
            (violations.length > 5 ? `\n\n... ve ${violations.length - 5} ihlal daha.` : "")
          )
          .setFooter({ text: "EkoYıldız Destek Güvenlik Sistemi" })
          .setTimestamp();

        const reportRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`spam_ban_accept_${ticket.userId}_${ticket.ticketId}`)
            .setLabel("🚫 Kullanıcıyı Ticket'tan Banla")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`spam_ban_reject_${ticket.userId}_${ticket.ticketId}`)
            .setLabel("✅ İhlal Değil — Görmezden Gel")
            .setStyle(ButtonStyle.Secondary)
        );

        await reportChannel.send({ embeds: [reportEmbed], components: [reportRow] });
      }
    } catch (repErr) {
      console.error("[eposta_scan] Rapor gönderilemedi:", repErr.message);
    }

    return interaction.editReply({
      content:
        `🚨 **${violations.length} ihlal tespit edildi!**\n` +
        `Küfür/hakaret içeren mesajlar moderasyon kanalına raporlandı.\n` +
        "```\n" +
        violations.slice(0, 3).map(v => `• [${v.channel}] ${v.author.split("(")[0].trim()}: "${v.content.slice(0, 80)}"`).join("\n") +
        "\n```",
    });
  }

  if (customId.startsWith("eposta_print_")) {
    const ticketId = customId.replace("eposta_print_", "");
    const Ticket = require("../../models/Ticket");
    const { EmbedBuilder } = require("discord.js");

    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return interaction.reply({ content: "❌ Hata: E-posta bulunamadı.", ephemeral: true });
    }

    const printDate = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const printEmbed = new EmbedBuilder()
      .setTitle("🖨️ EkoYıldız Destek Sistemi - Yazıcı Çıktısı")
      .setDescription(
        `\`\`\`text\n` +
        `==================================================\n` +
        `               EKO YILDIZ MAIL CLIENT             \n` +
        `==================================================\n` +
        `YAZDIRMA TARİHİ: ${printDate}\n` +
        `TICKET ID:       ${ticket.ticketId}\n` +
        `GÖNDEREN:        ${ticket.userName} (${ticket.userId})\n` +
        `DEPARTMAN:       E-Posta Destek Gateway\n` +
        `KONU:            ${ticket.subject}\n` +
        `--------------------------------------------------\n` +
        `İÇERİK:\n` +
        `${ticket.description}\n` +
        `==================================================\n` +
        `\`\`\``
      )
      .setColor(0x7f8c8d);

    return interaction.reply({ embeds: [printEmbed], ephemeral: true });
  }

  if (customId.startsWith("eposta_spam_")) {
    const ticketId = customId.replace("eposta_spam_", "");
    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.reply({ content: "❌ Hata: Destek talebi bulunamadı.", ephemeral: true });

    try {
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
      const { GUILD2_ID } = require("../../config");
      const guild = await interaction.client.guilds.fetch(GUILD2_ID).catch(() => null);
      const reportChannelId = "1518684031275761719";
      const reportChannel = guild ? await guild.channels.fetch(reportChannelId).catch(() => null) : null;

      if (reportChannel) {
        const reportUser = await interaction.client.users.fetch(ticket.userId).catch(() => null);
        const spamEmbed = new EmbedBuilder()
          .setTitle("⚠️ Spam / Kötüye Kullanım Raporu")
          .setDescription(
            `**Rapor Eden:** <@${interaction.user.id}> (${interaction.user.username})\n` +
            `**Şikayetçi Olduğu Kullanıcı:** <@${ticket.userId}> (${ticket.userName})\n` +
            `**Ticket ID:** \`${ticket.ticketId}\`\n` +
            `**Konu:** ${ticket.subject || 'Belirtilmedi'}\n\n` +
            `Bu kullanıcının ticket sistemi üzerinden spam/kötüye kullanım yaptığı bildirilmiştir.\n` +
            `**Kabul Et** butonuna basarsanız kullanıcı bir daha ticket açamaz.\n` +
            `**Reddet** butonuna basarsanız rapor geçersiz sayılır ve kullanıcı ticket açmaya devam edebilir.`
          )
          .setColor(0xe74c3c)
          .setThumbnail(reportUser?.displayAvatarURL() || null)
          .setTimestamp();

        const reportRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`spam_ban_accept_${ticket.userId}_${ticket.ticketId}`)
            .setLabel("✅ Kabul Et (Ticket Banla)")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`spam_ban_reject_${ticket.userId}_${ticket.ticketId}`)
            .setLabel("❌ Reddet (Raporu Geçersiz Say)")
            .setStyle(ButtonStyle.Secondary)
        );

        await reportChannel.send({ embeds: [spamEmbed], components: [reportRow] });
      }

      return interaction.reply({
        content: `⚠️ **Spam Raporu Gönderildi.**\nRaporunuz yetkili ekibine iletildi. Ekip inceledikten sonra gerekli işlem yapılacaktır.`,
        ephemeral: true
      });
    } catch (err) {
      console.error("[eposta_spam] Error:", err.message);
      return interaction.reply({ content: "❌ Rapor gönderilemedi.", ephemeral: true });
    }
  }

  if (customId.startsWith("spam_ban_accept_")) {
    const parts = customId.replace("spam_ban_accept_", "").split("_");
    const targetUserId = parts[0];
    const ticketId = parts[1];

    const User = require("../../models/User");
    let user = await User.findOne({ discordId: targetUserId });
    if (!user) {
      user = new User({ discordId: targetUserId });
    }
    user.ticketBanned = true;
    user.ticketBannedAt = new Date();
    user.ticketBannedBy = interaction.user.id;
    await user.save();

    const { EmbedBuilder } = require("discord.js");
    const doneEmbed = new EmbedBuilder()
      .setTitle("✅ Ticket Yasağı Uygulandı")
      .setDescription(`<@${targetUserId}> artık ticket sisteminden yararlanamaz.\n**İşlemi Yapan:** <@${interaction.user.id}>`)
      .setColor(0x2ecc71)
      .setTimestamp();

    return interaction.update({ embeds: [doneEmbed], components: [] });
  }

  if (customId.startsWith("spam_ban_reject_")) {
    const parts = customId.replace("spam_ban_reject_", "").split("_");
    const targetUserId = parts[0];

    const { EmbedBuilder } = require("discord.js");
    const rejEmbed = new EmbedBuilder()
      .setTitle("❌ Rapor Reddedildi")
      .setDescription(`<@${targetUserId}> hakkındaki spam raporu geçersiz sayıldı. Kullanıcı ticket açmaya devam edebilir.\n**İşlemi Yapan:** <@${interaction.user.id}>`)
      .setColor(0x95a5a6)
      .setTimestamp();

    return interaction.update({ embeds: [rejEmbed], components: [] });
  }

  // ── Kullanıcı 5 dk DM hatırlatmasındaki "Tamam" butonu ───────────────────
  if (customId.startsWith("user_dm_ok_")) {
    return interaction.update({ content: "👍 Anlaşıldı! Kanala geri dönebilirsiniz.", embeds: [], components: [] });
  }

  // ── Kullanıcı 5 dk DM hatırlatmasındaki "Sorunum Çözüldü — Kapat" butonu ─
  if (customId.startsWith("user_dm_close_")) {
    const ticketId = customId.replace("user_dm_close_", "");
    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket || ticket.status !== "open") {
      return interaction.update({ content: "ℹ️ Bu ticket zaten kapalı.", embeds: [], components: [] });
    }
    // Kapatma işlemini tetikle
    try {
      const { archiveEkoYildizTicket } = require("../services/epostaTicketService");
      ticket.status = "closed";
      ticket.closedAt = new Date();
      ticket.closeReason = "Kullanıcı: Sorunum çözüldü";
      ticket.closedBy = interaction.user.id;
      ticket.closedByName = interaction.user.username;
      await ticket.save();
      // Timers temizle
      try {
        const { pendingUserReplyTimers } = require("../services/epostaTicketService");
        if (pendingUserReplyTimers?.has(ticketId)) {
          clearTimeout(pendingUserReplyTimers.get(ticketId));
          pendingUserReplyTimers.delete(ticketId);
        }
      } catch (_) {}
      await archiveEkoYildizTicket(ticket, interaction, "Kullanıcı: Sorunum çözüldü");
    } catch (err) {
      console.error("[user_dm_close] Error:", err.message);
    }
    return interaction.update({
      content: "✅ **Ticket kapatıldı.** Destek talebiniz arşive taşındı. İyi günler!",
      embeds: [],
      components: []
    });
  }

  if (customId.startsWith("ekoyildiz_eposta_form_button_")) {
    const category = customId.replace("ekoyildiz_eposta_form_button_", "");
    const { triggerEpostaFormModal } = require("../services/epostaTicketService");
    return triggerEpostaFormModal(interaction, category);
  }

  if (customId === "ekoyildiz_reklam_form_button") {
    const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require("discord.js");
    const modal = new ModalBuilder()
      .setCustomId("ekoyildiz_reklam_form_modal")
      .setTitle("Reklam Oluşturma Talebi");

    const compNameInput = new TextInputBuilder()
      .setCustomId("reklam_topluluk_adi")
      .setLabel("Topluluğunuzun Adı")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Örn: Eko Yıldız")
      .setRequired(true);

    const memberCountInput = new TextInputBuilder()
      .setCustomId("reklam_kisi_sayisi")
      .setLabel("Kişi Sayısı (Hedef Kitle)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Örn: 50,000")
      .setRequired(true);

    const adTypeInput = new TextInputBuilder()
      .setCustomId("reklam_turu")
      .setLabel("Nasıl bir reklam olacak?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Reklamın içeriği ve formatı hakkında bilgi verin.")
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(compNameInput),
      new ActionRowBuilder().addComponents(memberCountInput),
      new ActionRowBuilder().addComponents(adTypeInput)
    );

    return interaction.showModal(modal);
  }

  if (customId.startsWith("ekoyildiz_reklam_confirm_yes_")) {
    const ticketId = customId.replace("ekoyildiz_reklam_confirm_yes_", "");
    const { handleReklamConfirm } = require("../services/reklamTicketService");
    return handleReklamConfirm(interaction, interaction.client, true, ticketId);
  }

  if (customId.startsWith("ekoyildiz_reklam_confirm_no_")) {
    const ticketId = customId.replace("ekoyildiz_reklam_confirm_no_", "");
    const { handleReklamConfirm } = require("../services/reklamTicketService");
    return handleReklamConfirm(interaction, interaction.client, false, ticketId);
  }

  if (customId.startsWith("reklam_close_")) {
    const ticketId = customId.replace("reklam_close_", "");
    const { buildCloseReasonModal } = require("../embeds");
    return interaction.showModal(buildCloseReasonModal(ticketId));
  }

  if (customId.startsWith("reklam_pause_")) {
    const ticketId = customId.replace("reklam_pause_", "");
    const { toggleReklamPause } = require("../services/reklamTicketService");
    return toggleReklamPause(interaction, ticketId);
  }

  if (customId.startsWith("reklam_prices_")) {
    const ticketId = customId.replace("reklam_prices_", "");
    const { sendReklamPrices } = require("../services/reklamTicketService");
    return sendReklamPrices(interaction, ticketId);
  }

  if (customId.startsWith("reklam_buy_")) {
    const ticketId = customId.replace("reklam_buy_", "");
    const { triggerPurchaseSelection } = require("../services/reklamTicketService");
    return triggerPurchaseSelection(interaction, ticketId);
  }

  if (customId.startsWith("claim_ticket_")) {
    const ticketId = customId.replace("claim_ticket_", "");
    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) {
      return interaction.reply({ content: "❌ Destek talebi bulunamadı.", ephemeral: true });
    }

    if (ticket.claimedBy) {
      return interaction.reply({ content: `❌ Bu destek talebi zaten <@${ticket.claimedBy}> tarafından üstlenilmiş.`, ephemeral: true });
    }

    ticket.claimedBy = interaction.user.id;
    ticket.claimedByName = interaction.user.username;
    await ticket.save();

    try {
      const { addNotification } = require("../../utils/notification");
      await addNotification(ticket.userId, {
        title: "🙋 Destek Talebi Üstlenildi",
        message: `\`${ticket.ticketId}\` numaralı destek talebiniz ${interaction.user.username} tarafından üstlenildi.`,
        icon: "🙋"
      });
    } catch (err) {
      console.error("[buttonHandler] Second claim notification error:", err.message);
    }

    // Clean up active claim routing and delete DM message
    try {
      const { activeTicketClaims, deleteActiveClaimDmMessage } = require("../services/reklamTicketService");
      await deleteActiveClaimDmMessage(ticketId);
      activeTicketClaims.delete(ticketId);
    } catch (_) {}

    await interaction.reply({
      content: `🙋‍♂️ **Destek talebi başarıyla üstlenildi!** Bu taleple <@${interaction.user.id}> ilgileniyor.`
    });

    try {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
      const currentMessage = interaction.message;
      if (currentMessage) {
        const originalRow = currentMessage.components[0];
        const newComponents = [];
        if (originalRow) {
          const updatedRow = new ActionRowBuilder();
          originalRow.components.forEach(comp => {
            if (comp.customId.startsWith("claim_ticket_")) {
              updatedRow.addComponents(
                new ButtonBuilder()
                  .setCustomId(`claimed_ticket_disabled_${ticketId}`)
                  .setLabel(`Üstlendi: ${interaction.user.username}`)
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true)
              );
            } else {
              updatedRow.addComponents(ButtonBuilder.from(comp));
            }
          });
          newComponents.push(updatedRow);
        }
        await currentMessage.edit({ components: newComponents }).catch(() => { });
      }
    } catch (editErr) {
      console.warn("Failed to edit welcome message components on claim:", editErr.message);
    }
    return;
  }

  // ── Soruşturma Sistemi Butonları ───────────────────────────────────────────
  if (customId === "investigation_start_trigger") {
    const { getTodayInvestigationCountForUser, canStartInvestigationToday, MAX_INVESTIGATIONS_PER_DAY } = require("../services/investigationService");
    const startedTodayCount = await getTodayInvestigationCountForUser(interaction.user.id);

    if (!canStartInvestigationToday(startedTodayCount)) {
      return interaction.reply({
        content: `❌ Bugün zaten ${startedTodayCount} soruşturma başlattınız. Günlük maksimum ${MAX_INVESTIGATIONS_PER_DAY} soruşturma açabilirsiniz.`,
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("investigation_start_modal")
      .setTitle("🔍 Soruşturma Başlat");

    const nameInput = new TextInputBuilder()
      .setCustomId("investigation_name")
      .setLabel("Soruşturma İsmi (Örn: Hakaret, Hırsızlık)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const targetInput = new TextInputBuilder()
      .setCustomId("investigation_target_id")
      .setLabel("Soruşturulan Kullanıcı ID'si")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const reasonInput = new TextInputBuilder()
      .setCustomId("investigation_reason")
      .setLabel("Soruşturma Gerekçesi / Neden")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(targetInput),
      new ActionRowBuilder().addComponents(reasonInput)
    );

    return interaction.showModal(modal);
  }

  if (customId.startsWith("invest_agree_")) {
    const channelId = customId.replace("invest_agree_", "");
    const { handleAgreement } = require("../services/investigationService");
    return handleAgreement(interaction, channelId, true);
  }

  if (customId.startsWith("invest_reject_")) {
    const channelId = customId.replace("invest_reject_", "");
    const { handleAgreement } = require("../services/investigationService");
    return handleAgreement(interaction, channelId, false);
  }

  if (customId.startsWith("invest_close_")) {
    const channelId = customId.replace("invest_close_", "");
    const { closeInvestigation } = require("../services/investigationService");
    return closeInvestigation(interaction, channelId);
  }

  if (customId.startsWith("invest_resume_")) {
    const channelId = customId.replace("invest_resume_", "");
    const { resumeInvestigation } = require("../services/investigationService");
    return resumeInvestigation(interaction, channelId);
  }

  if (customId.startsWith("invest_restart_")) {
    const channelId = customId.replace("invest_restart_", "");
    const { restartInvestigation } = require("../services/investigationService");
    return restartInvestigation(interaction, channelId);
  }

  if (customId.startsWith("invest_addmember_")) {
    const channelId = customId.replace("invest_addmember_", "");
    const modal = new ModalBuilder()
      .setCustomId(`invest_addmember_modal_${channelId}`)
      .setTitle("👥 Soruşturmaya Kişi Ekle");

    const input = new TextInputBuilder()
      .setCustomId("member_id")
      .setLabel("Eklenecek Yetkili/Üye ID'si")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId.startsWith("invest_removemember_")) {
    const channelId = customId.replace("invest_removemember_", "");
    const modal = new ModalBuilder()
      .setCustomId(`invest_removemember_modal_${channelId}`)
      .setTitle("👤 Soruşturmadan Kişi Çıkar");

    const input = new TextInputBuilder()
      .setCustomId("member_id")
      .setLabel("Çıkarılacak Yetkili ID'si")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (customId.startsWith("invest_resolve_")) {
    const channelId = customId.replace("invest_resolve_", "");

    const Investigation = require("../../models/Investigation");
    const invest = await Investigation.findOne({ channelId });
    if (!invest) {
      return interaction.reply({ content: "❌ Soruşturma bulunamadı.", ephemeral: true });
    }

    if (interaction.user.id !== invest.judgeId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Bu soruşturmayı sadece hakimi veya bir yönetici sonuçlandırabilir.", ephemeral: true });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`invest_penalty_select_${channelId}`)
      .setPlaceholder("Uygulanacak Ceza Türünü Seçin...")
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("CEZASIZ").setValue("CEZASIZ").setDescription("Cezasız kapatılır."),
        new StringSelectMenuOptionBuilder().setLabel("MUTE (Zamanaşımı)").setValue("MUTE").setDescription("Belirli saat boyunca mute uygulanır."),
        new StringSelectMenuOptionBuilder().setLabel("KICK (At)").setValue("KICK").setDescription("Sunucudan atılır."),
        new StringSelectMenuOptionBuilder().setLabel("BAN (Yasakla)").setValue("BAN").setDescription("Belirli gün boyunca yasaklanır."),
        new StringSelectMenuOptionBuilder().setLabel("HAPİS (Jail)").setValue("HAPIS").setDescription("Belirli gün boyunca hapishaneye atılır.")
      );

    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({ content: "⚖️ **Lütfen uygulanacak disiplin cezasını seçin:**", components: [row] });
  }

  // ── Hata Bildirim Butonu ──────────────────────────────────────────────────
  if (customId.startsWith("report_err_")) {
    const errorId = customId.replace("report_err_", "");
    await interaction.deferUpdate().catch(() => { });

    try {
      const ErrorReportModel = require("../../models/ErrorReport");
      const report = await ErrorReportModel.findOne({ _id: errorId });
      if (report) {
        report.reported = true;
        await report.save();

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`reported_${errorId}`)
            .setLabel("✅ HATA BİLDİRİLDİ")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );

        const payload = { components: [disabledRow] };
        if (interaction.message.embeds && interaction.message.embeds.length > 0) {
          payload.embeds = [interaction.message.embeds[0]];
        }
        await interaction.editReply(payload).catch(() => { });

        await interaction.followUp({
          content: "✅ **Hata başarıyla geliştirici ekibine bildirildi.** Teşekkür ederiz!",
          ephemeral: true
        }).catch(() => { });
      } else {
        await interaction.followUp({
          content: "❌ Hata raporu veri tabanında bulunamadı veya silinmiş olabilir.",
          ephemeral: true
        }).catch(() => { });
      }
    } catch (err) {
      console.error("[report_err] Button click handle error:", err.message);
      await interaction.followUp({
        content: "❌ Hata bildirilirken beklenmedik bir sorun oluştu.",
        ephemeral: true
      }).catch(() => { });
    }
    return;
  }

  // ── Koç Mesaj Filtre Butonları ──────────────────────────────────────────
  if (customId.startsWith("coach_msg_level_")) {
    const level = customId.replace("coach_msg_level_", "");
    const levelMap = { "all": 0, "important": 1, "silent": 2 };
    const { handleCoachMessageLevelButton } = require("../services/coachMessageService");
    return handleCoachMessageLevelButton(interaction, levelMap[level]);
  }

  // ── Birim İçi Sohbet Butonları ──────────────────────────────────────────
  if (customId.startsWith("unit_chat_")) {
    const { handleUnitChatButton } = require("../services/unitChatService");
    return handleUnitChatButton(interaction);
  }

  // ── Nöbet Sistemi Butonları ──────────────────────────────────────────────
  if (customId === "staff_duty_start" || customId === "staff_duty_end") {
    const { handleDutyButton } = require("../services/staffDutyService");
    return handleDutyButton(interaction);
  }

  // ── Birim Talepleri ve Emirleri Butonları ─────────────────────────────────
  if (customId === "staff_units_request_menu" || customId.startsWith("unit_req_") || customId.startsWith("unit_cmd_")) {
    const { handleRequestButton } = require("../services/unitRequestService");
    return handleRequestButton(interaction);
  }

  // ── Panel butonu ────────────────────────────────────────────────────────
  if (customId.startsWith("panel_")) {
    const { handlePanelButton } = require("../services/mainPanelService");
    return handlePanelButton(interaction);
  }

  // ── Mod Anasayfası (Erişim Butonu) ─────────────────────────────────────────
  if (customId === "talk_to_coach") {
    await interaction.deferReply({ ephemeral: true }).catch(async () => {
      await interaction.deferUpdate().catch(() => {});
    });
    
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) {
      return interaction.editReply({ content: "❌ Personel kaydınız bulunamadı." }).catch(() => {});
    }

    const { generateMorningBriefingEmbed, getMorningBriefingComponents } = require("../services/staffSystem");
    const embed = await generateMorningBriefingEmbed(p, interaction.client);
    const components = await getMorningBriefingComponents(p);

    await interaction.editReply({ embeds: [embed], components }).catch(async () => {
      await interaction.followUp({ embeds: [embed], components, ephemeral: true }).catch(() => {});
    });
    return;
  }

  if (customId === "staff_claim_salary_transfer") {
    await interaction.deferUpdate().catch(() => {});
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.followUp({ content: '❌ Personel kaydınız bulunamadı.', ephemeral: true });

      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      if (p.lastSalaryClaimedAt && (Date.now() - new Date(p.lastSalaryClaimedAt).getTime() < ONE_WEEK_MS)) {
        return interaction.followUp({ content: '❌ Bu hafta zaten maaş aldınız.', ephemeral: true });
      }

      const voiceMinutes = p.weeklyStats?.voiceMinutes || 0;
      const ticketsSolved = p.weeklyStats?.ticketsSolved || 0;
      const moderationActions = p.weeklyStats?.moderationActions || 0;
      const marketMultiplier = Number(p.marketMultiplier || 2.5);
      const crisisTaxRate = Number(p.crisisTaxRate || 0.1);
      
      const baseVoice = Math.floor(voiceMinutes * 1.4);
      const baseTickets = Math.floor(ticketsSolved * 85);
      const baseMod = Math.floor(moderationActions * 60);
      const gross = Math.floor((baseVoice + baseTickets + baseMod) * marketMultiplier);

      if (gross <= 0) {
        return interaction.followUp({ content: '❌ Aktifliğiniz bulunmamaktadır.', ephemeral: true });
      }

      const lastClaimDate = p.lastSalaryClaimedAt || new Date(0);
      const warnsThisWeek = p.disciplinary?.warns?.filter(w => {
        const wDate = w.date ? new Date(w.date) : (w.createdAt ? new Date(w.createdAt) : null);
        return wDate && wDate > lastClaimDate;
      }) || [];
      const hasWarning = warnsThisWeek.length > 0;
      const disciplinaryDeduction = hasWarning ? Math.floor(gross * 0.15) : 0;
      const taxDeduction = Math.floor(gross * crisisTaxRate);
      let netPay = Math.max(0, gross - disciplinaryDeduction - taxDeduction);

      let loanDeducted = 0;
      if (p.loanAmount && p.loanAmount > 0) {
        loanDeducted = Math.min(netPay, p.loanAmount);
        netPay -= loanDeducted;
        p.loanAmount -= loanDeducted;
      }

      p.gamification = p.gamification || {};
      p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + netPay;
      p.lastSalaryClaimedAt = new Date();
      
      // Reset weekly statistics
      p.weeklyStats = { voiceMinutes: 0, ticketsSolved: 0, moderationActions: 0 };
      await p.save();

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Ödeme Başarıyla Tamamlandı! (v0.7)')
        .setDescription(
          `Sayın <@${interaction.user.id}>,\n\n` +
          `**Net Maaşınız (${netPay} TL)** başarıyla yetkili cüzdanınıza aktarılmıştır.\n` +
          `📈 **Piyasa Durumu:** ${p.marketState || 'Boğa Piyasası'} • **x${Number(p.marketMultiplier || 2.5).toFixed(1)}**\n\n` +
          (loanDeducted > 0 ? `• **Kesilen Maaş Avansı:** \`-${loanDeducted} TL\` (Kalan Avans Borcu: \`${p.loanAmount} TL\`)\n` : '') +
          `💳 **Güncel Cüzdan Bakiyeniz:** \`${p.gamification.ecoCoins} TL\`\n` +
          `*Haftalık aktiflik sayaçlarınız sıfırlanmıştır.*`
        )
        .setFooter({ text: 'Eko Yıldız • Finansal Yönetim Departmanı | Sürüm: v0.7' })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed], components: [] }).catch(() => {});
    } catch (err) {
      console.error('[Salary-Transfer] Hata:', err.message);
      await interaction.followUp({ content: `❌ İşlem sırasında bir hata oluştu: ${err.message}`, ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (customId.startsWith("staff_resign_approve_") || customId.startsWith("staff_resign_reject_")) {
    const StaffProgress = require("../../models/StaffProgress");
    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isManager = (managerProgress && managerProgress.level >= 6) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isManager) {
      return interaction.reply({ content: "❌ Bu işlemi gerçekleştirmek için **En Yüksek Rütbe** (Level 6) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    const isApprove = customId.startsWith("staff_resign_approve_");
    const targetUserId = customId.replace(isApprove ? "staff_resign_approve_" : "staff_resign_reject_", "");
    
    await interaction.deferUpdate().catch(() => {});

    const p = await StaffProgress.findOne({ userId: targetUserId });
    if (!p) {
      return interaction.followUp({ content: "❌ İlgili personelin kaydı veritabanında bulunamadı.", ephemeral: true }).catch(() => {});
    }

    if (isApprove) {
      const activeDays = p.stats?.activeDays || 0;
      const hasSeverance = activeDays >= 60;
      const severancePay = hasSeverance ? Math.floor((p.gamification?.totalPoints || 0) * 0.5 + (p.gamification?.currentXP || 0) * 0.2) : 0;
      
      const finalCoins = (p.gamification?.ecoCoins || 0) + severancePay;
      if (finalCoins > 0) {
        try {
          const Economy = require("../../models/Economy");
          const { saveStoreNow } = require("../../models/Store");
          let eco = await Economy.findOne({ userId: targetUserId });
          if (!eco) {
            eco = new Economy({ userId: targetUserId });
          }
          eco.balance = (eco.balance || 0) + finalCoins;
          eco.totalEarned = (eco.totalEarned || 0) + finalCoins;
          await eco.save();
          saveStoreNow();
        } catch (ecoErr) {
          console.error('[Resign-Approve] Wallet transfer error:', ecoErr.message);
        }
      }

      const { resignFromStaff } = require("../services/staffSystem");
      await resignFromStaff(targetUserId, p.resignReason || 'Mülakat Sonrası Onaylandı', interaction.client);

      try {
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        if (targetUser) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("🤝 İstifanız Üst Yönetim Tarafından Onaylandı")
            .setDescription(
              `Merhaba <@${targetUserId}>,\n\n` +
              `İstifa başvurunuz üst yönetim mülakatı sonrasında **onaylanmıştır**.\n\n` +
              `**📊 BİLGİLER**\n` +
              `• **Kıdem Tazminatı:** ${hasSeverance ? `${severancePay} TL` : 'Hak Edilmedi (<60 Gün)'}\n` +
              `• **Cüzdana Aktarılan Toplam Tutar:** \`${finalCoins} TL\` (Maaş bakiyeniz + Tazminatınız genel cüzdanınıza aktarılmıştır.)\n` +
              `• **Hizmet Süresi:** ${activeDays} gün\n\n` +
              `Hizmetleriniz ve emekleriniz için teşekkür eder, bundan sonraki hayatınızda başarılar dileriz! 💚`
            )
            .setFooter({ text: "Eko Yıldız • Üst Yönetim Kurulu" })
            .setTimestamp();
          await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
        }
      } catch (dmErr) {
        console.warn(`[Resign-Approve] DM send error to ${targetUserId}:`, dmErr.message);
      }

      const doneEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ İstifa Başvurusu Mülakatı Onaylandı')
        .setDescription(
          `**Personel:** <@${targetUserId}>\n` +
          `**Onaylayan Yönetici:** <@${interaction.user.id}>\n` +
          `**Aktif Gün:** ${activeDays} gün\n` +
          `**Tazminat Ödemesi:** ${hasSeverance ? `${severancePay} TL` : 'Yok'}\n` +
          `**Cüzdana Aktarılan Toplam:** ${finalCoins} TL`
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [doneEmbed], components: [] }).catch(() => {});

    } else {
      p.status = 'active';
      p.resignedAt = null;
      p.resignReason = null;
      await p.save();

      try {
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        if (targetUser) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ İstifa Talebiniz Görüşülmek Üzere Askıya Alındı")
            .setDescription(
              `Merhaba <@${targetUserId}>,\n\n` +
              `İstifa talebiniz üst yönetim tarafından **reddedilmiş veya görüşülmek üzere askıya alınmıştır**.\n` +
              `Görevinize aktif olarak iade edildiniz. Lütfen detaylar için üst yönetim ile iletişime geçiniz.`
            )
            .setFooter({ text: "Eko Yıldız • Üst Yönetim Kurulu" })
            .setTimestamp();
          await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
        }
      } catch (_) {}

      const rejEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ İstifa Talebi Görüşülmek Üzere Reddedildi')
        .setDescription(`**Personel:** <@${targetUserId}>\n**Reddeden/Görüşen Yönetici:** <@${interaction.user.id}>\n*Yetkili aktif göreve iade edildi.*`)
        .setTimestamp();
      await interaction.editReply({ embeds: [rejEmbed], components: [] }).catch(() => {});
    }
    return;
  }

  if (customId.startsWith("incident_inspect_") || customId.startsWith("incident_approve_") || customId.startsWith("incident_reject_")) {
    const StaffProgress = require("../../models/StaffProgress");
    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isManager = (managerProgress && managerProgress.level >= 6) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isManager) {
      return interaction.reply({ content: "❌ Bu dosyayı incelemek veya onaylamak için **En Yüksek Rütbe** (Level 6) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    const parts = customId.split("_");
    const action = parts[1]; // inspect, approve, reject
    const caseId = parts[2];
    const reporterId = parts[3];

    if (action === "inspect") {
      return interaction.reply({ content: `📂 **${caseId}** numaralı dosya şu anda yetkilimiz <@${interaction.user.id}> tarafından inceleniyor.`, ephemeral: false });
    }

    await interaction.deferUpdate().catch(() => {});

    if (action === "approve") {
      const reporterProgress = await StaffProgress.findOne({ userId: reporterId });
      if (reporterProgress) {
        reporterProgress.gamification = reporterProgress.gamification || {};
        reporterProgress.gamification.ecoCoins = (reporterProgress.gamification.ecoCoins || 0) + 50;
        reporterProgress.gamification.currentXP = (reporterProgress.gamification.currentXP || 0) + 100;
        await reporterProgress.save();

        try {
          const reporterUser = await interaction.client.users.fetch(reporterId).catch(() => null);
          if (reporterUser) {
            const reportEmbed = new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("⚖️ Vaka Raporunuz Onaylandı!")
              .setDescription(
                `Tebrikler Dedektif! **${caseId}** numaralı vaka raporunuz üst yönetim tarafından onaylandı.\n\n` +
                `**🎁 KAZANILAN ÖDÜLLER:**\n` +
                `• **+50 TL (EkoCoin)**\n` +
                `• **+100 Elmas (💎)**`
              )
              .setTimestamp();
            await reporterUser.send({ embeds: [reportEmbed] }).catch(() => {});
          }
        } catch (_) {}
      }

      const originalEmbed = interaction.message.embeds[0];
      const doneEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0x2ecc71)
        .setTitle(`⚖️ Vaka Onaylandı (${caseId})`)
        .setDescription(`**Onaylayan Koordinatör:** <@${interaction.user.id}>\n*Yetkiliye +50 TL ve +100 Elmas (💎) ödülü verildi.*`);

      await interaction.editReply({ embeds: [doneEmbed], components: [] }).catch(() => {});
    } else if (action === "reject") {
      const originalEmbed = interaction.message.embeds[0];
      const doneEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0x95a5a6)
        .setTitle(`❌ Vaka Kapatıldı - Yetersiz Delil (${caseId})`)
        .setDescription(`**Kapatan Koordinatör:** <@${interaction.user.id}>\n*Delil yetersizliği veya geçersiz rapor nedeniyle dosya arşive kaldırıldı.*`);

      await interaction.editReply({ embeds: [doneEmbed], components: [] }).catch(() => {});
    }
    return;
  }

  if (customId.startsWith("audit_inspect_")) {
    const StaffProgress = require("../../models/StaffProgress");
    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isManager = (managerProgress && managerProgress.level >= 6) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isManager) {
      return interaction.reply({ content: "❌ Personel incelemek için **En Yüksek Rütbe** (Level 6) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    const targetUserId = customId.replace("audit_inspect_", "");
    const targetProgress = await StaffProgress.findOne({ userId: targetUserId });
    if (!targetProgress) {
      return interaction.reply({ content: "❌ Personel kaydı bulunamadı.", ephemeral: true });
    }

    const { calculateKpi } = require("../services/staffDutyService");
    const kpi = calculateKpi(targetProgress);

    function drawBar(value, max) {
      const percentage = Math.min(100, Math.max(0, Math.floor((value / max) * 100)));
      const filledCount = Math.floor(percentage / 10);
      const emptyCount = 10 - filledCount;
      const bar = '█'.repeat(filledCount) + '░'.repeat(emptyCount);
      return `\`[${bar}] %${percentage}\` (\`${value}/${max}\`)`;
    }

    const reportEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🔍 Personel Denetim Raporu (<@${targetUserId}>)`)
      .setDescription("Seçilen yetkilinin genel aktiflik ve disiplin analiz dökümü aşağıdadır.")
      .addFields(
        { name: '🎫 Ticket Çözüm Skoru', value: drawBar(targetProgress.stats?.ticketsSolved || 0, 50), inline: false },
        { name: '🎤 Ses Aktiflik Skoru', value: drawBar(targetProgress.stats?.totalVoiceMinutes || 0, 500), inline: false },
        { name: '⚠️ Disiplin Skoru', value: drawBar(Math.max(0, 100 - (targetProgress.disciplinary?.warns?.length || 0) * 10), 100), inline: false },
        { name: '📊 Genel KPI Puanı', value: drawBar(kpi, 100), inline: false }
      )
      .setFooter({ text: 'Eko Yıldız • Akıllı AI Denetim Servisi' })
      .setTimestamp();

    return interaction.reply({ embeds: [reportEmbed], ephemeral: true });
  }

  if (customId === "staff_use_coffee_break") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: "❌ Personel kaydınız bulunamadı." });

      p.burnoutLeaveUntil = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await p.save();

      if (p.duty?.isActive) {
        const { endDuty } = require("../services/staffDutyService");
        await endDuty(interaction, interaction.client, 'Burnout nedeniyle zorunlu kahve izni başlatıldı.').catch(() => {});
      }

      const replyEmbed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("☕ Zorunlu Kahve İzni Aktif Edildi")
        .setDescription(
          `Sayın <@${interaction.user.id}>,\n\n` +
          `Aşırı yorgunluk (Burnout) durumunuz nedeniyle **12 saatlik zorunlu dinlenme izniniz** başlatılmıştır.\n\n` +
          `Bu süre boyunca aktif görev yapamayacak, moderasyon araçlarını kullanamayacaksınız. ` +
          `İstirahat bitiş süreniz: <t:${Math.floor(p.burnoutLeaveUntil.getTime() / 1000)}:F>`
        )
        .setFooter({ text: "Eko Yıldız • İnsan Kaynakları" })
        .setTimestamp();

      await interaction.editReply({ embeds: [replyEmbed] }).catch(() => {});
    } catch (err) {
      console.error('[Coffee-Break] Hata:', err.message);
      await interaction.editReply({ content: `❌ Hata: ${err.message}` }).catch(() => {});
    }
    return;
  }

  if (customId === "tactical_alarm_all") {
    const StaffProgress = require("../../models/StaffProgress");
    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isManager = (managerProgress && managerProgress.level >= 6) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isManager) {
      return interaction.reply({ content: "❌ Bu komutu tetiklemek için **En Yüksek Rütbe** (Level 6) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const activeStaff = await StaffProgress.find({ status: 'active' });
      const idleStaff = activeStaff.filter(s => !s.duty?.isActive);
      let sentCount = 0;

      for (const s of idleStaff) {
        try {
          const user = await interaction.client.users.fetch(s.userId).catch(() => null);
          if (user) {
            const alarmEmbed = new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("🚨 TAKTİK KOMUTA ACİL ALARMI")
              .setDescription(
                `Sayın Yetkili,\n\n` +
                `Üst yönetim tarafından acil durum kapsamında **aktif nöbete çağrıldınız**!\n` +
                `Lütfen en kısa sürede kontrol panelinizi açarak nöbetinizi başlatın.`
              )
              .setFooter({ text: 'Eko Yıldız • Komuta Merkezi' })
              .setTimestamp();
            await user.send({ embeds: [alarmEmbed] });
            sentCount++;
          }
        } catch (_) {}
      }

      return interaction.editReply({ content: `🚨 **Telsiz çağrısı tamamlandı.** Toplam **${sentCount}** aktif olmayan yetkiliye acil nöbet çağrısı gönderildi.` });
    } catch (err) {
      console.error('[Tactical-Alarm] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "tactical_announce_leader") {
    const StaffProgress = require("../../models/StaffProgress");
    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isManager = (managerProgress && managerProgress.level >= 6) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isManager) {
      return interaction.reply({ content: "❌ Bu komutu tetiklemek için **En Yüksek Rütbe** (Level 6) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const leader = await StaffProgress.findOne({ status: 'active' }).sort({ 'gamification.currentXP': -1 });
      if (!leader) {
        return interaction.editReply({ content: "❌ Aktif personel bulunamadı." });
      }

      leader.gamification = leader.gamification || {};
      leader.gamification.ecoCoins = (leader.gamification.ecoCoins || 0) + 100;
      await leader.save();

      const leaderEmbed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🏆 HAFTANIN LİDER YETKİLİSİ')
        .setDescription(
          `Haftalık üstün performansı ve gayretleriyle **Haftanın Lider Yetkilisi** seçilen personelimiz ilan edilmiştir!\n\n` +
          `👤 **Lider Yetkili:** <@${leader.userId}>\n` +
          `✨ **Mevcut Elmas Puanı:** \`${leader.gamification?.currentXP || 0} Elmas\`\n` +
          `🎁 **Kazanılan Hak Ediş:** **+100 TL (EkoCoin)**\n\n` +
          `Örnek duruşu ve üstün gayretleri için kendisini tebrik eder, başarılarının devamını dileriz! 💚`
        )
        .setFooter({ text: 'Eko Yıldız • Üst Yönetim Kurulu' })
        .setTimestamp();

      const { CHANNELS } = require("../services/staffAutomation");
      const adminLogChanId = CHANNELS.TERFI_LOG;
      const adminLogChan = await interaction.client.channels.fetch(adminLogChanId).catch(() => null);
      if (adminLogChan && adminLogChan.isTextBased()) {
        await adminLogChan.send({ embeds: [leaderEmbed] });
      }

      return interaction.editReply({ content: `🏆 **Haftanın lideri ilan edildi:** <@${leader.userId}> yetkilisine +100 TL ödülü teslim edildi.` });
    } catch (err) {
      console.error('[Tactical-Leader] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "tactical_change_radio") {
    const StaffProgress = require("../../models/StaffProgress");
    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isManager = (managerProgress && managerProgress.level >= 6) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isManager) {
      return interaction.reply({ content: "❌ Bu işlemi başlatmak için **En Yüksek Rütbe** (Level 6) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_tactical_change_radio')
      .setTitle('📋 Telsiz Frekansı Değiştir');

    const input = new TextInputBuilder()
      .setCustomId('radio_freq')
      .setLabel('Yeni Telsiz Frekansı')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: 145.500 MHz')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  if (customId.startsWith("staff_2fa_")) {
    const parts = customId.split("_");
    const clickedCode = parts[2];
    const correctCode = parts[3];
    const targetUserId = parts[4];

    if (interaction.user.id !== targetUserId) {
      return interaction.reply({ content: "❌ Bu doğrulama ekranı size ait değildir.", ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});

    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: targetUserId });
    if (!p) return;

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const disabledRows = [];
    if (interaction.message.components.length > 0) {
      const row = new ActionRowBuilder();
      interaction.message.components[0].components.forEach(btn => {
        const disabledBtn = ButtonBuilder.from(btn).setDisabled(true);
        if (btn.customId === customId) {
          disabledBtn.setStyle(clickedCode === correctCode ? ButtonStyle.Success : ButtonStyle.Danger);
        }
        row.addComponents(disabledBtn);
      });
      disabledRows.push(row);
    }

    if (clickedCode === correctCode) {
      p.securityClearanceUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 mins clearance
      await p.save();

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ GÜVENLİK GEÇİŞİ ONAYLANDI")
        .setDescription(
          `Erişim yetkiniz başarıyla **onaylandı**.\n\n` +
          `Lütfen sunucu kanalındaki menüden yapmak istediğiniz işlemi **5 dakika içinde** tekrar seçerek gerçekleştiriniz.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed], components: disabledRows }).catch(() => {});
    } else {
      // Reduce KPI by -5
      const { calculateKpi } = require("../services/staffDutyService");
      p.warnings = p.warnings || { count: 0 };
      p.warnings.count = (p.warnings.count || 0) + 1; // treating as a warning equivalent, or we can just subtract KPI directly by modifying warnings.count or adding disciplinary warning!
      // Let's add a disciplinary warning or warning increment to deduct KPI
      // Or we can deduct from warnings count. Let's add an official warning:
      p.disciplinary = p.disciplinary || { warns: [], commendations: [] };
      p.disciplinary.warns.push({
        date: new Date(),
        reason: "İki Faktörlü Personel Doğrulamasında Yanlış Koda Tıklama (Güvenlik İhlali Teşebbüsü)",
        issuedBy: "Sistem Otomasyonu (2FA)"
      });
      await p.save();

      const failEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🚨 ERİŞİM REDDEDİLDİ - GÜVENLİK İHLALİ")
        .setDescription(
          `Doğrulama kodu hatalı! Güvenlik ihlali teşebbüsü tespit edildi.\n\n` +
          `• **Uygulanan Ceza:** Sicilinize Disiplin Uyarısı işlendi (-10 KPI).\n` +
          `• **Güvenlik Durumu:** Olay üst yönetim loglarına raporlanmıştır.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [failEmbed], components: disabledRows }).catch(() => {});

      // Log security incident to CEZA_LOG
      try {
        const { CHANNELS } = require("../services/staffAutomation");
        const adminLogChanId = CHANNELS.CEZA_LOG;
        const adminLogChan = await interaction.client.channels.fetch(adminLogChanId).catch(() => null);
        if (adminLogChan && adminLogChan.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("🚨 GÜVENLİK GEÇİŞİ İHLAL RAPORU")
            .setDescription(`👤 <@${targetUserId}> adlı yetkili 2FA doğrulaması sırasında yanlış koda tıkladı.`)
            .addFields(
              { name: '👤 Yetkili', value: `<@${targetUserId}> (${targetUserId})`, inline: true },
              { name: '🔒 Tıklanan Kod', value: clickedCode, inline: true },
              { name: '🔑 Beklenen Kod', value: correctCode, inline: true },
              { name: '🔨 Ceza', value: 'Sicil Disiplin Uyarısı (-10 KPI)', inline: false }
            )
            .setTimestamp();
          await adminLogChan.send({ embeds: [logEmbed] });
        }
      } catch (logErr) {
        console.error('[Staff-2FA] Log error:', logErr.message);
      }
    }
    return;
  }

  if (customId === "staff_pip_sign") {
    await interaction.deferUpdate().catch(() => {});
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p || !p.pip?.isActive) {
        return interaction.followUp({ content: "❌ Aktif bir PIP kontratınız bulunmamaktadır.", ephemeral: true }).catch(() => {});
      }

      p.pip.signed = true;
      p.pip.startedAt = new Date();
      p.pip.consecutiveSuccessDays = 0;
      await p.save();

      const signEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("📋 PIP Kontratı İmzalandı ve Başlatıldı")
        .setDescription(
          `Sayın Yetkili,\n\n` +
          `**Performans İyileştirme Planı (PIP)** resmi olarak başlamıştır.\n\n` +
          `• **Hedef:** 3 gün boyunca günlük hedeflerinizin **2 katını** tamamlayın.\n` +
          `• **Ödül:** Eski rütbe ve yetkileriniz geri verilecek, sicil temizlenecektir.\n` +
          `• **Süreç Durumu:** 1. Gün aktif hedefleri panelinize yüklenmiştir.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [signEmbed], components: [] }).catch(() => {});
    } catch (err) {
      console.error('[PIP-Sign] Hata:', err.message);
    }
    return;
  }

  if (customId === "staff_pip_status") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p || !p.pip?.isActive) {
        return interaction.editReply({ content: "❌ Aktif bir PIP kaydınız bulunmuyor." });
      }

      const statusEmbed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("📊 PIP İlerleme Raporu")
        .setDescription(
          `**Başlangıç Tarihi:** <t:${Math.floor(new Date(p.pip.startedAt).getTime() / 1000)}:F>\n` +
          `**Başarılı Gün Streak:** \`${p.pip.consecutiveSuccessDays || 0} / 3 gün\`\n\n` +
          `*Rütbe tenzilatını engellemek için kalan günleri de başarıyla tamamlamalısınız. Hedefleriniz günlük 2 katıdır.*`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [statusEmbed] }).catch(() => {});
    } catch (err) {
      console.error('[PIP-Status] Hata:', err.message);
      await interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
    return;
  }

  if (customId === "staff_unit_logistics_manage") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffUnit = require("../../models/StaffUnit");
      const UnitBudget = require("../../models/UnitBudget");
      const userUnit = await StaffUnit.findOne({ userId: interaction.user.id });
      
      if (!userUnit || !userUnit.unitName || userUnit.rank !== 3) {
        return interaction.editReply({ content: "❌ Bu paneli görüntüleme yetkiniz yoktur. Sadece Birim Liderleri lojistiği yönetebilir." });
      }

      const raw = (userUnit.unitName || '').toString().trim();
      const normalizedUnitName = raw.toUpperCase().includes('_BIRIMI') ? raw.toUpperCase() : `${raw.toUpperCase()}_BIRIMI`;
      let ub = await UnitBudget.findOne({ unitName: normalizedUnitName });
      if (!ub) {
        ub = new UnitBudget({ unitName: normalizedUnitName });
        await ub.save();
      }

      const logisticsEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`📦 Birim Lojistik Masası (${userUnit.unitName})`)
        .setDescription(
          `Biriminizin ortak kaynak havuzu aşağıda listelenmiştir. Lider olarak prim dağıtabilir, reklam satın alabilir veya ekstra izin kredisi fonlayabilirsiniz.\n\n` +
          `💰 **Ortak Birim Bütçesi:** \`${ub.budget} TL\`\n` +
          `💎 **Ortak Birim Elması:** \`${ub.diamonds} 💎\``
        )
        .setFooter({ text: 'Eko Yıldız • Birim Lojistiği' })
        .setTimestamp();

      const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('unit_logistics_bonus_trigger')
          .setLabel('💸 Prim Dağıt')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('unit_logistics_ad_trigger')
          .setLabel('💎 Birim Reklamı Al (500 💎)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('unit_logistics_leave_trigger')
          .setLabel('🎫 İzin Kredisi Fonla (200 TL)')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.editReply({ embeds: [logisticsEmbed], components: [row] }).catch(() => {});
    } catch (err) {
      console.error('[Unit-Logistics] Hata:', err.message);
      await interaction.editReply({ content: `❌ Hata: ${err.message}` }).catch(() => {});
    }
    return;
  }

  if (customId === "unit_logistics_bonus_trigger" || customId === "unit_logistics_leave_trigger") {
    const StaffUnit = require("../../models/StaffUnit");
    const userUnit = await StaffUnit.findOne({ userId: interaction.user.id });
    if (!userUnit || userUnit.rank !== 3) {
      return interaction.reply({ content: "❌ Birim Lideri değilsiniz.", ephemeral: true });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    if (customId === "unit_logistics_bonus_trigger") {
      const modal = new ModalBuilder()
        .setCustomId('modal_unit_logistics_bonus')
        .setTitle('💸 Prim Dağıtım Formu');

      const targetInput = new TextInputBuilder()
        .setCustomId('bonus_target_id')
        .setLabel('Prim Verilecek Yetkili ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Yetkilinin Discord ID\'si')
        .setRequired(true);

      const amountInput = new TextInputBuilder()
        .setCustomId('bonus_amount')
        .setLabel('Prim Miktarı (TL)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örn: 100')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(targetInput),
        new ActionRowBuilder().addComponents(amountInput)
      );
      return interaction.showModal(modal).catch(() => {});
    } else {
      const modal = new ModalBuilder()
        .setCustomId('modal_unit_logistics_leave')
        .setTitle('🎫 İzin Kredisi Fonlama Masası');

      const targetInput = new TextInputBuilder()
        .setCustomId('leave_target_id')
        .setLabel('Kredi Tanımlanacak Yetkili ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Yetkilinin Discord ID\'si')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(targetInput));
      return interaction.showModal(modal).catch(() => {});
    }
  }

  if (customId === "unit_logistics_ad_trigger") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffUnit = require("../../models/StaffUnit");
      const UnitBudget = require("../../models/UnitBudget");
      const userUnit = await StaffUnit.findOne({ userId: interaction.user.id });
      if (!userUnit || userUnit.rank !== 3) {
        return interaction.editReply({ content: "❌ Birim Lideri değilsiniz." });
      }

      const ub = await UnitBudget.findOne({ unitName: userUnit.unitName });
      if (!ub || ub.diamonds < 500) {
        return interaction.editReply({ content: `❌ Havuzda yeterli elmas bulunmuyor. Gerekli: 500 💎 | Mevcut: \`${ub ? ub.diamonds : 0} 💎\`` });
      }

      ub.diamonds -= 500;
      await ub.save();

      const { CHANNELS } = require("../services/staffAutomation");
      const logChan = await interaction.client.channels.fetch(CHANNELS.TERFI_LOG).catch(() => null);
      if (logChan && logChan.isTextBased()) {
        const adEmbed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle(`📢 BİRİM MOTİVASYON REKLAMI - ${userUnit.unitName}`)
          .setDescription(
            `🚀 **${userUnit.unitName}** Birimi Lideri <@${interaction.user.id}> ortak birim havuzundan **500 💎** kullanarak birim reklamı yayınlattı!\n\n` +
            `**"${userUnit.unitName} birimi olarak sunucuda adaleti ve aktifliği sağlamak için gece gündüz nöbetteyiz. Tüm üyelerimize iyi görevler dileriz!"**\n\n` +
            `Birlik ve beraberliğiniz daim olsun! 💚`
          )
          .setTimestamp();
        await logChan.send({ embeds: [adEmbed] });
      }

      return interaction.editReply({ content: "✅ **Birim motivasyon reklamı satın alındı ve duyuruldu!**" });
    } catch (err) {
      console.error('[Unit-Ad] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId.startsWith("hearing_defense_btn_")) {
    const hearingId = customId.replace("hearing_defense_btn_", "");
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`modal_hearing_defense_${hearingId}`)
      .setTitle('⚖️ Savunma Beyan Formu');

    const input = new TextInputBuilder()
      .setCustomId('defense_text')
      .setLabel('Savunma Gerekçeniz')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Lütfen olay anını ve savunmanızı detaylıca buraya yazınız.')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  if (customId.startsWith("hearing_accept_btn_")) {
    await interaction.deferUpdate().catch(() => {});
    try {
      const hearingId = customId.replace("hearing_accept_btn_", "");
      const DisciplinaryHearing = require("../../models/DisciplinaryHearing");
      const hearing = await DisciplinaryHearing.findOne({ hearingId });
      if (!hearing || hearing.status !== "pending_defense") {
        return interaction.followUp({ content: "❌ Soruşturma bulunamadı veya zaten sonuçlandırıldı.", ephemeral: true }).catch(() => {});
      }

      hearing.status = 'accepted';
      await hearing.save();

      const { addDisciplinaryWarn } = require("../services/staffDutyService");
      await addDisciplinaryWarn(hearing.targetUserId, hearing.reason, hearing.issuedBy);

      const doneEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Cezayı Kabul Ettiniz")
        .setDescription("Suçlamayı kabul ettiniz ve disiplin uyarısı sicilinize işlendi. KPI puanınız düşürülmüştür.")
        .setTimestamp();

      await interaction.editReply({ embeds: [doneEmbed], components: [] }).catch(() => {});
    } catch (err) {
      console.error('[Hearing-Accept] Hata:', err.message);
    }
    return;
  }

  if (customId.startsWith("hearing_coord_approve_") || customId.startsWith("hearing_coord_reject_")) {
    const StaffProgress = require("../../models/StaffProgress");
    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isCoord = (managerProgress && managerProgress.level >= 5) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isCoord) {
      return interaction.reply({ content: "❌ Soruşturmaları değerlendirmek için **Genel Koordinatör** (Level >= 5) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});

    const isApprove = customId.startsWith("hearing_coord_approve_");
    const hearingId = customId.replace(isApprove ? "hearing_coord_approve_" : "hearing_coord_reject_", "");
    
    try {
      const DisciplinaryHearing = require("../../models/DisciplinaryHearing");
      const hearing = await DisciplinaryHearing.findOne({ hearingId });
      if (!hearing || hearing.status !== "submitted_defense") {
        return interaction.followUp({ content: "❌ Soruşturma bulunamadı veya savunması henüz gönderilmemiş.", ephemeral: true }).catch(() => {});
      }

      if (isApprove) {
        // Defense justified -> Warn canceled
        hearing.status = 'rejected';
        await hearing.save();

        try {
          const targetUser = await interaction.client.users.fetch(hearing.targetUserId).catch(() => null);
          if (targetUser) {
            const okEmbed = new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("⚖️ Disiplin Soruşturması Sonucu: İPTAL")
              .setDescription(`Yapılan inceleme ve savunmanız sonucunda, hakkınızdaki disiplin uyarısı talebi **iptal edilmiştir**.\n\n*Sicilinize herhangi bir ceza işlenmemiştir.*`)
              .setTimestamp();
            await targetUser.send({ embeds: [okEmbed] }).catch(() => {});
          }
        } catch (_) {}

        const doneEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("⚖️ Savunma Haklı Bulundu ve Ceza İptal Edildi")
          .setDescription(`**Değerlendiren Koordinatör:** <@${interaction.user.id}>\n*Soruşturma kapatıldı ve disiplin uyarısı iptal edildi.*`)
          .setTimestamp();
        await interaction.editReply({ embeds: [doneEmbed], components: [] }).catch(() => {});
      } else {
        // Defense rejected -> Warn applied
        hearing.status = 'accepted';
        await hearing.save();

        const { addDisciplinaryWarn } = require("../services/staffDutyService");
        await addDisciplinaryWarn(hearing.targetUserId, hearing.reason, hearing.issuedBy);

        try {
          const targetUser = await interaction.client.users.fetch(hearing.targetUserId).catch(() => null);
          if (targetUser) {
            const failEmbed = new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle("🔨 Disiplin Soruşturması Sonucu: RED")
              .setDescription(`Savunmanız kurul tarafından yetersiz bulunmuş ve disiplin uyarısı sicilinize **işlenmiştir** (-10 KPI).\n\n📝 **Gerekçe:** ${hearing.reason}`)
              .setTimestamp();
            await targetUser.send({ embeds: [failEmbed] }).catch(() => {});
          }
        } catch (_) {}

        const doneEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🔨 Savunma Reddedildi ve Ceza Kesildi")
          .setDescription(`**Değerlendiren Koordinatör:** <@${interaction.user.id}>\n*Savunma reddedildi ve disiplin uyarısı sicile işlendi.*`)
          .setTimestamp();
        await interaction.editReply({ embeds: [doneEmbed], components: [] }).catch(() => {});
      }
    } catch (err) {
      console.error('[Hearing-Coord] Hata:', err.message);
    }
    return;
  }

  if (customId.startsWith("signoff_1st_") || customId.startsWith("signoff_2nd_") || customId.startsWith("signoff_veto_")) {
    const StaffProgress = require("../../models/StaffProgress");
    const SignOffRequest = require("../../models/SignOffRequest");

    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isLevel4 = (managerProgress && managerProgress.level >= 6) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isLevel5 = (managerProgress && managerProgress.level >= 5) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (customId.startsWith("signoff_1st_")) {
      if (!isLevel4) return interaction.reply({ content: "❌ 1. Derece İmza yetkisi için **En Yüksek Rütbe** (Level 6) olmalısınız!", ephemeral: true });
    } else {
      if (!isLevel5) return interaction.reply({ content: "❌ Bu işlem için **Genel Koordinatör** (Level >= 5) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});

    const is1st = customId.startsWith("signoff_1st_");
    const is2nd = customId.startsWith("signoff_2nd_");
    const isVeto = customId.startsWith("signoff_veto_");
    
    let requestId = "";
    if (is1st) requestId = customId.replace("signoff_1st_", "");
    else if (is2nd) requestId = customId.replace("signoff_2nd_", "");
    else requestId = customId.replace("signoff_veto_", "");

    try {
      const request = await SignOffRequest.findOne({ requestId });
      if (!request || request.status !== "pending") {
        return interaction.followUp({ content: "❌ Evrak bulunamadı veya zaten sonuçlandırıldı.", ephemeral: true }).catch(() => {});
      }

      if (isVeto) {
        request.vetoed = true;
        request.status = "rejected";
        await request.save();

        const vetoEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xe74c3c)
          .setTitle(`❌ Evrak Veto Edildi - #${requestId}`)
          .setDescription(`Evrak **${interaction.user.tag}** tarafından veto edilerek iptal edilmiştir.`)
          .setTimestamp();
        return interaction.editReply({ embeds: [vetoEmbed], components: [] }).catch(() => {});
      }

      const sigLabel = is1st ? `1st:${interaction.user.tag}` : `2nd:${interaction.user.tag}`;
      const shortLabel = is1st ? "1. Derece (Sekreter)" : "2. Derece (G. Koordinatör)";

      // Check if signature type already exists
      const prefix = is1st ? "1st:" : "2nd:";
      if (request.signatures.some(s => s.startsWith(prefix))) {
        return interaction.followUp({ content: `❌ Bu evrakta zaten ${shortLabel} imzası mevcuttur!`, ephemeral: true }).catch(() => {});
      }

      request.signatures.push(sigLabel);
      await request.save();

      const has1st = request.signatures.some(s => s.startsWith("1st:"));
      const has2nd = request.signatures.some(s => s.startsWith("2nd:"));

      if (has1st && has2nd) {
        // Execute Action!
        request.status = "approved";
        await request.save();

        // Perform the high-risk action
        if (request.actionType === "BAN_REMOVE") {
          // Details: { targetUserId, reason }
          const target = request.details?.targetUserId;
          if (target) {
            await interaction.guild.members.unban(target, `Evrak #${requestId} - ${request.reason}`).catch(() => {});
          }
        } else if (request.actionType === "BUDGET_SPEND") {
          // Details: { amount, unitName, reason }
          const UnitBudget = require("../../models/UnitBudget");
          const raw = (request.details?.unitName || '').toString().trim();
          const normalized = raw.toUpperCase().includes('_BIRIMI') ? raw.toUpperCase() : `${raw.toUpperCase()}_BIRIMI`;
          const ub = await UnitBudget.findOne({ unitName: normalized });
          if (ub) {
            ub.budget = Math.max(0, ub.budget - (request.details?.amount || 0));
            await ub.save();
          }
        }

        const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x2ecc71)
          .setTitle(`✅ Evrak Tamamen İmzalandı ve Onaylandı - #${requestId}`)
          .setDescription('Gerekli tüm imzalar tamamlandı. Eylem başarıyla gerçekleştirilmiştir.')
          .addFields({ name: '✍️ İmza Sahipleri', value: request.signatures.map(s => `• ${s}`).join('\n'), inline: false })
          .setTimestamp();

        return interaction.editReply({ embeds: [approvedEmbed], components: [] }).catch(() => {});
      } else {
        // Just update embed signatures list
        const progressEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(`Evrak askıdadır. İmza beklemektedir.`)
          .setFields(
            { name: '📄 Evrak Tipi', value: `\`${request.actionType}\``, inline: true },
            { name: '⚖️ Detaylar', value: `\`\`\`json\n${JSON.stringify(request.details, null, 2)}\n\`\`\``, inline: false },
            { name: '✍️ İmzalar', value: request.signatures.map(s => `• ${s.replace("1st:", "Sekreter: ").replace("2nd:", "G. Koordinatör: ")}`).join('\n'), inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [progressEmbed] }).catch(() => {});
      }
    } catch (err) {
      console.error('[Sign-Off-Button] Hata:', err.message);
    }
    return;
  }

  if (customId.startsWith("audit_committee_1_") || customId.startsWith("audit_committee_2_")) {
    const StaffProgress = require("../../models/StaffProgress");
    const AuditCase = require("../../models/AuditCase");

    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isLevel3 = (managerProgress && managerProgress.level >= 3) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isLevel3) {
      return interaction.reply({ content: "❌ Performans İnceleme Kurulu onay yetkisi için **Yönetici** (Level >= 3) olmalısınız!", ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});

    const is1 = customId.startsWith("audit_committee_1_");
    const caseId = customId.replace(is1 ? "audit_committee_1_" : "audit_committee_2_", "");

    try {
      const audit = await AuditCase.findOne({ caseId });
      if (!audit || audit.status !== "pending") {
        return interaction.followUp({ content: "❌ Soruşturma bulunamadı veya zaten sonuçlandırıldı.", ephemeral: true }).catch(() => {});
      }

      if (interaction.user.id === audit.issuedBy) {
        return interaction.followUp({ content: "❌ Kendi oluşturduğunuz ceza talebini onaylayamazsınız!", ephemeral: true }).catch(() => {});
      }

      if (audit.approvals.includes(interaction.user.id)) {
        return interaction.followUp({ content: "❌ Bu davayı zaten onayladınız!", ephemeral: true }).catch(() => {});
      }

      audit.approvals.push(interaction.user.id);
      await audit.save();

      if (audit.approvals.length >= 2) {
        audit.status = "approved";
        await audit.save();

        if (audit.actionType === "WARN") {
          // Trigger DisciplinaryHearing
          const DisciplinaryHearing = require("../../models/DisciplinaryHearing");
          const hearingId = `hearing_${Date.now()}`;
          const hearing = new DisciplinaryHearing({
            hearingId,
            targetUserId: audit.targetUserId,
            reason: audit.reason,
            issuedBy: audit.issuedBy
          });
          await hearing.save();

          try {
            const targetUser = await interaction.client.users.fetch(audit.targetUserId).catch(() => null);
            if (targetUser) {
              const okEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("⚖️ Hakkınızda Disiplin Soruşturması Başlatıldı")
                .setDescription(
                  `Sayın <@${audit.targetUserId}>,\n\n` +
                  `Hakkınızdaki disiplin uyarısı talebi Performans İnceleme Kurulu (Kurul) tarafından onaylanmıştır.\n\n` +
                  `📝 **Suçlama / Gerekçe:** \`\`\`${audit.reason}\`\`\`\n` +
                  `Bu uyarıya karşı savunma yapmak için aşağıdaki **[⚖️ Savunma Ver (Modal)]** butonuna tıklayabilir ya da **[🤝 Cezayı Kabul Et (-10 KPI)]** butonuyla doğrudan cezayı onaylayabilirsiniz.\n\n` +
                  `*Savunma yapılmadığı veya reddedildiği takdirde ceza sicilinize işlenecektir.*`
                )
                .setFooter({ text: "Eko Yıldız • Disiplin ve Sicil Kurulu" })
                .setTimestamp();

              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`hearing_defense_btn_${hearingId}`)
                  .setLabel('⚖️ Savunma Ver (Modal)')
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId(`hearing_accept_btn_${hearingId}`)
                  .setLabel('🤝 Cezayı Kabul Et (-10 KPI)')
                  .setStyle(ButtonStyle.Danger)
              );
              await targetUser.send({ embeds: [okEmbed], components: [row] });
            }
          } catch (_) {}
        } else if (audit.actionType === "DISMISS") {
          // Execute dismissal
          const { dismissStaff } = require("../services/staffSystem");
          await dismissStaff(audit.targetUserId, audit.reason, audit.issuedBy, interaction.client);
        }

        const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x2ecc71)
          .setTitle(`✅ Karar Çapraz Onay ile Onaylandı - #${caseId}`)
          .setDescription('Gerekli tüm onaylar toplandı. İşlem resmi olarak yürürlüğe girdi.')
          .addFields({ name: '👥 Onaylayanlar', value: audit.approvals.map(a => `<@${a}>`).join('\n'), inline: false })
          .setTimestamp();

        return interaction.editReply({ embeds: [approvedEmbed], components: [] }).catch(() => {});
      } else {
        const progressEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setDescription(`Karar askıdadır. 2. Onay bekleniyor.`)
          .setFields(
            { name: '👤 Hedef Yetkili', value: `<@${audit.targetUserId}>`, inline: true },
            { name: '📝 Gerekçe', value: `\`\`\`${audit.reason}\`\`\``, inline: false },
            { name: '👥 Onaylayanlar', value: audit.approvals.map(a => `<@${a}>`).join('\n'), inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [progressEmbed] }).catch(() => {});
      }
    } catch (err) {
      console.error('[Audit-Committee-Button] Hata:', err.message);
    }
    return;
  }

  if (customId === "probation_rules_read" || customId === "contract_read_rules") {
    const isProb = customId === "probation_rules_read";
    const text = isProb
      ? "📝 **İK Gelişim Sözleşmesi (PIP) Şartları:**\n\n" +
        "1. 7 gün boyunca gerçekleştirdiğiniz tüm moderasyon işlemleri ve biletler denetime düşer.\n" +
        "2. Bu süre zarfında aldığınız uyarılar PIP başarısızlığına yol açar.\n" +
        "3. Lütfen kontratı imzalayarak görev bilinciyle hedefleri yerine getirin."
      : "📝 **Kurumsal Yemin ve Sözleşme Şartları:**\n\n" +
        "1. Sentara sunucu düzenini, adaletini ve gizliliğini koruyacağıma yemin ederim.\n" +
        "2. Üst yönetim direktiflerine ve kurallara riayet edeceğimi taahhüt ederim.\n" +
        "3. Görev sürem boyunca adil, aktif ve dürüst bir duruş sergileyeceğimi kabul ederim.";

    return interaction.reply({ content: text, ephemeral: true });
  }

  if (customId === "probation_sign_btn" || customId === "contract_renew_btn_trigger") {
    const isProb = customId === "probation_sign_btn";
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(isProb ? 'modal_probation_sign' : 'modal_contract_renew')
      .setTitle(isProb ? '✍️ PIP Kontratı İmza Masası' : '✍️ Sözleşme Onay Masası');

    const input = new TextInputBuilder()
      .setCustomId(isProb ? 'prob_sign_input' : 'contract_sign_input')
      .setLabel(isProb ? 'PIP Sözleşmesi Onaylama Metni' : 'Sözleşme Onaylama Metni')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(isProb ? "kabul ediyorum" : "KABUL EDİYORUM")
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  if (customId === "contract_final_sign") {
    await interaction.deferUpdate().catch(() => {});
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return;

      p.contractSigned = true;
      p.contractAccepted = true;
      p.contractRenewDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await p.save();

      const doneEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ Sözleşme Başarıyla Yenilendi!")
        .setDescription("Yıllık/Aylık kurumsal sözleşmeniz başarıyla yenilenmiştir. Panel yetkileriniz aktif edilmiştir.")
        .setTimestamp();

      await interaction.editReply({ embeds: [doneEmbed], components: [] }).catch(() => {});
    } catch (err) {
      console.error('[Contract-Final-Sign] Hata:', err.message);
    }
    return;
  }

  if (customId.startsWith("probation_approve_") || customId.startsWith("probation_reject_")) {
    const StaffProgress = require("../../models/StaffProgress");
    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isLevel4 = (managerProgress && managerProgress.level >= 6) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isLevel4) {
      return interaction.reply({ content: "❌ İK denetim onayları için **En Yüksek Rütbe** (Level 6) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});

    const isApprove = customId.startsWith("probation_approve_");
    const parts = customId.replace(isApprove ? "probation_approve_" : "probation_reject_", "").split("_");
    const targetUserId = parts[0];
    const actionType = parts[1];

    try {
      if (isApprove) {
        const p = await StaffProgress.findOne({ userId: targetUserId });
        if (p) {
          if (actionType === "mod") {
            p.stats.moderationActions = (p.stats.moderationActions || 0) + 1;
            p.daily.moderationActionsToday = (p.daily.moderationActionsToday || 0) + 1;
            p.weeklyStats.moderationActions = (p.weeklyStats.moderationActions || 0) + 1;
          } else if (actionType === "ticket") {
            p.stats.ticketsSolved = (p.stats.ticketsSolved || 0) + 1;
            p.daily.ticketsSolvedToday = (p.daily.ticketsSolvedToday || 0) + 1;
            p.weeklyStats.ticketsSolved = (p.weeklyStats.ticketsSolved || 0) + 1;
          }
          await p.save();
        }

        const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x2ecc71)
          .setTitle("✅ İK Denetim İşlemi Onaylandı")
          .setDescription(`**Onaylayan Yönetici:** <@${interaction.user.id}>\n*Yetkili işlem istatistikleri başarıyla yansıtıldı.*`)
          .setTimestamp();

        await interaction.editReply({ embeds: [approvedEmbed], components: [] }).catch(() => {});
      } else {
        const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xe74c3c)
          .setTitle("❌ İK Denetim İşlemi Reddedildi")
          .setDescription(`**Reddeden Yönetici:** <@${interaction.user.id}>\n*İşlem iptal edildi, performansa eklenmedi.*`)
          .setTimestamp();

        await interaction.editReply({ embeds: [rejectedEmbed], components: [] }).catch(() => {});
      }
    } catch (err) {
      console.error('[Probation-Approve] Hata:', err.message);
    }
    return;
  }

  if (customId === "career_rotation_panel_trigger") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const rotationEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("👔 Personel Kariyer Rotasyon Masası")
        .setDescription(
          "Tebrikler, mevcut seviye terfi gereksinimlerini başarıyla tamamladınız!\n\n" +
          "Sıkılıp tükenmenizi engellemek ve kurumsal tecrübenizi genişletmek adına istediğiniz yeni uzmanlık birimine rotasyon (transfer) başvurusu yapabilirsiniz. Seçtiğiniz seçeneğe göre tüm hedefleriniz yeniden yapılandırılacaktır."
        )
        .setTimestamp();

      const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('career_rotate_BAN').setLabel('🛡️ Güvenlik/Ban Birimi').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('career_rotate_SES').setLabel('🎤 Sosyal/Ses Birimi').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('career_rotate_SOHBET').setLabel('💼 İdari/Sohbet Birimi').setStyle(ButtonStyle.Primary)
      );

      await interaction.editReply({ embeds: [rotationEmbed], components: [row] }).catch(() => {});
    } catch (err) {
      console.error('[Career-Rotate-Trigger] Hata:', err.message);
    }
    return;
  }

  if (customId.startsWith("career_rotate_")) {
    await interaction.deferReply({ ephemeral: true });
    const targetUnit = customId.replace("career_rotate_", "") + "_BIRIMI";
    try {
      const StaffUnit = require("../../models/StaffUnit");
      let userUnit = await StaffUnit.findOne({ userId: interaction.user.id });
      if (!userUnit) {
        userUnit = new StaffUnit({ userId: interaction.user.id });
      }

      userUnit.unitName = targetUnit;
      userUnit.rank = 1;
      await userUnit.save();

      // Log promotion/rotation in TERFI_LOG
      const { CHANNELS } = require("../services/staffAutomation");
      const logChan = await interaction.client.channels.fetch(CHANNELS.TERFI_LOG).catch(() => null);
      if (logChan && logChan.isTextBased()) {
        const rotEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle("👔 Yetkili Kariyer Rotasyonu Gerçekleşti")
          .setDescription(`👤 <@${interaction.user.id}> yetkilisi kendi isteğiyle uzmanlık birimini değiştirmiştir.`)
          .addFields(
            { name: '👤 Personel', value: `<@${interaction.user.id}>`, inline: true },
            { name: '👔 Yeni Uzmanlık Birimi', value: `\`${targetUnit}\``, inline: true }
          )
          .setTimestamp();
        await logChan.send({ embeds: [rotEmbed] });
      }

      return interaction.editReply({ content: `✅ **Rotasyon başarıyla tamamlandı!** Yeni biriminiz: **${targetUnit}** olarak ayarlandı.` });
    } catch (err) {
      console.error('[Career-Rotate] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "duty_fiscal_audit_view") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p || !p.duty?.isActive || !p.duty.startedAt) {
        return interaction.editReply({ content: "❌ Aktif bir nöbetiniz bulunmuyor." });
      }

      const durationMs = Date.now() - new Date(p.duty.startedAt).getTime();
      const durationMins = Math.floor(durationMs / 1000 / 60);
      const durationHours = Math.floor(durationMins / 60);
      const remainingMins = durationMins % 60;

      const voiceMins = p.duty.sessionVoiceMinutes || 0;
      const tickets = p.duty.sessionTicketsSolved || 0;
      const mods = p.duty.sessionModerationActions || 0;

      const ServerConfig = require("../../models/ServerConfig");
      const sConf = await ServerConfig.findOne({ guildId: p.guildId || interaction.guildId });
      const isOhal = sConf && sConf.isOhalActive;
      const multiplier = isOhal ? 2.5 : 0.7;

      const xpReward = Math.floor(((durationHours * 5) + (tickets * 10) + (mods * 5) + (voiceMins * 1)) * multiplier);
      const coinRewardRaw = Math.floor(((durationHours * 2) + (tickets * 5) + (mods * 2)) * multiplier);
      const taxDeduction = Math.floor(coinRewardRaw * 0.10);
      const coinReward = Math.max(0, coinRewardRaw - taxDeduction);

      const auditEmbed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('📊 Vardiya Sonu Hasılat Bilançosu')
        .setDescription(
          `Nöbet süresince elde ettiğiniz kazanımlar ve vergi kesintileri aşağıda listelenmiştir. Lütfen inceleyip hak edişinizi transfer edin.\n\n` +
          `**💰 DETAYLAR (Sürüm: v0.7)**\n` +
          `• **Nöbet Süresi:** \`${durationHours} saat ${remainingMins} dakika\`\n` +
          `• **Çözülen Biletler:** \`${tickets} adet\` (+${tickets * 5 * multiplier} TL)\n` +
          `• **Moderasyon Eylemleri:** \`${mods} adet\` (+${mods * 2 * multiplier} TL)\n` +
          `• **Nöbet Baz Ücreti:** \`+${durationHours * 2 * multiplier} TL\`\n` +
          `• **Ödül Çarpanı:** \`${multiplier}x\` ${isOhal ? '(🔥 OHAL Kriz Primi Etkin)' : '(v0.7 Denge)'}\n` +
          `• **Vergi Kesintisi (%10):** \`-${taxDeduction} TL\`\n` +
          `-----------------------------------------\n` +
          `🔥 **Net Kazanılacak Tutar:** **+${coinReward} TL**\n` +
          `✨ **Kazanılacak Rütbe Puanı:** **+${xpReward} Elmas (💎)**`
        )
        .setTimestamp();

      const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('duty_fiscal_transfer')
          .setLabel('💰 Hak Edişi Maaş Hesabına Aktar')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.editReply({ embeds: [auditEmbed], components: [row] });
    } catch (err) {
      console.error('[Duty-Fiscal-Audit-View] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "duty_fiscal_transfer") {
    await interaction.deferUpdate().catch(() => {});
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p || !p.duty?.isActive) {
        return interaction.followUp({ content: "❌ Aktif nöbetiniz bulunamadı.", ephemeral: true }).catch(() => {});
      }

      const { endDuty } = require("../services/staffDutyService");
      await endDuty(interaction, interaction.client, p.duty.pendingHandoverNotes);
    } catch (err) {
      console.error('[Duty-Fiscal-Transfer] Hata:', err.message);
    }
    return;
  }

  if (customId === "staff_auction_open") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { createAuctionState, getAuctionStatus } = require('../services/staffFinanceSystem');
      const state = createAuctionState({});
      const status = getAuctionStatus(state);
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor(0x8e44ad)
        .setTitle('💸 Haftalık Personel İhalesi')
        .setDescription(`Aşağıdaki prestijli varlık için teklif verin. En yüksek teklifi veren ödülü kapar.`)
        .addFields(
          { name: '🎁 İhale Kalemi', value: status.itemLabel, inline: false },
          { name: '💰 Mevcut Teklif', value: `\`${status.highestOffer} TL\``, inline: true },
          { name: '⏳ Bitiş', value: `<t:${Math.floor(new Date(status.endsAt).getTime() / 1000)}:R>`, inline: true }
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('staff_auction_bid').setLabel('💸 Teklifi 500 TL Arttır').setStyle(ButtonStyle.Success)
      );
      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "staff_auction_bid") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require('../../models/StaffProgress');
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: '❌ Kayıt bulunamadı.' });
      const wallet = p.gamification?.ecoCoins || 0;
      if (wallet < 500) return interaction.editReply({ content: '❌ En az 500 TL cüzdan bakiyeniz olmalıdır.' });
      p.gamification.ecoCoins = wallet - 500;
      p.savingsFund = (p.savingsFund || 0) + 500;
      await p.save();
      return interaction.editReply({ content: '✅ **Teklifiniz alındı.** 500 TL ihale havuzuna aktarılmıştır.' });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "sponsorship_transfer") {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId('modal_sponsorship_transfer').setTitle('🏢 Birim Kasasına TL Aktar');
    const amount = new TextInputBuilder().setCustomId('sponsorship_amount').setLabel('Aktarılacak TL').setStyle(TextInputStyle.Short).setRequired(true);
    const unit = new TextInputBuilder().setCustomId('sponsorship_unit').setLabel('Birim Adı (BAN_BIRIMI / SES_BIRIMI / SOHBET_BIRIMI)').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(amount), new ActionRowBuilder().addComponents(unit));
    return interaction.showModal(modal).catch(() => {});
  }

  if (customId === "vip_purchase_theme") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require('../../models/StaffProgress');
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: '❌ Kayıt bulunamadı.' });
      if ((p.gamification?.ecoCoins || 0) < 7500) return interaction.editReply({ content: '❌ Yetersiz bakiye.' });
      p.gamification.ecoCoins -= 7500;
      p.marketState = `${p.marketState || 'Boğa Piyasası'} • VIP`;
      await p.save();
      return interaction.editReply({ content: '✅ **Altın Profil Teması** satın alındı.' });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "vip_purchase_badge") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require('../../models/StaffProgress');
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: '❌ Kayıt bulunamadı.' });
      if ((p.gamification?.ecoCoins || 0) < 5000) return interaction.editReply({ content: '❌ Yetersiz bakiye.' });
      p.gamification.ecoCoins -= 5000;
      p.marketTrend = `${p.marketTrend || '▃ ▅ █ █ ▄'} 🏅`;
      await p.save();
      return interaction.editReply({ content: '✅ **Lüks Rozet** satın alındı.' });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "finance_invest_trigger") {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_finance_invest')
      .setTitle('📈 Yatırım Fonuna TL Yatır');

    const input = new TextInputBuilder()
      .setCustomId('invest_amount')
      .setLabel('Yatırılacak TL Tutarı')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: 50')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  if (customId === "finance_buy_leave") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: "❌ Kayıt bulunamadı." });

      const cost = 100;
      const wallet = p.gamification?.ecoCoins || 0;
      if (wallet < cost) {
        return interaction.editReply({ content: `❌ Yetersiz bakiye! İzin kredisi satın almak için cüzdanınızda en az \`${cost} TL\` bulunmalıdır.` });
      }

      p.gamification.ecoCoins -= cost;
      p.leaves = p.leaves || { totalCredits: 0 };
      p.leaves.totalCredits = (p.leaves.totalCredits || 0) + 1;
      await p.save();

      return interaction.editReply({ content: `✅ **İzin kredisi satın alındı!** \`100 TL\` cüzdanınızdan düşüldü.\n🍃 **Yeni İzin Kredisi Bakiyeniz:** \`${p.leaves.totalCredits} Gün\`` });
    } catch (err) {
      console.error('[Finance-Buy-Leave] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "finance_loan_request") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: "❌ Kayıt bulunamadı." });

      const kpi = p.performance?.weeklyKpi || 100;
      if (kpi < 90) {
        return interaction.editReply({ content: `❌ Maaş avansı çekebilmek için haftalık performans puanınızın (KPI) en az **90** olması gerekmektedir. Güncel KPI: \`${kpi}\`` });
      }

      if (p.loanAmount && p.loanAmount > 0) {
        return interaction.editReply({ content: `❌ Zaten aktif bir avans borcunuz bulunmaktadır: \`${p.loanAmount} TL\`.` });
      }

      p.loanAmount = 150;
      p.gamification = p.gamification || {};
      p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + 150;
      await p.save();

      return interaction.editReply({ content: "✅ **Faizsiz Maaş Avansı Onaylandı!**\n\n`150 TL` başarıyla cüzdanınıza aktarılmıştır. Bu tutar, bir sonraki haftalık maaş tahakkukunda otomatik olarak net maaşınızdan mahsup edilecektir." });
    } catch (err) {
      console.error('[Finance-Loan] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "staff_lounge_coinflip") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { resolveLoungeGame } = require('../services/staffFinanceSystem');
      const StaffProgress = require('../../models/StaffProgress');
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: '❌ Kayıt bulunamadı.' });
      if ((p.gamification?.ecoCoins || 0) < 500) return interaction.editReply({ content: '❌ Yetersiz bakiye.' });
      const result = resolveLoungeGame('coinflip', 500);
      p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) - 500 + result.payout;
      await p.save();
      return interaction.editReply({ content: result.outcome === 'win' ? '✅ **Kazandınız!** 500 TL yatırımı ile 1,000 TL geri aldınız.' : '❌ **Kaybettiniz.** 500 TL vergi fonuna aktarıldı.' });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "staff_lounge_highrisk") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { resolveLoungeGame } = require('../services/staffFinanceSystem');
      const StaffProgress = require('../../models/StaffProgress');
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: '❌ Kayıt bulunamadı.' });
      if ((p.gamification?.ecoCoins || 0) < 1000) return interaction.editReply({ content: '❌ Yetersiz bakiye.' });
      const result = resolveLoungeGame('highrisk', 1000);
      p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) - 1000 + result.payout;
      await p.save();
      return interaction.editReply({ content: result.outcome === 'win' ? '✅ **Yüksek risk!** 3,000 TL kazandınız.' : '❌ **Kaybettiniz.** 1,000 TL kriz fonuna aktarıldı.' });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "malpractice_buy_insurance") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: "❌ Kayıt bulunamadı." });

      const cost = 100;
      const wallet = p.gamification?.ecoCoins || 0;
      if (wallet < cost) {
        return interaction.editReply({ content: `❌ Yetersiz bakiye! Sigorta aktif etmek için cüzdanınızda en az \`${cost} TL\` bulunmalıdır.` });
      }

      p.gamification.ecoCoins -= cost;
      p.insuranceActive = true;
      await p.save();

      return interaction.editReply({ content: "🛡️ **Mesleki Sorumluluk Sigortanız Aktif Edildi!**\n\n`100 TL` cüzdanınızdan tahsil edilmiştir. Gelecekteki mahkeme davalarının tazminatları sigorta fonu tarafından karşılanacaktır." });
    } catch (err) {
      console.error('[Malpractice-Insurance-Buy] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId.startsWith("malpractice_defense_btn_")) {
    const caseId = customId.replace("malpractice_defense_btn_", "");
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`modal_malpractice_defense_${caseId}`)
      .setTitle('⚖️ Avukat Savunma Dilekçesi');

    const input = new TextInputBuilder()
      .setCustomId('defense_dilekce')
      .setLabel('Savunma / İtiraz Gerekçeniz')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Buraya mahkemeye sunulacak hukuki savunmanızı yazınız.')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  if (customId.startsWith("malpractice_settle_btn_")) {
    await interaction.deferReply({ ephemeral: true });
    const caseId = customId.replace("malpractice_settle_btn_", "");
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const MalpracticeCase = require("../../models/MalpracticeCase");

      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      const c = await MalpracticeCase.findOne({ caseId });
      if (!p || !c || c.status !== "pending") {
        return interaction.editReply({ content: "❌ Dava bulunamadı veya zaten karara bağlandı." });
      }

      const rawCost = c.fineAmount || 100;
      const settleCost = Math.floor(rawCost * 0.8); // %20 İndirim

      let finalPaid = 0;
      if (p.insuranceActive) {
        // Covered by insurance
        finalPaid = 0;
      } else {
        finalPaid = settleCost;
        p.gamification = p.gamification || {};
        p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) - finalPaid;
        await p.save();
      }

      c.status = "settled";
      c.settledAmount = finalPaid;
      await c.save();

      return interaction.editReply({
        content: `✅ **Uzlaşma (Settle) Başarıyla Tamamlandı!**\n\n` +
          `• **Dava:** \`#${caseId}\`\n` +
          `• **Normal Ceza:** \`${rawCost} TL\`\n` +
          `• **Uzlaşma Bedeli (%20 İndirimli):** \`${settleCost} TL\`\n` +
          `• **Cebinizden Ödenen:** \`${finalPaid} TL\` ${p.insuranceActive ? '(🛡️ Sigortanız Tarafından Karşılandı!)' : '(Sigortasız Tahsilat)'}`
      });
    } catch (err) {
      console.error('[Malpractice-Settle] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId.startsWith("malpractice_court_won_") || customId.startsWith("malpractice_court_lost_")) {
    // Fetch case and allow AI fallback if no higher-ranked reviewer exists
    await interaction.deferUpdate().catch(() => {});
    const isWon = customId.startsWith("malpractice_court_won_");
    const caseId = customId.replace(isWon ? "malpractice_court_won_" : "malpractice_court_lost_", "");

    try {
      const MalpracticeCase = require("../../models/MalpracticeCase");
      const c = await MalpracticeCase.findOne({ caseId });
      if (!c || c.status !== "submitted") {
        return interaction.followUp({ content: "❌ Dava dosyası bulunamadı veya zaten karara bağlandı.", ephemeral: true }).catch(() => {});
      }

      const p = await StaffProgress.findOne({ userId: c.targetUserId });
      if (!p) return;

      // Check if current actor has sufficient level
      const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
      const isLevel4 = (managerProgress && managerProgress.level >= 6) || (interaction.member && interaction.member.permissions.has(PermissionFlagsBits.Administrator));

      if (!isLevel4) {
        // Check if any higher-ranked person exists than target's level
        const higherExists = await StaffProgress.exists({ level: { $gt: (p.level || 1) } });
        if (higherExists) {
          return interaction.reply({ content: "❌ Mahkeme kararlarını nihai sonuca bağlamak için hedef kişiden daha üstün rütbeye sahip bir yöneticinin onayı gerekir.", ephemeral: true });
        }

        // No higher-ranked person exists: use AI to decide
        try {
          const { chatWithAI } = require('../services/staffSystem');
          const prompt = `Eko Yıldız mahkeme sistemi için bağımsız bir hakem AI'sın. Verilen dava metnini değerlendir ve tek kelimeyle karar ver: GUILTY veya INNOCENT. Ayrıca kısa bir gerekçe ve önerilen para cezası (TL) ver.\n\nDAVANIN GEREKÇESİ: ${c.reason}\nSIGORTA AKTIF MI: ${p.insuranceActive ? 'EVET' : 'HAYIR'}`;
          const aiText = await chatWithAI([{ role: 'user', content: prompt }], null, 'ticket').catch(() => 'INNOCENT\nGerekçe: Yetersiz kanıt\nFine: 0');
          // Parse simple AI response
          const verdict = /GUILTY/i.test(aiText) ? 'lost' : 'won';
          const fineMatch = aiText.match(/Fine:\s*(\d+)/i);
          const fineAmount = fineMatch ? parseInt(fineMatch[1], 10) : (verdict === 'lost' ? (c.fineAmount || 100) : 0);

          if (verdict === 'won') {
            c.status = 'won';
            c.settledAmount = 0;
            await c.save();
            const wonEmbed = EmbedBuilder.from(interaction.message.embeds[0])
              .setColor(0x2ecc71)
              .setTitle(`✅ Mahkeme Kararı (AI Hakem): Davalı Suçsuz Bulundu - #${caseId}`)
              .setDescription(`AI hakem kararı: Davalı yetkili <@${c.targetUserId}> suçsuz bulundu.\n\n**Gerekçe:** ${aiText}`)
              .setTimestamp();
            await interaction.editReply({ embeds: [wonEmbed], components: [] }).catch(() => {});
          } else {
            c.status = 'lost';
            const fine = fineAmount || (c.fineAmount || 100);
            let finalPaid = 0;
            if (p.insuranceActive) {
              finalPaid = 0;
            } else {
              finalPaid = fine;
              p.gamification = p.gamification || {};
              p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) - finalPaid;
              await p.save();
            }

            c.settledAmount = finalPaid;
            await c.save();

            const lostEmbed = EmbedBuilder.from(interaction.message.embeds[0])
              .setColor(0xe74c3c)
              .setTitle(`❌ Mahkeme Kararı (AI Hakem): Davalı Suçlu Bulundu - #${caseId}`)
              .setDescription(
                `AI hakem kararı: Davalı yetkili <@${c.targetUserId}> suçlu bulundu.\n\n` +
                `• **Kesilen Ceza:** \`${fine}\` TL\n` +
                `• **Cebinden Tahsil Edilen:** \`${finalPaid} TL\` ${p.insuranceActive ? '(🛡️ Sigortalı: Sigorta fonundan karşılandı)' : '(Sigortasız: Yetkili cüzdanından düşüldü)'}\n\n` +
                `**Gerekçe:** ${aiText}`
              )
              .setTimestamp();

            await interaction.editReply({ embeds: [lostEmbed], components: [] }).catch(() => {});
          }
        } catch (aiErr) {
          console.error('[Malpractice-AI-Fallback] Hata:', aiErr.message);
          return interaction.followUp({ content: '❌ AI hakem kararı alınamadı. Lütfen bir yöneticiye başvurun.', ephemeral: true });
        }
        return;
      }

      // If executor is level4 or admin, apply manual decision
      if (isWon) {
        c.status = "won";
        c.settledAmount = 0;
        await c.save();

        const wonEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x2ecc71)
          .setTitle(`✅ Mahkeme Kararı: Davalı Suçsuz Bulundu - #${caseId}`)
          .setDescription(`Davalı yetkili <@${c.targetUserId}> tarafından yapılan savunma haklı bulunmuş ve dava tamamen düşürülmüştür.`)
          .setTimestamp();

        await interaction.editReply({ embeds: [wonEmbed], components: [] }).catch(() => {});
      } else {
        c.status = "lost";
        const fine = c.fineAmount || 100;
        
        let finalPaid = 0;
        if (p.insuranceActive) {
          finalPaid = 0;
        } else {
          finalPaid = fine;
          p.gamification = p.gamification || {};
          p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) - finalPaid;
          await p.save();
        }

        c.settledAmount = finalPaid;
        await c.save();

        const lostEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xe74c3c)
          .setTitle(`❌ Mahkeme Kararı: Davalı Suçlu Bulundu - #${caseId}`)
          .setDescription(
            `Davalı yetkili <@${c.targetUserId}> suçlu bulunmuş ve ceza onaylanmıştır.\n\n` +
            `• **Kesilen Ceza:** \`${fine} TL\`\n` +
            `• **Cebinden Tahsil Edilen:** \`${finalPaid} TL\` ` +
            (p.insuranceActive ? '(🛡️ Sigortalı: Sigorta fonundan karşılandı)' : '(Sigortasız: Yetkili cüzdanından düşüldü)')
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [lostEmbed], components: [] }).catch(() => {});
      }
    } catch (err) {
      console.error('[Mahkeme-Court-Judge] Hata:', err.message);
    }
    return;
  }

  if (customId === "risk_toggle_karantina" || customId === "risk_toggle_api_speed" || customId === "risk_toggle_ohal") {
    const StaffProgress = require("../../models/StaffProgress");
    const managerProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    const isLevel4 = (managerProgress && managerProgress.level >= 6) || (interaction.member && interaction.member.permissions.has(PermissionFlagsBits.Administrator));
    if (!isLevel4) {
      return interaction.reply({ content: "❌ Global risk kontrol yetkisi için **En Yüksek Rütbe** (Level 6) yetkisine sahip olmalısınız!", ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});

    try {
      const ServerConfig = require("../../models/ServerConfig");
      let sConf = await ServerConfig.findOne({ guildId: interaction.guildId });
      if (!sConf) {
        sConf = new ServerConfig({ guildId: interaction.guildId });
      }

      if (customId === "risk_toggle_karantina") {
        sConf.karantinaActive = !sConf.karantinaActive;
        global.SPAM_STOPPED = sConf.karantinaActive;
      } else if (customId === "risk_toggle_api_speed") {
        sConf.apiSpeedLimitActive = !sConf.apiSpeedLimitActive;
      } else if (customId === "risk_toggle_ohal") {
        sConf.isOhalActive = !sConf.isOhalActive;
      }
      await sConf.save();

      const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setDescription(
          `Sayın Yönetici,\n\n` +
          `Sunucu güvenliğini ve sistem stabilitesini sağlamak adına küresel risk mekanizmalarını buradan yönetebilirsiniz.\n\n` +
          `🚨 **Karantina Modu (Self-Shutdown):** ${sConf.karantinaActive ? '🔴 **AKTİF (Tüm komutlar kilitli)**' : '🟢 **DEAKTİF (Normal akış)**'}\n` +
          `⚡ **API Hız Limiti Yavaşlatıcı (%50):** ${sConf.apiSpeedLimitActive ? '🔴 **YAVAŞ (%50 Hız Sınırı)**' : '🟢 **NORMAL (Tam hız)**'}\n` +
          `🔥 **Olağanüstü Hal (OHAL) Vardiyası:** ${sConf.isOhalActive ? '🔴 **AKTİF (2.5x Kriz Primi)**' : '🟢 **DEAKTİF (Normal akış)**'}`
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('risk_toggle_karantina')
          .setLabel('🚨 Karantina (Self-Shutdown)')
          .setStyle(sConf.karantinaActive ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('risk_toggle_api_speed')
          .setLabel('⏳ API Limiti (%50)')
          .setStyle(sConf.apiSpeedLimitActive ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('risk_toggle_ohal')
          .setLabel('🔥 OHAL Kriz Vardiyası')
          .setStyle(sConf.isOhalActive ? ButtonStyle.Success : ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [newEmbed], components: [row] }).catch(() => {});
    } catch (err) {
      console.error('[Risk-Toggle] Hata:', err.message);
    }
    return;
  }

  if (customId.startsWith("redacted_decrypt_trigger_")) {
    const opId = customId.replace("redacted_decrypt_trigger_", "");
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`modal_redacted_decrypt_${opId}`)
      .setTitle('🕵️ Gizli Teşkilat Kod Çözücü');

    const input = new TextInputBuilder()
      .setCustomId('decrypt_passcode')
      .setLabel('Passcode Giriniz')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Görevi deşifre etmek için passcode girin')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  if (customId.startsWith("redacted_report_trigger_")) {
    const opId = customId.replace("redacted_report_trigger_", "");
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`modal_redacted_report_${opId}`)
      .setTitle('📋 Gizli İstihbarat Rapor Formu');

    const input = new TextInputBuilder()
      .setCustomId('intel_report_text')
      .setLabel('Toplanan İstihbarat Detayı')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Gözlemlerinizi ve raporunuzu buraya detaylıca yazın.')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  if (customId === "grid_request_sector") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: "❌ Kayıt bulunamadı." });

      if (!p.duty?.isActive) {
        return interaction.editReply({ content: "❌ Devriye görevi alabilmek için nöbette olmalısınız! Lütfen önce nöbete başlayın." });
      }

      const sectors = ["SEKTÖR-A (Genel Sohbet)", "SEKTÖR-B (Ses Kanalları)", "SEKTÖR-C (Destek Biletleri)"];
      const selected = sectors[Math.floor(Math.random() * sectors.length)];
      p.currentSector = selected;
      await p.save();

      return interaction.editReply({ content: `📡 **Yeni Sektör Devriyesi Atandı!**\n\nBölgeniz: **${selected}**\nLütfen bölgeye ulaştığınızda **[🛬 Sektöre Ulaştım]** butonuna tıklayınız.` });
    } catch (err) {
      console.error('[Grid-Request] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "grid_arrive_sector") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p || !p.currentSector) {
        return interaction.editReply({ content: "❌ Aktif atanmış bir sektörünüz bulunmamaktadır." });
      }

      // Simulate sending logs stream to DM
      try {
        const embed1 = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`🗺️ Canlı Sektör Log Akışı - ${p.currentSector}`)
          .setDescription(
            `Bölge güvenli hale getirilmiştir. Log tüneli kuruldu.\n\n` +
            `• \`[SYS-09:41]\` Bölge analiz ediliyor... Tam doğruluk sağlandı.\n` +
            `• \`[SYS-09:43]\` Herhangi bir kural ihlali saptanmadı.`
          )
          .setTimestamp();
        await interaction.user.send({ embeds: [embed1] });
      } catch (_) {}

      return interaction.editReply({ content: "🛬 **Sektöre Ulaştınız!**\n\nVarışınız veritabanına işlendi ve canlı log akışı tüneli DM kutunuza yönlendirildi." });
    } catch (err) {
      console.error('[Grid-Arrive] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "grid_clear_sector") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: "❌ Kayıt bulunamadı." });

      const oldSector = p.currentSector || "Sektör";
      p.currentSector = null;
      await p.save();

      return interaction.editReply({ content: `✅ **Devriye Tamamlandı!**\n\n**${oldSector}** güvenli ve temiz olarak rapor edilmiştir. Teşekkürler.` });
    } catch (err) {
      console.error('[Grid-Clear] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "ia_start_ghosting_scan") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const activeStaff = await StaffProgress.find({ "duty.isActive": true });

      const ghostUsers = activeStaff.filter(u => {
        const voice = u.duty.voiceMinutes || 0;
        const actions = (u.duty.ticketsResolved || 0) + (u.duty.modsCount || 0);
        // Ghosting is flagged if voice minutes are substantial but action count is zero
        return voice >= 10 && actions === 0;
      });

      if (ghostUsers.length === 0) {
        return interaction.editReply({ content: "🔍 **Tarama Tamamlandı:** Herhangi bir şüpheli (Ghosting) yetkili saptanmadı. Tüm nöbetteki personel aktif çalışıyor." });
      }

      const { CHANNELS } = require("../services/staffAutomation");
      const logChan = await interaction.client.channels.fetch(CHANNELS.TERFI_LOG).catch(() => null);
      
      if (logChan && logChan.isTextBased()) {
        const misconductEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("🚨 İç Denetim - Yetkili Suistimal & Ghosting Raporu")
          .setDescription(
            `Yapılan sızma taraması (ghosting scan) sonucunda seste olup sıfır faaliyet gösteren yetkililer tespit edilmiştir:\n\n` +
            ghostUsers.map(u => `• <@${u.userId}> - Seste: \`${u.duty.voiceMinutes}\` dk | Aksiyon: \`0\``).join('\n') +
            `\n\n*Yönetim bu personel hakkında disiplin incelemesi başlatabilir.*`
          )
          .setTimestamp();
        await logChan.send({ embeds: [misconductEmbed] });
      }

      return interaction.editReply({ content: `🔍 **Tarama Tamamlandı!**\n\nSes kanallarında bulunup aksiyon almayan **${ghostUsers.length}** yetkili hakkında suistimal (misconduct) raporu oluşturuldu ve yönetim günlüğüne iletildi.` });
    } catch (err) {
      console.error('[IA-Ghost-Scan] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (customId === "staff_accept_nightshift") {
    await interaction.deferUpdate().catch(() => { });
    const { recordOvertimeTask } = require("../services/staffSystem");
    const result = await recordOvertimeTask(interaction.user.id, 'night_shift', interaction.client);
    if (result.success) {
      await interaction.followUp({
        content: `⚡ **Gece Mesaisi Başlatıldı!** ${result.description} Ödül: ${result.reward}`,
        ephemeral: true
      }).catch(() => {});
    } else {
      await interaction.followUp({
        content: `❌ Gece mesaisi başlatılamadı: ${result.message}`,
        ephemeral: true
      }).catch(() => {});
    }
    return;
  }

  if (customId === "staff_decline_nightshift") {
    await interaction.deferUpdate().catch(() => { });
    await interaction.followUp({
      content: '✅ Bu gece dinlenme seçildi. Sabah tekrar göz atabilirsin.',
      ephemeral: true
    }).catch(() => {});
    return;
  }

  // ── Görev Başlat butonu ──────────────────────────────────────────────────
  if (customId === "staff_start_task_1") {
    await interaction.deferUpdate().catch(() => { });
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) return;

    p.daily = p.daily || {};
    p.daily.startedToday = true;
    await p.save().catch(() => { });

    const { generateMorningBriefingEmbed, getMorningBriefingComponents } = require("../services/staffSystem");
    const embed = await generateMorningBriefingEmbed(p, interaction.client);
    const components = await getMorningBriefingComponents(p);

    await interaction.editReply({ embeds: [embed], components }).catch(() => { });
    return;
  }

  // ── Şehir Tanımla butonu ───────────────────────────────────────────────────
  if (customId === "staff_prompt_city_modal") {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_staff_set_city')
      .setTitle('📍 Yaşadığınız Şehri Tanımlayın');

    const input = new TextInputBuilder()
      .setCustomId('user_city')
      .setLabel('Türkiye\'deki Yaşadığınız Şehir')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: İstanbul, Ankara, İzmir, Bursa, Trabzon, Van vb.')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  // ── AI Senaryo Cevaplama butonu ────────────────────────────────────────────
  if (customId.startsWith("staff_practice_solve_")) {
    const scenarioId = customId.split("_")[3];
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId(`modal_practice_submit_${scenarioId}`)
      .setTitle('🎓 Senaryo Çözümünüzü Yazın');

    const input = new TextInputBuilder()
      .setCustomId('practice_solution')
      .setLabel('Bu Durumda Uygulayacağınız Çözüm')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Örn: Önce uyarırım, devam ederse mute veririm.')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  // ── AI Asistanı butonu ──────────────────────────────────────────────────────
  if (customId === "staff_ai_assistant") {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_staff_ai_assistant')
      .setTitle('🤖 AI Moderasyon Asistanı');

    const input = new TextInputBuilder()
      .setCustomId('assistant_query')
      .setLabel('Karşılaştığınız Durum veya Soru')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Örn: Bir kullanıcı arka arkaya reklam linki paylaştı ve küfür etti. Hangi cezayı vermeliyim?')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  // ── Vaka Raporu butonu ─────────────────────────────────────────────────────
  if (customId === "staff_incident_report") {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_staff_incident_report')
      .setTitle('📝 Vaka Raporu Formu (Adli Tutanak)');

    const summaryInput = new TextInputBuilder()
      .setCustomId('incident_summary')
      .setLabel('Olay Özeti (Neler Yaşandı?)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Olay anında yaşanan ihlalleri detaylı olarak özetleyin.')
      .setRequired(true);

    const suspectsInput = new TextInputBuilder()
      .setCustomId('incident_suspects')
      .setLabel('Şüpheli ID\'leri (Virgülle Ayırın)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: 1031620522406072350, 1228088674206617621')
      .setRequired(true);

    const proofsInput = new TextInputBuilder()
      .setCustomId('incident_proofs')
      .setLabel('Kanıt Linkleri (Ekran Görüntüsü/Video)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Kanıt resim/video linklerini ekleyin.')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(summaryInput),
      new ActionRowBuilder().addComponents(suspectsInput),
      new ActionRowBuilder().addComponents(proofsInput)
    );
    return interaction.showModal(modal).catch(() => {});
  }

  // ── Günlük Rapor Gir butonu ────────────────────────────────────────────────
  if (customId === "staff_daily_report_btn") {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_staff_daily_report')
      .setTitle('✍️ Günlük Görev Raporu');

    const input = new TextInputBuilder()
      .setCustomId('report_content')
      .setLabel('Bugün Yaptığınız Çalışmalar')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Örn: Bilet çözdüm, nöbet tuttum ve görevleri tamamladım.')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
  }

  // ── Kahve Molası Başlat/Bitir butonu ───────────────────────────────────────
  if (customId === "staff_duty_break_start" || customId === "staff_duty_break_end") {
    await interaction.deferUpdate().catch(() => { });
    
    try {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return;

      const { GUILD2_ID } = require('../../config');
      const guild = await interaction.client.guilds.fetch(GUILD2_ID).catch(() => null);
      let logChan = null;
      if (guild) {
        logChan = guild.channels.cache.find(c => c.name === 'yetkili-rapor-log');
      }

      if (customId === "staff_duty_break_start") {
        p.duty.isBreakActive = true;
        p.duty.breakStartedAt = new Date();
        await p.save();

        if (logChan) {
          const embed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setDescription(`☕ **${interaction.user.tag}** (\`${interaction.user.id}\`) kahve molasına çıktı.`)
            .setTimestamp();
          await logChan.send({ embeds: [embed] }).catch(() => {});
        }
      } else {
        const breakStarted = p.duty.breakStartedAt ? new Date(p.duty.breakStartedAt).getTime() : Date.now();
        const breakMins = Math.floor((Date.now() - breakStarted) / 1000 / 60);

        p.duty.isBreakActive = false;
        p.duty.breakStartedAt = null;
        await p.save();

        if (logChan) {
          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setDescription(`🟢 **${interaction.user.tag}** (\`${interaction.user.id}\`) kahve molasından döndü. (Mola Süresi: \`${breakMins} dakika\`)`)
            .setTimestamp();
          await logChan.send({ embeds: [embed] }).catch(() => {});
        }
      }

      const { generateMorningBriefingEmbed, getMorningBriefingComponents } = require("../services/staffSystem");
      const embed = await generateMorningBriefingEmbed(p, interaction.client);
      const components = await getMorningBriefingComponents(p);

      await interaction.editReply({ embeds: [embed], components }).catch(() => { });
    } catch (err) {
      console.error('[Duty-Break] Hata:', err.message);
    }
    return;
  }

  // ── Görev İlerlemesini Güncelle butonu ────────────────────────────────────
  if (customId === "staff_update_progress") {
    await interaction.deferUpdate().catch(() => { });
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) return;

    if (!p.city) {
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
      const promptEmbed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle('📍 Şehir Tanımlama Gerekli')
        .setDescription(
          `Merhaba <@${interaction.user.id}>,\n\n` +
          `Personel sistemimizin zaman dilimlerini, günlük sıfırlama saatlerini ve AI Koçunuzun analizlerini Türkiye'deki konumunuza göre özelleştirebilmemiz için **yaşadığınız şehri** tek seferliğine belirtmeniz gerekmektedir.\n\n` +
          `Lütfen aşağıdaki **\`📍 Şehir Tanımla\`** butonuna tıklayarak yaşadığınız şehri (örn: İstanbul, Ankara, İzmir, Van vb.) giriniz.`
        )
        .setFooter({ text: 'Eko Yıldız • Akıllı Konum Entegrasyonu' })
        .setTimestamp();

      const promptRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('staff_prompt_city_modal')
          .setLabel('📍 Şehir Tanımla')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({ embeds: [promptEmbed], components: [promptRow] }).catch(() => { });
      return;
    }

    const { generateMorningBriefingEmbed, getMorningBriefingComponents } = require("../services/staffSystem");
    const embed = await generateMorningBriefingEmbed(p, interaction.client);
    const components = await getMorningBriefingComponents(p);

    await interaction.editReply({ embeds: [embed], components }).catch(() => { });
    return;
  }

  if (customId === "staff_inactivity_request") {
    const { handleInactivitySupportRequest } = require("../services/staffSystem");
    return handleInactivitySupportRequest(interaction, interaction.client);
  }

  if (customId === "staff_inactivity_proof") {
    const { handleInactivityProofButton } = require("../services/staffSystem");
    return handleInactivityProofButton(interaction, interaction.client);
  }

  if (customId === "staff_inactivity_wellbeing_yes" || customId === "staff_inactivity_wellbeing_no") {
    const { handleInactivityWellbeingButton } = require("../services/staffSystem");
    const response = customId === "staff_inactivity_wellbeing_yes" ? "yes" : "no";
    return handleInactivityWellbeingButton(interaction, interaction.client, response);
  }

  // ── Ayarlar Butonu ────────────────────────────────────────────────────────
  if (customId === "staff_settings") {
    await interaction.deferUpdate().catch(() => { });
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) return;

    const { generateSettingsEmbed, getSettingsComponents } = require("../services/staffSystem");
    const embed = generateSettingsEmbed(p);
    const components = getSettingsComponents(p);

    await interaction.editReply({ embeds: [embed], components }).catch(() => { });
    return;
  }

  // ── Sabah Brifingi Aç/Kapat Butonu ────────────────────────────────────────
  if (customId === "staff_toggle_briefing") {
    await interaction.deferUpdate().catch(() => { });
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) return;

    p.settings = p.settings || {};
    p.settings.dailyBriefingEnabled = p.settings.dailyBriefingEnabled !== false ? false : true;
    await p.save().catch(() => { });

    const { generateSettingsEmbed, getSettingsComponents } = require("../services/staffSystem");
    const embed = generateSettingsEmbed(p);
    const components = getSettingsComponents(p);

    await interaction.editReply({ embeds: [embed], components }).catch(() => { });
    return;
  }

  // ── Uyarı Bildirimleri Aç/Kapat Butonu ────────────────────────────────────
  if (customId === "staff_toggle_warnings") {
    await interaction.deferUpdate().catch(() => { });
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) return;

    p.settings = p.settings || {};
    p.settings.warningsEnabled = p.settings.warningsEnabled !== false ? false : true;
    await p.save().catch(() => { });

    const { generateSettingsEmbed, getSettingsComponents } = require("../services/staffSystem");
    const embed = generateSettingsEmbed(p);
    const components = getSettingsComponents(p);

    await interaction.editReply({ embeds: [embed], components }).catch(() => { });
    return;
  }

  // ── Ayarlar Geri Dön Butonu ────────────────────────────────────────────────
  if (customId === "staff_settings_back") {
    await interaction.deferUpdate().catch(() => { });
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) return;

    const { generateMorningBriefingEmbed, getMorningBriefingComponents } = require("../services/staffSystem");
    const embed = await generateMorningBriefingEmbed(p, interaction.client);
    const components = await getMorningBriefingComponents(p);

    await interaction.editReply({ embeds: [embed], components }).catch(() => { });
    return;
  }

  // ── Selamlaşma İlerlemesini Güncelle Butonu ───────────────────────────────
  if (customId === "staff_update_greet_progress") {
    await interaction.deferUpdate().catch(() => { });
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) return;

    const { generateGreetProgressEmbed, getGreetProgressComponents } = require("../services/staffSystem");
    const embed = generateGreetProgressEmbed(p);
    const components = getGreetProgressComponents();

    await interaction.editReply({ embeds: [embed], components }).catch(() => { });
    return;
  }

  // ── Cevapla Koçun Sorusunu Butonu ────────────────────────────────────────
  if (customId === "staff_answer_coach_question") {
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p || !p.currentQuestion) {
      return interaction.reply({ content: "❌ Şu anda aktif bir koç sorusu bulunmamaktadır.", ephemeral: true });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('modal_answer_coach')
      .setTitle('Koçun Sorusu');

    const cleanLabel = p.currentQuestion.length > 45 ? p.currentQuestion.slice(0, 42) + '...' : p.currentQuestion;

    const answerInput = new TextInputBuilder()
      .setCustomId('coach_answer_input')
      .setLabel(cleanLabel)
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(100)
      .setRequired(true)
      .setPlaceholder('Cevabınızı yazın...');

    modal.addComponents(new ActionRowBuilder().addComponents(answerInput));
    await interaction.showModal(modal);
    return;
  }

  // ── Yoklama butonu ──────────────────────────────────────────────────────
  if (customId === "btn_rollcall_here") {
    return handleRollCallButton(interaction);
  }

  // ── XP Çekilişi ─────────────────────────────────────────────────────────
  if (customId === "xp_cekilis_katil") {
    await interaction.deferReply({ ephemeral: true }).catch(() => { });
    const Giveaway = require("../../models/Giveaway");
    const giveaway = await Giveaway.findOne({ messageId: interaction.message.id });

    if (!giveaway) return interaction.editReply("❌ Bu çekiliş artık aktif değil veya bulunamadı.");
    if (!giveaway.isActive) return interaction.editReply("❌ Bu çekiliş sona ermiş.");
    if (giveaway.participants.includes(interaction.user.id))
      return interaction.editReply("✅ Çekilişe zaten katılmışsınız! Bol şans!");

    giveaway.participants.push(interaction.user.id);
    await giveaway.save();
    return interaction.editReply("🎉 Çekilişe başarıyla katıldınız! Ertesi gün 12:00'de sonuçlanacak.");
  }

  // ── EkoCoin Mağazası ─────────────────────────────────────────────────────
  if (customId === "ekocoin_magaza") {
    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) return interaction.reply({ content: "❌ Sistemde kaydınız bulunamadı.", ephemeral: true });

    const ecoCoins = p.gamification?.ecoCoins || 0;

    const SHOP_ITEMS = [
      { label: "🎨 Yeşil Rol Rengi", description: "İsminizin yeşil görünmesini sağlar. (500 E.C.)", value: "renk_yesil" },
      { label: "🎨 Kırmızı Rol Rengi", description: "İsminizin kırmızı görünmesini sağlar. (500 E.C.)", value: "renk_kirmizi" },
      { label: "🎨 Mavi Rol Rengi", description: "İsminizin mavi görünmesini sağlar. (500 E.C.)", value: "renk_mavi" },
      { label: "🎨 Sarı Rol Rengi", description: "İsminizin sarı görünmesini sağlar. (500 E.C.)", value: "renk_sari" },
      { label: "🎨 Mor Rol Rengi", description: "İsminizin mor görünmesini sağlar. (500 E.C.)", value: "renk_mor" },
      { label: "🎨 Pembe Rol Rengi", description: "İsminizin pembe görünmesini sağlar. (500 E.C.)", value: "renk_pembe" },
      { label: "🎨 Turuncu Rol Rengi", description: "İsminizin turuncu görünmesini sağlar. (500 E.C.)", value: "renk_turuncu" },
      { label: "🏖️ +1 Gün İzin Hakkı", description: "Devamsızlık izni bakiyenize +1 gün ekler. (1000 E.C.)", value: "ekstra_izin" },
    ];

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🛒 EkoCoin Mağazası")
      .setDescription(
        `Hoş geldin, **${interaction.user.username}**!\n\n` +
        `💰 **Güncel Bakiyen:** ${ecoCoins} E.C.\n\n` +
        `Aşağıdaki menüden almak istediğin ürünü seçebilirsin.`
      )
      .setFooter({ text: "Eko Yıldız • Mağaza" });

    const select = new StringSelectMenuBuilder()
      .setCustomId("ekocoin_satin_al")
      .setPlaceholder("Almak istediğin ürünü seç...")
      .addOptions(
        SHOP_ITEMS.map((item) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(item.label)
            .setDescription(item.description)
            .setValue(item.value)
        )
      );

    return interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true,
    });
  }

  // ── Personel Doğrulama ───────────────────────────────────────────────────
  if (customId === "btn_personel_check") {
    await interaction.deferReply({ ephemeral: true }).catch(() => { });
    try {
      const User = require("../../models/User");
      const user = await User.findOne({ discordId: interaction.user.id });

      if (!user?.robloxId) {
        return interaction.editReply({
          content: "❌ Önce `/authorize` komutuyla Roblox hesabınızı bağlamanız gerekmektedir.",
        });
      }

      const {
        syncStaffRobloxRanks,
        ensureAdminGuildMembership,
        syncStaffDiscordRoles,
      } = require("../services/staffAutomation");

      await syncStaffRobloxRanks(interaction.client, interaction.user.id);
      const roleSyncSuccess = await syncStaffDiscordRoles(interaction.client, interaction.user.id);

      if (!roleSyncSuccess) {
        return interaction.editReply({
          content:
            "❌ **Doğrulama Başarısız!**\n" +
            "Roblox grubunda (**EkoYıldız Moderatör Ekibi**) onaylı bir rütbeniz bulunamadı " +
            "veya roller verilirken bir hata oluştu.\n" +
            "Lütfen önce gruba katılıp rütbe aldığınızdan emin olun.",
        });
      }

      const inGuild = await ensureAdminGuildMembership(interaction.client, interaction.user.id);
      const notInGuildNote = !inGuild
        ? "\n*(Ancak sunucuda bulunamadığınız için roller sadece katıldığınızda geçerli olacak)*"
        : "";

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Personel Doğrulaması Başarılı")
            .setDescription(
              `Roblox ID: \`${user.robloxId}\`\n` +
              `Sunucudaki yetki rolleriniz Roblox grubundaki rütbenize göre **başarıyla** verildi.` +
              notInGuildNote
            )
            .setColor(0x2ecc71),
        ],
      });
    } catch (err) {
      console.error("[btn_personel_check] Hata:", err.message);
      return safeErrorReply(interaction, `❌ Hata: ${err.message}`);
    }
  }

  // ── TMT Yetkilendirme ────────────────────────────────────────────────────
  if (customId === "authorize_button") {
    const User = require("../../models/User");
    try {
      const user = await User.findOne({ discordId: interaction.user.id });
      const isLinked = !!user?.robloxId;

      const embed = new EmbedBuilder()
        .setColor(0x4169e1)
        .setTitle("🔐 Roblox Hesap Bağlama")
        .setDescription(
          isLinked
            ? `✅ **Zaten Bağlı!**\n\nRoblox ID: \`${user.robloxId}\`\n\nRollerinizi güncellemek için aşağıdaki butona tıklayın.`
            : `🔗 **Roblox Hesabını Bağlamak İçin Yöntem Seçin:**\n\n` +
            `**1. Yöntem (Web):** [Buraya Tıklayarak Yetkilendir](${BASE_URL}/auth/roblox) ve ardından \`/verify\` komutunu çalıştırın.\n\n` +
            `**2. Yöntem (Arkadaş İsteği):** Aşağıdaki **Arkadaş İsteği ile Doğrula** butonuna tıklayarak Roblox kullanıcı adınızı girin. Bot size arkadaşlık isteği göndererek hesabınızı doğrular.`
        )
        .setFooter({ text: "TMT Yetkilendirme Sistemi" })
        .setTimestamp();

      if (isLinked) {
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

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
    } catch (err) {
      console.error("[authorize_button] Hata:", err.message);
      return interaction.reply({ content: "❌ Bir hata oluştu.", ephemeral: true });
    }
  }

  // ── TMT Rol Senkronizasyonu ──────────────────────────────────────────────
  if (customId === "verify_button") {
    const User = require("../../models/User");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const user = await User.findOne({ discordId: interaction.user.id });
      if (!user?.robloxId) {
        return interaction.editReply({
          content: "❌ Roblox hesabınız bağlı değil! Önce yetkilendirme butonunu kullanın.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const normalizedGuildId = String(interaction.guild?.id || "").trim();
      const syncFn = GUILD_SYNC_MAP[normalizedGuildId];

      if (!syncFn) {
        console.error(`[verify_button] Tanınmayan sunucu: "${normalizedGuildId}"`);
        return interaction.editReply({
          content: `❌ Sunucu tanınmadı. Guild ID: ${normalizedGuildId}`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const result = await syncFn(interaction.client, interaction.user.id, user.robloxId, interaction.guild);

      if (!result?.success) {
        return interaction.editReply({
          content: "❌ Roller senkronize edilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const formatRoleList = (roles) =>
        roles?.length ? roles.map((r) => `<@&${r.id}>`).join("\n") : "None";

      const embed = new EmbedBuilder()
        .setColor(0x00aa00)
        .setTitle("✅ Rolleri Senkronize Et")
        .addFields(
          { name: "👤 Kullanıcı", value: result.nickname || interaction.user.username, inline: false },
          { name: "➕ Eklenen Roller", value: formatRoleList(result.added), inline: false },
          { name: "➖ Kaldırılan Roller", value: formatRoleList(result.removed), inline: false }
        )
        .setFooter({ text: "Rol Senkronizasyonu Tamamlandı" })
        .setTimestamp();

      if (result.tier) embed.addFields({ name: "🎖️ Seviye Rolü", value: result.tier, inline: true });
      if (result.unresolved?.length) {
        embed.addFields({
          name: "⚠️ Eşleşmeyen Roller",
          value: result.unresolved.map((n) => `\`${n}\``).join(", ").slice(0, 1024),
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error("[verify_button] Hata:", err.message);
      return interaction.editReply({
        content: "❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // ── Doğrulama yardım butonu ──────────────────────────────────────────────
  if (customId === "verify_help_refresh") {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("📋 Komut Özeti")
          .setDescription(
            "**`/authorize`** — Roblox hesabını bağla\n" +
            "**`/verify`** — İlk rol doğrulaması (gizli)\n" +
            "**`/update`** — Rolleri yeniden senkronize et\n\n" +
            `🌐 Web: [${BASE_URL}/dashboard](${BASE_URL}/dashboard)`
          ),
      ],
      ephemeral: true,
    });
  }

  // ── Destek menüsü ────────────────────────────────────────────────────────
  if (customId === "open_support_menu") {
    return interaction.reply({
      embeds: [getSupportMenuEmbed()],
      components: [getCategorySelectMenu()],
      ephemeral: true,
    });
  }

  // ── Ticket kapat ──────────────────────────────────────────────────────────
  if (customId.startsWith("close_ticket_")) {
    const ticketId = customId.replace("close_ticket_", "");
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) return interaction.reply({ content: "❌ Ticket bulunamadı.", ephemeral: true });

    const canClose =
      ticket.userId === interaction.user.id ||
      interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!canClose) return interaction.reply({ content: "❌ Bunu yapmaya yetkili değilsiniz.", ephemeral: true });

    if (ticket.status === "closed") {
      try {
        await interaction.reply({ content: "⏳ Bu ticket zaten kapatılmış. Kanal siliniyor...", ephemeral: true });
        setTimeout(() => interaction.channel?.delete("Ticket zaten kapatılmış, kanal siliniyor.").catch(console.error), 1000);
      } catch (err) {
        console.error("[close_ticket] Kanal silme hatası:", err.message);
      }
      return;
    }

    return interaction.showModal(buildCloseReasonModal(ticketId));
  }

  // ── Ticket tekrar aç ──────────────────────────────────────────────────────
  if (customId.startsWith("reopen_ticket_")) {
    const ticketId = customId.replace("reopen_ticket_", "");
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
    if (ticket.status === "open") return interaction.reply({ content: "❌ Bu ticket zaten açık", ephemeral: true });
    if (ticket.userId !== interaction.user.id) return interaction.reply({ content: "❌ Bu ticket size ait değil", ephemeral: true });

    try {
      const guildId = ticket.guildId || TARGET_GUILD_ID;
      const guild = await interaction.client.guilds.fetch(guildId);
      const existingChannel = ticket.channelId && !ticket.channelDeleted
        ? await guild.channels.fetch(ticket.channelId).catch(() => null)
        : null;

      if (existingChannel) {
        await existingChannel.permissionOverwrites.edit(ticket.userId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        await existingChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🔓 Ticket Yeniden Açıldı")
              .setDescription(`<@${ticket.userId}> tarafından yeniden açıldı.`)
              .setColor(0x4ade80)
              .setTimestamp(),
          ],
          components: [buildCloseButton(ticketId)],
        });
      } else {
        // Kanal silinmiş — yeniden oluştur
        const targets = [{ id: GUILD2_ID, categoryId: GUILD2_TICKET_CATEGORY_ID }];

        for (const target of targets) {
          try {
            const tGuild = await interaction.client.guilds.fetch(target.id).catch(() => null);
            if (!tGuild) continue;

            const permissionOverwrites = [
              { id: tGuild.id, deny: [PermissionFlagsBits.ViewChannel] },
              {
                id: ticket.userId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks,
                ],
              },
            ];

            let parentId = null;
            if (target.categoryId) {
              const ch = await tGuild.channels.fetch(target.categoryId).catch(() => null);
              parentId = ch?.type === ChannelType.GuildCategory ? ch.id : ch?.parentId ?? null;
            }
            if (!parentId) {
              let cat = tGuild.channels.cache.find(
                (ch) => ch.name.toLowerCase() === "destek talepleri" && ch.type === ChannelType.GuildCategory
              );
              if (!cat) {
                cat = await tGuild.channels.create({ name: "DESTEK TALEPLERİ", type: ChannelType.GuildCategory });
              }
              parentId = cat.id;
            }

            const newCh = await tGuild.channels.create({
              name: `ticket-${ticketId.toLowerCase()}`,
              type: ChannelType.GuildText,
              parent: parentId,
              permissionOverwrites,
            });

            await newCh.send({
              content: `<@${ticket.userId}> ticket'ın yeniden açıldı!`,
              components: [buildCloseButton(ticketId)],
            });

            if (!ticket.channelId || ticket.channelDeleted) {
              ticket.channelId = newCh.id;
              ticket.guildId = tGuild.id;
              ticket.channelDeleted = false;
              ticket.channelDeletedAt = null;
            }
          } catch (chErr) {
            console.warn(`[reopen_ticket] Kanal açılamadı (${target.id}):`, chErr.message);
          }
        }
      }

      ticket.status = "open";
      ticket.closedAt = null;
      ticket.closeReason = null;
      await ticket.save();

      const { cancelTicketDeletion } = require("../services/ticketCleanup");
      cancelTicketDeletion(ticketId);

      return interaction.reply({ content: "✅ Ticket yeniden açıldı.", ephemeral: true });
    } catch (err) {
      console.error("[reopen_ticket] Hata:", err.message);
      return interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
    }
  }

  // ── Ticket değerlendirme ──────────────────────────────────────────────────
  if (customId.startsWith("rate_ticket_")) {
    const ticketId = customId.replace("rate_ticket_", "");
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
    if (ticket.userId !== interaction.user.id) return interaction.reply({ content: "❌ Bu ticket size ait değil", ephemeral: true });
    if (ticket.rated) return interaction.reply({ content: "❌ Bu ticket'ı zaten değerlendirdiniz", ephemeral: true });

    return interaction.showModal(buildRatingModal(ticketId));
  }

  // ── Abone Doğrulama Butonları ─────────────────────────────────────────────
  if (
    customId.startsWith("abone_approve_") ||
    customId.startsWith("abone_reject_") ||
    customId.startsWith("abone_no_")
  ) {
    try {
      const { handleSubscriberButtons } = require("../services/photoVerification");
      await handleSubscriberButtons(interaction, interaction.client);
    } catch (err) {
      console.error("[photoVerification] Hata:", err.message);
      await safeErrorReply(interaction, `❌ Hata: ${err.message}`);
    }
    return;
  }

  // ── Form Modalleri ────────────────────────────────────────────────────────

  const FORM_MODALS = {
    btn_leave_form: () =>
      buildModal("modal_leave_form", "İzin Formu", [
        { id: "leave_reason", label: "İzin Sebebi", style: TextInputStyle.Paragraph },
        { id: "leave_duration", label: "Kaç Gün", style: TextInputStyle.Short },
      ]),

    btn_suggestion_form: () =>
      buildModal("modal_suggestion_form", "Tavsiye & Öneri Formu", [
        { id: "suggestion_text", label: "Öneriniz", style: TextInputStyle.Paragraph },
      ]),

    btn_resign_form: () =>
      buildModal("modal_resign_form", "İstifa Formu", [
        { id: "resign_reason", label: "İstifa Sebebiniz", style: TextInputStyle.Paragraph },
        { id: "resign_confirm", label: "Onaylıyorum (Evet yazın)", style: TextInputStyle.Short },
      ]),

    btn_modaction_form: () =>
      buildModal("modal_modaction_form", "Moderatör İşlem Formu", [
        { id: "mod_user", label: "İşlem Yapılan Kullanıcı (ID/İsim)", style: TextInputStyle.Short },
        { id: "mod_action", label: "İşlem (Ban/Mute/Kick vb.)", style: TextInputStyle.Short },
        { id: "mod_reason", label: "Sebep ve Kanıt Linki", style: TextInputStyle.Paragraph },
      ]),

    btn_ban_report_form: () =>
      buildModal("modal_ban_report_form", "Ban Rapor Sistemi", [
        { id: "ban_isim", label: "İsim (Kendi İsminiz)", style: TextInputStyle.Short },
        { id: "ban_kisi", label: "Banlanacak kişi", style: TextInputStyle.Short },
        { id: "ban_id", label: "Banlanacak Kişinin ID'si", style: TextInputStyle.Short },
        { id: "ban_sebep", label: "Sebep", style: TextInputStyle.Paragraph },
        { id: "ban_kanit", label: "Kanıt (Link)", style: TextInputStyle.Short },
      ]),

    btn_mute_report_form: () =>
      buildModal("modal_mute_report_form", "Mute Rapor Sistemi", [
        { id: "mute_isim", label: "İsim (Kendi İsminiz)", style: TextInputStyle.Short },
        { id: "mute_rutbe", label: "Rütbe (Kendi Rütbeniz)", style: TextInputStyle.Short },
        { id: "mute_kisi", label: "Mute atılan kişi", style: TextInputStyle.Short },
        { id: "mute_ihlal", label: "Kaçıncı ihlali?", style: TextInputStyle.Short },
      ]),

    btn_mod_complain_form: () =>
      buildModal("modal_mod_complain_form", "Mod Şikayet Sistemi", [
        { id: "comp_mod", label: "Şikayet Edilen Mod", style: TextInputStyle.Short },
        { id: "comp_sebep", label: "Sebep", style: TextInputStyle.Paragraph },
        { id: "comp_kanit", label: "Kanıt", style: TextInputStyle.Paragraph },
      ]),
  };

  if (FORM_MODALS[customId]) {
    return interaction.showModal(FORM_MODALS[customId]());
  }

  // ── Birim Alımı Butonları ─────────────────────────────────────────────────
  if (customId.startsWith("apply_unit_")) {
    const recruitmentId = customId.replace("apply_unit_", "");
    const { handleApplyClick } = require("../services/unitService");
    return handleApplyClick(interaction, recruitmentId);
  }

  if (customId.startsWith("unit_exam_ans_")) {
    const parts = customId.split("_");
    const qIndex = parseInt(parts[3], 10);
    const optIndex = parseInt(parts[4], 10);
    const { handleAnswerClick } = require("../services/unitService");
    return handleAnswerClick(interaction, qIndex, optIndex);
  }

  // ── Discord Abuse Dismiss Button ────────────────────────────────────────────
  if (customId.startsWith("abuse_dismiss_")) {
    const { handleAbuseDismissButton } = require("../services/discordAbuseDetector");
    return handleAbuseDismissButton(interaction);
  }

  // ── Leaderboard Pagination & Kategori Butonları ───────────────────────────
  if (customId.startsWith("lb_next_") || customId.startsWith("lb_prev_") || customId.startsWith("lb_category_")) {
    try {
      await interaction.deferUpdate().catch(() => { });
      const { getLeaderboard, getUserLeaderboardRank } = require('../services/staffSystem');

      let category = 'points';
      let page = 0;

      // Kategori butonları
      if (customId.startsWith("lb_category_")) {
        category = customId.replace("lb_category_", "");
        page = 0;
      } else {
        // Pagination butonları - önceki kategoriyı bul
        const parts = customId.split("_");
        category = parts[2] || 'points';

        if (customId.startsWith("lb_next_")) {
          page = parseInt(interaction.message.embeds[0]?.footer?.text?.split(" ")[1] || 0) || 0;
          page++;
        } else if (customId.startsWith("lb_prev_")) {
          page = parseInt(interaction.message.embeds[0]?.footer?.text?.split(" ")[1] || 1) - 1 || 0;
          page = Math.max(0, page - 1);
        }
      }

      const lb = await getLeaderboard(category);
      const userRank = await getUserLeaderboardRank(interaction.user.id, category);

      if (lb.length === 0) {
        return interaction.editReply({ content: '❌ Leaderboard verisi yok.' });
      }

      const itemsPerPage = 10;
      const totalPages = Math.ceil(Math.min(lb.length, 25) / itemsPerPage);
      page = Math.max(0, Math.min(page, totalPages - 1));

      const startIdx = page * itemsPerPage;
      const endIdx = Math.min(startIdx + itemsPerPage, Math.min(lb.length, 25));
      const pageItems = lb.slice(startIdx, endIdx);

      let description = '```\n';
      for (const p of pageItems) {
        const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `${p.rank}.`;
        const premium = p.isPremium ? '⭐ ' : '';

        let stat = '';
        if (category === 'xp') {
          stat = `XP: ${p.xp}`;
        } else if (category === 'level') {
          stat = `Lvl: ${p.level}`;
        } else if (category === 'badges') {
          stat = `🏆: ${p.badges}`;
        } else if (category === 'streak') {
          stat = `Streak: ${p.streak}`;
        } else {
          stat = `Puan: ${p.points}`;
        }

        description += `${medal}${premium}<@${p.userId}> | ${stat} | 🎫: ${p.tickets}\n`;
      }
      description += '```';

      const categoryNames = {
        points: '💰 Puan',
        xp: '⚡ XP',
        level: '📊 Level',
        badges: '🏅 Rozetler',
        streak: '🔥 Streak'
      };

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`🏆 LEADERBOARD - ${categoryNames[category]}`)
        .setDescription(description)
        .addFields(
          { name: '📊 KATEGORİLER', value: '**Aktif:** ' + categoryNames[category], inline: false }
        )
        .setFooter({ text: `Sayfa ${page + 1}/${totalPages} | Eko Yıldız Gamification` })
        .setTimestamp();

      // Kullanıcının kendi pozisyonunu göster
      if (userRank && !pageItems.some(p => p.userId === interaction.user.id)) {
        embed.addFields({
          name: `📍 SENİN POZİSYONUN`,
          value: `Sıra: **#${userRank.rank}** / ${userRank.total}`,
          inline: false
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`lb_prev_${category}`)
          .setLabel('⬅️ Önceki')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`lb_category_xp`)
          .setLabel('⚡ XP')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`lb_category_level`)
          .setLabel('📊 Level')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`lb_category_badges`)
          .setLabel('🏅 Rozetler')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`lb_next_${category}`)
          .setLabel('Sonraki ➡️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[leaderboard buttons] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── Versiyon Ödülü ──────────────────────────────────────────────────────
  if (customId === "claim_version_reward") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { getXpForLevel, getOrCreate } = require("../services/staffSystem");
      const p = await getOrCreate(interaction.user.id, interaction.guildId, interaction.client);
      if (!p || p.status !== 'active') {
        return interaction.editReply("❌ Sadece aktif personel bu güncelleme ödülünü alabilir.");
      }

      if (p.gamification?.versionRewardClaimedV5) {
        return interaction.editReply("⚠️ Bu güncelleme ödülünü zaten aldınız!");
      }

      p.gamification = p.gamification || {};
      p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + 300;
      p.gamification.totalPoints = (p.gamification.totalPoints || 0) + 100;

      // XP & Level up handle
      p.gamification.currentXP = (p.gamification.currentXP || 0) + 800;
      let levelUp = false;
      while (true) {
        const nextLevelXp = getXpForLevel((p.gamification.level || 1) + 1);
        if (p.gamification.currentXP >= nextLevelXp) {
          p.gamification.level = (p.gamification.level || 1) + 1;
          p.gamification.currentXP -= nextLevelXp;
          levelUp = true;
        } else {
          break;
        }
      }

      p.gamification.versionRewardClaimedV5 = true;
      await p.save();

      return interaction.editReply(
        `🎉 **Güncelleme Ödülü Alındı! (V5.0)**\n💰 **+300 E.C.** (EkoCoin)\n⚡ **+800 XP** ${levelUp ? '*(SEVİYE ATLADINIZ!)*' : ''}\n` +
        `Teşekkür eder, iyi çalışmalar dileriz! 💚`
      );
    } catch (err) {
      console.error('[claim_version_reward] hata:', err.message);
      return interaction.editReply(`❌ Hata: ${err.message}`);
    }
  }

  // ── V6.0 Ödül Butonu ──────────────────────────────────────────────────────
  if (customId === "claim_v6_reward") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { getXpForLevel, getOrCreate } = require("../services/staffSystem");
      const p = await getOrCreate(interaction.user.id, interaction.guildId, interaction.client);
      if (!p || p.status !== 'active') {
        return interaction.editReply("❌ Sadece aktif personel bu güncelleme ödülünü alabilir.");
      }

      if (p.gamification?.versionRewardClaimedV6) {
        return interaction.editReply("⚠️ V6.0 güncelleme ödülünü zaten aldınız!");
      }

      p.gamification = p.gamification || {};
      // 500 TL (ecoCoins) 
      p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + 500;
      // 1500 Elmas (currentXP)
      p.gamification.currentXP = (p.gamification.currentXP || 0) + 1500;

      // Gamification level-up kontrolü
      let levelUp = false;
      while (true) {
        const nextLevelXp = getXpForLevel((p.gamification.level || 1) + 1);
        if (p.gamification.currentXP >= nextLevelXp) {
          p.gamification.level = (p.gamification.level || 1) + 1;
          p.gamification.currentXP -= nextLevelXp;
          levelUp = true;
        } else {
          break;
        }
      }

      p.gamification.versionRewardClaimedV6 = true;
      await p.save();

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🎁 V6.0 Güncelleme Ödülü Alındı!')
        .setDescription(
          '**Tebrikler! Yeni sistemi keşfettiğiniz için teşekkürler! 🌟**\n\n' +
          `💰 **+500 TL** hesabınıza yatırıldı!\n` +
          `💎 **+1500 Elmas** hesabınıza eklendi! ${levelUp ? '*(SEVİYE ATLADINIZ! 🎊)*' : ''}\n\n` +
          '> *"İyi çalışmalar dilerim — Eko & Sentara"* 🤖💚'
        )
        .setFooter({ text: 'Eko Yıldız V6.0 • Güncel Sürüm' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[claim_v6_reward] hata:', err.message);
      return interaction.editReply(`❌ Hata: ${err.message}`);
    }
  }

  // ── Özellikleri Test Et ──────────────────────────────────────────────────
  if (customId === "test_features") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      return interaction.editReply(
        `🚀 Yeni özellikleri test etmek için sunucuda veya DM üzerinden \`/briefing tip:gunluk\` komutunu kullanabilirsiniz. Ayrıca günlük görevlerinizi tamamlamaya başlayabilirsiniz!`
      );
    } catch (err) {
      console.error('[test_features] hata:', err.message);
      return interaction.editReply(`❌ Hata: ${err.message}`);
    }
  }

  // ── İncele Yasakla / Yasak Kaldır Butonları ──────────────────────────────
  if (customId.startsWith("incele_ban_") || customId.startsWith("incele_unban_")) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Bu işlemi gerçekleştirmek için **Yönetici** yetkisine sahip olmalısınız!", ephemeral: true });
    }

    const isBanAction = customId.startsWith("incele_ban_");
    const targetUserId = customId.replace(isBanAction ? "incele_ban_" : "incele_unban_", "");

    // Defer update so discord doesn't time out
    await interaction.deferUpdate().catch(() => { });

    const User = require("../../models/User");
    let dbUser = await User.findOne({ discordId: targetUserId });
    const targetUserObj = await interaction.client.users.fetch(targetUserId).catch(() => null);

    if (isBanAction) {
      // BANLAMA İŞLEMİ
      const banReason = "Profil İnceleme Paneli Üzerinden Banlandı";
      if (!dbUser) {
        dbUser = new User({
          discordId: targetUserId,
          discordUsername: targetUserObj?.username || "Bilinmiyor",
          isBanned: true,
          banReason: banReason,
          bannedAt: new Date(),
          bannedBy: interaction.user.id,
          banLevel: "high"
        });
      } else {
        dbUser.isBanned = true;
        dbUser.banReason = banReason;
        dbUser.bannedAt = new Date();
        dbUser.bannedBy = interaction.user.id;
        dbUser.banLevel = "high";
      }
      await dbUser.save();

      // DM Gönder
      if (targetUserObj) {
        await targetUserObj.send(
          `🚫 **BEM Sentara & EkoYıldız Sunucularından Yasaklandınız!**\n\n` +
          `**Gerekçe:** ${banReason}\n` +
          `Erişiminiz tüm sunucularımızdan ve bot servislerimizden kesilmiştir.`
        ).catch(() => console.log(`[incele_ban] DM gönderilemedi (User: ${targetUserId})`));
      }

      // Discord Sunucularından Banla (Botun bulunduğu tüm sunuculardan)
      for (const guild of interaction.client.guilds.cache.values()) {
        try {
          await guild.bans.create(targetUserId, { reason: `Yasaklama (İnceleme Paneli): ${banReason}` }).catch(() => { });
        } catch (err) {
          console.warn(`[incele_ban] Guild ban error for ${guild.name}:`, err.message);
        }
      }
    } else {
      // YASAĞI KALDIRMA İŞLEMİ
      if (dbUser) {
        dbUser.isBanned = false;
        dbUser.banReason = null;
        dbUser.bannedAt = null;
        dbUser.bannedBy = null;
        dbUser.banLevel = null;
        await dbUser.save();
      }

      // Discord Sunucularından Banı Kaldır
      for (const guild of interaction.client.guilds.cache.values()) {
        try {
          const ban = await guild.bans.fetch(targetUserId).catch(() => null);
          if (ban) {
            await guild.bans.remove(targetUserId, "Yasaklama Kaldırıldı (İnceleme Paneli)").catch(() => { });
          }
        } catch (err) {
          console.warn(`[incele_unban] Guild unban error for ${guild.name}:`, err.message);
        }
      }
    }

    // Embed'i güncelle
    const targetMemberObj = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    const { generateInceleData } = require("./generalCommandHandler");

    const dummyUser = targetUserObj || { id: targetUserId, tag: dbUser?.discordUsername || "Bilinmiyor", displayAvatarURL: () => "" };
    const response = await generateInceleData(interaction.guild, dummyUser, targetMemberObj);

    await interaction.editReply(response).catch((err) => console.error("EditReply error:", err));
    return;
  }

  // ── Swear/NSFW Moderatör Hapis / Uyarı Butonları ──────────────────────────
  if (customId.startsWith("jail_")) {
    const parts = customId.split("_");
    const action = parts[1]; // warn | immed | ignore
    const guildId = parts[2];
    const targetUserId = parts[3];
    const targetChannelId = parts[4];
    const targetMsgId = parts[5];
    const duration = parts[6] ? parseInt(parts[6], 10) : 10; // Default 10 mins

    await interaction.deferUpdate().catch(() => { });

    let targetGuild = interaction.client.guilds.cache.get(guildId)
      || await interaction.client.guilds.fetch(guildId).catch(() => null);
    if (!targetGuild) return;

    const User = require("../../models/User");
    let dbUser = await User.findOne({ discordId: targetUserId });
    if (!dbUser) {
      dbUser = new User({ discordId: targetUserId, discordUsername: "Bilinmiyor" });
    }

    const targetUserObj = await interaction.client.users.fetch(targetUserId).catch(() => null);

    let resultText = "";
    let isJailAction = false;
    let finalDuration = duration;

    // Call the central recordModerationAction to handle XP, EkoCoins, daily tasks, and check promotion
    const { recordModerationAction, PROMOTION_REQUIREMENTS, ROLE_NAMES } = require("../services/staffSystem");
    await recordModerationAction(interaction.user.id, interaction.client);

    // Retrieve updated progress to show the promotion requirement progress bar
    const StaffProgress = require("../../models/StaffProgress");
    const modProgress = await StaffProgress.findOne({ userId: interaction.user.id });
    if (modProgress) {
      resultText += `\n\n💰 **Yetkili Ödülü:** Moderasyon işleminiz için **10 E.C. (EkoCoin)** kazandınız!`;

      const currentLevel = modProgress.level || 1;
      const reqs = PROMOTION_REQUIREMENTS[currentLevel];
      if (reqs) {
        const currentActions = modProgress.stats?.moderationActions || 0;
        const requiredActions = reqs.moderationActions;
        const percentage = Math.min(100, Math.round((currentActions / requiredActions) * 100));

        // Build progress bar
        const filled = Math.min(10, percentage > 0 ? Math.max(1, Math.floor(percentage / 10)) : 0);
        const empty = 10 - filled;
        const progressBar = '█'.repeat(filled) + '░'.repeat(empty);

        resultText += `\n\n📈 **Terfi İlerlemeniz (Mod. Eylemi):**\n` +
          `• Rütbe: **${ROLE_NAMES[currentLevel]}**\n` +
          `• İlerleme: \`[${progressBar}]\` **${percentage}%**\n` +
          `• Yapılan Eylem: **${currentActions} / ${requiredActions}** (Terfi için)`;
      }
    }

    if (action === "ignore") {
      resultText = `✅ **${targetUserObj?.tag || targetUserId}** için küfür ihlali yoksayıldı.` + resultText;
    } else if (action === "warn") {
      dbUser.warnCount = (dbUser.warnCount || 0) + 1;
      await dbUser.save();

      resultText = `⚠️ **${targetUserObj?.tag || targetUserId}** uyarıldı. (Güncel Uyarı: **${dbUser.warnCount}/3**)` + resultText;

      // Send warning DM to target user
      if (targetUserObj) {
        await targetUserObj.send(
          `⚠️ **EkoYıldız Moderasyonu Tarafından Uyarıldınız!**\n\n` +
          `**Sebep:** Küfür / Uygunsuz içerik tespiti.\n` +
          `**Uyarı Sayınız:** ${dbUser.warnCount}/3\n` +
          `Uyarı sayınız 3'ü geçerse otomatik olarak hapishaneye gönderileceksiniz.`
        ).catch(() => { });
      }

      if (dbUser.warnCount >= 3) {
        isJailAction = true;
        finalDuration = 30; // 30 minutes for 3 warnings
      }
    } else if (action === "mute") {
      const member = await targetGuild.members.fetch(targetUserId).catch(() => null);
      if (member) {
        try {
          const msDuration = finalDuration * 60 * 1000;
          await member.timeout(msDuration, `Küfür/NSFW İhlali (Moderatör Onaylı Susturma): ${interaction.user.tag}`);
          resultText = `🔇 **${targetUserObj?.tag || targetUserId}** başarıyla **${finalDuration} dakika** susturuldu.` + resultText;
        } catch (err) {
          resultText = `❌ **${targetUserObj?.tag || targetUserId}** susturulurken bir hata oluştu: ${err.message}` + resultText;
        }
      } else {
        resultText = `❌ **${targetUserObj?.tag || targetUserId}** sunucuda bulunamadı.` + resultText;
      }
    } else if (action === "kick") {
      const member = await targetGuild.members.fetch(targetUserId).catch(() => null);
      if (member) {
        try {
          if (member.kickable) {
            await member.kick(`Küfür/NSFW İhlali (Moderatör Onaylı Atılma): ${interaction.user.tag}`);
            resultText = `👢 **${targetUserObj?.tag || targetUserId}** başarıyla sunucudan atıldı.` + resultText;
          } else {
            resultText = `❌ **${targetUserObj?.tag || targetUserId}** yetki yetersizliğinden dolayı atılamadı.` + resultText;
          }
        } catch (err) {
          resultText = `❌ **${targetUserObj?.tag || targetUserId}** atılırken bir hata oluştu: ${err.message}` + resultText;
        }
      } else {
        resultText = `❌ **${targetUserObj?.tag || targetUserId}** sunucuda bulunamadı.` + resultText;
      }
    } else if (action === "ban") {
      const member = await targetGuild.members.fetch(targetUserId).catch(() => null);
      if (member) {
        try {
          if (member.bannable) {
            await member.ban({ reason: `Küfür/NSFW İhlali (Moderatör Onaylı Ban): ${interaction.user.tag}` });
            resultText = `🔨 **${targetUserObj?.tag || targetUserId}** başarıyla banlandı.` + resultText;
          } else {
            resultText = `❌ **${targetUserObj?.tag || targetUserId}** yetki yetersizliğinden dolayı banlanamadı.` + resultText;
          }
        } catch (err) {
          resultText = `❌ **${targetUserObj?.tag || targetUserId}** banlanırken bir hata oluştu: ${err.message}` + resultText;
        }
      } else {
        resultText = `❌ **${targetUserObj?.tag || targetUserId}** sunucuda bulunamadı.` + resultText;
      }
    } else if (action === "immed") {
      isJailAction = true;
    }

    // Delete the swear/NSFW message from the chat channel
    if (action === "warn" || action === "immed" || action === "mute" || action === "kick" || action === "ban") {
      try {
        const channel = await targetGuild.channels.fetch(targetChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const msgToDelete = await channel.messages.fetch(targetMsgId).catch(() => null);
          if (msgToDelete && msgToDelete.deletable) {
            await msgToDelete.delete().catch(() => { });
          }
        }
      } catch (err) {
        console.warn("[jail] Swear message deletion error:", err.message);
      }
    }

    if (isJailAction) {
      const { jailUser } = require("../services/jailService");
      const success = await jailUser(
        interaction.client,
        targetGuild,
        targetUserId,
        `Küfür/NSFW İhlali (Moderatör Onaylı: ${action === "warn" ? "3. Uyarı" : "Direkt Hapis"})`,
        finalDuration,
        interaction.user.id
      );

      if (success) {
        resultText = `🔒 **${targetUserObj?.tag || targetUserId}** başarıyla **${finalDuration} dakika** hapishaneye atıldı.` + resultText;
      } else {
        resultText = `❌ **${targetUserObj?.tag || targetUserId}** hapise atılırken bir hata oluştu (Yetki eksikliği vb.).` + resultText;
      }
    }

    // Update moderator's DM message to show action completed
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(action === "ignore" ? 0x95a5a6 : (isJailAction ? 0x9b59b6 : 0xf39c12))
      .setTitle("🚨 MODERASYON İŞLEMİ TAMAMLANDI")
      .setDescription(
        (interaction.message.embeds[0].description || "") +
        `\n\n> **Uygulayan Yetkili:** ${interaction.user.toString()}\n> **Sonuç:** ${resultText}`
      );

    let btnLabel = "İşlem Tamamlandı";
    let btnStyle = ButtonStyle.Secondary;
    if (action === "warn") {
      btnLabel = isJailAction ? "🔒 Hapise Atılmış (3. Uyarı)" : "⚠️ Uyarılmış";
      btnStyle = isJailAction ? ButtonStyle.Danger : ButtonStyle.Primary;
    } else if (action === "mute") {
      btnLabel = "🔇 Susturulmuş";
      btnStyle = ButtonStyle.Primary;
    } else if (action === "immed" || isJailAction) {
      btnLabel = "🔒 Hapise Atılmış";
      btnStyle = ButtonStyle.Danger;
    } else if (action === "kick") {
      btnLabel = "👢 Atılmış";
      btnStyle = ButtonStyle.Danger;
    } else if (action === "ban") {
      btnLabel = "🔨 Banlanmış";
      btnStyle = ButtonStyle.Danger;
    } else if (action === "ignore") {
      btnLabel = "✅ Yoksayılmış";
      btnStyle = ButtonStyle.Secondary;
    }

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`disabled_action`)
        .setLabel(btnLabel)
        .setStyle(btnStyle)
        .setDisabled(true)
    );

    await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] }).catch(() => { });
    return;
  }

  // ── EkoCoin -> XP Dönüştürme Butonu ──────────────────────────────────────
  if (customId === "ekocoin_convert_xp_btn") {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
    const modal = new ModalBuilder()
      .setCustomId("ekocoin_convert_xp_modal")
      .setTitle("⚡ EkoCoin -> XP Dönüştür");

    const amountInput = new TextInputBuilder()
      .setCustomId("convert_amount")
      .setLabel("Dönüştürülecek EkoCoin Miktarı")
      .setPlaceholder("Örn: 200 (1 E.C. = 0.25 XP)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal).catch(() => { });
    return;
  }

  // ── Sunucu Kurulum Asistanı Butonları ─────────────────────────────────────
  if (customId.startsWith("setup_")) {
    const parts = customId.split("_");
    const action = parts[1]; // correct | incorrect | edit | confirm

    let targetGuildId = "";
    if (action === "confirm") {
      targetGuildId = parts[3]; // setup_confirm_channels_${guildId} or setup_confirm_chefs_${guildId}
    } else if (action === "edit") {
      targetGuildId = parts[3]; // setup_edit_save_${guildId}
    } else {
      targetGuildId = parts[2]; // setup_correct_${guildId} or setup_incorrect_${guildId}
    }

    const ServerSetup = require("../../models/ServerSetup");
    const setupDoc = await ServerSetup.findOne({ guildId: targetGuildId });
    if (!setupDoc) {
      return interaction.reply({ content: "❌ Kurulum verisi bulunamadı.", ephemeral: true });
    }

    if (action === "correct") {
      await interaction.deferUpdate().catch(() => { });
      await renderChannelSelectionPanel(interaction, setupDoc);
      return;
    }

    if (action === "incorrect") {
      await interaction.deferUpdate().catch(() => { });
      await renderRoleCustomizationPanel(interaction, setupDoc);
      return;
    }

    if (action === "edit") {
      await interaction.deferUpdate().catch(() => { });

      const noblox = require("noblox.js");
      const rbxRoles = await noblox.getRoles(setupDoc.robloxGroupId).catch(() => []);

      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
      let mappedText = "";
      for (const r of rbxRoles) {
        let matchedVal = null;
        if (setupDoc.roleMappings) {
          if (typeof setupDoc.roleMappings.get === "function") {
            matchedVal = setupDoc.roleMappings.get(r.rank.toString());
          } else {
            matchedVal = setupDoc.roleMappings[r.rank.toString()];
          }
        }
        let roleDisplay = "❌ *Eşleştirilemedi*";
        if (Array.isArray(matchedVal) && matchedVal.length > 0) {
          roleDisplay = matchedVal.map(id => interaction.guild.roles.cache.get(id)?.toString() || `\`${id}\``).join(", ");
        } else if (typeof matchedVal === "string" && matchedVal) {
          const roleObj = interaction.guild.roles.cache.get(matchedVal);
          roleDisplay = roleObj ? roleObj.toString() : `\`${matchedVal}\``;
        }
        mappedText += `• **Rank ${r.rank} (${r.name}):** ${roleDisplay}\n`;
      }

      const setupEmbed = new EmbedBuilder()
        .setTitle("🤖 Yapay Zeka Rol Eşleştirmesi")
        .setColor(0x3498db)
        .setDescription(
          `**Seçilen Grup:** [${setupDoc.robloxGroupName}](https://www.roblox.com/groups/${setupDoc.robloxGroupId})\n\n` +
          mappedText +
          `\nBu eşleştirme doğru mu?`
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`setup_correct_${setupDoc.guildId}`)
          .setLabel("DOĞRU")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`setup_incorrect_${setupDoc.guildId}`)
          .setLabel("DOĞRU DEĞİL DÜZENLEMEK İSTİYORUM")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [setupEmbed], components: [row] }).catch(() => { });
      return;
    }

    if (action === "confirm") {
      const type = parts[2]; // channels | chefs
      await interaction.deferUpdate().catch(() => { });

      if (type === "channels") {
        await renderChefsSelectionPanel(interaction, setupDoc);
        return;
      }

      if (type === "chefs") {
        try {
          const { ChannelType, EmbedBuilder, StringSelectMenuBuilder } = require("discord.js");
          const centralGuild = interaction.client.guilds.cache.get("1483482948320891074")
            || await interaction.client.guilds.fetch("1483482948320891074").catch(() => null);

          let archiveChannelId = "";
          if (centralGuild) {
            const sanitizedGuildName = setupDoc.guildName.toLowerCase().replace(/[^a-z0-9]/g, "-");
            const channelName = `${sanitizedGuildName}-arsiv`;

            const newChan = await centralGuild.channels.create({
              name: channelName,
              type: ChannelType.GuildText,
              parent: "1521515810512699452",
              reason: "Branş Sunucu Kurulumu Arşiv Kanalı"
            }).catch(() => null);
            if (newChan) {
              archiveChannelId = newChan.id;
              setupDoc.archiveChannelId = newChan.id;
            }
          }

          const rulesChan = interaction.guild.channels.cache.get(setupDoc.rulesChannelId);
          if (rulesChan && rulesChan.isTextBased()) {
            const rulesEmbed = new EmbedBuilder()
              .setTitle("📜 TMT SUNUCU KURALLARI VE YÖNETİMİ")
              .setColor(0x2c3e50)
              .setDescription(
                `Merhaba! Sunucumuza hoş geldiniz. Lütfen aşağıdaki kurallara ve yönetim kadrosuna dikkat edin:\n\n` +
                `**1.** Sunucu içerisinde saygılı ve ahlaki kurallara uygun davranmak zorunludur.\n` +
                `**2.** Reklam, spam ve sabotaj (abuse) girişimleri en ağır şekilde cezalandırılacaktır.\n` +
                `**3.** Roblox rütbenizi eşitlemek için lütfen doğrulama kanalını kullanın.\n\n` +
                `👑 **BRANŞ YÖNETİM KADROSU:**\n` +
                `• **BRANŞ ŞEFİ:** ${setupDoc.branchChef ? `<@${setupDoc.branchChef}>` : "Bilinmiyor"}\n` +
                `• **BRANŞ ŞEF YARDIMCISI:** ${setupDoc.branchChefAssistant ? `<@${setupDoc.branchChefAssistant}>` : "Bilinmiyor"}\n`
              )
              .setTimestamp()
              .setFooter({ text: "TMT Yönetim Departmanı" });

            await rulesChan.send({ embeds: [rulesEmbed] }).catch(() => { });
          }

          setupDoc.status = "active";
          await setupDoc.save();

          if (centralGuild) {
            const listChan = centralGuild.channels.cache.get("1521516376831823973")
              || await centralGuild.channels.fetch("1521516376831823973").catch(() => null);
            if (listChan && listChan.isTextBased()) {
              const activeSetups = await ServerSetup.find({ status: "active" });

              const listEmbed = new EmbedBuilder()
                .setTitle("🏢 KURULAN BRANŞ SUNUCULARI LİSTESİ")
                .setColor(0x1abc9c)
                .setDescription(
                  "Aşağıdaki listeden dilediğiniz branş sunucusunu seçip, Branş Şefi ve Branş Şef Yardımcısı atamalarını güncelleyebilirsiniz.\n\n" +
                  activeSetups.map(s => `• **${s.guildName}** (Grup: \`${s.robloxGroupName}\`)\n  > Şef: ${s.branchChef ? `<@${s.branchChef}>` : "Yok"}\n  > Yardımcı: ${s.branchChefAssistant ? `<@${s.branchChefAssistant}>` : "Yok"}`).join("\n\n")
                )
                .setTimestamp();

              const options = activeSetups.map(s => ({
                label: s.guildName,
                description: `${s.robloxGroupName} Grubu Sunucusu`,
                value: s.guildId
              })).slice(0, 25);

              const listComponents = [];
              if (options.length > 0) {
                listComponents.push(
                  new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                      .setCustomId("setup_central_branch_select")
                      .setPlaceholder("Branş Seçin...")
                      .addOptions(options)
                  )
                );
              }

              const msgs = await listChan.messages.fetch({ limit: 50 }).catch(() => []);
              const botMsg = msgs.find(m => m.author.id === interaction.client.user.id && m.embeds[0]?.title?.includes("KURULAN BRANŞ SUNUCULARI"));
              if (botMsg) {
                await botMsg.edit({ embeds: [listEmbed], components: listComponents }).catch(() => { });
              } else {
                await listChan.send({ embeds: [listEmbed], components: listComponents }).catch(() => { });
              }
            }
          }

          const completeEmbed = new EmbedBuilder()
            .setTitle("✅ Kurulum Başarıyla Tamamlandı!")
            .setColor(0x2ecc71)
            .setDescription(
              `**${setupDoc.guildName}** sunucusunun kurulumu başarıyla tamamlandı!\n\n` +
              `• **Sunucu Kuralları:** Gönderildi\n` +
              `• **Merkezi Arşiv Log Kanalı:** ${archiveChannelId ? `<#${archiveChannelId}>` : "Yaratılamadı"}\n` +
              `• **Branş Durumu:** Aktif`
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [completeEmbed], components: [] }).catch(() => { });
        } catch (setupErr) {
          console.error("[SunucuKurma] Final setup error:", setupErr);
          await interaction.followUp({ content: `❌ Kurulum tamamlanırken hata oluştu: ${setupErr.message}`, ephemeral: true }).catch(() => { });
        }
      }
    }
  }

  return null;
}

// ── Sunucu Kurulumu Panel Yardımcı Fonksiyonları ───────────────────────────
async function renderChannelSelectionPanel(interaction, setupDoc) {
  const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require("discord.js");

  const embed = new EmbedBuilder()
    .setTitle("📂 Sunucu Kurulumu - Kanal Seçimleri")
    .setColor(0xf1c40f)
    .setDescription(
      `Lütfen kurulacak sunucu için aşağıdaki kanalları seçin:\n\n` +
      `• **Yönetici/Log Kanalı:** ${setupDoc.adminChannelId ? `<#${setupDoc.adminChannelId}>` : "❌ *Seçilmedi*"}\n` +
      `• **Doğrulama Yardım Kanalı:** ${setupDoc.verifyHelpChannelId ? `<#${setupDoc.verifyHelpChannelId}>` : "❌ *Seçilmedi*"}\n` +
      `• **Kurallar Kanalı:** ${setupDoc.rulesChannelId ? `<#${setupDoc.rulesChannelId}>` : "❌ *Seçilmedi*"}`
    )
    .setTimestamp();

  const adminRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`setup_select_admin_${setupDoc.guildId}`)
      .setPlaceholder("Yönetici/Log Kanalı Seçin...")
      .addChannelTypes(ChannelType.GuildText)
  );

  const verifyRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`setup_select_verify_${setupDoc.guildId}`)
      .setPlaceholder("Doğrulama Yardım Kanalı Seçin...")
      .addChannelTypes(ChannelType.GuildText)
  );

  const rulesRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId(`setup_select_rules_${setupDoc.guildId}`)
      .setPlaceholder("Kurallar Kanalı Seçin...")
      .addChannelTypes(ChannelType.GuildText)
  );

  const isProceedEnabled = setupDoc.adminChannelId && setupDoc.verifyHelpChannelId && setupDoc.rulesChannelId;
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup_confirm_channels_${setupDoc.guildId}`)
      .setLabel("Devam Et (Şef Seçimi)")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!isProceedEnabled)
  );

  await interaction.editReply({ embeds: [embed], components: [adminRow, verifyRow, rulesRow, buttonRow] }).catch(() => { });
}

async function renderChefsSelectionPanel(interaction, setupDoc) {
  const { EmbedBuilder, ActionRowBuilder, UserSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

  const embed = new EmbedBuilder()
    .setTitle("👤 Sunucu Kurulumu - Branş Şefi & Yardımcısı Seçimi")
    .setColor(0xe67e22)
    .setDescription(
      `Lütfen sunucu için Branş Şefi ve Branş Şef Yardımcısı seçin:\n\n` +
      `• **BRANŞ ŞEFİ:** ${setupDoc.branchChef ? `<@${setupDoc.branchChef}>` : "❌ *Seçilmedi*"}\n` +
      `• **BRANŞ ŞEF YARDIMCISI:** ${setupDoc.branchChefAssistant ? `<@${setupDoc.branchChefAssistant}>` : "❌ *Seçilmedi*"}`
    )
    .setTimestamp();

  const chefRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`setup_select_chef_${setupDoc.guildId}`)
      .setPlaceholder("Branş Şefi Seçin...")
  );

  const assistantRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`setup_select_chef_assistant_${setupDoc.guildId}`)
      .setPlaceholder("Branş Şef Yardımcısı Seçin...")
  );

  const isProceedEnabled = setupDoc.branchChef && setupDoc.branchChefAssistant;
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup_confirm_chefs_${setupDoc.guildId}`)
      .setLabel("Kurulumu Tamamla ve Başlat!")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isProceedEnabled)
  );

  await interaction.editReply({ embeds: [embed], components: [chefRow, assistantRow, buttonRow] }).catch(() => { });
}

async function renderRoleCustomizationPanel(interaction, setupDoc) {
  const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

  const noblox = require("noblox.js");
  const rbxRoles = await noblox.getRoles(setupDoc.robloxGroupId).catch(() => []);

  if (!rbxRoles || rbxRoles.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle("⚠️ Hata: Rütbeler Alınamadı")
      .setColor(0xe74c3c)
      .setDescription(
        `Roblox grubundan (${setupDoc.robloxGroupName || "Bilinmeyen"}) rütbe bilgileri alınamadı.\n` +
        `Roblox API hatası veya geçici bir kesinti olabilir. Lütfen daha sonra tekrar deneyin.`
      )
      .setTimestamp();

    const retryRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`setup_incorrect_${setupDoc.guildId}`)
        .setLabel("YENİDEN DENE")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`setup_edit_save_${setupDoc.guildId}`)
        .setLabel("GERİ DÖN")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [retryRow] }).catch(() => { });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🔧 Rol Eşleştirme Düzenleme Paneli")
    .setColor(0xe74c3c)
    .setDescription(
      `Aşağıdaki açılır menüden düzenlemek istediğiniz Roblox Rütbesini seçin.\n` +
      `Ardından sunucu rollerinden eşleştireceğiniz rolü seçmeniz istenecektir.\n\n` +
      `Eşleştirmeleri bitirdiğinizde **Kaydet ve Geri Dön** butonuna basın.`
    )
    .setTimestamp();

  const menuOptions = rbxRoles.map(r => {
    let val = null;
    if (setupDoc.roleMappings) {
      if (typeof setupDoc.roleMappings.get === "function") {
        val = setupDoc.roleMappings.get(r.rank.toString());
      } else {
        val = setupDoc.roleMappings[r.rank.toString()];
      }
    }
    const displayVal = Array.isArray(val) ? val.join(",") : (val || "Yok");
    return {
      label: `Rank ${r.rank}: ${r.name}`.slice(0, 100),
      description: `Mevcut Rol ID: ${displayVal}`.slice(0, 100),
      value: r.rank.toString()
    };
  }).slice(0, 25);

  const rankMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`setup_select_edit_rank_${setupDoc.guildId}`)
      .setPlaceholder("Düzenlenecek Roblox Rütbesini Seçin...")
      .addOptions(menuOptions)
  );

  const saveRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup_edit_save_${setupDoc.guildId}`)
      .setLabel("Kaydet ve Geri Dön")
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({ embeds: [embed], components: [rankMenu, saveRow] }).catch(() => { });
}

module.exports = {
  handleButtonInteraction,
  renderChannelSelectionPanel,
  renderChefsSelectionPanel,
  renderRoleCustomizationPanel
};