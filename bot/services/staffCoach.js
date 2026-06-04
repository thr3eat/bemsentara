'use strict';

/**
 * Personel AI Koç Sistemi
 * /koc komutuyla personeller AI koçlarıyla DM üzerinden konuşabilir.
 * Koç, personelin seviyesini ve istatistiklerini bilir.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { chatWithAI }    = require('./aiService');
const StaffProgress     = require('../../models/StaffProgress');
const { ROLE_NAMES, LEVEL_TASKS, PROMOTION_REQUIREMENTS, getDailyRequirements } = require('./staffSystem');

// Aktif koç sohbetleri: userId → { history[], lastActivity }
const activeCoachSessions = new Map();

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 dakika inaktivite

// ── Koç sistem promptu ─────────────────────────────────────────────────────
function buildCoachSystem(progress) {
  const levelInfo  = LEVEL_TASKS[progress?.level || 1] || LEVEL_TASKS[1];
  const nextReq    = PROMOTION_REQUIREMENTS[progress?.level || 1];
  const req        = getDailyRequirements(progress?.level || 1, progress?.stats?.consecutiveDays || 0);
  const stats      = progress?.stats || {};

  return `Sen Eko Yıldız Discord sunucusunun personel AI koçusun. Adın "Koç".
Görüşülen personel hakkında bilgiler:
- Seviye: ${ROLE_NAMES[progress?.level || 1]}
- Arka arkaya aktif gün: ${stats.consecutiveDays || 0}
- Uyarı sayısı: ${progress?.warnings?.count || 0}/5
- Çözülen ticket: ${stats.ticketsSolved || 0}
- Anket: ${stats.surveysCompleted || 0}
- Moderasyon işlemi: ${stats.moderationActions || 0}
${nextReq ? `- Terfi için gerekli: ${nextReq.ticketsSolved} ticket, ${nextReq.surveysCompleted} anket, ${nextReq.activeDays} aktif gün` : '- En üst seviyeye ulaşmış'}

Günlük görev gereksinimleri: ${req.greets}x selam + ${req.voiceMinutes} dk ses

Görevin:
- Personeli güçlendir, motive et
- Sorularını cevapla (moderatörlük, kurallar, terfi stratejisi)
- Kişisel gelişim önerileri ver
- Zorluklarla başa çıkma yöntemleri göster
- Samimi, teşvik edici ve pratik ol

Kurallar:
- Türkçe konuş
- Kısa ama değerli cevaplar (max 300 karakter)
- İsim olarak "Koç" kullan
- Gerekirse soru sor, tek cevap verme`;
}

// ── /koc komutu çalıştığında ───────────────────────────────────────────────
async function startCoachSession(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  const userId = interaction.user.id;

  // Personel mi kontrol et
  const progress = await StaffProgress.findOne({ userId }).catch(() => null);
  if (!progress || progress.status === 'resigned' || progress.status === 'retired') {
    return interaction.editReply({
      content: '❌ Koç hizmeti sadece aktif personele açıktır. Personel sistemine kayıtlı değilsin.',
    });
  }

  // Mevcut oturum var mı?
  const existing = activeCoachSessions.get(userId);
  if (existing) {
    const inactiveSince = Date.now() - existing.lastActivity;
    if (inactiveSince < SESSION_TIMEOUT_MS) {
      return interaction.editReply({
        content: '💬 Zaten açık bir koç sohbeti var! DM\'ine gidin ve Koç\'a yazın.\n\nSohbeti sıfırlamak için `/koc sıfırla` komutunu kullanın.',
      });
    }
    activeCoachSessions.delete(userId);
  }

  // Yeni oturum başlat
  activeCoachSessions.set(userId, {
    history:      [],
    lastActivity: Date.now(),
    progress,
  });

  // Kullanıcıya DM gönder
  try {
    const levelInfo = LEVEL_TASKS[progress.level] || LEVEL_TASKS[1];
    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle('🤖 AI Koçun Hazır!')
      .setDescription(
        `Merhaba **${interaction.user.username}**! Ben senin kişisel AI koçunum. 🎯\n\n` +
        `**Seviyeni:** ${ROLE_NAMES[progress.level]}\n` +
        `**Aktif gün:** ${progress.stats?.consecutiveDays || 0} gün\n\n` +
        `Sana yardımcı olabileceğim konular:\n` +
        `• 📈 Terfi stratejisi\n` +
        `• 🛡️ Moderatörlük ipuçları\n` +
        `• 💪 Motivasyon ve hedef belirleme\n` +
        `• ❓ Kurallar ve görevler\n\n` +
        `Başlamak için bir şey yaz! 30 dakika inaktivite sonunda oturum kapanır.`
      )
      .setFooter({ text: 'Eko Yıldız • AI Koç Sistemi | /koc sıfırla ile yenile' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`coach_tip_${userId}`)
        .setLabel('💡 Günlük İpucu Al')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`coach_promo_${userId}`)
        .setLabel('📈 Terfi Planım')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`coach_end_${userId}`)
        .setLabel('👋 Sohbeti Bitir')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.user.send({ embeds: [embed], components: [row] });
    return interaction.editReply({ content: '✅ Koçun DM\'ine gönderildi! DM\'ini aç.' });
  } catch (err) {
    activeCoachSessions.delete(userId);
    return interaction.editReply({
      content: '❌ DM gönderilemedi. DM\'lerin açık olduğundan emin ol.',
    });
  }
}

// ── DM'den koç cevabı ─────────────────────────────────────────────────────
async function handleCoachReply(message, client) {
  const userId = message.author.id;
  const session = activeCoachSessions.get(userId);
  if (!session) return false;

  // Timeout kontrolü
  if (Date.now() - session.lastActivity > SESSION_TIMEOUT_MS) {
    activeCoachSessions.delete(userId);
    await message.author.send({
      embeds: [new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('⏰ Koç Oturumu Sona Erdi')
        .setDescription('30 dakika inaktivite nedeniyle oturum kapatıldı.\nYeni oturum için `/koc` komutunu kullan.')
        .setTimestamp()],
    }).catch(() => {});
    return false;
  }

  session.lastActivity = Date.now();
  session.history.push({ role: 'user', content: message.content });

  // Koç geçmişi max 20 mesajla sınırla
  if (session.history.length > 20) {
    session.history = session.history.slice(-20);
  }

  try {
    const dmCh = await message.author.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    const reply = await chatWithAI(session.history, buildCoachSystem(session.progress));
    session.history.push({ role: 'assistant', content: reply });

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setAuthor({ name: '🤖 Koç', iconURL: client.user?.displayAvatarURL() })
      .setDescription(reply)
      .setFooter({ text: 'AI Koç • /koc sıfırla ile oturumu yenile' });

    await message.author.send({ embeds: [embed] });
  } catch (err) {
    console.warn('[staffCoach] AI hatası:', err.message);
    await message.author.send('⚠️ Koç şu an yanıt veremiyor. Birazdan tekrar dene.').catch(() => {});
  }

  return true;
}

// ── Koç buton handler ─────────────────────────────────────────────────────
async function handleCoachButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('coach_')) return false;

  const userId = interaction.user.id;
  const session = activeCoachSessions.get(userId);

  if (cid.startsWith('coach_end_')) {
    activeCoachSessions.delete(userId);
    await interaction.update({
      content: '👋 Koç oturumu kapatıldı. Görüşmek üzere!',
      embeds: [], components: [],
    }).catch(() => {});
    return true;
  }

  if (!session) {
    await interaction.reply({ content: '❌ Aktif oturum yok. `/koc` ile yeni başlat.', ephemeral: true }).catch(() => {});
    return true;
  }

  session.lastActivity = Date.now();
  await interaction.update({ components: [] }).catch(() => {});

  let prompt = '';
  if (cid.startsWith('coach_tip_')) {
    prompt = 'Bana bugün için kişiselleştirilmiş bir pratik ipucu ver. Seviyeme ve istatistiklerime uygun olsun.';
  } else if (cid.startsWith('coach_promo_')) {
    prompt = 'Terfi etmek için bana özel bir plan yap. Eksiklerimi ve ne yapmalıyım anlat.';
  }

  if (!prompt) return true;

  session.history.push({ role: 'user', content: prompt });

  try {
    const dmCh = await interaction.user.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    const reply = await chatWithAI(session.history, buildCoachSystem(session.progress));
    session.history.push({ role: 'assistant', content: reply });

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setAuthor({ name: '🤖 Koç', iconURL: client.user?.displayAvatarURL() })
      .setDescription(reply)
      .setFooter({ text: 'AI Koç • Yazmaya devam et!' });

    await interaction.user.send({ embeds: [embed] });
  } catch (err) {
    await interaction.user.send('⚠️ Koç yanıt veremedi.').catch(() => {});
  }

  return true;
}

// ── Oturumu sıfırla ───────────────────────────────────────────────────────
async function resetCoachSession(userId) {
  activeCoachSessions.delete(userId);
}

module.exports = {
  startCoachSession,
  handleCoachReply,
  handleCoachButton,
  resetCoachSession,
};
