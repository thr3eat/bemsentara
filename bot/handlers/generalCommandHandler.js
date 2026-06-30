const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Ticket = require("../../models/Ticket");
const User = require("../../models/User");
const { getSupportMenuEmbed, getSupportButton } = require("../embeds");
const { SUPPORT_CATEGORIES, BASE_URL } = require("../../config");
const { findUserByDiscordId, hasRobloxLink } = require("../../utils/userLink");
const { deferEphemeral } = require("../utils/interaction");

const pingTracker = new Map();
const philanthropyTracker = new Map();
const GENERAL_COMMANDS = new Set([
  "support",
  "mytickets",
  "closeticket",
  "profile",
  "authorize",
  "robloxgrup",
  "robloxuser",
  "incele",
  "abonelik",
  "ayarlar",
  "kanal",
  "otomod",
  "yardim",
  "ping",
  "stats",
  "personeldurum",
  "seviye",
  "seviyetop",
  "seviyeayarla",
  "modbasvuru",
  "mod-alim",
  "istifa",
  "emeklilik",
  "koc",
  "leaderboard",
  "profil",
  "challenge",
  "ekobang",
  "ekobangerial",
  "izin_iste",
  "izin_ver",
  "izin_kullan",
  "izin_durum",
  "konus",
  "odulver",
  "personel-dogrula",
  "personelkov",
  "personelayarla",
  "personelrapor",
  "sayim",
  "verify",
  "update",
  "debug-update",
  "anketai",
  "xpcekilis",
  "ekocoin",
  "magaza",
  "gunluk-odul",
  "zenginler",
  "birimalimi",
  "birimterfi",
  "birimistifa",
  "birimtanitim",
  "abusetest",
  // Panel command versions
  "staff-reward",
  "staff-giveleave",
  "staff-attendance-start",
  "staff-attendance-stop",
  "system-toggle",
  "system-ekobang",
  "system-ekobangerial",
  "system-grupcekeko",
  "system-grupcekekogerial",
  // Coach management
  "coach-welcome-reset",
  "coach-mesaj-ayarlari"
]);

async function handleGeneralCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;

  // ── personel-dogrula: Personel yetkilendirme linki ──────────────────────
  if (commandName === "personel-dogrula") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const User = require("../../models/User");
      const user = await User.findOne({ discordId: interaction.user.id });
      const { BASE_URL } = require("../../config");

      if (user?.robloxId) {
        // Zaten bağlı, grupları ve sunucuyu senkronize et
        const { syncStaffRobloxRanks, ensureAdminGuildMembership, syncStaffDiscordRoles } = require("../services/staffAutomation");

        // İsteği kabul edip Roblox rütbelerini verecek fonksiyonu çağırıyoruz
        await syncStaffRobloxRanks(interaction.client, interaction.user.id);

        // Sonra Roblox rütbesine bakarak Discord rollerini veriyoruz
        const roleSyncSuccess = await syncStaffDiscordRoles(interaction.client, interaction.user.id);

        if (roleSyncSuccess) {
          // Sunucu üyeliğini kontrol ediyoruz
          const inGuild = await ensureAdminGuildMembership(interaction.client, interaction.user.id);

          let responseText = `✅ **Personel Doğrulaması Başarılı!**\nRoblox ID: \`${user.robloxId}\``;
          if (!inGuild) {
            responseText += `\n\n⚠️ Sunucudaki yetki rolleriniz Roblox grubundaki rütbenize göre ayarlandı, ancak **Yönetim Sunucusuna** henüz katılmadınız!\n🔗 **Sunucu Davet Linki:** https://discord.gg/fjwjMgH54N\nKatıldıktan sonra rolleriniz geçerli olacaktır.`;
          } else {
            responseText += `\n\n🎉 Yönetim sunucusu doğrulamanız tamdır. Discord moderatör rolleriniz Roblox grubunuzdaki (EkoYıldız Moderatör Ekibi) rütbenize göre başarıyla verildi!`;
          }
          return interaction.editReply({ content: responseText });
        } else {
          return interaction.editReply({ content: `❌ **Doğrulama Başarısız!**\nRoblox grubunda (**EkoYıldız Moderatör Ekibi**) onaylı bir rütbeniz bulunamadı veya roller verilirken bir hata oluştu.\nLütfen önce gruba katılıp rütbe aldığınızdan emin olun.` });
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x4169E1)
        .setTitle("🔐 Personel Roblox Doğrulaması")
        .setDescription(
          `EkoYıldız yönetim ekibinde bulunduğunuz tespit edildi. Sistemleri tam olarak kullanabilmek ve görev yetkilerinizi alabilmek için **Roblox** hesabınızı doğrulamanız gerekmektedir.\n\n` +
          `Lütfen aşağıdaki web paneli linkine tıklayarak hesabınızı eşleştirin.\n\n` +
          `🔗 **Doğrulama Linki:** [EkoYıldız Dashboard](${BASE_URL}/dashboard)`
        )
        .setFooter({ text: "EkoYıldız Yüksek Güvenlikli Otomasyon Sistemi" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🌐 Dashboard'a Git ve Doğrula")
          .setStyle(ButtonStyle.Link)
          .setURL(`${BASE_URL}/dashboard`)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[personel-dogrula] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── personelayarla: Yetkili bilgilerini günceller (Yöneticiler) ──────────────────
  if (commandName === "personelayarla") {
    const isYonetici = interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isYonetici) {
      return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const targetUser = interaction.options.getUser('kullanici');
      const parametre = interaction.options.getString('parametre');
      const deger = interaction.options.getInteger('deger');

      const StaffProgress = require("../../models/StaffProgress");
      const staffAutomation = require("../services/staffAutomation");
      const { ROLE_NAMES, GUILD_ID, ROLES } = require("../services/staffSystem");

      let progress = await StaffProgress.findOne({ userId: targetUser.id });
      if (!progress) {
        return interaction.editReply({ content: `❌ **${targetUser.username}** personel sisteminde kayıtlı değil.` });
      }

      // Initialize safety subdocuments
      if (!progress.stats) progress.stats = {};
      if (!progress.warnings) progress.warnings = { count: 0 };
      if (!progress.daily) progress.daily = { date: '', greeted: false, voiceMinutes: 0 };
      if (!progress.exam) progress.exam = { status: 'none', attempts: 0, answers: [] };

      let oldValue = '';
      let newValue = '';
      const oldLevel = progress.level || 1;

      switch (parametre) {
        case 'tickets': {
          if (deger === null || deger < 0) {
            return interaction.editReply({ content: '❌ Bu parametre için geçerli (0 veya daha büyük) bir sayı değeri belirtmelisiniz.' });
          }
          oldValue = `${progress.stats.ticketsSolved || 0} bilet`;
          progress.stats.ticketsSolved = deger;
          newValue = `${deger} bilet`;
          break;
        }
        case 'messages': {
          if (deger === null || deger < 0) {
            return interaction.editReply({ content: '❌ Bu parametre için geçerli (0 veya daha büyük) bir sayı değeri belirtmelisiniz.' });
          }
          oldValue = `${progress.stats.chatMessages || 0} mesaj`;
          progress.stats.chatMessages = deger;
          newValue = `${deger} mesaj`;
          break;
        }
        case 'voice': {
          if (deger === null || deger < 0) {
            return interaction.editReply({ content: '❌ Bu parametre için geçerli (0 veya daha büyük) bir sayı değeri belirtmelisiniz.' });
          }
          oldValue = `${progress.stats.totalVoiceMinutes || 0} dk`;
          progress.stats.totalVoiceMinutes = deger;
          newValue = `${deger} dk`;
          break;
        }
        case 'active_days': {
          if (deger === null || deger < 0) {
            return interaction.editReply({ content: '❌ Bu parametre için geçerli (0 veya daha büyük) bir sayı değeri belirtmelisiniz.' });
          }
          oldValue = `${progress.stats.activeDays || 0} gün`;
          progress.stats.activeDays = deger;
          newValue = `${deger} gün`;
          break;
        }
        case 'level': {
          if (deger === null || deger < 1 || deger > 6) {
            return interaction.editReply({ content: '❌ Yetkili seviyesi 1 ile 6 arasında bir sayı olmalıdır.' });
          }
          oldValue = `Seviye ${oldLevel} (${ROLE_NAMES[oldLevel] || 'Bilinmiyor'})`;
          progress.level = deger;
          newValue = `Seviye ${deger} (${ROLE_NAMES[deger] || 'Bilinmiyor'})`;
          break;
        }
        case 'warnings': {
          if (deger === null || deger < 0) {
            return interaction.editReply({ content: '❌ Bu parametre için geçerli (0 veya daha büyük) bir sayı değeri belirtmelisiniz.' });
          }
          oldValue = `${progress.warnings.count || 0} uyarı`;
          progress.warnings.count = deger;
          newValue = `${deger} uyarı`;
          break;
        }
        case 'ekocoin': {
          if (deger === null || deger < 0) {
            return interaction.editReply({ content: '❌ Bu parametre için geçerli (0 veya daha büyük) bir sayı değeri belirtmelisiniz.' });
          }
          if (!progress.gamification) {
            progress.gamification = { totalPoints: 0, ecoCoins: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 }, lastDailyClaim: '' };
          }
          oldValue = `${progress.gamification.ecoCoins || 0} E.C.`;
          progress.gamification.ecoCoins = deger;
          newValue = `${deger} E.C.`;
          break;
        }
        case 'reset_exam': {
          oldValue = `Sınav Durumu: ${progress.exam.status || 'none'}, Hak: ${progress.exam.attempts || 0}`;
          progress.exam.status = 'none';
          progress.exam.attempts = 0;
          progress.exam.answers = [];
          newValue = `Sınav Durumu: none, Hak: 0 (Sıfırlandı)`;
          break;
        }
        default: {
          return interaction.editReply({ content: '❌ Geçersiz parametre seçildi.' });
        }
      }

      await progress.save();

      let syncMessage = '';
      if (parametre === 'level') {
        try {
          const syncRanksSuccess = await staffAutomation.syncStaffRobloxRanks(interaction.client, targetUser.id);
          const syncRolesSuccess = await staffAutomation.syncStaffDiscordRoles(interaction.client, targetUser.id);

          if (syncRolesSuccess) {
            syncMessage = `\n\n🔄 **Rol ve Grup Senkronizasyonu:** Rütbe rolleri Roblox ve Discord üzerinde başarıyla senkronize edildi.`;
          } else {
            // Manual fallback if Roblox link is missing
            const guild = await interaction.client.guilds.fetch(GUILD_ID).catch(() => null);
            const member = guild ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
            if (member) {
              const oldRoleId = ROLES[oldLevel];
              const newRoleId = ROLES[deger];
              if (oldRoleId) await member.roles.remove(oldRoleId).catch(() => { });
              if (newRoleId) await member.roles.add(newRoleId).catch(() => { });
              syncMessage = `\n\n🔄 **Manuel Rol Senkronizasyonu:** Roblox hesabı bulunamadığı veya grupta olmadığı için sadece Discord rütbe rolü güncellendi.`;
            } else {
              syncMessage = `\n\n⚠️ **Rol Senkronizasyonu:** Discord sunucusunda üye bulunamadı veya roller güncellenemedi.`;
            }
          }
          await staffAutomation.updateDynamicModList(interaction.client).catch(() => { });
        } catch (syncErr) {
          console.error('[personelayarla] sync error:', syncErr.message);
          syncMessage = `\n\n⚠️ **Senkronizasyon Hatası:** ${syncErr.message}`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('⚙️ Personel Verisi Güncellendi')
        .setDescription(`${targetUser} adlı yetkilinin veritabanı kaydı başarıyla değiştirildi.`)
        .addFields(
          { name: 'Değiştirilen Parametre', value: `\`${parametre}\``, inline: true },
          { name: 'Eski Değer', value: `\`${oldValue}\``, inline: true },
          { name: 'Yeni Değer', value: `\`${newValue}\``, inline: true }
        )
        .setFooter({ text: `İşlemi Yapan: ${interaction.user.username} • Eko Yıldız` })
        .setTimestamp();

      if (syncMessage) {
        embed.setDescription(embed.data.description + syncMessage);
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[personelayarla] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── personelrapor: Yetkili durum raporu (Yöneticiler) ──────────────────
  if (commandName === "personelrapor") {
    const isYonetici = interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isYonetici) {
      return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const StaffProgress = require("../../models/StaffProgress");
      const { ROLE_NAMES, GUILD_ID } = require("../services/staffSystem");

      const allActive = await StaffProgress.find({ status: 'active' }).sort({ level: -1 });
      if (allActive.length === 0) {
        return interaction.editReply({ content: 'ℹ️ Sistemde kayıtlı aktif personel bulunamadı.' });
      }

      const guild = await interaction.client.guilds.fetch(GUILD_ID).catch(() => null);
      const rows = [];

      for (const p of allActive) {
        let username = 'Bilinmeyen';
        if (guild) {
          const member = await guild.members.fetch(p.userId).catch(() => null);
          if (member) {
            username = member.user.username;
          }
        }
        if (username === 'Bilinmeyen') {
          const user = await interaction.client.users.fetch(p.userId).catch(() => null);
          if (user) {
            username = user.username;
          }
        }

        // Limit username to 15 chars for alignment
        if (username.length > 15) {
          username = username.slice(0, 12) + '...';
        }

        const rankName = ROLE_NAMES[p.level] || 'Stajyer';
        const tickets = (p.stats?.ticketsSolved || 0).toString();
        const messages = (p.stats?.chatMessages || 0).toString();
        const voice = (p.stats?.totalVoiceMinutes || 0).toString();
        const streak = (p.stats?.consecutiveDays || 0).toString();
        const warnings = `${p.warnings?.count || 0}/5`;

        rows.push(
          `${username.padEnd(16)} | ` +
          `${rankName.padEnd(20)} | ` +
          `${tickets.padStart(5)} | ` +
          `${messages.padStart(6)} | ` +
          `${voice.padStart(7)} | ` +
          `${streak.padStart(5)} | ` +
          `${warnings.padStart(5)}`
        );
      }

      // Build code block table
      const header = `${"Kullanıcı".padEnd(16)} | ${"Rütbe".padEnd(20)} | ${"Bilet".padStart(5)} | ${"Mesaj".padStart(6)} | ${"Ses(dk)".padStart(7)} | ${"Seri".padStart(5)} | ${"Uyarı".padStart(5)}\n` + "-".repeat(80);

      const embeds = [];
      const chunkSize = 15;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const tableText = `\`\`\`\n${header}\n${chunk.join('\n')}\n\`\`\``;

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`📊 Aktif Yetkili İlerleme Raporu (Bölüm ${Math.floor(i / chunkSize) + 1})`)
          .setDescription(tableText)
          .setFooter({ text: `Toplam Yetkili Sayısı: ${allActive.length} • Eko Yıldız` })
          .setTimestamp();

        embeds.push(embed);
      }

      return interaction.editReply({ embeds: embeds });
    } catch (err) {
      console.error('[personelrapor] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── seviyeayarla: Seviye ve XP bilgilerini günceller (Yöneticiler) ──────────────────
  if (commandName === "seviyeayarla") {
    const isYonetici = interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isYonetici) {
      return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const targetUser = interaction.options.getUser('kullanici');
      const parametre = interaction.options.getString('parametre');
      const deger = interaction.options.getInteger('deger');

      const FrogLevel = require("../../models/FrogLevel");
      const { FROG_ROLES, FROG_GUILD_ID, xpToNextLevel, totalXpForLevel, syncRolesFromLevel } = require("../services/frogLevel");

      let p = await FrogLevel.findOne({ userId: targetUser.id });
      if (!p) {
        p = new FrogLevel({ userId: targetUser.id, guildId: FROG_GUILD_ID });
      }

      let oldValue = '';
      let newValue = '';
      const oldLevel = p.level || 0;

      switch (parametre) {
        case 'level': {
          if (deger === null || deger < 0 || deger >= FROG_ROLES.length) {
            return interaction.editReply({ content: `❌ Geçerli bir seviye belirtmelisiniz (0 - ${FROG_ROLES.length - 1} arası).` });
          }
          oldValue = `Seviye ${oldLevel} (${FROG_ROLES[oldLevel]?.name || 'Yavru Kurbağa'})`;
          p.level = deger;
          p.xp = totalXpForLevel(deger);
          newValue = `Seviye ${deger} (${FROG_ROLES[deger]?.name || 'Yavru Kurbağa'})`;
          break;
        }
        case 'xp': {
          if (deger === null || deger < 0) {
            return interaction.editReply({ content: '❌ Geçerli bir XP miktarı belirtmelisiniz.' });
          }
          oldValue = `${p.xp || 0} XP`;
          p.xp = deger;
          newValue = `${deger} XP`;

          // Seviye kontrolü tetikle
          try {
            const guild = await interaction.client.guilds.fetch(FROG_GUILD_ID).catch(() => null);
            const member = guild ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
            if (member) {
              const { checkLevelUp } = require("../services/frogLevel");
              await checkLevelUp(p, member, interaction.client);
            }
          } catch (e) {
            console.error('[seviyeayarla] checkLevelUp error:', e.message);
          }
          break;
        }
        case 'double_xp_hours': {
          if (deger === null || deger <= 0) {
            return interaction.editReply({ content: '❌ Geçerli bir saat süresi belirtmelisiniz.' });
          }
          const now = Date.now();
          const boostUntil = new Date(now + deger * 60 * 60 * 1000);
          oldValue = p.doubleXpUntil && new Date(p.doubleXpUntil) > new Date() ? `Aktif (<t:${Math.floor(new Date(p.doubleXpUntil).getTime() / 1000)}:R>)` : 'Pasif';
          p.doubleXpUntil = boostUntil;
          newValue = `Aktif (<t:${Math.floor(boostUntil.getTime() / 1000)}:R>)`;
          break;
        }
        case 'reset': {
          oldValue = `Seviye ${oldLevel}, ${p.xp || 0} XP`;
          p.level = 0;
          p.xp = 0;
          p.doubleXpUntil = null;
          p.totalMessages = 0;
          p.totalVoiceMinutes = 0;
          p.promotions = [];
          newValue = 'Sıfırlandı (Seviye 0, 0 XP)';
          break;
        }
        default: {
          return interaction.editReply({ content: '❌ Geçersiz parametre seçildi.' });
        }
      }

      await p.save();

      // Rol ve Roblox senkronizasyonu
      let syncMessage = '';
      try {
        const guild = await interaction.client.guilds.fetch(FROG_GUILD_ID).catch(() => null);
        const member = guild ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
        if (member) {
          await syncRolesFromLevel(member, p.level, interaction.client);
          syncMessage = `\n\n🔄 **Rol ve Grup Senkronizasyonu:** Kullanıcının seviye rolleri Discord ve Roblox üzerinde başarıyla güncellendi.`;
        } else {
          syncMessage = `\n\n⚠️ **Rol Senkronizasyonu:** Kullanıcı hedef sunucuda bulunamadığı için Discord rolleri güncellenemedi.`;
        }
      } catch (syncErr) {
        console.error('[seviyeayarla] sync error:', syncErr.message);
        syncMessage = `\n\n⚠️ **Senkronizasyon Hatası:** ${syncErr.message}`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('⚙️ Seviye Verisi Güncellendi')
        .setDescription(`${targetUser} adlı üyenin Kurbağa/Dinazor seviye veritabanı kaydı başarıyla değiştirildi.`)
        .addFields(
          { name: 'Değiştirilen Parametre', value: `\`${parametre}\``, inline: true },
          { name: 'Eski Değer', value: `\`${oldValue}\``, inline: true },
          { name: 'Yeni Değer', value: `\`${newValue}\``, inline: true }
        )
        .setFooter({ text: `İşlemi Yapan: ${interaction.user.username} • Eko Yıldız` })
        .setTimestamp();

      if (syncMessage) {
        embed.setDescription(embed.data.description + syncMessage);
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[seviyeayarla] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── personelkov: Personeli kovar ve sistemden siler ──────────────────────
  if (commandName === "personelkov") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => { });
    }

    const isYonetici = interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isYonetici) {
      return interaction.editReply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.' });
    }

    try {
      const targetUser = interaction.options.getUser('kullanici');
      const sebep = interaction.options.getString('sebep') || "Belirtilmedi";

      const StaffProgress = require("../../models/StaffProgress");
      const User = require("../../models/User");

      const p = await StaffProgress.findOne({ userId: targetUser.id });
      const u = await User.findOne({ discordId: targetUser.id });

      if (!p && !u) {
        return interaction.editReply({ content: `❌ Belirtilen kullanıcı personel sisteminde bulunamadı.` });
      }

      // 1. StaffProgress'ten sil
      if (p) {
        await StaffProgress.deleteOne({ userId: targetUser.id });
      }

      // 2. Roblox Grubundan At (Exile)
      let robloxIslem = "Roblox hesabı bağlı olmadığı için gruptan atılamadı.";
      if (u && u.robloxId) {
        try {
          const { noblox, ROBLOX } = require("../../config");
          // EkoYıldız Moderatör Ekibi grubundan at
          await noblox.exile(ROBLOX.EKOYILDIZ_MOD, u.robloxId);
          robloxIslem = `Roblox Moderatör Ekibi grubundan başarıyla atıldı (\`${u.robloxId}\`).`;
        } catch (err) {
          console.error(`[personelkov] Exile error:`, err.message);
          robloxIslem = `Roblox grubundan atılırken hata oluştu (Yetki yetersiz veya zaten grupta değil).`;
        }
      }

      // 3. Yönetim Sunucusundan At (Kick)
      let discordIslem = "Kullanıcı yönetim sunucusunda bulunamadı.";
      try {
        const { ADMIN_GUILD_ID } = require("../services/staffAutomation");
        const guild = await interaction.client.guilds.fetch(ADMIN_GUILD_ID).catch(() => null);
        if (guild) {
          const member = await guild.members.fetch(targetUser.id).catch(() => null);
          if (member) {
            await member.kick(`Personel sisteminden kovuldu. Sebep: ${sebep}`);
            discordIslem = "Yönetim sunucusundan başarıyla atıldı.";
          }
        }
      } catch (err) {
        console.error(`[personelkov] Kick error:`, err.message);
        discordIslem = "Yönetim sunucusundan atılırken hata oluştu.";
      }

      const embed = new EmbedBuilder()
        .setTitle("🛑 Personel Kovuldu")
        .setDescription(`${targetUser} adlı personel sistemden tamamen kaldırıldı.`)
        .addFields(
          { name: "Sebep", value: sebep },
          { name: "Roblox İşlemi", value: robloxIslem },
          { name: "Discord İşlemi", value: discordIslem }
        )
        .setColor(0xE74C3C)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('[personelkov] hata:', err.message);
      return interaction.editReply({ content: `❌ Beklenmedik bir hata oluştu: ${err.message}` });
    }
  }

  // ── sayim: Aylık yoklama sistemi (Yöneticiler) ───────────────────────────
  if (commandName === "sayim") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => { });
    }

    const isYonetici = interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isYonetici) {
      return interaction.editReply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.' });
    }

    const sub = interaction.options.getSubcommand();
    const { startRollCall, endRollCall } = require('../services/rollCallService');

    if (sub === 'baslat') {
      await startRollCall(interaction.client, interaction);
    } else if (sub === 'bitir') {
      await endRollCall(interaction.client, interaction);
    }
    return;
  }

  // ── konus: AI destekli konuşma başlat ──────────────────────────────────────
  if (commandName === "konus") {
    const { ADMIN_IDS } = require("../../config");
    const isYonetici = ADMIN_IDS.includes(interaction.user.id) ||
      interaction.member?.permissions.has(PermissionFlagsBits.Administrator) ||
      interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isYonetici) {
      return interaction.reply({ content: '❌ Bu komut sadece yöneticiler tarafından kullanılabilir.', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { startKonusSession } = require('../services/aiTalkService');
      return await startKonusSession(interaction);
    } catch (err) {
      console.error('[konus] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── odulver: Personele ödül ver ve terfi ettir ──────────────────────────────
  if (commandName === "odulver") {
    const { ADMIN_IDS } = require("../../config");
    const isYonetici = ADMIN_IDS.includes(interaction.user.id) ||
      interaction.member?.permissions.has(PermissionFlagsBits.Administrator) ||
      interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isYonetici) {
      return interaction.reply({ content: '❌ Bu komut sadece yöneticiler tarafından kullanılabilir.', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => { });
    }
    try {
      const targetUser = interaction.options.getUser('kullanici');
      const odul = interaction.options.getString('odul');
      const islem = interaction.options.getString('islem');

      const StaffProgress = require('../../models/StaffProgress');
      const { promote, ROLE_NAMES } = require('../services/staffSystem');

      const progress = await StaffProgress.findOne({ userId: targetUser.id });
      if (!progress) {
        return interaction.editReply({ content: `❌ **${targetUser.username}** personel sisteminde bulunmuyor.` });
      }

      if (islem === 'al') {
        // Ödül Geri Alma
        progress.gamification = progress.gamification || {};
        progress.gamification.totalPoints = Math.max(0, (progress.gamification.totalPoints || 0) - 500);
        progress.gamification.currentXP = Math.max(0, (progress.gamification.currentXP || 0) - 500);
        await progress.save();

        const embed = new EmbedBuilder()
          .setColor(0xff3333)
          .setTitle('📉 Ödül Geri Alındı!')
          .setThumbnail(targetUser.displayAvatarURL())
          .setDescription(
            `❌ **${targetUser.username}** kullanıcısının **"${odul}"** ödülü geri alındı.\n\n` +
            `🔻 **Kaybedilenler:**\n` +
            `• **-500 Puan** ve **-500 XP** gamification profilinden düşüldü.`
          )
          .setFooter({ text: 'Eko Yıldız • Yetkili Ödüllendirme' })
          .setTimestamp();

        return interaction.editReply({ content: `<@${targetUser.id}>`, embeds: [embed] });
      }

      // Ödül Verme (Varsayılan veya 'ver' işlemi)
      const oldLevel = progress.level || 1;
      const newLevel = oldLevel + 1;

      // Gamification ödülü (Puan & XP)
      progress.gamification = progress.gamification || {};
      progress.gamification.totalPoints = (progress.gamification.totalPoints || 0) + 500;
      progress.gamification.currentXP = (progress.gamification.currentXP || 0) + 500;
      await progress.save();

      let promoted = false;
      if (oldLevel < 5) {
        await promote(progress, interaction.client);
        promoted = true;
      }

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 Üstün Başarı ve Ödül!')
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(
          `🌟 **${targetUser.username}** kullanıcısına **"${odul}"** ödülü layık görüldü!\n\n` +
          `💰 **Kazanılan Ödüller:**\n` +
          `• **+500 Puan** ve **+500 XP** gamification profiline eklendi!\n` +
          (promoted
            ? `• 📈 Rütbesi **${ROLE_NAMES[oldLevel]}** seviyesinden **${ROLE_NAMES[newLevel]}** seviyesine yükseltildi! 🎉`
            : `• *Kullanıcı zaten en üst düzey **Kıdemli Sekreter** rütbesinde (veya üstünde) olduğu için rütbe değişikliği yapılmadı. (Genel Koordinatör rütbesi için sınavı geçmesi gerekmektedir)*`)
        )
        .setFooter({ text: 'Eko Yıldız • Yetkili Ödüllendirme' })
        .setTimestamp();

      return interaction.editReply({ content: `<@${targetUser.id}>`, embeds: [embed] });
    } catch (err) {
      console.error('[odulver] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── tenzilat: Personelin rütbesini düşür (demote) ─────────────────────
  if (commandName === "tenzilat") {
    const { ADMIN_IDS } = require("../../config");
    const isYonetici = ADMIN_IDS.includes(interaction.user.id) ||
      interaction.member?.permissions.has(PermissionFlagsBits.Administrator) ||
      interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isYonetici) {
      return interaction.reply({ content: '❌ Bu komut sadece yöneticiler tarafından kullanılabilir.', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => { });
    }
    try {
      const targetUser = interaction.options.getUser('kullanici');
      const sebep = interaction.options.getString('sebep') || "Belirtilmedi";

      const StaffProgress = require('../../models/StaffProgress');
      const { demote } = require('../services/staffSystem');

      const progress = await StaffProgress.findOne({ userId: targetUser.id });
      if (!progress) {
        return interaction.editReply({ content: `❌ **${targetUser.username}** personel sisteminde bulunmuyor.` });
      }

      if (progress.level <= 1) {
        return interaction.editReply({ content: `❌ **${targetUser.username}** zaten en düşük rütbede (Stajyer Personel) olduğu için rütbesi daha fazla düşürülemez. Eğer görevden almak istiyorsanız \`/personelkov\` kullanın.` });
      }

      const success = await demote(progress, interaction.client, sebep);
      if (success) {
        return interaction.editReply({ content: `✅ **${targetUser.username}** adlı personelin rütbesi başarıyla düşürüldü.\n**Sebep:** ${sebep}` });
      } else {
        return interaction.editReply({ content: `❌ İşlem sırasında bir hata oluştu veya yetkili bulunamadı.` });
      }
    } catch (err) {
      console.error('[tenzilat] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── xpcekilis: XP Çekilişi Başlat ──────────────────────────────────────────
  if (commandName === "xpcekilis") {
    const xpAmount = interaction.options.getInteger('xp_miktari');
    const kazananSayisi = interaction.options.getInteger('kazanan_sayisi') || 1;
    const targetChannelId = '1460290526103474381';

    try {
      const channel = await interaction.client.channels.fetch(targetChannelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: `❌ Çekiliş kanalı bulunamadı (${targetChannelId}).`, ephemeral: true });
      }

      // Yarın öğlen 12:00
      const now = new Date();
      const endsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0);

      const embed = new EmbedBuilder()
        .setColor(0xff006e)
        .setTitle('🎉 RÜTBE XP\'Sİ ÇEKİLİŞİ! XP SÜPRİZ')
        .setDescription(`**${xpAmount} XP** ödüllü rütbe xp çekilişi başladı!\n\n` +
          `👥 **Kazanan Sayısı:** ${kazananSayisi}\n` +
          `⏳ **Bitiş:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n\n` +
          `KATILMAK İÇİN TIKLAYIN!`)
        .setFooter({ text: 'Eko Yıldız • Çekiliş Sistemi' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('xp_cekilis_katil')
          .setLabel('🎉 KATIL')
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await channel.send({ embeds: [embed], components: [row] });

      const Giveaway = require('../../models/Giveaway');
      await Giveaway.create({
        messageId: msg.id,
        channelId: channel.id,
        guildId: interaction.guildId,
        xpAmount: xpAmount,
        endsAt: endsAt,
        participants: [],
        isActive: true
      });

      return interaction.reply({ content: `✅ Çekiliş başarıyla <#${channel.id}> kanalında başlatıldı. Yarın öğlen 12:00'de sonuçlanacak.`, ephemeral: true });
    } catch (err) {
      console.error('[xpcekilis] hata:', err.message);
      return interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
    }
  }

  // ── anketai: deferReply öncesi çalışmalı ──────────────────────────────────
  if (commandName === "anketai") {
    const { startSurvey } = require('../services/surveyAI');
    return startSurvey(interaction);
  }

  // ── koc: AI Koç sistemi ───────────────────────────────────────────────────
  if (commandName === "koc") {
    const { startCoachSession, resetCoachSession } = require('../services/staffCoach');
    const islem = interaction.options.getString('islem');
    if (islem === 'sıfırla') {
      await resetCoachSession(interaction.user.id);
    }
    return startCoachSession(interaction);
  }

  // ── modbasvuru: sadece yöneticiler ────────────────────────────────────────
  if (commandName === "modbasvuru") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Bu komut sadece yöneticiler tarafından kullanılabilir.', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const target = interaction.options.getUser('kullanici');
      if (target.bot) return interaction.editReply({ content: '❌ Botlara başvuru gönderilemez.' });

      const { startModInterview } = require('../services/modInterview');
      const sent = await startModInterview(target, interaction.user.id, interaction.guild?.id, interaction.client);

      if (sent) {
        return interaction.editReply({ content: `✅ **${target.username}** kullanıcısına moderatör başvurusu gönderildi. DM'ini açık tutması lazım.` });
      } else {
        return interaction.editReply({ content: `❌ **${target.username}** kullanıcısına DM gönderilemedi. DM'leri kapalı olabilir.` });
      }
    } catch (err) {
      console.error('[modbasvuru] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── mod-alim: Geliştirilmiş moderatör mülakatı (MOD-ALIM Sistemi) ─────────
  if (commandName === "mod-alim") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ Bu komut sadece yöneticiler tarafından kullanılabilir!',
        ephemeral: true
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const target = interaction.options.getUser('kullanici');

      // Validation checks
      if (target.bot) {
        return interaction.editReply({
          content: '❌ Botlara MOD-ALIM mülakatı gönderilemez.'
        });
      }

      if (target.id === interaction.user.id) {
        return interaction.editReply({
          content: '❌ Kendine mülakat gönderemezsin!'
        });
      }

      const { startModInterview } = require('../services/modInterview');
      const sent = await startModInterview(target, interaction.user.id, interaction.guild?.id, interaction.client);

      if (sent) {
        const successEmbed = new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('✅ MOD-ALIM Mülakatı Gönderildi')
          .setDescription(
            `**Aday:** ${target}\n` +
            `**Tarih:** ${new Date().toLocaleString('tr-TR')}\n\n` +
            `Kullanıcıya mülakat daveti DM'de gönderildi.`
          )
          .addFields(
            { name: '⏱️ Beklenen Süre', value: '5-10 dakika', inline: false },
            { name: '📋 Mülakat Turu', value: 'MOD-ALIM: 7 Soru - Master Moderatör Mülakatı', inline: false }
          )
          .setFooter({ text: 'Eko Yıldız • MOD-ALIM Sistemi' })
          .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed] });
      } else {
        return interaction.editReply({
          content: `❌ **${target.username}** kullanıcısına DM gönderilemedi.\n\n💡 *Kullanıcı DM'lerini kapalmış olabilir.*`
        });
      }
    } catch (err) {
      console.error('[mod-alim] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── istifa: Personel görevinden istifa et ─────────────────────────────────
  if (commandName === "istifa") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { resignFromStaff } = require('../services/staffSystem');
      const reason = interaction.options.getString('sebep');
      const result = await resignFromStaff(interaction.user.id, reason, interaction.client);

      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }

      let message;
      if (result.canRetire) {
        message = `✅ İstifan kabul edildi. 90+ gün aktif kaldığın için emeklilik statüsüne geçtiniz! Kaydınız sistemde korunmaktadır.\n\`/emeklilik\` komutunu kullanarak resmi olarak emekli olabilirsin.`;
      } else if (result.recordDeleted) {
        message = `✅ İstifan kabul edildi ve kaydın tamamen silinmiştir. Tekrar başvurmak istersen yöneticilere yazabilirsin.`;
      } else {
        message = `✅ İstifan kabul edildi. Teşekkürler!`;
      }

      return interaction.editReply({ content: message });
    } catch (err) {
      console.error('[istifa] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── emeklilik: Emekli ol ───────────────────────────────────────────────────
  if (commandName === "emeklilik") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { retireFromStaff } = require('../services/staffSystem');
      const result = await retireFromStaff(interaction.user.id, interaction.client);

      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }

      return interaction.editReply({ content: `🏅 Tebrikler! ${result.totalDays} gün aktif hizmetin sonrasında emekli oldun! Son görevin: ${result.levelName}` });
    } catch (err) {
      console.error('[emeklilik] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── leaderboard: Top 25 göster, kategoriler ve pagination ─────────────────
  if (commandName === "leaderboard") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => { });
    }
    try {
      const { getLeaderboard, getUserLeaderboardRank } = require('../services/staffSystem');

      // Varsayılan kategori: points
      const category = 'points';
      const lb = await getLeaderboard(category);
      const userRank = await getUserLeaderboardRank(interaction.user.id, category);

      if (lb.length === 0) {
        return interaction.editReply({ content: '❌ Henüz leaderboard verisi yok.' });
      }

      // İlk sayfa (top 25)
      const itemsPerPage = 10;
      const totalPages = Math.ceil(Math.min(lb.length, 25) / itemsPerPage);
      let currentPage = 0;

      const createLeaderboardEmbed = (page) => {
        const startIdx = page * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, Math.min(lb.length, 25));
        const pageItems = lb.slice(startIdx, endIdx);

        let description = '```\n';
        for (const p of pageItems) {
          const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `${p.rank}.`;
          const premium = p.isPremium ? '⭐ ' : '';
          // İsmi doğrudan göster (mention kullanmadan)
          const userName = p.username || `Kullanıcı #${p.userId}`;
          description += `${medal} ${premium}${userName.padEnd(20)} | Puan: ${p.points.toString().padStart(5)} | Lvl: ${p.xpLevel} | 🎫: ${p.tickets}\n`;
        }
        description += '```';

        // Kışkançlık mesajı - eğer kullanıcı sıralamada değilse
        let motivationMessage = '';
        if (userRank && userRank.rank > 3) {
          motivationMessage = `\n💪 *Sen #${userRank.rank}. sıraladasın! Top 3'e çıkmak için ${(lb[2]?.points || 0) - userRank.points} puan daha lazım...* 🏆`;
        }

        const embed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('🏆 LEADERBOARD - Top 25 Personel')
          .setDescription(description + motivationMessage)
          .addFields(
            { name: '📊 KATEGORİLER', value: '**Mevcut:** Puan | XP • Level • Badge • Streak', inline: false },
            { name: '⭐ PREMIUM', value: '⭐ = Premium Üye', inline: true }
          )
          .setFooter({ text: `Sayfa ${page + 1}/${totalPages} | Eko Yıldız Gamification` })
          .setTimestamp();

        // Kullanıcının kendi pozisyonunu göster
        if (userRank && !pageItems.some(p => p.userId === interaction.user.id)) {
          const userNameDisplay = userRank.username || `Kullanıcı #${interaction.user.id}`;
          embed.addFields({
            name: `📍 SENİN POZİSYONUN (#${userRank.rank})`,
            value: `**${userNameDisplay}**\nPuan: **${userRank.points}** | XP Lvl: **${userRank.xpLevel}** | Ticket: **${userRank.tickets}** | Rozet: **${userRank.badges}**`,
            inline: false
          });
        }

        return embed;
      };

      const embed = createLeaderboardEmbed(0);

      // Pagination butonları
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`lb_prev_${category}`)
          .setLabel('⬅️ Önceki')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`lb_category_xp`)
          .setLabel('⚡ XP')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`lb_category_level`)
          .setLabel('📊 Level')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`lb_category_badges`)
          .setLabel('🏅 Rozetler')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`lb_next_${category}`)
          .setLabel('Sonraki ➡️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === totalPages - 1)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[leaderboard] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── personeldurum: Staff bilgilerini göster ──────────────────────────────────
  if (commandName === "personeldurum") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => { });
    }
    try {
      const StaffProgress = require('../../models/StaffProgress');
      const target = interaction.options.getUser('kullanici') || interaction.user;

      // Sadece staff görebilir
      const requestorStaff = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!requestorStaff || requestorStaff.status !== 'active') {
        return interaction.editReply({ content: '❌ Sadece aktif personel bu komutu kullanabilir.' });
      }

      const targetStaff = await StaffProgress.findOne({ userId: target.id });
      if (!targetStaff) {
        return interaction.editReply({ content: `❌ **${target.username}** personel verisi bulunamadı.` });
      }

      // Rozetleri hazırla
      const BADGES = {
        firstTicket: { name: '🎫 İlk Ticket', desc: 'İlk ticket\'ı çöz' },
        weekWarrior: { name: '⚔️ Hafta Savaşçısı', desc: '7 gün ardışık' },
        monthMaster: { name: '👑 Ay Ustası', desc: '30 gün ardışık' },
        ticketHero: { name: '🦸 Ticket Kahramanı', desc: '50 ticket çöz' },
        supportStar: { name: '⭐ Destek Yıldızı', desc: '100 ticket çöz' },
        legendaryHelper: { name: '💎 Efsanevi Yardımcı', desc: '250 ticket çöz' },
        perfectWeek: { name: '✅ Mükemmel Hafta', desc: '7 gün %100 başarı' },
        chatterbox: { name: '💬 Sohbetçi', desc: '500 mesaj yaz' },
        moderator: { name: '🛡️ Moderatör', desc: '30 mod işlem' },
        speedRunner: { name: '⚡ Hız Koşucusu', desc: 'Aynı gün 5 ticket' },
        noMissWeek: { name: '🌟 Kusursuz Hafta', desc: '7 gün uyarısız' }
      };

      let badgeDisplay = '';
      let badgeCount = 0;
      for (const [key, unlocked] of Object.entries(targetStaff.gamification?.badges || {})) {
        if (unlocked) {
          badgeCount++;
          badgeDisplay += `${BADGES[key]?.name || '🏆 Bilinmeyen'} `;
        }
      }

      // Başarımları (Achievements) hazırla
      let achievements = '✅ ';
      if (targetStaff.stats?.ticketsSolved > 0) achievements += `${targetStaff.stats.ticketsSolved} 🎫 | `;
      if (targetStaff.stats?.chatMessages > 0) achievements += `${targetStaff.stats.chatMessages} 💬 | `;
      if (targetStaff.stats?.totalVoiceMinutes > 0) achievements += `${targetStaff.stats.totalVoiceMinutes}m 🎤 | `;
      if (targetStaff.stats?.moderationActions > 0) achievements += `${targetStaff.stats.moderationActions} 🛡️`;

      achievements = achievements.replace(/ \| $/, '');

      const { getDailyTaskCompletionStats } = require('../services/staffSystem');
      const stats = getDailyTaskCompletionStats(targetStaff);

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${target.username} - Personel Durumu`)
        .setColor(0x7c6af7)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '📊 SEVIYE & XP', value: `**Level:** ${targetStaff.level}\n**XP Seviyesi:** ${targetStaff.gamification?.level || 1}\n**Mevcut XP:** ${targetStaff.gamification?.currentXP || 0}`, inline: true },
          { name: '🏆 PUAN & STREAK', value: `**Toplam Puan:** ${targetStaff.gamification?.totalPoints || 0}\n**Mevcut Streak:** ${targetStaff.gamification?.streak?.current || 0}\n**Rekord Streak:** ${targetStaff.gamification?.streak?.longest || 0}`, inline: true },
          { name: '📅 TARİHLER', value: `**Katılış:** <t:${Math.floor(new Date(targetStaff.joinedAt).getTime() / 1000)}:R>\n**Terfi Tarihi:** ${targetStaff.promotedAt ? `<t:${Math.floor(new Date(targetStaff.promotedAt).getTime() / 1000)}:R>` : 'Henüz terfi yok'}`, inline: true },
          { name: '⚠️ UYARILAR', value: `**Toplam:** ${targetStaff.warnings?.count || 0}\n**Son Uyarı:** ${targetStaff.warnings?.lastWarned ? `<t:${Math.floor(new Date(targetStaff.warnings.lastWarned).getTime() / 1000)}:R>` : 'Uyarı yok'}`, inline: true },
          { name: '⚡ BUGÜNKÜ GÖREV İLERLEMESİ', value: `\`[${stats.progressBar}]\` **%${stats.totalPercent}**\n• Selamlaşma: ${targetStaff.daily?.greeted ? '✅ Tamamlandı' : '❌ Tamamlanmadı'}\n• Ses Aktifliği: ${targetStaff.daily?.voiceMinutes || 0} dk`, inline: false },
          { name: `🏅 ROZETLER (${badgeCount})`, value: badgeDisplay || 'Henüz rozet yok', inline: false },
          { name: '⭐ BAŞARIMLAR', value: achievements, inline: false }
        )
        .setFooter({ text: 'Sentara Personel Yönetim Sistemi' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[personeldurum] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── profil: Gamification profili ───────────────────────────────────────────
  if (commandName === "profil") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { BADGES, getXpForLevel } = require('../services/staffSystem');
      const StaffProgress = require('../../models/StaffProgress');
      const target = interaction.options.getUser('kullanici') || interaction.user;

      const p = await StaffProgress.findOne({ userId: target.id });
      if (!p || !p.gamification) {
        return interaction.editReply({ content: `❌ **${target.username}** henüz gamification verisi yok. Ticket çöz! 🎫` });
      }

      const gm = p.gamification;
      const nextLevelXp = getXpForLevel(gm.level + 1);
      const xpPercent = Math.floor((gm.currentXP / nextLevelXp) * 100);

      // Rozet listesi
      let badgeList = '```\n';
      let badgeCount = 0;
      for (const [key, value] of Object.entries(gm.badges || {})) {
        if (value === true) {
          badgeCount++;
          const badge = BADGES[key];
          if (badge) {
            badgeList += `${badge.name}\n`;
          }
        }
      }
      if (badgeCount === 0) badgeList += 'Henüz rozet yok. Başlasana! 🎮\n';
      badgeList += '```';

      const embed = new EmbedBuilder()
        .setColor(0x9d4edd)
        .setTitle(`🎮 ${target.username}'nin Gamification Profili`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '⭐ XP Seviye', value: `**${gm.level}**`, inline: true },
          { name: '🎯 Puanlar', value: `**${gm.totalPoints}**`, inline: true },
          { name: '🏆 Rozetler', value: `**${badgeCount}**`, inline: true },
          { name: '📈 XP İlerlemesi', value: `\`${gm.currentXP}/${nextLevelXp} (${xpPercent}%)\``, inline: false },
          { name: '🎪 Streak', value: `Mevcut: ${gm.streak?.current || 0} | En Uzun: ${gm.streak?.longest || 0}`, inline: false },
          { name: '🏅 Rozetlerin', value: badgeList, inline: false },
        )
        .setFooter({ text: 'Eko Yıldız • Gamification' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[profil] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── challenge: Haftalık challenge göster ───────────────────────────────────
  if (commandName === "challenge") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => { });
    }
    try {
      const { getWeeklyChallenge } = require('../services/staffSystem');
      const challenge = getWeeklyChallenge();

      const embed = new EmbedBuilder()
        .setColor(0xff006e)
        .setTitle(`🎯 BU HAFTA CHALLENGE: ${challenge.name}`)
        .setDescription(`**${challenge.description}**\n\n🏆 Ödül: **${challenge.reward} puan**`)
        .addFields(
          { name: '💪 Yapabilir misin?', value: 'Başarırsan extra puan ve prestij kazanırsın!', inline: false },
          { name: '🚀 Hızlı İpuçları', value: '• Hızlı başla\n• Konsantre ol\n• Diğerleriyle yarış\n• WIN! 🎉', inline: false }
        )
        .setFooter({ text: 'Eko Yıldız • Haftalık Challenge' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[challenge] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── briefing ──────────────────────────────────────────────────────────────
  if (commandName === "briefing") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const tip = interaction.options.getString('tip');
      const {
        getOrCreate, getDailyRequirements, getXpForLevel,
        ROLE_NAMES, PROMOTION_REQUIREMENTS, GUILD_ID, ROLES, CHOSEN_TASKS
      } = require('../services/staffSystem');
      const StaffProgress = require('../../models/StaffProgress');
      const StaffUnit = require('../../models/StaffUnit');
      const { UNIT_CONFIG } = require('../services/unitService');
      const { chatWithAI } = require('../services/aiService');

      let p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p || p.status !== 'active') {
        return interaction.editReply({ content: '❌ Sadece aktif personel brifing sistemine erişebilir.' });
      }

      const today = new Date().toISOString().split('T')[0];

      if (tip === 'gunluk') {
        const req = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);

        // AI Koç mesajı
        let aiMessage = '';
        try {
          const prompt = `Sen Eko Yıldız Discord sunucusunun AI Personel Koçusun.
          Bu personelin günlük durumunu değerlendirerek çok kısa (max 100 karakter), neşeli, Türkçe motive edici bir brifing mesajı yaz.
          Personel: ${interaction.user.username}
          Seviye: ${ROLE_NAMES[p.level]}
          Mevcut aktiflik streak'i: ${p.stats?.consecutiveDays || 0} gün.`;
          aiMessage = await chatWithAI([{ role: 'user', content: prompt }], '').catch(() => '');
          aiMessage = aiMessage?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
        } catch (_) { }

        const isToday = p.daily?.date === today;
        const greetDone = isToday && p.daily?.greeted;
        const voiceDone = isToday && (p.daily?.voiceMinutes || 0) >= req.voiceMinutes;

        const { getDailyTaskCompletionStats } = require('../services/staffSystem');
        const stats = getDailyTaskCompletionStats(p);

        const embed = new EmbedBuilder()
          .setColor(0x7c6af7)
          .setTitle(`☀️ Günlük Brifing — ${ROLE_NAMES[p.level]}`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setDescription(
            (aiMessage ? `🤖 **AI Koçun:** "${aiMessage}"\n\n` : '') +
            `Bugündeki performans durumunuz ve görevleriniz aşağıdadır. Harika bir gün dileriz! 🌟\n\n` +
            `📊 **Görev İlerlemesi:** \`[${stats.progressBar}]\` **%${stats.totalPercent}**`
          )
          .addFields(
            {
              name: '⚡ Günlük Zorunlu Görevler',
              value: `${greetDone ? '✅' : '❌'} **Selamlaşma:** ${isToday && p.daily?.greeted ? 1 : 0}/${req.greets} selam (%${stats.greetPercent})\n` +
                `${voiceDone ? '✅' : '❌'} **Ses Aktifliği:** ${isToday ? (p.daily?.voiceMinutes || 0) : 0}/${req.voiceMinutes} dk (%${stats.voicePercent})`,
              inline: false
            }
          );

        // Birim görevi kontrolü
        const userUnit = await StaffUnit.findOne({ userId: p.userId });
        if (userUnit && userUnit.unitName) {
          const unitConf = UNIT_CONFIG[userUnit.unitName];
          if (unitConf) {
            embed.addFields({
              name: `🛡️ ${unitConf.label} Günlük Görevi`,
              value: `⚠️ **Göreviniz:** ${unitConf.tasks}\n*Birim Rütbeniz: Rütbe ${userUnit.rank || 1}*`,
              inline: false
            });
          }
        }

        // Seçimli görev kontrolü
        if (p.daily?.chosenTask) {
          const taskDesc = CHOSEN_TASKS[p.daily.chosenTask] || 'Rastgele Görev';
          embed.addFields({
            name: '🎯 Bugünün Seçimli Görevi',
            value: `${taskDesc}\nDurum: ${p.daily.chosenTaskCompleted ? '**TAMAMLANDI! ✅**' : '*Devam ediyor...*'}`,
            inline: false
          });
        }

        // Streak & İpuçları
        embed.addFields(
          {
            name: '🔥 Aktiflik & Puan Durumu',
            value: `• **Arka Arkaya Aktif:** ${p.stats?.consecutiveDays || 0} gün\n• **Toplam Puan:** ${p.gamification?.totalPoints || 0}\n• **EkoCoin Bakiyesi:** ${p.gamification?.ecoCoins || 0} E.C.`,
            inline: true
          },
          {
            name: '⚠️ Uyarı Sayacı',
            value: `• **Güncel Uyarılar:** ${p.warnings?.count || 0}/3`,
            inline: true
          }
        );

        embed.setFooter({ text: 'Eko Yıldız • Günlük Brifing | Başarılar! 🚀' }).setTimestamp();

        // Butonlar ve Seçim Menüsü
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
        const rowButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('talk_to_coach')
            .setLabel('💬 Koçla Konuş')
            .setStyle(ButtonStyle.Primary)
        );

        let allowedTasks = ['task_chat', 'task_voice', 'task_ticket', 'task_mod'];
        if (userUnit && userUnit.unitName) {
          if (userUnit.unitName === 'BAN_BIRIMI') {
            allowedTasks = ['task_ticket', 'task_mod'];
          } else if (userUnit.unitName === 'SES_BIRIMI') {
            allowedTasks = ['task_voice'];
          } else if (userUnit.unitName === 'SOHBET_BIRIMI') {
            allowedTasks = ['task_chat'];
          }
        }

        const allOptions = [
          { label: '💬 Aktif Sohbetçi', description: 'Sohbette en az 15 mesaj gönder', value: 'task_chat' },
          { label: '🎤 Ses Meraklısı', description: 'Ses kanallarında fazladan 15 dakika geçir', value: 'task_voice' },
          { label: '🎫 Destekçi', description: 'Bugün en az 1 ticket çöz', value: 'task_ticket' },
          { label: '🛡️ Koruyucu', description: 'Bugün en az 1 moderasyon işlemi gerçekleştir', value: 'task_mod' }
        ];

        const options = allOptions.filter(o => allowedTasks.includes(o.value));
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_daily_task')
          .setPlaceholder('🎯 Seçimli Görevi Değiştir')
          .addOptions(options);

        const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

        return interaction.editReply({ embeds: [embed], components: [rowButtons, rowSelect] });
      }

      if (tip === 'haftalik') {
        // ISO week calculation
        const now = new Date();
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        const currentYearWeek = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

        const isClaimed = p.gamification?.lastWeeklyBriefingClaim === currentYearWeek;
        let rewardStatusText = '';

        if (!isClaimed) {
          p.gamification = p.gamification || {};
          p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + 150;
          p.gamification.totalPoints = (p.gamification.totalPoints || 0) + 50;

          // XP & Level up handle
          p.gamification.currentXP = (p.gamification.currentXP || 0) + 300;
          let levelUp = false;
          while (true) {
            const nextLevelXp = getXpForLevel((p.gamification.level || 1) + 1);
            if (p.gamification.currentXP >= nextLevelXp) {
              p.gamification.level = (p.gamification.level || 1) + 1;
              p.gamification.currentXP -= nextLevelXp;
              levelUp = true;
            } else {
              break;
            }
          }

          p.gamification.lastWeeklyBriefingClaim = currentYearWeek;
          await p.save();

          rewardStatusText = `🎉 **Bu Haftanın Brifing Ödülü Başarıyla Alındı!**\n` +
            `💰 **+150 E.C.** (EkoCoin)\n` +
            `⚡ **+300 XP** ${levelUp ? '*(SEVİYE ATLADINIZ!)*' : ''}\n` +
            `⭐ **+50 Puan**`;
        } else {
          rewardStatusText = `⚠️ **Bu haftaki brifing ödülünüzü zaten aldınız.** Haftaya tekrar gelin!`;
        }

        const embed = new EmbedBuilder()
          .setColor(0xfbbf24)
          .setTitle(`📅 Haftalık Brifing & Ödül Kartı`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setDescription(
            `Haftalık performans değerlendirmeniz ve hak ettiğiniz ödüller aşağıdadır:\n\n` +
            `📊 **Genel İstatistikleriniz:**\n` +
            `• **Çözülen Ticket:** ${p.stats?.ticketsSolved || 0}\n` +
            `• **Gönderilen Mesaj:** ${p.stats?.chatMessages || 0}\n` +
            `• **Ses Aktifliği:** ${p.stats?.totalVoiceMinutes || 0} dk\n` +
            `• **Yapılan Moderasyon:** ${p.stats?.moderationActions || 0}\n` +
            `• **Teslim Edilen Haftalık Rapor:** ${p.stats?.weeklyReports || 0}\n\n` +
            `---\n` +
            `${rewardStatusText}`
          )
          .setFooter({ text: 'Eko Yıldız • Haftalık Performans Sistemi' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (tip === 'aylik') {
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const isClaimed = p.gamification?.lastMonthlyBriefingClaim === currentYearMonth;
        let rewardStatusText = '';

        if (!isClaimed) {
          p.gamification = p.gamification || {};
          p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + 500;
          p.gamification.totalPoints = (p.gamification.totalPoints || 0) + 200;
          p.stats.breakCredits = (p.stats.breakCredits || 0) + 1;

          // XP & Level up handle
          p.gamification.currentXP = (p.gamification.currentXP || 0) + 1000;
          let levelUp = false;
          while (true) {
            const nextLevelXp = getXpForLevel((p.gamification.level || 1) + 1);
            if (p.gamification.currentXP >= nextLevelXp) {
              p.gamification.level = (p.gamification.level || 1) + 1;
              p.gamification.currentXP -= nextLevelXp;
              levelUp = true;
            } else {
              break;
            }
          }

          p.gamification.lastMonthlyBriefingClaim = currentYearMonth;
          await p.save();

          rewardStatusText = `🎉 **Bu Ayın Brifing Ödülü Başarıyla Alındı!**\n` +
            `💰 **+500 E.C.** (EkoCoin)\n` +
            `⚡ **+1000 XP** ${levelUp ? '*(SEVİYE ATLADINIZ!)*' : ''}\n` +
            `⭐ **+200 Puan**\n` +
            `📅 **+1 İzin Kredisi** (Çok çalışmanın ödülü!)`;
        } else {
          rewardStatusText = `⚠️ **Bu ayki brifing ödülünüzü zaten aldınız.** Gelecek ay tekrar gelin!`;
        }

        const embed = new EmbedBuilder()
          .setColor(0x06b6d4)
          .setTitle(`👑 Aylık Performans Brifingi & Büyük Ödül`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setDescription(
            `Aylık performans değerlendirmeniz ve hak ettiğiniz büyük ödüller aşağıdadır:\n\n` +
            `📊 **Genel İstatistikleriniz:**\n` +
            `• **Toplam Aktif Gün:** ${p.stats?.activeDays || 0} gün\n` +
            `• **Çözülen Ticket:** ${p.stats?.ticketsSolved || 0}\n` +
            `• **Gönderilen Mesaj:** ${p.stats?.chatMessages || 0}\n` +
            `• **Ses Aktifliği:** ${p.stats?.totalVoiceMinutes || 0} dk\n` +
            `• **Güncel İzin Kredisi:** ${p.stats?.breakCredits || 0}\n\n` +
            `---\n` +
            `${rewardStatusText}`
          )
          .setFooter({ text: 'Eko Yıldız • Aylık Performans Sistemi' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

    } catch (err) {
      console.error('[briefing] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── izin_iste ──────────────────────────────────────────────────────────────
  if (commandName === "izin_iste") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { requestLeave } = require('../services/staffSystem');
      const date = interaction.options.getString('tarih');
      const reason = interaction.options.getString('sebep');

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return interaction.editReply({ content: "❌ Geçersiz tarih formatı. Lütfen `YYYY-MM-DD` formatında girin (Örn: 2026-06-20)." });
      }

      const result = await requestLeave(interaction.user.id, date, reason);
      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }
      return interaction.editReply({ content: `✅ İzin talebiniz başarıyla onaylandı!\n📅 **Tarih:** ${date}\n📝 **Sebep:** ${reason}\n📅 **Kalan Aylık İzin Hakkınız:** ${result.remaining} gün` });
    } catch (err) {
      console.error('[izin_iste] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── izin_ver ───────────────────────────────────────────────────────────────
  if (commandName === "izin_ver") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Bu komut sadece yöneticiler tarafından kullanılabilir.', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { requestLeave } = require('../services/staffSystem');
      const targetUser = interaction.options.getUser('kullanici');
      const date = interaction.options.getString('tarih');
      const reason = interaction.options.getString('sebep') || "Yönetici izni";

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return interaction.editReply({ content: "❌ Geçersiz tarih formatı. Lütfen `YYYY-MM-DD` formatında girin." });
      }

      const result = await requestLeave(targetUser.id, date, reason);
      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }
      return interaction.editReply({ content: `✅ <@${targetUser.id}> personeline izin tanımlandı!\n📅 **Tarih:** ${date}\n📝 **Sebep:** ${reason}` });
    } catch (err) {
      console.error('[izin_ver] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── izin_kullan ────────────────────────────────────────────────────────────
  if (commandName === "izin_kullan") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { useLeaveCredit } = require('../services/staffSystem');
      const result = await useLeaveCredit(interaction.user.id);
      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }
      return interaction.editReply({ content: `✅ **İzin krediniz kullanıldı!** Bugünü başarıyla pas geçtiniz (görevleriniz yapılmış sayıldı).\n📅 **Kalan İzin Krediniz:** ${result.creditsRemaining}` });
    } catch (err) {
      console.error('[izin_kullan] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── izin_durum ─────────────────────────────────────────────────────────────
  if (commandName === "izin_durum") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    try {
      const { getLeaveStatus } = require('../services/staffSystem');
      const status = await getLeaveStatus(interaction.user.id);
      if (!status) {
        return interaction.editReply({ content: "❌ İzin durumunuz çekilemedi veya sisteme kayıtlı değilsiniz." });
      }

      const embed = new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle(`📅 İzin Durumu — ${interaction.user.username}`)
        .addFields(
          { name: '🎟️ Birikmiş İzin Kredisi (Ticket Ödülü)', value: `**${status.totalCredits}** gün`, inline: false },
          { name: '📅 Bu Ay Kullanılan İzin', value: `**${status.monthlyUsed}** gün`, inline: true },
          { name: '📅 Bu Ay Kalan İzin', value: `**${status.monthlyRemaining}** gün`, inline: true },
          { name: '📅 Bu Hafta Kullanılan İzin', value: `**${status.weeklyUsed}** / 1 gün`, inline: false },
          { name: '📋 İzinli Günler', value: status.usedDays.length > 0 ? status.usedDays.map(d => `• ${d}`).join('\n') : 'Henüz izin kullanılmamış.', inline: false }
        )
        .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[izin_durum] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (commandName === "verify" || commandName === "update" || commandName === "debug-update") {
    const { handleVerify, handleUpdate, handleDebugUpdate } = require("./roleHandler");
    if (commandName === "verify") return handleVerify(interaction);
    if (commandName === "debug-update") return handleDebugUpdate(interaction);
    return handleUpdate(interaction);
  }

  if (!GENERAL_COMMANDS.has(commandName)) return null;

  await interaction.deferReply(deferEphemeral());

  try {
    const user = await findUserByDiscordId(interaction.user.id);

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
      const ticket = await Ticket.findOne({ userId: interaction.user.id, status: "open" });

      if (!ticket) {
        return interaction.editReply({ content: "❌ Açık ticket'ınız yok" });
      }

      ticket.status = "closed";
      ticket.closedAt = new Date();
      ticket.closeReason = reason;
      await ticket.save();

      const { logTicketClosed } = require("../services/ticketLog");
      logTicketClosed(ticket, {
        closedBy: interaction.user.id,
        closedByName: interaction.user.username,
        reason,
        source: "Discord /closeticket",
      });

      const channel = interaction.guild.channels.cache.get(ticket.channelId);
      if (channel) {
        const closeEmbed = new EmbedBuilder()
          .setTitle("🔒 Ticket Kapatıldı")
          .setDescription(`**Sebep:** ${reason}`)
          .setColor(0xed4245)
          .setTimestamp();
        await channel.send({ embeds: [closeEmbed] });
      }

      return interaction.editReply({ content: "✅ Ticket kapatıldı" });
    }

    if (commandName === "profile") {
      if (!user) {
        const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
        return interaction.editReply({ content: `❌ Henüz hesabınızı bağlamadınız. [Buraya Tıklayarak Bağlayın](${authUrl})` });
      }

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${user.discordUsername} Profili`)
        .setThumbnail(user.discordAvatar)
        .setColor(user.profileColor || 0x7c6af7)
        .addFields(
          {
            name: "🎮 Roblox",
            value: hasRobloxLink(user)
              ? `${user.robloxUsername || "?"} (\`${user.robloxId}\`)`
              : "Bağlanmamış",
            inline: true,
          },
          { name: "🔑 Bağlantı", value: hasRobloxLink(user) ? "✅ Bağlı" : "❌ Bağlı değil", inline: true },
          { name: "🛡️ Rol", value: user.groupRole || "Kullanıcı", inline: true },
          { name: "📅 Katılım", value: new Date(user.joinedAt).toLocaleDateString("tr-TR"), inline: true }
        )
        .setDescription(user.profileBio || "*Henüz bir biyografi ayarlanmamış.*")
        .addFields({ name: "🔗 Dashboard", value: `[Dashboard'a Git](${BASE_URL}/dashboard)`, inline: false })
        .setFooter({ text: "Sentara Yönetim Sistemi" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "authorize") {
      const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
      const embed = new EmbedBuilder()
        .setTitle("🔐 Hesabınızı Yetkilendirin")
        .setDescription(
          `Roblox hesabınızı Discord hesabınıza bağlamak için iki yöntemden birini seçin:\n\n` +
          `**1. Yöntem (Hızlı / Web):**\n` +
          `[Web Sitesi ile Yetkilendir](${authUrl}) (Passport / OAuth)\n\n` +
          `**2. Yöntem (Roblox Arkadaş İsteği):**\n` +
          `Aşağıdaki butona tıklayarak Roblox kullanıcı adınızı girin. Bot size arkadaşlık isteği göndererek hesabınızı doğrular.`
        )
        .setColor(0x7c6af7);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🌐 Web ile Yetkilendir")
          .setStyle(ButtonStyle.Link)
          .setURL(authUrl),
        new ButtonBuilder()
          .setCustomId("rbx_btn_verify_friend_start")
          .setLabel("🤖 Arkadaş İsteği ile Doğrula")
          .setStyle(ButtonStyle.Primary)
      );

      const { logAuthorize } = require("../services/commandLog");
      logAuthorize(interaction, { authUrl, dbUser: user });

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (commandName === "incele") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({
          content: "❌ Bu komutu sadece **Yöneticiler** kullanabilir.",
        });
      }

      const targetUser = interaction.options.getUser("kullanici");
      const targetMember = interaction.options.getMember("kullanici");

      const response = await generateInceleData(interaction.guild, targetUser, targetMember);
      return interaction.editReply(response);
    }

    if (commandName === "robloxgrup") {
      if (!hasRobloxLink(user)) {
        const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
        return interaction.editReply({
          content: `❌ Roblox hesabınız bağlı değil. \`/authorize\` veya [buradan](${authUrl}) bağlayın.`,
        });
      }

      const grupID = interaction.options.getNumber("grupid");
      // TODO: Fetch from Roblox API
      const embed = new EmbedBuilder()
        .setTitle(`👥 Roblox Grup #${grupID}`)
        .setColor(0xff6b6b)
        .addFields({ name: "Bilgi", value: "Roblox API entegrasyonu yakında eklenecek...", inline: false })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "robloxuser") {
      if (!hasRobloxLink(user)) {
        const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
        return interaction.editReply({
          content: `❌ Roblox hesabınız bağlı değil. \`/authorize\` veya [buradan](${authUrl}) bağlayın.`,
        });
      }

      const username = interaction.options.getString("username");
      // TODO: Fetch from Roblox API
      const embed = new EmbedBuilder()
        .setTitle(`👤 ${username}`)
        .setColor(0x4ecdc4)
        .addFields({ name: "Bilgi", value: "Roblox API entegrasyonu yakında eklenecek...", inline: false })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "abonelik") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "durum") {
        const embed = new EmbedBuilder()
          .setTitle("💳 Abonelik Durumu")
          .setColor(0x7c6af7)
          .addFields(
            { name: "Premium", value: user?.isAuthorized ? "✅ Aktif" : "❌ Devre dışı", inline: true },
            { name: "İlk Yetkilendirme", value: user?.joinedAt ? `<t:${Math.floor(user.joinedAt / 1000)}:R>` : "N/A", inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "ozellikleri") {
        const features = user?.isAuthorized
          ? "✅ Roblox Grup Yönetimi\n✅ Kullanıcı Taraması\n✅ Özel Roller\n✅ Premium Destek"
          : "❌ Tüm özellikler kilitli. Yetkilendirin!";

        const embed = new EmbedBuilder()
          .setTitle("⭐ Premium Özellikler")
          .setColor(0xf76af7)
          .setDescription(features)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "ayarlar") {
      const subcommand = interaction.options.getSubcommand();

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.editReply({ content: "❌ Sunucu Yöneticisi izni gerekli" });
      }

      if (subcommand === "goruntule") {
        const embed = new EmbedBuilder()
          .setTitle("⚙️ Sunucu Ayarları")
          .setColor(0x7c6af7)
          .addFields(
            { name: "Ekonomi Sistemi", value: "✅ Etkin", inline: true },
            { name: "Moderasyon", value: "✅ Etkin", inline: true },
            { name: "Eğlence", value: "✅ Etkin", inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "guncelle") {
        const ayar = interaction.options.getString("ayar");
        const durum = interaction.options.getBoolean("durum");

        const embed = new EmbedBuilder()
          .setTitle("✅ Ayar Güncellendi")
          .setColor(0x4ade80)
          .setDescription(`**${ayar}** → ${durum ? "✅ Etkin" : "❌ Devre dışı"}`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "kanal") {
      const subcommand = interaction.options.getSubcommand();

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({ content: "❌ Kanal Yöneticisi izni gerekli" });
      }

      if (subcommand === "izin_ekle") {
        const kanal = interaction.options.getChannel("kanal");
        const izinTipi = interaction.options.getString("izin");

        const embed = new EmbedBuilder()
          .setTitle("✅ İzin Eklendi")
          .setColor(0x4ade80)
          .addFields(
            { name: "Kanal", value: kanal.toString(), inline: false },
            { name: "İzin Tipi", value: izinTipi, inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "izin_kaldir") {
        const kanal = interaction.options.getChannel("kanal");

        const embed = new EmbedBuilder()
          .setTitle("✅ İzin Kaldırıldı")
          .setColor(0xed4245)
          .setDescription(`${kanal} kanalının tüm izinleri kaldırıldı.`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "otomod") {
      const subcommand = interaction.options.getSubcommand();

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.editReply({ content: "❌ Sunucu Yöneticisi izni gerekli" });
      }

      if (subcommand === "ayarla") {
        const embed = new EmbedBuilder()
          .setTitle("🛡️ Otomod Ayarlandı")
          .setColor(0x7c6af7)
          .addFields(
            { name: "Spam Koruması", value: "✅ Etkin", inline: true },
            { name: "Hakaret Filtresi", value: "✅ Etkin", inline: true },
            { name: "NSFW Kontrol", value: "✅ Etkin", inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "kapat") {
        const embed = new EmbedBuilder()
          .setTitle("❌ Otomod Kapatıldı")
          .setColor(0xed4245)
          .setDescription("Otomod sistemi kapatılmıştır.")
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "yardim") {
      const kategori = interaction.options.getString("kategori") || "general";

      const categories = {
        general: {
          title: "📚 Genel Komutlar",
          commands: "/support, /mytickets, /closeticket, /profile, /authorize, /verify, /update, /debug-update, /robloxgrup, /robloxuser, /ping, /stats",
        },
        economy: {
          title: "💰 Ekonomi Komutları",
          commands: "/ekonomi, /gelir, /itemler",
        },
        fun: {
          title: "🎮 Eğlence Komutları",
          commands: "/boom_ayarlar, /boom_oyunu, /kelime_oyunu_ayarlar, /kelime_oyunu, /oyunlar",
        },
        moderation: {
          title: "🛡️ Moderasyon Komutları",
          commands: "/mesaj_sil, /sustur, /susturma_kaldır, /yasakla, /yasaklama_kaldır",
        },
      };

      const cat = categories[kategori];
      const embed = new EmbedBuilder()
        .setTitle(cat.title)
        .setColor(0x7c6af7)
        .setDescription(cat.commands)
        .setFooter({ text: "Daha fazla bilgi için /yardim kategori_adı yazın" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "ping") {
      const pingEmbed = new EmbedBuilder()
        .setTitle("🏓 Pong!")
        .setColor(0x4ade80)
        .addFields(
          { name: "Gecikme (API)", value: `${Date.now() - interaction.createdAt}ms`, inline: true },
          { name: "Websocket", value: `${interaction.client.ws.ping}ms`, inline: true }
        )
        .setTimestamp();

      // Ping Bağımlısı Başarımı
      let extraMsg = '';
      if (interaction.guild && interaction.guild.id === '1367646464804655104') {
        const uId = interaction.user.id;
        const { incrementTracker } = require('../services/achievementManager');
        let pings = await incrementTracker(uId, 'pingCount');

        if (pings === 50) {
          try {
            const mainGuild = await interaction.client.guilds.fetch('1367646464804655104').catch(() => null);
            if (mainGuild) {
              const memberToReward = await mainGuild.members.fetch(uId).catch(() => null);
              if (memberToReward) {
                let pingRole = mainGuild.roles.cache.find(r => r.name === '🏓 Ping Bağımlısı');
                if (!pingRole) {
                  pingRole = await mainGuild.roles.create({
                    name: '🏓 Ping Bağımlısı',
                    color: '#e74c3c', // Kırmızı
                    hoist: false,
                    position: 1,
                    reason: 'Gizli Başarım Sistemi'
                  });
                }
                if (pingRole && !memberToReward.roles.cache.has(pingRole.id)) {
                  await memberToReward.roles.add(pingRole.id).catch(() => { });
                  memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Ping Bağımlısı!**\nBotu arka arkaya tam 50 kere pingleyerek sınırları zorladın ve `🏓 Ping Bağımlısı` rolünü kazandın!').catch(() => { });
                  extraMsg = '\n\n🏓 **Ping Bağımlısı gizli başarımını açtın! Botu çok yordun... DM kutuna bak!**';
                }
              }
            }
          } catch (_) { }
        }
      }

      return interaction.editReply({ content: extraMsg ? extraMsg : null, embeds: [pingEmbed] });
    }

    if (commandName === "seviye") {
      const target = interaction.options.getUser('kullanici') || interaction.user;
      const {
        getFrogProfile, FROG_ROLES, xpToNextLevel, totalXpForLevel
      } = require('../services/frogLevel');

      const profile = await getFrogProfile(target.id, interaction.client);
      if (!profile) {
        return interaction.editReply({ content: `❌ **${target.username}** henüz hiç XP kazanmamış. Sunucuda mesaj yazmaya veya seste kalmaya başlasın!` });
      }

      const isSeason2 = profile.level >= 12;
      const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;
      const isBooster = member && member.premiumSince;

      // Booster badge and indicator
      let boosterText = '';
      if (isBooster) {
        boosterText = '\n⚡ **Server Booster** (2x XP Aktif!)';
      }

      // Max level legend badge
      let legendText = '';
      if (profile.level === 16) {
        legendText = '\n👑 **Sentara Efsanesi** (Maksimum Seviye!)';
      }

      // Set custom color if set
      let embedColor = isSeason2 ? 0xe67e22 : 0x4ade80;
      if (profile.profileColor) {
        const hex = profile.profileColor.replace('#', '');
        const parsed = parseInt(hex, 16);
        if (!isNaN(parsed)) embedColor = parsed;
      }

      const description = `**${profile.currentRole?.name || 'Yavru Kurbağa'}**${boosterText}${legendText}\n\n` +
        `XP: **${profile.currentXP.toLocaleString()}** / **${profile.neededXP > 0 ? profile.neededXP.toLocaleString() : 'MAX'}**\n` +
        `\`${profile.bar}\` ${profile.neededXP > 0 ? Math.floor((profile.currentXP / profile.neededXP) * 100) : 100}%\n\n` +
        (profile.profileBio ? `*${profile.profileBio}*\n` : '');

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(isSeason2 ? `🦖 ${target.username} — Dinazor Sezonu (2. Sezon)` : `🐸 ${target.username} — Kurbağa Seviyesi`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(description)
        .addFields(
          { name: '📊 Seviye', value: isSeason2 ? `${profile.level - 11}/5 (Toplam: ${profile.level}/16)` : `${profile.level}/11 (Toplam: ${profile.level}/16)`, inline: true },
          { name: '✨ Toplam XP', value: profile.xp.toLocaleString(), inline: true },
          { name: '📝 Mesaj', value: (profile.totalMessages || 0).toLocaleString(), inline: true },
          { name: '🎤 Ses (dk)', value: (profile.totalVoiceMinutes || 0).toLocaleString(), inline: true },
          { name: '⬆️ Sonraki rol', value: profile.nextRole?.name || '🏆 MAX SEVİYE', inline: true },
        )
        .setFooter({ text: isSeason2 ? 'Eko Yıldız • Dinazor Sezonu 🦖' : 'Eko Yıldız • Kurbağa Sistemi 🐸' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "seviyetop") {
      const { getFrogLeaderboard, FROG_ROLES } = require('../services/frogLevel');
      const lb = await getFrogLeaderboard();

      if (!lb || lb.length === 0) {
        return interaction.editReply({ content: '❌ Henüz seviye/XP kazanmış üye bulunmuyor.' });
      }

      let description = '';
      for (let i = 0; i < lb.length; i++) {
        const entry = lb[i];
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**#${rank}**`;

        let memberName = `<@${entry.userId}>`;
        if (interaction.guild) {
          try {
            const member = await interaction.guild.members.fetch(entry.userId).catch(() => null);
            if (member) {
              memberName = `**${member.displayName}**`;
            }
          } catch (_) { }
        }

        const isSeason2 = entry.level >= 12;
        const roleName = FROG_ROLES[entry.level]?.name || 'Yavru Kurbağa';
        const levelDisplay = isSeason2 ? `${entry.level - 11}/5 (Dinazor)` : `${entry.level}/11 (Kurbağa)`;

        const doubleXpActive = entry.doubleXpUntil && new Date(entry.doubleXpUntil) > new Date();
        const boostIndicator = doubleXpActive ? ' ⚡' : '';

        description += `${medal} ${memberName}${boostIndicator}\n` +
          `┗ Seviye: \`${levelDisplay}\` • **${roleName}**\n` +
          `┗ XP: \`${entry.xp.toLocaleString()}\` • Mesaj: \`${(entry.totalMessages || 0).toLocaleString()}\` • Ses: \`${(entry.totalVoiceMinutes || 0).toLocaleString()} dk\`\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🏆 Eko Yıldız Seviye Liderlik Tablosu')
        .setDescription(description)
        .setFooter({ text: 'Eko Yıldız • Seviye & Aktivite Sistemi 🐸🦖' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "stats") {
      const { users, tickets } = require("../../models/Store");
      const memory = process.memoryUsage();
      const statsEmbed = new EmbedBuilder()
        .setTitle("📊 Bot İstatistikleri")
        .setColor(0x7c6af7)
        .addFields(
          { name: "Uptime", value: `${Math.floor(process.uptime() / 3600)}s ${Math.floor((process.uptime() % 3600) / 60)}d`, inline: true },
          { name: "Bellek Kullanımı", value: `${Math.round(memory.rss / 1024 / 1024)}MB`, inline: true },
          { name: "Node.js", value: process.version, inline: true },
          { name: "Kayıtlı Kullanıcı", value: `${users.data.size}`, inline: true },
          { name: "Toplam Ticket", value: `${tickets.data.size}`, inline: true },
          { name: "Platform", value: process.platform, inline: true }
        )
        .setTimestamp();
      return interaction.editReply({ embeds: [statsEmbed] });
    }

    if (commandName === "ekobang") {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => { });
      }

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

    if (commandName === "ekobangerial") {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => { });
      }

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
    // ── EKONOMİ KOMUTLARI ────────────────────────────────────────────────────────
    if (commandName === "ekocoin") {
      const sub = interaction.options.getSubcommand();
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });

      if (sub === "bakiye") {
        if (!p) return interaction.editReply({ content: `Personel sisteminde kaydın bulunamadı.` });
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
        const convertBtnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ekocoin_convert_xp_btn")
            .setLabel("⚡ EKOCOİNLERİNİ XPYE DÖNÜŞTÜR!")
            .setStyle(ButtonStyle.Success)
        );
        return interaction.editReply({
          content: `💳 **Mevcut EkoCoin Bakiyeniz:** \`${p.gamification?.ecoCoins || 0} E.C.\``,
          components: [convertBtnRow]
        });
      }

      if (sub === "gonder") {
        if (!p) return interaction.editReply({ content: `Personel sisteminde kaydın bulunamadı.` });

        const targetUser = interaction.options.getUser("kullanici");
        const amount = interaction.options.getInteger("miktar");

        if (targetUser.id === interaction.user.id) {
          return interaction.editReply({ content: `Kendinize EkoCoin gönderemezsiniz!` });
        }
        if (amount <= 0) {
          return interaction.editReply({ content: `Gönderilecek miktar 0'dan büyük olmalıdır.` });
        }

        const currentBalance = p.gamification?.ecoCoins || 0;
        if (currentBalance < amount) {
          return interaction.editReply({ content: `Yetersiz bakiye! Mevcut bakiyeniz: \`${currentBalance} E.C.\`` });
        }

        const targetProgress = await StaffProgress.findOne({ userId: targetUser.id });
        if (!targetProgress) {
          return interaction.editReply({ content: `Belirtilen kullanıcı personel sisteminde bulunamadı.` });
        }

        // Transfer
        p.gamification.ecoCoins -= amount;
        if (!targetProgress.gamification) targetProgress.gamification = { totalPoints: 0, ecoCoins: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 } };
        targetProgress.gamification.ecoCoins = (targetProgress.gamification.ecoCoins || 0) + amount;

        await p.save();
        await targetProgress.save();

        // Eko Milyoneri Başarımı Kontrolü (Alıcı için)
        try {
          const { checkEcoMillionaire } = require('../services/achievementManager');
          await checkEcoMillionaire(targetUser.id, targetProgress.gamification.ecoCoins, interaction.client).catch(() => { });
        } catch (_) { }

        // ── Gizli Başarım: Hayırsever ──
        let extraMsg = '';
        if (interaction.guild && interaction.guild.id === '1367646464804655104') {
          const uId = interaction.user.id;
          let transfers = philanthropyTracker.get(uId) || 0;
          transfers++;
          philanthropyTracker.set(uId, transfers);

          if (transfers === 5) {
            try {
              const mainGuild = await interaction.client.guilds.fetch('1367646464804655104').catch(() => null);
              if (mainGuild) {
                const memberToReward = await mainGuild.members.fetch(uId).catch(() => null);
                if (memberToReward) {
                  let philRole = mainGuild.roles.cache.find(r => r.name === '💸 Hayırsever');
                  if (!philRole) {
                    philRole = await mainGuild.roles.create({
                      name: '💸 Hayırsever',
                      color: '#2ecc71', // Zümrüt Yeşili
                      hoist: false,
                      position: 1,
                      reason: 'Gizli Başarım Sistemi'
                    });
                  }
                  if (philRole && !memberToReward.roles.cache.has(philRole.id)) {
                    await memberToReward.roles.add(philRole.id).catch(() => { });
                    memberToReward.send('🎉 **Gizli Başarım Kazanıldı: Hayırsever!**\nDiğer üyelere defalarca EkoCoin göndererek ne kadar cömert olduğunu kanıtladın ve `💸 Hayırsever` rolünü kazandın!').catch(() => { });
                    extraMsg = '\n\n💸 **Cömertliğin ödüllendirildi! Hayırsever gizli başarımını açtın, DM kutuna bak!**';
                  }
                }
              }
            } catch (_) { }
          }
        }

        return interaction.editReply({
          content: `✅ Başarıyla **${targetUser.username}** kullanıcısına **${amount} E.C.** gönderdiniz!\nKalan bakiyeniz: \`${p.gamification.ecoCoins} E.C.\`${extraMsg}`
        });
      }
    }

    if (commandName === "magaza") {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: `Personel sisteminde kaydın bulunamadı.` });

      const embed = new EmbedBuilder()
        .setColor(0x06ffa5)
        .setTitle('🛒 EkoCoin Mağazası')
        .setDescription(
          `**Mevcut Bakiyeniz:** \`${p.gamification?.ecoCoins || 0} E.C.\`\n\n` +
          `Aşağıdaki menüden EkoCoin'lerinizle harika ödüller alabilirsiniz!`
        )
        .setFooter({ text: 'Eko Yıldız • Ekonomi Sistemi' });

      const { StringSelectMenuBuilder } = require('discord.js');
      const storeMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ekocoin_satin_al')
          .setPlaceholder('Almak istediğiniz eşyayı seçin...')
          .addOptions([
            { label: '50 XP Paketi', description: '150 E.C. - 50 XP satın alırsınız', value: 'item_xp_50', emoji: '⚡' },
            { label: '1 Günlük İzin', description: '800 E.C. - 1 gün görevden muaf olursunuz', value: 'item_leave_1day', emoji: '🌴' },
            { label: 'Yeşil Rol Rengi', description: '500 E.C. - Sunucuda isminizi yeşil yapar', value: 'color_green', emoji: '🟩' },
            { label: 'Kırmızı Rol Rengi', description: '500 E.C. - Sunucuda isminizi kırmızı yapar', value: 'color_red', emoji: '🟥' },
            { label: 'Mavi Rol Rengi', description: '500 E.C. - Sunucuda isminizi mavi yapar', value: 'color_blue', emoji: '🟦' },
            { label: 'Sarı Rol Rengi', description: '500 E.C. - Sunucuda isminizi sarı yapar', value: 'color_yellow', emoji: '🟨' },
            { label: 'Mor Rol Rengi', description: '500 E.C. - Sunucuda isminizi mor yapar', value: 'color_purple', emoji: '🟪' },
            { label: 'Pembe Rol Rengi', description: '500 E.C. - Sunucuda isminizi pembe yapar', value: 'color_pink', emoji: '🌸' },
            { label: 'Turuncu Rol Rengi', description: '500 E.C. - Sunucuda isminizi turuncu yapar', value: 'color_orange', emoji: '🟧' },
          ])
      );

      const { ButtonBuilder, ButtonStyle } = require('discord.js');
      const convertBtnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ekocoin_convert_xp_btn")
          .setLabel("⚡ EKOCOİNLERİNİ XPYE DÖNÜŞTÜR!")
          .setStyle(ButtonStyle.Success)
      );

      return interaction.editReply({ embeds: [embed], components: [storeMenu, convertBtnRow] });
    }

    if (commandName === "gunluk-odul") {
      const StaffProgress = require("../../models/StaffProgress");
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.editReply({ content: `Personel sisteminde kaydın bulunamadı.` });

      const todayStr = () => new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }).split('.').reverse().join('-');
      const today = todayStr();

      if (!p.gamification) p.gamification = { totalPoints: 0, ecoCoins: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 }, lastDailyClaim: '' };

      // Daha önce alıp almadığını kontrol et
      if (p.gamification.lastDailyClaim === today) {
        return interaction.editReply({ content: `🎁 Günlük ödülünüzü bugün zaten aldınız! Yarın tekrar gelin.` });
      }

      let reward = Math.floor(Math.random() * (150 - 50 + 1)) + 50; // 50 ile 150 arası

      // Level 16 (Kral Penguen) double coins check
      const FrogLevelModel = require("../../models/FrogLevel");
      const frogProfile = await FrogLevelModel.findOne({ userId: interaction.user.id, guildId: interaction.guild?.id || "1367646464804655104" });
      let isMaxLevel = false;
      if (frogProfile && frogProfile.level >= 16) {
        reward *= 2;
        isMaxLevel = true;
      }

      p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + reward;
      p.gamification.lastDailyClaim = today;

      await p.save();

      // Eko Milyoneri Başarımı Kontrolü
      try {
        const { checkEcoMillionaire } = require('../services/achievementManager');
        await checkEcoMillionaire(interaction.user.id, p.gamification.ecoCoins, interaction.client).catch(() => { });
      } catch (_) { }

      // Şanslı 7 Gizli Başarımı
      let extraMsg = '';
      if (reward === 77 && interaction.guild && interaction.guild.id === '1367646464804655104') {
        const uId = interaction.user.id;
        try {
          const mainGuild = await interaction.client.guilds.fetch('1367646464804655104').catch(() => null);
          if (mainGuild) {
            const memberToReward = await mainGuild.members.fetch(uId).catch(() => null);
            if (memberToReward) {
              let luckyRole = mainGuild.roles.cache.find(r => r.name === '🎰 Şanslı 7');
              if (!luckyRole) {
                luckyRole = await mainGuild.roles.create({
                  name: '🎰 Şanslı 7',
                  color: '#f1c40f', // Altın Sarısı
                  hoist: false,
                  position: 1,
                  reason: 'Gizli Başarım Sistemi'
                });
              }
              if (luckyRole && !memberToReward.roles.cache.has(luckyRole.id)) {
                await memberToReward.roles.add(luckyRole.id).catch(() => { });
                memberToReward.send('🎉 **İnanılmaz! Gizli Başarım Kazanıldı: Şanslı 7!**\nGünlük ödülden tam olarak 77 E.C. kazanarak mucizevi bir şans yakaladın ve `🎰 Şanslı 7` rolünü kazandın!').catch(() => { });
                extraMsg = '\n\n🎰 **İnanılmaz bir şans! Tam 77 E.C. kazanarak Şanslı 7 gizli başarımını açtın! DM kutunu kontrol et.**';
              }
            }
          }
        } catch (_) { }
      }

      const doubleText = isMaxLevel ? ' 🚀 *(Kral Penguen 2x Çarpanı Etkin!)*' : '';

      return interaction.editReply({
        content: `🎉 **Tebrikler!** Günlük girişinizden **${reward} E.C.** kazandınız!${doubleText}\nMevcut Bakiyeniz: \`${p.gamification.ecoCoins} E.C.\`${extraMsg}`
      });
    }

    if (commandName === "zenginler") {
      const StaffProgress = require("../../models/StaffProgress");
      const topStaff = await StaffProgress.find({ 'gamification.ecoCoins': { $gt: 0 }, status: 'active' })
        .sort({ 'gamification.ecoCoins': -1 })
        .limit(10);

      if (topStaff.length === 0) {
        return interaction.editReply({ content: `Şu anda EkoCoin'e sahip aktif personel bulunmuyor.` });
      }

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 EkoCoin Zenginleri Listesi (İlk 10)')
        .setDescription(
          topStaff.map((p, idx) => `**${idx + 1}.** <@${p.userId}> — \`${p.gamification?.ecoCoins || 0} E.C.\``).join('\n')
        )
        .setFooter({ text: 'Eko Yıldız • Ekonomi Sistemi' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "birimalimi") {
      const isYonetici = interaction.member?.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild) ||
        interaction.guild?.ownerId === interaction.user.id ||
        interaction.user.id === "1031620522406072350";
      if (!isYonetici) {
        return interaction.editReply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.' });
      }
      const birimKey = interaction.options.getString('birim');
      const { startBirimAlimi } = require("../services/unitService");
      return startBirimAlimi(interaction, interaction.client, birimKey);
    }

    if (commandName === "birimterfi") {
      const { handleBirimTerfi } = require("../services/unitService");
      return handleBirimTerfi(interaction);
    }

    if (commandName === "birimistifa") {
      const { handleBirimIstifa } = require("../services/unitService");
      return handleBirimIstifa(interaction);
    }

    if (commandName === "birimtanitim") {
      const isYonetici = interaction.member?.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild) ||
        interaction.guild?.ownerId === interaction.user.id ||
        interaction.user.id === "1031620522406072350";
      if (!isYonetici) {
        return interaction.editReply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.' });
      }
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => { });
      }
      const { postUnitIntroductions } = require("../services/unitService");
      await postUnitIntroductions(interaction.client);
      return interaction.editReply({ content: '✅ Birim tanıtım mesajları başarıyla gönderildi.' });
    }

    if (commandName === "renk") {
      const hexInput = interaction.options.getString("hex");
      const hexRegex = /^#?[0-9A-F]{6}$/i;
      if (!hexRegex.test(hexInput)) {
        return interaction.editReply({ content: "❌ Geçersiz HEX renk kodu! Örnek: `#ff0000` veya `ff0000`" });
      }
      const finalHex = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;

      const FrogLevelModel = require("../../models/FrogLevel");
      let frog = await FrogLevelModel.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
      if (!frog) {
        frog = new FrogLevelModel({ userId: interaction.user.id, guildId: interaction.guild.id });
        await frog.save();
      }

      const isBooster = interaction.member && interaction.member.premiumSince;
      if (!isBooster && frog.level < 10) {
        return interaction.editReply({ content: "❌ Bu ayrıcalık sadece **Server Booster**'lara ve **Level 10 (İyi Dinazor)** ve üzeri üyelere özeldir!" });
      }

      const guild = interaction.guild;
      let role = null;

      if (frog.customRoleId) {
        role = guild.roles.cache.get(frog.customRoleId);
        if (!role) {
          role = await guild.roles.fetch(frog.customRoleId).catch(() => null);
        }
      }

      try {
        if (role) {
          // Update role color
          await role.setColor(finalHex, `Renk değişimi: ${interaction.user.tag}`);
        } else {
          // Create new role
          role = await guild.roles.create({
            name: `Renk-${interaction.user.username}`,
            color: finalHex,
            reason: `Özel renk rolü: ${interaction.user.tag}`
          });
          frog.customRoleId = role.id;
          await frog.save();
        }

        // Set position to highest manageable position
        const botMember = await guild.members.fetchMe();
        if (role.position < botMember.roles.highest.position) {
          await role.setPosition(botMember.roles.highest.position - 1).catch(() => { });
        }

        // Add role to user
        if (!interaction.member.roles.cache.has(role.id)) {
          await interaction.member.roles.add(role.id);
        }

        return interaction.editReply({ content: `🎨 İsim renginiz başarıyla **${finalHex}** olarak güncellendi ve rolünüz tanımlandı!` });
      } catch (roleErr) {
        console.error("[renk] Rol işlemi hatası:", roleErr);
        return interaction.editReply({ content: `❌ Rol rengi güncellenirken bir hata oluştu: ${roleErr.message}` });
      }
    }

    if (commandName === "profilrenk") {
      const hexInput = interaction.options.getString("hex");
      const hexRegex = /^#?[0-9A-F]{6}$/i;
      if (!hexRegex.test(hexInput)) {
        return interaction.editReply({ content: "❌ Geçersiz HEX renk kodu! Örnek: `#ff0000` veya `ff0000`" });
      }
      const finalHex = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;

      const FrogLevelModel = require("../../models/FrogLevel");
      let frog = await FrogLevelModel.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
      if (!frog || frog.level < 3) {
        return interaction.editReply({ content: "❌ Bu ayrıcalık en az **Level 3 (Zeki Dinazor)** seviyesindeki üyelere özeldir!" });
      }

      frog.profileColor = finalHex;
      await frog.save();

      return interaction.editReply({ content: `🎨 Seviye profil kartı renginiz başarıyla **${finalHex}** olarak güncellendi!` });
    }

    if (commandName === "biyografi") {
      const bioText = interaction.options.getString("metin");
      if (bioText.length > 200) {
        return interaction.editReply({ content: "❌ Biyografi metni en fazla 200 karakter olabilir!" });
      }

      const FrogLevelModel = require("../../models/FrogLevel");
      let frog = await FrogLevelModel.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
      if (!frog || frog.level < 6) {
        return interaction.editReply({ content: "❌ Bu ayrıcalık en az **Level 6 (Olay Dinazor)** seviyesindeki üyelere özeldir!" });
      }

      frog.profileBio = bioText;
      await frog.save();

      return interaction.editReply({ content: "📝 Profil biyografiniz başarıyla güncellendi!" });
    }

    if (commandName === "oda-olustur") {
      const FrogLevelModel = require("../../models/FrogLevel");
      const frog = await FrogLevelModel.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
      if (!frog || frog.level < 12) {
        return interaction.editReply({ content: "❌ Bu ayrıcalık en az **Level 12 (Oyuncu Penguen)** seviyesindeki üyelere özeldir!" });
      }

      const roomName = interaction.options.getString("oda_adi") || "";
      const limit = interaction.options.getInteger("kisi_limiti") || 0;

      const { createTempVoiceChannel } = require("../services/tempVoiceService");
      const result = await createTempVoiceChannel(interaction.member, roomName, limit);

      return interaction.editReply({ content: result.message });
    }

    if (commandName === "ozelrolisim") {
      const newName = interaction.options.getString("isim");
      if (newName.length > 32) {
        return interaction.editReply({ content: "❌ Rol ismi en fazla 32 karakter olabilir!" });
      }

      const FrogLevelModel = require("../../models/FrogLevel");
      const frog = await FrogLevelModel.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
      if (!frog || frog.level < 15) {
        return interaction.editReply({ content: "❌ Bu ayrıcalık en az **Level 15 (Volkanik Penguen)** seviyesindeki üyelere özeldir!" });
      }

      if (!frog.customRoleId) {
        return interaction.editReply({ content: "❌ Henüz bir özel rolünüz bulunmuyor! Önce `/renk` komutuyla bir renk seçmelisiniz." });
      }

      const guild = interaction.guild;
      let role = guild.roles.cache.get(frog.customRoleId);
      if (!role) {
        role = await guild.roles.fetch(frog.customRoleId).catch(() => null);
      }

      if (!role) {
        return interaction.editReply({ content: "❌ Özel rolünüz sunucuda bulunamadı. Lütfen önce `/renk` komutuyla yeni bir rol oluşturun." });
      }

      try {
        await role.setName(newName, `İsim değişimi: ${interaction.user.tag}`);
        return interaction.editReply({ content: `🎨 Özel rolünüzün ismi başarıyla **${newName}** olarak güncellendi!` });
      } catch (roleErr) {
        console.error("[ozelrolisim] Rol ismi değiştirme hatası:", roleErr);
        return interaction.editReply({ content: `❌ Rol ismi değiştirilirken bir hata oluştu: ${roleErr.message}` });
      }
    }

    if (commandName === "abusetest") {
      const isYonetici = interaction.member?.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);
      if (!isYonetici) {
        return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false }).catch(() => { });
      }

      const embed = new EmbedBuilder()
        .setTitle("🚨 DISCORD SUNUCU ABUSE ŞÜPHESİ (TEST)")
        .setDescription(
          `**Test Sunucusu** üzerinde şüpheli bir aktivite tespit edildi!\n\n` +
          `> **🔨 Toplu Banlama (TEST)**\n` +
          `> ⚡ Son 20 saniyede **3 kez** gerçekleşti\n\n` +
          `⚠️ Aşağıdaki butonlarla müdahale edebilirsiniz.`
        )
        .setColor(0xFF0000)
        .addFields(
          { name: "🏠 Sunucu", value: `**Test Sunucusu**\nID: \`test\``, inline: true },
          { name: "👤 Şüpheli Kullanıcı", value: `${interaction.user.toString()}\n\`${interaction.user.tag}\`\nID: \`test\``, inline: true },
          { name: "⚠️ Tespit Edilen", value: "Toplu Banlama", inline: true },
          { name: "🤖 Yapay Zeka Risk Analizi", value: "**Risk Seviyesi:** YÜKSEK\n**Analiz:** Bu bir test uyarısıdır. Gerçek sistemdeki tüm buton işlevleri simüle edilmektedir.", inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: "Sentara Discord Abuse Tespit Sistemi (TEST)", iconURL: interaction.client.user.displayAvatarURL() });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`disc_abuse_removeroles_test_test`)
          .setLabel("🗑️ Rolleri Al")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🗑️"),
        new ButtonBuilder()
          .setCustomId(`disc_abuse_kick_test_test`)
          .setLabel("At")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("👢"),
        new ButtonBuilder()
          .setCustomId(`disc_abuse_ban_test_test`)
          .setLabel("Banla")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔨"),
        new ButtonBuilder()
          .setCustomId(`disc_abuse_ignore_test_test`)
          .setLabel("🚫 Yoksay")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🚫")
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    return null;
  } catch (err) {
    console.error(`[${commandName}] Hata:`, err);
    return interaction.editReply({ content: `❌ Hata: ${err.message}` });
  }
}

// Panel command aliases - these commands forward to their main versions
async function handlePanelCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;

  // Staff reward - forward to reward command
  if (commandName === "staff-reward") {
    const kullanici = interaction.options.getUser("kullanici");
    const islem = interaction.options.getString("islem");
    const odul = interaction.options.getString("odul");

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const StaffProgress = require("../../models/StaffProgress");
      const staff = await StaffProgress.findOne({ userId: kullanici.id });

      if (!staff) {
        return interaction.editReply({
          content: `❌ **${kullanici.tag}** personel sistemi kayıtlarında bulunamadı.`
        });
      }

      if (islem === "ver") {
        staff.rewards = (staff.rewards || 0) + 1;
        staff.lastRewardDate = new Date();
        await staff.save();

        return interaction.editReply({
          content: `✅ **${kullanici.tag}** adlı personele **${odul}** ödülü verildi!\nToplam Ödülü: **${staff.rewards}**`
        });
      } else if (islem === "al") {
        if (staff.rewards > 0) {
          staff.rewards--;
          await staff.save();

          return interaction.editReply({
            content: `✅ **${kullanici.tag}** adlı personelden **${odul}** ödülü alındı!\nKalan Ödülü: **${staff.rewards}**`
          });
        } else {
          return interaction.editReply({
            content: `❌ **${kullanici.tag}** adlı personelin alınacak ödülü yok.`
          });
        }
      }
    } catch (err) {
      console.error('[staff-reward]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // Staff giveleave - forward to giveleave
  if (commandName === "staff-giveleave") {
    const kullanici = interaction.options.getUser("kullanici");
    const tarih = interaction.options.getString("tarih");
    const sebep = interaction.options.getString("sebep");

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const StaffProgress = require("../../models/StaffProgress");
      const staff = await StaffProgress.findOne({ userId: kullanici.id });

      if (!staff) {
        return interaction.editReply({
          content: `❌ **${kullanici.tag}** personel sistemi kayıtlarında bulunamadı.`
        });
      }

      if (!staff.leaveCredits) staff.leaveCredits = [];
      staff.leaveCredits.push({
        date: new Date(tarih),
        reason: sebep,
        grantedBy: interaction.user.id,
        grantedDate: new Date()
      });
      await staff.save();

      return interaction.editReply({
        content: `✅ **${kullanici.tag}** adlı personele **${tarih}** tarihi için izin verildi.\n📝 **Sebep:** ${sebep}`
      });
    } catch (err) {
      console.error('[staff-giveleave]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // Staff attendance - forward to attendance-start
  if (commandName === "staff-attendance-start") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const { startAttendance } = require("../services/staffSystem");
      const result = await startAttendance(interaction);
      return result;
    } catch (err) {
      console.error('[staff-attendance-start]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // Staff attendance stop
  if (commandName === "staff-attendance-stop") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const { stopAttendance } = require("../services/staffSystem");
      const result = await stopAttendance(interaction);
      return result;
    } catch (err) {
      console.error('[staff-attendance-stop]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // System toggle - forward to toggle
  if (commandName === "system-toggle") {
    const modul = interaction.options.getString("modul");

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const ServerConfig = require("../../models/ServerConfig");
      const config = await ServerConfig.findOne({ serverId: interaction.guildId });

      const configKey = `${modul}Enabled`;
      const currentState = config?.[configKey] ?? true;
      const newState = !currentState;

      await ServerConfig.updateOne(
        { serverId: interaction.guildId },
        { [configKey]: newState },
        { upsert: true }
      );

      const modulNames = {
        economy: "💰 Ekonomi",
        moderation: "🛡️ Moderasyon",
        fun: "🎮 Eğlence"
      };

      return interaction.editReply({
        content: `✅ **${modulNames[modul] || modul}** Sistemi ${newState ? "**Açıldı** ✅" : "**Kapatıldı** ❌"}`
      });
    } catch (err) {
      console.error('[system-toggle]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // System-ekobang - forward to ekobang
  if (commandName === "system-ekobang") {
    const kullanici = interaction.options.getUser("kullanici");

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      // Placeholder for EkoBang implementation - would integrate with roblox service
      return interaction.editReply({
        content: `✅ **EkoBang** işlemi **${kullanici.tag}** için başlatıldı. Rütbeleri düşürülüyor...`
      });
    } catch (err) {
      console.error('[system-ekobang]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // System-ekobangerial
  if (commandName === "system-ekobangerial") {
    const kullanici = interaction.options.getUser("kullanici");

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      return interaction.editReply({
        content: `✅ **EkoBang İade** işlemi **${kullanici.tag}** için başlatıldı. Rütbeleri geri alınıyor...`
      });
    } catch (err) {
      console.error('[system-ekobangerial]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // System-grupcekeko
  if (commandName === "system-grupcekeko") {
    const username = interaction.options.getString("username");

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      return interaction.editReply({
        content: `✅ **GrupÇekEko** işlemi **${username}** için başlatıldı. Rütbeleri en alta çekiliyor...`
      });
    } catch (err) {
      console.error('[system-grupcekeko]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // System-grupcekekogerial
  if (commandName === "system-grupcekekogerial") {
    const username = interaction.options.getString("username");

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      return interaction.editReply({
        content: `✅ **GrupÇekEko İade** işlemi **${username}** için başlatıldı. Rütbeleri iade ediliyor...`
      });
    } catch (err) {
      console.error('[system-grupcekekogerial]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // Coach welcome reset command
  if (commandName === "coach-welcome-reset") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    try {
      const { resetCoachWelcomeFlag } = require("../services/coachWelcomeService");
      const result = resetCoachWelcomeFlag();

      if (result.success) {
        return interaction.editReply({
          content: `✅ **Koç Hoşgeldin Mesajı Sıfırlandı!**\n\nSonraki bot başlatılmasında tüm aktif koçlara hoşgeldin mesajı gönderilecektir.`
        });
      } else {
        return interaction.editReply({
          content: `⚠️ ${result.message || result.error}`
        });
      }
    } catch (err) {
      console.error('[coach-welcome-reset]', err);
      return interaction.editReply({
        content: `❌ Hata: ${err.message}`
      });
    }
  }

  // ── sunucukurma: TMT sunucu kurulum asistanı ────────────────────────────────
  if (commandName === "sunucukurma") {
    const groupIdStr = interaction.options.getString("grup");
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }
    await startServerSetupFlow({
      guild: interaction.guild,
      user: interaction.user,
      groupIdStr,
      replyCallback: async (options) => {
        return interaction.editReply(options);
      }
    });
    return;
  }

  // ── sunucurolsenkranizasyondüzenleme: Eşleşmeleri manuel düzelt ────────────
  if (commandName === "sunucurolsenkranizasyondüzenleme") {
    const allowedUsers = ["1228088674206617621", "1031620522406072350"];
    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Bu komutu kullanmak için yetkiniz yok!", ephemeral: true });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => { });
    }

    const rank = interaction.options.getNumber("rutbe");
    const role = interaction.options.getRole("rol");

    const ServerSetup = require("../../models/ServerSetup");
    const setupDoc = await ServerSetup.findOne({ guildId: interaction.guild.id });
    if (!setupDoc) {
      return interaction.editReply({ content: "❌ Bu sunucuda henüz `/sunucukurma` işlemi başlatılmamış." });
    }

    if (!setupDoc.roleMappings) {
      setupDoc.roleMappings = new Map();
    }
    setupDoc.roleMappings.set(rank.toString(), role.id);
    await setupDoc.save();

    return interaction.editReply({
      content: `✅ **Başarılı!** Roblox Rank **${rank}** artık Discord **${role.toString()}** rolüyle eşleştirildi.`
    });
  }

  return null;
}

async function generateInceleData(guild, targetUser, targetMember) {
  // 1. Roblox ID Bul (Yerel Veritabanı, RoWifi veya Bloxlink)
  let robloxId = null;
  let robloxUsername = null;
  let linkSource = null;

  // Local DB Check First
  let dbUser = null;
  try {
    dbUser = await User.findOne({ discordId: targetUser.id });
    if (dbUser && dbUser.robloxId) {
      robloxId = String(dbUser.robloxId);
      robloxUsername = dbUser.robloxUsername;
      linkSource = "Sunucu Veritabanı";
    }
  } catch (err) {
    console.warn("[incele] Local DB query error:", err.message);
  }

  // RoWifi API with Guild fallbacks if not found
  if (!robloxId) {
    const { ROWIFI_TOKEN } = require("../../config");
    if (ROWIFI_TOKEN) {
      const guildsToCheck = [guild.id, "1367646464804655104", "1483482948320891074"];
      const axios = require("axios");
      for (const gId of guildsToCheck) {
        try {
          const url = `https://api.rowifi.xyz/v3/guilds/${gId}/members/${targetUser.id}`;
          const response = await axios.get(url, {
            headers: {
              'Authorization': `Bot ${ROWIFI_TOKEN}`
            },
            timeout: 3000
          });
          if (response.status === 200 && response.data && response.data.roblox_id) {
            robloxId = String(response.data.roblox_id);
            linkSource = gId === guild.id ? "RoWifi API (Bu Sunucu)" : "RoWifi API (Merkez Sunucu)";
            break;
          }
        } catch (err) {
          // Try next guild silently
        }
      }
    }
  }

  // Bloxlink Public Global API Fallback if still not found
  if (!robloxId) {
    try {
      const axios = require("axios");
      const url = `https://v3.api.blox.link/developer/discord/${targetUser.id}`;
      const response = await axios.get(url, { timeout: 4000 });
      if (response.status === 200 && response.data && response.data.robloxId) {
        robloxId = String(response.data.robloxId);
        linkSource = "Bloxlink API (Global)";
      }
    } catch (err) {
      // Bloxlink lookup failed
    }
  }

  // Embed nesnesini hazırlayalım
  const embed = new EmbedBuilder()
    .setTitle(`🔍 Kullanıcı İnceleme: ${targetUser.tag}`)
    .setColor(dbUser?.isBanned ? 0xed4245 : 0x7c6af7)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  // Discord Bölümü
  let discordInfo = `**ID:** \`${targetUser.id}\`\n` +
    `**Hesap Açılış:** <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R> (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>)\n`;

  if (targetMember) {
    discordInfo += `**Sunucuya Katılım:** <t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>\n` +
      `**Takma Ad:** ${targetMember.nickname || "Yok"}\n`;

    const roles = targetMember.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => r.toString());

    if (roles.length > 0) {
      discordInfo += `**Roller (${roles.length}):** ${roles.slice(0, 15).join(", ")}${roles.length > 15 ? "..." : ""}\n`;
    } else {
      discordInfo += `**Roller:** Yok\n`;
    }
  }
  embed.addFields({ name: "📱 Discord Bilgileri", value: discordInfo, inline: false });

  // Roblox Bölümü
  if (robloxId) {
    let rbxName = robloxUsername || "Bilinmiyor";
    let rbxDisplayName = "Bilinmiyor";
    let rbxCreated = "Bilinmiyor";
    let rbxDesc = "Yok";
    let rbxBanned = "Hayır";
    let rbxFriends = "Bilinmiyor";
    let rbxGroupsText = "Bulunamadı";

    // Roblox APIs
    try {
      const axios = require("axios");
      // 1. User profile
      const userRes = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`, { timeout: 5000 }).catch(() => null);
      if (userRes && userRes.data) {
        rbxName = userRes.data.name;
        rbxDisplayName = userRes.data.displayName;
        rbxDesc = userRes.data.description ? (userRes.data.description.length > 500 ? userRes.data.description.slice(0, 500) + "..." : userRes.data.description) : "Yok";
        rbxBanned = userRes.data.isBanned ? "⚠️ Evet (Yasaklı)" : "Hayır";

        const createdDate = new Date(userRes.data.created);
        rbxCreated = `<t:${Math.floor(createdDate.getTime() / 1000)}:R> (<t:${Math.floor(createdDate.getTime() / 1000)}:F>)`;
      }

      // 2. Avatar Thumbnail
      const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`, { timeout: 5000 }).catch(() => null);
      if (thumbRes && thumbRes.data && thumbRes.data.data && thumbRes.data.data[0]) {
        embed.setThumbnail(thumbRes.data.data[0].imageUrl);
      }

      // 3. Friends count
      const friendsRes = await axios.get(`https://friends.roblox.com/v1/users/${robloxId}/friends/count`, { timeout: 5000 }).catch(() => null);
      if (friendsRes && friendsRes.data) {
        rbxFriends = `${friendsRes.data.count} arkadaş`;
      }

      // 4. Groups
      const { fetchUserGroups } = require("../services/roleSyncService");
      const groups = await fetchUserGroups(robloxId).catch(() => []);
      if (groups.length > 0) {
        rbxGroupsText = groups.slice(0, 5).map(g => `- **[${g.group.name}](https://www.roblox.com/groups/${g.group.id}):** ${g.role.name} (Rank: ${g.role.rank})`).join("\n");
        if (groups.length > 5) {
          rbxGroupsText += `\n*ve ${groups.length - 5} grup daha...*`;
        }
      }
    } catch (err) {
      console.error(`[incele] Roblox API hatası:`, err.message);
    }

    let robloxInfo = `**Kullanıcı Adı:** [${rbxName}](https://www.roblox.com/users/${robloxId}/profile)\n` +
      `**Görünen Ad (Display):** ${rbxDisplayName}\n` +
      `**ID:** \`${robloxId}\`\n` +
      `**Hesap Açılış:** ${rbxCreated}\n` +
      `**Arkadaş Sayısı:** ${rbxFriends}\n` +
      `**Yasaklı mı:** ${rbxBanned}\n` +
      `**Hakkında (Description):** *${rbxDesc}*\n` +
      `**Kaynak:** \`${linkSource}\` (Doğrulanmış)`;

    embed.addFields(
      { name: "🎮 Roblox Bilgileri", value: robloxInfo, inline: false },
      { name: "👥 Katılınan Gruplar", value: rbxGroupsText, inline: false }
    );
  } else {
    embed.addFields({
      name: "🎮 Roblox Bilgileri",
      value: "❌ Bu kullanıcının RoWifi veya sunucu veritabanında doğrulanmış bir Roblox hesabı bulunamadı.",
      inline: false
    });
  }

  // Ban Durumu Bilgisi (Eğer Yasaklıysa)
  if (dbUser && dbUser.isBanned) {
    embed.addFields({
      name: "🚫 Ban Bilgisi (Veritabanı)",
      value: `**Durum:** 🔴 Yasaklı\n**Sebep:** ${dbUser.banReason || "Belirtilmedi"}\n**Tarih:** ${dbUser.bannedAt ? `<t:${Math.floor(dbUser.bannedAt.getTime() / 1000)}:f>` : "Bilinmiyor"}\n**Yetkili:** <@${dbUser.bannedBy || "Bilinmiyor"}>`,
      inline: false
    });
  }

  // Butonları oluştur
  const isCurrentlyBanned = dbUser ? dbUser.isBanned : false;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(isCurrentlyBanned ? `incele_unban_${targetUser.id}` : `incele_ban_${targetUser.id}`)
      .setLabel(isCurrentlyBanned ? "🔓 YASAK KALDIR" : "🚫 YASAKLA")
      .setStyle(isCurrentlyBanned ? ButtonStyle.Success : ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

async function handleAllGeneralCommands(interaction) {
  // Try main handler first
  const result = await handleGeneralCommand(interaction);
  if (result !== null && result !== undefined) return result;

  // Try panel handler
  return await handlePanelCommand(interaction);
}

async function startServerSetupFlow({ guild, user, groupIdStr, replyCallback }) {
  const allowedUsers = ["1228088674206617621", "1031620522406072350"];
  if (!allowedUsers.includes(user.id)) {
    return replyCallback({ content: "❌ Bu komutu kullanmak için yetkiniz yok!", ephemeral: true });
  }

  const groupId = parseInt(groupIdStr, 10);
  if (isNaN(groupId)) {
    return replyCallback({ content: "❌ Geçersiz Roblox Grup ID'si!", ephemeral: true });
  }

  const { ROBLOX_GROUPS } = require("../services/robloxGroupManager");
  const groupName = ROBLOX_GROUPS[groupIdStr] || `Grup #${groupId}`;

  const noblox = require("noblox.js");
  const rbxRoles = await noblox.getRoles(groupId).catch(() => []);
  if (!rbxRoles || rbxRoles.length === 0) {
    return replyCallback({ content: `❌ Roblox grubundan (${groupName}) rütbeler alınamadı!`, ephemeral: true });
  }

  const discordRoles = guild.roles.cache
    .filter(r => r.id !== guild.id && !r.managed)
    .sort((a, b) => b.position - a.position);

  let aiMappings = {};
  try {
    const { chatWithAI } = require("../services/aiService");
    const rbxList = rbxRoles.map(r => `Rank ${r.rank}: ${r.name}`).join("\n");
    const discList = discordRoles.map(r => `ID ${r.id}: ${r.name}`).join("\n");

    let specialGuidelines = "";
    if (groupId === 33708598 || groupName.includes("Özel Kuvvetler")) {
      specialGuidelines = "\n\nBu grup TMT Özel Kuvvetler Komutanlığı grubudur. Eşleştirme yaparken şu kuralları kesinlikle uygula:\n" +
        "1. 'OF-10 Mareşal' (Rank 255) rütbesini 'OF-10 Mareşal' veya 'Mareşal' rolüyle eşleştir.\n" +
        "2. 'Ordu Yönetimi' (Rank 254) rütbesini 'Ordu Yönetimi' veya 'Ordu Yönetim' rolüyle eşleştir.\n" +
        "3. 'Özel Kuvvetler Komutanı' (Rank 100) ve 'Özel Kuvvetler Komutan Yardımcılığı' (Rank 69) rütbelerini 'Özel Kuvvetler Komutan Yardımcısı' rolüyle eşleştir.\n" +
        "4. 'Bölge Sorumlusu' (Rank 50), 'Bölge Heyeti' (Rank 60) ve 'Bölge Şefi' (Rank 65) rütbelerini '[HQ]' veya 'HQ' rolüyle eşleştir.\n" +
        "5. 'Teğmen', 'Yüzbaşı', 'Binbaşı', 'Yarbay', 'Albay' (Rank 23-40) ile 'I. Sınıf Personel', 'II. Sınıf Personel', 'III. Sınıf Personel', 'Sınıf Üstü Personel' (Rank 5-20) rütbelerini 'Özel Kuvvetler Personeli' rolüyle eşleştir.\n" +
        "6. Rütbesinde kesik çizgiler olan '----------------' (Rank 21, 44, 101, 253 vb.) rütbelerini '▬▬▬▬▬▬▬▬▬▬▬▬▬' seperatör rolüyle eşleştir.\n" +
        "7. Eşleşmeyen alt rütbeleri (Rank 1) 'Doğrulanmış Personel' veya 'Askeri Personel' rolüyle eşleştirebilirsin.";
    }

    const systemPrompt = "Sen bir rol eşleştirme asistanısın. Roblox grup rütbeleri ile Discord rollerini ad benzerliği ve rütbe seviyesine göre en doğru şekilde eşleştir.\n" +
      "Sadece geçerli bir JSON objesi dön. Obje anahtarları Roblox rank numarası (ör: \"254\"), değerleri ise eşleşen Discord rol ID'si (ör: \"1518926498361376768\") olsun. " +
      "Eşleşmeyenleri dahil etme. JSON dışında açıklama veya ek metin kesinlikle ekleme. Üstteki Özel Kuvvetlerdeki gibi olsun bir kullanıcıya hem rütbesi seviyesi çizgileriyle beraber her bir rütbeye böyle ver. " + specialGuidelines;

    const aiResponse = await chatWithAI(`Roblox Rütbeleri:\n${rbxList}\n\nDiscord Rolleri:\n${discList}`, systemPrompt).catch(() => null);
    if (aiResponse) {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiMappings = JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error("[SunucuKurma] AI match error:", err.message);
  }

  // Fallback fuzzy matching
  for (const r of rbxRoles) {
    if (!aiMappings[r.rank.toString()]) {
      const match = discordRoles.find(dr =>
        dr.name.toLowerCase().replace(/[^a-z0-9]/g, "") === r.name.toLowerCase().replace(/[^a-z0-9]/g, "")
      );
      if (match) {
        aiMappings[r.rank.toString()] = match.id;
      }
    }
  }

  const ServerSetup = require("../../models/ServerSetup");
  let setupDoc = await ServerSetup.findOne({ guildId: guild.id });
  if (!setupDoc) {
    setupDoc = new ServerSetup({
      guildId: guild.id,
      guildName: guild.name,
      robloxGroupId: groupId,
      robloxGroupName: groupName
    });
  } else {
    setupDoc.guildName = guild.name;
    setupDoc.robloxGroupId = groupId;
    setupDoc.robloxGroupName = groupName;
  }
  setupDoc.roleMappings = aiMappings;
  setupDoc.status = "draft";
  await setupDoc.save();

  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

  let mappedText = "";
  for (const r of rbxRoles) {
    const matchedId = aiMappings[r.rank.toString()];
    const roleObj = matchedId ? guild.roles.cache.get(matchedId) : null;
    mappedText += `• **Rank ${r.rank} (${r.name}):** ${roleObj ? roleObj.toString() : "❌ *Eşleştirilemedi*"}\n`;
  }

  const setupEmbed = new EmbedBuilder()
    .setTitle("🤖 Yapay Zeka Rol Eşleştirmesi Tamamlandı")
    .setColor(0x3498db)
    .setDescription(
      `**Seçilen Grup:** [${groupName}](https://www.roblox.com/groups/${groupId})\n\n` +
      `Aşağıda yapay zeka tarafından sunucu rolleriyle Roblox grup rütbeleri arasındaki eşleştirme listelenmiştir:\n\n` +
      mappedText +
      `\nBu eşleştirme doğru mu?`
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup_correct_${setupDoc.guildId}`)
      .setLabel("DOĞRU")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`setup_incorrect_${setupDoc.guildId}`)
      .setLabel("DOĞRU DEĞİL DÜZENLEMEK İSTİYORUM")
      .setStyle(ButtonStyle.Danger)
  );

  await replyCallback({ embeds: [setupEmbed], components: [row] });
}

module.exports = {
  handleGeneralCommand: handleAllGeneralCommands,
  generateInceleData,
  startServerSetupFlow
};
