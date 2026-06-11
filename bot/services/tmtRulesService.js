const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { TMT_GUILD_ID, TMT_RULES_CHANNEL_ID, TMT_AUTOMOD_RULES_CHANNEL_ID } = require("../../config");

/**
 * TMT (Turkish Armed Forces) sunucu kurallarını Discord kanalına gönderir
 */
async function postTMTRules(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID);
    const rulesChannel = await guild.channels.fetch(TMT_RULES_CHANNEL_ID);
    const automodChannel = await guild.channels.fetch(TMT_AUTOMOD_RULES_CHANNEL_ID);

    // Sunucu kurallarını gönder
    await postServerRules(rulesChannel);
    
    // Otomod kurallarını gönder
    await postAutomodRules(automodChannel);

    console.log("✅ TMT sunucu kuralları başarıyla gönderildi");
    return true;
  } catch (error) {
    console.error("❌ TMT kuralları gönderilirken hata:", error);
    return false;
  }
}

/**
 * Sunucu genel kurallarını gönderir
 */
async function postServerRules(channel) {
  // Ana başlık embed
  const titleEmbed = new EmbedBuilder()
    .setTitle("🎖️ | TMT  | Turkish Armed Forces'e Hoş Geldin")
    .setDescription(
      "Seni burada gördüğümüz için mutluyuz. Aşağıda kuralları görebilirsin, " +
      "sunucumuza giren her üyenin kuralları okuduğu varsayılır. " +
      "Bu yüzden eğer moderatörler tarafından susturulur veya yasaklanırsan kurallara uymamışsındır."
    )
    .setColor(0xDC143C)
    .setFooter({ text: "TMT Kuralları • Lütfen dikkatle okuyun" });

  await channel.send({ embeds: [titleEmbed] });

  // Discord Kullanım Şartları & Topluluk Kuralları
  const rule1Embed = new EmbedBuilder()
    .setTitle("📋 Discord Kullanım Şartları & Topluluk Kuralları")
    .setDescription(
      "Bu, sunucudaki en kapsayıcı kuraldır. Diğer tüm kurallarımız da bu kurala göre yazılmıştır. " +
      "Bu kurallar sadece toplulukla ilgili değil, Discord'un kendince belirlediği kurallarla da ilgilidir."
    )
    .setColor(0xFF4444)
    .addFields(
      {
        name: "🇹🇷 Türk tarihine saygılı olun.",
        value: "Türk tarihine ve Türk tarihinin önemli sembollerine saygı duymamak ve saygısızlık yapmak yasaktır. " +
               "Özellikle **Gazi Mustafa Kemal Atatürk**'ü sevmemek ve hakkında olumsuz konuşmak sunucumuzda kesinlike yasaktır."
      },
      {
        name: "1️⃣ Discord'u kullanmak için en az 13 yaşında olmanız gerekmektedir.",
        value: "Sunucuda bulunmak için en az 13 yaşında olmanız gerekmektedir. " +
               "13 yaşından küçük olduğunuzu belirtirseniz sunucudan yasaklanırsınız."
      },
      {
        name: "2️⃣ Kişisel bilgileri paylaşmayın.",
        value: "Herhangi bir kişinin özel, kişisel ve hassas bilgilerini ifşa etmek kesinlikle yasaktır. " +
               "Üyeleri kişisel bilgilerini ifşa etmekle tehdit etmek de bunun içine dahildir. " +
               "Telefon numaraları, isim-soyisim, kimlik numarası ve benzeri her türlü şeyi paylaşmak kesinlikle yasaktır. " +
               "Sunucu üyelerinin yüzünü, kendi yüzünüzü paylaşmak da güvenlik sebebiyle kesinlikle yasaktır."
      },
      {
        name: "3️⃣ Dolandırıcılık yapmayın, virüslü dosyalar ve zararlı bağlantılar paylaşmayın.",
        value: "Virüslü ve zararlı dosyalar göndermek Discord üzerinde yasaktır ve bu sunucuda veya başka bir sunucuda " +
               "paylaşımını yapmak yasaklanmanıza sebep olacaktır. Buna dahil olarak IP Loggerlar da yasaktır. " +
               "Bu dosyalar, bağlantılar hakkında vs. tartışmak yasak değildir fakat sesli kanallarda yayında göstermek yasaktır."
      },
      {
        name: "4️⃣ Sesli kanallarda izinsiz kayıt almayın.",
        value: "Sesli kanalları o kanaldaki üyelerin izni olmadan kaydetmek yasaktır. " +
               "Bu kuralın tek istisnası yetkililerin düzenlediği etkinliklerdir."
      },
      {
        name: "5️⃣ Bilet sistemini meşgul etmeyin.",
        value: "İhtiyacınız olmadığı hâlde, eğlencesine veya troll yapmak için bilet açmak yasaktır. " +
               "Botu meşgul etmeyin, böylece diğer kişiler yardım alabilir."
      }
    );

  await channel.send({ embeds: [rule1Embed] });

  // NSFW ve Hassas İçerik
  const rule2Embed = new EmbedBuilder()
    .setTitle("🚫 NSFW / Hassas İçerik / Müstehcen Davranışlar")
    .setColor(0xFF6B6B)
    .addFields(
      {
        name: "1️⃣ NSFW içerikler hakkında konuşmayın.",
        value: "NSFW ve pornografik içerikler hakkında tolerans yoktur. " +
               "Bu içerikleri paylaşmak, ima etmek ve akılda uyandıracak görseller videolar yasaktır."
      },
      {
        name: "2️⃣ NSFL ve hassas içerikler.",
        value: "NSFL yani intihara, kendini zarar vermeye teşvik edici şeyler yasaktır. " +
               "Üyeleri rahatsız edecek, midesini bulandıracak şeyler de bunun içine girer."
      },
      {
        name: "3️⃣ E-date benzeri şeyler yasaktır.",
        value: "Sunucumuz bir dating ve flörtleşme sunucusu değildir. " +
               "Sunucumuzda reşit olmayan üyeler olduğu için bu kesinlikle yasaktır. " +
               "DM'den, sohbetten veya herhangi bir kanalda flörtleşen kişiler yasaklanacaktır."
      }
    );

  await channel.send({ embeds: [rule2Embed] });

  // Tüm Üyelere Saygılı Olun
  const rule3Embed = new EmbedBuilder()
    .setTitle("👥 Tüm Üyelere Saygılı Olun")
    .setColor(0x7C6AF7)
    .addFields(
      {
        name: "1️⃣ Rütbe, yetki fark etmeksizin herkese saygılı olun.",
        value: "Sırf bir üye yetkili ve rütbeli değil diye o üyeye karşı ters tavırlar sergilemeyin. " +
               "Buradaki herkesin de bir birey olduğunu unutmayın."
      },
      {
        name: "2️⃣ Hassas konulara girmekten kaçının.",
        value: "Herkesin hassas gözle baktığı konular olduğu için ve bu konuların muhabbetini yapmak tartışmalara " +
               "sebep olabileceği için yasaktır. Hassas konular şunları içerir: Politika, siyaset, din, cinsellik, futbol vs. " +
               "İstisna olarak üst yetkililerin gözetimi altında bu konuların sohbetine izin verilir."
      },
      {
        name: "3️⃣ Bilerek tartışma çıkarmayın.",
        value: "Tartışmasız, saygılı ve herkesin eğlenebileceği bir ortam yaratmaya çalışıyoruz. " +
               "Bu yüzden küçük şakalara bir şey demesek de bilerek tartışma çıkarmayın, tartışma çıkaracak konulara girmeyin."
      },
      {
        name: "4️⃣ Irkçılık, Nazizm vs. yasaktır.",
        value: "Aşırı fikirlerin savunuculuğunu yapmak ve bunlara dair görseller, metinler paylaşmak yasaktır. " +
               "Özellikle **svastika** ve benzeri sembolleri paylaşmak yasaktır."
      }
    );

  await channel.send({ embeds: [rule3Embed] });

  // Genel Sohbet Kuralları
  const rule4Embed = new EmbedBuilder()
    .setTitle("💬 Genel Sohbet Kuralları")
    .setColor(0x4ECDC4)
    .addFields(
      {
        name: "1️⃣ Spam ve flood yapmayın.",
        value: "Mesaj, video, resim, tepki spamlamak yasaktır. Flood (Art arda bir sürü mesaj atmak) yasaktır. " +
               "Arka arkaya başkası mesaj atmadan 4 mesaj atarsanız flood yapmış olursunuz."
      },
      {
        name: "2️⃣ Yüksek sesli/Çok parlak şeyler göndermeyin.",
        value: "İnsanların kulak sağlığı için aşırı yüksek sesli videolar göndermeyin ve ışığa duyarlı olan insanlar " +
               "olabileceği için aşırı parlak, yanıp sönen videolar, gifler ya da fotoğraflar paylaşmayın."
      },
      {
        name: "3️⃣ Tag Kuralları",
        value: "@Ordu Yönetimi ve üstü rollere sahip olan kişileri sebepsiz yere etiketlemek ve rahatsız etmek yasaktır. " +
               "Eğer etiketlediğiniz kişi size izin veriyorsa bir sakınca yoktur. Ghost Tag (Tag atıp silmek) yasaktır."
      },
      {
        name: "4️⃣ Otomodu aşmaya çalışmayın.",
        value: "Eğer otomod yüzünden susturulduysanız bir sebebi vardır. Otomod kurallarında yasaklanan kelimeler belirtilmiştir. " +
               "Bu kelimelerden harf çıkararak, sıralarını değiştirerek susturulmadan yasaklı kelimeleri yazmaya çalışmayın."
      },
      {
        name: "5️⃣ Küfür, argo ve benzeri her türlü şey yasaktır.",
        value: "Sunucumuzdaki düzeni korumak adına küfür, argo ve benzeri her şey yasaklanmıştır. " +
               "Lütfen moderatörlerin de uyarılarına uyun ve küfür benzeri hiçbir şey kullanmayın."
      }
    );

  await channel.send({ embeds: [rule4Embed] });

  // Reklam
  const rule5Embed = new EmbedBuilder()
    .setTitle("📢 Reklam")
    .setColor(0xFBBF24)
    .addFields(
      {
        name: "1️⃣ DM'den üyelere reklam yapmayın.",
        value: "Herhangi bir şeyin DM'den reklamını yapmak yasaktır. Özellikle diğer sunucuların reklamını lütfen yapmayın. " +
               "DM reklamları ayrıca Discord'un hizmet şartları ve kullanım politikasına (TOS) aykırıdır. " +
               "İnsanlara sunucunuza katılmasını vs. söylemeyin. Eğer bir kişi sunucunuza katılmak istiyorsa ona DM'den yollayın, " +
               "sunucumuzda davet bağlantısı yollamak yasaktır."
      }
    );

  await channel.send({ embeds: [rule5Embed] });

  // Discord Profilleri
  const rule6Embed = new EmbedBuilder()
    .setTitle("🎭 Discord Profilleri")
    .setColor(0x95E1D3)
    .addFields(
      {
        name: "1️⃣ Discord profiliniz kurallarımıza uygun olmalıdır.",
        value: "Discord profilinize koyduğunuz şeyler Discord'un hizmet ve kullanım şartlarına ve sunucumuzun topluluk kurallarına " +
               "uygun olmalıdır. Profil fotoğrafınıza, biyografinize, hitaplarınıza veya herhangi bir yere NSFW, ırkçı, cinsiyetçi " +
               "şeyler koymayın. Profilinizdeki her şey sunucumuzun moderasyonuna dahildir ve bunlardan sorumlu tutulursunuz."
      },
      {
        name: "2️⃣ Yetkilileri taklit etmeyin.",
        value: "Yetkilileri, YK'leri ve daha birçok yönetim üyesini taklit etmek yasaktır. " +
               "Üyeleri dolandırmak gibi bir amacınız olmasa da bu yasaklanmıştır."
      }
    );

  await channel.send({ embeds: [rule6Embed] });

  // Son uyarı
  const finalEmbed = new EmbedBuilder()
    .setTitle("⚠️ Kuralları Aşmaya Çalışmayın")
    .setDescription(
      "Bilerek kuralları kendinize göre değiştirmek yasaktır. Sunucudaki her kural mükemmel değildir ve her yasaklı şeyi içeremez. " +
      "Bu yüzden yasak olabilecek şeyleri düşünerek hareket edin.\n\n" +
      "Eğer moderatörler sizi susturduysa veya yasakladıysa bunun kesinlikle bir sebebi vardır, moderatörlere sunucu kurallarını " +
      "atarak \"Böyle bir kural yok.\" vesaire demeniz cezanızın artmasına sebep olabilir.\n\n" +
      "**Moderatörler sizi susturan kişinin adını ve diğer bilgilerini vermekle yükümlü değillerdir.**"
    )
    .setColor(0xFF6347);

  await channel.send({ embeds: [finalEmbed] });
}

/**
 * Otomod kurallarını gönderir
 */
async function postAutomodRules(channel) {
  // Kişisel Bilgilerin Koruması
  const automod1Embed = new EmbedBuilder()
    .setTitle("🔒 1.0 Kişisel Bilgilerin Koruması")
    .setDescription(
      "Bazı kişilerin kişisel bilgilerinin korunması için oluşturulmuş otomod. " +
      "Telefon numarası, isim-soyad vb. korumaya yardımcı olur."
    )
    .setColor(0xFF4444)
    .addFields(
      {
        name: "Cezası",
        value: "🚫 Sunucudan yasaklanmak."
      }
    );

  await channel.send({ embeds: [automod1Embed] });

  // Toksik Kelime Moderasyonu
  const automod2Embed = new EmbedBuilder()
    .setTitle("🚫 1.1 Toksik Kelime Moderasyonu")
    .setDescription(
      "Sohbetin ve diğer kanalların kalitesini korumak amacıyla oluşturulmuş otomod."
    )
    .setColor(0xFF6B6B)
    .addFields(
      {
        name: "Etkilenmeyen Roller",
        value: "@Ordu Yönetimi ve @Moderatör Ekibi\ndestek-sistemi biletlerinde etkilenilmez."
      },
      {
        name: "Cezası",
        value: "⏱️ 1 gün sunucudan susturulmak."
      }
    );

  await channel.send({ embeds: [automod2Embed] });

  // Siyasi Parti Moderasyonu
  const automod3Embed = new EmbedBuilder()
    .setTitle("🇹🇷 1.2 Siyasi Parti Moderasyonu")
    .setDescription(
      "Sohbette siyaset konuşulmaması, tartışma çıkmaması için oluşturulmuş otomod."
    )
    .setColor(0xFBBF24)
    .addFields(
      {
        name: "Etkilenmeyen Roller",
        value: "@Ordu Yönetimi ve @Moderatör Ekibi"
      },
      {
        name: "Cezası",
        value: "⏱️ 1 gün sunucudan susturulmak."
      }
    );

  await channel.send({ embeds: [automod3Embed] });

  // Discord Bağlantı Moderasyonu
  const automod4Embed = new EmbedBuilder()
    .setTitle("🔗 1.3 Discord Bağlantı Moderasyonu")
    .setDescription(
      "Sunucu içerisinde Discord davet bağlantıların atılmasını engellemek için oluşturulmuş otomod."
    )
    .setColor(0x7C6AF7)
    .addFields(
      {
        name: "Etkilenmeyen Roller",
        value: "@Ordu Yönetimi ve @Moderatör Ekibi\ndestek-sistemi biletlerinde etkilenilmez."
      },
      {
        name: "Cezası",
        value: "⏱️ 1 gün sunucudan susturulmak."
      }
    );

  await channel.send({ embeds: [automod4Embed] });

  // Etiket Spamları Engelle
  const automod5Embed = new EmbedBuilder()
    .setTitle("🏷️ 1.4 Etiket Spamları Engelle")
    .setDescription(
      "Sunucu içerisinde ghost tag ve belirli etiket spamları engellemek için oluşturulmuş otomod."
    )
    .setColor(0x4ECDC4)
    .addFields(
      {
        name: "Etkilenmeyen Roller",
        value: "@Ordu Yönetimi ve @Moderatör Ekibi"
      },
      {
        name: "Etiket Sınırı",
        value: "📊 Maksimum 3 etiket"
      },
      {
        name: "Cezası",
        value: "⏱️ 10 dakika sunucudan susturulmak."
      }
    );

  await channel.send({ embeds: [automod5Embed] });
}

module.exports = {
  postTMTRules,
  postServerRules,
  postAutomodRules,
};
