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
  if (tahsilat.rezervasyonId) {
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
    tahsilatId,
    transferId: null,
    giderId: null,
    olusturmaTarihi: new Date().toISOString()
  });

  await batch.commit();
  return { id: tahsilatId, ...tahsilatData };
};

/**
 * Tahsilat sil — bağlı hesap hareketlerini de siler.
 */
export const deleteTahsilatWithHareket = async (tahsilatId) => {
  const hareketler = await db.list('hesapHareketleri');
  const ilgili = hareketler.filter(h => h.tahsilatId === tahsilatId);

  const batch = db.batch();
  ilgili.forEach(h => batch.delete('hesapHareketleri', h.id));
  batch.delete('tahsilatlar', tahsilatId);
  await batch.commit();
};

/**
 * Tahsilat güncelle — eski hareketi sil, yenisini yaz.
 */
export const updateTahsilatWithHareket = async (tahsilatId, partial, ana) => {
  const old = await db.get('tahsilatlar', tahsilatId);
  if (!old) return null;

  const merged = { ...old, ...partial };
  const hesap = await db.get('hesaplar', merged.hesapId);
  if (!hesap) throw new Error('Hesap bulunamadı');

  const hesapPB = hesap.paraBirimi || ana;
  const tahsilatPB = merged.paraBirimi || hesapPB;
  if (tahsilatPB !== hesapPB) {
    throw new Error(`Bu hesap ${hesapPB} cinsinden, ödeme ${tahsilatPB} cinsinden alınamaz.`);
  }

  const tutarOrij = Math.abs(Number(merged.tutar) || 0);
  let kur = 1;
  let tutarAna = tutarOrij;
  if (tahsilatPB !== ana) {
    if (merged.kur && Number(merged.kur) > 0) {
      kur = Number(merged.kur);
      tutarAna = tutarOrij * kur;
    } else {
      const cev = cevirKur(tutarOrij, tahsilatPB, ana);
      if (cev !== null && cev > 0) {
        tutarAna = cev;
        kur = tutarAna / tutarOrij;
      } else {
        throw new Error('Kur bilgisi yok.');
      }
    }
  }

  const final = { ...merged, paraBirimi: tahsilatPB, kur, tutar: tutarOrij, tutarAna };

  // Eski hareketleri sil
  const hareketler = await db.list('hesapHareketleri');
  const ilgili = hareketler.filter(h => h.tahsilatId === tahsilatId);

  const batch = db.batch();
  ilgili.forEach(h => batch.delete('hesapHareketleri', h.id));
  batch.update('tahsilatlar', tahsilatId, final);

  let aciklamaText = final.aciklama || 'Tahsilat';
  if (final.rezervasyonId) {
    const rez = await db.get('rezervasyonlar', final.rezervasyonId);
    if (rez) aciklamaText = `Tahsilat · ${rez.rezervasyonKodu}`;
  }
  if (tahsilatPB !== ana) {
    aciklamaText += ` (≈ ${tutarAna.toFixed(2)} ${ana} @ ${kur.toFixed(4)})`;
  }
  batch.add('hesapHareketleri', {
    hesapId: final.hesapId,
    tarih: final.tarih,
    tutar: tutarOrij,
    paraBirimi: hesapPB,
    tip: 'tahsilat',
    aciklama: aciklamaText,
    rezervasyonId: final.rezervasyonId || null,
    tahsilatId,
    transferId: null,
    giderId: null,
    olusturmaTarihi: new Date().toISOString()
  });

  await batch.commit();
  return final;
};
