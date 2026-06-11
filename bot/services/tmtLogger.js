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
  tag: "1514583175412842576"
};

// Map of client invite cache for tracking who invited whom
const inviteCache = new Map(); // guildId -> Map(inviteCode -> uses)

async function findLogChannel(guild, type) {
  const identifier = LOG_CHANNELS[type];
  if (!identifier) return null;

  // Try fetching by ID
  let channel = guild.channels.cache.get(identifier);
  if (channel) return channel;

  // Try fetching by name
  channel = guild.channels.cache.find(c =>
    c.name.toLowerCase() === identifier.toLowerCase() ||
    c.name.toLowerCase().includes(identifier.replace(/[^\w\s-]/g, '').trim().toLowerCase())
  );

  return channel && channel.isSendable() ? channel : null;
}

async function ensureTMTLogEmbed(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID).catch(() => null);
    if (!guild) return;

    const channel = await guild.channels.fetch(LOG_CHANNELS.status).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    // Fetch last messages to see if log config embed already exists
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
    const existing = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title === "🛡️ TMT Log Yönetim Sistemi");

    const dateStr = new Date().toLocaleDateString("tr-TR") + " - " + new Date().toLocaleTimeString("tr-TR");

    const embed = new EmbedBuilder()
      .setTitle("🛡️ TMT Log Yönetim Sistemi")
      .setDescription(
        `**🤖 Moderasyon Logları:**\n` +
        `:box: :webhookBan: ・ban-log: :aktif: ⛔・ban-log\n` +
        `:box: :webhookTimeout: ・mute-log: :deaktif: Deaktif\n` +
        `:box: :jail: ・jail-log: :deaktif: Deaktif\n` +
        `:box: :staff: ・mod-log: :aktif: mod-logs\n\n` +
        `**📊 Genel Loglar:**\n` +
        `:pro: :role:・rol-log: :deaktif: Deaktif\n` +
        `:pro: :addreaction:・tepki-log: :deaktif: Deaktif\n` +
        `:emoji:・emoji-log: :deaktif: Deaktif\n` +
        `:talepayarlar:・talep-log: :deaktif: Deaktif\n` +
        `:webhookMessage:・mesaj-log: :aktif: 💬・mesaj-log\n` +
        `:rank:・seviye-log: :deaktif: Deaktif\n` +
        `:name:・isim-log: :deaktif: Deaktif\n` +
        `:ses:・ses-log: :aktif: 🔉・ses-log\n` +
        `:textchannel:・kanal-log: :deaktif: Deaktif\n` +
        `:davet:・davet-log: :aktif: davet-kayıtları\n` +
        `:artti:・giriş-çıkış-log: :aktif: 🔮・giriş-çıkış-log\n` +
        `:tag:・tag-log: :aktif: 💾┇moderator-only`
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

    // Fetch executor
    let executor = null;
    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 });
      const entry = logs.entries.find(e => e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 15000);
      executor = entry?.executor;
    } catch (_) { }

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("⛔ Kullanıcı Yasaklandı (TMT)")
      .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "Kullanıcı", value: `${ban.user.toString()}\n\`${ban.user.id}\``, inline: true },
        { name: "Yetkili", value: executor ? `${executor.toString()}\n\`${executor.id}\`` : "Bilinmiyor", inline: true },
        { name: "Sebep", value: ban.reason || "Belirtilmedi", inline: false }
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

    let executor = null;
    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 5 });
      const entry = logs.entries.find(e => e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 15000);
      executor = entry?.executor;
    } catch (_) { }

    const embed = new EmbedBuilder()
      .setColor(0x4ade80)
      .setTitle("✅ Yasak Kaldırıldı (TMT)")
      .setThumbnail(ban.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "Kullanıcı", value: `${ban.user.toString()}\n\`${ban.user.id}\``, inline: true },
        { name: "Yetkili", value: executor ? `${executor.toString()}\n\`${executor.id}\`` : "Bilinmiyor", inline: true }
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

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`🛡️ Moderasyon İşlemi: ${actionText}`)
      .addFields(
        { name: "Yetkili", value: `${interaction.user.toString()}\n\`${interaction.user.id}\``, inline: true },
        { name: "Hedef", value: targetUser ? `${targetUser.toString()}\n\`${targetUser.id}\`` : "—", inline: true },
        { name: "Detay/Sebep", value: reason || "Belirtilmedi", inline: false }
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
        { name: "Yazar", value: `${message.author.toString()}\n\`${message.author.id}\``, inline: true },
        { name: "Kanal", value: `${message.channel.toString()}`, inline: true },
        { name: "Mesaj İçeriği", value: `\`\`\`${message.content || "[İçerik Yok Veya Dosya]"}\`\`\``, inline: false }
      )
      .setTimestamp();

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
        { name: "Yazar", value: `${newMessage.author.toString()}\n\`${newMessage.author.id}\``, inline: true },
        { name: "Kanal", value: `${newMessage.channel.toString()}`, inline: true },
        { name: "Eski Mesaj", value: `\`\`\`${oldMessage.content || "[Boş]"}\`\`\``, inline: false },
        { name: "Yeni Mesaj", value: `\`\`\`${newMessage.content || "[Boş]"}\`\`\``, inline: false }
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
      .setTimestamp();

    if (!oldState.channelId && newState.channelId) {
      embed.setTitle("🔊 Sese Bağlandı")
        .setDescription(`**${member.user.tag}** kullanıcısı ${newState.channel.toString()} kanalına katıldı.`);
    } else if (oldState.channelId && !newState.channelId) {
      embed.setTitle("🔇 Sesten Ayrıldı")
        .setDescription(`**${member.user.tag}** kullanıcısı ${oldState.channel.toString()} kanalından ayrıldı.`);
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      embed.setTitle("🔀 Ses Kanalı Değiştirdi")
        .setDescription(`**${member.user.tag}** kullanıcısı kanal değiştirdi:\n` +
          `**Eski Kanal:** ${oldState.channel.toString()}\n` +
          `**Yeni Kanal:** ${newState.channel.toString()}`);
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
      console.log(`[tmtLogger] Cached ${gInvites.size} invites for guild ${guild.name}`);
    }
  } catch (err) {
    console.warn("[tmtLogger] Could not cache invites on startup:", err.message);
  }
}

// Member Join
async function logTMTMemberJoin(member) {
  try {
    const guild = member.guild;

    // Giriş çıkış logu
    const gcChannel = await findLogChannel(guild, "girisCikis");
    if (gcChannel) {
      const gcEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("📥 Üye Katıldı")
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .setDescription(`**${member.user.tag}** (\`${member.id}\`) sunucuya katıldı.`)
        .setTimestamp();
      await gcChannel.send({ embeds: [gcEmbed] });
    }

    // Davet logu
    const davetChannel = await findLogChannel(guild, "davet");
    if (davetChannel) {
      // Find used invite
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

      // Update cache
      if (current) {
        const newCache = new Map();
        for (const [code, invite] of current) {
          newCache.set(code, invite.uses);
        }
        inviteCache.set(guild.id, newCache);
      }

      const davetEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📨 Davet Bilgisi")
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .setTimestamp();

      if (usedInvite) {
        davetEmbed.setDescription(
          `**Katılan:** ${member.user.toString()} (\`${member.id}\`)\n` +
          `**Davet Eden:** ${usedInvite.inviter ? usedInvite.inviter.toString() : "Bilinmiyor"}\n` +
          `**Kod:** \`${usedInvite.code}\` (Kullanım: ${usedInvite.uses})`
        );
      } else {
        davetEmbed.setDescription(
          `**Katılan:** ${member.user.toString()} (\`${member.id}\`)\n` +
          `**Davet Eden:** Bilinmiyor (Özel davet/Vanity URL veya algılanamadı)`
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

    const gcEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("📤 Üye Ayrıldı")
      .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
      .setDescription(`**${member.user.tag}** (\`${member.id}\`) sunucudan ayrıldı.`)
      .setTimestamp();
    await gcChannel.send({ embeds: [gcEmbed] });
  } catch (err) {
    console.error("[tmtLogger] logTMTMemberLeave error:", err.message);
  }
}

// Tag (Nickname/Username) Change Log
async function logTMTMemberUpdate(oldMember, newMember) {
  try {
    if (oldMember.nickname === newMember.nickname && oldMember.user.username === newMember.user.username) return;

    const channel = await findLogChannel(newMember.guild, "tag");
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("💾 İsim/Nickname Güncellendi")
      .setThumbnail(newMember.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: "Kullanıcı", value: `${newMember.user.toString()}\n\`${newMember.id}\``, inline: false }
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
  logTMTMemberUpdate
};
