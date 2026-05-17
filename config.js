require("dotenv").config();

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SESSION_SECRET = process.env.SESSION_SECRET || "sentara-secret-key";
const BOT_ID = process.env.BOTID || process.env.BOT_ID;
const TOKEN = process.env.TOKEN;

// ── Ana sunucu (BEM Sentara) ─────────────────────────────────────────────────
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID || "1414639355456389344";
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || "1504201341021716690";
const VERIFY_CHANNEL_ID = process.env.VERIFY_CHANNEL_ID || "1504201338878296164";
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "1504201542801035336";
const TICKET_LOG_CHANNEL_ID = process.env.TICKET_LOG_CHANNEL_ID || "1504201536207585392";
const BAN_LOG_CHANNEL_ID = process.env.BAN_LOG_CHANNEL_ID || "1504201531551907941";
const VOICE_PANEL_CHANNEL_ID = process.env.VOICE_PANEL_CHANNEL_ID || "1504201547943383130";
const VOICE_JOIN_CHANNEL_ID = process.env.VOICE_JOIN_CHANNEL_ID || "1504201626750025728";
const VOICE_CATEGORY_ID = process.env.VOICE_CATEGORY_ID || "1504201250160246886";
/** Doğrulanmamış üyelere verilecek rol (BEM sunucusu) */
const UNVERIFIED_ROLE_ID = process.env.UNVERIFIED_ROLE_ID || "1505511498095788063";

// ── İkinci sunucu (EKOYILDIZ) ────────────────────────────────────────────────
const GUILD2_ID                  = process.env.GUILD2_ID                  || "1367646464804655104";
/** Ticket kanallarının açılacağı kategori */
const GUILD2_TICKET_CATEGORY_ID  = process.env.GUILD2_TICKET_CATEGORY_ID  || "1493662634044559440";
/** Ticket log kanalı (isteğe bağlı, boş bırakılabilir) */
const GUILD2_TICKET_LOG_ID       = process.env.GUILD2_TICKET_LOG_ID       || "1412828986240929852";
/** Join-to-create ses kanalı */
const GUILD2_VOICE_JOIN_ID       = process.env.GUILD2_VOICE_JOIN_ID       || "1466134451191943291";
/** Ses kanallarının oluşturulacağı kategori (join kanalıyla aynı kategori kullanılır) */
const GUILD2_VOICE_CATEGORY_ID   = process.env.GUILD2_VOICE_CATEGORY_ID   || "";
/** Ses sistemi panel kanalı */
const GUILD2_VOICE_PANEL_ID      = process.env.GUILD2_VOICE_PANEL_ID      || "1505505849924255955";

const SUPPORT_CATEGORIES = {
  billing: { name: "💳 Ödeme Sorunu", color: 0xff6b6b },
  technical: { name: "🔧 Teknik Sorun", color: 0x4ecdc4 },
  account: { name: "👤 Hesap Sorunu", color: 0x95e1d3 },
  group: { name: "👥 Grup Sorunu", color: 0xf38181 },
  other: { name: "📝 Diğer", color: 0xaa96da },
};

const ADMIN_IDS = (process.env.ADMIN_IDS || "1031620522406072350")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const DATA_DIR = process.env.DATA_DIR || null;

module.exports = {
  PORT,
  BASE_URL,
  SESSION_SECRET,
  BOT_ID,
  TOKEN,
  TARGET_GUILD_ID,
  TARGET_CHANNEL_ID,
  VERIFY_CHANNEL_ID,
  LOG_CHANNEL_ID,
  TICKET_LOG_CHANNEL_ID,
  BAN_LOG_CHANNEL_ID,
  VOICE_PANEL_CHANNEL_ID,
  VOICE_JOIN_CHANNEL_ID,
  VOICE_CATEGORY_ID,
  UNVERIFIED_ROLE_ID,
  // İkinci sunucu
  GUILD2_ID,
  GUILD2_TICKET_CATEGORY_ID,
  GUILD2_TICKET_LOG_ID,
  GUILD2_VOICE_JOIN_ID,
  GUILD2_VOICE_CATEGORY_ID,
  GUILD2_VOICE_PANEL_ID,
  ADMIN_IDS,
  DATA_DIR,
  SUPPORT_CATEGORIES,
};
