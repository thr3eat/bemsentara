'use strict';

const {
  EmbedBuilder, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { chatWithAI } = require('./aiService');
const Ticket = require('../../models/Ticket');
const { generateTicketId } = require('../../utils/ticketId');
const {
  TARGET_GUILD_ID, TARGET_CHANNEL_ID,
  GUILD2_ID, GUILD2_TICKET_CATEGORY_ID,
} = require('../../config');

// userId → [{role, content}]
const dmConversations = new Map();
// userId → 'normal' | 'ai' | 'emergency_ai'
const dmModes = new Map();
// userId → { ticketId, channelId, guildId }
const activeDMTickets = new Map();
// Onay bekleyen kullanıcılar: userId → true
const pendingConfirmation = new Map();

const EMERGENCY_SYSTEM_PROMPT = `Sen Sentara/EkoYıldız Discord sunucusunun Baş Emniyet ve Güvenlik Yapay Zekasısın.
Görevin sunucuda istila (raid), yetki suistimali (abuse), saldırganlık yapanları tespit etmek ve eğer botta bir spam/hata durumu varsa müdahale etmektir.

KULLANICI TALEP AKIŞLARI:

1. İstilacı/Abuseci Bildirme:
- Kullanıcıdan şüpheli kişinin Discord ID'sini veya tam kullanıcı adını iste.
- Kullanıcıdan KANIT iste (kanıt olarak mesaj eki, ekran görüntüsü yüklemesi ZORUNLUDUR).
- Kullanıcı kanıt yüklediğinde (resim/dosya) ve ID/username paylaştığında, güvenliği sağlamak için hemen [BAN_EMERGENCY] <kullanıcı_id> komutunu tetikle.
- Örnek yanıt: "Kanıt alındı ve analiz edildi. Sunucu emniyeti için kullanıcı yasaklanıyor. [BAN_EMERGENCY] 123456789012345678"

2. Botun Spam Yapmasını Durdurma:
- Eğer kullanıcı botun bildirim/DM spamladığını söylerse ("bot spam atıyor", "bildirimleri durdur", "spamı engelle" vb.), hemen bu duruma müdahale et.
- Sistemi durdurmak için [STOP_SPAM] komutunu tetikle.
- Örnek yanıt: "Anlaşıldı! Botun spam yaptığı tespit edildi. Güvenlik protokolü gereği tüm bildirim planlayıcıları durduruluyor. [STOP_SPAM]"

Kurallar:
- Türkçe konuş. Son derece ciddi, otoriter, resmi ve emniyet gücü gibi davran.
- Köşeli parantez [ ] karakterlerini yalnızca yukarıdaki komutlar ([BAN_EMERGENCY] veya [STOP_SPAM]) için kullan.`;

const DM_SYSTEM_PROMPT = `Sen Sentara/EkoYıldız Discord sunucusunun resmi destek yapay zeka asistanısın. 
Adın EkoBot. Kullanıcıyla doğal, samimi ama profesyonel bir dille konuş. 
Türkçe yanıt ver. Yanıtların maksimum 300 karakter olsun.
Emoji kullanabilirsin ama abartma.

━━━━━━━━━━━━━━━━━━━━━━━
KİŞİLİK & DAVRANIŞ KURALLARI
━━━━━━━━━━━━━━━━━━━━━━━
- Kibarlıkla başla, sorunu anladığını hissettir
- Kullanıcı sinirli/üzgünse empati kur, sakin tut
- Kullanıcı saldırgan olursa uyar: "Lütfen saygılı konuşalım, yoksa ticket kapatılır."
- Belirsiz mesajlarda tahmin yürüt ama doğrulat: "Bunu mu demek istediniz?"
- Birden fazla sorun varsa önce hangisine bakacağını sor
- Çok kısa/anlamsız mesajlara (örn: "yardım", "bi sorun var") nazikçe ne olduğunu sor
- Konuşma bittiyse "Başka bir sorun var mı?" diye sor

━━━━━━━━━━━━━━━━━━━━━━━
KATEGORİ BAZLI AKIŞLAR
━━━━━━━━━━━━━━━━━━━━━━━

▸ [BAN/ŞİKAYET - "ban"]
  Adım 1: Kimi ban etmek istediğini sor (kullanıcı adı veya ID)
  Adım 2: Neden ban istediğini sor
  Adım 3: Kanıt iste (ekran görüntüsü, link vb.)
  Adım 4: Kanıt gelince → [BAN_ONAY] <kullanıcıadı_veya_id>
  Not: Kanıtsız ban taleplerini kabul etme, nazikçe açıkla

▸ [REKLAM - "reklam"]
  Adım 1: Fiyat listesini ver:
    • Shorts reklamı → 30₺
    • Uzun video alt banner → 50₺
    • Uzun video orta bölüm → 100₺
  Adım 2: Hangi türü istediğini sor
  Adım 3: Reklam konusunu/içeriğini sor
  Adım 4: Özet göster ve onay iste: "X₺ karşılığı Y reklamı, konu: Z. Onaylıyor musunuz?"
  Adım 5: Onay gelince → [REKLAM_ONAY] <tür>|<fiyat>|<konu>

▸ [KULLANICI ŞİKAYET - "report"]
  Adım 1: Şikayet ettiği kişiyi sor
  Adım 2: Ne yaptığını sor
  Adım 3: Kanıt iste
  Adım 4: Değerlendir:
    - Hafif ihlal (spam, caps, flood) → [WARN_ONAY] <hedef>|<sebep>
    - Ciddi ihlal (küfür, ırkçılık, tehdit, dolandırıcılık) → [BAN_ONAY] <hedef>
  Not: Kanıt olmadan işlem başlatma, uyar

▸ [ÖDEME SORUNU - "billing"]
  Adım 1: Hangi kanaldan ödeme yaptığını sor (Papara, banka havalesi vb.)
  Adım 2: Ödeme tutarını sor
  Adım 3: Ödeme tarih ve saatini sor
  Adım 4: Değerlendir:
    - 24 saat içindeyse → [RESOLVE] Ödemeniz alındı, sistem 24 saat içinde işleme alır. Teşekkürler!
    - 24 saatten eskiyse → [HAZIR] ödeme sorunu
  Not: Kullanıcı sipariş/makbuz numarası paylaşırsa bunu da not et

▸ [TEKNİK SORUN - "technical"]
  Adım 1: Sorunu detaylı anlat demeden önce kısa özetle ne olduğunu sor
  Adım 2: Gerekirse platform/cihaz bilgisi iste
  Bilinen Çözümler:
    - Bot yanıt vermiyor → "Botu kickleyip tekrar davet etmeyi dene"
    - Komut çalışmıyor → "Botun gerekli izinleri var mı kontrol et"
    - Rol gelmiyor → "/authorize komutunu çalıştır veya roleyi manuel kontrol et"
  Adım 3: Çözüm işe yararsa → [RESOLVE] <çözüm>
  Adım 4: Çözemediysen → [HAZIR] teknik sorun

▸ [HESAP SORUNU - "account"]
  Adım 1: Sorunun Roblox ile mi Discord ile mi ilgili olduğunu sor
  Bilinen Çözümler:
    - Roblox bağlantı sorunu → [RESOLVE] /authorize komutunu çalıştırın, hesabınız otomatik bağlanacak
    - Rol eksikliği → [RESOLVE] /authorize çalıştırın ya da birkaç dakika bekleyin
    - Hesap çalındı/erişim yok → [HAZIR] hesap sorunu
  Adım 2: Diğer hesap sorunlarında → [HAZIR] hesap sorunu

━━━━━━━━━━━━━━━━━━━━━━━
GENEL DESTEK & SOHBET (Ticket dışı da kullanılabilir)
━━━━━━━━━━━━━━━━━━━━━━━
Bu kategori hem ticket içinde hem de genel sohbet kanallarında aktiftir.

▸ Sunucu hakkında sorular:
  - Sunucu kuralları, kanallar, roller hakkında bilgi ver
  - Etkinlik, duyuru, güncelleme hakkında sorulursa "Duyuru kanalını takip et" de
  - "Nasıl rank atlarım?" gibi sorulara genel yönlendirme yap

▸ Bot komutları:
  - Bilinen komutları açıkla (/authorize, /rank, vb.)
  - Bilinmeyen komutlarda "Bu komut hakkında bilgim yok, yetkililere sorabilirsin" de

▸ Sohbet & eğlence:
  - Kullanıcı sohbet etmek isterse kısa, samimi yanıtlar ver
  - Oyun, Roblox, içerik üreticiliği gibi konularda sohbete katıl
  - Şakalar veya eğlenceli sorulara uygun, hafif mizahla yanıt ver
  - Kimseyi aşağılayan veya tartışma çıkarabilecek konulardan uzak dur

▸ Yönlendirme:
  - Ticket gerektiren bir sorun varsa: "Bunun için bir ticket açmalısın, sana yardımcı olayım!"
  - Yetkili gerektiren durumda: [HAZIR] genel soru

━━━━━━━━━━━━━━━━━━━━━━━
SİSTEM KOMUTLARI (Asla başka yerde kullanma)
━━━━━━━━━━━━━━━━━━━━━━━
[RESOLVE] <mesaj>    → AI çözdü, ticket oto-kapanır. Kullanıcıya çözümü yaz.
[HAZIR] <kategori>   → Yetkili gerekli, ticket yetkiliye iletilir.
[BAN_ONAY] <hedef>   → Ban işlemi başlat + ticket oto-kapat.
[WARN_ONAY] <hedef>|<sebep> → Uyarı/mute uygula + ticket oto-kapat.
[REKLAM_ONAY] <tür>|<fiyat>|<konu> → Reklam akışını başlat.

⚠️ Köşeli parantez [ ] karakterlerini yalnızca yukarıdaki komutlar için kullan. Başka hiçbir amaçla kullanma.`;

function isReady(text) {
  return /^\s*\[HAZIR\]/i.test(text.trim());
}

function cleanAI(text) {
  return text
    .replace(/^\s*\[HAZIR\]\s*/i, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
}

// ── Kapatma butonu ──────────────────────────────────────────────────────────
function buildDMCloseButton(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dm_close_${ticketId}`)
      .setLabel('🔒 DM Ticket\'ı Kapat')
      .setStyle(ButtonStyle.Danger)
  );
}

// ── Bot'a DM gelen mesajı işle ──────────────────────────────────────────────
async function handleDMMessage(message, client) {
  const userId = message.author.id;

  // Aktif ticket varsa → kanala ilet (Map'te veya DB'de)
  if (activeDMTickets.has(userId)) {
    await forwardDMToChannel(message, client);
    return;
  }

  // Map'te yok ama DB'de açık DM ticket olabilir (bot restart sonrası)
  try {
    const existing = await Ticket.findOne({ userId, status: 'open', source: 'dm' });
    if (existing && existing.channelId && existing.guildId) {
      activeDMTickets.set(userId, {
        ticketId:  existing.ticketId,
        channelId: existing.channelId,
        guildId:   existing.guildId,
      });
      await forwardDMToChannel(message, client);
      return;
    }
  } catch (_) {}

  // Onay bekleniyor → mesaj yazarsa tekrar sor (buton beklesin)
  if (pendingConfirmation.has(userId)) {
    await message.author.send(
      '👆 Lütfen yukarıdaki butonlardan birini seçin.'
    ).catch(() => {});
    return;
  }

  // İlk kez yazıyor → Üç butonlu akıllı menüyü göster
  if (!dmConversations.has(userId)) {
    pendingConfirmation.set(userId, true);

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle('🛡️ Sentara Akıllı Destek & Emniyet Sistemi')
      .setDescription(
        'Hoş geldiniz! Yapmak istediğiniz işlemi aşağıdaki butonları kullanarak seçebilirsiniz:\n\n' +
        '🟢 **Normal Destek Aç:** Yetkililere doğrudan ulaşmak için bilet oluşturun.\n' +
        '🤖 **Yapay Zeka Destek:** Sorularınızı sormak için EkoBot AI ile doğrudan sohbete başlayın.\n' +
        '🚨 **ACİL YAPAY ZEKAYA BAĞLAN:** Sunucudaki istilacı/abusecileri raporlayıp banlatın veya bot spamlarını durdurun.'
      )
      .setFooter({ text: 'Sentara Güvenlik & Destek' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dm_confirm_yes_${userId}`)
        .setLabel('🟢 Normal Destek Aç')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`dm_confirm_ai_${userId}`)
        .setLabel('🤖 Yapay Zeka Destek')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`dm_confirm_emergency_${userId}`)
        .setLabel('🚨 ACİL AI BAĞLAN')
        .setStyle(ButtonStyle.Danger)
    );

    await message.author.send({ embeds: [embed], components: [row] }).catch((err) => {
      console.error('[dmTicket] Karşılama gönderilemedi:', err.message);
    });
    return;
  }

  // Devam eden AI konuşması
  await continueAIConversation(message, client);
}

// ── AI konuşmasını devam ettir ──────────────────────────────────────────────
async function continueAIConversation(message, client) {
  const userId = message.author.id;
  const history = dmConversations.get(userId);
  const mode = dmModes.get(userId) || 'normal';

  // Normal ticket akışı limiti
  if (mode === 'normal' && history.length >= 14) {
    await createDMTicket(message.author, 'Kullanıcı destek talep etti.', history, client);
    return;
  }

  // Eğer ek yüklenmişse AI'a bunu bildir
  let userText = message.content || '';
  if (message.attachments.size > 0) {
    userText += `\n[SİSTEM UYARISI: Kullanıcı bir kanıt/dosya eki yükledi. Dosya sayısı: ${message.attachments.size}]`;
  }

  history.push({ role: 'user', content: userText });

  try {
    const dmCh = await message.author.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});
  } catch (_) {}

  let aiReply;
  try {
    const prompt = mode === 'emergency_ai' ? EMERGENCY_SYSTEM_PROMPT : DM_SYSTEM_PROMPT;
    aiReply = await chatWithAI(history, prompt);
    history.push({ role: 'assistant', content: aiReply });
  } catch (err) {
    console.error('[dmTicket] AI hata:', err.message);
    await message.author.send(
      '⚠️ Asistan şu an çevrimdışı. Sizi direkt yetkililere bağlıyorum...'
    ).catch(() => {});
    await createDMTicket(message.author, message.content.slice(0, 200), history, client);
    return;
  }

  // Acil komut kontrolleri
  if (mode === 'emergency_ai') {
    // 1. Acil Ban Komutu
    if (aiReply.includes('[BAN_EMERGENCY]')) {
      const match = aiReply.match(/\[BAN_EMERGENCY\]\s*(\d+)/);
      const targetId = match ? match[1] : null;
      if (targetId) {
        try {
          // TARGET_GUILD_ID'den banla
          const guild = await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
          if (guild) {
            await guild.members.ban(targetId, { reason: `Acil AI Emniyet Raporu: İstilacı/Abuseci (Raporlayan: ${message.author.username})` });
            aiReply += `\n\n⚡ **[SİSTEM MESAJI]** <@${targetId}> (${targetId}) kullanıcısı sunucudan başarıyla yasaklandı.`;
          }
        } catch (err) {
          aiReply += `\n\n❌ **[SİSTEM MESAJI]** Yasaklama işlemi başarısız: ${err.message}`;
        }
      }
    }

    // 2. Spam Durdurma Komutu
    if (aiReply.includes('[STOP_SPAM]')) {
      global.SPAM_STOPPED = true;
      aiReply += `\n\n⚡ **[SİSTEM MESAJI]** Güvenlik Protokolü aktifleşti. Botun tüm bildirim planlayıcıları başarıyla durduruldu.`;
    }
  }

  if (isReady(aiReply) && mode === 'normal') {
    const summary = cleanAI(aiReply);
    await createDMTicket(message.author, summary, history, client);
  } else {
    const cleanReply = cleanAI(aiReply) || aiReply;
    await message.author.send(cleanReply).catch(() => {});
  }
}

// ── Evet/Hayır buton işleyici ────────────────────────────────────────────────
async function handleDMConfirmButton(interaction, client) {
  const customId = interaction.customId;

  if (!customId.startsWith('dm_confirm_yes_') && 
      !customId.startsWith('dm_confirm_no_') &&
      !customId.startsWith('dm_confirm_ai_') &&
      !customId.startsWith('dm_confirm_emergency_')) {
    return false;
  }

  const userId = interaction.user.id;
  pendingConfirmation.delete(userId);

  if (customId.startsWith('dm_confirm_no_')) {
    await interaction.update({
      content: '👍 Tamam! İstediğiniz zaman tekrar yazabilirsiniz.',
      embeds: [],
      components: [],
    }).catch(() => {});
    return true;
  }

  if (customId.startsWith('dm_confirm_ai_')) {
    dmConversations.set(userId, []);
    dmModes.set(userId, 'ai');
    await interaction.update({
      content: '🤖 **EkoBot Yapay Zeka Asistanı Bağlandı!**\nSorularınızı yazabilirsiniz. Çözüm odaklı çalışıyorum. 😊',
      embeds: [],
      components: [],
    }).catch(() => {});
    return true;
  }

  if (customId.startsWith('dm_confirm_emergency_')) {
    dmConversations.set(userId, []);
    dmModes.set(userId, 'emergency_ai');
    await interaction.update({
      content: '🚨 **ACİL EMNİYET VE GÜVENLİK SİSTEMİ DEVREDE!**\n\n' +
               'Sunucudaki istilacıları/abusecileri raporlayabilir (kanıt yükleyerek) veya bot spamlarını durdurabilirsiniz.\n' +
               'Lütfen durumu ve varsa şüpheli ID\'lerini yazıp ekran görüntüsü (kanıt) yükleyin.',
      embeds: [],
      components: [],
    }).catch(() => {});
    return true;
  }

  // Evet — Normal ticket açılışı öncesi AI
  dmConversations.set(userId, []);
  dmModes.set(userId, 'normal');

  await interaction.update({
    content: '✅ Harika! Sorununuzu anlatın, detayları alıp sizi yetkililere aktaracağım.',
    embeds: [],
    components: [],
  }).catch(() => {});

  return true;
}

// ── DM ticket kanalı oluştur ────────────────────────────────────────────────
async function createDMTicket(user, summary, history, client) {
  const userId = user.id;
  dmConversations.delete(userId);

  // Kullanıcıya bildir
  await user.send(
    '⏳ **Yetkiliye aktarılıyorsunuz...**\n\n' +
    'Bekleyin — yetkili size yazdığında DM üzerinden bildirim alacaksınız.'
  ).catch(() => {});

  const ticketId = generateTicketId();

  // DM ticketlar sadece GUILD2 (EkoYıldız) sunucusunda açılır
  const targets = [
    { id: GUILD2_ID, categoryId: GUILD2_TICKET_CATEGORY_ID },
  ];

  let createdChannel = null;
  let createdGuildId  = null;

  for (const target of targets) {
    try {
      const guild = await client.guilds.fetch(target.id).catch(() => null);
      if (!guild) continue;

      // İzinler: @everyone göremez, ManageMessages'lı roller görebilir
      const permissionOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      ];
      guild.roles.cache
        .filter(r => r.permissions.has(PermissionFlagsBits.ManageMessages) && !r.managed)
        .forEach(r => permissionOverwrites.push({
          id: r.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        }));

      // Kategori
      let parentId = null;
      if (target.categoryId) {
        const ch = await guild.channels.fetch(target.categoryId).catch(() => null);
        if (ch?.type === ChannelType.GuildCategory) parentId = ch.id;
        else if (ch?.type === ChannelType.GuildText) parentId = ch.parentId;
      }
      if (!parentId) {
        let cat = guild.channels.cache.find(
          c => c.name.toLowerCase().includes('destek') && c.type === ChannelType.GuildCategory
        );
        if (!cat) cat = await guild.channels.create({ name: 'DM TİCKETLAR', type: ChannelType.GuildCategory });
        parentId = cat.id;
      }

      const channel = await guild.channels.create({
        name: `dm-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: parentId,
        permissionOverwrites,
        topic: `DM Ticket | ${user.tag} (${userId})`,
      });

      // Konuşma geçmişi
      const convText = history
        .filter(m => m.role === 'user')
        .map(m => `> ${m.content}`)
        .join('\n')
        .slice(0, 900) || 'Mesaj yok.';

      const embed = new EmbedBuilder()
        .setColor(0x7c6af7)
        .setTitle(`📩 DM Ticket — ${ticketId}`)
        .setDescription(
          `**Kullanıcı:** <@${userId}> (${user.tag})\n` +
          `**Özet:** ${summary || '—'}\n\n` +
          `**DM Konuşması:**\n${convText}`
        )
        .addFields({
          name: '📌 Nasıl çalışır?',
          value:
            '• Bu kanala yazdığınız mesajlar kullanıcıya **DM** olarak iletilir.\n' +
            '• Kullanıcının DM yanıtları bu kanala düşer.\n' +
            '• Kapatmak için 🔒 butonuna basın.',
        })
        .setFooter({ text: `DM Ticket • ${user.tag}` })
        .setTimestamp();

      const closeBtn = buildDMCloseButton(ticketId);
      await channel.send({ embeds: [embed], components: [closeBtn] });

      if (!createdChannel) {
        createdChannel = channel;
        createdGuildId  = guild.id;
      }
    } catch (err) {
      console.warn(`[dmTicket] ${target.id} kanalı açılamadı:`, err.message);
    }
  }

  if (!createdChannel) {
    await user.send('❌ Ticket kanalı oluşturulamadı. Sunucudan destek alın.').catch(() => {});
    return;
  }

  // Ticket DB'ye kaydet
  const ticket = new Ticket({
    ticketId,
    userId,
    userName: user.username,
    category: 'dm',
    subject: (summary || 'DM destek talebi').slice(0, 100),
    description: summary || 'DM destek talebi',
    priority: 'medium',
    channelId: createdChannel.id,
    guildId: createdGuildId,
    source: 'dm',
  });
  await ticket.save();

  activeDMTickets.set(userId, {
    ticketId,
    channelId: createdChannel.id,
    guildId: createdGuildId,
  });

  console.log(`[dmTicket] ${user.tag} → DM ticket: ${ticketId}`);

  // ── Ticket AI devre dışı ─────────────────────────────────────────────────
  // (Ticket AI kaldırıldı)
}

// ── DM → Kanal iletimi ──────────────────────────────────────────────────────
async function forwardDMToChannel(message, client) {
  const userId = message.author.id;

  // Önce memory map'e bak
  let dmInfo = activeDMTickets.get(userId);

  // Map'te yoksa DB'den aç DM ticket'ı bul (bot restart sonrası)
  if (!dmInfo) {
    try {
      const ticket = await Ticket.findOne({ userId, status: 'open', source: 'dm' });
      if (ticket && ticket.channelId && ticket.guildId) {
        // Map'i yeniden doldur
        dmInfo = {
          ticketId:  ticket.ticketId,
          channelId: ticket.channelId,
          guildId:   ticket.guildId,
        };
        activeDMTickets.set(userId, dmInfo);
        console.log(`[dmTicket] DB'den yüklendi: ${ticket.ticketId}`);
      }
    } catch (err) {
      console.warn('[dmTicket] DB ticket araması hatası:', err.message);
    }
  }

  if (!dmInfo) return; // Aktif DM ticket yok

  const guild = await client.guilds.fetch(dmInfo.guildId).catch(() => null);
  if (!guild) {
    activeDMTickets.delete(userId);
    return;
  }

  const channel = await guild.channels.fetch(dmInfo.channelId).catch(() => null);
  if (!channel) {
    // Kanal silinmiş — DB'de de kapat
    activeDMTickets.delete(userId);
    try {
      const Ticket = require('../../models/Ticket');
      const t = await Ticket.findOne({ ticketId: dmInfo.ticketId });
      if (t && t.status === 'open') {
        t.status = 'closed';
        t.closeReason = 'Kanal silindi';
        t.closedAt = new Date();
        await t.save();
      }
    } catch (_) {}

    // Kullanıcıya yeni ticket açma seçeneği sun
    const { ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS, EmbedBuilder: EB } = require('discord.js');
    const embed = new EB()
      .setColor(0xfbbf24)
      .setTitle('📭 Destek Kanalınız Kapandı')
      .setDescription(
        'Destek kanalınız kapatılmış veya silinmiş.\n\n' +
        'Yeni bir destek talebi açmak ister misiniz?'
      )
      .setFooter({ text: 'Sentara Destek' });

    const row = new AR().addComponents(
      new BB()
        .setCustomId(`dm_confirm_yes_${userId}`)
        .setLabel('✅ Evet, yeni destek aç')
        .setStyle(BS.Success),
      new BB()
        .setCustomId(`dm_confirm_no_${userId}`)
        .setLabel('❌ Hayır')
        .setStyle(BS.Secondary)
    );

    // pendingConfirmation'a ekle ki selam mesajı gönderilmesin
    pendingConfirmation.set(userId, true);
    await message.author.send({ embeds: [embed], components: [row] }).catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x4ade80)
    .setAuthor({ name: `${message.author.tag} (DM)`, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content || '*(ek dosya)*')
    .setFooter({ text: '📩 Kullanıcıdan DM' })
    .setTimestamp();

  const sendOpts = { embeds: [embed] };

  // Resim/dosya varsa ekle
  if (message.attachments.size > 0) {
    sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
  }

  await channel.send(sendOpts).catch(() => {});
}

// ── Kanal → DM iletimi ──────────────────────────────────────────────────────
async function forwardChannelToDM(message, client) {
  if (!message.channel.name?.startsWith('dm-')) return false;

  const channelId = message.channel.id;

  // userId'yi bul: önce memory map, yoksa channel topic'ten
  let targetUserId = null;
  for (const [uid, info] of activeDMTickets.entries()) {
    if (info.channelId === channelId) { targetUserId = uid; break; }
  }
  if (!targetUserId && message.channel.topic) {
    const m = message.channel.topic.match(/\((\d{17,20})\)/);
    if (m) targetUserId = m[1];
  }
  if (!targetUserId) return false;

  const user = await client.users.fetch(targetUserId).catch(() => null);
  if (!user) return false;

  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setAuthor({ name: `${message.author.displayName} — Yetkili`, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content)
    .setFooter({ text: 'Sentara Destek • Yetkili mesajı' })
    .setTimestamp();

  await user.send({ embeds: [embed] }).catch(() => {});
  await message.react('✅').catch(() => {});
  return true;
}

// ── DM Ticket Kapat (butona basınca) ────────────────────────────────────────
async function handleDMCloseButton(interaction, client) {
  if (!interaction.customId?.startsWith('dm_close_')) return false;

  const ticketId = interaction.customId.replace('dm_close_', '');

  // DB'den ticket bul
  const ticket = await Ticket.findOne({ ticketId }).catch(() => null);
  if (!ticket) {
    await interaction.reply({ content: '❌ Ticket bulunamadı.', ephemeral: true });
    return true;
  }
  if (ticket.status === 'closed') {
    await interaction.reply({ content: 'ℹ️ Bu ticket zaten kapalı.', ephemeral: true });
    return true;
  }

  // Ticket'ı kapat
  ticket.status  = 'closed';
  ticket.closedAt = new Date();
  ticket.closeReason = `DM ticket kapatıldı — ${interaction.user.tag}`;
  ticket.closedBy   = interaction.user.id;
  ticket.closedByName = interaction.user.username;
  await ticket.save();

  // Memory map'ten userId bul
  let targetUserId = ticket.userId;
  activeDMTickets.delete(targetUserId);
  dmConversations.delete(targetUserId);

  await interaction.reply({ content: '✅ DM Ticket kapatıldı.', ephemeral: true });

  // Kanala kapanış mesajı
  const closeEmbed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🔒 DM Ticket Kapatıldı')
    .setDescription(
      `**Kapatan:** ${interaction.user.tag}\n` +
      `⏳ Kanal 5 dakika içinde silinecek.`
    )
    .setTimestamp();

  await interaction.channel.send({ embeds: [closeEmbed] }).catch(() => {});

  // Kullanıcıya DM — kapandı + 5 yıldız hatırlatması
  try {
    const user = await client.users.fetch(targetUserId);
    const dmEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔒 Destek Talebiniz Kapatıldı')
      .setDescription(
        `Destek talebiniz **${interaction.user.username}** tarafından kapatıldı.\n\n` +
        `⭐ **Değerlendirme yapmayı unutmayın!**\n` +
        `Aldığınız hizmeti değerlendirmek için aşağıdaki butona basın.\n` +
        `5 yıldız verirseniz çok mutlu oluruz! 😊`
      )
      .setFooter({ text: 'Sentara Destek • Tekrar ihtiyaç duyarsanız bize yazın.' })
      .setTimestamp();

    const rateBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rate_ticket_${ticketId}`)
        .setLabel('⭐ Değerlendir')
        .setStyle(ButtonStyle.Primary)
    );

    await user.send({ embeds: [dmEmbed], components: [rateBtn] }).catch(() => {});
  } catch (_) {}

  // 5 dakika sonra kanalı sil
  const channelToDelete = interaction.channel;
  const channelId = channelToDelete.id;
  const guildId   = channelToDelete.guild?.id;

  setTimeout(async () => {
    try {
      // Kanalı yeniden fetch et (restart veya cache sıfırlamasına karşı)
      if (guildId) {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          const ch = await guild.channels.fetch(channelId).catch(() => null);
          if (ch) {
            await ch.delete('DM Ticket kapatıldı — 5 dk sonra silindi');
            console.log(`[dmTicket] Kanal silindi: ${channelId}`);
          }
        }
      } else {
        await channelToDelete.delete('DM Ticket kapatıldı').catch(() => {});
      }
    } catch (err) {
      console.warn('[dmTicket] Kanal silinemedi:', err.message);
    }
  }, 5 * 60 * 1000);

  return true;
}

module.exports = {
  handleDMMessage,
  handleDMConfirmButton,
  forwardChannelToDM,
  handleDMCloseButton,
  activeDMTickets,
};
