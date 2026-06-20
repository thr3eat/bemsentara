const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const generalCommands = [
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
    .setName("xpcekilis")
    .setDescription("[Yönetici] Rütbe XP'si için çekiliş başlatır (Ertesi gün öğlen 12:00'de açıklanır)")
    .addIntegerOption((o) =>
      o.setName("xp_miktari").setDescription("Dağıtılacak XP miktarı").setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName("kazanan_sayisi").setDescription("Kaç kişi kazanacak? (Varsayılan 1)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
    .setName("ayarlar")
    .setDescription("Botun özelliklerini sunucunuzda aktif etmenize yarar")
    .addSubcommand((sub) =>
      sub.setName("goruntule").setDescription("Sunucu ayarlarını görüntüle")
    )
    .addSubcommand((sub) =>
      sub
        .setName("guncelle")
        .setDescription("Ayarları güncelle")
        .addStringOption((o) =>
          o
            .setName("ayar")
            .setDescription("Güncellenecek ayar")
            .setRequired(true)
            .addChoices(
              { name: "Ekonomi Sistemi", value: "economy" },
              { name: "Moderasyon", value: "moderation" },
              { name: "Eğlence", value: "fun" }
            )
        )
        .addBooleanOption((o) =>
          o.setName("durum").setDescription("Etkin/Devre dışı").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("kanal")
    .setDescription("Belirtilen kanala veya kategoriye yetki ekler/kaldırır")
    .addSubcommand((sub) =>
      sub
        .setName("izin_ekle")
        .setDescription("Kanala izin ekle")
        .addChannelOption((o) =>
          o.setName("kanal").setDescription("Hedef Kanal").setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName("izin")
            .setDescription("İzin tipi")
            .setRequired(true)
            .addChoices(
              { name: "Bot Komutları", value: "commands" },
              { name: "Ekonomi", value: "economy" },
              { name: "Eğlence", value: "fun" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("izin_kaldir")
        .setDescription("Kanaldaki izni kaldır")
        .addChannelOption((o) =>
          o.setName("kanal").setDescription("Hedef Kanal").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("otomod")
    .setDescription("Sunucunuzda Discord'un otomod sistemini etkinleştirir")
    .addSubcommand((sub) =>
      sub.setName("ayarla").setDescription("Otomod ayarlarını yapılandır")
    )
    .addSubcommand((sub) =>
      sub.setName("kapat").setDescription("Otomodu kapat")
    ),

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
          { name: "Eğlence", value: "fun" },
          { name: "Moderasyon", value: "moderation" }
        )
    ),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Botun gecikmesini ölç"),

  new SlashCommandBuilder()
    .setName("anketai")
    .setDescription("AI destekli anket gönder")
    .addUserOption(o =>
      o.setName("kullanici").setDescription("Anket gönderilecek kişi").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("konu").setDescription("Anketin konusu").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Bot istatistiklerini ve sistem durumunu göster"),

  new SlashCommandBuilder()
    .setName("modbasvuru")
    .setDescription("[Yönetici] Kullanıcıya moderatör başvurusu sun")
    .addUserOption(o =>
      o.setName("kullanici").setDescription("Moderatör adayı").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("istifa")
    .setDescription("Personel görevinden istifa et")
    .addStringOption(o =>
      o.setName("sebep").setDescription("İstifa sebebin (opsiyonel)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("emeklilik")
    .setDescription("90+ aktif gün sonra emekli ol (kalıcı)"),

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
    .setName("personelkov")
    .setDescription("Bir personeli kovar ve sistemden siler")
    .addUserOption(o =>
      o.setName("kullanici").setDescription("Kovulacak personel").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("sebep").setDescription("Kovulma sebebi").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("personeldurum")
    .setDescription("Kendi personel durumunuzu ve istatistiklerinizi görüntüler"),

  new SlashCommandBuilder()
    .setName("sayim")
    .setDescription("Moderatör ekibi için aylık sayım (yoklama) sistemini yönetir")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("baslat").setDescription("Yeni bir personel sayımı (yoklaması) başlatır")
    )
    .addSubcommand(sub =>
      sub.setName("bitir").setDescription("Mevcut aktif sayımı sonlandırır ve sonuçları gösterir")
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
    .setName("debug-update")
    .setDescription("[Yönetici] Rol senkron,h debug — önizleme veya uygulama")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Test edilecek kullanıcı (boş = kendin)").setRequired(false)
    )
    .addBooleanOption((o) =>
      o.setName("uygula").setDescription("true = rolleri gerçekten uygula").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("🏆 Top 10 personeli göster - XP, Puan, Rozetler!"),

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
    .setName("ekobang")
    .setDescription("[Özel] Kullanıcının tüm sunuculardaki yetkili rollerini alır ve kaydeder")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Rolleri alınacak kullanıcı").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ekobangerial")
    .setDescription("[Özel] Kullanıcının kaydedilen rollerini geri yükler")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Rolleri iade edilecek kullanıcı").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("konus")
    .setDescription("[Yönetici] Belirtilen kullanıcı ile AI destekli DM konuşması başlatır")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Konuşulacak kullanıcı").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("konu").setDescription("Konuşulacak konu / sebep").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("personel-dogrula")
    .setDescription("Yetkili (Staff) Roblox hesabı doğrulama linki gönderir"),

  new SlashCommandBuilder()
    .setName("odulver")
    .setDescription("[Yönetici] Belirtilen personelin ödüllerini yönetir (Ver/Geri Al)")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("İşlem yapılacak personel/moderatör").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("islem")
        .setDescription("Ödül verilsin mi, geri mi alınsın?")
        .setRequired(true)
        .addChoices(
          { name: "🎁 Ödül Ver", value: "ver" },
          { name: "❌ Ödülü Geri Al", value: "al" }
        )
    )
    .addStringOption((o) =>
      o.setName("odul").setDescription("İşlem yapılacak ödülün adı / açıklaması").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("tenzilat")
    .setDescription("[Yönetici] Personelin rütbesini düşürür (Tenzil)")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Rütbesi düşürülecek personel").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("sebep").setDescription("Tenzil sebebi").setRequired(false)
    ),

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
    .setName("izin_ver")
    .setDescription("[Yönetici] Bir personele izin günü tanımlar")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("İzin verilecek personel").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("tarih").setDescription("İzin tarihi (YYYY-MM-DD formatında, örn: 2026-06-20)").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("sebep").setDescription("İzin verilme sebebi").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("izin_kullan")
    .setDescription("Birikmiş izin kredini kullanarak bugünlük görevlerini pas geç (skip et)"),

  new SlashCommandBuilder()
    .setName("izin_durum")
    .setDescription("Mevcut izin kotanı ve birikmiş izin kredilerini görüntüle"),

  new SlashCommandBuilder()
    .setName("grupcekeko")
    .setDescription("[Özel] Roblox kullanıcısının tüm gruplardaki rollerini en alta çeker")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("grupcekekogerial")
    .setDescription("[Özel] grupcekeko ile çekilen rolleri eski haline geri yükler")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true)
    ),
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
];

const moderationCommands = [
  new SlashCommandBuilder()
    .setName("mesaj_sil")
    .setDescription("Bulunulan kanalda belirtilen miktarda mesaj siler")
    .addNumberOption((o) =>
      o.setName("miktar").setDescription("Silinecek Mesaj Sayısı").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("sustur")
    .setDescription("Hedeflenen kullanıcıyı sunucuda susturur")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Hedef Kullanıcı").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("sure").setDescription("Susturma Süresi (1m, 1h, 1d)").setRequired(false)
    )
    .addStringOption((o) =>
      o.setName("sebep").setDescription("Susturma Sebebi").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("susturma_kaldir")
    .setDescription("Hedeflenen kullanıcının sunucudaki susturmasını kaldırır")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Hedef Kullanıcı").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("yasakla")
    .setDescription("Hedeflenen kullanıcıyı sunucudan yasaklar")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Hedef Kullanıcı").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("sebep").setDescription("Yasak Sebebi").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("yasaklama_kaldir")
    .setDescription("Hedeflenen kullanıcının sunucudaki yasağını kaldırır")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Hedef Kullanıcı").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("modislem")
    .setDescription("Kullanıcıya moderasyon işlemi uygula (sebebe göre otomatik ceza)")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Ceza verilecek kullanıcı").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("sebep").setDescription("İhlal sebebi").setRequired(true)
        .addChoices(
          { name: "🤬 Küfür / Hakaret", value: "KUFUR" },
          { name: "🤬 Ağır Küfür", value: "AGIR_KUFUR" },
          { name: "🚫 Irkçılık / Nefret Söylemi", value: "IRKCILIK" },
          { name: "🔞 Cinsel İçerik / NSFW", value: "NSFW" },
          { name: "📨 Spam / Flood", value: "SPAM" },
          { name: "📢 Reklam / Tanıtım", value: "REKLAM" },
          { name: "🔒 Kişisel Bilgi Paylaşma", value: "KISISEL_BILGI" },
          { name: "⚔️ Tehdit / Şiddet", value: "TEHDIT" },
          { name: "🎭 Trolleme / Provokasyon", value: "TROLLEME" },
          { name: "🔤 Büyük Harf Spam", value: "BUYUKHARF" },
          { name: "😂 Emoji / Sticker Spam", value: "EMOJI_SPAM" },
          { name: "📌 Yanlış Kanal Kullanımı", value: "YANLIS_KANAL" },
          { name: "😏 Alay / Dalga Geçme", value: "ALAY" },
          { name: "🛡️ Saygısızlık (Yetkililere)", value: "SAYGISIZLIK" },
          { name: "🤥 Sahte Bilgi / Yalan", value: "YALAN" },
          { name: "🔊 Sesli Kanalda Rahatsızlık", value: "SES_RAHATSIZLIK" },
          { name: "🖼️ Uygunsuz Profil / Fotoğraf", value: "UYGUNSUZ_PROFIL" },
          { name: "🔗 Link Paylaşma (İzinsiz)", value: "LINK_PAYLASMA" },
          { name: "👥 Alt Hesap / Yan Hesap", value: "ALT_HESAP" },
          { name: "✉️ DM Rahatsızlık", value: "DM_RAHATSIZLIK" },
          { name: "⚖️ Moderatör Kararına İtiraz", value: "MOD_ITIRAZ" },
          { name: "📋 Kanal Kurallarını İhlal", value: "KANAL_KURALLARI" },
          { name: "🔥 Tartışma Başlatma / Kışkırtma", value: "KISKIRTMA" },
          { name: "🔄 Tekrarlayan İhlal", value: "TEKRAR_IHLAL" },
          { name: "💀 Dolandırıcılık / Scam", value: "DOLANDIRICILIK" }
        )
    )
    .addAttachmentOption((o) =>
      o.setName("kanit").setDescription("Kanıt ekran görüntüsü (opsiyonel)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
];

// JSON'a dönüştürülmüş komut listesi (Deploy etmek için)
const allCommands = [
  ...generalCommands,
  ...economyCommands,
  ...funCommands,
  ...moderationCommands,
].map((c) => c.toJSON());

module.exports = { allCommands, generalCommands, economyCommands, funCommands, moderationCommands };