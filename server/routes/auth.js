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
    try {
      // Regenerate session to ensure updated user data is persisted
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.redirect("/dashboard?robloxError=true");
        }
        
        // Re-establish user in regenerated session
        if (req.user) {
          req.login(req.user, (err) => {
            if (err) {
              console.error("Login error:", err);
              return res.redirect("/dashboard?robloxError=true");
            }
            res.redirect("/dashboard?robloxLinked=true");
          });
        } else {
          res.redirect("/dashboard?robloxError=true");
        }
      });
    } catch (err) {
      console.error("Roblox callback error:", err);
      res.redirect("/dashboard?robloxError=true");
    }
  }
);

router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send(err);
    res.redirect("/");
  });
});

module.exports = router;
