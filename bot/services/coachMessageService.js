'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Coach = require('../../models/Coach');

/**
 * Mesaj filtreleme seviyeleri
 * Bu seviyelere göre koçlar mesaj alıp almayacaklarını kontrol eder
 */
const MESSAGE_LEVELS = {
  ALL: 0,        // Tüm mesajlar (günlük görevler + acil durum)
  IMPORTANT: 1,  // Sadece önemli mesajlar (acil durum, promosyon vb)
  SILENT: 2      // Sessiz mod (mesaj yok ama panel kullanılabilir)
};

const LEVEL_NAMES = {
  0: '📢 Tümü (Her Şey)',
  1: '⚠️ Önemli (Sadece Acil)',
  2: '🔕 Sessiz (Hiçbir Şey)'
};

/**
 * Koç için mesaj seviyesi ayarını başlatır/oluşturur
 */
async function initCoachMessageLevel(coachId) {
  try {
    let coach = await Coach.findOne({ discordId: coachId });
    
    if (!coach) {
      coach = new Coach({
        discordId: coachId,
        messageLevel: MESSAGE_LEVELS.ALL, // Varsayılan: Tüm mesajlar
        createdAt: new Date()
      });
      await coach.save();
      console.log(`[coachMessage] Yeni koç oluşturuldu: ${coachId}, Seviye: ${LEVEL_NAMES[MESSAGE_LEVELS.ALL]}`);
    } else if (coach.messageLevel === undefined) {
      // Eski koçlar için seviye ayarla
      coach.messageLevel = MESSAGE_LEVELS.ALL;
      await coach.save();
      console.log(`[coachMessage] Koç mesaj seviyesi güncellendi: ${coachId}, Seviye: ${LEVEL_NAMES[MESSAGE_LEVELS.ALL]}`);
    }

    return coach;
  } catch (err) {
    console.error('[coachMessage] initCoachMessageLevel hatası:', err.message);
    return null;
  }
}

/**
 * Koçun mevcut mesaj seviyesini döndür
 */
async function getCoachMessageLevel(coachId) {
  try {
    let coach = await Coach.findOne({ discordId: coachId });
    if (!coach) {
      return MESSAGE_LEVELS.ALL; // Varsayılan
    }
    return coach.messageLevel !== undefined ? coach.messageLevel : MESSAGE_LEVELS.ALL;
  } catch (err) {
    console.error('[coachMessage] getCoachMessageLevel hatası:', err.message);
    return MESSAGE_LEVELS.ALL;
  }
}

/**
 * Koçun mesaj seviyesini güncelle
 */
async function setCoachMessageLevel(coachId, level) {
  try {
    if (!Object.values(MESSAGE_LEVELS).includes(level)) {
      console.error(`[coachMessage] Geçersiz seviye: ${level}`);
      return false;
    }

    let coach = await Coach.findOne({ discordId: coachId });
    if (!coach) {
      coach = new Coach({ discordId: coachId });
    }

    coach.messageLevel = level;
    coach.messageSettingUpdatedAt = new Date();
    await coach.save();

    console.log(`[coachMessage] Koç mesaj seviyesi güncellendi: ${coachId} → ${LEVEL_NAMES[level]}`);
    return true;
  } catch (err) {
    console.error('[coachMessage] setCoachMessageLevel hatası:', err.message);
    return false;
  }
}

/**
 * Koçunun belirli bir mesaj türünü alması gerekip gerekmediklerini kontrol et
 * @param {string} coachId - Koç Discord ID
 * @param {string} messageType - "daily", "important", "promotion", etc.
 * @returns {boolean} - Mesaj gönderilmeli mi?
 */
async function shouldCoachReceiveMessage(coachId, messageType) {
  try {
    const messageLevel = await getCoachMessageLevel(coachId);

    // Mesaj tipi tanımlamaları
    const typeMap = {
      'daily': MESSAGE_LEVELS.ALL,           // Günlük görevler - yalnızca "ALL" seviyesinde
      'motivation': MESSAGE_LEVELS.ALL,       // Motivasyon - yalnızca "ALL" seviyesinde
      'important': MESSAGE_LEVELS.IMPORTANT, // Önemli - IMPORTANT ve ALL'de
      'promotion': MESSAGE_LEVELS.IMPORTANT, // Promosyon - IMPORTANT ve ALL'de
      'demotion': MESSAGE_LEVELS.IMPORTANT,  // Azalış - IMPORTANT ve ALL'de
      'urgent': MESSAGE_LEVELS.IMPORTANT     // Acil - IMPORTANT ve ALL'de
    };

    const requiredLevel = typeMap[messageType] || MESSAGE_LEVELS.ALL;

    // Koçun seviyesi gerekli seviyeye eşit veya daha düşükse (azsa) mesaj al
    // 0 < 1 < 2 (0 = ALL, 1 = IMPORTANT, 2 = SILENT)
    return messageLevel <= requiredLevel;

  } catch (err) {
    console.error('[coachMessage] shouldCoachReceiveMessage hatası:', err.message);
    return true; // Hata durumunda güvenlik için mesaj gönder
  }
}

/**
 * Koça mesaj filtreleme panel butonları gönder
 */
async function sendCoachFilterPanel(client, coachId) {
  try {
    const user = await client.users.fetch(coachId).catch(() => null);
    if (!user) {
      console.warn(`[coachMessage] Koç kullanıcı bulunamadı: ${coachId}`);
      return false;
    }

    const currentLevel = await getCoachMessageLevel(coachId);

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('⚙️ Mesaj Bildirim Ayarları')
      .setDescription(
        `Birim koçu olarak birime katılan kişilere ne sıklıkta mesaj almak istediğinizi kontrol edebilirsiniz.\n\n` +
        `**Mevcut Seviye:** ${LEVEL_NAMES[currentLevel]}`
      )
      .addFields(
        {
          name: '📢 Tümü (Varsayılan)',
          value: 'Günlük görevler, motivasyon ve önemli bildirimler dahil her şeyi al. Birim üyeleriniz hakkında tamamen haberdar ol.',
          inline: false
        },
        {
          name: '⚠️ Sadece Önemli',
          value: 'Yalnızca acil durum, promosyon, azalış gibi kritik mesajları al. Günlük görevler hakkında mesaj alma.',
          inline: false
        },
        {
          name: '🔕 Sessiz Mod',
          value: 'Hiçbir DM bildirim almazsın. Panel aracılığıyla yönetim işlemi yapabilirsin fakat mesaj almayacaksın.',
          inline: false
        }
      )
      .setFooter({ text: 'EkoYıldız Koç Sistemi - Bildirim Ayarları' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('coach_msg_level_all')
        .setLabel('📢 Tümü')
        .setStyle(currentLevel === MESSAGE_LEVELS.ALL ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(currentLevel === MESSAGE_LEVELS.ALL),
      new ButtonBuilder()
        .setCustomId('coach_msg_level_important')
        .setLabel('⚠️ Önemli')
        .setStyle(currentLevel === MESSAGE_LEVELS.IMPORTANT ? ButtonStyle.Warning : ButtonStyle.Secondary)
        .setDisabled(currentLevel === MESSAGE_LEVELS.IMPORTANT),
      new ButtonBuilder()
        .setCustomId('coach_msg_level_silent')
        .setLabel('🔕 Sessiz')
        .setStyle(currentLevel === MESSAGE_LEVELS.SILENT ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(currentLevel === MESSAGE_LEVELS.SILENT)
    );

    await user.send({
      embeds: [embed],
      components: [row]
    }).catch(err => {
      console.warn(`[coachMessage] Filtre paneli gönderme hatası: ${err.message}`);
      return false;
    });

    return true;
  } catch (err) {
    console.error('[coachMessage] sendCoachFilterPanel hatası:', err.message);
    return false;
  }
}

/**
 * Koç mesaj seviyesi butonunun tıklanmasını işle
 */
async function handleCoachMessageLevelButton(interaction, level) {
  try {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const success = await setCoachMessageLevel(interaction.user.id, level);

    if (!success) {
      return interaction.editReply({
        content: '❌ Ayar güncellenemedi. Lütfen daha sonra tekrar deneyin.'
      });
    }

    const levelName = LEVEL_NAMES[level];
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ Ayarlar Güncellendi')
      .setDescription(
        `Bildirim seviyeniz başarıyla ${levelName} olarak ayarlandı.\n\n` +
        `Artık bu seviyeye uygun mesajları alacaksınız. Panel üzerinden yönetim işlemleri yapabilirsiz.`
      )
      .setFooter({ text: 'EkoYıldız Koç Sistemi' })
      .setTimestamp();

    await interaction.editReply({ embeds: [confirmEmbed] });

    // Paneli güncellenmiş durumda yeniden gönder (2 saniye sonra)
    setTimeout(() => {
      sendCoachFilterPanel(interaction.client, interaction.user.id).catch(() => {});
    }, 2000);

    return true;
  } catch (err) {
    console.error('[coachMessage] handleCoachMessageLevelButton hatası:', err.message);
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
      });
    }
    return false;
  }
}

/**
 * Koça mesaj gönder (seviye kontrolü ile)
 * @param {Object} client - Discord client
 * @param {string} coachId - Koç Discord ID
 * @param {Object} message - { embed, content, messageType }
 *   - messageType: "daily", "important", "promotion", etc.
 */
async function sendMessageToCoach(client, coachId, message) {
  try {
    const shouldSend = await shouldCoachReceiveMessage(coachId, message.messageType || 'daily');

    if (!shouldSend) {
      console.log(`[coachMessage] Mesaj filtre edildi (${coachId}): Seviye - ${message.messageType}`);
      return false;
    }

    const user = await client.users.fetch(coachId).catch(() => null);
    if (!user) {
      console.warn(`[coachMessage] Koç bulunamadı: ${coachId}`);
      return false;
    }

    const sendOptions = {};
    if (message.embed) sendOptions.embeds = [message.embed];
    if (message.content) sendOptions.content = message.content;
    if (message.components) sendOptions.components = message.components;

    await user.send(sendOptions).catch(err => {
      console.warn(`[coachMessage] Mesaj gönderme hatası (${coachId}): ${err.message}`);
      return false;
    });

    console.log(`[coachMessage] Mesaj gönderildi (${coachId}): ${message.messageType}`);
    return true;
  } catch (err) {
    console.error('[coachMessage] sendMessageToCoach hatası:', err.message);
    return false;
  }
}

module.exports = {
  MESSAGE_LEVELS,
  LEVEL_NAMES,
  initCoachMessageLevel,
  getCoachMessageLevel,
  setCoachMessageLevel,
  shouldCoachReceiveMessage,
  sendCoachFilterPanel,
  handleCoachMessageLevelButton,
  sendMessageToCoach
};
