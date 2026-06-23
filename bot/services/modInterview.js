'use strict';

/**
 * Moderator Interview Service (Enhanced MOD-ALIM System)
 * 
 * Features:
 * - Admin -> /mod-alim @user (BBU system integrated)
 * - Professional UI with progress bar
 * - 7 challenging interview questions
 * - Detailed evaluation system
 * - Point scoring system
 * - User, admin and mod-team notifications
 */

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { chatWithAI }   = require('./aiService');
const StaffProgress    = require('../../models/StaffProgress');

const MOD_ROLE_ID   = process.env.MOD_ROLE_ID   || '1518692389169135666';
const MOD_GUILD_ID  = process.env.MOD_GUILD_ID  || '1367646464804655104';

// Active interviews: userId -> { adminId, guildId, history[], score, questionCount, startTime, responses[] }
const activeInterviews = new Map();

// System prompt for interview questions
const INTERVIEW_SYSTEM = `You are conducting a MASTER MODERATOR interview for Eko Yildiz Discord server.
This is the most difficult and selective interview. Ask the candidate 7 VERY HARD, ANALYTICAL, REAL-WORLD scenario questions.

QUESTION CATEGORIES:
1. RULE VIOLATION SCENARIO (spam, harassment, profanity, NSFW detection)
2. CONFLICT MANAGEMENT (2+ users arguing, how do you intervene?)
3. AUTHORITY LIMITS (ban vs warn, when to use each?)
4. TEAM COMMUNICATION AND TRANSPARENCY (how do you manage sensitive decisions?)
5. SERVER SECURITY (bot spam, alts, trust level)
6. COMMUNITY MANAGEMENT (growth, social dynamics, mod burnout)
7. DIFFICULTY ASSESSMENT (real challenges and responsibilities of this role)

FOR EACH ANSWER EVALUATION (mandatory format):
[POINT: X/10] Brief EVALUATION (why this score? what's missing?)

BEFORE CONCLUSION:
- If question count < 7: Ask the next question
- If question count = 7: GIVE RESULT

RESULT (mandatory format):
[RESULT: ACCEPT] (Average >= 7) or [RESULT: REJECT] (Average < 7)

RESULT EXPLANATION:
- Evaluate candidate's potential among moderators
- 3-5 line summary and development suggestions
- If rejected: mention which areas need improvement

VOICE:
- Professional, fair, supportive
- English/Turkish mix allowed
- Clear and understandable
- Each question MAX 250 characters`;

// Start interview
async function startModInterview(targetUser, adminId, guildId, client) {
  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle('shield MOD-ALIM: Moderator Application')
    .setThumbnail(targetUser.avatarURL() || null)
    .setDescription(
      `Hello **${targetUser.username}**! wave\n\n` +
      `You have been selected for a SPECIAL INTERVIEW to become a **MASTER MODERATOR** in **Eko Yildiz**!\n\n` +
      `target_icon **What is this?**\n` +
      `* **7 very challenging interview questions** (Real moderation scenarios)\n` +
      `* **Detailed AI evaluation** (Each answer is scored)\n` +
      `* **If you succeed:**\n` +
      `  - shield Moderator Team role\n` +
      `  - chart_with_upwards_trend Staff System registration\n` +
      `  - medal Special moderator badges\n\n` +
      `clipboard **Requirements:**\n` +
      `* Moderation knowledge and experience\n` +
      `* Discord security understanding\n` +
      `* Team communication and leadership capacity\n` +
      `* Community management vision\n\n` +
      `This interview will be tough. Want to give it a try?`
    )
    .setFooter({ text: 'Eko Yildiz * Moderator Selection System' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mod_interview_yes_${targetUser.id}`)
      .setLabel('checkmark Yes, I am ready')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mod_interview_no_${targetUser.id}`)
      .setLabel('x I want but no time')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    await targetUser.send({ embeds: [embed], components: [row] });
    activeInterviews.set(targetUser.id, {
      adminId,
      guildId,
      history: [],
      score: 0,
      questionCount: 0,
      totalScore: 0,
      client,
      startTime: Date.now(),
      responses: [],
      username: targetUser.username,
    });
    return true;
  } catch (err) {
    console.error('[modInterview] DM send failed:', err.message);
    return false;
  }
}

// Yes/No button handler
async function handleInterviewButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('mod_interview_yes_') && !cid.startsWith('mod_interview_no_')) return false;

  const userId = interaction.user.id;

  if (cid.startsWith('mod_interview_no_')) {
    const info = activeInterviews.get(userId);
    activeInterviews.delete(userId);
    
    await interaction.update({
      content: 'pause Interview postponed. You can apply again when ready. Good luck!',
      embeds: [], components: [],
    }).catch(() => {});

    if (info) {
      try {
        const admin = await client.users.fetch(info.adminId);
        await admin.send({
          embeds: [new EmbedBuilder()
            .setColor(0xfbbf24)
            .setTitle('pause Interview Postponed')
            .setDescription(`**${interaction.user.tag}** postponed the moderator interview.\n\nCan apply again later.`)
            .setTimestamp()]
        });
      } catch (_) {}
    }
    return true;
  }

  // Yes - start interview
  const info = activeInterviews.get(userId);
  if (!info) {
    await interaction.update({ content: 'x Application not found.', embeds: [], components: [] }).catch(() => {});
    return true;
  }

  await interaction.update({
    content: 'rocket Great! Interview is starting... Check DM for questions.',
    embeds: [new EmbedBuilder()
      .setColor(0x7c6af7)
      .setDescription('hourglass_flowing_sand Please check your DM!\n*You can answer questions by typing.*')], 
    components: [],
  }).catch(() => {});

  try {
    await askNextQuestion(userId, null, client);
  } catch (err) {
    console.error('[modInterview] First question error:', err.message);
    await interaction.user.send({
      embeds: [new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('x Interview Failed to Start')
        .setDescription(`Technical error: \`${err.message}\`\n\nTry again later.`)
        .setFooter({ text: 'Eko Yildiz * Moderator Selection' })]
    }).catch(() => {});
    activeInterviews.delete(userId);
  }

  return true;
}

// Ask next question
async function askNextQuestion(userId, previousAnswer, client) {
  const info = activeInterviews.get(userId);
  if (!info) return;

  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;

  if (previousAnswer) {
    info.history.push({ role: 'user', content: previousAnswer });
    info.responses.push(previousAnswer);
  }

  try {
    const dmCh = await user.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    let systemMsg = '';
    if (info.questionCount === 0) {
      systemMsg = 'Start the interview. Ask the first question.';
    } else if (info.questionCount >= 7) {
      systemMsg = 'All 7 questions completed. Evaluate result: [RESULT: ACCEPT] or [RESULT: REJECT]. Give general summary.';
    } else {
      systemMsg = `Evaluate question ${info.questionCount} and ask question ${info.questionCount + 1}.`;
    }

    info.history.push({ role: 'user', content: systemMsg });
    const reply = await chatWithAI(info.history, INTERVIEW_SYSTEM);
    info.history.push({ role: 'assistant', content: reply });
    info.questionCount++;

    // Calculate points
    const scoreMatch = reply.match(/\[POINT:\s*(\d+)\/10\]/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      info.totalScore += score;
      info.score = score;
    }

    // Check for result
    if (/\[RESULT:\s*ACCEPT\]/i.test(reply)) {
      await finalizeInterview(userId, true, reply, client);
      return;
    }
    if (/\[RESULT:\s*REJECT\]/i.test(reply)) {
      await finalizeInterview(userId, false, reply, client);
      return;
    }

    // Progress bar
    const progress = Math.min(info.questionCount, 7);
    const progressBar = 'blacksquare'.repeat(progress) + 'whitesquare'.repeat(7 - progress);

    // Send question
    const cleanReply = reply
      .replace(/\[POINT:[^\]]+\]/gi, '')
      .replace(/\[RESULT:[^\]]+\]/gi, '')
      .trim();

    await user.send({
      embeds: [new EmbedBuilder()
        .setColor(0x7c6af7)
        .setAuthor({ name: `shield MOD-ALIM INTERVIEW * Question ${progress}/7` })
        .setDescription(cleanReply)
        .addFields(
          { name: 'chart_with_upwards_trend Progress', value: `Progress bar ${progress}/7`, inline: false }
        )
        .setFooter({ text: 'Type your answer. Keep DM open.' })
        .setTimestamp()],
    });
  } catch (err) {
    console.error('[modInterview] Question error:', err.message);
    await user.send({
      embeds: [new EmbedBuilder()
        .setColor(0xfbbf24)
        .setTitle('warning Temporary Issue')
        .setDescription(`AI temporarily unavailable.\n\nRetrying soon...\n\n\`\`\`${err.message}\`\`\``)]
    });
  }
}

// DM reply handler
async function handleInterviewReply(message, client) {
  const userId = message.author.id;
  if (!activeInterviews.has(userId)) return false;
  if (activeInterviews.get(userId).questionCount === 0) return false;

  await askNextQuestion(userId, message.content, client);
  return true;
}

// Finalize interview
async function finalizeInterview(userId, accepted, summary, client) {
  const info = activeInterviews.get(userId);
  if (!info) return;
  activeInterviews.delete(userId);

  const user = await client.users.fetch(userId).catch(() => null);
  const avgScore = info.questionCount > 0 ? Math.round(info.totalScore / Math.min(info.questionCount, 7)) : 0;
  const duration = Math.round((Date.now() - info.startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const cleanSummary = summary
    .replace(/\[RESULT:[^\]]+\]/gi, '')
    .replace(/\[POINT:[^\]]+\]/gi, '')
    .trim()
    .slice(0, 1024);

  if (accepted) {
    try {
      const guild  = await client.guilds.fetch(info.guildId).catch(() => null);
      const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
      if (member) {
        await member.roles.add(MOD_ROLE_ID, 'Passed moderator interview (MOD-ALIM)').catch(() => {});
      }
    } catch (err) {
      console.warn('[modInterview] Role add failed:', err.message);
    }

    try {
      let p = await StaffProgress.findOne({ userId });
      if (!p) {
        p = new StaffProgress({ userId, guildId: info.guildId, level: 1 });
      } else if (p.level < 1) {
        p.level = 1;
      }
      await p.save();
      console.log(`[modInterview] ${userId} registered to staff system (MASTER MOD)`);
    } catch (err) {
      console.warn('[modInterview] Staff registration error:', err.message);
    }

    if (user) {
      const acceptionEmbed = new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle('tada CONGRATULATIONS! You are now a MASTER MODERATOR!')
        .setThumbnail(user.avatarURL() || null)
        .setDescription(
          `You **passed the interview successfully**! trophy\n\n` +
          `Welcome to Eko Yildiz moderation team.`
        )
        .addFields(
          { name: 'chart_with_upwards_trend Interview Results', value: `Average Score: **${avgScore}/10**\nDuration: **${minutes}m ${seconds}s**`, inline: false },
          { name: 'sparkles Evaluation', value: cleanSummary, inline: false },
          { name: 'gift What you get', value: '* shield Moderator Team Role\n* chart_with_upwards_trend Staff System Registration\n* medal Moderator Badges', inline: false }
        )
        .setFooter({ text: 'Eko Yildiz * MOD-ALIM System' })
        .setTimestamp();

      await user.send({ embeds: [acceptionEmbed] }).catch(() => {});
    }

    try {
      const admin = await client.users.fetch(info.adminId);
      const adminEmbed = new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle('heavy_check_mark INTERVIEW RESULT: ACCEPTED')
        .setThumbnail(user?.avatarURL() || null)
        .setDescription(
          `**Candidate:** ${user?.tag || `<@${userId}>`}\n` +
          `**Admin:** <@${info.adminId}>\n` +
          `**Server:** <@&${MOD_ROLE_ID}>`
        )
        .addFields(
          { name: 'chart_with_upwards_trend Results', value: `**Average Score:** ${avgScore}/10\n**Total Questions:** ${Math.min(info.questionCount, 7)}/7\n**Duration:** ${minutes}m ${seconds}s`, inline: false },
          { name: 'speech_balloon Evaluation', value: cleanSummary, inline: false }
        )
        .setFooter({ text: 'System Date: ' + new Date().toLocaleString('en-US') })
        .setTimestamp();

      await admin.send({ embeds: [adminEmbed] });
    } catch (_) {}
  } else {
    if (user) {
      const rejectionEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('x INTERVIEW RESULT: REJECTED')
        .setThumbnail(user.avatarURL() || null)
        .setDescription(
          `You didn't meet moderator criteria this time.\n\n` +
          `But this is not the end! Improve yourself and apply again.`
        )
        .addFields(
          { name: 'chart_with_upwards_trend Results', value: `Average Score: **${avgScore}/10**\nDuration: **${minutes}m ${seconds}s**`, inline: false },
          { name: 'speech_balloon Feedback', value: cleanSummary, inline: false },
          { name: 'bulb Next Steps', value: 'Focus on the areas mentioned in the evaluation and improve. Then apply again! muscle', inline: false }
        )
        .setFooter({ text: 'Eko Yildiz * MOD-ALIM System' })
        .setTimestamp();

      await user.send({ embeds: [rejectionEmbed] }).catch(() => {});
    }

    try {
      const admin = await client.users.fetch(info.adminId);
      const adminEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('x INTERVIEW RESULT: REJECTED')
        .setThumbnail(user?.avatarURL() || null)
        .setDescription(
          `**Candidate:** ${user?.tag || `<@${userId}>`}\n` +
          `**Admin:** <@${info.adminId}>`
        )
        .addFields(
          { name: 'chart_with_upwards_trend Results', value: `**Average Score:** ${avgScore}/10\n**Total Questions:** ${Math.min(info.questionCount, 7)}/7\n**Duration:** ${minutes}m ${seconds}s`, inline: false },
          { name: 'speech_balloon Evaluation', value: cleanSummary, inline: false }
        )
        .setFooter({ text: 'System Date: ' + new Date().toLocaleString('en-US') })
        .setTimestamp();

      await admin.send({ embeds: [adminEmbed] });
    } catch (_) {}
  }
}

module.exports = {
  startModInterview,
  handleInterviewButton,
  handleInterviewReply,
};
