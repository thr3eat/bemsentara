'use strict';

const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionFlagsBits 
} = require('discord.js');
const mongoose = require('mongoose');
const Investigation = require('../../models/Investigation');
const { chatWithAI } = require('./aiService');
const { ROLES } = require('./staffSystem');

const STAFF_GUILD_ID = process.env.STAFF_GUILD_ID || '1367646464804655104';

/**
 * Sets up the initial Soruşturma Başlat button in the config channel
 */
async function setupTriggerButton(client) {
  try {
    const channel = await client.channels.fetch("1523809094249746492").catch(() => null);
    if (channel && channel.isTextBased()) {
      const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
      const exists = messages && messages.some(m => m.components.some(row => row.components.some(c => c.customId === 'investigation_start_trigger')));
      if (!exists) {
        const embed = new EmbedBuilder()
          .setTitle("🛡️ Soruşturma & Disiplin Yönetim Sistemi")
          .setDescription(
            "Bir üyenin kural ihlali veya suistimal durumu hakkında resmi soruşturma başlatmak için aşağıdaki butona tıklayın.\n\n" +
            "⚠️ **Yetki Sınırı:** Bu aracı sadece moderatörler ve yöneticiler kullanabilir."
          )
          .setColor(0xc0392b)
          .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("investigation_start_trigger")
            .setLabel("🔍 Soruşturma Başlat")
            .setStyle(ButtonStyle.Danger)
        );
        await channel.send({ embeds: [embed], components: [row] });
      }
    }
  } catch (err) {
    console.error("[investigationService] setupTriggerButton error:", err.message);
  }
}

/**
 * Starts a new investigation channel and dispatches agreement DM to target user
 */
async function startInvestigation(interaction, name, targetUserId, reason) {
  const client = interaction.client;
  const guild = client.guilds.cache.get(STAFF_GUILD_ID);
  if (!guild) {
    return interaction.editReply({ content: "❌ Sunucu bulunamadı." });
  }

  // Verify target user is in the guild
  const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
  if (!targetMember) {
    return interaction.editReply({ content: "❌ Girdiğiniz kullanıcı ID'si sunucuda bulunamadı. Lütfen geçerli bir ID girin." });
  }

  // Find or create category SORUŞTURMALAR
  let category = guild.channels.cache.find(c => c.name === "SORUŞTURMALAR" && c.type === ChannelType.GuildCategory);
  if (!category) {
    category = await guild.channels.create({
      name: "SORUŞTURMALAR",
      type: ChannelType.GuildCategory
    }).catch(() => null);
  }

  // Build permissions
  const staffRoleIds = Object.values(ROLES).filter(Boolean);
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    }
  ];

  for (const roleId of staffRoleIds) {
    permissionOverwrites.push({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  // Create Channel
  const cleanName = `sorusturma-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const channel = await guild.channels.create({
    name: cleanName,
    type: ChannelType.GuildText,
    parent: category ? category.id : null,
    permissionOverwrites
  }).catch(err => {
    console.error("[investigationService] Channel creation failed:", err.message);
    return null;
  });

  if (!channel) {
    return interaction.editReply({ content: "❌ Özel kanal oluşturulurken bir hata oluştu." });
  }

  // Save to DB
  const invest = await Investigation.create({
    channelId: channel.id,
    name,
    targetUserId,
    reason,
    creatorId: interaction.user.id,
    status: 'pending_agreement'
  });

  // Post initial messages to investigation channel
  const introEmbed = new EmbedBuilder()
    .setTitle(`🔍 Soruşturma Başlatıldı: ${name}`)
    .setColor(0xf39c12)
    .addFields(
      { name: "Soruşturulan Kullanıcı", value: `<@${targetUserId}> (\`${targetUserId}\`)`, inline: true },
      { name: "Soruşturmayı Başlatan", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Neden", value: reason, inline: false },
      { name: "Durum", value: "DM Onayı Bekleniyor...", inline: true }
    )
    .setTimestamp();

  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`invest_close_${channel.id}`)
      .setLabel("❌ Soruşturmayı İptal Et/Kapat")
      .setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [introEmbed], components: [controlRow] });

  // Send DM to target user with rich aesthetic embed
  const dmEmbed = new EmbedBuilder()
    .setTitle("🚨 HAKKINIZDA RESMİ SORUŞTURMA BAŞLATILDI!")
    .setColor(0xd63031)
    .setDescription(
      `Merhaba <@${targetUserId}>,\n\n` +
      `**Eko Yıldız** yönetimi tarafından hakkınızda disiplin soruşturması açılmıştır.\n\n` +
      `📁 **Soruşturma Başlığı:** \`${name}\`\n` +
      `🛡️ **Başlatan Yetkili:** <@${interaction.user.id}>\n` +
      `📋 **Gerekçe/Neden:** *"${reason}"*\n\n` +
      `⚖️ **Soruşturma Süreci:**\n` +
      `Soruşturma süresince aktif bir yetkilimiz **Hakim** olarak atanacak ve savunmanızı alacaktır. ` +
      `Lütfen **Eko Yıldız Kuralları** çerçevesinde savunma yapın.\n\n` +
      `👉 Soruşturma kanalına katılmak ve süreci başlatmak için aşağıdaki **Kabul Et** butonuna tıklayın. ` +
      `Soruşturmayı reddetmeniz durumunda sunucudan uzaklaştırılacaksınız.`
    )
    .setThumbnail(guild.iconURL({ size: 128 }))
    .setFooter({ text: "Eko Yıldız Adalet Departmanı" })
    .setTimestamp();

  const agreementRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`invest_agree_${channel.id}`)
      .setLabel("✅ Kabul Et")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`invest_reject_${channel.id}`)
      .setLabel("❌ Reddet")
      .setStyle(ButtonStyle.Danger)
  );

  let dmSent = true;
  try {
    await targetMember.send({ embeds: [dmEmbed], components: [agreementRow] });
  } catch (err) {
    console.warn(`[investigationService] Could not send DM to target user ${targetUserId}:`, err.message);
    dmSent = false;
  }

  if (dmSent) {
    return interaction.editReply({ content: `✅ Soruşturma kanalı oluşturuldu: ${channel.toString()} ve kullanıcının DM onayına sunuldu.` });
  } else {
    // If DM failed, print notice to channel
    await channel.send(`⚠️ **Kullanıcının DM kutusu kapalı olduğu için soruşturma bildirimi iletilemedi.** Lütfen kullanıcıyla iletişime geçin.`);
    return interaction.editReply({ content: `⚠️ Kanal oluşturuldu: ${channel.toString()}, ancak kullanıcının DM'leri kapalı.` });
  }
}

/**
 * Handles target user clicking Accept/Reject in DMs
 */
async function handleAgreement(interaction, channelId, accepted) {
  const client = interaction.client;
  const invest = await Investigation.findOne({ channelId });
  if (!invest) {
    return interaction.reply({ content: "❌ Soruşturma bulunamadı veya geçerliliğini kaybetmiş.", ephemeral: true });
  }

  if (invest.status !== 'pending_agreement') {
    return interaction.reply({ content: "❌ Bu soruşturmanın onay süreci zaten tamamlanmış.", ephemeral: true });
  }

  const guild = client.guilds.cache.get(STAFF_GUILD_ID);
  const targetMember = guild ? await guild.members.fetch(invest.targetUserId).catch(() => null) : null;
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (accepted) {
    // Target user accepted
    invest.status = 'ongoing';
    await invest.save();

    // Give view permission on the channel
    if (channel && targetMember) {
      await channel.permissionOverwrites.create(targetMember, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      }).catch(() => {});

      // Post status update to channel
      const startEmbed = new EmbedBuilder()
        .setTitle("✅ Soruşturma Başladı")
        .setDescription(`<@${invest.targetUserId}> soruşturmayı kabul etti ve kanal erişimi açıldı. Soruşturma süreci başladı!`)
        .setColor(0x2ecc71)
        .setTimestamp();
      await channel.send({ embeds: [startEmbed] });

      // Assign Judge
      await assignRandomJudge(guild, invest, channel);
    }

    const acceptEmbed = new EmbedBuilder()
      .setTitle("✅ Soruşturma Kabul Edildi")
      .setDescription("Soruşturma talebini onayladınız. Soruşturma kanalına dahil edildiniz. Buradan veya oradan mesaj yazarak sürece başlayabilirsiniz.")
      .setColor(0x2ecc71)
      .setTimestamp();
    await interaction.update({ embeds: [acceptEmbed], components: [] }).catch(() => {});
  } else {
    // Target user rejected
    invest.rejectCount = (invest.rejectCount || 0) + 1;
    await invest.save();

    if (invest.rejectCount < 3) {
      // Prompt again
      const warningEmbed = new EmbedBuilder()
        .setTitle(`⚠️ SORUŞTURMAYI REDDETMEK YASAKTIR! (${invest.rejectCount}/3)`)
        .setDescription(
          `Disiplin soruşturmasını reddetme hakkınız bulunmamaktadır.\n\n` +
          `Eğer **3 kez** reddederseniz, soruşturma **otomatik olarak kabul edilmiş** sayılacak ve yargılama süreci başlayacaktır.\n\n` +
          `Lütfen aşağıdaki **Kabul Et** butonuna tıklayarak soruşturmayı onaylayın.`
        )
        .setColor(0xe74c3c)
        .setTimestamp();

      const agreementRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`invest_agree_${channelId}`)
          .setLabel("✅ Kabul Et")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`invest_reject_${channelId}`)
          .setLabel("❌ Reddet")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.update({ embeds: [warningEmbed], components: [agreementRow] }).catch(() => {});

      if (channel) {
        await channel.send(`⚠️ Kullanıcı soruşturma davetini reddetti (Reddetme sayısı: **${invest.rejectCount}/3**). Tekrar onay kutusu gönderildi.`);
      }
    } else {
      // Auto accept after 3 rejections
      invest.status = 'ongoing';
      await invest.save();

      if (channel && targetMember) {
        await channel.permissionOverwrites.create(targetMember, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        }).catch(() => {});

        const autoAcceptEmbed = new EmbedBuilder()
          .setTitle("🚨 Otomatik Kabul Edildi")
          .setDescription(`<@${invest.targetUserId}> soruşturmayı 3 kez reddettiği için süreç **OTOMATİK KABUL** edilerek başlatıldı.`)
          .setColor(0xe74c3c)
          .setTimestamp();
        await channel.send({ embeds: [autoAcceptEmbed] });

        // Assign Judge
        await assignRandomJudge(guild, invest, channel);
      }

      const forceEmbed = new EmbedBuilder()
        .setTitle("🚨 Soruşturma Otomatik Kabul Edildi")
        .setDescription(
          `Soruşturma davetini 3 kez reddettiğiniz için süreç **otomatik olarak kabul edildi**.\n\n` +
          `Soruşturma kanalına dahil edildiniz.`
        )
        .setColor(0xe74c3c)
        .setTimestamp();
      await interaction.update({ embeds: [forceEmbed], components: [] }).catch(() => {});
    }
  }
}

/**
 * Randomly assigns a Judge to the investigation
 */
async function assignRandomJudge(guild, invest, channel) {
  try {
    const staffRoleIds = Object.values(ROLES).filter(Boolean);
    const members = await guild.members.fetch();
    
    // Filter staff members excluding bot, target, and creator
    const staffMembers = Array.from(members.values()).filter(m => {
      if (m.user.bot || m.id === invest.targetUserId || m.id === invest.creatorId) return false;
      return staffRoleIds.some(roleId => m.roles.cache.has(roleId));
    });

    if (staffMembers.length === 0) {
      await channel.send("⚠️ Soruşturmaya atanacak uygun moderatör/yetkili bulunamadı.");
      return;
    }

    // Try to pick online/active staff
    const activeStaff = staffMembers.filter(m => m.presence && ['online', 'idle', 'dnd'].includes(m.presence.status));
    const selectedJudge = activeStaff.length > 0
      ? activeStaff[Math.floor(Math.random() * activeStaff.length)]
      : staffMembers[Math.floor(Math.random() * staffMembers.length)];

    invest.judgeId = selectedJudge.id;
    await invest.save();

    // Allow judge permission in channel
    await channel.permissionOverwrites.create(selectedJudge, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});

    // Notify judge in DM with premium embed
    const judgeEmbed = new EmbedBuilder()
      .setTitle("⚖️ SORUŞTURMA HAKİMİ ATANDINIZ!")
      .setColor(0x3498db)
      .setDescription(
        `Sayın yetkili,\n\n` +
        `**Eko Yıldız** Soruşturma Yönetim Sistemi tarafından aşağıdaki soruşturmaya **Hakim** olarak atandınız:\n\n` +
        `📂 **Soruşturma Başlığı:** \`${invest.name}\`\n` +
        `👤 **Soruşturulan Kullanıcı:** <@${invest.targetUserId}>\n` +
        `🛡️ **Başlatan Yetkili:** <@${invest.creatorId}>\n` +
        `📋 **Gerekçe/Neden:** *"${invest.reason}"*\n\n` +
        `Lütfen soruşturma kanalına giderek adil ve tarafsız bir şekilde süreci yönetin: ${channel.toString()}`
      )
      .setTimestamp();
    
    await selectedJudge.send({ embeds: [judgeEmbed] }).catch(() => {});

    // Alert in channel
    const alertEmbed = new EmbedBuilder()
      .setTitle("⚖️ Hakim Atandı")
      .setDescription(`Bu soruşturmanın hakimi olarak <@${selectedJudge.id}> atanmıştır.`)
      .setColor(0x3498db)
      .setTimestamp();
    
    await channel.send({ embeds: [alertEmbed] });

    // Update controls row in the channel to show management options
    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`invest_resolve_${channel.id}`)
        .setLabel("⚖️ Çözüme Kavuştur")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`invest_addmember_${channel.id}`)
        .setLabel("👥 Kişi Ekle")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`invest_removemember_${channel.id}`)
        .setLabel("👤 Kişi Çıkar")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`invest_close_${channel.id}`)
        .setLabel("❌ Kapat")
        .setStyle(ButtonStyle.Secondary)
    );
    await channel.send({ content: "💬 **Soruşturma Yönetim Butonları:**", components: [controlRow] });

  } catch (err) {
    console.error("[investigationService] assignRandomJudge error:", err.message);
  }
}

/**
 * Syncs message between DM and channel
 */
async function handleMessageSync(message) {
  const client = message.client;

  if (message.author.bot) return;

  // 1) DM -> Investigation Channel Sync
  if (message.channel.type === ChannelType.DM) {
    const invest = await Investigation.findOne({
      targetUserId: message.author.id,
      status: 'ongoing',
      syncEnabled: true
    });

    if (invest) {
      const channel = await client.channels.fetch(invest.channelId).catch(() => null);
      if (channel) {
        // Log to DB
        invest.messages.push({
          senderId: message.author.id,
          senderName: message.author.username,
          content: message.content
        });
        invest.lastMessageAt = new Date();
        await invest.save();

        const syncEmbed = new EmbedBuilder()
          .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
          .setDescription(message.content || "*Mesaj içeriği boş veya sadece görsel/ek içeriyor*")
          .setColor(0x1abc9c)
          .setFooter({ text: "Soruşturulan Kullanıcı DM Mesajı" })
          .setTimestamp();

        // Handle attachments if any
        if (message.attachments.size > 0) {
          syncEmbed.setImage(message.attachments.first().url);
        }

        await channel.send({ embeds: [syncEmbed] });
      }
    }
    return;
  }

  // 2) Investigation Channel -> DM Sync
  const channelInvest = await Investigation.findOne({
    channelId: message.channel.id,
    status: 'ongoing',
    syncEnabled: true
  });

  if (channelInvest) {
    // Log to DB
    channelInvest.messages.push({
      senderId: message.author.id,
      senderName: message.author.username,
      content: message.content
    });
    channelInvest.lastMessageAt = new Date();
    await channelInvest.save();

    // Fetch target user and send DM
    const targetUser = await client.users.fetch(channelInvest.targetUserId).catch(() => null);
    if (targetUser) {
      const roleLabel = message.author.id === channelInvest.judgeId ? "⚖️ Hakim" : "🛡️ Yetkili";
      const syncEmbed = new EmbedBuilder()
        .setAuthor({ name: `${roleLabel} - ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(message.content || "*Mesaj içeriği boş veya sadece görsel/ek içeriyor*")
        .setColor(0x34495e)
        .setFooter({ text: `Soruşturma: ${channelInvest.name}` })
        .setTimestamp();

      if (message.attachments.size > 0) {
        syncEmbed.setImage(message.attachments.first().url);
      }

      await targetUser.send({ embeds: [syncEmbed] }).catch(err => {
        console.warn(`[investigationService] Failed to send synced message to user DM:`, err.message);
      });
    }
  }
}

/**
 * Periodically checks for idle target users (15-min warning/suspend)
 */
async function checkInactivityTimers(client) {
  try {
    const ongoing = await Investigation.find({ status: 'ongoing' });
    const now = Date.now();

    for (const invest of ongoing) {
      const lastMessageTime = new Date(invest.lastMessageAt).getTime();
      const idleTimeMs = now - lastMessageTime;

      // Check if last message was sent by a staff member (not target user)
      if (invest.messages.length > 0) {
        const lastMsg = invest.messages[invest.messages.length - 1];
        if (lastMsg.senderId === invest.targetUserId) {
          // Last response was from the target user. Reset or do nothing.
          continue;
        }
      }

      // 15 Minutes Inactivity Warn & Pause
      if (idleTimeMs >= 15 * 60 * 1000) {
        invest.status = 'paused';
        invest.syncEnabled = false;
        await invest.save();

        const channel = await client.channels.fetch(invest.channelId).catch(() => null);
        const targetUser = await client.users.fetch(invest.targetUserId).catch(() => null);

        if (channel) {
          const pauseEmbed = new EmbedBuilder()
            .setTitle("🛑 Soruşturma Duraklatıldı")
            .setDescription(
              `⚠️ Soruşturulan <@${invest.targetUserId}> kullanıcısı 15 dakika boyunca savunma yapmadığı için soruşturma **DURAKLATILDI**.\n\n` +
              `Mesaj aktarımı ve senkronizasyon geçici olarak kapatılmıştır. Soruşturmayı devam ettirmek için aşağıdaki butonu kullanabilirsiniz.`
            )
            .setColor(0xe74c3c)
            .setTimestamp();

          const resumeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`invest_resume_${channel.id}`)
              .setLabel("▶️ Soruşturmayı Devam Ettir")
              .setStyle(ButtonStyle.Success)
          );

          await channel.send({ embeds: [pauseEmbed], components: [resumeRow] });
        }

        if (targetUser) {
          await targetUser.send(
            `⚠️ **Soruşturma beklemede!**\n` +
            `Soruşturma kanalında sorulan sorulara 15 dakika içinde yanıt vermediğiniz için soruşturmanız duraklatılmıştır. ` +
            `Lütfen yetkililerle irtibata geçin.`
          ).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("[investigationService] Inactivity checks error:", err.message);
  }
}

/**
 * Resumes a paused investigation
 */
async function resumeInvestigation(interaction, channelId) {
  const invest = await Investigation.findOne({ channelId });
  if (!invest) {
    return interaction.reply({ content: "❌ Soruşturma bulunamadı.", ephemeral: true });
  }

  invest.status = 'ongoing';
  invest.syncEnabled = true;
  invest.lastMessageAt = new Date();
  await invest.save();

  const embed = new EmbedBuilder()
    .setTitle("▶️ Soruşturma Devam Ediyor")
    .setDescription("Soruşturma aktif edildi. DM senkronizasyonu ve mesaj aktarımı yeniden başlatıldı.")
    .setColor(0x2ecc71)
    .setTimestamp();
  
  await interaction.update({ components: [] }).catch(() => {});
  await interaction.channel.send({ embeds: [embed] });

  const targetUser = await interaction.client.users.fetch(invest.targetUserId).catch(() => null);
  if (targetUser) {
    await targetUser.send("▶️ **Soruşturmanız yeniden başlatıldı!** Yetkili savunmanızı almaya devam ediyor. Lütfen seste veya DM'de aktif olun.").catch(() => {});
  }
}

/**
 * Adds another moderator/staff to the investigation channel
 */
async function addMemberToInvestigation(interaction, channelId, userId) {
  const invest = await Investigation.findOne({ channelId });
  if (!invest) return interaction.reply({ content: "❌ Soruşturma bulunamadı.", ephemeral: true });

  const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!targetMember) {
    return interaction.reply({ content: "❌ Girdiğiniz üye sunucuda bulunamadı.", ephemeral: true });
  }

  if (invest.addedModerators.includes(userId) || userId === invest.creatorId || userId === invest.judgeId) {
    return interaction.reply({ content: "❌ Bu kişi zaten soruşturmaya dahil edilmiş.", ephemeral: true });
  }

  invest.addedModerators.push(userId);
  await invest.save();

  // Allow permission
  await interaction.channel.permissionOverwrites.create(targetMember, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  }).catch(() => {});

  // Send DM to added user
  const addedEmbed = new EmbedBuilder()
    .setTitle("👥 Soruşturmaya Dahil Edildiniz")
    .setDescription(
      `Sayın yetkili,\n\n` +
      `**Eko Yıldız** bünyesindeki <@${invest.targetUserId}> kullanıcısının **"${invest.name}"** nolu soruşturmasına <@${interaction.user.id}> tarafından dahil edildiniz.\n\n` +
      `Kanal linki: ${interaction.channel.toString()}`
    )
    .setColor(0xe67e22)
    .setTimestamp();
  await targetMember.send({ embeds: [addedEmbed] }).catch(() => {});

  await interaction.reply({ content: `✅ <@${userId}> başarıyla soruşturma kanalına eklendi ve bilgilendirildi.` });
}

/**
 * Removes a moderator/staff from the investigation channel
 */
async function removeMemberFromInvestigation(interaction, channelId, userId) {
  const invest = await Investigation.findOne({ channelId });
  if (!invest) return interaction.reply({ content: "❌ Soruşturma bulunamadı.", ephemeral: true });

  if (!invest.addedModerators.includes(userId)) {
    return interaction.reply({ content: "❌ Bu üye soruşturmada ekli değil.", ephemeral: true });
  }

  invest.addedModerators = invest.addedModerators.filter(id => id !== userId);
  await invest.save();

  const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);
  if (targetMember) {
    // Reset permissions
    await interaction.channel.permissionOverwrites.delete(targetMember).catch(() => {});
    
    // Notify in DM
    await targetMember.send(`👤 **"${invest.name}"** nolu soruşturmadan çıkarıldınız. Soruşturma kanalı erişiminiz kapatılmıştır.`).catch(() => {});
  }

  await interaction.reply({ content: `✅ <@${userId}> başarıyla soruşturma kanalından çıkarıldı.` });
}

/**
 * Resolves investigation by applying penalty, archiving and writing logs
 */
async function resolveInvestigation(interaction, channelId, penaltyType, penaltyDetails) {
  const client = interaction.client;
  const invest = await Investigation.findOne({ channelId });
  if (!invest) return interaction.reply({ content: "❌ Soruşturma bulunamadı.", ephemeral: true });

  const guild = client.guilds.cache.get(STAFF_GUILD_ID);
  const targetMember = await guild.members.fetch(invest.targetUserId).catch(() => null);

  let penaltyResult = "";
  let errorLog = "";

  if (targetMember) {
    try {
      if (penaltyType === 'CEZASIZ') {
        penaltyResult = "Ceza uygulanmamasına karar verildi (Cezasız kapatıldı).";
      } else if (penaltyType === 'MUTE') {
        const hours = parseInt(penaltyDetails, 10) || 1;
        await targetMember.timeout(hours * 60 * 60 * 1000, `Soruşturma Cezası: ${invest.name} — Hakim: ${interaction.user.tag}`);
        penaltyResult = `🔇 Kullanıcıya **${hours} saat** boyunca Mute (Zamanaşımı) uygulandı.`;
      } else if (penaltyType === 'KICK') {
        await targetMember.kick(`Soruşturma Cezası: ${invest.name} — Hakim: ${interaction.user.tag}`);
        penaltyResult = "🥾 Kullanıcı sunucudan atıldı (Kick).";
      } else if (penaltyType === 'BAN') {
        const days = parseInt(penaltyDetails, 10) || 1;
        await targetMember.ban({ deleteMessageSeconds: 0, reason: `Soruşturma Cezası: ${invest.name} (Süre: ${days} gün) — Hakim: ${interaction.user.tag}` });
        penaltyResult = `🚫 Kullanıcı sunucudan **${days} gün** boyunca yasaklandı (Ban).`;
      } else if (penaltyType === 'HAPIS') {
        const days = parseInt(penaltyDetails, 10) || 1;
        const { jailUser } = require('./jailService');
        const jailSuccess = await jailUser(client, guild, invest.targetUserId, `Soruşturma Cezası: ${invest.name}`, days * 24 * 60, interaction.user.id);
        if (jailSuccess) {
          penaltyResult = `🔒 Kullanıcı **${days} gün** süreyle hapishaneye gönderildi.`;
        } else {
          penaltyResult = "⚠️ Hapis cezası sistemi üzerinden uygulanamadı, manuel işlem gerekebilir.";
        }
      }
    } catch (err) {
      errorLog = `Ceza uygulanırken hata oluştu: ${err.message}`;
      console.error("[investigationService] Penalty application error:", err.message);
    }
  } else {
    penaltyResult = "⚠️ Kullanıcı sunucudan ayrıldığı için ceza uygulanamadı.";
  }

  // Update status in DB
  invest.status = 'resolved';
  invest.penaltyApplied = `${penaltyType}: ${penaltyDetails || ''}`;
  await invest.save();

  // Send DM notice to target user if not banned/kicked
  if (targetMember && penaltyType !== 'KICK' && penaltyType !== 'BAN') {
    const notifyEmbed = new EmbedBuilder()
      .setTitle("⚖️ Soruşturmanız Karara Bağlandı")
      .setDescription(
        `**Eko Yıldız** bünyesinde hakkınızda yürütülen **"${invest.name}"** soruşturması tamamlanmıştır.\n\n` +
        `**Hakim Kararı:** ${penaltyResult}\n` +
        `**Hakim:** <@${interaction.user.id}>`
      )
      .setColor(0x27ae60)
      .setTimestamp();
    await targetMember.send({ embeds: [notifyEmbed] }).catch(() => {});
  }

  // Post final decision in channel
  const resultEmbed = new EmbedBuilder()
    .setTitle("⚖️ Soruşturma Karara Bağlandı")
    .setColor(0x27ae60)
    .addFields(
      { name: "Karar", value: penaltyResult || "Belirtilmedi", inline: false },
      { name: "Hakim", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Gerekçe", value: invest.reason, inline: true }
    )
    .setTimestamp();
  
  if (errorLog) {
    resultEmbed.addFields({ name: "⚠️ Hata Raporu", value: errorLog, inline: false });
  }

  await interaction.channel.send({ embeds: [resultEmbed] });

  // Generate Transcript Log
  let transcript = `SORUSTURMA RAPORU: ${invest.name}\n`;
  transcript += `=========================================\n`;
  transcript += `Soruşturulan Kullanıcı ID: ${invest.targetUserId}\n`;
  transcript += `Soruşturmayı Başlatan ID: ${invest.creatorId}\n`;
  transcript += `Hakim ID: ${invest.judgeId}\n`;
  transcript += `Neden: ${invest.reason}\n`;
  transcript += `Uygulanan Karar: ${penaltyType} (${penaltyDetails || 'Detay yok'})\n`;
  transcript += `Tarih: ${new Date().toISOString()}\n`;
  transcript += `=========================================\n\n`;
  transcript += `MESAJ GEÇMİŞİ:\n`;

  for (const msg of invest.messages) {
    transcript += `[${new Date(msg.timestamp).toISOString()}] ${msg.senderName} (${msg.senderId}): ${msg.content}\n`;
  }

  const buffer = Buffer.from(transcript, 'utf-8');

  // Archive Channel
  let archiveCategory = guild.channels.cache.find(c => c.name === "SORUŞTURMA ARŞİVİ" && c.type === ChannelType.GuildCategory);
  if (!archiveCategory) {
    archiveCategory = await guild.channels.create({
      name: "SORUŞTURMA ARŞİVİ",
      type: ChannelType.GuildCategory
    }).catch(() => null);
  }

  if (archiveCategory) {
    await interaction.channel.setParent(archiveCategory.id, { lockPermissions: false }).catch(() => {});
  }

  // Deny target user and judge permissions to prevent further typing
  if (targetMember) {
    await interaction.channel.permissionOverwrites.create(targetMember, {
      SendMessages: false,
      ViewChannel: true
    }).catch(() => {});
  }
  const judgeMember = await guild.members.fetch(invest.judgeId).catch(() => null);
  if (judgeMember) {
    await interaction.channel.permissionOverwrites.create(judgeMember, {
      SendMessages: false,
      ViewChannel: true
    }).catch(() => {});
  }

  // Send Transcript File
  await interaction.channel.send({ 
    content: "📁 **Soruşturma tamamlandı. Mesaj kayıt dosyası ekte sunulmuştur:**", 
    files: [{ attachment: buffer, name: `sorusturma-${invest.name}-log.txt` }] 
  });

  // Pin restart button
  const restartRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`invest_restart_${channelId}`)
      .setLabel("🔄 Soruşturmayı Yeniden Başlat")
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.channel.send({ content: "⚠️ Gerekirse bu soruşturma süreci yeniden başlatılabilir:", components: [restartRow] });
}

/**
 * Restarts a resolved/archived investigation
 */
async function restartInvestigation(interaction, channelId) {
  const client = interaction.client;
  const invest = await Investigation.findOne({ channelId });
  if (!invest) return interaction.reply({ content: "❌ Soruşturma bulunamadı.", ephemeral: true });

  const guild = client.guilds.cache.get(STAFF_GUILD_ID);

  invest.status = 'ongoing';
  invest.syncEnabled = true;
  invest.lastMessageAt = new Date();
  await invest.save();

  // Move back to active category
  let category = guild.channels.cache.find(c => c.name === "SORUŞTURMALAR" && c.type === ChannelType.GuildCategory);
  if (category) {
    await interaction.channel.setParent(category.id, { lockPermissions: false }).catch(() => {});
  }

  // Allow target user & judge permissions again
  const targetMember = await guild.members.fetch(invest.targetUserId).catch(() => null);
  if (targetMember) {
    await interaction.channel.permissionOverwrites.create(targetMember, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  const judgeMember = await guild.members.fetch(invest.judgeId).catch(() => null);
  if (judgeMember) {
    await interaction.channel.permissionOverwrites.create(judgeMember, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  const restartEmbed = new EmbedBuilder()
    .setTitle("🔄 Soruşturma Yeniden Başlatıldı")
    .setDescription("Bu soruşturma süreci yetkili kararıyla yeniden aktif edilmiştir. DM senkronizasyonu aktiftir.")
    .setColor(0x3498db)
    .setTimestamp();

  await interaction.update({ components: [] }).catch(() => {});
  await interaction.channel.send({ embeds: [restartEmbed] });

  if (targetMember) {
    await targetMember.send("🔄 **Soruşturmanız yeniden başlatıldı!** Yetkili savunmanızı almaya devam ediyor. Lütfen seste veya DM'de aktif olun.").catch(() => {});
  }
}

/**
 * Closes an investigation channel completely
 */
async function closeInvestigation(interaction, channelId) {
  const invest = await Investigation.findOne({ channelId });
  if (invest) {
    invest.status = 'closed';
    invest.syncEnabled = false;
    await invest.save();
  }

  await interaction.reply({ content: "🔒 Soruşturma kapatılıyor, kanal 5 saniye içerisinde silinecektir..." });
  
  setTimeout(() => {
    interaction.channel.delete().catch(err => {
      console.error("[investigationService] Channel delete error:", err.message);
    });
  }, 5000);
}

module.exports = {
  setupTriggerButton,
  startInvestigation,
  handleAgreement,
  assignRandomJudge,
  handleMessageSync,
  checkInactivityTimers,
  resumeInvestigation,
  addMemberToInvestigation,
  removeMemberFromInvestigation,
  resolveInvestigation,
  restartInvestigation,
  closeInvestigation
};
