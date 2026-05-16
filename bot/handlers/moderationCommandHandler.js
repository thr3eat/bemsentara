const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { deferEphemeral } = require("../utils/interaction");

async function handleModerationCommand(interaction) {
  if (!interaction.isChatInputCommand()) return null;
  const { commandName } = interaction;

  if (!["mesaj_sil", "sustur", "susturma_kaldir", "yasakla", "yasaklama_kaldir"].includes(commandName)) return null;

  await interaction.deferReply(deferEphemeral());

  try {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply({ content: "❌ Mesaj Yöneticisi izni gerekli" });
    }

    if (commandName === "mesaj_sil") {
      const miktar = interaction.options.getNumber("miktar");

      if (miktar < 1 || miktar > 100) {
        return interaction.editReply({ content: "❌ 1-100 arasında bir sayı girin" });
      }

      await interaction.channel.bulkDelete(miktar);

      const embed = new EmbedBuilder()
        .setTitle("✅ Mesajlar Silindi")
        .setColor(0xed4245)
        .setDescription(`${miktar} mesaj başarıyla silindi.`)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "sustur") {
      const kullanici = interaction.options.getUser("kullanici");
      const sure = interaction.options.getString("sure");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";

      const member = await interaction.guild.members.fetch(kullanici.id).catch(() => null);
      if (!member) {
        return interaction.editReply({ content: "❌ Kullanıcı sunucuda bulunamadı" });
      }

      const duration = parseDuration(sure || "10m");
      await member.timeout(duration, `Sebep: ${sebep}`);

      const embed = new EmbedBuilder()
        .setTitle("🔇 Kullanıcı Susturuldu")
        .setColor(0xed4245)
        .addFields(
          { name: "Kullanıcı", value: kullanici.toString(), inline: false },
          { name: "Süre", value: sure || "10 dakika", inline: true },
          { name: "Sebep", value: sebep, inline: true }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "susturma_kaldir") {
      const kullanici = interaction.options.getUser("kullanici");
      const member = await interaction.guild.members.fetch(kullanici.id).catch(() => null);

      if (!member) {
        return interaction.editReply({ content: "❌ Kullanıcı sunucuda bulunamadı" });
      }

      await member.timeout(null);

      const embed = new EmbedBuilder()
        .setTitle("🔊 Susturma Kaldırıldı")
        .setColor(0x4ade80)
        .setDescription(`${kullanici} kullanıcısının susturması kaldırıldı.`)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "yasakla") {
      const kullanici = interaction.options.getUser("kullanici");
      const sebep = interaction.options.getString("sebep") || "Belirtilmedi";

      try {
        await interaction.guild.members.ban(kullanici.id, { reason: sebep });

        const embed = new EmbedBuilder()
          .setTitle("🚫 Kullanıcı Yasaklandı")
          .setColor(0xed4245)
          .addFields(
            { name: "Kullanıcı", value: kullanici.toString(), inline: false },
            { name: "Sebep", value: sebep, inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Yasaklama başarısız: ${err.message}` });
      }
    }

    if (commandName === "yasaklama_kaldir") {
      const kullanici = interaction.options.getUser("kullanici");

      try {
        await interaction.guild.bans.remove(kullanici.id);

        const embed = new EmbedBuilder()
          .setTitle("✅ Yasak Kaldırıldı")
          .setColor(0x4ade80)
          .setDescription(`${kullanici} kullanıcısının yasağı kaldırıldı.`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Yasak kaldırma başarısız: ${err.message}` });
      }
    }

    return null;
  } catch (err) {
    console.error(`[${commandName}] Hata:`, err);
    return interaction.editReply({ content: `❌ Hata: ${err.message}` });
  }
}

function parseDuration(timeStr) {
  const matches = timeStr.match(/(\d+)([smhd])/);
  if (!matches) return 10 * 60 * 1000;

  const value = parseInt(matches[1]);
  const unit = matches[2];

  const unitMap = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (unitMap[unit] || 1000);
}

module.exports = { handleModerationCommand };
