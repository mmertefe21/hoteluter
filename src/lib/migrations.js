/**
 * migrations.js
 *
 * Firestore'da ilk açılışta gerekli minimum sistem kayıtlarını oluşturur.
 *
 * KURAL: Demo veri YOK — Mert kendi otelini sıfırdan kuracak.
 * Sadece sistem'in çalışması için zorunlu olanlar:
 *   - 5 default kanal
 *   - 8 default gider kategorisi
 *   - 3 default hesap (anaParaBirimi'nde)
 *
 * Migration flag pattern: _meta.seeded_v01_kanallar gibi flag'lerle
 * her migration bir kez çalışır. Yeniden çalıştırmaz.
 */

import { db } from './db.js';
import {
  DEFAULT_KANALLAR,
  DEFAULT_GIDER_KATEGORILERI,
  DEFAULT_HESAPLAR
} from './constants.js';

/**
 * v01_kanallar — Default kanalları seed'le
 */
const migrate_v01_kanallar = async () => {
  const flag = await db.getMeta('seeded_v01_kanallar');
  if (flag) return { skipped: true };

  for (const k of DEFAULT_KANALLAR) {
    await db.add('kanallar', { ...k, aktif: true });
  }
  await db.setMeta('seeded_v01_kanallar', true);
  return { added: DEFAULT_KANALLAR.length };
};

/**
 * v02_giderKategorileri — Default gider kategorilerini seed'le
 */
const migrate_v02_giderKategorileri = async () => {
  const flag = await db.getMeta('seeded_v02_giderKategorileri');
  if (flag) return { skipped: true };

  for (const g of DEFAULT_GIDER_KATEGORILERI) {
    await db.add('giderKategorileri', { ...g, aktif: true });
  }
  await db.setMeta('seeded_v02_giderKategorileri', true);
  return { added: DEFAULT_GIDER_KATEGORILERI.length };
};

/**
 * v03_hesaplar — Default hesapları seed'le
 * Otel kaydında anaParaBirimi yoksa EUR varsayılan.
 */
const migrate_v03_hesaplar = async () => {
  const flag = await db.getMeta('seeded_v03_hesaplar');
  if (flag) return { skipped: true };

  const otel = await db.getOtel();
  const anaPB = otel?.anaParaBirimi || 'EUR';

  for (const h of DEFAULT_HESAPLAR) {
    await db.add('hesaplar', {
      ...h,
      paraBirimi: anaPB,
      aktif: true
    });
  }
  await db.setMeta('seeded_v03_hesaplar', true);
  return { added: DEFAULT_HESAPLAR.length, paraBirimi: anaPB };
};

/**
 * Tüm migration'ları sırayla çalıştır.
 * App boot'unda bir kez çağrılır.
 *
 * Sonuç loglanır console'a; her migration ya skip ya da kaç kayıt eklendiğini söyler.
 */
export const runMigrations = async () => {
  const results = {};
  try {
    results.v01_kanallar = await migrate_v01_kanallar();
    results.v02_giderKategorileri = await migrate_v02_giderKategorileri();
    results.v03_hesaplar = await migrate_v03_hesaplar();
    console.log('[migrations] Tamamlandı:', results);
  } catch (e) {
    console.error('[migrations] Hata:', e);
    throw e;
  }
  return results;
};
