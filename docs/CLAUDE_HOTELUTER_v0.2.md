# CLAUDE_HOTELUTER_v0.2.md

**Tarih:** 04.05.2026
**Versiyon:** v0.2 — Hesap (Kasa) Sistemi + Takvim İyileştirmeleri
**Durum:** Lokal MVP genişletmesi

---

## 1. Bu Sürümde Yeni Olanlar

### 🏦 Hesap (Kasa) Sistemi
Ön muhasebeye **çoklu hesap yönetimi** eklendi:
- Nakit kasa, banka, kredi kartı, POS gibi farklı hesap tipleri tanımlanabilir
- Her tahsilatta artık **hangi hesaba düşeceği** seçiliyor
- Hesap bakiyeleri otomatik hesaplanıyor (tüm hareketlerin toplamı)
- **Hesaplar arası transfer** desteği (kasa → banka, vs.)
- Hesaba tıklayınca **tüm geçmiş hareketler** + running balance gösteriliyor

### 📅 Takvimde Drag-to-Create
Rezervasyon takviminde artık boş hücreye basıp sürükleyerek hızlı rezervasyon oluşturulabiliyor. Modal açıldığında oda + tarih aralığı önceden doluyor.

### 💳 Rezervasyon İçi Ödeme
Rezervasyon detay/düzenle modalında yeni "Ödeme & Bakiye" bölümü:
- Toplam / Ödenen / Kalan stat kartları
- Tek tıkla ödeme alma (tutar, hesap, ödeme yöntemi)
- Geçmiş ödemeler listesi
- Ödeme alındığında otomatik olarak ilgili hesap bakiyesine yansıma

---

## 2. Yeni Veri Modeli

### `hesaplar` koleksiyonu
```js
{
  id, ad,
  tip: 'kasa' | 'banka' | 'kredi-karti' | 'pos' | 'diger',
  aciklama, renk, aktif, olusturmaTarihi
}
```

### `hesapHareketleri` koleksiyonu — tüm para hareketlerinin tek log'u
```js
{
  id, hesapId, tarih,
  tutar (+/-),
  tip: 'tahsilat' | 'transfer-giris' | 'transfer-cikis' |
       'manuel-giris' | 'manuel-cikis' | 'tahsilat-iptal',
  aciklama,
  rezervasyonId (varsa),
  tahsilatId (tahsilat ile bağlı),
  transferId (transfer eşleştirmesi için),
  olusturmaTarihi
}
```

### `tahsilatlar` koleksiyonuna eklendi
```js
hesapId  // hangi hesaba düştüğü
```

### Bakiye Hesaplama Mantığı
Bakiye **depolanmıyor, hesaplanıyor**:
```js
getHesapBakiye(hesapId) =
  sum(hesapHareketleri.where(h => h.hesapId === hesapId).map(h => h.tutar))
```
Bu sayede audit trail bozulmuyor, race condition yok, manipülasyon olmuyor.

---

## 3. Migration Stratejisi

`migrateHesaplarV02()` fonksiyonu App init'inde çalışıyor:
- Eğer hiç hesap yoksa **3 varsayılan hesap** yaratılıyor (Nakit Kasa, Banka, POS)
- `hesapId`'si olmayan eski tahsilatlar **ödeme yöntemine göre uygun hesaba** otomatik bağlanıyor:
  - `kredi-karti` → POS
  - `havale` → Banka
  - `nakit` ve `diger` → Kasa
- Her eski tahsilat için karşılık `hesapHareketleri` kaydı oluşturuluyor
- Flag: `seeded_v02_hesaplar` → bir kere çalışır

Mevcut kullanıcı verisi **bozulmadan** yeni sisteme geçiyor.

---

## 4. Kritik Akışlar

### Tahsilat Ekleme (Atomik)
```
addTahsilatWithHareket(tahsilat) {
  1. tahsilatlar koleksiyonuna ekle
  2. hesapHareketleri'ne pozitif tutar ile düş (tip: 'tahsilat')
  3. tahsilatId ile birbirine bağlı
}
```

### Tahsilat Silme (Atomik)
```
deleteTahsilatWithHareket(tahsilatId) {
  1. Bağlı hesapHareketleri'ni sil (tahsilatId === tahsilatId)
  2. Tahsilatı sil
}
```

### Tahsilat Güncelleme
Eski hareketleri sil → tahsilatı güncelle → yeni hareket düş.
Tutar/hesap/tarih değişebilir, hareket kayıtları senkron kalır.

### Transfer
```
yapTransfer({ kaynakId, hedefId, tutar, tarih }) {
  transferId = uuid
  hesapHareketleri += { kaynakId, -tutar, tip: 'transfer-cikis', transferId }
  hesapHareketleri += { hedefId,  +tutar, tip: 'transfer-giris', transferId }
}
```
İki hareket aynı `transferId` ile eşleşiyor. İptal edilirse ikisi birden silinebilir.

---

## 5. UI Değişiklikleri

### Ön Muhasebe (3 tab)
1. **Hesaplar** (yeni, default açık) — kart grid, her kart bakiye + hareket sayısı, tıklayınca detay
2. **Rezervasyon Bakiyeleri** — eskisi gibi
3. **Tahsilat Geçmişi** — yeni "Hesap" sütunu eklendi

### Yeni Modallar
- **HesapFormModal** — hesap ekle/düzenle (tip seçimi ikonlu, renk otomatik)
- **TransferModal** — kaynak hesap, hedef hesap, tutar, açıklama
- **HesapDetayModal** — tüm hareketler + running balance, bakiye özeti

### Rezervasyon Modali
- Mevcut rezervasyon ise alt bölümde "Ödeme & Bakiye" görünüyor
- Kalan bakiye otomatik dolduruluyor "Ödeme Al" formunda
- Ödeme yöntemine göre hesap önerisi (kredi-kartı → POS, havale → Banka)

### Takvim
- Mavi info bar: "Boş hücreye basıp sağa sürükleyerek yeni rezervasyon oluşturabilirsiniz"
- `cursor: cell` empty hücrelerde
- Drag süresince hücreler `--brass-light` ile vurgulanıyor
- Mouseup'ta modal açılır: oda + giriş + çıkış pre-fill
- Çakışan hücrelerde drag başlamıyor

---

## 6. v0.3 Yol Haritası
- **Manuel hesap hareketi** UI (gider/gelir kaydı, rezervasyona bağlı olmayan)
- Hesap kapanışı / dönem kapanışı (snapshot)
- Hesap geçmişi tarih filtresi + Excel/CSV export
- Transfer geçmişi listesi (tüm transferler tek tabloda)
- Manuel hareket "tahsilat-iptal" (rezervasyon iptalinde otomatik geri ödeme)
- Rezervasyon takviminde **drag-to-resize** (mevcut barı sürükleyerek tarih değiştirme)
- Rezervasyon takviminde **drag-to-move** (oda değiştirme)
- Firebase entegrasyonu

---

## 7. Çalışan Kurallar (sürdürülen)
- Eski kodu silme — additive override pattern
- localStorage migration: `seeded_v02_hesaplar` flag ile bir kere çalışır
- Hesap silinirse hareketler **kalır** (audit trail), sadece hesabın kendisi silinir
- Hesabı **pasif** yapma (silmek yerine) tercih edilir — geçmiş bağlantılar bozulmaz
