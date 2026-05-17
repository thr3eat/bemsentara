const express = require("express");
const crypto = require("crypto");
const Ticket = require("../../models/Ticket");
const User = require("../../models/User");
const Economy = require("../../models/Economy");
const { wikiArticles, saveStoreNow } = require("../../models/Store");
const { isSiteAdmin, isSiteStaff } = require("../../utils/adminCheck");
const { SHOP_ITEMS, findItem } = require("../../bot/config/shopItems");

const router = express.Router();

function requireLogin(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Giriş yapmanız gerekli." });
    return false;
  }
  return true;
}

function requireAdmin(req, res) {
  if (!requireLogin(req, res)) return false;
  if (!isSiteAdmin(req.user)) {
    res.status(403).json({ error: "Bu işlem için admin yetkisi gerekli." });
    return false;
  }
  return true;
}

router.get("/api/tickets", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  try {
    const discordId = req.user.discordId;
    const ticketsArray = await Ticket.find({ userId: discordId });
    const tickets = ticketsArray.sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    console.error("Ticket fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Web'den yeni ticket oluştur ──────────────────────────────────────────────
router.post("/api/tickets", async (req, res) => {
  if (!requireLogin(req, res)) return;

  const { category, subject, description, priority } = req.body;
  const s = (subject || "").trim();
  const d = (description || "").trim();
  const c = (category || "").trim();

  if (!c)  return res.status(400).json({ error: "Kategori seçiniz." });
  if (!s)  return res.status(400).json({ error: "Konu başlığı boş olamaz." });
  if (!d)  return res.status(400).json({ error: "Açıklama boş olamaz." });
  if (s.length > 100)  return res.status(400).json({ error: "Konu en fazla 100 karakter olabilir." });
  if (d.length > 2000) return res.status(400).json({ error: "Açıklama en fazla 2000 karakter olabilir." });

  const validPriorities = ["low", "normal", "medium", "high"];
  const prio = validPriorities.includes(priority) ? priority : "medium";

  try {
    const { generateTicketId } = require("../../utils/ticketId");
    const {
      TARGET_GUILD_ID, TARGET_CHANNEL_ID,
      GUILD2_ID, GUILD2_TICKET_CATEGORY_ID,
    } = require("../../config");
    const { ChannelType, PermissionFlagsBits } = require("discord.js");
    const { buildTicketEmbed, buildCloseButton } = require("../../bot/embeds");
    const { getDiscordClient } = require("../../bot/discordClient");

    const ticketId = generateTicketId();

    // ── Discord kanalı aç ──────────────────────────────────────────────────
    let channelId = null;
    let guildId = null;
    let discordChannelMention = null;

    const client = getDiscordClient();
    if (client?.isReady()) {
      // Her iki sunucuda da kanal aç
      const targets = [
        { id: TARGET_GUILD_ID, categoryId: TARGET_CHANNEL_ID },
        { id: GUILD2_ID,       categoryId: GUILD2_TICKET_CATEGORY_ID },
      ];

      for (const target of targets) {
        try {
          const guild = await client.guilds.fetch(target.id).catch(() => null);
          if (!guild) continue;

          const permissionOverwrites = [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: req.user.discordId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
              ],
            },
          ];

          // Kategoriyi belirle
          let parentId = null;
          if (target.categoryId) {
            const ch = await guild.channels.fetch(target.categoryId).catch(() => null);
            if (ch?.type === ChannelType.GuildCategory) parentId = ch.id;
            else if (ch?.type === ChannelType.GuildText) parentId = ch.parentId;
          }
          if (!parentId) {
            // "destek talepleri" kategorisini bul veya oluştur
            let cat = guild.channels.cache.find(
              ch => ch.name.toLowerCase() === "destek talepleri" && ch.type === ChannelType.GuildCategory
            );
            if (!cat) {
              cat = await guild.channels.create({ name: "DESTEK TALEPLERİ", type: ChannelType.GuildCategory });
            }
            parentId = cat.id;
          }

          const ticketChannel = await guild.channels.create({
            name: `ticket-${ticketId.toLowerCase()}`,
            type: ChannelType.GuildText,
            parent: parentId,
            permissionOverwrites,
          });

          // İlk mesaj: embed + kapat butonu + kullanıcı etiketi
          const fakeTicket = {
            ticketId, userId: req.user.discordId, userName: req.user.discordUsername,
            category: c, subject: s, description: d, priority: prio,
            createdAt: new Date(),
          };
          const embed = buildTicketEmbed(fakeTicket);
          const closeBtn = buildCloseButton(ticketId);
          await ticketChannel.send({
            content: `<@${req.user.discordId}> ticket'ın oluşturuldu! 🌐 Web üzerinden açıldı.`,
            embeds: [embed],
            components: [closeBtn],
          });

          // İlk sunucunun kanalını kaydet
          if (!channelId) {
            channelId = ticketChannel.id;
            guildId = guild.id;
            discordChannelMention = `<#${ticketChannel.id}>`;
          }
        } catch (chErr) {
          console.warn(`[webTicket] ${target.id} kanalı açılamadı:`, chErr.message);
        }
      }
    }

    const ticket = new Ticket({
      ticketId,
      userId: req.user.discordId,
      userName: req.user.discordUsername,
      category: c,
      subject: s,
      description: d,
      priority: prio,
      channelId,
      guildId,
      source: "web",
    });

    await ticket.save();
    saveStoreNow();

    try {
      const { logTicketCreated } = require("../../bot/services/ticketLog");
      logTicketCreated(ticket, { source: "Web Panel", ticketChannelId: channelId, guildId });
    } catch (_) {}

    res.json({
      success: true,
      ticket: { ticketId: ticket.ticketId, _id: ticket._id },
      discordChannel: channelId ? `Discord kanalı oluşturuldu: ${discordChannelMention}` : null,
    });
  } catch (err) {
    console.error("Web ticket create error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Web'den ticket yeniden aç ────────────────────────────────────────────────
router.post("/api/tickets/:ticketId/reopen", async (req, res) => {
  if (!requireLogin(req, res)) return;

  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ error: "Ticket bulunamadı." });

    if (ticket.userId !== req.user.discordId && !req.user.isStaff && !isSiteAdmin(req.user)) {
      return res.status(403).json({ error: "Bu ticket size ait değil." });
    }

    if (ticket.status === "open") {
      return res.status(400).json({ error: "Ticket zaten açık." });
    }

    const {
      TARGET_GUILD_ID, TARGET_CHANNEL_ID,
      GUILD2_ID, GUILD2_TICKET_CATEGORY_ID,
    } = require("../../config");
    const { ChannelType, PermissionFlagsBits } = require("discord.js");
    const { buildCloseButton } = require("../../bot/embeds");
    const { getDiscordClient } = require("../../bot/discordClient");
    const { cancelTicketDeletion } = require("../../bot/services/ticketCleanup");

    // Silme kuyruğunu iptal et
    cancelTicketDeletion(ticket.ticketId);

    ticket.status = "open";
    ticket.closedAt = null;
    ticket.closeReason = null;

    const client = getDiscordClient();
    let channelRestored = false;

    if (client?.isReady()) {
      const guildId = ticket.guildId || TARGET_GUILD_ID;

      // Mevcut kanal hâlâ var mı?
      if (ticket.channelId && !ticket.channelDeleted) {
        try {
          const guild = await client.guilds.fetch(guildId);
          const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
          if (channel) {
            await channel.permissionOverwrites.edit(ticket.userId, {
              ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
            });
            const closeBtn = buildCloseButton(ticket.ticketId);
            await channel.send({
              content: `<@${ticket.userId}> ticket'ın yeniden açıldı! 🌐 Web üzerinden açıldı.`,
              components: [closeBtn],
            });
            channelRestored = true;
          }
        } catch (_) {}
      }

      // Kanal silinmişse her iki sunucuda yeniden oluştur
      if (!channelRestored) {
        const targets = [
          { id: TARGET_GUILD_ID, categoryId: TARGET_CHANNEL_ID },
          { id: GUILD2_ID,       categoryId: GUILD2_TICKET_CATEGORY_ID },
        ];

        for (const target of targets) {
          try {
            const guild = await client.guilds.fetch(target.id).catch(() => null);
            if (!guild) continue;

            const permissionOverwrites = [
              { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              {
                id: ticket.userId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks,
                ],
              },
            ];

            let parentId = null;
            if (target.categoryId) {
              const ch = await guild.channels.fetch(target.categoryId).catch(() => null);
              if (ch?.type === ChannelType.GuildCategory) parentId = ch.id;
              else if (ch?.type === ChannelType.GuildText) parentId = ch.parentId;
            }
            if (!parentId) {
              let cat = guild.channels.cache.find(
                ch => ch.name.toLowerCase() === "destek talepleri" && ch.type === ChannelType.GuildCategory
              );
              if (!cat) {
                cat = await guild.channels.create({ name: "DESTEK TALEPLERİ", type: ChannelType.GuildCategory });
              }
              parentId = cat.id;
            }

            const newChannel = await guild.channels.create({
              name: `ticket-${ticket.ticketId.toLowerCase()}`,
              type: ChannelType.GuildText,
              parent: parentId,
              permissionOverwrites,
            });

            const closeBtn = buildCloseButton(ticket.ticketId);
            await newChannel.send({
              content: `<@${ticket.userId}> ticket'ın yeniden açıldı! 🌐 Web üzerinden yeniden açıldı.`,
              components: [closeBtn],
            });

            if (!channelRestored) {
              ticket.channelId = newChannel.id;
              ticket.guildId = guild.id;
              ticket.channelDeleted = false;
              ticket.channelDeletedAt = null;
              channelRestored = true;
            }
          } catch (chErr) {
            console.warn(`[reopenTicket] ${target.id} kanalı açılamadı:`, chErr.message);
          }
        }
      }
    }

    await ticket.save();
    saveStoreNow();

    res.json({
      success: true,
      message: channelRestored
        ? "Ticket yeniden açıldı ve Discord kanalı güncellendi."
        : "Ticket yeniden açıldı.",
    });
  } catch (err) {
    console.error("Reopen ticket error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/tickets/staff", async (req, res) => {
  if (!req.user?.isStaff && !req.user?.isAdmin) {
    return res.status(403).json({ error: "Yetkilendirme gerekli" });
  }

  try {
    const ticketsArray = await Ticket.find({ status: "open" });
    const tickets = ticketsArray.sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/tickets/:ticketId/close", async (req, res) => {
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

    const { logTicketClosed } = require("../../bot/services/ticketLog");
    logTicketClosed(ticket, {
      closedBy: req.user.discordId,
      closedByName: req.user.discordUsername,
      reason,
      source: "Web Panel",
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/tickets/:ticketId/message", async (req, res) => {
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

    const { logTicketMessage } = require("../../bot/services/ticketLog");
    logTicketMessage(ticket, {
      authorId: req.user.discordId,
      authorName: req.user.discordUsername,
      content,
      source: "Web Panel",
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/health", (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    status: "online",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    system: {
      memory: {
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + "MB",
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + "MB",
        rss: Math.round(memory.rss / 1024 / 1024) + "MB",
      },
      nodeVersion: process.version,
      platform: process.platform,
    }
  });
});

// ── Wiki: Makale listesi ─────────────────────────────────────────────────────
router.get("/api/wiki/articles", (req, res) => {
  const list = wikiArticles
    .find({})
    .sort({ createdAt: -1 })
    .map((a) => ({
      _id: a._id,
      title: a.title,
      body: a.body?.slice(0, 200),
      imageUrl: a.imageUrl,
      authorName: a.authorName,
      authorAvatar: a.authorAvatar,
      editedByName: a.editedByName || null,
      editedAt: a.editedAt || null,
      commentCount: (a.comments || []).length,
      views: a.views || 0,
      reactions: a.reactions || {},
      createdAt: a.createdAt,
    }));
  res.json({ success: true, articles: list });
});

// ── Wiki: Makale oluştur ─────────────────────────────────────────────────────
router.post("/api/wiki/articles", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { title, body, imageUrl } = req.body;
  const t = (title || "").trim();
  const b = (body || "").trim();
  if (!t || t.length < 2) return res.status(400).json({ error: "Başlık en az 2 karakter olmalı." });
  if (!b) return res.status(400).json({ error: "Metin boş olamaz." });

  let img = (imageUrl || "").trim();
  if (img && !/^https?:\/\//i.test(img)) return res.status(400).json({ error: "Geçerli bir resim URL'si girin (https://...)." });
  if (!img) img = null;

  try {
    const article = wikiArticles.create({
      title: t.slice(0, 120),
      body: b.slice(0, 20000),
      imageUrl: img,
      authorId: req.user.discordId,
      authorName: req.user.discordUsername,
      authorAvatar: req.user.discordAvatar,
      comments: [],
      reactions: {},
      views: 0,
      editedByName: null,
      editedById: null,
      editedAt: null,
    });
    saveStoreNow();
    res.json({ success: true, article });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Wiki: Makale düzenle ─────────────────────────────────────────────────────
router.patch("/api/wiki/articles/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.status(404).json({ error: "Makale bulunamadı." });

  const { title, body, imageUrl } = req.body;
  if (title !== undefined) article.title = String(title).trim().slice(0, 120);
  if (body  !== undefined) article.body  = String(body).trim().slice(0, 20000);
  if (imageUrl !== undefined) {
    const img = String(imageUrl).trim();
    article.imageUrl = img && /^https?:\/\//i.test(img) ? img : null;
  }
  article.editedById   = req.user.discordId;
  article.editedByName = req.user.discordUsername;
  article.editedAt     = new Date();

  await article.save();
  saveStoreNow();
  res.json({ success: true, article });
});

// ── Wiki: Makale sil ─────────────────────────────────────────────────────────
router.delete("/api/wiki/articles/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.status(404).json({ error: "Makale bulunamadı." });
  wikiArticles.data.delete(req.params.id);
  wikiArticles.persist();
  saveStoreNow();
  res.json({ success: true });
});

// ── Wiki: Görüntülenme sayısını artır ────────────────────────────────────────
router.post("/api/wiki/articles/:id/view", (req, res) => {
  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.status(404).json({ error: "Makale bulunamadı." });
  article.views = (article.views || 0) + 1;
  article.save();
  res.json({ success: true, views: article.views });
});

// ── Wiki: Tepki ekle/kaldır ──────────────────────────────────────────────────
router.post("/api/wiki/articles/:id/react", async (req, res) => {
  if (!requireLogin(req, res)) return;

  const { emoji } = req.body;
  const ALLOWED = ["👍", "❤️", "🔥", "😂", "😮", "👏"];
  if (!ALLOWED.includes(emoji)) return res.status(400).json({ error: "Geçersiz tepki." });

  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.status(404).json({ error: "Makale bulunamadı." });

  article.reactions = article.reactions || {};
  article.reactions[emoji] = article.reactions[emoji] || { count: 0, users: [] };

  const users = article.reactions[emoji].users;
  const idx = users.indexOf(req.user.discordId);
  if (idx === -1) {
    // Ekle
    users.push(req.user.discordId);
    article.reactions[emoji].count = users.length;
  } else {
    // Kaldır (toggle)
    users.splice(idx, 1);
    article.reactions[emoji].count = users.length;
    if (users.length === 0) delete article.reactions[emoji];
  }

  await article.save();
  saveStoreNow();
  res.json({ success: true, reactions: article.reactions });
});

// ── Wiki: Yorum ekle ─────────────────────────────────────────────────────────
router.post("/api/wiki/articles/:id/comments", async (req, res) => {
  if (!requireLogin(req, res)) return;

  const { content } = req.body;
  const text = (content || "").trim();
  if (!text) return res.status(400).json({ error: "Yorum boş olamaz." });
  if (text.length > 2000) return res.status(400).json({ error: "Yorum en fazla 2000 karakter olabilir." });

  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.status(404).json({ error: "Makale bulunamadı." });

  try {
    const comment = {
      _id: crypto.randomBytes(8).toString("hex"),
      userId: req.user.discordId,
      username: req.user.discordUsername,
      avatar: req.user.discordAvatar,
      content: text,
      createdAt: new Date(),
    };
    article.comments = article.comments || [];
    article.comments.push(comment);
    await article.save();
    saveStoreNow();
    res.json({ success: true, comment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Wiki: Yorum sil ──────────────────────────────────────────────────────────
router.delete("/api/wiki/articles/:id/comments/:commentId", async (req, res) => {
  if (!requireLogin(req, res)) return;

  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.status(404).json({ error: "Makale bulunamadı." });

  const idx = (article.comments || []).findIndex(c => c._id === req.params.commentId);
  if (idx === -1) return res.status(404).json({ error: "Yorum bulunamadı." });

  const comment = article.comments[idx];
  // Sadece yorum sahibi veya admin silebilir
  if (comment.userId !== req.user.discordId && !isSiteAdmin(req.user)) {
    return res.status(403).json({ error: "Bu yorumu silme yetkiniz yok." });
  }

  article.comments.splice(idx, 1);
  await article.save();
  saveStoreNow();
  res.json({ success: true });
});

router.get("/api/admin/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const q = (req.query.q || "").trim().toLowerCase();
  const { users } = require("../../models/Store");
  let list = users.find({});

  if (q) {
    list = list.filter(
      (u) =>
        String(u.discordId).includes(q) ||
        (u.discordUsername || "").toLowerCase().includes(q) ||
        (u.robloxUsername || "").toLowerCase().includes(q)
    );
  }

  list = list.slice(0, 50).map((u) => ({
    _id: u._id,
    discordId: u.discordId,
    discordUsername: u.discordUsername,
    discordAvatar: u.discordAvatar,
    robloxUsername: u.robloxUsername,
    isAdmin: Boolean(u.isAdmin),
    isStaff: Boolean(u.isStaff),
    isAuthorized: Boolean(u.isAuthorized),
    isBanned: Boolean(u.isBanned),
    banReason: u.banReason || null,
  }));

  res.json({ success: true, users: list });
});

router.post("/api/admin/users/:discordId/roles", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const targetId = String(req.params.discordId);
  if (targetId === String(req.user.discordId) && req.body.isAdmin === false) {
    return res.status(400).json({ error: "Kendi admin yetkinizi kaldıramazsınız." });
  }

  const user = await User.findOne({ discordId: targetId });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });

  if (req.body.isAdmin !== undefined) user.isAdmin = Boolean(req.body.isAdmin);
  if (req.body.isStaff !== undefined) user.isStaff = Boolean(req.body.isStaff);
  if (user.isAdmin) user.isStaff = true;

  await user.save();
  saveStoreNow();

  res.json({
    success: true,
    user: {
      discordId: user.discordId,
      discordUsername: user.discordUsername,
      isAdmin: user.isAdmin,
      isStaff: user.isStaff,
    },
  });
});

router.post("/api/roles/sync", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmanız gerekli." });

  const { hasRobloxLink, findUserByDiscordId } = require("../../utils/userLink");
  const freshUser = (await findUserByDiscordId(req.user.discordId)) || req.user;

  if (!hasRobloxLink(freshUser)) {
    return res.status(400).json({
      error: "Roblox hesabı bağlı değil.",
      authorizeUrl: `/auth/authorize?discordId=${req.user.discordId}`,
    });
  }

  const { getDiscordClient } = require("../../bot/discordClient");
  const { syncMemberRoles } = require("../../bot/services/roleSyncService");
  const { TARGET_GUILD_ID, BASE_URL } = require("../../config");
  const User = require("../../models/User");

  const client = getDiscordClient();
  if (!client?.isReady()) {
    return res.status(503).json({ error: "Discord bot henüz hazır değil. Birkaç saniye sonra tekrar deneyin." });
  }

  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    const member = await guild.members.fetch(req.user.discordId);

    const result = await syncMemberRoles(
      guild,
      member,
      parseInt(freshUser.robloxId, 10),
      freshUser.robloxUsername
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    if (freshUser && freshUser.groupRole !== result.rankName) {
      freshUser.groupRole = result.rankName;
      await freshUser.save();
    }

    res.json({
      success: true,
      nickname: result.nickname,
      rankName: result.rankName,
      added: result.added.map((r) => ({ id: r.id, name: r.name })),
      removed: result.removed.map((r) => ({ id: r.id, name: r.name })),
      unresolved: result.unresolved || [],
      dashboardUrl: `${BASE_URL}/dashboard`,
    });
  } catch (err) {
    if (err.code === 10007) {
      return res.status(404).json({
        error: "Discord sunucusunda bulunamadınız. Önce sunucuya katılın.",
      });
    }
    console.error("Web role sync error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/settings", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmanız gerekli." });
  
  const { profileBio, profileColor } = req.body;
  
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      if (profileBio !== undefined) user.profileBio = String(profileBio).slice(0, 500);
      if (profileColor !== undefined) user.profileColor = String(profileColor).slice(0, 32);
      await user.save();
      saveStoreNow();
      if (req.session) {
        req.session.passport.user = user._id;
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: kullanıcı ban ─────────────────────────────────────────────────────
router.post("/api/admin/users/:discordId/ban", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const targetId = String(req.params.discordId);
  if (targetId === String(req.user.discordId)) {
    return res.status(400).json({ error: "Kendinizi banlayamazsınız." });
  }

  const { reason, discordBan } = req.body;
  const banReason = (reason || "Belirtilmedi").trim().slice(0, 500);

  try {
    const user = await User.findOne({ discordId: targetId });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });

    if (user.isAdmin) {
      return res.status(403).json({ error: "Admin kullanıcılar banlanamaz." });
    }

    // Site ban
    user.isBanned = true;
    user.banReason = banReason;
    user.bannedAt = new Date();
    user.bannedBy = req.user.discordId;
    await user.save();
    saveStoreNow();

    // Discord ban (isteğe bağlı)
    let discordResult = null;
    if (discordBan) {
      try {
        const { getDiscordClient } = require("../../bot/discordClient");
        const { TARGET_GUILD_ID } = require("../../config");
        const client = getDiscordClient();
        if (client?.isReady()) {
          const guild = await client.guilds.fetch(TARGET_GUILD_ID);
          await guild.members.ban(targetId, { reason: `[Web Panel] ${banReason} — Yetkili: ${req.user.discordUsername}` });
          discordResult = "Discord ban uygulandı.";
        } else {
          discordResult = "Bot hazır değil, Discord ban uygulanamadı.";
        }
      } catch (dErr) {
        discordResult = `Discord ban hatası: ${dErr.message}`;
      }
    }

    res.json({
      success: true,
      message: `${user.discordUsername} yasaklandı.`,
      discordResult,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: kullanıcı ban kaldır ──────────────────────────────────────────────
router.post("/api/admin/users/:discordId/unban", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const targetId = String(req.params.discordId);
  const { discordUnban } = req.body;

  try {
    const user = await User.findOne({ discordId: targetId });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });

    user.isBanned = false;
    user.banReason = null;
    user.bannedAt = null;
    user.bannedBy = null;
    await user.save();
    saveStoreNow();

    // Discord unban (isteğe bağlı)
    let discordResult = null;
    if (discordUnban) {
      try {
        const { getDiscordClient } = require("../../bot/discordClient");
        const { TARGET_GUILD_ID } = require("../../config");
        const client = getDiscordClient();
        if (client?.isReady()) {
          const guild = await client.guilds.fetch(TARGET_GUILD_ID);
          await guild.bans.remove(targetId, `[Web Panel] Ban kaldırıldı — Yetkili: ${req.user.discordUsername}`);
          discordResult = "Discord ban kaldırıldı.";
        } else {
          discordResult = "Bot hazır değil, Discord ban kaldırılamadı.";
        }
      } catch (dErr) {
        discordResult = `Discord unban hatası: ${dErr.message}`;
      }
    }

    res.json({
      success: true,
      message: `${user.discordUsername} yasağı kaldırıldı.`,
      discordResult,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: banlı kullanıcı listesi ──────────────────────────────────────────
router.get("/api/admin/bans", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { users: userStore } = require("../../models/Store");
    const banned = userStore.find({}).filter(u => u.isBanned);
    res.json({
      success: true,
      bans: banned.map(u => ({
        discordId: u.discordId,
        discordUsername: u.discordUsername,
        discordAvatar: u.discordAvatar,
        banReason: u.banReason,
        bannedAt: u.bannedAt,
        bannedBy: u.bannedBy,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Moderatör puan sıralaması ────────────────────────────────────────────────
router.get("/api/staff/ratings", async (req, res) => {  if (!req.user) return res.status(401).json({ error: "Giriş yapmanız gerekli." });

  try {
    const { tickets: ticketStore, users: userStore } = require("../../models/Store");

    // Değerlendirme yapılmış tüm ticketları bul
    const ratedTickets = ticketStore.find({ rated: true });

    // Moderatör bazında istatistik topla
    const staffMap = new Map();

    for (const ticket of ratedTickets) {
      const staffId = ticket.claimedBy || ticket.closedBy;
      if (!staffId) continue;

      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          staffId,
          totalScore: 0,
          count: 0,
          scores: [],
        });
      }

      const entry = staffMap.get(staffId);
      entry.totalScore += ticket.ratingScore || 0;
      entry.count += 1;
      entry.scores.push(ticket.ratingScore || 0);
    }

    // Kullanıcı bilgilerini ekle ve sırala
    const result = [];
    for (const [staffId, data] of staffMap.entries()) {
      const staffUser = userStore.findOne({ discordId: staffId });
      const avg = data.count > 0 ? (data.totalScore / data.count) : 0;

      result.push({
        staffId,
        username: staffUser ? staffUser.discordUsername : "Bilinmiyor",
        avatar: staffUser ? staffUser.discordAvatar : "https://cdn.discordapp.com/embed/avatars/0.png",
        averageScore: Math.round(avg * 10) / 10,
        totalRatings: data.count,
        totalScore: data.totalScore,
        // Puan dağılımı (1-5 kaç tane)
        distribution: [1, 2, 3, 4, 5].map(s => data.scores.filter(x => x === s).length),
      });
    }

    // Ortalama puana göre azalan sırala
    result.sort((a, b) => b.averageScore - a.averageScore || b.totalRatings - a.totalRatings);

    res.json({ success: true, staff: result });
  } catch (err) {
    console.error("[/api/staff/ratings]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Ekonomi: bakiye sorgula ──────────────────────────────────────────────────
router.get("/api/economy/balance", async (req, res) => {
  if (!requireLogin(req, res)) return;
  try {
    let eco = await Economy.findOne({ userId: req.user.discordId });
    if (!eco) eco = { balance: 0, inventory: [], profileEffect: null, profileFrame: null, profileBadges: [], totalEarned: 0, totalSpent: 0 };
    res.json({
      success: true,
      balance: eco.balance || 0,
      inventory: eco.inventory || [],
      profileEffect: eco.profileEffect || null,
      profileFrame: eco.profileFrame || null,
      profileBadges: eco.profileBadges || [],
      totalEarned: eco.totalEarned || 0,
      totalSpent: eco.totalSpent || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mağaza: ürün listesi ─────────────────────────────────────────────────────
router.get("/api/shop/items", (req, res) => {
  res.json({ success: true, items: SHOP_ITEMS });
});

// ── Mağaza: satın al ─────────────────────────────────────────────────────────
router.post("/api/shop/buy", async (req, res) => {
  if (!requireLogin(req, res)) return;

  const { itemId } = req.body;
  const item = findItem(itemId);
  if (!item) return res.status(404).json({ error: "Ürün bulunamadı." });

  try {
    let eco = await Economy.findOne({ userId: req.user.discordId });
    if (!eco) {
      eco = new Economy({ userId: req.user.discordId });
      await eco.save();
    }

    const balance = eco.balance || 0;
    if (balance < item.price) {
      return res.status(400).json({
        error: `Yetersiz bakiye. Gerekli: ${item.price.toLocaleString("tr-TR")} coin, Mevcut: ${balance.toLocaleString("tr-TR")} coin.`,
      });
    }

    const inventory = eco.inventory || [];
    if (inventory.some(i => i.itemId === itemId)) {
      return res.status(400).json({ error: "Bu ürüne zaten sahipsiniz." });
    }

    eco.balance = balance - item.price;
    eco.totalSpent = (eco.totalSpent || 0) + item.price;
    eco.inventory = [...inventory, {
      itemId: item.id,
      name: item.name,
      icon: item.icon,
      type: item.type,
      acquiredAt: new Date(),
    }];

    if (item.type === "effect" && !eco.profileEffect) eco.profileEffect = item.id;
    if (item.type === "frame"  && !eco.profileFrame)  eco.profileFrame  = item.id;
    if (item.type === "badge") {
      eco.profileBadges = [...(eco.profileBadges || []), item.id];
    }
    if (item.type === "color") {
      const user = await User.findOne({ discordId: req.user.discordId });
      if (user) { user.profileColor = item.value; await user.save(); }
    }

    await eco.save();
    saveStoreNow();

    res.json({ success: true, message: `${item.icon} ${item.name} satın alındı!`, newBalance: eco.balance });
  } catch (err) {
    console.error("[shop/buy]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Profil: aktif efekt/çerçeve değiştir ────────────────────────────────────
router.post("/api/profile/equip", async (req, res) => {
  if (!requireLogin(req, res)) return;

  const { itemId } = req.body;
  const item = findItem(itemId);
  if (!item) return res.status(404).json({ error: "Ürün bulunamadı." });

  try {
    const eco = await Economy.findOne({ userId: req.user.discordId });
    if (!eco) return res.status(400).json({ error: "Envanter bulunamadı." });

    const inventory = eco.inventory || [];
    if (!inventory.some(i => i.itemId === itemId)) {
      return res.status(400).json({ error: "Bu ürüne sahip değilsiniz." });
    }

    if (item.type === "effect") eco.profileEffect = itemId;
    if (item.type === "frame")  eco.profileFrame  = itemId;

    await eco.save();
    saveStoreNow();
    res.json({ success: true, message: `${item.icon} ${item.name} aktif edildi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
