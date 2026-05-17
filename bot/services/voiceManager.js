const { ChannelType, PermissionFlagsBits } = require("discord.js");
const {
  VOICE_CATEGORY_ID,
  VOICE_JOIN_CHANNEL_ID,
  GUILD2_ID,
  GUILD2_VOICE_JOIN_ID,
  GUILD2_VOICE_CATEGORY_ID,
} = require("../../config");

/** userId → channelId */
const ownerChannels = new Map();
/** channelId → userId */
const channelOwners = new Map();

// ── Sunucuya göre join-to-create kanalını döndür ─────────────────────────────
function getJoinChannelId(guildId) {
  if (guildId === GUILD2_ID) return GUILD2_VOICE_JOIN_ID;
  return VOICE_JOIN_CHANNEL_ID;
}

// ── Sunucuya göre ses kategorisini döndür ────────────────────────────────────
function getVoiceCategoryId(guildId) {
  if (guildId === GUILD2_ID) return GUILD2_VOICE_CATEGORY_ID || null;
  return VOICE_CATEGORY_ID;
}

function sanitizeName(username) {
  const base = (username || "oda")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u00C0-\u024F#_-]/gi, "")
    .slice(0, 90);
  return base.startsWith("#") ? base : `#${base}`;
}

function getOwnerChannelId(userId) {
  return ownerChannels.get(userId) || null;
}

function registerChannel(channelId, userId) {
  const old = ownerChannels.get(userId);
  if (old && old !== channelId) channelOwners.delete(old);
  ownerChannels.set(userId, channelId);
  channelOwners.set(channelId, userId);
}

function unregisterChannel(channelId) {
  const owner = channelOwners.get(channelId);
  if (owner) ownerChannels.delete(owner);
  channelOwners.delete(channelId);
}

function isManagedChannel(channelId) {
  return channelOwners.has(channelId);
}

function getChannelOwner(channelId) {
  return channelOwners.get(channelId) || null;
}

async function getManagedChannel(member, guild) {
  const ownedId = ownerChannels.get(member.id);
  if (ownedId) {
    const ch = guild.channels.cache.get(ownedId);
    if (ch) return ch;
    ownerChannels.delete(member.id);
    channelOwners.delete(ownedId);
  }
  if (member.voice?.channelId) {
    const ch = member.voice.channel;
    if (channelOwners.get(ch.id) === member.id) return ch;
  }
  return null;
}

function defaultOverwrites(guild, ownerId) {
  return [
    { id: guild.id, deny: [PermissionFlagsBits.Connect] },
    {
      id: ownerId,
      allow: [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.UseVAD,
        PermissionFlagsBits.MoveMembers,
      ],
    },
  ];
}

async function createPrivateChannel(guild, member) {
  const categoryId = getVoiceCategoryId(guild.id);

  const existingId = ownerChannels.get(member.id);
  if (existingId) {
    const existing = guild.channels.cache.get(existingId);
    if (existing) {
      await member.voice.setChannel(existing).catch(() => null);
      return existing;
    }
    unregisterChannel(existingId);
  }

  let name = sanitizeName(member.user.username);
  let channel;

  const createOptions = {
    name,
    type: ChannelType.GuildVoice,
    permissionOverwrites: defaultOverwrites(guild, member.id),
    reason: `Özel ses: ${member.user.tag}`,
  };
  if (categoryId) createOptions.parent = categoryId;

  try {
    channel = await guild.channels.create(createOptions);
  } catch {
    const fallbackName = member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32) || "oda";
    channel = await guild.channels.create({ ...createOptions, name: fallbackName });
  }

  registerChannel(channel.id, member.id);
  await member.voice.setChannel(channel).catch(() => null);
  return channel;
}

async function deleteChannelIfEmpty(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return;
  if (!isManagedChannel(channel.id)) return;
  if (channel.members.size > 0) return;
  unregisterChannel(channel.id);
  await channel.delete("Özel ses kanalı boş").catch(() => null);
}

async function handleJoinToCreate(oldState, newState) {
  if (!newState.channelId) return;
  if (newState.member.user.bot) return;

  const joinChannelId = getJoinChannelId(newState.guild.id);
  if (newState.channelId !== joinChannelId) return;

  await createPrivateChannel(newState.guild, newState.member);
}

async function handleVoiceLeave(oldState, newState) {
  const leftChannel = oldState.channel;
  if (!leftChannel || !isManagedChannel(leftChannel.id)) return;

  setTimeout(async () => {
    const refreshed = await oldState.guild.channels.fetch(leftChannel.id).catch(() => null);
    if (refreshed) await deleteChannelIfEmpty(refreshed);
  }, 1500);
}

module.exports = {
  ownerChannels,
  channelOwners,
  getOwnerChannelId,
  registerChannel,
  unregisterChannel,
  isManagedChannel,
  getChannelOwner,
  getManagedChannel,
  createPrivateChannel,
  deleteChannelIfEmpty,
  handleJoinToCreate,
  handleVoiceLeave,
  getJoinChannelId,
  // Eski compat export
  VOICE_JOIN_CHANNEL_ID,
};
