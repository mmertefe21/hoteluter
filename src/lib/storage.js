/**
 * storage.js — Firebase Storage yükleme/silme yardımcısı.
 *
 * Gider görselleri: giderler/{timestamp}_{random}_{safeName}
 * Path Firestore doc'da saklanır → silme her zaman mümkün (idempotent).
 *
 * Backward compat: Eski base64 kayıtlar path içermez.
 * deleteGiderGorsel(path) → path yoksa sessizce döner.
 */

import { storage } from './firebase.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const MAX_FILE_SIZE  = 5 * 1024 * 1024;   // 5 MB tekil dosya limiti
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;  // 25 MB toplam
const MAX_FILES      = 5;
const ALLOWED_TYPES  = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

export const STORAGE_LIMITS = { MAX_FILE_SIZE, MAX_TOTAL_SIZE, MAX_FILES, ALLOWED_TYPES };

export const validateFile = (file) => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: 'Sadece JPG, PNG ve PDF desteklenir.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `Dosya boyutu 5 MB'ı aşamaz. (Bu dosya: ${(file.size / 1024).toFixed(0)} KB)` };
  }
  return { ok: true };
};

export const validateTotalSize = (currentFiles, newFile) => {
  const currentSize = currentFiles.reduce((s, f) => s + (f.size || 0), 0);
  const total = currentSize + newFile.size;
  if (total > MAX_TOTAL_SIZE) {
    return {
      ok: false,
      error: `Toplam boyut 25 MB'ı aşamaz. (Şu an: ${(currentSize / 1024 / 1024).toFixed(1)} MB, ekleme: ${(newFile.size / 1024).toFixed(0)} KB)`,
    };
  }
  return { ok: true };
};

/**
 * Gider görselini Firebase Storage'a yükler.
 * Path: giderler/{timestamp}_{random}_{safeName}
 *
 * @param {File} file
 * @returns {{ fileName, type, size, url, path, uploadedAt }}
 */
export const uploadGiderGorsel = async (file) => {
  const timestamp = Date.now();
  const random    = Math.random().toString(36).slice(2, 8);
  const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path      = `giderler/${timestamp}_${random}_${safeName}`;

  const storageRef = ref(storage, path);
  const snapshot   = await uploadBytes(storageRef, file);
  const url        = await getDownloadURL(snapshot.ref);

  return {
    fileName: file.name,
    type: file.type,
    size: file.size,
    url,
    path,
    uploadedAt: new Date().toISOString(),
  };
};

/**
 * Storage'dan görsel sil.
 * path yoksa (eski base64 kayıt) sessizce döner — idempotent.
 *
 * @param {string|null|undefined} path
 */
export const deleteGiderGorsel = async (path) => {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    console.warn('[storage] deleteGiderGorsel:', err.message);
  }
};
