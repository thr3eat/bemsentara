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

// ── Mesaj XP ekle ─────────────────────────────────────────────────────────
async function addMessageXP(member, client) {
  if (!member || !member.guild || !member.user) {
    console.warn('[frogLevel] Invalid member object in addMessageXP');
    return;
  }
  
  if (member.guild.id !== FROG_GUILD_ID) return;
  if (member.user.bot) return;

  const p = await getOrCreate(member.id).catch(err => {
    console.error('[frogLevel] getOrCreate error in addMessageXP:', err.message);
    return null;
  });
  if (!p) return;

  // Cooldown kontrolü
  const now = Date.now();
  if (p.lastMessageAt && (now - new Date(p.lastMessageAt).getTime()) < MSG_COOLDOWN_MS) return;

  // Eğer hiç seviye yoksa Discord rollerinden senkronize et
  if (p.level === 0 && p.xp === 0) {
    const discordLevel = await syncLevelFromRoles(member);
    if (discordLevel > 0) {
      p.level = discordLevel;
      p.xp    = totalXpForLevel(discordLevel);
    }
  }

  p.xp            += XP_PER_MESSAGE;
  p.totalMessages  = (p.totalMessages || 0) + 1;
  p.lastMessageAt   = new Date();
  await p.save();

  await checkLevelUp(p, member, client);
}

// ── Ses dakikası XP ekle ──────────────────────────────────────────────────
async function addVoiceXP(userId, minutes, client) {
  const p = await getOrCreate(userId);
  p.xp                += minutes * XP_PER_VOICE_MIN;
  p.totalVoiceMinutes  = (p.totalVoiceMinutes || 0) + minutes;
  await p.save();

  // Guild'den member fetch et
  try {
    const guild  = await client.guilds.fetch(FROG_GUILD_ID).catch(() => null);
    if (!guild) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    await checkLevelUp(p, member, client);
  } catch (_) {}
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

  // Eski rolü kaldır, yeni rol ver
  try {
    const oldRole = FROG_ROLES[oldLevel];
    const newRole = FROG_ROLES[newLevel];

    if (oldRole) await member.roles.remove(oldRole.id, 'Kurbağa seviye atladı').catch(() => {});
    if (newRole) await member.roles.add(newRole.id,    'Kurbağa seviye atladı').catch(() => {});
  } catch (err) {
    console.warn('[frogLevel] Rol hatası:', err.message);
  }

  const isFinal = newLevel === maxLevel;
  const newRoleInfo = FROG_ROLES[newLevel];

  // Seviye atlama mesajı — sunucuda bir kanala gönder
  try {
    const guild = member.guild;
    // Genel/sohbet kanalı bul
    const channel = guild.channels.cache.find(c =>
      c.isTextBased?.() &&
      (c.name.includes('genel') || c.name.includes('sohbet') || c.name.includes('general'))
    ) || guild.systemChannel;

    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(isFinal ? 0xffd700 : 0x4ade80)
        .setTitle(isFinal ? '🏆 MAKSIMUM SEVİYE!' : `🎉 SEVİYE ATLADI!`)
        .setDescription(
          isFinal
            ? `**${member.displayName}** tüm kurbağa macerasını tamamladı! 🐸👑\nEko Yıldız'ın en güçlü kurbağası oldu!`
            : `**${member.displayName}** yeni bir seviyeye ulaştı!\n**${FROG_ROLES[oldLevel]?.name}** → **${newRoleInfo.name}**`
        )
        .addFields(
          { name: '📊 Yeni Seviye', value: `${newLevel}/${maxLevel}`, inline: true },
          { name: '✨ Toplam XP',   value: `${p.xp.toLocaleString()}`, inline: true },
          { name: '⬆️ Sonraki seviye için', value: newLevel < maxLevel ? `${xpToNextLevel(newLevel).toLocaleString()} XP` : 'MAX SEVİYE', inline: true },
        )
        .setThumbnail(member.displayAvatarURL())
        .setFooter({ text: 'Eko Yıldız • Kurbağa Sistemi 🐸' })
        .setTimestamp();

      await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
    }
  } catch (err) {
    console.warn('[frogLevel] Kanal mesajı gönderilemedi:', err.message);
  }

  // ── DM'ye seviye atlama bildirimi gönder ──────────────────────────────────
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(isFinal ? 0xffd700 : 0x4ade80)
      .setTitle(isFinal ? '🏆 TEBRIKLER! MAKSIMUM SEVİYE! 🏆' : `🎉 SEVİYE ATLAMA BAŞARILI! 🎉`)
      .setThumbnail(member.displayAvatarURL());

    if (isFinal) {
      dmEmbed.setDescription(
        `**Tebrikler, ${member.displayName}!**\n\n` +
        `Eko Yıldız kurbağa sisteminde en üst seviyeye ulaştın! 👑\n\n` +
        `🐸 **${newRoleInfo.name}** olarak tüm rotaları tamamladın!\n` +
        `Bundan sonra sırada ne var öğrenmek için sekreterle konuş.`
      );
    } else {
      const nextXp = xpToNextLevel(newLevel);
      dmEmbed.setDescription(
        `**Tebrikler!** Yeni seviyeye ulaştın! 🐸\n\n` +
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

    dmEmbed.setFooter({ text: 'Eko Yıldız • Kurbağa Sistemi 🐸' })
           .setTimestamp();

    await member.user.send({ embeds: [dmEmbed] }).catch(() => {});
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
  const currentXP    = p.xp - totalXpForLevel(p.level);
  const neededXP     = p.level < FROG_ROLES.length - 1 ? xpToNextLevel(p.level) : 0;
  const progress     = neededXP > 0 ? Math.floor((currentXP / neededXP) * 10) : 10;
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
};
