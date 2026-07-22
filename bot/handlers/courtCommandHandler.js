'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { LAW_ARTICLES, setupCourtTriggerButton, filePetition, ensureCourtRoles } = require('../services/courtService');
const CourtCase = require('../../models/CourtCase');
const Economy = require('../../models/Economy');

async function handleCourtCommand(interaction) {
  const { commandName } = interaction;

  if (commandName === 'dava-kurulum') {
    await interaction.deferReply({ ephemeral: true });
    await setupCourtTriggerButton(interaction.client);
    await ensureCourtRoles(interaction.guild);
    return interaction.editReply({ content: '✅ Dava & Mahkeme sistemi paneli ve rolleri başarıyla kuruldu!' });
  }

  if (commandName === 'dava-ac') {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('supheli');
    const articleKey = interaction.options.getString('madde');
    const details = interaction.options.getString('detay');
    const evidence = interaction.options.getString('kanit') || 'Belirtilmedi';

    return filePetition(interaction, {
      defendantInput: targetUser.id,
      articleKey,
      details,
      evidence,
      requestedPenalty: 'Ceza Kanunu Standart Yaptırımı'
    });
  }

  if (commandName === 'yasa-kitabi') {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('📜 SUNUCU CEZA KANUNU (YASA KİTABI)')
      .setDescription('Mahkeme keyfi kararlar almaz. İhlaller ve yaptırımları aşağıdadır:\n\n' +
        Object.values(LAW_ARTICLES).map(a =>
          `📌 **${a.code} — ${a.title}**\n` +
          `📝 *Açıklama:* ${a.description}\n` +
          `⚖️ *Yaptırım:* \`${a.penalty}\`\n`
        ).join('\n')
      )
      .setColor(0xd4af37)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'kodos-tahliye') {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('mahkum');
    const activeJailCase = await CourtCase.findOne({
      defendantId: targetUser.id,
      status: 'closed',
      'jailTask.active': true
    });

    if (!activeJailCase) {
      return interaction.editReply({ content: '⚠️ Bu kullanıcının aktif bir #kodos (Hapis) cezası bulunmamaktadır.' });
    }

    const bailAmount = activeJailCase.jailTask.bailAmount || 500;
    const payerEco = await Economy.findOne({ userId: interaction.user.id });

    if (!payerEco || (payerEco.wallet || 0) < bailAmount) {
      return interaction.editReply({ content: `❌ Yetersiz bakiye! Kefalet ücreti: **${bailAmount} Coin**. Mevcut bakiyeniz: **${payerEco?.wallet || 0} Coin**.` });
    }

    payerEco.wallet -= bailAmount;
    await payerEco.save();

    activeJailCase.jailTask.active = false;
    await activeJailCase.save();

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (member && activeJailCase.jailTask.roleId) {
      await member.roles.remove(activeJailCase.jailTask.roleId).catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setTitle('🔓 KEFALETLE TAHLİYE BAŞARILI!')
      .setDescription(
        `<@${interaction.user.id}> kullanıcısı **${bailAmount} Coin** kefalet ödeyerek mahkum <@${targetUser.id}> için tahliye sağladı!\n` +
        `Mahkumun kısıtlamaları kaldırılmıştır.`
      )
      .setColor(0x2ecc71);

    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'sabika-kaydi') {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser('kullanici') || interaction.user;
    const { getSabikaKaydi } = require('../services/courtService');
    const embed = await getSabikaKaydi(targetUser.id);
    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'istinaf-basvuru') {
    await interaction.deferReply({ ephemeral: true });
    const caseCode = interaction.options.getString('dava_kodu');
    const level = interaction.options.getString('seviye');
    const reason = interaction.options.getString('gerekce');
    const { applyAppeal } = require('../services/courtService');
    return applyAppeal(interaction, caseCode, level, reason);
  }
}

module.exports = { handleCourtCommand };
