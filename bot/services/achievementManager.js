'use strict';

const AchievementProgress = require('../../models/AchievementProgress');

/**
 * Increment a specific tracker field for a user in the database.
 * Returns the new value.
 *
 * @param {string} userId - Discord user ID
 * @param {string} fieldName - Field to increment (e.g. 'nightChatMsgs', 'pingCount')
 * @param {number} amount - Amount to increment (default 1)
 * @returns {Promise<number>} - The new value of the field
 */
async function incrementTracker(userId, fieldName, amount = 1) {
  try {
    let progress = await AchievementProgress.findOne({ userId });
    
    // For dailyChatMsgs, we want to reset if the day changed
    const todayStr = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
    
    if (!progress) {
      progress = new AchievementProgress({ userId });
      progress.lastDailyChatDate = todayStr;
    }
    
    // Daily reset check
    if (fieldName === 'dailyChatMsgs' && progress.lastDailyChatDate !== todayStr) {
      progress.dailyChatMsgs = 0;
      progress.lastDailyChatDate = todayStr;
    }

    progress[fieldName] = (progress[fieldName] || 0) + amount;
    await progress.save();

    return progress[fieldName];
  } catch (err) {
    console.error(`[achievementManager] Error incrementing ${fieldName} for ${userId}:`, err.message);
    return 0; // Return 0 on error, prevents achievement trigger on DB failure
  }
}

/**
 * Get a specific tracker field value without modifying it.
 *
 * @param {string} userId
 * @param {string} fieldName
 * @returns {Promise<number>}
 */
async function getTracker(userId, fieldName) {
  try {
    const progress = await AchievementProgress.findOne({ userId });
    return progress ? (progress[fieldName] || 0) : 0;
  } catch (err) {
    console.error(`[achievementManager] Error getting ${fieldName} for ${userId}:`, err.message);
    return 0;
  }
}

module.exports = {
  incrementTracker,
  getTracker
};
