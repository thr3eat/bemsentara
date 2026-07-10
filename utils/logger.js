const chalk = require("chalk");

const logs = [];
const MAX_LOGS = 50;

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

const logger = {
  info: (msg, details = "") => {
    addLog("INFO", msg, details);
    printWithDetails("ℹ INFO", chalk.blue, msg, details);
  },
  success: (msg, details = "") => {
    addLog("SUCCESS", msg, details);
    printWithDetails("✅ SUCCESS", chalk.green, msg, details);
  },
  warn: (msg, details = "") => {
    addLog("WARN", msg, details);
    printWithDetails("⚠ WARN", chalk.yellow, msg, details);
  },
  error: (msg, err = "") => {
    addLog("ERROR", msg, err);
    printWithDetails("❌ ERROR", chalk.red, msg, err);
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
  getLogs: () => logs,
};

module.exports = logger;
