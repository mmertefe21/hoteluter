import React, { useState, useEffect } from 'react';
import { auth, db as firestore } from './lib/firebase.js';
import { db } from './lib/db.js';
import { ensureKurlarLoaded, getActiveKurlar, fetchKurlar, cevirKur } from './lib/kur.js';
import { fmtMoney, todayISO, addDays, diffDays } from './lib/helpers.js';
import { runMigrations } from './lib/migrations.js';
import { PARA_BIRIMI_OPTS, DURUM_OPTS, HESAP_TIP_OPTS } from './lib/constants.js';
import { ALL_MODULES } from './lib/permissions.js';

/**
 * Hoteluter — Görev 4 Test Sayfası
 *
 * Tüm lib/ ve helpers/ modüllerinin import edilebildiğini ve çalıştığını
 * doğrulayan health-check ekranı.
 *
 * Sonraki görevde bu dosya gerçek App.jsx'e (router + AuthProvider) dönüşür.
 */
const App = () => {
  const [firebaseStatus, setFirebaseStatus] = useState('Kontrol ediliyor...');
  const [kurStatus, setKurStatus] = useState('Yükleniyor...');
  const [kurlar, setKurlar] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [collections, setCollections] = useState({});

  useEffect(() => {
    if (auth && firestore) setFirebaseStatus('✓ Firebase bağlandı');
    else setFirebaseStatus('✗ Firebase bağlanamadı (.env kontrolü yap)');
  }, []);

  useEffect(() => {
    ensureKurlarLoaded();
    setTimeout(async () => {
      let k = getActiveKurlar();
      if (!k) k = await fetchKurlar();
      if (k) {
        setKurlar(k);
        setKurStatus(`✓ Kurlar hazır (${k.date || 'manuel'})`);
      } else {
        setKurStatus('⚠ Kur yüklenemedi (offline?)');
      }
    }, 500);
  }, []);

  const runMigration = async () => {
    setMigrationRunning(true);
    try {
      const result = await runMigrations();
      setMigrationResult(result);
    } catch (e) {
      setMigrationResult({ error: e.message });
    } finally {
      setMigrationRunning(false);
    }
  };

  const checkCollections = async () => {
    const colls = ['kanallar', 'giderKategorileri', 'hesaplar', 'odalar', 'rezervasyonlar', 'misafirler'];
    const res = {};
    for (const c of colls) {
      try {
        const list = await db.list(c);
        res[c] = list.length;
      } catch (e) {
        res[c] = 'hata';
      }
    }
    setCollections(res);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f7f4ec',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: '#2c4a3a',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        background: '#fefcf6',
        border: '1px solid #d4c8a8',
        borderRadius: 12,
        padding: 32,
        boxShadow: '0 4px 12px rgba(44,74,58,.08)'
      }}>
        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 28,
          fontWeight: 500,
          color: '#a87842',
          margin: '0 0 4px 0'
        }}>Hoteluter</h1>
        <p style={{ fontSize: 13, color: '#5a6b5e', margin: '0 0 24px 0' }}>
          Görev 4 — Lib & Helpers test paneli
        </p>

        <Section title="1. Firebase">
          <Row label="Bağlantı" value={firebaseStatus} ok={firebaseStatus.startsWith('✓')} />
        </Section>

        <Section title="2. Kur Servisi">
          <Row label="Frankfurter API" value={kurStatus} ok={kurStatus.startsWith('✓')} />
          {kurlar && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#7a8a7e' }}>
              EUR: 1 ·
              USD: {kurlar.rates.USD?.toFixed(4)} ·
              TRY: {kurlar.rates.TRY?.toFixed(4)} ·
              GBP: {kurlar.rates.GBP?.toFixed(4)}
            </div>
          )}
          {kurlar && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#7a8a7e' }}>
              cevirKur(100, 'USD', 'EUR') = {cevirKur(100, 'USD', 'EUR', kurlar)?.toFixed(2) || '—'} EUR
            </div>
          )}
        </Section>

        <Section title="3. Helpers">
          <Row label="todayISO()" value={todayISO()} />
          <Row label="addDays(today, 7)" value={addDays(todayISO(), 7)} />
          <Row label="diffDays(today, +30)" value={`${diffDays(todayISO(), addDays(todayISO(), 30))} gün`} />
          <Row label="fmtMoney(1234.56, 'EUR')" value={fmtMoney(1234.56, 'EUR')} />
          <Row label="fmtMoney(1234.56, 'TRY')" value={fmtMoney(1234.56, 'TRY')} />
        </Section>

        <Section title="4. Constants">
          <Row label="Para Birimleri" value={`${PARA_BIRIMI_OPTS.length} adet (${PARA_BIRIMI_OPTS.map(p => p.symbol).join(' ')})`} />
          <Row label="Hesap Tipleri" value={`${HESAP_TIP_OPTS.length} adet`} />
          <Row label="Rez Durumları" value={`${DURUM_OPTS.length} adet`} />
          <Row label="Modüller" value={`${ALL_MODULES.length} adet`} />
        </Section>

        <Section title="5. Migration (Firestore Seed)">
          <p style={{ fontSize: 13, color: '#5a6b5e', margin: '0 0 12px 0' }}>
            ⚠ Sadece bir kez çalıştır. Default 5 kanal + 8 gider kategorisi + 3 hesap eklenir.
            Demo veri YOK.
          </p>
          <button
            onClick={runMigration}
            disabled={migrationRunning}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              background: migrationRunning ? '#d4c8a8' : '#1f3a2e',
              color: 'white',
              border: 'none',
              cursor: migrationRunning ? 'wait' : 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}>
            {migrationRunning ? 'Çalışıyor...' : 'Migration Çalıştır'}
          </button>
          {migrationResult && (
            <pre style={{
              marginTop: 12,
              background: '#f0e8d0',
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              color: '#2c4a3a',
              overflow: 'auto'
            }}>
              {JSON.stringify(migrationResult, null, 2)}
            </pre>
          )}
        </Section>

        <Section title="6. DB Adapter (Firestore)">
          <button
            onClick={checkCollections}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              background: '#a87842',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}>
            Koleksiyonları Kontrol Et
          </button>
          {Object.keys(collections).length > 0 && (
            <div style={{ marginTop: 12 }}>
              {Object.entries(collections).map(([k, v]) => (
                <Row key={k} label={k} value={`${v} kayıt`} />
              ))}
            </div>
          )}
        </Section>

        <div style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid #e8e0cd',
          fontSize: 12,
          color: '#7a8a7e',
          textAlign: 'center'
        }}>
          Görev 4: Lib & Helpers · Sıradaki: Görev 5 (Components)
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 24 }}>
    <h3 style={{
      fontFamily: "'Fraunces', serif",
      fontSize: 16,
      fontWeight: 500,
      color: '#1f3a2e',
      margin: '0 0 12px 0'
    }}>{title}</h3>
    {children}
  </div>
);

const Row = ({ label, value, ok = null }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 12px',
    background: '#f0e8d0',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 4
  }}>
    <span style={{ color: '#5a6b5e' }}>{label}</span>
    <span style={{
      fontFamily: 'monospace',
      color: ok === false ? '#a64545' : ok === true ? '#4a7c59' : '#1a1a1a'
    }}>{value}</span>
  </div>
);

export default App;
