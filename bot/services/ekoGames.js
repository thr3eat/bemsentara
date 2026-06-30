const {
  GUILD2_ID,
  EKOYILDIZ_SAYI_SAYMACA_CHANNEL_ID,
  EKOYILDIZ_KELIME_OYUNU_CHANNEL_ID,
  EKOYILDIZ_BOM_CHANNEL_ID,
  EKOYILDIZ_STORY_GAME_CHANNEL_ID
} = require("../../config");

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

// Story Game State
let lastStoryUser = null;
let needsGiris = true;
let storySynced = false;

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
async function runCountingGame(message) {
  await syncCountingFromHistory(message.channel, message.id);

  const content = message.content.toLowerCase().trim();

  // Aynı kişi üst üste yazamaz
  if (message.author.id === lastCountingUser && currentCountingNumber !== 1) {
    await message.delete().catch(() => {});
    const reply = await message.channel.send(`<@${message.author.id}>, aynı kişi üst üste oynayamaz! Sıranı bekle.`);
    setTimeout(() => reply.delete().catch(() => {}), 3000);
    return true;
  }

  const num = parseInt(content, 10);
  if (!isNaN(num) && num > 0 && num === currentCountingNumber && num.toString() === content) {
    await message.react("✅").catch(() => {});
    currentCountingNumber++;
    lastCountingUser = message.author.id;
  } else {
    await message.delete().catch(() => {});
    const reply = await message.channel.send(`<@${message.author.id}>, hatalı giriş! **${currentCountingNumber}** demen gerekiyordu. Oyun kaldığı yerden devam ediyor.`);
    setTimeout(() => reply.delete().catch(() => {}), 4000);
  }
  return true;
}

/**
 * Bom Oyunu Mantığı
 */
async function runBomGame(message) {
  await syncBomFromHistory(message.channel, message.id);

  const content = message.content.toLowerCase().trim();

  if (message.author.id === lastBomUser && currentBomNumber !== 1) {
    await message.delete().catch(() => {});
    const reply = await message.channel.send(`<@${message.author.id}>, aynı kişi üst üste oynayamaz! Sıranı bekle.`);
    setTimeout(() => reply.delete().catch(() => {}), 3000);
    return true;
  }

  const isMultipleOfFive = currentBomNumber % 5 === 0;
  let isCorrect = false;

  if (isMultipleOfFive) {
    if (content.includes("bom")) {
      isCorrect = true;
    }
  } else {
    if (content === currentBomNumber.toString()) {
      isCorrect = true;
    }
  }

  if (isCorrect) {
    await message.react("✅").catch(() => {});
    currentBomNumber++;
    lastBomUser = message.author.id;
  } else {
    await message.delete().catch(() => {});
    const expected = isMultipleOfFive ? "bom" : currentBomNumber;
    const reply = await message.channel.send(`<@${message.author.id}>, hatalı giriş! **${expected}** demen gerekiyordu. Oyun kaldığı yerden devam ediyor.`);
    setTimeout(() => reply.delete().catch(() => {}), 4000);
  }
  return true;
}

/**
 * Kelime Oyunu Mantığı
 */
async function runWordGame(message) {
  await syncWordFromHistory(message.channel, message.id);

  if (message.author.id === lastWordUser && lastWordLetter !== null) {
    await message.delete().catch(() => {});
    const reply = await message.channel.send(`<@${message.author.id}>, aynı kişi üst üste oynayamaz! Sıranı bekle.`);
    setTimeout(() => reply.delete().catch(() => {}), 3000);
    return true;
  }

  const word = message.content.trim().split(" ")[0].toLowerCase();

  if (/[^a-zğüşıöç]/i.test(word)) {
    await message.delete().catch(() => {});
    return true;
  }

  if (!lastWordLetter) {
    lastWordLetter = word.slice(-1);
    lastWordUser = message.author.id;
    usedWords.add(word);
    await message.react("✅").catch(() => {});
  } else {
    if (word.startsWith(lastWordLetter)) {
      if (usedWords.has(word)) {
        await message.delete().catch(() => {});
        const reply = await message.channel.send(`<@${message.author.id}>, "${word}" kelimesi daha önce kullanıldı! Lütfen başka kelime bulun.`);
        setTimeout(() => reply.delete().catch(() => {}), 3000);
      } else {
        lastWordLetter = word.slice(-1);
        lastWordUser = message.author.id;
        usedWords.add(word);
        await message.react("✅").catch(() => {});
      }
    } else {
      await message.delete().catch(() => {});
      const reply = await message.channel.send(`<@${message.author.id}>, kelime **"${lastWordLetter}"** harfi ile başlamalı!`);
      setTimeout(() => reply.delete().catch(() => {}), 3000);
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
  if (needsGiris) {
    if (!isGiris) {
      await message.delete().catch(() => {});
      const reply = await message.channel.send(
        `❌ <@${message.author.id}>, **Hikaye Oyunu Kuralları:**\n` +
        `• Hikaye bittiği veya yeni başladığı için mesajınız **GİRİŞ: <hikaye başlangıcı>** şeklinde başlamalıdır!\n` +
        `• Örnek: \`GİRİŞ: Bir varmış bir yokmuş...\``
      );
      setTimeout(() => reply.delete().catch(() => {}), 6000);
      return true;
    }
  } else {
    // 3. Giriş beklenmiyorsa ama yine de GİRİŞ yazılmışsa
    if (isGiris) {
      await message.delete().catch(() => {});
      const reply = await message.channel.send(
        `❌ <@${message.author.id}>, **Hikaye Oyunu Kuralları:**\n` +
        `• Hikaye zaten devam ediyor! **GİRİŞ:** yazmadan normal şekilde devam ettirmelisiniz.\n` +
        `• Hikayeyi bitirmek için mesajın sonuna **SON** yazabilirsiniz.`
      );
      setTimeout(() => reply.delete().catch(() => {}), 6000);
      return true;
    }
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
    return await runCountingGame(message);
  }

  if (channelId === EKOYILDIZ_KELIME_OYUNU_CHANNEL_ID) {
    return await runWordGame(message);
  }

  if (channelId === EKOYILDIZ_BOM_CHANNEL_ID) {
    return await runBomGame(message);
  }

  if (channelId === EKOYILDIZ_STORY_GAME_CHANNEL_ID) {
    return await runStoryGame(message);
  }

  return false;
}

module.exports = {
  handleEkoGames
};
