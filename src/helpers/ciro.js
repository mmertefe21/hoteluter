/**
 * helpers/ciro.js
 *
 * Rezervasyon ciro hesabı — gece bazında dağıtım, segment-aware.
 *
 * "Ciro" tanımı: rezervasyonların geceFiyati toplamı, her gece kendi tarihinde
 * sayılır. 28 May → 3 Haz (4 gece) rez'in 4 gecesi May'a, çıkış günü hücresi
 * boş kalır (otelcilik gece kuralı, computeBar ile aynı).
 *
 * Bölünmüş rezervasyonlar (segmentler[]) için her segment kendi tarihinde
 * sayılır; ana giris/cikis değil. Bu sayede bölünmüş rez doğru aya dağılır.
 *
 * Detay fiyat modunda her gecenin kendi fiyatı kullanılır; idx rez'in orijinal
 * giris tarihinden hesaplanır (split sonrası bile geceFiyatlari array sırası
 * korunur). Detay'da fiyat boş/NaN ise fallback geceFiyati'na düşer.
 */

import { addDays, diffDays } from '../lib/helpers.js';
import { getOdaSegmentleri } from './segmentler.js';

const VARSAYILAN_AKTIF_DURUMLAR = ['onayli', 'giris-yapildi', 'cikis-yapildi'];

/**
 * Tarih aralığı (inclusive) için ciro ve dolu gece toplamı.
 *
 * @param {Array} rezervasyonlar
 * @param {string} fromIso - YYYY-MM-DD (dahil)
 * @param {string} toIso - YYYY-MM-DD (dahil)
 * @param {Array<string>} [aktifDurumlar]
 * @returns {{ ciro: number, doluGece: number }}
 */
export const getCiroByDateRange = (
  rezervasyonlar,
  fromIso,
  toIso,
  aktifDurumlar = VARSAYILAN_AKTIF_DURUMLAR,
) => {
  let ciro = 0;
  let doluGece = 0;

  rezervasyonlar.forEach((rez) => {
    if (!aktifDurumlar.includes(rez.durum)) return;
    const segments = getOdaSegmentleri(rez);
    segments.forEach((seg) => {
      let d = seg.girisTarihi;
      while (d < seg.cikisTarihi) {
        if (d >= fromIso && d <= toIso) {
          doluGece += 1;
          if (rez.fiyatModu === 'detay' && Array.isArray(rez.geceFiyatlari)) {
            const idx = diffDays(rez.girisTarihi, d);
            const fiyat = Number(rez.geceFiyatlari[idx]);
            ciro += isNaN(fiyat) ? Number(rez.geceFiyati) || 0 : fiyat;
          } else {
            ciro += Number(rez.geceFiyati) || 0;
          }
        }
        d = addDays(d, 1);
      }
    });
  });

  return { ciro, doluGece };
};
