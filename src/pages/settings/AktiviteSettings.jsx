/**
 * AktiviteSettings — Aktivite log listesi (Ayarlar → Aktivite tab'ı).
 *
 * - İlk 50 log yüklenir (orderBy tarih desc, limit 50)
 * - "Daha fazla yükle" butonu ile startAfter cursor ile +50 eklenir
 * - Filtreleme tamamen client-side: kullanıcı, aksiyon tipi, tarih aralığı, serbest metin
 */
import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { db as firestore } from '../../lib/firebase.js';
import { useCollection } from '../../lib/db.js';
import { AKSIYON_TIPLERI } from '../../lib/constants.js';
import Icon from '../../components/Icon.jsx';

// Firestore Timestamp ve ISO string ikisini de kabul eder
const fmtTS = (ts) => {
  if (!ts) return '—';
  const d = ts?.toDate?.() ?? new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const AktiviteSettings = () => {
  const users = useCollection('users');
  const [loaded, setLoaded] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [filterKullaniciId, setFilterKullaniciId] = useState('tumu');
  const [filterAksiyon, setFilterAksiyon] = useState('tumu');
  const [filterBaslangic, setFilterBaslangic] = useState('');
  const [filterBitis, setFilterBitis] = useState('');
  const [filterMetin, setFilterMetin] = useState('');

  const loadFirst = async () => {
    setFetching(true);
    try {
      const q = query(
        collection(firestore, 'aktiviteLog'),
        orderBy('tarih', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLoaded(docs);
      setLastVisible(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === 50);
    } catch (e) {
      console.error('[aktiviteLog]', e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { loadFirst(); }, []);

  const loadMore = async () => {
    if (!lastVisible || fetching) return;
    setFetching(true);
    try {
      const q = query(
        collection(firestore, 'aktiviteLog'),
        orderBy('tarih', 'desc'),
        startAfter(lastVisible),
        limit(50)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLoaded((prev) => [...prev, ...docs]);
      setLastVisible(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === 50);
    } catch (e) {
      console.error('[aktiviteLog]', e);
    } finally {
      setFetching(false);
    }
  };

  const clearFilters = () => {
    setFilterKullaniciId('tumu');
    setFilterAksiyon('tumu');
    setFilterBaslangic('');
    setFilterBitis('');
    setFilterMetin('');
  };

  const filtered = useMemo(() => loaded.filter((log) => {
    if (filterKullaniciId !== 'tumu' && log.kullaniciId !== filterKullaniciId) return false;
    if (filterAksiyon !== 'tumu' && log.aksiyon !== filterAksiyon) return false;
    if (filterBaslangic) {
      const d = log.tarih?.toDate?.() ?? new Date(log.tarih);
      if (d < new Date(filterBaslangic)) return false;
    }
    if (filterBitis) {
      const d = log.tarih?.toDate?.() ?? new Date(log.tarih);
      if (d > new Date(filterBitis + 'T23:59:59')) return false;
    }
    if (filterMetin) {
      if (!(log.aciklama || '').toLowerCase().includes(filterMetin.toLowerCase())) return false;
    }
    return true;
  }), [loaded, filterKullaniciId, filterAksiyon, filterBaslangic, filterBitis, filterMetin]);

  const isFiltered =
    filterKullaniciId !== 'tumu' || filterAksiyon !== 'tumu' ||
    !!filterBaslangic || !!filterBitis || !!filterMetin;

  return (
    <div className="space-y-4">

      {/* Filtre Bar */}
      <div
        className="rounded-lg p-3 flex flex-wrap gap-3 items-end"
        style={{ background: 'var(--bone-warm)', border: '1px solid var(--line-soft)' }}
      >
        <div>
          <label className="htl-label" style={{ marginBottom: 4 }}>Kullanıcı</label>
          <select
            className="htl-input"
            style={{ minWidth: 160 }}
            value={filterKullaniciId}
            onChange={(e) => setFilterKullaniciId(e.target.value)}
          >
            <option value="tumu">Tümü</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.adSoyad || u.kullaniciAdi}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="htl-label" style={{ marginBottom: 4 }}>Aksiyon Tipi</label>
          <select
            className="htl-input"
            style={{ minWidth: 200 }}
            value={filterAksiyon}
            onChange={(e) => setFilterAksiyon(e.target.value)}
          >
            <option value="tumu">Tümü</option>
            {Object.entries(AKSIYON_TIPLERI).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="htl-label" style={{ marginBottom: 4 }}>Başlangıç</label>
          <input
            type="date"
            className="htl-input"
            value={filterBaslangic}
            onChange={(e) => setFilterBaslangic(e.target.value)}
          />
        </div>

        <div>
          <label className="htl-label" style={{ marginBottom: 4 }}>Bitiş</label>
          <input
            type="date"
            className="htl-input"
            value={filterBitis}
            onChange={(e) => setFilterBitis(e.target.value)}
          />
        </div>

        <div style={{ minWidth: 220, flex: 1 }}>
          <label className="htl-label" style={{ marginBottom: 4 }}>Açıklamada Ara</label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--ink-faint)' }}
            >
              <Icon name="search" size={14} />
            </span>
            <input
              type="text"
              className="htl-input"
              style={{ paddingLeft: 32 }}
              placeholder="Açıklamada ara..."
              value={filterMetin}
              onChange={(e) => setFilterMetin(e.target.value)}
            />
          </div>
        </div>

        {isFiltered && (
          <button type="button" className="htl-btn htl-btn-ghost" onClick={clearFilters}>
            <Icon name="x" size={14} />
            <span>Filtreyi Temizle</span>
          </button>
        )}
      </div>

      {/* Özet satırı */}
      {!fetching && loaded.length > 0 && (
        <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>
          {filtered.length === loaded.length
            ? `${loaded.length} kayıt yüklendi`
            : `${filtered.length} kayıt gösteriliyor (toplam ${loaded.length} yüklendi)`}
          {hasMore && ' · daha fazlası mevcut'}
        </div>
      )}

      {/* Tablo */}
      {fetching && loaded.length === 0 ? (
        <div className="htl-empty">
          <p>Yükleniyor...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="htl-empty">
          {isFiltered ? 'Bu filtreye uyan aktivite kaydı yok.' : 'Henüz aktivite kaydı yok.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--line-soft)' }}>
          <table className="htl-table">
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Tarih</th>
                <th>Kullanıcı</th>
                <th>Aksiyon</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const u = users.find((x) => x.id === log.kullaniciId);
                const kullaniciAd = u
                  ? (u.adSoyad || u.kullaniciAdi)
                  : (log.kullaniciAd || '—');
                return (
                  <tr key={log.id}>
                    <td className="text-sm whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>
                      {fmtTS(log.tarih)}
                    </td>
                    <td className="text-sm font-medium">{kullaniciAd}</td>
                    <td>
                      <span
                        className="htl-badge htl-badge-neutral"
                        style={{ whiteSpace: 'nowrap', fontFamily: 'DM Sans' }}
                      >
                        {AKSIYON_TIPLERI[log.aksiyon] || log.aksiyon}
                      </span>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                      {log.aciklama || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Daha fazla yükle */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="htl-btn htl-btn-ghost"
            onClick={loadMore}
            disabled={fetching}
          >
            <Icon name="chevron-down" size={16} />
            <span>
              {fetching ? 'Yükleniyor...' : `+50 daha yükle (${loaded.length} gösteriliyor)`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AktiviteSettings;
