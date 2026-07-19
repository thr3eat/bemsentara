'use strict';

const cron = require('node-cron');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');
const { broadcastToActiveStaff } = require('./notificationService');
const { GUILD_ID } = require('../../config');

const MANAGER_ID = '1492888195807969510';
const TERFI_LOG_CHANNEL = '1518693000270844079';

/**
 * Initializes cron jobs for weekly and monthly moderator selections
 * @param {import('discord.js').Client} client 
 */
function startModSelectionScheduler(client) {
  console.log('[modSelectionService] 📅 Haftalık ve Aylık Moderatör seçim zamanlayıcıları başlatıldı (cron)');

  // Haftalık seçim: Her Pazar saat 20:00 local time
  cron.schedule('0 20 * * 0', async () => {
    if (global.SPAM_STOPPED) {
      console.log('[modSelectionService] Cron execution skipped (global.SPAM_STOPPED is true)');
      return;
    }
    console.log('[modSelectionService] 🔔 Haftalık moderatör seçimi için yöneticiye bildirim gönderiliyor...');
    await sendModSelectionPrompt(client, 'weekly').catch(err => {
      console.error('[modSelectionService] Weekly cron error:', err.message);
    });
  });

  // Aylık seçim: Her ayın 1. günü saat 20:00 local time
  cron.schedule('0 20 1 * *', async () => {
    if (global.SPAM_STOPPED) {
      console.log('[modSelectionService] Cron execution skipped (global.SPAM_STOPPED is true)');
      return;
    }
    console.log('[modSelectionService] 🔔 Aylık moderatör seçimi için yöneticiye bildirim gönderiliyor...');
    await sendModSelectionPrompt(client, 'monthly').catch(err => {
      console.error('[modSelectionService] Monthly cron error:', err.message);
    });
  });
}

/**
 * Sends selection prompt menu to the manager
 * @param {import('discord.js').Client} client 
 * @param {'weekly'|'monthly'} type 
 * @param {import('discord.js').CommandInteraction|null} interaction 
 */
async function sendModSelectionPrompt(client, type, interaction = null) {
  try {
    const activeStaff = await StaffProgress.find({ status: 'active' });
    if (!activeStaff || activeStaff.length === 0) {
      const errorMsg = '❌ Personel sisteminde aktif hiçbir moderatör/yetkili bulunamadı.';
      if (interaction) {
        return interaction.editReply({ content: errorMsg });
      }
      return;
    }

    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    const memberMap = new Map();
    if (guild) {
      const memberIds = activeStaff.map(s => s.userId);
      const members = await guild.members.fetch({ user: memberIds }).catch(() => new Map());
      members.forEach(m => memberMap.set(m.id, m));
    }

    const candidateStaff = activeStaff
      .map(s => {
        const member = memberMap.get(s.userId);
        return {
          db: s,
          displayName: member ? member.displayName : `Yetkili (${s.userId})`,
          username: member ? member.user.username : `yetkili_${s.userId}`
        };
      })
      .sort((a, b) => (b.db.gamification?.currentXP || 0) - (a.db.gamification?.currentXP || 0))
      .slice(0, 25);

    if (candidateStaff.length === 0) {
      const errorMsg = '❌ Seçilebilecek yetkili bulunamadı.';
      if (interaction) {
        return interaction.editReply({ content: errorMsg });
      }
      return;
    }

    const options = candidateStaff.map(c => {
      const weeklySolved = c.db.weeklyStats?.ticketsSolved || 0;
      const weeklyVoice = c.db.weeklyStats?.voiceMinutes || 0;
      const xp = c.db.gamification?.currentXP || 0;
      return {
        label: c.displayName.substring(0, 100),
        value: c.db.userId,
        description: `Bilet: ${weeklySolved} | Ses: ${weeklyVoice} dk | XP: ${xp}`.substring(0, 100)
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`mod_select_dropdown_${type}`)
      .setPlaceholder('Lütfen bir moderatör seçin...')
      .addOptions(options);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const periodText = type === 'weekly' ? 'HAFTALIK' : 'AYLIK';
    const embed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle(`🏆 ${periodText} MODERATÖR SEÇİM PANELİ`)
      .setDescription(
        `Sayın Yönetici,\n\n` +
        `Sistemde en yüksek puana (XP) sahip aday yetkililer aşağıda listelenmiştir. Lütfen listeden dönemin **${periodText} Moderatörü** seçmek istediğiniz yetkiliyi seçin.\n\n` +
        `Seçim sonrasında performansı onaylayıp tüm ekibe duyurabilirsiniz.`
      )
      .setFooter({ text: 'Eko Yıldız • Yetkili Değerlendirme Departmanı' })
      .setTimestamp();

    if (interaction) {
      await interaction.editReply({ embeds: [embed], components: [selectRow] });
    } else {
      const managerUser = await client.users.fetch(MANAGER_ID).catch(() => null);
      if (managerUser) {
        await managerUser.send({ embeds: [embed], components: [selectRow] }).catch(err => {
          console.error(`[modSelectionService] DM to manager failed:`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('[modSelectionService] sendModSelectionPrompt error:', err.message);
    if (interaction) {
      await interaction.editReply({ content: `❌ Seçim paneli yüklenirken hata oluştu: ${err.message}` }).catch(() => {});
    }
  }
}

/**
 * Handles select interaction from the dropdown
 * @param {import('discord.js').StringSelectMenuInteraction} interaction 
 * @param {string} selectedUserId 
 * @param {'weekly'|'monthly'} type 
 */
async function handleSelectModerator(interaction, selectedUserId, type) {
  try {
    const targetProgress = await StaffProgress.findOne({ userId: selectedUserId });
    if (!targetProgress) {
      return interaction.reply({ content: '❌ Seçilen yetkilinin profili veritabanında bulunamadı.', ephemeral: true });
    }

    const guild = await interaction.client.guilds.fetch(GUILD_ID).catch(() => null);
    const member = guild ? await guild.members.fetch(selectedUserId).catch(() => null) : null;
    const displayName = member ? member.displayName : `Yetkili (${selectedUserId})`;

    const weeklySolved = targetProgress.weeklyStats?.ticketsSolved || 0;
    const weeklyVoice = targetProgress.weeklyStats?.voiceMinutes || 0;
    const weeklyMod = targetProgress.weeklyStats?.moderationActions || 0;

    const totalSolved = targetProgress.stats?.ticketsSolved || 0;
    const totalVoice = targetProgress.stats?.totalVoiceMinutes || 0;
    const totalMsg = targetProgress.stats?.chatMessages || 0;
    const activeDays = targetProgress.stats?.activeDays || 0;

    const xp = targetProgress.gamification?.currentXP || 0;
    const coins = targetProgress.gamification?.ecoCoins || 0;
    const level = targetProgress.level || 1;

    const commendCount = targetProgress.disciplinary?.commendations?.length || 0;
    const warnCount = targetProgress.disciplinary?.warns?.length || 0;

    const periodText = type === 'weekly' ? 'Haftalık' : 'Aylık';

    const detailEmbed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`📊 Mod Adayı Detaylı Performans Raporu`)
      .setDescription(
        `Aşağıda **<@${selectedUserId}>** (${displayName}) adlı yetkilimizin detaylı performans ve sistem verileri yer almaktadır.`
      )
      .addFields(
        { name: '👤 Genel Bilgiler', value: `• **Seviye/Rütbe:** Seviye ${level}\n• **Toplam Puan:** \`${xp} Elmas (💎)\`\n• **Cüzdan Bakiyesi:** \`${coins} TL\`\n• **Aktif Gün Sayısı:** \`${activeDays} Gün\``, inline: true },
        { name: '📈 Dönemlik/Haftalık Performans', value: `• **Sesli Aktiflik:** \`${weeklyVoice} dk\`\n• **Bilet (Ticket) Çözümü:** \`${weeklySolved} adet\`\n• **Moderasyon İşlemleri:** \`${weeklyMod} adet\``, inline: true },
        { name: '📊 Kümülatif Toplamlar', value: `• **Toplam Mesaj:** \`${totalMsg} adet\`\n• **Toplam Bilet:** \`${totalSolved} adet\`\n• **Toplam Ses:** \`${Math.round(totalVoice)} dk\``, inline: true },
        { name: '🛡️ Disiplin & Takdir Durumu', value: `• **Teşekkür/Takdir Belgesi:** \`${commendCount} Adet\`\n• **Disiplin Uyarısı:** \`${warnCount} Adet\``, inline: false }
      )
      .setFooter({ text: `Seçtiğiniz takdirde yetkili ${periodText} lider ilan edilecek ve duyurulacaktır.` })
      .setTimestamp();

    const confirmButton = new ButtonBuilder()
      .setCustomId(`mod_confirm_${type}_${selectedUserId}`)
      .setLabel(type === 'weekly' ? '🏆 Haftanın Moderatörü Yap' : '👑 Ayın Moderatörü Yap')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId(`mod_confirm_cancel_${type}`)
      .setLabel('❌ İptal Et / Geri Dön')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.update({ embeds: [detailEmbed], components: [row] });
  } catch (err) {
    console.error('[modSelectionService] handleSelectModerator error:', err.message);
    await interaction.reply({ content: `❌ Hata oluştu: ${err.message}`, ephemeral: true }).catch(() => {});
  }
}

/**
 * Confirms moderator selection, gives rewards and broadcasts details to all moderators
 * @param {import('discord.js').ButtonInteraction} interaction 
 * @param {string} targetUserId 
 * @param {'weekly'|'monthly'} type 
 */
async function confirmModeratorSelection(interaction, targetUserId, type) {
  try {
    await interaction.deferUpdate();

    const targetProgress = await StaffProgress.findOne({ userId: targetUserId });
    if (!targetProgress) {
      return interaction.followUp({ content: '❌ Yetkilinin profili veritabanında bulunamadı.', ephemeral: true });
    }

    const client = interaction.client;
    const rewardCoins = type === 'weekly' ? 100 : 250;

    targetProgress.gamification = targetProgress.gamification || {};
    targetProgress.gamification.ecoCoins = (targetProgress.gamification.ecoCoins || 0) + rewardCoins;
    await targetProgress.save();

    // Get top 5 active staff based on XP for the ranking list
    const allActive = await StaffProgress.find({ status: 'active' });
    const sorted = allActive
      .sort((a, b) => (b.gamification?.currentXP || 0) - (a.gamification?.currentXP || 0)) // Sort by XP descending
      .slice(0, 5);

    const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    const rankingLines = [];
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      rankingLines.push(`${emojis[i]} <@${s.userId}> - **${s.gamification?.currentXP || 0} XP**`);
    }
    const rankingText = rankingLines.join('\n') || 'Sıralanacak yetkili bulunamadı.';

    const periodLabel = type === 'weekly' ? 'HAFTANIN' : 'AYIN';
    const messageHeader = type === 'weekly' 
      ? 'BU HAFTANIN SIRALAMASI VE YÖNETİCİ TARAFINDAN SEÇİLEN SIRALAMA!'
      : 'BU AYIN SIRALAMASI VE YÖNETİCİ TARAFINDAN SEÇİLEN SIRALAMA!';

    // Broadcast DM to all active moderators
    const sentCount = await broadcastToActiveStaff(client, async (staffMember) => {
      return {
        emoji: '🏆',
        title: `${periodLabel} LİDER YETKİLİ SEÇİMİ`,
        body: `### 📣 ${messageHeader}\n\n` +
              `Yönetici tarafından yapılan değerlendirmeler sonucunda dönemin **${type === 'weekly' ? 'Haftalık Lideri' : 'Aylık Lideri'}** ilan edilmiştir!\n\n` +
              `🏆 **Lider Yetkili:** <@${targetUserId}>\n` +
              `🎁 **Hak Ediş Ödülü:** **+${rewardCoins} TL (EkoCoin)**\n\n` +
              `📊 **Dönem Sıralaması (Top 5):**\n${rankingText}\n\n` +
              `Örnek duruşu ve üstün gayretleri için kendisini tebrik eder, tüm ekibimize başarılar dileriz! 💚`
      };
    });

    // Log to Terfi Log channel
    const logEmbed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`🏆 ${messageHeader}`)
      .setDescription(
        `🏆 **Dönem Lider Yetkilisi:** <@${targetUserId}>\n` +
        `🎁 **Kazanılan Ödül:** \`+${rewardCoins} TL (EkoCoin)\`\n\n` +
        `📊 **Dönem Sıralaması (Top 5):**\n${rankingText}\n\n` +
        `Yönetici seçimiyle haftalık/aylık lider belirlenmiştir. Tebrik ederiz! 🎉`
      )
      .setFooter({ text: 'Eko Yıldız • Üst Yönetim Kurulu' })
      .setTimestamp();

    const adminLogChan = await client.channels.fetch(TERFI_LOG_CHANNEL).catch(() => null);
    if (adminLogChan && adminLogChan.isTextBased()) {
      await adminLogChan.send({ embeds: [logEmbed] }).catch(() => {});
    }

    // Success response to the manager
    await interaction.editReply({
      content: `✅ **Seçim İşlemi Başarıyla Tamamlandı!**\n\n` +
               `• **Seçilen:** <@${targetUserId}>\n` +
               `• **Ödül:** \`+${rewardCoins} EkoCoin\` cüzdana eklendi.\n` +
               `• **Duyuru:** ${sentCount} personele DM üzerinden ve terfi log kanalına başarıyla gönderildi.`,
      embeds: [],
      components: []
    });
  } catch (err) {
    console.error('[modSelectionService] confirmModeratorSelection error:', err.message);
    await interaction.followUp({ content: `❌ Seçim onaylanırken hata oluştu: ${err.message}`, ephemeral: true }).catch(() => {});
  }
}

module.exports = {
  startModSelectionScheduler,
  sendModSelectionPrompt,
  handleSelectModerator,
  confirmModeratorSelection
};
