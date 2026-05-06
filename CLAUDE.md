# CLAUDE.md — Hoteluter

> **Amaç:** Bu dosya, Hoteluter projesinde çalışan herhangi bir Claude (yeni sohbet, yeni session) için **kurucu dokümandır**. İlk okunacak dosyadır. Projenin tarihi, mimarisi, çalışan kuralları ve aktif görevler buradadır.

**Son güncelleme:** 06.05.2026
**Mevcut sürüm:** **v1.0-rc** (release candidate) — Görev 9 + 10 tamam: gerçek Firebase Auth aktif, Security Rules yazıldı (default deny + role-based). Kuralların Firebase Console'a publish edilmesi Mert tarafından yapılacak. Kalan: Görev 11 (Netlify deploy) + Görev 12 (Domain).
**Tek-dosya MVP final:** v0.7 (`docs/backup/hoteluter-v0.7-final.html`, ~6500 satır, referans için saklı)

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
├── netlify.toml            # ✅ Görev 11 (build config + headers + redirect)
├── firestore.rules         # ✅ Görev 10
├── firestore.indexes.json  # ✅ Görev 10 (composite index yok)
├── firebase.json           # ✅ Görev 10 (deploy config)
├── .firebaserc             # ✅ Görev 10 (project: hoteluter)
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
| **3. Firestore** | 8. Şema + sıfır seed · 9. Auth · 10. Security Rules | ✅ Tamam (publish + lokal test ok) |
| **4. Deploy** | 11. GitHub + Netlify · 12. Domain | 🔄 11 hazırlık tamam, Mert deploy edecek; 12 ⏳ |

---

## 🚀 Şu An Nerede

**Görev 11 hazırlığı tamam (06.05.2026):** Netlify deploy konfigürasyonu hazır.
- `netlify.toml`: build command (`npm run build`), publish dir (`dist`), Node 20, SPA redirect (`/* → /index.html`), security headers (X-Frame-Options/CSP/Referrer-Policy), cache policy (assets immutable, HTML revalidate)
- `.gitignore`: `.claude/` + `.netlify/` lokal tooling state'leri eklendi
- `README.md`: Deploy bölümü (env vars, Firebase Authorized Domains uyarısı)

**Mert deploy edecek:** GitHub repo zaten var (`mmertefe21/hoteluter`). Netlify dashboard'a "Import from GitHub" → site settings env vars (`VITE_FIREBASE_*` 6 anahtar) → ilk deploy. Sonra Firebase Console > Authentication > Authorized domains'e Netlify URL eklenmeli (yoksa `auth/unauthorized-domain`).

**Görev 10 tamamlandı + publish edildi (06.05.2026):** `firestore.rules` Firebase Console'da publish edildi, lokal test başarılı (PERMISSION_DENIED yok, migration çalışıyor). Default deny + role-based kurallar aktif.

**Görev 10 bug fix (06.05.2026):** `users` bloğu yeniden yazıldı — get/list/create/update/delete ayrımı + self-create izni. Sebep: `createUserWithProfile` akışında `setDoc` yeni user'ın oturumunda çalışıyor (Firebase'in `createUserWithEmailAndPassword` yan etkisi), eski `users.create: if isSuperadmin()` reddediyordu → Auth user yaratılıyor ama Firestore profil yazılmıyor. Yeni kural: kullanıcı kendi profilini yaratabilir (rol ∈ {admin, kullanici} + aktif=true zorunlu — privilege escalation guard); update'te rol/aktif sabit. Mert publish edip test edecek.

**Görev 9 tamamlandı (06.05.2026):** Mock auth kaldırıldı, gerçek Firebase Auth aktif. 10 dosyada import path swap, `auth-mock.jsx` silindi, `auth.js` → `auth.jsx` rename. KullaniciFormModal `createUserWithProfile` ile bağlandı.

**İlk superadmin (manuel):**
- Firebase Auth: `mmertefe9@gmail.com`
- Firestore `users/{uid}`: kullaniciAdi=admin, adSoyad=Mert Efe, rol=superadmin, aktif=true
- Auth UID = doc ID eşleşmesi sağlandı

**Strateji:** Sahada test (alpha) atlandı. Görev 10 publish + Görev 11 (Netlify) + Görev 12 (Domain) → sonra canlıda test.

**Modal envanteri (`src/modals/`):**
- Mali (Görev 6A): TahsilatModal, GiderModal, TransferModal, HesapFormModal, HesapDetayModal
- Rezervasyon (Görev 6B): ReservationFormModal (yan paneli + entegre TahsilatModal), SplitModal
- CRUD (Görev 6B): MisafirFormModal, OdaTipFormModal, OdaFormModal, KullaniciFormModal

**Sayfa envanteri (`src/pages/`):**
LoginScreen · DashboardPage · CalendarPage · ReservationListPage · GuestsPage · RoomsPage · AccountingPage · ReportsPage · SettingsPage · UsersPage

**Boot sırası (App.jsx):** AuthProvider (Firebase Auth) → ToastProvider → onAuthStateChanged → user yoksa LoginScreen, varsa AppShell. AppShell mount'ında otomatik `runMigrations()` ve `ensureKurlarLoaded()`. Profil pasifse (`aktif: false`) otomatik logout.

**Sıradaki:**
- **Görev 11 deploy (Mert):** Netlify dashboard'a "Import from GitHub" → env vars → ilk deploy → Firebase Authorized Domains'e Netlify URL ekle
- **Görev 12:** hoteluter.com domain (GoDaddy → Netlify nameserver + Let's Encrypt SSL)
- **Sonra:** Frankfurter CORS testi (Görev 11+12 sonrası ayrı adım) + canlıda sahada test

Detaylı v1.0-rc dokümanı: `docs/CLAUDE_HOTELUTER_v1.0-rc.md`

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
2. **`docs/CLAUDE_HOTELUTER_v1.0-rc.md`** oku — şu anki sistemin tam fotoğrafı (Auth + Rules aktif), kullanım akışı, bilinen sınırlamalar
3. Geçiş planına bak (`docs/HOTELUTER_GECIS_PLANI.md`) — kalan görevler için
4. Mert'le konuşmaya başla — hangi konuda yardım istediğini öğren (Görev 11-12 ilerleme, bug raporu, yeni feature)
