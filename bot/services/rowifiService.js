const { EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const axios = require('axios');
const RowifiBind = require('../../models/RowifiBind');
const RowifiConfig = require('../../models/RowifiConfig');
const { findUserByDiscordId } = require('../../utils/userLink');
const { ROWIFI_TOKEN } = require('../../config');

/**
 * Resolves a member's Roblox ID and Username from local DB or external APIs
 */
async function resolveRobloxInfo(member) {
  let robloxId = null;
  let robloxUsername = null;
  let source = null;

  // 1. Check local DB
  try {
    const dbUser = await findUserByDiscordId(member.id);
    if (dbUser && dbUser.robloxId) {
      robloxId = String(dbUser.robloxId);
      robloxUsername = dbUser.robloxUsername;
      source = 'Local Database';
    }
  } catch (err) {
    console.warn(`[rowifiService] Local DB check error: ${err.message}`);
  }

  // 2. Check RoWifi API
  if (!robloxId && ROWIFI_TOKEN) {
    const guildsToCheck = [member.guild.id, '1367646464804655104', '1483482948320891074'];
    for (const gId of guildsToCheck) {
      try {
        const url = `https://api.rowifi.xyz/v3/guilds/${gId}/members/${member.id}`;
        const response = await axios.get(url, {
          headers: { 'Authorization': `Bot ${ROWIFI_TOKEN}` },
          timeout: 2000
        });
        if (response.status === 200 && response.data && response.data.roblox_id) {
          robloxId = String(response.data.roblox_id);
          robloxUsername = response.data.roblox_username || null;
          source = 'RoWifi API';
          break;
        }
      } catch (err) {
        // Silently try next
      }
    }
  }

  // 3. Check Bloxlink API
  if (!robloxId) {
    try {
      const url = `https://v3.api.blox.link/developer/discord/${member.id}`;
      const response = await axios.get(url, { timeout: 2000 });
      if (response.status === 200 && response.data && response.data.robloxId) {
        robloxId = String(response.data.robloxId);
        source = 'Bloxlink API';
      }
    } catch (err) {
      // Ignore
    }
  }

  // 4. Resolve username if missing
  if (robloxId && !robloxUsername) {
    try {
      robloxUsername = await noblox.getUsernameFromId(parseInt(robloxId));
    } catch (err) {
      robloxUsername = `Roblox_${robloxId}`;
    }
  }

  return robloxId ? { robloxId, robloxUsername, source } : null;
}

/**
 * Synchronize a single member
 */
async function syncMember(member, client) {
  const guildId = member.guild.id;

  // Fetch all binds for this guild
  const binds = await RowifiBind.find({ guildId });
  if (binds.length === 0) return null;

  // Resolve Roblox Info
  const robloxInfo = await resolveRobloxInfo(member);

  const uniqueGroupIds = [...new Set(binds.map(b => b.groupId))];
  const groupRanks = {}; // groupId -> rankId
  const groupRankNames = {}; // groupId -> rankName

  // Fetch group ranks
  if (robloxInfo) {
    const robloxUserId = parseInt(robloxInfo.robloxId);
    for (const gId of uniqueGroupIds) {
      try {
        const rank = await noblox.getRankInGroup(gId, robloxUserId);
        groupRanks[gId] = rank || 0;

        // Try to get rank name for templates
        try {
          const roleInfo = await noblox.getRole(gId, rank);
          groupRankNames[gId] = roleInfo ? roleInfo.name : `Rank ${rank}`;
        } catch (roleErr) {
          groupRankNames[gId] = `Rank ${rank}`;
        }
      } catch (err) {
        console.warn(`[rowifiService] Error fetching rank in group ${gId} for ${member.user.tag}:`, err.message);
        groupRanks[gId] = 0; // fallback to guest
        groupRankNames[gId] = 'Guest';
      }
    }
  } else {
    // If not verified, they are Guest (rank 0) in all groups
    for (const gId of uniqueGroupIds) {
      groupRanks[gId] = 0;
      groupRankNames[gId] = 'Guest';
    }
  }

  const rolesToAdd = new Set();
  const rolesToRemove = new Set();
  const managedRoleIds = new Set(binds.map(b => b.roleId));

  const matchingBinds = [];

  for (const bind of binds) {
    const userRank = groupRanks[bind.groupId] || 0;
    let isMatch = false;

    if (bind.type === 'rank') {
      isMatch = (bind.rank === userRank);
    } else if (bind.type === 'group') {
      isMatch = (userRank > 0);
    }

    if (isMatch) {
      rolesToAdd.add(bind.roleId);
      matchingBinds.push(bind);
    } else {
      rolesToRemove.add(bind.roleId);
    }
  }

  // A role shouldn't be removed if another matched bind grants it
  for (const rId of rolesToAdd) {
    rolesToRemove.delete(rId);
  }

  // Update roles
  const currentRoles = member.roles.cache;
  const added = [];
  const removed = [];

  for (const rId of rolesToAdd) {
    if (!currentRoles.has(rId)) {
      const roleObj = member.guild.roles.cache.get(rId);
      if (roleObj && roleObj.editable) {
        await member.roles.add(roleObj, 'RoWifi Sync').catch(() => {});
        added.push(roleObj.name);
      }
    }
  }

  for (const rId of rolesToRemove) {
    if (currentRoles.has(rId)) {
      const roleObj = member.guild.roles.cache.get(rId);
      if (roleObj && roleObj.editable) {
        await member.roles.remove(roleObj, 'RoWifi Sync').catch(() => {});
        removed.push(roleObj.name);
      }
    }
  }

  // Nickname Template logic
  let nicknameChanged = false;
  let oldNickname = member.displayName;
  let newNickname = oldNickname;

  if (robloxInfo && matchingBinds.length > 0) {
    // Sort binds by priority descending, then rank descending, then ID
    matchingBinds.sort((a, b) => (b.priority || 1) - (a.priority || 1));
    const highestBind = matchingBinds[0];

    if (highestBind && highestBind.template) {
      const gId = highestBind.groupId;
      const rankName = groupRankNames[gId] || 'Guest';

      newNickname = highestBind.template
        .replace(/{roblox_username}/g, robloxInfo.robloxUsername)
        .replace(/{roblox_id}/g, robloxInfo.robloxId)
        .replace(/{discord_username}/g, member.user.username)
        .replace(/{roblox_rank}/g, rankName);

      // Discord nickname limit is 32 characters
      if (newNickname.length > 32) {
        newNickname = newNickname.substring(0, 32);
      }

      if (newNickname !== oldNickname && member.manageable) {
        await member.setNickname(newNickname, 'RoWifi Sync').catch(() => {});
        nicknameChanged = true;
      }
    }
  }

  return {
    robloxInfo,
    added,
    removed,
    nicknameChanged,
    oldNickname,
    newNickname
  };
}

/**
 * Synchronize all members in a guild
 */
async function syncGuild(guild, client) {
  await guild.members.fetch().catch(() => {});
  const members = Array.from(guild.members.cache.values());

  let successCount = 0;
  let skippedCount = 0;

  // Process in sequential chunks with 150ms delay to prevent rate limits
  for (const member of members) {
    if (member.user.bot) {
      skippedCount++;
      continue;
    }

    try {
      const res = await syncMember(member, client);
      if (res) successCount++;
      else skippedCount++;
    } catch (err) {
      console.warn(`[rowifiService] Error syncing member ${member.user.tag}:`, err.message);
      skippedCount++;
    }

    // Delay
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  // Update last sync time
  await RowifiConfig.findOneAndUpdate(
    { guildId: guild.id },
    { lastSync: new Date() },
    { upsert: true }
  );

  return { successCount, skippedCount };
}

/**
 * Initialize periodic auto detection scanner
 */
function startAutoDetectionScheduler(client) {
  // Run once every 30 minutes
  setInterval(async () => {
    try {
      const configs = await RowifiConfig.find({ autoDetection: true });
      for (const config of configs) {
        const guild = client.guilds.cache.get(config.guildId);
        if (guild) {
          console.log(`[rowifiScheduler] Auto Detection starting for guild: ${guild.name} (${guild.id})`);
          const res = await syncGuild(guild, client).catch(err => {
            console.error(`[rowifiScheduler] Sync failed for guild ${guild.name}:`, err.message);
            return null;
          });
          if (res) {
            console.log(`[rowifiScheduler] Auto Detection finished for ${guild.name}: Syncs: ${res.successCount}, Skipped: ${res.skippedCount}`);
          }
        }
      }
    } catch (err) {
      console.error('[rowifiScheduler] Scheduler error:', err.message);
    }
  }, 30 * 60 * 1000);
}

module.exports = {
  syncMember,
  syncGuild,
  startAutoDetectionScheduler,
  resolveRobloxInfo
};
