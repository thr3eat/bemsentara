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
        
        let shouldSend = true;
        if (messages && messages.size > 0) {
          const ourEmbedMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes("GÜVENLİK UYARISI"));
          if (ourEmbedMessage) {
            shouldSend = false;
          } else {
            // Eski mesajları temizle
            await honeypotChannel.bulkDelete(messages).catch(() => {});
          }
        }
        
        if (shouldSend) {
          console.log("[TMT Honeypot] Uyarı embedi eksik, gönderiliyor...");
          
          const honeypotEmbed = new EmbedBuilder()
            .setTitle("🚨 GÜVENLİK UYARISI 🚨")
            .setDescription(
              "**BURAYA KESİNLİKLE MESAJ GÖNDERMEYİN!**\n\n" +
              "Bu kanal, sunucu güvenliğini tehdit eden bot hesapları ve çalınmış hesapları tespit etmek amacıyla oluşturulmuş bir **tuzak (honeypot) kanalıdır**.\n\n" +
              "⚠️ **DİKKAT:** Bu kanala mesaj yazan herhangi bir kullanıcı, sebebi ne olursa olsun sistem tarafından **OTOMATİK OLARAK SUNUCUDAN ATILACAKTIR** (Kick).\n\n" +
              "Lütfen bu kanalı görmezden gelin ve sohbet için diğer kanalları kullanın."
            )
            .setColor(0xFF0000)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: "TMT Otomatik Güvenlik Sistemi" })
            .setTimestamp();

          await honeypotChannel.send({ embeds: [honeypotEmbed] }).catch(() => {});
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
