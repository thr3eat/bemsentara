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

    return true;
  } catch (err) {
    console.error('[photoVerification] handlePhotoUpload hata:', err.message);
    return false;
  }
}

// Button: "Hayır Abone Değil" tıklandığında
async function handleNoSubscriberButton(interaction, client) {
  try {
    // ── MODERATÖR KONTROLÜ ──────────────────────────────────────────────────
    let isModerator = false;
  role: MODERATOR_ROLE_ID = '1367646745324159126'; // Moderatör rolü ID'si

    // Önce interaction.member üzerinden kontrol et (çoğu durumda çalışır)                
     try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
    } catch (_) {
      // Member partial olabilir, bunun yerine guild'den çek
      const guild = await client.guilds.fetch(GUILD2_ID).catch(() => null);
      if (guild) {
        try {
          const freshMember = await guild.members.fetch(interaction.user.id).catch(() => null);
          if (freshMember) {
            if (freshMember.permissions?.has('ManageMembers') || 
                freshMember.permissions?.has('ManageMessages') ||
                freshMember.permissions?.has('ManageChannels')) {
              isModerator = true;
            }
          }
        } catch (_) {}
      }
    }

    if (!isModerator) {
      return interaction.reply({
        content: '❌ Bu işlemi sadece moderatörler yapabilir!',
        ephemeral: true,
      });
    }

    const userId = interaction.customId.split('_').pop();

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
    try {
      await interaction.reply({
        content: `❌ Hata: ${err.message}`,
        ephemeral: true,
      });
    } catch (_) {}
  }
}

// Modal submit: Sebep girişi
async function handleRemoveSubscriberModal(interaction, client) {
  try {
    const userId = interaction.customId.split('_').pop();
    const reason = interaction.fields.getTextInputValue('reason');
    const moderatorId = interaction.user.id;

    // ── GUILD VE MEMBER FETCH ET ────────────────────────────────────────────
    const guild = await client.guilds.fetch(GUILD2_ID).catch(() => null);
    if (!guild) {
      throw new Error('Guild bulunamadı');
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      throw new Error('Üye bulunamadı');
    }

    // ── ABONE ROLüNü KALDIR ────────────────────────────────────────────────
    await member.roles.remove(SUBSCRIBER_ROLE_ID).catch(err => {
      console.warn('[photoVerification] Rol kaldırma hatası:', err.message);
    });

    // ── MODERATÖRE ÖDÜL VER ────────────────────────────────────────────────
    try {
      const { recordTicketSolved } = require('./staffSystem');
      await recordTicketSolved(moderatorId, client).catch(() => {});
    } catch (e) {
      console.warn('[photoVerification] recordTicketSolved hatası:', e.message);
    }

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

    // ── MODERATÖRE ÖDÜL DM'İ ───────────────────────────────────────────────
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
    } catch (e) {
      console.warn('[photoVerification] Moderator DM hatası:', e.message);
    }
  } catch (err) {
    console.error('[photoVerification] handleRemoveSubscriberModal hata:', err.message, err.stack);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ Hata: ${err.message}`,
          ephemeral: true,
        });
      }
    } catch (replyErr) {
      console.error('[photoVerification] Reply hata:', replyErr.message);
    }
  }
}

module.exports = {
  handlePhotoUpload,
  handleNoSubscriberButton,
  handleRemoveSubscriberModal,
};
