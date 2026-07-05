'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');
const { chatWithAI } = require('./aiService');

const FALLBACK_QUESTIONS_BY_LEVEL = {
  2: [ // Target Level 2 (Personel) - Crisis Management
    {
      question: "Bir üye genel sohbette yetkililere kışkırtıcı/trol mesajlar atarak kriz çıkarmaya çalışırsa ne yapmalısınız?",
      options: ["Onunla tartışmaya girmeyip sakin kalmak ve gerekirse uyarıp susturmak", "Anında küfür ederek karşılık vermek", "Sohbeti tamamen kilitlemek", "Üyeyi sunucudan doğrudan banlamak"],
      correctIndex: 0
    },
    {
      question: "Sohbette birden fazla üyenin birbiriyle sertçe kavga ettiğini ve ortamın gerildiğini görürseniz yapacağınız ilk müdahale ne olmalıdır?",
      options: ["Kavgayı izlemek ve taraf tutmak", "Kanalı yavaş moda alıp üyeleri uyararak tartışmayı sonlandırmak", "Kavga eden herkesi kalıcı olarak banlamak", "Genel sohbet kanalını silmek"],
      correctIndex: 1
    },
    {
      question: "Sunucuya aniden birden fazla bot hesap girip hızlıca reklam yapmaya (raid/baskın başlangıcı) başlarsa ne yapılmalıdır?",
      options: ["Durumu görmezden gelmek", "Spam yapanları susturmak/engellemek ve hemen üst yetkililere haber vermek", "Tüm sunucu üyelerini kicklemek", "Kendi hesabını kapatmak"],
      correctIndex: 1
    },
    {
      question: "Bir üye sunucunun adaletsiz olduğunu iddia ederek sohbette isyan çıkartmaya ve kriz yaratmaya çalışırsa ne yapmalısınız?",
      options: ["Onu desteklemek", "Sohbette tartışmaya girmeyip destek bileti (ticket) açarak şikayetini iletmesini söylemek", "Üyeyi hemen sunucudan banlamak", "Ona özelden kızmak"],
      correctIndex: 1
    },
    {
      question: "Bir moderatör arkadaşınızın genel sohbette bir üyeyle hararetli bir kavgaya tutuştuğunu fark ederseniz nasıl davranmalısınız?",
      options: ["Moderatör arkadaşınızı destekleyip üyeye saldırmak", "Kavgayı genel sohbette büyütmeden özelden arkadaşınızı uyarmak ve üst yönetime bildirmek", "İkisini de engellemek", "Kavgayı izleyip keyif almak"],
      correctIndex: 1
    },
    {
      question: "Bir üye kuralları ihlal ettikten sonra size DM'den hakaret edip tehditler savurursa kriz anında tepkiniz ne olmalıdır?",
      options: ["Aynı şekilde hakaret etmek", "Cevap vermeyip ekran görüntüsü alarak durumu üst yönetime raporlamak", "Üyeyi Roblox grubundan silmek", "Ona sunucu şifresini vermek"],
      correctIndex: 1
    },
    {
      question: "Yanlışlıkla bir üyeye gereksiz veya hatalı ceza verdiğinizi fark ettiğinizde bu durumu nasıl yönetirsiniz?",
      options: ["Hatayı gizlemeye çalışmak", "Hatayı kabul edip durumu üst yetkililere bildirmek ve cezanın düzeltilmesini istemek", "Üyeyi tamamen sunucudan banlayarak delili yok etmek", "Hiçbir şey yapmamak"],
      correctIndex: 1
    },
    {
      question: "Kriz anlarında yetkilinin sakin kalması neden en önemli kuraldır?",
      options: ["Sadece kurucunun gözüne girmek için", "Doğru ve adil kararlar vererek krizin daha da büyümesini engellemek için", "Daha hızlı EkoCoin kasmak için", "Rolünün rengini korumak için"],
      correctIndex: 1
    },
    {
      question: "Sohbet kanalında dini veya siyasi tartışma çıkıp üyeler birbirine girmeye başladığında ilk kriz yönetimi adımı nedir?",
      options: ["Tartışmaya katılanları susturmak, mesajları temizlemek ve konuyu kapatmak", "Kendi siyasi görüşünüzü yazarak tartışmaya dahil olmak", "Kanalları tamamen silmek", "Yalnızca izlemek"],
      correctIndex: 0
    },
    {
      question: "Bir üye bilet (ticket) açıp acil olduğunu söyleyerek yetkililere bağırıp çağırdığında nasıl yaklaşmalısınız?",
      options: ["Ona aynı tonda bağırmak", "Sakinleşmesini rica edip sorunun ne olduğunu profesyonelce anlamaya çalışmak", "Bileti hemen kapatmak", "Üyeyi engellemek"],
      correctIndex: 1
    }
  ],
  3: [ // Target Level 3 (Gelişmiş Personel) - Crisis Management
    {
      question: "Stajyer bir yetkilinin bir kriz anında panikleyerek hatalı kararlar verdiğini görürseniz ne yapmalısınız?",
      options: ["Onu genel sohbette rezil etmek", "Sohbette durumu bozmadan krize müdahale etmek, sonrasında özelden stajyere doğrusunu anlatmak", "Yöneticilere şikayet edip atılmasını istemek", "Görmezden gelip geçmek"],
      correctIndex: 1
    },
    {
      question: "Genel sohbette büyük bir tartışma patlak verdiğinde ve mod etiketleri yağmaya başladığında ilk kriz önlemi ne olmalıdır?",
      options: ["Kanalı tamamen silmek", "Yavaş modu açarak mesaj akışını kontrol altına almak ve tarafları uyarmak", "Yetkili sohbetine kaçmak", "Herkese ban atmak"],
      correctIndex: 1
    },
    {
      question: "Destek biletinde bir üye size sunucu kurucularına hakaret ederek kışkırtma yaptığında bu krizi nasıl yönetirsiniz?",
      options: ["Provokasyona gelmeden bilet kurallarına göre işlem yapmak ve kanıtları kaydetmek", "Kurucuya haber verip üyeye küfretmek", "Bileti kapatıp silmek", "Üyeyi engellemek"],
      correctIndex: 0
    },
    {
      question: "Sunucuya bot hesaplar tarafından organize bir spam saldırısı yapıldığında gelişmiş yetkili olarak ilk göreviniz nedir?",
      options: ["Sunucuyu tamamen silmek", "Saldırganları susturmak/engellemek ve üst yetkilileri acilen bilgilendirmek", "Sohbette laklak yapmak", "Hiçbir şeye karışmamak"],
      correctIndex: 1
    },
    {
      question: "Bir üye haksız yere banlandığını söyleyerek sohbette kaos yaratmaya çalışırsa kriz yönetimi politikanız ne olmalıdır?",
      options: ["Onunla genel sohbette tartışmak", "İtiraz kanallarını / ticket açmasını söyleyerek mesajlarını silmek ve sohbette polemiğe girmemek", "Üyeyi tekrar banlamak", "Onu engellemek"],
      correctIndex: 1
    },
    {
      question: "Yetkili sohbetinde iki ekip arkadaşınız arasında ciddi bir kriz çıktığını görürseniz gelişmiş personel olarak ne yaparsınız?",
      options: ["Taraf tutup kavgayı körüklemek", "Ortamı sakinleştirip konunun özelden veya üst yönetim eşliğinde çözülmesini tavsiye etmek", "Yöneticileri etiketleyerek kaosu büyütmek", "Kanalı susturmak"],
      correctIndex: 1
    },
    {
      question: "Sunucudaki popüler bir üye kuralları ihlal ettiğinde ve onun cezalandırılması üyeler arasında tepkiye yol açtığında kriz nasıl yönetilir?",
      options: ["Popüler üyeyi affederek", "Kuralın herkes için eşit olduğunu hatırlatıp provokatörleri susturarak", "Yetkiyi bırakarak", "Cezayı veren yetkiliyi suçlayarak"],
      correctIndex: 1
    },
    {
      question: "Destek talebinde (ticket) çözülemeyen teknik bir kriz oluştuğunda üyeye karşı tavrınız ne olmalıdır?",
      options: ["Bileti kapatıp üyeyi suçlamak", "Sakin kalmasını sağlayıp durumu üst birimlere aktaracağını kibarce iletmek", "Üyeyi engellemek", "Cevap vermeyi bırakmak"],
      correctIndex: 1
    },
    {
      question: "Bir üye sunucunun güvenliğini tehlikeye sokacak bir açığı sohbette ifşa etmeye çalışırsa ne yapılmalıdır?",
      options: ["Açığı test edip sohbette paylaşmak", "Mesajı anında silip üyeyi susturmak ve durumu hemen yönetime raporlamak", "Görmezden gelmek", "Üyeyi tebrik etmek"],
      correctIndex: 1
    },
    {
      question: "Kriz anında bir yetkili yetkilerini kötüye kullanır ve haksız cezalar verirse ne tür bir yaptırımla karşılaşır?",
      options: ["Hiçbir yaptırım uygulanmaz", "Rütbe düşürülmesi veya yetkili ekibinden tamamen ihraç edilmesi", "Puan ödülü alır", "Yönetici yapılır"],
      correctIndex: 1
    }
  ],
  4: [ // Target Level 4 (Sekreter) - Crisis Management
    {
      question: "Destek biletlerinde (ticket) üyeler ile stajyerler arasında ciddi bir üslup krizi yaşandığını fark ettiğinizde Sekreter olarak yaklaşımınız ne olmalıdır?",
      options: ["Üyeyi doğrudan banlamak", "Bileti devralıp üyeyi sakinleştirmek, stajyer yetkiliyi ise özelden uyararak eğitmek", "Stajyeri genel sohbette ifşa etmek", "İzleyici kalmak"],
      correctIndex: 1
    },
    {
      question: "Sunucuda büyük bir raid (baskın) olduğunda ve üst yönetim aktif olmadığında sekreter olarak hangi kriz önlemini alırsınız?",
      options: ["Sunucuyu kilitleyip hiçbir şey yapmamak", "İlgili sohbet kanallarını kilitlemek / yavaş modu maksimuma getirmek ve güvenlik botunu devreye sokmak", "Sunucu kurucusunu uyandırmak için telefonla aramak", "Tüm rolleri silmek"],
      correctIndex: 1
    },
    {
      question: "Bir personelinizin sunucu kurallarını suistimal ettiğini ve bu durumun üyeler arasında ifşa edilerek krize dönüştüğünü görürseniz ne yaparsınız?",
      options: ["Personeli korumaya çalışmak", "Kanıtları toplayıp personeli geçici olarak askıya almak ve durumu acilen üst yönetime sunmak", "Konuyu görmezden gelmek", "Sohbette ifşayı desteklemek"],
      correctIndex: 1
    },
    {
      question: "Haftalık rapor tesliminde ekibinizde kriz çıkarsa ve kimse rapor yazmak istemezse sekreter olarak kriz yönetimi çözümünüz nedir?",
      options: ["Herkese doğrudan ceza puanı vermek", "Sorunları dinlemek, süreci kolaylaştırmak ve sorumlulukları hatırlatarak motivasyon sağlamak", "Raporları kendiniz yazmak", "Rapor sistemini tamamen iptal etmek"],
      correctIndex: 1
    },
    {
      question: "Sunucu kurallarında açık bulan bir üye bunu kullanarak sohbette kaos yaratırsa nasıl müdahale edersiniz?",
      options: ["Üyenin açığı kullanmasına izin vermek", "Üyeyi uyararak sohbetteki açığı kapatmak, kural güncellemesi için yönetime rapor sunmak", "Üyeyi tebrik etmek", "Sunucuyu kapatmak"],
      correctIndex: 1
    },
    {
      question: "Bir üyenin haksız yere cezalandırıldığına dair sunucuda ciddi bir karalama kampanyası başladığında kriz nasıl yönetilir?",
      options: ["Sessiz kalıp beklemek", "Resmi bir açıklama veya ticket üzerinden kanıtları sunarak üyeleri bilgilendirmek ve kışkırtıcıları susturmak", "Cezayı veren yetkiliyi suçlamak", "Karalama yapan herkesi banlamak"],
      correctIndex: 1
    },
    {
      question: "Birden fazla yetkilinin eş zamanlı istifa etmesiyle oluşan ekip krizinde ne yapmalısınız?",
      options: ["Siz de istifa etmelisiniz", "Mevcut ekibi organize edip iş bölümü yapmak ve yeni yetkili alımları için süreci hızlandırmak", "Tüm yetkili kanallarını silmek", "Ekibi suçlamak"],
      correctIndex: 1
    },
    {
      question: "Destek sisteminde (ticket) yığılma olduğunda ve üyeler geç cevap verilmesinden ötürü kriz çıkardığında ne yapılmalıdır?",
      options: ["Biletleri topluca kapatmak", "Diğer aktif birimleri yardıma çağırmak ve öncelikli biletleri belirleyip çözmek", "Üyeleri engellemek", "Cevap vermeyi bırakmak"],
      correctIndex: 1
    },
    {
      question: "Bir yetkilinin başka bir sunucuda karalama yaptığını ve bunun sunucumuza kriz getirdiğini görürseniz tavrınız ne olmalıdır?",
      options: ["Görmezden gelmek", "İlişkisini kesmek veya askıya alarak durumu resmi kanallardan üst yönetime iletmek", "O yetkiliyle kavga etmek", "O yetkiliyi savunmak"],
      correctIndex: 1
    },
    {
      question: "Sekreter rütbesinde kriz anında inisiyatif alırken sınırınız ne olmalıdır?",
      options: ["Sınırsız yetki kullanmak", "Sunucu güvenliğini koruyacak acil önlemleri almak ancak kalıcı kararları üst yönetime bırakmak", "Hiçbir inisiyatif almamak", "Kendi kurallarını koymak"],
      correctIndex: 1
    }
  ],
  5: [ // Target Level 5 (Kıdemli Sekreter) - Crisis Management
    {
      question: "Sunucu yönetiminde büyük bir sızıntı (leak) gerçekleştiğinde ve yetkili bilgileri ifşa olduğunda Kıdemli Sekreter olarak kriz yönetim planınız ne olur?",
      options: ["Bütün yetkili rollerini silmek", "Şüpheli hesapları askıya almak, sızıntı kaynağını tespit etmek ve ekibe sükunet çağrısı yapmak", "Yöneticileri suçlamak", "Sunucudan çıkmak"],
      correctIndex: 1
    },
    {
      question: "Genel Koordinatörlerin inaktif olduğu bir dönemde sunucuda büyük çaplı bir üye isyanı çıkarsa krizi nasıl kontrol altına alırsınız?",
      options: ["İsyanı görmezden gelmek", "Sakin ve resmi bir dille duyuru yayınlamak, isyanın elebaşlarını susturmak ve bilet kanalları üzerinden birebir görüşmeler yapmak", "İsyancılara hak vermek", "Sohbeti kalıcı olarak kapatmak"],
      correctIndex: 1
    },
    {
      question: "Moderatör ekibinin kendi içinde gruplaşarak birbirine karşı kriz çıkardığını ve işleri aksattığını görürseniz ne yaparsınız?",
      options: ["Bir tarafı tutup diğer grubu sunucudan atmak", "Grupların liderleriyle toplantı yapmak, uyarılarda bulunmak ve gerekirse huzursuzluk çıkaranları ekipten uzaklaştırmak", "Yetkili kanalında kavga etmek", "Hiçbir şeye karışmamak"],
      correctIndex: 1
    },
    {
      question: "Sunucuya yapılan DDoS veya bot saldırısı gibi teknik kriz anlarında Kıdemli Sekreter olarak moderasyon ekibini nasıl yönlendirirsiniz?",
      options: ["Herkesi sunucudan banlatmak", "Ekibe panik yapmamalarını söylemek, kanalları kilitlemek ve teknik ekibin müdahale etmesini beklerken üyeleri bilgilendirmek", "Sohbette geyik yapmak", "Yetkiyi bırakmak"],
      correctIndex: 1
    },
    {
      question: "Bir üst yöneticinin (Genel Koordinatör) kuralları ağır şekilde ihlal ettiğini ve kriz yarattığını fark ederseniz ne yapmalısınız?",
      options: ["Onu genel sohbette ifşa etmek", "Diğer üst yöneticiler ve sunucu kurucuları ile kanıtları paylaşarak idari sürecin başlamasını sağlamak", "Ona şantaj yapmak", "Görmezden gelmek"],
      correctIndex: 1
    },
    {
      question: "EkoCoin sisteminde büyük bir açık (exploit) bulunup bazı yetkililerce sömürüldüğünde kriz yönetimi adımınız ne olmalıdır?",
      options: ["Açığı kendiniz de kullanmak", "İlgili yetkililerin puanlarını sıfırlayıp yetkilerini askıya almak, açığı teknik ekibe bildirmek", "Sistemi tamamen kapatıp silmek", "Yetkilileri tebrik etmek"],
      correctIndex: 1
    },
    {
      question: "Sunucudaki kriz anında moderatörlerin yetersiz kalması sonucu üyelerin güveninin sarsılmasını engellemek için ne yapılmalıdır?",
      options: ["Ekibi tamamen değiştirmek", "Eğitimleri artırmak, kriz anı prosedürlerini netleştirmek ve yönetim olarak sahada aktif rol almak", "Üyeleri susturmak", "Hataları inkar etmek"],
      correctIndex: 1
    },
    {
      question: "Kriz durumlarında esnek yönetim sergilemek ile kuralcı olmak arasındaki dengeyi nasıl kurarsınız?",
      options: ["Kuralları tamamen yok sayarak", "Temel güvenlik kurallarından taviz vermeden, üye memnuniyeti için yapıcı çözümler üreterek", "Sadece kuralcı olarak", "Üyeleri sunucudan atarak"],
      correctIndex: 1
    },
    {
      question: "Ekibin haftalık raporlarında ciddi performans düşüşü ve kriz sinyalleri varsa ne yapılmalıdır?",
      options: ["Herkese ceza puanı yağdırmak", "Performans düşüşünün kök nedenini araştırmak, motivasyon ve ödül sistemlerini devreye sokmak", "Raporları iptal etmek", "Ekibi suçlamak"],
      correctIndex: 1
    },
    {
      question: "Kıdemli Sekreter rütbesinde başarılı bir kriz yönetiminin en önemli kriteri nedir?",
      options: ["Çok fazla ban atmak", "Krizin en az hasarla, sunucu düzenini bozmadan ve ekibin motivasyonunu kaybettirmeden çözülmesidir", "Kurucunun onayını almak", "En popüler yetkili olmak"],
      correctIndex: 1
    }
  ],
  6: [ // Target Level 6 (Genel Koordinatör) - Crisis Management
    {
      question: "Sunucu kurucularının olmadığı bir anda sunucunun ana kanallarının silinmesi veya hacklenmesi gibi en kritik kriz anında Genel Koordinatör olarak ilk aksiyonunuz ne olmalıdır?",
      options: ["Sunucuyu tamamen silmek", "Botların yetkilerini kısmak, sunucu şablonunu/yedekleri hazırlamak ve moderasyon ekibine acil görev dağılımı yapmak", "Kurucuları beklemek için hiçbir şey yapmamak", "Sohbete gidip geyik yapmak"],
      correctIndex: 1
    },
    {
      question: "Tüm moderatör ekibinin katıldığı toplu bir boykot veya istifa krizi yaşandığında nasıl bir strateji izlersiniz?",
      options: ["Tüm ekibi doğrudan sunucudan yasaklamak", "Talepleri dinlemek için acil toplantı düzenlemek, haklı talepleri çözüme kavuşturmak ve sunucu güvenliği için geçici ekipler kurmak", "Boykotu görmezden gelmek", "Ekibi kuruculara şikayet etmek"],
      correctIndex: 1
    },
    {
      question: "AI Sınav sisteminin manipüle edildiği veya soruların dışarı sızdırıldığı bir kriz durumunda ne yaparsınız?",
      options: ["Sistemi görmezden gelmek", "Sınav sistemini askıya almak, sızdıranı ekipten ihraç etmek ve AI promptlarını/soruları tamamen yenilemek", "Sınavı iptal edip herkesi terfi ettirmek", "Sınavı yapan botu silmek"],
      correctIndex: 1
    },
    {
      question: "Sunucudaki iki büyük birim (örn: Ses Birimi ve Sohbet Birimi) arasında çıkan rekabet krizini nasıl çözersiniz?",
      options: ["Birimlerden birini tamamen kapatmak", "Birim liderleriyle toplantı yapıp ortak hedefler belirlemek, rollerin sınırlarını netleştirmek ve işbirliğini teşvik etmek", "Birimleri birbirine düşürmek", "Hiçbir şey yapmamak"],
      correctIndex: 1
    },
    {
      question: "Kriz yönetimi eğitimleri hazırlarken yeni yetkililerin öğrenmesi gereken en kritik kriz protokolü nedir?",
      options: ["İstediği an ban atabilmek", "Yetki zincirine saygı, soğukkanlılık, delil toplama yeteneği ve hızlı raporlama", "Yalnızca üstleriyle sohbet etmek", "Sohbeti kilitlemek"],
      correctIndex: 1
    },
    {
      question: "Üst düzey bir kriz sonrasında ekibin ve üyelerin moralini geri kazanmak için ne tür adımlar atılmalıdır?",
      options: ["Herkesi susturmak", "Şeffaf bir açıklama yapmak, ödüllü etkinlikler düzenlemek ve krizden çıkarılan dersleri paylaşmak", "Krizi inkar etmek", "Ekibi suçlamak"],
      correctIndex: 1
    },
    {
      question: "Roblox grubu ile Discord rolleri arasındaki senkronizasyon bozulup büyük bir rol krizi çıktığında ne yapılmalıdır?",
      options: ["Grubu silmek", "Senkronizasyon botunu durdurup rolleri manuel kontrol altına almak ve teknik ekiple sorunu çözene kadar geçici kural koymak", "Discord sunucusunu kapatmak", "Üyeleri Roblox'ta cezalandırmak"],
      correctIndex: 1
    },
    {
      question: "Kriz yönetiminde 'Önleyici Moderasyon' yaklaşımı neyi ifade eder?",
      options: ["Herkesi susturarak kriz çıkmasını önlemek", "Kriz daha çıkmadan kuralları netleştirmek, riskli üyeleri izlemek ve ekibi kriz senaryolarına hazırlamak", "Hiçbir şey yapmamak", "Ceza vermeden sadece izlemek"],
      correctIndex: 1
    },
    {
      question: "Genel Koordinatör olarak sunucu genelinde uygulanacak yeni bir ceza sisteminin getireceği tepki krizini nasıl yönetirsiniz?",
      options: ["Tepki gösterenleri banlayarak", "Değişikliğin neden gerekli olduğunu şeffafça açıklamak, geri bildirimleri toplamak ve aşamalı geçiş yapmak", "Tepkilere boyun eğip sistemi kaldırmak", "Gizlice yürürlüğe sokmak"],
      correctIndex: 1
    },
    {
      question: "Bir Genel Koordinatörün kriz anında yapabileceği en büyük hata nedir?",
      options: ["Ekip arkadaşlarından yardım istemek", "Panik yapmak, fevri kararlar almak ve ekibiyle iletişimi koparmaktır", "Yedekleme yapmak", "Kanalları kilitlemek"],
      correctIndex: 1
    }
  ]
};

const DIFFICULTY_INFO = {
  2: { difficulty: 'Kolay / Temel Düzey', focus: 'Kriz yönetimi, gergin ve kışkırtıcı durumlarda temel sükunet ve müdahale, basit kriz anlarında soğukkanlılığı koruma.' },
  3: { difficulty: 'Orta Düzey', focus: 'Orta düzey kriz yönetimi, sohbette patlak veren kavgaları ve kaos ortamını yatıştırma, kural ihlallerini manipüle eden üyelere karşı kriz müdahalesi.' },
  4: { difficulty: 'Zor Düzey', focus: 'Kriz yönetimi, destek biletlerindeki (ticket) hakaret ve provokasyon krizlerini çözme, ekip içi krizler ve şikayetlerde arabuluculuk.' },
  5: { difficulty: 'Çok Zor Düzey', focus: 'Gelişmiş kriz yönetimi, sunucu genelinde organize troll saldırıları veya kural suistimalleri gibi ciddi kriz anlarında moderatör ekibini yönetme.' },
  6: { difficulty: 'Uzman / En Üst Düzey', focus: 'En üst düzey kriz yönetimi, sunucu baskınları (raid), güvenlik açıkları, kurallar arası çelişkiler ve ciddi yönetim krizlerinde stratejik kriz yönetimi kararları.' }
};

async function generateExamQuestions(targetLevel = 6) {
  const diff = DIFFICULTY_INFO[targetLevel] || DIFFICULTY_INFO[6];
  const prompt = [
    {
      role: 'user',
      content: `Sen EkoYıldız Moderatör Ekibi eğitim sorumlusu bir yapay zekasın. Seviye ${targetLevel} rütbesine terfi edecek yetkililer için 10 soruluk çoktan seçmeli bir sınav hazırlaman gerekiyor.
Sınavın Zorluk Derecesi: ${diff.difficulty}
Konu Odakları (Mutlaka Kriz Yönetimi odaklı olmalı): ${diff.focus}

Sınavdaki tüm 10 soru mutlaka kriz yönetimi (crisis management), gergin üyeleri sakinleştirme, sunucu baskınları (raid), kaos, provokasyon ve manipülasyon anlarında doğru kararlar verme ve yetkili/üye arasındaki krizleri yönetme konularında olmalıdır.

Senden yanıtı SADECE ve SADECE aşağıdaki JSON formatında vermeni istiyorum. Markdown, açıklama veya başka hiçbir metin ekleme. Sadece geçerli bir JSON array'i dönder.

JSON formatı:
[
  {
    "question": "Soru metni...",
    "options": ["Seçenek A", "Seçenek B", "Seçenek C", "Seçenek D"],
    "correctIndex": 0
  },
  ... (10 adet soru)
]`
    }
  ];

  try {
    const aiResponse = await chatWithAI(prompt, 'Sen bir JSON üretecisin. Sadece geçerli JSON array döndür.');
    const cleaned = aiResponse.replace(/```json|```/gi, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length === 10) {
      return parsed;
    }
    console.warn('[aiExamService] AI did not return exactly 10 questions, falling back.');
  } catch (err) {
    console.error('[aiExamService] Failed to generate AI questions, using fallback:', err.message);
  }
  return FALLBACK_QUESTIONS_BY_LEVEL[targetLevel] || FALLBACK_QUESTIONS_BY_LEVEL[6];
}

async function sendQuestion(user, progress) {
  const index = progress.exam.currentQuestionIndex;
  const q = progress.exam.questions[index];

  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle(`📝 Genel Koordinatör Yetkinlik Sınavı — Soru ${index + 1}/10`)
    .setDescription(`**${q.question}**\n\n` + q.options.map((opt, i) => `**${String.fromCharCode(65 + i)})** ${opt}`).join('\n'))
    .setFooter({ text: 'Lütfen aşağıdaki butonlardan birini seçerek cevabınızı verin.' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    q.options.map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`exam_ans_${index}_${i}`)
        .setLabel(String.fromCharCode(65 + i))
        .setStyle(ButtonStyle.Primary)
    )
  );

  await user.send({ embeds: [embed], components: [row] }).catch(err => {
    console.error(`[aiExamService] Failed to send question to user ${progress.userId}:`, err.message);
  });
}

async function handleAnswerInteraction(interaction, client) {
  const customId = interaction.customId;
  if (!customId.startsWith('exam_ans_')) return;

  await interaction.deferUpdate().catch(() => { });

  const userId = interaction.user.id;
  const progress = await StaffProgress.findOne({ userId });
  if (!progress || progress.exam.status !== 'ongoing') {
    return interaction.followUp({ content: '❌ Aktif bir sınavınız bulunmuyor.', ephemeral: true }).catch(() => { });
  }

  const parts = customId.split('_');
  const questionIndex = parseInt(parts[2]);
  const selectedIndex = parseInt(parts[3]);

  // Double-click veya eski sorulardan gelen buton tıklamalarını engelle
  if (questionIndex !== progress.exam.currentQuestionIndex) {
    return;
  }

  // Sorunun butonlarını kaldırarak tekrar tıklanmasını önle
  await interaction.editReply({ components: [] }).catch(() => { });

  progress.exam.answers.push(selectedIndex);
  progress.exam.currentQuestionIndex += 1;

  const targetLevel = progress.level + 1;

  if (progress.exam.currentQuestionIndex < 10) {
    await progress.save();
    const user = await client.users.fetch(userId).catch(() => null);
    if (user) {
      await sendQuestion(user, progress);
    }
  } else {
    // Sınav bitti, derecelendir
    let correctCount = 0;
    const questions = progress.exam.questions;
    const answers = progress.exam.answers;

    for (let i = 0; i < 10; i++) {
      if (answers[i] === questions[i].correctIndex) {
        correctCount++;
      }
    }

    const passed = correctCount >= 8;
    progress.exam.lastExamAttempt = new Date();

    if (passed) {
      progress.exam.status = 'passed';
      await progress.save();

      // Terfi ettir!
      const { promote } = require('./staffSystem');
      await promote(progress, client).catch(err => {
        console.error('[aiExamService] Promotion failed after exam:', err.message);
      });
    } else {
      // Başarısız: Yeniden planla (Sınav durumunu scheduled yapıyoruz ki scheduler yarın tetiklesin)
      progress.exam.status = 'scheduled';

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      progress.exam.scheduledAt = tomorrow;
      progress.exam.currentQuestionIndex = 0;
      progress.exam.answers = [];

      // Bir sonraki deneme için yeni sorular üret
      try {
        progress.exam.questions = await generateExamQuestions(targetLevel);
      } catch (err) {
        console.error('[aiExamService] Failed to generate new questions for retake, using fallback:', err.message);
        progress.exam.questions = FALLBACK_QUESTIONS_BY_LEVEL[targetLevel] || FALLBACK_QUESTIONS_BY_LEVEL[6];
      }

      await progress.save();

      const failEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Sınav Sonucu: Başarısız')
        .setDescription(
          `Sınavı maalesef tamamlayamadın. Rütbe atlamak için en az **8 doğru** yapman gerekiyordu.\n\n` +
          `📊 **Senin Doğrun:** ${correctCount} / 10\n\n` +
          `📅 **Tekrar Sınav Zamanı:** Yarın öğlen 12:00\n\n` +
          `Lütfen kuralları ve yönetim standartlarını tekrar gözden geçirerek yarınki sınava hazırlanın. Başarılar! 💪`
        )
        .setFooter({ text: 'Eko Yıldız • Personel Sınav Sistemi' })
        .setTimestamp();

      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        await user.send({ embeds: [failEmbed] }).catch(() => { });
      }
    }
  }
}

async function checkActiveExams(client) {
  try {
    const now = new Date();
    // level 1 ile 5 arasındaki tüm scheduled olan sınavları bul
    const allScheduled = await StaffProgress.find({
      level: { $gte: 1, $lte: 5 },
      'exam.status': 'scheduled',
      'exam.scheduledAt': { $lte: now }
    });

    const { ROLE_NAMES } = require('./staffSystem');

    for (const progress of allScheduled) {
      progress.exam.status = 'ongoing';
      progress.exam.currentQuestionIndex = 0;
      progress.exam.answers = [];
      await progress.save();

      const user = await client.users.fetch(progress.userId).catch(() => null);
      if (user) {
        const targetLevel = progress.level + 1;
        const targetRoleName = ROLE_NAMES[targetLevel] || `Seviye ${targetLevel}`;

        const startEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🚀 Sınav Zamanı Geldi!')
          .setDescription(
            `Merhaba <@${progress.userId}>, **${targetRoleName}** yetkinlik sınavı süreniz başladı!\n\n` +
            `Sınav 10 sorudan oluşmaktadır ve geçmek için en az **8 doğru** yapmanız gerekmektedir.\n` +
            `Sorular tek tek DM yoluyla iletilecektir. Sınavı başlatmak için aşağıdaki butona tıklayın!`
          )
          .setFooter({ text: 'Eko Yıldız • Personel Sınav Sistemi' })
          .setTimestamp();

        const startRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('exam_start_trigger')
            .setLabel('▶️ Sınavı Başlat')
            .setStyle(ButtonStyle.Success)
        );

        await user.send({ embeds: [startEmbed], components: [startRow] }).catch(err => {
          console.error(`[aiExamService] Sınav başlangıcı DM gönderilemedi (${progress.userId}):`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('[aiExamService] checkActiveExams error:', err.message);
  }
}

async function handleStartTrigger(interaction) {
  if (interaction.customId !== 'exam_start_trigger') return;
  await interaction.deferUpdate().catch(() => { });

  const userId = interaction.user.id;
  const progress = await StaffProgress.findOne({ userId });
  if (!progress || progress.exam.status !== 'ongoing') {
    return interaction.followUp({ content: '❌ Aktif sınavınız bulunamadı veya süre dolmuş.', ephemeral: true }).catch(() => { });
  }

  // "Sınavı Başlat" butonunu kaldırarak tekrar tıklanmasını önle
  await interaction.editReply({ components: [] }).catch(() => { });

  // İlk soruyu gönder
  await sendQuestion(interaction.user, progress);
}

module.exports = {
  generateExamQuestions,
  sendQuestion,
  handleAnswerInteraction,
  checkActiveExams,
  handleStartTrigger
};
