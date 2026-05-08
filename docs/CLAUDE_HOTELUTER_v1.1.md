# Hoteluter v1.1 — Tarih Bug Fix + UI Sadeleştirme + Yıllık Ciro 3 Sütun + Grup Rezervasyon

> **Sürüm:** v1.1
> **Tarih:** 08.05.2026
> **Önceki:** v1.0 (production release, 06.05.2026)
> **Sonraki:** v1.2 (Cloud Functions admin SDK — deleteUser + createUser oturum koruma)
> **Production:** https://hoteluter.com

Bu doküman, sahada kullanım dönemine ilk girişten 2 gün sonra çıkan v1.1 release'i kayıt altına alır. Üç gün önce canlıya çıkan sistemde Mert hızlıca **5 hızlı kazanım** raporladı (kritik tarih bug'ı, sidebar'da işlevsiz menü, istatistik dropdown'unun kötü ay sırası, hesap silmenin tutarsız yetkilendirilmesi, yedek dosya adı UTC zinciri); ardından aynı oturumda **2 büyük feature** eklendi: **Madde 6** yıllık ciro raporu 3 sütun (Toplam Ciro + segment-aware helper + hover tooltip) ve **Madde 4** grup rezervasyon (yeni `gruplar` koleksiyonu, 2 adımlı modal, hibrit bakiye sistemi, takvimde grup şeridi). Hepsi 08.05.2026 günü tek oturumda tamamlandı, 15/15 test geçti.

---

## 🎯 Bu Sürümde Yapılanlar

### Madde 5 — Tarih 1-Gün-Geri Bug (Kritik)

**Belirti:** 8 Mayıs sabahı Mert sistemi açtığında takvim "today" highlight'ı 7 Mayıs üstünde, ana ekran "Bugünün girişleri" listesinde dünün girişleri görünüyordu. Tüm "bugün" karşılaştırmaları 1 gün geri kayıyordu.

**Root cause:** `src/lib/helpers.js:11-15` `todayISO()`:

```js
const d = new Date();
d.setHours(0, 0, 0, 0);            // lokal gece yarısı
return d.toISOString().slice(0, 10); // UTC string!
```

`setHours(0,0,0,0)` lokal saatte gece yarısına çekiyordu (örn. 8 Mayıs 00:00 TRT = 7 Mayıs 21:00 UTC). Sonrasında `toISOString().slice(0,10)` UTC string verince TRT'de (UTC+3) günün her saatinde 1 gün geri sonuç dönüyordu.

**Yayılım:** Aynı UTC-zinciri pattern'ı dört sayfada daha kopyalanmıştı; teşhis turu hepsini ortaya çıkardı:

| Dosya | Satır | Etki |
|---|---|---|
| `pages/AccountingPage.jsx` | 60-61 | Bu Ay tahsilat ay başı (KPI yanlış sınır) |
| `pages/DashboardPage.jsx` | 40-41 | Bu Ay Tahsilat KPI |
| `pages/DashboardPage.jsx` | 49-50 | İstatistik ay sınırları (ilkIso/sonIso) |
| `pages/ReportsPage.jsx` | 70-72 | Yıllık ciro ay aralıkları |
| `pages/SettingsPage.jsx` | 444 | Yedek dosya adı (ekstra bulgu, gece 00:00–03:00 arası 1 gün geri) |

**Çözüm:** `helpers.js`'e `localISODate(d)` helper'ı eklendi — lokal `getFullYear/getMonth/getDate` ile YYYY-MM-DD üretir, UTC zinciri yok. `todayISO()` tek satırla onun üzerine kuruldu (eski `setHours + toISOString` zinciri tamamen silindi). Yan etki yerlerinin hepsi de aynı helper'a bağlandı.

```js
export const localISODate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const todayISO = () => localISODate(new Date());
```

**Tek-noktalı yayılım.** Çakışma kontrolü, doluluk hesabı, KPI'lar, raporlar — `todayISO()` ve etrafındaki ay-başı hesaplarına bağımlı tüm hesaplar otomatik düzeldi.

> ⚠ `addDays`, `diffDays`, `fmtDateTR`, `fmtDateShort`, `isWeekend` zaten doğruydu — `addDays` `new Date(iso)` ile UTC-midnight parse + `setDate` lokal + `toISOString` zinciri stable çalışıyordu, dokunulmadı. `olusturmaTarihi: new Date().toISOString()` (rezervasyon/tahsilat/gider/transfer modüllerinde) full ISO timestamp olarak kasıtla UTC saklanıyor — dokunulmadı.

### Madde 2 — Sol Menüden "Giderler" Kaldırıldı

**Belirti:** Sidebar'daki "Giderler" item'ına tıklayınca ekranda Ön Muhasebe kalmaya devam ediyordu — çünkü `App.jsx:42` PAGE_MAP'inde `giderler: AccountingPage` eşlemesi vardı, yani aynı sayfa render ediliyordu, sadece header etiketi değişiyordu.

**Çözüm:** `permissions.js`'in `ALL_MODULES` array'inden `giderler` modül objesi (key/ad/icon/actions) **tamamen silindi**. `App.jsx` PAGE_MAP'ten ilgili satır silindi. Sidebar (`ALL_MODULES`'tan otomatik render eden) ve `KullaniciFormModal` checkbox listesi (yine `ALL_MODULES`'tan otomatik render eden) **kendiliğinden** temizlendi — bu component'lere dokunulmadı.

**Bilinçli takas:** Mevcut kullanıcıların Firestore `users/{uid}.modulYetkileri.giderler` array'i veritabanında ölü veri olarak kalır. Hiçbir yerde okunmaz, zararsız. Migration yazılmadı — gereksiz kompleksite.

Giderler hâlâ Ön Muhasebe içinde **tab** olarak mevcut, gider CRUD'u olduğu gibi çalışıyor.

### Madde 3 — İstatistik Ay Listesi Yıl Bazlı

**Belirti:** Ana ekrandaki "İstatistikler" dropdown'u son 12 ayı geriye doğru listeliyordu (Mayıs 2026 → Haziran 2025). Hotelci için **gelecek aylar** (rezervasyon planlaması, yer durumu) geçmiş aylardan daha kritik.

**Çözüm:** `DashboardPage.jsx:87-97` `monthOptions` for-loop'u değiştirildi — sabit `yyyy = new Date().getFullYear()` üzerinde 0..11 ay (Ocak..Aralık) üretiliyor.

```js
const monthOptions = useMemo(() => {
  const opts = [];
  const yyyy = new Date().getFullYear();
  for (let m = 0; m < 12; m++) {
    const d = new Date(yyyy, m, 1);
    const v = `${yyyy}-${String(m + 1).padStart(2, '0')}`;
    const l = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    opts.push({ v, l });
  }
  return opts;
}, []);
```

Default seçim mantığı korundu (`useState(() => YYYY-MM)`) — hâlâ "şu anki ay" otomatik seçilir, yani Mayıs 2026.

> Yıl değişimi (Aralık 2026 → Ocak 2027) için ayrı bir UI kontrolü (yıl ok'ları) eklenmedi — bu sürümde scope dışı. Pratikte Ocak 2027'de kullanıcı yeni yıla otomatik geçer (component yeniden mount olduğunda `getFullYear()` 2027 döner). 2026 verisine geriye dönük bakmak için Raporlar > Yıllık Ciro var.

### Madde 1 — Hesap Silme Yetkisi Tutarlılığı

**Belirti:** `AccountingPage.jsx:363` `HesapDetayModal`'a geçilen `canDelete` prop'u hardcoded `user?.rol === 'superadmin'` kontrolü kullanıyordu. Aynı sayfada "Yeni Hesap" (line 119) ve "Düzenle" (line 157) butonları zaten `can('onMuhasebe', 'hesap-yonet')` flag'iyle gated'di. Aynı yetki kümesi için iki farklı kontrol mekanizması — tutarsızlık.

**Çözüm:** `canDelete` prop'u da mevcut `hesap-yonet` flag'ine bağlandı:

```jsx
// Eski:
canDelete={user?.rol === 'superadmin'}
// Yeni:
canDelete={can('onMuhasebe', 'hesap-yonet')}
```

`permissions.js`'e **yeni aksiyon eklenmedi** — mevcut `hesap-yonet` zaten 3 buton için yeterli (Yeni Hesap, Düzenle, Sil). "Hesap Yönet" yetkisi açıldığında üç buton birden açılır, kapatıldığında üçü birden kapanır. Tutarlılık sağlandı.

**Superadmin korunur:** `auth.jsx:131` `can()` fonksiyonu superadmin için her zaman `true` dönüyor, yani superadmin yine her şeyi görür. Davranış değişimi yok.

> Server-side incelikli yetki hâlâ yok (Firestore Rules tüm aktif user r/w). Bilinen takas, v1.x scope dışı. Cloud Functions admin SDK'ya geçildiğinde rol/aktif/modulYetkileri üçü birden sabitlenmeli.

### SettingsPage Extras — Yedek Dosya Adı UTC Zinciri

Madde 5 teşhis turunda Mert'in şikayet etmediği ekstra bir UTC bug daha bulundu: `SettingsPage.jsx:444` yedek dosya adı `new Date().toISOString().slice(0, 10)` ile UTC tarihiyle yazılıyordu. Gece 00:00–03:00 TRT arası 1 gün geri tarihli isim çıkıyordu. Mert "v1.1'e dahil et" dedi — `localISODate(new Date())` ile fix'lendi, import güncellendi.

### Madde 6 — Yıllık Ciro 3 Sütun + Hover Tooltip

Mevcut Yıllık Ciro tab'ı sadece Tahsilat ve Gider gösteriyordu. **Toplam Ciro** sütunu eklendi: rezervasyonların `gece × geceFiyati` toplamı, gece bazında ay'a dağıtılarak (28 May → 3 Haz olan rezervasyonun 4 gecesi May'a, 2 gecesi Haz'a yazılır).

**Yeni dosya:** `src/helpers/ciro.js` — `getCiroByDateRange(rezervasyonlar, fromIso, toIso)` helper'ı **segment-aware**: bölünmüş rezervasyonlarda her segment kendi tarihinde sayılır (orijinal `getOdaSegmentleri` ile). Detay fiyat modunda her gecenin kendi fiyatı kullanılır (NaN/eksikse `geceFiyati` fallback). İptal/no-show/onay-bekliyor durumları ciroya dahil edilmez.

```js
// helpers/ciro.js — özet
export const getCiroByDateRange = (rezervasyonlar, fromIso, toIso, aktifDurumlar = ['onayli', 'giris-yapildi', 'cikis-yapildi']) => {
  let ciro = 0, doluGece = 0;
  rezervasyonlar.forEach((rez) => {
    if (!aktifDurumlar.includes(rez.durum)) return;
    getOdaSegmentleri(rez).forEach((seg) => {
      let d = seg.girisTarihi;
      while (d < seg.cikisTarihi) {
        if (d >= fromIso && d <= toIso) {
          doluGece++;
          // detay modunda idx rez'in orijinal girişinden hesap; aksi halde geceFiyati
          ciro += /* ... */;
        }
        d = addDays(d, 1);
      }
    });
  });
  return { ciro, doluGece };
};
```

**Etki:**
- **ReportsPage Yıllık Ciro:** üst özette 4 metrik (Ciro `var(--brass)` / Tahsilat `var(--success)` / Gider `var(--danger)` / Net), bar grafik **3-bar grup** (`barW = (barGroupW - 12) / 3`, `barGap = 2`), tablo 5 kolon (Ay / Ciro / Tahsilat / Gider / Net), Ciro brass altın renkte.
- **Hover tooltip:** her bar'a `onMouseEnter/onMouseLeave` + cursor pointer; SVG sonunda `<g transform>` ile koyu kutu (rgba(20,20,20,0.92), rect 100x40, 2 satır metin: "ay · metric" + büyük tutar).
- **DashboardPage istatistik panel:** while-loop tabanlı manuel ciro/doluGece hesabı (`monthStats` useMemo, ~22 satır) tek satırlık helper çağrısına refactor edildi: `const { ciro: odaGeliri, doluGece } = getCiroByDateRange(reservations, ilkIso, sonIso, aktifDurumlar);`

**Yan etki (kasıtlı, gizli bir bug'ı çözdü):** Bölünmüş rezervasyonların istatistik/raporlardaki gece dağılımı artık doğru. Eskiden bölünmüş rez'in tüm geceleri ana `girisTarihi`'nin ait olduğu aya yığılıyordu — segment'ler ayrı oda/tarihlere atandığında raporlar hatalı toplam gösteriyordu. Helper segment-aware olduğu için bu otomatik düzeldi. Tek-segment (bölünmemiş) rez'lerde davranış değişimi yok.

### Madde 4 — Grup Rezervasyon (Büyük Feature)

Çoklu oda tek başlık altında rezervasyon yönetimi. Otelci için yaygın senaryo: 3-4 oda birden gelen aile/grup misafirleri.

**Mimari kararlar (Mert onayıyla):**
- Veri modeli: ayrı `gruplar` koleksiyonu + her rezervasyonda **opsiyonel** `grupId` (null/undefined ise standalone, mevcut davranış)
- Her oda **farklı tarih** olabilir (genelde değildir ama esnek olsun)
- Takvimde isim formatı: `"Yılmaz Ailesi — Ali Yılmaz"` (grup + ana misafir)
- Bakiye sistemi: **HİBRİT** — oda-level + grup-level (tahsilat alırken seçim)
- Renk: `PRESET_RENKLER` (8 renk), otomatik atama + kullanıcı değiştirebilir
- Form akışı: TEK "Rezervasyon Ekle" butonu → seçim modalı (Tek/Grup) → ilgili form

**Veri modeli:**
- Yeni Firestore koleksiyonu **`gruplar/{grupId}`**:
  ```
  { ad, iletisimKisi, telefon, email, renk, notlar,
    aktif, olusturmaTarihi, olusturanId }
  ```
- Rezervasyon dokümanlarına opsiyonel **`grupId`** alanı (geriye uyumlu, null olabilir, mevcut rezervasyonları etkilemez)
- Tahsilat dokümanlarına opsiyonel **`grupId`** alanı (havuz tahsilatları için: `rezervasyonId: null` + `grupId: <grup>`)
- Hesap hareketlerine `grupId` propagete edilir (HesapDetayModal etiketleri için)

**Yeni modallar (3 dosya, ~740 satır):**
- **`src/modals/GrupRezervasyonModal.jsx`** (~430 satır): 2 adımlı form. Adım 1 grup bilgileri + renk seçici (PRESET_RENKLER), Adım 2 oda satırları (her satırda oda + farklı tarih + ana misafir combobox + fiyat). `+ Oda Ekle` ile çoğaltılır, X ile silinir (min 1). Save: `db.batch()` ile `gruplar/{newId}` + N adet `rezervasyonlar/{newId}` atomik. Çakışma kontrolü her oda için ayrı (mevcut rez'lerle ve grup içi). `mevcutGrupId` prop'u ile **"Adım 2-only"** mod: var olan gruba oda ekleme akışı (Adım 1 atlanır, yeni grup yaratılmaz).
- **`src/modals/RezervasyonTipiSecimModal.jsx`** (~60 satır): Tek/Grup seçim modali, 2 büyük kart-buton. "Yeni Rezervasyon" butonu + takvim drag-create akışı bu modale yönlenir.
- **`src/modals/GrupDetayModal.jsx`** (~250 satır): grup başlığı + 3'lü özet (Toplam Tutar / Oda Tahsilatları / Grup Havuzu) + odalar tablosu (her odanın kendi misafir/tarih/tutar/ödenen/kalan) + grup havuz tahsilatları + `+ Oda Ekle` (GrupRezervasyonModal `mevcutGrupId` modunda) + `Gruptan Çıkar` (rez korunur, `grupId: null`) + `Grubu Sil` (batch ile rez'lerin grupId'si null + grup doc sil).

**UI entegrasyonu:**
- **CalendarPage:** drag-to-create + "Yeni Rezervasyon" butonu → seçim modal. `creating + prefillData` state'i `tipiSecim/tekRez/grupRez` üçlüsüne genişletildi. Edit akışı (`editingRez`) dokunulmadı — direkt `ReservationFormModal` açılıyor.
- **ReservationListPage:** "Yeni" butonu → seçim modal (aynı pattern).
- **CalendarPage bar render:** `getResStyle(res, seg)` artık `grup?.renk || tip?.renk || 'var(--brass)'` (grup öncelikli). Bar üst kenarına 5px renkli şerit (`grup` varsa, `position: 'absolute'`, `borderTopRadius`). İsim formatı `grup ? "${grup.ad} — ${misafirAd}" : misafirAd`. Icon: grup varsa `users`, multi-segment ise `link`, yoksa eski mantık. Title (hover) "Grup: ..." prefix'i ile.
- **Bara tıklama:** `res.grupId` varsa `GrupDetayModal` açılır, yoksa eski edit akışı (`setEditingRez(res)`).

**Bakiye sistemi (hibrit):**
- Her oda kendi bakiyesini tutar: `oda.toplamTutar - Σ(rezervasyonId === oda.id olan tahsilatlar)`
- Grup havuzu ayrı: `Σ(grupId === grup.id olan tahsilatlar)`
- Toplam grup bakiyesi = `Σ(odalar.toplamTutar) - Σ(oda tahsilatları) - Σ(grup havuz tahsilatları)`
- **TahsilatModal:** gruplu rez (`seciliRez?.grupId`) seçildiğinde radio belirir: "Bu oda için" / "Grup geneli için". Grup seçimi → payload `{ rezervasyonId: null, grupId: seciliRez.grupId }` (havuza yazım). Edit modunda `target.grupId` varsa otomatik 'grup' radio seçili açılır.

**Renk paleti:**
- `src/lib/constants.js`'e **`PRESET_RENKLER`** eklendi (8 renk), export edildi: `['#4a6b85', '#a87842', '#4a7c59', '#8e5572', '#5e6b8e', '#c87f3e', '#a64545', '#6b6b6b']`
- `OdaTipFormModal` local sabitini constants'tan import'a çevirdi (single source of truth)
- Grup oluştururken default renk: `gruplarMevcut.length % PRESET_RENKLER.length` (rotation), kullanıcı tıklayarak değiştirebilir

**Destekleyici değişiklikler:**
- **`src/helpers/tahsilat.js`:** `addTahsilatWithHareket` + `updateTahsilatWithHareket` `grupId`'yi tahsilat doc'una **ve** `hesapHareketleri` doc'una propagete ediyor. Açıklama otomatik formatlanıyor: grupId varsa `"Tahsilat · [Yılmaz Ailesi] (grup)"`, rezervasyonId varsa `"Tahsilat · HTL-202605-001"`, ikisi de yoksa default. **HesapDetayModal ve AccountingPage hareket tablosunda ek UI değişikliği gerekmedi** — `aciklama` field'ı zaten render ediliyor, otomatik çalışır.
- **`src/pages/SettingsPage.jsx`:** yedekleme export `collections` array'ine `'gruplar'` eklendi (rezervasyonlar'dan hemen sonra). Backup JSON'unda `data.gruplar` artık yer alacak.
- **`firestore.rules`:** `match /gruplar/{docId} { allow read, write: if isActiveUser(); }` eklendi (operasyonel koleksiyonlar arasında, `rezervasyonlar`'ın hemen altı). **Mert tarafından `firebase deploy --only firestore:rules` ile production'a deploy edildi**, lokal test öncesinde.

---

## 📋 Diff Özeti

**4 yeni dosya + 13 değişen dosya** (Madde 5/2/3/1/extras + Madde 6 + Madde 4 birleşik), ~1500 yeni satır + ~250 düzenlenen satır.

### Yeni dosyalar

| Dosya | Satır | Görev |
|---|---|---|
| `src/helpers/ciro.js` | ~55 | Madde 6 — segment-aware ciro helper |
| `src/modals/GrupRezervasyonModal.jsx` | ~430 | Madde 4 — 2 adımlı grup oluşturma + oda ekleme modu |
| `src/modals/RezervasyonTipiSecimModal.jsx` | ~60 | Madde 4 — Tek/Grup seçim modali |
| `src/modals/GrupDetayModal.jsx` | ~250 | Madde 4 — grup detay/yönetim |

### Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/lib/helpers.js` | `localISODate(d)` helper eklendi; `todayISO()` tek satıra yeniden yazıldı (Madde 5) |
| `src/lib/permissions.js` | `giderler` modül objesi `ALL_MODULES`'tan silindi (Madde 2) |
| `src/lib/constants.js` | `PRESET_RENKLER` export (Madde 4) |
| `src/App.jsx` | PAGE_MAP'ten `giderler: AccountingPage` silindi (Madde 2) |
| `src/pages/AccountingPage.jsx` | `localISODate` import + ayBasIso/yilBas refactor; `canDelete` prop `can('onMuhasebe','hesap-yonet')` (Madde 5+1) |
| `src/pages/DashboardPage.jsx` | `localISODate` import + ay sınırları refactor; `monthOptions` yıl bazlı; `monthStats` while-loop'u `getCiroByDateRange` helper'ına refactor (Madde 5+3+6) |
| `src/pages/ReportsPage.jsx` | `localISODate` import + `aySon` refactor; **Madde 6 ana hedefi**: `yillikStats`'a Ciro hesabı, üst özet 4 metrik, SVG 3-bar grup, hover tooltip, tablo 5 kolon |
| `src/pages/SettingsPage.jsx` | `localISODate` import + yedek dosya adı; yedekleme `collections` array'ine `'gruplar'` (Madde 5 extras + Madde 4) |
| `src/pages/CalendarPage.jsx` | Seçim modal akışı, `gruplar` hook, bar render (renk öncelik + üst şerit + isim formatı + icon), bara tıklama → `GrupDetayModal` yönlendirmesi (Madde 4) |
| `src/pages/ReservationListPage.jsx` | Seçim modal akışı, `gruplar` hook (Madde 4) |
| `src/modals/OdaTipFormModal.jsx` | `PRESET_RENKLER` constants'tan import (Madde 4) |
| `src/modals/TahsilatModal.jsx` | `tahsilatTipi` radio (oda/grup), `grupId` payload (Madde 4) |
| `src/helpers/tahsilat.js` | `grupId` propagation (tahsilat + hareket); açıklama formatı `[Grup Adı] (grup)` (Madde 4) |
| `firestore.rules` | `match /gruplar/{docId}` aktif user r/w (Madde 4) |

---

## 🧪 Test Sonuçları

**15/15 ✅** — 08.05.2026 günü Mert tarafından lokalde tarandı; ardından production'a deploy.

| Test grubu | Madde | Sonuç |
|---|---|---|
| Tarih bug + yedek dosya adı | Madde 5 + extras | ✅ Bugünün girişleri/çıkışları doğru, takvim "today" highlight'ı doğru günde, "Bugün" butonu doğru scroll, istatistik panel sayıları doğru, raporlar yıllık grafiği doğru, yedek dosya adında bugünün lokal tarihi, console temiz |
| Giderler menü | Madde 2 | ✅ Sidebar'dan "Giderler" kayboldu, Ön Muhasebe Giderler tab'ı çalışıyor, gider CRUD çalışıyor, /giderler URL'si fallback'liyor |
| İstatistik ay | Madde 3 | ✅ Liste Ocak..Aralık 2026, default Mayıs 2026, ay seçimi panel sayılarını güncelliyor |
| Hesap yetkisi | Madde 1 | ✅ "Hesap Yönet" kapalı user'da Yeni Hesap/Düzenle/Sil üçü birden gizli, açık user'da üçü birden görünür, superadmin davranışı korundu |
| Yıllık ciro 3 sütun + tooltip | Madde 6 | ✅ Üst özette 4 metrik (Ciro brass), bar grafikte her ay 3 yan yana bar, tablo 5 kolon, mouse hover'da tooltip görünür (ay · metric · tutar), bölünmüş rez doğru aya dağılır |
| Grup rezervasyon | Madde 4 | ✅ Tek/Grup seçim modali, grup oluşturma 2 adımlı, çakışma kontrolü, takvimde renkli şerit + "Grup — Misafir" formatı, grup detay modal'ında oda ekle/çıkar, hibrit bakiye (oda/grup havuzu) doğru, hesap detayında "[Grup Adı] (grup)" etiketi |

Hiçbir test başarısız olmadı, ekstra bulgu çıkmadı.

---

## 🛠️ Migration / Backward Compatibility

- **Yeni koleksiyon: `gruplar`** (Madde 4). `firestore.rules`'a aktif user r/w kuralı eklendi, Mert tarafından `firebase deploy --only firestore:rules` ile production'a deploy edildi (lokal test öncesi).
- **Rezervasyon ve tahsilat dokümanlarına opsiyonel `grupId` alanı.** Mevcut dokümanları etkilemez (null/undefined). Geriye uyumlu.
- **Hesap hareketlerine opsiyonel `grupId` alanı.** Mevcut hareketler etkilenmez; yeni grup tahsilatları yazılırken propagete edilir.
- **`users.modulYetkileri.giderler`** mevcut user'larda kalır (ölü veri, Madde 2 sonrası okunmuyor).
- **API/SDK upgrade yok**, paket versiyonları aynı.
- **Build/deploy pipeline değişmedi** — Netlify continuous deploy `main` push ile otomatik.
- **Migration kodu eklenmedi** — `runMigrations()` aynı kaldı (5 kanal + 8 kategori + 3 hesap, idempotent flag pattern). `gruplar` boş başlar, kullanıcı oluşturdukça doldurulur.

---

## ⚠️ Bilinen Sınırlamalar

| Konu | Durum | Hedef |
|---|---|---|
| **🔴 Kullanıcı silme bug** (v1.1'de keşfedildi) | Kullanıcı Firestore'dan silinince Firebase Auth kaydı kalır → aynı email ile yeni user yaratılamaz (`auth/email-already-in-use`). Cloud Functions admin SDK gerekir; v1.2'ye taşındı (yeni user oturum-değişimi bug'ı ile aynı kurulumda çözülecek). **Geçici workaround:** Firebase Console → Authentication → Users'tan manuel sil veya farklı email kullan. | v1.2 — Cloud Functions `deleteUser` callable |
| **Frankfurter API CORS** | Production'da çalışmıyor (kur servisi) | v1.2'de alternatif servis (`exchangerate.host` veya TCMB EVDS proxy via Cloud Function) |
| **Yeni user yaratımında oturum-değişimi** | Firebase client SDK davranışı; uyarı banner ile bildiriliyor | v1.2 — Cloud Functions `createUser` callable (kullanıcı silme ile aynı kurulumda) |
| **Modül bazlı incelikli yetki** | Sadece client-side gizleme; server-side tüm aktif user r/w | Cloud Functions + role-based rules |
| **Update kuralı `modulYetkileri` serbest** | Kullanıcı teorik olarak kendi yetkilerini değiştirebilir | Server-side incelikli yetkiye geçildiğinde sabitlenecek |
| **Mobile drag-to-move yok** | HTML5 drag-and-drop API mobile'da kısıtlı | Touch event handlers |
| **Yedekleme import yok** | Sadece export var (JSON, artık dosya adı doğru ve `gruplar` dahil) | Import wizard + validation |
| **Bundle code splitting yok** | 1.55MB initial yükleme | Dynamic import + manualChunks |
| **Combobox klavye navigasyonu yok** | Sadece mouse | Ok tuşu + Enter |
| **Multi-property yok** | Tek otel varsayımı (`otel/main` singleton) | `oteliId` foreign key + tenant-aware rules |
| **İstatistik yıl ok'ları yok** | Ocak..Aralık aktif yılda sabit | Yıl seçici (geçmiş yıl raporu için Reports > Yıllık Ciro var) |
| **TahsilatModal rez seçimi combobox değil** | Basit `<select>` dropdown — çok rez'li otelde uzun listeyi navigate zor | Ana misafir combobox pattern'ı kopyalanabilir (UX iyileştirmesi) |

---

## 🗺️ Roadmap

- **v1.2:** **Cloud Functions admin SDK kurulumu** — `deleteUser` callable + `createUser` oturum koruma. İki bilinen sınırlamayı (kullanıcı silme bug + yeni user oturum-değişimi) tek seferde çözer. Frankfurter API CORS proxy de aynı Functions kurulumuna entegre edilebilir (`exchangerate.host` çağrısı server-side).
- **v1.3+:** Sahada gelen yeni feature istekleri, multi-property (`oteliId` FK + tenant-aware rules), mobile drag-to-move, code splitting (1.55MB → ~200KB initial), combobox klavye navigasyonu, TahsilatModal rez combobox.
- **v2.0+:** Booking.com / Airbnb channel manager entegrasyonu, server-side incelikli yetki (modül bazlı r/w rules).

---

## 📂 Yeni Claude Session Okuma Sırası

1. **`CLAUDE.md`** — proje kurucu doküman, mimari kuralları, mevcut sürüm
2. **`docs/CLAUDE_HOTELUTER_v1.1.md`** — BU DOSYA, son sürüm fotoğrafı
3. **`docs/CLAUDE_HOTELUTER_v1.0.md`** — önceki sürüm (production release detayı, Auth/Rules altyapısı, dosya yapısı, Bug 1/Bug 2 bağlamı)
4. **`docs/HOTELUTER_GECIS_PLANI.md`** — kapanmış geçiş planı (mimari kuralları için referans)

---

**Bu dosya, yeni Claude session başlarken İLK okuyacağın 2. dokümandır** (1.'si CLAUDE.md). Yeni bir feature veya bug fix sürümü çıkarsa (v1.2, v1.2.1, v1.3, ...) yeni bir `docs/CLAUDE_HOTELUTER_vN.N.md` doğsun ve bu dosya "önceki sürüm" referansı olarak kalsın.
