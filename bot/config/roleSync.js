/** Ana BEM grubu */
const MAIN_GROUP_ID = Number(process.env.ROBLOX_MAIN_GROUP_ID || 8505535);

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

/** Senkron sırasında yönetilen (eklenip kaldırılabilen) yapısal roller */
const STRUCTURAL_ROLE_NAMES = [
  "Teşkilat Personeli",
  "Teşkilat Memuru",
  "Teşkilat Komiseri",
  SEPARATOR_ROLE_NAME,
  "Branşlı Personel",
  "Branşsız Personel",
  ...Object.values(BRANCH_GROUPS),
];

/** Komiser ve üstü rütbeler */
const KOMISER_PATTERN =
  /komiser|müdür|amir|genel|kurul|başkan|koordinatör|danışman|teftiş|emniyet/i;

/** Memur / akademi hattı */
const MEMUR_PATTERN =
  /memur|akademi|polis|başpolis|uzm\.|uzman|aday|stajyer/i;

module.exports = {
  MAIN_GROUP_ID,
  BRANCH_GROUPS,
  SEPARATOR_ROLE_NAME,
  STRUCTURAL_ROLE_NAMES,
  KOMISER_PATTERN,
  MEMUR_PATTERN,
};
