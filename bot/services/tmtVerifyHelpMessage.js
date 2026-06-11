/**
 * TMT Verification Help Message Service
 * Posts verification instructions to TMT server
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { TMT_GUILD_ID, TMT_VERIFY_HELP_CHANNEL_ID } = require("../../config");

/**
 * Post verification help message to TMT server
 */
async function postTMTVerifyHelpMessage(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID);
    const channel = await guild.channels.fetch(TMT_VERIFY_HELP_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle("🎖️ Doğrulama Yardımı")
      .setDescription(
        "Roblox hesabınızı Discord hesabınıza bağlayarak sunucudaki rollerinizi senkronize edebilirsiniz.\n\n"
      )
      .setColor(0xDC143C)
      .addFields(
        {
          name: "📋 Doğrulama Adımları",
          value: 
            "1. `/authorize` komutunu çalıştırın\n" +
            "2. Açılan linke tıklayın\n" +
            "3. **Aynı Discord hesabıyla** giriş yapın\n" +
            "4. Roblox hesabınızı bağlayın\n" +
            "5. `/verify` komutunu çalıştırarak rollerinizi sinkronize edin",
          inline: false,
        },
        {
          name: "🔄 Roller Nasıl Sinkronize Edilir?",
          value:
            "**Ana Grup:** Roblox grup 11517908'deki rütbenize göre Discord rolleri atanır\n\n" +
            "**Branş Grupları:**\n" +
            "• Sınır Müfettişleri\n" +
            "• Hava Kuvvetleri\n" +
            "• Jandarma\n" +
            "• Özel Kuvvetler\n" +
            "• Kara Kuvvetleri\n" +
            "• Askeri İnzibat\n\n" +
            "Her branşda bulunursanız o branşın rolü alırsınız. Rütbe 100+ ise branş yetkilisi rolü de eklenir.",
          inline: false,
        }
      )
      .setFooter({ text: "TMT Doğrulama Sistemi" })
      .setTimestamp();

    const authorizeButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("authorize_button")
        .setLabel("🔐 Yetkilendirmek İçin Tıkla")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("verify_button")
        .setLabel("✅ Rollerimi Sinkronize Et")
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [authorizeButton] });
    console.log("✅ TMT doğrulama yardım mesajı gönderildi");
    return true;
  } catch (error) {
    console.error("❌ TMT doğrulama yardım mesajı gönderilirken hata:", error);
    return false;
  }
}

/**
 * Ensure verification help message exists
 */
async function ensureTMTVerifyHelpMessage(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID);
    const channel = await guild.channels.fetch(TMT_VERIFY_HELP_CHANNEL_ID);
    
    const messages = await channel.messages.fetch({ limit: 10 });
    const existingMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
    
    if (!existingMessage) {
      await postTMTVerifyHelpMessage(client);
    }
  } catch (error) {
    console.error("❌ TMT doğrulama mesajı kontrol edilirken hata:", error);
  }
}

module.exports = {
  postTMTVerifyHelpMessage,
  ensureTMTVerifyHelpMessage,
};
