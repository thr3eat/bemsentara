const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
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
        if (!user) {
          user = new User({
            discordId: profile.id,
            discordUsername: profile.username,
            discordEmail: profile.email,
            discordAvatar: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
            isAdmin: ADMIN_IDS.includes(profile.id),
            isStaff: ADMIN_IDS.includes(profile.id),
          });
          await user.save();
        } else {
          user.discordUsername = profile.username;
          user.discordEmail = profile.email;
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
