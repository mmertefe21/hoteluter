# CLAUDE.md — Hoteluter

> **Amaç:** Bu dosya, Hoteluter projesinde çalışan herhangi bir Claude (yeni sohbet, yeni session) için **kurucu dokümandır**. İlk okunacak dosyadır. Projenin tarihi, mimarisi, çalışan kuralları ve aktif görevler buradadır.

**Son güncelleme:** 06.05.2026
**Mevcut sürüm:** **v1.0** (production) 🚀 — Sistem canlıda: https://hoteluter.com. Tüm 12 görev + 2 bug fix tamamlandı. Firebase Auth + Firestore Security Rules + Netlify continuous deployment + custom domain + Let's Encrypt SSL aktif.
**Tek-dosya MVP final:** v0.7 (`docs/backup/hoteluter-v0.7-final.html`, ~6500 satır, referans için saklı)

---

## 🎯 Proje Tanımı

**Hoteluter** — Türkiye'deki butik/şehir otelleri için tasarlanmış SaaS PMS (Property Management System).

**Domain:** https://hoteluter.com (canlı, Netlify + Let's Encrypt SSL)

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
| **4. Deploy** | 11. GitHub + Netlify · 12. Domain | ✅ Tamam (12/12 görev) |

---

## 🚀 Şu An Nerede

**v1.0 PRODUCTION RELEASE (06.05.2026):** 🎉 Tüm 12 görev + 2 kritik bug fix tamamlandı, sistem canlıda.

**Production:**
- **URL:** https://hoteluter.com (custom domain) · https://hoteluter.netlify.app (Netlify default, hâlâ aktif)
- **Hosting:** Netlify (continuous deployment via GitHub `mmertefe21/hoteluter`)
- **Domain:** GoDaddy → Netlify nameservers (`dns1-4.p07.nsone.net`)
- **SSL:** Let's Encrypt (otomatik yenileme)

**Auth:**
- Firebase Authentication (Email/Password)
- İlk superadmin: `mmertefe9@gmail.com` (manuel oluşturuldu, Auth UID = Firestore doc ID)
- Authorized domains: `localhost`, `hoteluter.firebaseapp.com`, `hoteluter.netlify.app`, `hoteluter.com`, `www.hoteluter.com`

**Database:**
- Firestore + Security Rules (default deny + role-based + privilege escalation guard)
- `users/{userId}` get/list/create/update/delete ayrımı (Görev 10 bug fix sonrası)
- 12 koleksiyon (users, otel, _meta + 10 operasyonel)
- Migration boot otomatik: 5 kanal + 8 gider kategorisi + 3 hesap

**Bundle:** ~1.55 MB (gzip 328 KB), 1632 modül, build ~5-8 sn

**Commit timeline (toplam 11 commit, ~24 saatlik aktif çalışma):**
- 05.05.2026 20:55 → 21:55 — Faz 1+2: Görev 1-7 (5 commit)
- 06.05.2026 14:14 → 17:04 — Faz 3+4: Görev 9-11 + 2 bug fix (6 commit)

**v1.0 release commit:** Bu sohbet sonunda eklenecek (release dokümantasyonu).

### Sıradaki — v1.1+ Yol Haritası

Sahada kullanım dönemi başlıyor. Yeni Claude session'lar şu konularda yardım edebilir:

- **Bug raporları (sahada kullanım):** Mert canlı sistemde sorun bulduğunda raporlayacak; bu dokümanlardaki "Bilinen Sınırlamalar" tablosunu önce kontrol et
- **"Şu da olsun" feature istekleri:** v1.1, v1.2 sürümleri için yeni feature'lar (her sürüm için ayrı `docs/CLAUDE_HOTELUTER_vN.N.md` doğmalı)
- **Frankfurter API CORS fix:** Lokal'de çalışıyor; production'da CORS sorunu çıkarsa kur servisi alternatifine geçilmeli (`exchangerate.host` veya TCMB EVDS proxy via Cloud Function)
- **Cloud Functions ile incelikli yetki:** Server-side rol/modül kontrolü (şu an client-side `can()` ile filtreli, server-side tüm aktif user r/w)
- **Kullanıcı oluşturma oturum-değişimi:** Cloud Functions admin SDK ile düzeltilebilir (mevcut çözüm: uyarı banner)
- **Mobile drag-to-move:** Touch event desteği (CalendarPage)
- **Yedekleme import flow:** Şu an sadece export var
- **Code splitting:** Bundle 1.55MB → initial yükleme optimize

### Bilinen Sınırlamalar (özet — detay v1.0 dokümanında)

- Frankfurter API CORS riski (production'da test edilecek)
- Yeni user yaratırken oturum-değişimi (Firebase client-side davranışı)
- Modül bazlı incelikli yetki sadece client-side
- Mobile drag-to-move yok
- Yedekleme import yok (sadece export)
- Bundle code splitting yok
- Multi-property desteği yok (tek otel varsayımı)
- Update kuralı `modulYetkileri`'ni serbest bırakıyor (bilinen takas)
- Combobox klavye navigasyonu yok (sadece mouse)

### Modal envanteri (`src/modals/`)
- Mali: TahsilatModal, GiderModal, TransferModal, HesapFormModal, HesapDetayModal
- Rezervasyon: ReservationFormModal (combobox + entegre TahsilatModal + nested MisafirFormModal), SplitModal
- CRUD: MisafirFormModal (prefill prop ile), OdaTipFormModal, OdaFormModal, KullaniciFormModal

### Sayfa envanteri (`src/pages/`)
LoginScreen · DashboardPage · CalendarPage · ReservationListPage · GuestsPage · RoomsPage · AccountingPage · ReportsPage · SettingsPage · UsersPage

### Boot sırası (App.jsx)
AuthProvider (Firebase Auth) → ToastProvider → onAuthStateChanged → user yoksa LoginScreen, varsa AppShell. AppShell mount'ında otomatik `runMigrations()` ve `ensureKurlarLoaded()`. Profil pasifse (`aktif: false`) otomatik logout.

Detaylı v1.0 dokümanı: `docs/CLAUDE_HOTELUTER_v1.0.md`

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

**Yeni Claude session başlarken (v1.0 production sonrası):**
1. Bu dosyayı (`CLAUDE.md`) oku — proje özeti, mimari kuralları, mevcut durum
2. **`docs/CLAUDE_HOTELUTER_v1.0.md`** oku — production sistemin tam fotoğrafı (URL, Auth, Rules, bug fix kayıtları, v1.1+ TODO listesi)
3. **`docs/HOTELUTER_GECIS_PLANI.md`** — kapanmış geçiş planı (v0.7 → v1.0 yol haritası, referans için)
4. Mert'le konuşmaya başla — sahada kullanım sırasında çıkan bug raporu, yeni feature isteği, veya bilinen TODO'lardan birini ele almak
