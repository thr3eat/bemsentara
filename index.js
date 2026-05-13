
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const express = require("express");
const axios = require("axios");
const cron = require("node-cron");
const cors = require("cors");

// ─── ENV ───────────────────────────────────────────────────────────────────────
const TOKEN      = process.env.TOKEN;
const BOT_ID     = process.env.BOTID;
const COOKIE     = process.env.COOKIE;
const PORT       = process.env.PORT || 3000;
const BASE_URL   = "https://bemsentara.onrender.com";

// ─── ROBLOX HELPERS ───────────────────────────────────────────────────────────
let xcsrfToken = "";

async function getCSRF() {
  try {
    await axios.post("https://auth.roblox.com/v2/logout", {}, {
      headers: { Cookie: `.ROBLOSECURITY=${COOKIE}` },
    });
  } catch (e) {
    if (e.response?.headers["x-csrf-token"]) {
      xcsrfToken = e.response.headers["x-csrf-token"];
    }
  }
  return xcsrfToken;
}

async function robloxGet(url) {
  const res = await axios.get(url, {
    headers: { Cookie: `.ROBLOSECURITY=${COOKIE}` },
  });
  return res.data;
}

async function robloxPost(url, body) {
  if (!xcsrfToken) await getCSRF();
  const res = await axios.post(url, body, {
    headers: {
      Cookie: `.ROBLOSECURITY=${COOKIE}`,
      "X-CSRF-TOKEN": xcsrfToken,
      "Content-Type": "application/json",
    },
  });
  return res.data;
}

async function robloxPatch(url, body) {
  if (!xcsrfToken) await getCSRF();
  const res = await axios.patch(url, body, {
    headers: {
      Cookie: `.ROBLOSECURITY=${COOKIE}`,
      "X-CSRF-TOKEN": xcsrfToken,
      "Content-Type": "application/json",
    },
  });
  return res.data;
}

async function robloxDelete(url) {
  if (!xcsrfToken) await getCSRF();
  const res = await axios.delete(url, {
    headers: {
      Cookie: `.ROBLOSECURITY=${COOKIE}`,
      "X-CSRF-TOKEN": xcsrfToken,
    },
  });
  return res.data;
}

// Kullanıcı adından ID al
async function getUserId(username) {
  const data = await robloxPost(
    "https://users.roblox.com/v1/usernames/users",
    { usernames: [username], excludeBannedUsers: false }
  );
  if (data.data && data.data.length > 0) return data.data[0].id;
  throw new Error(`Kullanıcı bulunamadı: ${username}`);
}

// Grup rollerini getir
async function getGroupRoles(groupId) {
  const data = await robloxGet(
    `https://groups.roblox.com/v1/groups/${groupId}/roles`
  );
  return data.roles;
}

// Üyenin mevcut rolünü getir
async function getMemberRole(groupId, userId) {
  const data = await robloxGet(
    `https://groups.roblox.com/v2/users/${userId}/groups/roles`
  );
  const group = data.data.find((g) => g.group.id == groupId);
  return group ? group.role : null;
}

// ─── DISCORD CLIENT ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("Roblox grubunda bir kullanıcıya rütbe ver")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName("groupid").setDescription("Grup ID").setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName("roleid").setDescription("Rol ID (rank)").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("acceptjoin")
    .setDescription("Roblox grubuna katılma isteğini kabul et")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName("groupid").setDescription("Grup ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("declinejoin")
    .setDescription("Roblox grubuna katılma isteğini reddet")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName("groupid").setDescription("Grup ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kickmember")
    .setDescription("Roblox grubundan üye at")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName("groupid").setDescription("Grup ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("groupinfo")
    .setDescription("Roblox grup bilgilerini göster")
    .addIntegerOption((o) =>
      o.setName("groupid").setDescription("Grup ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("grouproles")
    .setDescription("Roblox grubundaki rolleri listele")
    .addIntegerOption((o) =>
      o.setName("groupid").setDescription("Grup ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("memberinfo")
    .setDescription("Roblox kullanıcısının grup rolünü göster")
    .addStringOption((o) =>
      o.setName("username").setDescription("Roblox kullanıcı adı").setRequired(true)
    )
    .addIntegerOption((o) =>
      o.setName("groupid").setDescription("Grup ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Özel bir embed mesajı oluştur ve gönder")
    .addStringOption((o) =>
      o.setName("title").setDescription("Embed başlığı").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("description").setDescription("Embed açıklaması").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("color").setDescription("Renk (hex, örn: #ff0000)").setRequired(false)
    )
    .addStringOption((o) =>
      o.setName("footer").setDescription("Footer metni").setRequired(false)
    )
    .addStringOption((o) =>
      o.setName("image").setDescription("Resim URL").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("sendjoinrequest")
    .setDescription("Bot hesabıyla Roblox grubuna katılma isteği gönder")
    .addIntegerOption((o) =>
      o.setName("groupid").setDescription("Grup ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Bot gecikmesini göster"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Tüm komutları listele"),
].map((c) => c.toJSON());

// ─── REGISTER COMMANDS ────────────────────────────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("Slash komutları kaydediliyor...");
    await rest.put(Routes.applicationCommands(BOT_ID), { body: commands });
    console.log("Slash komutları başarıyla kaydedildi.");
  } catch (err) {
    console.error("Komut kayıt hatası:", err);
  }
}

// ─── INTERACTION HANDLER ─────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  await interaction.deferReply();

  try {
    // ── /ping ──
    if (commandName === "ping") {
      const embed = new EmbedBuilder()
        .setTitle("🏓 Pong!")
        .setDescription(`Gecikme: **${client.ws.ping}ms**`)
        .setColor(0x5865f2)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /help ──
    if (commandName === "help") {
      const embed = new EmbedBuilder()
        .setTitle("📋 Sentara Bot — Komutlar")
        .setColor(0x5865f2)
        .setDescription(
          [
            "**Roblox Grup Yönetimi**",
            "`/setrole` — Kullanıcıya rütbe ver",
            "`/acceptjoin` — Katılma isteğini kabul et",
            "`/declinejoin` — Katılma isteğini reddet",
            "`/kickmember` — Gruptan üye at",
            "`/groupinfo` — Grup bilgilerini göster",
            "`/grouproles` — Grup rollerini listele",
            "`/memberinfo` — Üye rol bilgisi",
            "`/sendjoinrequest` — Gruba katılma isteği gönder",
            "",
            "**Yardımcı**",
            "`/embed` — Embed mesajı oluştur",
            "`/ping` — Bot gecikmesi",
            "`/help` — Bu menü",
            "",
            `**API:** ${BASE_URL}/api`,
          ].join("\n")
        )
        .setFooter({ text: "Sentara Bot • bemsentara.onrender.com" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /embed ──
    if (commandName === "embed") {
      const title = interaction.options.getString("title");
      const description = interaction.options.getString("description");
      const colorInput = interaction.options.getString("color") || "#5865F2";
      const footer = interaction.options.getString("footer");
      const image = interaction.options.getString("image");

      const color = parseInt(colorInput.replace("#", ""), 16) || 0x5865f2;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();

      if (footer) embed.setFooter({ text: footer });
      if (image) embed.setImage(image);

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /groupinfo ──
    if (commandName === "groupinfo") {
      const groupId = interaction.options.getInteger("groupid");
      const data = await robloxGet(
        `https://groups.roblox.com/v1/groups/${groupId}`
      );
      const embed = new EmbedBuilder()
        .setTitle(`🏛️ ${data.name}`)
        .setDescription(data.description || "Açıklama yok.")
        .addFields(
          { name: "👥 Üye Sayısı", value: `${data.memberCount}`, inline: true },
          { name: "🆔 Grup ID", value: `${data.id}`, inline: true },
          { name: "👑 Sahip", value: data.owner?.username || "Yok", inline: true },
          { name: "🔒 Herkese Açık", value: data.publicEntryAllowed ? "Evet" : "Hayır", inline: true }
        )
        .setColor(0x5865f2)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /grouproles ──
    if (commandName === "grouproles") {
      const groupId = interaction.options.getInteger("groupid");
      const roles = await getGroupRoles(groupId);
      const roleList = roles
        .map((r) => `**${r.name}** — Rank: \`${r.rank}\` | ID: \`${r.id}\``)
        .join("\n");
      const embed = new EmbedBuilder()
        .setTitle(`🎖️ Grup ${groupId} — Roller`)
        .setDescription(roleList)
        .setColor(0x5865f2)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /memberinfo ──
    if (commandName === "memberinfo") {
      const username = interaction.options.getString("username");
      const groupId = interaction.options.getInteger("groupid");
      const userId = await getUserId(username);
      const role = await getMemberRole(groupId, userId);
      const embed = new EmbedBuilder()
        .setTitle(`👤 ${username}`)
        .addFields(
          { name: "🆔 Roblox ID", value: `${userId}`, inline: true },
          { name: "🎖️ Rol", value: role ? `${role.name} (Rank: ${role.rank})` : "Grupta değil", inline: true }
        )
        .setColor(0x5865f2)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /setrole ──
    if (commandName === "setrole") {
      const username = interaction.options.getString("username");
      const groupId = interaction.options.getInteger("groupid");
      const roleId = interaction.options.getInteger("roleid");
      const userId = await getUserId(username);

      await robloxPatch(
        `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
        { roleId }
      );

      const embed = new EmbedBuilder()
        .setTitle("✅ Rütbe Güncellendi")
        .setDescription(`**${username}** kullanıcısının rolü başarıyla güncellendi.`)
        .addFields(
          { name: "Grup", value: `${groupId}`, inline: true },
          { name: "Yeni Rol ID", value: `${roleId}`, inline: true }
        )
        .setColor(0x57f287)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /acceptjoin ──
    if (commandName === "acceptjoin") {
      const username = interaction.options.getString("username");
      const groupId = interaction.options.getInteger("groupid");
      const userId = await getUserId(username);

      await robloxPost(
        `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`,
        {}
      );

      const embed = new EmbedBuilder()
        .setTitle("✅ Katılma İsteği Kabul Edildi")
        .setDescription(`**${username}** kullanıcısı gruba kabul edildi.`)
        .setColor(0x57f287)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /declinejoin ──
    if (commandName === "declinejoin") {
      const username = interaction.options.getString("username");
      const groupId = interaction.options.getInteger("groupid");
      const userId = await getUserId(username);

      await robloxDelete(
        `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`
      );

      const embed = new EmbedBuilder()
        .setTitle("❌ Katılma İsteği Reddedildi")
        .setDescription(`**${username}** kullanıcısının isteği reddedildi.`)
        .setColor(0xed4245)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /kickmember ──
    if (commandName === "kickmember") {
      const username = interaction.options.getString("username");
      const groupId = interaction.options.getInteger("groupid");
      const userId = await getUserId(username);

      await robloxDelete(
        `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`
      );

      const embed = new EmbedBuilder()
        .setTitle("🚪 Üye Gruptan Atıldı")
        .setDescription(`**${username}** gruptan çıkarıldı.`)
        .setColor(0xed4245)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /sendjoinrequest ──
    if (commandName === "sendjoinrequest") {
      const groupId = interaction.options.getInteger("groupid");
      await robloxPost(
        `https://groups.roblox.com/v1/groups/${groupId}/users`,
        {}
      );
      const embed = new EmbedBuilder()
        .setTitle("📨 Katılma İsteği Gönderildi")
        .setDescription(`Grup **${groupId}** için katılma isteği gönderildi.`)
        .setColor(0x57f287)
        .setFooter({ text: "Sentara Bot" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

  } catch (err) {
    console.error(`[${commandName}] Hata:`, err?.response?.data || err.message);
    const errEmbed = new EmbedBuilder()
      .setTitle("❌ Hata")
      .setDescription(
        `\`\`\`${err?.response?.data?.errors?.[0]?.message || err.message}\`\`\``
      )
      .setColor(0xed4245)
      .setFooter({ text: "Sentara Bot" })
      .setTimestamp();
    return interaction.editReply({ embeds: [errEmbed] });
  }
});

// ─── EXPRESS WEB SERVER ───────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Anasayfa — embed builder arayüzü
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Sentara Bot</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono&display=swap" rel="stylesheet"/>
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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Syne', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    header {
      width: 100%;
      padding: 2rem 4rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      background: rgba(124,106,247,0.04);
    }
    .logo { font-size: 1.6rem; font-weight: 800; letter-spacing: -1px; }
    .logo span { color: var(--accent); }
    .status-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--success);
      display: inline-block; margin-right: 6px;
      box-shadow: 0 0 8px var(--success);
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .status-text { font-size: 0.85rem; color: var(--muted); }
    main { width: 100%; max-width: 960px; padding: 3rem 2rem; }
    h1 { font-size: 2.8rem; font-weight: 800; line-height: 1.1; margin-bottom: 0.5rem; }
    h1 .grad {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .subtitle { color: var(--muted); margin-bottom: 3rem; font-size: 1rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 3rem; }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      transition: border-color .2s;
    }
    .card:hover { border-color: var(--accent); }
    .card h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; }
    .card p { font-size: 0.85rem; color: var(--muted); line-height: 1.5; }
    .card code {
      display: block; margin-top: .5rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem; color: var(--accent);
      background: rgba(124,106,247,0.08);
      padding: .4rem .6rem; border-radius: 6px;
    }
    section.embed-builder {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 3rem;
    }
    section.embed-builder h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: 1.5rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    label { font-size: .8rem; color: var(--muted); display: block; margin-bottom: .3rem; }
    input, textarea, select {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: .6rem .8rem;
      color: var(--text);
      font-family: 'Syne', sans-serif;
      font-size: .9rem;
      outline: none;
      transition: border-color .2s;
    }
    input:focus, textarea:focus { border-color: var(--accent); }
    textarea { resize: vertical; min-height: 80px; }
    .preview {
      background: #1e1e2e;
      border-left: 4px solid #7c6af7;
      border-radius: 0 8px 8px 0;
      padding: 1rem;
      margin-top: 1rem;
    }
    .preview-title { font-size: 1rem; font-weight: 700; }
    .preview-desc { font-size: .85rem; color: #b0b0d0; margin-top: .3rem; }
    .btn {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      border: none; border-radius: 8px;
      padding: .7rem 1.8rem;
      color: #fff; font-family: 'Syne', sans-serif;
      font-size: .9rem; font-weight: 700;
      cursor: pointer; transition: opacity .2s;
      margin-top: 1rem;
    }
    .btn:hover { opacity: .85; }
    .api-table { width: 100%; border-collapse: collapse; }
    .api-table th, .api-table td {
      text-align: left; padding: .7rem 1rem;
      border-bottom: 1px solid var(--border);
      font-size: .85rem;
    }
    .api-table th { color: var(--muted); font-weight: 400; }
    .method {
      display: inline-block;
      padding: .2rem .5rem;
      border-radius: 4px;
      font-family: 'Space Mono', monospace;
      font-size: .75rem;
      font-weight: 700;
    }
    .method.get { background: rgba(74,222,128,.15); color: var(--success); }
    .method.post { background: rgba(124,106,247,.15); color: var(--accent); }
    .method.patch { background: rgba(251,191,36,.15); color: #fbbf24; }
    .method.delete { background: rgba(248,113,113,.15); color: var(--error); }
    footer { padding: 2rem; color: var(--muted); font-size: .8rem; text-align: center; }
    #result { margin-top: 1rem; font-size:.85rem; }
    .ok { color: var(--success); } .err { color: var(--error); }
    @media(max-width:640px){ .grid,.form-row{ grid-template-columns:1fr; } header{ padding:1rem; } }
  </style>
</head>
<body>
<header>
  <div class="logo">sen<span>tara</span></div>
  <div><span class="status-dot"></span><span class="status-text">Çevrimiçi</span></div>
</header>
<main>
  <h1><span class="grad">Sentara</span> Bot</h1>
  <p class="subtitle">Roblox grup yönetimi • Discord entegrasyonu • REST API</p>

  <div class="grid">
    <div class="card">
      <h3>🎖️ Rütbe Yönetimi</h3>
      <p>Roblox grubunda üyelere Discord üzerinden veya API ile rol atayın.</p>
      <code>POST /api/setrole</code>
    </div>
    <div class="card">
      <h3>✅ Katılma İstekleri</h3>
      <p>Grup katılma isteklerini kabul edin veya reddedin.</p>
      <code>POST /api/acceptjoin</code>
    </div>
    <div class="card">
      <h3>📨 Embed Builder</h3>
      <p>Web arayüzünden Discord kanallarına embed mesajı gönderin.</p>
      <code>POST /api/embed</code>
    </div>
    <div class="card">
      <h3>🚪 Üye Yönetimi</h3>
      <p>Grup üyelerini listeleyin, kickleyin veya bilgi alın.</p>
      <code>POST /api/kickmember</code>
    </div>
  </div>

  <!-- EMBED BUILDER -->
  <section class="embed-builder">
    <h2>📨 Web Embed Builder</h2>
    <div class="form-row">
      <div>
        <label>Başlık</label>
        <input id="eb-title" placeholder="Embed başlığı" value="Duyuru"/>
      </div>
      <div>
        <label>Renk (hex)</label>
        <input id="eb-color" placeholder="#7c6af7" value="#7c6af7"/>
      </div>
    </div>
    <div style="margin-bottom:1rem">
      <label>Açıklama</label>
      <textarea id="eb-desc" placeholder="Embed açıklaması...">Sentara Bot ile gönderildi!</textarea>
    </div>
    <div class="form-row">
      <div>
        <label>Footer</label>
        <input id="eb-footer" placeholder="Footer metni" value="Sentara Bot"/>
      </div>
      <div>
        <label>Resim URL (isteğe bağlı)</label>
        <input id="eb-image" placeholder="https://..."/>
      </div>
    </div>
    <div style="margin-bottom:1rem">
      <label>Discord Channel ID</label>
      <input id="eb-channel" placeholder="Channel ID (örn: 1234567890)"/>
    </div>

    <div class="preview" id="embed-preview">
      <div class="preview-title" id="pv-title">Duyuru</div>
      <div class="preview-desc" id="pv-desc">Sentara Bot ile gönderildi!</div>
    </div>

    <button class="btn" onclick="sendEmbed()">Embed Gönder</button>
    <div id="result"></div>
  </section>

  <!-- API DOCS -->
  <section style="margin-bottom:3rem;">
    <h2 style="font-size:1.3rem;font-weight:700;margin-bottom:1rem;">📡 API Endpoints</h2>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
      <table class="api-table">
        <thead><tr><th>Method</th><th>Endpoint</th><th>Açıklama</th></tr></thead>
        <tbody>
          <tr><td><span class="method get">GET</span></td><td>/api/health</td><td>Bot durumu</td></tr>
          <tr><td><span class="method get">GET</span></td><td>/api/groupinfo/:groupId</td><td>Grup bilgisi</td></tr>
          <tr><td><span class="method get">GET</span></td><td>/api/grouproles/:groupId</td><td>Grup rolleri</td></tr>
          <tr><td><span class="method get">GET</span></td><td>/api/memberinfo/:groupId/:username</td><td>Üye rol bilgisi</td></tr>
          <tr><td><span class="method post">POST</span></td><td>/api/setrole</td><td>Rütbe ver</td></tr>
          <tr><td><span class="method post">POST</span></td><td>/api/acceptjoin</td><td>İsteği kabul et</td></tr>
          <tr><td><span class="method post">POST</span></td><td>/api/declinejoin</td><td>İsteği reddet</td></tr>
          <tr><td><span class="method post">POST</span></td><td>/api/kickmember</td><td>Üyeyi at</td></tr>
          <tr><td><span class="method post">POST</span></td><td>/api/embed</td><td>Embed gönder</td></tr>
          <tr><td><span class="method post">POST</span></td><td>/api/sendjoinrequest</td><td>Gruba katılma isteği gönder</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</main>
<footer>Sentara Bot © 2025 • bemsentara.onrender.com</footer>
<script>
  const titleEl = document.getElementById('eb-title');
  const descEl = document.getElementById('eb-desc');
  const colorEl = document.getElementById('eb-color');
  const pvTitle = document.getElementById('pv-title');
  const pvDesc = document.getElementById('pv-desc');
  const preview = document.getElementById('embed-preview');

  function updatePreview() {
    pvTitle.textContent = titleEl.value || 'Başlık';
    pvDesc.textContent = descEl.value || 'Açıklama';
    const c = colorEl.value || '#7c6af7';
    preview.style.borderLeftColor = c;
  }
  titleEl.addEventListener('input', updatePreview);
  descEl.addEventListener('input', updatePreview);
  colorEl.addEventListener('input', updatePreview);

  async function sendEmbed() {
    const channelId = document.getElementById('eb-channel').value.trim();
    if (!channelId) { document.getElementById('result').innerHTML = '<span class="err">Channel ID gerekli!</span>'; return; }
    const body = {
      channelId,
      title: titleEl.value,
      description: descEl.value,
      color: colorEl.value,
      footer: document.getElementById('eb-footer').value,
      image: document.getElementById('eb-image').value,
    };
    try {
      const res = await fetch('/api/embed', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
      const data = await res.json();
      document.getElementById('result').innerHTML = data.success
        ? '<span class="ok">✅ Embed başarıyla gönderildi!</span>'
        : '<span class="err">❌ ' + (data.error || 'Hata') + '</span>';
    } catch(e) {
      document.getElementById('result').innerHTML = '<span class="err">❌ Bağlantı hatası</span>';
    }
  }
</script>
</body>
</html>`);
});

// ─── REST API ─────────────────────────────────────────────────────────────────

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    bot: client.user?.tag || "connecting",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Grup bilgisi
app.get("/api/groupinfo/:groupId", async (req, res) => {
  try {
    const data = await robloxGet(
      `https://groups.roblox.com/v1/groups/${req.params.groupId}`
    );
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Grup rolleri
app.get("/api/grouproles/:groupId", async (req, res) => {
  try {
    const roles = await getGroupRoles(req.params.groupId);
    res.json({ success: true, roles });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Üye bilgisi
app.get("/api/memberinfo/:groupId/:username", async (req, res) => {
  try {
    const userId = await getUserId(req.params.username);
    const role = await getMemberRole(req.params.groupId, userId);
    res.json({ success: true, userId, role });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Rütbe ver
app.post("/api/setrole", async (req, res) => {
  const { groupId, username, roleId } = req.body;
  if (!groupId || !username || !roleId)
    return res.status(400).json({ success: false, error: "groupId, username, roleId gerekli" });
  try {
    const userId = await getUserId(username);
    await robloxPatch(
      `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
      { roleId }
    );
    res.json({ success: true, message: `${username} rolü güncellendi.` });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.response?.data?.errors?.[0]?.message || e.message });
  }
});

// Katılma isteği kabul
app.post("/api/acceptjoin", async (req, res) => {
  const { groupId, username } = req.body;
  if (!groupId || !username)
    return res.status(400).json({ success: false, error: "groupId, username gerekli" });
  try {
    const userId = await getUserId(username);
    await robloxPost(
      `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`,
      {}
    );
    res.json({ success: true, message: `${username} kabul edildi.` });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.response?.data?.errors?.[0]?.message || e.message });
  }
});

// Katılma isteği reddet
app.post("/api/declinejoin", async (req, res) => {
  const { groupId, username } = req.body;
  if (!groupId || !username)
    return res.status(400).json({ success: false, error: "groupId, username gerekli" });
  try {
    const userId = await getUserId(username);
    await robloxDelete(
      `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`
    );
    res.json({ success: true, message: `${username} isteği reddedildi.` });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.response?.data?.errors?.[0]?.message || e.message });
  }
});

// Üyeyi at
app.post("/api/kickmember", async (req, res) => {
  const { groupId, username } = req.body;
  if (!groupId || !username)
    return res.status(400).json({ success: false, error: "groupId, username gerekli" });
  try {
    const userId = await getUserId(username);
    await robloxDelete(
      `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`
    );
    res.json({ success: true, message: `${username} gruptan atıldı.` });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.response?.data?.errors?.[0]?.message || e.message });
  }
});

// Embed gönder (web arayüzünden)
app.post("/api/embed", async (req, res) => {
  const { channelId, title, description, color, footer, image } = req.body;
  if (!channelId || !title || !description)
    return res.status(400).json({ success: false, error: "channelId, title, description gerekli" });
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return res.status(404).json({ success: false, error: "Kanal bulunamadı" });

    const hex = parseInt((color || "#7c6af7").replace("#", ""), 16) || 0x7c6af7;
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(hex)
      .setTimestamp();

    if (footer) embed.setFooter({ text: footer });
    if (image) embed.setImage(image);

    await channel.send({ embeds: [embed] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Gruba katılma isteği gönder
app.post("/api/sendjoinrequest", async (req, res) => {
  const { groupId } = req.body;
  if (!groupId)
    return res.status(400).json({ success: false, error: "groupId gerekli" });
  try {
    await robloxPost(
      `https://groups.roblox.com/v1/groups/${groupId}/users`,
      {}
    );
    res.json({ success: true, message: "Katılma isteği gönderildi." });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.response?.data?.errors?.[0]?.message || e.message });
  }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌐 Web sunucu başlatıldı: http://localhost:${PORT}`);
});

// ─── CRON — Self-ping (Render'ı 7/24 ayakta tutar) ───────────────────────────
// Her 14 dakikada bir kendi URL'sine istek atar (Render free tier uyku moduna geçmez)
cron.schedule("*/14 * * * *", async () => {
  try {
    await axios.get(`${BASE_URL}/api/health`);
    console.log(`[CRON] Self-ping OK — ${new Date().toISOString()}`);
  } catch (e) {
    console.warn("[CRON] Self-ping başarısız:", e.message);
  }
});

// Her saat başı CSRF token yenile
cron.schedule("0 * * * *", async () => {
  await getCSRF();
  console.log("[CRON] CSRF token yenilendi.");
});

// ─── DISCORD LOGIN ────────────────────────────────────────────────────────────
client.once("ready", async () => {
  console.log(`✅ Discord'a giriş yapıldı: ${client.user.tag}`);
  client.user.setActivity("Sentara | /help", { type: 3 }); // WATCHING
  await getCSRF();
  await registerCommands();
});

client.login(TOKEN).catch((err) => {
  console.error("Discord giriş hatası:", err);
  process.exit(1);
});