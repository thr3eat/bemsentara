const { Client, GatewayIntentBits, Partials } = require("discord.js");
const https = require("https");

function createDiscordClient() {
  // Force IPv4 agent to prevent REST API hangs on Render (IPv6 timeout issue)
  // WebSocket gateway IPv4 is handled by dns.setDefaultResultOrder("ipv4first") in index.js
  const ipv4HttpsAgent = new https.Agent({ family: 4, keepAlive: true });

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
  });
}

module.exports = { createDiscordClient };
