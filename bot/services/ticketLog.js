const { EmbedBuilder } = require("discord.js");
const { TICKET_LOG_CHANNEL_ID, TARGET_GUILD_ID, SUPPORT_CATEGORIES } = require("../../config");
const { getDiscordClient } = require("../discordClient");

function categoryLabel(category) {
  return SUPPORT_CATEGORIES[category]?.name || category || "—";
}

function truncate(text, max = 1024) {
  if (!text) return "—";
  const s = String(text);
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

async function sendTicketLog(embed) {
  const client = getDiscordClient();
  if (!client?.isReady() || !TICKET_LOG_CHANNEL_ID) return;

  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    const channel = await guild.channels.fetch(TICKET_LOG_CHANNEL_ID);
    if (channel?.isSendable()) {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.warn("[ticketLog] Kanala yazılamadı:", err.message);
  }
}

function logTicketCreated(ticket, { source, ticketChannelId }) {
  const embed = new EmbedBuilder()
    .setColor(0x4ade80)
    .setTitle("🎫 Ticket Oluşturuldu")
    .addFields(
      { name: "Ticket ID", value: `\`${ticket.ticketId}\``, inline: true },
      { name: "Kategori", value: categoryLabel(ticket.category), inline: true },
      { name: "Öncelik", value: (ticket.priority || "medium").toUpperCase(), inline: true },
      { name: "Açan", value: `<@${ticket.userId}>\n\`${ticket.userId}\``, inline: true },
      { name: "Kullanıcı adı", value: ticket.userName || "—", inline: true },
      { name: "Kaynak", value: source || "Discord", inline: true },
      { name: "Konu", value: truncate(ticket.subject, 256), inline: false },
      { name: "Açıklama", value: truncate(ticket.description), inline: false }
    )
    .setFooter({ text: "Sentara • Bilet Kaydı" })
    .setTimestamp(ticket.createdAt || new Date());

  if (ticketChannelId) {
    embed.addFields({
      name: "Ticket kanalı",
      value: `<#${ticketChannelId}>`,
      inline: false,
    });
  }

  sendTicketLog(embed);
}

function logTicketClosed(ticket, { closedBy, closedByName, reason, source }) {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🔒 Ticket Kapatıldı")
    .addFields(
      { name: "Ticket ID", value: `\`${ticket.ticketId}\``, inline: true },
      { name: "Kategori", value: categoryLabel(ticket.category), inline: true },
      { name: "Öncelik", value: (ticket.priority || "medium").toUpperCase(), inline: true },
      { name: "Açan", value: `<@${ticket.userId}>`, inline: true },
      { name: "Kapatan", value: closedBy ? `<@${closedBy}>` : closedByName || "—", inline: true },
      { name: "Kaynak", value: source || "—", inline: true },
      { name: "Konu", value: truncate(ticket.subject, 256), inline: false },
      { name: "Kapanış sebebi", value: truncate(reason || ticket.closeReason || "Belirtilmedi"), inline: false }
    )
    .setFooter({ text: "Sentara • Bilet Kaydı" })
    .setTimestamp();

  if (ticket.channelId) {
    embed.addFields({
      name: "Ticket kanalı",
      value: `<#${ticket.channelId}>`,
      inline: false,
    });
  }

  sendTicketLog(embed);
}

function logTicketMessage(ticket, { authorId, authorName, content, source }) {
  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle("💬 Ticket Mesajı")
    .addFields(
      { name: "Ticket ID", value: `\`${ticket.ticketId}\``, inline: true },
      { name: "Yazan", value: `<@${authorId}>\n${authorName || "—"}`, inline: true },
      { name: "Kaynak", value: source || "Web", inline: true },
      { name: "Mesaj", value: truncate(content), inline: false }
    )
    .setFooter({ text: "Sentara • Bilet Kaydı" })
    .setTimestamp();

  sendTicketLog(embed);
}

/**
 * Ticket kanalındaki tüm mesajları log kanalına gönderir.
 * @param {import('discord.js').TextChannel} channel
 * @param {object} ticket
 */
async function logTicketMessages(channel, ticket) {
  const client = getDiscordClient();
  if (!client?.isReady() || !TICKET_LOG_CHANNEL_ID) return;

  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    const logChannel = await guild.channels.fetch(TICKET_LOG_CHANNEL_ID);
    if (!logChannel?.isSendable()) return;

    // Tüm mesajları çek (Discord max 100/istek, birden fazla sayfa)
    let allMessages = [];
    let lastId = null;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const fetched = await channel.messages.fetch(options);
      if (fetched.size === 0) break;

      allMessages = allMessages.concat([...fetched.values()]);
      lastId = fetched.last().id;

      if (fetched.size < 100) break;
    }

    // Kronolojik sıraya koy (eskiden yeniye)
    allMessages.reverse();

    // Bot mesajlarını filtrele, sadece gerçek mesajları al
    const humanMessages = allMessages.filter((m) => !m.author.bot || m.embeds.length === 0);

    if (humanMessages.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setColor(0x7c6af7)
        .setTitle(`📜 Ticket Geçmişi — ${ticket.ticketId}`)
        .setDescription("Bu ticket'ta kullanıcı mesajı bulunmuyor.")
        .setFooter({ text: "Sentara • Bilet Kaydı" })
        .setTimestamp();
      await logChannel.send({ embeds: [emptyEmbed] });
      return;
    }

    // Başlık embed'i
    const headerEmbed = new EmbedBuilder()
      .setColor(0x7c6af7)
      .setTitle(`📜 Ticket Geçmişi — ${ticket.ticketId}`)
      .setDescription(
        `**Konu:** ${ticket.subject}\n**Toplam mesaj:** ${humanMessages.length}`
      )
      .setFooter({ text: "Sentara • Bilet Kaydı" })
      .setTimestamp();
    await logChannel.send({ embeds: [headerEmbed] });

    // Mesajları 10'arlı gruplar halinde embed olarak gönder
    const chunkSize = 10;
    for (let i = 0; i < humanMessages.length; i += chunkSize) {
      const chunk = humanMessages.slice(i, i + chunkSize);
      const lines = chunk.map((m) => {
        const time = `<t:${Math.floor(m.createdTimestamp / 1000)}:T>`;
        const content = m.content
          ? truncate(m.content, 200)
          : m.embeds.length > 0
          ? "[Embed]"
          : m.attachments.size > 0
          ? "[Dosya]"
          : "[Bilinmeyen]";
        return `${time} **${m.author.username}:** ${content}`;
      });

      const msgEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(lines.join("\n"))
        .setFooter({ text: `Mesajlar ${i + 1}–${Math.min(i + chunkSize, humanMessages.length)}` });

      await logChannel.send({ embeds: [msgEmbed] });
    }
  } catch (err) {
    console.warn("[ticketLog] Mesaj geçmişi loglanamadı:", err.message);
  }
}

module.exports = {
  logTicketCreated,
  logTicketClosed,
  logTicketMessage,
  logTicketMessages,
};
