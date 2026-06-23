'use strict';

/**
 * Ban İtiraz Sistemi
 * 
 * - Banlanan/kicklenen kullanıcılara DM ile itiraz butonu gönderir
 * - Buton tıklanınca itiraz formu (modal) açılır
 * - Doldurulunca Müttefik Orduları sunucusundaki belirli kanala itiraz embed'i gönderir
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

// Müttefik Orduları sunucusundaki itiraz kanalı
const APPEAL_CHANNEL_ID = '1516411840064782427';

/**
 * Banlanan kullanıcıya itiraz DM'i gönder
 * @param {User} user - Discord kullanıcı objesi
 * @param {string} guildName - Sunucu adı
 * @param {string} guildId - Sunucu ID'si
 * @param {string} reason - Ban sebebi
 * @param {string} type - 'ban' | 'kick' | 'honeypot'
 */
async function sendAppealDM(user, guildName, guildId, reason, type = 'ban') {
  try {
    const typeLabels = {
      ban: '🔨 Yasaklandınız',
      kick: '👢 Atıldınız',
      honeypot: '🍯 Tuzak Kanalı — Atıldınız',
    };

    const typeColors = {
      ban: 0xff4444,
      kick: 0xff9500,
      honeypot: 0xff6b6b,
    };

    const embed = new EmbedBuilder()
      .setColor(typeColors[type] || 0xff4444)
      .setTitle(typeLabels[type] || '🔨 Yasaklandınız')
      .setDescription(
        `**${guildName}** sunucusundan ${type === 'ban' ? 'yasaklandınız' : 'atıldınız'}.\n\n` +
        `**Sebep:** ${reason || 'Belirtilmedi'}\n\n` +
        `Bu işleme itiraz etmek istiyorsanız aşağıdaki butona tıklayarak itiraz formunu doldurabilirsiniz.\n` +
        `İtirazınız yetkililer tarafından incelenecektir.`
      )
      .addFields(
        { name: '🏠 Sunucu', value: guildName, inline: true },
        { name: '📋 İşlem', value: type === 'ban' ? 'Yasaklama' : type === 'honeypot' ? 'Tuzak Kanalı (Kick)' : 'Atma', inline: true },
      )
      .setFooter({ text: 'Müttefik Orduları • İtiraz Sistemi' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ban_appeal_${guildId}_${type}`)
        .setLabel('📝 İtiraz Et')
        .setStyle(ButtonStyle.Danger),
    );

    await user.send({ embeds: [embed], components: [row] });
    console.log(`[banAppeal] İtiraz DM gönderildi: ${user.tag} (${type}, sunucu: ${guildName})`);
    return true;
  } catch (err) {
    console.log(`[banAppeal] DM gönderilemedi (${user.tag}): Ortak sunucu yok veya DM kapalı.`);
    return false;
  }
}

/**
 * İtiraz butonuna tıklandığında modal aç
 */
async function handleAppealButton(interaction) {
  const customId = interaction.customId;
  if (!customId.startsWith('ban_appeal_')) return false;

  // ban_appeal_{guildId}_{type}
  const parts = customId.replace('ban_appeal_', '').split('_');
  const guildId = parts[0];
  const type = parts.slice(1).join('_') || 'ban';

  const modal = new ModalBuilder()
    .setCustomId(`ban_appeal_modal_${guildId}_${type}`)
    .setTitle('📝 İtiraz Formu');

  const reasonInput = new TextInputBuilder()
    .setCustomId('appeal_reason')
    .setLabel('Neden itiraz ediyorsunuz?')
    .setPlaceholder('Yasaklanmanızın haksız olduğunu düşünüyorsanız nedenini açıklayın...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  const additionalInput = new TextInputBuilder()
    .setCustomId('appeal_additional')
    .setLabel('Ek bilgi veya kanıt (opsiyonel)')
    .setPlaceholder('Varsa eklemek istediğiniz ekstra bilgileri yazın...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  const promiseInput = new TextInputBuilder()
    .setCustomId('appeal_promise')
    .setLabel('Tekrar yapmayacağınıza söz veriyor musunuz?')
    .setPlaceholder('Evet/Hayır ve açıklama...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  modal.addComponents(
    new ActionRowBuilder().addComponents(reasonInput),
    new ActionRowBuilder().addComponents(additionalInput),
    new ActionRowBuilder().addComponents(promiseInput),
  );

  await interaction.showModal(modal);
  return true;
}

/**
 * İtiraz formu gönderildiğinde (modal submit) itirazı kanala ilet
 */
async function handleAppealModalSubmit(interaction, client) {
  const customId = interaction.customId;
  if (!customId.startsWith('ban_appeal_modal_')) return false;

  // ban_appeal_modal_{guildId}_{type}
  const parts = customId.replace('ban_appeal_modal_', '').split('_');
  const guildId = parts[0];
  const type = parts.slice(1).join('_') || 'ban';

  const reason = interaction.fields.getTextInputValue('appeal_reason');
  const additional = interaction.fields.getTextInputValue('appeal_additional') || 'Yok';
  const promise = interaction.fields.getTextInputValue('appeal_promise');

  const typeLabels = {
    ban: '🔨 Ban İtirazı',
    kick: '👢 Kick İtirazı',
    honeypot: '🍯 Honeypot İtirazı',
  };

  // Sunucu adını bul
  let guildName = 'Bilinmeyen Sunucu';
  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (guild) guildName = guild.name;
  } catch (_) {}

  // İtiraz embed'i
  const appealEmbed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle(`${typeLabels[type] || '📝 İtiraz'} — Yeni İtiraz!`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: '👤 Kullanıcı', value: `${interaction.user.tag}\n\`${interaction.user.id}\``, inline: true },
      { name: '🏠 Sunucu', value: `${guildName}\n\`${guildId}\``, inline: true },
      { name: '📋 İşlem Tipi', value: type === 'ban' ? 'Yasaklama' : type === 'honeypot' ? 'Tuzak Kanalı (Kick)' : 'Atma', inline: true },
      { name: '📝 İtiraz Sebebi', value: reason.slice(0, 1024), inline: false },
      { name: '📎 Ek Bilgi', value: additional.slice(0, 1024), inline: false },
      { name: '🤝 Söz', value: promise.slice(0, 1024), inline: false },
    )
    .setFooter({ text: `İtiraz Tarihi • ${interaction.user.id}` })
    .setTimestamp();

  // Onayla / Reddet butonları
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`appeal_accept_${interaction.user.id}_${guildId}`)
      .setLabel('✅ Onayla (Banı Kaldır)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`appeal_reject_${interaction.user.id}_${guildId}`)
      .setLabel('❌ Reddet')
      .setStyle(ButtonStyle.Danger),
  );

  // Müttefik Orduları sunucusundaki itiraz kanalına gönder
  try {
    // Kanalı herhangi bir sunucudan fetch etmeye çalış
    const appealChannel = await client.channels.fetch(APPEAL_CHANNEL_ID).catch(() => null);

    if (!appealChannel) {
      console.error(`[banAppeal] İtiraz kanalı bulunamadı: ${APPEAL_CHANNEL_ID}`);
      await interaction.reply({
        content: '❌ İtiraz şu an gönderilemedi. Lütfen daha sonra tekrar deneyin veya bir yöneticiyle iletişime geçin.',
        ephemeral: true,
      });
      return true;
    }

    await appealChannel.send({ embeds: [appealEmbed], components: [actionRow] });
    
    await interaction.reply({
      content: '✅ **İtirazınız başarıyla gönderildi!**\n\nYetkililer tarafından incelenecek ve size geri dönüş yapılacaktır. Lütfen sabırlı olun.',
      ephemeral: true,
    });

    console.log(`[banAppeal] İtiraz gönderildi: ${interaction.user.tag} → kanal ${APPEAL_CHANNEL_ID}`);
  } catch (err) {
    console.error('[banAppeal] İtiraz gönderme hatası:', err.message);
    await interaction.reply({
      content: '❌ İtiraz gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
      ephemeral: true,
    }).catch(() => {});
  }

  return true;
}

/**
 * İtiraz kabul/red butonları
 */
async function handleAppealDecisionButton(interaction, client) {
  const customId = interaction.customId;
  
  const isAccept = customId.startsWith('appeal_accept_');
  const isReject = customId.startsWith('appeal_reject_');
  
  if (!isAccept && !isReject) return false;

  // appeal_accept_{userId}_{guildId} veya appeal_reject_{userId}_{guildId}
  const prefix = isAccept ? 'appeal_accept_' : 'appeal_reject_';
  const rest = customId.replace(prefix, '');
  const separatorIdx = rest.indexOf('_');
  const userId = rest.substring(0, separatorIdx);
  const guildId = rest.substring(separatorIdx + 1);

  if (isAccept) {
    // Banı kaldırmayı dene
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        await guild.bans.remove(userId, `İtiraz kabul edildi — Yetkili: ${interaction.user.tag}`).catch(() => {});
      }
    } catch (_) {}

    // Kullanıcıya DM gönder
    try {
      const user = await client.users.fetch(userId);
      const acceptEmbed = new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle('✅ İtirazınız Kabul Edildi!')
        .setDescription(
          `İtirazınız **${interaction.user.tag}** tarafından incelendi ve **kabul edildi**!\n\n` +
          `Yasağınız kaldırılmıştır. Sunucuya tekrar katılabilirsiniz.\n\n` +
          `⚠️ Lütfen kurallarımıza uygun davranmaya devam edin.`
        )
        .setFooter({ text: 'Müttefik Orduları • İtiraz Sistemi' })
        .setTimestamp();
      await user.send({ embeds: [acceptEmbed] }).catch(() => {});
    } catch (_) {}

    // Embed'i güncelle
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x4ade80)
      .setTitle('✅ İTİRAZ KABUL EDİLDİ')
      .addFields({ name: '👮 Karar Veren', value: `${interaction.user.tag}`, inline: true });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
  } else {
    // Reddet
    try {
      const user = await client.users.fetch(userId);
      const rejectEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('❌ İtirazınız Reddedildi')
        .setDescription(
          `İtirazınız **${interaction.user.tag}** tarafından incelendi ve **reddedildi**.\n\n` +
          `Yasağınız devam etmektedir.`
        )
        .setFooter({ text: 'Müttefik Orduları • İtiraz Sistemi' })
        .setTimestamp();
      await user.send({ embeds: [rejectEmbed] }).catch(() => {});
    } catch (_) {}

    // Embed'i güncelle
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xff4444)
      .setTitle('❌ İTİRAZ REDDEDİLDİ')
      .addFields({ name: '👮 Karar Veren', value: `${interaction.user.tag}`, inline: true });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
  }

  return true;
}

module.exports = {
  sendAppealDM,
  handleAppealButton,
  handleAppealModalSubmit,
  handleAppealDecisionButton,
  APPEAL_CHANNEL_ID,
};
