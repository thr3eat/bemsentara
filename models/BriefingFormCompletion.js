// BriefingFormCompletion - Personel briefing form sonuçları
class BriefingFormCompletion {
  constructor() {
    this.completions = [];
  }

  // Formu tamamla
  complete(discordId, answers = {}) {
    const existing = this.completions.find(c => c.discordId === discordId);
    
    const entry = {
      discordId,
      answers: answers,
      completedAt: new Date(),
      version: "1.0"
    };

    if (existing) {
      Object.assign(existing, entry);
      return existing;
    } else {
      this.completions.push(entry);
      return entry;
    }
  }

  // Form tamamlandı mı?
  isCompleted(discordId) {
    return this.completions.some(c => c.discordId === discordId);
  }

  // Form bilgilerini getir
  getCompletion(discordId) {
    return this.completions.find(c => c.discordId === discordId) || null;
  }

  // Tüm completions
  getAll() {
    return [...this.completions];
  }
}

module.exports = new BriefingFormCompletion();
