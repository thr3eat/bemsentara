const express = require("express");
const passport = require("../passport");

const router = express.Router();

router.get("/login", (req, res) => {
  res.send(require("../views").renderLoginPage());
});

router.get("/auth/discord", passport.authenticate("discord"));

router.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send(err);
    res.redirect("/");
  });
});

module.exports = router;
