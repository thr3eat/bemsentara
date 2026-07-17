'use strict';

const {
  EmbedBuilder, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const Ticket = require('../../models/Ticket');
const { generateTicketId } = require('../../utils/ticketId');
const { GUILD2_ID, GUILD2_TICKET_CATEGORY_ID } = require('../../config');
const { ROLES } = require('./staffSystem');
const { startTicketClaimRouting } = require('./reklamTicketService');

// Map<ticketId, timeoutId> — 5 dk kullanıcı cevap vermezse DM gönder
const pendingUserReplyTimers = new Map();

// Map<ticketId, timeoutId> — 3 dk yetkili yazmadıysa claim routing başlat
const pendingModReplyTimers = new Map();

/**
 * Handles support category select menu interception for kullanici_destek and diger_destek on Eko Yildiz
 */
async function handleEpostaSupportSelect(interaction, category) {
  const categoryNames = {
    kullanici_destek: "Kullanıcı Destek",
    diger_destek: "Diğer Destek"
  };
  const categoryName = categoryNames[category] || "Destek";

  const mailEmbed = new EmbedBuilder()
    .setTitle(`📨 E-POSTA ALICISI: Eko Yıldız ${categoryName} Departmanı`)
    .setDescription(
      `**Eko Yıldız ${categoryName} Hizmetlerine Hoş Geldiniz!**\n\n` +
      "Sanki yeni bir resmi e-posta yazıyormuş gibi aşağıdaki butona tıklayarak Destek Talep Formu'nu doldurun.\n\n" +
      "📝 **Sistem Durumu:** Çevrimiçi\n" +
      "📧 **Departman:** Müşteri Memnuniyeti & Destek"
    )
    .setColor(0x3498DB)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ekoyildiz_eposta_form_button_${category}`)
      .setLabel("Yeni Destek Talebi")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("📨")
  );

  return interaction.reply({ embeds: [mailEmbed], components: [row], ephemeral: true });
}

/**
 * Shows the form modal when they click the button
 */
async function triggerEpostaFormModal(interaction, category) {
  const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } = require("discord.js");
  const modal = new ModalBuilder()
    .setCustomId(`ekoyildiz_eposta_form_modal_${category}`)
    .setTitle("Destek E-Postası Gönder");

  const subjectInput = new TextInputBuilder()
    .setCustomId("eposta_konu")
    .setLabel("E-Posta Konusu (Kısa Başlık)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Örn: Rütbe sorunu / Hata bildirim")
    .setRequired(true);

  const detailInput = new TextInputBuilder()
    .setCustomId("eposta_detay")
    .setLabel("E-Posta İçeriği (Detaylı Açıklama)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Talebinizi, sorununuzu veya şikayetinizi detaylıca buraya yazın.")
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(subjectInput),
    new ActionRowBuilder().addComponents(detailInput)
  );

  return interaction.showModal(modal);
}

/**
 * Handles submit of the e-posta support modal
 */
async function handleEpostaModalSubmit(interaction, category) {
  const subject = interaction.fields.getTextInputValue("eposta_konu").trim();
  const description = interaction.fields.getTextInputValue("eposta_detay").trim();

  // Check if user is ticket-banned
  const User = require('../../models/User');
  const userRecord = await User.findOne({ discordId: interaction.user.id });
  if (userRecord?.ticketBanned) {
    return interaction.reply({
      content: "🚫 **Ticket Yasaklısınız.**\nSpam/kötüye kullanım raporunuz yetkililerce onaylandığı için ticket sistemi erişiminiz engellendi. Bu konuda itirazınız varsa sunucu yöneticisiyle iletişime geçin.",
      ephemeral: true
    });
  }

  await interaction.reply({
    content: "📬 **Talebiniz alındı!** Sizin için özel bir e-posta kutusu kanalı oluşturuluyor. Lütfen sol taraftaki kanalları kontrol edin.",
    ephemeral: true
  });

  const ticketId = generateTicketId();

  try {
    const targetGuild = await interaction.client.guilds.fetch(GUILD2_ID);
    if (!targetGuild) throw new Error("Eko Yıldız sunucusu bulunamadı.");

    // Channel A: User's Private Mail Channel (NO MODERATORS ALLOWED)
    const userPermissions = [
      { id: targetGuild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      }
    ];

    const channelA = await targetGuild.channels.create({
      name: `eposta-${interaction.user.username.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: GUILD2_TICKET_CATEGORY_ID || undefined,
      permissionOverwrites: userPermissions,
    });

    // Channel B: Moderators' Support Channel (NO USER ALLOWED)
    const modPermissions = [
      { id: targetGuild.id, deny: [PermissionFlagsBits.ViewChannel] }
    ];
    for (const roleId of Object.values(ROLES)) {
      if (roleId && targetGuild.roles.cache.has(roleId)) {
        modPermissions.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }
    }

    const channelB = await targetGuild.channels.create({
      name: `ticket-${ticketId.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: GUILD2_TICKET_CATEGORY_ID || undefined,
      permissionOverwrites: modPermissions,
    });

    // Save ticket in DB
    const ticket = new Ticket({
      ticketId,
      userId: interaction.user.id,
      userName: interaction.user.username,
      category,
      subject,
      description,
      channelId: channelB.id,
      userChannelId: channelA.id,
      status: 'open',
      guildId: GUILD2_ID,
      source: 'eposta',
    });
    await ticket.save();

    // Welcome embed in Channel A (User mailbox)
    const userEmbed = new EmbedBuilder()
      .setTitle("📨 GÖNDERİLEN E-POSTA KUTUSU")
      .setDescription(
        `Merhaba <@${interaction.user.id}>,\n` +
        `Destek talebiniz için oluşturulmuş özel e-posta kutusundasınız.\n\n` +
        `🔹 **Talep Konusu:** ${subject}\n` +
        `🔹 **Açıklama:** ${description}\n\n` +
        `💬 **Nasıl Çalışır?**\n` +
        `Bu kanala yazdığınız her şey doğrudan destek ekibimize iletilir. Yetkililerimizin cevapları da buraya e-posta biçiminde düşer.\n\n` +
        `İşlemleri yönetmek için aşağıdaki gerçekçi butonları kullanabilirsiniz.`
      )
      .setColor(0x3498DB)
      .setTimestamp();

    const rowUser = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_ticket_${ticketId}`)
        .setLabel("🔒 E-Postayı Arşivle (Kapat)")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`eposta_scan_${ticketId}`)
        .setLabel("🛡️ Güvenlik Taraması")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`eposta_print_${ticketId}`)
        .setLabel("🖨️ Yazıcıdan Çıkart")
        .setStyle(ButtonStyle.Secondary)
    );

    await channelA.send({ embeds: [userEmbed], components: [rowUser] });

    // Welcome embed in Channel B (Mod view)
    const modEmbed = new EmbedBuilder()
      .setTitle(`🎫 E-Posta Destek Talebi — ${ticketId}`)
      .setDescription(
        `👤 **Kullanıcı:** <@${interaction.user.id}> (${interaction.user.username})\n` +
        `📋 **Konu:** ${subject}\n` +
        `📝 **Açıklama:** ${description}\n\n` +
        `📌 **Yetkili Paneli:**\n` +
        `• Bu kanala yazacağınız her mesaj kullanıcının özel e-posta kanalına iletilir.\n` +
        `• Kullanıcının kendi kanalına yazdığı mesajlar buraya düşer.\n` +
        `• Ticket'ı yönetmek için aşağıdaki RP paneli butonlarını kullanabilirsiniz.`
      )
      .setColor(0xF1C40F)
      .setTimestamp();

    const rowMod = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`close_ticket_${ticketId}`)
        .setLabel("📦 Arşive Taşı (Kapat)")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`claim_ticket_${ticketId}`)
        .setLabel("🙋‍♂️ Üstlen")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`eposta_print_${ticketId}`)
        .setLabel("🖨️ E-Postayı Yazdır")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`eposta_spam_${ticketId}`)
        .setLabel("⚠️ Spam Rapor Et")
        .setStyle(ButtonStyle.Secondary)
    );

    await channelB.send({ embeds: [modEmbed], components: [rowMod] });

    // Yetkili 3 dk içinde cevap vermezse claim routing DM'i gönder (direk değil, gecikmeli)
    _scheduleModReplyTimer(ticket, interaction.client);

  } catch (err) {
    console.error("[epostaTicketService] Support setup failed:", err.message);
  }
}

/**
 * Forwards user message in their eposta channel to the moderation channel (SADE İLETİM)
 * Also cancels the 5-min "mod cevap verdi" DM timer since user is active
 */
async function forwardUserToModChannel(message, client) {
  const channelId = message.channel.id;
  const ticket = await Ticket.findOne({ userChannelId: channelId, status: 'open' });
  if (!ticket) return false;

  // Kullanıcı yazdı — 5 dk DM timer'ını iptal et
  if (pendingUserReplyTimers.has(ticket.ticketId)) {
    clearTimeout(pendingUserReplyTimers.get(ticket.ticketId));
    pendingUserReplyTimers.delete(ticket.ticketId);
  }

  // Kullanıcı yazdı — 3 dk yetkili bekleme timer'ını iptal et (yetkili henüz cevap vermemişse)
  if (pendingModReplyTimers.has(ticket.ticketId)) {
    clearTimeout(pendingModReplyTimers.get(ticket.ticketId));
    pendingModReplyTimers.delete(ticket.ticketId);
    // Yeniden başlat: kullanıcı yeni mesaj attı, 3 dk içinde mod cevap vermezse routing devreye girer
    _scheduleModReplyTimer(ticket, client);
  }

  const targetChannel = await client.channels.fetch(ticket.channelId).catch(() => null);
  if (!targetChannel) return false;

  let replyText = null;
  if (message.reference && message.reference.messageId) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (refMsg) {
        const embed = refMsg.embeds?.[0];
        const content = embed ? (embed.description || embed.title) : refMsg.content;
        replyText = content ? (content.length > 100 ? content.slice(0, 100) + '...' : content) : '*(ek dosya)*';
      }
    } catch (_) { }
  }

  const embed = new EmbedBuilder()
    .setColor(0x4ade80)
    .setAuthor({ name: `${message.author.tag} (E-Posta)`, iconURL: message.author.displayAvatarURL() })
    .setDescription((replyText ? `↩️ **Cevaplanan Mesaj:** *"${replyText}"*\n\n` : '') + (message.content || '*(ek dosya)*'))
    .setFooter({ text: '📩 EkoYıldız Destek Sistemi' })
    .setTimestamp();

  const sendOpts = { embeds: [embed] };
  if (message.attachments.size > 0) {
    sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
  }

  await targetChannel.send(sendOpts).catch(() => { });
  await message.react('✅').catch(() => { });
  return true;
}

/**
 * Internal: 3 dakika içinde mod cevap vermezse claim routing başlat
 */
function _scheduleModReplyTimer(ticket, client) {
  if (pendingModReplyTimers.has(ticket.ticketId)) return; // Zaten çalışıyor
  const THREE_MIN = 3 * 60 * 1000;
  const tid = setTimeout(async () => {
    pendingModReplyTimers.delete(ticket.ticketId);
    // Hâlâ açık mı kontrol et
    const fresh = await Ticket.findOne({ ticketId: ticket.ticketId, status: 'open' }).catch(() => null);
    if (!fresh) return;
    // Yetkili kanalına son mesaj zamanına bak; eğer sistemin başlangıç mesajından sonra hiç insan yazmadıysa routing yap
    try {
      const { guilds } = require('discord.js');
      const { Client } = require('discord.js');
      // client üzerinden guild çek
      const guild = client.guilds.cache.get(fresh.guildId);
      if (!guild) return;
      const modChan = guild.channels.cache.get(fresh.channelId);
      if (!modChan) return;

      const msgs = await modChan.messages.fetch({ limit: 20 });
      const hasHumanMessage = msgs.some(m => !m.author.bot);
      if (hasHumanMessage) return; // Yetkili zaten yazmış

      console.log(`[EpostaService] 3 dk geçti, yetkili yazmadı — claim routing başlatılıyor: ${fresh.ticketId}`);
      await startTicketClaimRouting(fresh, guild, client);
    } catch (e) {
      console.warn('[EpostaService] _scheduleModReplyTimer error:', e.message);
    }
  }, THREE_MIN);
  pendingModReplyTimers.set(ticket.ticketId, tid);
}

/**
 * Forwards moderator message in moderator channel to user eposta channel (SADE İLETİM)
 * 1) İlk mod mesajında ticket.claimedBy set edilir (personel sistemi)
 * 2) 5 dk sonra kullanıcı cevap vermezse kullanıcıya DM gönderilir
 * 3) 3 dk mod bekleme timer'ı iptal edilir
 */
async function forwardModToUserChannel(message, client) {
  const channelId = message.channel.id;
  const ticket = await Ticket.findOne({ channelId, status: 'open' });
  if (!ticket || !ticket.userChannelId) return false;

  // ── 3 dk yetkili bekleme timer'ını iptal et ──
  if (pendingModReplyTimers.has(ticket.ticketId)) {
    clearTimeout(pendingModReplyTimers.get(ticket.ticketId));
    pendingModReplyTimers.delete(ticket.ticketId);
  }

  // ── İlk yetkili mesajı → ticket'ı üstlen (claimedBy) ──
  if (!ticket.claimedBy) {
    ticket.claimedBy = message.author.id;
    ticket.claimedByName = message.author.displayName || message.author.username;
    ticket.claimedAt = new Date();
    await ticket.save();

    try {
      const { addNotification } = require("../../utils/notification");
      await addNotification(ticket.userId, {
        title: "🙋 Destek Talebi Üstlenildi",
        message: `\`${ticket.ticketId}\` numaralı destek talebiniz ${message.author.username} tarafından üstlenildi.`,
        icon: "🙋"
      });
    } catch (err) {
      console.error("[epostaTicketService] Claim notification error:", err.message);
    }

    // Personel istatistiğine kaydet
    try {
      const { recordTicketClaimed } = require('./staffSystem');
      if (typeof recordTicketClaimed === 'function') {
        await recordTicketClaimed(message.author.id, client).catch(() => {});
      }
    } catch (_) {}
    // Yetkili kanalına bilgi embed'i gönder
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0x2ecc71)
        .setDescription(`✅ **${message.author.displayName}** bu ticket'ı üstlendi.`)
        .setTimestamp()
      ]
    }).catch(() => {});
  }

  const targetChannel = await client.channels.fetch(ticket.userChannelId).catch(() => null);
  if (!targetChannel) return false;

  let replyText = null;
  if (message.reference && message.reference.messageId) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (refMsg) {
        const embed = refMsg.embeds?.[0];
        const content = embed ? (embed.description || embed.title) : refMsg.content;
        replyText = content ? (content.length > 100 ? (content.includes('Cevaplanan Mesaj:') ? content.split('\n\n').slice(1).join('\n\n') : content).slice(0, 100) + '...' : content) : '*(ek dosya)*';
      }
    } catch (_) { }
  }

  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setAuthor({ name: `${message.author.displayName} — Yetkili`, iconURL: message.author.displayAvatarURL() })
    .setDescription((replyText ? `↩️ **Cevaplanan Mesajınız:** *"${replyText}"*\n\n` : '') + (message.content || '*(ek dosya)*'))
    .setFooter({ text: 'Eko Yıldız Müşteri Hizmetleri' })
    .setTimestamp();

  const sendOpts = { embeds: [embed] };
  if (message.attachments.size > 0) {
    sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
  }

  await targetChannel.send(sendOpts).catch(() => { });
  await message.react('✅').catch(() => { });

  // ── 5 dk sonra kullanıcı cevap vermezse DM gönder ──
  // Varsa önceki timer'ı sıfırla
  if (pendingUserReplyTimers.has(ticket.ticketId)) {
    clearTimeout(pendingUserReplyTimers.get(ticket.ticketId));
  }
  const FIVE_MIN = 5 * 60 * 1000;
  const tid = setTimeout(async () => {
    pendingUserReplyTimers.delete(ticket.ticketId);
    // Hâlâ açık mı?
    const fresh = await Ticket.findOne({ ticketId: ticket.ticketId, status: 'open' }).catch(() => null);
    if (!fresh) return;
    // Kullanıcıya DM gönder
    try {
      const ticketOwner = await client.users.fetch(fresh.userId).catch(() => null);
      if (!ticketOwner) return;
      // Kullanıcı kanalı linki
      const chanLink = fresh.userChannelId ? `https://discord.com/channels/${fresh.guildId}/${fresh.userChannelId}` : null;
      const dmEmbed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('📬 Destek Talebinizde Cevap Var!')
        .setDescription(
          `Destek talebinize yetkili cevap verdi, kanala geri dönün:\n\n` +
          (chanLink ? `👉 **[Kanala Git](${chanLink})**\n\n` : '') +
          `Ticket ID: \`${fresh.ticketId}\``
        )
        .setFooter({ text: 'Eko Yıldız Destek Sistemi' })
        .setTimestamp();
      const dmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`user_dm_ok_${fresh.ticketId}`)
          .setLabel('Tamam')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`user_dm_close_${fresh.ticketId}`)
          .setLabel('✅ Sorunum Çözüldü — Kapat')
          .setStyle(ButtonStyle.Success)
      );
      await ticketOwner.send({ embeds: [dmEmbed], components: [dmRow] }).catch(() => {});
    } catch (e) {
      console.warn('[EpostaService] 5 dk DM gönderilemedi:', e.message);
    }
  }, FIVE_MIN);
  pendingUserReplyTimers.set(ticket.ticketId, tid);

  return true;
}

async function archiveEkoYildizTicket(ticket, interaction, reason) {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
  const guild = await interaction.client.guilds.fetch(ticket.guildId);
  const archiveCategoryId = "1525218080068730991";

  // Timer'ları temizle — ticket kapandı, stale DM gönderilmesin
  if (pendingUserReplyTimers.has(ticket.ticketId)) {
    clearTimeout(pendingUserReplyTimers.get(ticket.ticketId));
    pendingUserReplyTimers.delete(ticket.ticketId);
  }
  if (pendingModReplyTimers.has(ticket.ticketId)) {
    clearTimeout(pendingModReplyTimers.get(ticket.ticketId));
    pendingModReplyTimers.delete(ticket.ticketId);
  }

  /**
   * Locks a channel completely: deny @everyone ViewChannel, remove all existing overwrites,
   * only keep the provided allowedIds with view-only access
   */
  async function lockChannelForArchive(channel, viewOnlyUserIds = []) {
    // Build fresh overwrites: deny everyone
    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }
    ];
    // Allow specific users view-only (no send)
    for (const uid of viewOnlyUserIds) {
      overwrites.push({
        id: uid,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages]
      });
    }
    // Set parent and lock permissions
    await channel.setParent(archiveCategoryId, { lockPermissions: false }).catch(() => {});
    await channel.permissionOverwrites.set(overwrites).catch(() => {});
  }

  // 1. Archive Moderator Channel (ticket-) — deny everyone including mods
  const modChannel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (modChannel) {
    await lockChannelForArchive(modChannel, []);

    const modClosedEmbed = new EmbedBuilder()
      .setTitle("📦 Ticket Arşive Taşındı")
      .setDescription(
        `**Arşivleyen:** ${interaction.user.username}\n` +
        `**Sebep:** ${reason || 'Belirtilmedi'}\n\n` +
        `📌 **Kontroller:**\n` +
        `• Yetkililer bu talebi yeniden açabilir.\n` +
        `• "Yeniden Açılışı Engelle" butonuna basarak kullanıcının bu talebi kendi başına açmasını önleyebilirsiniz.`
      )
      .setColor(0x7f8c8d)
      .setTimestamp();

    const rowMod = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reopen_ticket_${ticket.ticketId}`)
        .setLabel("🔓 Yeniden Aç")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`eposta_lock_reopen_${ticket.ticketId}`)
        .setLabel("🚫 Yeniden Açılışı Engelle")
        .setStyle(ButtonStyle.Danger)
    );

    await modChannel.send({ embeds: [modClosedEmbed], components: [rowMod] }).catch(() => {});
  }

  // 2. Archive User Channel (eposta-) — deny EVERYONE (user cannot see it after archive)
  if (ticket.userChannelId) {
    const userChannel = await guild.channels.fetch(ticket.userChannelId).catch(() => null);
    if (userChannel) {
      // Kimse göremez — tamamen gizle
      await lockChannelForArchive(userChannel, []);

      const userClosedEmbed = new EmbedBuilder()
        .setTitle("🔒 E-Posta Talebiniz Arşivlendi")
        .setDescription(
          `Bu destek talebi başarıyla arşivlenmiştir.\n\n` +
          `💬 **Tarihçe:** Bu kanaldaki geçmiş e-postaları okumaya devam edebilirsiniz.\n` +
          `🔄 **Yeniden Açma:** İhtiyacınız olduğunda aşağıdaki butona tıklayarak talebi tekrar aktif hale getirebilirsiniz.`
        )
        .setColor(0x95a5a6)
        .setTimestamp();

      const rowUser = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reopen_ticket_${ticket.ticketId}`)
          .setLabel("🔄 Yeniden Aç")
          .setStyle(ButtonStyle.Primary)
      );

      await userChannel.send({ embeds: [userClosedEmbed], components: [rowUser] }).catch(() => {});
    }
  }

  // 3. Archive additional users' private channels — view-only for each
  if (ticket.additionalChannels) {
    for (let i = 0; i < ticket.additionalChannels.length; i++) {
      const chanId = ticket.additionalChannels[i];
      const addUserId = ticket.additionalUsers?.[i];
      const extraChan = await guild.channels.fetch(chanId).catch(() => null);
      if (extraChan) {
        await lockChannelForArchive(extraChan, addUserId ? [addUserId] : []);
        await extraChan.send("🔒 **Destek talebi arşivlendi.** Bu kanal artık salt okunur modundadır.").catch(() => {});
      }
    }
  }

  // 4. Archive Reklam ticket channel — deny user send too
  if (ticket.category === 'reklam_destek') {
    const reklamChannel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (reklamChannel) {
      await lockChannelForArchive(reklamChannel, [ticket.userId]);

      const reklamClosedEmbed = new EmbedBuilder()
        .setTitle("🔒 Reklam Talebi Arşivlendi")
        .setDescription(
          `Bu reklam destek talebi arşive taşınmıştır.\n\n` +
          `🔄 Yeniden açmak isterseniz aşağıdaki butona tıklayabilirsiniz.`
        )
        .setColor(0x95a5a6)
        .setTimestamp();

      const rowReklam = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reopen_ticket_${ticket.ticketId}`)
          .setLabel("🔄 Yeniden Aç")
          .setStyle(ButtonStyle.Primary)
      );

      await reklamChannel.send({ embeds: [reklamClosedEmbed], components: [rowReklam] }).catch(() => {});
    }
  }

  // 5. Send DM rating/close notification to ticket owner
  try {
    const ticketOwner = await interaction.client.users.fetch(ticket.userId).catch(() => null);
    if (ticketOwner) {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🔒 Ticket'ınız Kapatıldı")
        .setDescription(
          `Destek talebiniz **${interaction.user.username}** tarafından kapatıldı.\n\n` +
          `**Sebep:** ${reason || 'Belirtilmedi'}\n\n` +
          `Destek talebini yeniden açmak veya ekibimizi değerlendirmek için kanalınızdaki "Yeniden Aç" butonunu kullanabilirsiniz.`
        )
        .addFields(
          { name: "🎫 Ticket ID", value: `\`${ticket.ticketId}\``, inline: true },
          { name: "📋 Konu", value: ticket.subject || 'Belirtilmedi', inline: true }
        )
        .setFooter({ text: "Eko Yıldız Destek • Gizlilik politikamız gereği değerlendirme notunuz anonim tutulur." })
        .setTimestamp();

      const { buildReopenAndRateRow } = require("../embeds");
      const dmButtons = buildReopenAndRateRow(ticket.ticketId);
      await ticketOwner.send({ embeds: [dmEmbed], components: [dmButtons] }).catch(() => {});
    }
  } catch (dmErr) {
    console.warn("[archiveEkoYildizTicket] DM gönderilemedi:", dmErr.message);
  }
}

async function reopenEkoYildizTicket(ticket, interaction) {
  const { EmbedBuilder } = require("discord.js");
  const guild = await interaction.client.guilds.fetch(ticket.guildId);
  const ticketCategoryId = "1518716275239551046";

  // Reopen User Channel
  if (ticket.userChannelId) {
    const userChannel = await guild.channels.fetch(ticket.userChannelId).catch(() => null);
    if (userChannel) {
      await userChannel.setParent(ticketCategoryId, { lockPermissions: false }).catch(() => { });

      // Allow user to send messages again
      await userChannel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: true,
      }).catch(() => { });

      if (ticket.additionalUsers) {
        for (const addUserId of ticket.additionalUsers) {
          await userChannel.permissionOverwrites.edit(addUserId, {
            ViewChannel: true,
            SendMessages: true,
          }).catch(() => { });
        }
      }

      await userChannel.send("🔄 **E-Posta Talebi Yeniden Açıldı.** Artık yazmaya devam edebilirsiniz.");
    }
  }

  // Reopen all additional users private channels if they exist
  if (ticket.additionalChannels) {
    for (const chanId of ticket.additionalChannels) {
      const extraChan = await guild.channels.fetch(chanId).catch(() => null);
      if (extraChan) {
        await extraChan.setParent(ticketCategoryId, { lockPermissions: false }).catch(() => { });
        const match = extraChan.name.match(/eposta-(.+)/);
        if (match) {
          const targetMember = guild.members.cache.find(m => m.user.username.toLowerCase() === match[1]);
          if (targetMember) {
            await extraChan.permissionOverwrites.edit(targetMember.id, {
              ViewChannel: true,
              SendMessages: true,
            }).catch(() => { });
          }
        }
        await extraChan.send("🔄 **E-Posta Talebi Yeniden Açıldı.** Artık yazmaya devam edebilirsiniz.");
      }
    }
  }

  // Reopen Mod/Staff Channel
  const modChannel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (modChannel) {
    await modChannel.setParent(ticketCategoryId, { lockPermissions: false }).catch(() => { });
    await modChannel.send(`🔄 **Ticket Yeniden Açıldı.** (Açan: ${interaction.user.username})`);
  }

  // Reopen Reklam Channel (if reklam ticket)
  if (ticket.category === 'reklam_destek') {
    const reklamChannel = await guild.channels.fetch(ticket.channelId).catch(() => null);
    if (reklamChannel) {
      await reklamChannel.setParent(ticketCategoryId, { lockPermissions: false }).catch(() => { });
      await reklamChannel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: true,
        SendMessages: true,
      }).catch(() => { });
      await reklamChannel.send("🔄 **Reklam Talebi Yeniden Açıldı.** Artık yazmaya devam edebilirsiniz.");
    }
  }

  // Update DB status
  ticket.status = 'open';
  ticket.closedAt = null;
  ticket.closeReason = null;
  await ticket.save();
}

module.exports = {
  handleEpostaSupportSelect,
  triggerEpostaFormModal,
  handleEpostaModalSubmit,
  forwardUserToModChannel,
  forwardModToUserChannel,
  archiveEkoYildizTicket,
  reopenEkoYildizTicket,
  pendingUserReplyTimers,
  pendingModReplyTimers,
};
