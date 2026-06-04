'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { chatWithAI } = require('./aiService');

// Aktif anketler: userId → { topic, questions[], answers[], requesterId, guild }
const activeSurveys = new Map();
// Onay bekleyenler: userId → { topic, requesterId, guildId }
const pendingSurveys = new Map();

// Anket sorusu üretme prompt
const SURVEY_PROMPT = (topic) => `Sen bir anket yapay zeka asistanısın.
"${topic}" konusunda katılımcıya 4 kısa ve net soru sor.
Her soruyu tek tek, sırayla sor — hepsini bir arada yazma.
İlk soruyu şimdi sor. Kısa tut, max 150 karakter.`;

const FOLLOW_UP_PROMPT = (topic, qa) => `Sen bir anket AI asistanısın. "${topic}" konusunda anket yapıyorsun.
Şimdiye kadar sorulan soru ve cevaplar:
${qa.map((x, i) => `S${i+1}: ${x.q}\nC${i+1}: ${x.a}`).join('\n')}
Toplam 4 soru soruyorsun. ${qa.length < 4 ? `Şimdi ${qa.length + 1}. soruyu sor. Kısa, max 150 karakter.` : 'Tüm sorular tamam, "ANKET_TAMAM" yaz.'}`;

/**
 * /anketai komutu çalıştığında — kullanıcıya DM gönder
 * Not: generalCommandHandler zaten deferReply() çağırdığından editReply() kullanıyoruz
 */
async function startSurvey(interaction) {
  const target    = interaction.options.getUser('kullanici');
  const topic     = interaction.options.getString('konu');
  const requesterId = interaction.user.id;
  const guildId   = interaction.guild?.id;

  if (target.bot) {
    return interaction.editReply({ content: '❌ Botlara anket gönderilemez.' });
  }

  await interaction.editReply({ content: `✅ **${target.username}** kullanıcısına anket gönderildi.` });

  // Kullanıcıya DM
  try {
    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle('📊 Eko Yıldız YouTube Sunucusu Anketi')
      .setDescription(
        `Merhaba **${target.username}**! 👋\n\n` +
        `**Eko Yıldız YouTube sunucusundan** bir anket var.\n` +
        `**Konu:** ${topic}\n\n` +
        `Katılmak ister misiniz?`
      )
      .setFooter({ text: 'Eko Yıldız • Anket Sistemi' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`survey_yes_${target.id}`)
        .setLabel('✅ Evet, Katılıyorum')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`survey_no_${target.id}`)
        .setLabel('❌ Hayır')
        .setStyle(ButtonStyle.Secondary)
    );

    await target.send({ embeds: [embed], components: [row] });

    pendingSurveys.set(target.id, { topic, requesterId, guildId });
  } catch (err) {
    console.error('[surveyAI] DM gönderilemedi:', err.message);
    // Komut sahibine bildir
    try {
      const requester = await interaction.client.users.fetch(requesterId);
      await requester.send(`❌ **${target.username}** kullanıcısına DM gönderilemedi. DM'leri kapalı olabilir.`);
    } catch (_) {}
  }
}

/**
 * Evet/Hayır buton handler
 */
async function handleSurveyButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('survey_yes_') && !cid.startsWith('survey_no_')) return false;

  const userId = interaction.user.id;

  if (cid.startsWith('survey_no_')) {
    const info = pendingSurveys.get(userId);
    pendingSurveys.delete(userId);

    await interaction.update({
      content: '👍 Tamam, anketi reddettiniz. Teşekkürler!',
      embeds: [], components: [],
    }).catch(() => {});

    // Komut sahibine bildir
    if (info) {
      try {
        const requester = await client.users.fetch(info.requesterId);
        await requester.send(`❌ **${interaction.user.tag}** anketi reddetti.`);
      } catch (_) {}
    }
    return true;
  }

  // Evet — anketi başlat
  const info = pendingSurveys.get(userId);
  pendingSurveys.delete(userId);
  if (!info) {
    await interaction.update({ content: '❌ Anket bulunamadı.', embeds: [], components: [] }).catch(() => {});
    return true;
  }

  await interaction.update({
    content: '✅ Harika! Birkaç soru soracağım.',
    embeds: [], components: [],
  }).catch(() => {});

  activeSurveys.set(userId, {
    topic: info.topic,
    requesterId: info.requesterId,
    guildId: info.guildId,
    questions: [],
    answers: [],
    client,
  });

  // İlk soruyu sor
  try {
    const dmCh = await interaction.user.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    const firstQ = await chatWithAI(
      [{ role: 'user', content: `Konu: ${info.topic}` }],
      SURVEY_PROMPT(info.topic)
    );

    activeSurveys.get(userId).questions.push(firstQ.replace(/ANKET_TAMAM/gi, '').trim());
    await interaction.user.send(firstQ.replace(/ANKET_TAMAM/gi, '').trim()).catch(() => {});
  } catch (err) {
    console.error('[surveyAI] İlk soru hatası:', err.message);
    await interaction.user.send('❓ Konu hakkında ne düşündüğünüzü kısaca anlatır mısınız?').catch(() => {});
  }

  return true;
}

/**
 * Kullanıcı DM'den anket cevabı yazınca
 */
async function handleSurveyReply(message, client) {
  const userId = message.author.id;
  if (!activeSurveys.has(userId)) return false;

  const survey = activeSurveys.get(userId);
  const qa = survey.questions.map((q, i) => ({ q, a: survey.answers[i] || '' }));

  // Son cevabı kaydet
  const lastQ = survey.questions[survey.answers.length];
  if (lastQ) {
    survey.answers.push(message.content);
  }

  const answeredCount = survey.answers.length;
  const TOTAL = 4;

  if (answeredCount >= TOTAL) {
    // Anket tamamlandı
    await finalizeSurvey(message.author, survey, client);
    activeSurveys.delete(userId);
    return true;
  }

  // Sonraki soruyu sor
  try {
    const dmCh = await message.author.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    const updatedQA = survey.questions.map((q, i) => ({ q, a: survey.answers[i] || '' }));
    const nextQ = await chatWithAI(
      [{ role: 'user', content: `Konu: ${survey.topic}` }],
      FOLLOW_UP_PROMPT(survey.topic, updatedQA)
    );

    const cleanQ = nextQ.replace(/ANKET_TAMAM/gi, '').trim();

    if (!cleanQ || nextQ.includes('ANKET_TAMAM')) {
      await finalizeSurvey(message.author, survey, client);
      activeSurveys.delete(userId);
      return true;
    }

    survey.questions.push(cleanQ);
    await message.author.send(cleanQ).catch(() => {});
  } catch (err) {
    console.error('[surveyAI] Sonraki soru hatası:', err.message);
    await finalizeSurvey(message.author, survey, client);
    activeSurveys.delete(userId);
  }

  return true;
}

/**
 * Anket tamamlandı — sonuçları gönder ve ödül ver
 */
async function finalizeSurvey(user, survey, client) {
  // Kullanıcıya teşekkür
  const thankEmbed = new EmbedBuilder()
    .setColor(0x4ade80)
    .setTitle('🎉 Anket Tamamlandı!')
    .setDescription(
      `**${user.username}**, anketimize katıldığınız için teşekkürler! 🙏\n\n` +
      `Hediyeniz olarak sunucuda **tüm kanallara resim gönderebilme** yetkisi verildi.\n` +
      `Bir sonraki ankette ise **tüm kanallarda tepki verebilme** yetkisi kazanacaksınız! ⭐`
    )
    .setFooter({ text: 'Eko Yıldız • Anket Sistemi' });

  await user.send({ embeds: [thankEmbed] }).catch(() => {});

  // Sunucuda resim gönderme yetkisi ver
  try {
    const guild = await client.guilds.fetch(survey.guildId).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member) {
        // Tüm kanallarda AttachFiles izni ver
        const channels = guild.channels.cache.filter(c => c.isTextBased?.());
        for (const [, ch] of channels) {
          await ch.permissionOverwrites.edit(user.id, {
            AttachFiles: true,
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('[surveyAI] Yetki verilemedi:', err.message);
  }

  // Komut sahibine sonuçları gönder
  try {
    const requester = await client.users.fetch(survey.requesterId);
    const resultEmbed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle(`📊 Anket Sonuçları — ${user.tag}`)
      .setDescription(`**Konu:** ${survey.topic}`)
      .addFields(
        survey.questions.slice(0, 4).map((q, i) => ({
          name: `Soru ${i + 1}: ${q.slice(0, 100)}`,
          value: survey.answers[i] || '—',
          inline: false,
        }))
      )
      .setFooter({ text: `Katılımcı: ${user.tag}` })
      .setTimestamp();

    await requester.send({ embeds: [resultEmbed] });
  } catch (err) {
    console.warn('[surveyAI] Komut sahibine sonuç gönderilemedi:', err.message);
  }
}

module.exports = {
  startSurvey,
  handleSurveyButton,
  handleSurveyReply,
};
