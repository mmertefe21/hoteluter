# CLAUDE.md — Hoteluter

> **Amaç:** Bu dosya, Hoteluter projesinde çalışan herhangi bir Claude (yeni sohbet, yeni session) için **kurucu dokümandır**. İlk okunacak dosyadır. Projenin tarihi, mimarisi, çalışan kuralları ve aktif görevler buradadır.

**Son güncelleme:** 05.05.2026
**Mevcut sürüm:** v1.0 geçişi (Vite + Firebase + Netlify) — Görev 6B + 7 tamamlandı, sistem ayağa kalktı. Sıradaki: Görev 8 (Şema + sıfır seed).
**Tek-dosya MVP final:** v0.7 (`hoteluter.html`, ~6500 satır, backup olarak saklı)

---

## 🎯 Proje Tanımı

**Hoteluter** — Türkiye'deki butik/şehir otelleri için tasarlanmış SaaS PMS (Property Management System).

**Domain:** hoteluter.com (Netlify'a Görev 12'de bağlanacak)

**Hedef kullanıcı:** Mert (kurucu, Mer Yazılım ve Teknoloji Limited Şirketi). Mevcut SaaS portföyü: Firmasyon (HR/POS/muhasebe), Rezlinka (rezervasyon platformu), Tezgah (tekstil), Tasty Locals (oda servisi).

**Tasarım kimliği:** Editorial boutique hotel estetiği. Bone/Forest/Brass renk paleti. Fraunces (display) + DM Sans (body) fontları.

---

## 📜 Sürüm Tarihi (Kısa)

| Sürüm | Tarih | Ne eklendi |
|---|---|---|
| **v0.1** | İlk MVP | Login, dashboard, Gantt takvimi, rezervasyon/misafir/oda/kullanıcı CRUD, ön muhasebe, raporlar |
| **v0.2** | Hesaplar | `hesaplar` + `hesapHareketleri` koleksiyonları, atomik tahsilat+hareket, transfer, drag-to-create takvim |
| **v0.3** | Para Birimi | EUR/USD/TRY/GBP, Frankfurter API kur servisi, manuel kur override, drag tooltip |
| **v0.4** | Hesap PB + Döviz Transferi | Hesabın kendi PB'si, dolar→dolar kasası kuralı, `yapDovizTransfer` |
| **v0.5** | Kanallar + Giderler + Gece-Gece Fiyat | Dinamik kanallar, `giderler` + `giderKategorileri`, SabeeApp tarzı fiyat editörü |
| **v0.6** | Drag-to-Move + Aylık İstatistik + Yıllık Ciro Raporu | Düzenleme modu, 7/15/30 gün view, Reports yıllık tab |
| **v0.7** | Split + Toplam Ciro + Bar Gece Düzeltmesi | Rezervasyon bölme (segmentler), tek hesap/N segment, bar tam-hücre kapsama |
| **v1.0** | **Mevcut hedef** | Vite + React + Firebase + Netlify production deploy |

Detaylı sürüm dokümanları: `docs/CLAUDE_HOTELUTER_v0.1.md` → `v0.7.md`
Geçiş planı: `docs/HOTELUTER_GECIS_PLANI.md`

---

## 🏗️ Tech Stack (v1.0)

```
Frontend:  React 18 + Vite 5 + Tailwind 3
Backend:   Firebase Firestore (NoSQL) + Firebase Auth
Icons:     lucide-react
Deploy:    Netlify (continuous deployment via GitHub)
Domain:    hoteluter.com (GoDaddy → Netlify nameserver)
```

**Firebase config** `.env`'de tutulur, gitignore'lı. Public key'ler frontend'e gömülü, güvenlik **Firestore Security Rules** ile sağlanır.

---

## 📁 Klasör Yapısı

```
hoteluter/
├── src/
│   ├── lib/                # firebase, db adapter, auth, kur, helpers, permissions, constants
│   ├── helpers/            # tahsilat, gider, transfer, segmentler
│   ├── components/         # Sidebar, Modal, ConfirmModal, Icon, Toast, ListPageShell
│   ├── modals/             # ReservationFormModal, SplitModal, GiderModal, ...
│   ├── pages/              # DashboardPage, CalendarPage, ReservationListPage, ...
│   │   ├── reports/        # ReportsAralikTab, ReportsYillikTab
│   │   └── settings/       # KanallarSettings, GiderKategoriSettings
│   ├── styles/globals.css  # Tasarım sistemi tokens + .htl-* class'ları
│   ├── App.jsx
│   └── main.jsx
├── docs/                   # Tüm versiyon dokümanları + geçiş planı
├── public/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── netlify.toml            # (Görev 11'de eklenecek)
├── firestore.rules         # (Görev 10'da eklenecek)
├── .env                    # (gitignore'da)
└── .env.example
```

---

## 🔐 Veri Modeli (Firestore Koleksiyonları)

| Koleksiyon | Açıklama | Önemli alanlar |
|---|---|---|
| `users` | Sistem kullanıcıları | id (=Firebase UID), kullaniciAdi, adSoyad, email, rol, modulYetkileri, aktif |
| `otel` | Tek otel kaydı (singleton) | ad, adres, telefon, email, vergiNo, yildizSayisi, **anaParaBirimi** |
| `odaTipleri` | Standart, Deluxe, Suite vs. | ad, varsayilanFiyat, renk, kapasite |
| `odalar` | Fiziksel odalar | odaNumarasi, odaTipiId, kat |
| `misafirler` | Misafir kayıtları | ad, soyad, email, telefon, tckn, pasaportNo |
| `rezervasyonlar` | Tüm rezervasyonlar | rezervasyonKodu, anaMisafirId, odaId, girisTarihi, cikisTarihi, durum, **fiyatModu**, **geceFiyatlari[]**, **segmentler[]**, toplamTutar, kanal, pansiyonTipi |
| `tahsilatlar` | Misafirden alınan ödemeler | rezervasyonId, hesapId, **paraBirimi**, **kur**, tutar (orijinal), **tutarAna**, tarih, odemeYontemi |
| `hesaplar` | Kasa/Banka/POS hesapları | ad, tip, **paraBirimi**, renk, aktif |
| `hesapHareketleri` | Tüm hesap giriş/çıkışları (audit) | hesapId, tutar (hesabın PB'sinde), tip, aciklama, transferId, tahsilatId, giderId, rezervasyonId |
| `kanallar` | Booking, Etstur, Manuel vs. | kod, ad, aktif |
| `giderler` | Maaş, kira, fatura | kategoriId, hesapId, tutar, paraBirimi, **tutarAna**, tarih |
| `giderKategorileri` | Personel Maaşı, Kira, ... | ad, icon, renk, aktif |
| `_meta` | Sistem flag'leri | seeded, seeded_v0X_*, anaParaBirimi |

---

## ⚖️ Çalışan Mimari Kuralları

### 🚫 Yasaklar
- **Compound `where()` kullanma** — Firestore composite index gerektirir, sade tut
- **`onSnapshot` içinde async/await yok** — yan etkili işlemleri callback dışına al
- **Eski kodu silme** — additive override pattern, fonksiyonları ekleyerek genişlet
- **Tek otel varsayımı** — `oteliId` foreign key yok (multi-property v1.0 sonrası)

### ✅ Standartlar
- **Migration flag pattern** — `_meta.seeded_v*` Firestore'da meta dokümanı
- **Atomik işlemler** — tahsilat/gider + hareket birlikte (`writeBatch`)
- **Para birimi tutarlılığı** — `tutarAna` her zaman ana PB karşılığı, raporlarda bu kullanılır
- **Hesap bakiyesi hesabın PB'sinde** — multi-currency hesaplar
- **Tek hesap, çok segment** — bölünmüş rezervasyon hâlâ tek kayıt (segments[])
- **Rezervasyon ana `odaId/girisTarihi/cikisTarihi` korunur** — geriye uyum, segment varsa ilki + son çıkış senkron
- **Versiyonlu dokümantasyon** — her sürüm için `docs/CLAUDE_HOTELUTER_vN.md`

### 🛏️ Otelcilik Mantığı
- **Gece bazlı takvim:** Bar yatılan gecelerin hücrelerini TAM kaplar. 4 Mayıs giriş + 6 Mayıs çıkış → 4 ve 5 hücreleri dolu, 6 boş (sabah check-out)
- **Çakışma kontrolü** segment-aware (`getOdaSegmentleri()` helper)
- **Tahsilat para birimi == hesap para birimi** zorunlu (USD ödeme USD hesabına)
- **Döviz transferi** ayrı fonksiyon (`yapDovizTransfer`), kullanıcı kuru kendi belirler

---

## 🔄 Geçiş Planı — v0.7 (tek HTML) → v1.0 (modüler React + Firebase)

12 görev, 4 faz. Detay: `docs/HOTELUTER_GECIS_PLANI.md`

| Faz | Görevler | Durum |
|---|---|---|
| **1. Hazırlık** | 1. Firebase projesi · 2. Local environment | ✅ Tamam |
| **2. Modülerleştirme** | 3. Vite iskelet · 4. Lib/helpers · 5. Components · 6. Modals (6A mali · 6B rezervasyon) · 7. Pages | ✅ Tamam |
| **3. Firestore** | 8. Şema + sıfır seed · 9. Auth · 10. Security Rules | ⏳ |
| **4. Deploy** | 11. GitHub + Netlify · 12. Domain | ⏳ |

---

## 🚀 Şu An Nerede

**Görev 6B + 7 tamamlandı:** Sistem production-ready bir UI'ya çevrildi. Health-check kalktı, gerçek shell + 10 sayfa + 11 modal aktif.

**Yeni modaller (Görev 6B, `src/modals/`):**
- `ReservationFormModal.jsx` — en büyük modal: misafir/oda/tarih/kişi/pansiyon/kanal/durum + 3 fiyat modu (gece/toplam/detay-her-gece-ayrı) + ödeme bölümü (toplam/ödenen/kalan + tahsilat geçmişi tablosu + "Yeni Ödeme Al" → TahsilatModal'ı rezervasyon ID prefill ile açar). Çakışma kontrolü segment-aware. Yeni rezde rezervasyonKodu otomatik (HTL-YYYYAA-NNN).
- `SplitModal.jsx` — bölünmemiş rez için yeni böl (split tarihi + yeni oda + önizleme + çakışma uyarısı), bölünmüş rez için bölmeyi geri al. Geriye uyum: ilk segment + son çıkış senkron.
- `MisafirFormModal.jsx`, `OdaTipFormModal.jsx`, `OdaFormModal.jsx`, `KullaniciFormModal.jsx` — basit CRUD.

**Sayfalar (Görev 7, `src/pages/`):**
- `LoginScreen.jsx` — placeholder mock auth ile (Görev 9'da Firebase Auth bağlanır).
- `DashboardPage.jsx` — 4 KPI + Bu Ayın İstatistikleri (6 satır SabeeApp tarzı, son satır vurgulu Toplam Ciro) + Bugün Gelenler/Çıkanlar/Otelde 3 tablo.
- `CalendarPage.jsx` — Gantt 7/15/30 gün, gece-bazlı bar (çıkış günü boş), oda tipi filtresi, drag-to-create (boş hücre tutup sürükle), edit mode'da drag-to-move (segment-aware, çakışma kontrolü, onay modali), edit mode'da bar üzerinde makas/böl butonu (>60px) → SplitModal. Sürükleme tooltip'i (kaç gece + tarih + oda).
- `ReservationListPage.jsx` — durum/tip/arama filtreleri + tablo.
- `GuestsPage.jsx`, `RoomsPage.jsx` (Odalar + Oda Tipleri 2 sekme), `AccountingPage.jsx` (4 sekme + KPI + 5 modal entegrasyonu), `ReportsPage.jsx` (Tarih Aralığı + Yıllık Ciro custom SVG bar), `SettingsPage.jsx` (6 sekme: Otel/Kur/Kanallar/Kategoriler/Yedek/Kullanıcılar), `UsersPage.jsx` (embedded prop ile Settings içinde de gösterilir).

**Mock auth (`lib/auth-mock.jsx`):** `useAuth` API yüzeyi gerçek `auth.js` ile aynı (user/can/login/logout/refreshUser/changePassword). Hardcoded superadmin (Mert Efe). Görev 9'da tek değişiklik: import path'lerini `auth-mock.jsx` → `auth.jsx` swap.

**Boot sırası (App.jsx):** AuthProvider → ToastProvider → user kontrolü → LoginScreen veya AppShell. AppShell mount'ında otomatik `runMigrations()` (flag pattern sayesinde idempotent) ve `ensureKurlarLoaded()`.

**Modül key → sayfa eşlemesi (`PAGE_MAP`):** dashboard/takvim/rezervasyon/misafirler/odalar/onMuhasebe/giderler (→AccountingPage)/raporlar/ayarlar/kullanicilar.

`npm run build` yeşil, 1632 modül transform ediliyor.

**Sıradaki — Görev 8: Firestore Şema + sıfır seed**
- Şema dokümantasyonu, sıfır demo veri kuralı sağlanması, ilk migration olgunlaştırma.

---

## 💬 Mert Hakkında (kullanıcı profili)

- Türkçe iletişim, ürün sahibi/PM, hands-on coder değil
- Çalışma stili: detaylı planlama → side-effect açıklaması → onay → uygulama
- Tek dosya React + Tailwind + localStorage pattern'inden Firebase'e geçişte
- Memory'de tutulan: Firmasyon, Rezlinka, Tezgah'tan öğrenilen mimari dersler

**Mert'in tercihleri:**
- Token-heavy, dikkatli yanıtlar (acelesi yok)
- Kararları beraber konuşma — büyük değişiklik öncesi mimari kararı netleştir
- Sürüm dokümanı tut, sonraki sohbette devam edebilesin

---

## 📂 Backup Dosyaları

- `hoteluter.html` — v0.7 final tek-dosya MVP. Lokal localStorage ile çalışır. Firebase'e geçiş öncesi referans.
- `docs/CLAUDE_HOTELUTER_v*.md` — her sürümün detaylı tarihi
- `docs/HOTELUTER_GECIS_PLANI.md` — 12 görevlik yol haritası

**Yeni Claude session başlarken:**
1. Bu dosyayı (`CLAUDE.md`) oku
2. Geçiş planına bak (`docs/HOTELUTER_GECIS_PLANI.md`) — hangi görevdeyiz?
3. En son sürüm dokümanına bak (`docs/CLAUDE_HOTELUTER_v0.7.md` şu anda) — son ne oldu?
4. Mert'le konuşmaya başla
