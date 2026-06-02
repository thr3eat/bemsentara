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
    const { startCleanupScheduler } = require("../services/ticketCleanup");
    await ensureVerifyHelpMessage(client);
    await ensureVoicePanelMessage(client);
    startCleanupScheduler();
  });

  // ── Sunucuya katılan üyeye doğrulanmamış rolü ver ──────────────────────────
  client.on("guildMemberAdd", async (member) => {
    try {
      const { TARGET_GUILD_ID, UNVERIFIED_ROLE_ID } = require("../../config");
      if (member.guild.id !== TARGET_GUILD_ID) return;
      if (!UNVERIFIED_ROLE_ID) return;
      if (member.user.bot) return;

      const role = member.guild.roles.cache.get(UNVERIFIED_ROLE_ID);
      if (!role) {
        console.warn(`[guildMemberAdd] Doğrulanmamış rol bulunamadı: ${UNVERIFIED_ROLE_ID}`);
        return;
      }

      await member.roles.add(role, "Yeni üye — doğrulanmamış");
      console.log(`[guildMemberAdd] ${member.user.tag} → doğrulanmamış rolü verildi`);
    } catch (err) {
      console.error("[guildMemberAdd] Rol verilemedi:", err.message);
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    // ── Ticket AI: kullanıcı mesajını işle ──────────────────────────────────
    try {
      const { handleUserMessage } = require('../services/ticketAI');
      const handled = await handleUserMessage(message, client);
      if (handled) return; // AI yanıtladı, devam etme
    } catch (aiErr) {
      console.warn('[messageCreate] AI handler hata:', aiErr.message);
    }

    if (message.content === "!tumrollerveidleriveisimleri") {
      const roles = message.guild.roles.cache.sort((a, b) => b.position - a.position);
      let replyText = "**Sunucudaki Rollerdir:**\n\n";
      
      roles.forEach((role) => {
        replyText += `**İsim:** ${role.name} | **ID:** ${role.id}\n`;
      });

      if (replyText.length > 2000) {
        const chunks = replyText.match(/[\s\S]{1,1999}/g) || [];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(replyText);
      }
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
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
