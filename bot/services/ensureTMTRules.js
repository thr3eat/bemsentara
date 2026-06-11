const { EmbedBuilder } = require("discord.js");
const { 
  TMT_GUILD_ID, 
  TMT_RULES_CHANNEL_ID, 
  TMT_AUTOMOD_RULES_CHANNEL_ID,
  TMT_HONEYPOT_CHANNEL_ID 
} = require("../../config");
const { postTMTRules } = require("./tmtRulesService");

/**
 * Checks if TMT rule channels have the required rules, and if not, posts them.
 * Also ensures the Honeypot channel has the persistent warning message.
 */
async function ensureTMTRules(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID).catch(() => null);
    if (!guild) return; // TMT guild bulunamadıysa çık

    // 1. Kurallar ve Otomod Kuralları
    if (TMT_RULES_CHANNEL_ID && TMT_AUTOMOD_RULES_CHANNEL_ID) {
      const rulesChannel = await guild.channels.fetch(TMT_RULES_CHANNEL_ID).catch(() => null);
      if (rulesChannel) {
        // Kanalda mesaj var mı kontrol et
        const messages = await rulesChannel.messages.fetch({ limit: 5 }).catch(() => null);
        if (messages && messages.size === 0) {
          console.log("[TMT Rules] Kurallar kanalı boş, kurallar gönderiliyor...");
          await postTMTRules(client);
        }
      }
    }

    // 2. Honeypot Uyarı Mesajı
    if (TMT_HONEYPOT_CHANNEL_ID) {
      const honeypotChannel = await guild.channels.fetch(TMT_HONEYPOT_CHANNEL_ID).catch(() => null);
      if (honeypotChannel) {
        const messages = await honeypotChannel.messages.fetch({ limit: 10 }).catch(() => null);
        
        // Eğer kanalda uyarı mesajımız yoksa atalım (botun attığı mesaj var mı diye bakıyoruz)
        const hasWarning = messages && messages.some(m => m.author.id === client.user.id && m.content.includes("BURAYA MESAJ GÖNDERMEYİN"));
        
        if (!hasWarning) {
          console.log("[TMT Honeypot] Uyarı mesajı eksik, gönderiliyor...");
          await honeypotChannel.send(
            "**BURAYA MESAJ GÖNDERMEYİN**\n" +
            "Bu kanal botlar ve çalınmış hesapları tespit etmek içindir, mesaj yazmak SUNUCUDAN ATILMAK ile sonuçlanacaktır."
          ).catch(() => {});
        }
      }
    }
  } catch (error) {
    console.error("❌ ensureTMTRules çalıştırılırken hata:", error);
  }
}

module.exports = {
  ensureTMTRules
};
