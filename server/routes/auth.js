const express = require("express");
const passport = require("../passport");
const User = require("../../models/User");
const { renderLoginPage, renderAuthorizePage } = require("../views");

const router = express.Router();

router.get("/login", (req, res) => {
  res.send(renderLoginPage());
});

router.get("/auth/authorize", (req, res) => {
  const { discordId } = req.query;
  if (!discordId) return res.redirect("/");
  res.send(renderAuthorizePage(discordId));
});

router.post("/auth/authorize", async (req, res) => {
  const { discordId, robloxUsername } = req.body;
  if (!discordId || !robloxUsername) return res.status(400).send("Eksik bilgi");

  try {
    let user = await User.findOne({ discordId });
    if (!user) {
      // If user doesn't exist yet, create a skeleton
      user = new User({
        discordId,
        robloxUsername,
        isAuthorized: true,
      });
    } else {
      user.robloxUsername = robloxUsername;
      user.isAuthorized = true;
    }

    await user.save();
    res.send(`
      <body style="background:#0a0a0f;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="text-align:center;background:#13131a;padding:2rem;border-radius:12px;border:1px solid #2a2a3a;">
          <h2 style="color:#4ade80;">✅ Başarılı!</h2>
          <p>Roblox hesabınız (${robloxUsername}) başarıyla bağlandı.</p>
          <p>Artık bot komutlarını kullanabilirsiniz.</p>
          <a href="/dashboard" style="color:#7c6af7;text-decoration:none;">Dashboard'a Git</a>
        </div>
      </body>
    `);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get("/auth/discord", passport.authenticate("discord"));

router.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send(err);
    res.redirect("/");
  });
});

module.exports = router;
