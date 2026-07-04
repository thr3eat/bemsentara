const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require("discord.js");
const { SERVER_INVITE_LINKS } = require("../../config");

// ─── İzlenen sunucular ────────────────────────────────────────────────────────
const MONITORED_GUILDS = {
  "1514569307886063666": "TMT | Turkish Armed Forces",
  "1367646464804655104": "EkoYıldız",
  "1414639355456389344": "BEM Sentara"
};

async function isMonitoredGuild(guildId) {
  if (MONITORED_GUILDS[guildId]) return true;
  try {
    const ServerSetup = require("../../models/ServerSetup");
    const doc = await ServerSetup.findOne({ guildId, status: "active" });
    return !!doc;
  } catch (_) {
    return false;
  }
}

// ─── Gece saatleri kontrol ────────────────────────────────────────────────────
function isNightHours() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 0 && hour < 8; // 00:00 - 08:00
}

// ─── Gece modu otomatik ban tracker ───────────────────────────────────────────
// `${guildId}_${userId}` → { timestamp, type, details }
const nightModePendingBans = new Map();

const aiPendingBans = new Map();

function cancelPendingAIBan(guildId, userId) {
  const key = `ai_${guildId}_${userId}`;
  if (aiPendingBans.has(key)) {
    const pending = aiPendingBans.get(key);
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    aiPendingBans.delete(key);
    console.log(`[AI-Autonom] ❌ ${key} için bekleyen otomatik AI banı iptal edildi.`);
    return true;
  }
  return false;
}

function cancelPendingNightBan(guildId, userId) {
  const key = `${guildId}_${userId}`;
  cancelPendingAIBan(guildId, userId);
  if (nightModePendingBans.has(key)) {
    const pending = nightModePendingBans.get(key);
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
    nightModePendingBans.delete(key);
    console.log(`[NightMode] ❌ ${key} için bekleyen otomatik ban iptal edildi.`);
    return true;
  }
  return false;
}

// ─── BAN LOG KANALI ───────────────────────────────────────────────────────────
const BAN_LOG_CHANNEL_ID = "1504201531551907941";

// ─── Tespit eşikleri ──────────────────────────────────────────────────────────
const THRESHOLDS = {
  BAN:            { count: 3,  windowMs: 20_000, label: "🔨 Toplu Banlama",           color: 0xFF0000 },
  KICK:           { count: 3,  windowMs: 20_000, label: "👢 Toplu Üye Atma",          color: 0xFF4500 },
  CHANNEL_DELETE: { count: 2,  windowMs: 20_000, label: "🗑️ Toplu Kanal Silme",      color: 0xFF6600 },
  ROLE_DELETE:    { count: 2,  windowMs: 20_000, label: "🗑️ Toplu Rol Silme",        color: 0xFF8800 },
  ROLE_CREATE:    { count: 5,  windowMs: 30_000, label: "➕ Toplu Rol Oluşturma",      color: 0x3498DB },
  CHANNEL_CREATE: { count: 5,  windowMs: 30_000, label: "➕ Toplu Kanal Oluşturma",    color: 0x3498DB },
  WEBHOOK_CREATE: { count: 3,  windowMs: 30_000, label: "🪝 Toplu Webhook Oluşturma",color: 0xFFAA00 },
  MASS_MENTION:   { count: 1,  windowMs: 0,      label: "📣 Toplu Etiketleme / Ping", color: 0xFF2200 },
  EVERYONE_PING:  { count: 5,  windowMs: 60_000, label: "📣 Toplu @everyone / @here Pingi", color: 0xFF2200 },
  REKLAM:         { count: 3,  windowMs: 20_000, label: "📢 Reklam / Davet Spami",    color: 0xFF5500 },
};

// ─── Durum ───────────────────────────────────────────────────────────────────
// `${guildId}_${userId}_${type}` → [timestamp, ...]
const actionTracker = new Map();
// Aynı kişi/eylem için kısa sürede tekrar alert atmayı önle
const lastAlertSent = new Map();
const ALERT_COOLDOWN_MS = 25_000;

// ─── Moderatör DM Dismiss Sistemi ─────────────────────────────────────────────
// Moderatörlerin "BİLDİRİMİ KAPAT" butonuna tıklaması durumunda, o kişi için tekrar DM atılmaması
// `${guildId}_${executorId}` → true (dismissed)
const dismissedNotifications = new Map();

// ─── Sliding window tracker ───────────────────────────────────────────────────
/**
 * Bir eylemi kaydeder. Eşik aşılmışsa true döner.
 */
function trackAction(guildId, userId, type) {
  if (type === "MASS_MENTION") return true; // Her zaman hemen tetikle

  const cfg = THRESHOLDS[type];
  if (!cfg) return false;

  const key  = `${guildId}_${userId}_${type}`;
  const now  = Date.now();

  if (!actionTracker.has(key)) actionTracker.set(key, []);
  const times    = actionTracker.get(key);
  times.push(now);

  // Pencere dışındakileri temizle
  const filtered = times.filter(t => now - t < cfg.windowMs);
  actionTracker.set(key, filtered);

  return filtered.length >= cfg.count;
}

function recentCount(guildId, userId, type) {
  const cfg = THRESHOLDS[type];
  if (!cfg) return 0;
  const key    = `${guildId}_${userId}_${type}`;
  const times  = actionTracker.get(key) || [];
  const now    = Date.now();
  return times.filter(t => now - t < cfg.windowMs).length;
}

function canSendAlert(guildId, userId, type) {
  const key  = `${guildId}_${userId}_${type}`;
  const last = lastAlertSent.get(key) || 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return false;
  lastAlertSent.set(key, Date.now());
  return true;
}

// ─── Audit log'dan işlemi yapan kişiyi bul ───────────────────────────────────
/**
 * Belirtilen eylem türü için son audit log girdisindeki executor'ı döndürür.
 * maxAgeSec: kaç saniye öncesine kadar geçerli kabul edilsin
 */
async function fetchExecutor(guild, auditLogEvent, targetId = null, maxAgeSec = 8) {
  try {
    const logs  = await guild.fetchAuditLogs({ type: auditLogEvent, limit: 5 });
    const now   = Date.now();

    for (const entry of logs.entries.values()) {
      const age = (now - entry.createdAt.getTime()) / 1000;
      if (age > maxAgeSec) continue;
      if (targetId && entry.target?.id !== targetId) continue;
      if (entry.executor?.bot) continue; // Botların kendi aksiyonlarını yoksay
      return entry.executor;
    }
  } catch (_) {}
  return null;
}

// ─── Alert mesajı gönder ──────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {import('discord.js').Client} opts.client
 * @param {import('discord.js').Guild} opts.guild
 * @param {import('discord.js').User} opts.executor
 * @param {string} opts.type
 * @param {string[]} opts.detailLines
 */
async function sendDiscordAbuseAlert(client, { guild, executor, type, detailLines = [] }) {
  const member = await guild.members.fetch(executor.id).catch(() => null);
  const hasRoles = member && member.roles.cache.filter(r => r.id !== guild.id).size > 0;

  if (hasRoles) {
    // Sunucuda any role'e sahip yetkili/üye ise direkt otomatik cezalandırma işlemini uygula!
    await executeImmediateAbuseAction(client, guild, member, type, detailLines);
    return;
  }

  if (!canSendAlert(guild.id, executor.id, type)) return;

  const isNight = isNightHours();
  const key = `${guild.id}_${executor.id}`;

  if (isNight && nightModePendingBans.has(key)) {
    return; // Zaten bu kişi için otomatik ban süreci işliyor
  }

  let alertCh = null;
  try {
    const alertGuild = client.guilds.cache.get("1483482948320891074");
    if (!alertGuild) return;
    alertCh = alertGuild.channels.cache.get("1514685613830574272");
    if (!alertCh || !alertCh.isTextBased()) return;
  } catch (_) { return; }

  const cfg     = THRESHOLDS[type];
  let gName = MONITORED_GUILDS[guild.id];
  if (!gName) {
    try {
      const ServerSetup = require("../../models/ServerSetup");
      const doc = await ServerSetup.findOne({ guildId: guild.id });
      gName = doc ? doc.guildName : guild.name;
    } catch (_) {
      gName = guild.name;
    }
  }
  const count   = recentCount(guild.id, executor.id, type);
  const unix    = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setTitle(isNight ? "🚨 GECE MODU: ABUSE ŞÜPHESİ VE OTOMATİK BAN SÜRECİ" : "🚨 DISCORD SUNUCU ABUSE ŞÜPHESİ")
    .setDescription(
      `**${gName}** sunucusunda şüpheli bir aktivite tespit edildi!\n\n` +
      `> **${cfg.label}**\n` +
      (count > 1 ? `> ⚡ Son 20 saniyede **${count} kez** gerçekleşti\n` : "") +
      (isNight 
        ? `\n⚠️ **GECE MODU AKTİF:** 1 dakika içerisinde yanıt gelmezse kullanıcı otomatik olarak banlanacak ve gruptan atılacaktır!\n🕒 **Kalan Süre:** <t:${unix + 60}:R>` 
        : `\n⚠️ Aşağıdaki butonlarla müdahale edebilirsiniz.`)
    )
    .setColor(cfg.color)
    .addFields(
      { name: "🏠 Sunucu",            value: `**${gName}**\nID: \`${guild.id}\``,                                                    inline: true  },
      { name: "👤 Şüpheli Kullanıcı", value: `${executor.toString()}\n\`${executor.tag}\`\nID: \`${executor.id}\``,                 inline: true  },
      { name: "⚠️ Tespit Edilen",     value: cfg.label,                                                                              inline: true  },
      { name: "🕐 Tespit Zamanı",     value: `<t:${unix}:F>\n(<t:${unix}:R>)`,                                                      inline: true  },
      { name: "🌐 Sunucu Bilgisi",    value: `Üye: **${guild.memberCount}**\nSunucu ID: \`${guild.id}\``,                           inline: true  },
      { name: "🔍 Şüpheli Kişi",      value: `Hesap: <@${executor.id}>\nTag: \`${executor.tag}\`\nID: \`${executor.id}\``,          inline: true  },
      { name: "🤖 Yapay Zeka Risk Analizi", value: "⏳ Analiz hazırlanıyor...", inline: false }
    )
    .setThumbnail(executor.displayAvatarURL({ dynamic: true }))
    .setTimestamp()
    .setFooter({ text: "Sentara Discord Abuse Tespit Sistemi", iconURL: client.user.displayAvatarURL() });

  if (detailLines.length > 0) {
    embed.addFields({
      name:  "📋 Tespit Detayları",
      value: detailLines.slice(0, 15).join("\n").slice(0, 1024),
      inline: false
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`disc_abuse_removeroles_${guild.id}_${executor.id}`)
      .setLabel("🗑️ Rolleri Al")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🗑️"),
    new ButtonBuilder()
      .setCustomId(`disc_abuse_kick_${guild.id}_${executor.id}`)
      .setLabel("At")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("👢"),
    new ButtonBuilder()
      .setCustomId(`disc_abuse_ban_${guild.id}_${executor.id}`)
      .setLabel("Banla")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔨"),
    new ButtonBuilder()
      .setCustomId(`disc_abuse_ignore_${guild.id}_${executor.id}`)
      .setLabel(isNight ? "🚫 Yoksay (İptal Et)" : "🚫 Yoksay")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🚫")
  );

  const alertMsg = await alertCh.send({ embeds: [embed], components: [row] }).catch(err => {
    console.error("[DiscordAbuseDetector] Alert gönderilemedi:", err.message);
    return null;
  });

  // Forward to setup archive channel if configured
  try {
    const ServerSetup = require("../../models/ServerSetup");
    const setupDoc = await ServerSetup.findOne({ guildId: guild.id, status: "active" });
    if (setupDoc && setupDoc.archiveChannelId) {
      const centralGuild = client.guilds.cache.get("1483482948320891074");
      if (centralGuild) {
        const archChan = centralGuild.channels.cache.get(setupDoc.archiveChannelId)
          || await centralGuild.channels.fetch(setupDoc.archiveChannelId).catch(() => null);
        if (archChan && archChan.isTextBased()) {
          await archChan.send({ embeds: [embed] }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn("[DiscordAbuseDetector] Archive channel alert forward error:", err.message);
  }

  console.log(`[DiscordAbuseDetector] 🚨 ${gName} — ${executor.tag} (${executor.id}) — ${cfg.label}`);

  // ─── MODERATÖRLERİ DM'DE UYAR ──────────────────────────────────────────────
  if (alertMsg) {
    const NIGHT_ADMIN_IDS = ["1031620522406072350"]; // Sistem yöneticisini (Sentara owner) DM'de uyar
    
    for (const adminId of NIGHT_ADMIN_IDS) {
      try {
        const dismissKey = `${guild.id}_${executor.id}`;
        
        // Eğer bu kişi için zaten dismiss edilmişse, DM gönderme
        if (dismissedNotifications.has(dismissKey)) {
          console.log(`[AbuseAlert-DM] ⏭️ ${dismissKey} için DM gönderilmedi (dismiss edilmiş)`);
          continue;
        }
        
        const owner = await client.users.fetch(adminId);
        if (!owner) continue;

        // DM'de gönderilecek embed ve butonlar
        const dmEmbed = new EmbedBuilder()
          .setTitle("🚨 ABUSE ŞÜPHESİ UYARISI")
          .setDescription(
            `**${gName}** sunucusunda şüpheli bir aktivite tespit edildi!\n\n` +
            `> **${cfg.label}**\n` +
            (count > 1 ? `> ⚡ Son 20 saniyede **${count} kez** gerçekleşti\n` : "")
          )
          .setColor(cfg.color)
          .addFields(
            { name: "👤 Şüpheli Kullanıcı", value: `${executor.tag}\n\`${executor.id}\``, inline: true },
            { name: "🏠 Sunucu", value: `${gName}\n\`${guild.id}\``, inline: true },
            { name: "⚠️ Tespit Türü", value: cfg.label, inline: false },
            { name: "🕐 Zaman", value: `<t:${unix}:F>`, inline: false }
          )
          .setThumbnail(executor.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: "Sentara Abuse Detection" });

        // DM butonları
        const dmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("📋 Uyarı Kanalına Git")
            .setStyle(ButtonStyle.Link)
            .setURL(alertMsg.url),
          new ButtonBuilder()
            .setCustomId(`abuse_dismiss_${guild.id}_${executor.id}`)
            .setLabel("🚫 BİLDİRİMİ KAPAT")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🚫")
        );

        const dmMsg = await owner.send({ embeds: [dmEmbed], components: [dmRow] }).catch(err => {
          console.error(`[AbuseAlert-DM] DM gönderilemedi (${adminId}):`, err.message);
          return null;
        });

        if (dmMsg) {
          console.log(`[AbuseAlert-DM] ✅ ${owner.tag}'e DM gönderildi (${guild.name})`);
        }
      } catch (dmErr) {
        console.error(`[AbuseAlert-DM] Hata (${adminId}):`, dmErr.message);
      }
    }
  }

  if (alertMsg) {
    // ─── AI Analizi Entegrasyonu ─────────────────────────────────────────────
    const { chatWithAI } = require("./aiService");
    const aiPrompt = `Aşağıdaki Discord sunucu olaylarını analiz et ve bu olayların bir "abuse" (yetkiyi kötüye kullanma/sabotaj) olup olmadığını değerlendir.
Sunucu: ${gName}
Kullanıcı: ${executor.tag} (ID: ${executor.id})
Olay Türü: ${cfg.label}
Detaylar:
${detailLines.join("\n") || "Detay yok"}

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
          console.warn("[DiscordAbuseDetector] AI analizi mesaja eklenemedi:", editErr.message);
        }

        // ─── AI OTONOM MÜDAHALE (Normal saatlerde Yüksek Risk ise) ───────────────
        const riskUpper = aiResponse.toUpperCase();
        const isHighRisk = riskUpper.includes("YÜKSEK") || riskUpper.includes("ÇOK YÜKSEK");

        if (isHighRisk) {
          const { sendTelegramAlert, callTelegramUser } = require("./telegramService");
          const tgMessage = `🚨 <b>YAPAY ZEKA ABUSE UYARISI (DISCORD)</b>\n\n` +
            `<b>Sunucu:</b> ${gName}\n` +
            `<b>Şüpheli:</b> ${executor.tag} (<code>${executor.id}</code>)\n` +
            `<b>Olay:</b> ${cfg.label}\n\n` +
            `<b>AI Analizi:</b>\n${aiResponse}\n\n` +
            `Lütfen Discord üzerinden hemen kontrol ediniz!`;
          sendTelegramAlert(tgMessage).catch(e => console.error("[Telegram] Gönderme hatası:", e.message));

          // Sesli arama tetikle
          const callText = `Sentara sunucu abuse tespiti. ${gName} sunucusunda yuksek riskli abuse tespiti yapildi. Lutfen hemen kontrol edin.`;
          callTelegramUser(callText).catch(e => console.error("[Telegram Call] Arama hatası:", e.message));
        }

        if (isHighRisk && !isNight) {
          const aiKey = `ai_${guild.id}_${executor.id}`;
          cancelPendingAIBan(guild.id, executor.id);

          const ownerId = "1031620522406072350";
          try {
            const owner = await client.users.fetch(ownerId);
            const freshMsg = await alertMsg.channel.messages.fetch(alertMsg.id).catch(() => alertMsg);
            
            const dmEmbed = EmbedBuilder.from(freshMsg.embeds[0])
              .setTitle("⚠️ YAPAY ZEKA ABUSE UYARISI (DM)")
              .setDescription(
                `**${gName}** sunucusunda AI tarafından **YÜKSEK RİSKLİ** bulunan bir aktivite tespit edildi!\n\n` +
                `> **${cfg.label}**\n\n` +
                `⚠️ **OTONOM MÜDAHALE SÜRECİ:** 1 dakika içerisinde yanıt vermezseniz yapay zeka durumu teyit edip kullanıcıyı otomatik banlayacaktır!`
              );

            const dmMsg = await owner.send({ embeds: [dmEmbed], components: [row] });
            
            if (dmMsg) {
              const timeoutId = setTimeout(async () => {
                const pending = aiPendingBans.get(aiKey);
                if (!pending) return;

                const finalPrompt = `Sunucu: ${gName}, Şüpheli: ${executor.tag} (ID: ${executor.id}), Olay Tipi: ${cfg.label}. 
1 dakika boyunca yöneticiden yanıt gelmedi. Bu olaya acil engelleyici müdahale (banlama) yapılması kesin olarak gerekli midir? 
Lütfen cevabına sadece 'EVET' veya 'HAYIR' ile başla ve kısa bir açıklama ekle.`;
                
                try {
                  const finalResponse = await chatWithAI([{ role: "user", content: finalPrompt }]);
                  const finalUpper = finalResponse.toUpperCase();
                  if (finalUpper.startsWith("EVET") || finalUpper.includes("EVET")) {
                    await executeNightModeAutoBan(client, guild, executor, `${type} (AI Otonom Karar)`, detailLines);
                    
                    const disabledRow = new ActionRowBuilder().addComponents(
                      new ButtonBuilder().setCustomId(`disc_abuse_removeroles_${guild.id}_${executor.id}`).setLabel("🗑️ Rolleri Al").setStyle(ButtonStyle.Secondary).setDisabled(true),
                      new ButtonBuilder().setCustomId(`disc_abuse_kick_${guild.id}_${executor.id}`).setLabel("At").setStyle(ButtonStyle.Danger).setDisabled(true),
                      new ButtonBuilder().setCustomId(`disc_abuse_ban_${guild.id}_${executor.id}`).setLabel("Banla").setStyle(ButtonStyle.Danger).setDisabled(true),
                      new ButtonBuilder().setCustomId(`disc_abuse_ignore_${guild.id}_${executor.id}`).setLabel("🚫 AI Tarafından Banlandı").setStyle(ButtonStyle.Secondary).setDisabled(true)
                    );

                    const updatedDmEmbed = EmbedBuilder.from(dmMsg.embeds[0])
                      .setColor(0xFF0000)
                      .setTitle("🚨 AI OTONOM MÜDAHALE UYGULANDI")
                      .setDescription(
                        (dmMsg.embeds[0].description || "") +
                        `\n\n⛔ **Süre Doldu & AI Onayladı:** AI bu olayı kesin sabote olarak değerlendirdi ve kullanıcıyı otomatik banladı.\n\n**AI Son Değerlendirmesi:**\n${finalResponse}`
                      );
                    
                    await dmMsg.edit({ embeds: [updatedDmEmbed], components: [disabledRow] }).catch(() => {});

                    const freshAlertMsg = await alertMsg.channel.messages.fetch(alertMsg.id).catch(() => null);
                    if (freshAlertMsg) {
                      const updatedChannelEmbed = EmbedBuilder.from(freshAlertMsg.embeds[0])
                        .setColor(0xFF0000)
                        .setTitle("🚨 AI OTONOM MÜDAHALE UYGULANDI")
                        .setDescription(
                          (freshAlertMsg.embeds[0].description || "") +
                          `\n\n⛔ **AI Otonom:** Yönetici yanıtı gelmediği için AI teyidiyle kullanıcı otomatik banlandı.\n\n**AI Gerekçesi:**\n${finalResponse}`
                        );
                      await freshAlertMsg.edit({ embeds: [updatedChannelEmbed], components: [disabledRow] }).catch(() => {});
                    }
                  } else {
                    const updatedDmEmbed = EmbedBuilder.from(dmMsg.embeds[0])
                      .setColor(0xF39C12)
                      .setTitle("⚠️ AI OTONOM MÜDAHALE UYGULANMADI")
                      .setDescription(
                        (dmMsg.embeds[0].description || "") +
                        `\n\nℹ️ **Süre Doldu & AI Reddetti:** AI bu olayın otomatik ban gerektirmediğine karar verdi.\n\n**AI Son Değerlendirmesi:**\n${finalResponse}`
                      );
                    await dmMsg.edit({ embeds: [updatedDmEmbed] }).catch(() => {});
                  }
                } catch (finalErr) {
                  console.error("[discordAbuseDetector] AI otonom kararı alınırken hata:", finalErr.message);
                }
                aiPendingBans.delete(aiKey);
              }, 60_000);

              aiPendingBans.set(aiKey, {
                timestamp: Date.now(),
                timeoutId,
                messageId: dmMsg.id,
                channelId: dmMsg.channel.id
              });
            }
          } catch (dmErr) {
            console.error("[discordAbuseDetector] Sahibine DM gönderilemedi:", dmErr.message);
          }
        }
      })
      .catch((aiErr) => {
        console.warn("[DiscordAbuseDetector] AI analiz hatası:", aiErr.message);
      });

    // ─── GECE MODU: Otomatik ban zamanlayıcı başlat ────────────────────────────
    if (isNight) {
      const timeoutId = setTimeout(async () => {
        const pending = nightModePendingBans.get(key);
        if (!pending) return; // Bu sürede manuel işlem yapılmış veya yoksayılmış

        await executeNightModeAutoBan(client, guild, executor, type, detailLines);

        try {
          const freshMsg = await alertMsg.channel.messages.fetch(alertMsg.id);
          if (freshMsg) {
            const currentEmbed = freshMsg.embeds[0];
            if (currentEmbed) {
              const updatedEmbed = EmbedBuilder.from(currentEmbed)
                .setColor(0xFF0000)
                .setTitle("🚨 GECE MODU: OTOMATİK BAN UYGULANDI")
                .setDescription(
                  (currentEmbed.description || "") +
                  `\n\n⛔ **Süre Doldu:** 1 dakika içerisinde yanıt verilmediği için sistem kullanıcıyı otomatik olarak banladı ve Roblox grubundan çıkardı.`
                );

              const makeDisabledRow = () => {
                return new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId(`disc_abuse_removeroles_${guild.id}_${executor.id}`).setLabel("🗑️ Rolleri Al").setStyle(ButtonStyle.Secondary).setDisabled(true),
                  new ButtonBuilder().setCustomId(`disc_abuse_kick_${guild.id}_${executor.id}`).setLabel("At").setStyle(ButtonStyle.Danger).setDisabled(true),
                  new ButtonBuilder().setCustomId(`disc_abuse_ban_${guild.id}_${executor.id}`).setLabel("Banla").setStyle(ButtonStyle.Danger).setDisabled(true),
                  new ButtonBuilder().setCustomId(`disc_abuse_ignore_${guild.id}_${executor.id}`).setLabel("🚫 Süre Doldu").setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
              };

              await freshMsg.edit({ embeds: [updatedEmbed], components: [makeDisabledRow()] });
            }
          }
        } catch (err) {
          console.warn("[NightMode] Uyarı mesajı güncellenemedi:", err.message);
        }

        nightModePendingBans.delete(key);
      }, 60_000); // 1 dakika = 60000 ms

      nightModePendingBans.set(key, {
        timestamp: Date.now(),
        type,
        guild,
        executor,
        detailLines,
        client,
        timeoutId,
        messageId: alertMsg.id,
        channelId: alertMsg.channel.id
      });

      console.log(`[NightMode] ⏳ ${guild.name} — ${executor.tag} için 1 dakika bekleme başlandı`);
    }
  }
}

// ─── Olay işleyicileri ────────────────────────────────────────────────────────

async function handleBanAdd(client, ban) {
  if (!await isMonitoredGuild(ban.guild.id)) return;
  const executor = await fetchExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
  if (!executor) return;

  const exceeded = trackAction(ban.guild.id, executor.id, "BAN");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       ban.guild,
    executor,
    type:        "BAN",
    detailLines: [`• Banlanan: **${ban.user.tag}** (\`${ban.user.id}\`)`]
  });
}

async function handleChannelDelete(client, channel) {
  if (!channel.guild || !await isMonitoredGuild(channel.guild.id)) return;
  const executor = await fetchExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
  if (!executor) return;

  const exceeded = trackAction(channel.guild.id, executor.id, "CHANNEL_DELETE");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       channel.guild,
    executor,
    type:        "CHANNEL_DELETE",
    detailLines: [`• Silinen Kanal: **#${channel.name}** (${channel.type === 0 ? "Metin" : "Ses"} Kanalı)`]
  });
}

async function handleRoleDelete(client, role) {
  if (!await isMonitoredGuild(role.guild.id)) return;
  const executor = await fetchExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
  if (!executor) return;

  const exceeded = trackAction(role.guild.id, executor.id, "ROLE_DELETE");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       role.guild,
    executor,
    type:        "ROLE_DELETE",
    detailLines: [`• Silinen Rol: **${role.name}** (\`${role.id}\`)`]
  });
}

async function handleMemberRemove(client, member) {
  if (!await isMonitoredGuild(member.guild.id)) return;
  // Ayrılma mı atılma mı kontrol et
  const executor = await fetchExecutor(member.guild, AuditLogEvent.MemberKick, member.id, 5);
  if (!executor) return; // Sadece ayrılma — atılma değil

  const exceeded = trackAction(member.guild.id, executor.id, "KICK");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       member.guild,
    executor,
    type:        "KICK",
    detailLines: [`• Atılan Üye: **${member.user.tag}** (\`${member.id}\`)`]
  });
}

async function handleMessageCreateAbuse(client, message) {
  if (!message.guild || !await isMonitoredGuild(message.guild.id)) return;
  if (message.author.bot) return;

  let isAbuse = false;
  let type = null;
  const detailLines = [];

  // 1. Mass Mention Check
  const hasEveryonePing = message.mentions.everyone;
  const userMentions    = message.mentions.users.size;

  if (userMentions >= 10) {
    isAbuse = true;
    type = "MASS_MENTION";
    detailLines.push(`• **${userMentions}** farklı kullanıcı tek mesajda etiketlendi`);
  } else if (hasEveryonePing) {
    const exceeded = trackAction(message.guild.id, message.author.id, "EVERYONE_PING");
    if (exceeded) {
      isAbuse = true;
      type = "MASS_MENTION";
      detailLines.push("• `@everyone` veya `@here` etiketlendi (Son 60 saniyede 5 veya daha fazla)");
    }
  }

  // 2. Reklam/Invite Link Check
  const hasInviteLink = /(discord\.(gg|io|me|li)\/.+|discord(app)?\.com\/invite\/.+)/i.test(message.content);
  if (hasInviteLink) {
    const exceeded = trackAction(message.guild.id, message.author.id, "REKLAM");
    if (exceeded) {
      isAbuse = true;
      type = "REKLAM";
      detailLines.push("• Reklam/Davet linki spamı tespit edildi.");
    }
  }

  if (!isAbuse) return;

  detailLines.push(`• Kanal: <#${message.channel.id}>`);
  detailLines.push(`• Mesaj: ${message.content.slice(0, 200)}`);

  await sendDiscordAbuseAlert(client, {
    guild:       message.guild,
    executor:    message.author,
    type,
    detailLines
  });
}

async function handleRoleCreate(client, role) {
  if (!await isMonitoredGuild(role.guild.id)) return;
  const executor = await fetchExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
  if (!executor) return;

  const exceeded = trackAction(role.guild.id, executor.id, "ROLE_CREATE");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       role.guild,
    executor,
    type:        "ROLE_CREATE",
    detailLines: [`• Oluşturulan Rol: **${role.name}** (\`${role.id}\`)`]
  });
}

async function handleChannelCreate(client, channel) {
  if (!channel.guild || !await isMonitoredGuild(channel.guild.id)) return;
  const executor = await fetchExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
  if (!executor) return;

  const exceeded = trackAction(channel.guild.id, executor.id, "CHANNEL_CREATE");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       channel.guild,
    executor,
    type:        "CHANNEL_CREATE",
    detailLines: [`• Oluşturulan Kanal: **#${channel.name}** (${channel.type === 0 ? "Metin" : "Ses"} Kanalı)`]
  });
}

async function handleWebhookUpdate(client, channel) {
  if (!channel.guild || !await isMonitoredGuild(channel.guild.id)) return;
  const executor = await fetchExecutor(channel.guild, AuditLogEvent.WebhookCreate, null, 10);
  if (!executor) return;

  const exceeded = trackAction(channel.guild.id, executor.id, "WEBHOOK_CREATE");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       channel.guild,
    executor,
    type:        "WEBHOOK_CREATE",
    detailLines: [`• Webhook oluşturulan kanal: <#${channel.id}> (${channel.name})`]
  });
}

/**
 * Tüm Discord Abuse event listener'larını başlatır.
 */
function startDiscordAbuseDetector(client) {
  const gNames = Object.values(MONITORED_GUILDS).join(", ");
  console.log(`[DiscordAbuseDetector] Başlatıldı — İzlenen Sunucular: ${gNames}`);

  client.on("guildBanAdd",       (ban)     => handleBanAdd(client, ban).catch(e => console.error("[AbuseDetector] guildBanAdd:", e.message)));
  client.on("channelDelete",     (ch)      => handleChannelDelete(client, ch).catch(e => console.error("[AbuseDetector] channelDelete:", e.message)));
  client.on("roleDelete",        (role)    => handleRoleDelete(client, role).catch(e => console.error("[AbuseDetector] roleDelete:", e.message)));
  client.on("guildMemberRemove", (member)  => handleMemberRemove(client, member).catch(e => console.error("[AbuseDetector] guildMemberRemove:", e.message)));
  client.on("messageCreate",     (msg)     => handleMessageCreateAbuse(client, msg).catch(e => console.error("[AbuseDetector] messageCreateAbuse:", e.message)));
  
  client.on("roleCreate",        (role)    => handleRoleCreate(client, role).catch(e => console.error("[AbuseDetector] roleCreate:", e.message)));
  client.on("channelCreate",     (ch)      => handleChannelCreate(client, ch).catch(e => console.error("[AbuseDetector] channelCreate:", e.message)));
  client.on("webhooksUpdate",    (ch)      => handleWebhookUpdate(client, ch).catch(e => console.error("[AbuseDetector] webhookUpdate:", e.message)));
}

/**
 * GECE MODU: Otomatik ban ve grup atılması işlemi
 */
async function executeNightModeAutoBan(client, guild, executor, type, detailLines) {
  console.log(`[NightMode] 🔨 Otomatik ban başladı: ${guild.name} — ${executor.tag}`);

  // ─── 1. Discord sunucusundan banla ──────────────────────────────────────────
  try {
    await guild.members.ban(executor.id, {
      reason: `Abuse şüphesi (${type}) — Gece otomatik ban sistem`
    });
    console.log(`[NightMode] ✅ ${guild.name} — ${executor.tag} banlandı`);
  } catch (err) {
    console.error(`[NightMode] Ban hatası (${guild.name}):`, err.message);
  }

  // ─── 2. Roblox gruptan atma (TMT grup için) ──────────────────────────────────
  if (guild.id === "1514569307886063666") {
    try {
      console.log(`[NightMode] 📤 Roblox grup atılması işlemi başlatıldı: ${executor.tag}`);
      const User = require("../../models/User");
      const dbUser = await User.findOne({ discordId: executor.id });
      if (dbUser && dbUser.robloxId) {
        const targetRobloxId = parseInt(dbUser.robloxId, 10);
        const noblox = require("noblox.js");
        const tmtGroupId = 11517908;
        await noblox.exile(tmtGroupId, targetRobloxId);
        console.log(`[NightMode] ✅ Roblox'ta ${executor.tag} (Roblox ID: ${targetRobloxId}) gruptan atıldı.`);
      } else {
        console.log(`[NightMode] ⚠️ Roblox ID bulunamadı, gruptan atılamadı: ${executor.tag}`);
      }
    } catch (err) {
      console.warn(`[NightMode] Roblox gruptan atma hatası:`, err.message);
    }
  }

  // ─── 3. Ban loguna mesaj gönder ────────────────────────────────────────────
  try {
    const targetGuild = await client.guilds.fetch(guild.id);
    const banLogChannel = targetGuild.channels.cache.get("1504201531551907941");
    
    if (banLogChannel && banLogChannel.isTextBased()) {
      const banEmbed = new EmbedBuilder()
        .setTitle("🔨 GECE OTOMOTIK BAN")
        .setColor(0xFF0000)
        .addFields(
          { name: "👤 Banlanan Kullanıcı", value: `${executor.tag}\n\`${executor.id}\``, inline: true },
          { name: "🏠 Sunucu", value: `${MONITORED_GUILDS[guild.id] || guild.name}\n\`${guild.id}\``, inline: true },
          { name: "⚠️ Sebep", value: `Abuse şüphesi (${type})\nGece saatleri otomatik ban`, inline: false },
          { name: "🕐 Zaman", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: "↩️ Geri Alma", value: "Ban log kanalında geri al butonuna tıklayın", inline: true }
        )
        .setThumbnail(executor.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      const unbanBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`night_unban_${guild.id}_${executor.id}`)
          .setLabel("↩️ Banı Geri Al")
          .setStyle(ButtonStyle.Success)
          .setEmoji("↩️")
      );

      await banLogChannel.send({ embeds: [banEmbed], components: [unbanBtn] });
    }
  } catch (err) {
    console.warn(`[NightMode] Ban log kanal hatası:`, err.message);
  }

  // ─── 4. Admin ID'lerine DM gönder ──────────────────────────────────────────
  const NIGHT_ADMIN_IDS = ["1078049507230625963", "1031620522406072350"];
  for (const adminId of NIGHT_ADMIN_IDS) {
    try {
      const admin = await client.users.fetch(adminId);
      
      const adminEmbed = new EmbedBuilder()
        .setTitle("🚨 GECE OTOMOTIK BAN ÖZETİ")
        .setColor(0xFF0000)
        .setDescription(
          `${MONITORED_GUILDS[guild.id] || guild.name} sunucusunda geç saatlerde abuse şüphesi tespit edildi. ` +
          `Yanıt gelmediği için sistem otomatik olarak kullanıcıyı banladı.`
        )
        .addFields(
          { name: "👤 Banlanan", value: `${executor.tag}\n\`${executor.id}\``, inline: true },
          { name: "🏠 Sunucu", value: `${MONITORED_GUILDS[guild.id] || guild.name}`, inline: true },
          { name: "⚠️ Abuse Tipi", value: type, inline: true },
          { name: "🕐 Zaman", value: new Date().toLocaleString('tr-TR'), inline: true },
          { name: "📋 Detaylar", value: detailLines.join("\n") || "Detay yok", inline: false }
        )
        .setThumbnail(executor.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await admin.send({
        content: `⚠️ **Uyarı:** Gece otomatik ban sistemi tarafından bir kullanıcı banlandı.\n**Sebep:** Abuse şüphesi — ${type}`,
        embeds: [adminEmbed]
      });
    } catch (err) {
      console.warn(`[NightMode] Admin DM hatası (${adminId}):`, err.message);
    }
  }

  // ─── 5. Banlanan kullanıcıya DM gönder ────────────────────────────────────
  try {
    const userEmbed = new EmbedBuilder()
      .setTitle("⛔ BAN BİLDİRİMİ")
      .setColor(0xFF0000)
      .setDescription(
        `${MONITORED_GUILDS[guild.id] || guild.name} sunucusundan **banlandınız**.\n\n` +
        `**Sebep:** Abuse şüphesi — Gece saatleri otomatik ban sistemi\n` +
        `**Zaman:** Geç saatlerde (00:00-08:00)\n\n` +
        `**Banınızı Geri Almak İçin:**\n` +
        `1. Abuse Log kanalına gidin\n` +
        `2. Banlandığınız mesajın altında bulunan **↩️ Banı Geri Al** butonuna tıklayın`
      )
      .setFooter({ text: "Sentara Ban Sistemi" })
      .setTimestamp();

    await executor.send({ embeds: [userEmbed] });
  } catch (err) {
    console.warn(`[NightMode] Kullanıcı DM hatası:`, err.message);
  }
}

/**
 * Gece otomatik ban sonrası banı geri alma (buton)
 */
async function handleNightUnbanButton(interaction) {
  if (!interaction.customId?.startsWith('night_unban_')) return false;

  const parts = interaction.customId.split('_');
  const guildId = parts[2];
  const userId = parts[3];

  try {
    const guild = await interaction.client.guilds.fetch(guildId);
    const user = await interaction.client.users.fetch(userId);

    // Ban'ı kaldır
    await guild.bans.remove(userId, "Gece otomatik ban geri alındı");

    // Banı geri alan kişiye bildir
    await interaction.reply({
      content: `✅ **${user.tag}** kullanıcısının banı geri alındı.`,
      ephemeral: true
    });

    // Sunucu davet linki
    const inviteLink = SERVER_INVITE_LINKS[guildId] || `https://discord.gg/`;
    const guildName = MONITORED_GUILDS[guildId] || guild.name;

    // Banlanan kişiye DM gönder
    const userEmbed = new EmbedBuilder()
      .setTitle("✅ BAN GERİ ALINDI")
      .setColor(0x00FF00)
      .setDescription(
        `Banınız geri alındı. **${interaction.user.tag}** kişisi tarafından böyle bir sorun gerçekleştiği için üzgünüz.\n\n` +
        `**Sunucuya Geri Dönüş Davet Linki:**\n${inviteLink}`
      )
      .setFooter({ text: "Sentara Ban Sistemi" })
      .setTimestamp();

    await user.send({ embeds: [userEmbed] }).catch(() => {});

    console.log(`[NightMode] ✅ ${user.tag} (${userId}) banı geri alındı`);
  } catch (err) {
    console.error(`[NightMode] Ban geri alma hatası:`, err.message);
    await interaction.reply({
      content: `❌ Ban geri alma işleminde hata oluştu: ${err.message}`,
      ephemeral: true
    });
  }

  return true;
}

// ─── Moderatör Dismiss Notification Handler ───────────────────────────────────
/**
 * "BİLDİRİMİ KAPAT" butonuna tıklandığında çağrılır.
 * O kişi/sunucu kombinasyonu için tekrar DM atılmasını engeller.
 */
async function handleAbuseDismissButton(interaction) {
  try {
    const parts = interaction.customId.split("_");
    const guildId = parts[2];
    const executorId = parts[3];
    const dismissKey = `${guildId}_${executorId}`;

    // Mark as dismissed
    dismissedNotifications.set(dismissKey, true);
    
    // 24 saat sonra reset et (tekrar DM gönderilme başlamadan)
    setTimeout(() => {
      dismissedNotifications.delete(dismissKey);
      console.log(`[AbuseDismiss] 🔄 ${dismissKey} dismiss'i 24 saat sonra reset edildi`);
    }, 24 * 60 * 60 * 1000); // 24 saat

    // Moderatöre bildir
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    await interaction.editReply({
      content: "✅ **BİLDİRİM KAPATILDI**\n\nBu kişi için bir daha DM almayacaksınız (24 saat boyunca).",
      ephemeral: true
    }).catch(() => {});

    console.log(`[AbuseDismiss] 🚫 ${dismissKey} dismiss edildi (${interaction.user.tag})`);
  } catch (err) {
    console.error("[handleAbuseDismissButton] Hata:", err.message);
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    await interaction.editReply({
      content: `❌ Hata: ${err.message}`,
      ephemeral: true
    }).catch(() => {});
  }
}

async function executeImmediateAbuseAction(client, guild, member, type, detailLines) {
  console.log(`[AbuseDetector] ⚡ Sunucu Yetkili/Üye Otomatik Müdahalesi: ${member.user.tag} (Type: ${type})`);

  const details = detailLines.join(" | ");
  
  // 1. AI Yorumu Üret
  let aiComment = "Yaptığınız kural dışı eylemler sebebiyle sunucudan uzaklaştırıldınız.";
  try {
    const { chatWithAI } = require("./aiService");
    const aiPrompt = "Sen bir Discord moderasyon yapay zekasısın. Bir sunucu yetkilisi/üyesi sunucuda kural ihlali (spam/reklam, herkesi etiketleme veya kanalları/rolleri silme gibi sabotajlar) yaptı ve sistem tarafından otomatik cezalandırıldı. Ona neden yaptığının çok kötü olduğunu, sunucu düzenini bozduğunu anlatan resmi, sert ve iğneleyici bir uyarı mesajı yaz (Türkçe, maksimum 250 karakter, doğrudan kullanıcıya hitap et).";
    aiComment = await chatWithAI(`Kullanıcı eylemi: ${type} (${details})`, aiPrompt).catch(() => aiComment);
  } catch (err) {
    console.error("[AbuseDetector] AI yorum hatası:", err.message);
  }

  // 2. DM Gönder
  try {
    await member.send(
      `⚠️ **Sunucuda Kural İhlali Tespit Edildi!**\n\n` +
      `**Uygulanan İşlem:** Hesap askıya alındı / uzaklaştırıldı.\n` +
      `**Yapay Zeka Yorumu:**\n> *${aiComment}*\n\n` +
      `Lütfen kurallara riayet ediniz.`
    ).catch(() => {});
  } catch (err) {
    console.warn(`[AbuseDetector] Cezalı kullanıcıya DM gönderilemedi:`, err.message);
  }

  // 3. Eyleme Karar Ver ve Uygula
  const isSevere = ["BAN", "KICK", "CHANNEL_DELETE", "ROLE_DELETE"].includes(type);

  if (isSevere) {
    // BANLA
    try {
      await guild.members.ban(member.id, { reason: `Otomatik Abuse Engelleme: ${type}` }).catch(() => {});
      console.log(`[AbuseDetector] ✅ Banned user ${member.user.tag} for severe abuse (${type}).`);
    } catch (err) {
      console.error(`[AbuseDetector] Ban hatası:`, err.message);
    }
  } else {
    // TIMEOUT + ROLE STRIP
    try {
      // Rolleri al
      const removableRoles = member.roles.cache.filter(r =>
        r.id !== guild.id &&
        !r.managed &&
        guild.members.me?.roles.highest.comparePositionTo(r) > 0
      );
      if (removableRoles.size > 0) {
        await member.roles.remove(removableRoles, `Otomatik Abuse Cezası: ${type}`).catch(() => {});
      }
      
      // 28 gün zamanaşımı
      await member.timeout(28 * 24 * 60 * 60 * 1000, `Otomatik Abuse Cezası: ${type}`).catch(() => {});
      console.log(`[AbuseDetector] ✅ Stripped roles and timed out user ${member.user.tag} for abuse (${type}).`);
    } catch (err) {
      console.error(`[AbuseDetector] Timeout/Role Strip hatası:`, err.message);
    }
  }

  // 4. Log Kanalına Gönder
  try {
    const banLogChannel = guild.channels.cache.get("1504201531551907941");
    const logEmbed = new EmbedBuilder()
      .setTitle("⚡ OTOMATİK ABUSE ENGELLEME (MÜDAHALE)")
      .setColor(0xFF0000)
      .setDescription(
        `**${member.user.tag}** kullanıcısının yaptığı eylem otomatik olarak engellendi.\n\n` +
        `**Kullanıcıya Gönderilen AI Yorumu:**\n*${aiComment}*`
      )
      .addFields(
        { name: "👤 Cezalandırılan Üye", value: `${member.toString()}\nTag: \`${member.user.tag}\`\nID: \`${member.id}\``, inline: true },
        { name: "⚠️ İhlal Türü", value: type, inline: true },
        { name: "🛠️ Uygulanan Ceza", value: isSevere ? "🔨 Sunucudan Banlama" : "🔇 Yetkilerinin Alınması + 28 Gün Zamanaşımı", inline: true },
        { name: "📋 İhlal Detayları", value: detailLines.join("\n") || "Detay yok", inline: false }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    if (banLogChannel && banLogChannel.isTextBased()) {
      await banLogChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }

    // Forward to setup archive channel if configured
    const ServerSetup = require("../../models/ServerSetup");
    const setupDoc = await ServerSetup.findOne({ guildId: guild.id, status: "active" });
    if (setupDoc && setupDoc.archiveChannelId) {
      const centralGuild = client.guilds.cache.get("1483482948320891074");
      if (centralGuild) {
        const archChan = centralGuild.channels.cache.get(setupDoc.archiveChannelId)
          || await centralGuild.channels.fetch(setupDoc.archiveChannelId).catch(() => null);
        if (archChan && archChan.isTextBased()) {
          await archChan.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn(`[AbuseDetector] Log channel/archive log error:`, err.message);
  }
}

module.exports = { 
  startDiscordAbuseDetector, 
  MONITORED_GUILDS,
  handleNightUnbanButton,
  handleAbuseDismissButton,
  cancelPendingNightBan,
  cancelPendingAIBan,
  nightModePendingBans
};
