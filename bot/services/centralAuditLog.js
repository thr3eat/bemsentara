/**
 * Merkezi Detaylı Denetim Günlüğü Sistemi
 * Tüm üç sunucudaki her olayı Allied Orduları sunucusuna detaylı şekilde kaydeder
 * Desteklenen Sunucular:
 * 1. BEM Sentara: 1414639355456389344
 * 2. EKOYILDIZ: 1367646464804655104
 * 3. TMT: 1514569307886063666
 * Log Hedefi: Allied Orduları: 1514691009668321360
 */

const { EmbedBuilder, Colors, ChannelType, PermissionsBitField, AuditLogEvent } = require("discord.js");
const { ALLIED_GUILD_ID, ALLIED_LOG_CHANNEL_ID, TARGET_GUILD_ID, GUILD2_ID, TMT_GUILD_ID } = require("../../config");
const { getDiscordClient } = require("../discordClient");

/**
 * İşlemi yapan kişinin bilgisini audit log'dan çek
 * @param {Object} guild - Discord Guild nesnesi
 * @param {string} targetId - İşlem yapılan hedefin ID'si
 * @param {string} auditType - Audit log event tipi
 * @returns {Promise<Object>} Executor bilgileri
 */
async function getExecutor(guild, targetId, auditType) {
  try {
    if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
      return null;
    }

    const auditLogs = await guild.fetchAuditLogs({ limit: 10, type: auditType }).catch(() => null);
    if (!auditLogs?.entries) return null;

    // Son entry'yi bul (en son işlem)
    const entry = auditLogs.entries.first();
    if (!entry || !entry.executor) return null;

    return {
      id: entry.executor.id,
      tag: entry.executor.tag,
      username: entry.executor.username,
      avatar: entry.executor.displayAvatarURL({ size: 256 }),
      timestamp: entry.createdTimestamp
    };
  } catch (err) {
    console.error("[CentralAudit] Executor bilgisi alınamadı:", err.message);
    return null;
  }
}

// Sunucu ID'leri ve isimleri
const SERVER_INFO = {
  [TARGET_GUILD_ID]: { name: "🏛️ BEM Sentara", color: Colors.Purple, icon: "📋" },
  [GUILD2_ID]: { name: "⭐ EKOYILDIZ", color: Colors.Gold, icon: "✨" },
  [TMT_GUILD_ID]: { name: "🪖 TMT (Türk Silahlı Kuvvetleri)", color: Colors.Red, icon: "🪖" }
};

/**
 * Allied Orduları merkezi kanalına log gönder
 * @param {Object} embed - Discord EmbedBuilder embed nesnesi
 */
async function sendCentralLog(embed) {
  try {
    const client = getDiscordClient();
    if (!client?.isReady() || !ALLIED_LOG_CHANNEL_ID) {
      console.warn("[CentralAudit] Bot hazır değil veya kanal ID'si eksik");
      return;
    }

    const guild = await client.guilds.fetch(ALLIED_GUILD_ID).catch(() => null);
    if (!guild) {
      console.warn("[CentralAudit] Allied Orduları sunucusu bulunamadı");
      return;
    }

    const channel = await guild.channels.fetch(ALLIED_LOG_CHANNEL_ID).catch(() => null);
    if (!channel?.isSendable()) {
      console.warn("[CentralAudit] Log kanalına yazılamadı");
      return;
    }

    // Embed'i discord.js embed'ine dönüştür
    const finalEmbed = embed instanceof EmbedBuilder ? embed : new EmbedBuilder(embed);
    
    // Footer'a timestamp ekle
    if (!finalEmbed.data.footer?.text?.includes("•")) {
      finalEmbed.setFooter({ 
        text: `${finalEmbed.data.footer?.text || "Merkezi Denetim Günlüğü"} • Sentara Audit System`
      });
    }

    await channel.send({ embeds: [finalEmbed] });
  } catch (err) {
    console.error("[CentralAudit] Log gönderilemedi:", err.message);
  }
}

/**
 * Ağır bir değişiklik için detaylı embed oluştur
 * @param {string} guildId - Sunucu ID'si
 * @param {string} title - Başlık
 * @param {string} description - Açıklama
 * @param {object} details - Detaylar
 * @param {string} eventType - Olay tipi (member, message, role, channel, vb)
 * @param {Object} executor - İşlemi yapan kişinin bilgileri { id, tag, avatar }
 */
function createDetailedEmbed(guildId, title, description, details = {}, eventType = "general", executor = null) {
  const serverInfo = SERVER_INFO[guildId] || { name: "Bilinmeyen Sunucu", color: Colors.Greyple, icon: "❓" };
  
  const colorMap = {
    member: Colors.Blue,
    message: Colors.Green,
    role: Colors.Purple,
    channel: Colors.Gold,
    ban: Colors.Red,
    warn: Colors.Orange,
    moderation: Colors.DarkRed,
    voice: Colors.Aqua,
    automod: Colors.Yellow,
    general: serverInfo.color
  };

  const embed = new EmbedBuilder()
    .setColor(colorMap[eventType] || serverInfo.color)
    .setTitle(`${serverInfo.icon} ${title}`)
    .setDescription(description || "Açıklama yok")
    .setThumbnail(serverInfo.name === "🏛️ BEM Sentara" ? "https://cdn.discordapp.com/avatars/1286046699693289513/e42da9e8fa7f1c28e27a8ee9b234b5f1.webp" : null);

  // Executor (işlemi yapan kişi) bilgisini başlığa ekle
  if (executor) {
    embed.setAuthor({
      name: `${executor.tag} tarafından`,
      iconURL: executor.avatar
    });
  }

  embed.setFooter({ text: serverInfo.name })
    .setTimestamp();

  // Detayları embed'e ekle
  if (Object.keys(details).length > 0) {
    for (const [key, value] of Object.entries(details)) {
      if (value === null || value === undefined) continue;
      
      const formattedValue = typeof value === "object" 
        ? JSON.stringify(value, null, 2).slice(0, 1000)
        : String(value).slice(0, 1000);
      
      embed.addFields({
        name: `📌 ${key}`,
        value: formattedValue || "_(boş)_",
        inline: false
      });
    }
  }

  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🟢 ÜYELER - Member Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Yeni üye sunucuya katıldı
 */
async function logMemberJoin(member) {
  if (!member?.guild) return;

  const embed = createDetailedEmbed(
    member.guild.id,
    "➕ YENİ ÜYKE KATILDI",
    `<@${member.id}> sunucuya katıldı`,
    {
      "Kullanıcı": `${member.user.tag}\n\`${member.id}\``,
      "Hesap Oluşturma": `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`,
      "Katılma Zamanı": `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`,
      "Hesap Yaşı": `${Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24))} gün`,
      "Bot mu": member.user.bot ? "✅ Evet" : "❌ Hayır",
      "Sistem Mesajı": member.user.systemMessage || "Hayır",
      "İçerik Filtresi": member.user.flags?.has("VerifiedBot") ? "✅ Doğrulanmış" : "❌ Doğrulanmamış"
    },
    "member"
  );

  await sendCentralLog(embed);
}

/**
 * Üye sunucudan ayrıldı
 */
async function logMemberLeave(member) {
  if (!member?.guild) return;

  const roles = member.roles.cache.map(r => `<@&${r.id}>`).join(", ").slice(0, 1000) || "Rol yok";

  const embed = createDetailedEmbed(
    member.guild.id,
    "➖ ÜYKE AYRILDI",
    `<@${member.id}> sunucudan ayrıldı`,
    {
      "Kullanıcı": `${member.user.tag}\n\`${member.id}\``,
      "Katılmış Olduğu Süre": `${Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24))} gün`,
      "Sahip Olduğu Roller": roles,
      "Mesaj Sahibi": member.user.bot ? "✅ Bot" : "❌ Normal Kullanıcı"
    },
    "member"
  );

  await sendCentralLog(embed);
}

/**
 * Üye profilinde değişiklik (rol, nickname vs)
 */
async function logMemberUpdate(oldMember, newMember) {
  if (!oldMember?.guild || oldMember.guild.id !== newMember.guild.id) return;

  const changes = [];

  // Nickname değişimi
  if (oldMember.nickname !== newMember.nickname) {
    changes.push({
      type: "Takma Ad",
      before: oldMember.nickname || "_(boş)_",
      after: newMember.nickname || "_(boş)_"
    });
  }

  // Rol değişimleri
  const addedRoles = newMember.roles.cache
    .filter(r => !oldMember.roles.cache.has(r.id))
    .map(r => `<@&${r.id}>`)
    .join(", ");
  const removedRoles = oldMember.roles.cache
    .filter(r => !newMember.roles.cache.has(r.id))
    .map(r => `<@&${r.id}>`)
    .join(", ");

  if (addedRoles) changes.push({ type: "Rol Eklendi", roles: addedRoles });
  if (removedRoles) changes.push({ type: "Rol Kaldırıldı", roles: removedRoles });

  if (changes.length === 0) return; // Değişiklik yok

  const description = changes
    .map(c => {
      if (c.type === "Takma Ad") {
        return `**${c.type}**: ${c.before} ➜ ${c.after}`;
      } else {
        return `**${c.type}**: ${c.roles}`;
      }
    })
    .join("\n");

  const embed = createDetailedEmbed(
    oldMember.guild.id,
    "✏️ ÜYKE GÜNCELLEMESI",
    `<@${oldMember.id}> profili güncellendi\n\n${description}`,
    {
      "Kullanıcı": `${oldMember.user.tag}\n\`${oldMember.id}\``,
      "Toplam Roller": `${newMember.roles.cache.size}`
    },
    "member"
  );

  await sendCentralLog(embed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📨 MESAJLAR - Message Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mesaj silindi
 */
async function logMessageDelete(message) {
  if (!message?.guild || message.author?.bot) return;
  
  const contentPreview = message.content.slice(0, 500) || "_(boş veya embed)_";
  
  const executor = await getExecutor(message.guild, message.author.id, AuditLogEvent.MessageDelete);

  const embed = createDetailedEmbed(
    message.guild.id,
    "🗑️ MESAJ SİLİNDİ",
    `<@${message.author.id}> tarafından silinmiş mesaj`,
    {
      "Kanaldır": `<#${message.channelId}>\n\`${message.channelId}\``,
      "Yazar": `${message.author.tag}\n\`${message.author.id}\``,
      "Mesaj ID": `\`${message.id}\``,
      "İçerik": contentPreview,
      "Oluşturma Zamanı": `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`,
      "Dosya Sayısı": message.attachments.size,
      "Mention Sayısı": message.mentions.size,
      "Reaksiyon Sayısı": message.reactions.cache.size
    },
    "message",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Mesaj düzenlendi
 */
async function logMessageUpdate(oldMessage, newMessage) {
  if (!oldMessage?.guild || oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const oldContent = oldMessage.content.slice(0, 300) || "_(boş)_";
  const newContent = newMessage.content.slice(0, 300) || "_(boş)_";

  const executor = await getExecutor(oldMessage.guild, oldMessage.author.id, AuditLogEvent.MessageDelete);

  const embed = createDetailedEmbed(
    oldMessage.guild.id,
    "✏️ MESAJ DÜZELTİLDİ",
    `<@${oldMessage.author.id}> mesajını düzenledi`,
    {
      "Kanaldır": `<#${oldMessage.channelId}>`,
      "Yazar": `${oldMessage.author.tag}\n\`${oldMessage.author.id}\``,
      "Mesaj ID": `\`${oldMessage.id}\``,
      "ESKİ İçerik": oldContent,
      "YENİ İçerik": newContent,
      "Düzenleme Zamanı": `<t:${Math.floor(Date.now() / 1000)}:R>`
    },
    "message",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Bulk mesaj silme
 */
async function logBulkMessageDelete(messages) {
  if (messages.size === 0) return;

  const guild = messages.first()?.guild;
  if (!guild) return;

  const embed = createDetailedEmbed(
    guild.id,
    "🗑️🗑️ TOPLU MESAJ SİLİNDİ",
    `${messages.size} adet mesaj silindi`,
    {
      "Silinen Mesaj Sayısı": messages.size,
      "Kanaldır": `<#${messages.first().channelId}>`,
      "Sil Zamanı": `<t:${Math.floor(Date.now() / 1000)}:F>`,
      "Silinen Yazarlar": messages
        .map(m => m.author.tag)
        .filter((tag, i, arr) => arr.indexOf(tag) === i)
        .slice(0, 10)
        .join(", ")
    },
    "message"
  );

  await sendCentralLog(embed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎭 ROLLER - Role Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rol oluşturuldu
 */
async function logRoleCreate(role) {
  if (!role?.guild) return;

  const permissions = role.permissions.toArray().join(", ").slice(0, 1000) || "Yok";
  
  // Executor bilgisini al
  const executor = await getExecutor(role.guild, role.id, AuditLogEvent.RoleCreate);

  const embed = createDetailedEmbed(
    role.guild.id,
    "✨ YENİ ROL OLUŞTURULDU",
    `Yeni rol oluşturuldu: <@&${role.id}>`,
    {
      "Rol Adı": role.name,
      "Rol ID": `\`${role.id}\``,
      "Renk": role.hexColor || "_(Varsayılan)_",
      "Pozisyon": role.position,
      "İzinler": permissions,
      "Bahsedilebilir": role.mentionable ? "✅" : "❌",
      "Yönetilen Rol": role.managed ? "✅" : "❌",
      "Oluşturma Zamanı": `<t:${Math.floor(role.createdTimestamp / 1000)}:F>`
    },
    "role",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Rol silindi
 */
async function logRoleDelete(role) {
  if (!role?.guild) return;

  const executor = await getExecutor(role.guild, role.id, AuditLogEvent.RoleDelete);

  const embed = createDetailedEmbed(
    role.guild.id,
    "🗑️ ROL SİLİNDİ",
    `Rol silindi: **${role.name}**`,
    {
      "Rol Adı": role.name,
      "Rol ID": `\`${role.id}\``,
      "Silim Zamanı": `<t:${Math.floor(Date.now() / 1000)}:F>`,
      "Üye Sayısı": role.guild.roles.cache.get(role.id)?.members?.size || "Bilinmiyor"
    },
    "role",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Rol güncellendi
 */
async function logRoleUpdate(oldRole, newRole) {
  if (!oldRole?.guild) return;

  const changes = [];

  if (oldRole.name !== newRole.name) {
    changes.push(`**Ad**: ${oldRole.name} ➜ ${newRole.name}`);
  }
  if (oldRole.hexColor !== newRole.hexColor) {
    changes.push(`**Renk**: ${oldRole.hexColor} ➜ ${newRole.hexColor}`);
  }
  if (oldRole.position !== newRole.position) {
    changes.push(`**Pozisyon**: ${oldRole.position} ➜ ${newRole.position}`);
  }
  if (oldRole.mentionable !== newRole.mentionable) {
    changes.push(`**Bahsedilebilir**: ${oldRole.mentionable ? "✅" : "❌"} ➜ ${newRole.mentionable ? "✅" : "❌"}`);
  }

  const permChanges = oldRole.permissions.toArray().filter(p => !newRole.permissions.has(p));
  const permAdds = newRole.permissions.toArray().filter(p => !oldRole.permissions.has(p));

  if (permChanges.length > 0) {
    changes.push(`**Kaldırılan İzinler**: ${permChanges.join(", ").slice(0, 200)}`);
  }
  if (permAdds.length > 0) {
    changes.push(`**Eklenen İzinler**: ${permAdds.join(", ").slice(0, 200)}`);
  }

  if (changes.length === 0) return;

  const executor = await getExecutor(oldRole.guild, oldRole.id, AuditLogEvent.RoleUpdate);

  const embed = createDetailedEmbed(
    oldRole.guild.id,
    "✏️ ROL GÜNCELLEMESI",
    `<@&${oldRole.id}> rolü güncellendi\n\n${changes.join("\n")}`,
    {
      "Rol Adı": newRole.name,
      "Rol ID": `\`${newRole.id}\``,
      "Değişim Sayısı": changes.length
    },
    "role",
    executor
  );

  await sendCentralLog(embed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏠 KANALLAR - Channel Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Kanal oluşturuldu
 */
async function logChannelCreate(channel) {
  if (!channel?.guild) return;

  const typeMap = {
    [ChannelType.Text]: "📝 Yazı Kanalı",
    [ChannelType.Voice]: "🔊 Ses Kanalı",
    [ChannelType.Category]: "📂 Kategori",
    [ChannelType.Forum]: "💬 Forum"
  };

  const executor = await getExecutor(channel.guild, channel.id, AuditLogEvent.ChannelCreate);

  const embed = createDetailedEmbed(
    channel.guild.id,
    "✨ YENİ KANAL OLUŞTURULDU",
    `Yeni kanal oluşturuldu: <#${channel.id}>`,
    {
      "Kanal Adı": channel.name,
      "Kanal ID": `\`${channel.id}\``,
      "Kanal Türü": typeMap[channel.type] || "Bilinmiyor",
      "Kategori": channel.parent?.name || "Kategori yok",
      "NSFW": channel.nsfw ? "✅" : "❌",
      "Oluşturma Zamanı": `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>`,
      "Konumlandırma": channel.position
    },
    "channel",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Kanal silindi
 */
async function logChannelDelete(channel) {
  if (!channel?.guild) return;

  const executor = await getExecutor(channel.guild, channel.id, AuditLogEvent.ChannelDelete);

  const embed = createDetailedEmbed(
    channel.guild.id,
    "🗑️ KANAL SİLİNDİ",
    `Kanal silindi: **${channel.name}**`,
    {
      "Kanal Adı": channel.name,
      "Kanal ID": `\`${channel.id}\``,
      "Silim Zamanı": `<t:${Math.floor(Date.now() / 1000)}:F>`
    },
    "channel",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Kanal güncellendi
 */
async function logChannelUpdate(oldChannel, newChannel) {
  if (!oldChannel?.guild) return;

  const changes = [];

  if (oldChannel.name !== newChannel.name) {
    changes.push(`**Ad**: ${oldChannel.name} ➜ ${newChannel.name}`);
  }
  if (oldChannel.topic !== newChannel.topic) {
    changes.push(`**Konu**: ${oldChannel.topic || "Yok"} ➜ ${newChannel.topic || "Yok"}`);
  }
  if (oldChannel.nsfw !== newChannel.nsfw) {
    changes.push(`**NSFW**: ${oldChannel.nsfw ? "✅" : "❌"} ➜ ${newChannel.nsfw ? "✅" : "❌"}`);
  }

  if (changes.length === 0) return;

  const executor = await getExecutor(oldChannel.guild, oldChannel.id, AuditLogEvent.ChannelUpdate);

  const embed = createDetailedEmbed(
    oldChannel.guild.id,
    "✏️ KANAL GÜNCELLEMESI",
    `<#${oldChannel.id}> kanalı güncellendi\n\n${changes.join("\n")}`,
    {
      "Kanal Adı": newChannel.name,
      "Kanal ID": `\`${newChannel.id}\``,
      "Değişim Sayısı": changes.length
    },
    "channel",
    executor
  );

  await sendCentralLog(embed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚫 MODERASYON - Moderation Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Kullanıcı banlandı
 */
async function logUserBan(ban) {
  if (!ban?.guild) return;

  const executor = await getExecutor(ban.guild, ban.user.id, AuditLogEvent.MemberBanAdd);

  const embed = createDetailedEmbed(
    ban.guild.id,
    "🔴 KULLANICI BANLANDI",
    `<@${ban.user.id}> sunucudan banlandı`,
    {
      "Kullanıcı": `${ban.user.tag}\n\`${ban.user.id}\``,
      "Ban Sebebi": ban.reason || "Sebep belirtilmedi",
      "Ban Zamanı": `<t:${Math.floor(Date.now() / 1000)}:F>`,
      "Hesap Yaşı": `${Math.floor((Date.now() - ban.user.createdTimestamp) / (1000 * 60 * 60 * 24))} gün`
    },
    "ban",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Ban kaldırıldı
 */
async function logUserUnban(ban) {
  if (!ban?.guild) return;

  const executor = await getExecutor(ban.guild, ban.user.id, AuditLogEvent.MemberBanRemove);

  const embed = createDetailedEmbed(
    ban.guild.id,
    "🟢 BAN KALDIRILDI",
    `<@${ban.user.id}> adlı kullanıcının banı kaldırıldı`,
    {
      "Kullanıcı": `${ban.user.tag}\n\`${ban.user.id}\``,
      "Ban Sebebi": ban.reason || "Sebep belirtilmedi",
      "Ban Kaldırma Zamanı": `<t:${Math.floor(Date.now() / 1000)}:F>`
    },
    "moderation",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Kullanıcı timeout'a alındı
 */
async function logMemberTimeout(oldMember, newMember) {
  if (!oldMember?.guild) return;
  if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
    // Timeout başladı
    const duration = newMember.communicationDisabledUntil.getTime() - Date.now();
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const embed = createDetailedEmbed(
      oldMember.guild.id,
      "⏱️ TIMEOUT VERİLDİ",
      `<@${newMember.id}> kullanıcıya timeout verildi`,
      {
        "Kullanıcı": `${newMember.user.tag}\n\`${newMember.id}\``,
        "Timeout Süresi": `${days}gün ${hours}saat`,
        "Timeout Bitiş": `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:F>`,
        "Timeout Başladı": `<t:${Math.floor(Date.now() / 1000)}:F>`
      },
      "warn"
    );

    await sendCentralLog(embed);
  } else if (oldMember.communicationDisabledUntil && !newMember.communicationDisabledUntil) {
    // Timeout sona erdi
    const embed = createDetailedEmbed(
      oldMember.guild.id,
      "✅ TIMEOUT KALKTI",
      `<@${newMember.id}> kullanıcının timeout'u kaldırıldı`,
      {
        "Kullanıcı": `${newMember.user.tag}\n\`${newMember.id}\``,
        "Timeout Kaldırma Zamanı": `<t:${Math.floor(Date.now() / 1000)}:F>`
      },
      "moderation"
    );

    await sendCentralLog(embed);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔊 SES - Voice Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ses kanalına katılım
 */
async function logVoiceJoin(oldState, newState) {
  if (!oldState?.guild || oldState.channel) return; // Zaten kanaldaysa log yapma
  if (!newState.channel) return;

  const embed = createDetailedEmbed(
    oldState.guild.id,
    "🔊 SES KANALINA KATILDI",
    `<@${newState.member.id}> ses kanalına katıldı`,
    {
      "Kullanıcı": `${newState.member.user.tag}\n\`${newState.member.id}\``,
      "Ses Kanalı": `${newState.channel.name} (\`${newState.channel.id}\`)`,
      "Katılma Zamanı": `<t:${Math.floor(Date.now() / 1000)}:F>`,
      "Video Akışı": newState.streaming ? "✅" : "❌",
      "Self Mute": newState.selfMute ? "✅" : "❌",
      "Self Deaf": newState.selfDeaf ? "✅" : "❌"
    },
    "voice"
  );

  await sendCentralLog(embed);
}

/**
 * Ses kanalından ayrılış
 */
async function logVoiceLeave(oldState, newState) {
  if (!oldState?.guild || !oldState.channel) return;
  if (newState.channel) return; // Hala kanaldaysa log yapma

  const duration = Date.now() - oldState.joinedTimestamp;
  const minutes = Math.floor(duration / (1000 * 60));

  const embed = createDetailedEmbed(
    oldState.guild.id,
    "🔇 SES KANALINDEN AYRILDI",
    `<@${oldState.member.id}> ses kanalından ayrıldı`,
    {
      "Kullanıcı": `${oldState.member.user.tag}\n\`${oldState.member.id}\``,
      "Ses Kanalı": `${oldState.channel.name}`,
      "Kalış Süresi": `${minutes} dakika`,
      "Ayrılma Zamanı": `<t:${Math.floor(Date.now() / 1000)}:F>`
    },
    "voice"
  );

  await sendCentralLog(embed);
}

/**
 * Ses kanalında hareket (taşıma)
 */
async function logVoiceMove(oldState, newState) {
  if (!oldState?.guild || oldState.channel?.id === newState.channel?.id) return;

  const embed = createDetailedEmbed(
    oldState.guild.id,
    "🔄 SES KANALINDA TAŞINDI",
    `<@${newState.member.id}> ses kanalında taşındı`,
    {
      "Kullanıcı": `${newState.member.user.tag}\n\`${newState.member.id}\``,
      "Eski Kanal": oldState.channel?.name || "Yok",
      "Yeni Kanal": newState.channel?.name || "Yok",
      "Taşınma Zamanı": `<t:${Math.floor(Date.now() / 1000)}:F>`
    },
    "voice"
  );

  await sendCentralLog(embed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  sendCentralLog,
  createDetailedEmbed,
  getExecutor,
  
  // Members
  logMemberJoin,
  logMemberLeave,
  logMemberUpdate,
  
  // Messages
  logMessageDelete,
  logMessageUpdate,
  logBulkMessageDelete,
  
  // Roles
  logRoleCreate,
  logRoleDelete,
  logRoleUpdate,
  
  // Channels
  logChannelCreate,
  logChannelDelete,
  logChannelUpdate,
  
  // Moderation
  logUserBan,
  logUserUnban,
  logMemberTimeout,
  
  // Voice
  logVoiceJoin,
  logVoiceLeave,
  logVoiceMove
};
