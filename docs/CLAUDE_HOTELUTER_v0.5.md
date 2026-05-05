# CLAUDE_HOTELUTER_v0.5.md

**Tarih:** 05.05.2026
**Versiyon:** v0.5 — Gece-Gece Fiyat, Kanallar, Giderler, Ayarlar Genişlemesi
**Durum:** Lokal MVP genişletmesi

---

## 1. Bu Sürümde Yeni Olanlar

### 💰 Rezervasyon Fiyatlandırması — 3 Mod
SabeeApp tarzı fiyat editörü. Pill toggle ile mod seçilir:

1. **Gece Fiyatı** (varsayılan) — tek bir gece fiyatı, sistem geceler×fiyat ile toplamı hesaplar
2. **Toplam Tutar** — kullanıcı toplam tutarı girer, sistem geceye böler (gösterim amaçlı)
3. **Gece Bazında** — her gece için ayrı fiyat input'u (resimdeki gibi grid layout). Sezon değişikliği, hafta sonu farkı, vs. için.

Mod değiştiğinde değerler senkron kalır. `fiyatModu` ve `geceFiyatlari[]` rezervasyona kaydedilir.

### 📡 Dinamik Kanal Sistemi
- Önceden 5 sabit kanal vardı (manuel/telefon/yürüyüşten/email/diğer)
- Şimdi **Ayarlar > Kanallar** sekmesinden istenen kadar kanal eklenebilir (Booking, Etstur, Hotels.com, vs.)
- Yeni acente eklendikçe sisteme tanımlanır, rezervasyon formunda görünür
- Mevcut 5 kanal otomatik seed edilir (varsayılan)

### 💸 Gider Yönetimi (yeni!)
**Ön Muhasebe > Giderler** tab'ı:
- Maaş, kira, fatura, vergi gibi tüm giderler buradan kaydedilir
- Kategori seçilir (renk + ikonlu kart grid)
- Hesap seçilir → tutar o hesabın para biriminde girilir
- **Otomatik hesap hareketi** — gider girilince hesap bakiyesinden düşer
- Gider tablosu: tarih, kategori (renkli ikon), hesap, tutar, açıklama
- Bugün/Bu Ay/Bu Yıl gider stat'ları
- **Bu ayın kategori dağılımı**: progress bar ile her kategorinin payı
- Kategoriye göre filtreleme

### 🏷️ Gider Kategorileri (yeni!)
**Ayarlar > Gider Kategorileri** sekmesinden yönetilir:
- Renk + ikon seçimi (ikon paleti: users, home, zap, wifi, utensils, vs.)
- Aktif/pasif toggle
- Varsayılan 8 kategori seed edilir: Personel Maaşı, Kira, Elektrik/Su, İnternet/Telefon, Yiyecek & İçecek, Temizlik & Bakım, Vergi & Resmi, Diğer

### 👤 Kullanıcılar Yönetimi → Ayarlar İçine Taşındı
- Sidebar'dan "Kullanıcılar" kaldırıldı (Mert'in isteği)
- Artık **Ayarlar > Kullanıcılar** sekmesinde
- UsersPage `embedded` prop'u ile esnek render — direkt sayfa olarak da, ayarlar tab'ı olarak da kullanılabiliyor

---

## 2. Veri Modeli Değişiklikleri

### `kanallar` (yeni koleksiyon)
```js
{
  id, kod, ad, aktif, olusturmaTarihi
}
```
`kod` formdaki value, `ad` görünen etiket. v0.5 öncesi rezervasyon `kanal` field'ları (manuel/telefon/yuruyusten/email/diger) hâlâ çalışır — varsayılan 5 kanal aynı kodlarla migrate edilir.

### `giderKategorileri` (yeni koleksiyon)
```js
{
  id, ad, icon, renk, aktif, olusturmaTarihi
}
```

### `giderler` (yeni koleksiyon)
```js
{
  id, kategoriId, hesapId,
  tutar (orijinal hesap PB'si),
  paraBirimi (hesap PB),
  tutarAna (ana para birimi karşılığı, raporlar için),
  tarih, aciklama,
  olusturmaTarihi, olusturanId
}
```

### `hesapHareketleri` (yeni alan)
```js
{
  // ... mevcut alanlar
  giderId: id | null  // hangi giderle bağlı (varsa)
}
```

### `rezervasyonlar` (yeni alanlar)
```js
{
  // ... mevcut alanlar
  fiyatModu: 'gece' | 'toplam' | 'detay',  // varsayılan 'gece'
  geceFiyatlari: number[]                    // 'detay' modunda her gece için
}
```

### `hareket tipi` (yeni)
- `gider` — hesaptan çıkan gider hareketi

---

## 3. v0.5 Migration

`migrateKanalveGiderKategorileriV05()`:
1. `kanallar` koleksiyonu boşsa → varsayılan 5 kanal seed edilir
2. `giderKategorileri` boşsa → varsayılan 8 kategori seed edilir
3. Flag: `seeded_v05_kanal_gider`

Eski v0.4 verisi bozulmaz, sadece yeni koleksiyonlar dolar.

---

## 4. Atomik Gider+Hareket İşlemi

Tahsilat-tahsilatHareketi pattern'inin aynısı:

```js
addGiderWithHareket(gider, kullaniciId) {
  1. Hesap kontrol et, PB belirle
  2. tutarAna hesapla (ana PB karşılığı)
  3. giderler koleksiyonuna ekle
  4. hesapHareketleri'ne NEGATİF tutar ekle (tip: 'gider', giderId: g.id)
}

deleteGiderWithHareket(giderId) {
  1. Bağlı hesapHareketi'ni sil
  2. Gideri sil
}

updateGiderWithHareket(giderId, partial) {
  1. Eski hareketi sil
  2. Gideri güncelle
  3. Yeni hareket düş
}
```

**Hesap PB == Gider PB**: Gider hesabın kendi para biriminde tutulur (TL hesaptan ödenmişse gider TL, USD hesaptan ödenmişse USD). Ana PB karşılığı `tutarAna` alanında raporlar için saklanır.

---

## 5. UI Değişiklikleri

### Rezervasyon Form Modal
Eski "Gece Fiyatı / Toplam Tutar" iki input'u → **Fiyat bölümü** (ayrı section):
- Üstte 3'lü pill toggle (Gece / Toplam / Gece Bazında)
- Mod 1 & 2: 2 sütun grid — input + canlı sonuç kartı
- Mod 3: Tarih label'lı grid — her gece bir input. Altta toplam + ortalama özet kartı

### Ayarlar Tab Bar (genişledi)
Eski 3 tab → 6 tab:
1. Otel Bilgileri
2. Para Birimi & Kur
3. **Kanallar** (yeni)
4. **Gider Kategorileri** (yeni)
5. **Kullanıcılar** (yeni — taşındı)
6. Sistem

### Ön Muhasebe Tab Bar (genişledi)
Eski 3 tab → 4 tab:
1. Hesaplar
2. Rezervasyon Bakiyeleri
3. Tahsilat Geçmişi
4. **Giderler** (yeni)

### Sidebar
"Kullanıcılar" kaldırıldı. ALL_MODULES'da `hideFromSidebar: true` flag'iyle gizlendi (yetki sistemi için modül kaydı duruyor, sadece nav'da görünmüyor).

---

## 6. v0.6 Yol Haritası
- Gelir/Gider raporu (kategori bazlı, dönemsel)
- Drag-to-resize ve drag-to-move takvimde
- Excel/CSV export (gider, tahsilat, rezervasyon listeleri)
- Tekrarlanan gider (aylık kira, maaş otomatik)
- Hesap dönem kapanışı (ay sonu snapshot)
- Misafir profilinde geçmiş rezervasyon listesi
- Firebase entegrasyonu

---

## 7. Çalışan Kurallar
- Eski kodu silme — additive override
- localStorage migration: `seeded_v05_kanal_gider` flag bir kere çalışır
- Gider silinince bağlı hesap hareketi de silinir (atomik)
- Kategori veya kanal silinirse mevcut gider/rezervasyonlar etkilenmez (sadece tanım kaybolur)
- Para birimi tutarlılığı: gider hesabın PB'sinde, ana PB karşılığı `tutarAna`'da
