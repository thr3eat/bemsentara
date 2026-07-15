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

const EXAM_QUESTIONS = [
  "Neden Eko & Yıldız Moderatörü Olmak İstiyorsun? 🌸",
  "Eko & Yıldız Moderatörü olmanın asıl amacı ne? 🌸",
  "Eko & Yıldız Moderatörü olduktan sonra ne yapacaksın? 🌸",
  "Eko & Yıldız Moderatörü olmak nasıl bir his senin için? 🌸"
];

// Active sessions in memory
const activeTrainings = new Map(); // userId -> { phase, step, timeout, lastMessageId }
const activeExams = new Map();      // userId -> { questionIndex, answers[] }

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

    const robloxUser = await User.findOne({ discordId: userId });
    if (!robloxUser || !robloxUser.robloxId) {
      await interaction.followUp({ content: '❌ Roblox hesabın bot ile eşleştirilmemiş. Lütfen önce profil ayarlarından Roblox hesabını doğrula!', ephemeral: true }).catch(() => { });
      return;
    }

    const robloxId = parseInt(robloxUser.robloxId);
    const rankNum = await noblox.getRankInGroup(SCHOOL_ROBLOX_GROUP, robloxId).catch(() => 0);

    if (rankNum === 0) {
      // Try accepting join request
      try {
        await noblox.handleJoinRequest(SCHOOL_ROBLOX_GROUP, robloxId, true).catch(() => { });
      } catch (_) { }

      const rankRetry = await noblox.getRankInGroup(SCHOOL_ROBLOX_GROUP, robloxId).catch(() => 0);
      if (rankRetry === 0) {
        await user.send({
          content: '🌸 Roblox grubumuza henüz katılmamışsın ya da isteğin beklemede. Lütfen gruba katıldığından emin ol ve tekrar dene! https://www.roblox.com/communities/813826297/EkoY-ld-z-Moderat-r-Okulu'
        }).catch(() => { });
        return;
      }
    }

    // Set Roblox rank in school group to 7
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

    // Flatten all roles that we manage to know which ones to clean up
    const ALL_MANAGED_ROLE_NAMES = Array.from(new Set(Object.values(RANK_ROLE_MAP).flat()));

    // Find all managed role IDs in this guild
    const managedRoleIds = [];
    const rolesToAddIds = [];
    const targetRoleNames = RANK_ROLE_MAP[rankNum];

    // Look up role IDs in cache/guild
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

    // Remove all managed roles first to keep role updates consistent
    await member.roles.remove(managedRoleIds).catch(() => { });

    // Add target roles if rank matches and roles exist
    if (rolesToAddIds.length > 0) {
      await member.roles.add(rolesToAddIds).catch(() => { });
      const roleMentions = rolesToAddIds.map(id => `<@&${id}>`).join(', ');
      await interaction.editReply({ content: `✅ Rolleriniz güncellendi! Yeni rolleriniz: ${roleMentions}` });
    } else {
      await interaction.editReply({ content: `❌ Roblox grubunda uygun bir rütbeniz bulunamadı veya karşılık gelen roller okul sunucusunda mevcut değil (Rütbeniz: ${rankNum}).` });
    }
    return;
  }

  // Understand logic
  if (customId === 'school_understand_ok' || customId === 'school_understand_not_ok') {
    await interaction.deferUpdate().catch(() => { });

    const session = activeTrainings.get(userId);
    if (!session) return;

    // Delete the "Anladın mı?" message
    await interaction.deleteReply().catch(() => { });

    if (customId === 'school_understand_not_ok') {
      // Resend same block
      await sendTrainingBlock(userId, client);
    } else {
      // Understood: advance
      session.step++;
      const blocks = session.phase === 1 ? PHASE1_BLOCKS : PHASE2_BLOCKS;
      if (session.step < blocks.length) {
        await sendTrainingBlock(userId, client);
      } else {
        // Phase completed!
        activeTrainings.delete(userId);
        await finishPhase(userId, session.phase, client);
      }
    }
    return;
  }

  // Exam evaluation buttons (GEÇTİ / KALDI)
  if (customId.startsWith('school_exam_pass_') || customId.startsWith('school_exam_fail_')) {
    await interaction.deferUpdate().catch(() => { });

    // Check permissions (must be admin or school director)
    const isManager = interaction.member.roles.cache.has(SCHOOL_ROLES.ASAMA_3) ||
      interaction.member.roles.cache.has(SCHOOL_ROLES.ADMIN) ||
      interaction.member.permissions.has('Administrator');
    if (!isManager) {
      await interaction.followUp({ content: '❌ Bu işlemi gerçekleştirmek için yetkiniz bulunmamaktadır.', ephemeral: true }).catch(() => { });
      return;
    }

    const targetUserId = customId.split('_').pop();
    const passed = customId.includes('pass');

    // Remove buttons from log message
    await interaction.editReply({ components: [] }).catch(() => { });

    if (passed) {
      await graduateStudent(targetUserId, interaction.user.username, client);
      await interaction.followUp({ content: `✅ <@${targetUserId}> başarıyla mezun edildi.` }).catch(() => { });
    } else {
      await failStudent(targetUserId, interaction.user.username, client);
      await interaction.followUp({ content: `❌ <@${targetUserId}> sınavı geçemedi olarak işaretlendi.` }).catch(() => { });
    }
    return;
  }
}

/**
 * Sends a training block to the user and manages the 5 second visibility timeout.
 */
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

    // Save step to database
    p.schoolSystem.step = session.step;
    await p.save();

    // Start 5-second timer
    setTimeout(async () => {
      try {
        const currentSession = activeTrainings.get(userId);
        if (currentSession && currentSession.lastMessageId === msg.id) {
          // Delete message
          await msg.delete().catch(() => { });

          // Ask "Anladın mı?"
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

/**
 * Finishes the training phase.
 */
async function finishPhase(userId, phase, client) {
  try {
    const user = await client.users.fetch(userId);
    let p = await StaffProgress.findOne({ userId });
    if (!p) return;

    const robloxUser = await User.findOne({ discordId: userId });
    const robloxId = robloxUser ? parseInt(robloxUser.robloxId) : null;

    if (phase === 1) {
      // Roblox rank 8 (Phase 2)
      if (robloxId) {
        await noblox.setRank(SCHOOL_ROBLOX_GROUP, robloxId, 8).catch(() => { });
      }

      p.schoolSystem.status = 'phase1_completed';
      p.schoolSystem.phase = 2;
      p.schoolSystem.step = 0;
      await p.save();

      const embed = new EmbedBuilder()
        .setColor(0xff75a0)
        .setTitle('🎉 1. Aşama Eğitimi Başarıyla Tamamlandı! 🎉')
        .setDescription(
          `Selin: Harika gidiyorsun! 1. Aşama eğitimini başarıyla bitirdin. 💖\n\n` +
          `Şimdi okul sunucusunda <#${CHANNELS.UPDATE_ROLES}> kanalına git, **Update Roles** butonuna bas ve rolünün güncellenmesini sağla.\n\n` +
          `Daha sonra 2. Aşama sesli kanalına girerek yeni eğitimini başlatabilirsin! ✨`
        );

      await user.send({ embeds: [embed] }).catch(() => { });

      // Log to egitim-rapor
      const reportChannel = client.channels.cache.get(CHANNELS.EGITIM_RAPOR);
      if (reportChannel) {
        await reportChannel.send({
          content: `**Eğitim Raporu**\n\nİsim: Selin\nRütbe: Aşama-I\nEğitim Türü: 1. Aşama\nDenetmen: adamgeldi_adam4\nEğitimi geçen kişiler:\n- <@${userId}>\n\nTag: <@&${SCHOOL_ROLES.ASAMA_3}> & <@&${SCHOOL_ROLES.MOD_EKIBI}>\n<@&${SCHOOL_ROLES.ASAMA_2}>`
        }).catch(() => { });
      }

    } else if (phase === 2) {
      // Roblox rank 9 (Exam/Phase 3)
      if (robloxId) {
        await noblox.setRank(SCHOOL_ROBLOX_GROUP, robloxId, 9).catch(() => { });
      }

      p.schoolSystem.status = 'phase2_completed';
      p.schoolSystem.phase = 3;
      p.schoolSystem.step = 0;
      await p.save();

      const embed = new EmbedBuilder()
        .setColor(0xff75a0)
        .setTitle('🎉 2. Aşama Eğitimi Başarıyla Tamamlandı! 🎉')
        .setDescription(
          `Selin: İnanılmazsın! 2. Aşama eğitimini de tamamladın. 🌸\n\n` +
          `Şimdi okul sunucusunda <#${CHANNELS.UPDATE_ROLES}> kanalına git, **Update Roles** butonuna bas ve rolünün güncellenmesini sağla.\n\n` +
          `Daha sonra Sınav Odası sesli kanalına girerek son aşama sınavını başlatabilirsin! Başarılar dilerim! 💕`
        );

      await user.send({ embeds: [embed] }).catch(() => { });

      // Log to egitim-rapor
      const reportChannel = client.channels.cache.get(CHANNELS.EGITIM_RAPOR);
      if (reportChannel) {
        await reportChannel.send({
          content: `**Eğitim Raporu**\n\nİsim: Selin\nRütbe: Aşama-II\nEğitim Türü: 2. Aşama\nDenetmen: adamgeldi_adam4\nEğitimi geçen kişiler:\n- <@${userId}>\n\nTag: <@&${SCHOOL_ROLES.ASAMA_3}> & <@&${SCHOOL_ROLES.MOD_EKIBI}>\n<@&${SCHOOL_ROLES.ASAMA_2}>`
        }).catch(() => { });
      }
    }
  } catch (err) {
    logger.error('[ModeratorSchool] finishPhase error:', err.message);
  }
}

/**
 * Handles voice channel status changes to start training or exam.
 */
async function handleSchoolVoiceStateUpdate(oldState, newState, client) {
  try {
    const userId = newState.id;
    const voiceChannelId = newState.channelId;
    if (!voiceChannelId) return; // Disconnected

    const p = await StaffProgress.findOne({ userId });
    if (!p || p.status !== 'active') return;

    // Check which channel they joined
    if (voiceChannelId === VOICE_CHANNELS.EGITIM_SESLI_1 && p.schoolSystem.phase === 1) {
      if (activeTrainings.has(userId)) return; // Already training

      // Bot joins voice channel
      try {
        const guild = newState.guild;
        if (guild.members.me.permissions.has('Connect')) {
          await guild.members.me.voice.setChannel(voiceChannelId).catch(() => { });
        }
      } catch (_) { }

      // Start countdown
      const user = await client.users.fetch(userId);
      await user.send({ content: '🌸 Selin: Eğitim 3 dakika sonra başlayacak... Lütfen ses kanalında kal. 💕' }).catch(() => { });

      setTimeout(async () => {
        // Verify user is still in the voice channel
        const currentMember = newState.guild.members.cache.get(userId);
        if (currentMember?.voice.channelId === VOICE_CHANNELS.EGITIM_SESLI_1) {
          await user.send({ content: '🌸 Selin: Eğitim başladı! Başarılar dilerim. ✨' }).catch(() => { });
          await sendTrainingBlock(userId, client);
        }
      }, 15000); // 15 seconds simulation for easy testing
    }

    else if (voiceChannelId === VOICE_CHANNELS.EGITIM_SESLI_2 && p.schoolSystem.phase === 2) {
      if (activeTrainings.has(userId)) return;

      // Bot joins voice
      try {
        const guild = newState.guild;
        if (guild.members.me.permissions.has('Connect')) {
          await guild.members.me.voice.setChannel(voiceChannelId).catch(() => { });
        }
      } catch (_) { }

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

    else if (voiceChannelId === VOICE_CHANNELS.SINAV_ODASI && p.schoolSystem.phase === 3) {
      if (activeExams.has(userId)) return;

      // Bot joins voice
      try {
        const guild = newState.guild;
        if (guild.members.me.permissions.has('Connect')) {
          await guild.members.me.voice.setChannel(voiceChannelId).catch(() => { });
        }
      } catch (_) { }

      const user = await client.users.fetch(userId);
      await user.send({ content: '🌸 Selin: Sınavınız 3 dakika sonra başlayacak... Lütfen hazır olun. 💕' }).catch(() => { });

      setTimeout(async () => {
        const currentMember = newState.guild.members.cache.get(userId);
        if (currentMember?.voice.channelId === VOICE_CHANNELS.SINAV_ODASI) {
          await user.send({ content: '🌸 Selin: Sınav başladı! Aşağıdaki soruları tek tek cevaplandır. ✨' }).catch(() => { });

          // Init exam session
          activeExams.set(userId, {
            questionIndex: 0,
            answers: [],
          });

          await askExamQuestion(userId, client);
        }
      }, 15000);
    }
  } catch (err) {
    logger.error('[ModeratorSchool] handleSchoolVoiceStateUpdate error:', err.message);
  }
}

/**
 * Asks the current exam question in DM.
 */
async function askExamQuestion(userId, client) {
  try {
    const user = await client.users.fetch(userId);
    const session = activeExams.get(userId);
    if (!session || !user) return;

    if (session.questionIndex < EXAM_QUESTIONS.length) {
      await user.send({
        content: `🌸 **Soru ${session.questionIndex + 1}:** ${EXAM_QUESTIONS[session.questionIndex]}`
      });
    } else {
      // Completed!
      activeExams.delete(userId);

      let p = await StaffProgress.findOne({ userId });
      if (p) {
        p.schoolSystem.status = 'exam_passed'; // Temporary passed state waiting for admin approval
        p.schoolSystem.examAnswers = session.answers;
        await p.save();
      }

      await user.send({
        content: '🌸 Selin: Sınavı başarıyla tamamladın! Cevapların yöneticilerimize mülakat olarak gönderildi. Sonuç açıklandığında sana bildireceğim. Görüşmek üzere! 💕'
      }).catch(() => { });

      // Post to sınav-rapor
      const reportChannel = client.channels.cache.get(CHANNELS.SINAV_RAPOR);
      if (reportChannel) {
        const embed = new EmbedBuilder()
          .setColor(0x7c6af7)
          .setTitle('📝 Sınav Cevapları Değerlendirmesi')
          .setDescription(`**Aday:** <@${userId}>\n**Tarih:** ${new Date().toLocaleDateString('tr-TR')}\n\n**Cevaplar:**\n` +
            session.answers.map((ans, idx) => `**Soru ${idx + 1}:** ${EXAM_QUESTIONS[idx]}\n**Cevap:** ${ans}\n`).join('\n')
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`school_exam_pass_${userId}`)
            .setLabel('GEÇTİ (MEZUN ET)')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`school_exam_fail_${userId}`)
            .setLabel('KALDI (REDDET)')
            .setStyle(ButtonStyle.Danger)
        );

        await reportChannel.send({
          content: `📊 **Sınav Raporu**\n\nTag: <@&${SCHOOL_ROLES.ASAMA_2}> & <@&${SCHOOL_ROLES.ASAMA_3}>`,
          embeds: [embed],
          components: [row]
        }).catch(() => { });
      }
    }
  } catch (err) {
    logger.error('[ModeratorSchool] askExamQuestion error:', err.message);
  }
}

/**
 * Handles incoming DM messages from users taking the exam.
 */
async function handleSchoolExamReply(message, client) {
  const userId = message.author.id;
  const session = activeExams.get(userId);
  if (!session) return false;

  session.answers.push(message.content);
  session.questionIndex++;

  await askExamQuestion(userId, message.client).catch(() => { });
  return true;
}

/**
 * Graduation logic when admin approves the exam answers.
 */
async function graduateStudent(userId, adminName, client) {
  try {
    const user = await client.users.fetch(userId);
    let p = await StaffProgress.findOne({ userId });
    if (!p) return;

    // Set Roblox rank back in main group
    const robloxUser = await User.findOne({ discordId: userId });
    if (robloxUser && robloxUser.robloxId) {
      try {
        const { syncStaffRobloxRanks } = require('./staffAutomation');
        await syncStaffRobloxRanks(client, userId).catch(() => { });
      } catch (_) { }
    }

    // Restore Discord roles on main server
    const mainGuild = client.guilds.cache.get(MAIN_GUILD_ID);
    if (mainGuild) {
      try {
        const member = await mainGuild.members.fetch(userId).catch(() => null);
        if (member) {
          // Remove school roles on main server
          await member.roles.remove([MAIN_SCHOOL_ROLES.TRAINEE, MAIN_SCHOOL_ROLES.INFO_ROLE]).catch(() => { });

          // Restore backup roles
          const savedRoles = p.schoolSystem.originalRoles || [];
          if (savedRoles.length > 0) {
            await member.roles.add(savedRoles).catch(() => { });
          }

          // Also verify/set level based rank role in main server
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

    // Assign Graduate role in School server and kick/remove them
    const schoolGuild = client.guilds.cache.get(SCHOOL_GUILD_ID);
    if (schoolGuild) {
      try {
        const schoolMember = await schoolGuild.members.fetch(userId).catch(() => null);
        if (schoolMember) {
          // Add Graduate/Moderator Ekibi role in school server
          await schoolMember.roles.add(SCHOOL_ROLES.MOD_EKIBI).catch(() => { });

          // Kick the member after 5 seconds to finalize
          setTimeout(async () => {
            await schoolMember.kick('Mezun oldu!').catch(() => { });
          }, 5000);
        }
      } catch (schoolRoleErr) {
        logger.error('[ModeratorSchool] School roles update error:', schoolRoleErr.message);
      }
    }

    // DM farewell
    if (user) {
      const farewellEmbed = new EmbedBuilder()
        .setColor(0xff75a0)
        .setTitle('🌸 Selin:')
        .setDescription(
          `Görüşürüz! Seni çok özleyeceğim.. 💖\n\n` +
          `Moderatör ekibindeki görevlerine kaldığın yerden devam edebilirsin! Harika bir iş çıkardın, başarılar dilerim! 🌟`
        );
      await user.send({ embeds: [farewellEmbed] }).catch(() => { });
    }

    // Log to mezunlar
    const mezunlarChannel = client.channels.cache.get(CHANNELS.MEZUNLAR);
    if (mezunlarChannel) {
      await mezunlarChannel.send({
        content: `🎓 **Mezuniyet Tebriği!**\n\n<@${userId}> başarıyla okuldan mezun olmuş ve ekibe geri dönmüştür! 👏\nTarih: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`
      }).catch(() => { });
    }

    // Log to rutbe-degisim
    const changeChannel = client.channels.cache.get(CHANNELS.RUTBE_DEGISIM);
    if (changeChannel) {
      const { ROLE_NAMES } = require('./staffSystem');
      const levelName = ROLE_NAMES[p.schoolSystem.originalLevel || p.level] || 'Moderatör';
      await changeChannel.send({
        content: `📋 **Rütbe Değişiklik Bildirimi**\n\nİsim: Selin\nTarih: ${new Date().toLocaleDateString('tr-TR')}\nRütbe verilen personel: <@${userId}>\nPersonelin eski rütbesi: Okul Personeli\nPersonelin yeni rütbesi: ${levelName}\nSebep: Okuldan başarıyla mezun olması.\n\nTag: <@&${SCHOOL_ROLES.MOD_EKIBI}>`
      }).catch(() => { });
    }

    // Update database
    p.schoolSystem.status = 'graduated';
    p.schoolSystem.completedAt = new Date();
    await p.save();

  } catch (err) {
    logger.error('[ModeratorSchool] graduateStudent error:', err.message);
  }
}

/**
 * Handles failed student logic.
 */
async function failStudent(userId, adminName, client) {
  try {
    const user = await client.users.fetch(userId);
    let p = await StaffProgress.findOne({ userId });
    if (!p) return;

    // Reset phase / step or keep them in school
    p.schoolSystem.status = 'in_school';
    p.schoolSystem.phase = 3;
    await p.save();

    if (user) {
      await user.send({
        content: '🌸 Selin: Sınavı geçemedin maalesef. Lütfen eğitim dökümanlarını tekrar çalış ve ses kanalına girerek sınavı yeniden dene! Başarılar! 💕'
      }).catch(() => { });
    }
  } catch (err) {
    logger.error('[ModeratorSchool] failStudent error:', err.message);
  }
}

/**
 * Parses and processes requests in #eğitim-istek channel.
 */
async function handleEgitimIstekMessage(message, client) {
  if (message.guildId !== SCHOOL_GUILD_ID || message.channelId !== CHANNELS.EGITIM_ISTEK || message.author.bot) return;

  const content = message.content;
  // Parse format
  const matchesName = content.match(/İsim:\s*(.*)/i);
  const matchesRank = content.match(/Rütbe:\s*(.*)/i);
  const matchesType = content.match(/İstenilen Eğitim:\s*(.*)/i);
  const matchesTime = content.match(/Ne zaman:\s*(.*)/i);

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
        .setCustomId(`school_confirm_req_yes_${message.id}_${type.replace(/\s+/g, '-')}_${time.replace(/\s+/g, '-')}`)
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
  const { customId, user } = interaction;

  if (customId === 'school_confirm_req_no') {
    await interaction.deferUpdate().catch(() => { });
    await interaction.editReply({ content: '🌸 Tamam, eğitim talebi iptal edildi! Görüşmek üzere. 💕', embeds: [], components: [] }).catch(() => { });
    return;
  }

  // format: school_confirm_req_yes_msgId_type_time
  const parts = customId.split('_');
  const type = parts[5].replace(/-/g, ' ');
  const time = parts[6].replace(/-/g, ' ');

  await interaction.deferUpdate().catch(() => { });
  await interaction.editReply({ content: '🌸 Harika! Eğitim talebin onaylandı ve duyuru kanalına gönderildi. Lütfen eğitim saatinde uygun ses kanalında ol! 💕', embeds: [], components: [] }).catch(() => { });

  // Send announcement to egitim-duyuru
  const duyuruChannel = client.channels.cache.get(CHANNELS.EGITIM_DUYURU);
  if (duyuruChannel) {
    const isPhase1 = type.toLowerCase().includes('1') || type.toLowerCase().includes('i') && !type.toLowerCase().includes('ii');
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
