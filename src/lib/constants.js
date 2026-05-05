/**
 * constants.js
 *
 * Tüm sabit option array'leri. Eski hoteluter.html'deki *_OPTS sabitleri buraya taşındı.
 * Dropdown'larda, badge'lerde, formlarda kullanılır.
 */

/* ===== PARA BİRİMLERİ ===== */
export const PARA_BIRIMI_OPTS = [
  { v: 'EUR', l: 'Euro',    symbol: '€', locale: 'tr-TR' },
  { v: 'USD', l: 'Dolar',   symbol: '$', locale: 'tr-TR' },
  { v: 'TRY', l: 'TL',      symbol: '₺', locale: 'tr-TR' },
  { v: 'GBP', l: 'Sterlin', symbol: '£', locale: 'tr-TR' }
];

export const PARA_BIRIMI_INFO = (v) => PARA_BIRIMI_OPTS.find(p => p.v === v) || PARA_BIRIMI_OPTS[0];

/* ===== HESAP TİPLERİ ===== */
export const HESAP_TIP_OPTS = [
  { v: 'kasa',   l: 'Kasa',     icon: 'wallet',       renk: '#4a7c59' },
  { v: 'banka',  l: 'Banka',    icon: 'landmark',     renk: '#4a6b85' },
  { v: 'pos',    l: 'POS/Kart', icon: 'credit-card',  renk: '#a87842' },
  { v: 'kredi',  l: 'Kredi',    icon: 'trending-up',  renk: '#8e5572' },
  { v: 'diger',  l: 'Diğer',    icon: 'more-horizontal', renk: '#6b6b6b' }
];

export const HESAP_TIP_INFO = (v) => HESAP_TIP_OPTS.find(t => t.v === v) || HESAP_TIP_OPTS[0];

/* ===== HAREKET TİPLERİ ===== */
export const HAREKET_TIP_OPTS = [
  { v: 'tahsilat',             l: 'Tahsilat',         yon: '+' },
  { v: 'transfer-giris',       l: 'Transfer Giriş',   yon: '+' },
  { v: 'transfer-cikis',       l: 'Transfer Çıkış',   yon: '-' },
  { v: 'doviz-transfer-giris', l: 'Döviz Giriş',      yon: '+' },
  { v: 'doviz-transfer-cikis', l: 'Döviz Çıkış',      yon: '-' },
  { v: 'gider',                l: 'Gider',            yon: '-' },
  { v: 'manuel-giris',         l: 'Manuel Giriş',     yon: '+' },
  { v: 'manuel-cikis',         l: 'Manuel Çıkış',     yon: '-' },
  { v: 'tahsilat-iptal',       l: 'Tahsilat İptal',   yon: '-' }
];

export const HAREKET_TIP_INFO = (v) => HAREKET_TIP_OPTS.find(t => t.v === v) || { l: v, yon: '+' };

/* ===== REZERVASYON DURUMLARI ===== */
export const DURUM_OPTS = [
  { v: 'onay-bekliyor',  l: 'Onay Bekliyor', renk: '#c87f3e', badge: 'warn' },
  { v: 'onayli',         l: 'Onaylı',        renk: '#4a7c59', badge: 'success' },
  { v: 'giris-yapildi',  l: 'Giriş Yapıldı', renk: '#4a6b85', badge: 'info' },
  { v: 'cikis-yapildi',  l: 'Çıkış Yapıldı', renk: '#6b6b6b', badge: 'neutral' },
  { v: 'iptal',          l: 'İptal',         renk: '#a64545', badge: 'danger' },
  { v: 'no-show',        l: 'No-Show',       renk: '#8e5572', badge: 'danger' }
];

export const DURUM_INFO = (v) => DURUM_OPTS.find(d => d.v === v) || DURUM_OPTS[0];

/* ===== PANSİYON TİPLERİ ===== */
export const PANSIYON_OPTS = [
  { v: 'oda',                l: 'Sadece Oda' },
  { v: 'oda-kahvalti',       l: 'Oda + Kahvaltı' },
  { v: 'yarim-pansiyon',     l: 'Yarım Pansiyon' },
  { v: 'tam-pansiyon',       l: 'Tam Pansiyon' },
  { v: 'her-sey-dahil',      l: 'Her Şey Dahil' }
];

/* ===== ÖDEME YÖNTEMLERİ ===== */
export const ODEME_OPTS = [
  { v: 'nakit',       l: 'Nakit' },
  { v: 'kredi-karti', l: 'Kredi Kartı' },
  { v: 'havale',      l: 'Havale/EFT' },
  { v: 'diger',       l: 'Diğer' }
];

/* ===== KANALLAR — varsayılan seed ===== */
/* Çalışma sırasında kullanıcı `kanallar` koleksiyonundan ekler/siler.
   Aşağıdaki liste yalnızca ilk seed için. */
export const DEFAULT_KANALLAR = [
  { kod: 'manuel',     ad: 'Manuel' },
  { kod: 'telefon',    ad: 'Telefon' },
  { kod: 'yuruyusten', ad: 'Yürüyüşten' },
  { kod: 'email',      ad: 'E-posta' },
  { kod: 'diger',      ad: 'Diğer' }
];

/* ===== GİDER KATEGORİLERİ — varsayılan seed ===== */
export const DEFAULT_GIDER_KATEGORILERI = [
  { ad: 'Personel Maaşı',     icon: 'users',           renk: '#4a6b85' },
  { ad: 'Kira',               icon: 'home',            renk: '#a87842' },
  { ad: 'Elektrik / Su',      icon: 'zap',             renk: '#c87f3e' },
  { ad: 'İnternet / Telefon', icon: 'wifi',            renk: '#8e5572' },
  { ad: 'Yiyecek & İçecek',   icon: 'utensils',        renk: '#4a7c59' },
  { ad: 'Temizlik & Bakım',   icon: 'spray-can',       renk: '#5e6b8e' },
  { ad: 'Vergi & Resmi',      icon: 'landmark',        renk: '#a64545' },
  { ad: 'Diğer',              icon: 'more-horizontal', renk: '#6b6b6b' }
];

/* ===== HESAPLAR — varsayılan seed ===== */
/* anaParaBirimi neyse ona göre açılır. */
export const DEFAULT_HESAPLAR = [
  { ad: 'Nakit Kasa',   tip: 'kasa',  renk: '#4a7c59', aciklama: 'Resepsiyon kasası' },
  { ad: 'Banka Hesabı', tip: 'banka', renk: '#4a6b85', aciklama: 'Ana banka hesabı' },
  { ad: 'POS / Kart',   tip: 'pos',   renk: '#a87842', aciklama: 'Kredi kartı POS' }
];
