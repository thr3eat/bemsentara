const { ChannelType, PermissionFlagsBits } = require("discord.js");

/**
 * Normalizes Turkish characters and lowercases a string.
 * @param {string} str 
 * @returns {string}
 */
function normalizeString(str) {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

/**
 * Checks if a channel ends with "-arşiv" or "-arsiv" and processes it accordingly.
 * @param {import("discord.js").GuildChannel} channel
 */
async function handleArchiveChannel(channel) {
  try {
    if (!channel || !channel.guild) return;

    // Skip categories and threads
    if (channel.type === ChannelType.GuildCategory || channel.isThread?.()) return;

    const name = channel.name;
    if (!name) return;

    const normalizedName = normalizeString(name);
    if (!normalizedName.endsWith("-arsiv")) return;

    console.log(`[ArchiveService] Checking archive action for channel: "${channel.name}" (${channel.id}) in guild: "${channel.guild.name}"`);

    // The primary target name is " 🗂️Arşiv ". But we will also search for any category containing "arşiv" or "arsiv".
    const archiveCategory = channel.guild.channels.cache.find(c => {
      if (c.type !== ChannelType.GuildCategory) return false;
      const normalizedCatName = normalizeString(c.name);
      return normalizedCatName.includes("arsiv") || normalizedCatName.includes("arşiv");
    });

    if (archiveCategory) {
      if (channel.parentId !== archiveCategory.id) {
        await channel.setParent(archiveCategory.id, { lockPermissions: false });
        console.log(`[ArchiveService] Successfully moved "${channel.name}" to category "${archiveCategory.name}" in guild "${channel.guild.name}".`);
      } else {
        console.log(`[ArchiveService] Channel "${channel.name}" is already in category "${archiveCategory.name}".`);
      }
    } else {
      // Category does not exist, make it private so nobody can see it
      const everyoneOverwrites = channel.permissionOverwrites.cache.get(channel.guild.id);
      const hasViewChannelDenied = everyoneOverwrites && everyoneOverwrites.deny.has(PermissionFlagsBits.ViewChannel);

      if (!hasViewChannelDenied) {
        await channel.permissionOverwrites.edit(channel.guild.id, {
          ViewChannel: false
        });
        console.log(`[ArchiveService] Category not found. Successfully hid "${channel.name}" by denying ViewChannel for everyone in guild "${channel.guild.name}".`);
      } else {
        console.log(`[ArchiveService] Category not found. Channel "${channel.name}" already has ViewChannel denied for everyone.`);
      }
    }
  } catch (error) {
    console.error(`[ArchiveService] Error processing archive channel "${channel?.name}" in guild "${channel?.guild?.name}":`, error.message || error);
  }
}

module.exports = { handleArchiveChannel };
