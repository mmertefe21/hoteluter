# CLAUDE.md — Hoteluter

> **Amaç:** Bu dosya, Hoteluter projesinde çalışan herhangi bir Claude (yeni sohbet, yeni session) için **kurucu dokümandır**. İlk okunacak dosyadır. Projenin tarihi, mimarisi, çalışan kuralları ve aktif görevler buradadır.

**Son güncelleme:** 15.05.2026
**Mevcut sürüm:** **v1.3-dev** (deploy bekliyor)

> ⚠️ **DEPLOY NOTU:** `main.jsx`'teki 3 DEV migration scriptini kaldır (`window.cleanupGorseller`, `window.migrateHesapRenkleri`, `window.migrateOdaTipiSiraNo`). Sonra: `git add -A` → `git commit -m "v1.3: calisma havuzu + doluluk grafik + POS cozme + duyuru sistemi"` → `git push origin main` → Netlify otomatik deploy.
> **Son eklenen değişiklikler (15.05.2026, son session):**
> - `CalendarPage.jsx` — Çalışma Havuzu bug fixleri: çoklu rezervasyon ekleme, Kaydet/İptal mantığı (İptal orijinal odalara geri yazar, Kaydet yalnızca havuz boşken çalışır), boş panel tasarımı (minHeight + footer her zaman görünür), havuz highlight renkleri (sarı=geçerli, kırmızı=çakışma), havuzdaki rezervasyonların odası boş sayılması
> - `CalendarPage.jsx` — Doluluk İstatistik Grafiği ince ayar: dolu oda sayısı gösterimi
> - `TransferModal.jsx` + `transfer.js` — POS Çözme: komisyon UI yüzde/tutar toggle (pill buton grubu, brass seçili), atomik batch (4 yazma: transfer-çıkış brüt + transfer-giriş net + gider doc + gider hareketi), `komisyonMod` state + `komisyonTutar` computed
> - `migrations.js` — `migrate_v13_bankaMasraflari`: "Banka Masrafları" gider kategorisi seed
> - `AccountingPage.jsx` — `giderKategorileri` prop TransferModal'a bağlandı
> - `DuyuruFormModal.jsx` — yeni dosya: başlık/içerik/önem/hedef (hepsi veya seçili kullanıcılar)/aktif; tarih alanı yok (hardcoded 2000–2099)
> - `SettingsPage.jsx` — DuyurularTab (superadmin): tablo, aktif toggle, düzenle/sil; YedekTab'a `duyurular` koleksiyonu eklendi
> - `App.jsx` — login sonrası okunmamış duyuru popup (acilShownRef guard, X yok, "Tamam Anladım" ortada); Sidebar'a `duyuruSayisi` prop
> - `Sidebar.jsx` — dashboard öğesinde okunmamış duyuru brass badge
> - `Modal.jsx` — `hideClose` prop eklendi
> - `DashboardPage.jsx` — duyuru bant kodu tamamen temizlendi
> - `firestore.rules` — `duyurular` bloğu eklenmeli (Console'dan deploy edilecek)

 — Rules + Storage Rules ✅ production'da; frontend kodu ⏳ deploy bekliyor. **Oturum 1:** Aktivite Log 3 faz. **Oturum 2:** 6 UI iyileştirmesi + Check-in/Out + Gider görseli. **Oturum 3:** Kullanıcı kolonu + Audit Trail + Secondary App + Storage prod + Pastel UI. **Oturum 4 (14.05.2026):** chart fix + tek session + hesap sil/pasif + oda tipi sıralama. 18 AKSIYON_TIPLERI. **Oturum 5 (15.05.2026):** Çalışma Havuzu bug fixleri + doluluk grafik ince ayar + POS Çözme (komisyon toggle + atomik batch) + Banka Masrafları migration + Duyuru sistemi (CRUD + popup + badge) + Modal hideClose prop + DashboardPage temizliği.
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
| **v1.0** | 06.05.2026 | Vite + React + Firebase + Netlify production deploy |
| **v1.1** | 08.05.2026 | Tarih bug fix (`localISODate`) + giderler menü kaldır + istatistik ay yıl bazlı + hesap silme yetkisi `hesap-yonet` flag + yedek dosya adı UTC fix + **raporlar 3 sütun** (Ciro/Tahsilat/Gider, hover tooltip, segment-aware `helpers/ciro.js`) + **grup rezervasyon** (`gruplar` koleksiyonu, 2 adımlı modal, takvim renk şeridi + isim formatı, hibrit bakiye, `PRESET_RENKLER`) |
| **v1.2** | 14.05.2026 | **Aktivite Log** 3 faz + 18 AKSIYON_TIPLERI. **6 UI iyileştirmesi**. **Check-in/Out**. **Gider görseli** (Storage prod). Kullanıcı kolonu + Audit Trail + Secondary Firebase App. Tek session güvenliği + Hesap koşullu silme + Takvim oda tipi sıralama. |
| **v1.3-dev** | **Mevcut** (15.05.2026, deploy bekliyor) | **Çalışma Havuzu** bug fixleri (İptal geri yazar, Kaydet boşken çalışır, highlight renkleri). **POS Çözme** (komisyon yüzde/tutar toggle, atomik 4-yazma batch, Banka Masrafları migration). **Duyuru sistemi** (DuyuruFormModal yeni, SettingsPage DuyurularTab, App.jsx popup, Sidebar badge, Modal hideClose prop). |

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
│   ├── lib/                # firebase, db adapter, auth, kur, helpers, permissions, constants, storage (v1.2+)
│   ├── helpers/            # tahsilat, gider, transfer, segmentler
│   ├── components/         # Sidebar, Modal, ConfirmModal, Icon, Toast, ListPageShell
│   ├── modals/             # ReservationFormModal, SplitModal, GiderModal, ...
│   ├── pages/              # DashboardPage, CalendarPage, ReservationListPage, ...
│   │   ├── reports/        # ReportsAralikTab, ReportsYillikTab
│   │   └── settings/       # KanallarSettings, GiderKategoriSettings, AktiviteSettings (v1.2+)
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
| `users` | Sistem kullanıcıları | id (=Firebase UID), kullaniciAdi, adSoyad, email, rol, modulYetkileri, aktif, **sonGiris** (Timestamp, v1.2+), **sonAksiyon** (string, v1.2+), **aktifSessionId** (string\|null, v1.2 Oturum 4+) |
| `otel` | Tek otel kaydı (singleton) | ad, adres, telefon, email, vergiNo, yildizSayisi, **anaParaBirimi** |
| `odaTipleri` | Standart, Deluxe, Suite vs. | ad, varsayilanFiyat, renk, kapasite, **siraNo** (number, schema-less, v1.2 Oturum 4+) |
| `odalar` | Fiziksel odalar | odaNumarasi, odaTipiId, kat |
| `misafirler` | Misafir kayıtları | ad, soyad, email, telefon, tckn, pasaportNo |
| `rezervasyonlar` | Tüm rezervasyonlar | rezervasyonKodu, anaMisafirId, odaId, girisTarihi, cikisTarihi, durum, **fiyatModu**, **geceFiyatlari[]**, **segmentler[]**, **grupId** (opsiyonel, v1.1+), toplamTutar, kanal, pansiyonTipi, **checkInTarihi** (ISO string, v1.2+), **checkOutTarihi** (ISO string, v1.2+) |
| `gruplar` | Grup rezervasyonu başlıkları (v1.1+) | ad, iletisimKisi, telefon, email, **renk**, notlar, aktif, olusturmaTarihi |
| `tahsilatlar` | Misafirden alınan ödemeler | rezervasyonId, **grupId** (opsiyonel havuz tahsilatları için, v1.1+), hesapId, **paraBirimi**, **kur**, tutar (orijinal), **tutarAna**, tarih, odemeYontemi |
| `hesaplar` | Kasa/Banka/POS hesapları | ad, tip, **paraBirimi**, renk, aktif |
| `hesapHareketleri` | Tüm hesap giriş/çıkışları (audit) | hesapId, tutar (hesabın PB'sinde), tip (`tahsilat`/`gider`/`transfer-*`/`duzeltme`/`iptal`/`manuel-*`, v1.2+), aciklama, transferId, tahsilatId, giderId, rezervasyonId, **grupId** (opsiyonel, v1.1+), **olusturanId** (string\|null, v1.2+) |
| `kanallar` | Booking, Etstur, Manuel vs. | kod, ad, aktif |
| `giderler` | Maaş, kira, fatura | kategoriId, hesapId, tutar, paraBirimi, **tutarAna**, tarih, **gorseller[]** (opsiyonel, v1.2+: `{ fileName, type, size, url, path, uploadedAt }` — Storage prod; eski kayıtlar `dataUrl` backward compat) |
| `giderKategorileri` | Personel Maaşı, Kira, ... | ad, icon, renk, aktif |
| `aktiviteLog` | Kullanıcı aksiyonları audit log (v1.2+) | tarih (Timestamp), kullaniciId, kullaniciAd, **aksiyon** (AKSIYON_TIPLERI key), **aciklama** (metin), hedefTip?, hedefId? |
| `duyurular` | Sistem duyuruları (v1.3+) | baslik, icerik, onem (`bilgi`/`uyari`/`acil`), hedef (`hepsi`/`secili`), hedefKullanicilar[], aktif, **okuyanlar[]** (arrayUnion ile eklenir), baslangicTarihi (hardcoded 2000-01-01), bitisTarihi (hardcoded 2099-12-31), olusturanId, olusturmaTarihi |
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

**v1.2-dev (12.05.2026) — DEPLOY BEKLİYOR:** Tüm feature'lar tamamlandı (~30 dosya, 3 yeni). Firestore Rules ✅ production'da. Frontend kodu ⏳ push/deploy edilmedi.

**Oturum 1 (11.05.2026) — Aktivite Log:**
- **Faz 1 (Altyapı):** `src/helpers/aktiviteLog.js` yeni dosya (logAksiyon + logGiris, fire-and-forget, try/catch). `AKSIYON_TIPLERI` 14 tip `constants.js`'e. `aktivite` modülü `permissions.js`'e. `firestore.rules`'a `aktiviteLog` + `hasYetki()`.
- **Faz 2 (Enjeksiyon):** 17 çağrı noktası: auth.giris/cikis + rezervasyon.olustur/duzenle/sil + tahsilat(C1-C3, 3 yer) + gider(C4-C6, 2 yer) + transfer(C7) + hesap.giris/cikis(C8-C9). SE-3 race condition fix (`confirmTahDel` capture pattern).
- **Faz 3 (UI):** `AktiviteSettings.jsx` yeni sayfa (getDocs pagination, startAfter, 5 filtre, useMemo). `SettingsPage` aktivite sekmesi (`can('aktivite','goruntule')` gated). `UsersPage` sonGiris/sonAksiyon kolonları.
- **Rules deploy yöntemi (kalıcı standart):** Firebase CLI kurulu değil; `firestore.rules` içeriği Firebase Console > Firestore > Rules > kopyala-yapıştır > Publish.

**Oturum 2 (12.05.2026) — SEANS 1 + 2 + 3:**
- **SEANS 1 (6 UI iyileştirmesi):** CalendarPage oda tipi gruplaması (odaTipiGruplari useMemo, başlık satırı) + borç şeridi (borcMap/grupBorcMap useMemo, 4 px absolute şerit) + sticky tarih başlığı (mobile sticky, md:static). DashboardPage doluluk %125 bug fix (giriş-yapildi için tarih kontrolü eklendi). AccountingPage kart renkleri (getReadableTextColor luminance helper, textRenk/textSoft/bakiyeRenk değişkenleri). HesapFormModal PRESET_RENKLER renk seçici butonları.
- **SEANS 2 (Check-in/Out):** `AKSIYON_TIPLERI` 14 → 16 tip (`rezervasyon.checkin` + `rezervasyon.checkout`). `rezervasyonlar` şemasına `checkInTarihi`/`checkOutTarihi` (schema-less, ISO string). ReservationFormModal: 2 state + 2 handler + 2 ConfirmModal + IIFE buton render (check-in esnek `today >= giris && today <= cikis`; check-out katı `today === cikis`). CalendarPage `getResStyle` renk skalası: grup > checkout(turuncu) > checkin(yeşil) > onaylı(mavi).
- **SEANS 3 (Gider görseli mock mode):** `src/lib/storage.js` yeni dosya — `STORAGE_LIMITS` (1MB/800KB/5 dosya/jpeg+png+pdf), `validateFile`, `validateTotalSize`, `fileToBase64`, `uploadGiderGorsel` (mock base64), `deleteGiderGorsel` (no-op + TODO). GiderModal: `gorseller: []` init (her iki branch), `handleFileChange` validasyon+pending, `removeGorsel`, `save()` refactor (_pending→upload→sanitize), C4/C5 logAksiyon açıklamasına `(N görsel)` eki, "Görseller / Faturalar" UI bölümü.

**Oturum 3 (13.05.2026):**
- **Kategori A (Kullanıcı Takibi):** `hesapHareketleri.olusturanId` standardı (tahsilat + gider + transfer simetrik). `AccountingPage` Hareketler + `HesapDetayModal` Hareket Geçmişi tablolarına "Kullanıcı" kolonu. `userMap` useMemo O(1) lookup.
- **Kategori B (Audit Trail):** `duzeltme`/`iptal` HAREKET_TIPI. `updateXxxWithHareket` bakiye-etkili değişikliklerde fark hareketi ekler, diğerlerinde sadece doc günceller. `deleteXxxWithHareket` eski hareket yerine ters iptal hareketi ekler. Helper signature'ına 4. param `kullaniciId` eklendi.
- **Kategori C (Secondary Firebase App):** `firebase.js`'e `secondaryAuth` export. `createUserWithProfile` Secondary App + try/finally signOut. Admin oturumu artık bozulmuyor. `KullaniciFormModal` sarı uyarı kutusu kaldırıldı. `kullanici.olustur` aksiyon tipi eklendi (16→17 tip).
- **Kategori D (Firebase Storage Production):** Blaze plan, `hoteluter.firebasestorage.app`, `europe-west1`. `storage.js` tam refactor (5MB/25MB, `fileToBase64` kaldırıldı, path-based upload/delete). `gider.js` delete'e Storage cleanup loop. `GiderModal` backward compat (`g.url || g.dataUrl`). Storage Rules Console'dan deploy edildi.
- **Kategori E (UI Polish):** `PRESET_RENKLER` 8 koyu → 8 pastel (luminance ≥128, koyu metin). `hexToRgba(cardRenk, 0.5)` kart render. `textSoft` `rgba(26,26,26,0.7)` alt başlık okunaklılığı. 2 DEV migration scripti (`cleanupGorseller`, `migrateHesapRenkleri`) `main.jsx`'te — deploy öncesi kaldırılacak.

**Oturum 4 (14.05.2026):**
- **Madde 1 (Chart Fix):** `ReportsPage` yıllık ciro chart tooltip kesilmesi giderildi — `chartH` 260→290, `margin.top` 20→50 (`innerH`=200 korundu).
- **Madde 2 (Tek Session):** `auth.jsx` Firestore `aktifSessionId` pattern — login'de `crypto.randomUUID()` + `updateDoc`, `onSnapshot` ile başka cihaz tespiti, auto-logout + localStorage mesaj. `LoginScreen` `useEffect` ile kick mesajı yakalama. Guard: `aktifSessionId` null/undefined → SKIP.
- **Madde 3 (Hesap Silme):** `HesapFormModal` deactivation intercept — `harSayisi===0` → hard delete (`db.delete` + `logAksiyon('hesap.sil')`), `harSayisi>0` → soft pasif. `confirmPasif` state + ConfirmModal dinamik title/msg. 17→**18 AKSIYON_TIPLERI**.
- **Madde 4 (Oda Tipi Sıralama):** `CalendarPage` hover ↑↓ butonlar (oda tipi adı yanında). `handleSiraDegis` normalize+swap `db.batch` atomik. `siraNo` şema eklendi. `migrateOdaTipiSiraNo` DEV scripti.
- **Madde 5 (Rapor Doğrulama):** Kod değişikliği yok — `ReportsPage` zaten `tahsilatlar`+`giderler` koleksiyonlarından çalışıyor; manuel hareketler/transferler rapora yansımıyor.

**v1.1 (08.05.2026):** 🎉 Sahada ilk hafta düzeltmeleri + 2 büyük feature — 4 yeni dosya + 13 değişen dosya, ~1500 yeni satır + ~250 düzenlenen, 15/15 test geçti.

- **Madde 5 (kritik):** `localISODate(d)` helper'ı eklendi, TRT 1-gün-geri UTC bug'ı kapandı.
- **Madde 2:** Sol menüden "Giderler" kaldırıldı. Giderler hâlâ Ön Muhasebe içinde tab.
- **Madde 3:** İstatistik dropdown'u içinde bulunulan yılın 12 ayı (Ocak..Aralık).
- **Madde 1:** `canDelete` prop'u `can('onMuhasebe','hesap-yonet')` flag'ine bağlandı.
- **Madde 6:** `helpers/ciro.js` segment-aware ciro. ReportsPage 4 metrik + 3-bar grafik + tooltip.
- **Madde 4:** `gruplar` koleksiyonu + 3 yeni modal + takvim grup şeridi + hibrit bakiye.

⚠ **Kullanıcı silme bug (v1.1'de keşfedildi, v1.3'e taşındı):** Firestore'dan silinen user'ın Auth kaydı kalır → aynı email ile yeni user yaratılamaz. Cloud Functions gerekiyor. Geçici workaround: Firebase Console → Authentication → Users'tan manuel sil.

v1.0 production altyapısı v1.1'e olduğu gibi miras kaldı:

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
- 13 koleksiyon (users, otel, _meta + 10 operasyonel + gruplar v1.1)
- Migration boot otomatik: 5 kanal + 8 gider kategorisi + 3 hesap

**Bundle:** ~1.55 MB (gzip 328 KB), 1632 modül, build ~5-8 sn

**Commit timeline:**
- 05.05.2026 20:55 → 21:55 — Faz 1+2: Görev 1-7 (5 commit)
- 06.05.2026 14:14 → 17:04 — Faz 3+4: Görev 9-11 + 2 bug fix + v1.0 release (6 commit)
- 08.05.2026 — v1.1 release (sahada ilk hafta düzeltmeleri)

### Sıradaki — v1.3+ Yol Haritası

- **v1.3:** **Cloud Functions admin SDK kurulumu** — `deleteUser` callable. Bir bilinen sınırlamayı çözer: Firestore'dan silinen user'ın Auth kaydının manuel temizlenmesi (v1.1'de keşfedildi). Frankfurter API CORS proxy de aynı Functions kurulumuna entegre edilebilir. (Kullanıcı oluşturma oturum-değişimi v1.2 Oturum 3'te Secondary App ile çözüldü.)
- **v1.4+:** Aktivite Log detay navigasyonu (`hedefId` ile ilgili kayda atlama), log export, mobile drag-to-move (touch event handlers), code splitting (1.55MB → ~200KB initial), combobox klavye navigasyonu, TahsilatModal rez seçimi combobox'a çevirme.
- **v2.0+:** Booking.com / Airbnb channel manager entegrasyonu, server-side incelikli yetki (modül bazlı r/w rules).

Yeni Claude session'lar şu konularda yardım edebilir:

- **Bug raporları (sahada kullanım):** Mert canlı sistemde sorun bulduğunda raporlayacak; bilinen sınırlamalar tablosunu önce kontrol et
- **"Şu da olsun" feature istekleri:** Her sürüm için ayrı `docs/CLAUDE_HOTELUTER_vN.N.md` doğmalı
- **Mobile drag-to-move:** Touch event desteği (CalendarPage)
- **Yedekleme import flow:** Şu an sadece export var
- **Code splitting:** Bundle 1.55MB → initial yükleme optimize

### Bilinen Sınırlamalar (özet — detay v1.1 dokümanında)

- ⏳ **v1.3-dev kodu deploy edilmedi**: Rules production'da, frontend kodu henüz push edilmedi. `firestore.rules`'a `duyurular` bloğu da eklenmeli (Console'dan)
- 🔴 **Kullanıcı silme bug** (v1.1'de keşfedildi): Firestore'dan silinen user'ın Auth kaydı kalır → aynı email ile yeni user yaratılamaz. v1.3'e taşındı (Cloud Functions). Geçici workaround: Firebase Console → Auth → Users'tan manuel sil
- Frankfurter API CORS (production'da çalışmıyor)
- Modül bazlı incelikli yetki sadece client-side
- Mobile drag-to-move yok
- Yedekleme import yok (sadece export, `gruplar` da dahil v1.1+, `aktiviteLog` hariç)
- Bundle code splitting yok
- Multi-property desteği yok (tek otel varsayımı)
- Update kuralı `modulYetkileri`'ni serbest bırakıyor (bilinen takas)
- Combobox klavye navigasyonu yok (sadece mouse)
- TahsilatModal rez seçimi basit `<select>` (combobox değil)
- **DEV migration scriptleri main.jsx'te** (v1.2-dev): `window.cleanupGorseller` + `window.migrateHesapRenkleri` + `window.migrateOdaTipiSiraNo` (3 script) DEV bloğunda kalıyor — production deploy ÖNCESİ kaldırılacak
- **HesapFormModal renk butonları doygun**: Modal'da doygun renk, kart render'da `hexToRgba(0.5)` pastel — tutarsızlık bilinçli tercih (v1.3+ değerlendirilebilir)

### Modal envanteri (`src/modals/`)
- Mali: TahsilatModal, GiderModal, TransferModal (v1.2: C7; **v1.3: komisyon yüzde/tutar toggle + komisyonMod state + komisyonTutar computed**), HesapFormModal (koşullu sil/pasif), HesapDetayModal (Kullanıcı kolonu)
- **Duyuru (v1.3+):** DuyuruFormModal (yeni dosya — başlık/içerik/önem/hedef/aktif, tarih yok)
- Rezervasyon: ReservationFormModal (combobox + entegre TahsilatModal + nested MisafirFormModal; v1.2: rez C + C3a + SE-3 fix + SEANS 2: check-in/out butonlar+handlers+2 ConfirmModal; Oturum 3: tahsilatSil audit trail, `userId` 2. arg), SplitModal
- **Grup (v1.1+):** RezervasyonTipiSecimModal (Tek/Grup seçim), GrupRezervasyonModal (2 adımlı + mevcut gruba oda ekleme modu), GrupDetayModal (oda ekle/çıkar, hibrit bakiye)
- CRUD: MisafirFormModal (prefill prop ile), OdaTipFormModal, OdaFormModal, KullaniciFormModal (Oturum 3: Secondary App — sarı uyarı kaldırıldı, toast güncellendi)

### Sayfa envanteri (`src/pages/`)
LoginScreen · DashboardPage (v1.3: duyuru kodu temizlendi) · CalendarPage (v1.2: oda tipi sıralama; **v1.3: Çalışma Havuzu bug fixleri + doluluk grafik ince ayar**) · ReservationListPage · GuestsPage · RoomsPage · AccountingPage (**v1.3: giderKategorileri→TransferModal**) · ReportsPage · SettingsPage (**v1.3: DuyurularTab superadmin**) · UsersPage

### Boot sırası (App.jsx)
AuthProvider (Firebase Auth) → ToastProvider → onAuthStateChanged → user yoksa LoginScreen, varsa AppShell. AppShell mount'ında otomatik `runMigrations()` ve `ensureKurlarLoaded()`. Profil pasifse (`aktif: false`) otomatik logout.

Detaylı v1.2 dokümanı: `docs/CLAUDE_HOTELUTER_v1.2.md`
Önceki sürüm referansı: `docs/CLAUDE_HOTELUTER_v1.1.md`

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

**Yeni Claude session başlarken (v1.3 sonrası):**
1. Bu dosyayı (`CLAUDE.md`) oku — proje özeti, mimari kuralları, mevcut sürüm
2. **`docs/CLAUDE_HOTELUTER_v1.2.md`** oku — v1.2 fotoğrafı (Aktivite Log + Check-in/Out + Storage + session security + oda tipi sıralama)
3. **`docs/CLAUDE_HOTELUTER_v1.1.md`** — önceki sürüm (sahada ilk hafta düzeltmeleri + grup rezervasyon + yıllık ciro)
4. **`docs/HOTELUTER_GECIS_PLANI.md`** — kapanmış geçiş planı (mimari kuralları için referans)
5. Mert'le konuşmaya başla — v1.3 deploy onayı (`firestore.rules` duyurular bloğu + 3 DEV script temizliği), sahada kullanım bug raporu, veya v1.4 (Cloud Functions admin SDK) hedefi
