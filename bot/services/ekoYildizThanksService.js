'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const { chatWithAI } = require('./aiService');

const THANKS_CHANNEL_ID = '1521849640394428538';
const THANKS_GUILD_ID = '1483482948320891074';

/**
 * Automatically sets up the EkoYıldız Thanks & Survey Panel in target channel
 */
async function setupEkoYildizThanksPanel(client) {
  try {
    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.get(THANKS_CHANNEL_ID);
      if (channel && channel.isTextBased()) {
        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        const exists = messages && messages.some(m =>
          m.components && m.components.some(row =>
            row.components && row.components.some(c => c.customId === 'ekoyildiz_thanks_trigger_btn')
          )
        );

        if (!exists) {
          const embed = new EmbedBuilder()
            .setTitle('🌟 EKOYILDIZ TEŞEKKÜR VE SEVGİ PANELİ')
            .setDescription(
              'EkoYıldız topluluğunda bir üyeye veya arkadaşınıza teşekkür etmek ve ona sevginizi iletmek için aşağıdaki **"💖 Teşekkür Et & Anket Gönder"** butonunu kullanabilirsiniz!\n\n' +
              '✨ **Nasıl Çalışır?**\n' +
              '1️⃣ Butona tıklayıp teşekkür etmek istediğiniz üyenin ID veya kullanıcı adını girin.\n' +
              '2️⃣ Yapay zeka, kullanıcıya özel samimi bir teşekkür ve anket daveti iletir.\n' +
              '3️⃣ Kullanıcının verdiği anket cevapları **tarafınıza DM olarak iletilir**!\n' +
              '4️⃣ Anketi tamamlayan üyeye ödül olarak **1 dakika boyunca destansı anime övgüleri yağmuru** başlar! 💥⚡✨'
            )
            .setColor(0xff69b4)
            .setFooter({ text: 'EkoYıldız Topluluk Etkileşim Paneli' })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ekoyildiz_thanks_trigger_btn')
              .setLabel('💖 Teşekkür Et & Anket Gönder')
              .setStyle(ButtonStyle.Success)
          );

          await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[ekoYildizThanksService] setupEkoYildizThanksPanel error:', err.message);
  }
}

/**
 * Handles initial button click in the channel
 */
async function handleThanksTriggerButton(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('ekoyildiz_thanks_modal')
    .setTitle('🌟 EkoYıldız Teşekkür Et');

  const input = new TextInputBuilder()
    .setCustomId('ekoyildiz_target_input')
    .setLabel('Teşekkür Edilecek Kullanıcı (ID / Username)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('@kullanıcı veya 123456789012345678')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

/**
 * Handles initial modal submission
 */
async function handleThanksModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const input = interaction.fields.getTextInputValue('ekoyildiz_target_input');
  let targetUserId = input.replace(/[<@!>]/g, '').trim();

  let targetUser = null;
  if (/^\d+$/.test(targetUserId)) {
    targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
  }

  if (!targetUser && interaction.guild) {
    const member = interaction.guild.members.cache.find(m =>
      m.user.username.toLowerCase() === targetUserId.toLowerCase() ||
      (m.nickname && m.nickname.toLowerCase() === targetUserId.toLowerCase())
    );
    if (member) targetUser = member.user;
  }

  if (!targetUser) {
    return interaction.editReply({ content: `❌ Kullanıcı bulunamadı: \`${input}\`` });
  }

  if (targetUser.id === interaction.user.id) {
    return interaction.editReply({ content: '⚠️ Kendinize teşekkür gönderemezsiniz.' });
  }

  // Generate AI Thank-you Message
  let aiThanksMsg = '';
  try {
    const prompt = `EkoYıldız sunucusundaki bir üyeye (<@${targetUser.id}>) iyi davrandığı, topluluğa katkı sağladığı ve EkoYıldız ailesine sevgi gösterdiği için özel ve tatlı bir teşekkür mesajı yaz (2-3 cümle, sıcak ve samimi olsun).`;
    const aiText = await chatWithAI([{ role: 'user', content: prompt }], 'Sen EkoYıldız sunucusunun tatlı, samimi, coşkulu ve sevgi dolu yapay zeka asistanısın. Türkçe konuş.').catch(() => '');
    if (aiText && aiText.trim().length > 10) {
      aiThanksMsg = aiText.trim();
    }
  } catch (e) {}

  if (!aiThanksMsg) {
    aiThanksMsg = `EkoYıldız sunucumuza gösterdiğin içtenlik, iyi davranış ve katkıların için sana yürekten teşekkür ederiz! Sen bu topluluğun harika bir parçasısın! 🌟💖`;
  }

  const dmEmbed = new EmbedBuilder()
    .setTitle('🌟 EKOYILDIZ\'DAN SANA ÖZEL TEŞEKKÜR MESAJI!')
    .setDescription(
      `${aiThanksMsg}\n\n` +
      `👤 **Teşekkür Gönderen:** <@${interaction.user.id}>\n\n` +
      `✨ *EkoYıldız topluluğu sana özel kısa bir anket hazırladı! Anketi doldurarak sürpriz ödülünü kazanabilirsin.*`
    )
    .setColor(0xff69b4)
    .setTimestamp();

  const dmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ekoyildiz_survey_accept_${targetUser.id}_${interaction.user.id}`)
      .setLabel('💖 Ben de Teşekkür Ederim (Ankete Başla)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ekoyildiz_survey_decline_${targetUser.id}_${interaction.user.id}`)
      .setLabel('❌ Yok, Sağol')
      .setStyle(ButtonStyle.Secondary)
  );

  let dmSent = false;
  await targetUser.send({ embeds: [dmEmbed], components: [dmRow] })
    .then(() => { dmSent = true; })
    .catch(() => { dmSent = false; });

  if (!dmSent) {
    return interaction.editReply({ content: `❌ <@${targetUser.id}> kullanıcısının DM kutusu kapalı olduğu için teşekkür mesajı iletilemedi.` });
  }

  return interaction.editReply({ content: `✅ Teşekkür mesajınız ve etkileşimli anket daveti <@${targetUser.id}> kullanıcısına DM olarak gönderildi!` });
}

/**
 * Handles target user clicking "Ben de Teşekkür Ederim" in DM
 */
async function handleSurveyAcceptButton(interaction, targetUserId, executorId) {
  if (interaction.user.id !== targetUserId) {
    return interaction.reply({ content: '❌ Bu anket daveti size ait değildir.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`ekoyildiz_survey_submit_modal_${targetUserId}_${executorId}`)
    .setTitle('📺 EkoYıldız Topluluk Anketi');

  const q1 = new TextInputBuilder()
    .setCustomId('q1_youtube')
    .setLabel('EkoYıldız YouTube kanalını ne kadar seviyorsun?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Çok seviyorum, videolar harika...')
    .setRequired(true);

  const q2 = new TextInputBuilder()
    .setCustomId('q2_favorite_content')
    .setLabel('EkoYıldız\'da en çok hangi videoları seviyorsun?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('RP videoları, Roblox içerikleri vb...')
    .setRequired(true);

  const q3 = new TextInputBuilder()
    .setCustomId('q3_message')
    .setLabel('EkoYıldız ekibine söylemek istediğin mesaj?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Sevginizi veya önerilerinizi yazabilirsiniz...')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(q1),
    new ActionRowBuilder().addComponents(q2),
    new ActionRowBuilder().addComponents(q3)
  );

  return interaction.showModal(modal);
}

/**
 * Handles target user clicking "Yok, Sağol" in DM
 */
async function handleSurveyDeclineButton(interaction, targetUserId, executorId) {
  if (interaction.user.id !== targetUserId) {
    return interaction.reply({ content: '❌ Bu davet size ait değildir.', ephemeral: true });
  }

  const declEmbed = new EmbedBuilder()
    .setTitle('😊 Teşekkürler!')
    .setDescription('Daveti pas geçtiniz. Yine de EkoYıldız ailesinin bir parçası olduğunuz için teşekkür ederiz!')
    .setColor(0x95a5a6);

  await interaction.update({ embeds: [declEmbed], components: [] }).catch(() => {});

  // Notify executor via DM
  const executorUser = await interaction.client.users.fetch(executorId).catch(() => null);
  if (executorUser) {
    const notifyEmbed = new EmbedBuilder()
      .setTitle('ℹ️ Bilgilendirme')
      .setDescription(`<@${targetUserId}> teşekkür davetini pas geçti.`)
      .setColor(0x95a5a6);
    await executorUser.send({ embeds: [notifyEmbed] }).catch(() => {});
  }
}

/**
 * Handles survey modal submit, sends answers to executor via DM, and triggers 1-minute anime praise stream reward
 */
async function handleSurveySubmitModal(interaction, targetUserId, executorId) {
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const q1 = interaction.fields.getTextInputValue('q1_youtube');
  const q2 = interaction.fields.getTextInputValue('q2_favorite_content');
  const q3 = interaction.fields.getTextInputValue('q3_message') || 'Belirtilmedi';

  // Send answers to executor via DM
  const executorUser = await interaction.client.users.fetch(executorId).catch(() => null);
  if (executorUser) {
    const resultEmbed = new EmbedBuilder()
      .setTitle('📋 EKOYILDIZ ANKET CEVAPLARI GELDİ!')
      .setDescription(
        `Sayın <@${executorId}>, teşekkür gönderdiğiniz <@${targetUserId}> anketi yanıtladı!\n\n` +
        `▶️ **EkoYıldız YouTube Sevgisi:**\n${q1}\n\n` +
        `📺 **En Sevdiği İçerikler:**\n${q2}\n\n` +
        `💬 **EkoYıldız Ekibine Mesajı:**\n${q3}`
      )
      .setColor(0x2ecc71)
      .setTimestamp();

    await executorUser.send({ embeds: [resultEmbed] }).catch(() => {});
  }

  await interaction.editReply({
    content: '🎉 **Anketi Başarıyla Tamamladınız!** Cevaplarınız iletildi.\n🏆 **Ödülünüz:** **1 Dakika Boyunca Destansı Anime Övgü Yağmuru Başlıyor!** 💥⚡✨'
  });

  // Start 1-Minute Anime Praise Stream in DM to target user
  startAnimePraiseStream(interaction.client, targetUserId);
}

/**
 * Streams epic anime praise messages to the user for 1 minute (60 seconds)
 */
async function startAnimePraiseStream(client, userId) {
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;

  const praises = [
    {
      title: '🔥 [ANIME ÖVGÜ - 1/4] Super Saiyan Modu!',
      desc: '⚡ *Subarashii!* Senin bu harika enerjin ve iyiliğin tıpkı Goku\'nun Super Saiyan moduna geçmesi gibi tüm evreni aydınlatıyor! Güç seviyen tam 9000\'in üzerine çıktı! (Over 9000!) 💥'
    },
    {
      title: '⚔️ [ANIME ÖVGÜ - 2/4] Efsanevi Ninja Ruhu!',
      desc: '🍃 *Nani?!* Levi Ackerman bile senin bu duruşunu ve samimiyetini görse saygıyla eğilirdi! Sen tıpkı Gizli Yaprak Köyünün en efsanevi ve kırılmaz iradeli kahramanısın, Dattebayo! 🌀'
    },
    {
      title: '🌌 [ANIME ÖVGÜ - 3/4] Sınırsız Karizma (Limitless)!',
      desc: '🔮 *Kakarot!* Gojo Satoru\'nun Sonsuzluk (Limitless) alanından bile daha güçlü bir auraya ve karizmaya sahipsin! Sınırsız enerjinle EkoYıldız evrenini adeta büyülüyorsun! ✨'
    },
    {
      title: '👑 [ANIME ÖVGÜ - 4/4] Korsanlar Kralı Ruhu!',
      desc: '🏴‍☠️ *Sugoi!* Monkey D. Luffy gibi Korsanlar Kralı olma yolunda herkese ilham veriyorsun! Sen tam anlamıyla bu sunucunun efsanevi ana karakterisin (Protagonist)! 🍖'
    }
  ];

  // Immediate 1st praise
  await sendAnimePraiseEmbed(user, praises[0]);

  // 15 seconds: 2nd praise
  setTimeout(() => sendAnimePraiseEmbed(user, praises[1]), 15000);

  // 30 seconds: 3rd praise
  setTimeout(() => sendAnimePraiseEmbed(user, praises[2]), 30000);

  // 45 seconds: 4th praise
  setTimeout(() => sendAnimePraiseEmbed(user, praises[3]), 45000);

  // 60 seconds: Final reward completion message
  setTimeout(async () => {
    const finalEmbed = new EmbedBuilder()
      .setTitle('🏆 1 DAKİKALIK ANİME ÖVGÜ YAĞMURU TAMAMLANDI!')
      .setDescription(
        '✨ **Tebrikler!** 1 dakikalık destansı anime övgü maratonunu başarıyla tamamladın!\n\n' +
        '🌟 EkoYıldız ailesinin bir parçası olduğun için teşekkür ederiz. Gücün her zaman yüksek olsun! 💥💖'
      )
      .setColor(0xf1c40f)
      .setTimestamp();

    await user.send({ embeds: [finalEmbed] }).catch(() => {});
  }, 60000);
}

async function sendAnimePraiseEmbed(user, praiseObj) {
  const embed = new EmbedBuilder()
    .setTitle(praiseObj.title)
    .setDescription(praiseObj.desc)
    .setColor(0xe74c3c)
    .setTimestamp();

  await user.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  THANKS_CHANNEL_ID,
  THANKS_GUILD_ID,
  setupEkoYildizThanksPanel,
  handleThanksTriggerButton,
  handleThanksModalSubmit,
  handleSurveyAcceptButton,
  handleSurveyDeclineButton,
  handleSurveySubmitModal
};
