const {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const {
  getManagedChannel,
  createPrivateChannel,
  unregisterChannel,
  getChannelOwner,
  isManagedChannel,
} = require("../services/voiceManager");

async function requireOwnedChannel(interaction) {
  const channel = await getManagedChannel(interaction.member, interaction.guild);
  if (!channel) {
    await interaction.reply({
      content:
        "❌ Yönetilebilir bir ses kanalın yok. Önce **Kanal Oluştur** butonuna bas veya join-to-create kanalına gir.",
      ephemeral: true,
    });
    return null;
  }
  if (getChannelOwner(channel.id) !== interaction.user.id) {
    await interaction.reply({
      content: "❌ Bu kanalın sahibi değilsin.",
      ephemeral: true,
    });
    return null;
  }
  return channel;
}

async function handleVoiceButton(interaction) {
  if (!interaction.customId.startsWith("voice_")) return null;

  const { customId } = interaction;

  if (customId === "voice_create") {
    if (!interaction.member.voice.channel) {
      return interaction.reply({
        content: "❌ Önce bir ses kanalına girmelisin (veya join-to-create kanalına gir).",
        ephemeral: true,
      });
    }
    const ch = await createPrivateChannel(interaction.guild, interaction.member);
    return interaction.reply({
      content: `✅ Ses kanalın oluşturuldu: ${ch}`,
      ephemeral: true,
    });
  }

  if (customId === "voice_rename") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    const modal = new ModalBuilder()
      .setCustomId(`voice_modal_rename_${channel.id}`)
      .setTitle("Kanalı Yeniden Adlandır")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("name")
            .setLabel("Yeni kanal adı")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true)
            .setValue(channel.name.slice(0, 100))
        )
      );
    return interaction.showModal(modal);
  }

  if (customId === "voice_delete") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    unregisterChannel(channel.id);
    await channel.delete("Sahip tarafından silindi");
    return interaction.reply({ content: "✅ Kanal silindi.", ephemeral: true });
  }

  if (customId === "voice_add") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`voice_select_add_${channel.id}`)
        .setPlaceholder("Eklenecek kullanıcıyı seç")
        .setMinValues(1)
        .setMaxValues(1)
    );
    return interaction.reply({
      content: "👤 Kanala eklemek istediğin kullanıcıyı seç:",
      components: [row],
      ephemeral: true,
    });
  }

  if (customId === "voice_remove") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`voice_select_remove_${channel.id}`)
        .setPlaceholder("Çıkarılacak kullanıcıyı seç")
        .setMinValues(1)
        .setMaxValues(1)
    );
    return interaction.reply({
      content: "👤 Kanaldan çıkarmak istediğin kullanıcıyı seç:",
      components: [row],
      ephemeral: true,
    });
  }

  if (customId === "voice_lock") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    await channel.permissionOverwrites.edit(interaction.guild.id, {
      Connect: false,
    });
    return interaction.reply({ content: "🔒 Kanal kilitlendi.", ephemeral: true });
  }

  if (customId === "voice_unlock") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    await channel.permissionOverwrites.edit(interaction.guild.id, {
      Connect: null,
    });
    return interaction.reply({ content: "🔓 Kanal kilidi açıldı (herkese açık bağlantı).", ephemeral: true });
  }

  if (customId === "voice_limit") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    const count = channel.members.size;
    const limit = channel.userLimit || "Sınırsız";
    return interaction.reply({
      content: `👥 **${channel.name}**\nÜye: **${count}**${channel.userLimit ? ` / ${limit}` : ""}`,
      ephemeral: true,
    });
  }

  if (customId === "voice_kick") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`voice_select_kick_${channel.id}`)
        .setPlaceholder("Atılacak kullanıcıyı seç")
        .setMinValues(1)
        .setMaxValues(1)
    );
    return interaction.reply({
      content: "👢 Kanaldan atmak istediğin kullanıcıyı seç:",
      components: [row],
      ephemeral: true,
    });
  }

  if (customId === "voice_info") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    const ownerId = getChannelOwner(channel.id);
    const members = channel.members.map((m) => m.toString()).join(", ") || "Boş";
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`ℹ️ ${channel.name}`)
      .addFields(
        { name: "Sahip", value: ownerId ? `<@${ownerId}>` : "—", inline: true },
        { name: "Üye", value: `${channel.members.size}`, inline: true },
        { name: "Limit", value: channel.userLimit ? String(channel.userLimit) : "Yok", inline: true },
        { name: "Kilit", value: channel.permissionsFor(interaction.guild.id)?.has(PermissionFlagsBits.Connect) ? "Açık" : "Kilitli", inline: true },
        { name: "Üyeler", value: members.slice(0, 1024), inline: false }
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (customId === "voice_role_add") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`voice_select_role_add_${channel.id}`)
        .setPlaceholder("Eklenecek rolü seç")
        .setMinValues(1)
        .setMaxValues(1)
    );
    return interaction.reply({
      content: "🎭 Kanala bağlanabilecek rolü seç:",
      components: [row],
      ephemeral: true,
    });
  }

  if (customId === "voice_role_remove") {
    const channel = await requireOwnedChannel(interaction);
    if (!channel) return null;
    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`voice_select_role_remove_${channel.id}`)
        .setPlaceholder("Kaldırılacak rolü seç")
        .setMinValues(1)
        .setMaxValues(1)
    );
    return interaction.reply({
      content: "🎭 Kanaldan kaldırılacak rolü seç:",
      components: [row],
      ephemeral: true,
    });
  }

  return null;
}

async function handleVoiceSelect(interaction) {
  const { customId } = interaction;
  if (!customId.startsWith("voice_select_")) return null;

  let action;
  let channelId;
  if (customId.startsWith("voice_select_role_add_")) {
    action = "role_add";
    channelId = customId.replace("voice_select_role_add_", "");
  } else if (customId.startsWith("voice_select_role_remove_")) {
    action = "role_remove";
    channelId = customId.replace("voice_select_role_remove_", "");
  } else if (customId.startsWith("voice_select_add_")) {
    action = "add";
    channelId = customId.replace("voice_select_add_", "");
  } else if (customId.startsWith("voice_select_remove_")) {
    action = "remove";
    channelId = customId.replace("voice_select_remove_", "");
  } else if (customId.startsWith("voice_select_kick_")) {
    action = "kick";
    channelId = customId.replace("voice_select_kick_", "");
  } else {
    return null;
  }

  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

  if (!channel || !isManagedChannel(channel.id)) {
    return interaction.update({ content: "❌ Kanal bulunamadı.", components: [] });
  }
  if (getChannelOwner(channel.id) !== interaction.user.id) {
    return interaction.update({ content: "❌ Bu kanalın sahibi değilsin.", components: [] });
  }

  if (action === "add") {
    const userId = interaction.values[0];
    await channel.permissionOverwrites.edit(userId, {
      Connect: true,
      ViewChannel: true,
    });
    return interaction.update({
      content: `✅ <@${userId}> kanala eklendi.`,
      components: [],
    });
  }

  if (action === "remove") {
    const userId = interaction.values[0];
    await channel.permissionOverwrites.delete(userId);
    const m = channel.members.get(userId);
    if (m) await m.voice.disconnect().catch(() => null);
    return interaction.update({
      content: `✅ <@${userId}> kanaldan çıkarıldı.`,
      components: [],
    });
  }

  if (action === "kick") {
    const userId = interaction.values[0];
    const m = channel.members.get(userId);
    if (m) await m.voice.disconnect("Kanal sahibi attı");
    return interaction.update({
      content: `👢 <@${userId}> kanaldan atıldı.`,
      components: [],
    });
  }

  if (action === "role_add") {
    const roleId = interaction.values[0];
    await channel.permissionOverwrites.edit(roleId, { Connect: true, ViewChannel: true });
    return interaction.update({
      content: `✅ <@&${roleId}> rolüne kanal erişimi verildi.`,
      components: [],
    });
  }

  if (action === "role_remove") {
    const roleId = interaction.values[0];
    await channel.permissionOverwrites.delete(roleId);
    return interaction.update({
      content: `✅ <@&${roleId}> rolünün kanal erişimi kaldırıldı.`,
      components: [],
    });
  }

  return null;
}

async function handleVoiceModal(interaction) {
  if (!interaction.customId.startsWith("voice_modal_rename_")) return null;

  const channelId = interaction.customId.replace("voice_modal_rename_", "");
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel || getChannelOwner(channel.id) !== interaction.user.id) {
    return interaction.reply({ content: "❌ Kanal bulunamadı veya yetkin yok.", ephemeral: true });
  }

  let name = interaction.fields.getTextInputValue("name").trim().slice(0, 100);
  if (!name) {
    return interaction.reply({ content: "❌ Geçerli bir isim gir.", ephemeral: true });
  }

  try {
    await channel.setName(name);
  } catch {
    name = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 32);
    await channel.setName(name);
  }

  return interaction.reply({ content: `✅ Kanal adı **${channel.name}** olarak güncellendi.`, ephemeral: true });
}

module.exports = {
  handleVoiceButton,
  handleVoiceSelect,
  handleVoiceModal,
};
