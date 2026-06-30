/**
 * Merkezi Detaylı Denetim Günlüğü Sistemi
 * Tüm üç sunucudaki her olayı Allied Orduları sunucusuna detaylı şekilde kaydeder
 * Desteklenen Sunucular:
 * 1. BEM Sentara: 1414639355456389344
 * 2. EKOYILDIZ: 1367646464804655104
 * 3. TMT: 1514569307886063666
 * Log Hedefi: Allied Orduları: 1514691009668321360
 */

const {
  EmbedBuilder,
  Colors,
  ChannelType,
  PermissionsBitField,
  AuditLogEvent
} = require("discord.js");

const {
  ALLIED_GUILD_ID,
  ALLIED_LOG_CHANNEL_ID,
  TARGET_GUILD_ID,
  GUILD2_ID,
  TMT_GUILD_ID
} = require("../../config");

const { getDiscordClient } = require("../discordClient");

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ YAPILANDIRMA
// ═══════════════════════════════════════════════════════════════════════════════

// Sunucu ID'leri ve isimleri
const SERVER_INFO = {
  [TARGET_GUILD_ID]: { name: "🏛️ BEM Sentara", color: Colors.Purple, icon: "📋" },
  [GUILD2_ID]: { name: "⭐ EKOYILDIZ", color: Colors.Gold, icon: "✨" },
  [TMT_GUILD_ID]: { name: "🪖 TMT (Türk Silahlı Kuvvetleri)", color: Colors.Red, icon: "🪖" }
};

const EVENT_COLORS = {
  member: Colors.Blue,
  message: Colors.Green,
  role: Colors.Purple,
  channel: Colors.Gold,
  ban: Colors.Red,
  warn: Colors.Orange,
  moderation: Colors.DarkRed,
  voice: Colors.Aqua,
  automod: Colors.Yellow,
  general: Colors.Greyple
};

// Kanal tipi çevirileri
const CHANNEL_TYPE_MAP = {
  [ChannelType.GuildText]: "📝 Yazı Kanalı",
  [ChannelType.GuildVoice]: "🔊 Ses Kanalı",
  [ChannelType.GuildCategory]: "📂 Kategori",
  [ChannelType.GuildForum]: "💬 Forum",
  [ChannelType.GuildAnnouncement]: "📢 Duyuru Kanalı",
  [ChannelType.GuildStageVoice]: "🎭 Sahne Kanalı"
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gün/saat/dakika cinsinden süre formatlar
 * @param {number} ms - Milisaniye cinsinden süre
 * @returns {string}
 */
function formatDuration(ms) {
  if (!ms || ms < 0) return "Bilinmiyor";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  const parts = [];
  if (days) parts.push(`${days}g`);
  if (hours) parts.push(`${hours}s`);
  if (minutes) parts.push(`${minutes}dk`);
  return parts.length ? parts.join(" ") : "< 1 dakika";
}

/**
 * Timestamp'i Discord relative time tag'ine çevirir
 * @param {number} ms
 * @returns {string}
 */
function toRelative(ms) {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

/**
 * Timestamp'i Discord full date tag'ine çevirir
 * @param {number} ms
 * @returns {string}
 */
function toFull(ms) {
  return `<t:${Math.floor(ms / 1000)}:F>`;
}

/**
 * İşlemi yapan kişinin bilgisini audit log'dan çek.
 * 5 saniyeden eski entry'leri yoksay (alakasız audit log'ları engellemek için).
 *
 * @param {import("discord.js").Guild} guild
 * @param {string|null} targetId - İşlem yapılan hedefin ID'si (opsiyonel, doğrulama için)
 * @param {AuditLogEvent} auditType
 * @param {number} [maxAgeMs=5000] - Kabul edilecek max audit log yaşı (ms)
 * @returns {Promise<Object|null>}
 */
async function getExecutor(guild, targetId, auditType, maxAgeMs = 5000) {
  try {
    if (!guild?.members?.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
      return null;
    }

    const auditLogs = await guild.fetchAuditLogs({ limit: 5, type: auditType }).catch(() => null);
    if (!auditLogs?.entries?.size) return null;

    const now = Date.now();

    // targetId ile eşleşen ve yeterince yeni olan en son entry'yi bul
    const entry = auditLogs.entries.find(e => {
      const isRecent = (now - e.createdTimestamp) <= maxAgeMs;
      const isTarget = targetId ? e.target?.id === targetId : true;
      return isRecent && isTarget && e.executor;
    });

    if (!entry?.executor) return null;

    return {
      id: entry.executor.id,
      tag: entry.executor.tag ?? entry.executor.username,
      username: entry.executor.username,
      avatar: entry.executor.displayAvatarURL({ size: 256 }),
      reason: entry.reason ?? null,
      timestamp: entry.createdTimestamp
    };
  } catch (err) {
    console.error("[CentralAudit] Executor bilgisi alınamadı:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 LOG GÖNDERİCİ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Allied Orduları merkezi kanalına embed log gönder.
 * @param {EmbedBuilder} embed
 */
async function sendCentralLog(embed) {
  try {
    const client = getDiscordClient();

    if (!client?.isReady()) {
      console.warn("[CentralAudit] Bot henüz hazır değil.");
      return;
    }

    if (!ALLIED_LOG_CHANNEL_ID || !ALLIED_GUILD_ID) {
      console.warn("[CentralAudit] ALLIED_LOG_CHANNEL_ID veya ALLIED_GUILD_ID eksik.");
      return;
    }

    const guild = await client.guilds.fetch(ALLIED_GUILD_ID).catch(() => null);
    if (!guild) {
      console.warn("[CentralAudit] Allied Orduları sunucusu bulunamadı.");
      return;
    }

    const channel = await guild.channels.fetch(ALLIED_LOG_CHANNEL_ID).catch(() => null);
    if (!channel?.isSendable()) {
      console.warn("[CentralAudit] Log kanalına yazılamıyor (bulunamadı veya izin yok).");
      return;
    }

    const finalEmbed = embed instanceof EmbedBuilder ? embed : new EmbedBuilder(embed);

    // Footer henüz Sentara imzasını içermiyorsa ekle
    const existingFooter = finalEmbed.data.footer?.text ?? "Merkezi Denetim Günlüğü";
    if (!existingFooter.includes("Sentara Audit")) {
      finalEmbed.setFooter({ text: `${existingFooter} • Sentara Audit System` });
    }

    await channel.send({ embeds: [finalEmbed] });
  } catch (err) {
    console.error("[CentralAudit] Log gönderilemedi:", err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏗️ EMBED OLUŞTURUCU
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Standart detaylı embed oluşturur.
 *
 * @param {string} guildId
 * @param {string} title
 * @param {string} description
 * @param {Object} [details={}]
 * @param {string} [eventType="general"]
 * @param {Object|null} [executor=null]
 * @returns {EmbedBuilder}
 */
function createDetailedEmbed(
  guildId,
  title,
  description,
  details = {},
  eventType = "general",
  executor = null
) {
  const serverInfo = SERVER_INFO[guildId] ?? {
    name: "❓ Bilinmeyen Sunucu",
    color: Colors.Greyple,
    icon: "❓"
  };

  const color = EVENT_COLORS[eventType] ?? serverInfo.color;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${serverInfo.icon} ${title}`)
    .setDescription(description || "Açıklama yok.")
    .setFooter({ text: serverInfo.name })
    .setTimestamp();

  // Thumbnail: sadece geçerli URL varsa ekle (null setThumbnail hata fırlatır)
  if (guildId === TARGET_GUILD_ID) {
    embed.setThumbnail(
      "https://cdn.discordapp.com/avatars/1286046699693289513/e42da9e8fa7f1c28e27a8ee9b234b5f1.webp"
    );
  }

  // Executor (işlemi yapan kişi)
  if (executor) {
    embed.setAuthor({
      name: `${executor.tag} tarafından`,
      iconURL: executor.avatar
    });
  }

  // Detay alanları
  for (const [key, value] of Object.entries(details)) {
    if (value === null || value === undefined || value === "") continue;

    const display =
      typeof value === "object"
        ? JSON.stringify(value, null, 2).slice(0, 1024)
        : String(value).slice(0, 1024);

    embed.addFields({
      name: `📌 ${key}`,
      value: display || "_(boş)_",
      inline: false
    });
  }

  return embed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🟢 ÜYELER — Member Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Yeni üye sunucuya katıldı
 * @param {import("discord.js").GuildMember} member
 */
async function logMemberJoin(member) {
  if (!member?.guild) return;

  const accountAge = formatDuration(Date.now() - member.user.createdTimestamp);

  const embed = createDetailedEmbed(
    member.guild.id,
    "➕ YENİ ÜYE KATILDI",
    `<@${member.id}> sunucuya katıldı`,
    {
      "Kullanıcı": `${member.user.tag}\n\`${member.id}\``,
      "Hesap Oluşturma": toFull(member.user.createdTimestamp),
      "Katılma Zamanı": toFull(member.joinedTimestamp ?? Date.now()),
      "Hesap Yaşı": accountAge,
      "Bot mu": member.user.bot ? "✅ Evet" : "❌ Hayır",
      "Doğrulanmış Bot": member.user.flags?.has("VerifiedBot") ? "✅ Evet" : "❌ Hayır"
    },
    "member"
  );

  await sendCentralLog(embed);
}

/**
 * Üye sunucudan ayrıldı
 * @param {import("discord.js").GuildMember} member
 */
async function logMemberLeave(member) {
  if (!member?.guild) return;

  const joinedAt = member.joinedTimestamp;
  const stayLength = joinedAt ? formatDuration(Date.now() - joinedAt) : "Bilinmiyor";
  const roles = member.roles.cache
    .filter(r => r.id !== member.guild.id) // @everyone hariç
    .map(r => `<@&${r.id}>`)
    .join(", ")
    .slice(0, 1000) || "Rol yok";

  const embed = createDetailedEmbed(
    member.guild.id,
    "➖ ÜYE AYRILDI",
    `<@${member.id}> sunucudan ayrıldı`,
    {
      "Kullanıcı": `${member.user.tag}\n\`${member.id}\``,
      "Sunucuda Kaldığı Süre": stayLength,
      "Sahip Olduğu Roller": roles,
      "Bot mu": member.user.bot ? "✅ Bot" : "❌ Normal Kullanıcı"
    },
    "member"
  );

  await sendCentralLog(embed);
}

/**
 * Üye profili güncellendi (rol veya nickname değişimi)
 * @param {import("discord.js").GuildMember} oldMember
 * @param {import("discord.js").GuildMember} newMember
 */
async function logMemberUpdate(oldMember, newMember) {
  if (!oldMember?.guild || oldMember.guild.id !== newMember.guild.id) return;

  const changes = [];

  // Nickname değişimi
  if (oldMember.nickname !== newMember.nickname) {
    changes.push(`**Takma Ad**: \`${oldMember.nickname ?? "_(boş)_"}\` ➜ \`${newMember.nickname ?? "_(boş)_"}\``);
  }

  // Rol eklemeleri
  const addedRoles = newMember.roles.cache
    .filter(r => !oldMember.roles.cache.has(r.id) && r.id !== newMember.guild.id)
    .map(r => `<@&${r.id}>`).join(", ");

  // Rol çıkarmaları
  const removedRoles = oldMember.roles.cache
    .filter(r => !newMember.roles.cache.has(r.id) && r.id !== oldMember.guild.id)
    .map(r => `<@&${r.id}>`).join(", ");

  if (addedRoles) changes.push(`**Rol Eklendi**: ${addedRoles}`);
  if (removedRoles) changes.push(`**Rol Kaldırıldı**: ${removedRoles}`);

  // Pending durumu (üyelik doğrulama)
  if (oldMember.pending && !newMember.pending) {
    changes.push("**Üyelik Doğrulandı** ✅");
  }

  if (changes.length === 0) return;

  // Executor'ı rol veya nickname işlemine göre belirle
  const auditType = addedRoles || removedRoles
    ? AuditLogEvent.MemberRoleUpdate
    : AuditLogEvent.MemberUpdate;

  const executor = await getExecutor(newMember.guild, newMember.id, auditType);

  const embed = createDetailedEmbed(
    oldMember.guild.id,
    "✏️ ÜYE GÜNCELLENDİ",
    `<@${oldMember.id}> profili güncellendi\n\n${changes.join("\n")}`,
    {
      "Kullanıcı": `${oldMember.user.tag}\n\`${oldMember.id}\``,
      "Toplam Rol": String(newMember.roles.cache.size - 1) // @everyone çıkar
    },
    "member",
    executor
  );

  await sendCentralLog(embed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📨 MESAJLAR — Message Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mesaj silindi
 * @param {import("discord.js").Message} message
 */
async function logMessageDelete(message) {
  if (!message?.guild || message.author?.bot) return;

  const content = message.content?.slice(0, 500) || "_(boş veya embed)_";
  const executor = await getExecutor(message.guild, message.author.id, AuditLogEvent.MessageDelete);

  const attachmentInfo = message.attachments.size > 0
    ? message.attachments.map(a => a.url).slice(0, 5).join("\n")
    : null;

  const embed = createDetailedEmbed(
    message.guild.id,
    "🗑️ MESAJ SİLİNDİ",
    `<@${message.author.id}> tarafından yazılan mesaj silindi`,
    {
      "Kanal": `<#${message.channelId}> \`${message.channelId}\``,
      "Yazar": `${message.author.tag}\n\`${message.author.id}\``,
      "Mesaj ID": `\`${message.id}\``,
      "İçerik": content,
      "Oluşturma Zamanı": toFull(message.createdTimestamp),
      ...(attachmentInfo ? { "Dosya URL'leri": attachmentInfo } : {}),
      "Dosya Sayısı": String(message.attachments.size),
      "Mention Sayısı": String(message.mentions.users.size),
      "Reaksiyon Sayısı": String(message.reactions.cache.size)
    },
    "message",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Mesaj düzenlendi
 * @param {import("discord.js").Message} oldMessage
 * @param {import("discord.js").Message} newMessage
 */
async function logMessageUpdate(oldMessage, newMessage) {
  // Discord önbelleğinde olmayan mesajlarda author null olabilir — güvenli çıkış
  if (!oldMessage?.guild) return;
  if (!oldMessage?.author || !newMessage?.author) return;
  if (oldMessage.author.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const oldContent = oldMessage.content?.slice(0, 300) || '_(boş)_';
  const newContent = newMessage.content?.slice(0, 300) || '_(boş)_';

  const executor = await getExecutor(
    oldMessage.guild,
    oldMessage.author.id,
    AuditLogEvent.MessageUpdate
  );

  const embed = createDetailedEmbed(
    oldMessage.guild.id,
    '✏️ MESAJ DÜZENLENDİ',
    `<@${oldMessage.author.id}> mesajını düzenledi\n[Mesaja Git](${newMessage.url})`,
    {
      'Kanal': `<#${oldMessage.channelId}>`,
      'Yazar': `${oldMessage.author.tag}\n\`${oldMessage.author.id}\``,
      'Mesaj ID': `\`${oldMessage.id}\``,
      'Eski İçerik': oldContent,
      'Yeni İçerik': newContent,
      'Düzenleme Zamanı': toRelative(Date.now())
    },
    'message',
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Toplu mesaj silindi
 * @param {import("discord.js").Collection} messages
 */
async function logBulkMessageDelete(messages) {
  if (!messages?.size) return;

  const guild = messages.first()?.guild;
  if (!guild) return;

  // Sadece kullanıcı mesajlarını say
  const userMessages = messages.filter(m => !m.author?.bot);
  const uniqueAuthors = [...new Set(userMessages.map(m => m.author?.tag).filter(Boolean))];

  const embed = createDetailedEmbed(
    guild.id,
    "🗑️🗑️ TOPLU MESAJ SİLİNDİ",
    `${messages.size} adet mesaj silindi (${userMessages.size} kullanıcı, ${messages.size - userMessages.size} bot)`,
    {
      "Toplam Silinen": String(messages.size),
      "Kullanıcı Mesajı": String(userMessages.size),
      "Bot Mesajı": String(messages.size - userMessages.size),
      "Kanal": `<#${messages.first().channelId}>`,
      "Silinen Yazarlar": uniqueAuthors.slice(0, 10).join(", ") || "Bilinmiyor",
      "Silme Zamanı": toFull(Date.now())
    },
    "message"
  );

  await sendCentralLog(embed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎭 ROLLER — Role Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rol oluşturuldu
 * @param {import("discord.js").Role} role
 */
async function logRoleCreate(role) {
  if (!role?.guild) return;

  const permissions = role.permissions.toArray().join(", ").slice(0, 1000) || "Yok";
  const executor = await getExecutor(role.guild, role.id, AuditLogEvent.RoleCreate);

  const embed = createDetailedEmbed(
    role.guild.id,
    "✨ YENİ ROL OLUŞTURULDU",
    `Yeni rol oluşturuldu: <@&${role.id}>`,
    {
      "Rol Adı": role.name,
      "Rol ID": `\`${role.id}\``,
      "Renk": role.hexColor !== "#000000" ? role.hexColor : "_(Varsayılan)_",
      "Pozisyon": String(role.position),
      "İzinler": permissions,
      "Bahsedilebilir": role.mentionable ? "✅ Evet" : "❌ Hayır",
      "Ayrı Göster (Hoist)": role.hoist ? "✅ Evet" : "❌ Hayır",
      "Bot Rolü (Yönetilen)": role.managed ? "✅ Evet" : "❌ Hayır",
      "Oluşturma Zamanı": toFull(role.createdTimestamp)
    },
    "role",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Rol silindi
 * @param {import("discord.js").Role} role
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
      "Silme Zamanı": toFull(Date.now())
    },
    "role",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Rol güncellendi
 * @param {import("discord.js").Role} oldRole
 * @param {import("discord.js").Role} newRole
 */
async function logRoleUpdate(oldRole, newRole) {
  if (!oldRole?.guild) return;

  // Bot yönetim rollerini loglama (entegrasyon rolleri)
  if (newRole.managed) return;

  const changes = [];

  if (oldRole.name !== newRole.name) {
    changes.push(`**Ad**: \`${oldRole.name}\` ➜ \`${newRole.name}\``);
  }
  if (oldRole.hexColor !== newRole.hexColor) {
    changes.push(`**Renk**: \`${oldRole.hexColor}\` ➜ \`${newRole.hexColor}\``);
  }
  // Sadece pozisyon değişimi olan olaylar Discord'un iç sıralama mekanizmasından kaynaklanır —
  // bunları loglamak audit log kirliliğine yol açar, bu yüzden tamamen atlanır.
  if (oldRole.mentionable !== newRole.mentionable) {
    changes.push(`**Bahsedilebilir**: ${oldRole.mentionable ? "✅" : "❌"} ➜ ${newRole.mentionable ? "✅" : "❌"}`);
  }
  if (oldRole.hoist !== newRole.hoist) {
    changes.push(`**Ayrı Göster**: ${oldRole.hoist ? "✅" : "❌"} ➜ ${newRole.hoist ? "✅" : "❌"}`);
  }

  const removedPerms = oldRole.permissions.toArray().filter(p => !newRole.permissions.has(p));
  const addedPerms = newRole.permissions.toArray().filter(p => !oldRole.permissions.has(p));

  if (removedPerms.length > 0) changes.push(`**Kaldırılan İzinler**: ${removedPerms.join(", ").slice(0, 200)}`);
  if (addedPerms.length > 0) changes.push(`**Eklenen İzinler**: ${addedPerms.join(", ").slice(0, 200)}`);

  if (changes.length === 0) return;

  const executor = await getExecutor(oldRole.guild, oldRole.id, AuditLogEvent.RoleUpdate);

  const embed = createDetailedEmbed(
    oldRole.guild.id,
    "✏️ ROL GÜNCELLENDİ",
    `<@&${oldRole.id}> rolü güncellendi\n\n${changes.join("\n")}`,
    {
      "Rol Adı": newRole.name,
      "Rol ID": `\`${newRole.id}\``,
      "Değişim Sayısı": String(changes.length)
    },
    "role",
    executor
  );

  await sendCentralLog(embed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏠 KANALLAR — Channel Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Kanal oluşturuldu
 * @param {import("discord.js").GuildChannel} channel
 */
async function logChannelCreate(channel) {
  if (!channel?.guild) return;

  const executor = await getExecutor(channel.guild, channel.id, AuditLogEvent.ChannelCreate);

  const embed = createDetailedEmbed(
    channel.guild.id,
    "✨ YENİ KANAL OLUŞTURULDU",
    `Yeni kanal oluşturuldu: <#${channel.id}>`,
    {
      "Kanal Adı": channel.name,
      "Kanal ID": `\`${channel.id}\``,
      "Kanal Türü": CHANNEL_TYPE_MAP[channel.type] ?? "Bilinmiyor",
      "Kategori": channel.parent?.name ?? "Kategori yok",
      "NSFW": channel.nsfw ? "✅ Evet" : "❌ Hayır",
      "Yavaş Mod": channel.rateLimitPerUser ? `${channel.rateLimitPerUser}s` : "Kapalı",
      "Pozisyon": String(channel.position),
      "Oluşturma Zamanı": toFull(channel.createdTimestamp)
    },
    "channel",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Kanal silindi
 * @param {import("discord.js").GuildChannel} channel
 */
async function logChannelDelete(channel) {
  if (!channel?.guild) return;

  const executor = await getExecutor(channel.guild, channel.id, AuditLogEvent.ChannelDelete);

  const embed = createDetailedEmbed(
    channel.guild.id,
    "🗑️ KANAL SİLİNDİ",
    `Kanal silindi: **#${channel.name}**`,
    {
      "Kanal Adı": channel.name,
      "Kanal ID": `\`${channel.id}\``,
      "Kanal Türü": CHANNEL_TYPE_MAP[channel.type] ?? "Bilinmiyor",
      "Kategori": channel.parent?.name ?? "Kategori yok",
      "Silme Zamanı": toFull(Date.now())
    },
    "channel",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Kanal güncellendi
 * @param {import("discord.js").GuildChannel} oldChannel
 * @param {import("discord.js").GuildChannel} newChannel
 */
async function logChannelUpdate(oldChannel, newChannel) {
  if (!oldChannel?.guild) return;

  const changes = [];

  if (oldChannel.name !== newChannel.name) {
    changes.push(`**Ad**: \`${oldChannel.name}\` ➜ \`${newChannel.name}\``);
  }
  if ("topic" in oldChannel && oldChannel.topic !== newChannel.topic) {
    changes.push(`**Konu**: ${oldChannel.topic || "_(boş)_"} ➜ ${newChannel.topic || "_(boş)_"}`);
  }
  if ("nsfw" in oldChannel && oldChannel.nsfw !== newChannel.nsfw) {
    changes.push(`**NSFW**: ${oldChannel.nsfw ? "✅" : "❌"} ➜ ${newChannel.nsfw ? "✅" : "❌"}`);
  }
  if ("rateLimitPerUser" in oldChannel && oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
    changes.push(`**Yavaş Mod**: ${oldChannel.rateLimitPerUser}s ➜ ${newChannel.rateLimitPerUser}s`);
  }
  if (oldChannel.parentId !== newChannel.parentId) {
    changes.push(`**Kategori**: ${oldChannel.parent?.name ?? "Yok"} ➜ ${newChannel.parent?.name ?? "Yok"}`);
  }

  if (changes.length === 0) return;

  const executor = await getExecutor(oldChannel.guild, oldChannel.id, AuditLogEvent.ChannelUpdate);

  const embed = createDetailedEmbed(
    oldChannel.guild.id,
    "✏️ KANAL GÜNCELLENDİ",
    `<#${oldChannel.id}> kanalı güncellendi\n\n${changes.join("\n")}`,
    {
      "Kanal Adı": newChannel.name,
      "Kanal ID": `\`${newChannel.id}\``,
      "Değişim Sayısı": String(changes.length)
    },
    "channel",
    executor
  );

  await sendCentralLog(embed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚫 MODERASYON — Moderation Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Kullanıcı banlandı
 * @param {import("discord.js").GuildBan} ban
 */
async function logUserBan(ban) {
  if (!ban?.guild) return;

  const executor = await getExecutor(ban.guild, ban.user.id, AuditLogEvent.MemberBanAdd);
  const reason = executor?.reason ?? ban.reason ?? "Sebep belirtilmedi";

  const embed = createDetailedEmbed(
    ban.guild.id,
    "🔴 KULLANICI BANLANDI",
    `<@${ban.user.id}> sunucudan banlandı`,
    {
      "Kullanıcı": `${ban.user.tag}\n\`${ban.user.id}\``,
      "Ban Sebebi": reason,
      "Ban Zamanı": toFull(Date.now()),
      "Hesap Yaşı": formatDuration(Date.now() - ban.user.createdTimestamp),
      "Bot mu": ban.user.bot ? "✅ Evet" : "❌ Hayır"
    },
    "ban",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Ban kaldırıldı
 * @param {import("discord.js").GuildBan} ban
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
      "Ban Kaldırma Zamanı": toFull(Date.now())
    },
    "moderation",
    executor
  );

  await sendCentralLog(embed);
}

/**
 * Kullanıcı timeout'a alındı veya timeout kaldırıldı
 * @param {import("discord.js").GuildMember} oldMember
 * @param {import("discord.js").GuildMember} newMember
 */
async function logMemberTimeout(oldMember, newMember) {
  if (!oldMember?.guild) return;

  const wasTimedOut = Boolean(oldMember.communicationDisabledUntil);
  const isTimedOut = Boolean(newMember.communicationDisabledUntil);

  // Timeout başladı
  if (!wasTimedOut && isTimedOut) {
    const endsAt = newMember.communicationDisabledUntil.getTime();
    const duration = formatDuration(endsAt - Date.now());
    const executor = await getExecutor(oldMember.guild, newMember.id, AuditLogEvent.MemberUpdate);

    const embed = createDetailedEmbed(
      oldMember.guild.id,
      "⏱️ TIMEOUT VERİLDİ",
      `<@${newMember.id}> kullanıcıya timeout verildi`,
      {
        "Kullanıcı": `${newMember.user.tag}\n\`${newMember.id}\``,
        "Timeout Süresi": duration,
        "Timeout Bitiş": toFull(endsAt),
        "Timeout Başladı": toFull(Date.now())
      },
      "warn",
      executor
    );

    await sendCentralLog(embed);
    return;
  }

  // Timeout kaldırıldı (erken kaldırma)
  if (wasTimedOut && !isTimedOut) {
    const executor = await getExecutor(oldMember.guild, newMember.id, AuditLogEvent.MemberUpdate);

    const embed = createDetailedEmbed(
      oldMember.guild.id,
      "✅ TIMEOUT KALDIRILDI",
      `<@${newMember.id}> kullanıcının timeout'u kaldırıldı`,
      {
        "Kullanıcı": `${newMember.user.tag}\n\`${newMember.id}\``,
        "Kaldırma Zamanı": toFull(Date.now())
      },
      "moderation",
      executor
    );

    await sendCentralLog(embed);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔊 SES — Voice Events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ses kanalına katılım (yeni katılım, taşıma değil)
 * @param {import("discord.js").VoiceState} oldState
 * @param {import("discord.js").VoiceState} newState
 */
async function logVoiceJoin(oldState, newState) {
  // Zaten bir kanaldan geliyor = taşıma; bu fonksiyon sadece fresh join için
  if (oldState.channel || !newState.channel) return;
  if (!newState.member) return;

  const embed = createDetailedEmbed(
    newState.guild.id,
    "🔊 SES KANALINA KATILDI",
    `<@${newState.member.id}> ses kanalına katıldı`,
    {
      "Kullanıcı": `${newState.member.user.tag}\n\`${newState.member.id}\``,
      "Ses Kanalı": `${newState.channel.name} (\`${newState.channel.id}\`)`,
      "Katılma Zamanı": toFull(Date.now()),
      "Yayın Yapıyor": newState.streaming ? "✅" : "❌",
      "Kamera Açık": newState.selfVideo ? "✅" : "❌",
      "Kendini Susturdu": newState.selfMute ? "✅" : "❌",
      "Kendini Kapattı": newState.selfDeaf ? "✅" : "❌"
    },
    "voice"
  );

  await sendCentralLog(embed);
}

/**
 * Ses kanalından tamamen ayrılış
 * @param {import("discord.js").VoiceState} oldState
 * @param {import("discord.js").VoiceState} newState
 */
async function logVoiceLeave(oldState, newState) {
  // Hâlâ bir kanaldaysa taşıma — bu fonksiyon sadece tamamen ayrılış için
  if (!oldState.channel || newState.channel) return;
  if (!oldState.member) return;

  // BUG FIX: Discord.js VoiceState'de joinedTimestamp mevcut değil,
  // bu nedenle kalış süresi hesaplanamaz — güvenli fallback kullan
  const embed = createDetailedEmbed(
    oldState.guild.id,
    "🔇 SES KANALINDAN AYRILDI",
    `<@${oldState.member.id}> ses kanalından ayrıldı`,
    {
      "Kullanıcı": `${oldState.member.user.tag}\n\`${oldState.member.id}\``,
      "Ses Kanalı": `${oldState.channel.name} (\`${oldState.channel.id}\`)`,
      "Ayrılma Zamanı": toFull(Date.now())
    },
    "voice"
  );

  await sendCentralLog(embed);
}

/**
 * Ses kanalında taşıma (kanal değiştirme)
 * @param {import("discord.js").VoiceState} oldState
 * @param {import("discord.js").VoiceState} newState
 */
async function logVoiceMove(oldState, newState) {
  // Her iki tarafta da kanal olmalı ve farklı kanallar olmalı
  if (!oldState.channel || !newState.channel) return;
  if (oldState.channel.id === newState.channel.id) return;
  if (!newState.member) return;

  const embed = createDetailedEmbed(
    oldState.guild.id,
    "🔄 SES KANALINDA TAŞINDI",
    `<@${newState.member.id}> ses kanalında taşındı`,
    {
      "Kullanıcı": `${newState.member.user.tag}\n\`${newState.member.id}\``,
      "Eski Kanal": `${oldState.channel.name} (\`${oldState.channel.id}\`)`,
      "Yeni Kanal": `${newState.channel.name} (\`${newState.channel.id}\`)`,
      "Taşınma Zamanı": toFull(Date.now())
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