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
  // Kategori bazlı otomatik öncelik — gönderilmemişse kategoriye göre belirle
  const autoPriority = { ban: 'high', report: 'high', billing: 'high', reklam: 'medium', technical: 'medium', account: 'medium', genel: 'low', other: 'low' };
  const prio = validPriorities.includes(priority) ? priority : (autoPriority[c] || 'medium');

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
      // Web ticketlar sadece GUILD2 (EkoYıldız) sunucusunda açılır
      const targets = [
        { id: GUILD2_ID, categoryId: GUILD2_TICKET_CATEGORY_ID },
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

      // Kanal silinmişse sadece GUILD2'de yeniden oluştur
      if (!channelRestored) {
        const targets = [
          { id: GUILD2_ID, categoryId: GUILD2_TICKET_CATEGORY_ID },
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

    try {
      const { addNotification } = require("../../utils/notification");
      await addNotification(ticket.userId, {
        title: "🔓 Ticket Yeniden Açıldı",
        message: `\`${ticket.ticketId}\` numaralı ticket'ınız yeniden açıldı.`,
        icon: "🔓"
      });
    } catch (_) {}

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

    try {
      const { addNotification } = require("../../utils/notification");
      await addNotification(ticket.userId, {
        title: "🔒 Ticket Kapatıldı",
        message: `\`${ticket.ticketId}\` numaralı ticket'ınız kapatıldı. Sebep: ${reason || 'Belirtilmedi'}`,
        icon: "🔒"
      });
    } catch (_) {}

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

router.delete("/api/tickets/:ticketId", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Yetkilendirme gerekli" });

  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ error: "Ticket bulunamadı" });

    if (ticket.userId !== req.user.discordId && !req.user.isStaff && !isSiteAdmin(req.user)) {
      return res.status(403).json({ error: "Yetkilendirme gerekli" });
    }

    if (ticket.channelId) {
      const { getDiscordClient } = require("../../bot/discordClient");
      const client = getDiscordClient();
      if (client?.isReady()) {
        try {
          const { TARGET_GUILD_ID } = require("../../config");
          const guildId = ticket.guildId || TARGET_GUILD_ID;
          const guild = await client.guilds.fetch(guildId);
          const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
          if (channel) {
            await channel.delete("Ticket web panelden tamamen silindi.");
          }
        } catch (err) {
          console.warn("Discord channel delete failed or channel did not exist:", err.message);
        }
      }
    }

    await Ticket.deleteOne({ ticketId: req.params.ticketId });
    saveStoreNow();

    res.json({ success: true, message: "Ticket başarıyla tamamen silindi." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/notifications/read-all", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmanız gerekli." });
  try {
    const user = await User.findById(req.user._id);
    if (user && user.notifications) {
      user.notifications.forEach(n => {
        n.read = true;
      });
      await user.save();
      saveStoreNow();
    }
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
    roles: u.roles || [],
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

  // Handle new roles array format
  if (Array.isArray(req.body.roles)) {
    user.roles = req.body.roles;
  } else {
    // Handle old isAdmin/isStaff format
    if (req.body.isAdmin !== undefined) user.isAdmin = Boolean(req.body.isAdmin);
    if (req.body.isStaff !== undefined) user.isStaff = Boolean(req.body.isStaff);
    if (user.isAdmin) user.isStaff = true;
  }

  await user.save();
  saveStoreNow();

  res.json({
    success: true,
    user: {
      discordId: user.discordId,
      discordUsername: user.discordUsername,
      isAdmin: user.isAdmin,
      isStaff: user.isStaff,
      roles: user.roles || [],
    },
  });
});

router.post("/api/admin/action", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { category, actionType, payload } = req.body;
  if (!category || !actionType) {
    return res.status(400).json({ error: "Eksik parametreler (category ve actionType gerekli)." });
  }

  const { getDiscordClient } = require("../../bot/discordClient");
  const client = getDiscordClient();
  if (!client || !client.isReady()) {
    return res.status(503).json({ error: "Discord botu henüz aktif değil veya hazır değil." });
  }

  const { TARGET_GUILD_ID } = require("../../config");
  const guild = client.guilds.cache.get(TARGET_GUILD_ID);
  if (!guild) {
    return res.status(500).json({ error: "Sunucu (TARGET_GUILD_ID) bulunamadı." });
  }

  let responseText = "";
  const mockInteraction = {
    client,
    guild,
    user: { id: req.user.discordId, username: req.user.discordUsername, tag: req.user.discordUsername },
    member: {
      user: { id: req.user.discordId, username: req.user.discordUsername, tag: req.user.discordUsername },
      permissions: { has: () => true },
      roles: { cache: { has: () => true } }
    },
    isReady: () => true,
    isChatInputCommand: () => true,
    deferReply: async () => {},
    editReply: async (payloadData) => {
      if (typeof payloadData === 'string') {
        responseText = payloadData;
      } else {
        if (payloadData.content) responseText = payloadData.content;
        if (payloadData.embeds) {
          const embedTexts = payloadData.embeds.map(emb => {
            let text = "";
            const data = emb.data || emb;
            if (data.title) text += `=== ${data.title} ===\n`;
            if (data.description) text += `${data.description}\n`;
            if (data.fields) {
              data.fields.forEach(f => {
                text += `**${f.name}**: ${f.value}\n`;
              });
            }
            return text;
          }).join('\n\n');
          responseText = (responseText ? responseText + "\n\n" : "") + embedTexts;
        }
      }
      return mockInteraction;
    },
    reply: async (payloadData) => {
      return mockInteraction.editReply(payloadData);
    },
    followUp: async (payloadData) => {
      return mockInteraction.editReply(payloadData);
    }
  };

  try {
    if (category === "moderation") {
      if (actionType === "mute") {
        const { kullanici, sure, sebep } = payload;
        const targetUserId = (kullanici || "").replace(/[<@!>]/g, "");
        const member = await guild.members.fetch(targetUserId).catch(() => null);
        if (!member) return res.status(404).json({ error: "Kullanıcı sunucuda bulunamadı." });

        const parseDuration = (timeStr) => {
          const unitMap = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
          const matches = [...timeStr.matchAll(/(\d+)([smhd])/g)];
          if (!matches.length) return 10 * 60 * 1000;
          return matches.reduce((total, match) => total + parseInt(match[1]) * (unitMap[match[2]] || 1000), 0);
        };
        const durationMs = parseDuration(sure || "10m");
        await member.timeout(durationMs, `Web Panel admin: ${req.user.discordUsername} - Sebep: ${sebep}`);
        return res.json({ success: true, message: `✅ ${member.user.tag} kullanıcısı ${sure} süreyle susturuldu.` });
      }

      if (actionType === "unmute") {
        const { kullanici } = payload;
        const targetUserId = (kullanici || "").replace(/[<@!>]/g, "");
        const member = await guild.members.fetch(targetUserId).catch(() => null);
        if (!member) return res.status(404).json({ error: "Kullanıcı sunucuda bulunamadı." });

        await member.timeout(null, `Web Panel admin: ${req.user.discordUsername}`);
        return res.json({ success: true, message: `✅ ${member.user.tag} kullanıcısının susturması kaldırıldı.` });
      }

      if (actionType === "modaction") {
        const { kullanici, sebep, kanit } = payload;
        const targetUserId = (kullanici || "").replace(/[<@!>]/g, "");
        const targetUser = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUser) return res.status(404).json({ error: "Kullanıcı bulunamadı." });

        const fakeAttachment = kanit ? { url: kanit } : null;
        const { executeModAction } = require("../../bot/services/modActionService");
        await executeModAction(mockInteraction, targetUser, sebep, fakeAttachment);
        return res.json({ success: true, message: responseText || "Ceza işlemi uygulandı." });
      }

      if (actionType === "bulk_delete") {
        const { miktar } = payload;
        const count = parseInt(miktar, 10);
        if (isNaN(count) || count < 1 || count > 100) {
          return res.status(400).json({ error: "Silinecek mesaj sayısı 1-100 arasında olmalıdır." });
        }

        const { TARGET_CHANNEL_ID } = require("../../config");
        const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) {
          return res.status(404).json({ error: "Mesaj silme kanalı bulunamadı." });
        }

        const deleted = await channel.bulkDelete(count, true);
        return res.json({
          success: true,
          message: `✅ ${deleted.size} mesaj başarıyla silindi.` + 
            (deleted.size < count ? ` (${count - deleted.size} mesaj 14 günden eski olduğu için atlandı.)` : "")
        });
      }

      if (actionType === "blacklist") {
        const { option, name, reason } = payload;
        const Blacklist = require("../../models/Blacklist");
        const { renderBlacklist } = require("../../bot/services/blacklistService");
        const BLACKLIST_LOG_CHANNEL_ID = '1518920074264842380';
        const logChannel = await client.channels.fetch(BLACKLIST_LOG_CHANNEL_ID).catch(() => null);

        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const safePattern = new RegExp(`^${escapeRegex(name.trim())}$`, 'i');
        let entry = await Blacklist.findOne({ name: { $regex: safePattern } });

        if (option === "1" || option === "2") {
          let type = option === "1" ? "person" : "group";
          let finalName = name.trim();
          if (type === "group" && !finalName.endsWith(" grubu")) {
            finalName += " grubu";
          }
          let isNew = false;
          if (entry) {
            entry.reason = reason;
            entry.type = type;
            entry.status = "active";
            entry.removedAt = null;
            await entry.save();
          } else {
            entry = new Blacklist({ name: finalName, type, reason, status: "active" });
            await entry.save();
            isNew = true;
          }
          await renderBlacklist(client);
          if (logChannel) {
            await logChannel.send({
              content: `📥 **[WEB KARALİSTE EKLEME]** Admin <@${req.user.discordId}> tarafından **${finalName}** listeye eklendi.\n📋 **Sebep:** ${reason}\n📂 **Tür:** ${type === 'person' ? 'Kişi' : 'Grup'} (${isNew ? 'Yeni Kayıt' : 'Güncellendi'})`
            });
          }
          return res.json({ success: true, message: `✅ **${finalName}** başarıyla karalisteye eklendi.` });
        }

        if (option === "3") {
          if (!entry) return res.status(404).json({ error: `**${name}** karalistede bulunamadı.` });
          entry.status = "removed";
          entry.removedAt = new Date();
          await entry.save();
          await renderBlacklist(client);
          if (logChannel) {
            await logChannel.send({
              content: `📤 **[WEB KARALİSTE KALDIRMA]** Admin <@${req.user.discordId}> tarafından **${entry.name}** kaldırıldı. (15 gün sonra silinecektir.)`
            });
          }
          return res.json({ success: true, message: `✅ **${entry.name}** karaliste yasağı kaldırıldı (strikethrough yapıldı).` });
        }

        if (option === "4") {
          if (!entry) return res.status(404).json({ error: `**${name}** karalistede bulunamadı.` });
          await Blacklist.deleteOne({ _id: entry._id });
          await renderBlacklist(client);
          if (logChannel) {
            await logChannel.send({
              content: `🗑️ **[WEB KARALİSTE TAMAMEN SİLİNDİ]** Admin <@${req.user.discordId}> tarafından **${entry.name}** tamamen silindi.`
            });
          }
          return res.json({ success: true, message: `✅ **${entry.name}** listeden tamamen silindi.` });
        }

        if (option === "5") {
          if (!entry) return res.status(404).json({ error: `**${name}** karalistede bulunamadı.` });
          entry.status = "active";
          entry.removedAt = null;
          await entry.save();
          await renderBlacklist(client);
          if (logChannel) {
            await logChannel.send({
              content: `🔄 **[WEB KARALİSTE YENİDEN ETKİN]** Admin <@${req.user.discordId}> tarafından **${entry.name}** yasağı yeniden aktif edildi.`
            });
          }
          return res.json({ success: true, message: `✅ **${entry.name}** karaliste kaydı yeniden açıldı.` });
        }
      }

      if (actionType === "tamban" || actionType === "tamban_kaldir") {
        const { kullanici_id, seviye, sebep } = payload;
        const { handleModerationCommand } = require("../../bot/handlers/moderationCommandHandler");

        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return actionType;
            if (prop === "options") {
              return {
                getString: (name) => {
                  if (name === "kullanici_id") return kullanici_id;
                  if (name === "seviye") return seviye || "high";
                  if (name === "sebep") return sebep;
                  return null;
                }
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });

        await handleModerationCommand(proxy);
        return res.json({ success: true, message: responseText || "Tam ban işlemi uygulandı." });
      }
    }

    if (category === "staff") {
      if (actionType === "report") {
        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "personelrapor";
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, reportText: responseText || "Rapor verisi boş." });
      }

      if (actionType === "attendance_start" || actionType === "attendance_stop") {
        const { startRollCall, endRollCall } = require("../../bot/services/rollCallService");
        if (actionType === "attendance_start") {
          await startRollCall(client, mockInteraction);
        } else {
          await endRollCall(client, mockInteraction);
        }
        return res.json({ success: true, message: responseText || "Yoklama işlemi tamamlandı." });
      }

      if (actionType === "setstats") {
        const { kullanici, parametre, deger } = payload;
        const targetUserId = (kullanici || "").replace(/[<@!>]/g, "");
        const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUserObj) return res.status(404).json({ error: "Personel bulunamadı." });

        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "personelayarla";
            if (prop === "options") {
              return {
                getUser: () => targetUserObj,
                getString: () => parametre,
                getInteger: () => parseInt(deger, 10) || 0
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "İstatistik ayarlandı." });
      }

      if (actionType === "fire") {
        const { kullanici, sebep } = payload;
        const targetUserId = (kullanici || "").replace(/[<@!>]/g, "");
        const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUserObj) return res.status(404).json({ error: "Personel bulunamadı." });

        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "personelkov";
            if (prop === "options") {
              return {
                getUser: () => targetUserObj,
                getString: () => sebep
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Personel kovuldu." });
      }

      if (actionType === "promote_demote") {
        const { kullanici, islem, sebep } = payload;
        const targetUserId = (kullanici || "").replace(/[<@!>]/g, "");
        const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUserObj) return res.status(404).json({ error: "Personel bulunamadı." });

        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const cmdName = islem === "terfi" ? "birimterfi" : "tenzilat";

        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return cmdName;
            if (prop === "options") {
              return {
                getUser: () => targetUserObj,
                getString: () => sebep
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Rütbe işlemi uygulandı." });
      }

      if (actionType === "reward") {
        const { kullanici, islem, odul } = payload;
        const targetUserId = (kullanici || "").replace(/[<@!>]/g, "");
        const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUserObj) return res.status(404).json({ error: "Personel bulunamadı." });

        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "odulver";
            if (prop === "options") {
              return {
                getUser: () => targetUserObj,
                getString: (name) => (name === "islem" ? islem : odul)
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Ödül işlemi uygulandı." });
      }

      if (actionType === "giveleave") {
        const { kullanici, tarih, sebep } = payload;
        const targetUserId = (kullanici || "").replace(/[<@!>]/g, "");
        const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUserObj) return res.status(404).json({ error: "Personel bulunamadı." });

        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "izin_ver";
            if (prop === "options") {
              return {
                getUser: () => targetUserObj,
                getString: (name) => (name === "tarih" ? tarih : sebep)
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "İzin tanımlandı." });
      }
    }

    if (category === "system") {
      if (actionType === "toggle_economy" || actionType === "toggle_moderation" || actionType === "toggle_fun") {
        const ServerConfig = require("../../models/ServerConfig");
        let cfg = await ServerConfig.findOne({ guildId: TARGET_GUILD_ID });
        if (!cfg) {
          cfg = new ServerConfig({ guildId: TARGET_GUILD_ID });
        }

        const modName = actionType.replace("toggle_", "");
        const keyMap = { economy: "economyEnabled", moderation: "moderationEnabled", fun: "funEnabled" };
        const key = keyMap[modName];

        cfg[key] = !cfg[key];
        await cfg.save();
        return res.json({ success: true, message: `✅ ${modName.toUpperCase()} sistemi durumu güncellendi: ${cfg[key] ? "AKTİF" : "DEVRE DIŞI"}` });
      }

      if (actionType === "channel_perms") {
        const { kanal, islem, izin } = payload;
        const channelObj = await client.channels.fetch(kanal).catch(() => null);
        if (!channelObj) return res.status(404).json({ error: "Belirtilen kanal bulunamadı." });

        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "kanal";
            if (prop === "options") {
              return {
                getSubcommand: () => islem,
                getChannel: () => channelObj,
                getString: () => izin
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Kanal izinleri güncellendi." });
      }

      if (actionType === "otomod") {
        const { islem } = payload;
        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "otomod";
            if (prop === "options") {
              return {
                getSubcommand: () => islem
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Otomod güncellendi." });
      }

      if (actionType === "roblox_ranks") {
        const { op, val } = payload;
        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        
        let cmdName = op;
        let optionOverrides = {};

        if (cmdName === "ekobang" || cmdName === "ekobangerial") {
          const targetUserId = val.replace(/[<@!>]/g, "");
          const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
          if (!targetUserObj) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
          optionOverrides = { getUser: () => targetUserObj };
        } else {
          optionOverrides = { getString: () => val };
        }

        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return cmdName;
            if (prop === "options") return optionOverrides;
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Roblox işlemi tamamlandı." });
      }

      if (actionType === "birimalimi") {
        const { birim } = payload;
        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "birimalimi";
            if (prop === "options") {
              return {
                getString: () => birim
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Birim alımı başlatıldı." });
      }

      if (actionType === "birimtanitim") {
        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "birimtanitim";
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Birim tanıtım mesajı gönderildi." });
      }

      if (actionType === "xpcekilis") {
        const { xp_miktari, kazanan_sayisi } = payload;
        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "xpcekilis";
            if (prop === "options") {
              return {
                getInteger: (name) => (name === "xp_miktari" ? parseInt(xp_miktari, 10) : parseInt(kazanan_sayisi, 10))
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Çekiliş başlatıldı." });
      }

      if (actionType === "konus") {
        const { kullanici, konu } = payload;
        const targetUserId = kullanici.replace(/[<@!>]/g, "");
        const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUserObj) return res.status(404).json({ error: "Kullanıcı bulunamadı." });

        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "konus";
            if (prop === "options") {
              return {
                getUser: () => targetUserObj,
                getString: () => konu
              };
            }
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "AI DM konuşması başlatıldı." });
      }

      if (actionType === "abusetest") {
        const { handleGeneralCommand } = require("../../bot/handlers/generalCommandHandler");
        const proxy = new Proxy(mockInteraction, {
          get(target, prop) {
            if (prop === "commandName") return "abusetest";
            return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          }
        });
        await handleGeneralCommand(proxy);
        return res.json({ success: true, message: responseText || "Abuse embed testi gönderildi." });
      }

      if (actionType === "modalim_search") {
        const { user } = payload;
        const targetUserId = user.replace(/[<@!>]/g, "");
        const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUserObj) return res.status(404).json({ error: "Aday bulunamadı." });
        if (targetUserObj.bot) return res.status(400).json({ error: "Botlara mülakat gönderilemez." });

        const { startModInterview } = require("../../bot/services/modInterview");
        const sent = await startModInterview(targetUserObj, req.user.discordId, guild.id, client);
        if (sent) {
          return res.json({ success: true, message: `✅ **${targetUserObj.username}** kullanıcısına mülakat daveti DM'de gönderildi.` });
        } else {
          return res.status(400).json({ error: `❌ **${targetUserObj.username}** kullanıcısına DM gönderilemedi. DM kutusu kapalı olabilir.` });
        }
      }

      if (actionType === "modalim_direct") {
        const { user, robloxUsername } = payload;
        const targetUserId = user.replace(/[<@!>]/g, "");
        const targetUserObj = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUserObj) return res.status(404).json({ error: "Kullanıcı bulunamadı." });

        const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1518692389169135666';
        const MOD_GUILD_ID = process.env.MOD_GUILD_ID || '1367646464804655104';

        const modGuild = await client.guilds.fetch(MOD_GUILD_ID).catch(() => null);
        if (modGuild) {
          const member = await modGuild.members.fetch(targetUserId).catch(() => null);
          if (member) {
            await member.roles.add(MOD_ROLE_ID, `Direkt mod alımı - Admin: ${req.user.discordUsername}`);
          }
        }

        const StaffProgress = require("../../models/StaffProgress");
        let staffRecord = await StaffProgress.findOne({ userId: targetUserId });
        if (!staffRecord) {
          staffRecord = new StaffProgress({ userId: targetUserId, guildId: MOD_GUILD_ID, level: 1 });
        } else {
          if (staffRecord.level < 1) {
            staffRecord.level = 1;
          }
          staffRecord.status = 'active';
          staffRecord.dismissedAt = null;
          staffRecord.dismissReason = null;
        }
        await staffRecord.save();

        const { ensureAdminGuildMembership } = require("../../bot/services/staffAutomation");
        await ensureAdminGuildMembership(client, targetUserId).catch(() => {});

        const noblox = require("noblox.js");
        const robloxId = await noblox.getIdFromUsername(robloxUsername.trim()).catch(() => null);
        if (!robloxId) {
          return res.status(400).json({ error: `Roblox kullanıcısı (${robloxUsername}) bulunamadı. Lütfen kontrol edip manuel doğrulayın.` });
        }

        const User = require("../../models/User");
        const { saveStoreNow } = require("../../models/Store");
        let dbUser = await User.findOne({ discordId: targetUserId });
        if (!dbUser) {
          dbUser = new User({ discordId: targetUserId, discordUsername: targetUserObj.username });
        }
        dbUser.robloxId = String(robloxId);
        dbUser.robloxUsername = robloxUsername;
        dbUser.isAuthorized = true;
        await dbUser.save();
        saveStoreNow();

        const { syncStaffRobloxRanks, syncStaffDiscordRoles } = require("../../bot/services/staffAutomation");
        await syncStaffRobloxRanks(client, targetUserId).catch(() => {});
        await syncStaffDiscordRoles(client, targetUserId).catch(() => {});

        const { syncMemberRoles } = require("../../bot/services/roleSyncService");
        const { VERIFY_CHANNEL_ID } = require("../../config");
        
        const mainGuild = await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
        if (mainGuild) {
          const mainMember = await mainGuild.members.fetch(targetUserId).catch(() => null);
          if (mainMember) {
            await syncMemberRoles(mainGuild, mainMember, robloxId, robloxUsername).catch(() => {});
          }
        }

        const { EmbedBuilder } = require("discord.js");
        const dmEmbed = new EmbedBuilder()
          .setColor(0x7c6af7)
          .setTitle("🔗 Roblox Grup Doğrulaması Başarılı")
          .setThumbnail(targetUserObj.avatarURL() || null)
          .setDescription(
            `Merhaba **${targetUserObj.username}**! 👋\n\n` +
            `Roblox hesabınız başarıyla doğrulandı ve yetkili yetkileriniz tanımlandı.\n\n` +
            `🎮 **Roblox Kullanıcı Adı:** \`${robloxUsername}\`\n` +
            `🆔 **Roblox ID:** \`${robloxId}\`\n` +
            `📈 **Personel Seviyesi:** \`Stajyer (Level 1)\`\n\n` +
            `✓ Discord rolleri senkronize edildi\n` +
            `✓ Roblox grup rütbeleri ayarlandı\n` +
            `✓ Staff sistem kaydı aktif edildi`
          )
          .setFooter({ text: "Sentara Entegrasyon Sistemi" })
          .setTimestamp();

        await targetUserObj.send({ embeds: [dmEmbed] }).catch(() => {});

        if (mainGuild && VERIFY_CHANNEL_ID) {
          const verifyChannel = await mainGuild.channels.fetch(VERIFY_CHANNEL_ID).catch(() => null);
          if (verifyChannel && verifyChannel.isTextBased()) {
            const publicEmbed = new EmbedBuilder()
              .setColor(0x4ade80)
              .setTitle("🔗 Yeni Personel Roblox Doğrulaması")
              .setDescription(
                `**Kullanıcı:** <@${targetUserId}> (\`${targetUserId}\`)\n` +
                `**Roblox Hesabı:** [${robloxUsername}](https://www.roblox.com/users/${robloxId}/profile) (\`${robloxId}\`)\n` +
                `**Durum:** Yetkili doğrulandı ve roller sunucuda senkronize edildi.`
              )
              .setFooter({ text: "Sentara Roblox Doğrulama" })
              .setTimestamp();
            await verifyChannel.send({ embeds: [publicEmbed] }).catch(() => {});
          }
        }

        return res.json({
          success: true,
          message: `✅ **${targetUserObj.username}** başarıyla stajyer mod olarak alındı ve Roblox hesabı **${robloxUsername}** olarak doğrulandı.`
        });
      }

      if (actionType === "restart") {
        res.json({ success: true, message: "🔄 Bot yeniden başlatılıyor..." });
        setTimeout(() => {
          process.exit(0);
        }, 1500);
        return;
      }
    }

    return res.status(400).json({ error: "Bilinmeyen işlem veya kategori." });
  } catch (err) {
    console.error("[webAction] Hata:", err);
    return res.status(500).json({ error: err.message });
  }
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

// ── Admin: rütbe tanımları ───────────────────────────────────────────────────
const SITE_ROLES = {
  wiki_editor:      { name: "📝 Wiki Editörü",        color: "#7c6af7" },
  moderator:        { name: "🛡️ Moderatör",            color: "#4ade80" },
  support_lead:     { name: "⭐ Destek Lideri",        color: "#fbbf24" },
  content_creator:  { name: "🎬 İçerik Yaratıcısı",   color: "#ff6bf7" },
  translator:       { name: "🌐 Çevirmen",             color: "#06b6d4" },
  event_manager:    { name: "🎉 Etkinlik Yöneticisi",  color: "#f97316" },
  community_helper: { name: "🤝 Topluluk Yardımcısı", color: "#a3e635" },
  media_team:       { name: "📸 Medya Ekibi",          color: "#e879f9" },
  developer:        { name: "💻 Geliştirici",          color: "#38bdf8" },
  vip:              { name: "👑 VIP",                  color: "#facc15" },
};

// ── Admin: kullanıcıya rütbe ata ─────────────────────────────────────────────
router.post("/api/admin/users/:discordId/site-roles", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const targetId = String(req.params.discordId);
  const { roles } = req.body;

  if (!Array.isArray(roles)) {
    return res.status(400).json({ error: "Roles bir dizi olmalı." });
  }

  const validRoles = roles.filter(r => SITE_ROLES[r]);

  try {
    const user = await User.findOne({ discordId: targetId });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });

    user.roles = validRoles;
    await user.save();
    saveStoreNow();

    res.json({
      success: true,
      message: `${user.discordUsername} rütbeleri güncellendi.`,
      roles: user.roles,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: rütbe listesi ─────────────────────────────────────────────────────
router.get("/api/admin/roles", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ success: true, roles: SITE_ROLES });
});

// ── Admin: kullanıcıya coin ver ──────────────────────────────────────────────
router.post("/api/admin/users/:discordId/give-coins", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const targetId = String(req.params.discordId);
  const { amount, reason } = req.body;
  const coins = parseInt(amount, 10);

  if (isNaN(coins) || coins <= 0) {
    return res.status(400).json({ error: "Geçerli bir miktar girin." });
  }
  if (coins > 1000000) {
    return res.status(400).json({ error: "Maksimum 1.000.000 coin verebilirsiniz." });
  }

  try {
    const user = await User.findOne({ discordId: targetId });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı." });

    let eco = await Economy.findOne({ userId: targetId });
    if (!eco) {
      eco = new Economy({ userId: targetId });
    }

    eco.balance = (eco.balance || 0) + coins;
    eco.totalEarned = (eco.totalEarned || 0) + coins;
    await eco.save();
    saveStoreNow();

    try {
      const { addNotification } = require("../../utils/notification");
      await addNotification(targetId, {
        title: "💰 Coin Eklendi",
        message: `${coins.toLocaleString("tr-TR")} coin hesabınıza eklendi. Sebep: ${reason || 'Belirtilmedi'}`,
        icon: "💰"
      });
    } catch (_) {}

    console.log(`[admin-coins] ${req.user.discordUsername} → ${user.discordUsername}: +${coins} coin (${reason || 'sebep yok'})`);

    res.json({
      success: true,
      message: `${user.discordUsername} kullanıcısına ${coins.toLocaleString("tr-TR")} coin verildi.`,
      newBalance: eco.balance,
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

// ── Admin: panel form gönder ────────────────────────────────────────────────
router.post("/api/admin/submit-form", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { formType, formData } = req.body;
  if (!formType || !formData) {
    return res.status(400).json({ error: "Form tipi ve form verileri gerekli." });
  }

  const { getDiscordClient } = require("../../bot/discordClient");
  const client = getDiscordClient();
  if (!client?.isReady()) {
    return res.status(503).json({ error: "Discord botu hazır değil, lütfen daha sonra tekrar deneyin." });
  }

  const { EmbedBuilder } = require("discord.js");
  const { chatWithAI } = require("../../bot/services/aiService");
  const { sendAdminLog } = require("../../bot/services/staffAutomation");
  const { logToModChannel } = require("../../bot/services/modChannelService");

  try {
    const userId = req.user.discordId;
    const username = req.user.discordUsername;
    const avatar = req.user.discordAvatar || "https://cdn.discordapp.com/embed/avatars/0.png";

    if (formType === "leave") {
      const { reason, duration } = formData;
      if (!reason || !duration) {
        return res.status(400).json({ error: "İzin sebebi ve izin süresi gerekli." });
      }

      const aiPrompt = `Bir moderatör izin talebinde bulundu.\nSebep: ${reason}\nSüre: ${duration} gün.\nBu talebi onayla veya reddet. Eğer kabul ediyorsan sadece "KABUL" yaz, reddediyorsan "RED" yaz ve yanına kısa bir sebep ekle.`;
      const aiResponse = await chatWithAI(aiPrompt, "Sen yetkili bir IK yöneticisisin.");
      
      const embed = new EmbedBuilder()
        .setTitle('📝 İzin Talebi')
        .addFields(
          { name: 'Kullanıcı', value: `<@${userId}>` },
          { name: 'Sebep', value: reason },
          { name: 'Süre', value: `${duration} Gün` },
          { name: 'Yapay Zeka Kararı', value: aiResponse }
        )
        .setTimestamp();
        
      const approved = aiResponse.toUpperCase().includes('KABUL');
      if (approved) {
        embed.setColor(0x2ECC71);
      } else {
        embed.setColor(0xE74C3C);
      }
      
      await sendAdminLog(client, 'ANA_SUNUCU', embed);
      try {
        await logToModChannel(client, userId, embed).catch(() => {});
      } catch (_) {}

      return res.json({
        success: true,
        approved,
        message: approved ? "İzin talebiniz onaylandı." : `İzin talebiniz reddedildi. Sebep: ${aiResponse}`,
        aiResponse
      });
    }

    else if (formType === "suggestion") {
      const { suggestion } = formData;
      if (!suggestion) {
        return res.status(400).json({ error: "Öneri metni boş olamaz." });
      }

      const embed = new EmbedBuilder()
        .setTitle('💡 Yeni Bir Öneri Var')
        .setDescription(suggestion)
        .setAuthor({ name: username, iconURL: avatar })
        .setColor(0x3498DB)
        .setTimestamp();
        
      await sendAdminLog(client, 'SUGGESTION_LOG', embed);
      try {
        await logToModChannel(client, userId, embed).catch(() => {});
      } catch (_) {}

      return res.json({ success: true, message: "Öneriniz başarıyla iletildi." });
    }

    else if (formType === "resign") {
      const { reason, confirm } = formData;
      if (!reason || !confirm) {
        return res.status(400).json({ error: "İstifa sebebi ve onay kelimesi gerekli." });
      }
      if (confirm.toLowerCase() !== 'evet') {
        return res.status(400).json({ error: "İşlemi onaylamak için 'Evet' yazmalısınız." });
      }

      const embed = new EmbedBuilder()
        .setTitle('🚪 İstifa Bildirimi')
        .addFields(
          { name: 'Kullanıcı', value: `<@${userId}>` },
          { name: 'Sebep', value: reason }
        )
        .setColor(0x992D22)
        .setTimestamp();
        
      await sendAdminLog(client, 'ANA_SUNUCU', embed);
      try {
        await logToModChannel(client, userId, embed).catch(() => {});
      } catch (_) {}
      
      try {
        const { ADMIN_GUILD_ID } = require('../../bot/services/staffAutomation');
        const guild = client.guilds.cache.get(ADMIN_GUILD_ID);
        if (guild) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) await member.kick('Kendi isteğiyle istifa etti.');
        }
      } catch (e) {
        console.error('Kick failed:', e.message);
      }

      return res.json({ success: true, message: "İstifanız başarıyla raporlandı." });
    }

    else if (formType === "modaction") {
      const { user, action, reason } = formData;
      if (!user || !action || !reason) {
        return res.status(400).json({ error: "Kullanıcı, işlem ve sebep alanları zorunludur." });
      }

      const embed = new EmbedBuilder()
        .setTitle('⚖️ Moderatör İşlemi Raporlandı')
        .addFields(
          { name: 'Yetkili', value: `<@${userId}>`, inline: true },
          { name: 'İşlem Gören', value: user, inline: true },
          { name: 'İşlem Tipi', value: action, inline: true },
          { name: 'Sebep / Kanıt', value: reason }
        )
        .setColor(0x9B59B6)
        .setTimestamp();
        
      await sendAdminLog(client, 'CEZA_LOG', embed);
      try {
        await logToModChannel(client, userId, embed).catch(() => {});
      } catch (_) {}

      return res.json({ success: true, message: "Moderatör işlemi başarıyla raporlandı." });
    }

    else if (formType === "ban_report") {
      const { isim, kisi, kisiId, sebep, kanit } = formData;
      if (!isim || !kisi || !kisiId || !sebep || !kanit) {
        return res.status(400).json({ error: "Tüm alanların doldurulması zorunludur." });
      }

      const embed = new EmbedBuilder()
        .setTitle('🔨 Yeni Ban Raporu')
        .addFields(
          { name: 'Raporlayan İsim', value: isim, inline: true },
          { name: 'Raporlayan (Discord)', value: `<@${userId}>`, inline: true },
          { name: 'Banlanacak Kişi', value: kisi, inline: true },
          { name: 'Banlanacak Kişinin ID', value: kisiId, inline: true },
          { name: 'Sebep', value: sebep },
          { name: 'Kanıt', value: kanit }
        )
        .setColor(0xE74C3C)
        .setTimestamp();
      
      const channel = await client.channels.fetch('1466946902154018967').catch(() => null);
      if (channel) await channel.send({ embeds: [embed] });
      try {
        await logToModChannel(client, userId, embed).catch(() => {});
      } catch (_) {}

      return res.json({ success: true, message: "Ban raporu başarıyla gönderildi." });
    }

    else if (formType === "mute_report") {
      const { isim, rutbe, kisi, ihlal } = formData;
      if (!isim || !rutbe || !kisi || !ihlal) {
        return res.status(400).json({ error: "Tüm alanların doldurulması zorunludur." });
      }

      const embed = new EmbedBuilder()
        .setTitle('🔇 Yeni Mute Raporu')
        .addFields(
          { name: 'Raporlayan İsim', value: isim, inline: true },
          { name: 'Rütbe', value: rutbe, inline: true },
          { name: 'Raporlayan (Discord)', value: `<@${userId}>`, inline: true },
          { name: 'Mute Atılan Kişi', value: kisi, inline: true },
          { name: 'Kaçıncı İhlali', value: ihlal, inline: true }
        )
        .setColor(0xF39C12)
        .setTimestamp();
      
      const channel = await client.channels.fetch('1466946762190229589').catch(() => null);
      if (channel) await channel.send({ embeds: [embed] });
      try {
        await logToModChannel(client, userId, embed).catch(() => {});
      } catch (_) {}

      return res.json({ success: true, message: "Mute raporu başarıyla gönderildi." });
    }

    else if (formType === "mod_complain") {
      const { mod, sebep, kanit } = formData;
      if (!mod || !sebep || !kanit) {
        return res.status(400).json({ error: "Tüm alanların doldurulması zorunludur." });
      }

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Yeni Mod Şikayeti')
        .addFields(
          { name: 'Şikayet Eden (Discord)', value: `<@${userId}>`, inline: true },
          { name: 'Şikayet Edilen Mod', value: mod, inline: true },
          { name: 'Sebep', value: sebep },
          { name: 'Kanıt', value: kanit }
        )
        .setColor(0x992D22)
        .setTimestamp();
      
      const channel = await client.channels.fetch('1466946497206816973').catch(() => null);
      if (channel) await channel.send({ embeds: [embed] });

      return res.json({ success: true, message: "Şikayetiniz gizlilik içinde yönetime iletildi." });
    }

    else {
      return res.status(400).json({ error: "Geçersiz form tipi." });
    }

  } catch (err) {
    console.error("[SubmitForm API Error]:", err);
    res.status(500).json({ error: "Form gönderilirken sunucuda bir hata oluştu: " + err.message });
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

// ── Ekonomi: herkese açık profil bakiyesi ───────────────────────────────────
router.get("/api/economy/public/:discordId", async (req, res) => {
  try {
    const targetId = String(req.params.discordId);
    let eco = await Economy.findOne({ userId: targetId });
    if (!eco) eco = { balance: 0, inventory: [], profileEffect: null, profileFrame: null, profileBadges: [], totalEarned: 0, totalSpent: 0 };
    // Herkese göster ama hassas bilgileri sınırla
    res.json({
      success: true,
      balance: eco.balance || 0,
      inventory: (eco.inventory || []),
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

    try {
      const { addNotification } = require("../../utils/notification");
      await addNotification(req.user.discordId, {
        title: "🛍️ Satın Alım Başarılı",
        message: `${item.icon} ${item.name} satın alındı! Envanterinize eklendi.`,
        icon: "🛍️"
      });
    } catch (_) {}

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

// ── Webhook Proxy ────────────────────────────────────────────────────────────
// Roblox → bu endpoint → Discord webhook
// Roblox'tan: POST /api/webhook/proxy
// Body: { webhookUrl, content, embeds, username, avatarUrl }
// Güvenlik: isteğe bağlı secret header kontrolü

router.post("/api/webhook/proxy", async (req, res) => {
  // CORS — Roblox'tan gelen isteklere izin ver
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Secret");

  const { webhookUrl, content, embeds, username, avatar_url, tts, allowed_mentions } = req.body;

  // webhookUrl zorunlu
  if (!webhookUrl) {
    return res.status(400).json({ success: false, error: "webhookUrl gerekli." });
  }

  // Sadece Discord webhook URL'lerine izin ver
  const discordWebhookPattern = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/.+/;
  if (!discordWebhookPattern.test(webhookUrl)) {
    return res.status(400).json({ success: false, error: "Sadece Discord webhook URL'leri desteklenir." });
  }

  // İçerik kontrolü
  if (!content && (!embeds || !embeds.length)) {
    return res.status(400).json({ success: false, error: "content veya embeds gerekli." });
  }

  // Payload oluştur
  const payload = {};
  if (content)          payload.content          = String(content).slice(0, 2000);
  if (username)         payload.username         = String(username).slice(0, 80);
  if (avatar_url)       payload.avatar_url       = String(avatar_url);
  if (tts)              payload.tts              = Boolean(tts);
  if (allowed_mentions) payload.allowed_mentions = allowed_mentions;
  if (embeds && Array.isArray(embeds)) {
    payload.embeds = embeds.slice(0, 10); // Discord max 10 embed
  }

  try {
    const https = require("https");
    const url = new URL(webhookUrl);
    const body = JSON.stringify(payload);

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "SentaraWebhookProxy/1.0",
        },
      };

      const req2 = https.request(options, (r) => {
        let data = "";
        r.on("data", chunk => data += chunk);
        r.on("end", () => resolve({ status: r.statusCode, body: data }));
      });

      req2.on("error", reject);
      req2.setTimeout(5000, () => { req2.destroy(); reject(new Error("Timeout")); });
      req2.write(body);
      req2.end();
    });

    // Discord 204 = başarılı (içerik yok), 200 = başarılı (içerik var)
    if (result.status === 204 || result.status === 200) {
      return res.status(200).json({ success: true, message: "Webhook gönderildi." });
    }

    // Rate limit
    if (result.status === 429) {
      let retryAfter = 1;
      try { retryAfter = JSON.parse(result.body).retry_after || 1; } catch (_) {}
      return res.status(429).json({ success: false, error: "Rate limit. Tekrar dene.", retry_after: retryAfter });
    }

    return res.status(result.status).json({
      success: false,
      error: `Discord hata kodu: ${result.status}`,
      discord_response: result.body,
    });

  } catch (err) {
    console.error("[webhook-proxy]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Roblox Arkadaş İsteği Doğrulama API'leri ─────────────────────────────────
router.post("/api/auth/roblox/friend-request", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmanız gerekli." });

  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Roblox kullanıcı adı gerekli." });

  try {
    const noblox = require("noblox.js");
    const robloxId = await noblox.getIdFromUsername(username.trim());
    if (!robloxId) {
      return res.status(400).json({ error: "Roblox kullanıcı adı bulunamadı." });
    }

    const { getFriendJar, getOrFetchFriendBotId } = require("../../bot/services/robloxGroupManager");
    const friendJar = getFriendJar();

    // Arkadaşlık isteği gönder
    try {
      await noblox.sendFriendRequest({ userId: robloxId, jar: friendJar });
    } catch (err) {
      const errMsg = err.message || "";
      if (!errMsg.includes("already friends") && !errMsg.includes("Cannot send friend request to friends") && !errMsg.includes("are already friends")) {
        console.error("sendFriendRequest error:", err);
        return res.status(400).json({
          error: `Arkadaşlık isteği gönderilemedi. Hata: ${errMsg}`
        });
      }
    }

    const botRobloxId = await getOrFetchFriendBotId();
    const botProfileUrl = botRobloxId ? `https://www.roblox.com/users/${botRobloxId}/profile` : "https://www.roblox.com";

    res.json({
      success: true,
      robloxId,
      botProfileUrl
    });
  } catch (err) {
    console.error("API Friend Request error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/auth/roblox/friend-verify", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Giriş yapmanız gerekli." });

  const { robloxId, username } = req.body;
  if (!robloxId || !username) {
    return res.status(400).json({ error: "Eksik parametre." });
  }

  try {
    const { getFriendJar, getOrFetchFriendBotId } = require("../../bot/services/robloxGroupManager");
    const botRobloxId = await getOrFetchFriendBotId();
    const friendJar = getFriendJar();
    if (!botRobloxId || !friendJar) {
      return res.status(503).json({ error: "Botun Roblox bağlantısı aktif değil. Daha sonra tekrar deneyin." });
    }

    const noblox = require("noblox.js");
    const friends = await noblox.getFriends({ userId: botRobloxId, jar: friendJar });
    const isFriend = friends && friends.data && friends.data.some(f => String(f.id) === String(robloxId));

    if (!isFriend) {
      return res.status(400).json({ error: "Arkadaşlık isteği henüz kabul edilmemiş." });
    }

    // Veritabanına kaydet
    const User = require("../../models/User");
    const { saveStoreNow } = require("../../models/Store");
    let dbUser = await User.findById(req.user._id);
    if (!dbUser && req.user.discordId) {
      dbUser = await User.findOne({ discordId: String(req.user.discordId) });
    }
    if (!dbUser) {
      return res.status(404).json({ error: "Kullanıcı veritabanında bulunamadı." });
    }

    dbUser.robloxId = String(robloxId);
    dbUser.robloxUsername = username;
    dbUser.isAuthorized = true;
    dbUser.verificationStatus = {
      ...(dbUser.verificationStatus || {}),
      robloxVerifiedAt: new Date().toISOString(),
      source: 'friend-verify'
    };
    await dbUser.save();
    saveStoreNow();

    // Rolleri senkronize et
    const { getDiscordClient } = require("../../bot/discordClient");
    const { syncMemberRoles } = require("../../bot/services/roleSyncService");
    const { TARGET_GUILD_ID } = require("../../config");
    
    const client = getDiscordClient();
    if (client && client.isReady()) {
      try {
        const guild = await client.guilds.fetch(TARGET_GUILD_ID);
        const member = await guild.members.fetch(dbUser.discordId);
        await syncMemberRoles(guild, member, parseInt(robloxId, 10), username);
      } catch (syncErr) {
        console.warn("API Friend Verify role sync failed:", syncErr.message);
      }
    }

    // Arkadaşlıktan çıkar
    const { unfriendUser } = require("../../bot/services/robloxGroupManager");
    await unfriendUser(parseInt(robloxId, 10));

    try {
      const { syncRoleConnectionForUser } = require("../services/discordRoleConnectionService");
      const accessToken = dbUser.discordAccessToken || req.session?.discordAccessToken;
      const applicationId = process.env.DISCORD_ROLE_CONNECTION_APPLICATION_ID;
      if (applicationId && accessToken) {
        const groupMemberships = {};
        const { getDiscordClient } = require("../../bot/discordClient");
        const client = getDiscordClient();
        const guild = client?.isReady() ? await client.guilds.fetch("1367646464804655104").catch(() => null) : null;
        if (guild && dbUser.discordId) {
          const member = await guild.members.fetch(dbUser.discordId).catch(() => null);
          if (member) {
            groupMemberships['35431216'] = member.roles.cache.has('35431216');
            groupMemberships['130659145'] = member.roles.cache.has('130659145');
          }
        }
        await syncRoleConnectionForUser(dbUser, accessToken, applicationId, groupMemberships);
      }
    } catch (syncErr) {
      console.warn("[api] Discord role connection sync failed after verification:", syncErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("API Friend Verify error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/avukat/ai", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { discordId } = req.body;
  if (!discordId) return res.status(400).json({ error: "Discord ID girilmelidir." });

  try {
    const { startAvukatInterview } = require("../../bot/services/avukatService");
    const { getDiscordClient } = require("../../bot/discordClient");
    const client = getDiscordClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({ error: "Discord botu aktif değil." });
    }

    // Mock an interaction
    let responseContent = "";
    const mockInteraction = {
      client,
      user: { id: req.user.discordId },
      deferReply: async () => {},
      editReply: async (payload) => {
        responseContent = payload.content || (payload.embeds && payload.embeds[0]?.data?.description) || JSON.stringify(payload);
      }
    };

    await startAvukatInterview(mockInteraction, discordId);
    return res.json({ success: true, message: responseContent || "AI Mülakatı başlatıldı." });
  } catch (err) {
    console.error("AI Avukat Alım Hatası:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/api/avukat/direct", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { discordId } = req.body;
  if (!discordId) return res.status(400).json({ error: "Discord ID girilmelidir." });

  try {
    const { hireAvukatDirect } = require("../../bot/services/avukatService");
    const { getDiscordClient } = require("../../bot/discordClient");
    const client = getDiscordClient();
    if (!client || !client.isReady()) {
      return res.status(503).json({ error: "Discord botu aktif değil." });
    }

    // Mock an interaction
    let responseContent = "";
    const mockInteraction = {
      client,
      user: { id: req.user.discordId },
      deferReply: async () => {},
      editReply: async (payload) => {
        responseContent = payload.content || (payload.embeds && payload.embeds[0]?.data?.description) || JSON.stringify(payload);
      }
    };

    await hireAvukatDirect(mockInteraction, discordId);
    return res.json({ success: true, message: responseContent || "Sınavsız avukat alımı gerçekleştirildi." });
  } catch (err) {
    console.error("Sınavsız Avukat Alım Hatası:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
