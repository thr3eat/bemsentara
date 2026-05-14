const chalk = require("chalk");

const logs = [];
const MAX_LOGS = 50;

const addLog = (type, msg, details) => {
  const logEntry = { timestamp: new Date().toISOString(), type, msg, details: details?.toString() || "" };
  logs.push(logEntry);
  if (logs.length > MAX_LOGS) logs.shift();
};

const logger = {
  info: (msg, details = "") => {
    addLog("INFO", msg, details);
    console.log(`${chalk.blue("ℹ [INFO]")} ${msg}`, details);
  },
  success: (msg, details = "") => {
    addLog("SUCCESS", msg, details);
    console.log(`${chalk.green("✅ [SUCCESS]")} ${msg}`, details);
  },
  warn: (msg, details = "") => {
    addLog("WARN", msg, details);
    console.warn(`${chalk.yellow("⚠️ [WARN]")} ${msg}`, details);
  },
  error: (msg, err = "") => {
    addLog("ERROR", msg, err);
    console.error(`${chalk.red("❌ [ERROR]")} ${msg}`, err);
  },
  getLogs: () => logs,
};

module.exports = logger;
