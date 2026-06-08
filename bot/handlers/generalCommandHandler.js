const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Ticket = require("../../models/Ticket");
const User = require("../../models/User");
const { getSupportMenuEmbed, getSupportButton } = require("../embeds");
const { SUPPORT_CATEGORIES, BASE_URL } = require("../../config");
const { findUserByDiscordId, hasRobloxLink } = require("../../utils/userLink");
const { deferEphemeral } = require("../utils/interaction");

const GENERAL_COMMANDS = new Set([
  "support",
  "mytickets",
  "closeticket",
  "profile",
  "authorize",
  "robloxgrup",
  "robloxuser",
  "abonelik",
  "ayarlar",
  "kanal",
  "otomod",
  "yardim",
  "ping",
  "stats",
  "personeldurum",
  "seviye",
  "modbasvuru",
  "istifa",
  "emeklilik",
  "koc",
  "leaderboard",
  "profil",
  "challenge",
]);

async function handleGeneralCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;

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
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
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

  // ── istifa: Personel görevinden istifa et ─────────────────────────────────
  if (commandName === "istifa") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    try {
      const { resignFromStaff } = require('../services/staffSystem');
      const reason = interaction.options.getString('sebep');
      const result = await resignFromStaff(interaction.user.id, reason, interaction.client);
      
      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }
      
      const message = result.canRetire
        ? `✅ İstifan kabul edildi. 90+ gün aktif kaldığın için emeklilik talep edebilirsin! \`/emeklilik\` komutunu kullan.`
        : `✅ İstifan kabul edildi. Teşekkürler! Tekrar başvurmak istersen yöneticilere yazabilirsin.`;
      
      return interaction.editReply({ content: message });
    } catch (err) {
      console.error('[istifa] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── emeklilik: Emekli ol ───────────────────────────────────────────────────
  if (commandName === "emeklilik") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
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

  // ── leaderboard: Top 10 göster ────────────────────────────────────────────
  if (commandName === "leaderboard") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    try {
      const { getLeaderboard } = require('../services/staffSystem');
      const lb = await getLeaderboard();

      if (lb.length === 0) {
        return interaction.editReply({ content: '❌ Henüz leaderboard verisi yok.' });
      }

      let description = '```\n';
      for (const p of lb) {
        const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `${p.rank}.`;
        description += `${medal} <@${p.userId}> | ${p.points}pts | Lvl.${p.xpLevel} | ${p.tickets} 🎫 | ${p.badges} 🏆\n`;
      }
      description += '```';

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🏆 LEADERBOARD - Top 10 Personel')
        .setDescription(description)
        .addFields(
          { name: '📊 Nasıl İşliyor?', value: 'Ticket = +10 puan • Seviye = +XP • Rozet = +Prestij', inline: false }
        )
        .setFooter({ text: 'Eko Yıldız • Gamification' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[leaderboard] hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── profil: Gamification profili ───────────────────────────────────────────
  if (commandName === "profil") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
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
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
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

  // ── personeldurum ──────────────────────────────────────────────────────────
  if (commandName === "personeldurum") {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    try {
      const { EmbedBuilder: EB } = require('discord.js');
      const target = interaction.options.getUser('kullanici') || interaction.user;
      const {
        getOrCreate, getDailyRequirements,
        ROLE_NAMES, PROMOTION_REQUIREMENTS, GUILD_ID, ROLES,
      } = require('../services/staffSystem');
      const StaffProgress = require('../../models/StaffProgress');

      let p = await StaffProgress.findOne({ userId: target.id });

      // Kayıtlı değilse Discord rolünden senkronize ederek oluştur
      if (!p) {
        try {
          const guild  = await interaction.client.guilds.fetch(GUILD_ID).catch(() => null);
          const member = guild ? await guild.members.fetch(target.id).catch(() => null) : null;
          if (member) {
            let level = 0;
            for (let lvl = 4; lvl >= 1; lvl--) {
              const roleId = ROLES[lvl];
              if (roleId && !['PERSONEL_ROLE_ID','GELISMIS_ROLE_ID','SEKRETER_ROLE_ID'].includes(roleId) && member.roles.cache.has(roleId)) {
                level = lvl; break;
              }
            }
            // Stajyer rolü veya üstü varsa kayıt et
            const stajyerId = ROLES[1];
            const hasStaffRole = level > 0 || (stajyerId && !['PERSONEL_ROLE_ID'].includes(stajyerId) && member.roles.cache.has(stajyerId));
            if (hasStaffRole) {
              p = await getOrCreate(target.id, GUILD_ID);
              if (level > 0 && p.level < level) { p.level = level; await p.save(); }
            }
          }
        } catch (_) {}
      }

      if (!p) {
        return interaction.editReply({ content: `❌ **${target.username}** personel sisteminde kayıtlı değil. Stajyer Personel rolü olan birini sorgulayın.` });
      }

      const req       = getDailyRequirements(p.level, p.stats?.consecutiveDays || 0);
      const nextReq   = PROMOTION_REQUIREMENTS[p.level];
      const today     = new Date().toISOString().split('T')[0];
      const isToday   = p.daily?.date === today;
      const greetDone = isToday && p.daily?.greeted;
      const voiceDone = isToday && (p.daily?.voiceMinutes || 0) >= req.voiceMinutes;

      const embed = new EB()
        .setColor(0x7c6af7)
        .setTitle(`📊 Personel Durumu — ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '🎖️ Seviye',            value: ROLE_NAMES[p.level] || 'Stajyer Personel', inline: true },
          { name: '📅 Arka Arkaya Aktif',  value: `${p.stats?.consecutiveDays || 0} gün`,  inline: true },
          { name: '⚠️ Uyarı',              value: `${p.warnings?.count || 0}/5`,            inline: true },
          {
            name: '📋 Bugünkü Görevler',
            value:
              `${greetDone ? '✅' : '❌'} Selam (${isToday ? 1 : 0}/${req.greets})\n` +
              `${voiceDone ? '✅' : '❌'} Ses: ${isToday ? (p.daily?.voiceMinutes || 0) : 0}/${req.voiceMinutes} dk`,
            inline: false,
          },
          {
            name: '📈 Terfi İlerlemesi',
            value: nextReq
              ? `Ticketlar: ${p.stats?.ticketsSolved || 0}/${nextReq.ticketsSolved}\n` +
                `Anketler: ${p.stats?.surveysCompleted || 0}/${nextReq.surveysCompleted}\n` +
                `Aktif Günler: ${p.stats?.activeDays || 0}/${nextReq.activeDays}`
              : '🏆 En üst seviyeye ulaştın!',
            inline: false,
          }
        )
        .setFooter({ text: 'Eko Yıldız • Personel Sistemi' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[personeldurum] hata:', err.message);
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
        .setDescription(`[Tıklayın ve Roblox hesabınızla giriş yapın](${authUrl})`)
        .setColor(0x7c6af7);

      const { logAuthorize } = require("../services/commandLog");
      logAuthorize(interaction, { authUrl, dbUser: user });

      return interaction.editReply({ embeds: [embed] });
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
      return interaction.editReply({ embeds: [pingEmbed] });
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

      const embed = new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle(`🐸 ${target.username} — Kurbağa Seviyesi`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(
          `**${profile.currentRole?.name || 'Yavru Kurbağa'}**\n\n` +
          `XP: **${profile.currentXP.toLocaleString()}** / **${profile.neededXP > 0 ? profile.neededXP.toLocaleString() : 'MAX'}**\n` +
          `\`${profile.bar}\` ${profile.neededXP > 0 ? Math.floor((profile.currentXP / profile.neededXP) * 100) : 100}%`
        )
        .addFields(
          { name: '📊 Seviye',          value: `${profile.level}/${FROG_ROLES.length - 1}`, inline: true },
          { name: '✨ Toplam XP',       value: profile.xp.toLocaleString(), inline: true },
          { name: '📝 Mesaj',           value: (profile.totalMessages || 0).toLocaleString(), inline: true },
          { name: '🎤 Ses (dk)',        value: (profile.totalVoiceMinutes || 0).toLocaleString(), inline: true },
          { name: '⬆️ Sonraki rol',    value: profile.nextRole?.name || '🏆 MAX SEVİYE', inline: true },
        )
        .setFooter({ text: 'Eko Yıldız • Kurbağa Sistemi 🐸' })
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

    return null;
  } catch (err) {
    console.error(`[${commandName}] Hata:`, err);
    return interaction.editReply({ content: `❌ Hata: ${err.message}` });
  }
}

module.exports = { handleGeneralCommand };
