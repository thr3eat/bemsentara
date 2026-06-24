// passport.js

const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const RobloxStrategy = require("passport-roblox");
const axios = require("axios");
const User = require("../models/User");
const { saveStoreNow } = require("../models/Store"); // ✅ Döngüsel require kaldırıldı
const { BASE_URL } = require("../config");
const { isEnvAdmin } = require("../utils/adminCheck");

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

/**
 * Discord avatar URL'si oluşturur.
 */
function buildDiscordAvatarUrl(profile) {
  if (profile.avatar) {
    return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
  }
  const discriminator = parseInt(profile.discriminator || "0", 10);
  return `https://cdn.discordapp.com/embed/avatars/${discriminator % 5}.png`;
}

/**
 * Discord banner URL'si oluşturur.
 */
function buildDiscordBannerUrl(profile) {
  if (!profile.banner) return null;
  return `https://cdn.discordapp.com/banners/${profile.id}/${profile.banner}.png?size=512`;
}

/**
 * Roblox API'den kullanıcı adı çeker.
 * @param {string} robloxId
 * @returns {Promise<string>}
 */
async function fetchRobloxUsername(robloxId) {
  try {
    const { data } = await axios.get(
      `https://users.roblox.com/v1/users/${robloxId}`,
      { timeout: 5000 }
    );
    return data.name || data.username || null;
  } catch (err) {
    console.warn(`[passport] Roblox API'den kullanıcı adı alınamadı (ID: ${robloxId}):`, err.message);
    return null;
  }
}

/**
 * Roblox profil nesnesinden ham kullanıcı ID'sini çıkarır.
 * @param {object} profile
 * @returns {string|null}
 */
function extractRobloxId(profile) {
  const raw =
    profile.id ??
    profile.sub ??
    profile._json?.sub ??
    profile._json?.id ??
    null;

  return raw != null ? String(raw) : null;
}

// ─── Discord Strategy ─────────────────────────────────────────────────────────

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/auth/discord/callback`,
      scope: ["identify", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const discordId = String(profile.id);
        const envAdmin = isEnvAdmin(discordId);
        const avatarUrl = buildDiscordAvatarUrl(profile);
        const bannerUrl = buildDiscordBannerUrl(profile);

        let user = await User.findOne({ discordId });

        if (!user) {
          user = new User({
            discordId,
            discordUsername: profile.username,
            discordEmail: profile.email,
            discordAvatar: avatarUrl,
            discordBanner: bannerUrl,
            isAdmin: envAdmin,
            isStaff: envAdmin,
          });
        } else {
          user.discordUsername = profile.username;
          user.discordEmail = profile.email;
          user.discordAvatar = avatarUrl;
          if (bannerUrl) user.discordBanner = bannerUrl;
          if (envAdmin) {
            user.isAdmin = true;
            user.isStaff = true;
          }
        }

        await user.save();
        saveStoreNow();

        return done(null, user);
      } catch (err) {
        console.error("[passport] Discord auth hatası:", err);
        return done(err);
      }
    }
  )
);

// ─── Roblox Strategy ──────────────────────────────────────────────────────────

// ⚠️ UYARI: Client ID ve Secret'ı environment variable olarak tanımlayın!
// Bu değerleri asla kod içine yazmayın.
const ROBLOX_CLIENT_ID =
  process.env.ROBLOX_OAUTH_CLIENT_ID ||
  process.env.ROBLOX_CLIENT_ID;

const ROBLOX_CLIENT_SECRET =
  process.env.ROBLOX_OAUTH_CLIENT_SECRET ||
  process.env.ROBLOX_CLIENT_SECRET;

if (!ROBLOX_CLIENT_ID || !ROBLOX_CLIENT_SECRET) {
  console.error(
    "[passport] HATA: ROBLOX_OAUTH_CLIENT_ID ve ROBLOX_OAUTH_CLIENT_SECRET " +
    "environment variable olarak tanımlanmalıdır!"
  );
}

passport.use(
  new RobloxStrategy(
    {
      clientID: ROBLOX_CLIENT_ID,
      clientSecret: ROBLOX_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/auth/roblox/callback`,
      scope: ["openid", "profile"],
      pkce: true,
      state: true,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // 1. Discord ile giriş yapılmış olmalı
        if (!req.user) {
          return done(new Error("Lütfen önce Discord ile giriş yapın."));
        }

        // 2. Kullanıcıyı veritabanında bul
        const user =
          (await User.findById(req.user._id)) ||
          (req.user.discordId
            ? await User.findOne({ discordId: String(req.user.discordId) })
            : null);

        if (!user) {
          return done(new Error("Kullanıcı veritabanında bulunamadı."));
        }

        // 3. Roblox ID'sini çıkar
        const rbxIdStr = extractRobloxId(profile);
        if (!rbxIdStr) {
          return done(new Error("Roblox hesap ID alınamadı. Tekrar deneyin."));
        }

        // 4. Yasaklı hesap kontrolü
        const bannedUser = await User.findOne({
          robloxId: rbxIdStr,
          isBanned: true,
        });
        if (bannedUser && String(bannedUser._id) !== String(user._id)) {
          console.warn(
            `[passport] Engellendi: Roblox ID ${rbxIdStr}, yasaklı Discord hesabına (${bannedUser.discordId}) bağlı.`
          );
          return done(
            new Error(
              "Bu Roblox hesabı yasaklı bir Discord hesabına bağlıdır. Giriş engellendi!"
            )
          );
        }

        // 5. Kullanıcı adını belirle
        const usernameFromProfile =
          profile.preferredUsername ||
          profile.displayName ||
          profile.nickname ||
          profile.name ||
          null;

        const robloxUsername =
          usernameFromProfile ||
          (await fetchRobloxUsername(rbxIdStr)) ||
          `User_${rbxIdStr}`;

        // 6. Kullanıcıyı güncelle
        user.robloxId = rbxIdStr;
        user.robloxUsername = robloxUsername;
        user.isAuthorized = true;

        if (
          req.user.discordId &&
          String(user.discordId) !== String(req.user.discordId)
        ) {
          user.discordId = String(req.user.discordId);
        }

        await user.save();
        saveStoreNow();

        req.user = user;

        return done(null, user);
      } catch (err) {
        console.error("[passport] Roblox auth hatası:", err);
        return done(err);
      }
    }
  )
);

// ─── Serialize / Deserialize ──────────────────────────────────────────────────

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (!user) return done(null, false);

    // ID'leri string olarak normalize et
    if (user.discordId) user.discordId = String(user.discordId);
    if (user.robloxId) user.robloxId = String(user.robloxId);

    done(null, user);
  } catch (err) {
    console.error("[passport] Deserialize hatası:", err);
    done(err);
  }
});

module.exports = passport;