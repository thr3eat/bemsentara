'use strict';

const {
  EmbedBuilder, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const Ticket = require('../../models/Ticket');
const { generateTicketId } = require('../../utils/ticketId');
const { GUILD2_ID, GUILD2_TICKET_CATEGORY_ID } = require('../../config');
const { ROLES } = require('./staffSystem');

/**
 * Handles the submit of EkoYildiz reklam form modal
 */
async function handleReklamModalSubmit(interaction) {
  const communityName = interaction.fields.getTextInputValue("reklam_topluluk_adi").trim();
  const memberCount = interaction.fields.getTextInputValue("reklam_kisi_sayisi").trim();
  const adType = interaction.fields.getTextInputValue("reklam_turu").trim();

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
    content: "📬 **Talebiniz alındı! Lütfen DM kutunuzu kontrol edin.** Eko Yıldız Reklam Departmanı sizinle iletişime geçiyor...",
    ephemeral: true
  });

  const ticketId = generateTicketId();

  // Create pending ticket in DB
  const ticket = new Ticket({
    ticketId,
    userId: interaction.user.id,
    userName: interaction.user.username,
    category: 'reklam_destek',
    subject: 'Reklam Talebi',
    description: `Topluluk: ${communityName} | Kişi Sayısı: ${memberCount} | Tür: ${adType}`,
    status: 'pending_confirmation',
    guildId: GUILD2_ID,
    source: 'dm',
  });
  await ticket.save();

  // Send DM to the user with Yes/No confirmation buttons
  try {
    const dmEmbed = new EmbedBuilder()
      .setTitle("✉️ E-POSTA GELDİ!")
      .setDescription(
        "**Gönderen:** Emre (Eko Yıldız Reklam Hizmetleri)\n\n" +
        "Merhaba ben reklam hizmetlerinden emre. Reklam istediğinizi gördüm.\n" +
        "Bizimle reklam oluşturmak mı istiyorsunuz?\n\n" +
        "**Talep Detaylarınız:**\n" +
        `🔹 **Topluluk Adı:** ${communityName}\n` +
        `🔹 **Kişi Sayısı:** ${memberCount}\n` +
        `🔹 **Reklam Türü:** ${adType}`
      )
      .setColor(0xF1C40F)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ekoyildiz_reklam_confirm_yes_${ticketId}`)
        .setLabel("Evet (Reklam Oluştur)")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ekoyildiz_reklam_confirm_no_${ticketId}`)
        .setLabel("Hayır (İptal Et)")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.user.send({ embeds: [dmEmbed], components: [row] });
  } catch (err) {
    console.error(`[reklamTicketService] Failed to send DM to user ${interaction.user.id}:`, err.message);
  }
}

/**
 * Handles confirmation response from DM button clicks
 */
async function handleReklamConfirm(interaction, client, isYes, ticketId) {
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    return interaction.update({ content: "❌ Talep bulunamadı.", embeds: [], components: [] });
  }

  if (ticket.status !== 'pending_confirmation') {
    return interaction.update({ content: "❌ Bu talep zaten işlenmiş.", embeds: [], components: [] });
  }

  if (!isYes) {
    ticket.status = 'closed';
    ticket.closeReason = 'Kullanıcı DM üzerinden iptal etti.';
    ticket.closedAt = new Date();
    await ticket.save();

    return interaction.update({
      content: '❌ Reklam talebi iptal edildi. İstediğiniz zaman tekrar talep oluşturabilirsiniz.',
      embeds: [],
      components: []
    });
  }

  // User confirmed! Create reklam channel
  await interaction.update({
    content: '⏳ **Reklam talebi onaylandı!** Reklam kanalınız oluşturuluyor, lütfen bekleyin...',
    embeds: [],
    components: []
  });

  try {
    const targetGuild = await client.guilds.fetch(GUILD2_ID);
    if (!targetGuild) throw new Error("Eko Yıldız sunucusu bulunamadı.");

    const permissionOverwrites = [
      { id: targetGuild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: ticket.userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    // Staff roles view permissions
    for (const roleId of Object.values(ROLES)) {
      if (roleId && targetGuild.roles.cache.has(roleId)) {
        permissionOverwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }
    }

    const channel = await targetGuild.channels.create({
      name: `reklam-${ticket.userName.toLowerCase()}`,
      type: ChannelType.GuildText,
      parent: GUILD2_TICKET_CATEGORY_ID || undefined,
      permissionOverwrites,
    });

    ticket.status = 'open';
    ticket.channelId = channel.id;
    await ticket.save();

    // Welcome embed in reklam channel
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 ${ticket.ticketId} - Reklam Talebi`)
      .setDescription(
        `👤 **Kullanıcı:** <@${ticket.userId}> (${ticket.userName})\n` +
        `📝 **Detaylar:**\n${ticket.description}\n\n` +
        `📌 **Yetkili Paneli:**\n` +
        `• Bu kanala yazdığınız mesajlar kullanıcıya **DM** olarak iletilir.\n` +
        `• Kullanıcının DM'den yazdıkları bu kanala düşer.\n` +
        `• Reklam işlemleri için butonları kullanabilirsiniz.`
      )
      .setColor(0xF1C40F)
      .setTimestamp();

    const rowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reklam_close_${ticketId}`)
        .setLabel("REKLAM TALEBİNİ KAPAT")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`reklam_pause_${ticketId}`)
        .setLabel("REKLAM TALEBİNİ DURAKLAT")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`reklam_prices_${ticketId}`)
        .setLabel("REKLAM FİYATLARI")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`claim_ticket_${ticketId}`)
        .setLabel("🙋‍♂️ Üstlen")
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [welcomeEmbed], components: [rowButtons] });

    // Start Claim Routing for active staff
    await startTicketClaimRouting(ticket, targetGuild, client).catch(err => {
      console.error("[reklamTicketService] Claim routing failed:", err.message);
    });

    // Inform user in DM
    await interaction.followUp({
      content: `✅ **Reklam kanalınız oluşturuldu!** Eko Yıldız sunucusundaki kanal üzerinden görüşmeye başlayabilirsiniz.\n\n` +
               `💬 Bu pencereden yazacağınız mesajlar doğrudan reklam kanalına yetkililere iletilecektir.`,
      ephemeral: false
    });
  } catch (err) {
    console.error("[reklamTicketService] Channel creation failed:", err.message);
    await interaction.followUp({
      content: `❌ Reklam kanalı oluşturulurken bir hata oluştu: ${err.message}`,
      ephemeral: false
    });
  }
}

/**
 * Forwards user DM message to reklam channel
 */
async function forwardDMToReklamChannel(message, client, ticket) {
  const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel) return;

  if (ticket.paused) {
    await message.author.send("⏸️ **Reklam talebiniz şu anda duraklatılmış durumdadır.** İletişim geçici olarak askıya alınmıştır.").catch(() => {});
    return;
  }

  // Check transfer state
  if (ticket.transferState === "pending_transfer") {
    ticket.transferState = "connected";
    await ticket.save();
    const connEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("🔌 Bağlantı Kuruldu")
      .setDescription("✅ **Bağlanıldı!** Satın alma işleminiz için üst düzey yönetici sohbete katıldı.")
      .setTimestamp();
    await message.author.send({ embeds: [connEmbed] }).catch(() => {});
  }

  let replyText = null;
  if (message.reference && message.reference.messageId) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (refMsg) {
        const embed = refMsg.embeds?.[0];
        const content = embed ? (embed.description || embed.title) : refMsg.content;
        replyText = content ? (content.length > 100 ? content.slice(0, 100) + '...' : content) : '*(ek dosya)*';
      }
    } catch (_) {}
  }

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setAuthor({ name: `${message.author.tag} (DM)`, iconURL: message.author.displayAvatarURL() })
    .setDescription((replyText ? `↩️ **Cevaplanan Mesaj:** *"${replyText}"*\n\n` : '') + (message.content || '*(ek dosya)*'))
    .setFooter({ text: '📩 Kullanıcıdan DM' })
    .setTimestamp();

  const sendOpts = { embeds: [embed] };
  if (message.attachments.size > 0) {
    sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
  }

  await channel.send(sendOpts).catch(() => {});
  await message.react('✅').catch(() => {});
}

/**
 * Forwards moderator message in reklam channel to user DM
 */
async function forwardReklamChannelToDM(message, client) {
  const channelId = message.channel.id;
  const ticket = await Ticket.findOne({ channelId, status: 'open', category: 'reklam_destek' });
  if (!ticket) return false;

  if (ticket.paused) {
    return false;
  }

  const user = await client.users.fetch(ticket.userId).catch(() => null);
  if (!user) return false;

  // Check transfer state
  if (ticket.transferState === "pending_transfer") {
    ticket.transferState = "connected";
    await ticket.save();
    const connEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("🔌 Bağlantı Kuruldu")
      .setDescription("✅ **Bağlanıldı!** Satın alma işleminiz için üst düzey yönetici sohbete katıldı.")
      .setTimestamp();
    await user.send({ embeds: [connEmbed] }).catch(() => {});
  }

  let replyText = null;
  if (message.reference && message.reference.messageId) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (refMsg) {
        const embed = refMsg.embeds?.[0];
        const content = embed ? (embed.description || embed.title) : refMsg.content;
        replyText = content ? (content.length > 100 ? (content.includes('Cevaplanan Mesaj:') ? content.split('\n\n').slice(1).join('\n\n') : content).slice(0, 100) + '...' : content) : '*(ek dosya)*';
      }
    } catch (_) {}
  }

  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setAuthor({ name: `${message.author.displayName} — Yetkili`, iconURL: message.author.displayAvatarURL() })
    .setDescription((replyText ? `↩️ **Cevaplanan Mesajınız:** *"${replyText}"*\n\n` : '') + (message.content || '*(ek dosya)*'))
    .setFooter({ text: 'Eko Yıldız Reklam Departmanı' })
    .setTimestamp();

  const sendOpts = { embeds: [embed] };
  if (message.attachments.size > 0) {
    sendOpts.files = [...message.attachments.values()].map(a => a.url).slice(0, 5);
  }

  await user.send(sendOpts).catch(() => {});
  await message.react('✅').catch(() => {});
  return true;
}

/**
 * Sends advertising package details in reklam channel
 */
async function sendReklamPrices(interaction, ticketId) {
  const pricesEmbed = new EmbedBuilder()
    .setTitle("📈 SPONSORLUK VE REKLAM PAKETLERİ")
    .setDescription(
      "*Reklam ve iş birlikleri için bütçenize ve hedef kitlenize en uygun paketi seçebilirsiniz. Fiyatlarımız 30 TL ile 870 TL arasında değişkenlik göstermektedir.*\n\n" +
      "### 🔹 Ekonomik Paketler\n" +
      "• **30 TL | Shorts Paketi:** Sadece YouTube Shorts videolarında reklam/sponsorluk yerleşimi.\n" +
      "• **50 TL | Standart Uzun Video:** Uzun videonun alt kısmında (banner/yazı olarak) sabit sponsor reklamı.\n" +
      "• **100 TL | Avantajlı Uzun Video:** Uzun videonun alt kısmında sponsor yazısı + Videonun orta yerinde özel reklam arası (Mid-roll).\n\n" +
      "### 🚀 Premium & Entegre Paketler\n" +
      "• **350 TL | Gold Kombin Paket:**\n" +
      "  - Uzun video alt kısım sponsor yazısı\n" +
      "  - Video ortasında reklam arası\n" +
      "  - 1 Adet YouTube Shorts reklamı\n" +
      "  - YouTube Topluluk sekmesinde özel Anket reklamı\n\n" +
      "• **500 TL | Mega Etkileşim Paketi:**\n" +
      "  - Uzun video alt kısım sponsor yazısı + Video ortası reklam arası\n" +
      "  - 1 Adet YouTube Shorts reklamı + Topluluk Anketi\n" +
      "  - Discord sunucusunda özel reklam duyurusu\n" +
      "  - YouTube Topluluk sekmesinde görsel/metin reklamı\n\n" +
      "### 🔥 VIP & Topluluk Odaklı Paketler (En Yüksek Dönüşüm)\n" +
      "• **670 TL | Çekilişli VIP Paket:**\n" +
      "  - *Mega Etkileşim Paketi’ndeki tüm özellikler dahil!*\n" +
      "  - **Büyük Çekiliş:** Reklam sahibinin Roblox grubuna katılanlara özel, 2 kişiye toplam 9.800 Robux çekilişi (Doğrudan grubunuza üye çeker).\n\n" +
      "• **870 TL | Ultimate Roblox & Topluluk Kampı:**\n" +
      "  - *670 TL'lik VIP Paket'teki tüm özellikler dahil!*\n" +
      "  - **Roblox Grubu Geliştirme Kampı:** Reklam sahibinin Roblox grubuna özel üye toplama kampı düzenleme ve grubun tüm platformlarda aktif olarak tanıtılması.\n\n" +
      "⚖️ Fiyatlarımız KDV dahildir.\n\n" +
      "⚠️ Özel siparişler 1050 TL'den başlar (Kampa özel video vb.)."
    )
    .setColor(0x2ECC71)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reklam_buy_${ticketId}`)
      .setLabel("🛒 SATIN ALMA")
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ embeds: [pricesEmbed], components: [row] });

  // DM the prices directly to the user (ad owner)
  try {
    const ticket = await Ticket.findOne({ ticketId });
    if (ticket) {
      const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
      if (user) {
        await user.send({ embeds: [pricesEmbed], components: [row] }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[reklamTicketService] Failed to send prices embed via DM:", err.message);
  }
}

/**
 * Triggers package selection dropdown
 */
async function triggerPurchaseSelection(interaction, ticketId) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`reklam_package_select_${ticketId}`)
    .setPlaceholder("Almak istediğiniz reklam paketini seçin...")
    .addOptions([
      new StringSelectMenuOptionBuilder().setLabel("Shorts Paketi - 30 TL").setValue("pkg_30"),
      new StringSelectMenuOptionBuilder().setLabel("Standart Uzun Video - 50 TL").setValue("pkg_50"),
      new StringSelectMenuOptionBuilder().setLabel("Avantajlı Uzun Video - 100 TL").setValue("pkg_100"),
      new StringSelectMenuOptionBuilder().setLabel("Gold Kombin Paket - 350 TL").setValue("pkg_350"),
      new StringSelectMenuOptionBuilder().setLabel("Mega Etkileşim Paketi - 500 TL").setValue("pkg_500"),
      new StringSelectMenuOptionBuilder().setLabel("Çekilişli VIP Paket - 670 TL").setValue("pkg_670"),
      new StringSelectMenuOptionBuilder().setLabel("Ultimate Roblox & Topluluk Kampı - 870 TL").setValue("pkg_870"),
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await interaction.reply({ content: "📢 Lütfen almak istediğiniz paketi seçin:", components: [row], ephemeral: true });
}

/**
 * Handles package purchase selection
 */
async function handlePurchaseSelection(interaction) {
  const customId = interaction.customId;
  const ticketId = customId.replace("reklam_package_select_", "");
  const selectedValue = interaction.values[0];

  const packageNames = {
    pkg_30: "Shorts Paketi - 30 TL",
    pkg_50: "Standart Uzun Video - 50 TL",
    pkg_100: "Avantajlı Uzun Video - 100 TL",
    pkg_350: "Gold Kombin Paket - 350 TL",
    pkg_500: "Mega Etkileşim Paketi - 500 TL",
    pkg_670: "Çekilişli VIP Paket - 670 TL",
    pkg_870: "Ultimate Roblox & Topluluk Kampı - 870 TL"
  };

  const packageName = packageNames[selectedValue] || selectedValue;
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    return interaction.reply({ content: "❌ Reklam talebi bulunamadı.", ephemeral: true });
  }

  ticket.transferState = "pending_transfer";
  await ticket.save();

  // Send ping message in channel
  const managerPing = `<@1031620522406072350>`;
  await interaction.channel.send({
    content: `🚨 **Yeni Satın Alma Talebi!** <@${ticket.userId}> kullanıcısı **${packageName}** paketini satın almak istiyor. Lütfen ilgilenin: ${managerPing}`
  });

  await interaction.reply({ content: "✅ Paket seçiminiz iletildi. Yöneticimiz kanala çağrıldı.", ephemeral: true });

  // Inform user in DM
  const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
  if (user) {
    const alertEmbed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle("⏳ Aktarım Başlatıldı")
      .setDescription("💬 **Üst düzey yöneticiye aktarılıyorsunuz...** Lütfen bekleyin. Yönetici sohbete katıldığında bir bildirim alacaksınız.")
      .setTimestamp();
    await user.send({ embeds: [alertEmbed] }).catch(() => {});
  }
}

/**
 * Toggles advertising ticket pause state
 */
async function toggleReklamPause(interaction, ticketId) {
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    return interaction.reply({ content: "❌ Reklam talebi bulunamadı.", ephemeral: true });
  }

  ticket.paused = !ticket.paused;
  await ticket.save();

  const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);

  if (ticket.paused) {
    await interaction.reply({ content: "⏸️ **Reklam talebi duraklatıldı.** DM mesaj iletimi geçici olarak kapatıldı." });
    if (user) {
      await user.send("⏸️ **Reklam talebiniz duraklatıldı.** Yetkililer sohbete devam edene kadar mesaj iletimi askıya alınmıştır.").catch(() => {});
    }
  } else {
    await interaction.reply({ content: "▶️ **Reklam talebi devam ettiriliyor.** DM mesaj iletimi tekrar açıldı." });
    if (user) {
      await user.send("▶️ **Reklam talebiniz tekrar aktifleştirildi.** Mesajlarınızı buradan yazmaya devam edebilirsiniz.").catch(() => {});
    }
  }
}

const activeTicketClaims = new Map();

/**
 * Finds online active staff members in the server. Falls back to offline if none online.
 */
async function findActiveOnlineStaff(guild, client) {
  const StaffProgress = require('../../models/StaffProgress');
  const activeStaffDocs = await StaffProgress.find({ status: 'active' });
  if (!activeStaffDocs || activeStaffDocs.length === 0) return [];

  // Shuffle docs
  const shuffledDocs = activeStaffDocs.sort(() => Math.random() - 0.5);

  const onlineStaff = [];
  const { hasInactivityRole } = require('./staffSystem');

  for (const doc of shuffledDocs) {
    // Check if on leave today
    const todayStr = new Date().toISOString().slice(0, 10);
    const isLeave = doc.leaves?.usedDays && doc.leaves.usedDays.includes(todayStr);
    if (isLeave) continue;

    const member = await guild.members.fetch(doc.userId).catch(() => null);
    if (!member || member.user.bot) continue;

    // Check inactivity roles
    const inactive = await hasInactivityRole(member.id, client).catch(() => false);
    if (inactive) continue;

    const presenceStatus = member.presence?.status;
    if (presenceStatus && presenceStatus !== 'offline') {
      onlineStaff.push(member);
    }
  }

  return onlineStaff;
}

/**
 * Sends a notification to the moderator channel that no active staff is online/available.
 */
async function handleNoActiveStaffAvailable(ticketId, guildId, channelId, client) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (guild) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel) {
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
      const embed = new EmbedBuilder()
        .setTitle("⚠️ Aktif Personel Bulunamadı")
        .setDescription("Şu anda aktif bir mod yok.. Aktif bir mod gelene kadar bekleyin...")
        .setColor(0xe74c3c)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_ticket_${ticketId}`)
          .setLabel("🙋‍♂️ Üstlen")
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
  }
}

/**
 * Clears timeout and deletes the last sent DM message to active staff
 */
async function deleteActiveClaimDmMessage(ticketId) {
  const claimInfo = activeTicketClaims.get(ticketId);
  if (claimInfo) {
    if (claimInfo.timeoutId) {
      clearTimeout(claimInfo.timeoutId);
      claimInfo.timeoutId = null;
    }
    if (claimInfo.lastDmMessage) {
      await claimInfo.lastDmMessage.delete().catch(() => {});
      claimInfo.lastDmMessage = null;
    }
  }
}

/**
 * Starts claim routing process for a ticket
 */
async function startTicketClaimRouting(ticket, guild, client) {
  const staffMembers = await findActiveOnlineStaff(guild, client);
  if (!staffMembers || staffMembers.length === 0) {
    console.log(`[ClaimRouting] No active staff members found for ticket ${ticket.ticketId}`);
    await handleNoActiveStaffAvailable(ticket.ticketId, guild.id, ticket.channelId, client);
    return;
  }

  const staffIds = staffMembers.map(m => m.id);
  activeTicketClaims.set(ticket.ticketId, {
    staffList: staffIds,
    currentIndex: 0,
    guildId: guild.id,
    channelId: ticket.channelId,
    lastDmMessage: null,
    timeoutId: null
  });

  await routeNextClaimRequest(ticket.ticketId, client);
}

/**
 * Route claim request to the next staff member in list
 */
async function routeNextClaimRequest(ticketId, client) {
  const claimInfo = activeTicketClaims.get(ticketId);
  if (!claimInfo) return;

  // Clear previous timeout and message if any
  if (claimInfo.timeoutId) {
    clearTimeout(claimInfo.timeoutId);
    claimInfo.timeoutId = null;
  }
  if (claimInfo.lastDmMessage) {
    await claimInfo.lastDmMessage.delete().catch(() => {});
    claimInfo.lastDmMessage = null;
  }

  const { staffList, currentIndex, guildId, channelId } = claimInfo;
  if (currentIndex >= staffList.length) {
    console.log(`[ClaimRouting] All staff members rejected or ignored ticket ${ticketId}`);
    activeTicketClaims.delete(ticketId);
    await handleNoActiveStaffAvailable(ticketId, guildId, channelId, client);
    return;
  }

  const currentStaffId = staffList[currentIndex];
  claimInfo.currentIndex++; // Advance for next attempt

  const user = await client.users.fetch(currentStaffId).catch(() => null);
  if (!user) {
    return routeNextClaimRequest(ticketId, client);
  }

  try {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Yeni Destek Talebi Bildirimi")
      .setDescription(
        `Eko Yıldız sunucusunda **${ticketId}** numaralı yeni bir destek talebi oluşturuldu.\n\n` +
        `Bu ticket'ı üstlenmek ister misiniz?\n\n` +
        `*Kabul ederseniz ticket'a bakmakla görevlendirileceksiniz. Reddederseniz sıradaki diğer yetkiliye iletilecektir.*\n\n` +
        `⏳ **Yanıtlama Süresi:** 5 dakika`
      )
      .setColor(0x3498DB)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`staff_claim_accept_${ticketId}_${currentStaffId}`)
        .setLabel("Kabul Et")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`staff_claim_reject_${ticketId}_${currentStaffId}`)
        .setLabel("Reddet")
        .setStyle(ButtonStyle.Danger)
    );

    const sentMsg = await user.send({ embeds: [embed], components: [row] });
    console.log(`[ClaimRouting] Sent claim request to ${user.tag} for ticket ${ticketId}`);

    claimInfo.lastDmMessage = sentMsg;

    // Set 5 minutes timeout to auto-ignore
    claimInfo.timeoutId = setTimeout(async () => {
      console.log(`[ClaimRouting] Staff member ${user.tag} ignored claim request for 5 minutes.`);
      await sentMsg.delete().catch(() => {});
      claimInfo.timeoutId = null;
      claimInfo.lastDmMessage = null;
      await routeNextClaimRequest(ticketId, client);
    }, 5 * 60 * 1000);

  } catch (err) {
    console.warn(`[ClaimRouting] Could not DM staff member ${user.tag}:`, err.message);
    return routeNextClaimRequest(ticketId, client);
  }
}

module.exports = {
  handleReklamModalSubmit,
  handleReklamConfirm,
  forwardDMToReklamChannel,
  forwardReklamChannelToDM,
  sendReklamPrices,
  triggerPurchaseSelection,
  handlePurchaseSelection,
  toggleReklamPause,
  findActiveOnlineStaff,
  startTicketClaimRouting,
  routeNextClaimRequest,
  deleteActiveClaimDmMessage,
  activeTicketClaims
};
