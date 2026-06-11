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
const GUILD2_VOICE_CATEGORY_ID   = process.env.GUILD2_VOICE_CATEGORY_ID   || "1460284319183536190";
/** Ses sistemi panel kanalı */
const GUILD2_VOICE_PANEL_ID      = process.env.GUILD2_VOICE_PANEL_ID      || "1505505849924255955";

// ── Üçüncü sunucu (TMT - Türk Silahlı Kuvvetleri) ──────────────────────────────
const TMT_GUILD_ID               = "1514569307886063666";
/** Sunucu kuralları kanalı */
const TMT_RULES_CHANNEL_ID       = "1514583014208700519";
/** Otomod kuralları kanalı */
const TMT_AUTOMOD_RULES_CHANNEL_ID = "1514583015412600832";
/** Doğrulama yardım mesajı kanalı */
const TMT_VERIFY_HELP_CHANNEL_ID = "1514583038598713404";
/** Destek sistemi kanalı */
const TMT_SUPPORT_CHANNEL_ID     = "1514583035327156254";
/** Ses paneli kanalı */
const TMT_VOICE_PANEL_CHANNEL_ID = "1514583184275279992";
/** Ses kanalı oluşturma kanalı */
const TMT_VOICE_JOIN_CHANNEL_ID = "1514583245260329001";
/** Roblox Grup Yönetimi Rütbe Değiştirme Log Kanalı */
const TMT_ROBLOX_RANK_LOG_CHANNEL_ID = "1514583232111317054";

// ── TMT Rolleri ──────────────────────────────────────────────────────────────
const TMT_UNVERIFIED_ROLE_ID     = "1514642404932718724";
const TMT_VERIFIED_ROLE_ID       = "1514582790639980635";

// ── TMT Oyun ve Özel Kanallar ────────────────────────────────────────────────
const TMT_HONEYPOT_CHANNEL_ID    = "1514583028331184229"; // Mesaj atanların atılacağı kanal
const TMT_OWO_CHANNEL_ID         = "1514583077308072036";
const TMT_TUTTU_CHANNEL_ID       = "1514583081304985640";
const TMT_BOM_CHANNEL_ID         = "1514583084190924871";
const TMT_WORDGAME_CHANNEL_ID    = "1514583088129376316";

const SUPPORT_CATEGORIES = {
  ban:        { name: "🔨 Ban/Şikayet Talebi",  color: 0xff4444 },
  reklam:     { name: "📢 Reklam Satın Al",      color: 0xfbbf24 },
  report:     { name: "🚨 Kullanıcı Şikayet",    color: 0xff6b6b },
  billing:    { name: "💳 Ödeme Sorunu",         color: 0xf38181 },
  technical:  { name: "🔧 Teknik Sorun",         color: 0x4ecdc4 },
  account:    { name: "👤 Hesap Sorunu",         color: 0x95e1d3 },
  genel:      { name: "💬 Genel Destek",         color: 0x7c6af7 },
  other:      { name: "📝 Diğer",               color: 0xaa96da },
};

// TMT sunucusu için destek kategorileri
const TMT_SUPPORT_CATEGORIES = {
  discord:    { name: "📚 Discord Destek",      color: 0x5865F2, description: "Discord sunucularımız ile ilgili bir sorun olması halinde açılması gereken destek bileti." },
  game:       { name: "💂🏻 Oyun Destek",        color: 0x57F287, description: "Oyunumuzda yaşanan sorunlar veya yardımlar için açılması gereken destek bileti." },
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
  // Üçüncü sunucu (TMT)
  TMT_GUILD_ID,
  TMT_RULES_CHANNEL_ID,
  TMT_AUTOMOD_RULES_CHANNEL_ID,
  TMT_VERIFY_HELP_CHANNEL_ID,
  TMT_SUPPORT_CHANNEL_ID,
  TMT_UNVERIFIED_ROLE_ID,
  TMT_VERIFIED_ROLE_ID,
  TMT_HONEYPOT_CHANNEL_ID,
  TMT_OWO_CHANNEL_ID,
  TMT_TUTTU_CHANNEL_ID,
  TMT_BOM_CHANNEL_ID,
  TMT_WORDGAME_CHANNEL_ID,
  TMT_VOICE_PANEL_CHANNEL_ID,
  TMT_VOICE_JOIN_CHANNEL_ID,
  TMT_ROBLOX_RANK_LOG_CHANNEL_ID,
  ADMIN_IDS,
  DATA_DIR,
  SUPPORT_CATEGORIES,
  TMT_SUPPORT_CATEGORIES,
};
