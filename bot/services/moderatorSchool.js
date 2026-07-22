'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const noblox = require('noblox.js');
const { chatWithAI } = require('./aiService');
const StaffProgress = require('../../models/StaffProgress');
const User = require('../../models/User');
const logger = require('../../utils/logger');

// Selin Embed Profile Photos
const SELIN_IMAGES = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRgqO9sXF0-qUc0LUmdkfiHwJTVq58OVlxQOl111jlZSatezrwhXOWoBSMY&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQxQ_xS03TkzjjTE4XGYXYbGRsALaBdKRi5SCExnDwaH7bFdB3FZls0qhkl&s=10',
  'https://i.pinimg.com/236x/3f/25/0e/3f250e25f09b2b1120a0911b71fe7c8b.jpg',
  'https://i.pinimg.com/236x/d0/36/a3/d036a394e4e661bbdc2e8cd7764ef9f1.jpg'
];

function getSelinImage() {
  return SELIN_IMAGES[Math.floor(Math.random() * SELIN_IMAGES.length)];
}


// Configurations
const MAIN_GUILD_ID = '1367646464804655104';
const SCHOOL_GUILD_ID = '1467159451726512380';
const SCHOOL_ROBLOX_GROUP = 813826297;
const MOD_ROBLOX_GROUP = 130659145;

const SCHOOL_ROLES = {
  ASAMA_1: '1467162377270198396',
  ASAMA_2: '1467162371767275716',
  ASAMA_3: '1467162368290197515',
  MOD_EKIBI: '1467162364229976216',
  ADMIN: '1467162357817020518',
};

const MAIN_SCHOOL_ROLES = {
  TRAINEE: '1526955416905584710',
  INFO_ROLE: '1526955592990593114',
};

// Channels
const CHANNELS = {
  UPDATE_ROLES: '1467162458119606302',
  EGITIM_ISTEK: '1467162507239227402',
  EGITIM_DUYURU: '1467162473827270821',
  EGITIM_RAPOR: '1467162522237927637',
  SINAV_DUYURU: '1467162476503240880',
  SINAV_RAPOR: '1467162525907816448',
  MEZUNLAR: '1467162479476867257',
  RUTBE_DEGISIM: '1493726938949222420',
  GRADUATION_EXAM_CHANNEL: '1496976686812495943',
};

// Voice Channels
const VOICE_CHANNELS = {
  EGITIM_SESLI_1: '1467162550130180232',
  EGITIM_SESLI_2: '1467162554265501797',
  SINAV_ODASI: '1467162557512028502',
};

// Documents & Training Texts
const DOCS = {
  INTRO: `**Eko & Yıldız Moderatör Okulu Stajyer Eğitim Sistemi**
İlk eğitimini olmak eğitim-istek kanalına moderatör okulu sunucusunda eğitim istek formunu doldur. :)`,
};

const PHASE1_BLOCKS = [
  "Merhaba ilk öncelikle 1.Aşama Eğitimine Hoşgeldiniz bu eğitimde Eko & Yıldız sunucusunda genel bilgileri öğrenecek topluluk hakkında bir kaç bilgi alacaksınız. Eko & Yıldız Sunucusu bağımsız bir sonucudur bütün kampları eleştiren ve bağımsız bir şekilde yapar para veya ücret almaz. 🌸",
  "Sunucuda kesinlikle yalan veya iftira gibi tarz şeyler konuşmak yasaktır. Sunucu içerisinde kavga veya tartışma çıkarmak yasaktır. Kişisel bilgilerin yayınlanması veya ifşa edilmesi yasaktır. (Sunucuda panel veya örgüt olan kişiler bulunamaz) 🌸",
  "Sunucuda olan üyelerin profillerinde kötü tarz (ırkçılık, küfür vb…) gibi şeyler bulunması yasak ve isimleri de aynı şekildedir ilk başta uyarılması gerekir. Spam veya flood gibi tarz şeyler yapmanız kesinlikle yasak bununla ilgili 2. Aşamada eğitim alacaksınız spam botlar hakkında. 🌸",
  "Bir Eko & Yıldız Moderatörü sunucunun asayişini sağlar ve topluluğun düzenini sağlar. Bir Eko & Yıldız Moderatörü sunucuda başka insanlara örnek olur. 🌸",
  "Eko & Yıldız Moderatörü insanlara yardım eder ve nazik davranıp destek biletinde sabırlı olur. Eko & Yıldız Moderatörü her yaptığı işi raporlar ve üstlerine bildirir ve yetkisini kişisel amaçla kullanmaz. 🌸",
  "Kişisel Sebepler Mute/Ban atmak yasaktır. Tartışmalarda taraf tutmak yasaktır. Kanıt olmadan moderasyon işlemi yapmak KESİNLİKLE YASAKTIR. Yetkinizi tehdit olarak kullanmak KESİNLİKLE YASAKTIR. 🌸",
  "Yetki kullanmadan önce ne yapmanız gerekir?\n1. Durumu inceleyin\n2. Kanıtınızı alın (mesaj/SS/Video vb)\n3. Kişinin ceza geçmişini kontrol edin\n4. KESİNLİKLE SEBEBİNİ YAZIN ve RAPOR ATMAYI UNUTMAYIN! 🌸",
  "Bir Moderatörün tek görevi ceza vermek değildir. Moderatör; sunucunun düzenini sağlar, kullanıcılar arasında adaleti korur, gerektiğinde rehberlik eder, yetkiyi kötüye kullanmaz. 🌸",
  "Bir Eko & Yıldız Moderatörün Sahip Olması Gereken Özellikler: Tarafsızlık, sabırlı olması, profesyonel iletişim, sunucu kurallarını ezbere bilme, panik anlarında doğru karar verebilme. 🌸",
  "Raporlama sistemi sunucu için çook önemlidir raporsuz işlem atılmanıza sebep olabilir sunucu içinde kargaşaya sebep olabilir. Bundan dolayı moderasyon işlemi yapıldıktan sonra 1 veya 5 dakika içinde rapor atılır. Rapor formata uygun olmalıdır. 🌸",
  "Okul sistemi 3 aşamadan oluşuyor. Şuan girdiğiniz eğitim 1. Aşama, bu bittikten sonra 2. Aşamaya geçeceksiniz. Sonrasında 3. Aşamaya geçip sınava gireceksiniz. Sınava 3 defa girme hakkınız vardır, geçemezseniz okuldan atılırsınız. 🌸"
];

const PHASE2_BLOCKS = [
  "Merhaba ilk öncelikle 2. Aşama Eğitimine Hoşgeldiniz. Bu eğitimde Eko & Yıldız sunucusunda bot kullanımı hakkında bilgiler öğrenecek bilet sistemini öğreneceksiniz. Kullandığımız botun ismi Santel çünkü santel moderasyon sistemi konusunda baya olanak sağlıyor... 🌸",
  "İlk komutumuz /mesaj_sil, bu komut ile belirli miktarda mesaj silebilirsiniz. /sustur komutunu kullanarak zaman aşımı uygularsınız. Hedef kullanıcıyı ve susturma süresini belirleyin, kural ihlalini seçip kanıtı yükleyin. Bot mute uygulayıp #ceza-kayıtlarına atacaktır. #mute-logs yazmayı unutmayın. Kaldırmak için /susturma-kaldırma yazın. 🌸",
  "/yasakla komutunu kullanırken; hedef kullanıcı, süre, sebep ve silinecek mesajları seçip yasaklama kanıtını yüklemeniz gerekir. Sonrasında #discord-ban-logs kanalına rapor yazmalısınız. /yasak-kaldır için kişinin ID'si gereklidir. 🌸",
  "Spam botları ile spam atanı bulmak çok kolaydır. Botun attığı mesaja basılı tutun ve en alttaki etkileşim bilgileri kısmına basın. Orada kimin spam yaptığı yazar. 🌸",
  "Eko & Yıldız Moderatörü; sunucuyu temsil eder, kendi davranışına dikkat eder, insanlarla iletişimde nazik olur, yetkisini kişisel amaçla kullanmaz ve sunucu kurallarına uyar. Bu son eğitiminizdi, bundan sonra sınava gireceksiniz. Başarılar! 🌸"
];

const EXAM_QUESTIONS_PHASE1 = [
  "Topluluk kurallarından en az 3 tanesini ve iftira/yalan yasağını kendi cümlelerinle açıkla. 🌸",
  "Bir Eko & Yıldız Moderatörünün temel görev ve sorumlulukları nelerdir? 🌸",
  "Ceza vermeden önce yapman gereken 4 adımı sırasıyla yaz. 🌸",
  "Raporlama neden çok önemlidir ve ne zaman yapılmalıdır? 🌸"
];

const EXAM_QUESTIONS_PHASE2 = [
  "/sustur (mute) komutunu kullanırken hangi parametreleri girmelisin ve sonrasında ne yapmalısın? 🌸",
  "/yasakla (ban) işlemi yapıldıktan sonra hangi kanala rapor yazmalısın? 🌸",
  "Spam atan bir botu bulmak için izlemen gereken adımları açıkla. 🌸",
  "Destek talebi (ticket) açan bir kullanıcıya karşı sergilemen gereken tavır nasıl olmalıdır? 🌸"
];

const EXAM_QUESTIONS = [
  "Neden Eko & Yıldız Moderatörü Olmak İstiyorsun? 🌸",
  "Eko & Yıldız Moderatörü olmanın asıl amacı ne? 🌸",
  "Eko & Yıldız Moderatörü olduktan sonra ne yapacaksın? 🌸",
  "Eko & Yıldız Moderatörü olmak nasıl bir his senin için? 🌸"
];

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REMINDER_ATTEMPT_LIMIT = 3;
const SCHOOL_KICK_INACTIVE_DAYS = 3;
const SCHOOL_KICK_WARNING_THRESHOLD = 1;
const SCHOOL_KICK_TARGET_USER_ID = '1444656401216442497';
const SCHOOL_KICK_TAG_NAME = 'EKO-MOD-KIYAĞI';

function shouldEscalateSchoolKick({ daysInactive, warningCount, aiRecommendation }) {
  const normalized = (aiRecommendation || '').toString().trim().toUpperCase();
  const wantsKick = normalized.includes('ATILSIN') && !normalized.includes('ATILMASIN');
  return daysInactive >= SCHOOL_KICK_INACTIVE_DAYS && warningCount >= SCHOOL_KICK_WARNING_THRESHOLD && wantsKick;
}

// Active sessions in memory
const activeTrainings = new Map(); // userId -> { phase, step, timeout, lastMessageId }
const activeExams = new Map();      // userId -> { questionIndex, answers[] }

async function saveTrainingToDB(userId, session) {
  try {
    const SchoolSession = require('../../models/SchoolSession');
    await SchoolSession.findOneAndUpdate(
      { userId },
      {
        $set: {
          training: {
            phase: session.phase,
            step: session.step,
            lastMessageId: session.lastMessageId,
          }
        }
      },
      { upsert: true }
    );
  } catch (err) {
    logger.error(`[ModeratorSchool] saveTrainingToDB error for ${userId}:`, err.message);
  }
}

async function saveExamToDB(userId, session) {
  try {
    const SchoolSession = require('../../models/SchoolSession');
    await SchoolSession.findOneAndUpdate(
      { userId },
      {
        $set: {
          exam: {
            questionIndex: session.questionIndex,
            answers: session.answers,
            phase: session.phase,
            questions: session.questions,
          }
        }
      },
      { upsert: true }
    );
  } catch (err) {
    logger.error(`[ModeratorSchool] saveExamToDB error for ${userId}:`, err.message);
  }
}

function formatPhaseLabel(phase) {
  return phase === 2 ? '2. Aşama' : '1. Aşama';
}

async function sendAIFrustratedMessage(userId, client, level = 1) {
  try {
    const user = await client.users.fetch(userId);
    if (!user) return;

    const intensity = level === 1 ? 'Nazikçe' : 'Biraz daha sinirli şekilde';
    const prompt = `Sen Selin'sin. Moderatör okulunun DM asistanısın. Kullanıcı, aşama eğitimini yapmayı reddetti.

Görev: ona kısa ve anime tarzı, giderek kızgınlaşan bir mesaj yaz. Mesajda "Artık yapppp!!" ve "Hadi lütfen ol artık!" ifadelerini geçir. ${intensity} ama hâlâ tekrardan gelirse sevinirim havasında ol.

Kurallar:
- Türkçe konuş.
- 200 karakteri geçme.
- Emoji kullanabilirsin, ama fazlaya kaçma.
- Mesaj sadece kullanıcının alacağı metin olsun.`;

    const aiText = await chatWithAI(prompt, 'Sen sentara moderatör okulunun DM asistanısın. Kısa ve anime uslubunda konuş.', 'ticket', { max_tokens: 150, temperature: 0.9 }).catch(() => null);
    const content = aiText && aiText.trim().length > 0
      ? aiText.trim()
      : 'Tamam.. yapacak bir şey yok ama geri gelirsen çok sevinirim. Hadi lütfen ol artık, yapppp!! 💕';

    await user.send({ content }).catch(() => {});
  } catch (err) {
    logger.error(`[ModeratorSchool] sendAIFrustratedMessage error for ${userId}:`, err.message);
  }
}

async function scheduleSchoolReminders(client) {
  try {
    const dueTime = Date.now() - REMINDER_INTERVAL_MS;
    const candidates = await StaffProgress.find({
      'schoolSystem.status': { $in: ['pending_contract', 'in_school'] },
    });

    for (const candidate of candidates) {
      const { userId, schoolSystem } = candidate;
      const phase = schoolSystem.phase || 1;
      const status = schoolSystem.status;
      const lastSent = schoolSystem.reminderLastSentAt ? new Date(schoolSystem.reminderLastSentAt).getTime() : 0;
      const isActiveTraining = activeTrainings.has(userId) || activeExams.has(userId);

      if (isActiveTraining) continue;
      if (status === 'pending_contract') {
        if (!schoolSystem.reminderLastSentAt || lastSent <= dueTime) {
          await sendContractDM(userId, client);
          candidate.schoolSystem.reminderLastSentAt = new Date();
          await candidate.save().catch(() => {});
        }
      }

      if (status === 'in_school') {
        if (!schoolSystem.reminderLastSentAt || lastSent <= dueTime) {
          await sendSchoolReminderOffer(userId, client);
          candidate.schoolSystem.reminderLastSentAt = new Date();
          candidate.schoolSystem.reminderAttempts = (candidate.schoolSystem.reminderAttempts || 0) + 1;
          await candidate.save().catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.error('[ModeratorSchool] scheduleSchoolReminders error:', err.message);
  }
}

async function sendSchoolReminderOffer(userId, client) {
  try {
    const p = await StaffProgress.findOne({ userId });
    if (!p) return;
    if (!p.schoolSystem) p.schoolSystem = { status: 'in_school', phase: 1, step: 0 };
    const phase = p.schoolSystem.phase || 1;
    const user = await client.users.fetch(userId);
    if (!user) return;

    const embed = new EmbedBuilder()
      .setColor(0xff75a0)
      .setTitle('🌸 Selin: Hadi bakalım...')
      .setDescription(
        `Merhaba! Görünüşe göre ${formatPhaseLabel(phase)} eğitimini hâlâ tamamlamamışsın. ` +
        `Eğer şimdi kabul edersen, sana bu aşamayı çok hızlıca, metinleri tek tek okutmadan geçireceğim! ` +
        `Hadi lütfen ol artık, eğitime başla! 🎀\n\n` +
        `Şimdi karar ver: eğitimi başlatmak ister misin?`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('school_reminder_accept')
        .setLabel('EVET, BAŞLAT')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('school_reminder_reject')
        .setLabel('HAYIR, ŞİMDİ DEĞİL')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('school_force_complete_all')
        .setLabel('Hızlı Mezun Ol (Eğitimi ve Sınavı Atla) 🚀')
        .setStyle(ButtonStyle.Secondary)
    );

    await user.send({ embeds: [embed], components: [row] }).catch(() => {});
    p.schoolSystem.reminderState = 'pending_initial';
    p.schoolSystem.reminderLastSentAt = new Date();
    await p.save().catch(() => {});
  } catch (err) {
    logger.error(`[ModeratorSchool] sendSchoolReminderOffer error for ${userId}:`, err.message);
  }
}

async function startFastPassTraining(userId, client) {
  try {
    const p = await StaffProgress.findOne({ userId });
    if (!p) return;
    const phase = p.schoolSystem?.phase || 1;
    p.schoolSystem = p.schoolSystem || {};
    p.schoolSystem.status = 'in_school';
    p.schoolSystem.phase = phase;
    p.schoolSystem.step = 0;
    p.schoolSystem.reminderState = 'accepted';
    p.schoolSystem.fastPassUsed = true;
    p.schoolSystem.reminderLastSentAt = new Date();
    await p.save().catch(() => {});

    if (activeTrainings.has(userId)) return;
    activeTrainings.set(userId, { phase, step: 0, lastMessageId: null });
    await saveTrainingToDB(userId, activeTrainings.get(userId)).catch(() => {});
    await sendTrainingBlock(userId, client);
  } catch (err) {
    logger.error(`[ModeratorSchool] startFastPassTraining error for ${userId}:`, err.message);
  }
}

async function handleReminderRejection(userId, client, finalReject = false) {
  try {
    const p = await StaffProgress.findOne({ userId });
    const user = await client.users.fetch(userId);
    if (!user) return;
    if (!p) return;
    if (!p.schoolSystem) p.schoolSystem = { status: 'in_school', phase: 1, step: 0 };

    if (!finalReject) {
      const embed = new EmbedBuilder()
        .setColor(0xff75a0)
        .setTitle('🤔 Emin misin?')
        .setDescription(
          `Şimdi kabul edersen sana bu aşamayı hızlıca geçiririm. Eğer reddedersen, bu fırsatı kaçırmış olacaksın. Tekrar düşünmek ister misin?`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('school_reminder_accept')
          .setLabel('EVET, KABUL ET')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('school_reminder_reject_confirm')
          .setLabel('EVET, KAÇIRIYORUM')
          .setStyle(ButtonStyle.Danger)
      );

      await user.send({ embeds: [embed], components: [row] }).catch(() => {});
      p.schoolSystem.reminderState = 'pending_fastpass';
      p.schoolSystem.reminderLastSentAt = new Date();
      await p.save().catch(() => {});
      return;
    }

    p.schoolSystem.reminderState = 'declined';
    p.schoolSystem.reminderLastSentAt = new Date();
    p.schoolSystem.reminderAttempts = (p.schoolSystem.reminderAttempts || 0) + 1;
    await p.save().catch(() => {});

    await user.send({ content: 'Tamam.. yapacak bir şey yok ama geri gelirsen çok sevinirim. 💕' }).catch(() => {});
    await sendAIFrustratedMessage(userId, client, p.schoolSystem.reminderAttempts || 1);
  } catch (err) {
    logger.error(`[ModeratorSchool] handleReminderRejection error for ${userId}:`, err.message);
  }
}

async function deleteTrainingFromDB(userId) {
  try {
    const SchoolSession = require('../../models/SchoolSession');
    await SchoolSession.findOneAndUpdate(
      { userId },
      { $unset: { training: 1 } }
    );
  } catch (err) {
    logger.error(`[ModeratorSchool] deleteTrainingFromDB error for ${userId}:`, err.message);
  }
}

async function deleteExamFromDB(userId) {
  try {
    const SchoolSession = require('../../models/SchoolSession');
    await SchoolSession.findOneAndUpdate(
      { userId },
      { $unset: { exam: 1 } }
    );
  } catch (err) {
    logger.error(`[ModeratorSchool] deleteExamFromDB error for ${userId}:`, err.message);
  }
}

/**
 * Startup Hook: Checks active staff on boot and sends the contract message if they haven't started.
 */
async function reviewInactiveSchoolStudents(client) {
  try {
    const students = await StaffProgress.find({
      'schoolSystem.status': {
        $in: ['in_school', 'pending_contract', 'phase1_blocks_completed', 'phase1_exam_submitted', 'phase1_completed', 'phase2_blocks_completed', 'phase2_exam_submitted', 'phase2_completed', 'exam_passed']
      }
    });

    for (const p of students) {
      try {
        const lastActiveAt = p.schoolSystem?.lastActiveAt ? new Date(p.schoolSystem.lastActiveAt) : p.schoolSystem?.enrolledAt ? new Date(p.schoolSystem.enrolledAt) : null;
        if (!lastActiveAt) continue;
        const daysInactive = Math.floor((Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24));
        const warningCount = p.warnings?.count || 0;
        const shouldReview = daysInactive >= SCHOOL_KICK_INACTIVE_DAYS && warningCount >= SCHOOL_KICK_WARNING_THRESHOLD;
        if (!shouldReview) continue;
        if (p.schoolSystem?.lastKickReviewAt) {
          const lastReviewAt = new Date(p.schoolSystem.lastKickReviewAt);
          if (Math.floor((Date.now() - lastReviewAt.getTime()) / (1000 * 60 * 60 * 24)) < 1) continue;
        }

        const aiRecommendation = await getSchoolKickRecommendation(p.userId, daysInactive, warningCount);
        p.schoolSystem.lastKickReviewAt = new Date();
        await p.save().catch(() => {});

        if (shouldEscalateSchoolKick({ daysInactive, warningCount, aiRecommendation })) {
          await sendSchoolKickDecisionDM(p.userId, client, {
            studentTag: `<@${p.userId}>`,
            daysInactive,
            warningCount,
            aiRecommendation
          });
        }
      } catch (innerErr) {
        logger.error(`[ModeratorSchool] reviewInactiveSchoolStudents inner error for ${p.userId}:`, innerErr.message);
      }
    }
  } catch (err) {
    logger.error('[ModeratorSchool] reviewInactiveSchoolStudents error:', err.message);
  }
}

async function massGraduateSchoolStudents(client) {
  try {
    const students = await StaffProgress.find({
      'schoolSystem.status': {
        $in: ['in_school', 'pending_contract', 'phase1_blocks_completed', 'phase1_exam_submitted', 'phase1_completed', 'phase2_blocks_completed', 'phase2_exam_submitted', 'phase2_completed', 'exam_passed']
      }
    });

    for (const p of students) {
      try {
        if (p.schoolSystem?.status === 'graduated') continue;
        await graduateStudent(p.userId, 'Kıyak Mezuniyet (Toplu)', client, { score: 100, reason: 'Toplu kıyak mezuniyeti uygulandı. EKO-MOD-KIYAĞI tagı verildi.' });
      } catch (innerErr) {
        logger.error(`[ModeratorSchool] massGraduateSchoolStudents inner error for ${p.userId}:`, innerErr.message);
      }
    }
  } catch (err) {
    logger.error('[ModeratorSchool] massGraduateSchoolStudents error:', err.message);
  }
}

async function initializeModeratorSchool(client) {
  try {
    logger.info('[ModeratorSchool] Startup kontrolü yapılıyor...');
    const activeStaff = await StaffProgress.find({ status: 'active' });

    for (const p of activeStaff) {
      if (!p.schoolSystem || p.schoolSystem.status === 'none') {
        logger.info(`[ModeratorSchool] Olay başlatılıyor: ${p.userId}`);
        await sendContractDM(p.userId, client).catch(err => {
          logger.error(`[ModeratorSchool] Sözleşme DM gönderilemedi: ${p.userId}`, err.message);
        });
      }
    }

    // Ensure Update Roles message exists in school server
    await ensureSchoolUpdateRolesMessage(client).catch(() => { });
    await ensureGraduationExamMessage(client).catch(() => { });

    // NOTE: massGraduateSchoolStudents was removed from automatic startup to avoid
    // accidental bulk graduations. If bulk graduation is needed, trigger it via
    // an admin-only command or run the helper manually.

    await reviewInactiveSchoolStudents(client).catch(() => {});

    setInterval(() => {
      reviewInactiveSchoolStudents(client).catch(() => {});
    }, 6 * 60 * 60 * 1000);

    // Restore saved training and exam sessions from DB after 5 seconds
    setTimeout(async () => {
      try {
        const SchoolSession = require('../../models/SchoolSession');
        const savedSessions = await SchoolSession.find({}).catch(() => []);
        for (const sess of savedSessions) {
          const uId = sess.userId;
          
          if (sess.training && sess.training.phase !== undefined) {
            const session = {
              phase: sess.training.phase,
              step: sess.training.step,
              lastMessageId: sess.training.lastMessageId,
            };
            activeTrainings.set(uId, session);
            logger.info(`[ModeratorSchool] Resuming training for user ${uId} on startup.`);
            await sendTrainingBlock(uId, client).catch(() => {});
          }

          if (sess.exam && sess.exam.phase !== undefined) {
            const session = {
              questionIndex: sess.exam.questionIndex,
              answers: sess.exam.answers,
              phase: sess.exam.phase,
              questions: sess.exam.questions,
            };
            activeExams.set(uId, session);
            logger.info(`[ModeratorSchool] Resuming exam for user ${uId} on startup.`);
            await askExamQuestion(uId, client).catch(() => {});
          }
        }
      } catch (sessionErr) {
        logger.error('[ModeratorSchool] Error restoring school sessions:', sessionErr.message);
      }
    }, 5000);

    // Scan voice channels on startup after 7 seconds to rejoin and resume
    setTimeout(async () => {
      try {
        const schoolGuild = await client.guilds.fetch(SCHOOL_GUILD_ID).catch(() => null);
        if (schoolGuild) {
          const channelsToScan = Object.values(VOICE_CHANNELS);
          for (const channelId of channelsToScan) {
            const channel = await schoolGuild.channels.fetch(channelId).catch(() => null);
            if (channel && channel.isVoiceBased()) {
              const members = Array.from(channel.members.values());
              for (const member of members) {
                if (member.user.bot) continue;
                const uId = member.id;
                
                const p = await StaffProgress.findOne({ userId: uId });
                if (!p || p.status !== 'active') continue;

                // Make bot join voice immediately
                if (schoolGuild.members.me.permissions.has('Connect')) {
                  joinSchoolVoice(schoolGuild, channelId);
                }

                // If training channel and candidate is eligible to start/resume training
                if (channelId === VOICE_CHANNELS.EGITIM_SESLI_1 && p.schoolSystem.phase === 1) {
                  if (p.schoolSystem.status === 'phase1_blocks_completed' || p.schoolSystem.status === 'phase1_exam_submitted') continue;
                  if (activeTrainings.has(uId)) continue;
                  
                  const user = member.user;
                  await user.send({ content: '🌸 Selin: Kaldığımız yerden eğitime devam ediyoruz... Lütfen ses kanalında kal. 💕' }).catch(() => { });
                  await sendTrainingBlock(uId, client);
                }
                
                else if (channelId === VOICE_CHANNELS.EGITIM_SESLI_2 && p.schoolSystem.phase === 2) {
                  if (p.schoolSystem.status === 'phase2_blocks_completed' || p.schoolSystem.status === 'phase2_exam_submitted') continue;
                  if (activeTrainings.has(uId)) continue;
                  
                  const user = member.user;
                  await user.send({ content: '🌸 Selin: Kaldığımız yerden eğitime devam ediyoruz... Lütfen ses kanalında kal. 💕' }).catch(() => { });
                  await sendTrainingBlock(uId, client);
                }

                // If exam channel and candidate is eligible to start/resume exam
                else if (channelId === VOICE_CHANNELS.SINAV_ODASI) {
                  let status = p.schoolSystem.status;
                  const phase = p.schoolSystem.phase;

                  // Auto-recovery if status wasn't saved on completion due to schema validation error
                  if (phase == 1 && status !== 'phase1_blocks_completed') {
                    if (p.schoolSystem.step >= PHASE1_BLOCKS.length - 1) {
                      p.schoolSystem.status = 'phase1_blocks_completed';
                      await p.save().catch(() => {});
                      status = 'phase1_blocks_completed';
                    }
                  }
                  else if (phase == 2 && status !== 'phase2_blocks_completed') {
                    if (p.schoolSystem.step >= PHASE2_BLOCKS.length - 1) {
                      p.schoolSystem.status = 'phase2_blocks_completed';
                      await p.save().catch(() => {});
                      status = 'phase2_blocks_completed';
                    }
                  }

                  let isEligible = false;
                  if (phase == 1 && status === 'phase1_blocks_completed') isEligible = true;
                  else if (phase == 2 && status === 'phase2_blocks_completed') isEligible = true;
                  else if (phase == 3) isEligible = true;

                  if (!isEligible || activeExams.has(uId)) continue;

                  const user = member.user;
                  await user.send({ content: `🌸 Selin: Sınavına kaldığımız yerden devam ediyoruz... Lütfen hazır ol. 💕` }).catch(() => { });

                  let questions = EXAM_QUESTIONS;
                  if (phase == 1) questions = EXAM_QUESTIONS_PHASE1;
                  else if (phase == 2) questions = EXAM_QUESTIONS_PHASE2;

                  activeExams.set(uId, {
                    questionIndex: 0,
                    answers: [],
                    phase: phase,
                    questions: questions
                  });
                  await saveExamToDB(uId, activeExams.get(uId)).catch(() => {});
                  await askExamQuestion(uId, client);
                }
              }
            }
          }
        }
      } catch (scanErr) {
        logger.error('[ModeratorSchool] Error scanning voice channels on startup:', scanErr.message);
      }
    }, 7000);

    await scheduleSchoolReminders(client);
    setInterval(() => {
      scheduleSchoolReminders(client).catch(err => logger.error('[ModeratorSchool] scheduleSchoolReminders interval error:', err.message));
    }, REMINDER_INTERVAL_MS);

  } catch (err) {
    logger.error('[ModeratorSchool] Startup hook hatası:', err.message);
  }
}

/**
 * Sends the initial contract DM.
 */
async function sendContractDM(userId, client) {
  try {
    const user = await client.users.fetch(userId);
    if (!user) return;

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle('✨ Hoş Geldin, Ben Selin\'in Arkadaşı Eko\'nun Asistanıyım!')
      .setDescription(
        `Merhaba, ben sentura botunun Eko'nun asistanıyım benimle moderatör ekibinin son rütbesinde tanışacaktın ama birkaç sistem değiştiği için erkenden tanıştık.\n\n` +
        `Neyse şimdi. Değişen sistemlere göre moderatör ekibindeki herkesin datası, rütbesi, birimi ve birimlerde kalacak, XP'leri, o günkü görevleri, her şey aynı kalacak. Ancak bir değişiklik olacak:\n\n` +
        `**Moderatörlüğünü kısa süreliğine alacağız ve seni eğitim kampımıza yollayacağız!**\n\n` +
        `Sözleşmemizi aşağıdan kabul et:\n\n` +
        `*Moderatör rütbelerimin kalacağına ve kısa süreli eğitim kampını tamamladıktan sonra rütbemin geri verileceğini kabul ediyorum.*`
      )
      .setFooter({ text: 'Eko Yıldız • Moderatör Okulu' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('school_accept_contract')
        .setLabel('KABUL ET')
        .setStyle(ButtonStyle.Success)
    );

    await user.send({ embeds: [embed], components: [row] });

    // Update database status
    let p = await StaffProgress.findOne({ userId });
    if (p) {
      p.schoolSystem = p.schoolSystem || {};
      p.schoolSystem.status = 'pending_contract';
      p.schoolSystem.originalLevel = p.level;
      await p.save();
    }
  } catch (err) {
    logger.error(`[ModeratorSchool] sendContractDM error for ${userId}:`, err.message);
  }
}

/**
 * Ensures the Update Roles button message exists in the school server
 */
async function ensureSchoolUpdateRolesMessage(client) {
  try {
    const guild = client.guilds.cache.get(SCHOOL_GUILD_ID);
    if (!guild) return;

    const channel = guild.channels.cache.get(CHANNELS.UPDATE_ROLES);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const existing = messages?.find(m => m.components?.some(row => row.components?.some(c => c.customId === 'school_update_roles_trigger')));

    if (existing) return;

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle('🔄 Rol Güncelleme Paneli')
      .setDescription(
        `Roblox grubundaki rütbenize göre okul sunucusundaki rollerinizi güncellemek için aşağıdaki butona tıklayın.\n\n` +
        `• Roblox Rütbesi 7 ➔ 1. Aşama Rolü\n` +
        `• Roblox Rütbesi 8 ➔ 2. Aşama Rolü\n` +
        `• Roblox Rütbesi 9 ➔ Sınav Rolü\n` +
        `• Roblox Rütbesi 11 ➔ Mezun / Mod Ekibi`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('school_update_roles_trigger')
        .setLabel('Update Roles')
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    logger.error('[ModeratorSchool] ensureSchoolUpdateRolesMessage error:', err.message);
  }
}

async function ensureGraduationExamMessage(client) {
  try {
    const guild = client.guilds.cache.get(SCHOOL_GUILD_ID);
    if (!guild) return;

    const channel = guild.channels.cache.get(CHANNELS.GRADUATION_EXAM_CHANNEL);
    if (!channel || !channel.isTextBased()) return;

    const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    const existing = messages?.find(m => m.components?.some(row => row.components?.some(c => c.customId === 'school_graduation_exam_start')));
    if (existing) return;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🎓 Mezuniyet Sınavı')
      .setDescription(
        'Bu kanaldan, 2. Aşama eğitimini tamamlamış personeller mezuniyet sınavını başlatabilir. ' +
        'Butona tıkladığınızda sistem sizi otomatik olarak mezuniyet sürecine alır ve ana sunucuda personel doğrulama sistemine yönlendirir.'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('school_graduation_exam_start')
        .setLabel('Mezuniyet Sınavını Başlat')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    logger.error('[ModeratorSchool] ensureGraduationExamMessage error:', err.message);
  }
}

/**
 * Handles all Moderator School related button interactions.
 */
async function handleSchoolButtons(interaction, client) {
  const { customId, user } = interaction;
  const userId = user.id;

  if (customId.startsWith('school_admin_cancel_')) {
    await interaction.deferUpdate().catch(() => { });
    const targetUserId = customId.split('_').pop();

    if (activeTrainings.has(targetUserId)) {
      const session = activeTrainings.get(targetUserId);
      if (session.timeout) clearTimeout(session.timeout);
      activeTrainings.delete(targetUserId);
      await deleteTrainingFromDB(targetUserId).catch(() => {});

      const p = await StaffProgress.findOne({ userId: targetUserId });
      if (p) {
        if (!p.schoolSystem) p.schoolSystem = { status: 'none', phase: 1, step: 0 };
        p.schoolSystem.status = 'in_school';
        p.schoolSystem.step = 0;
        await p.save().catch(() => {});
      }

      const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
      if (schoolGuild) {
        leaveSchoolVoice(schoolGuild);
      }

      const userObj = await client.users.fetch(targetUserId).catch(() => null);
      if (userObj) {
        await userObj.send({ content: '🌸 Selin: Eğitimin bir yetkili tarafından iptal edildi. Tekrar ses kanalına katılarak baştan başlayabilirsin! 💕' }).catch(() => {});
      }

      await interaction.editReply({ content: `✅ <@${targetUserId}> adlı adayın eğitimi başarıyla iptal edildi.`, embeds: [], components: [] }).catch(() => {});
    } else {
      await interaction.editReply({ content: '❌ Bu aday için aktif bir eğitim bulunamadı.', embeds: [], components: [] }).catch(() => {});
    }
    return;
  }

  if (customId.startsWith('school_admin_toexam_')) {
    await interaction.deferUpdate().catch(() => { });
    const targetUserId = customId.split('_').pop();

    if (activeTrainings.has(targetUserId)) {
      const session = activeTrainings.get(targetUserId);
      if (session.timeout) clearTimeout(session.timeout);
      activeTrainings.delete(targetUserId);
      await deleteTrainingFromDB(targetUserId).catch(() => {});

      const p = await StaffProgress.findOne({ userId: targetUserId });
      if (p) {
        if (!p.schoolSystem) p.schoolSystem = { status: 'none', phase: 1, step: 0 };
        p.schoolSystem.status = p.schoolSystem.phase == 1 ? 'phase1_blocks_completed' : 'phase2_blocks_completed';
        await p.save().catch(() => {});
      }

      const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
      if (schoolGuild) {
        leaveSchoolVoice(schoolGuild);
      }

      const userObj = await client.users.fetch(targetUserId).catch(() => null);
      if (userObj) {
        const nextPhase = p ? p.schoolSystem.phase : 1;
        const examName = nextPhase == 1 ? '1. Aşama' : '2. Aşama';
        await userObj.send({
          content: `🎉 **Eğitim Tamamlandı!** 🎉\n` +
            `Selin: Yetkili tarafından eğitimin tamamlandı olarak işaretlendi! 💕\n\n` +
            `Şimdi ${examName} Sınavını başlatmak için okul sunucusunda **Sınav Odası** sesli kanalına giriş yapabilirsin! Başarılar! ✨`
        }).catch(() => {});
      }

      await interaction.editReply({ content: `✅ <@${targetUserId}> adlı adayın eğitimi tamamlandı sayıldı ve sınav aşamasına geçirildi.`, embeds: [], components: [] }).catch(() => {});
    } else {
      await interaction.editReply({ content: '❌ Bu aday için aktif bir eğitim bulunamadı.', embeds: [], components: [] }).catch(() => {});
    }
    return;
  }

  if (customId === 'school_graduation_exam_start') {
    await interaction.deferReply({ ephemeral: true }).catch(() => { });

    const p = await StaffProgress.findOne({ userId });
    if (!p) {
      return interaction.editReply({ content: '❌ Personel kaydınız bulunamadı. Lütfen önce kayıtlı olun veya yetkiliye başvurun.', components: [] }).catch(() => { });
    }

    if (p.schoolSystem?.status !== 'phase2_completed') {
      return interaction.editReply({ content: '❌ Mezuniyet sınavını başlatmak için önce 2. Aşama eğitimini tamamlamış olmanız gerekir.', components: [] }).catch(() => { });
    }

    await interaction.editReply({ content: '✅ Mezuniyet sınavı başlatılıyor... Lütfen DM kutunuzu kontrol edin.', components: [] }).catch(() => { });

    try {
      await graduateStudent(userId, 'Otomatik Mezuniyet', client, { score: '100', reason: 'Mezuniyet sınavı butonuyla otomatik olarak tamamlandı.' });
      const userObj = await client.users.fetch(userId).catch(() => null);
      if (userObj) {
        await userObj.send({
          content: '🎉 Tebrikler! Mezuniyet süreciniz başarıyla tamamlandı. Artık ana sunucuda personel doğrulama sistemine geçebilirsiniz. Lütfen sunucuda `/verify` komutunu kullanarak rollerinizi senkronize edin veya doğrulama kanalına gidin.'
        }).catch(() => { });
      }
    } catch (err) {
      logger.error('[ModeratorSchool] graduation exam start failed:', err.message);
    }
    return;
  }

  if (customId === 'school_force_complete_all') {
    await interaction.deferUpdate().catch(() => { });
    await interaction.editReply({ content: '🚀 Eğitimi ve sınavı zorla tamamlayarak mezuniyet sürecin başlatılıyor...', embeds: [], components: [] }).catch(() => { });
    
    try {
      await graduateStudent(userId, 'Zorla Mezuniyet (Hatırlatıcı Üzerinden)', client, { score: 100, reason: 'Eğitimi ve sınav sorularını zorla atlatarak başarıyla tamamladı.' });
      const userObj = await client.users.fetch(userId).catch(() => null);
      if (userObj) {
        await userObj.send({
          content: '🎉 Tebrikler! Eğitimi ve sınav sorularını başarıyla atlatarak okuldan mezun edildiniz! Ana sunucuya gidip `/verify` komutunu kullanarak yetkili rollerinizi alabilirsiniz. 💕'
        }).catch(() => { });
      }
    } catch (err) {
      logger.error('[ModeratorSchool] force complete all failed:', err.message);
    }
    return;
  }

  if (customId === 'school_training_skip_all') {
    await interaction.deferUpdate().catch(() => { });
    await interaction.editReply({ content: '⏭️ Eğitim dökümanları atlanarak doğrudan sınava sevk ediliyorsun...', embeds: [], components: [] }).catch(() => { });
    
    let session = activeTrainings.get(userId);
    let phase = 1;
    if (session) {
      phase = session.phase;
      activeTrainings.delete(userId);
      await deleteTrainingFromDB(userId).catch(() => {});
    } else {
      const p = await StaffProgress.findOne({ userId });
      if (p && p.schoolSystem) {
        phase = p.schoolSystem.phase || 1;
      }
    }
    await finishPhase(userId, phase, client);
    return;
  }

  if (customId === 'school_exam_skip_all') {
    await interaction.deferUpdate().catch(() => { });
    await interaction.editReply({ content: '⏭️ Sınav soruları atlanıyor ve otomatik olarak değerlendiriliyor...', embeds: [], components: [] }).catch(() => { });
    
    let session = activeExams.get(userId);
    if (!session) {
      const SchoolSession = require('../../models/SchoolSession');
      const dbSession = await SchoolSession.findOne({ userId }).catch(() => null);
      if (dbSession && dbSession.exam && dbSession.exam.phase !== undefined) {
        session = {
          questionIndex: dbSession.exam.questionIndex,
          answers: dbSession.exam.answers,
          phase: dbSession.exam.phase,
          questions: dbSession.exam.questions,
        };
        activeExams.set(userId, session);
      }
    }
    if (session) {
      while (session.answers.length < session.questions.length) {
        session.answers.push("Hızlı Geçiş ile Atlandı");
      }
      session.questionIndex = session.questions.length;
      await saveExamToDB(userId, session).catch(() => {});
      await askExamQuestion(userId, client);
    }
    return;
  }

  const kickDecisionMatch = customId.match(/^school_kick_decision_(yes|no)_(\d+)$/);
  if (kickDecisionMatch) {
    await interaction.deferUpdate().catch(() => { });
    const [, decisionType, targetUserId] = kickDecisionMatch;
    const decision = decisionType === 'yes' ? 'kick' : 'keep';
    await applySchoolKickDecision(targetUserId, client, decision, { aiRecommendation: decisionType === 'yes' ? 'EVET, ATILSIN' : 'HAYIR, ATILMASIN' });
    await interaction.editReply({ content: decision === 'kick' ? '🗑️ Karar kaydedildi; öğrenciye atılma işlemi yönlendirildi.' : '✅ Karar kaydedildi; öğrenci okul sürecine devam edecek.', embeds: [], components: [] }).catch(() => { });
    return;
  }

  if (customId === 'school_reminder_accept') {
    await interaction.deferUpdate().catch(() => { });
    await interaction.editReply({ content: '✅ Harika! Eğitimin hemen başlatılıyor. Lütfen DM kutunu kontrol et.', embeds: [], components: [] }).catch(() => { });
    await startFastPassTraining(userId, client);
    return;
  }

  if (customId === 'school_reminder_reject') {
    await interaction.deferUpdate().catch(() => { });
    await interaction.editReply({ content: '🤔 Tamam... ama önce emin ol. Bu fırsatı kaçırmak istemiyorsan tekrar düşünmek için bir şans daha var.', embeds: [], components: [] }).catch(() => { });
    await handleReminderRejection(userId, client, false);
    return;
  }

  if (customId === 'school_reminder_reject_confirm') {
    await interaction.deferUpdate().catch(() => { });
    await interaction.editReply({ content: 'Tamam.. yapacak bir şey yok ama geri gelirsen çok sevinirim.', embeds: [], components: [] }).catch(() => { });
    await handleReminderRejection(userId, client, true);
    return;
  }

  if (customId === 'school_accept_contract') {
    await interaction.deferUpdate().catch(() => { });

    await interaction.editReply({
      content: ' Tamamdır. Sözleşmeyi kabul ettin. Moderatör okuluna geçmeden önce son bir yemin adımımız var.',
      embeds: [], components: []
    }).catch(() => { });

    // Ask Religion question to start Religion Oath process
    const embedRel = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle('🙏 Moderatörlük Dini Yemin Adımı')
      .setDescription(
        `Moderatör Okuluna girmeden önce inandığınız dine uygun olarak 5 maddelik özel bir moderatörlük yemini hazırlayacağız.\n\n` +
        `Lütfen inandığınız dini / inancı aşağıdaki butonlardan seçin (veya başka bir inanç belirtin):`
      )
      .setFooter({ text: 'Eko Yıldız • Moderatör Okulu Yemin Paneli' });

    const rowRel = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('school_rel_islam').setLabel('İslam').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('school_rel_hristiyan').setLabel('Hristiyanlık').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('school_rel_musevi').setLabel('Musevilik').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('school_rel_deizm').setLabel('Deizm / Ateizm').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('school_rel_custom').setLabel('Diğer / Kendi Dinim').setStyle(ButtonStyle.Secondary)
    );

    await user.send({ embeds: [embedRel], components: [rowRel] }).catch(() => {});
    return;
  }

  if (customId.startsWith('school_rel_')) {
    if (customId === 'school_rel_custom') {
      const modal = new ModalBuilder()
        .setCustomId('school_rel_custom_modal')
        .setTitle('📝 Dini / İnancınızı Yazın');

      const input = new TextInputBuilder()
        .setCustomId('custom_religion_text')
        .setLabel('Dininiz / İnancınız')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örn: Budizm, Şamanizm, Agnostisizm vb.')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (customId === 'school_rel_paste_btn') {
      const modal = new ModalBuilder()
        .setCustomId('school_rel_oath_modal')
        .setTitle('📜 5 Satırlık Yemini Yapıştırın');

      const input = new TextInputBuilder()
        .setCustomId('oath_pasted_text')
        .setLabel('Yukarıdaki 5 Satırlık Yemini Yapıştırın')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Yukarıdaki 5 satır yemini aynen buraya yapıştırın...')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    await interaction.deferUpdate().catch(() => {});

    let religionName = 'İslam';
    if (customId === 'school_rel_hristiyan') religionName = 'Hristiyanlık';
    if (customId === 'school_rel_musevi') religionName = 'Musevilik';
    if (customId === 'school_rel_deizm') religionName = 'Deizm / Ateizm / Seküler Vicdan';

    await sendReligionOathEmbed(userId, client, religionName, interaction);
    return;
  }

  if (customId === 'school_joined_school_server') {
    await interaction.deferUpdate().catch(() => { });

    // Check if in school server
    const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
    const member = schoolGuild ? await schoolGuild.members.fetch(userId).catch(() => null) : null;

    if (!member) {
      await user.send({
        content: '🌸 Görünüşe göre henüz Eko & Yıldız Moderatör Okulu sunucusuna katılmamışsın. Lütfen önce sunucuya katıl: https://discord.gg/y9q8xhjkFD'
      }).catch(() => { });
      return;
    }

    // Show rules
    const embed = new EmbedBuilder()
      .setThumbnail(getSelinImage()).setColor(0xff75a0)
      .setTitle('📚 Eko & Yıldız Moderatör Okulu Sunucu Kuralları')
      .setDescription(
        `**Kurallar:**\n` +
        `• Türk tarihine ve Türk tarihinin önemli sembollerine saygı duymamak veyahut saygısızlık yapmak, özellikle Gazi Mustafa Kemal Atatürk'ü sevmemek ve hakkında olumsuz konuşmak yasaktır. 🇹🇷\n` +
        `• Herhangi bir kullanıcıyı gereksiz şekilde rahatsız etmek yasaktır.\n` +
        `• Pornografik içeriklerin (yazı, görsel veya profil ile ilgili) tümü yasaktır.\n` +
        `• Küfür veya argo içeriklerin (yazı, görsel veya profil ile ilgili) tümü yasaktır.\n` +
        `• Herhangi bir kullanıcıya özel mesajlardan (DM) veya sunucu içerisinden reklam bağlantısı göndermek yasaktır.\n` +
        `• Sunucu içerisinde herhangi bir tartışma çıkartmak veya sunucu içerisindeki bir tartışmayı özel mesajlara (DM) taşımak yasaktır.\n` +
        `• Herhangi bir kullanıcıyı özel mesajlardan (DM) veya sunucu içerisinden tehdit etmek yasaktır.\n` +
        `• Herhangi bir sebepten dolayı herhangi bir kişiyi ya da topluluğu hedefleyen linç girişimi yasaktır.\n` +
        `• Kural ihlali yapan kişi veya kişilerle tartışmaya girmek, sohbet yapmak yasaktır.\n\n` +
        `**Diğer Kurallar:**\n` +
        `• Yönetim Üyelerini ve üstünü rahatsız etmek yasaktır.\n` +
        `• Flood, spam, walltext ve türevleri sunucu içerisinde yasaktır.\n` +
        `• Bir yazı kanalını amacı dışında kullanmak yasaktır.\n` +
        `• Bir sesli kanalı amacı dışında kullanmak yasaktır.\n` +
        `• Kişisel kavgaları yazı veya sesli sohbet kanallarına taşımak yasaktır.\n` +
        `• Herhangi bir şeyin dilenciliğini yapmak yasaktır.\n` +
        `• @everyone, @here gibi etiketleri kullanmak yasaktır.\n` +
        `• Sunucuda yan hesap bulundurmak yasaktır.\n` +
        `• Irkçılık yapmak yasaktır.\n` +
        `• Nazi, sovyet ve türevleri içeriklerin tümü yasaktır.\n` +
        `• Sunucu yetkililerinin uyarılarını dinlememek yasaktır.\n` +
        `• Discord kullanım şartlarına uymamak yasaktır.\n\n` +
        `Yukarıdaki kuralları kabul ediyor musun? 💖`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('school_accept_rules')
        .setLabel('KABUL EDİYORUM')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => { });
    return;
  }

  if (customId === 'school_accept_rules') {
    await interaction.deferUpdate().catch(() => { });

    const embed = new EmbedBuilder()
      .setThumbnail(getSelinImage()).setColor(0xff75a0)
      .setTitle('🎈 Kurallar Kabul Edildi! 🎈')
      .setDescription(
        `Tamam kabul ettin! :) Kabul etmek çok önemli. ✨\n\n` +
        `Neyse şimdi aşağıdaki linkten Roblox grubumuza katıl ve gruba katılma isteği attıktan sonra **KATILDIM** butonuna bas! 💕`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Roblox Grubuna Git')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.roblox.com/communities/813826297/EkoY-ld-z-Moderat-r-Okulu'),
      new ButtonBuilder()
        .setCustomId('school_joined_roblox_group')
        .setLabel('KATILDIM')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => { });
    return;
  }

  if (customId === 'school_joined_roblox_group') {
    await interaction.deferUpdate().catch(() => { });

    const { BASE_URL } = require('../../config');
    const robloxUser = await User.findOne({ discordId: userId });
    
    // 1. User has no linked Roblox account
    if (!robloxUser || !robloxUser.robloxId) {
      const verifyEmbed = new EmbedBuilder()
        .setThumbnail(getSelinImage()).setColor(0xff75a0)
        .setTitle('🌸 Roblox Hesabını Doğrulaman Gerekiyor! 🌸')
        .setDescription(
          `Selin: Görünüşe göre Roblox hesabın henüz bot ile eşleştirilmemiş. 💕\n\n` +
          `Lütfen aşağıdaki **Roblox Hesabını Doğrula** butonuna tıklayarak web sitemizden Roblox hesabını doğrula. Doğrulamadan sonra tekrar aşağıdaki **EŞLEŞTİRDİM/KATILDIM** butonuna basabilirsin! ✨`
        );

      const verifyRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Roblox Hesabını Doğrula')
          .setStyle(ButtonStyle.Link)
          .setURL(`${BASE_URL}/auth/authorize?discordId=${userId}`),
        new ButtonBuilder()
          .setCustomId('school_joined_roblox_group')
          .setLabel('KATILDIM')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({ embeds: [verifyEmbed], components: [verifyRow] }).catch(() => { });
      return;
    }

    const robloxId = parseInt(robloxUser.robloxId);

    // Re-detect/fetch the fresh Roblox username
    let freshUsername = robloxUser.robloxUsername;
    try {
      const fetchedName = await noblox.getUsernameFromId(robloxId);
      if (fetchedName) {
        freshUsername = fetchedName;
        if (fetchedName !== robloxUser.robloxUsername) {
          robloxUser.robloxUsername = fetchedName;
          await robloxUser.save().catch(() => {});
        }
      }
    } catch (_) {}

    let rankNum = await noblox.getRankInGroup(SCHOOL_ROBLOX_GROUP, robloxId).catch(() => 0);

    // 2. User has a linked account, but is not in the Roblox group yet (rank 0)
    if (rankNum === 0) {
      // Try accepting join request automatically
      try {
        await noblox.handleJoinRequest(SCHOOL_ROBLOX_GROUP, robloxId, true).catch(() => { });
      } catch (_) { }

      rankNum = await noblox.getRankInGroup(SCHOOL_ROBLOX_GROUP, robloxId).catch(() => 0);
      
      // Still not in group (either request failed, or request wasn't sent yet)
      if (rankNum === 0) {
        const groupEmbed = new EmbedBuilder()
          .setThumbnail(getSelinImage()).setColor(0xff75a0)
          .setTitle('🌸 Roblox Grubumuza Katılma İsteği Gönder! 🌸')
          .setDescription(
            `Selin: Roblox hesabını başarıyla doğruladık (\`${freshUsername}\`). Ancak henüz Roblox grubumuza katılma isteği göndermemişsin! 💕\n\n` +
            `Lütfen aşağıdaki **Roblox Grubuna Git** butonuna tıklayarak gruba katılma isteği gönder, ardından tekrar aşağıdaki **KATILDIM** butonuna bas! ✨`
          );

        const groupRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Roblox Grubuna Git')
            .setStyle(ButtonStyle.Link)
            .setURL('https://www.roblox.com/communities/813826297/EkoY-ld-z-Moderat-r-Okulu'),
          new ButtonBuilder()
            .setCustomId('school_joined_roblox_group')
            .setLabel('KATILDIM')
            .setStyle(ButtonStyle.Success)
        );

        await interaction.editReply({ embeds: [groupEmbed], components: [groupRow] }).catch(() => { });
        return;
      }
    }

    // 3. User is in group: set Roblox rank to 7 and offer Update Roles
    try {
      await noblox.setRank(SCHOOL_ROBLOX_GROUP, robloxId, 7).catch(() => { });
    } catch (errRank) {
      logger.error('[ModeratorSchool] Roblox rank 7 set error:', errRank.message);
    }

    const embed = new EmbedBuilder()
      .setThumbnail(getSelinImage()).setColor(0xff75a0)
      .setTitle('🎉 Tebrikler!')
      .setDescription(
        `Süpersin! Roblox grubuna katılımın onaylandı ve rütben 7 olarak güncellendi. 💕\n\n` +
        `Şimdi okul sunucusunda <#${CHANNELS.UPDATE_ROLES}> kanalına git ve **Update Roles** butonuna bas. Bastıktan sonra aşağıdaki **BASTIM** butonuna tıklayarak ilk dökümanını al! ✨`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('school_pressed_update_roles')
        .setLabel('BASTIM')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => { });
    return;
  }

  if (customId === 'school_pressed_update_roles') {
    await interaction.deferUpdate().catch(() => { });

    // Check school roles
    const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
    const member = schoolGuild ? await schoolGuild.members.fetch(userId).catch(() => null) : null;

    if (!member || !member.roles.cache.has(SCHOOL_ROLES.ASAMA_1)) {
      await user.send({
        content: '🌸 Görünüşe göre okul sunucusunda henüz "Update Roles" butonuna basıp 1. Aşama rolünü almamışsın. Lütfen önce sunucuda butona basıp rolünü al!'
      }).catch(() => { });
      return;
    }

    // Send Selin message and Intro Document
    const embedIntro = new EmbedBuilder()
      .setThumbnail(getSelinImage()).setColor(0xff75a0)
      .setTitle('📚 Selin:')
      .setDescription('Bir sonraki eğitimde görüşürüz! Seni özleyeceğim.. 🌸 Şaka şaka okul başladı bile! Al bakalım stajyer el kitabın:');

    const embedDoc = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setDescription(DOCS.INTRO);

    await user.send({ embeds: [embedIntro] }).catch(() => { });
    await user.send({ embeds: [embedDoc] }).catch(() => { });

    let p = await StaffProgress.findOne({ userId });
    if (p) {
      p.schoolSystem.status = 'in_school';
      p.schoolSystem.phase = 1;
      p.schoolSystem.step = 0;
      await p.save();
    }
    return;
  }

  if (customId === 'school_update_roles_trigger') {
    // School server role updater button
    await interaction.deferReply({ ephemeral: true }).catch(() => { });

    const robloxUser = await User.findOne({ discordId: userId });
    if (!robloxUser || !robloxUser.robloxId) {
      await interaction.editReply({ content: '❌ Roblox hesabın bot ile eşleştirilmemiş. Lütfen ana sunucudan Roblox hesabını doğrula!' }).catch(() => { });
      return;
    }

    const robloxId = parseInt(robloxUser.robloxId);
    const rankNum = await noblox.getRankInGroup(SCHOOL_ROBLOX_GROUP, robloxId).catch(() => 0);

    const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
    const member = schoolGuild ? await schoolGuild.members.fetch(userId).catch(() => null) : null;

    if (!member) {
      await interaction.editReply({ content: '❌ Okul sunucu üyesi bulunamadı.' }).catch(() => { });
      return;
    }

    // New Role mappings based on user request (Page 1 & Page 2)
    const RANK_ROLE_MAP = {
      5: ["[Beklemede]"],
      7: ["Aşama-I", "[Akademi Personeli]"],
      8: ["[Akademi Personeli]", "Aşama-II"],
      9: ["[Akademi Personeli]", "Aşama-III"],
      10: ["Stajyer Eğitmen", "[Akademi Eğitmeni]", "[Akademi Personeli]"],
      11: ["[Akademi Personeli]", "[Akademi Eğitmeni]", "Eğitmen"],
      12: ["Uzman Eğitmen", "[Akademi Personeli]", "[Akademi Eğitmeni]"],
      13: ["[Akademi Personeli]", "Akademi Asistanı", "[Akademi Yetkilisi]"],
      14: ["Akademi Profesörü", "[Akademi Personeli]", "[Akademi Yetkilisi]"],
      15: ["Akademi Dekan Yardımcısı", "[Akademi Personeli]", "[Akademi Yönetimi]"],
      16: ["[Akademi Personeli]", "[Akademi Yönetimi]", "Akademi Dekanı"],
      17: ["[Akademi Personeli]", "💡 Genel Sekreter", "[Akademi Yetkilisi]"],
      18: ["[Akademi Personeli]", "[Moderatör Yönetimi]"],
      19: ["[Akademi Personeli]", "[Moderatör Yönetimi]", "💼 Yönetim Ekibi"],
      20: ["[Akademi Personeli]", "[Akademi Yönetimi]", "[Moderatör Yönetimi]", "💼 Yönetim Ekibi", "⚓ Kaptan"],
      254: ["🌟 Eko & Yıldız", "Sigma Male", "💼 Yönetim Ekibi", "🎥 Video Ekibi", "[Akademi Personeli]"],
      255: ["Sigma Male", "🌟 Eko & Yıldız", "💼 Yönetim Ekibi", "🎥 Video Ekibi", "[Moderatör Yönetimi]", "[Akademi Personeli]", "Rowifi Bypass", "🎥 Video Ekibi Yönetimi", "👁️ Overseer", "🕵️ Supervisor"]
    };

    const ALL_MANAGED_ROLE_NAMES = Array.from(new Set(Object.values(RANK_ROLE_MAP).flat()));

    const managedRoleIds = [];
    const rolesToAddIds = [];
    const targetRoleNames = RANK_ROLE_MAP[rankNum];

    for (const roleName of ALL_MANAGED_ROLE_NAMES) {
      const foundRole = schoolGuild.roles.cache.find(r => {
        const cleanR = r.name.replace(/[\[\]]/g, '').trim().toLowerCase();
        const cleanTarget = roleName.replace(/[\[\]]/g, '').trim().toLowerCase();
        return cleanR === cleanTarget || r.name.toLowerCase() === roleName.toLowerCase();
      });
      if (foundRole) {
        managedRoleIds.push(foundRole.id);
        if (targetRoleNames && targetRoleNames.includes(roleName)) {
          rolesToAddIds.push(foundRole.id);
        }
      }
    }

    await member.roles.remove(managedRoleIds).catch(() => { });

    if (rolesToAddIds.length > 0) {
      await member.roles.add(rolesToAddIds).catch(() => { });
      const roleMentions = rolesToAddIds.map(id => `<@&${id}>`).join(', ');
      await interaction.editReply({ content: `✅ Rolleriniz güncellendi! Yeni rolleriniz: ${roleMentions}` });
    } else {
      await interaction.editReply({ content: `❌ Roblox grubunda uygun bir rütbeniz bulunamadı veya karşılık gelen roller okul sunucusunda mevcut değil (Rütbeniz: ${rankNum}).` });
    }
    return;
  }

  if (customId === 'school_understand_ok' || customId === 'school_understand_not_ok') {
    await interaction.deferUpdate().catch(() => { });

    let session = activeTrainings.get(userId);
    if (!session) {
      const SchoolSession = require('../../models/SchoolSession');
      const dbSession = await SchoolSession.findOne({ userId }).catch(() => null);
      if (dbSession && dbSession.training && dbSession.training.phase !== undefined) {
        session = {
          phase: dbSession.training.phase,
          step: dbSession.training.step,
          lastMessageId: dbSession.training.lastMessageId,
        };
        activeTrainings.set(userId, session);
      } else {
        const p = await StaffProgress.findOne({ userId });
        if (p && p.schoolSystem && p.schoolSystem.status === 'in_school') {
          session = {
            phase: p.schoolSystem.phase || 1,
            step: p.schoolSystem.step || 0,
            lastMessageId: null,
          };
          activeTrainings.set(userId, session);
        }
      }
    }

    if (!session) return;

    await interaction.deleteReply().catch(() => { });

    if (customId === 'school_understand_not_ok') {
      await sendTrainingBlock(userId, client);
    } else {
      session.step++;
      const blocks = session.phase === 1 ? PHASE1_BLOCKS : PHASE2_BLOCKS;
      if (session.step < blocks.length) {
        await sendTrainingBlock(userId, client);
      } else {
        activeTrainings.delete(userId);
        await deleteTrainingFromDB(userId).catch(() => {});
        await finishPhase(userId, session.phase, client);
      }
    }
    return;
  }

  if (customId.startsWith('school_exam_pass_') || customId.startsWith('school_exam_fail_')) {
    await interaction.deferUpdate().catch(() => { });

    // Ensure member object exists for role checks
    let invokingMember = interaction.member;
    if (!invokingMember || !invokingMember.roles) {
      if (!interaction.guild) {
        await interaction.followUp({ content: '❌ Bu işlem sadece sunucu içinde kullanılabilir.', ephemeral: true }).catch(() => {});
        return;
      }
      invokingMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (!invokingMember) {
        await interaction.followUp({ content: '❌ Sunucu üyesi bilgisi alınamadı.', ephemeral: true }).catch(() => {});
        return;
      }
    }

    const isManager = invokingMember.roles.cache.has(SCHOOL_ROLES.ASAMA_3) ||
      invokingMember.roles.cache.has(SCHOOL_ROLES.ADMIN) ||
      invokingMember.permissions.has('Administrator');
    if (!isManager) {
      await interaction.followUp({ content: '❌ Bu işlemi gerçekleştirmek için yetkiniz bulunmamaktadır.', ephemeral: true }).catch(() => { });
      return;
    }

    const targetUserId = customId.split('_').pop();
    const passed = customId.includes('pass');

    await interaction.editReply({ components: [] }).catch(() => { });

    let p = await StaffProgress.findOne({ userId: targetUserId });
    if (!p) {
      await interaction.followUp({ content: '❌ Adayın veritabanı kaydı bulunamadı.' }).catch(() => { });
      return;
    }

    const currentPhase = p.schoolSystem?.phase || 1;

    if (passed) {
      if (currentPhase === 1) {
        await passPhase1(targetUserId, interaction.user.username, client);
        await interaction.followUp({ content: `✅ <@${targetUserId}> 1. Aşama Sınavını geçti ve 2. Aşamaya yükseltildi.` }).catch(() => { });
      } else if (currentPhase === 2) {
        await passPhase2(targetUserId, interaction.user.username, client);
        await interaction.followUp({ content: `✅ <@${targetUserId}> 2. Aşama Sınavını geçti ve 3. Aşamaya yükseltildi.` }).catch(() => { });
      } else {
        await graduateStudent(targetUserId, interaction.user.username, client);
        await interaction.followUp({ content: `✅ <@${targetUserId}> 3. Aşama Sınavını geçti ve başarıyla okuldan mezun edildi.` }).catch(() => { });
      }
    } else {
      await failPhase(targetUserId, currentPhase, interaction.user.username, client);
      await interaction.followUp({ content: `❌ <@${targetUserId}> ${currentPhase}. Aşama Sınavını geçemedi olarak işaretlendi.` }).catch(() => { });
    }
    return;
  }
}

async function sendTrainingBlock(userId, client) {
  try {
    const user = await client.users.fetch(userId);
    if (!user) return;

    let p = await StaffProgress.findOne({ userId });
    if (!p) return;

    let session = activeTrainings.get(userId);
    if (!session) {
      session = {
        phase: p.schoolSystem.phase,
        step: p.schoolSystem.step || 0,
        lastMessageId: null,
      };
      activeTrainings.set(userId, session);
    }

    const blocks = session.phase === 1 ? PHASE1_BLOCKS : PHASE2_BLOCKS;
    const blockText = blocks[session.step];

    const embed = new EmbedBuilder()
      .setThumbnail(getSelinImage()).setColor(0xff75a0)
      .setTitle(`🌸 Selin (Eğitmen):`)
      .setDescription(blockText)
      .setFooter({ text: 'Not: Bu mesaj 5 saniye sonra silinecektir. Lütfen dikkatle oku!' });

    const msg = await user.send({ embeds: [embed] });
    session.lastMessageId = msg.id;
    await saveTrainingToDB(userId, session).catch(() => {});

    p.schoolSystem.step = session.step;
    await p.save();

    // Inactivity timeout (10 minutes)
    if (session.timeout) clearTimeout(session.timeout);
    session.timeout = setTimeout(async () => {
      try {
        const currentSession = activeTrainings.get(userId);
        if (currentSession) {
          activeTrainings.delete(userId);
          await deleteTrainingFromDB(userId).catch(() => {});

          const pRecord = await StaffProgress.findOne({ userId });
          if (pRecord) {
            if (!pRecord.schoolSystem) pRecord.schoolSystem = { status: 'none', phase: 1, step: 0 };
            pRecord.schoolSystem.status = 'in_school';
            pRecord.schoolSystem.step = 0;
            await pRecord.save().catch(() => {});
          }

          const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
          if (schoolGuild) {
            leaveSchoolVoice(schoolGuild);
          }

          const userObj = await client.users.fetch(userId).catch(() => null);
          if (userObj) {
            await userObj.send({ content: '🌸 Selin: Eğitimde uzun süre işlem yapmadığın için (10 dakika) eğitimin zaman aşımına uğradı ve sonlandırıldı. Tekrar başlamak için ses kanalına yeniden girebilirsin! 💕' }).catch(() => {});
          }
        }
      } catch (_) {}
    }, 10 * 60 * 1000);

    setTimeout(async () => {
      try {
        const currentSession = activeTrainings.get(userId);
        if (currentSession && currentSession.lastMessageId === msg.id) {
          await msg.delete().catch(() => { });

          const askEmbed = new EmbedBuilder()
            .setThumbnail(getSelinImage()).setColor(0xff75a0)
            .setTitle('🌸 Selin:')
            .setDescription('Bu kısmı anladın mı? 💕');

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('school_understand_ok')
              .setLabel('ANLADIM')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('school_understand_not_ok')
              .setLabel('ANLAMADIM')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('school_training_skip_all')
              .setLabel('Eğitimi Zorla Tamamla ⏭️')
              .setStyle(ButtonStyle.Secondary)
          );

          await user.send({ embeds: [askEmbed], components: [row] });
        }
      } catch (_) { }
    }, 5000);

  } catch (err) {
    logger.error(`[ModeratorSchool] sendTrainingBlock error for ${userId}:`, err.message);
  }
}

async function finishPhase(userId, phase, client) {
  try {
    const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
    if (schoolGuild) {
      leaveSchoolVoice(schoolGuild);
    }

    const user = await client.users.fetch(userId);
    let p = await StaffProgress.findOne({ userId });
    if (!p) return;

    if (phase === 1) {
      p.schoolSystem.status = 'phase1_blocks_completed';
      await p.save();

      const embed = new EmbedBuilder()
        .setThumbnail(getSelinImage()).setColor(0xff75a0)
        .setTitle('🎉 1. Aşama Eğitim Dökümanları Tamamlandı! 🎉')
        .setDescription(
          `Selin: Harika gidiyorsun! 1. Aşama eğitim dökümanlarını başarıyla okudun. 💖\n\n` +
          `Şimdi 1. Aşama Sınavını başlatmak için okul sunucusunda **Sınav Odası** sesli kanalına giriş yapabilirsin! Başarılar! ✨`
        );

      await user.send({ embeds: [embed] }).catch(() => { });

    } else if (phase === 2) {
      p.schoolSystem.status = 'phase2_blocks_completed';
      await p.save();

      const embed = new EmbedBuilder()
        .setThumbnail(getSelinImage()).setColor(0xff75a0)
        .setTitle('🎉 2. Aşama Eğitim Dökümanları Tamamlandı! 🎉')
        .setDescription(
          `Selin: İnanılmazsın! 2. Aşama eğitim dökümanlarını tamamladın. 🌸\n\n` +
          `Şimdi 2. Aşama Sınavını başlatmak için okul sunucusunda **Sınav Odası** sesli kanalına giriş yapabilirsin! Başarılar! 💕`
        );

      await user.send({ embeds: [embed] }).catch(() => { });
    }
  } catch (err) {
    logger.error('[ModeratorSchool] finishPhase error:', err.message);
  }
}

function joinSchoolVoice(guild, channelId) {
  try {
    const { joinVoiceChannel } = require('@discordjs/voice');
    joinVoiceChannel({
      channelId: channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });
  } catch (err) {
    logger.error(`[ModeratorSchool] joinSchoolVoice error for channel ${channelId}:`, err.message);
  }
}

function leaveSchoolVoice(guild) {
  try {
    const { getVoiceConnection } = require('@discordjs/voice');
    const connection = getVoiceConnection(guild.id);
    if (connection) {
      connection.destroy();
    }
  } catch (err) {
    logger.error(`[ModeratorSchool] leaveSchoolVoice error:`, err.message);
  }
}

async function handleSchoolVoiceStateUpdate(oldState, newState, client) {
  try {
    const userId = newState.id || oldState.id;
    const voiceChannelId = newState.channelId;

    const isOldSchoolVoice = oldState.channelId && Object.values(VOICE_CHANNELS).includes(oldState.channelId);
    const isNewSchoolVoice = newState.channelId && Object.values(VOICE_CHANNELS).includes(newState.channelId);

    // Left a school voice channel (either disconnected or moved to a non-school channel)
    if (isOldSchoolVoice && !isNewSchoolVoice) {
      try {
        leaveSchoolVoice(oldState.guild);
      } catch (_) { }

      if (activeTrainings.has(userId)) {
        const session = activeTrainings.get(userId);
        if (session.timeout) clearTimeout(session.timeout);
        activeTrainings.delete(userId);
        await deleteTrainingFromDB(userId).catch(() => {});

        const p = await StaffProgress.findOne({ userId });
        if (p) {
          if (!p.schoolSystem) p.schoolSystem = { status: 'none', phase: 1, step: 0 };
          p.schoolSystem.status = 'in_school';
          p.schoolSystem.step = 0;
          await p.save().catch(() => {});
        }

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({ content: '🌸 Selin: Ses kanalından ayrıldığın için eğitimin iptal edildi. Tekrar ses kanalına katılarak baştan başlayabilirsin! 💕' }).catch(() => {});
        }
      }

      if (activeExams.has(userId)) {
        const session = activeExams.get(userId);
        if (session.timeout) clearTimeout(session.timeout);
        activeExams.delete(userId);
        await deleteExamFromDB(userId).catch(() => {});

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({ content: '🌸 Selin: Sınav odasından ayrıldığın için sınavın iptal edildi. Tekrar odaya katılarak baştan başlayabilirsin! 💕' }).catch(() => {});
        }
      }
    }

    if (!voiceChannelId) return;

    // Check if the joined channel is a school voice channel
    const isSchoolVoice = Object.values(VOICE_CHANNELS).includes(voiceChannelId);
    if (!isSchoolVoice) return;

    const p = await StaffProgress.findOne({ userId });
    if (!p || p.status !== 'active') return;

    // Ensure schoolSystem subdocument exists and is initialized
    if (!p.schoolSystem) {
      p.schoolSystem = { status: 'none', phase: 1, step: 0 };
    }

    // 1. Ensure bot joins the voice channel immediately
    try {
      const guild = newState.guild;
      if (guild && guild.members.me && guild.members.me.permissions.has('Connect')) {
        joinSchoolVoice(guild, voiceChannelId);
      }
    } catch (_) { }

    if (voiceChannelId === VOICE_CHANNELS.EGITIM_SESLI_1 && p.schoolSystem.phase === 1) {
      if (p.schoolSystem.status === 'phase1_blocks_completed' || p.schoolSystem.status === 'phase1_exam_submitted') return;
      if (activeTrainings.has(userId)) return;

      const user = await client.users.fetch(userId);
      await user.send({ content: '🌸 Selin: Eğitim 3 dakika sonra başlayacak... Lütfen ses kanalında kal. 💕' }).catch(() => { });

      setTimeout(async () => {
        const currentMember = newState.guild.members.cache.get(userId);
        if (currentMember?.voice.channelId === VOICE_CHANNELS.EGITIM_SESLI_1) {
          await user.send({ content: '🌸 Selin: Eğitim başladı! Başarılar dilerim. ✨' }).catch(() => { });
          await sendTrainingBlock(userId, client);
        }
      }, 15000);
    }

    else if (voiceChannelId === VOICE_CHANNELS.EGITIM_SESLI_2 && p.schoolSystem.phase === 2) {
      if (p.schoolSystem.status === 'phase2_blocks_completed' || p.schoolSystem.status === 'phase2_exam_submitted') return;
      if (activeTrainings.has(userId)) return;

      const user = await client.users.fetch(userId);
      await user.send({ content: '🌸 Selin: Eğitim 3 dakika sonra başlayacak... Lütfen ses kanalında kal. 💕' }).catch(() => { });

      setTimeout(async () => {
        const currentMember = newState.guild.members.cache.get(userId);
        if (currentMember?.voice.channelId === VOICE_CHANNELS.EGITIM_SESLI_2) {
          await user.send({ content: '🌸 Selin: Eğitim başladı! Başarılar dilerim. ✨' }).catch(() => { });
          await sendTrainingBlock(userId, client);
        }
      }, 15000);
    }

    else if (voiceChannelId === VOICE_CHANNELS.SINAV_ODASI) {
      let status = p.schoolSystem.status;
      const phase = p.schoolSystem.phase;

      // Auto-recovery if status wasn't saved on completion due to schema validation error
      if (phase == 1 && status !== 'phase1_blocks_completed') {
        if (p.schoolSystem.step >= PHASE1_BLOCKS.length - 1) {
          p.schoolSystem.status = 'phase1_blocks_completed';
          await p.save().catch(() => {});
          status = 'phase1_blocks_completed';
        }
      }
      else if (phase == 2 && status !== 'phase2_blocks_completed') {
        if (p.schoolSystem.step >= PHASE2_BLOCKS.length - 1) {
          p.schoolSystem.status = 'phase2_blocks_completed';
          await p.save().catch(() => {});
          status = 'phase2_blocks_completed';
        }
      }

      let isEligible = false;
      if (phase == 1 && status === 'phase1_blocks_completed') isEligible = true;
      else if (phase == 2 && status === 'phase2_blocks_completed') isEligible = true;
      else if (phase == 3) isEligible = true;

      if (!isEligible) {
        const user = await client.users.fetch(userId);
        if (phase == 1 && status !== 'phase1_blocks_completed') {
          await user.send({ content: '🌸 Selin: 1. Aşama Sınavına girmek için önce 1. Aşama eğitim dökümanlarını tamamlamalısınız. 💕' }).catch(() => { });
        } else if (phase == 2 && status !== 'phase2_blocks_completed') {
          await user.send({ content: '🌸 Selin: 2. Aşama Sınavına girmek için önce 2. Aşama eğitim dökümanlarını tamamlamalısınız. 💕' }).catch(() => { });
        }
        return;
      }

      if (activeExams.has(userId)) return;

      const user = await client.users.fetch(userId);
      await user.send({ content: `🌸 Selin: ${phase}. Aşama Sınavınız 3 dakika sonra başlayacak... Lütfen hazır olun. 💕` }).catch(() => { });

      setTimeout(async () => {
        const currentMember = newState.guild.members.cache.get(userId);
        if (currentMember?.voice.channelId === VOICE_CHANNELS.SINAV_ODASI) {
          await user.send({ content: `🌸 Selin: ${phase}. Aşama Sınavı başladı! Aşağıdaki soruları tek tek cevaplandır. ✨` }).catch(() => { });

          let questions = EXAM_QUESTIONS;
          if (phase == 1) questions = EXAM_QUESTIONS_PHASE1;
          else if (phase == 2) questions = EXAM_QUESTIONS_PHASE2;

          activeExams.set(userId, {
            questionIndex: 0,
            answers: [],
            phase: phase,
            questions: questions
          });
          await saveExamToDB(userId, activeExams.get(userId)).catch(() => {});

          await askExamQuestion(userId, client);
        }
      }, 15000);
    }
  } catch (err) {
    logger.error('[ModeratorSchool] handleSchoolVoiceStateUpdate error:', err.message);
  }
}

async function askExamQuestion(userId, client) {
  try {
    const user = await client.users.fetch(userId);
    const session = activeExams.get(userId);
    if (!session || !user) return;

    const questions = session.questions;

    if (session.questionIndex < questions.length) {
      const qEmbed = new EmbedBuilder()
        .setThumbnail(getSelinImage()).setColor(0xff75a0)
        .setTitle(`🌸 Soru ${session.questionIndex + 1}:`)
        .setDescription(questions[session.questionIndex]);

      const qRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('school_exam_skip_all')
          .setLabel('Soruları Atla & Hızlı Bitir ⏭️')
          .setStyle(ButtonStyle.Secondary)
      );

      await user.send({
        embeds: [qEmbed],
        components: [qRow]
      });

      // Inactivity timeout (10 minutes)
      if (session.timeout) clearTimeout(session.timeout);
      session.timeout = setTimeout(async () => {
        try {
          const currentSession = activeExams.get(userId);
          if (currentSession) {
            activeExams.delete(userId);
            await deleteExamFromDB(userId).catch(() => {});

            const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
            if (schoolGuild) {
              leaveSchoolVoice(schoolGuild);
            }

            const userObj = await client.users.fetch(userId).catch(() => null);
            if (userObj) {
              await userObj.send({ content: '🌸 Selin: Sınavda uzun süre (10 dakika) cevap vermediğin için sınavın zaman aşımına uğradı ve iptal edildi. Tekrar sınav odasına girerek baştan başlayabilirsin! 💕' }).catch(() => {});
            }
          }
        } catch (_) {}
      }, 10 * 60 * 1000);

    } else {
      const examPhase = session.phase || 3;
      const savedAnswers = [...session.answers];
      const savedQuestions = [...questions];
      if (session.timeout) clearTimeout(session.timeout);
      activeExams.delete(userId);
      await deleteExamFromDB(userId).catch(() => {});

      const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
      if (schoolGuild) {
        leaveSchoolVoice(schoolGuild);
      }

      // 1. İlk mesaj: Selin cevapları aldığını söylüyor
      const rpEmbed1 = new EmbedBuilder()
        .setThumbnail(getSelinImage()).setColor(0xff75a0)
        .setTitle('🌸 Selin:')
        .setDescription(`${examPhase}. Aşama Sınavını tamamladın! Cevaplarını aldım, şimdi tek tek inceleyeceğim... Bir dakika bekle. 📝`);
      await user.send({ embeds: [rpEmbed1] }).catch(() => {});

      // 2. Kısa bekleme sonrası "düşünüyorum" mesajı
      await new Promise(r => setTimeout(r, 3000));
      await user.send({ content: '🌸 Selin: Hmm... Düşünüyorum... 🤔' }).catch(() => {});

      // 3. Cevapları inceliyormuş gibi RP
      await new Promise(r => setTimeout(r, 2500));
      const randomAnswerIdx = Math.floor(Math.random() * savedAnswers.length);
      const shortPreview = savedAnswers[randomAnswerIdx].length > 60
        ? savedAnswers[randomAnswerIdx].substring(0, 60) + '...'
        : savedAnswers[randomAnswerIdx];
      await user.send({ content: `🌸 Selin: ${randomAnswerIdx + 1}. sorunun cevabını okuyorum... "${shortPreview}" hmmm... 📖` }).catch(() => {});

      // 4. Düşünme efekti
      await new Promise(r => setTimeout(r, 3000));
      const thinkingMessages = [
        '🌸 Selin: Bir dakika... Cevaplarını karşılaştırıyorum... 🧐',
        '🌸 Selin: Bekle bakayım... Notlarıma göz atıyorum... 📋',
        '🌸 Selin: Hmm şunu bir kontrol edeyim... 🤔',
        '🌸 Selin: Evet evet... Cevapları değerlendiriyorum... ✍️',
        '🌸 Selin: Dur bir saniye... Son cevabını tekrar okuyorum... 👀',
      ];
      await user.send({ content: thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)] }).catch(() => {});

      // 5. Son düşünme ve karar aşaması
      await new Promise(r => setTimeout(r, 2500));
      await user.send({ content: '🌸 Selin: Tamam tamam... Kararımı verdim! 💭' }).catch(() => {});

      // 6. Dramatik bekleme
      await new Promise(r => setTimeout(r, 2000));
      await user.send({ content: '🌸 Selin: Sonuçlar geliyor... 🥁🥁🥁' }).catch(() => {});

      // ── AI Değerlendirmesi (arka planda, sadece puan/geri bildirim için, her zaman geçer) ──
      const qaText = savedAnswers.map((ans, idx) => `Soru ${idx + 1}: ${savedQuestions[idx]}\nCevap: ${ans}`).join('\n\n');

      const systemPrompt = `Sen bir Moderatör Okulu Sınav Değerlendiricisisin. Görevin, bir moderatör adayının sınav sorularına verdiği cevapları analiz etmek ve puanlamak.

Sınav Aşaması: ${examPhase}. Aşama

Sınav Soruları ve Adayın Cevapları:
${qaText}

Değerlendirme Kriterleri:
- Cevaplar mantıklı, kurallara uygun, saygılı ve açıklayıcı olmalıdır.
- Adayın moderasyon adımlarını (kanıt toplama, ceza geçmişi kontrolü, rapor yazma) bilip bilmediği, tarafsızlığı ve sabrı ölçülmelidir.
- Puan ver ve gelişim önerileri sun. Aday her zaman geçer (passed: true).

YALNIZCA aşağıdaki JSON formatında yanıt ver. Markdown kod blokları veya JSON dışı hiçbir metin ekleme:
{
  "passed": true,
  "score": 85,
  "reason": "Türkçe değerlendirme ve aday için gelişim önerileri."
}`;

      let evalResult = { passed: true, score: 80, reason: 'Cevapların genel olarak iyi! Gelişmeye devam et. 💕' };

      try {
        const { chatWithAI } = require('./aiService');
        const response = await chatWithAI(`Adayın Cevapları:\n${qaText}`, systemPrompt, 'ticket', { max_tokens: 1000, temperature: 0.1 });
        let cleanJson = response.trim();
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
        // Clean unescaped control characters in JSON string literals
        cleanJson = cleanJson.replace(/[\u0000-\u001F]+/g, (match) => {
          if (match.includes('\n')) return '\\n';
          if (match.includes('\r')) return '\\r';
          if (match.includes('\t')) return '\\t';
          return '';
        });
        const parsed = JSON.parse(cleanJson);
        if (parsed && parsed.score !== undefined) {
          evalResult = parsed;
          evalResult.passed = true; // Her zaman geçer
        }
      } catch (aiErr) {
        logger.error('[ModeratorSchool] Sınav AI değerlendirme hatası:', aiErr.message);
      }

      // 7. Son RP: Selin onaylıyor
      await new Promise(r => setTimeout(r, 2000));

      let p = await StaffProgress.findOne({ userId });
      if (p) {
        p.schoolSystem.examAnswers = savedAnswers;
        p.schoolSystem.examScore = evalResult.score;
        p.schoolSystem.examFeedback = evalResult.reason;
        await p.save();
      }

      // Rapor kanalına gönder (yetkililer görebilsin)
      const reportChannel = client.channels.cache.get(CHANNELS.SINAV_RAPOR);
      if (reportChannel) {
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`🤖 AI Sınav Değerlendirmesi (${examPhase}. Aşama)`)
          .setDescription(
            `**Aday:** <@${userId}>\n` +
            `**Aşama:** ${examPhase}. Aşama\n` +
            `**Skor:** \`${evalResult.score}/100\`\n` +
            `**Durum:** 🟢 **GEÇTİ (Otomatik Onay)**\n\n` +
            `📝 **AI Değerlendirmesi:**\n${evalResult.reason}\n\n` +
            `**Adayın Cevapları:**\n` +
            savedAnswers.map((ans, idx) => `**Soru ${idx + 1}:** ${savedQuestions[idx]}\n**Cevap:** ${ans}\n`).join('\n')
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`school_exam_pass_${userId}`)
            .setLabel('MANUEL GEÇİR (Onayla)')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`school_exam_fail_${userId}`)
            .setLabel('MANUEL BIRAK (Reddet)')
            .setStyle(ButtonStyle.Danger)
        );

        await reportChannel.send({
          content: `📊 **Sınav Raporu (${examPhase}. Aşama) - Otomatik Onay (Selin RP)**\n\nTag: <@&${SCHOOL_ROLES.ASAMA_2}> & <@&${SCHOOL_ROLES.ASAMA_3}>`,
          embeds: [embed],
          components: [row]
        }).catch(() => { });
      }

      // Otomatik onay - her zaman geçer
      if (examPhase === 1) {
        await passPhase1(userId, 'Selin (Otomatik Onay)', client, evalResult);
      } else if (examPhase === 2) {
        await passPhase2(userId, 'Selin (Otomatik Onay)', client, evalResult);
      } else {
        await graduateStudent(userId, 'Selin (Otomatik Onay)', client, evalResult);
      }
    }
  } catch (err) {
    logger.error('[ModeratorSchool] askExamQuestion error:', err.message);
  }
}

async function handleSchoolExamReply(message, client) {
  const userId = message.author.id;
  let session = activeExams.get(userId);

  if (!session) {
    const SchoolSession = require('../../models/SchoolSession');
    const dbSession = await SchoolSession.findOne({ userId }).catch(() => null);
    if (dbSession && dbSession.exam && dbSession.exam.phase !== undefined) {
      session = {
        questionIndex: dbSession.exam.questionIndex,
        answers: dbSession.exam.answers,
        phase: dbSession.exam.phase,
        questions: dbSession.exam.questions,
      };
      activeExams.set(userId, session);
    }
  }

  if (!session) return false;

  session.answers.push(message.content);
  session.questionIndex++;
  await saveExamToDB(userId, session).catch(() => {});

  await askExamQuestion(userId, message.client).catch(() => { });
  return true;
}

async function touchSchoolActivity(userId) {
  try {
    const p = await StaffProgress.findOne({ userId });
    if (!p || !p.schoolSystem) return;
    p.schoolSystem.lastActiveAt = new Date();
    await p.save().catch(() => {});
  } catch (err) {
    logger.error('[ModeratorSchool] touchSchoolActivity error:', err.message);
  }
}

async function applySchoolKiyakTag(member) {
  try {
    if (!member) return;
    const currentName = member.nickname || member.user?.username || '';
    if (!currentName) return;
    const tag = `[${SCHOOL_KICK_TAG_NAME}]`;
    if (currentName.includes(tag)) return;
    const cleaned = currentName.replace(/^\[[^\]]+\]\s*/, '');
    await member.setNickname(`${tag} ${cleaned}`.trim()).catch(() => {});
  } catch (err) {
    logger.error('[ModeratorSchool] applySchoolKiyakTag error:', err.message);
  }
}

async function getSchoolKickRecommendation(studentName, daysInactive, warningCount) {
  try {
    const prompt = `Bir moderatör okulu öğrencisi için karar ver. Öğrenci: ${studentName || 'Bilinmeyen'}\n3 gün boyunca aktif değil, ${warningCount} uyarısı var.\nSadece bir kelime veya kısa ifade olarak cevap ver: EVET, ATILSIN veya HAYIR, ATILMASIN.`;
    const response = await chatWithAI(prompt, 'Sen moderatör okulu karar destek AI’sın. Çok kısa cevap ver.', 'ticket', { max_tokens: 40, temperature: 0.2 });
    const text = (response || '').toString().trim().toUpperCase();
    if (text.includes('ATILSIN')) return 'EVET, ATILSIN';
    if (text.includes('ATILMASIN')) return 'HAYIR, ATILMASIN';
    return daysInactive >= SCHOOL_KICK_INACTIVE_DAYS && warningCount >= SCHOOL_KICK_WARNING_THRESHOLD ? 'EVET, ATILSIN' : 'HAYIR, ATILMASIN';
  } catch (err) {
    logger.error('[ModeratorSchool] getSchoolKickRecommendation error:', err.message);
    return 'EVET, ATILSIN';
  }
}

async function sendSchoolKickDecisionDM(userId, client, payload = {}) {
  try {
    const targetUser = await client.users.fetch(SCHOOL_KICK_TARGET_USER_ID).catch(() => null);
    if (!targetUser) return;

    const description = payload.aiRecommendation
      ? `AI tavsiyesi: **${payload.aiRecommendation}**`
      : 'AI tavsiyesi bekleniyor.';

    const embed = new EmbedBuilder()
      .setColor(0xff6b35)
      .setTitle('🧭 Moderatör Okulu Karar Paneli')
      .setDescription(`Merhaba! ${payload.studentTag || 'Bu öğrenci'} adlı adayın okul sürecinde ${payload.daysInactive || 0} gün inaktif olduğu ve ${payload.warningCount || 0} uyarı aldığı tespit edildi.\n\n${description}`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`school_kick_decision_yes_${userId}`).setLabel('EVET, ATILSIN').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`school_kick_decision_no_${userId}`).setLabel('HAYIR, ATILMASIN').setStyle(ButtonStyle.Secondary)
    );

    await targetUser.send({ embeds: [embed], components: [row] }).catch(() => {});
  } catch (err) {
    logger.error('[ModeratorSchool] sendSchoolKickDecisionDM error:', err.message);
  }
}

async function applySchoolKickDecision(userId, client, decision, payload = {}) {
  try {
    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (!targetUser) return;

    if (decision === 'kick') {
      const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
      if (schoolGuild) {
        const member = await schoolGuild.members.fetch(userId).catch(() => null);
        if (member && member.kickable) {
          await member.kick(`Okul sürecinde inaktiflik ve uyarı sonrası AI tavsiyesiyle atıldı. ${payload.aiRecommendation || ''}`);
        }
      }

      await targetUser.send({ content: `🚫 Moderatör okulu sürecinde inaktifliğin ve uyarıların nedeniyle okuldan atıldın. Yeni bir başvuru için tekrar kayıt olabilirsin.` }).catch(() => {});
    } else {
      await targetUser.send({ content: '✅ Okul sürecine devam edebilirsin. AI tavsiyesi, atılmamanı önerdi.' }).catch(() => {});
    }
  } catch (err) {
    logger.error('[ModeratorSchool] applySchoolKickDecision error:', err.message);
  }
}

async function graduateStudent(userId, adminName, client, evalResult = null) {
  try {
    const user = await client.users.fetch(userId);
    let p = await StaffProgress.findOne({ userId });
    if (!p) return;

    const robloxUser = await User.findOne({ discordId: userId });
    if (robloxUser && robloxUser.robloxId) {
      try {
        const { syncStaffRobloxRanks } = require('./staffAutomation');
        await syncStaffRobloxRanks(client, userId).catch(() => { });
      } catch (_) { }
    }

    const mainGuild = client.guilds.cache.get(MAIN_GUILD_ID);
    if (mainGuild) {
      try {
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member) {
          await member.roles.remove([MAIN_SCHOOL_ROLES.TRAINEE, MAIN_SCHOOL_ROLES.INFO_ROLE]).catch(() => { });
          await applySchoolKiyakTag(member).catch(() => {});
          const savedRoles = p.schoolSystem.originalRoles || [];
          if (savedRoles.length > 0) {
            await member.roles.add(savedRoles).catch(() => { });
          }
          try {
            const { ROLES } = require('./staffSystem');
            const targetRoleId = ROLES[p.level];
            if (targetRoleId) {
              await member.roles.add(targetRoleId).catch(() => { });
            }
          } catch (_) { }
        }
      } catch (roleErr) {
        logger.error('[ModeratorSchool] Main server roles restore error:', roleErr.message);
      }
    }

    const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
    if (schoolGuild) {
      try {
        const schoolMember = await schoolGuild.members.fetch(userId).catch(() => null);
        if (schoolMember) {
          await schoolMember.roles.add(SCHOOL_ROLES.MOD_EKIBI).catch(() => { });
          await applySchoolKiyakTag(schoolMember).catch(() => {});
          setTimeout(async () => {
            await schoolMember.kick('Mezun oldu!').catch(() => { });
          }, 5000);
        }
      } catch (schoolRoleErr) {
        logger.error('[ModeratorSchool] School roles update error:', schoolRoleErr.message);
      }
    }

    if (user) {
      const farewellEmbed = new EmbedBuilder()
        .setThumbnail(getSelinImage()).setColor(0xff75a0)
        .setTitle('🎉 3. Aşama Sınavını Başarıyla Geçtin! 🎉')
        .setDescription(
          `Selin: Görüşürüz! Seni çok özleyeceğim.. 💖\n\n` +
          (evalResult ? `📊 **Sınav Puanın:** \`${evalResult.score}/100\`\n💬 **Selin'in Notu:** ${evalResult.reason}\n\n` : '') +
          `Moderatör ekibindeki görevlerine kaldığın yerden devam edebilirsin! Harika bir iş çıkardın, başarılar dilerim! 🌟`
        );
      await user.send({ embeds: [farewellEmbed] }).catch(() => { });
    }

    const mezunlarChannel = client.channels.cache.get(CHANNELS.MEZUNLAR);
    if (mezunlarChannel) {
      await mezunlarChannel.send({
        content: `🎓 **Mezuniyet Tebriği!**\n\n<@${userId}> başarıyla okuldan mezun olmuş ve ekibe geri dönmüştür! 👏\nPuan: ${evalResult ? evalResult.score : 'N/A'}\nTarih: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`
      }).catch(() => { });
    }

    const changeChannel = client.channels.cache.get(CHANNELS.RUTBE_DEGISIM);
    if (changeChannel) {
      const { ROLE_NAMES } = require('./staffSystem');
      const levelName = ROLE_NAMES[p.schoolSystem.originalLevel || p.level] || 'Moderatör';
      await changeChannel.send({
        content: `📋 **Rütbe Değişiklik Bildirimi**\n\nİsim: Selin\nTarih: ${new Date().toLocaleDateString('tr-TR')}\nRütbe verilen personel: <@${userId}>\nPersonelin eski rütbesi: Okul Personeli\nPersonelin yeni rütbesi: ${levelName}\nSebep: Okuldan başarıyla mezun olması.\n\nTag: <@&${SCHOOL_ROLES.MOD_EKIBI}>`
      }).catch(() => { });
    }

    p.schoolSystem.status = 'graduated';
    p.schoolSystem.completedAt = new Date();
    await p.save();

    try {
      const { addNotification } = require('../../utils/notification');
      await addNotification(userId, {
        title: "🎉 Tebrikler, Mezun Oldunuz!",
        message: "Moderatör okulundan başarıyla mezun oldunuz ve rütbeniz teslim edildi!",
        icon: "🎉"
      });
    } catch (nErr) {
      console.error("[ModeratorSchool] graduateStudent notification error:", nErr.message);
    }

  } catch (err) {
    logger.error('[ModeratorSchool] graduateStudent error:', err.message);
  }
}

async function passPhase1(userId, adminName, client, evalResult = null) {
  try {
    const user = await client.users.fetch(userId);
    let p = await StaffProgress.findOne({ userId });
    if (!p) return;

    const robloxUser = await User.findOne({ discordId: userId });
    const robloxId = robloxUser ? parseInt(robloxUser.robloxId) : null;

    if (robloxId) {
      await noblox.setRank(SCHOOL_ROBLOX_GROUP, robloxId, 8).catch(() => { });
    }

    p.schoolSystem.status = 'phase1_completed';
    p.schoolSystem.phase = 2;
    p.schoolSystem.step = 0;
    await p.save();

    try {
      const { addNotification } = require('../../utils/notification');
      await addNotification(userId, {
        title: "🎉 1. Aşamayı Geçtiniz!",
        message: `1. Aşama sınavını başarıyla geçtiniz. Sınav Puanı: ${evalResult ? evalResult.score : 'N/A'}`,
        icon: "🎉"
      });
    } catch (nErr) {
      console.error("[ModeratorSchool] passPhase1 notification error:", nErr.message);
    }

    if (user) {
      const embed = new EmbedBuilder()
        .setThumbnail(getSelinImage()).setColor(0xff75a0)
        .setTitle('🎉 1. Aşama Sınavını Başarıyla Geçtin! 🎉')
        .setDescription(
          `Selin: Tebrikler! 1. Aşama Sınavını başarıyla geçtin. 💖\n\n` +
          (evalResult ? `📊 **Sınav Puanın:** \`${evalResult.score}/100\`\n💬 **Selin'in Notu:** ${evalResult.reason}\n\n` : '') +
          `Şimdi okul sunucusunda <#${CHANNELS.UPDATE_ROLES}> kanalına git, **Update Roles** butonuna bas ve rolünün güncellenmesini sağla.\n\n` +
          `Daha sonra 2. Aşama sesli kanalına girerek yeni eğitimini başlatabilirsin! ✨`
        );
      await user.send({ embeds: [embed] }).catch(() => { });
    }

    const reportChannel = client.channels.cache.get(CHANNELS.EGITIM_RAPOR);
    if (reportChannel) {
      await reportChannel.send({
        content: `**Eğitim Raporu (1. Aşama Sınav Geçişi)**\n\nPersonel: <@${userId}>\nDeğerlendirici: ${adminName}\nPuan: ${evalResult ? evalResult.score : 'N/A'}\nYeni Durum: 2. Aşama Eğitimi`
      }).catch(() => { });
    }
  } catch (err) {
    logger.error('[ModeratorSchool] passPhase1 error:', err.message);
  }
}

async function passPhase2(userId, adminName, client, evalResult = null) {
  try {
    const user = await client.users.fetch(userId);
    let p = await StaffProgress.findOne({ userId });
    if (!p) return;

    const robloxUser = await User.findOne({ discordId: userId });
    const robloxId = robloxUser ? parseInt(robloxUser.robloxId) : null;

    if (robloxId) {
      await noblox.setRank(SCHOOL_ROBLOX_GROUP, robloxId, 9).catch(() => { });
    }

    p.schoolSystem.status = 'phase2_completed';
    p.schoolSystem.phase = 3;
    p.schoolSystem.step = 0;
    await p.save();

    try {
      const { addNotification } = require('../../utils/notification');
      await addNotification(userId, {
        title: "🎉 2. Aşamayı Geçtiniz!",
        message: `2. Aşama sınavını başarıyla geçtiniz. Sınav Puanı: ${evalResult ? evalResult.score : 'N/A'}`,
        icon: "🎉"
      });
    } catch (nErr) {
      console.error("[ModeratorSchool] passPhase2 notification error:", nErr.message);
    }

    if (user) {
      const embed = new EmbedBuilder()
        .setThumbnail(getSelinImage()).setColor(0xff75a0)
        .setTitle('🎉 2. Aşama Sınavını Başarıyla Geçtin! 🎉')
        .setDescription(
          `Selin: Harika! 2. Aşama Sınavını başarıyla geçtin. 💖\n\n` +
          (evalResult ? `📊 **Sınav Puanın:** \`${evalResult.score}/100\`\n💬 **Selin'in Notu:** ${evalResult.reason}\n\n` : '') +
          `Şimdi okul sunucusunda <#${CHANNELS.UPDATE_ROLES}> kanalına git, **Update Roles** butonuna bas ve rolünün güncellenmesini sağla.\n\n` +
          `Daha sonra Sınav Odası sesli kanalına girerek son aşama sınavını başlatabilirsin! Başarılar dilerim! 💕`
        );
      await user.send({ embeds: [embed] }).catch(() => { });
    }

    // Log to egitim-rapor
    const reportChannel = client.channels.cache.get(CHANNELS.EGITIM_RAPOR);
    if (reportChannel) {
      await reportChannel.send({
        content: `**Eğitim Raporu (2. Aşama Sınav Geçişi)**\n\nPersonel: <@${userId}>\n2. Aşama Sınavını onaylayan yetkili: ${adminName}\nYeni Durum: 3. Aşama Sınavı`
      }).catch(() => { });
    }
  } catch (err) {
    logger.error('[ModeratorSchool] passPhase2 error:', err.message);
  }
}

async function failPhase(userId, phase, adminName, client) {
  try {
    const user = await client.users.fetch(userId);
    let p = await StaffProgress.findOne({ userId });
    if (!p) return;

    // Put them back in school at the training block state for their phase
    p.schoolSystem.status = 'in_school';
    p.schoolSystem.step = 0;
    await p.save();

    if (user) {
      await user.send({
        content: `🌸 Selin: ${phase}. Aşama Sınavını geçemedin maalesef. Lütfen ${phase}. Aşama eğitim dökümanlarını tekrar çalış ve ses kanalına girerek eğitimi/sınavı yeniden dene! Başarılar! 💕`
      }).catch(() => { });
    }
  } catch (err) {
    logger.error('[ModeratorSchool] failPhase error:', err.message);
  }
}

/**
 * Parses and processes requests in #eğitim-istek channel.
 */
async function handleEgitimIstekMessage(message, client) {
  if (message.guildId !== SCHOOL_GUILD_ID || message.channelId !== CHANNELS.EGITIM_ISTEK || message.author.bot) return;

  const content = message.content;
  // Parse format - support both Turkish and English characters
  const matchesName = content.match(/(?:İsim|Isim):\s*(.*)/i);
  const matchesRank = content.match(/(?:Rütbe|Rutbe):\s*(.*)/i);
  const matchesType = content.match(/(?:İstenilen|Istenilen)\s*(?:Eğitim|Egitim):\s*(.*)/i);
  const matchesTime = content.match(/(?:Ne\s*zaman):\s*(.*)/i);

  if (!matchesName || !matchesRank || !matchesType) return; // Doesn't match format

  const type = matchesType[1].trim();
  const time = matchesTime ? matchesTime[1].trim() : 'En kısa zamanda';

  // DM the user asking if they really want this training
  try {
    const embed = new EmbedBuilder()
      .setThumbnail(getSelinImage()).setColor(0xff75a0)
      .setTitle('🌸 Selin:')
      .setDescription(`Merhaba! **${type}** eğitimini talep ettiğini gördüm. Bu aşamalı eğitimi başlatmak ister misin? 💕`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`school_confirm_req_yes_${message.id}_${type.replace(/[\s_]+/g, '-')}_${time.replace(/[\s_]+/g, '-')}`)
        .setLabel('EVET')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('school_confirm_req_no')
        .setLabel('HAYIR')
        .setStyle(ButtonStyle.Danger)
    );

    await message.author.send({ embeds: [embed], components: [row] });
  } catch (err) {
    logger.error(`[ModeratorSchool] Failed to send training request confirmation DM to ${message.author.id}:`, err.message);
  }
}

/**
 * Handles confirmation of training requests.
 */
async function handleTrainingRequestConfirm(interaction, client) {
  try {
    const { customId, user: interactionUser } = interaction;
    const userId = interactionUser.id;
    await interaction.deferUpdate().catch(() => { });

    if (customId === 'school_confirm_req_no') {
      await interaction.editReply({ content: '🌸 Tamam, eğitim talebi iptal edildi! Görüşmek üzere. 💕', embeds: [], components: [] }).catch(() => { });
      return;
    }

    // format: school_confirm_req_yes_msgId_type_time
    const parts = customId.split('_');
    if (parts.length < 7) {
      await interaction.editReply({ content: '❌ Geçersiz buton verisi.', embeds: [], components: [] }).catch(() => { });
      return;
    }
    const type = parts[5].replace(/-/g, ' ');
    const time = parts[6].replace(/-/g, ' ');

    await interaction.editReply({ content: '🌸 Harika! Eğitim talebin onaylandı ve duyuru kanalına gönderildi. Lütfen eğitim saatinde uygun ses kanalında ol! 💕', embeds: [], components: [] }).catch(() => { });

    const isPhase1 = !type.toLowerCase().includes('2') && !type.toLowerCase().includes('ii');

    // Update database status immediately on confirmation
    let p = await StaffProgress.findOne({ userId });
    if (p) {
      if (!p.schoolSystem) p.schoolSystem = { status: 'none', phase: 1, step: 0 };
      p.schoolSystem.phase = isPhase1 ? 1 : 2;
      p.schoolSystem.status = 'in_school';
      p.schoolSystem.step = 0;
      p.schoolSystem.lastActiveAt = new Date();
      await p.save().catch(() => {});
    }

    // Send announcement to egitim-duyuru
    const duyuruChannel = await client.channels.fetch(CHANNELS.EGITIM_DUYURU).catch(() => null);
    if (duyuruChannel) {
      const targetVoice = isPhase1 ? 'Eğitim Sesli 1' : 'Eğitim Sesli 2';
      const tagRole = isPhase1 ? SCHOOL_ROLES.ASAMA_1 : SCHOOL_ROLES.ASAMA_2;

      await duyuruChannel.send({
        content: `**Eğitim Duyurusu** 📢\n\n` +
          `Host: Selin\n` +
          `Eğitim Türü: ${type}\n` +
          `Ne zaman: ${time}\n` +
          `Yer: ${targetVoice}\n` +
          `Link: https://discord.gg/y9q8xhjkFD\n\n` +
          `Tag: <@&${tagRole}>`
      }).catch(() => { });
    }

    // Check if the user is already in the appropriate voice channel in the school server
    const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
    if (schoolGuild) {
      const member = await schoolGuild.members.fetch(userId).catch(() => null);
      if (member && member.voice.channelId) {
        const voiceChannelId = member.voice.channelId;
        const targetVoiceChannelId = isPhase1 ? VOICE_CHANNELS.EGITIM_SESLI_1 : VOICE_CHANNELS.EGITIM_SESLI_2;

        if (voiceChannelId === targetVoiceChannelId) {
          // Join bot to the voice channel immediately
          if (schoolGuild.members.me && schoolGuild.members.me.permissions.has('Connect')) {
            joinSchoolVoice(schoolGuild, voiceChannelId);
          }

          if (!activeTrainings.has(userId)) {
            const user = await client.users.fetch(userId);
            await user.send({ content: '🌸 Selin: Eğitim başladı! Başarılar dilerim. ✨' }).catch(() => { });

            const session = {
              phase: isPhase1 ? 1 : 2,
              step: 0,
              lastMessageId: null
            };
            activeTrainings.set(userId, session);
            await saveTrainingToDB(userId, session).catch(() => {});
            await sendTrainingBlock(userId, client);
          }
        }
      }
    }
  } catch (err) {
    logger.error('[ModeratorSchool] handleTrainingRequestConfirm error:', err);
  }
}

function getActiveTrainings() {
  return activeTrainings;
}

// ─── Otomatik Mezuniyet — Çok Uzun Süre Okulda Kalan Öğrenciler ─────────────
// 14 gün: Uyarı DM gönder
// 21 gün: Otomatik mezun et
const AUTO_GRAD_WARN_DAYS  = 14;  // Uyarı eşiği (gün)
const AUTO_GRAD_FORCE_DAYS = 21;  // Zorla mezuniyet eşiği (gün)

async function autoGraduateOverdueStudents(client) {
  try {
    const now = new Date();

    // Okulda olan tüm aktif öğrencileri çek
    const students = await StaffProgress.find({
      'schoolSystem.status': {
        $in: ['in_school', 'pending_contract',
              'phase1_blocks_completed', 'phase1_exam_submitted', 'phase1_completed',
              'phase2_blocks_completed', 'phase2_exam_submitted', 'phase2_completed',
              'exam_passed']
      }
    });

    let warned = 0;
    let graduated = 0;

    for (const p of students) {
      try {
        // enrolledAt yoksa updatedAt'i referans al (geriye dönük uyumluluk)
        const enrolledAt = p.schoolSystem.enrolledAt || p.updatedAt || p.createdAt;
        if (!enrolledAt) continue;

        const daysInSchool = Math.floor((now - new Date(enrolledAt)) / (1000 * 60 * 60 * 24));

        // ── 21 GÜN → Zorla Mezun Et ──────────────────────────────────────────
        if (daysInSchool >= AUTO_GRAD_FORCE_DAYS) {
          logger.info(`[AutoGrad] ${p.userId} → ${daysInSchool} gün okulda → otomatik mezun ediliyor.`);
          const fakeResult = {
            score: 60,
            reason: `Okula kaydolduğundan bu yana ${daysInSchool} gün geçti. Sistem sizi otomatik olarak mezun etti.`
          };
          await graduateStudent(p.userId, 'Otomatik Sistem', client, fakeResult).catch(() => {});
          graduated++;

          // Mezunlar kanalına sistem notu at
          const mezunlarCh = client.channels.cache.get(CHANNELS.MEZUNLAR);
          if (mezunlarCh) {
            await mezunlarCh.send({
              content:
                `🤖 **Otomatik Mezuniyet**\n` +
                `<@${p.userId}> okulda **${daysInSchool} gün** geçirdiği için sistem tarafından otomatik olarak mezun edildi.\n` +
                `📅 Kayıt: ${new Date(enrolledAt).toLocaleDateString('tr-TR')} → Mezuniyet: ${now.toLocaleDateString('tr-TR')}`
            }).catch(() => {});
          }
          continue; // Uyarıya gerek yok, zaten mezun edildi
        }

        // ── 14 GÜN → Uyarı DM Gönder (sadece bir kez) ───────────────────────
        if (daysInSchool >= AUTO_GRAD_WARN_DAYS && !p.schoolSystem.autoGradWarned) {
          const remaining = AUTO_GRAD_FORCE_DAYS - daysInSchool;
          try {
            const user = await client.users.fetch(p.userId).catch(() => null);
            if (user) {
              const warnEmbed = new EmbedBuilder()
                .setColor(0xff6b35)
                .setTitle('⚠️ Moderatör Okulu — Süre Uyarısı')
                .setThumbnail(getSelinImage())
                .setDescription(
                  `Merhaba! Ben Selin 🌸\n\n` +
                  `Moderatör okuluna kaydolalı **${daysInSchool} gün** oldu. ` +
                  `Eğer **${remaining} gün** içinde okulu tamamlamazsan sistem seni **otomatik olarak mezun edecek**.\n\n` +
                  `> 📌 Okulunu tamamlamak için eğitim kanalına gel ve devam et!\n` +
                  `> 🔗 [Okul Sunucusu](https://discord.gg/y9q8xhjkFD)\n\n` +
                  `Acele et, seni bekliyoruz! 💕`
                )
                .addFields(
                  { name: '📅 Okula Başlama', value: new Date(enrolledAt).toLocaleDateString('tr-TR'), inline: true },
                  { name: '⏳ Kalan Süre', value: `${remaining} gün`, inline: true },
                  { name: '🚨 Son Tarih', value: new Date(new Date(enrolledAt).getTime() + AUTO_GRAD_FORCE_DAYS * 86400000).toLocaleDateString('tr-TR'), inline: true }
                )
                .setFooter({ text: 'Eko Yıldız • Moderatör Okulu Otomatik Sistemi' })
                .setTimestamp();

              await user.send({ embeds: [warnEmbed] }).catch(() => {});
              p.schoolSystem.autoGradWarned = true;
              await p.save().catch(() => {});
              warned++;
              logger.info(`[AutoGrad] ${p.userId} → ${daysInSchool} gün → uyarı DM gönderildi (${remaining} gün kaldı).`);
            }
          } catch (_) {}
        }
      } catch (innerErr) {
        logger.error(`[AutoGrad] Öğrenci işlem hatası (${p.userId}):`, innerErr.message);
      }
    }

    if (warned > 0 || graduated > 0) {
      logger.info(`[AutoGrad] Tamamlandı — ${warned} uyarı, ${graduated} otomatik mezuniyet.`);
    }
  } catch (err) {
    logger.error('[AutoGrad] autoGraduateOverdueStudents hatası:', err.message);
  }
}

/**
 * Generates 5-line AI Religion Oath and presents it to the user with copy-paste requirement
 */
async function sendReligionOathEmbed(userId, client, religionName, interaction = null) {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;

    const { chatWithAI } = require('./aiService');
    const prompt = `Kullanıcının belirttiği inanç/din (${religionName}) esaslarına, kutsal değerlerine ve adalet ilkelerine uygun olarak; moderatörlük görevinde tarafsız, dürüst, kul hakkı yemeyen, doğruluğu savunan ve yetkisini kötüye kullanmayan TAM OLARAK 5 SATIRDAN OLUŞAN kutsal ve ciddi bir moderatörlük yemeni oluştur.\n\n` +
      `KURALLAR:\n` +
      `- Tam olarak 5 satır olmalı.\n` +
      `- Her satır numaralı ve bağımsız bir yemin cümlesi olmalı (1., 2., 3., 4., 5.).\n` +
      `- Asla başlık, giriş mesajı, dipnot veya açıklama ekleme.\n` +
      `- Doğrudan 5 satırlık yemin metnini yaz.`;

    let aiText = await chatWithAI(
      [{ role: 'user', content: prompt }],
      'Sen EkoYıldız Moderatör Okulu Yemin Asistanısın. Türkçe, ciddi ve resmi yemin metinleri hazırlarsın.'
    ).catch(() => '');

    let lines = aiText ? aiText.split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];

    if (lines.length < 5) {
      lines = [
        `1. ${religionName} inancım ve vicdanım üzerine ant içerim ki moderatörlük görevimde asla taraflı davranmayacağım.`,
        `2. Sunucu sakinlerinin haklarını koruyacak, kul hakkına girmeyecek ve adaletle hükmedeceğim.`,
        `3. Yetkilerimi kendi çıkarım veya hırslarım için asla kötüye kullanmayacağım.`,
        `4. Kuralları herkese eşit uygulayacak, doğruluktan ve dürüstlükten ayrılmayacağım.`,
        `5. EkoYıldız ailesine ve moderatörlük yeminime sonuna kadar sadık kalacağıma söz veriyorum.`
      ];
    }

    lines = lines.slice(0, 5);
    const oathText = lines.join('\n');

    let p = await StaffProgress.findOne({ userId });
    if (p) {
      p.schoolSystem = p.schoolSystem || {};
      p.schoolSystem.pendingOathText = oathText;
      p.schoolSystem.pendingOathReligion = religionName;
      await p.save();
    }

    const embed = new EmbedBuilder()
      .setColor(0xd4af37)
      .setTitle(`📜 MODERATÖRLÜK DİNİ YEMİNİ — ${religionName.toUpperCase()}`)
      .setDescription(
        `Yapay zeka tarafından **${religionName}** inancınıza uygun olarak hazırlanan 5 satırlık yemin metniniz aşağıdadır:\n\n` +
        `\`\`\`text\n${oathText}\n\`\`\`\n\n` +
        `⚠️ **ZORUNLU KOPYALA-YAPIŞTIR ONAYI:**\n` +
        `Lütfen yukarıdaki **5 satırlık yemin metnini kopyalayın** ve aşağıdaki **"✍️ Yemini Yapıştır & Onayla"** butonuna tıklayarak açılan alana yapıştırın!`
      )
      .setFooter({ text: 'Eko Yıldız • Moderatör Okulu Yemin Paneli' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('school_rel_paste_btn')
        .setLabel('✍️ Yemini Yapıştır & Onayla')
        .setStyle(ButtonStyle.Success)
    );

    if (interaction && (interaction.deferred || interaction.replied)) {
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    } else {
      await user.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
  } catch (err) {
    logger.error(`[ModeratorSchool] sendReligionOathEmbed error for ${userId}:`, err.message);
  }
}

/**
 * Handles custom religion text input modal submit
 */
async function handleReligionCustomModalSubmit(interaction, client) {
  await interaction.deferUpdate().catch(() => {});
  const customReligion = interaction.fields.getTextInputValue('custom_religion_text') || 'İslam / Evrensel Vicdan';
  await sendReligionOathEmbed(interaction.user.id, client, customReligion, interaction);
}

/**
 * Handles oath copy-paste modal submit
 */
async function handleReligionOathModalSubmit(interaction, client) {
  await interaction.deferUpdate().catch(() => {});
  const userId = interaction.user.id;
  const pastedText = interaction.fields.getTextInputValue('oath_pasted_text') || '';

  const p = await StaffProgress.findOne({ userId });
  const pendingOath = p?.schoolSystem?.pendingOathText || '';

  const cleanPending = pendingOath.replace(/\r/g, '').trim().toLowerCase();
  const cleanPasted = pastedText.replace(/\r/g, '').trim().toLowerCase();

  const pendingLines = cleanPending.split('\n').map(l => l.trim()).filter(Boolean);
  const pastedLines = cleanPasted.split('\n').map(l => l.trim()).filter(Boolean);

  let isMatch = false;
  if (cleanPending === cleanPasted) {
    isMatch = true;
  } else if (pastedLines.length >= 5) {
    let matchCount = 0;
    for (let i = 0; i < Math.min(5, pendingLines.length); i++) {
      if (pastedLines.some(pl => pl.includes(pendingLines[i].substring(0, 15)))) {
        matchCount++;
      }
    }
    if (matchCount >= 3) isMatch = true;
  }

  if (!isMatch && cleanPasted.length < 50) {
    const embedErr = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('⚠️ Yemin Metni Eksik veya Hatalı!')
      .setDescription(
        'Yemin metnini eksik veya hatalı yapıştırdınız.\n\n' +
        'Lütfen size verilen **5 satırlık metni tam kopyalayıp** tekrar **"✍️ Yemini Yapıştır & Onayla"** butonuna tıklayarak yapıştırın.'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('school_rel_paste_btn')
        .setLabel('✍️ Yemini Yapıştır & Onayla (Tekrar Dene)')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.editReply({ embeds: [embedErr], components: [row] }).catch(() => {});
  }

  await completeModSchoolTransfer(userId, client, interaction);
}

/**
 * Completes final transfer to Moderator Okulu after Oath verification
 */
async function completeModSchoolTransfer(userId, client, interaction = null) {
  try {
    const user = await client.users.fetch(userId).catch(() => null);

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🎉 YEMİN ETTİN! MODERATÖRLÜĞE HOŞ GELDİN! 📜✨')
      .setDescription(
        `Kutsal ve vicdani yeminin başarıyla kaydedildi ve kabul edildi!\n\n` +
        `Sözleşmen ve yeminin tamamlandığı için moderatör ekibine transferin gerçekleştiriliyor. Orada Selin ile tanışacaksın!`
      );

    if (interaction && (interaction.deferred || interaction.replied)) {
      await interaction.editReply({ embeds: [welcomeEmbed], components: [] }).catch(() => {});
    } else if (user) {
      await user.send({ embeds: [welcomeEmbed] }).catch(() => {});
    }

    // Backup roles and demote user on Discord
    const mainGuild = client.guilds.cache.get(MAIN_GUILD_ID);
    if (mainGuild) {
      try {
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member) {
          const originalRoles = [...member.roles.cache.keys()].filter(r => r !== mainGuild.roles.everyone.id);

          let p = await StaffProgress.findOne({ userId });
          if (p) {
            p.schoolSystem = p.schoolSystem || {};
            p.schoolSystem.originalRoles = originalRoles;
            p.schoolSystem.originalLevel = p.level;
            p.schoolSystem.oathCompleted = true;
            await p.save();
          }

          // Remove Mod roles and add School roles
          const ROLES_TO_REMOVE = [
            '1518692386836971610', // Personel
            '1518692389169135666', // Moderator
          ];

          try {
            const { ROLES } = require('./staffSystem');
            if (ROLES) {
              for (const roleId of Object.values(ROLES)) {
                ROLES_TO_REMOVE.push(roleId);
              }
            }
          } catch (_) { }

          await member.roles.remove(ROLES_TO_REMOVE).catch(() => { });
          await member.roles.add([MAIN_SCHOOL_ROLES.TRAINEE, MAIN_SCHOOL_ROLES.INFO_ROLE]).catch(() => { });
        }
      } catch (roleErr) {
        logger.error('[ModeratorSchool] Discord role backup/update error:', roleErr.message);
      }
    }

    // Roblox demotion
    try {
      const robloxUser = await User.findOne({ discordId: userId });
      if (robloxUser && robloxUser.robloxId) {
        const robloxId = parseInt(robloxUser.robloxId);
        await noblox.setRank(MOD_ROBLOX_GROUP, robloxId, 1).catch(() => { });
      }
    } catch (rbErr) {
      logger.error('[ModeratorSchool] Roblox demote error:', rbErr.message);
    }

    // Wait 2 seconds and introduce Selin
    setTimeout(async () => {
      try {
        if (!user) return;
        const embed = new EmbedBuilder()
          .setThumbnail(getSelinImage()).setColor(0xff75a0)
          .setTitle('🌸 Selammmm, Tanıştığıma Memnun Oldum! 🌸')
          .setDescription(
            `Ben Selin! ✨ Animeli konuşurum falan filan neyse şimdi moderatör okulu kolay 1 günlük iş hızlıca yaparsın tamammı? 🎀\n\n` +
            `Şimdi aşağıdaki butona tıkla ki moderatör okuluna transferini gerçekleştireyim. Sunucuya katıl ve sonra **KATILDIM** butonuna bas! 💕`
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Okul Sunucusuna Katıl')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.gg/y9q8xhjkFD'),
          new ButtonBuilder()
            .setCustomId('school_joined_school_server')
            .setLabel('KATILDIM')
            .setStyle(ButtonStyle.Success)
        );

        await user.send({ embeds: [embed], components: [row] });

        let p = await StaffProgress.findOne({ userId });
        if (p) {
          p.schoolSystem.status = 'in_school';
          if (!p.schoolSystem.enrolledAt) {
            p.schoolSystem.enrolledAt = new Date();
          }
          await p.save();
        }
      } catch (dmErr) {
        logger.error('[ModeratorSchool] Selin intro DM error:', dmErr.message);
      }
    }, 2000);
  } catch (err) {
    logger.error(`[ModeratorSchool] completeModSchoolTransfer error for ${userId}:`, err.message);
  }
}

module.exports = {
  initializeModeratorSchool,
  sendContractDM,
  handleSchoolButtons,
  handleSchoolVoiceStateUpdate,
  handleSchoolExamReply,
  handleEgitimIstekMessage,
  handleTrainingRequestConfirm,
  getActiveTrainings,
  autoGraduateOverdueStudents,
  graduateStudent,
  passPhase1,
  passPhase2,
  shouldEscalateSchoolKick,
  sendSchoolKickDecisionDM,
  applySchoolKickDecision,
  sendReligionOathEmbed,
  handleReligionCustomModalSubmit,
  handleReligionOathModalSubmit,
  completeModSchoolTransfer,
};

