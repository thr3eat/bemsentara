const { handleButtonInteraction } = require("./buttonHandler");
const { handleSelectInteraction } = require("./selectHandler");
const { handleModalSubmit } = require("./modalHandler");
const { handleGeneralCommand } = require("./generalCommandHandler");
const { handleEconomyCommand } = require("./economyCommandHandler");
const { handleFunCommand } = require("./funCommandHandler");
const { handleModerationCommand } = require("./moderationCommandHandler");
const { setupCentralAuditHandler } = require("./centralAuditHandler");

// Preload services/handlers to speed up interaction responses and prevent timeouts
const { handleSurveyButton } = require('../services/surveyAI');
const { handleInterviewButton } = require('../services/modInterview');
const { handleCoachButton } = require('../services/staffCoach');
const { handleDMCloseButton, handleDMConfirmButton } = require('../services/dmTicket');
const { handleBanButton, handleWarnButton, handleAdLinkButton, handleAdLinkModal } = require('../services/ticketAI');
const { handleDiscordAbuseButton } = require("./discordAbuseButtonHandler");
const { handleNightUnbanButton } = require("../services/discordAbuseDetector");
const { handleAbuseButton, handleRobloxInteractions } = require("./robloxInteractionHandler");
const { handleAppealButton, handleAppealDecisionButton, handleAppealModalSubmit } = require('../services/banAppeal');
const { handleModActionApproval } = require("../services/modActionService");
const { handleStartTrigger, handleAnswerInteraction } = require('../services/aiExamService');
const { handleVoiceButton, handleVoiceSelect, handleVoiceModal } = require("./voiceButtonHandler");
const StaffProgress = require("../../models/StaffProgress");

const nightChatTracker = new Map();
const dailyChatTracker = new Map();
const photoTracker = new Map();
const botFriendTracker = new Map();

function initializeDiscordHandlers(client) {
  // Intercept and patch interaction replies to avoid ephemeral deprecation warnings
  try {
    const { CommandInteraction, MessageComponentInteraction, ModalSubmitInteraction, MessageFlags } = require("discord.js");
    const EphemeralFlag = MessageFlags?.Ephemeral ?? 64;

    const patchInteractionOptions = (options) => {
      if (options && typeof options === "object") {
        if (options.ephemeral !== undefined) {
          if (options.ephemeral) {
            options.flags = (options.flags || 0) | EphemeralFlag;
          }
          delete options.ephemeral;
        }
      }
      return options;
    };

    const classesToPatch = [CommandInteraction, MessageComponentInteraction, ModalSubmitInteraction];
    for (const cls of classesToPatch) {
      if (cls && cls.prototype) {
        const origReply = cls.prototype.reply;
        if (origReply) {
          cls.prototype.reply = function (options) {
            if (typeof options === "string") {
              options = { content: options };
            }
            patchInteractionOptions(options);
            return origReply.call(this, options);
          };
        }

        const origDeferReply = cls.prototype.deferReply;
        if (origDeferReply) {
          cls.prototype.deferReply = function (options) {
            patchInteractionOptions(options);
            return origDeferReply.call(this, options);
          };
        }

        const origFollowUp = cls.prototype.followUp;
        if (origFollowUp) {
          cls.prototype.followUp = function (options) {
            if (typeof options === "string") {
              options = { content: options };
            }
            patchInteractionOptions(options);
            return origFollowUp.call(this, options);
          };
        }
      }
    }
  } catch (err) {
    console.error("[deprecationPatch] Failed to apply interaction reply patches:", err.message);
  }

  const { initializeVoiceAndBanHandlers } = require("./voiceHandler");
  initializeVoiceAndBanHandlers(client);

  // Merkezi Denetim Günlüğü Handler'ını başlat
  setupCentralAuditHandler(client);

  client.once("ready", async () => {
    const { ensureVerifyHelpMessage } = require("../services/verifyHelpMessage");
    const { ensureVoicePanelMessage } = require("../services/voicePanelMessage");
    const { ensureTMTVerifyHelpMessage } = require("../services/tmtVerifyHelpMessage");
    const { ensureTMTSupportMessage } = require("../services/tmtSupportMessage");
    const { ensureEkoSupportMessage } = require("../services/ekoSupportMessage");
    const { ensureTMTRules } = require("../services/ensureTMTRules");
    const { startCleanupScheduler } = require("../services/ticketCleanup");
    const { startStaffScheduler } = require("../services/staffSystem");
    const { RULE_PREFIX } = require("../services/tmtAutomodService");
    const { startAtaturkHistoryScheduler } = require("../services/ataturkHistoryAI");
    const { startEkoYildizHistoryScheduler } = require("../services/ekoYildizHistoryAI");
    const { initializeRoblox, ensureRobloxManagementMenu, ensureEkoYildizRobloxMenu, ensureAlliedRobloxMenu, ensureBemRobloxMenu } = require("../services/robloxGroupManager");
    const { startAuditLogPoller } = require("../services/robloxAuditLogPoller");
    const { initTMTInvites, ensureTMTLogEmbed } = require("../services/tmtLogger");
    const { ensureAlliedVerifyHelpMessage, ensureAlliedSupportMessage } = require("../services/alliedRoleSyncService");
    const { ensureAdminPanels } = require("../services/panelManager");
    const { startJailScheduler } = require("../services/jailService");

    startJailScheduler(client);

    await ensureVerifyHelpMessage(client);
    await ensureVoicePanelMessage(client);
    await ensureTMTVerifyHelpMessage(client);
    await ensureTMTSupportMessage(client);
    await ensureEkoSupportMessage(client);
    await ensureTMTRules(client);
    await ensureAdminPanels(client);
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
    startEkoYildizHistoryScheduler(client);

    // Birim Rol Doğrulama (Bot restart'ta bir kere çalış)
    try {
      const { verifyAllUnitRoles } = require("../services/unitStartupVerifier");
      await verifyAllUnitRoles(client);
    } catch (err) {
      console.error("[unitStartupVerifier] Rol doğrulama hatası:", err.message);
    }

    // Birim Aylık Terfi Döngüsü Planlayıcısı
    try {
      const { startMonthlyPromotionScheduler } = require("../services/unitMonthlyPromotionService");
      startMonthlyPromotionScheduler(client);
    } catch (err) {
      console.error("[monthlyPromotion] Planlayıcı başlatma hatası:", err.message);
    }

    // Ban Birimi Rütbe Sistemi Başlatma
    try {
      const { ensureBanBirimRoles } = require("../services/banBirimRankManager");
      const GUILD_ID = '1466927911364726845';
      const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
      if (guild) {
        // Sezon 1 rollerini oluştur
        await ensureBanBirimRoles(guild, 1);
        // Sezon 2 rollerini de oluştur (hazır olması için)
        await ensureBanBirimRoles(guild, 2);
        console.log('[banBirimRanks] ✅ Ban Birimi rütbe sistem rolleri başlatıldı');
      }
    } catch (err) {
      console.error("[banBirimRanks] Başlatma hatası:", err.message);
    }

    // Koçlara Hoşgeldin Mesajı (Bot Başlatıldığında)
    try {
      const { sendCoachWelcomeOnStartup } = require("../services/coachWelcomeService");
      sendCoachWelcomeOnStartup(client).then(result => {
        if (result.success) {
          console.log(`[coachWelcome] ✅ ${result.sentCount} koça hoşgeldin mesajı gönderildi`);
        }
      }).catch(err => {
        console.error("[coachWelcome] Hata:", err.message);
      });
    } catch (err) {
      console.error("[coachWelcome] Başlatma hatası:", err.message);
    }

    // Telegram AI Chat dinleyicisini başlat
    try {
      const { startTelegramPolling } = require("../services/telegramService");
      startTelegramPolling(client);
    } catch (err) {
      console.error("[Telegram] Başlatılamadı:", err.message);
    }

    // EkoYıldız Otomatik Rol Kurtarma (Bot Yeniden Başlatılınca)
    const { RESTORE_ROLES_ON_START } = require('../../config');
    if (RESTORE_ROLES_ON_START) {
      const { autoRestoreRoles } = require('../services/ekoRoleRestore');
      autoRestoreRoles(client).catch(err => {
        console.error('[ekoRoleRestore] Hata:', err);
      });
    }

    // EkoYıldız Gelişmiş Loglama Sistemini Başlat (Kanalları Otomatik Oluşturur)
    const { initializeEkoLogger } = require('../services/ekoLogger');
    await initializeEkoLogger(client).catch(err => {
      console.error('[ekoLogger] Başlatma Hatası:', err);
    });

    // AI Kanal Sohbet İzleme
    const { startAIChatMonitor } = require('../services/aiChannelChat');
    startAIChatMonitor(client);

    // Karaliste Sistemini Başlat (Dinamik Mesajları Oluşturur/Günceller)
    try {
      const { initializeBlacklist, checkBlacklistCleanup } = require('../services/blacklistService');
      await initializeBlacklist(client);
      await checkBlacklistCleanup(client);

      // Karaliste temizleme interval'i (24 saatte bir)
      setInterval(async () => {
        try {
          await checkBlacklistCleanup(client);
        } catch (err) {
          console.error('[blacklist] Günlük temizleme hatası:', err.message);
        }
      }, 24 * 60 * 60 * 1000);
    } catch (err) {
      console.error('[blacklist] Başlatma Hatası:', err);
    }

    // İlk defaya mahsus personele yeni gamification sistemi tanıtım mesajı at
    const { sendSystemUpdateNotification } = require('../services/staffSystem');
    sendSystemUpdateNotification(client);

    // XP Çekiliş Scheduler
    setInterval(async () => {
      try {
        const Giveaway = require('../../models/Giveaway');
        const StaffProgress = require('../../models/StaffProgress');
        const activeGiveaways = await Giveaway.find({ isActive: true, endsAt: { $lte: new Date() } });

        for (const giveaway of activeGiveaways) {
          giveaway.isActive = false;

          if (giveaway.participants.length > 0) {
            // Rastgele kazanan seç
            const winnerId = giveaway.participants[Math.floor(Math.random() * giveaway.participants.length)];
            giveaway.winners.push(winnerId);

            // Ödülü ver
            const p = await StaffProgress.findOne({ userId: winnerId });
            if (p) {
              p.gamification = p.gamification || {};
              p.gamification.currentXP = (p.gamification.currentXP || 0) + giveaway.xpAmount;
              p.gamification.totalPoints = (p.gamification.totalPoints || 0) + giveaway.xpAmount; // veya farklı bir oran
              await p.save();
            }

            // Kanala mesaj gönder
            const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
            if (channel) {
              channel.send(`🎉 **TEBRİKLER <@${winnerId}>!** Rütbe XP'si çekilişini kazandın ve **${giveaway.xpAmount} XP** hesabına eklendi!`);
            }
          } else {
            const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
            if (channel) {
              channel.send(`😢 Maalesef **${giveaway.xpAmount} XP** ödüllü çekilişe kimse katılmadı.`);
            }
          }
          await giveaway.save();
        }
      } catch (err) {
        console.error('[GiveawayScheduler] Hata:', err.message);
      }
    }, 60 * 1000); // Dakikada bir kontrol et

    // ── Bot Durumunu (Presence) 15 saniyede bir değiştir ──────────────────
    try {
      const { ActivityType } = require('discord.js');
      const statuses = [
        "Ben Sentara! 🤖",
        "EkoYıldız'ın 1 NUMARALI ASİSTANI! 🌟",
        "Sana yardım etmek için buradayım! 💪",
        "Sorunların benim için küçük! 🔧",
        "7/24 hizmetinizdeyim! ⏰",
        "Her sorunun bir çözümü var! 🎯",
        "Destek sisteminin kalbi ben! ❤️",
        "Hızlı, güvenilir, her zaman hazır! ⚡",
        "Sorularını bana bırak! 📩",
        "EkoYıldız ailesiyle gurur duyuyorum! 🏆",
        "Ticket aç, gerisini ben hallederim! 🎫",
        "Yapay zeka gücüyle buradayım! 🧠",
        "Sorunun ne olursa olsun yanındayım! 🛡️",
        "En iyi destek deneyimi için Sentara! ✨",
        "Beklemeden, hızlıca çözüm üretiyorum! 🚀"
      ];
      let statusIndex = 0;

      const updateBotPresence = () => {
        client.user.setPresence({
          activities: [{
            name: "custom",
            state: statuses[statusIndex],
            type: ActivityType.Custom
          }],
          status: 'online'
        });
        statusIndex = (statusIndex + 1) % statuses.length;
      };

      updateBotPresence();
      setInterval(updateBotPresence, 15000);
    } catch (err) {
      console.error("[Presence] Error setting bot presence:", err.message);
    }
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

      const { TARGET_GUILD_ID, UNVERIFIED_ROLE_ID, TMT_GUILD_ID, TMT_UNVERIFIED_ROLE_ID, GUILD2_ID } = require("../../config");
      const { PermissionFlagsBits } = require('discord.js');

      let targetRoleId = null;
      if (member.guild.id === TARGET_GUILD_ID) {
        targetRoleId = UNVERIFIED_ROLE_ID;
      } else if (member.guild.id === TMT_GUILD_ID) {
        targetRoleId = TMT_UNVERIFIED_ROLE_ID;
        const { logTMTMemberJoin } = require("../services/tmtLogger");
        logTMTMemberJoin(member);
      } else if (member.guild.id === GUILD2_ID) {
        const { logEkoMemberJoin } = require("../services/ekoLogger");
        logEkoMemberJoin(member);
        return;
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

      // ── Gizli Başarım: İsyankar (AutoMod'a Yakalananlar) ──
      if (execution.guild.id === '1367646464804655104') {
        try {
          const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
          if (mainGuild) {
            const memberToReward = await mainGuild.members.fetch(execution.userId).catch(() => null);
            if (memberToReward && !memberToReward.user.bot) {
              let rebelRole = mainGuild.roles.cache.find(r => r.name === '🤡 İsyankar');
              if (!rebelRole) {
                rebelRole = await mainGuild.roles.create({
                  name: '🤡 İsyankar',
                  color: '#e74c3c', // Kırmızı
                  hoist: false,
                  position: 1,
                  reason: 'Gizli Başarım Sistemi'
                });
              }
              if (rebelRole && !memberToReward.roles.cache.has(rebelRole.id)) {
                await memberToReward.roles.add(rebelRole.id).catch(() => { });
                memberToReward.send('🎉 **Gizli Başarım Kazanıldı: İsyankar!**\nAutoMod\'un filtrelerine takılarak asi ruhunu gösterdin ve `🤡 İsyankar` rolünü kazandın!').catch(() => { });
              }
            }
          }
        } catch (_) { }
      }
    } catch (err) {
      console.error("AutoMod execution hatası:", err);
    }
  });

  client.on("guildMemberRemove", async (member) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (member.guild.id === TMT_GUILD_ID) {
        const { logTMTMemberLeave } = require("../services/tmtLogger");
        logTMTMemberLeave(member);

        // ── GİZLİ BAŞARIM: Sadık Yıldız ──
        // Kullanıcı TMT'den (rakip/honeypot) çıktıysa/atıldıysa ve EkoYıldız ana sunucusunda varsa ona başarım ver
        try {
          const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
          if (mainGuild) {
            const memberToReward = await mainGuild.members.fetch(member.id).catch(() => null);
            if (memberToReward) {
              let loyalRole = mainGuild.roles.cache.find(r => r.name === '⭐ Sadık Yıldız');
              if (!loyalRole) {
                loyalRole = await mainGuild.roles.create({
                  name: '⭐ Sadık Yıldız',
                  color: '#f39c12', // Turuncu/Sarımtırak
                  hoist: false,
                  position: 1, // En altta olması için
                  reason: 'Gizli Başarım Sistemi'
                });
              }
              if (loyalRole && !memberToReward.roles.cache.has(loyalRole.id)) {
                await memberToReward.roles.add(loyalRole.id).catch(() => { });
                memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Sadık Yıldız!**\nRakip / Diğer sunucular yerine EkoYıldız sadakatinizi gösterdiğiniz için `⭐ Sadık Yıldız` rolünü kazandınız!').catch(() => { });
              }
            }
          }
        } catch (e) {
          console.error('[guildMemberRemove] Sadık Yıldız başarım hatası:', e.message);
        }
      } else if (member.guild.id === GUILD2_ID) {
        const { logEkoMemberLeave } = require("../services/ekoLogger");
        logEkoMemberLeave(member);
      }
    } catch (err) {
      console.error("guildMemberRemove hatası:", err);
    }
  });

  client.on("guildMemberAdd", async (member) => {
    try {
      // 1. Veritabanı Ban Kontrolü ve Otomatik Cezalandırma
      const User = require("../../models/User");
      const dbUser = await User.findOne({ discordId: member.id });
      if (dbUser && dbUser.isBanned) {
        const seviye = dbUser.banLevel || "high";
        const sebep = dbUser.banReason || "Veritabanı Ban Kaydı";

        if (seviye === "very_high" || seviye === "high") {
          await member.ban({ reason: `Otomatik Veritabanı Banı (${seviye}): ${sebep}` }).catch(() => { });
          console.log(`[AutoBan] Banned user ${member.id} (${member.user.tag}) on join.`);
          return;
        } else if (seviye === "medium") {
          const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
          const isMain = member.guild.id === TMT_GUILD_ID || member.guild.id === GUILD2_ID;
          if (isMain) {
            await member.ban({ reason: `Otomatik Veritabanı Banı (Orta): ${sebep}` }).catch(() => { });
            console.log(`[AutoBan] Banned user ${member.id} (${member.user.tag}) on join (main guild).`);
            return;
          } else {
            await member.kick(`Otomatik Veritabanı Cezası (Orta): ${sebep}`).catch(() => { });
            console.log(`[AutoBan] Kicked user ${member.id} (${member.user.tag}) on join.`);
            return;
          }
        } else if (seviye === "low") {
          await member.kick(`Otomatik Veritabanı Cezası (Düşük): ${sebep}`).catch(() => { });
          console.log(`[AutoBan] Kicked user ${member.id} (${member.user.tag}) on join.`);
          return;
        } else if (seviye === "very_low") {
          const editableRoles = member.roles.cache.filter(role =>
            role.id !== member.guild.id && !role.managed && role.editable
          );
          if (editableRoles.size > 0) {
            await member.roles.remove(Array.from(editableRoles.keys())).catch(() => { });
          }
          const namesToSearch = ["üye", "member", "personel", "onaylı", "onaylanmış hesap", "kullanıcı"];
          let basicRole = null;
          for (const name of namesToSearch) {
            const role = member.guild.roles.cache.find(r => r.name.toLowerCase() === name && !r.managed);
            if (role) {
              basicRole = role;
              break;
            }
          }
          if (basicRole) {
            await member.roles.add(basicRole, `Otomatik Veritabanı Cezası (Çok Düşük): ${sebep}`).catch(() => { });
          }
          console.log(`[AutoBan] Reset roles for user ${member.id} on join.`);
          return;
        }
      }

      // 2. Normal Giriş İşlemleri
      const { GUILD2_ID } = require("../../config");
      if (member.guild.id === GUILD2_ID) {
        // Sunucuya yeni giren herkese Yavru Dinazor rolünü ver (Zorunlu ilk rol)
        const level0Role = '1518692402884378825';
        if (!member.roles.cache.has(level0Role)) {
          await member.roles.add(level0Role, "Zorunlu Yavru Dinazor İlk Rolü").catch(err => {
            console.error("[guildMemberAdd] Yavru Dinazor rolü verilirken hata:", err.message);
          });
        }

        // Sunucu Etiketi (Clan Tag) Kontrolü
        const { checkAndRewardTag } = require("../services/clanTagService");
        await checkAndRewardTag(member).catch(err => {
          console.error("[guildMemberAdd] checkAndRewardTag error:", err.message);
        });
      }
    } catch (err) {
      console.error("guildMemberAdd hatası:", err);
    }
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (newMember.guild.id === TMT_GUILD_ID) {
        const { logTMTMemberUpdate } = require("../services/tmtLogger");
        logTMTMemberUpdate(oldMember, newMember);
      } else if (newMember.guild.id === GUILD2_ID) {
        const { logEkoMemberUpdate } = require("../services/ekoLogger");
        logEkoMemberUpdate(oldMember, newMember);

        // Sunucu Etiketi (Clan Tag) Kontrolü
        const { checkAndRewardTag } = require("../services/clanTagService");
        await checkAndRewardTag(newMember).catch(err => {
          console.error("[guildMemberUpdate] checkAndRewardTag error:", err.message);
        });

        // Boost detection to reward server boosters
        const startedBoosting = !oldMember.premiumSince && newMember.premiumSince;
        if (startedBoosting) {
          const { handleBoosterReward } = require("../services/frogLevel");
          await handleBoosterReward(newMember).catch(err => {
            console.error("[guildMemberUpdate] handleBoosterReward error:", err.message);
          });
        }

        // Roles changed detection to enforce level/family rules
        const rolesChanged = !oldMember.roles.cache.equals(newMember.roles.cache);
        if (rolesChanged) {
          const { enforceFrogRoles } = require("../services/frogLevel");
          await enforceFrogRoles(newMember).catch(err => {
            console.error("[guildMemberUpdate] enforceFrogRoles error:", err.message);
          });
          const { enforceRoleDividers } = require("../services/dividerService");
          await enforceRoleDividers(newMember).catch(err => {
            console.error("[guildMemberUpdate] enforceRoleDividers error:", err.message);
          });
        }
      }
    } catch (err) {
      console.error("guildMemberUpdate hatası:", err);
    }
  });

  client.on("userUpdate", async (oldUser, newUser) => {
    try {
      const { GUILD2_ID } = require("../../config");
      const guild = client.guilds.cache.get(GUILD2_ID) || await client.guilds.fetch(GUILD2_ID).catch(() => null);
      if (guild) {
        const member = guild.members.cache.get(newUser.id) || await guild.members.fetch(newUser.id).catch(() => null);
        if (member) {
          const { checkAndRewardTag } = require("../services/clanTagService");
          await checkAndRewardTag(member).catch(err => {
            console.error("[userUpdate] checkAndRewardTag error:", err.message);
          });
        }
      }
    } catch (err) {
      console.error("userUpdate hatası:", err);
    }
  });

  client.on("messageDelete", async (message) => {
    try {
      if (message.partial) return;
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (message.guild && message.guild.id === TMT_GUILD_ID && !message.author?.bot) {
        const { logTMTMessageDelete } = require("../services/tmtLogger");
        logTMTMessageDelete(message);
      } else if (message.guild && message.guild.id === GUILD2_ID && !message.author?.bot) {
        const { logEkoMessageDelete } = require("../services/ekoLogger");
        logEkoMessageDelete(message);
      }
    } catch (err) {
      console.error("messageDelete hatası:", err);
    }
  });

  const editorTracker = new Map();

  client.on("messageUpdate", async (oldMessage, newMessage) => {
    try {
      if (oldMessage.partial || newMessage.partial) return;
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (newMessage.guild && newMessage.guild.id === TMT_GUILD_ID && !newMessage.author?.bot && oldMessage.content !== newMessage.content) {
        const { logTMTMessageUpdate } = require("../services/tmtLogger");
        logTMTMessageUpdate(oldMessage, newMessage);
      } else if (newMessage.guild && newMessage.guild.id === GUILD2_ID && !newMessage.author?.bot && oldMessage.content !== newMessage.content) {
        const { logEkoMessageUpdate } = require("../services/ekoLogger");
        logEkoMessageUpdate(oldMessage, newMessage);
      }

      // ── Gizli Başarım: Kararsız (Mesaj Düzenleme) ──
      if (newMessage.guild && newMessage.guild.id === '1367646464804655104' && !newMessage.author?.bot && oldMessage.content !== newMessage.content) {
        const uId = newMessage.author.id;
        const { incrementTracker } = require('../services/achievementManager');
        let edits = await incrementTracker(uId, 'editorEdits');

        if (edits === 15) {
          try {
            const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
            if (mainGuild) {
              const memberToReward = await mainGuild.members.fetch(uId).catch(() => null);
              if (memberToReward) {
                let editorRole = mainGuild.roles.cache.find(r => r.name === '💌 Kararsız');
                if (!editorRole) {
                  editorRole = await mainGuild.roles.create({
                    name: '💌 Kararsız',
                    color: '#e67e22', // Turuncu
                    hoist: false,
                    position: 1,
                    reason: 'Gizli Başarım Sistemi'
                  });
                }
                if (editorRole && !memberToReward.roles.cache.has(editorRole.id)) {
                  await memberToReward.roles.add(editorRole.id).catch(() => { });
                  newMessage.author.send('🎉 **Gizli Başarım Kazanıldı: Kararsız!**\nBugün 15 kez mesaj düzenleyerek ne kadar kararsız olduğunu kanıtladın ve `💌 Kararsız` rolünü kazandın!').catch(() => { });
                }
              }
            }
          } catch (_) { }
        }
      }
    } catch (err) {
      console.error("messageUpdate hatası:", err);
    }
  });

  client.on("roleCreate", async (role) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (role.guild.id === TMT_GUILD_ID) {
        const { logTMTRoleCreate } = require("../services/tmtLogger");
        logTMTRoleCreate(role);
      } else if (role.guild.id === GUILD2_ID) {
        const { logEkoRoleCreate } = require("../services/ekoLogger");
        logEkoRoleCreate(role);
      }
    } catch (err) {
      console.error("roleCreate hatası:", err);
    }
  });

  client.on("roleDelete", async (role) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (role.guild.id === TMT_GUILD_ID) {
        const { logTMTRoleDelete } = require("../services/tmtLogger");
        logTMTRoleDelete(role);
      } else if (role.guild.id === GUILD2_ID) {
        const { logEkoRoleDelete } = require("../services/ekoLogger");
        logEkoRoleDelete(role);
      }
    } catch (err) {
      console.error("roleDelete hatası:", err);
    }
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (newRole.guild.id === TMT_GUILD_ID) {
        const { logTMTRoleUpdate } = require("../services/tmtLogger");
        logTMTRoleUpdate(oldRole, newRole);
      } else if (newRole.guild.id === GUILD2_ID) {
        const { logEkoRoleUpdate } = require("../services/ekoLogger");
        logEkoRoleUpdate(oldRole, newRole);
      }
    } catch (err) {
      console.error("roleUpdate hatası:", err);
    }
  });

  client.on("emojiCreate", async (emoji) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (emoji.guild.id === TMT_GUILD_ID) {
        const { logTMTEmojiCreate } = require("../services/tmtLogger");
        logTMTEmojiCreate(emoji);
      } else if (emoji.guild.id === GUILD2_ID) {
        const { logEkoEmojiCreate } = require("../services/ekoLogger");
        logEkoEmojiCreate(emoji);
      }
    } catch (err) {
      console.error("emojiCreate hatası:", err);
    }
  });

  client.on("emojiDelete", async (emoji) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (emoji.guild.id === TMT_GUILD_ID) {
        const { logTMTEmojiDelete } = require("../services/tmtLogger");
        logTMTEmojiDelete(emoji);
      } else if (emoji.guild.id === GUILD2_ID) {
        const { logEkoEmojiDelete } = require("../services/ekoLogger");
        logEkoEmojiDelete(emoji);
      }
    } catch (err) {
      console.error("emojiDelete hatası:", err);
    }
  });

  client.on("emojiUpdate", async (oldEmoji, newEmoji) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (newEmoji.guild.id === TMT_GUILD_ID) {
        const { logTMTEmojiUpdate } = require("../services/tmtLogger");
        logTMTEmojiUpdate(oldEmoji, newEmoji);
      } else if (newEmoji.guild.id === GUILD2_ID) {
        const { logEkoEmojiUpdate } = require("../services/ekoLogger");
        logEkoEmojiUpdate(oldEmoji, newEmoji);
      }
    } catch (err) {
      console.error("emojiUpdate hatası:", err);
    }
  });

  client.on("channelCreate", async (channel) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (channel.guild && channel.guild.id === TMT_GUILD_ID) {
        const { logTMTChannelCreate } = require("../services/tmtLogger");
        logTMTChannelCreate(channel);
      } else if (channel.guild && channel.guild.id === GUILD2_ID) {
        const { logEkoChannelCreate } = require("../services/ekoLogger");
        logEkoChannelCreate(channel);
      }
    } catch (err) {
      console.error("channelCreate hatası:", err);
    }
  });

  client.on("channelDelete", async (channel) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (channel.guild && channel.guild.id === TMT_GUILD_ID) {
        const { logTMTChannelDelete } = require("../services/tmtLogger");
        logTMTChannelDelete(channel);
      } else if (channel.guild && channel.guild.id === GUILD2_ID) {
        const { logEkoChannelDelete } = require("../services/ekoLogger");
        logEkoChannelDelete(channel);
      }
    } catch (err) {
      console.error("channelDelete hatası:", err);
    }
  });

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    try {
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (newChannel.guild && newChannel.guild.id === TMT_GUILD_ID) {
        const { logTMTChannelUpdate } = require("../services/tmtLogger");
        logTMTChannelUpdate(oldChannel, newChannel);
      } else if (newChannel.guild && newChannel.guild.id === GUILD2_ID) {
        const { logEkoChannelUpdate } = require("../services/ekoLogger");
        logEkoChannelUpdate(oldChannel, newChannel);
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
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (reaction.message.guild && reaction.message.guild.id === TMT_GUILD_ID) {
        const { logTMTReactionAdd } = require("../services/tmtLogger");
        logTMTReactionAdd(reaction, user);
      } else if (reaction.message.guild && reaction.message.guild.id === GUILD2_ID) {
        const { logEkoReactionAdd } = require("../services/ekoLogger");
        logEkoReactionAdd(reaction, user);
      }

      // ── Gizli Başarım: Tepki Kolik ──
      if (reaction.message.guild && reaction.message.guild.id === '1367646464804655104' && !user.bot) {
        const uId = user.id;
        const { incrementTracker } = require('../services/achievementManager');
        let reactions = await incrementTracker(uId, 'reactionCount');

        if (reactions === 50) {
          try {
            const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
            if (mainGuild) {
              const memberToReward = await mainGuild.members.fetch(uId).catch(() => null);
              if (memberToReward) {
                let reactionRole = mainGuild.roles.cache.find(r => r.name === '👍 Tepki Kolik');
                if (!reactionRole) {
                  reactionRole = await mainGuild.roles.create({
                    name: '👍 Tepki Kolik',
                    color: '#f39c12', // Turuncu Sarısı
                    hoist: false,
                    position: 1,
                    reason: 'Gizli Başarım Sistemi'
                  });
                }
                if (reactionRole && !memberToReward.roles.cache.has(reactionRole.id)) {
                  await memberToReward.roles.add(reactionRole.id).catch(() => { });
                  user.send('🎉 **Gizli Başarım Kazanıldı: Tepki Kolik!**\nMesajlara tam 50 kez tepki ekleyerek sohbeti renklendirdiğin için `👍 Tepki Kolik` rolünü kazandın!').catch(() => { });
                }
              }
            }
          } catch (_) { }
        }
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
      const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
      if (reaction.message.guild && reaction.message.guild.id === TMT_GUILD_ID) {
        const { logTMTReactionRemove } = require("../services/tmtLogger");
        logTMTReactionRemove(reaction, user);
      } else if (reaction.message.guild && reaction.message.guild.id === GUILD2_ID) {
        const { logEkoReactionRemove } = require("../services/ekoLogger");
        logEkoReactionRemove(reaction, user);
      }
    } catch (err) {
      console.error("messageReactionRemove hatası:", err);
    }
  });


  // ── Ses kanalı takibi (personel ses dakikası + kurbağa XP) ───────────────────
  // userId → { joinedAt: Date }
  const voiceSessions = new Map();
  const socialButterflyTracker = new Map();
  const ghostTracker = new Map();

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
          rid && !['PERSONEL_ROLE_ID', 'GELISMIS_ROLE_ID', 'SEKRETER_ROLE_ID'].includes(rid)
          && member.roles.cache.has(rid)
        );

      if (!oldState.channelId && newState.channelId) {
        // Sese girdi
        const { TMT_GUILD_ID, GUILD2_ID } = require("../../config");
        if (guildId === TMT_GUILD_ID) {
          const { logTMTVoiceStateUpdate } = require("../services/tmtLogger");
          logTMTVoiceStateUpdate(oldState, newState);
        }
        voiceSessions.set(userId, { joinedAt: Date.now(), guildId });
        if (guildId === FROG_GUILD_ID) onVoiceJoin(userId);

        if (guildId === GUILD2_ID) {
          const { checkAndRewardTag } = require("../services/clanTagService");
          await checkAndRewardTag(member).catch(() => { });
        }

        // ── Sabah Kuşu Başarımı (Ses) ──
        if (guildId === '1367646464804655104') {
          const h = new Date().getHours();
          if (h >= 6 && h < 8) {
            const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
            if (mainGuild) {
              const memberToReward = await mainGuild.members.fetch(userId).catch(() => null);
              if (memberToReward) {
                let earlyRole = mainGuild.roles.cache.find(r => r.name === '🌅 Sabah Kuşu');
                if (!earlyRole) {
                  earlyRole = await mainGuild.roles.create({ name: '🌅 Sabah Kuşu', color: '#f1c40f', hoist: false, position: 1, reason: 'Gizli Başarım Sistemi' });
                }
                if (earlyRole && !memberToReward.roles.cache.has(earlyRole.id)) {
                  await memberToReward.roles.add(earlyRole.id).catch(() => { });
                  memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Sabah Kuşu!**\nSabahın erken saatlerinde aktif olduğunuz için `🌅 Sabah Kuşu` rolünü kazandınız!').catch(() => { });
                }
              }
            }
          }
        }
      }

      // Kanal değiştirme veya Sese Gidip Gelme (Sosyal Kelebek)
      if (newState.channelId && oldState.channelId !== newState.channelId) {
        if (guildId === '1367646464804655104') {
          let joinedSet = socialButterflyTracker.get(userId) || new Set();
          joinedSet.add(newState.channelId);
          socialButterflyTracker.set(userId, joinedSet);

          if (joinedSet.size === 5) {
            socialButterflyTracker.delete(userId); // Reset
            const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
            if (mainGuild) {
              const memberToReward = await mainGuild.members.fetch(userId).catch(() => null);
              if (memberToReward) {
                let butterflyRole = mainGuild.roles.cache.find(r => r.name === '🎭 Sosyal Kelebek');
                if (!butterflyRole) {
                  butterflyRole = await mainGuild.roles.create({ name: '🎭 Sosyal Kelebek', color: '#e84393', hoist: false, position: 1, reason: 'Gizli Başarım Sistemi' });
                }
                if (butterflyRole && !memberToReward.roles.cache.has(butterflyRole.id)) {
                  await memberToReward.roles.add(butterflyRole.id).catch(() => { });
                  memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Sosyal Kelebek!**\nKısa sürede birçok farklı kanala girdiğiniz için `🎭 Sosyal Kelebek` rolünü kazandınız!').catch(() => { });
                }
              }
            }
          }
        }
      }

      if (oldState.channelId && !newState.channelId) {
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

        // ── GİZLİ BAŞARIMLAR (Üye / Personel Fark Etmeksizin) ──
        if (guildId === '1367646464804655104' && minutes > 0) {
          try {
            const mainGuild = await client.guilds.fetch('1367646464804655104').catch(() => null);
            if (mainGuild) {
              const memberToReward = await mainGuild.members.fetch(userId).catch(() => null);
              if (memberToReward) {
                // 1. Ses Kurdu Başarımı (2+ Saat)
                if (minutes >= 120) {
                  let voiceRole = mainGuild.roles.cache.find(r => r.name === '🏆 Ses Kurdu');
                  if (!voiceRole) {
                    voiceRole = await mainGuild.roles.create({
                      name: '🏆 Ses Kurdu',
                      color: '#95a5a6', // Gri
                      hoist: false,
                      position: 1, // En altta olması için
                      reason: 'Gizli Başarım Sistemi'
                    });
                  }
                  if (voiceRole && !memberToReward.roles.cache.has(voiceRole.id)) {
                    await memberToReward.roles.add(voiceRole.id).catch(() => { });
                    // Özel Ses Kanalı Yetkisi
                    const specialVc = mainGuild.channels.cache.get('1467291940759277834');
                    if (specialVc) {
                      await specialVc.permissionOverwrites.create(memberToReward.id, { Connect: true, ViewChannel: true });
                    }
                    memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Ses Kurdu!**\nSeste 2 saatten fazla kaldığınız için `🏆 Ses Kurdu` rolünü ve özel ses kanalına giriş yetkisini kazandınız!').catch(() => { });
                  }
                }

                // 2. Gece Baykuşu Başarımı (Gece 00:00 - 06:00 arası 10 dk seste kalma)
                const hour = new Date().getHours();
                if (hour >= 0 && hour <= 6 && minutes >= 10) {
                  let owlRole = mainGuild.roles.cache.find(r => r.name === '🦉 Gece Baykuşu');
                  if (!owlRole) {
                    owlRole = await mainGuild.roles.create({
                      name: '🦉 Gece Baykuşu',
                      color: '#7f8c8d', // Koyu Gri
                      hoist: false,
                      position: 1, // En altta olması için
                      reason: 'Gizli Başarım Sistemi'
                    });
                  }
                  if (owlRole && !memberToReward.roles.cache.has(owlRole.id)) {
                    await memberToReward.roles.add(owlRole.id).catch(() => { });
                    memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Gece Baykuşu!**\nGece geç saatlerde 10 dakikadan fazla seste kaldığınız için `🦉 Gece Baykuşu` rolünü kazandınız!').catch(() => { });
                  }
                }

                // 3. Hayalet Başarımı (Seste 1 saat boyunca Susturulmuş/Muted kalmak)
                if (minutes >= 60 && (oldState.selfMute || oldState.serverMute)) {
                  let ghostRole = mainGuild.roles.cache.find(r => r.name === '👻 Hayalet');
                  if (!ghostRole) {
                    ghostRole = await mainGuild.roles.create({
                      name: '👻 Hayalet',
                      color: '#ecf0f1', // Çok Açık Gri / Beyazımsı
                      hoist: false,
                      position: 1, // En altta olması için
                      reason: 'Gizli Başarım Sistemi'
                    });
                  }
                  if (ghostRole && !memberToReward.roles.cache.has(ghostRole.id)) {
                    await memberToReward.roles.add(ghostRole.id).catch(() => { });
                    memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Hayalet!**\nSeste en az 1 saat boyunca tamamen sessiz/susturulmuş kaldığınız için `👻 Hayalet` rolünü kazandınız!').catch(() => { });
                  }
                }

                // 4. Vampir Başarımı (Seste 10 Saat = 600 Dk)
                if (minutes >= 600) {
                  let vampireRole = mainGuild.roles.cache.find(r => r.name === '🦇 Vampir');
                  if (!vampireRole) {
                    vampireRole = await mainGuild.roles.create({
                      name: '🦇 Vampir',
                      color: '#8e44ad', // Koyu Mor
                      hoist: false,
                      position: 1,
                      reason: 'Gizli Başarım Sistemi'
                    });
                  }
                  if (vampireRole && !memberToReward.roles.cache.has(vampireRole.id)) {
                    await memberToReward.roles.add(vampireRole.id).catch(() => { });
                    memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Vampir!**\nİnanılmaz! Seste tam 10 saat boyunca kesintisiz durarak `🦇 Vampir` rolünü kazandınız!').catch(() => { });
                  }
                }

                // 5. Yalnız Kurt Başarımı (Seste 3 saat boyunca tek başına/kimsesiz kalma - çıkarken tek kişi olma kontrolü)
                if (minutes >= 180 && oldState.channel && oldState.channel.members.size <= 1) {
                  let wolfRole = mainGuild.roles.cache.find(r => r.name === '🐺 Yalnız Kurt');
                  if (!wolfRole) {
                    wolfRole = await mainGuild.roles.create({
                      name: '🐺 Yalnız Kurt',
                      color: '#34495e', // Koyu Gri/Mavi
                      hoist: false,
                      position: 1,
                      reason: 'Gizli Başarım Sistemi'
                    });
                  }
                  if (wolfRole && !memberToReward.roles.cache.has(wolfRole.id)) {
                    await memberToReward.roles.add(wolfRole.id).catch(() => { });
                    memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Yalnız Kurt!**\nSeste saatlerce tek başınıza kalarak `🐺 Yalnız Kurt` rolünü kazandınız!').catch(() => { });
                  }
                }

                // Uyurgezer Başarımı (Seste 4 saat Mute + Deafen AFK kalma)
                if (minutes >= 240 && (oldState.selfMute || oldState.serverMute) && (oldState.selfDeaf || oldState.serverDeaf)) {
                  let sleepRole = mainGuild.roles.cache.find(r => r.name === '😴 Uyurgezer');
                  if (!sleepRole) {
                    sleepRole = await mainGuild.roles.create({
                      name: '😴 Uyurgezer',
                      color: '#2c3e50', // Gece Mavisi
                      hoist: false,
                      position: 1,
                      reason: 'Gizli Başarım Sistemi'
                    });
                  }
                  if (sleepRole && !memberToReward.roles.cache.has(sleepRole.id)) {
                    await memberToReward.roles.add(sleepRole.id).catch(() => { });
                    memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Uyurgezer!**\nSeste saatlerce hem sağırlaştırılmış hem de susturulmuş şekilde tam bir uyurgezer gibi bekledin ve `😴 Uyurgezer` rolünü kazandın!').catch(() => { });
                  }
                }
              }
            }
          } catch (e) {
            console.error('[voiceStateUpdate] Başarım verme hatası:', e.message);
          }
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

      // Geçici oda temizleme kontrolü
      if (oldState.channel) {
        try {
          const { checkAndDeleteEmptyChannel } = require("../services/tempVoiceService");
          await checkAndDeleteEmptyChannel(oldState.channel);
        } catch (err) {
          console.error('[voiceStateUpdate] Temp voice cleanup error:', err.message);
        }
      }
    } catch (err) {
      console.error('[voiceStateUpdate] Fatal error:', err.message);
    }
  });



  client.on("messageCreate", async (message) => {
    if (message.guild) {
      const { isGuildAuthorized } = require("../services/guildAuthService");
      const authorized = await isGuildAuthorized(message.guild);
      if (!authorized) return;
    }
    // ── Sunucuya Özel s!sil ve s!ban Komutları ───────────────────────────────
    if (message.guild && !message.author.bot && (message.content.toLowerCase().startsWith("s!sil") || message.content.toLowerCase().startsWith("s!ban"))) {
      const ServerSetup = require("../../models/ServerSetup");
      const setupDoc = await ServerSetup.findOne({ guildId: message.guild.id, status: "active" });
      if (setupDoc) {
        const args = message.content.trim().split(/\s+/);
        const cmd = args[0].toLowerCase();

        if (cmd === "s!sil") {
          const { PermissionFlagsBits } = require("discord.js");
          if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ Bu komutu kullanmak için `Mesajları Yönet` yetkisine sahip olmalısınız.").catch(() => { });
          }

          const amountStr = args[1];
          const amount = parseInt(amountStr, 10);
          if (isNaN(amount) || amount <= 0 || amount > 10000) {
            return message.reply("❌ Lütfen silinecek mesaj miktarını belirtin (1 - 10000 arası)! Örn: `s!sil 150`").catch(() => { });
          }

          // Delete command message first
          await message.delete().catch(() => { });

          try {
            let remaining = amount;
            let totalDeleted = 0;

            while (remaining > 0) {
              const deleteBatch = Math.min(remaining, 100);
              const deleted = await message.channel.bulkDelete(deleteBatch, true);
              if (deleted.size === 0) {
                break;
              }
              totalDeleted += deleted.size;
              remaining -= deleted.size;

              if (deleted.size < deleteBatch) {
                break;
              }

              // Delay to prevent rate limits
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const replyMsg = await message.channel.send(`🧹 **${totalDeleted}** adet mesaj başarıyla silindi!`).catch(() => null);
            if (replyMsg) {
              setTimeout(() => replyMsg.delete().catch(() => { }), 3000);
            }
          } catch (err) {
            console.error("[s!sil] Error:", err);
            await message.channel.send(`❌ Mesajlar silinirken bir hata oluştu: ${err.message}`).catch(() => { });
          }
          return;
        }

        if (cmd === "s!ban") {
          const { PermissionFlagsBits } = require("discord.js");
          if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ Bu komutu kullanmak için `Üyeleri Yasakla` yetkisine sahip olmalısınız.").catch(() => { });
          }

          const targetArg = args[1];
          if (!targetArg) {
            return message.reply("❌ Lütfen banlanacak kullanıcıyı etiketleyin veya ID'sini belirtin! Örn: `s!ban @kullanıcı [sebep]`").catch(() => { });
          }

          const targetId = targetArg.replace(/[^0-9]/g, "");
          const targetMember = message.guild.members.cache.get(targetId)
            || await message.guild.members.fetch(targetId).catch(() => null);

          if (!targetMember) {
            return message.reply("❌ Belirtilen kullanıcı sunucuda bulunamadı!").catch(() => { });
          }

          if (targetMember.id === message.author.id) {
            return message.reply("❌ Kendinizi banlayamazsınız!").catch(() => { });
          }

          const botMember = message.guild.members.me || await message.guild.members.fetch(message.client.user.id).catch(() => null);
          if (botMember && botMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
            return message.reply("❌ Bu kullanıcının rolü botun rolünden daha yüksek veya eşit, bu kişiyi banlayamam!").catch(() => { });
          }

          if (message.member.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0 && message.author.id !== message.guild.ownerId) {
            return message.reply("❌ Yetkiniz bu kullanıcıyı banlamaya yetmiyor!").catch(() => { });
          }

          const reason = args.slice(2).join(" ") || "Sebep belirtilmedi.";

          try {
            await targetMember.ban({ reason: `${message.author.tag} tarafından s!ban ile: ${reason}` });
            await message.reply(`🔨 **${targetMember.user.tag}** kullanıcısı başarıyla yasaklandı!\n**Sebep:** ${reason}`).catch(() => { });
          } catch (err) {
            console.error("[s!ban] Error:", err);
            await message.reply(`❌ Kullanıcı yasaklanırken bir hata oluştu: ${err.message}`).catch(() => { });
          }
          return;
        }
      }
    }

    // ── Profanity & Swear & NSFW Check ──
    if (message.guild && !message.author.bot) {
      try {
        const swearWords = [
          "siktir", "sikis", "sikem", "sikim", "sikti", "orospu", "pic", "amk", "yarrak",
          "got", "amina", "amini", "kaltak", "yavsak", "kahpe", "meme", "tassak", "tasak",
          "amcik", "gavat", "godos", "porno", "hentai", "nsfw", "sikiş", "piç", "göt",
          "amına", "amını", "yavşak", "taşşak", "taşak", "amcık", "godoş"
        ];

        const cleanedContent = message.content
          .toLowerCase()
          .replace(/\u0307/g, "")
          .replace(/ı/g, "i")
          .replace(/ğ/g, "g")
          .replace(/ü/g, "u")
          .replace(/ş/g, "s")
          .replace(/ö/g, "o")
          .replace(/ç/g, "c");

        const hasSwear = swearWords.some(word => cleanedContent.includes(word));
        if (hasSwear) {
          // Notify Moderator
          const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

          let targetMod = null;
          try {
            // Find members with role ID 1518692386836971610
            const modRoleMembers = message.guild.members.cache.filter(m =>
              !m.user.bot &&
              m.roles.cache.has("1518692386836971610")
            );

            // Filter by presence (active)
            const activeMods = modRoleMembers.filter(m =>
              m.presence && (m.presence.status === "online" || m.presence.status === "dnd" || m.presence.status === "idle")
            );

            if (activeMods.size > 0) {
              targetMod = activeMods.random();
            } else if (modRoleMembers.size > 0) {
              targetMod = modRoleMembers.random();
            }
          } catch (_) { }

          if (!targetMod) {
            targetMod = await message.guild.members.fetch("1031620522406072350").catch(() => null);
          }

          if (targetMod) {
            // AI Evaluation of the severity
            let severity = "orta";
            let suggestedDuration = 15;
            try {
              const { chatWithAI } = require("../services/aiService");
              const aiPrompt = "Sen bir Discord moderasyon asistanısın. Kullanıcı tarafından yazılan küfürlü mesajın ciddiyetini değerlendir. " +
                "Aşırı derecede kötü veya cinsel içerikliyse yüksek süre ver. Hafif küfür ise düşük süre ver. " +
                "Yalnızca JSON formatında yanıt dön: {\"severity\": \"dusuk|orta|yuksek\", \"minutes\": 10-180 arası sayı}";
              const aiResponse = await chatWithAI(`Kullanıcı Mesajı: "${message.content}"`, aiPrompt).catch(() => null);
              if (aiResponse) {
                const cleanJson = aiResponse.replace(/```json|```/g, "").trim();
                const parsed = JSON.parse(cleanJson);
                severity = parsed.severity || severity;
                suggestedDuration = parsed.minutes || suggestedDuration;
              }
            } catch (err) {
              console.error("[SwearDetector] AI değerlendirme hatası:", err.message);
            }

            const embed = new EmbedBuilder()
              .setTitle("🚨 KÜFÜR VEYA UYGUNSUZ İÇERİK ALGILANDI")
              .setColor(0xe74c3c)
              .setDescription(
                `Sunucuda küfür veya uygunsuz içerik barındıran bir mesaj tespit edildi.\n\n` +
                `👤 **Kullanıcı:** ${message.author.toString()} (\`${message.author.tag}\`)\n` +
                `🏠 **Sunucu:** ${message.guild.name}\n` +
                `📂 **Kanal:** <#${message.channel.id}>\n` +
                `📝 **İçerik:** \`${message.content}\`\n\n` +
                `🤖 **AI Değerlendirmesi:**\n` +
                `• **Önem Derecesi:** \`${severity.toUpperCase()}\`\n` +
                `• **Önerilen Hapis Süresi:** \`${suggestedDuration} dakika\``
              )
              .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`jail_warn_${message.guild.id}_${message.author.id}_${message.channel.id}_${message.id}`)
                .setLabel("⚠️ UYAR")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId(`jail_immed_${message.guild.id}_${message.author.id}_${message.channel.id}_${message.id}_${suggestedDuration}`)
                .setLabel("🔒 HAPİSE AT")
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`jail_ignore_${message.guild.id}_${message.author.id}_${message.channel.id}_${message.id}`)
                .setLabel("✅ YOKSAY")
                .setStyle(ButtonStyle.Secondary)
            );

            await targetMod.send({ embeds: [embed], components: [row] }).catch((err) => {
              console.error(`[SwearDetector] Yetkiliye DM gönderilemedi:`, err.message);
            });
          }
        }
      } catch (err) {
        console.error("[SwearDetector] Hata:", err);
      }
    }

    // Son mesajları Telegram AI kullanımı için kaydet
    try {
      const { recordMessage } = require("../services/telegramService");
      recordMessage();
    } catch (_) { }

    // Partial mesajları fetch et (DM için zorunlu)
    if (message.partial) {
      try { await message.fetch(); } catch (_) { return; }
    }

    // ── Karaliste Mesaj Kontrolü (EkoYıldız) ──────────────────────────────────
    if (message.channel && message.channel.id === '1518692472367222915') {
      try {
        const { handleBlacklistMessage } = require('../services/blacklistService');
        await handleBlacklistMessage(message, client);
      } catch (err) {
        console.error('[blacklist] Mesaj işleme hatası:', err.message);
      }
      return;
    }

    // ── DM mesajları ────────────────────────────────────────────────────────
    if (!message.guild && !message.author?.bot) {
      console.log(`[DM] ${message.author?.tag}: ${message.content?.slice(0, 50)}`);
      // Anket cevabı mı?
      try {
        const { handleSurveyReply } = require('../services/surveyAI');
        const handled = await handleSurveyReply(message, client);
        if (handled) return;
      } catch (_) { }
      // Moderatör mülakat cevabı mı?
      try {
        const { handleInterviewReply } = require('../services/modInterview');
        const handled = await handleInterviewReply(message, client);
        if (handled) return;
      } catch (_) { }
      // Koç sohbeti cevabı mı?
      try {
        const { handleCoachReply } = require('../services/staffCoach');
        const handled = await handleCoachReply(message, client);
        if (handled) return;
      } catch (_) { }
      // AI konus sohbeti cevabı mı?
      try {
        const { handleKonusReply } = require('../services/aiTalkService');
        const handled = await handleKonusReply(message, client);
        if (handled) return;
      } catch (_) { }
      // Normal DM ticket
      try {
        const { handleDMMessage } = require('../services/dmTicket');
        await handleDMMessage(message, client);
      } catch (err) {
        console.error('[messageCreate] DM handler hata:', err.message);
        await message.author?.send('Bir hata oluştu. Lütfen daha sonra tekrar deneyin.').catch(() => { });
      }
      return;
    }

    if (message.author.bot || !message.guild) return;

    // ── 1518692502679588954 Kanalı Tepki Ekleme ─────────────────────────────────────
    if (message.channel.id === '1518692502679588954') {
      try {
        await message.react('👍').catch(() => { });
        await message.react('👎').catch(() => { });
      } catch (err) {
        console.error('[reaction] Tepki ekleme hatası:', err.message);
      }
    }

    // ── TMT Oyunlar ve Honeypot ─────────────────────────────────────────────
    try {
      const { handleTMTGames } = require('../services/tmtGames');
      const handled = await handleTMTGames(message, client);
      if (handled) return;
    } catch (_) { }

    // ── EkoYıldız Oyunları ─────────────────────────────────────────────────
    try {
      const { handleEkoGames } = require('../services/ekoGames');
      const handled = await handleEkoGames(message, client);
      if (handled) return;
    } catch (_) { }

    // ── Abone fotoğraf doğrulama (Eko Yıldız) ──────────────────────────────
    try {
      const { handlePhotoUpload } = require('../services/photoVerification');
      const handled = await handlePhotoUpload(message, client);
      if (handled) return;
    } catch (_) { }

    // ── Kurbağa XP (EkoYıldız'da mesaj yazınca) & Sunucu Etiketi Kontrolü ────
    try {
      const { FROG_GUILD_ID, addMessageXP } = require("../services/frogLevel");
      if (message.guild.id === FROG_GUILD_ID) {
        await addMessageXP(message.member, client).catch(() => { });

        const { checkAndRewardTag } = require("../services/clanTagService");
        await checkAndRewardTag(message.member).catch(() => { });
      }
    } catch (_) { }

    // ── Gece Baykuşu Başarımı (Sohbet) ────────────────────────────────────
    try {
      if (message.guild.id === '1367646464804655104') {
        const uId = message.author.id;
        const hour = new Date().getHours();

        // Sabah Kuşu (Sohbet)
        if (hour >= 6 && hour < 8) {
          let earlyRole = message.guild.roles.cache.find(r => r.name === '🌅 Sabah Kuşu');
          if (!earlyRole) {
            earlyRole = await message.guild.roles.create({ name: '🌅 Sabah Kuşu', color: '#f1c40f', hoist: false, position: 1, reason: 'Gizli Başarım Sistemi' });
          }
          if (earlyRole && !message.member.roles.cache.has(earlyRole.id)) {
            await message.member.roles.add(earlyRole.id).catch(() => { });
            message.author.send('🎉 **Gizli Başarım Kazanıldı: Sabah Kuşu!**\nSabahın erken saatlerinde aktif olduğunuz için `🌅 Sabah Kuşu` rolünü kazandınız!').catch(() => { });
          }
        }

        // Gece Baykuşu (Sohbet)
        if (hour >= 0 && hour <= 6) {
          const { incrementTracker } = require('../services/achievementManager');
          let msgs = await incrementTracker(uId, 'nightChatMsgs');

          if (msgs === 15) { // Ortalama 15 mesaj = 10 dakikalık sohbet aktivitesi
            let owlRole = message.guild.roles.cache.find(r => r.name === '🦉 Gece Baykuşu');
            if (!owlRole) {
              owlRole = await message.guild.roles.create({
                name: '🦉 Gece Baykuşu',
                color: '#7f8c8d',
                hoist: false,
                position: 1, // En altta olması için
                reason: 'Gizli Başarım Sistemi'
              });
            }
            if (owlRole && !message.member.roles.cache.has(owlRole.id)) {
              await message.member.roles.add(owlRole.id).catch(() => { });
              message.author.send('🎉 **Gizli Başarım Kazanıldı: Gece Baykuşu!**\nGece geç saatlerde sohbette aktif olduğunuz için `🦉 Gece Baykuşu` rolünü kazandınız!').catch(() => { });
            }
          }
        }

        // Klavyeşör
        const { incrementTracker } = require('../services/achievementManager');
        let dailyMsgs = await incrementTracker(uId, 'dailyChatMsgs');
        if (dailyMsgs === 100) {
          let keyRole = message.guild.roles.cache.find(r => r.name === '⌨️ Klavyeşör');
          if (!keyRole) {
            keyRole = await message.guild.roles.create({
              name: '⌨️ Klavyeşör',
              color: '#34495e',
              hoist: false,
              position: 1,
              reason: 'Gizli Başarım Sistemi'
            });
          }
          if (keyRole && !message.member.roles.cache.has(keyRole.id)) {
            await message.member.roles.add(keyRole.id).catch(() => { });
            message.author.send('🎉 **Gizli Başarım Kazanıldı: Klavyeşör!**\nBugün 100\'den fazla mesaj göndererek aktifliğini kanıtladın ve `⌨️ Klavyeşör` rolünü kazandın!').catch(() => { });
          }
        }

        // Kahin (Gizli Şifre)
        if (message.content.toLowerCase().includes("eko yıldız kalbimde")) {
          let oracleRole = message.guild.roles.cache.find(r => r.name === '🔮 Kahin');
          if (!oracleRole) {
            oracleRole = await message.guild.roles.create({
              name: '🔮 Kahin',
              color: '#9b59b6', // Mor
              hoist: false,
              position: 1,
              reason: 'Gizli Başarım Sistemi'
            });
          }
          if (oracleRole && !message.member.roles.cache.has(oracleRole.id)) {
            await message.member.roles.add(oracleRole.id).catch(() => { });
            message.author.send('🎉 **Gizli Başarım Kazanıldı: Kahin!**\nSohbete tam olarak gizli şifreyi yazmayı başardığın için `🔮 Kahin` rolünü kazandın! Gerçekten bir kahin olmalısın.').catch(() => { });
          }
        }

        // Fotoğrafçı
        if (message.attachments.size > 0) {
          const { incrementTracker } = require('../services/achievementManager');
          let photos = await incrementTracker(uId, 'photoCount', message.attachments.size);

          if (photos >= 20) {
            let photoRole = message.guild.roles.cache.find(r => r.name === '📸 Fotoğrafçı');
            if (!photoRole) {
              photoRole = await message.guild.roles.create({
                name: '📸 Fotoğrafçı',
                color: '#3498db', // Mavi
                hoist: false,
                position: 1,
                reason: 'Gizli Başarım Sistemi'
              });
            }
            if (photoRole && !message.member.roles.cache.has(photoRole.id)) {
              await message.member.roles.add(photoRole.id).catch(() => { });
              message.author.send('🎉 **Gizli Başarım Kazanıldı: Fotoğrafçı!**\nSohbete birbirinden güzel tam 20 görsel yüklediğin için `📸 Fotoğrafçı` rolünü kazandın!').catch(() => { });
            }
          }
        }

        // Roman Yazarı
        if (message.content.length > 1000) {
          let writerRole = message.guild.roles.cache.find(r => r.name === '📝 Roman Yazarı');
          if (!writerRole) {
            writerRole = await message.guild.roles.create({
              name: '📝 Roman Yazarı',
              color: '#95a5a6', // Gümüş
              hoist: false,
              position: 1,
              reason: 'Gizli Başarım Sistemi'
            });
          }
          if (writerRole && !message.member.roles.cache.has(writerRole.id)) {
            await message.member.roles.add(writerRole.id).catch(() => { });
            message.author.send('🎉 **Gizli Başarım Kazanıldı: Roman Yazarı!**\nSohbete tek seferde 1000 karakterden uzun harika bir destan yazdığın için `📝 Roman Yazarı` rolünü kazandın!').catch(() => { });
          }
        }
      }
    } catch (_) { }

    // ── AI Kanal Sohbet İzleme (moderatör etkileşimi) ─────────────────────
    try {
      const { handleAIChatMessage } = require('../services/aiChannelChat');
      await handleAIChatMessage(message, client);
    } catch (_) { }

    // ── Personel selam takibi ──────────────────────────────────────────────
    try {
      const { GUILD_ID, ROLES } = require("../services/staffSystem");
      if (message.guild.id === GUILD_ID) {
        const staffRoleIds = Object.values(ROLES).filter(id =>
          id && !['PERSONEL_ROLE_ID', 'GELISMIS_ROLE_ID', 'SEKRETER_ROLE_ID'].includes(id)
        );
        const isStaff = staffRoleIds.some(rid => message.member?.roles.cache.has(rid));
        if (isStaff) {
          // 1) Mesaj gönderdiğini (Sohbet istatistiği) kaydet
          if (message.content.length > 2) {
            const { recordChatMessage } = require("../services/staffSystem");
            await recordChatMessage(message.author.id, client).catch(() => { });
          }

          // 2) Selam verip vermediğini kontrol et
          const greetWords = ['selam', 'merhaba', 'günaydın', 'iyi günler', 'hey', 'heyy', 'hello', 'hi'];
          const lower = message.content.toLowerCase();
          const isGreet = greetWords.some(w => lower.startsWith(w) || lower.includes(w));
          if (isGreet) {
            const { recordGreet } = require("../services/staffSystem");
            await recordGreet(message.author.id, client).catch(() => { });
          }
        }
      }
    } catch (_) { }

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
    } catch (_) { }
    if (message.content.toLowerCase().startsWith("!sunucukur")) {
      const allowedUsers = ["1228088674206617621", "1031620522406072350"];
      if (!allowedUsers.includes(message.author.id)) {
        return message.reply("❌ Bu komutu kullanmak için yetkiniz yok!");
      }

      const args = message.content.trim().split(/\s+/);
      const groupIdStr = args[1];
      if (!groupIdStr) {
        return message.reply("❌ Lütfen bir Roblox Grup ID'si belirtin! Örn: `!sunucukur 1234567`");
      }

      const statusMsg = await message.reply("⏳ Yapay zeka rol eşleştirmesi hazırlanıyor, lütfen bekleyin...").catch(() => null);

      try {
        const { startServerSetupFlow } = require("./generalCommandHandler");
        await startServerSetupFlow({
          guild: message.guild,
          user: message.author,
          groupIdStr,
          replyCallback: async (options) => {
            if (statusMsg) {
              return statusMsg.edit(options).catch(() => message.reply(options));
            } else {
              return message.reply(options);
            }
          }
        });
      } catch (err) {
        console.error("[SunucuKurma] Text command setup error:", err);
        if (statusMsg) {
          await statusMsg.edit(`❌ Kurulum başlatılırken bir hata oluştu: ${err.message}`).catch(() => { });
        } else {
          await message.reply(`❌ Kurulum başlatılırken bir hata oluştu: ${err.message}`).catch(() => { });
        }
      }
      return;
    }

    if (message.content === "!rolleritamtersineceviryoneticiizniile") {
      const { PermissionFlagsBits } = require("discord.js");
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("❌ Bu komutu sadece sunucu yöneticileri kullanabilir!");
      }

      const statusMsg = await message.reply("⏳ Rollerin hiyerarşik sıralaması tersine çevriliyor...").catch(() => null);

      try {
        const botMember = message.guild.members.me || await message.guild.members.fetch(message.client.user.id).catch(() => null);
        if (!botMember) {
          throw new Error("Bot üye bilgisi alınamadı.");
        }

        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
          throw new Error("Botun `Rolleri Yönet` yetkisi bulunmuyor.");
        }

        // Fetch all roles, filter out @everyone, managed roles, and roles higher/equal to bot's highest role
        const allRoles = await message.guild.roles.fetch();
        const rolesToMove = allRoles
          .filter(r =>
            r.id !== message.guild.id &&
            r.editable &&
            !r.managed &&
            !r.tags?.premiumSubscriberRole &&
            !r.tags?.botId &&
            !r.tags?.integrationId
          )
          .sort((a, b) => a.position - b.position);

        if (rolesToMove.size < 2) {
          throw new Error("Tersine çevrilecek yeterli sayıda hareket ettirilebilir rol bulunamadı (en az 2 rol gerekli).");
        }

        const rolesArray = Array.from(rolesToMove.values());
        const originalPositions = rolesArray.map(r => r.position);
        const reversedPositions = [...originalPositions].reverse();

        const positionPayload = rolesArray.map((role, idx) => ({
          role: role.id,
          position: reversedPositions[idx]
        }));

        await message.guild.roles.setPositions(positionPayload);

        const replyText = `✅ **Rollerin Hiyerarşik Sıralaması Başarıyla Tersine Çevrildi!**\n\n` +
          `• Toplam **${rolesArray.length}** rolün sırası değiştirildi.\n` +
          `• En üstteki rol en alta, en alttaki rol ise en üste taşındı.`;

        if (statusMsg) {
          await statusMsg.edit(replyText).catch(() => message.reply(replyText));
        } else {
          await message.reply(replyText);
        }
      } catch (err) {
        if (err.message.includes("yeterli sayıda")) {
          console.warn("[RolTersineCevir] Validation warning:", err.message);
        } else {
          console.error("[RolTersineCevir] Error:", err);
        }
        const errorText = `❌ Rollerin sırası tersine çevrilirken bir hata oluştu: ${err.message}`;
        if (statusMsg) {
          await statusMsg.edit(errorText).catch(() => message.reply(errorText));
        } else {
          await message.reply(errorText);
        }
      }
      return;
    }

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

    if (message.content === "!tumkanallaraciklamasiz" || message.content === "!tümkanallaraçıklamasız") {
      const { PermissionFlagsBits } = require('discord.js');
      if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("❌ Bu komutu kullanmak için `Kanalları Yönet` veya `Yönetici` yetkisine sahip olmalısınız.");
      }

      const channels = message.guild.channels.cache
        .filter(c => typeof c.setTopic === 'function' && (!c.topic || c.topic.trim() === ""))
        .sort((a, b) => a.position - b.position);

      if (channels.size === 0) {
        return message.reply("ℹ️ Sunucuda açıklaması olmayan (ve açıklama eklenebilir olan) herhangi bir yazı kanalı bulunamadı.");
      }

      let replyText = "**Açıklaması Olmayan Kanallar (İsim = ID):**\n\n";
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

    if (message.content === "!ekorolsync") {
      const { PermissionFlagsBits } = require('discord.js');
      if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("❌ Bu komutu kullanmak için `Rolleri Yönet` veya `Yönetici` yetkisine sahip olmalısınız.");
      }

      const statusMsg = await message.reply("🔄 EkoYıldız Rol Senkronizasyonu başlatıldı. Üyeler ve DB taranıyor...");

      try {
        const guild = message.guild;
        // Fetch all members
        const members = await guild.members.fetch();

        const StaffProgress = require('../../models/StaffProgress');
        const FrogLevel = require('../../models/FrogLevel');
        const { ROLES } = require('../services/staffSystem');
        const staffAutomation = require('../services/staffAutomation');
        const frogLevel = require('../services/frogLevel');

        let syncedCount = 0;
        let staffCount = 0;
        let levelCount = 0;

        for (const [memberId, member] of members.entries()) {
          if (member.user.bot) continue;

          let updated = false;

          // 1. Staff System Sync
          const progress = await StaffProgress.findOne({ userId: memberId });
          if (progress && progress.level) {
            const roleId = ROLES[progress.level];
            if (roleId) {
              if (!member.roles.cache.has(roleId)) {
                await member.roles.add(roleId, "EkoRolSync: Staff Seviye Kurtarma").catch(() => { });
              }
              // Also run main guild roles sync
              await staffAutomation.syncMainGuildRoles(client, memberId).catch(() => { });
              staffCount++;
              updated = true;
            }
          }

          // 2. Frog Level (Dinazor/Penguen) System Sync
          const frog = await FrogLevel.findOne({ userId: memberId, guildId: guild.id });
          if (frog && frog.level !== undefined) {
            await frogLevel.syncRolesFromLevel(member, frog.level, client).catch(() => { });
            levelCount++;
            updated = true;
          }

          if (updated) {
            syncedCount++;
          }
        }

        await statusMsg.edit(`✅ **Senkronizasyon Başarıyla Tamamlandı!**\n\n👥 **Taranan Toplam Üye:** ${members.size}\n🔄 **Rolleri Güncellenen / Senkronize Edilen Üye:** ${syncedCount}\n👔 **Personel Rolü Verilenler:** ${staffCount}\n🦖 **Dinazor/Penguen Rolü Verilenler:** ${levelCount}`);
      } catch (err) {
        console.error("EkoRolSync hatası:", err);
        await statusMsg.edit(`❌ Senkronizasyon sırasında hata oluştu: ${err.message}`);
      }
    }

    // ── !birimalimi komut: Birim alımı başlat (admin only) ──────────────────
    if (message.content.toLowerCase().startsWith("!birimalimi")) {
      const { PermissionFlagsBits } = require('discord.js');
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply("❌ Bu komutu kullanmak için `Yönetici` yetkisine sahip olmalısınız.");
      }

      // Parse the command: !birimalimi [birim]
      const args = message.content.toLowerCase().split(/\s+/).slice(1);
      const birimArg = args[0]?.toUpperCase();

      // Validate birim
      const validBirims = ['BAN_BIRIMI', 'SES_BIRIMI', 'SOHBET_BIRIMI', 'BAN', 'SES', 'SOHBET'];

      if (!birimArg || !validBirims.includes(birimArg)) {
        const helpText = `ℹ️ **!birimalimi Kullanım**\n\n` +
          `**Format:** \`!birimalimi [birim]\`\n\n` +
          `**Geçerli Birimler:**\n` +
          `\`!birimalimi ban\` - Ban Birimi alımı\n` +
          `\`!birimalimi ses\` - Ses Birimi alımı\n` +
          `\`!birimalimi sohbet\` - Sohbet Birimi alımı\n\n` +
          `Birim alım duyurusu belirtilen kanala gönderilecektir.`;
        return message.reply(helpText);
      }

      // Map short names to full names
      const birimMap = {
        'BAN': 'BAN_BIRIMI',
        'SES': 'SES_BIRIMI',
        'SOHBET': 'SOHBET_BIRIMI'
      };

      const birimKey = birimArg.length === 3 ? birimMap[birimArg] : birimArg;

      try {
        message.react('⏳'); // Loading reaction

        // Use the existing startBirimAlimi function
        const { startBirimAlimi } = require('../services/unitService');
        await startBirimAlimi(message, message.client, birimKey);

        message.reactions.removeAll();
      } catch (err) {
        console.error('[!birimalimi] Error:', err.message);
        message.reply(`❌ Birim alımı başlatılırken hata oluştu: ${err.message}`);
      }
    }

    // ────────────────────────────────────────────────────────────────────────

    if (message.content.startsWith("!rollerveizinleri")) {
      const { PermissionFlagsBits } = require('discord.js');
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("❌ Bu komutu kullanmak için `Yönetici` yetkisine sahip olmalısınız.");
      }

      const lines = message.content.split("\n");
      if (lines.length <= 1 || (lines.length === 2 && !lines[1].trim())) {
        let helpText = `ℹ️ **!rollerveizinleri Kullanım Rehberi**\n`;
        helpText += `Bu komut, sunucudaki rollerin yetkilerini toplu olarak güncellemenizi sağlar.\n\n`;
        helpText += `**Format:**\n`;
        helpText += `\`\`\`\n`;
        helpText += `!rollerveizinleri\n`;
        helpText += `[rol_id] [true/false/ac/kapat] [yetki_ismi1] [yetki_ismi2] ...\n`;
        helpText += `\`\`\`\n\n`;
        helpText += `*Eğer true/false belirtilmezse varsayılan olarak yetkiler açılır (true).* \n\n`;
        helpText += `**Örnekler:**\n`;
        helpText += `- \`1518692395774906648 true tepkiler mesajgonder\`\n`;
        helpText += `- \`1518692395774906648 false yonetici\`\n`;
        helpText += `- \`1518692395774906648 baglan konus\` (Varsayılan olarak true)\n\n`;
        helpText += `**Popüler Yetki İsimleri:**\n`;
        helpText += `- \`yonetici\` / \`admin\`\n`;
        helpText += `- \`rolleriyonet\` / \`rol\`\n`;
        helpText += `- \`kanallariyonet\` / \`kanal\`\n`;
        helpText += `- \`sunucuyuyonet\`\n`;
        helpText += `- \`goruntule\` / \`oku\` (Kanalları Görüntüle)\n`;
        helpText += `- \`mesajgonder\` / \`mesaj\` / \`yaz\`\n`;
        helpText += `- \`mesajlariyonet\`\n`;
        helpText += `- \`linkpaylas\` / \`link\`\n`;
        helpText += `- \`dosyagonder\` / \`dosya\`\n`;
        helpText += `- \`tepkiler\` / \`tepki\`\n`;
        helpText += `- \`gecmisigor\`\n`;
        helpText += `- \`baglan\` / \`ses\`\n`;
        helpText += `- \`konus\`\n`;
        helpText += `- \`sustur\` / \`mute\`\n`;
        helpText += `- \`sagirlastir\`\n`;
        helpText += `- \`tasi\`\n`;
        helpText += `- \`yayin\` / \`ekran\`\n`;
        helpText += `- \`zamanasimi\` / \`susturma\` / \`timeout\`\n`;
        helpText += `- \`uygulamakomutlari\`\n`;
        return message.reply(helpText);
      }

      const permissionMap = {
        "yonetici": "Administrator",
        "admin": "Administrator",
        "administrator": "Administrator",
        "rolleriyonet": "ManageRoles",
        "manageroles": "ManageRoles",
        "rol": "ManageRoles",
        "roller": "ManageRoles",
        "kanallariyonet": "ManageChannels",
        "managechannels": "ManageChannels",
        "kanal": "ManageChannels",
        "kanallar": "ManageChannels",
        "sunucuyuyonet": "ManageGuild",
        "manageguild": "ManageGuild",
        "sunucu": "ManageGuild",
        "uyeleriat": "KickMembers",
        "kickmembers": "KickMembers",
        "kick": "KickMembers",
        "uyeleriyasakla": "BanMembers",
        "banmembers": "BanMembers",
        "ban": "BanMembers",
        "denetimkaydi": "ViewAuditLog",
        "viewauditlog": "ViewAuditLog",
        "denetim": "ViewAuditLog",
        "goruntule": "ViewChannel",
        "viewchannel": "ViewChannel",
        "oku": "ViewChannel",
        "mesajgonder": "SendMessages",
        "sendmessages": "SendMessages",
        "mesaj": "SendMessages",
        "yaz": "SendMessages",
        "mesajlariyonet": "ManageMessages",
        "managemessages": "ManageMessages",
        "linkpaylas": "EmbedLinks",
        "embedlinks": "EmbedLinks",
        "link": "EmbedLinks",
        "baglanti": "EmbedLinks",
        "dosyagonder": "AttachFiles",
        "attachfiles": "AttachFiles",
        "dosya": "AttachFiles",
        "tepkiler": "AddReactions",
        "tepki": "AddReactions",
        "addreactions": "AddReactions",
        "tepkiekle": "AddReactions",
        "hariciemoji": "UseExternalEmojis",
        "useexternalemojis": "UseExternalEmojis",
        "disemoji": "UseExternalEmojis",
        "herkesebahset": "MentionEveryone",
        "mentioneveryone": "MentionEveryone",
        "everyone": "MentionEveryone",
        "etiket": "MentionEveryone",
        "gecmisigor": "ReadMessageHistory",
        "readmessagehistory": "ReadMessageHistory",
        "gecmis": "ReadMessageHistory",
        "baglan": "Connect",
        "connect": "Connect",
        "ses": "Connect",
        "konus": "Speak",
        "speak": "Speak",
        "sustur": "MuteMembers",
        "mutemembers": "MuteMembers",
        "mute": "MuteMembers",
        "sagirlastir": "DeafenMembers",
        "deafenmembers": "DeafenMembers",
        "sagir": "DeafenMembers",
        "tasi": "MoveMembers",
        "movemembers": "MoveMembers",
        "tasima": "MoveMembers",
        "sesaktifligi": "UseVAD",
        "usevad": "UseVAD",
        "yayin": "Stream",
        "stream": "Stream",
        "ekran": "Stream",
        "video": "Stream",
        "etkinlik": "UseEmbeddedActivities",
        "useembeddedactivities": "UseEmbeddedActivities",
        "etkinlikler": "UseEmbeddedActivities",
        "zamanasimi": "ModerateMembers",
        "timeout": "ModerateMembers",
        "moderatemembers": "ModerateMembers",
        "susturma": "ModerateMembers",
        "uygulamakomutlari": "UseApplicationCommands",
        "useapplicationcommands": "UseApplicationCommands",
        "komut": "UseApplicationCommands",
        "egikcizgi": "UseApplicationCommands",
        "davet": "CreateInstantInvite",
        "createinstantinvite": "CreateInstantInvite",
        "davetolustur": "CreateInstantInvite",
        "addegistir": "ChangeNickname",
        "changenickname": "ChangeNickname",
        "adlariyonet": "ManageNicknames",
        "managenicknames": "ManageNicknames",
        "webhooksyonet": "ManageWebhooks",
        "managewebhooks": "ManageWebhooks",
        "webhook": "ManageWebhooks",
        "emojiyonet": "ManageEmojisAndStickers",
        "manageemojisandstickers": "ManageEmojisAndStickers",
        "ifadeleriyonet": "ManageEmojisAndStickers",
        "konusmakiciniste": "RequestToSpeak",
        "requesttospeak": "RequestToSpeak",
        "etkinlikleriyonet": "ManageEvents",
        "manageevents": "ManageEvents",
        "basliklariyonet": "ManageThreads",
        "managethreads": "ManageThreads",
        "genelbasliklar": "CreatePublicThreads",
        "createpublicthreads": "CreatePublicThreads",
        "ozelbasliklar": "CreatePrivateThreads",
        "createprivatethreads": "CreatePrivateThreads",
        "hariciifadeler": "UseExternalStickers",
        "useexternalstickers": "UseExternalStickers",
        "basliklardamesaj": "SendMessagesInThreads",
        "sendmessagesinthreads": "SendMessagesInThreads",
        "sespaneli": "UseSoundboard",
        "usesoundboard": "UseSoundboard",
        "haricisesler": "UseExternalSounds",
        "useexternalsounds": "UseExternalSounds",
        "seslimesaj": "SendVoiceMessages",
        "sendvoicemessages": "SendVoiceMessages"
      };

      function normalizeStr(str) {
        if (!str) return "";
        return str.toLowerCase()
          .replace(/ı/g, 'i')
          .replace(/ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/ş/g, 's')
          .replace(/ö/g, 'o')
          .replace(/ç/g, 'c')
          .replace(/[^a-z0-9]/g, '');
      }

      const results = [];
      const statusMsg = await message.reply("🔄 Rol yetkileri güncelleniyor, lütfen bekleyin...");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const tokens = line.split(/[\s,]+/);
        const roleId = tokens[0];

        if (!/^\d{17,20}$/.test(roleId)) {
          results.push(`⚠️ Satır ${i + 1}: Geçersiz rol ID formatı (\`${roleId}\`)`);
          continue;
        }

        let role = message.guild.roles.cache.get(roleId);
        if (!role) {
          try {
            role = await message.guild.roles.fetch(roleId);
          } catch (_) { }
        }

        if (!role) {
          results.push(`❌ Rol Bulunamadı: \`${roleId}\``);
          continue;
        }

        if (role.name === "@everyone") {
          results.push(`⚠️ @everyone rolü bu komutla değiştirilemez: \`${roleId}\``);
          continue;
        }

        let value = true;
        let permTokens = [];

        if (tokens.length > 1) {
          const normSecond = normalizeStr(tokens[1]);
          const isTrueKeywords = ["true", "ac", "aktif", "ver", "evet", "1"];
          const isFalseKeywords = ["false", "kapat", "deaktif", "al", "hayir", "yok", "0"];

          if (isTrueKeywords.includes(normSecond)) {
            value = true;
            permTokens = tokens.slice(2);
          } else if (isFalseKeywords.includes(normSecond)) {
            value = false;
            permTokens = tokens.slice(2);
          } else {
            value = true;
            permTokens = tokens.slice(1);
          }
        }

        if (permTokens.length === 0) {
          results.push(`⚠️ Rol **${role.name}** (${role.id}): Güncellenecek yetki belirtilmemiş.`);
          continue;
        }

        const resolvedBits = [];
        const unrecognized = [];

        for (const pt of permTokens) {
          const normPt = normalizeStr(pt);
          const mappedKey = permissionMap[normPt];

          if (mappedKey && PermissionFlagsBits[mappedKey] !== undefined) {
            resolvedBits.push(PermissionFlagsBits[mappedKey]);
          } else {
            const directKey = Object.keys(PermissionFlagsBits).find(
              k => k.toLowerCase() === pt.toLowerCase() || normalizeStr(k) === normPt
            );
            if (directKey) {
              resolvedBits.push(PermissionFlagsBits[directKey]);
            } else {
              unrecognized.push(pt);
            }
          }
        }

        if (resolvedBits.length === 0) {
          results.push(`❌ Rol **${role.name}** (${role.id}): Geçerli yetki ismi bulunamadı. (Girilenler: \`${permTokens.join(", ")}\`)`);
          continue;
        }

        try {
          if (message.guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
            results.push(`❌ Rol **${role.name}** (${role.id}): Botun yetki sırası bu rolden düşüktür.`);
            continue;
          }

          let currentPermissions = role.permissions;
          if (value) {
            currentPermissions = currentPermissions.add(resolvedBits);
          } else {
            currentPermissions = currentPermissions.remove(resolvedBits);
          }

          await role.setPermissions(currentPermissions, `Yetkili: ${message.author.tag} tarafından güncellendi.`);

          const actionText = value ? "Açıldı (true)" : "Kapatıldı (false)";
          const successPerms = permTokens.filter(pt => !unrecognized.includes(pt)).join(", ");
          let logMsg = `✅ **${role.name}** (${role.id}): Yetkiler ${actionText} -> \`${successPerms}\``;
          if (unrecognized.length > 0) {
            logMsg += ` (Tanınmayanlar atlandı: \`${unrecognized.join(", ")}\`)`;
          }
          results.push(logMsg);
        } catch (err) {
          console.error(`Rol ${roleId} güncellenirken hata:`, err);
          results.push(`❌ Rol **${role.name}** (${role.id}) güncellenirken hata: ${err.message}`);
        }
      }

      let replyText = `**Rol Yetki Güncelleme Sonuçları:**\n\n` + results.join("\n");
      if (replyText.length > 2000) {
        const chunks = replyText.match(/[\s\S]{1,1999}/g) || [];
        await statusMsg.edit(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await message.reply(chunks[i]);
        }
      } else {
        await statusMsg.edit(replyText);
      }
    }

    if (message.content === "!modkanallariniolustur" || message.content === "!modkanallariolustur") {
      const { PermissionFlagsBits } = require('discord.js');
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("❌ Bu komutu kullanmak için `Yönetici` yetkisine sahip olmalısınız.");
      }

      const statusMsg = await message.reply("🔄 Moderatör özel log kanalları taranıyor ve oluşturuluyor, lütfen bekleyin...");
      try {
        const { createAllModChannels } = require("../services/modChannelService");
        const results = await createAllModChannels(client);
        await statusMsg.edit(`✅ **Moderatör Kanalları Güncellemesi Tamamlandı!**\n\n- Başarıyla oluşturulan/doğrulanan: **${results.success}** adet kanal\n- Başarısız olan: **${results.failed}** adet kanal`);
      } catch (err) {
        console.error("Mod kanalları oluşturma komut hatası:", err);
        await statusMsg.edit(`❌ Tarama ve kanal oluşturma sırasında bir hata oluştu: ${err.message}`);
      }
    }

    if (message.content === "!muttefikkurulum" || message.content === "!müttefikkurulum" || message.content === "!alliedsetup") {
      const { PermissionFlagsBits } = require('discord.js');
      const { ALLIED_GUILD_ID } = require("../../config");

      if (message.guild?.id !== ALLIED_GUILD_ID) {
        return message.reply("❌ Bu komut sadece **Müttefik Orduları** sunucusunda kullanılabilir.");
      }

      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply("❌ Bu komutu kullanmak için `Yönetici` yetkisine sahip olmalısınız.");
      }

      const statusMsg = await message.reply("🔄 Müttefik Orduları sunucusunun butonları ve menüleri kuruluyor/yenileniyor, lütfen bekleyin...");

      try {
        const { ensureAlliedVerifyHelpMessage, ensureAlliedSupportMessage } = require("../services/alliedRoleSyncService");
        const { ensureAlliedRobloxMenu } = require("../services/robloxGroupManager");

        const verifyResult = await ensureAlliedVerifyHelpMessage(client, true);
        const supportResult = await ensureAlliedSupportMessage(client, true);
        const robloxResult = await ensureAlliedRobloxMenu(client, true);

        let responseText = "✅ **Müttefik Orduları Kurulumu Tamamlandı!**\n\n";
        responseText += `${verifyResult ? "✅" : "❌"} **Doğrulama Yardım Mesajı:** ${verifyResult ? "Başarılı" : "Başarısız"}\n`;
        responseText += `${supportResult ? "✅" : "❌"} **Destek Menüsü Mesajı:** ${supportResult ? "Başarılı" : "Başarısız"}\n`;
        responseText += `${robloxResult ? "✅" : "❌"} **Roblox Grup Yönetim Menüsü:** ${robloxResult ? "Başarılı" : "Başarısız"}\n`;

        await statusMsg.edit(responseText);
      } catch (err) {
        console.error("Müttefik kurulum hatası:", err);
        await statusMsg.edit(`❌ Kurulum sırasında bir hata oluştu: ${err.message}`);
      }
    }
  });

  // ── Bot sunucuya eklendi — Otomatik setup ───────────────────────────────────
  client.on("guildCreate", async (guild) => {
    try {
      const { isGuildAuthorized } = require("../services/guildAuthService");
      const authorized = await isGuildAuthorized(guild);
      if (!authorized) return;

      console.log(`[guildCreate] 🤖 Bot ${guild.name} (${guild.id}) sunucusuna eklendi. Setup başlatılıyor...`);

      // ready event'inde yapılan tüm setup fonksiyonlarını çağır
      const { ensureVerifyHelpMessage } = require("../services/verifyHelpMessage");
      const { ensureVoicePanelMessage } = require("../services/voicePanelMessage");
      const { ensureTMTVerifyHelpMessage } = require("../services/tmtVerifyHelpMessage");
      const { ensureTMTSupportMessage } = require("../services/tmtSupportMessage");
      const { ensureEkoSupportMessage } = require("../services/ekoSupportMessage");
      const { ensureTMTRules } = require("../services/ensureTMTRules");
      const { ensureAdminPanels } = require("../services/panelManager");

      // Sunucuya uygun setup'ları çağır
      const { TARGET_GUILD_ID, TMT_GUILD_ID, GUILD2_ID, ALLIED_GUILD_ID } = require("../../config");

      if (guild.id === TARGET_GUILD_ID) {
        await ensureVerifyHelpMessage(client);
        await ensureVoicePanelMessage(client);
      } else if (guild.id === TMT_GUILD_ID) {
        await ensureTMTVerifyHelpMessage(client);
        await ensureTMTSupportMessage(client);
        await ensureTMTRules(client);
      } else if (guild.id === GUILD2_ID) {
        await ensureEkoSupportMessage(client);
      } else if (guild.id === ALLIED_GUILD_ID) {
        const { ensureAlliedVerifyHelpMessage, ensureAlliedSupportMessage } = require("../services/alliedRoleSyncService");
        await ensureAlliedVerifyHelpMessage(client);
        await ensureAlliedSupportMessage(client);
      }

      // Tüm sunuculara common setup'ları yap
      await ensureAdminPanels(client);

      console.log(`[guildCreate] ✅ ${guild.name} (${guild.id}) setup tamamlandı`);
    } catch (err) {
      console.error(`[guildCreate] Setup hatası (${guild.name}):`, err.message);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.guild) {
        const { isGuildAuthorized } = require("../services/guildAuthService");
        const authorized = await isGuildAuthorized(interaction.guild);
        if (!authorized) {
          return interaction.reply({ content: "❌ Bu sunucu yetkilendirilmemiştir. Bot bu sunucuda kullanılamaz.", ephemeral: true }).catch(() => { });
        }
      }
      // ── Anket Evet/Hayır butonu ───────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('survey_yes_') || interaction.customId?.startsWith('survey_no_'))) {
        await handleSurveyButton(interaction, client);
        return;
      }
      // ── Moderatör mülakat Evet/Hayır butonu ───────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('mod_interview_yes_') || interaction.customId?.startsWith('mod_interview_no_'))) {
        await handleInterviewButton(interaction, client);
        return;
      }
      // ── Koç butonları ────────────────────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('coach_')) {
        await handleCoachButton(interaction, client);
        return;
      }
      // ── DM Ticket kapat butonu ─────────────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('dm_close_')) {
        await handleDMCloseButton(interaction, client);
        return;
      }
      // ── DM Ticket Evet/Hayır butonu ────────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('dm_confirm_')) {
        await handleDMConfirmButton(interaction, client);
        return;
      }
      // ── Ban onayla/reddet butonu ───────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('ban_approve_') || interaction.customId?.startsWith('ban_reject_'))) {
        await handleBanButton(interaction, client);
        return;
      }
      // ── Warn/Mute butonu ──────────────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('warn_approve_') || interaction.customId?.startsWith('warn_ban_') || interaction.customId?.startsWith('warn_reject_'))) {
        await handleWarnButton(interaction, client);
        return;
      }
      // ── Reklam link butonu ────────────────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('ad_link_')) {
        await handleAdLinkButton(interaction, client);
        return;
      }
      // ── Reklam link modal submit ──────────────────────────────────────────
      if (interaction.isModalSubmit() && interaction.customId?.startsWith('ad_link_modal_')) {
        await handleAdLinkModal(interaction, client);
        return;
      }
      // ── Discord Sunucu Abuse Butonları ──────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith("disc_abuse_")) {
        await handleDiscordAbuseButton(interaction);
        return;
      }
      // ── Gece Otomatik Ban Geri Al Butonu ────────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith("night_unban_")) {
        await handleNightUnbanButton(interaction);
        return;
      }
      // ── Roblox Abuse Butonları ────────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith("rbx_abuse_demote_") || interaction.customId?.startsWith("rbx_abuse_ignore_"))) {
        await handleAbuseButton(interaction);
        return;
      }
      // ── Ban İtiraz Butonu (DM'den tıklanan) ────────────────────────────────
      if (interaction.isButton() && interaction.customId?.startsWith('ban_appeal_')) {
        await handleAppealButton(interaction);
        return;
      }
      // ── Ban İtiraz Karar Butonları (Onayla/Reddet) ─────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith('appeal_accept_') || interaction.customId?.startsWith('appeal_reject_'))) {
        await handleAppealDecisionButton(interaction, client);
        return;
      }
      // ── Ban İtiraz Modal Submit ─────────────────────────────────────────────
      if (interaction.isModalSubmit() && interaction.customId?.startsWith('ban_appeal_modal_')) {
        await handleAppealModalSubmit(interaction, client);
        return;
      }
      // ── Mod İşlem Onay/Red Butonları ────────────────────────────────────────
      if (interaction.isButton() && (interaction.customId?.startsWith("modact_approve_") || interaction.customId?.startsWith("modact_reject_"))) {
        await handleModActionApproval(interaction);
        return;
      }
      // ── Yetkililik Sınavı Butonları ─────────────────────────────────────────
      if (interaction.isButton() && interaction.customId === 'exam_start_trigger') {
        await handleStartTrigger(interaction);
        return;
      }
      if (interaction.isButton() && interaction.customId?.startsWith('exam_ans_')) {
        await handleAnswerInteraction(interaction, client);
        return;
      }

      // ── EkoCoin Mağazası Satın Alma (Select Menu) ───────────────────────────
      if (interaction.isStringSelectMenu() && interaction.customId === 'ekocoin_satin_al') {
        const p = await StaffProgress.findOne({ userId: interaction.user.id });
        if (!p) {
          return interaction.reply({ content: '❌ Kayıt bulunamadı.', ephemeral: true });
        }
        const item = interaction.values[0];
        let price = 0;
        let roleName = '';
        let successMessage = '';

        if (item === 'color_green') { price = 500; roleName = '- YEŞİL ROL RENGİ -'; successMessage = '🎨 Yeşil Rol Rengi satın alındı!'; }
        else if (item === 'color_red') { price = 500; roleName = '- KIRMIZI ROL RENGİ -'; successMessage = '🎨 Kırmızı Rol Rengi satın alındı!'; }
        else if (item === 'color_blue') { price = 500; roleName = '- MAVİ ROL RENGİ -'; successMessage = '🎨 Mavi Rol Rengi satın alındı!'; }
        else if (item === 'color_yellow') { price = 500; roleName = '- SARI ROL RENGİ -'; successMessage = '🎨 Sarı Rol Rengi satın alındı!'; }
        else if (item === 'color_purple') { price = 500; roleName = '- MOR ROL RENGİ -'; successMessage = '🎨 Mor Rol Rengi satın alındı!'; }
        else if (item === 'color_pink') { price = 500; roleName = '- PEMBE ROL RENGİ -'; successMessage = '🎨 Pembe Rol Rengi satın alındı!'; }
        else if (item === 'color_orange') { price = 500; roleName = '- TURUNCU ROL RENGİ -'; successMessage = '🎨 Turuncu Rol Rengi satın alındı!'; }
        else if (item === 'item_leave_1day' || item === 'ekstra_izin') { price = 800; successMessage = '🏖️ +1 Gün İzin Hakkı satın alındı!'; }

        if ((p.gamification?.ecoCoins || 0) < price) {
          return interaction.reply({ content: `❌ Yetersiz E.C.! (Gereken: ${price} E.C. - Sizin: ${p.gamification?.ecoCoins || 0} E.C.)`, ephemeral: true });
        }

        // Fiyatı Düş
        p.gamification.ecoCoins -= price;

        // Ödülü Ver
        if (item.startsWith('color_')) {
          const guild = interaction.client.guilds.cache.get(require('../../config').GUILD_ID);
          if (guild) {
            let colorRole = guild.roles.cache.find(r => r.name === roleName);
            if (!colorRole) {
              let roleColor = '#000000';
              if (item === 'color_green') roleColor = '#2ecc71';
              else if (item === 'color_red') roleColor = '#e74c3c';
              else if (item === 'color_blue') roleColor = '#3498db';
              else if (item === 'color_yellow') roleColor = '#f1c40f';
              else if (item === 'color_purple') roleColor = '#9b59b6';
              else if (item === 'color_pink') roleColor = '#ff9ff3';
              else if (item === 'color_orange') roleColor = '#e67e22';

              colorRole = await guild.roles.create({
                name: roleName,
                color: roleColor,
                reason: 'EkoCoin Mağazası - Renk Rolü Satın Alma'
              });
            }
            const member = await guild.members.fetch(interaction.user.id).catch(() => null);
            if (member && colorRole) {
              const existingColorRoles = member.roles.cache.filter(r => r.name.startsWith('- ') && r.name.endsWith(' RENGİ -'));
              for (const r of existingColorRoles.values()) {
                await member.roles.remove(r.id).catch(() => { });
              }
              await member.roles.add(colorRole.id).catch(() => { });
            }
          }
        } else if (item === 'item_leave_1day' || item === 'ekstra_izin') {
          p.stats.breakCredits = (p.stats.breakCredits || 0) + 1;
        }

        await p.save();

        let extraMsg = '';
        if (interaction.guild && interaction.guild.id === '1367646464804655104') {
          const uId = interaction.user.id;
          try {
            const mainGuild = await interaction.client.guilds.fetch('1367646464804655104').catch(() => null);
            if (mainGuild) {
              const memberToReward = await mainGuild.members.fetch(uId).catch(() => null);
              if (memberToReward) {
                let shopRole = mainGuild.roles.cache.find(r => r.name === '🛒 Mağaza Müdavimi');
                if (!shopRole) {
                  shopRole = await mainGuild.roles.create({
                    name: '🛒 Mağaza Müdavimi',
                    color: '#1abc9c',
                    hoist: false,
                    position: 1,
                    reason: 'Gizli Başarım Sistemi'
                  });
                }
                if (shopRole && !memberToReward.roles.cache.has(shopRole.id)) {
                  await memberToReward.roles.add(shopRole.id).catch(() => { });
                  memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Mağaza Müdavimi!**\nEkoCoin mağazasından ilk alışverişinizi başarıyla yaptınız ve `🛒 Mağaza Müdavimi` rolünü kazandınız!').catch(() => { });
                  extraMsg = '\n\n🛒 **Alışverişin ödüllendirildi! Mağaza Müdavimi gizli başarımını açtın, DM kutuna bak!**';
                }
              }
            }
          } catch (_) { }
        }

        return interaction.reply({ content: `✅ ${successMessage}${extraMsg}\n💰 Kalan Bakiye: ${p.gamification.ecoCoins} E.C.`, ephemeral: true });
      }
      // ── Roblox Etkileşimleri ──────────────────────────────────────────────
      if (
        (interaction.isStringSelectMenu() && (interaction.customId === "roblox_group_select" || interaction.customId.startsWith("roblox_rank_select"))) ||
        (interaction.isButton() && interaction.customId?.startsWith("rbx_btn_")) ||
        (interaction.isModalSubmit() && interaction.customId?.startsWith("rbx_mod_"))
      ) {
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
    const voiceResult = await handleVoiceButton(interaction);
    if (voiceResult !== null) return voiceResult;
    return handleButtonInteraction(interaction);
  }

  if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
    const voiceSel = await handleVoiceSelect(interaction);
    if (voiceSel !== null) return voiceSel;
    return handleSelectInteraction(interaction);
  }

  if (interaction.isModalSubmit()) {
    const voiceModal = await handleVoiceModal(interaction);
    if (voiceModal !== null) return voiceModal;
    return handleModalSubmit(interaction);
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "panel") {
      const { handlePanelSlashCommand } = require("./panelCommandHandler");
      return handlePanelSlashCommand(interaction);
    }

    // ── Gizli Başarım: Botun Kankası ──
    if (interaction.guild && interaction.guild.id === '1367646464804655104') {
      const uId = interaction.user.id;
      let cmds = botFriendTracker.get(uId) || 0;
      cmds++;
      botFriendTracker.set(uId, cmds);

      if (cmds === 100) {
        try {
          const mainGuild = await interaction.client.guilds.fetch('1367646464804655104').catch(() => null);
          if (mainGuild) {
            const memberToReward = await mainGuild.members.fetch(uId).catch(() => null);
            if (memberToReward) {
              let botFriendRole = mainGuild.roles.cache.find(r => r.name === '🤖 Botun Kankası');
              if (!botFriendRole) {
                botFriendRole = await mainGuild.roles.create({
                  name: '🤖 Botun Kankası',
                  color: '#1abc9c', // Turkuaz
                  hoist: false,
                  position: 1,
                  reason: 'Gizli Başarım Sistemi'
                });
              }
              if (botFriendRole && !memberToReward.roles.cache.has(botFriendRole.id)) {
                await memberToReward.roles.add(botFriendRole.id).catch(() => { });
                memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Botun Kankası!**\nBotun komutlarını tam 100 kez kullanarak botla en çok ilgilenenlerden biri oldun ve `🤖 Botun Kankası` rolünü kazandın!').catch(() => { });
              }
            }
          }
        } catch (_) { }
      }
    }

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
