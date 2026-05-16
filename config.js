require("dotenv").config();

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SESSION_SECRET = process.env.SESSION_SECRET || "sentara-secret-key";
const BOT_ID = process.env.BOTID || process.env.BOT_ID;
const TOKEN = process.env.TOKEN;
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID || "1414639355456389344";
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || "1504201341021716690";
/** Doğrulama rehber mesajının gönderileceği kanal */
const VERIFY_CHANNEL_ID = process.env.VERIFY_CHANNEL_ID || "1504201338878296164";

const SUPPORT_CATEGORIES = {
  billing: { name: "💳 Ödeme Sorunu", color: 0xff6b6b },
  technical: { name: "🔧 Teknik Sorun", color: 0x4ecdc4 },
  account: { name: "👤 Hesap Sorunu", color: 0x95e1d3 },
  group: { name: "👥 Grup Sorunu", color: 0xf38181 },
  other: { name: "📝 Diğer", color: 0xaa96da },
};

const ADMIN_IDS = (process.env.ADMIN_IDS || "1031620522406072350").split(",");

module.exports = {
  PORT,
  BASE_URL,
  SESSION_SECRET,
  BOT_ID,
  TOKEN,
  TARGET_GUILD_ID,
  TARGET_CHANNEL_ID,
  VERIFY_CHANNEL_ID,
  ADMIN_IDS,
  SUPPORT_CATEGORIES,
};
