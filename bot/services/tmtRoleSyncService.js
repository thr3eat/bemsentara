/**
 * TMT Role Sync Service
 * Syncs roles between Roblox groups and Discord TMT server
 * Includes main group and branch-specific groups
 */

const axios = require("axios");
const { TMT_GUILD_ID, TMT_ROLE_MAPPINGS, ALL_TMT_ROLE_IDS, STATUS_ROLES, SEPARATOR_ROLES, CATEGORY_ROLES, RANK_ROLES } = require("../config/tmtRoleSync");
const { TMT_BRANCH_GROUPS, BRANCH_AUTHORITY_THRESHOLDS, ALL_BRANCH_ROLE_IDS } = require("../config/tmtBranchSync");

const ROBLOX_GROUP_ID = 11517908;

// ========== HELPER FUNCTIONS ==========

/**
 * Find nearest ranks that have role mappings (one below, one above)
 */
function findNearestRanks(currentRank) {
  const allRanks = Object.keys(TMT_ROLE_MAPPINGS).map(Number).sort((a, b) => a - b);
  
  let lowerRank = null;
  let upperRank = null;

  for (const rank of allRanks) {
    if (rank < currentRank) {
      lowerRank = rank;
    } else if (rank > currentRank && !upperRank) {
      upperRank = rank;
      break;
    }
  }

  return { lowerRank, upperRank };
}

/**
 * Get color for role based on rank tier
 */
function getRoleColorByRank(rank) {
  if (rank <= 65) return "#808080"; // Gray - Enlisted (OR)
  if (rank <= 90) return "#4169E1"; // Royal Blue - Officers (OF-1)
  if (rank <= 110) return "#20B2AA"; // Light Sea Green - Senior Officers
  if (rank <= 150) return "#FFD700"; // Gold - Generals (OF-6+)
  if (rank <= 240) return "#DC143C"; // Crimson - Management/Council
  return "#FF4500"; // Orange Red - Top tier (Mareşal, etc)
}

/**
 * Get Discord color code from hex
 */
function hexToDiscordColor(hex) {
  return parseInt(hex.replace("#", ""), 16);
}

/**
 * Get role name from role ID (searches all role configs)
 */
function getRoleNameFromId(roleId) {
  // Search in SEPARATOR_ROLES
  for (const [key, id] of Object.entries(SEPARATOR_ROLES)) {
    if (id === roleId) return `▬▬▬ ${key}`;
  }
  
  // Search in CATEGORY_ROLES
  for (const [key, id] of Object.entries(CATEGORY_ROLES)) {
    if (id === roleId) return key;
  }
  
  // Search in STATUS_ROLES
  for (const [key, id] of Object.entries(STATUS_ROLES)) {
    if (id === roleId) return key;
  }
  
  // Search in RANK_ROLES
  for (const [key, id] of Object.entries(RANK_ROLES)) {
    if (id === roleId) return key;
  }
  
  return null;
}

/**
 * Get role color from role ID
 */
function getRoleColorFromId(roleId) {
  // Check if it's a separator role
  for (const [key, id] of Object.entries(SEPARATOR_ROLES)) {
    if (id === roleId) return "#808080"; // Gray
  }
  
  // Check if it's a status role
  for (const [key, id] of Object.entries(STATUS_ROLES)) {
    if (id === roleId) return "#9B59B6"; // Purple
  }
  
  return "#808080"; // Default gray
}

/**
async function ensureRoleExists(guild, roleId, roleName, roleColor = "#808080", position = null) {
  try {
    // Check if role already exists
    let role = guild.roles.cache.get(roleId);
    if (role) {
      return role;
    }

    // Role doesn't exist - create it
    console.warn(`[TMT Role Sync] Creating missing role: ${roleName} (was ID: ${roleId})`);
    
    const newRole = await guild.roles.create({
      name: roleName,
      color: hexToDiscordColor(roleColor),
      reason: `Auto-created missing system role: ${roleName}`,
    });

    // Update the ID in config
    if (roleName.includes("OR-") || roleName.includes("OF-") || roleName.includes("Paşa") || 
        roleName === "Konsey" || roleName === "Ankara Heyeti" || roleName === "Başkumandan" ||
        roleName === "Askeri Kurultay" || roleName === "Disiplin Kurulu" || roleName === "Lider" ||
        roleName === "Genelkurmay" || roleName === "Genelkurmay Başkanı" || roleName === "Yüksek Askerî Şûra" ||
        roleName === "Yönetim Kurulu" || roleName === "YK Başkan Yardımcısı" || roleName === "YK Başkanı" ||
        roleName === "Geliştirme Ofisi" || roleName === "Holder" || roleName === "OF-10 Mareşal" ||
        roleName === "Emekli Personel") {
      // Update RANK_ROLES
      Object.entries(RANK_ROLES).forEach(([key, id]) => {
        if (id === roleId) {
          RANK_ROLES[key] = newRole.id;
        }
      });
    }

    console.log(`[TMT Role Sync] ✅ Created role: ${roleName} (New ID: ${newRole.id})`);
    return newRole;
  } catch (error) {
    console.error(`[TMT Role Sync] Error ensuring role ${roleName}:`, error.message);
    return null;
  }
}

/**
 * Automatically create a role for a rank in Discord
 */
async function createRoleForRank(guild, userRank, nearestRoles) {
  try {
    const roleName = userRank.roleName;
    const color = hexToDiscordColor(getRoleColorByRank(userRank.rank));

    // Get separator and category roles from nearest tier
    let separatorRoleId = null;
    let categoryRoleId = null;
    let statusRoleId = STATUS_ROLES.bransszPersonel; // Default status

    if (nearestRoles.lower) {
      const lowerConfig = TMT_ROLE_MAPPINGS[nearestRoles.lower];
      if (lowerConfig && lowerConfig.discordRoleIds) {
        // Get separator role (first element)
        if (lowerConfig.discordRoleIds[0]) {
          separatorRoleId = lowerConfig.discordRoleIds[0];
        }
        // Get category role (second element)
        if (lowerConfig.discordRoleIds[1]) {
          categoryRoleId = lowerConfig.discordRoleIds[1];
        }
      }
    } else if (nearestRoles.upper) {
      // Fallback to upper rank if lower doesn't exist
      const upperConfig = TMT_ROLE_MAPPINGS[nearestRoles.upper];
      if (upperConfig && upperConfig.discordRoleIds) {
        if (upperConfig.discordRoleIds[0]) {
          separatorRoleId = upperConfig.discordRoleIds[0];
        }
        if (upperConfig.discordRoleIds[1]) {
          categoryRoleId = upperConfig.discordRoleIds[1];
        }
      }
    }

    // Create the new role
    const newRole = await guild.roles.create({
      name: roleName,
      color: color,
      reason: `Auto-created for missing rank ${userRank.rank} (${roleName})`,
    });

    console.log(`[TMT Role Sync] 🎯 Created new role: ${roleName} (ID: ${newRole.id}) for rank ${userRank.rank}`);

    // Add to role cache (update ALL_TMT_ROLE_IDS)
    ALL_TMT_ROLE_IDS.add(newRole.id);

    // Create role config entry for future use with all required roles
    if (!TMT_ROLE_MAPPINGS[userRank.rank]) {
      const roleIds = [];
      if (separatorRoleId) roleIds.push(separatorRoleId);
      if (categoryRoleId) roleIds.push(categoryRoleId);
      roleIds.push(newRole.id); // Add the specific rank role
      roleIds.push(statusRoleId); // Add status role

      TMT_ROLE_MAPPINGS[userRank.rank] = {
        discordRoleIds: roleIds,
        name: roleName,
        autoCreated: true,
      };
    }

    return newRole;
  } catch (error) {
    console.error(`[TMT Role Sync] Error creating role for rank ${userRank.rank}:`, error.message);
    return null;
  }
}

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
 * Sync user's branch roles and set appropriate status role
 * Status roles: Branşsız Personel, Branşlı Personel, Yetkili Branş Personeli
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

    // Remove status roles before setting new ones
    const statusRoleIds = Object.values(STATUS_ROLES);
    const currentStatusRoles = member.roles.cache.filter(r => statusRoleIds.includes(r.id));
    if (currentStatusRoles.size > 0) {
      await member.roles.remove(Array.from(currentStatusRoles.keys()), "TMT Status Sync").catch(err => {
        console.error(`[TMT Branch Sync] Error removing status roles:`, err.message);
      });
    }

    // Get user's branch memberships
    const branches = await getUserBranchMemberships(robloxUserId);

    // Determine status: Branşsız / Branşlı / Yetkili Branş Personeli
    let statusRoleId = STATUS_ROLES.bransszPersonel; // Default: Branşsız

    if (branches.length > 0) {
      // User is in at least one branch group
      const hasAuthorityInAnyBranch = branches.some(branch => {
        const authorityThreshold = BRANCH_AUTHORITY_THRESHOLDS[branch.groupId];
        return branch.rank >= authorityThreshold;
      });

      if (hasAuthorityInAnyBranch) {
        statusRoleId = STATUS_ROLES.yetkliBransPersoneli; // Yetkili Branş Personeli
      } else {
        statusRoleId = STATUS_ROLES.bransliPersonel; // Branşlı Personel
      }
    }

    // Add appropriate status role
    try {
      const statusRole = guild.roles.cache.get(statusRoleId);
      if (statusRole) {
        await member.roles.add(statusRole, "TMT Status Assignment").catch(err => {
          console.error(`[TMT Branch Sync] Error adding status role:`, err.message);
        });
      }
    } catch (err) {
      console.error(`[TMT Branch Sync] Error with status role assignment:`, err.message);
    }

    if (branches.length === 0) {
      console.log(`[TMT Branch Sync] User ${discordUserId} has Branşsız Personel status`);
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

/**
 * Get user's rank in the main TMT Roblox group
 */
async function getUserRankInGroup(robloxUserId) {
  try {
    console.log(`[TMT Role Sync] Fetching rank for Roblox user ${robloxUserId} in group ${ROBLOX_GROUP_ID}...`);
    
    const response = await axios.get(
      `https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`,
      { timeout: 10000 } // Increased timeout from 5s to 10s
    );

    console.log(`[TMT Role Sync] API Response status: ${response.status}, groups count: ${response.data.data.length}`);
    
    const groupData = response.data.data.find(g => g.group.id === ROBLOX_GROUP_ID);
    if (groupData) {
      console.log(`[TMT Role Sync] ✅ Found rank in group ${ROBLOX_GROUP_ID}: ${groupData.role.name} (Rank ${groupData.role.rank})`);
      return {
        rank: groupData.role.rank,
        roleName: groupData.role.name,
        roleId: groupData.role.id,
      };
    }
    
    console.warn(`[TMT Role Sync] User ${robloxUserId} not found in group ${ROBLOX_GROUP_ID}. Available groups:`, 
      response.data.data.map(g => ({ id: g.group.id, name: g.group.name, rank: g.role.rank }))
    );
    return null; // User not in group
  } catch (error) {
    console.error(`[TMT Role Sync] ❌ Error fetching rank for user ${robloxUserId}:`, error.message);
    if (error.response) {
      console.error(`[TMT Role Sync] API Error Status: ${error.response.status}`, error.response.data);
    }
    return null;
  }
}

/**
 * Sync user's TMT roles based on Roblox rank
 */
async function syncTMTRoles(client, discordUserId, robloxUserId, discordMember = null) {
  try {
    console.log(`\n[TMT Role Sync] ===== START SYNC =====`);
    console.log(`[TMT Role Sync] Discord User: ${discordUserId}, Roblox User: ${robloxUserId}`);
    
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

    console.log(`[TMT Role Sync] Found Discord member: ${member.user.tag}`);

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
    let roleConfig = TMT_ROLE_MAPPINGS[userRank.rank];
    
    if (roleConfig && roleConfig.discordRoleIds) {
      // Role mapping exists - ensure all roles exist and add them
      for (const roleId of roleConfig.discordRoleIds) {
        try {
          let role = guild.roles.cache.get(roleId);
          
          // If role doesn't exist, try to create it with appropriate name
          if (!role) {
            const roleName = getRoleNameFromId(roleId) || `TMT Role ${roleId}`;
            const roleColor = getRoleColorFromId(roleId);
            role = await ensureRoleExists(guild, roleId, roleName, roleColor);
          }
          
          if (role) {
            await member.roles.add(role, `TMT Sync: ${userRank.roleName} (Rank ${userRank.rank})`);
          } else {
            console.warn(`[TMT Role Sync] Could not add role ${roleId} - role missing and creation failed`);
          }
        } catch (err) {
          console.error(`[TMT Role Sync] Error adding role ${roleId}:`, err.message);
        }
      }

      console.log(
        `[TMT Role Sync] ✅ ${member.user.tag} → ${userRank.roleName} (Roblox Rank ${userRank.rank})`
      );
    } else {
      // No role mapping found - try to create one
      console.warn(
        `[TMT Role Sync] No Discord role mapping found for rank ${userRank.rank} (${userRank.roleName}) - attempting auto-creation...`
      );

      const nearestRoles = findNearestRanks(userRank.rank);
      const createdRole = await createRoleForRank(guild, userRank, nearestRoles);

      if (createdRole) {
        try {
          await member.roles.add(createdRole, `TMT Sync: ${userRank.roleName} (Auto-created, Rank ${userRank.rank})`);
          console.log(
            `[TMT Role Sync] ✅ ${member.user.tag} → ${userRank.roleName} (Auto-created role, Rank ${userRank.rank})`
          );
        } catch (err) {
          console.error(`[TMT Role Sync] Error adding auto-created role:`, err.message);
        }
      } else {
        console.error(
          `[TMT Role Sync] ❌ Failed to create role for rank ${userRank.rank} (${userRank.roleName})`
        );
      }
      
      // Refresh roleConfig after auto-creation
      roleConfig = TMT_ROLE_MAPPINGS[userRank.rank];
    }

    // Sync branch roles (this will set status role, so we need to re-add rank roles after)
    await syncBranchRoles(client, discordUserId, robloxUserId, member);

    // Re-add separator, category, and rank roles after branch sync
    // (because syncBranchRoles removes all TMT roles before adding branch/status roles)
    if (roleConfig && roleConfig.discordRoleIds) {
      const rolesToReAdd = roleConfig.discordRoleIds.filter(roleId => {
        // Don't re-add status roles (those are handled by syncBranchRoles)
        return !Object.values(STATUS_ROLES).includes(roleId);
      });

      for (const roleId of rolesToReAdd) {
        try {
          let role = guild.roles.cache.get(roleId);
          
          // If role doesn't exist, try to create it
          if (!role) {
            const roleName = getRoleNameFromId(roleId) || `TMT Role ${roleId}`;
            const roleColor = getRoleColorFromId(roleId);
            role = await ensureRoleExists(guild, roleId, roleName, roleColor);
          }
          
          if (role) {
            await member.roles.add(role, `TMT Sync: ${userRank.roleName} - Tier role (Post-branch)`);
          }
        } catch (err) {
          console.error(`[TMT Role Sync] Error re-adding role ${roleId}:`, err.message);
        }
      }
    }

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
