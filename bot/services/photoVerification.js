const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GUILD2_ID } = require('../../config');

// Channel ve Role ID'leri
const PHOTO_UPLOAD_CHANNEL = '1393374779104432220'; // Fotoğraf yükleme kanalı (Eko Yıldız)
const PHOTO_LOG_CHANNEL = '1512419986294050938'; // Fotoğraf gözden geçirme kanalı
const SUBSCRIBER_ROLE_ID = '1367646745324159127'; // Abone rolü

// Fake abone kontrol sistem
const fakeSubscriberReports = new Map();

async function handlePhotoUpload(message, client) {
  try {
    // Sadece Eko Yıldız'da ve fotoğraf upload kanalında
    if (message.guild.id !== GUILD2_ID || message.channel.id !== PHOTO_UPLOAD_CHANNEL) {
      return false;
    }

    // Fotoğraf var mı?
    const attachments = [...message.attachments.values()];
    if (!attachments.some(a => a.contentType?.startsWith('image/'))) {
      return false;
    }

    // ── FOTOĞRAFı LOG KANALıNA GÖNDER ──────────────────────────────────────
    const guild = await client.guilds.fetch(GUILD2_ID);
    const logChannel = await guild.channels.fetch(PHOTO_LOG_CHANNEL);
    
    if (!logChannel) {
      console.warn('[photoVerification] Log kanalı bulunamadı:', PHOTO_LOG_CHANNEL);
      return false;
    }

    // Embed ile fotoğrafı gönder
    const reportEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle('🔍 Abone Kontrolü')
      .setDescription(
        `**BU ÜYE GERÇEKTEN KANALA ABONE Mİ?**\n\n` +
        `**Üye:** ${message.author.username} (<@${message.author.id}>)\n` +
        `**ID:** \`${message.author.id}\`\n` +
        `**Bildiren:** ${message.author.username} tarafından işaretlendi`
      )
      .addFields(
        { name: '📸 Fotoğraf', value: 'Aşağıda görüntülendi', inline: false }
      )
      .setFooter({ text: 'Eko Yıldız • Abone Doğrulama' })
      .setTimestamp();

    // Buttonlar
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`abone_no_${message.author.id}`)
        .setLabel('HAYIR ABONE DEĞİL')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    // Fotoğrafları gönder
    const images = attachments.filter(a => a.contentType?.startsWith('image/'));
    for (const img of images) {
      await logChannel.send({
        embeds: [reportEmbed],
        components: [row],
        files: [img.url],
      }).catch(() => {});
    }

    // Orijinal mesajı sil (temizlik)
    await message.delete().catch(() => {});

    // Üyeyi bilgilendir
    try {
      await message.author.send({
        embeds: [new EmbedBuilder()
          .setColor(0x3b82f6)
          .setTitle('📋 Abone Kontrolü')
          .setDescription(
            `Selamlar **${message.author.username}**! 👋\n\n` +
            `Paylaştığın fotoğraf moderatör ekibimiz tarafından gözden geçirilecek.\n\n` +
            `Eğer gerçekten kanala abone değilsen, abone rolün alınacak.\n` +
            `Lütfen bekleme...`
          )
          .setFooter({ text: 'Eko Yıldız • Abone Sistemi' })
          .setTimestamp()
        ]
      }).catch(() => {});
    } catch (_) {}

    return true;
  } catch (err) {
    console.error('[photoVerification] handlePhotoUpload hata:', err.message);
    return false;
  }
}

// Button: "Hayır Abone Değil" tıklandığında
async function handleNoSubscriberButton(interaction, client) {
  try {
    const userId = interaction.customId.split('_').pop();
    
    if (userId !== interaction.user.id && !interaction.member?.permissions.has('ManageMembers')) {
      return interaction.reply({
        content: '❌ Bu işlemi sadece moderatörler yapabilir!',
        ephemeral: true,
      });
    }

    // Modal aç: "Neden?"
    const modal = new ModalBuilder()
      .setCustomId(`abone_reason_${userId}`)
      .setTitle('Abone Rolü Kaldırma Sebebi')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Neden abone rolü kaldırılıyor?')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(5)
            .setMaxLength(500)
            .setRequired(true)
            .setPlaceholder('Örn: Gerçekten kanala abone olmayan üye')
        )
      );

    await interaction.showModal(modal);
  } catch (err) {
    console.error('[photoVerification] handleNoSubscriberButton hata:', err.message);
  }
}

// Modal submit: Sebep girişi
async function handleRemoveSubscriberModal(interaction, client) {
  try {
    const userId = interaction.customId.split('_').pop();
    const reason = interaction.fields.getTextInputValue('reason');
    const moderatorId = interaction.user.id;

    // ── ABONE ROLüNü KALDIR ────────────────────────────────────────────────
    const guild = await client.guilds.fetch(GUILD2_ID);
    const member = await guild.members.fetch(userId).catch(() => null);

    if (!member) {
      return interaction.reply({
        content: '❌ Üye bulunamadı!',
        ephemeral: true,
      });
    }

    // Rolü kaldır
    await member.roles.remove(SUBSCRIBER_ROLE_ID).catch(err => {
      console.warn('[photoVerification] Rol kaldırma hatası:', err.message);
    });

    // ── MODERATÖRE ÖDÜL VER ────────────────────────────────────────────────
    try {
      const { recordTicketSolved } = require('./staffSystem');
      await recordTicketSolved(moderatorId, client).catch(() => {});
    } catch (_) {}

    // ── ÜYEYE DM GÖNDERİSİ ───────────────────────────────────────────────
    try {
      const moderator = await client.users.fetch(moderatorId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle('⛔ Abone Rolünüz Alındı')
        .setDescription(
          `Merhaba **${member.user.username}**!\n\n` +
          `Moderatör **${moderator.username}** tarafından abone rolünüz alındı.\n\n` +
          `**Sebep:** ${reason}\n\n` +
          `Eğer itiraz etmek istersen, destek talebi aç ve bize ulaş! 📞`
        )
        .setFooter({ text: 'Eko Yıldız • Abone Sistemi' })
        .setTimestamp();

      await member.user.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (_) {}

    // ── MODERATÖRü ONAYLA ──────────────────────────────────────────────────
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle('✅ Abone Rolü Kaldırıldı')
      .setDescription(
        `**Üye:** ${member.user.username} (<@${userId}>)\n` +
        `**Sebep:** ${reason}\n` +
        `**Moderatör:** <@${moderatorId}>`
      )
      .setFooter({ text: 'Eko Yıldız • Abone Sistemi' })
      .setTimestamp();

    await interaction.reply({
      embeds: [confirmEmbed],
      ephemeral: false,
    });

    // Moderatöre ödül DM'i
    try {
      const moderatorUser = await client.users.fetch(moderatorId);
      const rewardEmbed = new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle('🎉 Ödül Kazandın!')
        .setDescription(
          `Güzel iş çıkardın! Fake abone üyeyi tespit ettin.\n\n` +
          `Terfi puanın arttı! 📈`
        )
        .setFooter({ text: 'Eko Yıldız • Moderatör Sistemi' })
        .setTimestamp();

      await moderatorUser.send({ embeds: [rewardEmbed] }).catch(() => {});
    } catch (_) {}
  } catch (err) {
    console.error('[photoVerification] handleRemoveSubscriberModal hata:', err.message);
    await interaction.reply({
      content: '❌ Bir hata oluştu. Lütfen daha sonra tekrar dene.',
      ephemeral: true,
    });
  }
}

module.exports = {
  handlePhotoUpload,
  handleNoSubscriberButton,
  handleRemoveSubscriberModal,
};
