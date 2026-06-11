const { AutoModerationRuleEventType, AutoModerationRuleTriggerType, AutoModerationActionType, AutoModerationRuleKeywordPresetType } = require('discord.js');
const { TMT_GUILD_ID } = require('../../config');

const RULE_PREFIX = "[TMT] ";

// ─── 1.0 Kişisel Bilgiler Regex ─────────────────────────────────────────────
// Sadece telefon numarası, IP ve potansiyel TCKN (11 hane) için
const PERSONAL_INFO_REGEX = [
  "(?:0|\\+90|90)?\\s*[1-9]\\d{2}\\s*\\d{3}\\s*\\d{2}\\s*\\d{2}", // TR Phone
  "\\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b", // IPv4
  "\\b[1-9]\\d{10}\\b" // TR ID (11 digits starting non-zero) - broad match
];

// ─── 1.1 Toksik Kelimeler ───────────────────────────────────────────────────
const TOXIC_KEYWORDS = [
  // 1. Doğrudan Ağır Küfürler
  "*am*", "*amk*", "*aq*", "*amq*", "*amcık*", "*am feryadı*", "*hoşafı*", "*göt*", "*gavat*", "*godoş*", "*gaddar*", "*gote*", "*götveren*", "*götoş*",
  "*sik*", "*siktir*", "*sikik*", "*sik kırığı*", "*sik kafalı*", "*sikiş*", "*yarak*", "*yarrak*", "*yarram*", "*yarrak kafalı*",
  "*piç*", "*orospu*", "*oç*", "*o.ç*", "*kancık*", "*kahpe*", "*kaltak*", "*fahişe*", "*yosma*", "*sülaleni*", "*soyunu sopunu*",
  // 2. Ailevi/Kutsal Değerlere
  "*ananı*", "*anancı*", "*ana bacı*", "*babanı*", "*bacını*", "*kız kardeşini*", "*ceddin*", "*gelmişini*", "*geçmişini*",
  "*allahını*", "*kitabını*", "*dinini*", "*kutsalını*", "*muhammedini*",
  // 3. Hakaretler/Argo
  "*geri zekalı*", "*gerizekalı*", "*salak*", "*aptal*", "*mal*", "*mal herif*", "*ibne*", "*top*", "*puşt*", "*nonoş*"
].map(w => w.toLowerCase()); // Discord expects lowercase

// ─── 1.2 Siyasi Parti ve Liderler ───────────────────────────────────────────
const POLITICAL_KEYWORDS = [
  // Partiler
  "*akp*", "*ak parti*", "*akparti*", "*chp*", "*cehape*", "*mhp*", "*mehape*", "*dem parti*", "*demparti*", "*hdp*", "*hedape*",
  "*iyi parti*", "*iyiparti*", "*zafer partisi*", "*yeniden refah*", "*yrp*", "*tip*", "*tipçiler*", "*hüda par*", "*hudapar*",
  // Liderler
  "*erdoğan*", "*tayyip*", "*rte*", "*reis*", "*cb*", "*özgür özel*", "*imamoğlu*", "*ekrem imamoğlu*", "*mansur yavaş*",
  "*devlet bahçeli*", "*bahçeli*", "*ümit özdağ*", "*özdağ*", "*fatih erbakan*", "*selahattin demirtaş*", "*demirtaş*", "*selo*", "*kemal kılıçdaroğlu*"
].map(w => w.toLowerCase());

// ─── 1.3 Discord Bağlantıları ───────────────────────────────────────────────
// Sadece invite linklerini yakalamak için Regex ve kelimeler
const DISCORD_LINK_REGEX = [
  "(?:https?://)?(?:www\\.)?(?:discord\\.(?:gg|io|me|li)|discordapp\\.com/invite)/[a-zA-Z0-9]+"
];

/**
 * TMT sunucusundaki Otomod kurallarını kontrol eder ve yoksa/hatalıysa kurar.
 * @param {import('discord.js').Client} client 
 */
async function ensureTMTAutoMod(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID).catch(() => null);
    if (!guild) {
      console.warn("⚠️ [TMT AutoMod] Sunucu bulunamadı.");
      return;
    }

    // Gerekli Rolleri Bul (Ordu Yönetimi, Moderatör Ekibi)
    let exemptRoles = [];
    const orduRole = guild.roles.cache.find(r => r.name.toLowerCase() === "ordu yönetimi");
    const modRole = guild.roles.cache.find(r => r.name.toLowerCase() === "moderatör ekibi");
    
    if (orduRole) exemptRoles.push(orduRole.id);
    if (modRole) exemptRoles.push(modRole.id);

    const rules = await guild.autoModerationRules.fetch();

    // ── 1.0 Kişisel Bilgilerin Koruması (BAN) ──
    const rule1Name = `${RULE_PREFIX}1.0 Kişisel Bilgiler`;
    if (!rules.some(r => r.name === rule1Name)) {
      await guild.autoModerationRules.create({
        name: rule1Name,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          regexPatterns: PERSONAL_INFO_REGEX
        },
        actions: [
          { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Kişisel bilgi paylaşımı yasaktır. (Kural 1.0)" } }
        ],
        enabled: true,
        reason: "TMT 1.0 Otomod Modülü"
      });
      console.log(`✅ ${rule1Name} kuralı oluşturuldu.`);
    }

    // ── 1.1 Toksik Kelime Moderasyonu ──
    const rule2Name = `${RULE_PREFIX}1.1 Toksik Kelimeler`;
    if (!rules.some(r => r.name === rule2Name)) {
      await guild.autoModerationRules.create({
        name: rule2Name,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          keywordFilter: TOXIC_KEYWORDS
        },
        actions: [
          { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Küfür veya toksik ifadeler yasaktır. (Kural 1.1)" } },
          { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 86400 } } // 1 Gün
        ],
        exemptRoles,
        enabled: true,
        reason: "TMT 1.1 Otomod Modülü"
      });
      console.log(`✅ ${rule2Name} kuralı oluşturuldu.`);
    }

    // ── 1.2 Siyasi Parti Moderasyonu ──
    const rule3Name = `${RULE_PREFIX}1.2 Siyaset`;
    if (!rules.some(r => r.name === rule3Name)) {
      await guild.autoModerationRules.create({
        name: rule3Name,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          keywordFilter: POLITICAL_KEYWORDS
        },
        actions: [
          { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Siyasi parti ve liderler hakkında konuşmak yasaktır. (Kural 1.2)" } },
          { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 86400 } } // 1 Gün
        ],
        exemptRoles,
        enabled: true,
        reason: "TMT 1.2 Otomod Modülü"
      });
      console.log(`✅ ${rule3Name} kuralı oluşturuldu.`);
    }

    // ── 1.3 Discord Bağlantı Moderasyonu ──
    const rule4Name = `${RULE_PREFIX}1.3 Discord Linkleri`;
    if (!rules.some(r => r.name === rule4Name)) {
      await guild.autoModerationRules.create({
        name: rule4Name,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          regexPatterns: DISCORD_LINK_REGEX
        },
        actions: [
          { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Discord sunucu davet linki paylaşmak yasaktır. (Kural 1.3)" } },
          { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 86400 } } // 1 Gün
        ],
        exemptRoles,
        enabled: true,
        reason: "TMT 1.3 Otomod Modülü"
      });
      console.log(`✅ ${rule4Name} kuralı oluşturuldu.`);
    }

    // ── 1.4 Etiket Spam Engeli ──
    const rule5Name = `${RULE_PREFIX}1.4 Etiket Spam`;
    if (!rules.some(r => r.name === rule5Name)) {
      await guild.autoModerationRules.create({
        name: rule5Name,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.MentionSpam,
        triggerMetadata: {
          mentionTotalLimit: 3
        },
        actions: [
          { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Çok fazla kişiyi etiketlediniz! (Kural 1.4)" } },
          { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 600 } } // 10 Dakika
        ],
        exemptRoles,
        enabled: true,
        reason: "TMT 1.4 Otomod Modülü"
      });
      console.log(`✅ ${rule5Name} kuralı oluşturuldu.`);
    }

    console.log("✅ TMT Otomod kuralları doğrulandı.");
  } catch (err) {
    console.error("❌ TMT Otomod kuralları kontrolünde hata:", err.message);
  }
}

module.exports = {
  ensureTMTAutoMod,
  RULE_PREFIX
};
