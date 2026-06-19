const { handleButtonInteraction } = require("./buttonHandler");
const { handleSelectInteraction } = require("./selectHandler");
const { handleModalSubmit } = require("./modalHandler");
const { handleGeneralCommand } = require("./generalCommandHandler");
const { handleEconomyCommand } = require("./economyCommandHandler");
const { handleFunCommand } = require("./funCommandHandler");
const { handleModerationCommand } = require("./moderationCommandHandler");
const { setupCentralAuditHandler } = require("./centralAuditHandler");

function initializeDiscordHandlers(client) {
  const { initializeVoiceAndBanHandlers } = require("./voiceHandler");
  initializeVoiceAndBanHandlers(client);
  
  // Merkezi Denetim Günlüğü Handler'ını başlat
  setupCentralAuditHandler(client);

  client.once("ready", async () => {
    const { ensureVerifyHelpMessage } = require("../services/verifyHelpMessage");
    const { ensureVoicePanelMessage } = require("../services/voicePanelMessage");
    const { ensureTMTVerifyHelpMessage } = require("../services/tmtVerifyHelpMessage");
    const { ensureTMTSupportMessage } = require("../services/tmtSupportMessage");
    const { ensureTMTRules } = require("../services/ensureTMTRules");
    const { startCleanupScheduler } = require("../services/ticketCleanup");
    const { startStaffScheduler } = require("../services/staffSystem");
    const { RULE_PREFIX } = require("../services/tmtAutomodService");
    const { startAtaturkHistoryScheduler } = require("../services/ataturkHistoryAI");
    const { initializeRoblox, ensureRobloxManagementMenu, ensureEkoYildizRobloxMenu, ensureAlliedRobloxMenu, ensureBemRobloxMenu } = require("../services/robloxGroupManager");
    const { startAuditLogPoller } = require("../services/robloxAuditLogPoller");
    const { initTMTInvites, ensureTMTLogEmbed } = require("../services/tmtLogger");
    const { ensureAlliedVerifyHelpMessage, ensureAlliedSupportMessage } = require("../services/alliedRoleSyncService");

    await ensureVerifyHelpMessage(client);
    await ensureVoicePanelMessage(client);
    await ensureTMTVerifyHelpMessage(client);
    await ensureTMTSupportMessage(client);
    await ensureTMTRules(client);
    await initializeRoblox();
    await ensureRobloxManagementMenu(client);
    await ensureEkoYildizRobloxMenu(client);
    await ensureAlliedRobloxMenu(client);
    await ensureBemRobloxMenu(client);
    startAuditLogPoller(client);
    const { startDiscordAbuseDetector } = require("../services/discordAbuseDetector");
    startDiscordAbuseDetector(client);
    await ensureAlliedVerifyHelpMessage(client);
    await ensureAlliedSupportMessage(client);
    await initTMTInvites(client);
    await ensureTMTLogEmbed(client);

    startCleanupScheduler();
    startStaffScheduler(client);
    startAtaturkHistoryScheduler(client);

    // AI Kanal Sohbet İzleme
    const { startAIChatMonitor } = require('../services/aiChannelChat');
    startAIChatMonitor(client);
  });

  // ── Sunucuya katılan üyeye doğrulanmamış rolü ver ──────────────────────────
  client.on("guildMemberAdd", async (member) => {
    try {
      if (member.user.bot) return;

      // AI konus rol iadesi
      try {
        const { restoreKonusRoles } = require('../services/aiTalkService');
        await restoreKonusRoles(member, client);
      } catch (err) {
        console.error('[guildMemberAdd] restoreKonusRoles hatası:', err.message);
      }

      const { TARGET_GUILD_ID, UNVERIFIED_ROLE_ID, TMT_GUILD_ID, TMT_UNVERIFIED_ROLE_ID } = require("../../config");
      const { PermissionFlagsBits } = require('discord.js');

      let targetRoleId = null;
      if (member.guild.id === TARGET_GUILD_ID) {
        targetRoleId = UNVERIFIED_ROLE_ID;
      } else if (member.guild.id === TMT_GUILD_ID) {
        targetRoleId = TMT_UNVERIFIED_ROLE_ID;
        const { logTMTMemberJoin } = require("../services/tmtLogger");
        logTMTMemberJoin(member);
      } else {
        return;
      }
      
      if (!targetRoleId) {
        console.warn(`[guildMemberAdd] Unverified role not configured for guild ${member.guild.id}`);
        return;
      }

      // Check bot permissions
      const botMember = await member.guild.members.fetchMe().catch(err => {
        console.error('[guildMemberAdd] Cannot fetch bot member:', err.code);
        return null;
      });
      
      if (!botMember) {
        console.error('[guildMemberAdd] Bot member object is null');
        return;
      }
      
      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        console.error('[guildMemberAdd] ⚠️ Bot missing ManageRoles permission');
        return;
      }

      const role = member.guild.roles.cache.get(targetRoleId);
      if (!role) {
        console.warn(`[guildMemberAdd] Role ${targetRoleId} not found in guild`);
        return;
      }

      await member.roles.add(role, "Yeni üye — doğrulanmamış").catch(err => {
        console.error(`[guildMemberAdd] Cannot add role to ${member.user.tag}:`, err.code, err.message);
        if (err.code === 'DiscordAPIError[50] Missing permissions') {
          console.error('[guildMemberAdd] ⚠️ Bot has insufficient permissions');
        }
      });
      
      console.log(`[guildMemberAdd] ${member.user.tag} → doğrulanmamış rolü verildi`);
    } catch (err) {
      console.error("[guildMemberAdd] Fatal error:", err.message);
    }
  });

  client.on("autoModerationActionExecution", async (execution) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (execution.guild.id === TMT_GUILD_ID) {
        const { handleTMTAutoModViolation } = require("../services/tmtWarningSystem");
        await handleTMTAutoModViolation(execution, client);

        const { RULE_PREFIX } = require("../services/tmtAutomodService");
        if (execution.ruleTriggerType === 1) { // 1 = Keyword
          const rule = await execution.guild.autoModerationRules.fetch(execution.ruleId).catch(() => null);
          if (rule && rule.name === `${RULE_PREFIX}1.0 Kişisel Bilgiler`) {
            const member = await execution.guild.members.fetch(execution.userId).catch(() => null);
            if (member && member.bannable) {
              await member.ban({ reason: "Otomod: 1.0 Kişisel Bilgilerin Koruması İhlali (Sistem Banı)" });
              console.log(`[TMT AutoMod] ${member.user.tag} (ID: ${member.id}) Kişisel Bilgi paylaştığı için yasaklandı.`);
            }
          }
        }
      }
    } catch (err) {
      console.error("AutoMod execution hatası:", err);
    }
  });

  client.on("guildMemberRemove", async (member) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (member.guild.id === TMT_GUILD_ID) {
        const { logTMTMemberLeave } = require("../services/tmtLogger");
        logTMTMemberLeave(member);
      }
    } catch (err) {
      console.error("guildMemberRemove hatası:", err);
    }
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (newMember.guild.id === TMT_GUILD_ID) {
        const { logTMTMemberUpdate } = require("../services/tmtLogger");
        logTMTMemberUpdate(oldMember, newMember);
      }
    } catch (err) {
      console.error("guildMemberUpdate hatası:", err);
    }
  });

  client.on("messageDelete", async (message) => {
    try {
      if (message.partial) return;
      const { TMT_GUILD_ID } = require("../../config");
      if (message.guild && message.guild.id === TMT_GUILD_ID && !message.author?.bot) {
        const { logTMTMessageDelete } = require("../services/tmtLogger");
        logTMTMessageDelete(message);
      }
    } catch (err) {
      console.error("messageDelete hatası:", err);
    }
  });

  client.on("messageUpdate", async (oldMessage, newMessage) => {
    try {
      if (oldMessage.partial || newMessage.partial) return;
      const { TMT_GUILD_ID } = require("../../config");
      if (newMessage.guild && newMessage.guild.id === TMT_GUILD_ID && !newMessage.author?.bot && oldMessage.content !== newMessage.content) {
        const { logTMTMessageUpdate } = require("../services/tmtLogger");
        logTMTMessageUpdate(oldMessage, newMessage);
      }
    } catch (err) {
      console.error("messageUpdate hatası:", err);
    }
  });

  client.on("roleCreate", async (role) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (role.guild.id === TMT_GUILD_ID) {
        const { logTMTRoleCreate } = require("../services/tmtLogger");
        logTMTRoleCreate(role);
      }
    } catch (err) {
      console.error("roleCreate hatası:", err);
    }
  });

  client.on("roleDelete", async (role) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (role.guild.id === TMT_GUILD_ID) {
        const { logTMTRoleDelete } = require("../services/tmtLogger");
        logTMTRoleDelete(role);
      }
    } catch (err) {
      console.error("roleDelete hatası:", err);
    }
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (newRole.guild.id === TMT_GUILD_ID) {
        const { logTMTRoleUpdate } = require("../services/tmtLogger");
        logTMTRoleUpdate(oldRole, newRole);
      }
    } catch (err) {
      console.error("roleUpdate hatası:", err);
    }
  });

  client.on("emojiCreate", async (emoji) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (emoji.guild.id === TMT_GUILD_ID) {
        const { logTMTEmojiCreate } = require("../services/tmtLogger");
        logTMTEmojiCreate(emoji);
      }
    } catch (err) {
      console.error("emojiCreate hatası:", err);
    }
  });

  client.on("emojiDelete", async (emoji) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (emoji.guild.id === TMT_GUILD_ID) {
        const { logTMTEmojiDelete } = require("../services/tmtLogger");
        logTMTEmojiDelete(emoji);
      }
    } catch (err) {
      console.error("emojiDelete hatası:", err);
    }
  });

  client.on("emojiUpdate", async (oldEmoji, newEmoji) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (newEmoji.guild.id === TMT_GUILD_ID) {
        const { logTMTEmojiUpdate } = require("../services/tmtLogger");
        logTMTEmojiUpdate(oldEmoji, newEmoji);
      }
    } catch (err) {
      console.error("emojiUpdate hatası:", err);
    }
  });

  client.on("channelCreate", async (channel) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (channel.guild && channel.guild.id === TMT_GUILD_ID) {
        const { logTMTChannelCreate } = require("../services/tmtLogger");
        logTMTChannelCreate(channel);
      }
    } catch (err) {
      console.error("channelCreate hatası:", err);
    }
  });

  client.on("channelDelete", async (channel) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (channel.guild && channel.guild.id === TMT_GUILD_ID) {
        const { logTMTChannelDelete } = require("../services/tmtLogger");
        logTMTChannelDelete(channel);
      }
    } catch (err) {
      console.error("channelDelete hatası:", err);
    }
  });

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    try {
      const { TMT_GUILD_ID } = require("../../config");
      if (newChannel.guild && newChannel.guild.id === TMT_GUILD_ID) {
        const { logTMTChannelUpdate } = require("../services/tmtLogger");
        logTMTChannelUpdate(oldChannel, newChannel);
      }
    } catch (err) {
      console.error("channelUpdate hatası:", err);
    }
  });

  client.on("messageReactionAdd", async (reaction, user) => {
    try {
      if (reaction.partial) {
        try { await reaction.fetch(); } catch (_) { return; }
      }
      const { TMT_GUILD_ID } = require("../../config");
      if (reaction.message.guild && reaction.message.guild.id === TMT_GUILD_ID) {
        const { logTMTReactionAdd } = require("../services/tmtLogger");
        logTMTReactionAdd(reaction, user);
      }
    } catch (err) {
      console.error("messageReactionAdd hatası:", err);
    }
  });

  client.on("messageReactionRemove", async (reaction, user) => {
    try {
      if (reaction.partial) {
        try { await reaction.fetch(); } catch (_) { return; }
      }
      const { TMT_GUILD_ID } = require("../../config");
      if (reaction.message.guild && reaction.message.guild.id === TMT_GUILD_ID) {
        const { logTMTReactionRemove } = require("../services/tmtLogger");
        logTMTReactionRemove(reaction, user);
      }
    } catch (err) {
      console.error("messageReactionRemove hatası:", err);
    }
  });


  // ── Ses kanalı takibi (personel ses dakikası + kurbağa XP) ───────────────────
  // userId → { joinedAt: Date }
  const voiceSessions = new Map();

  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      const member = newState.member || oldState.member;
      if (!member || !member.user || member.user.bot) return;
      
      const userId = member.id;
      if (!userId) {
        console.warn('[voiceStateUpdate] No user ID found');
        return;
      }

      const { GUILD_ID: STAFF_GUILD_ID, ROLES } = require("../services/staffSystem");
      const { FROG_GUILD_ID, onVoiceJoin, onVoiceLeave, addVoiceXP } = require("../services/frogLevel");
      const staffRoleIds = Object.values(ROLES);

      const guildId = newState.guild?.id || oldState.guild?.id;

      const isStaff = guildId === STAFF_GUILD_ID &&
        staffRoleIds.some(rid =>
          rid && !['PERSONEL_ROLE_ID','GELISMIS_ROLE_ID','SEKRETER_ROLE_ID'].includes(rid)
          && member.roles.cache.has(rid)
        );

      if (!oldState.channelId && newState.channelId) {
        // Sese girdi
        const { TMT_GUILD_ID } = require("../../config");
        if (guildId === TMT_GUILD_ID) {
          const { logTMTVoiceStateUpdate } = require("../services/tmtLogger");
          logTMTVoiceStateUpdate(oldState, newState);
        }
        voiceSessions.set(userId, { joinedAt: Date.now(), guildId });
        if (guildId === FROG_GUILD_ID) onVoiceJoin(userId);
      } else if (oldState.channelId && !newState.channelId) {
        // Sesten çıktı
        const { TMT_GUILD_ID } = require("../../config");
        if (guildId === TMT_GUILD_ID) {
          const { logTMTVoiceStateUpdate } = require("../services/tmtLogger");
          logTMTVoiceStateUpdate(oldState, newState);
        }
        const session = voiceSessions.get(userId);
        voiceSessions.delete(userId);

        const minutes = session ? Math.floor((Date.now() - session.joinedAt) / 60000) : 0;

        // Personel ses takibi
        if (isStaff && minutes > 0) {
          const { addVoiceMinutes } = require("../services/staffSystem");
          await addVoiceMinutes(userId, minutes, client).catch(err => {
            console.warn(`[voiceStateUpdate] addVoiceMinutes error for ${userId}:`, err.message);
          });
        }

        // Kurbağa ses XP
        if (guildId === FROG_GUILD_ID) {
          const frogMins = onVoiceLeave(userId);
          if (frogMins > 0) {
            await addVoiceXP(userId, frogMins, client).catch(err => {
              console.warn(`[voiceStateUpdate] addVoiceXP error for ${userId}:`, err.message);
            });
          }
        }
      } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // Kanal değiştirdi
        const { TMT_GUILD_ID } = require("../../config");
        if (guildId === TMT_GUILD_ID) {
          const { logTMTVoiceStateUpdate } = require("../services/tmtLogger");
          logTMTVoiceStateUpdate(oldState, newState);
        }
      }
    } catch (err) {
      console.error('[voiceStateUpdate] Fatal error:', err.message);
    }
  });

  client.on("messageCreate", async (message) => {
    // Partial mesajları fetch et (DM için zorunlu)
    if (message.partial) {
      try { await message.fetch(); } catch (_) { return; }
    }

    // ── DM mesajları ────────────────────────────────────────────────────────
    if (!message.guild && !message.author?.bot) {
      console.log(`[DM] ${message.author?.tag}: ${message.content?.slice(0, 50)}`);
      // Anket cevabı mı?
      try {
        const { handleSurveyReply } = require('../services/surveyAI');
        const handled = await handleSurveyReply(message, client);
        if (handled) return;
      } catch (_) {}
      // Moderatör mülakat cevabı mı?
      try {
        const { handleInterviewReply } = require('../services/modInterview');
        const handled = await handleInterviewReply(message, client);
        if (handled) return;
      } catch (_) {}
      // Koç sohbeti cevabı mı?
      try {
        const { handleCoachReply } = require('../services/staffCoach');
        const handled = await handleCoachReply(message, client);
        if (handled) return;
      } catch (_) {}
      // AI konus sohbeti cevabı mı?
      try {
        const { handleKonusReply } = require('../services/aiTalkService');
        const handled = await handleKonusReply(message, client);
        if (handled) return;
      } catch (_) {}
      // Normal DM ticket
      try {
        const { handleDMMessage } = require('../services/dmTicket');
        await handleDMMessage(message, client);
      } catch (err) {
        console.error('[messageCreate] DM handler hata:', err.message);
        await message.author?.send('Bir hata oluştu. Lütfen daha sonra tekrar deneyin.').catch(() => {});
      }
      return;
    }

    if (message.author.bot || !message.guild) return;

    // ── TMT Oyunlar ve Honeypot ─────────────────────────────────────────────
    try {
      const { handleTMTGames } = require('../services/tmtGames');
      const handled = await handleTMTGames(message, client);
      if (handled) return;
    } catch (_) {}

    // ── Abone fotoğraf doğrulama (Eko Yıldız) ──────────────────────────────
    try {
      const { handlePhotoUpload } = require('../services/photoVerification');
      const handled = await handlePhotoUpload(message, client);
      if (handled) return;
    } catch (_) {}

    // ── Kurbağa XP (EkoYıldız'da mesaj yazınca) ───────────────────────────
    try {
      const { FROG_GUILD_ID, addMessageXP } = require("../services/frogLevel");
      if (message.guild.id === FROG_GUILD_ID) {
        await addMessageXP(message.member, client).catch(() => {});
      }
    } catch (_) {}

    // ── AI Kanal Sohbet İzleme (moderatör etkileşimi) ─────────────────────
    try {
      const { handleAIChatMessage } = require('../services/aiChannelChat');
      await handleAIChatMessage(message, client);
    } catch (_) {}

    // ── Personel selam takibi ──────────────────────────────────────────────
    try {
      const { GUILD_ID, ROLES } = require("../services/staffSystem");
      if (message.guild.id === GUILD_ID) {
        const staffRoleIds = Object.values(ROLES).filter(id =>
          id && !['PERSONEL_ROLE_ID','GELISMIS_ROLE_ID','SEKRETER_ROLE_ID'].includes(id)
        );
        const isStaff = staffRoleIds.some(rid => message.member?.roles.cache.has(rid));
        if (isStaff) {
          const greetWords = ['selam', 'merhaba', 'günaydın', 'iyi günler', 'hey', 'heyy', 'hello', 'hi'];
          const lower = message.content.toLowerCase();
          const isGreet = greetWords.some(w => lower.startsWith(w) || lower.includes(w));
          if (isGreet) {
            const { recordGreet } = require("../services/staffSystem");
            await recordGreet(message.author.id, client).catch(() => {});
          }
        }
      }
    } catch (_) {}

    // ── dm- kanalından yetkili mesajını kullanıcıya ilet ────────────────────
    if (message.channel.name?.startsWith('dm-') && !message.author.bot) {
      try {
        const { forwardChannelToDM } = require('../services/dmTicket');
        const forwarded = await forwardChannelToDM(message, client);
        if (forwarded) return;
      } catch (err) {
        console.warn('[messageCreate] forwardChannelToDM hata:', err.message);
      }
    }

    // ── Ticket AI devre dışı ────────────────────────────────────────────────
    // (Ticket kanallarında AI konuşması kaldırıldı)

    // ── Ticket inaktivite uyarısını iptal et (kullanıcı yazdı) ───────────────
    try {
      if (message.channel.name?.startsWith('ticket-')) {
        const Ticket = require('../../models/Ticket');
        const { cancelInactivityWarning } = require('../services/ticketCleanup');
        const ticket = await Ticket.findOne({ channelId: message.channel.id, status: 'open' });
        if (ticket && message.author.id === ticket.userId) {
          cancelInactivityWarning(ticket.ticketId);
        }
      }
    } catch (_) {}
    if (message.content === "!tumrollerveidleriveisimleri") {
      const roles = message.guild.roles.cache
        .filter(r => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position);
      let replyText = "**Sunucudaki Roller (everyone hariç):**\n\n";
      roles.forEach((role) => {
        replyText += `**İsim:** ${role.name} | **ID:** \`${role.id}\`\n`;
      });
      if (replyText.length > 2000) {
        const chunks = replyText.match(/[\s\S]{1,1999}/g) || [];
        for (const chunk of chunks) await message.reply(chunk);
      } else {
        await message.reply(replyText);
      }
    }

    if (message.content === "!tumkanallar" || message.content === "!tümkanallar") {
      const { PermissionFlagsBits } = require('discord.js');
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("❌ Bu komutu kullanmak için `Kanalları Yönet` veya `Yönetici` yetkisine sahip olmalısınız.");
      }

      const channels = message.guild.channels.cache
        .sort((a, b) => a.position - b.position);

      let replyText = "**Sunucudaki Kanallar (İsim = ID):**\n\n";
      channels.forEach((channel) => {
        replyText += `${channel.name} = ${channel.id}\n`;
      });

      if (replyText.length > 2000) {
        const chunks = replyText.match(/[\s\S]{1,1999}/g) || [];
        for (const chunk of chunks) await message.reply(chunk);
      } else {
        await message.reply(replyText);
      }
    }

    if (message.content.startsWith("!tumkanallaraciklama") || message.content.startsWith("!tümkanallaraciklama")) {
      const { PermissionFlagsBits } = require('discord.js');
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("❌ Bu komutu kullanmak için `Kanalları Yönet` veya `Yönetici` yetkisine sahip olmalısınız.");
      }

      const lines = message.content.split("\n");
      const pairs = [];
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (i === 0) {
          if (line.startsWith("!tumkanallaraciklama")) {
            line = line.slice("!tumkanallaraciklama".length).trim();
          } else if (line.startsWith("!tümkanallaraciklama")) {
            line = line.slice("!tümkanallaraciklama".length).trim();
          }
        }
        
        if (!line) continue;
        
        const parts = line.split("-----");
        if (parts.length >= 2) {
          const channelId = parts[0].trim();
          const description = parts.slice(1).join("-----").trim();
          if (channelId) {
            pairs.push({ channelId, description });
          }
        }
      }

      if (pairs.length === 0) {
        return message.reply("❌ Lütfen güncellenecek kanalları şu formatta belirtin:\n`!tümkanallaraciklama`\n`kanal_id ----- yeni_açıklama`\n`kanal_id_2 ----- yeni_açıklama_2`");
      }

      const statusMsg = await message.reply(`🔄 ${pairs.length} kanalın açıklaması güncelleniyor, lütfen bekleyin...`);
      
      const success = [];
      const failed = [];

      for (const pair of pairs) {
        const { channelId, description } = pair;
        try {
          let channel = message.guild.channels.cache.get(channelId);
          if (!channel) {
            channel = await message.guild.channels.fetch(channelId).catch(() => null);
          }

          if (!channel) {
            failed.push({ channelId, reason: "Kanal bulunamadı." });
            continue;
          }

          if (typeof channel.setTopic !== 'function') {
            failed.push({ channel: channel.name, channelId, reason: "Bu kanal türü açıklama/topic desteklemiyor." });
            continue;
          }

          await channel.setTopic(description, `Yetkili: ${message.author.tag} tarafından güncellendi.`);
          success.push({ name: channel.name, id: channel.id });
        } catch (err) {
          console.error(`Kanal ${channelId} açıklaması güncellenirken hata:`, err);
          failed.push({ channelId, reason: err.message || "Bilinmeyen hata." });
        }
      }

      let resultText = `**Açıklama Güncelleme Sonucu:**\n\n`;
      if (success.length > 0) {
        resultText += `✅ **Başarıyla Güncellenenler:**\n`;
        success.forEach(s => {
          resultText += `- #${s.name} (${s.id})\n`;
        });
        resultText += `\n`;
      }
      if (failed.length > 0) {
        resultText += `❌ **Başarısız Olanlar:**\n`;
        failed.forEach(f => {
          const nameStr = f.channel ? `#${f.channel} ` : "";
          resultText += `- ${nameStr}(${f.channelId}): ${f.reason}\n`;
        });
      }

      if (resultText.length > 2000) {
        const chunks = resultText.match(/[\s\S]{1,1999}/g) || [];
        await statusMsg.edit(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await message.reply(chunks[i]);
        }
      } else {
        await statusMsg.edit(resultText);
      }
    }

    if (message.content === "!emojiguncelle" || message.content === "!emojigüncelle") {
      const { PermissionFlagsBits } = require('discord.js');
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("❌ Bu komutu kullanmak için `Yönetici` yetkisine sahip olmalısınız.");
      }

      let guild = message.client.guilds.cache.get("1514569307886063666");
      if (!guild) {
        guild = await message.client.guilds.fetch("1514569307886063666").catch(() => null);
      }

      if (!guild) {
        return message.reply("❌ Hedef sunucu (1514569307886063666) bulunamadı veya bot bu sunucuda değil.");
      }

      const statusMsg = await message.reply("🔄 Emojiler kontrol ediliyor ve güncelleniyor, lütfen bekleyin...");

      const updated = [];
      const failed = [];
      let skippedCount = 0;

      try {
        const emojis = await guild.emojis.fetch();

        for (const emoji of emojis.values()) {
          const oldName = emoji.name;
          if (!oldName) continue;

          let newName = null;

          if (oldName.startsWith("TA")) {
            newName = oldName.replace(/^TA/, "TMT");
          } else if (!oldName.startsWith("TMT")) {
            newName = "TMT_" + oldName;
          }

          if (newName && newName !== oldName) {
            try {
              await emoji.setName(newName);
              updated.push({ oldName, newName });
            } catch (err) {
              console.error(`Emoji ${oldName} güncellenirken hata:`, err);
              failed.push({ name: oldName, error: err.message || "Bilinmeyen hata" });
            }
          } else {
            skippedCount++;
          }
        }

        let replyText = `**Emoji Güncelleme Sonucu (Sunucu: ${guild.name}):**\n\n`;
        replyText += `✅ **Güncellenen Emojiler (${updated.length}):**\n`;
        if (updated.length > 0) {
          updated.forEach(item => {
            replyText += `- \`${item.oldName}\` ➡️ \`${item.newName}\`\n`;
          });
        } else {
          replyText += `Hiçbir emoji güncellenmedi.\n`;
        }

        replyText += `\n⏭️ **Değişiklik Yapılmayanlar (Zaten TMT ile başlayanlar vb.):** ${skippedCount} adet\n`;

        if (failed.length > 0) {
          replyText += `\n❌ **Başarısız Olanlar (${failed.length}):**\n`;
          failed.forEach(item => {
            replyText += `- \`${item.name}\`: ${item.error}\n`;
          });
        }

        if (replyText.length > 2000) {
          const chunks = replyText.match(/[\s\S]{1,1999}/g) || [];
          await statusMsg.edit(chunks[0]);
          for (let i = 1; i < chunks.length; i++) {
            await message.reply(chunks[i]);
          }
        } else {
          await statusMsg.edit(replyText);
        }

      } catch (err) {
        console.error("Emoji listesi çekilirken hata:", err);
        await statusMsg.edit(`❌ Emojiler güncellenirken genel bir hata oluştu: ${err.message}`);
      }
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      // ── Anket Evet/Hayır butonu ───────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('survey_yes_') || interaction.customId?.startsWith('survey_no_'))) {
        const { handleSurveyButton } = require('../services/surveyAI');
        await handleSurveyButton(interaction, client);
        return;
      }
      // ── Moderatör mülakat Evet/Hayır butonu ───────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('mod_interview_yes_') || interaction.customId?.startsWith('mod_interview_no_'))) {
        const { handleInterviewButton } = require('../services/modInterview');
        await handleInterviewButton(interaction, client);
        return;
      }
      // ── Koç butonları ────────────────────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('coach_')) {
        const { handleCoachButton } = require('../services/staffCoach');
        await handleCoachButton(interaction, client);
        return;
      }
      // ── DM Ticket kapat butonu ─────────────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('dm_close_')) {
        const { handleDMCloseButton } = require('../services/dmTicket');
        await handleDMCloseButton(interaction, client);
        return;
      }
      // ── DM Ticket Evet/Hayır butonu ────────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('dm_confirm_')) {
        const { handleDMConfirmButton } = require('../services/dmTicket');
        await handleDMConfirmButton(interaction, client);
        return;
      }
      // ── Anket Evet/Hayır butonu ────────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('survey_yes_') || interaction.customId?.startsWith('survey_no_'))) {
        const { handleSurveyButton } = require('../services/surveyAI');
        await handleSurveyButton(interaction, client);
        return;
      }
      // ── Ban onayla/reddet butonu ───────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('ban_approve_') || interaction.customId?.startsWith('ban_reject_'))) {
        const { handleBanButton } = require('../services/ticketAI');
        await handleBanButton(interaction, client);
        return;
      }
      // ── Warn/Mute butonu ──────────────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('warn_approve_') || interaction.customId?.startsWith('warn_ban_') || interaction.customId?.startsWith('warn_reject_'))) {
        const { handleWarnButton } = require('../services/ticketAI');
        await handleWarnButton(interaction, client);
        return;
      }
      // ── Reklam link butonu ────────────────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('ad_link_')) {
        const { handleAdLinkButton } = require('../services/ticketAI');
        await handleAdLinkButton(interaction, client);
        return;
      }
      // ── Reklam link modal submit ──────────────────────────────────────────
      if (interaction.isModalSubmit() && interaction.customId?.startsWith('ad_link_modal_')) {
        const { handleAdLinkModal } = require('../services/ticketAI');
        await handleAdLinkModal(interaction, client);
        return;
      }
      // ── Discord Sunucu Abuse Butonları ──────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith("disc_abuse_")) {
        const { handleDiscordAbuseButton } = require("./discordAbuseButtonHandler");
        await handleDiscordAbuseButton(interaction);
        return;
      }
      // ── Gece Otomatik Ban Geri Al Butonu ────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith("night_unban_")) {
        const { handleNightUnbanButton } = require("../services/discordAbuseDetector");
        await handleNightUnbanButton(interaction);
        return;
      }
      // ── Roblox Abuse Butonları ────────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith("rbx_abuse_demote_") || interaction.customId?.startsWith("rbx_abuse_ignore_"))) {
        const { handleAbuseButton } = require("./robloxInteractionHandler");
        await handleAbuseButton(interaction);
        return;
      }
      // ── Ban İtiraz Butonu (DM'den tıklanan) ────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('ban_appeal_')) {
        const { handleAppealButton } = require('../services/banAppeal');
        await handleAppealButton(interaction);
        return;
      }
      // ── Ban İtiraz Karar Butonları (Onayla/Reddet) ─────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('appeal_accept_') || interaction.customId?.startsWith('appeal_reject_'))) {
        const { handleAppealDecisionButton } = require('../services/banAppeal');
        await handleAppealDecisionButton(interaction, client);
        return;
      }
      // ── Ban İtiraz Modal Submit ─────────────────────────────────────────────
      if (interaction.isModalSubmit() && interaction.customId?.startsWith('ban_appeal_modal_')) {
        const { handleAppealModalSubmit } = require('../services/banAppeal');
        await handleAppealModalSubmit(interaction, client);
        return;
      }
      // ── Mod İşlem Onay/Red Butonları ────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith("modact_approve_") || interaction.customId?.startsWith("modact_reject_"))) {
        const { handleModActionApproval } = require("../services/modActionService");
        await handleModActionApproval(interaction);
        return;
      }
      // ── Roblox Etkileşimleri ──────────────────────────────────────────────
      if (
        (interaction.isStringSelectMenu() && (interaction.customId === "roblox_group_select" || interaction.customId.startsWith("roblox_rank_select"))) ||
        (interaction.isButton() && interaction.customId?.startsWith("rbx_btn_")) ||
        (interaction.isModalSubmit() && interaction.customId?.startsWith("rbx_mod_"))
      ) {
        const { handleRobloxInteractions } = require("./robloxInteractionHandler");
        await handleRobloxInteractions(interaction);
        return;
      }
      await handleInteraction(interaction);
    } catch (err) {
      console.error("[interactionCreate]", err);
      const { Ephemeral } = require("../utils/interaction");
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: "❌ Bir hata oluştu." }).catch(() => null);
        } else {
          await interaction
            .reply({ content: "❌ Bir hata oluştu.", flags: Ephemeral })
            .catch(() => null);
        }
      }
    }
  });
}

async function handleInteraction(interaction) {
    if (interaction.isButton()) {
      const { handleVoiceButton } = require("./voiceButtonHandler");
      const voiceResult = await handleVoiceButton(interaction);
      if (voiceResult !== null) return voiceResult;
      return handleButtonInteraction(interaction);
    }

    if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isRoleSelectMenu()) {
      const { handleVoiceSelect } = require("./voiceButtonHandler");
      const voiceSel = await handleVoiceSelect(interaction);
      if (voiceSel !== null) return voiceSel;
      return handleSelectInteraction(interaction);
    }

    if (interaction.isModalSubmit()) {
      const { handleVoiceModal } = require("./voiceButtonHandler");
      const voiceModal = await handleVoiceModal(interaction);
      if (voiceModal !== null) return voiceModal;
      return handleModalSubmit(interaction);
    }

    if (interaction.isChatInputCommand()) {
      let result = await handleGeneralCommand(interaction);
      if (result !== null) return result;

      result = await handleEconomyCommand(interaction);
      if (result !== null) return result;

      result = await handleFunCommand(interaction);
      if (result !== null) return result;

      result = await handleModerationCommand(interaction);
      if (result !== null) return result;

      return null;
    }

    return null;
}

module.exports = { initializeDiscordHandlers };
