const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

async function handleSelectInteraction(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith("reklam_package_select_")) {
    const { handlePurchaseSelection } = require("../services/reklamTicketService");
    return handlePurchaseSelection(interaction);
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

        const { calculateKpi } = require('../services/staffSystem');
        const kpiScore = calculateKpi(p);

        const BASE_SALARIES = {
          1: 50,
          2: 100,
          3: 150,
          4: 200,
          5: 300
        };

        const base = BASE_SALARIES[p.level] || 50;
        const salary = Math.floor(base * (kpiScore / 100));

        p.gamification = p.gamification || {};
        p.gamification.ecoCoins = (p.gamification.ecoCoins || 0) + salary;
        p.lastSalaryClaimedAt = new Date();
        await p.save();

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🪙 Maaş Ödemesi Gerçekleştirildi')
          .setDescription(
            `Sayın <@${interaction.user.id}>,\n\n` +
            `Haftalık aktiflik durumunuz ve KPI puanınız üst yönetim tarafından onaylandı. Maaşınız başarıyla hesabınıza yatırıldı!\n\n` +
            `• **Maaş Seviyesi (Rütbe Seviyesi):** Level ${p.level}\n` +
            `• **Performans Puanınız (KPI):** \`${kpiScore} / 100\`\n` +
            `• **Hesaba Aktarılan Tutar:** 🪙 **+${salary} EkoCoin**\n\n` +
            `• **Güncel Bakiyeniz:** 💳 \`${p.gamification.ecoCoins} E.C.\``
          )
          .setFooter({ text: 'Eko Yıldız • Finansal Yönetim Departmanı' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
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
          .setDescription('Sunucumuzda haftanın en yüksek tecrübe puanına (XP) ve aktifliğine sahip Top 5 yetkilisi listesi:')
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
          return `${emojis[idx]} <@${item.userId}> - **${item.xp} XP**\n` +
                 `   • *Rütbe:* ${roleName} | *Bakiye:* \`${item.coins} E.C.\``;
        }).join('\n\n');

        embed.addFields({ name: '📊 TOP 5 YETKİLİ', value: listText || 'Listelenecek yetkili bulunamadı.' });

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[Leaderboard] Hata:', err.message);
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
