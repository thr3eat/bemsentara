const fs = require('fs/promises');
const path = require('path');
const {
  GUILD2_ID,
  EKOYILDIZ_SAYI_SAYMACA_CHANNEL_ID,
  EKOYILDIZ_KELIME_OYUNU_CHANNEL_ID,
  EKOYILDIZ_BOM_CHANNEL_ID,
  EKOYILDIZ_STORY_GAME_CHANNEL_ID
} = require("../../config");
const { chatWithAI } = require('./aiService');
const { awardGameXP } = require('./frogLevel');

// --- In-Memory States for EkoYıldız Games ---

// Sayı Saymaca Game State
let currentCountingNumber = null;
let lastCountingUser = null;
let countingSynced = false;

// Bom Game State
let currentBomNumber = null;
let lastBomUser = null;
let bomSynced = false;

// Word Game State
let lastWordLetter = null;
let lastWordUser = null;
const usedWords = new Set();
let wordSynced = false;

// Kelime oyunu puan tablosu (userId -> puan)
const wordGameScores = new Map();

/**
 * Türkçe'de hiçbir kelime bu harflerle başlamaz — çıkmaz harfler.
 * Oyuncu bu harfle biten kelime yazarsa +10 puan kazanır ve
 * sistem rastgele güvenli bir harf seçerek oyunu sürdürür.
 */
const CIKMAZHARF = new Set(['ğ']);

/** Güvenli başlangıç harfleri (çıkmaz olmayan yaygın harfler) */
const GUVENLI_HARFLER = ['a','b','c','d','e','f','g','h','i','k','l','m','n','o','p','r','s','t','u','v','y','z'];

function rastgeleGuvenliHarf() {
  return GUVENLI_HARFLER[Math.floor(Math.random() * GUVENLI_HARFLER.length)];
}

function addWordScore(userId, puan) {
  wordGameScores.set(userId, (wordGameScores.get(userId) || 0) + puan);
  return wordGameScores.get(userId);
}

function getWordScore(userId) {
  return wordGameScores.get(userId) || 0;
}

// Story Game State
let lastStoryUser = null;
let needsGiris = true;
let storySynced = false;
const storyGameStates = new Map();
const fastGameTurnTimestamps = new Map();
const gameXpProgress = new Map();
const GAME_XP_MIN_TURNS = 70;
const GAME_XP_MAX_TURNS = 100;
const STORY_GAME_CHANNEL_IDS = new Set([
  String(EKOYILDIZ_STORY_GAME_CHANNEL_ID || '').trim(),
  '1524056041158086767'
].filter(Boolean));
const STORY_STATE_FILE = path.join(__dirname, '../../data/storyGameState.json');

function isStoryGameChannel(channelId) {
  return STORY_GAME_CHANNEL_IDS.has(String(channelId || '').trim());
}

function sanitizeStoryText(text) {
  const cleaned = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[…]/g, '...')
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned
    .replace(/\((?:sorun\s+var|problem|hata|not)\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isMeaningfulStoryText(text) {
  const cleaned = sanitizeStoryText(text);
  if (!cleaned) return false;
  const letters = (cleaned.match(/[a-zA-ZğĞüÜşŞıİöÖçÇ]/g) || []).length;
  const punctuation = (cleaned.match(/[.!?]/g) || []).length;
  const nonsense = /(?:sorun var|problem|hata|saçma|anlamsız|bozuk|\?\?\?)/i.test(cleaned);
  return letters >= 10 && punctuation >= 1 && !nonsense;
}

function buildFallbackStoryContinuation(existingStory, userMessage) {
  const trimmed = String(userMessage || '').trim();
  if (!trimmed) return 'Bir anda kapı aralandı ve herkesin nefesi kesildi.';
  const lower = trimmed.toLowerCase();
  if (/(korku|gizem|gece|kapı|ses|ışık|rüzgar|yol|sokak|duvar|canavar|cadı|hazine|sır|gizli|telefon|saat|bulut|dünya)/.test(lower)) {
    return 'O sırada ortalık aniden soğudu ve herkesin içinden bir soru geçti: bu gerçekten bir rastlantı mıydı?';
  }
  if (/(sev|aşk|kalp|gül|mutlu|kutlama|parti|şarkı|dans)/.test(lower)) {
    return 'Neşeli bir ses yükseldi ve bu anı hatırlayan herkes bir anda gülmeye başladı.';
  }
  return 'Bir anda zaman sanki durdu ve herkes bu garip anın ne anlama geldiğini anlamaya çalıştı.';
}

async function persistStoryState(channelId, state) {
  try {
    await fs.mkdir(path.dirname(STORY_STATE_FILE), { recursive: true });
    await fs.writeFile(STORY_STATE_FILE, JSON.stringify({
      channelId,
      active: Boolean(state.active),
      story: String(state.story || ''),
      waitingForUser: Boolean(state.waitingForUser),
      lastActor: state.lastActor || 'none',
      lastUserId: state.lastUserId || null,
      updatedAt: new Date().toISOString()
    }, null, 2));
  } catch (err) {
    console.warn('[ekoGames] Hikaye durumu yazılamadı:', err.message);
  }
}

async function readPersistedStoryState(channelId) {
  try {
    const raw = await fs.readFile(STORY_STATE_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data || data.channelId && String(data.channelId) !== String(channelId)) {
      return null;
    }
    return data;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[ekoGames] Hikaye durumu okunamadı:', err.message);
    }
    return null;
  }
}

async function restoreStoryStateFromHistory(channel) {
  if (!channel?.messages?.fetch) return null;
  try {
    const messages = await channel.messages.fetch({ limit: 40 });
    const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const relevantMessages = sorted.filter(msg => {
      if (!msg.content || msg.author.bot === false) return false;
      const text = String(msg.content).trim();
      if (!text) return false;
      return !/🌟|🏁|hikayeye sen devam et|sıranı bekle|Hikaye zaten hazır değil/i.test(text);
    });

    const storyParts = relevantMessages
      .map(msg => sanitizeStoryText(msg.content))
      .filter(Boolean)
      .filter(text => isMeaningfulStoryText(text));

    if (storyParts.length === 0) return null;

    return {
      active: true,
      story: storyParts.join('\n\n'),
      waitingForUser: true,
      lastActor: 'bot',
      lastUserId: null
    };
  } catch (err) {
    console.warn('[ekoGames] Hikaye geçmişi okunamadı:', err.message);
    return null;
  }
}

async function restoreStoryState(channel) {
  const state = getStoryGameState(channel.id);
  const persisted = await readPersistedStoryState(channel.id);
  if (persisted && persisted.story) {
    state.active = Boolean(persisted.active);
    state.story = String(persisted.story || '');
    state.waitingForUser = Boolean(persisted.waitingForUser);
    state.lastActor = persisted.lastActor || 'bot';
    state.lastUserId = persisted.lastUserId || null;
    return true;
  }

  const historyState = await restoreStoryStateFromHistory(channel);
  if (historyState) {
    state.active = Boolean(historyState.active);
    state.story = String(historyState.story || '');
    state.waitingForUser = Boolean(historyState.waitingForUser);
    state.lastActor = historyState.lastActor || 'bot';
    state.lastUserId = historyState.lastUserId || null;
    await persistStoryState(channel.id, state);
    return true;
  }
  return false;
}

function getStoryGameState(channelId) {
  if (!storyGameStates.has(channelId)) {
    storyGameStates.set(channelId, { active: false, story: '', waitingForUser: false, lastActor: 'none', lastUserId: null });
  }
  return storyGameStates.get(channelId);
}

function isModeratorMember(member) {
  if (!member) return false;
  if (member.permissions?.has?.(1 << 13) || member.permissions?.has?.(1 << 5)) return true;
  const roleNames = (member.roles?.cache?.map(r => String(r.name || '').toLowerCase()) || []);
  return roleNames.some(name => /(mod|moderator|yetkili|admin|owner|komutan|coordinator)/.test(name));
}

function getNextGameXpThreshold() {
  return GAME_XP_MIN_TURNS + Math.floor(Math.random() * (GAME_XP_MAX_TURNS - GAME_XP_MIN_TURNS + 1));
}

async function awardGameXPForTurn(message, gameName, baseXP, client) {
  const member = message.member || await message.guild?.members?.fetch(message.author.id).catch(() => null);
  if (!member || member.user.bot) return null;

  const progressKey = `${gameName}:${member.id}`;
  const progress = gameXpProgress.get(progressKey) || { count: 0, needed: getNextGameXpThreshold() };
  progress.count += 1;

  if (progress.count < progress.needed) {
    gameXpProgress.set(progressKey, progress);
    return null;
  }

  progress.count = 0;
  progress.needed = getNextGameXpThreshold();
  gameXpProgress.set(progressKey, progress);

  const now = message.createdTimestamp;
  const lastTurnAt = fastGameTurnTimestamps.get(message.channel.id) || 0;
  const isFast = Boolean(lastTurnAt && (now - lastTurnAt) <= 10000);
  fastGameTurnTimestamps.set(message.channel.id, now);

  const staffBonus = isModeratorMember(member) ? 8 : 0;
  const multiplier = isFast ? 1.6 : 1;
  const totalXp = Math.round(baseXP * multiplier) + staffBonus;

  const details = [];
  if (isFast) details.push('⚡ Hızlı oyun bonusu');
  if (staffBonus > 0) details.push('🛡️ Yetkili bonusu');

  return awardGameXP(member, client, {
    amount: totalXp,
    reason: `${gameName} oyunu`,
    details: details.join(' • ') || 'Normal oyun başarısı',
    multiplier,
    staffBonus,
  });
}

async function generateStoryOpening() {
  const prompt = [
    'Discord hikaye oyununda kullanılacak, kısa, mantıklı ve sürükleyici bir hikaye başlangıcı yaz.',
    '1-2 cümle uzunluğunda olsun.',
    'Kullanıcı katkısı için uygun bir başlangıç noktası olsun.',
    'Sadece hikaye metnini yaz.',
    'Hiçbir başlık, emoji, liste, açıklama veya parantezli not ekleme.',
    'Bozuk Unicode karakter, garip sembol veya anlamsız soru işareti kullanma.',
    'Normal Türkçe karakterler ve standart noktalama kullan.',
    'Açıkça saçma, kopuk veya anlamsız bir metin üretme.'
  ].join(' ');

  try {
    const reply = await chatWithAI([{ role: 'user', content: prompt }], '', 'story');
    const cleaned = sanitizeStoryText(reply);
    return isMeaningfulStoryText(cleaned)
      ? cleaned
      : 'Bir gece, sokak lambalarının altında garip bir ses duyuldu ve dünya bir anda hiç beklemediği bir şekilde değişmeye başladı.';
  } catch (err) {
    console.warn('[ekoGames] Hikaye başlangıcı üretilemedi:', err.message);
    return 'Bir gece, sokak lambalarının altında garip bir ses duyuldu ve dünya bir anda hiç beklemediği bir şekilde değişmeye başladı.';
  }
}

async function generateStoryContinuation(existingStory, userMessage) {
  const prompt = [
    'Aşağıdaki hikayeyi, kullanıcı katkısına göre mantıklı ve akıcı bir şekilde devam ettir.',
    'Kullanıcı katkısı:', userMessage,
    'Hikaye:', existingStory,
    'Kurallar:',
    '- 1-2 cümle kadar kısa ve akıcı olsun.',
    '- Hikayenin bağlamını koru ve önceki cümlelerle bağlantılı olsun.',
    '- Karakterleri, mekânı ve olay akışını tutarlı tut.',
    '- Eğlenceli, sürükleyici ve doğal bir devam olsun.',
    '- Bozuk Unicode karakter, garip sembol veya anlamsız soru işareti kullanma.',
    '- Sadece hikaye metnini yaz.',
    '- Hiçbir başlık, emoji, liste, açıklama veya parantezli not ekleme.',
    '- Saçma, kopuk veya anlamsız cümleler üretme.'
  ].join('\n');

  try {
    const reply = await chatWithAI([{ role: 'user', content: prompt }], '', 'story');
    const cleaned = sanitizeStoryText(reply);
    return isMeaningfulStoryText(cleaned)
      ? cleaned
      : buildFallbackStoryContinuation(existingStory, userMessage);
  } catch (err) {
    console.warn('[ekoGames] Hikaye devamı üretilemedi:', err.message);
    return buildFallbackStoryContinuation(existingStory, userMessage);
  }
}

async function generateStoryEnding(existingStory) {
  const prompt = [
    'Aşağıdaki hikayeyi kısa ve tatmin edici şekilde sonlandır.',
    'Hikaye:', existingStory,
    'Bozuk Unicode karakter, garip sembol veya anlamsız soru işareti kullanma.',
    'Sadece hikaye metnini yaz, açıklama ekleme.',
    'Hiçbir başlık, emoji, liste, açıklama veya parantezli not ekleme.',
    'Saçma ve kopuk bir sonuç üretme.'
  ].join('\n');

  try {
    const reply = await chatWithAI([{ role: 'user', content: prompt }], '', 'story');
    const cleaned = sanitizeStoryText(reply);
    return isMeaningfulStoryText(cleaned)
      ? cleaned
      : 'Ve böylece o gece, herkesin unutamayacağı bir anı olarak hafızalara kazındı.';
  } catch (err) {
    console.warn('[ekoGames] Hikaye bitişi üretilemedi:', err.message);
    return 'Ve böylece o gece, herkesin unutamayacağı bir anı olarak hafızalara kazındı.';
  }
}

async function startStoryGame(channel) {
  return null;
}

async function finishStoryGame(channel) {
  return null;
}

async function continueStoryGame(message, client) {
  return true;
}

// ─── Kullanıcı İstatistikleri (oyun türü bazlı) ───────────────────────────────
// yapı: { doğru: number, yanlış: number }
const userStats = new Map(); // key: `${userId}:${oyun}` → { dogru, yanlis }

function getStats(userId, oyun) {
  const key = `${userId}:${oyun}`;
  if (!userStats.has(key)) userStats.set(key, { dogru: 0, yanlis: 0 });
  return userStats.get(key);
}

async function showYanlisBildirim(message, oyunAdi, nedenMesaj) {
  const stats = getStats(message.author.id, oyunAdi);
  stats.yanlis++;
  const { EmbedBuilder } = require('discord.js');
  const embed = new EmbedBuilder()
    .setTitle(`❌ Yanlış — ${oyunAdi}`)
    .setColor(0xed4245)
    .setDescription(`<@${message.author.id}>, ${nedenMesaj}`)
    .addFields(
      { name: '✅ Doğru', value: String(stats.dogru), inline: true },
      { name: '❌ Yanlış', value: String(stats.yanlis), inline: true }
    )
    .setTimestamp();
  const reply = await message.channel.send({ embeds: [embed] }).catch(() => null);
  if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
}

/**
 * Sayı saymacayı kanal geçmişinden senkronize et.
 */
async function syncCountingFromHistory(channel, currentMsgId) {
  if (countingSynced) return;
  countingSynced = true;

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const sorted = [...messages.values()]
      .filter(m => m.id !== currentMsgId)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    let foundNumber = 0;
    let foundUser = null;

    for (let i = sorted.length - 1; i >= 0; i--) {
      const msg = sorted[i];
      if (msg.author.bot) continue;

      const content = msg.content.trim().toLowerCase();
      const num = parseInt(content, 10);
      if (!isNaN(num) && num > 0 && num.toString() === content) {
        foundNumber = num;
        foundUser = msg.author.id;
        break;
      }
    }

    if (foundNumber > 0) {
      currentCountingNumber = foundNumber + 1;
      lastCountingUser = foundUser;
      console.log(`[ekoGames] Sayı Saymaca senkronize edildi: son sayı=${foundNumber}, sıradaki=${currentCountingNumber}`);
    } else {
      currentCountingNumber = 1;
      lastCountingUser = null;
      console.log('[ekoGames] Sayı Saymaca geçmişi boş, 1\'den başlıyor');
    }
  } catch (err) {
    console.error('[ekoGames] Sayı Saymaca senkronizasyon hatası:', err.message);
    if (currentCountingNumber === null) currentCountingNumber = 1;
  }
}

/**
 * Bom oyununu kanal geçmişinden senkronize et.
 */
async function syncBomFromHistory(channel, currentMsgId) {
  if (bomSynced) return;
  bomSynced = true;

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const sorted = [...messages.values()]
      .filter(m => m.id !== currentMsgId)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    let foundNumber = 0;
    let foundUser = null;

    for (let i = sorted.length - 1; i >= 0; i--) {
      const msg = sorted[i];
      if (msg.author.bot) continue;

      const content = msg.content.trim().toLowerCase();
      const num = parseInt(content, 10);
      if (!isNaN(num) && num > 0 && num.toString() === content) {
        foundNumber = num;
        foundUser = msg.author.id;
        break;
      }

      if (content.includes("bom")) {
        for (let j = i - 1; j >= 0; j--) {
          const prevMsg = sorted[j];
          if (prevMsg.author.bot) continue;
          const prevNum = parseInt(prevMsg.content.trim(), 10);
          if (!isNaN(prevNum) && prevNum > 0) {
            foundNumber = prevNum + 1;
            foundUser = msg.author.id;
            break;
          }
        }
        if (foundNumber > 0) break;
      }
    }

    if (foundNumber > 0) {
      currentBomNumber = foundNumber + 1;
      lastBomUser = foundUser;
      console.log(`[ekoGames] Bom senkronize edildi: son sayı=${foundNumber}, sıradaki=${currentBomNumber}`);
    } else {
      currentBomNumber = 1;
      lastBomUser = null;
      console.log('[ekoGames] Bom geçmişi boş, 1\'den başlıyor');
    }
  } catch (err) {
    console.error('[ekoGames] Bom senkronizasyon hatası:', err.message);
    if (currentBomNumber === null) currentBomNumber = 1;
  }
}

/**
 * Kelime oyununu kanal geçmişinden senkronize et.
 */
async function syncWordFromHistory(channel, currentMsgId) {
  if (wordSynced) return;
  wordSynced = true;

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const sorted = [...messages.values()]
      .filter(m => m.id !== currentMsgId)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const msg of sorted) {
      if (msg.author.bot) continue;
      const word = msg.content.trim().split(" ")[0].toLowerCase();
      if (/[^a-zğüşıöç]/i.test(word)) continue;
      if (word.length === 0) continue;

      usedWords.add(word);
      lastWordLetter = word.slice(-1);
      lastWordUser = msg.author.id;
    }

    if (lastWordLetter) {
      console.log(`[ekoGames] Kelime oyunu senkronize edildi: son harf="${lastWordLetter}", ${usedWords.size} kelime hafızada`);
    } else {
      console.log('[ekoGames] Kelime oyunu geçmişi boş, sıfırdan başlıyor');
    }
  } catch (err) {
    console.error('[ekoGames] Kelime oyunu senkronizasyon hatası:', err.message);
  }
}

/**
 * Sayı Saymaca Oyunu Mantığı
 */
async function runCountingGame(message, client) {
  await syncCountingFromHistory(message.channel, message.id);

  const content = message.content.toLowerCase().trim();

  // Aynı kişi üst üste yazamaz
  if (message.author.id === lastCountingUser && currentCountingNumber !== 1) {
    await message.delete().catch(() => {});
    await showYanlisBildirim(message, 'Sayı Saymaca', 'aynı kişi üst üste oynayamaz! Sıranı bekle.');
    return true;
  }

  const num = parseInt(content, 10);
  if (!isNaN(num) && num > 0 && num === currentCountingNumber && num.toString() === content) {
    await message.react('✅').catch(() => {});
    currentCountingNumber++;
    lastCountingUser = message.author.id;
    getStats(message.author.id, 'Sayı Saymaca').dogru++;
    await awardGameXPForTurn(message, 'Sayı Saymaca', 18, client);
  } else {
    await message.delete().catch(() => {});
    await showYanlisBildirim(message, 'Sayı Saymaca', `hatalı giriş! **${currentCountingNumber}** demen gerekiyordu. Oyun kaldığı yerden devam ediyor.`);
  }
  return true;
}

/**
 * Bom Oyunu Mantığı
 */
async function runBomGame(message, client) {
  await syncBomFromHistory(message.channel, message.id);

  const content = message.content.toLowerCase().trim();

  if (message.author.id === lastBomUser && currentBomNumber !== 1) {
    await message.delete().catch(() => {});
    await showYanlisBildirim(message, 'Bom Oyunu', 'aynı kişi üst üste oynayamaz! Sıranı bekle.');
    return true;
  }

  const isMultipleOfFive = currentBomNumber % 5 === 0;
  let isCorrect = false;

  if (isMultipleOfFive) {
    if (content.includes('bom')) isCorrect = true;
  } else {
    if (content === currentBomNumber.toString()) isCorrect = true;
  }

  if (isCorrect) {
    await message.react('✅').catch(() => {});
    currentBomNumber++;
    lastBomUser = message.author.id;
    getStats(message.author.id, 'Bom Oyunu').dogru++;
    await awardGameXPForTurn(message, 'Bom Oyunu', 24, client);
  } else {
    await message.delete().catch(() => {});
    const expected = isMultipleOfFive ? '**bom**' : `**${currentBomNumber}**`;
    await showYanlisBildirim(message, 'Bom Oyunu', `hatalı giriş! ${expected} demen gerekiyordu. Oyun kaldığı yerden devam ediyor.`);
  }
  return true;
}

/**
 * Kelime Oyunu Mantığı
 */
async function runWordGame(message, client) {
  await syncWordFromHistory(message.channel, message.id);

  if (message.author.id === lastWordUser && lastWordLetter !== null) {
    await message.delete().catch(() => {});
    await showYanlisBildirim(message, 'Kelime Oyunu', 'aynı kişi üst üste oynayamaz! Sıranı bekle.');
    return true;
  }

  const word = message.content.trim().split(' ')[0].toLowerCase();

  if (/[^a-zğüşıöç]/i.test(word)) {
    await message.delete().catch(() => {});
    return true;
  }

  if (!lastWordLetter) {
    // İlk oyun
    const sonHarf = word.slice(-1);
    lastWordUser = message.author.id;
    usedWords.add(word);
    await message.react('✅').catch(() => {});
    getStats(message.author.id, 'Kelime Oyunu').dogru++;
    await awardGameXPForTurn(message, 'Kelime Oyunu', 16, client);

    if (CIKMAZHARF.has(sonHarf)) {
      // Çıkmaz harf bonusu
      const yeniPuan = addWordScore(message.author.id, 10);
      const yeniHarf = rastgeleGuvenliHarf();
      lastWordLetter = yeniHarf;
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle('🔤 Çıkmaz Harf')
        .setColor(0xf59e0b)
        .setDescription(
          `<@${message.author.id}> çıkmaza sokan harf yazdığın için **10 oyun puanı** aldın!\n` +
          `Girilen kelime **${word}** oyuncu çıkmaza sokan bir harf olan **${sonHarf}** ile bitiyor.\n` +
          `Oyunun çıkmaza girmemesi için sistem tarafından rastgele bir harf seçildi.\n\n` +
          `**Oyunun yeni harfi: ${yeniHarf.toUpperCase()}**`
        )
        .setFooter({ text: `Toplam puanın: ${yeniPuan}` })
        .setTimestamp();
      await message.channel.send({ embeds: [embed] }).catch(() => {});
    } else {
      lastWordLetter = sonHarf;
    }
  } else {
    // Oyun devam ediyor
    if (word.startsWith(lastWordLetter)) {
      if (usedWords.has(word)) {
        await message.delete().catch(() => {});
        await showYanlisBildirim(message, 'Kelime Oyunu', `**"${word}"** kelimesi daha önce kullanıldı! Lütfen başka kelime bulun.`);
      } else {
        const sonHarf = word.slice(-1);
        lastWordUser = message.author.id;
        usedWords.add(word);
        await message.react('✅').catch(() => {});
        getStats(message.author.id, 'Kelime Oyunu').dogru++;
        await awardGameXPForTurn(message, 'Kelime Oyunu', 16, client);

        if (CIKMAZHARF.has(sonHarf)) {
          // Çıkmaz harf bonusu
          const yeniPuan = addWordScore(message.author.id, 10);
          const yeniHarf = rastgeleGuvenliHarf();
          lastWordLetter = yeniHarf;
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setTitle('🔤 Çıkmaz Harf')
            .setColor(0xf59e0b)
            .setDescription(
              `<@${message.author.id}> çıkmaza sokan harf yazdığın için **10 oyun puanı** aldın!\n` +
              `Girilen kelime **${word}** oyuncu çıkmaza sokan bir harf olan **${sonHarf}** ile bitiyor.\n` +
              `Oyunun çıkmaza girmemesi için sistem tarafından rastgele bir harf seçildi.\n\n` +
              `**Oyunun yeni harfi: ${yeniHarf.toUpperCase()}**`
            )
            .setFooter({ text: `Toplam puanın: ${yeniPuan}` })
            .setTimestamp();
          await message.channel.send({ embeds: [embed] }).catch(() => {});
        } else {
          lastWordLetter = sonHarf;
        }
      }
    } else {
      await message.delete().catch(() => {});
      await showYanlisBildirim(message, 'Kelime Oyunu', `kelime **"${lastWordLetter}"** harfi ile başlamalı!`);
    }
  }
  return true;
}

/**
 * Hikaye oyununu kanal geçmişinden senkronize et.
 */
async function syncStoryFromHistory(channel, currentMsgId) {
  if (storySynced) return;
  storySynced = true;

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const sorted = [...messages.values()]
      .filter(m => m.id !== currentMsgId)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    let lastMsg = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const msg = sorted[i];
      if (msg.author.bot) continue;
      lastMsg = msg;
      break;
    }

    if (lastMsg) {
      lastStoryUser = lastMsg.author.id;
      const cleanContent = lastMsg.content.toLowerCase().replace(/\u0307/g, "").trim();
      const endsWithSon = /(?:^|\s)son[^a-zA-Zçğıöşü]*$/i.test(cleanContent);
      if (endsWithSon) {
        needsGiris = true;
      } else {
        needsGiris = false;
      }
      console.log(`[ekoGames] Hikaye oyunu senkronize edildi: Son Yazan=${lastStoryUser}, Giriş Bekleniyor mu=${needsGiris}`);
    } else {
      lastStoryUser = null;
      needsGiris = true;
      console.log('[ekoGames] Hikaye oyunu geçmişi boş, Giriş bekleniyor');
    }
  } catch (err) {
    console.error('[ekoGames] Hikaye oyunu senkronizasyon hatası:', err.message);
    if (needsGiris === null) needsGiris = true;
  }
}

/**
 * Hikaye Oyunu Mantığı
 */
async function runStoryGame(message) {
  await syncStoryFromHistory(message.channel, message.id);

  const content = message.content.trim();
  const cleanContent = content.toLowerCase().replace(/\u0307/g, "");

  // 1. Aynı kişi üst üste yazamaz
  if (message.author.id === lastStoryUser) {
    await message.delete().catch(() => {});
    const reply = await message.channel.send(
      `❌ <@${message.author.id}>, **Hikaye Oyunu Kuralları:**\n` +
      `• Üst üste iki kez mesaj yazamazsınız! Lütfen başka birinin yazmasını bekleyin.`
    );
    setTimeout(() => reply.delete().catch(() => {}), 6000);
    return true;
  }

  // Detect "son" word ending (ignoring trailing symbols/emojis)
  const endsWithSon = /(?:^|\s)son[^a-zA-Zçğıöşü]*$/i.test(cleanContent);

  // Check if message is a GİRİŞ
  let isGiris = false;
  const match = cleanContent.match(/^(giriş|giris)(.*)$/);
  if (match) {
    const rest = match[2];
    if (rest.length === 0) {
      isGiris = true;
    } else {
      const nextChar = rest[0];
      if (!/[a-zçğıöşü]/i.test(nextChar)) {
        isGiris = true;
      }
    }
  }

  // 2. Giriş bekleniyorsa ama GİRİŞ ile başlamıyorsa
  if (needsGiris && !isGiris) {
    await message.delete().catch(() => {});
    const reply = await message.channel.send(
      `❌ <@${message.author.id}>, **Hikaye Oyunu Kuralları:**\n` +
      `• Hikaye bittiği veya yeni başladığı için mesajınız **GİRİŞ: <hikaye başlangıcı>** şeklinde başlamalıdır!\n` +
      `• Örnek: \`GİRİŞ: Bir varmış bir yokmuş...\``
    );
    setTimeout(() => reply.delete().catch(() => {}), 6000);
    return true;
  }

  // Kabul edildi - tik tepkisi koy
  await message.react("✅").catch(() => {});
  
  lastStoryUser = message.author.id;
  if (endsWithSon) {
    needsGiris = true;
    await message.react("🏁").catch(() => {});
  } else {
    needsGiris = false;
  }

  return true;
}

/**
 * EkoYıldız Oyunları için ana handler
 */
async function handleEkoGames(message, client) {
  if (!message.guild || !message.author) return false;
  if (message.guild.id !== GUILD2_ID) return false;
  if (message.author.bot) return false;

  const channelId = message.channel.id;

  // Çakışma durumu kontrolü (aynı kanal ID'si verilmişse)
  if (channelId === EKOYILDIZ_KELIME_OYUNU_CHANNEL_ID && channelId === EKOYILDIZ_BOM_CHANNEL_ID) {
    const content = message.content.trim().toLowerCase();
    const isBomInput = !isNaN(parseInt(content, 10)) || content.includes("bom");
    if (isBomInput) {
      return await runBomGame(message);
    } else {
      return await runWordGame(message);
    }
  }

  if (channelId === EKOYILDIZ_SAYI_SAYMACA_CHANNEL_ID) {
    return await runCountingGame(message, client);
  }

  if (channelId === EKOYILDIZ_KELIME_OYUNU_CHANNEL_ID) {
    return await runWordGame(message, client);
  }

  if (channelId === EKOYILDIZ_BOM_CHANNEL_ID) {
    return await runBomGame(message, client);
  }

  if (isStoryGameChannel(channelId)) {
    return await continueStoryGame(message, client);
  }

  return false;
}

module.exports = {
  handleEkoGames,
  getWordScore,
  wordGameScores
};
