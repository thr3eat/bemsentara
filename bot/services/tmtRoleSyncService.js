/**
 * TMT Role Sync Service
 * Syncs roles between Roblox groups and Discord TMT server
 * Includes main group and branch-specific groups
 */

const axios = require("axios");
const { TMT_GUILD_ID, TMT_ROLE_MAPPINGS, ALL_TMT_ROLE_IDS } = require("../config/tmtRoleSync");
const { TMT_BRANCH_GROUPS, BRANCH_AUTHORITY_THRESHOLDS, ALL_BRANCH_ROLE_IDS } = require("../config/tmtBranchSync");

const ROBLOX_GROUP_ID = 11517908;

/**
 * Get all branch groups user is in and their ranks
 */
async function getUserBranchMemberships(robloxUserId) {
  try {
    const response = await axios.get(
      `https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`,
      { timeout: 5000 }
    );

    const branches = [];
    for (const groupData of response.data.data) {
      const groupId = groupData.group.id;
      if (TMT_BRANCH_GROUPS[groupId]) {
        branches.push({
          groupId,
          branchName: TMT_BRANCH_GROUPS[groupId].name,
          rank: groupData.role.rank,
          roleName: groupData.role.name,
        });
      }
    }
    return branches;
  } catch (error) {
    console.error(`[TMT Branch Sync] Error fetching branches for user ${robloxUserId}:`, error.message);
    return [];
  }
}

/**
 * Sync user's branch roles
 */
async function syncBranchRoles(client, discordUserId, robloxUserId, discordMember = null) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID);
    if (!guild) {
      console.warn(`[TMT Branch Sync] Guild ${TMT_GUILD_ID} not found`);
      return false;
    }

    let member = discordMember;
    if (!member) {
      member = await guild.members.fetch(discordUserId).catch(() => null);
    }

    if (!member) {
      console.warn(`[TMT Branch Sync] Member ${discordUserId} not found in TMT guild`);
      return false;
    }

    // Remove all branch roles first
    const currentBranchRoles = member.roles.cache.filter(r => ALL_BRANCH_ROLE_IDS.has(r.id));
    if (currentBranchRoles.size > 0) {
      await member.roles.remove(Array.from(currentBranchRoles.keys()), "TMT Branch Sync").catch(err => {
        console.error(`[TMT Branch Sync] Error removing branch roles:`, err.message);
      });
    }

    // Get user's branch memberships
    const branches = await getUserBranchMemberships(robloxUserId);

    if (branches.length === 0) {
      console.log(`[TMT Branch Sync] User ${discordUserId} is not in any branch groups`);
      return true;
    }

    // Sync each branch role
    for (const branch of branches) {
      const branchConfig = TMT_BRANCH_GROUPS[branch.groupId];
      const authorityThreshold = BRANCH_AUTHORITY_THRESHOLDS[branch.groupId];

      try {
        // Always add the main branch role
        const mainBranchRole = guild.roles.cache.get(branchConfig.discordRoleId);
        if (mainBranchRole) {
          await member.roles.add(mainBranchRole, `TMT Branch: ${branch.branchName} (Rank ${branch.rank})`);
        }

        // Add branch authority role if rank is high enough
        if (branch.rank >= authorityThreshold) {
          const authorityRole = guild.roles.cache.get(branchConfig.discordBranchRoleId);
          if (authorityRole) {
            await member.roles.add(authorityRole, `TMT Branch Authority: ${branch.branchName} (Rank ${branch.rank})`);
          }
        }

        console.log(
          `[TMT Branch Sync] ✅ ${member.user.tag} → ${branch.branchName} (Rank ${branch.rank})`
        );
      } catch (err) {
        console.error(`[TMT Branch Sync] Error adding branch roles for ${branch.branchName}:`, err.message);
      }
    }

    return true;
  } catch (error) {
    console.error(`[TMT Branch Sync] Fatal error:`, error.message);
    return false;
  }
}


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
      // Still sync branch roles
      await syncBranchRoles(client, discordUserId, robloxUserId, member);
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
    } else {
      console.warn(
        `[TMT Role Sync] No Discord role mapping found for rank ${userRank.rank} (${userRank.roleName})`
      );
    }

    // Sync branch roles
    await syncBranchRoles(client, discordUserId, robloxUserId, member);

    return true;
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
  getUserBranchMemberships,
  syncBranchRoles,
};
