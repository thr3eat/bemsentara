const { handleButtonInteraction } = require("./buttonHandler");
const { handleSelectInteraction } = require("./selectHandler");
const { handleModalSubmit } = require("./modalHandler");
const { handleGeneralCommand } = require("./generalCommandHandler");
const { handleEconomyCommand } = require("./economyCommandHandler");
const { handleFunCommand } = require("./funCommandHandler");
const { handleModerationCommand } = require("./moderationCommandHandler");

function initializeDiscordHandlers(client) {
  const { initializeVoiceAndBanHandlers } = require("./voiceHandler");
  initializeVoiceAndBanHandlers(client);

  client.once("ready", async () => {
    const { ensureVerifyHelpMessage } = require("../services/verifyHelpMessage");
    const { ensureVoicePanelMessage } = require("../services/voicePanelMessage");
    const { ensureTMTVerifyHelpMessage } = require("../services/tmtVerifyHelpMessage");
    const { ensureTMTSupportMessage } = require("../services/tmtSupportMessage");
    const { startCleanupScheduler } = require("../services/ticketCleanup");
    const { startStaffScheduler } = require("../services/staffSystem");
    await ensureVerifyHelpMessage(client);
    await ensureVoicePanelMessage(client);
    await ensureTMTVerifyHelpMessage(client);
    await ensureTMTSupportMessage(client);
    startCleanupScheduler();
    startStaffScheduler(client);
  });

  // ── Sunucuya katılan üyeye doğrulanmamış rolü ver ──────────────────────────
  client.on("guildMemberAdd", async (member) => {
    try {
      const { TARGET_GUILD_ID, UNVERIFIED_ROLE_ID } = require("../../config");
      const { PermissionFlagsBits } = require('discord.js');
      
      if (member.guild.id !== TARGET_GUILD_ID) return;
      if (member.user.bot) return;
      
      if (!UNVERIFIED_ROLE_ID) {
        console.warn('[guildMemberAdd] UNVERIFIED_ROLE_ID not configured');
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

      const role = member.guild.roles.cache.get(UNVERIFIED_ROLE_ID);
      if (!role) {
        console.warn(`[guildMemberAdd] Role ${UNVERIFIED_ROLE_ID} not found in guild`);
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
        voiceSessions.set(userId, { joinedAt: Date.now(), guildId });
        if (guildId === FROG_GUILD_ID) onVoiceJoin(userId);
      } else if (oldState.channelId && !newState.channelId) {
        // Sesten çıktı
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
