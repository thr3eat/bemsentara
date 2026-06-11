/**
 * TMT Server Role Sync Configuration
 * Syncs Discord roles with Roblox group 11517908 military ranks
 */

const TMT_GUILD_ID = "1514569307886063666";

// Map Roblox rank ranges to Discord roles
const TMT_ROLE_MAPPINGS = {
  // Enlisted (OR ranks) - Askeri Personel
  5: {  // OR-1/A Acemi Er (rank 5)
    discordRoleIds: ["1514582790639980635"], // Askeri Personel
    name: "OR-1/A Acemi Er"
  },
  6: {  // OR-1/B Er (rank 6)
    discordRoleIds: ["1514582790639980635"], // Askeri Personel
    name: "OR-1/B Er"
  },
  10: {  // OR-1/C Sözleşmeli Er (rank 10)
    discordRoleIds: ["1514582790639980635"], // Askeri Personel
    name: "OR-1/C Er"
  },
  20: {  // OR-2 Onbaşı (rank 20)
    discordRoleIds: ["1514582773136887858"], // Ordu Personeli
    name: "OR-2 Onbaşı"
  },
  25: {  // OR-3 Çavuş (rank 25)
    discordRoleIds: ["1514582773136887858"], // Ordu Personeli
    name: "OR-3 Çavuş"
  },
  30: {  // OR-4 Uzman Onbaşı (rank 30)
    discordRoleIds: ["1514582773136887858"], // Ordu Personeli
    name: "OR-4 Uzman Onbaşı"
  },
  35: {  // OR-5 Uzman Çavuş (rank 35)
    discordRoleIds: ["1514582773136887858"], // Ordu Personeli
    name: "OR-5 Uzman Çavuş"
  },
  40: {  // OR-6 Astsubay Çavuş (rank 40)
    discordRoleIds: ["1514582773136887858"], // Ordu Personeli
    name: "OR-6 Astsubay"
  },
  50: {  // OR-7 Astsubay Üstçavuş (rank 50)
    discordRoleIds: ["1514582773136887858"], // Ordu Personeli
    name: "OR-7 Astsubay"
  },
  60: {  // OR-8 Astsubay Başçavuş (rank 60)
    discordRoleIds: ["1514582773136887858"], // Ordu Personeli
    name: "OR-8 Astsubay"
  },
  65: {  // OR-9/A Astsubay Kıdemli Başçavuş (rank 65)
    discordRoleIds: ["1514582773136887858"], // Ordu Personeli
    name: "OR-9 Astsubay"
  },

  // Officers (OF ranks) - Ordu Subayı
  75: {  // Emekli Personel (rank 75)
    discordRoleIds: ["1514582768883990528"], // Emekli Ordu Personeli
    name: "Emekli Personel"
  },
  80: {  // OF-1/A Asteğmen (rank 80)
    discordRoleIds: ["1514582762093547560"], // Ordu Subayı
    name: "OF-1/A Asteğmen"
  },
  85: {  // OF-1/B Teğmen (rank 85)
    discordRoleIds: ["1514582762093547560"], // Ordu Subayı
    name: "OF-1/B Teğmen"
  },
  90: {  // OF-1/C Üsteğmen (rank 90)
    discordRoleIds: ["1514582762093547560"], // Ordu Subayı
    name: "OF-1/C Üsteğmen"
  },
  95: {  // OF-2 Yüzbaşı (rank 95)
    discordRoleIds: ["1514582757420830850"], // Kıdemli Ordu Subayı
    name: "OF-2 Yüzbaşı"
  },
  100: {  // OF-3 Binbaşı (rank 100)
    discordRoleIds: ["1514582757420830850"], // Kıdemli Ordu Subayı
    name: "OF-3 Binbaşı"
  },
  105: {  // OF-4 Yarbay (rank 105)
    discordRoleIds: ["1514582757420830850"], // Kıdemli Ordu Subayı
    name: "OF-4 Yarbay"
  },
  110: {  // OF-5 Albay (rank 110)
    discordRoleIds: ["1514582748394946591"], // Ordu Generali
    name: "OF-5 Albay"
  },
  115: {  // OF-6 Tuğgeneral (rank 115)
    discordRoleIds: ["1514582748394946591"], // Ordu Generali
    name: "OF-6 Tuğgeneral"
  },
  120: {  // OF-7 Tümgeneral (rank 120)
    discordRoleIds: ["1514582748394946591"], // Ordu Generali
    name: "OF-7 Tümgeneral"
  },
  125: {  // OF-8 Korgeneral (rank 125)
    discordRoleIds: ["1514582748394946591"], // Ordu Generali
    name: "OF-8 Korgeneral"
  },
  135: {  // OF-9 Orgeneral (rank 135)
    discordRoleIds: ["1514582748394946591"], // Ordu Generali
    name: "OF-9 Orgeneral"
  },
  150: {  // Paşa (rank 150)
    discordRoleIds: ["1514582748394946591", "1514582755512553522"], // Ordu Generali + Paşa
    name: "Paşa"
  },
  180: {  // Konsey (rank 180)
    discordRoleIds: ["1514582742749417624"], // Genelkurmay Başkanı
    name: "Konsey"
  },
  185: {  // Ankara Heyeti (rank 185)
    discordRoleIds: ["1514582742749417624"], // Genelkurmay Başkanı
    name: "Ankara Heyeti"
  },
  190: {  // Başkumandan (rank 190)
    discordRoleIds: ["1514582742749417624", "1514582651544010752"], // Genelkurmay + YK Başkanı
    name: "Başkumandan"
  },
  195: {  // Askeri Kurultay (rank 195)
    discordRoleIds: ["1514582741772013588"], // Yüksek Askerî Şûra
    name: "Askeri Kurultay"
  },
  196: {  // Disiplin Kurulu (rank 196)
    discordRoleIds: ["1514582741772013588"], // Yüksek Askerî Şûra
    name: "Disiplin Kurulu"
  },
  200: {  // Lider (rank 200)
    discordRoleIds: ["1514582651544010752"], // Yönetim Kurulu Başkanı
    name: "Lider"
  },
  230: {  // Genelkurmay (rank 230)
    discordRoleIds: ["1514582744708026468"], // Genelkurmay
    name: "Genelkurmay"
  },
  235: {  // Genelkurmay Başkanı (rank 235)
    discordRoleIds: ["1514582742749417624"], // Genelkurmay Başkanı
    name: "Genelkurmay Başkanı"
  },
  240: {  // Yüksek Askerî Şûra (rank 240)
    discordRoleIds: ["1514582741772013588"], // Yüksek Askerî Şûra
    name: "Yüksek Askerî Şûra"
  },
  250: {  // Yönetim Kurulu (rank 250)
    discordRoleIds: ["1514582653322661959"], // Yönetim Kurulu
    name: "Yönetim Kurulu"
  },
  251: {  // Yönetim Kurulu Başkan Y. (rank 251)
    discordRoleIds: ["1514582652433465474"], // Yönetim Kurulu Başkan Y.
    name: "YK Başkan Yardımcısı"
  },
  252: {  // Yönetim Kurulu Başkanı (rank 252)
    discordRoleIds: ["1514582651544010752"], // Yönetim Kurulu Başkanı
    name: "YK Başkanı"
  },
  253: {  // Geliştirme Ofisi (rank 253)
    discordRoleIds: ["1514582740496814172"], // Geliştirme Ofisi
    name: "Geliştirme Ofisi"
  },
  254: {  // Holder (rank 254)
    discordRoleIds: ["1514582651544010752"], // Yönetim Kurulu Başkanı
    name: "Holder"
  },
  255: {  // OF-10 Mareşal (rank 255)
    discordRoleIds: ["1514582645051490415"], // OF-10 Mareşal
    name: "OF-10 Mareşal"
  },
};

// All role IDs for removal (when user is no longer in group or drops rank)
const ALL_TMT_ROLE_IDS = new Set([
  "1514582790639980635", // Askeri Personel
  "1514582773136887858", // Ordu Personeli
  "1514582768883990528", // Emekli Ordu Personeli
  "1514582762093547560", // Ordu Subayı
  "1514582757420830850", // Kıdemli Ordu Subayı
  "1514582748394946591", // Ordu Generali
  "1514582755512553522", // Paşa
  "1514582742749417624", // Genelkurmay Başkanı
  "1514582741772013588", // Yüksek Askerî Şûra
  "1514582744708026468", // Genelkurmay
  "1514582653322661959", // Yönetim Kurulu
  "1514582652433465474", // YK Başkan Yardımcısı
  "1514582651544010752", // YK Başkanı
  "1514582740496814172", // Geliştirme Ofisi
  "1514582645051490415", // OF-10 Mareşal
]);

module.exports = {
  TMT_GUILD_ID,
  TMT_ROLE_MAPPINGS,
  ALL_TMT_ROLE_IDS,
};
