# CLAUDE_HOTELUTER_v0.6.md

**Tarih:** 05.05.2026
**Versiyon:** v0.6 — Drag-to-Move, Aylık İstatistik Paneli, Yıllık Ciro Raporu
**Durum:** Lokal MVP — bu sürüm modülerleştirme + Firestore + Netlify öncesi son tek-dosya iterasyonu

---

## 1. Bu Sürümde Yeni Olanlar

### 📅 Takvim — Drag-to-Move
Rezervasyonu farklı odaya sürükle bırak ile taşıma:

- **"Düzenleme Modu" toggle butonu** üst sağda (brass renkli, aktifken dolgun)
- Düzenleme aktifken bar'lar `draggable=true` olur, imleç `grab` olur
- Bar'a tutunup başka odanın satırına bırakılınca:
  - Hedef oda satırı yeşil dashed outline ile işaretlenir
  - Çakışma varsa kırmızıya döner ve drop engellenir (alert)
  - Çakışma yoksa **onay modalı** açılır: "Misafir Oda 201'den Oda 305'e taşınacak (28-05 → 02-06). Onaylıyor musunuz?"
  - Onay sonrası `odaId` + `odaTipiId` güncellenir (oda tipi de değişebilir)
- Düzenleme kapalıyken bar'a tıklamak **rezervasyon detayını açar** (eski davranış)

**Görsel feedback:**
- Sürüklenen bar opacity: 0.4 (ghosted)
- Hedef oda satırı: yeşil dashed outline (geçerli) veya kırmızı (çakışma)
- Oda label arka planı yeşil/kırmızı soft renk
- İkon `user` yerine `move` (4 yönlü ok) — düzenleme modunda

**Drag&drop kütüphanesi yok** — HTML5 native `draggable` + `onDragStart/Over/Drop` kullanılıyor. En stabili, ekstra bağımlılık yok.

### 📐 Takvim — 7 / 15 / 30 Gün View Toggle
Eski sabit 14 gün → kullanıcı seçebilir:
- 7 gün: cellWidth 80px (rahat)
- 15 gün: cellWidth 60px (varsayılan)
- 30 gün: cellWidth 44px (sıkı, ay görünümü)

Toggle pill grubu üst toolbar'da, "tarih input"un yanında. Navigation butonları (-N / +N) seçilen gün sayısına göre kayar.

### 📊 Dashboard — "İstatistikler" Paneli
SabeeApp tarzı (gönderdiğin foto 1):

- Sağ üstte **ay seçici** (son 12 ay dropdown)
- 5 satırlık liste tablo:
  1. **Doluluk %** — `dolu_gece / (oda_sayısı × ay_günü) × 100`
  2. **Rezervasyon Sayısı** — o aya değen aktif rezervasyonlar
  3. **Konaklanan Gece** — toplam dolu oda-gece
  4. **Olası Toplam Gece** — `oda_sayısı × ay_günü`
  5. **Ortalama Oda Fiyatı (ADR)** — `oda_geliri / dolu_gece`

Her satır: sol icon, orta etiket+alt yazı, sağ büyük rakam (Fraunces). Bone-warm card tasarım.

**Detay fiyat modu** (`fiyatModu === 'detay'`) varsa o gecenin fiyatı kullanılır, yoksa standart `geceFiyati`.

### 📈 Raporlar — Yıllık Ciro Tab
Foto 2'deki SabeeApp Yearly Performance ekranı:

**Yıl seçici** + 4 KPI kartı:
- Toplam Ciro
- Doluluk %
- ADR
- RevPAR

**Aylık Bar Chart (custom SVG):**
- 12 ay yan yana, brass renkli barlar
- Y-axis: 0 / 25% / 50% / 75% / 100% grid
- Üstte değer (h > 14px ise içeride, değilse barın üstünde)
- X-axis: ay kısa adları (Oca, Şub, Mar...)
- Responsive (overflow-x: auto, min-width: 700)
- Recharts kullanmadık → bağımlılık yok, hafif

**Aylık Tablo:**
- Ay / Ciro / Dolu Gece / Doluluk / ADR sütunları
- En altta "Yıl Toplamı" satırı (bone-warm vurgulu, kalın)

**Hesaplama farkı (önemli):**
- Tarih Aralığı tab → ciro = **tahsilat** bazlı (ödenen para)
- Yıllık Ciro tab → ciro = **tahakkuk** bazlı (rezervasyonun gece fiyatından, o ayda konaklanan gece için faturalanan tutar)
- İkisi farklı işe yarıyor: tarih aralığı kasa akışı, yıllık tahakkuk muhasebe perspektifi

### 🏗️ Reports modülü tab'lı yapıya geçti
Eski tek sayfa → 2 tab:
- **Tarih Aralığı** (mevcut, fmtMoney'e çevrildi)
- **Yıllık Ciro** (yeni)

İleride "Misafir Profili", "Kanal Karşılaştırması", "Aylık Karşılaştırma" gibi yeni tab'lar buraya kolayca eklenebilir.

---

## 2. Veri Modeli Değişiklikleri
**Yok.** v0.6 saf UI/raporlama sürümü. Mevcut alanlar yeterli.

`fiyatModu` ve `geceFiyatlari` alanları (v0.5'te eklenmişti) yeni hesaplamalarda da doğru tüketiliyor — gece bazında fiyat varsa o, yoksa standart gece fiyatı kullanılıyor.

---

## 3. UI Detayları

### Drag-to-Move Görsel State'leri
| Durum | Bar | Oda Satırı | Cursor |
|---|---|---|---|
| Edit kapalı | normal, user icon | normal | pointer (tıklayınca detay) |
| Edit açık, idle | dashed outline, move icon | normal | grab |
| Sürüklenirken | opacity 0.4 | hover oda yeşil/kırmızı outline | grabbing |
| Hover (geçerli) | - | yeşil dashed + soft yeşil bg | move |
| Hover (çakışma) | - | kırmızı dashed + soft kırmızı bg | not-allowed |

### Bar Chart Render Mantığı
```
viewBox: 0 0 1000 280
plotArea: x: 50→990, y: 30→230 (200 yükseklik)
maxValue: max(aylar.ciro, 1)  // sıfıra bölme önleme
barWidth: 940/12 * 0.7 = ~55px
barGap: 940/12 = ~78px
yScale: ciro / maxValue * 200
```

K (1000) suffix: `value >= 1000 ? "{val/1000}k" : val.toFixed(0)`

---

## 4. Çalışan Kurallar (devam)
- HTML5 native drag-and-drop (kütüphane bağımlılığı yok)
- Bar chart custom SVG (Recharts gerekmiyor)
- Edit mode ve idle mode birbirine geçişli — tıklama davranışları çakışmıyor
- Multi-currency: tüm rapor metrikleri `tutarAna`'dan hesaplanıp ana para biriminde gösteriliyor
- `fiyatModu === 'detay'` desteği tüm ciro hesaplamalarında: rapor + dashboard + ay paneli

---

## 5. v0.7 ve Sonrası — Modülerleştirme + Firestore + Netlify

### v0.7 hedefleri (büyük geçiş)
1. **Vite + React projesi** — tek HTML'i dosyalara böl:
   ```
   src/
   ├── pages/        (Dashboard, Calendar, Reservations, Guests, Rooms, Accounting, Reports, Settings)
   ├── modals/       (ReservationFormModal, GiderModal, TransferModal, HesapDetayModal, ...)
   ├── components/   (Sidebar, Modal, Icon, ListPageShell, ConfirmModal)
   ├── lib/
   │   ├── db.js     (Firestore adapter — db.list/get/add/update/delete imzaları aynı)
   │   ├── auth.js
   │   ├── kur.js    (frankfurter API + cache)
   │   └── helpers.js (fmtMoney, addDays, todayISO, ...)
   ├── styles/
   └── App.jsx
   ```

2. **Firestore entegrasyonu**:
   - `db.list(coll)` → `getDocs(collection(...))`
   - `db.add` → `addDoc`, `db.update` → `updateDoc`, `db.delete` → `deleteDoc`
   - **Real-time**: Dashboard, Calendar, Hesap kartları için `onSnapshot` (canlı güncelleme)
   - Compound `where()` kullanılmıyor (Firmasyon dersi)
   - Migration'lar `seeded_v*` flag'leri ile çalışmaya devam (Firestore meta dokümanı)
   - Auth: Firebase Auth (email/şifre, mevcut user objemizle uyumlu)

3. **Netlify Deploy**:
   - GitHub repo → Netlify continuous deployment
   - Build: `npm run build` (Vite)
   - Environment variables (Firebase config) Netlify dashboard'dan
   - Custom domain: hoteluter.com (GoDaddy nameserver → Netlify DNS)
   - HTTPS otomatik (Let's Encrypt)

### Kalan ileri özellikler (v0.8+)
- Tahsilat bordrosu PDF
- Excel/CSV export
- Tekrarlanan gider (aylık otomatik)
- Hesap dönem kapanışı
- Misafir profilinde geçmiş rezervasyon listesi
- Kanal karşılaştırma raporu
- Multi-property (birden fazla otel)
- Mobile responsive iyileştirme

---

## 6. Test Akışı (önerilen)

1. **Drag-to-Move:**
   - Takvimde "Düzenleme Modu" → aç
   - Bir rezervasyonu farklı odaya sürükle → onay modal → Onayla → kayıt güncellenmeli
   - Çakışan bir oda üzerine sürükle → kırmızı outline + drop engelleme → alert

2. **View Toggle:**
   - 7 / 15 / 30 gün butonlarına tıkla → cellWidth değişmeli, navigation `-7/+7`, `-15/+15`, `-30/+30` olmalı

3. **Dashboard İstatistikler:**
   - Üst sağdaki ay seçiciyi geçmiş aya çevir → 5 metrik güncellenmeli
   - Yeni rezervasyon ekleyip dashboard'a dön → değerler güncel olmalı

4. **Yıllık Ciro:**
   - Raporlar → "Yıllık Ciro" tab
   - Yılı değiştir → bar chart + 4 KPI + tablo güncellenmeli
   - Aylık tablonun en altında "Yıl Toplamı" çıkmalı

---

## 7. Bilinen Sınırlamalar

- **Drag-to-Move sadece masaüstü** — touch event'leri henüz yok (mobile'da düzenleme modu zaten az kullanılır, v1.0'da iyileştirebiliriz)
- **Bar chart**: 0 değerli aylar boş gözükür (1px referans çizgi var). İstersen "blocked dates only" gibi filtre ileride eklenir
- **Yıllık ciro tahakkuk bazlı** — yani rezervasyonun fiyatından hesaplanır, ödenmiş olup olmamasına bakmaz. Tarih Aralığı tab'ı tahsilat bazlı olduğundan ikisi farklı sonuçlar verebilir, bu **doğru** ve **istenen** davranış
