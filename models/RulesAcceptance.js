const { v4: uuidv4 } = require("uuid");

class RulesAcceptance {
  constructor() {
    this.acceptances = [];
  }

  // Kuralları kabul et
  accept(discordId, ruleVersion = "1.0") {
    const existing = this.acceptances.find(a => a.discordId === discordId);
    
    const entry = {
      id: uuidv4(),
      discordId,
      ruleVersion,
      acceptedAt: new Date(),
      ipAddress: null,
      userAgent: null
    };

    if (existing) {
      // Update varolan kaydı
      Object.assign(existing, entry);
      return existing;
    } else {
      // Yeni kayıt
      this.acceptances.push(entry);
      return entry;
    }
  }

  // Kullanıcının kuralları kabul edip etmediğini kontrol et
  hasAccepted(discordId, requiredVersion = "1.0") {
    const record = this.acceptances.find(a => a.discordId === discordId);
    if (!record) return false;
    
    // Eğer versiyonlar farklıysa, yeni kabul gerekli
    if (record.ruleVersion !== requiredVersion) return false;
    
    return true;
  }

  // Kabul zamanını getir
  getAcceptanceTime(discordId) {
    const record = this.acceptances.find(a => a.discordId === discordId);
    return record ? record.acceptedAt : null;
  }

  // Tüm kabul kayıtlarını getir
  getAllAcceptances() {
    return [...this.acceptances];
  }

  // Kabul eden kullanıcı sayısı
  getTotalAcceptances() {
    return this.acceptances.length;
  }

  // Belirli versiyonu kabul edenler
  getByVersion(version) {
    return this.acceptances.filter(a => a.ruleVersion === version);
  }
}

module.exports = new RulesAcceptance();
