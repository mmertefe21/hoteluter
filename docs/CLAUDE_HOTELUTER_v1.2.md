# Hoteluter v1.2 — Aktivite Log (3 Faz: Altyapı + Mali Enjeksiyon + UI)

> **Sürüm:** v1.2-dev
> **Tarih:** 12.05.2026 (son güncelleme: Oturum 4 eklendi — 14.05.2026)
> **Önceki:** v1.1 (08.05.2026)
> **Sonraki:** v1.3 (Cloud Functions admin SDK — deleteUser + createUser oturum koruma)
> **Production:** https://hoteluter.com
> **Deploy durumu:** Firestore Rules → ✅ production'da aktif (Firebase Console GUI, 11.05.2026); Frontend kodu → ⏳ deploy bekliyor

Bu doküman v1.2 geliştirme dönemini kayıt altına alır. Dört oturumda tamamlandı. **Oturum 1 (11.05.2026):** Ana feature: **Aktivite Log** — her kullanıcı aksiyonunun "kim, ne zaman, ne yaptı" şeklinde Firestore `aktiviteLog` koleksiyonuna yazılması. 3 fazda tamamlandı: Faz 1 altyapı, Faz 2 17 enjeksiyon noktası, Faz 3 UI. **Oturum 2 (12.05.2026):** SEANS 1 (6 UI iyileştirmesi) + SEANS 2 (Check-in/Out feature) + SEANS 3 (Gider görseli mock mode). **Oturum 3 (13.05.2026):** Kullanıcı kolonu (olusturanId standardı) + Audit Trail mimarisi (düzeltme/iptal pattern) + Secondary Firebase App (kullanıcı oluşturma bug fix) + Firebase Storage production aktivasyonu (mock → gerçek, Blaze plan) + PRESET_RENKLER pastel palet + hesap kart UI polish. **Oturum 4 (14.05.2026):** Yıllık ciro chart label fix + Tek session güvenliği (Firestore aktifSessionId + onSnapshot auto-logout) + Hesap koşullu silme (boş→hard delete, dolu→pasif) + Takvimde oda tipi sıralama (hover ↑↓, siraNo normalize + db.batch swap) + Rapor mantığı doğrulama. 18 AKSIYON_TIPLERI. Toplam ~50 dosya, ~1300 satır. Firestore Rules + Storage Rules Firebase Console GUI üzerinden production'a deploy edildi; frontend kodu henüz push/deploy edilmedi.

---

## 🎯 Bu Sürümde Yapılanlar

### Aktivite Log — Genel Bakış

14 aksiyon tipi, 17 çağrı noktası, 3 faz, ~18 dosya.

**14 aksiyon tipi (`AKSIYON_TIPLERI`):**

| Grup | Aksiyonlar |
|---|---|
| Auth | `auth.giris` · `auth.cikis` |
| Rezervasyon | `rezervasyon.olustur` · `rezervasyon.duzenle` · `rezervasyon.sil` |
| Tahsilat | `tahsilat.olustur` · `tahsilat.duzenle` · `tahsilat.sil` |
| Gider | `gider.olustur` · `gider.duzenle` · `gider.sil` |
| Transfer | `transfer.olustur` |
| Hesap | `hesap.giris` · `hesap.cikis` |

**Temel kodlama kuralları (tüm enjeksiyon noktalarında uygulandı):**
- `void logAksiyon(...)` — fire-and-forget, hiç `await` yok
- `logAksiyon` çağrısı her zaman `batch.commit()` / `await` SONRA, hiçbir zaman içinde değil
- `try/catch` `logAksiyon` içine sarılı — asla throw etmez, log başarısız olsa bile ana akış devam eder
- `aciklama` alanı: kullanıcıya gösterilecek metin (örn. `"Anna için 4 gece rez. oluşturdu"`) — `AKSIYON_TIPLERI` key'i değil

---

### Faz 1 — Altyapı

**Yeni dosya: `src/helpers/aktiviteLog.js`**

İki helper içerir:

- **`logAksiyon({ aksiyon, aciklama, hedefTip?, hedefId? })`** — `aktiviteLog` koleksiyonuna yeni doküman ekler. `tarih` (Firestore `serverTimestamp()`), `kullaniciId`, `kullaniciAd` otomatik eklenir. Yazım sonrasında `users/{uid}.sonAksiyon` (description metni) ve gerekirse `users/{uid}.sonGiris` (Timestamp) güncellenir.
- **`logGiris(tip)`** — `'giris'` veya `'cikis'` parametresiyle `logAksiyon` sarmalayıcısı; `auth.giris`/`auth.cikis` aksiyonu ile çağırır, `users/{uid}.sonGiris` Timestamp günceller.

Her iki fonksiyon da `try/catch` ile sarmalı — throw etmez, log yazılamazsa sessizce devam eder.

**`src/lib/constants.js`** — `AKSIYON_TIPLERI` sabiti eklendi (14 key → Türkçe label çifti), `export` ile dışa açıldı. `AktiviteSettings` filtre dropdown ve `hesapHareketleri` badge render burada tüketir.

**`src/lib/permissions.js`** — `aktivite` modülü `ALL_MODULES` array'ine eklendi:
```js
{ key: 'aktivite', ad: 'Aktivite Logu', icon: 'activity', actions: ['goruntule'] }
```
`KullaniciFormModal` checkbox listesi `ALL_MODULES`'tan otomatik render ettiği için dokunulmadı — yeni modül otomatik görünür.

**`src/lib/auth.jsx`** — `logGiris` entegrasyonu iki noktada:
- Başarılı giriş: `onAuthStateChanged` callback'i içinde oturum başladığında `void logGiris('giris')`
- Çıkış: `logout()` fonksiyonunda `void logGiris('cikis')`

**`firestore.rules`** — İki yeni blok eklendi:
```
match /aktiviteLog/{docId} {
  allow read: if isActiveUser();
  allow write: if hasYetki();
}
```
`hasYetki()` yardımcı fonksiyonu: servis hesabı veya kendi UID'sine ait yazımı doğrular; kullanıcının doğrudan `aktiviteLog`'a yazmasını engeller.

---

### Faz 2 — Enjeksiyon Noktaları

#### Faz 2A — Auth (2 nokta)

`src/lib/auth.jsx` — yukarıda Faz 1 entegrasyonunda açıklandı.

- `auth.giris`: oturum başlangıcında, `kullaniciAd` ile
- `auth.cikis`: `logout()` çağrısında, mevcut oturum bilgisiyle

#### Faz 2B — Rezervasyon CRUD (3 nokta)

`src/modals/ReservationFormModal.jsx` — Faz 2'nin ilk oturumunda (bu oturumdan önce) tamamlandı.

- **`rezervasyon.olustur`:** `db.add('rezervasyonlar', ...)` döndükten sonra; `aciklama: "[Misafir] için [N] gece rez. oluşturdu"`, `hedefId: result.id`
- **`rezervasyon.duzenle`:** `db.update(...)` döndükten sonra
- **`rezervasyon.sil`:** `db.delete(...)` döndükten sonra

#### Faz 2C — Mali Enjeksiyon (9 nokta + 3 yan etki)

9 enjeksiyon noktası 6 dosyada. Tümü `await` işlem tamamlandıktan sonra `void logAksiyon(...)`.

**C1 — `tahsilat.olustur`** (`src/modals/TahsilatModal.jsx`):
- `const result = await addTahsilatWithHareket(...)` döndükten sonra
- Grup tahsilatı: `"[Grup Adı] için toplu tahsilat oluşturdu"` · Oda tahsilatı: `"[Misafir] için X PB tahsilat oluşturdu"`
- `hedefId: result?.id ?? null`

**C2 — `tahsilat.duzenle`** (`src/modals/TahsilatModal.jsx`):
- `await updateTahsilatWithHareket(...)` döndükten sonra
- `` aciklama: `${form.tutar} ${formPB} tahsilatı düzenledi` ``

**C3a — `tahsilat.sil`** (`src/modals/ReservationFormModal.jsx`):
- SE-3 race condition fix ile birlikte (aşağıya bakın)
- `hedefId: tah.id` (capture'dan)

**C3b — `tahsilat.sil`** (`src/pages/AccountingPage.jsx`):
- Capture pattern: `const del = confirmDelTah; setConfirmDelTah(null)` — state temizlenmeden önce capture
- `await deleteTahsilatWithHareket(del.id)` döndükten sonra log

**C3c — `tahsilat.sil`** (`src/modals/HesapDetayModal.jsx`):
- `h` parametresi zaten capture olarak geldiği için race condition yok
- `await deleteTahsilatWithHareket(h.tahsilatId)` döndükten sonra log

**C4 — `gider.olustur`** (`src/modals/GiderModal.jsx`):
- `const yeniGider = await addGiderWithHareket(...)` döndükten sonra
- `` aciklama: `${seciliKat?.ad || 'Gider'} gideri oluşturdu, ${form.tutar} ${formPB}` ``
- `formPB = form.paraBirimi || ana` (güvenli fallback; `form.paraBirimi` boş olabilir)
- `hedefId: yeniGider?.id ?? null`

**C5 — `gider.duzenle`** (`src/modals/GiderModal.jsx`):
- `await updateGiderWithHareket(...)` döndükten sonra
- `` aciklama: `${seciliKat?.ad || 'Gider'} giderini düzenledi` ``

**C6a — `gider.sil`** (`src/pages/AccountingPage.jsx`):
- Capture pattern: `const del = confirmDelGider; setConfirmDelGider(null)`
- `await deleteGiderWithHareket(del.id)` döndükten sonra log

**C6b — `gider.sil`** (`src/modals/HesapDetayModal.jsx`):
- `h` parametresi ile, race condition yok

**C7 — `transfer.olustur`** (`src/modals/TransferModal.jsx`):
- Her iki branch (normal TRY transferi + döviz transferi) **aynı template:**
  `` `${kaynak.ad} → ${hedef.ad} transfer yaptı, ${tutar} ${kPB}` ``
- Normal branch: `const result = await yapTransfer(...)`, `tutar = form.tutar`
- Döviz branch: `const result = await yapDovizTransfer(...)`, `tutar = form.cikanTutar`
- `kPB = kaynak?.paraBirimi || ana` (TransferModal form state'inde `paraBirimi` alanı yoktur)
- `hedefId: result?.transferId ?? null`

**C8 — `hesap.giris`** (`src/modals/HesapDetayModal.jsx`):
- `await addManuelHareket(...)` döndükten sonra, `manForm.tip === 'manuel-giris'` dalında
- `` aciklama: `${hesap.ad} hesabına manuel giriş yaptı, ${manForm.tutar} ${hesapPB}` ``

**C9 — `hesap.cikis`** (`src/modals/HesapDetayModal.jsx`):
- Aynı `addManuelHareket` sonrası, `else` dalında
- `` aciklama: `${hesap.ad} hesabından manuel çıkış yaptı, ${manForm.tutar} ${hesapPB}` ``

**Yan Etkiler:**

- **SE-1 — `TahsilatModal` `gruplar` prop:** Grup adını açıklamaya yazabilmek için `gruplar = []` default prop eklendi; tüketici sayfalar `gruplar={gruplar}` geçmeli.
- **SE-2 — `AccountingPage` `gruplar` hook:** `const gruplar = useCollection('gruplar')` eklendi, `TahsilatModal`'a `gruplar={gruplar}` geçildi.
- **SE-3 — Race condition fix:** Ayrı bölümde açıklandı (aşağıya bakın).

---

### Faz 3 — UI

#### Yeni dosya: `src/pages/settings/AktiviteSettings.jsx`

Aktivite loglarını listeleyen, filtreleyen ve lazy-load eden yeni sayfa bileşeni.

**Yükleme stratejisi:**
- `getDocs` kullanılır (`onSnapshot` değil) — log koleksiyonu büyüdükçe gereksiz real-time re-render önlenir
- Sorgu: `orderBy('tarih', 'desc') + limit(50)` — tek alan sıralama, composite index gerektirmez
- `loadFirst()` bileşen mount'ında `useEffect([], [])` ile çağrılır
- "Daha fazla yükle" butonu: `startAfter(lastVisible)` ile +50 doc ekler; `hasMore = snap.docs.length === 50` ile cursor tükenmesi tespit edilir

**Filtreler (tamamı client-side):**
- Kullanıcı seçimi (`select` — `useCollection('users')` ile doldurulur)
- Aksiyon Tipi (`select` — `AKSIYON_TIPLERI` ile doldurulur)
- Başlangıç tarihi (`input[type=date]`)
- Bitiş tarihi (`input[type=date]`)
- Açıklamada serbest metin arama

**`filtered`:** `useMemo(() => loaded.filter(...), [loaded, filterKullaniciId, filterAksiyon, filterBaslangic, filterBitis, filterMetin])` — 6 bağımlılık, gereksiz yeniden hesaplama önlenir.

**Kullanıcı adı lookup:** `users.find(x => x.id === log.kullaniciId)`, fallback `log.kullaniciAd` (log yazılırken snapshot alınan yedek alan).

**`fmtTS(ts)`:** `ts?.toDate?.() ?? new Date(ts)` — hem Firestore Timestamp hem ISO string kabul eder. `isNaN(d)` guard ile `'—'` fallback.

#### `src/pages/SettingsPage.jsx` güncelleme

- `import AktiviteSettings from './settings/AktiviteSettings.jsx'` eklendi
- `const { user } = useAuth()` → `const { user, can } = useAuth()` (destructure genişletildi)
- Tab sırası: ...Yedekleme → Kullanıcılar (superadmin) → **Aktivite** (`can('aktivite', 'goruntule')`)
- Tab içeriği: `{tab === 'aktivite' && can('aktivite', 'goruntule') && <AktiviteSettings />}`

#### `src/pages/UsersPage.jsx` güncelleme

- `fmtTimestamp(ts)` helper eklendi (component dışı, import'ların hemen altı) — aynı dual-format Timestamp/ISO pattern
- `thead`: `<th>Son Giriş</th>` + `<th>Son Aksiyon</th>` eklendi (toplamda 9 sütun başlığı)
- `tbody`: iki yeni `<td>`:
  - Son Giriş: `{fmtTimestamp(u.sonGiris)}` — `text-sm` + `var(--ink-soft)` renk
  - Son Aksiyon: `{u.sonAksiyon || '—'}` — `max-w-[200px] truncate` CSS + `title={u.sonAksiyon}` hover tooltip

> `AKSIYON_TIPLERI` import YOK — `sonAksiyon` açıklama metni sakladığından key→label mapping gerekmez.

---

## 🗄️ `aktiviteLog` Koleksiyonu + `users` Alanları

### `aktiviteLog/{docId}` şeması

| Alan | Tip | Açıklama |
|---|---|---|
| `tarih` | Firestore Timestamp (`serverTimestamp()`) | Log zamanı — `orderBy('tarih', 'desc')` index |
| `kullaniciId` | string | Firebase Auth UID |
| `kullaniciAd` | string | Snapshot (adSoyad veya kullaniciAdi, log anında çekilir) |
| `aksiyon` | string | `AKSIYON_TIPLERI` key (örn. `tahsilat.olustur`) |
| `aciklama` | string | Kullanıcıya gösterilecek Türkçe açıklama metni |
| `hedefTip` | string? | İlgili kayıt tipi (`rezervasyon` / `tahsilat` / `gider` / `hesap`) |
| `hedefId` | string? | İlgili Firestore doküman ID'si (gelecekte detay navigasyonu için) |

### `users/{uid}` yeni alanlar (logAksiyon tarafından güncellenir)

| Alan | Tip | Açıklama |
|---|---|---|
| `sonGiris` | Firestore Timestamp | Son başarılı `auth.giris` zamanı — `UsersPage` tablosunda gösterilir |
| `sonAksiyon` | string | Son aksiyon açıklama metni (key değil) — `UsersPage` tablosunda `truncate` ile gösterilir |

---

## 🔐 Yeni Yetki: `aktivite-goruntule`

`src/lib/permissions.js` `ALL_MODULES`'a eklenen yeni modül:

```js
{ key: 'aktivite', ad: 'Aktivite Logu', icon: 'activity', actions: ['goruntule'] }
```

- `KullaniciFormModal` checkbox listesi `ALL_MODULES`'tan otomatik render ettiği için **dokunulmadı** — yeni checkbox otomatik görünür
- `SettingsPage` Aktivite sekmesi `can('aktivite', 'goruntule')` ile gizlenir/gösterilir
- `superadmin` için `can()` her zaman `true` — superadmin sekmesini her koşulda görür
- Mevcut kullanıcıların `modulYetkileri.aktivite` alanı yoksa sekme otomatik gizlenir (superadmin hariç); yetki açıkça verilmesi gerekir

---

## 🐛 SE-3: `tahsilatSil` Race Condition Fix

**Problem:** `ReservationFormModal.jsx`'te `tahsilatSil(tahsilatId)` fonksiyonu state'i `await` öncesinde `null`'a temizliyordu. Ardından async işlem tamamlanıp log yazılmaya çalışıldığında `confirmTahDel` zaten `null`'dı — runtime hatası.

```js
// ❌ Eski (hatalı)
const tahsilatSil = async (tahsilatId) => {
  setConfirmTahDel(null);               // state temizlendi
  await deleteTahsilatWithHareket(tahsilatId);
  void logAksiyon({ hedefId: confirmTahDel.id }); // ← null.id: CRASH
};
onConfirm={() => tahsilatSil(confirmTahDel.id)}
```

```js
// ✅ Yeni (capture pattern)
const tahsilatSil = async () => {
  const tah = confirmTahDel;            // önce capture et
  setConfirmTahDel(null);               // sonra state'i temizle
  try {
    await deleteTahsilatWithHareket(tah.id);
    void logAksiyon({
      aksiyon: 'tahsilat.sil',
      aciklama: `${tah.tutar} ${tah.paraBirimi || ''} tahsilatı sildi`,
      hedefTip: 'tahsilat',
      hedefId: tah.id,
    });
    show('Tahsilat silindi.');
    onSaved?.();
  } catch (e) { show('Hata: ' + e.message, 'error'); }
};
onConfirm={tahsilatSil}                 // argümansız — capture'dan okur
```

**Aynı pattern** `AccountingPage.jsx`'te C3b ve C6a için de uygulandı — `confirmDelTah` ve `confirmDelGider` state'leri `await` öncesinde temizleniyordu, aynı risk vardı.

---

## SEANS 1 — UI İyileştirmeleri (12.05.2026)

6 madde, ~10 dosya, ~250 satır. CalendarPage ağırlıklı.

### Madde 1 — Takvimde Oda Tipi Gruplaması

Dosya: `src/pages/CalendarPage.jsx`

`odaTipiGruplari` useMemo eklendi: `filteredOdalar` → `odaTipiId`'ye göre `{ odaTipi, tipId, odalar[] }` array'ine reduce. Tipler Türkçe alfabetik, odalar numerik sıralı.

Render değişikliği: `filteredOdalar.map` → `odaTipiGruplari.map` ile her grup için başlık satırı + oda listesi. Başlık `<div style={{ gridColumn: '1 / -1', sticky left:0 }}>`. Drag-to-create/move akışları korunur.

### Madde 2 + 4 — Bar Renk Skalası (getResStyle)

Dosya: `src/pages/CalendarPage.jsx`

```js
const getResStyle = (res, _seg) => {
  const grup = res.grupId ? gruplar.find((g) => g.id === res.grupId) : null;
  if (grup) return { background: grup.renk };
  if (res.checkOutTarihi) return { background: '#d97706' }; // turuncu
  if (res.checkInTarihi) return { background: '#16a34a' };  // yeşil
  return { background: '#2563eb' }; // mavi — onaylı
};
```

Renk hiyerarşisi: grup > checkout > checkin > onaylı. Madde 2'de `var(--forest)` → mavi (#2563eb) olarak planlandı; Madde 4 (SEANS 2) ile birleştirildi.

### Madde 5 — Borç Durumu Üst Şerit

Dosya: `src/pages/CalendarPage.jsx`

İki yeni `useMemo`:
- `borcMap`: `{ [rezId]: number }` — grup-dışı rezervasyonların `toplamTutar - Σ tahsilat.tutarAna`
- `grupBorcMap`: `{ [grupId]: number }` — grup oda tahsilatları + havuz tahsilatları toplamı

Her bar içine `position: absolute` 4 px üst şerit: `borç > 0.01 ? 'var(--danger)' : 'var(--success)'`. Grup şeridi (5 px) varsa borç şeridi `top: 5`.

### Madde 6A — HesapFormModal Renk Seçimi

Dosya: `src/modals/HesapFormModal.jsx`

`PRESET_RENKLER` import eklendi. "Renk" bölümü Hesap Tipi ile Para Birimi arasına eklendi: 8 adet `w-7 h-7 rounded-full` buton, seçili olan `boxShadow` ring efekti. Tip seçince `renk: t.renk` auto-update korunur; kullanıcı sonra override edebilir.

### Madde 6B — AccountingPage Kart Renkleri

Dosya: `src/pages/AccountingPage.jsx`

`getReadableTextColor(hex)` helper eklendi (component dışında): luminance formülü `(r*299 + g*587 + b*114)/1000 < 128 ? '#ffffff' : '#1a1a1a'`.

Her hesap kartında: `cardRenk = h.renk || tipInfo.renk`, `textRenk = getReadableTextColor(cardRenk)`, `textSoft` alfa ile yumuşatılmış renk. Bakiye şartlı renk:
- Koyu kart (textRenk `#ffffff`): pozitif → `#a8e6a8`, negatif → `#ffb3b3`
- Açık kart (textRenk `#1a1a1a`): pozitif → `var(--success)`, negatif → `var(--danger)`

### Madde 7b — Mobile Sticky Tarih Başlığı

Dosya: `src/pages/CalendarPage.jsx`

Tarih başlığı grid div'ine `sticky top-0 z-20 md:static` + `background: 'var(--forest)'`. Mobile scroll'da tarih satırı yapışık kalır; `md:static` ile masaüstünde normal akış.

### Madde 8 — Doluluk %125 Bug Fix

Dosya: `src/pages/DashboardPage.jsx`

**Root cause:** `gemide` filtresi `r.durum === 'giris-yapildi'` dalında tarih kontrolü yoktu — çıkış tarihi geçmiş check-in'ler hâlâ "gemide" sayılıyordu.

**Fix:**
```js
const gemide = aktifRezler.filter((r) =>
  (r.durum === 'giris-yapildi' || r.durum === 'onayli') &&
  r.girisTarihi <= today &&
  r.cikisTarihi > today
);
```

---

## SEANS 2 — Check-in/Out Feature (12.05.2026)

### Yeni Aksiyon Tipleri

`src/lib/constants.js` `AKSIYON_TIPLERI`'na 2 satır eklendi — toplam 14 → 16 aksiyon tipi:
```js
'rezervasyon.checkin': 'Check-in Yap',
'rezervasyon.checkout': 'Check-out Yap',
```

### Rezervasyon Şeması — 2 Yeni Alan

Schema-less, migration yok. Eski rez'lerde `undefined` → falsy → "Onaylı" (mavi) bar.

| Alan | Tip | Açıklama |
|---|---|---|
| `checkInTarihi` | ISO string (24 char) | Check-in zamanı, `new Date().toISOString()` ile set edilir |
| `checkOutTarihi` | ISO string (24 char) | Check-out zamanı |

### UI — ReservationFormModal.jsx

Modal üstünde `isExisting` koşullu buton grubu. İki yeni state: `checkInConfirm`, `checkOutConfirm`. İki async handler: `handleCheckIn`/`handleCheckOut` — `db.update` + `logAksiyon` + toast + `onSaved/onClose`.

| Buton | Görünür Koşul | Aktif Koşul |
|---|---|---|
| Check-in Yap 🟢 | `!checkInTarihi` | `today >= girisTarihi && today <= cikisTarihi` (ESNEK — süresi boyunca) |
| Check-out Yap 🟠 | `checkInTarihi && !checkOutTarihi` | `today === cikisTarihi` (KATI — önce check-in zorunlu) |

### Davranış Tablosu

| Senaryo | Check-in | Check-out |
|---|---|---|
| Gelecek rez (`today < girisTarihi`) | görünür + disabled "Henüz giriş günü gelmedi" | gizli |
| Giriş günü veya geç check-in | görünür + **AKTİF 🟢** | gizli |
| Çıkış günü, check-in yok | görünür + **AKTİF 🟢** | gizli |
| Süresi geçmiş (`today > cikisTarihi`) | görünür + disabled "Rezervasyon süresi geçti" | gizli |
| Check-in yapıldı, çıkış günü değil | gizli | görünür + disabled |
| Check-in yapıldı + çıkış günü | gizli | görünür + **AKTİF 🟠** |
| Tamamlanmış | gizli | gizli |

### Tarih Format Uyumluluğu (Önemli Not)

| Alan | Fonksiyon | Format |
|---|---|---|
| `girisTarihi` / `cikisTarihi` | `localISODate()` | `"2026-05-12"` (10 char) |
| `today` | `todayISO()` | `"2026-05-12"` (10 char) |
| `checkInTarihi` / `checkOutTarihi` | `new Date().toISOString()` | `"2026-05-12T14:23:45.123Z"` (24 char) |

`today === girisTarihi` ve `today >= girisTarihi` karşılaştırmaları **10 char vs 10 char** — sorunsuz. `checkInTarihi`/`checkOutTarihi` sadece **kayıt zamanı** bilgisi olarak kullanılır (ne zaman yapıldı); tarih karşılaştırmasında kullanılmaz → format farkı bug yaratmıyor.

> ⚠️ **İleride Cloud Functions geçilirse (v1.3):** `serverTimestamp()` kullanımına geçilebilir. Timestamp/string karışımı dikkatle ele alınmalı — `checkInTarihi?.toDate?.()` guard gerekir.

### Bar Renk Skalası

`#2563eb` Mavi (Onaylı) → `#16a34a` Yeşil (Check-in yapıldı) → `#d97706` Turuncu (Check-out yapıldı)

Grup rezervasyonları grup rengini kullanır (en yüksek öncelik). Borç şeridi (4 px kırmızı/yeşil) bağımsız çalışır, renk skalasından etkilenmez.

---

## SEANS 3 — Gider Görseli Upload (Mock/Base64 Mode) (12.05.2026)

⚠️ **Firebase Storage henüz aktive edilmedi.** Dosyalar Firestore document'a base64 string olarak yazılıyor.

### Yeni Dosya: `src/lib/storage.js`

| Export | Açıklama |
|---|---|
| `STORAGE_LIMITS` | `MAX_FILE_SIZE` 1 MB · `MAX_TOTAL_SIZE` 800 KB · `MAX_FILES` 5 · `ALLOWED_TYPES` jpeg/png/pdf |
| `validateFile(file)` | Tip + boyut kontrol → `{ ok, error }` |
| `validateTotalSize(currentFiles, newFile)` | Toplam boyut kontrol → `{ ok, error }` |
| `fileToBase64(file)` | `Promise<string>` — `FileReader` ile dataURL |
| `uploadGiderGorsel(giderId, file)` | Mock: `{ fileName, type, size, dataUrl, uploadedAt }` döner |
| `deleteGiderGorsel(giderId, fileName)` | No-op (mock mode) — TODO yorum: Storage aktif olunca `deleteObject` |

### Gider Şeması — 1 Yeni Alan

`gorseller: [{ fileName, type, size, dataUrl, uploadedAt }]` — schema-less, eski giderler `undefined` fallback.

### GiderModal.jsx Değişiklikleri

- `gorseller: []` form init (yeni + edit her iki branch — edit modunda `target.gorseller || []`)
- `handleFileChange`: dosya validasyonu + `_pending: true, file: File` ile form state'e ekler
- `removeGorsel(index)`: filter ile listeden çıkarır
- `save()` refactor: `_pending` → `uploadGiderGorsel` → sanitize (`_pending`+`file` alanları çıkar) → `gorseller: finalGorseller` payload'a
- logAksiyon C4/C5 açıklamalarına `(N görsel)` eki
- UI: Açıklama altına "Görseller / Faturalar" bölümü (dosya seç + liste + toplam boyut göstergesi)

`addGiderWithHareket` spread `...gider` ile `gorseller` otomatik geçer. `updateGiderWithHareket` `merged = { ...old, ...partial }` ile `gorseller` korunur.

### Mock → Real Storage Geçiş Planı

1. `firebase.js`'e `getStorage` init ekle
2. `uploadGiderGorsel`: `uploadBytes + getDownloadURL`, `dataUrl` yerine `url` field döner
3. `deleteGiderGorsel`: `deleteObject` çağrısı ekle
4. GiderModal değişmez (`dataUrl || url` check yeterli)
5. Eski base64 görseller geriye uyumlu kalır (`dataUrl` alanı mevcut)
6. Gider silme akışına Storage temizliği eklenir (TODO yorum `storage.js`'te mevcut)

### Bilinen Sınırlama (Mock Mode)

Chrome data:URL'lere top-level navigation engeli nedeniyle `external-link` butonu yeni sekmede açılmıyor. Firebase Storage'a geçince HTTP URL döneceği için çözülür. 800 KB toplam limit Firestore 1 MB doc sınırı için güvenli marj; Storage'a geçince bu limit kalkar.

---

---

## OTURUM 3 (13.05.2026) — Kullanıcı Takibi + Audit Trail + Storage + UI Polish

### A) Kullanıcı Takibi — "Kim Yaptı" Kolonu

#### olusturanId Standartlaşması

`hesapHareketleri` dokümanlarında kim yarattı bilgisi eksikti. `transfer.js` zaten `olusturanId` yazıyordu; tahsilat ve gider aynı standarda çekildi.

- `helpers/tahsilat.js`: `addTahsilatWithHareket` + `updateTahsilatWithHareket` → `hesapHareketleri.olusturanId` eklendi
- `helpers/gider.js`: Symmetric pattern — `addGiderWithHareket` + `updateGiderWithHareket`
- Update fonksiyon signature'ına 4. parametre eklendi: `(id, partial, ana, kullaniciId)`
- Çağrı noktaları güncellendi: `TahsilatModal`, `GiderModal`, `AccountingPage`, `ReservationFormModal`, `HesapDetayModal` — tümüne `userId`/`user?.id` geçirildi

#### UI — Kullanıcı Kolonu

- `AccountingPage` Hareketler tab: `useCollection('users')` + `userMap` useMemo (`Object.fromEntries` ile O(1) lookup) + `<th>Kullanıcı</th>` + `<td>{userMap[h.olusturanId]?.kullaniciAdi || '—'}</td>`
- `HesapDetayModal` Hareket Geçmişi tablosu: Aynı pattern
- Eski kayıtlar `olusturanId` içermez → `'—'` fallback (additive, crash yok)

---

### B) Audit Trail Mimarisi — Düzeltme + İptal

#### 2 Yeni HAREKET_TIPI (constants.js)

```js
{ v: 'duzeltme', l: 'Düzeltme', yon: '+' },
{ v: 'iptal',    l: 'İptal',    yon: '-' },
```

`'tahsilat-iptal'` (eski, kullanılmıyor) additive korundu.

#### Akış Değişikliği

**Önceden (silme + yazma):**
- `updateXxxWithHareket`: Eski hareket sil → Yeni hareket yaz
- `deleteXxxWithHareket`: Eski hareket sil + Doc sil

**Şimdi (audit trail — append-only):**
- `updateXxxWithHareket`: Eski hareket **kalır** → Bakiyeyi etkileyen değişikliklerde düzeltme hareketi **eklenir**
  - Sadece tutar değişti → 1 fark hareketi (signed)
  - Hesap veya PB değişti → 2 hareket (eski hesapta ters, yeni hesapta yeni değer)
  - Tarih/yöntem/açıklama değişti → Sadece doc update, hareket **yazılmaz**
- `deleteXxxWithHareket`: Doc silinir → Eski hareket **kalır** → İptal hareketi **eklenir** (ters tutar)

#### Helper Signature

```
deleteTahsilatWithHareket(tahsilatId, kullaniciId)
updateTahsilatWithHareket(tahsilatId, partial, ana, kullaniciId)
deleteGiderWithHareket(giderId, kullaniciId)
updateGiderWithHareket(giderId, partial, ana, kullaniciId)
```

#### İptal/Düzeltme Hareketi Field Kuralları

| Alan | Düzeltme | İptal |
|---|---|---|
| `tahsilatId`/`giderId` | id (doc yaşıyor) | null (doc silindi) |
| `olusturanId` | kullaniciId | kullaniciId |
| `tarih` | `todayISO()` | `todayISO()` |
| `tip` | `'duzeltme'` | `'iptal'` |

#### Gider Yön Notu

Gider hareketleri negatif tutar içerir (`tutar: -tutarOrij`). Buna göre:
- İptal hareketi: `+old.tutar` (pozitif — negatifi geri alır)
- Tutar değişimi farkı: `old.tutar - yeniTutar` (tahsilat'ın tersine)

---

### C) Secondary Firebase App — Kullanıcı Oluşturma Bug Fix

#### Problem

Firebase client SDK davranışı: `createUserWithEmailAndPassword(auth, ...)` çağrıldığında mevcut admin oturumu yeni kullanıcıya geçer. Admin tekrar giriş yapmak zorunda kalıyordu.

#### Çözüm — Secondary App Pattern

`firebase.js`'e ikinci izole uygulama instance'ı eklendi:

```js
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
export const secondaryAuth = getAuth(secondaryApp);
```

`auth.jsx` `createUserWithProfile` try/finally pattern:

```js
try {
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await setDoc(doc(firestore, 'users', cred.user.uid), { ...profile, email, aktif: true, olusturmaTarihi: ... });
  void logAksiyon({ aksiyon: 'kullanici.olustur', aciklama: `Kullanıcı oluşturuldu: ${profile.adSoyad}`, hedefTip: 'user', hedefId: cred.user.uid });
  return cred.user.uid;
} finally {
  await signOut(secondaryAuth).catch(() => {}); // secondary session temizle
}
```

#### Sonuçlar

- Admin oturumu BOZULMAZ — birincil `auth` instance etkilenmez
- Secondary session her koşulda (başarı veya hata) `finally` bloğu ile temizlenir
- `KullaniciFormModal` sarı uyarı kutusu **kaldırıldı**
- Toast: `"Kullanıcı oluşturuldu."` (eski "tekrar giriş yapın" uyarısı yok)
- `AKSIYON_TIPLERI`: `'kullanici.olustur': 'Kullanıcı Oluşturma'` eklendi (16 → 17 tip)

---

### D) Firebase Storage Production — Mock'tan Gerçeğe Geçiş

#### Aktivasyon

- Firebase Console > Storage aktive edildi (Blaze plan)
- Bucket: `hoteluter.firebasestorage.app`
- Bölge: `europe-west1`

#### storage.js Tam Refactor

| Alan | Eski (mock) | Yeni (production) |
|---|---|---|
| `MAX_FILE_SIZE` | 1 MB | **5 MB** |
| `MAX_TOTAL_SIZE` | 800 KB | **25 MB** |
| `fileToBase64` | vardı | **kaldırıldı** |
| `uploadGiderGorsel(giderId, file)` | base64 döner | `uploadBytes + getDownloadURL`, **`url`+`path`** döner |
| `deleteGiderGorsel(giderId, fileName)` | no-op | `deleteObject(ref(storage, path))`, **path yoksa skip** |

Path formatı: `giderler/{timestamp}_{random6}_{safeName}` — giderId bağımlılığı yok, Firestore doc'ta saklanır.

#### Gider Doc Şeması Değişimi

```
Eski: { fileName, type, size, dataUrl, uploadedAt }
Yeni: { fileName, type, size, url, path, uploadedAt }
```

#### Backward Compat

- `GiderModal` thumbnail: `g.url || g.dataUrl`
- `GiderModal` external-link: `href={g.url || g.dataUrl}`
- `deleteGiderGorsel(path)`: `path` yoksa (eski base64 kayıt) sessizce döner

#### gider.js Storage Cleanup

`deleteGiderWithHareket` içinde Storage temizliği eklendi:

```js
for (const g of (old.gorseller || [])) {
  await deleteGiderGorsel(g.path); // path yoksa no-op
}
```

#### Storage Rules (13.05.2026 — Firebase Console > Storage > Rules)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /giderler/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*|application/pdf');
      allow delete: if request.auth != null;
    }
  }
}
```

#### Çözülen Bilinen Sınırlamalar

- ✅ Firebase Storage aktif değildi (mock/base64 mode) → **Aktif (production)**
- ✅ Chrome `data:URL` yeni sekmede açılmıyordu → **HTTPS URL ile çözüldü**

---

### E) PRESET_RENKLER + Hesap Kart UI Polish

#### Yeni Renk Paleti (constants.js)

8 koyu renk → 8 pastel ton (tümü luminance ≥ 128 → `getReadableTextColor` koyu metin seçer):

```js
// Eski (koyu, beyaz metin)
['#4a6b85', '#a87842', '#4a7c59', '#8e5572', '#5e6b8e', '#c87f3e', '#a64545', '#6b6b6b']

// Yeni (pastel, koyu metin)
['#5b8def', '#4caf7c', '#f0a050', '#b894d9', '#7eb0d5', '#e8a87c', '#ef9a9a', '#b5b5b5']
// Mavi · Yeşil · Turuncu · Lila · Sky · Şeftali · Mercan · Gri
```

#### hexToRgba Helper + Pastel Render (AccountingPage)

```js
const hexToRgba = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
```

- Kart `background`: `hexToRgba(cardRenk, 0.5)` — cream zemin süzülür, pastel etki
- `getReadableTextColor` hex değeri alır — **dokunulmadı**

#### Alt Başlık Okunaklılığı

```js
// Eski
textSoft = textRenk === '#ffffff' ? 'rgba(255,255,255,0.65)' : 'var(--ink-faint)'

// Yeni
textSoft = textRenk === '#ffffff' ? 'rgba(255,255,255,0.85)' : 'rgba(26,26,26,0.7)'
```

`var(--ink-faint)` (~30% opacity) yerine `rgba(26,26,26,0.7)` — alt başlık (Kasa · € EUR) artık okunakli.

#### Modal Tutarlılığı Notu

`HesapFormModal` renk seçici butonları **dokunulmadı** — kullanıcı doygun rengi görür (gerçek hex), kart render'da pastel görünür. Bilinçli tercih (v1.3+ değerlendirilebilir).

---

---

## OTURUM 4 (14.05.2026) — UI/UX İyileştirmeleri + Tek Session Güvenliği

### A) Madde 1 — Yıllık Ciro Chart Label Fix

**Problem:** ReportsPage yıllık ciro chart'ında en yüksek bar'ın üzerindeki hover tooltip SVG viewBox'ın dışına taşıyordu. `margin.top=20`, tooltip `y={-44}` offset → koordinat -30 → kart kenarının dışında kesiliyor.

**Çözüm:** `chartH: 260 → 290`, `margin.top: 20 → 50`. `innerH = 200` KORUNDU (bar yükseklikleri değişmedi — sadece üst boşluk açıldı).

Etkilenen: `src/pages/ReportsPage.jsx` (1 satır)

---

### B) Madde 2 — Tek Session Güvenliği (Firestore aktifSessionId Pattern)

**Problem:** Bir kullanıcı birden fazla cihazdan/tarayıcıdan eş zamanlı giriş yapabiliyordu.

**Çözüm — Firestore sessionId Pattern:**

1. `onAuthStateChanged` (fbUser + profile yüklendikten sonra):
   - `localStorage.getItem('hoteluter_sid')` → yoksa `crypto.randomUUID()` + `setItem`
   - `updateDoc(users/{uid}, { aktifSessionId: sid })`
   - `onSnapshot(users/{uid})` başlat — `sessionSnapUnsubRef.current` ile yönet
2. Snapshot callback (async DEĞİL):
   - `data?.aktifSessionId` undefined/null → **SKIP** (ilk login edge case, logout loop önler)
   - `data.aktifSessionId !== localSid` → ref cleanup → `localStorage.setItem('hoteluter_loginMsg', '...')` → `signOut(auth)`
3. `onAuthStateChanged(null)` → ref cleanup → `return` (loop önler)
4. `logout()`: a) ref cleanup → b) `localStorage.removeItem('hoteluter_sid')` → c) `signOut(auth)` → d) `updateDoc(aktifSessionId: null).catch(() => {})` best-effort
5. `LoginScreen` mount: `useEffect([], [])` → `localStorage('hoteluter_loginMsg')` kontrol → `setErr` → `removeItem`

**KRİTİK:** `onSnapshot` callback async DEĞİL (Firestore kuraldır). Guard: null/undefined aktifSessionId → SKIP.

**Uyarı mesajı:** `"Başka bir cihazdan giriş yapıldı. Oturumunuz sonlandırıldı."`

**Yeni Firestore Field:** `users.aktifSessionId` (string|null, schema-less)

Etkilenen:
- `src/lib/auth.jsx` (~+45 satır — `useRef` + `onSnapshot` + `updateDoc` import, `sessionSnapUnsubRef`, session setup, logout refactor)
- `src/pages/LoginScreen.jsx` (~+6 satır — `useEffect` import, lazy init → `useState('')`, `useEffect` kick mesajı)

---

### C) Madde 3 — Hesap Koşullu Silme (Boş→Sil, Dolu→Pasif)

**Problem:** Hesap "pasif yap" toggle tek davranış; boş hesapları kalıcı silmek mümkün değildi.

**Çözüm — Deactivation intercept:**

`save()` içinde `target.aktif !== false && form.aktif === false` koşulunda ConfirmModal tetiklenir:
- `harSayisi === 0` → `'sil'` modu: `db.delete('hesaplar')` + `logAksiyon('hesap.sil')`
- `harSayisi > 0` → `'pasif'` modu: `db.update('hesaplar', { aktif: false })`

`confirmPasif` state (`null | 'sil' | 'pasif'`) ile ConfirmModal dinamik title/msg/danger prop.

**Yeni AKSIYON_TIPI:** `'hesap.sil': 'Hesap Silme'` — 17 → **18 tip**

Etkilenen:
- `src/lib/constants.js` (+1 satır)
- `src/modals/HesapFormModal.jsx` (~+35 satır — `ConfirmModal` + `logAksiyon` import, `confirmPasif` state, deactivation intercept, `handlePasifConfirm`, ConfirmModal render)

---

### D) Madde 4 — Takvimde Oda Tipi Sıralama (Hover ↑↓)

**Problem:** Takvimde oda tipi sıralaması alfabetik; kullanıcı tercih ettiği sırayı belirleyemiyordu.

**Yaklaşım:** Takvim sayfasında oda tipi başlığına hover → ↑↓ butonları belirir. Modern UI (Notion/Linear pattern).

**CalendarPage.jsx değişiklikleri:**

- Yeni state: `hoveredTipId` (`useState(null)`)
- Yeni handler: `handleSiraDegis(tipId, direction)` — normalize + swap:
  - Önce taşınan iki tip dışındaki tüm tipleri mevcut görünür index'e normalize eder (idempotent — `siraNo` eksik olanları sabitler)
  - Sonra hedef iki tip için `siraNo`'ları swap eder (`idx ↔ targetIdx`)
  - Tek `db.batch()` ile atomik commit
- Oda tipi başlık `<div>`'ine `onMouseEnter/onMouseLeave` eklendi
- Hover'da `can('odalar', 'duzenle') && hoveredTipId === tipId && odaTipi` koşuluyla ↑↓ butonlar render edilir
- **Buton lokasyonu:** oda tipi adı ile "· N oda" sayısı arasında (sağdan sola taşındı — geniş takvimde erişilebilir)
- Disabled buton: `opacity: 0.3`, `cursor: not-allowed`

`odaTipiGruplari` useMemo sort zaten `siraNo`-first, alfabetik tie-breaker (Oturum 2 / SEANS 1'de yazıldı, bu oturumda sıralama mantığı korundu).

**Yeni Firestore Field:** `odaTipleri.siraNo` (number, schema-less, eski veriler `undefined` → 999 fallback)

**İlk yaklaşım revert:** RoomsPage > Oda Tipleri sekmesine ↑↓ eklenmişti, geri alındı — doğru yer CalendarPage.

Etkilenen:
- `src/pages/CalendarPage.jsx` (~+25 satır)
- `src/pages/RoomsPage.jsx` (orijinal halinde — ilk yaklaşım revert)
- `src/main.jsx` (~+11 satır — `window.migrateOdaTipiSiraNo` DEV scripti)

**DEV Migration Script:** `window.migrateOdaTipiSiraNo` — alfabetik sırayla tüm `odaTipleri`'ne `siraNo` atar. F12 Console'dan tek seferlik. Production deploy ÖNCESİ kaldırılacak.

---

### E) Madde 5 — Rapor Mantığı Doğrulama

**İstek:** Manuel hesap hareketleri ve transferlerin raporlara yansımaması gerekiyordu.

**İnceleme sonucu: Kod zaten doğru.**
- `ReportsPage` `aralikStats` + `yillikStats` doğrudan `tahsilatlar` ve `giderler` koleksiyonlarından çalışıyor
- `hesapHareketleri` koleksiyonundan veri çekmiyor
- Manuel hareketler ve transferler zaten rapora yansımıyor

**Değişiklik:** Yok. Sadece doğrulama yapıldı.

---

### F) DEV Migration Scriptleri (main.jsx)

Üç tek seferlik migration scripti `src/main.jsx` DEV bloğuna expose edildi:

```js
if (import.meta.env.DEV) {
  window.cleanupGorseller = async () => { /* tüm giderler.gorseller → [] */ };
  window.migrateHesapRenkleri = async () => { /* hesaplar renklerini rotation ile yeni palete atar */ };
  window.migrateOdaTipiSiraNo = async () => { /* odaTipleri'ni alfabetik sıraya göre siraNo atar */ };
}
```

**Çalıştırma:** F12 Console → script adı → Enter.

**Status:** `cleanupGorseller` + `migrateHesapRenkleri` 13.05.2026'da çalıştırıldı. `migrateOdaTipiSiraNo` henüz çalıştırılmadı (sıralama kullanılmadan önce çalıştırılmalı). Production deploy ÖNCESİ tüm üçü `main.jsx`'ten **kaldırılacak**.

---

## 🚀 Deploy Durumu

### Firestore Rules — ✅ Production'da Aktif (11.05.2026)

**Yöntem:** Firebase Console > Firestore Database > Rules sekmesi → lokal `firestore.rules` dosyasının güncel içeriği kopyalandı → online editöre yapıştırıldı → **Publish** butonuna basıldı.

**Neden CLI değil:** Projede Firebase CLI kurulu değil, `firebase login` yapılmamış; `firebase deploy --only firestore:rules` yolundan vazgeçildi. Firebase Console GUI yöntemi yeterli ve bağımlılık gerektirmiyor.

> **Bu yöntem ilerideki sürümler için de geçerlidir.** Rules güncellemesi gerektiğinde: lokal `firestore.rules` dosyasını güncelle → içeriği Firebase Console'a kopyala-yapıştır → Publish. CLI kurulumu gerekmez.

**Bu deploy ile production'da aktif olan kurallar:**
- `aktiviteLog` koleksiyonu: aktif kullanıcılar okuyabilir; `hasYetki()` ile korunan yazma
- `hasYetki()` yardımcı fonksiyon
- `gruplar` koleksiyonu (v1.1'den): bu deploy tüm güncel rules içeriğini kapsadığından `gruplar` kuralları da kesin olarak production'da aktiftir

### Frontend Kodu — ⏳ Deploy Bekliyor

Faz 2C + Faz 3 kod değişiklikleri GitHub'a push edilmedi; Netlify'a deploy edilmedi. Aktivite Log enjeksiyon noktaları ve UI production'da henüz canlı değil. Deploy öncesi aşağıdaki "Test Durumu" bölümündeki kontroller önerilir.

---

## 📋 Diff Özeti

**~30 dosya (3 yeni + ~27 değişen)**

### Yeni dosyalar

| Dosya | Satır | Oturum/Faz |
|---|---|---|
| `src/helpers/aktiviteLog.js` | ~60 | Oturum 1 / Faz 1 — logAksiyon + logGiris helper |
| `src/pages/settings/AktiviteSettings.jsx` | ~280 | Oturum 1 / Faz 3 — filtreli aktivite log UI |
| `src/lib/storage.js` | ~66 | Oturum 2 / SEANS 3 — mock base64 upload helper |

### Değişen dosyalar

**Oturum 1 / Faz 1 — Altyapı**

| Dosya | Değişiklik |
|---|---|
| `src/lib/constants.js` | `AKSIYON_TIPLERI` 14 tip eklendi (Oturum 2'de 2 tip daha → toplam 16) |
| `src/lib/permissions.js` | `aktivite` modülü (`goruntule` aksiyonu) eklendi |
| `src/lib/auth.jsx` | Faz 1: `logGiris` import + Faz 2A: giris/cikis çağrıları |
| `firestore.rules` | `aktiviteLog` kuralları + `hasYetki()` fonksiyonu |

**Oturum 1 / Faz 2 — Enjeksiyon Noktaları**

| Dosya | Enjeksiyonlar |
|---|---|
| `src/modals/ReservationFormModal.jsx` | Faz 2B: rez.olustur/duzenle/sil · C3a (tahsilat.sil) + SE-3 fix · SEANS 2: check-in/out butonlar + handlers |
| `src/modals/TahsilatModal.jsx` | C1 (tahsilat.olustur) + C2 (tahsilat.duzenle) + SE-1 (gruplar prop) |
| `src/pages/AccountingPage.jsx` | C3b (tahsilat.sil) + C6a (gider.sil) + SE-2 (gruplar hook) · SEANS 1: `getReadableTextColor` + kart renk değişkenleri |
| `src/modals/HesapDetayModal.jsx` | C3c (tahsilat.sil) + C6b (gider.sil) + C8 (hesap.giris) + C9 (hesap.cikis) |
| `src/modals/GiderModal.jsx` | C4 (gider.olustur) + C5 (gider.duzenle) · SEANS 3: görsel upload |
| `src/modals/TransferModal.jsx` | C7 (transfer.olustur — normal + döviz branch) |

**Oturum 1 / Faz 3 — UI**

| Dosya | Değişiklik |
|---|---|
| `src/pages/SettingsPage.jsx` | AktiviteSettings import + `can` destructure + aktivite tab |
| `src/pages/UsersPage.jsx` | `fmtTimestamp` helper + Son Giriş/Son Aksiyon kolonları |

**Oturum 2 / SEANS 1 — UI İyileştirmeleri**

| Dosya | Değişiklik |
|---|---|
| `src/pages/CalendarPage.jsx` | Madde 1: oda tipi gruplaması · Madde 2+4: getResStyle renk skalası · Madde 5: borç şeridi (borcMap + grupBorcMap) · Madde 7b: sticky tarih başlığı |
| `src/pages/DashboardPage.jsx` | Madde 8: doluluk bug fix (`giris-yapildi` tarih kontrolü) |
| `src/modals/HesapFormModal.jsx` | Madde 6A: `PRESET_RENKLER` renk seçici butonları |

**Oturum 2 / SEANS 2 — Check-in/Out**

| Dosya | Değişiklik |
|---|---|
| `src/lib/constants.js` | `rezervasyon.checkin` + `rezervasyon.checkout` eklendi (toplam 16 tip) |
| `src/modals/ReservationFormModal.jsx` | `checkInConfirm`/`checkOutConfirm` state + `handleCheckIn`/`handleCheckOut` + 2 ConfirmModal |

**Oturum 3 / Kategori A — Kullanıcı Takibi**

| Dosya | Değişiklik |
|---|---|
| `src/helpers/tahsilat.js` | `add`+`update` hesapHareketleri.`olusturanId` · update signature 4. param `kullaniciId` |
| `src/helpers/gider.js` | Symmetric: `add`+`update` hesapHareketleri.`olusturanId` + signature 4. param |
| `src/modals/TahsilatModal.jsx` | `updateTahsilatWithHareket` çağrısına `userId` 4. arg |
| `src/modals/GiderModal.jsx` | `updateGiderWithHareket` çağrısına `userId` 4. arg |
| `src/pages/AccountingPage.jsx` | `useCollection('users')` + `userMap` useMemo + Hareketler tab Kullanıcı kolonu |
| `src/modals/HesapDetayModal.jsx` | `useCollection('users')` + `userMap` + Hareket Geçmişi Kullanıcı kolonu |

**Oturum 3 / Kategori B — Audit Trail (Düzeltme/İptal)**

| Dosya | Değişiklik |
|---|---|
| `src/lib/constants.js` | `HAREKET_TIP_OPTS`: `'duzeltme'` + `'iptal'` eklendi |
| `src/helpers/tahsilat.js` | `updateTahsilatWithHareket` + `deleteTahsilatWithHareket` REFACTOR: audit trail pattern |
| `src/helpers/gider.js` | Symmetric refactor: gider negatif yön, fark formülü tersine |
| `src/pages/AccountingPage.jsx` | `confirmDelTah`/`confirmDelGider` yeni delete signature + ConfirmModal "İptal Et" |
| `src/modals/ReservationFormModal.jsx` | tahsilatSil — `userId` 2. arg (SE-3 capture pattern korunur) |
| `src/modals/HesapDetayModal.jsx` | `handleDelete` — `userId` 2. arg + msg güncellendi |

**Oturum 3 / Kategori C — Secondary Firebase App**

| Dosya | Değişiklik |
|---|---|
| `src/lib/firebase.js` | `secondaryApp` + `secondaryAuth` export |
| `src/lib/auth.jsx` | `createUserWithProfile` → `secondaryAuth` + try/finally signOut + `logAksiyon('kullanici.olustur')` |
| `src/lib/constants.js` | `AKSIYON_TIPLERI`: `'kullanici.olustur'` eklendi (16 → 17 tip) |
| `src/modals/KullaniciFormModal.jsx` | Sarı uyarı kutusu kaldırıldı · toast güncellendi |

**Oturum 3 / Kategori D — Firebase Storage Production**

| Dosya | Değişiklik |
|---|---|
| `src/lib/firebase.js` | `storage` export (`getStorage`) |
| `src/lib/storage.js` | TAM REFACTOR: gerçek Storage, `fileToBase64` kaldırıldı, yeni limitler 5MB/25MB, path-based delete |
| `src/helpers/gider.js` | `deleteGiderWithHareket`: Storage cleanup loop (`g.path` varsa `deleteGiderGorsel`) |
| `src/modals/GiderModal.jsx` | `uploadGiderGorsel(file)` (giderId kaldırıldı) · `g.url \|\| g.dataUrl` backward compat · limit metinleri |
| Firebase Console | Storage aktivasyonu + Storage Rules deploy (13.05.2026) |

**Oturum 3 / Kategori E — UI Polish (Renkler)**

| Dosya | Değişiklik |
|---|---|
| `src/lib/constants.js` | `PRESET_RENKLER` 8 hex yenilendi (koyu → pastel, luminance ≥128) |
| `src/pages/AccountingPage.jsx` | `hexToRgba` helper + `background: hexToRgba(cardRenk, 0.5)` + `textSoft` rgba güncellendi |
| `src/main.jsx` | `window.cleanupGorseller` + `window.migrateHesapRenkleri` DEV bloğu |

**Oturum 4 / Madde 1 — Yıllık Ciro Chart Fix**

| Dosya | Değişiklik |
|---|---|
| `src/pages/ReportsPage.jsx` | `chartH` 260→290, `margin.top` 20→50 (1 satır — tooltip artık kesilmiyor) |

**Oturum 4 / Madde 2 — Tek Session Güvenliği**

| Dosya | Değişiklik |
|---|---|
| `src/lib/auth.jsx` | `useRef` + `onSnapshot` + `updateDoc` import · `sessionSnapUnsubRef` · session setup + onSnapshot dinleyici · logout refactor (cleanup → signOut → updateDoc finally) |
| `src/pages/LoginScreen.jsx` | `useEffect` import · `useState('')` basit init · `useEffect([], [])` kick mesajı yakalama |

**Oturum 4 / Madde 3 — Hesap Koşullu Silme**

| Dosya | Değişiklik |
|---|---|
| `src/lib/constants.js` | `AKSIYON_TIPLERI`: `'hesap.sil': 'Hesap Silme'` eklendi (17 → 18 tip) |
| `src/modals/HesapFormModal.jsx` | `ConfirmModal` + `logAksiyon` import · `confirmPasif` state · `save()` deactivation intercept · `handlePasifConfirm` (sil/pasif iki branch) · ConfirmModal render |

**Oturum 4 / Madde 4 — Oda Tipi Sıralama (Hover ↑↓)**

| Dosya | Değişiklik |
|---|---|
| `src/pages/CalendarPage.jsx` | `hoveredTipId` state · `handleSiraDegis` (normalize all + swap 2, `db.batch` atomik) · oda tipi başlık `onMouseEnter/Leave` · ↑↓ buton render (oda adı yanında, sol) |
| `src/pages/RoomsPage.jsx` | Orijinal halinde (ilk yaklaşım revert edildi) |
| `src/main.jsx` | `window.migrateOdaTipiSiraNo` DEV scripti eklendi |

**Oturum 4 / Madde 5 — Rapor Mantığı**

Kod değişikliği yok. `ReportsPage` zaten `tahsilatlar` + `giderler` koleksiyonlarından çalışıyor; manuel hareketler ve transferler rapora yansımıyor. Sadece doğrulama yapıldı.

---

## 🧪 Test Durumu

**Deploy edilmedi — test bekliyor.**

Deploy öncesi önerilen kontrol listesi:

| Test | Beklenen |
|---|---|
| Giriş/çıkış yapıldığında `aktiviteLog`'a kayıt düşer mi? | `auth.giris` + `auth.cikis` dokümanları oluşmalı |
| `users/{uid}.sonGiris` güncelleniyor mu? | Giriş sonrası UsersPage'de "Son Giriş" kolonunda zaman görünmeli |
| `users/{uid}.sonAksiyon` güncelleniyor mu? | Mali işlem sonrası "Son Aksiyon" kolonunda metin görünmeli |
| Tahsilat oluşturma/düzenleme/silme log yazıyor mu? | C1, C2, C3a/b/c — 3 ayrı yerde |
| Gider oluşturma/düzenleme/silme log yazıyor mu? | C4, C5, C6a/b |
| Transfer log yazıyor mu? (TL + döviz) | C7 her iki branch |
| Manuel hesap girişi/çıkışı log yazıyor mu? | C8, C9 |
| AktiviteSettings sekmesi `aktivite-goruntule` yetkisi yoksa görünmüyor mu? | Sekme gizli olmalı |
| 50+ log varken "Daha fazla yükle" çalışıyor mu? | `startAfter` cursor ilerlemeli |
| Filtreler çalışıyor mu? (kullanıcı, aksiyon, tarih, metin) | Client-side `useMemo` filtre |

---

## 🎨 UI Tasarım Kararları

**`AktiviteSettings.jsx` için dört karar:**

1. **`getDocs` vs `onSnapshot`:** Log koleksiyonu sadece okunur liste; real-time güncellik gerekmiyor. `getDocs` ile pagination daha temiz, listener cleanup yok.
2. **50-doc batch + `hasMore`:** `snap.docs.length === 50` ile cursor tükenmesi tespit edilir — Firestore `count()` sorgusu gerektirmez.
3. **`useMemo` + 6 bağımlılık:** Her filtre state değişiminde tüm `loaded` array'i yeniden taranmasın; `useMemo` gereksiz hesaplamayı cache'ler.
4. **`max-w-[200px] truncate + title tooltip`:** `sonAksiyon` metni uzun olabilir; `truncate` ile satır taşmaz, `title` hover'da tam metni gösterir.

---

## ⚠️ Bilinen Sınırlamalar

| Konu | Durum | Hedef |
|---|---|---|
| **⏳ Aktivite Log kodu deploy edilmedi** | Faz 2C + Faz 3 değişiklikleri GitHub/Netlify'da yok | Mert deploy onayı sonrası `git push` |
| **🔴 Kullanıcı silme bug** (v1.1'de keşfedildi) | Firestore'dan silinen user'ın Auth kaydı kalır → aynı email ile yeni user yaratılamaz. **Geçici workaround:** Firebase Console → Authentication → Users'tan manuel sil. | v1.3 — Cloud Functions `deleteUser` callable |
| **Frankfurter API CORS** | Production'da kur servisi çalışmıyor | v1.3 — Cloud Functions proxy veya alternatif servis |
| **Yeni user yaratımında oturum-değişimi** | ✅ **Çözüldü** (v1.2 Oturum 3): Secondary Firebase App pattern ile admin oturumu bozulmaz | — |
| **Modül bazlı incelikli yetki** | Sadece client-side gizleme; server-side tüm aktif user r/w | Cloud Functions + role-based rules |
| **Update kuralı `modulYetkileri` serbest** | Kullanıcı teorik olarak kendi yetkilerini değiştirebilir | Server-side incelikli yetkiye geçildiğinde sabitlenecek |
| **Mobile drag-to-move yok** | HTML5 drag-and-drop API mobile'da kısıtlı | Touch event handlers |
| **Yedekleme import yok** | Sadece export var (`aktiviteLog` hariç — yedeklenmez) | Import wizard + validation |
| **Bundle code splitting yok** | 1.55MB initial yükleme | Dynamic import + manualChunks |
| **Combobox klavye navigasyonu yok** | Sadece mouse | Ok tuşu + Enter |
| **Multi-property yok** | Tek otel varsayımı | `oteliId` FK + tenant-aware rules |
| **İstatistik yıl ok'ları yok** | Ocak..Aralık aktif yılda sabit | Yıl seçici (geçmiş için Reports > Yıllık Ciro var) |
| **TahsilatModal rez seçimi combobox değil** | Basit `<select>` | Ana misafir combobox pattern'ı kopyalanabilir |
| **Firebase Storage** | ✅ **Çözüldü** (v1.2 Oturum 3): Production aktif, `hoteluter.firebasestorage.app`, 5MB/25MB limitler, Storage Rules deploy | — |
| **Chrome data:URL kısıtı** | ✅ **Çözüldü** (v1.2 Oturum 3): HTTPS URL döndüğü için external-link yeni sekmede açılıyor | — |
| **DEV migration scriptleri main.jsx'te** | `window.cleanupGorseller` + `window.migrateHesapRenkleri` + `window.migrateOdaTipiSiraNo` (3 script) DEV bloğunda kalıyor | Production deploy ÖNCESİ `main.jsx`'ten kaldırılacak |
| **HesapFormModal renk butonları doygun** | Modal'da doygun renk görünür, kart render'da `hexToRgba(0.5)` pastel olur — tutarsızlık bilinçli tercih | v1.3+ değerlendirilebilir |

---

## 🗺️ Roadmap

- **v1.3:** **Cloud Functions admin SDK kurulumu** — `deleteUser` callable + `createUser` oturum koruma + Frankfurter API proxy. v1.1'den taşınan iki bug + CORS sorunu tek kurulumda çözülür.
- **v1.4+:** Aktivite Log detay navigasyonu (`hedefId` ile ilgili kayda atlama), log export, mobile drag-to-move, code splitting, combobox klavye navigasyonu.
- **v2.0+:** Booking.com / Airbnb channel manager, server-side incelikli yetki.

---

## 📂 Yeni Claude Session Okuma Sırası

1. **`CLAUDE.md`** — proje kurucu doküman, mimari kuralları, mevcut sürüm
2. **`docs/CLAUDE_HOTELUTER_v1.2.md`** — BU DOSYA, son sürüm fotoğrafı
3. **`docs/CLAUDE_HOTELUTER_v1.1.md`** — önceki sürüm (sahada ilk hafta düzeltmeleri + grup rezervasyon + yıllık ciro)
4. **`docs/CLAUDE_HOTELUTER_v1.0.md`** — production altyapısı (Auth/Rules/Netlify, dosya yapısı)
5. **`docs/HOTELUTER_GECIS_PLANI.md`** — kapanmış geçiş planı (mimari kuralları için referans)

---

**Bu dosya, yeni Claude session başlarken İLK okuyacağın 2. dokümandır** (1.'si CLAUDE.md). Bir sonraki sürüm çıkınca (v1.3 veya v1.2.1) yeni `docs/CLAUDE_HOTELUTER_vN.N.md` doğsun, bu dosya "önceki sürüm" olarak kalsın.
