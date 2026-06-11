const { 
  TMT_GUILD_ID, 
  TMT_HONEYPOT_CHANNEL_ID,
  TMT_OWO_CHANNEL_ID,
  TMT_TUTTU_CHANNEL_ID,
  TMT_BOM_CHANNEL_ID,
  TMT_WORDGAME_CHANNEL_ID
} = require("../../config");

// --- In-Memory States for Games ---

// Bom Game State
let currentBomNumber = 1;
let lastBomUser = null;

// Word Game State
let lastWordLetter = null;
const usedWords = new Set();

/**
 * Handle incoming messages for TMT specific channels (games & honeypot).
 * Returns true if the message was handled by a game/honeypot.
 */
async function handleTMTGames(message, client) {
  // Sadece TMT sunucusundaki mesajlar
  if (message.guild.id !== TMT_GUILD_ID) return false;
  if (message.author.bot) return false; // Botların mesajlarına tepki verme

  const channelId = message.channel.id;

  // 1. Honeypot (Tuzak Kanalı)
  if (channelId === TMT_HONEYPOT_CHANNEL_ID) {
    try {
      // Mesajı sil
      await message.delete().catch(() => {});
      // Kullanıcıyı sunucudan at
      if (message.member && message.member.kickable) {
        await message.member.kick("Honeypot (Tuzak) kanalına mesaj gönderdi.");
      }
    } catch (err) {
      console.error("[Honeypot] Kick error:", err.message);
    }
    return true;
  }

  // 2. OwO Game
  if (channelId === TMT_OWO_CHANNEL_ID) {
    const owoFaces = ["(・`ω´・)", ";;w;;", "owo", "UwU", ">w<", "^w^", "úwú"];
    const randomFace = () => owoFaces[Math.floor(Math.random() * owoFaces.length)];
    
    let text = message.content;
    text = text.replace(/(?:r|l)/g, "w");
    text = text.replace(/(?:R|L)/g, "W");
    text = text.replace(/n([aeiou])/g, "ny$1");
    text = text.replace(/N([aeiou])/g, "Ny$1");
    text = text.replace(/N([AEIOU])/g, "Ny$1");
    text = text.replace(/ove/g, "uv");
    
    const replyText = `${text} ${randomFace()}`;
    await message.reply(replyText).catch(() => {});
    return true;
  }

  // 3. Tuttu/Tutmadı Game
  if (channelId === TMT_TUTTU_CHANNEL_ID) {
    const lowerContent = message.content.toLowerCase();
    if (lowerContent.includes("tuttu") || lowerContent.includes("tutmadı") || lowerContent.includes("tutmadi")) {
      await message.react("✅").catch(() => {});
    } else {
      await message.delete().catch(() => {});
    }
    return true;
  }

  // 4. Bom Game
  if (channelId === TMT_BOM_CHANNEL_ID) {
    const content = message.content.toLowerCase().trim();
    
    // Aynı kişi üst üste yazamaz
    if (message.author.id === lastBomUser && currentBomNumber !== 1) {
      await message.react("❌").catch(() => {});
      await message.reply("Aynı kişi üst üste oynayamaz! Sıranı bekle.").then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
      return true;
    }

    const isMultipleOfFive = currentBomNumber % 5 === 0;

    let isCorrect = false;
    if (isMultipleOfFive) {
      // 5'in katı ise "bom" içermeli
      if (content.includes("bom")) {
        isCorrect = true;
      }
    } else {
      // Değilse sayının kendisi olmalı
      if (content === currentBomNumber.toString()) {
        isCorrect = true;
      }
    }

    if (isCorrect) {
      await message.react("✅").catch(() => {});
      currentBomNumber++;
      lastBomUser = message.author.id;
    } else {
      await message.react("❌").catch(() => {});
      await message.reply(`BOM! Hatalı giriş. **${isMultipleOfFive ? "bom" : currentBomNumber}** demen gerekiyordu. Oyun **1**'den tekrar başlıyor.`);
      currentBomNumber = 1;
      lastBomUser = null;
    }
    return true;
  }

  // 5. Kelime Oyunu
  if (channelId === TMT_WORDGAME_CHANNEL_ID) {
    // Sadece ilk kelimeyi baz alalım, boşlukları temizleyelim
    const word = message.content.trim().split(" ")[0].toLowerCase();

    // Özel karakter veya sayı içermemesini isteyebiliriz (basitçe harf kontrolü)
    if (/[^a-zğüşıöç]/i.test(word)) {
      await message.delete().catch(() => {});
      return true;
    }

    if (!lastWordLetter) {
      // İlk oyun
      lastWordLetter = word.slice(-1);
      usedWords.add(word);
      await message.react("✅").catch(() => {});
    } else {
      // Oyun devam ediyor
      if (word.startsWith(lastWordLetter)) {
        if (usedWords.has(word)) {
          await message.react("❌").catch(() => {});
          await message.reply(`"${word}" kelimesi daha önce kullanıldı! Lütfen başka kelime bulun.`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
          await message.delete().catch(() => {});
        } else {
          lastWordLetter = word.slice(-1);
          usedWords.add(word);
          await message.react("✅").catch(() => {});
        }
      } else {
        await message.react("❌").catch(() => {});
        await message.reply(`Kelime **"${lastWordLetter}"** harfi ile başlamalı!`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        await message.delete().catch(() => {});
      }
    }
    return true;
  }

  return false;
}

module.exports = {
  handleTMTGames
};
