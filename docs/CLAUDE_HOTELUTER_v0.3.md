# CLAUDE_HOTELUTER_v0.3.md

**Tarih:** 05.05.2026
**Versiyon:** v0.3 — Para Birimi & Kur Sistemi + UX İyileştirmeleri
**Durum:** Lokal MVP genişletmesi

---

## 1. Bu Sürümde Yeni Olanlar

### 💱 Çoklu Para Birimi & Otomatik Kur
- **4 desteklenen para birimi:** EUR, USD, TRY, GBP
- **Otelin ana para birimi:** Ayarlardan seçilir (varsayılan EUR). Tüm raporlar, hesap bakiyeleri, rezervasyon tutarları bu birimde tutulur.
- **Tahsilatta para birimi seçimi:** Misafir farklı bir parayla ödediyse seçilir, sistem ana para birimine çevirir.
- **Canlı kur servisi:** ECB verileri (api.frankfurter.app) — günde 1 kez otomatik çekilir, 12 saatlik cache.
- **Manuel kur desteği:** İnternet yokken ya da kendi kurunu kullanmak isteyen için manuel kur tablosu girilebilir.

### 📅 Takvimde Drag Tooltip
Sürükleyerek rezervasyon oluştururken imlecin yanında canlı bir kutu çıkıyor:
- Büyük "X gece" yazısı (Fraunces italic)
- Tarih aralığı (giriş → çıkış)
- Oda numarası

---

## 2. Para Birimi Mimarisi

### Karar: Çift Kayıt Stratejisi
Tahsilatlarda **iki tutar birlikte saklanıyor:**
- `tutar` + `paraBirimi` → orijinal işlem (misafir 100 USD ödedi)
- `tutarAna` → ana para birimine çevrilmiş hali (örn. 92 EUR)
- `kur` → kullanılan dönüşüm oranı (1 USD = 0.92 EUR)

**Neden?** Çünkü kurlar zamanla değişir. Bugün 1 USD = 0.92 EUR'dur ama 6 ay sonra geçmiş kayda baktığımızda hangi kurun kullanıldığını bilmek isteriz. Audit ve raporlama için kritik.

### Hesap Bakiyeleri Hep Ana Para Biriminde
`hesapHareketleri.tutar` her zaman ana para biriminde tutulur. Bu sayede:
- Bakiye hesaplama basit (toplama)
- Raporlar tutarlı
- Para birimi karışıklığı yok

Tahsilat farklı para biriminde yapıldıysa hesap hareketinin **açıklamasında** orijinal bilgi yer alır:
```
"Tahsilat · HTL-202604-003 (100.00 USD @ 0.9200)"
```

### Rezervasyon Tutarı
**Şu anki yaklaşım:** Rezervasyonun `geceFiyati` ve `toplamTutar`'ı **ana para biriminde** tutuluyor. Mert şu an EUR otele odaklı, bu mantıklı.

**Gelecekte (v0.4'te düşünülebilir):** Rezervasyona ayrı para birimi eklenebilir (Booking.com'dan EUR, Türk müşteriden TL gibi). Ama bu büyük bir değişiklik — ihtiyaç doğunca eklenir.

---

## 3. Kur Servisi Detayları

### API: api.frankfurter.app
- **Ücretsiz**, key gerekmez
- ECB (Avrupa Merkez Bankası) verisi — güvenilir, finansal sektör standardı
- Endpoint: `GET https://api.frankfurter.app/latest?from=EUR&to=USD,TRY,GBP`
- Response: `{ amount: 1, base: "EUR", date: "2026-05-05", rates: { USD: 1.087, TRY: 38.5, GBP: 0.84 } }`

### Cache Stratejisi
- localStorage key: `hoteluter_kurlar_v1`
- TTL: 12 saat
- App ilk açıldığında cache yoksa veya 12 saatten eskiyse arka planda fetch eder
- Stale ise UI'da "12 saatten eski" badge gösterilir
- Manuel "Canlı Kuru Güncelle" butonu Ayarlar'da

### Manuel Kur (Override)
- localStorage key: `hoteluter_manuel_kurlar`
- Kullanıcı manuel kur girdiyse canlı kur **yoksayılır**, manuel kur kullanılır
- "Manuel Kuru Kaldır" ile geri canlı kura dönülür
- UI: 4 input (USD/TRY/GBP için 1 birim → EUR), kaydedilince ters çevrilip standart format'a uygun saklanır

### Dönüşüm Mantığı
EUR base'li tablo:
```
amount_in_target = amount / rates[from] * rates[to]
```
Yani 100 USD → EUR: `100 / 1.087 = 91.99 EUR`

---

## 4. Veri Modeli Değişiklikleri

### `tahsilatlar` (yeni alanlar)
```js
{
  // ... eski alanlar
  paraBirimi: 'EUR' | 'USD' | 'TRY' | 'GBP',  // varsayılan: ana para birimi
  kur: number,                                 // 1 birim → ana para birimi
  tutarAna: number                             // ana para birimine çevrilmiş tutar
}
```

### `otel` (yeni alan)
```js
{
  // ... eski alanlar
  anaParaBirimi: 'EUR'  // varsayılan EUR, ayarlardan değiştirilebilir
}
```

### `hesapHareketleri` (yeni alan)
```js
{
  // ... eski alanlar
  paraBirimi: 'EUR'  // her zaman ana para biriminde — bilgilendirici
}
```

---

## 5. v0.3 Migration

`migrateParaBirimiV03()` App init'inde çalışır:
1. Otelin `anaParaBirimi`'i yoksa **EUR** olarak set edilir
2. Eski tahsilatlara `paraBirimi: ana, kur: 1, tutarAna: tutar` eklenir
3. Flag: `seeded_v03_paraBirimi` → bir kere çalışır

Eski v0.2 verisi bozulmadan v0.3'e geçer.

---

## 6. UI Değişiklikleri

### Ayarlar → Yeni Tab: "Para Birimi & Kur"
- Ana para birimi seçici (4 büyük kart, sembolle)
- Mevcut aktif kur tablosu (canlı / manuel ayrımı görünür)
- "Canlı Kuru Güncelle" butonu (loading state ile)
- "Manuel Kur Gir" butonu + form
- "Manuel Kuru Kaldır" butonu (manuel aktifken)

### Ödeme Formu (Rezervasyon İçi + Ön Muhasebe)
- Tutar yanında **para birimi dropdown** (sembol + isim)
- Farklı para birimi seçilirse **kur paneli** açılır:
  - Otomatik kur gösterimi (canlı veya manuel)
  - Manuel override input
  - Yenile butonu (canlı kuru kullan)
  - **Ana para biriminde önizleme** (1 USD = 0.92 EUR ise 100 USD → 92 EUR)
- Ödeme sonrası bakiye etkisi önizlemesi: "Bu ödemeden sonra: Ödenen X, Kalan Y"

### Tahsilat Geçmişi Tabloları
Tutar sütununda artık:
```
$100.00              ← orijinal tutar (USD)
≈ €92.00             ← küçük italik, ana para birimi karşılığı
```

### Takvim Drag Tooltip
Sürüklerken imlecin yanında siyah-yeşil kart:
```
┌─────────────────────┐
│   3 gece           │ ← Fraunces, brass-light
│   05 May → 08 May   │
│   Oda 201           │
└─────────────────────┘
```

---

## 7. v0.4 Yol Haritası
- Rezervasyon başına para birimi (Booking EUR, Walk-in TL gibi karışık dolan oteller için)
- Multi-currency hesaplar (EUR kasası, TL kasası ayrı)
- Kur gain/loss raporu (ödendiğinde 0.92, bugün 0.95 — kazanç/kayıp)
- Tahsilat bordrosu PDF
- Drag-to-resize takvimde (mevcut bar tarihi değiştirme)
- Drag-to-move (oda değiştirme)
- Firebase entegrasyonu

---

## 8. Çalışan Kurallar
- Eski kodu silme — additive override
- localStorage migration: `seeded_v03_paraBirimi` flag ile bir kere çalışır
- Kurlar 12 saatlik cache, manuel override öncelikli
- Hesap bakiyeleri **her zaman** ana para biriminde — multi-currency hesap yok (ileride v0.4)
- Geriye dönük uyumluluk: `fmtTL` artık ana para birimi formatlar (eski yerlerde de doğru çalışır)
