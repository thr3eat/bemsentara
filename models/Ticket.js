const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    ticketId: String,
    userId: String,
    userName: String,
    category: String,
    subject: String,
    description: String,
    status: { type: String, enum: ["open", "closed", "pending"], default: "open" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    channelId: String,
    staffAssigned: String,
    messages: [
      {
        authorId: String,
        authorName: String,
        content: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    createdAt: { type: Date, default: Date.now },
    closedAt: Date,
    closeReason: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
