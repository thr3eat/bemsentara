const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const RobloxStrategy = require("passport-roblox");
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
        if (!req.user) {
            return done(new Error("Lütfen önce Discord ile giriş yapın."));
        }
        
        let user = await User.findById(req.user._id);
        if (user) {
            user.robloxId = profile.id;
            user.robloxUsername = profile.preferredUsername || profile.nickname || profile.name || "RobloxUser"; 
            user.isAuthorized = true;
            await user.save();
        }
        
        done(null, user);
      } catch (err) {
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
