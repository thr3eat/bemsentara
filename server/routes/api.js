const express = require("express");
const Ticket = require("../../models/Ticket");

const router = express.Router();

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

router.post("/api/wiki", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmanız gerekli." });
  
  const { content } = req.body;
  if (!content || content.trim().length === 0) return res.status(400).json({ error: "Yorum boş olamaz." });
  
  const { wikis } = require("../../models/Store");
  try {
    const comment = wikis.create({
      userId: req.user.discordId,
      username: req.user.discordUsername,
      avatar: req.user.discordAvatar,
      content: content.trim(),
    });
    res.json({ success: true, comment });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/roles/sync", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmanız gerekli." });

  if (!req.user.robloxId) {
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
      parseInt(req.user.robloxId, 10),
      req.user.robloxUsername
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    const user = await User.findById(req.user._id);
    if (user && user.groupRole !== result.rankName) {
      user.groupRole = result.rankName;
      await user.save();
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
  
  const User = require("../../models/User");
  try {
    const user = await User.findById(req.user._id);
    if (user) {
        if (profileBio !== undefined) user.profileBio = profileBio;
        if (profileColor !== undefined) user.profileColor = profileColor;
        await user.save();
    }
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
