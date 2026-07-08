const { Client, GatewayIntentBits, Partials } = require("discord.js");
const https = require("https");
const http = require("http");

function createDiscordClient() {
  // Force IPv4 agent to prevent gateway hangs on Render (IPv6 timeout issue)
  const ipv4HttpsAgent = new https.Agent({ family: 4, keepAlive: true });
  const ipv4HttpAgent = new http.Agent({ family: 4, keepAlive: true });

  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildPresences,
    ],
    // DM mesajları için partials zorunlu
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.User,
    ],
    // Force IPv4 for REST API calls
    rest: {
      agent: ipv4HttpsAgent,
    },
    // Force IPv4 for WebSocket gateway connection
    ws: {
      agent: ipv4HttpsAgent,
    },
  });
}

module.exports = { createDiscordClient };
