let activeRiddle = null;

const RIDDLE_CHANNEL_ID = "1523038873406541834";
const RIDDLE_GUILD_ID = "1367646464804655104";

/**
 * Normalizes state based on last messages in the channel on startup.
 * @param {import("discord.js").Client} client 
 */
async function initializeRiddleState(client) {
  try {
    const guild = client.guilds.cache.get(RIDDLE_GUILD_ID) || await client.guilds.fetch(RIDDLE_GUILD_ID).catch(() => null);
    if (!guild) return;

    const channel = guild.channels.cache.get(RIDDLE_CHANNEL_ID) || await guild.channels.fetch(RIDDLE_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    // Fetch the last 20 messages to reconstruct the current riddle state
    const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (!messages || messages.size === 0) return;

    const sortedMessages = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Look for active questions and answers from newest to oldest
    for (let i = sortedMessages.length - 1; i >= 0; i--) {
      const msg = sortedMessages[i];
      if (msg.author.bot) continue;

      const reactions = msg.reactions.cache;
      const botReactedTick = reactions.get("✅")?.me;
      const botReactedCross = reactions.get("❌")?.me;
      const botReactedQuestion = reactions.get("❓")?.me;

      // Case 1: Active answer message (both reactions still present)
      if (botReactedTick && botReactedCross) {
        let questionMsg = null;
        for (let j = i - 1; j >= 0; j--) {
          const prevMsg = sortedMessages[j];
          if (prevMsg.author.bot) continue;
          if (prevMsg.reactions.cache.get("❓")?.me) {
            questionMsg = prevMsg;
            break;
          }
        }
        if (questionMsg) {
          activeRiddle = {
            questionMessageId: questionMsg.id,
            questionAuthorId: questionMsg.author.id,
            answerMessageId: msg.id
          };
          console.log(`[RiddleService] Reconstructed active riddle state: Question ${questionMsg.id} by ${questionMsg.author.tag}, Answer ${msg.id}`);
          return;
        }
      }

      // Case 2: Active question message (has question reaction and is the latest question)
      if (botReactedQuestion) {
        activeRiddle = {
          questionMessageId: msg.id,
          questionAuthorId: msg.author.id,
          answerMessageId: null
        };
        console.log(`[RiddleService] Reconstructed active riddle state: Question ${msg.id} by ${msg.author.tag}, waiting for answer.`);
        return;
      }
    }
  } catch (err) {
    console.error("[RiddleService] Error during state reconstruction:", err);
  }
}

/**
 * Handles incoming messages in the riddle channel.
 * @param {import("discord.js").Message} message 
 */
async function handleRiddleMessage(message) {
  try {
    if (!message.guild || message.guild.id !== RIDDLE_GUILD_ID || message.channel.id !== RIDDLE_CHANNEL_ID) return;
    if (message.author.bot) return;

    if (activeRiddle === null) {
      // Step 1: Riddle Question
      activeRiddle = {
        questionMessageId: message.id,
        questionAuthorId: message.author.id,
        answerMessageId: null
      };
      await message.react("❓").catch(() => {});
      console.log(`[RiddleService] Question message registered: ${message.id} by ${message.author.tag}`);
    } else if (activeRiddle.answerMessageId === null) {
      // Step 2: Riddle Answer
      activeRiddle.answerMessageId = message.id;
      await message.react("✅").catch(() => {});
      await message.react("❌").catch(() => {});
      console.log(`[RiddleService] Answer message registered: ${message.id} by ${message.author.tag}`);
    }
  } catch (err) {
    console.error("[RiddleService] Error in handleRiddleMessage:", err);
  }
}

/**
 * Handles reactions on riddle messages.
 * @param {import("discord.js").MessageReaction} reaction 
 * @param {import("discord.js").User} user 
 */
async function handleRiddleReaction(reaction, user) {
  try {
    if (!reaction.message.guild || reaction.message.guild.id !== RIDDLE_GUILD_ID || reaction.message.channel.id !== RIDDLE_CHANNEL_ID) return;
    if (user.bot) return;

    if (!activeRiddle || reaction.message.id !== activeRiddle.answerMessageId) return;
    if (user.id !== activeRiddle.questionAuthorId) return;

    const emojiName = reaction.emoji.name;
    if (emojiName === "✅" || emojiName === "❌") {
      const otherEmoji = emojiName === "✅" ? "❌" : "✅";
      const otherReaction = reaction.message.reactions.cache.get(otherEmoji);
      
      if (otherReaction) {
        await otherReaction.users.remove(reaction.client.user.id).catch(() => {});
      }

      console.log(`[RiddleService] Riddle solved! Author ${user.tag} reacted with ${emojiName}. Removed ${otherEmoji}.`);
      activeRiddle = null;
    }
  } catch (err) {
    console.error("[RiddleService] Error in handleRiddleReaction:", err);
  }
}

// Export getter/setter for testing purposes
function getActiveRiddle() {
  return activeRiddle;
}
function setActiveRiddle(state) {
  activeRiddle = state;
}

module.exports = {
  initializeRiddleState,
  handleRiddleMessage,
  handleRiddleReaction,
  getActiveRiddle,
  setActiveRiddle
};
