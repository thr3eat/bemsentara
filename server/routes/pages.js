const express = require("express");
const { renderMainPage, renderDashboard, renderTicketsPage } = require("../views");

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

module.exports = router;
