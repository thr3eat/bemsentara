'use strict';

const { EmbedBuilder } = require('discord.js');
const FrogLevel = require('../../models/FrogLevel');

// ── EkoYıldız sunucu ID ─────────────────────────────────────────────────────
const FROG_GUILD_ID = process.env.FROG_GUILD_ID || '1367646464804655104';

// ── Kurbağa rol hiyerarşisi (küçükten büyüğe) ──────────────────────────────
const FROG_ROLES = [
  { level: 0,  name: '🐸 Yavru Kurbağa',    id: '1393357935601516655' },
  { level: 1,  name: '👀 Uyanık Kurbağa',    id: '1470130207439585450' },
  { level: 2,  name: '🧠 Zeki Kurbağa',      id: '1470130259868258460' },
  { level: 3,  name: '👻 Efsane Kurbağa',    id: '1470130443251875942' },
  { level: 4,  name: '💼 Boss Kurbağa',      id: '1470130555994767401' },
  { level: 5,  name: '😎 Havalı Kurbağa',    id: '1470130578002149678' },
  { level: 6,  name: '🎉 Olay Kurbağa',      id: '1470130793538912513' },
  { level: 7,  name: '⚡ Bela Kurbağa',      id: '1470130523019018301' },
  { level: 8,  name: '🌀 Kaos Kurbağa',      id: '1470130602824040511' },
  { level: 9,  name: '👑 Alpha Kurbağa',     id: '1460348318872764612' },
  { level: 10, name: '⭐ İyi Kurbağa',       id: '1462847100734931098' },
  { level: 11, name: '🦋 Garip Kurbağa',     id: '1481276717372014788' },
  { level: 12, name: '🦖 Oyuncu Dinazor',     id: '1517698454036418590' },
  { level: 13, name: '🦖 Havalı Dinazor',     id: '1517698456804790273' },
  { level: 14, name: '🦖 Hiper Dinazor',      id: '1517698459681951906' },
  { level: 15, name: '🦖 Volkanik Dinazor',   id: '1517698448390881391' },
  { level: 16, name: '🦖 Kral Dinazor',       id: '1517698451276828824' },
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
    
    // Double XP check
    let xpGain = minutes * XP_PER_VOICE_MIN;
    if (p.doubleXpUntil && new Date(p.doubleXpUntil) > new Date()) {
      xpGain *= 2;
    }

    p.xp                += xpGain;
    p.totalVoiceMinutes  = (p.totalVoiceMinutes || 0) + minutes;
    await p.save().catch(err => {
      console.error('[frogLevel] Save failed during addVoiceXP:', err.message);
      throw err;
    });

    // Guild'den member fetch et
    const guild = await client.guilds.fetch(FROG_GUILD_ID).catch(err => {
      console.warn(`[frogLevel] Guild ${FROG_GUILD_ID} not found:`, err.code);
      return null;
    });
    if (!guild) return;
    
    const member = await guild.members.fetch(userId).catch(err => {
      console.warn(`[frogLevel] Member ${userId} not found:`, err.code);
      return null;
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
    
    // Temizlenecek diğer tüm seviye rollerini bul
    const rolesToRemove = [];
    for (const fr of FROG_ROLES) {
      if (fr.level !== level && currentRoles.includes(fr.id)) {
        rolesToRemove.push(fr.id);
      }
    }

    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove, 'Seviye Rol Senkronizasyonu').catch(() => {});
    }

    if (targetRole && !currentRoles.includes(targetRole.id)) {
      await member.roles.add(targetRole.id, 'Seviye Rol Senkronizasyonu').catch(() => {});
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
};

