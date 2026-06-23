const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GUILD2_ID } = require('../../config');

// Channel ve Role ID'leri
const PHOTO_UPLOAD_CHANNEL = '1393374779104432220'; // Fotoğraf yükleme kanalı (Eko Yıldız)
const PHOTO_LOG_CHANNEL = '1518692517955244133'; // Fotoğraf gözden geçirme kanalı
const SUBSCRIBER_ROLE_ID = '1518707259633303814'; // Abone rolü (Aboneci Dinazor)

// Helper to determine if a member is a moderator/staff
function isModerator(member) {
  if (!member) return false;
  const { ROLES } = require('./staffSystem');
  const staffRoleIds = Object.values(ROLES);
  return staffRoleIds.some(rid => rid && member.roles.cache.has(rid));
}

// Helper to find online/active moderators
async function getActiveModerators(guild) {
  try {
    const StaffProgress = require('../../models/StaffProgress');
    const activeStaff = await StaffProgress.find({ status: 'active' });
    const activeStaffIds = activeStaff.map(s => s.userId);

    // Fetch members with presences to inspect presence status
    await guild.members.fetch({ user: activeStaffIds, withPresences: true }).catch(() => {});

    const activeMods = [];
    for (const staffId of activeStaffIds) {
      const member = guild.members.cache.get(staffId);
      if (member) {
        const presence = member.presence;
        const isOnline = presence && ['online', 'idle', 'dnd'].includes(presence.status);
        if (isOnline) {
          activeMods.push(member);
        }
      }
    }
    return activeMods;
  } catch (err) {
    console.error('[photoVerification] getActiveModerators error:', err.message);
    return [];
  }
}

function resetDaily(progress) {
  const today = new Date().toISOString().split('T')[0];

  if (!progress.daily) {
    const taskKeys = ['task_chat', 'task_voice', 'task_ticket', 'task_mod'];
    const randomTask = taskKeys[Math.floor(Math.random() * taskKeys.length)];
    progress.daily = {
      date: today,
      greeted: false,
      voiceMinutes: 0,
      chosenTask: randomTask,
      chosenTaskCompleted: false,
      chatMessagesToday: 0,
      ticketsSolvedToday: 0,
      moderationActionsToday: 0
    };
    return;
  }

  if (progress.daily.date !== today) {
    const taskKeys = ['task_chat', 'task_voice', 'task_ticket', 'task_mod'];
    const randomTask = taskKeys[Math.floor(Math.random() * taskKeys.length)];
    progress.daily.date = today;
    progress.daily.greeted = false;
    progress.daily.voiceMinutes = 0;
    progress.daily.chosenTask = randomTask;
    progress.daily.chosenTaskCompleted = false;
    progress.daily.chatMessagesToday = 0;
    progress.daily.ticketsSolvedToday = 0;
    progress.daily.moderationActionsToday = 0;
  }
}

async function addEkoCoin(progress, amount, client, reason) {
  progress.gamification = progress.gamification || {};
  progress.gamification.ecoCoins = (progress.gamification.ecoCoins || 0) + amount;

  if (client) {
    try {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
      const user = await client.users.fetch(progress.userId).catch(() => null);
      if (user) {
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🪙 EkoCoin Kazandın!')
          .setDescription(`**${reason}** görevini başarıyla yerine getirdiğin için **${amount} E.C.** kazandın!\n\n💰 Güncel Bakiye: **${progress.gamification.ecoCoins} E.C.**`)
          .setFooter({ text: 'Eko Yıldız • Mağaza Sistemi' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ekocoin_magaza')
            .setLabel('🛒 MAĞAZAYI İNCELE')
            .setStyle(ButtonStyle.Success)
        );

        await user.send({ embeds: [embed], components: [row] }).catch(() => {});
      }
    } catch (_) {}
  }
}

// Reward moderator helper
async function rewardModerator(moderatorId, client, isAccept) {
  try {
    const StaffProgress = require('../../models/StaffProgress');
    const p = await StaffProgress.findOne({ userId: moderatorId });
    if (!p || p.status !== 'active') return;

    const { checkDailyCompletion, checkPromotion } = require('./staffSystem');
    
    // Reset daily stats if it is a new day
    resetDaily(p);

    p.stats.ticketsSolved = (p.stats.ticketsSolved || 0) + 1;
    p.daily.ticketsSolvedToday = (p.daily.ticketsSolvedToday || 0) + 1;

    if (!p.gamification) {
      p.gamification = {
        totalPoints: 0,
        level: 1,
        currentXP: 0,
        badges: {},
        streak: { current: 0, longest: 0, brokenDays: 0 },
        challengeProgress: {},
      };
    }

    const levelMultiplier = 1 + (p.level * 0.25);
    
    let xpGain, pointsGain, coinGain;
    if (isAccept) {
      // Ufak puan
      xpGain = Math.floor(30 * levelMultiplier);
      pointsGain = Math.floor(8 * levelMultiplier);
      coinGain = 2;
    } else {
      // Normal puan
      xpGain = Math.floor(85 * levelMultiplier);
      pointsGain = Math.floor(20 * levelMultiplier);
      coinGain = 5;
    }

    p.gamification.totalPoints = (p.gamification.totalPoints || 0) + pointsGain;
    p.gamification.currentXP = (p.gamification.currentXP || 0) + xpGain;

    // Add EkoCoins (handles save and notify)
    await addEkoCoin(p, coinGain, client, isAccept ? 'Abone Kabulü (Hızlı İşlem)' : 'Abone Reddi (Detaylı İnceleme)');

    // Check daily completion and promotion
    await checkDailyCompletion(p, client).catch(() => {});
    await checkPromotion(p, client).catch(() => {});

    await p.save();
  } catch (err) {
    console.error('[photoVerification] rewardModerator error:', err.message);
  }
}

async function handlePhotoUpload(message, client) {
  try {
    // Sadece Eko Yıldız'da ve fotoğraf upload kanalında
    if (message.guild.id !== GUILD2_ID || message.channel.id !== PHOTO_UPLOAD_CHANNEL) {
      return false;
    }

    // Fotoğraf var mı?
    const attachments = [...message.attachments.values()];
    const images = attachments.filter(a => a.contentType?.startsWith('image/'));
    if (images.length === 0) {
      return false;
    }

    const guild = await client.guilds.fetch(GUILD2_ID);
    const logChannel = await guild.channels.fetch(PHOTO_LOG_CHANNEL);
    
    if (!logChannel) {
      console.warn('[photoVerification] Log kanalı bulunamadı:', PHOTO_LOG_CHANNEL);
      return false;
    }

    // Aktif modları bul
    const activeMods = await getActiveModerators(guild);
    let mentionText = '';
    if (activeMods.length > 0) {
      mentionText = activeMods.map(m => `<@${m.id}>`).join(' ');
    } else {
      const { ROLES } = require('./staffSystem');
      mentionText = Object.values(ROLES).filter(Boolean).map(rid => `<@&${rid}>`).join(' ');
    }

    // Mesaj saatini Türkiye saatine göre formatla
    const messageTime = message.createdAt;
    const formatter = new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const messageTimeStr = formatter.format(messageTime);

    // Embed oluştur
    const reportEmbed = new EmbedBuilder()
      .setColor(0xf1c40f) // Verification gold
      .setTitle('🔍 Abone Onay Talebi')
      .setDescription(
        `**Yeni bir abone doğrulama isteği geldi!**\n\n` +
        `👤 **Kullanıcı:** ${message.author.username} (<@${message.author.id}>)\n` +
        `🆔 **Kullanıcı ID:** \`${message.author.id}\`\n\n` +
        `📅 **Mesaj Gönderim Saati:** \`${messageTimeStr}\`\n\n` +
        `⚠️ **Önemli Kontrol:**\n` +
        `Kabul etmeden önce, **fotoğraftaki saat/dakika** ile yukarıdaki **mesaj saatini** karşılaştırın. Bilgilerin eşleştiğinden emin olun!`
      )
      .setFooter({ text: 'Eko Yıldız • Abone Doğrulama' })
      .setTimestamp();

    // Buttonlar: Kabul Et (Success) ve Reddet (Danger)
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`abone_approve_${message.author.id}`)
        .setLabel('Kabul Et')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`abone_reject_${message.author.id}`)
        .setLabel('Reddet')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    // İlk fotoğrafı log kanalına gönder
    await logChannel.send({
      content: mentionText,
      embeds: [reportEmbed],
      components: [row],
      files: [images[0].url],
    }).catch(() => {});

    // Orijinal mesajı sil (temizlik)
    await message.delete().catch(() => {});

    return true;
  } catch (err) {
    console.error('[photoVerification] handlePhotoUpload hata:', err.message);
    return false;
  }
}

async function handleSubscriberButtons(interaction, client) {
  try {
    const isApprove = interaction.customId.startsWith('abone_approve_');
    const isReject = interaction.customId.startsWith('abone_reject_');
    const isOldNo = interaction.customId.startsWith('abone_no_');
    
    const userId = interaction.customId.split('_').pop();
    const moderatorId = interaction.user.id;

    // ── YETKİ KONTROLÜ ─────────────────────────────────────────────────────
    if (!isModerator(interaction.member)) {
      return interaction.reply({
        content: '❌ Bu işlemi yalnızca moderatör ekibi gerçekleştirebilir.',
        ephemeral: true
      });
    }

    if (isApprove) {
      // ── KABUL ET AKIŞI ───────────────────────────────────────────────────
      await interaction.deferReply({ ephemeral: true });

      const guild = await client.guilds.fetch(GUILD2_ID).catch(() => null);
      if (!guild) throw new Error('Guild bulunamadı');

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) throw new Error('Üye sunucuda bulunamadı');

      // Abone rolünü ver
      await member.roles.add(SUBSCRIBER_ROLE_ID, 'Abone onaylandı').catch(err => {
        console.warn('[photoVerification] Rol verme hatası:', err.message);
      });

      // Ödüllendir: Ufak puan
      await rewardModerator(moderatorId, client, true);

      // Embed'i ONAYLANDI olarak güncelle
      const originalEmbed = interaction.message.embeds[0];
      const approvedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0x2ecc71)
        .setTitle('✅ Abone Onaylandı')
        .setDescription(
          originalEmbed.description +
          `\n\n**Durum:** ONAYLANDI\n` +
          `**Onaylayan Yetkili:** <@${moderatorId}>\n` +
          `**Kazanılan Puan:** Ufak Puan (+8 Puan, +30 XP, +2 E.C.)`
        );

      await interaction.message.edit({
        embeds: [approvedEmbed],
        components: [] // Butonları kaldır
      }).catch(() => {});

      // Kullanıcıya DM gönder
      try {
        const approvedUserDM = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🎉 Aboneliğiniz Onaylandı!')
          .setDescription(
            `Tebrikler, EkoYıldız kanal aboneliği doğrulama isteğiniz onaylandı ve **Aboneci Dinazor** rolü hesabınıza tanımlandı!\n\n` +
            `Ayrıcalıkların ve sunucunun keyfini çıkarın! 🦖`
          )
          .setFooter({ text: 'Eko Yıldız • Abone Sistemi' })
          .setTimestamp();
        await member.send({ embeds: [approvedUserDM] }).catch(() => {});
      } catch (_) {}

      await interaction.editReply({ content: '✅ Abone başarıyla onaylandı ve ödülünüz eklendi!' });

    } else if (isReject || isOldNo) {
      // ── REDDET / HAYIR ABONE DEĞİL AKIŞI ──────────────────────────────────
      const modal = new ModalBuilder()
        .setCustomId(`abone_reject_reason_${userId}`)
        .setTitle('Talebi Reddetme Sebebi')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Neden reddediliyor?')
              .setStyle(TextInputStyle.Paragraph)
              .setMinLength(5)
              .setMaxLength(500)
              .setRequired(true)
              .setPlaceholder('Örn: Ekran görüntüsündeki saat eşleşmiyor veya geçersiz.')
          )
        );

      await interaction.showModal(modal);
    }
  } catch (err) {
    console.error('[photoVerification] handleSubscriberButtons hata:', err.message);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
      } else if (interaction.deferred) {
        await interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    } catch (_) {}
  }
}

async function handleRemoveSubscriberModal(interaction, client) {
  try {
    const userId = interaction.customId.split('_').pop();
    const reason = interaction.fields.getTextInputValue('reason');
    const moderatorId = interaction.user.id;

    const guild = await client.guilds.fetch(GUILD2_ID).catch(() => null);
    if (!guild) throw new Error('Guild bulunamadı');

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) throw new Error('Üye sunucuda bulunamadı');

    // Eğer zaten rolü varsa her ihtimale karşı kaldır
    await member.roles.remove(SUBSCRIBER_ROLE_ID).catch(err => {
      console.warn('[photoVerification] Rol kaldırma hatası:', err.message);
    });

    // Ödüllendir: Normal puan
    await rewardModerator(moderatorId, client, false);

    // Embed'i REDDEDİLDİ olarak güncelle
    const originalEmbed = interaction.message.embeds[0];
    const rejectedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(0xe74c3c)
      .setTitle('❌ Abone Talebi Reddedildi')
      .setDescription(
        originalEmbed.description +
        `\n\n**Durum:** REDDEDİLDİ\n` +
        `**Reddeden Yetkili:** <@${moderatorId}>\n` +
        `**Neden:** ${reason}\n` +
        `**Kazanılan Puan:** Normal Puan (+20 Puan, +85 XP, +5 E.C.)`
      );

    await interaction.message.edit({
      embeds: [rejectedEmbed],
      components: [] // Butonları kaldır
    }).catch(() => {});

    // Kullanıcıya DM ile red nedenini gönder
    try {
      const rejectUserDM = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Abonelik Doğrulama Talebiniz Reddedildi')
        .setDescription(
          `EkoYıldız kanal aboneliği doğrulama isteğiniz reddedilmiştir.\n\n` +
          `📌 **Red Gerekçesi:** ${reason}\n\n` +
          `Lütfen geçerli ve güncel bir ekran görüntüsü yüklediğinizden emin olarak tekrar deneyin.`
        )
        .setFooter({ text: 'Eko Yıldız • Abone Sistemi' })
        .setTimestamp();
      await member.send({ embeds: [rejectUserDM] }).catch(() => {});
    } catch (_) {}

    // Onay Embedi (Interaksiyon yanıtı)
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Abone Talebi Reddedildi')
      .setDescription(
        `**Üye:** ${member.user.username} (<@${userId}>)\n` +
        `**Sebep:** ${reason}\n` +
        `**Moderatör:** <@${moderatorId}>`
      )
      .setFooter({ text: 'Eko Yıldız • Abone Sistemi' })
      .setTimestamp();

    await interaction.reply({
      embeds: [confirmEmbed],
      ephemeral: true,
    });

    // Moderatör DM'i
    try {
      const moderatorUser = await client.users.fetch(moderatorId);
      const rewardEmbed = new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle('🎉 Ödül Kazandın!')
        .setDescription(
          `Güzel iş çıkardın! Abone talebini inceledin ve sonuçlandırdın.\n\n` +
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
    } catch (_) {}
  }
}

module.exports = {
  isModerator,
  handlePhotoUpload,
  handleSubscriberButtons,
  handleRemoveSubscriberModal,
};
