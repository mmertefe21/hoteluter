import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Modal from './components/Modal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import Icon from './components/Icon.jsx';
import { ToastProvider, useToast } from './components/Toast.jsx';
import ListPageShell from './components/ListPageShell.jsx';
import { ALL_MODULES } from './lib/permissions.js';
import { db, useCollection, useDoc } from './lib/db.js';
import { fmtMoney, fmtDateTR } from './lib/helpers.js';
import { HAREKET_TIP_INFO } from './lib/constants.js';
import { runMigrations } from './lib/migrations.js';
import { ensureKurlarLoaded } from './lib/kur.js';
import TahsilatModal from './modals/TahsilatModal.jsx';
import GiderModal from './modals/GiderModal.jsx';
import TransferModal from './modals/TransferModal.jsx';
import HesapFormModal from './modals/HesapFormModal.jsx';
import HesapDetayModal from './modals/HesapDetayModal.jsx';

/**
 * Hoteluter — Health-Check (Görev 5 + 6A)
 *
 * Görev 5: Reusable components (Sidebar, Modal, ConfirmModal, Icon, Toast, ListPageShell)
 * Görev 6A: Mali modaller (Tahsilat, Gider, Transfer, HesapForm, HesapDetay)
 *
 * Sıradaki görevde gerçek router + AuthProvider gelir.
 */

const MOCK_GUESTS = [
  { id: 'g1', ad: 'Ayşe', soyad: 'Yılmaz', telefon: '+90 532 111 22 33', email: 'ayse@example.com', uyruk: 'TR' },
  { id: 'g2', ad: 'John',  soyad: 'Doe',    telefon: '+1 555 0100',       email: 'john@example.com', uyruk: 'US' },
  { id: 'g3', ad: 'Mehmet',soyad: 'Demir',  telefon: '+90 533 444 55 66', email: 'mehmet@example.com', uyruk: 'TR' },
  { id: 'g4', ad: 'Greta', soyad: 'Müller', telefon: '+49 170 5550100',   email: 'greta@example.com', uyruk: 'DE' },
];

const ICON_SAMPLES = [
  'hotel', 'layout-dashboard', 'calendar-days', 'users', 'door-open',
  'wallet', 'receipt', 'bar-chart-3', 'settings', 'log-out',
  'plus', 'search', 'check-circle', 'alert-circle', 'info',
];

const App = () => (
  <ToastProvider>
    <HealthCheck />
  </ToastProvider>
);

const HealthCheck = () => {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { show } = useToast();

  // Mali modal testleri için Firestore subscriptions
  const otel = useDoc('otel', 'main');
  const ana = otel?.anaParaBirimi || 'EUR';
  const hesaplar = useCollection('hesaplar');
  const hesapHareketleri = useCollection('hesapHareketleri');
  const giderKategorileri = useCollection('giderKategorileri');
  const tahsilatlar = useCollection('tahsilatlar');
  const giderler = useCollection('giderler');

  // Modal state
  const [tahsilatOpen, setTahsilatOpen] = useState(false);
  const [editingTahsilat, setEditingTahsilat] = useState(null);
  const [giderOpen, setGiderOpen] = useState(false);
  const [editingGider, setEditingGider] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [hesapFormOpen, setHesapFormOpen] = useState(false);
  const [editingHesap, setEditingHesap] = useState(null);
  const [hesapDetay, setHesapDetay] = useState(null);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    ensureKurlarLoaded();
  }, []);

  const eksikSeed = hesaplar.length === 0 || giderKategorileri.length === 0;

  const runSeed = async () => {
    setMigrating(true);
    try {
      const r = await runMigrations();
      show(`Migration tamam: ${JSON.stringify(r)}`, 'success');
    } catch (e) {
      show('Migration hatası: ' + e.message, 'error');
    } finally {
      setMigrating(false);
    }
  };

  const filteredGuests = MOCK_GUESTS.filter((g) => {
    if (!search) return true;
    const hay = `${g.ad} ${g.soyad} ${g.telefon} ${g.email} ${g.uyruk}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const activeLabel = ALL_MODULES.find((m) => m.key === activeModule)?.ad ?? 'Hoteluter';

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bone)' }}>
      <header
        className="h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-20"
        style={{ background: 'var(--bone-light)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden p-2 rounded-md hover:bg-[var(--bone-warm)]"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menüyü aç"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="font-display text-lg font-medium" style={{ color: 'var(--forest)' }}>
            {activeLabel}
          </div>
          <span className="htl-badge htl-badge-info">Görev 5 · Health-Check</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: 'var(--ink-faint)' }}>
          <span>v1.0 · components</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeModule={activeModule}
          onSelect={setActiveModule}
          otelAd="Hoteluter Test"
          userRol="superadmin"
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <Section title="Modal & Onay">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="htl-btn htl-btn-primary" onClick={() => setModalOpen(true)}>
                <Icon name="square-pen" size={16} stroke="white" />
                <span>Modal Aç</span>
              </button>
              <button type="button" className="htl-btn htl-btn-danger" onClick={() => setConfirmOpen(true)}>
                <Icon name="trash-2" size={16} stroke="white" />
                <span>Onay İste</span>
              </button>
            </div>
          </Section>

          <Section title="Toast Bildirimleri">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="htl-btn"
                style={{ background: 'var(--success)', color: 'white' }}
                onClick={() => show('Kayıt başarıyla güncellendi.', 'success')}
              >
                <Icon name="check-circle" size={16} stroke="white" />
                <span>Success</span>
              </button>
              <button
                type="button"
                className="htl-btn htl-btn-danger"
                onClick={() => show('Bağlantı hatası — tekrar deneyin.', 'error')}
              >
                <Icon name="alert-circle" size={16} stroke="white" />
                <span>Error</span>
              </button>
              <button
                type="button"
                className="htl-btn"
                style={{ background: 'var(--info)', color: 'white' }}
                onClick={() => show('Yeni rezervasyon eklendi.', 'info')}
              >
                <Icon name="info" size={16} stroke="white" />
                <span>Info</span>
              </button>
            </div>
          </Section>

          <Section title="Icon Örnekleri">
            <div className="flex flex-wrap gap-3">
              {ICON_SAMPLES.map((n) => (
                <div
                  key={n}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-md"
                  style={{ background: 'var(--bone-light)', border: '1px solid var(--line-soft)', minWidth: 96 }}
                >
                  <span style={{ color: 'var(--forest)' }}>
                    <Icon name={n} size={22} />
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>{n}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="ListPageShell (mock misafir tablosu)">
            <ListPageShell
              title="Misafirler"
              icon="users"
              search={search}
              setSearch={setSearch}
              searchPlaceholder="Misafir ara..."
              onAdd={() => show('Yeni misafir formu (mock).', 'info')}
              addLabel="Yeni Misafir"
              canAdd
            >
              {filteredGuests.length === 0 ? (
                <div className="htl-empty">Eşleşen kayıt yok.</div>
              ) : (
                <table className="htl-table">
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>Telefon</th>
                      <th>E-posta</th>
                      <th>Uyruk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGuests.map((g) => (
                      <tr key={g.id}>
                        <td className="font-medium">{g.ad} {g.soyad}</td>
                        <td>{g.telefon}</td>
                        <td>{g.email}</td>
                        <td>
                          <span className="htl-badge htl-badge-neutral">{g.uyruk}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ListPageShell>
          </Section>

          <Section title="Sidebar Durumu">
            <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              Aktif modül: <code style={{ background: 'var(--bone-warm)', padding: '2px 6px', borderRadius: 4 }}>{activeModule}</code>
              <span className="mx-2">·</span>
              <button
                type="button"
                className="htl-btn htl-btn-ghost md:hidden"
                onClick={() => setDrawerOpen(true)}
              >
                <Icon name="menu" size={14} />
                <span>Mobile Drawer'ı Aç</span>
              </button>
              <span className="hidden md:inline">Mobile drawer testi için ekranı &lt; 768px'e küçült.</span>
            </div>
          </Section>

          <Section title="Mali Modaller (Görev 6A)">
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
                <span>Ana PB: <strong style={{ color: 'var(--forest)' }}>{ana}</strong></span>
                <span>·</span>
                <span>Hesap: <strong>{hesaplar.length}</strong></span>
                <span>·</span>
                <span>Kategori: <strong>{giderKategorileri.length}</strong></span>
                <span>·</span>
                <span>Hareket: <strong>{hesapHareketleri.length}</strong></span>
                <span>·</span>
                <span>Tahsilat: <strong>{tahsilatlar.length}</strong></span>
                <span>·</span>
                <span>Gider: <strong>{giderler.length}</strong></span>
              </div>

              {eksikSeed && (
                <div
                  className="px-3 py-3 rounded-md flex items-start gap-3"
                  style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
                >
                  <Icon name="alert-triangle" size={18} />
                  <div className="flex-1 text-xs">
                    <strong>Hesap veya kategori yok.</strong> Mali modalleri test etmek için önce migration çalıştır
                    (3 default hesap + 8 gider kategorisi yazılır).
                  </div>
                  <button
                    type="button"
                    className="htl-btn htl-btn-primary"
                    onClick={runSeed}
                    disabled={migrating}
                  >
                    <Icon name="database" size={14} stroke="white" />
                    <span>{migrating ? 'Çalışıyor...' : 'Migration Çalıştır'}</span>
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="htl-btn htl-btn-primary"
                  onClick={() => { setEditingTahsilat(null); setTahsilatOpen(true); }}
                  disabled={hesaplar.length === 0}
                >
                  <Icon name="hand-coins" size={14} stroke="white" />
                  <span>Yeni Tahsilat</span>
                </button>
                <button
                  type="button"
                  className="htl-btn htl-btn-primary"
                  onClick={() => { setEditingGider(null); setGiderOpen(true); }}
                  disabled={hesaplar.length === 0 || giderKategorileri.length === 0}
                >
                  <Icon name="receipt" size={14} stroke="white" />
                  <span>Yeni Gider</span>
                </button>
                <button
                  type="button"
                  className="htl-btn htl-btn-primary"
                  onClick={() => setTransferOpen(true)}
                  disabled={hesaplar.length < 2}
                >
                  <Icon name="arrow-left-right" size={14} stroke="white" />
                  <span>Transfer</span>
                </button>
                <button
                  type="button"
                  className="htl-btn htl-btn-accent"
                  onClick={() => { setEditingHesap(null); setHesapFormOpen(true); }}
                >
                  <Icon name="plus" size={14} stroke="white" />
                  <span>Yeni Hesap</span>
                </button>
              </div>

              {hesaplar.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-soft)' }}>
                    Hesaplar — tıkla detay
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {hesaplar.map((h) => {
                      const pb = h.paraBirimi || ana;
                      const bakiye = hesapHareketleri
                        .filter((x) => x.hesapId === h.id)
                        .reduce((s, x) => s + Number(x.tutar || 0), 0);
                      return (
                        <div
                          key={h.id}
                          className="rounded-md p-3 cursor-pointer hover:shadow-sm transition"
                          style={{
                            background: 'var(--bone-light)',
                            border: '1px solid var(--line-soft)',
                          }}
                          onClick={() => setHesapDetay(h)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate" style={{ color: 'var(--forest)' }}>
                                {h.ad}
                                {h.aktif === false && (
                                  <span className="htl-badge htl-badge-danger ml-2" style={{ fontSize: 9 }}>
                                    Pasif
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                                {h.tip} · {pb}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className="font-display text-base font-medium"
                                style={{ color: bakiye >= 0 ? 'var(--forest)' : 'var(--danger)' }}
                              >
                                {fmtMoney(bakiye, pb)}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-[var(--bone-warm)]"
                              style={{ color: 'var(--ink-soft)' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingHesap(h);
                                setHesapFormOpen(true);
                              }}
                              title="Düzenle"
                            >
                              <Icon name="square-pen" size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {hesapHareketleri.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-soft)' }}>
                    Son 5 Hareket
                  </div>
                  <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--line-soft)' }}>
                    <table className="htl-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Tarih</th>
                          <th>Tip</th>
                          <th>Açıklama</th>
                          <th className="text-right">Tutar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...hesapHareketleri]
                          .sort((a, b) => `${b.tarih}`.localeCompare(`${a.tarih}`))
                          .slice(0, 5)
                          .map((h) => {
                            const ti = HAREKET_TIP_INFO(h.tip);
                            const isPos = Number(h.tutar) >= 0;
                            const hesap = hesaplar.find((x) => x.id === h.hesapId);
                            const pb = hesap?.paraBirimi || ana;
                            return (
                              <tr key={h.id}>
                                <td>{fmtDateTR(h.tarih)}</td>
                                <td>
                                  <span className={`htl-badge ${isPos ? 'htl-badge-success' : 'htl-badge-danger'}`}>
                                    {ti.l}
                                  </span>
                                </td>
                                <td className="truncate" style={{ maxWidth: 320 }}>{h.aciklama || '-'}</td>
                                <td
                                  className="text-right font-medium"
                                  style={{ color: isPos ? 'var(--success)' : 'var(--danger)' }}
                                >
                                  {isPos ? '+' : ''}
                                  {fmtMoney(h.tutar, pb)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tahsilatlar.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs" style={{ color: 'var(--ink-soft)' }}>
                    Son tahsilatlar ({tahsilatlar.length}) — düzenleme testi
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...tahsilatlar].slice(-5).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="htl-btn htl-btn-ghost text-xs"
                        onClick={() => { setEditingTahsilat(t); setTahsilatOpen(true); }}
                      >
                        <Icon name="square-pen" size={12} />
                        <span>{fmtMoney(t.tutar, t.paraBirimi || ana)} · {fmtDateTR(t.tarih)}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}

              {giderler.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs" style={{ color: 'var(--ink-soft)' }}>
                    Son giderler ({giderler.length}) — düzenleme testi
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...giderler].slice(-5).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className="htl-btn htl-btn-ghost text-xs"
                        onClick={() => { setEditingGider(g); setGiderOpen(true); }}
                      >
                        <Icon name="square-pen" size={12} />
                        <span>{fmtMoney(g.tutar, g.paraBirimi || ana)} · {fmtDateTR(g.tarih)}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </Section>
        </main>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Test Modal"
        size="md"
        footer={
          <>
            <button type="button" className="htl-btn htl-btn-ghost" onClick={() => setModalOpen(false)}>
              Kapat
            </button>
            <button
              type="button"
              className="htl-btn htl-btn-primary"
              onClick={() => {
                setModalOpen(false);
                show('Modal kaydedildi.', 'success');
              }}
            >
              <Icon name="check" size={16} stroke="white" />
              <span>Kaydet</span>
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--ink-soft)' }}>
          Modal.jsx — size <code>md</code>, footer ile. Esc tuşu veya backdrop tıklaması kapatır.
        </p>
        <div className="mt-4">
          <label className="htl-label">Örnek input</label>
          <input className="htl-input" placeholder="Form alanı..." />
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="Kaydı sil"
        msg="Bu işlem geri alınamaz. Devam etmek istediğine emin misin?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          show('Kayıt silindi.', 'success');
        }}
        confirmLabel="Evet, sil"
        danger
      />

      <TahsilatModal
        open={tahsilatOpen}
        onClose={() => { setTahsilatOpen(false); setEditingTahsilat(null); }}
        target={editingTahsilat}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        tahsilatlar={tahsilatlar}
        ana={ana}
        userId="health-check"
      />

      <GiderModal
        open={giderOpen}
        onClose={() => { setGiderOpen(false); setEditingGider(null); }}
        target={editingGider}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        kategoriler={giderKategorileri}
        ana={ana}
        userId="health-check"
      />

      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        ana={ana}
        userId="health-check"
      />

      <HesapFormModal
        open={hesapFormOpen}
        onClose={() => { setHesapFormOpen(false); setEditingHesap(null); }}
        target={editingHesap}
        hesapHareketleri={hesapHareketleri}
        ana={ana}
      />

      <HesapDetayModal
        open={!!hesapDetay}
        onClose={() => setHesapDetay(null)}
        hesap={hesapDetay}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        ana={ana}
        userId="health-check"
        canDelete
      />
    </div>
  );
};

const Section = ({ title, children }) => (
  <section className="htl-card">
    <div className="htl-card-header">
      <h3 className="font-display text-lg font-medium" style={{ color: 'var(--forest)' }}>
        {title}
      </h3>
    </div>
    <div className="htl-card-body">{children}</div>
  </section>
);

export default App;
