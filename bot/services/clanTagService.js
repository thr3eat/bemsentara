'use strict';

const StaffProgress = require('../../models/StaffProgress');

/**
 * Checks if the member is an active staff member and has equipped the EkoYıldız clan tag (EKO).
 * If so, and they haven't received the reward yet, grants the role, updates the database, and sends a DM.
 * @param {import('discord.js').GuildMember} member
 */
async function checkAndRewardTag(member) {
  if (!member || !member.user || member.user.bot) return;

  try {
    // Only check in EkoYıldız server
    if (member.guild.id !== '1367646464804655104') return;

    // Check if the user is a staff member
    const progress = await StaffProgress.findOne({ userId: member.id });
    if (!progress || progress.status !== 'active') return;

    // Skip if they already received the reward
    if (progress.hasReceivedTagReward) return;

    // Check if they currently have the "EKO" tag equipped
    const primaryGuild = member.user.primaryGuild;
    const hasTag = primaryGuild &&
      primaryGuild.identityGuildId === "1367646464804655104" &&
      primaryGuild.identityEnabled &&
      primaryGuild.tag &&
      primaryGuild.tag.toUpperCase() === "EKO";

    if (hasTag) {
      progress.hasReceivedTagReward = true;
      await progress.save();

      const roleId = "1518926498361376768";
      const role = member.guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.add(role, "Sunucu Etiketi (Clan Tag) Ödülü").catch(err => {
          console.error(`[clanTagService] Failed to add role ${roleId} to ${member.id}:`, err.message);
        });
      } else {
        console.warn(`[clanTagService] Role ${roleId} not found in guild.`);
      }

      // Send the DM to the staff member
      const dmMessage = `SUNUCU ETİKETİNİ TAKTIĞINIZ İÇİN xpler 0.5x daha arttı! taktığınız için teşekkürler sunucu etiketi ayrıcalıkları: <@&${roleId}> rolü verilmiştir.\nhttps://discord.com/channels/1367646464804655104/1518926465649872971 kanalında sohbet edebilirsiniz ve kurbağa sisteminiz artık 0.5x artık daha hızlı`;
      await member.user.send(dmMessage).catch(err => {
        console.warn(`[clanTagService] DM could not be sent to ${member.id}:`, err.message);
      });

      console.log(`[clanTagService] Tag reward successfully granted to staff member ${member.user.tag} (${member.id})`);
    }
  } catch (err) {
    console.error('[clanTagService] Error during tag check:', err);
  }
}

module.exports = {
  checkAndRewardTag
};
