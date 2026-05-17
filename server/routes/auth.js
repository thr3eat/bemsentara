const express = require("express");
const passport = require("../passport");
const User = require("../../models/User");
const { renderLoginPage, renderAuthorizePage } = require("../views");

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

router.get("/login", (req, res) => {
  res.send(renderLoginPage());
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
  (req, res) => {
    const linkId = req.session.linkDiscordId;
    if (linkId && req.user && String(req.user.discordId) === String(linkId)) {
      delete req.session.linkDiscordId;
      return res.redirect("/auth/roblox");
    }
    res.redirect("/dashboard");
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
