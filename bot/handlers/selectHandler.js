const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

function handleSelectInteraction(interaction) {
  if (interaction.customId !== "support_category") return null;

  const category = interaction.values[0];
  const modal = new ModalBuilder()
    .setCustomId(`support_modal_${category}`)
    .setTitle(`Destek Talebi - ${category}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("support_subject")
        .setLabel("Konu / Subject")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("support_description")
        .setLabel("Açıklama / Description")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("support_priority")
        .setLabel("Öncelik / Priority (low/medium/high)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );

  return interaction.showModal(modal);
}

module.exports = { handleSelectInteraction };
