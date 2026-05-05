# CLAUDE_HOTELUTER_v0.1.md

**Tarih:** 04.05.2026
**Versiyon:** v0.1 — İlk iskelet
**Durum:** Lokal MVP, Firebase entegrasyonu sonraki versiyonda

---

## 1. Ürün Konsepti

**Hoteluter** — otel yönetim sistemi (PMS — Property Management System).
SabeeApp CHM benchmark alındı, kapsam Türkiye SMB butik/şehir oteli ihtiyacına göre daraltıldı.

**Bu versiyonda olan:**
- Rezervasyon yönetimi (takvim + liste)
- Misafir yönetimi
- Oda + oda tipi yönetimi
- Ön muhasebe (tahsilat/borç takibi)
- Auth + rol bazlı yetkilendirme
- Dashboard
- Temel raporlar (doluluk, ciro, ortalama fiyat)

**Bu versiyonda OLMAYAN (gelecek):**
- E-fatura / e-arşiv
- KBB yabancı misafir bildirimi
- Channel manager (Booking, Expedia, Airbnb entegrasyonu)
- IBE (online rezervasyon motoru)
- Housekeeping iş akışı
- SMS/e-posta bildirimleri
- Multi-property (tek otel kurgusu, ama veri modeli `otelId` ile hazır)

---

## 2. Teknik Mimari

### Stack
- **Frontend:** React 18 (UMD), Tailwind CSS (CDN), Lucide ikonlar
- **Build:** Yok — tek HTML dosya, Babel standalone JIT
- **Persistence:** localStorage (v0.1) → Firebase Firestore (v0.2'de migrate)
- **Hosting:** Lokal (file:// veya basit static server)
- **Domain:** hoteluter.com (sahibi: Mert, henüz bağlanmadı)

### Dosya yapısı
```
hoteluter.html         — tek dosya uygulama
CLAUDE_HOTELUTER_v0.1.md  — bu doküman
```

### Veri katmanı soyutlaması
localStorage → Firestore geçişi sancısız olsun diye tüm veri erişimi `db.*` fonksiyonları üzerinden:
```js
db.list('rezervasyonlar')
db.get('rezervasyonlar', id)
db.add('rezervasyonlar', obj)
db.update('rezervasyonlar', id, partial)
db.delete('rezervasyonlar', id)
```
v0.2'de bu fonksiyonların içi Firestore'a bağlanır, çağrı yerleri değişmez.

---

## 3. Auth & Yetki Modeli

### Kullanıcı tipleri
- `superadmin` — tüm yetkiler default açık, kullanıcı yönetimi yetkisi sadece bunda
- `user` — yetkileri süperadmin tek tek ayarlar

### Permission yapısı
Modül başına 4 seviye CRUD:
```js
permissions: {
  dashboard:      { goruntule: true },
  rezervasyon:    { goruntule, ekle, duzenle, sil },
  misafirler:     { goruntule, ekle, duzenle, sil },
  odalar:         { goruntule, ekle, duzenle, sil },
  odaTipleri:     { goruntule, ekle, duzenle, sil },
  onMuhasebe:     { goruntule, ekle, duzenle, sil },
  raporlar:       { goruntule },
  kullanicilar:   { goruntule, ekle, duzenle, sil },  // sadece superadmin
  ayarlar:        { goruntule, duzenle }
}
```

Sidebar menüsü `goruntule: true` olan modülleri gösterir. Action butonları (`+ Ekle`, edit, delete) ilgili izne göre render olur.

### Default süperadmin
İlk açılışta:
- Kullanıcı adı: `admin`
- Şifre: `admin123`
- Mert ilk girişte değiştirmeli

---

## 4. Veri Modeli

```js
// users
{
  id, kullaniciAdi, sifre (hash'lenmemiş v0.1, v0.2'de bcrypt),
  adSoyad, email, rol: "superadmin" | "user",
  permissions: {...}, aktif, olusturmaTarihi
}

// otel (tek kayıt v0.1, multi-property v2'de array)
{
  id, ad, adres, telefon, email, vergiNo, yildizSayisi
}

// odaTipleri
{
  id, ad, kapasiteYetiskin, kapasiteCocuk,
  varsayilanFiyat, aciklama, renk  // takvimde kullanmak için
}

// odalar
{
  id, odaTipiId, odaNumarasi, kat,
  durum: "musait" | "dolu" | "temizlik" | "ariza" | "blokeli",
  notlar
}

// misafirler
{
  id, ad, soyad, tcKimlik | pasaportNo, uyruk,
  dogumTarihi, telefon, email, adres, sehir, ulke, notlar
}

// rezervasyonlar
{
  id, rezervasyonKodu (auto: HTL-YYYYMM-XXX),
  odaId, odaTipiId,
  anaMisafirId, ekMisafirIdler: [],
  yetiskinSayisi, cocukSayisi,
  girisTarihi, cikisTarihi, geceSayisi (computed),
  durum: "onay-bekliyor" | "onayli" | "giris-yapildi" | "cikis-yapildi" | "iptal" | "no-show",
  pansiyonTipi: "oda-only" | "oda-kahvalti" | "yarim-pansiyon" | "tam-pansiyon" | "hersey-dahil",
  kanal: "manuel" | "telefon" | "yuruyusten" | "diger",
  geceFiyati, toplamTutar,
  ekstralar: [{ ad, tutar, tarih }],
  notlar,
  olusturanId, olusturmaTarihi
}

// tahsilatlar (ön muhasebe — fatura YOK)
{
  id, rezervasyonId,
  tutar, tarih,
  odemeYontemi: "nakit" | "kredi-karti" | "havale" | "diger",
  aciklama, olusturanId
}
```

### Kritik kurallar
- **Rezervasyon iptal edilirse** silme — `durum: "iptal"` set et (audit trail için)
- **Rezervasyon-misafir ilişkisi**: ana misafir zorunlu, ek misafirler opsiyonel
- **Tarih çakışması kontrolü**: aynı odaya çakışan tarihte yeni rezervasyon eklenemez (durum != iptal && durum != no-show olanlarla)
- **geceSayisi computed**: cikis - giris (gece bazlı, çıkış günü dahil değil)

---

## 5. Tasarım Sistemi

### Aesthetic direction
**"Editorial boutique hotel"** — bone/cream zemin, deep forest accent, brass detaylar. Otel sektörüne yakışan ama modern, klişe lacivert/altından farklı.

### Renk paleti (CSS değişkenleri)
```css
--bone: #f4ede0          /* ana arka plan */
--bone-light: #faf6ec    /* yüzey/kart */
--bone-warm: #ebe2cf     /* alt vurgu */
--forest: #1f3a2e        /* sidebar, primary text */
--forest-soft: #2d4f3f   /* hover */
--ink: #1a1a1a           /* ana metin */
--ink-soft: #6b6b6b      /* ikincil metin */
--brass: #a87842         /* accent (CTA, link, vurgu) */
--brass-light: #c89968   /* hover accent */
--line: #d8cfba          /* ayraç */
--success: #4a7c59
--warn: #c87f3e
--danger: #a64545
```

### Tipografi
- **Display:** Fraunces (Google Fonts) — başlıklar, brand, büyük sayılar
- **Body:** DM Sans (Google Fonts) — UI, form, tablo

### Layout
- Sol sidebar (forest), genişlik 240px, mobile'da drawer
- Top bar: otel adı + kullanıcı menüsü + bildirim
- Ana alan: bone zemin, beyaz kartlar (faf6ec), 24px padding
- Mobile-first responsive (Firmasyon/Rezlinka pattern)

---

## 6. Modül Akışları

### Login (Anasayfa)
- Sol panel: forest bg + brass logo + slogan
- Sağ panel: bone bg, kullanıcı adı + şifre + giriş butonu
- "Beni hatırla" checkbox (localStorage'da `rememberMe` flag)

### Dashboard
- Üst kart şeridi: Bugün doluluk, Bugün giriş, Bugün çıkış, Müsait oda sayısı
- Bugün gelenler tablosu
- Bugün çıkanlar tablosu  
- Gemide olanlar (in-house) tablosu

### Rezervasyon takvimi (Gantt)
- Sol kolon: oda numaraları, gruplandırma oda tipine göre
- Üst: tarihler (default 14 gün)
- Hücreler: rezervasyon barları, durum rengiyle
- Üst butonlar: ◀ -7 / -1 / Bugün / +1 / +7 ▶, oda tipi filtresi, yeni rezervasyon
- Bara tıklayınca düzenle modalı

### Rezervasyon listesi
- Filtreler: tarih aralığı, durum, oda tipi, arama
- Tablo: kod, misafir, oda, giriş, çıkış, gece, kanal, durum, toplam
- Satıra tıkla → detay/düzenle modal

### Misafir/Oda/Oda tipi/Kullanıcı CRUD
- Standart liste + arama + + yeni butonu
- Modal form
- Düzenle/sil aksiyonları

### Ön Muhasebe
- Üst: bugün/bu ay/bu yıl tahsilat özeti
- Tahsilat ekleme: rezervasyon seç → tutar → ödeme yöntemi → kaydet
- Rezervasyon başına kalan bakiye listesi
- Tahsilat geçmişi tablosu

### Raporlar
- Doluluk raporu (tarih aralığı): dolu gece / toplam gece × 100
- Ciro raporu: toplam tahsilat (tarih aralığında)
- ADR (Average Daily Rate): toplam oda geliri / dolu gece sayısı
- RevPAR: toplam oda geliri / toplam mevcut oda gece (doluluk × ADR)

---

## 7. Demo Seed Data
İlk açılışta otomatik dolduralım ki Mert hemen kullanabilsin:
- 1 süperadmin (admin/admin123)
- 1 normal kullanıcı (resepsiyon/123456)
- 1 otel kaydı (Hoteluter Demo Otel)
- 3 oda tipi (Standart, Deluxe, Süit)
- 8 oda
- 5 örnek misafir
- 3 örnek rezervasyon (geçmiş, mevcut, gelecek)

---

## 8. v0.2 Yol Haritası
- Firebase entegrasyonu (Auth + Firestore)
- Domain bağlama (hoteluter.com)
- E-fatura/e-arşiv desteği
- KBB yabancı misafir bildirimi
- Pansiyon yönetimi + ekstra kalemler genişletme
- Rapor genişletme (kanallara göre, coğrafi, yıllık karşılaştırma)
- Kullanıcı şifre hash'leme (bcrypt)

---

## 9. Çalışan Kurallar (Firmasyon dersi)
- Eski kodu silme — additive override pattern
- localStorage migration: yeni alan eklerken default değer ata, eski kayıtları boz ma
- Versiyonlu doküman (CLAUDE_HOTELUTER_v0.X.md) her sürümde
- Side-effectli değişiklik öncesi onay
