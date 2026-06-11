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
    .setTitle("| TA | Turkish Armed Forces'e Hoş Geldin 👋")
    .setDescription(
      "Seni burada gördüğümüz için mutluyuz. Aşağıda kuralları görebilirsin, " +
      "sunucumuza giren her üyenin kuralları okuduğu varsayılır. " +
      "Bu yüzden eğer moderatörler tarafından susturulur veya yasaklanırsan kurallara uymamışsındır."
    )
    .setColor(0xDC143C);
    // Görsel eklemek istenirse: .setImage("URL_BURAYA")

  await channel.send({ embeds: [titleEmbed] });

  // 1. Discord Kullanım Şartları & Topluluk Kuralları
  const rule1Embed = new EmbedBuilder()
    .setTitle("1. Discord Kullanım Şartları & Topluluk Kuralları")
    .setDescription(
      "• Bu, sunucudaki en kapsayıcı kuraldır. Diğer tüm kurallarımız da bu kurala göre yazılmıştır. Bu kurallar sadece toplulukla ilgili değil, Discord'un kendince belirlediği kurallarla da ilgilidir.\n\n" +
      ":TA_beyazyildiz: **Türk tarihine saygılı olun.**\n" +
      "• Türk tarihine ve Türk tarihinin önemli sembollerine saygı duymamak ve saygısızlık yapmak yasaktır. Özellikle **Gazi Mustafa Kemal Atatürk**'ü sevmemek ve hakkında olumsuz konuşmak sunucumuzda kesinlike yasaktır.\n\n" +
      "**1.1 Discord'u kullanmak için en az 13 yaşında olmanız gerekmektedir.**\n" +
      "• Sunucuda bulunmak için en az 13 yaşında olmanız gerekmektedir. 13 yaşından küçük olduğunuzu belirtirseniz sunucudan yasaklanırsınız.\n\n" +
      "**1.2 Kişisel bilgileri paylaşmayın.**\n" +
      "• Herhangi bir kişinin özel, kişisel ve hassas bilgilerini ifşa etmek kesinlikle yasaktır. Üyeleri kişisel bilgilerini ifşa etmekle tehdit etmek de bunun içine dahildir. Telefon numaraları, isim-soyisim, kimlik numarası ve benzeri her türlü şeyi paylaşmak kesinlikle yasaktır.\n" +
      "• Sunucu üyelerinin yüzünü, kendi yüzünüzü paylaşmak da güvenlik sebebiyle kesinlikle yasaktır.\n\n" +
      "**1.3 Dolandırıcılık yapmayın, virüslü dosyalar ve zararlı bağlantılar paylaşmayın.**\n" +
      "• Virüslü ve zararlı dosyalar göndermek Discord üzerinde yasaktır ve bu sunucuda ya da başka bir sunucuda paylaşımını yapmak yasaklanmanıza sebep olacaktır. Buna dahil olarak IP Loggerlar da yasaktır.\n" +
      "• Bu dosyalar , bağlantılar hakkında vs. tartışmak yasak değildir fakat sesli kanallarda yayında göstermek yasaktır.\n\n" +
      "**1.4 Sesli kanallarda izinsiz kayıt almayın.**\n" +
      "• Sesli kanalları o kanaldaki üyelerin izni olmadan kaydetmek yasaktır.\n" +
      "• Bu kuralın tek istisnası yetkililerin düzenlediği etkinliklerdir.\n\n" +
      "**1.5 Bilet sistemini meşgul etmeyin.**\n" +
      "• İhtiyacınız olmadığı hâlde, eğlencesine veya troll yapmak için bilet açmak yasaktır. Botu meşgul etmeyin, böylece diğer kişiler yardım alabilir."
    )
    .setColor(0xFF4444);

  await channel.send({ embeds: [rule1Embed] });

  // 2. NSFW ve Hassas İçerik
  const rule2Embed = new EmbedBuilder()
    .setTitle("2. NSFW / Hassas İçerik / Müstehcen Davranışlar")
    .setDescription(
      "**2.1 NSFW içerikler hakkında konuşmayın.**\n" +
      "• NSFW ve pornografik içerikler hakkında tolerans yoktur. Bu içerikleri paylaşmak, ima etmek ve akılda uyandıracak görseller videolar yasaktır.\n\n" +
      "**2.2 NSFL ve hassas içerikler.**\n" +
      "• NSFL yani intihara, kendini zarar vermeye teşvik edici şeyler yasaktır. Üyeleri rahatsız edecek, midesini bulandıracak şeyler de bunun içine girer.\n\n" +
      "**2.3 E-date benzeri şeyler yasaktır.**\n" +
      "• Sunucumuz bir dating ve flörtleşme sunucusu değildir. Sunucumuzda reşit olmayan üyeler olduğu için bu kesinlikle yasaktır. DM'den, sohbetten veya herhangi bir kanalda flörtleşen kişiler yasaklanacaktır."
    )
    .setColor(0xFF6B6B);

  await channel.send({ embeds: [rule2Embed] });

  // 3. Tüm Üyelere Saygılı Olun
  const rule3Embed = new EmbedBuilder()
    .setTitle("3. Tüm Üyelere Saygılı Olun")
    .setDescription(
      "**3.1 Rütbe, yetki fark etmeksizin herkese saygılı olun.**\n" +
      "• Sırf bir üye yetkili ve rütbeli değil diye o üyeye karşı ters tavırlar sergilemeyin. Buradaki herkesin de bir birey olduğunu unutmayın.\n\n" +
      "**3.2 Hassas konulara girmekten kaçının.**\n" +
      "• Herkesin hassas gözle baktığı konular olduğu için ve bu konuların muhabbetini yapmak tartışmalara sebep olabileceği için yasaktır.\n" +
      "• Hassas konular şunları içerir: Politika, siyaset, din, cinsellik, futbol vs.\n" +
      "  *İstisna olarak üst yetkililerin gözetimi altında bu konuların sohbetine izin verilir.*\n\n" +
      "**3.3 Bilerek tartışma çıkarmayın.**\n" +
      "• Tartışmasız, saygılı ve herkesin eğlenebileceği bir ortam yaratmaya çalışıyoruz. Bu yüzden küçük şakalara bir şey demesek de bilerek tartışma çıkarmayın, tartışma çıkaracak konulara girmeyin.\n\n" +
      "**3.4 Irkçılık, Nazizm vs. yasaktır.**\n" +
      "• Aşırı fikirlerin savunuculuğunu yapmak ve bunlara dair görseller, metinler paylaşmak yasaktır. Özellikle svastika ve benzeri sembolleri paylaşmak yasaktır."
    )
    .setColor(0x7C6AF7);

  await channel.send({ embeds: [rule3Embed] });

  // 4. Genel Sohbet Kuralları
  const rule4Embed = new EmbedBuilder()
    .setTitle("4. Genel Sohbet Kuralları")
    .setDescription(
      "**4.1 Spam ve flood yapmayın.**\n" +
      "• Mesaj, video, resim, tepki spamlamak yasaktır.\n" +
      "• Flood (Art arda bir sürü mesaj atmak) yasaktır. Arka arkaya başkası mesaj atmadan 4 mesaj atarsanız flood yapmış olursunuz.\n\n" +
      "**4.2 Yüksek sesli/Çok parlak şeyler göndermeyin.**\n" +
      "• İnsanların kulak sağlığı için aşırı yüksek sesli videolar göndermeyin ve ışığa duyarlı olan insanlar olabileceği için aşırı parlak, yanıp sönen videolar, gifler ya da fotoğraflar paylaşmayın.\n\n" +
      "**4.3 Tag Kuralları**\n" +
      "• @Ordu Yönetimi ve üstü rollere sahip olan kişileri sebepsiz yere etiketlemek ve rahatsız etmek yasaktır.\n" +
      "• Eğer etiketlediğiniz kişi size izin veriyorsa bir sakınca yoktur.\n" +
      "• Ghost Tag (Tag atıp silmek) yasaktır.\n\n" +
      "**4.4 Otomodu aşmaya çalışmayın.**\n" +
      "• Eğer otomod yüzünden susturulduysanız bir sebebi vardır. Otomod kurallarında yasaklanan kelimeler belirtilmiştir. Bu kelimelerden harf çıkararak, sıralarını değiştirerek susturulmadan yasaklı kelimeleri yazmaya çalışmayın.\n\n" +
      "**4.5 Küfür, argo ve benzeri her türlü şey yasaktır.**\n" +
      "• Sunucumuzdaki düzeni korumak adına küfür, argo ve benzeri her şey yasaklanmıştır. Lütfen moderatörlerin de uyarılarına uyun ve küfür benzeri hiçbir şey kullanmayın."
    )
    .setColor(0x4ECDC4);

  await channel.send({ embeds: [rule4Embed] });

  // 5. Reklam
  const rule5Embed = new EmbedBuilder()
    .setTitle("5. Reklam")
    .setDescription(
      "**5.1 DM'den üyelere reklam yapmayın.**\n" +
      "• Herhangi bir şeyin DM'den reklamını yapmak yasaktır. Özellikle diğer roblox gruplarının reklamını lütfen yapmayın. DM reklamları ayrıca Discord'un hizmet şartları ve kullanım politikasına (TOS) aykırıdır.\n" +
      "• İnsanlara sunucunuza katılmasını vs. söylemeyin. Eğer bir kişi sunucunuza katılmak istiyorsa ona DM'den yollayın, sunucumuzda davet bağlantısı yollamak yasaktır."
    )
    .setColor(0xFBBF24);

  await channel.send({ embeds: [rule5Embed] });

  // 6. Discord Profilleri
  const rule6Embed = new EmbedBuilder()
    .setTitle("6. Discord Profilleri")
    .setDescription(
      "**6.1 Discord profiliniz kurallarımıza uygun olmalıdır.**\n" +
      "• Discord profilinize koyduğunuz şeyler Discord'un hizmet ve kullanım şartlarına ve sunucumuzun topluluk kurallarına uygun olmalıdır. Profil fotoğrafınıza, biyografinize, hitaplarınıza veya herhangi bir yere NSFW, ırkçı, cinsiyetçi şeyler koymayın. Profilinizdeki her şey sunucumuzun moderasyonuna dahildir ve bunlardan sorumlu tutulursunuz.\n\n" +
      "**6.2 Yetkilileri taklit etmeyin.**\n" +
      "• Yetkilileri, YK'leri, @sanker ve daha birçok yönetim üyesini taklit etmek yasaktır. Üyeleri dolandırmak gibi bir amacınız olmasa da bu yasaklanmıştır."
    )
    .setColor(0x95E1D3);

  await channel.send({ embeds: [rule6Embed] });

  // Son uyarı
  const finalEmbed = new EmbedBuilder()
    .setTitle("⚠️ Kuralları Aşmaya Çalışmayın")
    .setDescription(
      "Bilerek kuralları kendinize göre değiştirmek yasaktır. Sunucudaki her kural mükemmel değildir ve her yasaklı şeyi içeremez. Bu yüzden yasak olabilecek şeyleri düşünerek hareket edin.\n" +
      "Eğer moderatörler sizi susturduysa veya yasakladıysa bunun kesinlikle bir sebebi vardır, moderatörlere sunucu kurallarını atarak \"Böyle bir kural yok.\" vesaire demeniz cezanızın artmasına sebep olabilir.\n" +
      "Moderatörler sizi susturan kişinin adını ve diğer bilgilerini vermekle yükümlü değillerdir."
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
