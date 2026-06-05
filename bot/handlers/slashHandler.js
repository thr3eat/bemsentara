const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Ticket = require("../../models/Ticket");
const User = require("../../models/User");
const { getSupportMenuEmbed, getSupportButton } = require("../embeds");
const { SUPPORT_CATEGORIES, BASE_URL } = require("../../config");

async function handleSlashCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;
  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await User.findOne({ discordId: interaction.user.id });

    if (commandName === "support") {
      if (!interaction.guild) {
        return interaction.editReply({ content: "❌ Bu komut sadece sunucu'da çalışır" });
      }

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply({ content: "❌ Bunu yapmaya yetkili değilsiniz" });
      }

      const embed = getSupportMenuEmbed();
      const button = getSupportButton();
      await interaction.channel.send({ embeds: [embed], components: [button] });
      return interaction.editReply({ content: "✅ Destek menüsü gönderildi" });
    }

    if (commandName === "mytickets") {
      const tickets = await Ticket.find({ userId: interaction.user.id, status: "open" });
      if (tickets.length === 0) {
        return interaction.editReply({ content: "📭 Açık ticket'ınız yok" });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎫 Açık Ticket'larınız")
        .setColor(0x7c6af7)
        .setDescription(
          tickets
            .map(
              (t) =>
                `**${t.ticketId}** - ${t.subject}\n Kategori: ${SUPPORT_CATEGORIES[t.category].name} | Durum: ${t.status}`
            )
            .join("\n\n")
        )
        .setFooter({ text: "Sentara Support" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "closeticket") {
      const reason = interaction.options.getString("reason") || "Belirtilmedi";
      const ticket = await Ticket.findOne({ userId: interaction.user.id, status: "open" });

      if (!ticket) {
        return interaction.editReply({ content: "❌ Açık ticket'ınız yok" });
      }

      ticket.status = "closed";
      ticket.closedAt = new Date();
      ticket.closeReason = reason;
      ticket.closedBy = interaction.user.id;
      ticket.closedByName = interaction.user.username;
      await ticket.save();

      // Kanal mesajlarını logla
      const { logTicketClosed, logTicketMessages } = require("../services/ticketLog");
      const { TARGET_GUILD_ID } = require("../../config");
      const guildId = ticket.guildId || TARGET_GUILD_ID;
      const guild = await interaction.client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);

      if (channel) {
        await logTicketMessages(channel, ticket);
      }

      logTicketClosed(ticket, {
        closedBy: interaction.user.id,
        closedByName: interaction.user.username,
        reason,
        source: "/closeticket komutu",
      });

      // ── Moderatörse "aferin!" mesajı gönder ───────────────────────────────────
      const isModerator = interaction.member?.permissions.has('ManageMessages') ||
                          interaction.member?.permissions.has('ModerateMembers');
      
      if (isModerator && interaction.user.id !== ticket.userId) {
        try {
          const { sendModerationPraise } = require("../services/ticketAI");
          await sendModerationPraise(interaction.user.id, ticket, interaction.client);
        } catch (_) {}
      }

      // Ticket sahibine DM gönder
      try {
        const { buildReopenAndRateRow } = require("../embeds");
        const ticketOwner = await interaction.client.users.fetch(ticket.userId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🔒 Ticket'ınız Kapatıldı")
          .setDescription(
            `Ticket'ınız **${interaction.user.username}** adlı kişi tarafından kapatıldı.\n\n` +
              `**Sebep:** ${reason}\n\n` +
              `Ticket'ı yeniden açmak veya destek ekibini değerlendirmek için aşağıdaki butonları kullanabilirsiniz.`
          )
          .addFields(
            { name: "🎫 Ticket ID", value: `\`${ticket.ticketId}\``, inline: true },
            { name: "📋 Konu", value: ticket.subject, inline: true }
          )
          .setFooter({ text: "Sentara Support • Gizlilik politikamız gereği değerlendirme notunuz anonim tutulur." })
          .setTimestamp();

        const dmButtons = buildReopenAndRateRow(ticket.ticketId);
        await ticketOwner.send({ embeds: [dmEmbed], components: [dmButtons] });
      } catch (dmErr) {
        console.warn("[closeticket] Kullanıcıya DM gönderilemedi:", dmErr.message);
      }

      if (channel) {
        const closeEmbed = new EmbedBuilder()
          .setTitle("🔒 Ticket Kapatıldı")
          .setDescription(
            `**Sebep:** ${reason}\n\n` +
            `⏳ Bu kanal **2 dakika** içinde yeniden açılmazsa otomatik silinecektir.`
          )
          .setColor(0xed4245)
          .setTimestamp();
        await channel.send({ embeds: [closeEmbed] });
        await channel.permissionOverwrites.edit(ticket.userId, {
          ViewChannel: false,
          SendMessages: false,
        });
      }

      // 2 dakika sonra kanal silinmek üzere kuyruğa al
      const { scheduleTicketDeletion } = require("../services/ticketCleanup");
      scheduleTicketDeletion(ticket.ticketId);

      return interaction.editReply({ content: "✅ Ticket kapatıldı" });
    }

    if (commandName === "profile") {
      if (!user) {
        const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
        return interaction.editReply({ content: `❌ Henüz yetkilendirmediniz. [Yetkilendirin](${authUrl})` });
      }

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${user.robloxUsername || user.discordUsername}`)
        .setColor(user.profileColor || 0x7c6af7)
        .addFields(
          {
            name: "🎮 Roblox",
            value: `**Username:** ${user.robloxUsername || "Yok"}\n**ID:** ${user.robloxId || "Yok"}`,
            inline: false,
          },
          {
            name: "💬 Discord",
            value: `**Username:** ${user.discordUsername}\n**ID:** ${user.discordId}`,
            inline: false,
          },
          {
            name: "🎖️ Grup Rolü",
            value: user.groupRole?.roleName || "Rolu yok",
            inline: true,
          },
          {
            name: "📅 Katılım",
            value: `<t:${Math.floor(user.joinedAt / 1000)}:R>`,
            inline: true,
          }
        )
        .setTimestamp();

      if (user.profileBio) {
        embed.addFields({ name: "📝 Hakkında", value: user.profileBio, inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "authorize") {
      const authUrl = `${BASE_URL}/auth/authorize?discordId=${interaction.user.id}`;
      const embed = new EmbedBuilder()
        .setTitle("🔐 Hesabınızı Yetkilendirin")
        .setDescription(`[Tıklayın ve Roblox hesabınızla giriş yapın](${authUrl})`)
        .setColor(0x7c6af7);

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "verify") {
      const { handleVerify } = require("./roleHandler");
      const groupId = interaction.options.getNumber("grupid");
      return handleVerify(interaction, groupId);
    }

    if (commandName === "update") {
      const { handleUpdate } = require("./roleHandler");
      const groupId = interaction.options.getNumber("grupid");
      return handleUpdate(interaction, groupId);
    }
  } catch (err) {
    console.error(`[${commandName}] Hata:`, err);
    return interaction.editReply({ content: `❌ Hata: ${err.message}` });
  }

  return null;
}

module.exports = { handleSlashCommand };
