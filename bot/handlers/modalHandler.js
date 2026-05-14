const { ActionRowBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require("discord.js");
const Ticket = require("../../models/Ticket");
const { generateTicketId } = require("../../utils/ticketId");
const { SUPPORT_CATEGORIES, TARGET_GUILD_ID, TARGET_CHANNEL_ID } = require("../../config");
const { buildTicketEmbed, buildCloseButton } = require("../embeds");

async function handleModalSubmit(interaction) {
  if (!interaction.customId.startsWith("support_modal_")) return null;

  const category = interaction.customId.replace("support_modal_", "");
  const subject = interaction.fields.getTextInputValue("support_subject");
  const description = interaction.fields.getTextInputValue("support_description");
  let priority = interaction.fields.getTextInputValue("support_priority") || "medium";

  if (!["low", "medium", "high"].includes(priority)) {
    priority = "medium";
  }

  try {
    const ticketId = generateTicketId();
    const targetGuild = await interaction.client.guilds.fetch(TARGET_GUILD_ID);
    if (!targetGuild) {
      throw new Error("Hedef sunucu bulunamadı.");
    }

    const configuredChannel = TARGET_CHANNEL_ID
      ? await targetGuild.channels.fetch(TARGET_CHANNEL_ID).catch(() => null)
      : null;

    let ticketChannel;
    if (configuredChannel?.type === ChannelType.GuildCategory) {
      ticketChannel = await targetGuild.channels.create({
        name: `${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: configuredChannel.id,
        permissionOverwrites: [
          {
            id: targetGuild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });
    } else if (configuredChannel?.type === ChannelType.GuildText) {
      ticketChannel = await configuredChannel.threads.create({
        name: ticketId.toLowerCase(),
        autoArchiveDuration: 1440,
        type: ChannelType.PublicThread,
      });
    } else {
      let ticketCategory = targetGuild.channels.cache.find(
        (c) => c.name === "support-tickets" && c.type === ChannelType.GuildCategory
      );

      if (!ticketCategory) {
        ticketCategory = await targetGuild.channels.create({
          name: "support-tickets",
          type: ChannelType.GuildCategory,
        });
      }

      ticketChannel = await targetGuild.channels.create({
        name: `${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: [
          {
            id: targetGuild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });
    }

    const ticket = new Ticket({
      ticketId,
      userId: interaction.user.id,
      userName: interaction.user.username,
      category,
      subject,
      description,
      priority,
      channelId: ticketChannel.id,
    });

    await ticket.save();

    const ticketEmbed = buildTicketEmbed(ticket);
    const closeButton = buildCloseButton(ticketId);

    await ticketChannel.send({ embeds: [ticketEmbed], components: [closeButton] });

    return interaction.reply({ content: `✅ Ticket oluşturuldu: ${ticketChannel}`, ephemeral: true });
  } catch (err) {
    console.error("Ticket oluşturma hatası:", err);
    return interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
  }
}

module.exports = { handleModalSubmit };
