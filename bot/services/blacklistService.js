'use strict';

const { EmbedBuilder } = require('discord.js');
const Blacklist = require('../../models/Blacklist');

const BLACKLIST_CHANNEL_ID = '1518692472367222915';
const LOG_CHANNEL_ID = '1518920074264842380';

// Default list of initial blocked people and groups
const DEFAULT_PEOPLE = [
  { name: 'LorerYT', reason: 'salaklık ve alttaki 2 kişi onun ekibinden' },
  { name: 'alionur738', reason: '' },
  { name: 'belamorgan', reason: '' },
  { name: 'İsrafil', reason: '' },
  { name: 'SpaceLeafs & Saynp1', reason: 'Fiziksel özellikler/Obezite' },
  { name: 'Waffuru', reason: 'Sebepsiz yere önemli kullanıcıları yasaklamak' },
  { name: 'wegoles', reason: 'Muhakeme yeteneğinden yoksun davranmak' },
  { name: 'ArdaDayı (LORER)', reason: 'Gizlilik kurallarını ihlal etmek ve MİT görevini suistimal etmek' },
  { name: 'LuaFriztche', reason: 'Ayrımcılık yapmak, kişiye göre torpil geçmek ve haksız AS.İZ/Blacklist kararları' },
  { name: 'Xyleun', reason: 'Zararlı alışkanlıklar üzerinden prim yapmaya çalışmak' },
  { name: 'Deuxcharen', reason: 'Aşırı özgüvenli ve yapay bir tavır sergilemek' },
  { name: 'Sanker', reason: 'Dikkat dağınıklığı ve koordinasyon eksikliği' },
  { name: 'cici_esra', reason: 'Arkadaş çevresine zarar vermek, haksız yasaklamalara sebep olmak ve uygunsuz ilişkiler kurmak' },
  { name: 'cyberrulzty', reason: 'Yetkiyi/Gücü kötüye kullanmak ve egoist tavırlar sergilemek' },
  { name: 'emrcn56', reason: 'Yönetim kadrosuna geçtikten sonra kibirlenmek' },
  { name: 'elesger500', reason: 'Ağır hakaret içerikli kişisel ithamlar' },
  { name: 'sydearr', reason: 'Yazılım/script hırsızlığı yapmak, etiket sebebiyle haksız yasaklamalar uygulamak ve kendi çıkarları doğrultusunda hareket etmek' },
  { name: 'kusba', reason: 'Hesap çalmaya çalışmak link ile enayi olmak' },
  { name: 'Bexay', reason: 'Sanker Paşasından aldığı konuşma metinlerini videoda anlatmak' },
  { name: 'ardo', reason: 'Femboy olmak.' },
  { name: 'Sword', reason: 'insanları satmak, Panel kullanmak' }
];

const DEFAULT_GROUPS = [
  { name: 'LorerYT YouTube Sunucusu\'nda bulunan herkes.', reason: '' },
  { name: 'TA ve TPT ile alakalı olan gruplar.', reason: '' },
  { name: 'Yıldırım Orduları', reason: 'Ciddiyetten uzak tavırlar sergilemek, özel hayata müdahale' },
  { name: 'MİT (Birim)', reason: 'Ciddiyetsizlik ve görev bilincine sahip olmamak' },
  { name: 'TA Kızları', reason: 'Üst yönetimle etik dışı ve çıkar amaçlı yakınlık kurmak' },
  { name: 'Ermeniler (Oyun İçi Fraksiyon/Grup)', reason: 'Siyasi ve diplomatik tutumlardan dolayı dış mihraklara bağlılıkla hareket etmek' },
  { name: 'TNF', reason: 'Kullanıcıları sunucudan çıkmaya zorlamak' }
];

/**
 * Seeds the blacklist database with default values if it is empty, and renders the initial message
 */
async function initializeBlacklist(client) {
  try {
    const count = await Blacklist.countDocuments();
    if (count === 0) {
      console.log('[blacklist] Seeding default blacklist data...');
      const insertData = [];
      for (const p of DEFAULT_PEOPLE) {
        insertData.push({ name: p.name, type: 'person', reason: p.reason, isDefault: true });
      }
      for (const g of DEFAULT_GROUPS) {
        insertData.push({ name: g.name, type: 'group', reason: g.reason, isDefault: true });
      }
      await Blacklist.insertMany(insertData);
      console.log('[blacklist] Seeding complete.');
    }

    await renderBlacklist(client);
  } catch (err) {
    console.error('[blacklist] Initialization error:', err.message);
  }
}

/**
 * Generates the blacklist representation and posts/updates it in the designated channel
 */
async function renderBlacklist(client) {
  try {
    const channel = await client.channels.fetch(BLACKLIST_CHANNEL_ID).catch(() => null);
    if (!channel) {
      console.warn(`[blacklist] Channel ${BLACKLIST_CHANNEL_ID} not found.`);
      return;
    }

    const people = await Blacklist.find({ type: 'person' }).sort({ createdAt: 1 });
    const groups = await Blacklist.find({ type: 'group' }).sort({ createdAt: 1 });

    const formatList = (list) => {
      if (list.length === 0) return '*(Temiz)*';
      return list.map(item => {
        const isRemoved = item.status === 'removed';
        const formattedName = isRemoved ? `~~**${item.name}**~~` : `**${item.name}**`;
        const reasonText = item.reason ? ` (${item.reason})` : '';
        const statusText = isRemoved ? ' - *[Kaldırıldı (15 gün sonra silinecek)]*' : '';
        return `* ${formattedName}${reasonText}${statusText}`;
      }).join('\n');
    };

    const mainContent = `# 🚫 KARALİSTE (BLACKLIST)\n\n` +
      `Aşağıda belirtilen kullanıcılar ve dahil oldukları grup, sergiledikleri tutumlar ve topluluk kurallarını ihlal etmeleri nedeniyle bağlı tüm projelerimizden süresiz olarak uzaklaştırılmış; "Karaliste"ye alınmıştır.\n\n` +
      `### 👤 Engellenen Kişiler\n\n` +
      `${formatList(people)}\n\n` +
      `### 🛡️ İlgili Gruplar / Platformlar\n\n` +
      `${formatList(groups)}`;

    // Helper to split text into chunks of <= 1900 chars, preserving lines
    const splitTextIntoChunks = (text, maxLength = 1900) => {
      const lines = text.split('\n');
      const chunks = [];
      let currentChunk = '';

      for (const line of lines) {
        if (line.length > maxLength) {
          let tempLine = line;
          while (tempLine.length > 0) {
            const part = tempLine.substring(0, maxLength);
            tempLine = tempLine.substring(maxLength);
            if (currentChunk.length + part.length + 1 > maxLength) {
              chunks.push(currentChunk.trim());
              currentChunk = part;
            } else {
              currentChunk = currentChunk ? currentChunk + '\n' + part : part;
            }
          }
        } else if (currentChunk.length + line.length + 1 > maxLength) {
          chunks.push(currentChunk.trim());
          currentChunk = line;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n' + line : line;
        }
      }
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      return chunks;
    };

    const chunks = splitTextIntoChunks(mainContent);

    // Create custom Turkish date string
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const dateStr = formatter.format(now);

    const updateEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('ℹ️ Karaliste Bilgi ve Güncelleme')
      .setDescription(`**Son Güncelleme:** ${dateStr}`)
      .setFooter({ text: 'Eko Yıldız • Karaliste Sistemi' })
      .setTimestamp();

    // Fetch message history to find previous posts
    const messagesCollection = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messagesCollection) {
      console.warn('[blacklist] Failed to fetch message history.');
      return;
    }

    const botMessages = Array.from(messagesCollection.values())
      .filter(m => m.author.id === client.user.id)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp); // Oldest first

    // Find and extract update embed message
    const updateMsgIndex = botMessages.findIndex(m => m.embeds.length > 0 && m.embeds[0].title === 'ℹ️ Karaliste Bilgi ve Güncelleme');
    let updateMsg = null;
    if (updateMsgIndex !== -1) {
      updateMsg = botMessages[updateMsgIndex];
      botMessages.splice(updateMsgIndex, 1); // Remove from list messages
    }

    const contentMessages = botMessages;
    let sentNewContentMsg = false;

    // Update content messages chunk by chunk
    for (let i = 0; i < chunks.length; i++) {
      if (i < contentMessages.length) {
        await contentMessages[i].edit({ content: chunks[i] }).catch(err => {
          console.error(`[blacklist] Failed to edit content message ${i}:`, err.message);
        });
      } else {
        await channel.send({ content: chunks[i] }).catch(err => {
          console.error(`[blacklist] Failed to send new content message:`, err.message);
        });
        sentNewContentMsg = true;
      }
    }

    // Delete surplus content messages
    if (contentMessages.length > chunks.length) {
      for (let i = chunks.length; i < contentMessages.length; i++) {
        await contentMessages[i].delete().catch(err => {
          console.warn(`[blacklist] Failed to delete surplus message:`, err.message);
        });
      }
    }

    // Update or re-send update embed
    if (updateMsg) {
      if (sentNewContentMsg) {
        await updateMsg.delete().catch(() => {});
        await channel.send({ embeds: [updateEmbed] }).catch(() => {});
      } else {
        await updateMsg.edit({ embeds: [updateEmbed] }).catch(() => {});
      }
    } else {
      await channel.send({ embeds: [updateEmbed] }).catch(() => {});
    }
  } catch (err) {
    console.error('[blacklist] Render error:', err.stack || err.message);
  }
}

/**
 * Parses and processes a message written in the blacklist channel.
 * Cleans the message, parses the formatting, executes DB operation, and updates lists.
 */
async function handleBlacklistMessage(message, client) {
  if (message.author.bot) return;

  const content = message.content.trim();
  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

  // Helper to delete original message
  const deleteMessage = () => {
    message.delete().catch(err => console.warn(`[blacklist] Failed to delete user message:`, err.message));
  };

  // Helper to send temporary warning
  const sendWarning = async (warningText) => {
    deleteMessage();
    const warnMsg = await message.channel.send({ content: warningText }).catch(() => null);
    if (warnMsg) {
      setTimeout(() => {
        warnMsg.delete().catch(() => {});
      }, 5000);
    }
  };

  // Regular expression patterns
  const additionPattern = /^\(?([^)]+?)\)?\s*\(([^)]+?)\)$/;
  const groupAdditionPattern = /^\(?([^)]+?)\)?\s*grubu\s*\(([^)]+?)\)$/i;
  const removalPattern = /^\(?([^)]+?)\)?\s*\(sorunçözüldü\)\s*Kaldırıldı$/i;
  const completeRemovalPattern = /^\(?([^)]+?)\)?\s*Tamamen\s*kaldırıldı$/i;
  const reopenPattern = /^\(?([^)]+?)\)?\s*\(sorun\s*çözülmemiş\)\s*Yeniden\s*Açıldı$/i;

  // 1. Check Complete Removal Pattern (Instant delete without strikethrough, do not tag)
  if (completeRemovalPattern.test(content)) {
    const match = content.match(completeRemovalPattern);
    const name = match[1].trim();

    try {
      const entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (!entry) {
        return sendWarning(`❌ **${name}** karalistede bulunamadı!`);
      }

      await Blacklist.deleteOne({ _id: entry._id });

      deleteMessage();
      await renderBlacklist(client);

      if (logChannel) {
        const cleanName = entry.name.replace(/[<@!>]/g, "");
        await logChannel.send({
          content: `🗑️ **[KARALİSTE TAMAMEN SİLİNDİ]** <@${message.author.id}> tarafından **${cleanName}** listeden tamamen silindi.`,
          allowedMentions: { users: [] }
        }).catch(() => {});
      }
    } catch (dbErr) {
      console.error('[blacklist] DB complete removal error:', dbErr.message);
      return sendWarning(`❌ Bir veritabanı hatası oluştu: ${dbErr.message}`);
    }
    return;
  }

  // 2. Check Removal Pattern (Standard 15-day strikeout)
  if (removalPattern.test(content)) {
    const match = content.match(removalPattern);
    const name = match[1].trim();

    try {
      const entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (!entry) {
        return sendWarning(`❌ **${name}** karalistede bulunamadı!`);
      }

      entry.status = 'removed';
      entry.removedAt = new Date();
      await entry.save();

      deleteMessage();
      await renderBlacklist(client);

      if (logChannel) {
        const cleanName = entry.name.replace(/[<@!>]/g, "");
        await logChannel.send({
          content: `📤 **[KARALİSTE KALDIRMA]** <@${message.author.id}> tarafından **${cleanName}** kaldırıldı. (15 gün sonra listeden tamamen silinecektir.)`,
          allowedMentions: { users: [] }
        }).catch(() => {});
      }
    } catch (dbErr) {
      console.error('[blacklist] DB removal error:', dbErr.message);
      return sendWarning(`❌ Bir veritabanı hatası oluştu: ${dbErr.message}`);
    }
    return;
  }

  // 3. Check Reopen Pattern
  if (reopenPattern.test(content)) {
    const match = content.match(reopenPattern);
    const name = match[1].trim();

    try {
      const entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (!entry) {
        return sendWarning(`❌ **${name}** karalistede bulunamadı!`);
      }

      entry.status = 'active';
      entry.removedAt = null;
      await entry.save();

      deleteMessage();
      await renderBlacklist(client);

      if (logChannel) {
        const cleanName = entry.name.replace(/[<@!>]/g, "");
        await logChannel.send({
          content: `🔄 **[KARALİSTE YENİDEN ETKİN]** <@${message.author.id}> tarafından **${cleanName}** yasağı/karaliste kaydı yeniden açıldı.`,
          allowedMentions: { users: [] }
        }).catch(() => {});
      }
    } catch (dbErr) {
      console.error('[blacklist] DB reopen error:', dbErr.message);
      return sendWarning(`❌ Bir veritabanı hatası oluştu: ${dbErr.message}`);
    }
    return;
  }

  // 4. Check Group Addition Pattern
  if (groupAdditionPattern.test(content)) {
    const match = content.match(groupAdditionPattern);
    const name = match[1].trim() + ' grubu';
    const reason = match[2].trim();

    try {
      let entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      let isNew = false;

      if (entry) {
        entry.reason = reason;
        entry.status = 'active';
        entry.removedAt = null;
        await entry.save();
      } else {
        entry = new Blacklist({
          name,
          type: 'group',
          reason,
          status: 'active'
        });
        await entry.save();
        isNew = true;
      }

      deleteMessage();
      await renderBlacklist(client);

      if (logChannel) {
        const cleanName = entry.name.replace(/[<@!>]/g, "");
        await logChannel.send({
          content: `📥 **[KARALİSTE EKLEME (GRUP)]** <@${message.author.id}> tarafından **${cleanName}** listeye eklendi.\n📋 **Sebep:** ${reason}\n📂 **Tür:** 🛡️ Grup (${isNew ? 'Yeni Kayıt' : 'Güncellenen Kayıt'})`,
          allowedMentions: { users: [] }
        }).catch(() => {});
      }
    } catch (dbErr) {
      console.error('[blacklist] DB group addition error:', dbErr.message);
      return sendWarning(`❌ Bir veritabanı hatası oluştu: ${dbErr.message}`);
    }
    return;
  }

  // 5. Check Addition Pattern (Standard Person/Auto-detect Group)
  if (additionPattern.test(content)) {
    const match = content.match(additionPattern);
    const name = match[1].trim();
    const reason = match[2].trim();

    // Check if the reason implies a state change like "sorunçözüldü" or "sorun çözülmemiş"
    if (reason.toLowerCase() === 'sorunçözüldü' || reason.toLowerCase().includes('sorun çözülmemiş')) {
      return sendWarning('❌ Hatalı biçim kullandınız! Kaldırmak için `isim (sorunçözüldü) Kaldırıldı` yazmalısınız.');
    }

    try {
      // Determine type (person vs group)
      const groupKeywords = ['grubu', 'platformu', 'sunucusu', 'orduları', 'birim', 'kızları', 'fraksiyon', 'tmt', 'ta', 'tnf', 'yıldırım', 'ermeniler', 'youtube'];
      const isGroup = groupKeywords.some(k => name.toLowerCase().includes(k)) || name.endsWith('.');
      const type = isGroup ? 'group' : 'person';

      let entry = await Blacklist.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      let isNew = false;

      if (entry) {
        entry.reason = reason;
        entry.status = 'active';
        entry.removedAt = null;
        await entry.save();
      } else {
        entry = new Blacklist({
          name,
          type,
          reason,
          status: 'active'
        });
        await entry.save();
        isNew = true;
      }

      deleteMessage();
      await renderBlacklist(client);

      if (logChannel) {
        const cleanName = entry.name.replace(/[<@!>]/g, "");
        await logChannel.send({
          content: `📥 **[KARALİSTE EKLEME]** <@${message.author.id}> tarafından **${cleanName}** listeye eklendi.\n📋 **Sebep:** ${reason}\n📂 **Tür:** ${type === 'group' ? '🛡️ Grup' : '👤 Kişi'} (${isNew ? 'Yeni Kayıt' : 'Güncellenen Kayıt'})`,
          allowedMentions: { users: [] }
        }).catch(() => {});
      }
    } catch (dbErr) {
      console.error('[blacklist] DB addition error:', dbErr.message);
      return sendWarning(`❌ Bir veritabanı hatası oluştu: ${dbErr.message}`);
    }
    return;
  }

  // 6. Invalid Format
  const warningText = `❌ **Hatalı biçim kullandınız!**\n\n` +
    `**Kullanılabilir Formatlar:**\n` +
    `1️⃣ **Kişi Ekleme:** \`(isim) (sebep)\` (Örn: \`LorerYT (salaklık)\`)\n` +
    `2️⃣ **Grup Ekleme:** \`(isim) grubu (sebep)\` (Örn: \`LorerYT grubu (salaklık)\`)\n` +
    `3️⃣ **Normal Kaldırma:** \`isim (sorunçözüldü) Kaldırıldı\` (Örn: \`TA Kızları (sorunçözüldü) Kaldırıldı\`)\n` +
    `4️⃣ **Tamamen Silme:** \`isim Tamamen kaldırıldı\` (Örn: \`LorerYT Tamamen kaldırıldı\`)\n` +
    `5️⃣ **Yeniden Açma:** \`isim (sorun çözülmemiş) Yeniden Açıldı\` (Örn: \`TA Kızları (sorun çözülmemiş) Yeniden Açıldı\`)`;

  await sendWarning(warningText);
}

/**
 * Periodic cleanup task: Deletes 'removed' blacklist entries after 15 days
 */
async function checkBlacklistCleanup(client) {
  try {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const expiredEntries = await Blacklist.find({
      status: 'removed',
      removedAt: { $lte: fifteenDaysAgo }
    });

    if (expiredEntries.length > 0) {
      console.log(`[blacklist] Found ${expiredEntries.length} expired removed blacklist entries. Deleting...`);
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

      for (const entry of expiredEntries) {
        await Blacklist.deleteOne({ _id: entry._id });
        if (logChannel) {
          await logChannel.send({
            content: `🗑️ **[OTOMATİK TEMİZLEME]** **${entry.name}** 15 günlük kaldırılma süresinin dolması sebebiyle karalisteden tamamen silindi.`
          }).catch(() => {});
        }
      }

      await renderBlacklist(client);
    }
  } catch (err) {
    console.error('[blacklist] Cleanup task error:', err.message);
  }
}

module.exports = {
  initializeBlacklist,
  renderBlacklist,
  handleBlacklistMessage,
  checkBlacklistCleanup,
  BLACKLIST_CHANNEL_ID,
};
