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

const allCommands = [
  ...generalCommands,
  ...economyCommands,
  ...funCommands,
].map((c) => c.toJSON());

module.exports = {
  allCommands,
  generalCommands,
  economyCommands,
  funCommands,
  moderationCommands: []
};