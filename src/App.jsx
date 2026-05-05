import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Modal from './components/Modal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import Icon from './components/Icon.jsx';
import { ToastProvider, useToast } from './components/Toast.jsx';
import ListPageShell from './components/ListPageShell.jsx';
import { ALL_MODULES } from './lib/permissions.js';

/**
 * Hoteluter — Görev 5 Health-Check
 *
 * Tüm reusable component'lerin (Sidebar, Modal, ConfirmModal, Icon, Toast,
 * ListPageShell) render edilebildiğini ve etkileşimlerinin çalıştığını doğrular.
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
