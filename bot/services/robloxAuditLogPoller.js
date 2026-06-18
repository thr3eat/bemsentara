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

// ─── Gece modu otomatik ban tracker (Roblox) ──────────────────────────────────
// `${groupId}_${actorId}` → { timeoutId, messageId, ... }
const nightModePendingRbxBans = new Map();

const aiPendingRbxBans = new Map();

function cancelPendingRbxAIBan(groupId, actorId) {
  const key = `ai_${groupId}_${actorId}`;
  if (aiPendingRbxBans.has(key)) {
    const pending = aiPendingRbxBans.get(key);
    if (pending && pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    aiPendingRbxBans.delete(key);
    console.log(`[AI-Autonom-Roblox] ❌ ${key} için bekleyen otomatik AI banı iptal edildi.`);
    return true;
  }
  return false;
}

function cancelPendingRbxNightBan(groupId, actorId) {
  const key = `${groupId}_${actorId}`;
  cancelPendingRbxAIBan(groupId, actorId);
  if (nightModePendingRbxBans.has(key)) {
    const pending = nightModePendingRbxBans.get(key);
    if (pending && pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    nightModePendingRbxBans.delete(key);
    console.log(`[NightMode-Roblox] ❌ ${key} için bekleyen otomatik ban iptal edildi.`);
    return true;
  }
  return false;
}

function isNightHours() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 0 && hour < 8; // 00:00 - 08:00
}

// ─── Abuse tespit ─────────────────────────────────────────────────────────────
/**
 * Olayı abuse açısından değerlendirir.
 * @returns {string[]|null} Sebep listesi (boşsa null)
 */
function checkForAbuse(entry, groupId, actionType) {
  const d = entry.description || {};
  const reasons = [];

  if (actionType === "Change Rank") {
    const targetId  = d.TargetId;
    const newRank   = d.NewRoleSetRank ?? null;
    const oldRank   = d.OldRoleSetRank ?? null;

    if (targetId && newRank != null) {
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
    }
  } else if (actionType === "Change Owner") {
    reasons.push("👑 **Grup Sahibi Değişikliği:** Grubun sahipliği devredildi! Bu son derece kritik bir işlemdir.");
  } else if (actionType === "Delete Role") {
    reasons.push(`🗑️ **Rütbe Silindi:** Gruptan bir rütbe kaldırıldı (${d.RoleName || "Bilinmeyen Rol"}).`);
  } else if (actionType === "Remove Group Place") {
    reasons.push("🎮 **Grup Oyunu Kaldırıldı:** Gruptan bir oyun/deneyim kaldırıldı.");
  } else if (actionType === "Delete Ally") {
    reasons.push(`🤝 **Müttefiklik Kaldırıldı:** Müttefik grubu silindi (${d.TargetGroupName || d.TargetGroupId || "Bilinmeyen"}).`);
  } else if (actionType === "Spend Group Funds") {
    const amount = Number(d.Amount || 0);
    if (amount >= 5000) {
      reasons.push(`💰 **Yüksek Miktarda Fon Harcaması:** Gruptan **${amount.toLocaleString()} Robux** harcandı.`);
    }
  }

  return reasons.length > 0 ? reasons : null;
}

/**
 * Abuse uyarısını yetkili kanalına gönderir.
 */
async function sendAbuseAlert(client, entry, groupId, groupName, reasons) {
  const d          = entry.description || {};
  const actor      = entry.actor?.user;
  const actorName  = actor?.username || "Bilinmeyen";
  const actorId    = actor?.userId || null;
  const targetId   = d.TargetId || null;

  const alertKey = `${groupId}_${targetId || "none"}_${entry.created}`;
  if (sentAbuseAlerts.has(alertKey)) return;
  sentAbuseAlerts.add(alertKey);

  let abuseChan = null;
  try {
    const guild = client.guilds.cache.get(AUDIT_LOG_GUILD_ID);
    if (!guild) return;
    abuseChan = guild.channels.cache.get(ABUSE_ALERT_CHANNEL_ID);
    if (!abuseChan || !abuseChan.isTextBased()) return;
  } catch (_) { return; }

  const actorRole  = entry.actor?.role;
  const targetName = d.TargetName || "Bilinmeyen";
  const unixSec    = Math.floor(new Date(entry.created).getTime() / 1000);
  const isNight    = isNightHours();
  const key        = `${groupId}_${actorId}`;

  // Find linked Discord user details
  let linkedDiscordUser = null;
  try {
    const User = require("../../models/User");
    const dbUser = await User.findOne({ robloxId: String(actorId) });
    if (dbUser && dbUser.discordId) {
      linkedDiscordUser = await client.users.fetch(dbUser.discordId).catch(() => null);
    }
  } catch (_) {}

  const embed = new EmbedBuilder()
    .setTitle(isNight ? "🚨 GECE MODU: ROBLOX ABUSE VE OTOMATİK MÜDAHALE SÜRECİ" : "🚨 ROBLOX GRUP ABUSE ŞÜPHESİ TESPİT EDİLDİ")
    .setDescription(
      `Grup **${groupName}** içinde şüpheli işlem tespit edildi.\n\n` +
      `**⚠️ Şüphelilik Sebepleri:**\n${reasons.map(r => `• ${r}`).join("\n")}` +
      (isNight 
        ? `\n\n⚠️ **GECE MODU AKTİF:** 1 dakika içerisinde yanıt gelmezse sistem yetkiliyi gruptan atacak (exile) ve Discord'dan banlayacaktır!\n🕒 **Kalan Süre:** <t:${unixSec + 60}:R>` 
        : `\n\n⚠️ Aşağıdaki butonlarla müdahale edebilirsiniz.`)
    )
    .setColor(0xFF0000)
    .addFields(
      {
        name: "🏢 Grup",
        value: `[${groupName}](${rbxGroup(groupId)})\nID: \`${groupId}\``,
        inline: true
      },
      {
        name: "👤 İşlemi Yapan (Şüpheli)",
        value: actorId
          ? `[${actorName}](${rbxProfile(actorId)})\nID: \`${actorId}\`${actorRole ? `\nRütbe: **${actorRole.name}** (Rank \`${actorRole.rank}\`)` : ""}${linkedDiscordUser ? `\nDiscord: ${linkedDiscordUser.toString()}` : "\nDiscord: Eşleşmedi"}`
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
      },
      { name: "🤖 Yapay Zeka Risk Analizi", value: "⏳ Analiz hazırlanıyor...", inline: false }
    )
    .setThumbnail(rbxAvatar(targetId) || rbxAvatar(actorId))
    .setTimestamp()
    .setFooter({ text: "Roblox Abuse Tespit Sistemi", iconURL: client.user.displayAvatarURL() });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rbx_abuse_demote_${groupId}_${targetId || "0"}_${actorId || "0"}`)
      .setLabel("✅ EVET ÇEK — En Düşük Rütbeye İndir")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🚨"),
    new ButtonBuilder()
      .setCustomId(`rbx_abuse_ignore_${groupId}_${targetId || "0"}_${actorId || "0"}`)
      .setLabel(isNight ? "🚫 Yoksay (İptal Et)" : "❌ Yoksay — Şüphe Yok")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🚫")
  );

  const alertMsg = await abuseChan.send({ embeds: [embed], components: [row] }).catch(err => {
    console.error("[AbuseAlert] Gönderim hatası:", err.message);
    return null;
  });

  console.log(`[AbuseAlert] 🚨 Abuse şüphesi: Grup ${groupId} (${groupName}) — Hedef: ${targetName} (${targetId})`);

  if (alertMsg) {
    // ─── AI Analizi Entegrasyonu ─────────────────────────────────────────────
    const { chatWithAI } = require("./aiService");
    const aiPrompt = `Aşağıdaki Roblox grup denetim günlüğü (audit log) olayını analiz et ve bu olayın bir "abuse" (yetkiyi kötüye kullanma/sabotaj) olup olmadığını değerlendir.
Grup: ${groupName} (ID: ${groupId})
İşlemi Yapan Yetkili: ${actorName} (ID: ${actorId}, Rütbe: ${actorRole?.name || "Bilinmiyor"})
Olay Detayları: ${reasons.join(", ")}
Ek Detaylar: ${JSON.stringify(entry.description || {})}

Lütfen şu formatta kısa bir analiz yap (maksimum 3 cümle, Türkçe olsun):
**Risk Seviyesi:** [DÜŞÜK / ORTA / YÜKSEK]
**Analiz:** [Neden böyle düşündüğünü açıkla]`;

    chatWithAI([{ role: "user", content: aiPrompt }])
      .then(async (aiResponse) => {
        try {
          const freshMsg = await alertMsg.channel.messages.fetch(alertMsg.id);
          if (freshMsg) {
            const currentEmbed = freshMsg.embeds[0];
            if (currentEmbed) {
              const fields = currentEmbed.fields.map(f => {
                if (f.name === "🤖 Yapay Zeka Risk Analizi") {
                  return { name: "🤖 Yapay Zeka Risk Analizi", value: aiResponse.slice(0, 1024), inline: false };
                }
                return f;
              });
              const updatedEmbed = EmbedBuilder.from(currentEmbed).setFields(fields);
              await freshMsg.edit({ embeds: [updatedEmbed] });
            }
          }
        } catch (editErr) {
          console.warn("[RobloxAuditLogPoller] AI analizi mesaja eklenemedi:", editErr.message);
        }

        // ─── AI OTONOM MÜDAHALE (Normal saatlerde Yüksek Risk ise) ───────────────
        const riskUpper = aiResponse.toUpperCase();
        const isHighRisk = riskUpper.includes("YÜKSEK") || riskUpper.includes("ÇOK YÜKSEK");

        if (isHighRisk) {
          const { sendTelegramAlert } = require("./telegramService");
          const tgMessage = `🚨 <b>YAPAY ZEKA ABUSE UYARISI (ROBLOX)</b>\n\n` +
            `<b>Grup:</b> ${groupName} (<code>${groupId}</code>)\n` +
            `<b>Şüpheli:</b> ${actorName} (<code>${actorId}</code>)\n` +
            `<b>Olay:</b> ${reasons.join(", ")}\n\n` +
            `<b>AI Analizi:</b>\n${aiResponse}\n\n` +
            `Lütfen Discord üzerinden hemen kontrol ediniz!`;
          sendTelegramAlert(tgMessage).catch(e => console.error("[Telegram] Gönderme hatası:", e.message));
        }

        if (isHighRisk && !isNight) {
          const aiKey = `ai_${groupId}_${actorId}`;
          cancelPendingRbxAIBan(groupId, actorId);

          const ownerId = "1031620522406072350";
          try {
            const owner = await client.users.fetch(ownerId);
            const freshMsg = await alertMsg.channel.messages.fetch(alertMsg.id).catch(() => alertMsg);
            
            const dmEmbed = EmbedBuilder.from(freshMsg.embeds[0])
              .setTitle("⚠️ YAPAY ZEKA ROBLOX ABUSE UYARISI (DM)")
              .setDescription(
                `Grup **${groupName}** içinde AI tarafından **YÜKSEK RİSKLİ** bulunan bir aktivite tespit edildi!\n\n` +
                `⚠️ **OTONOM MÜDAHALE SÜRECİ:** 1 dakika içerisinde yanıt vermezseniz yapay zeka durumu teyit edip kullanıcıyı otomatik gruptan atacak ve Discord'dan banlayacaktır!`
              );

            const dmMsg = await owner.send({ embeds: [dmEmbed], components: [row] });
            
            if (dmMsg) {
              const timeoutId = setTimeout(async () => {
                const pending = aiPendingRbxBans.get(aiKey);
                if (!pending) return;

                const finalPrompt = `Grup: ${groupName} (ID: ${groupId}), Şüpheli Yetkili: ${actorName} (ID: ${actorId}). 
1 dakika boyunca yöneticiden yanıt gelmedi. Bu olaya acil engelleyici müdahale (exile/ban) yapılması kesin olarak gerekli midir? 
Lütfen cevabına sadece 'EVET' veya 'HAYIR' ile başla ve kısa bir açıklama ekle.`;
                
                try {
                  const finalResponse = await chatWithAI([{ role: "user", content: finalPrompt }]);
                  const finalUpper = finalResponse.toUpperCase();
                  if (finalUpper.startsWith("EVET") || finalUpper.includes("EVET")) {
                    // 1. Roblox grubundan at (exile)
                    try {
                      const noblox = require("noblox.js");
                      if (actorId) {
                        await noblox.exile(parseInt(groupId), parseInt(actorId));
                      }
                      if (targetId && targetId !== "0") {
                        const roles = await noblox.getRoles(parseInt(groupId));
                        const lowest = roles.filter(r => r.rank > 0).sort((a, b) => a.rank - b.rank)[0];
                        if (lowest) {
                          await noblox.setRank({ group: parseInt(groupId), target: parseInt(targetId), rank: lowest.rank });
                        }
                      }
                    } catch (err) {
                      console.warn("[NightMode-Roblox] Roblox müdahale hatası:", err.message);
                    }

                    // 2. Discord'dan banla
                    let discordMember = null;
                    try {
                      const User = require("../../models/User");
                      const dbUser = await User.findOne({ robloxId: String(actorId) });
                      if (dbUser && dbUser.discordId) {
                        const alliedGuild = client.guilds.cache.get(AUDIT_LOG_GUILD_ID);
                        if (alliedGuild) {
                          discordMember = await alliedGuild.members.fetch(dbUser.discordId).catch(() => null);
                        }
                      }
                    } catch (_) {}

                    if (discordMember) {
                      await discordMember.ban({ reason: `Roblox Abuse AI Otonom Karar — ${reasons.join(", ")}` }).catch(() => {});
                    }

                    const disabledRow = new ActionRowBuilder().addComponents(
                      new ButtonBuilder().setCustomId(`rbx_abuse_demote_${groupId}_${targetId || "0"}_${actorId || "0"}`).setLabel("🚨 Rütbe İndirildi").setStyle(ButtonStyle.Danger).setDisabled(true),
                      new ButtonBuilder().setCustomId(`rbx_abuse_ignore_${groupId}_${targetId || "0"}_${actorId || "0"}`).setLabel("🚫 AI Tarafından Exile Edildi").setStyle(ButtonStyle.Secondary).setDisabled(true)
                    );

                    const updatedDmEmbed = EmbedBuilder.from(dmMsg.embeds[0])
                      .setColor(0xFF0000)
                      .setTitle("🚨 AI OTONOM MÜDAHALE UYGULANDI")
                      .setDescription(
                        (dmMsg.embeds[0].description || "") +
                        `\n\n⛔ **Süre Doldu & AI Onayladı:** AI bu olayı kesin sabote olarak değerlendirdi ve kullanıcıyı otomatik gruptan attı ve Discord'dan yasakladı.\n\n**AI Son Değerlendirmesi:**\n${finalResponse}`
                      );
                    
                    await dmMsg.edit({ embeds: [updatedDmEmbed], components: [disabledRow] }).catch(() => {});

                    const freshAlertMsg = await alertMsg.channel.messages.fetch(alertMsg.id).catch(() => null);
                    if (freshAlertMsg) {
                      const updatedChannelEmbed = EmbedBuilder.from(freshAlertMsg.embeds[0])
                        .setColor(0xFF0000)
                        .setTitle("🚨 AI OTONOM MÜDAHALE UYGULANDI")
                        .setDescription(
                          (freshAlertMsg.embeds[0].description || "") +
                          `\n\n⛔ **AI Otonom:** Yönetici yanıtı gelmediği için AI teyidiyle kullanıcı gruptan atıldı ve Discord'dan banlandı.\n\n**AI Gerekçesi:**\n${finalResponse}`
                        );
                      await freshAlertMsg.edit({ embeds: [updatedChannelEmbed], components: [disabledRow] }).catch(() => {});
                    }
                  } else {
                    const updatedDmEmbed = EmbedBuilder.from(dmMsg.embeds[0])
                      .setColor(0xF39C12)
                      .setTitle("⚠️ AI OTONOM MÜDAHALE UYGULANMADI")
                      .setDescription(
                        (dmMsg.embeds[0].description || "") +
                        `\n\nℹ️ **Süre Doldu & AI Reddetti:** AI bu olayın otomatik işlem gerektirmediğine karar verdi.\n\n**AI Son Değerlendirmesi:**\n${finalResponse}`
                      );
                    await dmMsg.edit({ embeds: [updatedDmEmbed] }).catch(() => {});
                  }
                } catch (finalErr) {
                  console.error("[robloxAuditLogPoller] AI otonom kararı alınırken hata:", finalErr.message);
                }
                aiPendingRbxBans.delete(aiKey);
              }, 60_000);

              aiPendingRbxBans.set(aiKey, {
                timestamp: Date.now(),
                timeoutId,
                messageId: dmMsg.id,
                channelId: dmMsg.channel.id
              });
            }
          } catch (dmErr) {
            console.error("[robloxAuditLogPoller] Sahibine DM gönderilemedi:", dmErr.message);
          }
        }
      })
      .catch((aiErr) => {
        console.warn("[RobloxAuditLogPoller] AI analiz hatası:", aiErr.message);
      });

    // ─── GECE MODU: Otomatik ban zamanlayıcı başlat ────────────────────────────
    if (isNight) {
      const timeoutId = setTimeout(async () => {
        const pending = nightModePendingRbxBans.get(key);
        if (!pending) return; // Bu sürede manuel işlem yapılmış veya yoksayılmış

        // 1. Roblox grubundan at (exile)
        try {
          const noblox = require("noblox.js");
          if (actorId) {
            await noblox.exile(parseInt(groupId), parseInt(actorId));
            console.log(`[NightMode-Roblox] ✅ Roblox'ta aktör ${actorName} (${actorId}) gruptan atıldı.`);
          }
          // Hedefin rütbesini en düşüğe çek (abuse geri alma)
          if (targetId && targetId !== "0") {
            const roles = await noblox.getRoles(parseInt(groupId));
            const lowest = roles.filter(r => r.rank > 0).sort((a, b) => a.rank - b.rank)[0];
            if (lowest) {
              await noblox.setRank({ group: parseInt(groupId), target: parseInt(targetId), rank: lowest.rank });
            }
          }
        } catch (err) {
          console.warn("[NightMode-Roblox] Roblox müdahale hatası:", err.message);
        }

        // 2. Discord sunucusundan banla
        let discordMember = null;
        let discordUser = null;
        try {
          const User = require("../../models/User");
          const dbUser = await User.findOne({ robloxId: String(actorId) });
          if (dbUser && dbUser.discordId) {
            const alliedGuild = client.guilds.cache.get(AUDIT_LOG_GUILD_ID);
            if (alliedGuild) {
              discordMember = await alliedGuild.members.fetch(dbUser.discordId).catch(() => null);
              discordUser = discordMember ? discordMember.user : await client.users.fetch(dbUser.discordId).catch(() => null);
            }
          }
        } catch (_) {}

        if (discordMember) {
          try {
            await discordMember.ban({ reason: `Roblox Abuse şüphesi (${reasons.join(", ")}) — Gece otomatik ban` });
            console.log(`[NightMode-Roblox] ✅ Discord'da ${discordMember.user.tag} banlandı.`);
          } catch (banErr) {
            console.warn("[NightMode-Roblox] Discord ban hatası:", banErr.message);
          }
        }

        // 3. Admin ve kullanıcıya DM gönder
        const NIGHT_ADMIN_IDS = ["1078049507230625963", "1031620522406072350"];
        for (const adminId of NIGHT_ADMIN_IDS) {
          try {
            const admin = await client.users.fetch(adminId);
            const adminEmbed = new EmbedBuilder()
              .setTitle("🚨 ROBLOX GECE OTOMATİK MÜDAHALE ÖZETİ")
              .setColor(0xFF0000)
              .setDescription(`Roblox grubunda geç saatlerde abuse şüphesi tespit edildi. Yanıt gelmediği için sistem otomatik olarak yetkiliyi gruptan attı ve Discord'dan banladı.`)
              .addFields(
                { name: "🏢 Grup", value: `${groupName} (${groupId})`, inline: true },
                { name: "👤 Roblox Yetkilisi", value: `${actorName} (ID: ${actorId})`, inline: true },
                { name: "👤 Discord Hesabı", value: discordUser ? `${discordUser.tag} (<@${discordUser.id}>)` : "Eşleşmedi", inline: true },
                { name: "📋 Olay Sebepleri", value: reasons.join("\n"), inline: false }
              )
              .setTimestamp();
            await admin.send({ embeds: [adminEmbed] });
          } catch (_) {}
        }

        if (discordUser) {
          try {
            const userEmbed = new EmbedBuilder()
              .setTitle("⛔ BAN VE EXILE BİLDİRİMİ")
              .setColor(0xFF0000)
              .setDescription(
                `Roblox grubumuzdaki şüpheli aktiviteleriniz nedeniyle gruptan **atıldınız** ve Discord sunucusundan **banlandınız**.\n\n` +
                `**Sebep:** Roblox Abuse şüphesi — Gece saatleri otomatik ban sistemi\n\n` +
                `*Eğer bir hata olduğunu düşünüyorsanız, lütfen yöneticiler ile iletişime geçiniz.*`
              )
              .setTimestamp();
            await discordUser.send({ embeds: [userEmbed] });
          } catch (_) {}
        }

        // 4. Uyarı embed'ini güncelle
        try {
          const freshMsg = await alertMsg.channel.messages.fetch(alertMsg.id);
          if (freshMsg) {
            const currentEmbed = freshMsg.embeds[0];
            if (currentEmbed) {
              const updatedEmbed = EmbedBuilder.from(currentEmbed)
                .setColor(0xFF0000)
                .setTitle("🚨 GECE MODU: OTOMATİK EXILE VE BAN UYGULANDI")
                .setDescription(
                  (currentEmbed.description || "") +
                  `\n\n⛔ **Süre Doldu:** 1 dakika içerisinde yanıt verilmediği için sistem yetkiliyi gruptan çıkardı ve Discord sunucusundan banladı.`
                );

              const makeDisabledRow = () => {
                return new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId(`rbx_abuse_demote_${groupId}_${targetId || "0"}_${actorId || "0"}`).setLabel("🚨 Rütbe İndirildi").setStyle(ButtonStyle.Danger).setDisabled(true),
                  new ButtonBuilder().setCustomId(`rbx_abuse_ignore_${groupId}_${targetId || "0"}_${actorId || "0"}`).setLabel("🚫 Süre Doldu").setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
              };

              await freshMsg.edit({ embeds: [updatedEmbed], components: [makeDisabledRow()] });
            }
          }
        } catch (err) {
          console.warn("[NightMode-Roblox] Uyarı mesajı güncellenemedi:", err.message);
        }

        nightModePendingRbxBans.delete(key);
      }, 60_000); // 1 dakika

      nightModePendingRbxBans.set(key, {
        timestamp: Date.now(),
        groupId,
        targetId,
        actorId,
        actorName,
        reasons,
        timeoutId,
        messageId: alertMsg.id,
        channelId: alertMsg.channel.id
      });

      console.log(`[NightMode-Roblox] ⏳ Grup ${groupId} — ${actorName} için 1 dakika bekleme başlandı`);
    }
  }
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

      // ── Abuse tespiti ──────────────────────────────────────────────────
      const reasons = checkForAbuse(entry, groupId, actionType);
      if (reasons) {
        await sendAbuseAlert(client, entry, groupId, groupName, reasons);
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

module.exports = { 
  startAuditLogPoller,
  cancelPendingRbxNightBan,
  cancelPendingRbxAIBan,
};
