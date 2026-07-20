# 🚀 Hızlı Başlangıç Kılavuzu - Moderatör Dashboard

## 1️⃣ Dashboard'u Başlatma

### En Basit Yöntem
```javascript
// Slash komut veya button handler içinde
const { generateModeratorDashboard } = require('./services/staffSystem');

const { embed, components } = generateModeratorDashboard();
await interaction.reply({ embeds: [embed], components });
```

---

## 2️⃣ Sistem Yapısı

### Navigation Flow
```
[Ana Dashboard] 
    ↓ (mod_cat_X seçimi)
[Alt-Kategori Seçimi]
    ↓ (mod_subcat_X seçimi)
[İşlemler Seçimi]
    ↓ (mod_action_X seçimi)
[İşlem Gerçekleştirme]
```

---

## 3️⃣ Kategoriler ve Butonlar

### Ana Kategoriler
```
mod_cat_personnel   → Personel Yönetimi
mod_cat_discipline  → Disiplin
mod_cat_hr          → İK
mod_cat_system      → Sistem
mod_cat_reporting   → Raporlama
mod_cat_settings    → Ayarlar
```

### Alt-Kategoriler (Personel Örneği)
```
mod_subcat_personnel_search     → 🔍 Personel Arama
mod_subcat_personnel_roles      → 👑 Rol Atama
mod_subcat_personnel_leave      → 📅 İzin Yönetimi
mod_subcat_personnel_attendance → 📍 Devam Takibi
```

### İşlemler (Personel Arama Örneği)
```
mod_action_search_by_name   → Ada Göre Ara
mod_action_search_by_id     → Sicil No. ile Ara
mod_action_search_by_role   → Role Göre Ara
mod_action_search_active    → Aktif Personeli Göster
```

---

## 4️⃣ Temel Implementasyon

### Slash Komut Örneği
```javascript
// /bot/commands/dashboard.js
const { SlashCommandBuilder } = require('discord.js');
const { generateModeratorDashboard } = require('../services/staffSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yonetim-paneli')
    .setDescription('Moderatör yönetim dashboard\'ını aç'),
  
  async execute(interaction) {
    const { embed, components } = generateModeratorDashboard();
    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: false
    });
  }
};
```

### Button Handler Örneği
```javascript
// buttonHandler.js içinde
async function handleModeratorDashboard(interaction) {
  const { customId } = interaction;
  
  if (customId === 'open_dashboard') {
    const { embed, components } = generateModeratorDashboard();
    await interaction.reply({ embeds: [embed], components });
  }
}
```

---

## 5️⃣ Yeni İşlem Ekleme

### Adım 1: staffSystem.js'e İşlem Ekle
```javascript
personnel_search: {
  title: '🔍 PERSONEL ARAMA',
  description: 'Sistemde personel bilgilerini arayın',
  color: 0x3498db,
  actions: [
    { 
      id: 'search_by_name', 
      label: '👤 Ada Göre Ara', 
      emoji: '👤', 
      description: 'Personel adına göre ara' 
    },
    // ... diğer işlemler
  ]
}
```

### Adım 2: buttonHandler.js'e Handler Ekle
```javascript
if (customId === 'mod_action_search_by_name') {
  await interaction.deferReply({ ephemeral: true });
  
  // Modal veya form göster
  const modal = new ModalBuilder()
    .setCustomId('search_name_form')
    .setTitle('Personel Adıyla Ara');
  
  // ... modal setup
  await interaction.showModal(modal);
}
```

### Adım 3: Modal Handler Ekle
```javascript
if (interaction.customId === 'search_name_form') {
  const name = interaction.fields.getTextInputValue('name_input');
  
  // Veritabanında ara
  // Sonuçları göster
  
  await interaction.reply({ 
    embeds: [resultEmbed], 
    ephemeral: true 
  });
}
```

---

## 6️⃣ Renk Referansı

```javascript
// Kategori Renkleri
{
  personnel: 0x3498db,    // Mavi
  discipline: 0xe74c3c,   // Kırmızı
  hr: 0xf39c12,           // Turuncu
  system: 0x9b59b6,       // Mor
  reporting: 0x1abc9c     // Teal
}

// Button Stilleri
{
  ana_kategoriler: ButtonStyle.Primary,    // Mavi
  alt_kategoriler: ButtonStyle.Primary,    // Mavi
  islemler: ButtonStyle.Success,           // Yeşil
  geri: ButtonStyle.Danger,                // Kırmızı
  ana_sayfa: ButtonStyle.Secondary         // Gri
}
```

---

## 7️⃣ Navigasyon Butonları

### Her Seviyede Mevcut
```javascript
// Geri Git (Level 2+ de)
new ButtonBuilder()
  .setCustomId('mod_nav_back')
  .setLabel('🔙 Geri')
  .setStyle(ButtonStyle.Danger)

// Ana Sayfaya Dön (Her Seviyede)
new ButtonBuilder()
  .setCustomId('mod_nav_home')
  .setLabel('🏠 Ana Sayfa')
  .setStyle(ButtonStyle.Secondary)
```

---

## 8️⃣ Yetki Kontrolü

### Her İşlemde Kontrol Edin
```javascript
if (!interaction.member.permissions.has('ADMINISTRATOR')) {
  return interaction.reply({
    content: '❌ Bu işlem için yönetici yetkisi gereklidir.',
    ephemeral: true
  });
}
```

---

## 9️⃣ Error Handling

### Standard Hata Yönetimi
```javascript
try {
  // İşlem
} catch (err) {
  console.error('[Dashboard]', err);
  return interaction.editReply({
    content: `❌ Hata: ${err.message}`,
    ephemeral: true
  });
}
```

---

## 🔟 Audit Logging

### Tüm İşlemleri Logla
```javascript
const { centralAuditLog } = require('./services/centralAuditLog');

await centralAuditLog(
  interaction.user.id,
  'MOD_DASHBOARD',
  `İşlem: ${actionId}`,
  interaction.guildId
);
```

---

## 💾 Kaydedilen Durumlar

### Navigasyon Durumu
```javascript
const state = getNavState(userId);
// {
//   level: 1-4,
//   category: 'personnel'|null,
//   subcategory: 'personnel_search'|null
// }
```

---

## 📝 Örnek İş Akışı

### Senaryo: Personeli Ada Göre Ara

1. **Kullanıcı** `/yonetim-paneli` komutunu çalıştırır
2. **Sistem** ana dashboard embed'i ve butonları gönderir
3. **Kullanıcı** `mod_cat_personnel` (👥 Personel Yönetimi) butonuna tıklar
4. **Sistem** alt-kategori seçimini gösterir
5. **Kullanıcı** `mod_subcat_personnel_search` (🔍 Personel Arama) butonuna tıklar
6. **Sistem** işlem seçimini gösterir
7. **Kullanıcı** `mod_action_search_by_name` (👤 Ada Göre Ara) butonuna tıklar
8. **Sistem** modal gösterir (ad input'u ister)
9. **Kullanıcı** adı girer ve form gönderir
10. **Sistem** sonuçları gösterir

---

## 🎯 Önemli Notlar

### ✅ Yapılması Gerekenler
- Her işlem için specific handler yazın
- Yetki kontrolü yapın
- Hataları handle edin
- İşlemleri audit log'a kaydedin
- Modal/Form validasyonu yapın

### ❌ Yapılmaması Gerekenler
- Hardcode'lanmış değerler kullanmayın
- Şifreleri log'a kaydetmeyin
- Asenkron işlemleri await etmeyin
- Error mesajlarında hassas bilgi açığa çıkarmayın

---

## 📊 Dashboard Özeti

| Seviye | Adı | customId Prefixi | Stil |
|--------|-----|------------------|------|
| 1 | Ana Kategoriler | `mod_cat_` | Primary |
| 2 | Alt-Kategoriler | `mod_subcat_` | Primary |
| 3 | İşlemler | `mod_action_` | Success |
| 4 | Navigasyon | `mod_nav_` | Danger/Secondary |

---

## 🔗 Bağlantılar

- **Tam Kılavuz:** `MODERATOR_DASHBOARD_GUIDE.md`
- **staffSystem.js:** Dashboard fonksiyonları
- **buttonHandler.js:** Button event handler
- **embeds.js:** Embed builders

---

*Moderatör Dashboard Sistemi v1.0 • Hızlı Başlangıç*
