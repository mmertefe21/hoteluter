# CLAUDE_HOTELUTER_v0.7.md

**Tarih:** 05.05.2026
**Versiyon:** v0.7 — Rezervasyon Bölme + Toplam Ciro + Bar Gece-Mantığı Düzeltmesi
**Durum:** Tek-dosya MVP'nin **finali**. Sonraki sürüm Vite + Firestore + Netlify'a geçişi içerir.

---

## 1. Bu Sürümde Yeni Olanlar

### 💰 Dashboard Aylık Stat → "Toplam Ciro" satırı eklendi
Dashboard'daki "İstatistikler" panelinde 6. satır olarak. **Vurgulu** stil: brass-soft arka plan, brass dolgun ikon kutusu (beyaz icon), forest renkli kalın label, 28px değer.

Hesaplama: `monthStats.odaGeliri` (yıllık ciro raporuyla aynı tahakkuk mantığı — gece-gece fiyat varsa o, yoksa standart `geceFiyati`).

### ✂️ Rezervasyon Bölme (Split)
Tek hesap kuralı korundu. Misafir tek konaklama yapıyor, sadece odası ortada değişiyor; muhasebe tek hesap.

**Veri modeli:** `rezervasyonlar.segmentler[]` array. Bölünmemiş için boş/undefined. Bölünmüşte 2+ ardışık segment.

**Helper:** `getOdaSegmentleri(rez)` — bölünmemişse tek sanal segment, bölünmüşte array. Tüm görüntüleme/çakışma kodu segment-uniform çalışır.

**checkOverlap segment-aware:** Tüm rezervasyonların TÜM segmentlerini tarar. Aynı rezervasyonun segmentleri kendi içinde çakışma sayılmaz.

**UI:** Edit mode aktifken bar'ın sağ üst köşesinde 18×18 makas butonu (bar genişliği > 60px ise). Bölünmemiş rez → "Rezervasyonu Böl" modalı; bölünmüşte → "Bölmeyi Geri Al" modalı.

**Drag-to-move segment-aware:** Bölünmüş rezde sadece sürüklenen segment taşınır. Onay modalı "X/Y. segmenti taşınacak" der.

**Görsel:** Bölünmüş segment barlarında zincir ikonu + segment numarası ("Ahmet Y. · 1/2").

### 🛏️ Bar Render — Gece Mantığı Düzeltmesi (KRİTİK)
**Önceki davranış (yanlıştı):** Bar giriş hücresinin ortasından çıkış hücresinin ortasına çiziliyordu. Otelcilik gece mantığına ters.

**Yeni davranış (doğru):** Bar **yatılan gecelerin hücrelerini TAM kaplar**. SabeeApp ve diğer profesyonel PMS'lerle aynı yaklaşım.

```
4 Mayıs giriş, 6 Mayıs çıkış → 2 gece yatılır

[  4 May  ] [  5 May  ] [  6 May  ]
[████████ DOLU ████████]   (BOŞ)
   gece 1     gece 2    sabah çıkış
```

Algoritma: `sonGece = addDays(cikisTarihi, -1)`, bar `girisIdx`'ten `sonGeceIdx`'e tüm hücreleri kaplar. Komşu rezler yapışık görünmesin diye 2px boşluk.

---

## 2. Veri Modeli Değişiklikleri

`rezervasyonlar.segmentler[]` array — bölünmüşse dolu. Migration yok (yeni alan, undefined zaten doğru çalışıyor).

---

## 3. Dosya Boyutu

- **6500 satır, ~290K karakter Babel script**
- Tek HTML dosyası verim eşiğini aştı
- Yeni özellikler için modülerleştirme gerekiyor

---

## 4. Çalışan Mimari Kuralları

- Eski kodu silme — additive override
- Compound `where()` kullanma (Firestore'da da geçerli)
- `onSnapshot` içinde async/await yok
- Migration flag pattern — `_meta.seeded_v*`
- Atomik işlemler — tahsilat/gider + hareket birlikte
- Para birimi tutarlılığı — `tutarAna` ana PB karşılığı
- Hesap bakiyesi hesabın PB'sinde
- Tek hesap, çok segment — bölünmüş rezervasyon hâlâ tek kayıt
- Versiyonlu CLAUDE_HOTELUTER_v*.md dokümanı her sürüm
