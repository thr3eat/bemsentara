const noblox = require("noblox.js");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ROBLOX_GROUPS } = require("./robloxGroupManager");

// ─── Hedef Discord Kanalları ─────────────────────────────────────────────────
const AUDIT_LOG_CHANNEL_ID   = "1514682098819137727"; // Grup audit log kanalı
const ABUSE_ALERT_CHANNEL_ID = "1514684880867295233"; // Abuse şüphesi uyarı kanalı
const AUDIT_LOG_GUILD_ID     = "1483482948320891074"; // Müttefik Orduları sunucusu

// ─── Ayarlar ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS   = 3 * 60 * 1000; // Her 3 dakikada bir kontrol
const FETCH_LIMIT        = 25;            // Grup başına çekilecek maksimum kayıt
const ABUSE_WINDOW_MS    = 10 * 60 * 1000; // 10 dakika içinde 3+ değişim = şüpheli
const ABUSE_RAPID_COUNT  = 3;             // 10 dk içinde kaç değişiklik şüpheli sayılır
const ABUSE_HIGH_RANK    = 200;           // Bu değer ve üstü atama şüpheli
const ABUSE_OWNER_RANK   = 250;           // Bu değer ve üstü sahip seviyesi — her zaman şüpheli

// ─── Durum ───────────────────────────────────────────────────────────────────
const lastSeenTime = {};            // groupId → Date
const recentRankChanges = new Map(); // `${groupId}_${targetId}` → [Date, ...]
const sentAbuseAlerts   = new Set(); // `${groupId}_${targetId}_${isoCreated}` → tekrar göndermemek için

// ─── Eylem haritası ──────────────────────────────────────────────────────────
const ACTION_MAP = {
  // Üyelik
  "Accept Join Request":         { label: "Katılım İsteği Onaylandı",      emoji: "✅", color: 0x2ECC71, cat: "👥 Üyelik"   },
  "Decline Join Request":        { label: "Katılım İsteği Reddedildi",     emoji: "❌", color: 0xE74C3C, cat: "👥 Üyelik"   },
  "Kick User":                   { label: "Kullanıcı Gruptan Atıldı",      emoji: "🚪", color: 0xE74C3C, cat: "👥 Üyelik"   },
  // Rütbe
  "Change Rank":                 { label: "Rütbe Değiştirildi",            emoji: "🪖", color: 0x3498DB, cat: "🪖 Rütbe"    },
  "Add Role":                    { label: "Yeni Rütbe Oluşturuldu",        emoji: "➕", color: 0x2ECC71, cat: "🪖 Rütbe"    },
  "Delete Role":                 { label: "Rütbe Silindi",                 emoji: "🗑️", color: 0xE74C3C, cat: "🪖 Rütbe"    },
  "Change Rank Name":            { label: "Rütbe Adı Değiştirildi",        emoji: "✏️", color: 0x1ABC9C, cat: "🪖 Rütbe"    },
  "Change Rank Description":     { label: "Rütbe Açıklaması Değiştirildi",emoji: "📝", color: 0x1ABC9C, cat: "🪖 Rütbe"    },
  "Change Rank Rank":            { label: "Rütbe Seviyesi Değiştirildi",   emoji: "🔢", color: 0x3498DB, cat: "🪖 Rütbe"    },
  "Update Roleset Rank":         { label: "Rütbe Sırası Güncellendi",      emoji: "🔄", color: 0x3498DB, cat: "🪖 Rütbe"    },
  // Müttefiklik
  "Send Ally Request":           { label: "Müttefik İsteği Gönderildi",    emoji: "🤝", color: 0x9B59B6, cat: "🤝 Müttefik" },
  "Accept Ally Request":         { label: "Müttefik İsteği Kabul Edildi",  emoji: "✅", color: 0x2ECC71, cat: "🤝 Müttefik" },
  "Decline Ally Request":        { label: "Müttefik İsteği Reddedildi",    emoji: "❌", color: 0xE74C3C, cat: "🤝 Müttefik" },
  "Delete Ally":                 { label: "Müttefiklik Kaldırıldı",        emoji: "🗑️", color: 0xE74C3C, cat: "🤝 Müttefik" },
  // Ayarlar
  "Change Description":          { label: "Grup Açıklaması Değiştirildi",  emoji: "📝", color: 0x1ABC9C, cat: "⚙️ Ayarlar"  },
  "Post Status":                 { label: "Grup Durumu Yayınlandı",        emoji: "📢", color: 0x3498DB, cat: "⚙️ Ayarlar"  },
  "Delete Group Shout":          { label: "Grup Duyurusu Silindi",         emoji: "🗑️", color: 0xE74C3C, cat: "⚙️ Ayarlar"  },
  "Lock/Unlock Group Join":      { label: "Grup Katılım Kilidi Değişti",   emoji: "🔒", color: 0xF39C12, cat: "⚙️ Ayarlar"  },
  "Change Owner":                { label: "Grup Sahibi Değiştirildi",      emoji: "👑", color: 0xF1C40F, cat: "⚙️ Ayarlar"  },
  // Finans & İçerik
  "Spend Group Funds":           { label: "Grup Fonu Harcandı",            emoji: "💰", color: 0xF39C12, cat: "💰 Finans"   },
  "Create Items":                { label: "Öğe Oluşturuldu",               emoji: "✨", color: 0xF1C40F, cat: "🎨 İçerik"   },
  "Configure Items":             { label: "Öğe Yapılandırıldı",            emoji: "⚙️", color: 0x95A5A6, cat: "🎨 İçerik"   },
  "Add Group Place":             { label: "Grup Oyunu Eklendi",            emoji: "🏗️", color: 0x2ECC71, cat: "🎮 Oyunlar"  },
  "Remove Group Place":          { label: "Grup Oyunu Kaldırıldı",         emoji: "🗑️", color: 0xE74C3C, cat: "🎮 Oyunlar"  },
  "Create Group Asset":          { label: "Grup Varlığı Oluşturuldu",      emoji: "🖼️", color: 0x2ECC71, cat: "🎨 İçerik"   },
  "Configure Group Asset":       { label: "Grup Varlığı Güncellendi",      emoji: "✏️", color: 0x1ABC9C, cat: "🎨 İçerik"   },
  "Revert Group Asset":          { label: "Grup Varlığı Geri Alındı",      emoji: "↩️", color: 0xE74C3C, cat: "🎨 İçerik"   },
  "Configure Group Game":        { label: "Grup Oyunu Yapılandırıldı",     emoji: "🎮", color: 0x1ABC9C, cat: "🎮 Oyunlar"  },
  "Lock/Unlock Group Game":      { label: "Grup Oyunu Kilidi Değişti",     emoji: "🔒", color: 0xF39C12, cat: "🎮 Oyunlar"  },
};

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────
function rankColor(rankNum) {
  if (!rankNum)        return 0x95A5A6;
  if (rankNum >= 250)  return 0xF1C40F;
  if (rankNum >= 150)  return 0xE67E22;
  if (rankNum >= 100)  return 0x3498DB;
  if (rankNum >= 50)   return 0x2ECC71;
  return 0x95A5A6;
}
const rbxProfile = (id)  => id ? `https://www.roblox.com/users/${id}/profile` : null;
const rbxAvatar  = (id)  => id ? `https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=150&height=150&format=png` : null;
const rbxGroup   = (gid) => `https://www.roblox.com/communities/${gid}`;

// ─── Abuse tespit ─────────────────────────────────────────────────────────────
/**
 * Change Rank olayını abuse açısından değerlendirir.
 * @returns {string[]|null} Sebep listesi (boşsa null)
 */
function checkForAbuse(entry, groupId) {
  const d         = entry.description || {};
  const targetId  = d.TargetId;
  const newRank   = d.NewRoleSetRank ?? null;
  const oldRank   = d.OldRoleSetRank ?? null;

  if (!targetId || newRank == null) return null;

  const reasons = [];

  // 1. Sahip / üst yönetim seviyesi atama
  if (newRank >= ABUSE_OWNER_RANK) {
    reasons.push(`👑 Sahip seviyesine yakın rütbe atama → Rank **${newRank}** (${d.NewRoleSetName || "?"})`);
  } else if (newRank >= ABUSE_HIGH_RANK) {
    const from = oldRank != null ? `Rank ${oldRank}` : "bilinmeyen rütbe";
    reasons.push(`🚀 Düşük rütbeden (${from}) üst yönetime direkt atlama → Rank **${newRank}** (${d.NewRoleSetName || "?"})`);
  }

  // 2. Hızlı ardışık rütbe değişikliği (aynı hedef, aynı grup)
  const trackKey = `${groupId}_${targetId}`;
  if (!recentRankChanges.has(trackKey)) recentRankChanges.set(trackKey, []);
  const times = recentRankChanges.get(trackKey);
  const entryTime = new Date(entry.created).getTime();
  times.push(entryTime);

  // Pencere dışındakileri temizle
  const cutoff = entryTime - ABUSE_WINDOW_MS;
  const filtered = times.filter(t => t >= cutoff);
  recentRankChanges.set(trackKey, filtered);

  if (filtered.length >= ABUSE_RAPID_COUNT) {
    reasons.push(`⚡ 10 dakika içinde aynı kullanıcıya **${filtered.length}x** hızlı rütbe değişikliği`);
  }

  return reasons.length > 0 ? reasons : null;
}

/**
 * Abuse uyarısını yetkili kanalına gönderir.
 */
async function sendAbuseAlert(client, entry, groupId, groupName, reasons) {
  const alertKey = `${groupId}_${entry.description?.TargetId}_${entry.created}`;
  if (sentAbuseAlerts.has(alertKey)) return;
  sentAbuseAlerts.add(alertKey);

  let abuseChan = null;
  try {
    const guild = client.guilds.cache.get(AUDIT_LOG_GUILD_ID);
    if (!guild) return;
    abuseChan = guild.channels.cache.get(ABUSE_ALERT_CHANNEL_ID);
    if (!abuseChan || !abuseChan.isTextBased()) return;
  } catch (_) { return; }

  const d          = entry.description || {};
  const actor      = entry.actor?.user;
  const actorName  = actor?.username || "Bilinmeyen";
  const actorId    = actor?.userId || null;
  const actorRole  = entry.actor?.role;
  const targetId   = d.TargetId;
  const targetName = d.TargetName || "Bilinmeyen";
  const unixSec    = Math.floor(new Date(entry.created).getTime() / 1000);

  const embed = new EmbedBuilder()
    .setTitle("🚨 ABUSE ŞÜPHESİ TESPİT EDİLDİ")
    .setDescription(
      `Grup **${groupName}** içinde şüpheli rütbe işlemi tespit edildi.\n\n` +
      `**⚠️ Şüphelilik Sebepleri:**\n${reasons.map(r => `• ${r}`).join("\n")}`
    )
    .setColor(0xFF0000)
    .addFields(
      {
        name: "🏢 Grup",
        value: `[${groupName}](${rbxGroup(groupId)})\nID: \`${groupId}\``,
        inline: true
      },
      {
        name: "👤 İşlemi Yapan (Şüpheli Yetkili)",
        value: actorId
          ? `[${actorName}](${rbxProfile(actorId)})\nID: \`${actorId}\`${actorRole ? `\nRütbe: **${actorRole.name}** (Rank \`${actorRole.rank}\`)` : ""}`
          : actorName,
        inline: true
      },
      {
        name: "🎯 İşlem Yapılan Kullanıcı",
        value: targetId
          ? `[${targetName}](${rbxProfile(targetId)})\nID: \`${targetId}\``
          : targetName,
        inline: true
      },
      {
        name: "⏪ Eski Rütbe",
        value: d.OldRoleSetName ? `**${d.OldRoleSetName}** (Rank \`${d.OldRoleSetRank ?? "?"}\`)` : "—",
        inline: true
      },
      {
        name: "🆕 Atanan Rütbe",
        value: d.NewRoleSetName ? `**${d.NewRoleSetName}** (Rank \`${d.NewRoleSetRank ?? "?"}\`)` : "—",
        inline: true
      },
      {
        name: "🕐 Olay Zamanı",
        value: `<t:${unixSec}:F>\n(<t:${unixSec}:R>)`,
        inline: true
      }
    )
    .setThumbnail(rbxAvatar(targetId) || rbxAvatar(actorId))
    .setTimestamp()
    .setFooter({ text: "Roblox Abuse Tespit Sistemi", iconURL: client.user.displayAvatarURL() });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rbx_abuse_demote_${groupId}_${targetId}`)
      .setLabel("✅ EVET ÇEK — En Düşük Rütbeye İndir")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🚨"),
    new ButtonBuilder()
      .setCustomId(`rbx_abuse_ignore_${groupId}_${targetId}`)
      .setLabel("❌ Yoksay — Şüphe Yok")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🚫")
  );

  await abuseChan.send({ embeds: [embed], components: [row] }).catch(err =>
    console.error("[AbuseAlert] Gönderim hatası:", err.message)
  );

  console.log(`[AbuseAlert] 🚨 Abuse şüphesi: Grup ${groupId} (${groupName}) — Hedef: ${targetName} (${targetId})`);
}

// ─── Eylem türüne özgü embed alanları ────────────────────────────────────────
function applyActionFields(embed, entry, actionType) {
  const d = entry.description || {};

  switch (actionType) {
    case "Change Rank": {
      const newRankNum = d.NewRoleSetRank ?? null;
      embed.setColor(rankColor(newRankNum));
      if (d.TargetName || d.TargetId) {
        embed.addFields({
          name:  "🎯 Hedef Kullanıcı",
          value: d.TargetId
            ? `[${d.TargetName || "Bilinmeyen"}](${rbxProfile(d.TargetId)}) • ID: \`${d.TargetId}\``
            : `${d.TargetName || "Bilinmeyen"}`,
          inline: false
        });
        if (d.TargetId) embed.setThumbnail(rbxAvatar(d.TargetId));
      }
      embed.addFields(
        { name: "⏪ Eski Rütbe", value: d.OldRoleSetName ? `**${d.OldRoleSetName}**${d.OldRoleSetRank != null ? ` (Rank \`${d.OldRoleSetRank}\`)` : ""}` : "—", inline: true },
        { name: "🆕 Yeni Rütbe", value: d.NewRoleSetName ? `**${d.NewRoleSetName}**${d.NewRoleSetRank != null ? ` (Rank \`${d.NewRoleSetRank}\`)` : ""}` : "—", inline: true }
      );
      break;
    }
    case "Accept Join Request":
    case "Decline Join Request":
    case "Kick User": {
      if (d.TargetName || d.TargetId) {
        embed.addFields({
          name:  "🎯 Hedef Kullanıcı",
          value: d.TargetId
            ? `[${d.TargetName || "Bilinmeyen"}](${rbxProfile(d.TargetId)}) • ID: \`${d.TargetId}\``
            : `${d.TargetName || "Bilinmeyen"}`,
          inline: false
        });
        if (d.TargetId) embed.setThumbnail(rbxAvatar(d.TargetId));
      }
      break;
    }
    case "Add Role":
    case "Delete Role":
    case "Change Rank Name":
    case "Change Rank Description":
    case "Change Rank Rank":
    case "Update Roleset Rank": {
      const fields = [];
      if (d.RoleName)       fields.push({ name: "📛 Rütbe Adı",   value: `**${d.RoleName}**`,                   inline: true });
      if (d.OldName)        fields.push({ name: "⏪ Eski Ad",       value: `**${d.OldName}**`,                   inline: true });
      if (d.NewName)        fields.push({ name: "🆕 Yeni Ad",       value: `**${d.NewName}**`,                   inline: true });
      if (d.OldRank != null) fields.push({ name: "⏪ Eski Seviye",  value: `Rank \`${d.OldRank}\``,             inline: true });
      if (d.NewRank != null) fields.push({ name: "🆕 Yeni Seviye",  value: `Rank \`${d.NewRank}\``,             inline: true });
      if (d.Description)    fields.push({ name: "📝 Açıklama",     value: String(d.Description).slice(0, 300), inline: false });
      if (fields.length)    embed.addFields(...fields);
      break;
    }
    case "Send Ally Request":
    case "Accept Ally Request":
    case "Decline Ally Request":
    case "Delete Ally": {
      if (d.TargetGroupName || d.TargetGroupId) {
        embed.addFields({
          name:  "🤝 Hedef Grup",
          value: d.TargetGroupId
            ? `[${d.TargetGroupName || "Bilinmeyen"}](${rbxGroup(d.TargetGroupId)}) • ID: \`${d.TargetGroupId}\``
            : `${d.TargetGroupName || "Bilinmeyen"}`,
          inline: false
        });
      }
      break;
    }
    case "Spend Group Funds": {
      if (d.Amount)         embed.addFields({ name: "💰 Harcama",     value: `**${Number(d.Amount).toLocaleString()} Robux**`, inline: true });
      if (d.ItemDescription) embed.addFields({ name: "📦 Açıklama",   value: String(d.ItemDescription).slice(0, 200),         inline: false });
      break;
    }
    case "Post Status": {
      if (d.Status)         embed.addFields({ name: "📢 Yayınlanan Durum", value: `>>> ${String(d.Status).slice(0, 300)}`, inline: false });
      break;
    }
    case "Change Description": {
      if (d.NewDescription) embed.addFields({ name: "📝 Yeni Açıklama", value: `>>> ${String(d.NewDescription).slice(0, 300)}`, inline: false });
      break;
    }
    case "Change Owner": {
      if (d.OldOwner) embed.addFields({ name: "👤 Eski Sahip", value: `**${d.OldOwner}**`, inline: true });
      if (d.NewOwner) embed.addFields({ name: "👑 Yeni Sahip", value: `**${d.NewOwner}**`, inline: true });
      break;
    }
    default: {
      const rawLines = Object.entries(d)
        .filter(([, v]) => v !== null && v !== undefined && String(v).length > 0)
        .map(([k, v]) => `**${k}:** ${String(v).slice(0, 100)}`);
      if (rawLines.length > 0) {
        embed.addFields({ name: "📋 Ham Veriler", value: rawLines.join("\n").slice(0, 1024), inline: false });
      }
    }
  }
}

// ─── Tek grup polling ─────────────────────────────────────────────────────────
async function pollGroup(client, groupId, groupName, logChannel) {
  try {
    // noblox.getAuditLog(group, actionType, userId, sortOrder, limit, cursor)
    // actionType="" → tüm eylemler
    const result = await noblox.getAuditLog(parseInt(groupId), "", undefined, "Desc", FETCH_LIMIT);

    // noblox.js sonucu: { data: [...], nextPageCursor }
    const entries = result?.data || result;
    if (!entries || !Array.isArray(entries) || entries.length === 0) return;

    const sinceTime  = lastSeenTime[groupId] || null;
    const newEntries = [];

    for (const entry of entries) {
      const entryTime = new Date(entry.created);

      // İlk çalışmada: sadece timestamp'i başlat, mesaj GÖNDERME
      if (!sinceTime) {
        lastSeenTime[groupId] = entryTime;
        console.log(`[AuditLogPoller] ${groupName} (${groupId}) — timestamp başlatıldı: ${entryTime.toISOString()}`);
        return; // Bu gruptan çık (ama diğer gruplar devam etsin)
      }

      if (entryTime <= sinceTime) break; // Eski kayıda ulaştık
      newEntries.push(entry);
    }

    if (newEntries.length === 0) return;

    // En yeni zamanı kaydet
    lastSeenTime[groupId] = new Date(newEntries[0].created);
    console.log(`[AuditLogPoller] ${groupName} — ${newEntries.length} yeni kayıt bulundu.`);

    // Eski → yeni sırayla işle
    for (const entry of newEntries.reverse()) {
      const actionType = entry.actionType || "Bilinmeyen";
      const actionInfo = ACTION_MAP[actionType] || { label: actionType, emoji: "📋", color: 0x95A5A6, cat: "❓ Diğer" };

      const actor     = entry.actor?.user;
      const actorName = actor?.username || "Bilinmeyen";
      const actorId   = actor?.userId   || null;
      const actorRole = entry.actor?.role;
      const unixSec   = Math.floor(new Date(entry.created).getTime() / 1000);

      // ── Audit Log embed'i gönder ────────────────────────────────────────
      const embed = new EmbedBuilder()
        .setTitle(`${actionInfo.emoji} ${actionInfo.label}`)
        .setColor(actionInfo.color)
        .addFields(
          {
            name:  "🏢 Grup",
            value: `[${groupName}](${rbxGroup(groupId)})\nID: \`${groupId}\``,
            inline: true
          },
          {
            name:  "👤 İşlemi Yapan",
            value: actorId
              ? `[${actorName}](${rbxProfile(actorId)})\nID: \`${actorId}\`${actorRole ? `\nRütbe: **${actorRole.name}** (Rank \`${actorRole.rank}\`)` : ""}`
              : `${actorName}${actorRole ? `\nRütbe: **${actorRole.name}**` : ""}`,
            inline: true
          },
          {
            name:  "📂 Kategori & Zaman",
            value: `${actionInfo.cat}\n<t:${unixSec}:F>\n(<t:${unixSec}:R>)`,
            inline: true
          }
        )
        .setTimestamp(new Date(entry.created))
        .setFooter({
          text:    `Roblox Group Audit Log • ${groupName}`,
          iconURL: client.user.displayAvatarURL()
        });

      applyActionFields(embed, entry, actionType);

      await logChannel.send({ embeds: [embed] }).catch(err =>
        console.error(`[AuditLogPoller] Gönderim hatası (${AUDIT_LOG_CHANNEL_ID}):`, err.message)
      );

      // ── Abuse tespiti (sadece Change Rank) ──────────────────────────────
      if (actionType === "Change Rank") {
        const reasons = checkForAbuse(entry, groupId);
        if (reasons) {
          await sendAbuseAlert(client, entry, groupId, groupName, reasons);
        }
      }

      await new Promise(r => setTimeout(r, 600));
    }
  } catch (err) {
    // Hata detayını her zaman logla — sessiz yutma yok artık
    const errMsg = err.message || String(err);
    if (errMsg.includes("403") || errMsg.includes("Unauthorized") || errMsg.includes("insufficient")) {
      // İlk seferde bir kere logla
      if (!lastSeenTime[`_err_${groupId}`]) {
        console.warn(`[AuditLogPoller] ⚠️ Grup ${groupId} (${groupName}) — Audit Log yetkisi yok (403/Unauthorized). Atlanacak.`);
        lastSeenTime[`_err_${groupId}`] = true;
      }
    } else {
      console.error(`[AuditLogPoller] ❌ Grup ${groupId} (${groupName}) poll hatası:`, errMsg);
    }
  }
}

// ─── Tüm grupları poll et ─────────────────────────────────────────────────────
async function pollAllGroups(client) {
  let logChannel = null;
  try {
    const guild = client.guilds.cache.get(AUDIT_LOG_GUILD_ID);
    if (!guild) {
      console.error(`[AuditLogPoller] ❌ Müttefik sunucusu (${AUDIT_LOG_GUILD_ID}) cache'de bulunamadı. Bot bu sunucuda mı?`);
      return;
    }
    logChannel = guild.channels.cache.get(AUDIT_LOG_CHANNEL_ID);
    if (!logChannel || !logChannel.isTextBased()) {
      console.error(`[AuditLogPoller] ❌ Log kanalı (${AUDIT_LOG_CHANNEL_ID}) sunucuda bulunamadı veya text-based değil.`);
      return;
    }
  } catch (err) {
    console.error("[AuditLogPoller] Log kanalı alınamadı:", err.message);
    return;
  }

  console.log(`[AuditLogPoller] Tüm gruplar poll ediliyor... (${Object.keys(ROBLOX_GROUPS).length} grup)`);

  for (const groupId of Object.keys(ROBLOX_GROUPS)) {
    await pollGroup(client, groupId, ROBLOX_GROUPS[groupId], logChannel);
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`[AuditLogPoller] Poll turu tamamlandı.`);
}

// ─── Başlatma fonksiyonu ──────────────────────────────────────────────────────
function startAuditLogPoller(client) {
  const count = Object.keys(ROBLOX_GROUPS).length;
  console.log(`[AuditLogPoller] Başlatıldı — ${count} grup izleniyor, her ${POLL_INTERVAL_MS / 1000}s kontrol.`);

  pollAllGroups(client).catch(err =>
    console.error("[AuditLogPoller] İlk çalıştırma hatası:", err.message)
  );

  setInterval(() => {
    pollAllGroups(client).catch(err =>
      console.error("[AuditLogPoller] Poll hatası:", err.message)
    );
  }, POLL_INTERVAL_MS);
}

module.exports = { startAuditLogPoller };
