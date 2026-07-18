const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require("discord.js");

async function handleSelectInteraction(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith("reklam_package_select_")) {
    const { handlePurchaseSelection } = require("../services/reklamTicketService");
    return handlePurchaseSelection(interaction);
  }

  // ── Panel hızlı menü (home) seçimi
  if (customId === 'panel_home_select') {
    const selected = interaction.values[0];
    await interaction.deferUpdate().catch(() => {});
    const { renderPanel } = require('../services/mainPanelService');
    return renderPanel(interaction, selected);
  }

  if (customId.startsWith("eposta_remove_select_")) {
    const ticketId = interaction.customId.replace("eposta_remove_select_", "");
    const targetUserId = interaction.values[0];

    await interaction.reply({ content: "⏳ Katılımcı görüşmeden çıkartılıyor...", ephemeral: true });

    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.followUp({ content: "❌ Hata: Destek talebi bulunamadı.", ephemeral: true });

    try {
      const guild = await interaction.client.guilds.fetch(ticket.guildId);
      
      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
      if (targetUser) {
        const userChanName = `eposta-${targetUser.username.toLowerCase()}`;
        const channels = await guild.channels.fetch();
        const chanToDelete = channels.find(c => c.name === userChanName && c.parentId === guild.channels.cache.get(ticket.channelId)?.parentId);
        
        if (chanToDelete) {
          await chanToDelete.delete(`Kullanıcı görüşmeden çıkarıldı.`).catch(() => {});
        }

        if (ticket.additionalChannels) {
          const idx = ticket.additionalUsers.indexOf(targetUserId);
          if (idx !== -1) {
            const chanId = ticket.additionalChannels[idx];
            if (chanId) {
              const ch = await guild.channels.fetch(chanId).catch(() => null);
              if (ch) await ch.delete("Kullanıcı görüşmeden çıkarıldı").catch(() => {});
            }
          }
        }
      }

      if (ticket.additionalUsers) {
        ticket.additionalUsers = ticket.additionalUsers.filter(id => id !== targetUserId);
      }
      if (ticket.additionalChannels) {
        const idx = ticket.additionalUsers.indexOf(targetUserId);
        if (idx !== -1) {
          ticket.additionalChannels.splice(idx, 1);
        }
      }
      await ticket.save();

      if (ticket.userChannelId) {
        const mainChan = await guild.channels.fetch(ticket.userChannelId).catch(() => null);
        if (mainChan) await mainChan.send(`➖ <@${targetUserId}> görüşmeden çıkarıldı.`);
      }
      const modChan = await guild.channels.fetch(ticket.channelId).catch(() => null);
      if (modChan) await modChan.send(`➖ <@${targetUserId}> görüşmeden çıkarıldı.`);

      return interaction.followUp({ content: `✅ <@${targetUserId}> başarıyla görüşmeden çıkarıldı.`, ephemeral: true });

    } catch (err) {
      console.error("[eposta_remove_select] Error:", err.message);
      return interaction.followUp({ content: `❌ Hata: ${err.message}`, ephemeral: true });
    }
  }

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

  // ── Kişisel İşlemler Seçim Menüsü ──────────────────────────────────────────
  if (interaction.customId === 'staff_personal_actions') {
    const action = interaction.values[0];
    
    if (action === 'staff_action_use_leave') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const { useLeaveCredit } = require('../services/staffSystem');
        const result = await useLeaveCredit(interaction.user.id);
        if (!result.success) return interaction.editReply({ content: `❌ ${result.message}` });
        return interaction.editReply({ content: `✅ **İzin krediniz kullanıldı!** Bugünü başarıyla pas geçtiniz (görevleriniz yapılmış sayıldı).\n📅 **Kalan İzin Krediniz:** ${result.creditsRemaining}` });
      } catch (err) {
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_leave_status') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const { getLeaveStatus } = require('../services/staffSystem');
        const status = await getLeaveStatus(interaction.user.id);
        if (!status) return interaction.editReply({ content: "❌ İzin durumunuz çekilemedi veya sisteme kayıtlı değilsiniz." });

        const embed = new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle(`📅 İzin Durumu — ${interaction.user.username}`)
          .addFields(
            { name: '🎟️ Birikmiş İzin Kredisi (Ticket Ödülü)', value: `**${status.totalCredits}** gün`, inline: false },
            { name: '📅 Bu Ay Kullanılan İzin', value: `**${status.monthlyUsed}** gün`, inline: true },
            { name: '📅 Bu Ay Kalan İzin', value: `**${status.monthlyRemaining}** gün`, inline: true },
            { name: '📅 Bu Hafta Kullanılan İzin', value: `**${status.weeklyUsed}** / 1 gün`, inline: false },
            { name: '📋 İzinli Günler', value: status.usedDays.length > 0 ? status.usedDays.map(d => `• ${d}`).join('\n') : 'Henüz izin kullanılmamış.', inline: false }
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_finance_center') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const StaffProgress = require('../../models/StaffProgress');
        const p = await StaffProgress.findOne({ userId: interaction.user.id });
        if (!p) return interaction.editReply({ content: '❌ Yetkili kaydınız bulunamadı.' });

        const wallet = p.gamification?.ecoCoins || 0;
        const savings = p.savingsFund || 0;
        const loan = p.loanAmount || 0;

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('💳 Kurumsal Kredi & Finans Merkezi')
          .setDescription(
            `Sayın Yetkili,\n\n` +
            `Kurumsal Finans ve Kredi sistemine hoş geldiniz. Aşağıdaki bakiye bilgileriniz doğrultusunda işlemlerinizi yapabilirsiniz.\n\n` +
            `💵 **Cüzdan Bakiyesi:** \`${wallet} TL\`\n` +
            `📈 **Yatırım Fonu Bakiyesi:** \`${savings} TL\`\n` +
            `📉 **Aktif Avans Borcu:** \`${loan} TL\``
          )
          .setFooter({ text: 'Eko Yıldız Finansal Yönetim' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('finance_invest_trigger').setLabel('📈 Yatırım Fonuna TL Yatır').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('finance_buy_leave').setLabel('🍃 İzin Kredisi Al (100 TL)').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('finance_loan_request').setLabel('🤝 Maaş Avansı Çek (150 TL)').setStyle(ButtonStyle.Success)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_malpractice') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const StaffProgress = require('../../models/StaffProgress');
        const MalpracticeCase = require('../../models/MalpracticeCase');

        const p = await StaffProgress.findOne({ userId: interaction.user.id });
        if (!p) return interaction.editReply({ content: '❌ Yetkili kaydınız bulunamadı.' });

        const activeCase = await MalpracticeCase.findOne({ targetUserId: interaction.user.id, status: 'pending' });

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        if (!activeCase) {
          const insActive = p.insuranceActive || false;
          const insEmbed = new EmbedBuilder()
            .setColor(0x34495e)
            .setTitle('⚖️ Mahkeme & Sorumluluk Sigortası')
            .setDescription(
              `Şu an aktif bir mahkeme (görevi kötüye kullanma) dosyanız bulunmamaktadır.\n\n` +
              `🛡️ **Mesleki Sorumluluk Sigortası Durumu:** ${insActive ? '🟢 **AKTİF**' : '🔴 **PASİF**'}\n\n` +
              `*Sigortanız aktif olduğunda, gelecekteki mahkeme davalarında alacağınız cezalar ve tazminatlar sigorta tarafından karşılanır. Sigortanız yoksa cezalar doğrudan haftalık hak edişinizden kesilir.*`
            )
            .setTimestamp();

          const components = [];
          if (!insActive) {
            components.push(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('malpractice_buy_insurance')
                  .setLabel('🛡️ Sigorta Satın Al (100 TL)')
                  .setStyle(ButtonStyle.Success)
              )
            );
          }

          return interaction.editReply({ embeds: [insEmbed], components });
        }

        // Active case exists
        const caseEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle(`⚖️ Aktif Malpractice Davası - #${activeCase.caseId}`)
          .setDescription(
            `Hakkınızda görevi kötüye kullanma iddiasıyla açılmış aktif bir soruşturma/dava mevcuttur.\n\n` +
            `📝 **Gerekçe / Suçlama:** \`\`\`${activeCase.reason}\`\`\`\n` +
            `💰 **Talep Edilen Tazminat:** \`${activeCase.fineAmount} TL\`\n` +
            `🛡️ **Sigorta Koruması:** ${p.insuranceActive ? '🟢 Var (Cezayı sigorta karşılar)' : '🔴 Yok (Cezayı cepten ödersiniz)'}\n\n` +
            `Dilerseniz avukat savunması verip davayı mahkemeye taşıyabilir ya da **%20 indirimle uzlaşabilirsiniz (Settle)**.`
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`malpractice_defense_btn_${activeCase.caseId}`)
            .setLabel('⚖️ Avukat Savunması Ver (Modal)')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`malpractice_settle_btn_${activeCase.caseId}`)
            .setLabel('🤝 %20 İndirimle Uzlaş (Settle)')
            .setStyle(ButtonStyle.Success)
        );

        return interaction.editReply({ embeds: [caseEmbed], components: [row] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_whistleblower') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const AnonymousReport = require('../../models/AnonymousReport');
        const active = await AnonymousReport.findOne({ realUserId: interaction.user.id }).sort({ createdAt: -1 });
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        if (active && active.threadId) {
          // User already has an active report: show close button instead of submit modal
          const embed = new (require('discord.js').EmbedBuilder)()
            .setColor(0xe67e22)
            .setTitle(`🤫 Aktif İhbarınız Bulundu — #${active.reportId}`)
            .setDescription(`Siz zaten bir aktif ihbar raporu göndermişsiniz. Eğer artık bu raporu kapatmak istiyorsanız "İhbarını Kapat" butonuna basın.`)
            .addFields(
              { name: 'Konu', value: active.subject || '—', inline: true },
              { name: 'Oluşturulma', value: active.createdAt ? new Date(active.createdAt).toLocaleString() : '—', inline: true }
            )
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`whistle_close_${active.reportId}`)
              .setLabel('🗑️ İhbarını Kapat')
              .setStyle(ButtonStyle.Danger)
          );

          return interaction.editReply({ embeds: [embed], components: [row] });
        }

        // No active report: show submit modal
        const modal = new ModalBuilder()
          .setCustomId('modal_whistle_submit')
          .setTitle('🤫 Anonim İhbar Hattı (SHA-256)');

        const subjectInput = new TextInputBuilder()
          .setCustomId('whistle_subject')
          .setLabel('İhbar Konusu')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Örn: Kural ihlali veya yetkili suistimali')
          .setRequired(true);

        const detailsInput = new TextInputBuilder()
          .setCustomId('whistle_details')
          .setLabel('İhbar Detayları')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Lütfen ihbarınızın tüm detaylarını buraya yazınız. Kimliğiniz şifrelenecektir.')
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(subjectInput),
          new ActionRowBuilder().addComponents(detailsInput)
        );

        await interaction.editReply({ content: '🔐 İhbar formu açılıyor...' });
        return interaction.showModal(modal).catch(() => {});
      } catch (err) {
        console.error('[Whistle-Action] Hata:', err.message);
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_redacted_ops') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const RedactedOp = require('../../models/RedactedOp');
        let activeOp = await RedactedOp.findOne({ targetUserId: interaction.user.id, intelReport: '' });

        if (!activeOp) {
          // Generate a new random spy mission
          const opId = `OP-${Math.floor(100 + Math.random() * 900)}`;
          const passcode = Math.floor(1000 + Math.random() * 9000).toString();
          activeOp = new RedactedOp({
            opId,
            targetUserId: interaction.user.id,
            passcode,
            details: "Bu görev sırasında rolleriniz geçici olarak gizlenecek ve gizli istihbarat faaliyetleri kapsamında belirlenen hedeflerin raporlanması istenecektir. Lütfen hiçbir kritik yönetim işlemi (yetki verme, kovma, sistem ayarı değişikliği vb.) gerçekleştirmeyin. Rapor gönderildiğinde rolleriniz otomatik olarak geri yüklenecektir."
          });
          await activeOp.save();
        }

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        if (!activeOp.decrypted) {
          const embed = new EmbedBuilder()
            .setColor(0x34495e)
            .setTitle(`🕵️ Redacted Ops - Gizli Teşkilat Emri (#${activeOp.opId})`)
            .setDescription(
              `Sayın Ajan,\n\n` +
              `Size atanmış şifreli bir istihbarat görevi bulunuyor. Görevin detaylarını görüntülemek için aşağıdaki "Gizli Emri Çöz" butonuna basıp size verilen passcode'u kullanın.\n\n` +
              `⚠️ **DİKKAT:** Görev aktifleştiğinde rolleriniz gizlenecek ve bazı yönetim yetkileriniz kısıtlanacaktır. Görev süresince kritik kişisel işlemler yapmayınız.\n\n` +
              `🔑 **Gizli Passcode'unuz:** \`${activeOp.passcode}\` *(Doğrulama amaçlı, lütfen kimseyle paylaşmayın.)*`
            )
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`redacted_decrypt_trigger_${activeOp.opId}`)
              .setLabel('🕵️ Gizli Emri Çöz')
              .setStyle(ButtonStyle.Danger)
          );

          return interaction.editReply({ embeds: [embed], components: [row] });
        } else {
          // Decrypted but report not submitted
          const embed = new EmbedBuilder()
            .setColor(0x34495e)
            .setTitle(`🕵️ Redacted Ops - Aktif Görev Masası (#${activeOp.opId})`)
            .setDescription(
              `**GÖREV DETAYLARI:**\n` +
              `\`\`\`${activeOp.details}\`\`\`\n` +
              `*Ajan yetkileriniz aktif durumdadır (rolleriniz gizlenmiştir). Görevi tamamlamak ve eski rollerinizi geri yüklemek için lütfen aşağıdaki butondan gizli istihbarat raporunu gönderin.*`
            )
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`redacted_report_trigger_${activeOp.opId}`)
              .setLabel('📋 İstihbarat Raporu Gönder')
              .setStyle(ButtonStyle.Success)
          );

          return interaction.editReply({ embeds: [embed], components: [row] });
        }
      } catch (err) {
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_grid_control') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const StaffProgress = require('../../models/StaffProgress');
        const p = await StaffProgress.findOne({ userId: interaction.user.id });
        if (!p) return interaction.editReply({ content: '❌ Yetkili kaydınız bulunamadı.' });

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const sector = p.currentSector || null;

        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('🗺️ Izgara Kontrol Merkezi (Grid Control)')
          .setDescription(
            `Sayın Yetkili,\n\n` +
            `Güvenlik Izgarası kapsamında sunucunun aktif devriye durumunu buradan yönetebilirsiniz.\n\n` +
            `🗺️ **Mevcut Sektörünüz:** ${sector ? `\`${sector}\` (Devriyedesiniz)` : '🔴 **Bölge Atanmadı (Devriye Dışı)**'}\n\n` +
            `*Eğer devriyedeyseniz, bölgeye ulaştığınızı bildirmek için [🛬 Sektöre Ulaştım] butonuna tıklayabilirsiniz. Bölgeye ulaştığınızda canlı log akışı DMinize yönlendirilecektir.*`
          )
          .setTimestamp();

        const row = new ActionRowBuilder();
        if (!sector) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId('grid_request_sector')
              .setLabel('📡 Sektör Devriyesi Talep Et')
              .setStyle(ButtonStyle.Primary)
          );
        } else {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId('grid_arrive_sector')
              .setLabel('🛬 Sektöre Ulaştım')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('grid_clear_sector')
              .setLabel('🛑 Devriyeyi Bitir / Bölge Temiz')
              .setStyle(ButtonStyle.Danger)
          );
        }

        return interaction.editReply({ embeds: [embed], components: [row] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_internal_affairs') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const StaffProgress = require('../../models/StaffProgress');
        const p = await StaffProgress.findOne({ userId: interaction.user.id });
        if (!p) return interaction.editReply({ content: '❌ Yetkili kaydınız bulunamadı.' });

        const isAuthorized = p.isInspector || p.level >= 6;
        if (!isAuthorized) {
          return interaction.editReply({ content: '❌ Bu masaya yalnızca atanmış Müfettişler ve En Yüksek Rütbe (Level 6) yetkililer erişebilir!' });
        }

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const embed = new EmbedBuilder()
          .setColor(0x7f8c8d)
          .setTitle('🕵️‍♂️ İç Denetim Departmanı (Internal Affairs Unit)')
          .setDescription(
            `Sayın Müfettiş,\n\n` +
            `İç denetim ve personel şeffaflığı kapsamında sunucudaki yetkililerin aktiflik dürüstlüğünü denetleyebilirsiniz.\n\n` +
            `🔍 **Ghosting Taraması (Sızma):** Ses kanallarında uzun süre kalıp sıfır aksiyon (bilet/mod eylemi) alan yetkilileri tespit ederek suiistimal raporları oluşturur.`
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ia_start_ghosting_scan')
            .setLabel('🔍 Ghosting Taraması Başlat (Sızma)')
            .setStyle(ButtonStyle.Danger)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_risk_compliance') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const ServerConfig = require('../../models/ServerConfig');
        let sConf = await ServerConfig.findOne({ guildId: interaction.guildId });
        if (!sConf) {
          sConf = new ServerConfig({ guildId: interaction.guildId });
          await sConf.save();
        }

        const karantina = sConf.karantinaActive || false;
        const apiSpeed = sConf.apiSpeedLimitActive || false;
        const ohal = sConf.isOhalActive || false;

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('⚙️ Global Risk & Karantina Kontrol Paneli')
          .setDescription(
            `Sayın Yönetici,\n\n` +
            `Sunucu güvenliğini ve sistem stabilitesini sağlamak adına küresel risk mekanizmalarını buradan yönetebilirsiniz.\n\n` +
            `🚨 **Karantina Modu (Self-Shutdown):** ${karantina ? '🔴 **AKTİF (Tüm komutlar kilitli)**' : '🟢 **DEAKTİF (Normal akış)**'}\n` +
            `⚡ **API Hız Limiti Yavaşlatıcı (%50):** ${apiSpeed ? '🔴 **YAVAŞ (%50 Hız Sınırı)**' : '🟢 **NORMAL (Tam hız)**'}\n` +
            `🔥 **Olağanüstü Hal (OHAL) Vardiyası:** ${ohal ? '🔴 **AKTİF (2.5x Kriz Primi)**' : '🟢 **DEAKTİF (Normal akış)**'}`
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('risk_toggle_karantina')
            .setLabel('🚨 Karantina (Self-Shutdown)')
            .setStyle(karantina ? ButtonStyle.Success : ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('risk_toggle_api_speed')
            .setLabel('⏳ API Limiti (%50)')
            .setStyle(apiSpeed ? ButtonStyle.Success : ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('risk_toggle_ohal')
            .setLabel('🔥 OHAL Kriz Vardiyası')
            .setStyle(ohal ? ButtonStyle.Success : ButtonStyle.Danger)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_practice_scenario') {
      const SCENARIOS = [
        {
          id: 1,
          title: "Provokatif Üye Vakası",
          description: "Bir kullanıcı sunucuda kimseye küfür veya hakaret etmiyor, fakat sürekli olarak diğer üyelerin inançları ve hassasiyetleriyle dalga geçerek onları kışkırtıyor. Sohbet aşırı derecede gerildi. Bu durumda ne yaparsınız ve hangi kurala göre işlem tesis edersiniz?"
        },
        {
          id: 2,
          title: "Gizli Reklam / DM Reklam Vakası",
          description: "Bir üyenin diğer üyelere DM üzerinden başka bir Discord sunucusunun linkini göndererek reklam yaptığına dair 2 farklı üyeden ekran görüntülü şikayet aldınız. Şüpheli üye ise suçlamaları reddediyor. Nasıl hareket edersiniz?"
        },
        {
          id: 3,
          title: "Yetkili Etiketleme ve Spam",
          description: "Bir kullanıcı çözülmeyen bir sorunu olduğunu söyleyerek genel sohbette arka arkaya 10 kez Kurucuları ve Moderatörleri etiketledi (ping spam). Uyarılmasına rağmen devam ediyor. Hangi cezai işlemi uygularsınız?"
        },
        {
          id: 4,
          title: "Bilet (Ticket) Suistimali",
          description: "Bir üye destek biletini açıp içeriye sadece anlamsız harfler (random) yazarak destek ekibini oyalıyor. Bileti kapattığınızda yeni bir bilet açıp aynı şeyi yapmaya devam ediyor. Bu kullanıcıya karşı nasıl bir yaptırım uygularsınız?"
        },
        {
          id: 5,
          title: "Kanıtı Olmayan Toxic Davranış İddiası",
          description: "Ses kanalında bir yetkilinin kendisine haksız yere bağırdığını ve hakaret ettiğini iddia eden bir üye size ulaştı, ancak elinde herhangi bir ses kaydı veya ekran görüntüsü yok. Bu şikayeti nasıl değerlendirirsiniz?"
        }
      ];

      const selected = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      
      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle(`🎓 AI Pratik Senaryosu: ${selected.title}`)
        .setDescription(
          `**Durum / Senaryo:**\n> *"${selected.description}"*\n\n` +
          `**Nasıl Çalışır?**\n` +
          `Aşağıdaki **\`✍️ Çözüm Yaz\`** butonuna tıklayarak bu duruma karşı alacağınız aksiyonu, kararınızı ve gerekçenizi yazın. AI Koçunuz çözümünüzü puanlayıp size tavsiyelerde bulunacaktır!`
        )
        .setFooter({ text: 'Eko Yıldız • AI Eğitim Akademisi' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`staff_practice_solve_${selected.id}`)
          .setLabel('✍️ Çözüm Yaz')
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (action === 'staff_action_claim_salary') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const StaffProgress = require('../../models/StaffProgress');
        const p = await StaffProgress.findOne({ userId: interaction.user.id });
        if (!p) return interaction.editReply({ content: '❌ Personel kaydınız bulunamadı.' });

        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        if (p.lastSalaryClaimedAt && (Date.now() - new Date(p.lastSalaryClaimedAt).getTime() < ONE_WEEK_MS)) {
          const diffMs = ONE_WEEK_MS - (Date.now() - new Date(p.lastSalaryClaimedAt).getTime());
          const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
          const diffHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          return interaction.editReply({
            content: `⚠️ **Maaşınızı zaten bu hafta aldınız!**\nBir sonraki maaş hak edişinize: **${diffDays} gün ${diffHours} saat** var.`
          });
        }

        const voiceMinutes = p.weeklyStats?.voiceMinutes || 0;
        const ticketsSolved = p.weeklyStats?.ticketsSolved || 0;
        const moderationActions = p.weeklyStats?.moderationActions || 0;
        
        // V0.7 Ekonomik Denge Çarpanı (0.7x)
        const baseVoice = Math.floor(voiceMinutes * 1 * 0.7);
        const baseTickets = Math.floor(ticketsSolved * 10 * 0.7);
        const baseMod = Math.floor(moderationActions * 5 * 0.7);
        const gross = baseVoice + baseTickets + baseMod;

        if (gross <= 0) {
          return interaction.editReply({
            content: '⚠️ **Bu hafta hiç aktifliğiniz (ses süresi, çözülen ticket veya mod işlemi) bulunmamaktadır.** Maaş hak edişiniz: **0 TL**.'
          });
        }

        const lastClaimDate = p.lastSalaryClaimedAt || new Date(0);
        const warnsThisWeek = p.disciplinary?.warns?.filter(w => {
          const wDate = w.date ? new Date(w.date) : (w.createdAt ? new Date(w.createdAt) : null);
          return wDate && wDate > lastClaimDate;
        }) || [];
        
        const hasWarning = warnsThisWeek.length > 0;
        const disciplinaryDeduction = hasWarning ? Math.floor(gross * 0.15) : 0;
        const taxDeduction = Math.floor(gross * 0.10);
        let netPay = Math.max(0, gross - disciplinaryDeduction - taxDeduction);

        let loanDeducted = 0;
        if (p.loanAmount && p.loanAmount > 0) {
          loanDeducted = Math.min(netPay, p.loanAmount);
          netPay -= loanDeducted;
        }

        const embed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle('💼 Eko Yıldız Resmi Haftalık Maaş Bordrosu (v0.7)')
          .setDescription(
            `Sayın <@${interaction.user.id}>,\n\n` +
            `Haftalık aktiflik durumunuz ve v0.7 ekonomik dengeli performans dökümünüz aşağıdadır. Ödemenizi cüzdana aktarmak için lütfen alttaki butona tıklayın.\n\n` +
            `**📋 MAAŞ DETAYLARI VE KESİNTİLER (v0.7 - 0.7x Çarpanı)**\n` +
            `\`\`\`diff\n` +
            `+ Seste Kalma: ${voiceMinutes} dk x 0.7 TL = +${baseVoice} TL\n` +
            `+ Çözülen Bilet: ${ticketsSolved} adet x 7.0 TL = +${baseTickets} TL\n` +
            `+ Mod İşlemleri: ${moderationActions} adet x 3.5 TL = +${baseMod} TL\n` +
            `-----------------------------------------------\n` +
            `+ Brüt Hak Ediş: ${gross} TL\n` +
            `- Disiplin Kesintisi (%15): -${disciplinaryDeduction} TL ${hasWarning ? '((!) Disiplin Uyarısı Alındı)' : '(0 Uyarı)'}\n` +
            `- Gelir Vergisi Kesintisi (%10): -${taxDeduction} TL\n` +
            (loanDeducted > 0 ? `- Maaş Avansı Kesintisi: -${loanDeducted} TL (Kalan Avans Borcu: ${p.loanAmount - loanDeducted} TL)\n` : '') +
            `-----------------------------------------------\n` +
            `+ Net Ödenecek Maaş: ${netPay} TL\n` +
            `\`\`\`\n` +
            `• **Mevcut Yetkili Cüzdan Bakiyesi:** 💳 \`${p.gamification?.ecoCoins || 0} TL\``
          )
          .setFooter({ text: 'Eko Yıldız • Finansal Yönetim Departmanı | Sürüm: v0.7' })
          .setTimestamp();

        const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('staff_claim_salary_transfer')
            .setLabel('💰 Net Maaşı Cüzdana Aktar')
            .setStyle(ButtonStyle.Success)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      } catch (err) {
        console.error('[Salary-Claim] Hata:', err.message);
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_leaderboard') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const StaffProgress = require('../../models/StaffProgress');
        const allProgress = await StaffProgress.find({ status: 'active' });
        
        const sorted = allProgress
          .map(doc => {
            const xp = doc.gamification?.currentXP || 0;
            const coins = doc.gamification?.ecoCoins || 0;
            const level = doc.level || 1;
            return {
              userId: doc.userId,
              xp,
              coins,
              level,
              rawDoc: doc
            };
          })
          .sort((a, b) => b.xp - a.xp)
          .slice(0, 5);

        const embed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle('🏆 Eko Yıldız Haftalık Yetkili Liderlik Tablosu')
          .setDescription('Sunucumuzda haftanın en yüksek Elmas (💎) puanına ve aktifliğine sahip Top 5 yetkilisi listesi:')
          .setFooter({ text: 'Eko Yıldız • Yetkili Rekabet Sistemi' })
          .setTimestamp();

        const ROLE_NAMES = {
          1: '📋 Stajyer / Deneme Mod',
          2: '🛡️ Moderatör',
          3: '⚔️ Baş Moderatör / Supervisor',
          4: '🛡️ Yönetici / Co-Admin',
          5: '👑 Yönetici Kurul'
        };

        const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const listText = sorted.map((item, idx) => {
          const roleName = ROLE_NAMES[item.level] || 'Yetkili';
          return `${emojis[idx]} <@${item.userId}> - **${item.xp} Elmas (💎)**\n` +
                 `   • *Rütbe:* ${roleName} | *Bakiye:* \`${item.coins} TL\``;
        }).join('\n\n');

        embed.addFields({ name: '📊 TOP 5 YETKİLİ', value: listText || 'Listelenecek yetkili bulunamadı.' });

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[Leaderboard] Hata:', err.message);
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_emergency_alarm') {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId('modal_emergency_alarm')
        .setTitle('🚨 Acil Durum / Baskın Alarmı');

      const input = new TextInputBuilder()
        .setCustomId('emergency_reason')
        .setLabel('Acil Durum Nedeni ve Detayları')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Örn: Genel sohbette bypass reklam spamı başladı! Acil müdahale ve kanal kilitleme gerekiyor!')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal).catch(() => {});
    }

    if (action === 'staff_action_ai_performance_card') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const StaffProgress = require('../../models/StaffProgress');
        const p = await StaffProgress.findOne({ userId: interaction.user.id });
        if (!p) return interaction.editReply({ content: '❌ Personel kaydınız bulunamadı.' });

        const { chatWithAI } = require('../services/staffSystem');
        const { calculateKpi, getKpiGrade } = require('../services/staffDutyService');
        const kpiScore = calculateKpi(p);
        const kpiGrade = getKpiGrade(kpiScore);

        const warnsCount = p.disciplinary?.warns?.length || 0;
        const commsCount = p.disciplinary?.commendations?.length || 0;

        let displayName = interaction.user.username;
        try {
          const u = await interaction.client.users.fetch(p.userId).catch(() => null);
          if (u) displayName = u.globalName || u.username;
        } catch (_) {}

        const ROLE_NAMES = {
          1: 'Stajyer / Deneme Mod',
          2: 'Moderatör',
          3: 'Baş Moderatör / Supervisor',
          4: 'Yönetici / Co-Admin',
          5: 'Yönetici Kurul'
        };

        const roleName = ROLE_NAMES[p.level] || 'Yetkili';

        const prompt = `Aşağıdaki yetkilinin haftalık performans bilgilerini incele ve ona samimi, objektif ve profesyonel bir mentor gibi değerlendirme karnesi hazırla.
- Yetkili İsmi: ${displayName}
- Mevcut Rütbe: ${roleName} (Seviye ${p.level})
- KPI Performans Skoru: ${kpiScore}/100 (${kpiGrade.label})
- Toplam Takdir Belgesi: ${commsCount} adet
- Toplam Disiplin Uyarısı: ${warnsCount} adet
- Yaşadığı Şehir: ${p.city || 'Belirtilmemiş'}
- Son Nöbet Aktifliği: Ses: ${p.duty?.sessionVoiceMinutes || 0} dk, Bilet: ${p.duty?.sessionTicketsSolved || 0} adet

Lütfen yetkiliye hitaben, karnesini takdim eden resmi bir AI Eğitim Mentoru diliyle:
1. Genel durumunu özetleyen bir değerlendirme notu yaz.
2. Yetkilinin güçlü yönlerini (varsa takdirleri veya yüksek KPI) takdir et.
3. Geliştirmesi gereken yönler hakkında somut tavsiyeler ver.
4. En sona "AI Mentor Değerlendirme Derecesi" olarak bir harf notu (A+, A, B, C, D veya F) ekle.`;

        const aiResponse = await chatWithAI([{ role: 'user', content: prompt }], "Sen EkoYıldız Yetkili Akademisi AI Baş Mentorüsün.").catch(() => 'Karne raporu şu anda hazırlanamıyor.');
        const cleanedResponse = aiResponse?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 'Karne oluşturulamadı.';

        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`🧠 AI Haftalık Performans Karnesi`)
          .setAuthor({ name: displayName, iconURL: interaction.user.displayAvatarURL() })
          .setDescription(cleanedResponse)
          .addFields(
            { name: '📊 Performans Skoru', value: `\`${kpiScore}/100\` (${kpiGrade.label})`, inline: true },
            { name: '🎖️ Sicil Kaydı', value: `💚 \`${commsCount} Takdir\` | ⚠️ \`${warnsCount} Uyarı\``, inline: true }
          )
          .setFooter({ text: 'Eko Yıldız • AI Mentorluk Servisi' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[AI-Performance-Card] Hata:', err.message);
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_resign') {
      const modal = new ModalBuilder()
        .setCustomId('modal_staff_resign')
        .setTitle('🚪 İstifa Başvurusu');

      const input = new TextInputBuilder()
        .setCustomId('resign_reason')
        .setLabel('İstifa Gerekçeniz')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Lütfen istifa etme nedeninizi detaylı şekilde yazınız.')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal).catch(() => {});
    }

    if (action === 'staff_action_retire') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const { retireFromStaff } = require('../services/staffSystem');
        const result = await retireFromStaff(interaction.user.id, interaction.client);
        if (!result.success) return interaction.editReply({ content: `❌ ${result.message}` });
        return interaction.editReply({ content: `🏅 **Tebrikler!** ${result.totalDays} gün aktif hizmetin sonrasında emekli oldun! Son görevin: ${result.levelName}` });
      } catch (err) {
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_talk_to_coach') {
      const { startCoachSession } = require('../services/staffCoach');
      return startCoachSession(interaction);
    }
  }

  // ── Yetkili Yönetim İşlemleri Seçim Menüsü ─────────────────────────────────
  if (interaction.customId === 'staff_manager_actions') {
    const action = interaction.values[0];

    const { PermissionFlagsBits } = require('discord.js');
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: '❌ Bu menüyü kullanabilmek için üyeleri denetleme yetkiniz olmalıdır.', ephemeral: true });
    }

    // 2FA Security Check (exempting Tactical Desk itself)
    if (action !== 'staff_action_tactical_desk') {
      const StaffProgress = require('../../models/StaffProgress');
      const p = await StaffProgress.findOne({ userId: interaction.user.id });
      if (!p) return interaction.reply({ content: '❌ Personel kaydınız bulunamadı.', ephemeral: true });

      const hasClearance = p.securityClearanceUntil && new Date(p.securityClearanceUntil) > new Date();
      if (!hasClearance) {
        const codesPool = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", "INDIA"];
        const shuffled = codesPool.sort(() => 0.5 - Math.random());
        const chosen = shuffled.slice(0, 3);
        const correctCode = chosen[Math.floor(Math.random() * 3)];

        await interaction.reply({ content: '🔐 **Güvenlik Geçişi Gerekli!** Bu kritik işlemi gerçekleştirebilmek için DM kutunuza gönderilen iki faktörlü personel doğrulamasını tamamlayınız.', ephemeral: true }).catch(() => {});

        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🛡️ GEÇİCİ GÜVENLİK YETKİSİ (SECURITY CLEARANCE)')
            .setDescription(
              `Sayın Yetkili,\n\n` +
              `Kritik bir yönetim eylemi tetiklediniz. İşlemin size ait olduğunu doğrulamak için lütfen **KOD ${correctCode}** butonuna tıklayınız.\n\n` +
              `*Yanlış koda tıklanması durumunda yetkisiz erişim logu tutulacak ve KPI puanınız düşürülecektir. 60 saniye süreniz vardır.*`
            )
            .setFooter({ text: 'Eko Yıldız • Güvenlik Departmanı' })
            .setTimestamp();

          const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`staff_2fa_${chosen[0]}_${correctCode}_${interaction.user.id}`).setLabel(`🔓 Kod ${chosen[0]}`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`staff_2fa_${chosen[1]}_${correctCode}_${interaction.user.id}`).setLabel(`🔓 Kod ${chosen[1]}`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`staff_2fa_${chosen[2]}_${correctCode}_${interaction.user.id}`).setLabel(`🔓 Kod ${chosen[2]}`).setStyle(ButtonStyle.Primary)
          );

          await interaction.user.send({ embeds: [dmEmbed], components: [row] });
        } catch (dmErr) {
          console.warn(`[Staff-2FA] DM failed to ${interaction.user.id}:`, dmErr.message);
        }
        return;
      }
    }

    if (action === 'staff_action_tactical_desk') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const StaffProgress = require('../../models/StaffProgress');
        const activeStaff = await StaffProgress.find({ status: 'active' });
        
        const onDuty = activeStaff.filter(s => s.duty?.isActive && !s.duty?.isBreakActive);
        const onBreak = activeStaff.filter(s => s.duty?.isActive && s.duty?.isBreakActive);
        const idle = activeStaff.filter(s => !s.duty?.isActive);

        const onDutyMentions = onDuty.map(s => `<@${s.userId}>`).join(', ') || 'Yok';
        const onBreakMentions = onBreak.map(s => `<@${s.userId}>`).join(', ') || 'Yok';
        const idleCount = idle.length;

        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('📡 Taktik Komuta ve Operasyon Masası (Canlı)')
          .setDescription('Sunucu genelindeki yetkili kadrosunun anlık aktiflik durumları ve komuta konsolu.')
          .addFields(
            { name: `🟢 Aktif Nöbette (${onDuty.length} Yetkili)`, value: onDutyMentions, inline: false },
            { name: `🟡 Kahve Molasında (${onBreak.length} Yetkili)`, value: onBreakMentions, inline: false },
            { name: `🔴 Nöbette Değil / Serbest`, value: `Toplam **${idleCount}** yetkili serbest zamanda.`, inline: false }
          )
          .setFooter({ text: 'Taktik Komuta Konsolu' })
          .setTimestamp();

        const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('tactical_alarm_all')
            .setLabel('🚨 Tüm Ekibi Nöbete Çağır')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('tactical_announce_leader')
            .setLabel('📊 Haftalık Lideri İlan Et')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('tactical_change_radio')
            .setLabel('📋 Telsiz Frekansı Değiştir')
            .setStyle(ButtonStyle.Primary)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      } catch (err) {
        console.error('[Tactical-Desk] Hata:', err.message);
        return interaction.editReply({ content: `❌ Hata: ${err.message}` });
      }
    }

    if (action === 'staff_action_warn') {
      const modal = new ModalBuilder()
        .setCustomId('modal_staff_warn')
        .setTitle('⚠️ Disiplin Uyarısı Ver');

      const userInput = new TextInputBuilder()
        .setCustomId('warn_user_id')
        .setLabel('Kullanıcı ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Uyarılacak yetkilinin Discord ID\'si')
        .setRequired(true);

      const reasonInput = new TextInputBuilder()
        .setCustomId('warn_reason')
        .setLabel('Uyarı Gerekçesi')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Lütfen uyarı nedenini yazınız.')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );
      return interaction.showModal(modal).catch(() => {});
    }

    if (action === 'staff_action_commend') {
      const modal = new ModalBuilder()
        .setCustomId('modal_staff_commend')
        .setTitle('💚 Teşekkür / Takdir Belgesi Ver');

      const userInput = new TextInputBuilder()
        .setCustomId('commend_user_id')
        .setLabel('Kullanıcı ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Takdir edilecek yetkilinin Discord ID\'si')
        .setRequired(true);

      const reasonInput = new TextInputBuilder()
        .setCustomId('commend_reason')
        .setLabel('Takdir Gerekçesi')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Lütfen teşekkür nedenini yazınız.')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );
      return interaction.showModal(modal).catch(() => {});
    }

    if (action === 'staff_action_sicil') {
      const modal = new ModalBuilder()
        .setCustomId('modal_staff_sicil')
        .setTitle('📋 Personel Sicili Sorgula');

      const userInput = new TextInputBuilder()
        .setCustomId('sicil_user_id')
        .setLabel('Kullanıcı ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Sorgulanacak yetkilinin Discord ID\'si')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      return interaction.showModal(modal).catch(() => {});
    }

    if (action === 'staff_action_dismiss') {
      const modal = new ModalBuilder()
        .setCustomId('modal_staff_dismiss')
        .setTitle('🚪 Personel İlişiğini Kes (Kov)');

      const userInput = new TextInputBuilder()
        .setCustomId('dismiss_user_id')
        .setLabel('Kullanıcı ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('İlişiği kesilecek yetkilinin Discord ID\'si')
        .setRequired(true);

      const reasonInput = new TextInputBuilder()
        .setCustomId('dismiss_reason')
        .setLabel('Kovma / Çıkarma Gerekçesi')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Lütfen çıkarma gerekçesini yazınız.')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );
      return interaction.showModal(modal).catch(() => {});
    }

    if (action === 'staff_action_set_stats') {
      const modal = new ModalBuilder()
        .setCustomId('modal_staff_set_stats')
        .setTitle('📈 Yetkili İstatistiklerini Ayarla');

      const userInput = new TextInputBuilder()
        .setCustomId('stats_user_id')
        .setLabel('Kullanıcı ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Düzenlenecek yetkilinin Discord ID\'si')
        .setRequired(true);

      const paramInput = new TextInputBuilder()
        .setCustomId('stats_parameter')
        .setLabel('Parametre (tickets / messages / voice)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Girebileceğiniz değer: tickets veya messages veya voice')
        .setRequired(true);

      const valInput = new TextInputBuilder()
        .setCustomId('stats_value')
        .setLabel('Yeni Sayısal Değer')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Yeni değer (örn: 50)')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(paramInput),
        new ActionRowBuilder().addComponents(valInput)
      );
      return interaction.showModal(modal).catch(() => {});
    }
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
      if (userUnit.unitName === 'SOHBET_BIRIMI' && (selectedTask === 'task_chat' || selectedTask === 'task_word_game' || selectedTask === 'task_bom_game' || selectedTask === 'task_chat_with_people')) allowed = true;
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

  if (isEko && category === "reklam_destek") {
    const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    const mailEmbed = new EmbedBuilder()
      .setTitle("📨 E-POSTA ALICISI: Eko Yıldız Reklam Departmanı")
      .setDescription(
        "**Reklam Destek Hizmetlerine Hoş Geldiniz!**\n\n" +
        "Sanki yeni bir e-posta yazıyormuş gibi aşağıdaki butona tıklayarak Reklam Talep Formu'nu doldurun.\n\n" +
        "📝 **Sistem Durumu:** Çevrimiçi\n" +
        "👤 **Departman Sorumlusu:** Emre (Müşteri İlişkileri)"
      )
      .setColor(0x3498DB)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ekoyildiz_reklam_form_button")
        .setLabel("Yeni Reklam Talebi")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("📨")
    );

    return interaction.reply({ embeds: [mailEmbed], components: [row], ephemeral: true });
  }

  if (isEko && (category === "kullanici_destek" || category === "diger_destek")) {
    const { handleEpostaSupportSelect } = require("../services/epostaTicketService");
    return handleEpostaSupportSelect(interaction, category);
  }

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
