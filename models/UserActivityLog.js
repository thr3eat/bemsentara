const { v4: uuidv4 } = require("uuid");

class UserActivityLog {
  static get ACTIVITY_TYPES() {
    return {
      LOGIN: "login",
      COMMAND: "command",
      PAGE_VIEW: "page_view",
      FILE_UPLOAD: "file_upload",
      MOD_ACTION: "mod_action",
      PROFILE_UPDATE: "profile_update",
      LOGOUT: "logout",
      ERROR: "error"
    };
  }

  constructor() {
    this.logs = [];
  }

  // Log bir aktivite kaydı
  log(discordId, activityType, details = {}) {
    const entry = {
      id: uuidv4(),
      discordId,
      activityType,
      details,
      timestamp: new Date(),
      iso: new Date().toISOString()
    };
    this.logs.push(entry);
    return entry;
  }

  // Belirli kullanıcının aktivitelerini getir
  getByUser(discordId, limit = 50) {
    return this.logs
      .filter(log => log.discordId === discordId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Belirli bir tarih aralığında aktiviteleri getir
  getByDateRange(startDate, endDate) {
    return this.logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });
  }

  // Aktivite türüne göre filtrele
  getByType(activityType, limit = 100) {
    return this.logs
      .filter(log => log.activityType === activityType)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Kullanıcının last login'i getir
  getLastLogin(discordId) {
    const logins = this.logs
      .filter(log => log.discordId === discordId && log.activityType === "login")
      .sort((a, b) => b.timestamp - a.timestamp);
    return logins[0] || null;
  }

  // Son 24 saatteki aktivite say
  getActivityCount24h(discordId) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.logs.filter(log => 
      log.discordId === discordId && log.timestamp >= oneDayAgo
    ).length;
  }

  // Aktif kullanıcılar (24 saatte aktivite olan)
  getActiveUsers() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeDiscordIds = new Set(
      this.logs
        .filter(log => log.timestamp >= oneDayAgo)
        .map(log => log.discordId)
    );
    return Array.from(activeDiscordIds);
  }

  // Önce aktif olanlar - şu anda inaktif
  getInactiveUsers(inactiveForHours = 24) {
    const thresholdTime = new Date(Date.now() - inactiveForHours * 60 * 60 * 1000);
    
    // Tüm logins'i zaman sırasıyla al
    const userLastActivity = {};
    this.logs.forEach(log => {
      if (!userLastActivity[log.discordId] || log.timestamp > userLastActivity[log.discordId]) {
        userLastActivity[log.discordId] = log.timestamp;
      }
    });

    // Eşiğin altında olanları getir
    return Object.entries(userLastActivity)
      .filter(([_, timestamp]) => timestamp < thresholdTime)
      .map(([discordId, _]) => discordId);
  }

  // Kullanıcının tüm aktivite history'sini formatted string olarak getir
  getUserActivityReport(discordId) {
    const activities = this.getByUser(discordId, 100);
    if (activities.length === 0) return "Aktivite kaydı bulunamadı.";

    return activities.map(log => {
      const time = new Date(log.timestamp).toLocaleString("tr-TR");
      const details = Object.entries(log.details)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return `📌 **${time}** - ${log.activityType.toUpperCase()}${details ? `\n   └─ ${details}` : ""}`;
    }).join("\n");
  }

  // Tüm logları JSON olarak getir (backup için)
  getAllLogs() {
    return [...this.logs];
  }

  // Logları temizle (debug için)
  clear() {
    this.logs = [];
  }
}

module.exports = new UserActivityLog();
