const express = require("express");
const passport = require("../passport");
const User = require("../../models/User");
const { renderLoginPage, renderAuthorizePage } = require("../views");

const router = express.Router();

router.get("/login", (req, res) => {
  res.send(renderLoginPage());
});

router.get("/auth/authorize", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/auth/discord");
  }
  res.redirect("/auth/roblox");
});

router.get("/auth/discord", passport.authenticate("discord"));

router.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

router.get("/auth/roblox", passport.authenticate("roblox"));

router.get(
  "/auth/roblox/callback",
  passport.authenticate("roblox", { failureRedirect: "/dashboard" }),
  async (req, res) => {
    // Force session to be marked as modified so it gets saved with updated user
    req.session.touch();
    res.redirect("/dashboard?robloxLinked=true");
  }
);

router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send(err);
    res.redirect("/");
  });
});

module.exports = router;
