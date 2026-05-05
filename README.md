# Hoteluter

> Otel Yönetim Sistemi (PMS) — React + Vite + Firebase + Tailwind

**Sürüm:** v1.0-alpha — sahada test öncesi
**Domain:** hoteluter.com (Görev 12'de bağlanacak)

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
- **Login:** mock auth aktif (Görev 9'a kadar) — herhangi bir email/şifre ile giriş yapabilirsin
- **Migration otomatik:** 5 kanal + 8 gider kategorisi + 3 hesap (EUR cinsinden) Firestore'a yazılır
- **Demo veri yok** — kendi otel datanı sıfırdan kuruyorsun

---

## ✅ Sahada Test Akışı (7 Adım)

İlk kez kullanırken bu sırayı izle:

1. **Login** — herhangi bir email/şifre (mock)
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
- **Backend:** Firebase Firestore (NoSQL) · Firebase Auth (Görev 9'da bağlanacak)
- **Icons:** lucide-react
- **Kur servisi:** Frankfurter API (ECB)
- **Deploy:** Netlify (Görev 11'de)

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

## 📦 Versiyon Geçmişi

- **v0.1 → v0.7** — Tek HTML dosyalı MVP iterasyonları (lokal localStorage). Final: `docs/backup/hoteluter-v0.7-final.html` (~6500 satır)
- **v1.0-alpha** — Modüler React + Vite + Firebase, mock auth, sahada test öncesi (BU)
- **v1.0** — Gerçek Auth + Security Rules + Netlify deploy (planlı)

---

## 🚦 Kalan Görevler

| Faz | Görev | Durum |
|---|---|---|
| 3. Firestore | 9. Firebase Auth bağlama | ⏳ |
| 3. Firestore | 10. Firestore Security Rules | ⏳ |
| 4. Deploy | 11. GitHub + Netlify deploy | ⏳ |
| 4. Deploy | 12. hoteluter.com domain | ⏳ |

Detaylı: `docs/HOTELUTER_GECIS_PLANI.md`

---

## 📚 Yeni Claude Session Başlarken

1. **`CLAUDE.md`** — proje kuruluş dokümanı
2. **`docs/CLAUDE_HOTELUTER_v1.0-alpha.md`** — şu anki sistemin tam fotoğrafı
3. **`docs/HOTELUTER_GECIS_PLANI.md`** — kalan görevler

Bu üç dosya yeterli context verir.
