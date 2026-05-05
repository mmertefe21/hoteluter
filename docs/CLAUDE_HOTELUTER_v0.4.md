# CLAUDE_HOTELUTER_v0.4.md

**Tarih:** 05.05.2026
**Versiyon:** v0.4 — Hesap Bazlı Para Birimi + Döviz Transferi
**Durum:** Lokal MVP genişletmesi

---

## 1. Bu Sürümde Yeni Olanlar

### 🏦 Her Hesabın Kendi Para Birimi
- Hesap açarken para birimi seçimi zorunlu (EUR / USD / TRY / GBP)
- Hesap bakiyesi **kendi para biriminde** tutulur (örn. TR Banka → TL bakiye, Euro Kasa → EUR bakiye)
- Tahsilat alırken **sadece tahsilatın para birimine uygun hesaplar** gösterilir → "Dolar ödeme dolar kasasına" kuralı zorla
- Hesap kartlarında para birimi rozeti
- Hesap detayında bakiye kendi para biriminde + ana para birimi karşılığı

### 💱 Döviz Transferi
- Transfer modali artık **2 tab'lı**:
  1. **Aynı Para Birimi** — klasik transfer (kaynak ve hedef hesap aynı PB'de)
  2. **Döviz Transferi** — farklı PB'lerde, kullanıcı kendi kurunu girer
- Para birimi farklı seçilirse otomatik döviz tab'ına geçer
- Canlı kur referans olarak gösterilir, kullanıcı kendi kullandığı kuru girer
- "Canlı Kuru Uygula" butonu (otomatik hesaplama)
- %5'ten fazla sapmada uyarı çıkar

### 📊 Toplam Bakiye Stat'ı Akıllılaştı
- Çoklu para birimindeki bakiyeler **ana para birimine çevrilip toplanıyor**
- Stat etiketi "Toplam Bakiye (EUR)" gibi ana PB'yi gösteriyor
- Eğer kur bilgisi yoksa kart üzerinde uyarı çubuğu çıkıyor

---

## 2. Veri Modeli Değişiklikleri

### `hesaplar` (yeni alan)
```js
{
  // ... eski alanlar
  paraBirimi: 'EUR' | 'USD' | 'TRY' | 'GBP'  // varsayılan: ana para birimi
}
```

### `hesapHareketleri` (alan anlamı değişti)
```js
{
  // ... eski alanlar
  tutar: number,           // ARTIK hesabın kendi para biriminde (EUR hesap → EUR tutar, TL hesap → TL tutar)
  paraBirimi: string       // hesabın PB'si (raporlama için)
}
```

**Önemli:** Eskiden `hesapHareketleri.tutar` her zaman ana para birimindeydi. Şimdi her hareket hesabın kendi PB'sinde. Bu kritik bir değişiklik — bakiye hesaplaması artık tek PB içinde yapılıyor, döviz karışıklığı yok.

### Yeni hareket tipleri
- `doviz-transfer-cikis` — döviz transferinin çıkış ayağı
- `doviz-transfer-giris` — döviz transferinin giriş ayağı

İki hareket aynı `transferId` ile bağlı (eski transfer'le aynı pattern).

---

## 3. Migration v0.4

`migrateHesapParaBirimiV04()` App init'inde çalışır:
- `paraBirimi` alanı olmayan tüm hesaplara **ana para birimi** atanır
- Mevcut hareketler **bozulmaz** çünkü zaten ana para birimindeydi (eski sistem) → aynı sayılıyor
- Flag: `seeded_v04_hesapPB` → bir kere çalışır

**Kritik:** Eski hareketlerin `tutar` değeri ana para birimindeydi. Eski hesaplar artık ana para biriminde sayıldığı için bu hareketler **doğru** kalıyor. Migration sessiz ve veri güvenli.

---

## 4. Tahsilat Akışı (yeni mantık)

### Senaryo 1: Otelin ana para birimi EUR, misafir EUR ödedi
1. Tahsilat formu açılır → Tutar: 100, Para Birimi: EUR
2. Hesap dropdown'da **sadece EUR hesapları** görünür
3. EUR hesap seç → kaydet
4. Hesap bakiyesi 100 EUR artar
5. Rezervasyon ödenen 100 EUR artar (kalan 100 EUR azalır)

### Senaryo 2: Otel EUR, misafir 100 USD verdi
1. Tahsilat formu → Tutar: 100, Para Birimi: USD
2. Hesap dropdown'da **sadece USD hesapları** görünür
3. USD hesap yoksa: kırmızı uyarı kutusu "USD cinsinden hesap yok, önce açın"
4. USD hesap varsa: kur paneli açılır (1 USD = 0.92 EUR)
5. Kaydet → USD hesabı 100 USD artar, rezervasyondan 92 EUR düşer

### Senaryo 3: Döviz Transferi (sahada bozdurma)
1. Transfer modali → Döviz Transferi tab
2. Kaynak: Euro Kasa (EUR), Hedef: TR Banka (TRY)
3. Çıkan tutar: 100 EUR → otomatik 38.50 TRY öner (canlı kur)
4. Kullanıcı kendi kuruyla "3850 TL" yazabilir (banka 38 demiş ama dövizci 38.50 vermiş)
5. Kaydet → Euro Kasa 100 EUR azalır, TR Banka 3850 TRY artar
6. Hesap detayında "Döviz Transferi: ... @ 38.5000" notu görünür

---

## 5. UI Değişiklikleri

### Hesap Form Modali
- Yeni satır: **Para Birimi** seçici (4 büyük kart)
- Mevcut hesabı düzenlerken hareketler varsa para birimi **kilitli** (geri dönüşsüz veri bozulmaması için)
- Kilitli durumda altta uyarı: "Yeni hesap açıp eski hesabı pasif yapabilirsiniz"

### Hesap Kartları
- Ad satırının altında: tip + **brass renkli para birimi rozeti** (€ EUR, ₺ TRY, $ USD, £ GBP)
- Bakiye kendi para biriminde
- Farklı PB ise altında küçük "≈ X EUR" karşılığı

### Hesap Detayı
- Başlıkta isim yanında para birimi badge
- Bakiye kendi PB'sinde + ana PB karşılığı
- Hareketler tablosunda tutarlar hesabın PB'sinde

### Transfer Modali (yeni)
- Pill toggle: "Aynı Para Birimi" ↔ "Döviz Transferi"
- Hesap seçimi sonrası para birimleri aynı/farklı durumuna göre tab otomatik geçer
- Aynı PB → tek tutar input
- Farklı PB → iki tutar input (çıkan/giren) + canlı kur referans + sapma uyarısı

### Tahsilat Formu (rezervasyon içi + ön muhasebe)
- Para birimi değiştiğinde hesap dropdown otomatik yeni para birimindekilere filtrelenir
- Hesap dropdown başlığında "(sadece EUR hesapları)" notu
- Para birimi cinsinden hesap yoksa kırmızı uyarı + Kaydet butonu disable

### Toplam Bakiye Stat
- Etiket: "Toplam Bakiye (EUR)" (ana PB)
- Çoklu PB için kur uyarı çubuğu (gerekirse)

---

## 6. Kritik İş Kuralları

### Tahsilat Para Birimi == Hesap Para Birimi
`addTahsilatWithHareket` fonksiyonu uyumsuzluğu **runtime'da reddeder**:
```js
if (tahsilatPB !== hesapPB) {
  throw new Error(`Bu hesap ${hesapPB} cinsinden, ödeme ${tahsilatPB} cinsinden yapılamaz.`);
}
```

UI bu kuralı dropdown filtresiyle zaten zorluyor ama backend kontrolü güvenlik için duruyor.

### Hesap Hareketi Hesabın Para Biriminde
Bakiye = `sum(hareketler.tutar)`. Tüm hareketler aynı PB'de olduğu için doğrudan toplama yeterli, çevirme yok.

### Döviz Transferi: Çift Tutarlı Bağlı Hareket
İki hareket aynı `transferId` ile bağlı, kullanılan `kur = hedefTutar / kaynakTutar` referans için saklanır.

### Rezervasyon Bakiyesi: Hep Ana Para Biriminde
Rezervasyonun `toplamTutar`, `geceFiyati` her zaman ana PB'de. Tahsilatların `tutarAna` alanı ana PB'ye çevrilmiş hali tutar. Rezervasyon ödenen = `sum(tahsilatlar.tutarAna)`.

---

## 7. v0.5 Yol Haritası
- Manuel hesap hareketi (rezervasyona bağlı olmayan gider/gelir)
- Hesap dönem kapanışı (ay sonu / yıl sonu snapshot)
- Kur kazanç/kayıp raporu (alındığında 1 USD = 0.92 EUR, bugün 0.95 EUR — fark)
- Excel/CSV export (tahsilat, hareket, rezervasyon)
- Çok hesaplı dashboard widget'ı
- Drag-to-resize ve drag-to-move takvimde
- Firebase entegrasyonu

---

## 8. Çalışan Kurallar
- Eski kodu silme — additive override
- localStorage migration: `seeded_v04_hesapPB` flag bir kere çalışır
- Para birimi olan hesabın PB'si **hareket varsa** değiştirilemez (audit trail koruması)
- Aynı PB transferi = `yapTransfer`, farklı PB = `yapDovizTransfer` — iki farklı fonksiyon, iki farklı hareket tipi
- Hesap silinirse hareketler kalır (audit), hesap pasif yapma silmeye tercih edilir
