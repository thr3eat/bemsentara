const { EmbedBuilder } = require('discord.js');
const { chatWithAI } = require('./aiService');
const { sendAdminLog } = require('./staffAutomation');

async function handleAdminFormModals(interaction, client) {
  const { customId } = interaction;
  
  await interaction.deferReply({ ephemeral: true });

  try {
    if (customId === 'modal_leave_form') {
      const reason = interaction.fields.getTextInputValue('leave_reason');
      const duration = interaction.fields.getTextInputValue('leave_duration');
      
      const aiPrompt = `Bir moderatör izin talebinde bulundu.\nSebep: ${reason}\nSüre: ${duration} gün.\nBu talebi onayla veya reddet. Eğer kabul ediyorsan sadece "KABUL" yaz, reddediyorsan "RED" yaz ve yanına kısa bir sebep ekle.`;
      const aiResponse = await chatWithAI(aiPrompt, "Sen yetkili bir IK yöneticisisin.");
      
      const embed = new EmbedBuilder()
        .setTitle('📝 İzin Talebi')
        .addFields(
          { name: 'Kullanıcı', value: `<@${interaction.user.id}>` },
          { name: 'Sebep', value: reason },
          { name: 'Süre', value: `${duration} Gün` },
          { name: 'Yapay Zeka Kararı', value: aiResponse }
        )
        .setTimestamp();
        
      if (aiResponse.toUpperCase().includes('KABUL')) {
        embed.setColor(0x2ECC71);
        await interaction.editReply('✅ İzin talebiniz onaylandı.');
      } else {
        embed.setColor(0xE74C3C);
        await interaction.editReply(`❌ İzin talebiniz reddedildi.\n**Sebep:** ${aiResponse}`);
      }
      
      // Log it (Mute log can be used as general log for now or create a new one, but let's use ANA_SUNUCU log for forms)
      await sendAdminLog(client, 'ANA_SUNUCU', embed);
    }
    
    else if (customId === 'modal_suggestion_form') {
      const suggestion = interaction.fields.getTextInputValue('suggestion_text');
      
      const embed = new EmbedBuilder()
        .setTitle('💡 Yeni Bir Öneri Var')
        .setDescription(suggestion)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setColor(0x3498DB)
        .setTimestamp();
        
      await sendAdminLog(client, 'SUGGESTION_LOG', embed);
      await interaction.editReply('✅ Öneriniz başarıyla iletildi. Teşekkür ederiz!');
    }
    
    else if (customId === 'modal_resign_form') {
      const reason = interaction.fields.getTextInputValue('resign_reason');
      const confirm = interaction.fields.getTextInputValue('resign_confirm');
      
      if (confirm.toLowerCase() !== 'evet') {
        return interaction.editReply('❌ Onay kutusuna "Evet" yazmadığınız için işleminiz iptal edildi.');
      }
      
      const embed = new EmbedBuilder()
        .setTitle('🚪 İstifa Bildirimi')
        .addFields(
          { name: 'Kullanıcı', value: `<@${interaction.user.id}>` },
          { name: 'Sebep', value: reason }
        )
        .setColor(0x992D22)
        .setTimestamp();
        
      await sendAdminLog(client, 'ANA_SUNUCU', embed);
      await interaction.editReply('✅ İstifanız işleme alındı. Yönetim ekibi bilgilendirildi.');
      
      // Here you could add logic to actually kick the user from the admin server and roblox groups
      try {
        const { ADMIN_GUILD_ID } = require('./staffAutomation');
        const guild = client.guilds.cache.get(ADMIN_GUILD_ID);
        if (guild) {
          const member = await guild.members.fetch(interaction.user.id).catch(() => null);
          if (member) await member.kick('Kendi isteğiyle istifa etti.');
        }
      } catch (e) {
        console.error('Kick failed:', e.message);
      }
    }
    
    else if (customId === 'modal_modaction_form') {
      const userField = interaction.fields.getTextInputValue('mod_user');
      const actionField = interaction.fields.getTextInputValue('mod_action');
      const reasonField = interaction.fields.getTextInputValue('mod_reason');
      
      const embed = new EmbedBuilder()
        .setTitle('⚖️ Moderatör İşlemi Raporlandı')
        .addFields(
          { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'İşlem Gören', value: userField, inline: true },
          { name: 'İşlem Tipi', value: actionField, inline: true },
          { name: 'Sebep / Kanıt', value: reasonField }
        )
        .setColor(0x9B59B6)
        .setTimestamp();
        
      await sendAdminLog(client, 'CEZA_LOG', embed);
      await interaction.editReply('✅ İşleminiz başarıyla raporlandı.');
    }
    
    else if (customId === 'modal_ban_report_form') {
      const isim = interaction.fields.getTextInputValue('ban_isim');
      const kisi = interaction.fields.getTextInputValue('ban_kisi');
      const kisiId = interaction.fields.getTextInputValue('ban_id');
      const sebep = interaction.fields.getTextInputValue('ban_sebep');
      const kanit = interaction.fields.getTextInputValue('ban_kanit');

      const embed = new EmbedBuilder()
        .setTitle('🔨 Yeni Ban Raporu')
        .addFields(
          { name: 'Raporlayan İsim', value: isim, inline: true },
          { name: 'Raporlayan (Discord)', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Banlanacak Kişi', value: kisi, inline: true },
          { name: 'Banlanacak Kişinin ID', value: kisiId, inline: true },
          { name: 'Sebep', value: sebep },
          { name: 'Kanıt', value: kanit }
        )
        .setColor(0xE74C3C)
        .setTimestamp();
      
      const channel = await client.channels.fetch('1466946902154018967').catch(() => null);
      if (channel) await channel.send({ embeds: [embed] });
      await interaction.editReply('✅ Ban raporunuz başarıyla gönderildi.');
    }
    
    else if (customId === 'modal_mute_report_form') {
      const isim = interaction.fields.getTextInputValue('mute_isim');
      const rutbe = interaction.fields.getTextInputValue('mute_rutbe');
      const kisi = interaction.fields.getTextInputValue('mute_kisi');
      const ihlal = interaction.fields.getTextInputValue('mute_ihlal');

      const embed = new EmbedBuilder()
        .setTitle('🔇 Yeni Mute Raporu')
        .addFields(
          { name: 'Raporlayan İsim', value: isim, inline: true },
          { name: 'Rütbe', value: rutbe, inline: true },
          { name: 'Raporlayan (Discord)', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Mute Atılan Kişi', value: kisi, inline: true },
          { name: 'Kaçıncı İhlali', value: ihlal, inline: true }
        )
        .setColor(0xF39C12)
        .setTimestamp();
      
      const channel = await client.channels.fetch('1466946762190229589').catch(() => null);
      if (channel) await channel.send({ embeds: [embed] });
      await interaction.editReply('✅ Mute raporunuz başarıyla gönderildi.');
    }
    
    else if (customId === 'modal_mod_complain_form') {
      const mod = interaction.fields.getTextInputValue('comp_mod');
      const sebep = interaction.fields.getTextInputValue('comp_sebep');
      const kanit = interaction.fields.getTextInputValue('comp_kanit');

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Yeni Mod Şikayeti')
        .addFields(
          { name: 'Şikayet Eden (Discord)', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Şikayet Edilen Mod', value: mod, inline: true },
          { name: 'Sebep', value: sebep },
          { name: 'Kanıt', value: kanit }
        )
        .setColor(0x992D22)
        .setTimestamp();
      
      const channel = await client.channels.fetch('1466946497206816973').catch(() => null);
      if (channel) await channel.send({ embeds: [embed] });
      await interaction.editReply('✅ Şikayetiniz gizlilik içinde yönetime iletildi.');
    }
    
  } catch (err) {
    console.error('[AdminFormHandler] Error:', err);
    await interaction.editReply('❌ İşleminiz sırasında bir hata oluştu.');
  }
}

module.exports = {
  handleAdminFormModals
};
