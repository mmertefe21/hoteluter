/**
 * helpers/segmentler.js
 *
 * Rezervasyon segmenti yardımcıları.
 *
 * KURAL (v0.7'den geliyor):
 *   - Bölünmüş rezervasyon hâlâ TEK kayıttır (segmentler array'ında oda/tarih atamaları)
 *   - getOdaSegmentleri(rez): bölünmemişse tek sanal segment, bölünmüşse array
 *   - checkOverlap: tüm rezervasyonların TÜM segmentlerini tarar
 */

import { db } from '../lib/db.js';

/**
 * Bir rezervasyonun segment listesini döndürür.
 * Bölünmemiş rez için tek sanal segment, bölünmüş için array.
 * Tüm görüntüleme/çakışma kodu segment-uniform çalışsın diye.
 *
 * @param {Object} rez
 * @returns {Array<{odaId, odaTipiId, girisTarihi, cikisTarihi, _segIdx, _isMulti}>}
 */
export const getOdaSegmentleri = (rez) => {
  if (rez.segmentler && rez.segmentler.length > 0) {
    return rez.segmentler.map((s, idx) => ({
      ...s,
      _segIdx: idx,
      _isMulti: rez.segmentler.length > 1
    }));
  }
  return [{
    odaId: rez.odaId,
    odaTipiId: rez.odaTipiId,
    girisTarihi: rez.girisTarihi,
    cikisTarihi: rez.cikisTarihi,
    _segIdx: 0,
    _isMulti: false
  }];
};

/**
 * Tarih çakışması kontrolü — segment-aware.
 *
 * @param {string} odaId - Çakışma kontrol edilecek oda
 * @param {string} giris - YYYY-MM-DD
 * @param {string} cikis - YYYY-MM-DD
 * @param {string|null} excludeRezId - Aynı rezervasyonu ignore et (kendi içinde çakışma sayma)
 * @param {Array} reservations - Mevcut rezervasyonlar listesi (UI'dan gelir, DB roundtrip yok)
 * @returns {boolean} - true ise çakışma var
 */
export const checkOverlap = (odaId, giris, cikis, excludeRezId, reservations) => {
  const aktifDurumlar = ['onay-bekliyor', 'onayli', 'giris-yapildi', 'cikis-yapildi'];
  return reservations.some(r => {
    if (r.id === excludeRezId) return false;
    if (!aktifDurumlar.includes(r.durum)) return false;
    const segs = getOdaSegmentleri(r);
    return segs.some(s =>
      s.odaId === odaId &&
      !(cikis <= s.girisTarihi || giris >= s.cikisTarihi)
    );
  });
};

/**
 * Async versiyon — db'den çeker. UI'da rez listesi yoksa kullan (örn. SplitModal).
 */
export const checkOverlapAsync = async (odaId, giris, cikis, excludeRezId) => {
  const reservations = await db.list('rezervasyonlar');
  return checkOverlap(odaId, giris, cikis, excludeRezId, reservations);
};
