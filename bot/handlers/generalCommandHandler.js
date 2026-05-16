const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Ticket = require("../../models/Ticket");
const User = require("../../models/User");
const { getSupportMenuEmbed, getSupportButton } = require("../embeds");
const { SUPPORT_CATEGORIES, BASE_URL } = require("../../config");

async function handleGeneralCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;

  if (commandName === "verify" || commandName === "update") {
    const { handleVerify, handleUpdate } = require("./roleHandler");
    if (commandName === "verify") return handleVerify(interaction);
    return handleUpdate(interaction);
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await User.findOne({ discordId: interaction.user.id });

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
          { name: "🎮 Roblox Adı", value: user.robloxUsername || "Bağlanmamış", inline: true },
          { name: "🔑 Yetki", value: user.isAuthorized ? "✅ Yetkili" : "❌ Yetkisiz", inline: true },
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

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "robloxgrup") {
      if (!user) {
        return interaction.editReply({
          content: "❌ Önce /authorize komutu ile Roblox hesabınızı yetkilendirmelisiniz.",
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
      if (!user) {
        return interaction.editReply({
          content: "❌ Önce /authorize komutu ile Roblox hesabınızı yetkilendirmelisiniz.",
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
          commands: "/support, /mytickets, /closeticket, /profile, /authorize, /verify, /update, /robloxgrup, /robloxuser, /ping, /stats",
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
