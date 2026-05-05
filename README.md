# Hoteluter

Otel Yönetim Sistemi (PMS) — React + Vite + Firebase + Tailwind

## 🚀 İlk Kurulum

### Önkoşullar
- **Node.js 18+** ([nodejs.org](https://nodejs.org))
- **npm** (Node ile birlikte gelir)
- Firebase projesi (Görev 1'de hazırlandı)

### Adımlar

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcı otomatik açılır: `http://localhost:5173`

İlk açılışta yeşil yazı görmelisin: **"✓ Firebase bağlandı"**

---

## 📁 Proje Yapısı

```
hoteluter/
├── public/                 # Statik dosyalar (favicon vs.)
├── src/
│   ├── lib/                # Firebase, db adapter, auth, kur, helpers
│   ├── helpers/            # Tahsilat, gider, transfer, segment helper'ları
│   ├── components/         # Reusable: Sidebar, Modal, Icon, Toast, ...
│   ├── modals/             # Form modalları: ReservationForm, Split, Tahsilat...
│   ├── pages/              # Sayfa componentleri: Dashboard, Calendar, ...
│   │   ├── reports/        # Reports alt-sekmeler
│   │   └── settings/       # Settings alt-sekmeler
│   ├── styles/
│   │   └── globals.css     # Tasarım sistemi + design tokens
│   ├── App.jsx             # Ana router + auth provider
│   └── main.jsx            # React entry
├── index.html
├── .env                    # Firebase config (gitignore'da)
├── .env.example            # Şablon
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 🔧 Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (HMR ile) |
| `npm run build` | Production build (`dist/` klasörüne) |
| `npm run preview` | Build sonrası lokal önizleme |

---

## 🔐 Environment Variables

`.env` dosyası **git'e commit edilmez**. Yeni bir bilgisayarda kurarken:

1. `.env.example`'ı kopyala → `.env` adında kaydet
2. Firebase Console'dan config değerlerini al
3. `.env`'deki `VITE_FIREBASE_*` değerlerine yapıştır

---

## 📦 Versiyon Geçmişi

- **v0.1 → v0.7** — Tek HTML dosyalı MVP iterasyonları (lokal localStorage)
- **v1.0** — Modüler React + Vite + Firebase + Netlify production

---

## 🎨 Tasarım Sistemi

Editorial boutique hotel estetiği:
- **Renkler:** bone (#f4ede0), forest (#1f3a2e), brass (#a87842)
- **Fontlar:** Fraunces (display) + DM Sans (body)
- **Tasarım tokenları:** `src/styles/globals.css` `:root` bölümünde

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite 5, Tailwind 3
- **Backend:** Firebase Firestore (NoSQL DB) + Firebase Auth
- **Icons:** lucide-react
- **Deploy:** Netlify (CD via GitHub)
- **Domain:** hoteluter.com
