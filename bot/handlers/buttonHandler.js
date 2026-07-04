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

// ─── Yardımcı: Güvenli hata yanıtı ──────────────────────────────────────────

async function safeErrorReply(interaction, message) {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: message });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  } catch (_) { }
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

  // ── Koç Mesaj Filtre Butonları ──────────────────────────────────────────
  if (customId.startsWith("coach_msg_level_")) {
    const level = customId.replace("coach_msg_level_", "");
    const levelMap = { "all": 0, "important": 1, "silent": 2 };
    const { handleCoachMessageLevelButton } = require("../services/coachMessageService");
    return handleCoachMessageLevelButton(interaction, levelMap[level]);
  }

  // ── Panel butonu ────────────────────────────────────────────────────────
  if (customId.startsWith("panel_")) {
    const { handlePanelButton } = require("../services/mainPanelService");
    return handlePanelButton(interaction);
  }

  // ── Koç oturumu ─────────────────────────────────────────────────────────
  if (customId === "talk_to_coach") {
    const { startCoachSession } = require("../services/staffCoach");
    return startCoachSession(interaction);
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
      const StaffProgress = require("../../models/StaffProgress");
      const { getXpForLevel } = require("../services/staffSystem");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
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
    await interaction.deferUpdate().catch(() => {});

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
          await guild.bans.create(targetUserId, { reason: `Yasaklama (İnceleme Paneli): ${banReason}` }).catch(() => {});
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
            await guild.bans.remove(targetUserId, "Yasaklama Kaldırıldı (İnceleme Paneli)").catch(() => {});
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

    await interaction.deferUpdate().catch(() => {});

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
        const filled = Math.round(percentage / 10);
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
        ).catch(() => {});
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
            await msgToDelete.delete().catch(() => {});
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

    await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] }).catch(() => {});
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

    await interaction.showModal(modal).catch(() => {});
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
      await interaction.deferUpdate().catch(() => {});
      await renderChannelSelectionPanel(interaction, setupDoc);
      return;
    }

    if (action === "incorrect") {
      await interaction.deferUpdate().catch(() => {});
      await renderRoleCustomizationPanel(interaction, setupDoc);
      return;
    }

    if (action === "edit") {
      await interaction.deferUpdate().catch(() => {});
      
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
      
      await interaction.editReply({ embeds: [setupEmbed], components: [row] }).catch(() => {});
      return;
    }

    if (action === "confirm") {
      const type = parts[2]; // channels | chefs
      await interaction.deferUpdate().catch(() => {});

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
              
            await rulesChan.send({ embeds: [rulesEmbed] }).catch(() => {});
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
                await botMsg.edit({ embeds: [listEmbed], components: listComponents }).catch(() => {});
              } else {
                await listChan.send({ embeds: [listEmbed], components: listComponents }).catch(() => {});
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

          await interaction.editReply({ embeds: [completeEmbed], components: [] }).catch(() => {});
        } catch (setupErr) {
          console.error("[SunucuKurma] Final setup error:", setupErr);
          await interaction.followUp({ content: `❌ Kurulum tamamlanırken hata oluştu: ${setupErr.message}`, ephemeral: true }).catch(() => {});
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

  await interaction.editReply({ embeds: [embed], components: [adminRow, verifyRow, rulesRow, buttonRow] }).catch(() => {});
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

  await interaction.editReply({ embeds: [embed], components: [chefRow, assistantRow, buttonRow] }).catch(() => {});
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
    
    await interaction.editReply({ embeds: [embed], components: [retryRow] }).catch(() => {});
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

  await interaction.editReply({ embeds: [embed], components: [rankMenu, saveRow] }).catch(() => {});
}

module.exports = {
  handleButtonInteraction,
  renderChannelSelectionPanel,
  renderChefsSelectionPanel,
  renderRoleCustomizationPanel
};