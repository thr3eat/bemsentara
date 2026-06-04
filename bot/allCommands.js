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
    .setName("personeldurum")
    .setDescription("Personel ilerleme durumunu görüntüle")
    .addUserOption(o =>
      o.setName("kullanici").setDescription("Bakılacak personel (boş = kendin)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("seviye")
    .setDescription("Kurbağa seviyeni ve XP durumunu göster")
    .addUserOption(o =>
      o.setName("kullanici").setDescription("Bakılacak kişi (boş = kendin)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Roblox hesabınıza göre Discord rollerinizi senkronize eder")
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("update")
    .setDescription("Ana BEM grubu ve branş gruplarına göre rollerinizi günceller")
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("debug-update")
    .setDescription("[Yönetici] Rol senkron debug — önizleme veya uygulama")
    .addUserOption((o) =>
      o.setName("kullanici").setDescription("Test edilecek kullanıcı (boş = kendin)").setRequired(false)
    )
    .addBooleanOption((o) =>
      o.setName("uygula").setDescription("true = rolleri gerçekten uygula").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
];

// JSON'a dönüştürülmüş komut listesi (Deploy etmek için)
const allCommands = [
  ...generalCommands,
  ...economyCommands,
  ...funCommands,
  ...moderationCommands,
].map((c) => c.toJSON());

module.exports = { allCommands, generalCommands, economyCommands, funCommands, moderationCommands };