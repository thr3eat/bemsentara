'use strict';

const { EmbedBuilder } = require('discord.js');
const { chatWithAI } = require('./aiService');

// ── Konfigürasyon ──────────────────────────────────────────────────────────
const STAFF_GUILD_ID = process.env.STAFF_GUILD_ID || '1367646464804655104'; // EkoYıldız

// AI'ın izleyeceği sohbet kanalları (EkoYıldız genel sohbet kanalları)
// Boş bırakılırsa guild'deki tüm text kanallar izlenir
const MONITORED_CHANNEL_IDS = (process.env.AI_CHAT_CHANNELS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

// Ayarlar
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 dakika
const ACTIVE_WINDOW_MS      = 30 * 60 * 1000; // Son 30 dk'da mesaj yazan = aktif
const AI_COOLDOWN_MS        = 5 * 60 * 1000;  // Aynı moderatöre 5 dk'da 1 kez DM
const AI_CHANNEL_COOLDOWN_MS = 3 * 60 * 1000; // Aynı kanala 3 dk'da 1 kez AI mesajı

// ── Durum ──────────────────────────────────────────────────────────────────
// userId → { channelId, timestamp, timerId }
const pendingModMessages = new Map();

// channelId → [{ userId, username, timestamp }]  — Son mesajları tutan buffer
const channelActivity = new Map();

// userId → timestamp — Son DM gönderim zamanı (spam önleme)
const lastDMSent = new Map();

// channelId → timestamp — Son AI kanal mesajı (spam önleme)
const lastAIChannelMessage = new Map();

// ── Staff rol ID'leri (staffSystem'den alınacak) ──────────────────────────
function getStaffRoleIds() {
  try {
    const { ROLES } = require('./staffSystem');
    return Object.values(ROLES).filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Bir üyenin staff olup olmadığını kontrol et
 */
function isStaffMember(member) {
  if (!member || !member.roles) return false;
  const staffRoleIds = getStaffRoleIds();
  return staffRoleIds.some(rid => member.roles.cache.has(rid));
}

/**
 * Kanaldaki son aktif moderatörleri bul (son 30 dk'da mesaj yazan)
 */
function getActiveModsInChannel(channelId, excludeUserId) {
  const activity = channelActivity.get(channelId) || [];
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  
  // Son 30 dk'da mesaj yazan unique moderatörleri bul
  const activeMods = new Map();
  for (const entry of activity) {
    if (entry.timestamp >= cutoff && entry.userId !== excludeUserId && entry.isStaff) {
      activeMods.set(entry.userId, {
        userId: entry.userId,
        username: entry.username,
        timestamp: entry.timestamp,
      });
    }
  }
  
  return Array.from(activeMods.values());
}

/**
 * Kanala mesaj kaydı ekle
 */
function recordChannelMessage(channelId, userId, username, isStaff) {
  if (!channelActivity.has(channelId)) {
    channelActivity.set(channelId, []);
  }
  
  const activity = channelActivity.get(channelId);
  activity.push({ userId, username, timestamp: Date.now(), isStaff });
  
  // Eski kayıtları temizle (30 dk'dan eski)
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  const filtered = activity.filter(a => a.timestamp >= cutoff);
  channelActivity.set(channelId, filtered);
}

/**
 * Moderatör mesaj yazdığında çağrılır
 * 10 dk timer başlatır, kimse cevap vermezse DM atar
 */
function startInactivityTimer(userId, username, channelId, channel, client) {
  // Önceki timer'ı iptal et
  cancelInactivityTimer(userId);
  
  const timerId = setTimeout(async () => {
    pendingModMessages.delete(userId);
    
    // DM cooldown kontrolü
    const lastDM = lastDMSent.get(userId) || 0;
    if (Date.now() - lastDM < AI_COOLDOWN_MS) return;
    
    try {
      // Aktif moderatörleri bul
      const activeMods = getActiveModsInChannel(channelId, userId);
      
      if (activeMods.length > 0) {
        // Başka aktif moderatörler var — DM at ve onları eşleştir
        const modNames = activeMods.map(m => `**${m.username}**`).join(', ');
        
        const embed = new EmbedBuilder()
          .setColor(0x7c6af7)
          .setTitle('💬 Sohbet Kanalında Aktif Moderatörler Var!')
          .setDescription(
            `Sohbet kanalında mesajına 10 dakikadır kimse cevap vermedi.\n\n` +
            `🟢 **Şu an aktif moderatörler:** ${modNames}\n\n` +
            `💡 Onlarla sohbet edebilirsin! Belki de aynı şeyi düşünüyorsunuzdur. 😊\n\n` +
            `📍 **Kanal:** <#${channelId}>`
          )
          .setFooter({ text: 'Eko Yıldız • AI Sohbet Asistanı' })
          .setTimestamp();
        
        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({ embeds: [embed] }).catch(() => {});
          lastDMSent.set(userId, Date.now());
          console.log(`[aiChannelChat] DM gönderildi: ${username} → aktif modlar: ${activeMods.map(m => m.username).join(', ')}`);
        }
        
        // Aktif moderatörlere de DM at
        for (const mod of activeMods) {
          const modLastDM = lastDMSent.get(mod.userId) || 0;
          if (Date.now() - modLastDM < AI_COOLDOWN_MS) continue;
          
          const modEmbed = new EmbedBuilder()
            .setColor(0x4ade80)
            .setTitle('💬 Sohbet Kanalında Birisi Seninle Konuşmak İstiyor!')
            .setDescription(
              `**${username}** sohbet kanalında mesaj yazdı ama kimse cevap vermedi.\n\n` +
              `💡 Ona cevap yaz, birlikte sohbet edin! Takım ruhu önemli! 🤝\n\n` +
              `📍 **Kanal:** <#${channelId}>`
            )
            .setFooter({ text: 'Eko Yıldız • AI Sohbet Asistanı' })
            .setTimestamp();
          
          const modUser = await client.users.fetch(mod.userId).catch(() => null);
          if (modUser) {
            await modUser.send({ embeds: [modEmbed] }).catch(() => {});
            lastDMSent.set(mod.userId, Date.now());
          }
        }
      } else {
        // Hiç aktif moderatör yok — AI kanalda cevap versin
        const lastAIMsg = lastAIChannelMessage.get(channelId) || 0;
        if (Date.now() - lastAIMsg < AI_CHANNEL_COOLDOWN_MS) return;
        
        try {
          const aiPrompt = `Sen Eko Yıldız Discord sunucusunun AI sohbet asistanısın.
Bir moderatör (${username}) sohbet kanalında mesaj yazdı ama 10 dakikadır kimse cevap vermedi.
Ona samimi ve neşeli bir Türkçe cevap yaz. Sohbeti devam ettirmeye çalış.
Kısa tut (max 150 karakter). Ona selam ver ve ne yaptığını sor veya günlük bir sohbet aç.
Mesajında emoji kullan.`;
          
          const aiResponse = await chatWithAI([{ role: 'user', content: aiPrompt }], '');
          const cleanResponse = aiResponse?.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          
          if (cleanResponse && channel) {
            await channel.send(`🤖 ${cleanResponse}`).catch(() => {});
            lastAIChannelMessage.set(channelId, Date.now());
            console.log(`[aiChannelChat] AI kanal mesajı gönderildi: #${channel.name} → "${cleanResponse.slice(0, 50)}"`);
          }
        } catch (aiErr) {
          console.warn('[aiChannelChat] AI cevap hatası:', aiErr.message);
        }
        
        // Moderatöre de DM at
        const embed = new EmbedBuilder()
          .setColor(0xfbbf24)
          .setTitle('💬 Sohbet Kanalında Yalnızsın!')
          .setDescription(
            `Sohbet kanalında 10 dakikadır kimse cevap vermedi. 😅\n\n` +
            `🤖 AI asistanın kanala bir mesaj bıraktı!\n\n` +
            `💡 Şu an aktif başka moderatör yok gibi görünüyor. Ama merak etme, birileri gelecektir!\n\n` +
            `📍 **Kanal:** <#${channelId}>`
          )
          .setFooter({ text: 'Eko Yıldız • AI Sohbet Asistanı' })
          .setTimestamp();
        
        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({ embeds: [embed] }).catch(() => {});
          lastDMSent.set(userId, Date.now());
        }
      }
    } catch (err) {
      console.error('[aiChannelChat] Inactivity handler hatası:', err.message);
    }
  }, INACTIVITY_TIMEOUT_MS);
  
  pendingModMessages.set(userId, { channelId, timestamp: Date.now(), timerId, username });
}

/**
 * Timer'ı iptal et (birisi cevap verdiğinde)
 */
function cancelInactivityTimer(userId) {
  const pending = pendingModMessages.get(userId);
  if (pending && pending.timerId) {
    clearTimeout(pending.timerId);
    pendingModMessages.delete(userId);
  }
}

/**
 * Bir kanaldaki tüm bekleyen timer'ları iptal et (birisi o kanala mesaj yazdığında)
 */
function cancelChannelTimers(channelId, responderId) {
  for (const [userId, pending] of pendingModMessages.entries()) {
    if (pending.channelId === channelId && userId !== responderId) {
      clearTimeout(pending.timerId);
      pendingModMessages.delete(userId);
    }
  }
}

/**
 * Ana mesaj handler — messageCreate event'inden çağrılır
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Client} client
 * @returns {boolean} handled
 */
async function handleAIChatMessage(message, client) {
  try {
    // Sadece belirtilen guild'de çalış
    if (!message.guild || message.guild.id !== STAFF_GUILD_ID) return false;
    if (message.author.bot) return false;
    
    const channelId = message.channel.id;
    
    // Belirli kanallar belirlenmişse sadece onları izle
    if (MONITORED_CHANNEL_IDS.length > 0 && !MONITORED_CHANNEL_IDS.includes(channelId)) {
      return false;
    }
    
    // Ticket, DM ve sistem kanallarını atla
    const channelName = message.channel.name || '';
    if (channelName.startsWith('ticket-') || channelName.startsWith('dm-') || channelName.startsWith('log')) {
      return false;
    }
    
    const isStaff = isStaffMember(message.member);
    
    // Kanal aktivitesini kaydet
    recordChannelMessage(channelId, message.author.id, message.author.username, isStaff);
    
    // Birisi bu kanala mesaj yazdı — bu kanaldaki bekleyen timer'ları iptal et
    cancelChannelTimers(channelId, message.author.id);
    
    // Eğer mesaj yazan moderatörse, 10 dk timer başlat
    // (İPTAL EDİLDİ: Kullanıcı isteği üzerine bu sistem kapatıldı)
    if (isStaff) {
      // startInactivityTimer(
      //   message.author.id,
      //   message.author.username,
      //   channelId,
      //   message.channel,
      //   client
      // );
    }
    
    return false; // Diğer handler'ların da çalışmasına izin ver
  } catch (err) {
    console.error('[aiChannelChat] handleAIChatMessage hatası:', err.message);
    return false;
  }
}

/**
 * AI kanal sohbet izleme servisini başlat
 */
function startAIChatMonitor(client) {
  // Her 5 dakikada bir eski verileri temizle
  setInterval(() => {
    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    
    for (const [channelId, activity] of channelActivity.entries()) {
      const filtered = activity.filter(a => a.timestamp >= cutoff);
      if (filtered.length === 0) {
        channelActivity.delete(channelId);
      } else {
        channelActivity.set(channelId, filtered);
      }
    }
    
    // Eski DM cooldown'ları temizle
    for (const [userId, timestamp] of lastDMSent.entries()) {
      if (Date.now() - timestamp > AI_COOLDOWN_MS * 2) {
        lastDMSent.delete(userId);
      }
    }
    
    // Eski AI kanal cooldown'ları temizle
    for (const [channelId, timestamp] of lastAIChannelMessage.entries()) {
      if (Date.now() - timestamp > AI_CHANNEL_COOLDOWN_MS * 2) {
        lastAIChannelMessage.delete(channelId);
      }
    }
  }, 5 * 60 * 1000);
  
  console.log(`[aiChannelChat] ✅ AI Kanal Sohbet İzleme başlatıldı (Guild: ${STAFF_GUILD_ID}, İzlenen kanallar: ${MONITORED_CHANNEL_IDS.length > 0 ? MONITORED_CHANNEL_IDS.join(', ') : 'TÜM KANALLAR'})`);
}

module.exports = {
  handleAIChatMessage,
  startAIChatMonitor,
};
