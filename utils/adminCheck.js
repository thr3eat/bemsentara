const { ADMIN_IDS } = require("../config");

/**
 * Site rolleri ve yetkileri.
 * Her rol bir badge rengi, etiketi ve izin seti içerir.
 */
const SITE_ROLES = {
  admin:         { label: "Admin",          emoji: "👑", color: "#ff6bf7", bg: "rgba(255,107,247,0.12)", border: "rgba(255,107,247,0.35)" },
  moderator:     { label: "Moderatör",      emoji: "🛡️", color: "#7c6af7", bg: "rgba(124,106,247,0.12)", border: "rgba(124,106,247,0.35)" },
  staff:         { label: "Staff",          emoji: "🔧", color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.35)"  },
  wikiEditor:    { label: "Wiki Editörü",   emoji: "📖", color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.35)"  },
  eventManager:  { label: "Etkinlik Yön.",  emoji: "🎉", color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)"  },
  support:       { label: "Destek Ekibi",   emoji: "🎧", color: "#f472b6", bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.35)" },
  contentCreator:{ label: "İçerik Üretici", emoji: "🎨", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)" },
};

function isEnvAdmin(discordId) {
  return ADMIN_IDS.map(String).includes(String(discordId));
}

function isSiteAdmin(user) {
  if (!user) return false;
  return Boolean(user.isAdmin) || isEnvAdmin(user.discordId);
}

function isSiteStaff(user) {
  if (!user) return false;
  return Boolean(user.isStaff) || Boolean(user.isModerator) || isSiteAdmin(user);
}

function isSiteWikiEditor(user) {
  if (!user) return false;
  return Boolean(user.isWikiEditor) || isSiteAdmin(user);
}

function isSiteModerator(user) {
  if (!user) return false;
  return Boolean(user.isModerator) || isSiteAdmin(user);
}

function isSiteSupport(user) {
  if (!user) return false;
  return Boolean(user.isSupport) || isSiteStaff(user);
}

/** Kullanıcının tüm aktif rollerini döndürür */
function getUserRoles(user) {
  if (!user) return [];
  const roles = [];
  if (isSiteAdmin(user))          roles.push("admin");
  if (user.isModerator)           roles.push("moderator");
  if (user.isStaff)               roles.push("staff");
  if (user.isWikiEditor)          roles.push("wikiEditor");
  if (user.isEventManager)        roles.push("eventManager");
  if (user.isSupport)             roles.push("support");
  if (user.isContentCreator)      roles.push("contentCreator");
  return roles;
}

module.exports = {
  isEnvAdmin,
  isSiteAdmin,
  isSiteStaff,
  isSiteWikiEditor,
  isSiteModerator,
  isSiteSupport,
  getUserRoles,
  SITE_ROLES,
};
