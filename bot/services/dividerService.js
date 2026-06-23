'use strict';

// Divider roles and their corresponding sections (from highest to lowest position)
const SECTIONS = [
  {
    name: 'Section 1 (Status / Icon)',
    roles: ['1518690885754425496'], // ⚠️
    divider: '1518905482889134120'
  },
  {
    name: 'Section 2 (Locks & Keys)',
    roles: [
      '1518904642392690698', // 🔒
      '1518904809078526043', // 🔓
      '1518904890855002132', // 🔐
      '1518904858164334642', // 🔏
      '1518692383011897395', // 🔐
      '1518904902087217382', // 🗝️
      '1518904932902633633'  // 🔑
    ],
    divider: '1518905423133147246'
  },
  {
    name: 'Section 3 (Personal / Special)',
    roles: [
      '1518692384035311707', // O herkesin bildiği eko.🍃
      '1518724046622036130', // Çakma Texaslı
      '1467624865677971539', // 🧸 Moderatör Botu
      '1518697571105636505', // 🤖Eko'nun Şahsi Köleleri
      '1393405263759020084', // 🎵Müzisyen Bot
      '1437416343178838069', // Premium Dinazor
      '1437416359637155890', // Eko'nun Dostu
      '1437414467033108561', // Eko'nun Sevdiği Kişi
      '1518692384928567456'  // ⚓ Kaptan
    ],
    divider: '1518692385826013255'
  },
  {
    name: 'Section 4 (Management & Mod)',
    roles: [
      '1518692386836971610', // 🧸 Moderasyon
      '1518692387902328912', // Medya Ekibi
      '1518692389169135666'  // Moderatör Ekibi
    ],
    divider: '1518692390062526576'
  },
  {
    name: 'Section 5 (Staff & Personnel)',
    roles: [
      '1518692391312298045', // Genel Koordinatör
      '1518709348506013706', // Kıdemli Sekreter
      '1518692392415395971', // Sekreter
      '1518692393660973186', // Kıdemli Personel
      '1518692394495643830', // Personel
      '1518692395774906648'  // Stajyer Personel
    ],
    divider: '1518692397108957225'
  },
  {
    name: 'Section 6 (Level & Family)',
    roles: [
      '1518695643063910541', // 🦖 Kral Penguen
      '1518695656569438258', // 🤤EMPERYALİST DİNAZOR
      '1518692399017103552', // 👑 Baş Tacımız
      '1518692400409874543', // 🎥 İçerik Üreticisi
      '1518696013148197047', // 🌋 Volkanik Penguen
      '1518698914524561470', // 🚀 Hiper Penguen
      '1518701811450773575', // 🕶️ Havalı Penguen
      '1518703699936153621', // 🎮 Oyuncu Penguen
      '1518703700741329098', // 🌀 Garip Dinazor
      '1518703701793968139', // 😇 İyi Dinazor
      '1518703702205010183', // ⚡ Alpha Dinazor
      '1518703702947401938', // 🌪️ Kaos Dinazor
      '1518703703585198341', // 💥 Bela Dinazor
      '1518703704524718111', // 🔥 Olay Dinazor
      '1518703705338413086', // 😎 Havalı Dinazor
      '1409570876470329436', // 🎀 Takviyeci Dinazor
      '1518703706282135792', // 👹 Boss Dinazor
      '1518703707750006874', // 🧠 Zeki Dinazor
      '1518703706911019068', // 👑 Efsane Dinazor
      '1518909532129067068', // 👾Alfa Dinazor
      '1518707259633303814', // ⚡Ultra (ABONECİ) Dinazor
      '1518692401789796543', // 🦕  Uyanık Dinazor
      '1518692402884378825', // 🦖 Yavru Dinazor
      '1518692403467391178', // 🤖 Sunucu Köleleri
      '1518706437327556638', // Penguen Family
      '1518706437730078941'  // Dinazor Family
    ],
    divider: '1518707460515565578'
  },
  {
    name: 'Section 7 (Rules / Bans / Moderation)',
    roles: [
      '1518707673846251691', // adminizm
      '1518708137920823327', // modizm
      '1518707267632103576', // 🔐Medya Engeli
      '1518707609241129142'  // 🔑Sohbet Engeli
    ],
    divider: '1518692404775882924'
  },
  {
    name: 'Section 8 (Announcements)',
    roles: [
      '1518692405690237059', // Video Duyuru
      '1518692406730686617', // Yayın Duyuru
      '1518692408009949366'  // Çekiliş Duyuru
    ],
    divider: '1518692409079234811'
  },
  {
    name: 'Section 9 (Achievements / Bots)',
    roles: [
      '1394770962225955041', // MEE6
      '1410605460914180128', // carl-bot
      '1409571273859924018', // YouTube Stats
      '1410719863978070087', // FredBoat♪♪
      '1410723765309931543', // MatchBox
      '1417568707944779959', // Lofi Radio
      '1418607276822102121', // FreshTok
      '1418607697141563424', // NotifyMe
      '1418614264117071944', // News Alerts Bot
      '1418616342197698631', // Euler Stream
      '1418619178738385010', // Pingcord
      '1421487379138609216', // Gamechez
      '1437418955852484652', // Subscriber Checker
      '1460301076376064115', // Marpel
      '1460350907962360001', // Tickets v2
      '1460361014167081249', // OwO
      '1497739526154748135', // Sentura
      '1512450876869181653', // Sentara
      '1483071354986041509', // RoWifi
      '1493735064146542635', // Appy
      '1498042346447700009', // Sentura
      '1464698733286395967', // Rythm
      '1518694439114244161', // 📝 Roman Yazarı
      '1518867757389709353'  // 🌅 Sabah Kuşu
    ],
    divider: '1518708271844818974'
  }
];

/**
 * Enforces role dividers for a member based on their current roles.
 * @param {import('discord.js').GuildMember} member The member to process
 */
async function enforceRoleDividers(member) {
  if (!member || !member.roles) return;

  const currentRoleIds = member.roles.cache.map(r => r.id);
  const dividersToAdd = [];
  const dividersToRemove = [];

  const userHasRolesInSection = (section) => {
    return section.roles.some(rid => currentRoleIds.includes(rid));
  };

  for (let i = 0; i < SECTIONS.length; i++) {
    const section = SECTIONS[i];
    const dividerId = section.divider;

    // Check if user has at least one role in this section
    const hasRolesInSec = userHasRolesInSection(section);

    // Check if user has at least one role in any section strictly below this section
    let hasRolesBelow = false;
    for (let j = i + 1; j < SECTIONS.length; j++) {
      if (userHasRolesInSection(SECTIONS[j])) {
        hasRolesBelow = true;
        break;
      }
    }

    const shouldHaveDivider = hasRolesInSec && hasRolesBelow;
    const hasDivider = currentRoleIds.includes(dividerId);

    if (shouldHaveDivider && !hasDivider) {
      dividersToAdd.push(dividerId);
    } else if (!shouldHaveDivider && hasDivider) {
      dividersToRemove.push(dividerId);
    }
  }

  // Perform updates only if there are changes to make
  if (dividersToAdd.length > 0) {
    console.log(`[divider] Adding ${dividersToAdd.length} dividers to ${member.user.tag}`);
    await member.roles.add(dividersToAdd, 'Çizgi Rol Sistemi - Ekleme').catch(err => {
      console.warn(`[divider] Failed to add dividers to ${member.id}:`, err.message);
    });
  }
  
  if (dividersToRemove.length > 0) {
    console.log(`[divider] Removing ${dividersToRemove.length} dividers from ${member.user.tag}`);
    await member.roles.remove(dividersToRemove, 'Çizgi Rol Sistemi - Kaldırma').catch(err => {
      console.warn(`[divider] Failed to remove dividers from ${member.id}:`, err.message);
    });
  }
}

module.exports = {
  enforceRoleDividers,
  SECTIONS
};
