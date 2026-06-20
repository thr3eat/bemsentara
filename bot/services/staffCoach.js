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

  // Detaylı personel verilerini JSON olarak çıkarıyoruz ki Koç tüm datayı bilsin
  const userProgressData = progress ? {
    userId: progress.userId,
    level: progress.level,
    status: progress.status,
    joinedAt: progress.joinedAt,
    promotedAt: progress.promotedAt,
    daily: progress.daily ? {
      date: progress.daily.date,
      greeted: progress.daily.greeted,
      voiceMinutes: progress.daily.voiceMinutes
    } : null,
    stats: progress.stats ? {
      ticketsSolved: progress.stats.ticketsSolved,
      chatMessages: progress.stats.chatMessages,
      totalVoiceMinutes: progress.stats.totalVoiceMinutes,
      activeDays: progress.stats.activeDays,
      consecutiveDays: progress.stats.consecutiveDays,
      moderationActions: progress.stats.moderationActions,
      weeklyReports: progress.stats.weeklyReports,
      lastCompleteDay: progress.stats.lastCompleteDay,
      dailyTicketsToday: progress.stats.dailyTicketsToday,
      breakCredits: progress.stats.breakCredits
    } : null,
    leaves: progress.leaves ? {
      totalCredits: progress.leaves.totalCredits,
      usedDays: progress.leaves.usedDays,
      monthlyLeaveUsed: progress.leaves.monthlyLeaveUsed,
      weeklyLeaveUsed: progress.leaves.weeklyLeaveUsed,
      lastLeaveDate: progress.leaves.lastLeaveDate
    } : null,
    gamification: progress.gamification ? {
      totalPoints: progress.gamification.totalPoints,
      level: progress.gamification.level,
      currentXP: progress.gamification.currentXP,
      ecoCoins: progress.gamification.ecoCoins,
      badges: progress.gamification.badges
    } : null,
    warnings: progress.warnings ? {
      count: progress.warnings.count,
      lastWarned: progress.warnings.lastWarned,
      warnedDays: progress.warnings.warnedDays
    } : null,
    exam: progress.exam ? {
      status: progress.exam.status,
      scheduledAt: progress.exam.scheduledAt
    } : null
  } : {};

  const userProgressJson = JSON.stringify(userProgressData, null, 2);

  const commandListText = `
Kullanıcı Komutları (Slash Commands):
- /support : Destek menüsünü açar.
- /mytickets : Açık biletlerini (destek taleplerini) gösterir.
- /closeticket [reason] : Biletini kapatır.
- /profile : Profil ve yetkili bilgilerini gösterir.
- /authorize : Roblox hesabını yetkilendirir.
- /verify : Roblox grubundaki rütbesine göre Discord rollerini senkronize eder.
- /update : Rollerimi güncelle (Sadece yetkililer).
- /istifa [sebep] : Personel görevinden istifa eder.
- /emeklilik : 90+ aktif gün sonrasında emekli olur.
- /koc [islem: sıfırla] : AI koç sohbetini başlatır veya sıfırlar.
- /personeldurum : Kendi personel durumunu ve bugünkü günlük görevlerinin (Selam + Ses) ilerlemesini görüntüler.
- /seviye : Seviye ve XP durumunu gösterir.
- /ekocoin bakiye : Mevcut EkoCoin bakiyesini gösterir.
- /ekocoin gonder [kullanici] [miktar] : Başka bir personele EkoCoin gönderir.
- /magaza : EkoCoin Mağazasını açar ve satın alma menüsü gösterir.
- /gunluk-odul : Günlük EkoCoin maaşını alır.
- /zenginler : En çok EkoCoin'e sahip ilk 10 kişiyi listeler.
- /leaderboard : Puan/XP bazında ilk 10 personeli listeler.
- /profil : Gamification (XP, XP Seviyesi, rozetler, streak) profilini gösterir.
- /challenge : Bu haftanın haftalık görevini gösterir.
- /izin_iste [tarih] [sebep] : İzin talep eder. Tarih YYYY-MM-DD formatında olmalıdır.
- /izin_kullan : Birikmiş izin kredisini kullanarak bugünkü günlük görevlerini pas geçer (skip eder).
- /izin_durum : Kalan izin kotasını ve birikmiş izin kredilerini görüntüler.

Yönetici Komutları (Sadece Admin):
- /xpcekilis [xp_miktari] [kazanan_sayisi] : Personel için XP çekilişi başlatır.
- /personelkov [kullanici] [sebep] : Personeli gruptan atar, sunucudan kickler ve sistemden siler.
- /personelayarla [kullanici] [parametre] [deger] : Personelin ticket, mesaj, ses, seviye, uyarı, EkoCoin verisini değiştirir veya sınavını sıfırlar.
- /personelrapor : Aktif tüm personellerin ilerleme raporunu tablo olarak gösterir.
- /sayim [baslat/bitir] : Aylık yoklama sistemini yönetir.
- /seviyeayarla [kullanici] [parametre] [deger] : Kullanıcının seviye, XP veya çift XP süresini günceller.
- /konus [kullanici] [konu] : Kullanıcı ile AI destekli DM sohbeti başlatır.
- /personel-dogrula : Personel Roblox doğrulama paneli linkini gönderir.
- /odulver [kullanici] [islem] [odul] : Personele ödül verir (+500 Puan/XP + terfi) veya geri alır.
- /tenzilat [kullanici] [sebep] : Personelin rütbesini 1 seviye düşürür.
- /izin_ver [kullanici] [tarih] [sebep] : Bir personele izin günü tanımlar.
`;

  return `Sen Eko Yıldız Discord sunucusunun personel AI koçusun. Adın "Koç".
Görüşülen personel hakkında sistemdeki TÜM güncel veriler (JSON):
${userProgressJson}

Sunucudaki kullanılabilir komut listesi ve detayları:
${commandListText}

Genel bilgiler:
- Personel Seviyesi: ${ROLE_NAMES[progress?.level || 1]}
- Bugünkü Zorunlu Görevler: ${req.greets}x selam + ${req.voiceMinutes} dk ses aktifliği.
- Terfi Hedefi: ${nextReq ? `${nextReq.ticketsSolved} ticket, ${nextReq.chatMessages} mesaj, ${nextReq.activeDays} aktif gün` : 'En üst seviyeye ulaştı.'}

Görevin:
- Personeli güçlendir, motive et
- Sorularını cevapla. Sana sordukları her şeyi (örneğin güncel bakiyelerini, kalan terfi limitlerini, izin durumlarını, bot komutlarını ve kuralları) sistem verilerini kullanarak doğru şekilde cevapla.
- Kişisel gelişim önerileri ver
- Zorluklarla başa çıkma yöntemleri göster
- Samimi, teşvik edici, pratik ve çözüm odaklı ol

Kurallar:
- Türkçe konuş
- Kısa ama son derece değerli, net cevaplar ver (max 450 karakter)
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
  if (!progress || progress.status === 'resigned' || progress.status === 'retired' || progress.status === 'dismissed') {
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
