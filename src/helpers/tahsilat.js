/**
 * helpers/tahsilat.js
 *
 * Tahsilat (misafirden alınan ödeme) işlemleri.
 *
 * KRİTİK KURAL: Tahsilat ile hesap hareketi ATOMİK olarak birlikte oluşturulur.
 * Birinin başarısız olursa diğeri de yazılmaz. writeBatch kullanılır.
 *
 * PARA BİRİMİ KURALI:
 *   - tahsilat.paraBirimi == hesap.paraBirimi olmak ZORUNDA
 *   - USD ödeme alacaksa USD hesabı seçilmeli
 *   - tutarAna alanı raporlamada kullanılır (her zaman ana PB karşılığı)
 *
 * Geçmiş hareket güncelleme/silme:
 *   - update/delete: önce eski hareket kayıtları silinir, sonra yenisi yazılır
 *   - hesapHareketleri.tahsilatId ile bağlı kayıtlar bulunur
 */

import { db } from '../lib/db.js';
import { cevirKur } from '../lib/kur.js';
import { todayISO } from '../lib/helpers.js';

/**
 * Yeni tahsilat ekle + hesap hareketi yarat.
 *
 * @param {Object} tahsilat - { rezervasyonId?, hesapId, paraBirimi, tutar, kur?, tarih, odemeYontemi, aciklama? }
 * @param {string} kullaniciId - olusturanId için
 * @param {string} ana - ana para birimi (otel.anaParaBirimi)
 * @returns {Promise<Object>} - oluşturulan tahsilat (id ile)
 */
export const addTahsilatWithHareket = async (tahsilat, kullaniciId, ana) => {
  const hesap = await db.get('hesaplar', tahsilat.hesapId);
  if (!hesap) throw new Error('Hesap bulunamadı');

  const hesapPB = hesap.paraBirimi || ana;
  const tahsilatPB = tahsilat.paraBirimi || hesapPB;

  if (tahsilatPB !== hesapPB) {
    throw new Error(`Bu hesap ${hesapPB} cinsinden, ödeme ${tahsilatPB} cinsinden alınamaz.`);
  }

  const tutarOrij = Math.abs(Number(tahsilat.tutar) || 0);
  if (tutarOrij <= 0) throw new Error('Tutar 0\'dan büyük olmalı');

  // Ana para birimi karşılığı
  let kur = 1;
  let tutarAna = tutarOrij;
  if (tahsilatPB !== ana) {
    if (tahsilat.kur && Number(tahsilat.kur) > 0) {
      kur = Number(tahsilat.kur);
      tutarAna = tutarOrij * kur;
    } else {
      const cev = cevirKur(tutarOrij, tahsilatPB, ana);
      if (cev !== null && cev > 0) {
        tutarAna = cev;
        kur = tutarAna / tutarOrij;
      } else {
        throw new Error('Kur bilgisi yok. Önce ayarlardan kur güncelleyin.');
      }
    }
  }

  // Atomik: tahsilat + hareket birlikte
  const batch = db.batch();
  const tahsilatData = {
    ...tahsilat,
    paraBirimi: tahsilatPB,
    kur,
    tutar: tutarOrij,
    tutarAna,
    olusturmaTarihi: new Date().toISOString(),
    olusturanId: kullaniciId
  };
  const tahsilatId = batch.add('tahsilatlar', tahsilatData);

  let aciklamaText = tahsilat.aciklama || 'Tahsilat';
  if (tahsilat.grupId) {
    const grup = await db.get('gruplar', tahsilat.grupId);
    if (grup) aciklamaText = `Tahsilat · [${grup.ad}] (grup)`;
  } else if (tahsilat.rezervasyonId) {
    const rez = await db.get('rezervasyonlar', tahsilat.rezervasyonId);
    if (rez) aciklamaText = `Tahsilat · ${rez.rezervasyonKodu}`;
  }
  if (tahsilatPB !== ana) {
    aciklamaText += ` (≈ ${tutarAna.toFixed(2)} ${ana} @ ${kur.toFixed(4)})`;
  }

  batch.add('hesapHareketleri', {
    hesapId: tahsilat.hesapId,
    tarih: tahsilat.tarih,
    tutar: tutarOrij,
    paraBirimi: hesapPB,
    tip: 'tahsilat',
    aciklama: aciklamaText,
    rezervasyonId: tahsilat.rezervasyonId || null,
    grupId: tahsilat.grupId || null,
    tahsilatId,
    transferId: null,
    giderId: null,
    olusturanId: kullaniciId || null,
    olusturmaTarihi: new Date().toISOString()
  });

  await batch.commit();
  return { id: tahsilatId, ...tahsilatData };
};

/**
 * Tahsilat sil — tahsilat doc'u silinir, ters iptal hareketi eklenir.
 * Orijinal hesap hareketi silinmez (audit trail korunur).
 */
export const deleteTahsilatWithHareket = async (tahsilatId, kullaniciId) => {
  const old = await db.get('tahsilatlar', tahsilatId);
  if (!old) return null;

  const batch = db.batch();
  batch.delete('tahsilatlar', tahsilatId);
  batch.add('hesapHareketleri', {
    hesapId: old.hesapId,
    tarih: todayISO(),
    tutar: -old.tutar,
    paraBirimi: old.paraBirimi || 'EUR',
    tip: 'iptal',
    aciklama: `Tahsilat iptal: ${old.tutar} ${old.paraBirimi || ''}`.trim(),
    tahsilatId: null,
    transferId: null,
    giderId: null,
    rezervasyonId: old.rezervasyonId || null,
    grupId: old.grupId || null,
    olusturanId: kullaniciId || null,
    olusturmaTarihi: new Date().toISOString(),
  });
  await batch.commit();
};

/**
 * Tahsilat güncelle — audit trail pattern.
 * Bakiyeyi etkileyen değişiklik varsa eski hareket KALIR, düzeltme hareketi eklenir.
 * Bakiyeyi etkilemeyen değişiklik (tarih/yöntem/açıklama/kur) sadece doc'u günceller.
 */
export const updateTahsilatWithHareket = async (tahsilatId, partial, ana, kullaniciId) => {
  const old = await db.get('tahsilatlar', tahsilatId);
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
    throw new Error(`Bu hesap ${hesapPB} cinsinden, ödeme ${yeniPB} cinsinden alınamaz.`);
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

  // Tahsilat doc'unu güncelle (her zaman)
  await db.update('tahsilatlar', tahsilatId, {
    ...partial,
    hesapId: yeniHesapId,
    paraBirimi: yeniPB,
    tutar: yeniTutar,
    kur,
    tutarAna,
  });

  if (!bakiyeEtkisi) {
    return { id: tahsilatId, ...old, ...partial, hesapId: yeniHesapId, paraBirimi: yeniPB, tutar: yeniTutar, kur, tutarAna };
  }

  const bugun = todayISO();
  const batch = db.batch();

  if (hesapDegisti || pbDegisti) {
    // Eski hesapta ters düzeltme
    batch.add('hesapHareketleri', {
      hesapId: old.hesapId,
      tarih: bugun,
      tutar: -old.tutar,
      paraBirimi: old.paraBirimi || ana,
      tip: 'duzeltme',
      aciklama: `Tahsilat düzeltme: ${old.tutar} ${old.paraBirimi || ana} geri alındı`,
      tahsilatId,
      transferId: null,
      giderId: null,
      rezervasyonId: old.rezervasyonId || null,
      grupId: old.grupId || null,
      olusturanId: kullaniciId || null,
      olusturmaTarihi: new Date().toISOString(),
    });
    // Yeni hesapta yeni giriş
    batch.add('hesapHareketleri', {
      hesapId: yeniHesapId,
      tarih: bugun,
      tutar: yeniTutar,
      paraBirimi: hesapPB,
      tip: 'duzeltme',
      aciklama: `Tahsilat düzeltme: ${yeniTutar} ${yeniPB}`,
      tahsilatId,
      transferId: null,
      giderId: null,
      rezervasyonId: old.rezervasyonId || null,
      grupId: old.grupId || null,
      olusturanId: kullaniciId || null,
      olusturmaTarihi: new Date().toISOString(),
    });
  } else {
    // Sadece tutar değişti — fark hareketi
    const fark = yeniTutar - old.tutar;
    batch.add('hesapHareketleri', {
      hesapId: old.hesapId,
      tarih: bugun,
      tutar: fark,
      paraBirimi: old.paraBirimi || ana,
      tip: 'duzeltme',
      aciklama: `Tahsilat düzeltme: ${old.tutar} → ${yeniTutar} ${old.paraBirimi || ana}`,
      tahsilatId,
      transferId: null,
      giderId: null,
      rezervasyonId: old.rezervasyonId || null,
      grupId: old.grupId || null,
      olusturanId: kullaniciId || null,
      olusturmaTarihi: new Date().toISOString(),
    });
  }

  await batch.commit();
  return { id: tahsilatId, ...old, ...partial, hesapId: yeniHesapId, paraBirimi: yeniPB, tutar: yeniTutar, kur, tutarAna };
};
