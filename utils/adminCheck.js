const { ADMIN_IDS } = require("../config");

function isEnvAdmin(discordId) {
  return ADMIN_IDS.map(String).includes(String(discordId));
}

function isSiteAdmin(user) {
  if (!user) return false;
  return Boolean(user.isAdmin) || isEnvAdmin(user.discordId);
}

function isSiteStaff(user) {
  if (!user) return false;
  return Boolean(user.isStaff) || isSiteAdmin(user);
}

module.exports = { isEnvAdmin, isSiteAdmin, isSiteStaff };
