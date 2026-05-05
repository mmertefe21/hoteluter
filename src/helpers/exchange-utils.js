/**
 * helpers/exchange-utils.js
 *
 * Hesap bakiye, rezervasyon ödenen tutar gibi türetilen değerlerin hesaplayıcıları.
 *
 * Bu fonksiyonlar UI'da gelen `hareketler` ve `tahsilatlar` listelerinden hesap yapar
 * (DB roundtrip yok). Çünkü gerçek zamanlı UI'da listeler zaten state'te.
 */

/**
 * Bir hesabın güncel bakiyesi (kendi PB'sinde).
 * @param {string} hesapId
 * @param {Array} hesapHareketleri - tüm hareketler listesi
 */
export const getHesapBakiye = (hesapId, hesapHareketleri) => {
  return hesapHareketleri
    .filter(h => h.hesapId === hesapId)
    .reduce((sum, h) => sum + Number(h.tutar || 0), 0);
};

/**
 * Bir hesabın para birimi.
 */
export const getHesapParaBirimi = (hesapId, hesaplar, ana = 'EUR') => {
  const h = hesaplar.find(h => h.id === hesapId);
  return h ? (h.paraBirimi || ana) : ana;
};

/**
 * Hesap bakiyesini ana para birimine çevir.
 * cevirKur fonksiyonu opsiyonel — gerekiyorsa caller geçirsin.
 */
export const getHesapBakiyeAna = (hesapId, hesaplar, hesapHareketleri, ana, cevirKur) => {
  const bakiye = getHesapBakiye(hesapId, hesapHareketleri);
  const pb = getHesapParaBirimi(hesapId, hesaplar, ana);
  if (pb === ana) return bakiye;
  if (!cevirKur) return null;
  return cevirKur(bakiye, pb, ana);
};

/**
 * Bir rezervasyon için toplam ödenen tutar (ana para biriminde).
 */
export const getRezervasyonOdenen = (rezervasyonId, tahsilatlar) => {
  return tahsilatlar
    .filter(t => t.rezervasyonId === rezervasyonId)
    .reduce((sum, t) => sum + Number(t.tutarAna != null ? t.tutarAna : t.tutar || 0), 0);
};

/**
 * Bir rezervasyonun kalan borcu (ana para biriminde).
 */
export const getRezervasyonKalan = (rez, tahsilatlar) => {
  const toplam = Number(rez.toplamTutar || 0);
  const odenen = getRezervasyonOdenen(rez.id, tahsilatlar);
  return Math.max(0, toplam - odenen);
};

/**
 * Tüm hesapların ana PB'deki toplam bakiyesi.
 */
export const getToplamBakiyeAna = (hesaplar, hesapHareketleri, ana, cevirKur) => {
  return hesaplar
    .filter(h => h.aktif !== false)
    .reduce((sum, h) => {
      const bakiye = getHesapBakiyeAna(h.id, hesaplar, hesapHareketleri, ana, cevirKur);
      return sum + (bakiye || 0);
    }, 0);
};
