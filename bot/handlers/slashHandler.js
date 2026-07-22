const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const Ticket = require("../../models/Ticket");
const User = require("../../models/User");
const RulesAcceptance = require("../../models/RulesAcceptance");
const UserActivityLog = require("../../models/UserActivityLog");
const { getSupportMenuEmbed, getSupportButton } = require("../embeds");
const { SUPPORT_CATEGORIES, BASE_URL } = require("../../config");

async function handleSlashCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;

  // Modal-based commands BEFORE deferReply
  if (commandName === "hata-sihirbazi") {
    const { showErrorWizardModal } = require("../services/errorWizardService");
    return showErrorWizardModal(interaction);
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await User.findOne({ discordId: interaction.user.id }).catch(err => {
      console.warn('[slashHandler] User lookup error:', err.message);
      return null;
    });

    // Log activity
    UserActivityLog.log(interaction.user.id, UserActivityLog.ACTIVITY_TYPES.COMMAND, {
      command: commandName,
      guild: interaction.guildId || "DM"
    });

    // ────────── DOĞRULAMA KOMUTLARI ──────────────────────────────────────

    if (commandName === "dogrula") {
      const pin = interaction.options.getString("pin")?.trim();
      const { saveStoreNow } = require("../../models/Store");
      const logger = require("../../utils/logger");

      if (!user) {
        const embed = new EmbedBuilder()
          .setTitle("❌ Siteye Giriş Yapılmamış")
          .setDescription("Doğrulama yapmadan önce siteye giriş yapmalısınız.")
          .setColor(0xe74c3c);
        
        const btn = new ButtonBuilder()
          .setLabel("🌐 Siteye Git")
          .setStyle(ButtonStyle.Link)
          .setURL(BASE_URL || 'https://bemsentara-4cyc.onrender.com');
        
        const row = new ActionRowBuilder().addComponents(btn);
        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      if (user.botVerified) {
        const embed = new EmbedBuilder()
          .setTitle("✅ Zaten Doğrulanmış")
          .setDescription("Hesabınız zaten doğrulanmış. Botu kullanabilirsiniz!")
          .setColor(0x2ecc71);
        return interaction.editReply({ embeds: [embed] });
      }

      // PIN verilmişse eski sistemi kullan
      if (pin) {
        if (!user.botPin) {
          return interaction.editReply({ content: "❌ Siteden henüz bir PIN oluşturmamışsınız." });
        }

        if (user.botPin === pin) {
          user.botVerified = true;
          user.botPin = null;
          await saveStoreNow();
          logger.log(`[BOT] ${interaction.user.tag} botu PIN ile doğruladı.`);
          
          const embed = new EmbedBuilder()
            .setTitle("🎉 Doğrulama Başarılı!")
            .setDescription("Hesabınız başarıyla doğrulandı.")
            .setColor(0x2ecc71);
          return interaction.editReply({ embeds: [embed] });
        } else {
          return interaction.editReply({ content: "❌ **Hatalı PIN!**" });
        }
      }

      // OAuth akışı
      const VerificationCode = require("../../models/VerificationCode");
      const code = VerificationCode.create(interaction.user.id);
      const verifyUrl = `${BASE_URL || 'https://bemsentara-4cyc.onrender.com'}/verify?code=${code}`;

      const verifyBtn = new ButtonBuilder()
        .setLabel("🔐 Doğrulamak İçin Tıkla")
        .setStyle(ButtonStyle.Link)
        .setURL(verifyUrl);

      const row = new ActionRowBuilder().addComponents(verifyBtn);

      const embed = new EmbedBuilder()
        .setTitle("🔐 Discord Doğrulaması")
        .setDescription(
          `Sentara botunu kullanmak için hesabınızı doğrulayın.\n\n` +
          `**Doğrulama Kodu:** \`${code}\`\n\n` +
          `1️⃣ **"Doğrulamak İçin Tıkla"** butonuna tıkla\n` +
          `2️⃣ Kodu kopyala ve sitede gir\n\n` +
          `_Bu kod 30 dakika boyunca geçerlidir._`
        )
        .setColor(0x7c6af7)
        .setFooter({ text: "Sentara Doğrulama Sistemi" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (commandName === "authorize") {
      const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
      const embed = new EmbedBuilder()
        .setTitle("🔐 Hesabınızı Yetkilendirin")
        .setDescription(`[Tıklayın ve Roblox hesabınızla giriş yapın](${authUrl})`)
        .setColor(0x7c6af7);

      return interaction.editReply({ embeds: [embed] });
    }

    // ────────── KURALLAR KABUL KOMUTU ──────────────────────────────────────

    if (commandName === "kurallar-kabul") {
      if (!RulesAcceptance.hasAccepted(interaction.user.id)) {
        // Modal göster
        const modal = new ModalBuilder()
          .setCustomId("rules_acceptance_modal")
          .setTitle("📋 Kuralları Oku ve Kabul Et");

        const rulesInput = new TextInputBuilder()
          .setCustomId("rules_confirm")
          .setLabel("Kuralları okuyup kabul ediyorum (evet yaz)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("Kuralları kabul ediyorum");

        modal.addComponents(new ActionRowBuilder().addComponents(rulesInput));
        return interaction.showModal(modal);
      }

      const embed = new EmbedBuilder()
        .setTitle("✅ Kurallar Zaten Kabul Edilmiş")
        .setDescription("Siz zaten kuralları kabul etmiş bulunmaktasınız.")
        .setColor(0x2ecc71);

      return interaction.editReply({ embeds: [embed] });
    }

    // ────────── SUPPORT KOMUTLARI ──────────────────────────────────────────

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
            .map((t) => `**${t.ticketId}** - ${t.subject}\nKategori: ${SUPPORT_CATEGORIES[t.category]?.name || t.category}`)
            .join("\n\n")
        )
        .setFooter({ text: "Sentara Support" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "closeticket") {
      const reason = interaction.options.getString("reason") || "Sebep belirtilmedi";
      const tickets = await Ticket.find({ userId: interaction.user.id, status: "open" });
      
      if (tickets.length === 0) {
        return interaction.editReply({ content: "❌ Kapatılacak açık ticket'ınız yok" });
      }

      // Son ticket'ı kapat
      const ticket = tickets[tickets.length - 1];
      ticket.status = "closed";
      ticket.closedAt = new Date();
      ticket.closeReason = reason;
      await ticket.save?.();

      return interaction.editReply({ content: `✅ Ticket #${ticket.ticketId} kapatıldı` });
    }

    // ────────── PROFILE KOMUTLARI ──────────────────────────────────────────

    if (commandName === "profile") {
      if (!user) {
        const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
        return interaction.editReply({ content: `❌ Henüz yetkilendirmediniz. [Yetkilendirin](${authUrl})` });
      }

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${user.robloxUsername || user.discordUsername}`)
        .setColor(user.profileColor || 0x7c6af7)
        .addFields(
          { name: "🎮 Roblox", value: `**Username:** ${user.robloxUsername || "Yok"}\n**ID:** ${user.robloxId || "Yok"}`, inline: false },
          { name: "💬 Discord", value: `**Username:** ${user.discordUsername}\n**ID:** ${user.discordId}`, inline: false }
        );

      if (user.profileBio) {
        embed.addFields({ name: "📝 Hakkında", value: user.profileBio, inline: false });
      }

      // Activity tracking
      const lastActive = UserActivityLog.getLastLogin(interaction.user.id);
      if (lastActive) {
        embed.addFields({ name: "⏱️ Son Aktif", value: `<t:${Math.floor(lastActive.timestamp.getTime() / 1000)}:R>`, inline: true });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ────────── VERIFY/ROL SENKRONIZASYONU ──────────────────────────────────

    if (commandName === "verify") {
      try {
        const { TARGET_GUILD_ID, TMT_GUILD_ID, ALLIED_GUILD_ID, GUILD2_ID } = require("../../config");
        const guildId = String(interaction.guildId).trim();
        
        if (!guildId) {
          return interaction.editReply({ content: "❌ Bu komut sunucuda kullanılmalıdır" });
        }

        const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
          return interaction.editReply({ content: "❌ Sunucu bulunamadı" });
        }

        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) {
          return interaction.editReply({ content: "❌ Bu sunucuda bulunmuyorsunuz" });
        }

        const dbUser = await User.findOne({ discordId: interaction.user.id });

        if (!dbUser || !dbUser.robloxId) {
          return interaction.editReply({ content: "❌ Roblox hesabınızı yetkilendirmediniz. `/authorize` komutunu kullanın" });
        }

        let success = false;
        if (guildId === String(ALLIED_GUILD_ID).trim() || guildId === String(GUILD2_ID).trim()) {
          const { syncAlliedRoles } = require("../services/alliedRoleSyncService");
          const result = await syncAlliedRoles(interaction.client, interaction.user.id, parseInt(dbUser.robloxId, 10), guild);
          success = result.success;
        } else if (guildId === String(TMT_GUILD_ID).trim()) {
          const { syncTMTRoles } = require("../services/tmtRoleSyncService");
          const result = await syncTMTRoles(interaction.client, interaction.user.id, parseInt(dbUser.robloxId, 10), member);
          success = result?.success || false;
        } else if (guildId === String(TARGET_GUILD_ID).trim()) {
          const { syncMemberRoles } = require("../services/roleSyncService");
          const result = await syncMemberRoles(guild, member, parseInt(dbUser.robloxId, 10), dbUser.robloxUsername);
          success = result?.success || false;
        }

        return interaction.editReply({ content: success ? "✅ Rolleriniz senkronize edildi" : "❌ Rol senkronizasyonunda hata oluştu" });
      } catch (error) {
        console.error("[verify]", error);
        return interaction.editReply({ content: "❌ Hata: " + error.message });
      }
    }

    // ────────── GENEL BILGI KOMUTLARI ──────────────────────────────────────

    if (commandName === "ping") {
      const ping = interaction.client.ws.ping;
      const embed = new EmbedBuilder()
        .setTitle("🏓 Pong!")
        .setDescription(`Bot gecikmesi: **${ping}ms**`)
        .setColor(0x7c6af7);
      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "stats") {
      const client = interaction.client;
      const uptime = Math.floor(client.uptime / 1000);
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      
      const embed = new EmbedBuilder()
        .setTitle("📊 Bot İstatistikleri")
        .addFields(
          { name: "⏱️ Çalışma Süresi", value: `${hours}s ${minutes}d`, inline: true },
          { name: "📡 Gecikme", value: `${client.ws.ping}ms`, inline: true },
          { name: "🖥️ Sunucu Sayısı", value: String(client.guilds.cache.size), inline: true },
          { name: "👥 Toplam Kullanıcı", value: String(client.users.cache.size), inline: true }
        )
        .setColor(0x7c6af7)
        .setTimestamp();
      
      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "yardim") {
      const kategori = interaction.options.getString("kategori");
      
      let embed = new EmbedBuilder()
        .setTitle("🆘 Sentara Bot Yardım")
        .setColor(0x7c6af7);

      if (!kategori || kategori === "general") {
        embed.setDescription(
          `**Genel Komutlar:**\n` +
          `\`/dogrula\` - Discord hesabını doğrula\n` +
          `\`/authorize\` - Roblox hesabını bağla\n` +
          `\`/profile\` - Profilini göster\n` +
          `\`/verify\` - Rollerini senkronize et\n` +
          `\`/support\` - Destek menüsü\n` +
          `\`/ping\` - Bot gecikmesi\n` +
          `\`/stats\` - Bot istatistikleri\n` +
          `\`/yardim\` - Bu komutu görüntüle\n\n` +
          `**Diğer kategoriler:** \`/yardim @kategori\``
        );
      } else if (kategori === "economy") {
        embed.setDescription(
          `**Ekonomi Komutları:**\n` +
          `\`/ekonomi bakiye\` - Bakiyeni göster\n` +
          `\`/ekonomi para_gonder\` - Para gönder\n` +
          `\`/gelir kazanc\` - Günlük kazanç al\n` +
          `\`/itemler\` - Mağaza ve envanteri yönet`
        );
      } else if (kategori === "fun") {
        embed.setDescription(
          `**Eğlence Komutları:**\n` +
          `\`/boom_oyunu\` - Boom oyunu\n` +
          `\`/kelime_oyunu\` - Kelime oyunu\n` +
          `\`/oyunlar\` - Diğer oyunlar`
        );
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ────────── PERSONEL/STAFF KOMUTLARI ──────────────────────────────────

    if (commandName === "personeldurum") {
      const targetUser = interaction.options.getUser("kullanici") || interaction.user;
      const dbUser = await User.findOne({ discordId: targetUser.id });

      if (!dbUser) {
        return interaction.editReply({ content: "❌ Kullanıcı bilgileri bulunamadı" });
      }

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${targetUser.username}`)
        .addFields(
          { name: "📊 Level", value: String(dbUser.level || 0), inline: true },
          { name: "⭐ XP", value: String(dbUser.xp || 0), inline: true },
          { name: "🎖️ Rozet", value: dbUser.badge || "Yok", inline: true }
        )
        .setColor(0x7c6af7);

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "profil") {
      const targetUser = interaction.options.getUser("kullanici") || interaction.user;
      const dbUser = await User.findOne({ discordId: targetUser.id });

      if (!dbUser) {
        return interaction.editReply({ content: "❌ Kullanıcı bilgileri bulunamadı" });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${targetUser.username}`)
        .addFields(
          { name: "⭐ XP", value: String(dbUser.gamificationXp || 0), inline: true },
          { name: "🏆 Rozetler", value: String((dbUser.badges || []).length), inline: true }
        )
        .setColor(0x7c6af7);

      return interaction.editReply({ embeds: [embed] });
    }

    // ────────── MOD-ALIM (MODERATOR MÜLAKATINI) ──────────────────────────────

    if (commandName === "mod-alim") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: "❌ Bunu yapmaya yetkili değilsiniz" });
      }

      const targetUser = interaction.options.getUser("kullanici");
      
      // DM'ye modal gönder
      try {
        const dmChannel = await targetUser.createDM();
        const modal = new ModalBuilder()
          .setCustomId("mod_interview_modal")
          .setTitle("🛡️ Moderatör Mülakatı");

        const q1 = new TextInputBuilder()
          .setCustomId("mod_q1")
          .setLabel("Moderatör olmak istemenizin sebebi?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const q2 = new TextInputBuilder()
          .setCustomId("mod_q2")
          .setLabel("Uygunsuz davranış gördüğünüzde ne yaparsınız?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(q1),
          new ActionRowBuilder().addComponents(q2)
        );

        // Modal gösterilir (bu manuel olarak yapılması gerekir)
        await dmChannel.send({ content: "Moderatör mülakatı başladı. Lütfen /mod-alim komutundaki modalı doldurunuz." });
      } catch (error) {
        return interaction.editReply({ content: "❌ DM açılamadı" });
      }

      return interaction.editReply({ content: `✅ Mülakat davetiyesi ${targetUser.username}'e gönderildi` });
    }

    // ────────── AKTIF/İNAKTİF KULLANICILAR ──────────────────────────────────

    if (commandName === "aktif-kullanicilar") {
      const activeUsers = UserActivityLog.getActiveUsers();
      
      if (activeUsers.length === 0) {
        return interaction.editReply({ content: "❌ Aktif kullanıcı yok" });
      }

      const userDetails = activeUsers.slice(0, 10).map(id => `<@${id}>`).join("\n");
      
      const embed = new EmbedBuilder()
        .setTitle("🟢 Aktif Kullanıcılar (24 saat)")
        .setDescription(userDetails)
        .setFooter({ text: `Toplam: ${activeUsers.length}` })
        .setColor(0x2ecc71);

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "inaktif-kullanicilar") {
      const inactiveUsers = UserActivityLog.getInactiveUsers(24);
      
      if (inactiveUsers.length === 0) {
        return interaction.editReply({ content: "❌ İnaktif kullanıcı yok" });
      }

      const userDetails = inactiveUsers.slice(0, 10).map(id => `<@${id}>`).join("\n");
      
      const embed = new EmbedBuilder()
        .setTitle("🔴 İnaktif Kullanıcılar (24 saatin üzerinde)")
        .setDescription(userDetails)
        .setFooter({ text: `Toplam: ${inactiveUsers.length}` })
        .setColor(0xe74c3c);

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "aktivite-gecmisi") {
      const targetUser = interaction.options.getUser("kullanici") || interaction.user;
      const report = UserActivityLog.getUserActivityReport(targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${targetUser.username}'in Aktivite Geçmişi`)
        .setDescription(report)
        .setColor(0x7c6af7)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ────────── PLACEHOLDER KOMUTLAR ──────────────────────────────────────

    // Ekonomi komutları
    if (["ekonomi", "gelir", "itemler", "ekocoin", "magaza", "gunluk-odul", "zenginler"].includes(commandName)) {
      return interaction.editReply({ content: `✏️ **/\`${commandName}\` komutu hazırlanıyor...** 🚀` });
    }

    // Eğlence komutları
    if (["boom_ayarlar", "boom_oyunu", "kelime_oyunu_ayarlar", "kelime_oyunu", "oyunlar"].includes(commandName)) {
      return interaction.editReply({ content: `🎮 **/\`${commandName}\` oyunu yakında başlıyor!** 🎮` });
    }

    // Court / Dava komutları
    if (["dava-kurulum", "dava-ac", "yasa-kitabi", "kodos-tahliye", "sabika-kaydi", "istinaf-basvuru"].includes(commandName)) {
      const { handleCourtCommand } = require("./courtCommandHandler");
      return handleCourtCommand(interaction);
    }

    // Moderasyon komutları
    if (["mute", "unmute", "modaction", "bulk-delete", "ban", "unban", "karaliste"].includes(commandName)) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.editReply({ content: "❌ Bunu yapmaya yetkili değilsiniz" });
      }
      return interaction.editReply({ content: `🛡️ **/\`${commandName}\` komutu geliştirilme aşamasında...** ⚙️` });
    }

    // Staff komutları
    if (["panel", "fire", "promote", "demote", "reward", "staff-report"].includes(commandName)) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: "❌ Bunu yapmaya yetkili değilsiniz" });
      }
      return interaction.editReply({ content: `📊 **/\`${commandName}\` komutu geliştirilme aşamasında...** ⚙️` });
    }

    // Roblox komutları
    if (["robloxgrup", "robloxuser", "update", "incele"].includes(commandName)) {
      return interaction.editReply({ content: `🎮 **/\`${commandName}\` komutu geliştirilme aşamasında...** ⚙️` });
    }

    // Oyuncu seviyesi komutları
    if (["seviye", "seviyetop", "leaderboard", "challenge"].includes(commandName)) {
      return interaction.editReply({ content: `🏆 **/\`${commandName}\` komutu geliştirilme aşamasında...** ⚙️` });
    }

    // RoWifi komutları
    if (commandName === "rowifi") {
      return interaction.editReply({ content: `🤖 **RoWifi sistemi geliştirilme aşamasında...** ⚙️` });
    }

    // Kısa tatil/izin komutları
    if (["izin_iste", "izin_kullan", "izin_durum", "birimistifa", "renk", "profilrenk", "biyografi", "oda-olustur", "ozelrolisim"].includes(commandName)) {
      return interaction.editReply({ content: `📋 **/\`${commandName}\` komutu geliştirilme aşamasında...** ⚙️` });
    }

    // Sistem komutları
    if (["toggle", "system-toggle", "channel-perms", "otomod", "birim-alimi", "birim-tanitim", "xp-cekilis", "ai-konusma", "abuse-test", "coach-welcome-reset", "coach-mesaj-ayarlari", "ekobang", "system-ekobang", "ekobangerial", "system-ekobangerial", "grupcekeko", "system-grupcekeko", "grupcekekogerial", "system-grupcekekogerial", "bakim"].includes(commandName)) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: "❌ Bunu yapmaya yetkili değilsiniz" });
      }
      return interaction.editReply({ content: `⚙️ **/\`${commandName}\` sistem komutu geliştirilme aşamasında...** 🔧` });
    }

    if (commandName === "personel-dogrula") {
      return interaction.editReply({ content: `🔐 **/\`personel-dogrula\` komutu geliştirilme aşamasında...** ⚙️` });
    }

    if (commandName === "koc") {
      return interaction.editReply({ content: `🤖 **AI Koç sistemi yakında aktif olacak!** ⏳` });
    }

    // Bilinmeyen komut
    return interaction.editReply({ content: `❌ **\`${commandName}\` komutu tanınmadı!**` });

  } catch (err) {
    console.error("[handleSlashCommand]", err);
    return interaction.editReply({ content: "❌ Komut çalıştırılırken hata oluştu: " + (err.message || "Bilinmeyen hata") }).catch(() => null);
  }
}

module.exports = { handleSlashCommand };
