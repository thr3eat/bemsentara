'use strict';

// Globally sanitize outgoing messages to avoid @everyone / @here pings.
// Required early at startup to patch discord.js prototypes used across the bot.

function _sanitizeString(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/@everyone/gi, '@\u200beveryone').replace(/@here/gi, '@\u200bhere');
}

function _sanitizeEmbed(embed) {
  if (!embed) return embed;
  const e = embed.data ? embed.data : { ...embed };
  if (e.title) e.title = _sanitizeString(e.title);
  if (e.description) e.description = _sanitizeString(e.description);
  if (e.footer && e.footer.text) e.footer.text = _sanitizeString(e.footer.text);
  if (Array.isArray(e.fields)) {
    e.fields = e.fields.map(f => ({
      name: _sanitizeString(f.name),
      value: _sanitizeString(f.value),
      inline: f.inline || false
    }));
  }
  return e;
}

function _sanitizeOptions(opts) {
  if (opts === undefined || opts === null) return opts;
  // If string passed directly
  if (typeof opts === 'string') return _sanitizeString(opts);
  // If message/options object
  const out = { ...opts };
  if (out.content) out.content = _sanitizeString(out.content);
  if (out.embeds && Array.isArray(out.embeds)) {
    out.embeds = out.embeds.map(_sanitizeEmbed);
  }
  // Buttons, components generally safe; labels are ok but sanitize labels too
  if (out.components && Array.isArray(out.components)) {
    try {
      out.components = JSON.parse(JSON.stringify(out.components));
      for (const row of out.components) {
        if (row && row.components) {
          for (const comp of row.components) {
            if (comp.label) comp.label = _sanitizeString(comp.label);
            if (comp.custom_id) comp.custom_id = _sanitizeString(comp.custom_id);
          }
        }
      }
    } catch (_) {}
  }
  return out;
}

module.exports = function applyDisableEveryone(discord) {
  try {
    const classes = require('discord.js');
    const targets = [];
    if (classes.TextChannel) targets.push(classes.TextChannel.prototype);
    if (classes.NewsChannel) targets.push(classes.NewsChannel.prototype);
    if (classes.ThreadChannel) targets.push(classes.ThreadChannel.prototype);
    if (classes.DMChannel) targets.push(classes.DMChannel.prototype);
    if (classes.PartialDMChannel) targets.push(classes.PartialDMChannel && classes.PartialDMChannel.prototype);
    if (classes.User) targets.push(classes.User.prototype);

    // Patch channel/user send
    for (const proto of targets) {
      if (!proto) continue;
      const orig = proto.send;
      if (typeof orig !== 'function') continue;
      proto.send = function sendSanitized(content, options) {
        try {
          // discord.js supports send(content) or send(options)
          let out;
          if (typeof content === 'string' || content === undefined) {
            if (options !== undefined) {
              out = _sanitizeOptions(Object.assign({}, options, { content: content }));
            } else {
              out = _sanitizeOptions(content);
            }
          } else {
            out = _sanitizeOptions(content);
          }
          return orig.call(this, out);
        } catch (err) {
          return orig.call(this, content, options);
        }
      };
    }

    // Patch Interaction replies
    const Interaction = classes.Interaction;
    if (Interaction && Interaction.prototype) {
      const ip = Interaction.prototype;
      if (ip.reply && typeof ip.reply === 'function') {
        const origReply = ip.reply;
        ip.reply = function replySanitized(options) {
          try {
            const out = _sanitizeOptions(options);
            return origReply.call(this, out);
          } catch (err) {
            return origReply.call(this, options);
          }
        };
      }
      if (ip.editReply && typeof ip.editReply === 'function') {
        const origEdit = ip.editReply;
        ip.editReply = function editSanitized(options) {
          try {
            const out = _sanitizeOptions(options);
            return origEdit.call(this, out);
          } catch (err) {
            return origEdit.call(this, options);
          }
        };
      }
      if (ip.followUp && typeof ip.followUp === 'function') {
        const origFollow = ip.followUp;
        ip.followUp = function followSanitized(options) {
          try {
            const out = _sanitizeOptions(options);
            return origFollow.call(this, out);
          } catch (err) {
            return origFollow.call(this, options);
          }
        };
      }
    }

    // Patch WebhookClient send? Webhooks use send as well on client
    try {
      const { WebhookClient } = require('discord.js');
      if (WebhookClient && WebhookClient.prototype && typeof WebhookClient.prototype.send === 'function') {
        const origWebhook = WebhookClient.prototype.send;
        WebhookClient.prototype.send = function webhookSanitized(options) {
          try {
            const out = _sanitizeOptions(options);
            return origWebhook.call(this, out);
          } catch (err) {
            return origWebhook.call(this, options);
          }
        };
      }
    } catch (_) {}

    // Also patch REST edits that may come from library? skip.
  } catch (err) {
    try { console.error('[disableEveryone] patch failed:', err.message); } catch (_) {}
  }
};
