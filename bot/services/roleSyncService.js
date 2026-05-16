const axios = require("axios");
const {
  MAIN_GROUP_ID,
  BRANCH_GROUPS,
  SEPARATOR_ROLE_NAME,
  STRUCTURAL_ROLE_NAMES,
  KOMISER_PATTERN,
  MEMUR_PATTERN,
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
        r.name.toLowerCase() === target &&
        !r.managed &&
        r.id !== guild.id
    ) || null
  );
}

function getTeşkilatWrapper(rankName) {
  if (KOMISER_PATTERN.test(rankName) && /komiser|müdür|amir|genel|kurul|başkan/i.test(rankName)) {
    return "Teşkilat Komiseri";
  }
  if (MEMUR_PATTERN.test(rankName)) {
    return "Teşkilat Memuru";
  }
  return null;
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
 * Roblox grup verilerinden hedef Discord rol adlarını hesaplar.
 */
function computeDesiredRoleNames(userGroups) {
  const desired = new Set();
  const mainMembership = userGroups.find((g) => g.group.id === MAIN_GROUP_ID);

  if (!mainMembership) {
    return {
      ok: false,
      error: "not_in_main_group",
      rankName: null,
      desiredNames: [],
    };
  }

  const rankName = mainMembership.role.name;
  desired.add(rankName);
  desired.add("Teşkilat Personeli");
  desired.add(SEPARATOR_ROLE_NAME);

  const wrapper = getTeşkilatWrapper(rankName);
  if (wrapper) {
    desired.add(wrapper);
    desired.add(SEPARATOR_ROLE_NAME);
  }

  const branch = findBranchMembership(userGroups);
  if (branch) {
    desired.add("Branşlı Personel");
    desired.add(branch.departmentRoleName);
    if (branch.rankName && branch.rankName.toLowerCase() !== "guest") {
      desired.add(branch.rankName);
    }
  } else {
    desired.add("Branşsız Personel");
  }

  return {
    ok: true,
    error: null,
    rankName,
    branch,
    desiredNames: [...desired],
  };
}

function getManagedRoleIds(guild) {
  const ids = new Set();
  for (const name of STRUCTURAL_ROLE_NAMES) {
    const role = findRoleByName(guild, name);
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

/**
 * Üyenin Discord rollerini Roblox verilerine göre senkronize eder.
 */
async function syncMemberRoles(guild, member, robloxId, robloxUsername) {
  const userGroups = await fetchUserGroups(robloxId);
  const plan = computeDesiredRoleNames(userGroups);

  if (!plan.ok) {
    return {
      success: false,
      error: "not_in_main_group",
      message: "Ana BEM grubunun üyesi değilsiniz.",
      added: [],
      removed: [],
      nickname: null,
      rankName: null,
    };
  }

  const desiredRoleIds = new Set();
  const unresolved = [];

  for (const name of plan.desiredNames) {
    const role = findRoleByName(guild, name);
    if (role) {
      desiredRoleIds.add(role.id);
    } else {
      unresolved.push(name);
    }
  }

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
    branch: plan.branch,
    desiredNames: plan.desiredNames,
  };
}

module.exports = {
  fetchUserGroups,
  computeDesiredRoleNames,
  syncMemberRoles,
  findRoleByName,
  MAIN_GROUP_ID,
};
