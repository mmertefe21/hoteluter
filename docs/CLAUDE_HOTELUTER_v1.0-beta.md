# CLAUDE_HOTELUTER_v1.0-beta

> **Sürüm:** v1.0-beta (gerçek Auth aktif, Security Rules kapatılmadan önce)
> **Tarih:** 06.05.2026
> **Önceki:** v1.0-alpha (mock auth, Faz 2 sonu)
> **Sonraki:** v1.0 (Security Rules + Netlify deploy + Domain)

Bu doküman, Görev 9 sonrası sistemin durumunu kayıt altına alır. Mock auth kalktı, Firebase Authentication production'da kullanılan gerçek implementation ile bağlandı. **Güvenlik tarafı henüz kapatılmadı** — Görev 10 zorunlu.

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
│  │ (12 koleksiyon)│  │ Email/Password             │    │
│  │ ⚠ Rules açık   │  │ ✓ Bağlandı                  │    │
│  └────────────────┘  └────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

---

## 🔑 Authentication

`src/lib/auth.jsx` — Firebase Auth provider:

```js
// AuthProvider state'i:
//   - user: { id (=Firebase UID), email, kullaniciAdi, adSoyad, rol, modulYetkileri, aktif, ... }
//   - authReady: onAuthStateChanged ilk callback'ten sonra true

useAuth() → {
  user, authReady,
  login(email, password),       // signInWithEmailAndPassword + Türkçe hata mesajları
  logout(),                     // signOut
  can(modul, aksiyon),          // superadmin → true; diğer → modulYetkileri[modul].includes(aksiyon)
  refreshUser(),                // profili Firestore'dan tekrar çek
  changePassword(newPassword),  // updatePassword
}

createUserWithProfile({ email, password, profile })  // sadece superadmin için
  → createUserWithEmailAndPassword(email, password)
  → setDoc(users/{uid}, { ...profile, email, aktif: true, olusturmaTarihi })
```

**Profil senkronizasyonu:**
- `onAuthStateChanged` her oturum değişikliğinde çalışır
- Firebase user → Firestore `users/{uid}` doc'tan profil çekilir
- `aktif: false` ise otomatik `signOut` (pasif kullanıcı erişemez)
- Profil yoksa otomatik logout (orphan auth user koruması)

**İlk superadmin (manuel oluşturuldu):**
| Alan | Değer |
|---|---|
| Firebase Auth user | mmertefe9@gmail.com |
| Firestore doc ID | (Auth UID ile eşleşiyor) |
| kullaniciAdi | admin |
| adSoyad | Mert Efe |
| rol | superadmin |
| aktif | true |
| olusturmaTarihi | 2026-05-06 |

**LoginScreen:** `useAuth().login(email, password)` çağırır. Başarısızsa Türkçeye çevrilmiş hata mesajı gösterir (`auth/invalid-credential`, `auth/too-many-requests`, `auth/network-request-failed`, `auth/invalid-email`).

**KullaniciFormModal:**
- **Yeni:** `createUserWithProfile` çağrılır → Firebase Auth user + Firestore profil birlikte. Modal üstünde uyarı banner: "mevcut oturumunuz kapanacak, yeni kullanıcıya geçilecek". (Firebase'in client-side davranışı — `createUserWithEmailAndPassword` çağırılınca yeni user otomatik signed-in olur. Cloud Functions ile düzeltilecek.)
- **Düzenleme:** Sadece Firestore profil update (`db.update('users', uid, patch)`). `email` field'ı disabled — değiştirilemez (admin SDK gerektirir). Şifre değişimi UI'da yok; ileride kullanıcının kendi şifre değiştirme akışı veya Cloud Function ile.

---

## 📁 Dosya Değişiklikleri (v1.0-alpha → v1.0-beta)

| Dosya | Değişim |
|---|---|
| `src/lib/auth-mock.jsx` | **silindi** |
| `src/lib/auth.js` → `src/lib/auth.jsx` | **rename** (JSX içeriyor) |
| `src/App.jsx` | import path swap + JSDoc güncel |
| `src/pages/AccountingPage.jsx` | import path swap |
| `src/pages/CalendarPage.jsx` | import path swap |
| `src/pages/GuestsPage.jsx` | import path swap |
| `src/pages/LoginScreen.jsx` | import + mock banner kaldırıldı + default email/şifre boşaltıldı + JSDoc güncel |
| `src/pages/ReservationListPage.jsx` | import path swap |
| `src/pages/RoomsPage.jsx` | import path swap |
| `src/pages/SettingsPage.jsx` | import path swap |
| `src/pages/UsersPage.jsx` | import path swap |
| `src/modals/KullaniciFormModal.jsx` | createUserWithProfile import + save akışı + uyarı banner + email disabled (düzenleme) |
| `CLAUDE.md` | Sürüm v1.0-beta + "Şu An Nerede" güncellendi |
| `docs/CLAUDE_HOTELUTER_v1.0-beta.md` | **yeni** (bu dosya) |

**Build:** `npm run build` yeşil, **1632 modül**, 7.5s.

---

## 🛠️ Teknoloji Stack (değişmedi)

| Katman | Teknoloji | Versiyon | Durum |
|---|---|---|---|
| Build | Vite | 5.4 | ✓ |
| UI | React | 18.3 | ✓ |
| Styling | Tailwind | 3.4 | ✓ |
| Icons | lucide-react | 0.460 | ✓ |
| Backend | Firebase Firestore | 10.13 | ✓ (Rules açık ⚠) |
| Auth | Firebase Auth | 10.13 | **✓ Bağlandı** |
| Kur | Frankfurter API | n/a | ✓ |
| Hosting | Netlify (planlı) | n/a | Görev 11 |

---

## 🔄 Migration Sistemi (değişmedi)

`src/lib/migrations.js` — `App.jsx` → `Bootstrap` mount'unda otomatik çağrılır (user login olduktan sonra):

```
runMigrations()
  → migrate_v01_kanallar           // 5 default kanal
  → migrate_v02_giderKategorileri  // 8 default kategori
  → migrate_v03_hesaplar           // 3 default hesap (anaParaBirimi'nde)
```

Firestore'a yazma yapıldığı için artık authenticated kullanıcı gerekiyor (Görev 10 sonrası kuralları geçecek).

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

## 🧪 Sahada Kullanım (canlı sonrası)

Önce Görev 10-12 kapanacak, sonra:

1. **Login** — gerçek email/şifre. İlk login: `mmertefe9@gmail.com` + Firebase Console'da set ettiğin şifre.
2. **Migration otomatik çalışır** (görünmez).
3. **Ayarlar > Otel Bilgileri** → otel adı, telefon, vergi no, ana para birimi.
4. **Odalar > Oda Tipleri** → en az bir oda tipi.
5. **Odalar > Odalar** → fiziksel odalar.
6. **Misafirler** → en az bir misafir.
7. **Takvim/Rezervasyonlar** → ilk rezervasyon (drag-to-create en hızlı yol).

---

## ⚠️ Bilinen Sınırlamalar (v1.0-beta)

| Konu | Durum | Görev |
|---|---|---|
| **Firestore Security Rules** | ⚠ Hâlâ açık (default `allow read, write`) — production'a gitmemeli | **Görev 10 (HEMEN)** |
| **Yeni kullanıcı yaratırken oturum değişimi** | Firebase client-side davranışı; admin oturumu kapanır, yeni user'a geçilir; uyarı banner ile bildiriliyor | Cloud Functions (sonra) |
| **Password reset UI** | Yok; Firebase Console'dan veya kullanıcı adına email reset link şu an manuel | İleri sürüm |
| **Email değişimi (düzenleme)** | UI'da disabled (admin SDK gerektirir) | Cloud Functions (sonra) |
| **Şifre değişimi UI** | KullaniciFormModal'da yok; `useAuth().changePassword(newPassword)` API var ama bağlı bir form yok | İleri sürüm |
| **Mobile drag-to-move** | HTML5 drag-and-drop API mobile'da kısıtlı | UX iyileştirme |
| **Yedekleme: import** | Sadece export var | Sonra |
| **Bundle boyutu** | 1.55MB (gzip 328KB) — code splitting yok | Optimizasyon (sonra) |
| **Multi-property** | Tek otel varsayımı | v1.0 sonrası |
| **`hesaplar` para birimi seed** | İlk migration'da otel anaParaBirimi henüz set edilmemiş olabilir → EUR'a düşer | Settings tour'undan sonra düzelt |
| **Oda durumu** | Sadece UI gösterimi, takvim render'ını etkilemez | UX iyileştirme |

---

## 🚦 Sıradaki Adımlar

### **Görev 10: Firestore Security Rules (HEMEN — açık güvenlik)**
- `firestore.rules` dosyası
- Login zorunlu (`request.auth != null`)
- `users/{uid}` doc okuma kuralı (kendisi okur, superadmin hepsi)
- Diğer koleksiyonlar için rol bazlı:
  - read: authenticated user
  - write: rol in ['superadmin', 'admin'] (modül bazlı yetki client-side `can()` ile zaten filtreli, ama sunucu tarafı da koruma şart)
- `_meta` koleksiyonu: read open (migration flag'leri client'tan okuyor), write sadece superadmin
- Test: Firebase emulator + production'a deploy

### Görev 11: GitHub + Netlify deploy
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

**Kod stili (proje genelinde tutarlı):**
- Türkçe değişken/fonksiyon isimleri (rezervasyon, misafir, tahsilat, kur, ana...)
- İngilizce React/JS API'leri (useState, useEffect, useMemo)
- JSDoc başlıkları her dosyada
- 2 space indent, hard tab yok
- Hook'lar fonksiyonun başında, return'den önce
- Modal save() pattern: `try { await ...; show('ok'); onSaved?.(); onClose?.(); } catch (e) { show(e.message, 'error'); }`

---

**Bu dosya, yeni Claude session başlarken İLK okuyacağın 2. dokümandır** (1.'si CLAUDE.md). v1.0-alpha dokümanı artık eski — bu dosya onun yerini aldı.
