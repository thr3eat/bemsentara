# 🌙 GECE OTOMATIK BAN SİSTEMİ (Night Mode Auto-Ban)

## 📋 Sistem Özeti

Gece saatleri **(00:00 - 08:00)** arasında Discord sunucularında abuse şüphesi (şüpheli aktivite) tespit edildiğinde:

1. **1 dakika bekleme süresi** yaşanır
2. Eğer bu sürede **manuel müdahale yapılmazsa**, sistem **otomatik olarak:**
   - ❌ Kullanıcıyı **Discord sunucusundan banlar**
   - 📤 Kullanıcıyı **Roblox gruplarından kaldırır** (TMT için)
   - 📝 Ban loglarını **Ban Log kanalına** yazar
   - 💬 **Admin ID'lerine DM** gönderir
   - 📧 **Banlanan kişiye DM** gönderir

---

## 🔧 Teknik Yapı

### Dosyalar
- **`bot/services/discordAbuseDetector.js`** — Abuse tespiti ve gece modu otomatik ban
- **`bot/handlers/buttonHandler.js`** — Banı geri alma butonu işleyici

### Ana Fonksiyonlar

#### 1. `isNightHours()`
Gece saatleri olup olmadığını kontrol eder.
```javascript
function isNightHours() {
  const hour = new Date().getHours();
  return hour >= 0 && hour < 8; // 00:00 - 08:00
}
```

#### 2. `sendDiscordAbuseAlert()` (Değiştirildi)
Gece modunda manuel alert göndermek yerine:
- 1 dakikalık zamanlayıcı başlatır
- `executeNightModeAutoBan()` fonksiyonunu çağırır

#### 3. `executeNightModeAutoBan()`
Otomatik ban işlemini gerçekleştirir:
```javascript
async function executeNightModeAutoBan(client, guild, executor, type, detailLines)
```

**Yapı:**
1. Discord sunucusundan ban
2. Roblox gruplarından kaldırma (TMT)
3. Ban Log kanalına mesaj gönderme
4. Admin ID'lerine DM gönderme
5. Banlanan kişiye DM gönderme

#### 4. `handleNightUnbanButton()`
Banı geri alma butonunu işler:
- Ban Log kanalında "↩️ Banı Geri Al" butonu
- Banı kaldırır
- Banlanan kişiye "Banınız geri alındı" mesajı gönderir

---

## 📊 İş Akışı

```
[Abuse Tespit] → [Gece Saati Kontrol]
                        ↓
                   [Gece mi?]
                    ↙      ↘
                  EVET      HAYIR
                   ↓         ↓
          [1 Dakika       [Normal Alert
           Bekle]          Gönder]
             ↓
      [Manual İşlem     
       Yapılmış mı?]
        ↙           ↘
      EVET         HAYIR
       ↓             ↓
    [İptal]    [OTOMATİK BAN]
                    ↓
           [Discord Ban]
                    ↓
           [Roblox Kaldırma]
                    ↓
           [Log Kanalına]
                    ↓
           [Admin DM]
                    ↓
           [Kullanıcı DM]
```

---

## 🔐 Konfigürasyon

### Admin ID'leri (Bildirim Alacaklar)
```javascript
const NIGHT_ADMIN_IDS = ["1078049507230625963", "1031620522406072350"];
```
**Şu anda aktif admins:**
- `1078049507230625963` (Admin 1)
- `1031620522406072350` (Admin 2)

### İzlenen Sunucular
```javascript
const MONITORED_GUILDS = {
  "1514569307886063666": "TMT | Turkish Armed Forces",
  "1367646464804655104": "EkoYıldız",
  "1414639355456389344": "BEM Sentara"
};
```

### Ban Log Kanalı
```javascript
const BAN_LOG_CHANNEL_ID = "1504201531551907941";
```

---

## 📧 Gönderilen Mesajlar

### 1. Ban Log Kanalı Mesajı
- **Başlık:** 🔨 GECE OTOMATIK BAN
- **Bilgi:** Banlanan kullanıcı, sunucu, sebep, zaman
- **Buton:** ↩️ Banı Geri Al

### 2. Admin DM Mesajı
- **Başlık:** 🚨 GECE OTOMOTIK BAN ÖZETİ
- **İçerik:** Banlanan kişi, sunucu, abuse tipi, detaylar
- **Nota:** "Geç saatlerde abuse şüphesi tespit edildi"

### 3. Banlanan Kullanıcı DM Mesajı
- **Başlık:** ⛔ BAN BİLDİRİMİ
- **İçerik:** Banlanma sebebi, geri alma talimatları
- **Talimat:** "Ban Log kanalına gidin → ↩️ Banı Geri Al butonuna tıklayın"

### 4. Ban Geri Alındığında Kullanıcı DM Mesajı
- **Başlık:** ✅ BAN GERİ ALINDI
- **İçerik:** Geri alan admin, sunucu davet linki
- **Mesaj:** "Lütfen dikkatli olun ve kurallara uyun"

---

## 🔄 Ban Geri Alma Süreci

### Adım 1: Ban Log Kanalında Buton
```
[🔨 GECE OTOMOTIK BAN]
┌──────────────────────┐
│ 👤 Banlanan: User#123│
│ 🏠 Sunucu: TMT       │
│ ⚠️ Sebep: Abuse      │
└──────────────────────┘
[↩️ Banı Geri Al]  ← TIKLAyin
```

### Adım 2: Sistem Otomatik Olarak
1. Ban'ı kaldırır
2. Banlanan kişiye DM gönderir
3. Admin'i bilgilendirir

### Adım 3: Banlanan Kişi DM Alır
```
✅ BAN GERİ ALINDI
"TMT sunucusundaki banınız geri alındı.
Geri Alan: AdminName
Sunucu Davet Linki: https://discord.gg/..."
```

---

## ⚙️ Özelleştirme

### Gece Saatlerini Değiştirme
`discordAbuseDetector.js` → `isNightHours()` fonksiyonunu düzenleyin:
```javascript
function isNightHours() {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6; // 22:00 - 06:00 yerine
}
```

### Bekleme Süresini Değiştirme
`executeNightModeAutoBan()` fonksiyonunda setTimeout değerini düzenleyin:
```javascript
setTimeout(async () => {
  // 60_000 → 2 dakika için 120_000 yapın
  // 1 dakika = 60_000 ms
}, 60_000);
```

### Admin ID'si Ekleme/Çıkarma
```javascript
const NIGHT_ADMIN_IDS = [
  "1078049507230625963",
  "1031620522406072350",
  "YENI_ADMIN_ID" // Buraya ekleyin
];
```

---

## 🧪 Test Etme

### Gece Modu Simüle
1. Sunucu zamanını gece saatine ayarlayın (test için sistem saati)
2. Abuse tespiti tetikleyin (örn: hızlı ban veya rol silme)
3. Sonuçları izleyin:
   - Ban Log kanalı mesajı
   - Admin DM'leri
   - Kullanıcı DM'i

### Komut Satırında Log
```bash
[NightMode] ⏳ TMT — user#123 için 1 dakika bekleme başlandı
[NightMode] 🔨 Otomatik ban başladı: TMT — user#123
[NightMode] ✅ TMT — user#123 banlandı
```

---

## 🚨 Olası Sorunlar

| Sorun | Çözüm |
|-------|-------|
| Admin DM'i gitmiyor | Admin ID'leri kontrol edin, DM açık olsun |
| Ban Log mesajı yok | BAN_LOG_CHANNEL_ID kontrol edin |
| Banı geri alma butonu çalışmıyor | Button handler'da `night_unban_` prefix'i kontrol edin |
| Roblox kaldırma yapılmıyor | Roblox API cookie gerekli, `.env` kontrol edin |

---

## 📝 Notlar

- ✅ Sistem **sadece gece saatlerinde (00:00-08:00) aktif**
- ✅ Gündüz saatlerinde normal alert sistemi çalışır
- ✅ 1 dakika içinde **manuel işlem yapılırsa otomatik ban engellenir**
- ✅ **TMT sunucusu** için Roblox grup kaldırması entegre
- ✅ **Ban Log kanalında** davet linki gösterilir

---

## 📞 İletişim

Sistem hataları veya sorunları için:
- Admin ID'lerine DM gönderin
- Ban Log kanalını kontrol edin
- Sunucu loglarını inceleyin

---

**Son Güncelleme:** 11 Haziran 2026 — Gece Otomatik Ban Sistemi v1.0
