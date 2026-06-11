/**
 * TMT Branch Groups Configuration
 * Syncs Discord roles with branch-specific Roblox groups
 */

// Branch group IDs and their corresponding Discord roles
const TMT_BRANCH_GROUPS = {
  35432150: {  // TMT Hudut Müfettişleri (Border Inspectors)
    name: "Hudut Müfettişleri",
    discordRoleId: "1514582843433685103", // Sınır Müfettişleri
    discordBranchRoleId: "1514582844373205053", // Sınır Müfettişleri Branş Yetkilisi
    discordRoleName: "Sınır Müfettişleri",
    discordBranchRoleName: "Sınır Müfettişleri Branş Yetkilisi",
  },
  33709391: {  // TMT Hava Kuvvetleri (Air Force)
    name: "Hava Kuvvetleri",
    discordRoleId: "1514582818511130655", // Hava Kuvvetleri Komutanlığı
    discordBranchRoleId: "1514582819458777117", // Hava Kuvvetleri Branş Yetkilisi
    discordRoleName: "Hava Kuvvetleri Komutanlığı",
    discordBranchRoleName: "Hava Kuvvetleri Branş Yetkilisi",
  },
  12008462: {  // TMT Jandarma (Gendarmerie)
    name: "Jandarma",
    discordRoleId: "1514582837263859782", // Jandarma
    discordBranchRoleId: "1514582838404714676", // Jandarma Branş Yetkilisi
    discordRoleName: "Jandarma",
    discordBranchRoleName: "Jandarma Branş Yetkilisi",
  },
  33708598: {  // TMT Özel Kuvvetler Komutanlığı (Special Forces)
    name: "Özel Kuvvetler",
    discordRoleId: "1514582810680229989", // Özel Kuvvetler Komutanlığı
    discordBranchRoleId: "1514582811850444870", // Özel Kuvvetler Branş Yetkilisi
    discordRoleName: "Özel Kuvvetler Komutanlığı",
    discordBranchRoleName: "Özel Kuvvetler Branş Yetkilisi",
  },
  33714381: {  // TMT Kara Kuvvetleri Komutanlığı (Land Forces)
    name: "Kara Kuvvetleri",
    discordRoleId: "1514582826723446906", // Kara Kuvvetleri Komutanlığı
    discordBranchRoleId: "1514582827751178311", // Kara Kuvvetleri Branş Yetkilisi
    discordRoleName: "Kara Kuvvetleri Komutanlığı",
    discordBranchRoleName: "Kara Kuvvetleri Branş Yetkilisi",
  },
  33709461: {  // TMT Askeri İnzibat (Military Police)
    name: "Askeri İnzibat",
    discordRoleId: "1514582806053781624", // Askeri İnzibat
    discordBranchRoleId: "1514582807458877571", // Askeri İnzibat Branş Yetkilisi
    discordRoleName: "Askeri İnzibat",
    discordBranchRoleName: "Askeri İnzibat Branş Yetkilisi",
  },
  35528556: {  // TMT Sürücü Okulu (Driver School)
    name: "Sürücü Okulu",
    discordRoleId: null,
    discordBranchRoleId: null,
    discordRoleName: "Sürücü Okulu",
    discordBranchRoleName: "Sürücü Okulu Yetkilisi",
  },
  35528574: {  // TMT Foreign Affairs (Dışişleri Bakanlığı)
    name: "Dışişleri Bakanlığı",
    discordRoleId: null,
    discordBranchRoleId: null,
    discordRoleName: "Dışişleri Bakanlığı",
    discordBranchRoleName: "Dışişleri Yetkilisi",
  },
  35212138: {  // TMT Akademi (Academy)
    name: "Akademi",
    discordRoleId: null,
    discordBranchRoleId: null,
    discordRoleName: "Akademi",
    discordBranchRoleName: "Akademi Yetkilisi",
  },
  35212127: {  // TMT Genel Branş Komutanlığı
    name: "Genel Branş Komutanlığı",
    discordRoleId: null,
    discordBranchRoleId: null,
    discordRoleName: "Genel Branş Komutanlığı",
    discordBranchRoleName: "Genel Branş Yetkilisi",
  },
  35528598: {  // TMT Raiders
    name: "RAIDERS",
    discordRoleId: null,
    discordBranchRoleId: null,
    discordRoleName: "Raiders",
    discordBranchRoleName: "Raiders Yetkilisi",
  },
};

// Map branch-specific ranks to role levels (for branch authority roles)
// If a user has rank >= these thresholds in their branch group, they get the branch authority role
const BRANCH_AUTHORITY_THRESHOLDS = {
  35432150: 25,  // Hudut Müfettişleri - Need rank 100+ to get Branş Yetkilisi role
  33709391: 25,  // Hava Kuvvetleri
  12008462: 25,  // Jandarma
  33708598: 25,  // Özel Kuvvetler
  33714381: 25,  // Kara Kuvvetleri
  33709461: 25,  // Askeri İnzibat
  35528556: 25,  // Sürücü Okulu
  35528574: 25,  // Foreign Affairs
  35212138: 25,  // Akademi
  35212127: 25,  // Genel Branş Komutanlığı
  35528598: 25,  // Raiders
};

// All branch role IDs for cleanup
const ALL_BRANCH_ROLE_IDS = new Set([
  "1514582843433685103", // Sınır Müfettişleri
  "1514582844373205053", // Sınır Müfettişleri Branş Yetkilisi
  "1514582818511130655", // Hava Kuvvetleri Komutanlığı
  "1514582819458777117", // Hava Kuvvetleri Branş Yetkilisi
  "1514582837263859782", // Jandarma
  "1514582838404714676", // Jandarma Branş Yetkilisi
  "1514582810680229989", // Özel Kuvvetler Komutanlığı
  "1514582811850444870", // Özel Kuvvetler Branş Yetkilisi
  "1514582826723446906", // Kara Kuvvetleri Komutanlığı
  "1514582827751178311", // Kara Kuvvetleri Branş Yetkilisi
  "1514582806053781624", // Askeri İnzibat
  "1514582807458877571", // Askeri İnzibat Branş Yetkilisi
]);

module.exports = {
  TMT_BRANCH_GROUPS,
  BRANCH_AUTHORITY_THRESHOLDS,
  ALL_BRANCH_ROLE_IDS,
};
