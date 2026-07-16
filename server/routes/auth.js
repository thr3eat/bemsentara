const express = require("express");
const passport = require("../passport");
const User = require("../../models/User");
const { renderLoginPage, renderAuthorizePage } = require("../views");
const { saveStoreNow } = require("../../models/Store");
const { syncRoleConnectionForUser } = require("../services/discordRoleConnectionService");
const logger = require("../../utils/logger");

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

const axios = require('axios');
const discordLogger = require('../../bot/services/discordLogger');

async function logWebLogin(user, req) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'Bilinmiyor';
    let location = 'Bilinmiyor';
    
    if (ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== 'Bilinmiyor') {
      try {
        const geoRes = await axios.get(`http://ip-api.com/json/${ip.split(',')[0].trim()}`);
        if (geoRes.data && geoRes.data.status === 'success') {
          location = `${geoRes.data.city}, ${geoRes.data.country}`;
        }
      } catch (e) {}
    }

    const message = `**Web Girişi Yapıldı**\n**Kullanıcı:** ${user.username || user.discordUsername || "Bilinmiyor"} (${user.discordId})\n**IP:** ${ip}\n**Konum:** ${location}`;

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const btn = new ButtonBuilder()
      .setLabel('Canlı İzle / Geçmişi Gör')
      .setStyle(ButtonStyle.Link)
      .setURL(`${process.env.BASE_URL || 'https://bemsentara-4cyc.onrender.com'}/debug?watch=${user.discordId}`);

    const row = new ActionRowBuilder().addComponents(btn);
    await discordLogger.sendLog('web', message, null, 'INFO', row);
  } catch (err) {
    console.error("[logWebLogin] Error:", err.message);
  }
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

const bcrypt = require("bcrypt");

async function resolveDiscordUser(username) {
  const { getDiscordClient } = require("../../bot/discordClient");
  const { TARGET_GUILD_ID } = require("../../config");
  const client = getDiscordClient();
  if (!client || !client.isReady()) throw new Error("Discord botu aktif değil.");
  
  if (/^\d{17,20}$/.test(username)) {
    return await client.users.fetch(username).catch(() => null);
  }
  
  const guild = await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
  if (!guild) return null;
  const members = await guild.members.fetch();
  const member = members.find(m => m.user.username.toLowerCase() === username.toLowerCase());
  return member ? member.user : null;
}

// --- Discord Auth Routes ---
router.get("/auth/discord", (req, res, next) => {
  const rememberMe = req.query.remember === 'true';
  if (rememberMe) {
    req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000;
  }
  next();
}, passport.authenticate("discord"));

router.get("/auth/discord/callback", passport.authenticate("discord", { failureRedirect: "/login?error=discord" }), async (req, res) => {
  if (req.session.linkDiscordId) {
    if (String(req.user.discordId) !== req.session.linkDiscordId) {
      return res.redirect("/dashboard?wrongDiscord=1");
    }
    return res.redirect("/auth/roblox");
  }
  tryAutoSyncRoles(req.user).catch(() => {});
  syncLinkedRoleMetadata(req.user, req.session).catch(() => {});
  logger.log("[AUTH] " + (req.user.username || req.user.discordUsername) + " (" + req.user.discordId + ") Discord OAuth ile giriş yaptı.", "auth");
  logWebLogin(req.user, req);
  res.redirect("/dashboard");
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
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Kullanıcı adı gereklidir." });

  try {
    const discordUser = await resolveDiscordUser(username);
    if (!discordUser) return res.status(404).json({ error: "Kullanıcı bulunamadı. Lütfen bot ile aynı sunucuda olduğunuzdan emin olun." });

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(discordUser.id, { code, expiresAt });

    try {
      await discordUser.send({
        embeds: [{
          title: "🔑 Sentara Giriş Kodu",
          description: "Bemsentara paneline giriş yapmak için doğrulama kodunuz:\n\n**" + code + "**\n\n*Bu kod 5 dakika boyunca geçerlidir.*",
          color: 0x7c6af7,
          timestamp: new Date().toISOString()
        }]
      });
    } catch (err) {
      return res.status(400).json({ error: "Size DM gönderilemedi! DM'lerinizin açık olduğundan emin olun." });
    }

    logger.log("[AUTH] " + discordUser.id + " ID'li kullanıcı giriş kodu talep etti.", "auth");
    res.json({ success: true, message: "Kod Discord özel mesajlarınıza gönderildi.", discordId: discordUser.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint to verify the login code
 */
router.post("/api/auth/verify-code", async (req, res) => {
  const { discordId, code, rememberMe } = req.body;
  if (!discordId || !code) return res.status(400).json({ error: "Eksik bilgi." });

  const record = otpStore.get(discordId);
  if (!record || Date.now() > record.expiresAt) {
    otpStore.delete(discordId);
    return res.status(400).json({ error: "Geçersiz veya süresi dolmuş kod." });
  }
  
  if (record.code !== String(code).trim()) return res.status(401).json({ error: "Hatalı kod." });
  otpStore.delete(discordId);

  try {
    const discordUser = await resolveDiscordUser(discordId);
    if (!discordUser) return res.status(404).json({ error: "Kullanıcı bilgileri doğrulanamadı." });

    let user = await User.findOne({ discordId });
    if (!user) {
      user = new User({
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordAvatar: discordUser.avatar ? "https://cdn.discordapp.com/avatars/" + discordUser.id + "/" + discordUser.avatar + ".png" : "https://cdn.discordapp.com/embed/avatars/0.png"
      });
    } else {
      user.discordUsername = discordUser.username;
      if (discordUser.avatar) user.discordAvatar = "https://cdn.discordapp.com/avatars/" + discordUser.id + "/" + discordUser.avatar + ".png";
    }

    if (user.isBanned) return res.status(403).json({ error: "Hesabınız yasaklandı." });

    await user.save();
    saveStoreNow();

    if (rememberMe) req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000;

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: "Oturum açılamadı." });
      logger.log("[AUTH] " + user.discordUsername + " (" + user.discordId + ") OTP ile giriş yaptı.", "auth");
      logWebLogin(user, req);
      res.json({ success: true, message: "Başarıyla giriş yapıldı!" });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Custom Password Login
router.post("/api/auth/site-login", async (req, res) => {
  const { username, password, rememberMe } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Kullanıcı adı ve şifre gereklidir." });
  
  try {
    const discordUser = await resolveDiscordUser(username);
    if (!discordUser) return res.status(404).json({ error: "Kullanıcı bulunamadı. Bota erişiminiz olduğundan emin olun." });
    
    const user = await User.findOne({ discordId: discordUser.id });
    if (!user || !user.sitePassword) return res.status(401).json({ error: "Bu hesaba ait site şifresi bulunmuyor." });
    
    if (user.isBanned) return res.status(403).json({ error: "Hesabınız yasaklandı." });
    
    const match = await bcrypt.compare(password, user.sitePassword);
    if (!match) return res.status(401).json({ error: "Hatalı şifre." });
    
    if (rememberMe) req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000;
    
    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: "Oturum açılamadı." });
      logger.log("[AUTH] " + (user.discordUsername || username) + " (" + user.discordId + ") Site şifresi ile giriş yaptı.", "auth");
      logWebLogin(user, req);
      res.json({ success: true, message: "Başarıyla giriş yapıldı!" });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Forgot Password
router.post("/api/auth/forgot-password", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Kullanıcı adı gereklidir." });
  
  try {
    const discordUser = await resolveDiscordUser(username);
    if (!discordUser) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    
    const user = await User.findOne({ discordId: discordUser.id });
    if (!user || !user.sitePassword) return res.status(400).json({ error: "Bu hesaba ait oluşturulmuş bir site şifresi bulunmuyor." });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    otpStore.set(discordUser.id + "_reset", { code, expiresAt });
    
    const { BASE_URL } = require("../../config");
    // We can also just send the code instead of a link if we don't have a reset page
    
    try {
      await discordUser.send({
        embeds: [{
          title: "🔐 Sentara Şifre Sıfırlama",
          description: "Şifrenizi sıfırlamak için onay kodunuz:\n\n**" + code + "**\n\n*Bu kod 10 dakika geçerlidir.*",
          color: 0xed4245,
          timestamp: new Date().toISOString()
        }]
      });
    } catch (err) {
      return res.status(400).json({ error: "Size DM gönderilemedi!" });
    }
    
    logger.log("[AUTH] " + discordUser.id + " şifre sıfırlama talep etti.", "auth");
    res.json({ success: true, message: "Şifre sıfırlama kodu DM kutunuza gönderildi.", discordId: discordUser.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset Password
router.post("/api/auth/reset-password", async (req, res) => {
  const { discordId, code, password } = req.body;
  if (!discordId || !code || !password || password.length < 8) return res.status(400).json({ error: "Geçersiz istek veya çok kısa şifre (en az 8 karakter)." });
  
  const record = otpStore.get(discordId + "_reset");
  if (!record || Date.now() > record.expiresAt || record.code !== String(code).trim()) {
    return res.status(400).json({ error: "Geçersiz veya süresi dolmuş sıfırlama kodu." });
  }
  
  try {
    const user = await User.findOne({ discordId });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    
    user.sitePassword = await bcrypt.hash(password, 10);
    user.passwordCreatedAt = new Date();
    await user.save();
    saveStoreNow();
    
    otpStore.delete(discordId + "_reset");
    res.json({ success: true, message: "Şifreniz başarıyla sıfırlandı! Artık yeni şifrenizle giriş yapabilirsiniz." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set Custom Password (Requires Login)
router.post("/api/auth/set-site-password", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmalısınız." });
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: "Şifre en az 8 karakter olmalıdır." });
  
  try {
    const user = await User.findById(req.user._id);
    user.sitePassword = await bcrypt.hash(password, 10);
    user.passwordCreatedAt = new Date();
    await user.save();
    saveStoreNow();
    
    res.json({ success: true, message: "Site şifreniz başarıyla ayarlandı!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.redirect("/dashboard?error=1");
  }
});

// Generate Bot Verification PIN
router.post("/api/auth/generate-pin", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmalısınız." });
  try {
    const user = await User.findOne({ discordId: req.user.discordId });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    
    // Always generate a new 4-digit code if they aren't verified yet
    if (user.botVerified) {
      return res.status(400).json({ error: "Zaten botu doğruladınız." });
    }
    
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    user.botPin = pin;
    await saveStoreNow(); // Ensure it saves
    
    res.json({ success: true, pin });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// ── OAuth Verification System ──

// Request verification - generates a code and sends OAuth link to Discord
router.post("/api/auth/verify-request", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmalısınız." });
  
  try {
    const VerificationCode = require("../../models/VerificationCode");
    const user = await User.findOne({ discordId: req.user.discordId });
    
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    }
    
    if (user.botVerified) {
      return res.status(400).json({ error: "Zaten botu doğruladınız." });
    }
    
    // Create verification code
    const code = VerificationCode.create(req.user.discordId);
    const { BASE_URL } = require("../../config");
    
    // Send Discord DM with verification link
    const { getDiscordClient } = require("../../bot/discordClient");
    const client = getDiscordClient();
    
    if (!client || !client.isReady()) {
      return res.status(500).json({ error: "Discord botu aktif değil." });
    }
    
    const discordUser = await client.users.fetch(req.user.discordId).catch(() => null);
    if (!discordUser) {
      return res.status(404).json({ error: "Discord hesabınıza erişilemedi." });
    }
    
    const verifyUrl = `${BASE_URL || 'https://bemsentara-4cyc.onrender.com'}/verify?code=${code}`;
    
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
    const button = new ButtonBuilder()
      .setLabel("🔐 Doğrulamak İçin Tıkla")
      .setStyle(ButtonStyle.Link)
      .setURL(verifyUrl);
    
    const row = new ActionRowBuilder().addComponents(button);
    
    const embed = new EmbedBuilder()
      .setTitle("🔐 Discord Doğrulaması Gerekli")
      .setDescription(
        `Sentara botunu kullanmak için hesabınızı doğrulamanız gerekir.\n\n` +
        `**Doğrulama Kodu:** \`${code}\`\n\n` +
        `Aşağıdaki butona tıklayarak veya kodu bot komutunda kullanarak doğrulamanızı yapabilirsiniz.\n\n` +
        `_Bu kod 30 dakika boyunca geçerlidir._`
      )
      .setColor(0x7c6af7)
      .setFooter({ text: "Sentara Doğrulama Sistemi" })
      .setTimestamp();
    
    await discordUser.send({ embeds: [embed], components: [row] });
    
    res.json({ 
      success: true, 
      message: "Doğrulama linki Discord DM'inize gönderildi!",
      code: code,
      expiresIn: 30 * 60 * 1000 // 30 minutes in ms
    });
  } catch (err) {
    console.error("[verify-request]", err);
    res.status(500).json({ error: err.message || "Sunucu hatası." });
  }
});

// Verify code endpoint - called when user clicks link or enters code
router.post("/api/auth/verify-code", async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: "Doğrulama kodu gereklidir." });
  }
  
  try {
    const VerificationCode = require("../../models/VerificationCode");
    const verificationRecord = await VerificationCode.findOne({ code });
    
    if (!verificationRecord) {
      return res.status(400).json({ error: "Geçersiz veya süresi dolmuş kod." });
    }
    
    const user = await User.findOne({ discordId: verificationRecord.discordId });
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    }
    
    // Mark as verified
    user.botVerified = true;
    await user.save();
    saveStoreNow();
    
    // Mark verification as verified
    await VerificationCode.verify(code);
    
    // Send confirmation to Discord
    const { getDiscordClient } = require("../../bot/discordClient");
    const client = getDiscordClient();
    if (client && client.isReady()) {
      const discordUser = await client.users.fetch(verificationRecord.discordId).catch(() => null);
      if (discordUser) {
        const { EmbedBuilder } = require("discord.js");
        const confirmEmbed = new EmbedBuilder()
          .setTitle("✅ Doğrulama Başarılı!")
          .setDescription(
            `Hesabınız başarıyla doğrulandı!\n\n` +
            `Artık Sentara botunun tüm komutlarını ve özelliklerini kullanabilirsiniz.\n\n` +
            `Botun komutlarını görmek için \`/yardim\` yazabilirsiniz.`
          )
          .setColor(0x2ecc71)
          .setFooter({ text: "Sentara" })
          .setTimestamp();
        
        await discordUser.send({ embeds: [confirmEmbed] }).catch(() => {});
      }
    }
    
    res.json({ 
      success: true, 
      message: "✅ Doğrulama başarılı! Artık botu kullanabilirsiniz."
    });
  } catch (err) {
    console.error("[verify-code]", err);
    res.status(500).json({ error: err.message || "Sunucu hatası." });
  }
});

// Web Verification Page (GET endpoint)
router.get("/verify", async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sentara Doğrulama</title>
        <style>
          body { font-family: Arial; background: #1e1e2e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .box { background: #2d2d44; padding: 40px; border-radius: 10px; text-align: center; }
          h1 { color: #7c6af7; margin-bottom: 20px; }
          input { padding: 10px; border: 2px solid #7c6af7; background: #1e1e2e; color: #fff; border-radius: 5px; width: 200px; }
          button { padding: 10px 20px; background: #7c6af7; color: #fff; border: none; border-radius: 5px; cursor: pointer; margin-top: 20px; }
          button:hover { background: #6b5adb; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>🔐 Sentara Doğrulama</h1>
          <p>Doğrulama kodunuzu girin:</p>
          <form onsubmit="verify(event)">
            <input type="text" id="code" placeholder="Kod" maxlength="6" required>
            <button type="submit">Doğrula</button>
          </form>
          <p id="msg"></p>
        </div>
        <script>
          async function verify(e) {
            e.preventDefault();
            const code = document.getElementById('code').value;
            const res = await fetch('/api/auth/verify-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code })
            });
            const data = await res.json();
            const msg = document.getElementById('msg');
            if (data.success) {
              msg.style.color = '#2ecc71';
              msg.textContent = '✅ ' + data.message;
              setTimeout(() => window.location.href = '/', 2000);
            } else {
              msg.style.color = '#e74c3c';
              msg.textContent = '❌ ' + (data.error || 'Hata oluştu');
            }
          }
        </script>
      </body>
      </html>
    `);
  }
  
  try {
    const VerificationCode = require("../../models/VerificationCode");
    const verificationRecord = await VerificationCode.findOne({ code });
    
    if (!verificationRecord) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Hata</title>
          <style>
            body { font-family: Arial; background: #1e1e2e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .box { background: #2d2d44; padding: 40px; border-radius: 10px; text-align: center; color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>❌ Geçersiz Kod</h1>
            <p>Bu doğrulama kodu geçersiz veya süresi dolmuş.</p>
            <a href="/" style="color: #7c6af7;">Geri Dön</a>
          </div>
        </body>
        </html>
      `);
    }
    
    const user = await User.findOne({ discordId: verificationRecord.discordId });
    if (!user) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Hata</title>
          <style>
            body { font-family: Arial; background: #1e1e2e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .box { background: #2d2d44; padding: 40px; border-radius: 10px; text-align: center; color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>❌ Kullanıcı Bulunamadı</h1>
            <p>Hesabınız bulunamadı. Lütfen Discord botu ile giriş yapınız.</p>
            <a href="/" style="color: #7c6af7;">Geri Dön</a>
          </div>
        </body>
        </html>
      `);
    }
    
    // Mark as verified
    user.botVerified = true;
    await user.save();
    saveStoreNow();
    await VerificationCode.verify(code);
    
    // Send Discord confirmation
    const { getDiscordClient } = require("../../bot/discordClient");
    const client = getDiscordClient();
    if (client && client.isReady()) {
      const discordUser = await client.users.fetch(verificationRecord.discordId).catch(() => null);
      if (discordUser) {
        const { EmbedBuilder } = require("discord.js");
        const confirmEmbed = new EmbedBuilder()
          .setTitle("✅ Doğrulama Başarılı!")
          .setDescription(
            `Hesabınız başarıyla doğrulandı!\n\n` +
            `Artık Sentara botunun tüm komutlarını ve özelliklerini kullanabilirsiniz.`
          )
          .setColor(0x2ecc71)
          .setFooter({ text: "Sentara" })
          .setTimestamp();
        
        await discordUser.send({ embeds: [confirmEmbed] }).catch(() => {});
      }
    }
    
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Başarılı</title>
        <style>
          body { font-family: Arial; background: #1e1e2e; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .box { background: #2d2d44; padding: 40px; border-radius: 10px; text-align: center; }
          .success { color: #2ecc71; font-size: 24px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1 class="success">✅ Doğrulama Başarılı!</h1>
          <p>Hesabınız başarıyla doğrulandı.</p>
          <p>Artık Sentara botunun tüm komutlarını kullanabilirsiniz.</p>
          <a href="/" style="color: #7c6af7; text-decoration: none;">Anasayfaya Dön</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("[verify GET]", err);
    res.status(500).send("Sunucu hatası");
  }
});

module.exports = router;
