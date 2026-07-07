'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const Blacklist = require("../../models/Blacklist");
const StaffProgress = require("../../models/StaffProgress");
const User = require("../../models/User");
const Ticket = require("../../models/Ticket");
const Economy = require("../../models/Economy");
const { renderBlacklist } = require("./blacklistService");

// Configuration values
const BLACKLIST_LOG_CHANNEL_ID = '1518920074264842380';
const STAFF_ATTENDANCE_CHANNEL_ID = '1466945894250188912';

/**
 * Escapes special regex characters from user input to prevent ReDoS / injection
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses duration string into milliseconds.
 * Supports composite durations like "1h30m", "2d12h", etc.
 */
function parseDuration(timeStr) {
  const unitMap = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  // Match all (number + unit) pairs
  const matches = [...timeStr.matchAll(/(\d+)([smhd])/g)];
  if (!matches.length) return 10 * 60 * 1000; // default 10 minutes

  return matches.reduce((total, match) => {
    const value = parseInt(match[1]);
    const unit = match[2];
    return total + value * (unitMap[unit] || 1000);
  }, 0);
}

/**
 * Checks authorization levels:
 * - isOwner: Discord ID 1031620522406072350
 * - isAdmin: Administrator permission
 * - isManager: ManageGuild permission
 * - isMod: ManageMessages / ModerateMembers permission
 * - isStaff: active in StaffProgress DB
 */
async function getAuth(member) {
  const isOwner = member.user.id === "1031620522406072350";
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
  const isManager = member.permissions.has(PermissionFlagsBits.ManageGuild);
  const isMod =
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers);

  const staff = await StaffProgress.findOne({ userId: member.user.id });
  const isStaff = staff && staff.status === 'active';

  return {
    isOwner,
    isAdmin: isAdmin || isOwner,
    isManager: isManager || isAdmin || isOwner,
    isMod: isMod || isManager || isAdmin || isOwner,
    isStaff
  };
}

/**
 * Generates Embed and Component rows based on tabName.
 * Always uses editReply — caller must deferUpdate() or deferReply() beforehand.
 */
async function renderPanel(interaction, tabName, blacklistOption = '1') {
  const auth = await getAuth(interaction.member);
  const embed = new EmbedBuilder().setTimestamp();
  const components = [];

  if (tabName === "home") {
    embed
      .setTitle("⚙️ EkoYıldız Kontrol & Yönetim Paneli")
      .setColor(0x7C6AF7)
      .setDescription(
        "Bot yönetim ve denetleme arayüzüne hoş geldiniz. Lütfen gitmek istediğiniz sekmeyi seçin.\n\n" +
        "**📁 Mevcut Kategoriler:**\n" +
        "🛡️ **Moderasyon:** Ban, susturma, ceza işlemleri ve karaliste.\n" +
        "👥 **Personel Yönetimi:** Terfi, izin, sayım, bakiye ve ilerleme.\n" +
        "⚙️ **Sistem & Otomasyon:** Otomod, Roblox, alımlar ve sistem modülleri.\n" +
        "🏆 **Birim Sistemi:** Birim liderbordu, koç bilgisi ve birim yönetimi."
      )
      .addFields(
        { name: "Yetkili", value: `${interaction.user.tag}`, inline: true },
        {
          name: "Rol",
          value: auth.isAdmin
            ? "👑 Yönetici"
            : auth.isManager
              ? "👨‍✈️ Yönetici / Manager"
              : auth.isMod
                ? "🛡️ Moderatör"
                : "👔 Personel",
          inline: true
        }
      );

    // Add coach info
    const { getCoachDisplayInfo } = require("./coachManagementService");
    const coachInfo = await getCoachDisplayInfo();
    embed.addFields({
      name: "👨‍🏫 Birim Koçu",
      value: `**${coachInfo.name}** ${coachInfo.isActive ? "🟢" : "🔴"}`,
      inline: true
    });

    const allowedSpecial = ["1031620522406072350", "1492888195807969510"];
    if (allowedSpecial.includes(interaction.user.id)) {
      embed.addFields({
        name: "🚨 Acil Durum Arama",
        value:
          "Aşağıdaki **📞 Acil Ara** butonunu kullanarak Telegram üzerinden anında sesli arama çağrısı başlatabilirsiniz.",
        inline: false
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_tab_moderation")
        .setLabel("🛡️ Moderasyon")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel_tab_staff")
        .setLabel("👥 Personel")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("panel_tab_system")
        .setLabel("⚙️ Sistem & Otomasyon")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("panel_tab_units")
        .setLabel("🏆 Birim Sistemi")
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder();

    if (allowedSpecial.includes(interaction.user.id)) {
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId("panel_emergency_call")
          .setLabel("📞 Acil Ara")
          .setStyle(ButtonStyle.Danger)
      );
    }

    row2.addComponents(
      new ButtonBuilder()
        .setCustomId("panel_close")
        .setLabel("❌ Kapat")
        .setStyle(ButtonStyle.Secondary)
    );
    components.push(row, row2);
  }

  else if (tabName === "moderation") {
    embed
      .setTitle("🛡️ Moderasyon İşlemleri")
      .setColor(0x34495E)
      .setDescription(
        "Sunucu düzenini korumak için moderasyon komutlarını buradan butonlarla kullanabilirsiniz.\n\n" +
        "**Kategoriler:**\n" +
        "🔇 **Susturma İşlemleri** — Sustur, Susturma Aç\n" +
        "📋 **Ceza İşlemleri** — Modİşlem, Toplu Sil\n" +
        "🔨 **Global Ban** — Tam Ban, Tam Ban Aç, Karaliste"
      );

    // ROW 1: Susturma İşlemleri (Mute/Unmute)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_mod_mute")
        .setLabel("🔇 Sustur")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isMod),
      new ButtonBuilder()
        .setCustomId("panel_mod_unmute")
        .setLabel("🔊 Aç")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!auth.isMod),
      new ButtonBuilder()
        .setCustomId("panel_mod_modaction")
        .setLabel("🚷 Ceza")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isMod),
      new ButtonBuilder()
        .setCustomId("panel_mod_bulk_delete")
        .setLabel("🗑️ Sil")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isMod)
    );

    // ROW 2: Global Ban İşlemleri
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_mod_tamban")
        .setLabel("� Tam Ban")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_mod_tamban_kaldir")
        .setLabel("� Ban Aç")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_mod_blacklist")
        .setLabel("� Karaliste")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isMod),
      new ButtonBuilder()
        .setCustomId("panel_tab_home")
        .setLabel("⬅️ Ana Menü")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(row1, row2);
  }

  else if (tabName === "blacklist") {
    embed
      .setTitle("🚫 Karaliste (Blacklist) Yönetimi")
      .setColor(0xED4245)
      .setDescription(
        "Karaliste işlemlerini menüden seçip butona basarak modal formuyla yapabilirsiniz.\n\n" +
        "**Seçenekler:**\n" +
        "1️⃣ **Kişi Ekle:** Karalisteye yeni şahıs kaydı ekler.\n" +
        "2️⃣ **Grup Ekle:** Karalisteye yeni grup/platform kaydı ekler.\n" +
        "3️⃣ **Sorun Çözüldü Kaldır:** Yasağı kaldırıp üstünü çizer (15 gün sonra silinir).\n" +
        "4️⃣ **Tamamen Sil:** Veritabanından kaydı anında tamamen siler.\n" +
        "5️⃣ **Yeniden Aç:** Kaldırılan kaydı tekrar aktif yapar.\n\n" +
        "Seçim menüsünden istediğiniz numarayı seçin, ardından **➕ Formu Aç** butonuna tıklayın."
      )
      .addFields({ name: "Şu anki Seçim", value: `Seçenek ${blacklistOption}`, inline: true });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("panel_blacklist_select")
      .setPlaceholder("Yapılacak Karaliste İşlemini Seçin...")
      .addOptions([
        { label: "1 - Kişi Ekle", value: "1", default: blacklistOption === "1" },
        { label: "2 - Grup Ekle", value: "2", default: blacklistOption === "2" },
        { label: "3 - Sorun Çözüldü Kaldır", value: "3", default: blacklistOption === "3" },
        { label: "4 - Tamamen Sil", value: "4", default: blacklistOption === "4" },
        { label: "5 - Yeniden Aç", value: "5", default: blacklistOption === "5" }
      ]);

    const rowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_blacklist_btn_openform:${blacklistOption}`)
        .setLabel("➕ Formu Aç")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isMod),
      new ButtonBuilder()
        .setCustomId("panel_tab_moderation")
        .setLabel("⬅️ Geri Dön")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(new ActionRowBuilder().addComponents(selectMenu), rowButtons);
  }

  else if (tabName === "staff") {
    embed
      .setTitle("👥 Yetkili & Personel Yönetimi")
      .setColor(0x2ECC71)
      .setDescription(
        "Personel istatistikleri, rütbe, izin ve yoklama işlemlerini buradan yönetin.\n\n" +
        "**Ana Kategoriler:**\n" +
        "📊 **Raporlar** — İlerleme raporu ve istatistik görüntüle\n" +
        "🎖️ **Rütbe İşlemleri** — Terfi, tenzilat, ödül yönetimi\n" +
        "🏖️ **İzin & Sayım** — İzin günü tanımla, yoklama işlemleri"
      );

    // ROW 1: Rapor ve İstatistikler
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_staff_report")
        .setLabel("📊 İlerleme Raporu")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel_staff_setstats")
        .setLabel("⚙️ İstatistik Ayarla")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_staff_fire")
        .setLabel("🚪 Personeli Kov")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isManager)
    );

    // ROW 2: Rütbe İşlemleri
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_staff_promote_demote")
        .setLabel("🎖️ Terfi/Tenzilat")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_staff_reward")
        .setLabel("🎁 Ödül Yönetimi")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_staff_skip_exam_promote")
        .setLabel("🎓 Sınavsız Terfi")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isAdmin)
    );

    // ROW 3: İzin ve Sayım
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_staff_giveleave")
        .setLabel("🏖️ İzin Günü Tanımla")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_staff_attendance")
        .setLabel("📋 Yoklama & Sayım")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("panel_tab_home")
        .setLabel("⬅️ Ana Menü")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(row1, row2, row3);
  }

  else if (tabName === "attendance") {
    embed
      .setTitle("📋 Personel Sayım & Yoklama")
      .setColor(0xF1C40F)
      .setDescription(
        "Moderatör ekibi için aylık/haftalık sayım (yoklama) sistemini başlatabilir veya bitirebilirsiniz."
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_staff_attendance_start")
        .setLabel("🟢 Yoklama Başlat")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_staff_attendance_stop")
        .setLabel("🔴 Yoklamayı Bitir & Sonuçlar")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_tab_staff")
        .setLabel("⬅️ Geri Dön")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(row);
  }

  else if (tabName === "system") {
    embed
      .setTitle("⚙️ Sistem & Sunucu Otomasyonu")
      .setColor(0xE74C3C)
      .setDescription(
        "Botun genel çalışma modüllerini, Roblox grup izinlerini ve sunucu otomod ayarlarını yönetin.\n\n" +
        "**Kategoriler:**\n" +
        "⚙️ **Sistem** — Toggler, Kanallar, Otomod\n" +
        "🎮 **Roblox** — Rütbe yönetimi, Birim\n" +
        "🎲 **Özel** — Çekiliş, AI, MOD-ALIM"
      );

    // ROW 1: Sistem Modülleri
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_sys_toggles")
        .setLabel("⚙️ Toggler")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel_sys_channel_perms")
        .setLabel("🔒 Kanal İzinleri")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isAdmin),
      new ButtonBuilder()
        .setCustomId("panel_sys_otomod")
        .setLabel("🛡️ Otomod")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isAdmin)
    );

    // ROW 2: Roblox ve Birim
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_sys_roblox_ranks")
        .setLabel("🎮 Roblox")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel_sys_birim")
        .setLabel("📣 Birim")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("panel_sys_giveaway_ai")
        .setLabel("🎲 Çekiliş & AI")
        .setStyle(ButtonStyle.Success)
    );

    // ROW 3: MOD-ALIM ve Restart
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_mod_alim")
        .setLabel("🛡️ MOD-ALIM")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isAdmin),
      new ButtonBuilder()
        .setCustomId("panel_sys_restart")
        .setLabel("🔄 Restart")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isAdmin),
      new ButtonBuilder()
        .setCustomId("panel_tab_home")
        .setLabel("⬅️ Ana Menü")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(row1, row2, row3);
  }

  else if (tabName === "toggles") {
    embed
      .setTitle("⚙️ Sistem Aktivasyon Modülleri")
      .setColor(0x34495E)
      .setDescription("Sunucu genelinde aktif edilecek/devre dışı bırakılacak bot modüllerini seçin.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_sys_toggle_economy")
        .setLabel("💰 Ekonomi Sistemi")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!auth.isAdmin),
      new ButtonBuilder()
        .setCustomId("panel_sys_toggle_moderation")
        .setLabel("🛡️ Moderasyon Sistemi")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!auth.isAdmin),
      new ButtonBuilder()
        .setCustomId("panel_sys_toggle_fun")
        .setLabel("🎮 Eğlence Oyunları")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!auth.isAdmin),
      new ButtonBuilder()
        .setCustomId("panel_tab_system")
        .setLabel("⬅️ Geri Dön")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(row);
  }

  else if (tabName === "roblox_ranks") {
    embed
      .setTitle("🎮 Roblox Grup & Rol Yönetimi")
      .setColor(0xE67E22)
      .setDescription("EkoBang ve GrupÇekEko yetkili Roblox grup rütbe düşürme/iade işlemlerini tetikleyin.");

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_sys_ekobang")
        .setLabel("🔒 EkoBang Uygula")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_sys_ekobangerial")
        .setLabel("🔓 EkoBang İade Et")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_sys_grupcekeko")
        .setLabel("⬇️ GrupÇekEko")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_sys_grupcekekogerial")
        .setLabel("⬆️ GrupÇekEko Geri Al")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_tab_system")
        .setLabel("⬅️ Geri Dön")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(row1, row2);
  }

  else if (tabName === "birim") {
    embed
      .setTitle("📣 Birim Duyuru & Alım")
      .setColor(0x9B59B6)
      .setDescription(
        "Branş birimleri için başvuru/alım açabilir ya da birim kurallarını kanallara gönderebilirsiniz."
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_sys_birimalimi")
        .setLabel("📢 Birim Alımı Duyur")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_sys_birimtanitim")
        .setLabel("📋 Birim Tanıtımı Gönder")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_tab_system")
        .setLabel("⬅️ Geri Dön")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(row);
  }

  else if (tabName === "giveaway_ai") {
    embed
      .setTitle("🎲 Çekiliş & Yapay Zeka Test")
      .setColor(0x1ABC9C)
      .setDescription(
        "Otomatik XP çekilişleri başlatabilir veya AI DM konuşma testlerini uygulayabilirsiniz."
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_sys_xpcekilis")
        .setLabel("🎉 XP Çekilişi Başlat")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_sys_konus")
        .setLabel("💬 AI DM Konuşma")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_sys_abusetest")
        .setLabel("🧪 Abuse Embed Test")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("panel_tab_system")
        .setLabel("⬅️ Geri Dön")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(row);
  }

  else if (tabName === "units") {
    embed
      .setTitle("🏆 Birim Sistemi & Liderbordu")
      .setColor(0x9B59B6)
      .setDescription(
        "Birimlerin istatistiklerini görüntüleyin, birim rolleri yönetin ve liderbordu takip edin.\n\n" +
        "**Kategoriler:**\n" +
        "📊 **Liderbordu** — Birimleri XP'ye göre sıralı görüntüle\n" +
        "👨‍🏫 **Birim Koçu** — Koç bilgisi ve ataması\n" +
        "🎖️ **Birim Rolleri** — Sunucuya birim rollerini ekle"
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_units_leaderboard")
        .setLabel("📊 Liderbordu Görüntüle")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel_units_coach")
        .setLabel("👨‍🏫 Birim Koçu")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_units_roles")
        .setLabel("🎖️ Rol Yönetimi")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isAdmin),
      new ButtonBuilder()
        .setCustomId("panel_tab_home")
        .setLabel("⬅️ Ana Menü")
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(row);
  }

  await interaction.editReply({
    embeds: [embed],
    components
  });
}

/**
 * Catches button interactions prefixed with panel_
 */
async function handlePanelButton(interaction) {
  const customId = interaction.customId;
  const client = interaction.client;

  // Modal güvenliği: eğer deferReply veya reply yapıldıysa, direkt modal gösterme
  // Bu durumda editReply kullan
  const showModalSafely = async (modal) => {
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.showModal(modal);
      } else {
        // Eğer deferReply yapıldıysa, modal gösteremeyiz
        // Bu durumda kullanıcıya uyarı ver
        return await interaction.editReply({
          content: "❌ Modal gösterilirken bir hata oluştu. Lütfen tekrar deneyin.",
          ephemeral: true
        });
      }
    } catch (err) {
      console.error('[handlePanelButton] Modal göstermek hatası:', err.message);
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({
          content: `❌ Modal: ${err.message}`,
          ephemeral: true
        });
      }
    }
  };

  if (customId === "panel_sys_restart") {
    const auth = await getAuth(interaction.member);
    if (!auth.isAdmin) {
      return interaction.reply({
        content: "❌ Bu işlemi gerçekleştirmek için **Yönetici** yetkisine sahip olmalısınız!",
        ephemeral: true
      });
    }

    await interaction.reply({
      content: "🔄 **Bot yeniden başlatılıyor...** Lütfen birkaç saniye bekleyin. Bot aktif olduğunda tekrar kullanılabilir duruma gelecektir.",
      ephemeral: true
    });

    console.log(`[restart] Bot is being restarted by admin ${interaction.user.tag} (ID: ${interaction.user.id})`);
    
    setTimeout(() => {
      process.exit(0);
    }, 1500);
    return;
  }

  if (customId === "panel_close") {
    return interaction.update({
      content: "🔒 Kontrol paneli kapatıldı.",
      embeds: [],
      components: []
    });
  }

  if (customId === "panel_emergency_call") {
    const allowedSpecial = ["1031620522406072350", "1492888195807969510"];
    if (!allowedSpecial.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Bu butonu kullanmaya yetkiniz bulunmamaktadır!",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { callTelegramUser } = require("./telegramService");
      const callText = `Sentara sunucu yonetim paneli. Yonetici ${interaction.user.username} tarafindan acil cagri baslatildi. Lutfen hemen sunucuyu kontrol edin.`;
      const success = await callTelegramUser(callText);
      if (success) {
        return interaction.editReply({
          content: "✅ **Acil arama Telegram üzerinden başarıyla başlatıldı!** Bot sizi arıyor."
        });
      } else {
        return interaction.editReply({
          content:
            "❌ **Arama başarısız.** Lütfen Telegram botunuzun ve arama servisinin (CallMeBot) yapılandırıldığından emin olun."
        });
      }
    } catch (err) {
      console.error("[panel_emergency_call] Error:", err);
      return interaction.editReply({
        content: `❌ Arama tetiklenirken hata oluştu: ${err.message}`
      });
    }
  }

  // Direkt Mod Alım - Grup Doğrulama Modalı Göster
  if (customId.startsWith("panel_direct_mod_show_verify_")) {
    const targetUserId = customId.replace("panel_direct_mod_show_verify_", "");
    try {
      const verifyModal = new ModalBuilder()
        .setCustomId(`panel_modal_mod_verify_groups_${targetUserId}`)
        .setTitle("🔗 Roblox Grup Doğrulama");
      
      verifyModal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("roblox_username")
            .setLabel("Roblox Kullanıcı Adı")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Örn: ahmetUser123")
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("group_ids")
            .setLabel("Grup ID'leri (virgülle ayrılmış, opsiyonel)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder("Örn: 12345,67890,11111")
        )
      );
      return showModalSafely(verifyModal);
    } catch (err) {
      console.error('[panel_direct_mod_show_verify] Modal hatası:', err.message);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: `❌ Modal gösterilirken hata: ${err.message}`, ephemeral: true });
      }
    }
  }

  // Tab navigation
  if (customId.startsWith("panel_tab_")) {
    const tabName = customId.replace("panel_tab_", "");
    await interaction.deferUpdate();
    return renderPanel(interaction, tabName);
  }

  // Sub-tab navigation
  const subTabs = {
    panel_mod_blacklist: "blacklist",
    panel_staff_attendance: "attendance",
    panel_sys_toggles: "toggles",
    panel_sys_roblox_ranks: "roblox_ranks",
    panel_sys_birim: "birim",
    panel_sys_giveaway_ai: "giveaway_ai",
    panel_mod_alim: "mod_alim"
  };

  if (subTabs[customId]) {
    await interaction.deferUpdate();
    return renderPanel(interaction, subTabs[customId]);
  }

  // ── MODERATION MODALS ──────────────────────────────────────────────────────

  if (customId === "panel_mod_bulk_delete") {
    try {
      const modal = new ModalBuilder()
        .setCustomId("panel_modal_bulk_delete")
        .setTitle("🗑️ Toplu Mesaj Sil");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("miktar")
            .setLabel("Silinecek Mesaj Sayısı (1-100)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return showModalSafely(modal);
    } catch (err) {
      console.error('[panel_mod_bulk_delete] Modal hatası:', err.message);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: `❌ Modal: ${err.message}`, ephemeral: true });
      }
    }
  }

  if (customId === "panel_mod_mute") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_mute")
      .setTitle("🔇 Kullanıcı Sustur (Timeout)");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Kullanıcı ID veya Etiketi")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("sure")
          .setLabel("Süre (Örn: 10m, 1h, 1d veya 1h30m)")
          .setValue("10m")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("sebep")
          .setLabel("Susturma Sebebi")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_mod_unmute") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_unmute")
      .setTitle("🔊 Susturma Kaldır");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Kullanıcı ID veya Etiketi")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_mod_modaction") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_modaction")
      .setTitle("🚷 Ceza İşlem (Modİşlem)");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Ceza Verilecek Kullanıcı (ID/Etiket)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("sebep")
          .setLabel("İhlal Kodu (Örn: KUFUR, SPAM, REKLAM)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kanit")
          .setLabel("Kanıt Ekran Görüntüsü Linki (Opsiyonel)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_mod_tamban") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_tamban")
      .setTitle("🔨 Tam Ban (Global)");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici_id")
          .setLabel("Kullanıcı Discord ID veya Etiketi")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("seviye")
          .setLabel("Ban Seviyesi (very_high, high, medium, low)")
          .setValue("high")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("sebep")
          .setLabel("Gerekçe")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_mod_tamban_kaldir") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_tamban_kaldir")
      .setTitle("🔓 Tam Ban Kaldır");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici_id")
          .setLabel("Kullanıcı Discord ID veya Etiketi")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("sebep")
          .setLabel("Kaldırma Gerekçesi")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  // ── BLACKLIST MODAL OPEN ───────────────────────────────────────────────────

  if (customId.startsWith("panel_blacklist_btn_openform:")) {
    const option = customId.split(":")[1];

    if (option === "1") {
      const modal = new ModalBuilder()
        .setCustomId("panel_modal_bl_add_person")
        .setTitle("👤 Karalisteye Kişi Ekle");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Kullanıcı Adı veya Discord ID'si / Etiket")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Engelleme Gerekçesi")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
      return showModalSafely(modal);
    }

    if (option === "2") {
      const modal = new ModalBuilder()
        .setCustomId("panel_modal_bl_add_group")
        .setTitle("🛡️ Karalisteye Grup Ekle");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Grup veya Platform İsmi")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Engelleme Gerekçesi")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
      return showModalSafely(modal);
    }

    if (option === "3") {
      const modal = new ModalBuilder()
        .setCustomId("panel_modal_bl_remove_standard")
        .setTitle("📤 Karalisteden Kaldır");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Kaldırılacak Kişi / Grup İsmi")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return showModalSafely(modal);
    }

    if (option === "4") {
      const modal = new ModalBuilder()
        .setCustomId("panel_modal_bl_remove_complete")
        .setTitle("🗑️ Karalisteden Tamamen Sil");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Silinecek Kişi / Grup İsmi")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return showModalSafely(modal);
    }

    if (option === "5") {
      const modal = new ModalBuilder()
        .setCustomId("panel_modal_bl_reopen")
        .setTitle("🔄 Karalisteyi Yeniden Aç");
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Yeniden Açılacak Kişi / Grup İsmi")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return showModalSafely(modal);
    }
  }

  // ── STAFF MANAGEMENT ───────────────────────────────────────────────────────

  if (customId === "panel_staff_report") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { generateStaffReport } = require("./staffSystem");
      const reportEmbed = await generateStaffReport(client);
      return interaction.editReply({ embeds: [reportEmbed] });
    } catch (e) {
      return interaction.editReply(`❌ İlerleme raporu oluşturulamadı: ${e.message}`);
    }
  }

  if (customId === "panel_staff_setstats") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_staff_setstats")
      .setTitle("⚙️ Personel İstatistik Güncelle");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Personel Discord ID'si / Etiketi")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("parametre")
          .setLabel("Seçenek (tickets/messages/voice/level/warnings)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("deger")
          .setLabel("Yeni Sayısal Değer")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_staff_fire") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_staff_fire")
      .setTitle("🚪 Personel Kov & Sil");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Kovulacak Personel ID/Etiket")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("sebep")
          .setLabel("Kovulma Sebebi")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_staff_promote_demote") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_staff_promote_demote")
      .setTitle("🎖️ Terfi veya Tenzilat");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Personel Discord ID/Etiket")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("islem")
          .setLabel("İşlem Tipi (terfi veya tenzilat)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("sebep")
          .setLabel("Gerekçe / Açıklama")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_staff_skip_exam_promote") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_staff_skip_exam_promote")
      .setTitle("🎓 Sınavsız Terfi (Sınav Atlama)");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Discord ID / Etiket / Kullanıcı Adı")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("Örn: ahmet123 veya 1031620522406072350")
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("sebep")
          .setLabel("Terfi Gerekçesi / Açıklama")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder("Neden bu yetkili sınavsız terfi alıyor?")
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_staff_reward") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_staff_reward")
      .setTitle("🎁 Ödül Ver veya Al");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Personel Discord ID/Etiket")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("islem")
          .setLabel("İşlem Tipi (ver veya al)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("odul")
          .setLabel("Ödül İsmi veya Açıklaması")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_staff_giveleave") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_staff_giveleave")
      .setTitle("🏖️ İzin Günü Tanımla");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("İzin Verilecek Personel Discord ID/Etiket")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("tarih")
          .setLabel("İzin Tarihi (YYYY-MM-DD)")
          .setPlaceholder("Örn: 2026-07-15")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("sebep")
          .setLabel("Gerekçe")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  // ── ATTENDANCE ─────────────────────────────────────────────────────────────

  if (customId === "panel_staff_attendance_start") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { startRollCall } = require("./rollCallService");
      await startRollCall(client, interaction);
    } catch (e) {
      return interaction.editReply(`❌ Yoklama başlatılamadı: ${e.message}`);
    }
    return;
  }

  if (customId === "panel_staff_attendance_stop") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { endRollCall } = require("./rollCallService");
      await endRollCall(client, interaction);
    } catch (e) {
      return interaction.editReply(`❌ Yoklama bitirilemedi: ${e.message}`);
    }
    return;
  }

  // ── SYSTEM TOGGLES ─────────────────────────────────────────────────────────

  if (customId.startsWith("panel_sys_toggle_")) {
    const toggleName = customId.replace("panel_sys_toggle_", "");
    await interaction.deferReply({ ephemeral: true });
    try {
      const ServerConfig = require("../../models/ServerConfig");
      const { TARGET_GUILD_ID } = require("../../config");
      let cfg =
        (await ServerConfig.findOne({ guildId: TARGET_GUILD_ID })) ||
        new ServerConfig({ guildId: TARGET_GUILD_ID });

      const keyMap = {
        economy: "economyEnabled",
        moderation: "moderationEnabled",
        fun: "funEnabled"
      };
      const key = keyMap[toggleName];

      if (!key) return interaction.editReply("❌ Geçersiz sistem modülü.");

      cfg[key] = !cfg[key];
      await cfg.save();
      return interaction.editReply(
        `✅ **${toggleName.toUpperCase()}** sistemi durumu güncellendi: **${cfg[key] ? "AKTİF" : "DEVRE DIŞI"}**`
      );
    } catch (e) {
      return interaction.editReply(`❌ Sistem toggle işlemi başarısız: ${e.message}`);
    }
  }

  // ── SYSTEM MODALS ──────────────────────────────────────────────────────────

  if (customId === "panel_sys_channel_perms") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_sys_channel_perms")
      .setTitle("🔒 Kanal İzinlerini Yönet");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kanal")
          .setLabel("Kanal ID")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("islem")
          .setLabel("İşlem Tipi (izin_ekle veya izin_kaldir)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("izin")
          .setLabel("İzin Tipi (commands/economy/fun)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_sys_otomod") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_sys_otomod")
      .setTitle("🛡️ Discord Otomod Yönetimi");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("islem")
          .setLabel("İşlem (ayarla veya kapat)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_sys_birimalimi") {
    // Birim seçmek için select menu göster
    const birimSelect = new StringSelectMenuBuilder()
      .setCustomId("panel_birim_select_menu")
      .setPlaceholder("📢 Birim seçin...")
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel("🚫 BAN BİRİMİ")
          .setValue("BAN_BIRIMI")
          .setDescription("Banlamalar ve kara liste yönetimi"),
        new StringSelectMenuOptionBuilder()
          .setLabel("🎤 SES BİRİMİ")
          .setValue("SES_BIRIMI")
          .setDescription("Sesli kanal yönetimi"),
        new StringSelectMenuOptionBuilder()
          .setLabel("💬 SOHBET BİRİMİ")
          .setValue("SOHBET_BIRIMI")
          .setDescription("Metin kanalı yönetimi"),
      ]);
    
    const row = new ActionRowBuilder().addComponents(birimSelect);
    return interaction.reply({ content: "📢 Lütfen bir birim seçin:", components: [row], ephemeral: true });
  }

  if (customId === "panel_sys_birimtanitim") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const embed = new EmbedBuilder()
        .setTitle("🛡️ EkoYıldız Birim Tanıtımları")
        .setDescription(
          "🤖 **BAN BİRİMİ:** Sunucu yasakları, karaliste kontrolleri ve güvenlik.\n" +
          "🎤 **SES BİRİMİ:** Sesli kanallardaki düzen, yardım ve denetim.\n" +
          "💬 **SOHBET BİRİMİ:** Metin kanallarının aktifliği ve sohbet kuralları."
        )
        .setColor(0x3498DB)
        .setTimestamp();
      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply("✅ Birim tanıtım mesajları kanala gönderildi.");
    } catch (e) {
      return interaction.editReply(`❌ Birim tanıtımı gönderilemedi: ${e.message}`);
    }
  }

  // ── ROBLOX MODALS ──────────────────────────────────────────────────────────

  if (customId === "panel_sys_ekobang") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_sys_ekobang")
      .setTitle("🔒 EkoBang Yetki Al");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Kullanıcı Discord ID veya Etiketi")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_sys_ekobangerial") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_sys_ekobangerial")
      .setTitle("🔓 EkoBang Geri Yükle");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Kullanıcı Discord ID veya Etiketi")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_sys_grupcekeko") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_sys_grupcekeko")
      .setTitle("⬇️ GrupÇekEko Rütbe İndir");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("username")
          .setLabel("Roblox Kullanıcı Adı")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_sys_grupcekekogerial") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_sys_grupcekekogerial")
      .setTitle("⬆️ GrupÇekEko Rütbe İade");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("username")
          .setLabel("Roblox Kullanıcı Adı")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  // ── AI & GIVEAWAY MODALS ───────────────────────────────────────────────────

  if (customId === "panel_sys_xpcekilis") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_sys_xpcekilis")
      .setTitle("🎉 Rütbe XP Çekilişi");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("xp_miktari")
          .setLabel("Dağıtılacak Toplam XP Miktarı")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kazanan_sayisi")
          .setLabel("Kazanan Kişi Sayısı")
          .setValue("1")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_sys_konus") {
    const modal = new ModalBuilder()
      .setCustomId("panel_modal_sys_konus")
      .setTitle("💬 AI Destekli DM Uyarısı");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kullanici")
          .setLabel("Konuşulacak Kişi ID/Etiket")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("konu")
          .setLabel("Görüşülecek Konu / İhlal")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    return showModalSafely(modal);
  }

  if (customId === "panel_sys_abusetest") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const embed = new EmbedBuilder()
        .setTitle("🚨 Olası Abuse Tespit Edildi")
        .setDescription(
          "Aşağıdaki kullanıcı sunucuda şüpheli hareketler sergilemektedir (Mock Test)."
        )
        .setColor(0xff0000)
        .addFields({ name: "Kullanıcı", value: "Simüle Edilen Üye" })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("abuse_roles_take:test")
          .setLabel("Rolleri Al")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("abuse_kick:test")
          .setLabel("Sunucudan At")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("abuse_ban:test")
          .setLabel("Yasaka / Ban")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("abuse_ignore:test")
          .setLabel("Yoksay")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.editReply("✅ Abuse test embedi başarıyla bu kanala gönderildi.");
    } catch (e) {
      return interaction.editReply(`❌ Abuse test embedi gönderilemedi: ${e.message}`);
    }
  }

  // MOD-ALIM Handler
  if (customId === "panel_mod_alim_search") {
    try {
      // Modal göster - kullanıcı seçimi için
      const modal = new ModalBuilder()
        .setCustomId("panel_modal_mod_alim")
        .setTitle("🛡️ MOD-ALIM: Mülakat Gönder");
      
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("mod_alim_user")
            .setLabel("Aday Kullanıcı (ID veya @Etiket)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Örn: @kullanici veya 1234567890")
        )
      );
      
      return showModalSafely(modal);
    } catch (err) {
      console.error("[panel_mod_alim_search]", err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply(`❌ Hata: ${err.message}`);
      }
      return interaction.editReply(`❌ Hata: ${err.message}`);
    }
  }

  // DIREKT MOD ALIM (Mülakat olmadan rol ver + doğrula)
  if (customId === "panel_mod_alim_direct") {
    try {
      const modal = new ModalBuilder()
        .setCustomId("panel_modal_mod_alim_direct")
        .setTitle("⚡ Direkt Moderatör Alımı");
      
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("direct_mod_user")
            .setLabel("Kullanıcı ID veya @Etiket")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Örn: @kullanici veya 1234567890")
        )
      );
      
      return showModalSafely(modal);
    } catch (err) {
      console.error("[panel_mod_alim_direct]", err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply(`❌ Hata: ${err.message}`);
      }
      return interaction.editReply(`❌ Hata: ${err.message}`);
    }
  }

  // ── UNITS: Leaderboard Görüntüle ────────────────────────────────────────────
  if (customId === "panel_units_leaderboard") {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
      const { createLeaderboardEmbed } = require("./unitLeaderboardService");
      const embed = await createLeaderboardEmbed();

      if (!embed) {
        return interaction.editReply("❌ Liderbordu oluşturulamadı.");
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[panel_units_leaderboard]", err);
      return interaction.editReply(`❌ Hata: ${err.message}`);
    }
  }

  // ── UNITS: Birim Koçu Bilgisi ───────────────────────────────────────────────
  if (customId === "panel_units_coach") {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
      const { createCoachInfoEmbed } = require("./coachManagementService");
      const embed = await createCoachInfoEmbed();

      if (!embed) {
        return interaction.editReply("❌ Koç bilgisi alınamadı.");
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[panel_units_coach]", err);
      return interaction.editReply(`❌ Hata: ${err.message}`);
    }
  }

  // ── UNITS: Birim Rolleri Yönetimi ───────────────────────────────────────────
  if (customId === "panel_units_roles") {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
      const { ensureUnitRolesExist } = require("./unitRoleSyncService");
      const guild = await interaction.client.guilds.fetch('1466927911364726845').catch(() => null);

      if (!guild) {
        return interaction.editReply("❌ Sunucu bulunamadı.");
      }

      const result = await ensureUnitRolesExist(guild);

      if (!result.success) {
        return interaction.editReply(`❌ Roller oluşturulurken hata: ${result.error}`);
      }

      const embed = new EmbedBuilder()
        .setTitle("✅ Birim Rolleri Yönetimi")
        .setColor(0x2ecc71)
        .setDescription("Tüm birim rolleri başarıyla sunucuya eklendi veya güncellendir.")
        .addFields({
          name: "📋 Oluşturulan Roller",
          value: `**BAN BİRİMİ:** 4 Rol\n**SES BİRİMİ:** 4 Rol\n**SOHBET BİRİMİ:** 4 Rol\n\nToplam: 12 Rol`,
          inline: false
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[panel_units_roles]", err);
      return interaction.editReply(`❌ Hata: ${err.message}`);
    }
  }
}

/**
 * Handles blacklist select menu value updates
 */
async function handlePanelSelect(interaction) {
  if (interaction.customId === "panel_blacklist_select") {
    const option = interaction.values[0];
    await interaction.deferUpdate();
    return renderPanel(interaction, "blacklist", option);
  }

  // Birim alımı seçim menüsü
  if (interaction.customId === "panel_birim_select_menu") {
    const birimKey = interaction.values[0];
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
      const { startBirimAlimi } = require("./unitService");
      await startBirimAlimi(interaction, client, birimKey);
    } catch (e) {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: `❌ Birim alımı başlatılamadı: ${e.message}`, ephemeral: true });
      }
      return interaction.editReply(`❌ Birim alımı başlatılamadı: ${e.message}`);
    }
    return;
  }
}

/**
 * Processes inputs from modal submissions.
 *
 * FIX: Modal interactions must be replied to via deferReply/editReply OR
 * the downstream handler must use the same interaction token.
 * For handlers that delegate to external functions (tamban, modaction, etc.)
 * we now pass a lightweight proxy so those functions can call editReply safely
 * after we have already deferred.
 */
async function handlePanelModal(interaction) {
  // Defer first to guarantee it is deferred within the 3-second limit
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const customId = interaction.customId;
  const client = interaction.client;

  // Only fetch blacklist log channel if this is a blacklist modal
  let logChannel = null;
  if (customId.startsWith("panel_modal_bl_")) {
    logChannel = await client.channels.fetch(BLACKLIST_LOG_CHANNEL_ID).catch(() => null);
  }

  // ── BLACKLIST: Kişi Ekle ───────────────────────────────────────────────────
  if (customId === "panel_modal_bl_add_person") {
    const name = interaction.fields.getTextInputValue("name").trim();
    const reason = interaction.fields.getTextInputValue("reason").trim();

    try {
      const safePattern = new RegExp(`^${escapeRegex(name)}$`, 'i');
      let entry = await Blacklist.findOne({ name: { $regex: safePattern } });
      let isNew = false;

      if (entry) {
        entry.reason = reason;
        entry.type = 'person';
        entry.status = 'active';
        entry.removedAt = null;
        await entry.save();
      } else {
        entry = new Blacklist({ name, type: 'person', reason, status: 'active' });
        await entry.save();
        isNew = true;
      }

      await renderBlacklist(client);

      if (logChannel) {
        await logChannel.send({
          content:
            `📥 **[KARALİSTE EKLEME]** <@${interaction.user.id}> tarafından **${name}** listeye eklendi.\n` +
            `📋 **Sebep:** ${reason}\n` +
            `📂 **Tür:** Kişi (${isNew ? 'Yeni Kayıt' : 'Güncellendi'})`
        });
      }
      return interaction.editReply(`✅ **${name}** başarıyla karalisteye kişi olarak eklendi!`);
    } catch (e) {
      return interaction.editReply(`❌ Karalisteye eklenirken hata: ${e.message}`);
    }
  }

  // ── BLACKLIST: Grup Ekle ───────────────────────────────────────────────────
  if (customId === "panel_modal_bl_add_group") {
    const rawName = interaction.fields.getTextInputValue("name").trim();
    const name = rawName.endsWith(" grubu") ? rawName : rawName + " grubu";
    const reason = interaction.fields.getTextInputValue("reason").trim();

    try {
      const safePattern = new RegExp(`^${escapeRegex(name)}$`, 'i');
      let entry = await Blacklist.findOne({ name: { $regex: safePattern } });
      let isNew = false;

      if (entry) {
        entry.reason = reason;
        entry.type = 'group';
        entry.status = 'active';
        entry.removedAt = null;
        await entry.save();
      } else {
        entry = new Blacklist({ name, type: 'group', reason, status: 'active' });
        await entry.save();
        isNew = true;
      }

      await renderBlacklist(client);

      if (logChannel) {
        await logChannel.send({
          content:
            `📥 **[KARALİSTE EKLEME (GRUP)]** <@${interaction.user.id}> tarafından **${name}** listeye eklendi.\n` +
            `📋 **Sebep:** ${reason}\n` +
            `📂 **Tür:** 🛡️ Grup (${isNew ? 'Yeni Kayıt' : 'Güncellendi'})`
        });
      }
      return interaction.editReply(`✅ **${name}** başarıyla karalisteye grup olarak eklendi!`);
    } catch (e) {
      return interaction.editReply(`❌ Karalisteye eklenirken hata: ${e.message}`);
    }
  }

  // ── BLACKLIST: Sorun Çözüldü Kaldır ───────────────────────────────────────
  if (customId === "panel_modal_bl_remove_standard") {
    const name = interaction.fields.getTextInputValue("name").trim();

    try {
      const safePattern = new RegExp(`^${escapeRegex(name)}$`, 'i');
      const entry = await Blacklist.findOne({ name: { $regex: safePattern } });
      if (!entry) return interaction.editReply(`❌ **${name}** karalistede bulunamadı!`);

      entry.status = 'removed';
      entry.removedAt = new Date();
      await entry.save();

      await renderBlacklist(client);

      if (logChannel) {
        await logChannel.send({
          content: `📤 **[KARALİSTE KALDIRMA]** <@${interaction.user.id}> tarafından **${entry.name}** kaldırıldı. (15 gün sonra silinecektir.)`
        });
      }
      return interaction.editReply(`✅ **${entry.name}** karaliste yasağı kaldırıldı (strikethrough yapıldı).`);
    } catch (e) {
      return interaction.editReply(`❌ Karaliste kaldırma hatası: ${e.message}`);
    }
  }

  // ── BLACKLIST: Tamamen Sil ─────────────────────────────────────────────────
  if (customId === "panel_modal_bl_remove_complete") {
    const name = interaction.fields.getTextInputValue("name").trim();

    try {
      const safePattern = new RegExp(`^${escapeRegex(name)}$`, 'i');
      const entry = await Blacklist.findOne({ name: { $regex: safePattern } });
      if (!entry) return interaction.editReply(`❌ **${name}** karalistede bulunamadı!`);

      await Blacklist.deleteOne({ _id: entry._id });
      await renderBlacklist(client);

      if (logChannel) {
        await logChannel.send({
          content: `🗑️ **[KARALİSTE TAMAMEN SİLİNDİ]** <@${interaction.user.id}> tarafından **${entry.name}** tamamen veritabanından silindi.`
        });
      }
      return interaction.editReply(`✅ **${entry.name}** listeden anında ve tamamen silindi!`);
    } catch (e) {
      return interaction.editReply(`❌ Karaliste silme hatası: ${e.message}`);
    }
  }

  // ── BLACKLIST: Yeniden Aç ──────────────────────────────────────────────────
  if (customId === "panel_modal_bl_reopen") {
    const name = interaction.fields.getTextInputValue("name").trim();

    try {
      const safePattern = new RegExp(`^${escapeRegex(name)}$`, 'i');
      const entry = await Blacklist.findOne({ name: { $regex: safePattern } });
      if (!entry) return interaction.editReply(`❌ **${name}** karalistede bulunamadı!`);

      entry.status = 'active';
      entry.removedAt = null;
      await entry.save();

      await renderBlacklist(client);

      if (logChannel) {
        await logChannel.send({
          content: `🔄 **[KARALİSTE YENİDEN ETKİN]** <@${interaction.user.id}> tarafından **${entry.name}** yasağı yeniden aktif edildi.`
        });
      }
      return interaction.editReply(`✅ **${entry.name}** karaliste kaydı başarıyla yeniden açıldı!`);
    } catch (e) {
      return interaction.editReply(`❌ Karaliste açma hatası: ${e.message}`);
    }
  }

  // ── TOPLU MESAJ SİL ────────────────────────────────────────────────────────
  if (customId === "panel_modal_bulk_delete") {
    const miktar = parseInt(interaction.fields.getTextInputValue("miktar").trim(), 10);
    if (isNaN(miktar) || miktar < 1 || miktar > 100) {
      return interaction.editReply("❌ Lütfen 1 ile 100 arasında geçerli bir sayı girin.");
    }

    try {
      const deleted = await interaction.channel.bulkDelete(miktar, true); // true = only messages < 14 days
      return interaction.editReply(
        `✅ **${deleted.size}** mesaj başarıyla silindi.` +
        (deleted.size < miktar
          ? ` (${miktar - deleted.size} mesaj 14 günden eski olduğu için atlandı.)`
          : "")
      );
    } catch (e) {
      return interaction.editReply(`❌ Mesajlar silinemedi: ${e.message}`);
    }
  }

  // ── SUSTUR (MUTE) ──────────────────────────────────────────────────────────
  if (customId === "panel_modal_mute") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const durationVal = interaction.fields.getTextInputValue("sure").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.editReply("❌ Belirtilen kullanıcı sunucuda bulunamadı.");

    try {
      const durationMs = parseDuration(durationVal);
      await member.timeout(durationMs, `Panel yetkilisi: ${interaction.user.tag} - Sebep: ${reason}`);
      return interaction.editReply(
        `✅ **${member.user.tag}** kullanıcısı **${durationVal}** süreyle susturuldu.\nSebep: ${reason}`
      );
    } catch (e) {
      return interaction.editReply(`❌ Susturma işlemi başarısız: ${e.message}`);
    }
  }

  // ── SUSTURMA AÇ ────────────────────────────────────────────────────────────
  if (customId === "panel_modal_unmute") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.editReply("❌ Belirtilen kullanıcı sunucuda bulunamadı.");

    try {
      await member.timeout(null, `Panel yetkilisi: ${interaction.user.tag}`);
      return interaction.editReply(`✅ **${member.user.tag}** kullanıcısının susturması kaldırıldı.`);
    } catch (e) {
      return interaction.editReply(`❌ Susturma kaldırılamadı: ${e.message}`);
    }
  }

  // ── CEZA İŞLEM (MODİŞLEM) ─────────────────────────────────────────────────
  // FIX: We build a proper proxy object instead of mutating the live interaction.
  if (customId === "panel_modal_modaction") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();
    const attachmentUrl = interaction.fields.getTextInputValue("kanit").trim() || null;

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Kullanıcı bulunamadı.");

    try {
      const fakeAttachment = attachmentUrl ? { url: attachmentUrl } : null;
      const { executeModAction } = require("./modActionService");
      await executeModAction(interaction, targetUser, reason, fakeAttachment);
      // executeModAction should call interaction.editReply internally
    } catch (e) {
      return interaction.editReply(`❌ Ceza işlemi başarısız: ${e.message}`);
    }
    return;
  }

  // ── TAM BAN ────────────────────────────────────────────────────────────────
  // FIX: Build an isolated proxy — never mutate interaction.commandName on the live object.
  if (customId === "panel_modal_tamban") {
    const kullanici_id = interaction.fields.getTextInputValue("kullanici_id").trim().replace(/[<@!>]/g, "");
    const seviye = interaction.fields.getTextInputValue("seviye").trim();
    const sebep = interaction.fields.getTextInputValue("sebep").trim();

    try {
      const { handleModerationCommand } = require("../handlers/moderationCommandHandler");
      const proxy = buildProxy(interaction, "tamban", {
        getString: (name) => {
          if (name === "kullanici_id") return kullanici_id;
          if (name === "seviye") return seviye;
          if (name === "sebep") return sebep;
          return null;
        }
      });
      await handleModerationCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ Tam Ban işlemi başarısız: ${e.message}`);
    }
    return;
  }

  // ── TAM BAN KALDIR ─────────────────────────────────────────────────────────
  if (customId === "panel_modal_tamban_kaldir") {
    const kullanici_id = interaction.fields.getTextInputValue("kullanici_id").trim().replace(/[<@!>]/g, "");
    const sebep = interaction.fields.getTextInputValue("sebep").trim();

    try {
      const { handleModerationCommand } = require("../handlers/moderationCommandHandler");
      const proxy = buildProxy(interaction, "tamban_kaldir", {
        getString: (name) => {
          if (name === "kullanici_id") return kullanici_id;
          if (name === "sebep") return sebep;
          return null;
        }
      });
      await handleModerationCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ Tam Ban kaldırılamadı: ${e.message}`);
    }
    return;
  }

  // ── STAFF STATS EDIT ───────────────────────────────────────────────────────
  if (customId === "panel_modal_staff_setstats") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const param = interaction.fields.getTextInputValue("parametre").trim();
    const valStr = interaction.fields.getTextInputValue("deger").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Belirtilen personel bulunamadı.");

    try {
      // Defer the reply immediately to prevent "thinking..." timeout
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const proxy = buildProxy(interaction, "personelayarla", {
        getUser: () => targetUser,
        getString: () => param,
        getInteger: () => parseInt(valStr, 10) || 0
      });
      await handleGeneralCommand(proxy);
    } catch (e) {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: `❌ İstatistik güncellenemedi: ${e.message}`, ephemeral: true });
      }
      return interaction.editReply(`❌ İstatistik güncellenemedi: ${e.message}`);
    }
    return;
  }

  // ── STAFF FIRE ─────────────────────────────────────────────────────────────
  if (customId === "panel_modal_staff_fire") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Personel bulunamadı.");

    try {
      // Defer the reply immediately to prevent "thinking..." timeout
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const proxy = buildProxy(interaction, "personelkov", {
        getUser: () => targetUser,
        getString: () => reason
      });
      await handleGeneralCommand(proxy);
    } catch (e) {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: `❌ Personel silinemedi: ${e.message}`, ephemeral: true });
      }
      return interaction.editReply(`❌ Personel silinemedi: ${e.message}`);
    }
    return;
  }

  // ── STAFF SKIP EXAM PROMOTE ─────────────────────────────────────────────────
  if (customId === "panel_modal_staff_skip_exam_promote") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    let targetUser = null;
    let targetUserId = userVal.replace(/[<@!>]/g, "");

    if (isNaN(targetUserId)) {
      try {
        const members = await interaction.guild.members.fetch({ query: userVal, limit: 1 });
        const member = members.first();
        if (member) {
          targetUser = member.user;
          targetUserId = targetUser.id;
        }
      } catch (err) {
        console.warn("[skip_exam_promote] Username lookup failed:", err.message);
      }
    } else {
      targetUser = await client.users.fetch(targetUserId).catch(() => null);
    }

    if (!targetUser) {
      return interaction.editReply("❌ Belirtilen kullanıcı bulunamadı. Lütfen geçerli bir Discord ID, Etiket veya Kullanıcı Adı girin.");
    }

    try {
      const StaffProgress = require("../../models/StaffProgress");
      const { promote, ROLE_NAMES } = require("./staffSystem");

      const progress = await StaffProgress.findOne({ userId: targetUserId });
      if (!progress) {
        return interaction.editReply("❌ Bu kullanıcı personel sisteminde kayıtlı değil.");
      }

      if (progress.status !== 'active') {
        return interaction.editReply("❌ Bu personel aktif durumda değil.");
      }

      const oldLevel = progress.level || 1;
      if (oldLevel >= 6) {
        return interaction.editReply("❌ Bu personel zaten maksimum rütbeye ulaşmış.");
      }

      // Sınav durumunu sıfırla
      progress.exam = {
        status: 'none',
        scheduledAt: null,
        questions: [],
        currentQuestionIndex: 0,
        answers: [],
        lastExamAttempt: progress.exam?.lastExamAttempt || null
      };

      await progress.save();

      // Terfi ettir
      await promote(progress, client);

      const targetRoleName = ROLE_NAMES[oldLevel + 1] || `Seviye ${oldLevel + 1}`;

      // Log gönder
      try {
        const staffLogChannelId = '1466945894250188912';
        const logChannel = await client.channels.fetch(staffLogChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("🎓 Sınavsız Terfi İşlemi (Sınav Atlama)")
            .setDescription(
              `👤 **Personel:** <@${targetUserId}>\n` +
              `👑 **Yönetici:** <@${interaction.user.id}>\n` +
              `📈 **Rütbe:** ${ROLE_NAMES[oldLevel]} → **${targetRoleName}**\n` +
              `📋 **Sebep:** ${reason}`
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      } catch (logErr) {
        console.error('[skip_exam_promote] Log error:', logErr.message);
      }

      return interaction.editReply(`✅ <@${targetUserId}> adlı personel **${targetRoleName}** rütbesine sınavsız olarak başarıyla terfi ettirildi!`);
    } catch (e) {
      console.error('[skip_exam_promote] Error:', e.message);
      return interaction.editReply(`❌ Sınavsız terfi işlemi başarısız: ${e.message}`);
    }
  }

  // ── STAFF PROMOTE / DEMOTE ─────────────────────────────────────────────────
  if (customId === "panel_modal_staff_promote_demote") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const operation = interaction.fields.getTextInputValue("islem").trim().toLowerCase();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Personel bulunamadı.");

    try {
      // Defer the reply immediately to prevent "thinking..." timeout
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");

      if (operation === "terfi") {
        const proxy = buildProxy(interaction, "birimterfi", { getUser: () => targetUser });
        await handleGeneralCommand(proxy);
      } else if (operation === "tenzilat") {
        const proxy = buildProxy(interaction, "tenzilat", {
          getUser: () => targetUser,
          getString: () => reason
        });
        await handleGeneralCommand(proxy);
      } else {
        return interaction.editReply("❌ Geçersiz işlem tipi. 'terfi' veya 'tenzilat' girin.");
      }
    } catch (e) {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: `❌ Rütbe işlemi başarısız: ${e.message}`, ephemeral: true });
      }
      return interaction.editReply(`❌ Rütbe işlemi başarısız: ${e.message}`);
    }
    return;
  }

  // ── STAFF REWARDS ──────────────────────────────────────────────────────────
  if (customId === "panel_modal_staff_reward") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const operation = interaction.fields.getTextInputValue("islem").trim().toLowerCase();
    const rewardName = interaction.fields.getTextInputValue("odul").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Personel bulunamadı.");

    try {
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const proxy = buildProxy(interaction, "odulver", {
        getUser: () => targetUser,
        getString: (name) => {
          if (name === "islem") return operation;
          if (name === "odul") return rewardName;
          return null;
        }
      });
      await handleGeneralCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ Ödül işlemi başarısız: ${e.message}`);
    }
    return;
  }

  // ── STAFF GIVE LEAVE ───────────────────────────────────────────────────────
  if (customId === "panel_modal_staff_giveleave") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const dateVal = interaction.fields.getTextInputValue("tarih").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Personel bulunamadı.");

    try {
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const proxy = buildProxy(interaction, "izin_ver", {
        getUser: () => targetUser,
        getString: (name) => {
          if (name === "tarih") return dateVal;
          if (name === "sebep") return reason;
          return null;
        }
      });
      await handleGeneralCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ İzin tanımlanamadı: ${e.message}`);
    }
    return;
  }

  // ── CHANNEL PERMS ──────────────────────────────────────────────────────────
  if (customId === "panel_modal_sys_channel_perms") {
    const channelId = interaction.fields.getTextInputValue("kanal").trim();
    const operation = interaction.fields.getTextInputValue("islem").trim();
    const permType = interaction.fields.getTextInputValue("izin").trim();

    const channelObj = await client.channels.fetch(channelId).catch(() => null);
    if (!channelObj) return interaction.editReply("❌ Belirtilen kanal bulunamadı.");

    try {
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const proxy = buildProxy(interaction, "kanal", {
        getSubcommand: () => operation,
        getChannel: () => channelObj,
        getString: () => permType
      });
      await handleGeneralCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ Kanal izinleri güncellenemedi: ${e.message}`);
    }
    return;
  }

  // ── OTOMOD CONFIG ──────────────────────────────────────────────────────────
  if (customId === "panel_modal_sys_otomod") {
    const operation = interaction.fields.getTextInputValue("islem").trim();

    try {
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const proxy = buildProxy(interaction, "otomod", {
        getSubcommand: () => operation
      });
      await handleGeneralCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ Otomod güncellenemedi: ${e.message}`);
    }
    return;
  }

  // ── BRANŞ BİRİM ALIMI ─────────────────────────────────────────────────────
  if (customId === "panel_modal_sys_birimalimi") {
    const unitName = interaction.fields.getTextInputValue("birim").trim();

    try {
      // Defer the reply immediately to prevent "thinking..." timeout
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const proxy = buildProxy(interaction, "birimalimi", {
        getString: () => unitName
      });
      await handleGeneralCommand(proxy);
    } catch (e) {
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({ content: `❌ Birim alımı başlatılamadı: ${e.message}`, ephemeral: true });
      }
      return interaction.editReply(`❌ Birim alımı başlatılamadı: ${e.message}`);
    }
    return;
  }

  // ── ROBLOX EKOBANG ─────────────────────────────────────────────────────────
  if (customId === "panel_modal_sys_ekobang" || customId === "panel_modal_sys_ekobangerial") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Kullanıcı bulunamadı.");

    try {
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const cmdName = customId === "panel_modal_sys_ekobang" ? "ekobang" : "ekobangerial";
      const proxy = buildProxy(interaction, cmdName, { getUser: () => targetUser });
      await handleGeneralCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ Roblox EkoBang işlemi başarısız: ${e.message}`);
    }
    return;
  }

  // ── ROBLOX GRUP ÇEK EKO ───────────────────────────────────────────────────
  if (customId === "panel_modal_sys_grupcekeko" || customId === "panel_modal_sys_grupcekekogerial") {
    const username = interaction.fields.getTextInputValue("username").trim();

    try {
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const cmdName =
        customId === "panel_modal_sys_grupcekeko" ? "grupcekeko" : "grupcekekogerial";
      const proxy = buildProxy(interaction, cmdName, { getString: () => username });
      await handleGeneralCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ Roblox GrupÇekEko işlemi başarısız: ${e.message}`);
    }
    return;
  }

  // ── XP ÇEKİLİŞİ ───────────────────────────────────────────────────────────
  if (customId === "panel_modal_sys_xpcekilis") {
    const xp = interaction.fields.getTextInputValue("xp_miktari").trim();
    const winners = interaction.fields.getTextInputValue("kazanan_sayisi").trim();

    try {
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const proxy = buildProxy(interaction, "xpcekilis", {
        getInteger: (name) => {
          if (name === "xp_miktari") return parseInt(xp, 10) || 0;
          if (name === "kazanan_sayisi") return parseInt(winners, 10) || 1;
          return null;
        }
      });
      await handleGeneralCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ Çekiliş başlatılamadı: ${e.message}`);
    }
    return;
  }

  // ── AI DM KONUŞMA ──────────────────────────────────────────────────────────
  if (customId === "panel_modal_sys_konus") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const subject = interaction.fields.getTextInputValue("konu").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Kullanıcı bulunamadı.");

    try {
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      const proxy = buildProxy(interaction, "konus", {
        getUser: () => targetUser,
        getString: () => subject
      });
      await handleGeneralCommand(proxy);
    } catch (e) {
      return interaction.editReply(`❌ AI DM Konuşması başlatılamadı: ${e.message}`);
    }
    return;
  }

  // MOD-ALIM Modal Handler (Mülakat ile)
  if (customId === "panel_modal_mod_alim") {
    const userVal = interaction.fields.getTextInputValue("mod_alim_user").trim();
    const targetUserId = userVal.replace(/[<@!>]/g, "");
    
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) {
      return interaction.editReply({ content: "❌ Kullanıcı bulunamadı. Geçerli bir ID veya etiket gir." });
    }

    if (targetUser.bot) {
      return interaction.editReply({ content: "❌ Botlara mülakat gönderilemez." });
    }

    try {
      const { startModInterview } = require('./modInterview');
      const sent = await startModInterview(targetUser, interaction.user.id, interaction.guild?.id, client);

      if (sent) {
        const successEmbed = new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle("✅ MOD-ALIM Mülakatı Gönderildi")
          .setDescription(
            `**Aday:** ${targetUser}\n` +
            `**Tarih:** ${new Date().toLocaleString('tr-TR')}\n\n` +
            `Kullanıcıya mülakat daveti DM'de gönderildi.`
          )
          .addFields(
            { name: '⏱️ Beklenen Süre', value: '5-10 dakika', inline: false },
            { name: '📋 Mülakat Turu', value: 'MOD-ALIM: 7 Soru - Master Moderatör Mülakatı', inline: false }
          )
          .setFooter({ text: 'Panel üzerinden gönderildi' })
          .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed] });
      } else {
        return interaction.editReply({ 
          content: `❌ **${targetUser.username}** kullanıcısına DM gönderilemedi.\n\n💡 *Kullanıcı DM'lerini kapamış olabilir.*` 
        });
      }
    } catch (err) {
      console.error('[panel_modal_mod_alim]', err);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // DIREKT MOD ALIM Modal Handler (Rol Ver + Doğrula)
  if (customId === "panel_modal_mod_alim_direct") {
    const userVal = interaction.fields.getTextInputValue("direct_mod_user").trim();
    const targetUserId = userVal.replace(/[<@!>]/g, "");
    
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) {
      return interaction.editReply({ content: "❌ Kullanıcı bulunamadı." });
    }

    const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1518692389169135666';
    const MOD_GUILD_ID = process.env.MOD_GUILD_ID || '1367646464804655104';

    try {
      // 1. Rol ver
      const guild = await client.guilds.fetch(MOD_GUILD_ID);
      const member = await guild.members.fetch(targetUserId);
      await member.roles.add(MOD_ROLE_ID, `Direkt moderatör alımı — Yönetici: ${interaction.user.tag}`);

      // 2. Staff sistemine kayıt
      const StaffProgress = require('../../models/StaffProgress');
      let staffRecord = await StaffProgress.findOne({ userId: targetUserId });
      if (!staffRecord) {
        staffRecord = new StaffProgress({ userId: targetUserId, guildId: MOD_GUILD_ID, level: 1 });
      } else if (staffRecord.level < 1) {
        staffRecord.level = 1;
      }
      await staffRecord.save();

      // Moderatör yönetim sunucusunda değilse davet linki gönder
      const { ensureAdminGuildMembership } = require('./staffAutomation');
      await ensureAdminGuildMembership(client, targetUserId).catch(() => {});

      // 3. Grup doğrula - API çağrısı için modal göster
      const verifyModal = new ModalBuilder()
        .setCustomId(`panel_modal_mod_verify_groups_${targetUserId}`)
        .setTitle("🔗 Roblox Grup Doğrulama");
      
      verifyModal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("roblox_username")
            .setLabel("Roblox Kullanıcı Adı")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Örn: ahmetUser123")
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("group_ids")
            .setLabel("Grup ID'leri (virgülle ayrılmış, opsiyonel)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder("Örn: 12345,67890,11111")
        )
      );

      // Başarı mesajı + grup doğrula modalı
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle("✅ Moderatör Alımı Başarılı")
          .setDescription(
            `**Kullanıcı:** ${targetUser.tag}\n` +
            `**ID:** ${targetUserId}\n\n` +
            `✓ Moderatör rolü verildi\n` +
            `✓ Staff sistemine kaydedildi\n\n` +
            `Şimdi grup doğrulaması için aşağıdaki bilgileri gir.`
          )
          .setFooter({ text: 'Direkt Alım Sistemi' })
          .setTimestamp()],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`panel_direct_mod_show_verify_${targetUserId}`)
              .setLabel("🔗 Grup Doğrula")
              .setStyle(ButtonStyle.Primary)
          )
        ]
      });

    } catch (err) {
      console.error('[panel_modal_mod_alim_direct]', err);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // DIREKT MOD ALIM: Grup Doğrulama Modal Submit Handler
  if (customId.startsWith("panel_modal_mod_verify_groups_")) {
    const targetUserId = customId.replace("panel_modal_mod_verify_groups_", "");
    const robloxUsername = interaction.fields.getTextInputValue("roblox_username").trim();

    try {
      const noblox = require('noblox.js');
      const robloxId = await noblox.getIdFromUsername(robloxUsername).catch(() => null);
      if (!robloxId) {
        return interaction.editReply(`❌ **${robloxUsername}** adında bir Roblox kullanıcısı bulunamadı. Lütfen kullanıcı adını kontrol edin.`);
      }

      // 1. Veritabanına kaydet
      const { saveStoreNow } = require('../../models/Store');
      const targetUser = await client.users.fetch(targetUserId).catch(() => null);
      
      let dbUser = await User.findOne({ discordId: targetUserId });
      if (!dbUser) {
        dbUser = new User({ 
          discordId: targetUserId,
          discordUsername: targetUser ? targetUser.username : "Bilinmeyen Kullanıcı"
        });
      }
      dbUser.robloxId = String(robloxId);
      dbUser.robloxUsername = robloxUsername;
      dbUser.isAuthorized = true;
      await dbUser.save();
      saveStoreNow();

      // 2. Roblox yetkili grubu rütbelerini senkronize et
      const { syncStaffRobloxRanks, syncStaffDiscordRoles } = require('./staffAutomation');
      await syncStaffRobloxRanks(client, targetUserId);
      await syncStaffDiscordRoles(client, targetUserId);

      // 3. Ana sunucuda rolleri senkronize et
      const { syncMemberRoles } = require('./roleSyncService');
      const { TARGET_GUILD_ID, VERIFY_CHANNEL_ID } = require('../../config');
      
      const mainGuild = await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
      if (mainGuild) {
        const mainMember = await mainGuild.members.fetch(targetUserId).catch(() => null);
        if (mainMember) {
          await syncMemberRoles(mainGuild, mainMember, robloxId, robloxUsername);
        }
      }

      // 4. Kullanıcıya DM ve sunucuda grup doğrulaması mesajı gönder
      if (targetUser) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x7c6af7)
          .setTitle("🔗 Roblox Grup Doğrulaması Başarılı")
          .setThumbnail(targetUser.avatarURL() || null)
          .setDescription(
            `Merhaba **${targetUser.username}**! 👋\n\n` +
            `Roblox hesabınız başarıyla doğrulandı ve yetkili yetkileriniz tanımlandı.\n\n` +
            `🎮 **Roblox Kullanıcı Adı:** \`${robloxUsername}\`\n` +
            `🆔 **Roblox ID:** \`${robloxId}\`\n` +
            `📈 **Personel Seviyesi:** \`Stajyer (Level 1)\`\n\n` +
            `✓ Discord rolleri senkronize edildi\n` +
            `✓ Roblox grup rütbeleri ayarlandı\n` +
            `✓ Staff sistem kaydı aktif edildi`
          )
          .setFooter({ text: "Sentara Entegrasyon Sistemi" })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] }).catch(err => {
          console.warn(`[mod_verify_groups] Could not send DM to user ${targetUserId}:`, err.message);
        });
      }

      // Ana sunucudaki doğrulama kanalına log mesajı gönder
      if (mainGuild && VERIFY_CHANNEL_ID) {
        const verifyChannel = await mainGuild.channels.fetch(VERIFY_CHANNEL_ID).catch(() => null);
        if (verifyChannel && verifyChannel.isTextBased()) {
          const publicEmbed = new EmbedBuilder()
            .setColor(0x4ade80)
            .setTitle("🔗 Yeni Personel Roblox Doğrulaması")
            .setDescription(
              `**Kullanıcı:** <@${targetUserId}> (\`${targetUserId}\`)\n` +
              `**Roblox Hesabı:** [${robloxUsername}](https://www.roblox.com/users/${robloxId}/profile) (\`${robloxId}\`)\n` +
              `**Durum:** Yetkili doğrulandı ve roller sunucuda senkronize edildi.`
            )
            .setFooter({ text: "Sentara Roblox Doğrulama" })
            .setTimestamp();
          await verifyChannel.send({ embeds: [publicEmbed] }).catch(err => {
            console.error(`[mod_verify_groups] Verify channel log failed:`, err.message);
          });
        }
      }

      return interaction.editReply({
        content: `✅ **${robloxUsername}** (ID: \`${robloxId}\`) hesabı başarıyla doğrulandı.\n- Kullanıcıya DM ile bilgi gönderildi.\n- Ana sunucu ve yetkili rolleri senkronize edildi.\n- Ana sunucudaki doğrulama kanalına bilgi mesajı gönderildi.`
      });

    } catch (err) {
      console.error('[panel_modal_mod_verify_groups]', err);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  return interaction.editReply("❌ Bilinmeyen modal işlemi.");
}

/**
 * Builds a proxy object that mimics a Discord.js interaction for delegation
 * to external command handlers. Uses the already-deferred interaction for
 * reply methods so handlers can safely call editReply without conflicts.
 *
 * @param {import('discord.js').Interaction} interaction - The real (already deferred) interaction
 * @param {string} commandName - The command name to set on the proxy
 * @param {object} optionOverrides - Override methods for interaction.options
 */
function buildProxy(interaction, commandName, optionOverrides = {}) {
  return new Proxy(interaction, {
    get(target, prop) {
      if (prop === 'commandName') return commandName;
      if (prop === 'options') return optionOverrides;
      return typeof target[prop] === 'function'
        ? target[prop].bind(target)
        : target[prop];
    }
  });
}

module.exports = {
  renderPanel,
  handlePanelButton,
  handlePanelSelect,
  handlePanelModal
};