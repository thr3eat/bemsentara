const express = require("express");
const { renderMainPage, renderDashboard, renderTicketsPage, renderStaffPanel, renderDebugPage } = require("../views");
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

module.exports = router;
