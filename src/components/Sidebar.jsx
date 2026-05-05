/**
 * Sidebar — sol gezinme menüsü.
 *
 * ALL_MODULES'tan dinamik link üretir; hideFromSidebar olanları + superadmin
 * gerektirenleri filtreler. Mobile için drawer modu destekler.
 *
 * Props:
 *   activeModule    : string — şu an aktif modülün key'i
 *   onSelect        : (moduleKey) => void
 *   otelAd          : string — header altında görünür (fallback 'Otel')
 *   userRol         : 'superadmin' | 'admin' | 'kullanici' (varsayılan 'admin')
 *   canSeeModule    : (key) => boolean — auth.can(key,'goruntule') için inject point
 *   drawerOpen      : boolean — mobile drawer açık mı
 *   onCloseDrawer   : () => void
 *   versionLabel    : string — alt etiket (varsayılan 'v1.0')
 */
import { ALL_MODULES } from '../lib/permissions.js';
import Icon from './Icon.jsx';

const SidebarPanel = ({ activeModule, onSelect, otelAd, modules, versionLabel }) => (
  <aside
    className="w-60 flex-shrink-0 flex flex-col h-full"
    style={{ background: 'var(--forest)' }}
  >
    <div
      className="px-5 py-5 flex items-center gap-3"
      style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--brass)' }}
      >
        <Icon name="hotel" size={20} stroke="white" />
      </div>
      <div className="min-w-0">
        <div
          className="font-display text-lg font-medium leading-tight"
          style={{ color: 'var(--bone-light)' }}
        >
          Hoteluter
        </div>
        <div
          className="text-[11px] truncate"
          style={{ color: 'rgba(244,237,224,.5)' }}
        >
          {otelAd || 'Otel'}
        </div>
      </div>
    </div>

    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
      {modules.map((m) => (
        <div key={m.key} className="relative">
          <span
            className="htl-sidebar-indicator"
            style={{ opacity: activeModule === m.key ? 1 : 0 }}
          />
          <button
            type="button"
            className={`htl-sidebar-link w-full text-left ${activeModule === m.key ? 'active' : ''}`}
            onClick={() => onSelect?.(m.key)}
          >
            <Icon name={m.icon} size={18} strokeWidth={1.6} />
            <span>{m.ad}</span>
          </button>
        </div>
      ))}
    </nav>

    <div
      className="px-3 py-3"
      style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}
    >
      <div
        className="text-[10px] tracking-wider uppercase px-3"
        style={{ color: 'rgba(244,237,224,.4)' }}
      >
        {versionLabel}
      </div>
    </div>
  </aside>
);

const Sidebar = ({
  activeModule,
  onSelect,
  otelAd = 'Otel',
  userRol = 'admin',
  canSeeModule = () => true,
  drawerOpen = false,
  onCloseDrawer,
  versionLabel = 'v1.0 · MVP',
}) => {
  const modules = ALL_MODULES.filter((m) => {
    if (m.hideFromSidebar) return false;
    if (m.superadminOnly && userRol !== 'superadmin') return false;
    return canSeeModule(m.key);
  });

  const handleSelect = (key) => {
    onSelect?.(key);
    if (drawerOpen) onCloseDrawer?.();
  };

  const panel = (
    <SidebarPanel
      activeModule={activeModule}
      onSelect={handleSelect}
      otelAd={otelAd}
      modules={modules}
      versionLabel={versionLabel}
    />
  );

  return (
    <>
      <div className="hidden md:flex h-full">{panel}</div>
      {drawerOpen && (
        <>
          <div className="htl-drawer-backdrop md:hidden" onClick={onCloseDrawer} />
          <div className="fixed left-0 top-0 bottom-0 z-50 md:hidden" style={{ width: 240 }}>
            {panel}
          </div>
        </>
      )}
    </>
  );
};

export default Sidebar;
