const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const {
  TMT_GUILD_ID,
  TMT_RULES_CHANNEL_ID,
  TMT_AUTOMOD_RULES_CHANNEL_ID,
} = require("../../config");

// ─── Sabitler ────────────────────────────────────────────────────────────────

const COLORS = {
  RED: 0xdc143c,
  DANGER: 0xff4444,
  WARNING: 0xfbbf24,
  INFO: 0x7c6af7,
  TEAL: 0x4ecdc4,
  MINT: 0x95e1d3,
  ORANGE: 0xff6347,
  PINK: 0xff6b6b,
  SUCCESS: 0x22c55e,
};

const BANNER_URL =
  "https://cdn.discordapp.com/attachments/1398799109573574686/1414007204234793010/Sunucu_Kurallar.png?ex=6a2bd894&is=6a2a8714&hm=68b9b4ff9cd4f1af700d1244ccc1ff276a6befd52749afc02fe27101751d7f0f";

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/**
 * Belirtilen kanaldaki tüm mesajları siler (bulk delete, maksimum 100).
 * @param {import("discord.js").TextChannel} channel
 */
async function clearChannel(channel) {
  let deleted = 0;
  try {
    let fetched;
    do {
      fetched = await channel.messages.fetch({ limit: 100 });
      if (fetched.size === 0) break;
      await channel.bulkDelete(fetched, true); // filterOld: true → 14 günden eski mesajları atlar
      deleted += fetched.size;
    } while (fetched.size >= 2);
  } catch (err) {
    console.warn(`⚠️ Kanal temizlenirken hata (${channel.name}):`, err.message);
  }
  return deleted;
}

/**
 * Kısa gecikme ekler (rate-limit'e takılmamak için).
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Embed dizisini sırayla gönderir, her gönderim arasında kısa bir bekleme yapar.
 * @param {import("discord.js").TextChannel} channel
 * @param {Array<{embeds?: EmbedBuilder[], components?: ActionRowBuilder[]}>} payloads
 */
async function sendSequential(channel, payloads) {
  for (const payload of payloads) {
    await channel.send(payload);
    await sleep(400);
  }
}

// ─── Kural Verileri ───────────────────────────────────────────────────────────

const SERVER_RULES = [
  {
    number: "1",
    title: "Discord Kullanım Şartları & Topluluk Kuralları",
    color: COLORS.DANGER,
    fields: [
      {
        name: "📜 Genel",
        value:
          "Bu sunucudaki en kapsayıcı kuraldır. Tüm diğer kurallar bu kurala göre yazılmıştır; hem Discord kurallarını hem de sunucu kurallarını kapsar.",
      },
      {
        name: "⭐ Türk Tarihine Saygı",
        value:
          "Türk tarihine ve sembollerine saygısızlık kesinlikle yasaktır. **Gazi Mustafa Kemal Atatürk** hakkında olumsuz ifade kullanmak yasaktır.",
      },
      {
        name: "1.1 · Yaş Sınırı",
        value:
          "Discord'u kullanmak için **en az 13 yaşında** olmanız gerekir. 13 yaş altı olduğunu belirten üyeler sunucudan yasaklanır.",
        inline: true,
      },
      {
        name: "1.2 · Kişisel Bilgiler",
        value:
          "Telefon numarası, isim-soyisim, kimlik numarası gibi kişisel bilgilerin ifşası yasaktır. Üyelerin yüz fotoğrafları da dahildir.",
        inline: true,
      },
      {
        name: "1.3 · Zararlı İçerik",
        value:
          "Virüslü dosyalar, zararlı bağlantılar ve IP Logger paylaşımı yasaktır. Dolandırıcılık kesinlikle yasaklanır.",
        inline: true,
      },
      {
        name: "1.4 · Kayıt Yasağı",
        value:
          "Sesli kanallarda diğer üyelerin izni olmadan kayıt almak yasaktır. Yetkililerin düzenlediği etkinlikler bu kuraldan muaftır.",
        inline: true,
      },
      {
        name: "1.5 · Bilet Sistemi",
        value:
          "İhtiyaç dışında, eğlence amaçlı veya troll yapmak için bilet açmak yasaktır.",
        inline: true,
      },
    ],
  },
  {
    number: "2",
    title: "NSFW / Hassas İçerik / Müstehcen Davranışlar",
    color: COLORS.PINK,
    fields: [
      {
        name: "2.1 · NSFW İçerik",
        value:
          "Pornografik veya müstehcen içerikler hakkında sıfır tolerans uygulanır. Paylaşmak, ima etmek veya çağrıştıran içerik göndermek yasaktır.",
        inline: true,
      },
      {
        name: "2.2 · NSFL & Hassas İçerik",
        value:
          "İntihar veya kendine zarar vermeyi teşvik eden ya da üyeleri rahatsız edecek içerikler kesinlikle yasaktır.",
        inline: true,
      },
      {
        name: "2.3 · E-Date",
        value:
          "Sunucumuz bir flört platformu değildir. Reşit olmayan üyeler bulunduğundan flörtleşme DM dahil her ortamda yasaktır ve yasaklanmaya yol açar.",
        inline: false,
      },
    ],
  },
  {
    number: "3",
    title: "Tüm Üyelere Saygılı Olun",
    color: COLORS.INFO,
    fields: [
      {
        name: "3.1 · Eşit Saygı",
        value:
          "Rütbe veya yetki farkı gözetmeksizin herkese saygılı davranın. Buradaki herkes bir bireydir.",
        inline: true,
      },
      {
        name: "3.2 · Hassas Konular",
        value:
          "Politika, siyaset, din, cinsellik, futbol gibi tartışmaya açık konular yasaktır. Üst yetkililerin gözetiminde istisnai olarak izin verilebilir.",
        inline: true,
      },
      {
        name: "3.3 · Kasıtlı Tartışma",
        value:
          "Bilerek tartışma çıkarmak veya tartışmaya yol açacak konulara girmek yasaktır. Küçük şakalar tolere edilse de kasıt belirleyicidir.",
        inline: true,
      },
      {
        name: "3.4 · Irkçılık & Aşırı İdeolojiler",
        value:
          "Aşırı fikirlerin savunuculuğu, svastika ve benzeri nefret sembollerinin paylaşımı kesinlikle yasaktır.",
        inline: true,
      },
    ],
  },
  {
    number: "4",
    title: "Genel Sohbet Kuralları",
    color: COLORS.TEAL,
    fields: [
      {
        name: "4.1 · Spam & Flood",
        value:
          "Mesaj, resim, video veya tepki spamı yasaktır. Arka arkaya 4 mesaj (arada başka biri yazmadan) flood sayılır.",
        inline: true,
      },
      {
        name: "4.2 · Rahatsız Edici Medya",
        value:
          "Kulak sağlığını tehdit eden aşırı yüksek sesli içerikler ve ışığa duyarlı kişileri etkileyebilecek yanıp sönen medya paylaşımı yasaktır.",
        inline: true,
      },
      {
        name: "4.3 · Etiket Kuralları",
        value:
          "**@Ordu Yönetimi** ve üzeri rolleri sebepsiz etiketlemek yasaktır. Ghost tag (etiketleyip silmek) yasaktır.",
        inline: true,
      },
      {
        name: "4.4 · Otomod Bypass",
        value:
          "Otomod tarafından engellenen kelimeleri harf çıkararak veya sırasını değiştirerek yazmaya çalışmak yasaktır.",
        inline: true,
      },
      {
        name: "4.5 · Küfür & Argo",
        value:
          "Sunucu düzenini korumak amacıyla küfür, argo ve benzeri ifadeler tamamen yasaklanmıştır. Moderatör uyarılarına uyun.",
        inline: true,
      },
    ],
  },
  {
    number: "5",
    title: "Reklam",
    color: COLORS.WARNING,
    fields: [
      {
        name: "5.1 · DM Reklamı",
        value:
          "DM üzerinden herhangi bir içerik veya başka bir Roblox grubu/sunucu reklamı yapmak hem Discord ToS'a hem de sunucu kurallarına aykırıdır. Birine katılım daveti göndermek istiyorsanız DM'den yapın; kanal içinde davet linki paylaşmak yasaktır.",
      },
    ],
  },
  {
    number: "6",
    title: "Discord Profilleri",
    color: COLORS.MINT,
    fields: [
      {
        name: "6.1 · Profil Uygunluğu",
        value:
          "Profil fotoğrafı, biyografi ve diğer profil alanları Discord ToS ile sunucu kurallarına uygun olmalıdır. NSFW, ırkçı veya cinsiyetçi içerik profilinizde bulunamaz.",
        inline: true,
      },
      {
        name: "6.2 · Taklit Yasağı",
        value:
          "Yetkilileri, YK'leri, @sanker ve diğer yönetim üyelerini taklit etmek, dolandırma amacı olmasa dahi yasaktır.",
        inline: true,
      },
    ],
  },
];

const AUTOMOD_RULES = [
  {
    id: "1.0",
    emoji: "🔒",
    title: "Kişisel Bilgilerin Koruması",
    color: COLORS.DANGER,
    description:
      "Telefon numarası, isim-soyad vb. kişisel bilgilerin korunması amacıyla oluşturulmuş otomod modülü.",
    penalty: "🚫 Sunucudan kalıcı yasaklama.",
    exempt: null,
    extra: null,
  },
  {
    id: "1.1",
    emoji: "🚫",
    title: "Toksik Kelime Moderasyonu",
    color: COLORS.PINK,
    description:
      "Sohbet kanallarının kalitesini korumak amacıyla küfür, argo ve toksik ifadeleri engelleyen otomod modülü.",
    penalty: "⏱️ 1 gün susturma.",
    exempt: "@Ordu Yönetimi ve @Moderatör Ekibi · Destek-sistemi biletleri",
    extra: null,
  },
  {
    id: "1.2",
    emoji: "🇹🇷",
    title: "Siyasi Parti Moderasyonu",
    color: COLORS.WARNING,
    description:
      "Sohbet ortamında siyasi tartışmaların önüne geçmek için oluşturulmuş otomod modülü.",
    penalty: "⏱️ 1 gün susturma.",
    exempt: "@Ordu Yönetimi ve @Moderatör Ekibi",
    extra: null,
  },
  {
    id: "1.3",
    emoji: "🔗",
    title: "Discord Bağlantı Moderasyonu",
    color: COLORS.INFO,
    description:
      "Sunucu içinde izinsiz Discord davet bağlantısı paylaşımını engelleyen otomod modülü.",
    penalty: "⏱️ 1 gün susturma.",
    exempt: "@Ordu Yönetimi ve @Moderatör Ekibi · Destek-sistemi biletleri",
    extra: null,
  },
  {
    id: "1.4",
    emoji: "🏷️",
    title: "Etiket Spam Engeli",
    color: COLORS.TEAL,
    description:
      "Ghost tag ve toplu etiket spamını engelleyen otomod modülü.",
    penalty: "⏱️ 10 dakika susturma.",
    exempt: "@Ordu Yönetimi ve @Moderatör Ekibi",
    extra: { name: "📊 Etiket Sınırı", value: "Maksimum **3** etiket" },
  },
];

// ─── Embed Oluşturucular ──────────────────────────────────────────────────────

/**
 * Tek bir sunucu kuralı için embed oluşturur.
 * @param {{ number: string, title: string, color: number, fields: object[] }} rule
 * @returns {EmbedBuilder}
 */
function buildRuleEmbed(rule) {
  return new EmbedBuilder()
    .setTitle(`${rule.number}. ${rule.title}`)
    .setColor(rule.color)
    .addFields(rule.fields)
    .setFooter({ text: `Kural ${rule.number}` });
}

/**
 * Otomod kuralı için embed oluşturur.
 */
function buildAutomodEmbed(rule) {
  const fields = [];

  if (rule.exempt) {
    fields.push({ name: "✅ Etkilenmeyen Roller", value: rule.exempt });
  }
  if (rule.extra) {
    fields.push(rule.extra);
  }
  fields.push({ name: "⚖️ Ceza", value: rule.penalty });

  return new EmbedBuilder()
    .setTitle(`${rule.emoji} ${rule.id} · ${rule.title}`)
    .setDescription(rule.description)
    .setColor(rule.color)
    .addFields(fields)
    .setFooter({ text: `Otomod Modülü ${rule.id}` });
}

// ─── Ana Gönderim Fonksiyonları ───────────────────────────────────────────────

/**
 * Sunucu genel kurallarını kanalına gönderir.
 * @param {import("discord.js").TextChannel} channel
 */
async function postServerRules(channel) {
  const payloads = [];

  // Başlık embed'i
  payloads.push({
    embeds: [
      new EmbedBuilder()
        .setTitle("| TMT | Turkish Armed Forces'e Hoş Geldin 👋")
        .setDescription(
          "Seni burada gördüğümüz için mutluyuz!\n\n" +
          "Aşağıdaki kuralları dikkatlice oku. Sunucumuza giren her üye kuralları okumuş sayılır. " +
          "Moderatörler tarafından susturulur veya yasaklanırsan kurallara uymamışsındır."
        )
        .setColor(COLORS.RED)
        .setImage(BANNER_URL),
    ],
  });

  // Kural embed'leri
  for (const rule of SERVER_RULES) {
    payloads.push({ embeds: [buildRuleEmbed(rule)] });
  }

  // Son uyarı embed'i
  payloads.push({
    embeds: [
      new EmbedBuilder()
        .setTitle("⚠️ Kuralları Aşmaya Çalışmayın")
        .setDescription(
          "Her yasaklı davranış kurallarda açıkça yazılı olmayabilir. " +
          "Yasak olabilecek şeyleri düşünerek hareket edin.\n\n" +
          "Moderatörler sizi susturduysa veya yasakladıysa bunun kesinlikle bir gerekçesi vardır. " +
          '"Böyle bir kural yok." şeklinde itiraz etmek cezanızın artmasına yol açabilir.\n\n' +
          "Moderatörler sizi susturan kişinin bilgilerini açıklamakla yükümlü değildir."
        )
        .setColor(COLORS.ORANGE),
    ],
  });

  await sendSequential(channel, payloads);
}

/**
 * Otomod kurallarını kanalına gönderir.
 * @param {import("discord.js").TextChannel} channel
 */
async function postAutomodRules(channel) {
  const payloads = [];

  // Başlık
  payloads.push({
    embeds: [
      new EmbedBuilder()
        .setTitle("🤖 Otomod Kuralları")
        .setDescription(
          "Bu kanaldaki kurallar sunucumuzda aktif olan otomatik moderasyon modüllerini açıklamaktadır.\n" +
          "Her modülün hangi davranışı engellediğini, hangi rollerin muaf olduğunu ve ihlal durumundaki cezayı bulabilirsiniz."
        )
        .setColor(COLORS.INFO),
    ],
  });

  for (const rule of AUTOMOD_RULES) {
    payloads.push({ embeds: [buildAutomodEmbed(rule)] });
  }

  await sendSequential(channel, payloads);
}

/**
 * TMT sunucu kurallarını Discord kanallarına gönderir.
 * Kanallar önce temizlenir, ardından güncel içerik sırayla gönderilir.
 * @param {import("discord.js").Client} client
 * @param {{ clear?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
async function postTMTRules(client, { clear = false } = {}) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID);
    const rulesChannel = await guild.channels.fetch(TMT_RULES_CHANNEL_ID);
    const automodChannel = await guild.channels.fetch(
      TMT_AUTOMOD_RULES_CHANNEL_ID
    );

    if (clear) {
      console.log("🧹 Kanallar temizleniyor...");
      await clearChannel(rulesChannel);
      await clearChannel(automodChannel);
    }

    console.log("📤 Sunucu kuralları gönderiliyor...");
    await postServerRules(rulesChannel);

    console.log("📤 Otomod kuralları gönderiliyor...");
    await postAutomodRules(automodChannel);

    console.log("✅ TMT sunucu kuralları başarıyla gönderildi.");
    return true;
  } catch (error) {
    console.error("❌ TMT kuralları gönderilirken hata:", error);
    return false;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  postTMTRules,
  postServerRules,
  postAutomodRules,
}; df