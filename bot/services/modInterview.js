'use strict';

/**
 * Moderatör Başvuru Mülakatı Servisi
 * Yönetici → /modbasvuru @kullanıcı
 * → Kullanıcıya DM'de evet/hayır sorusu
 * → Kabul ederse AI 5 zor soru sorar
 * → Başarılıysa Moderatör Ekibi rolü + staff sisteme kayıt
 */

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { chatWithAI }   = require('./aiService');
const StaffProgress    = require('../../models/StaffProgress');

const MOD_ROLE_ID   = process.env.MOD_ROLE_ID   || '1518692389169135666'; // Moderatör Ekibi (veya başka bir ID)
const MOD_GUILD_ID  = process.env.MOD_GUILD_ID  || '1367646464804655104'; // EkoYıldız

// Aktif mülakatlar: userId → { adminId, guildId, history[], score, questionCount }
const activeInterviews = new Map();

// ── Sorular için AI sistem promptu ────────────────────────────────────────
const INTERVIEW_SYSTEM = `Sen Eko Yıldız Discord sunucusu için üst düzey moderatör mülakatı yapan bir yapay zekasın.
Adaya hem moderatörlük hem de genel Discord yönetimi hakkında 5 adet çok zor, analitik soru sorsun.
Sorular:
- Kural ihlali senaryoları (spam, taciz, küfür, NSFW)
- Çatışma yönetimi (iki kullanıcı tartışıyor, nasıl müdahale edersin?)
- Yetki sınırları (hangi durumda ban, hangi durumda warn?)
- Ekip iletişimi ve şeffaflık
- Sunucu büyümesi ve topluluk yönetimi

Her sorudan sonra cevabı değerlendir ve şu formatta yanıt ver:
[PUAN: X/10] kısa yorum
Sonra sonraki soruyu sor.

Tüm 5 soru sorulduktan sonra:
[SONUÇ: KABUL] veya [SONUÇ: RET] yaz ve genel değerlendirme yap.

Türkçe konuş. Her soru ayrıca max 200 karakter olsun.`;

// ── Başvuru başlat ─────────────────────────────────────────────────────────
async function startModInterview(targetUser, adminId, guildId, client) {
  // Kullanıcıya DM'de teklif gönder
  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle('🛡️ Moderatör Başvurusu')
    .setDescription(
      `Merhaba **${targetUser.username}**! 👋\n\n` +
      `**Eko Yıldız** sunucusunda **Üst Düzey Moderatör** olmak için sana bir teklif var!\n\n` +
      `Bu süreç şunları içeriyor:\n` +
      `• **5 zor mülakat sorusu** (AI tarafından sorulur)\n` +
      `• Moderatörlük + genel Discord yönetimi\n` +
      `• Başarılı olursan **Moderatör Ekibi** rolü verilir\n\n` +
      `Mülakata katılmak ister misin?`
    )
    .setFooter({ text: 'Eko Yıldız • Moderatör Seçimi' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mod_interview_yes_${targetUser.id}`)
      .setLabel('✅ Evet, Katılıyorum')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mod_interview_no_${targetUser.id}`)
      .setLabel('❌ Hayır, Teşekkürler')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    await targetUser.send({ embeds: [embed], components: [row] });
    activeInterviews.set(targetUser.id, {
      adminId,
      guildId,
      history: [],
      score: 0,
      questionCount: 0,
      client,
    });
    return true;
  } catch (err) {
    console.error('[modInterview] DM gönderilemedi:', err.message);
    return false;
  }
}

// ── Evet/Hayır buton handler ───────────────────────────────────────────────
async function handleInterviewButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('mod_interview_yes_') && !cid.startsWith('mod_interview_no_')) return false;

  const userId = interaction.user.id;

  if (cid.startsWith('mod_interview_no_')) {
    activeInterviews.delete(userId);
    await interaction.update({
      content: '👍 Tamam, anladım! İstediğin zaman tekrar başvurabilirsin.',
      embeds: [], components: [],
    }).catch(() => {});

    // Admini bilgilendir
    const info = activeInterviews.get(userId);
    if (info) {
      try {
        const admin = await client.users.fetch(info.adminId);
        await admin.send(`❌ **${interaction.user.tag}** moderatör başvurusunu reddetti.`);
      } catch (_) {}
    }
    return true;
  }

  // Evet — mülakatı başlat
  const info = activeInterviews.get(userId);
  if (!info) {
    await interaction.update({ content: '❌ Başvuru bulunamadı.', embeds: [], components: [] }).catch(() => {});
    return true;
  }

  await interaction.update({
    content: '✅ Harika! Mülakat başlıyor. DM üzerinden sorular gelecek.',
    embeds: [], components: [],
  }).catch(() => {});

  // İlk soruyu sor
  try {
    await askNextQuestion(userId, null, client);
  } catch (err) {
    console.error('[modInterview] İlk soru hatası:', err.message);
    await interaction.user.send('❌ Mülakat başlatılamadı. Lütfen daha sonra tekrar dene.').catch(() => {});
    activeInterviews.delete(userId);
  }

  return true;
}

// ── Sonraki soruyu sor ─────────────────────────────────────────────────────
async function askNextQuestion(userId, previousAnswer, client) {
  const info = activeInterviews.get(userId);
  if (!info) return;

  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;

  if (previousAnswer) {
    info.history.push({ role: 'user', content: previousAnswer });
  }

  try {
    const dmCh = await user.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    const systemMsg = info.questionCount === 0
      ? 'Mülakatı başlat. İlk soruyu sor.'
      : info.questionCount >= 5
        ? 'Tüm sorular tamamlandı. Sonucu ver: [SONUÇ: KABUL] veya [SONUÇ: RET]'
        : `${info.questionCount}. soruyu değerlendir ve ${info.questionCount + 1}. soruyu sor.`;

    info.history.push({ role: 'user', content: systemMsg });
    const reply = await chatWithAI(info.history, INTERVIEW_SYSTEM);
    info.history.push({ role: 'assistant', content: reply });
    info.questionCount++;

    // Puan hesapla
    const scoreMatch = reply.match(/\[PUAN:\s*(\d+)\/10\]/i);
    if (scoreMatch) {
      info.score += parseInt(scoreMatch[1]);
    }

    // Sonuç var mı?
    if (/\[SONUÇ:\s*KABUL\]/i.test(reply)) {
      await finalizeInterview(userId, true, reply, client);
      return;
    }
    if (/\[SONUÇ:\s*RET\]/i.test(reply)) {
      await finalizeInterview(userId, false, reply, client);
      return;
    }

    // Soru gönder
    const cleanReply = reply
      .replace(/\[PUAN:[^\]]+\]/gi, '')
      .replace(/\[SONUÇ:[^\]]+\]/gi, '')
      .trim();

    await user.send({
      embeds: [new EmbedBuilder()
        .setColor(0x7c6af7)
        .setAuthor({ name: `🛡️ Mülakat — Soru ${Math.min(info.questionCount, 5)}/5` })
        .setDescription(cleanReply)
        .setFooter({ text: 'Cevabını yaz, AI değerlendirecek.' })],
    });
  } catch (err) {
    console.error('[modInterview] Soru hatası:', err.message);
    await user.send('⚠️ AI geçici olarak yanıt veremiyor. Birazdan tekrar deneniyor...');
  }
}

// ── DM'den cevap gelince ───────────────────────────────────────────────────
async function handleInterviewReply(message, client) {
  const userId = message.author.id;
  if (!activeInterviews.has(userId)) return false;
  if (activeInterviews.get(userId).questionCount === 0) return false; // Henüz başlamadı

  await askNextQuestion(userId, message.content, client);
  return true;
}

// ── Mülakat sonuçlandır ────────────────────────────────────────────────────
async function finalizeInterview(userId, accepted, summary, client) {
  const info = activeInterviews.get(userId);
  if (!info) return;
  activeInterviews.delete(userId);

  const user = await client.users.fetch(userId).catch(() => null);
  const avgScore = info.questionCount > 0 ? Math.round(info.score / Math.min(info.questionCount, 5)) : 0;

  const cleanSummary = summary
    .replace(/\[SONUÇ:[^\]]+\]/gi, '')
    .replace(/\[PUAN:[^\]]+\]/gi, '')
    .trim()
    .slice(0, 500);

  if (accepted) {
    // Rol ver
    try {
      const guild  = await client.guilds.fetch(info.guildId).catch(() => null);
      const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
      if (member) {
        await member.roles.add(MOD_ROLE_ID, 'Moderatör mülakatını geçti').catch(() => {});
      }
    } catch (err) {
      console.warn('[modInterview] Rol verilemedi:', err.message);
    }

    // Staff sistemine kayıt et — Stajyer Personel olarak başlat
    try {
      let p = await StaffProgress.findOne({ userId });
      if (!p) {
        p = new StaffProgress({ userId, guildId: info.guildId, level: 1 });
      } else if (p.level < 1) {
        p.level = 1;
      }
      await p.save();
      console.log(`[modInterview] ${userId} → staff sisteme kaydedildi`);
    } catch (err) {
      console.warn('[modInterview] Staff kayıt hatası:', err.message);
    }

    // Kullanıcıya tebrik
    if (user) {
      await user.send({
        embeds: [new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('🎉 TEBRİKLER! Moderatör Oldunuz!')
          .setDescription(
            `Mülakatı başarıyla geçtin!\n\n` +
            `**Ortalama Puan:** ${avgScore}/10\n\n` +
            `**Değerlendirme:**\n${cleanSummary}\n\n` +
            `Artık **Moderatör Ekibi** rolün var. Kuralları oku ve ekiple tanış! 🛡️`
          )
          .setFooter({ text: 'Eko Yıldız • Moderatör Ekibi' })
          .setTimestamp()],
      }).catch(() => {});
    }

    // Admini bilgilendir
    try {
      const admin = await client.users.fetch(info.adminId);
      await admin.send({
        embeds: [new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('✅ Mülakat Sonucu: KABUL')
          .setDescription(
            `**Aday:** <@${userId}>\n` +
            `**Ortalama Puan:** ${avgScore}/10\n\n` +
            `${cleanSummary}`
          )
          .setTimestamp()],
      });
    } catch (_) {}
  } else {
    // Reddedildi
    if (user) {
      await user.send({
        embeds: [new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ Mülakat Sonucu: Red')
          .setDescription(
            `Maalesef bu sefer moderatör kriterlerini karşılayamadın.\n\n` +
            `**Ortalama Puan:** ${avgScore}/10\n\n` +
            `**Değerlendirme:**\n${cleanSummary}\n\n` +
            `Kendini geliştirerek tekrar başvurabilirsin! 💪`
          )
          .setFooter({ text: 'Eko Yıldız' })
          .setTimestamp()],
      }).catch(() => {});
    }

    // Admini bilgilendir
    try {
      const admin = await client.users.fetch(info.adminId);
      await admin.send({
        embeds: [new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ Mülakat Sonucu: RET')
          .setDescription(
            `**Aday:** <@${userId}>\n` +
            `**Ortalama Puan:** ${avgScore}/10\n\n` +
            `${cleanSummary}`
          )
          .setTimestamp()],
      });
    } catch (_) {}
  }
}

module.exports = {
  startModInterview,
  handleInterviewButton,
  handleInterviewReply,
};
