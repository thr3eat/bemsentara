require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const bcrypt = require("bcrypt");
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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
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

const SUPPORT_CATEGORIES = {
  billing: { name: "💳 Ödeme Sorunu", color: 0xff6b6b },
  technical: { name: "🔧 Teknik Sorun", color: 0x4ecdc4 },
  account: { name: "👤 Hesap Sorunu", color: 0x95e1d3 },
  group: { name: "👥 Grup Sorunu", color: 0xf38181 },
  other: { name: "📝 Diğer", color: 0xaa96da },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ═                            DATABASE SCHEMAS                                 ═
// ═══════════════════════════════════════════════════════════════════════════════

const ticketSchema = new mongoose.Schema(
  {
    ticketId: String,
    userId: String,
    userName: String,
    category: String,
    subject: String,
    description: String,
    status: { type: String, enum: ["open", "closed", "pending"], default: "open" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    channelId: String,
    staffAssigned: String,
    messages: [
      {
        authorId: String,
        authorName: String,
        content: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    createdAt: { type: Date, default: Date.now },
    closedAt: Date,
    closeReason: String,
  }
);

const userSchema = new mongoose.Schema(
  {
    discordId: String,
    discordUsername: String,
    discordAvatar: String,
    discordEmail: String,

    robloxId: Number,
    robloxUsername: String,
    robloxAvatar: String,

    isAuthorized: { type: Boolean, default: false },
    isStaff: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },

    groupRole: { roleId: Number, roleName: String },
    canSetRole: { type: Boolean, default: false },
    canManageMembers: { type: Boolean, default: false },
    canManageTickets: { type: Boolean, default: false },

    profileBio: String,
    profileColor: { type: String, default: "#7c6af7" },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Ticket = mongoose.model("Ticket", ticketSchema);
const User = mongoose.model("User", userSchema);

// ═══════════════════════════════════════════════════════════════════════════════
// ═                          DISCORD BOT SETUP                                  ═
// ═══════════════════════════════════════════════════════════════════════════════

const discordBot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const botSlashCommands = [
  new SlashCommandBuilder()
    .setName("support")
    .setDescription("Destek menüsünü aç"),

  new SlashCommandBuilder()
    .setName("mytickets")
    .setDescription("Açık ticket'larını göster")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("closeticket")
    .setDescription("Ticket'ı kapat")
    .addStringOption((o) =>
      o.setName("reason").setDescription("Kapanış sebebi").setRequired(false)
    )
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Profil bilgilerini göster")
    .setDMPermission(true),

  new SlashCommandBuilder()
    .setName("authorize")
    .setDescription("Roblox hesabını yetkilendir")
    .setDMPermission(true),
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

// Helper: Unique Ticket ID
function generateTicketId() {
  return `TK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
}

// Support menu embed
function getSupportMenuEmbed() {
  return new EmbedBuilder()
    .setTitle("🛟 Destek Sistemi / Support System")
    .setDescription(
      "Lütfen aşağıdan bir kategori seçin.\n\nPlease select a category below."
    )
    .setColor(0x7c6af7)
    .setFooter({ text: "Sentara Support • bemsentara.onrender.com" })
    .setImage(
      "https://cdn.discordapp.com/attachments/1234567890/sentara-banner.png"
    );
}

// Support category select menu
function getCategorySelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("support_category")
      .setPlaceholder("Kategori seçin / Select Category")
      .addOptions(
        { label: "💳 Ödeme Sorunu", value: "billing", emoji: "💳" },
        { label: "🔧 Teknik Sorun", value: "technical", emoji: "🔧" },
        { label: "👤 Hesap Sorunu", value: "account", emoji: "👤" },
        { label: "👥 Grup Sorunu", value: "group", emoji: "👥" },
        { label: "📝 Diğer", value: "other", emoji: "📝" }
      )
  );
}

// Support button
function getSupportButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_support_menu")
      .setLabel("🎫 Destek Menüsünü Aç / Open Support Menu")
      .setStyle(ButtonStyle.Primary)
  );
}

discordBot.on("interactionCreate", async (interaction) => {
  // ─────────────────────────────────────────────────────────────────────
  // BUTTON INTERACTIONS
  // ─────────────────────────────────────────────────────────────────────

  if (interaction.isButton()) {
    if (interaction.customId === "open_support_menu") {
      const embed = getSupportMenuEmbed();
      const selectMenu = getCategorySelectMenu();
      return interaction.reply({
        embeds: [embed],
        components: [selectMenu],
        ephemeral: true,
      });
    }

    // Close ticket button
    if (interaction.customId.startsWith("close_ticket_")) {
      const ticketId = interaction.customId.replace("close_ticket_", "");
      const ticket = await Ticket.findOne({ ticketId });

      if (!ticket) {
        return interaction.reply({
          content: "❌ Ticket bulunamadı",
          ephemeral: true,
        });
      }

      if (
        ticket.userId !== interaction.user.id &&
        !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
      ) {
        return interaction.reply({
          content: "❌ Bunu yapmaya yetkili değilsiniz",
          ephemeral: true,
        });
      }

      ticket.status = "closed";
      ticket.closedAt = new Date();
      await ticket.save();

      const channel = await interaction.guild.channels.fetch(ticket.channelId);
      const closeEmbed = new EmbedBuilder()
        .setTitle("🔒 Ticket Kapatıldı")
        .setDescription(`Bu ticket kapatılmıştır.`)
        .setColor(0xed4245)
        .setTimestamp();

      await channel.send({ embeds: [closeEmbed] });
      await channel.edit({ archived: true });

      return interaction.reply({
        content: "✅ Ticket kapatıldı",
        ephemeral: true,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // STRING SELECT INTERACTIONS
  // ─────────────────────────────────────────────────────────────────────

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "support_category") {
      const category = interaction.values[0];

      // Modal göster
      const modal = new ModalBuilder()
        .setCustomId(`support_modal_${category}`)
        .setTitle(`Destek Talebi - ${SUPPORT_CATEGORIES[category].name}`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("support_subject")
            .setLabel("Konu / Subject")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("support_description")
            .setLabel("Açıklama / Description")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("support_priority")
            .setLabel("Öncelik / Priority (low/medium/high)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
      );

      return interaction.showModal(modal);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // MODAL SUBMISSIONS
  // ─────────────────────────────────────────────────────────────────────

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("support_modal_")) {
      const category = interaction.customId.replace("support_modal_", "");
      const subject = interaction.fields.getTextInputValue("support_subject");
      const description = interaction.fields.getTextInputValue(
        "support_description"
      );
      let priority = interaction.fields.getTextInputValue("support_priority") ||
        "medium";

      if (!["low", "medium", "high"].includes(priority)) {
        priority = "medium";
      }

      try {
        // Ticket oluştur
        const ticketId = generateTicketId();
        const guild = interaction.guild;

        // Ticket kategorisini bul veya oluştur
        let ticketCategory = guild.channels.cache.find(
          (c) =>
            c.name === "support-tickets" &&
            c.type === ChannelType.GuildCategory
        );

        if (!ticketCategory) {
          ticketCategory = await guild.channels.create({
            name: "support-tickets",
            type: ChannelType.GuildCategory,
          });
        }

        // Ticket kanalı oluştur
        const ticketChannel = await guild.channels.create({
          name: `${ticketId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: ticketCategory.id,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ],
        });

        // Database'e ticket ekle
        const ticket = new Ticket({
          ticketId,
          userId: interaction.user.id,
          userName: interaction.user.username,
          category,
          subject,
          description,
          priority,
          channelId: ticketChannel.id,
        });

        await ticket.save();

        // Ticket kanalına embed gönder
        const ticketEmbed = new EmbedBuilder()
          .setTitle(`🎫 ${ticketId}`)
          .setColor(SUPPORT_CATEGORIES[category].color)
          .addFields(
            { name: "📋 Konu", value: subject, inline: false },
            { name: "📝 Açıklama", value: description, inline: false },
            { name: "🎯 Öncelik", value: priority.toUpperCase(), inline: true },
            { name: "👤 Açan", value: `<@${interaction.user.id}>`, inline: true },
            { name: "⏰ Tarih", value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
          )
          .setFooter({ text: "Sentara Support" })
          .setTimestamp();

        const closeButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`close_ticket_${ticketId}`)
            .setLabel("🔒 Ticket'ı Kapat")
            .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({
          embeds: [ticketEmbed],
          components: [closeButton],
        });

        await interaction.reply({
          content: `✅ Ticket oluşturuldu: ${ticketChannel}`,
          ephemeral: true,
        });

        return;
      } catch (err) {
        console.error("Ticket oluşturma hatası:", err);
        return interaction.reply({
          content: `❌ Hata: ${err.message}`,
          ephemeral: true,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // SLASH COMMANDS
  // ─────────────────────────────────────────────────────────────────────

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await User.findOne({ discordId: interaction.user.id });

    // ── /support ──
    if (commandName === "support") {
      if (!interaction.guild) {
        return interaction.editReply({
          content: "❌ Bu komut sadece sunucu'da çalışır",
        });
      }

      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageMessages
        )
      ) {
        return interaction.editReply({
          content: "❌ Bunu yapmaya yetkili değilsiniz",
        });
      }

      const embed = getSupportMenuEmbed();
      const button = getSupportButton();

      // Bot mesajını gönder
      const message = await interaction.channel.send({
        embeds: [embed],
        components: [button],
      });

      return interaction.editReply({
        content: "✅ Destek menüsü gönderildi",
      });
    }

    // ── /mytickets ──
    if (commandName === "mytickets") {
      const tickets = await Ticket.find({
        userId: interaction.user.id,
        status: "open",
      });

      if (tickets.length === 0) {
        return interaction.editReply({
          content: "📭 Açık ticket'ınız yok",
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎫 Açık Ticket'larınız")
        .setColor(0x7c6af7)
        .setDescription(
          tickets
            .map(
              (t) =>
                `**${t.ticketId}** - ${t.subject}\n Kategori: ${SUPPORT_CATEGORIES[t.category].name} | Durum: ${t.status}`
            )
            .join("\n\n")
        )
        .setFooter({ text: "Sentara Support" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /closeticket ──
    if (commandName === "closeticket") {
      const reason = interaction.options.getString("reason") || "Belirtilmedi";

      // Kullanıcının açık ticket'ını bul
      const ticket = await Ticket.findOne({
        userId: interaction.user.id,
        status: "open",
      });

      if (!ticket) {
        return interaction.editReply({
          content: "❌ Açık ticket'ınız yok",
        });
      }

      ticket.status = "closed";
      ticket.closedAt = new Date();
      ticket.closeReason = reason;
      await ticket.save();

      const channel = interaction.guild.channels.cache.get(ticket.channelId);
      if (channel) {
        const closeEmbed = new EmbedBuilder()
          .setTitle("🔒 Ticket Kapatıldı")
          .setDescription(`**Sebep:** ${reason}`)
          .setColor(0xed4245)
          .setTimestamp();

        await channel.send({ embeds: [closeEmbed] });
        await channel.edit({ archived: true });
      }

      return interaction.editReply({
        content: "✅ Ticket kapatıldı",
      });
    }

    // ── /profile ──
    if (commandName === "profile") {
      if (!user) {
        const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
        return interaction.editReply({
          content: `❌ Henüz yetkilendirmediniz. [Yetkilendirin](${authUrl})`,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${user.robloxUsername || user.discordUsername}`)
        .setColor(user.profileColor || 0x7c6af7)
        .addFields(
          {
            name: "🎮 Roblox",
            value: `**Username:** ${user.robloxUsername || "Yok"}\n**ID:** ${user.robloxId || "Yok"}`,
            inline: false,
          },
          {
            name: "💬 Discord",
            value: `**Username:** ${user.discordUsername}\n**ID:** ${user.discordId}`,
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
        )
        .setTimestamp();

      if (user.profileBio) {
        embed.addFields({
          name: "📝 Hakkında",
          value: user.profileBio,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /authorize ──
    if (commandName === "authorize") {
      const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
      const embed = new EmbedBuilder()
        .setTitle("🔐 Hesabınızı Yetkilendirin")
        .setDescription(
          `[Tıklayın ve Roblox hesabınızla giriş yapın](${authUrl})`
        )
        .setColor(0x7c6af7);

      return interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error(`[${commandName}] Hata:`, err);
    return interaction.editReply({
      content: `❌ Hata: ${err.message}`,
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

app.get("/", (req, res) => {
  res.send(renderMainPage());
});

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

app.get("/dashboard", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderDashboard(req.user));
});

app.get("/tickets", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderTicketsPage(req.user));
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send(err);
    res.redirect("/");
  });
});

// ─── TICKET API ───

app.get("/api/tickets", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  try {
    const tickets = await Ticket.find({ userId: req.user.discordId }).sort({
      createdAt: -1,
    });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tickets/staff", async (req, res) => {
  if (!req.user?.isStaff && !req.user?.isAdmin) {
    return res.status(403).json({ error: "Yetkilendirme gerekli" });
  }

  try {
    const tickets = await Ticket.find({ status: "open" }).sort({
      createdAt: -1,
    });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tickets/:ticketId/close", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  const { reason } = req.body;

  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ error: "Ticket bulunamadı" });

    if (ticket.userId !== req.user.discordId && !req.user.isStaff) {
      return res.status(403).json({ error: "Yetkilendirme gerekli" });
    }

    ticket.status = "closed";
    ticket.closedAt = new Date();
    ticket.closeReason = reason;
    await ticket.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tickets/:ticketId/message", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  const { content } = req.body;

  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ error: "Ticket bulunamadı" });

    ticket.messages.push({
      authorId: req.user.discordId,
      authorName: req.user.discordUsername,
      content,
    });

    await ticket.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    bot: discordBot.user?.tag || "connecting",
    uptime: process.uptime(),
  });
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
  <title>Sentara - Destek Sistemi</title>
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
      --success: #4ade80;
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
    }

    header {
      padding: 2rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      background: rgba(124, 106, 247, 0.05);
      backdrop-filter: blur(10px);
    }

    .logo {
      font-size: 1.8rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    nav {
      display: flex;
      gap: 2rem;
      align-items: center;
    }

    nav a {
      color: var(--text);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }

    nav a:hover {
      color: var(--accent);
    }

    .btn {
      padding: 0.7rem 1.5rem;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: white;
      border: none;
      border-radius: 8px;
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(124, 106, 247, 0.3);
    }

    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 4rem 2rem;
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
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .feature h3 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
    }

    .feature p {
      color: var(--muted);
      line-height: 1.6;
    }

    footer {
      padding: 2rem;
      text-align: center;
      color: var(--muted);
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
    <nav>
      <a href="#features">Özellikler</a>
      <a href="/login" class="btn">Giriş Yap</a>
    </nav>
  </header>

  <main>
    <h1>Discord'da <span class="grad">Destek Sistemi</span></h1>
    <p class="subtitle">Sentara Bot ile profesyonel destek sistemi kurun. Ticket'ları yönetin, durumları izleyin ve kullanıcılarını mutlu tutun.</p>

    <div id="features" class="features">
      <div class="feature">
        <div class="feature-icon">🎫</div>
        <h3>Ticket Sistemi</h3>
        <p>Discord'da butonla destek talebine başlayın. Otomatik kanal açılır.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">📂</div>
        <h3>Kategorilendirme</h3>
        <p>5 farklı kategori: Ödeme, Teknik, Hesap, Grup, Diğer</p>
      </div>

      <div class="feature">
        <div class="feature-icon">👥</div>
        <h3>Staff Panel</h3>
        <p>Staff üyeleri web panelinde tüm ticket'ları görebilir.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">📊</div>
        <h3>Takip & Yönetim</h3>
        <p>Ticket durumunu izleyin, kapatın, sebep belirtin.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">💬</div>
        <h3>Mesajlaşma</h3>
        <p>Web panelinden ticket'a mesaj ekleyin.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">⚡</div>
        <h3>7/24 Bot</h3>
        <p>Sentara Bot her zaman çevrimiçi.</p>
      </div>
    </div>
  </main>

  <footer>
    © 2025 Sentara Bot Support System
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
  <title>Giriş Yap - Sentara</title>
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
    }

    .back {
      display: inline-block;
      margin-top: 1.5rem;
      color: var(--accent);
      text-decoration: none;
      font-size: 0.9rem;
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
      <p class="subtitle">Discord hesabınızla devam edin</p>

      <div class="auth-buttons">
        <a href="/auth/discord" class="btn btn-discord">🎮 Discord ile Giriş Yap</a>
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
  <title>Dashboard - Sentara</title>
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
      --success: #4ade80;
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
      border-color: var(--accent);
      color: var(--accent);
    }

    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
    }

    .card h3 {
      font-size: 0.85rem;
      color: var(--muted);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
    }

    .card-value {
      font-size: 2.5rem;
      font-weight: 800;
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
    }

    .ticket-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .ticket {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: border-color 0.2s;
    }

    .ticket:hover {
      border-color: var(--accent);
    }

    .ticket-info h4 {
      margin-bottom: 0.3rem;
    }

    .ticket-meta {
      color: var(--muted);
      font-size: 0.85rem;
    }

    .ticket-badge {
      display: inline-block;
      padding: 0.3rem 0.8rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .badge-open {
      background: rgba(74, 222, 128, 0.2);
      color: var(--success);
    }

    .badge-closed {
      background: rgba(248, 113, 113, 0.2);
      color: #f87171;
    }

    @media (max-width: 768px) {
      main {
        padding: 1rem;
      }

      .grid {
        grid-template-columns: 1fr;
      }

      header {
        flex-wrap: wrap;
      }

      .ticket {
        flex-direction: column;
        align-items: flex-start;
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
        <h3>🎫 Açık Ticket'lar</h3>
        <div class="card-value" id="open-count">0</div>
      </div>

      <div class="card">
        <h3>✅ Kapalı Ticket'lar</h3>
        <div class="card-value" id="closed-count">0</div>
      </div>

      <div class="card">
        <h3>📅 Toplam Ticket</h3>
        <div class="card-value" id="total-count">0</div>
      </div>
    </div>

    <div class="section">
      <h2>🎫 Ticket'larınız</h2>
      <div class="ticket-list" id="tickets">
        <p style="color: var(--muted);">Yükleniyor...</p>
      </div>
    </div>
  </main>

  <script>
    async function loadTickets() {
      try {
        const res = await fetch('/api/tickets');
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        const tickets = data.tickets;
        const open = tickets.filter(t => t.status === 'open').length;
        const closed = tickets.filter(t => t.status === 'closed').length;

        document.getElementById('open-count').textContent = open;
        document.getElementById('closed-count').textContent = closed;
        document.getElementById('total-count').textContent = tickets.length;

        const html = tickets.length > 0
          ? tickets.map(t => \`
            <div class="ticket">
              <div class="ticket-info">
                <h4>\${t.ticketId}</h4>
                <div class="ticket-meta">
                  \${t.subject} • Kategori: \${t.category}
                </div>
              </div>
              <span class="ticket-badge \${t.status === 'open' ? 'badge-open' : 'badge-closed'}">
                \${t.status === 'open' ? '🟢 Açık' : '🔴 Kapalı'}
              </span>
            </div>
          \`).join('')
          : '<p style="color: var(--muted);">Henüz ticket\'ınız yok.</p>';

        document.getElementById('tickets').innerHTML = html;
      } catch (err) {
        document.getElementById('tickets').innerHTML = \`<p style="color: #f87171;">❌ \${err.message}</p>\`;
      }
    }

    loadTickets();
    setInterval(loadTickets, 5000); // Her 5 saniyede yenile
  </script>
</body>
</html>`;
}

function renderTicketsPage(user) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket'lar - Sentara</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --border: #2a2a3a;
      --accent: #7c6af7;
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
    }

    header {
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), #f76af7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
    }

    h2 {
      margin-bottom: 1.5rem;
    }

    .ticket-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .ticket-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ticket-card:hover {
      border-color: var(--accent);
      background: rgba(124, 106, 247, 0.05);
    }

    .ticket-id {
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 0.5rem;
    }

    .ticket-subject {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }

    .ticket-meta {
      color: var(--muted);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }

    .back {
      color: var(--accent);
      text-decoration: none;
      font-size: 0.9rem;
    }

    .back:hover {
      color: #f76af7;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">sentara</div>
    <a href="/dashboard" class="back">← Dashboard</a>
  </header>

  <main>
    <div class="section">
      <h2>🎫 Ticket'lar</h2>
      <div class="ticket-grid" id="tickets">
        <p style="color: var(--muted);">Yükleniyor...</p>
      </div>
    </div>
  </main>

  <script>
    async function loadTickets() {
      try {
        const res = await fetch('/api/tickets');
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        const html = data.tickets.length > 0
          ? data.tickets.map(t => \`
            <div class="ticket-card" onclick="alert('Ticket: \${t.ticketId}')">
              <div class="ticket-id">\${t.ticketId}</div>
              <div class="ticket-subject">\${t.subject}</div>
              <div class="ticket-meta">
                Kategori: \${t.category} • Durum: \${t.status}
              </div>
            </div>
          \`).join('')
          : '<p style="color: var(--muted);">Henüz ticket\'ınız yok.</p>';

        document.getElementById('tickets').innerHTML = html;
      } catch (err) {
        document.getElementById('tickets').innerHTML = \`<p style="color: #f87171;">❌ \${err.message}</p>\`;
      }
    }

    loadTickets();
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═                         CRON & STARTUP                                     ═
// ═══════════════════════════════════════════════════════════════════════════════

cron.schedule("*/14 * * * *", async () => {
  try {
    await axios.get(`${BASE_URL}/api/health`);
    console.log(`[CRON] Self-ping OK - ${new Date().toISOString()}`);
  } catch (e) {
    console.warn("[CRON] Self-ping failed:", e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ═                            START SERVER                                    ═
// ═══════════════════════════════════════════════════════════════════════════════

async function start() {
  try {
    await mongoose.connect(DB_URL);
    console.log("✅ MongoDB bağlandı");

    await discordBot.login(process.env.TOKEN);
    console.log("✅ Discord bot başlatıldı");

    await registerDiscordCommands();

    app.listen(PORT, () => {
      console.log(`🌐 Server: ${BASE_URL}`);
      console.log(`🎫 Ticket Sistemi Aktif`);
    });
  } catch (err) {
    console.error("❌ Başlatma hatası:", err);
    process.exit(1);
  }
}

start();