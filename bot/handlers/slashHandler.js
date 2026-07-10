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
        const { TARGET_GUILD_ID, TMT_GUILD_ID, ALLIED_GUILD_ID, GUILD2_ID } = require("../../config");
        // Normalize guild IDs for comparison (ensure they're strings and trimmed)
        const guildId = String(interaction.guildId).trim();
        const normalizedTMT = String(TMT_GUILD_ID).trim();
        const normalizedBEM = String(TARGET_GUILD_ID).trim();
        const normalizedEKO = String(GUILD2_ID).trim();
        const normalizedAllied = String(ALLIED_GUILD_ID).trim();
        
        console.log(`[verify] Sunucu Kontrolü:`);
        console.log(`  Mevcut Guild ID: "${guildId}"`);
        console.log(`  Allied ID: "${normalizedAllied}" ${guildId === normalizedAllied ? '✓ EŞLEŞTI' : ''}`);
        console.log(`  TMT ID: "${normalizedTMT}" ${guildId === normalizedTMT ? '✓ EŞLEŞTI' : ''}`);
        console.log(`  BEM ID: "${normalizedBEM}" ${guildId === normalizedBEM ? '✓ EŞLEŞTI' : ''}`);
        console.log(`  EKO ID: "${normalizedEKO}" ${guildId === normalizedEKO ? '✓ EŞLEŞTI' : ''}`);
        
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
        const dbUser = await User.findOne({ discordId: interaction.user.id });

        if (!dbUser) {
          console.log(`[verify] User ${interaction.user.id} not in database`);
          return interaction.editReply({ 
            content: "❌ Roblox hesabınızı yetkilendirmediniz. `/authorize` komutunu kullanın" 
          });
        }

        if (!dbUser.robloxId) {
          console.log(`[verify] User ${interaction.user.id} has no robloxId`);
          return interaction.editReply({ 
            content: "❌ Roblox hesabınızı yetkilendirmediniz. `/authorize` komutunu kullanın" 
          });
        }

        console.log(`[verify] Kullanıcı bulundu. Discord: ${interaction.user.id}, Roblox: ${dbUser.robloxId}`);

        // Determine which server and sync accordingly
        let success = false;
        if (guildId === normalizedAllied) {
          console.log(`[verify] ✓ Müttefik Orduları algılandı - Allied sync başlatılıyor`);
          const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
          const result = await syncAlliedRoles(interaction.client, interaction.user.id, parseInt(dbUser.robloxId, 10), guild);
          success = result.success;
          console.log(`[verify] Allied sync sonucu: ${success}`);
        } else if (guildId === normalizedTMT) {
          console.log(`[verify] ✓ TMT algılandı - TMT sync başlatılıyor`);
          const { syncTMTRoles } = require("../services/tmtRoleSyncService");
          const result = await syncTMTRoles(
            interaction.client, 
            interaction.user.id, 
            parseInt(dbUser.robloxId, 10),
            member
          );
          success = result?.success || false;
          console.log(`[verify] TMT sync sonucu: ${success}`);
        } else if (guildId === normalizedBEM) {
          console.log(`[verify] ✓ BEM algılandı - BEM sync başlatılıyor`);
          const { syncMemberRoles } = require("../services/roleSyncService");
          const result = await syncMemberRoles(guild, member, parseInt(dbUser.robloxId, 10), dbUser.robloxUsername);
          success = result?.success || false;
          console.log(`[verify] BEM sync sonucu: ${success}`);
        } else if (guildId === normalizedEKO) {
          console.log(`[verify] ✓ EKOYILDIZ algılandı - Allied sync başlatılıyor`);
          const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
          const result = await syncAlliedRoles(interaction.client, interaction.user.id, parseInt(dbUser.robloxId, 10), guild);
          success = result?.success || false;
          console.log(`[verify] EKOYILDIZ sync sonucu: ${success}`);
        } else {
          // Check if it's a branch setup sunucusu
          const ServerSetup = require("../../models/ServerSetup");
          const setupDoc = await ServerSetup.findOne({ guildId, status: "active" });
          if (setupDoc) {
            console.log(`[verify] ✓ Kurulum yapılmış branch sunucu algılandı - Sync başlatılıyor`);
            const { runSyncForMember } = require("./roleHandler");
            await runSyncForMember(interaction, { ephemeral: true, commandName: "verify" });
            return;
          }

          console.warn(`[verify] ✗ Sunucu tanınmadı! Guild ID: "${guildId}"`);
          return interaction.editReply({ 
            content: `❌ Sunucu tanınmadı (Guild: ${guildId})` 
          });
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
        const { TARGET_GUILD_ID, TMT_GUILD_ID, ALLIED_GUILD_ID, GUILD2_ID } = require("../../config");
        // Normalize guild IDs for comparison
        const guildId = String(interaction.guildId).trim();
        const normalizedTMT = String(TMT_GUILD_ID).trim();
        const normalizedBEM = String(TARGET_GUILD_ID).trim();
        const normalizedEKO = String(GUILD2_ID).trim();
        const normalizedAllied = String(ALLIED_GUILD_ID).trim();
        const targetUser = interaction.options.getUser("user");
        
        console.log(`[Update Command] Sunucu Kontrolü:`);
        console.log(`  Mevcut Guild ID: "${guildId}"`);
        console.log(`  Allied ID: "${normalizedAllied}" ${guildId === normalizedAllied ? '✓ EŞLEŞTI' : ''}`);
        console.log(`  TMT ID: "${normalizedTMT}" ${guildId === normalizedTMT ? '✓ EŞLEŞTI' : ''}`);
        console.log(`  BEM ID: "${normalizedBEM}" ${guildId === normalizedBEM ? '✓ EŞLEŞTI' : ''}`);
        console.log(`  EKO ID: "${normalizedEKO}" ${guildId === normalizedEKO ? '✓ EŞLEŞTI' : ''}`);
        
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
        if (guildId === normalizedAllied) {
          console.log(`[Update Command] ✓ Müttefik Orduları sunucusu algılandı - Allied sync başlatılıyor...`);
          const { verifyAllAlliedRoles } = require("../services/alliedRoleSyncService");
          updated = await verifyAllAlliedRoles(interaction.client, userIds);
          console.log(`[Update Command] Allied sync tamamlandı - ${updated} üye güncellendi`);
        } else if (guildId === normalizedTMT) {
          console.log(`[Update Command] ✓ TMT sunucusu algılandı - TMT sync başlatılıyor...`);
          // TMT Update Logic
          const { verifyAllTMTRoles } = require("../services/tmtRoleSyncService");
          updated = await verifyAllTMTRoles(interaction.client, userIds);
          console.log(`[Update Command] TMT sync tamamlandı - ${updated} üye güncellendi`);
        } else if (guildId === normalizedBEM) {
          console.log(`[Update Command] ✓ BEM sunucusu algılandı - BEM sync başlatılıyor...`);
          // BEM Update Logic
          const { handleUpdate } = require("./roleHandler");
          updated = await handleUpdate(interaction, null);
          console.log(`[Update Command] BEM sync tamamlandı - ${updated} üye güncellendi`);
        } else if (guildId === normalizedEKO) {
          console.log(`[Update Command] ✓ EKOYILDIZ sunucusu algılandı - Allied sync başlatılıyor...`);
          const { verifyAllAlliedRoles } = require("../services/alliedRoleSyncService");
          updated = await verifyAllAlliedRoles(interaction.client, userIds);
          console.log(`[Update Command] EKOYILDIZ sync tamamlandı - ${updated} üye güncellendi`);
        } else {
          console.error(`[Update Command] ✗ Sunucu tanınmadı! Guild ID: "${guildId}"`);
          return interaction.editReply({ 
            content: `❌ Sunucu tanınmadı. Guild ID: ${guildId}` 
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

    if (commandName === "ekobang") {
      if (interaction.user.id !== "1031620522406072350") {
        return interaction.editReply({ content: "❌ Bu komutu kullanmaya yetkiniz yok!" });
      }

      const targetUser = interaction.options.getUser("kullanici");
      if (!targetUser) {
        return interaction.editReply({ content: "❌ Lütfen geçerli bir kullanıcı belirtin." });
      }

      const dbUser = await User.findOne({ discordId: targetUser.id }) || new User({ discordId: targetUser.id, discordUsername: targetUser.username });
      
      const savedRoles = dbUser.bangRoles || {};
      const guildsProcessed = [];
      const botClient = interaction.client;

      const getNormalMemberRole = (guild) => {
        const { TMT_GUILD_ID, TMT_VERIFIED_ROLE_ID, TARGET_GUILD_ID, ALLIED_GUILD_ID } = require("../../config");
        
        if (guild.id === TMT_GUILD_ID) {
          const role = guild.roles.cache.get(TMT_VERIFIED_ROLE_ID);
          if (role) return role;
        }
        
        if (guild.id === TARGET_GUILD_ID) {
          const role = guild.roles.cache.find(r => r.name === "Teşkilat Personeli") || guild.roles.cache.get("1505511498095788063");
          if (role) return role;
        }
        
        if (guild.id === ALLIED_GUILD_ID) {
          const role = guild.roles.cache.get("1483483253720616971");
          if (role) return role;
        }
        
        const namesToSearch = ["üye", "member", "personel", "onaylı", "onaylanmış hesap", "kullanıcı"];
        for (const name of namesToSearch) {
          const role = guild.roles.cache.find(r => r.name.toLowerCase() === name && !r.managed);
          if (role) return role;
        }
        
        const sortedRoles = Array.from(guild.roles.cache.values())
          .filter(r => r.id !== guild.id && !r.managed)
          .sort((a, b) => a.position - b.position);
        return sortedRoles[0] || null;
      };

      for (const guild of botClient.guilds.cache.values()) {
        try {
          const member = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!member) continue;

          const editableRoles = member.roles.cache.filter(role => 
            role.id !== guild.id &&
            !role.managed &&
            role.editable
          );

          if (editableRoles.size > 0) {
            savedRoles[guild.id] = Array.from(editableRoles.keys());
            
            await member.roles.remove(Array.from(editableRoles.keys()), "ekobang command execution").catch(err => {
              console.error(`Failed to remove roles in guild ${guild.name}:`, err.message);
            });
          }

          const basicRole = getNormalMemberRole(guild);
          if (basicRole) {
            await member.roles.add(basicRole, "ekobang basic role assignment").catch(err => {
              console.error(`Failed to add basic role in guild ${guild.name}:`, err.message);
            });
          }

          guildsProcessed.push(guild.name);
        } catch (guildErr) {
          console.error(`Error processing guild ${guild.name} in ekobang:`, guildErr.message);
        }
      }

      dbUser.bangRoles = savedRoles;
      await dbUser.save();

      if (guildsProcessed.length === 0) {
        return interaction.editReply({ content: `❌ ${targetUser.username} hiçbir ortak sunucuda bulunamadı.` });
      }

      return interaction.editReply({
        content: `✅ **${targetUser.username}** kullanıcısının rolleri sıfırlandı ve en az yetkili normal üye rolü verildi.\n**İşlem yapılan sunucular:** ${guildsProcessed.join(", ")}`
      });
    }

    if (commandName === "mod-alim") {
      // Admin/Manager yetki kontrolü
      const isModerator = interaction.member?.permissions.has(PermissionFlagsBits.ManageMessages) ||
                          interaction.member?.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                          interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
      
      if (!isModerator) {
        return interaction.editReply({
          content: "❌ Bu komutu kullanmaya yetkiniz bulunmamaktadır. Sadece yöneticiler ve moderatörler kullanabilir!"
        });
      }

      const targetUser = interaction.options.getUser("kullanici");
      if (!targetUser) {
        return interaction.editReply({ content: "❌ Lütfen geçerli bir kullanıcı belirtin." });
      }

      try {
        const { startModInterview } = require("../services/modInterview");
        const adminId = interaction.user.id;
        const success = await startModInterview(targetUser, adminId, interaction.guildId, interaction.client);
        
        if (success) {
          return interaction.editReply({
            content: `✅ **${targetUser.username}** kullanıcısına MOD-ALIM mülakat daveti başarıyla gönderildi!`
          });
        } else {
          return interaction.editReply({
            content: `❌ **${targetUser.username}** kullanıcısına DM gönderilemedi. DM'ler kapalı olabilir.`
          });
        }
      } catch (err) {
        console.error('[mod-alim command] Hata:', err.message);
        return interaction.editReply({
          content: `❌ Mülakat daveti gönderilemedi: ${err.message}`
        });
      }
    }

    if (commandName === "ekobangerial") {
      if (interaction.user.id !== "1031620522406072350") {
        return interaction.editReply({ content: "❌ Bu komutu kullanmaya yetkiniz yok!" });
      }

      const targetUser = interaction.options.getUser("kullanici");
      if (!targetUser) {
        return interaction.editReply({ content: "❌ Lütfen geçerli bir kullanıcı belirtin." });
      }

      const dbUser = await User.findOne({ discordId: targetUser.id });
      if (!dbUser || !dbUser.bangRoles || Object.keys(dbUser.bangRoles).length === 0) {
        return interaction.editReply({ content: `❌ **${targetUser.username}** için kayıtlı eski rol bilgisi bulunamadı.` });
      }

      const savedRoles = dbUser.bangRoles;
      const guildsRestored = [];
      const botClient = interaction.client;

      for (const [guildId, roleIds] of Object.entries(savedRoles)) {
        try {
          const guild = await botClient.guilds.fetch(guildId).catch(() => null);
          if (!guild) continue;

          const member = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!member) continue;

          const toAdd = [];
          for (const roleId of roleIds) {
            const role = guild.roles.cache.get(roleId);
            if (role && role.editable) {
              toAdd.push(roleId);
            }
          }

          if (toAdd.length > 0) {
            await member.roles.add(toAdd, "ekobangerial command execution").catch(err => {
              console.error(`Failed to restore roles in guild ${guild.name}:`, err.message);
            });
            guildsRestored.push(guild.name);
          }
        } catch (guildErr) {
          console.error(`Error restoring guild ${guildId} in ekobangerial:`, guildErr.message);
        }
      }

      dbUser.bangRoles = {};
      await dbUser.save();

      if (guildsRestored.length === 0) {
        return interaction.editReply({ content: `❌ Roller iade edilemedi (kullanıcı sunuculardan çıkmış olabilir veya roller yönetilemez durumda).` });
      }

      return interaction.editReply({
        content: `✅ **${targetUser.username}** kullanıcısının eski rolleri başarıyla iade edildi.\n**Geri yüklenen sunucular:** ${guildsRestored.join(", ")}`
      });
    }

    if (commandName === "grupcekeko") {
      if (interaction.user.id !== "1031620522406072350") {
        return interaction.editReply({ content: "❌ Bu komutu kullanmaya yetkiniz yok!" });
      }

      const username = interaction.options.getString("username");
      if (!username) {
        return interaction.editReply({ content: "❌ Lütfen bir Roblox kullanıcı adı girin." });
      }

      const noblox = require("noblox.js");

      // Roblox kullanıcı adından ID'yi bul
      let robloxUserId;
      try {
        robloxUserId = await noblox.getIdFromUsername(username);
      } catch (err) {
        return interaction.editReply({ content: `❌ Roblox kullanıcısı **${username}** bulunamadı.` });
      }

      if (!robloxUserId) {
        return interaction.editReply({ content: `❌ Roblox kullanıcısı **${username}** bulunamadı.` });
      }

      await interaction.editReply({ content: `⏳ **${username}** (ID: ${robloxUserId}) için yetkili olunan tüm gruplarda rütbe indirme işlemi başlatılıyor...` });

      // Botun (Token) Roblox ID'sini ve üye olduğu grupları çekelim
      let botRobloxId = null;
      try {
        const botUser = await noblox.getAuthenticatedUser();
        botRobloxId = botUser.id || botUser.userId || botUser.UserID;
      } catch (authErr) {
        console.error("[grupcekeko] Bot authenticated user fetch error:", authErr.message);
      }

      if (!botRobloxId) {
        return interaction.editReply({ content: "❌ Bot Roblox hesabına erişilemedi. Cookie/Token geçerliliğini kontrol edin." });
      }

      let botGroups = [];
      try {
        botGroups = await noblox.getGroups(botRobloxId);
      } catch (groupsErr) {
        console.error("[grupcekeko] Bot groups fetch error:", groupsErr.message);
        return interaction.editReply({ content: `❌ Botun üye olduğu gruplar çekilemedi: ${groupsErr.message}` });
      }

      // Kullanıcının üye olduğu tüm grupları çekelim
      let targetGroups = [];
      try {
        targetGroups = await noblox.getGroups(robloxUserId);
      } catch (targetGroupsErr) {
        console.error("[grupcekeko] Target groups fetch error:", targetGroupsErr.message);
        return interaction.editReply({ content: `❌ Hedef kullanıcının üye olduğu gruplar çekilemedi: ${targetGroupsErr.message}` });
      }

      // Ortak olan ve botun yetkili olduğu (Rank > 1) grupları filtreleyelim
      const groupsToProcess = [];
      for (const tGroup of targetGroups) {
        const matchingBotGroup = botGroups.find(bg => bg.Id === tGroup.Id);
        // Eğer bot bu grupta yetkili rütbedeyse (Rank > 1) ekle
        if (matchingBotGroup && matchingBotGroup.Rank > 1) {
          groupsToProcess.push({
            Id: tGroup.Id,
            Name: tGroup.Name,
            rankInGroup: tGroup.Rank,
            roleName: tGroup.Role
          });
        }
      }

      if (groupsToProcess.length === 0) {
        return interaction.editReply({ content: "❌ Hedef kullanıcının bulunduğu ve botun yetkili olduğu ortak bir grup bulunamadı." });
      }

      const savedGroupRanks = {}; // { groupId: { oldRank, oldRoleName } }
      const groupsProcessed = [];
      const groupsFailed = [];

      for (const group of groupsToProcess) {
        const groupId = group.Id;
        const groupName = group.Name;
        const rankInGroup = group.rankInGroup;
        const currentRoleName = group.roleName;

        try {
          // Grubun tüm rollerini al
          const roles = await noblox.getRoles(groupId);
          
          // En düşük rütbeyi bul (rank > 0, yani Guest hariç)
          const lowest = roles
            .filter(r => r.rank > 0)
            .sort((a, b) => a.rank - b.rank)[0];

          if (!lowest) continue;

          // Zaten en düşükteyse (veya hedeflenenden daha düşükse) atla
          // Öncelikle rank 1 yapmaya çalışacağız, o yüzden hedefimiz genelde rank 1
          let targetRank = 1;
          let targetRole = roles.find(r => r.rank === 1);
          if (!targetRole) {
            targetRole = lowest;
            targetRank = lowest.rank;
          }

          if (rankInGroup === targetRank) {
            groupsProcessed.push(`${groupName} (zaten hedeflenen en düşük rütbede)`);
            continue;
          }

          // Eski rütbeyi kaydet
          savedGroupRanks[groupId] = {
            oldRank: rankInGroup,
            oldRoleName: currentRoleName || "Bilinmeyen",
            oldRoleId: rankInGroup
          };

          // Rütbe değiştirmeyi dene: Önce hedef (genelde rank 1)
          let success = false;
          try {
            await noblox.setRank({ group: groupId, target: robloxUserId, rank: targetRank });
            groupsProcessed.push(`${groupName} (${currentRoleName || rankInGroup} → ${targetRole?.name || targetRank})`);
            success = true;
          } catch (err) {
            console.warn(`[grupcekeko] ${groupName} grubunda rank ${targetRank} yapılamadı, rank 2 deneniyor:`, err.message);
            // 1 olmazsa 2 rankına koysun
            const rank2Role = roles.find(r => r.rank === 2);
            if (rank2Role && rankInGroup !== 2) {
              try {
                await noblox.setRank({ group: groupId, target: robloxUserId, rank: 2 });
                groupsProcessed.push(`${groupName} (${currentRoleName || rankInGroup} → ${rank2Role.name})`);
                success = true;
              } catch (err2) {
                console.error(`[grupcekeko] ${groupName} grubunda rank 2 de başarısız oldu:`, err2.message);
                groupsFailed.push(`${groupName}: ${err2.message}`);
              }
            } else {
              groupsFailed.push(`${groupName}: ${err.message}`);
            }
          }

          // Rate limit koruması
          await new Promise(r => setTimeout(r, 500));
        } catch (groupErr) {
          console.error(`[grupcekeko] Grup ${groupName} (${groupId}) hatası:`, groupErr.message);
          groupsFailed.push(`${groupName}: ${groupErr.message}`);
        }
      }

      // Veritabanına kaydet (User model üzerinde)
      try {
        const dbUser = await User.findOne({ robloxId: String(robloxUserId) }) || new User({ robloxId: String(robloxUserId), robloxUsername: username, discordUsername: username });
        dbUser.grupCekekoRanks = savedGroupRanks;
        dbUser.grupCekekoUsername = username;
        dbUser.grupCekekoRobloxId = robloxUserId;
        await dbUser.save();
      } catch (saveErr) {
        console.error("[grupcekeko] Veritabanı kayıt hatası:", saveErr.message);
      }

      if (groupsProcessed.length === 0 && groupsFailed.length === 0) {
        return interaction.editReply({ content: `❌ **${username}** botun yetkili olduğu hiçbir grupta bulunamadı.` });
      }

      let resultMsg = `✅ **${username}** (ID: ${robloxUserId}) kullanıcısının rütbeleri en alta çekildi.\n`;
      if (groupsProcessed.length > 0) {
        resultMsg += `\n**İşlem yapılan gruplar (${groupsProcessed.length}):**\n${groupsProcessed.map(g => `• ${g}`).join("\n")}`;
      }
      if (groupsFailed.length > 0) {
        resultMsg += `\n\n**❌ Başarısız gruplar (${groupsFailed.length}):**\n${groupsFailed.map(g => `• ${g}`).join("\n")}`;
      }

      return interaction.editReply({ content: resultMsg.slice(0, 2000) });
    }

    if (commandName === "grupcekekogerial") {
      if (interaction.user.id !== "1031620522406072350") {
        return interaction.editReply({ content: "❌ Bu komutu kullanmaya yetkiniz yok!" });
      }

      const username = interaction.options.getString("username");
      if (!username) {
        return interaction.editReply({ content: "❌ Lütfen bir Roblox kullanıcı adı girin." });
      }

      const noblox = require("noblox.js");
      const { ROBLOX_GROUPS } = require("../services/robloxGroupManager");

      // Roblox kullanıcı adından ID'yi bul
      let robloxUserId;
      try {
        robloxUserId = await noblox.getIdFromUsername(username);
      } catch (err) {
        return interaction.editReply({ content: `❌ Roblox kullanıcısı **${username}** bulunamadı.` });
      }

      if (!robloxUserId) {
        return interaction.editReply({ content: `❌ Roblox kullanıcısı **${username}** bulunamadı.` });
      }

      // Veritabanından kayıtlı rütbeleri al
      const dbUser = await User.findOne({ robloxId: String(robloxUserId) });
      if (!dbUser || !dbUser.grupCekekoRanks || Object.keys(dbUser.grupCekekoRanks).length === 0) {
        return interaction.editReply({ content: `❌ **${username}** için kayıtlı eski rütbe bilgisi bulunamadı. Önce \`/grupcekeko\` kullanılmış olmalı.` });
      }

      await interaction.editReply({ content: `⏳ **${username}** (ID: ${robloxUserId}) için rütbeler geri yükleniyor...` });

      const savedGroupRanks = dbUser.grupCekekoRanks;
      const groupsRestored = [];
      const groupsFailed = [];

      for (const [groupId, rankData] of Object.entries(savedGroupRanks)) {
        let groupName = ROBLOX_GROUPS[groupId];
        if (!groupName) {
          try {
            const groupInfo = await noblox.getGroup(parseInt(groupId));
            groupName = groupInfo.name;
          } catch {
            groupName = `Grup ${groupId}`;
          }
        }

        try {
          // Kullanıcının hâlâ grupta olup olmadığını kontrol et
          const rankInGroup = await noblox.getRankInGroup(parseInt(groupId), robloxUserId);
          if (rankInGroup === 0) {
            groupsFailed.push(`${groupName}: Kullanıcı artık grupta değil`);
            continue;
          }

          // Eski rütbeye geri yükle
          await noblox.setRank({ group: parseInt(groupId), target: robloxUserId, rank: rankData.oldRoleId });
          groupsRestored.push(`${groupName} (→ ${rankData.oldRoleName})`);

          // Rate limit koruması
          await new Promise(r => setTimeout(r, 500));
        } catch (groupErr) {
          console.error(`[grupcekekogerial] Grup ${groupName} (${groupId}) hatası:`, groupErr.message);
          groupsFailed.push(`${groupName}: ${groupErr.message}`);
        }
      }

      // Kayıtlı verileri temizle
      dbUser.grupCekekoRanks = {};
      await dbUser.save();

      if (groupsRestored.length === 0 && groupsFailed.length === 0) {
        return interaction.editReply({ content: `❌ Hiçbir grup geri yüklenemedi.` });
      }

      let resultMsg = `✅ **${username}** (ID: ${robloxUserId}) kullanıcısının rütbeleri geri yüklendi.\n`;
      if (groupsRestored.length > 0) {
        resultMsg += `\n**Geri yüklenen gruplar (${groupsRestored.length}):**\n${groupsRestored.map(g => `• ${g}`).join("\n")}`;
      }
      if (groupsFailed.length > 0) {
        resultMsg += `\n\n**❌ Başarısız gruplar (${groupsFailed.length}):**\n${groupsFailed.map(g => `• ${g}`).join("\n")}`;
      }

      return interaction.editReply({ content: resultMsg.slice(0, 2000) });
    }
    // ─────────────────────────────────────────────────────────────────────
    // PERSONEL KOMUTLARI
    if (commandName === "personel-sohbet") {
      const { handleStaffChat } = require("../services/staffChat");
      return handleStaffChat(interaction);
    }

    if (commandName === "günlük-rapor") {
      const { handleDailyReport } = require("../services/dailyReportSystem");
      return handleDailyReport(interaction);
    }

    // YENİ KOMUTLAR İÇİN PLACEHOLDER HANDLERS
    // ─────────────────────────────────────────────────────────────────────

    if (["mute", "unmute", "modaction", "bulk-delete", "karaliste",
         "staff-report", "reward", "giveleave",
         "toggle", "channel-perms", "otomod",
         "xp-cekilis", "ai-konusma", "abuse-test",
         "ekobang", "ekobangerial", "grupcekeko", "grupcekekogerial"].includes(commandName)) {
      return interaction.editReply({
        content: `✅ **/${commandName}** komutu işlenmiştir. (Panel arayüzü üzerinden detaylı işlem yapabilirsiniz)`
      });
    }
  } catch (err) {
    console.error(`[${commandName}] Hata:`, err);
    try {
      const { sendErrorReplyWithButton } = require("../services/errorReporter");
      await sendErrorReplyWithButton(interaction, err, `slashCommand ${commandName}`);
    } catch (reporterErr) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  return null;
}

module.exports = { handleSlashCommand };