const axios = require("axios");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const User = require("../../models/User");

const ALLIED_GUILD_ID = "1483482948320891074";
const ALLIED_VERIFY_HELP_CHANNEL_ID = "1514676210368778331";
const ALLIED_MOD_LOG_CHANNEL_ID = "1483483290160726182";

const GROUP_PREFIXES = {
  "35898429": "TTC",
  "35431216": "EKO",
  "35757415": "CTE",
  "17241052": "TFD",
  "11517908": "TMT",
  "33499704": "TMA",
  "8505535": "BEM"
};

const ROLE_IDS = {
  OWNER: "1483483224175935580", // Grup Sahipleri
  "BEM_MEMBER": "1483483246925709473",
  "TMT_MEMBER": "1483483247924219964",
  "TMA_MEMBER": "1483483248809214068",
  "TFD_MEMBER": "1483483250042212444",
  "EKO_MEMBER": "1483484167319851152",
  "CTE_MEMBER": "1483484174231929005",
  "TMA_ADMIN": "1483483234192068721",
  "TMT_ADMIN": "1483483235022405703",
  "TFD_ADMIN": "1483483236515450950",
  "EKO_ADMIN": "1483484304356020319",
  "CTE_ADMIN": "1483484310643150898",
  "BEM_ADMIN": "1483483238566592582",
  "CTE_MOD": "1483484335935062017",
  "EKO_MOD": "1483484477949743265",
  "TMT_MOD": "1483483244199678136", // TEAF Moderatör Ekibi
  "BEM_MOD": "1483483241343352913", // BTF Moderatör Ekibi
  "TMA_MOD": "1483483243322933358", // EEM Moderatör Ekibi? Or TMA?
  "TFD_MOD": "1483483242320494602"  // OİO Moderatör Ekibi? Or TFD?
};

async function fetchUserGroups(robloxId) {
  const response = await axios.get(
    `https://groups.roblox.com/v1/users/${robloxId}/groups/roles`,
    { timeout: 10000 }
  );
  return response.data.data || [];
}

async function syncAlliedRoles(client, discordUserId, robloxUserId, guild) {
  try {
    const member = await guild.members.fetch(discordUserId).catch(() => null);
    if (!member) return { success: false, error: "not_found", message: "Üye sunucuda bulunamadı" };

    const userGroups = await fetchUserGroups(robloxUserId);

    const rolesCache = Array.from(guild.roles.cache.values());
    const desiredRoleIds = new Set();
    const unresolved = [];

    for (const group of userGroups) {
      const groupId = String(group.group.id);
      const prefix = GROUP_PREFIXES[groupId];
      if (!prefix) continue;

      const rank = group.role.rank;

      // Tüm grupların 255'in bir altında rütbesi olanlara Grup Sahipleri
      if (rank === 254) {
        desiredRoleIds.add(ROLE_IDS.OWNER);
      }

      // Yönetim (200-253)
      if (rank >= 200 && rank < 254) {
        const hardcodedId = ROLE_IDS[`${prefix}_ADMIN`];
        const role = hardcodedId ? guild.roles.cache.get(hardcodedId) : rolesCache.find(r => r.name.toUpperCase().includes(prefix) && r.name.toLowerCase().includes("yönetim"));
        if (role) {
          desiredRoleIds.add(role.id);
        } else {
          unresolved.push(`${prefix} Yönetim`);
        }
      }

      // Moderatör Ekibi (100-199)
      if (rank >= 100 && rank < 200) {
        const hardcodedId = ROLE_IDS[`${prefix}_MOD`];
        const role = hardcodedId ? guild.roles.cache.get(hardcodedId) : rolesCache.find(r => r.name.toUpperCase().includes(prefix) && (r.name.toLowerCase().includes("moderatör") || r.name.toLowerCase().includes("mod")));
        if (role) {
          desiredRoleIds.add(role.id);
        } else {
          unresolved.push(`${prefix} Moderatör Ekibi`);
        }
      }

      // Üye (1-99)
      if (rank >= 1 && rank < 100) {
        const hardcodedId = ROLE_IDS[`${prefix}_MEMBER`];
        const role = hardcodedId ? guild.roles.cache.get(hardcodedId) : rolesCache.find(r => r.name.toUpperCase().includes(prefix) && (r.name.toLowerCase().includes("üye") || r.name.toLowerCase().includes("üyesi")));
        if (role) {
          desiredRoleIds.add(role.id);
        } else {
          unresolved.push(`${prefix} Üyesi`);
        }
      }
    }

    // Determine managed role IDs (to remove if user is not in that rank tier anymore)
    const managedIds = new Set();
    managedIds.add(ROLE_IDS.OWNER);
    for (const id of Object.values(ROLE_IDS)) {
      managedIds.add(id);
    }
    const prefixes = Object.values(GROUP_PREFIXES);
    for (const role of guild.roles.cache.values()) {
      const name = role.name;
      const hasPrefix = prefixes.some(p => name.toUpperCase().includes(p));
      const isSyncType = name.toLowerCase().includes("üye") || name.toLowerCase().includes("yönetim") || name.toLowerCase().includes("moderatör");
      if (hasPrefix && isSyncType) {
        managedIds.add(role.id);
      }
    }

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

    if (toAdd.length) await member.roles.add(toAdd, "Müttefik Sunucusu Rol Senkronizasyonu");
    if (toRemove.length) await member.roles.remove(toRemove, "Müttefik Sunucusu Rol Senkronizasyonu");

    // "Onaylanmış Hesap" rolü ver (ID: 1483483253720616971)
    // "Onaylanmamış Hesap" rolünü kaldır (ID: 1483483254576382103)
    const verifiedRole = guild.roles.cache.get("1483483253720616971");
    const unverifiedRole = guild.roles.cache.get("1483483254576382103");
    if (verifiedRole && !member.roles.cache.has(verifiedRole.id)) {
      await member.roles.add(verifiedRole, "Doğrulama başarılı");
    }
    if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
      await member.roles.remove(unverifiedRole, "Doğrulama başarılı");
    }

    // Update nickname to Roblox username if manageable
    const dbUser = await User.findOne({ discordId: discordUserId });
    const robloxUsername = dbUser?.robloxUsername;
    if (robloxUsername && member.manageable && member.nickname !== robloxUsername) {
      await member.setNickname(robloxUsername, "Müttefik Sunucusu Roblox Username Eşleme");
    }

    return {
      success: true,
      nickname: robloxUsername || member.displayName,
      added: toAdd,
      removed: toRemove,
      unresolved
    };
  } catch (err) {
    console.error("[alliedRoleSyncService] syncAlliedRoles error:", err);
    return { success: false, error: err.message };
  }
}

async function verifyAllAlliedRoles(client, specificUserIds = []) {
  try {
    const guild = await client.guilds.fetch(ALLIED_GUILD_ID).catch(() => null);
    if (!guild) return 0;

    let targetUsers = [];
    if (specificUserIds && specificUserIds.length > 0) {
      targetUsers = specificUserIds;
    } else {
      const dbUsers = await User.find({});
      targetUsers = dbUsers.map(u => u.discordId);
    }

    let count = 0;
    for (const discordId of targetUsers) {
      const dbUser = await User.findOne({ discordId });
      if (!dbUser || !dbUser.robloxId) continue;

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) continue;

      const result = await syncAlliedRoles(client, discordId, parseInt(dbUser.robloxId, 10), guild);
      if (result && result.success) {
        count++;
      }
    }
    return count;
  } catch (err) {
    console.error("[alliedRoleSyncService] verifyAllAlliedRoles error:", err);
    return 0;
  }
}

async function ensureAlliedVerifyHelpMessage(client) {
  try {
    const guild = await client.guilds.fetch(ALLIED_GUILD_ID).catch(() => null);
    if (!guild) return;

    const channel = await guild.channels.fetch(ALLIED_VERIFY_HELP_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
    const existing = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

    if (!existing) {
      const embed = new EmbedBuilder()
        .setTitle("🎖️ Müttefik Orduları Doğrulama Sistemi")
        .setDescription(
          "Roblox hesabınızı Discord hesabınıza bağlayarak sunucudaki müttefik grup rollerinizi otomatik olarak senkronize edebilirsiniz.\n\n" +
          "**Rol Kuralları:**\n" +
          "• **Üye (Rank 1-99):** Gruplara göre `{Grup Adı} Üyesi` rolü verilir.\n" +
          "• **Moderatör Ekibi (Rank 100-199):** `{Grup Adı} Moderatör Ekibi` rolü verilir.\n" +
          "• **Yönetim (Rank 200-253):** `{Grup Adı} Yönetim` rolü verilir.\n" +
          "• **Grup Sahipleri (Rank 254):** `Grup Sahipleri` rolü verilir."
        )
        .setColor(0x00FF7F)
        .addFields(
          {
            name: "📋 Doğrulama Adımları",
            value:
              "1. `/authorize` komutunu çalıştırın ve Roblox hesabınızı bağlayın.\n" +
              "2. Ardından aşağıdaki **Rolleri Senkronize Et** butonuna veya `/verify` komutuna tıklayın.",
            inline: false,
          }
        )
        .setFooter({ text: "Sentara Doğrulama ve Entegrasyon Sistemi" })
        .setTimestamp();

      const authorizeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("authorize_button")
          .setLabel("🔐 Hesabımı Yetkilendir")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("verify_button")
          .setLabel("🔄 Rollerimi Senkronize Et")
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ embeds: [embed], components: [authorizeButton] });
      console.log("✅ Müttefik sunucusu doğrulama yardım mesajı gönderildi");
    }
  } catch (error) {
    console.error("❌ Müttefik sunucusu doğrulama yardım mesajı hatası:", error);
  }
}

async function ensureAlliedSupportMessage(client) {
  try {
    const guild = await client.guilds.fetch(ALLIED_GUILD_ID).catch(() => null);
    if (!guild) return;

    const channel = await guild.channels.fetch("1483483309454524518").catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
    const existing = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

    if (!existing) {
      const embed = new EmbedBuilder()
        .setTitle("🎫 Müttefik Orduları Destek Sistemi")
        .setDescription(
          "Lütfen aşağıdan bir destek kategorisi seçerek destek talebi (ticket) oluşturun.\n\n" +
          "**Kategoriler:**\n" +
          "• **📚 Discord Destek:** Sunucu sorunları, yetkili şikayetleri ve yardım talepleri.\n" +
          "• **💂🏻 Oyun Destek:** Roblox oyun içi sorunlar, rütbe ve ödeme şikayetleri."
        )
        .setColor(0x00FF7F)
        .setFooter({ text: "Sentara Destek Sistemi" });

      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("tmt_support_category")
          .setPlaceholder("Destek kategorisi seçin...")
          .addOptions(
            {
              label: "📚 Discord Destek",
              value: "discord",
              description: "Discord sunucusu ile ilgili sorunlar",
              emoji: "📚"
            },
            {
              label: "💂🏻 Oyun Destek",
              value: "game",
              description: "Roblox oyun içi sorunlar",
              emoji: "💂🏻"
            }
          )
      );

      await channel.send({ embeds: [embed], components: [menu] });
      console.log("✅ Müttefik sunucusu destek sistemi mesajı gönderildi");
    }
  } catch (error) {
    console.error("❌ Müttefik sunucusu destek sistemi hatası:", error);
  }
}

async function logAlliedModAction(interaction, commandName, targetUser, details) {
  try {
    const guild = interaction.guild;
    const channel = await guild.channels.fetch(ALLIED_MOD_LOG_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isSendable()) return;

    const actionNames = {
      mesaj_sil: "🗑️ Mesajlar Silindi",
      sustur: "🔇 Kullanıcı Susturuldu",
      susturma_kaldir: "🔊 Susturma Kaldırıldı",
      yasakla: "🚫 Kullanıcı Yasaklandı",
      yasaklama_kaldir: "✅ Yasaklama Kaldırıldı"
    };

    const embed = new EmbedBuilder()
      .setTitle(actionNames[commandName] || `Moderasyon Eylemi: ${commandName}`)
      .setColor(commandName.includes("kaldir") || commandName === "yasaklama_kaldir" ? 0x4ade80 : 0xed4245)
      .addFields(
        { name: "Yetkili", value: `${interaction.user.toString()}\n\`${interaction.user.id}\``, inline: true }
      )
      .setTimestamp();

    if (targetUser) {
      embed.addFields({ name: "Hedef Kullanıcı", value: `${targetUser.toString()}\n\`${targetUser.id}\``, inline: true });
    }

    if (details) {
      embed.addFields({ name: "Detaylar", value: details, inline: false });
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[alliedRoleSyncService] logAlliedModAction error:", err);
  }
}

module.exports = {
  ALLIED_GUILD_ID,
  syncAlliedRoles,
  verifyAllAlliedRoles,
  ensureAlliedVerifyHelpMessage,
  ensureAlliedSupportMessage,
  logAlliedModAction
};
