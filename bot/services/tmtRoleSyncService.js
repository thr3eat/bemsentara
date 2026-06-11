/**
 * TMT Role Sync Service
 * Syncs roles between Roblox group 11517908 and Discord TMT server
 */

const axios = require("axios");
const { TMT_GUILD_ID, TMT_ROLE_MAPPINGS, ALL_TMT_ROLE_IDS } = require("../config/tmtRoleSync");

const ROBLOX_GROUP_ID = 11517908;

/**
 * Get user's rank in Roblox group
 */
async function getUserRankInGroup(robloxUserId) {
  try {
    const response = await axios.get(
      `https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`,
      { timeout: 5000 }
    );

    const groupData = response.data.data.find(g => g.group.id === ROBLOX_GROUP_ID);
    if (groupData) {
      return {
        rank: groupData.role.rank,
        roleName: groupData.role.name,
        roleId: groupData.role.id,
      };
    }
    return null; // User not in group
  } catch (error) {
    console.error(`[TMT Role Sync] Error fetching rank for user ${robloxUserId}:`, error.message);
    return null;
  }
}

/**
 * Sync user's TMT roles based on Roblox rank
 */
async function syncTMTRoles(client, discordUserId, robloxUserId, discordMember = null) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID);
    if (!guild) {
      console.warn(`[TMT Role Sync] Guild ${TMT_GUILD_ID} not found`);
      return false;
    }

    let member = discordMember;
    if (!member) {
      member = await guild.members.fetch(discordUserId).catch(() => null);
    }

    if (!member) {
      console.warn(`[TMT Role Sync] Member ${discordUserId} not found in TMT guild`);
      return false;
    }

    // Get user's rank in Roblox group
    const userRank = await getUserRankInGroup(robloxUserId);

    // Remove all TMT roles first
    const currentRoles = member.roles.cache.filter(r => ALL_TMT_ROLE_IDS.has(r.id));
    if (currentRoles.size > 0) {
      await member.roles.remove(Array.from(currentRoles.keys()), "TMT Role Sync").catch(err => {
        console.error(`[TMT Role Sync] Error removing roles:`, err.message);
      });
    }

    // If user not in group, don't add any roles
    if (!userRank) {
      console.log(`[TMT Role Sync] User ${discordUserId} not in Roblox group ${ROBLOX_GROUP_ID}`);
      return true;
    }

    // Find and add appropriate roles based on rank
    const roleConfig = TMT_ROLE_MAPPINGS[userRank.rank];
    if (roleConfig && roleConfig.discordRoleIds) {
      for (const roleId of roleConfig.discordRoleIds) {
        try {
          const role = guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.add(role, `TMT Sync: ${userRank.roleName} (Rank ${userRank.rank})`);
          } else {
            console.warn(`[TMT Role Sync] Discord role ${roleId} not found in guild`);
          }
        } catch (err) {
          console.error(`[TMT Role Sync] Error adding role ${roleId}:`, err.message);
        }
      }

      console.log(
        `[TMT Role Sync] ✅ ${member.user.tag} → ${userRank.roleName} (Roblox Rank ${userRank.rank})`
      );
      return true;
    } else {
      console.warn(
        `[TMT Role Sync] No Discord role mapping found for rank ${userRank.rank} (${userRank.roleName})`
      );
      return true;
    }
  } catch (error) {
    console.error(`[TMT Role Sync] Fatal error:`, error.message);
    return false;
  }
}

/**
 * Verify all users in TMT guild (periodic check)
 */
async function verifyAllTMTRoles(client, users = []) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID);
    if (!guild) {
      console.warn(`[TMT Role Sync] Guild ${TMT_GUILD_ID} not found for verification`);
      return 0;
    }

    let updated = 0;
    const User = require("../../models/User");

    // Get all members with TMT roles
    const membersWithRoles = await guild.members.fetch();
    const membersToCheck = users.length > 0 
      ? membersWithRoles.filter(m => users.includes(m.id))
      : membersWithRoles.filter(m => {
          const hasAnyTMTRole = Array.from(ALL_TMT_ROLE_IDS).some(roleId => 
            m.roles.cache.has(roleId)
          );
          return !m.user.bot && hasAnyTMTRole;
        });

    console.log(`[TMT Role Sync] Verifying ${membersToCheck.size} members...`);

    for (const [, member] of membersToCheck) {
      try {
        const dbUser = await User.findOne({ discordId: member.id });
        if (dbUser && dbUser.robloxId) {
          const success = await syncTMTRoles(client, member.id, dbUser.robloxId, member);
          if (success) updated++;
        }
      } catch (err) {
        console.error(`[TMT Role Sync] Error verifying member ${member.id}:`, err.message);
      }
    }

    console.log(`[TMT Role Sync] ✅ Verification complete - ${updated} members updated`);
    return updated;
  } catch (error) {
    console.error(`[TMT Role Sync] Fatal error during verification:`, error.message);
    return 0;
  }
}

module.exports = {
  getUserRankInGroup,
  syncTMTRoles,
  verifyAllTMTRoles,
};
