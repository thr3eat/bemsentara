const {
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Ticket = require("../../models/Ticket");
const { generateTicketId } = require("../../utils/ticketId");
const { SUPPORT_CATEGORIES, TARGET_GUILD_ID, TARGET_CHANNEL_ID, GUILD2_ID, GUILD2_TICKET_CATEGORY_ID, GUILD2_TICKET_LOG_ID } = require("../../config");
const {
  buildTicketEmbed,
  buildCloseButton,
  buildReopenAndRateRow,
} = require("../embeds");

async function handleModalSubmit(interaction) {
  // ── Ticket oluşturma modal'ı ─────────────────────────────────────────────
  if (interaction.customId.startsWith("support_modal_")) {
    return handleSupportModal(interaction);
  }

  // ── Ticket kapatma sebebi modal'ı ────────────────────────────────────────
  if (interaction.customId.startsWith("close_reason_modal_")) {
    return handleCloseReasonModal(interaction);
  }

  // ── Değerlendirme modal'ı ────────────────────────────────────────────────
  if (interaction.customId.startsWith("rating_modal_")) {
    return handleRatingModal(interaction);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Yeni ticket oluşturma
// ─────────────────────────────────────────────────────────────────────────────
async function handleSupportModal(interaction) {
  const category = interaction.customId.replace("support_modal_", "");
  const subject = interaction.fields.getTextInputValue("support_subject");
  const description = interaction.fields.getTextInputValue("support_description");

  // ── YENİ STAJYER GÜVENLİK ──────────────────────────────────────────────────
  // Stajyer/yeni moderatörlerin abuse yapmasını engelle
  try {
    const { StaffProgress } = require('../services/staffSystem');
    const StaffModel = require('../../models/StaffProgress');
    
    const staff = await StaffModel.findOne({ userId: interaction.user.id });
    const joinedAt = staff?.joinedAt || new Date();
    const hoursWorked = (Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60);
    
    // Yeni stajyer (< 24 saat)
    if (hoursWorked < 24 && staff?.level === 1) {
      // Bugünkü ticket sayısını kontrol et
      const today = new Date().toISOString().split('T')[0];
      const todayTickets = await Ticket.find({
        userId: interaction.user.id,
        createdAt: { $gte: new Date(today) },
      });
      
      if (todayTickets.length >= 2) {
        await interaction.reply({
          content: `❌ **Stajyer Güvenlik:** Günde maksimum 2 ticket açabilirsin (açılmış: ${todayTickets.length}/2)\n\nSunucuyu spamdan korumak için bu kuralımız var. Lütfen sonra tekrar dene!`,
          ephemeral: true,
        });
        return;
      }
    }
  } catch (_) {
    // Kontrol başarısız olursa devam et (güvenlik basit tutal)
  }

  // Kategori bazlı otomatik öncelik
  const autoPriority = {
    ban:       'high',
    report:    'high',
    reklam:    'medium',
    billing:   'high',
    technical: 'medium',
    account:   'medium',
    genel:     'low',
    other:     'low',
  };
  const priority = autoPriority[category] || 'medium';

  try {
    const ticketId = generateTicketId();

    // Hangi sunucudan geldiğini belirle
    const sourceGuildId = interaction.guild?.id;
    const isGuild2 = sourceGuildId === GUILD2_ID;

    // Hedef sunucu: her zaman ticket'ın açıldığı sunucu
    const targetGuildId = isGuild2 ? GUILD2_ID : TARGET_GUILD_ID;
    const targetGuild = await interaction.client.guilds.fetch(targetGuildId);
    if (!targetGuild) throw new Error("Hedef sunucu bulunamadı.");

    let ticketChannel;
    const permissionOverwrites = [
      { id: targetGuild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      // ── Moderatörlerin ticket kanalını görebilmesi ────────────────────────
      {
        id: targetGuild.roles.cache.find(r => r.name.toLowerCase().includes('moderatör') || r.permissions.has('ManageMessages'))?.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ].filter(o => o.id); // Geçersiz ID'leri filtrele

    if (isGuild2) {
      // EKOYILDIZ: GUILD2_TICKET_CATEGORY_ID kategorisine aç
      ticketChannel = await targetGuild.channels.create({
        name: `ticket-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: GUILD2_TICKET_CATEGORY_ID || undefined,
        permissionOverwrites,
      });
    } else {
      // Ana sunucu: mevcut mantık
      const configuredChannel = TARGET_CHANNEL_ID
        ? await targetGuild.channels.fetch(TARGET_CHANNEL_ID).catch(() => null)
        : null;

      if (configuredChannel?.type === ChannelType.GuildCategory) {
        ticketChannel = await targetGuild.channels.create({
          name: `ticket-${ticketId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: configuredChannel.id,
          permissionOverwrites,
        });
      } else if (configuredChannel?.type === ChannelType.GuildText) {
        ticketChannel = await targetGuild.channels.create({
          name: `ticket-${ticketId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: configuredChannel.parentId,
          permissionOverwrites,
        });
      } else {
        let ticketCategory = targetGuild.channels.cache.find(
          (c) => c.name.toLowerCase() === "destek talepleri" && c.type === ChannelType.GuildCategory
        );
        if (!ticketCategory) {
          ticketCategory = await targetGuild.channels.create({
            name: "DESTEK TALEPLERİ",
            type: ChannelType.GuildCategory,
          });
        }
        ticketChannel = await targetGuild.channels.create({
          name: `ticket-${ticketId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: ticketCategory.id,
          permissionOverwrites,
        });
      }
    }

    const ticket = new Ticket({
      ticketId,
      userId: interaction.user.id,
      userName: interaction.user.username,
      category,
      subject,
      description,
      priority,
      channelId: ticketChannel.id,
      guildId: targetGuildId,
    });

    await ticket.save();

    const ticketEmbed = buildTicketEmbed(ticket);
    const closeButton = buildCloseButton(ticketId);
    await ticketChannel.send({ embeds: [ticketEmbed], components: [closeButton] });

    // ── AI karşılama konuşmasını başlat ──────────────────────────────────
    try {
      const { startAIConversation } = require('../services/ticketAI');
      await startAIConversation(ticketChannel, ticket, interaction.client);
    } catch (aiErr) {
      console.warn('[modal] AI başlatılamadı:', aiErr.message);
    }

    const { logTicketCreated } = require("../services/ticketLog");
    logTicketCreated(ticket, {
      source: "Discord Destek Menüsü",
      ticketChannelId: ticketChannel.id,
      guildId: targetGuildId,
    });

    return interaction.reply({ content: `✅ Ticket oluşturuldu: ${ticketChannel}`, ephemeral: true });
  } catch (err) {
    console.error("Ticket oluşturma hatası:", err);
    return interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticket kapatma sebebi işleme
// ─────────────────────────────────────────────────────────────────────────────
async function handleCloseReasonModal(interaction) {
  const ticketId = interaction.customId.replace("close_reason_modal_", "");
  const reason = interaction.fields.getTextInputValue("close_reason");

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
  }

  if (ticket.status === "closed") {
    return interaction.reply({ content: "❌ Bu ticket zaten kapalı", ephemeral: true });
  }

  // Ticket'ı kapat
  ticket.status = "closed";
  ticket.closedAt = new Date();
  ticket.closeReason = reason;
  ticket.closedBy = interaction.user.id;
  ticket.closedByName = interaction.user.username;
  await ticket.save();

  // AI durumunu temizle
  try {
    const { cleanupTicketAI } = require('../services/ticketAI');
    cleanupTicketAI(ticketId);
  } catch (_) {}

  // Personel istatistiği — ticket'ı kapatan yetkili ise kaydet
  try {
    const { recordTicketSolved, ROLES } = require('../services/staffSystem');
    const staffRoleIds = Object.values(ROLES).filter(id =>
      id && !['PERSONEL_ROLE_ID','GELISMIS_ROLE_ID','SEKRETER_ROLE_ID'].includes(id)
    );
    const member = interaction.member;
    if (member && staffRoleIds.some(rid => member.roles.cache.has(rid))) {
      await recordTicketSolved(interaction.user.id, interaction.client);
    }
  } catch (_) {}

  // Önce etkileşimi onayla
  await interaction.reply({ content: "✅ Ticket kapatılıyor...", ephemeral: true });

  try {
    // Ticket'ın hangi sunucuda olduğunu belirle
    const guildId = ticket.guildId || TARGET_GUILD_ID;
    const guild = await interaction.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);

    // 1) Kanal mesajlarını log kanalına gönder
    const { logTicketClosed, logTicketMessages } = require("../services/ticketLog");

    if (channel) {
      await logTicketMessages(channel, ticket);
    }

    // 2) Ticket kapanma kaydını log kanalına gönder
    logTicketClosed(ticket, {
      closedBy: interaction.user.id,
      closedByName: interaction.user.username,
      reason,
      source: "Discord Kapat Butonu",
    });

    // 3) Ticket sahibine DM gönder
    try {
      const ticketOwner = await interaction.client.users.fetch(ticket.userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🔒 Ticket'ınız Kapatıldı")
        .setDescription(
          `Ticket'ınız **${interaction.user.username}** adlı kişi tarafından kapatıldı.\n\n` +
            `**Sebep:** ${reason}\n\n` +
            `Ticket'ı yeniden açmak veya destek ekibini değerlendirmek için aşağıdaki butonları kullanabilirsiniz.`
        )
        .addFields(
          { name: "🎫 Ticket ID", value: `\`${ticket.ticketId}\``, inline: true },
          { name: "📋 Konu", value: ticket.subject, inline: true }
        )
        .setFooter({ text: "Sentara Support • Gizlilik politikamız gereği değerlendirme notunuz anonim tutulur." })
        .setTimestamp();

      const dmButtons = buildReopenAndRateRow(ticketId);
      await ticketOwner.send({ embeds: [dmEmbed], components: [dmButtons] });
    } catch (dmErr) {
      console.warn("[closeTicket] Kullanıcıya DM gönderilemedi:", dmErr.message);
    }

    // 4) Kanalı kapat (izinleri kaldır ve kapatıldı mesajı gönder)
    if (channel) {
      const closeEmbed = new EmbedBuilder()
        .setTitle("🔒 Ticket Kapatıldı")
        .setDescription(
          `**Kapatan:** ${interaction.user.username}\n**Sebep:** ${reason}\n\n` +
          `⏳ Bu kanal **5 dakika** içinde yeniden açılmazsa otomatik silinecektir.`
        )
        .setColor(0xed4245)
        .setTimestamp();

      await channel.send({ embeds: [closeEmbed] });
      await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: false,
        SendMessages: false,
      });
    }

    // 5) 5 dakika sonra kanal silinmek üzere kuyruğa al
    const { scheduleTicketDeletion } = require("../services/ticketCleanup");
    scheduleTicketDeletion(ticket.ticketId);

  } catch (err) {
    console.error("[closeTicket] Hata:", err);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Değerlendirme modal'ı işleme
// ─────────────────────────────────────────────────────────────────────────────
async function handleRatingModal(interaction) {
  const ticketId = interaction.customId.replace("rating_modal_", "");
  const rawScore = interaction.fields.getTextInputValue("rating_score").trim();
  const note = interaction.fields.getTextInputValue("rating_note").trim() || null;

  const score = parseInt(rawScore, 10);
  if (isNaN(score) || score < 1 || score > 5) {
    return interaction.reply({
      content: "❌ Geçersiz puan. Lütfen 1 ile 5 arasında bir sayı girin.",
      ephemeral: true,
    });
  }

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

  // Değerlendirmeyi kaydet
  ticket.rated = true;
  ticket.ratingScore = score;
  ticket.ratingNote = note;
  await ticket.save();

  // Ticket'ı üstlenen kişiye DM gönder + bakiye ver
  const staffId = ticket.claimedBy || ticket.closedBy;
  if (staffId) {
    // ── Bakiye ödülü: puan × 100 coin ──────────────────────────────────────
    try {
      const Economy = require("../../models/Economy");
      const { saveStoreNow } = require("../../models/Store");
      const COIN_PER_STAR = 100;
      const earned = score * COIN_PER_STAR;

      let eco = await Economy.findOne({ userId: staffId });
      if (!eco) {
        eco = new Economy({ userId: staffId });
      }
      eco.balance = (eco.balance || 0) + earned;
      eco.totalEarned = (eco.totalEarned || 0) + earned;
      await eco.save();
      saveStoreNow();
      console.log(`[rating] ${staffId} → +${earned} coin (${score} yıldız)`);
    } catch (ecoErr) {
      console.warn("[rating] Bakiye eklenemedi:", ecoErr.message);
    }

    try {
      const staffUser = await interaction.client.users.fetch(staffId);
      const stars = "⭐".repeat(score) + "☆".repeat(5 - score);
      const earned = score * 100;

      const ratingEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("⭐ Yeni Bir Değerlendirme Aldınız!")
        .setDescription(
          `**Ticket:** \`${ticket.ticketId}\`\n` +
            `**Konu:** ${ticket.subject}\n\n` +
            `**Puan:** ${stars} (${score}/5)\n` +
            `**Kazanılan:** 💰 +${earned} coin\n` +
            (note ? `**Değerlendirme Notu:** ${note}` : "")
        )
        .setFooter({
          text: "Sentara Support • Gizlilik politikamız gereği puan veren kişinin adı paylaşılmaz.",
        })
        .setTimestamp();

      await staffUser.send({ embeds: [ratingEmbed] });
    } catch (dmErr) {
      console.warn("[ratingModal] Personele DM gönderilemedi:", dmErr.message);
    }
  }

  // Kullanıcıya onay
  const stars = "⭐".repeat(score) + "☆".repeat(5 - score);
  return interaction.reply({
    content: `✅ Değerlendirmeniz alındı! ${stars} (${score}/5)\nTeşekkür ederiz.`,
    ephemeral: true,
  });
}

module.exports = { handleModalSubmit };
