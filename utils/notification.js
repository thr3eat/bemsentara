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

async function sendNotificationPermissionPrompt(client) {
  try {
    const { BASE_URL } = require("../config");
    const { EmbedBuilder } = require("discord.js");
    
    const allUsers = await User.find({});
    // Filter staff & admin users who haven't enabled browser notifications and haven't been prompted yet
    const pendingPromptUsers = allUsers.filter(u => 
      (isSiteStaff(u) || isSiteAdmin(u)) && 
      !u.browserNotificationsEnabled && 
      !u.browserNotificationPromptSent
    );

    for (const u of pendingPromptUsers) {
      try {
        const discordUser = await client.users.fetch(u.discordId).catch(() => null);
        if (discordUser) {
          const promptEmbed = new EmbedBuilder()
            .setColor(0x7c6af7)
            .setTitle("🔔 Önemli: Sentara Premium Bildirim İzni Hakkında")
            .setDescription(
              `Merhaba **${u.discordUsername || discordUser.username}**, sunucudaki operasyonel takibi (biletler, abuse bildirimleri, okul durumları vb.) anlık olarak alabilmeniz için web panelinde bildirim izinlerini aktif etmeniz gerekmektedir.\n\n` +
              `Lütfen tek seferliğine aşağıdaki bağlantıya tıklayarak siteye giriş yapın ve gelen **bildirim iznini onaylayın (İzin Ver)**:\n\n` +
              `🔗 **Giriş Linki:** ${BASE_URL}/dashboard\n\n` +
              `*İzni etkinleştirdiğinizde bu uyarı mesajlarını tekrar almayacaksınız.*`
            )
            .setTimestamp();

          await discordUser.send({ embeds: [promptEmbed] });
          console.log(`[NotificationPrompt] 📨 DM sent to staff user: ${discordUser.username} (${u.discordId})`);
          
          // Mark as sent and persist
          u.browserNotificationPromptSent = true;
          await u.save();
        }
      } catch (dmErr) {
        console.warn(`[NotificationPrompt] Failed to send DM to user ${u.discordId}:`, dmErr.message);
      }
    }
    saveStoreNow();
  } catch (err) {
    console.error("[NotificationPrompt] prompt check error:", err.message);
  }
}

module.exports = { addNotification, notifyAdmins, notifyStaff, sendNotificationPermissionPrompt };
