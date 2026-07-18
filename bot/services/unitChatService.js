'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UnitChatSession = require('../../models/UnitChatSession');
const StaffUnit = require('../../models/StaffUnit');
const StaffProgress = require('../../models/StaffProgress');
const { getCoachForUnit } = require('./unitMonthlyPromotionService');

// Birim konfigürasyonları
const UNIT_CONFIG = {
  BAN_BIRIMI: { label: 'BAN BİRİMİ', emoji: '🛡️', prefix: 'BAN' },
  SES_BIRIMI: { label: 'SES BİRİMİ', emoji: '🎤', prefix: 'SES' },
  SOHBET_BIRIMI: { label: 'SOHBET BİRİMİ', emoji: '💬', prefix: 'SOHBET' }
};

/**
 * Get active chat session for a user (either as sender or receiver)
 */
async function getActiveSession(userId) {
  try {
    return await UnitChatSession.findOne({
      status: 'active',
      $or: [{ senderId: userId }, { receiverId: userId }]
    });
  } catch (err) {
    console.error('[unitChatService] getActiveSession error:', err.message);
    return null;
  }
}

/**
 * Starts a new unit chat session between two users
 */
async function startUnitChatSession(client, senderId, receiverId, unitName, senderRole, receiverRole) {
  try {
    // Check if either user is in an active session
    const existing = await UnitChatSession.findOne({
      status: 'active',
      $or: [
        { senderId: senderId },
        { senderId: receiverId },
        { receiverId: senderId },
        { receiverId: receiverId }
      ]
    });

    if (existing) {
      return { success: false, error: 'Taraflardan birinin aktif bir sohbet oturumu zaten var!' };
    }

    const sessionId = `unit_chat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const session = new UnitChatSession({
      sessionId,
      senderId,
      receiverId,
      unitName,
      senderRole,
      receiverRole
    });

    await session.save();

    const senderUser = await client.users.fetch(senderId).catch(() => null);
    const receiverUser = await client.users.fetch(receiverId).catch(() => null);

    const unitEmoji = UNIT_CONFIG[unitName]?.emoji || '💬';
    const unitLabel = UNIT_CONFIG[unitName]?.label || unitName;

    // Send DM to initiator (sender)
    if (senderUser) {
      const senderEmbed = new EmbedBuilder()
        .setTitle(`${unitEmoji} Birim İçi İletişim Oturumu Başladı`)
        .setDescription(
          `**${unitLabel}** kapsamında **${receiverUser ? receiverUser.tag : 'Yetkili'}** ile sohbetiniz başladı.\n\n` +
          `• Bu andan itibaren botumuza göndereceğiniz DM mesajları doğrudan karşı tarafa iletilecektir.\n` +
          `• Sohbeti sonlandırmak için aşağıdaki **❌ Sohbeti Kapat** butonuna tıklayabilirsiniz.`
        )
        .setColor(0x3498db)
        .setFooter({ text: 'Eko Yıldız • Birim Sohbeti' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`unit_chat_close_${sessionId}`)
          .setLabel('❌ Sohbeti Kapat')
          .setStyle(ButtonStyle.Danger)
      );

      await senderUser.send({ embeds: [senderEmbed], components: [row] }).catch(() => {});
    }

    // Send DM to recipient (receiver)
    if (receiverUser) {
      const receiverEmbed = new EmbedBuilder()
        .setTitle(`${unitEmoji} Yeni Birim İçi İletişim Talebi`)
        .setDescription(
          `**${unitLabel}** kapsamında **${senderUser ? senderUser.tag : 'Bir yetkili'}** sizinle sohbet başlattı.\n\n` +
          `• Bu andan itibaren botumuza göndereceğiniz DM mesajları doğrudan karşı tarafa iletilecektir.\n` +
          `• Sohbeti sonlandırmak için aşağıdaki **❌ Sohbeti Kapat** butonuna tıklayabilirsiniz.`
        )
        .setColor(0x9b59b6)
        .setFooter({ text: 'Eko Yıldız • Birim Sohbeti' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`unit_chat_close_${sessionId}`)
          .setLabel('❌ Sohbeti Kapat')
          .setStyle(ButtonStyle.Danger)
      );

      await receiverUser.send({ embeds: [receiverEmbed], components: [row] }).catch(() => {});
    }

    return { success: true, sessionId };
  } catch (err) {
    console.error('[unitChatService] startUnitChatSession error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Closes an active chat session
 */
async function closeUnitChatSession(sessionId, closedByUserId, client) {
  try {
    const session = await UnitChatSession.findOne({ sessionId, status: 'active' });
    if (!session) return { success: false, error: 'Aktif sohbet oturumu bulunamadı.' };

    session.status = 'closed';
    session.closedAt = new Date();
    await session.save();

    const senderUser = await client.users.fetch(session.senderId).catch(() => null);
    const receiverUser = await client.users.fetch(session.receiverId).catch(() => null);
    const closedByUser = await client.users.fetch(closedByUserId).catch(() => null);

    const closeEmbed = new EmbedBuilder()
      .setTitle('❌ Sohbet Oturumu Kapatıldı')
      .setDescription(
        `Oturum **${closedByUser ? closedByUser.tag : 'Sistem'}** tarafından sonlandırıldı.\n\n` +
        `Artık göndereceğiniz DM'ler karşı tarafa iletilmeyecektir.`
      )
      .setColor(0xe74c3c)
      .setTimestamp();

    if (senderUser) {
      await senderUser.send({ embeds: [closeEmbed] }).catch(() => {});
    }
    if (receiverUser) {
      await receiverUser.send({ embeds: [closeEmbed] }).catch(() => {});
    }

    return { success: true };
  } catch (err) {
    console.error('[unitChatService] closeUnitChatSession error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Handle incoming DM messages for unit chat routing
 * Returns true if handled, false otherwise
 */
async function handleUnitChatReply(message, client) {
  if (message.guild) return false; // Sadece DM'ler

  try {
    const session = await getActiveSession(message.author.id);
    if (!session) return false;

    const recipientId = session.senderId === message.author.id ? session.receiverId : session.senderId;
    const recipientUser = await client.users.fetch(recipientId).catch(() => null);

    if (!recipientUser) {
      await closeUnitChatSession(session.sessionId, 'system', client);
      await message.author.send('❌ Sohbet edilen kullanıcıya ulaşılamadı. Oturum kapatıldı.').catch(() => {});
      return true;
    }

    const unitEmoji = UNIT_CONFIG[session.unitName]?.emoji || '💬';

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setAuthor({ name: `${message.author.username} (${session.unitName.replace('_', ' ')})`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setDescription(message.content || '*(ek dosya)*')
      .setFooter({ text: `${unitEmoji} Birim İçi DM İletimi` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`unit_chat_close_${session.sessionId}`)
        .setLabel('❌ Sohbeti Kapat')
        .setStyle(ButtonStyle.Danger)
    );

    const sendOpts = { embeds: [embed], components: [row] };
    if (message.attachments.size > 0) {
      sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
    }

    await recipientUser.send(sendOpts).catch(async () => {
      await closeUnitChatSession(session.sessionId, 'system', client);
      await message.author.send('❌ Mesaj iletilemedi, kullanıcının DM\'leri kapalı olabilir. Oturum kapatıldı.').catch(() => {});
    });

    // Mesajın iletildiğini belirten reaksiyon ekle
    await message.react('✉️').catch(() => {});

    return true;
  } catch (err) {
    console.error('[unitChatService] handleUnitChatReply error:', err.message);
    return false;
  }
}

/**
 * Handles button interactions for unit chat clicks
 */
async function handleUnitChatButton(interaction) {
  const { customId, client, user } = interaction;

  if (customId.startsWith('unit_chat_close_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const sessionId = customId.replace('unit_chat_close_', '');
    const result = await closeUnitChatSession(sessionId, user.id, client);

    if (result.success) {
      await interaction.editReply('✅ Sohbet başarıyla kapatıldı.').catch(() => {});
    } else {
      await interaction.editReply(`❌ Hata: ${result.error}`).catch(() => {});
    }
    return;
  }

  if (customId === 'panel_units_chat_menu') {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    try {
      const staffUnit = await StaffUnit.findOne({ userId: user.id });
      if (!staffUnit || !staffUnit.unitName) {
        return interaction.editReply('❌ Herhangi bir birimde aktif personel olarak kayıtlı değilsiniz.').catch(() => {});
      }

      const activeSession = await getActiveSession(user.id);
      if (activeSession) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`unit_chat_close_${activeSession.sessionId}`)
            .setLabel('❌ Sohbeti Kapat')
            .setStyle(ButtonStyle.Danger)
        );
        return interaction.editReply({
          content: '⚠️ Zaten aktif bir sohbet oturumunuz bulunuyor!',
          components: [row]
        }).catch(() => {});
      }

      // Fetch leaders (Boss and Assistant) of this unit
      const unitName = staffUnit.unitName;
      const progressList = await StaffProgress.find({ status: 'active' });
      const unitProgressList = await StaffUnit.find({ unitName });

      let bossId = null;
      let assistantId = null;

      for (const up of unitProgressList) {
        const p = progressList.find(prog => prog.userId === up.userId);
        if (p) {
          if (up.rank === 3) bossId = up.userId;
          if (up.rank === 2) assistantId = up.userId;
        }
      }

      const coach = await getCoachForUnit(unitName);

      const buttons = [];
      
      // Let's decide who they can talk to based on their rank/role
      const userRank = staffUnit.rank; // 1: Personel, 2: Yardımcı, 3: Başkan

      if (userRank === 1) { // Normal member
        if (assistantId && assistantId !== user.id) {
          buttons.push(
            new ButtonBuilder()
              .setCustomId(`unit_chat_start_${assistantId}_assistant`)
              .setLabel('💬 Birim Yardımcısıyla Konuş')
              .setStyle(ButtonStyle.Primary)
          );
        }
        if (bossId && bossId !== user.id) {
          buttons.push(
            new ButtonBuilder()
              .setCustomId(`unit_chat_start_${bossId}_boss`)
              .setLabel('💬 Birim Başkanıyla Konuş')
              .setStyle(ButtonStyle.Success)
          );
        }
      } else if (userRank === 2) { // Assistant
        if (bossId && bossId !== user.id) {
          buttons.push(
            new ButtonBuilder()
              .setCustomId(`unit_chat_start_${bossId}_boss`)
              .setLabel('💬 Birim Başkanıyla Konuş')
              .setStyle(ButtonStyle.Success)
          );
        }
      }

      if (coach) {
        // Find coach's Discord ID (Coach model might have it)
        const CoachModel = require('../../models/Coach');
        const coachDoc = await CoachModel.findOne({ name: coach.name });
        if (coachDoc && coachDoc.discordId && coachDoc.discordId !== user.id) {
          buttons.push(
            new ButtonBuilder()
              .setCustomId(`unit_chat_start_${coachDoc.discordId}_coach`)
              .setLabel('💬 Birim Koçuyla Konuş')
              .setStyle(ButtonStyle.Secondary)
          );
        }
      }

      if (buttons.length === 0) {
        return interaction.editReply('❌ Sohbet başlatabileceğiniz aktif bir birim yöneticisi bulunamadı.').catch(() => {});
      }

      const row = new ActionRowBuilder().addComponents(buttons);
      await interaction.editReply({
        content: '💬 Kiminle birim içi özel sohbet başlatmak istersiniz?',
        components: [row]
      }).catch(() => {});

    } catch (err) {
      console.error('[unitChatService] panel_units_chat_menu error:', err.message);
      await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
    }
    return;
  }

  if (customId.startsWith('unit_chat_start_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    try {
      const parts = customId.split('_');
      const receiverId = parts[3];
      const receiverRole = parts[4]; // 'assistant', 'boss', 'coach'

      const staffUnit = await StaffUnit.findOne({ userId: user.id });
      if (!staffUnit || !staffUnit.unitName) {
        return interaction.editReply('❌ Birim kaydınız bulunamadı.').catch(() => {});
      }

      const unitName = staffUnit.unitName;
      const senderRole = staffUnit.rank === 3 ? 'boss' : (staffUnit.rank === 2 ? 'assistant' : 'member');

      const result = await startUnitChatSession(client, user.id, receiverId, unitName, senderRole, receiverRole);

      if (result.success) {
        await interaction.editReply('✅ Sohbet oturumu başarıyla başlatıldı! Lütfen DM kutunuzu kontrol edin. Bot üzerinden göndereceğiniz mesajlar iletilecektir.').catch(() => {});
      } else {
        await interaction.editReply(`❌ Hata: ${result.error}`).catch(() => {});
      }
    } catch (err) {
      console.error('[unitChatService] unit_chat_start_ error:', err.message);
      await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
    }
    return;
  }
}

module.exports = {
  getActiveSession,
  startUnitChatSession,
  closeUnitChatSession,
  handleUnitChatReply,
  handleUnitChatButton
};
