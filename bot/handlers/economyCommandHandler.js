const { EmbedBuilder } = require("discord.js");
const User = require("../../models/User");
const Economy = require("../../models/Economy");

async function handleEconomyCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;

  if (!["ekonomi", "gelir", "itemler"].includes(commandName)) return null;

  await interaction.deferReply({ ephemeral: true });

  try {
    let userEco = await Economy.findOne({ userId: interaction.user.id });
    if (!userEco) {
      userEco = new Economy({ userId: interaction.user.id });
      await userEco.save();
    }

    if (commandName === "ekonomi") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "bakiye") {
        const embed = new EmbedBuilder()
          .setTitle("💰 Bakiye")
          .setColor(0x4ade80)
          .addFields(
            { name: "Cüzdan", value: `₺${userEco.wallet}`, inline: true },
            { name: "Banka", value: `₺${userEco.bank}`, inline: true },
            { name: "Toplam", value: `₺${userEco.wallet + userEco.bank}`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "banka") {
        const embed = new EmbedBuilder()
          .setTitle("🏦 Banka Bilgileri")
          .setColor(0x7c6af7)
          .addFields(
            { name: "Banka Bakiyesi", value: `₺${userEco.bank}`, inline: true },
            { name: "Faiz Oranı", value: "2%/24h", inline: true },
            { name: "Toplam Faiz", value: `₺${Math.floor(userEco.bank * 0.02)}`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "para_gonder") {
        const targetUser = interaction.options.getUser("kullanici");
        const miktar = interaction.options.getNumber("miktar");

        if (miktar > userEco.wallet) {
          return interaction.editReply({ content: "❌ Yeterli para yok!" });
        }

        userEco.wallet -= miktar;
        await userEco.save();

        let targetEco = await Economy.findOne({ userId: targetUser.id });
        if (!targetEco) {
          targetEco = new Economy({ userId: targetUser.id });
        }
        targetEco.wallet += miktar;
        await targetEco.save();

        const embed = new EmbedBuilder()
          .setTitle("✅ Para Gönderildi")
          .setColor(0x4ade80)
          .addFields(
            { name: "Alıcı", value: targetUser.toString(), inline: false },
            { name: "Miktar", value: `₺${miktar}`, inline: true },
            { name: "Yeni Bakiyeniz", value: `₺${userEco.wallet}`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "gelir") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "kazanc") {
        const lastClaim = userEco.lastDailyClaimAt || 0;
        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000;

        if (now - lastClaim < cooldown) {
          const remaining = cooldown - (now - lastClaim);
          const hours = Math.floor(remaining / (60 * 60 * 1000));
          const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          return interaction.editReply({
            content: `❌ Günlük kazancınızı zaten aldınız. ${hours}s ${minutes}d sonra tekrar alabilirsiniz.`,
          });
        }

        const dailyReward = 1000;
        userEco.wallet += dailyReward;
        userEco.lastDailyClaimAt = now;
        await userEco.save();

        const embed = new EmbedBuilder()
          .setTitle("✅ Günlük Kazanç")
          .setColor(0x4ade80)
          .addFields(
            { name: "Kazanılan", value: `₺${dailyReward}`, inline: true },
            { name: "Yeni Bakiye", value: `₺${userEco.wallet}`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "rol_geliri") {
        const embed = new EmbedBuilder()
          .setTitle("🎖️ Rol Gelir Ayarları")
          .setColor(0x7c6af7)
          .addFields(
            { name: "Premium Rol", value: "₺500/gün", inline: true },
            { name: "VIP Rol", value: "₺250/gün", inline: true },
            { name: "Moderatör Rol", value: "₺100/gün", inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "itemler") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "listele") {
        const embed = new EmbedBuilder()
          .setTitle("🛍️ Mağaza")
          .setColor(0x7c6af7)
          .addFields(
            { name: "Gold Pass", value: "₺5000 - Tüm premium özellikleri aç", inline: false },
            { name: "Lucky Box", value: "₺1000 - Rastgele ödül al", inline: false },
            { name: "Boost Card", value: "₺500 - 1 saat para kazanç x2", inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "sat_al") {
        const urunAdi = interaction.options.getString("urun");
        const urunler = {
          "Gold Pass": 5000,
          "Lucky Box": 1000,
          "Boost Card": 500,
        };

        if (!urunler[urunAdi]) {
          return interaction.editReply({ content: "❌ Bu ürün mağazada yok!" });
        }

        const fiyat = urunler[urunAdi];

        if (userEco.wallet < fiyat) {
          return interaction.editReply({ content: `❌ Yeterli para yok! (Gerekli: ₺${fiyat})` });
        }

        userEco.wallet -= fiyat;
        userEco.inventory = userEco.inventory || [];
        userEco.inventory.push(urunAdi);
        await userEco.save();

        const embed = new EmbedBuilder()
          .setTitle("✅ Ürün Satın Alındı")
          .setColor(0x4ade80)
          .addFields(
            { name: "Ürün", value: urunAdi, inline: true },
            { name: "Fiyat", value: `₺${fiyat}`, inline: true },
            { name: "Yeni Bakiye", value: `₺${userEco.wallet}`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "envanterim") {
        const inventory = userEco.inventory || [];
        const itemList = inventory.length > 0 ? inventory.join("\n") : "Envanteriniz boş";

        const embed = new EmbedBuilder()
          .setTitle("📦 Envanteriniz")
          .setColor(0x7c6af7)
          .setDescription(itemList)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    return null;
  } catch (err) {
    console.error(`[${commandName}] Hata:`, err);
    return interaction.editReply({ content: `❌ Hata: ${err.message}` });
  }
}

module.exports = { handleEconomyCommand };
