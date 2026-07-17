const User = require("../models/User");
const { saveStoreNow } = require("../models/Store");
const crypto = require("crypto");
const { isSiteAdmin, isSiteStaff } = require("./adminCheck");

async function addNotification(discordId, { title, message, icon = "🔔" }) {
  try {
    const user = await User.findOne({ discordId: String(discordId) });
    if (!user) return false;

    if (!user.notifications) user.notifications = [];
    user.notifications.push({
      id: crypto.randomBytes(8).toString("hex"),
      title,
      message,
      icon,
      read: false,
      createdAt: new Date(),
    });

    if (user.notifications.length > 100) {
      user.notifications = user.notifications.slice(-100);
    }

    await user.save();
    saveStoreNow();
    return true;
  } catch (err) {
    console.error("addNotification error:", err);
    return false;
  }
}

async function notifyAdmins({ title, message, icon = "🚨" }) {
  try {
    const allUsers = await User.find({});
    for (const u of allUsers) {
      if (isSiteAdmin(u)) {
        await addNotification(u.discordId, { title, message, icon });
      }
    }
    return true;
  } catch (err) {
    console.error("notifyAdmins error:", err);
    return false;
  }
}

async function notifyStaff({ title, message, icon = "👨‍💼" }) {
  try {
    const allUsers = await User.find({});
    for (const u of allUsers) {
      if (isSiteStaff(u)) {
        await addNotification(u.discordId, { title, message, icon });
      }
    }
    return true;
  } catch (err) {
    console.error("notifyStaff error:", err);
    return false;
  }
}

module.exports = { addNotification, notifyAdmins, notifyStaff };
