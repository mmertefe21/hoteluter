/**
 * helpers/aktiviteLog.js
 *
 * Kullanıcı aksiyon log yardımcısı.
 *
 * ÖNEMLİ KURAL: logAksiyon / logGiris asıl iş akışını KIRMAMALI.
 * Tüm Firestore yazmaları try/catch içinde; hata → console.warn, asla throw.
 *
 * Neden atomik değil: audit log'da küçük gecikme / partial write tolere edilir.
 * Asıl iş akışı (rezervasyon kaydetme, tahsilat vs.) etkilenmemeli.
 */

import { serverTimestamp } from 'firebase/firestore';
import { auth } from '../lib/firebase.js';
import { db } from '../lib/db.js';

/**
 * Herhangi bir aksiyon için log yazar.
 * currentUser yoksa sessizce döner (login öncesi çağrı olabilir).
 *
 * @param {{ aksiyon: string, aciklama: string, hedefTip: string, hedefId?: string|null }} param
 */
export const logAksiyon = async ({ aksiyon, aciklama, hedefTip, hedefId = null }) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const uid = currentUser.uid;

    let adSoyad = '';
    try {
      const userDoc = await db.get('users', uid);
      adSoyad = userDoc?.adSoyad || '';
    } catch {
      // adSoyad alınamazsa devam et — log yine de yazılır
    }

    await db.add('aktiviteLog', {
      kullaniciId: uid,
      kullaniciAdSoyad: adSoyad,
      aksiyon,
      aciklama,
      hedefTip: hedefTip || null,
      hedefId: hedefId || null,
      tarih: serverTimestamp(),
    });

    await db.update('users', uid, {
      sonAksiyon: aciklama,
      sonAksiyonTarih: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[aktiviteLog] Log yazılamadı:', e.message);
  }
};

/**
 * Giriş logu — onAuthStateChanged içinden çağrılır.
 * Normal logAksiyon'dan farklı: uid + adSoyad parametre olarak geçilir
 * (currentUser henüz tam yüklenmemiş olabilir, auth.currentUser'a bağımlılık yok).
 *
 * @param {string} uid
 * @param {string} adSoyad
 */
export const logGiris = async (uid, adSoyad) => {
  try {
    await db.add('aktiviteLog', {
      kullaniciId: uid,
      kullaniciAdSoyad: adSoyad || '',
      aksiyon: 'auth.giris',
      aciklama: 'Sisteme giriş yaptı',
      hedefTip: 'auth',
      hedefId: null,
      tarih: serverTimestamp(),
    });

    await db.update('users', uid, {
      sonGiris: serverTimestamp(),
      sonAksiyon: 'Sisteme giriş yaptı',
      sonAksiyonTarih: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[aktiviteLog] Giriş logu yazılamadı:', e.message);
  }
};

// DEV ortamında browser console'dan test etmek için
if (import.meta.env.DEV) {
  window.__aktiviteLog = { logAksiyon, logGiris };
}
