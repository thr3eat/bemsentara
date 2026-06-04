'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { chatWithAI } = require('./aiService');

// Kaç anket tamamladı: userId → count
const surveyCompletedCount = new Map();
// Aktif anketler: userId → { topic, questions[], answers[], requesterId, guildId }
const activeSurveys = new Map();

// ── CustomId encode/decode (bot restart'a karşı) ───────────────────────────
// Format: survey_yes_<userId>_<requesterId>_<guildId>_<topicB64>
// topic base64'e çevrilir, max 80 char kalacak şekilde kısaltılır
function encodeSurveyId(action, targetId, requesterId, guildId, topic) {
  const topicB64 = Buffer.from(topic.slice(0, 40)).toString('base64').replace(/=/g, '');
  return `survey_${action}_${targetId}_${requesterId}_${guildId}_${topicB64}`;
}

function decodeSurveyId(customId) {
  // survey_yes_TARGETID_REQUESTERID_GUILDID_TOPICB64
  const parts = customId.split('_');
  // parts[0]=survey, parts[1]=action, parts[2]=targetId, parts[3]=requesterId, parts[4]=guildId, parts[5..]=topicB64
  if (parts.length < 6) return null;
  const action      = parts[1];
  const targetId    = parts[2];
  const requesterId = parts[3];
  const guildId     = parts[4];
  const topicB64    = parts.slice(5).join('_');
  let topic = '(konu)';
  try { topic = Buffer.from(topicB64, 'base64').toString('utf8'); } catch (_) {}
  return { action, targetId, requesterId, guildId, topic };
}

// Anket sorusu üretme prompt - AI sadece soruyu yazar, başka bir şey yazmaz
const SURVEY_PROMPT = (topic, questionNum, prevQA) => {
  if (questionNum === 1) {
    return `Sen bir anket asistanısın. "${topic}" konusunda kullanıcıya TEK bir soru soracaksın.
KURAL: Sadece soruyu yaz. "S1:", numara, açıklama, selamlama YAZMA. Sadece soru cümlesi. Max 120 karakter.
Şimdi 1. soruyu sor:`;
  }
  const history = prevQA.map((x, i) => `Soru ${i+1}: ${x.q}\nCevap ${i+1}: ${x.a}`).join('\n');
  return `Sen bir anket asistanısın. "${topic}" konusunda anket yapıyorsun.
Önceki sorular ve cevaplar:
${history}

KURAL: Sadece ${questionNum}. soruyu yaz. "S${questionNum}:", numara, "C${questionNum}:", açıklama YAZMA. Sadece soru cümlesi. Max 120 karakter. Önceki soruları TEKRAR ETME.
Şimdi ${questionNum}. soruyu sor:`;
};

/**
 * /anketai komutu çalıştığında — kullanıcıya DM gönder
 * Kendi deferReply'ını kendisi çağırır (generalCommandHandler bypass edilir)
 */
async function startSurvey(interaction) {
  // Önce defer et — interaction cevap bekleniyor
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

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
        .setCustomId(encodeSurveyId('yes', target.id, requesterId, guildId, topic))
        .setLabel('✅ Evet, Katılıyorum')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(encodeSurveyId('no', target.id, requesterId, guildId, topic))
        .setLabel('❌ Hayır')
        .setStyle(ButtonStyle.Secondary)
    );

    await target.send({ embeds: [embed], components: [row] });
    // pendingSurveys artık gerekmiyor — bilgi customId'de kodlandı
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

  // Bilgiyi customId'den decode et — map'e gerek yok (restart-safe)
  const info = decodeSurveyId(cid);
  if (!info) {
    await interaction.update({ content: '❌ Geçersiz anket butonu.', embeds: [], components: [] }).catch(() => {});
    return true;
  }

  // Sadece anketin hedef kullanıcısı basabilir
  if (interaction.user.id !== info.targetId) {
    await interaction.reply({ content: '❌ Bu anket size ait değil.', ephemeral: true }).catch(() => {});
    return true;
  }

  const userId = interaction.user.id;

  if (info.action === 'no') {
    await interaction.update({
      content: '👍 Tamam, anketi reddettiniz. Teşekkürler!',
      embeds: [], components: [],
    }).catch(() => {});

    // Komut sahibine bildir
    try {
      const requester = await client.users.fetch(info.requesterId);
      await requester.send(`❌ **${interaction.user.tag}** anketi reddetti.`);
    } catch (_) {}
    return true;
  }

  // Evet — anketi başlat
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
      SURVEY_PROMPT(info.topic, 1, [])
    );

    const cleanFirst = firstQ
      .replace(/^[Ss]\d+[:.]\s*/g, '')
      .replace(/[Cc]\d+[:.].*/gs, '')
      .trim();

    activeSurveys.get(userId).questions.push(cleanFirst || firstQ.trim());
    await interaction.user.send(cleanFirst || firstQ.trim()).catch(() => {});
  } catch (err) {
    console.error('[surveyAI] İlk soru hatası:', err.message);
    const fallback = `${info.topic} hakkında ne düşünüyorsunuz?`;
    activeSurveys.get(userId)?.questions.push(fallback);
    await interaction.user.send(fallback).catch(() => {});
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
  const TOTAL = 4;

  // Mevcut soruyu cevapla — questions[answers.length] = henüz cevaplanmamış soru
  const currentQIndex = survey.answers.length;
  const currentQ = survey.questions[currentQIndex];

  if (!currentQ) return false; // Soru yoksa işleme

  // Cevabı kaydet
  survey.answers.push(message.content);
  const answeredCount = survey.answers.length;

  // 4 soru tamamlandı mı?
  if (answeredCount >= TOTAL) {
    await finalizeSurvey(message.author, survey, client);
    activeSurveys.delete(userId);
    return true;
  }

  // Sonraki soruyu sor
  try {
    const dmCh = await message.author.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    const nextQNum = answeredCount + 1; // kaç tane cevaplanmışsa bir sonraki
    const prevQA = survey.questions.slice(0, answeredCount).map((q, i) => ({
      q,
      a: survey.answers[i] || '',
    }));

    const rawQ = await chatWithAI(
      [{ role: 'user', content: `Konu: ${survey.topic}` }],
      SURVEY_PROMPT(survey.topic, nextQNum, prevQA)
    );

    // AI'dan gelen gereksiz prefix/format temizle
    const cleanQ = rawQ
      .replace(/^[Ss]\d+[:.]\s*/g, '')   // "S2: " temizle
      .replace(/[Cc]\d+[:.].*/gs, '')     // "C2:" ve sonrasını temizle
      .replace(/ANKET_TAMAM/gi, '')
      .trim();

    if (!cleanQ) {
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
  // Tamamlama sayısını artır
  const prevCount = surveyCompletedCount.get(user.id) || 0;
  const newCount = prevCount + 1;
  surveyCompletedCount.set(user.id, newCount);

  // Hangi yetki verileceğini belirle
  const isFirstSurvey = newCount === 1;
  const rewardText = isFirstSurvey
    ? `Hediyeniz olarak sunucuda **tüm kanallara resim gönderebilme** yetkisi verildi! 🖼️`
    : `Hediyeniz olarak sunucuda **tüm kanallarda tepki verebilme** yetkisi verildi! 🎉`;

  // Kullanıcıya teşekkür
  const thankEmbed = new EmbedBuilder()
    .setColor(0x4ade80)
    .setTitle('🎉 Anket Tamamlandı!')
    .setDescription(
      `**${user.username}**, anketimize katıldığınız için teşekkürler! 🙏\n\n` +
      rewardText
    )
    .setFooter({ text: 'Eko Yıldız • Anket Sistemi' });

  await user.send({ embeds: [thankEmbed] }).catch(() => {});

  // Sunucuda yetki ver
  try {
    const guild = await client.guilds.fetch(survey.guildId).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member) {
        // Kanalları fetch et (cache boş olabilir)
        await guild.channels.fetch().catch(() => {});

        const channels = guild.channels.cache.filter(c =>
          c.isTextBased?.() &&
          c.permissionOverwrites != null &&
          typeof c.permissionOverwrites.edit === 'function'
        );

        let successCount = 0;
        for (const [, ch] of channels) {
          try {
            if (isFirstSurvey) {
              await ch.permissionOverwrites.edit(user.id, {
                [PermissionFlagsBits.AttachFiles]: true,
              });
            } else {
              await ch.permissionOverwrites.edit(user.id, {
                [PermissionFlagsBits.AddReactions]: true,
              });
            }
            successCount++;
          } catch (_) {}
        }

        console.log(`[surveyAI] ${user.tag} → ${isFirstSurvey ? 'AttachFiles' : 'AddReactions'} yetkisi ${successCount} kanala verildi`);
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
