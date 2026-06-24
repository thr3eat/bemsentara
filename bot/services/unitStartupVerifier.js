'use strict';

const StaffUnit = require('../../models/StaffUnit');
const { EmbedBuilder } = require('discord.js');

const MAIN_GUILD_ID = '1466927911364726845';

const UNIT_CONFIG = {
  BAN_BIRIMI: { label: 'BAN BİRİMİ', color: '#e74c3c' },
  SES_BIRIMI: { label: 'SES BİRİMİ', color: '#3498db' },
  SOHBET_BIRIMI: { label: 'SOHBET BİRİMİ', color: '#2ecc71' }
};

/**
 * Bot restart'ta birime alınanların rollerini kontrol et ve eksikleri tamamla
 * BU FONKSİYON SADECE BİR KERE ÇALIŞTIRILACAK (bot restart'ta)
 */
async function verifyAllUnitRoles(client) {
  try {
    const guild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
    if (!guild) {
      console.warn('[unitStartupVerifier] Ana sunucu bulunamadı, rol doğrulaması atlanıyor');
      return;
    }

    console.log('[unitStartupVerifier] 🔍 Birim üyeleri rol doğrulaması başlanıyor...');

    // Tüm birim üyelerini bul
    const allMembers = await StaffUnit.find({ 
      unitName: { $in: ['BAN_BIRIMI', 'SES_BIRIMI', 'SOHBET_BIRIMI'] }
    });

    if (!allMembers || allMembers.length === 0) {
      console.log('[unitStartupVerifier] ✅ Birim üyesi bulunamadı, hiçbir şey yapılmıyor');
      return;
    }

    console.log(`[unitStartupVerifier] 📊 Toplam ${allMembers.length} birim üyesi kontrol ediliyor...`);

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const member of allMembers) {
      try {
        const guildMember = await guild.members.fetch(member.userId).catch(() => null);
        if (!guildMember) {
          console.warn(`[unitStartupVerifier] ⚠️ Üye sunucuda bulunamadı: ${member.userId}`);
          skippedCount++;
          continue;
        }

        const birimKey = member.unitName;
        const config = UNIT_CONFIG[birimKey];
        if (!config) {
          console.warn(`[unitStartupVerifier] ⚠️ Geçersiz birim: ${birimKey}`);
          skippedCount++;
          continue;
        }

        // Ana birim rolünü bul
        const mainRole = guild.roles.cache.find(r => r.name === config.label);
        if (!mainRole) {
          console.warn(`[unitStartupVerifier] ⚠️ Birim ana rolü bulunamadı: ${config.label}`);
          skippedCount++;
          continue;
        }

        // Rütbe rolünü bul (eğer varsa)
        let rankRole = null;
        if (member.rank) {
          const rankRoleName = `${config.label} - Rütbe ${member.rank}`;
          rankRole = guild.roles.cache.find(r => r.name === rankRoleName);
        }

        // Eksik rolleri kontrol et ve ekle
        let rolesAdded = false;

        if (!guildMember.roles.cache.has(mainRole.id)) {
          await guildMember.roles.add(mainRole).catch(err => {
            console.error(`[unitStartupVerifier] Ana rol ekleme hatası: ${err.message}`);
            throw err;
          });
          rolesAdded = true;
          console.log(`[unitStartupVerifier] ✅ Ana rol eklendi: ${guildMember.user.tag} → ${config.label}`);
        }

        if (rankRole && !guildMember.roles.cache.has(rankRole.id)) {
          await guildMember.roles.add(rankRole).catch(err => {
            console.error(`[unitStartupVerifier] Rütbe rolü ekleme hatası: ${err.message}`);
            throw err;
          });
          rolesAdded = true;
          console.log(`[unitStartupVerifier] ✅ Rütbe rolü eklendi: ${guildMember.user.tag} → Rütbe ${member.rank}`);
        }

        // Ban Birimi için Sezon 1 rütbe rollerini de kontrol et
        if (birimKey === 'BAN_BIRIMI' && member.rank) {
          try {
            const seasonRole = guild.roles.cache.find(r => 
              r.name === `[S1] Ban ${getSeason1RankName(member.rank)}`
            );
            
            if (seasonRole && !guildMember.roles.cache.has(seasonRole.id)) {
              await guildMember.roles.add(seasonRole).catch(() => {
                // Silent fail - sezon rolü olmayabilir
              });
              rolesAdded = true;
              console.log(`[unitStartupVerifier] ✅ Ban Birimi S1 rolü eklendi: ${guildMember.user.tag}`);
            }
          } catch (err) {
            // Ignore Ban Birimi role check errors
          }
        }

        if (rolesAdded) {
          fixedCount++;
          
          // DM ile bildir
          try {
            const embed = new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle('✅ Roller Güncellendi')
              .setDescription(
                `Merhaba ${guildMember.user.username}!\n\n` +
                `Bot yeniden başlatıldığında eksik olan rolleriniz otomatik olarak yeniden düzeltilmiştir.\n\n` +
                `**Birim:** ${config.label}\n` +
                `**Rütbe:** Rütbe ${member.rank || 1}`
              )
              .setFooter({ text: 'EkoYıldız Birim Sistemi - Otomatik Rol Düzeltme' })
              .setTimestamp();

            await guildMember.user.send({ embeds: [embed] }).catch(() => {
              // Silent fail - DM kapalı olabilir
            });
          } catch (err) {
            // Ignore DM errors
          }
        }

      } catch (err) {
        console.error(`[unitStartupVerifier] Üye işleme hatası (${member.userId}):`, err.message);
        errorCount++;
      }
    }

    console.log(`[unitStartupVerifier] ✅ Doğrulama tamamlandı: ${fixedCount} üyenin rolü düzeltildi, ${skippedCount} atlandı, ${errorCount} hata`);

  } catch (err) {
    console.error('[unitStartupVerifier] Kritik hata:', err.message);
  }
}

/**
 * Ban Birimi rütbe ismini döndür (S1 için)
 */
function getSeason1RankName(rank) {
  const names = {
    1: 'Kursiyeri',
    2: 'Stajer',
    3: 'Muhafiz',
    4: 'Gorevli',
    5: 'Infazci',
    6: 'Muafiz',
    7: 'Mufettisi',
    8: 'Sefi',
    9: 'Denetci',
    10: 'Komutani',
    11: 'Generali',
    12: 'Yargici',
    13: 'Engerek',
    14: 'Basyargic',
    15: 'Baronu'
  };
  return names[rank] || `Rutbe${rank}`;
}

module.exports = {
  verifyAllUnitRoles
};
