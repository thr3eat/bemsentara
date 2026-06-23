'use strict';

const { PermissionFlagsBits, ChannelType } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');

const ADMIN_GUILD_ID = '1466927911364726845';
const TARGET_CATEGORY_ID = '1517929217461846116';

// Staff/Mod Roles in Admin Guild
const STAFF_ROLE_IDS = [
  '1467082387933499524', // Moderatör Ekibi
  '1480592150273200330', // Ceza Yetkilisi
  '1479818628152168479', // Abone Yetkilisi
  '1517656567481372772', // Level 5
  '1517695716594683904', // Level 6
];

/**
 * Gets or creates a private log channel for a moderator
 * @param {import('discord.js').Client} client
 * @param {string} moderatorId
 * @returns {Promise<import('discord.js').TextChannel|null>}
 */
async function getOrCreateModChannel(client, moderatorId) {
  try {
    const guild = await client.guilds.fetch(ADMIN_GUILD_ID).catch(() => null);
    if (!guild) {
      console.error(`[ModChannelService] Admin Guild ${ADMIN_GUILD_ID} not found.`);
      return null;
    }

    // Look for existing channel under category with topic matching moderator ID
    let channel = guild.channels.cache.find(c => 
      c.parentId === TARGET_CATEGORY_ID && 
      c.topic && c.topic.includes(moderatorId)
    );

    if (channel) return channel;

    // Fetch member to get username
    const member = await guild.members.fetch(moderatorId).catch(() => null);
    if (!member) {
      console.warn(`[ModChannelService] Member ${moderatorId} not found in Admin Guild.`);
      return null;
    }

    // Create clean channel name
    const username = member.user.username;
    const channelName = `log-${username.toLowerCase().replace(/[^a-z0-9-_]/g, '')}`;

    channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: TARGET_CATEGORY_ID,
      topic: `Moderator Log | ID: ${moderatorId}`,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: moderatorId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages] // Read-only for the moderator
        },
        {
          id: client.user.id, // Bot itself
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
        }
      ],
      reason: `Moderatör özel log kanalı oluşturuldu. Yetkili: ${member.user.tag}`
    });

    console.log(`[ModChannelService] Created channel #${channel.name} for moderator ${member.user.tag}`);
    return channel;
  } catch (err) {
    console.error(`[ModChannelService] Error creating channel for moderator ${moderatorId}:`, err);
    return null;
  }
}

/**
 * Sends a log embed/payload to a moderator's custom log channel
 * @param {import('discord.js').Client} client
 * @param {string} moderatorId
 * @param {import('discord.js').EmbedBuilder|object} embedOrPayload
 */
async function logToModChannel(client, moderatorId, embedOrPayload) {
  try {
    const channel = await getOrCreateModChannel(client, moderatorId);
    if (!channel) return false;

    const payload = embedOrPayload.toJSON ? { embeds: [embedOrPayload] } : embedOrPayload;
    await channel.send(payload);
    return true;
  } catch (err) {
    console.error(`[ModChannelService] Failed to send log to moderator ${moderatorId} channel:`, err.message);
    return false;
  }
}

/**
 * Scans all moderators in the Admin Guild and pre-creates their log channels
 * @param {import('discord.js').Client} client
 * @returns {Promise<{success: number, failed: number}>}
 */
async function createAllModChannels(client) {
  const result = { success: 0, failed: 0 };
  try {
    const guild = await client.guilds.fetch(ADMIN_GUILD_ID).catch(() => null);
    if (!guild) {
      console.error(`[ModChannelService] Guild not found: ${ADMIN_GUILD_ID}`);
      return result;
    }

    // Fetch all guild members
    const members = await guild.members.fetch();
    const staffIdsInDb = (await StaffProgress.find({}, 'userId')).map(p => p.userId);

    const moderators = members.filter(m => {
      if (m.user.bot) return false;
      
      // Check roles in admin guild
      const hasStaffRole = STAFF_ROLE_IDS.some(rid => m.roles.cache.has(rid));
      if (hasStaffRole) return true;

      // Check DB
      if (staffIdsInDb.includes(m.id)) return true;

      // Check name containing moderator/staff/sekreter/koordinator keywords
      const hasModNameRole = m.roles.cache.some(r => {
        const name = r.name.toLowerCase();
        return name.includes('moderatör') || name.includes('personel') || name.includes('sekreter') || name.includes('koordinatör');
      });
      if (hasModNameRole) return true;

      return false;
    });

    console.log(`[ModChannelService] Found ${moderators.size} moderators. Creating channels...`);

    for (const [modId, member] of moderators.entries()) {
      const channel = await getOrCreateModChannel(client, modId);
      if (channel) {
        result.success++;
      } else {
        result.failed++;
      }
    }
  } catch (err) {
    console.error(`[ModChannelService] createAllModChannels error:`, err);
  }
  return result;
}

module.exports = {
  getOrCreateModChannel,
  logToModChannel,
  createAllModChannels
};
