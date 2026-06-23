'use strict';

const { EmbedBuilder } = require('discord.js');
const FrogLevel = require('../../models/FrogLevel');

// ── EkoYıldız sunucu ID ─────────────────────────────────────────────────────
const FROG_GUILD_ID = process.env.FROG_GUILD_ID || '1367646464804655104';

// ── Kurbağa rol hiyerarşisi (küçükten büyüğe) ──────────────────────────────
const FROG_ROLES = [
  { level: 0,  name: '🦖 Yavru Dinazor',     id: '1518692402884378825' },
  { level: 1,  name: '🦕  Uyanık Dinazor',    id: '1518692401789796543' },
  { level: 2,  name: '🧠 Zeki Dinazor',      id: '1518703707750006874' },
  { level: 3,  name: '👑 Efsane Dinazor',    id: '1518703706911019068' },
  { level: 4,  name: '👹 Boss Dinazor',      id: '1518703706282135792' },
  { level: 5,  name: '😎 Havalı Dinazor',    id: '1518703705338413086' },
  { level: 6,  name: '🔥 Olay Dinazor',      id: '1518703704524718111' },
  { level: 7,  name: '💥 Bela Dinazor',      id: '1518703703585198341' },
  { level: 8,  name: '🌪️ Kaos Dinazor',      id: '1518703702947401938' },
  { level: 9,  name: '⚡ Alpha Dinazor',     id: '1518703702205010183' },
  { level: 10, name: '😇 İyi Dinazor',       id: '1518703701793968139' },
  { level: 11, name: '🌀 Garip Dinazor',     id: '1518703700741329098' },
  { level: 12, name: '🎮 Oyuncu Penguen',    id: '1518703699936153621' },
  { level: 13, name: '🕶️ Havalı Penguen',    id: '1518701811450773575' },
  { level: 14, name: '🚀 Hiper Penguen',     id: '1518698914524561470' },
  { level: 15, name: '🌋 Volkanik Penguen',   id: '1518696013148197047' },
  { level: 16, name: '🦖 Kral Penguen',      id: '1518695643063910541' },
];

// ── Her seviye için gereken XP (giderek zorlaşıyor: üstel artış) ─────────────
// Seviye 0→1: 150 XP, 1→2: 350 XP, 2→3: 700 XP ... her seviye ~2.2x zorlaşır
function xpToNextLevel(currentLevel) {
  // Formül: 150 * (2.2^level) — 0dan 1e: 150, 1den 2ye: 330, 2den 3e: 726...
  return Math.floor(150 * Math.pow(2.2, currentLevel));
}

// Toplam seviyeye ulaşmak için gereken XP
function totalXpForLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += xpToNextLevel(i);
  }
  return total;
}

// ── XP kaynakları ─────────────────────────────────────────────────────────
const XP_PER_MESSAGE    = 5;   // Her mesajda kazanılan XP
const XP_PER_VOICE_MIN  = 3;   // Her ses dakikasında kazanılan XP
const MSG_COOLDOWN_MS   = 60 * 1000; // 1 dakika mesaj cooldown (spam önleme)

// ── Kullanıcı verisi al veya oluştur ──────────────────────────────────────
async function getOrCreate(userId) {
  let p = await FrogLevel.findOne({ userId });
  if (!p) {
    p = new FrogLevel({ userId, guildId: FROG_GUILD_ID });
    await p.save();
  }
  return p;
}

// ── Mevcut seviyeyi Discord rollerine göre belirle ────────────────────────
async function syncLevelFromRoles(member) {
  // En yüksek kurbağa rolünü bul
  let highestLevel = -1;
  for (const fr of FROG_ROLES) {
    if (member.roles.cache.has(fr.id)) {
      if (fr.level > highestLevel) highestLevel = fr.level;
    }
  }
  return highestLevel; // -1 = kurbağa rolü yok
}

const chatHistory = new Map(); // userId -> Array of timestamps

// ── Mesaj XP ekle ─────────────────────────────────────────────────────────
async function addMessageXP(member, client) {
  if (!member || !member.guild || !member.user) {
    console.warn('[frogLevel] Invalid member object in addMessageXP');
    return;
  }
  
  if (member.guild.id !== FROG_GUILD_ID) return;
  if (member.user.bot) return;

  // Track chat activity for x2 XP boost (Hızlı Yazıcı Bonusu)
  const now = Date.now();
  let history = chatHistory.get(member.id) || [];
  history.push(now);
  // Keep only timestamps from the last 15 minutes (900000 ms)
  history = history.filter(ts => (now - ts) < 15 * 60 * 1000);
  chatHistory.set(member.id, history);

  const p = await getOrCreate(member.id).catch(err => {
    console.error('[frogLevel] getOrCreate error in addMessageXP:', err.message);
    return null;
  });
  if (!p) return;

  // Check if they qualify for the x2 XP boost:
  // - at least 30 messages in the last 15 minutes
  // - the duration of activity (difference between first and last message in history) is at least 10 minutes
  const oldest = history[0];
  if (history.length >= 30 && oldest && (now - oldest) >= 10 * 60 * 1000) {
    const boostUntil = new Date(now + 15 * 60 * 1000);
    // Only set/update if not already active
    const isBoostActive = p.doubleXpUntil && new Date(p.doubleXpUntil).getTime() > now;
    if (!isBoostActive) {
      p.doubleXpUntil = boostUntil;
      await p.save();

      // Send DM notification
      try {
        const boostEmbed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle('⚡ HIZLI YAZICI BOOSTU AKTİF! (x2 XP)')
          .setDescription(
            `Harika! Sohbet kanallarında oldukça hızlı ve aktif yazıyorsun! 🚀\n\n` +
            `Önümüzdeki **15 dakika boyunca** kazanacağın tüm Kurbağa/Dinazor XP'leri **2 katına** çıkarıldı! 🔥\n\n` +
            `Bitiş Zamanı: <t:${Math.floor(boostUntil.getTime() / 1000)}:T>`
          )
          .setFooter({ text: 'Eko Yıldız • Hızlı Yazıcı Bonusu' })
          .setTimestamp();
        await member.user.send({ embeds: [boostEmbed] }).catch(() => {});
      } catch (dmErr) {
        console.warn(`[frogLevel] Failed to send boost DM to ${member.id}:`, dmErr.message);
      }
    }
  }

  // Cooldown kontrolü (XP kazanımı için)
  if (p.lastMessageAt && (now - new Date(p.lastMessageAt).getTime()) < MSG_COOLDOWN_MS) return;

  // Eğer hiç seviye yoksa Discord rollerinden senkronize et
  if (p.level === 0 && p.xp === 0) {
    const discordLevel = await syncLevelFromRoles(member);
    if (discordLevel > 0) {
      p.level = discordLevel;
      p.xp    = totalXpForLevel(discordLevel);
    }
  }

  // Double XP check
  let xpGain = XP_PER_MESSAGE;
  if (p.doubleXpUntil && new Date(p.doubleXpUntil) > new Date()) {
    xpGain *= 2;
  }

  // Server booster multiplier (1.5x XP)
  if (member.premiumSince) {
    xpGain = Math.ceil(xpGain * 1.5);
  }

  p.xp            += xpGain;
  p.totalMessages  = (p.totalMessages || 0) + 1;
  p.lastMessageAt   = new Date();
  await p.save();

  await checkLevelUp(p, member, client);
}

// ── Ses dakikası XP ekle ──────────────────────────────────────────────────
async function addVoiceXP(userId, minutes, client) {
  if (!userId || !minutes || minutes <= 0 || !client) {
    console.warn('[frogLevel] Invalid addVoiceXP parameters:', { userId, minutes, client: !!client });
    return;
  }
  
  try {
    const p = await getOrCreate(userId).catch(err => {
      console.error('[frogLevel] getOrCreate error in addVoiceXP:', err.message);
      return null;
    });
    if (!p) return;

    // Guild'den member fetch et (XP çarpanını kontrol etmek için önceden fetch ediyoruz)
    const guild = await client.guilds.fetch(FROG_GUILD_ID).catch(err => {
      console.warn(`[frogLevel] Guild ${FROG_GUILD_ID} not found:`, err.code);
      return null;
    });
    if (!guild) return;
    
    const member = await guild.members.fetch(userId).catch(err => {
      console.warn(`[frogLevel] Member ${userId} not found:`, err.code);
      return null;
    });
    
    // Double XP check
    let xpGain = minutes * XP_PER_VOICE_MIN;
    if (p.doubleXpUntil && new Date(p.doubleXpUntil) > new Date()) {
      xpGain *= 2;
    }

    // Server booster multiplier (1.5x XP)
    if (member && member.premiumSince) {
      xpGain = Math.ceil(xpGain * 1.5);
    }

    p.xp                += xpGain;
    p.totalVoiceMinutes  = (p.totalVoiceMinutes || 0) + minutes;
    await p.save().catch(err => {
      console.error('[frogLevel] Save failed during addVoiceXP:', err.message);
      throw err;
    });

    if (!member) return;
    
    await checkLevelUp(p, member, client).catch(err => {
      console.error('[frogLevel] checkLevelUp error:', err.message);
    });
  } catch (err) {
    console.error('[frogLevel] addVoiceXP fatal error:', err.message);
  }
}

// ── Seviye atladı mı kontrol et ──────────────────────────────────────────
async function checkLevelUp(p, member, client) {
  const maxLevel = FROG_ROLES.length - 1;
  if (p.level >= maxLevel) return;

  const needed = xpToNextLevel(p.level);
  const currentXP = p.xp - totalXpForLevel(p.level);

  if (currentXP >= needed) {
    await levelUp(p, member, client);
  }
}

// ── Seviye Rol ve Roblox Senkronizasyonu ──────────────────────────────────
async function syncRolesFromLevel(member, level, client) {
  try {
    const currentRoles = member.roles.cache.map(r => r.id);
    const targetRole = FROG_ROLES[level];
    
    const DINASOUR_FAMILY_ROLE = '1518706437730078941';
    const PENGUIN_FAMILY_ROLE  = '1518706437327556638';

    // Temizlenecek diğer tüm seviye rollerini bul (yavru dinazor hariç)
    const rolesToRemove = [];
    for (const fr of FROG_ROLES) {
      if (fr.level !== level && fr.level !== 0 && currentRoles.includes(fr.id)) {
        rolesToRemove.push(fr.id);
      }
    }

    // Family roles removal
    if (level >= 0 && level <= 11) {
      if (currentRoles.includes(PENGUIN_FAMILY_ROLE)) {
        rolesToRemove.push(PENGUIN_FAMILY_ROLE);
      }
    } else if (level >= 12 && level <= 16) {
      if (currentRoles.includes(DINASOUR_FAMILY_ROLE)) {
        rolesToRemove.push(DINASOUR_FAMILY_ROLE);
      }
    }

    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove, 'Seviye Rol Senkronizasyonu').catch(() => {});
    }

    const rolesToAdd = [];
    if (targetRole && !currentRoles.includes(targetRole.id)) {
      rolesToAdd.push(targetRole.id);
    }

    // Yavru Dinazor (level 0) rolünün de verilmesini/korunmasını sağla
    const level0Role = FROG_ROLES[0];
    if (level0Role && level !== 0 && !currentRoles.includes(level0Role.id)) {
      rolesToAdd.push(level0Role.id);
    }

    // Family roles addition
    if (level >= 0 && level <= 11) {
      if (!currentRoles.includes(DINASOUR_FAMILY_ROLE)) {
        rolesToAdd.push(DINASOUR_FAMILY_ROLE);
      }
    } else if (level >= 12 && level <= 16) {
      if (!currentRoles.includes(PENGUIN_FAMILY_ROLE)) {
        rolesToAdd.push(PENGUIN_FAMILY_ROLE);
      }
    }

    if (rolesToAdd.length > 0) {
      await member.roles.add(rolesToAdd, 'Seviye Rol Senkronizasyonu').catch(() => {});
    }

    // 2. Sezon (Dinazor) geçişinde/seviyelerinde Roblox grubunda rank 5 ver
    if (level >= 12 && member.guild.id === FROG_GUILD_ID) {
      try {
        const User = require('../../models/User');
        const dbUser = await User.findOne({ discordId: member.id });
        if (dbUser && dbUser.robloxId) {
          const robloxId = parseInt(dbUser.robloxId);
          if (!isNaN(robloxId)) {
            const noblox = require('noblox.js');
            const { ROBLOX } = require('./staffAutomation');

            await noblox.handleJoinRequest(ROBLOX.EKOYILDIZ, robloxId, true).catch(() => {});
            await noblox.setRank(ROBLOX.EKOYILDIZ, robloxId, 5).catch(err => {
              console.error(`[frogLevel] Failed to set rank 5 in EkoYildiz group for ${member.id}:`, err.message);
            });
            console.log(`[frogLevel] Successfully set rank 5 in EkoYildiz group for user ${member.id}`);
          }
        }
      } catch (err) {
        console.error('[frogLevel] Roblox rank sync error during Dinosaur transition:', err.message);
      }
    }
  } catch (err) {
    console.error('[frogLevel] syncRolesFromLevel error:', err.message);
  }
}

// ── Kurbağa seviye ve aile rolleri koruma/senkronize etme ───────────────────
async function enforceFrogRoles(member) {
  try {
    const currentRoles = member.roles.cache.map(r => r.id);
    const level0RoleId = '1518692402884378825';

    // Yavru Dinazor rolünü herkeste zorunlu kıl
    if (!currentRoles.includes(level0RoleId)) {
      await member.roles.add(level0RoleId, 'Zorunlu Yavru Dinazor Rolü').catch(() => {});
      currentRoles.push(level0RoleId);
    }
    
    // Üyenin sahip olduğu en yüksek kurbağa seviyesini belirle
    let currentLevel = -1;
    for (const fr of FROG_ROLES) {
      if (currentRoles.includes(fr.id)) {
        if (fr.level > currentLevel) currentLevel = fr.level;
      }
    }
    
    // Eğer üyenin hiç seviye rolü yoksa (veya sadece level 0 varsa) işlem yapma
    if (currentLevel <= 0) return;
    
    // Eğer seviye bulunmuşsa syncRolesFromLevel ile eşle
    await syncRolesFromLevel(member, currentLevel, member.client);
  } catch (err) {
    console.error('[frogLevel] enforceFrogRoles error:', err.message);
  }
}

// ── Sunucu Boost Ödüllendirme ve Duyuru Sistemi ───────────────────────────
async function handleBoosterReward(member) {
  try {
    const userId = member.id;
    const client = member.client;
    
    // 1. FrogLevel verisini al/oluştur ve 500 XP ödülü ver
    const p = await getOrCreate(userId);
    p.xp = (p.xp || 0) + 500;
    await p.save();
    
    // Seviye atlayıp atlamadığını kontrol et
    await checkLevelUp(p, member, client).catch(() => {});
    
    // 2. Eğer yetkili (staff) ise 1500 EkoCoin ver
    let staffRewarded = false;
    try {
      const StaffProgress = require('../../models/StaffProgress');
      const staff = await StaffProgress.findOne({ userId });
      if (staff) {
        if (!staff.gamification) {
          staff.gamification = { totalPoints: 0, ecoCoins: 0, level: 1, currentXP: 0, badges: {}, streak: { current: 0, longest: 0, brokenDays: 0 } };
        }
        staff.gamification.ecoCoins = (staff.gamification.ecoCoins || 0) + 1500;
        await staff.save();
        staffRewarded = true;
      }
    } catch (staffErr) {
      console.error('[frogLevel] Booster staff reward error:', staffErr.message);
    }
    
    // 3. EkoYıldız sohbet kanalını bul ve boost duyurusunu gönder
    const guild = member.guild;
    const channel = guild.channels.cache.find(c =>
      c.isTextBased?.() &&
      (c.name.includes('genel') || c.name.includes('sohbet') || c.name.includes('general'))
    ) || guild.systemChannel;
    
    if (channel) {
      const { EmbedBuilder } = require('discord.js');
      const boostEmbed = new EmbedBuilder()
        .setColor(0xf47fff) // Boost pembe rengi
        .setTitle('⚡ SUNUCUYA DESTEK VERİLDİ! ⚡')
        .setDescription(
          `**Kocaman Teşekkürler!** <@${userId}> sunucumuza boost basarak destekte bulundu! 💖✨\n\n` +
          `**Kazandığı Ayrıcalıklar & Ödüller:**\n` +
          `• 📈 **Kalıcı 1.5x XP Boostu** (Sohbet ve ses kanallarında geçerli!)\n` +
          `• 🎁 **+500 FrogLevel XP** ödülü profilinize eklendi!\n` +
          (staffRewarded ? `• 🪙 **+1500 EkoCoin (E.C.)** yetkili hesabınıza eklendi!\n` : '') +
          `• 👑 Sunucudaki özel **Booster** ayrıcalıkları aktif edildi!`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: 'Eko Yıldız • Server Booster Sistemi' })
        .setTimestamp();
        
      await channel.send({ content: `🎉 **TEBRİKLER!** <@${userId}>`, embeds: [boostEmbed] }).catch(() => {});
    }
    
    // 4. Kullanıcıya DM ile teşekkür ve bilgi mesajı gönder
    try {
      const { EmbedBuilder } = require('discord.js');
      const dmEmbed = new EmbedBuilder()
        .setColor(0xf47fff)
        .setTitle('💖 Sunucumuzu Boostladığın İçin Teşekkürler! 💖')
        .setDescription(
          `Merhaba **${member.user.username}**,\n\n` +
          `EkoYıldız sunucusuna yaptığın boost desteği için çok teşekkür ederiz! Sunucuya verdiğin destek bizim için çok değerli. ✨\n\n` +
          `**Senin İçin Tanımlanan Booster Hediyeleri:**\n` +
          `• ⚡ **Kalıcı 1.5x XP Çarpanı** (Artık sohbette ve seste daha hızlı seviye atlayacaksın!)\n` +
          `• 📊 **+500 Seviye XP'si** profilinize eklendi.\n` +
          (staffRewarded ? `• 💰 **+1500 EkoCoin (E.C.)** hesabınıza eklendi.\n` : '') +
          `• 🎨 Sunucudaki tüm özel booster kanalları ve rol ayrıcalıkları kullanımına hazır!`
        )
        .setFooter({ text: 'Eko Yıldız • Teşekkür Ederiz!' })
        .setTimestamp();
        
      await member.user.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (_) {}
  } catch (err) {
    console.error('[frogLevel] handleBoosterReward error:', err.message);
  }
}

// ── Seviye atla ──────────────────────────────────────────────────────────
async function levelUp(p, member, client) {
  const oldLevel = p.level;
  const newLevel = oldLevel + 1;
  const maxLevel = FROG_ROLES.length - 1;

  if (newLevel > maxLevel) return;

  p.level = newLevel;
  p.promotions = p.promotions || [];
  p.promotions.push({ level: newLevel, date: new Date() });
  await p.save();

  // Eski rolleri temizle, yeniyi ver ve Roblox rütbesini eşle
  await syncRolesFromLevel(member, newLevel, client);

  const isFinal = newLevel === maxLevel;
  const newRoleInfo = FROG_ROLES[newLevel];
  const isSeason2 = newLevel >= 12;

  // Seviye atlama mesajı — sunucuda bir kanala gönder
  try {
    const guild = member.guild;
    const channel = guild.channels.cache.find(c =>
      c.isTextBased?.() &&
      (c.name.includes('genel') || c.name.includes('sohbet') || c.name.includes('general'))
    ) || guild.systemChannel;

    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(isFinal ? 0xffd700 : (isSeason2 ? 0xe67e22 : 0x4ade80))
        .setTitle(isFinal ? '🏆 MAKSIMUM SEVİYE!' : (isSeason2 ? '🦖 2. SEZON: SEVİYE ATLADI!' : '🎉 SEVİYE ATLADI!'))
        .setDescription(
          isFinal
            ? `**${member.displayName}** tüm Dinazor macerasını tamamlayarak en üst seviyeye ulaştı! 🦖👑`
            : (newLevel === 12
                ? `**${member.displayName}** tüm kurbağa macerasını tamamladı ve **2. Sezon Dinazor Sezonu**'na geçiş yaptı! 🦖🔥`
                : `**${member.displayName}** yeni bir seviyeye ulaştı!\n**${FROG_ROLES[oldLevel]?.name}** → **${newRoleInfo.name}**`)
        )
        .addFields(
          { name: '📊 Seviye', value: isSeason2 ? `${newLevel - 11}/5 (Toplam: ${newLevel}/16)` : `${newLevel}/11 (Toplam: ${newLevel}/16)`, inline: true },
          { name: '✨ Toplam XP',   value: `${p.xp.toLocaleString()}`, inline: true },
          { name: '⬆️ Sonraki seviye için', value: newLevel < maxLevel ? `${xpToNextLevel(newLevel).toLocaleString()} XP` : 'MAX SEVİYE', inline: true },
        )
        .setThumbnail(member.displayAvatarURL())
        .setFooter({ text: isSeason2 ? 'Eko Yıldız • Dinazor Sezonu 🦖' : 'Eko Yıldız • Kurbağa Sistemi 🐸' })
        .setTimestamp();

      await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
    }
  } catch (err) {
    console.warn('[frogLevel] Kanal mesajı gönderilemedi:', err.message);
  }

  // ── DM'ye seviye atlama bildirimi gönder ──────────────────────────────────
  try {
    if (newLevel === 12) {
      // Dinazor Sezonu Geçiş DM'i
      const s2Embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🦖 2. SEZONA GEÇİŞ YAPTIN! 🦖')
        .setDescription(
          `**2. SEZONA DİNAZOR SEZONUNA GEÇİŞ YAPTIN! TEBRİKLERRR** 🦖🎉🎉\n\n` +
          `Kurbağa hiyerarşisini tamamen bitirdin ve tarih öncesinin en güçlü varlıkları arasına katıldın!\n\n` +
          `Rütben: **${newRoleInfo.name}**\n\n` +
          `Sohbette yazmaya devam ederek kral dinazorluğa yüksel! 💪`
        )
        .setThumbnail(member.displayAvatarURL())
        .setFooter({ text: 'Eko Yıldız • Dinazor Sezonu 🦖' })
        .setTimestamp();
      await member.user.send({ embeds: [s2Embed] }).catch(() => {});
    } else {
      const dmEmbed = new EmbedBuilder()
        .setColor(isFinal ? 0xffd700 : (isSeason2 ? 0xe67e22 : 0x4ade80))
        .setTitle(isFinal ? '🏆 TEBRİKLER! MAKSIMUM SEVİYE! 🏆' : `🎉 SEVİYE ATLAMA BAŞARILI! 🎉`)
        .setThumbnail(member.displayAvatarURL());

      if (isFinal) {
        dmEmbed.setDescription(
          `**Tebrikler, ${member.displayName}!**\n\n` +
          `Eko Yıldız Dinazor Sezonu 2'yi tamamen bitirdin ve en üst seviyeye ulaştın! 👑\n\n` +
          `🦖 **${newRoleInfo.name}** olarak tüm rotaları tamamladın!\n` +
          `Sunucunun en saygın ve kadim üyesisin artık. Helal olsun! 💪`
        );
      } else {
        const nextXp = xpToNextLevel(newLevel);
        dmEmbed.setDescription(
          `**Tebrikler!** Yeni seviyeye ulaştın! ${isSeason2 ? '🦖' : '🐸'}\n\n` +
          `**Eski Seviye:** ${FROG_ROLES[oldLevel]?.name}\n` +
          `**Yeni Seviye:** ${newRoleInfo.name}\n\n` +
          `📊 **Toplam XP:** ${p.xp.toLocaleString()}`
        ).addFields(
          {
            name: '⬆️ Sonraki Seviye İçin Gerekli XP',
            value: `**${nextXp.toLocaleString()} XP** yapman gerekli\n\n` +
                   `💬 Mesaj yazarak: Her mesaj = 5 XP\n` +
                   `🎤 Ses kanalında: Her dakika = 3 XP\n\n` +
                   `Seviye atlamak çok zorlaşıyor, devam et! 💪`,
            inline: false,
          }
        );
      }

      dmEmbed.setFooter({ text: isSeason2 ? 'Eko Yıldız • Dinazor Sezonu 🦖' : 'Eko Yıldız • Kurbağa Sistemi 🐸' })
             .setTimestamp();

      await member.user.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  } catch (err) {
    console.warn('[frogLevel] DM gönderme hatası:', err.message);
  }

  // Eğer başka seviye atlama gerekiyorsa tekrar kontrol et
  if (newLevel < maxLevel) {
    await checkLevelUp(p, member, client);
  }

  console.log(`[frogLevel] ${member.user.tag} → Seviye ${newLevel} (${newRoleInfo?.name})`);
}

// ── Kurbağa profilini göster ──────────────────────────────────────────────
async function getFrogProfile(userId, client) {
  const p = await FrogLevel.findOne({ userId });
  if (!p) return null;

  const currentRole  = FROG_ROLES[p.level];
  const nextRole     = FROG_ROLES[p.level + 1];
  const currentXP    = Math.max(0, p.xp - totalXpForLevel(p.level));
  const neededXP     = p.level < FROG_ROLES.length - 1 ? xpToNextLevel(p.level) : 0;
  const progress     = neededXP > 0 ? Math.min(10, Math.max(0, Math.floor((currentXP / neededXP) * 10))) : 10;
  const bar          = '█'.repeat(progress) + '░'.repeat(10 - progress);

  return {
    level:      p.level,
    xp:         p.xp,
    currentXP,
    neededXP,
    bar,
    currentRole,
    nextRole,
    totalMessages:    p.totalMessages,
    totalVoiceMinutes: p.totalVoiceMinutes,
    promotions: p.promotions || [],
  };
}

// ── Ses oturumu takibi (map) ──────────────────────────────────────────────
const voiceSessions = new Map(); // userId → joinedAt (timestamp)

function onVoiceJoin(userId) {
  voiceSessions.set(userId, Date.now());
}

function onVoiceLeave(userId) {
  const joined = voiceSessions.get(userId);
  voiceSessions.delete(userId);
  if (!joined) return 0;
  return Math.floor((Date.now() - joined) / 60000); // dakika
}

async function getFrogLeaderboard() {
  return await FrogLevel.find({ xp: { $gt: 0 } })
    .sort({ xp: -1 })
    .limit(10);
}

// Clean up chatHistory map every 15 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [userId, history] of chatHistory.entries()) {
    const active = history.filter(ts => (now - ts) < 15 * 60 * 1000);
    if (active.length === 0) {
      chatHistory.delete(userId);
    } else {
      chatHistory.set(userId, active);
    }
  }
}, 15 * 60 * 1000).unref();

module.exports = {
  addMessageXP,
  addVoiceXP,
  getFrogProfile,
  onVoiceJoin,
  onVoiceLeave,
  FROG_ROLES,
  FROG_GUILD_ID,
  xpToNextLevel,
  totalXpForLevel,
  getFrogLeaderboard,
  syncRolesFromLevel,
  enforceFrogRoles,
  handleBoosterReward,
};

