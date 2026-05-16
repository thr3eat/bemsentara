const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const RobloxStrategy = require("passport-roblox");
const axios = require("axios");
const User = require("../models/User");
const { BASE_URL, ADMIN_IDS } = require("../config");

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/auth/discord/callback`,
      scope: ["identify", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ discordId: profile.id });
        const avatarUrl = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(profile.discriminator || '0') % 5}.png`;
        const bannerUrl = profile.banner ? `https://cdn.discordapp.com/banners/${profile.id}/${profile.banner}.png?size=512` : null;

        if (!user) {
          user = new User({
            discordId: profile.id,
            discordUsername: profile.username,
            discordEmail: profile.email,
            discordAvatar: avatarUrl,
            discordBanner: bannerUrl,
            isAdmin: ADMIN_IDS.includes(profile.id),
            isStaff: ADMIN_IDS.includes(profile.id),
          });
          await user.save();
        } else {
          user.discordUsername = profile.username;
          user.discordEmail = profile.email;
          user.discordAvatar = avatarUrl;
          user.discordBanner = bannerUrl || user.discordBanner;
          user.isAdmin = ADMIN_IDS.includes(profile.id);
          user.isStaff = ADMIN_IDS.includes(profile.id);
          await user.save();
        }

        done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

passport.use(
  new RobloxStrategy(
    {
      clientID: process.env.ROBLOX_OAUTH_CLIENT_ID || process.env.ROBLOX_CLIENT_ID || "6748474744887863615",
      clientSecret: process.env.ROBLOX_OAUTH_CLIENT_SECRET || process.env.ROBLOX_CLIENT_SECRET || "RBX-4cu22Y7nHEGVVnrep29VdXblXPmUj6GVE-8vge5zjmw-cMhX37JWF7PlQ9D7-bbe",
      callbackURL: `${BASE_URL}/auth/roblox/callback`,
      scope: ["openid", "profile"],
      pkce: true,
      state: true,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        console.log("=== ROBLOX AUTH CALLBACK ===");
        console.log("Roblox Profile Received:", JSON.stringify(profile, null, 2));
        console.log("Request User Before:", req.user ? { _id: req.user._id, discordId: req.user.discordId, discordUsername: req.user.discordUsername } : "NO USER");
        
        if (!req.user) {
            console.error("Error: No user in request - must login with Discord first");
            return done(new Error("Lütfen önce Discord ile giriş yapın."));
        }
        
        console.log("Fetching user by ID:", req.user._id);
        let user = await User.findById(req.user._id);
        
        if (!user) {
            console.error("Error: User not found in database with ID:", req.user._id);
            return done(new Error("Kullanıcı veritabanında bulunamadı."));
        }
        
        console.log("User found, updating with Roblox data...");
        console.log("Before update:", { 
          robloxId: user.robloxId, 
          robloxUsername: user.robloxUsername, 
          isAuthorized: user.isAuthorized 
        });
        
        user.robloxId = profile.id || profile.sub || (profile._json && profile._json.sub);
        
        // Try to get actual username from Roblox API
        let robloxUsername = profile.preferredUsername || profile.displayName || profile.nickname || profile.name;
        
        if (!robloxUsername && user.robloxId) {
          try {
            // Fetch username from Roblox API
            const userResponse = await axios.get(`https://users.roblox.com/v1/users/${user.robloxId}`);
            const userData = userResponse.data;
            robloxUsername = userData.name || userData.username || `User_${user.robloxId}`;
            console.log("Fetched username from Roblox API:", robloxUsername);
          } catch (apiErr) {
            console.warn("Could not fetch Roblox username from API:", apiErr.message);
            robloxUsername = `User_${user.robloxId}`;
          }
        }
        
        user.robloxUsername = robloxUsername || "RobloxUser";
        user.isAuthorized = true;
        
        console.log("Saving user...");
        await user.save();
        
        console.log("After save:", { 
          robloxId: user.robloxId, 
          robloxUsername: user.robloxUsername, 
          isAuthorized: user.isAuthorized,
          _id: user._id
        });
        
        // Update session with new user data
        req.user = user;
        console.log("Session updated with user data");
        console.log("=== ROBLOX AUTH COMPLETE ===");
        
        done(null, user);
      } catch (err) {
        console.error("=== ROBLOX AUTH ERROR ===");
        console.error(err);
        done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
