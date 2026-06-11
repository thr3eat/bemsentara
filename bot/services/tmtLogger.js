const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const { TMT_GUILD_ID } = require("../../config");

// Configured active channels
const LOG_CHANNELS = {
  status: "1514583175412842576",
  ban: "1514583175412842576",
  mod: "1514583175412842576",
  mesaj: "1514583175412842576",
  ses: "1514583175412842576",
  davet: "1514583175412842576",
  girisCikis: "1514583175412842576",
  tag: "1514583175412842576",
  rol: "1514583175412842576",
  tepki: "1514583175412842576",
  emoji: "1514583175412842576",
  talep: "1514583175412842576",
  seviye: "1514583175412842576",
  kanal: "1514583175412842576",
  mute: "1514583175412842576",
  jail: "1514583175412842576",
  isim: "1514583175412842576"
};

// Map of client invite cache for tracking who invited whom
const inviteCache = new Map(); // guildId -> Map(inviteCode -> uses)

// Helper to find the log channel
async function findLogChannel(guild, type) {
  const identifier = LOG_CHANNELS[type];
  if (!identifier) return null;

  let channel = guild.channels.cache.get(identifier);
  if (channel) return channel;

  channel = guild.channels.cache.find(c => 
    c.name.toLowerCase() === identifier.toLowerCase() || 
    c.name.toLowerCase().includes(identifier.replace(/[^\w\s-]/g, '').trim().toLowerCase())
  );
  
  return channel && channel.isSendable() ? channel : null;
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

async function ensureTMTLogEmbed(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID).catch(() => null);
    if (!guild) return;

    const channel = await guild.channels.fetch(LOG_CHANNELS.status).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
    const existing = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title === "🛡️ TMT Gelişmiş Log Yönetim Sistemi");

    const dateStr = new Date().toLocaleDateString("tr-TR") + " - " + new Date().toLocaleTimeString("tr-TR");

    const embed = new EmbedBuilder()
      .setTitle("🛡️ TMT Gelişmiş Log Yönetim Sistemi")
      .setDescription(
        `**🤖 Gelişmiş Moderasyon Logları:**\n` +
        `:box: :webhookBan: ・ban-log: :aktif: ⛔・ban-log (Yetkili & Süre Bilgisiyle)\n` +
        `:box: :webhookTimeout: ・mute-log: :aktif: 🔇・mute-log (Audit Log Destekli)\n` +
        `:box: :jail: ・jail-log: :aktif: 🔒・jail-log (Otomatik Takip)\n` +
        `:box: :staff: ・mod-log: :aktif: mod-logs (Detaylı Komut İncelemesi)\n\n` +
        `**📊 Gelişmiş Genel Loglar:**\n` +
        `:pro: :role:・rol-log: :aktif: 🎭・rol-log (İzin ve Renk Güncellemeleri)\n` +
        `:pro: :addreaction:・tepki-log: :aktif: 👍・tepki-log (Mesaj ve Kanal Linkli)\n` +
        `:emoji:・emoji-log: :aktif: 😄・emoji-log (Emoji Görsel Destekli)\n` +
        `:talepayarlar:・talep-log: :aktif: 🎫・talep-log (Kategori ve Geçmiş Raporlu)\n` +
        `:webhookMessage:・mesaj-log: :aktif: 💬・mesaj-log (Eski/Yeni İçerik & Fark Analizi)\n` +
        `:rank:・seviye-log: :aktif: 📈・seviye-log (Seviye Atlama Duyurusu)\n` +
        `:name:・isim-log: :aktif: 💾・isim-log (Yetkili Tarafından Değiştirilme Detayıyla)\n` +
        `:ses:・ses-log: :aktif: 🔉・ses-log (Oda Değişiklikleri & Süre Hesabı)\n` +
        `:textchannel:・kanal-log: :aktif: 📝・kanal-log (Kategori ve İzin Detaylarıyla)\n` +
        `:davet:・davet-log: :aktif: davet-kayıtları (Davet Eden & Toplam Kullanım)\n` +
        `:artti:・giriş-çıkış-log: :aktif: 🔮・giriş-çıkış-log (Hesap Yaşı & Üye Sayısıyla)\n` +
        `:tag:・tag-log: :aktif: 💾┇tag-log`
      )
      .setColor(0x2B2D31)
      .setFooter({ text: `Sorgulayan: eko1337 | Son güncellenme: ${dateStr}` });

    if (existing) {
      await existing.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error("[tmtLogger] ensureTMTLogEmbed error:", err.message);
  }
}

// Ban logs
async function logTMTBanAdd(ban) {
  try {
    const channel = await findLogChannel(ban.guild, "ban");
    if (!channel) return;

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

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTBanAdd error:", err.message);
  }
}

async function logTMTBanRemove(ban) {
  try {
    const channel = await findLogChannel(ban.guild, "ban");
    if (!channel) return;

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

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTBanRemove error:", err.message);
  }
}

// Mod Logs
async function logTMTModAction(interaction, commandName, targetUser, reason) {
  try {
    const channel = await findLogChannel(interaction.guild, "mod");
    if (!channel) return;

    const actionText = {
      mesaj_sil: "Mesaj Temizleme",
      sustur: "Susturma (Timeout)",
      susturma_kaldir: "Susturma Kaldırma",
      yasakla: "Yasaklama (Ban)",
      yasaklama_kaldir: "Yasaklama Kaldırma"
    }[commandName] || commandName;

    const colors = {
      mesaj_sil: 0x3498db,
      sustur: 0xe67e22,
      susturma_kaldir: 0x2ecc71,
      yasakla: 0xed4245,
      yasaklama_kaldir: 0x2ecc71
    };

    const embed = new EmbedBuilder()
      .setColor(colors[commandName] || 0x3498DB)
      .setTitle(`🛡️ Moderasyon İşlemi: ${actionText}`)
      .addFields(
        { name: "👤 Yetkili", value: `${interaction.user.toString()}\n\`${interaction.user.id}\``, inline: true },
        { name: "🎯 Hedef Kullanıcı", value: targetUser ? `${targetUser.toString()}\n\`${targetUser.id}\`` : "—", inline: true },
        { name: "📺 Kanal", value: `${interaction.channel.toString()}`, inline: true },
        { name: "📝 İşlem Detayı", value: `\`\`\`${reason || "Belirtilmedi"}\`\`\``, inline: false }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTModAction error:", err.message);
  }
}

// Message Logs
async function logTMTMessageDelete(message) {
  try {
    const channel = await findLogChannel(message.guild, "mesaj");
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
    console.error("[tmtLogger] logTMTMessageDelete error:", err.message);
  }
}

async function logTMTMessageUpdate(oldMessage, newMessage) {
  try {
    const channel = await findLogChannel(newMessage.guild, "mesaj");
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
    console.error("[tmtLogger] logTMTMessageUpdate error:", err.message);
  }
}

// Voice logs
async function logTMTVoiceStateUpdate(oldState, newState) {
  try {
    const channel = await findLogChannel(newState.guild, "ses");
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
      return; // mute/deafen updates, don't log to prevent spam
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTVoiceStateUpdate error:", err.message);
  }
}

// Invite tracking cache
async function initTMTInvites(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID).catch(() => null);
    if (!guild) return;

    const invites = await guild.invites.fetch().catch(() => null);
    if (invites) {
      const gInvites = new Map();
      for (const [code, invite] of invites) {
        gInvites.set(code, invite.uses);
      }
      inviteCache.set(guild.id, gInvites);
      console.log(`[tmtLogger] Cached ${gInvites.size} invites for TMT Guild`);
    }
  } catch (err) {
    console.warn("[tmtLogger] Could not cache invites on startup:", err.message);
  }
}

// Member Join
async function logTMTMemberJoin(member) {
  try {
    const guild = member.guild;
    const age = formatAccountAge(member.user.createdAt);
    const memberCount = guild.memberCount;
    
    // Giriş çıkış logu
    const gcChannel = await findLogChannel(guild, "girisCikis");
    if (gcChannel) {
      const gcEmbed = new EmbedBuilder()
        .setColor(age.isNew ? 0xe67e22 : 0x2ecc71)
        .setTitle(age.isNew ? "⚠️ Şüpheli Yeni Hesap Katıldı" : "📥 Üye Katıldı")
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .addFields(
          { name: "👤 Kullanıcı", value: `${member.toString()}\n\`${member.user.tag}\``, inline: true },
          { name: "🆔 Kullanıcı ID", value: `\`${member.id}\``, inline: true },
          { name: "📅 Hesap Kuruluş Tarihi", value: member.user.createdAt.toLocaleDateString("tr-TR"), inline: true },
          { name: "⏳ Hesap Yaşı", value: age.text, inline: true },
          { name: "👥 Toplam Üye", value: `\`${memberCount} üye\``, inline: true }
        )
        .setTimestamp();
      
      if (age.isNew) {
        gcEmbed.setDescription("**UYARI:** Bu hesap 7 günden daha yeni olduğu için katılımı şüpheli olarak işaretlenmiştir!");
      }

      await gcChannel.send({ embeds: [gcEmbed] });
    }

    // Davet logu
    const davetChannel = await findLogChannel(guild, "davet");
    if (davetChannel) {
      const cached = inviteCache.get(guild.id);
      const current = await guild.invites.fetch().catch(() => null);
      let usedInvite = null;

      if (cached && current) {
        for (const [code, invite] of current) {
          const prevUses = cached.get(code) || 0;
          if (invite.uses > prevUses) {
            usedInvite = invite;
            cached.set(code, invite.uses);
            break;
          }
        }
      }

      if (current) {
        const newCache = new Map();
        for (const [code, invite] of current) {
          newCache.set(code, invite.uses);
        }
        inviteCache.set(guild.id, newCache);
      }

      const davetEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📨 Davet Logları")
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .setTimestamp();

      if (usedInvite) {
        davetEmbed.setDescription(
          `**Katılan:** ${member.user.toString()} (\`${member.id}\`)\n` +
          `**Davet Eden:** ${usedInvite.inviter ? usedInvite.inviter.toString() : "Bilinmiyor"}\n` +
          `**Kullanılan Kod:** \`${usedInvite.code}\` (Kullanım: ${usedInvite.uses})`
        );
      } else {
        davetEmbed.setDescription(
          `**Katılan:** ${member.user.toString()} (\`${member.id}\`)\n` +
          `**Davet Eden:** Algılanamadı (Özel Davet/Vanity URL veya Anlık Oluşturulmuş)`
        );
      }
      await davetChannel.send({ embeds: [davetEmbed] });
    }
  } catch (err) {
    console.error("[tmtLogger] logTMTMemberJoin error:", err.message);
  }
}

// Member Leave
async function logTMTMemberLeave(member) {
  try {
    const gcChannel = await findLogChannel(member.guild, "girisCikis");
    if (!gcChannel) return;

    const memberCount = member.guild.memberCount;
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("📤 Üye Ayrıldı")
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "👤 Kullanıcı", value: `${member.toString()}\n\`${member.user.tag}\``, inline: true },
        { name: "🆔 Kullanıcı ID", value: `\`${member.id}\``, inline: true },
        { name: "👥 Kalan Toplam Üye", value: `\`${memberCount} üye\``, inline: true }
      )
      .setTimestamp();
    await gcChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTMemberLeave error:", err.message);
  }
}

// Nickname Update Log
async function logTMTMemberUpdate(oldMember, newMember) {
  try {
    if (oldMember.nickname === newMember.nickname && oldMember.user.username === newMember.user.username) return;

    const channel = await findLogChannel(newMember.guild, "tag");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("💾 İsim/Nickname Güncellendi")
      .setThumbnail(newMember.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "👤 Kullanıcı", value: `${newMember.user.toString()}\n\`${newMember.id}\``, inline: true },
        { name: "🛡️ Güncelleyen", value: executor ? `${executor.toString()}` : "Kendi Tarafından", inline: true }
      )
      .setTimestamp();

    if (oldMember.user.username !== newMember.user.username) {
      embed.addFields(
        { name: "Eski Kullanıcı Adı", value: `\`${oldMember.user.username}\``, inline: true },
        { name: "Yeni Kullanıcı Adı", value: `\`${newMember.user.username}\``, inline: true }
      );
    }

    if (oldMember.nickname !== newMember.nickname) {
      embed.addFields(
        { name: "Eski Takma Ad (Nickname)", value: `\`${oldMember.nickname || "Yok"}\``, inline: true },
        { name: "Yeni Takma Ad (Nickname)", value: `\`${newMember.nickname || "Yok"}\``, inline: true }
      );
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTMemberUpdate error:", err.message);
  }
}

// Roles Create/Delete/Update Logs
async function logTMTRoleCreate(role) {
  try {
    const channel = await findLogChannel(role.guild, "rol");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🎭 Rol Oluşturuldu")
      .addFields(
        { name: "🏷️ Rol İsmi", value: role.name, inline: true },
        { name: "🆔 Rol ID", value: `\`${role.id}\``, inline: true },
        { name: "🎨 Rol Rengi", value: `\`${role.hexColor}\``, inline: true },
        { name: "🛡️ Oluşturan", value: executor ? `${executor.toString()}` : "Bilinmiyor", inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTRoleCreate error:", err.message);
  }
}

async function logTMTRoleDelete(role) {
  try {
    const channel = await findLogChannel(role.guild, "rol");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🗑️ Rol Silindi")
      .addFields(
        { name: "🏷️ Rol İsmi", value: role.name, inline: true },
        { name: "🆔 Rol ID", value: `\`${role.id}\``, inline: true },
        { name: "🛡️ Silen Yetkili", value: executor ? `${executor.toString()}` : "Bilinmiyor", inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTRoleDelete error:", err.message);
  }
}

async function logTMTRoleUpdate(oldRole, newRole) {
  try {
    if (oldRole.name === newRole.name && oldRole.hexColor === newRole.hexColor) return;
    const channel = await findLogChannel(newRole.guild, "rol");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("📝 Rol Güncellendi")
      .setDescription(`**Rol:** ${newRole.toString()} (\`${newRole.id}\`)`)
      .setTimestamp();

    if (executor) {
      embed.addFields({ name: "🛡️ Düzenleyen Yetkili", value: executor.toString() });
    }

    if (oldRole.name !== newRole.name) {
      embed.addFields(
        { name: "Eski İsim", value: oldRole.name, inline: true },
        { name: "Yeni İsim", value: newRole.name, inline: true }
      );
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      embed.addFields(
        { name: "Eski Renk", value: oldRole.hexColor, inline: true },
        { name: "Yeni Renk", value: newRole.hexColor, inline: true }
      );
    }
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTRoleUpdate error:", err.message);
  }
}

// Emoji Create/Delete/Update Logs
async function logTMTEmojiCreate(emoji) {
  try {
    const channel = await findLogChannel(emoji.guild, "emoji");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("😄 Emoji Eklendi")
      .setThumbnail(emoji.url)
      .addFields(
        { name: "🏷️ Emoji İsmi", value: `\`:${emoji.name}:\``, inline: true },
        { name: "🆔 Emoji ID", value: `\`${emoji.id}\``, inline: true },
        { name: "🛡️ Ekleyen Yetkili", value: executor ? `${executor.toString()}` : "Bilinmiyor", inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTEmojiCreate error:", err.message);
  }
}

async function logTMTEmojiDelete(emoji) {
  try {
    const channel = await findLogChannel(emoji.guild, "emoji");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🗑️ Emoji Silindi")
      .addFields(
        { name: "🏷️ Emoji İsmi", value: `\`:${emoji.name}:\``, inline: true },
        { name: "🆔 Emoji ID", value: `\`${emoji.id}\``, inline: true },
        { name: "🛡️ Silen Yetkili", value: executor ? `${executor.toString()}` : "Bilinmiyor", inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTEmojiDelete error:", err.message);
  }
}

async function logTMTEmojiUpdate(oldEmoji, newEmoji) {
  try {
    if (oldEmoji.name === newEmoji.name) return;
    const channel = await findLogChannel(newEmoji.guild, "emoji");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(newEmoji.guild, AuditLogEvent.EmojiUpdate, newEmoji.id);

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("📝 Emoji Güncellendi")
      .setThumbnail(newEmoji.url)
      .addFields(
        { name: "Eski İsim", value: `\`${oldEmoji.name}\``, inline: true },
        { name: "Yeni İsim", value: `\`${newEmoji.name}\``, inline: true },
        { name: "🛡️ Düzenleyen", value: executor ? `${executor.toString()}` : "Bilinmiyor", inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTEmojiUpdate error:", err.message);
  }
}

// Channel Create/Delete/Update Logs
async function logTMTChannelCreate(ch) {
  try {
    const channel = await findLogChannel(ch.guild, "kanal");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(ch.guild, AuditLogEvent.ChannelCreate, ch.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("📝 Kanal Oluşturuldu")
      .addFields(
        { name: "📺 Kanal Mention", value: ch.toString(), inline: true },
        { name: "🏷️ Kanal İsmi", value: `#${ch.name}`, inline: true },
        { name: "🆔 Kanal ID", value: `\`${ch.id}\``, inline: true },
        { name: "📁 Kategori", value: ch.parent ? ch.parent.name : "Kategori Yok", inline: true },
        { name: "🛡️ Oluşturan", value: executor ? `${executor.toString()}` : "Bilinmiyor", inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTChannelCreate error:", err.message);
  }
}

async function logTMTChannelDelete(ch) {
  try {
    const channel = await findLogChannel(ch.guild, "kanal");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(ch.guild, AuditLogEvent.ChannelDelete, ch.id);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🗑️ Kanal Silindi")
      .addFields(
        { name: "🏷️ Kanal İsmi", value: `#${ch.name}`, inline: true },
        { name: "🆔 Kanal ID", value: `\`${ch.id}\``, inline: true },
        { name: "📁 Kategori", value: ch.parent ? ch.parent.name : "Kategori Yok", inline: true },
        { name: "🛡️ Silen Yetkili", value: executor ? `${executor.toString()}` : "Bilinmiyor", inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTChannelDelete error:", err.message);
  }
}

async function logTMTChannelUpdate(oldCh, newCh) {
  try {
    if (oldCh.name === newCh.name && oldCh.parentId === newCh.parentId) return;
    const channel = await findLogChannel(newCh.guild, "kanal");
    if (!channel) return;

    const executor = await fetchAuditLogExecutor(newCh.guild, AuditLogEvent.ChannelUpdate, newCh.id);

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("📝 Kanal Güncellendi")
      .addFields(
        { name: "📺 Kanal", value: newCh.toString(), inline: true },
        { name: "🆔 Kanal ID", value: `\`${newCh.id}\``, inline: true },
        { name: "🛡️ Güncelleyen", value: executor ? `${executor.toString()}` : "Bilinmiyor", inline: true }
      )
      .setTimestamp();

    if (oldCh.name !== newCh.name) {
      embed.addFields(
        { name: "Eski İsim", value: `#${oldCh.name}`, inline: true },
        { name: "Yeni İsim", value: `#${newCh.name}`, inline: true }
      );
    }
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTChannelUpdate error:", err.message);
  }
}

// Message Reaction Add/Remove Logs
async function logTMTReactionAdd(reaction, user) {
  try {
    if (user.bot) return;
    const channel = await findLogChannel(reaction.message.guild, "tepki");
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("👍 Tepki Eklendi")
      .addFields(
        { name: "👤 Kullanıcı", value: `${user.toString()}\n\`${user.tag}\``, inline: true },
        { name: "🆔 Kullanıcı ID", value: `\`${user.id}\``, inline: true },
        { name: "😄 Tepki Emojisi", value: reaction.emoji.toString(), inline: true },
        { name: "📺 Kanal", value: reaction.message.channel.toString(), inline: true },
        { name: "✍️ Mesaj Sahibi", value: reaction.message.author ? reaction.message.author.toString() : "Bilinmiyor", inline: true },
        { name: "🔗 Mesaj Linki", value: `[Mesaja Git](${reaction.message.url})`, inline: true }
      )
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTReactionAdd error:", err.message);
  }
}

async function logTMTReactionRemove(reaction, user) {
  try {
    if (user.bot) return;
    const channel = await findLogChannel(reaction.message.guild, "tepki");
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
    console.error("[tmtLogger] logTMTReactionRemove error:", err.message);
  }
}

async function logTMTLevelUp(member, level, roleName) {
  try {
    const channel = await findLogChannel(member.guild, "seviye");
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("📈 Seviye Atlandı")
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setDescription(`🎉 **${member.user.tag}** seviye atladı ve **Seviye ${level}** oldu!\n**Yeni Rol:** ${roleName}`)
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTLevelUp error:", err.message);
  }
}

module.exports = {
  ensureTMTLogEmbed,
  logTMTBanAdd,
  logTMTBanRemove,
  logTMTModAction,
  logTMTMessageDelete,
  logTMTMessageUpdate,
  logTMTVoiceStateUpdate,
  initTMTInvites,
  logTMTMemberJoin,
  logTMTMemberLeave,
  logTMTMemberUpdate,
  logTMTRoleCreate,
  logTMTRoleDelete,
  logTMTRoleUpdate,
  logTMTEmojiCreate,
  logTMTEmojiDelete,
  logTMTEmojiUpdate,
  logTMTChannelCreate,
  logTMTChannelDelete,
  logTMTChannelUpdate,
  logTMTReactionAdd,
  logTMTReactionRemove,
  logTMTLevelUp
};
