# HOTELUTER GEÇIŞ PLANI — v0.7 → v1.0 Production

> ## ✅ PLAN KAPANMIŞTIR (06.05.2026)
> **Tüm 12 görev tamamlandı + 2 kritik bug fix.** Sistem v1.0 ile production'da: https://hoteluter.com
> Bu doküman geçişten sorumluydu — geçiş tamam. Sonraki yol haritası ayrı dokümantasyonda tutulacak (v1.1+ release dokümanları).
> Bkz. final not (en altta) ve `docs/CLAUDE_HOTELUTER_v1.0.md`.

**Hedef:** Tek-dosya HTML MVP'sini production-ready bir SaaS'a çevirmek.

**Stack:** Vite + React + Tailwind + Firebase Firestore + Firebase Auth + Netlify + hoteluter.com

**Tarih:** 05.05.2026 başlangıç → 06.05.2026 kapanış (~24 saat aktif çalışma, 11 commit)

---

## 📋 12 GÖREV — Sıralı Yol Haritası

### ✅ FAZ 1: HAZIRLIK (1-2 saat)

#### Görev 1: Firebase projesi oluşturma
**Sen yapacaksın (5 dk):**
- console.firebase.google.com → "Add project" → "hoteluter"
- Google Analytics: kapalı (sade tut)
- Authentication → Sign-in method → **Email/Password** etkinleştir
- Firestore Database → "Create database" → **production mode** → eu-west-3 (Avrupa, Türkiye'ye en yakın)
- Project Settings → "Your apps" → Web app ekle → "hoteluter-web" → Firebase SDK config'i kopyala (apiKey, authDomain, projectId, vs.)

**Çıktı:** Firebase config snippet (.env'e koyacağız)

---

#### Görev 2: Local geliştirme ortamı kurulumu
**Sen yapacaksın (5 dk):**
- Node.js 18+ yüklü mü kontrol et: `node --version`
- VS Code veya tercih ettiğin editor
- Boş bir klasör hazırla: `C:\hoteluter` veya `/Users/mert/Documents/hoteluter`

**Ben yapacağım:**
- Vite + React + Tailwind kurulum komutlarını + initial config dosyalarını üretip vereceğim

---

### 🏗️ FAZ 2: MODÜLERLEŞTIRME (4-6 saat)

#### Görev 3: Vite projesi iskeleti ve klasör yapısı
**Ben yapacağım:**
- `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`
- `index.html`, `src/main.jsx`, `src/App.jsx`
- `src/styles/globals.css` (mevcut <style> içeriği taşınmış halde)
- Firebase init dosyası (`src/lib/firebase.js`) — env variables ile
- `.env.example`

**Sen yapacaksın:**
- Bu dosyaları kendi klasörüne kopyala
- `.env` dosyası oluştur, Firebase config'i yapıştır
- Terminal: `npm install` → `npm run dev` → çalışıyor mu kontrol

---

#### Görev 4: Lib & helpers modülleri
**Ben yapacağım:**
- `src/lib/db.js` — Firestore adapter (`db.list/get/add/update/delete` imzasını koruyarak Firebase Firestore'a wrap)
- `src/lib/auth.js` — Firebase Auth wrapper, AuthContext
- `src/lib/kur.js` — Frankfurter API + cache
- `src/lib/helpers.js` — `fmtMoney`, `addDays`, `todayISO`, `diffDays`, `fmtDateTR`, vs.
- `src/lib/permissions.js` — `ALL_MODULES`, `useAuth().can()`
- `src/lib/constants.js` — `PARA_BIRIMI_OPTS`, `HESAP_TIP_OPTS`, `DURUM_OPTS`, `HAREKET_TIP_OPTS`, vs.

- `src/helpers/tahsilat.js` — `addTahsilatWithHareket`, `deleteTahsilatWithHareket`, `updateTahsilatWithHareket`
- `src/helpers/gider.js` — gider CRUD
- `src/helpers/transfer.js` — `yapTransfer`, `yapDovizTransfer`
- `src/helpers/segmentler.js` — `getOdaSegmentleri`, `checkOverlap`

**Kritik nokta:** db.js Firestore'da çalışırken Firmasyon dersleri uygulanacak:
- Compound `where()` yok
- `onSnapshot` içinde async yok
- `writeBatch` ile atomik tahsilat+hareket

---

#### Görev 5: Reusable component modülleri
**Ben yapacağım:**
- `src/components/Sidebar.jsx`
- `src/components/Modal.jsx`
- `src/components/ConfirmModal.jsx`
- `src/components/Icon.jsx` (lucide-react, mevcut Icon API'si korundu)
- `src/components/ListPageShell.jsx`
- `src/components/Toast.jsx` + `ToastProvider`

**lucide-react paket olarak yüklenecek** (mevcut HTML'de window.lucide kullanıyorduk).

---

#### Görev 6: Modal modülleri
**Ben yapacağım:**
- `src/modals/ReservationFormModal.jsx`
- `src/modals/SplitModal.jsx`
- `src/modals/TahsilatModal.jsx` (AccountingPage içindeki büyük modal)
- `src/modals/GiderModal.jsx`
- `src/modals/HesapFormModal.jsx`
- `src/modals/HesapDetayModal.jsx`
- `src/modals/TransferModal.jsx`

Her modal kendi dosyasında, props ile çağrılabilir.

---

#### Görev 7: Sayfa modülleri
**Ben yapacağım:**
- `src/pages/LoginScreen.jsx`
- `src/pages/DashboardPage.jsx`
- `src/pages/CalendarPage.jsx` (en büyük, ~600 satır)
- `src/pages/ReservationListPage.jsx`
- `src/pages/GuestsPage.jsx`
- `src/pages/RoomsPage.jsx`
- `src/pages/AccountingPage.jsx`
- `src/pages/ReportsPage.jsx` + `src/pages/reports/ReportsAralikTab.jsx` + `src/pages/reports/ReportsYillikTab.jsx`
- `src/pages/SettingsPage.jsx`
- `src/pages/UsersPage.jsx`
- `src/pages/settings/KanallarSettings.jsx`
- `src/pages/settings/GiderKategoriSettings.jsx`

---

### 🔥 FAZ 3: FIRESTORE ENTEGRASYONU (2-3 saat)

#### Görev 8: Firestore koleksiyon şemaları + seed sıfırlama
**Ben yapacağım:**
- Firestore koleksiyonları: `users`, `otel`, `odaTipleri`, `odalar`, `misafirler`, `rezervasyonlar`, `tahsilatlar`, `hesaplar`, `hesapHareketleri`, `kanallar`, `giderler`, `giderKategorileri`, `_meta`
- **DEMO VERİLER YOK** — sıfırdan başlanacak (senin isteğin)
- **Tek seed:** İlk kullanıcı (admin) + boş otel kaydı + 8 default gider kategorisi + 5 default kanal
- Bunları çalıştıracak `seed.js` script veya admin panelinde "İlk kurulum" wizard'ı

**Sen yapacaksın:**
- İlk kuruldukta admin kullanıcı (Firebase Auth'tan) + şifre belirle
- Otel bilgilerini gir (ad, adres, ana para birimi)
- Oda tipleri ekle (Standart Oda, Deluxe, Suite vs.)
- Odaları ekle (101, 102, 201 vs.)
- Hesap aç (Nakit Kasa EUR, TR Banka TRY vs.)

---

#### Görev 9: Firebase Auth entegrasyonu
**Ben yapacağım:**
- `LoginScreen` Firebase Auth'a bağlanır (`signInWithEmailAndPassword`)
- `AuthProvider` `onAuthStateChanged` dinler → state senkron
- `users` koleksiyonunda her Firebase user'ın ek profili (rol, yetkiler, adSoyad) tutulur
- Logout `signOut`
- `localStorage.session` kaldırılır (Firebase Auth zaten persist ediyor)

**Kritik:** Firebase Auth UID = `users` doc ID olur. Bu sayede her kullanıcı kendi yetkilerini bulabilir.

---

#### Görev 10: Firestore Security Rules
**Ben yapacağım:**
- `firestore.rules` dosyası
- Anonymous read engellenir
- Sadece authenticated kullanıcılar okuyabilir
- Yazma sadece superadmin/admin için
- `users` koleksiyonu: kullanıcı kendi doc'unu okuyabilir, superadmin hepsini

```js
match /databases/{database}/documents {
  match /users/{userId} {
    allow read: if request.auth != null;
    allow write: if request.auth.token.role == 'superadmin';
  }
  match /{collection}/{doc} {
    allow read: if request.auth != null;
    allow write: if request.auth != null &&
                    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol in ['superadmin', 'admin'];
  }
}
```

**Sen yapacaksın:**
- Firebase Console → Firestore → Rules sekmesi → kuralları yapıştır → Publish

---

### 🚀 FAZ 4: DEPLOY (1-2 saat)

#### Görev 11: GitHub repository + Netlify continuous deployment
**Sen yapacaksın:**
- GitHub'da boş repo oluştur: `mert-bilisim/hoteluter`
- Local'de:
  ```bash
  git init
  git add .
  git commit -m "Initial: Hoteluter v1.0 modular React"
  git remote add origin https://github.com/mert-bilisim/hoteluter.git
  git push -u origin main
  ```

**Ben yapacağım:**
- `netlify.toml` config dosyası (build command, publish dir, SPA redirect rules)

**Sen yapacaksın:**
- app.netlify.com → "Add new site" → "Import from GitHub" → hoteluter repo seç
- Build command: `npm run build` (otomatik dolacak)
- Publish dir: `dist`
- Environment variables (Site settings → Environment variables):
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
- "Deploy site" → ilk deploy 2-3 dk sürer
- Netlify random URL verir (örn: `cosmic-hamster-1234.netlify.app`)

---

#### Görev 12: hoteluter.com domain bağlama + HTTPS
**Sen yapacaksın:**

Netlify'da:
- Site settings → Domain management → "Add custom domain" → `hoteluter.com`
- Netlify "Add nameserver" der → 4 tane Netlify nameserver verir (örn: `dns1.p01.nsone.net`, `dns2.p01.nsone.net`, vs.)

GoDaddy'de:
- hoteluter.com domain → DNS Management → Nameservers
- "Custom" → Netlify'ın verdiği 4 nameserver'ı yapıştır → Save
- Propagasyon: 5 dk - 24 saat (genelde 30 dk)

**Sonuç:**
- `hoteluter.com` → Netlify'a yönlenir
- HTTPS otomatik (Let's Encrypt, Netlify halleder)
- `www.hoteluter.com` → otomatik canonical redirect

---

## 📊 GÖREV ÖZETİ TABLOSU

| # | Görev | Yapan | Süre | Bağımlılık | Durum |
|---|---|---|---|---|---|
| 1 | Firebase projesi | Sen | 5 dk | — | ✅ |
| 2 | Local environment | Sen | 5 dk | — | ✅ |
| 3 | Vite iskelet | Ben + Sen | 30 dk | 2 | ✅ |
| 4 | Lib & helpers | Ben + Sen | 60 dk | 3 | ✅ |
| 5 | Components | Ben + Sen | 45 dk | 4 | ✅ |
| 6 | Modals | Ben + Sen | 60 dk | 5 | ✅ |
| 7 | Sayfalar | Ben + Sen | 90 dk | 6 | ✅ |
| 8 | Firestore şema | Ben | 30 dk | 1, 7 | ✅ (örtük tamam — migration boot) |
| 9 | Firebase Auth | Ben + Sen | 30 dk | 8 | ✅ |
| 10 | Security Rules | Ben + Sen | 15 dk | 9 | ✅ + bug fix |
| 11 | GitHub + Netlify deploy | Sen | 30 dk | 10 | ✅ |
| 12 | Domain bağlama | Sen | 15 dk + bekleme | 11 | ✅ |

**Toplam aktif çalışma: ~24 saat** (bekleme + Mert'in setup süreleri dahil, gerçek Claude+Mert oturumları)

---

## 🎯 ÇALIŞMA ŞEKLİ

Her görevde:

1. **Ben:** O görev için gereken kod/config dosyalarını üretirim
2. **Ben:** Sana net adımlar veririm ("şu dosyayı şuraya koy", "şu komutu çalıştır")
3. **Sen:** Adımları uygula, sonucu rapor et
4. **Ben:** Hata varsa düzeltirim, yoksa bir sonraki göreve geçeriz

**Görevler arası context:** Memory'm sayesinde her sohbette geçmişi hatırlayabilirim, ama bu büyük bir proje — **uzun sohbetlerde context dolar**. Bu yüzden her FAZ için (1, 2, 3, 4) **ayrı sohbet açmak en sağlıklısı**. Faz başında ben özet verir, çıktıyı not alırız.

**Versiyon kontrolü:** Geçiş tamamlanınca v1.0 olarak işaretlenir. v0.7 HTML dosyası backup olarak saklanır.

---

## 🚨 BİLİNEN RİSKLER & ÖNLEMLER

| Risk | Önlem |
|---|---|
| Firestore quota aşımı | Spark plan başlangıç (50K read/day, 20K write/day) — yeterli. Blaze'e geçmeyiz şimdilik |
| Auth sorun | Firebase Auth zaten production-grade, sıkıntı çıkmaz |
| Domain DNS gecikmesi | 24 saat beklenir, normaldir |
| Netlify build fail | Local'de `npm run build` test edilir önce |
| Migration karmaşası | Demo veriler atılıyor, sıfırdan başlandığı için temiz |
| Kur API kesintisi | Cache + manuel kur fallback zaten var (v0.3'ten beri) |
| Firestore composite index | Compound query yapmıyoruz, gerekmeyecek |
| Sürüm uyumsuzluğu | Vite + React 18 + Tailwind 3 standart, sorun çıkmaz |

---

## ⚡ BAŞLAMAK İÇİN İLK ADIM

**Görev 1'i şimdi yap:** Firebase'de "hoteluter" projesini oluştur, Authentication'ı Email/Password ile aç, Firestore'u eu-west-3'te production mode'da kur, Web app ekle, config'i kopyala.

Sonra bana **şu mesajı at:**

```
Görev 1 tamam. Firebase config:
apiKey: ...
authDomain: ...
projectId: ...
storageBucket: ...
messagingSenderId: ...
appId: ...
```

(Bu key'ler public, gizli değil — frontend'e gömülecekler. Güvenlik Firestore Rules ile sağlanır.)

Sonra Görev 2 ve Görev 3'e birlikte geçeriz.

---

## 📁 ÇIKTI DOSYALARI (Hangi sohbette ne üretilir)

**Bu sohbet (Görev 1 + 2 + 3):** Vite iskelet — ~10 dosya
**Sonraki sohbet 1 (Görev 4 + 5):** Lib + components — ~12 dosya
**Sonraki sohbet 2 (Görev 6 + 7):** Modals + pages — ~25 dosya
**Sonraki sohbet 3 (Görev 8 + 9 + 10):** Firestore + Auth + Rules — ~5 dosya + console adımları
**Sonraki sohbet 4 (Görev 11 + 12):** Deploy + domain — config + adımlar

Her sohbet bittiğinde sen kendi makinende tüm dosyaları toplayacaksın, son sohbetin çıktıları öncekilerle birleşecek. Git ile versiyonlanacak.

---

## 🎨 TASARIM KORUNUR

Mevcut "editorial boutique hotel" tasarım kimliği (bone/forest/brass paleti, Fraunces + DM Sans fontları) **birebir taşınır**. CSS değişmez, sadece dosya konumu değişir.

---

## 🔮 v1.0 SONRASI (Şimdilik kapsam dışı)

- Mobile responsive iyileştirmeleri (touch drag&drop)
- Excel/CSV export
- Tekrarlanan giderler (otomatik aylık kira/maaş)
- Hesap dönem kapanışı (ay sonu snapshot)
- Misafir profili → geçmiş rezervasyon listesi
- Kanal karşılaştırma raporu
- Multi-property (birden fazla otel)
- API (Booking.com Channel Manager entegrasyonu)
- Email bildirimleri (rezervasyon onay, hatırlatma)
- PDF fatura/bordro

---

**🚀 Hazırım. Görev 1'i tamamlayıp Firebase config'i bana ilettiğinde Görev 2 + 3'e başlayacağız.**

---

## 📦 Final Not (06.05.2026)

Sistem **v1.0** ile production'da: https://hoteluter.com

**12/12 görev tamamlandı + 2 kritik bug fix:**
- Bug 1 (commit `4db9359`): Kullanıcı oluşturma rules — get/list ayrımı + self-create + privilege escalation guard
- Bug 2 (commit `cf6b922`): Rezervasyon misafir seçimi `<select>` → combobox + inline yeni misafir prefill

**Bundan sonraki çalışmalar:**
- **v1.1+:** Sahada kullanım sırasında çıkacak bug raporları
- **v1.2+:** "Şu da olsun" tarzı yeni feature istekleri
- **v2.0+:** Çoklu otel desteği (multi-property), Cloud Functions ile incelikli yetki, kanal yönetimi entegrasyonu (Booking.com, Airbnb sync)

Bu doküman geçişten sorumluydu — **geçiş tamam.** Sonraki yol haritası ayrı dokümantasyonda tutulacak (v1.1+ release dokümanları, ihtiyaç duyuldukça `docs/CLAUDE_HOTELUTER_vN.N.md` doğacak).

Detaylı v1.0 production fotoğrafı: `docs/CLAUDE_HOTELUTER_v1.0.md`
