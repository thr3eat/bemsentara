const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const generalCommands = [
  
  new SlashCommandBuilder()
    .setName("kurallar-kabul")
    .setDescription("📋 Bot kurallarını oku ve kabul et")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("aktif-kullanicilar")
    .setDescription("🟢 Son 24 saatte aktif olan kullanıcıları göster")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("inaktif-kullanicilar")
    .setDescription("🔴 24 saatin üzerinde inaktif olan kullanıcıları göster")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("aktivite-gecmisi")
    .setDescription("📊 Bir kullanıcının aktivite geçmişini görüntüle")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Bakılacak kişi (boş = kendin)").setRequired(false)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("dogrula")
    .setDescription("🔐 Sentara botunu kullanmak için Discord hesabınızı doğrulayın")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("hata-sihirbazi")
    .setDescription("🧙 AI destekli hata raporlama sihirbazını aç"),

  new SlashCommandBuilder()
    .setName("support")
    .setDescription("Destek menüsünü aç"),

  new SlashCommandBuilder()
    .setName("mytickets")
    .setDescription("Açık ticket'larını göster")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("closeticket")
    .setDescription("Ticket'ı kapat")
    .addStringOption((o) =>
      o.setName("reason").setDescription("Kapanış sebebi").setRequired(false)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Profil bilgilerini göster")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("authorize")
    .setDescription("Roblox hesabını yetkilendir")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("robloxgrup")
    .setDescription("Verilen Roblox grup ID'sine göre grup bilgilerini ve ranklarını listeler")
    .addNumberOption((o) =>
      o.setName("grupid").setDescription("Roblox Grup ID").setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("robloxuser")
    .setDescription("Roblox kullanıcısı bilgilerini gösterir")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox Kullanıcı Adı").setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("incele")
    .setDescription("Bir Discord kullanıcısının Discord ve Roblox bilgilerini inceler")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("İncelenecek Discord kullanıcısı").setRequired(true)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("abonelik")
    .setDescription("Abonelik durumunu ve premium özelliklerini yönet")
    .addSubcommand((sub) =>
      sub.setName("durum").setDescription("Abonelik durumunuzu göster")
    )
    .addSubcommand((sub) =>
      sub.setName("ozellikleri").setDescription("Premium özelliklerini göster")
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("yardim")
    .setDescription("Komutları ve kategorileri görüntüle")
    .addStringOption((o) =>
      o
        .setName("kategori")
        .setDescription("Komut kategoriisi")
        .setRequired(false)
        .addChoices(
          { name: "Genel Komutlar", value: "general" },
          { name: "Ekonomi", value: "economy" },
          { name: "Eğlence", value: "fun" }
        )
    ),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Botun gecikmesini ölç"),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Bot istatistiklerini ve sistem durumunu göster"),

  new SlashCommandBuilder()
    .setName("koc")
    .setDescription("AI koçunla DM üzerinden konuş.")
    .addStringOption(o =>
      o.setName("islem")
        .setDescription("sıfırla = oturumu yenile")
        .addChoices({ name: 'sıfırla', value: 'sıfırla' })
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("seviye")
    .setDescription("Kurbağa seviyeni ve XP durumunu göster")
    .addUserOption(o =>
      o.setName("kullanici").setDescription("Bakılacak kişi (boş = kendin)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("seviyetop")
    .setDescription("Kurbağa ve Dinazor seviye sisteminde en yüksek sıralamaya sahip ilk 10 üyeyi gösterir"),

  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Roblox hesabınıza göre Discord rollerinizi senkronize eder")
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("ekocoin")
    .setDescription("EkoCoin (E.C.) sistemini yönetin")
    .addSubcommand(sub =>
      sub.setName("bakiye").setDescription("Mevcut EkoCoin bakiyenizi görün")
    )
    .addSubcommand(sub =>
      sub.setName("gonder")
        .setDescription("Başka bir personele EkoCoin gönderin")
        .addUserOption(o => o.setName("kullanici").setDescription("Gönderilecek kişi").setRequired(true))
        .addIntegerOption(o => o.setName("miktar").setDescription("Gönderilecek E.C. miktarı").setRequired(true))
    ),

  new SlashCommandBuilder()
    .setName("magaza")
    .setDescription("EkoCoin Mağazasını açın ve eşya satın alın"),

  new SlashCommandBuilder()
    .setName("gunluk-odul")
    .setDescription("Günlük EkoCoin ödülünüzü (maaşınızı) alın"),

  new SlashCommandBuilder()
    .setName("zenginler")
    .setDescription("Sunucudaki en zengin EkoCoin sahiplerini görün"),

  new SlashCommandBuilder()
    .setName("update")
    .setDescription("Ana gruba (EkoYıldız'a bağlı) ve branş gruplarına göre rollerinizi günceller")
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("🏆 Top 10 personeli göster - XP, Puan, Rozetler!"),

  new SlashCommandBuilder()
    .setName("personeldurum")
    .setDescription("👤 Personelin staff bilgilerini göster - Level, XP, Rozet, Başarımlar")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Bakılacak kişi (boş = kendin)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("profil")
    .setDescription("🎮 Senin gamification profilini göster - XP, Rozetler, Streak")
    .addUserOption(o =>
      o.setName("kullanici").setDescription("Bakılacak kişi (boş = kendin)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("challenge")
    .setDescription("🎯 Bu hafta challenge'ını göster!"),

  new SlashCommandBuilder()
    .setName("izin_iste")
    .setDescription("Kişisel izin kotandan izin günü talep et")
    .addStringOption((o) =>
      o.setName("tarih").setDescription("İzin tarihi (YYYY-MM-DD formatında, örn: 2026-06-20)").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("sebep").setDescription("İzin talep sebebi").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("izin_kullan")
    .setDescription("Birikmiş izin kredini kullanarak bugünlük görevlerini pas geç (skip et)"),

  new SlashCommandBuilder()
    .setName("izin_durum")
    .setDescription("Mevcut izin kotanı ve birikmiş izin kredilerini görüntüle"),

  new SlashCommandBuilder()
    .setName("birimistifa")
    .setDescription("Bulunduğunuz birimden istifa edersiniz"),

  new SlashCommandBuilder()
    .setName("renk")
    .setDescription("İsim renginizi özelleştirin (Server Booster'lar veya Level 10+)")
    .addStringOption((o) =>
      o.setName("hex").setDescription("HEX renk kodu (Örn: #ff0000)").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("profilrenk")
    .setDescription("Seviye kartınızın rengini özelleştirin (Level 3+)")
    .addStringOption((o) =>
      o.setName("hex").setDescription("HEX renk kodu (Örn: #ff0000)").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("biyografi")
    .setDescription("Seviye kartınıza özel biyografi/hakkımda yazısı ekleyin (Level 6+)")
    .addStringOption((o) =>
      o.setName("metin").setDescription("Yeni biyografi metniniz").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("oda-olustur")
    .setDescription("Geçici özel ses kanalı oluşturun (Level 12+)")
    .addStringOption((o) =>
      o.setName("oda_adi").setDescription("Oda ismi (Opsiyonel)").setRequired(false)
    )
    .addIntegerOption((o) =>
      o.setName("kisi_limiti").setDescription("Oda kişi limiti (Opsiyonel)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("ozelrolisim")
    .setDescription("Özel renk rolünüzün ismini değiştirin (Level 15+)")
    .addStringOption((o) =>
      o.setName("isim").setDescription("Yeni rol ismi").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("EkoYıldız Yetkili ve Moderasyon Kontrol Paneli")
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("mod-alim")
    .setDescription("🛡️ MOD-ALIM: Kullanıcıya Moderatör Mülakatı Gönder (Sadece Yöneticiler)")
    .addUserOption((o) =>
      o.setName("kullanici")
        .setDescription("Mülakat gönderilecek kullanıcı")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("personel-dogrula")
    .setDescription("Roblox hesabınızı doğrulamak için kullanılır.")
    .setDMPermission(true),

  // ── MODERASYON KOMUTLARI ──────────────────────────────────────────────────

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("🔇 Kullanıcı Sustur (Timeout)")
    .addUserOption(o => o.setName("kullanici").setDescription("Susturulacak kişi").setRequired(true))
    .addStringOption(o => o.setName("sure").setDescription("Süre (10m, 1h, 1d vb)").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Susturma sebebi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("🔊 Susturma Kaldır")
    .addUserOption(o => o.setName("kullanici").setDescription("Susturma kaldırılacak kişi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("modaction")
    .setDescription("🚷 Ceza İşlem (Modİşlem)")
    .addUserOption(o => o.setName("kullanici").setDescription("Ceza verilecek kişi").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("İhlal kodu (KUFUR, SPAM, REKLAM vb)").setRequired(true))
    .addStringOption(o => o.setName("kanit").setDescription("Kanıt linki (opsiyonel)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("bulk-delete")
    .setDescription("🗑️ Toplu Mesaj Sil")
    .addIntegerOption(o => o.setName("miktar").setDescription("Silinecek mesaj sayısı (1-100)").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("🔨 Tam Ban Uygula (Global)")
    .addUserOption(o => o.setName("kullanici").setDescription("Banlanacak kişi").setRequired(true))
    .addStringOption(o => o.setName("seviye").setDescription("Ban seviyesi").setRequired(true)
      .addChoices(
        { name: "Çok Yüksek", value: "very_high" },
        { name: "Yüksek", value: "high" },
        { name: "Orta", value: "medium" },
        { name: "Düşük", value: "low" }
      ))
    .addStringOption(o => o.setName("sebep").setDescription("Ban sebebi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("🔓 Ban Kaldır")
    .addUserOption(o => o.setName("kullanici").setDescription("Banı kaldırılacak kişi").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Kaldırma sebebi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("karaliste")
    .setDescription("🚫 Karaliste Yönetimi")
    .addSubcommand(s => s.setName("ekle-kisi").setDescription("Karalisteye kişi ekle")
      .addStringOption(o => o.setName("isim").setDescription("Kişi adı/ID").setRequired(true))
      .addStringOption(o => o.setName("sebep").setDescription("Engelleme sebebi").setRequired(true)))
    .addSubcommand(s => s.setName("ekle-grup").setDescription("Karalisteye grup ekle")
      .addStringOption(o => o.setName("grup").setDescription("Grup adı").setRequired(true))
      .addStringOption(o => o.setName("sebep").setDescription("Engelleme sebebi").setRequired(true)))
    .addSubcommand(s => s.setName("kaldir").setDescription("Karalisteden kaldır")
      .addStringOption(o => o.setName("isim").setDescription("Kaldırılacak isim").setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // ── PERSONEL KOMUTLARI ──────────────────────────────────────────────────

  new SlashCommandBuilder()
    .setName("staff-report")
    .setDescription("📊 Personel İlerleme Raporu")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("staff-setstats")
    .setDescription("⚙️ Personel İstatistik Ayarla")
    .addUserOption(o => o.setName("kullanici").setDescription("Kişi").setRequired(true))
    .addStringOption(o => o.setName("parametre").setDescription("tickets/messages/voice/level/warnings").setRequired(true))
    .addIntegerOption(o => o.setName("deger").setDescription("Yeni değer").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("fire")
    .setDescription("🚪 Personeli Kovuş")
    .addUserOption(o => o.setName("kullanici").setDescription("Kovulacak kişi").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Kovulma sebebi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("promote")
    .setDescription("🎖️ Personeli Terfi Et")
    .addUserOption(o => o.setName("kullanici").setDescription("Terfi edilecek kişi").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Terfi sebebi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("demote")
    .setDescription("📉 Personeli Tenzil Et")
    .addUserOption(o => o.setName("kullanici").setDescription("Tenzil edilecek kişi").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("Tenzil sebebi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("reward")
    .setDescription("🎁 Ödül Ver/Al")
    .addUserOption(o => o.setName("kullanici").setDescription("Kişi").setRequired(true))
    .addStringOption(o => o.setName("islem").setDescription("ver veya al").setRequired(true)
      .addChoices({ name: "Ödül Ver", value: "ver" }, { name: "Ödül Al", value: "al" }))
    .addStringOption(o => o.setName("odul").setDescription("Ödül açıklaması").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("staff-reward")
    .setDescription("🎁 Personele Ödül Ver/Al")
    .addUserOption(o => o.setName("kullanici").setDescription("Personel").setRequired(true))
    .addStringOption(o => o.setName("islem").setDescription("ver veya al").setRequired(true)
      .addChoices({ name: "Ödül Ver", value: "ver" }, { name: "Ödül Al", value: "al" }))
    .addStringOption(o => o.setName("odul").setDescription("Ödül açıklaması").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("staff-giveleave")
    .setDescription("🏖️ Personele İzin Günü Tanımla")
    .addUserOption(o => o.setName("kullanici").setDescription("Personel").setRequired(true))
    .addStringOption(o => o.setName("tarih").setDescription("İzin tarihi (YYYY-MM-DD)").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("İzin sebebi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("staff-attendance-start")
    .setDescription("🟢 Personel Sayımı (Yoklama) Başlat")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("staff-attendance-stop")
    .setDescription("🔴 Personel Sayımını Bitir")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("giveleave")
    .setDescription("🏖️ İzin Günü Tanımla")
    .addUserOption(o => o.setName("kullanici").setDescription("İzin verilecek kişi").setRequired(true))
    .addStringOption(o => o.setName("tarih").setDescription("İzin tarihi (YYYY-MM-DD)").setRequired(true))
    .addStringOption(o => o.setName("sebep").setDescription("İzin sebebi").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("attendance-start")
    .setDescription("🟢 Personel Sayımı (Yoklama) Başlat")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("attendance-stop")
    .setDescription("🔴 Personel Sayımını Bitir")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ── SİSTEM KOMUTLARI ────────────────────────────────────────────────────

  new SlashCommandBuilder()
    .setName("toggle")
    .setDescription("⚙️ Sistem Modüllerini Aç/Kapat")
    .addStringOption(o => o.setName("modul").setDescription("economy/moderation/fun").setRequired(true)
      .addChoices(
        { name: "Ekonomi Sistemi", value: "economy" },
        { name: "Moderasyon Sistemi", value: "moderation" },
        { name: "Eğlence Oyunları", value: "fun" }
      ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("system-toggle")
    .setDescription("⚙️ Sistem Modüllerini Aç/Kapat (Panel)")
    .addStringOption(o => o.setName("modul").setDescription("economy/moderation/fun").setRequired(true)
      .addChoices(
        { name: "Ekonomi Sistemi", value: "economy" },
        { name: "Moderasyon Sistemi", value: "moderation" },
        { name: "Eğlence Oyunları", value: "fun" }
      ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("channel-perms")
    .setDescription("🔒 Kanal İzinlerini Yönet")
    .addChannelOption(o => o.setName("kanal").setDescription("Hedef kanal").setRequired(true))
    .addStringOption(o => o.setName("islem").setDescription("izin_ekle / izin_kaldir").setRequired(true))
    .addStringOption(o => o.setName("izin").setDescription("commands/economy/fun").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("otomod")
    .setDescription("🛡️ Discord Otomod Yönetimi")
    .addStringOption(o => o.setName("islem").setDescription("ayarla / kapat").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("birim-alimi")
    .setDescription("📢 Birim Alımı Duyurusu Gönder")
    .addStringOption(o => o.setName("birim").setDescription("BAN_BIRIMI / SES_BIRIMI").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("birim-tanitim")
    .setDescription("📋 Birim Tanıtımını Gönder")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("xp-cekilis")
    .setDescription("🎉 XP Çekilişi Başlat")
    .addIntegerOption(o => o.setName("xp").setDescription("Dağıtılacak toplam XP").setRequired(true))
    .addIntegerOption(o => o.setName("kazanan").setDescription("Kazanan sayısı").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ai-konusma")
    .setDescription("💬 AI DM Konuşması Başlat")
    .addUserOption(o => o.setName("kullanici").setDescription("Konuşulacak kişi").setRequired(true))
    .addStringOption(o => o.setName("konu").setDescription("Konuşma konusu").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("abuse-test")
    .setDescription("🧪 Abuse Test Embedi Gönder")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("coach-welcome-reset")
    .setDescription("🔄 Koç Hoşgeldin Mesajı Sıfırla (Admin)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("coach-mesaj-ayarlari")
    .setDescription("⚙️ Birim Koçu Mesaj Bildirim Ayarları")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("ekobang")
    .setDescription("🔒 EkoBang Uygula (Rütbeleri Düşür)")
    .addUserOption(o => o.setName("kullanici").setDescription("Hedef kullanıcı").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("system-ekobang")
    .setDescription("🔒 EkoBang Uygula - Panel")
    .addUserOption(o => o.setName("kullanici").setDescription("Hedef kullanıcı").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ekobangerial")
    .setDescription("🔓 EkoBang İade (Rütbeleri Geri Al)")
    .addUserOption(o => o.setName("kullanici").setDescription("Hedef kullanıcı").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("system-ekobangerial")
    .setDescription("🔓 EkoBang İade - Panel")
    .addUserOption(o => o.setName("kullanici").setDescription("Hedef kullanıcı").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("grupcekeko")
    .setDescription("⬇️ GrupÇekEko (Rütbeleri En Alta Çek)")
    .addStringOption(o => o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("system-grupcekeko")
    .setDescription("⬇️ GrupÇekEko - Panel")
    .addStringOption(o => o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("grupcekekogerial")
    .setDescription("⬆️ GrupÇekEko Geri Al (Rütbeleri İade)")
    .addStringOption(o => o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("system-grupcekekogerial")
    .setDescription("⬆️ GrupÇekEko Geri Al - Panel")
    .addStringOption(o => o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("rowifi")
    .setDescription("🤖 Gelişmiş Roblox Rol & Rütbe Eşleme Sistemi (RoWifi)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup(g =>
      g.setName("rankbind")
        .setDescription("Roblox rütbelerine göre Discord rolleri atayın")
        .addSubcommand(s =>
          s.setName("add")
            .setDescription("Yeni bir rankbind (rütbe bağı) oluşturur")
            .addIntegerOption(o => o.setName("group_id").setDescription("Roblox Grup ID'si").setRequired(true))
            .addIntegerOption(o => o.setName("rank_id").setDescription("Grup Rütbe ID'si (0-255, 0=Konuk)").setRequired(true))
            .addRoleOption(o => o.setName("role").setDescription("Verilecek Discord Rolü").setRequired(true))
            .addStringOption(o => o.setName("template").setDescription("İsim şablonu (Örn: {roblox_username})").setRequired(false))
            .addIntegerOption(o => o.setName("priority").setDescription("Öncelik sırası").setRequired(false))
        )
        .addSubcommand(s =>
          s.setName("list")
            .setDescription("Mevcut rankbind listesini gösterir")
        )
        .addSubcommand(s =>
          s.setName("delete")
            .setDescription("Bir rankbind kaydını siler")
            .addStringOption(o => o.setName("id").setDescription("Silinecek bind ID'si").setRequired(true))
        )
    )
    .addSubcommandGroup(g =>
      g.setName("groupbind")
        .setDescription("Roblox grubunda bulunmaya göre Discord rolleri atayın")
        .addSubcommand(s =>
          s.setName("add")
            .setDescription("Yeni bir groupbind (grup varlığı bağı) oluşturur")
            .addIntegerOption(o => o.setName("group_id").setDescription("Roblox Grup ID'si").setRequired(true))
            .addRoleOption(o => o.setName("role").setDescription("Verilecek Discord Rolü").setRequired(true))
            .addStringOption(o => o.setName("template").setDescription("İsim şablonu (Örn: {roblox_username})").setRequired(false))
            .addIntegerOption(o => o.setName("priority").setDescription("Öncelik sırası").setRequired(false))
        )
        .addSubcommand(s =>
          s.setName("list")
            .setDescription("Mevcut groupbind listesini gösterir")
        )
        .addSubcommand(s =>
          s.setName("delete")
            .setDescription("Bir groupbind kaydını siler")
            .addStringOption(o => o.setName("id").setDescription("Silinecek bind ID'si").setRequired(true))
        )
    )
    .addSubcommand(s =>
      s.setName("autodetect")
        .setDescription("Otomatik senkronizasyon (Auto Detection) özelliğini açar/kapatır")
        .addBooleanOption(o => o.setName("aktif").setDescription("Aktif etmek için True, kapatmak için False seçin").setRequired(true))
    )
    .addSubcommand(s =>
      s.setName("sync")
        .setDescription("Sunucu üyelerini Roblox gruplarıyla anlık olarak senkronize eder")
    )
    .addSubcommand(s =>
      s.setName("status")
        .setDescription("RoWifi sistemi durumunu ve yapılandırmasını gösterir")
    ),

  new SlashCommandBuilder()
    .setName("bakim")
    .setDescription("⚙️ Sistem Otomatik Bakım Modunu Aç/Kapat")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const economyCommands = [
  new SlashCommandBuilder()
    .setName("ekonomi")
    .setDescription("Para, banka ve ayarları yönet")
    .addSubcommand((sub) => sub.setName("bakiye").setDescription("Bakiyenizi göster"))
    .addSubcommand((sub) => sub.setName("banka").setDescription("Banka bilgilerinizi göster"))
    .addSubcommand((sub) =>
      sub
        .setName("para_gonder")
        .setDescription("Başka bir kullanıcıya para gönder")
        .addUserOption((o) =>
          o.setName("kullanici").setDescription("Hedef Kullanıcı").setRequired(true)
        )
        .addNumberOption((o) =>
          o.setName("miktar").setDescription("Gönderilecek Miktar").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("gelir")
    .setDescription("Para kazan ve rol gelirlerini yönet")
    .addSubcommand((sub) => sub.setName("kazanc").setDescription("Günlük kazancınızı alın"))
    .addSubcommand((sub) =>
      sub.setName("rol_geliri").setDescription("Rol gelir ayarlarını göster")
    ),

  new SlashCommandBuilder()
    .setName("itemler")
    .setDescription("Ürünleri görüntüle ve yönet")
    .addSubcommand((sub) => sub.setName("listele").setDescription("Mağazadaki ürünleri listele"))
    .addSubcommand((sub) =>
      sub
        .setName("sat_al")
        .setDescription("Ürün satın al")
        .addStringOption((o) =>
          o.setName("urun").setDescription("Ürün adı").setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("envanterim").setDescription("Envanterimi göster")),
];

const funCommands = [
  new SlashCommandBuilder()
    .setName("boom_ayarlar")
    .setDescription("Boom oyunu ayarları")
    .addSubcommand((sub) =>
      sub.setName("oyna").setDescription("Boom oyununu başlat")
    )
    .addSubcommand((sub) =>
      sub.setName("kurallar").setDescription("Boom oyunu kurallarını göster")
    ),

  new SlashCommandBuilder()
    .setName("boom_oyunu")
    .setDescription("Boom oyunu komutları")
    .addSubcommand((sub) =>
      sub
        .setName("bahis")
        .setDescription("Boom oyununa bahis oyna")
        .addNumberOption((o) =>
          o.setName("miktar").setDescription("Bahis Miktarı").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("kelime_oyunu_ayarlar")
    .setDescription("Kelime oyunu ayarları. Dil, kanal bazlı Türkçe/İngilizce seçilir")
    .addSubcommand((sub) =>
      sub
        .setName("dil_sec")
        .setDescription("Oyun dilini seç")
        .addStringOption((o) =>
          o
            .setName("dil")
            .setDescription("Oyun Dili")
            .setRequired(true)
            .addChoices(
              { name: "Türkçe", value: "tr" },
              { name: "İngilizce", value: "en" }
            )
        )
    ),

  new SlashCommandBuilder()
    .setName("kelime_oyunu")
    .setDescription("Kelime oyunu komutları. Dil, kanal bazlı Türkçe/İngilizce seçilir")
    .addSubcommand((sub) =>
      sub.setName("oyna").setDescription("Kelime oyununu başlat")
    )
    .addSubcommand((sub) =>
      sub.setName("puan").setDescription("Kelime oyunu puanınızı göster")
    ),

  new SlashCommandBuilder()
    .setName("oyunlar")
    .setDescription("Kumar oyunları oyna")
    .addSubcommand((sub) =>
      sub
        .setName("zar_at")
        .setDescription("Zar atıp bahis oyna")
        .addNumberOption((o) =>
          o.setName("bahis").setDescription("Bahis Miktarı").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("yazı_tura")
        .setDescription("Yazı Tura oyna")
        .addNumberOption((o) =>
          o.setName("bahis").setDescription("Bahis Miktarı").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("sunucukurma")
    .setDescription("TMT sunucu kurulum asistanını başlatır")
    .addStringOption((o) =>
      o.setName("grup")
        .setDescription("Kurulacak TMT grubu")
        .setRequired(true)
        .addChoices(
          { name: "TMT Akademi", value: "35212138" },
          { name: "TMT Askeri İnzibat", value: "33709461" },
          { name: "TMT Birimler Bölükler", value: "35430592" },
          { name: "TMT Deniz Kuvvetleri Komutanlığı", value: "5415548" },
          { name: "TMT Genel Branş Komutanlığı", value: "35212127" },
          { name: "TMT Hava Kuvvetleri", value: "33709391" },
          { name: "TMT Hudut Müfettişleri", value: "35432150" },
          { name: "TMT Jandarma Genel Komutanlığı", value: "12008462" },
          { name: "TMT Kara Kuvvetleri Komutanlığı", value: "33714381" },
          { name: "TMT Ministry of Foreign Affairs", value: "35528574" },
          { name: "TMT Özel Kuvvetler Komutanlığı", value: "33708598" },
          { name: "TMT Turkish Armed Forces", value: "11517908" },
          { name: "TMT RAIDERS", value: "35528598" },
          { name: "TMT Sürücü Okulu", value: "35528556" }
        )
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("sunucurolsenkranizasyondüzenleme")
    .setDescription("Kurulmuş sunucunun rütbe/rol eşleşmelerini düzenler")
    .addNumberOption((o) =>
      o.setName("rutbe").setDescription("Roblox Rütbe ID (1-255)").setRequired(true)
    )
    .addRoleOption((o) =>
      o.setName("rol").setDescription("Eşleştirilecek Discord Rolü").setRequired(true)
    )
    .setDMPermission(false),
];

// ── PERSONEL KOMUTLARı ────────────────────────────────────────────────────────
const staffCommands = [
  new SlashCommandBuilder()
    .setName("personel-sohbet")
    .setDescription("🗨️ Başka bir personelle DM üzerinden sohbet et")
    .addUserOption((o) =>
      o.setName("personel").setDescription("Sohbet etmek istediğin personel").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("mesaj").setDescription("Gönderecek mesaj").setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("günlük-rapor")
    .setDescription("📋 Bugünkü görevlerini hakkında rapor gir (AI değerlendirir)")
    .addStringOption((o) =>
      o.setName("rapor").setDescription("Kısa rapor (ör: Bugün uyandım selam verdim, sesle 2 saat aktif oldum)").setRequired(true)
    )
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("briefing")
    .setDescription("Günlük, haftalık veya aylık brifinginizi görüntüleyin ve ödüllerinizi alın.")
    .addStringOption((o) =>
      o.setName("tip")
        .setDescription("Brifing tipi")
        .setRequired(true)
        .addChoices(
          { name: "Günlük Brifing", value: "gunluk" },
          { name: "Haftalık Brifing & Ödül", value: "haftalik" },
          { name: "Aylık Brifing & Ödül", value: "aylik" }
        )
    )
    .setDMPermission(true),
];

const allCommands = [
  ...generalCommands,
  ...economyCommands,
  ...funCommands,
  ...staffCommands,
].map((c) => c.toJSON());

module.exports = {
  allCommands,
  generalCommands,
  economyCommands,
  funCommands,
  staffCommands,
  moderationCommands: []
};