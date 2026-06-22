const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const { GUILD2_ID } = require("../../config");

// Category for EkoYıldız Logs
const EKO_LOG_CATEGORY_ID = "1518692460233228431";

// Log channels mappings
const LOG_CHANNELS = {
  rol: "rol-log",
  tepki: "tepki-log",
  emoji: "emoji-log",
  talep: "talep-log",
  mesaj: "mesaj-log",
  seviye: "seviye-log",
  isim: "isim-log",
  ses: "ses-log",
  kanal: "kanal-log",
  davet: "davet-log",
  girisCikis: "giriş-çıkış-log",
  tag: "tag-log",
};

// In-memory channel ID cache
const resolvedChannels = {};

// Invite cache for tracking EkoYıldız invites
const inviteCache = new Map(); // inviteCode -> uses

/**
 * Initializes and creates all log channels under the EkoYıldız category on bot startup.
 * @param {import('discord.js').Client} client 
 */
async function initializeEkoLogger(client) {
  try {
    console.log("[ekoLogger] EkoYıldız Log Sistemleri Başlatılıyor...");
    const guild = await client.guilds.fetch(GUILD2_ID).catch(() => null);
    if (!guild) {
      console.warn("[ekoLogger] ⚠️ EkoYıldız sunucusu bulunamadı, log sistemleri kurulamadı.");
      return;
    }

    const category = await guild.channels.fetch(EKO_LOG_CATEGORY_ID).catch(() => null);
    if (!category) {
      console.warn(`[ekoLogger] ⚠️ EkoYıldız Log Kategorisi (${EKO_LOG_CATEGORY_ID}) bulunamadı.`);
      return;
    }

    // Ensure all 12 channels exist in the category
    for (const [key, name] of Object.entries(LOG_CHANNELS)) {
      let channel = guild.channels.cache.find(c => c.parentId === category.id && c.name === name);
      if (!channel) {
        channel = await guild.channels.create({
          name: name,
          type: 0, // text channel
          parent: category.id,
          topic: `EkoYıldız ${name} log kanalı.`
        }).catch(err => {
          console.error(`[ekoLogger] Kanal oluşturulamadı (${name}):`, err.message);
          return null;
        });
      }
      if (channel) {
        resolvedChannels[key] = channel.id;
      }
    }

    console.log("[ekoLogger] EkoYıldız Log Kanalları Hazır:", resolvedChannels);

    // Cache invites for EkoYıldız
    const invites = await guild.invites.fetch().catch(() => null);
    if (invites) {
      for (const [code, invite] of invites) {
        inviteCache.set(code, invite.uses);
      }
      console.log(`[ekoLogger] Cached ${inviteCache.size} invites for EkoYıldız`);
    }
  } catch (err) {
    console.error("[ekoLogger] initializeEkoLogger error:", err.message);
  }
}

function getEkoLogChannelId(type) {
  return resolvedChannels[type] || null;
}

// Helper to get log channel from cache
async function getLogChannel(guild, type) {
  const cId = resolvedChannels[type];
  if (!cId) return null;
  return guild.channels.cache.get(cId) || await guild.channels.fetch(cId).catch(() => null);
}

// Helper to fetch audit logs executor
async function fetchAuditLogExecutor(guild, actionType, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type: actionType, limit: 5 }).catch(() => null);
    if (!logs) return null;
    const entry = logs.entries.find(e => e.target?.id === targetId && Date.now() - e.createdTimestamp < 15000);
    return entry?.executor || null;
  } catch (_) {
    return null;
  }
}

// Helper to format account age
function formatAccountAge(createdAt) {
  const diffMs = Date.now() - createdAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isNew = diffDays < 7;
  const timeText = diffDays === 0
    ? `Bugün oluşturulmuş (${Math.floor(diffMs / (1000 * 60 * 60))} saat önce)`
    : `${diffDays} gün önce (${createdAt.toLocaleDateString("tr-TR")})`;
  
  return { text: timeText, isNew };
}

// --- Logging Functions ---

async function logEkoBanAdd(ban) {
  try {
    const channel = await getLogChannel(ban.guild, "rol"); // Ban is grouped with safety/role events or we send it here
    const gcChannel = await getLogChannel(ban.guild, "girisCikis");
    const logCh = gcChannel || channel;
    if (!logCh) return;

    const executor = await fetchAuditLogExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    const age = formatAccountAge(ban.user.createdAt);

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("⛔ Kullanıcı Yasaklandı (Ban)")
      .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "👤 Kullanıcı", value: `${ban.user.toString()}\n\`${ban.user.tag}\``, inline: true },
        { name: "🆔 Kullanıcı ID", value: `\`${ban.user.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? `${executor.toString()}\n\`${executor.id}\`` : "Bilinmiyor/Yapay Zeka", inline: true },
        { name: "📅 Hesap Yaşı", value: age.text, inline: true },
        { name: "📝 Gerekçe / Sebep", value: `\`\`\`${ban.reason || "Belirtilmedi"}\`\`\``, inline: false }
      )
      .setTimestamp();

    await logCh.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoBanAdd error:", err.message);
  }
}

async function logEkoBanRemove(ban) {
  try {
    const channel = await getLogChannel(ban.guild, "rol");
    const gcChannel = await getLogChannel(ban.guild, "girisCikis");
    const logCh = gcChannel || channel;
    if (!logCh) return;

    const executor = await fetchAuditLogExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Yasaklama Kaldırıldı")
      .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "👤 Kullanıcı", value: `${ban.user.toString()}\n\`${ban.user.tag}\``, inline: true },
        { name: "🆔 Kullanıcı ID", value: `\`${ban.user.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? `${executor.toString()}\n\`${executor.id}\`` : "Bilinmiyor", inline: true }
      )
      .setTimestamp();

    await logCh.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoBanRemove error:", err.message);
  }
}

async function logEkoMessageDelete(message) {
  try {
    const channel = await getLogChannel(message.guild, "mesaj");
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🗑️ Mesaj Silindi")
      .addFields(
        { name: "👤 Mesaj Sahibi", value: `${message.author.toString()}\n\`${message.author.id}\``, inline: true },
        { name: "📺 Kanal", value: `${message.channel.toString()}`, inline: true },
        { name: "🆔 Mesaj ID", value: `\`${message.id}\``, inline: true },
        { name: "📝 Silinen İçerik", value: `\`\`\`${message.content || "[İçerik Bulunmuyor Veya Görsel/Dosya]"}\`\`\``, inline: false }
      )
      .setTimestamp();

    if (message.attachments.size > 0) {
      const attachUrls = message.attachments.map(a => `[${a.name}](${a.url})`).join("\n");
      embed.addFields({ name: "📎 Silinen Dosyalar/Ekler", value: attachUrls || "Yok" });
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoMessageDelete error:", err.message);
  }
}

async function logEkoMessageUpdate(oldMessage, newMessage) {
  try {
    const channel = await getLogChannel(newMessage.guild, "mesaj");
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("📝 Mesaj Düzenlendi")
      .addFields(
        { name: "👤 Mesaj Sahibi", value: `${newMessage.author.toString()}\n\`${newMessage.author.id}\``, inline: true },
        { name: "📺 Kanal", value: `${newMessage.channel.toString()}`, inline: true },
        { name: "🔗 Mesaj Linki", value: `[Mesaja Git](${newMessage.url})`, inline: true },
        { name: "⬅️ Eski İçerik", value: `\`\`\`${oldMessage.content || "[Boş]"}\`\`\``, inline: false },
        { name: "➡️ Yeni İçerik", value: `\`\`\`${newMessage.content || "[Boş]"}\`\`\``, inline: false }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoMessageUpdate error:", err.message);
  }
}

async function logEkoVoiceStateUpdate(oldState, newState) {
  try {
    const channel = await getLogChannel(newState.guild, "ses");
    if (!channel) return;

    const member = newState.member;
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setTimestamp();

    if (!oldState.channelId && newState.channelId) {
      embed.setTitle("🔊 Ses Kanalına Katıldı")
        .setDescription(`**${member.user.tag}** kullanıcısı ses kanalına giriş yaptı.`)
        .addFields(
          { name: "👤 Kullanıcı", value: member.toString(), inline: true },
          { name: "📺 Katıldığı Kanal", value: newState.channel.toString(), inline: true },
          { name: "👥 Kanal Mevcudu", value: `\`${newState.channel.members.size} üye\``, inline: true }
        );
    } else if (oldState.channelId && !newState.channelId) {
      embed.setTitle("🔇 Ses Kanalından Ayrıldı")
        .setDescription(`**${member.user.tag}** kullanıcısı ses kanalından çıkış yaptı.`)
        .addFields(
          { name: "👤 Kullanıcı", value: member.toString(), inline: true },
          { name: "📺 Ayrıldığı Kanal", value: oldState.channel.toString(), inline: true }
        );
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      embed.setTitle("🔀 Ses Kanalı Değiştirdi")
        .setDescription(`**${member.user.tag}** kullanıcısı başka bir ses kanalına geçiş yaptı.`)
        .addFields(
          { name: "👤 Kullanıcı", value: member.toString(), inline: true },
          { name: "⬅️ Eski Kanal", value: oldState.channel.toString(), inline: true },
          { name: "➡️ Yeni Kanal", value: newState.channel.toString(), inline: true }
        );
    } else {
      return;
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoVoiceStateUpdate error:", err.message);
  }
}

async function logEkoMemberJoin(member) {
  try {
    const guild = member.guild;
    const age = formatAccountAge(member.user.createdAt);
    const memberCount = guild.memberCount;

    // 1. Giriş-Çıkış Logu
    const gcChannel = await getLogChannel(guild, "girisCikis");
    if (gcChannel) {
      const gcEmbed = new EmbedBuilder()
        .setColor(age.isNew ? 0xe67e22 : 0x2ecc71)
        .setTitle(age.isNew ? "⚠️ Şüpheli Yeni Hesap Katıldı" : "📥 Üye Katıldı")
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: "👤 Kullanıcı", value: `${member.toString()}\n\`${member.user.tag}\``, inline: true },
          { name: "🆔 Kullanıcı ID", value: `\`${member.id}\``, inline: true },
          { name: "📅 Hesap Kuruluş", value: member.user.createdAt.toLocaleDateString("tr-TR"), inline: true },
          { name: "⏳ Hesap Yaşı", value: age.text, inline: true },
          { name: "👥 Toplam Üye", value: `\`${memberCount} üye\``, inline: true }
        )
        .setTimestamp();
      
      if (age.isNew) {
        gcEmbed.setDescription("**UYARI:** Bu hesap 7 günden daha yeni olduğu için katılımı şüpheli olarak işaretlenmiştir!");
      }
      await gcChannel.send({ embeds: [gcEmbed] });
    }

    // 2. Davet Takibi ve Davet Logu
    const dChannel = await getLogChannel(guild, "davet");
    if (dChannel) {
      const newInvites = await guild.invites.fetch().catch(() => null);
      let inviterText = "Bilinmiyor veya Özel Davet";

      if (newInvites) {
        for (const [code, invite] of newInvites) {
          const cachedUses = inviteCache.get(code) || 0;
          if (invite.uses > cachedUses) {
            inviteCache.set(code, invite.uses); // update cache
            const inviter = invite.inviter;
            inviterText = inviter 
              ? `${inviter.toString()} (\`${inviter.tag}\`)\nDavet Kodu: \`${code}\` (Kullanım: **${invite.uses}**)` 
              : `Kod: \`${code}\` (Kullanım: **${invite.uses}**)`;
            break;
          }
        }
      }

      const dEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🔗 Davet Takibi")
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: "👤 Katılan", value: `${member.toString()}\n\`${member.user.tag}\``, inline: true },
          { name: "🆔 Katılan ID", value: `\`${member.id}\``, inline: true },
          { name: "🤝 Davet Eden", value: inviterText, inline: false }
        )
        .setTimestamp();
      await dChannel.send({ embeds: [dEmbed] });
    }
  } catch (err) {
    console.error("[ekoLogger] logEkoMemberJoin error:", err.message);
  }
}

async function logEkoMemberLeave(member) {
  try {
    const guild = member.guild;
    const gcChannel = await getLogChannel(guild, "girisCikis");
    if (!gcChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("📤 Üye Ayrıldı")
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "👤 Kullanıcı", value: `${member.toString()}\n\`${member.user.tag}\``, inline: true },
        { name: "🆔 Kullanıcı ID", value: `\`${member.id}\``, inline: true },
        { name: "👥 Kalan Üye", value: `\`${guild.memberCount} üye\``, inline: true }
      )
      .setTimestamp();

    await gcChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoMemberLeave error:", err.message);
  }
}

async function logEkoMemberUpdate(oldMember, newMember) {
  try {
    const guild = newMember.guild;
    const channel = await getLogChannel(guild, "isim");
    if (!channel) return;

    const embed = new EmbedBuilder().setTimestamp();

    // 1. İsim Değişikliği (Nickname)
    if (oldMember.nickname !== newMember.nickname) {
      const executor = await fetchAuditLogExecutor(guild, AuditLogEvent.MemberUpdate, newMember.id);
      embed.setColor(0x3498db)
        .setTitle("💾 İsim / Takma Ad Değiştirildi")
        .setDescription(`**${newMember.user.tag}** kullanıcısının ismi güncellendi.`)
        .addFields(
          { name: "👤 Kullanıcı", value: newMember.toString(), inline: true },
          { name: "🆔 Kullanıcı ID", value: `\`${newMember.id}\``, inline: true },
          { name: "🛡️ Değiştiren", value: executor ? executor.toString() : "Kendisi", inline: true },
          { name: "⬅️ Eski İsim", value: `\`${oldMember.nickname || oldMember.user.username}\``, inline: true },
          { name: "➡️ Yeni İsim", value: `\`${newMember.nickname || newMember.user.username}\``, inline: true }
        );
      await channel.send({ embeds: [embed] });
    }

    // 2. Rol Güncelleme Logu (Eğer rol eklendi/çıkarıldıysa)
    const oldRoles = oldMember.roles.cache.map(r => r.id);
    const newRoles = newMember.roles.cache.map(r => r.id);

    const added = newRoles.filter(r => !oldRoles.includes(r));
    const removed = oldRoles.filter(r => !newRoles.includes(r));

    if (added.length > 0 || removed.length > 0) {
      const rChannel = await getLogChannel(guild, "rol");
      if (rChannel) {
        const executor = await fetchAuditLogExecutor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
        const roleEmbed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle("🎭 Üye Rolleri Güncellendi")
          .setDescription(`**${newMember.user.tag}** kullanıcısının rolleri düzenlendi.`)
          .addFields(
            { name: "👤 Üye", value: newMember.toString(), inline: true },
            { name: "🆔 Üye ID", value: `\`${newMember.id}\``, inline: true },
            { name: "🛡️ Düzenleyen Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true }
          )
          .setTimestamp();

        if (added.length > 0) {
          roleEmbed.addFields({ name: "➕ Eklenen Roller", value: added.map(rId => `<@&${rId}>`).join("\n") });
        }
        if (removed.length > 0) {
          roleEmbed.addFields({ name: "➖ Kaldırılan Roller", value: removed.map(rId => `<@&${rId}>`).join("\n") });
        }
        await rChannel.send({ embeds: [roleEmbed] });
      }
    }
  } catch (err) {
    console.error("[ekoLogger] logEkoMemberUpdate error:", err.message);
  }
}

async function logEkoRoleCreate(role) {
  try {
    const channel = await getLogChannel(role.guild, "rol");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("➕ Yeni Rol Oluşturuldu")
      .addFields(
        { name: "🎭 Rol Adı", value: role.name, inline: true },
        { name: "🆔 Rol ID", value: `\`${role.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoRoleCreate error:", err.message);
  }
}

async function logEkoRoleDelete(role) {
  try {
    const channel = await getLogChannel(role.guild, "rol");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🗑️ Rol Silindi")
      .addFields(
        { name: "🎭 Rol Adı", value: role.name, inline: true },
        { name: "🆔 Rol ID", value: `\`${role.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoRoleDelete error:", err.message);
  }
}

async function logEkoRoleUpdate(oldRole, newRole) {
  try {
    const channel = await getLogChannel(newRole.guild, "rol");
    if (!channel) return;

    if (oldRole.name === newRole.name && oldRole.color === newRole.color && oldRole.permissions.bitfield === newRole.permissions.bitfield) return;

    const executor = await fetchAuditLogExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📝 Rol Güncellendi")
      .setDescription(`**${newRole.name}** rolü üzerinde düzenleme yapıldı.`)
      .addFields(
        { name: "🎭 Rol", value: newRole.toString(), inline: true },
        { name: "🆔 Rol ID", value: `\`${newRole.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true }
      )
      .setTimestamp();

    if (oldRole.name !== newRole.name) {
      embed.addFields(
        { name: "⬅️ Eski İsim", value: `\`${oldRole.name}\``, inline: true },
        { name: "➡️ Yeni İsim", value: `\`${newRole.name}\``, inline: true }
      );
    }
    if (oldRole.color !== newRole.color) {
      embed.addFields(
        { name: "⬅️ Eski Renk", value: `\`#${oldRole.color.toString(16)}\``, inline: true },
        { name: "➡️ Yeni Renk", value: `\`#${newRole.color.toString(16)}\``, inline: true }
      );
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoRoleUpdate error:", err.message);
  }
}

async function logEkoEmojiCreate(emoji) {
  try {
    const channel = await getLogChannel(emoji.guild, "emoji");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("😄 Emoji Eklendi")
      .addFields(
        { name: "🖼️ Emoji Görseli", value: emoji.toString(), inline: true },
        { name: "📝 Emoji Adı", value: `\`:${emoji.name}:\``, inline: true },
        { name: "🆔 Emoji ID", value: `\`${emoji.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true }
      )
      .setThumbnail(emoji.url)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoEmojiCreate error:", err.message);
  }
}

async function logEkoEmojiDelete(emoji) {
  try {
    const channel = await getLogChannel(emoji.guild, "emoji");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🗑️ Emoji Silindi")
      .addFields(
        { name: "📝 Emoji Adı", value: `\`:${emoji.name}:\``, inline: true },
        { name: "🆔 Emoji ID", value: `\`${emoji.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoEmojiDelete error:", err.message);
  }
}

async function logEkoEmojiUpdate(oldEmoji, newEmoji) {
  try {
    const channel = await getLogChannel(newEmoji.guild, "emoji");
    if (!channel) return;

    if (oldEmoji.name === newEmoji.name) return;

    const executor = await fetchAuditLogExecutor(newEmoji.guild, AuditLogEvent.EmojiUpdate, newEmoji.id);
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📝 Emoji Güncellendi")
      .addFields(
        { name: "🖼️ Emoji", value: newEmoji.toString(), inline: true },
        { name: "⬅️ Eski İsim", value: `\`:${oldEmoji.name}:\``, inline: true },
        { name: "➡️ Yeni İsim", value: `\`:${newEmoji.name}:\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true }
      )
      .setThumbnail(newEmoji.url)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoEmojiUpdate error:", err.message);
  }
}

async function logEkoChannelCreate(channel) {
  try {
    const logCh = await getLogChannel(channel.guild, "kanal");
    if (!logCh) return;

    const executor = await fetchAuditLogExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("📝 Yeni Kanal Oluşturuldu")
      .addFields(
        { name: "📺 Kanal", value: channel.toString() || `#${channel.name}`, inline: true },
        { name: "🆔 Kanal ID", value: `\`${channel.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true },
        { name: "📂 Kategori", value: channel.parent ? channel.parent.name : "Yok", inline: true }
      )
      .setTimestamp();

    await logCh.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoChannelCreate error:", err.message);
  }
}

async function logEkoChannelDelete(channel) {
  try {
    const logCh = await getLogChannel(channel.guild, "kanal");
    if (!logCh) return;

    const executor = await fetchAuditLogExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🗑️ Kanal Silindi")
      .addFields(
        { name: "📺 Kanal Adı", value: `#${channel.name}`, inline: true },
        { name: "🆔 Kanal ID", value: `\`${channel.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true },
        { name: "📂 Kategori", value: channel.parent ? channel.parent.name : "Yok", inline: true }
      )
      .setTimestamp();

    await logCh.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoChannelDelete error:", err.message);
  }
}

async function logEkoChannelUpdate(oldChannel, newChannel) {
  try {
    const logCh = await getLogChannel(newChannel.guild, "kanal");
    if (!logCh) return;

    if (oldChannel.name === newChannel.name && oldChannel.parentId === newChannel.parentId) return;

    const executor = await fetchAuditLogExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("📝 Kanal Güncellendi")
      .addFields(
        { name: "📺 Kanal", value: newChannel.toString(), inline: true },
        { name: "🆔 Kanal ID", value: `\`${newChannel.id}\``, inline: true },
        { name: "🛡️ Yetkili", value: executor ? executor.toString() : "Bilinmiyor", inline: true }
      )
      .setTimestamp();

    if (oldChannel.name !== newChannel.name) {
      embed.addFields(
        { name: "⬅️ Eski İsim", value: `\`${oldChannel.name}\``, inline: true },
        { name: "➡️ Yeni İsim", value: `\`${newChannel.name}\``, inline: true }
      );
    }

    await logCh.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoChannelUpdate error:", err.message);
  }
}

async function logEkoReactionAdd(reaction, user) {
  try {
    if (user.bot) return;
    const channel = await getLogChannel(reaction.message.guild, "tepki");
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("👍 Tepki Eklendi")
      .addFields(
        { name: "👤 Kullanıcı", value: `${user.toString()}\n\`${user.tag}\``, inline: true },
        { name: "🆔 Kullanıcı ID", value: `\`${user.id}\``, inline: true },
        { name: "😄 Tepki Emojisi", value: reaction.emoji.toString(), inline: true },
        { name: "📺 Kanal", value: reaction.message.channel.toString(), inline: true },
        { name: "🔗 Mesaj Linki", value: `[Mesaja Git](${reaction.message.url})`, inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoReactionAdd error:", err.message);
  }
}

async function logEkoReactionRemove(reaction, user) {
  try {
    if (user.bot) return;
    const channel = await getLogChannel(reaction.message.guild, "tepki");
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("👎 Tepki Kaldırıldı")
      .addFields(
        { name: "👤 Kullanıcı", value: `${user.toString()}\n\`${user.tag}\``, inline: true },
        { name: "🆔 Kullanıcı ID", value: `\`${user.id}\``, inline: true },
        { name: "😄 Tepki Emojisi", value: reaction.emoji.toString(), inline: true },
        { name: "📺 Kanal", value: reaction.message.channel.toString(), inline: true },
        { name: "🔗 Mesaj Linki", value: `[Mesaja Git](${reaction.message.url})`, inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoReactionRemove error:", err.message);
  }
}

async function logEkoLevelUp(member, level, roleName) {
  try {
    const channel = await getLogChannel(member.guild, "seviye");
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("📈 Seviye Atlandı")
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setDescription(`🎉 **${member.user.tag}** seviye atladı ve **Seviye ${level}** oldu!\n**Yeni Rol:** ${roleName}`)
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ekoLogger] logEkoLevelUp error:", err.message);
  }
}

module.exports = {
  initializeEkoLogger,
  getEkoLogChannelId,
  logEkoBanAdd,
  logEkoBanRemove,
  logEkoMessageDelete,
  logEkoMessageUpdate,
  logEkoVoiceStateUpdate,
  logEkoMemberJoin,
  logEkoMemberLeave,
  logEkoMemberUpdate,
  logEkoRoleCreate,
  logEkoRoleDelete,
  logEkoRoleUpdate,
  logEkoEmojiCreate,
  logEkoEmojiDelete,
  logEkoEmojiUpdate,
  logEkoChannelCreate,
  logEkoChannelDelete,
  logEkoChannelUpdate,
  logEkoReactionAdd,
  logEkoReactionRemove,
  logEkoLevelUp
};
