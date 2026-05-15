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
import { todayISO } from '../lib/helpers.js';
import { deleteGiderGorsel } from '../lib/storage.js';

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
    olusturanId: kullaniciId || null,
    olusturmaTarihi: new Date().toISOString()
  });

  await batch.commit();
  return { id: giderId, ...giderData };
};

/**
 * Gider sil — gider doc'u silinir, ters iptal hareketi eklenir.
 * Orijinal hesap hareketi silinmez (audit trail korunur).
 * Eski hareket tutar: -X olduğundan iptal tutar: +old.tutar (pozitif).
 */
export const deleteGiderWithHareket = async (giderId, kullaniciId) => {
  const old = await db.get('giderler', giderId);
  if (!old) return null;

  // Storage'dan görselleri sil (path olan yeni kayıtlar; base64 eski kayıtlar path yok → skip)
  for (const g of (old.gorseller || [])) {
    await deleteGiderGorsel(g.path);
  }

  const batch = db.batch();
  batch.delete('giderler', giderId);
  batch.add('hesapHareketleri', {
    hesapId: old.hesapId,
    tarih: todayISO(),
    tutar: old.tutar,
    paraBirimi: old.paraBirimi || 'EUR',
    tip: 'iptal',
    aciklama: `Gider iptal: ${old.tutar} ${old.paraBirimi || ''}`.trim(),
    tahsilatId: null,
    transferId: null,
    giderId: null,
    rezervasyonId: null,
    olusturanId: kullaniciId || null,
    olusturmaTarihi: new Date().toISOString(),
  });
  await batch.commit();
};

/**
 * Gider güncelle — audit trail pattern.
 * Bakiyeyi etkileyen değişiklik varsa eski hareket KALIR, düzeltme hareketi eklenir.
 * Bakiyeyi etkilemeyen değişiklik (tarih/kategori/açıklama/kur) sadece doc'u günceller.
 * Gider hareketi negatif (tutar: -X) olduğundan düzeltme yönleri tersine çevrilir.
 */
export const updateGiderWithHareket = async (giderId, partial, ana, kullaniciId) => {
  const old = await db.get('giderler', giderId);
  if (!old) return null;

  const yeniHesapId = partial.hesapId ?? old.hesapId;
  const yeniPB      = partial.paraBirimi ?? old.paraBirimi ?? ana;
  const yeniTutar   = partial.tutar != null ? Math.abs(Number(partial.tutar)) : old.tutar;

  // Bakiyeyi etkileyen alan tespiti
  const hesapDegisti = yeniHesapId !== old.hesapId;
  const pbDegisti    = yeniPB !== (old.paraBirimi ?? ana);
  const tutarDegisti = Math.abs(yeniTutar - old.tutar) > 0.001;
  const bakiyeEtkisi = hesapDegisti || pbDegisti || tutarDegisti;

  // Yeni hesabı doğrula + tutarAna hesapla
  const hesap = await db.get('hesaplar', yeniHesapId);
  if (!hesap) throw new Error('Hesap bulunamadı');
  const hesapPB = hesap.paraBirimi || ana;
  if (yeniPB !== hesapPB) {
    throw new Error(`Bu hesap ${hesapPB} cinsinden, ödeme ${yeniPB} cinsinden yapılamaz.`);
  }

  let kur = 1;
  let tutarAna = yeniTutar;
  if (yeniPB !== ana) {
    const kurCandidate = partial.kur && Number(partial.kur) > 0 ? Number(partial.kur) : null;
    if (kurCandidate) {
      kur = kurCandidate;
      tutarAna = yeniTutar * kur;
    } else {
      const cev = cevirKur(yeniTutar, yeniPB, ana);
      if (cev !== null && cev > 0) { tutarAna = cev; kur = tutarAna / yeniTutar; }
      else throw new Error('Kur bilgisi yok.');
    }
  }

  // Gider doc'unu güncelle (her zaman)
  await db.update('giderler', giderId, {
    ...partial,
    hesapId: yeniHesapId,
    paraBirimi: yeniPB,
    tutar: yeniTutar,
    kur,
    tutarAna,
  });

  if (!bakiyeEtkisi) {
    return { id: giderId, ...old, ...partial, hesapId: yeniHesapId, paraBirimi: yeniPB, tutar: yeniTutar, kur, tutarAna };
  }

  const bugun = todayISO();
  const batch = db.batch();

  if (hesapDegisti || pbDegisti) {
    // Eski hesapta ters düzeltme: orijinal -X'i geri al (+X)
    batch.add('hesapHareketleri', {
      hesapId: old.hesapId,
      tarih: bugun,
      tutar: old.tutar,
      paraBirimi: old.paraBirimi || ana,
      tip: 'duzeltme',
      aciklama: `Gider düzeltme: ${old.tutar} ${old.paraBirimi || ana} geri alındı`,
      tahsilatId: null,
      transferId: null,
      giderId,
      rezervasyonId: null,
      olusturanId: kullaniciId || null,
      olusturmaTarihi: new Date().toISOString(),
    });
    // Yeni hesapta yeni gider çıkışı (-yeniTutar)
    batch.add('hesapHareketleri', {
      hesapId: yeniHesapId,
      tarih: bugun,
      tutar: -yeniTutar,
      paraBirimi: hesapPB,
      tip: 'duzeltme',
      aciklama: `Gider düzeltme: ${yeniTutar} ${yeniPB}`,
      tahsilatId: null,
      transferId: null,
      giderId,
      rezervasyonId: null,
      olusturanId: kullaniciId || null,
      olusturmaTarihi: new Date().toISOString(),
    });
  } else {
    // Sadece tutar değişti — fark hareketi (old.tutar - yeniTutar)
    // Örnek: 100→80 → fark=+20 (hesaba +20 döner), 100→120 → fark=-20 (hesaptan -20 daha çıkar)
    const fark = old.tutar - yeniTutar;
    batch.add('hesapHareketleri', {
      hesapId: old.hesapId,
      tarih: bugun,
      tutar: fark,
      paraBirimi: old.paraBirimi || ana,
      tip: 'duzeltme',
      aciklama: `Gider düzeltme: ${old.tutar} → ${yeniTutar} ${old.paraBirimi || ana}`,
      tahsilatId: null,
      transferId: null,
      giderId,
      rezervasyonId: null,
      olusturanId: kullaniciId || null,
      olusturmaTarihi: new Date().toISOString(),
    });
  }

  await batch.commit();
  return { id: giderId, ...old, ...partial, hesapId: yeniHesapId, paraBirimi: yeniPB, tutar: yeniTutar, kur, tutarAna };
};
