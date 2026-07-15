'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const noblox = require('noblox.js');
const StaffProgress = require('../../models/StaffProgress');
const User = require('../../models/User');
const logger = require('../../utils/logger');

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

/**
 * Handles all Moderator School related button interactions.
 */
async function handleSchoolButtons(interaction, client) {
  const { customId, user } = interaction;
  const userId = user.id;

  if (customId === 'school_accept_contract') {
    await interaction.deferUpdate().catch(() => { });

    // 1. Reply to DM
    await interaction.editReply({
      content: ' Tamamdır. Sözleşmeyi kabul ettiğine göre seni moderatör ekibine transfer ediyorum. Orada diğer arkadaşım Selinle tanışacaksın. Ona benden selam gönderirsin.',
      embeds: [], components: []
    }).catch(() => { });

    // 2. Backup roles and demote user on Discord
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
            await p.save();
          }

          // Remove Mod roles and add School roles
          const ROLES_TO_REMOVE = [
            '1518692386836971610', // Personel
            '1518692389169135666', // Moderator
          ];

          // Also remove level-based rank roles from staffSystem
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

    // 3. Roblox demotion
    try {
      const robloxUser = await User.findOne({ discordId: userId });
      if (robloxUser && robloxUser.robloxId) {
        const robloxId = parseInt(robloxUser.robloxId);
        await noblox.setRank(MOD_ROBLOX_GROUP, robloxId, 1).catch(() => { });
      }
    } catch (rbErr) {
      logger.error('[ModeratorSchool] Roblox demote error:', rbErr.message);
    }

    // 4. Wait 2 seconds and introduce Selin
    setTimeout(async () => {
      try {
        const embed = new EmbedBuilder()
          .setColor(0xff75a0)
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
          await p.save();
        }
      } catch (dmErr) {
        logger.error('[ModeratorSchool] Selin intro DM error:', dmErr.message);
      }
    }, 2000);
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
      .setColor(0xff75a0)
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
      .setColor(0xff75a0)
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
        .setColor(0xff75a0)
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
          .setColor(0xff75a0)
          .setTitle('🌸 Roblox Grubumuza Katılma İsteği Gönder! 🌸')
          .setDescription(
            `Selin: Roblox hesabını başarıyla doğruladık (\`${robloxUser.robloxUsername}\`). Ancak henüz Roblox grubumuza katılma isteği göndermemişsin! 💕\n\n` +
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
      .setColor(0xff75a0)
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
      .setColor(0xff75a0)
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

    const isManager = interaction.member.roles.cache.has(SCHOOL_ROLES.ASAMA_3) ||
      interaction.member.roles.cache.has(SCHOOL_ROLES.ADMIN) ||
      interaction.member.permissions.has('Administrator');
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
      .setColor(0xff75a0)
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
            .setColor(0xff75a0)
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
              .setStyle(ButtonStyle.Danger)
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
        .setColor(0xff75a0)
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
        .setColor(0xff75a0)
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
      await user.send({
        content: `🌸 **Soru ${session.questionIndex + 1}:** ${questions[session.questionIndex]}`
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
      if (session.timeout) clearTimeout(session.timeout);
      activeExams.delete(userId);
      await deleteExamFromDB(userId).catch(() => {});

      const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
      if (schoolGuild) {
        leaveSchoolVoice(schoolGuild);
      }

      await user.send({
        content: `🌸 Selin: ${examPhase}. Aşama Sınavını tamamladın! Cevapların Yapay Zeka tarafından değerlendiriliyor, lütfen bekleyin... ⏳`
      }).catch(() => { });

      const qaText = session.answers.map((ans, idx) => `Soru ${idx + 1}: ${questions[idx]}\nCevap: ${ans}`).join('\n\n');

      const systemPrompt = `Sen bir Moderatör Okulu Sınav Değerlendiricisisin. Görevin, bir moderatör adayının sınav sorularına verdiği cevapları analiz etmek, puanlamak ve sınavdan geçip geçmediğine (geçme notu 70) karar vermektir.

Sınav Aşaması: ${examPhase}. Aşama

Sınav Soruları ve Adayın Cevapları:
${qaText}

Değerlendirme Kriterleri:
- Cevaplar mantıklı, kurallara uygun, saygılı ve açıklayıcı olmalıdır.
- Boş bırakılan, anlamsız, çok kısa veya troll cevaplar doğrudan başarısız sayılmalıdır (passed: false, score: 0).
- Adayın moderasyon adımlarını (kanıt toplama, ceza geçmişi kontrolü, rapor yazma) bilip bilmediği, tarafsızlığı ve sabrı ölçülmelidir.

YALNIZCA aşağıdaki JSON formatında yanıt ver. Markdown kod blokları veya JSON dışı hiçbir metin ekleme:
{
  "passed": true,
  "score": 85,
  "reason": "Türkçe değerlendirme ve aday için gelişim önerileri."
}`;

      let evalResult = { passed: false, score: 0, reason: 'AI değerlendirmesi sırasında teknik bir sorun oluştu.' };

      try {
        const { chatWithAI } = require('./aiService');
        const response = await chatWithAI(`Adayın Cevapları:\n${qaText}`, systemPrompt, 'ticket', { max_tokens: 1000, temperature: 0.1 });
        let cleanJson = response.trim();
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
        const parsed = JSON.parse(cleanJson);
        if (parsed && parsed.score !== undefined) {
          evalResult = parsed;
        }
      } catch (aiErr) {
        logger.error('[ModeratorSchool] Sınav AI değerlendirme hatası:', aiErr.message);
      }

      let p = await StaffProgress.findOne({ userId });
      if (p) {
        p.schoolSystem.examAnswers = session.answers;
        p.schoolSystem.examScore = evalResult.score;
        p.schoolSystem.examFeedback = evalResult.reason;
        await p.save();
      }

      const reportChannel = client.channels.cache.get(CHANNELS.SINAV_RAPOR);
      if (reportChannel) {
        const embed = new EmbedBuilder()
          .setColor(evalResult.passed ? 0x2ecc71 : 0xe74c3c)
          .setTitle(`🤖 AI Sınav Değerlendirmesi (${examPhase}. Aşama)`)
          .setDescription(
            `**Aday:** <@${userId}>\n` +
            `**Aşama:** ${examPhase}. Aşama\n` +
            `**Skor:** \`${evalResult.score}/100\`\n` +
            `**Durum:** ${evalResult.passed ? '🟢 **GEÇTİ**' : '🔴 **KALDI**'}\n\n` +
            `📝 **AI Değerlendirmesi:**\n${evalResult.reason}\n\n` +
            `**Adayın Cevapları:**\n` +
            session.answers.map((ans, idx) => `**Soru ${idx + 1}:** ${questions[idx]}\n**Cevap:** ${ans}\n`).join('\n')
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
          content: `📊 **Sınav Raporu (${examPhase}. Aşama) - AI Değerlendirmesi**\n\nTag: <@&${SCHOOL_ROLES.ASAMA_2}> & <@&${SCHOOL_ROLES.ASAMA_3}>`,
          embeds: [embed],
          components: [row]
        }).catch(() => { });
      }

      if (evalResult.passed) {
        if (examPhase === 1) {
          await passPhase1(userId, 'Yapay Zeka (Selin)', client, evalResult);
        } else if (examPhase === 2) {
          await passPhase2(userId, 'Yapay Zeka (Selin)', client, evalResult);
        } else {
          await graduateStudent(userId, 'Yapay Zeka (Selin)', client, evalResult);
        }
      } else {
        await failPhase(userId, examPhase, 'Yapay Zeka (Selin)', client, evalResult);
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
        .setColor(0xff75a0)
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

    if (user) {
      const embed = new EmbedBuilder()
        .setColor(0xff75a0)
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

    if (user) {
      const embed = new EmbedBuilder()
        .setColor(0xff75a0)
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
      .setColor(0xff75a0)
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

    const isPhase1 = type.toLowerCase().includes('1') || (type.toLowerCase().includes('i') && !type.toLowerCase().includes('ii'));

    // Update database status immediately on confirmation
    let p = await StaffProgress.findOne({ userId });
    if (p) {
      if (!p.schoolSystem) p.schoolSystem = { status: 'none', phase: 1, step: 0 };
      p.schoolSystem.phase = isPhase1 ? 1 : 2;
      p.schoolSystem.status = 'in_school';
      p.schoolSystem.step = 0;
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

module.exports = {
  initializeModeratorSchool,
  sendContractDM,
  handleSchoolButtons,
  handleSchoolVoiceStateUpdate,
  handleSchoolExamReply,
  handleEgitimIstekMessage,
  handleTrainingRequestConfirm,
};
