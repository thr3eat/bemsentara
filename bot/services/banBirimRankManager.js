'use strict';

const { PermissionFlagsBits } = require('discord.js');
const { BAN_BIRIM_RANKS_SEASON_1, BAN_BIRIM_RANKS_SEASON_2, getRank, getRankLabel } = require('../config/banBirimRanks');

const GUILD_ID = '1466927911364726845'; // Ban Birimi Sunucusu

/**
 * Ban Birimi tüm rütbeleri için Discord rollerini oluştur veya güncelle
 * Roller sunucuya en aşağıda oluşturulur
 */
async function ensureBanBirimRoles(guild, season = 1) {
  try {
    const ranks = season === 2 ? BAN_BIRIM_RANKS_SEASON_2 : BAN_BIRIM_RANKS_SEASON_1;
    const createdRoles = {};
    let rolesCreated = 0;
    let rolesFound = 0;

    for (const [rankId, rankData] of Object.entries(ranks)) {
      const roleName = `[S${season}] ${rankData.label}`;
      
      // Aynı isimde rol var mı kontrol et
      let role = guild.roles.cache.find(r => r.name === roleName);

      if (role) {
        rolesFound++;
        // Yalnızca renk farklıysa güncelle — gereksiz API çağrısını ve audit log kirliliğini önler
        const currentHex = role.hexColor?.toLowerCase();
        const expectedHex = typeof rankData.color === 'string'
          ? rankData.color.toLowerCase()
          : `#${rankData.color.toString(16).padStart(6, '0')}`.toLowerCase();
        if (currentHex !== expectedHex) {
          await role.edit({
            color: rankData.color,
          }).catch(err => {
            console.warn(`[banRankManager] Rol güncelleme hatası (${roleName}):`, err.message);
          });
        }
      } else {
        // Oluştur
        try {
          role = await guild.roles.create({
            name: roleName,
            color: rankData.color,
            reason: `Ban Birimi Rütbe Sistemi - Sezon ${season} - Rütbe ${rankId}`,
            permissions: [],
          });
          rolesCreated++;
        } catch (err) {
          console.error(`[banRankManager] Rol oluşturma hatası (${roleName}):`, err.message);
          continue;
        }
      }

      createdRoles[rankId] = {
        roleId: role.id,
        roleName: role.name,
        color: rankData.color,
        emoji: rankData.emoji,
        label: rankData.label,
      };
    }

    console.log(`[banRankManager] ✅ Sezon ${season} rütbeleri işlendi: ${rolesCreated} oluşturuldu, ${rolesFound} güncellendi`);
    return { success: true, rolesCreated, rolesFound, createdRoles };
  } catch (err) {
    console.error('[banRankManager] ensureBanBirimRoles hatası:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Kullanıcıya belirtilen rütbe rolünü ver
 */
async function assignBanRank(guild, member, rankId, season = 1) {
  try {
    const rank = getRank(rankId, season);
    if (!rank) {
      return { success: false, error: 'Rütbe bulunamadı' };
    }

    const roleName = `[S${season}] ${rank.label}`;
    const role = guild.roles.cache.find(r => r.name === roleName);

    if (!role) {
      return { success: false, error: 'Rol bulunamadı. Lütfen ensureBanBirimRoles() çalıştırın' };
    }

    // Eski rütbeleri kaldır
    const oldRanks = season === 2 ? Object.values(BAN_BIRIM_RANKS_SEASON_2) : Object.values(BAN_BIRIM_RANKS_SEASON_1);
    for (const oldRank of oldRanks) {
      const oldRoleName = `[S${season}] ${oldRank.label}`;
      const oldRole = guild.roles.cache.find(r => r.name === oldRoleName);
      if (oldRole && member.roles.cache.has(oldRole.id)) {
        await member.roles.remove(oldRole).catch(() => {});
      }
    }

    // Yeni rütbeyi ver
    await member.roles.add(role);

    return {
      success: true,
      rank: rankId,
      rankLabel: rank.label,
      roleId: role.id,
      roleName: role.name,
    };
  } catch (err) {
    console.error('[banRankManager] assignBanRank hatası:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Kullanıcının mevcut rütbesini getir
 */
async function getUserBanRank(guild, member, season = 1) {
  try {
    const ranks = season === 2 ? BAN_BIRIM_RANKS_SEASON_2 : BAN_BIRIM_RANKS_SEASON_1;

    for (const [rankId, rankData] of Object.entries(ranks)) {
      const roleName = `[S${season}] ${rankData.label}`;
      const role = guild.roles.cache.find(r => r.name === roleName);

      if (role && member.roles.cache.has(role.id)) {
        return { success: true, rank: rankId, rankData };
      }
    }

    return { success: false, rank: null, message: 'Kullanıcı rütbe sahibi değil' };
  } catch (err) {
    console.error('[banRankManager] getUserBanRank hatası:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sezon geçişi: Sezon 1'den Sezon 2'ye
 * Kullanıcıya ödül verir ve Sezon 2 rütbesini atar
 */
async function promoteToSeason2(client, userId, season1RankId) {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      return { success: false, error: 'Kullanıcı bulunamadı' };
    }

    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) {
      return { success: false, error: 'Guild bulunamadı' };
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return { success: false, error: 'Üye bulunamadı' };
    }

    // Sezon 2'nin karşılık gelen rütbesini ata
    const season2RankId = season1RankId; // Aynı ID'de karşılık gelen Sezon 2 rütbesi var
    const season2RankData = getRank(season2RankId, 2);

    if (!season2RankData) {
      return { success: false, error: 'Sezon 2 rütbesi bulunamadı' };
    }

    // Sezon 1 rollerini kaldır
    const season1Ranks = Object.values(BAN_BIRIM_RANKS_SEASON_1);
    for (const rank of season1Ranks) {
      const roleName = `[S1] ${rank.label}`;
      const role = guild.roles.cache.find(r => r.name === roleName);
      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(() => {});
      }
    }

    // Sezon 2 rütbesini ata
    const assignResult = await assignBanRank(guild, member, season2RankId, 2);

    if (!assignResult.success) {
      return assignResult;
    }

    // Seçimi ve ödülü bildir
    const season1Rank = getRank(season1RankId, 1);
    const seasonTransitionEmbed = {
      color: 0x00ff00,
      title: '🎉 2. SEZONA HOŞ GELDİN!',
      description:
        `**${user.username}**, 1. Sezondan 2. Sezona başarıyla terfi ettin! 🚀\n\n` +
        `**1. Sezon Rütben:** ${season1Rank.emoji} ${season1Rank.label}\n` +
        `**2. Sezon Rütben:** ${season2RankData.emoji} ${season2RankData.label}\n\n` +
        `**Seçimin Kutlu Olsun!** Yeni sezonun daha zorlu görevlere hazır olmalı. 💪`,
      footer: { text: 'Ban Birimi Sistem Yükseltmesi' },
      timestamp: new Date(),
    };

    await user.send({ embeds: [seasonTransitionEmbed] }).catch(err => {
      console.warn(`[banRankManager] DM gönderme hatası:`, err.message);
    });

    // Normal personel sistemine de ödül ver (XP, Badge, vb)
    // Bu kısım StaffProgress modeline eklenecek

    return {
      success: true,
      message: 'Sezon 2 promotionı başarılı',
      season2Rank: season2RankData,
      notification: seasonTransitionEmbed,
    };
  } catch (err) {
    console.error('[banRankManager] promoteToSeason2 hatası:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Ban Birim tüm rütbe sistemini görselleştir ve bilgi ver
 */
function getBanBirimRankHierarchy(season = 1) {
  const ranks = season === 2 ? BAN_BIRIM_RANKS_SEASON_2 : BAN_BIRIM_RANKS_SEASON_1;
  let hierarchy = `\n🏆 BAN BİRİMİ RÜTBE HİYERARŞİSİ - SEZON ${season}\n`;
  hierarchy += `${'='.repeat(50)}\n\n`;

  const tiers = {
    entry: '📍 GİRİŞ SEVİYESİ',
    mid: '📊 ORTA SEVİYE',
    high: '🎖️ ÜST SEVİYE',
    elite: '👑 ELİT RÜTBELER',
  };

  for (const [tier, tierLabel] of Object.entries(tiers)) {
    const tierRanks = Object.entries(ranks).filter(([_, r]) => r.tier === tier);
    if (tierRanks.length === 0) continue;

    hierarchy += `${tierLabel}\n${'-'.repeat(50)}\n`;
    for (const [rankId, rankData] of tierRanks) {
      hierarchy += `${rankData.emoji} **[${rankId}] ${rankData.label}** - ${rankData.englishLabel}\n`;
      hierarchy += `   ${rankData.description}\n\n`;
    }
  }

  return hierarchy;
}

/**
 * Rütbe yükseltme komutu (manual - admin tarafından)
 */
async function manualPromoteRank(guild, member, newRankId, season = 1) {
  try {
    const newRank = getRank(newRankId, season);
    if (!newRank) {
      return { success: false, error: 'Hedef rütbe bulunamadı' };
    }

    const result = await assignBanRank(guild, member, newRankId, season);
    if (!result.success) return result;

    const user = member.user;
    const promotionEmbed = {
      color: 0xffff00,
      title: '🎖️ RÜTBE YÜKSELTMESİ',
      description:
        `**${user.username}**, ${newRank.label} rütbesine yükseltildin!\n\n` +
        `${newRank.emoji} **${newRank.label}** (${newRank.englishLabel})\n` +
        `${newRank.description}`,
      footer: { text: 'Ban Birimi Rütbe Sistemi' },
      timestamp: new Date(),
    };

    await user.send({ embeds: [promotionEmbed] }).catch(() => {});

    return { success: true, promotion: result, notification: promotionEmbed };
  } catch (err) {
    console.error('[banRankManager] manualPromoteRank hatası:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  ensureBanBirimRoles,
  assignBanRank,
  getUserBanRank,
  promoteToSeason2,
  manualPromoteRank,
  getBanBirimRankHierarchy,
};
