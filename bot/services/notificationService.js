const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');

async function sendPush(userId, client, { emoji = '🔔', title = 'Sentara OS', body = '', actionLabel = null, actionCustomId = null, ephemeral = false }) {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return false;

    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle(`${emoji} ${title}`)
      .setDescription(body)
      .setTimestamp();

    const payload = { embeds: [embed] };

    if (actionLabel && actionCustomId) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(actionCustomId).setLabel(actionLabel).setStyle(ButtonStyle.Primary)
      );
      payload.components = [row];
    }

    await user.send(payload).catch(() => null);
    return true;
  } catch (err) {
    console.error('[notificationService] sendPush error:', err.message);
    return false;
  }
}

async function broadcastToActiveStaff(client, payloadFactory) {
  try {
    const staff = await StaffProgress.find({ status: 'active' }).select('userId settings');
    if (!staff || staff.length === 0) return 0;

    let sent = 0;
    for (const s of staff) {
      if (s.settings && s.settings.notificationsEnabled === false) continue;
      const payload = await payloadFactory(s);
      if (!payload) continue;
      const ok = await sendPush(s.userId, client, payload);
      if (ok) sent++;
    }

    return sent;
  } catch (err) {
    console.error('[notificationService] broadcast error:', err.message);
    return 0;
  }
}

module.exports = { sendPush, broadcastToActiveStaff };
