const { EmbedBuilder } = require("discord.js");

async function handleFunCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;

  if (!["boom_ayarlar", "boom_oyunu", "kelime_oyunu_ayarlar", "kelime_oyunu", "oyunlar"].includes(commandName)) return null;

  const { deferEphemeral } = require("../utils/interaction");
  await interaction.deferReply(deferEphemeral());

  try {
    if (commandName === "boom_ayarlar") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "oyna") {
        const embed = new EmbedBuilder()
          .setTitle("💣 Boom Oyunu")
          .setColor(0xff6b6b)
          .setDescription("Boom oyununu başlatmak için `/boom_oyunu bahis` komutunu kullanın.")
          .addFields({ name: "Kurallar", value: "Sayı ne kadar yüksekse, kazanç o kadar fazla. Ama patla!" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "kurallar") {
        const embed = new EmbedBuilder()
          .setTitle("📋 Boom Oyunu Kuralları")
          .setColor(0xff6b6b)
          .addFields(
            { name: "Amaç", value: "Sayı ne kadar yüksekse, o kadar para kazanırsın.", inline: false },
            { name: "Risk", value: "Herhangi bir anında patlamak mümkün! Zamanında çık!", inline: false },
            { name: "Çıkış", value: "Kazanç için zamanında çıkış yap. Yoksa hepsini kaybeder!", inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "boom_oyunu") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "bahis") {
        const miktar = interaction.options.getNumber("miktar");

        const multiplier = Math.random() * 3 + 1;
        const kazanc = Math.floor(miktar * multiplier);
        const patla = Math.random() < 0.3;

        if (patla) {
          const embed = new EmbedBuilder()
            .setTitle("💥 PATLADI!")
            .setColor(0xed4245)
            .setDescription(`Çok yaklaştı ama patladı! Tüm parani kaybettin.`)
            .setTimestamp();

          return interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
          .setTitle("🎉 Kazandın!")
          .setColor(0x4ade80)
          .addFields(
            { name: "Bahis", value: `₺${miktar}`, inline: true },
            { name: "Çarpan", value: `${multiplier.toFixed(2)}x`, inline: true },
            { name: "Kazanç", value: `₺${kazanc}`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "kelime_oyunu_ayarlar") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "dil_sec") {
        const dil = interaction.options.getString("dil");
        const dilAdı = dil === "tr" ? "Türkçe" : "İngilizce";

        const embed = new EmbedBuilder()
          .setTitle("✅ Dil Ayarlandı")
          .setColor(0x4ade80)
          .setDescription(`Bu kanal için ${dilAdı} seçildi.`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "kelime_oyunu") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "oyna") {
        const kelimeler = ["KAPTAN", "BILGISAYAR", "İNSAN", "OYUN", "SAVAŞ"];
        const rastgeleKelime = kelimeler[Math.floor(Math.random() * kelimeler.length)];

        const embed = new EmbedBuilder()
          .setTitle("🔤 Kelime Oyunu")
          .setColor(0x4ecdc4)
          .addFields(
            { name: "Bulacağın Kelime", value: "_".repeat(rastgeleKelime.length), inline: false },
            { name: "İpucu", value: `${rastgeleKelime.length} harfli bir kelime...`, inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "puan") {
        const embed = new EmbedBuilder()
          .setTitle("📊 Kelime Oyunu Puanı")
          .setColor(0x4ecdc4)
          .addFields(
            { name: "Oynanan Oyun", value: "5", inline: true },
            { name: "Kazanılan Oyun", value: "3", inline: true },
            { name: "Toplam Puan", value: "1250", inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (commandName === "oyunlar") {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "zar_at") {
        const bahis = interaction.options.getNumber("bahis");
        const zarSonuc = Math.floor(Math.random() * 6) + 1;
        const oyuncuZarı = Math.floor(Math.random() * 6) + 1;

        const kazandi = oyuncuZarı > zarSonuc;
        const kazanc = kazandi ? Math.floor(bahis * 1.5) : -bahis;

        const embed = new EmbedBuilder()
          .setTitle(kazandi ? "🎲 Kazandın!" : "💔 Kaybettin!")
          .setColor(kazandi ? 0x4ade80 : 0xed4245)
          .addFields(
            { name: "Bot Zarı", value: zarSonuc.toString(), inline: true },
            { name: "Senin Zarı", value: oyuncuZarı.toString(), inline: true },
            { name: "Sonuç", value: `${kazandi ? "+" : ""}${kazanc}₺`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === "yazı_tura") {
        const bahis = interaction.options.getNumber("bahis");
        const botSecim = Math.random() < 0.5 ? "Yazı" : "Tura";
        const oyuncuSecim = Math.random() < 0.5 ? "Yazı" : "Tura";

        const kazandi = botSecim === oyuncuSecim;
        const kazanc = kazandi ? bahis : -bahis;

        const embed = new EmbedBuilder()
          .setTitle(kazandi ? "🎉 Kazandın!" : "😢 Kaybettin!")
          .setColor(kazandi ? 0x4ade80 : 0xed4245)
          .addFields(
            { name: "Bot", value: botSecim, inline: true },
            { name: "Sen", value: oyuncuSecim, inline: true },
            { name: "Sonuç", value: `${kazandi ? "+" : ""}${kazanc}₺`, inline: true }
          )
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

module.exports = { handleFunCommand };
