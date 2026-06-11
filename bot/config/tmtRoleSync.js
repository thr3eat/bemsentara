/**
 * TMT Server Role Sync Configuration
 * Syncs Discord roles with Roblox group 11517908 military ranks
 * 
 * STRUCTURE: Separator → Category → Specific Rank → Status → Branch Roles
 * TODO: Replace placeholder role IDs with actual Discord role IDs from your server
 */

const TMT_GUILD_ID = "1514569307886063666";

// ========== SEPARATOR ROLES (Visual dividers for each tier) ==========
const SEPARATOR_ROLES = {
  enlisted: "1514582899000000001",        // ▬▬▬▬▬▬▬▬▬▬▬▬▬ OR-1 to OR-9
  officers: "1514582899000000002",        // ▬▬▬▬▬▬▬▬▬▬▬▬▬ OF-1/A to OF-1/C
  seniorOfficers: "1514582899000000003",  // ▬▬▬▬▬▬▬▬▬▬▬▬▬ OF-2 to OF-5
  generals: "1514582899000000004",        // ▬▬▬▬▬▬▬▬▬▬▬▬▬ OF-6 to OF-9 & Paşa
  management: "1514582899000000005",      // ▬▬▬▬▬▬▬▬▬▬▬▬▬ Management ranks
};

// ========== CATEGORY/TIER ROLES ==========
const CATEGORY_ROLES = {
  orduPersoneli: "1514582898000000001",           // Ordu Personeli
  orduSubayi: "1514582898000000002",             // Ordu Subayı
  kidemliorduSubayi: "1514582898000000003",      // Kıdemli Ordu Subayı
  orduGenerali: "1514582898000000004",           // Ordu Generali
  kidemliorduGenerali: "1514582898000000005",    // Kıdemli Ordu Generali
  orduYonetimi: "1514582898000000006",           // Ordu Yönetimi
  orduYönetimBaskanligi: "1514582898000000007",  // Ordu Yönetim Başkanlığı
  maresal: "1514582898000000008",                // OF-10 Mareşal
};

// ========== STATUS ROLES (Branch membership level) ==========
const STATUS_ROLES = {
  bransszPersonel: "1514582897000000001",        // Branşsız Personel
  bransliPersonel: "1514582897000000002",        // Branşlı Personel
  yetkliBransPersoneli: "1514582897000000003",   // Yetkili Branş Personeli
};

// ========== SPECIFIC RANK ROLES ==========
const RANK_ROLES = {
  "OR-1/A": "1514582896100000001",
  "OR-1/B": "1514582896100000002",
  "OR-1/C": "1514582896100000003",
  "OR-2": "1514582896100000004",
  "OR-3": "1514582896100000005",
  "OR-4": "1514582896100000006",
  "OR-5": "1514582896100000007",
  "OR-6": "1514582896100000008",
  "OR-7": "1514582896100000009",
  "OR-8": "1514582896100000010",
  "OR-9": "1514582896100000011",
  "OF-1/A": "1514582896200000001",
  "OF-1/B": "1514582896200000002",
  "OF-1/C": "1514582896200000003",
  "OF-2": "1514582896200000004",
  "OF-3": "1514582896200000005",
  "OF-4": "1514582896200000006",
  "OF-5": "1514582896200000007",
  "OF-6": "1514582896200000008",
  "OF-7": "1514582896200000009",
  "OF-8": "1514582896200000010",
  "OF-9": "1514582896200000011",
  "Paşa": "1514582896200000012",
  "Konsey": "1514582896300000001",
  "Ankara Heyeti": "1514582896300000002",
  "Başkumandan": "1514582896300000003",
  "Askeri Kurultay": "1514582896300000004",
  "Disiplin Kurulu": "1514582896300000005",
  "Lider": "1514582896300000006",
  "Genelkurmay": "1514582896300000007",
  "Genelkurmay Başkanı": "1514582896300000008",
  "Yüksek Askerî Şûra": "1514582896300000009",
  "Yönetim Kurulu": "1514582896300000010",
  "YK Başkan Yardımcısı": "1514582896300000011",
  "YK Başkanı": "1514582896300000012",
  "Geliştirme Ofisi": "1514582896300000013",
  "Holder": "1514582896300000014",
  "OF-10 Mareşal": "1514582896300000015",
  "Emekli Personel": "1514582896300000016",
};

// ========== ROLE MAPPINGS (Rank → Discord Roles) ==========
// Structure: [Separator, Category, Specific Rank, Status, Branch Roles will be added]
const TMT_ROLE_MAPPINGS = {
  // Enlisted (OR ranks) - Ordu Personeli
  5: {  // OR-1/A Acemi Er (rank 5)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-1/A"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-1/A Acemi Er"
  },
  6: {  // OR-1/B Er (rank 6)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-1/B"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-1/B Er"
  },
  10: {  // OR-1/C Sözleşmeli Er (rank 10)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-1/C"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-1/C Er"
  },
  20: {  // OR-2 Onbaşı (rank 20)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-2"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-2 Onbaşı"
  },
  25: {  // OR-3 Çavuş (rank 25)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-3"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-3 Çavuş"
  },
  30: {  // OR-4 Uzman Onbaşı (rank 30)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-4"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-4 Uzman Onbaşı"
  },
  35: {  // OR-5 Uzman Çavuş (rank 35)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-5"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-5 Uzman Çavuş"
  },
  40: {  // OR-6 Astsubay Çavuş (rank 40)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-6"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-6 Astsubay"
  },
  50: {  // OR-7 Astsubay Üstçavuş (rank 50)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-7"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-7 Astsubay"
  },
  60: {  // OR-8 Astsubay Başçavuş (rank 60)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-8"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-8 Astsubay"
  },
  65: {  // OR-9/A Astsubay Kıdemli Başçavuş (rank 65)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["OR-9"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OR-9 Astsubay"
  },

  // Emekli Personel
  75: {  // Emekli Personel (rank 75)
    discordRoleIds: [
      SEPARATOR_ROLES.enlisted,
      CATEGORY_ROLES.orduPersoneli,
      RANK_ROLES["Emekli Personel"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Emekli Personel"
  },

  // Officers (OF-1/A to OF-1/C) - Ordu Subayı
  80: {  // OF-1/A Asteğmen (rank 80)
    discordRoleIds: [
      SEPARATOR_ROLES.officers,
      CATEGORY_ROLES.orduSubayi,
      RANK_ROLES["OF-1/A"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-1/A Asteğmen"
  },
  85: {  // OF-1/B Teğmen (rank 85)
    discordRoleIds: [
      SEPARATOR_ROLES.officers,
      CATEGORY_ROLES.orduSubayi,
      RANK_ROLES["OF-1/B"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-1/B Teğmen"
  },
  90: {  // OF-1/C Üsteğmen (rank 90)
    discordRoleIds: [
      SEPARATOR_ROLES.officers,
      CATEGORY_ROLES.orduSubayi,
      RANK_ROLES["OF-1/C"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-1/C Üsteğmen"
  },

  // Senior Officers (OF-2 to OF-5) - Kıdemli Ordu Subayı
  95: {  // OF-2 Yüzbaşı (rank 95)
    discordRoleIds: [
      SEPARATOR_ROLES.seniorOfficers,
      CATEGORY_ROLES.kidemliorduSubayi,
      RANK_ROLES["OF-2"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-2 Yüzbaşı"
  },
  100: {  // OF-3 Binbaşı (rank 100)
    discordRoleIds: [
      SEPARATOR_ROLES.seniorOfficers,
      CATEGORY_ROLES.kidemliorduSubayi,
      RANK_ROLES["OF-3"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-3 Binbaşı"
  },
  105: {  // OF-4 Yarbay (rank 105)
    discordRoleIds: [
      SEPARATOR_ROLES.seniorOfficers,
      CATEGORY_ROLES.kidemliorduSubayi,
      RANK_ROLES["OF-4"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-4 Yarbay"
  },
  110: {  // OF-5 Albay (rank 110)
    discordRoleIds: [
      SEPARATOR_ROLES.generals,
      CATEGORY_ROLES.orduGenerali,
      RANK_ROLES["OF-5"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-5 Albay"
  },

  // Generals (OF-6 to OF-9 & Paşa) - Ordu Generali / Kıdemli Ordu Generali
  115: {  // OF-6 Tuğgeneral (rank 115)
    discordRoleIds: [
      SEPARATOR_ROLES.generals,
      CATEGORY_ROLES.orduGenerali,
      RANK_ROLES["OF-6"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-6 Tuğgeneral"
  },
  120: {  // OF-7 Tümgeneral (rank 120)
    discordRoleIds: [
      SEPARATOR_ROLES.generals,
      CATEGORY_ROLES.orduGenerali,
      RANK_ROLES["OF-7"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-7 Tümgeneral"
  },
  125: {  // OF-8 Korgeneral (rank 125)
    discordRoleIds: [
      SEPARATOR_ROLES.generals,
      CATEGORY_ROLES.orduGenerali,
      RANK_ROLES["OF-8"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-8 Korgeneral"
  },
  135: {  // OF-9 Orgeneral (rank 135)
    discordRoleIds: [
      SEPARATOR_ROLES.generals,
      CATEGORY_ROLES.orduGenerali,
      RANK_ROLES["OF-9"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-9 Orgeneral"
  },
  150: {  // Paşa (rank 150)
    discordRoleIds: [
      SEPARATOR_ROLES.generals,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Paşa"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Paşa"
  },
  // Management Ranks (150-252) - Kıdemli Ordu Generali / Ordu Yönetimi / Ordu Yönetim Başkanlığı
  180: {  // Konsey (rank 180)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Konsey"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Konsey"
  },
  185: {  // Ankara Heyeti (rank 185)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Ankara Heyeti"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Ankara Heyeti"
  },
  190: {  // Başkumandan (rank 190)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Başkumandan"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Başkumandan"
  },
  195: {  // Askeri Kurultay (rank 195)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Askeri Kurultay"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Askeri Kurultay"
  },
  196: {  // Disiplin Kurulu (rank 196)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Disiplin Kurulu"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Disiplin Kurulu"
  },
  200: {  // Lider (rank 200)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Lider"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Lider"
  },
  230: {  // Genelkurmay (rank 230)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Genelkurmay"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Genelkurmay"
  },
  235: {  // Genelkurmay Başkanı (rank 235)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Genelkurmay Başkanı"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Genelkurmay Başkanı"
  },
  240: {  // Yüksek Askerî Şûra (rank 240)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Yüksek Askerî Şûra"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Yüksek Askerî Şûra"
  },
  250: {  // Yönetim Kurulu (rank 250)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.orduYonetimi,
      RANK_ROLES["Yönetim Kurulu"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Yönetim Kurulu"
  },
  251: {  // Yönetim Kurulu Başkan Y. (rank 251)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.orduYönetimBaskanligi,
      RANK_ROLES["YK Başkan Yardımcısı"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "YK Başkan Yardımcısı"
  },
  252: {  // Yönetim Kurulu Başkanı (rank 252)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.orduYönetimBaskanligi,
      RANK_ROLES["YK Başkanı"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "YK Başkanı"
  },
  253: {  // Geliştirme Ofisi (rank 253)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.orduYönetimBaskanligi,
      RANK_ROLES["Geliştirme Ofisi"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Geliştirme Ofisi"
  },
  254: {  // Holder (rank 254)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.maresal,
      RANK_ROLES["Holder"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Holder"
  },
  255: {  // OF-10 Mareşal (rank 255)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.maresal,
      RANK_ROLES["OF-10 Mareşal"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "OF-10 Mareşal"
  },
};

// ========== ALL ROLE IDS FOR CLEANUP ==========
// Used to remove old roles when user rank changes
const ALL_TMT_ROLE_IDS = new Set([
  // Separator roles
  ...Object.values(SEPARATOR_ROLES),
  // Category roles
  ...Object.values(CATEGORY_ROLES),
  // Status roles
  ...Object.values(STATUS_ROLES),
  // Specific rank roles
  ...Object.values(RANK_ROLES),
  // Legacy roles (keep for backward compatibility)
  "1514582790639980635", // Askeri Personel (old)
  "1514582773136887858", // Ordu Personeli (old)
  "1514582768883990528", // Emekli Ordu Personeli (old)
  "1514582762093547560", // Ordu Subayı (old)
  "1514582757420830850", // Kıdemli Ordu Subayı (old)
  "1514582748394946591", // Ordu Generali (old)
  "1514582749850239167", // OF-9 Orgeneral (old)
  "1514582755512553522", // Paşa (old)
  "1514582742749417624", // Genelkurmay Başkanı (old)
  "1514582741772013588", // Yüksek Askerî Şûra (old)
  "1514582744708026468", // Genelkurmay (old)
  "1514582653322661959", // Yönetim Kurulu (old)
  "1514582652433465474", // YK Başkan Yardımcısı (old)
  "1514582651544010752", // YK Başkanı (old)
  "1514582740496814172", // Geliştirme Ofisi (old)
  "1514582645051490415", // OF-10 Mareşal (old)
]);

module.exports = {
  TMT_GUILD_ID,
  SEPARATOR_ROLES,
  CATEGORY_ROLES,
  STATUS_ROLES,
  RANK_ROLES,
  TMT_ROLE_MAPPINGS,
  ALL_TMT_ROLE_IDS,
};
