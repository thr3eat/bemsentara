'use strict';

const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');

/**
 * Personellerin birbirleriyle DM üzerinden sohbet etmesini sağlar
 * @param {import('discord.js').Interaction} interaction 
 */
async function handleStaffChat(interaction) {
  try {
    const targetUser = interaction.options.getUser('personel');
    const message = interaction.options.getString('mesaj');

    const { getOrCreate } = require('./staffSystem');

    // Etkileşim yapan kullanıcıyı kontrol et
    const senderStaff = await getOrCreate(interaction.user.id, interaction.guildId, interaction.client);
    if (!senderStaff || senderStaff.status !== 'active') {
      return interaction.reply({ content: '❌ Sadece aktif personeller bu özelliği kullanabilir.', ephemeral: true });
    }

    // Hedef personeli kontrol et
    const recipientStaff = await getOrCreate(targetUser.id, interaction.guildId, interaction.client);
    if (!recipientStaff || recipientStaff.status !== 'active') {
      return interaction.reply({ content: '❌ Hedef personel aktif değil veya sistem kayıtlı değil.', ephemeral: true });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: '❌ Kendine mesaj gönderemezsin!', ephemeral: true });
    }

    // Bot DM kategorisinde gruplandır
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
      const embed = new EmbedBuilder()
        .setTitle(`💬 ${interaction.user.username}'den Mesaj`)
        .setDescription(message)
        .setColor(0x7c6af7)
        .addFields(
          { name: '👤 Gönderen', value: `${interaction.user.toString()}\n\`${interaction.user.tag}\``, inline: true },
          { name: '🎖️ Rütbesi', value: senderStaff.level ? `Level ${senderStaff.level}` : 'Stajyer', inline: true },
          { name: '⏰ Zaman', value: `<t:${Math.floor(Date.now() / 1000)}:t>`, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: 'Eko Yıldız • Personel İç Sohbet' })
        .setTimestamp();

      // Reply butonu
      const replyBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`staffchat_reply_${interaction.user.id}`)
          .setLabel('💬 Yanıt Ver')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💬')
      );

      await targetUser.send({ embeds: [embed], components: [replyBtn] }).catch(err => {
        throw new Error(`Kullanıcıya mesaj gönderilemedi: ${err.message}`);
      });

      // Gönderene onay mesajı
      return interaction.editReply({ 
        content: `✅ Mesajın <@${targetUser.id}>'e başarıyla gönderildi!` 
      });

    } catch (dmErr) {
      return interaction.editReply({ 
        content: `❌ Hata: ${dmErr.message}` 
      });
    }

  } catch (err) {
    console.error('[staffChat] Hata:', err.message);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: `❌ Bir hata oluştu: ${err.message}`, ephemeral: true });
    }
    return interaction.editReply({ content: `❌ Bir hata oluştu: ${err.message}` });
  }
}

module.exports = { handleStaffChat };
