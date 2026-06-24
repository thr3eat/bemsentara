'use strict';

const { ChannelType } = require("discord.js");

const UNIT_GUILD_ID = '1466927911364726845'; // Server for unit roles

const UNIT_ROLE_CONFIG = {
  BAN_BIRIMI: {
    coachRoleName: '🔴 BAN Birim Koçu',
    bossRoleName: '🟠 BAN Birim Başkanı',
    assistantRoleName: '🟡 BAN Birim Yardımcısı',
    memberRoleName: '🟢 BAN Birim Personeli',
    color: 0xe74c3c, // Red
    position: 100,
  },
  SES_BIRIMI: {
    coachRoleName: '🔴 SES Birim Koçu',
    bossRoleName: '🟠 SES Birim Başkanı',
    assistantRoleName: '🟡 SES Birim Yardımcısı',
    memberRoleName: '🟢 SES Birim Personeli',
    color: 0x3498db, // Blue
    position: 90,
  },
  SOHBET_BIRIMI: {
    coachRoleName: '🔴 SOHBET Birim Koçu',
    bossRoleName: '🟠 SOHBET Birim Başkanı',
    assistantRoleName: '🟡 SOHBET Birim Yardımcısı',
    memberRoleName: '🟢 SOHBET Birim Personeli',
    color: 0x2ecc71, // Green
    position: 80,
  },
};

/**
 * Ensure all unit roles exist in the server
 */
async function ensureUnitRolesExist(guild) {
  try {
    const createdRoles = {};

    for (const [unitKey, config] of Object.entries(UNIT_ROLE_CONFIG)) {
      createdRoles[unitKey] = {};

      // Check if roles already exist, if not create them
      const coachRole = guild.roles.cache.find(r => r.name === config.coachRoleName) ||
        await guild.roles.create({
          name: config.coachRoleName,
          color: config.color,
          reason: `Unit coach role for ${unitKey}`,
        });

      const bossRole = guild.roles.cache.find(r => r.name === config.bossRoleName) ||
        await guild.roles.create({
          name: config.bossRoleName,
          color: config.color,
          reason: `Unit boss role for ${unitKey}`,
        });

      const assistantRole = guild.roles.cache.find(r => r.name === config.assistantRoleName) ||
        await guild.roles.create({
          name: config.assistantRoleName,
          color: config.color,
          reason: `Unit assistant role for ${unitKey}`,
        });

      const memberRole = guild.roles.cache.find(r => r.name === config.memberRoleName) ||
        await guild.roles.create({
          name: config.memberRoleName,
          color: config.color,
          reason: `Unit member role for ${unitKey}`,
        });

      createdRoles[unitKey] = {
        coachRoleId: coachRole.id,
        bossRoleId: bossRole.id,
        assistantRoleId: assistantRole.id,
        memberRoleId: memberRole.id,
      };
    }

    console.log('[unitRoleSync] All unit roles ensured to exist');
    return { success: true, roles: createdRoles };
  } catch (err) {
    console.error('[unitRoleSync] ensureUnitRolesExist error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Find a role by name
 */
async function findRoleByName(guild, roleName) {
  try {
    return guild.roles.cache.find(r => r.name === roleName) || null;
  } catch (err) {
    console.error('[unitRoleSync] findRoleByName error:', err.message);
    return null;
  }
}

/**
 * Assign unit role to member
 */
async function assignUnitRole(guild, userId, unitKey, roleType = 'member') {
  try {
    const config = UNIT_ROLE_CONFIG[unitKey];
    if (!config) {
      return { success: false, error: `Unknown unit: ${unitKey}` };
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      return { success: false, error: "Member not found" };
    }

    let roleName;
    switch (roleType) {
      case 'coach':
        roleName = config.coachRoleName;
        break;
      case 'boss':
        roleName = config.bossRoleName;
        break;
      case 'assistant':
        roleName = config.assistantRoleName;
        break;
      case 'member':
      default:
        roleName = config.memberRoleName;
    }

    const role = await findRoleByName(guild, roleName);
    if (!role) {
      return { success: false, error: `Role not found: ${roleName}` };
    }

    await member.roles.add(role);
    console.log(`[unitRoleSync] Added role ${roleName} to ${userId}`);

    return { success: true, roleId: role.id, roleName };
  } catch (err) {
    console.error('[unitRoleSync] assignUnitRole error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Remove unit role from member
 */
async function removeUnitRole(guild, userId, unitKey) {
  try {
    const config = UNIT_ROLE_CONFIG[unitKey];
    if (!config) {
      return { success: false, error: `Unknown unit: ${unitKey}` };
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Remove all unit roles for this unit
    const rolesToRemove = [
      config.coachRoleName,
      config.bossRoleName,
      config.assistantRoleName,
      config.memberRoleName,
    ];

    for (const roleName of rolesToRemove) {
      const role = await findRoleByName(guild, roleName);
      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        console.log(`[unitRoleSync] Removed role ${roleName} from ${userId}`);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[unitRoleSync] removeUnitRole error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get unit role IDs for a unit
 */
async function getUnitRoleIds(guild, unitKey) {
  try {
    const config = UNIT_ROLE_CONFIG[unitKey];
    if (!config) {
      return { success: false, error: `Unknown unit: ${unitKey}` };
    }

    const roles = {
      coachRoleId: (await findRoleByName(guild, config.coachRoleName))?.id,
      bossRoleId: (await findRoleByName(guild, config.bossRoleName))?.id,
      assistantRoleId: (await findRoleByName(guild, config.assistantRoleName))?.id,
      memberRoleId: (await findRoleByName(guild, config.memberRoleName))?.id,
    };

    return { success: true, roles };
  } catch (err) {
    console.error('[unitRoleSync] getUnitRoleIds error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  ensureUnitRolesExist,
  findRoleByName,
  assignUnitRole,
  removeUnitRole,
  getUnitRoleIds,
  UNIT_GUILD_ID,
  UNIT_ROLE_CONFIG,
};
