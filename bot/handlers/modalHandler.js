const { ActionRowBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require("discord.js");
const Ticket = require("../../models/Ticket");
const { generateTicketId } = require("../../utils/ticketId");
const { SUPPORT_CATEGORIES } = require("../../config");
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
    const guild = interaction.guild;

    let ticketCategory = guild.channels.cache.find(
      (c) => c.name === "support-tickets" && c.type === ChannelType.GuildCategory
    );

    if (!ticketCategory) {
      ticketCategory = await guild.channels.create({
        name: "support-tickets",
        type: ChannelType.GuildCategory,
      });
    }

    const ticketChannel = await guild.channels.create({
      name: `${ticketId.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: ticketCategory.id,
      permissionOverwrites: [
        {
          id: guild.id,
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
