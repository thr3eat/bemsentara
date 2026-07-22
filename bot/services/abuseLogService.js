'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Abuse log sistemi
 * - Otomatik abuse detection ve logging
 * - Appeal sistemi (kullanıcılar dileğe çıkabilir)
 * - Tarih/zaman damgalı tüm işlemler
 */

class AbuseLog {
  constructor() {
    this.logs = new Map(); // userId → abuse records
  }

  /**
   * Abuse kaydı ekle
   * @param {string} userId - İşlenen kullanıcının ID'si
   * @param {string} abuseType - Abuse türü (COFFEE_BREAK_ABUSE, EXCESSIVE_TRADING, vb.)
   * @param {object} details - İşlem detayları
   * @returns {object} Kaydedilen abuse kaydı
   */
  logAbuse(userId, abuseType, details = {}) {
    if (!this.logs.has(userId)) {
      this.logs.set(userId, []);
    }

    const record = {
      id: `abuse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      abuseType,
      timestamp: new Date(),
      details,
      status: 'ACTIVE', // ACTIVE, APPEALED, APPROVED, REJECTED
      appealMessage: null,
      appealTimestamp: null,
      penalty: details.penalty || null,
      penaltyApplied: false,
    };

    this.logs.get(userId).push(record);
    return record;
  }

  /**
   * Abuse kaydı başarısıyla dileğe çıkar
   * @param {string} recordId - Abuse kaydı ID'si
   * @param {string} appealMessage - Dileğe mesajı
   * @returns {object|null} Güncellenen kayıt
   */
  appealAbuse(recordId, appealMessage) {
    for (const [userId, records] of this.logs.entries()) {
      const record = records.find(r => r.id === recordId);
      if (record) {
        record.status = 'APPEALED';
        record.appealMessage = appealMessage;
        record.appealTimestamp = new Date();
        return record;
      }
    }
    return null;
  }

  /**
   * Dileğe karar ver
   * @param {string} recordId - Abuse kaydı ID'si
   * @param {boolean} approved - Dileğe kabul edildi mi?
   * @returns {object|null} Güncellenen kayıt
   */
  resolveAppeal(recordId, approved) {
    for (const [userId, records] of this.logs.entries()) {
      const record = records.find(r => r.id === recordId);
      if (record && record.status === 'APPEALED') {
        record.status = approved ? 'APPROVED' : 'REJECTED';
        if (approved) {
          record.penaltyApplied = false; // Ceza kaldırılır
        }
        return record;
      }
    }
    return null;
  }

  /**
   * Belirli bir kullanıcının abuse kayıtlarını getir
   * @param {string} userId - Kullanıcı ID'si
   * @returns {array} Abuse kayıtları
   */
  getUserAbuses(userId) {
    return this.logs.get(userId) || [];
  }

  /**
   * Belirli türdeki active abuse kaydını getir (son 24 saat)
   * @param {string} userId - Kullanıcı ID'si
   * @param {string} abuseType - Abuse türü
   * @returns {object|null} Bulunmuşsa abuse kaydı
   */
  getActiveAbuse(userId, abuseType) {
    const userAbuses = this.logs.get(userId) || [];
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    return userAbuses.find(r =>
      r.abuseType === abuseType &&
      r.status === 'ACTIVE' &&
      new Date(r.timestamp) > oneDayAgo
    );
  }

  /**
   * Belirli türdeki abuse'ın sayısını getir (son 24 saat)
   * @param {string} userId - Kullanıcı ID'si
   * @param {string} abuseType - Abuse türü
   * @returns {number} Abuse sayısı
   */
  getAbuseCount(userId, abuseType) {
    const userAbuses = this.logs.get(userId) || [];
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    return userAbuses.filter(r =>
      r.abuseType === abuseType &&
      r.status === 'ACTIVE' &&
      new Date(r.timestamp) > oneDayAgo
    ).length;
  }

  /**
   * Abuse log embed'i oluştur
   * @param {string} userId - Kullanıcı ID'si
   * @returns {EmbedBuilder} Log embed'i
   */
  createAbuseLogEmbed(userId) {
    const abuses = this.getUserAbuses(userId);
    const embed = new EmbedBuilder()
      .setTitle(`📋 ${userId} - Abuse Kayıt Tarihi`)
      .setColor('#FF6B6B')
      .setTimestamp();

    if (abuses.length === 0) {
      embed.setDescription('✅ Abuse kaydı bulunmuyor.');
      return embed;
    }

    const active = abuses.filter(r => r.status === 'ACTIVE');
    const appealed = abuses.filter(r => r.status === 'APPEALED');
    const resolved = abuses.filter(r => ['APPROVED', 'REJECTED'].includes(r.status));

    if (active.length > 0) {
      const activeText = active.map(r => {
        const time = new Date(r.timestamp).toLocaleString('tr-TR');
        return `• **${r.abuseType}** - ${time}\n  └─ Ceza: ${r.penalty || 'Yok'}`;
      }).join('\n');
      embed.addFields({ name: '🔴 Aktif Abuse Kayıtları', value: activeText, inline: false });
    }

    if (appealed.length > 0) {
      const appealedText = appealed.map(r => {
        const time = new Date(r.appealTimestamp).toLocaleString('tr-TR');
        return `• **${r.abuseType}** - Dileğe Tarihi: ${time}`;
      }).join('\n');
      embed.addFields({ name: '⏳ Dileğe Bekleyen', value: appealedText, inline: false });
    }

    if (resolved.length > 0) {
      const resolvedText = resolved.map(r => {
        const status = r.status === 'APPROVED' ? '✅ Onaylandı' : '❌ Reddedildi';
        return `• **${r.abuseType}** - ${status}`;
      }).join('\n');
      embed.addFields({ name: '✔️ Sonuçlanan Dilekler', value: resolvedText, inline: false });
    }

    return embed;
  }

  /**
   * Dileğe duyuru embed'i oluştur (mod paneli)
   * @param {object} record - Abuse kaydı
   * @returns {EmbedBuilder} Duyuru embed'i
   */
  createAppealNoticeEmbed(record) {
    const embed = new EmbedBuilder()
      .setTitle('📨 Yeni Abuse Dileğesi')
      .setColor('#FFA500')
      .setTimestamp();

    embed.addFields(
      { name: '👤 Kullanıcı ID', value: record.userId, inline: true },
      { name: '🏷️ Abuse Türü', value: record.abuseType, inline: true },
      { name: '⏰ Olay Tarihi', value: new Date(record.timestamp).toLocaleString('tr-TR'), inline: false },
      { name: '💬 Dileğe Mesajı', value: record.appealMessage || '*(Mesaj yok)*', inline: false },
      { name: '📝 Detaylar', value: JSON.stringify(record.details, null, 2), inline: false }
    );

    return embed;
  }

  /**
   * Abuse kaydı göster (full details)
   * @param {string} recordId - Abuse kaydı ID'si
   * @returns {EmbedBuilder} Detay embed'i
   */
  createAbuseDetailEmbed(recordId) {
    let targetRecord = null;
    for (const records of this.logs.values()) {
      const record = records.find(r => r.id === recordId);
      if (record) {
        targetRecord = record;
        break;
      }
    }

    if (!targetRecord) {
      return new EmbedBuilder()
        .setTitle('❌ Kayıt Bulunamadı')
        .setColor('#FF0000');
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Abuse Kayıt Detayları')
      .setColor('#FF6B6B')
      .setTimestamp();

    embed.addFields(
      { name: '🆔 Kayıt ID', value: targetRecord.id, inline: false },
      { name: '👤 Kullanıcı', value: targetRecord.userId, inline: true },
      { name: '🏷️ Tür', value: targetRecord.abuseType, inline: true },
      { name: '📅 Zaman', value: new Date(targetRecord.timestamp).toLocaleString('tr-TR'), inline: false },
      { name: '📊 Durum', value: targetRecord.status, inline: true },
      { name: '⚖️ Ceza', value: targetRecord.penalty || 'Tanımlanmadı', inline: true }
    );

    if (targetRecord.appealMessage) {
      embed.addFields({
        name: '💬 Dileğe Mesajı',
        value: targetRecord.appealMessage,
        inline: false
      });
    }

    if (targetRecord.details) {
      embed.addFields({
        name: '🔍 İşlem Detayları',
        value: `\`\`\`json\n${JSON.stringify(targetRecord.details, null, 2)}\`\`\``,
        inline: false
      });
    }

    return embed;
  }
}

// Global instance
const abuseLog = new AbuseLog();

module.exports = {
  abuseLog,
  AbuseLog,
};
