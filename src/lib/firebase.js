/**
 * Firebase initialization
 *
 * Firestore + Auth init burada yapılır. Diğer dosyalar buradan import eder:
 *   import { auth, db } from './lib/firebase.js';
 *
 * Config .env dosyasından okunur (Vite ortam değişkenleri VITE_ prefix'iyle).
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Sanity check — config eksikse early warning
const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length > 0) {
  console.error(
    '[Firebase] Eksik config değerleri:',
    missing.map(k => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`).join(', '),
    '\n.env dosyanızı kontrol edin.'
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Geliştirici amaçlı: bağlantı durumunu console'a bas
if (import.meta.env.DEV) {
  console.log('[Firebase] Bağlandı:', firebaseConfig.projectId);
}
