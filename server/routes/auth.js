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

  await syncRoleConnectionForUser(user, accessToken, applicationId, {});
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

// OTP Store: Map<discordId, { code: string, expiresAt: number }>
const otpStore = new Map();

/**
 * Endpoint to request a login code via Discord DM
 */
router.post("/api/auth/request-code", async (req, res) => {
  const { discordId } = req.body;
  if (!discordId || !/^\d{17,20}$/.test(discordId)) {
    return res.status(400).json({ error: "Geçerli bir Discord ID girin." });
  }

  try {
    const { getDiscordClient } = require("../../bot/discordClient");
    const client = getDiscordClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({ error: "Discord botu aktif değil, lütfen daha sonra tekrar deneyin." });
    }

    // Check if there is an existing valid code to prevent spam
    const existing = otpStore.get(discordId);
    if (existing && existing.expiresAt > Date.now()) {
      // Allow sending another code, but maybe throttle? For now just overwrite.
    }

    // Generate 4-digit code
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(discordId, { code, expiresAt });

    // Send DM
    try {
      const user = await client.users.fetch(discordId);
      await user.send({
        embeds: [{
          title: "🔑 Sentara Giriş Kodu",
          description: "Bemsentara paneline giriş yapmak için doğrulama kodunuz:\\n\\n**" + code + "**\\n\\n*Bu kod 5 dakika boyunca geçerlidir. Lütfen bu kodu kimseyle paylaşmayın.*",
          color: 0x7c6af7,
          timestamp: new Date().toISOString()
        }]
      });
    } catch (dmErr) {
      console.warn("DM Send Error:", dmErr.message);
      return res.status(400).json({ error: "Size DM gönderilemedi! Lütfen bot ile aynı sunucuda olduğunuza ve DMs'lerinizin açık olduğuna emin olun." });
    }

    res.json({ success: true, message: "Kod Discord özel mesajlarınıza gönderildi." });
  } catch (err) {
    console.error("Request Code Error:", err);
    res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
});

/**
 * Endpoint to verify the login code
 */
router.post("/api/auth/verify-code", async (req, res) => {
  const { discordId, code } = req.body;
  
  if (!discordId || !code) {
    return res.status(400).json({ error: "Discord ID ve Kod gereklidir." });
  }

  const record = otpStore.get(discordId);
  if (!record) {
    return res.status(400).json({ error: "Geçerli bir kod bulunamadı veya süresi dolmuş." });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(discordId);
    return res.status(400).json({ error: "Kodun süresi dolmuş. Lütfen yeni bir kod isteyin." });
  }

  if (record.code !== String(code).trim()) {
    return res.status(401).json({ error: "Hatalı kod." });
  }

  // Code is valid! Delete it from store
  otpStore.delete(discordId);

  try {
    const { getDiscordClient } = require("../../bot/discordClient");
    const client = getDiscordClient();
    const discordUser = await client.users.fetch(discordId);

    // Upsert user in database
    let user = await User.findOne({ discordId });
    if (!user) {
      user = new User({
        discordId: discordUser.id,
        username: discordUser.username,
        avatar: discordUser.avatar 
          ? "https://cdn.discordapp.com/avatars/" + discordUser.id + "/" + discordUser.avatar + ".png"
          : "https://cdn.discordapp.com/embed/avatars/0.png"
      });
    } else {
      user.username = discordUser.username;
      if (discordUser.avatar) {
        user.avatar = "https://cdn.discordapp.com/avatars/" + discordUser.id + "/" + discordUser.avatar + ".png";
      }
    }
    
    await user.save();
    saveStoreNow();

    // Login via Passport
    req.login(user, (err) => {
      if (err) {
        console.error("Login session setup error:", err);
        return res.status(500).json({ error: "Oturum açılamadı." });
      }
      res.json({ success: true, message: "Başarıyla giriş yapıldı!" });
    });
  } catch (err) {
    console.error("Verify Code Error:", err);
    res.status(500).json({ error: "Sunucu hatası: " + err.message });
  }
});

router.get("/auth/roblox", passport.authenticate("roblox"));

router.get(
  "/auth/roblox/callback",
  (req, res, next) => {
    passport.authenticate("roblox", (err, user, info) => {
      if (err) {
        console.warn("[auth] Roblox authentication failed:", err.message || err);
        return res.redirect("/dashboard?robloxError=true");
      }
      if (!user) {
        return res.redirect("/dashboard");
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("[auth] Roblox login session setup error:", loginErr);
          return res.redirect("/dashboard");
        }
        return next();
      });
    })(req, res, next);
  },
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
