'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { chatWithAI } = require('./aiService');
const Ticket = require('../../models/Ticket');

// ── Runtime state ──────────────────────────────────────────────────────────
const conversationHistory = new Map(); // ticketId → [{role,content}]
const inactivityTimers    = new Map(); // ticketId → timer
const activeAITickets     = new Map(); // ticketId → { channelId, guildId, userId, turns }
const pendingBanRequests  = new Map(); // ticketId → { target, userId, channelId, guildId }
const pendingAdRequests   = new Map(); // ticketId → { adType, price, topic, channelId, guildId, userId }
const pendingAdEvidence   = new Map(); // ticketId → { ...adInfo, link }
const pendingWarnRequests = new Map(); // ticketId → { target, reason, userId, channelId, guildId }

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 dakika
const MAX_AI_TURNS       = 10;

const EVIDENCE_CHANNEL_ID = process.env.EVIDENCE_CHANNEL_ID || '1511411777521455256';
const EVIDENCE_GUILD_ID   = process.env.EVIDENCE_GUILD_ID   || '1367646464804655104';
const AD_SALES_CHANNEL_ID = process.env.AD_SALES_CHANNEL_ID || '1511411777521455256';
const AD_SALES_GUILD_ID   = process.env.AD_SALES_GUILD_ID   || '1367646464804655104';

const SYSTEM = `Sen Sentara/EkoYıldız destek botunun yapay zeka asistanısın.
Kullanıcıyla konuş, kategorisine göre akışı yönet. Türkçe, max 300 karakter.

KATEGORİ BAZLI AKIŞLAR:

[BAN/ŞİKAYET - "ban"] 
- Hedef kişiyi ve kanıt iste. Kanıt alınca: [BAN_ONAY] <kullanıcıadı_veya_id>

[REKLAM - "reklam"]
- Fiyat listesini ver: 30₺=Shorts, 50₺=Uzun video alt, 100₺=Uzun video orta bölme
- Tür ve konuyu öğren, sonra: [REKLAM_ONAY] <tür>|<fiyat>|<konu>

[KULLANICI ŞİKAYET - "report"]
- Şikayet edilen kişiyi sor, ne yaptığını sor, kanıt iste
- Kanıt alınca: [WARN_ONAY] <hedef>|<sebep>
- Ciddi ihlalde (küfür, ırkçılık, tehdit): [BAN_ONAY] <hedef>

[ÖDEME SORUNU - "billing"]
- Ödeme kanalını, tutarı ve tarihi sor
- Eğer 24 saat içindeyse: [RESOLVE] Ödemeniz alındı, 24 saat içinde işleme alınır.
- Daha eskiyse: [HAZIR] ödeme sorunu

[TEKNİK SORUN - "technical"]
- Sorunu anla. Bilinen çözüm varsa ver: [RESOLVE] <çözüm>
- Çözemediysen: [HAZIR] teknik sorun

[HESAP SORUNU - "account"]
- Roblox bağlantı sorunlarında /authorize komutunu öner: [RESOLVE] /authorize komutunu çalıştırın
- Başka hesap sorunlarında: [HAZIR] hesap sorunu

[GENEL DESTEK - "genel"]
- Kısa cevap ver. Çözülebildiyse: [RESOLVE] <cevap>
- Çözemediysen: [HAZIR] genel soru

KURALLAR:
- [RESOLVE] = AI halletti, ticket oto-kapanır. Kullanıcıya çözüm yaz.
- [HAZIR] = Yetkili gerekli, ticket yetkililere gider.
- [BAN_ONAY] = Ban uygula + ticket oto-kapan.
- [REKLAM_ONAY] = Reklam akışı başlat.
- [WARN_ONAY] = Uyarı/mute uygula + ticket oto-kapan.
- Asla köşeli parantez başka şey için kullanma.

DESTEK TALEBİ YAZDIKTAN SONRA DEVAM ETME`;

// Yeni: WARN/MUTE akışı
function isReady(t)   { return /\[HAZIR\]/i.test(t); }
function isBan(t)     { return /\[BAN_ONAY\]/i.test(t); }
function isAd(t)      { return /\[REKLAM_ONAY\]/i.test(t); }
function isWarn(t)    { return /\[WARN_ONAY\]/i.test(t); }
function isResolve(t) { return /\[RESOLVE\]/i.test(t); }

function extractWarnInfo(t) {
  const m = t.match(/\[WARN_ONAY\]\s*(.+)/i);
  if (!m) return null;
  const parts = m[1].split('|').map(s => s.trim());
  return { target: parts[0] || '?', reason: parts[1] || 'Kural ihlali' };
}

function extractResolveMsg(t) {
  const m = t.match(/\[RESOLVE\]\s*(.+)/i);
  return m ? m[1].trim() : null;
}

function cleanMsg(t) {
  return t
    .replace(/\[HAZIR\]/gi, '')
    .replace(/\[BAN_ONAY\][^\n]*/gi, '')
    .replace(/\[REKLAM_ONAY\][^\n]*/gi, '')
    .replace(/\[WARN_ONAY\][^\n]*/gi, '')
    .replace(/\[RESOLVE\]/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
}

function extractBanTarget(t) {
  const m = t.match(/\[BAN_ONAY\]\s*(.+)/i);
  return m ? m[1].trim() : null;
}

function extractAdInfo(t) {
  const m = t.match(/\[REKLAM_ONAY\]\s*(.+)/i);
  if (!m) return null;
  const parts = m[1].split('|').map(s => s.trim());
  return { adType: parts[0] || '?', price: parts[1] || '?', topic: parts[2] || '?' };
}

// ── Bot restart sonrası DB'den aktif ticket'ı yükle ─────────────────────────
async function restoreTicketFromDB(channelId, client) {
  try {
    const ticket = await Ticket.findOne({ channelId, status: 'open' });
    if (!ticket) return null;

    // activeAITickets'a ekle
    if (!activeAITickets.has(ticket.ticketId)) {
      activeAITickets.set(ticket.ticketId, {
        channelId: ticket.channelId,
        guildId:   ticket.guildId,
        userId:    ticket.userId,
        turns:     MAX_AI_TURNS - 2, // Restart sonrası neredeyse limitteymişgibi davran
        // Eğer DB'de claim edilmişse duraklatılmış say
        pausedAt:  ticket.claimedBy ? new Date(ticket.claimedAt || Date.now()) : null,
      });
    }
    // conversationHistory'e temel context ekle
    if (!conversationHistory.has(ticket.ticketId)) {
      conversationHistory.set(ticket.ticketId, [
        { role: 'user', content: `Ticket konusu: "${ticket.subject}"\nAçıklama: "${ticket.description}"` },
      ]);
    }
    console.log(`[ticketAI] DB'den yüklendi: ${ticket.ticketId}`);
    return ticket;
  } catch (err) {
    console.warn('[ticketAI] restoreTicketFromDB hata:', err.message);
    return null;
  }
}

// ── Ticket açılınca AI başlar ────────────────────────────────────────────────
async function startAIConversation(channel, ticket, client) {
  try {
    conversationHistory.set(ticket.ticketId, []);
    activeAITickets.set(ticket.ticketId, {
      channelId: channel.id,
      guildId:   channel.guild?.id,
      userId:    ticket.userId,
      turns:     0,
      category:  ticket.category || 'other',
    });

    // Kategori bilgisini sisteme ver
    const ctx = `Kategori: "${ticket.category || 'other'}"\nTicket konusu: "${ticket.subject}"\nAçıklama: "${ticket.description}"`;
    const history = conversationHistory.get(ticket.ticketId);
    history.push({ role: 'user', content: ctx });

    const reply = await chatWithAI(history, SYSTEM);
    history.push({ role: 'assistant', content: reply });

    if (isBan(reply)) {
      await handleBanRequest(channel, ticket, extractBanTarget(reply), [], client);
      return;
    }
    if (isWarn(reply)) {
      await handleWarnRequest(channel, ticket, extractWarnInfo(reply), client);
      return;
    }
    if (isAd(reply)) {
      await handleAdRequest(channel, ticket, extractAdInfo(reply), client);
      return;
    }
    if (isResolve(reply)) {
      const resolveMsg = extractResolveMsg(reply) || cleanMsg(reply);
      await autoResolveTicket(channel, ticket, resolveMsg, client);
      return;
    }
    if (isReady(reply)) {
      activeAITickets.get(ticket.ticketId).turns = MAX_AI_TURNS;
      await notifyStaff(channel, ticket, reply, client);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setAuthor({ name: '🤖 Sentara AI', iconURL: client.user?.displayAvatarURL() })
      .setDescription(cleanMsg(reply))
      .setFooter({ text: 'Çözülmezse yetkililere aktarılırsınız.' });

    await channel.send({ content: `<@${ticket.userId}>`, embeds: [embed] });
    resetInactivityTimer(ticket.ticketId, channel, ticket, client);
  } catch (err) {
    console.error('[ticketAI] startAI hata:', err.message);
    await fallbackNotify(channel, ticket);
  }
}

// ── Kullanıcı mesaj attığında ────────────────────────────────────────────────
async function handleUserMessage(message, client) {
  const channelId = message.channel.id;
  let matchedId = null;
  let ticket = null;

  // Önce memory'de ara
  for (const [tid, info] of activeAITickets.entries()) {
    if (info.channelId === channelId) {
      matchedId = tid;
      break;
    }
  }

  // Map'te yoksa DB'den yükle
  if (!matchedId) {
    ticket = await Ticket.findOne({ channelId });
    if (ticket) {
      matchedId = ticket.ticketId;
      if (!activeAITickets.has(matchedId)) {
        activeAITickets.set(matchedId, {
          userId:    ticket.userId,
          channelId,
          guildId:   ticket.guildId,
          turns:     0,
          pausedAt:  ticket.claimedBy ? new Date(ticket.claimedAt || Date.now()) : null,
        });
        conversationHistory.set(matchedId, []);
      }
    }
  }

  if (!matchedId) return false;

  const info = activeAITickets.get(matchedId);
  if (!ticket) ticket = await Ticket.findOne({ ticketId: matchedId });

  // ── DURAKLATMA KONTROLÜ — her şeyden önce ────────────────────────────────
  // Memory'de pausedAt VEYA DB'de claimedBy varsa AI tamamen susar
  if (info.pausedAt || ticket?.claimedBy) {
    console.log(`[ticketAI] AI durdurulmuş, cevap verilmiyor | yazar: ${message.author.username}`);
    return false;
  }

  // ── Orijinal kullanıcı kontrolü ─────────────────────────────────────────
  const isOriginalUser = message.author.id === info.userId;

  const history = conversationHistory.get(matchedId);
  if (!history || info.turns >= MAX_AI_TURNS) return false;

  // ── Orijinal kullanıcı değil → Moderatör mü? ────────────────────────────
  if (!isOriginalUser) {
    let isModerator = false;

    try {
      if (message.member?.permissions.has('ManageMessages') ||
          message.member?.permissions.has('ModerateMembers') ||
          message.member?.permissions.has('ManageChannels')) {
        isModerator = true;
      }
      if (!isModerator) {
        const { ROLES } = require("./staffSystem");
        const STAFF_ROLES = ROLES;
        for (const roleId of Object.values(STAFF_ROLES)) {
          if (roleId && message.member?.roles.cache.has(roleId)) {
            isModerator = true;
            break;
          }
        }
      }
      if (!isModerator) {
        isModerator = message.member?.roles.cache.some(r => {
          const name = r.name.toLowerCase();
          return name.includes('personel') ||
                 name.includes('moderatör') ||
                 name.includes('sekreter') ||
                 name.includes('yönetici') ||
                 name.includes('yetkili') ||
                 name.includes('admin');
        });
      }
    } catch (e) {
      console.warn('[ticketAI] Moderator detection hata:', e.message);
    }

    if (isModerator) {
      // Moderatör devreye girdi → AI'ı kalıcı olarak durdur
      clearInactivityTimer(matchedId);

      // Memory'de işaretle
      info.pausedAt = new Date();

      // DB'de kalıcı olarak işaretle
      if (ticket) {
        ticket.claimedBy     = message.author.id;
        ticket.claimedByName = message.author.username;
        ticket.claimedAt     = new Date();
        await ticket.save().catch(() => {});
      }

      // Konuşma geçmişini temizle
      conversationHistory.delete(matchedId);
      conversationHistory.set(matchedId, []);

      await message.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0xfbbf24)
          .setAuthor({ name: '🤖 Sentara AI', iconURL: client.user?.displayAvatarURL() })
          .setDescription(
            `**⏸️ AI Durduruldu**\n\n` +
            `Merhaba **${message.author.username}**! 👋\n\n` +
            `Ticketi sen ele aldığın için AI artık **tamamen sessiz**.\n` +
            `Kullanıcıyla kendin ilgilenebilirsin. 💪`
          )
          .setFooter({ text: 'AI Durduruldu • Yetkili Devreye Girdi' })
          .setTimestamp()],
      }).catch(() => {});

      console.log(`[ticketAI] Moderatör devreye girdi (${message.author.username}) — AI kalıcı olarak durduruldu`);
      return true;
    }

    // 3. kişi, moderatör değil → sessiz geç
    return false;
  }

  // ── Orijinal kullanıcı mesaj attı → AI cevap verir ──────────────────────
  resetInactivityTimer(matchedId, message.channel, null, client);
  info.turns++;

  const attachments = [...message.attachments.values()];
  if (attachments.length) await sendEvidence(message, matchedId, attachments, client);

  if (!pendingAdEvidence.has(matchedId) && attachments.length) {
    try {
      const t = await Ticket.findOne({ ticketId: matchedId });
      if (t?.pendingAdEvidence) pendingAdEvidence.set(matchedId, t.pendingAdEvidence);
    } catch (_) {}
  }

  if (pendingAdEvidence.has(matchedId) && attachments.length) {
    await finalizeAdWithEvidence(message, matchedId, attachments, client);
    return true;
  }

  const content = message.content || (attachments.length ? '[Görsel paylaşıldı]' : '');
  history.push({ role: 'user', content });

  try {
    await message.channel.sendTyping();
    const reply = await chatWithAI(history, SYSTEM);
    history.push({ role: 'assistant', content: reply });

    if (isBan(reply)) {
      const t = await Ticket.findOne({ ticketId: matchedId });
      clearInactivityTimer(matchedId);
      await handleBanRequest(message.channel, t, extractBanTarget(reply), attachments, client);
      activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
      return true;
    }
    if (isWarn(reply)) {
      const t = await Ticket.findOne({ ticketId: matchedId });
      clearInactivityTimer(matchedId);
      await handleWarnRequest(message.channel, t, extractWarnInfo(reply), client);
      activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
      return true;
    }
    if (isAd(reply)) {
      const t = await Ticket.findOne({ ticketId: matchedId });
      clearInactivityTimer(matchedId);
      await handleAdRequest(message.channel, t, extractAdInfo(reply), client);
      activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
      return true;
    }
    if (isResolve(reply)) {
      const t = await Ticket.findOne({ ticketId: matchedId });
      clearInactivityTimer(matchedId);
      const resolveMsg = extractResolveMsg(reply) || cleanMsg(reply);
      await autoResolveTicket(message.channel, t, resolveMsg, client);
      activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
      return true;
    }
    if (isReady(reply) || info.turns >= MAX_AI_TURNS) {
      const t = await Ticket.findOne({ ticketId: matchedId });
      clearInactivityTimer(matchedId);
      await notifyStaff(message.channel, t, reply, client);
      activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
      return true;
    }

    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0x7c6af7)
        .setAuthor({ name: '🤖 Sentara AI', iconURL: client.user?.displayAvatarURL() })
        .setDescription(cleanMsg(reply))],
    });
    return true;
  } catch (err) {
    console.error('[ticketAI] handleUserMessage hata:', err.message);
    const t = await Ticket.findOne({ ticketId: matchedId });
    clearInactivityTimer(matchedId);
    await fallbackNotify(message.channel, t);
    activeAITickets.delete(matchedId); conversationHistory.delete(matchedId);
    return true;
  }
}

// ── Otomatik Çözüm — ticket yetkili gerekmeden kapanır ──────────────────────
async function autoResolveTicket(channel, ticket, resolveMsg, client) {
  // Kanala çözüm mesajı
  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x4ade80)
      .setAuthor({ name: '✅ Sentara AI — Sorun Çözüldü', iconURL: client?.user?.displayAvatarURL() })
      .setDescription(resolveMsg)
      .setFooter({ text: 'Sorun çözüldü — ticket otomatik kapatıldı' })
      .setTimestamp()],
  }).catch(() => {});

  // Ticket kapat
  if (ticket) {
    ticket.status      = 'closed';
    ticket.closedAt    = new Date();
    ticket.closeReason = `AI oto-çözüm: ${resolveMsg.slice(0, 100)}`;
    ticket.closedBy    = 'AI';
    await ticket.save().catch(() => {});
  }

  // Kullanıcıya DM bildir
  try {
    const u = await client.users.fetch(ticket?.userId);
    await u.send({
      embeds: [new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle('✅ Destek Talebiniz Çözüldü!')
        .setDescription(
          `**Çözüm:** ${resolveMsg}\n\n` +
          `Sorunuz yapay zeka tarafından yanıtlandı.\n` +
          `⭐ Hizmetimizi değerlendirmeyi unutmayın!`
        )
        .setFooter({ text: 'Eko Yıldız • AI Destek' })
        .setTimestamp()],
    });
  } catch (_) {}

  // 3 dakika sonra kanalı sil
  const channelId = channel.id;
  const guildId   = channel.guild?.id;
  setTimeout(async () => {
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        if (ch) await ch.delete('AI oto-çözüm — kapatıldı').catch(() => {});
      }
    } catch (_) {}
  }, 3 * 60 * 1000);

  console.log(`[ticketAI] Oto-çözüm: ${ticket?.ticketId || '?'}`);
}

// ── Warn/Mute akışı ────────────────────────────────────────────────────────
async function handleWarnRequest(channel, ticket, warnInfo, client) {
  if (!warnInfo) { await fallbackNotify(channel, ticket); return; }

  const { target, reason } = warnInfo;
  const ticketId = ticket?.ticketId || 'bilinmiyor';

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`warn_approve_${ticketId}`).setLabel('⚠️ Uyar/Mute').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`warn_ban_${ticketId}`).setLabel('🔨 Direkt Banla').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`warn_reject_${ticketId}`).setLabel('❌ Reddet').setStyle(ButtonStyle.Secondary)
  );

  // pendingWarnRequests'e kaydet
  pendingWarnRequests.set(ticketId, {
    target, reason,
    userId:    ticket?.userId,
    channelId: channel.id,
    guildId:   channel.guild?.id,
  });

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('⚠️ Kullanıcı Şikayet İşlemi')
      .setDescription(
        `**Şikayet Edilen:** ${target}\n` +
        `**Sebep:** ${reason}\n` +
        `**Talep Eden:** <@${ticket?.userId}>\n\n` +
        `Nasıl işlem yapalım?`
      )
      .setTimestamp()],
    components: [row],
  });
}

// ── Warn buton handler ─────────────────────────────────────────────────────
async function handleWarnButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('warn_approve_') && !cid.startsWith('warn_ban_') && !cid.startsWith('warn_reject_')) return false;

  const ticketId = cid.replace('warn_approve_', '').replace('warn_ban_', '').replace('warn_reject_', '');
  const info = pendingWarnRequests.get(ticketId);
  if (!info) {
    await interaction.reply({ content: '❌ Şikayet talebi bulunamadı.', ephemeral: true });
    return true;
  }

  if (cid.startsWith('warn_reject_')) {
    pendingWarnRequests.delete(ticketId);
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Şikayet Reddedildi')
        .setDescription(`**Reddeden:** ${interaction.user.tag}`).setTimestamp()],
      components: [],
    }).catch(() => {});
    try {
      const u = await client.users.fetch(info.userId);
      await u.send({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('❌ Şikayetiniz Reddedildi')
          .setDescription(`Şikayetiniz yeterli kanıt bulunamadığı için reddedildi.`)
          .setTimestamp()],
      });
    } catch (_) {}
    return true;
  }

  if (cid.startsWith('warn_ban_')) {
    // Ban akışına yönlendir
    pendingWarnRequests.delete(ticketId);
    const ticket = await Ticket.findOne({ ticketId });
    await handleBanRequest(interaction.channel, ticket, info.target, [], client);
    await interaction.update({ components: [] }).catch(() => {});
    return true;
  }

  // Warn/Mute uygula
  await interaction.deferUpdate().catch(() => {});
  let warned = false;
  let warnedTag = info.target;

  try {
    const guild = await client.guilds.fetch(info.guildId).catch(() => null);
    if (guild && info.target) {
      const isId = /^\d{17,20}$/.test(info.target.trim());
      let memberId = isId ? info.target.trim() : null;
      if (!memberId) {
        const members = await guild.members.fetch().catch(() => null);
        const found = members?.find(m =>
          m.user.username.toLowerCase() === info.target.toLowerCase()
        );
        if (found) memberId = found.id;
      }
      if (memberId) {
        // 1 saatlik timeout uygula
        const timeoutUntil = new Date(Date.now() + 60 * 60 * 1000);
        await guild.members.fetch(memberId).then(m =>
          m.timeout(60 * 60 * 1000, `Ticket ${ticketId}: ${info.reason}`)
        );
        warned   = true;
        warnedTag = `<@${memberId}>`;
      }
    }
  } catch (err) { console.warn('[ticketAI] warn hata:', err.message); }

  pendingWarnRequests.delete(ticketId);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(warned ? 0xfbbf24 : 0xed4245)
      .setTitle(warned ? '⚠️ Kullanıcı Uyarıldı (1 saat mute)' : '❌ Uyarı Uygulanamadı')
      .setDescription(warned
        ? `${warnedTag} 1 saat susturuldu.\n**Sebep:** ${info.reason}`
        : `Kullanıcı bulunamadı: \`${info.target}\``)
      .setTimestamp()],
    components: [],
  }).catch(() => {});

  // Şikayet eden kullanıcıya bildir
  try {
    const u = await client.users.fetch(info.userId);
    await u.send({
      embeds: [new EmbedBuilder()
        .setColor(warned ? 0xfbbf24 : 0xed4245)
        .setTitle(warned ? '⚠️ Şikayetiniz İşleme Alındı' : '❌ İşlem Yapılamadı')
        .setDescription(warned
          ? `**${info.target}** 1 saat susturuldu.\nTekrarda daha ağır işlem uygulanacak.`
          : `Hedef kullanıcı bulunamadı. Yetkililere iletildi.`)
        .setTimestamp()],
    });
  } catch (_) {}

  // Ticket oto-kapat
  const ticket = await Ticket.findOne({ ticketId });
  if (ticket) {
    ticket.status = 'closed'; ticket.closedAt = new Date();
    ticket.closeReason = `Şikayet işlendi — ${warned ? 'mute' : 'bulunamadı'}`;
    ticket.closedBy = 'AI';
    await ticket.save().catch(() => {});
  }

  return true;
}

// ── Reklam akışı ─────────────────────────────────────────────────────────────
async function handleAdRequest(channel, ticket, adInfo, client) {
  if (!adInfo) { await fallbackNotify(channel, ticket); return; }

  const { adType, price, topic } = adInfo;
  const ticketId = ticket?.ticketId || 'bilinmiyor';

  // Özel kanala bildir
  try {
    const guild = await client.guilds.fetch(AD_SALES_GUILD_ID).catch(() => null);
    if (guild) {
      const adCh = await guild.channels.fetch(AD_SALES_CHANNEL_ID).catch(() => null);
      if (adCh?.isSendable()) {
        await adCh.send({
          embeds: [new EmbedBuilder()
            .setColor(0xfbbf24)
            .setTitle('💰 İTEM SATIŞ: REKLAM')
            .addFields(
              { name: 'KONU',      value: topic,            inline: true },
              { name: 'HANGİ TÜR', value: adType,           inline: true },
              { name: 'FİYAT',     value: `${price}₺`,      inline: true },
              { name: 'KULLANICI', value: `<@${ticket?.userId}>`, inline: true },
              { name: 'TİCKET',   value: `\`${ticketId}\``, inline: true },
            )
            .setDescription('LÜTFEN LİNK GİRİN')
            .setTimestamp()],
        });
      }
    }
  } catch (_) {}

  pendingAdRequests.set(ticketId, {
    adType, price, topic,
    channelId: channel.id,
    guildId:   channel.guild?.id,
    userId:    ticket?.userId,
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ad_link_${ticketId}`)
      .setLabel('🔗 Link Girin')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('✅ Reklam Talebi Alındı')
      .setDescription(
        `**Tür:** ${adType}\n**Fiyat:** ${price}₺\n**Konu:** ${topic}\n\n` +
        `Lütfen aşağıdaki butona basarak **reklam linkini** girin.`
      )],
    components: [row],
  });
}

// ── "Link Girin" butona basınca modal aç ─────────────────────────────────────
async function handleAdLinkButton(interaction) {
  if (!interaction.customId?.startsWith('ad_link_')) return false;
  const ticketId = interaction.customId.replace('ad_link_', '');

  const modal = new ModalBuilder()
    .setCustomId(`ad_link_modal_${ticketId}`)
    .setTitle('Reklam Linki')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ad_link_input')
          .setLabel('Reklamı yapılacak linki girin')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://...')
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
  return true;
}

// ── Modal submit: link girildi ────────────────────────────────────────────────
async function handleAdLinkModal(interaction) {
  if (!interaction.customId?.startsWith('ad_link_modal_')) return false;
  const ticketId = interaction.customId.replace('ad_link_modal_', '');
  const link = interaction.fields.getTextInputValue('ad_link_input').trim();

  const adInfo = pendingAdRequests.get(ticketId);
  pendingAdRequests.delete(ticketId);

  if (!adInfo) {
    await interaction.reply({ content: '❌ Reklam talebi bulunamadı.', ephemeral: true });
    return true;
  }

  // Kanıt bekleme moduna geç + DB'ye de kaydet (restart-safe)
  const evidenceData = { ...adInfo, link };
  pendingAdEvidence.set(ticketId, evidenceData);
  try {
    const t = await Ticket.findOne({ ticketId });
    if (t) {
      t.pendingAdEvidence = evidenceData;
      await t.save();
    }
  } catch (_) {}

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x4ade80)
      .setTitle('🔗 Link Alındı')
      .setDescription(
        `**Link:** ${link}\n\n` +
        `✅ Ödeme yaptıktan sonra **ekran görüntüsü (SSI)** atın.\n` +
        `📸 SSI alındıktan sonra yetkililere otomatik yönlendirileceksiniz.`
      )],
    ephemeral: false,
  });
  return true;
}

// ── SSI (kanıt) gelince yetkililere aktar ─────────────────────────────────────
async function finalizeAdWithEvidence(message, ticketId, attachments, client) {
  const adInfo = pendingAdEvidence.get(ticketId);
  if (!adInfo) return;
  pendingAdEvidence.delete(ticketId);

  // DB'den pendingAdEvidence temizle
  try {
    const t = await Ticket.findOne({ ticketId });
    if (t) { t.pendingAdEvidence = null; await t.save(); }
  } catch (_) {}

  const ticket = await Ticket.findOne({ ticketId });

  // Kanıt kanalına gönder
  try {
    const guild = await client.guilds.fetch(AD_SALES_GUILD_ID).catch(() => null);
    if (guild) {
      const evCh = await guild.channels.fetch(AD_SALES_CHANNEL_ID).catch(() => null);
      if (evCh?.isSendable()) {
        await evCh.send({
          embeds: [new EmbedBuilder()
            .setColor(0x4ade80)
            .setTitle(`✅ Reklam Ödeme Kanıtı — ${ticketId}`)
            .addFields(
              { name: 'TÜR',       value: adInfo.adType,        inline: true },
              { name: 'FİYAT',     value: `${adInfo.price}₺`,   inline: true },
              { name: 'KONU',      value: adInfo.topic,          inline: true },
              { name: 'LİNK',      value: adInfo.link,           inline: false },
              { name: 'KULLANICI', value: `<@${adInfo.userId}>`, inline: true },
            )],
          files: attachments.map(a => a.url).slice(0, 5),
        });
      }
    }
  } catch (_) {}

  // Kullanıcıya bildir
  try {
    const u = await client.users.fetch(adInfo.userId);
    await u.send({
      embeds: [new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle('📸 SSI Alındı!')
        .setDescription(
          `Ödeme kanıtınız alındı.\n\n` +
          `**Tür:** ${adInfo.adType}\n**Fiyat:** ${adInfo.price}₺\n**Link:** ${adInfo.link}\n\n` +
          `Ekibimiz en kısa sürede reklamınızı yayınlayacak. Teşekkürler! 🙏`
        )
        .setFooter({ text: 'Eko Yıldız • Reklam Sistemi' })
        .setTimestamp()],
    });
  } catch (_) {}

  await notifyStaff(
    message.channel,
    ticket,
    `Reklam ödeme kanıtı alındı — Tür: ${adInfo.adType}, Fiyat: ${adInfo.price}₺, Link: ${adInfo.link}`,
    client
  );
  await message.channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x4ade80)
      .setTitle('✅ Ödeme Kanıtı Alındı')
      .setDescription('Kullanıcı bilgilendirildi. Yetkili ekibimiz reklam yayını için hazırlanıyor.')
      .setTimestamp()],
  }).catch(() => {});
}

// ── Ban akışı ─────────────────────────────────────────────────────────────────
async function handleBanRequest(channel, ticket, target, _attachments, _client) {
  const ticketId = ticket?.ticketId || 'bilinmiyor';
  pendingBanRequests.set(ticketId, {
    target,
    userId:    ticket?.userId,
    channelId: channel.id,
    guildId:   channel.guild?.id,
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ban_approve_${ticketId}`).setLabel('✅ Evet, Banla').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ban_reject_${ticketId}`).setLabel('❌ Hayır, Reddet').setStyle(ButtonStyle.Secondary)
  );

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle('🚨 Ban Talebi')
      .setDescription(
        `**Hedef:** ${target || 'Belirsiz'}\n` +
        `**Talep eden:** <@${ticket?.userId}>\n\n` +
        `Banlama gerçekleşsin mi?`
      )
      .setTimestamp()],
    components: [row],
  });
}

async function handleBanButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('ban_approve_') && !cid.startsWith('ban_reject_')) return false;

  const ticketId = cid.startsWith('ban_approve_')
    ? cid.replace('ban_approve_', '')
    : cid.replace('ban_reject_', '');

  // Map'te yoksa DB'den yükle (restart sonrası)
  let info = pendingBanRequests.get(ticketId);
  if (!info) {
    try {
      const t = await Ticket.findOne({ ticketId });
      if (t?.pendingBan) {
        info = t.pendingBan;
        pendingBanRequests.set(ticketId, info);
      }
    } catch (_) {}
  }

  if (!info) {
    await interaction.reply({ content: '❌ Ban talebi bulunamadı.', ephemeral: true });
    return true;
  }

  if (cid.startsWith('ban_reject_')) {
    pendingBanRequests.delete(ticketId);
    // DB'den temizle
    try {
      const t = await Ticket.findOne({ ticketId });
      if (t) { t.pendingBan = null; await t.save(); }
    } catch (_) {}

    await interaction.update({
      embeds: [new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ Ban Talebi Reddedildi')
        .setDescription(`**Reddeden:** ${interaction.user.tag}\n**Hedef:** ${info.target || '—'}`)
        .setTimestamp()],
      components: [],
    }).catch(() => {});

    // Kullanıcıya gelişmiş bildirim
    try {
      const u = await client.users.fetch(info.userId);
      await u.send({
        embeds: [new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ Ban Talebiniz Reddedildi')
          .setDescription(
            `**Hedef:** ${info.target}\n\n` +
            `Ban talebiniz yetkili tarafından reddedildi.\n` +
            `Başka bir isteğiniz varsa ticket'ınızdan yazabilirsiniz.`
          )
          .setFooter({ text: 'Sentara Destek' })
          .setTimestamp()],
      });
    } catch (_) {}
    return true;
  }

  // Ban onayla
  await interaction.deferUpdate().catch(() => {});
  let banned = false;
  let bannedTag = info.target;
  let bannedId = null;

  try {
    const guild = await client.guilds.fetch(info.guildId).catch(() => null);
    if (guild && info.target) {
      const isId = /^\d{17,20}$/.test(info.target.trim());
      let memberId = isId ? info.target.trim() : null;
      if (!memberId) {
        const members = await guild.members.fetch().catch(() => null);
        const found = members?.find(m =>
          m.user.username.toLowerCase() === info.target.toLowerCase() ||
          m.user.tag.toLowerCase() === info.target.toLowerCase()
        );
        if (found) memberId = found.id;
      }
      if (memberId) {
        await guild.members.ban(memberId, { reason: `Ticket ${ticketId} — ${interaction.user.tag}` });
        banned   = true;
        bannedId  = memberId;
        bannedTag = `<@${memberId}>`;
      }
    }
  } catch (err) { console.warn('[ticketAI] ban hata:', err.message); }

  pendingBanRequests.delete(ticketId);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(banned ? 0x4ade80 : 0xfbbf24)
      .setTitle(banned ? '✅ Ban Uygulandı' : '⚠️ Ban Uygulanamadı')
      .setDescription(banned
        ? `${bannedTag} başarıyla banlandı.\n**Uygulayan:** ${interaction.user.tag}`
        : `Kullanıcı bulunamadı: \`${info.target}\`\nManuel ban gerekebilir.`)
      .setTimestamp()],
    components: [],
  }).catch(() => {});

  // Talep eden kullanıcıya detaylı bildirim
  try {
    const u = await client.users.fetch(info.userId);
    if (banned) {
      await u.send({
        embeds: [new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('✅ Sorununuz Çözüldü!')
          .setDescription(
            `**${info.target}** kullanıcısı başarıyla sunucudan banlandı.\n\n` +
            `Başka bir isteğiniz var mı? Ticket'ınızdan yazabilirsiniz.\n` +
            `⭐ Hizmetimizi değerlendirmeyi unutmayın!`
          )
          .setFooter({ text: 'Sentara Destek' })
          .setTimestamp()],
      });
    } else {
      await u.send({
        embeds: [new EmbedBuilder()
          .setColor(0xfbbf24)
          .setTitle('⚠️ Ban Uygulanamadı')
          .setDescription(
            `Hedef kullanıcı **${info.target}** sunucuda bulunamadı.\n` +
            `Sizi yetkililere aktarıyoruz, konuyu takip edeceğiz.`
          )
          .setFooter({ text: 'Sentara Destek' })
          .setTimestamp()],
      });
    }
  } catch (_) {}

  // Ban log: kanıta kaydet
  if (banned && bannedId) {
    try {
      const guild = await client.guilds.fetch(EVIDENCE_GUILD_ID).catch(() => null);
      if (guild) {
        const ch = await guild.channels.fetch(EVIDENCE_CHANNEL_ID).catch(() => null);
        if (ch?.isSendable()) {
          await ch.send({
            embeds: [new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('🔨 Ban Log')
              .addFields(
                { name: 'Banlanan',    value: `<@${bannedId}> (${info.target})`, inline: true },
                { name: 'Talep Eden',  value: `<@${info.userId}>`,               inline: true },
                { name: 'Uygulayan',   value: interaction.user.tag,              inline: true },
                { name: 'Ticket',      value: `\`${ticketId}\``,                 inline: true },
              )
              .setTimestamp()],
          });
        }
      }
    } catch (_) {}
  }

  // Ban sonrası ticket oto-kapat
  try {
    const t = await Ticket.findOne({ ticketId });
    if (t && t.status === 'open') {
      t.status      = 'closed';
      t.closedAt    = new Date();
      t.closeReason = banned ? `Ban uygulandı: ${info.target}` : 'Ban talebi işlendi';
      t.closedBy    = 'AI';
      await t.save();
    }
  } catch (_) {}

  return true;
}

// ── Kanıt kanalına resim gönder ───────────────────────────────────────────────
async function sendEvidence(message, ticketId, attachments, client) {
  try {
    const guild = await client.guilds.fetch(EVIDENCE_GUILD_ID).catch(() => null);
    if (!guild) return;
    const ch = await guild.channels.fetch(EVIDENCE_CHANNEL_ID).catch(() => null);
    if (!ch?.isSendable()) return;
    const ticket = await Ticket.findOne({ ticketId });
    await ch.send({
      embeds: [new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`🔍 Kanıtlar — ${ticketId}`)
        .setDescription(
          `**Kullanıcı:** <@${message.author.id}>\n` +
          `**Konu:** ${ticket?.subject || '—'}\n` +
          `Kanıtlar aşağıda:`
        )
        .setTimestamp()],
      files: attachments.map(a => a.url).slice(0, 10),
    });
    await message.channel.send('📎 Kanıtlarınız ilgili kanala iletildi.').catch(() => {});
  } catch (err) { console.warn('[ticketAI] sendEvidence hata:', err.message); }
}

// ── Yetkililere aktar ─────────────────────────────────────────────────────────
async function notifyStaff(channel, ticket, summary, client) {
  try {
    const clean = cleanMsg(summary).slice(0, 800) || '—';
    if (ticket) { ticket.aiSummary = clean; await ticket.save(); }

    const guild = channel.guild;
    const mentions = [];
    try {
      const members = await guild.members.fetch();
      members
        .filter(m => {
          if (m.user.bot) return false;
          if (!m.permissions.has('ManageMessages')) return false;
          try { return m.presence?.status !== 'offline'; } catch (_) { return true; }
        })
        .first(3)
        .forEach(m => mentions.push(`<@${m.id}>`));
    } catch (_) {}

    await channel.send({
      content: mentions.length ? `${mentions.join(' ')} — Destek talebi!` : '📢 Aktif yetkili bulunamadı.',
      embeds: [new EmbedBuilder()
        .setColor(0xfbbf24)
        .setTitle('👨‍💼 Yetkili Gerekiyor')
        .setDescription(
          `**Özet:** ${clean}\n` +
          `**Ticket:** \`${ticket?.ticketId || '—'}\`\n` +
          `**Kullanıcı:** <@${ticket?.userId || '?'}>`
        )
        .setTimestamp()],
    });
  } catch (err) { console.error('[ticketAI] notifyStaff hata:', err.message); }
}

// ── Moderatöre "Aferin!" mesajı (sorun çözüldüğünde) ──────────────────────
async function sendModerationPraise(moderatorId, ticket, client) {
  try {
    const { recordTicketSolved } = require('./staffSystem');
    
    // Moderatör'ün ticket çözmesini kaydet
    await recordTicketSolved(moderatorId, client).catch(() => {});

    const user = await client.users.fetch(moderatorId).catch(() => null);
    if (!user) return;

    const embed = new EmbedBuilder()
      .setColor(0x4ade80)
      .setTitle('🎉 Aferin! Ticket Çözüldü!')
      .setDescription(
        `Harika iş çıkardın! Destek talebini başarıyla çözdün!\n\n` +
        `**Ticket:** \`${ticket?.ticketId}\`\n` +
        `**Kullanıcı:** ${ticket?.userName || 'Bilinmiyor'}\n\n` +
        `Senin hakkındaki bilgi personel sistemde kaydedildi.\n` +
        `Çözdüğün ticketlar sayın artıyor — terfi yolunda ilerli! 📈`
      )
      .addFields(
        { name: '✨ Ödül', value: 'Ticket çözmek = Terfi puanı', inline: true },
        { name: '📊 Seviye', value: 'Ticket sayını /personeldurum ile kontrol et', inline: true },
      )
      .setFooter({ text: 'Eko Yıldız • Moderatör Sistemi' })
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => {});
    console.log(`[ticketAI] Moderatörün (${moderatorId}) "aferin" DM gönderildi`);
  } catch (err) {
    console.warn('[ticketAI] sendModerationPraise hata:', err.message);
  }
}

async function fallbackNotify(channel, ticket) {
  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('👨‍💼 Yetkili Gerekiyor')
      .setDescription(
        `**Kullanıcı:** <@${ticket?.userId || '?'}>\n` +
        `**Konu:** ${ticket?.subject || '—'}\n` +
        `AI şu an yanıt veremiyor, yetkili bekleniyor.`
      )
      .setTimestamp()],
  }).catch(() => {});
}

// ── İnaktivite timer ──────────────────────────────────────────────────────────
function resetInactivityTimer(ticketId, channel, ticket, client) {
  clearInactivityTimer(ticketId);
  const channelId = channel.id;
  const guildId   = channel.guild?.id;

  const timer = setTimeout(async () => {
    try {
      const t = ticket || await Ticket.findOne({ ticketId });
      if (!t || t.status === 'closed') return;

      // Kullanıcıya DM uyarısı
      try {
        const u = await client.users.fetch(t.userId);
        await u.send({
          embeds: [new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('⏰ Ticket İnaktivite Nedeniyle Kapatıldı')
            .setDescription(
              '10 dakika boyunca yanıt vermediğiniz için destek talebiniz kapatıldı.\n\n' +
              'Yeni bir destek talebi açmak için bot\'a DM atabilirsiniz.'
            )
            .setTimestamp()],
        });
      } catch (_) {}

      t.status      = 'closed';
      t.closedAt    = new Date();
      t.closeReason = 'İnaktivite (10 dk)';
      t.closedBy    = 'AI';
      await t.save();

      // Kanalı taze fetch et
      try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          const ch = await guild.channels.fetch(channelId).catch(() => null);
          if (ch) {
            await ch.send({
              embeds: [new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('⏰ Ticket Kapatıldı')
                .setDescription('Kullanıcı 10 dakika boyunca yanıt vermedi.')
                .setTimestamp()],
            }).catch(() => {});
            await ch.permissionOverwrites.edit(t.userId, { ViewChannel: false, SendMessages: false }).catch(() => {});
          }
        }
      } catch (_) {}

      const { scheduleTicketDeletion } = require('./ticketCleanup');
      scheduleTicketDeletion(ticketId);
    } catch (err) { console.error('[ticketAI] inactivity hata:', err.message); }

    activeAITickets.delete(ticketId);
    conversationHistory.delete(ticketId);
  }, INACTIVITY_TIMEOUT);

  inactivityTimers.set(ticketId, timer);
}

function clearInactivityTimer(ticketId) {
  const t = inactivityTimers.get(ticketId);
  if (t) { clearTimeout(t); inactivityTimers.delete(ticketId); }
}

function cleanupTicketAI(ticketId) {
  clearInactivityTimer(ticketId);
  activeAITickets.delete(ticketId);
  conversationHistory.delete(ticketId);
  inactivityTimers.delete(ticketId);
  pendingBanRequests.delete(ticketId);
  pendingAdRequests.delete(ticketId);
  pendingAdEvidence.delete(ticketId);
  pendingWarnRequests.delete(ticketId);
  console.log(`[ticketAI] Cleaned up ticket ${ticketId} from all Maps`);
}

module.exports = {
  startAIConversation,
  handleUserMessage,
  handleBanButton,
  handleWarnButton,
  handleAdLinkButton,
  handleAdLinkModal,
  cleanupTicketAI,
  sendModerationPraise,
};
