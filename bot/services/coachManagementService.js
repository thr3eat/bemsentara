'use strict';

const Coach = require("../../models/Coach");
const { EmbedBuilder } = require("discord.js");

const MAIN_GUILD_ID = '1367646464804655104';

/**
 * Set a user as the main unit coach (Emre)
 */
async function setMainCoach(userId, name = "Emre") {
  try {
    let coach = await Coach.findOne({ discordId: userId });

    if (!coach) {
      coach = new Coach({
        discordId: userId,
        name: name,
        role: "coach",
        assignedBranches: ["BAN_BIRIMI", "SES_BIRIMI", "SOHBET_BIRIMI"],
        isActive: true,
      });
    } else {
      coach.name = name;
      coach.discordId = userId;
      coach.assignedBranches = ["BAN_BIRIMI", "SES_BIRIMI", "SOHBET_BIRIMI"];
      coach.isActive = true;
    }

    await coach.save();
    return { success: true, coach };
  } catch (err) {
    console.error('[coachManagement] setMainCoach error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Assign a branch to a coach
 */
async function assignBranchToCoach(coachId, branch) {
  try {
    const coach = await Coach.findById(coachId);
    if (!coach) {
      return { success: false, error: "Coach not found" };
    }

    if (!coach.assignedBranches) {
      coach.assignedBranches = [];
    }

    if (!coach.assignedBranches.includes(branch)) {
      coach.assignedBranches.push(branch);
      await coach.save();
    }

    return { success: true, coach };
  } catch (err) {
    console.error('[coachManagement] assignBranchToCoach error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get main coach info
 */
async function getMainCoach() {
  try {
    const coaches = await Coach.find({ isActive: true });
    if (!coaches || coaches.length === 0) {
      return { success: false, coach: null, message: "No active coach found" };
    }

    // Return the first active coach (usually Emre)
    return { success: true, coach: coaches[0] };
  } catch (err) {
    console.error('[coachManagement] getMainCoach error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get coach by branch
 */
async function getCoachForBranch(branch) {
  try {
    const coaches = await Coach.find({ isActive: true });
    if (!coaches || coaches.length === 0) {
      return { success: false, coach: null };
    }

    // Find coach assigned to this branch
    const coachForBranch = coaches.find(c => 
      c.assignedBranches && c.assignedBranches.includes(branch)
    );

    return { 
      success: true, 
      coach: coachForBranch || coaches[0] // Fallback to first coach
    };
  } catch (err) {
    console.error('[coachManagement] getCoachForBranch error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get coach info for panel display
 */
async function getCoachDisplayInfo() {
  try {
    const result = await getMainCoach();
    if (!result.success || !result.coach) {
      return {
        name: "Birim Koçu (Atanmamış)",
        branches: [],
        isActive: false
      };
    }

    const coach = result.coach;
    return {
      name: coach.name || "Emre",
      discordId: coach.discordId,
      branches: coach.assignedBranches || [],
      isActive: coach.isActive,
      createdAt: coach.createdAt
    };
  } catch (err) {
    console.error('[coachManagement] getCoachDisplayInfo error:', err.message);
    return {
      name: "Birim Koçu (Hata)",
      branches: [],
      isActive: false
    };
  }
}

/**
 * Create coach info embed for panel
 */
async function createCoachInfoEmbed() {
  try {
    const info = await getCoachDisplayInfo();

    const embed = new EmbedBuilder()
      .setTitle("👨‍🏫 Birim Koçu Bilgisi")
      .setColor(0x7c6af7)
      .addFields(
        { name: "Koç Adı", value: info.name, inline: true },
        { name: "Durum", value: info.isActive ? "🟢 Aktif" : "🔴 İnaktif", inline: true },
        { name: "Sorumluluk Birimleri", value: info.branches.length > 0 ? info.branches.join(", ") : "Birim atanmamış", inline: false }
      )
      .setTimestamp();

    return embed;
  } catch (err) {
    console.error('[coachManagement] createCoachInfoEmbed error:', err.message);
    return null;
  }
}

/**
 * Remove coach assignment
 */
async function removeCoach(coachId) {
  try {
    const coach = await Coach.findById(coachId);
    if (!coach) {
      return { success: false, error: "Coach not found" };
    }

    coach.isActive = false;
    await coach.save();

    return { success: true, message: "Coach removed successfully" };
  } catch (err) {
    console.error('[coachManagement] removeCoach error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  setMainCoach,
  assignBranchToCoach,
  getMainCoach,
  getCoachForBranch,
  getCoachDisplayInfo,
  createCoachInfoEmbed,
  removeCoach,
};
