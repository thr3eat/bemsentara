/**
 * TMT Role Sync Service
 * Syncs roles between Roblox groups and Discord TMT server
 * Includes main group and branch-specific groups
 */

const axios = require("axios");
const { TMT_GUILD_ID, TMT_ROLE_MAPPINGS, ALL_TMT_ROLE_IDS, STATUS_ROLES, SEPARATOR_ROLES, CATEGORY_ROLES, RANK_ROLES } = require("../config/tmtRoleSync");
const { TMT_BRANCH_GROUPS, BRANCH_AUTHORITY_THRESHOLDS, ALL_BRANCH_ROLE_IDS, BRANCH_START_SEPARATOR, BRANCH_END_SEPARATOR } = require("../config/tmtBranchSync");

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
 * Find a role in Discord guild by name (case-insensitive)
 */
function findRoleByName(guild, name) {
  if (!name) return null;
  const target = name.toLowerCase().trim();
  return (
    guild.roles.cache.find(
      (r) => {
        const rName = r.name.toLowerCase().trim();
        // Match exact name, or name stripped of ▬▬▬ or ▬ lines
        const strippedName = rName.replace(/[▬\s]+/g, "");
        const strippedTarget = target.replace(/[▬\s]+/g, "");
        return rName === target || (strippedTarget !== "" && strippedName === strippedTarget);
      }
    ) || null
  );
}

/**
 * Create a missing branch role with styled name and color
 */
async function createBranchRole(guild, roleName, colorHex) {
  try {
    console.log(`[TMT Role Sync] Auto-creating missing branch role: "${roleName}" with color "${colorHex}"`);

    const role = await guild.roles.create({
      name: roleName,
      color: hexToDiscordColor(colorHex),
      reason: `TMT Role Sync: Auto-created missing branch role`,
    });

    return role;
  } catch (error) {
    console.error(`[TMT Role Sync] Error creating branch role "${roleName}":`, error.message);
    return null;
  }
}

/**
 * Ensure a role exists in Discord, create if missing
 */
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
/**
 * Compute desired TMT roles based on Roblox main rank and branch memberships
 */
/**
 * Compute desired TMT roles based on Roblox main rank and branch memberships
 */
async function computeTMTRoles(guild, userRank, branches, unresolved = []) {
  const desiredRoleIds = new Set();

  // 1. Process Main Group Rank and separators
  if (userRank) {
    let roleConfig = TMT_ROLE_MAPPINGS[userRank.rank];
    if (!roleConfig) {
      // Auto-create rank role if mapping doesn't exist
      const nearestRoles = findNearestRanks(userRank.rank);
      const createdRole = await createRoleForRank(guild, userRank, nearestRoles);
      if (createdRole) {
        roleConfig = TMT_ROLE_MAPPINGS[userRank.rank];
      }
    }

    if (roleConfig && roleConfig.discordRoleIds) {
      // Find the separator in the mapping
      let mainSeparator = null;
      for (const roleId of roleConfig.discordRoleIds) {
        if (Object.values(SEPARATOR_ROLES).includes(roleId)) {
          mainSeparator = roleId;
          break;
        }
      }

      // If a separator was found, add it and all separators below it in hierarchy
      if (mainSeparator) {
        const SEPARATOR_HIERARCHY = [
          SEPARATOR_ROLES.management,
          SEPARATOR_ROLES.generals,
          SEPARATOR_ROLES.seniorOfficers,
          SEPARATOR_ROLES.officers,
          SEPARATOR_ROLES.enlisted,
        ];
        const sepIndex = SEPARATOR_HIERARCHY.indexOf(mainSeparator);
        if (sepIndex !== -1) {
          for (let i = sepIndex; i < SEPARATOR_HIERARCHY.length; i++) {
            desiredRoleIds.add(SEPARATOR_HIERARCHY[i]);
          }
        }
      }

      // Ensure all mapping roles exist and add them (excluding separator and status roles)
      for (const roleId of roleConfig.discordRoleIds) {
        if (Object.values(STATUS_ROLES).includes(roleId)) continue;
        if (Object.values(SEPARATOR_ROLES).includes(roleId)) continue;

        try {
          let role = guild.roles.cache.get(roleId);
          if (!role) {
            const roleName = getRoleNameFromId(roleId) || `TMT Role ${roleId}`;
            const roleColor = getRoleColorFromId(roleId);
            role = await ensureRoleExists(guild, roleId, roleName, roleColor);
          }
          if (role) {
            desiredRoleIds.add(role.id);
          } else {
            unresolved.push(`id:${roleId}`);
          }
        } catch (err) {
          console.error(`[computeTMTRoles] Error ensuring main role ${roleId}:`, err.message);
          unresolved.push(`id:${roleId}`);
        }
      }
    }
  }

  // 2. Filter branch memberships to ignore visitors/fans (ranks 0 and 1, or ignored names)
  const ignoredBranchRanks = ["guest", "ziyaretçi", "taraftar", "fan", "beklemede", "ziyaretci", "acemi"];
  const activeBranches = (branches || []).filter(b => {
    const rankName = (b.roleName || "").toLowerCase().trim();
    return b.rank > 1 && !ignoredBranchRanks.includes(rankName);
  });

  // 3. Process Status Role
  let statusRoleId = STATUS_ROLES.bransszPersonel; // Default: Branşsız
  if (activeBranches.length > 0) {
    const hasAuthorityInAnyBranch = activeBranches.some(branch => {
      const authorityThreshold = BRANCH_AUTHORITY_THRESHOLDS[branch.groupId];
      return branch.rank >= authorityThreshold;
    });

    if (hasAuthorityInAnyBranch) {
      statusRoleId = STATUS_ROLES.yetkliBransPersoneli; // Yetkili Branş Personeli
    } else {
      statusRoleId = STATUS_ROLES.bransliPersonel; // Branşlı Personel
    }
  }
  desiredRoleIds.add(statusRoleId);

  // 4. Process Branch Roles
  if (activeBranches.length > 0) {
    // Ensure start separator exists and add it
    let startSepRole = findRoleByName(guild, BRANCH_START_SEPARATOR);
    if (!startSepRole) {
      startSepRole = await guild.roles.create({
        name: BRANCH_START_SEPARATOR,
        color: hexToDiscordColor("#808080"),
        reason: "TMT Role Sync: Auto-created branch start separator",
      });
    }
    if (startSepRole) {
      desiredRoleIds.add(startSepRole.id);
    }

    // Ensure end separator exists and add it
    let endSepRole = findRoleByName(guild, BRANCH_END_SEPARATOR);
    if (!endSepRole) {
      endSepRole = await guild.roles.create({
        name: BRANCH_END_SEPARATOR,
        color: hexToDiscordColor("#808080"),
        reason: "TMT Role Sync: Auto-created branch end separator",
      });
    }
    if (endSepRole) {
      desiredRoleIds.add(endSepRole.id);
    }
  }

  for (const branch of activeBranches) {
    const branchConfig = TMT_BRANCH_GROUPS[branch.groupId];
    const authorityThreshold = BRANCH_AUTHORITY_THRESHOLDS[branch.groupId];

    // Find main branch role
    let mainRole = null;
    if (branchConfig.discordRoleId) {
      mainRole = guild.roles.cache.get(branchConfig.discordRoleId);
    }
    if (!mainRole && branchConfig.discordRoleName) {
      mainRole = findRoleByName(guild, branchConfig.discordRoleName);
      if (!mainRole) {
        mainRole = await createBranchRole(guild, branchConfig.discordRoleName, branchConfig.color || "#808080");
      }
    }

    if (mainRole) {
      desiredRoleIds.add(mainRole.id);
    } else {
      unresolved.push(branchConfig.discordRoleName || branchConfig.name || `Branch:${branch.groupId}`);
    }

    // Find branch authority role if rank is high enough
    if (branch.rank >= authorityThreshold) {
      let authRole = null;
      if (branchConfig.discordBranchRoleId) {
        authRole = guild.roles.cache.get(branchConfig.discordBranchRoleId);
      }
      if (!authRole && branchConfig.discordBranchRoleName) {
        authRole = findRoleByName(guild, branchConfig.discordBranchRoleName);
        if (!authRole) {
          authRole = await createBranchRole(guild, branchConfig.discordBranchRoleName, branchConfig.color || "#808080");
        }
      }

      if (authRole) {
        desiredRoleIds.add(authRole.id);
      } else {
        unresolved.push(branchConfig.discordBranchRoleName || `${branchConfig.name} Yetkilisi` || `BranchAuth:${branch.groupId}`);
      }
    }
  }

  return desiredRoleIds;
}

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

    // Dynamically resolve all branch role IDs (hardcoded and looked up by name)
    const resolvedBranchRoleIds = new Set();
    for (const groupConfig of Object.values(TMT_BRANCH_GROUPS)) {
      if (groupConfig.discordRoleId) {
        resolvedBranchRoleIds.add(groupConfig.discordRoleId);
      } else if (groupConfig.discordRoleName) {
        const role = findRoleByName(guild, groupConfig.discordRoleName);
        if (role) resolvedBranchRoleIds.add(role.id);
      }

      if (groupConfig.discordBranchRoleId) {
        resolvedBranchRoleIds.add(groupConfig.discordBranchRoleId);
      } else if (groupConfig.discordBranchRoleName) {
        const role = findRoleByName(guild, groupConfig.discordBranchRoleName);
        if (role) resolvedBranchRoleIds.add(role.id);
      }
    }

    // Add branch separators to resolved list for cleanup
    const startSep = findRoleByName(guild, BRANCH_START_SEPARATOR);
    const endSep = findRoleByName(guild, BRANCH_END_SEPARATOR);
    if (startSep) resolvedBranchRoleIds.add(startSep.id);
    if (endSep) resolvedBranchRoleIds.add(endSep.id);

    // Remove all branch roles first
    const currentBranchRoles = member.roles.cache.filter(r => resolvedBranchRoleIds.has(r.id));
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

    // Filter branch memberships to ignore visitors/fans (ranks 0 and 1, or ignored names)
    const ignoredBranchRanks = ["guest", "ziyaretçi", "taraftar", "fan", "beklemede", "ziyaretci", "acemi"];
    const activeBranches = branches.filter(b => {
      const rankName = (b.roleName || "").toLowerCase().trim();
      return b.rank > 1 && !ignoredBranchRanks.includes(rankName);
    });

    // Determine status: Branşsız / Branşlı / Yetkili Branş Personeli
    let statusRoleId = STATUS_ROLES.bransszPersonel; // Default: Branşsız

    if (activeBranches.length > 0) {
      // User is in at least one branch group
      const hasAuthorityInAnyBranch = activeBranches.some(branch => {
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

    if (activeBranches.length === 0) {
      console.log(`[TMT Branch Sync] User ${discordUserId} has Branşsız Personel status`);
      return true;
    }

    // Add start separator
    try {
      let startSepRole = findRoleByName(guild, BRANCH_START_SEPARATOR);
      if (!startSepRole) {
        startSepRole = await guild.roles.create({
          name: BRANCH_START_SEPARATOR,
          color: hexToDiscordColor("#808080"),
          reason: "TMT Role Sync: Auto-created branch start separator",
        });
      }
      if (startSepRole) {
        await member.roles.add(startSepRole, "TMT Branch: Start Separator");
      }
    } catch (err) {
      console.error(`[TMT Branch Sync] Error adding start separator:`, err.message);
    }

    // Sync each branch role
    for (const branch of activeBranches) {
      const branchConfig = TMT_BRANCH_GROUPS[branch.groupId];
      const authorityThreshold = BRANCH_AUTHORITY_THRESHOLDS[branch.groupId];

      try {
        // Find main branch role
        let mainBranchRole = null;
        if (branchConfig.discordRoleId) {
          mainBranchRole = guild.roles.cache.get(branchConfig.discordRoleId);
        }
        if (!mainBranchRole && branchConfig.discordRoleName) {
          mainBranchRole = findRoleByName(guild, branchConfig.discordRoleName);
          if (!mainBranchRole) {
            mainBranchRole = await createBranchRole(guild, branchConfig.discordRoleName, branchConfig.color || "#808080");
          }
        }

        if (mainBranchRole) {
          await member.roles.add(mainBranchRole, `TMT Branch: ${branch.branchName} (Rank ${branch.rank})`);
        }

        // Add branch authority role if rank is high enough
        if (branch.rank >= authorityThreshold) {
          let authorityRole = null;
          if (branchConfig.discordBranchRoleId) {
            authorityRole = guild.roles.cache.get(branchConfig.discordBranchRoleId);
          }
          if (!authorityRole && branchConfig.discordBranchRoleName) {
            authorityRole = findRoleByName(guild, branchConfig.discordBranchRoleName);
            if (!authorityRole) {
              authorityRole = await createBranchRole(guild, branchConfig.discordBranchRoleName, branchConfig.color || "#808080");
            }
          }

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

    // Add end separator
    try {
      let endSepRole = findRoleByName(guild, BRANCH_END_SEPARATOR);
      if (!endSepRole) {
        endSepRole = await guild.roles.create({
          name: BRANCH_END_SEPARATOR,
          color: hexToDiscordColor("#808080"),
          reason: "TMT Role Sync: Auto-created branch end separator",
        });
      }
      if (endSepRole) {
        await member.roles.add(endSepRole, "TMT Branch: End Separator");
      }
    } catch (err) {
      console.error(`[TMT Branch Sync] Error adding end separator:`, err.message);
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
      return { success: false, error: "guild_not_found" };
    }

    let member = discordMember;
    if (!member) {
      member = await guild.members.fetch(discordUserId).catch(() => null);
    }

    if (!member) {
      console.warn(`[TMT Role Sync] Member ${discordUserId} not found in TMT guild`);
      return { success: false, error: "member_not_found" };
    }

    console.log(`[TMT Role Sync] Found Discord member: ${member.user.tag}`);

    // Get user's rank in Roblox group
    const userRank = await getUserRankInGroup(robloxUserId);

    // Get user's branch memberships
    const branches = await getUserBranchMemberships(robloxUserId);

    // Compute desired roles
    const unresolvedRoles = [];
    const desiredRoleIds = await computeTMTRoles(guild, userRank, branches, unresolvedRoles);

    // Dynamically resolve all branch role IDs (hardcoded and looked up by name)
    const resolvedBranchRoleIds = new Set();
    for (const groupConfig of Object.values(TMT_BRANCH_GROUPS)) {
      if (groupConfig.discordRoleId) {
        resolvedBranchRoleIds.add(groupConfig.discordRoleId);
      } else if (groupConfig.discordRoleName) {
        const role = findRoleByName(guild, groupConfig.discordRoleName);
        if (role) resolvedBranchRoleIds.add(role.id);
      }

      if (groupConfig.discordBranchRoleId) {
        resolvedBranchRoleIds.add(groupConfig.discordBranchRoleId);
      } else if (groupConfig.discordBranchRoleName) {
        const role = findRoleByName(guild, groupConfig.discordBranchRoleName);
        if (role) resolvedBranchRoleIds.add(role.id);
      }
    }

    // Get all managed TMT role IDs
    const startSep = findRoleByName(guild, BRANCH_START_SEPARATOR);
    const endSep = findRoleByName(guild, BRANCH_END_SEPARATOR);

    const allManagedTMTRoles = new Set([
      ...Object.values(SEPARATOR_ROLES),
      ...Object.values(CATEGORY_ROLES),
      ...Object.values(STATUS_ROLES),
      ...Object.values(RANK_ROLES),
      ...Array.from(resolvedBranchRoleIds)
    ]);

    if (startSep) allManagedTMTRoles.add(startSep.id);
    if (endSep) allManagedTMTRoles.add(endSep.id);

    const toAdd = [];
    const toRemove = [];

    for (const roleId of desiredRoleIds) {
      if (!member.roles.cache.has(roleId)) {
        toAdd.push(roleId);
      }
    }

    for (const roleId of allManagedTMTRoles) {
      if (!desiredRoleIds.has(roleId) && member.roles.cache.has(roleId)) {
        toRemove.push(roleId);
      }
    }

    console.log(`[TMT Role Sync] Roles to add:`, toAdd);
    console.log(`[TMT Role Sync] Roles to remove:`, toRemove);

    if (toAdd.length > 0) {
      await member.roles.add(toAdd, `TMT Role Sync (Add)`).catch(err => {
        console.error(`[TMT Role Sync] Error adding roles:`, err.message);
      });
    }

    if (toRemove.length > 0) {
      await member.roles.remove(toRemove, `TMT Role Sync (Remove)`).catch(err => {
        console.error(`[TMT Role Sync] Error removing roles:`, err.message);
      });
    }

    const addedRoles = toAdd.map(id => guild.roles.cache.get(id)).filter(Boolean);
    const removedRoles = toRemove.map(id => guild.roles.cache.get(id)).filter(Boolean);

    // Find if user has a category/tier role
    let tierRoleName = null;
    if (userRank) {
      const roleConfig = TMT_ROLE_MAPPINGS[userRank.rank];
      if (roleConfig && roleConfig.discordRoleIds) {
        const catRoleId = roleConfig.discordRoleIds.find(id => Object.values(CATEGORY_ROLES).includes(id));
        if (catRoleId) {
          const role = guild.roles.cache.get(catRoleId);
          if (role) {
            tierRoleName = role.name;
          } else {
            const key = Object.keys(CATEGORY_ROLES).find(k => CATEGORY_ROLES[k] === catRoleId);
            tierRoleName = key || "Bilinmeyen Tier";
          }
        }
      }
    }

    const User = require("../../models/User");
    const dbUser = await User.findOne({ discordId: discordUserId });

    console.log(`[TMT Role Sync] ✅ Sync completed for ${member.user.tag}`);
    return {
      success: true,
      nickname: dbUser ? dbUser.robloxUsername : member.displayName,
      added: addedRoles,
      removed: removedRoles,
      tier: tierRoleName,
      unresolved: unresolvedRoles
    };
  } catch (error) {
    console.error(`[TMT Role Sync] Fatal errors:`, error.message);
    return { success: false, error: error.message };
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
          const result = await syncTMTRoles(client, member.id, dbUser.robloxId, member);
          if (result && result.success) updated++;
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
