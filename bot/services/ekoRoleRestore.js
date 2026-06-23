'use strict';

const StaffProgress = require('../../models/StaffProgress');
const FrogLevel = require('../../models/FrogLevel');
const { ROLES } = require('./staffSystem');
const staffAutomation = require('./staffAutomation');
const frogLevel = require('./frogLevel');
const { GUILD2_ID } = require('../../config');
const logger = require('../../utils/logger');

/**
 * Automatically scans all members of the EkoYıldız guild and restores missing roles based on the database.
 * Runs in the background at startup to prevent blocking.
 * @param {import('discord.js').Client} client
 */
async function autoRestoreRoles(client) {
  try {
    logger.info("🔄 EkoYıldız otomatik rol kurtarma taraması başlatılıyor...");
    const guild = await client.guilds.fetch(GUILD2_ID).catch(() => null);
    if (!guild) {
      logger.warn(`⚠️ EkoYıldız sunucusu (${GUILD2_ID}) bulunamadı. Otomatik rol kurtarma iptal edildi.`);
      return;
    }

    // Fetch all members of the guild
    const members = await guild.members.fetch().catch(err => {
      logger.error("❌ Guild üyeleri çekilemedi:", err.message);
      return null;
    });

    if (!members) return;

    logger.info(`🔍 Toplam ${members.size} üye taramaya hazır.`);

    let syncedCount = 0;
    let staffCount = 0;
    let levelCount = 0;

    for (const [memberId, member] of members.entries()) {
      if (member.user.bot) continue;

      let updated = false;

      // 0. Yavru Dinazor Rolü (Herkeste olması zorunlu)
      const level0RoleId = '1518692402884378825';
      if (!member.roles.cache.has(level0RoleId)) {
        await member.roles.add(level0RoleId, "Otomatik: Yavru Dinazor Rolü (Zorunlu)").catch(() => {});
        updated = true;
      }

      // 1. Staff System Sync
      const progress = await StaffProgress.findOne({ userId: memberId });
      if (progress && progress.level && progress.status === 'active') {
        const roleId = ROLES[progress.level];
        if (roleId) {
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId, "EkoRolSync Otomatik: Staff Seviye Kurtarma").catch(() => {});
            staffCount++;
            updated = true;
          }
          // Also run main guild roles sync
          await staffAutomation.syncMainGuildRoles(client, memberId).catch(() => {});
        }
      }

      // 2. Frog Level (Dinazor/Penguen) System Sync
      const frog = await FrogLevel.findOne({ userId: memberId, guildId: guild.id });
      if (frog && frog.level !== undefined) {
        const targetRole = frogLevel.FROG_ROLES[frog.level];
        const level0Role = frogLevel.FROG_ROLES[0];
        const DINASOUR_FAMILY_ROLE = '1518706437730078941';
        const PENGUIN_FAMILY_ROLE  = '1518706437327556638';

        let needsSync = false;
        if (targetRole && !member.roles.cache.has(targetRole.id)) {
          needsSync = true;
        }
        if (frog.level > 0 && level0Role && !member.roles.cache.has(level0Role.id)) {
          needsSync = true;
        }
        if (frog.level >= 0 && frog.level <= 11 && !member.roles.cache.has(DINASOUR_FAMILY_ROLE)) {
          needsSync = true;
        }
        if (frog.level >= 12 && frog.level <= 16 && !member.roles.cache.has(PENGUIN_FAMILY_ROLE)) {
          needsSync = true;
        }

        if (needsSync) {
          await frogLevel.syncRolesFromLevel(member, frog.level, client).catch(() => {});
          levelCount++;
          updated = true;
        }
      }

      if (updated) {
        syncedCount++;
        logger.info(`✅ [Otomatik Rol Kurtarma] ${member.user.tag} (${memberId}) için roller kurtarıldı.`);
      }
    }

    logger.success(`🎉 Otomatik rol kurtarma tamamlandı: ${syncedCount} üye güncellendi (Staff: ${staffCount}, Frog Level: ${levelCount}).`);
  } catch (err) {
    logger.error("❌ Otomatik rol kurtarma sırasında kritik hata:", err);
  }
}

module.exports = {
  autoRestoreRoles
};
