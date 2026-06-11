const noblox = require("noblox.js");
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
require("dotenv").config(); // Ensure env variables are loaded if not already

// TMT Roblox Group IDs mapped to their names (from user prompt and tmtBranchSync)
const ROBLOX_GROUPS = {
  "35212138": "TMT Akademi",
  "33709461": "TMT Askeri İnzibat",
  "35430592": "TMT Birimler Bölükler",
  "5415548": "TMT Deniz Kuvvetleri Komutanlığı",
  "35212127": "TMT Genel Branş Komutanlığı",
  "33709391": "TMT Hava Kuvvetleri",
  "35432150": "TMT Hudut Müfettişleri",
  "12008462": "TMT Jandarma Genel Komutanlığı",
  "33714381": "TMT Kara Kuvvetleri Komutanlığı",
  "35528574": "TMT Ministry of Foreign Affairs",
  "33708598": "TMT Özel Kuvvetler Komutanlığı",
  "11517908": "TMT Turkish Armed Forces",
  "35528598": "TMT RAIDERS",
  "35528556": "TMT Sürücü Okulu"
};

const ROBLOX_MENU_CHANNEL_ID = "1514659720751874150";

/**
 * Initializes Roblox connection using TMTCOOKIE
 */
async function initializeRoblox() {
  const cookie = process.env.TMTCOOKIE;
  if (!cookie) {
    console.warn("⚠️ [RobloxGroupManager] TMTCOOKIE ortam değişkeni bulunamadı. Roblox özellikleri çalışmayacak.");
    return false;
  }

  try {
    const currentUser = await noblox.setCookie(cookie);
    console.log(`✅ [RobloxGroupManager] Roblox'a başarıyla giriş yapıldı! Kullanıcı: ${currentUser.UserName} (${currentUser.UserID})`);
    return true;
  } catch (err) {
    console.error("❌ [RobloxGroupManager] Roblox giriş hatası (Cookie süresi dolmuş veya geçersiz olabilir):", err.message);
    return false;
  }
}

/**
 * Posts or ensures the Roblox Group Management menu exists in the target channel
 * @param {import('discord.js').Client} client 
 */
async function ensureRobloxManagementMenu(client) {
  try {
    const channel = await client.channels.fetch(ROBLOX_MENU_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.warn("⚠️ [RobloxGroupManager] Roblox yönetim kanalı bulunamadı:", ROBLOX_MENU_CHANNEL_ID);
      return;
    }

    // Look for existing message
    const messages = await channel.messages.fetch({ limit: 10 });
    const existingMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title === "🛡️ TMT Roblox Grup Yönetimi");

    if (!existingMessage) {
      const embed = new EmbedBuilder()
        .setTitle("🛡️ TMT Roblox Grup Yönetimi")
        .setDescription("Aşağıdaki menüden işlem yapmak istediğiniz Roblox grubunu seçin.\n\n**⚠️ GÜVENLİK UYARISI:**\nBu sistem sadece **Yönetim** ekibi tarafından kullanılabilir. Yapılan tüm rütbe değişiklikleri ve katılım onayları sistem tarafından kayıt altına alınmaktadır.")
        .setColor(0x2B2D31)
        .setThumbnail("https://media.discordapp.net/attachments/1437481457344974992/1514662015845793833/Gemini_Generated_Image_6ahowd6ahowd6aho_1.png?ex=6a2c2e6d&is=6a2adced&hm=15771d7c335f3c79642a0026f75dbe2ee149e93e6da0fb97850f03b14f2dee79&=&format=webp&quality=lossless&width=1872&height=592") // Roblox Icon or TMT Icon
        .setFooter({ text: "TMT Yüksek Güvenlikli Otomasyon Sistemi" });

      // Create dropdown options
      const options = Object.entries(ROBLOX_GROUPS).map(([id, name]) => ({
        label: name,
        value: `rbx_grp_${id}`,
        description: `ID: ${id}`,
        emoji: "🏢"
      }));

      // A Select Menu can only hold up to 25 options, we have 14, so it fits perfectly.
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("roblox_group_select")
          .setPlaceholder("Yönetmek istediğiniz grubu seçin...")
          .addOptions(options)
      );

      await channel.send({ embeds: [embed], components: [row] });
      console.log("✅ [RobloxGroupManager] Roblox Grup Yönetim menüsü gönderildi.");
    }
  } catch (error) {
    console.error("❌ [RobloxGroupManager] Menü oluşturulurken hata:", error.message);
  }
}

module.exports = {
  initializeRoblox,
  ensureRobloxManagementMenu,
  ROBLOX_GROUPS
};
