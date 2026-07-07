const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

async function handleSelectInteraction(interaction) {
  const customId = interaction.customId;

  // ── Soruşturma Sistemi Ceza Seçimi ──────────────────────────────────────────
  if (customId.startsWith("invest_penalty_select_")) {
    const { PermissionFlagsBits } = require("discord.js");
    const channelId = customId.replace("invest_penalty_select_", "");
    const penaltyType = interaction.values[0];

    const Investigation = require("../../models/Investigation");
    const invest = await Investigation.findOne({ channelId });
    if (!invest) {
      return interaction.reply({ content: "❌ Soruşturma bulunamadı.", ephemeral: true });
    }

    if (interaction.user.id !== invest.judgeId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Bu kararı sadece soruşturmanın hakimi veya bir yönetici verebilir.", ephemeral: true });
    }

    if (penaltyType === 'CEZASIZ' || penaltyType === 'KICK') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const { resolveInvestigation } = require("../services/investigationService");
      await resolveInvestigation(interaction, channelId, penaltyType, "");
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`invest_penalty_detail_modal_${channelId}_${penaltyType}`)
      .setTitle("⚖️ Ceza Süresi Belirtin");

    let labelText = "Süre";
    let placeholderText = "Sayı olarak girin (Örn: 24)";
    if (penaltyType === 'MUTE') {
      labelText = "Mute Süresi (Saat Cinsinden)";
      placeholderText = "Kaç saat susturulacak? (Örn: 24)";
    } else if (penaltyType === 'BAN') {
      labelText = "Ban Süresi (Gün Cinsinden)";
      placeholderText = "Kaç gün yasaklanacak? (Örn: 7)";
    } else if (penaltyType === 'HAPIS') {
      labelText = "Hapis Süresi (Gün Cinsinden)";
      placeholderText = "Kaç gün hapse atılacak? (Örn: 3)";
    }

    const durationInput = new TextInputBuilder()
      .setCustomId("penalty_duration")
      .setLabel(labelText)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(placeholderText)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(durationInput));
    return interaction.showModal(modal);
  }

  // ── Sunucu Kurulum Asistanı Select Menüleri ──────────────────────────────
  if (customId.startsWith("setup_select_")) {
    const parts = customId.split("_");
    const targetType = parts[2]; // admin | verify | rules | edit | chef | chef_assistant
    
    let targetGuildId = "";
    let extraParam = ""; // rank in case of edit_role
    
    if (targetType === "edit") {
      const editType = parts[3]; // rank | role
      targetGuildId = parts[4];
      if (editType === "role") {
        extraParam = parts[5]; // rank value
      }
    } else if (targetType === "chef") {
      const isAssistant = parts[3] === "assistant";
      targetGuildId = isAssistant ? parts[4] : parts[3];
    } else {
      targetGuildId = parts[3];
    }

    const ServerSetup = require("../../models/ServerSetup");
    const setupDoc = await ServerSetup.findOne({ guildId: targetGuildId });
    if (!setupDoc) {
      return interaction.reply({ content: "❌ Kurulum verisi bulunamadı.", ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});

    if (targetType === "admin") {
      setupDoc.adminChannelId = interaction.values[0];
      await setupDoc.save();
      const { renderChannelSelectionPanel } = require("./buttonHandler");
      await renderChannelSelectionPanel(interaction, setupDoc);
      return;
    }

    if (targetType === "verify") {
      setupDoc.verifyHelpChannelId = interaction.values[0];
      await setupDoc.save();
      const { renderChannelSelectionPanel } = require("./buttonHandler");
      await renderChannelSelectionPanel(interaction, setupDoc);
      return;
    }

    if (targetType === "rules") {
      setupDoc.rulesChannelId = interaction.values[0];
      await setupDoc.save();
      const { renderChannelSelectionPanel } = require("./buttonHandler");
      await renderChannelSelectionPanel(interaction, setupDoc);
      return;
    }

    if (targetType === "edit") {
      const editType = parts[3]; // rank | role
      if (editType === "rank") {
        const selectedRank = interaction.values[0];
        const { ActionRowBuilder, RoleSelectMenuBuilder, EmbedBuilder } = require("discord.js");
        
        const embed = new EmbedBuilder()
          .setTitle(`🔧 Rol Eşleştirme - Rank ${selectedRank}`)
          .setColor(0xe74c3c)
          .setDescription(
            `Lütfen Roblox **Rank ${selectedRank}** rütbesiyle eşleştirmek istediğiniz Discord rolünü aşağıdaki menüden seçin.`
          )
          .setTimestamp();
          
        const roleMenu = new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`setup_select_edit_role_${setupDoc.guildId}_${selectedRank}`)
            .setPlaceholder("Discord Rollerinden Bir veya Birden Fazla Seçin...")
            .setMinValues(1)
            .setMaxValues(10)
        );
        
        await interaction.editReply({ embeds: [embed], components: [roleMenu] }).catch(() => {});
        return;
      }

      if (editType === "role") {
        const selectedRank = extraParam;
        const selectedRoleIds = interaction.values; // Array of selected role IDs
        
        if (!setupDoc.roleMappings) {
          setupDoc.roleMappings = new Map();
        }
        setupDoc.roleMappings.set(selectedRank, selectedRoleIds);
        await setupDoc.save();
        
        const { renderRoleCustomizationPanel } = require("./buttonHandler");
        await renderRoleCustomizationPanel(interaction, setupDoc);
        return;
      }
    }

    if (targetType === "chef") {
      const isAssistant = parts[3] === "assistant";
      if (isAssistant) {
        setupDoc.branchChefAssistant = interaction.values[0];
      } else {
        setupDoc.branchChef = interaction.values[0];
      }
      await setupDoc.save();
      
      const { renderChefsSelectionPanel } = require("./buttonHandler");
      await renderChefsSelectionPanel(interaction, setupDoc);
      return;
    }
  }

  // ── Central Branch Selection Dropdown ────────────────────────────────────
  if (customId === "setup_central_branch_select") {
    const selectedGuildId = interaction.values[0];
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
    const modal = new ModalBuilder()
      .setCustomId(`setup_branch_modal_${selectedGuildId}`)
      .setTitle("👑 Branş Yöneticilerini Güncelle");

    const ServerSetup = require("../../models/ServerSetup");
    const setupDoc = await ServerSetup.findOne({ guildId: selectedGuildId });

    const chefInput = new TextInputBuilder()
      .setCustomId("branch_chef_input")
      .setLabel("Branş Şefi Discord Kullanıcı Adı veya ID")
      .setPlaceholder("Örn: Alp 33 veya 1031620522406072350")
      .setValue(setupDoc?.branchChef || "")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const assistantInput = new TextInputBuilder()
      .setCustomId("branch_chef_assistant_input")
      .setLabel("Branş Şef Yardımcısı Discord Kullanıcı Adı veya ID")
      .setPlaceholder("Örn: Sentara veya 1228088674206617621")
      .setValue(setupDoc?.branchChefAssistant || "")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(chefInput),
      new ActionRowBuilder().addComponents(assistantInput)
    );

    await interaction.showModal(modal).catch(() => {});
    return;
  }

  if (interaction.customId.startsWith('panel_')) {
    const { handlePanelSelect } = require("../services/mainPanelService");
    return handlePanelSelect(interaction);
  }

  if (interaction.customId === "select_daily_task") {
    const selectedTask = interaction.values[0];
    const { CHOSEN_TASKS, checkChosenTaskCompletion, getOrCreate } = require("../services/staffSystem");

    const p = await getOrCreate(interaction.user.id, interaction.guildId, interaction.client);
    if (!p || p.status !== 'active') {
      return interaction.reply({ content: '❌ Aktif personel kaydınız bulunamadı.', ephemeral: true });
    }

    const StaffUnit = require("../../models/StaffUnit");
    const userUnit = await StaffUnit.findOne({ userId: interaction.user.id });
    if (userUnit && userUnit.unitName) {
      let allowed = false;
      if (userUnit.unitName === 'BAN_BIRIMI' && (selectedTask === 'task_ticket' || selectedTask === 'task_mod')) allowed = true;
      if (userUnit.unitName === 'SES_BIRIMI' && selectedTask === 'task_voice') allowed = true;
      if (userUnit.unitName === 'SOHBET_BIRIMI' && selectedTask === 'task_chat') allowed = true;
      if (!allowed) {
        return interaction.reply({ content: '❌ Bulunduğunuz birim dışındaki bir görevi seçemezsiniz!', ephemeral: true });
      }
    }

    if (p.daily.chosenTaskCompleted) {
      return interaction.reply({ content: '❌ Bugünün seçimli görevini zaten tamamladınız! Yeni görev seçemezsiniz.', ephemeral: true });
    }

    p.daily.chosenTask = selectedTask;
    await p.save();

    const taskText = CHOSEN_TASKS[selectedTask] || selectedTask;
    await interaction.reply({
      content: `🎯 Bugünün seçimli görevi başarıyla **"${taskText}"** olarak güncellendi!`,
      ephemeral: true
    });

    const client = interaction.client;
    await checkChosenTaskCompletion(p, client).catch(() => {});
    return;
  }

  if (interaction.customId !== "support_category" && interaction.customId !== "tmt_support_category" && interaction.customId !== "ekoyildiz_support_category") return null;

  const category = interaction.values[0];
  const isTMT = interaction.customId === "tmt_support_category";
  const isEko = interaction.customId === "ekoyildiz_support_category";

  // Kategori bazlı başlık ve placeholder
  const categoryTitles = {
    ban:       'Ban / Şikayet Talebi',
    reklam:    'Reklam Satın Al',
    report:    'Kullanıcı Şikayet',
    billing:   'Ödeme Sorunu',
    technical: 'Teknik Sorun',
    account:   'Hesap Sorunu',
    genel:     'Genel Destek',
    other:     'Diğer Konu',
    // TMT Categories
    discord:   'Discord Destek',
    game:      'Oyun Destek',
    // EkoYildiz Categories
    kullanici_destek: 'Kullanıcı Destek',
    reklam_destek:    'Reklam Destek',
    diger_destek:     'Diğer Destek',
  };
  const categoryDescHints = {
    ban:       'Kimi şikayet ediyorsunuz? (kullanıcı adı/ID)',
    reklam:    'Reklamını yapmak istediğiniz konu nedir?',
    report:    'Hangi kullanıcıyı şikayet ediyorsunuz?',
    billing:   'Ödeme sorununuzu açıklayın',
    technical: 'Teknik sorununuzu açıklayın',
    account:   'Hesap sorununuzu açıklayın',
    genel:     'Sorunuzu veya talebinizi yazın',
    other:     'Konunuzu açıklayın',
    // TMT Categories
    discord:   'Discord ile ilgili sorununuzu açıklayın',
    game:      'Oyun içindeki sorununuzu açıklayın',
    // EkoYildiz Categories
    kullanici_destek: 'Kimi ve neden şikayet ediyorsunuz?',
    reklam_destek:    'Reklam talebinizi açıklayın',
    diger_destek:     'Talebinizi açıklayın',
  };

  const title = categoryTitles[category] || 'Destek Talebi';
  const descHint = categoryDescHints[category] || 'Sorununuzu açıklayın';

  let modalCustomId = `support_modal_${category}`;
  if (isTMT) modalCustomId = `tmt_support_modal_${category}`;
  else if (isEko) modalCustomId = `ekoyildiz_support_modal_${category}`;

  const modal = new ModalBuilder()
    .setCustomId(modalCustomId)
    .setTitle(`🎫 ${title}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("support_subject")
        .setLabel("Konu Başlığı")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Örn: ${title} hakkında`)
        .setRequired(true)
        .setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("support_description")
        .setLabel("Açıklama")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(descHint)
        .setRequired(true)
        .setMaxLength(1000)
    )
  );

  return interaction.showModal(modal);
}

module.exports = { handleSelectInteraction };
