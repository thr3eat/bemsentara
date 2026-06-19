const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const RollCall = require("../../models/RollCall");
const StaffProgress = require("../../models/StaffProgress");

const ROLL_CALL_CHANNEL_ID = "1466940856102551704"; // Moderatör ekibi sayım kanalı

/**
 * Yeni bir yoklama (sayım) başlatır.
 */
async function startRollCall(client, interaction) {
  try {
    const channel = await client.channels.fetch(ROLL_CALL_CHANNEL_ID).catch(() => null);
    if (!channel) return interaction.editReply("❌ Yoklama kanalı bulunamadı!");

    // Daha önce aktif olan bir yoklama var mı kontrol et
    const existing = await RollCall.findOne({ status: 'active' });
    if (existing) {
      return interaction.editReply("❌ Şu anda zaten devam eden bir yoklama mevcut!");
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 3); // 3 gün sonra biter

    const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const monthStr = `${aylar[endDate.getMonth()]} ${endDate.getFullYear()}`;

    const embed = new EmbedBuilder()
      .setTitle(`📋 ${monthStr} Personel Sayımı`)
      .setDescription(`Tüm yetkililerin dikkatine!\n\nBu aylık personel sayımıdır. Ekipteki aktifliğinizi teyit etmek için lütfen aşağıdaki butona tıklayarak **Buradayım** bildirimi yapınız.\n\n⏳ **Son Katılım:** <t:${Math.floor(endDate.getTime() / 1000)}:R>\n\n*(Süresi içerisinde butona tıklamayanlar "Yok" yazılacak ve gerekli işlemler yapılacaktır!)*`)
      .setColor(0x3498DB)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_rollcall_here')
        .setLabel('Buradayım')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✋')
    );

    const msg = await channel.send({ content: "@everyone", embeds: [embed], components: [row] });

    const newRc = new RollCall({
      messageId: msg.id,
      channelId: channel.id,
      endDate: endDate,
      month: monthStr,
      status: 'active'
    });
    await newRc.save();

    return interaction.editReply("✅ Yeni personel sayımı başarıyla başlatıldı ve kanala gönderildi.");
  } catch (err) {
    console.error("[RollCallService] Start error:", err);
    return interaction.editReply("❌ Sayım başlatılırken bir hata oluştu.");
  }
}

/**
 * Mevcut yoklamayı bitirir ve rapor çıkarır.
 */
async function endRollCall(client, interaction) {
  try {
    const activeRc = await RollCall.findOne({ status: 'active' });
    if (!activeRc) {
      if (interaction) return interaction.editReply("❌ Şu anda devam eden bir yoklama bulunmuyor!");
      return;
    }

    activeRc.status = 'completed';
    await activeRc.save();

    // Mesajı güncelleip butonu kapat
    const channel = await client.channels.fetch(activeRc.channelId).catch(() => null);
    if (channel) {
      const msg = await channel.messages.fetch(activeRc.messageId).catch(() => null);
      if (msg) {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('btn_rollcall_here_disabled')
            .setLabel('Sayım Sona Erdi')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛑')
            .setDisabled(true)
        );
        await msg.edit({ components: [disabledRow] }).catch(() => {});
      }
    }

    // Katılan ve Katılmayan listesi oluştur
    // Veritabanındaki tüm personelleri bul
    const allStaff = await StaffProgress.find({});
    
    const katilanlar = [];
    const katilmayanlar = [];

    for (const staff of allStaff) {
      if (activeRc.participants.includes(staff.userId)) {
        katilanlar.push(`<@${staff.userId}>`);
      } else {
        katilmayanlar.push(`<@${staff.userId}>`);
      }
    }

    const reportEmbed = new EmbedBuilder()
      .setTitle(`📊 ${activeRc.month} Sayım Sonuçları`)
      .setDescription(`**Toplam Personel:** ${allStaff.length}\n**Katılanlar:** ${katilanlar.length}\n**Katılmayanlar:** ${katilmayanlar.length}`)
      .setColor(0xE67E22);

    if (katilmayanlar.length > 0) {
      // Discord embed field sınırı 1024 karakterdir. Eğer çok kişi yok yazıldıysa kırpmamız lazım
      let absentStr = katilmayanlar.join(", ");
      if (absentStr.length > 1000) absentStr = absentStr.substring(0, 1000) + "...";
      reportEmbed.addFields({ name: "❌ Katılmayan Personeller", value: absentStr });
    } else {
      reportEmbed.addFields({ name: "🎉 Tebrikler", value: "Tüm personeller sayıma katıldı!" });
    }

    if (channel) {
      await channel.send({ embeds: [reportEmbed] });
    }

    if (interaction) {
      return interaction.editReply("✅ Sayım başarıyla sonlandırıldı ve rapor kanala gönderildi.");
    }
  } catch (err) {
    console.error("[RollCallService] End error:", err);
    if (interaction) return interaction.editReply("❌ Sayım bitirilirken bir hata oluştu.");
  }
}

/**
 * Butona tıklayan personeli sayıma dahil eder.
 */
async function handleRollCallButton(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const activeRc = await RollCall.findOne({ status: 'active', messageId: interaction.message.id });
    if (!activeRc) {
      return interaction.editReply("❌ Bu sayım süresi dolmuş veya iptal edilmiş.");
    }

    // Personel sisteminde var mı?
    const staff = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!staff) {
      return interaction.editReply("❌ Yoklamaya sadece doğrulanmış EkoYıldız personelleri katılabilir!");
    }

    if (activeRc.participants.includes(interaction.user.id)) {
      return interaction.editReply("✅ Zaten sayıma katıldınız, teşekkürler!");
    }

    activeRc.participants.push(interaction.user.id);
    await activeRc.save();

    return interaction.editReply("✅ Sayıma başarıyla katıldınız!");
  } catch (err) {
    console.error("[RollCallService] Button error:", err);
    return interaction.editReply("❌ İşlem sırasında bir hata oluştu.");
  }
}

/**
 * Süresi dolmuş sayımları otomatik bitiren Cron-vari kontrol
 */
async function checkExpiredRollCalls(client) {
  try {
    const activeRc = await RollCall.findOne({ status: 'active' });
    if (activeRc) {
      const now = new Date();
      if (now > activeRc.endDate) {
        console.log(`[RollCallService] Süresi dolan sayım otomatik sonlandırılıyor...`);
        await endRollCall(client, null);
      }
    }
  } catch (err) {
    console.error("[RollCallService] Expire check error:", err);
  }
}

module.exports = {
  startRollCall,
  endRollCall,
  handleRollCallButton,
  checkExpiredRollCalls
};
