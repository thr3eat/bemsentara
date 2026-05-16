let client = null;

function setDiscordClient(discordClient) {
  client = discordClient;
}

function getDiscordClient() {
  return client;
}

module.exports = { setDiscordClient, getDiscordClient };
