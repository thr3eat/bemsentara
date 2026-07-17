'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { getDiscordClient } = require('../discordClient');
const User = require('../../models/User');

const AVUKAT_ROLE_ID = '1523819093948633288';
const EKOYILDIZ_GUILD_ID = '1367646464804655104';

// Active interrogations mapping:
// userId -> { channelId, guildId, lawyerId, status }
const activeInterrogations = new Map();

/**
 * Handle the "Hapistekini Sorgula" button click from the jail logs.
 */
async function handleSorgulaButton(interaction) {
  const targetUserId = interaction.customId.replace('jail_sorgula_', '');
  const guild = interaction.guild;
  const clicker = interaction.user;

  // Check if an interrogation is already active
  if (activeInterrogations.has(targetUserId)) {
    return interaction.reply({ content: '❌ Bu mahkum için halihazırda bir sorgu veya soruşturma süreci devam ediyor.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
    if (!targetMember) {
      return interaction.editReply({ content: '❌ Mahkum sunucuda bulunamadı.' });
    }

    // Determine category (same as the interaction channel, which is the jail log channel)
    const parentId = interaction.channel.parentId;

    const channelName = `sorgu-${targetMember.user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

    // Permissions: Admins + Clicker can view, target cannot view (since it's done via DM), everyone else denied.
    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: clicker.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ];

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites,
      topic: `Sorgu Kanalı | Mahkum: ${targetMember.user.tag} (${targetUserId})`,
    });

    activeInterrogations.set(targetUserId, {
      channelId: channel.id,
      guildId: guild.id,
      lawyerId: null,
      status: 'sorgu'
    });

    const embed = new EmbedBuilder()
      .setTitle('🕵️‍♂️ Sorgu Odası Açıldı')
      .setDescription(
        `**Mahkum:** <@${targetUserId}>\n` +
        `**Sorguyu Başlatan:** <@${clicker.id}>\n\n` +
        `Bu kanala yazacağınız her şey doğrudan mahkuma DM olarak (Bot üzerinden) iletilecektir.\n` +
        `Mahkumun DM yanıtları da buraya düşecektir.`
      )
      .setColor(0x3498db)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`interrogation_convert_${targetUserId}`)
        .setLabel('⚖️ Soruşturmaya Çevir')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`interrogation_close_${targetUserId}`)
        .setLabel('🔒 Sorguyu Kapat')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    // Send DM to target
    await targetMember.send(
      `🚨 **Sorgu Odasına Alındınız!**\n\n` +
      `Yetkililer tarafından şu an sorgulanıyorsunuz. Buraya (Bot DM'sine) göndereceğiniz mesajlar doğrudan sorgu odasına iletilecektir. Lütfen dürüstçe yanıt verin.`
    ).catch(() => {});

    await interaction.editReply({ content: `✅ Sorgu kanalı oluşturuldu: <#${channel.id}>` });

    // Notify Lawyers
    notifyLawyers(interaction.client, targetUserId, guild, channel.id);

  } catch (err) {
    console.error('[interrogationService] Error creating sorgula channel:', err);
    return interaction.editReply({ content: '❌ Kanal oluşturulurken bir hata oluştu.' });
  }
}

/**
 * Notifies active lawyers about the new interrogation.
 */
async function notifyLawyers(client, targetUserId, guild, channelId) {
  try {
    const avukatRole = guild.roles.cache.get(AVUKAT_ROLE_ID);
    if (!avukatRole) return;

    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
    if (!targetMember) return;

    const activeLawyers = avukatRole.members.filter(m => !m.user.bot && ['online', 'idle', 'dnd'].includes(m.presence?.status));

    const embed = new EmbedBuilder()
      .setTitle('⚖️ Yeni Sorgu Başladı')
      .setDescription(`**${targetMember.user.tag}** adlı kullanıcı hapise atıldı ve sorgusu başladı.\n\nSorguyu devralıp müvekkili savunmak ister misiniz?\nKabul ederseniz **Avukat XP** kazanacaksınız.`)
      .setColor(0xf1c40f)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`avukat_accept_${targetUserId}_${channelId}`)
        .setLabel('✅ Sorguyu Devral')
        .setStyle(ButtonStyle.Success)
    );

    for (const [_, lawyer] of activeLawyers) {
      await lawyer.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
  } catch (err) {
    console.error('[interrogationService] Error notifying lawyers:', err);
  }
}

/**
 * Handles the lawyer accepting the interrogation.
 */
async function handleLawyerAcceptButton(interaction) {
  const parts = interaction.customId.split('_');
  const targetUserId = parts[2];
  const channelId = parts[3];

  const interrogation = activeInterrogations.get(targetUserId);

  if (!interrogation || interrogation.channelId !== channelId) {
    await interaction.update({ components: [] }).catch(() => {});
    return interaction.followUp({ content: '❌ Bu sorgu süreci artık aktif değil veya çoktan kapatılmış.', ephemeral: true });
  }

  if (interrogation.lawyerId) {
    await interaction.update({ components: [] }).catch(() => {});
    return interaction.followUp({ content: '⚠️ Bu sorguyu zaten başka bir avukat devralmış.', ephemeral: true });
  }

  // Assign lawyer
  interrogation.lawyerId = interaction.user.id;

  try {
    const guild = await interaction.client.guilds.fetch(interrogation.guildId).catch(() => null);
    if (guild) {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel) {
        // Grant permissions to the lawyer
        await channel.permissionOverwrites.create(interaction.user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        }).catch(() => {});

        // Add 50 XP to Lawyer
        let dbUser = await User.findOne({ discordId: interaction.user.id });
        if (dbUser) {
          dbUser.gamificationXp = (dbUser.gamificationXp || 0) + 50;
          await dbUser.save();
        }

        const embed = new EmbedBuilder()
          .setTitle('⚖️ Avukat Atandı')
          .setDescription(`Avukat <@${interaction.user.id}> davayı devraldı!`)
          .setColor(0x2ecc71)
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
      }
    }

    await interaction.update({
      content: '✅ Sorguyu başarıyla devraldınız ve **50 XP** kazandınız. Lütfen sunucudaki sorgu kanalına gidin.',
      embeds: [],
      components: []
    }).catch(() => {});

  } catch (err) {
    console.error('[interrogationService] Error accepting lawyer:', err);
  }
}

/**
 * Handles conversion to investigation.
 */
async function handleConvertInvestigationButton(interaction) {
  const targetUserId = interaction.customId.replace('interrogation_convert_', '');
  const interrogation = activeInterrogations.get(targetUserId);

  if (!interrogation) {
    return interaction.reply({ content: '❌ Bu sorgu süreci bulunamadı.', ephemeral: true });
  }

  const isLawyer = interrogation.lawyerId === interaction.user.id;
  const isMod = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
  
  if (!isLawyer && !isMod) {
    return interaction.reply({ content: '❌ Bu işlemi sadece davaya atanan Avukat veya yetkililer yapabilir.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const channel = interaction.channel;
    const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    const username = targetMember ? targetMember.user.username : targetUserId;

    await channel.setName(`sorusturma-${username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`).catch(() => {});
    
    interrogation.status = 'sorusturma';

    const embed = new EmbedBuilder()
      .setTitle('⚖️ Dava Soruşturmaya Çevrildi')
      .setDescription(`Bu durum artık basit bir sorgudan çıkıp **Resmi Soruşturma** statüsüne yükseltilmiştir.\n<@${interaction.user.id}> tarafından işlem uygulandı.`)
      .setColor(0xe67e22)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });

    // Inform target
    if (targetMember) {
      await targetMember.send(`⚠️ **Dikkat:** Hakkınızdaki sorgu, avukatınız veya yetkililer tarafından **Soruşturma** statüsüne çevrilmiştir. Lütfen durumun ciddiyetini kavrayın.`).catch(() => {});
    }

  } catch (err) {
    console.error('[interrogationService] Error converting to investigation:', err);
    return interaction.editReply({ content: '❌ İşlem başarısız oldu.' });
  }
}

/**
 * Handles closing the interrogation.
 */
async function handleCloseInterrogationButton(interaction) {
  const targetUserId = interaction.customId.replace('interrogation_close_', '');
  const interrogation = activeInterrogations.get(targetUserId);

  if (!interrogation) {
    return interaction.reply({ content: '❌ Zaten kapalı.', ephemeral: true });
  }

  await interaction.reply({ content: '🔒 Sorgu kanalı kapatılıyor...' });

  activeInterrogations.delete(targetUserId);

  try {
    // Notify user
    const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
    if (targetUser) {
      await targetUser.send(`🔒 **Sorgu Süreciniz Sona Erdi.** Teşekkür ederiz.`).catch(() => {});
    }

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  } catch (err) {
    console.error('[interrogationService] Error closing interrogation:', err);
  }
}

/**
 * Route DM messages to the interrogation channel.
 */
async function routeInterrogationDM(message) {
  const targetUserId = message.author.id;
  const interrogation = activeInterrogations.get(targetUserId);
  if (!interrogation) return false; // Not in interrogation

  try {
    const client = getDiscordClient();
    const guild = await client.guilds.fetch(interrogation.guildId).catch(() => null);
    if (!guild) return true;

    const channel = await guild.channels.fetch(interrogation.channelId).catch(() => null);
    if (!channel) return true;

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${message.author.tag} (Mahkum)`, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content || '*(ek dosya)*')
      .setColor(0x95a5a6)
      .setTimestamp();

    const sendOpts = { embeds: [embed] };
    if (message.attachments.size > 0) {
      sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
    }

    await channel.send(sendOpts).catch(() => {});
    await message.react('✅').catch(() => {});

    return true; // message handled
  } catch (err) {
    console.error('[interrogationService] Error routing DM:', err);
    return true;
  }
}

/**
 * Route Interrogation Channel messages to the jailed user's DM.
 */
async function routeInterrogationChannelMessage(message) {
  // If the message is in an active interrogation channel
  const channelId = message.channel.id;
  
  let targetUserId = null;
  for (const [uid, info] of activeInterrogations.entries()) {
    if (info.channelId === channelId) {
      targetUserId = uid;
      break;
    }
  }

  if (!targetUserId) return false;

  try {
    const targetUser = await message.client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return true;

    const isLawyer = activeInterrogations.get(targetUserId).lawyerId === message.author.id;
    const authorRole = isLawyer ? 'Avukat' : 'Yetkili';

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${message.author.displayName} — ${authorRole}`, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content || '*(ek dosya)*')
      .setColor(isLawyer ? 0xf1c40f : 0xe74c3c)
      .setTimestamp();

    const sendOpts = { embeds: [embed] };
    if (message.attachments.size > 0) {
      sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
    }

    await targetUser.send(sendOpts).catch(() => {});
    await message.react('✅').catch(() => {});
    return true;
  } catch (err) {
    console.error('[interrogationService] Error routing channel message:', err);
    return true;
  }
}

module.exports = {
  handleSorgulaButton,
  handleLawyerAcceptButton,
  handleConvertInvestigationButton,
  handleCloseInterrogationButton,
  routeInterrogationDM,
  routeInterrogationChannelMessage
};
