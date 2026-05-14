const mongoose = require("mongoose");

const economySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    wallet: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    inventory: [String],
    lastDailyClaimAt: Date,
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Economy", economySchema);
