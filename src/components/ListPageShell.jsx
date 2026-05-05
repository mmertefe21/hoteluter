/**
 * ListPageShell — Misafirler/Odalar/Kullanıcılar gibi liste sayfaları için ortak iskele.
 *
 * Kart başlığı (icon + title), arama input'u, "Yeni" butonu ve children olarak
 * tablo/list gövdesini saran wrapper. Misafirler/Odalar/Kullanıcılar gibi sayfalarda
 * tekrarın önüne geçer.
 *
 * Props:
 *   title        : string — kart başlığı
 *   icon         : string — başlığın yanında lucide ikon (ops.)
 *   search       : string | undefined — undefined ise arama gösterilmez
 *   setSearch    : (v) => void
 *   searchPlaceholder : string (varsayılan 'Ara...')
 *   onAdd        : () => void
 *   addLabel     : string (varsayılan 'Yeni')
 *   canAdd       : boolean — false ise + butonu görünmez
 *   children     : tablo/list gövdesi
 */
import Icon from './Icon.jsx';

const ListPageShell = ({
  title,
  icon,
  search,
  setSearch,
  searchPlaceholder = 'Ara...',
  onAdd,
  addLabel = 'Yeni',
  canAdd = true,
  children,
}) => (
  <div className="htl-card">
    <div className="htl-card-header">
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {(title || icon) && (
          <div className="flex items-center gap-2 mr-3">
            {icon && (
              <span style={{ color: 'var(--brass)' }}>
                <Icon name={icon} size={20} />
              </span>
            )}
            {title && (
              <h2
                className="font-display text-xl font-medium"
                style={{ color: 'var(--forest)' }}
              >
                {title}
              </h2>
            )}
          </div>
        )}

        {search !== undefined && (
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--ink-faint)' }}
            >
              <Icon name="search" size={16} />
            </span>
            <input
              className="htl-input"
              placeholder={searchPlaceholder}
              style={{ paddingLeft: 36, minWidth: 260 }}
              value={search}
              onChange={(e) => setSearch?.(e.target.value)}
            />
          </div>
        )}
      </div>

      {canAdd && onAdd && (
        <button type="button" className="htl-btn htl-btn-accent" onClick={onAdd}>
          <Icon name="plus" size={16} stroke="white" />
          <span>{addLabel}</span>
        </button>
      )}
    </div>
    {children}
  </div>
);

export default ListPageShell;
