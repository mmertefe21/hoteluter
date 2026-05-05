/**
 * kur.js
 *
 * Döviz kur servisi. ECB verisi (api.frankfurter.app) — ücretsiz, key gerektirmez.
 * 12 saatlik cache + manuel override desteği.
 *
 * Cache localStorage'da tutulur (kullanıcı bazlı, küçük data).
 * Kurların kendisi Firestore'da değil, çünkü:
 *   - Pek değişken (saatte bir update)
 *   - Read sayısı kasamızı şişirir
 *   - Public bir API, her kullanıcı kendi cache'ini tutsun yeter
 */

const KUR_CACHE_KEY = 'hoteluter_kurlar_v1';
const MANUEL_KUR_KEY = 'hoteluter_manuel_kurlar';
const KUR_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 saat

/* ===== Cache I/O ===== */
const _readKurCache = () => {
  try { return JSON.parse(localStorage.getItem(KUR_CACHE_KEY) || 'null'); }
  catch (e) { return null; }
};
const _writeKurCache = (data) => localStorage.setItem(KUR_CACHE_KEY, JSON.stringify(data));

/* ===== Manuel kur I/O ===== */
export const getManuelKurlar = () => {
  try { return JSON.parse(localStorage.getItem(MANUEL_KUR_KEY) || 'null'); }
  catch (e) { return null; }
};
export const setManuelKurlar = (data) => localStorage.setItem(MANUEL_KUR_KEY, JSON.stringify(data));
export const clearManuelKurlar = () => localStorage.removeItem(MANUEL_KUR_KEY);

/* ===== Public API ===== */

/**
 * Canlı kuru fetch et — Frankfurter API'ye istek atar.
 * Başarılıysa cache'i günceller ve veriyi döner. Hata varsa null.
 */
export const fetchKurlar = async () => {
  try {
    const url = 'https://api.frankfurter.app/latest?from=EUR&to=USD,TRY,GBP';
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const rates = { EUR: 1, ...json.rates };
    const data = {
      base: 'EUR',
      rates,
      date: json.date,
      fetchedAt: new Date().toISOString(),
      source: 'frankfurter.app (ECB)'
    };
    _writeKurCache(data);
    return data;
  } catch (e) {
    console.warn('[kur] fetchKurlar failed:', e);
    return null;
  }
};

/**
 * Cache'deki kuru oku. isStale flag'i 12 saatten eski olduğunu söyler.
 */
export const getKurlar = () => {
  const cache = _readKurCache();
  if (!cache) return null;
  const age = Date.now() - new Date(cache.fetchedAt).getTime();
  return { ...cache, isStale: age > KUR_CACHE_TTL_MS };
};

/**
 * Aktif kur tablosu — manuel override öncelikli, sonra cache, yoksa null.
 */
export const getActiveKurlar = () => {
  const manuel = getManuelKurlar();
  if (manuel) return { ...manuel, isManual: true };
  const cache = getKurlar();
  if (cache) return cache;
  return null;
};

/**
 * Kur dönüşüm.
 * cevirKur(100, 'USD', 'EUR') → ~92 (canlı kura göre)
 * 
 * EUR base'li çalışır:
 *   amount_in_target = (amount / rates[from]) * rates[to]
 */
export const cevirKur = (amount, from, to, kurlar = null) => {
  if (!amount) return 0;
  if (from === to) return Number(amount);
  const k = kurlar || getActiveKurlar();
  if (!k || !k.rates || !k.rates[from] || !k.rates[to]) return null;
  const amountInBase = Number(amount) / k.rates[from];
  return amountInBase * k.rates[to];
};

/**
 * App init'inde çağırılır — cache yoksa veya stale ise arka planda fetch.
 */
export const ensureKurlarLoaded = () => {
  const cache = getKurlar();
  if (!cache || cache.isStale) {
    fetchKurlar().then(d => {
      if (d) console.log('[kur] Güncellendi:', d.date);
    });
  }
};
