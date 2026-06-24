# Telegram Polling 409 Çakışma Hatası - Kalıcı Çözüm

## Problem
**Hata Mesajı:**
```
[Telegram Polling] 409 Çakışma Hatası: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running
```

Bu hata, iki veya daha fazla bot örneğinin **aynı anda** Telegram API'ye `getUpdates` isteği göndermeye çalıştığında ortaya çıkar. Telegram API, bir bot token'ına karşı yalnızca **bir** aktif polling oturumuna izin verir.

## Çözüm: Detaylı Açıklama

### 1. **Process Lock File Sistemi** (`telegramService.js`)
- Bot başladığında `data/.telegram_polling.lock` dosyasında PID ve timestamp kaydeder
- Diğer bot örnekleri başlatılmaya çalışıldığında, mevcut lock dosyasını kontrol eder
- Eğer başka bir örnek zaten polling yapıyorsa, yeni örnek polling'i başlatmaz
- Lock dosyası 30 saniyeden eski ise (process ölmüşse), üzerine yazılır

### 2. **Üst Üste Hata Limit** (Eski 5 → Yeni 10)
- Eski sistem: 5 hata sonra polling kapanırdı
- Yeni sistem: 10 hata sonra kapanır (daha toleranslı)
- Her başarılı güncelleme sonrasında sayaç sıfırlanır

### 3. **Exponential Backoff** (Akıllı Bekleme)
- İlk 409 hatası: 5 saniye bekle
- 2. hata: 7.5 saniye bekle
- 3. hata: 10 saniye bekle
- ...
- Maksimum: 25 saniye (10+ hatada)
- Bu, diğer örneğin durması için zaman kazandırır

### 4. **Graceful Shutdown** (`index.js`)
- Bot kapandığında (Ctrl+C veya SIGTERM) lock dosyası temizlenir
- Diğer terminal/sunucudaki bot hemen tekrar polling'i başlatabilir

### 5. **Lock File Güvenliği**
- Dosya: `data/.telegram_polling.lock`
- Format: JSON (PID, timestamp, instance ID)
- Örnek:
  ```json
  {
    "pid": 12345,
    "timestamp": 1719235200000,
    "instance": "default"
  }
  ```

---

## Kurulum ve Kullanım

### Senaryo 1: Tek Sunucuda Çalışan Bot
✅ **Sorun yok** - Yapılacak birşey yok, sistem otomatik olarak çalışır.

### Senaryo 2: Geliştirme (Yerel) + Üretim (Sunucu)
⚠️ **Çakışma sorunu var** - Yerel botun polling'i kapatın:

**`.env` dosyasına ekleyin:**
```env
TELEGRAM_POLLING_ENABLED=false
```

Ardından bot yeniden başlatın. Artık:
- ✅ Yerel bot: Polling **devre dışı**, ama diğer Telegram özellikleri (mesaj gönderme) çalışır
- ✅ Üretim bot: Polling **aktif**, tüm mesajları alır

### Senaryo 3: Birden Fazla Sunucuda Çalışan Bot
Yalnızca **BİRİ** Telegram Polling'i yapmalı. Diğerlerinde:

```env
TELEGRAM_POLLING_ENABLED=false
```

### Senaryo 4: Docker/Kubernetes Dağıtımı
Her container'da `INSTANCE_ID` ayarlayın:

```bash
# Container 1
docker run -e INSTANCE_ID="prod-1" bemsentara-bot

# Container 2
docker run -e INSTANCE_ID="prod-2" bemsentara-bot
```

Yalnızca birinde `TELEGRAM_POLLING_ENABLED=true`, diğerlerinde `false`.

---

## Loglara Bakarak Durumu Kontrol Etme

### ✅ Başarılı Başlangıç
```
[Telegram Polling] Lock dosyası oluşturuldu (PID: 12345)
[Telegram Polling] ✅ Polling dinleyici başlatılıyor...
[Telegram Polling] ✅ Webhook silindi (polling aktif).
```

### ⚠️ Başka Örnek Çalışıyor
```
❌ [Telegram Polling] BAŞKA BİR ÖRNEK ZATEN POLLİNG YAPIYOR!
❌ Telegram Polling DEVRE DIŞI BIRAKILDI.
```
→ `.env` dosyasından `TELEGRAM_POLLING_ENABLED=false` ayarla

### ⚠️ Çakışma Hatası (Kurtarma Modu)
```
[Telegram Polling] ⚠️ 409 Çakışma Hatası: ...
⏱️ 5000ms içinde yeniden denenecek... (Çakışma Sayısı: 1/10)
```
→ Bot otomatik olarak exponential backoff kullanarak yeniden dener

### ❌ Başarısız (10 Hata Sonra)
```
❌ [Telegram Polling] Üst üste 10 kez çakışma (409) hatası alındı.
❌ Telegram Polling bu oturum için KAPATILDI.
```
→ Başka bir bot örneğini kontrol et veya `TELEGRAM_POLLING_ENABLED=false` ayarla

### ✅ Kapatma
```
[Telegram Polling] SIGINT alındı, Telegram Polling temizleniyor...
[Telegram Polling] Lock dosyası silindi
```

---

## Teknik Detaylar

### Lock File Timeout
- **30 saniye** (LOCK_TIMEOUT)
- Eğer bir process 30 saniyeden eski lock tutuyor (sayılmıştır) → stale (eski) olarak işaretlenir
- Yeni örnek eski lock'u silebilir ve yeni lock oluşturabilir

### Polling Retry Mantığı

```javascript
// 409 hatası sayısı
consecutive409s = 1 → backoff = 5s
consecutive409s = 2 → backoff = 7.5s
consecutive409s = 3 → backoff = 10s
consecutive409s = 4 → backoff = 12.5s
...
consecutive409s = 10+ → backoff = 25s (max)
```

### Lock Dosyası Kontrol Edişi
```javascript
isLockValid()
├─ Lock dosyası var mı?
├─ JSON geçerli mi?
├─ Lock yaşı 30 saniyeden az mı?
├─ PID benim PID'ime eşit mi?
└─ Sonuç: true/false
```

---

## Sık Sorulan Sorular (FAQ)

### S: Lock dosyası nerede?
**C:** `data/.telegram_polling.lock`

### S: Lock dosyası ella silebilir miyim?
**C:** Evet, güvenli bir şekilde silebilirsiniz. Bot başlangıçta yeniden oluşturacaktır.

### S: TELEGRAM_POLLING_ENABLED=false ayarladım ama "Başka bir örnek zaten polling yapıyor" diyoruz
**C:** Bot henüz çalışıyor olabilir. Tüm bot örneklerini kapatın, sonra yeniden başlatın.

### S: Webhook silme hatası alıyorum
**C:** Bu normal. Botun webhook'u yoksa hata verir ama sorun değildir.

### S: 10 hataya ulaştı, Telegram Polling kapandı. Nasıl yeniden başlatırım?
**C:** Bot kapalı kalacaktır. Diğer bot örneğini kapatın ve bunu yeniden başlatın.

### S: Üretim ortamında kullanmak güvenli mi?
**C:** Evet! Lock sistemi kalıcı ve standart bir yöntemdir. Kubernetes gibi orchestration platformlarında `INSTANCE_ID` ile kontrol edebilirsiniz.

---

## Değişiklikler Özeti

| Dosya | Değişiklik |
|-------|-----------|
| `bot/services/telegramService.js` | Lock file sistemi, exponential backoff, graceful shutdown |
| `index.js` | Shutdown handlers (SIGINT/SIGTERM) |

### Yeni İşlevler
- `createLockFile()` - Lock oluştur
- `updateLockFile()` - Lock'u güncelle (yaşını değiştir)
- `isLockValid()` - Lock geçerli mi kontrol et
- `removeLockFile()` - Lock sil
- `stopTelegramPolling()` - Polling durdur ve temizle

### Yeni Environment Variables
- `TELEGRAM_POLLING_ENABLED` (varsayılan: "true") - Polling aktif/pasif
- `INSTANCE_ID` (varsayılan: "default") - Örnek tanımlayıcısı (logging için)

---

## Kaynakça
- [Telegram Bot API - getUpdates](https://core.telegram.org/bots/api#getupdates)
- [Telegram Bot API - 409 Conflict](https://core.telegram.org/bots/faq#3-what-kind-of-requests-do-bots-get)
