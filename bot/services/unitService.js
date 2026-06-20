'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const StaffUnit = require('../../models/StaffUnit');
const UnitRecruitment = require('../../models/UnitRecruitment');
const StaffProgress = require('../../models/StaffProgress');
const { chatWithAI } = require('./aiService');

const MAIN_GUILD_ID = '1367646464804655104';
const INTRODUCTION_CHANNEL_ID = '1517931237480861868';
const UPPER_ROLE_ID = '1517929818715455700'; // Üst sınır
const LOWER_ROLE_ID = '1467077860240916534'; // Alt sınır

const UNIT_CONFIG = {
  BAN_BIRIMI: {
    label: 'BAN BİRİMİ',
    color: '#e74c3c', // Kırmızı
    icon: '🛡️',
    description: 'Sunucu güvenliği, ceza işlemlerinin denetlenmesi ve ticket destek süreçlerinin yönetilmesinden sorumludur.',
    tasks: 'Bugün en az 2 ticket çöz ve 2 moderasyon işlemi gerçekleştir.'
  },
  SES_BIRIMI: {
    label: 'SES BİRİMİ',
    color: '#3498db', // Mavi
    icon: '🎤',
    description: 'Sesli kanallardaki aktifliğin izlenmesi, sesli moderasyon kurallarının uygulanması ve sesli etkinliklerden sorumludur.',
    tasks: 'Bugün en az 45 dakika sesli kanallarda aktif kal.'
  },
  SOHBET_BIRIMI: {
    label: 'SOHBET BİRİMİ',
    color: '#2ecc71', // Yeşil
    icon: '💬',
    description: 'Yazılı sohbet kanallarının canlı tutulması, yeni gelen üyelere rehberlik edilmesi ve sohbet düzeninden sorumludur.',
    tasks: 'Bugün sohbete en az 25 mesaj gönder.'
  }
};

const CHOSEN_TASKS = {
  'task_chat': '💬 Aktif Sohbetçi: Sohbette en az 15 mesaj gönder.',
  'task_voice': '🎤 Ses Meraklısı: Ses kanallarında fazladan 15 dakika geçir.',
  'task_ticket': '🎫 Destekçi: Bugün en az 1 ticket çöz.',
  'task_mod': '🛡️ Koruyucu: Bugün en az 1 moderasyon işlemi gerçekleştir.'
};

/**
 * Birimin ana ve rütbe rollerinin varlığından ve hiyerarşik yerinden emin olur.
 * @param {import('discord.js').Guild} guild 
 * @param {string} birimKey 
 */
async function ensureUnitRoles(guild, birimKey) {
  const config = UNIT_CONFIG[birimKey];
  if (!config) return null;

  const upperRole = guild.roles.cache.get(UPPER_ROLE_ID);
  const lowerRole = guild.roles.cache.get(LOWER_ROLE_ID);
  const targetPosition = lowerRole ? lowerRole.position + 1 : 1;

  // 1) Ana Birim Rolü
  let mainRole = guild.roles.cache.find(r => r.name === config.label);
  if (!mainRole) {
    mainRole = await guild.roles.create({
      name: config.label,
      color: config.color,
      reason: `${config.label} Ana Rolü oluşturuldu.`
    });
    if (lowerRole) {
      await mainRole.setPosition(targetPosition).catch(() => {});
    }
  }

  // 2) 15 Adet Rütbe Rolü
  const rankRoleIds = [];
  for (let rank = 1; rank <= 15; rank++) {
    const roleName = `${config.label} - Rütbe ${rank}`;
    let rankRole = guild.roles.cache.find(r => r.name === roleName);
    if (!rankRole) {
      rankRole = await guild.roles.create({
        name: roleName,
        color: '#95a5a6', // Gri renk
        reason: `${roleName} rolü oluşturuldu.`
      });
      if (lowerRole) {
        await rankRole.setPosition(targetPosition).catch(() => {});
      }
    }
    rankRoleIds[rank] = rankRole.id;
  }

  return {
    mainRoleId: mainRole.id,
    rankRoleIds: rankRoleIds
  };
}

/**
 * Birim tanıtımlarını ilgili tanıtım kanalına atar.
 */
async function postUnitIntroductions(client) {
  try {
    const guild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
    if (!guild) return console.warn(`[unitService] Ana sunucu bulunamadı: ${MAIN_GUILD_ID}`);

    const channel = await guild.channels.fetch(INTRODUCTION_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return console.warn(`[unitService] Tanıtım kanalı bulunamadı: ${INTRODUCTION_CHANNEL_ID}`);

    // Eski mesajları temizle (isteğe bağlı, kanalı temiz tutup sadece tanıtım bırakmak için)
    await channel.bulkDelete(100).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0x34495e)
      .setTitle('🏛️ EkoYıldız Birimleri & Çalışma Esasları')
      .setDescription(
        'EkoYıldız bünyesinde yer alan uzmanlaşmış birimler ve bu birimlerin ayrıcalıkları aşağıda listelenmiştir. ' +
        'Her birimin kendine özgü yetki ve görev tanımları bulunmaktadır.'
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    for (const [key, config] of Object.entries(UNIT_CONFIG)) {
      const unitEmbed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`${config.icon} ${config.label}`)
        .setDescription(
          `**Açıklama:**\n${config.description}\n\n` +
          `🔒 **Birim Yetkileri & Ayrıcalıkları:**\n` +
          `- **${config.label}** üyelerine özel rol ve rütbe hiyerarşisi.\n` +
          `- Günlük brifinglerine eklenen özel birim görevleri ve **%25 ekstra terfi katkısı** fırsatları.\n` +
          `- 15 kademeli rütbe ilerlemesi. En yüksek rütbedekiler (Rütbe 13-15) alt rütbeleri denetleme ve terfi ettirme yetkisine sahiptir.\n\n` +
          `📋 **Birim Günlük Görevi:**\n*${config.tasks}*`
        )
        .setFooter({ text: `EkoYıldız Birim Tanıtım Sistemi` });

      await channel.send({ embeds: [unitEmbed] });
    }

    console.log('[unitService] Birim tanıtım mesajları başarıyla gönderildi.');
  } catch (err) {
    console.error('[unitService] postUnitIntroductions hatası:', err.message);
  }
}

/**
 * Yönetici komutuyla birim alım duyurusu başlatır.
 */
async function startBirimAlimi(interaction, client, birimKey) {
  try {
    const config = UNIT_CONFIG[birimKey];
    if (!config) {
      return interaction.editReply({ content: '❌ Geçersiz birim seçimi yapıldı.' });
    }

    // AI ile sınav soruları ve ipuçları üret
    const systemPrompt = "Sen bir JSON üretecisin. Sadece geçerli JSON döndür, açıklama veya ek yazı yazma.";
    const userPrompt = `Lütfen ${config.label} (Görevleri: ${config.tasks}) için 10 adet çoktan seçmeli sınav sorusu ve bir adet sınav hazırlık ipucu ("tips") oluştur.
Sorular birimin alanıyla doğrudan ilişkili olmalıdır (Ban birimi için moderasyon kuralları ve adalet, Ses birimi için ses aktifliği ve ses odaları düzeni, Sohbet birimi sohbette üslup ve aktiflik).
Her sorunun formatı: {"question": "soru", "options": ["A şıkkı", "B şıkkı", "C şıkkı", "D şıkkı"], "correct": 0}.
Doğru şıkkın index'i 0-3 arası olmalıdır.
Format: {"tips": "ipuçları...", "questions": [{"question": "...", "options": [...], "correct": 0}]}`;

    let aiContent = "";
    let parsedData = null;

    try {
      aiContent = await chatWithAI([{ role: 'user', content: userPrompt }], systemPrompt);
      const match = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || aiContent.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = match ? match[1] : aiContent;
      parsedData = JSON.parse(jsonStr.trim());
    } catch (aiErr) {
      console.error('❌ AI Sınav Sorusu oluşturma hatası:', aiErr.message);
      // Fallback soruları
      parsedData = {
        tips: "Sınavda sakin kalın, soruları dikkatli okuyun ve birimin sorumluluk alanlarına odaklanın.",
        questions: Array.from({ length: 10 }, (_, i) => ({
          question: `${config.label} bünyesinde ${i + 1}. sorumluluk kuralı nedir?`,
          options: ["Doğru Seçenek A", "Yanlış Seçenek B", "Yanlış Seçenek C", "Yanlış Seçenek D"],
          correct: 0
        }))
      };
    }

    const today = new Date();
    const announcementDate = new Date(today);
    
    // Alım yarın sabah 09:00'da başlayıp, akşam 21:00'da sonlanacak.
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(9, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(21, 0, 0, 0);

    // Veritabanına kaydet
    const recruitment = new UnitRecruitment({
      guildId: interaction.guildId,
      channelId: '1466939999571279994',
      birim: birimKey,
      announcementDate,
      startDate,
      endDate,
      examTips: parsedData.tips,
      examQuestions: parsedData.questions
    });

    await recruitment.save();

    // Roller oluşturulmuş mu kontrol et ve oluştur/yerleştir
    const targetGuild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
    if (targetGuild) {
      await ensureUnitRoles(targetGuild, birimKey);
    }

    // Duyuru kanalını bul ve gönder
    const channel = await client.channels.fetch('1466939999571279994').catch(() => null);
    if (channel && channel.isTextBased()) {
      const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
      const dateStr = `${startDate.getDate()} ${months[startDate.getMonth()]}`;

      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`📢 ÖNEMLİ DUYURU: ${config.label} Alımları Başlıyor!`)
        .setDescription(
          `Değerli EkoYıldız Üyeleri,\n\n` +
          `**${config.label}** kadrolarımızı güçlendirmek amacıyla alım süreci başlatılmıştır! Sınavı başarıyla geçenler birime katılabilecektir.\n\n` +
          `📅 **Alım Takvimi:**\n` +
          `- **Başlangıç:** ${dateStr} Sabahı 09:00\n` +
          `- **Son Katılım:** ${dateStr} Akşamı 21:00\n` +
          `- **Sonuçların Açıklanması:** ${dateStr} Akşamı (Değerlendirme bitiminde)\n\n` +
          `🎯 **Yapay Zeka Sınav İpuçları (Tavsiye):**\n` +
          `*"${parsedData.tips}"*\n\n` +
          `Aşağıdaki **Başvur** butonuna tıklayarak sınavınızı DM kutunuz üzerinden hemen başlatabilirsiniz. Sınavdan en az **8 doğru** yapmanız gerekmektedir. Başarılar dileriz! 🚀`
        )
        .setFooter({ text: 'EkoYıldız Yapay Zeka Sınav ve Birim Alım Sistemi' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apply_unit_${recruitment._id}`)
          .setLabel('📥 Başvur')
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ content: '@everyone', embeds: [embed], components: [row] });
      await interaction.editReply({ content: `✅ **Birim alım duyurusu başarıyla oluşturuldu!** Duyuru kanalına gönderildi.` });
    } else {
      await interaction.editReply({ content: `❌ Duyuru kanalı bulunamadı veya metin kanalı değil.` });
    }
  } catch (err) {
    console.error('[unitService] startBirimAlimi hatası:', err.message);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ Duyuru gönderilirken bir hata oluştu: ${err.message}`, ephemeral: true });
    } else {
      await interaction.editReply({ content: `❌ Duyuru gönderilirken bir hata oluştu: ${err.message}` });
    }
  }
}

/**
 * Aday başvuru butonuna bastığında sınav sürecini başlatır.
 */
async function handleApplyClick(interaction, recruitmentId) {
  try {
    const recruitment = await UnitRecruitment.findById(recruitmentId);
    if (!recruitment) {
      return interaction.reply({ content: '❌ Alım süreci kaydı bulunamadı.', ephemeral: true });
    }

    const now = new Date();
    if (now < recruitment.startDate) {
      return interaction.reply({ content: '⚠️ Alımlar henüz başlamadı! Başvuru süreci yarın sabah 09:00\'da başlayacaktır.', ephemeral: true });
    }
    if (now > recruitment.endDate) {
      return interaction.reply({ content: '❌ Bu alım süreci sona ermiştir.', ephemeral: true });
    }

    // Kullanıcının halihazırda bir birimde olup olmadığını kontrol et
    let userUnit = await StaffUnit.findOne({ userId: interaction.user.id });
    if (userUnit && userUnit.unitName) {
      return interaction.reply({ content: '❌ Zaten aktif bir birime üyesiniz! Başka bir birime katılamazsınız.', ephemeral: true });
    }

    if (!userUnit) {
      userUnit = new StaffUnit({ userId: interaction.user.id });
    }

    // Sınav durumunu güncelle
    userUnit.exam = {
      status: 'ongoing',
      unit: recruitment.birim,
      questions: recruitment.examQuestions,
      currentIndex: 0,
      answers: [],
      startedAt: now
    };

    await userUnit.save();

    await interaction.reply({ content: '📬 Sınavınız DM kutunuza gönderildi! Lütfen DM kutunuzu kontrol edin.', ephemeral: true });
    
    // DM'den ilk soruyu gönder
    const client = interaction.client;
    await sendExamQuestion(client, interaction.user.id, userUnit);
  } catch (err) {
    console.error('[unitService] handleApplyClick hatası:', err.message);
    await interaction.reply({ content: '❌ Başvuru işlemi başlatılırken hata oluştu.', ephemeral: true });
  }
}

/**
 * DM'den sınav sorusu gönderir.
 */
async function sendExamQuestion(client, userId, userUnit) {
  try {
    const user = await client.users.fetch(userId);
    const exam = userUnit.exam;
    const qIndex = exam.currentIndex;
    const question = exam.questions[qIndex];

    if (!question) return;

    const embed = new EmbedBuilder()
      .setColor(UNIT_CONFIG[exam.unit]?.color || '#f39c12')
      .setTitle(`🎓 ${UNIT_CONFIG[exam.unit]?.label} Giriş Sınavı (Soru: ${qIndex + 1}/10)`)
      .setDescription(`**Soru:**\n${question.question}`)
      .setFooter({ text: 'Şıklardan birini seçmek için aşağıdaki butonları kullanın.' })
      .setTimestamp();

    const row = new ActionRowBuilder();
    const optionsLetters = ['A', 'B', 'C', 'D'];
    question.options.forEach((opt, idx) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`unit_exam_ans_${qIndex}_${idx}`)
          .setLabel(`${optionsLetters[idx]}: ${opt.slice(0, 70)}`)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    await user.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[unitService] sendExamQuestion hatası:', err.message);
  }
}

/**
 * Aday sınav sorularını cevapladığında tetiklenir.
 */
async function handleAnswerClick(interaction, qIndex, optIndex) {
  try {
    const userId = interaction.user.id;
    const userUnit = await StaffUnit.findOne({ userId });

    if (!userUnit || userUnit.exam.status !== 'ongoing' || userUnit.exam.currentIndex !== parseInt(qIndex)) {
      return interaction.reply({ content: '❌ Sınav oturumunuz aktif değil veya bu soruyu zaten cevapladınız.', ephemeral: true });
    }

    // Cevabı kaydet
    userUnit.exam.answers.push(parseInt(optIndex));
    userUnit.exam.currentIndex += 1;

    await interaction.deferUpdate().catch(() => {});

    if (userUnit.exam.currentIndex < userUnit.exam.questions.length) {
      // Bir sonraki soruyu gönder
      await userUnit.save();
      await sendExamQuestion(interaction.client, userId, userUnit);
    } else {
      // Sınav bitti, değerlendir
      let score = 0;
      userUnit.exam.questions.forEach((q, idx) => {
        if (userUnit.exam.answers[idx] === q.correct) {
          score += 1;
        }
      });

      const passed = score >= 8;
      userUnit.exam.status = passed ? 'passed' : 'failed';

      if (passed) {
        // Birime kabul et
        const birimKey = userUnit.exam.unit;
        userUnit.unitName = birimKey;
        userUnit.joinedAt = new Date();

        // Skora göre başlangıç rütbesi ver
        let startingRank = 1;
        if (score === 10) startingRank = 3; // Sınavda çok emek verenler
        else if (score === 9) startingRank = 2;
        userUnit.rank = startingRank;

        await userUnit.save();

        // Rolleri ver
        const guild = await interaction.client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
        if (guild) {
          const rolesData = await ensureUnitRoles(guild, birimKey);
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member && rolesData) {
            // Ana rolü ekle
            await member.roles.add(rolesData.mainRoleId).catch(() => {});
            // Rütbe rolünü ekle
            const targetRankRole = rolesData.rankRoleIds[startingRank];
            if (targetRankRole) {
              await member.roles.add(targetRankRole).catch(() => {});
            }
          }
        }

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`🎉 TEBRİKLER! Sınavı Geçtiniz!`)
          .setDescription(
            `Harika bir başarı! **${UNIT_CONFIG[birimKey]?.label}** sınavından **${score}/10** puan alarak başarılı oldunuz!\n\n` +
            `**Atandığınız Rütbe:** Rütbe ${startingRank}\n` +
            `Gerekli yetki ve rütbe rolleriniz ana sunucuda hesabınıza tanımlanmıştır. Biriminizde başarılar dileriz! 🚀`
          )
          .setFooter({ text: 'EkoYıldız Birim Yönetim Sistemi' })
          .setTimestamp();

        await interaction.user.send({ embeds: [embed] }).catch(() => {});
      } else {
        await userUnit.save();
        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`❌ Sınav Sonucu: Başarısız`)
          .setDescription(
            `Sınavı tamamladınız ancak **${score}/10** doğru yaparak geçiş barajını (8 doğru) aşamadınız.\n\n` +
            `Sağlık olsun! Kendinizi geliştirip bir sonraki alım döneminde tekrar başvurabilirsiniz. Çalışmalarınızda başarılar dileriz!`
          )
          .setFooter({ text: 'EkoYıldız Birim Yönetim Sistemi' })
          .setTimestamp();

        await interaction.user.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[unitService] handleAnswerClick hatası:', err.message);
  }
}

/**
 * Birimden istifa etme eylemini gerçekleştirir.
 */
async function handleBirimIstifa(interaction) {
  try {
    const userId = interaction.user.id;
    const userUnit = await StaffUnit.findOne({ userId });

    if (!userUnit || !userUnit.unitName) {
      return interaction.editReply({ content: '❌ Zaten herhangi bir birimde kayıtlı değilsiniz.' });
    }

    const oldBirim = userUnit.unitName;
    const oldRank = userUnit.rank;

    // Rolleri temizle
    const guild = await interaction.client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        // Ana birim rolünü bul ve kaldır
        const config = UNIT_CONFIG[oldBirim];
        if (config) {
          const mainRole = guild.roles.cache.find(r => r.name === config.label);
          if (mainRole) await member.roles.remove(mainRole.id).catch(() => {});

          // Tüm 1-15 rütbe rollerini temizle
          for (let rank = 1; rank <= 15; rank++) {
            const roleName = `${config.label} - Rütbe ${rank}`;
            const rankRole = guild.roles.cache.find(r => r.name === roleName);
            if (rankRole && member.roles.cache.has(rankRole.id)) {
              await member.roles.remove(rankRole.id).catch(() => {});
            }
          }
        }
      }
    }

    // DB sıfırla
    userUnit.unitName = null;
    userUnit.rank = 0;
    userUnit.joinedAt = null;
    userUnit.dailyTasksCompleted = 0;
    userUnit.exam = { status: 'none', unit: null, questions: [], currentIndex: 0, answers: [], startedAt: null };

    await userUnit.save();

    await interaction.editReply({
      content: `🚪 **${UNIT_CONFIG[oldBirim]?.label}** birimindeki (Rütbe ${oldRank}) görevinizden başarıyla **istifa ettiniz**. Rolleriniz temizlendi.`
    });
  } catch (err) {
    console.error('[unitService] handleBirimIstifa hatası:', err.message);
    await interaction.editReply({ content: `❌ İstifa işlemi sırasında hata oluştu: ${err.message}` });
  }
}

/**
 * Üst rütbedekilerin (13-15) alt rütbedekileri terfi ettirmesini sağlar.
 */
async function handleBirimTerfi(interaction) {
  try {
    const executorId = interaction.user.id;
    const targetUser = interaction.options.getUser('kullanici');

    const execUnit = await StaffUnit.findOne({ userId: executorId });
    if (!execUnit || !execUnit.unitName || execUnit.rank < 13) {
      return interaction.editReply({ content: '❌ Bu komutu kullanabilmek için kendi biriminizde en az **Rütbe 13** üst yetkili olmalısınız!' });
    }

    const targetUnit = await StaffUnit.findOne({ userId: targetUser.id });
    if (!targetUnit || targetUnit.unitName !== execUnit.unitName) {
      return interaction.editReply({ content: '❌ Terfi ettirmek istediğiniz kullanıcı sizinle aynı birimde bulunmuyor.' });
    }

    if (targetUnit.rank >= execUnit.rank) {
      return interaction.editReply({ content: '❌ Sizden yüksek veya sizinle eşit rütbedeki bir yetkiliyi terfi ettiremezsiniz.' });
    }

    const oldRank = targetUnit.rank;
    const newRank = oldRank + 1;

    if (newRank > 15) {
      return interaction.editReply({ content: '❌ Bu personel zaten en yüksek rütbede (Rütbe 15) bulunuyor.' });
    }

    targetUnit.rank = newRank;
    await targetUnit.save();

    // Rolleri güncelle
    const guild = await interaction.client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
    if (guild) {
      const config = UNIT_CONFIG[execUnit.unitName];
      if (config) {
        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        if (member) {
          // Eski rütbe rolünü kaldır
          const oldRoleName = `${config.label} - Rütbe ${oldRank}`;
          const oldRole = guild.roles.cache.find(r => r.name === oldRoleName);
          if (oldRole) await member.roles.remove(oldRole.id).catch(() => {});

          // Yeni rütbe rolünü ver
          const rolesData = await ensureUnitRoles(guild, execUnit.unitName);
          if (rolesData) {
            const targetRankRole = rolesData.rankRoleIds[newRank];
            if (targetRankRole) {
              await member.roles.add(targetRankRole).catch(() => {});
            }
          }
        }
      }
    }

    await interaction.editReply({
      content: `🎉 **Terfi Başarılı!** <@${targetUser.id}> personeli **${UNIT_CONFIG[execUnit.unitName]?.label}** biriminde **Rütbe ${oldRank}** → **Rütbe ${newRank}** seviyesine yükseltildi!`
    });

    // DM ile hedef üyeye duyur
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('📈 Birim Rütbe Yükselmesi (Terfi)!')
        .setDescription(
          `Tebrikler <@${targetUser.id}>,\n\n` +
          `**${UNIT_CONFIG[execUnit.unitName]?.label}** üst yetkilileri tarafından gösterdiğiniz gayretler incelendi ve **Rütbe ${newRank}** seviyesine terfi edildiniz! 🎉`
        )
        .setFooter({ text: 'EkoYıldız Birim Yönetim Sistemi' })
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (_) {}
  } catch (err) {
    console.error('[unitService] handleBirimTerfi hatası:', err.message);
    await interaction.editReply({ content: `❌ Terfi işlemi sırasında bir hata oluştu: ${err.message}` });
  }
}

/**
 * Personel büyük görevler tamamladığında otomatik rütbe almasını sağlar (Limit: Rütbe 12).
 */
async function checkAutoPromotion(userId, client, activityType) {
  try {
    const userUnit = await StaffUnit.findOne({ userId });
    if (!userUnit || !userUnit.unitName || userUnit.rank >= 12) return;

    const progress = await StaffProgress.findOne({ userId });
    if (!progress) return;

    let qualifies = false;
    let taskName = "";

    const today = new Date().toISOString().split('T')[0];
    if (progress.daily.date !== today) return; // Sadece bugünün verileriyle çalışır

    if (activityType === 'ticket' && userUnit.unitName === 'BAN_BIRIMI' && (progress.daily.ticketsSolvedToday || 0) >= 5) {
      qualifies = true;
      taskName = "Günde 5+ Ticket Çözmek";
    } else if (activityType === 'chat' && userUnit.unitName === 'SOHBET_BIRIMI' && (progress.daily.chatMessagesToday || 0) >= 100) {
      qualifies = true;
      taskName = "Günde 100+ Sohbet Mesajı Göndermek";
    } else if (activityType === 'voice' && userUnit.unitName === 'SES_BIRIMI' && (progress.daily.voiceMinutes || 0) >= 120) {
      qualifies = true;
      taskName = "Günde 120+ Dakika Sesli Kanalda Kalmak";
    }

    if (qualifies) {
      // Bugün bu görevin ödülünü zaten alıp almadığını kontrol etmek için geçici bir kontrol uygulayabiliriz
      // Veya rütbe artırıp anlık save ederiz. Tekrarlamayı engellemek için daily.chosenTaskCompleted gibi bir mantık kurabiliriz.
      // Ama burada rütbe doğrudan artıyor. Kaydı kontrol etmek için o günkü rütbe artışını db'de loglayabiliriz.
      // Ya da basitçe: "Eğer o günkü hedefe ulaşıldığı an rütbe artmışsa bir daha artmasın"
      // Bunu önlemek için userUnit.lastAutoPromoDate === today kontrolü ekleyelim!
      if (userUnit.lastAutoPromoDate === today) return;

      const oldRank = userUnit.rank;
      const newRank = oldRank + 1;

      userUnit.rank = newRank;
      userUnit.lastAutoPromoDate = today;
      await userUnit.save();

      // Rolleri güncelle
      const guild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
      if (guild) {
        const config = UNIT_CONFIG[userUnit.unitName];
        if (config) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            // Eski rütbe rolünü kaldır
            const oldRoleName = `${config.label} - Rütbe ${oldRank}`;
            const oldRole = guild.roles.cache.find(r => r.name === oldRoleName);
            if (oldRole) await member.roles.remove(oldRole.id).catch(() => {});

            // Yeni rütbe rolünü ver
            const rolesData = await ensureUnitRoles(guild, userUnit.unitName);
            if (rolesData) {
              const targetRankRole = rolesData.rankRoleIds[newRank];
              if (targetRankRole) {
                await member.roles.add(targetRankRole).catch(() => {});
              }
            }
          }
        }
      }

      // DM tebrik gönder
      try {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (discordUser) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('⚡ OLAĞANÜSTÜ BAŞARI: Otomatik Rütbe Artışı!')
            .setDescription(
              `Tebrikler <@${userId}>,\n\n` +
              `Bugün gerçekleştirdiğin devasa çalışma olan **"${taskName}"** sayesinde **${UNIT_CONFIG[userUnit.unitName]?.label}** rütben sistem tarafından otomatik olarak yükseltildi!\n\n` +
              `**Yeni Rütben:** Rütbe ${newRank} 🎉`
            )
            .setFooter({ text: 'EkoYıldız Birim Yönetim Sistemi' })
            .setTimestamp();
          await discordUser.send({ embeds: [dmEmbed] }).catch(() => {});
        }
      } catch (_) {}
    }
  } catch (err) {
    console.error('[unitService] checkAutoPromotion hatası:', err.message);
  }
}

module.exports = {
  CHOSEN_TASKS,
  UNIT_CONFIG,
  ensureUnitRoles,
  postUnitIntroductions,
  startBirimAlimi,
  handleApplyClick,
  handleAnswerClick,
  handleBirimIstifa,
  handleBirimTerfi,
  checkAutoPromotion
};
