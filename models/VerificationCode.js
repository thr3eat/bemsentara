// VerificationCode model - manages Discord OAuth verification codes

const codes = new Map();

class VerificationCodeStore {
  // Create a new verification code
  static create(discordId) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 dakika
    
    codes.set(code, {
      code,
      discordId,
      createdAt: new Date(),
      expiresAt: new Date(expiresAt),
      verified: false,
      verifiedAt: null,
    });

    return code;
  }

  // Find verification code
  static findOne(query) {
    if (query.code) {
      const entry = codes.get(query.code);
      if (entry && entry.expiresAt > new Date()) {
        return Promise.resolve(entry);
      }
      return Promise.resolve(null);
    }
    if (query.discordId) {
      for (let [_, entry] of codes) {
        if (entry.discordId === query.discordId && !entry.verified && entry.expiresAt > new Date()) {
          return Promise.resolve(entry);
        }
      }
    }
    return Promise.resolve(null);
  }

  // Mark as verified
  static async verify(code) {
    const entry = codes.get(code);
    if (entry) {
      entry.verified = true;
      entry.verifiedAt = new Date();
      return entry;
    }
    return null;
  }

  // Clean expired codes
  static cleanExpired() {
    const now = Date.now();
    for (let [code, entry] of codes) {
      if (entry.expiresAt < now) {
        codes.delete(code);
      }
    }
  }

  // Get all codes (for debugging)
  static getAll() {
    return Array.from(codes.values());
  }
}

// Clean up every 5 minutes
setInterval(() => {
  VerificationCodeStore.cleanExpired();
}, 5 * 60 * 1000);

module.exports = VerificationCodeStore;
