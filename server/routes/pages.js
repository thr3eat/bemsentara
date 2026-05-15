const express = require("express");
const { renderMainPage, renderDashboard, renderTicketsPage, renderStaffPanel, renderDebugPage, renderProfilePage, renderSettingsPage, renderLegalPage, renderWikiPage } = require("../views");
const { users, tickets, economies } = require("../../models/Store");

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

router.get("/staff", (req, res) => {
  if (!req.user || (!req.user.isStaff && !req.user.isAdmin)) return res.redirect("/");
  res.send(renderStaffPanel(req.user));
});

router.get("/debug", (req, res) => {
  if (!req.user || !req.user.isAdmin) return res.redirect("/");
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

router.get("/legal/tos", (req, res) => {
  res.send(renderLegalPage("Hizmet Koşulları", "Platformumuzu kullanarak aşağıdaki kuralları kabul etmiş sayılırsınız: <br><br>1. Spam ve rahatsız edici içerik yasaktır.<br>2. Kullanıcı güvenliğini tehlikeye atacak işlemler yasaktır.<br>3. Kurallara uymayan kullanıcılar uzaklaştırılır."));
});

router.get("/legal/privacy", (req, res) => {
  res.send(renderLegalPage("Gizlilik Politikası", "Veri güvenliğiniz bizim için önemlidir: <br><br>1. Sadece gerekli Discord ve Roblox profil verileriniz saklanır.<br>2. Verileriniz hiçbir üçüncü partiyle paylaşılmaz.<br>3. Hesabınızı sildiğinizde verileriniz kalıcı olarak yok edilir."));
});

router.get("/wiki", (req, res) => {
  const { wikis } = require("../../models/Store");
  const comments = wikis.find({});
  res.send(renderWikiPage(req.user, comments));
});

module.exports = router;
