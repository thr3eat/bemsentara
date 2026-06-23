'use strict';

const StaffProgress = require('../../models/StaffProgress');

/**
 * Checks if a member has the "EKO" tag in their Discord nickname, username, or native primary guild identity.
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean}
 */
function hasClanTagTextOrNative(member) {
  if (!member) return false;
  
  // 1. Check primaryGuild (native Discord clan tag feature, if populated)
  const primaryGuild = member.user?.primaryGuild;
  const hasNativeTag = primaryGuild &&
    primaryGuild.identityGuildId === "1367646464804655104" &&
    primaryGuild.identityEnabled &&
    primaryGuild.tag &&
    primaryGuild.tag.toUpperCase() === "EKO";
  if (hasNativeTag) return true;
  
  // 2. Check nickname, username, globalName and displayName (case-insensitive for 'EKO')
  const nickname = member.nickname || "";
  const username = member.user?.username || "";
  const globalName = member.user?.globalName || "";
  const displayName = member.displayName || "";
  
  const matches = (str) => str.toUpperCase().includes("EKO");
  
  return matches(nickname) || matches(username) || matches(globalName) || matches(displayName);
}

/**
 * Checks if the member is an active staff member and has equipped the EkoYıldız clan tag (EKO).
 * If so, and they haven't received the reward yet, grants the role, updates the database, and sends a DM.
 * If they removed the tag, removes the role and updates the database flag.
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

    const roleId = "1518926498361376768";
    const hasTag = hasClanTagTextOrNative(member);

    if (hasTag) {
      // Award role if they don't have it
      if (!member.roles.cache.has(roleId)) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
          await member.roles.add(role, "Sunucu Etiketi (Clan Tag) Ödülü").catch(err => {
            console.error(`[clanTagService] Failed to add role ${roleId} to ${member.id}:`, err.message);
          });

          // Set reward status in database
          if (!progress.hasReceivedTagReward) {
            progress.hasReceivedTagReward = true;
            await progress.save();
          }

          // Send DM to the staff member
          const dmMessage = `SUNUCU ETİKETİNİ TAKTIĞINIZ İÇİN xpler 0.5x daha arttı! taktığınız için teşekkürler sunucu etiketi ayrıcalıkları: <@&${roleId}> rolü verilmiştir.\nhttps://discord.com/channels/1367646464804655104/1518926465649872971 kanalında sohbet edebilirsiniz ve kurbağa sisteminiz artık 0.5x artık daha hızlı`;
          await member.user.send(dmMessage).catch(err => {
            console.warn(`[clanTagService] DM could not be sent to ${member.id}:`, err.message);
          });

          console.log(`[clanTagService] Tag reward successfully granted to staff member ${member.user.tag} (${member.id})`);
        } else {
          console.warn(`[clanTagService] Role ${roleId} not found in guild.`);
        }
      } else if (!progress.hasReceivedTagReward) {
        // Just sync database if they already have the role but flag is false
        progress.hasReceivedTagReward = true;
        await progress.save();
      }
    } else {
      // If they don't have the tag anymore, remove the role
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId, "Sunucu Etiketi Kaldırıldı").catch(err => {
          console.error(`[clanTagService] Failed to remove role ${roleId} from ${member.id}:`, err.message);
        });

        if (progress.hasReceivedTagReward) {
          progress.hasReceivedTagReward = false;
          await progress.save();
        }

        // Send a friendly notification DM
        await member.user.send(`⚠️ Sunucu etiketini (EKO) çıkardığınız için <@&${roleId}> rolü üzerinizden alınmıştır. Tekrar taktığınızda rolünüz geri verilecektir.`).catch(() => {});
        console.log(`[clanTagService] Tag reward removed from staff member ${member.user.tag} (${member.id})`);
      }
    }
  } catch (err) {
    console.error('[clanTagService] Error during tag check:', err);
  }
}

module.exports = {
  checkAndRewardTag,
  hasClanTagTextOrNative
};
