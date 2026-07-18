'use strict';

const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const User = require("../../models/User");

const MODISLEM_ROLE_ID = "1518692389169135666";
const JOP_LOG_CHANNEL_ID = "1527752485261934652";
const JAIL_LOG_CHANNEL_ID = "1527752485261934652";

// In-memory active jail incidents
const activeIncidents = new Map();

/**
 * Configure the Hapis role permissions on all channels.
 * Denies viewing all channels except jail category 1521501154339586078 and its children.
 */
async function setupHapisRoleOverwrites(guild, hapisRole) {
  for (const channel of guild.channels.cache.values()) {
    try {
      const isJailCategory = channel.id === "1521501154339586078";
      const isJailChannel = channel.parentId === "1521501154339586078";
      
      if (isJailCategory || isJailChannel) {
        // Allow View and Send in jail category/channel
        await channel.permissionOverwrites.edit(hapisRole, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        }).catch(() => {});
      } else {
        // Deny ViewChannel on all other channels/categories
        await channel.permissionOverwrites.edit(hapisRole, {
          ViewChannel: false,
          SendMessages: false,
          Connect: false,
          Speak: false
        }).catch(() => {});
      }
    } catch (err) {
      console.warn(`[JailService] Override set error for channel ${channel.name}:`, err.message);
    }
  }
}

/**
 * Jails a user.
 */
async function jailUser(client, guild, userId, reason, durationMinutes, moderatorId) {
  try {
    let dbUser = await User.findOne({ discordId: userId });
    if (!dbUser) {
      dbUser = new User({ discordId: userId, discordUsername: "Bilinmiyor" });
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;

    // Find or create Hapis role
    let hapisRole = guild.roles.cache.find(r => r.name.toLowerCase() === "hapis");
    if (!hapisRole) {
      hapisRole = await guild.roles.create({
        name: "Hapis",
        color: "#808080",
        reason: "Hapis cezası için sistem tarafından otomatik oluşturuldu.",
        position: 1
      }).catch(() => null);
    }

    if (!hapisRole) return false;

    // Always sync permission overwrites to cover any recently created channels
    await setupHapisRoleOverwrites(guild, hapisRole);

    // Save current roles (excluding managed/everyone/hapis role and roles higher than bot) and strip them
    const botHighestRole = guild.members.me.roles.highest;
    const currentRoles = member.roles.cache
      .filter(r => r.id !== guild.id && !r.managed && r.id !== hapisRole.id && botHighestRole.comparePositionTo(r) > 0)
      .map(r => r.id);

    dbUser.isJailed = true;
    dbUser.jailedRoles = currentRoles;
    dbUser.jailedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    dbUser.jailReason = reason;
    dbUser.jailedBy = moderatorId;
    await dbUser.save();

    // Strip roles and add Hapis role
    if (currentRoles.length > 0) {
      await member.roles.remove(currentRoles, `Hapis Cezası: ${reason}`).catch(() => {});
    }
    await member.roles.add(hapisRole, `Hapis Cezası: ${reason}`).catch(() => {});

    // Send DM to target
    await member.send(
      `🔒 **Hapishaneye Gönderildiniz!**\n\n` +
      `**Gerekçe:** ${reason}\n` +
      `**Süre:** ${durationMinutes} dakika\n` +
      `Cezanız bittiğinde rolleriniz iade edilecektir.`
    ).catch(() => {});

    // Log in channel 1527752485261934652
    const logChannel = guild.channels.cache.get(JAIL_LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setTitle("🔒 HAPİS CEZASI UYGULANDI")
        .setColor(0x7f8c8d)
        .addFields(
          { name: "👤 Cezalandırılan Üye", value: `${member.toString()} (\`${member.user.tag}\`)`, inline: true },
          { name: "👮 Yetkili", value: `<@${moderatorId}>`, inline: true },
          { name: "🕒 Süre", value: `${durationMinutes} Dakika (Bitiş: <t:${Math.floor(dbUser.jailedUntil.getTime() / 1000)}:R>)`, inline: true },
          { name: "📋 Gerekçe", value: reason, inline: false }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`jail_sorgula_${userId}`)
          .setLabel("🕵️‍♂️ Hapistekini Sorgula")
          .setStyle(ButtonStyle.Primary)
      );

      await logChannel.send({ embeds: [logEmbed], components: [row] }).catch(() => {});
    }

    return true;
  } catch (err) {
    console.error("[JailService] jailUser error:", err);
    return false;
  }
}

/**
 * Unjails a user.
 */
async function unjailUser(client, guild, userId) {
  try {
    const dbUser = await User.findOne({ discordId: userId });
    if (!dbUser || !dbUser.isJailed) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      const hapisRole = guild.roles.cache.find(r => r.name.toLowerCase() === "hapis");
      if (hapisRole) {
        await member.roles.remove(hapisRole, "Hapis Süresi Bitti").catch(() => {});
      }

      const restoredRoles = dbUser.jailedRoles || [];
      if (restoredRoles.length > 0) {
        // Re-add their old roles
        await member.roles.add(restoredRoles, "Hapis Süresi Bitti (Roller İade Edildi)").catch(() => {});
      }

      await member.send(
        `🔓 **Hapis Cezanız Sona Erdi!**\n\n` +
        `Rolleriniz iade edildi. Lütfen kurallara uymaya özen gösterin.`
      ).catch(() => {});
    }

    dbUser.isJailed = false;
    dbUser.jailedRoles = undefined;
    dbUser.jailedUntil = undefined;
    dbUser.jailReason = undefined;
    dbUser.jailedBy = undefined;
    await dbUser.save();

    // Log unjail
    const logChannel = guild.channels.cache.get(JAIL_LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setTitle("🔓 HAPİS SÜRESİ BİTTİ (TAHLİYE)")
        .setColor(0x2ecc71)
        .setDescription(`👤 **Kullanıcı:** <@${userId}> (\`${userId}\`)\n🔓 Durum: Tahliye edildi ve rolleri iade edildi.`)
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }
  } catch (err) {
    console.error("[JailService] unjailUser error:", err);
  }
}

/**
 * Periodically scans for users whose jail time has expired.
 */
function startJailScheduler(client) {
  console.log("[JailScheduler] Hapis süresi takip zamanlayıcısı başlatıldı.");
  setInterval(async () => {
    try {
      const jailedUsers = await User.find({ isJailed: true });
      if (jailedUsers.length === 0) return;

      const guild = client.guilds.cache.get("1367646464804655104") || client.guilds.cache.first();
      if (!guild) return;

      const now = new Date();
      for (const dbUser of jailedUsers) {
        if (dbUser.jailedUntil && now >= new Date(dbUser.jailedUntil)) {
          console.log(`[JailScheduler] 🔓 Jailed user ${dbUser.discordId} has expired. Unjailing...`);
          await unjailUser(client, guild, dbUser.discordId);
        }
      }
    } catch (err) {
      console.error("[JailScheduler] Error running jail scanner:", err);
    }
  }, 30000);
}

/**
 * Fetch online or idle moderators to assign guards.
 */
async function getOnlineMods(guild, excludeIds = []) {
  const modRole = guild.roles.cache.get(MODISLEM_ROLE_ID);
  if (!modRole) return [];
  
  try {
    await guild.members.fetch().catch(() => {});
  } catch (err) {
    console.warn("[JailService] Failed to fetch members:", err.message);
  }
  
  const onlineMods = modRole.members.filter(member => {
    if (member.user.bot) return false;
    if (excludeIds.includes(member.user.id)) return false;
    
    const presence = member.presence?.status;
    if (presence) {
      return ["online", "idle", "dnd"].includes(presence);
    }
    return true; // fallback to considering active if presence details are cached or not available
  });
  
  return Array.from(onlineMods.values());
}

/**
 * Handles jailed user speech inside jail category.
 * Triggers a guard request and starts the rotation process.
 */
async function handleJailSpeech(message) {
  const userId = message.author.id;
  
  if (activeIncidents.has(userId)) {
    return;
  }
  
  const guild = message.guild;
  const logChannel = guild.channels.cache.get(JOP_LOG_CHANNEL_ID);
  if (!logChannel || !logChannel.isTextBased()) return;
  
  const availableMods = await getOnlineMods(guild);
  let assignedMod = null;
  if (availableMods.length > 0) {
    assignedMod = availableMods[Math.floor(Math.random() * availableMods.length)];
  }
  
  const assignedModId = assignedMod ? assignedMod.id : null;
  const incidentId = `jailincident_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const embed = new EmbedBuilder()
    .setTitle("🚨 HAPİSHANEDE TAŞKINLIK KONTROLÜ")
    .setColor(0xe74c3c)
    .setDescription(`🔒 <@${userId}> isimli mahkum zindanda gürültü yapıyor / konuşuyor!\n\n**Gönderdiği Mesaj:**\n\`\`\`${message.content.slice(0, 500)}\`\`\``)
    .addFields(
      { name: "👮 Nöbetçi Gardiyan", value: assignedModId ? `<@${assignedModId}>` : "@here (Boşta Gardiyan Yok!)", inline: true },
      { name: "⏳ Müdahale Süresi", value: "5 Dakika (Müdahale edilmezse görev devredilir!)", inline: true }
    )
    .setTimestamp();
    
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`jail_act_jopla_${userId}_${incidentId}`)
      .setLabel("💥 JOPLA! (5 dk Sustur)")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`jail_act_hucre_${userId}_${incidentId}`)
      .setLabel("⛓️ HÜCRE HAPSİ (15 dk Sustur)")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`jail_act_sure_${userId}_${incidentId}`)
      .setLabel("⏳ SÜRE UZAT (+30 dk)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`jail_act_kirbac_${userId}_${incidentId}`)
      .setLabel("⚡ KIRBAÇLA (2 dk Sustur)")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`jail_act_tahliye_${userId}_${incidentId}`)
      .setLabel("🔓 TAHLİYE ET")
      .setStyle(ButtonStyle.Success)
  );
  
  const pingContent = assignedModId ? `<@${assignedModId}>` : `<@&${MODISLEM_ROLE_ID}>`;
  const alertMsg = await logChannel.send({ content: `⚠️ **Gardiyan Çağrısı!** ${pingContent}`, embeds: [embed], components: [row] }).catch(() => null);
  if (!alertMsg) return;
  
  const timer = setTimeout(() => {
    rotateIncidentMod(guild.id, userId, incidentId);
  }, 5 * 60 * 1000);
  
  activeIncidents.set(userId, {
    id: incidentId,
    jailedUserId: userId,
    jailedUserTag: message.author.tag,
    channelId: message.channel.id,
    guildId: guild.id,
    messageId: alertMsg.id,
    assignedModId: assignedModId,
    previousModIds: assignedModId ? [assignedModId] : [],
    createdAt: Date.now(),
    timer: timer
  });
}

/**
 * Escalate incident by assigning it to another moderator if the current one has not acted.
 */
async function rotateIncidentMod(guildId, userId, incidentId) {
  const incident = activeIncidents.get(userId);
  if (!incident || incident.id !== incidentId) return;
  
  const { getDiscordClient } = require("../discordClient");
  const client = getDiscordClient();
  const guild = client ? client.guilds.cache.get(guildId) : null;
  if (!guild) return;
  
  const logChannel = guild.channels.cache.get(JOP_LOG_CHANNEL_ID);
  if (!logChannel) return;
  
  const alertMsg = await logChannel.messages.fetch(incident.messageId).catch(() => null);
  if (!alertMsg) return;
  
  const availableMods = await getOnlineMods(guild, incident.previousModIds);
  let newAssignedMod = null;
  if (availableMods.length > 0) {
    newAssignedMod = availableMods[Math.floor(Math.random() * availableMods.length)];
  }
  
  const oldModId = incident.assignedModId;
  const newModId = newAssignedMod ? newAssignedMod.id : null;
  
  incident.assignedModId = newModId;
  if (newModId) {
    incident.previousModIds.push(newModId);
  }
  
  const oldEmbed = alertMsg.embeds[0];
  const newEmbed = EmbedBuilder.from(oldEmbed)
    .setDescription(
      `🔒 <@${userId}> isimli mahkum zindanda gürültü yapmaya devam ediyor!\n\n` +
      `⏰ <@${oldModId}> 5 dakika içinde müdahale etmediği için görev başka bir gardiyana devredildi.`
    )
    .setFields(
      { name: "👮 Nöbetçi Gardiyan (Yeni)", value: newModId ? `<@${newModId}>` : "@here (Başka Aktif Gardiyan Yok!)", inline: true },
      { name: "⏳ Müdahale Süresi", value: "5 Dakika (Görev tekrar devredilebilir!)", inline: true }
    );
    
  const pingContent = newModId ? `<@${newModId}>` : `<@&${MODISLEM_ROLE_ID}>`;
  await alertMsg.edit({
    content: `⚠️ **Gardiyan Nöbet Değişimi!** ${pingContent}`,
    embeds: [newEmbed]
  }).catch(() => {});
  
  clearTimeout(incident.timer);
  incident.timer = setTimeout(() => {
    rotateIncidentMod(guildId, userId, incidentId);
  }, 5 * 60 * 1000);
}

/**
 * Handles clicks on the jail action buttons.
 */
async function handleJailButtonInteraction(interaction) {
  const customId = interaction.customId;
  if (!customId.startsWith("jail_act_")) return;
  
  const parts = customId.split("_");
  const action = parts[2];
  const targetUserId = parts[3];
  const incidentId = parts[4];
  
  const guild = interaction.guild;
  const clicker = interaction.member;
  
  const hasModRole = clicker.roles.cache.has(MODISLEM_ROLE_ID);
  const isAdmin = clicker.permissions.has(PermissionFlagsBits.Administrator);
  if (!hasModRole && !isAdmin) {
    return interaction.reply({
      content: "❌ **Dur orada!** Bu zindanın gardiyanı değilsiniz. Hücre işlerine karışırsanız sizi de içeri tıkarız! 🏹",
      ephemeral: true
    });
  }
  
  const incident = activeIncidents.get(targetUserId);
  if (!incident || incident.id !== incidentId) {
    await interaction.update({ components: [] }).catch(() => {});
    return interaction.followUp({
      content: "❌ Bu olaya zaten müdahale edilmiş veya süresi geçmiş.",
      ephemeral: true
    });
  }
  
  clearTimeout(incident.timer);
  activeIncidents.delete(targetUserId);
  
  const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
  const logEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
  let actionResultText = "";
  let jailChannelMessage = "";
  
  const dbUser = await User.findOne({ discordId: targetUserId });
  
  if (action === "jopla") {
    if (targetMember) {
      await targetMember.timeout(5 * 60 * 1000, `Jopla: Gardiyan ${interaction.user.tag} tarafından joplandı.`).catch(() => {});
    }
    actionResultText = `💥 **JOPLANDI!**\nGardiyan <@${interaction.user.id}> mahkuma sert müdahale etti. (5 dk susturuldu)`;
    jailChannelMessage = `💥 **JOPLANDINIZ!**\n\n<@${targetUserId}>, Gardiyan **${interaction.user.tag}** tarafından coplandı!\n\n*\"Burası babanın çiftliği değil, sesini kes yoksa daha kötüsü olur!\"* diyerek gardiyan sırtına ağır bir cop darbesi indirdi. Nefesin kesildi ve karanlık hücrene geri fırlatıldın. 🛡️`;
  } 
  else if (action === "hucre") {
    if (targetMember) {
      await targetMember.timeout(15 * 60 * 1000, `Hücre Hapsi: Gardiyan ${interaction.user.tag} tarafından hücreye kapatıldı.`).catch(() => {});
    }
    actionResultText = `⛓️ **HÜCRE HAPSİ!**\nGardiyan <@${interaction.user.id}> mahkumu tek kişilik hücreye kapattı. (15 dk susturuldu)`;
    jailChannelMessage = `⛓️ **TEK KİŞİLİK HÜCRE HAPSİ!**\n\n<@${targetUserId}>, Gardiyan **${interaction.user.tag}** tarafından yaka paça karanlık, rutubetli tek kişilik hücreye sürüklendi ve kalın demir kapı üzerine sertçe kilitlendi!\n\n*\"15 dakika boyunca o zifiri karanlıkta tek başına düşün de aklın başına gelsin!\"* diyerek gardiyan zindandan ayrıldı. 🗝️`;
  } 
  else if (action === "sure") {
    if (dbUser && dbUser.isJailed) {
      const currentEnd = dbUser.jailedUntil ? new Date(dbUser.jailedUntil).getTime() : Date.now();
      dbUser.jailedUntil = new Date(currentEnd + 30 * 60 * 1000);
      await dbUser.save();
      const { saveStoreNow } = require("../../models/Store");
      saveStoreNow();
    }
    actionResultText = `⏳ **SÜRE UZATILDI!**\nGardiyan <@${interaction.user.id}> mahkumun cezasını 30 dakika uzattı.`;
    jailChannelMessage = `⏳ **CEZA SÜRESİ UZATILDI!**\n\n<@${targetUserId}> zindanda isyan çıkardığı ve huzursuzluk yarattığı için Gardiyan **${interaction.user.tag}** tarafından cezası **30 dakika** daha uzatıldı!\n\n*\"Zindandan o kadar kolay çıkamazsın, aklını başına devşirene kadar buradasın!\"* 📜`;
  } 
  else if (action === "kirbac") {
    if (targetMember) {
      await targetMember.timeout(2 * 60 * 1000, `Kırbaçlama: Gardiyan ${interaction.user.tag} tarafından kırbaçlandı.`).catch(() => {});
    }
    actionResultText = `⚡ **KIRBAÇLANDI!**\nGardiyan <@${interaction.user.id}> mahkumu kırbaçladı. (2 dk susturuldu)`;
    jailChannelMessage = `⚡ **KIRBAÇLANDINIZ!**\n\n<@${targetUserId}>, Gardiyan **${interaction.user.tag}** tarafından acımasızca kırbaçlandı!\n\nŞırak! *\"Zindanda gürültü yapmanın bedeli ağırdır! Bir daha sesini duyarsam fena olur!\"* diyerek gardiyan kırbacını temizledi. Kanın yere damladığını hissediyorsun... 🩸`;
  } 
  else if (action === "tahliye") {
    await unjailUser(interaction.client, guild, targetUserId);
    actionResultText = `🔓 **TAHLİYE EDİLDİ!**\nGardiyan <@${interaction.user.id}> mahkumu tahliye etti.`;
    jailChannelMessage = `🔓 **TAHLİYE EDİLDİNİZ!**\n\n<@${targetUserId}>, Gardiyan **${interaction.user.tag}** merhamet göstererek sizi zindandan tahliye etti. Ağır zindan kapıları aralandı.\n\n*\"Hadi yine iyisin, temiz havaya çık ve bir daha buralarda yaramazlık yapma!\"* 🌅`;
  }
  else if (action === "iskence") {
    // İşkence Odası Oluşturma
    try {
      const channelName = `iskence-${targetMember ? targetMember.user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : targetUserId}`;
      const parentId = interaction.channel.parentId;
      const { ChannelType, PermissionFlagsBits } = require('discord.js');
      
      const iskenceChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parentId,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: targetUserId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ],
        topic: `İşkence Odası | Mahkum: ${targetUserId}`
      });

      // Spam fire emojis
      for (let i = 0; i < 5; i++) {
        await iskenceChannel.send(`🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥 <@${targetUserId}> 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥`).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));
      }

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`iskence_kapat_${iskenceChannel.id}`).setLabel("İşkenceyi Bitir (Kanalı Sil)").setStyle(ButtonStyle.Danger)
      );
      await iskenceChannel.send({ content: `**İşkence tamamlandı.** <@${interaction.user.id}> bu odayı silebilir.`, components: [closeRow] }).catch(() => {});

      actionResultText = `🔥 **İŞKENCE BAŞLADI!**\nGardiyan <@${interaction.user.id}> mahkuma işkence ediyor. (Özel kanal açıldı)`;
      jailChannelMessage = `🔥 **İŞKENCE ZAMANI!**\n\n<@${targetUserId}>, Gardiyan **${interaction.user.tag}** seni gizli işkence odasına sürükledi!\n\n*Ateşlerin ve çığlıkların yankılandığı o karanlık dehlizde sana neler yapacaklar kim bilir...* 🔥`;
    } catch (err) {
      console.error("[JailService] Iskence error:", err.message);
      actionResultText = "❌ İşkence odası oluşturulurken bir hata oluştu.";
      jailChannelMessage = "";
    }
  }

  logEmbed
    .setTitle("✅ MÜDAHALE EDİLDİ")
    .setColor(0x2ecc71)
    .setDescription(
      `🔒 <@${targetUserId}> isimli mahkumun taşkınlığına müdahale edildi.\n\n` +
      `**Müdahale Eden Gardiyan:** <@${interaction.user.id}>\n` +
      `**Uygulanan Eylem:** ${actionResultText}`
    )
    .setFields([]);

  await interaction.update({
    content: `✅ Olay Gardiyan <@${interaction.user.id}> tarafından çözüldü.`,
    embeds: [logEmbed],
    components: []
  }).catch(() => {});
  
  const jailChannel = guild.channels.cache.get(incident.channelId);
  if (jailChannel && jailChannel.isTextBased()) {
    await jailChannel.send({ content: jailChannelMessage }).catch(() => {});
  }
}

module.exports = {
  jailUser,
  unjailUser,
  startJailScheduler,
  setupHapisRoleOverwrites,
  handleJailSpeech,
  handleJailButtonInteraction
};
