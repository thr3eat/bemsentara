/**
 * Mağaza ürünleri kataloğu.
 * type: "effect" | "badge" | "frame" | "color"
 */
const SHOP_ITEMS = [
  // ── Profil Efektleri ──────────────────────────────────────────────────────
  {
    id: "effect_aurora",
    name: "Aurora Efekti",
    desc: "Profilinde kuzey ışıkları animasyonu görünür.",
    icon: "🌌",
    type: "effect",
    price: 5000,
    cssClass: "effect-aurora",
    preview: "linear-gradient(135deg,#00c6ff,#0072ff,#7c6af7,#ff6bf7)",
  },
  {
    id: "effect_fire",
    name: "Ateş Efekti",
    desc: "Profilinde alev animasyonu görünür.",
    icon: "🔥",
    type: "effect",
    price: 4000,
    cssClass: "effect-fire",
    preview: "linear-gradient(135deg,#ff4e00,#ec9f05)",
  },
  {
    id: "effect_galaxy",
    name: "Galaksi Efekti",
    desc: "Profilinde yıldızlı galaksi animasyonu görünür.",
    icon: "✨",
    type: "effect",
    price: 7500,
    cssClass: "effect-galaxy",
    preview: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
  },
  {
    id: "effect_neon",
    name: "Neon Efekti",
    desc: "Profilinde neon ışık efekti görünür.",
    icon: "💡",
    type: "effect",
    price: 3500,
    cssClass: "effect-neon",
    preview: "linear-gradient(135deg,#f953c6,#b91d73)",
  },
  {
    id: "effect_ocean",
    name: "Okyanus Efekti",
    desc: "Profilinde dalgalı okyanus animasyonu görünür.",
    icon: "🌊",
    type: "effect",
    price: 4500,
    cssClass: "effect-ocean",
    preview: "linear-gradient(135deg,#1a6b8a,#00b4d8,#90e0ef)",
  },

  // ── Profil Çerçeveleri ────────────────────────────────────────────────────
  {
    id: "frame_gold",
    name: "Altın Çerçeve",
    desc: "Avatar etrafında altın renkli çerçeve.",
    icon: "🥇",
    type: "frame",
    price: 3000,
    cssClass: "frame-gold",
    preview: "#fbbf24",
  },
  {
    id: "frame_diamond",
    name: "Elmas Çerçeve",
    desc: "Avatar etrafında elmas parıltılı çerçeve.",
    icon: "💎",
    type: "frame",
    price: 8000,
    cssClass: "frame-diamond",
    preview: "linear-gradient(135deg,#a8edea,#fed6e3)",
  },
  {
    id: "frame_fire",
    name: "Ateş Çerçevesi",
    desc: "Avatar etrafında alev çerçevesi.",
    icon: "🔥",
    type: "frame",
    price: 5000,
    cssClass: "frame-fire",
    preview: "linear-gradient(135deg,#ff4e00,#ec9f05)",
  },

  // ── Rozetler ──────────────────────────────────────────────────────────────
  {
    id: "badge_supporter",
    name: "Destekçi Rozeti",
    desc: "Profilinde 💜 Destekçi rozeti görünür.",
    icon: "💜",
    type: "badge",
    price: 2000,
    emoji: "💜",
    label: "Destekçi",
  },
  {
    id: "badge_veteran",
    name: "Veteran Rozeti",
    desc: "Profilinde ⚔️ Veteran rozeti görünür.",
    icon: "⚔️",
    type: "badge",
    price: 6000,
    emoji: "⚔️",
    label: "Veteran",
  },
  {
    id: "badge_star",
    name: "Yıldız Rozeti",
    desc: "Profilinde ⭐ Yıldız rozeti görünür.",
    icon: "⭐",
    type: "badge",
    price: 1500,
    emoji: "⭐",
    label: "Yıldız",
  },
  {
    id: "badge_crown",
    name: "Taç Rozeti",
    desc: "Profilinde 👑 Taç rozeti görünür.",
    icon: "👑",
    type: "badge",
    price: 10000,
    emoji: "👑",
    label: "Kral",
  },

  // ── Özel Renkler ──────────────────────────────────────────────────────────
  {
    id: "color_rainbow",
    name: "Gökkuşağı Rengi",
    desc: "Profil rengin gökkuşağı gradyanına dönüşür.",
    icon: "🌈",
    type: "color",
    price: 2500,
    value: "linear-gradient(135deg,#ff0000,#ff7700,#ffff00,#00ff00,#0000ff,#8b00ff)",
  },
  {
    id: "color_rose",
    name: "Gül Rengi",
    desc: "Profil rengin gül pembesi olur.",
    icon: "🌹",
    type: "color",
    price: 1000,
    value: "#e91e8c",
  },
  {
    id: "color_emerald",
    name: "Zümrüt Rengi",
    desc: "Profil rengin zümrüt yeşili olur.",
    icon: "💚",
    type: "color",
    price: 1000,
    value: "#10b981",
  },
];

/** itemId'ye göre ürün bul */
function findItem(itemId) {
  return SHOP_ITEMS.find(i => i.id === itemId) || null;
}

module.exports = { SHOP_ITEMS, findItem };
