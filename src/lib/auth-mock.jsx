/**
 * auth-mock.js — Geçici mock auth (Görev 9'da gerçek Firebase Auth ile değişecek).
 *
 * Aynı API yüzeyini sunar (useAuth, AuthProvider, user, can, login, logout)
 * böylece Görev 9'da sadece import path'i `auth-mock.js` → `auth.js` değişecek.
 *
 * Mock kullanıcı: superadmin · tüm modüller, tüm aksiyonlar.
 */
import { createContext, useContext, useState } from 'react';

const MOCK_USER = {
  id: 'mock-superadmin',
  kullaniciAdi: 'admin',
  adSoyad: 'Mert Efe',
  email: 'mert@hoteluter.com',
  rol: 'superadmin',
  modulYetkileri: {},
  aktif: true,
};

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(MOCK_USER);
  const authReady = true;

  const login = async (_email, _password) => {
    setUser(MOCK_USER);
    return { success: true };
  };

  const logout = async () => {
    setUser(null);
  };

  // Mock: superadmin her şeyi yapabilir; user yoksa false.
  const can = (_modul, _aksiyon = 'goruntule') => {
    if (!user) return false;
    if (user.rol === 'superadmin') return true;
    const yetkiler = user.modulYetkileri?.[_modul] || [];
    return yetkiler.includes(_aksiyon);
  };

  const refreshUser = async () => {};
  const changePassword = async () => ({ success: true });

  return (
    <AuthContext.Provider value={{ user, authReady, login, logout, can, refreshUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};
