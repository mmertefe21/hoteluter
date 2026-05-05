/**
 * helpers.js
 *
 * Genel-amaçlı yardımcılar: tarih, format, isim, kod üretici.
 * Domain logic burada YOK (o helpers/ klasöründe).
 */

import { PARA_BIRIMI_INFO } from './constants.js';

/* ===== TARİH ===== */
export const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

export const addDays = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const diffDays = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export const fmtDateTR = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtDateShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

/* ===== PARA & FORMAT ===== */
/**
 * Bir tutarı belirli para biriminde formatla.
 * fmtMoney(100, 'EUR') → "€100.00"
 */
export const fmtMoney = (amount, currency = 'EUR') => {
  const info = PARA_BIRIMI_INFO(currency);
  try {
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(Number(amount) || 0);
  } catch (e) {
    return `${info.symbol}${(Number(amount) || 0).toFixed(2)}`;
  }
};

/**
 * Eski API uyumluluğu — fmtTL artık ana para birimini bekler param olarak.
 * Kullanım: fmtTL(amount, ana) — ama yeni kodda fmtMoney tercih et.
 */
export const fmtTL = (n, currency = 'EUR') => fmtMoney(n, currency);

/* ===== METİN ===== */
export const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
};

/* ===== ID & KOD ===== */
/**
 * Rezervasyon kodu üreticisi — Firebase'de rez sayısına bakar (async).
 * Format: HTL-YYYYAA-NNN  (örn. HTL-202605-001)
 */
export const generateRezKodu = async (db) => {
  const d = new Date();
  const ay = String(d.getMonth() + 1).padStart(2, '0');
  const yil = d.getFullYear();
  const liste = await db.list('rezervasyonlar');
  const sayi = String(liste.length + 1).padStart(3, '0');
  return `HTL-${yil}${ay}-${sayi}`;
};

/**
 * Rastgele ID üreticisi — Firestore'un kendi ID'leri yerine custom ID gerekirse.
 */
export const randomId = (prefix = '') => {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

/* ===== HAFTA ===== */
export const isWeekend = (iso) => {
  const dayOfWeek = new Date(iso).getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
};
