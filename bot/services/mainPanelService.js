'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
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
const STAFF_ATTENDANCE_CHANNEL_ID = '1466945894250188912'; // Default channel for attendance count

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
  const isMod = member.permissions.has(PermissionFlagsBits.ManageMessages) ||
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
 * Generates Embed and Component rows based on tabName
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
        "⚙️ **Sistem & Otomasyon:** Otomod, Roblox, alımlar ve sistem modülleri."
      )
      .addFields(
        { name: "Yetkili", value: `${interaction.user.tag}`, inline: true },
        { name: "Rol", value: auth.isAdmin ? "👑 Yönetici" : auth.isManager ? "👨‍✈️ Yönetici / Manager" : auth.isMod ? "🛡️ Moderatör" : "👔 Personel", inline: true }
      );

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
        .setCustomId("panel_close")
        .setLabel("❌ Kapat")
        .setStyle(ButtonStyle.Secondary)
    );
    components.push(row);
  }

  else if (tabName === "moderation") {
    embed
      .setTitle("🛡️ Moderasyon İşlemleri")
      .setColor(0x34495E)
      .setDescription(
        "Sunucu düzenini korumak için moderasyon komutlarını buradan butonlarla kullanabilirsiniz.\n\n" +
        "**İşlemler:**\n" +
        "• **Sustur:** Kullanıcıya geçici susturma uygular.\n" +
        "• **Susturma Aç:** Kullanıcının susturmasını kaldırır.\n" +
        "• **Ceza (Modİşlem):** Otomatik ceza puanlı kural ihlali uygular.\n" +
        "• **Toplu Sil:** Kanaldaki mesajları toplu temizler.\n" +
        "• **Tam Ban:** Sunuculardan yasaklar ve Roblox rütbesini en alta indirir.\n" +
        "• **Tam Ban Aç:** Sunucu yasaklarını kaldırır ve Roblox rütbesini iade eder."
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_mod_mute")
        .setLabel("🔇 Sustur (Mute)")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isMod),
      new ButtonBuilder()
        .setCustomId("panel_mod_unmute")
        .setLabel("🔊 Susturma Aç")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!auth.isMod),
      new ButtonBuilder()
        .setCustomId("panel_mod_modaction")
        .setLabel("🚷 Ceza İşlem (Modİşlem)")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isMod),
      new ButtonBuilder()
        .setCustomId("panel_mod_bulk_delete")
        .setLabel("🗑️ Toplu Sil")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isMod)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_mod_blacklist")
        .setLabel("🚫 Karaliste (Blacklist)")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isMod),
      new ButtonBuilder()
        .setCustomId("panel_mod_tamban")
        .setLabel("🔨 Tam Ban (Global)")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_mod_tamban_kaldir")
        .setLabel("🔓 Tam Ban Aç")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager),
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
        "Personel istatistikleri, rütbe, izin ve yoklama işlemlerini buradan yönetin."
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_staff_report")
        .setLabel("📊 Personel İlerleme Raporu")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel_staff_setstats")
        .setLabel("⚙️ İstatistik/Seviye Ayarla")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_staff_fire")
        .setLabel("🚪 Personel Kov (Sil)")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!auth.isManager)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_staff_promote_demote")
        .setLabel("🎖️ Terfi / Tenzilat")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_staff_reward")
        .setLabel("🎁 Ödül Yönetimi")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager),
      new ButtonBuilder()
        .setCustomId("panel_staff_giveleave")
        .setLabel("🏖️ İzin Günü Tanımla")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!auth.isManager)
    );

    const row3 = new ActionRowBuilder().addComponents(
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
        "Botun genel çalışma modüllerini, Roblox grup izinlerini ve sunucu otomod ayarlarını yönetin."
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_sys_toggles")
        .setLabel("⚙️ Sistem Aktif/Pasif Toggles")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel_sys_channel_perms")
        .setLabel("🔒 Kanal İzinleri")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isAdmin),
      new ButtonBuilder()
        .setCustomId("panel_sys_otomod")
        .setLabel("🛡️ Otomod Ayarları")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!auth.isAdmin)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_sys_roblox_ranks")
        .setLabel("🎮 Roblox Rütbeleri (Bang/ÇekEko)")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("panel_sys_birim")
        .setLabel("📣 Birim Duyuruları")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("panel_sys_giveaway_ai")
        .setLabel("🎲 Çekiliş & AI Koç")
        .setStyle(ButtonStyle.Success)
    );

    const row3 = new ActionRowBuilder().addComponents(
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
      .setDescription("Branş birimleri için başvuru/alım açabilir ya da birim kurallarını kanallara gönderebilirsiniz.");

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
      .setDescription("Otomatik XP çekilişleri başlatabilir veya AI DM konuşma testlerini uygulayabilirsiniz.");

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
  
  if (customId === "panel_close") {
    return interaction.update({ content: "🔒 Kontrol paneli kapatıldı.", embeds: [], components: [] });
  }

  // Handle Tab navigation
  if (customId.startsWith("panel_tab_")) {
    const tabName = customId.replace("panel_tab_", "");
    await interaction.deferUpdate();
    return renderPanel(interaction, tabName);
  }

  // Handle sub-tab navigation
  const subTabs = {
    "panel_mod_blacklist": "blacklist",
    "panel_staff_attendance": "attendance",
    "panel_sys_toggles": "toggles",
    "panel_sys_roblox_ranks": "roblox_ranks",
    "panel_sys_birim": "birim",
    "panel_sys_giveaway_ai": "giveaway_ai"
  };

  if (subTabs[customId]) {
    await interaction.deferUpdate();
    return renderPanel(interaction, subTabs[customId]);
  }

  // MODERATION ACTIONS (Mutes, Bans, Modals)
  if (customId === "panel_mod_bulk_delete") {
    const modal = new ModalBuilder().setCustomId("panel_modal_bulk_delete").setTitle("🗑️ Toplu Mesaj Sil");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("miktar").setLabel("Silinecek Mesaj Sayısı (1-100)").setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_mod_mute") {
    const modal = new ModalBuilder().setCustomId("panel_modal_mute").setTitle("🔇 Kullanıcı Sustur (Timeout)");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Kullanıcı ID veya Etiketi").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sure").setLabel("Süre (Örn: 10m, 1h, 1d)").setValue("10m").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sebep").setLabel("Susturma Sebebi").setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_mod_unmute") {
    const modal = new ModalBuilder().setCustomId("panel_modal_unmute").setTitle("🔊 Susturma Kaldır");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Kullanıcı ID veya Etiketi").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_mod_modaction") {
    const modal = new ModalBuilder().setCustomId("panel_modal_modaction").setTitle("🚷 Ceza İşlem (Modİşlem)");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Ceza Verilecek Kullanıcı (ID/Etiket)").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sebep").setLabel("İhlal Kodu (Örn: KUFUR, SPAM, REKLAM)").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kanit").setLabel("Kanıt Ekran Görüntüsü Linki (Opsiyonel)").setStyle(TextInputStyle.Short).setRequired(false))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_mod_tamban") {
    const modal = new ModalBuilder().setCustomId("panel_modal_tamban").setTitle("🔨 Tam Ban (Global)");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici_id").setLabel("Kullanıcı Discord ID veya Etiketi").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("seviye").setLabel("Ban Seviyesi (very_high, high, medium, low)").setValue("high").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sebep").setLabel("Gerekçe").setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_mod_tamban_kaldir") {
    const modal = new ModalBuilder().setCustomId("panel_modal_tamban_kaldir").setTitle("🔓 Tam Ban Kaldır");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici_id").setLabel("Kullanıcı Discord ID veya Etiketi").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sebep").setLabel("Kaldırma Gerekçesi").setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  // BLACKLIST MODAL OPEN BUTTON (Triggered based on current selected blacklistOption)
  if (customId.startsWith("panel_blacklist_btn_openform:")) {
    const option = customId.split(":")[1];
    
    if (option === "1") { // Add Person
      const modal = new ModalBuilder().setCustomId("panel_modal_bl_add_person").setTitle("👤 Karalisteye Kişi Ekle");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Kullanıcı Adı veya Discord ID'si / Etiket").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Engelleme Gerekçesi").setStyle(TextInputStyle.Paragraph).setRequired(true))
      );
      return interaction.showModal(modal);
    }
    
    if (option === "2") { // Add Group
      const modal = new ModalBuilder().setCustomId("panel_modal_bl_add_group").setTitle("🛡️ Karalisteye Grup Ekle");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Grup veya Platform İsmi").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Engelleme Gerekçesi").setStyle(TextInputStyle.Paragraph).setRequired(true))
      );
      return interaction.showModal(modal);
    }

    if (option === "3") { // Sorun Çözüldü Kaldır
      const modal = new ModalBuilder().setCustomId("panel_modal_bl_remove_standard").setTitle("📤 Karalisteden Kaldır");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Kaldırılacak Kişi / Grup İsmi").setStyle(TextInputStyle.Short).setRequired(true))
      );
      return interaction.showModal(modal);
    }

    if (option === "4") { // Tamamen Sil
      const modal = new ModalBuilder().setCustomId("panel_modal_bl_remove_complete").setTitle("🗑️ Karalisteden Tamamen Sil");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Silinecek Kişi / Grup İsmi").setStyle(TextInputStyle.Short).setRequired(true))
      );
      return interaction.showModal(modal);
    }

    if (option === "5") { // Yeniden Aç
      const modal = new ModalBuilder().setCustomId("panel_modal_bl_reopen").setTitle("🔄 Karalisteyi Yeniden Aç");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Yeniden Açılacak Kişi / Grup İsmi").setStyle(TextInputStyle.Short).setRequired(true))
      );
      return interaction.showModal(modal);
    }
  }

  // STAFF MANAGEMENT ACTIONS
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
    const modal = new ModalBuilder().setCustomId("panel_modal_staff_setstats").setTitle("⚙️ Personel İstatistik Güncelle");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Personel Discord ID'si / Etiketi").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("parametre").setLabel("Seçenek (tickets/messages/voice/level/warnings)").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("deger").setLabel("Yeni Sayısal Değer").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_staff_fire") {
    const modal = new ModalBuilder().setCustomId("panel_modal_staff_fire").setTitle("🚪 Personel Kov & Sil");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Kovulacak Personel ID/Etiket").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sebep").setLabel("Kovulma Sebebi").setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_staff_promote_demote") {
    const modal = new ModalBuilder().setCustomId("panel_modal_staff_promote_demote").setTitle("🎖️ Terfi veya Tenzilat");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Personel Discord ID/Etiket").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("islem").setLabel("İşlem Tipi (terfi veya tenzilat)").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sebep").setLabel("Gerekçe / Açıklama").setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_staff_reward") {
    const modal = new ModalBuilder().setCustomId("panel_modal_staff_reward").setTitle("🎁 Ödül Ver veya Al");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Personel Discord ID/Etiket").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("islem").setLabel("İşlem Tipi (ver veya al)").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("odul").setLabel("Ödül İsmi veya Açıklaması").setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_staff_giveleave") {
    const modal = new ModalBuilder().setCustomId("panel_modal_staff_giveleave").setTitle("🏖️ İzin Günü Tanımla");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("İzin Verilecek Personel Discord ID/Etiket").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("tarih").setLabel("İzin Tarihi (YYYY-MM-DD)").setPlaceholder("Örn: 2026-07-15").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("sebep").setLabel("Gerekçe").setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  // ATTENDANCE ACTIONS
  if (customId === "panel_staff_attendance_start") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { handleAttendanceStart } = require("./staffSystem");
      const success = await handleAttendanceStart(client);
      return interaction.editReply(success ? "🟢 Yeni personel sayımı (yoklama) başarıyla başlatıldı!" : "❌ Aktif bir sayım zaten bulunuyor.");
    } catch (e) {
      return interaction.editReply(`❌ Yoklama başlatılamadı: ${e.message}`);
    }
  }

  if (customId === "panel_staff_attendance_stop") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { handleAttendanceStop } = require("./staffSystem");
      const resultsEmbed = await handleAttendanceStop(client);
      if (resultsEmbed) {
        return interaction.editReply({ content: "🔴 Yoklama başarıyla bitirildi.", embeds: [resultsEmbed] });
      } else {
        return interaction.editReply("❌ Sonlandırılacak aktif bir sayım bulunamadı.");
      }
    } catch (e) {
      return interaction.editReply(`❌ Yoklama bitirilemedi: ${e.message}`);
    }
  }

  // SYSTEM TOGGLES
  if (customId.startsWith("panel_sys_toggle_")) {
    const toggleName = customId.replace("panel_sys_toggle_", "");
    await interaction.deferReply({ ephemeral: true });
    try {
      // Direct server configuration update
      const ServerConfig = require("../../models/ServerConfig");
      const { TARGET_GUILD_ID } = require("../../config");
      let cfg = await ServerConfig.findOne({ guildId: TARGET_GUILD_ID }) || new ServerConfig({ guildId: TARGET_GUILD_ID });
      
      let key = "";
      if (toggleName === "economy") key = "economyEnabled";
      if (toggleName === "moderation") key = "moderationEnabled";
      if (toggleName === "fun") key = "funEnabled";

      if (key) {
        cfg[key] = !cfg[key];
        await cfg.save();
        return interaction.editReply(`✅ **${toggleName.toUpperCase()}** sistemi durumu güncellendi: **${cfg[key] ? "AKTİF" : "DEVRE DIŞI"}**`);
      }
      return interaction.editReply("❌ Geçersiz sistem modülü.");
    } catch (e) {
      return interaction.editReply(`❌ Sistem toggle işlemi başarısız: ${e.message}`);
    }
  }

  // CHANNEL PERMS MODAL
  if (customId === "panel_sys_channel_perms") {
    const modal = new ModalBuilder().setCustomId("panel_modal_sys_channel_perms").setTitle("🔒 Kanal İzinlerini Yönet");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kanal").setLabel("Kanal ID").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("islem").setLabel("İşlem Tipi (izin_ekle veya izin_kaldir)").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("izin").setLabel("İzin Tipi (commands/economy/fun)").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  // OTOMOD CONFIG
  if (customId === "panel_sys_otomod") {
    const modal = new ModalBuilder().setCustomId("panel_modal_sys_otomod").setTitle("🛡️ Discord Otomod Yönetimi");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("islem").setLabel("İşlem (ayarla veya kapat)").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  // DUYURULAR & BIRIMLER
  if (customId === "panel_sys_birimalimi") {
    const modal = new ModalBuilder().setCustomId("panel_modal_sys_birimalimi").setTitle("📢 Branş Birim Alımı Başlat");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("birim").setLabel("Birim (BAN_BIRIMI / SES_BIRIMI)").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_sys_birimtanitim") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { sendBirimTanitim } = require("../handlers/generalCommandHandler"); // Or fallback direct execution
      // Fallback post message
      const targetChan = interaction.channel;
      const embed = new EmbedBuilder()
        .setTitle("🛡️ EkoYıldız Birim Tanıtımları")
        .setDescription(
          "🤖 **BAN BİRİMİ:** Sunucu yasakları, karaliste kontrolleri ve güvenlik.\n" +
          "🎤 **SES BİRİMİ:** Sesli kanallardaki düzen, yardım ve denetim.\n" +
          "💬 **SOHBET BİRİMİ:** Metin kanallarının aktifliği ve sohbet kuralları."
        )
        .setColor(0x3498DB)
        .setTimestamp();
      await targetChan.send({ embeds: [embed] });
      return interaction.editReply("✅ Birim tanıtım mesajları kanala gönderildi.");
    } catch (e) {
      return interaction.editReply(`❌ Birim tanıtımı gönderilemedi: ${e.message}`);
    }
  }

  // ROBLOX ACTIONS (Bang, GrupCekEko)
  if (customId === "panel_sys_ekobang") {
    const modal = new ModalBuilder().setCustomId("panel_modal_sys_ekobang").setTitle("🔒 EkoBang Yetki Al");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Kullanıcı Discord ID veya Etiketi").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_sys_ekobangerial") {
    const modal = new ModalBuilder().setCustomId("panel_modal_sys_ekobangerial").setTitle("🔓 EkoBang Geri Yükle");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Kullanıcı Discord ID veya Etiketi").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_sys_grupcekeko") {
    const modal = new ModalBuilder().setCustomId("panel_modal_sys_grupcekeko").setTitle("⬇️ GrupÇekEko Rütbe İndir");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("username").setLabel("Roblox Kullanıcı Adı").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_sys_grupcekekogerial") {
    const modal = new ModalBuilder().setCustomId("panel_modal_sys_grupcekekogerial").setTitle("⬆️ GrupÇekEko Rütbe İade");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("username").setLabel("Roblox Kullanıcı Adı").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  // AI & GIVEAWAY ACTIONS
  if (customId === "panel_sys_xpcekilis") {
    const modal = new ModalBuilder().setCustomId("panel_modal_sys_xpcekilis").setTitle("🎉 Rütbe XP Çekilişi");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("xp_miktari").setLabel("Dağıtılacak Toplam XP Miktarı").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kazanan_sayisi").setLabel("Kazanan Kişi Sayısı").setValue("1").setStyle(TextInputStyle.Short).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_sys_konus") {
    const modal = new ModalBuilder().setCustomId("panel_modal_sys_konus").setTitle("💬 AI Destekli DM Uyarısı");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("kullanici").setLabel("Konuşulacak Kişi ID/Etiket").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("konu").setLabel("Görüşülecek Konu / İhlal").setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    return interaction.showModal(modal);
  }

  if (customId === "panel_sys_abusetest") {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
      const embed = new EmbedBuilder()
        .setTitle("🚨 Olası Abuse Tespit Edildi")
        .setDescription("Aşağıdaki kullanıcı sunucuda şüpheli hareketler sergilemektedir (Mock Test).")
        .setColor(0xFF0000)
        .addFields({ name: "Kullanıcı", value: `Simüle Edilen Üye` })
        .setTimestamp();
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("abuse_roles_take:test").setLabel("Rolleri Al").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("abuse_kick:test").setLabel("Sunucudan At").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("abuse_ban:test").setLabel("Yasaka / Ban").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("abuse_ignore:test").setLabel("Yoksay").setStyle(ButtonStyle.Secondary)
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.editReply("✅ Abuse test embedi başarıyla bu kanala gönderildi.");
    } catch (e) {
      return interaction.editReply(`❌ Abuse test embedi gönderilemedi: ${e.message}`);
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
}

/**
 * Processes inputs from modal submissions
 */
async function handlePanelModal(interaction) {
  const customId = interaction.customId;
  const client = interaction.client;
  const logChannel = await client.channels.fetch(BLACKLIST_LOG_CHANNEL_ID).catch(() => null);

  await interaction.deferReply({ ephemeral: true });

  // 1. BLACKLIST: Add Person
  if (customId === "panel_modal_bl_add_person") {
    const name = interaction.fields.getTextInputValue("name").trim();
    const reason = interaction.fields.getTextInputValue("reason").trim();

    try {
      let entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
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
          content: `📥 **[KARALİSTE EKLEME]** <@${interaction.user.id}> tarafından **${name}** listeye eklendi.\n📋 **Sebep:** ${reason}\n📂 **Tür:** Kişi (${isNew ? 'Yeni Kayıt' : 'Güncellendi'})`
        });
      }
      return interaction.editReply(`✅ **${name}** başarıyla karalisteye kişi olarak eklendi!`);
    } catch (e) {
      return interaction.editReply(`❌ Karalisteye eklenirken hata: ${e.message}`);
    }
  }

  // 2. BLACKLIST: Add Group
  if (customId === "panel_modal_bl_add_group") {
    const rawName = interaction.fields.getTextInputValue("name").trim();
    const name = rawName.endsWith(" grubu") ? rawName : rawName + " grubu";
    const reason = interaction.fields.getTextInputValue("reason").trim();

    try {
      let entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
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
          content: `📥 **[KARALİSTE EKLEME (GRUP)]** <@${interaction.user.id}> tarafından **${name}** listeye eklendi.\n📋 **Sebep:** ${reason}\n📂 **Tür:** 🛡️ Grup (${isNew ? 'Yeni Kayıt' : 'Güncellendi'})`
        });
      }
      return interaction.editReply(`✅ **${name}** başarıyla karalisteye grup olarak eklendi!`);
    } catch (e) {
      return interaction.editReply(`❌ Karalisteye eklenirken hata: ${e.message}`);
    }
  }

  // 3. BLACKLIST: Sorun Çözüldü Kaldır (Standard Removal)
  if (customId === "panel_modal_bl_remove_standard") {
    const name = interaction.fields.getTextInputValue("name").trim();

    try {
      const entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
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

  // 4. BLACKLIST: Tamamen Sil (Complete Removal)
  if (customId === "panel_modal_bl_remove_complete") {
    const name = interaction.fields.getTextInputValue("name").trim();

    try {
      const entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
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

  // 5. BLACKLIST: Yeniden Aç
  if (customId === "panel_modal_bl_reopen") {
    const name = interaction.fields.getTextInputValue("name").trim();

    try {
      const entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
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

  // TOPLU MESAJ SİL
  if (customId === "panel_modal_bulk_delete") {
    const miktar = parseInt(interaction.fields.getTextInputValue("miktar").trim());
    if (isNaN(miktar) || miktar < 1 || miktar > 100) {
      return interaction.editReply("❌ Lütfen 1 ile 100 arasında geçerli bir sayı girin.");
    }

    try {
      await interaction.channel.bulkDelete(miktar);
      return interaction.editReply(`✅ **${miktar}** mesaj başarıyla silindi.`);
    } catch (e) {
      return interaction.editReply(`❌ Mesajlar silinemedi: ${e.message}`);
    }
  }

  // SUSTUR (MUTE)
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
      return interaction.editReply(`✅ **${member.user.tag}** kullanıcısı **${durationVal}** süreyle susturuldu.\nSebep: ${reason}`);
    } catch (e) {
      return interaction.editReply(`❌ Susturma işlemi başarısız: ${e.message}`);
    }
  }

  // SUSTURMA AÇ
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

  // CEZA İŞLEM (MODİŞLEM)
  if (customId === "panel_modal_modaction") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();
    const attachmentUrl = interaction.fields.getTextInputValue("kanit") || null;

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Kullanıcı bulunamadı.");

    try {
      // Emulate attachment structure
      const fakeAttachment = attachmentUrl ? { url: attachmentUrl } : null;
      const { executeModAction } = require("./modActionService");
      // Set options in interaction so executeModAction can parse
      interaction.options = {
        getUser: () => targetUser,
        getString: () => reason,
        getAttachment: () => fakeAttachment
      };
      await executeModAction(interaction, targetUser, reason, fakeAttachment);
      return; // Already replied in executeModAction
    } catch (e) {
      return interaction.editReply(`❌ Ceza işlemi başarısız: ${e.message}`);
    }
  }

  // TAM BAN
  if (customId === "panel_modal_tamban") {
    const userVal = interaction.fields.getTextInputValue("kullanici_id").trim();
    const level = interaction.fields.getTextInputValue("seviye").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    try {
      // Emulate options in interaction
      interaction.options = {
        getString: (name) => {
          if (name === "kullanici_id") return targetUserId;
          if (name === "seviye") return level;
          if (name === "sebep") return reason;
          return null;
        }
      };
      const { handleModerationCommand } = require("../handlers/moderationCommandHandler");
      // Temporarily mock commandName
      interaction.commandName = "tamban";
      await handleModerationCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Tam Ban işlemi başarısız: ${e.message}`);
    }
  }

  // TAM BAN KALDIR
  if (customId === "panel_modal_tamban_kaldir") {
    const userVal = interaction.fields.getTextInputValue("kullanici_id").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    try {
      interaction.options = {
        getString: (name) => {
          if (name === "kullanici_id") return targetUserId;
          if (name === "sebep") return reason;
          return null;
        }
      };
      const { handleModerationCommand } = require("../handlers/moderationCommandHandler");
      interaction.commandName = "tamban_kaldir";
      await handleModerationCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Tam Ban kaldırılamadı: ${e.message}`);
    }
  }

  // STAFF STATS EDIT
  if (customId === "panel_modal_staff_setstats") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const param = interaction.fields.getTextInputValue("parametre").trim();
    const valStr = interaction.fields.getTextInputValue("deger").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Belirtilen personel bulunamadı.");

    try {
      interaction.options = {
        getUser: () => targetUser,
        getString: () => param,
        getInteger: () => parseInt(valStr) || 0
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = "personelayarla";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ İstatistik güncellenemedi: ${e.message}`);
    }
  }

  // STAFF FIRE
  if (customId === "panel_modal_staff_fire") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Personel bulunamadı.");

    try {
      interaction.options = {
        getUser: () => targetUser,
        getString: () => reason
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = "personelkov";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Personel silinemedi: ${e.message}`);
    }
  }

  // STAFF PROMOTE / DEMOTE
  if (customId === "panel_modal_staff_promote_demote") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const operation = interaction.fields.getTextInputValue("islem").trim().toLowerCase();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Personel bulunamadı.");

    try {
      if (operation === "terfi") {
        interaction.options = { getUser: () => targetUser };
        const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
        interaction.commandName = "birimterfi";
        await handleGeneralCommand(interaction);
      } else {
        interaction.options = { getUser: () => targetUser, getString: () => reason };
        const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
        interaction.commandName = "tenzilat";
        await handleGeneralCommand(interaction);
      }
      return;
    } catch (e) {
      return interaction.editReply(`❌ Rütbe işlemi başarısız: ${e.message}`);
    }
  }

  // STAFF REWARDS
  if (customId === "panel_modal_staff_reward") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const operation = interaction.fields.getTextInputValue("islem").trim().toLowerCase();
    const rewardName = interaction.fields.getTextInputValue("odul").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Personel bulunamadı.");

    try {
      interaction.options = {
        getUser: () => targetUser,
        getString: (name) => {
          if (name === "islem") return operation;
          if (name === "odul") return rewardName;
          return null;
        }
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = "odulver";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Ödül işlemi başarısız: ${e.message}`);
    }
  }

  // STAFF GIVE LEAVE
  if (customId === "panel_modal_staff_giveleave") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const dateVal = interaction.fields.getTextInputValue("tarih").trim();
    const reason = interaction.fields.getTextInputValue("sebep").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Personel bulunamadı.");

    try {
      interaction.options = {
        getUser: () => targetUser,
        getString: (name) => {
          if (name === "tarih") return dateVal;
          if (name === "sebep") return reason;
          return null;
        }
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = "izin_ver";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ İzin tanımlanamadı: ${e.message}`);
    }
  }

  // CHANNEL PERMS UPDATE
  if (customId === "panel_modal_sys_channel_perms") {
    const channelId = interaction.fields.getTextInputValue("kanal").trim();
    const operation = interaction.fields.getTextInputValue("islem").trim();
    const permType = interaction.fields.getTextInputValue("izin").trim();

    const channelObj = await client.channels.fetch(channelId).catch(() => null);
    if (!channelObj) return interaction.editReply("❌ Belirtilen kanal bulunamadı.");

    try {
      interaction.options = {
        getSubcommand: () => operation,
        getChannel: () => channelObj,
        getString: () => permType
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = "kanal";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Kanal izinleri güncellenemedi: ${e.message}`);
    }
  }

  // OTOMOD CONFIG
  if (customId === "panel_modal_sys_otomod") {
    const operation = interaction.fields.getTextInputValue("islem").trim();

    try {
      interaction.options = {
        getSubcommand: () => operation
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = "otomod";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Otomod güncellenemedi: ${e.message}`);
    }
  }

  // BRANŞ BIRIM ALIMI
  if (customId === "panel_modal_sys_birimalimi") {
    const unitName = interaction.fields.getTextInputValue("birim").trim();

    try {
      interaction.options = {
        getString: () => unitName
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = "birimalimi";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Birim alımı başlatılamadı: ${e.message}`);
    }
  }

  // ROBLOX EKOBANG
  if (customId === "panel_modal_sys_ekobang" || customId === "panel_modal_sys_ekobangerial") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Kullanıcı bulunamadı.");

    try {
      interaction.options = {
        getUser: () => targetUser
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = customId === "panel_modal_sys_ekobang" ? "ekobang" : "ekobangerial";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Roblox EkoBang işlemi başarısız: ${e.message}`);
    }
  }

  // ROBLOX GRUP CEK EKO
  if (customId === "panel_modal_sys_grupcekeko" || customId === "panel_modal_sys_grupcekekogerial") {
    const username = interaction.fields.getTextInputValue("username").trim();

    try {
      interaction.options = {
        getString: () => username
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = customId === "panel_modal_sys_grupcekeko" ? "grupcekeko" : "grupcekekogerial";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Roblox GrupÇekEko işlemi başarısız: ${e.message}`);
    }
  }

  // XP ÇEKİLİŞİ
  if (customId === "panel_modal_sys_xpcekilis") {
    const xp = interaction.fields.getTextInputValue("xp_miktari").trim();
    const winners = interaction.fields.getTextInputValue("kazanan_sayisi").trim();

    try {
      interaction.options = {
        getInteger: (name) => {
          if (name === "xp_miktari") return parseInt(xp) || 0;
          if (name === "kazanan_sayisi") return parseInt(winners) || 1;
          return null;
        }
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = "xpcekilis";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ Çekiliş başlatılamadı: ${e.message}`);
    }
  }

  // AI DM TALK
  if (customId === "panel_modal_sys_konus") {
    const userVal = interaction.fields.getTextInputValue("kullanici").trim();
    const subject = interaction.fields.getTextInputValue("konu").trim();

    const targetUserId = userVal.replace(/[<@!>]/g, "");
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return interaction.editReply("❌ Kullanıcı bulunamadı.");

    try {
      interaction.options = {
        getUser: () => targetUser,
        getString: () => subject
      };
      const { handleGeneralCommand } = require("../handlers/generalCommandHandler");
      interaction.commandName = "konus";
      await handleGeneralCommand(interaction);
      return;
    } catch (e) {
      return interaction.editReply(`❌ AI DM Konuşması başlatılamadı: ${e.message}`);
    }
  }

  return interaction.editReply("❌ Bilinmeyen modal işlemi.");
}

/**
 * Utility helper to parse duration string (e.g. 10m, 1h, 1d) into ms
 */
function parseDuration(timeStr) {
  const matches = timeStr.match(/(\d+)([smhd])/);
  if (!matches) return 10 * 60 * 1000;

  const value = parseInt(matches[1]);
  const unit = matches[2];

  const unitMap = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (unitMap[unit] || 1000);
}

module.exports = {
  renderPanel,
  handlePanelButton,
  handlePanelSelect,
  handlePanelModal
};
