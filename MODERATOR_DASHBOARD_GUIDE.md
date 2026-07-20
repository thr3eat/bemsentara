# 📊 Moderatör Hiyerarşik Yönetim Dashboard Sistemi

## Genel Bakış

Yeni **Moderatör Hiyerarşik Dashboard Sistemi**, Discord botunuza profesyonel bir kurumsal yönetim aracı ekler. Sistem 4-seviyeli navigasyon ile personel yönetimini kolaylaştırır.

---

## 🏗️ Sistem Mimarisi

### 4-Seviye Hiyerarşik Yapı

```
LEVEL 1: ANA KATEGORİLER (Kategori)
├── 👥 Personel Yönetimi
├── 🛡️ Disiplin
├── 📋 İK
├── ⚙️ Sistem
├── 📊 Raporlama
└── 🔧 Ayarlar

LEVEL 2: ALT KATEGORİLER (Alt Kategori)
├── 🔍 Personel Arama
├── 👑 Rol Atama
├── 📅 İzin Yönetimi
└── 📍 Devam Takibi

LEVEL 3: ALT-ALT KATEGORİLER (Alt-Alt Kategori)
├── 👤 Ada Göre Ara
├── 🆔 Sicil No. ile Ara
├── 👑 Role Göre Ara
└── 🟢 Aktif Personeli Göster

LEVEL 4: İŞLEMLER (İşlemler)
├── ✅ İşlemi Başlat
├── 📝 Form Doldur
├── 🔄 Gözden Geçir
└── 💾 Kaydet
```

---

## 🎯 Ana Kategoriler Detaylı

### 1. 👥 PERSONEL YÖNETİMİ (Personnel)

**Amaç:** Personel bilgilerini yönetin, arayın ve rol atayın.

**Alt-Kategoriler:**

| Ad | ID | Açıklama | İşlemler |
|----|----|----------|---------|
| 🔍 Personel Arama | `personnel_search` | Personel bilgilerini ara | Ada Ara, Sicil No. ile Ara, Role Göre Ara, Aktif Personeli Listele |
| 👑 Rol Atama | `personnel_roles` | Rolleri yönet | Rol Ata, Rol Kaldır, Terfi Yap, Hiyerarşi Aşağı Düşür |
| 📅 İzin Yönetimi | `personnel_leave` | İzin işlemleri | İzin Talebi, İzni Onayla, İzni Reddet, Bakiye Göster |
| 📍 Devam Takibi | `personnel_attendance` | Devam/Devamsızlık | Devam Kaydı, Devamsızlık Kaydı, Özet Rapor |

---

### 2. 🛡️ DİSİPLİN (Discipline)

**Amaç:** Disiplin işlemleri, uyarı ve cezaları yönetin.

**Alt-Kategoriler:**

| Ad | ID | Açıklama | İşlemler |
|----|----|----------|---------|
| ⚠️ Uyarı Sistemi | `discipline_warnings` | Resmi uyarılar | Uyarı Ver, Geçmişi Görüntüle, Uyarı Sil, İstatistikler |
| 🚫 Askıya Alma | `discipline_suspensions` | Askıya alma işlemleri | Askıya Al, Süre Uzat, Kaldır, Listeyi Göster |
| 👁️ Disiplin İncelemeleri | `discipline_reviews` | Soruşturma durumları | Yeni Inceleme, Devam Eden, Kapalı, İletişim |
| 📝 Disiplin Kayıtları | `discipline_records` | Tarihsel kayıtlar | Detay Gözle, Raporla, Dışa Aktar |

---

### 3. 📋 İNSAN KAYNAKLARI (HR)

**Amaç:** Maaş, sosyal yardımlar, sözleşme yönetimi.

**Alt-Kategoriler:**

| Ad | ID | Açıklama | İşlemler |
|----|----|----------|---------|
| 💰 Maaş Yönetimi | `hr_salary` | Maaş işlemleri | Hesapla, Artış, Bonus, Tarih |
| 🎁 Sosyal Yardımlar | `hr_benefits` | Fayda yönetimi | Sağlık, Emeklilik, Diğer |
| 📜 Sözleşme Yönetimi | `hr_contracts` | Sözleşme yönetimi | Gözden Geçir, Güncelleştir, İmzala |
| ⬆️ Terfi Yönetimi | `hr_promotions` | Kariyer planlama | Teklifleri Yönet, Onaylama, Reddedilmiş |

---

### 4. ⚙️ SİSTEM YÖNETİMİ (System)

**Amaç:** Sunucu ayarları ve sistem konfigürasyonu.

**Alt-Kategoriler:**

| Ad | ID | Açıklama | İşlemler |
|----|----|----------|---------|
| 🔩 Sunucu Ayarları | `system_settings` | Discord ayarları | Kanal Yönetimi, Rol Ayarları, İzin Ayarları |
| 📢 Duyurular | `system_announcements` | Sistem duyuruları | Yeni Duyuru, Zamanlanmış, Geçmiş |
| 📜 Sistem Logları | `system_logs` | Audit logları | Filtrele, Ara, Dışa Aktar |
| 💾 Yedekleme | `system_backup` | Veri yönetimi | Yedekle, Geri Yükle, Durum |

---

### 5. 📊 RAPORLAMA VE ANALİTİKS (Reporting)

**Amaç:** İstatistikler, performans raporları, analitik veriler.

**Alt-Kategoriler:**

| Ad | ID | Açıklama | İşlemler |
|----|----|----------|---------|
| 📈 İstatistikler | `reporting_stats` | Sistem istatistikleri | Personel, Aktivite, Performans, Trendler |
| ⭐ Performans Raporu | `reporting_performance` | Performans analizi | Sıralama, Karşılaştırma, Analiz |
| 🔍 Denetim Raporu | `reporting_audit` | Denetim izi | Filtrele, Detay, Dışa Aktar |
| 📥 Rapor İndir | `reporting_export` | Rapor indir | Excel, PDF, CSV, JSON |

---

## 🎨 Renk Şeması ve Stil

### Buton Stili Kalibrasyonu

```javascript
// Level 1: Ana Kategoriler
ButtonStyle.Primary (Mavi) - Tüm ana kategori butonları
ButtonStyle.Secondary (Gri) - Ayarlar ve yapılandırma

// Level 2: Alt-Kategoriler
ButtonStyle.Primary (Mavi) - Alt-kategori seçim butonları

// Level 3: Alt-Alt-Kategoriler (İşlemler)
ButtonStyle.Success (Yeşil) - Tüm işlem butonları

// Navigation Butonları
ButtonStyle.Danger (Kırmızı) - Geri / İptal
ButtonStyle.Secondary (Gri) - Diğer navigasyon
```

### Embed Renkleri

```javascript
Personel Yönetimi: 0x3498db (Mavi)
Disiplin:          0xe74c3c (Kırmızı)
İK:                0xf39c12 (Turuncu)
Sistem:            0x9b59b6 (Mor)
Raporlama:         0x1abc9c (Teal)
Ayarlar:           0x7c6af7 (Mor açık)
```

---

## 💻 Teknik Implementasyon

### 1. Ana Dashboard Fonksiyonları

#### `generateModeratorDashboard()`
Ana dashboard embed'ini ve butonlarını oluşturur.

```javascript
const { embed, components } = generateModeratorDashboard();
// embed: EmbedBuilder
// components: ActionRowBuilder[]
```

**Kullanım:**
```javascript
await interaction.reply({ embeds: [embed], components });
```

---

#### `getSubcategoryEmbed(category)`
Seçilen kategorinin alt-kategorilerini gösterir.

**Parametreler:**
- `category` (string): Kategori ID'si
  - `'personnel'` - Personel Yönetimi
  - `'discipline'` - Disiplin
  - `'hr'` - İK
  - `'system'` - Sistem
  - `'reporting'` - Raporlama

**Dönüş:**
```javascript
{
  embed: EmbedBuilder,
  subcategories: Array<{ id, name, description }>
}
```

---

#### `getActionEmbed(subcategoryId)`
Alt-kategorinin işlemlerini gösterir.

**Parametreler:**
- `subcategoryId` (string): Alt-kategori ID'si (ör: `'personnel_search'`)

**Dönüş:**
```javascript
{
  embed: EmbedBuilder,
  actions: Array<{ id, label, emoji, description }>
}
```

---

#### `createActionButtons(actions)`
İşlem butonlarını oluşturur.

**Parametreler:**
- `actions` (Array): İşlem dizisi

**Dönüş:**
```javascript
ActionRowBuilder[] // 2 buton per satır
```

---

### 2. Navigasyon Durum Yönetimi

#### `setNavState(userId, state)`
Kullanıcı navigasyon durumunu sakla.

```javascript
setNavState(userId, {
  level: 1,           // 1-4 arasında
  category: 'personnel', // Level 2+
  subcategory: null   // Level 3+
});
```

#### `getNavState(userId)`
Navigasyon durumunu al.

```javascript
const state = getNavState(userId);
// { level, category, subcategory }
```

---

### 3. Button Handler Entegrasyonu

Buttonlar otomatik olarak `mod_` prefix'i ile şu şekilde işlenir:

```javascript
// Level 1: Kategori seçimi
'mod_cat_personnel'
'mod_cat_discipline'
'mod_cat_hr'
'mod_cat_system'
'mod_cat_reporting'

// Level 2: Alt-kategori seçimi
'mod_subcat_personnel_search'
'mod_subcat_personnel_roles'
// ... vs

// Level 3: İşlem seçimi
'mod_action_search_by_name'
'mod_action_role_assign'
// ... vs

// Navigation
'mod_nav_back'   // Geri git
'mod_nav_home'   // Ana sayfaya dön
```

---

## 🚀 Kullanım Örneği

### Temel Dashboard Başlatma

```javascript
// Bot başladığında veya komut ile
async function showModeratorDashboard(interaction) {
  const { generateModeratorDashboard } = require('./services/staffSystem');
  const { embed, components } = generateModeratorDashboard();
  
  await interaction.reply({
    embeds: [embed],
    components,
    ephemeral: false
  });
}
```

### Slash Komut Örneği

```javascript
// commands/moderator-dashboard.js
module.exports = {
  name: 'yonetici-paneli',
  description: 'Moderatör yönetim dashboard\'ını aç',
  async execute(interaction) {
    const { generateModeratorDashboard } = require('../services/staffSystem');
    const { embed, components } = generateModeratorDashboard();
    
    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: false
    });
  }
};
```

---

## 📋 İşlem Implementasyon Şablonu

Her işlem için özel handler oluşturmalısınız:

```javascript
// buttonHandler.js içinde
if (customId === 'mod_action_search_by_name') {
  await interaction.deferReply({ ephemeral: true });
  
  // Modal aç veya form göster
  const modal = new ModalBuilder()
    .setCustomId('mod_search_name_modal')
    .setTitle('Personel Adıyla Ara');
  
  // ... form implementasyonu
  
  await interaction.showModal(modal);
}
```

---

## 🔧 Özelleştirme Kılavuzu

### Yeni Kategori Ekleme

1. **staffSystem.js** içinde `getSubcategoryEmbed()` fonksiyonuna ekle:

```javascript
{
  title: '🆕 YENİ KATEGORİ',
  description: 'Açıklama',
  color: 0xNEWCOLOR,
  subcategories: [
    { id: 'new_sub1', name: '📌 Alt-Kategori 1', description: 'Açıklama' },
    { id: 'new_sub2', name: '📌 Alt-Kategori 2', description: 'Açıklama' }
  ]
}
```

2. **generateModeratorDashboard()** içine buton ekle:

```javascript
new ButtonBuilder()
  .setCustomId('mod_cat_newcategory')
  .setLabel('🆕 Yeni Kategori')
  .setStyle(ButtonStyle.Primary)
```

### Yeni İşlem Ekleme

1. **staffSystem.js** içinde `getActionEmbed()` fonksiyonuna ekle:

```javascript
{
  title: '📌 YENİ İŞLEM',
  description: 'Açıklama',
  color: 0xNEWCOLOR,
  actions: [
    { id: 'new_action1', label: '✨ İşlem 1', emoji: '✨', description: 'Açıklama' },
    { id: 'new_action2', label: '✨ İşlem 2', emoji: '✨', description: 'Açıklama' }
  ]
}
```

2. **buttonHandler.js** içine handler ekle:

```javascript
if (customId === 'mod_action_new_action1') {
  await interaction.deferReply({ ephemeral: true });
  // İşlem implementasyonu
}
```

---

## 🎯 En İyi Uygulamalar

### 1. Yetki Kontrolü

Her işlemde yetki kontrolü yapın:

```javascript
if (!interaction.member.permissions.has('ADMINISTRATOR')) {
  return interaction.reply({
    content: '❌ Bu işlem için Yönetici yetkisi gereklidir.',
    ephemeral: true
  });
}
```

### 2. Hata Yönetimi

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

### 3. Audit Logging

Tüm işlemleri günlüğe kaydedin:

```javascript
const { centralAuditLog } = require('../services/centralAuditLog');
await centralAuditLog(
  interaction.user.id,
  'MOD_DASHBOARD_ACTION',
  `İşlem: ${actionId}`,
  interaction.guildId
);
```

### 4. Kullanıcı Geri Bildirimi

Her başarılı işlemde onay verin:

```javascript
const embed = new EmbedBuilder()
  .setColor(0x2ecc71)
  .setTitle('✅ İşlem Başarılı')
  .setDescription('...')
  .setTimestamp();

await interaction.editReply({ embeds: [embed] });
```

---

## 📊 Sistem Özellikler

- ✅ 4-Seviyeli Hiyerarşik Navigasyon
- ✅ Profesyonel Dashboard Tasarımı
- ✅ Renkli Durum İndikatörleri
- ✅ Türkçe Etiketler ve Açıklamalar
- ✅ Modüler İşlem Yapısı
- ✅ Kolay Özelleştirme
- ✅ Geri Butonları ve Yön Belirtimi
- ✅ Kullanıcı-spesifik Navigasyon Durumu

---

## 🛠️ Sorun Giderme

### Dashboard Görünmüyor
- Bot'un embed gönderm yetkisi var mı?
- Kullanıcı botu bloke etmiş mi?

### Butonlar Çalışmıyor
- `mod_` prefix'i doğru mu?
- customId'ler eşleşiyor mu?

### Hata: "Cannot read property 'edit'"
- İnteraction'ı düzeltmeden önce `deferUpdate()` veya `deferReply()` çağırın

---

## 📞 Destek ve Güncelleme

Sistem güncellemeler ve yeni özellikler için repo'yu takip edin.

**Versiyon:** 1.0.0
**Son Güncelleme:** 2025
**Yazar:** Eko Yıldız • Moderatör Sistemi

---

*Hiyerarşik Dashboard Sistemi, profesyonel yönetim araçları için tasarlanmıştır.*
