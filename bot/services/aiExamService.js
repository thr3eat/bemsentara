'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');
const { chatWithAI } = require('./aiService');

const FALLBACK_QUESTIONS_BY_LEVEL = {
  2: [ // Target Level 2 (Personel) - Easy
    {
      question: "Bir yetkili olarak genel sohbette uymanız gereken en temel kural nedir?",
      options: ["Diğer üyelerle tartışmaya girmemek ve sakin kalmak", "Kuralları ihlal edenlere anında küfür etmek", "Hiçbir şeye karışmayıp sadece izlemek", "Sohbeti tamamen kilitlemek"],
      correctIndex: 0
    },
    {
      question: "Sohbette spam (arka arkaya hızlı mesaj yazma) yapan bir üyeye ilk ne yapmalısınız?",
      options: ["Doğrudan sunucudan yasaklamak", "/sustur komutu ile uyararak susturmak", "Mesajını görmezden gelmek", "Üyeyi gruptan atmak"],
      correctIndex: 1
    },
    {
      question: "Roblox grubunda Personel rütbesindeki bir yetkili hangi rank ID'sine sahip olmalıdır?",
      options: ["Rank 1 (Misafir)", "Rank 2 (Stajyer)", "Rank 3 (Personel)", "Rank 4 (Gelişmiş Personel)"],
      correctIndex: 2
    },
    {
      question: "EkoYıldız Moderatör Ekibi sunucusunda günlük aktif kalma zorunluluğu ne kadardır?",
      options: ["Zorunlu bir süre yoktur", "7 saat", "Rütbeye göre günlük gereksinim tablosunda belirtilen süre kadar", "Sadece hafta sonları aktiftir"],
      correctIndex: 2
    },
    {
      question: "Her gün cüzdanınıza otomatik/aktif olarak EkoCoin (E.C.) eklenmesi için ne yapmalısınız?",
      options: ["Günde bir kez /profil yazmak", "Günlük selamlaşma ve ses aktifliği görevlerini tamamlamak", "Hiçbir şey yapmamak", "Başka bir yetkiliye puan aktarmak"],
      correctIndex: 1
    },
    {
      question: "Personel rütbesinin Discord'daki rol ismi aşağıdakilerden hangisidir?",
      options: ["👔 Personel", "🎓 Stajyer Personel", "⭐ Gelişmiş Personel", "👑 Sekreter"],
      correctIndex: 0
    },
    {
      question: "Bir üye size özel mesajdan (DM) sunucu kuralları hakkında soru sorarsa ne yapmalısınız?",
      options: ["Soruyu cevapsız bırakıp engellemek", "Kibarca kurallar kanalını göstermek ve yardımcı olmak", "Yöneticileri etiketlemesini söylemek", "Üyeye kızmak"],
      correctIndex: 1
    },
    {
      question: "Rütbe terfileri nasıl gerçekleşir?",
      options: ["Sadece yöneticilerden rica ederek", "Sistemdeki tüm görev ve aktiflik şartlarını tamamlayıp sınavı geçerek", "Hiçbir şey yapmadan bekleyerek", "Rastgele çekilişle"],
      correctIndex: 1
    },
    {
      question: "Günlük selamlaşma (recordGreet) görevi nasıl tamamlanır?",
      options: ["Genel sohbete ilk selamı vererek", "Yetkili kanalına günün ilk selamını göndererek", "Özel mesajla yöneticilere selam vererek", "Sadece ses kanalında selam vererek"],
      correctIndex: 1
    },
    {
      question: "Yetkililikten kendi isteğinizle ayrılmak isterseniz hangi komutu kullanırsınız?",
      options: ["/istifa", "/cikis", "/tenzilat", "/odulver"],
      correctIndex: 0
    }
  ],
  3: [ // Target Level 3 (Gelişmiş Personel) - Medium
    {
      question: "Gelişmiş Personel olarak stajyer bir yetkilinin hata yaptığını görürseniz ne yapmalısınız?",
      options: ["Onu sertçe uyarmak ve rezil etmek", "Kibarca doğrusunu anlatmak ve yol göstermek", "Yöneticilere şikayet edip atılmasını istemek", "Görmezden gelip geçmek"],
      correctIndex: 1
    },
    {
      question: "Bir üye sohbette dini veya siyasi tartışma başlatırsa yetkili olarak tavrınız ne olmalıdır?",
      options: ["Siz de kendi görüşünüzü yazıp tartışmaya katılmalısınız", "Tartışmayı hızlıca sonlandırıp ilgili kişileri uyarmak/susturmak", "Kanalı tamamen silmek", "Yalnızca izlemek"],
      correctIndex: 1
    },
    {
      question: "Roblox grubunda Gelişmiş Personel rütbesinin rank ID'si kaçtır?",
      options: ["Rank 2", "Rank 3", "Rank 4", "Rank 7"],
      correctIndex: 2
    },
    {
      question: "Ticket (Destek Bileti) çözerken en çok neye dikkat etmelisiniz?",
      options: ["Bileti hızlıca kapatmaya", "Üyeye karşı nazik olmaya ve sorunu tam olarak çözmeye", "Üyeyi azarlamaya", "Hiç kimseye cevap vermemeye"],
      correctIndex: 1
    },
    {
      question: "Sistemde ardışık kaç gün görev yapılmadığında yetki duraklatılır/alınır?",
      options: ["1 gün", "3 gün", "5 gün", "10 gün"],
      correctIndex: 1
    },
    {
      question: "Haftalık personel raporları (weeklyReports) kimin terfi etmesi için gereklidir?",
      options: ["Sadece Stajyerler", "Stajyerlikten Personelliğe geçişte", "Personellikten Gelişmiş Personelliğe ve üstüne geçişte", "Tüm normal üyeler"],
      correctIndex: 2
    },
    {
      question: "EkoCoin cüzdanınızdaki parayla mağazadan (ekocoin_magaza) ne satın alabilirsiniz?",
      options: ["Özel rol renkleri, izin günleri ve kozmetikler", "Yönetici yetkileri", "Diğer yetkilileri banlama hakkı", "Robux"],
      correctIndex: 0
    },
    {
      question: "Sohbette bir yetkiliyle fikir ayrılığına düşerseniz ne yapmalısınız?",
      options: ["Genel sohbette kavga etmelisiniz", "Özelden veya yetkili kanalından sakin bir şekilde konuşarak çözmeli, gerekirse üst yönetime bildirmelisiniz", "Onu sunucudan banlamalısınız", "Sohbeti kilitlemelisiniz"],
      correctIndex: 1
    },
    {
      question: "Gelişmiş Personel için günlük ses kanalı aktiflik şartı en az kaç dakikadır?",
      options: ["10 dakika", "20 dakika", "30 dakika", "60 dakika"],
      correctIndex: 2
    },
    {
      question: "Destek biletinde (ticket) size hakaret eden bir üyeye karşı ne yapmalısınız?",
      options: ["Aynı şekilde karşılık verip hakaret etmelisiniz", "Sakin kalarak durumu log kaydıyla üst yöneticilere bildirmelisiniz", "Bileti silip üyeyi engellemelisiniz", "Sohbeti kapatmalısınız"],
      correctIndex: 1
    }
  ],
  4: [ // Target Level 4 (Sekreter) - Hard
    {
      question: "Sekreter rütbesinin en temel sorumluluklarından biri hangisidir?",
      options: ["Sadece sohbette takılmak", "Ticket kalitesini denetlemek, stajyerleri eğitmek ve haftalık personel raporu hazırlamak", "Tüm sunucuyu tek başına yönetmek", "Roblox grubunu satmak"],
      correctIndex: 1
    },
    {
      question: "Bir personelin haftalık raporlarını düzenli teslim etmediğini fark ederseniz ne yapmalısınız?",
      options: ["Onu doğrudan gruptan atmalısınız", "Durumu analiz edip uyarılmasını sağlamak için üst yönetime bildirmelisiniz", "Hiçbir şey yapmamalısınız", "Ona kızmalısınız"],
      correctIndex: 1
    },
    {
      question: "Roblox grubunda Sekreter rütbesinin rank ID'si kaçtır?",
      options: ["Rank 3", "Rank 4", "Rank 7", "Rank 8"],
      correctIndex: 2
    },
    {
      question: "Sekreter rütbesindeki bir personelin günlük ses aktifliği en az kaç dakikadır?",
      options: ["30 dakika", "60 dakika", "90 dakika", "120 dakika"],
      correctIndex: 1
    },
    {
      question: "Bir yetkili sistem kurallarını suistimal ediyor veya EkoCoin hilesi yapıyorsa ne yapılmalıdır?",
      options: ["Sessiz kalıp ortak olunmalıdır", "Kanıtlarla birlikte durumu derhal üst yöneticilere ve log sistemine iletmelisiniz", "Onu genel sohbette rezil etmelisiniz", "Onun yerine de görev yapmalısınız"],
      correctIndex: 1
    },
    {
      question: "Yönetici izni olmadan bir personelin rütbe atlaması mümkün müdür?",
      options: ["Evet, sistem otomatik yapar", "Hayır, tüm koşulları tamamlasa bile son kararı sistem ve yöneticiler verir ve sınav sürecinden geçer", "Sadece Roblox grubundan talep edilirse mümkündür", "Evet, puanı yetiyorsa doğrudan geçer"],
      correctIndex: 1
    },
    {
      question: "Sekreterlik görevindeyken stajyer ekibin motivasyonunu artırmak için ne yapabilirsiniz?",
      options: ["Onlara sürekli emirler vermek", "Sorularını yanıtlamak, onlara rehberlik etmek ve yapıcı geri bildirimlerde bulunmak", "Onların görevlerini kendiniz yapmak", "Görevlerini yapmadıklarında doğrudan banlamak"],
      correctIndex: 1
    },
    {
      question: "Sunucudaki güvenlik bypass veya yetkili istisnalarını denetlemek kimin görevidir?",
      options: ["Stajyerlerin", "Yalnızca normal üyelerin", "Sekreterler ve üst düzey yönetim ekibinin", "Roblox destek ekibinin"],
      correctIndex: 2
    },
    {
      question: "Haftalık personel raporları neden kritik öneme sahiptir?",
      options: ["Yetkililerin aktifliğini, çözülen ticketları ve genel performansı üst yönetime raporlamak için", "Boş zaman geçirmek için", "Sohbette mesaj kasmak için", "Üyelerin şikayetlerini silmek için"],
      correctIndex: 0
    },
    {
      question: "Sekreter rütbesi için günlük selamlaşma gereksinimi en az kaçtır?",
      options: ["4x", "6x", "10x", "15x"],
      correctIndex: 2
    }
  ],
  5: [ // Target Level 5 (Kıdemli Sekreter) - Very Hard
    {
      question: "Kıdemli Sekreter rütbesinin temel görevi nedir?",
      options: ["Yöneticilerle koordineli çalışmak, tüm moderatör ekibini denetlemek ve yönetmek", "Sadece oyun oynamak", "Roblox grubunu tamamen silmek", "Biletlerin tamamını tek başına çözmek"],
      correctIndex: 0
    },
    {
      question: "Bir Sekreterin yetkilerini kötüye kullandığını tespit ederseniz ne yapmalısınız?",
      options: ["Görmezden gelmelisiniz", "Kanıtları toplayıp durumu derhal üst yönetim ile paylaşmalı ve idari işlem başlatmalısınız", "Onu doğrudan sunucudan banlamalısınız", "Onu sohbette tehdit etmelisiniz"],
      correctIndex: 1
    },
    {
      question: "Roblox grubunda Kıdemli Sekreter (Yönetici) rütbesinin rank ID'si kaçtır?",
      options: ["Rank 4", "Rank 7", "Rank 8", "Rank 9"],
      correctIndex: 2
    },
    {
      question: "Kıdemli Sekreter rütbesindeki bir yetkili günlük ses kanalında en az kaç dakika kalmalıdır?",
      options: ["30 dakika", "60 dakika", "90 dakika", "120 dakika"],
      correctIndex: 2
    },
    {
      question: "Tüm moderatör ekibinin haftalık performansını değerlendirirken hangi metriklere bakmalısınız?",
      options: ["Çözülen ticket sayısı, sohbet aktifliği, ses süresi, uyarı durumları ve rapor teslim oranları", "Sadece Roblox grubundaki arkadaş listesine", "Dış görünüşlerine", "Hiçbir metriğe bakılmaz"],
      correctIndex: 0
    },
    {
      question: "Sistemde 3 gün görev yapmayan bir yetkilinin yetkileri nasıl duraklatılır?",
      options: ["Yönetici manuel olarak yetkiyi alır", "Sistem otomatik olarak tüm yetkili ve moderasyon rollerini temizler ve DM uyarısı atar", "Hiçbir şey yapılmaz", "Roblox grubu üzerinden şikayet edilir"],
      correctIndex: 1
    },
    {
      question: "Ekip içinde moral ve motivasyon düşüklüğü yaşanıyorsa Kıdemli Sekreter olarak ilk adımınız ne olmalıdır?",
      options: ["Herkese ceza ve uyarı yağdırmak", "Birebir görüşmeler veya toplantılarla sorunları dinlemek, motivasyon etkinlikleri/ödüllendirmeler planlamak", "İstifa etmek", "Görmezden gelip ekibi suçlamak"],
      correctIndex: 1
    },
    {
      question: "Yetkili cüzdanındaki EkoCoin (E.C.) puanlarının dağıtımı ve doğruluğunu denetlemek kimin yetkisindedir?",
      options: ["Stajyer personellerin", "Normal sunucu üyelerinin", "Kıdemli Sekreter ve üst düzey yöneticilerin", "Dışarıdan bir botun"],
      correctIndex: 2
    },
    {
      question: "Yeni bir kural ihlali tespit edildiğinde ve kural kitabında yer almadığında ne yapılmalıdır?",
      options: ["Kendi kafanıza göre ceza vermelisiniz", "Durumu üst yönetimle koordine edip yeni bir kural maddesi oluşturulmasını sağlamalısınız", "İhlali cezasız bırakmalısınız", "Kanalı silmelisiniz"],
      correctIndex: 1
    },
    {
      question: "Kıdemli Sekreter için günlük selamlaşma gereksinimi en az kaçtır?",
      options: ["6x", "10x", "12x", "15x"],
      correctIndex: 2
    }
  ],
  6: [ // Target Level 6 (Genel Koordinatör) - Expert
    {
      question: "Genel Koordinatör rütbesinin en üst düzeydeki sorumluluğu nedir?",
      options: ["Tüm personel ve moderasyon operasyonlarını koordine etmek, yeni personellerin sınav süreçlerini tasarlamak ve genel sunucu denetimini gerçekleştirmek", "Sadece ticket kanallarını izlemek", "Roblox grubunu yöneticiye devretmek", "Sadece sohbette aktif olmak"],
      correctIndex: 0
    },
    {
      question: "Yeni personeller için hazırlanan AI Sınav sisteminin temel amacı nedir?",
      options: ["Yetkililerin kuralları, Roblox ranklarını, ticket kalitesini ve liderlik vasıflarını tam olarak öğrendiğini adil şekilde ölçmek", "Personeli sunucudan soğutmak", "Sadece vakit doldurmak", "Rastgele insanları elemek"],
      correctIndex: 0
    },
    {
      question: "Roblox grubunda Genel Koordinatör rütbesinin rank ID'si kaçtır?",
      options: ["Rank 7", "Rank 8", "Rank 9", "Rank 201"],
      correctIndex: 2
    },
    {
      question: "Genel Koordinatör rütbesindeki bir yetkili günlük ses kanalında en az kaç dakika kalmalıdır?",
      options: ["60 dakika", "90 dakika", "120 dakika", "180 dakika"],
      correctIndex: 2
    },
    {
      question: "Sınavı geçemeyen (başarısız olan) bir personelin bir sonraki sınavı ne zaman planlanır?",
      options: ["3 gün sonra öğlen 12:00", "Bir sonraki gün öğlen 12:00", "Hemen o an", "1 hafta sonra"],
      correctIndex: 1
    },
    {
      question: "EkoYıldız Moderatör Ekibi ana sunucusunda Genel Koordinatör rütbesine atanan kişinin rol ID'si nedir?",
      options: ["1517651154220355836", "1517695716594683904", "1517656567481372772", "1419688146689593415"],
      correctIndex: 0
    },
    {
      question: "Sınavda başarılı kabul edilmek için 10 sorudan en az kaç tanesinin doğru yanıtlanması gerekir?",
      options: ["5", "6", "8", "10"],
      correctIndex: 2
    },
    {
      question: "Sınav süreci tamamlandığında, adayın testi geçmesi durumunda terfi işlemini hangi fonksiyon gerçekleştirir?",
      options: ["checkPromotion()", "promote()", "syncStaffRobloxRanks()", "addVoiceMinutes()"],
      correctIndex: 1
    },
    {
      question: "Genel Koordinatör için günlük selamlaşma gereksinimi en az kaçtır?",
      options: ["10x", "12x", "15x", "20x"],
      correctIndex: 2
    },
    {
      question: "Bir personelin aktiflik uyarısı aldığında sistemden rolünün tamamen alınması için ardışık kaç gün uyarılması gerekir?",
      options: ["1 gün", "2 gün", "3 gün", "5 gün"],
      correctIndex: 2
    }
  ]
};

const DIFFICULTY_INFO = {
  2: { difficulty: 'Kolay / Temel Düzey', focus: 'Discord temel kuralları, basit moderasyon işlemleri (/sustur vb.), selamlaşma disiplini, temel üye ilişkileri.' },
  3: { difficulty: 'Orta Düzey', focus: 'Orta düzey moderasyon, kural ihlallerine hızlı müdahale, yeni personellere/stajyerlere yardım ve rehberlik, aktiflik kuralları.' },
  4: { difficulty: 'Zor Düzey', focus: 'Destek biletleri (ticket) kalitesi, haftalık raporlama, ekip içi iletişim, güvenlik bypass kuralları, rol dağılımı.' },
  5: { difficulty: 'Çok Zor Düzey', focus: 'Yönetim koordinasyonu, genel denetim, üst düzey ceza/mod kuralları, kriz yönetimi, ekipler arası koordinasyon.' },
  6: { difficulty: 'Uzman / En Üst Düzey', focus: 'Genel sunucu operasyonları, yeni personellerin sınav ve eğitim süreçleri, operasyon koordinasyonu, liderlik standartları.' }
};

async function generateExamQuestions(targetLevel = 6) {
  const diff = DIFFICULTY_INFO[targetLevel] || DIFFICULTY_INFO[6];
  const prompt = [
    {
      role: 'user',
      content: `Sen EkoYıldız Moderatör Ekibi eğitim sorumlusu bir yapay zekasın. Seviye ${targetLevel} rütbesine terfi edecek yetkililer için 10 soruluk çoktan seçmeli bir sınav hazırlaman gerekiyor.
Sınavın Zorluk Derecesi: ${diff.difficulty}
Konu Odakları: ${diff.focus}

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
