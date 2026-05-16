const { MessageFlags } = require("discord.js");

const Ephemeral = MessageFlags.Ephemeral;

function deferEphemeral() {
  return { flags: Ephemeral };
}

function replyEphemeral(content) {
  return { content, flags: Ephemeral };
}

module.exports = { Ephemeral, deferEphemeral, replyEphemeral };
