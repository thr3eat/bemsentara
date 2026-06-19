const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CHANNELS } = require('./staffAutomation');

async function ensureAdminPanels(client) {
  try {
    // 1. Bot Komut Rehberi
    const cmdGuideChannel = await client.channels.fetch('1466947058442305637').catch(() => null);
    if (cmdGuideChannel && cmdGuideChannel.isTextBased()) {
      const messages = await cmdGuideChannel.messages.fetch({ limit: 5 });
      if (!messages.find(m => m.author.id === client.user.id)) {
        const embed = new EmbedBuilder()
          .setTitle("📚 Bot Komut Rehberi")
          .setDescription("Aşağıdaki komutları kullanarak botun özelliklerini kullanabilirsiniz:\n\n`/profil` - Personel bilgilerinizi ve XP'nizi gösterir.\n`/odulver (kullanıcı) (ödül)` - (Sadece Yöneticiler) Bir personele ödül verir ve terfi ettirir.\n`/konus (kullanıcı) (konu)` - (Sadece Yöneticiler) AI destekli kullanıcı uyarısı/konuşması başlatır.\n`/authorize` - Roblox hesabınızı doğrulamak için kullanılır.")
          .setColor(0x3498DB);
        await cmdGuideChannel.send({ embeds: [embed] });
      }
    }

    // 2. İzin Formu
    const leaveFormChannel = await client.channels.fetch('1466945552385048776').catch(() => null);
    if (leaveFormChannel && leaveFormChannel.isTextBased()) {
      const messages = await leaveFormChannel.messages.fetch({ limit: 5 });
      if (!messages.find(m => m.author.id === client.user.id)) {
        const embed = new EmbedBuilder()
          .setTitle("🏖️ Mod İnaktiflik & İzin Formu")
          .setDescription("İzin almak için aşağıdaki butona tıklayın ve formu doldurun. Talebiniz Yapay Zeka tarafından incelenecek ve otomatik olarak işleme alınacaktır.")
          .setColor(0xF1C40F);
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_leave_form').setLabel('İzin Formu Doldur').setStyle(ButtonStyle.Primary).setEmoji('📝')
        );
        await leaveFormChannel.send({ embeds: [embed], components: [row] });
      }
    }

    // 3. Tavsiye Formu
    const suggestionChannel = await client.channels.fetch('1466946002547249296').catch(() => null);
    if (suggestionChannel && suggestionChannel.isTextBased()) {
      const messages = await suggestionChannel.messages.fetch({ limit: 5 });
      if (!messages.find(m => m.author.id === client.user.id)) {
        const embed = new EmbedBuilder()
          .setTitle("💡 Tavsiye & Öneri Formu")
          .setDescription("Sunucumuz veya personel ekibimiz için bir tavsiyeniz mi var? Aşağıdaki formdan bize iletin.")
          .setColor(0x2ECC71);
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_suggestion_form').setLabel('Tavsiye Gönder').setStyle(ButtonStyle.Success).setEmoji('💭')
        );
        await suggestionChannel.send({ embeds: [embed], components: [row] });
      }
    }

    // 4. İstifa Formu
    const resignChannel = await client.channels.fetch('1466945894250188912').catch(() => null);
    if (resignChannel && resignChannel.isTextBased()) {
      const messages = await resignChannel.messages.fetch({ limit: 5 });
      if (!messages.find(m => m.author.id === client.user.id)) {
        const embed = new EmbedBuilder()
          .setTitle("🚪 İstifa Formu")
          .setDescription("EkoYıldız ekibinden ayrılmak istiyorsanız bu formu doldurabilirsiniz. Unutmayın, bu işlem **geri alınamaz**.")
          .setColor(0xE74C3C);
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_resign_form').setLabel('İstifa Et').setStyle(ButtonStyle.Danger).setEmoji('⚠️')
        );
        await resignChannel.send({ embeds: [embed], components: [row] });
      }
    }

    // 5. Kanıtlı Mod İşlem Formu
    const modActionChannel = await client.channels.fetch('1466946794763321394').catch(() => null);
    if (modActionChannel && modActionChannel.isTextBased()) {
      const messages = await modActionChannel.messages.fetch({ limit: 5 });
      if (!messages.find(m => m.author.id === client.user.id)) {
        const embed = new EmbedBuilder()
          .setTitle("⚖️ Moderatör İşlem Formu (Kanıtlı)")
          .setDescription("Uyguladığınız cezalar (Ban, Mute, Kick vb.) için kanıt sunmak zorundasınız. İşleminizi raporlamak için aşağıdaki butona tıklayın.")
          .setColor(0x9B59B6);
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_modaction_form').setLabel('İşlem Raporla').setStyle(ButtonStyle.Primary).setEmoji('🔨')
        );
        await modActionChannel.send({ embeds: [embed], components: [row] });
      }
    }

  } catch (error) {
    console.error("[PanelManager] ensureAdminPanels Error:", error);
  }
}

module.exports = {
  ensureAdminPanels
};
