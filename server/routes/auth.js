const express = require("express");
const passport = require("../passport");
const User = require("../../models/User");
const { renderLoginPage, renderAuthorizePage } = require("../views");
const { saveStoreNow } = require("../../models/Store");
const { syncRoleConnectionForUser } = require("../services/discordRoleConnectionService");

async function syncLinkedRoleMetadata(user, session = null) {
  if (!user?.discordId) return;

  const accessToken = user.discordAccessToken || session?.discordAccessToken;
  const applicationId = process.env.DISCORD_ROLE_CONNECTION_APPLICATION_ID;
  if (!accessToken || !applicationId) return;

  const groupMemberships = {};
  try {
    const { getDiscordClient } = require("../../bot/discordClient");
    const client = getDiscordClient();
    const guild = client?.isReady() ? await client.guilds.fetch("1367646464804655104").catch(() => null) : null;
    if (guild && user.discordId) {
      const member = await guild.members.fetch(user.discordId).catch(() => null);
      if (member) {
        groupMemberships["35431216"] = member.roles.cache.has("35431216");
        groupMemberships["130659145"] = member.roles.cache.has("130659145");
      }
    }
  } catch (err) {
    console.warn("[auth] Group membership lookup failed:", err.message);
  }

  await syncRoleConnectionForUser(user, accessToken, applicationId, groupMemberships);
}

const router = express.Router();

async function tryAutoSyncRoles(user) {
  if (!user?.robloxId || !user?.discordId) return;
  const { getDiscordClient } = require("../../bot/discordClient");
  const { syncMemberRoles } = require("../../bot/services/roleSyncService");
  const { TARGET_GUILD_ID } = require("../../config");
  const client = getDiscordClient();
  if (!client?.isReady()) return;
  const guild = await client.guilds.fetch(TARGET_GUILD_ID);
  const member = await guild.members.fetch(user.discordId);
  await syncMemberRoles(guild, member, parseInt(user.robloxId, 10), user.robloxUsername);
}

/**
 * Generate a random 6-digit password
 */
function generatePassword() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.get("/login", (req, res) => {
  res.send(renderLoginPage());
});

// Password-based login endpoint
router.post("/auth/login-password", async (req, res) => {
  const { password } = req.body;

  if (!password || password.length !== 6 || !/^\d+$/.test(password)) {
    return res.status(400).json({ error: "Geçersiz şifre formatı (6 haneli olmalı)" });
  }

  try {
    const user = await User.findOne({ loginPassword: password });

    if (!user) {
      return res.status(401).json({ error: "Geçersiz şifre" });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "Hesabınız yasaklandı" });
    }

    // Manüel session kurma
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: "Oturum açma hatası" });
      }
      res.json({ success: true, message: "Giriş başarılı", user });
    });
  } catch (err) {
    console.error("[auth] Login password error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Generate or reset password for authenticated user
router.post("/auth/generate-password", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Oturum açmanız gerekir" });
  }

  try {
    const password = generatePassword();
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    user.loginPassword = password;
    user.passwordCreatedAt = new Date();
    await user.save();
    saveStoreNow();

    res.json({
      success: true,
      message: "Şifre başarıyla oluşturuldu",
      password: password,
      createdAt: new Date()
    });
  } catch (err) {
    console.error("[auth] Generate password error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/auth/authorize", (req, res) => {
  const linkDiscordId = req.query.discordId ? String(req.query.discordId) : null;
  if (linkDiscordId) {
    req.session.linkDiscordId = linkDiscordId;
  }

  if (!req.isAuthenticated()) {
    return res.redirect("/auth/discord");
  }

  if (linkDiscordId && req.user && String(req.user.discordId) !== linkDiscordId) {
    return res.redirect("/dashboard?wrongDiscord=1");
  }

  return res.redirect("/auth/roblox");
});

router.get("/auth/discord", passport.authenticate("discord"));

router.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/login" }),
  async (req, res) => {
    try {
      const linkId = req.session.linkDiscordId;
      if (linkId && req.user && String(req.user.discordId) === String(linkId)) {
        delete req.session.linkDiscordId;
        return res.redirect("/auth/roblox");
      }

      const freshUser = await User.findOne({ discordId: String(req.user.discordId) });
      if (freshUser) {
        req.session.discordAccessToken = freshUser.discordAccessToken || req.session.discordAccessToken;
        try {
          await syncLinkedRoleMetadata(freshUser, req.session);
        } catch (err) {
          console.warn("[auth] Discord role connection sync failed:", err.message);
        }
      }

      res.redirect("/dashboard");
    } catch (err) {
      console.error("[auth] Discord callback error:", err);
      res.redirect("/dashboard");
    }
  }
);

router.get("/auth/roblox", passport.authenticate("roblox"));

router.get(
  "/auth/roblox/callback",
  passport.authenticate("roblox", { failureRedirect: "/dashboard" }),
  async (req, res) => {
    try {
      // Regenerate session to ensure updated user data is persisted
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.redirect("/dashboard?robloxError=true");
        }
        
        // Re-establish user in regenerated session
        if (req.user) {
          req.login(req.user, async (err) => {
            if (err) {
              console.error("Login error:", err);
              return res.redirect("/dashboard?robloxError=true");
            }
            const User = require("../../models/User");
            const fresh = await User.findOne({ discordId: String(req.user.discordId) });
            if (fresh) {
              req.user = fresh;
              req.session.passport.user = fresh._id;
            }
            tryAutoSyncRoles(req.user).catch(() => {});

            try {
              await syncLinkedRoleMetadata(req.user, req.session);
            } catch (err) {
              console.warn("[auth] Roblox role connection sync failed:", err.message);
            }

            res.redirect("/dashboard?robloxLinked=true");
          });
        } else {
          res.redirect("/dashboard?robloxError=true");
        }
      });
    } catch (err) {
      console.error("Roblox callback error:", err);
      res.redirect("/dashboard?robloxError=true");
    }
  }
);

router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send(err);
    res.redirect("/");
  });
});

// Roblox bağlantısını kaldır
router.get("/auth/roblox/unlink", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  try {
    const User = require("../../models/User");
    const { saveStoreNow } = require("../../models/Store");
    const user = await User.findById(req.user._id);
    if (user) {
      user.robloxId = null;
      user.robloxUsername = null;
      user.isAuthorized = false;
      await user.save();
      saveStoreNow();
      // Oturumu güncelle
      req.user = user;
    }
    res.redirect("/settings?robloxUnlinked=true");
  } catch (err) {
    console.error("Roblox unlink error:", err);
    res.redirect("/settings?error=true");
  }
});

module.exports = router;
