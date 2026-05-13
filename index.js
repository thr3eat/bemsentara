require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cron = require("node-cron");
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
} = require("discord.js");

// ═══════════════════════════════════════════════════════════════════════════════
// ═                               CONFIGURATION                                 ═
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TARGET_GROUP_ID = 8505535;
const MIN_ROLE_ID = 33;
const DB_URL = process.env.MONGODB_URI || "mongodb://localhost:27017/sentara";

// ═══════════════════════════════════════════════════════════════════════════════
// ═                            DATABASE SCHEMAS                                 ═
// ═══════════════════════════════════════════════════════════════════════════════

const userSchema = new mongoose.Schema(
  {
    discordId: String,
    discordUsername: String,
    discordAvatar: String,
    discordEmail: String,

    robloxId: Number,
    robloxUsername: String,
    robloxAvatar: String,
    robloxAccessToken: String,
    robloxRefreshToken: String,

    isAuthorized: { type: Boolean, default: false },
    authorizedAt: Date,
    authorizedBy: String,

    groupRole: { roleId: Number, roleName: String },
    canSetRole: { type: Boolean, default: false },
    canManageMembers: { type: Boolean, default: false },
    canManageRequests: { type: Boolean, default: false },
    canCreateEmbeds: { type: Boolean, default: false },

    profileBio: String,
    profileColor: { type: String, default: "#7c6af7" },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const embedTemplateSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    title: String,
    description: String,
    color: String,
    footer: String,
    imageUrl: String,
    createdAt: { type: Date, default: Date.now },
  }
);

const auditLogSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    action: String,
    targetUser: String,
    details: {},
    success: Boolean,
    error: String,
    timestamp: { type: Date, default: Date.now },
  }
);

const User = mongoose.model("User", userSchema);
const EmbedTemplate = mongoose.model("EmbedTemplate", embedTemplateSchema);
const AuditLog = mongoose.model("AuditLog", auditLogSchema);

// ═══════════════════════════════════════════════════════════════════════════════
// ═                          ROBLOX API HELPERS                                 ═
// ═══════════════════════════════════════════════════════════════════════════════

let xcsrfToken = "";

async function getCSRFToken() {
  try {
    await axios.post("https://auth.roblox.com/v2/logout", {}, {
      headers: {
        Cookie: `.ROBLOSECURITY=${process.env.ROBLOX_COOKIE || ""}`,
      },
    });
  } catch (e) {
    if (e.response?.headers["x-csrf-token"]) {
      xcsrfToken = e.response.headers["x-csrf-token"];
    }
  }
  return xcsrfToken;
}

async function robloxGet(url, token = "") {
  const headers = {
    Cookie: `.ROBLOSECURITY=${token || process.env.ROBLOX_COOKIE || ""}`,
  };
  const res = await axios.get(url, { headers });
  return res.data;
}

async function robloxPost(url, body, token = "") {
  if (!xcsrfToken) await getCSRFToken();
  const headers = {
    Cookie: `.ROBLOSECURITY=${token || process.env.ROBLOX_COOKIE || ""}`,
    "X-CSRF-TOKEN": xcsrfToken,
    "Content-Type": "application/json",
  };
  const res = await axios.post(url, body, { headers });
  return res.data;
}

async function robloxPatch(url, body, token = "") {
  if (!xcsrfToken) await getCSRFToken();
  const headers = {
    Cookie: `.ROBLOSECURITY=${token || process.env.ROBLOX_COOKIE || ""}`,
    "X-CSRF-TOKEN": xcsrfToken,
    "Content-Type": "application/json",
  };
  const res = await axios.patch(url, body, { headers });
  return res.data;
}

async function robloxDelete(url, token = "") {
  if (!xcsrfToken) await getCSRFToken();
  const headers = {
    Cookie: `.ROBLOSECURITY=${token || process.env.ROBLOX_COOKIE || ""}`,
    "X-CSRF-TOKEN": xcsrfToken,
  };
  const res = await axios.delete(url, { headers });
  return res.data;
}

async function getUserIdFromUsername(username) {
  const data = await robloxPost(
    "https://users.roblox.com/v1/usernames/users",
    { usernames: [username], excludeBannedUsers: false }
  );
  if (data.data?.[0]) return data.data[0].id;
  throw new Error(`Kullanıcı bulunamadı: ${username}`);
}

async function getGroupInfo(groupId) {
  return robloxGet(`https://groups.roblox.com/v1/groups/${groupId}`);
}

async function getGroupRoles(groupId) {
  const data = await robloxGet(
    `https://groups.roblox.com/v1/groups/${groupId}/roles`
  );
  return data.roles;
}

async function setUserRole(groupId, userId, roleId, token = "") {
  return robloxPatch(
    `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
    { roleId },
    token
  );
}

async function kickGroupMember(groupId, userId, token = "") {
  return robloxDelete(
    `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
    token
  );
}

async function acceptJoinRequest(groupId, userId, token = "") {
  return robloxPost(
    `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`,
    {},
    token
  );
}

async function declineJoinRequest(groupId, userId, token = "") {
  return robloxDelete(
    `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`,
    token
  );
}

async function getUserRoleInGroup(groupId, userId, token = "") {
  const data = await robloxGet(
    `https://groups.roblox.com/v2/users/${userId}/groups/roles`,
    token
  );
  const group = data.data?.find((g) => g.group.id == groupId);
  return group?.role || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═                          DISCORD BOT SETUP                                  ═
// ═══════════════════════════════════════════════════════════════════════════════

const discordBot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const botSlashCommands = [
  new SlashCommandBuilder()
    .setName("authorize")
    .setDescription("Sentara Bot ile Roblox hesabını yetkilendir")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Profil bilgilerini göster")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("Roblox grubunda rütbe ver")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName("roleid").setDescription("Rol ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kickmember")
    .setDescription("Gruptan üyeyi at")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("groupinfo")
    .setDescription("Grup bilgilerini göster"),
].map((c) => c.toJSON());

async function registerDiscordCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    console.log("Discord slash komutları kaydediliyor...");
    await rest.put(Routes.applicationCommands(process.env.BOTID), {
      body: botSlashCommands,
    });
    console.log("✅ Komutlar başarıyla kaydedildi.");
  } catch (err) {
    console.error("Komut kayıt hatası:", err);
  }
}

discordBot.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const user = await User.findOne({ discordId: userId });

    // ── /authorize ──
    if (interaction.commandName === "authorize") {
      const authUrl = `${BASE_URL}/auth/authorize?discordId=${userId}`;
      const embed = new EmbedBuilder()
        .setTitle("🔐 Hesabınızı Yetkilendirin")
        .setDescription(
          `[Tıklayın ve Roblox hesabınızla giriş yapın](${authUrl})`
        )
        .setColor(0x7c6af7)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /profile ──
    if (interaction.commandName === "profile") {
      if (!user) {
        const embed = new EmbedBuilder()
          .setTitle("❌ Yetkisiz")
          .setDescription("Önce `/authorize` komutu ile hesabınızı bağlayın.")
          .setColor(0xed4245);
        return interaction.editReply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${user.robloxUsername}`)
        .setThumbnail(user.robloxAvatar)
        .setColor(user.profileColor || 0x7c6af7)
        .addFields(
          {
            name: "🎮 Roblox",
            value: `**ID:** ${user.robloxId}\n**Username:** ${user.robloxUsername}`,
            inline: false,
          },
          {
            name: "💬 Discord",
            value: `**Tag:** ${user.discordUsername}\n**Email:** ${user.discordEmail || "Yok"}`,
            inline: false,
          },
          {
            name: "🎖️ Grup Rolü",
            value: user.groupRole?.roleName || "Rolu yok",
            inline: true,
          },
          {
            name: "📅 Katılım",
            value: `<t:${Math.floor(user.joinedAt / 1000)}:R>`,
            inline: true,
          }
        );

      if (user.profileBio) {
        embed.addFields({
          name: "📝 Hakkında",
          value: user.profileBio,
          inline: false,
        });
      }

      embed.setFooter({ text: "Sentara Bot • Profili düzenlemek için web sitesini ziyaret edin" });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /setrole ──
    if (interaction.commandName === "setrole") {
      if (
        !user?.isAuthorized ||
        !user?.canSetRole ||
        user?.groupRole?.roleId < MIN_ROLE_ID
      ) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Yetersiz İzin")
              .setDescription(`Rütbe 33 veya daha yüksek olmalısınız.`)
              .setColor(0xed4245),
          ],
        });
      }

      const username = interaction.options.getString("username");
      const roleId = interaction.options.getInteger("roleid");

      try {
        const targetUserId = await getUserIdFromUsername(username);
        await setUserRole(TARGET_GROUP_ID, targetUserId, roleId);

        const embed = new EmbedBuilder()
          .setTitle("✅ Rütbe Güncellendi")
          .setDescription(`${username} kullanıcısına rol **${roleId}** atandı.`)
          .setColor(0x57f287);

        await AuditLog.create({
          userId: user._id,
          action: "setrole",
          targetUser: username,
          details: { roleId },
          success: true,
        });

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await AuditLog.create({
          userId: user._id,
          action: "setrole",
          targetUser: username,
          details: { roleId },
          success: false,
          error: err.message,
        });

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Hata")
              .setDescription(`\`\`\`${err.message}\`\`\``)
              .setColor(0xed4245),
          ],
        });
      }
    }

    // ── /kickmember ──
    if (interaction.commandName === "kickmember") {
      if (
        !user?.isAuthorized ||
        !user?.canManageMembers ||
        user?.groupRole?.roleId < MIN_ROLE_ID
      ) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Yetersiz İzin")
              .setDescription(`Rütbe 33 veya daha yüksek olmalısınız.`)
              .setColor(0xed4245),
          ],
        });
      }

      const username = interaction.options.getString("username");

      try {
        const targetUserId = await getUserIdFromUsername(username);
        await kickGroupMember(TARGET_GROUP_ID, targetUserId);

        const embed = new EmbedBuilder()
          .setTitle("🚪 Üye Atıldı")
          .setDescription(`${username} gruptan çıkarıldı.`)
          .setColor(0xed4245);

        await AuditLog.create({
          userId: user._id,
          action: "kickmember",
          targetUser: username,
          success: true,
        });

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await AuditLog.create({
          userId: user._id,
          action: "kickmember",
          targetUser: username,
          success: false,
          error: err.message,
        });

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Hata")
              .setDescription(`\`\`\`${err.message}\`\`\``)
              .setColor(0xed4245),
          ],
        });
      }
    }

    // ── /groupinfo ──
    if (interaction.commandName === "groupinfo") {
      try {
        const groupInfo = await getGroupInfo(TARGET_GROUP_ID);
        const roles = await getGroupRoles(TARGET_GROUP_ID);

        const embed = new EmbedBuilder()
          .setTitle(`🏛️ ${groupInfo.name}`)
          .setDescription(groupInfo.description || "Açıklama yok")
          .addFields(
            {
              name: "👥 Üye Sayısı",
              value: `${groupInfo.memberCount}`,
              inline: true,
            },
            {
              name: "🎖️ Rütbe Sayısı",
              value: `${roles.length}`,
              inline: true,
            },
            {
              name: "📜 Rolleri",
              value: roles
                .slice(0, 5)
                .map((r) => `\`${r.rank}\` → ${r.name}`)
                .join("\n") || "Yok",
              inline: false,
            }
          )
          .setColor(0x7c6af7)
          .setFooter({ text: "Sentara Bot" });

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Hata")
              .setDescription(err.message)
              .setColor(0xed4245),
          ],
        });
      }
    }
  } catch (err) {
    console.error("Interaction error:", err);
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("❌ Hata")
          .setDescription("Bilinmeyen hata oluştu")
          .setColor(0xed4245),
      ],
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═                          EXPRESS SERVER SETUP                               ═
// ═══════════════════════════════════════════════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb" }));

// Session & Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || "sentara-secret-key",
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongoUrl: DB_URL }),
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Passport Discord
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
        let user = await User.findOne({ discordId: profile.id });
        if (!user) {
          user = new User({
            discordId: profile.id,
            discordUsername: profile.username,
            discordEmail: profile.email,
            discordAvatar: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
          });
        } else {
          user.discordUsername = profile.username;
          user.discordEmail = profile.email;
        }
        await user.save();
        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// ─── Routes ───

// Ana sayfa - Dashboard
app.get("/", async (req, res) => {
  res.send(renderMainPage());
});

// Login
app.get("/login", (req, res) => {
  res.send(renderLoginPage());
});

app.get("/auth/discord", passport.authenticate("discord"));

app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderDashboard(req.user));
});

// Profil sayfası
app.get("/profile/:discordId", async (req, res) => {
  const user = await User.findOne({ discordId: req.params.discordId });
  if (!user) return res.status(404).send("Kullanıcı bulunamadı");
  res.send(renderProfilePage(user));
});

// Profili güncelle
app.post("/api/profile/update", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  const { bio, color } = req.body;
  try {
    req.user.profileBio = bio;
    req.user.profileColor = color;
    await req.user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send(err);
    res.redirect("/");
  });
});

// Yetkilendirme başlat (Discord'dan gelen link)
app.get("/auth/authorize", async (req, res) => {
  const { discordId } = req.query;
  if (!discordId) return res.status(400).send("Discord ID gerekli");

  const authUrl = `${BASE_URL}/auth/roblox?discordId=${discordId}`;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Roblox ile Yetkilendirin</title></head>
    <body style="font-family: Arial; text-align: center; padding: 50px;">
      <h1>Roblox Hesabı ile Devam Edin</h1>
      <p>Lütfen Roblox hesabınız ile giriş yapın.</p>
      <a href="${authUrl}" style="padding: 10px 20px; background: #7c6af7; color: white; text-decoration: none; border-radius: 5px;">
        Roblox ile Giriş Yap
      </a>
    </body>
    </html>
  `);
});

// Roblox OAuth callback
app.get("/auth/roblox", (req, res) => {
  // Bu mock, gerçek Roblox OAuth2 flow'u için daha fazla kurulum gerekir
  const { discordId } = req.query;
  const robloxUsername = req.query.username || "TestUser";
  const robloxId = req.query.userid || 123456;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Roblox Yetkilendirme</title></head>
    <body style="font-family: Arial; padding: 50px;">
      <form method="POST" action="/auth/roblox/confirm">
        <h1>Roblox Hesabınızı Doğrulayın</h1>
        <input type="hidden" name="discordId" value="${discordId}">
        <input type="hidden" name="robloxUsername" value="${robloxUsername}">
        <input type="hidden" name="robloxId" value="${robloxId}">
        <p>Roblox Username: <strong>${robloxUsername}</strong></p>
        <p>Roblox ID: <strong>${robloxId}</strong></p>
        <button type="submit" style="padding: 10px 20px; background: #57f287; border: none; border-radius: 5px; cursor: pointer;">
          Onaylamak Yetkilendirin
        </button>
      </form>
    </body>
    </html>
  `);
});

app.post("/auth/roblox/confirm", async (req, res) => {
  const { discordId, robloxUsername, robloxId } = req.body;

  try {
    let user = await User.findOne({ discordId });
    if (!user) {
      user = new User({ discordId });
    }

    user.robloxId = parseInt(robloxId);
    user.robloxUsername = robloxUsername;
    user.isAuthorized = true;
    user.authorizedAt = new Date();

    // Grup rolünü kontrol et
    try {
      const role = await getUserRoleInGroup(TARGET_GROUP_ID, robloxId);
      if (role) {
        user.groupRole = {
          roleId: role.rank,
          roleName: role.name,
        };

        // Rol ID'si 33 veya daha yüksekse izinler ver
        if (role.rank >= MIN_ROLE_ID) {
          user.canSetRole = true;
          user.canManageMembers = true;
          user.canManageRequests = true;
          user.canCreateEmbeds = true;
        }
      }
    } catch (e) {
      console.log("Grup rolü alınamadı:", e.message);
    }

    await user.save();

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Yetkilendirme Başarılı</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>✅ Yetkilendirme Başarılı!</h1>
        <p>Sentara Bot'u kullanmak için hazırsınız.</p>
        <a href="/dashboard" style="padding: 10px 20px; background: #7c6af7; color: white; text-decoration: none; border-radius: 5px;">
          Dashboard'a Git
        </a>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Hata: ${err.message}`);
  }
});

// ─── EMBED BUILDER API ───

app.post("/api/embed", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  const { channelId, title, description, color, footer, image } = req.body;

  if (!channelId || !title || !description) {
    return res.status(400).json({ error: "Eksik parametreler" });
  }

  try {
    const channel = await discordBot.channels.fetch(channelId);
    const hex = parseInt((color || "#7c6af7").replace("#", ""), 16) || 0x7c6af7;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(hex)
      .setFooter({ text: footer || "Sentara Bot" })
      .setTimestamp();

    if (image) embed.setImage(image);

    await channel.send({ embeds: [embed] });

    await AuditLog.create({
      userId: req.user._id,
      action: "sendEmbed",
      details: { channelId, title },
      success: true,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Embed template kaydet
app.post("/api/embed/save-template", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  const { name, title, description, color, footer, imageUrl } = req.body;

  try {
    const template = new EmbedTemplate({
      userId: req.user._id,
      name,
      title,
      description,
      color,
      footer,
      imageUrl,
    });
    await template.save();
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Embed template listesi
app.get("/api/embed/templates", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  try {
    const templates = await EmbedTemplate.find({ userId: req.user._id });
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GROUP API ───

app.get("/api/group/members", async (req, res) => {
  if (!req.user?.isAuthorized) {
    return res.status(401).json({ error: "Yetkilendirme gerekli" });
  }

  try {
    const groupInfo = await getGroupInfo(TARGET_GROUP_ID);
    res.json({
      success: true,
      groupId: TARGET_GROUP_ID,
      groupName: groupInfo.name,
      memberCount: groupInfo.memberCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AUDIT LOG ───

app.get("/api/audit-logs", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  try {
    const logs = await AuditLog.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═                            RENDER FUNCTIONS                                 ═
// ═══════════════════════════════════════════════════════════════════════════════

function renderMainPage() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sentara Bot - Roblox Group Manager</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
      --accent2: #f76af7;
      --text: #e8e8ff;
      --muted: #7a7a9a;
      --success: #4ade80;
      --error: #f87171;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: linear-gradient(135deg, var(--bg) 0%, #0f0f1a 100%);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    header {
      padding: 2rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      background: rgba(124, 106, 247, 0.05);
      backdrop-filter: blur(10px);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo {
      font-size: 1.8rem;
      font-weight: 800;
      letter-spacing: -1px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .nav {
      display: flex;
      gap: 2rem;
      align-items: center;
    }

    .nav a {
      color: var(--text);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }

    .nav a:hover {
      color: var(--accent);
    }

    .btn {
      padding: 0.7rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.9rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(124, 106, 247, 0.3);
    }

    .btn-outline {
      border: 1px solid var(--border);
      color: var(--text);
      background: transparent;
    }

    .btn-outline:hover {
      border-color: var(--accent);
      background: rgba(124, 106, 247, 0.1);
    }

    main {
      flex: 1;
      padding: 4rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }

    h1 {
      font-size: 3.5rem;
      line-height: 1.1;
      margin-bottom: 1rem;
      font-weight: 800;
    }

    .grad {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: var(--muted);
      font-size: 1.2rem;
      margin-bottom: 3rem;
      max-width: 600px;
    }

    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .feature {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      transition: all 0.3s;
    }

    .feature:hover {
      border-color: var(--accent);
      background: rgba(124, 106, 247, 0.05);
      transform: translateY(-4px);
    }

    .feature-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .feature h3 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
    }

    .feature p {
      color: var(--muted);
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .cta {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 3rem;
      text-align: center;
      margin-top: 3rem;
    }

    footer {
      padding: 2rem;
      text-align: center;
      color: var(--muted);
      font-size: 0.85rem;
      border-top: 1px solid var(--border);
      margin-top: 4rem;
    }

    @media (max-width: 768px) {
      header {
        padding: 1.5rem;
        flex-direction: column;
        gap: 1rem;
      }

      h1 {
        font-size: 2.2rem;
      }

      main {
        padding: 2rem 1rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">sentara</div>
    <nav class="nav">
      <a href="/login">Giriş Yap</a>
      <a href="#features">Özellikler</a>
      <a href="#" class="btn btn-primary">Dashboard</a>
    </nav>
  </header>

  <main>
    <h1>Roblox Grup Yönetimini <span class="grad">Basitleştirin</span></h1>
    <p class="subtitle">Discord ve web arayüzü üzerinden Roblox grubunuzu yönetin. Üyeleri yönetin, rolleri atayın ve embedleri özelleştirin.</p>

    <div id="features" class="features">
      <div class="feature">
        <div class="feature-icon">🎖️</div>
        <h3>Rol Yönetimi</h3>
        <p>Grup üyelerine rütbeler atayın ve yönetin. Rol ID'sine göre otomatik izinler.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">📨</div>
        <h3>Embed Builder</h3>
        <p>Discord kanallarına özel embedleri tasarlayın ve gönderin. Şablonlar kaydedin.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">👥</div>
        <h3>Üye Yönetimi</h3>
        <p>Katılma isteklerini kabul edin/reddedin. Üyeleri gruptan çıkarın.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">🔐</div>
        <h3>Güvenli Yetkilendirme</h3>
        <p>Discord ve Roblox hesabınızla güvenli giriş yapın.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">📊</div>
        <h3>Audit Log</h3>
        <p>Tüm işlemlerinizin günlüğünü tutun ve takip edin.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">⚡</div>
        <h3>7/24 Bot</h3>
        <p>Sentara Bot her zaman çevrimiçi. Discord komutlarını kullanın.</p>
      </div>
    </div>

    <div class="cta">
      <h2>Hazır mısınız?</h2>
      <p style="color: var(--muted); margin: 1rem 0;">Hemen başlayın ve Roblox grubunuzu yönetin.</p>
      <a href="/login" class="btn btn-primary">Giriş Yap / Kayıt Ol</a>
    </div>
  </main>

  <footer>
    © 2025 Sentara Bot. Tüm hakları saklıdır. | bemsentara.onrender.com
  </footer>
</body>
</html>`;
}

function renderLoginPage() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Giriş Yap - Sentara Bot</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
      --accent2: #f76af7;
      --text: #e8e8ff;
      --muted: #7a7a9a;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: linear-gradient(135deg, var(--bg), #0f0f1a);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .container {
      width: 100%;
      max-width: 400px;
      padding: 2rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.5rem;
      text-align: center;
    }

    .logo {
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 1.5rem;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--muted);
      margin-bottom: 2rem;
      font-size: 0.9rem;
    }

    .auth-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .btn {
      padding: 1rem;
      border: none;
      border-radius: 8px;
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.95rem;
      text-decoration: none;
      display: inline-block;
    }

    .btn-discord {
      background: #5865f2;
      color: white;
    }

    .btn-discord:hover {
      background: #4752c4;
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(88, 101, 242, 0.3);
    }

    .btn-roblox {
      background: #d3212c;
      color: white;
    }

    .btn-roblox:hover {
      background: #a21620;
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(211, 33, 44, 0.3);
    }

    .divider {
      margin: 2rem 0;
      color: var(--muted);
      font-size: 0.85rem;
    }

    .back {
      display: inline-block;
      margin-top: 1.5rem;
      color: var(--accent);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }

    .back:hover {
      color: var(--accent2);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">sentara</div>
      <h1>Giriş Yap</h1>
      <p class="subtitle">Discord veya Roblox hesabınızla devam edin</p>

      <div class="auth-buttons">
        <a href="/auth/discord" class="btn btn-discord">🎮 Discord ile Giriş Yap</a>
        <div class="divider">veya</div>
        <a href="/auth/roblox" class="btn btn-roblox">🎪 Roblox ile Giriş Yap</a>
      </div>

      <a href="/" class="back">← Ana Sayfaya Dön</a>
    </div>
  </div>
</body>
</html>`;
}

function renderDashboard(user) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Sentara Bot</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
      --accent2: #f76af7;
      --text: #e8e8ff;
      --muted: #7a7a9a;
      --success: #4ade80;
      --error: #f87171;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: linear-gradient(135deg, var(--bg), #0f0f1a);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
    }

    header {
      background: rgba(124, 106, 247, 0.05);
      border-bottom: 1px solid var(--border);
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid var(--accent);
    }

    .logout {
      color: var(--text);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      transition: all 0.2s;
    }

    .logout:hover {
      border-color: var(--error);
      color: var(--error);
    }

    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .card h3 {
      font-size: 0.9rem;
      color: var(--muted);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .card-value {
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
    }

    .card-desc {
      color: var(--muted);
      font-size: 0.85rem;
    }

    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
    }

    .section h2 {
      font-size: 1.3rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      font-size: 0.9rem;
    }

    input, textarea, select {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.8rem;
      color: var(--text);
      font-family: 'Syne', sans-serif;
      transition: border-color 0.2s;
    }

    input:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
    }

    .btn {
      padding: 0.8rem 1.5rem;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: white;
      border: none;
      border-radius: 8px;
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(124, 106, 247, 0.3);
    }

    .status {
      display: inline-block;
      padding: 0.4rem 0.8rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
    }

    .status-authorized {
      background: rgba(74, 222, 128, 0.2);
      color: var(--success);
    }

    .status-unauthorized {
      background: rgba(248, 113, 113, 0.2);
      color: var(--error);
    }

    .preview {
      background: #1e1e2e;
      border-left: 4px solid var(--accent);
      padding: 1rem;
      border-radius: 6px;
      margin-top: 1rem;
    }

    .tabs {
      display: flex;
      gap: 1rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1.5rem;
    }

    .tab {
      padding: 0.8rem 1rem;
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-family: 'Syne', sans-serif;
      font-weight: 600;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    @media (max-width: 768px) {
      main {
        padding: 1rem;
      }

      .grid {
        grid-template-columns: 1fr;
      }

      header {
        flex-direction: column;
        gap: 1rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">sentara</div>
    <div class="user-info">
      <img src="${user.discordAvatar}" alt="Avatar" class="user-avatar">
      <div>
        <div>${user.discordUsername}</div>
        <small>${user.robloxUsername || 'Yetkilendirmedi'}</small>
      </div>
      <a href="/logout" class="logout">Çıkış</a>
    </div>
  </header>

  <main>
    <div class="grid">
      <div class="card">
        <h3>📊 Durum</h3>
        <div class="card-value">${user.isAuthorized ? '✅' : '❌'}</div>
        <span class="status ${user.isAuthorized ? 'status-authorized' : 'status-unauthorized'}">
          ${user.isAuthorized ? 'Yetkili' : 'Yetkisiz'}
        </span>
      </div>

      <div class="card">
        <h3>🎖️ Rol ID</h3>
        <div class="card-value">${user.groupRole?.roleId || 'N/A'}</div>
        <div class="card-desc">${user.groupRole?.roleName || 'Rol atanmamış'}</div>
      </div>

      <div class="card">
        <h3>📅 Katılım Tarihi</h3>
        <div class="card-value">${new Date(user.joinedAt).toLocaleDateString('tr-TR')}</div>
        <div class="card-desc">${new Date(user.joinedAt).toLocaleDateString('tr-TR', { weekday: 'long' })}</div>
      </div>
    </div>

    <!-- PROFILE SECTION -->
    <div class="section">
      <h2>👤 Profil Bilgileri</h2>

      <div class="form-group">
        <label>Roblox Kullanıcı Adı</label>
        <input type="text" value="${user.robloxUsername || ''}" readonly style="background: var(--bg); cursor: not-allowed;">
      </div>

      <div class="form-group">
        <label>Discord Kullanıcı Adı</label>
        <input type="text" value="${user.discordUsername}" readonly style="background: var(--bg); cursor: not-allowed;">
      </div>

      <div class="form-group">
        <label>Hakkında (Bio)</label>
        <textarea id="bio" placeholder="Kendinizi anlatın...">${user.profileBio || ''}</textarea>
      </div>

      <div class="form-group">
        <label>Profil Rengi</label>
        <input type="color" id="color" value="${user.profileColor || '#7c6af7'}">
      </div>

      <button class="btn" onclick="updateProfile()">💾 Profili Kaydet</button>
    </div>

    <!-- EMBED BUILDER -->
    ${user.canCreateEmbeds ? \`
    <div class="section">
      <h2>📨 Embed Builder</h2>

      <div class="tabs">
        <button class="tab active" onclick="switchTab('builder')">Oluştur</button>
        <button class="tab" onclick="switchTab('templates')">Şablonlar</button>
      </div>

      <div id="builder" class="tab-content active">
        <div class="form-group">
          <label>Discord Channel ID</label>
          <input type="text" id="channelId" placeholder="12345678901234567890">
        </div>

        <div class="form-group">
          <label>Başlık</label>
          <input type="text" id="embedTitle" placeholder="Embed başlığı" value="Duyuru">
        </div>

        <div class="form-group">
          <label>Açıklama</label>
          <textarea id="embedDesc" placeholder="Embed açıklaması...">Sentara Bot ile gönderildi!</textarea>
        </div>

        <div class="form-group">
          <label>Renk (Hex)</label>
          <input type="text" id="embedColor" placeholder="#7c6af7" value="#7c6af7">
        </div>

        <div class="form-group">
          <label>Footer</label>
          <input type="text" id="embedFooter" placeholder="Footer metni" value="Sentara Bot">
        </div>

        <div class="form-group">
          <label>Resim URL (İsteğe bağlı)</label>
          <input type="text" id="embedImage" placeholder="https://...">
        </div>

        <div class="preview" id="preview">
          <div style="font-weight: 700; font-size: 1.1rem;" id="pv-title">Duyuru</div>
          <div style="color: #999; margin-top: 0.5rem;" id="pv-desc">Sentara Bot ile gönderildi!</div>
        </div>

        <button class="btn" onclick="sendEmbed()" style="margin-top: 1.5rem;">📤 Embed Gönder</button>
        <button class="btn" onclick="saveTemplate()" style="margin-top: 1rem; background: var(--surface); border: 1px solid var(--border); color: var(--text);">💾 Şablon Olarak Kaydet</button>
      </div>

      <div id="templates" class="tab-content">
        <div id="templatesList" style="min-height: 200px;">
          <p style="color: var(--muted);">Şablonlar yükleniyor...</p>
        </div>
      </div>
    </div>
    \` : ''}

    <!-- AUDIT LOG -->
    <div class="section">
      <h2>📜 İşlem Günlüğü</h2>
      <div id="auditLog" style="max-height: 400px; overflow-y: auto;">
        <p style="color: var(--muted);">Günlük yükleniyor...</p>
      </div>
    </div>
  </main>

  <script>
    function updateProfile() {
      const bio = document.getElementById('bio').value;
      const color = document.getElementById('color').value;

      fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, color })
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            alert('✅ Profil kaydedildi!');
          }
        });
    }

    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById(tab).classList.add('active');

      if (tab === 'templates') {
        loadTemplates();
      }
    }

    function updatePreview() {
      document.getElementById('pv-title').textContent = document.getElementById('embedTitle').value || 'Başlık';
      document.getElementById('pv-desc').textContent = document.getElementById('embedDesc').value || 'Açıklama';
      document.getElementById('preview').style.borderLeftColor = document.getElementById('embedColor').value;
    }

    document.getElementById('embedTitle').addEventListener('input', updatePreview);
    document.getElementById('embedDesc').addEventListener('input', updatePreview);
    document.getElementById('embedColor').addEventListener('input', updatePreview);

    async function sendEmbed() {
      const channelId = document.getElementById('channelId').value;
      if (!channelId) return alert('Channel ID gerekli!');

      const body = {
        channelId,
        title: document.getElementById('embedTitle').value,
        description: document.getElementById('embedDesc').value,
        color: document.getElementById('embedColor').value,
        footer: document.getElementById('embedFooter').value,
        image: document.getElementById('embedImage').value,
      };

      const res = await fetch('/api/embed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      alert(data.success ? '✅ Embed gönderildi!' : '❌ Hata: ' + data.error);
    }

    async function saveTemplate() {
      const name = prompt('Şablon adı:');
      if (!name) return;

      const body = {
        name,
        title: document.getElementById('embedTitle').value,
        description: document.getElementById('embedDesc').value,
        color: document.getElementById('embedColor').value,
        footer: document.getElementById('embedFooter').value,
        imageUrl: document.getElementById('embedImage').value,
      };

      const res = await fetch('/api/embed/save-template', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      alert(data.success ? '✅ Şablon kaydedildi!' : '❌ Hata');
    }

    async function loadTemplates() {
      const res = await fetch('/api/embed/templates');
      const data = await res.json();
      const html = data.templates.length > 0
        ? data.templates.map(t => \`
          <div style="background: var(--bg); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--border);">
            <strong>\${t.name}</strong>
            <p style="color: var(--muted); font-size: 0.85rem; margin: 0.5rem 0;">\${t.title}</p>
            <button onclick="loadTemplate('\${t._id}')" class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Yükle</button>
          </div>
        \`).join('')
        : '<p style="color: var(--muted);">Henüz şablon yok.</p>';
      document.getElementById('templatesList').innerHTML = html;
    }

    function loadTemplate(id) {
      alert('Şablon yükleme: ' + id);
    }

    async function loadAuditLog() {
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      const html = data.logs.length > 0
        ? data.logs.map(log => \`
          <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
            <strong>\${log.action}</strong>
            <p style="color: var(--muted); font-size: 0.85rem; margin: 0.3rem 0;">
              \${log.targetUser ? 'Hedef: ' + log.targetUser : ''}<br>
              \${new Date(log.timestamp).toLocaleString('tr-TR')}<br>
              \${log.success ? '✅ Başarılı' : '❌ Başarısız'}
            </p>
          </div>
        \`).join('')
        : '<p style="color: var(--muted); padding: 1rem;">İşlem günlüğü boş.</p>';
      document.getElementById('auditLog').innerHTML = html;
    }

    loadAuditLog();
  </script>
</body>
</html>`;
}

function renderProfilePage(user) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${user.robloxUsername} - Profil</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
      --accent2: #f76af7;
      --text: #e8e8ff;
      --muted: #7a7a9a;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: linear-gradient(135deg, var(--bg), #0f0f1a);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
      padding: 2rem;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
    }

    .avatar {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      margin: 0 auto 1rem;
      border: 3px solid var(--accent);
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .roblox-id {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }

    .role {
      display: inline-block;
      background: rgba(124, 106, 247, 0.2);
      color: var(--accent);
      padding: 0.5rem 1rem;
      border-radius: 20px;
      margin-bottom: 2rem;
      font-weight: 700;
    }

    .bio {
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 2rem;
      font-style: italic;
    }

    .info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
    }

    .info-item {
      text-align: left;
    }

    .info-label {
      color: var(--muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .info-value {
      font-weight: 700;
      margin-top: 0.3rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <img src="${user.robloxAvatar || 'https://via.placeholder.com/120'}" alt="Avatar" class="avatar">
      <h1>${user.robloxUsername}</h1>
      <div class="roblox-id">ID: ${user.robloxId}</div>

      ${
        user.groupRole
          ? `<div class="role">🎖️ ${user.groupRole.roleName}</div>`
          : ''
      }

      ${user.profileBio ? `<div class="bio">"${user.profileBio}"</div>` : ''}

      <div class="info">
        <div class="info-item">
          <div class="info-label">Discord</div>
          <div class="info-value">${user.discordUsername}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Katılım</div>
          <div class="info-value">${new Date(user.joinedAt).toLocaleDateString('tr-TR')}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═                         CRON & STARTUP                                     ═
// ═══════════════════════════════════════════════════════════════════════════════

// Self-ping every 14 minutes
cron.schedule("*/14 * * * *", async () => {
  try {
    await axios.get(`${BASE_URL}/api/health`);
    console.log(`[CRON] Self-ping OK - ${new Date().toISOString()}`);
  } catch (e) {
    console.warn("[CRON] Self-ping failed:", e.message);
  }
});

// Hourly CSRF refresh
cron.schedule("0 * * * *", async () => {
  await getCSRFToken();
  console.log("[CRON] CSRF token refreshed");
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    bot: discordBot.user?.tag || "connecting",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═                            START SERVER                                    ═
// ═══════════════════════════════════════════════════════════════════════════════

async function start() {
  try {
    // Database bağlantısı
    await mongoose.connect(DB_URL);
    console.log("✅ MongoDB bağlandı");

    // Discord bot giriş
    await discordBot.login(process.env.TOKEN);
    console.log("✅ Discord bot başlatıldı");

    // Komut kaydı
    await registerDiscordCommands();

    // Express sunucusu
    app.listen(PORT, () => {
      console.log(`🌐 Web sunucusu başlatıldı: ${BASE_URL}`);
      console.log(`📊 Dashboard: ${BASE_URL}/dashboard`);
      console.log(`💬 Discord Bot: ${process.env.BOTID}`);
    });
  } catch (err) {
    console.error("❌ Başlatma hatası:", err);
    process.exit(1);
  }
}

start();