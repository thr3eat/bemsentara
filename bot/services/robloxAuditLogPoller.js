const noblox = require("noblox.js");
const { EmbedBuilder } = require("discord.js");
const { ROBLOX_GROUPS } = require("./robloxGroupManager");

// ─── Hedef Discord Kanalı ────────────────────────────────────────────────────
const AUDIT_LOG_CHANNEL_ID = "1514682098819137727";
const AUDIT_LOG_GUILD_ID   = "1483482948320891074";

// ─── Ayarlar ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 3 * 60 * 1000; // Her 3 dakikada bir kontrol
const FETCH_LIMIT       = 25;            // Grup başına çekilecek maksimum kayıt

// ─── Durum: grup başına en son görülen audit log zamanı ──────────────────────
const lastSeenTime = {}; // groupId (string) → Date

// ─── Eylem haritası: tür → { Türkçe etiket, renk, emoji, kategori } ─────────
const ACTION_MAP = {
  // ── Üyelik ─────────────────────────────────────────────────────────────────
  "Accept Join Request":         { label: "Katılım İsteği Onaylandı",      emoji: "✅", color: 0x2ECC71, cat: "👥 Üyelik" },
  "Decline Join Request":        { label: "Katılım İsteği Reddedildi",     emoji: "❌", color: 0xE74C3C, cat: "👥 Üyelik" },
  "Kick User":                   { label: "Kullanıcı Gruptan Atıldı",      emoji: "🚪", color: 0xE74C3C, cat: "👥 Üyelik" },
  "Change Rank":                 { label: "Rütbe Değiştirildi",            emoji: "🪖", color: 0x3498DB, cat: "🪖 Rütbe"  },
  "Add Role":                    { label: "Yeni Rütbe Oluşturuldu",        emoji: "➕", color: 0x2ECC71, cat: "🪖 Rütbe"  },
  "Delete Role":                 { label: "Rütbe Silindi",                 emoji: "🗑️", color: 0xE74C3C, cat: "🪖 Rütbe"  },
  "Change Rank Name":            { label: "Rütbe Adı Değiştirildi",        emoji: "✏️", color: 0x1ABC9C, cat: "🪖 Rütbe"  },
  "Change Rank Description":     { label: "Rütbe Açıklaması Değiştirildi",emoji: "📝", color: 0x1ABC9C, cat: "🪖 Rütbe"  },
  "Change Rank Rank":            { label: "Rütbe Seviyesi Değiştirildi",   emoji: "🔢", color: 0x3498DB, cat: "🪖 Rütbe"  },
  "Update Roleset Rank":         { label: "Rütbe Sırası Güncellendi",      emoji: "🔄", color: 0x3498DB, cat: "🪖 Rütbe"  },
  // ── Müttefiklik ────────────────────────────────────────────────────────────
  "Send Ally Request":           { label: "Müttefik İsteği Gönderildi",    emoji: "🤝", color: 0x9B59B6, cat: "🤝 Müttefik" },
  "Accept Ally Request":         { label: "Müttefik İsteği Kabul Edildi",  emoji: "✅", color: 0x2ECC71, cat: "🤝 Müttefik" },
  "Decline Ally Request":        { label: "Müttefik İsteği Reddedildi",    emoji: "❌", color: 0xE74C3C, cat: "🤝 Müttefik" },
  "Delete Ally":                 { label: "Müttefiklik Kaldırıldı",        emoji: "🗑️", color: 0xE74C3C, cat: "🤝 Müttefik" },
  // ── Grup Ayarları ──────────────────────────────────────────────────────────
  "Change Description":          { label: "Grup Açıklaması Değiştirildi",  emoji: "📝", color: 0x1ABC9C, cat: "⚙️ Ayarlar"  },
  "Post Status":                 { label: "Grup Durumu Yayınlandı",        emoji: "📢", color: 0x3498DB, cat: "⚙️ Ayarlar"  },
  "Delete Group Shout":          { label: "Grup Duyurusu Silindi",         emoji: "🗑️", color: 0xE74C3C, cat: "⚙️ Ayarlar"  },
  "Lock/Unlock Group Join":      { label: "Grup Katılım Kilidi Değiştirildi",emoji:"🔒",color: 0xF39C12, cat: "⚙️ Ayarlar"  },
  "Change Owner":                { label: "Grup Sahibi Değiştirildi",      emoji: "👑", color: 0xF1C40F, cat: "⚙️ Ayarlar"  },
  // ── Finans ────────────────────────────────────────────────────────────────
  "Spend Group Funds":           { label: "Grup Fonu Harcandı",            emoji: "💰", color: 0xF39C12, cat: "💰 Finans"   },
  "Create Items":                { label: "Öğe Oluşturuldu",               emoji: "✨", color: 0xF1C40F, cat: "🎨 İçerik"   },
  "Configure Items":             { label: "Öğe Yapılandırıldı",            emoji: "⚙️", color: 0x95A5A6, cat: "🎨 İçerik"   },
  "Add Group Place":             { label: "Grup Oyunu Eklendi",            emoji: "🏗️", color: 0x2ECC71, cat: "🎮 Oyunlar"  },
  "Remove Group Place":          { label: "Grup Oyunu Kaldırıldı",        emoji: "🗑️", color: 0xE74C3C, cat: "🎮 Oyunlar"  },
  "Create Group Asset":          { label: "Grup Varlığı Oluşturuldu",      emoji: "🖼️", color: 0x2ECC71, cat: "🎨 İçerik"   },
  "Configure Group Asset":       { label: "Grup Varlığı Güncellendi",      emoji: "✏️", color: 0x1ABC9C, cat: "🎨 İçerik"   },
  "Revert Group Asset":          { label: "Grup Varlığı Geri Alındı",      emoji: "↩️", color: 0xE74C3C, cat: "🎨 İçerik"   },
  "Configure Group Game":        { label: "Grup Oyunu Yapılandırıldı",     emoji: "🎮", color: 0x1ABC9C, cat: "🎮 Oyunlar"  },
  "Lock/Unlock Group Game":      { label: "Grup Oyunu Kilidi Değiştirildi",emoji: "🔒", color: 0xF39C12, cat: "🎮 Oyunlar"  },
};

// ─── Rütbe rengini seviyeye göre belirle ──────────────────────────────────────
function rankColor(rankNum) {
  if (!rankNum) return 0x95A5A6;
  if (rankNum >= 250) return 0xF1C40F; // Üst düzey — altın
  if (rankNum >= 150) return 0xE67E22; // Yönetim — turuncu
  if (rankNum >= 100) return 0x3498DB; // Orta — mavi
  if (rankNum >= 50)  return 0x2ECC71; // Alt yönetim — yeşil
  return 0x95A5A6;                     // Üye — gri
}

// ─── Roblox profil URL'si ─────────────────────────────────────────────────────
const rbxProfile = (userId) => userId ? `https://www.roblox.com/users/${userId}/profile` : null;
const rbxAvatar  = (userId) => userId
  ? `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`
  : null;
const rbxGroup   = (groupId) => `https://www.roblox.com/communities/${groupId}`;

/**
 * Eylem türüne özel alanları embed'e ekler.
 */
function applyActionFields(embed, entry, actionType) {
  const d = entry.description || {};

  switch (actionType) {

    case "Change Rank": {
      const newRankNum = d.NewRoleSetRank ?? null;
      embed.setColor(rankColor(newRankNum));
      if (d.TargetName || d.TargetId) {
        embed.addFields({
          name: "🎯 Hedef Kullanıcı",
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
          name: "🎯 Hedef Kullanıcı",
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
      if (d.RoleName)   fields.push({ name: "📛 Rütbe Adı",      value: `**${d.RoleName}**`,              inline: true });
      if (d.OldName)    fields.push({ name: "⏪ Eski Ad",          value: `**${d.OldName}**`,              inline: true });
      if (d.NewName)    fields.push({ name: "🆕 Yeni Ad",          value: `**${d.NewName}**`,              inline: true });
      if (d.OldRank != null) fields.push({ name: "⏪ Eski Seviye", value: `Rank \`${d.OldRank}\``,        inline: true });
      if (d.NewRank != null) fields.push({ name: "🆕 Yeni Seviye", value: `Rank \`${d.NewRank}\``,        inline: true });
      if (d.Description) fields.push({ name: "📝 Açıklama",       value: String(d.Description).slice(0, 300), inline: false });
      if (fields.length) embed.addFields(...fields);
      break;
    }

    case "Send Ally Request":
    case "Accept Ally Request":
    case "Decline Ally Request":
    case "Delete Ally": {
      if (d.TargetGroupName || d.TargetGroupId) {
        embed.addFields({
          name: "🤝 Hedef Grup",
          value: d.TargetGroupId
            ? `[${d.TargetGroupName || "Bilinmeyen"}](${rbxGroup(d.TargetGroupId)}) • ID: \`${d.TargetGroupId}\``
            : `${d.TargetGroupName || "Bilinmeyen"}`,
          inline: false
        });
      }
      break;
    }

    case "Spend Group Funds": {
      if (d.Amount)     embed.addFields({ name: "💰 Harcama Miktarı", value: `**${Number(d.Amount).toLocaleString()} Robux**`, inline: true });
      if (d.CurrencyType) embed.addFields({ name: "💱 Para Birimi",   value: d.CurrencyType,                                  inline: true });
      if (d.ItemDescription) embed.addFields({ name: "📦 Açıklama",   value: String(d.ItemDescription).slice(0, 200),         inline: false });
      break;
    }

    case "Post Status": {
      if (d.Status)     embed.addFields({ name: "📢 Yayınlanan Durum", value: `>>> ${String(d.Status).slice(0, 300)}`, inline: false });
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
      // Bilinmeyen eylem — ham description alanlarını göster
      const rawLines = Object.entries(d)
        .filter(([, v]) => v !== null && v !== undefined && String(v).length > 0)
        .map(([k, v]) => `**${k}:** ${String(v).slice(0, 100)}`);
      if (rawLines.length > 0) {
        embed.addFields({ name: "📋 Ham Veriler", value: rawLines.join("\n").slice(0, 1024), inline: false });
      }
      break;
    }
  }
}

/**
 * Tek bir grubu poll eder ve yeni kayıtları log kanalına gönderir.
 */
async function pollGroup(client, groupId, groupName, logChannel) {
  try {
    const result = await noblox.getAuditLog({
      group:     parseInt(groupId),
      sortOrder: "Desc",
      limit:     FETCH_LIMIT
    });

    if (!result || !result.data || result.data.length === 0) return;

    const sinceTime  = lastSeenTime[groupId] || null;
    const newEntries = [];

    for (const entry of result.data) {
      const entryTime = new Date(entry.created);

      // İlk çalışmada: sadece timestamp'i başlat, Discord'a hiç kayıt gönderme
      if (!sinceTime) {
        lastSeenTime[groupId] = entryTime;
        return;
      }

      if (entryTime <= sinceTime) break; // Eski kayıda ulaştık
      newEntries.push(entry);
    }

    if (newEntries.length === 0) return;

    // En yeni zamanı kaydet
    lastSeenTime[groupId] = new Date(newEntries[0].created);

    // Eski → yeni sırayla gönder
    for (const entry of newEntries.reverse()) {
      const actionType = entry.actionType || "Bilinmeyen";
      const actionInfo = ACTION_MAP[actionType] || { label: actionType, emoji: "📋", color: 0x95A5A6, cat: "❓ Diğer" };

      const actor     = entry.actor?.user;
      const actorName = actor?.username || "Bilinmeyen";
      const actorId   = actor?.userId   || null;
      const actorRole = entry.actor?.role;
      const unixSec   = Math.floor(new Date(entry.created).getTime() / 1000);

      const embed = new EmbedBuilder()
        .setTitle(`${actionInfo.emoji} ${actionInfo.label}`)
        .setColor(actionInfo.color)
        .addFields(
          // Satır 1: Grup bilgisi
          {
            name:  "🏢 Grup",
            value: `[${groupName}](${rbxGroup(groupId)})\nID: \`${groupId}\``,
            inline: true
          },
          // Satır 2: Yapan yetkili
          {
            name:  "👤 İşlemi Yapan",
            value: actorId
              ? `[${actorName}](${rbxProfile(actorId)})\nID: \`${actorId}\`${actorRole ? `\nRütbe: **${actorRole.name}** (Rank \`${actorRole.rank}\`)` : ""}`
              : `${actorName}${actorRole ? `\nRütbe: **${actorRole.name}**` : ""}`,
            inline: true
          },
          // Satır 3: Kategori ve zaman
          {
            name:  "📂 Kategori & Zaman",
            value: `${actionInfo.cat}\n<t:${unixSec}:F>\n(<t:${unixSec}:R>)`,
            inline: true
          }
        )
        .setTimestamp(new Date(entry.created))
        .setFooter({
          text: `Roblox Group Audit Log • ${groupName}`,
          iconURL: client.user.displayAvatarURL()
        });

      // Eylem türüne özgü ek alanlar
      applyActionFields(embed, entry, actionType);

      await logChannel.send({ embeds: [embed] }).catch(err =>
        console.error(`[AuditLogPoller] Kanal ${AUDIT_LOG_CHANNEL_ID} gönderim hatası:`, err.message)
      );

      // Rate limit'e takılmamak için kısa bekleme
      await new Promise(r => setTimeout(r, 600));
    }
  } catch (err) {
    if (err.message?.includes("403") || err.message?.includes("Unauthorized") || err.message?.includes("insufficient")) {
      // Bot bu grupta audit log yetkisi yok — sessizce atla
    } else {
      console.warn(`[AuditLogPoller] Grup ${groupId} (${groupName}) poll hatası:`, err.message);
    }
  }
}

/**
 * Tüm kayıtlı grupları tek tek poll eder.
 */
async function pollAllGroups(client) {
  let logChannel = null;
  try {
    const guild = client.guilds.cache.get(AUDIT_LOG_GUILD_ID);
    if (!guild) return;
    logChannel = guild.channels.cache.get(AUDIT_LOG_CHANNEL_ID);
    if (!logChannel || !logChannel.isTextBased()) return;
  } catch (err) {
    console.error("[AuditLogPoller] Log kanalı alınamadı:", err.message);
    return;
  }

  const groupIds = Object.keys(ROBLOX_GROUPS);
  for (const groupId of groupIds) {
    await pollGroup(client, groupId, ROBLOX_GROUPS[groupId], logChannel);
    await new Promise(r => setTimeout(r, 1500)); // Gruplar arası rate limit koruması
  }
}

/**
 * Bot ready olduğunda çağrılacak başlangıç fonksiyonu.
 */
function startAuditLogPoller(client) {
  const groupCount = Object.keys(ROBLOX_GROUPS).length;
  console.log(`[AuditLogPoller] Başlatıldı — ${groupCount} grup izleniyor, her ${POLL_INTERVAL_MS / 1000}s'de kontrol.`);

  // İlk çalıştırma — timestamp'leri başlatır, Discord'a hiç kayıt göndermez
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
