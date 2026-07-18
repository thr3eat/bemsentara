'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const UnitRequestCommand = require('../../models/UnitRequestCommand');
const StaffUnit = require('../../models/StaffUnit');
const StaffProgress = require('../../models/StaffProgress');
const { chatWithAI } = require('./aiService');
const { getCoachForUnit } = require('./unitMonthlyPromotionService');

// Birim konfigürasyonları
const UNIT_CONFIG = {
  BAN_BIRIMI: { label: 'BAN BİRİMİ', emoji: '🛡️' },
  SES_BIRIMI: { label: 'SES BİRİMİ', emoji: '🎤' },
  SOHBET_BIRIMI: { label: 'SOHBET BİRİMİ', emoji: '💬' }
};

/**
 * Handles clicks on the main "Talepler ve Emirler" buttons
 */
async function handleRequestButton(interaction) {
  const { customId, user, client } = interaction;

  // 1. Ana menüyü göster
  if (customId === 'staff_units_request_menu') {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    try {
      const staffUnit = await StaffUnit.findOne({ userId: user.id });
      if (!staffUnit || !staffUnit.unitName) {
        return interaction.editReply('❌ Herhangi bir birimde aktif personel olarak kayıtlı değilsiniz.').catch(() => {});
      }

      const unitName = staffUnit.unitName;
      const rank = staffUnit.rank; // 1: Personel, 2: Yardımcı, 3: Başkan
      const unitLabel = UNIT_CONFIG[unitName]?.label || unitName;
      const unitEmoji = UNIT_CONFIG[unitName]?.emoji || '📌';

      const embed = new EmbedBuilder()
        .setTitle(`${unitEmoji} ${unitLabel} | Talep ve Emir Yönetimi`)
        .setColor(0x3498db)
        .setDescription(
          `Birim İçi Talep ve Emir sistemine hoş geldiniz.\n\n` +
          `• **Alt Rütbeler (Personel/Yardımcı)**: Üst rütbelerden AI destekli izin isteyebilir veya ek görev talep edebilirler.\n` +
          `• **Üst Rütbeler (Başkan/Müdür/Koç)**: Alt rütbelere disiplinli emirler/talimatlar gönderebilir ve gelen talepleri onaylayabilirler.`
        )
        .addFields({ name: '👤 Mevcut Rütbeniz', value: rank === 3 ? '🟠 Birim Başkanı' : (rank === 2 ? '🟡 Birim Yardımcısı' : '🟢 Birim Personeli') })
        .setTimestamp();

      const buttons = [];

      // Alt rütbeler için izin/görev talebi butonları
      if (rank < 3) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId('unit_req_leave')
            .setLabel('🏖️ İzin İste (AI Yardımlı)')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('unit_req_task')
            .setLabel('🎯 Görev İste (AI Yardımlı)')
            .setStyle(ButtonStyle.Success)
        );
      }

      // Üst rütbeler için emir gönderme butonu
      if (rank >= 2) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId('unit_cmd_send')
            .setLabel('⚡ Emir/Talimat Gönder')
            .setStyle(ButtonStyle.Danger)
        );
      }

      buttons.push(
        new ButtonBuilder()
          .setCustomId('staff_update_progress')
          .setLabel('⬅️ Geri Dön')
          .setStyle(ButtonStyle.Secondary)
      );

      const row = new ActionRowBuilder().addComponents(buttons);
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});

    } catch (err) {
      console.error('[unitRequestService] staff_units_request_menu error:', err.message);
      await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
    }
    return;
  }

  // 2. İzin İsteme Modalı Aç
  if (customId === 'unit_req_leave') {
    const modal = new ModalBuilder()
      .setCustomId('modal_unit_req_leave')
      .setTitle('🏖️ İzin Talebi Formu');

    const durationInput = new TextInputBuilder()
      .setCustomId('duration')
      .setLabel('Kaç gün izin istiyorsunuz?')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: 2 gün')
      .setRequired(true);

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('İzin mazeretiniz nedir?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Mazeretinizi yazın (AI bunu resmi bir dile dönüştürecektir)...')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(durationInput),
      new ActionRowBuilder().addComponents(reasonInput)
    );

    return interaction.showModal(modal);
  }

  // 3. Görev İsteme Modalı Aç
  if (customId === 'unit_req_task') {
    const modal = new ModalBuilder()
      .setCustomId('modal_unit_req_task')
      .setTitle('🎯 Ek Görev Talebi');

    const focusInput = new TextInputBuilder()
      .setCustomId('focus')
      .setLabel('Ne tür bir görev istiyorsunuz?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('İlgi alanınızı veya odaklanmak istediğiniz konuyu yazın...')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(focusInput));
    return interaction.showModal(modal);
  }

  // 4. Emir Gönderme Modalı Aç
  if (customId === 'unit_cmd_send') {
    const modal = new ModalBuilder()
      .setCustomId('modal_unit_cmd_send')
      .setTitle('⚡ Alt Rütbeye Talimat Gönder');

    const targetInput = new TextInputBuilder()
      .setCustomId('target_user')
      .setLabel('Kime göndereceksiniz? (Kullanıcı ID)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Kullanıcı ID girin')
      .setRequired(true);

    const commandInput = new TextInputBuilder()
      .setCustomId('command_text')
      .setLabel('Talimat/Görev Detayı')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Görevi yazın (AI bunu askeri/disiplinli bir emre çevirecektir)...')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(targetInput),
      new ActionRowBuilder().addComponents(commandInput)
    );

    return interaction.showModal(modal);
  }

  // 5. Talep Onaylama (Kabul)
  if (customId.startsWith('unit_req_accept_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const requestId = customId.replace('unit_req_accept_', '');
    try {
      const req = await UnitRequestCommand.findOne({ requestId, status: 'pending' });
      if (!req) return interaction.editReply('❌ Talep bulunamadı veya zaten işleme alınmış.').catch(() => {});

      req.status = 'accepted';
      req.updatedAt = new Date();
      await req.save();

      const senderUser = await client.users.fetch(req.senderId).catch(() => null);
      if (senderUser) {
        const acceptEmbed = new EmbedBuilder()
          .setTitle('✅ Talebiniz Kabul Edildi')
          .setDescription(
            `Görüştüğünüz üst yetkiliniz, göndermiş olduğunuz talebi **kabul etti**.\n\n` +
            `**İşlem Gören Talep:**\n> *${req.aiImprovedContent}*`
          )
          .setColor(0x2ecc71)
          .setTimestamp();
        await senderUser.send({ embeds: [acceptEmbed] }).catch(() => {});
      }

      await interaction.editReply('✅ Talep başarıyla kabul edildi ve kullanıcıya bildirildi.').catch(() => {});
    } catch (err) {
      await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
    }
    return;
  }

  // 6. Talep Reddetme
  if (customId.startsWith('unit_req_reject_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const requestId = customId.replace('unit_req_reject_', '');
    try {
      const req = await UnitRequestCommand.findOne({ requestId, status: 'pending' });
      if (!req) return interaction.editReply('❌ Talep bulunamadı veya zaten işleme alınmış.').catch(() => {});

      req.status = 'rejected';
      req.updatedAt = new Date();
      await req.save();

      const senderUser = await client.users.fetch(req.senderId).catch(() => null);
      if (senderUser) {
        const rejectEmbed = new EmbedBuilder()
          .setTitle('❌ Talebiniz Reddedildi')
          .setDescription(
            `Göndermiş olduğunuz talep üst yetkiliniz tarafından **reddedildi**.\n\n` +
            `**Detaylar için yetkilinizle iletişime geçebilirsiniz.**`
          )
          .setColor(0xe74c3c)
          .setTimestamp();
        await senderUser.send({ embeds: [rejectEmbed] }).catch(() => {});
      }

      await interaction.editReply('❌ Talep reddedildi ve kullanıcıya bildirildi.').catch(() => {});
    } catch (err) {
      await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
    }
    return;
  }

  // 7. Pazarlık Et (DM Köprüsü Başlat)
  if (customId.startsWith('unit_req_negotiate_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const requestId = customId.replace('unit_req_negotiate_', '');
    try {
      const req = await UnitRequestCommand.findOne({ requestId });
      if (!req) return interaction.editReply('❌ Talep bulunamadı.').catch(() => {});

      const { startUnitChatSession } = require('./unitChatService');
      const staffUnit = await StaffUnit.findOne({ userId: user.id });
      const targetUnit = staffUnit?.unitName || 'SOHBET_BIRIMI';

      const result = await startUnitChatSession(
        client,
        req.senderId, // Member
        req.receiverId, // Leader
        targetUnit,
        'member',
        'leader'
      );

      if (result.success) {
        await interaction.editReply('✅ Sohbet köprüsü kuruldu! DM kutunuzdan görüşmeye başlayabilirsiniz.').catch(() => {});
      } else {
        await interaction.editReply(`❌ Köprü kurulamadı: ${result.error}`).catch(() => {});
      }
    } catch (err) {
      await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
    }
    return;
  }

  // 8. AI Tavsiyesi Al
  if (customId.startsWith('unit_req_ai_advise_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const requestId = customId.replace('unit_req_ai_advise_', '');
    try {
      const req = await UnitRequestCommand.findOne({ requestId });
      if (!req) return interaction.editReply('❌ Talep bulunamadı.').catch(() => {});

      const staffProgress = await StaffProgress.findOne({ userId: req.senderId });
      const stats = staffProgress?.stats || {};

      const prompt = `Sen Eko Yıldız sunucusundaki liderlerin AI asistanısın.
Talep sahibi: ${req.senderId}
Talep tipi: ${req.type}
Talep içeriği: "${req.originalContent}"
Personel istatistikleri:
- consecutiveDays: ${stats.consecutiveDays || 0}
- activeDays: ${stats.activeDays || 0}
- ticketsSolved: ${stats.ticketsSolved || 0}

Bu personele izin veya görev verilmesi hususunda lidere Türkçe, kısa ve mantıklı bir tavsiye raporu yaz (max 300 karakter).`;

      const advice = await chatWithAI(prompt);
      const adviceEmbed = new EmbedBuilder()
        .setTitle('🤖 AI Asistan Tavsiye Raporu')
        .setDescription(advice || 'Tavsiye üretilemedi.')
        .setColor(0x9b59b6)
        .setTimestamp();

      await interaction.editReply({ embeds: [adviceEmbed] }).catch(() => {});
    } catch (err) {
      await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
    }
    return;
  }
}

/**
 * Handles submit events for leave/task request modals
 */
async function handleRequestModal(interaction) {
  const { customId, fields, user, client } = interaction;
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  try {
    const staffUnit = await StaffUnit.findOne({ userId: user.id });
    if (!staffUnit || !staffUnit.unitName) {
      return interaction.editReply('❌ Birim kaydınız bulunamadı.').catch(() => {});
    }

    const unitName = staffUnit.unitName;
    const unitLabel = UNIT_CONFIG[unitName]?.label || unitName;
    const unitEmoji = UNIT_CONFIG[unitName]?.emoji || '📌';

    // 1. İZİN TALEBİ GÖNDERME
    if (customId === 'modal_unit_req_leave') {
      const duration = fields.getTextInputValue('duration');
      const reason = fields.getTextInputValue('reason');

      const prompt = `Sen bir personelin mazeretini üst yönetime sunulacak resmi bir izin dilekçesine dönüştüren AI asistanısın.
Mazeret: "${reason}"
Süre: ${duration}
Görevi: ${user.username}

Bunu resmi, kibar, kurumsal bir Türkçe dilekçeye dönüştür (max 300 karakter).`;

      const aiText = await chatWithAI(prompt);
      const improvedText = aiText || `Sayın Yönetim, ${duration} süreyle mazeretim nedeniyle inaktiflik talep ediyorum. Gereğini arz ederim.`;

      // Find Boss of the unit
      const boss = await findUnitBoss(unitName);
      if (!boss) {
        return interaction.editReply('❌ Biriminizde aktif bir başkan bulunamadı. Talebiniz gönderilemedi.').catch(() => {});
      }

      const requestId = `req_${Date.now()}`;
      const request = new UnitRequestCommand({
        requestId,
        senderId: user.id,
        receiverId: boss.userId,
        type: 'leave_request',
        originalContent: reason,
        aiImprovedContent: improvedText
      });
      await request.save();

      const targetUser = await client.users.fetch(boss.userId).catch(() => null);
      if (targetUser) {
        const embed = new EmbedBuilder()
          .setTitle(`${unitEmoji} Yeni İzin Talebi (AI Tarafından İyileştirildi)`)
          .setDescription(
            `**Gönderen:** <@${user.id}> (${user.tag})\n` +
            `**Süre:** ${duration}\n\n` +
            `📜 **Resmi Dilekçe:**\n> "${improvedText}"`
          )
          .setColor(0xf1c40f)
          .setFooter({ text: 'Onay/Red işlemleri için butonları kullanın.' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`unit_req_accept_${requestId}`).setLabel('✅ Kabul Et').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`unit_req_reject_${requestId}`).setLabel('❌ Reddet').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`unit_req_negotiate_${requestId}`).setLabel('💬 Pazarlık Et').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`unit_req_ai_advise_${requestId}`).setLabel('🤖 AI Tavsiyesi').setStyle(ButtonStyle.Secondary)
        );

        await targetUser.send({ embeds: [embed], components: [row] }).catch(() => {});
      }

      return interaction.editReply(`✅ İzin talebiniz AI tarafından resmi dilekçeye dönüştürüldü ve Birim Başkanına iletildi.`).catch(() => {});
    }

    // 2. GÖREV TALEBİ GÖNDERME
    if (customId === 'modal_unit_req_task') {
      const focus = fields.getTextInputValue('focus');

      const prompt = `Sen personelin istediği görev odağını resmi bir ek görev talebine dönüştüren AI asistanısın.
Görevi/Kişi: ${user.username}
İlgi alanı: "${focus}"

Bunu resmi, çalışkan ve motive edici bir dille Türkçe ek görev talep dilekçesine dönüştür (max 300 karakter).`;

      const aiText = await chatWithAI(prompt);
      const improvedText = aiText || `Sayın Yönetim, ${focus} konusunda ek sorumluluk almak istiyorum.`;

      // Find Boss
      const boss = await findUnitBoss(unitName);
      if (!boss) {
        return interaction.editReply('❌ Biriminizde aktif bir başkan bulunamadı.').catch(() => {});
      }

      const requestId = `req_${Date.now()}`;
      const request = new UnitRequestCommand({
        requestId,
        senderId: user.id,
        receiverId: boss.userId,
        type: 'task_request',
        originalContent: focus,
        aiImprovedContent: improvedText
      });
      await request.save();

      const targetUser = await client.users.fetch(boss.userId).catch(() => null);
      if (targetUser) {
        const embed = new EmbedBuilder()
          .setTitle(`${unitEmoji} Yeni Görev Talebi (AI Tarafından İyileştirildi)`)
          .setDescription(
            `**Gönderen:** <@${user.id}> (${user.tag})\n\n` +
            `🎯 **Talep Metni:**\n> "${improvedText}"`
          )
          .setColor(0x2ecc71)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`unit_req_accept_${requestId}`).setLabel('✅ Görevlendir').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`unit_req_reject_${requestId}`).setLabel('❌ Reddet').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`unit_req_negotiate_${requestId}`).setLabel('💬 Görüş / Pazarlık').setStyle(ButtonStyle.Primary)
        );

        await targetUser.send({ embeds: [embed], components: [row] }).catch(() => {});
      }

      return interaction.editReply(`✅ Ek görev talebiniz AI tarafından düzenlenerek Birim Başkanına gönderildi.`).catch(() => {});
    }

    // 3. EMİR/TALİMAT GÖNDERME (Üst Rütbeden Alt Rütbeye)
    if (customId === 'modal_unit_cmd_send') {
      const targetUserId = fields.getTextInputValue('target_user').trim();
      const commandText = fields.getTextInputValue('command_text');

      const targetStaff = await StaffUnit.findOne({ userId: targetUserId, unitName });
      if (!targetStaff) {
        return interaction.editReply('❌ Hedef kullanıcı sizin biriminizde aktif bir personel değil.').catch(() => {});
      }

      const prompt = `Sen Eko Yıldız sunucusundaki liderlerin emirlerini askeri disiplin ve kurumsal ciddiyet katarak düzenleyen bir AI asistanısın.
Lider: ${user.username}
Talimat: "${commandText}"

Bunu son derece disiplinli, net, otoriter ama profesyonel bir Türkçe askeri birim emrine çevir (max 300 karakter).`;

      const aiText = await chatWithAI(prompt);
      const improvedText = aiText || `Birim Talimatı: ${commandText}. En kısa sürede yerine getirilmesi hususunda.`;

      const requestId = `cmd_${Date.now()}`;
      const request = new UnitRequestCommand({
        requestId,
        senderId: user.id,
        receiverId: targetUserId,
        type: 'command',
        originalContent: commandText,
        aiImprovedContent: improvedText
      });
      await request.save();

      const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
      if (targetUserObj) {
        const embed = new EmbedBuilder()
          .setTitle(`⚡ ${unitEmoji} ÜST YETKİLİDEN EMİR / TALİMAT`)
          .setDescription(
            `**Veren Lider:** <@${user.id}> (${user.tag})\n\n` +
            `⚔️ **DİSİPLİN PROTOKOLÜ VE TALİMAT:**\n` +
            `> **"${improvedText}"**\n\n` +
            `*Bu emri aldığınızı onaylamak için lütfen aşağıdaki butona tıklayın.*`
          )
          .setColor(0xe74c3c)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`unit_req_accept_${requestId}`).setLabel('✅ Anlaşıldı / Aldım').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`unit_req_negotiate_${requestId}`).setLabel('💬 Soru Sor / İtiraz Et').setStyle(ButtonStyle.Primary)
        );

        await targetUserObj.send({ embeds: [embed], components: [row] }).catch(() => {});
      }

      return interaction.editReply(`✅ Talimatınız askeri/disiplinli tonda AI tarafından düzenlendi ve <@${targetUserId}> kullanıcısına iletildi.`).catch(() => {});
    }

  } catch (err) {
    console.error('[unitRequestService] Modal submit error:', err.message);
    await interaction.editReply(`❌ Hata: ${err.message}`).catch(() => {});
  }
}

/**
 * Helper to find the active Boss (rank 3) of a unit
 */
async function findUnitBoss(unitName) {
  const bosses = await StaffUnit.find({ unitName, rank: 3 });
  if (bosses.length > 0) {
    // Return first one found
    return bosses[0];
  }
  // Fallback to rank 2 if no rank 3 found
  const assistants = await StaffUnit.find({ unitName, rank: 2 });
  if (assistants.length > 0) {
    return assistants[0];
  }
  return null;
}

module.exports = {
  handleRequestButton,
  handleRequestModal
};
