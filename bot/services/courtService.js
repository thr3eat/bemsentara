'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const CourtCase = require('../../models/CourtCase');
const User = require('../../models/User');
const Economy = require('../../models/Economy');
const { ROLES } = require('./staffSystem');

const STAFF_GUILD_ID = process.env.STAFF_GUILD_ID || '1367646464804655104';
const DAVA_TRIGGER_CHANNEL_ID = '1523809094249746492';
const KODOS_CHANNEL_ID = '1521501154339586078';

// Yasa Kitabı (Sunucu Ceza Kanunu Maddeleri)
const LAW_ARTICLES = {
  '101': {
    code: 'Madde 101',
    title: 'Spam / Flood (1. Derece Düzen İhlali)',
    description: 'Sohbet kanalında tekrarlayan, anlamsız mesaj atma veya akışı bozma.',
    penalty: '12 Saat Mute veya 50 Mesaj Kamu Hizmeti'
  },
  '204': {
    code: 'Madde 204',
    title: 'Troll / Sohbet Baltalama (Huzur İhlali)',
    description: 'Üyeleri kışkırtma, konuyu saptırma veya huzuru kaçırma.',
    penalty: '"Geveze" Rolü + 24 Saat Ağız Bandı'
  },
  '301': {
    code: 'Madde 301',
    title: 'Yetkiliye Saygısızlık / Mahkemeye Hakaret',
    description: 'Moderatör veya mahkeme heyetinin talimatlarına uymama, hakaret etme.',
    penalty: 'Ağırlaştırılmış Müebbet Mute / Hapis (Yargıç Kaldırabilir)'
  },
  '404': {
    code: 'Madde 404',
    title: 'Hakaret / Şahsa Saldırı',
    description: 'Sunucu üyelerine yönelik ağır sözler, kişisel değerlere taciz.',
    penalty: '24 Saat Mute + 100 Mesaj Kamu Hizmeti'
  },
  '505': {
    code: 'Madde 505',
    title: 'Dolandırıcılık / Sahtekarlık',
    description: 'Sunucu içi takaslarda veya puan işlemlerinde aldatma.',
    penalty: 'Müebbet Hapis / Sunucudan Uzaklaştırma'
  },
  '606': {
    code: 'Madde 606',
    title: 'Rüşvet ve Yolsuzluk (Yargıya Müdahale)',
    description: 'Mahkeme heyetine, savcıya veya avukata çıkar teklif etme.',
    penalty: 'Katlamalı Hapis & Çifte Kamu Hizmeti'
  },
  '707': {
    code: 'Madde 707',
    title: 'İftira / Yalancı Şahitlik (Adaleti Yanıltma)',
    description: 'Asılsız dava açma, sahte delil veya yalan tanıklık.',
    penalty: 'Davanın 2 Katı Ceza (Davacıya / Şahide)'
  }
};

/**
 * Ensures Mahkeme & RP Roles exist in guild
 */
async function ensureCourtRoles(guild) {
  const roleNames = [
    { name: 'Başhakim / Yargıç', color: '#f1c40f' },
    { name: 'Savcı', color: '#e67e22' },
    { name: 'Avukat', color: '#3498db' },
    { name: 'Polis / Kolluk', color: '#e74c3c' },
    { name: 'Jüri', color: '#9b59b6' },
    { name: 'Sokak Süpürgesi', color: '#95a5a6' }, // Kamu hizmeti
    { name: 'Ağız Bandı', color: '#34495e' },
    { name: 'Mahkum', color: '#7f8c8d' }
  ];

  const createdRoles = {};
  for (const rDef of roleNames) {
    let role = guild.roles.cache.find(r => r.name.toLowerCase() === rDef.name.toLowerCase());
    if (!role) {
      role = await guild.roles.create({
        name: rDef.name,
        color: rDef.color,
        reason: 'Mahkeme sistemi için otomatik oluşturuldu.'
      }).catch(() => null);
    }
    if (role) createdRoles[rDef.name] = role.id;
  }
  return createdRoles;
}

/**
 * Sets up trigger button in #dava-talebi / config channel
 */
async function setupCourtTriggerButton(client) {
  try {
    const channel = await client.channels.fetch(DAVA_TRIGGER_CHANNEL_ID).catch(() => null);
    if (channel && channel.isTextBased()) {
      const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
      const exists = messages && messages.some(m => m.components.some(row => row.components.some(c => c.customId === 'court_petition_start')));
      if (!exists) {
        const embed = new EmbedBuilder()
          .setTitle('⚖️ SUNUCU ADALET VE MAHKEME BAŞKANLIĞI')
          .setDescription(
            'Sunucumuzda adaletin sağlanması ve kural ihlallerinin adil bir duruşma ile değerlendirilmesi için **Dava Başlat** sistemini kullanabilirsiniz.\n\n' +
            '📜 **Dilekçe Verme:** Şikayetinizi ve delillerinizi sunarak resmi dava açabilirsiniz.\n' +
            '📖 **Yasa Kitabı:** Sunucu Ceza Kanun Maddelerini inceleyebilirsiniz.\n' +
            '🔒 **Nöbetçi Hapishane (#kodos):** Mahkum durumunu ve kefalet işlemlerini kontrol edebilirsiniz.\n\n' +
            '*Unutmayın: Asılsız davalar Madde 707 (İftira) kapsamında 2 kat ceza ile sonuçlanır!*'
          )
          .setColor(0xd4af37)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('court_petition_start')
            .setLabel('📜 Dava Dilekçesi Ver')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('court_lawbook_show')
            .setLabel('📖 Yasa Kitabı (Maddeler)')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('court_jail_status')
            .setLabel('🔒 Hapishane Durumu')
            .setStyle(ButtonStyle.Secondary)
        );

        await channel.send({ embeds: [embed], components: [row] });
      }
    }
  } catch (err) {
    console.error('[courtService] setupCourtTriggerButton error:', err.message);
  }
}

/**
 * Files a new petition (Dava Dilekçesi)
 */
async function filePetition(interaction, { defendantInput, articleKey, details, evidence, requestedPenalty }) {
  const guild = interaction.guild;
  if (!guild) return interaction.editReply({ content: '❌ Sunucu bulunamadı.' });

  // Resolve target defendant user ID
  let targetUserId = defendantInput.replace(/[<@!>]/g, '').trim();
  if (!/^\d+$/.test(targetUserId)) {
    const member = guild.members.cache.find(m =>
      m.user.username.toLowerCase() === targetUserId.toLowerCase() ||
      (m.nickname && m.nickname.toLowerCase() === targetUserId.toLowerCase())
    );
    if (member) {
      targetUserId = member.id;
    } else {
      return interaction.editReply({ content: `❌ Şüpheli kullanıcı ID veya kullanıcı adı bulunamadı: \`${defendantInput}\`` });
    }
  }

  const article = LAW_ARTICLES[articleKey] || {
    code: `Madde ${articleKey}`,
    title: 'Özel İhlal',
    penalty: requestedPenalty || 'Hakim Kanaati'
  };

  const caseCode = `DAVA-${Math.floor(100000 + Math.random() * 900000)}`;

  const courtCase = await CourtCase.create({
    caseCode,
    status: 'pending_approval',
    plaintiffId: interaction.user.id,
    defendantId: targetUserId,
    lawArticle: article.code,
    lawArticleTitle: article.title,
    reason: details,
    evidence: evidence || 'Görsel / Mesaj Linki Belirtilmedi',
    requestedPenalty: requestedPenalty || article.penalty
  });

  // Post to petition review channel or same channel
  const reviewEmbed = new EmbedBuilder()
    .setTitle(`📜 YENİ DAVA DİLEKÇESİ — Kod: ${caseCode}`)
    .setColor(0xe67e22)
    .addFields(
      { name: '⚖️ Davacı (Müşteki)', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
      { name: '👤 Davalı (Şüpheli)', value: `<@${targetUserId}> (\`${targetUserId}\`)`, inline: true },
      { name: '📖 Suçlama Maddesi', value: `**${article.code}** - ${article.title}`, inline: false },
      { name: '📋 Suç Detayı / Açıklama', value: details, inline: false },
      { name: '📸 Kanıtlar', value: evidence || 'Belirtilmedi', inline: false },
      { name: '⚖️ Talep Edilen Ceza', value: requestedPenalty || article.penalty, inline: true }
    )
    .setFooter({ text: 'Savcı veya Moderatörler davayı inceleyip onaylayabilir.' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`court_accept_${caseCode}`)
      .setLabel('✅ Davayı Kabul Et')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`court_reject_${caseCode}`)
      .setLabel('❌ Davayı Reddet')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({
    content: `✅ Dilekçeniz **${caseCode}** kodu ile alındı ve mahkeme heyetinin incelemesine sunuldu!`,
    ephemeral: true
  });

  const reviewChannel = guild.channels.cache.find(c => c.name.includes('dava-talepleri') || c.name.includes('sorusturma')) || interaction.channel;
  if (reviewChannel && reviewChannel.isTextBased()) {
    await reviewChannel.send({ embeds: [reviewEmbed], components: [actionRow] }).catch(() => {});
  }
}

/**
 * Accepts a case and creates the court trial channel #dava-caseCode
 */
async function acceptCase(interaction, caseCode) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: '❌ Sunucu bulunamadı.', ephemeral: true });

  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava kaydı bulunamadı.', ephemeral: true });

  if (courtCase.status !== 'pending_approval') {
    return interaction.reply({ content: `⚠️ Bu dava zaten işleme alınmış (${courtCase.status}).`, ephemeral: true });
  }

  courtCase.status = 'court_active';
  courtCase.moderatorId = interaction.user.id;
  await courtCase.save();

  // Find or create Court Category
  let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toUpperCase().includes('MAHKEME'));
  if (!category) {
    category = await guild.channels.create({
      name: '⚖️ MAHKEME SALONU',
      type: ChannelType.GuildCategory,
      reason: 'Mahkeme kanalları için oluşturuldu.'
    }).catch(() => null);
  }

  const roles = await ensureCourtRoles(guild);

  // Setup overwrites
  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.SendMessages] // Public can view, but only participants send
    },
    {
      id: courtCase.plaintiffId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: courtCase.defendantId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    }
  ];

  if (roles['Başhakim / Yargıç']) {
    overwrites.push({
      id: roles['Başhakim / Yargıç'],
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
    });
  }
  if (roles['Savcı']) {
    overwrites.push({
      id: roles['Savcı'],
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
    });
  }
  if (roles['Avukat']) {
    overwrites.push({
      id: roles['Avukat'],
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
    });
  }

  const channelName = `dava-${caseCode.toLowerCase()}`;
  const trialChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category ? category.id : null,
    permissionOverwrites: overwrites,
    reason: `Dava duruşması başlatıldı: ${caseCode}`
  }).catch(err => {
    console.error('[courtService] channel create error:', err.message);
    return null;
  });

  if (!trialChannel) {
    return interaction.reply({ content: '❌ Duruşma kanalı oluşturulamadı.', ephemeral: true });
  }

  courtCase.channelId = trialChannel.id;
  await courtCase.save();

  // Send Main Trial Control Panel in the new channel
  const courtEmbed = new EmbedBuilder()
    .setTitle(`⚖️ MAHKEME SALONU — Duruşma Başladı (${caseCode})`)
    .setDescription(
      `**Dava Konusu:** ${courtCase.lawArticle} - ${courtCase.lawArticleTitle}\n` +
      `**Davacı:** <@${courtCase.plaintiffId}>\n` +
      `**Davalı (Sanık):** <@${courtCase.defendantId}>\n` +
      `**Dava Savcısı / Hakimi:** <@${interaction.user.id}>\n\n` +
      `📜 **Gerekçe:** ${courtCase.reason}\n` +
      `📸 **Deliller:** ${courtCase.evidence}\n\n` +
      `🏛️ **Duruşma Başlamıştır!**\n` +
      `Sanık <@${courtCase.defendantId}> savunma yapmak için hazırdır. İsterse bir **Avukat** tutabilir.`
    )
    .setColor(0xd4af37)
    .setTimestamp();

  const controlRow1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`court_hire_lawyer_${caseCode}`)
      .setLabel('💼 Avukat Tut / Ata')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`court_jury_start_${caseCode}`)
      .setLabel('📊 Jüri Oylaması Başlat')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`court_witness_${caseCode}`)
      .setLabel('🕵️ Şahit Çağır')
      .setStyle(ButtonStyle.Secondary)
  );

  const controlRow2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`court_bribe_${caseCode}`)
      .setLabel('💸 Gizli Rüşvet Teklif Et')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`court_verdict_${caseCode}`)
      .setLabel('⚖️ Karar Açıkla / Hüküm Ver')
      .setStyle(ButtonStyle.Success)
  );

  await trialChannel.send({
    content: `🔔 Duruşma Daveti: <@${courtCase.plaintiffId}> | <@${courtCase.defendantId}>`,
    embeds: [courtEmbed],
    components: [controlRow1, controlRow2]
  });

  return interaction.reply({
    content: `✅ Dava kabul edildi! Duruşma kanalı açıldı: <#${trialChannel.id}>`,
    ephemeral: true
  });
}

/**
 * Rejects a case
 */
async function rejectCase(interaction, caseCode) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava kaydı bulunamadı.', ephemeral: true });

  courtCase.status = 'rejected';
  await courtCase.save();

  const embed = new EmbedBuilder()
    .setTitle(`❌ DAVA DİLEKÇESİ REDDEDİLDİ (${caseCode})`)
    .setDescription(`Dava dilekçesi <@${interaction.user.id}> tarafından yetersiz delil veya anlamsız suçlama nedeniyle reddedilmiştir.`)
    .setColor(0xed4245);

  return interaction.reply({ embeds: [embed] });
}

/**
 * Handles Lawyer assignment (Official or Blackmarket)
 */
async function hireLawyer(interaction, caseCode, targetLawyerId, isBlackmarket = false) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  courtCase.lawyerId = targetLawyerId;
  courtCase.isBlackmarketLawyer = isBlackmarket;
  await courtCase.save();

  const channel = interaction.guild.channels.cache.get(courtCase.channelId);
  if (channel) {
    await channel.permissionOverwrites.edit(targetLawyerId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  const title = isBlackmarket ? '🕵️ Karaborsa Avukat Savunmaya Katıldı!' : '💼 Resmi Avukat Duruşmaya Katıldı!';
  const desc = `<@${targetLawyerId}> sanık <@${courtCase.defendantId}> tarafını savunmak üzere davaya dahil oldu.`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(isBlackmarket ? 0x9b59b6 : 0x3498db);

  return interaction.reply({ embeds: [embed] });
}

/**
 * Starts a 10-minute Jury Poll
 */
async function startJuryVote(interaction, caseCode) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  if (courtCase.juryVote && courtCase.juryVote.active) {
    return interaction.reply({ content: '⚠️ Bu dava için zaten aktif bir jüri oylaması var.', ephemeral: true });
  }

  courtCase.juryVote = {
    active: true,
    endsAt: new Date(Date.now() + 10 * 60 * 1000),
    guiltyVotes: [],
    innocentVotes: []
  };
  await courtCase.save();

  const pollEmbed = new EmbedBuilder()
    .setTitle(`📊 JÜRİ OYLAMASI BAŞLADI — Dava ${caseCode}`)
    .setDescription(
      `Sunucu üyeleri ve jüri heyeti sanık <@${courtCase.defendantId}> hakkında vicdani kanaatini açıklıyor!\n\n` +
      `**Suçlama:** ${courtCase.lawArticle} - ${courtCase.lawArticleTitle}\n` +
      `**Süre:** 10 Dakika\n\n` +
      `👍 **SUÇLU** | 👎 **SUÇSUZ**`
    )
    .setColor(0x9b59b6)
    .setFooter({ text: 'Oylama sonucu Yargıcın kararına rehberlik edecektir.' });

  const voteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`court_vote_guilty_${caseCode}`)
      .setLabel('👍 Suçlu (Guilty)')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`court_vote_innocent_${caseCode}`)
      .setLabel('👎 Suçsuz (Innocent)')
      .setStyle(ButtonStyle.Success)
  );

  return interaction.reply({ embeds: [pollEmbed], components: [voteRow] });
}

/**
 * Casts a vote in the Jury Poll
 */
async function voteJury(interaction, caseCode, isGuilty) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase || !courtCase.juryVote || !courtCase.juryVote.active) {
    return interaction.reply({ content: '❌ Aktif bir jüri oylaması bulunamadı.', ephemeral: true });
  }

  const userId = interaction.user.id;
  const guilty = courtCase.juryVote.guiltyVotes || [];
  const innocent = courtCase.juryVote.innocentVotes || [];

  if (guilty.includes(userId) || innocent.includes(userId)) {
    return interaction.reply({ content: '⚠️ Bu oylamada zaten oy kullandınız.', ephemeral: true });
  }

  if (isGuilty) {
    guilty.push(userId);
  } else {
    innocent.push(userId);
  }

  courtCase.juryVote.guiltyVotes = guilty;
  courtCase.juryVote.innocentVotes = innocent;
  await courtCase.save();

  return interaction.reply({
    content: `✅ Oyunuz başarıyla kaydedildi! (Suçlu: ${guilty.length} | Suçsuz: ${innocent.length})`,
    ephemeral: true
  });
}

/**
 * Handles secret Bribe Offer & Expose mechanism
 */
async function offerBribe(interaction, caseCode, amount) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  if (interaction.user.id !== courtCase.defendantId) {
    return interaction.reply({ content: '❌ Rüşvet teklifini sadece sanık yapabilir!', ephemeral: true });
  }

  courtCase.briberyState = {
    offered: true,
    amount: Number(amount) || 500,
    targetId: courtCase.moderatorId,
    exposed: false
  };
  await courtCase.save();

  const bribeEmbed = new EmbedBuilder()
    .setTitle('💸 GİZLİ RÜŞVET TEKLİFİ GELEN BİLDİRİM!')
    .setDescription(
      `Sanık <@${interaction.user.id}> davanın düşürülmesi karşılığında size **${amount} Coin** rüşvet teklif etti!\n\n` +
      `⚠️ **Karar Verin:**\n` +
      `- Rüşveti kabul edip davayı düşürebilirsiniz.\n` +
      `- **İFŞA ET** butonuna basarak rüşveti belgeleyip davanın suçunu katlayabilirsiniz!`
    )
    .setColor(0xe74c3c);

  const bribeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`court_bribe_accept_${caseCode}`)
      .setLabel('💵 Rüşveti Kabul Et')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`court_bribe_expose_${caseCode}`)
      .setLabel('🚨 İFŞA ET (Yolsuzluk Davası)')
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({ embeds: [bribeEmbed], components: [bribeRow], ephemeral: true });
}

/**
 * Exposes a bribe offer and doubles penalties
 */
async function exposeBribe(interaction, caseCode) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase || !courtCase.briberyState || !courtCase.briberyState.offered) {
    return interaction.reply({ content: '❌ Aktif rüşvet teklifi bulunamadı.', ephemeral: true });
  }

  courtCase.briberyState.exposed = true;
  courtCase.lawArticle = 'Madde 606 & 301';
  courtCase.lawArticleTitle = 'Rüşvet, Yolsuzluk ve Mahkemeye Hakaret';
  await courtCase.save();

  const exposeEmbed = new EmbedBuilder()
    .setTitle('🚨 RÜŞVET VE YOLSUZLUK İFŞALANDI!')
    .setDescription(
      `⚠️ Sanık <@${courtCase.defendantId}> mahkeme heyetine **${courtCase.briberyState.amount} Coin** rüşvet teklif ederken **İFŞALANDI**!\n\n` +
      `Dava konusu ağırlaştırılarak **Madde 606 (Rüşvet ve Yolsuzluk)** kapsamına alınmıştır. Sanığa verilecek ceza katlanacaktır!`
    )
    .setColor(0xed4245);

  return interaction.reply({ embeds: [exposeEmbed] });
}

/**
 * Applies Verdict and RP Punishments
 */
async function applyVerdict(interaction, caseCode, verdictType, verdictNote = '') {
  const guild = interaction.guild;
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  const roles = await ensureCourtRoles(guild);
  const defendantMember = await guild.members.fetch(courtCase.defendantId).catch(() => null);

  courtCase.status = 'closed';
  courtCase.verdict = verdictType;
  courtCase.verdictNote = verdictNote;
  courtCase.verdictBy = interaction.user.id;
  await courtCase.save();

  let verdictTitle = '⚖️ MAHKEME KARARI AÇIKLANDI';
  let verdictDesc = `**Sanık:** <@${courtCase.defendantId}>\n**Gerekçe:** ${verdictNote || 'Mahkeme heyeti kararı'}\n\n`;
  let embedColor = 0x2ecc71;

  if (verdictType === 'acquitted') {
    verdictTitle = '🕊️ BERAAT VE TAZMİNAT KARARI';
    verdictDesc += `Sanık <@${courtCase.defendantId}> suçsuz bulunarak BERAAT etmiştir!\n`;

    // Transfer compensation coin from plaintiff to defendant if false accusation
    let plaintiffEco = await Economy.findOne({ userId: courtCase.plaintiffId });
    let defendantEco = await Economy.findOne({ userId: courtCase.defendantId });
    if (plaintiffEco && defendantEco && plaintiffEco.wallet >= 100) {
      plaintiffEco.wallet = Math.max(0, plaintiffEco.wallet - 200);
      defendantEco.wallet = (defendantEco.wallet || 0) + 200;
      await plaintiffEco.save();
      await defendantEco.save();
      verdictDesc += `💰 Haksız dava sebebiyle davacı <@${courtCase.plaintiffId}> tarafından sanığa **200 Coin Tazminat** aktarılmıştır.`;
    }
  } else if (verdictType === 'community_service') {
    verdictTitle = '🧹 KAMU HİZMETİ CEZASI';
    const targetMsgCount = 50;
    courtCase.communityService = {
      active: true,
      targetCount: targetMsgCount,
      currentCount: 0,
      roleId: roles['Sokak Süpürgesi']
    };
    await courtCase.save();

    if (defendantMember && roles['Sokak Süpürgesi']) {
      await defendantMember.roles.add(roles['Sokak Süpürgesi']).catch(() => {});
    }

    verdictDesc += `Sanık <@${courtCase.defendantId}> suçlu bulunmuş ve **${targetMsgCount} Mesajlık Kamu Hizmeti** cezasına çarptırılmıştır.\n` +
      `Sokak Süpürgesi rolü verilmiştir. Genel sohbete selam verip mesaj atarak cezasını tamamlayacaktır!`;
    embedColor = 0xe67e22;
  } else if (verdictType === 'mouth_tape') {
    verdictTitle = '🤐 AĞIZ BANDI (SESSİZE ALMA) CEZASI';
    if (defendantMember && roles['Ağız Bandı']) {
      await defendantMember.roles.add(roles['Ağız Bandı']).catch(() => {});
    }
    verdictDesc += `Sanık <@${courtCase.defendantId}> sohbeti sabote etmekten suçlu görülmüş ve **Ağız Bandı** takılmıştır.\n` +
      `Metin kanallarında yazması engellenmiştir.`;
    embedColor = 0xe74c3c;
  } else if (verdictType === 'jail') {
    verdictTitle = '🔒 NÖBETÇİ HAPİSHANE (#kodos) CEZASI';
    const taskCount = 100;
    const bail = 500;

    courtCase.jailTask = {
      active: true,
      targetCount: taskCount,
      currentCount: 0,
      bailAmount: bail,
      roleId: roles['Mahkum']
    };
    await courtCase.save();

    if (defendantMember && roles['Mahkum']) {
      await defendantMember.roles.add(roles['Mahkum']).catch(() => {});
    }

    verdictDesc += `Sanık <@${courtCase.defendantId}> ağır ihlalden dolayı **Nöbetçi Hapishaneye (#kodos)** gönderilmiştir!\n\n` +
      `🔓 **Tahliye Görevi:** #kodos kanalına ${taskCount} mesaj yazmak veya **${bail} Coin** Kefalet ödemek!`;
    embedColor = 0x7f8c8d;
  } else if (verdictType === 'slander_penalty') {
    verdictTitle = '🎭 İFTİRA CEZASI (ÇİFTE CEZA)';
    verdictDesc += `Davacı <@${courtCase.plaintiffId}> sahte dava ve iftira suçundan **2 KAT CEZA** almıştır!\n` +
      `Kamu hizmeti ve mute yaptırımı davacıya uygulanmıştır.`;
    embedColor = 0xed4245;
  }

  const verdictEmbed = new EmbedBuilder()
    .setTitle(verdictTitle)
    .setDescription(verdictDesc)
    .setColor(embedColor)
    .setTimestamp();

  return interaction.reply({ embeds: [verdictEmbed] });
}

/**
 * Listens to messageCreate for Community Service & Jail task progress
 */
async function handleCourtMessageCount(message) {
  if (!message || message.author.bot || !message.guild) return;

  const userId = message.author.id;

  // Check active community service
  const activeCases = await CourtCase.find({
    status: 'closed',
    $or: [{ 'communityService.active': true }, { 'jailTask.active': true }]
  });

  for (const cCase of activeCases) {
    // Community service progress
    if (cCase.defendantId === userId && cCase.communityService && cCase.communityService.active) {
      cCase.communityService.currentCount = (cCase.communityService.currentCount || 0) + 1;
      if (cCase.communityService.currentCount >= cCase.communityService.targetCount) {
        cCase.communityService.active = false;
        await cCase.save();

        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member && cCase.communityService.roleId) {
          await member.roles.remove(cCase.communityService.roleId).catch(() => {});
        }

        await message.channel.send(
          `🎉 Tebrikler <@${userId}>! **Kamu Hizmeti** görevinizi (${cCase.communityService.targetCount} mesaj) başarıyla tamamladınız. Cezanız kaldırıldı!`
        ).catch(() => {});
      } else {
        await cCase.save();
      }
    }

    // Jail task progress in #kodos channel
    if (cCase.defendantId === userId && cCase.jailTask && cCase.jailTask.active && message.channel.id === KODOS_CHANNEL_ID) {
      cCase.jailTask.currentCount = (cCase.jailTask.currentCount || 0) + 1;
      if (cCase.jailTask.currentCount >= cCase.jailTask.targetCount) {
        cCase.jailTask.active = false;
        await cCase.save();

        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member && cCase.jailTask.roleId) {
          await member.roles.remove(cCase.jailTask.roleId).catch(() => {});
        }

        await message.channel.send(
          `🔓 **TAHLİYE OLUNDUNUZ!** <@${userId}> hapishane tahliye görevini (${cCase.jailTask.targetCount} mesaj) tamamlayarak özgürlüğüne kavuştu!`
        ).catch(() => {});
      } else {
        await cCase.save();
      }
    }
  }
}

module.exports = {
  LAW_ARTICLES,
  ensureCourtRoles,
  setupCourtTriggerButton,
  filePetition,
  acceptCase,
  rejectCase,
  hireLawyer,
  startJuryVote,
  voteJury,
  offerBribe,
  exposeBribe,
  applyVerdict,
  handleCourtMessageCount
};
