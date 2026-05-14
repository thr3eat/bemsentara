const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    discordId: String,
    discordUsername: String,
    discordAvatar: String,
    discordEmail: String,

    robloxId: Number,
    robloxUsername: String,
    robloxAvatar: String,

    isAuthorized: { type: Boolean, default: false },
    isStaff: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },

    groupRole: { roleId: Number, roleName: String },
    canSetRole: { type: Boolean, default: false },
    canManageMembers: { type: Boolean, default: false },
    canManageTickets: { type: Boolean, default: false },

    profileBio: String,
    profileColor: { type: String, default: "#7c6af7" },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
