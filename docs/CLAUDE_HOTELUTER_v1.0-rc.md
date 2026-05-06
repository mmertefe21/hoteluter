# CLAUDE_HOTELUTER_v1.0-rc

> **Sürüm:** v1.0-rc (release candidate — Auth + Security Rules aktif, deploy bekliyor)
> **Tarih:** 06.05.2026
> **Önceki:** v1.0-beta (gerçek Auth, Rules açık)
> **Sonraki:** v1.0 (Netlify deploy + Domain)

Bu doküman, Görev 9 + 10 sonrası sistemin durumunu kayıt altına alır. Gerçek Firebase Auth aktif, Firestore Security Rules yazıldı (publish bekliyor). Sistem deploy'a hazır — Görev 11 + 12 kaldı.

---

## 📐 Mimari Özet

```
┌────────────────────────────────────────────────────────┐
│  Tarayıcı (React + Vite + Tailwind 3)                  │
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
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Firebase (Cloud)                                       │
│  ┌────────────────┐  ┌────────────────────────────┐    │
│  │ Firestore      │  │ Firebase Auth              │    │
│  │ + Security     │  │ Email/Password             │    │
│  │ Rules ✓        │  │ ✓ Bağlandı                  │    │
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

**İlk superadmin:**
- Firebase Auth: `mmertefe9@gmail.com`
- Firestore `users/{uid}`: kullaniciAdi=admin, adSoyad=Mert Efe, rol=superadmin, aktif=true

**KullaniciFormModal:**
- Yeni: `createUserWithProfile` (Auth + profil birlikte). Banner: "mevcut oturumunuz kapanacak..."
- Düzenleme: sadece Firestore profil update; email field disabled

---

## 🛡️ Authorization (Firestore Security Rules)

`firestore.rules` — Görev 10'da yazıldı, Mert manuel publish edecek.

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

- **Operasyonel veri herkese açık (otel ekibi içinde):** Rezervasyon, misafir, oda yönetimi, ön muhasebe → tüm aktif kullanıcı r/w. Modül bazlı incelikli yetki (örn. resepsiyonist gider giremez) client-side `can()` kontrolüyle yapılıyor şu an. Sunucu-tarafı incelikli rol filtresi sonraki iterasyona bırakıldı.
- **`users` get/list ayrımı:** Tek doc okuma kendi profili veya superadmin için açık (`get`). Toplu listeleme sadece superadmin (`list`) — UsersPage üst-seviye listeyi yalnızca superadmin görür.
- **`users` self-create + privilege escalation guard:** `createUserWithProfile` akışında `setDoc` yeni user'ın oturumunda çalıştığı için (Firebase'in yan etkisi), kendi profilini yaratma izni şart. Ancak `rol` `'admin'` veya `'kullanici'` ile sınırlı, `aktif: true` zorunlu — yeni user kendine superadmin atayamaz, deaktif yaratamaz.
- **`users` update guard:** Kullanıcı kendi profilinin diğer alanlarını (`kullaniciAdi`, `adSoyad`, `modulYetkileri`) güncelleyebilir; `rol` ve `aktif` değişmemeli (değişirse rules reddeder). Superadmin her şeyi değiştirebilir.
- **Konfig kilitli:** `otel` sadece superadmin yazar.
- **Default deny:** Yeni eklenen herhangi bir koleksiyon kural yazılmadan kullanılamaz (güvenli-by-default).
- **`aktif: false` ile tek-tıkla erişim kesme:** `aktif != true` olan user'ın hiçbir koleksiyona erişimi yok (`isActiveUser()` reddeder).

> ⚠ Bilinen takas: Update kuralı `modulYetkileri`'ni serbest bırakıyor — kullanıcı kendi `modulYetkileri`'ni teorik olarak değiştirebilir. Şu an etkisi yok çünkü server-side operasyonel kurallar `modulYetkileri`'ne bakmıyor (sadece `isActiveUser`). Server-side incelikli yetkiye geçildiğinde bu update kuralı da rol/aktif/modulYetkileri üçünü birden sabitlemeli.

### Yardımcı Dosyalar

- `firebase.json` — Firestore deploy config (`rules` + `indexes` path'leri)
- `firestore.indexes.json` — boş (compound query yok, composite index gerekmiyor)
- `.firebaserc` — `default: "hoteluter"` (Firebase CLI proje bağlama)

---

## 📁 Dosya Değişiklikleri (v1.0-beta → v1.0-rc)

| Dosya | Değişim |
|---|---|
| `firestore.rules` | **yeni** (default deny + role-based) |
| `firebase.json` | **yeni** (deploy config) |
| `firestore.indexes.json` | **yeni** (boş) |
| `.firebaserc` | **yeni** (project: hoteluter) |
| `CLAUDE.md` | sürüm v1.0-rc + Şu An Nerede + dosya yapısı |
| `docs/CLAUDE_HOTELUTER_v1.0-rc.md` | **yeni** (bu dosya) |

**Build:** `npm run build` yeşil, 1632 modül.

---

## 🛠️ Teknoloji Stack (değişmedi)

| Katman | Teknoloji | Versiyon | Durum |
|---|---|---|---|
| Build | Vite | 5.4 | ✓ |
| UI | React | 18.3 | ✓ |
| Styling | Tailwind | 3.4 | ✓ |
| Icons | lucide-react | 0.460 | ✓ |
| Backend | Firebase Firestore | 10.13 | ✓ + Rules |
| Auth | Firebase Auth | 10.13 | ✓ Bağlandı |
| Kur | Frankfurter API | n/a | ✓ (Netlify sonrası CORS test edilecek) |
| Hosting | Netlify (planlı) | n/a | Görev 11 |

---

## 🔄 Migration Sistemi (değişmedi)

`runMigrations()` `App.jsx > Bootstrap` içinde, **user login olduktan sonra** çalışır:
- migrate_v01_kanallar (5 kanal)
- migrate_v02_giderKategorileri (8 kategori)
- migrate_v03_hesaplar (3 hesap)

Yeni Security Rules altında: `_meta` ve operasyonel koleksiyonlara aktif user yazma izni var → migration sorunsuz çalışacak.

---

## ⚖️ Kritik Kurallar (değişmedi)

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

## ⚠️ Bilinen Sınırlamalar (v1.0-rc)

| Konu | Durum | Görev |
|---|---|---|
| **Kuralları publish etme** | Yazıldı, Mert Console'dan publish edecek | Şu an |
| **Modül bazlı incelikli yetki (server-side)** | Şu an client-side `can()` ile filtreli; server-side tüm aktif user r/w | İleri sürüm |
| **Yeni kullanıcı yaratırken oturum değişimi** | Firebase client-side davranışı; uyarı banner ile bildiriliyor | Cloud Functions (sonra) |
| **Password reset UI** | Yok | İleri sürüm |
| **Email değişimi (düzenleme)** | UI'da disabled | Cloud Functions (sonra) |
| **Şifre değişimi UI** | KullaniciFormModal'da yok; `useAuth().changePassword` API var | İleri sürüm |
| **Mobile drag-to-move** | HTML5 drag-and-drop API mobile'da kısıtlı | UX iyileştirme |
| **Yedekleme: import** | Sadece export var | Sonra |
| **Bundle boyutu** | 1.55MB (gzip 328KB) — code splitting yok | Optimizasyon |
| **Multi-property** | Tek otel varsayımı | v1.0 sonrası |
| **`hesaplar` para birimi seed** | İlk migration'da otel anaParaBirimi henüz set edilmemiş olabilir → EUR'a düşer | Settings tour'undan sonra düzelt |
| **Oda durumu** | Sadece UI gösterimi | UX iyileştirme |
| **Frankfurter API CORS** | Lokal'de çalışıyor; Netlify production'da CORS sorunu çıkarsa alternatif kur API'sine geçilecek | Görev 11 sonrası test |

---

## 🚦 Sıradaki Adımlar

### **Görev 10 publish (Mert)**
Firebase Console → Firestore Database → Rules sekmesi → `firestore.rules` içeriğini yapıştır → Publish.

**Publish öncesi check-list:**
1. Mevcut oturumla en az bir başarılı yazma test et (örn. yeni misafir ekle) — kuralların çalıştığını doğrulamak için baseline.
2. Rules sekmesinde Editor sağında "Discard" + "Publish" butonları var. Publish'e basmadan önce **Console'da bir tab açık tut** (rollback için).
3. Publish sonrası lokal `npm run dev`'i yeniden yükle. Login → migration boot → operasyonel CRUD test et.
4. Sorun çıkarsa rollback: Rules sekmesinde "History" sekmesi var → bir önceki sürümü seç → Publish.

### Görev 11: Netlify deploy
- `netlify.toml` (build command, publish dir, SPA redirect)
- Netlify env vars (`VITE_FIREBASE_*`)
- GitHub continuous deploy

### Görev 12: hoteluter.com domain
- GoDaddy DNS → Netlify nameservers
- Let's Encrypt SSL

---

## 📝 İşbirliği Notları (değişmedi)

**Mert'in çalışma stili:**
- Detaylı planlama → side-effect açıklaması → onay → uygulama
- Token-heavy, dikkatli yanıtlar
- Türkçe iletişim
- Sürüm dokümanı tut

**Kod stili:**
- Türkçe değişken/fonksiyon isimleri (rezervasyon, misafir, tahsilat...)
- İngilizce React/JS API'leri
- JSDoc başlıkları her dosyada
- 2 space indent, hard tab yok
- Modal save() pattern: `try { ...; show('ok'); onSaved?.(); onClose?.(); } catch (e) { show(e.message, 'error'); }`

---

**Bu dosya, yeni Claude session başlarken İLK okuyacağın 2. dokümandır** (1.'si CLAUDE.md). v1.0-beta dokümanı artık eski — bu dosya onun yerini aldı.
