'use strict';

const { EmbedBuilder } = require("discord.js");
const StaffUnit = require("../../models/StaffUnit");
const Economy = require("../../models/Economy");
const StaffProgress = require("../../models/StaffProgress");

const UNIT_CONFIG = {
  BAN_BIRIMI: { label: 'BAN BİRİMİ', icon: '🛡️', color: 0xe74c3c },
  SES_BIRIMI: { label: 'SES BİRİMİ', icon: '🎤', color: 0x3498db },
  SOHBET_BIRIMI: { label: 'SOHBET BİRİMİ', icon: '💬', color: 0x2ecc71 },
};

/**
 * Calculate unit statistics
 */
async function calculateUnitStats() {
  try {
    const stats = {};

    for (const [unitKey, config] of Object.entries(UNIT_CONFIG)) {
      // Get all members of this unit
      const members = await StaffUnit.find({ unitName: unitKey });
      const memberCount = members.length;

      // Calculate total XP from all members
      let totalXP = 0;
      let activeMemberCount = 0;

      for (const member of members) {
        const progress = await StaffProgress.findOne({ userId: member.userId });
        if (progress) {
          totalXP += progress.xp || 0;
          activeMemberCount += (progress.lastActive && 
            (new Date() - progress.lastActive) < 7 * 24 * 60 * 60 * 1000) ? 1 : 0;
        }
      }

      const averageXP = memberCount > 0 ? Math.floor(totalXP / memberCount) : 0;

      stats[unitKey] = {
        unitKey,
        label: config.label,
        icon: config.icon,
        memberCount,
        activeMemberCount,
        totalXP,
        averageXP,
        lastUpdated: new Date(),
      };
    }

    return { success: true, stats };
  } catch (err) {
    console.error('[unitLeaderboard] calculateUnitStats error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get unit leaderboard rankings
 */
async function getUnitLeaderboard() {
  try {
    const result = await calculateUnitStats();
    if (!result.success) {
      return result;
    }

    // Sort by XP descending, then by member count descending
    const ranked = Object.values(result.stats)
      .sort((a, b) => {
        if (b.totalXP !== a.totalXP) {
          return b.totalXP - a.totalXP;
        }
        return b.memberCount - a.memberCount;
      })
      .map((unit, index) => ({
        ...unit,
        rank: index + 1,
        medal: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ',
      }));

    return { success: true, leaderboard: ranked };
  } catch (err) {
    console.error('[unitLeaderboard] getUnitLeaderboard error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Create leaderboard embed
 */
async function createLeaderboardEmbed() {
  try {
    const result = await getUnitLeaderboard();
    if (!result.success) {
      return null;
    }

    const leaderboard = result.leaderboard;

    let description = "📊 **BİRİM LIDERBORDU**\n\n";
    description += "Birimler toplam XP'ye göre sıralanmıştır.\n\n";

    for (const unit of leaderboard) {
      const line = `${unit.medal} **#${unit.rank} ${unit.icon} ${unit.label}**\n` +
        `└─ **XP:** ${unit.totalXP.toLocaleString('tr-TR')} | ` +
        `**Üyeler:** ${unit.memberCount} | ` +
        `**Aktif:** ${unit.activeMemberCount} | ` +
        `**Ort. XP:** ${unit.averageXP.toLocaleString('tr-TR')}\n\n`;
      description += line;
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 Birim Liderbordu")
      .setDescription(description)
      .setColor(0xf39c12)
      .setFooter({ text: "EkoYıldız Birim Sistem" })
      .setTimestamp();

    return embed;
  } catch (err) {
    console.error('[unitLeaderboard] createLeaderboardEmbed error:', err.message);
    return null;
  }
}

/**
 * Get specific unit info
 */
async function getUnitInfo(unitKey) {
  try {
    const result = await calculateUnitStats();
    if (!result.success) {
      return result;
    }

    const unitStats = result.stats[unitKey];
    if (!unitStats) {
      return { success: false, error: "Unit not found" };
    }

    // Get members of this unit
    const members = await StaffUnit.find({ unitName: unitKey });
    const memberDetails = [];

    for (const member of members) {
      const progress = await StaffProgress.findOne({ userId: member.userId });
      memberDetails.push({
        userId: member.userId,
        username: member.username || "Unknown",
        rank: member.rank || 1,
        xp: progress?.xp || 0,
        joinedAt: member.joinedAt,
      });
    }

    // Sort by XP descending
    memberDetails.sort((a, b) => b.xp - a.xp);

    return {
      success: true,
      unit: unitStats,
      members: memberDetails,
    };
  } catch (err) {
    console.error('[unitLeaderboard] getUnitInfo error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Create unit info embed
 */
async function createUnitInfoEmbed(unitKey) {
  try {
    const result = await getUnitInfo(unitKey);
    if (!result.success) {
      return null;
    }

    const { unit, members } = result;
    const config = UNIT_CONFIG[unitKey];

    let membersList = "**İlk 10 Üye (XP Sırasına Göre):**\n\n";
    
    for (let i = 0; i < Math.min(10, members.length); i++) {
      const m = members[i];
      membersList += `${i + 1}. ${m.username} - **${m.xp}** XP (Rütbe ${m.rank})\n`;
    }

    if (members.length === 0) {
      membersList = "*Bu birimde henüz üye yok.*";
    }

    const embed = new EmbedBuilder()
      .setTitle(`${config.icon} ${unit.label} - Birim Detayları`)
      .setColor(config.color)
      .addFields(
        {
          name: "📊 İstatistikler",
          value: `**Toplam Üye:** ${unit.memberCount}\n` +
            `**Aktif Üye:** ${unit.activeMemberCount}\n` +
            `**Toplam XP:** ${unit.totalXP.toLocaleString('tr-TR')}\n` +
            `**Ort. XP:** ${unit.averageXP.toLocaleString('tr-TR')}`,
          inline: false,
        },
        {
          name: "👥 Üyeler",
          value: membersList,
          inline: false,
        }
      )
      .setFooter({ text: "EkoYıldız Birim Sistem" })
      .setTimestamp();

    return embed;
  } catch (err) {
    console.error('[unitLeaderboard] createUnitInfoEmbed error:', err.message);
    return null;
  }
}

module.exports = {
  calculateUnitStats,
  getUnitLeaderboard,
  createLeaderboardEmbed,
  getUnitInfo,
  createUnitInfoEmbed,
};
