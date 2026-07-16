const chalk = require("chalk");

const logs = [];
const MAX_LOGS = 50;

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const NOISY_PATTERNS = [
  /GET \/(?:favicon\.ico)? - \d+ \(\d+ms\)/i,
  /^\[Telegram Polling\]/i,
  /^\[AuditLogPoller\]/i,
  /^\[tmtLogger\]/i,
  /^\[ticketCleanup\]/i,
  /^\[staffSystem\]/i,
  /^\[unitStartupVerifier\]/i,
  /^\[monthlyPromotion\]/i,
  /^\[banRankManager\]/i,
  /^\[coachWelcome\]/i,
  /^\[ekoLogger\]/i,
  /^\[aiChannelChat\]/i,
  /^\[RiddleService\]/i,
  /^\[RobloxGroupManager\]/i,
  /^\[DiscordAbuseDetector\]/i,
  /Cached \d+ invites/i,
  /timestamp başlatıldı/i,
  /Scheduler başlatıldı/i,
  /Personel doğrulamaları kontrol edildi/i,
  /Doğrulama tamamlandı/i,
  /İzlenen Sunucular:/i,
  /Tüm gruplar poll ediliyor/i,
  /Poll turu tamamlandı/i
];

const shouldSuppressConsoleMessage = (args) => {
  const text = args
    .map((arg) => (typeof arg === "string" ? arg : String(arg)))
    .join(" ");

  if (!text) return false;
  if (process.env.SUPPRESS_STARTUP_LOGS === "false") return false;

  return NOISY_PATTERNS.some((pattern) => pattern.test(text));
};

console.log = (...args) => {
  if (shouldSuppressConsoleMessage(args)) return;
  originalConsoleLog(...args);
};

console.warn = (...args) => {
  if (shouldSuppressConsoleMessage(args)) return;
  originalConsoleWarn(...args);
};

console.error = (...args) => {
  if (shouldSuppressConsoleMessage(args)) return;
  originalConsoleError(...args);
};

const addLog = (type, msg, details) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    msg,
    details: details === undefined || details === null ? "" : String(details)
  };
  logs.push(logEntry);
  if (logs.length > MAX_LOGS) logs.shift();
};

const formatDetails = (details) => {
  if (details === undefined || details === null || details === "") return "";
  if (typeof details === "string") return details;
  if (details instanceof Error) return details.stack || details.message;
  if (typeof details === "object") {
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  }
  return String(details);
};

const printWithDetails = (prefix, color, msg, details = "") => {
  const renderedMessage = `${color(prefix)} ${msg}`;
  const renderedDetails = formatDetails(details);
  if (renderedDetails) {
    console.log(renderedMessage);
    console.log(chalk.dim(renderedDetails));
  } else {
    console.log(renderedMessage);
  }
};

const discordLogger = require("../bot/services/discordLogger");

const logger = {
  info: (msg, details = "") => {
    addLog("INFO", msg, details);
    printWithDetails("ℹ INFO", chalk.blue, msg, details);
    discordLogger.sendLog("bot", msg, details, "INFO");
  },
  success: (msg, details = "") => {
    addLog("SUCCESS", msg, details);
    printWithDetails("✅ SUCCESS", chalk.green, msg, details);
    discordLogger.sendLog("bot", msg, details, "INFO");
  },
  warn: (msg, details = "") => {
    addLog("WARN", msg, details);
    printWithDetails("⚠ WARN", chalk.yellow, msg, details);
    discordLogger.sendLog("bot", msg, details, "WARN");
  },
  error: (msg, err = "") => {
    addLog("ERROR", msg, err);
    printWithDetails("❌ ERROR", chalk.red, msg, err);
    discordLogger.sendLog("error", msg, err, "ERROR");
  },
  step: (msg, details = "") => {
    addLog("STEP", msg, details);
    printWithDetails("• STEP", chalk.cyan, msg, details);
  },
  section: (title, details = "") => {
    addLog("SECTION", title, details);
    console.log(chalk.cyan.bold(`\n┌─ ${title} ─┐`));
    if (details) {
      console.log(chalk.dim(details));
    }
  },
  log: (msg, type = "INFO", details = "") => {
    // Custom internal routing method
    addLog(type, msg, details);
    printWithDetails(`[${type}]`, chalk.magenta, msg, details);
    // Route to discordLogger based on type
    let system = "bot";
    if (type === "admin") system = "admin";
    if (type === "web" || type === "auth") system = type;
    
    discordLogger.sendLog(system, msg, details, "INFO");
  },
  getLogs: () => logs,
};

module.exports = logger;
