'use strict';

const { EmbedBuilder } = require('discord.js');

/**
 * Kaldıraçlı işlem (leverage) servisi
 */

async function handleLeverageModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true }).catch(() => {});
  
  try {
    const StaffProgress = require('../../models/StaffProgress');
    const Ticket = require('../../models/Ticket');
    const { getMarketSnapshot } = require('./marketSystem');

    // Input alanlarını oku
    const amountStr = interaction.fields.getTextInputValue('leverage_amount').trim();
    const multiplierStr = interaction.fields.getTextInputValue('leverage_multiplier').trim();
    const typeStr = interaction.fields.getTextInputValue('leverage_type').trim().toUpperCase();

    // Parse inputs
    const amount = parseFloat(amountStr);
    const multiplier = parseFloat(multiplierStr);

    // Validasyon
    if (isNaN(amount) || amount < 1) {
      return interaction.editReply({ content: '❌ Geçersiz Tutarlandırma: Minimum 1 TL yatırım gereklidir.' });
    }

    if (isNaN(multiplier) || multiplier < 1 || multiplier > 10) {
      return interaction.editReply({ content: '❌ Geçersiz Kaldıraç Oranı: 1 ile 10 arasında bir değer girin.' });
    }

    if (typeStr !== 'YUK' && typeStr !== 'DÜS') {
      return interaction.editReply({ content: '❌ Geçersiz İşlem Türü: YUK (Yükseliş) veya DÜS (Düşüş) yazın.' });
    }

    // Personel kaydını al
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) {
      return interaction.editReply({ content: '❌ Kayıt bulunamadı.' });
    }

    // Gamification başlat
    p.gamification = p.gamification || {};

    // Bakiye kontrolü
    const wallet = p.gamification.ecoCoins || 0;
    if (wallet < amount) {
      return interaction.editReply({ 
        content: `❌ Yetersiz Bakiye!\n• Gerekli: ${amount} TL\n• Cüzdanınız: ${wallet} TL` 
      });
    }

    // Aktif borç kontrolü
    const loanAmount = p.loanAmount || 0;
    if (loanAmount > 0) {
      return interaction.editReply({
        content: `❌ Aktif Borç Var!\n• Borcunuz: ${loanAmount} TL\n• Önce borcunuzu ödeyin, sonra yeni işlem yapabilirsiniz.`
      });
    }

    // Pazar durumunu al
    const pendingTickets = await Ticket.countDocuments({ status: { $ne: 'closed' } }).catch(() => 0);
    const staffRecords = await StaffProgress.find({ status: 'active' }).catch(() => []);
    const activeStaff = staffRecords.length;
    const warnings = staffRecords.reduce((s, r) => s + (r.warnings?.count || 0), 0);
    const chatMessages = staffRecords.reduce((s, r) => s + (r.stats?.chatMessages || 0), 0);
    const snapshot = getMarketSnapshot({ pendingTickets, warnings, chatMessages, activeStaff });

    const mkt = {
      state: p.marketState || 'Boğa Piyasası',
      mult: Number(p.marketMultiplier || 2.5),
      rate: Number(p.diamondRate || 8),
      interest: Number(p.interestRate || 14),
      trend: p.marketTrend || '▃ ▅ █ █ ▄'
    };

    // Kontrol: Kaldıraç oranı pazar çarpanını aşamaz
    const maxLeverage = Math.floor(mkt.mult);
    if (multiplier > maxLeverage) {
      return interaction.editReply({
        content: `❌ Kaldıraç Oranı Çok Yüksek!\n• Mevcut pazar durumu: **${mkt.state}** x${mkt.mult.toFixed(1)}\n• Maksimum kaldıraç: ${maxLeverage}x\n• Girdiğiniz oran: ${multiplier}x`
      });
    }

    // Kaldıraç İşlemini Hesapla
    const totalInvestment = amount * multiplier;  // Toplam yatırım tutarı
    const interestCost = amount * (mkt.interest / 100);  // Faiz maliyeti (aylık olarak hesaplanır, ama burada işlem bazında)
    const borrowedAmount = totalInvestment - amount;  // Ödünç alınan tutar
    const riskFactor = multiplier * 0.1;  // Her kaldıraç oranı için +10% risk
    const successChance = Math.max(30, 100 - riskFactor * 10);  // Başarı şansı
    const isSuccess = Math.random() * 100 < successChance;

    // İşlem sonucunu hesapla
    let profit = 0;
    let loss = 0;
    // Pazar hareketi: -5% ile +5% arasında rastgele
    const marketMovementPercent = (Math.random() - 0.5) * 10;  
    
    if (isSuccess) {
      // Kar = toplam yatırım × pazar hareketi yüzdesi
      profit = totalInvestment * (marketMovementPercent / 100);
    } else {
      // Zarar = toplam yatırım × pazar hareketi yüzdesi + faiz
      loss = totalInvestment * (Math.abs(marketMovementPercent) / 100) + interestCost;
    }

    // Bakiye güncelle
    const finalAmount = isSuccess ? (amount + profit) : (amount - loss);
    p.gamification.ecoCoins = wallet - amount + finalAmount;

    // Borç durumu: başarısızsa borç gir
    if (!isSuccess && loss > finalAmount) {
      const debtAmount = loss - finalAmount;
      p.loanAmount = (p.loanAmount || 0) + debtAmount;
    }

    await p.save().catch(() => {});

    // Sonuç embed'i
    const resultEmbed = new EmbedBuilder()
      .setTitle(isSuccess ? '✅ Kaldıraçlı İşlem Başarılı!' : '❌ Kaldıraçlı İşlem Başarısız!')
      .setColor(isSuccess ? 0x2ecc71 : 0xe74c3c)
      .addFields(
        { name: '📊 İşlem Türü', value: `${typeStr === 'YUK' ? '📈 Yükseliş' : '📉 Düşüş'}`, inline: true },
        { name: '💰 Yatırım Tutarı', value: `${amount} TL`, inline: true },
        { name: '📈 Kaldıraç Oranı', value: `${multiplier}x`, inline: true },
        { name: '💸 Toplam Yatırım', value: `${totalInvestment} TL`, inline: true },
        { name: '🏦 Ödünç Tutar', value: `${borrowedAmount.toFixed(2)} TL`, inline: true },
        { name: '📊 Başarı Şansı', value: `%${successChance.toFixed(1)}`, inline: true }
      );

    if (isSuccess) {
      resultEmbed.addFields(
        { name: '✅ Kâr', value: `+${profit.toFixed(2)} TL`, inline: true },
        { name: '💰 Elde Edilen Tutar', value: `${finalAmount.toFixed(2)} TL`, inline: true },
        { name: '📊 Pazar Hareketi', value: `${marketMovementPercent > 0 ? '📈' : '📉'} ${marketMovementPercent.toFixed(2)}%`, inline: true }
      );
    } else {
      resultEmbed.addFields(
        { name: '❌ Zarar', value: `-${loss.toFixed(2)} TL`, inline: true },
        { name: '⚠️ Kalan Tutar', value: `${Math.max(0, finalAmount).toFixed(2)} TL`, inline: true },
        { name: '📊 Pazar Hareketi', value: `${marketMovementPercent > 0 ? '📈' : '📉'} ${Math.abs(marketMovementPercent).toFixed(2)}%`, inline: true }
      );

      if (p.loanAmount > 0) {
        resultEmbed.addFields({
          name: '💳 BORÇ UYARISI',
          value: `⚠️ Zararınız cüzdanınızı aştı. **${(p.loanAmount || 0).toFixed(2)} TL** borç yüklendi.\n\n💡 *Vardiya yapıp TL kazanarak borcunuzu ödeyin.*`,
          inline: false
        });
      }
    }

    resultEmbed
      .setFooter({ text: `Pazar Durumu: ${mkt.state} ${mkt.trend} | 1💎 = ${mkt.rate}TL` })
      .setTimestamp();

    // Son bakiye göster
    const finalEmbed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('💳 Güncel Bakiye')
      .addFields(
        { name: 'TL Cüzdanı', value: `${Math.max(0, p.gamification.ecoCoins).toFixed(2)} TL`, inline: true },
        { name: 'Elmas', value: `${(p.gamification.diamonds || 0)} 💎`, inline: true },
        { name: 'Borç Durumu', value: `${p.loanAmount > 0 ? `⚠️ ${p.loanAmount.toFixed(2)} TL` : '✅ Borç yok'}`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [resultEmbed, finalEmbed] });

  } catch (err) {
    console.error('[leverageService] Hata:', err.message);
    return interaction.editReply({ content: `❌ İşlem sırasında hata: ${err.message}` });
  }
}

module.exports = { handleLeverageModalSubmit };
