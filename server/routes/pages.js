const express = require("express");
const {
  renderMainPage,
  renderDashboard,
  renderTicketsPage,
  renderCreateTicketPage,
  renderNotificationsPage,
  renderStaffPanel,
  renderDebugPage,
  renderProfilePage,
  renderSettingsPage,
  renderLegalPage,
  renderWikiListPage,
  renderWikiArticlePage,
  renderAdminPage,
  renderLeaderboardPage,
  renderShopPage,
} = require("../views");
const { users, tickets, economies, wikiArticles } = require("../../models/Store");
const { isSiteAdmin } = require("../../utils/adminCheck");

const router = express.Router();

router.get("/", (req, res) => {
  res.send(renderMainPage());
});

router.get("/dashboard", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderDashboard(req.user));
});

router.get("/tickets", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderTicketsPage(req.user));
});

router.get("/tickets/new", (req, res) => {
  if (!req.user) return res.redirect("/login");
  const { SUPPORT_CATEGORIES } = require("../../config");
  const cats = Object.values(SUPPORT_CATEGORIES).map(c => c.name);
  res.send(renderCreateTicketPage(req.user, cats));
});

router.get("/staff", (req, res) => {
  const { isSiteStaff } = require("../../utils/adminCheck");
  if (!req.user || !isSiteStaff(req.user)) return res.redirect("/");
  res.send(renderStaffPanel(req.user));
});

router.get("/debug", (req, res) => {
  if (!req.user || !isSiteAdmin(req.user)) return res.redirect("/");
  const logger = require("../../utils/logger");
  const memory = process.memoryUsage();
  const stats = {
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memory.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + "MB",
    },
    db: {
      users: users.data.size,
      tickets: tickets.data.size,
      economies: economies.data.size,
      wikiArticles: wikiArticles.data.size,
    }
  };
  res.send(renderDebugPage(req.user, stats, logger.getLogs()));
});

router.get("/profile", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderProfilePage(req.user));
});

router.get("/settings", (req, res) => {
  if (!req.user) return res.redirect("/login");
  res.send(renderSettingsPage(req.user));
});

router.get("/notifications", (req, res) => {
  if (!req.user) return res.redirect("/login");
  // Bildirimler şimdilik boş — ileride notification store eklenebilir
  res.send(renderNotificationsPage(req.user, []));
});

router.get("/legal/tos", (req, res) => {
  res.send(renderLegalPage("Hizmet Koşulları", "Platformumuzu kullanarak aşağıdaki kuralları kabul etmiş sayılırsınız: <br><br>1. Spam ve rahatsız edici içerik yasaktır.<br>2. Kullanıcı güvenliğini tehlikeye atacak işlemler yasaktır.<br>3. Kurallara uymayan kullanıcılar uzaklaştırılır."));
});

router.get("/legal/privacy", (req, res) => {
  res.send(renderLegalPage("Gizlilik Politikası", "Veri güvenliğiniz bizim için önemlidir: <br><br>1. Sadece gerekli Discord ve Roblox profil verileriniz saklanır.<br>2. Verileriniz hiçbir üçüncü partiyle paylaşılmaz.<br>3. Hesabınızı sildiğinizde verileriniz kalıcı olarak yok edilir."));
});

router.get("/wiki", (req, res) => {
  const articles = wikiArticles.find({}).sort({ createdAt: -1 });
  res.send(renderWikiListPage(req.user, articles, isSiteAdmin(req.user)));
});

router.get("/wiki/:id", (req, res) => {
  const article = wikiArticles.findById(req.params.id);
  if (!article) return res.redirect("/wiki");

  // Görüntülenme sayısını artır (session başına bir kez)
  const viewKey = `wiki_viewed_${req.params.id}`;
  if (!req.session[viewKey]) {
    req.session[viewKey] = true;
    article.views = (article.views || 0) + 1;
    article.save().catch(() => {});
  }

  res.send(renderWikiArticlePage(req.user, article, isSiteAdmin(req.user)));
});

router.get("/admin", (req, res) => {
  if (!req.user || !isSiteAdmin(req.user)) return res.redirect("/");
  res.send(renderAdminPage(req.user));
});

router.get("/leaderboard", (req, res) => {
  const { economies, users } = require("../../models/Store");
  const allEco = economies.find({}).sort({ balance: -1 }).slice(0, 10);
  const topUsers = allEco.map(e => {
    const user = users.findOne({ discordId: e.userId });
    return {
      username: user ? user.discordUsername : "Bilinmiyor",
      avatar: user ? user.discordAvatar : "https://cdn.discordapp.com/embed/avatars/0.png",
      balance: e.balance
    };
  });
  res.send(renderLeaderboardPage(req.user, topUsers));
});

router.get("/shop", (req, res) => {
  const { SHOP_ITEMS } = require("../../bot/config/shopItems");
  res.send(renderShopPage(req.user, SHOP_ITEMS));
});

module.exports = router;
