const { SlashCommandBuilder } = require("discord.js");
const User = require("../../models/User");
const { saveStoreNow } = require("../../models/Store");
const { Ephemeral } = require("../utils/interaction");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dogrula")
    .setDescription("Siteden aldığınız 4 haneli PIN kodu ile hesabınızı doğrulayın.")
    .addStringOption((option) =>
      option
        .setName("pin")
        .setDescription("Siteden aldığınız 4 haneli PIN")
        .setRequired(true)
    ),
  category: "General",
  async execute(interaction, client) {
    const pin = interaction.options.getString("pin").trim();

    try {
      const user = await User.findOne({ discordId: interaction.user.id });
      
      if (!user) {
        return interaction.reply(Ephemeral("❌ Sitemize giriş yapmış bir hesabınız bulunamadı. Lütfen önce siteye giriş yapın."));
      }

      if (user.botVerified) {
        return interaction.reply(Ephemeral("✅ Hesabınız zaten doğrulanmış. Botu kullanabilirsiniz."));
      }

      if (!user.botPin) {
        return interaction.reply(Ephemeral("❌ Siteden henüz bir PIN oluşturmamışsınız. Lütfen siteye gidip 'Kodu Al' butonuna tıklayın."));
      }

      if (user.botPin === pin) {
        // Success
        user.botVerified = true;
        user.botPin = null; // Clear PIN after use
        await saveStoreNow();
        
        logger.log(`[BOT] ${interaction.user.tag} botu başarıyla doğruladı.`);
        return interaction.reply(Ephemeral("🎉 **Tebrikler!** Hesabınız başarıyla doğrulandı. Artık Sentara Premium botunu özgürce kullanabilirsiniz."));
      } else {
        return interaction.reply(Ephemeral("❌ **Hatalı PIN!** Lütfen sitede gördüğünüz 4 haneli PIN kodunu doğru girdiğinizden emin olun."));
      }
    } catch (err) {
      console.error("[dogrula] Error:", err);
      return interaction.reply(Ephemeral("❌ Bir hata oluştu. Daha sonra tekrar deneyin."));
    }
  },
};
