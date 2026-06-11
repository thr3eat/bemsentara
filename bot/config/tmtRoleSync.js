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
  enlisted: "1514582688114278460",        // ▬▬▬▬▬▬▬▬▬ OR-1 to OR-9
  officers: "1514582692036087818",        // ▬▬▬▬▬▬▬▬▬ OF-1/A to OF-1/C
  seniorOfficers: "1514582747056967772",  // ▬▬▬▬▬▬▬▬▬ OF-2 to OF-5
  generals: "1514582756510793928",        // ▬▬▬▬▬▬▬▬▬ OF-6 to OF-9 & Paşa
  management: "1514582673333420162",      // ▬▬▬▬▬▬▬▬▬ Management ranks
};

// ========== CATEGORY/TIER ROLES ==========
const CATEGORY_ROLES = {
  orduPersoneli: "1514582773136887858",           // Ordu Personeli
  orduSubayi: "1514582762093547560",             // Ordu Subayı
  kidemliorduSubayi: "1514582757420830850",      // Kıdemli Ordu Subayı
  orduGenerali: "1514582748394946591",           // Ordu Generali
  kidemliorduGenerali: "1514582739691638885",    // Kıdemli Ordu Generali
  orduYonetimi: "1514582649342132304",           // Ordu Yönetimi
  orduYönetimBaskanligi: "1514582648121593969",  // Ordu Yönetim Başkanlığı
  maresal: "1514582645051490415",                // OF-10 Mareşal
};

// ========== STATUS ROLES (Branch membership level) ==========
const STATUS_ROLES = {
  bransszPersonel: "1514582801343582279",        // Branşsız Personel
  bransliPersonel: "1514582802618646798",        // Branşlı Personel
  yetkliBransPersoneli: "1514582851579019454",   // Yetkili Branş Personeli
};

// ========== SPECIFIC RANK ROLES ==========
const RANK_ROLES = {
  "OR-1/A": "1514582788383440896",
  "OR-1/B": "1514582787393454141",
  "OR-1/C": "1514582786240020583",
  "OR-2": "1514582785485045810",
  "OR-3": "1514582784348520478",
  "OR-4": "1514582782959947898",
  "OR-5": "1514582781618028594",
  "OR-6": "1514582779390726255",
  "OR-7": "1514582778518441994",
  "OR-8": "1514582777381650462",
  "OR-9": "1514582776249061487",
  "OF-1/A": "1514582766875054223",
  "OF-1/B": "1514582765746782328",
  "OF-1/C": "1514582764664389693",
  "OF-2": "1514582763284729996",
  "OF-3": "1514582759970967744",
  "OF-4": "1514582759253741638",
  "OF-5": "1514582758364676177",
  "OF-6": "1514582753679773837",
  "OF-7": "1514582752345723121",
  "OF-8": "1514582750915727461",
  "OF-9": "1514582749850239167",
  "Paşa": "1514582755512553522",
  "Askeri İnzibat Lideri": "1514582714664095878",
  "Jandarma Lideri": "1514582715649888256",
  "Sınır Müfettişleri Lideri": "1514582713732956252",
  "Hava Kuvvetleri Lideri": "1514582712852283502",
  "Özel Kuvvetler Lideri": "1514582712021815346",
  "Kara Kuvvetleri Lideri": "1514582710713057300",
  "Yüksek Askerî Şûra": "1514582741772013588",
  "Yönetim Kurulu": "1514582653322661959",
  "Yönetim Kurulu Başkan Y.": "1514582652433465474",
  "Yönetim Kurulu Başkanı": "1514582651544010752",
  "Geliştirme Ofisi": "1514582740496814172",
  "OF-10 Mareşal": "1514582645051490415",
  "Emekli Personel": "1514582769857069147",
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
  180: {  // Askeri İnzibat Lideri (rank 180)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Askeri İnzibat Lideri"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Askeri İnzibat Lideri"
  },
  185: {  // Jandarma Lideri (rank 185)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Jandarma Lideri"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Jandarma Lideri"
  },
  190: {  // Sınır Müfettişleri Lideri (rank 190)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Sınır Müfettişleri Lideri"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Sınır Müfettişleri Lideri"
  },
  195: {  // Hava Kuvvetleri Lideri (rank 195)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Hava Kuvvetleri Lideri"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Hava Kuvvetleri Lideri"
  },
  196: {  // Özel Kuvvetler Lideri (rank 196)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Özel Kuvvetler Lideri"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Özel Kuvvetler Lideri"
  },
  200: {  // Kara Kuvvetleri Lideri (rank 200)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Kara Kuvvetleri Lideri"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Kara Kuvvetleri Lideri"
  },
  201: {  // Sınav Sorumlusu (rank 201)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.kidemliorduGenerali,
      RANK_ROLES["Sınav Sorumlusu"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Sınav Sorumlusu"
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
      RANK_ROLES["Yönetim Kurulu Başkan Y."],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Yönetim Kurulu Başkan Y."
  },
  252: {  // Yönetim Kurulu Başkanı (rank 252)
    discordRoleIds: [
      SEPARATOR_ROLES.management,
      CATEGORY_ROLES.orduYönetimBaskanligi,
      RANK_ROLES["Yönetim Kurulu Başkanı"],
      STATUS_ROLES.bransszPersonel,
    ],
    name: "Yönetim Kurulu Başkanı"
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
