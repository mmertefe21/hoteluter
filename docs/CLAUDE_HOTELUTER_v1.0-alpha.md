# CLAUDE_HOTELUTER_v1.0-alpha

> **Sürüm:** v1.0-alpha (sahada test öncesi)
> **Tarih:** 05.05.2026
> **Önceki:** v0.7 (tek HTML, localStorage)
> **Sonraki:** v1.0 (gerçek Auth + Security Rules + Netlify deploy)

Bu doküman, v0.7 monolitik HTML'den v1.0 modüler React + Firebase mimarisine geçişin **alpha** durumunu kayıt altına alır. Sistem teknik olarak çalışır vaziyettedir, mock auth kullanır ve sahada test edilmeye hazırdır.

---

## 📐 Mimari Özet

```
┌────────────────────────────────────────────────────────┐
│  Tarayıcı (React + Vite + Tailwind 3)                  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ AuthProvider │→ │ ToastProvider│→ │ AppShell     │  │
│  │ (mock auth)  │  │ (toaster UX) │  │ (sidebar +   │  │
│  └──────────────┘  └──────────────┘  │  page render)│  │
│                                       └──────────────┘  │
│         ↓ db.* / useCollection / useDoc                 │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Firebase (Cloud)                                       │
│  ┌────────────────┐  ┌────────────────────────────┐    │
│  │ Firestore      │  │ Auth (henüz bağlı değil —  │    │
│  │ (12 koleksiyon)│  │  Görev 9'da bağlanacak)    │    │
│  └────────────────┘  └────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Yardımcı: Frankfurter API (ücretsiz, kur servisi)      │
│  Yardımcı: localStorage (kur cache + manuel kur)        │
└────────────────────────────────────────────────────────┘
```

---

## 📁 Dosya Yapısı (35+ dosya)

```
hoteluter/
├── src/
│   ├── main.jsx                          # React entry
│   ├── App.jsx                           # AuthProvider + ToastProvider + AppShell + PAGE_MAP
│   │
│   ├── lib/                              # Çekirdek altyapı
│   │   ├── firebase.js                   # initializeApp + getAuth + getFirestore
│   │   ├── db.js                         # Firestore adapter (list/get/add/update/delete/batch/subscribe + useCollection/useDoc)
│   │   ├── auth.js                       # Firebase Auth Provider (Görev 9'da kullanılacak)
│   │   ├── auth-mock.jsx                 # ⚠️ Geçici mock — useAuth API yüzeyi gerçeğiyle aynı
│   │   ├── kur.js                        # Frankfurter fetch + localStorage cache + manuel override + cevirKur
│   │   ├── helpers.js                    # todayISO, addDays, diffDays, fmtMoney, fmtDateTR, generateRezKodu, isWeekend, ...
│   │   ├── constants.js                  # PARA_BIRIMI_OPTS, HESAP_TIP_OPTS, HAREKET_TIP_OPTS, DURUM_OPTS, ODEME_OPTS, PANSIYON_OPTS, DEFAULT_*
│   │   ├── permissions.js                # ALL_MODULES + AKSIYON_LABELS + ROLE_LABELS
│   │   └── migrations.js                 # 3 migration: kanallar/giderKategorileri/hesaplar (idempotent flag pattern)
│   │
│   ├── helpers/                          # Domain logic (atomik DB işlemleri)
│   │   ├── tahsilat.js                   # add/update/delete TahsilatWithHareket (writeBatch, PB kontrolü)
│   │   ├── gider.js                      # add/update/delete GiderWithHareket (simetrik)
│   │   ├── transfer.js                   # yapTransfer (aynı PB) + yapDovizTransfer (farklı PB) + addManuelHareket
│   │   ├── segmentler.js                 # getOdaSegmentleri + checkOverlap (segment-aware)
│   │   └── exchange-utils.js             # getHesapBakiye / getHesapBakiyeAna / getRezervasyonOdenen / ...
│   │
│   ├── components/                       # Reusable UI
│   │   ├── Icon.jsx                      # lucide-react wrapper, kebab-case isim → PascalCase lookup
│   │   ├── Modal.jsx                     # backdrop + size sm/md/lg + footer + Esc
│   │   ├── ConfirmModal.jsx              # Modal üzerine onay diyaloğu
│   │   ├── Toast.jsx                     # ToastProvider + useToast() hook + 3sn auto-dismiss
│   │   ├── Sidebar.jsx                   # ALL_MODULES'tan dinamik link + canSeeModule injection + mobile drawer
│   │   └── ListPageShell.jsx             # Liste sayfaları için ortak iskele (başlık + arama + Yeni)
│   │
│   ├── modals/                           # Form modalleri (11)
│   │   ├── TahsilatModal.jsx             # Rezervasyona bağlı/bağımsız + PB filtreli hesap + kur paneli
│   │   ├── GiderModal.jsx                # Kategori kart-style + simetrik kur paneli
│   │   ├── TransferModal.jsx             # normal/doviz tab + kur sapma uyarısı
│   │   ├── HesapFormModal.jsx            # Tip kart-style + PB (düzenlemede kilitli eğer hareket varsa)
│   │   ├── HesapDetayModal.jsx           # size=lg + filtreler + manuel hareket + canDelete
│   │   ├── ReservationFormModal.jsx      # ⭐ EN BÜYÜK: misafir/oda/tarih/fiyat (3 mod) + ödeme bölümü + entegre TahsilatModal
│   │   ├── SplitModal.jsx                # Yeni böl + bölmeyi geri al
│   │   ├── MisafirFormModal.jsx          # CRUD: ad/soyad/kimlik/iletişim/adres
│   │   ├── OdaTipFormModal.jsx           # CRUD: ad/kapasite/fiyat/renk picker
│   │   ├── OdaFormModal.jsx              # CRUD: oda no/kat/tip/durum
│   │   └── KullaniciFormModal.jsx        # CRUD: ad/email/rol + yetki matrix (Görev 9'da auth bağlanır)
│   │
│   ├── pages/                            # Üst-seviye sayfalar (10)
│   │   ├── LoginScreen.jsx               # Mock — herhangi bir email/şifre geçer
│   │   ├── DashboardPage.jsx             # 4 KPI + Bu Ayın İstatistikleri (6 satır) + 3 tablo
│   │   ├── CalendarPage.jsx              # Gantt 7/15/30 gün + drag-to-create + drag-to-move + makas
│   │   ├── ReservationListPage.jsx       # Tablo + durum/tip/arama filtreleri
│   │   ├── GuestsPage.jsx                # ListPageShell + MisafirFormModal
│   │   ├── RoomsPage.jsx                 # 2 sekme: Odalar + Oda Tipleri
│   │   ├── AccountingPage.jsx            # 4 sekme + 5 modal: Hesaplar/Tahsilat/Gider/Hareket
│   │   ├── ReportsPage.jsx               # 2 sekme: Tarih Aralığı + Yıllık Ciro (custom SVG bar chart)
│   │   ├── SettingsPage.jsx              # 6 sekme: Otel/Kur/Kanallar/Kategoriler/Yedek/Kullanıcılar
│   │   └── UsersPage.jsx                 # embedded prop ile Settings içinde de gösterilir
│   │
│   └── styles/
│       └── globals.css                   # Tailwind directives + design tokens (:root) + .htl-* class'lar
│
├── docs/
│   ├── CLAUDE_HOTELUTER_v0.1.md → v0.7.md  # Önceki sürüm tarihçeleri
│   ├── CLAUDE_HOTELUTER_v1.0-alpha.md       # ⬅ BU DOSYA
│   ├── HOTELUTER_GECIS_PLANI.md             # 12 görevlik yol haritası
│   └── backup/
│       └── hoteluter-v0.7-final.html        # v0.7 monolitik MVP (referans için)
│
├── public/                               # Statik dosyalar (favicon)
├── index.html                            # Vite entry HTML
├── package.json                          # firebase + lucide-react + react-dom + vite + tailwind
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env                                  # Firebase config (gitignore'da)
├── .env.example                          # Şablon
├── .gitignore                            # node_modules, dist, .env, .vite vs.
├── CLAUDE.md                             # Proje kuruluş dokümanı
└── README.md                             # Quick start
```

---

## 🛠️ Teknoloji Stack

| Katman | Teknoloji | Versiyon | Not |
|---|---|---|---|
| Build | Vite | 5.4 | HMR + production build (1632 modül, ~1.5MB gzip) |
| UI | React | 18.3 | Hooks-only, class component yok |
| Styling | Tailwind | 3.4 | + design tokens + .htl-* class'lar |
| Icons | lucide-react | 0.460 | Dinamik isim lookup (Icon wrapper) |
| Backend | Firebase Firestore | 10.13 | NoSQL, real-time subscribe (`useCollection`) |
| Auth | Firebase Auth | 10.13 | **Henüz bağlı değil** — mock auth aktif |
| Kur | Frankfurter API | n/a | Ücretsiz ECB kur servisi, key gerektirmez |
| Hosting | Netlify (planlı) | n/a | Görev 11'de bağlanacak |

---

## 🔑 Mock Auth Durumu

`src/lib/auth-mock.jsx` — geçici provider:

```js
const MOCK_USER = {
  id: 'mock-superadmin',
  kullaniciAdi: 'admin',
  adSoyad: 'Mert Efe',
  email: 'mert@hoteluter.com',
  rol: 'superadmin',  // tüm yetkiler
  aktif: true,
};
```

**API yüzeyi gerçek `auth.js` ile birebir aynı:**
- `useAuth()` → `{ user, authReady, login, logout, can, refreshUser, changePassword }`
- `<AuthProvider>` sarmalar
- `can(modul, aksiyon)` → superadmin için her zaman true

**Görev 9'da yapılacak swap (tek değişiklik):**
- 9 dosyadaki `'./lib/auth-mock.jsx'` import'larını `'./lib/auth.js'`'a çevir
- `auth-mock.jsx`'i sil
- İlk superadmin kullanıcı için Firebase Auth + Firestore `users/{uid}` dokümanı oluştur (manuel veya seed script)

**Login ekranı:** `LoginScreen.jsx` herhangi bir email/şifre kabul eder, mock user'a giriş yaptırır. Görev 9'da gerçek Firebase Auth bağlanır.

---

## 🔄 Migration Sistemi

`src/lib/migrations.js` — idempotent boot çağrısı:

```js
runMigrations()  // App.jsx Bootstrap mount'unda otomatik
  → migrate_v01_kanallar           // 5 default kanal
  → migrate_v02_giderKategorileri  // 8 default kategori
  → migrate_v03_hesaplar           // 3 default hesap (anaParaBirimi'nde)
```

**Flag pattern:** Her migration `_meta/flags` dokümanında bir flag set eder (`seeded_v01_kanallar` vs.). Tekrar çalıştırılsa flag varsa skip eder. Yani App'i her açtığında çalışsa bile sorun yok.

**Demo veri YOK:** Mert otelini sıfırdan kuracak. Sadece sistemin çalışması için gerekli minimum kayıtlar seed edilir. Oda tipi, oda, misafir, rezervasyon = sıfır.

---

## ⚖️ Kritik Kurallar

### Para Birimi
1. **`tahsilat.paraBirimi == hesap.paraBirimi` zorunlu.** USD ödeme USD hesabına. Helper bunu throw ile zorlar; UI bunu filtreyle önler.
2. **`tutarAna` her zaman ana PB karşılığı.** Raporlamada bu kullanılır. Helper otomatik hesaplar.
3. **Hesap bakiyesi hesabın kendi PB'sinde.** EUR Kasa = EUR cinsinden. UI'da gösterirken o PB ile.
4. **Döviz transferi ayrı fonksiyon (`yapDovizTransfer`).** Kullanıcı kuru zımni belirler (çıkan + giren tutar). Otomatik kur referansı gösterilir, sapma >5% uyarı.
5. **Manuel kur override** localStorage'da (`hoteluter_manuel_kurlar`). Canlı kur (Frankfurter) bağlanamadığında veya özel bir kur sabitlemek için.

### Otelcilik / Gece Mantığı
1. **Bar yatılan gecelerin hücrelerini TAM kaplar.** 4 Mayıs giriş + 6 Mayıs çıkış → 4 ve 5 hücreleri dolu, 6 boş (sabah check-out).
2. **Gece sayısı = `diffDays(giris, cikis)`** (giriş 4 + çıkış 6 → 2 gece).
3. **`computeBar(giris, cikis)`** — son yatılan gece = `addDays(cikis, -1)`. Bar `[startIdx, endIdx]` aralığını tam kaplar (left + width hesaplaması cellWidth bazlı).
4. **Çakışma kontrolü segment-aware:** `getOdaSegmentleri(rez)` → tek sanal segment (bölünmemiş) veya array (bölünmüş). `checkOverlap` tüm segmentleri tarar.
5. **Tek hesap, çok segment:** Bölünmüş rez tek kayıt kalır. `segmentler[]` array'i + ana `odaId/girisTarihi/cikisTarihi` ilk segment + son çıkış senkron tutulur (geriye uyum).

### Atomik İşlemler
1. **Tahsilat + hesap hareketi BİRLİKTE** (`writeBatch`). Birinin başarısız olması diğerini de iptal eder.
2. **Gider + hesap hareketi BİRLİKTE** (negatif tutar).
3. **Transfer = 2 hesap hareketi BİRLİKTE** (`transferId` ile bağlı, çıkış − + giriş +).
4. **Update/Delete'te eski hareketler önce silinir, yenisi yazılır.** `tahsilatId/giderId/transferId` ile eşleşen tüm hareket kayıtları temizlenir.

### React/Firestore
1. **Compound `where()` kullanma** — Firestore composite index gerektirir.
2. **`onSnapshot` callback'inde async/await yok** — yan etkili işlemleri callback dışında yap.
3. **Real-time data:** `useCollection('rezervasyonlar')` → değişiklikler otomatik state'e yansır.
4. **Tek otel varsayımı** — `oteliId` foreign key yok. Multi-property v1.0 sonrası.

---

## 🧪 Sahada İlk Kullanım Akışı

Sıfır veri ile sistem ilk açıldığında izlenecek 7 adımlık akış:

1. **Login** — herhangi bir email/şifre (mock).
2. **Migration otomatik çalışır** (görünmez): 5 kanal + 8 gider kategorisi + 3 hesap (EUR cinsinden) Firestore'a yazılır. `_meta.seeded_v0*` flag'leri set edilir.
3. **Ayarlar > Otel Bilgileri** → otel adı, telefon, email, vergi no, **ana para birimi** (varsayılan EUR).
4. **Odalar > Oda Tipleri sekmesi** → en az bir oda tipi ekle (Standart, Deluxe vb. + kapasite + varsayılan fiyat + renk).
5. **Odalar > Odalar sekmesi** → fiziksel odaları ekle (oda numarası + tip + kat).
6. **Misafirler** → en az bir misafir ekle (rez yapabilmek için).
7. **Takvim veya Rezervasyonlar** → yeni rezervasyon oluştur. Takvimde **boş hücreye basıp sürükleyerek** drag-to-create kullanabilirsin (en hızlı yol).

İlk başarılı rezervasyondan sonra:
- Dashboard KPI'ları görünür
- Calendar bar gece-bazlı render olur
- Ödeme alındığında Ön Muhasebe > Hesaplar bakiyesi yansır
- Raporlar sekmesi yıllık ciro grafiğini doldurmaya başlar

---

## ⚠️ Bilinen Sınırlamalar (v1.0-alpha)

| Konu | Durum | Görev |
|---|---|---|
| **Firebase Auth** | Mock — herhangi giriş geçer | Görev 9 |
| **Firestore Security Rules** | Açık (default `allow read, write`) — production'a gitmemeli | Görev 10 |
| **Kullanıcı oluşturma** | UI var ama sadece Firestore'a yazıyor (Auth user yaratmıyor) | Görev 9 |
| **Mobile drag-to-move** | HTML5 drag-and-drop API mobile'da kısıtlı | UX iyileştirme |
| **Yedekleme: import** | Sadece export var (JSON download). Import henüz yok. | Görev 10 sonrası |
| **Bundle boyutu** | 1.53MB (gzip 325KB) — code splitting yok | Optimizasyon (sonra) |
| **Multi-property** | Tek otel varsayımı (`otel/main` singleton) | v1.0 sonrası |
| **Kullanıcı yetki uygulaması** | `can()` çağrıları her sayfada var ama mock auth her zaman true döner | Görev 9 |
| **`hesaplar` para birimi seed** | `runMigrations` boot'ta çalıştığında otel anaParaBirimi henüz set edilmemiş olabilir → EUR'a düşer | İlk Settings tour'undan sonra hesabı düzenleyip PB değiştir gerekirse |
| **Oda durumu (musait/temizlik/ariza)** | Sadece UI'da gözükür, takvim render'ını etkilemez | UX iyileştirme |
| **Tahsilatlardan çağrılan tahsilat modal** | Rezervasyon detay modalinden açıldığında sadece o rezervasyon dropdown'da | Çalışıyor |

---

## 🔔 Yarına Hatırlatmalar (Sahada Test)

Test ederken özellikle gözden geçirmen gereken yerler:

### Calendar (en kritik)
- [ ] Drag-to-create boş hücre → ReservationFormModal prefill ile açılıyor mu?
- [ ] Çakışan tarih seçilince modal açılmamalı (cell zaten dolu görünmeli)
- [ ] Bar gece-bazlı kaplama doğru mu? (4 Mayıs giriş + 6 Mayıs çıkış → 4 ve 5 dolu, 6 boş)
- [ ] Edit Mode → bar başka odaya sürüklenebiliyor mu? Çakışma varsa kırmızı, yoksa yeşil overlay
- [ ] Onay modali sonrası oda gerçekten değişiyor mu?
- [ ] Edit Mode'da bar üzerindeki **makas butonu** (>60px barlarda) → SplitModal açılıyor mu?
- [ ] Bölünmüş rez'de 2 segment 2 ayrı bar olarak görünüyor mu? `1/2`, `2/2` etiketleri + link icon?
- [ ] Bölmeyi geri al butonu (undo-2 icon) çalışıyor mu?
- [ ] 7/15/30 gün toggle, tarih navigasyon, oda tipi filtresi
- [ ] Mobile'da hamburger butonu sidebar drawer açıyor mu?

### Rezervasyon Formu
- [ ] Yeni rez'de rezervasyonKodu otomatik üretiliyor mu (`HTL-202605-001` formatında)?
- [ ] Fiyat modu 3'ü de çalışıyor mu? (gece × geceSayısı / toplam paylaşımı / her gece ayrı)
- [ ] Detay modunda her gece ayrı input + toplam + ortalama doğru hesaplanıyor mu?
- [ ] Düzenleme modunda Ödeme & Bakiye paneli görünüyor mu?
- [ ] "Yeni Ödeme Al" butonu TahsilatModal'ı rezervasyon ID prefill ile açıyor mu?
- [ ] Çoklu PB tahsilat: USD ödeme alırken USD hesap dropdown filtrelenmiş geliyor mu?
- [ ] Kur paneli farklı PB'de çıkıyor mu? Canlı kur + manuel + ana PB önizleme?

### Ön Muhasebe (Accounting)
- [ ] Hesap kartlarına tıklayınca HesapDetayModal (size=lg) açılıyor mu?
- [ ] Detay modal'da filtreler (tip + tarih) çalışıyor mu?
- [ ] Manuel hareket eklenebiliyor mu (giris/cikis)?
- [ ] Tahsilat → bakiye + (yansıma anında, real-time)
- [ ] Gider → bakiye − (yansıma anında)
- [ ] Transfer (aynı PB) iki hesabı birden günceller mi?
- [ ] Döviz transfer + kur sapma uyarısı (>5%)
- [ ] Tahsilat/gider düzenleme + silme

### Raporlar
- [ ] Tarih Aralığı: Bugün/7gün/30gün/Bu Ay quick-select butonları
- [ ] Yıllık SVG bar chart düzgün render oluyor mu?
- [ ] Yıl < geçerli yıl ise navigasyon kısıtlı (gelecek yıl yok)

### Genel
- [ ] Sidebar'da modüller çıkıyor mu? (10 modül, kullanıcılar gizli)
- [ ] Sağ üst kullanıcı menüsü (avatar tıklayınca açılır) → Ayarlar + Çıkış
- [ ] Toast'lar sağ alttan beliriyor mu, 3 sn sonra kayboluyor mu?
- [ ] Modal Esc + backdrop tıklaması ile kapanıyor mu?
- [ ] Form validasyon mesajları (ad zorunlu, tutar > 0 vs.)

---

## 🚦 Sıradaki Adımlar (Görev 9-12 önizleme)

### Görev 9: Firebase Auth bağlama
- `lib/auth.js` zaten hazır (Görev 4'te yazılmıştı)
- 9 dosyada import path swap: `auth-mock.jsx` → `auth.js`
- `auth-mock.jsx` sil
- İlk superadmin kullanıcısını manuel oluştur (Firebase Console → Authentication → Add user, sonra Firestore Console → users/{uid} dokümanı el ile)
- LoginScreen gerçek Firebase Auth ile bağla (zaten `useAuth().login(email, password)` çağırıyor — sadece mock kalkacak)
- KullaniciFormModal'ın yeni kullanıcı oluşturma akışı `createUserWithProfile` ile bağla

### Görev 10: Firestore Security Rules
- `firestore.rules` dosyası
- Login zorunlu (`request.auth != null`)
- `users/{uid}` doc okuma kuralı (kendisi okur)
- Diğer koleksiyonlar için rol bazlı kuralar (superadmin/admin/kullanici)
- `_meta` koleksiyonu sadece migration'lar için
- Test: Firebase emulator + production'a deploy

### Görev 11: GitHub + Netlify deploy
- `netlify.toml` dosyası (build command, publish dir, env vars referansı)
- Netlify'da Firebase env vars set et (`VITE_FIREBASE_*`)
- GitHub repo bağla (continuous deploy)
- İlk deploy testi
- Build cache stratejisi

### Görev 12: hoteluter.com domain
- GoDaddy DNS → Netlify nameservers
- Netlify domain settings + Let's Encrypt SSL
- DNS propagation bekle (24h'a kadar)

---

## 📝 İşbirliği Notları

**Mert'in çalışma stili (önemli):**
- Detaylı planlama → side-effect açıklaması → onay → uygulama
- Token-heavy, dikkatli yanıtlar (acelesi yok)
- Büyük değişiklik öncesi mimari kararı netleştir
- Türkçe iletişim
- Sürüm dokümanı tut, sonraki sohbette devam edebilesin

**Kod stili (proje genelinde tutarlı):**
- Türkçe değişken/fonksiyon isimleri (rezervasyon, misafir, tahsilat, kur, ana, vs.)
- İngilizce React/JS API'leri (useState, useEffect, useMemo)
- JSDoc başlıkları her dosyada (amaç, kurallar, props açıklaması)
- Hard tab yok — 2 space indent
- Hook'lar fonksiyonun başında, return'den önce
- Modal save() pattern: `try { await ...; show('ok'); onSaved?.(); onClose?.(); } catch (e) { show(e.message, 'error'); }`

---

**Bu dosyayı yarın yeni Claude session başlarken İLK okuyacağın 2. dokümandır** (1.'si CLAUDE.md). Birlikte sistemin tam fotoğrafını verir.
