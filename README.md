# Hoteluter

> Otel Yönetim Sistemi (PMS) — React + Vite + Firebase + Tailwind

**Sürüm:** v1.0 (production) 🚀
**Production:** https://hoteluter.com (canlı)

---

## 🚀 Quick Start

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Environment dosyasını hazırla
cp .env.example .env
# .env'i aç, Firebase Console'dan alınan VITE_FIREBASE_* değerlerini yaz

# 3. Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcı `http://localhost:5173` (port doluysa 5174 vs.) adresini açar.

İlk açılışta:
- **Login:** Firebase Auth (Email/Password). İlk superadmin Firebase Console'dan manuel oluşturuldu.
- **Migration otomatik:** 5 kanal + 8 gider kategorisi + 3 hesap (EUR cinsinden) Firestore'a yazılır
- **Demo veri yok** — kendi otel datanı sıfırdan kuruyorsun

---

## ✅ Sahada Test Akışı (7 Adım)

İlk kez kullanırken bu sırayı izle:

1. **Login** — Firebase Auth ile gerçek email/şifre
2. **Migration otomatik çalışır** (görünmez, idempotent)
3. **Ayarlar > Otel Bilgileri** → otel adı, ana para birimi (EUR varsayılan)
4. **Odalar > Oda Tipleri** → en az 1 tip ekle (ad + kapasite + fiyat + renk)
5. **Odalar > Odalar** → fiziksel odaları ekle (no + tip + kat)
6. **Misafirler** → en az 1 misafir ekle
7. **Takvim** → boş hücreye **basıp sürükle** (drag-to-create) veya **+Yeni Rezervasyon** butonu

İlk rezervasyondan sonra Dashboard KPI'ları, Calendar bar render'ı ve Raporlar grafiği dolmaya başlar.

---

## 🔧 Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (HMR) |
| `npm run build` | Production build (`dist/` klasörüne) |
| `npm run preview` | Build sonrası lokal önizleme |

---

## 📁 Dosya Yapısı (özet)

```
src/
├── App.jsx                    # AuthProvider + ToastProvider + AppShell + PAGE_MAP
├── lib/                       # firebase, db, auth-mock, kur, helpers, constants, permissions, migrations
├── helpers/                   # tahsilat, gider, transfer, segmentler, exchange-utils
├── components/                # Sidebar, Modal, ConfirmModal, Icon, Toast, ListPageShell
├── modals/                    # 11 modal: Tahsilat, Gider, Transfer, HesapForm, HesapDetay,
│                              #          ReservationForm, Split, Misafir, OdaTip, Oda, Kullanici
├── pages/                     # 10 sayfa: Login, Dashboard, Calendar, ReservationList,
│                              #          Guests, Rooms, Accounting, Reports, Settings, Users
└── styles/globals.css         # Tasarım sistemi tokens + .htl-* class'ları
docs/
├── CLAUDE_HOTELUTER_v1.0-alpha.md   # ⭐ Şu anki sürümün tam fotoğrafı
├── HOTELUTER_GECIS_PLANI.md         # 12 görevlik yol haritası
└── backup/hoteluter-v0.7-final.html # v0.7 monolitik MVP (referans)
```

Detaylı dosya listesi: `docs/CLAUDE_HOTELUTER_v1.0-alpha.md`

---

## 🛠️ Tech Stack

- **Frontend:** React 18 · Vite 5 · Tailwind 3
- **Backend:** Firebase Firestore (NoSQL) · Firebase Auth (Email/Password) · Firestore Security Rules
- **Icons:** lucide-react
- **Kur servisi:** Frankfurter API (ECB)
- **Deploy:** Netlify (continuous deployment via GitHub)

---

## 🔐 Environment Variables

`.env` dosyası **git'e commit edilmez** (`.gitignore`'da). Gerekli değişkenler:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Firebase Console → Project Settings → SDK setup'tan alınır.

---

## 🎨 Tasarım Sistemi

Editorial boutique hotel estetiği:
- **Renkler:** bone (#f4ede0), forest (#1f3a2e), brass (#a87842)
- **Fontlar:** Fraunces (display) + DM Sans (body)
- **Tasarım tokenları:** `src/styles/globals.css` `:root` bölümünde (CSS custom properties)

---

## 🚀 Deploy

**Production URL:** https://hoteluter.com
**Yedek URL:** https://hoteluter.netlify.app

### Continuous Deployment

GitHub repo'ya `main` branch'e push → Netlify otomatik build alır:

```bash
git push origin main
# → Netlify "Deploys" sekmesinde build başlar (~2 dk)
# → Başarılı build sonrası canlı URL anında güncellenir
```

Build config: `netlify.toml` (proje kökünde) — build command, publish dir, SPA redirect, security headers, cache policy.

### Environment Variables (Netlify'da)

`.env` dosyası git'e commit **edilmez** (`.gitignore`'da). Netlify deploy için aynı değerler **Netlify dashboard'da ayrıca tanımlanmalı**:

`Site settings → Environment variables → Add variable`

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Lokal `.env` ile aynı değerler. Vite build sırasında `VITE_*` prefix'li env vars bundle'a embed olur.

### Firebase Authorized Domains

Netlify URL'i (örn. `cosmic-hamster-1234.netlify.app` ve sonradan `hoteluter.com`) **Firebase Console > Authentication > Settings > Authorized domains**'e eklenmeli — aksi halde production'da login çalışmaz (`auth/unauthorized-domain`).

---

## 📦 Versiyon Geçmişi

- **v0.1 → v0.7** — Tek HTML dosyalı MVP iterasyonları (lokal localStorage). Final: `docs/backup/hoteluter-v0.7-final.html` (~6500 satır)
- **v1.0-alpha** — Modüler React + Vite + Firebase, mock auth (Faz 1+2)
- **v1.0-beta** — Gerçek Firebase Auth bağlandı (mock kalktı)
- **v1.0-rc** — Firestore Security Rules + Netlify deploy hazırlığı
- **v1.0** — Production deploy + hoteluter.com canlı + 2 bug fix (BU) ✅

---

## 🚦 Faz Durumu

| Faz | Görev | Durum |
|---|---|---|
| 1. Hazırlık | 1. Firebase projesi · 2. Local environment | ✅ |
| 2. Modülerleştirme | 3-7. Vite + lib + components + modals + pages | ✅ |
| 3. Firestore | 8. Şema · 9. Auth · 10. Security Rules | ✅ |
| 4. Deploy | 11. Netlify · 12. Domain | ✅ |

**12/12 görev tamamlandı.** Sistem v1.0 ile production'da. Sıradaki: sahada kullanım + bug raporları + feature istekleri (v1.1+).

Detaylı: `docs/HOTELUTER_GECIS_PLANI.md`

---

## 📚 Yeni Claude Session Başlarken

1. **`CLAUDE.md`** — proje kuruluş dokümanı + mimari kuralları
2. **`docs/CLAUDE_HOTELUTER_v1.0.md`** — production sistemin tam fotoğrafı (URL'ler, Auth, Rules, bug fix kayıtları, v1.1+ TODO listesi)
3. **`docs/HOTELUTER_GECIS_PLANI.md`** — kapanmış geçiş planı (referans için)

Bu üç dosya yeterli context verir.
