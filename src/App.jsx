/**
 * App.jsx — Hoteluter v1.0 ana shell.
 *
 * Görev 6B + 7: Sistem ayağa kalktı.
 *
 * - AuthProvider (Firebase Auth — Görev 9'da bağlandı)
 * - ToastProvider
 * - Login durumunda LoginScreen, login sonrası app shell
 * - App shell: header + sidebar + main (activeModule'e göre sayfa)
 * - Mobile drawer
 * - Migration boot: ilk açılışta default kanal/kategori/hesap seed
 */
import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Icon from './components/Icon.jsx';
import { ToastProvider, useToast } from './components/Toast.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { useDoc } from './lib/db.js';
import { runMigrations } from './lib/migrations.js';
import { ensureKurlarLoaded } from './lib/kur.js';
import { initials } from './lib/helpers.js';
import { ALL_MODULES } from './lib/permissions.js';

import LoginScreen from './pages/LoginScreen.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import ReservationListPage from './pages/ReservationListPage.jsx';
import GuestsPage from './pages/GuestsPage.jsx';
import RoomsPage from './pages/RoomsPage.jsx';
import AccountingPage from './pages/AccountingPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

const PAGE_MAP = {
  dashboard: DashboardPage,
  takvim: CalendarPage,
  rezervasyon: ReservationListPage,
  misafirler: GuestsPage,
  odalar: RoomsPage,
  onMuhasebe: AccountingPage,
  raporlar: ReportsPage,
  ayarlar: SettingsPage,
  kullanicilar: UsersPage,
};

const App = () => (
  <AuthProvider>
    <ToastProvider>
      <Bootstrap />
    </ToastProvider>
  </AuthProvider>
);

const Bootstrap = () => {
  const { user, authReady } = useAuth();
  const { show } = useToast();
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    ensureKurlarLoaded();
  }, []);

  useEffect(() => {
    if (!user || migrated) return;
    (async () => {
      try {
        await runMigrations();
      } catch (e) {
        show('Migration hatası: ' + e.message, 'error');
      } finally {
        setMigrated(true);
      }
    })();
  }, [user, migrated]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bone)' }}>
        <Icon name="loader-2" size={32} stroke="var(--brass)" className="animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;
  return <AppShell />;
};

const AppShell = () => {
  const { user, can, logout } = useAuth();
  const otel = useDoc('otel', 'main');
  const [activeModule, setActiveModule] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const PageCmp = PAGE_MAP[activeModule] || DashboardPage;
  const activeLabel = ALL_MODULES.find((m) => m.key === activeModule)?.ad || 'Hoteluter';

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bone)' }}>
      <header className="h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-20"
        style={{ background: 'var(--bone-light)', borderBottom: '1px solid var(--line)' }}>
        <div className="flex items-center gap-3">
          <button type="button" className="md:hidden p-2 rounded-md hover:bg-[var(--bone-warm)]"
            onClick={() => setDrawerOpen(true)} aria-label="Menüyü aç">
            <Icon name="menu" size={20} />
          </button>
          <div className="font-display text-lg font-medium" style={{ color: 'var(--forest)' }}>
            {activeLabel}
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          <div className="hidden md:block text-right mr-2">
            <div className="text-sm font-medium leading-tight">{user.adSoyad}</div>
            <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
              {user.rol === 'superadmin' ? 'Süperadmin' : user.rol === 'admin' ? 'Admin' : 'Kullanıcı'}
            </div>
          </div>
          <button type="button" onClick={() => setUserMenuOpen(!userMenuOpen)} className="htl-avatar hover:opacity-90">
            {initials(user.adSoyad)}
          </button>
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-12 w-56 z-40 rounded-lg shadow-lg overflow-hidden"
                style={{ background: 'var(--bone-light)', border: '1px solid var(--line)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--line-soft)', background: 'var(--bone)' }}>
                  <div className="font-medium text-sm">{user.adSoyad}</div>
                  <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>{user.email || user.kullaniciAdi}</div>
                </div>
                <button type="button" onClick={() => { setUserMenuOpen(false); setActiveModule('ayarlar'); }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--bone-warm)] flex items-center gap-2">
                  <Icon name="settings" size={16} />
                  <span>Ayarlar</span>
                </button>
                <button type="button" onClick={() => { setUserMenuOpen(false); logout(); }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--bone-warm)] flex items-center gap-2"
                  style={{ color: 'var(--danger)' }}>
                  <Icon name="log-out" size={16} />
                  <span>Çıkış Yap</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeModule={activeModule}
          onSelect={setActiveModule}
          otelAd={otel?.ad || 'Otel'}
          userRol={user.rol}
          canSeeModule={(key) => can(key, 'goruntule')}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
          versionLabel="v1.0 · Görev 7"
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <PageCmp />
        </main>
      </div>
    </div>
  );
};

export default App;
