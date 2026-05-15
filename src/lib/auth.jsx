/**
 * auth.js — Firebase Authentication
 *
 * Firebase Auth state'i React context'iyle paylaşır.
 * Login/logout, kullanıcı profili (Firestore users koleksiyonu) burada.
 *
 * users koleksiyonu yapısı:
 *   doc.id = Firebase Auth UID
 *   {
 *     kullaniciAdi: string,
 *     adSoyad: string,
 *     email: string,
 *     rol: 'superadmin' | 'admin' | 'kullanici',
 *     modulYetkileri: { rezervasyon: ['goruntule','ekle',...], ... },
 *     aktif: boolean
 *   }
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db as firestore, secondaryAuth } from './firebase.js';
import { logGiris, logAksiyon } from '../helpers/aktiviteLog.js';

/* ===== CONTEXT ===== */
const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

/* ===== PROVIDER ===== */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);     // Firestore profile + Firebase Auth user
  const [authReady, setAuthReady] = useState(false);
  const sessionSnapUnsubRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      // Her auth state değişiminde eski session snapshot'unu temizle
      if (sessionSnapUnsubRef.current) {
        sessionSnapUnsubRef.current();
        sessionSnapUnsubRef.current = null;
      }
      if (!fbUser) {
        setUser(null);
        setAuthReady(true);
        return;
      }
      // Firestore'dan profili çek
      try {
        const profSnap = await getDoc(doc(firestore, 'users', fbUser.uid));
        if (profSnap.exists()) {
          const profile = profSnap.data();
          if (profile.aktif === false) {
            console.warn('[auth] User profile pasif, logging out');
            await signOut(auth);
            return;
          }
          setUser({
            id: fbUser.uid,
            email: fbUser.email,
            ...profile
          });

          // Session güvenliği: bu cihazın session ID'sini Firestore'a yaz
          let localSid = localStorage.getItem('hoteluter_sid');
          if (!localSid) {
            localSid = crypto.randomUUID();
            localStorage.setItem('hoteluter_sid', localSid);
          }
          await updateDoc(doc(firestore, 'users', fbUser.uid), { aktifSessionId: localSid }).catch(() => {});

          // Başka cihazdan giriş kontrolü — onSnapshot callback'i async olmamalı
          sessionSnapUnsubRef.current = onSnapshot(doc(firestore, 'users', fbUser.uid), (snap) => {
            const data = snap.data();
            const currentSid = localStorage.getItem('hoteluter_sid');
            if (data?.aktifSessionId && currentSid && data.aktifSessionId !== currentSid) {
              if (sessionSnapUnsubRef.current) {
                sessionSnapUnsubRef.current();
                sessionSnapUnsubRef.current = null;
              }
              localStorage.setItem('hoteluter_loginMsg', 'Başka bir cihazdan giriş yapıldı. Oturumunuz sonlandırıldı.');
              signOut(auth).catch(() => {});
            }
          });

          void logGiris(fbUser.uid, profile.adSoyad);
        } else {
          // Profil yok — bu kullanıcı için users koleksiyonunda kayıt eksik
          console.warn('[auth] No Firestore profile for', fbUser.uid);
          // Login ekranına geri dön
          await signOut(auth);
          setUser(null);
        }
      } catch (e) {
        console.error('[auth] Profile fetch failed:', e);
      }
      setAuthReady(true);
    });
    return () => {
      unsub();
      if (sessionSnapUnsubRef.current) {
        sessionSnapUnsubRef.current();
        sessionSnapUnsubRef.current = null;
      }
    };
  }, []);

  /**
   * Email/şifre ile giriş yap.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (e) {
      const code = e.code || '';
      let msg = 'Giriş başarısız.';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        msg = 'E-posta veya şifre hatalı.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Çok fazla deneme. Birkaç dakika sonra tekrar deneyin.';
      } else if (code === 'auth/network-request-failed') {
        msg = 'İnternet bağlantısı yok.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Geçersiz e-posta formatı.';
      }
      return { success: false, error: msg, code };
    }
  };

  const logout = async () => {
    // a) Snapshot dinleyiciyi durdur
    if (sessionSnapUnsubRef.current) {
      sessionSnapUnsubRef.current();
      sessionSnapUnsubRef.current = null;
    }
    localStorage.removeItem('hoteluter_sid');
    // b) Oturumu kapat
    const currentUser = auth.currentUser;
    await signOut(auth);
    // c) Firestore'daki aktifSessionId'yi temizle (best-effort)
    if (currentUser) {
      updateDoc(doc(firestore, 'users', currentUser.uid), { aktifSessionId: null }).catch(() => {});
    }
  };

  /**
   * Şifre değiştir (giriş yapılmış kullanıcı için).
   */
  const changePassword = async (newPassword) => {
    if (!auth.currentUser) return { success: false, error: 'Oturum yok' };
    try {
      await updatePassword(auth.currentUser, newPassword);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  /**
   * Yetki kontrolü.
   * Superadmin her şeyi yapabilir.
   * Diğerleri için modulYetkileri.<modul>.<aksiyon> kontrol edilir.
   *
   * Kullanım: const { can } = useAuth(); if (can('rezervasyon', 'ekle')) {...}
   */
  const can = (modul, aksiyon = 'goruntule') => {
    if (!user) return false;
    if (user.rol === 'superadmin') return true;
    const yetkiler = user.modulYetkileri?.[modul] || [];
    return yetkiler.includes(aksiyon);
  };

  /**
   * Profil refresh — yetkiler/rol değişmişse yeniden çek.
   */
  const refreshUser = async () => {
    if (!auth.currentUser) return;
    const snap = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
    if (snap.exists()) {
      setUser({
        id: auth.currentUser.uid,
        email: auth.currentUser.email,
        ...snap.data()
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, authReady, login, logout, can, refreshUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

/* ===== KULLANICI YARATMA (SADECE SUPERADMIN İÇİN) ===== */

/**
 * Yeni kullanıcı oluştur — Firebase Auth + Firestore profil birlikte.
 * Bu fonksiyon sadece UsersPage'den çağrılır.
 *
 * Secondary Firebase App kullanılır — birincil admin oturumu etkilenmez.
 * Oluşturma sonrası secondary session signOut ile temizlenir (try/finally garantisi).
 */
export const createUserWithProfile = async ({ email, password, profile }) => {
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await setDoc(doc(firestore, 'users', cred.user.uid), {
      ...profile,
      email,
      aktif: true,
      olusturmaTarihi: new Date().toISOString()
    });
    void logAksiyon({
      aksiyon: 'kullanici.olustur',
      aciklama: `Kullanıcı oluşturuldu: ${profile.adSoyad || email}`,
      hedefTip: 'user',
      hedefId: cred.user.uid,
    });
    return cred.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }
};
