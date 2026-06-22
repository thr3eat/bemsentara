const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const User = require("../../models/User");
const { saveStoreNow } = require("../../models/Store");
const {
  GUILD2_ID,
  EKOYILDIZ_YAZMA_ENGELI_ROLE_ID,
  EKOYILDIZ_FOTO_ENGELI_ROLE_ID,
  EKOYILDIZ_MOD_LOG_CHANNEL_ID,
} = require("../../config");
const { recordModAction } = require("./modReportTracker");

// ── Yetki Kontrolü ─────────────────────────────────────────────────────────────
/** Sadece bu role sahip kişiler /modislem kullanabilir */
const MODISLEM_ROLE_ID = "1518692389169135666";
/** Çok ağır cezalar için onay kanalı */
const MODISLEM_ONAY_CHANNEL_ID = "1511411777521455256";

// ── Bekleyen onay işlemleri (in-memory) ────────────────────────────────────────
const pendingActions = new Map();

// ── 25 Moderasyon Sebebi ────────────────────────────────────────────────────────
// severity: hafif | orta | agir | cok_agir
// penalties: Array<"mute"|"yazma_engeli"|"foto_engeli"|"ban">
// muteDuration: ms (sadece mute varsa)
// restrictDuration: ms (yazma/foto engeli süresi, 0 ise kalıcı)
const MOD_REASONS = {
  KUFUR: {
    label: "Küfür / Hakaret",
    severity: "orta",
    penalties: ["mute"],
    muteDuration: 30 * 60 * 1000,      // 30 dk
    emoji: "🤬",
    color: 0xe67e22,
  },
  AGIR_KUFUR: {
    label: "Ağır Küfür",
    severity: "agir",
    penalties: ["mute"],
    muteDuration: 2 * 60 * 60 * 1000,  // 2 saat
    emoji: "🤬",
    color: 0xe74c3c,
  },
  IRKCILIK: {
    label: "Irkçılık / Nefret Söylemi",
    severity: "cok_agir",
    penalties: ["mute"],
    muteDuration: 7 * 24 * 60 * 60 * 1000, // 7 gün
    emoji: "🚫",
    color: 0xed4245,
  },
  NSFW: {
    label: "Cinsel İçerik / NSFW",
    severity: "cok_agir",
    penalties: ["mute", "foto_engeli"],
    muteDuration: 7 * 24 * 60 * 60 * 1000, // 7 gün
    restrictDuration: 7 * 24 * 60 * 60 * 1000,
    emoji: "🔞",
    color: 0xed4245,
  },
  SPAM: {
    label: "Spam / Flood",
    severity: "orta",
    penalties: ["mute", "yazma_engeli"],
    muteDuration: 30 * 60 * 1000,      // 30 dk
    restrictDuration: 60 * 60 * 1000,   // 1 saat
    emoji: "📨",
    color: 0xe67e22,
  },
  REKLAM: {
    label: "Reklam / Tanıtım",
    severity: "agir",
    penalties: ["mute"],
    muteDuration: 2 * 60 * 60 * 1000,  // 2 saat
    emoji: "📢",
    color: 0xe74c3c,
  },
  KISISEL_BILGI: {
    label: "Kişisel Bilgi Paylaşma",
    severity: "cok_agir",
    penalties: ["ban"],
    emoji: "🔒",
    color: 0xed4245,
  },
  TEHDIT: {
    label: "Tehdit / Şiddet",
    severity: "cok_agir",
    penalties: ["mute"],
    muteDuration: 7 * 24 * 60 * 60 * 1000,
    emoji: "⚔️",
    color: 0xed4245,
  },
  TROLLEME: {
    label: "Trolleme / Provokasyon",
    severity: "orta",
    penalties: ["mute"],
    muteDuration: 30 * 60 * 1000,
    emoji: "🎭",
    color: 0xe67e22,
  },
  BUYUKHARF: {
    label: "Büyük Harf Spam",
    severity: "hafif",
    penalties: ["mute"],
    muteDuration: 10 * 60 * 1000,      // 10 dk
    emoji: "🔤",
    color: 0xf1c40f,
  },
  EMOJI_SPAM: {
    label: "Emoji / Sticker Spam",
    severity: "hafif",
    penalties: ["mute"],
    muteDuration: 10 * 60 * 1000,
    emoji: "😂",
    color: 0xf1c40f,
  },
  YANLIS_KANAL: {
    label: "Yanlış Kanal Kullanımı",
    severity: "hafif",
    penalties: ["mute"],
    muteDuration: 10 * 60 * 1000,
    emoji: "📌",
    color: 0xf1c40f,
  },
  ALAY: {
    label: "Alay / Dalga Geçme",
    severity: "orta",
    penalties: ["mute"],
    muteDuration: 30 * 60 * 1000,
    emoji: "😏",
    color: 0xe67e22,
  },
  SAYGISIZLIK: {
    label: "Saygısızlık (Yetkililere)",
    severity: "agir",
    penalties: ["mute"],
    muteDuration: 2 * 60 * 60 * 1000,
    emoji: "🛡️",
    color: 0xe74c3c,
  },
  YALAN: {
    label: "Sahte Bilgi / Yalan",
    severity: "orta",
    penalties: ["mute"],
    muteDuration: 30 * 60 * 1000,
    emoji: "🤥",
    color: 0xe67e22,
  },
  SES_RAHATSIZLIK: {
    label: "Sesli Kanalda Rahatsızlık",
    severity: "orta",
    penalties: ["mute"],
    muteDuration: 30 * 60 * 1000,
    emoji: "🔊",
    color: 0xe67e22,
  },
  UYGUNSUZ_PROFIL: {
    label: "Uygunsuz Profil / Fotoğraf",
    severity: "agir",
    penalties: ["foto_engeli"],
    restrictDuration: 7 * 24 * 60 * 60 * 1000, // 7 gün
    emoji: "🖼️",
    color: 0xe74c3c,
  },
  LINK_PAYLASMA: {
    label: "Link Paylaşma (İzinsiz)",
    severity: "orta",
    penalties: ["mute", "yazma_engeli"],
    muteDuration: 30 * 60 * 1000,
    restrictDuration: 60 * 60 * 1000,
    emoji: "🔗",
    color: 0xe67e22,
  },
  ALT_HESAP: {
    label: "Alt Hesap / Yan Hesap",
    severity: "cok_agir",
    penalties: ["ban"],
    emoji: "👥",
    color: 0xed4245,
  },
  DM_RAHATSIZLIK: {
    label: "DM Rahatsızlık",
    severity: "agir",
    penalties: ["mute"],
    muteDuration: 2 * 60 * 60 * 1000,
    emoji: "✉️",
    color: 0xe74c3c,
  },
  MOD_ITIRAZ: {
    label: "Moderatör Kararına İtiraz",
    severity: "orta",
    penalties: ["mute"],
    muteDuration: 30 * 60 * 1000,
    emoji: "⚖️",
    color: 0xe67e22,
  },
  KANAL_KURALLARI: {
    label: "Kanal Kurallarını İhlal",
    severity: "hafif",
    penalties: ["mute"],
    muteDuration: 10 * 60 * 1000,
    emoji: "📋",
    color: 0xf1c40f,
  },
  KISKIRTMA: {
    label: "Tartışma Başlatma / Kışkırtma",
    severity: "orta",
    penalties: ["mute"],
    muteDuration: 30 * 60 * 1000,
    emoji: "🔥",
    color: 0xe67e22,
  },
  TEKRAR_IHLAL: {
    label: "Tekrarlayan İhlal",
    severity: "agir",
    penalties: ["mute"],
    muteDuration: 24 * 60 * 60 * 1000, // 1 gün
    emoji: "🔄",
    color: 0xe74c3c,
  },
  DOLANDIRICILIK: {
    label: "Dolandırıcılık / Scam",
    severity: "cok_agir",
    penalties: ["ban"],
    emoji: "💀",
    color: 0xed4245,
  },
};

// ── Ağırlık seviyesi etiketleri ─────────────────────────────────────────────────
const SEVERITY_LABELS = {
  hafif:    "🟢 Hafif",
  orta:     "🟡 Orta",
  agir:     "🟠 Ağır",
  cok_agir: "🔴 Çok Ağır",
};

// ── Süreyi okunabilir formata çevir ────────────────────────────────────────────
function formatDuration(ms) {
  if (!ms || ms <= 0) return "Kalıcı";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} dakika`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat`;
  const days = Math.floor(hours / 24);
  return `${days} gün`;
}

// ── Ceza açıklama listesi oluştur ───────────────────────────────────────────────
function describePenalties(reason) {
  const parts = [];
  if (reason.penalties.includes("mute") && reason.muteDuration) {
    parts.push(`🔇 Mute (${formatDuration(reason.muteDuration)})`);
  }
  if (reason.penalties.includes("yazma_engeli")) {
    parts.push(`✏️ Yazma Engeli (${formatDuration(reason.restrictDuration)})`);
  }
  if (reason.penalties.includes("foto_engeli")) {
    parts.push(`🖼️ Fotoğraf Engeli (${formatDuration(reason.restrictDuration)})`);
  }
  if (reason.penalties.includes("ban")) {
    parts.push("🚫 Sunucudan Yasaklama (Ban)");
  }
  return parts;
}

// ── Ana işlem fonksiyonu ─────────────────────────────────────────────────────────
async function executeModAction(interaction, targetUser, reasonKey, kanitAttachment) {
  const reason = MOD_REASONS[reasonKey];
  if (!reason) {
    return interaction.editReply({ content: "❌ Geçersiz sebep." });
  }

  const guild = interaction.guild;

  // ── Rol kontrolü: Sadece belirtilen role sahip kişiler kullanabilir ──────────
  if (!interaction.member.roles.cache.has(MODISLEM_ROLE_ID)) {
    return interaction.editReply({ content: "❌ Bu komutu kullanma yetkiniz yok." });
  }

  const member = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    return interaction.editReply({ content: "❌ Kullanıcı sunucuda bulunamadı." });
  }

  // Kendine veya bota ceza veremez
  if (targetUser.id === interaction.user.id) {
    return interaction.editReply({ content: "❌ Kendinize ceza veremezsiniz." });
  }
  if (targetUser.bot) {
    return interaction.editReply({ content: "❌ Bot kullanıcılara ceza verilemez." });
  }

  // ── Çok Ağır cezalar için onay sistemi ─────────────────────────────────────
  if (reason.severity === "cok_agir") {
    return sendApprovalRequest(interaction, targetUser, reasonKey, reason, kanitAttachment);
  }

  // ── Hafif / Orta / Ağır cezalar: direkt uygula ────────────────────────
  const result = await applyPenalties(interaction, guild, member, targetUser, reasonKey, reason, kanitAttachment);

  // ── Rapor Takip: Otomatik logla (/modislem komutuyla yapıldı) ──────────
  recordModAction(interaction.user.id, 'modislem', targetUser.id, targetUser.tag, `Sebep: ${reason.label}`, true);

  return result;
}

// ── Çok Ağır cezalar için onay isteği gönder ─────────────────────────────────
async function sendApprovalRequest(interaction, targetUser, reasonKey, reason, kanitAttachment) {
  const guild = interaction.guild;
  const onayChannel = await guild.channels.fetch(MODISLEM_ONAY_CHANNEL_ID).catch(() => null);

  if (!onayChannel || !onayChannel.isSendable()) {
    return interaction.editReply({ content: "❌ Onay kanalı bulunamadı veya mesaj gönderilemedi." });
  }

  // Benzersiz işlem ID'si
  const actionId = `modact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Uygulanacak ceza listesi
  const penaltyDescriptions = describePenalties(reason);

  const approvalEmbed = new EmbedBuilder()
    .setTitle(`🔴 Çok Ağır Mod İşlem Onayı Bekleniyor`)
    .setColor(0xed4245)
    .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "👤 Hedef Kullanıcı", value: `${targetUser.toString()}\n\`${targetUser.tag}\` (\`${targetUser.id}\`)`, inline: true },
      { name: "🛡️ İşlemi Yapan Yetkili", value: `${interaction.user.toString()}\n\`${interaction.user.tag}\``, inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: `${reason.emoji} Sebep`, value: reason.label, inline: true },
      { name: "⚖️ Ağırlık", value: SEVERITY_LABELS[reason.severity], inline: true },
      { name: "\u200b", value: "\u200b", inline: true },
      { name: "🔨 Uygulanacak Cezalar", value: penaltyDescriptions.join("\n"), inline: false }
    )
    .setFooter({ text: `İşlem ID: ${actionId}` })
    .setTimestamp();

  // Kanıt varsa embed'e ekle
  if (kanitAttachment) {
    approvalEmbed.addFields({ name: "📸 Kanıt", value: `[Kanıt Görüntüsü](${kanitAttachment.url})`, inline: false });
    approvalEmbed.setImage(kanitAttachment.url);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`modact_approve_${actionId}`)
      .setLabel("✅ Onayla")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`modact_reject_${actionId}`)
      .setLabel("❌ Reddet")
      .setStyle(ButtonStyle.Danger)
  );

  await onayChannel.send({ embeds: [approvalEmbed], components: [row] });

  // Bekleyen işlemi kaydet
  pendingActions.set(actionId, {
    targetUserId: targetUser.id,
    targetUserTag: targetUser.tag,
    moderatorId: interaction.user.id,
    moderatorTag: interaction.user.tag,
    reasonKey,
    guildId: guild.id,
    kanitUrl: kanitAttachment?.url || null,
    createdAt: Date.now(),
  });

  // 24 saat sonra otomatik sil (temizlik)
  setTimeout(() => {
    pendingActions.delete(actionId);
  }, 24 * 60 * 60 * 1000);

  return interaction.editReply({
    content: `⏳ **Çok ağır ceza** olduğu için onay kanalına istek gönderildi.\nYetkili onay verdikten sonra ceza uygulanacak.`,
  });
}

// ── Onay butonu handler'ı ────────────────────────────────────────────────────
async function handleModActionApproval(interaction) {
  const customId = interaction.customId;
  const isApprove = customId.startsWith("modact_approve_");
  const actionId = customId.replace("modact_approve_", "").replace("modact_reject_", "");

  const pending = pendingActions.get(actionId);
  if (!pending) {
    return interaction.reply({ content: "❌ Bu işlem bulunamadı veya süresi dolmuş.", ephemeral: true });
  }

  const reason = MOD_REASONS[pending.reasonKey];
  if (!reason) {
    pendingActions.delete(actionId);
    return interaction.reply({ content: "❌ Sebep tanımı bulunamadı.", ephemeral: true });
  }

  if (isApprove) {
    // Cezayı uygula
    const guild = interaction.guild || await interaction.client.guilds.fetch(pending.guildId).catch(() => null);
    if (!guild) {
      return interaction.reply({ content: "❌ Sunucu bulunamadı.", ephemeral: true });
    }

    const member = await guild.members.fetch(pending.targetUserId).catch(() => null);
    const targetUser = await interaction.client.users.fetch(pending.targetUserId).catch(() => null);

    if (!member && !reason.penalties.includes("ban")) {
      pendingActions.delete(actionId);
      return interaction.reply({ content: "❌ Kullanıcı artık sunucuda değil.", ephemeral: true });
    }

    // Cezaları uygula
    const appliedPenalties = [];
    const errors = [];

    // Mute
    if (reason.penalties.includes("mute") && reason.muteDuration && member) {
      try {
        if (member.moderatable) {
          await member.timeout(reason.muteDuration, `Mod İşlem (Onaylandı): ${reason.label} — Yetkili: ${pending.moderatorTag}, Onaylayan: ${interaction.user.tag}`);
          appliedPenalties.push(`🔇 Mute (${formatDuration(reason.muteDuration)})`);
        } else {
          errors.push("Mute uygulanamadı (yetersiz yetki)");
        }
      } catch (err) {
        errors.push(`Mute hatası: ${err.message}`);
      }
    }

    // Yazma Engeli
    if (reason.penalties.includes("yazma_engeli") && EKOYILDIZ_YAZMA_ENGELI_ROLE_ID && member) {
      try {
        const role = guild.roles.cache.get(EKOYILDIZ_YAZMA_ENGELI_ROLE_ID);
        if (role) {
          await member.roles.add(role, `Mod İşlem: ${reason.label}`);
          appliedPenalties.push(`✏️ Yazma Engeli (${formatDuration(reason.restrictDuration)})`);
          if (reason.restrictDuration && reason.restrictDuration > 0) {
            setTimeout(async () => {
              try {
                const rm = await guild.members.fetch(pending.targetUserId).catch(() => null);
                if (rm && rm.roles.cache.has(EKOYILDIZ_YAZMA_ENGELI_ROLE_ID)) {
                  await rm.roles.remove(role, "Yazma engeli süresi doldu");
                }
              } catch (_) {}
            }, reason.restrictDuration);
          }
        } else {
          errors.push("Yazma engeli rolü bulunamadı");
        }
      } catch (err) {
        errors.push(`Yazma engeli hatası: ${err.message}`);
      }
    }

    // Fotoğraf Engeli
    if (reason.penalties.includes("foto_engeli") && EKOYILDIZ_FOTO_ENGELI_ROLE_ID && member) {
      try {
        const role = guild.roles.cache.get(EKOYILDIZ_FOTO_ENGELI_ROLE_ID);
        if (role) {
          await member.roles.add(role, `Mod İşlem: ${reason.label}`);
          appliedPenalties.push(`🖼️ Fotoğraf Engeli (${formatDuration(reason.restrictDuration)})`);
          if (reason.restrictDuration && reason.restrictDuration > 0) {
            setTimeout(async () => {
              try {
                const rm = await guild.members.fetch(pending.targetUserId).catch(() => null);
                if (rm && rm.roles.cache.has(EKOYILDIZ_FOTO_ENGELI_ROLE_ID)) {
                  await rm.roles.remove(role, "Fotoğraf engeli süresi doldu");
                }
              } catch (_) {}
            }, reason.restrictDuration);
          }
        } else {
          errors.push("Fotoğraf engeli rolü bulunamadı");
        }
      } catch (err) {
        errors.push(`Fotoğraf engeli hatası: ${err.message}`);
      }
    }

    // Ban
    if (reason.penalties.includes("ban")) {
      try {
        if (member && member.bannable) {
          await member.ban({ reason: `Mod İşlem (Onaylandı): ${reason.label} — Yetkili: ${pending.moderatorTag}, Onaylayan: ${interaction.user.tag}` });
          appliedPenalties.push("🚫 Sunucudan Yasaklandı (Ban)");
        } else if (!member) {
          // Kullanıcı sunucuda değilse ID ile banla
          await guild.members.ban(pending.targetUserId, { reason: `Mod İşlem (Onaylandı): ${reason.label}` });
          appliedPenalties.push("🚫 Sunucudan Yasaklandı (Ban)");
        } else {
          errors.push("Ban uygulanamadı (yetersiz yetki)");
        }
      } catch (err) {
        errors.push(`Ban hatası: ${err.message}`);
      }
    }

    // DB kayıt
    try {
      let dbUser = await User.findOne({ discordId: pending.targetUserId });
      if (!dbUser) {
        dbUser = await User.create({ discordId: pending.targetUserId, discordUsername: pending.targetUserTag });
      }
      if (!dbUser.modActions) dbUser.modActions = [];
      dbUser.modActions.push({
        reason: reason.label,
        reasonKey: pending.reasonKey,
        severity: reason.severity,
        penalties: appliedPenalties,
        moderator: pending.moderatorId,
        moderatorTag: pending.moderatorTag,
        approvedBy: interaction.user.id,
        approvedByTag: interaction.user.tag,
        date: new Date().toISOString(),
      });
      await dbUser.save();
      saveStoreNow();
    } catch (err) {
      console.error("[modAction] DB kayıt hatası:", err.message);
    }

    // DM bildirim (ban hariç)
    if (!reason.penalties.includes("ban") && targetUser) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle(`${reason.emoji} Moderasyon İşlemi`)
          .setColor(reason.color)
          .setDescription(
            `**${guild.name}** sunucusunda bir moderatör tarafından cezalandırıldınız.\n\n` +
            `**Sebep:** ${reason.label}\n` +
            `**Ağırlık:** ${SEVERITY_LABELS[reason.severity]}\n\n` +
            `**Uygulanan Cezalar:**\n${appliedPenalties.map(p => `• ${p}`).join("\n") || "Hiçbir ceza uygulanamadı"}`
          )
          .setFooter({ text: "Lütfen sunucu kurallarına dikkat ediniz." })
          .setTimestamp();
        await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch (_) {}
    }

    // Log kanalına gönder
    if (EKOYILDIZ_MOD_LOG_CHANNEL_ID) {
      try {
        const logChannel = await guild.channels.fetch(EKOYILDIZ_MOD_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel && logChannel.isSendable()) {
          const logEmbed = new EmbedBuilder()
            .setTitle(`${reason.emoji} Mod İşlem — ${reason.label} (Onaylandı)`)
            .setColor(reason.color)
            .setThumbnail(targetUser?.displayAvatarURL({ size: 128 }) || null)
            .addFields(
              { name: "👤 Kullanıcı", value: `<@${pending.targetUserId}>\n\`${pending.targetUserId}\``, inline: true },
              { name: "🛡️ Yetkili", value: `<@${pending.moderatorId}>\n\`${pending.moderatorId}\``, inline: true },
              { name: "✅ Onaylayan", value: `${interaction.user.toString()}\n\`${interaction.user.id}\``, inline: true },
              { name: "📋 Sebep", value: reason.label, inline: true },
              { name: "⚖️ Ağırlık", value: SEVERITY_LABELS[reason.severity], inline: true },
              { name: "🔨 Uygulanan Cezalar", value: appliedPenalties.join("\n") || "Ceza uygulanamadı", inline: false }
            )
            .setFooter({ text: "EkoYıldız Moderasyon Sistemi" })
            .setTimestamp();

          if (pending.kanitUrl) {
            logEmbed.setImage(pending.kanitUrl);
          }
          if (errors.length > 0) {
            logEmbed.addFields({ name: "⚠️ Hatalar", value: errors.join("\n"), inline: false });
          }
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (_) {}
    }

    // Onay embed'ini güncelle (butonları kaldır)
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setTitle(`✅ Mod İşlem Onaylandı`)
      .setColor(0x57F287)
      .addFields({ name: "✅ Onaylayan", value: `${interaction.user.toString()} (\`${interaction.user.tag}\`)`, inline: false });

    await interaction.update({ embeds: [updatedEmbed], components: [] });

    pendingActions.delete(actionId);

    // ── Rapor Takip: Otomatik logla (onaylanmış /modislem) ──────────────
    recordModAction(pending.moderatorId, 'modislem', pending.targetUserId, pending.targetUserTag, `Sebep: ${reason.label} (Onaylayan: ${interaction.user.tag})`, true);

    return;
  } else {
    // Reddedildi
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setTitle(`❌ Mod İşlem Reddedildi`)
      .setColor(0x95a5a6)
      .addFields({ name: "❌ Reddeden", value: `${interaction.user.toString()} (\`${interaction.user.tag}\`)`, inline: false });

    await interaction.update({ embeds: [updatedEmbed], components: [] });

    // İşlemi yapan moderatöre DM ile bildir
    try {
      const moderator = await interaction.client.users.fetch(pending.moderatorId).catch(() => null);
      if (moderator) {
        const rejectEmbed = new EmbedBuilder()
          .setTitle("❌ Mod İşleminiz Reddedildi")
          .setColor(0x95a5a6)
          .setDescription(
            `**Hedef:** \`${pending.targetUserTag}\`\n` +
            `**Sebep:** ${reason.label}\n` +
            `**Reddeden:** ${interaction.user.tag}`
          )
          .setTimestamp();
        await moderator.send({ embeds: [rejectEmbed] }).catch(() => {});
      }
    } catch (_) {}

    pendingActions.delete(actionId);
    return;
  }
}

// ── Hafif/Orta/Ağır cezalar: direkt uygula ──────────────────────────────────
async function applyPenalties(interaction, guild, member, targetUser, reasonKey, reason, kanitAttachment) {
  const appliedPenalties = [];
  const errors = [];

  // Mute
  if (reason.penalties.includes("mute") && reason.muteDuration) {
    try {
      if (member.moderatable) {
        await member.timeout(reason.muteDuration, `Mod İşlem: ${reason.label} — Yetkili: ${interaction.user.tag}`);
        appliedPenalties.push(`🔇 Mute (${formatDuration(reason.muteDuration)})`);
      } else {
        errors.push("Mute uygulanamadı (yetersiz yetki)");
      }
    } catch (err) {
      console.error(`[modAction] Mute hatası:`, err.message);
      errors.push(`Mute hatası: ${err.message}`);
    }
  }

  // Yazma Engeli
  if (reason.penalties.includes("yazma_engeli") && EKOYILDIZ_YAZMA_ENGELI_ROLE_ID) {
    try {
      const role = guild.roles.cache.get(EKOYILDIZ_YAZMA_ENGELI_ROLE_ID);
      if (role) {
        await member.roles.add(role, `Mod İşlem: ${reason.label}`);
        appliedPenalties.push(`✏️ Yazma Engeli (${formatDuration(reason.restrictDuration)})`);
        if (reason.restrictDuration && reason.restrictDuration > 0) {
          setTimeout(async () => {
            try {
              const rm = await guild.members.fetch(targetUser.id).catch(() => null);
              if (rm && rm.roles.cache.has(EKOYILDIZ_YAZMA_ENGELI_ROLE_ID)) {
                await rm.roles.remove(role, "Yazma engeli süresi doldu");
              }
            } catch (_) {}
          }, reason.restrictDuration);
        }
      } else {
        errors.push("Yazma engeli rolü bulunamadı");
      }
    } catch (err) {
      console.error(`[modAction] Yazma engeli hatası:`, err.message);
      errors.push(`Yazma engeli hatası: ${err.message}`);
    }
  }

  // Fotoğraf Engeli
  if (reason.penalties.includes("foto_engeli") && EKOYILDIZ_FOTO_ENGELI_ROLE_ID) {
    try {
      const role = guild.roles.cache.get(EKOYILDIZ_FOTO_ENGELI_ROLE_ID);
      if (role) {
        await member.roles.add(role, `Mod İşlem: ${reason.label}`);
        appliedPenalties.push(`🖼️ Fotoğraf Engeli (${formatDuration(reason.restrictDuration)})`);
        if (reason.restrictDuration && reason.restrictDuration > 0) {
          setTimeout(async () => {
            try {
              const rm = await guild.members.fetch(targetUser.id).catch(() => null);
              if (rm && rm.roles.cache.has(EKOYILDIZ_FOTO_ENGELI_ROLE_ID)) {
                await rm.roles.remove(role, "Fotoğraf engeli süresi doldu");
              }
            } catch (_) {}
          }, reason.restrictDuration);
        }
      } else {
        errors.push("Fotoğraf engeli rolü bulunamadı");
      }
    } catch (err) {
      console.error(`[modAction] Fotoğraf engeli hatası:`, err.message);
      errors.push(`Fotoğraf engeli hatası: ${err.message}`);
    }
  }

  // Ban (hafif/orta/ağır'da normalde yok ama güvenlik için)
  if (reason.penalties.includes("ban")) {
    try {
      if (member.bannable) {
        await member.ban({ reason: `Mod İşlem: ${reason.label} — Yetkili: ${interaction.user.tag}` });
        appliedPenalties.push("🚫 Sunucudan Yasaklandı (Ban)");
      } else {
        errors.push("Ban uygulanamadı (yetersiz yetki)");
      }
    } catch (err) {
      console.error(`[modAction] Ban hatası:`, err.message);
      errors.push(`Ban hatası: ${err.message}`);
    }
  }

  // DB kayıt
  try {
    let dbUser = await User.findOne({ discordId: targetUser.id });
    if (!dbUser) {
      dbUser = await User.create({ discordId: targetUser.id, discordUsername: targetUser.username });
    }
    if (!dbUser.modActions) dbUser.modActions = [];
    dbUser.modActions.push({
      reason: reason.label,
      reasonKey,
      severity: reason.severity,
      penalties: appliedPenalties,
      moderator: interaction.user.id,
      moderatorTag: interaction.user.tag,
      date: new Date().toISOString(),
    });
    await dbUser.save();
    saveStoreNow();
  } catch (err) {
    console.error("[modAction] DB kayıt hatası:", err.message);
  }

  // Kullanıcıya DM
  if (!reason.penalties.includes("ban")) {
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`${reason.emoji} Moderasyon İşlemi`)
        .setColor(reason.color)
        .setDescription(
          `**${guild.name}** sunucusunda bir moderatör tarafından cezalandırıldınız.\n\n` +
          `**Sebep:** ${reason.label}\n` +
          `**Ağırlık:** ${SEVERITY_LABELS[reason.severity]}\n\n` +
          `**Uygulanan Cezalar:**\n${appliedPenalties.map(p => `• ${p}`).join("\n") || "Hiçbir ceza uygulanamadı"}`
        )
        .setFooter({ text: "Lütfen sunucu kurallarına dikkat ediniz." })
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (_) {}
  }

  // Log kanalına embed
  if (EKOYILDIZ_MOD_LOG_CHANNEL_ID) {
    try {
      const logChannel = await guild.channels.fetch(EKOYILDIZ_MOD_LOG_CHANNEL_ID).catch(() => null);
      if (logChannel && logChannel.isSendable()) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`${reason.emoji} Mod İşlem — ${reason.label}`)
          .setColor(reason.color)
          .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
          .addFields(
            { name: "👤 Kullanıcı", value: `${targetUser.toString()}\n\`${targetUser.id}\``, inline: true },
            { name: "🛡️ Yetkili", value: `${interaction.user.toString()}\n\`${interaction.user.id}\``, inline: true },
            { name: "📋 Sebep", value: reason.label, inline: true },
            { name: "⚖️ Ağırlık", value: SEVERITY_LABELS[reason.severity], inline: true },
            { name: "🔨 Uygulanan Cezalar", value: appliedPenalties.join("\n") || "Ceza uygulanamadı", inline: false }
          )
          .setFooter({ text: "EkoYıldız Moderasyon Sistemi" })
          .setTimestamp();

        if (kanitAttachment) {
          logEmbed.setImage(kanitAttachment.url);
        }
        if (errors.length > 0) {
          logEmbed.addFields({ name: "⚠️ Hatalar", value: errors.join("\n"), inline: false });
        }
        await logChannel.send({ embeds: [logEmbed] });
      }
    } catch (err) {
      console.error("[modAction] Log gönderme hatası:", err.message);
    }
  }

  // Yetkili'ye yanıt
  const responseEmbed = new EmbedBuilder()
    .setTitle(`${reason.emoji} Mod İşlem Uygulandı`)
    .setColor(reason.color)
    .addFields(
      { name: "👤 Kullanıcı", value: targetUser.toString(), inline: true },
      { name: "📋 Sebep", value: reason.label, inline: true },
      { name: "⚖️ Ağırlık", value: SEVERITY_LABELS[reason.severity], inline: true },
      { name: "🔨 Uygulanan Cezalar", value: appliedPenalties.join("\n") || "Ceza uygulanamadı", inline: false }
    )
    .setTimestamp();

  if (errors.length > 0) {
    responseEmbed.addFields({ name: "⚠️ Uyarılar", value: errors.join("\n"), inline: false });
  }

  return interaction.editReply({ embeds: [responseEmbed] });
}

module.exports = { executeModAction, handleModActionApproval, MOD_REASONS };
