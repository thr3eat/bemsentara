const express = require("express");
const crypto = require("crypto");
const Ticket = require("../../models/Ticket");
const User = require("../../models/User");
const { wikiArticles, saveStoreNow } = require("../../models/Store");
const { isSiteAdmin, isSiteStaff } = require("../../utils/adminCheck");

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
    console.log("Fetching tickets for user:", {
      discordId,
      userId: req.user._id,
      username: req.user.discordUsername,
      isAuthorized: req.user.isAuthorized,
      robloxUsername: req.user.robloxUsername
    });
    
    const ticketsArray = await Ticket.find({ userId: discordId });
    const tickets = ticketsArray.sort({ createdAt: -1 });
    console.log("Found tickets:", tickets.length);
    
    res.json({ success: true, tickets });
  } catch (err) {
    console.error("Ticket fetch error:", err);
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
      commentCount: (a.comments || []).length,
      createdAt: a.createdAt,
    }));
  res.json({ success: true, articles: list });
});

router.post("/api/wiki/articles", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { title, body, imageUrl } = req.body;
  const t = (title || "").trim();
  const b = (body || "").trim();
  if (!t || t.length < 2) {
    return res.status(400).json({ error: "Başlık en az 2 karakter olmalı." });
  }
  if (!b) return res.status(400).json({ error: "Metin boş olamaz." });

  let img = (imageUrl || "").trim();
  if (img && !/^https?:\/\//i.test(img)) {
    return res.status(400).json({ error: "Geçerli bir resim URL'si girin (https://...)." });
  }
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
    });
    saveStoreNow();
    res.json({ success: true, article });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api/wiki/articles/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.status(404).json({ error: "Makale bulunamadı." });
  wikiArticles.data.delete(req.params.id);
  wikiArticles.persist();
  saveStoreNow();
  res.json({ success: true });
});

router.post("/api/wiki/articles/:id/comments", async (req, res) => {
  if (!requireLogin(req, res)) return;

  const { content } = req.body;
  const text = (content || "").trim();
  if (!text) return res.status(400).json({ error: "Yorum boş olamaz." });

  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.status(404).json({ error: "Makale bulunamadı." });

  try {
    const comment = {
      _id: crypto.randomBytes(8).toString("hex"),
      userId: req.user.discordId,
      username: req.user.discordUsername,
      avatar: req.user.discordAvatar,
      content: text.slice(0, 2000),
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
    robloxUsername: u.robloxUsername,
    isAdmin: Boolean(u.isAdmin),
    isStaff: Boolean(u.isStaff),
    isAuthorized: Boolean(u.isAuthorized),
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

// ── Moderatör puan sıralaması ────────────────────────────────────────────────
router.get("/api/staff/ratings", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmanız gerekli." });

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

module.exports = router;
