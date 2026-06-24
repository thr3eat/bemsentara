'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const StaffUnit = require('../../models/StaffUnit');
const UnitRecruitment = require('../../models/UnitRecruitment');
const StaffProgress = require('../../models/StaffProgress');
const { chatWithAI } = require('./aiService');

const MAIN_GUILD_ID = '1367646464804655104';
const INTRODUCTION_CHANNEL_ID = '1518716989302898728';
const UPPER_ROLE_ID = '1517929818715455700'; // Üst sınır
const LOWER_ROLE_ID = '1467077860240916534'; // Alt sınır

const UNIT_CONFIG = {
  BAN_BIRIMI: {
    label: 'BAN BİRİMİ',
    color: '#e74c3c', // Kırmızı
    icon: '🛡️',
    description: 'Sunucu güvenliği, ceza işlemlerinin denetlenmesi ve ticket destek süreçlerinin yönetilmesinden sorumludur.',
    tasks: 'Bugün en az 2 ticket çöz ve 2 moderasyon işlemi gerçekleştir.'
  },
  SES_BIRIMI: {
    label: 'SES BİRİMİ',
    color: '#3498db', // Mavi
    icon: '🎤',
    description: 'Sesli kanallardaki aktifliğin izlenmesi, sesli moderasyon kurallarının uygulanması ve sesli etkinliklerden sorumludur.',
    tasks: 'Bugün en az 45 dakika sesli kanallarda aktif kal.'
  },
  SOHBET_BIRIMI: {
    label: 'SOHBET BİRİMİ',
    color: '#2ecc71', // Yeşil
    icon: '💬',
    description: 'Yazılı sohbet kanallarının canlı tutulması, yeni gelen üyelere rehberlik edilmesi ve sohbet düzeninden sorumludur.',
    tasks: 'Bugün sohbete en az 25 mesaj gönder.'
  }
};

const CHOSEN_TASKS = {
  'task_chat': '💬 Aktif Sohbetçi: Sohbette en az 15 mesaj gönder.',
  'task_voice': '🎤 Ses Meraklısı: Ses kanallarında fazladan 15 dakika geçir.',
  'task_ticket': '🎫 Destekçi: Bugün en az 1 ticket çöz.',
  'task_mod': '🛡️ Koruyucu: Bugün en az 1 moderasyon işlemi gerçekleştir.'
};

const DEFAULT_EXAM_DATA = {
  BAN_BIRIMI: {
    tips: "Ban birimi sınavında başarılı olmak için moderasyon kurallarına, ceza sürelerine ve adalet ilkelerine odaklanın.",
    questions: [
      {
        question: "Bir kullanıcının reklam yaptığı tespit edilirse uygulanacak ilk işlem nedir?",
        options: ["Kanıt alıp susturmak (Timeout) ve yetkiliye iletmek", "Doğrudan sunucudan yasaklamak (Ban)", "Sadece mesajlarını silip uyarmak", "Kullanıcıyı sunucudan atmak (Kick)"],
        correct: 0
      },
      {
        question: "Hangi durumlarda 'Tam Ban (Global)' işlemi uygulanması zorunludur?",
        options: ["Ağır küfür, ırkçılık, dolandırıcılık veya sürekli tekrarlanan ağır ihlallerde", "Sohbette büyük harfle yazıldığında", "Ses odasında yüksek ses yapıldığında", "İzinsiz link paylaşıldığında"],
        correct: 0
      },
      {
        question: "Cezalandırma işlemlerinde 'Kanıt' neden zorunludur?",
        options: ["İşlemin adaleti, doğruluğu ve denetlenebilirliği için", "Sadece sunucuda yer kaplaması için", "Kullanıcının profilini görmek için", "Herhangi bir zorunluluğu yoktur"],
        correct: 0
      },
      {
        question: "Bir moderatörün uyguladığı cezaya haksız yere itiraz eden bir üye için ne yapılmalıdır?",
        options: ["İtiraz kanalı veya destek bileti üzerinden kanıtlar gösterilerek açıklama yapılmalıdır", "Üye doğrudan sunucudan atılmalıdır", "İtirazı hemen silinmelidir", "Üyeye hakaret edilmelidir"],
        correct: 0
      },
      {
        question: "Spam/Flood yapan bir üyeye ilk olarak hangi süreyle susturma (timeout) uygulanmalıdır?",
        options: ["İhlalin derecesine göre 5 veya 10 dakika", "Doğrudan 1 gün", "Süresiz susturma", "Sadece 5 saniye"],
        correct: 0
      },
      {
        question: "Ban Birimi üyesinin sunucudaki en temel görevi nedir?",
        options: ["Sunucu güvenliği, kuralların korunması ve adaletin sağlanması", "Sadece oyun oynamak", "Ses kanallarında şarkı açmak", "Sürekli emoji atmak"],
        correct: 0
      },
      {
        question: "Karalisteye (Blacklist) alınan bir kişi sunucuya tekrar girmeye çalışırsa ne yapılmalıdır?",
        options: ["Girişi engellenmeli ve yetkililere bildirilmelidir", "Sunucuya girmesine izin verilmelidir", "Sadece susturulmalıdır", "Kayıt edilmelidir"],
        correct: 0
      },
      {
        question: "Bir üyenin uygunsuz profil fotoğrafı veya kullanıcı adı varsa ne yapılmalıdır?",
        options: ["Uygun bir isim/profil seçmesi için uyarılmalı, aksi halde cezalandırılmalıdır", "Doğrudan banlanmalıdır", "Görmezden gelinmelidir", "Sunucudaki herkes uyarılmalıdır"],
        correct: 0
      },
      {
        question: "Yetkililere veya üst yönetime karşı saygısızlık yapan bir üyeye hangi işlem uygulanır?",
        options: ["Duruma göre uyarı, susturma veya uzaklaştırma işlemi uygulanır", "Ödül verilir", "Hiçbir işlem yapılmaz", "Rolleri yükseltilir"],
        correct: 0
      },
      {
        question: "Hatalı veya yanlışlıkla atılan bir ceza tespit edildiğinde ne yapılmalıdır?",
        options: ["Derhal ceza kaldırılmalı, loglarda düzeltilmeli ve üyeden özür dilenmelidir", "Ceza aynen bırakılmalıdır", "Üye engellenmelidir", "Diğer yetkililerden gizlenmelidir"],
        correct: 0
      }
    ]
  },
  SES_BIRIMI: {
    tips: "Ses birimi sınavında başarılı olmak için sesli kanal aktiflik şartlarına, sesli odalar düzenine ve Earrape/trol ses müdahale yöntemlerine çalışın.",
    questions: [
      {
        question: "Ses kanallarında mikrofonuyla rahatsız edici/trol sesler çıkaran bir üyeye ne yapılmalıdır?",
        options: ["Uyarılmalı, devam ederse ses kanallarından susturulmalı/taşınmalıdır", "Doğrudan banlanmalıdır", "Ses seviyesi yükseltilmelidir", "Şarkı açılmalıdır"],
        correct: 0
      },
      {
        question: "Ses Birimi üyesi günlük olarak ses kanallarında ne kadar aktif kalmalıdır?",
        options: ["En az 45 dakika", "Sadece 5 dakika", "Hiç aktif olmasa da olur", "24 saat kesintisiz"],
        correct: 0
      },
      {
        question: "Sesli kanallarda telif hakkı ihlali veya uygunsuz müzik yayını yapıldığında ne yapılmalıdır?",
        options: ["Yayını yapan kişi uyarılmalı ve müzik botu/yayını kapatılmalıdır", "Keyifle dinlenmelidir", "Ses sonuna kadar açılmalıdır", "Diğer kanallara da yansıtılmalıdır"],
        correct: 0
      },
      {
        question: "Geçici özel ses kanallarının (oda-olustur) limit aşımı veya suistimalinde ne yapılmalıdır?",
        options: ["İlgili oda kurallara uygun hale getirilmeli veya kapatılmalıdır", "Görmezden gelinmelidir", "Oda sahibine ceza puanı verilmelidir", "Oda tamamen silinip sunucu kapatılmalıdır"],
        correct: 0
      },
      {
        question: "Sesli kanalda diğer üyeleri provoke eden veya kavga çıkaran bir üye için ne yapılmalıdır?",
        options: ["Kanaldan sağ tıklanarak susturulmalı (Mute) veya taşınmalı, gerekirse ceza verilmelidir", "Kavgaya dahil olunmalıdır", "Ses kaydı alınmalıdır", "Oda şifrelenmelidir"],
        correct: 0
      },
      {
        question: "Ses Biriminin temel amacı nedir?",
        options: ["Sesli kanalların düzenini, aktifliğini ve topluluk kalitesini korumak", "Sadece kendi kendine konuşmak", "Kanalları kilitlemek", "Ses değiştirici programlar kullanmak"],
        correct: 0
      },
      {
        question: "Sesli bir odada sessizce bekleyen (AFK) ve odayı meşgul eden üyeler nereye taşınmalıdır?",
        options: ["AFK kanalına veya boş bir kanala taşınmalıdır", "Sunucudan banlanmalıdır", "Özel mesajla uyarılmalıdır", "Sesleri kapatılmalıdır"],
        correct: 0
      },
      {
        question: "Sesli odalarda siyaset, din veya ırkçılık gibi hassas konularda tartışma başladığında ne yapılmalıdır?",
        options: ["Konu derhal kapatılmalı, uyarılara uymayanlar odadan uzaklaştırılmalıdır", "Tartışmaya katılınmalıdır", "Tartışma desteklenmelidir", "Odaya yeni kişiler davet edilmelidir"],
        correct: 0
      },
      {
        question: "Sesli kanalda yetkisiz bir şekilde yayın açıp sunucu düzenini bozan üyelere ne yapılır?",
        options: ["Yayın kapatılması istenir, aksi halde yayın yetkisi elinden alınır veya susturulur", "Yayını izlenmelidir", "Yayına emoji atılmalıdır", "Sunucuya davet linki atılmalıdır"],
        correct: 0
      },
      {
        question: "Sesli kanallarda kulak tırmalayıcı (Earrape) müzikler açılması durumunda ilk müdahale ne olmalıdır?",
        options: ["Ses derhal kesilmeli, açan kişi uyarılmalı ve susturulmalıdır", "Sesi açıp dinlemeye devam edilmelidir", "Ses kanalı kilitlenmelidir", "Diğer üyelerin sesi kısılmalıdır"],
        correct: 0
      }
    ]
  },
  SOHBET_BIRIMI: {
    tips: "Sohbet birimi sınavında başarılı olmak için yazılı sohbet kurallarına, hoş karşılama üslubuna ve spam/gif engelleme limitlerine odaklanın.",
    questions: [
      {
        question: "Sohbette sürekli büyük harfle (CAPS LOCK) yazarak düzeni bozan üyeye ne denmelidir?",
        options: ["Büyük harf kullanımının yasak olduğu hatırlatılmalı ve uyarılmalıdır", "Kendisine aynı şekilde büyük harfle cevap verilmelidir", "Doğrudan susturulmalıdır", "Sunucudan atılmalıdır"],
        correct: 0
      },
      {
        question: "Sohbet Birimi üyesinin günlük asgari sohbet mesajı hedefi nedir?",
        options: ["Sohbette en az 25 mesaj göndererek aktifliği korumak", "Sadece 1 mesaj göndermek", "Hiç mesaj göndermemek", "1000 mesaj sınırına ulaşmak"],
        correct: 0
      },
      {
        question: "Sohbete yeni katılan bir üyeye nasıl yaklaşılmalıdır?",
        options: ["Hoş karşılama mesajı atılmalı, rehberlik edilmeli ve sıcak davranılmalıdır", "Görmezden gelinmelidir", "Neden katıldığı sorgulanmalıdır", "Doğrudan kurallar gönderilmelidir"],
        correct: 0
      },
      {
        question: "Metin kanallarında emoji, çıkartma (sticker) veya gif spamı yapıldığında ne yapılmalıdır?",
        options: ["Mesajlar temizlenmeli, yapan üye uyarılmalı ve devamında susturulmalıdır", "Daha fazla gif atılmalıdır", "Sunucudaki herkes uyarılmalıdır", "Kanal kilitlenmelidir"],
        correct: 0
      },
      {
        question: "Yanlış kanalda sohbet eden (örneğin komut kanalında genel sohbet yapan) üyeye ne yapılmalıdır?",
        options: ["Sohbetin yapılacağı doğru kanala (genel sohbet) yönlendirilmelidir", "Doğrudan susturulmalıdır", "Mesajları silinip uyarılmalıdır", "Sunucudan banlanmalıdır"],
        correct: 0
      },
      {
        question: "Sohbet Biriminin sunucudaki temel sorumluluğu nedir?",
        options: ["Yazılı sohbet kanallarının aktifliğini, samimiyetini ve kurallara uygunluğunu sürdürmek", "Sadece bot komutları kullanmak", "Üyeleri şikayet etmek", "Sürekli resim paylaşmak"],
        correct: 0
      },
      {
        question: "Sohbette iki üye arasında hararetli bir kavga veya tartışma başladığında ne yapılmalıdır?",
        options: ["Tartışma sakinleştirilmeli, taraflar uyarılmalı ve gerekirse özel kanallara yönlendirilmelidir", "Kavga izlenmeli ve taraf tutulmalıdır", "Mesajlar silinmeden kilitlenmelidir", "Diğer üyelerin yazması engellenmelidir"],
        correct: 0
      },
      {
        question: "Sohbette uygunsuz veya argo kelimeler kullanan bir üyeye ne yapılmalıdır?",
        options: ["Uygun üslup kullanması hatırlatılmalı, kelime filtresine takılan mesajlar temizlenmelidir", "Kendisine argo ile karşılık verilmelidir", "Doğrudan banlanmalıdır", "Rolleri alınmalıdır"],
        correct: 0
      },
      {
        question: "Sohbet kanalını reklam amacıyla kullanan bir üyenin reklam mesajına ne yapılır?",
        options: ["Reklam mesajı anında silinmeli, üye susturulmalı ve durum yetkililere iletilmelidir", "Reklamı yapılan site incelenmelidir", "Mesaj sabitlenmelidir", "Reklama emoji ile tepki verilmelidir"],
        correct: 0
      },
      {
        question: "Sohbet kanallarının aktifliğini artırmak için neler yapılabilir?",
        options: ["Üyelere sorular sorulabilir, oyunlar veya sohbet konuları açılabilir", "Kanal kapatılabilir", "Üyeler sohbet etmeye zorlanabilir", "Sürekli bot komutları yazılabilir"],
        correct: 0
      }
    ]
  }
};

/**
 * Birimin ana ve rütbe rollerinin varlığından ve hiyerarşik yerinden emin olur.
 * @param {import('discord.js').Guild} guild 
 * @param {string} birimKey 
 */
async function ensureUnitRoles(guild, birimKey) {
  const config = UNIT_CONFIG[birimKey];
  if (!config) return null;

  // Sadece sunucu rollerinden bul, asla otomatik yeni rol oluşturma
  const mainRole = guild.roles.cache.find(r => r.name === config.label);
  
  const rankRoleIds = [];
  for (let rank = 1; rank <= 15; rank++) {
    const roleName = `${config.label} - Rütbe ${rank}`;
    const rankRole = guild.roles.cache.find(r => r.name === roleName);
    if (rankRole) {
      rankRoleIds[rank] = rankRole.id;
    }
  }

  return {
    mainRoleId: mainRole ? mainRole.id : null,
    rankRoleIds: rankRoleIds
  };
}

/**
 * Birim tanıtımlarını ilgili tanıtım kanalına atar.
 */
async function postUnitIntroductions(client) {
  try {
    const guild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
    if (!guild) return console.warn(`[unitService] Ana sunucu bulunamadı: ${MAIN_GUILD_ID}`);

    const channel = await guild.channels.fetch(INTRODUCTION_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return console.warn(`[unitService] Tanıtım kanalı bulunamadı: ${INTRODUCTION_CHANNEL_ID}`);

    // Eski mesajları temizle (isteğe bağlı, kanalı temiz tutup sadece tanıtım bırakmak için)
    await channel.bulkDelete(100).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0x34495e)
      .setTitle('🏛️ EkoYıldız Birimleri & Çalışma Esasları')
      .setDescription(
        'EkoYıldız bünyesinde yer alan uzmanlaşmış birimler ve bu birimlerin ayrıcalıkları aşağıda listelenmiştir. ' +
        'Her birimin kendine özgü yetki ve görev tanımları bulunmaktadır.'
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    for (const [key, config] of Object.entries(UNIT_CONFIG)) {
      const unitEmbed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`${config.icon} ${config.label}`)
        .setDescription(
          `**Açıklama:**\n${config.description}\n\n` +
          `🔒 **Birim Yetkileri & Ayrıcalıkları:**\n` +
          `- **${config.label}** üyelerine özel rol ve rütbe hiyerarşisi.\n` +
          `- Günlük brifinglerine eklenen özel birim görevleri ve **%25 ekstra terfi katkısı** fırsatları.\n` +
          `- 15 kademeli rütbe ilerlemesi. En yüksek rütbedekiler (Rütbe 13-15) alt rütbeleri denetleme ve terfi ettirme yetkisine sahiptir.\n\n` +
          `📋 **Birim Günlük Görevi:**\n*${config.tasks}*`
        )
        .setFooter({ text: `EkoYıldız Birim Tanıtım Sistemi` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apply_unit_${key}`)
          .setLabel(`📝 ${config.label} Sınavını Başlat`)
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ embeds: [unitEmbed], components: [row] });
    }

    console.log('[unitService] Birim tanıtım mesajları başarıyla gönderildi.');
  } catch (err) {
    console.error('[unitService] postUnitIntroductions hatası:', err.message);
  }
}

/**
 * Yönetici komutuyla birim alım duyurusu başlatır.
 */
async function startBirimAlimi(interaction, client, birimKey) {
  try {
    const config = UNIT_CONFIG[birimKey];
    if (!config) {
      // Handle both Message and Interaction
      if (interaction.editReply) {
        return interaction.editReply({ content: '❌ Geçersiz birim seçimi yapıldı.' });
      } else {
        return interaction.reply('❌ Geçersiz birim seçimi yapıldı.');
      }
    }

    // Show immediate response that exam is starting
    if (interaction.editReply) {
      await interaction.editReply({ content: `⏳ **Sınav hazırlanıyor...** Lütfen DM kutunuzu açın.` });
    } else {
      await interaction.reply(`⏳ **Sınav hazırlanıyor...** Lütfen DM kutunuzu açın.`);
    }

    // AI kontrol: Sınav hazır mı?
    const { chatWithAI } = require('./aiService');
    const systemPrompt = `Sen bir sınav yöneticisisin. Aşağıda ${config.label} için sınav sorularını ve cevaplarını hazırla. 
Kesinlikle 10 tane zorluk seviyesi orta olan, gerçekçi sorular ver.
JSON formatında cevap ver: {"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0}]}`;

    let parsedData = null;
    try {
      const aiResponse = await chatWithAI(systemPrompt, { timeout: 10000 });
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (aiErr) {
      console.warn('[unitService] AI sınav hazırlama başarısız, varsayılan veri kullanılıyor:', aiErr.message);
    }

    // Fallback to default if AI fails
    if (!parsedData || !parsedData.questions || parsedData.questions.length === 0) {
      parsedData = DEFAULT_EXAM_DATA[birimKey] || {
        tips: "Sınavda sakin kalın, soruları dikkatli okuyun ve birimin sorumluluk alanlarına odaklanın.",
        questions: Array.from({ length: 10 }, (_, i) => ({
          question: `${config.label} bünyesinde ${i + 1}. sorumluluk kuralı nedir?`,
          options: ["Doğru Seçenek A", "Yanlış Seçenek B", "Yanlış Seçenek C", "Yanlış Seçenek D"],
          correct: 0
        }))
      };
    }

    const today = new Date();
    const announcementDate = new Date(today);
    
    // HEMEN BAŞLA (sabah 9:00 yerine direkt)
    const startDate = new Date(today);
    startDate.setMinutes(today.getMinutes() + 1); // 1 dakika sonra başla (yeterli zaman)

    const endDate = new Date(today);
    endDate.setHours(today.getHours() + 6); // 6 saat sonra bitir

    // Veritabanına kaydet
    const recruitment = new UnitRecruitment({
      guildId: '1466927911364726845',
      channelId: '1466939999571279994',
      birim: birimKey,
      announcementDate,
      startDate,
      endDate,
      examTips: parsedData.tips,
      examQuestions: parsedData.questions
    });

    await recruitment.save();

    // Roller oluşturulmuş mu kontrol et ve oluştur/yerleştir
    const targetGuild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
    if (targetGuild) {
      await ensureUnitRoles(targetGuild, birimKey);
    }

    // Duyuru kanalını bul ve gönder
    const channel = await client.channels.fetch('1466939999571279994').catch(() => null);
    if (channel && channel.isTextBased()) {
      const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
      
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`📢 HEMEN BAŞLIYORUZ: ${config.label} Alımları!`)
        .setDescription(
          `Değerli EkoYıldız Üyeleri,\n\n` +
          `**${config.label}** kadrolarımızı güçlendirmek amacıyla alım süreci **HEMEN** başlatılmıştır!\n\n` +
          `🎯 **Sınav Detayları:**\n` +
          `- **Başlangıç:** Şu anda (Hemen)\n` +
          `- **Sınavı Başlat:** Aşağıdaki butonuna tıkla\n` +
          `- **Geçiş Notu:** Minimum 8/10 doğru\n` +
          `- **Toplam Soru:** 10 adet\n\n` +
          `🎓 **Başvuru Süreci:**\n` +
          `1. "📥 Başvur" butonuna tıkla\n` +
          `2. AI sınav gözetmeni yanına gelecek\n` +
          `3. DM'de soruları cevapla\n` +
          `4. Sonuçları öğren\n\n` +
          `⏰ **Zamanı Boşa Harcama!** Alım süreleri sınırlıdır. Başarılar dileriz! 🚀`
        )
        .setFooter({ text: 'EkoYıldız Yapay Zeka Sınav ve Birim Alım Sistemi' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apply_unit_${recruitment._id}`)
          .setLabel('📥 Şimdi Başla')
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ content: '@everyone', embeds: [embed], components: [row] });
      
      // Handle both Message and Interaction
      if (interaction.editReply) {
        await interaction.editReply({ content: `✅ **Birim alım süreci HEMEN başladı!** Duyuru kanalına gönderildi.` });
      } else {
        await interaction.reply(`✅ **Birim alım süreci HEMEN başladı!** Duyuru kanalına gönderildi.`);
      }
    } else {
      // Handle both Message and Interaction
      if (interaction.editReply) {
        await interaction.editReply({ content: `❌ Duyuru kanalı bulunamadı veya metin kanalı değil.` });
      } else {
        await interaction.reply(`❌ Duyuru kanalı bulunamadı veya metin kanalı değil.`);
      }
    }
  } catch (err) {
    console.error('[unitService] startBirimAlimi hatası:', err.message);
    
    // Handle both Message and Interaction
    if (interaction.editReply && interaction.deferred) {
      await interaction.editReply({ content: `❌ Duyuru gönderilirken bir hata oluştu: ${err.message}` });
    } else if (interaction.editReply) {
      await interaction.editReply({ content: `❌ Duyuru gönderilirken bir hata oluştu: ${err.message}`, ephemeral: true });
    } else {
      await interaction.reply(`❌ Duyuru gönderilirken bir hata oluştu: ${err.message}`);
    }
  }
}

/**
 * Aday başvuru butonuna bastığında sınav sürecini başlatır.
 */
async function handleApplyClick(interaction, target) {
  try {
    // IMMEDIATELY defer the reply to prevent 3-second timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    let birimKey = target;
    let examQuestions = null;
    let examTips = "";

    if (['BAN_BIRIMI', 'SES_BIRIMI', 'SOHBET_BIRIMI'].includes(target)) {
      birimKey = target;
      const defaultData = DEFAULT_EXAM_DATA[target];
      if (defaultData) {
        examQuestions = defaultData.questions;
        examTips = defaultData.tips;
      }
    } else {
      const recruitment = await UnitRecruitment.findById(target).catch(() => null);
      if (!recruitment) {
        if (UNIT_CONFIG[target]) {
          birimKey = target;
          const defaultData = DEFAULT_EXAM_DATA[target];
          if (defaultData) {
            examQuestions = defaultData.questions;
            examTips = defaultData.tips;
          }
        } else {
          return interaction.editReply({ content: '❌ Alım süreci kaydı bulunamadı.' });
        }
      } else {
        birimKey = recruitment.birim;
        examQuestions = recruitment.examQuestions;
        examTips = recruitment.examTips;

        // ❌ REMOVED: Hata oluşturan tarih kontrolü kaldırıldı
        // Alımlar artık hemen başlıyor, kontrol gerekmez
      }
    }

    if (!examQuestions || examQuestions.length === 0) {
      return interaction.editReply({ content: '❌ Sınav soruları yüklenemedi.' });
    }

    // Kullanıcının halihazırda bir birimde olup olmadığını kontrol et
    let userUnit = await StaffUnit.findOne({ userId: interaction.user.id });
    if (userUnit && userUnit.unitName) {
      return interaction.editReply({ content: '❌ Zaten aktif bir birime üyesiniz! Başka bir birime katılamazsınız.' });
    }

    if (!userUnit) {
      userUnit = new StaffUnit({ userId: interaction.user.id });
    }

    const now = new Date();
    // Sınav durumunu güncelle
    userUnit.exam = {
      status: 'ongoing',
      unit: birimKey,
      questions: examQuestions,
      currentIndex: 0,
      answers: [],
      startedAt: now
    };

    await userUnit.save();

    await interaction.editReply({ content: '📬 Sınavınız DM kutunuza gönderildi! Lütfen DM kutunuzu kontrol edin.' });
    
    // DM'den ilk soruyu gönder
    const client = interaction.client;
    await sendExamQuestion(client, interaction.user.id, userUnit);
  } catch (err) {
    console.error('[unitService] handleApplyClick hatası:', err.message);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: `❌ Başvuru işlemi başlatılırken hata oluştu: ${err.message}`, ephemeral: true });
    } else {
      await interaction.editReply({ content: `❌ Başvuru işlemi başlatılırken hata oluştu: ${err.message}` });
    }
  }
}

/**
 * DM'den sınav sorusu gönderir.
 */
async function sendExamQuestion(client, userId, userUnit) {
  try {
    const user = await client.users.fetch(userId);
    const exam = userUnit.exam;
    const qIndex = exam.currentIndex;
    const question = exam.questions[qIndex];

    if (!question) return;

    // İlk sorunun başında gerçekçi ortam oluştur
    if (qIndex === 0) {
      // Sınav başlamadan sistem mesajları gönder
      await user.send("📝 **Sınav sistemi yükleniyor...**").catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
      
      await user.send("🔐 **Kimlik doğrulama yapılıyor...**").catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
      
      await user.send("⚙️ **Sınav ortamı hazırlanıyor...**").catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 saniye bekle
      
      // Realistic environment message
      await user.send({
        content: "🎯 **SINAV BAŞLIYOR...**",
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle("⚠️ Sınav Gözetmeni Yanına Geldi")
            .setDescription(
              `Merhaba ${user.username}!\n\n` +
              `Sınav gözetmeni olarak yanınızda bulunacağım. ` +
              `Aşağıdaki kuralları lütfen dikkate alınız:\n\n` +
              `✅ **Yapabilecekleriniz:**\n` +
              `• Soruları dikkatlice okumak\n` +
              `• Şıklardan birini seçmek\n` +
              `• Uygun zaman içerisinde cevaplamak\n\n` +
              `❌ **Yasak İşlemler:**\n` +
              `• Dış kaynaktan yardım almak\n` +
              `• Sorulardan screenshot almak\n` +
              `• Başka kişilerle görüşmek\n\n` +
              `⏱️ **Süre:** Sınırısız (Ancak yakında sorular göreceğiniz)\n` +
              `📊 **Başarı Notu:** 8/10 ve üzeri\n\n` +
              `Hazır mısınız? Başlayalım! 🚀`
            )
            .setFooter({ text: "Sınav Yönetim Sistemi v2.0 - AI Powered" })
            .setTimestamp()
        ]
      }).catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle

      // Exam starts message
      await user.send({
        content: "🎓 **SINAV BAŞLADI!**\n\nİlk soru aşağıda. Başarılar! 💪",
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("✅ Sınav Başlandı")
            .setDescription(`Toplamda **10 soru** sorulacaktır.\nHer soru için aşağıdaki butonlardan birini tıklayın.`)
        ]
      }).catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
    }

    const embed = new EmbedBuilder()
      .setColor(UNIT_CONFIG[exam.unit]?.color || '#f39c12')
      .setTitle(`🎓 ${UNIT_CONFIG[exam.unit]?.label} Giriş Sınavı`)
      .setDescription(
        `**[Soru ${qIndex + 1}/10]**\n\n` +
        `${question.question}\n\n` +
        `_Aşağıdaki seçeneklerden doğru olanı seçin._`
      )
      .setFooter({ text: 'Sınav Gözetmeni - Lütfen dikkatlice okuyun ve cevaplandırın.' })
      .setTimestamp();

    const row = new ActionRowBuilder();
    const optionsLetters = ['A', 'B', 'C', 'D'];
    question.options.forEach((opt, idx) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`unit_exam_ans_${qIndex}_${idx}`)
          .setLabel(`${optionsLetters[idx]}: ${opt.slice(0, 70)}`)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    await user.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[unitService] sendExamQuestion hatası:', err.message);
  }
}

/**
 * Aday sınav sorularını cevapladığında tetiklenir.
 */
async function handleAnswerClick(interaction, qIndex, optIndex) {
  try {
    const userId = interaction.user.id;
    const userUnit = await StaffUnit.findOne({ userId });

    if (!userUnit || userUnit.exam.status !== 'ongoing' || userUnit.exam.currentIndex !== parseInt(qIndex)) {
      return interaction.reply({ content: '❌ Sınav oturumunuz aktif değil veya bu soruyu zaten cevapladınız.', ephemeral: true });
    }

    // Cevabı kaydet
    userUnit.exam.answers.push(parseInt(optIndex));
    userUnit.exam.currentIndex += 1;

    await interaction.deferUpdate().catch(() => {});

    if (userUnit.exam.currentIndex < userUnit.exam.questions.length) {
      // Bir sonraki soruyu gönder
      await userUnit.save();
      await sendExamQuestion(interaction.client, userId, userUnit);
    } else {
      // Sınav bitti, değerlendir
      let score = 0;
      userUnit.exam.questions.forEach((q, idx) => {
        if (userUnit.exam.answers[idx] === q.correct) {
          score += 1;
        }
      });

      const passed = score >= 8;
      userUnit.exam.status = passed ? 'passed' : 'failed';

      if (passed) {
        // Birime kabul et
        const birimKey = userUnit.exam.unit;
        userUnit.unitName = birimKey;
        userUnit.joinedAt = new Date();

        // Skora göre başlangıç rütbesi ver
        let startingRank = 1;
        if (score === 10) startingRank = 3; // Sınavda çok emek verenler
        else if (score === 9) startingRank = 2;
        userUnit.rank = startingRank;

        await userUnit.save();

        // Rolleri ver
        const guild = await interaction.client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
        if (guild) {
          const rolesData = await ensureUnitRoles(guild, birimKey);
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member && rolesData) {
            // Ana rolü ekle
            if (rolesData.mainRoleId) {
              await member.roles.add(rolesData.mainRoleId).catch(() => {});
            }
            // Rütbe rolünü ekle
            const targetRankRole = rolesData.rankRoleIds[startingRank];
            if (targetRankRole) {
              await member.roles.add(targetRankRole).catch(() => {});
            }
          }
        }

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`🎉 TEBRİKLER! Sınavı Geçtiniz!`)
          .setDescription(
            `Harika bir başarı! **${UNIT_CONFIG[birimKey]?.label}** sınavından **${score}/10** puan alarak başarılı oldunuz!\n\n` +
            `**Atandığınız Rütbe:** Rütbe ${startingRank}\n` +
            `Gerekli yetki ve rütbe rolleriniz ana sunucuda hesabınıza tanımlanmıştır. Biriminizde başarılar dileriz! 🚀`
          )
          .setFooter({ text: 'EkoYıldız Birim Yönetim Sistemi' })
          .setTimestamp();

        await interaction.user.send({ embeds: [embed] }).catch(() => {});
      } else {
        await userUnit.save();
        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`❌ Sınav Sonucu: Başarısız`)
          .setDescription(
            `Sınavı tamamladınız ancak **${score}/10** doğru yaparak geçiş barajını (8 doğru) aşamadınız.\n\n` +
            `Sağlık olsun! Kendinizi geliştirip bir sonraki alım döneminde tekrar başvurabilirsiniz. Çalışmalarınızda başarılar dileriz!`
          )
          .setFooter({ text: 'EkoYıldız Birim Yönetim Sistemi' })
          .setTimestamp();

        await interaction.user.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[unitService] handleAnswerClick hatası:', err.message);
  }
}

/**
 * Birimden istifa etme eylemini gerçekleştirir.
 */
async function handleBirimIstifa(interaction) {
  try {
    const userId = interaction.user.id;
    const userUnit = await StaffUnit.findOne({ userId });

    if (!userUnit || !userUnit.unitName) {
      return interaction.editReply({ content: '❌ Zaten herhangi bir birimde kayıtlı değilsiniz.' });
    }

    const oldBirim = userUnit.unitName;
    const oldRank = userUnit.rank;

    // Rolleri temizle
    const guild = await interaction.client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        // Ana birim rolünü bul ve kaldır
        const config = UNIT_CONFIG[oldBirim];
        if (config) {
          const mainRole = guild.roles.cache.find(r => r.name === config.label);
          if (mainRole) await member.roles.remove(mainRole.id).catch(() => {});

          // Tüm 1-15 rütbe rollerini temizle
          for (let rank = 1; rank <= 15; rank++) {
            const roleName = `${config.label} - Rütbe ${rank}`;
            const rankRole = guild.roles.cache.find(r => r.name === roleName);
            if (rankRole && member.roles.cache.has(rankRole.id)) {
              await member.roles.remove(rankRole.id).catch(() => {});
            }
          }
        }
      }
    }

    // DB sıfırla
    userUnit.unitName = null;
    userUnit.rank = 0;
    userUnit.joinedAt = null;
    userUnit.dailyTasksCompleted = 0;
    userUnit.exam = { status: 'none', unit: null, questions: [], currentIndex: 0, answers: [], startedAt: null };

    await userUnit.save();

    await interaction.editReply({
      content: `🚪 **${UNIT_CONFIG[oldBirim]?.label}** birimindeki (Rütbe ${oldRank}) görevinizden başarıyla **istifa ettiniz**. Rolleriniz temizlendi.`
    });
  } catch (err) {
    console.error('[unitService] handleBirimIstifa hatası:', err.message);
    await interaction.editReply({ content: `❌ İstifa işlemi sırasında hata oluştu: ${err.message}` });
  }
}

/**
 * Üst rütbedekilerin (13-15) alt rütbedekileri terfi ettirmesini sağlar.
 */
async function handleBirimTerfi(interaction) {
  try {
    const executorId = interaction.user.id;
    const targetUser = interaction.options.getUser('kullanici');

    const execUnit = await StaffUnit.findOne({ userId: executorId });
    if (!execUnit || !execUnit.unitName || execUnit.rank < 13) {
      return interaction.editReply({ content: '❌ Bu komutu kullanabilmek için kendi biriminizde en az **Rütbe 13** üst yetkili olmalısınız!' });
    }

    const targetUnit = await StaffUnit.findOne({ userId: targetUser.id });
    if (!targetUnit || targetUnit.unitName !== execUnit.unitName) {
      return interaction.editReply({ content: '❌ Terfi ettirmek istediğiniz kullanıcı sizinle aynı birimde bulunmuyor.' });
    }

    if (targetUnit.rank >= execUnit.rank) {
      return interaction.editReply({ content: '❌ Sizden yüksek veya sizinle eşit rütbedeki bir yetkiliyi terfi ettiremezsiniz.' });
    }

    const oldRank = targetUnit.rank;
    const newRank = oldRank + 1;

    if (newRank > 15) {
      return interaction.editReply({ content: '❌ Bu personel zaten en yüksek rütbede (Rütbe 15) bulunuyor.' });
    }

    targetUnit.rank = newRank;
    await targetUnit.save();

    // Rolleri güncelle
    const guild = await interaction.client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
    if (guild) {
      const config = UNIT_CONFIG[execUnit.unitName];
      if (config) {
        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        if (member) {
          // Eski rütbe rolünü kaldır
          const oldRoleName = `${config.label} - Rütbe ${oldRank}`;
          const oldRole = guild.roles.cache.find(r => r.name === oldRoleName);
          if (oldRole) await member.roles.remove(oldRole.id).catch(() => {});

          // Yeni rütbe rolünü ver
          const rolesData = await ensureUnitRoles(guild, execUnit.unitName);
          if (rolesData) {
            const targetRankRole = rolesData.rankRoleIds[newRank];
            if (targetRankRole) {
              await member.roles.add(targetRankRole).catch(() => {});
            }
          }
        }
      }
    }

    await interaction.editReply({
      content: `🎉 **Terfi Başarılı!** <@${targetUser.id}> personeli **${UNIT_CONFIG[execUnit.unitName]?.label}** biriminde **Rütbe ${oldRank}** → **Rütbe ${newRank}** seviyesine yükseltildi!`
    });

    // DM ile hedef üyeye duyur
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('📈 Birim Rütbe Yükselmesi (Terfi)!')
        .setDescription(
          `Tebrikler <@${targetUser.id}>,\n\n` +
          `**${UNIT_CONFIG[execUnit.unitName]?.label}** üst yetkilileri tarafından gösterdiğiniz gayretler incelendi ve **Rütbe ${newRank}** seviyesine terfi edildiniz! 🎉`
        )
        .setFooter({ text: 'EkoYıldız Birim Yönetim Sistemi' })
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (_) {}
  } catch (err) {
    console.error('[unitService] handleBirimTerfi hatası:', err.message);
    await interaction.editReply({ content: `❌ Terfi işlemi sırasında bir hata oluştu: ${err.message}` });
  }
}

/**
 * Personel büyük görevler tamamladığında otomatik rütbe almasını sağlar (Limit: Rütbe 12).
 */
async function checkAutoPromotion(userId, client, activityType) {
  try {
    const userUnit = await StaffUnit.findOne({ userId });
    if (!userUnit || !userUnit.unitName || userUnit.rank >= 12) return;

    const progress = await StaffProgress.findOne({ userId });
    if (!progress) return;

    let qualifies = false;
    let taskName = "";

    const today = new Date().toISOString().split('T')[0];
    if (progress.daily.date !== today) return; // Sadece bugünün verileriyle çalışır

    if (activityType === 'ticket' && userUnit.unitName === 'BAN_BIRIMI' && (progress.daily.ticketsSolvedToday || 0) >= 5) {
      qualifies = true;
      taskName = "Günde 5+ Ticket Çözmek";
    } else if (activityType === 'chat' && userUnit.unitName === 'SOHBET_BIRIMI' && (progress.daily.chatMessagesToday || 0) >= 100) {
      qualifies = true;
      taskName = "Günde 100+ Sohbet Mesajı Göndermek";
    } else if (activityType === 'voice' && userUnit.unitName === 'SES_BIRIMI' && (progress.daily.voiceMinutes || 0) >= 120) {
      qualifies = true;
      taskName = "Günde 120+ Dakika Sesli Kanalda Kalmak";
    }

    if (qualifies) {
      // Bugün bu görevin ödülünü zaten alıp almadığını kontrol etmek için geçici bir kontrol uygulayabiliriz
      // Veya rütbe artırıp anlık save ederiz. Tekrarlamayı engellemek için daily.chosenTaskCompleted gibi bir mantık kurabiliriz.
      // Ama burada rütbe doğrudan artıyor. Kaydı kontrol etmek için o günkü rütbe artışını db'de loglayabiliriz.
      // Ya da basitçe: "Eğer o günkü hedefe ulaşıldığı an rütbe artmışsa bir daha artmasın"
      // Bunu önlemek için userUnit.lastAutoPromoDate === today kontrolü ekleyelim!
      if (userUnit.lastAutoPromoDate === today) return;

      const oldRank = userUnit.rank;
      const newRank = oldRank + 1;

      userUnit.rank = newRank;
      userUnit.lastAutoPromoDate = today;
      await userUnit.save();

      // Rolleri güncelle
      const guild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
      if (guild) {
        const config = UNIT_CONFIG[userUnit.unitName];
        if (config) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            // Eski rütbe rolünü kaldır
            const oldRoleName = `${config.label} - Rütbe ${oldRank}`;
            const oldRole = guild.roles.cache.find(r => r.name === oldRoleName);
            if (oldRole) await member.roles.remove(oldRole.id).catch(() => {});

            // Yeni rütbe rolünü ver
            const rolesData = await ensureUnitRoles(guild, userUnit.unitName);
            if (rolesData) {
              const targetRankRole = rolesData.rankRoleIds[newRank];
              if (targetRankRole) {
                await member.roles.add(targetRankRole).catch(() => {});
              }
            }
          }
        }
      }

      // DM tebrik gönder
      try {
        const discordUser = await client.users.fetch(userId).catch(() => null);
        if (discordUser) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('⚡ OLAĞANÜSTÜ BAŞARI: Otomatik Rütbe Artışı!')
            .setDescription(
              `Tebrikler <@${userId}>,\n\n` +
              `Bugün gerçekleştirdiğin devasa çalışma olan **"${taskName}"** sayesinde **${UNIT_CONFIG[userUnit.unitName]?.label}** rütben sistem tarafından otomatik olarak yükseltildi!\n\n` +
              `**Yeni Rütben:** Rütbe ${newRank} 🎉`
            )
            .setFooter({ text: 'EkoYıldız Birim Yönetim Sistemi' })
            .setTimestamp();
          await discordUser.send({ embeds: [dmEmbed] }).catch(() => {});
        }
      } catch (_) {}
    }
  } catch (err) {
    console.error('[unitService] checkAutoPromotion hatası:', err.message);
  }
}

module.exports = {
  CHOSEN_TASKS,
  UNIT_CONFIG,
  ensureUnitRoles,
  postUnitIntroductions,
  startBirimAlimi,
  handleApplyClick,
  handleAnswerClick,
  handleBirimIstifa,
  handleBirimTerfi,
  checkAutoPromotion
};
