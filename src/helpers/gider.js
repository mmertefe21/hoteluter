/**
 * helpers/gider.js
 *
 * Gider (hesaptan çıkan para) işlemleri.
 *
 * Tahsilat ile simetrik. Aynı kurallar:
 *   - gider.paraBirimi == hesap.paraBirimi olmak ZORUNDA
 *   - tutarAna ana PB karşılığı raporlama için
 *   - Hesap hareketi ATOMİK olarak birlikte oluşturulur (negatif yön)
 */

import { db } from '../lib/db.js';
import { cevirKur } from '../lib/kur.js';

/**
 * Yeni gider ekle + hesap hareketi yarat (negatif).
 */
export const addGiderWithHareket = async (gider, kullaniciId, ana) => {
  const hesap = await db.get('hesaplar', gider.hesapId);
  if (!hesap) throw new Error('Hesap bulunamadı');

  const hesapPB = hesap.paraBirimi || ana;
  const giderPB = gider.paraBirimi || hesapPB;

  if (giderPB !== hesapPB) {
    throw new Error(`Bu hesap ${hesapPB} cinsinden, ödeme ${giderPB} cinsinden yapılamaz.`);
  }

  const tutarOrij = Math.abs(Number(gider.tutar) || 0);
  if (tutarOrij <= 0) throw new Error('Tutar 0\'dan büyük olmalı');

  let kur = 1;
  let tutarAna = tutarOrij;
  if (giderPB !== ana) {
    if (gider.kur && Number(gider.kur) > 0) {
      kur = Number(gider.kur);
      tutarAna = tutarOrij * kur;
    } else {
      const cev = cevirKur(tutarOrij, giderPB, ana);
      if (cev !== null && cev > 0) {
        tutarAna = cev;
        kur = tutarAna / tutarOrij;
      } else {
        throw new Error('Kur bilgisi yok.');
      }
    }
  }

  const giderData = {
    ...gider,
    paraBirimi: giderPB,
    kur,
    tutar: tutarOrij,
    tutarAna,
    olusturmaTarihi: new Date().toISOString(),
    olusturanId: kullaniciId
  };

  const batch = db.batch();
  const giderId = batch.add('giderler', giderData);

  let kategori = null;
  if (gider.kategoriId) kategori = await db.get('giderKategorileri', gider.kategoriId);
  let aciklamaText = `Gider · ${kategori?.ad || 'Kategorisiz'}`;
  if (gider.aciklama) aciklamaText += ` · ${gider.aciklama}`;
  if (giderPB !== ana) aciklamaText += ` (≈ ${tutarAna.toFixed(2)} ${ana} @ ${kur.toFixed(4)})`;

  batch.add('hesapHareketleri', {
    hesapId: gider.hesapId,
    tarih: gider.tarih,
    tutar: -tutarOrij,
    paraBirimi: hesapPB,
    tip: 'gider',
    aciklama: aciklamaText,
    rezervasyonId: null,
    tahsilatId: null,
    transferId: null,
    giderId,
    olusturmaTarihi: new Date().toISOString()
  });

  await batch.commit();
  return { id: giderId, ...giderData };
};

/**
 * Gider sil + bağlı hareketleri sil.
 */
export const deleteGiderWithHareket = async (giderId) => {
  const hareketler = await db.list('hesapHareketleri');
  const ilgili = hareketler.filter(h => h.giderId === giderId);

  const batch = db.batch();
  ilgili.forEach(h => batch.delete('hesapHareketleri', h.id));
  batch.delete('giderler', giderId);
  await batch.commit();
};

/**
 * Gider güncelle — eski hareketleri sil, yenisini yaz.
 */
export const updateGiderWithHareket = async (giderId, partial, ana) => {
  const old = await db.get('giderler', giderId);
  if (!old) return null;

  const merged = { ...old, ...partial };
  const hesap = await db.get('hesaplar', merged.hesapId);
  if (!hesap) throw new Error('Hesap bulunamadı');

  const hesapPB = hesap.paraBirimi || ana;
  const giderPB = merged.paraBirimi || hesapPB;
  if (giderPB !== hesapPB) {
    throw new Error(`Bu hesap ${hesapPB} cinsinden, ödeme ${giderPB} cinsinden yapılamaz.`);
  }

  const tutarOrij = Math.abs(Number(merged.tutar) || 0);
  let kur = 1;
  let tutarAna = tutarOrij;
  if (giderPB !== ana) {
    if (merged.kur && Number(merged.kur) > 0) {
      kur = Number(merged.kur);
      tutarAna = tutarOrij * kur;
    } else {
      const cev = cevirKur(tutarOrij, giderPB, ana);
      if (cev !== null && cev > 0) {
        tutarAna = cev;
        kur = tutarAna / tutarOrij;
      } else {
        throw new Error('Kur bilgisi yok.');
      }
    }
  }

  const final = { ...merged, paraBirimi: giderPB, kur, tutar: tutarOrij, tutarAna };

  const hareketler = await db.list('hesapHareketleri');
  const ilgili = hareketler.filter(h => h.giderId === giderId);

  const batch = db.batch();
  ilgili.forEach(h => batch.delete('hesapHareketleri', h.id));
  batch.update('giderler', giderId, final);

  const kategori = final.kategoriId ? await db.get('giderKategorileri', final.kategoriId) : null;
  let aciklamaText = `Gider · ${kategori?.ad || 'Kategorisiz'}`;
  if (final.aciklama) aciklamaText += ` · ${final.aciklama}`;
  if (giderPB !== ana) aciklamaText += ` (≈ ${tutarAna.toFixed(2)} ${ana} @ ${kur.toFixed(4)})`;

  batch.add('hesapHareketleri', {
    hesapId: final.hesapId,
    tarih: final.tarih,
    tutar: -tutarOrij,
    paraBirimi: hesapPB,
    tip: 'gider',
    aciklama: aciklamaText,
    rezervasyonId: null,
    tahsilatId: null,
    transferId: null,
    giderId,
    olusturmaTarihi: new Date().toISOString()
  });

  await batch.commit();
  return final;
};
