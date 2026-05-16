/** Ana BEM grubu */
const MAIN_GROUP_ID = Number(process.env.ROBLOX_MAIN_GROUP_ID || 8505535);

const MAIN_GROUP_URL =
  process.env.ROBLOX_MAIN_GROUP_URL ||
  "https://www.roblox.com/communities/8505535/BEM-Bursa-Emniyet-M-d-rl";

const NOT_IN_MAIN_GROUP_MESSAGE = `❌ **BEM grubunun üyesi değilsin!**\nÖnce gruba katıl: ${MAIN_GROUP_URL}`;

/** Branş Roblox grup ID → Discord daire rol adı */
const BRANCH_GROUPS = {
  33060430: "Asayiş Daire Başkanlığı",
  33060401: "Polis Havacılık Daire Başkanlığı",
  34433681: "Polis Özel Harekat Daire Başkanlığı",
  16946418: "Sınır Müfettişleri",
  34433786: "Trafik Daire Başkanlığı",
  34524069: "Çevik Kuvvet Daire Başkanlığı",
};

const SEPARATOR_ROLE_NAME = "▬▬▬▬▬▬▬▬▬▬▬▬▬";

/**
 * Roblox rütbe adı → Discord seviye rolü + ayırıcı çizgiler (ID ile).
 * Üye kendi rütbesine ek olarak ilgili seviye rolünü ve çizgileri alır.
 */
const RANK_TIERS = [
  {
    wrapperRole: "Teşkilat Yönetimi",
    skipTeşkilatPersoneli: true,
    separatorIds: ["1504200905669738526", "1504200915370905731"],
    ranks: [
      "Sunucu Yöneticisi",
      "Teşkilat Yönetimi",
      "Geliştirme Ekibi",
      "Yönetim Kurulu Başkanı",
      "Yönetim Kurulu Başkan Yardımcısı",
      "Yönetim Kurulu",
    ],
  },
  {
    wrapperRole: "Kıdemli Teşkilat Müdürü",
    separatorIds: ["1504201013739913246", "1504201021663088873"],
    ranks: [
      "Kıdemli Teşkilat Müdürü",
      "Yüksek Polis Kurulu",
      "Teftiş Kurulu Başkanı",
      "Teftiş Kurulu Başkan Yardımcısı",
      "Teftiş Kurulu",
      "Emniyet Genel Müdürü",
    ],
  },
  {
    wrapperRole: "Teşkilat Müdürü",
    separatorIds: ["1504201021663088873", "1504201030211211484"],
    ranks: [
      "Teşkilat Müdürü",
      "1. Sınıf Emniyet Müdürü",
      "2. Sınıf Emniyet Müdürü",
      "3. Sınıf Emniyet Müdürü",
      "4.Sınıf Emniyet Müdürü",
      "Müdür",
    ],
  },
  {
    wrapperRole: "Kıdemli Teşkilat Komiseri",
    separatorIds: ["1504201030211211484", "1504201036880023652"],
    ranks: [
      "Kıdemli Teşkilat Komiseri",
      "Emniyet Amiri",
      "Amir Adayı",
      "Emekli Personel",
    ],
  },
  {
    wrapperRole: "Teşkilat Komiseri",
    separatorIds: ["1504201036880023652", "1504201052071792760"],
    ranks: [
      "Teşkilat Komiseri",
      "Başkomiser",
      "Üskomiser",
      "Komiser",
      "Askomiser",
      "Komiser Yardımcısı",
      "Stajyer Komiser",
    ],
  },
  {
    wrapperRole: "Kıdemli Teşkilat Memuru",
    separatorIds: ["1504201060590424235", "1504201065703407746"],
    ranks: ["Aday Komiser", "Kıdemli Teşkilat Memuru", "Teşkilat Memuru"],
  },
  {
    wrapperRole: "Teşkilat Memuru",
    separatorIds: ["1504201065703407746", "1504201077065781428"],
    ranks: [
      "Uzm. Başpolis Memuru",
      "Kıdemli Başpolis Memuru",
      "Başpolis Memuru",
      "Başpolis Memuru Adayı",
      "Kıdemli Polis Memuru",
      "Polis Memuru",
      "Polis Memuru Adayı",
      "Akademi",
      "Akademi Adayı",
    ],
  },
];

const TIER_WRAPPER_ROLES = RANK_TIERS.map((t) => t.wrapperRole);

/** Senkron sırasında yönetilen yapısal roller */
const STRUCTURAL_ROLE_NAMES = [
  "Teşkilat Personeli",
  ...TIER_WRAPPER_ROLES,
  SEPARATOR_ROLE_NAME,
  "Branşlı Personel",
  "Branşsız Personel",
  ...Object.values(BRANCH_GROUPS),
];

/** Tüm seviye ayırıcı rol ID'leri (yönetilen set) */
const TIER_SEPARATOR_IDS = [
  ...new Set(RANK_TIERS.flatMap((t) => t.separatorIds)),
];

function normalizeRankName(name) {
  return (name || "").trim().toLowerCase();
}

function findTierForRank(rankName) {
  const key = normalizeRankName(rankName);
  return RANK_TIERS.find((tier) =>
    tier.ranks.some((r) => normalizeRankName(r) === key)
  );
}

module.exports = {
  MAIN_GROUP_ID,
  MAIN_GROUP_URL,
  NOT_IN_MAIN_GROUP_MESSAGE,
  BRANCH_GROUPS,
  SEPARATOR_ROLE_NAME,
  RANK_TIERS,
  TIER_WRAPPER_ROLES,
  STRUCTURAL_ROLE_NAMES,
  TIER_SEPARATOR_IDS,
  findTierForRank,
  normalizeRankName,
};
