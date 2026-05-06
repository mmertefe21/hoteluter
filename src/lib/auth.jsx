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

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db as firestore } from './firebase.js';

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
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
    return () => unsub();
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
    await signOut(auth);
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
 * NOT: createUserWithEmailAndPassword çağrıldığında MEVCUT OTURUM logout olur,
 * yeni oluşturulan kullanıcı session'a girer. Bu yan etkiyi önlemek için
 * Firebase Cloud Functions ile admin SDK kullanılması gerekir.
 *
 * Şu anki MVP çözümü: Yeni kullanıcı oluşturulduğunda mevcut admin
 * tekrar login olmak zorunda kalacak. Production'da Cloud Function ile düzeltilir.
 */
export const createUserWithProfile = async ({ email, password, profile }) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(firestore, 'users', cred.user.uid), {
    ...profile,
    email,
    aktif: true,
    olusturmaTarihi: new Date().toISOString()
  });
  return cred.user.uid;
};
