const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Ticket = require("../../models/Ticket");
const User = require("../../models/User");
const { getSupportMenuEmbed, getSupportButton } = require("../embeds");
const { SUPPORT_CATEGORIES, BASE_URL } = require("../../config");

async function handleSlashCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;
  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await User.findOne({ discordId: interaction.user.id }).catch(err => {
      console.warn('[slashHandler] User lookup error:', err.message);
      return null;
    });

    if (commandName === "support") {
      if (!interaction.guild) {
        return interaction.editReply({ content: "❌ Bu komut sadece sunucu'da çalışır" });
      }

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({ content: "❌ Bunu yapmaya yetkili değilsiniz" });
      }

      const embed = getSupportMenuEmbed();
      const button = getSupportButton();
      await interaction.channel.send({ embeds: [embed], components: [button] });
      return interaction.editReply({ content: "✅ Destek menüsü gönderildi" });
    }

    if (commandName === "mytickets") {
      const tickets = await Ticket.find({ userId: interaction.user.id, status: "open" });
      if (tickets.length === 0) {
        return interaction.editReply({ content: "📭 Açık ticket'ınız yok" });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎫 Açık Ticket'larınız")
        .setColor(0x7c6af7)
        .setDescription(
          tickets
            .map(
              (t) =>
                `**${t.ticketId}** - ${t.subject}\n Kategori: ${SUPPORT_CATEGORIES[t.category].name} | Durum: ${t.status}`
            )
            .join("\n\n")
        )
        .setFooter({ text: "Sentara Support" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "closeticket") {
      const reason = interaction.options.getString("reason") || "Belirtilmedi";
      const ticket = await Ticket.findOne({ userId: interaction.user.id, status: "open" }).catch(err => {
        console.error('[slashHandler] Ticket lookup error:', err.message);
        return null;
      });

      if (!ticket) {
        return interaction.editReply({ content: "❌ Açık ticket'ınız yok" });
      }

      ticket.status = "closed";
      ticket.closedAt = new Date();
      ticket.closeReason = reason;
      ticket.closedBy = interaction.user.id;
      ticket.closedByName = interaction.user.username;
      await ticket.save().catch(err => {
        console.error('[slashHandler] Ticket save error:', err.message);
      });

      // Kanal mesajlarını logla
      const { logTicketClosed, logTicketMessages } = require("../services/ticketLog");
      const { TARGET_GUILD_ID } = require("../../config");
      const guildId = ticket.guildId || TARGET_GUILD_ID;
      
      const guild = await interaction.client.guilds.fetch(guildId).catch(err => {
        console.warn(`[slashHandler] Guild ${guildId} not found:`, err.code);
        return null;
      });
      
      if (!guild) {
        console.error(`[slashHandler] Cannot access guild ${guildId} to log ticket`);
      } else {
        const channel = await guild.channels.fetch(ticket.channelId).catch(err => {
          console.warn(`[slashHandler] Channel ${ticket.channelId} not found:`, err.code);
          return null;
        });

        if (channel) {
          await logTicketMessages(channel, ticket).catch(err => {
            console.error('[slashHandler] logTicketMessages error:', err.message);
          });
        }
      }

      logTicketClosed(ticket, {
        closedBy: interaction.user.id,
        closedByName: interaction.user.username,
        reason,
        source: "/closeticket komutu",
      });

      // ── Moderatörse "aferin!" mesajı gönder ───────────────────────────────────
      const isModerator = interaction.member?.permissions.has('ManageMessages') ||
                          interaction.member?.permissions.has('ModerateMembers');
      
      if (isModerator && interaction.user.id !== ticket.userId) {
        try {
          const { sendModerationPraise } = require("../services/ticketAI");
          await sendModerationPraise(interaction.user.id, ticket, interaction.client);
        } catch (_) {}
      }

      // Ticket sahibine DM gönder
      try {
        const { buildReopenAndRateRow } = require("../embeds");
        const ticketOwner = await interaction.client.users.fetch(ticket.userId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🔒 Ticket'ınız Kapatıldı")
          .setDescription(
            `Ticket'ınız **${interaction.user.username}** adlı kişi tarafından kapatıldı.\n\n` +
              `**Sebep:** ${reason}\n\n` +
              `Ticket'ı yeniden açmak veya destek ekibini değerlendirmek için aşağıdaki butonları kullanabilirsiniz.`
          )
          .addFields(
            { name: "🎫 Ticket ID", value: `\`${ticket.ticketId}\``, inline: true },
            { name: "📋 Konu", value: ticket.subject, inline: true }
          )
          .setFooter({ text: "Sentara Support • Gizlilik politikamız gereği değerlendirme notunuz anonim tutulur." })
          .setTimestamp();

        const dmButtons = buildReopenAndRateRow(ticket.ticketId);
        await ticketOwner.send({ embeds: [dmEmbed], components: [dmButtons] });
      } catch (dmErr) {
        console.warn("[closeticket] Kullanıcıya DM gönderilemedi:", dmErr.message);
      }

      if (channel) {
        const closeEmbed = new EmbedBuilder()
          .setTitle("🔒 Ticket Kapatıldı")
          .setDescription(
            `**Sebep:** ${reason}\n\n` +
            `⏳ Bu kanal **2 dakika** içinde yeniden açılmazsa otomatik silinecektir.`
          )
          .setColor(0xed4245)
          .setTimestamp();
        await channel.send({ embeds: [closeEmbed] });
        await channel.permissionOverwrites.edit(ticket.userId, {
          ViewChannel: false,
          SendMessages: false,
        });
      }

      // 2 dakika sonra kanal silinmek üzere kuyruğa al
      const { scheduleTicketDeletion } = require("../services/ticketCleanup");
      scheduleTicketDeletion(ticket.ticketId);

      return interaction.editReply({ content: "✅ Ticket kapatıldı" });
    }

    if (commandName === "profile") {
      if (!user) {
        const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
        return interaction.editReply({ content: `❌ Henüz yetkilendirmediniz. [Yetkilendirin](${authUrl})` });
      }

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${user.robloxUsername || user.discordUsername}`)
        .setColor(user.profileColor || 0x7c6af7)
        .addFields(
          {
            name: "🎮 Roblox",
            value: `**Username:** ${user.robloxUsername || "Yok"}\n**ID:** ${user.robloxId || "Yok"}`,
            inline: false,
          },
          {
            name: "💬 Discord",
            value: `**Username:** ${user.discordUsername}\n**ID:** ${user.discordId}`,
            inline: false,
          },
          {
            name: "🎖️ Grup Rolü",
            value: user.groupRole?.roleName || "Rolu yok",
            inline: true,
          },
          {
            name: "📅 Katılım",
            value: `<t:${Math.floor(user.joinedAt / 1000)}:R>`,
            inline: true,
          }
        )
        .setTimestamp();

      if (user.profileBio) {
        embed.addFields({ name: "📝 Hakkında", value: user.profileBio, inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "authorize") {
      const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
      const embed = new EmbedBuilder()
        .setTitle("🔐 Hesabınızı Yetkilendirin")
        .setDescription(`[Tıklayın ve Roblox hesabınızla giriş yapın](${authUrl})`)
        .setColor(0x7c6af7);

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "verify") {
      const { handleVerify } = require("./roleHandler");
      const groupId = interaction.options.getNumber("grupid");
      return handleVerify(interaction, groupId);
    }

    // Removed first update handler - using the corrected one below with proper guild detection

    if (commandName === "postrules") {
      // Admin check
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: "❌ Bu komutu kullanmaya yetkili değilsiniz" });
      }

      try {
        const { TARGET_GUILD_ID, TMT_GUILD_ID } = require("../../config");
        
        if (interaction.guildId === TMT_GUILD_ID) {
          const { postTMTRules } = require("../services/tmtRulesService");
          const success = await postTMTRules(interaction.client);
          
          if (success) {
            return interaction.editReply({ content: "✅ TMT kuralları başarıyla gönderildi" });
          } else {
            return interaction.editReply({ content: "❌ TMT kuralları gönderilirken bir hata oluştu" });
          }
        } else {
          return interaction.editReply({ content: "❌ Bu komut sadece TMT sunucusunda kullanılabilir" });
        }
      } catch (error) {
        console.error("[postrules] Hata:", error);
        return interaction.editReply({ content: `❌ Hata: ${error.message}` });
      }
    }

    if (commandName === "verify") {
      try {
        const { TARGET_GUILD_ID, TMT_GUILD_ID } = require("../../config");
        const guildId = interaction.guildId;
        
        if (!guildId) {
          return interaction.editReply({ content: "❌ Bu komut sunucuda kullanılmalıdır" });
        }

        // Get appropriate guild
        const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
          return interaction.editReply({ content: "❌ Sunucu bulunamadı" });
        }

        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) {
          return interaction.editReply({ content: "❌ Bu sunucuda bulunmuyorsunuz" });
        }

        // Find user in database
        const User = require("../../models/User");
        const dbUser = await User.findOne({ discordId: interaction.user.id });

        if (!dbUser || !dbUser.robloxId) {
          return interaction.editReply({ 
            content: "❌ Roblox hesabınızı yetkilendirmediniz. `/authorize` komutunu kullanın" 
          });
        }

        // Determine which server and sync accordingly
        let success = false;
        if (guildId === TMT_GUILD_ID) {
          const { syncTMTRoles } = require("../services/tmtRoleSyncService");
          success = await syncTMTRoles(
            interaction.client, 
            interaction.user.id, 
            dbUser.robloxId,
            member
          );
        } else {
          const { syncMemberRoles } = require("../services/roleSyncService");
          const result = await syncMemberRoles(member, dbUser.robloxId);
          success = result.success;
        }

        if (success) {
          return interaction.editReply({ 
            content: "✅ Rolleriniz senkronize edildi" 
          });
        } else {
          return interaction.editReply({ 
            content: "❌ Rol senkronizasyonunda bir hata oluştu" 
          });
        }
      } catch (error) {
        console.error("[verify] Hata:", error);
        return interaction.editReply({ content: `❌ Hata: ${error.message}` });
      }
    }

    if (commandName === "update") {
      // Admin check
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: "❌ Bu komutu kullanmaya yetkili değilsiniz" });
      }

      try {
        const { TARGET_GUILD_ID, TMT_GUILD_ID } = require("../../config");
        const guildId = String(interaction.guildId); // Convert to string for comparison
        const targetUser = interaction.options.getUser("user");
        
        console.log(`[Update Command] Guild: ${guildId}, TMT: ${TMT_GUILD_ID}, BEM: ${TARGET_GUILD_ID}`);
        
        let userIds = [];
        if (targetUser) {
          userIds = [targetUser.id];
          await interaction.editReply({ 
            content: `⏳ ${targetUser.username} için roller güncelleniyor...` 
          });
        } else {
          await interaction.editReply({ 
            content: "⏳ Tüm kullanıcılar için roller güncelleniyor... (Bu birkaç dakika alabilir)" 
          });
        }

        let updated = 0;
        if (guildId === TMT_GUILD_ID) {
          console.log(`[Update Command] TMT Update başlatılıyor...`);
          // TMT Update Logic
          const { verifyAllTMTRoles } = require("../services/tmtRoleSyncService");
          updated = await verifyAllTMTRoles(interaction.client, userIds);
        } else if (guildId === TARGET_GUILD_ID) {
          console.log(`[Update Command] BEM Update başlatılıyor...`);
          // BEM Update Logic
          const { handleUpdate } = require("./roleHandler");
          updated = await handleUpdate(interaction, null);
        } else {
          return interaction.editReply({ 
            content: `❌ Sunucu tanınmadı. TMT: ${guildId === TMT_GUILD_ID}, BEM: ${guildId === TARGET_GUILD_ID}` 
          });
        }
        
        if (targetUser) {
          return interaction.editReply({ 
            content: `✅ ${targetUser.username} için roller güncellendi` 
          });
        } else {
          return interaction.editReply({ 
            content: `✅ Roller güncellendi - ${updated} üye sync edildi` 
          });
        }
      } catch (error) {
        console.error("[update] Hata:", error);
        return interaction.editReply({ content: `❌ Hata: ${error.message}` });
      }
    }
  } catch (err) {
    console.error(`[${commandName}] Hata:`, err);
    return interaction.editReply({ content: `❌ Hata: ${err.message}` });
  }

  return null;
}

module.exports = { handleSlashCommand };
