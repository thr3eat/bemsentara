const { EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const StaffProgress = require('../../models/StaffProgress');
const User = require('../../models/User');

const ADMIN_GUILD_ID = '1466927911364726845';

// Log channels in Admin Guild
const CHANNELS = {
  CEZA_LOG: '1469667945721499740',
  ABONE_KAYIT: '1477987859213586512',
  BAN_ITIRAZ: '1479950092197957772',
  ANA_SUNUCU: '1469667776598900898',
  BOT_HATA: '1469667875223765247',
  KOMUT_LOG: '1478044685938196669',
  MUTE_LOG: '1466946762190229589',
  TERFI_LOG: '1466939999571279994', // where promotions are announced
  MOD_LIST: '1467151754121711616',  // dynamic mod list
  SUGGESTION_LOG: '1517620154928988180'
};

// Roblox Groups
const ROBLOX = {
  EKOYILDIZ: 35431216,
  EKOYILDIZ_MOD: 130659145
};

/**
 * Synchronizes the user's Roblox group ranks based on their StaffProgress level.
 * @param {import('discord.js').Client} client 
 * @param {string} discordUserId 
 */
async function syncStaffRobloxRanks(client, discordUserId) {
  try {
    const User = require('../../models/User');
    const StaffProgress = require('../../models/StaffProgress');
    
    const user = await User.findOne({ discordId: discordUserId });
    if (!user || !user.robloxId) {
      console.log(`[StaffAutomation] User ${discordUserId} does not have a Roblox ID linked.`);
      return false; // Not verified
    }

    let staff = await StaffProgress.findOne({ userId: discordUserId });
    if (!staff) {
      staff = new StaffProgress({
        userId: discordUserId,
        level: 1, // Default to Stajyer
        points: 0,
        robloxVerified: true,
        guildJoined: true
      });
      await staff.save();
    }

    const robloxId = parseInt(user.robloxId);
    if (isNaN(robloxId)) return false;

    // Rank logic for EkoYıldız Moderatör Ekibi (130659145)
    let modRank = 0;
    if (staff.level === 1) modRank = 2; // Stajyer
    else if (staff.level === 2) modRank = 3; // Personel
    else if (staff.level === 3) modRank = 4; // Gelişmiş Personel
    else if (staff.level >= 4) modRank = 7; // Sekreter

    // Rank logic for EkoYıldız Main (35431216)
    let mainRank = 0;
    if (staff.level <= 2) mainRank = 15; // Alt Düzey
    else if (staff.level >= 3) mainRank = 20; // Üst Düzey

    // Attempt to set ranks
    if (modRank > 0) {
      try {
        await noblox.handleJoinRequest(ROBLOX.EKOYILDIZ_MOD, robloxId, true).catch(() => { });
        await noblox.setRank(ROBLOX.EKOYILDIZ_MOD, robloxId, modRank);
        console.log(`[StaffAutomation] Set rank ${modRank} in Mod Group for user ${discordUserId}`);
      } catch (err) {
        console.error(`[StaffAutomation] Failed to set Mod rank for ${discordUserId}:`, err.message);
      }
    }

    if (mainRank > 0) {
      try {
        await noblox.handleJoinRequest(ROBLOX.EKOYILDIZ, robloxId, true).catch(() => { });
        await noblox.setRank(ROBLOX.EKOYILDIZ, robloxId, mainRank);
        console.log(`[StaffAutomation] Set rank ${mainRank} in Main Group for user ${discordUserId}`);
      } catch (err) {
        console.error(`[StaffAutomation] Failed to set Main rank for ${discordUserId}:`, err.message);
      }
    }

    // Ensure staff has robloxVerified set to true
    if (!staff.robloxVerified) {
      staff.robloxVerified = true;
      await staff.save();
    }

    return true;
  } catch (error) {
    console.error("[StaffAutomation] syncStaffRobloxRanks Error:", error);
    return false;
  }
}

/**
 * Sends a log message to a specific channel in the Admin Discord server.
 * @param {import('discord.js').Client} client 
 * @param {string} channelKey key from CHANNELS object
 * @param {EmbedBuilder} embed 
 */
async function sendAdminLog(client, channelKey, embed) {
  try {
    const channelId = CHANNELS[channelKey];
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error(`[StaffAutomation] Failed to send admin log to ${channelKey}:`, error.message);
  }
}

/**
 * Checks if a staff member has joined the Admin Discord server.
 * @param {import('discord.js').Client} client 
 * @param {string} discordUserId 
 * @returns {Promise<boolean>}
 */
async function ensureAdminGuildMembership(client, discordUserId) {
  try {
    const guild = await client.guilds.fetch(ADMIN_GUILD_ID).catch(() => null);
    if (!guild) return false;

    const member = await guild.members.fetch(discordUserId).catch(() => null);
    const hasJoined = !!member;

    // Update DB
    const staff = await StaffProgress.findOne({ userId: discordUserId });
    if (staff && staff.guildJoined !== hasJoined) {
      staff.guildJoined = hasJoined;
      await staff.save();
    }

    // If not joined, DM the invite link
    if (!hasJoined) {
      const user = await client.users.fetch(discordUserId).catch(() => null);
      if (user) {
        await user.send(
          "⚠️ **EkoYıldız Personel Sistemi Uyarı**\n\nPersonel statünüz gereği **EkoYıldız Yönetim** sunucusuna katılmanız zorunludur. Lütfen aşağıdaki bağlantıyı kullanarak sunucuya katılın:\n🔗 https://discord.gg/fjwjMgH54N"
        ).catch(() => { });
      }
    }

    return hasJoined;
  } catch (error) {
    console.error("[StaffAutomation] ensureAdminGuildMembership Error:", error);
    return false;
  }
}

/**
 * Synchronizes the user's Discord roles in the Admin Guild based on their Roblox Group Rank.
 * @param {import('discord.js').Client} client 
 * @param {string} discordUserId 
 */
async function syncStaffDiscordRoles(client, discordUserId) {
  try {
    const User = require('../../models/User');
    const user = await User.findOne({ discordId: discordUserId });
    if (!user || !user.robloxId) return false;

    const guild = await client.guilds.fetch(ADMIN_GUILD_ID).catch(() => null);
    if (!guild) return false;

    const member = await guild.members.fetch(discordUserId).catch(() => null);
    if (!member) return false;

    // Fetch user groups using noblox to bypass some cache
    let rankName = "";
    try {
      const { noblox, ROBLOX } = require('../../config');
      const nobloxRankName = await noblox.getRankNameInGroup(ROBLOX.EKOYILDIZ_MOD, parseInt(user.robloxId));
      if (nobloxRankName && nobloxRankName !== "Guest") {
        rankName = nobloxRankName.trim();
      }
    } catch (e) {
      console.warn("[StaffAutomation] noblox getRankNameInGroup error:", e.message);
    }
    
    // Eğer noblox'tan gelmezse (veya hata verirse), normal API'dan deneyelim
    if (!rankName) {
      const axios = require('axios');
      const response = await axios.get(`https://groups.roblox.com/v1/users/${user.robloxId}/groups/roles`, { timeout: 5000 }).catch(() => null);
      if (response && response.data && response.data.data) {
        const modGroup = response.data.data.find(g => g.group.id === ROBLOX.EKOYILDIZ_MOD);
        if (modGroup && modGroup.role.rank > 0) {
          rankName = modGroup.role.name.trim();
        }
      }
    }

    // Eğer API'dan gelmezse (örn. Roblox önbelleği gecikmesi), veritabanındaki StaffProgress seviyesini kullan
    if (!rankName) {
      const StaffProgress = require('../../models/StaffProgress');
      const staff = await StaffProgress.findOne({ userId: discordUserId });
      if (staff) {
        if (staff.level === 1) rankName = "Stajyer Personel";
        else if (staff.level === 2) rankName = "Personel";
        else if (staff.level === 3) rankName = "Gelişmiş Personel";
        else if (staff.level >= 4) rankName = "Sekreter";
      }
    }

    if (!rankName) {
      // Hem API'da yok, hem veritabanında yok
      return false;
    }

    const ROLES_TO_ADD = [
      '1517621814405107773', // .
      '1466949714053169327', // Eko & Yıldız | Doğrulama Sistemi
      '1469668957047885967', // EkoYıldız  🔥
      '1467074142426763347', // 🌟 Eko & Yıldız
      '1467078019633119366', // -------------------------------
      '1467077931737284914', // -------------------------------
      '1467077860240916534', // -------------------------------
      '1467078315083829318', // -------------------------------
      '1467080003219886132', // -------------------------------
      '1467082387933499524', // Eko & Yıldız | Moderatör Ekibi
      '1467082891556163727', // -------------------------------
      '1517619148383846592'  // Sentara
    ];

    // Mappings for specific roles the user requested
    const ROLE_MAPPINGS = {
      "Stajyer Personel": ["1467082280035160269"],
      "Personel": ["1467082211839836344", "1479818628152168479", "1466949577189101605"], // Personel + Abone + Mod(2)
      "Gelişmiş Personel": ["1467082157800423515", "1480592150273200330", "1469671332303343642"], // Gelişmiş + Ceza + Mod(3)
      "Sekreter": ["1467079795711148062", "1467076260441231401", "1466948827914436927"], // Sekreter + Yönetim Ekibi + Mod(4)
      "Moderatör Müdür Yardımcısı": ["1467076700415328266"],
      "Moderatör Müdürü": ["1467076595507527834"],
      "Yönetim Ekibi": ["1467076260441231401"],
      "Genel Sekreter": ["1467073280237371527"],
      "Kaptan": ["1467077436532457545"],
      "Overseer": ["1479839884075073567"],
      "Supervisor": ["1479840791454154782"],
      "Security": ["1466948998463225859"],
      "Security Yetki《Bypass》": ["1467152505862357250"]
    };

    // If their rank has a specific ID mapping, add those IDs
    if (ROLE_MAPPINGS[rankName]) {
      ROLES_TO_ADD.push(...ROLE_MAPPINGS[rankName]);
    }

    // Sunucudaki rolleri önbelleğe al
    await guild.roles.fetch();
    
    // Also find the role by exact name (just in case they are a rank not in mapping)
    const exactRole = guild.roles.cache.find(r => r.name.toLowerCase() === rankName.toLowerCase());
    if (exactRole) {
      ROLES_TO_ADD.push(exactRole.id);
    }

    const validRoles = [...new Set(ROLES_TO_ADD)].filter(id => guild.roles.cache.has(id));

    if (validRoles.length > 0) {
      // Find what roles they currently have that are in our managed list
      // Wait, we don't need to remove roles. Just add them.
      await member.roles.add(validRoles).catch(err => console.error(`[StaffAutomation] Discord roller verilemedi: ${err.message}`));
    }

    // Try to sync StaffProgress if possible
    let staff = await StaffProgress.findOne({ userId: discordUserId });
    if (!staff) {
      let level = 1;
      if (rankName === "Personel") level = 2;
      else if (rankName === "Gelişmiş Personel") level = 3;
      else if (["Sekreter", "Genel Sekreter", "Yönetim Ekibi"].includes(rankName)) level = 4;
      
      staff = new StaffProgress({
        userId: discordUserId,
        level: level,
        points: 0,
        robloxVerified: true,
        guildJoined: true
      });
      await staff.save();
    }

    return true;
  } catch (error) {
    console.error("[StaffAutomation] syncStaffDiscordRoles Error:", error);
    return false;
  }
}

/**
 * Updates the dynamic Mod List in the channel (1467151754121711616)
 * @param {import('discord.js').Client} client 
 */
async function updateDynamicModList(client) {
  try {
    const channel = await client.channels.fetch(CHANNELS.MOD_LIST).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const staffList = await StaffProgress.find({ status: 'active' }).sort({ level: -1 });

    let listContent = "📋 **EkoYıldız Güncel Yetkili Listesi**\n\n";

    const levels = {
      4: "🟣 Sekreter",
      3: "🔵 Gelişmiş Personel",
      2: "🟢 Personel",
      1: "⚪ Stajyer"
    };

    let currentLevel = null;
    for (const staff of staffList) {
      if (currentLevel !== staff.level) {
        currentLevel = staff.level;
        listContent += `\n**${levels[currentLevel] || "Bilinmiyor"}**\n`;
      }
      listContent += `• <@${staff.userId}>\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle("🛡️ EkoYıldız Yetkili Kadrosu")
      .setDescription(listContent)
      .setColor(0x2B2D31)
      .setTimestamp();

    const messages = await channel.messages.fetch({ limit: 10 });
    const existingMessage = messages.find(m => m.author.id === client.user.id);

    if (existingMessage) {
      await existingMessage.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }

  } catch (error) {
    console.error("[StaffAutomation] updateDynamicModList Error:", error);
  }
}

module.exports = {
  ADMIN_GUILD_ID,
  CHANNELS,
  ROBLOX,
  syncStaffRobloxRanks,
  sendAdminLog,
  ensureAdminGuildMembership,
  updateDynamicModList,
  syncStaffDiscordRoles
};
