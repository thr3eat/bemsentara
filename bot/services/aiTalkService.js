'use strict';

const { EmbedBuilder } = require('discord.js');
const { chatWithAI } = require('./aiService');
const User = require('../../models/User');

// Active konus sessions: userId -> { userId, username, guildId, adminId, topic, warned, history[] }
const activeSessions = new Map();

/**
 * Gets the AI system prompt based on topic and warning state.
 */
function getSystemPrompt(topic, warned) {
  if (warned) {
    return `Sen bir Discord moderasyon yapay zeka asistanısın. Sunucu yöneticileri adına kullanıcıyla doğrudan konuşuyorsun.
Konu: "${topic}"

Kullanıcıya daha önce "eğer birdaha aynısını dersen konuşma kapatılacak ve gerçekten atılacaksın" uyarısı yapıldı.
Kurallar:
- Eğer kullanıcı şimdi talebi açıkça kabul ediyorsa (örneğin çıkacağını söylüyorsa), cevabının en sonuna [KABUL] etiketini ekle ve "tamamdır, baybay!" gibi samimi bir veda et.
- Eğer kullanıcı talebi hala kabul etmiyorsa veya "tamam", "peki", "hayır" gibi geçiştirici/reddedici cevaplar veriyorsa, cevabının en sonuna kesinlikle [KICK] etiketini ekle ve sadece "baybay!" de.
- Kısa ve öz ol, mesajların 200 karakteri geçmesin.`;
  }

  return `Sen bir Discord moderasyon yapay zeka asistanısın. Sunucu yöneticileri adına kullanıcıyla doğrudan konuşuyorsun.
Konu: "${topic}"

Kurallar:
- Türkçe konuş, samimi ama ciddi ve net ol.
- Kullanıcı konuyu/talebi kabul ederse (örneğin blacklist sunucudan çıkacağını söylüyorsa), cevabının en sonuna kesinlikle [KABUL] etiketini ekle ve "tamamdır, baybay!" gibi samimi bir veda et.
- Kullanıcı talebi kesinlikle reddediyorsa (örneğin çıkmayacağını söylerse), cevabının en sonuna kesinlikle [RED] etiketini ekle ve "eğer birdaha aynısını dersen konuşma kapatılacak ve gerçekten atılacaksın" uyarısında bulun.
- Kısa ve öz ol, mesajların 200 karakteri geçmesin.`;
}

/**
 * Starts a new AI konus session.
 */
async function startKonusSession(interaction) {
  const targetUser = interaction.options.getUser('kullanici');
  const topic = interaction.options.getString('konu');

  if (targetUser.bot) {
    return interaction.editReply({ content: '❌ Botlarla konuşma başlatılamaz.' });
  }

  if (!interaction.guild) {
    return interaction.editReply({ content: '❌ Bu komut sadece bir sunucuda kullanılabilir.' });
  }

  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    return interaction.editReply({ content: `❌ **${targetUser.username}** bu sunucuda bulunamadı.` });
  }

  const botMember = await interaction.guild.members.fetchMe().catch(() => null);
  if (!member.kickable || (botMember && member.roles.highest.position >= botMember.roles.highest.position)) {
    return interaction.editReply({ content: '❌ Bu kullanıcıyı atmak için yetkim yetersiz (rolü benden üstte veya kendisiyle aynı seviyedeyim).' });
  }

  if (activeSessions.has(targetUser.id)) {
    return interaction.editReply({ content: '❌ Bu kullanıcıyla zaten aktif bir konuşma oturumu bulunuyor.' });
  }

  // Generate initial message using AI
  const prompt = `Yöneticinin ilettiği konu başlığı şu: '${topic}'. Lütfen kullanıcıya durumu açıklayan ilk mesajı yaz ve cevap vermesini iste. Sadece kullanıcının alacağı mesajı oluştur, ek açıklamalar veya etiketler yazma.`;
  
  try {
    const initialMessage = await chatWithAI([{ role: 'user', content: prompt }], 'Sen Sentara sunucusunun AI yardımcısısın. Türkçe konuş.');
    
    // Attempt to DM the user
    await targetUser.send(`🤖 **Sentara AI Yetkili Görüşmesi**\n\n${initialMessage}\n\n*Cevap vermenizi bekliyorum...*`);

    // Create session
    activeSessions.set(targetUser.id, {
      userId: targetUser.id,
      username: targetUser.username,
      guildId: interaction.guildId,
      adminId: interaction.user.id,
      topic: topic,
      warned: false,
      history: [
        { role: 'system', content: getSystemPrompt(topic, false) },
        { role: 'assistant', content: initialMessage }
      ]
    });

    return interaction.editReply({ content: `✅ **${targetUser.username}** ile AI destekli konuşma başlatıldı ve ilk mesaj iletildi.` });
  } catch (err) {
    console.error('[startKonusSession] Hata:', err.message);
    return interaction.editReply({ content: `❌ Kullanıcıya DM gönderilemedi. DM kutusu kapalı olabilir veya AI yanıt vermedi.` });
  }
}

/**
 * Handles DM replies from a user in an active konus session or a kicked user changing their mind.
 */
async function handleKonusReply(message, client) {
  const userId = message.author.id;

  // 1) Active Session check
  if (activeSessions.has(userId)) {
    const session = activeSessions.get(userId);
    session.history.push({ role: 'user', content: message.content });

    try {
      const dmCh = await message.author.createDM().catch(() => null);
      if (dmCh) await dmCh.sendTyping().catch(() => {});

      const prompt = getSystemPrompt(session.topic, session.warned);
      const reply = await chatWithAI(session.history, prompt);

      if (reply.includes('[KABUL]')) {
        const cleanReply = reply.replace(/\[KABUL\]/gi, '').trim();
        await message.author.send(`🤖 **Sentara AI:** ${cleanReply}`);
        activeSessions.delete(userId);
        
        // Notify admin
        try {
          const admin = await client.users.fetch(session.adminId);
          if (admin) await admin.send(`✅ **${session.username}** talebi kabul etti, konuşma başarıyla sonlandırıldı.`);
        } catch (_) {}
        return true;
      }

      if (reply.includes('[KICK]') || (session.warned && !reply.includes('[KABUL]'))) {
        const cleanReply = reply.replace(/\[KICK\]/gi, '').replace(/\[RED\]/gi, '').trim();
        await message.author.send(`🤖 **Sentara AI:** ${cleanReply}`);
        
        // Execute kick and save roles
        await kickAndSaveRoles(session, client);
        activeSessions.delete(userId);
        return true;
      }

      if (reply.includes('[RED]')) {
        if (!session.warned) {
          session.warned = true;
          // Clean history and reset prompt for warned state
          session.history = session.history.filter(h => h.role !== 'system');
          session.history.unshift({ role: 'system', content: getSystemPrompt(session.topic, true) });

          await message.author.send(`🤖 **Sentara AI:** eğer birdaha aynısını dersen konuşma kapatılacak ve gerçekten atılacaksın`);
          
          // Notify admin
          try {
            const admin = await client.users.fetch(session.adminId);
            if (admin) await admin.send(`⚠️ **${session.username}** talebi reddetti, kendisine uyarı iletildi.`);
          } catch (_) {}
        } else {
          // Already warned, kick
          await message.author.send(`🤖 **Sentara AI:** baybay!`);
          await kickAndSaveRoles(session, client);
          activeSessions.delete(userId);
        }
        return true;
      }

      // Normal response
      await message.author.send(`🤖 **Sentara AI:** ${reply}`);
      session.history.push({ role: 'assistant', content: reply });
    } catch (err) {
      console.error('[handleKonusReply] Hata:', err.message);
      await message.author.send('⚠️ AI yanıt verirken bir sorun oluştu. Lütfen tekrar deneyin.').catch(() => {});
    }
    return true;
  }

  // 2) Kicked user changing their mind check
  let dbUser = await User.findOne({ discordId: userId }).catch(() => null);
  if (dbUser && dbUser.konusState === 'kicked') {
    try {
      const dmCh = await message.author.createDM().catch(() => null);
      if (dmCh) await dmCh.sendTyping().catch(() => {});

      const decisionPrompt = `Kullanıcının gönderdiği mesaj: "${message.content}"
Bu kullanıcı daha önce sunucudan atıldı çünkü kurallara uymayı veya belirtilen sunucudan çıkmayı reddetmişti.
Şimdi kararını değiştirip o sunucudan çıktığını, kuralları kabul ettiğini veya geri dönmek istediğini mi belirtiyor?
Eğer kararını kesin olarak değiştirdiğini belirtiyorsa cevabına kesinlikle [KARAR_DEGISTI] etiketini ekle. Değiştirmediyse normal cevap ver.`;

      const reply = await chatWithAI([{ role: 'user', content: message.content }], decisionPrompt);

      if (reply.includes('[KARAR_DEGISTI]')) {
        // Generate invite link
        const guildId = dbUser.konusGuildId;
        const guild = client.guilds.cache.get(guildId);
        let inviteUrl = '';

        if (guild) {
          const { SERVER_INVITE_LINKS } = require('../../config');
          inviteUrl = SERVER_INVITE_LINKS[guild.id];
          if (!inviteUrl) {
            const channel = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has('CreateInstantInvite'));
            if (channel) {
              const invite = await channel.createInvite({ maxAge: 86400, maxUses: 1 }).catch(() => null);
              if (invite) inviteUrl = invite.url;
            }
          }
        }

        if (inviteUrl) {
          await message.author.send(`🤖 **Sentara AI:** Tekrar merhaba! Fikrini değiştirdiğine sevindim. Sunucuya geri dönmek için bu davet linkini kullanabilirsin:\n${inviteUrl}\n\nSunucuya katıldığında rollerin otomatik olarak geri yüklenecektir!`);
          dbUser.konusState = 'invite_sent';
          await dbUser.save();
        } else {
          await message.author.send(`🤖 **Sentara AI:** Tekrar merhaba! Fikrini değiştirdiğine sevindim ancak şu an sunucu davet linki oluşturamadım. Lütfen yetkililerle iletişime geçin.`);
        }
      } else {
        await message.author.send(`🤖 **Sentara AI:** ${reply.replace(/\[KARAR_DEGISTI\]/gi, '').trim()}`);
      }
    } catch (err) {
      console.error('[handleKonusReply decision check] Hata:', err.message);
    }
    return true;
  }

  return false;
}

/**
 * Kicks the member and saves their roles to the database.
 */
async function kickAndSaveRoles(session, client) {
  try {
    const guild = await client.guilds.fetch(session.guildId).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch(session.userId).catch(() => null);
    if (!member) return;

    // Get roles (filter out @everyone)
    const roleIds = member.roles.cache.map(r => r.id).filter(id => id !== guild.id);

    // Save to user database
    let dbUser = await User.findOne({ discordId: session.userId });
    if (!dbUser) {
      dbUser = await User.create({ discordId: session.userId });
    }
    dbUser.konusRoles = roleIds;
    dbUser.konusGuildId = session.guildId;
    dbUser.konusState = 'kicked';
    await dbUser.save();

    // Kick the member
    await member.kick('AI konus command: talebi reddetti');

    // Notify admin
    const admin = await client.users.fetch(session.adminId).catch(() => null);
    if (admin) {
      await admin.send(`🚫 **${session.username}** talebi reddettiği için sunucudan atıldı. Rolleri veritabanına kaydedildi.`);
    }
  } catch (err) {
    console.error('[kickAndSaveRoles] Hata:', err.message);
  }
}

/**
 * Restores roles when a member rejoins.
 */
async function restoreKonusRoles(member, client) {
  try {
    const dbUser = await User.findOne({ discordId: member.id });
    if (dbUser && dbUser.konusState === 'invite_sent') {
      const rolesToRestore = dbUser.konusRoles || [];
      const toAdd = [];

      for (const roleId of rolesToRestore) {
        const role = member.guild.roles.cache.get(roleId);
        if (role && role.editable && role.id !== member.guild.id) {
          toAdd.push(roleId);
        }
      }

      if (toAdd.length > 0) {
        await member.roles.add(toAdd, 'AI konus command: tekrar hoş geldin rol iadesi').catch(err => {
          console.error(`[restoreKonusRoles] Rol iade hatası (${member.guild.name}):`, err.message);
        });
      }

      await member.send(`Tekrar hoş geldin! Kararını değiştirdiğin için rollerin geri yüklendi. 🎉`).catch(() => {});
      
      // Clear data
      dbUser.konusState = 'restored';
      dbUser.konusRoles = [];
      await dbUser.save();
    }
  } catch (err) {
    console.error('[restoreKonusRoles] Hata:', err.message);
  }
}

module.exports = {
  startKonusSession,
  handleKonusReply,
  restoreKonusRoles,
};
