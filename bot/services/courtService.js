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

const DAVA_TRIGGER_CHANNEL_ID = '1523809094249746492';
const KODOS_CHANNEL_ID = '1521501154339586078';

// Sunucu Ceza Kanunu (Yasa Kitabı)
const LAW_ARTICLES = {
  '101': {
    code: 'Madde 101',
    title: 'Spam / Flood (1. Derece Düzen İhlali)',
    description: 'Sohbet kanalında tekrarlayan, anlamsız mesaj atma veya akışı bozma.',
    penalty: '12 Saat Mute veya 50 Mesaj Kamu Hizmeti'
  },
  '102': {
    code: 'Madde 102',
    title: 'Huzur ve Sükunu Bozma',
    description: 'Sunucudaki genel huzuru baltalama, tartışmaları uzatma veya üyeleri rahatsız etme.',
    penalty: '24 Saat Sohbet Hapsi / İhtiyati Tedbir'
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
    { name: 'Sokak Süpürgesi', color: '#95a5a6' },
    { name: 'Ağız Bandı', color: '#34495e' },
    { name: 'Mahkum', color: '#7f8c8d' },
    { name: 'İhtiyati Tedbir', color: '#e67e22' }
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
 * Automatically discovers or creates #soruşturma-başlat channel and posts buttons
 */
async function setupCourtTriggerButton(client) {
  try {
    for (const guild of client.guilds.cache.values()) {
      // Otomatik açılan '🔍-soruşturma-başlat' kanallarını temizle (Sabit kanal ID'si hariç)
      const autoCreated = guild.channels.cache.filter(c => c.name === '🔍-soruşturma-başlat' && c.id !== DAVA_TRIGGER_CHANNEL_ID);
      for (const autoChan of autoCreated.values()) {
        await autoChan.delete('Otomatik soruşturma kanalı oluşturma iptal edildi.').catch(() => null);
      }

      // Sadece sunucuda ZATEN VAR OLAN kanalı bul (Yeni kanal ASLA oluşturulmaz)
      let channel = guild.channels.cache.find(c =>
        c.id === DAVA_TRIGGER_CHANNEL_ID ||
        c.name === 'sorusturma-baslat' ||
        c.name === 'soruşturma-başlat' ||
        c.name === 'dava-talebi'
      );

      if (channel && channel.isTextBased()) {
        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        const { StringSelectMenuBuilder } = require('discord.js');
        const exists = messages && messages.some(m => m.components && m.components.some(row => row.components && row.components.some(c => c.customId === 'court_main_category_select')));
        if (!exists) {
          const embed = new EmbedBuilder()
            .setTitle('⚖️ EKOYILDIZ MAHKEMESİ BİLİŞİM SUÇLARI BÜROSU')
            .setDescription(
              'Sunucumuzda adaletin sağlanması ve yargı süreçlerinin yürütülmesi için **3 Aşamalı Hiyerarşik Menüyü** kullanabilirsiniz.\n\n' +
              '📂 **Aşağıdaki Menüden İşlem Yapmak İstediğiniz Büroyu Seçin:**\n' +
              '├ 🏢 **Savcılık & Soruşturma Bürosu:** İhbar verme, Gizli Soruşturma & İddianameler\n' +
              '├ ⚖️ **Mahkeme & Yargılama Bürosu:** Duruşmalar, Avukat Atama & Jüri Oylaması\n' +
              '├ 📜 **Mevzuat & Sicil Bürosu:** Ceza Kanunu (Yasa Kitabı) & Adli Sicil Sorgusu\n' +
              '├ 🔒 **İnfaz & İhtiyati Tedbir Bürosu:** #kodos Hapishanesi & Sohbet Hapsi Tedbiri\n' +
              '└ 🤝 **Uzlaşma & İtiraz Bürosu:** Uzlaştırma Görüşmeleri, İstinaf & AYM Başvurusu'
            )
            .setColor(0xd4af37)
            .setFooter({ text: 'Eko Yıldız Adalet Bakanlığı • Hiyerarşik Yargı Sistemi' })
            .setTimestamp();

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('court_main_category_select')
            .setPlaceholder('📌 İşlem yapmak istediğiniz Adli Büroyu seçin...')
            .addOptions([
              {
                label: '🏢 Savcılık & Soruşturma Bürosu',
                description: 'Dilekçe verme, Gizli Soruşturma Dosyaları & İddianame',
                value: 'court_cat_prosecution',
                emoji: '🏢'
              },
              {
                label: '⚖️ Mahkeme & Yargılama Bürosu',
                description: 'Duruşma salonları, Avukat tayini & Jüri oylaması',
                value: 'court_cat_trial',
                emoji: '⚖️'
              },
              {
                label: '📜 Mevzuat & Sicil Bürosu',
                description: 'Yasa Kitabı (Ceza Maddeleri) & Adli Sicil / Örnek Vatandaş',
                value: 'court_cat_law',
                emoji: '📜'
              },
              {
                label: '🔒 İnfaz & İhtiyati Tedbir Bürosu',
                description: 'Nöbetçi Hapishane (#kodos), Kefalet & Sohbet Hapsi Tedbiri',
                value: 'court_cat_jail',
                emoji: '🔒'
              },
              {
                label: '🤝 Uzlaşma & İtiraz Bürosu',
                description: 'Uzlaştırma Bürosu görüşmeleri, İstinaf & AYM Başvuruları',
                value: 'court_cat_settlement',
                emoji: '🤝'
              }
            ]);

          const menuRow = new ActionRowBuilder().addComponents(selectMenu);

          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('court_petition_start')
              .setLabel('📜 Hızlı Dilekçe Ver')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('court_staff_petition_start')
              .setLabel('🛡️ (Yetkili) Dava Başlat')
              .setStyle(ButtonStyle.Success)
          );

          await channel.send({ embeds: [embed], components: [menuRow, buttonRow] }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[courtService] setupCourtTriggerButton error:', err.message);
  }
}

/**
 * 🏢 1. Savcılık Evresi & Gizli Soruşturma Dosyası Oluşturma
 */
async function filePetition(interaction, { defendantInput, articleKey, details, evidence, requestedPenalty }) {
  const guild = interaction.guild;
  if (!guild) return interaction.editReply({ content: '❌ Sunucu bulunamadı.' });

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
  const year = new Date().getFullYear();
  const investigationNo = `Dosya No: ${year}/${Math.floor(100 + Math.random() * 900)}`;

  const courtCase = await CourtCase.create({
    caseCode,
    investigationNo,
    phase: 'prosecution',
    status: 'pending_approval',
    plaintiffId: interaction.user.id,
    defendantId: targetUserId,
    lawArticle: article.code,
    lawArticleTitle: article.title,
    reason: details,
    evidence: evidence || 'Görsel / Mesaj Linki Belirtilmedi',
    requestedPenalty: requestedPenalty || article.penalty
  });

  // Find or create #gizli-soruşturma channel
  let secrecyChannel = guild.channels.cache.find(c => c.name.includes('gizli-sorusturma') || c.name.includes('gizli-soruşturma'));
  if (!secrecyChannel) {
    const roles = await ensureCourtRoles(guild);
    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }
    ];
    if (roles['Savcı']) overwrites.push({ id: roles['Savcı'], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    if (roles['Başhakim / Yargıç']) overwrites.push({ id: roles['Başhakim / Yargıç'], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

    secrecyChannel = await guild.channels.create({
      name: '🕵️-gizli-soruşturma',
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
      reason: 'Savcılık gizli soruşturma dosyaları için oluşturuldu.'
    }).catch(() => null);
  }

  const prosecutionEmbed = new EmbedBuilder()
    .setTitle(`🕵️ GİZLİ SORUŞTURMA DOSYASI — ${investigationNo}`)
    .setDescription(
      `**Dava Kodu:** \`${caseCode}\`\n` +
      `**İhbar Eden (Davacı):** <@${interaction.user.id}>\n` +
      `**Şüpheli (Davalı):** <@${targetUserId}> *(Şüpheliye henüz tebligat gitmedi - Soruşturma Gizli)*\n\n` +
      `📖 **Suçlama:** ${article.code} - ${article.title}\n` +
      `📋 **Detay:** ${details}\n` +
      `📸 **Kanıtlar:** ${evidence}`
    )
    .setColor(0xe67e22)
    .setFooter({ text: 'Savcılık Makamı kanıtları inceleyip KYOK veya İddianame kararı verecektir.' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`court_indictment_start_${caseCode}`)
      .setLabel('📋 İddianame Hazırla & Dava Aç')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`court_kyok_${caseCode}`)
      .setLabel('❌ Kovuşturmaya Yer Yok (KYOK)')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`court_settlement_start_${caseCode}`)
      .setLabel('🤝 Uzlaştırıcıya Sevk Et')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    content: `✅ Dilekçeniz **${investigationNo}** ile Savcılık Makamına ulaştı. Gizli soruşturma başlatıldı!`,
    ephemeral: true
  });

  if (secrecyChannel && secrecyChannel.isTextBased()) {
    await secrecyChannel.send({ embeds: [prosecutionEmbed], components: [actionRow] }).catch(() => {});
  }
}

/**
 * 🏢 Takipsizlik (KYOK - Kovuşturmaya Yer Yoktur) Kararı
 */
async function issueKYOK(interaction, caseCode, reason = 'Kanıt Yetersizliği') {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  courtCase.phase = 'kyok';
  courtCase.status = 'rejected';
  courtCase.kyokReason = reason;
  await courtCase.save();

  const kyokEmbed = new EmbedBuilder()
    .setTitle(`❌ TAKİPSİZLİK KARARI (KYOK) — ${courtCase.investigationNo}`)
    .setDescription(
      `Savcılık Makamı incelemesi sonucunda ihbar edilen konu hakkında **Kovuşturmaya Yer Yoktur (KYOK)** kararı verilmiştir.\n\n` +
      `**Gerekçe:** ${reason}\n` +
      `Dosya işlemden kaldırılmış ve kapatılmıştır.`
    )
    .setColor(0x7f8c8d);

  return interaction.reply({ embeds: [kyokEmbed] });
}

/**
 * 📜 2. İddianame Hazırlama & DM Resmi Tebligat Gönderimi
 */
async function issueIndictment(interaction, caseCode, indictmentText) {
  const guild = interaction.guild;
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  courtCase.phase = 'trial';
  courtCase.status = 'court_active';
  courtCase.indictmentDetails = indictmentText;
  courtCase.summonsSentAt = new Date();
  await courtCase.save();

  // Create Trial Channel #dava-caseCode
  let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toUpperCase().includes('MAHKEME'));
  if (!category) {
    category = await guild.channels.create({
      name: '⚖️ MAHKEME SALONU',
      type: ChannelType.GuildCategory
    }).catch(() => null);
  }

  const roles = await ensureCourtRoles(guild);
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
    { id: courtCase.plaintiffId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    { id: courtCase.defendantId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
  ];
  if (roles['Başhakim / Yargıç']) overwrites.push({ id: roles['Başhakim / Yargıç'], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });
  if (roles['Savcı']) overwrites.push({ id: roles['Savcı'], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

  const trialChannel = await guild.channels.create({
    name: `dava-${caseCode.toLowerCase()}`,
    type: ChannelType.GuildText,
    parent: category ? category.id : null,
    permissionOverwrites: overwrites
  }).catch(() => null);

  if (trialChannel) {
    courtCase.channelId = trialChannel.id;
    await courtCase.save();
  }

  // Check Sabıka Kaydı for Tekerrür Suçu
  const targetDbUser = await User.findOne({ discordId: courtCase.defendantId });
  const pastRecords = targetDbUser?.criminalRecord || [];
  const isTekerrur = pastRecords.length > 0;

  // Send Official DM Tebligat
  const defendantUser = await interaction.client.users.fetch(courtCase.defendantId).catch(() => null);
  if (defendantUser) {
    const summonsEmbed = new EmbedBuilder()
      .setTitle('⚖️ EKOYILDIZ MAHKEMESİ BİLİŞİM SUÇLARI BÜROSU — RESMİ TEBLİGAT')
      .setDescription(
        `Sayın <@${courtCase.defendantId}>,\n\n` +
        `Hakkınızda **${courtCase.lawArticle} (${courtCase.lawArticleTitle})** kapsamında Savcılık İddianamesi kabul edilmiş ve dava açılmıştır.\n\n` +
        `📂 **${courtCase.investigationNo}**\n` +
        `🏛️ **Mahkeme Salonu:** <#${trialChannel?.id || 'Mahkeme Salonu'}>\n` +
        `📋 **İddianame Özeti:** ${indictmentText}\n\n` +
        `*Savunmanızı hazırlamanız ve bir avukat tayin etmeniz önemle rica olunur. Duruşmada mazeretsiz bulunmamanız halinde gıyabi yargılama yapılacaktır.*`
      )
      .setColor(0xed4245)
      .setTimestamp();

    await defendantUser.send({ embeds: [summonsEmbed] }).catch(() => {});
  }

  // Send Trial Panel to channel
  const trialEmbed = new EmbedBuilder()
    .setTitle(`⚖️ MAHKEME SALONU — Duruşma Başladı (${caseCode})`)
    .setDescription(
      `**${courtCase.investigationNo}**\n` +
      `**Suçlama:** ${courtCase.lawArticle} - ${courtCase.lawArticleTitle}\n` +
      `**Davacı:** <@${courtCase.plaintiffId}> | **Sanık:** <@${courtCase.defendantId}>\n\n` +
      `📋 **İddianame:** ${indictmentText}\n\n` +
      (isTekerrur ? `⚠️ **TEKERRÜR UYARISI:** Sanığın geçmişte **${pastRecords.length} adet** sabıka kaydı bulunmaktadır! Yaptırım katlanarak uygulanacaktır.\n\n` : '') +
      `📜 **Resmi Tebligat Sanığa DM İle Gönderilmiştir.**`
    )
    .setColor(0xd4af37);

  const controlRow1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`court_hire_lawyer_${caseCode}`).setLabel('💼 Avukat Tut / Ata').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`court_jury_start_${caseCode}`).setLabel('📊 Jüri Oylaması Başlat').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`court_witness_${caseCode}`).setLabel('🕵️ Şahit Çağır').setStyle(ButtonStyle.Secondary)
  );

  const controlRow2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`court_precaution_toggle_${caseCode}`).setLabel('🚨 İhtiyati Tedbir (Sohbet Hapsi)').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`court_bribe_${caseCode}`).setLabel('💸 Gizli Rüşvet Teklif Et').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`court_verdict_${caseCode}`).setLabel('⚖️ Karar Açıkla / Hüküm Ver').setStyle(ButtonStyle.Success)
  );

  if (trialChannel) {
    await trialChannel.send({ embeds: [trialEmbed], components: [controlRow1, controlRow2] });
  }

  return interaction.reply({ content: `✅ İddianame kabul edildi! Resmi tebligat DM ile sanığa yollandı ve duruşma kanalı açıldı: <#${trialChannel?.id}>`, ephemeral: true });
}

/**
 * 🚨 3. İhtiyati Tedbir ve Geçici Kısıtlamalar (Sohbet Hapsi / Yayın Yasağı)
 */
async function applyPrecautionaryMeasure(interaction, caseCode, measureType) {
  const guild = interaction.guild;
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  const roles = await ensureCourtRoles(guild);
  const defendantMember = await guild.members.fetch(courtCase.defendantId).catch(() => null);

  if (measureType === 'chat_restriction') {
    const isRestricted = courtCase.precautionaryMeasures?.chatRestricted;
    courtCase.precautionaryMeasures.chatRestricted = !isRestricted;
    await courtCase.save();

    if (defendantMember && roles['İhtiyati Tedbir']) {
      if (!isRestricted) {
        await defendantMember.roles.add(roles['İhtiyati Tedbir']).catch(() => {});
        return interaction.reply({ content: `🚨 Sanık <@${courtCase.defendantId}> hakkında **İhtiyati Tedbir (Sohbet Hapsi)** uygulandı. Dava bitene kadar genel kanallara yazamaz!`, ephemeral: false });
      } else {
        await defendantMember.roles.remove(roles['İhtiyati Tedbir']).catch(() => {});
        return interaction.reply({ content: `✅ Sanık <@${courtCase.defendantId}> üzerindeki İhtiyati Tedbir kaldırıldı.`, ephemeral: false });
      }
    }
  }

  if (measureType === 'news_ban') {
    const isBan = courtCase.precautionaryMeasures?.newsBan;
    courtCase.precautionaryMeasures.newsBan = !isBan;
    await courtCase.save();

    const embed = new EmbedBuilder()
      .setTitle('📢 RESMİ YAYIN YASAĞI KARARI')
      .setDescription(`Dava konusu **${caseCode}** hakkındaki olayların genel sohbette tartışılması Mahkeme kararıyla **YASAKLANMIŞTIR**. İhlal edenler Mahkemeye Hakaret (Madde 301) ile cezalandırılacaktır.`)
      .setColor(0xed4245);

    return interaction.reply({ embeds: [embed] });
  }
}

/**
 * 🤝 6. Uzlaştırma Bürosu (Dava Açılmadan Önceki Son Çıkış)
 */
async function sendToSettlement(interaction, caseCode) {
  const guild = interaction.guild;
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  courtCase.phase = 'settlement';
  await courtCase.save();

  // Create #uzlaştırma-caseCode channel
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: courtCase.plaintiffId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    { id: courtCase.defendantId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
  ];

  const settleChannel = await guild.channels.create({
    name: `uzlaşma-${caseCode.toLowerCase()}`,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
    reason: 'Uzlaştırma Bürosu görüşmesi için oluşturuldu.'
  }).catch(() => null);

  if (settleChannel) {
    courtCase.settlement.settlementChannelId = settleChannel.id;
    courtCase.settlement.active = true;
    await courtCase.save();

    const embed = new EmbedBuilder()
      .setTitle(`🤝 UZLAŞTIRMA BÜROSU — Dosya ${courtCase.investigationNo}`)
      .setDescription(
        `Sayın Davacı <@${courtCase.plaintiffId}> ve Davalı <@${courtCase.defendantId}>,\n\n` +
        `Olay mahkemeye intikal etmeden önce **Uzlaştırma Bürosunda** buluşturuluyorsunuz.\n` +
        `Suçlu taraf özür dileyerek veya mağdurun kabul edeceği sembolik bir şartı (Örn: Özür mesajı, maça davet, 50 Coin aktarımı) yerine getirerek davayı tatlıya bağlayabilir.`
      )
      .setColor(0x3498db);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`court_settle_agree_${caseCode}`).setLabel('🤝 Uzlaşmayı Kabul Et (Dava Düşsün)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`court_settle_reject_${caseCode}`).setLabel('❌ Uzlaşmayı Reddet (Mahkemeye Git)').setStyle(ButtonStyle.Danger)
    );

    await settleChannel.send({ embeds: [embed], components: [row] });
  }

  return interaction.reply({ content: `🤝 Dosya Uzlaştırma Bürosuna sevk edildi! Kanal: <#${settleChannel?.id}>`, ephemeral: true });
}

/**
 * ⚖️ 4. İtiraz Mekanizması (İstinaf ve Anayasa Mahkemesi AYM)
 */
async function applyAppeal(interaction, caseCode, appealLevel, reason) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  if (courtCase.status !== 'closed') {
    return interaction.reply({ content: '⚠️ Yalnızca karara bağlanmış kapatılmış davalar için itiraz edilebilir.', ephemeral: true });
  }

  if (!courtCase.appeals) courtCase.appeals = [];
  courtCase.appeals.push({
    level: appealLevel, // 'istinaf' or 'aym'
    appellantId: interaction.user.id,
    reason,
    verdict: 'Pending Review',
    createdAt: new Date()
  });
  courtCase.phase = appealLevel === 'aym' ? 'aym' : 'appeal';
  await courtCase.save();

  const title = appealLevel === 'aym'
    ? '🏛️ ANAYASA MAHKEMESİNE (AYM) BİREYSEL BAŞVURU'
    : '⚖️ BÖLGE ADLİYE MAHKEMESİNE (İSTİNAF) İTİRAZ';

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `**Dava Kodu:** \`${caseCode}\`\n` +
      `**İtiraz Eden:** <@${interaction.user.id}>\n` +
      `**İtiraz Gerekçesi:** ${reason}\n\n` +
      (appealLevel === 'aym'
        ? '*Anayasa Mahkemesi kararların sunucu anayasasına ve temel ilkelerine uygunluğunu denetler. Verilen karar NİHAİDİR.*'
        : '*İstinaf Mahkemesi yerel mahkemenin delil ve ceza takdirini yeniden inceleyecektir.*')
    )
    .setColor(appealLevel === 'aym' ? 0xd4af37 : 0x3498db)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

/**
 * 📑 5. Sabıka Kaydı Sorgulama & Örnek Vatandaş
 */
async function getSabikaKaydi(userId) {
  let dbUser = await User.findOne({ discordId: userId });
  if (!dbUser) {
    dbUser = await User.create({ discordId: userId });
  }

  const records = dbUser.criminalRecord || [];
  const isOrnekVatandas = records.length === 0;

  const embed = new EmbedBuilder()
    .setTitle(`📑 ADLİ SİCİL VE SABIKA KAYDI SORGULAMA`)
    .setDescription(
      `**Kullanıcı:** <@${userId}> (\`${userId}\`)\n` +
      `**Sicil Durumu:** ${isOrnekVatandas ? '🌟 **ÖRNİK VATANDAŞ (Temiz Sicil)**' : `⚠️ **${records.length} ADET SABIKA KAYDI VAR**`}\n\n` +
      (isOrnekVatandas
        ? 'Bu kullanıcı sunucuda hiç ceza almamıştır. Çekiliş ve etkinliklerde öncelik hakkına sahiptir.'
        : records.map((r, i) => `**${i + 1}. Kayıt:** \`${r.caseCode || 'DAVA'}\` - ${r.lawArticle || 'İhlal'} (${new Date(r.date).toLocaleDateString('tr-TR')})\n*Sonuç:* ${r.verdict}`).join('\n\n'))
    )
    .setColor(isOrnekVatandas ? 0x2ecc71 : 0xe74c3c)
    .setTimestamp();

  return embed;
}

/**
 * Lawyer / Court helper actions (Jury, Bribe, Verdict, etc.)
 */
async function acceptCase(interaction, caseCode) {
  return issueIndictment(interaction, caseCode, 'Davacı ihbarı üzerine kamu davası açılmasına karar verilmiştir.');
}

async function rejectCase(interaction, caseCode) {
  return issueKYOK(interaction, caseCode, 'Yetersiz delil ve geçersiz gerekçe.');
}

async function hireLawyer(interaction, caseCode, targetLawyerId, isBlackmarket = false) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  courtCase.lawyerId = targetLawyerId;
  courtCase.isBlackmarketLawyer = isBlackmarket;
  await courtCase.save();

  const channel = interaction.guild.channels.cache.get(courtCase.channelId);
  if (channel) {
    await channel.permissionOverwrites.edit(targetLawyerId, { ViewChannel: true, SendMessages: true }).catch(() => {});
  }

  const title = isBlackmarket ? '🕵️ Karaborsa Avukat Savunmaya Katıldı!' : '💼 Resmi Avukat Duruşmaya Katıldı!';
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`<@${targetLawyerId}> sanık <@${courtCase.defendantId}> tarafını savunmak üzere davaya dahil oldu.`)
    .setColor(isBlackmarket ? 0x9b59b6 : 0x3498db);

  return interaction.reply({ embeds: [embed] });
}

async function startJuryVote(interaction, caseCode) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  courtCase.juryVote = { active: true, endsAt: new Date(Date.now() + 10 * 60 * 1000), guiltyVotes: [], innocentVotes: [] };
  await courtCase.save();

  const pollEmbed = new EmbedBuilder()
    .setTitle(`📊 JÜRİ OYLAMASI BAŞLADI — Dava ${caseCode}`)
    .setDescription(`Sanık <@${courtCase.defendantId}> hakkında jüri oylaması başladı!\n\n👍 **SUÇLU** | 👎 **SUÇSUZ**`)
    .setColor(0x9b59b6);

  const voteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`court_vote_guilty_${caseCode}`).setLabel('👍 Suçlu (Guilty)').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`court_vote_innocent_${caseCode}`).setLabel('👎 Suçsuz (Innocent)').setStyle(ButtonStyle.Success)
  );

  return interaction.reply({ embeds: [pollEmbed], components: [voteRow] });
}

async function voteJury(interaction, caseCode, isGuilty) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase || !courtCase.juryVote || !courtCase.juryVote.active) {
    return interaction.reply({ content: '❌ Aktif oylama bulunamadı.', ephemeral: true });
  }

  const userId = interaction.user.id;
  const guilty = courtCase.juryVote.guiltyVotes || [];
  const innocent = courtCase.juryVote.innocentVotes || [];

  if (guilty.includes(userId) || innocent.includes(userId)) {
    return interaction.reply({ content: '⚠️ Zaten oy kullandınız.', ephemeral: true });
  }

  if (isGuilty) guilty.push(userId); else innocent.push(userId);
  courtCase.juryVote.guiltyVotes = guilty;
  courtCase.juryVote.innocentVotes = innocent;
  await courtCase.save();

  return interaction.reply({ content: `✅ Oyunuz kaydedildi! (Suçlu: ${guilty.length} | Suçsuz: ${innocent.length})`, ephemeral: true });
}

async function offerBribe(interaction, caseCode, amount) {
  const courtCase = await CourtCase.findOne({ caseCode });
  if (!courtCase) return interaction.reply({ content: '❌ Dava bulunamadı.', ephemeral: true });

  if (interaction.user.id !== courtCase.defendantId) {
    return interaction.reply({ content: '❌ Rüşvet teklifini sadece sanık yapabilir!', ephemeral: true });
  }

  courtCase.briberyState = { offered: true, amount: Number(amount) || 500, targetId: courtCase.moderatorId, exposed: false };
  await courtCase.save();

  const bribeEmbed = new EmbedBuilder()
    .setTitle('💸 GİZLİ RÜŞVET TEKLİFİ!')
    .setDescription(`Sanık <@${interaction.user.id}> davanın düşürülmesi karşılığında **${amount} Coin** rüşvet teklif etti!`)
    .setColor(0xe74c3c);

  const bribeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`court_bribe_accept_${caseCode}`).setLabel('💵 Rüşveti Kabul Et').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`court_bribe_expose_${caseCode}`).setLabel('🚨 İFŞA ET (Yolsuzluk Davası)').setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({ embeds: [bribeEmbed], components: [bribeRow], ephemeral: true });
}

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
    .setDescription(`Sanık <@${courtCase.defendantId}> mahkeme heyetine **${courtCase.briberyState.amount} Coin** rüşvet teklif ederken İFŞALANDI! Ceza katlanacaktır!`)
    .setColor(0xed4245);

  return interaction.reply({ embeds: [exposeEmbed] });
}

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

  // Save to Defendant Sabıka Kaydı if convicted
  if (verdictType !== 'acquitted') {
    let defUser = await User.findOne({ discordId: courtCase.defendantId });
    if (!defUser) defUser = await User.create({ discordId: courtCase.defendantId });
    if (!defUser.criminalRecord) defUser.criminalRecord = [];
    defUser.criminalRecord.push({
      caseCode,
      lawArticle: courtCase.lawArticle,
      verdict: verdictType,
      date: new Date()
    });
    defUser.isOrnekVatandas = false;
    await defUser.save();
  }

  let verdictTitle = '⚖️ MAHKEME KARARI AÇIKLANDI';
  let verdictDesc = `**Sanık:** <@${courtCase.defendantId}>\n**Gerekçe:** ${verdictNote || 'Mahkeme kararı'}\n\n`;
  let embedColor = 0x2ecc71;

  if (verdictType === 'acquitted') {
    verdictTitle = '🕊️ BERAAT VE TAZMİNAT KARARI';
    verdictDesc += `Sanık <@${courtCase.defendantId}> suçsuz bulunarak BERAAT etmiştir!\n`;
    let plaintiffEco = await Economy.findOne({ userId: courtCase.plaintiffId });
    let defendantEco = await Economy.findOne({ userId: courtCase.defendantId });
    if (plaintiffEco && defendantEco && (plaintiffEco.wallet || 0) >= 100) {
      plaintiffEco.wallet = Math.max(0, plaintiffEco.wallet - 200);
      defendantEco.wallet = (defendantEco.wallet || 0) + 200;
      await plaintiffEco.save();
      await defendantEco.save();
      verdictDesc += `💰 Haksız dava sebebiyle davacıdan sanığa **200 Coin Tazminat** aktarılmıştır.`;
    }
  } else if (verdictType === 'community_service') {
    verdictTitle = '🧹 KAMU HİZMETİ CEZASI';
    const targetMsgCount = 50;
    courtCase.communityService = { active: true, targetCount: targetMsgCount, currentCount: 0, roleId: roles['Sokak Süpürgesi'] };
    await courtCase.save();
    if (defendantMember && roles['Sokak Süpürgesi']) await defendantMember.roles.add(roles['Sokak Süpürgesi']).catch(() => {});
    verdictDesc += `Sanık <@${courtCase.defendantId}> suçlu bulunmuş ve **50 Mesajlık Kamu Hizmeti** cezasına çarptırılmıştır!`;
    embedColor = 0xe67e22;
  } else if (verdictType === 'mouth_tape') {
    verdictTitle = '🤐 AĞIZ BANDI CEZASI';
    if (defendantMember && roles['Ağız Bandı']) await defendantMember.roles.add(roles['Ağız Bandı']).catch(() => {});
    verdictDesc += `Sanık <@${courtCase.defendantId}> **Ağız Bandı** takılarak sessize alınmıştır.`;
    embedColor = 0xe74c3c;
  } else if (verdictType === 'jail') {
    verdictTitle = '🔒 NÖBETÇİ HAPİSHANE (#kodos) CEZASI';
    courtCase.jailTask = { active: true, targetCount: 100, currentCount: 0, bailAmount: 500, roleId: roles['Mahkum'] };
    await courtCase.save();
    if (defendantMember && roles['Mahkum']) await defendantMember.roles.add(roles['Mahkum']).catch(() => {});
    verdictDesc += `Sanık <@${courtCase.defendantId}> **#kodos Hapishanesine** gönderilmiştir! Kefalet: **500 Coin**.`;
    embedColor = 0x7f8c8d;
  }

  const verdictEmbed = new EmbedBuilder()
    .setTitle(verdictTitle)
    .setDescription(verdictDesc)
    .setColor(embedColor)
    .setTimestamp();

  // Add Appeal Buttons (İstinaf & AYM)
  const appealRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`court_appeal_istinaf_${caseCode}`).setLabel('⚖️ İstinaf (İtiraz) Et').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`court_appeal_aym_${caseCode}`).setLabel('🏛️ Anayasa Mahkemesi (AYM)').setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({ embeds: [verdictEmbed], components: [appealRow] });
}

async function handleCourtMessageCount(message) {
  if (!message || message.author.bot || !message.guild) return;
  const userId = message.author.id;
  const activeCases = await CourtCase.find({ status: 'closed', $or: [{ 'communityService.active': true }, { 'jailTask.active': true }] });

  for (const cCase of activeCases) {
    if (cCase.defendantId === userId && cCase.communityService && cCase.communityService.active) {
      cCase.communityService.currentCount = (cCase.communityService.currentCount || 0) + 1;
      if (cCase.communityService.currentCount >= cCase.communityService.targetCount) {
        cCase.communityService.active = false;
        await cCase.save();
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member && cCase.communityService.roleId) await member.roles.remove(cCase.communityService.roleId).catch(() => {});
        await message.channel.send(`🎉 Tebrikler <@${userId}>! **Kamu Hizmeti** görevinizi tamamladınız!`).catch(() => {});
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
  issueKYOK,
  issueIndictment,
  applyPrecautionaryMeasure,
  sendToSettlement,
  applyAppeal,
  getSabikaKaydi,
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
