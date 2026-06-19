const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CHANNELS } = require('./staffAutomation');

async function refreshPanel(client, channelId, embed, components = []) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel && channel.isTextBased()) {
    try {
      const messages = await channel.messages.fetch({ limit: 50 });
      const botMessages = messages.filter(m => m.author.id === client.user.id);
      for (const [id, msg] of botMessages) {
        await msg.delete().catch(() => {});
      }
      
      const msgOptions = { embeds: [embed] };
      if (components.length > 0) msgOptions.components = components;
      await channel.send(msgOptions);
    } catch (e) {
      console.error(`[PanelManager] refreshPanel Error for ${channelId}:`, e.message);
    }
  }
}

async function ensureAdminPanels(client) {
  try {
    // 1. Bot Komut Rehberi
    const cmdEmbed = new EmbedBuilder()
      .setTitle("📚 Bot Komut Rehberi")
      .setDescription("Aşağıdaki komutları kullanarak botun özelliklerini kullanabilirsiniz:\n\n`/profil` - Personel bilgilerinizi ve XP'nizi gösterir.\n`/odulver (kullanıcı) (ödül)` - (Sadece Yöneticiler) Bir personele ödül verir ve terfi ettirir.\n`/konus (kullanıcı) (konu)` - (Sadece Yöneticiler) AI destekli kullanıcı uyarısı/konuşması başlatır.\n`/personel-dogrula` - Roblox hesabınızı doğrulamak için kullanılır.\n`/izin_iste` - İzin talebinde bulunursunuz.")
      .setColor(0x3498DB);
    await refreshPanel(client, '1466947058442305637', cmdEmbed);

    // 2. İzin Formu
    const leaveEmbed = new EmbedBuilder()
      .setTitle("🏖️ Mod İnaktiflik & İzin Formu")
      .setDescription("İzin almak için aşağıdaki butona tıklayın ve formu doldurun. Talebiniz Yapay Zeka tarafından incelenecek ve otomatik olarak işleme alınacaktır.")
      .setColor(0xF1C40F);
    const leaveRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_leave_form').setLabel('İzin Formu Doldur').setStyle(ButtonStyle.Primary).setEmoji('📝')
    );
    await refreshPanel(client, '1466945552385048776', leaveEmbed, [leaveRow]);

    // 3. Tavsiye Formu
    const suggestionEmbed = new EmbedBuilder()
      .setTitle("💡 Tavsiye & Öneri Formu")
      .setDescription("Sunucumuz veya personel ekibimiz için bir tavsiyeniz mi var? Aşağıdaki formdan bize iletin.")
      .setColor(0x2ECC71);
    const suggestionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_suggestion_form').setLabel('Tavsiye Gönder').setStyle(ButtonStyle.Success).setEmoji('💭')
    );
    await refreshPanel(client, '1466946002547249296', suggestionEmbed, [suggestionRow]);

    // 4. İstifa Formu
    const resignEmbed = new EmbedBuilder()
      .setTitle("🚪 İstifa Formu")
      .setDescription("EkoYıldız ekibinden ayrılmak istiyorsanız bu formu doldurabilirsiniz. Unutmayın, bu işlem **geri alınamaz**.")
      .setColor(0xE74C3C);
    const resignRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_resign_form').setLabel('İstifa Et').setStyle(ButtonStyle.Danger).setEmoji('⚠️')
    );
    await refreshPanel(client, '1466945894250188912', resignEmbed, [resignRow]);

    // 5. Kanıtlı Mod İşlem Formu
    const modActionEmbed = new EmbedBuilder()
      .setTitle("⚖️ Moderatör İşlem Formu (Kanıtlı)")
      .setDescription("Uyguladığınız cezalar (Ban, Mute, Kick vb.) için kanıt sunmak zorundasınız. İşleminizi raporlamak için aşağıdaki butona tıklayın.")
      .setColor(0x9B59B6);
    const modActionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_modaction_form').setLabel('İşlem Raporla').setStyle(ButtonStyle.Primary).setEmoji('🔨')
    );
    await refreshPanel(client, '1466946794763321394', modActionEmbed, [modActionRow]);

  } catch (error) {
    console.error("[PanelManager] ensureAdminPanels Error:", error);
  }
}

module.exports = {
  ensureAdminPanels
};
