# CLAUDE_HOTELUTER_v1.0

> **Sürüm:** v1.0 (production release) 🚀
> **Tarih:** 06.05.2026
> **Önceki:** v1.0-rc (deploy hazırlığı + Görev 10 bug fix)
> **Sonraki:** v1.1+ (sahada bug raporları + feature istekleri)

Bu doküman, Hoteluter v1.0 production release durumunu kayıt altına alır. Sistem canlıda (https://hoteluter.com), tüm 12 görev tamamlandı, 2 kritik bug fix sahaya çıkmadan önce halledildi.

---

## 🌐 Production Bilgileri

### Erişim
| Tip | URL | Not |
|---|---|---|
| **Custom domain** | https://hoteluter.com | Resmi adres, SSL otomatik |
| **www subdomain** | https://www.hoteluter.com | Canonical redirect → root |
| **Netlify default** | https://hoteluter.netlify.app | Hâlâ aktif (yedek) |
| **Firebase Auth** | hoteluter.firebaseapp.com | Sadece Auth handler için |

### Hosting & Deploy
- **Provider:** Netlify (continuous deployment via GitHub)
- **GitHub repo:** `mmertefe21/hoteluter` — `main` branch push → otomatik build + deploy (~2 dk)
- **Build:** `npm run build` → `dist/` klasörü (1632 modül, ~5-8 sn)
- **Build config:** `netlify.toml` (kök dizinde)
  - SPA redirect: `/* → /index.html` (200)
  - Security headers: X-Frame-Options=DENY, nosniff, XSS protection, Referrer-Policy=strict-origin
  - Cache: `/assets/*` immutable 1 yıl, `/*.html` no-cache must-revalidate
- **Env vars (Netlify dashboard):** `VITE_FIREBASE_*` 6 anahtar (lokal `.env` ile birebir)

### Domain
- **Registrar:** GoDaddy (hoteluter.com)
- **Nameservers:** Netlify (`dns1-4.p07.nsone.net`)
- **DNS yönetimi:** Netlify
- **SSL:** Let's Encrypt (Netlify otomatik provision + yenileme)

### Authentication
- **Provider:** Firebase Authentication (Email/Password)
- **İlk superadmin:** `mmertefe9@gmail.com` (Firebase Console'dan manuel oluşturuldu, Auth UID = Firestore `users/{uid}` doc ID)
- **Authorized domains** (Firebase Console > Authentication > Settings):
  - `localhost` (lokal dev)
  - `hoteluter.firebaseapp.com` (default Auth domain, otomatik)
  - `hoteluter.netlify.app` (Netlify default URL)
  - `hoteluter.com` (custom domain)
  - `www.hoteluter.com` (www subdomain)

### Database
- **Provider:** Firebase Firestore (NoSQL, eu-west-3 region)
- **Security Rules:** Default deny + role-based + privilege escalation guard (Görev 10 bug fix sonrası)
- **`users/{userId}`:** get/list/create/update/delete ayrımlı
- **12 koleksiyon:** users, otel, _meta + 10 operasyonel
- **Migration boot:** App ilk açıldığında otomatik (idempotent flag pattern, `_meta/flags`)

### Performance
- **Bundle:** ~1.55 MB (gzip ~328 KB) toplam
- **CSS:** ~21 KB (gzip ~5 KB)
- **JS:** ~1545 KB (gzip ~328 KB) — code splitting yok, single bundle
- **Modül sayısı:** 1632 (Vite build)

---

## 📜 v1.0 Sürüm Süreci (Timeline)

| Sürüm | Tarih | Ne eklendi |
|---|---|---|
| **v0.1 → v0.7** | (önceki) | Tek HTML monolit (~6500 satır), localStorage ile çalışan MVP. Detay: `docs/CLAUDE_HOTELUTER_v0.1.md` → `v0.7.md` |
| **v0.7 final** | (snapshot) | `docs/backup/hoteluter-v0.7-final.html` — referans için saklı |
| **v1.0-alpha** | 05.05.2026 | Modüler React + Vite + Firebase, mock auth, Faz 1+2 (Görev 1-7). 5 commit |
| **v1.0-beta** | 06.05.2026 | Görev 9: Firebase Auth bağlandı, mock kalktı, ilk superadmin aktif |
| **v1.0-rc** | 06.05.2026 | Görev 10: Firestore Security Rules + Görev 11 hazırlığı (netlify.toml + security headers) |
| **v1.0** | 06.05.2026 | Production deploy + hoteluter.com domain + 2 bug fix (kullanıcı yaratma rules + rezervasyon misafir combobox) |

**Toplam aktif çalışma:** ~24 saat (05.05 akşamı → 06.05 akşamı), 11 commit (release commit dahil)

---

## 🐛 Kayıt Edilen Bug Fix'ler (v1.0-rc → v1.0)

### Bug 1 — Görev 10 sonrası: Kullanıcı oluşturma rules
**Commit:** `4db9359`

**Belirti:** Yeni kullanıcı eklendiğinde Firebase Auth tarafına yazılıyor ama Firestore `users` koleksiyonuna yazılmıyor. Listede sadece superadmin görünüyor.

**Sebep:** `createUserWithProfile` akışında `createUserWithEmailAndPassword` çağrıldığında mevcut admin oturumu **otomatik yeni user'a geçiyor** (Firebase'in yan etkisi). Sonraki `setDoc(users/{newUid})` yeni user'ın oturumunda çalışıyor; eski rules `users.create: if isSuperadmin()` reddediyordu → Auth user yaratılıyor ama Firestore profil yazılmıyor.

**Fix:** `users/{userId}` path için get/list/create/update/delete ayrımı:
- **get:** kendi profili veya superadmin
- **list:** sadece superadmin
- **create:** self (rol ∈ {admin, kullanici} + aktif=true) ∨ superadmin → privilege escalation guard
- **update:** self (rol+aktif sabit kalmak şartıyla) ∨ superadmin
- **delete:** sadece superadmin

### Bug 2 — Rezervasyon modalında misafir seçimi
**Commit:** `cf6b922`

**Belirti:** Yeni rezervasyon modalında "Ana Misafir" alanına yazı yazılamıyor.

**Sebep:** Alan bir HTML `<select>` dropdown'uydu (input değil, tasarım gereği yazı kabul etmez). UX eksiği: form içinden yeni misafir ekleme akışı yoktu.

**Fix:** Combobox'a dönüştürüldü:
- Text input + filtreli dropdown öneriler (ad+soyad / telefon / TC üzerinden case-insensitive)
- Boş arama + focus: en son eklenen 10 misafir
- Seçili görünüm: readonly chip + X (clear) butonu
- Dropdown alt satırı (input doluysa): "Yeni misafir: 'X Y' oluştur" → `MisafirFormModal` ad/soyad **prefill ile** açılır (auto-create değil, telefon/TC/adres ekleme şansı için)
- Sağda "+ Detaylı" butonu: boş prefill ile MisafirFormModal aç
- Esc / blur (200ms) ile dropdown kapanır; `onMouseDown` preventDefault ile öğe click'i blur'dan önce yakalanır
- `MisafirFormModal.onSaved(newId)` imzası: yeni kayıtta Firestore doc id geçer (geriye uyumlu — parametresiz çağrı etkilenmez)
- Yeni `prefill` prop: `{ ad?, soyad?, ... }` modal mount'ta form'u ön-doldurur

---

## 📐 Mimari Özet

```
┌────────────────────────────────────────────────────────┐
│  Tarayıcı (React 18 + Vite 5 + Tailwind 3)             │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ AuthProvider │→ │ ToastProvider│→ │ AppShell     │  │
│  │ Firebase     │  │ (toaster UX) │  │ (sidebar +   │  │
│  │ Auth         │  │              │  │  page render)│  │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  │
│         │                                               │
│         ▼ onAuthStateChanged + Firestore profil çek     │
│         ↓ db.* / useCollection / useDoc                 │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS
                           ▼
┌────────────────────────────────────────────────────────┐
│  Netlify Edge (CDN + SSL termination)                  │
│  netlify.toml: SPA redirect, security headers, cache    │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Firebase (Cloud)                                       │
│  ┌────────────────┐  ┌────────────────────────────┐    │
│  │ Firestore      │  │ Firebase Auth              │    │
│  │ + Security     │  │ Email/Password             │    │
│  │ Rules ✓        │  │ ✓ Authorized Domains       │    │
│  └────────────────┘  └────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

---

## 🔑 Authentication

`src/lib/auth.jsx` — Firebase Auth provider:

```js
useAuth() → {
  user, authReady,
  login(email, password),       // signInWithEmailAndPassword + Türkçe hata mesajları
  logout(),                     // signOut
  can(modul, aksiyon),          // superadmin → true; diğer → modulYetkileri[modul].includes(aksiyon)
  refreshUser(),                // profili Firestore'dan tekrar çek
  changePassword(newPassword),  // updatePassword
}

createUserWithProfile({ email, password, profile })
  → createUserWithEmailAndPassword + setDoc(users/{uid})
```

**Profil senkronizasyonu:**
- `onAuthStateChanged` her oturum değişikliğinde çalışır
- Firebase user → Firestore `users/{uid}` doc'tan profil çekilir
- `aktif: false` ise otomatik `signOut`
- Profil yoksa otomatik logout

**KullaniciFormModal:**
- Yeni: `createUserWithProfile` (Auth + profil birlikte). Banner: "mevcut oturumunuz kapanacak..."
- Düzenleme: sadece Firestore profil update; email field disabled

---

## 🛡️ Authorization (Firestore Security Rules)

`firestore.rules` — Görev 10'da yazıldı + bug fix sonrası güncellendi (commit `4db9359`).

### Helper Fonksiyonlar
```
isAuth()        → request.auth != null
userDoc()       → get(/users/{uid}).data
isSuperadmin()  → isAuth() && userDoc().rol == 'superadmin' && userDoc().aktif == true
isActiveUser()  → isAuth() && userDoc().aktif == true
```

### Koleksiyon Kuralları

| Path | get | list | create | update | delete |
|---|---|---|---|---|---|
| `users/{userId}` | auth ∧ (uid==userId ∨ superadmin) | superadmin | self (rol ∈ {admin,kullanici} ∧ aktif=true) ∨ superadmin | self (rol+aktif sabit) ∨ superadmin | superadmin |
| `otel/{docId}` | aktif user | aktif user | superadmin | superadmin | superadmin |
| `_meta/{docId}` | aktif user | aktif user | aktif user | aktif user | aktif user |
| Operasyonel (10 koll.) | aktif user | aktif user | aktif user | aktif user | aktif user |
| `{document=**}` (catch-all) | **deny** | **deny** | **deny** | **deny** | **deny** |

> Operasyonel = `rezervasyonlar`, `misafirler`, `odalar`, `odaTipleri`, `hesaplar`, `hesapHareketleri`, `tahsilatlar`, `giderler`, `giderKategorileri`, `kanallar`

### Tasarım Tercihleri

- **Operasyonel veri herkese açık (otel ekibi içinde):** Rezervasyon, misafir, oda yönetimi, ön muhasebe → tüm aktif kullanıcı r/w. Modül bazlı incelikli yetki client-side `can()` kontrolü.
- **`users` get/list ayrımı:** Tek doc okuma kendi profili veya superadmin için açık (`get`). Toplu listeleme sadece superadmin (`list`).
- **`users` self-create + privilege escalation guard:** `createUserWithProfile` akışında `setDoc` yeni user'ın oturumunda çalıştığı için kendi profilini yaratma izni şart. `rol` `'admin'` veya `'kullanici'` ile sınırlı, `aktif: true` zorunlu.
- **`users` update guard:** Kullanıcı kendi profilinin diğer alanlarını güncelleyebilir; `rol` ve `aktif` değişmemeli.
- **Default deny:** Yeni eklenen herhangi bir koleksiyon kural yazılmadan kullanılamaz.
- **`aktif: false` ile tek-tıkla erişim kesme:** Pasif user'ın hiçbir koleksiyona erişimi yok.

> ⚠ Bilinen takas: Update kuralı `modulYetkileri`'ni serbest bırakıyor. Server-side incelikli yetkiye geçildiğinde rol/aktif/modulYetkileri üçünü birden sabitlemeli.

### Yardımcı Dosyalar (Firestore deploy)

- `firebase.json` — deploy config (`rules` + `indexes` path'leri)
- `firestore.indexes.json` — boş (compound query yok)
- `.firebaserc` — `default: "hoteluter"`

---

## 📁 Dosya Yapısı

```
hoteluter/
├── src/
│   ├── App.jsx                          # AuthProvider + ToastProvider + AppShell + PAGE_MAP
│   ├── main.jsx                         # React entry
│   ├── lib/
│   │   ├── firebase.js                  # initializeApp + getAuth + getFirestore
│   │   ├── db.js                        # Firestore adapter + useCollection/useDoc
│   │   ├── auth.jsx                     # Firebase Auth Provider
│   │   ├── kur.js                       # Frankfurter API + cache + manuel kur
│   │   ├── helpers.js                   # todayISO, addDays, fmtMoney, ...
│   │   ├── constants.js                 # Tüm OPTS dizileri
│   │   ├── permissions.js               # ALL_MODULES + ROLE_LABELS
│   │   └── migrations.js                # 3 migration (idempotent)
│   ├── helpers/
│   │   ├── tahsilat.js                  # add/update/delete TahsilatWithHareket
│   │   ├── gider.js                     # add/update/delete GiderWithHareket
│   │   ├── transfer.js                  # yapTransfer + yapDovizTransfer
│   │   ├── segmentler.js                # getOdaSegmentleri + checkOverlap
│   │   └── exchange-utils.js            # getHesapBakiye + ...
│   ├── components/
│   │   ├── Icon.jsx                     # lucide-react wrapper
│   │   ├── Modal.jsx, ConfirmModal.jsx
│   │   ├── Toast.jsx
│   │   ├── Sidebar.jsx, ListPageShell.jsx
│   ├── modals/                          # 11 modal
│   │   ├── TahsilatModal.jsx, GiderModal.jsx, TransferModal.jsx
│   │   ├── HesapFormModal.jsx, HesapDetayModal.jsx
│   │   ├── ReservationFormModal.jsx     # combobox + entegre TahsilatModal + nested MisafirFormModal
│   │   ├── SplitModal.jsx
│   │   ├── MisafirFormModal.jsx         # onSaved(id) + prefill prop
│   │   ├── OdaTipFormModal.jsx, OdaFormModal.jsx
│   │   └── KullaniciFormModal.jsx
│   ├── pages/                           # 10 sayfa
│   │   ├── LoginScreen.jsx, DashboardPage.jsx, CalendarPage.jsx
│   │   ├── ReservationListPage.jsx, GuestsPage.jsx, RoomsPage.jsx
│   │   ├── AccountingPage.jsx, ReportsPage.jsx
│   │   ├── SettingsPage.jsx, UsersPage.jsx
│   │   ├── reports/                     # ReportsAralikTab, ReportsYillikTab
│   │   └── settings/                    # KanallarSettings, GiderKategoriSettings
│   └── styles/globals.css               # Tasarım tokenları + .htl-* class'lar
│
├── docs/
│   ├── CLAUDE_HOTELUTER_v0.1.md → v0.7.md   # Önceki sürüm tarihçeleri
│   ├── CLAUDE_HOTELUTER_v1.0-alpha.md → v1.0-rc.md
│   ├── CLAUDE_HOTELUTER_v1.0.md             # ⬅ BU DOSYA
│   ├── HOTELUTER_GECIS_PLANI.md             # Kapanmış geçiş planı (12 görev)
│   └── backup/hoteluter-v0.7-final.html     # v0.7 monolitik MVP referansı
│
├── firestore.rules                      # ✅ Production'da publish edilmiş
├── firestore.indexes.json
├── firebase.json
├── .firebaserc
├── netlify.toml                         # ✅ Production deploy config
├── index.html, package.json
├── vite.config.js, tailwind.config.js, postcss.config.js
├── .env (gitignore'da), .env.example
├── .gitignore                           # .claude/, .netlify/ ignored
├── CLAUDE.md                            # Kurucu doküman
└── README.md                            # Quick start + deploy
```

---

## 🛠️ Teknoloji Stack

| Katman | Teknoloji | Versiyon | Durum |
|---|---|---|---|
| Build | Vite | 5.4 | ✓ |
| UI | React | 18.3 | ✓ |
| Styling | Tailwind | 3.4 | ✓ |
| Icons | lucide-react | 0.460 | ✓ |
| Backend | Firebase Firestore | 10.13 | ✓ + Rules |
| Auth | Firebase Auth | 10.13 | ✓ |
| Kur | Frankfurter API | n/a | ⚠ Production CORS test edilecek |
| Hosting | Netlify | n/a | ✓ Continuous deploy |
| Domain | GoDaddy → Netlify DNS | n/a | ✓ |
| SSL | Let's Encrypt | n/a | ✓ Otomatik yenileme |

---

## 🔄 Migration Sistemi

`runMigrations()` `App.jsx > Bootstrap` içinde, **user login olduktan sonra** çalışır:
- migrate_v01_kanallar (5 kanal)
- migrate_v02_giderKategorileri (8 kategori)
- migrate_v03_hesaplar (3 hesap)

Idempotent: `_meta/flags` doc'unda `seeded_v01_*` flag'leri ile kontrol; tekrar çalıştırma sorun değil.

---

## ⚖️ Kritik Mimari Kuralları

### Para Birimi
1. `tahsilat.paraBirimi == hesap.paraBirimi` zorunlu.
2. `tutarAna` her zaman ana PB karşılığı.
3. Hesap bakiyesi hesabın kendi PB'sinde.
4. Döviz transferi ayrı fonksiyon (`yapDovizTransfer`).
5. Manuel kur override localStorage'da.

### Otelcilik / Gece Mantığı
1. Bar yatılan gecelerin hücrelerini TAM kaplar.
2. Gece sayısı = `diffDays(giris, cikis)`.
3. `computeBar` — son yatılan gece = `addDays(cikis, -1)`.
4. Çakışma kontrolü segment-aware.
5. Tek hesap, çok segment.

### Atomik İşlemler
1. Tahsilat + hareket BİRLİKTE (`writeBatch`).
2. Gider + hareket BİRLİKTE.
3. Transfer = 2 hareket BİRLİKTE.
4. Update/Delete: eski hareketler önce silinir, yenisi yazılır.

### React/Firestore
1. Compound `where()` kullanma.
2. `onSnapshot` callback'inde async/await yok.
3. Tek otel varsayımı.

---

## 🧪 Sahada İlk Kullanım Akışı (production senaryosu)

İlk kez canlı sistemi kullanırken:

1. **Login:** https://hoteluter.com → `mmertefe9@gmail.com` + Firebase Console'da set ettiğin şifre
2. **Migration otomatik çalışır** (görünmez, ilk login'de Firestore'a 5 kanal + 8 kategori + 3 hesap yazılır)
3. **Ayarlar > Otel Bilgileri** → otel adı, telefon, vergi no, **ana para birimi** (varsayılan EUR)
4. **Ayarlar > Para Birimi & Kur** → kur servisi durumu kontrol et (Frankfurter API CORS sorun çıkarsa burada görünür)
5. **Odalar > Oda Tipleri** → en az 1 tip ekle (Standart, Deluxe vb. + kapasite + varsayılan fiyat + renk)
6. **Odalar > Odalar** → fiziksel odalar (oda no + tip + kat)
7. **Misafirler** → en az 1 misafir ekle (rezervasyon yapabilmek için) — veya doğrudan rezervasyon formundaki combobox ile inline ekle
8. **Takvim/Rezervasyonlar** → ilk rezervasyon (drag-to-create en hızlı yol)

İlk başarılı rezervasyondan sonra Dashboard KPI'ları, Calendar bar render'ı ve Raporlar grafiği dolmaya başlar.

---

## ⚠️ Bilinen Sınırlamalar / TODO (v1.1+)

| Konu | Durum | Çözüm önerisi |
|---|---|---|
| **Frankfurter API CORS** | Lokal'de çalışıyor; production'da CORS sorunu çıkabilir | Alternatif: `exchangerate.host` veya TCMB EVDS proxy via Cloud Function |
| **Yeni kullanıcı oluşturma — oturum-değişimi** | Firebase client-side davranışı; uyarı banner ile bildiriliyor | Cloud Functions admin SDK |
| **Modül bazlı incelikli yetki (server-side)** | Şu an client-side `can()` ile filtreli; server-side tüm aktif user r/w | Server-side rol-based rules + Cloud Functions |
| **Mobile drag-to-move** | HTML5 drag-and-drop API mobile'da kısıtlı | Touch event handlers (CalendarPage) |
| **Yedekleme: import** | Sadece export var (JSON download) | Import wizard + validation |
| **Bundle code splitting** | 1.55MB initial yükleme; tek bundle | `manualChunks` + dynamic import (sayfa bazlı) — 1.55MB → ~200KB initial |
| **Update rule `modulYetkileri` serbest** | Kullanıcı teorik olarak kendi modulYetkileri'ni değiştirebilir | Server-side incelikli yetkiye geçildiğinde rol/aktif/modulYetkileri üçünü sabitle |
| **Combobox klavye navigasyonu** | Sadece mouse | Ok tuşu + Enter ile öneri seçimi |
| **Password reset UI** | Yok | "Şifremi unuttum" akışı (Firebase email reset) |
| **Email değişimi (düzenleme)** | UI'da disabled (admin SDK gerektirir) | Cloud Functions |
| **Şifre değişimi UI** | KullaniciFormModal'da yok; `useAuth().changePassword` API var | Profil sayfası + form |
| **Multi-property** | Tek otel varsayımı (`otel/main` singleton) | `oteliId` foreign key + tenant-aware rules |
| **`hesaplar` para birimi seed** | İlk migration'da otel anaParaBirimi henüz set edilmemiş olabilir → EUR'a düşer | Settings tour'undan sonra düzelt |
| **Oda durumu** | Sadece UI gösterimi, takvim render'ını etkilemez | Durum-bazlı render (musait/temizlik/arıza) |
| **Mükerrer misafir kaydı** | Combobox'ta "Mert Efe" + "mert efe" ayrı kayıt yaratılabilir | Save sırasında "potansiyel duplikat" uyarısı |

---

## 📝 İşbirliği Notları (yeni Claude session'lar için)

**Mert'in çalışma stili:**
- Detaylı planlama → side-effect açıklaması → onay → uygulama
- Token-heavy, dikkatli yanıtlar
- Türkçe iletişim
- Her sürüm için ayrı doküman tut (`docs/CLAUDE_HOTELUTER_vN.N.md`)

**Kod stili (proje genelinde tutarlı):**
- Türkçe değişken/fonksiyon isimleri (rezervasyon, misafir, tahsilat, kur, ana...)
- İngilizce React/JS API'leri (useState, useEffect, useMemo)
- JSDoc başlıkları her dosyada
- 2 space indent, hard tab yok
- Modal save() pattern: `try { await ...; show('ok'); onSaved?.(); onClose?.(); } catch (e) { show(e.message, 'error'); }`

**Geliştirme akışı:**
- Lokal: `npm run dev` → http://localhost:5173 → değişiklikler HMR ile anlık
- Test: `npm run build` yeşil olmadan commit etme
- Deploy: `git push origin main` → Netlify otomatik build (~2 dk)
- Domain'de smoke test: https://hoteluter.com → login → CRUD

---

**Bu dosya, yeni Claude session başlarken İLK okuyacağın 2. dokümandır** (1.'si CLAUDE.md). v1.0-rc dokümanı artık eski — bu dosya onun yerini aldı.

Yeni bir feature veya bug fix sürümü çıkarsa (v1.1, v1.1.1, v1.2, ...) yeni bir `docs/CLAUDE_HOTELUTER_vN.N.md` doğsun ve bu dosya "önceki sürüm" referansı olarak kalsın.
