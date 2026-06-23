'use strict';

const { PermissionFlagsBits, ChannelType } = require('discord.js');

// Track temporary channel IDs in memory: channelId => creatorId
const tempChannels = new Map();

/**
 * Creates a temporary voice channel for a member
 * @param {import('discord.js').GuildMember} member The member creating the room
 * @param {string} roomName The name of the room
 * @param {number} userLimit Optional user limit for the voice channel (0-99)
 * @returns {Promise<{success: boolean, channel?: any, message: string}>}
 */
async function createTempVoiceChannel(member, roomName, userLimit = 0) {
  if (!member.voice.channel) {
    return { success: false, message: '❌ Geçici oda oluşturmak için önce bir ses kanalına katılmalısınız.' };
  }

  const guild = member.guild;
  const parentId = member.voice.channel.parentId;
  const sanitizedLimit = Math.max(0, Math.min(99, userLimit));
  const finalRoomName = `[🔊] ${roomName ? roomName.trim() : `${member.displayName}'in Odası`}`;

  try {
    const channel = await guild.channels.create({
      name: finalRoomName,
      type: ChannelType.GuildVoice,
      parent: parentId,
      userLimit: sanitizedLimit,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
        {
          id: member.id, // Room Creator
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
            PermissionFlagsBits.PrioritySpeaker
          ],
        }
      ],
      reason: `Geçici Ses Odası: ${member.user?.tag || member.displayName} tarafından oluşturuldu.`,
    });

    tempChannels.set(channel.id, member.id);

    // Auto-move creator to the new channel
    await member.voice.setChannel(channel).catch(err => {
      console.warn(`[tempVoice] Failed to auto-move user ${member.id} to new channel:`, err.message);
    });

    return { success: true, channel, message: `✅ Odnız başarıyla oluşturuldu: ${channel}` };
  } catch (err) {
    console.error('[tempVoice] Error creating temporary voice channel:', err);
    return { success: false, message: `❌ Ses kanalı oluşturulurken bir hata oluştu: ${err.message}` };
  }
}

/**
 * Checks if a channel is temporary and empty, and deletes it if so
 * @param {import('discord.js').VoiceChannel} channel The voice channel to check
 */
async function checkAndDeleteEmptyChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  const isTemp = tempChannels.has(channel.id) || channel.name.startsWith('[🔊]');
  if (isTemp && channel.members.size === 0) {
    try {
      await channel.delete('Geçici oda boş olduğu için silindi.');
      tempChannels.delete(channel.id);
      console.log(`[tempVoice] Deleted empty temporary voice channel: ${channel.name} (${channel.id})`);
    } catch (err) {
      console.error(`[tempVoice] Failed to delete temporary voice channel ${channel.id}:`, err.message);
    }
  }
}

module.exports = {
  createTempVoiceChannel,
  checkAndDeleteEmptyChannel,
  tempChannels,
};
