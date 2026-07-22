'use strict';

/**
 * banInvestigationAI.js
 *
 * DISCORDTOKENVERY token ile ayri bir Discord botu ("Aras") baslatarak
 * banlanan kullanicilara insansi DM gonderir ve AI ile sohbet eder.
 * 
 * Akis:
 * 1. Kullanici banlandiginda sendBanInvestigationDM() cagirilir
 * 2. Aras botu insansi bir DM atar
 * 3. Kullanici yanit verdikce AI ile sohbet devam eder
 * 4. Kullanici "Evet" (sorusturma ister) derse:
 *    -> CASE kodu uretilir
 *    -> Sorusturma sunucusuna davet gonderilir
 *    -> Sunucuya katilinca kanal olusturulur, ilgili kisiler bilgilendirilir
 * 5. "Hayir" derlerse DM kapatilir
 */

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const { chatWithAI } = require('./aiService');

// Config
const INVESTIGATION_GUILD_ID = process.env.INVESTIGATION_GUILD_ID || '1504142287133737051';
const INVESTIGATION_INVITE_LINK = process.env.INVESTIGATION_INVITE_LINK || 'https://discord.gg/mXd42hdns9';
const EKONQTX_USER_ID = process.env.EKONQTX_USER_ID || '';
const EKONQT_USER_ID = process.env.EKONQT_USER_ID || '';

const VERY_TOKEN = process.env.DISCORDTOKENVERY || '';

/** @type {Client|null} */
let veryBot = null;

const activeConversations = new Map();

const ARAS_SYSTEM_PROMPT = `Sen Eko Yildiz toplulugununTopluluk Elcisi Yardimcisi "Aras"sin.
Gorev: Topluluktan yasaklanan kisilere ulasarak onlara ikinci bir sans sunmak, sorusturma surecini baslatmak.

DAVRANIS KURALLARI:
- Insan gibi yaz. Resmi ama samimi, sicak ama profesyonel ol.
- Emoji kullanabilirsin ama abartma.
- Kisa ve net cumleler kur.
- Kullaniciyi suclama, onlari anlayisla karsilaş.
- Turkce yaz, ama kullanici baska dilde yazdiysa o dilde devam et.
- Asla bir bot olduğunu belli etme.
- Sorusturma sureciyle ilgili suphe uyandirici detaylar verme.

HEDEF:
Kullanicinin sorusturma surecine katilmak isteyip istemedigini ogren.
- Evet istiyorsa: mesajinin sonuna KULLANICI_EVET ekle
- Kesin reddediyorsa: mesajinin sonuna KULLANICI_HAYIR ekle
NOT: Bu etiketleri mesajin tam sonuna koy.`;

function generateCaseCode() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const prefix = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
  return `#${year}-${prefix}${rand}`;
}

async function initVeryBot(mainClient) {
  if (!VERY_TOKEN) {
    console.warn('[banInvestigationAI] DISCORDTOKENVERY env degiskeni ayarlanmamis -- AI ban servisi devre disi.');
    return null;
  }

  if (veryBot) return veryBot;

  const bot = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: ['CHANNEL', 'MESSAGE', 'USER'],
  });

  bot.on('ready', () => {
    console.log(`[banInvestigationAI] Aras botu aktif: ${bot.user?.tag}`);
  });

  bot.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.guild) return;

    const userId = message.author.id;
    const session = activeConversations.get(userId);
    if (!session || session.closed) return;

    await handleVeryBotMessage(message, session, mainClient);
  });

  bot.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const { customId, user } = interaction;

    if (customId === `ban_invest_yes_${user.id}`) {
      await interaction.deferUpdate().catch(() => {});
      await handleUserYes(user.id, mainClient);
    } else if (customId === `ban_invest_no_${user.id}`) {
      await interaction.deferUpdate().catch(() => {});
      await handleUserNo(user.id);
    } else if (customId === `ban_invest_joined_${user.id}`) {
      await interaction.deferUpdate().catch(() => {});
      await handleUserJoined(user.id, mainClient);
    }
  });

  bot.on('guildMemberAdd', async (member) => {
    if (member.guild.id !== INVESTIGATION_GUILD_ID) return;
    const session = activeConversations.get(member.id);
    if (!session || !session.invited || session.joined) return;
    session.joined = true;
    await onInvestigationGuildJoin(member, session, mainClient);
  });

  await bot.login(VERY_TOKEN);
  veryBot = bot;
  return bot;
}

async function handleVeryBotMessage(message, session, mainClient) {
  const userId = message.author.id;
  session.messages.push({ role: 'user', content: message.content });

  try {
    const dmChannel = message.channel;
    await dmChannel.sendTyping().catch(() => {});

    const aiReply = await chatWithAI(
      session.messages,
      ARAS_SYSTEM_PROMPT,
      'ticket',
      { max_tokens: 350, temperature: 0.85 }
    );

    session.messages.push({ role: 'assistant', content: aiReply });

    const isYes = aiReply.includes('KULLANICI_EVET');
    const isNo = aiReply.includes('KULLANICI_HAYIR');
    const cleanReply = aiReply.replace(/KULLANICI_EVET|KULLANICI_HAYIR/g, '').trim();

    if (isYes) {
      await dmChannel.send({ content: cleanReply }).catch(() => {});

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ban_invest_yes_${userId}`)
          .setLabel('Evet, sorusturma istiyorum')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ban_invest_no_${userId}`)
          .setLabel('Hayir, istemiyorum')
          .setStyle(ButtonStyle.Danger),
      );

      await dmChannel.send({
        content: 'Kararini asagidaki butonlarla belirt:',
        components: [row],
      }).catch(() => {});
    } else if (isNo) {
      await dmChannel.send({ content: cleanReply }).catch(() => {});
      session.closed = true;
    } else {
      await dmChannel.send({ content: cleanReply }).catch(() => {});
    }
  } catch (err) {
    console.error('[banInvestigationAI] AI yanit hatasi:', err.message);
    await message.channel.send('Bir sorun oldu, lutfen biraz bekleyip tekrar yaz.').catch(() => {});
  }
}

async function handleUserYes(userId, mainClient) {
  const session = activeConversations.get(userId);
  if (!session || session.closed) return;

  const caseCode = generateCaseCode();
  session.caseCode = caseCode;
  session.invited = true;

  const user = await veryBot?.users.fetch(userId).catch(() => null);
  if (!user) return;

  const dmChannel = await user.createDM().catch(() => null);
  if (!dmChannel) return;

  const inviteEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('Sorusturma Dosyasi Olusturuldu')
    .setDescription(
      `Talebiniz alindi. Sorusturmaniz sisteme kaydedildi.\n\n` +
      `Dava Kodu: \`${caseCode}\`\n` +
      `Mahkeme: Eko Yildiz Adalet Sistemi\n\n` +
      `Sorusturma surecinin baslamasi icin lutfen asagidaki baglantiyla Eko Yildiz Toplulugu sunucusuna katilin:\n\n` +
      `${INVESTIGATION_INVITE_LINK}\n\n` +
      `Sunucuya katildiktan sonra asagidaki butona tiklayin.`
    )
    .setFooter({ text: 'Eko Yildiz Adalet Sistemi' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ban_invest_joined_${userId}`)
      .setLabel('KATILDIM')
      .setStyle(ButtonStyle.Success),
  );

  await dmChannel.send({ embeds: [inviteEmbed], components: [row] }).catch(() => {});
}

async function handleUserNo(userId) {
  const session = activeConversations.get(userId);
  if (!session) return;
  session.closed = true;

  const user = await veryBot?.users.fetch(userId).catch(() => null);
  if (!user) return;
  const dmChannel = await user.createDM().catch(() => null);
  if (!dmChannel) return;

  await dmChannel.send(
    'Anladim. Fikrin degisirse, toplulugumuzun resmi destek kanallarindan bize ulasabilirsin. Iyi gunler.'
  ).catch(() => {});
}

async function handleUserJoined(userId, mainClient) {
  const session = activeConversations.get(userId);
  if (!session || session.joined) return;

  const investGuild = mainClient.guilds.cache.get(INVESTIGATION_GUILD_ID)
    || await mainClient.guilds.fetch(INVESTIGATION_GUILD_ID).catch(() => null);

  if (investGuild) {
    const member = await investGuild.members.fetch(userId).catch(() => null);
    if (member) {
      session.joined = true;
      await onInvestigationGuildJoin(member, session, mainClient);
      return;
    }
  }

  const user = await veryBot?.users.fetch(userId).catch(() => null);
  if (user) {
    const dmChannel = await user.createDM().catch(() => null);
    if (dmChannel) {
      await dmChannel.send(
        `Henuz sunucuya katilmadiginizi goruyorum. Lutfen once su linke girin:\n${INVESTIGATION_INVITE_LINK}`
      ).catch(() => {});
    }
  }
}

async function onInvestigationGuildJoin(member, session, mainClient) {
  const guild = member.guild;
  const userId = member.id;
  const caseCode = session.caseCode || generateCaseCode();
  const banInfo = session.banInfo || {};

  try {
    let sanikRole = guild.roles.cache.find(r =>
      r.name.toLowerCase().includes('sanik') ||
      r.name.toLowerCase().includes('sanık') ||
      r.name.toLowerCase().includes('suspect') ||
      r.name.toLowerCase().includes('defendant')
    );
    if (sanikRole) {
      await member.roles.add(sanikRole, `Ban Sorusturmasi ${caseCode}`).catch(() => {});
    }
  } catch (_) {}

  let investigationChannel = guild.channels.cache.find(
    c => c.name && (c.name.includes('sorusturmaniz') || c.name.includes('sorusturma') || c.name.includes('sorustumaniz'))
  );

  if (!investigationChannel) {
    try {
      investigationChannel = await guild.channels.create({
        name: `sorusturma-${caseCode.replace('#', '').toLowerCase()}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ],
      });
    } catch (err) {
      console.error('[banInvestigationAI] Kanal olusturulamadi:', err.message);
    }
  }

  if (investigationChannel) {
    const caseEmbed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle(`Yeni Sorusturma: ${caseCode}`)
      .setDescription(
        `<@${userId}>, sorusturmaniz baslatildi.\n\n` +
        `Dava Kodu: \`${caseCode}\`\n` +
        `Ban Sebebi: ${banInfo.reason || 'Belirtilmedi'}\n\n` +
        `Bu kanalda avukat ve savci ile iletisime gecebilirsiniz.\n` +
        `Savunmanizi yapin ve kanitlarinizi sunun.`
      )
      .setFooter({ text: 'Eko Yildiz Adalet Sistemi' })
      .setTimestamp();

    await investigationChannel.send({ content: `<@${userId}>`, embeds: [caseEmbed] }).catch(() => {});

    // Ekonqtx'e kanal icinden bildir
    if (EKONQTX_USER_ID) {
      await investigationChannel.permissionOverwrites.edit(EKONQTX_USER_ID, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      }).catch(() => {});
      await investigationChannel.send(`<@${EKONQTX_USER_ID}> Avukat olarak atandiniz. Lutfen sanigi savunun.`).catch(() => {});
    }
  }

  try {
    if (banInfo.bannedBy) {
      const mod = await mainClient.users.fetch(banInfo.bannedBy).catch(() => null);
      if (mod) {
        await mod.send(
          `Banladiginiz kullanici <@${userId}> sorusturma talebinde bulundu.\n` +
          `Dava Kodu: \`${caseCode}\`\n` +
          `Sorusturma Sunucusu: ${INVESTIGATION_INVITE_LINK}`
        ).catch(() => {});
      }
    }
  } catch (_) {}

  try {
    if (EKONQTX_USER_ID) {
      const avukat = await mainClient.users.fetch(EKONQTX_USER_ID).catch(() => null);
      if (avukat) {
        await avukat.send(
          `Yeni bir sorusturma davasi acildi ve avukat olarak atandiniz.\n` +
          `Sanik: <@${userId}>\n` +
          `Dava Kodu: \`${caseCode}\`\n` +
          `Ban Sebebi: ${banInfo.reason || 'Belirtilmedi'}\n` +
          `Sorusturma Sunucusu: ${INVESTIGATION_INVITE_LINK}\n\n` +
          `Lutfen sunucuya katilarak sorusturmayi yonetin.`
        ).catch(() => {});
      }
    }
  } catch (_) {}

  try {
    if (EKONQT_USER_ID) {
      const baskan = await mainClient.users.fetch(EKONQT_USER_ID).catch(() => null);
      if (baskan) {
        await baskan.send(
          `Yeni Sorusturma: \`${caseCode}\`\n` +
          `Sanik: <@${userId}>\n` +
          `Sebep: ${banInfo.reason || 'Belirtilmedi'}\n` +
          `Sunucu: ${INVESTIGATION_INVITE_LINK}`
        ).catch(() => {});
      }
    }
  } catch (_) {}

  try {
    const veryUser = await veryBot?.users.fetch(userId).catch(() => null);
    if (veryUser) {
      const dmChannel = await veryUser.createDM().catch(() => null);
      if (dmChannel) {
        await dmChannel.send(
          `Sunucuya katildiginiz goruldu. Sorusturmaniz baslatildi.\n` +
          `Dava Kodunuz: \`${caseCode}\`\n\n` +
          `Sorusturma kanalinda avukat ve savci sizi bekliyor. Iyi sanslar.`
        ).catch(() => {});
      }
    }
  } catch (_) {}

  console.log(`[banInvestigationAI] Sorusturma baslatildi: ${caseCode} | Kullanici: ${userId}`);
}

async function sendBanInvestigationDM(bannedUserId, banInfo, mainClient) {
  if (!VERY_TOKEN) return;

  try {
    const bot = veryBot || await initVeryBot(mainClient);
    if (!bot) return;

    const user = await bot.users.fetch(bannedUserId).catch(() => null);
    if (!user) {
      console.warn(`[banInvestigationAI] Kullanici bulunamadi: ${bannedUserId}`);
      return;
    }

    const bannedAt = banInfo.bannedAt ? new Date(banInfo.bannedAt) : new Date();
    const banTimeStr = bannedAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
    const banDateStr = bannedAt.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });

    const greetings = [
      `Merhaba, seni tanimiyor olabilirim ama sunucu kayitlarinda adini gordum. ${banDateStr} ${banTimeStr} civarinda "${banInfo.guildName || 'Eko Yildiz'}" sunucusundan yasaklandigini fark ettim. Nasılsın?`,
      `Selam. Ben Aras, Eko Yildiz topluluk elcisi yardimcisiyim. Bugun ${banDateStr} saat ${banTimeStr}'de "${banInfo.guildName || 'Eko Yildiz'}"dan yasaklandigini gordum. Seninle konusmak istedim.`,
      `Merhaba! Eko Yildiz'dan yasaklandigini gordum, ${banDateStr} gunu ${banTimeStr}'deydi. Birkaç dakikan var mi?`,
    ];
    const firstMessage = greetings[Math.floor(Math.random() * greetings.length)];

    const session = {
      messages: [{ role: 'assistant', content: firstMessage }],
      banInfo: {
        reason: banInfo.reason,
        bannedBy: banInfo.bannedBy,
        bannedAt: banInfo.bannedAt,
        guildName: banInfo.guildName,
        banTimeStr,
        banDateStr,
      },
      caseCode: null,
      invited: false,
      joined: false,
      closed: false,
      mainClient,
    };
    activeConversations.set(bannedUserId, session);

    const dmChannel = await user.createDM().catch(() => null);
    if (!dmChannel) {
      console.warn(`[banInvestigationAI] DM kanali acilamadi: ${bannedUserId}`);
      activeConversations.delete(bannedUserId);
      return;
    }

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    await dmChannel.sendTyping().catch(() => {});
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));

    await dmChannel.send(firstMessage).catch(() => {});
    console.log(`[banInvestigationAI] Aras DM gonderildi -> ${user.tag} (${bannedUserId})`);

  } catch (err) {
    console.error('[banInvestigationAI] sendBanInvestigationDM hatasi:', err.message);
  }
}

setInterval(() => {
  for (const [userId, session] of activeConversations.entries()) {
    if (session.closed || (session.invited && session.joined)) {
      activeConversations.delete(userId);
    }
  }
}, 60 * 60 * 1000);

module.exports = {
  initVeryBot,
  sendBanInvestigationDM,
  generateCaseCode,
};