'use strict';

const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionFlagsBits 
} = require("discord.js");
const { chatWithAI } = require("./aiService");

// Short-lived memory for pending AI actions
// Key: uniqueId (string), Value: { actions, authorId, guildId, channelId, explanation, messageId }
const pendingActions = new Map();

// Interactive session tracker
// Key: userId (string), Value: { channelId, timestamp }
const activeSessions = new Map();

// Clean up pending actions after 10 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingActions.entries()) {
    if (now - value.timestamp > 10 * 60 * 1000) {
      pendingActions.delete(key);
    }
  }
  for (const [key, value] of activeSessions.entries()) {
    if (now - value.timestamp > 2 * 60 * 1000) {
      activeSessions.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Returns a list of active sessions
 */
function getActiveSessions() {
  return activeSessions;
}

/**
 * Formats the current guild channels and roles as clean text context for the AI
 * @param {Guild} guild 
 */
function generateGuildContext(guild) {
  // Roles context (sorted by position desc)
  const roles = [...guild.roles.cache.values()]
    .sort((a, b) => b.position - a.position)
    .filter(r => r.name !== '@everyone')
    .map(r => `Role: "${r.name}" | ID: "${r.id}" | Position: ${r.position} | Color: "${r.hexColor}"`);

  // Channel type map
  const typeMap = {
    [ChannelType.GuildText]: 'TEXT',
    [ChannelType.GuildVoice]: 'VOICE',
    [ChannelType.GuildCategory]: 'CATEGORY',
    [ChannelType.GuildAnnouncement]: 'ANNOUNCEMENT',
    [ChannelType.GuildStageVoice]: 'STAGE',
  };

  // Channels context
  const channels = [...guild.channels.cache.values()]
    .map(c => `Channel/Category: "${c.name}" | ID: "${c.id}" | Type: "${typeMap[c.type] || 'OTHER'}" | ParentCategoryID: "${c.parentId || 'None'}"`);

  return {
    rolesText: roles.join('\n'),
    channelsText: channels.join('\n')
  };
}

/**
 * Processes a natural language instruction using AI
 * @param {Message} message 
 * @param {string} instruction 
 */
async function processAIInstruction(message, instruction) {
  const guild = message.guild;
  if (!guild) return;

  // React to the message to show activity
  await message.react('🔄').catch(() => {});
  const statusMsg = await message.reply('🔍 AI talimatınızı analiz ediyor, lütfen bekleyin...').catch(() => null);

  try {
    const { rolesText, channelsText } = generateGuildContext(guild);

    const systemPrompt = `Sen bir Discord Sunucu Yönetim Yapay Zekasısın. Görevin, kullanıcının Türkçe olarak verdiği sunucu yönetim talimatlarını analiz etmek ve bunları gerçekleştirilecek teknik komut dizilerine (JSON formatında) dönüştürmektir.

Mevcut Sunucu Durumu:
=== KANALLAR VE KATEGORİLER ===
${channelsText}

=== ROLLER (Yukarıdan Aşağıya Sıralı) ===
${rolesText}

Kurallar ve Sınırlamalar:
1. YALNIZCA geçerli ve temiz bir JSON nesnesi döndür. Cevabında JSON dışında hiçbir metin, açıklama, markdown bloğu (\`\`\`json vb.) olmamalıdır.
2. Renk belirtildiğinde (örneğin "siyah"), Discord'un varsayılan şeffaf siyah rengi (#000000) görünmez olduğundan, bunun yerine koyu siyah için #010101 veya #1a1a1a kullan. Diğer renkleri de hex formatında belirt (örneğin kırmızı için #ff0000).
3. "Kanal izinlerini yap" veya "kategorinin izinlerini yap" denildiğinde, eğer kanal bir kategori içerisine oluşturuluyorsa 'sync_permissions_with_category' eylemini ekle.
4. Eylemler mantıksal bir sıra takip etmelidir (örneğin önce kategori oluşturulmalı, sonra o kategori içinde kanal oluşturulmalıdır).
5. Tüm ID veya isim eşleşmelerinde mevcut sunucu durumundaki isim veya ID'leri tam olarak kullanmaya çalış.

Desteklenen Eylem Tipleri (actions):
- create_channel:
  - name: string (Kanal adı)
  - channelType: "TEXT" | "VOICE" | "CATEGORY"
  - parentCategoryIdOrName: string (Varsa üst kategorinin ID veya tam adı)
- delete_channel:
  - channelIdOrName: string (Kanalın ID veya tam adı)
- modify_channel:
  - channelIdOrName: string (Kanalın ID veya tam adı)
  - name: string (Yeni kanal adı, isteğe bağlı)
  - topic: string (Kanal konusu/açıklaması, isteğe bağlı)
  - nsfw: boolean (İsteğe bağlı)
  - slowmode: number (Kullanıcı yavaş modu saniye olarak, örn: 10, isteğe bağlı)
- set_channel_permissions:
  - channelIdOrName: string (Kanalın ID veya tam adı)
  - roleIdOrNameOrUser: string (Hedef rol adı/ID'si veya kullanıcı adı/ID'si)
  - allow: string[] (İzin verilecek yetki adları, örn: ["ViewChannel", "SendMessages"], isteğe bağlı)
  - deny: string[] (Engellenecek yetki adları, örn: ["SendTTSMessages", "MentionEveryone"], isteğe bağlı)
- sync_permissions_with_category:
  - channelIdOrName: string (Kanalın ID veya adı)
  - categoryIdOrName: string (Kategorinin ID veya adı)
- create_role:
  - name: string (Rol adı)
  - color: string (Hex renk kodu, örn: "#010101")
  - permissionsCopyFromRoleIdOrName: string (İzinlerin kopyalanacağı rolün adı veya ID'si)
  - placeBelowRoleIdOrName: string (Bu rolün altına yerleştirileceği rolün adı veya ID'si)
- delete_role:
  - roleIdOrName: string (Rolün ID veya adı)
- modify_role:
  - roleIdOrName: string (Rolün ID veya adı)
  - name: string (Yeni adı, isteğe bağlı)
  - color: string (Yeni hex rengi, isteğe bağlı)
- assign_role:
  - userIdOrTag: string (Kullanıcı ID veya kullanıcı adı/etiketi)
  - roleIdOrName: string (Rol ID veya adı)
- remove_role:
  - userIdOrTag: string (Kullanıcı ID veya kullanıcı adı/etiketi)
  - roleIdOrName: string (Rol ID veya adı)
- kick_member:
  - userIdOrTag: string (Kullanıcı ID veya kullanıcı adı/etiketi)
  - reason: string (Atılma sebebi, isteğe bağlı)
- ban_member:
  - userIdOrTag: string (Kullanıcı ID veya kullanıcı adı/etiketi)
  - reason: string (Yasaklanma sebebi, isteğe bağlı)
- unban_member:
  - userIdOrTag: string (Kullanıcı ID veya kullanıcı adı/etiketi)
  - reason: string (Yasak kaldırma sebebi, isteğe bağlı)
- timeout_member:
  - userIdOrTag: string (Kullanıcı ID veya kullanıcı adı/etiketi)
  - duration: number (Susturma süresi dakika olarak, örn: 15)
  - reason: string (Susturma sebebi, isteğe bağlı)
- send_message:
  - channelIdOrName: string (Mesaj gönderilecek kanal)
  - content: string (Mesaj içeriği, isteğe bağlı)
  - embedTitle: string (Embed başlığı, isteğe bağlı)
  - embedDescription: string (Embed içeriği, isteğe bağlı)
  - embedColor: string (Embed rengi hex olarak, isteğe bağlı)
- clear_messages:
  - channelIdOrName: string (Mesajların silineceği kanal)
  - amount: number (Silinecek mesaj miktarı 1-100 arası)

Yanıt Formatı (JSON):
{
  "explanation": "Yapılacak işlemlerin Türkçe kısa açıklaması",
  "actions": [
    {
      "type": "create_channel",
      "name": "moderatör-sohbet",
      "channelType": "TEXT",
      "parentCategoryIdOrName": "Moderatör Anasayfa"
    },
    ...
  ]
}`;

    const aiResponse = await chatWithAI(
      `Talimat: "${instruction}"`, 
      systemPrompt, 
      'ticket', 
      { max_tokens: 1500, temperature: 0.1 }
    );

    // Clean AI Response of code blocks
    let cleanJson = aiResponse.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error("[AI Management] JSON Parse hatası. Ham yanıt:", aiResponse);
      if (statusMsg) {
        await statusMsg.edit('❌ Yapay zeka geçerli bir komut formatı oluşturamadı. Lütfen talimatınızı daha net ifade etmeyi deneyin.').catch(() => {});
      }
      return;
    }

    if (!parsed.actions || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
      if (statusMsg) {
        await statusMsg.edit(`🤖 AI açıklaması: ${parsed.explanation || 'Yapılacak bir işlem bulunamadı.'}`).catch(() => {});
      }
      return;
    }

    // Generate unique ID for this pending request
    const uniqueId = Math.random().toString(36).substring(2, 11);
    pendingActions.set(uniqueId, {
      actions: parsed.actions,
      authorId: message.author.id,
      guildId: guild.id,
      channelId: message.channel.id,
      explanation: parsed.explanation,
      timestamp: Date.now()
    });

    const embed = new EmbedBuilder()
      .setTitle('🤖 AI Sunucu Yönetim İşlemi Onayı')
      .setColor(0x3498db)
      .setDescription(
        `Aşağıdaki işlemleri gerçekleştirmek için onayınız gerekiyor:\n\n` +
        `📝 **Özet:** ${parsed.explanation}\n\n` +
        `⚙️ **Planlanan Eylemler:**\n` +
        parsed.actions.map((act, idx) => {
          let desc = `${idx + 1}. `;
          if (act.type === 'create_channel') {
            desc += `📁 **Kanal Oluştur:** \`${act.name}\` (${act.channelType})${act.parentCategoryIdOrName ? ` -> Kategori: \`${act.parentCategoryIdOrName}\`` : ''}`;
          } else if (act.type === 'delete_channel') {
            desc += `🗑️ **Kanal Sil:** \`${act.channelIdOrName}\``;
          } else if (act.type === 'modify_channel') {
            desc += `✏️ **Kanal Düzenle:** \`${act.channelIdOrName}\`${act.name ? ` -> Yeni Ad: \`${act.name}\`` : ''}${act.topic !== undefined ? ` -> Konu: \`${act.topic}\`` : ''}${act.slowmode !== undefined ? ` -> Yavaş Mod: \`${act.slowmode}s\`` : ''}`;
          } else if (act.type === 'set_channel_permissions') {
            desc += `🔒 **Kanal İzni Belirle:** \`${act.channelIdOrName}\` kanalında \`${act.roleIdOrNameOrUser}\` için: ${act.allow?.length ? `İzin verilen: \`${act.allow.join(', ')}\`` : ''} ${act.deny?.length ? `Engellenen: \`${act.deny.join(', ')}\`` : ''}`;
          } else if (act.type === 'sync_permissions_with_category') {
            desc += `🔒 **İzinleri Eşitle:** \`${act.channelIdOrName}\` kanalı \`${act.categoryIdOrName}\` kategorisine göre ayarlanacak.`;
          } else if (act.type === 'create_role') {
            desc += `👑 **Rol Oluştur:** \`${act.name}\`${act.color ? ` (Renk: \`${act.color}\`)` : ''}${act.placeBelowRoleIdOrName ? ` (Konum: \`${act.placeBelowRoleIdOrName}\` altına)` : ''}`;
          } else if (act.type === 'delete_role') {
            desc += `🗑️ **Rol Sil:** \`${act.roleIdOrName}\``;
          } else if (act.type === 'modify_role') {
            desc += `✏️ **Rol Düzenle:** \`${act.roleIdOrName}\`${act.name ? ` -> Yeni Ad: \`${act.name}\`` : ''}${act.color ? ` -> Yeni Renk: \`${act.color}\`` : ''}`;
          } else if (act.type === 'assign_role') {
            desc += `➕ **Rol Ver:** \`${act.roleIdOrName}\` -> \`${act.userIdOrTag}\``;
          } else if (act.type === 'remove_role') {
            desc += `➖ **Rol Geri Al:** \`${act.roleIdOrName}\` -> \`${act.userIdOrTag}\``;
          } else if (act.type === 'kick_member') {
            desc += `👢 **Kullanıcı At (Kick):** \`${act.userIdOrTag}\`${act.reason ? ` (Sebep: ${act.reason})` : ''}`;
          } else if (act.type === 'ban_member') {
            desc += `🔨 **Kullanıcı Yasakla (Ban):** \`${act.userIdOrTag}\`${act.reason ? ` (Sebep: ${act.reason})` : ''}`;
          } else if (act.type === 'unban_member') {
            desc += `🔓 **Yasak Kaldır (Unban):** \`${act.userIdOrTag}\``;
          } else if (act.type === 'timeout_member') {
            desc += `🔇 **Sustur (Timeout):** \`${act.userIdOrTag}\` -> \`${act.duration} dakika\`${act.reason ? ` (Sebep: ${act.reason})` : ''}`;
          } else if (act.type === 'send_message') {
            desc += `✉️ **Mesaj Gönder:** <#${act.channelIdOrName}> ${act.content ? `\`${act.content.slice(0, 30)}...\`` : 'Embed Mesajı'}`;
          } else if (act.type === 'clear_messages') {
            desc += `🧹 **Mesaj Temizle:** \`${act.channelIdOrName}\` kanalından \`${act.amount}\` mesaj`;
          } else {
            desc += `Bilinmeyen Eylem: \`${act.type}\``;
          }
          return desc;
        }).join('\n')
      )
      .setFooter({ text: 'Onaylamak veya iptal etmek için aşağıdaki butonları kullanın. Süre: 10 dakika.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ai_mgmt_approve_${uniqueId}`)
        .setLabel('Onayla ve Uygula')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ai_mgmt_reject_${uniqueId}`)
        .setLabel('İptal Et')
        .setStyle(ButtonStyle.Danger)
    );

    if (statusMsg) {
      await statusMsg.delete().catch(() => {});
    }

    const replyEmbed = await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
    if (replyEmbed) {
      const data = pendingActions.get(uniqueId);
      if (data) {
        data.messageId = replyEmbed.id;
        pendingActions.set(uniqueId, data);
      }
    }
  } catch (err) {
    console.error("[AI Management] Hata:", err);
    if (statusMsg) {
      await statusMsg.edit(`❌ İşlem analiz edilirken bir hata oluştu: ${err.message}`).catch(() => {});
    }
  } finally {
    // Remove react
    await message.reactions.cache.get('🔄')?.users.remove(message.client.user.id).catch(() => {});
  }
}

/**
 * Handles interactions from AI management confirmation buttons
 * @param {Interaction} interaction 
 */
async function handleManagementButton(interaction) {
  if (!interaction.isButton()) return false;
  const customId = interaction.customId;

  if (!customId.startsWith('ai_mgmt_approve_') && !customId.startsWith('ai_mgmt_reject_')) {
    return false;
  }

  await interaction.deferUpdate().catch(() => {});

  const isApprove = customId.startsWith('ai_mgmt_approve_');
  const uniqueId = customId.replace('ai_mgmt_approve_', '').replace('ai_mgmt_reject_', '');

  const data = pendingActions.get(uniqueId);
  if (!data) {
    await interaction.followUp({ content: '❌ Bu işlemin süresi dolmuş veya bulunamadı.', ephemeral: true }).catch(() => {});
    return true;
  }

  if (interaction.user.id !== data.authorId) {
    await interaction.followUp({ content: '❌ Bu işlemi yalnızca komutu başlatan kişi onaylayabilir.', ephemeral: true }).catch(() => {});
    return true;
  }

  if (interaction.guildId !== data.guildId) {
    return true;
  }

  // If rejected, just delete and update
  if (!isApprove) {
    pendingActions.delete(uniqueId);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xe74c3c)
      .setTitle('❌ AI Yönetim İşlemi İptal Edildi')
      .setFooter({ text: `${interaction.user.tag} tarafından iptal edildi.` });
    
    await interaction.message.edit({ embeds: [embed], components: [] }).catch(() => {});
    return true;
  }

  // Execute actions
  const guild = interaction.guild;
  const results = [];
  let errorCount = 0;

  for (const act of data.actions) {
    try {
      if (act.type === 'create_channel') {
        // Find category if parent specified
        let parentId = null;
        if (act.parentCategoryIdOrName) {
          const category = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildCategory && 
            (c.id === act.parentCategoryIdOrName || c.name.toLowerCase() === act.parentCategoryIdOrName.toLowerCase())
          );
          if (category) {
            parentId = category.id;
          } else {
            // AI requested category but not found, let's create it!
            const newCat = await guild.channels.create({
              name: act.parentCategoryIdOrName,
              type: ChannelType.GuildCategory,
              reason: 'AI Sunucu Yönetim Sistemi'
            });
            parentId = newCat.id;
            results.push(`📁 **Yeni Kategori Oluşturuldu:** \`${act.parentCategoryIdOrName}\``);
          }
        }

        // Determine discord.js ChannelType
        let channelTypeVal = ChannelType.GuildText;
        if (act.channelType === 'VOICE') channelTypeVal = ChannelType.GuildVoice;
        else if (act.channelType === 'CATEGORY') channelTypeVal = ChannelType.GuildCategory;

        const newChannel = await guild.channels.create({
          name: act.name,
          type: channelTypeVal,
          parent: parentId,
          reason: 'AI Sunucu Yönetim Sistemi'
        });

        results.push(`✅ **Kanal Oluşturuldu:** <#${newChannel.id}> (${act.channelType})`);

        // If parent exists, automatically sync permissions
        if (parentId && channelTypeVal !== ChannelType.GuildCategory) {
          await newChannel.lockPermissions().catch(() => {});
          results.push(`🔒 <#${newChannel.id}> kanalının izinleri kategoriyle eşitlendi.`);
        }

      } else if (act.type === 'delete_channel') {
        const channel = guild.channels.cache.find(c => 
          c.id === act.channelIdOrName || 
          c.name.toLowerCase() === act.channelIdOrName.toLowerCase()
        );
        if (!channel) {
          throw new Error(`Silinecek "${act.channelIdOrName}" kanalı bulunamadı.`);
        }
        const name = channel.name;
        await channel.delete('AI Sunucu Yönetim Sistemi');
        results.push(`🗑️ **Kanal Silindi:** \`#${name}\``);

      } else if (act.type === 'sync_permissions_with_category') {
        const channel = guild.channels.cache.find(c => 
          c.id === act.channelIdOrName || 
          c.name.toLowerCase() === act.channelIdOrName.toLowerCase()
        );
        if (!channel) {
          throw new Error(`İzinleri eşitlenecek "${act.channelIdOrName}" kanalı bulunamadı.`);
        }
        const category = guild.channels.cache.find(c => 
          c.type === ChannelType.GuildCategory &&
          (c.id === act.categoryIdOrName || c.name.toLowerCase() === act.categoryIdOrName.toLowerCase())
        );
        if (!category) {
          throw new Error(`İzinlerin alınacağı "${act.categoryIdOrName}" kategorisi bulunamadı.`);
        }
        
        await channel.setParent(category.id, { lockPermissions: true, reason: 'AI Sunucu Yönetim Sistemi' });
        results.push(`🔒 **İzin Eşitleme Başarılı:** <#${channel.id}> kanalı \`${category.name}\` kategorisiyle eşitlendi.`);

      } else if (act.type === 'create_role') {
        // Build base role options
        const roleOptions = {
          name: act.name,
          reason: 'AI Sunucu Yönetim Sistemi'
        };

        if (act.color) {
          roleOptions.color = act.color;
        }

        // Check if permissions need copy
        if (act.permissionsCopyFromRoleIdOrName) {
          const srcRole = guild.roles.cache.find(r => 
            r.id === act.permissionsCopyFromRoleIdOrName || 
            r.name.toLowerCase() === act.permissionsCopyFromRoleIdOrName.toLowerCase()
          );
          if (srcRole) {
            roleOptions.permissions = srcRole.permissions;
          }
        }

        const newRole = await guild.roles.create(roleOptions);
        results.push(`✅ **Rol Oluşturuldu:** <@&${newRole.id}>`);

        // Handle position hierarchy
        if (act.placeBelowRoleIdOrName) {
          const targetRole = guild.roles.cache.find(r => 
            r.id === act.placeBelowRoleIdOrName || 
            r.name.toLowerCase() === act.placeBelowRoleIdOrName.toLowerCase()
          );
          if (targetRole) {
            const me = guild.members.me;
            if (targetRole.position >= me.roles.highest.position) {
              results.push(`⚠️ **Konumlandırma Atlandı:** Botun en yüksek rolü (\`${me.roles.highest.name}\`), \`${targetRole.name}\` rolünden daha düşük veya eşit olduğu için yeni rol altına yerleştirilemedi (Discord hiyerarşi kuralı).`);
            } else {
              // Set position exactly below targetRole.position
              // setting setPosition(targetRole.position) puts newRole in targetRole's index and pushes targetRole up, meaning newRole is directly below targetRole.
              await newRole.setPosition(targetRole.position).catch(err => {
                console.error("[AI Management] Rol konumlandırılamadı:", err.message);
              });
              results.push(`👑 **Rol Konumlandırıldı:** \`${newRole.name}\` rolü \`${targetRole.name}\` rolünün altına yerleştirildi.`);
            }
          }
        }

      } else if (act.type === 'delete_role') {
        const role = guild.roles.cache.find(r => 
          r.id === act.roleIdOrName || 
          r.name.toLowerCase() === act.roleIdOrName.toLowerCase()
        );
        if (!role) {
          throw new Error(`Silinecek "${act.roleIdOrName}" rolü bulunamadı.`);
        }
        
        const me = guild.members.me;
        if (role.position >= me.roles.highest.position) {
          throw new Error(`Botun yetkisi "${role.name}" rolünü silmeye yetmiyor (Hiyerarşi engeli).`);
        }

        const name = role.name;
        await role.delete('AI Sunucu Yönetim Sistemi');
        results.push(`🗑️ **Rol Silindi:** \`@${name}\``);

      } else if (act.type === 'modify_role') {
        const role = guild.roles.cache.find(r => 
          r.id === act.roleIdOrName || 
          r.name.toLowerCase() === act.roleIdOrName.toLowerCase()
        );
        if (!role) {
          throw new Error(`Düzenlenecek "${act.roleIdOrName}" rolü bulunamadı.`);
        }

        const me = guild.members.me;
        if (role.position >= me.roles.highest.position) {
          throw new Error(`Botun yetkisi "${role.name}" rolünü düzenlemeye yetmiyor (Hiyerarşi engeli).`);
        }

        const updateData = {};
        if (act.name) updateData.name = act.name;
        if (act.color) updateData.color = act.color;

        await role.edit(updateData, 'AI Sunucu Yönetim Sistemi');
        results.push(`✏️ **Rol Düzenlendi:** \`${role.name}\` (${Object.keys(updateData).map(k => `${k}: ${updateData[k]}`).join(', ')})`);

      } else if (act.type === 'assign_role') {
        // Resolve member
        const cleanUserStr = act.userIdOrTag.replace(/[^0-9]/g, '');
        const member = guild.members.cache.get(cleanUserStr) 
          || guild.members.cache.find(m => m.user.tag.toLowerCase() === act.userIdOrTag.toLowerCase())
          || await guild.members.fetch(cleanUserStr).catch(() => null);

        if (!member) {
          throw new Error(`Kullanıcı "${act.userIdOrTag}" bulunamadı.`);
        }

        const role = guild.roles.cache.find(r => 
          r.id === act.roleIdOrName || 
          r.name.toLowerCase() === act.roleIdOrName.toLowerCase()
        );
        if (!role) {
          throw new Error(`Verilecek "${act.roleIdOrName}" rolü bulunamadı.`);
        }

        const me = guild.members.me;
        if (role.position >= me.roles.highest.position) {
          throw new Error(`Botun yetkisi "${role.name}" rolünü vermeye yetmiyor (Hiyerarşi engeli).`);
        }

        await member.roles.add(role, 'AI Sunucu Yönetim Sistemi');
        results.push(`➕ **Rol Verildi:** \`${role.name}\` -> **${member.user.tag}**`);

      } else if (act.type === 'remove_role') {
        // Resolve member
        const cleanUserStr = act.userIdOrTag.replace(/[^0-9]/g, '');
        const member = guild.members.cache.get(cleanUserStr)
          || guild.members.cache.find(m => m.user.tag.toLowerCase() === act.userIdOrTag.toLowerCase())
          || await guild.members.fetch(cleanUserStr).catch(() => null);

        if (!member) {
          throw new Error(`Kullanıcı "${act.userIdOrTag}" bulunamadı.`);
        }

        const role = guild.roles.cache.find(r => 
          r.id === act.roleIdOrName || 
          r.name.toLowerCase() === act.roleIdOrName.toLowerCase()
        );
        if (!role) {
          throw new Error(`Geri alınacak "${act.roleIdOrName}" rolü bulunamadı.`);
        }

        const me = guild.members.me;
        if (role.position >= me.roles.highest.position) {
          throw new Error(`Botun yetkisi "${role.name}" rolünü geri almaya yetmiyor (Hiyerarşi engeli).`);
        }

        await member.roles.remove(role, 'AI Sunucu Yönetim Sistemi');
        results.push(`➖ **Rol Geri Alındı:** \`${role.name}\` -> **${member.user.tag}**`);

      } else if (act.type === 'modify_channel') {
        const channel = guild.channels.cache.find(c => 
          c.id === act.channelIdOrName || 
          c.name.toLowerCase() === act.channelIdOrName.toLowerCase()
        );
        if (!channel) {
          throw new Error(`Düzenlenecek "${act.channelIdOrName}" kanalı bulunamadı.`);
        }

        const updateData = {};
        if (act.name) updateData.name = act.name;
        if (act.topic !== undefined) updateData.topic = act.topic;
        if (act.nsfw !== undefined) updateData.nsfw = act.nsfw;
        if (act.slowmode !== undefined) updateData.rateLimitPerUser = parseInt(act.slowmode, 10);

        await channel.edit(updateData, 'AI Sunucu Yönetim Sistemi');
        results.push(`✏️ **Kanal Düzenlendi:** <#${channel.id}> (${Object.keys(updateData).map(k => `${k}: ${updateData[k]}`).join(', ')})`);

      } else if (act.type === 'set_channel_permissions') {
        const channel = guild.channels.cache.find(c => 
          c.id === act.channelIdOrName || 
          c.name.toLowerCase() === act.channelIdOrName.toLowerCase()
        );
        if (!channel) {
          throw new Error(`İzinleri ayarlanacak "${act.channelIdOrName}" kanalı bulunamadı.`);
        }

        const cleanTargetStr = act.roleIdOrNameOrUser.replace(/[^0-9]/g, '');
        const target = guild.roles.cache.find(r => 
          r.id === act.roleIdOrNameOrUser || 
          r.name.toLowerCase() === act.roleIdOrNameOrUser.toLowerCase()
        )
        || guild.members.cache.get(cleanTargetStr)
        || await guild.members.fetch(cleanTargetStr).catch(() => null);

        if (!target) {
          throw new Error(`İzin verilecek rol veya kullanıcı "${act.roleIdOrNameOrUser}" bulunamadı.`);
        }

        const resolvePermissionFlag = (permStr) => {
          const keys = Object.keys(PermissionFlagsBits);
          const found = keys.find(k => k.toLowerCase() === permStr.replace(/_/g, '').toLowerCase());
          return found ? PermissionFlagsBits[found] : null;
        };

        const allowFlags = (act.allow || []).map(p => resolvePermissionFlag(p)).filter(Boolean);
        const denyFlags = (act.deny || []).map(p => resolvePermissionFlag(p)).filter(Boolean);

        const overwrites = {};
        for (const f of allowFlags) overwrites[f] = true;
        for (const f of denyFlags) overwrites[f] = false;

        await channel.permissionOverwrites.edit(target, overwrites, { reason: 'AI Sunucu Yönetim Sistemi' });
        results.push(`🔒 **Kanal İzinleri Güncellendi:** <#${channel.id}> kanalında \`${target.name || target.user?.tag || act.roleIdOrNameOrUser}\` için özel izinler tanımlandı.`);

      } else if (act.type === 'kick_member') {
        const cleanUserStr = act.userIdOrTag.replace(/[^0-9]/g, '');
        const member = guild.members.cache.get(cleanUserStr) 
          || guild.members.cache.find(m => m.user.tag.toLowerCase() === act.userIdOrTag.toLowerCase())
          || await guild.members.fetch(cleanUserStr).catch(() => null);

        if (!member) {
          throw new Error(`Kullanıcı "${act.userIdOrTag}" bulunamadı.`);
        }

        const me = guild.members.me;
        if (member.roles.highest.position >= me.roles.highest.position) {
          throw new Error(`Botun yetkisi "${member.user.tag}" kullanıcısını atmaya yetmiyor (Hiyerarşi engeli).`);
        }

        await member.kick(act.reason || 'AI Sunucu Yönetim Sistemi');
        results.push(`👢 **Kullanıcı Atıldı:** **${member.user.tag}** (Sebep: ${act.reason || 'Belirtilmedi'})`);

      } else if (act.type === 'ban_member') {
        const cleanUserStr = act.userIdOrTag.replace(/[^0-9]/g, '');
        const member = guild.members.cache.get(cleanUserStr) 
          || guild.members.cache.find(m => m.user.tag.toLowerCase() === act.userIdOrTag.toLowerCase())
          || await guild.members.fetch(cleanUserStr).catch(() => null);

        const me = guild.members.me;
        if (member) {
          if (member.roles.highest.position >= me.roles.highest.position) {
            throw new Error(`Botun yetkisi "${member.user.tag}" kullanıcısını yasaklamaya yetmiyor (Hiyerarşi engeli).`);
          }
          await member.ban({ reason: act.reason || 'AI Sunucu Yönetim Sistemi' });
          results.push(`🔨 **Kullanıcı Yasaklandı:** **${member.user.tag}** (Sebep: ${act.reason || 'Belirtilmedi'})`);
        } else {
          await guild.members.ban(cleanUserStr, { reason: act.reason || 'AI Sunucu Yönetim Sistemi' });
          results.push(`🔨 **Kullanıcı Yasaklandı (Sunucu dışı ID):** \`${cleanUserStr}\` (Sebep: ${act.reason || 'Belirtilmedi'})`);
        }

      } else if (act.type === 'unban_member') {
        const cleanUserStr = act.userIdOrTag.replace(/[^0-9]/g, '');
        await guild.members.unban(cleanUserStr, act.reason || 'AI Sunucu Yönetim Sistemi');
        results.push(`🔓 **Yasak Kaldırıldı:** \`${cleanUserStr}\` (Sebep: ${act.reason || 'Belirtilmedi'})`);

      } else if (act.type === 'timeout_member') {
        const cleanUserStr = act.userIdOrTag.replace(/[^0-9]/g, '');
        const member = guild.members.cache.get(cleanUserStr) 
          || guild.members.cache.find(m => m.user.tag.toLowerCase() === act.userIdOrTag.toLowerCase())
          || await guild.members.fetch(cleanUserStr).catch(() => null);

        if (!member) {
          throw new Error(`Kullanıcı "${act.userIdOrTag}" bulunamadı.`);
        }

        const me = guild.members.me;
        if (member.roles.highest.position >= me.roles.highest.position) {
          throw new Error(`Botun yetkisi "${member.user.tag}" kullanıcısını susturmaya yetmiyor (Hiyerarşi engeli).`);
        }

        const durationMs = parseInt(act.duration, 10) * 60 * 1000;
        if (isNaN(durationMs) || durationMs <= 0) {
          throw new Error(`Geçersiz susturma süresi: ${act.duration}`);
        }

        await member.timeout(durationMs, act.reason || 'AI Sunucu Yönetim Sistemi');
        results.push(`🔇 **Kullanıcı Susturuldu (Timeout):** **${member.user.tag}** (${act.duration} dakika, Sebep: ${act.reason || 'Belirtilmedi'})`);

      } else if (act.type === 'send_message') {
        const channel = guild.channels.cache.find(c => 
          c.id === act.channelIdOrName || 
          c.name.toLowerCase() === act.channelIdOrName.toLowerCase()
        );
        if (!channel) {
          throw new Error(`Mesaj gönderilecek "${act.channelIdOrName}" kanalı bulunamadı.`);
        }
        if (!channel.isTextBased()) {
          throw new Error(`"${act.channelIdOrName}" kanalı metin tabanlı değil.`);
        }

        const messageOptions = {};
        if (act.content) messageOptions.content = act.content;

        if (act.embedTitle || act.embedDescription) {
          const msgEmbed = new EmbedBuilder()
            .setTitle(act.embedTitle || null)
            .setDescription(act.embedDescription || null)
            .setTimestamp();
          
          if (act.embedColor) {
            const cleanHex = act.embedColor.replace('#', '');
            msgEmbed.setColor(parseInt(cleanHex, 16) || 0x3498db);
          } else {
            msgEmbed.setColor(0x3498db);
          }
          messageOptions.embeds = [msgEmbed];
        }

        if (!messageOptions.content && !messageOptions.embeds) {
          throw new Error(`Gönderilecek mesaj içeriği veya embed boş olamaz.`);
        }

        await channel.send(messageOptions);
        results.push(`✉️ **Kanalına Mesaj Gönderildi:** <#${channel.id}>`);

      } else if (act.type === 'clear_messages') {
        const channel = guild.channels.cache.find(c => 
          c.id === act.channelIdOrName || 
          c.name.toLowerCase() === act.channelIdOrName.toLowerCase()
        );
        if (!channel) {
          throw new Error(`Mesaj temizlenecek "${act.channelIdOrName}" kanalı bulunamadı.`);
        }
        if (!channel.isTextBased() || typeof channel.bulkDelete !== 'function') {
          throw new Error(`"${act.channelIdOrName}" kanalı toplu mesaj silmeyi desteklemiyor.`);
        }

        const amount = Math.min(Math.max(parseInt(act.amount, 10) || 10, 1), 100);
        const deleted = await channel.bulkDelete(amount, true);
        results.push(`🧹 **Mesajlar Silindi:** <#${channel.id}> kanalından \`${deleted.size}\` adet mesaj silindi.`);

      }
    } catch (err) {
      console.error(`[AI Management] Eylem Hatası:`, err);
      results.push(`❌ **Hata:** ${err.message}`);
      errorCount++;
    }
  }

  // Update original message with execution reports
  const embed = new EmbedBuilder()
    .setTitle('✅ AI Yönetim İşlemi Tamamlandı')
    .setColor(errorCount === 0 ? 0x2ecc71 : 0xe67e22)
    .setDescription(
      `🤖 **AI Açıklaması:** ${data.explanation}\n\n` +
      `🛠️ **İşlem Raporu:**\n` +
      results.join('\n')
    )
    .setFooter({ text: `${interaction.user.tag} tarafından onaylandı ve uygulandı.` })
    .setTimestamp();

  await interaction.message.edit({ embeds: [embed], components: [] }).catch(() => {});
  pendingActions.delete(uniqueId);
  return true;
}

module.exports = {
  processAIInstruction,
  handleManagementButton,
  activeSessions,
  getActiveSessions
};
