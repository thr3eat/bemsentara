const axios = require("axios");
const {
  MAIN_GROUP_ID,
  BRANCH_GROUPS,
  STRUCTURAL_ROLE_NAMES,
  TIER_SEPARATOR_IDS,
  TIER_WRAPPER_ROLES,
  findTierForRank,
} = require("../config/roleSync");

async function fetchUserGroups(robloxId) {
  const response = await axios.get(
    `https://groups.roblox.com/v1/users/${robloxId}/groups/roles`,
    { timeout: 10000 }
  );
  return response.data.data || [];
}

function findRoleByName(guild, name) {
  if (!name) return null;
  const target = name.toLowerCase().trim();
  return (
    guild.roles.cache.find(
      (r) =>
        r.name.toLowerCase() === target && !r.managed && r.id !== guild.id
    ) || null
  );
}

function findRoleById(guild, roleId) {
  if (!roleId) return null;
  const role = guild.roles.cache.get(String(roleId));
  return role && !role.managed && role.id !== guild.id ? role : null;
}

function findBranchMembership(userGroups) {
  for (const [groupId, departmentRoleName] of Object.entries(BRANCH_GROUPS)) {
    const membership = userGroups.find((g) => g.group.id === Number(groupId));
    if (membership) {
      return {
        groupId: Number(groupId),
        departmentRoleName,
        rankName: membership.role.name,
        rankId: membership.role.id,
      };
    }
  }
  return null;
}

/**
 * Roblox grup verilerinden hedef Discord rol adlarını ve ID'lerini hesaplar.
 */
function computeDesiredRoles(userGroups) {
  const mainMembership = userGroups.find((g) => g.group.id === MAIN_GROUP_ID);

  if (!mainMembership) {
    return {
      ok: false,
      error: "not_in_main_group",
      rankName: null,
      desiredNames: [],
      desiredRoleIds: [],
      tier: null,
    };
  }

  const rankName = mainMembership.role.name;
  const desiredNames = new Set();
  const desiredRoleIds = new Set();

  desiredNames.add(rankName);

  const tier = findTierForRank(rankName);

  if (tier) {
    desiredNames.add(tier.wrapperRole);
    for (const sepId of tier.separatorIds) {
      desiredRoleIds.add(String(sepId));
    }
    if (!tier.skipTeşkilatPersoneli) {
      desiredNames.add("Teşkilat Personeli");
    }
  } else {
    desiredNames.add("Teşkilat Personeli");
  }

  const branch = findBranchMembership(userGroups);
  if (branch) {
    desiredNames.add("Branşlı Personel");
    desiredNames.add(branch.departmentRoleName);
    if (branch.rankName && branch.rankName.toLowerCase() !== "guest") {
      desiredNames.add(branch.rankName);
    }
  } else {
    desiredNames.add("Branşsız Personel");
  }

  return {
    ok: true,
    error: null,
    rankName,
    branch,
    tier: tier?.wrapperRole || null,
    desiredNames: [...desiredNames],
    desiredRoleIds: [...desiredRoleIds],
  };
}

function getManagedRoleIds(guild) {
  const ids = new Set(TIER_SEPARATOR_IDS.map(String));

  for (const name of STRUCTURAL_ROLE_NAMES) {
    const role = findRoleByName(guild, name);
    if (role) ids.add(role.id);
  }

  for (const wrapper of TIER_WRAPPER_ROLES) {
    const role = findRoleByName(guild, wrapper);
    if (role) ids.add(role.id);
  }

  return ids;
}

async function addGroupRankRolesToManaged(guild, groupId, managedIds) {
  try {
    const response = await axios.get(
      `https://groups.roblox.com/v1/groups/${groupId}/roles`,
      { timeout: 8000 }
    );
    for (const rank of response.data.roles || []) {
      const role = findRoleByName(guild, rank.name);
      if (role) managedIds.add(role.id);
    }
  } catch (err) {
    console.warn(`Grup ${groupId} rütbeleri alınamadı:`, err.message);
  }
}

async function addAllManagedRankRoles(guild, managedIds) {
  await addGroupRankRolesToManaged(guild, MAIN_GROUP_ID, managedIds);
  for (const groupId of Object.keys(BRANCH_GROUPS)) {
    await addGroupRankRolesToManaged(guild, Number(groupId), managedIds);
  }
}

function resolveDesiredRoleIds(guild, plan, unresolved) {
  const desiredRoleIds = new Set();

  for (const name of plan.desiredNames) {
    const role = findRoleByName(guild, name);
    if (role) {
      desiredRoleIds.add(role.id);
    } else {
      unresolved.push(name);
    }
  }

  for (const roleId of plan.desiredRoleIds) {
    const role = findRoleById(guild, roleId);
    if (role) {
      desiredRoleIds.add(role.id);
    } else {
      unresolved.push(`id:${roleId}`);
    }
  }

  return desiredRoleIds;
}

/**
 * Üyenin Discord rollerini Roblox verilerine göre senkronize eder.
 */
async function syncMemberRoles(guild, member, robloxId, robloxUsername) {
  const userGroups = await fetchUserGroups(robloxId);
  const plan = computeDesiredRoles(userGroups);

  if (!plan.ok) {
    return {
      success: false,
      error: "not_in_main_group",
      message: "Ana BEM grubunun üyesi değilsiniz.",
      added: [],
      removed: [],
      nickname: null,
      rankName: null,
      tier: null,
    };
  }

  const unresolved = [];
  const desiredRoleIds = resolveDesiredRoleIds(guild, plan, unresolved);

  const managedIds = getManagedRoleIds(guild);
  await addAllManagedRankRoles(guild, managedIds);

  const toAdd = [];
  const toRemove = [];

  for (const roleId of desiredRoleIds) {
    if (!member.roles.cache.has(roleId)) {
      const role = guild.roles.cache.get(roleId);
      if (role) toAdd.push(role);
    }
  }

  for (const roleId of managedIds) {
    if (!desiredRoleIds.has(roleId) && member.roles.cache.has(roleId)) {
      const role = guild.roles.cache.get(roleId);
      if (role && !role.managed) toRemove.push(role);
    }
  }

  if (toAdd.length) await member.roles.add(toAdd, "Sentara rol senkronizasyonu");
  if (toRemove.length) await member.roles.remove(toRemove, "Sentara rol senkronizasyonu");

  const nickname = robloxUsername || member.displayName;
  if (nickname && member.manageable && member.nickname !== nickname) {
    await member.setNickname(nickname, "Sentara rol senkronizasyonu");
  }

  return {
    success: true,
    error: null,
    message: "Roller güncellendi.",
    added: toAdd,
    removed: toRemove,
    unresolved,
    nickname,
    rankName: plan.rankName,
    tier: plan.tier,
    branch: plan.branch,
    desiredNames: plan.desiredNames,
  };
}

module.exports = {
  fetchUserGroups,
  computeDesiredRoles,
  syncMemberRoles,
  findRoleByName,
  findRoleById,
  MAIN_GROUP_ID,
};
