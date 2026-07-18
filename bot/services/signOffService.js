'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const SignOffRequest = require('../../models/SignOffRequest');
const { CHANNELS } = require('./staffAutomation');

async function createSignOffRequest(client, actionType, details) {
  const requestId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
  const request = new SignOffRequest({
    requestId,
    actionType,
    details
  });
  await request.save();

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`📂 Bürokratik İmza Zinciri - Evrak #${requestId}`)
    .setDescription('Yüksek riskli idari eylem tetiklendi. İşlemin onaylanması için 1. ve 2. Derece imza onayları gereklidir.')
    .addFields(
      { name: '📄 Evrak Tipi', value: `\`${actionType}\``, inline: true },
      { name: '⚖️ Detaylar', value: `\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\``, inline: false },
      { name: '✍️ İmzalar', value: 'None yet', inline: false }
    )
    .setFooter({ text: 'Eko Yıldız • İdari İşler ve Bürokrasi' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`signoff_1st_${requestId}`)
      .setLabel('✍️ 1. Derece İmza Ekle (Sekreter)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`signoff_2nd_${requestId}`)
      .setLabel('✍️ 2. Derece İmza Ekle (G. Koordinatör)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`signoff_veto_${requestId}`)
      .setLabel('❌ Evrağı Reddet/Veto Et')
      .setStyle(ButtonStyle.Danger)
  );

  const logChan = await client.channels.fetch(CHANNELS.TERFI_LOG).catch(() => null);
  if (logChan && logChan.isTextBased()) {
    await logChan.send({ embeds: [embed], components: [row] });
  }

  return requestId;
}

module.exports = { createSignOffRequest };
