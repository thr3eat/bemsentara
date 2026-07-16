/**
 * Activity Tracker Store
 * Stores active user locations, cursor positions, and clicks.
 */

const activeUsers = new Map();

// Cleans up users who haven't pinged in 10 seconds
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of activeUsers.entries()) {
    if (now - data.lastSeen > 10000) {
      activeUsers.delete(userId);
    }
  }
}, 5000);

function updateActivity(user, activityData) {
  if (!user || !user.discordId) return;
  
  const userId = String(user.discordId);
  const now = Date.now();

  const existing = activeUsers.get(userId) || {
    username: user.username || user.discordUsername || "Bilinmiyor",
    avatar: user.avatar || "",
    clicks: []
  };

  const newClicks = (activityData.clicks && activityData.clicks.length > 0) ? activityData.clicks : [];
  
  if (newClicks.length > 0) {
    const logger = require("../../utils/logger");
    newClicks.forEach(click => {
      if (click.element) {
        logger.log(`[USER_ACTIVITY] ${user.discordUsername || user.username} (${userId}) tıkladı: "${click.element}" (${activityData.url || existing.url})`, "debug");
      }
    });
  }

  activeUsers.set(userId, {
    ...existing,
    lastSeen: now,
    x: activityData.x || existing.x || 0,
    y: activityData.y || existing.y || 0,
    w: activityData.w || existing.w || 1920,
    h: activityData.h || existing.h || 1080,
    url: activityData.url || existing.url || "/",
    clicks: newClicks.length > 0 
      ? [...existing.clicks, ...newClicks].slice(-20) // Keep last 20 clicks
      : existing.clicks
  });
}

function getActiveUsers() {
  const users = [];
  for (const [userId, data] of activeUsers.entries()) {
    users.push({ userId, ...data });
  }
  return users;
}

module.exports = {
  updateActivity,
  getActiveUsers
};
