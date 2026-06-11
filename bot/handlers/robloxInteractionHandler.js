const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");
const noblox = require("noblox.js");
const { ROBLOX_GROUPS } = require("../services/robloxGroupManager");

/**
 * Gelişmiş güvenlik kontrolü.
 * Şu anlık sunucu yöneticisi (Administrator) olanların kullanımına açık.
 * İleride belirli roller (Ordu Yönetimi vb.) eklenebilir.
 */
function isUserAuthorized(member) {
  if (!member) return false;
  // Sadece Administrator yetkisi olanlar
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

async function handleRobloxInteractions(interaction) {
  // --- 1. GRUP SEÇİM MENÜSÜ ---
  if (interaction.isStringSelectMenu() && interaction.customId === "roblox_group_select") {
    if (!isUserAuthorized(interaction.member)) {
      return interaction.reply({ content: "❌ Bu menüyü kullanmak için yeterli yetkiniz (Yönetici) bulunmuyor.", ephemeral: true });
    }

    const selectedValue = interaction.values[0]; // rbx_grp_ID
    const groupId = selectedValue.replace("rbx_grp_", "");
    const groupName = ROBLOX_GROUPS[groupId] || "Bilinmeyen Grup";

    // Grup paneli oluştur
    const embed = new EmbedBuilder()
      .setTitle(`🏢 Seçilen Grup: ${groupName}`)
      .setDescription(`Aşağıdaki butonları kullanarak **${groupName}** (ID: \`${groupId}\`) grubunda işlemler yapabilirsiniz.\n\nLütfen işlem yapmadan önce "Rütbe Listesi" butonuna tıklayarak verebileceğiniz rütbe adlarını/ID'lerini kontrol edin.`)
      .setColor(0x3498DB)
      .setFooter({ text: "İşlemler Roblox API üzerinden anlık olarak gerçekleştirilir." });

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rbx_btn_ranks_${groupId}`)
        .setLabel("Rütbe Listesi")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📜"),
      new ButtonBuilder()
        .setCustomId(`rbx_btn_changerank_${groupId}`)
        .setLabel("Rütbe Değiştir")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🪖"),
      new ButtonBuilder()
        .setCustomId(`rbx_btn_accept_${groupId}`)
        .setLabel("İstek Kabul Et")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅"),
      new ButtonBuilder()
        .setCustomId(`rbx_btn_deny_${groupId}`)
        .setLabel("İstek Reddet")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌")
    );

    return interaction.reply({ embeds: [embed], components: [buttonsRow], ephemeral: true });
  }

  // --- 2. BUTONLAR ---
  if (interaction.isButton() && interaction.customId.startsWith("rbx_btn_")) {
    if (!isUserAuthorized(interaction.member)) {
      return interaction.reply({ content: "❌ Yetkiniz yok.", ephemeral: true });
    }

    const parts = interaction.customId.split("_");
    const action = parts[2]; // ranks, changerank, accept, deny
    const groupId = parts[3];
    const groupName = ROBLOX_GROUPS[groupId] || "Grup";

    if (action === "ranks") {
      await interaction.deferReply({ ephemeral: true });
      try {
        const roles = await noblox.getRoles(parseInt(groupId));

        const rolesText = roles.map(r => `• **${r.name}** (Rank ID: ${r.rank})`).join("\n");
        const embed = new EmbedBuilder()
          .setTitle(`📜 ${groupName} - Tüm Rütbeler`)
          .setDescription(`Gruptaki tüm rütbeler listelenmiştir:\n\n${rolesText}`)
          .setColor(0x2ECC71);
        
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Rütbeler çekilemedi: ${err.message}` });
      }
    }

    if (action === "changerank") {
      const modal = new ModalBuilder()
        .setCustomId(`rbx_mod_changerank_${groupId}`)
        .setTitle("🪖 Rütbe Değiştir");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("roblox_username")
            .setLabel("Roblox Kullanıcı Adı (Tam ve Doğru)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("roblox_newrank")
            .setLabel("Yeni Rütbe Numarası (Rank ID)")
            .setPlaceholder("Örn: 10, 50, 254 vb. (Rütbe Listesine bakın)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }

    if (action === "accept" || action === "deny") {
      const trAction = action === "accept" ? "Kabul Et" : "Reddet";
      const modal = new ModalBuilder()
        .setCustomId(`rbx_mod_${action}_${groupId}`)
        .setTitle(`${action === "accept" ? "✅" : "❌"} İsteği ${trAction}`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("roblox_username")
            .setLabel("İstek Atan Kullanıcı Adı")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal);
    }
  }

  // --- 3. MODALLAR (FORM GÖNDERİMİ) ---
  if (interaction.isModalSubmit() && interaction.customId.startsWith("rbx_mod_")) {
    if (!isUserAuthorized(interaction.member)) {
      return interaction.reply({ content: "❌ Yetkiniz yok.", ephemeral: true });
    }

    const parts = interaction.customId.split("_");
    const action = parts[2]; // changerank, accept, deny
    const groupId = parts[3];
    const username = interaction.fields.getTextInputValue("roblox_username").trim();

    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. Kullanıcı ID'sini bul
      const userId = await noblox.getIdFromUsername(username);
      if (!userId) {
        return interaction.editReply({ content: `❌ **${username}** adında bir Roblox kullanıcısı bulunamadı.` });
      }

      if (action === "changerank") {
        const newRankStr = interaction.fields.getTextInputValue("roblox_newrank").trim();
        const newRankId = parseInt(newRankStr);
        if (isNaN(newRankId)) return interaction.editReply({ content: "❌ Lütfen Rütbe ID'si olarak geçerli bir sayı girin." });

        // Güvenlik Sınırı (Roblox rank limits: 0-255)
        if (newRankId < 0 || newRankId > 255) {
          return interaction.editReply({ content: "❌ Geçersiz Rütbe ID: Rütbe ID'si 0 ile 255 arasında olmalıdır." });
        }

        const newRole = await noblox.setRank({ group: parseInt(groupId), target: userId, rank: newRankId });
        return interaction.editReply({ content: `✅ İşlem Başarılı!\n**${username}** kullanıcısının rütbesi başarıyla **${newRole.name}** yapıldı.` });
      }

      if (action === "accept" || action === "deny") {
        const isAccept = action === "accept";
        await noblox.handleJoinRequest(parseInt(groupId), userId, isAccept);
        return interaction.editReply({ content: `✅ İşlem Başarılı!\n**${username}** kullanıcısının gruba katılma isteği başarıyla **${isAccept ? "Onaylandı" : "Reddedildi"}**.` });
      }

    } catch (err) {
      console.error("[Roblox Interaction Error]", err);
      // Noblox gives nice error messages mostly
      return interaction.editReply({ content: `❌ Roblox API Hatası:\n\`${err.message}\`` });
    }
  }

  return null;
}

module.exports = { handleRobloxInteractions };
