/**
 * db.js — Firestore Adapter
 *
 * Eski hoteluter.html'deki `db.list/get/add/update/delete` API'sini birebir korur.
 * Sayfaların kodunu değiştirmeden Firestore'a geçebilelim diye.
 *
 * ÖNEMLİ FARKLAR:
 *   - Tüm metodlar artık async (Promise döner)
 *   - Real-time için yeni `db.subscribe()` ve `useCollection()` hook'u var
 *   - Atomik işlemler için `db.batch()` (writeBatch wrapper)
 *
 * KURALLAR (Firmasyon dersi):
 *   - Compound where() YOK — basit eşitlik veya range
 *   - onSnapshot içinde async/await YOK — yan etkileri callback dışında yap
 *   - Migration flag pattern devam ediyor — _meta koleksiyonu
 */

import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, writeBatch, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { db as firestore } from './firebase.js';

/* ========================================================================
   PRIVATE HELPERS
   ======================================================================== */

const _docToObj = (snap) => {
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

const _snapsToList = (qs) => {
  const out = [];
  qs.forEach(s => out.push({ id: s.id, ...s.data() }));
  return out;
};

/* ========================================================================
   PUBLIC API — Eski hoteluter.html ile uyumlu
   ======================================================================== */

export const db = {
  /**
   * Bir koleksiyondaki tüm doküman listesini döner (one-shot, async).
   * @param {string} coll - Koleksiyon adı
   * @returns {Promise<Array>}
   */
  async list(coll) {
    const ref = collection(firestore, coll);
    const qs = await getDocs(ref);
    return _snapsToList(qs);
  },

  /**
   * Tek doküman oku. Yoksa null.
   * @param {string} coll
   * @param {string} id
   */
  async get(coll, id) {
    if (!id) return null;
    const ref = doc(firestore, coll, id);
    const snap = await getDoc(ref);
    return _docToObj(snap);
  },

  /**
   * Yeni doküman ekle. Auto-ID. Eklenmiş objeyi (id ile) döner.
   * @param {string} coll
   * @param {object} data
   */
  async add(coll, data) {
    const ref = collection(firestore, coll);
    const docRef = await addDoc(ref, {
      ...data,
      _createdAt: serverTimestamp(),
      _updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...data };
  },

  /**
   * Doküman güncelle. Verilen alanları merge eder.
   * @param {string} coll
   * @param {string} id
   * @param {object} partial
   */
  async update(coll, id, partial) {
    const ref = doc(firestore, coll, id);
    await updateDoc(ref, {
      ...partial,
      _updatedAt: serverTimestamp()
    });
    return { id, ...partial };
  },

  /**
   * Doküman sil.
   */
  async delete(coll, id) {
    const ref = doc(firestore, coll, id);
    await deleteDoc(ref);
    return true;
  },

  /* ===================================================================
     META — Migration flag'leri ve singleton settings
     _meta/single-doc içinde key-value
     =================================================================== */

  async getMeta(key) {
    const ref = doc(firestore, '_meta', 'flags');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return data[key] || null;
  },

  async setMeta(key, value) {
    const ref = doc(firestore, '_meta', 'flags');
    await setDoc(ref, { [key]: value }, { merge: true });
  },

  /* ===================================================================
     OTEL — Tek otel kaydı (singleton)
     otel/main dokümanı
     =================================================================== */

  async getOtel() {
    const ref = doc(firestore, 'otel', 'main');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  },

  async setOtel(data) {
    const ref = doc(firestore, 'otel', 'main');
    await setDoc(ref, data, { merge: true });
  },

  /* ===================================================================
     REAL-TIME SUBSCRIPTION
     =================================================================== */

  /**
   * Bir koleksiyona real-time abone ol.
   * onUpdate her değişiklikte çağrılır (Firestore'dan veya kendi yazımızdan).
   * @returns {Function} unsubscribe — temizlikte çağır
   */
  subscribe(coll, onUpdate, queryFn = null) {
    let ref = collection(firestore, coll);
    if (queryFn) ref = queryFn(ref);  // örn. q => query(q, where('aktif','==',true))
    return onSnapshot(ref, (qs) => {
      const list = _snapsToList(qs);
      onUpdate(list);
    }, (err) => {
      console.error(`[db.subscribe ${coll}]`, err);
    });
  },

  /**
   * Tek doküman real-time subscribe.
   */
  subscribeDoc(coll, id, onUpdate) {
    if (!id) { onUpdate(null); return () => {}; }
    const ref = doc(firestore, coll, id);
    return onSnapshot(ref, (snap) => {
      onUpdate(_docToObj(snap));
    });
  },

  /* ===================================================================
     ATOMIC BATCH (tahsilat + hareket gibi paired işlemler için)
     =================================================================== */

  /**
   * Yeni batch yarat. Bitince .commit() çağır.
   * Kullanım:
   *   const batch = db.batch();
   *   batch.add('tahsilatlar', {...});
   *   batch.add('hesapHareketleri', {...});
   *   await batch.commit();
   */
  batch() {
    const wb = writeBatch(firestore);
    const _ops = [];
    return {
      _wb: wb,
      add(coll, data) {
        const ref = doc(collection(firestore, coll));
        wb.set(ref, { ...data, _createdAt: serverTimestamp(), _updatedAt: serverTimestamp() });
        _ops.push({ type: 'add', coll, id: ref.id, data });
        return ref.id;
      },
      update(coll, id, partial) {
        const ref = doc(firestore, coll, id);
        wb.update(ref, { ...partial, _updatedAt: serverTimestamp() });
        _ops.push({ type: 'update', coll, id, partial });
      },
      delete(coll, id) {
        const ref = doc(firestore, coll, id);
        wb.delete(ref);
        _ops.push({ type: 'delete', coll, id });
      },
      async commit() {
        await wb.commit();
        return _ops;
      }
    };
  }
};

/* ========================================================================
   REACT HOOKS — Component'lerde real-time data
   ======================================================================== */

/**
 * Bir koleksiyona real-time abone ol, listeyi state olarak ver.
 *
 * const reservations = useCollection('rezervasyonlar');
 *
 * @param {string} coll
 * @param {object} options
 *   - filter: (q) => query(q, where(...)) — opsiyonel filtreleme
 *   - skip: bool — true ise subscribe yapma (lazy load için)
 */
export const useCollection = (coll, options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (options.skip) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = db.subscribe(coll, (list) => {
      setData(list);
      setLoading(false);
    }, options.filter);
    return () => unsub();
  }, [coll, options.skip]);

  return loading ? [] : data;
};

/**
 * Tek doküman real-time subscribe.
 *
 * const otel = useDoc('otel', 'main');
 */
export const useDoc = (coll, id) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id) { setData(null); return; }
    const unsub = db.subscribeDoc(coll, id, setData);
    return () => unsub();
  }, [coll, id]);

  return data;
};
