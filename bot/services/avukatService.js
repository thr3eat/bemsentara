'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { GoogleGenerativeAI } = require('@google/generative-ai');

const EKOYILDIZ_GUILD_ID = '1367646464804655104';
const AVUKAT_ROLE_ID     = '1523819093948633288';

// Active sessions keyed by userId → { stage, messages[], channelId }
const activeSessions = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildAI() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

const SYSTEM_PROMPT = `Sen EkoYıldız Discord sunucusunun avukat alım mülakatçısısın. 
Görevin adayları disiplin sistemi ve soruşturma süreçleri hakkında değerlendirmek.

MÜLAKAT KURALLARI:
1. Önce nazikçe hoş geldiniz de ve 5 mülakat sorusu soracağını belirt.
2. Her seferinde sadece 1 soru sor. Bir sonraki soruya geçmeden cevabı bekle.
3. Adayın cevabını 1-10 arası puanla (belirtme, sadece içten sakla).
4. 5 sorudan sonra değerlendirmeni yap:
   - Ortalama ≥ 6: "KABUL" kararı ver, rolün verileceğini söyle.
   - Ortalama < 6: "RET" kararı ver, neden reddedildiğini nazikçe açıkla.
5. Kararın sonunda tam olarak şunu yaz (başka bir şey değil):
   - Kabul için: [KARAR:KABUL]
   - Red için: [KARAR:RED]

MÜLAKAT KONULARI:
- Hukuk bilgisi ve sunucu kuralları
- Adil yargılama ilkeleri
- Çatışma çözme becerileri
- Gizlilik ve soruşturma etiği
- Soruşturma süreçlerine yaklaşım

Türkçe konuş, resmi ama samimi ol.`;

// ── Start sınavsız (direct) hire ──────────────────────────────────────────────

async function hireAvukatDirect(interaction, targetUserId) {
  await interaction.deferReply({ ephemeral: true });
  const auth = await getAuth(interaction);
  if (!auth) {
    return interaction.editReply({ content: '❌ Bu işlem için yönetici yetkisi gereklidir.' });
  }

  try {
    const guild = await interaction.client.guilds.fetch(EKOYILDIZ_GUILD_ID).catch(() => null);
    if (!guild) return interaction.editReply({ content: '❌ EkoYıldız sunucusuna erişilemedi.' });

    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.editReply({ content: '❌ Kullanıcı EkoYıldız sunucusunda bulunamadı.' });

    await member.roles.add(AVUKAT_ROLE_ID).catch(err => {
      throw new Error(`Rol verilemedi: ${err.message}`);
    });

    // DM to target
    const dmEmbed = new EmbedBuilder()
      .setTitle('⚖️ Avukat Rolü Verildi!')
      .setDescription('Tebrikler! EkoYıldız sunucusunda **Avukat** rolü sınavsız alım ile size verildi.\n\nSoruşturma kanallarına erişiminiz aktif edildi.')
      .setColor(0x2ecc71)
      .setTimestamp();
    await member.send({ embeds: [dmEmbed] }).catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle('✅ Sınavsız Avukat Alımı Başarılı')
      .setDescription(`<@${targetUserId}> kullanıcısına **Avukat** rolü başarıyla verildi.`)
      .setColor(0x2ecc71)
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[avukatService] hireAvukatDirect error:', err.message);
    return interaction.editReply({ content: `❌ Hata: ${err.message}` });
  }
}

// ── Start AI interview ────────────────────────────────────────────────────────

async function startAvukatInterview(interaction, targetUserId) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = await interaction.client.guilds.fetch(EKOYILDIZ_GUILD_ID).catch(() => null);
    if (!guild) return interaction.editReply({ content: '❌ EkoYıldız sunucusuna erişilemedi.' });

    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) return interaction.editReply({ content: '❌ Kullanıcı EkoYıldız sunucusunda bulunamadı.' });

    if (activeSessions.has(targetUserId)) {
      return interaction.editReply({ content: '⚠️ Bu kullanıcı için zaten aktif bir mülakat süreci var.' });
    }

    // Create session
    activeSessions.set(targetUserId, {
      stage: 0,
      messages: [],
      panelUserId: interaction.user.id
    });

    // Ask AI for opening message
    const model = buildAI();
    const chat = model.startChat({
      history: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }] }]
    });

    const result = await chat.sendMessage('Mülakate başla. Hoş geldin mesajı ver ve ilk soruyu sor.');
    const aiText = result.response.text();

    // Store chat in session
    const session = activeSessions.get(targetUserId);
    session.chatHistory = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'user', parts: [{ text: 'Mülakate başla. Hoş geldin mesajı ver ve ilk soruyu sor.' }] },
      { role: 'model', parts: [{ text: aiText }] }
    ];

    // Send opening DM to target
    const openEmbed = new EmbedBuilder()
      .setTitle('⚖️ Avukat Alım Mülakatı')
      .setDescription(aiText)
      .setColor(0x3498db)
      .setFooter({ text: 'Cevabınızı bu kanalda yazarak devam edebilirsiniz.' })
      .setTimestamp();

    // Create a temporary DM thread or just DM
    await member.send({ embeds: [openEmbed] }).catch(() => {});

    // Notify panel admin
    const adminEmbed = new EmbedBuilder()
      .setTitle('🎙️ Avukat Mülakatı Başlatıldı')
      .setDescription(`<@${targetUserId}> için AI mülakatı başlatıldı.\nKullanıcıya DM ile ilk soru gönderildi.`)
      .setColor(0x3498db)
      .setTimestamp();
    await interaction.editReply({ embeds: [adminEmbed] });

    // Set up DM listener
    setupDMListener(targetUserId, interaction.client);

  } catch (err) {
    activeSessions.delete(targetUserId);
    console.error('[avukatService] startAvukatInterview error:', err.message);
    return interaction.editReply({ content: `❌ Mülakat başlatılamadı: ${err.message}` });
  }
}

// ── DM listener for ongoing interview ────────────────────────────────────────

function setupDMListener(targetUserId, client) {
  // Filter: only DMs from this user
  const collector = {
    userId: targetUserId,
    client,
    active: true
  };

  // Tag listener on global message event
  client._avukatListeners = client._avukatListeners || new Map();
  client._avukatListeners.set(targetUserId, collector);
}

async function handleAvukatDMReply(message, client) {
  if (!message.guild && !message.author.bot) {
    const userId = message.author.id;
    const listeners = client._avukatListeners;
    if (!listeners || !listeners.has(userId)) return;

    const session = activeSessions.get(userId);
    if (!session) {
      listeners.delete(userId);
      return;
    }

    await processInterviewReply(userId, message.content, client, message.channel);
  }
}

async function processInterviewReply(userId, userText, client, dmChannel) {
  const session = activeSessions.get(userId);
  if (!session) return;

  try {
    const model = buildAI();
    const chat = model.startChat({ history: session.chatHistory });

    const result = await chat.sendMessage(userText);
    const aiText = result.response.text();

    // Update history
    session.chatHistory.push(
      { role: 'user', parts: [{ text: userText }] },
      { role: 'model', parts: [{ text: aiText }] }
    );

    // Check for decision
    const kabul = aiText.includes('[KARAR:KABUL]');
    const red = aiText.includes('[KARAR:RED]');
    const cleanText = aiText.replace(/\[KARAR:(KABUL|RED)\]/g, '').trim();

    const responseEmbed = new EmbedBuilder()
      .setTitle('⚖️ Avukat Alım Mülakatı')
      .setDescription(cleanText)
      .setColor(kabul ? 0x2ecc71 : red ? 0xe74c3c : 0x3498db)
      .setTimestamp();

    await dmChannel.send({ embeds: [responseEmbed] }).catch(() => {});

    if (kabul) {
      // Give role
      await giveAvukatRole(userId, client);
      activeSessions.delete(userId);
      client._avukatListeners?.delete(userId);
    } else if (red) {
      activeSessions.delete(userId);
      client._avukatListeners?.delete(userId);
    }
  } catch (err) {
    console.error('[avukatService] processInterviewReply error:', err.message);
    await dmChannel.send('❌ AI yanıt alınırken hata oluştu. Lütfen tekrar deneyin.').catch(() => {});
  }
}

async function giveAvukatRole(userId, client) {
  try {
    const guild = await client.guilds.fetch(EKOYILDIZ_GUILD_ID).catch(() => null);
    if (!guild) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    await member.roles.add(AVUKAT_ROLE_ID).catch(() => {});

    const winEmbed = new EmbedBuilder()
      .setTitle('🎉 Avukat Rolü Kazanıldı!')
      .setDescription('Mülakatı başarıyla geçtiniz! **Avukat** rolü hesabınıza eklendi.\n\nSoruşturma kanallarına artık erişebilirsiniz.')
      .setColor(0x2ecc71)
      .setTimestamp();

    const dmChannel = await client.users.fetch(userId).catch(() => null);
    if (dmChannel) await dmChannel.send({ embeds: [winEmbed] }).catch(() => {});
  } catch (err) {
    console.error('[avukatService] giveAvukatRole error:', err.message);
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuth(interaction) {
  return interaction.member?.permissions.has('Administrator') ||
         interaction.user.id === '1031620522406072350';
}

module.exports = {
  hireAvukatDirect,
  startAvukatInterview,
  handleAvukatDMReply,
  AVUKAT_ROLE_ID,
  EKOYILDIZ_GUILD_ID
};
