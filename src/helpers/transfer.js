/**
 * helpers/transfer.js
 *
 * Hesaplar arası transfer.
 *
 * İki tip:
 *   1. yapTransfer — aynı PB'deki iki hesap arasında (örn. EUR Banka → EUR Kasa)
 *   2. yapDovizTransfer — farklı PB'deki iki hesap arasında (kullanıcı kuru belirler)
 *
 * KURAL: Çıkan ve giren hareket bir transferId ile bağlanır. Geri alma kolaylığı için.
 *
 * Manuel hareket (sadece tek hesapta + veya -) için addManuelHareket var.
 */

import { db } from '../lib/db.js';
import { randomId } from '../lib/helpers.js';
import { cevirKur } from '../lib/kur.js';

/**
 * Aynı para birimindeki iki hesap arasında transfer.
 * Çıkış (-) ve giriş (+) iki hareket oluşur, transferId ile bağlanır.
 *
 * komisyon > 0 ve bankaMasraflariKategoriId varsa POS çözme modu:
 *   - POS hesabından brüt (tutar) çıkar
 *   - Banka hesabına net (tutar - komisyon) girer
 *   - Komisyon için gider dokümanı + gider hareketi aynı batch'e eklenir (atomik)
 */
export const yapTransfer = async (
  { kaynakHesapId, hedefHesapId, tutar, tarih, aciklama, komisyon = 0, bankaMasraflariKategoriId = null },
  kullaniciId,
  ana = 'EUR'
) => {
  if (kaynakHesapId === hedefHesapId) throw new Error('Kaynak ve hedef hesap aynı olamaz');
  const kaynak = await db.get('hesaplar', kaynakHesapId);
  const hedef = await db.get('hesaplar', hedefHesapId);
  if (!kaynak || !hedef) throw new Error('Hesap bulunamadı');
  if ((kaynak.paraBirimi || 'EUR') !== (hedef.paraBirimi || 'EUR')) {
    throw new Error('Farklı para birimi — yapDovizTransfer kullanın');
  }

  const t = Math.abs(Number(tutar) || 0);
  if (t <= 0) throw new Error('Tutar 0\'dan büyük olmalı');

  const k = Math.max(0, Math.abs(Number(komisyon) || 0));
  if (k > t) throw new Error('Komisyon transfer tutarından büyük olamaz');

  const transferId = randomId('tr_');
  const pb = kaynak.paraBirimi || 'EUR';

  const batch = db.batch();
  batch.add('hesapHareketleri', {
    hesapId: kaynakHesapId,
    tarih,
    tutar: -t,
    paraBirimi: pb,
    tip: 'transfer-cikis',
    aciklama: `Transfer → ${hedef.ad}${aciklama ? ' · ' + aciklama : ''}`,
    rezervasyonId: null,
    tahsilatId: null,
    transferId,
    giderId: null,
    olusturmaTarihi: new Date().toISOString(),
    olusturanId: kullaniciId
  });
  batch.add('hesapHareketleri', {
    hesapId: hedefHesapId,
    tarih,
    tutar: t - k,
    paraBirimi: pb,
    tip: 'transfer-giris',
    aciklama: `Transfer ← ${kaynak.ad}${aciklama ? ' · ' + aciklama : ''}`,
    rezervasyonId: null,
    tahsilatId: null,
    transferId,
    giderId: null,
    olusturmaTarihi: new Date().toISOString(),
    olusturanId: kullaniciId
  });

  if (k > 0 && bankaMasraflariKategoriId) {
    let tutarAna = k;
    let kur = 1;
    if (pb !== ana) {
      const cev = cevirKur(k, pb, ana);
      if (cev !== null && cev > 0) { tutarAna = cev; kur = tutarAna / k; }
    }
    const giderId = batch.add('giderler', {
      kategoriId: bankaMasraflariKategoriId,
      hesapId: kaynakHesapId,
      paraBirimi: pb,
      kur,
      tutar: k,
      tutarAna,
      tarih,
      aciklama: `POS komisyonu · ${kaynak.ad}`,
      gorseller: [],
      olusturmaTarihi: new Date().toISOString(),
      olusturanId: kullaniciId
    });
    batch.add('hesapHareketleri', {
      hesapId: kaynakHesapId,
      tarih,
      tutar: -k,
      paraBirimi: pb,
      tip: 'gider',
      aciklama: `Gider · Banka Masrafları · POS komisyonu`,
      rezervasyonId: null,
      tahsilatId: null,
      transferId: null,
      giderId,
      olusturmaTarihi: new Date().toISOString(),
      olusturanId: kullaniciId
    });
  }

  await batch.commit();
  return { transferId };
};

/**
 * Farklı para birimindeki iki hesap arasında transfer.
 * Kullanıcı kuru kendi belirler (manuel kur).
 *
 * Örnek: 100 USD Kasa → EUR Banka @ kur 0.92
 *   → USD Kasa -100 USD
 *   → EUR Banka +92 EUR
 */
export const yapDovizTransfer = async ({
  kaynakHesapId, hedefHesapId,
  cikanTutar, girenTutar,  // kullanıcı her ikisini de girer (kur'u zımni belirler)
  tarih, aciklama
}, kullaniciId) => {
  if (kaynakHesapId === hedefHesapId) throw new Error('Kaynak ve hedef hesap aynı olamaz');
  const kaynak = await db.get('hesaplar', kaynakHesapId);
  const hedef = await db.get('hesaplar', hedefHesapId);
  if (!kaynak || !hedef) throw new Error('Hesap bulunamadı');

  const kaynakPB = kaynak.paraBirimi || 'EUR';
  const hedefPB = hedef.paraBirimi || 'EUR';
  if (kaynakPB === hedefPB) {
    throw new Error('Aynı para birimi — yapTransfer kullanın');
  }

  const cikan = Math.abs(Number(cikanTutar) || 0);
  const giren = Math.abs(Number(girenTutar) || 0);
  if (cikan <= 0 || giren <= 0) throw new Error('Tutarlar 0\'dan büyük olmalı');

  const transferId = randomId('dt_');
  const kur = giren / cikan;

  const batch = db.batch();
  batch.add('hesapHareketleri', {
    hesapId: kaynakHesapId,
    tarih,
    tutar: -cikan,
    paraBirimi: kaynakPB,
    tip: 'doviz-transfer-cikis',
    aciklama: `Döviz Transfer → ${hedef.ad} (${cikan} ${kaynakPB} → ${giren} ${hedefPB} @ ${kur.toFixed(4)})${aciklama ? ' · ' + aciklama : ''}`,
    rezervasyonId: null,
    tahsilatId: null,
    transferId,
    giderId: null,
    olusturmaTarihi: new Date().toISOString(),
    olusturanId: kullaniciId
  });
  batch.add('hesapHareketleri', {
    hesapId: hedefHesapId,
    tarih,
    tutar: giren,
    paraBirimi: hedefPB,
    tip: 'doviz-transfer-giris',
    aciklama: `Döviz Transfer ← ${kaynak.ad} (${cikan} ${kaynakPB} → ${giren} ${hedefPB} @ ${kur.toFixed(4)})${aciklama ? ' · ' + aciklama : ''}`,
    rezervasyonId: null,
    tahsilatId: null,
    transferId,
    giderId: null,
    olusturmaTarihi: new Date().toISOString(),
    olusturanId: kullaniciId
  });
  await batch.commit();
  return { transferId, kur };
};

/**
 * Manuel tek hareket — hesaba serbest giriş veya çıkış (düzeltme amaçlı).
 */
export const addManuelHareket = async ({ hesapId, tutar, tarih, tip, aciklama }, kullaniciId) => {
  const hesap = await db.get('hesaplar', hesapId);
  if (!hesap) throw new Error('Hesap bulunamadı');
  const t = Number(tutar) || 0;
  if (t === 0) throw new Error('Tutar 0 olamaz');

  return await db.add('hesapHareketleri', {
    hesapId,
    tarih,
    tutar: tip === 'manuel-cikis' ? -Math.abs(t) : Math.abs(t),
    paraBirimi: hesap.paraBirimi || 'EUR',
    tip,
    aciklama: aciklama || (tip === 'manuel-giris' ? 'Manuel Giriş' : 'Manuel Çıkış'),
    rezervasyonId: null,
    tahsilatId: null,
    transferId: null,
    giderId: null,
    olusturmaTarihi: new Date().toISOString(),
    olusturanId: kullaniciId
  });
};
