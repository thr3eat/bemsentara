const User = require("../models/User");

function normalizeId(id) {
  if (id === null || id === undefined || id === "") return null;
  return String(id);
}

/**
 * Discord ID ile kullanıcı bulur (string/number uyumlu).
 */
async function findUserByDiscordId(discordId) {
  const id = normalizeId(discordId);
  if (!id) return null;

  let user = await User.findOne({ discordId: id });
  if (user) return user;

  const all = await User.find({});
  return all.find((u) => normalizeId(u.discordId) === id) || null;
}

/**
 * Kayıt yoksa minimal Discord profili oluşturur.
 */
async function ensureDiscordUser(discordUser) {
  const discordId = normalizeId(discordUser.id);
  let user = await findUserByDiscordId(discordId);

  if (!user) {
    user = new User({
      discordId,
      discordUsername: discordUser.username,
      discordAvatar: discordUser.displayAvatarURL?.() || null,
    });
    await user.save();
    const { saveStoreNow } = require("../models/Store");
    saveStoreNow();
  }

  return user;
}

function hasRobloxLink(user) {
  if (!user) return false;
  const robloxId = normalizeId(user.robloxId);
  return Boolean(robloxId && robloxId !== "undefined" && robloxId !== "null");
}

module.exports = {
  normalizeId,
  findUserByDiscordId,
  ensureDiscordUser,
  hasRobloxLink,
};
