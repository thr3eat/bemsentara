require("dotenv").config();

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DB_URL = process.env.MONGODB_URI || "mongodb://localhost:27017/sentara";
const SESSION_SECRET = process.env.SESSION_SECRET || "sentara-secret-key";
const BOT_ID = process.env.BOTID || process.env.BOT_ID;
const TOKEN = process.env.TOKEN;

const SUPPORT_CATEGORIES = {
  billing: { name: "💳 Ödeme Sorunu", color: 0xff6b6b },
  technical: { name: "🔧 Teknik Sorun", color: 0x4ecdc4 },
  account: { name: "👤 Hesap Sorunu", color: 0x95e1d3 },
  group: { name: "👥 Grup Sorunu", color: 0xf38181 },
  other: { name: "📝 Diğer", color: 0xaa96da },
};

module.exports = {
  PORT,
  BASE_URL,
  DB_URL,
  SESSION_SECRET,
  BOT_ID,
  TOKEN,
  SUPPORT_CATEGORIES,
};
