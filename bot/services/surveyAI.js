'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { chatWithAI } = require('./aiService');
const SurveyPending = require('../../models/SurveyPending');

// ── Runtime Map'ler (aktif anket soruları — restart'ta sıfırlanır ama önemli değil) ──
// userId → { topic, requesterId, guildId, questions[], answers[], client }
const activeSurveys = new Map();

// ── Soru üretme prompts ─────────────────────────────────────────────────────
const SURVEY_PROMPT = (topic, questionNum, prevQA) => {
  if (questionNum === 1) {
    return `Sen bir anket asistanısın. "${topic}" konusunda kullanıcıya TEK bir soru soracaksın.
KURAL: Sadece soruyu yaz. Numara, "S1:", açıklama, selamlama YAZMA. Sadece soru cümlesi. Max 120 karakter.
Şimdi 1. soruyu sor:`;
  }
  const history = prevQA.map((x, i) => `Soru ${i + 1}: ${x.q}\nCevap ${i + 1}: ${x.a}`).join('\n');
  return `Sen bir anket asistanısın. "${topic}" konusunda anket yapıyorsun.
Önceki sorular ve cevaplar:
${history}

KURAL: Sadece ${questionNum}. soruyu yaz. Numara, "S${questionNum}:", "C${questionNum}:", açıklama YAZMA. Sadece soru cümlesi. Max 120 karakter. Önceki soruları TEKRAR ETME.
Şimdi ${questionNum}. soruyu sor:`;
};

function cleanAIQuestion(raw) {
  return raw
    .replace(/^[Ss]\d+[:.]\s*/g, '')
    .replace(/[Cc]\d+[:.].*/gs, '')
    .replace(/ANKET_TAMAM/gi, '')
    .trim();
}

// ── /anketai komutu ─────────────────────────────────────────────────────────
async function startSurvey(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  const target      = interaction.options.getUser('kullanici');
  const topic       = interaction.options.getString('konu');
  const requesterId = interaction.user.id;
  const guildId     = interaction.guild?.id;

  if (target.bot) {
    return interaction.editReply({ content: '❌ Botlara anket gönderilemez.' });
  }

  await interaction.editReply({ content: `✅ **${target.username}** kullanıcısına anket gönderildi.` });

  try {
    // MongoDB'ye kaydet (restart-safe)
    await SurveyPending.findOneAndUpdate(
      { targetUserId: target.id },
      { targetUserId: target.id, requesterId, guildId, topic },
      { upsert: true, new: true }
    );

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

    // customId: survey_yes_TARGETID veya survey_no_TARGETID (max ~35 char, güvenli)
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
  } catch (err) {
    console.error('[surveyAI] DM gönderilemedi:', err.message);
    try {
      const requester = await interaction.client.users.fetch(requesterId);
      await requester.send(`❌ **${target.username}** kullanıcısına DM gönderilemedi. DM'leri kapalı olabilir.`);
    } catch (_) {}
  }
}

// ── Evet/Hayır buton handler ────────────────────────────────────────────────
async function handleSurveyButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('survey_yes_') && !cid.startsWith('survey_no_')) return false;

  // customId'den sadece targetUserId oku
  const targetId = cid.startsWith('survey_yes_')
    ? cid.replace('survey_yes_', '')
    : cid.replace('survey_no_', '');

  // Sadece anketin hedef kullanıcısı basabilir
  if (interaction.user.id !== targetId) {
    await interaction.reply({ content: '❌ Bu anket size ait değil.', ephemeral: true }).catch(() => {});
    return true;
  }

  // MongoDB'den anket bilgisini al
  let pending;
  try {
    pending = await SurveyPending.findOne({ targetUserId: targetId });
  } catch (err) {
    console.error('[surveyAI] MongoDB okuma hatası:', err.message);
  }

  if (!pending) {
    await interaction.update({
      content: '❌ Bu anket süresi dolmuş veya zaten yanıtlandı.',
      embeds: [], components: [],
    }).catch(() => {});
    return true;
  }

  if (cid.startsWith('survey_no_')) {
    // Kaydı sil
    await SurveyPending.deleteOne({ targetUserId: targetId }).catch(() => {});

    await interaction.update({
      content: '👍 Tamam, anketi reddettiniz. Teşekkürler!',
      embeds: [], components: [],
    }).catch(() => {});

    try {
      const requester = await client.users.fetch(pending.requesterId);
      await requester.send(`❌ **${interaction.user.tag}** anketi reddetti.`);
    } catch (_) {}
    return true;
  }

  // Evet — anketi başlat, kaydı sil
  await SurveyPending.deleteOne({ targetUserId: targetId }).catch(() => {});

  await interaction.update({
    content: '✅ Harika! Birkaç soru soracağım.',
    embeds: [], components: [],
  }).catch(() => {});

  const userId = interaction.user.id;
  activeSurveys.set(userId, {
    topic:       pending.topic,
    requesterId: pending.requesterId,
    guildId:     pending.guildId,
    questions:   [],
    answers:     [],
    client,
  });

  // İlk soruyu sor
  try {
    const dmCh = await interaction.user.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    const raw = await chatWithAI(
      [{ role: 'user', content: `Konu: ${pending.topic}` }],
      SURVEY_PROMPT(pending.topic, 1, [])
    );

    const q = cleanAIQuestion(raw) || raw.trim();
    activeSurveys.get(userId).questions.push(q);
    await interaction.user.send(q).catch(() => {});
  } catch (err) {
    console.error('[surveyAI] İlk soru hatası:', err.message);
    const fallback = `${pending.topic} hakkında ne düşünüyorsunuz?`;
    activeSurveys.get(userId)?.questions.push(fallback);
    await interaction.user.send(fallback).catch(() => {});
  }

  return true;
}

// ── DM'den anket cevabı ─────────────────────────────────────────────────────
async function handleSurveyReply(message, client) {
  const userId = message.author.id;
  if (!activeSurveys.has(userId)) return false;

  const survey = activeSurveys.get(userId);
  const TOTAL  = 4;

  const currentQ = survey.questions[survey.answers.length];
  if (!currentQ) return false;

  survey.answers.push(message.content);
  const answeredCount = survey.answers.length;

  if (answeredCount >= TOTAL) {
    await finalizeSurvey(message.author, survey, client);
    activeSurveys.delete(userId);
    return true;
  }

  try {
    const dmCh = await message.author.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    const nextQNum = answeredCount + 1;
    const prevQA   = survey.questions.slice(0, answeredCount).map((q, i) => ({
      q, a: survey.answers[i] || '',
    }));

    const raw    = await chatWithAI(
      [{ role: 'user', content: `Konu: ${survey.topic}` }],
      SURVEY_PROMPT(survey.topic, nextQNum, prevQA)
    );
    const cleanQ = cleanAIQuestion(raw);

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

// ── Anket tamamlandı ────────────────────────────────────────────────────────
// Tamamlama sayısını MongoDB User modelinden okuyacağız
async function finalizeSurvey(user, survey, client) {
  // Tamamlama sayısını User'dan oku/güncelle
  let completedCount = 1;
  try {
    const mongoose = require('mongoose');
    const UserModel = mongoose.models.User
      || mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const dbUser = await UserModel.findOneAndUpdate(
      { discordId: user.id },
      { $inc: { surveyCompletedCount: 1 } },
      { new: true, upsert: false }
    );
    completedCount = dbUser?.surveyCompletedCount || 1;
  } catch (_) {
    // DB yoksa default 1 kullan
  }

  const isFirstSurvey = completedCount === 1;
  const rewardText = isFirstSurvey
    ? `Hediyeniz olarak sunucuda **tüm kanallara resim gönderebilme** yetkisi verildi! 🖼️`
    : `Hediyeniz olarak sunucuda **tüm kanallarda tepki verebilme** yetkisi verildi! 🎉`;

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
              await ch.permissionOverwrites.edit(user.id, { [PermissionFlagsBits.AttachFiles]: true });
            } else {
              await ch.permissionOverwrites.edit(user.id, { [PermissionFlagsBits.AddReactions]: true });
            }
            successCount++;
          } catch (_) {}
        }
        console.log(`[surveyAI] ${user.tag} → ${isFirstSurvey ? 'AttachFiles' : 'AddReactions'} ${successCount} kanala verildi`);
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
