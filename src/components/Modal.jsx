/**
 * Modal — genel amaçlı modal wrapper.
 *
 * Props:
 *   open      : boolean — açık mı
 *   onClose   : () => void
 *   title     : string
 *   size      : 'sm' | 'md' (varsayılan) | 'lg'
 *   footer    : ReactNode — alt bant (genellikle butonlar)
 *   children  : body içeriği
 *
 * Davranış: Esc tuşu kapatır, backdrop tıklaması kapatır, içerik tıklaması kapatmaz.
 */
import { useEffect } from 'react';
import Icon from './Icon.jsx';

const SIZE_CLASS = {
  sm: 'htl-modal-sm',
  md: '',
  lg: 'htl-modal-lg',
};

const Modal = ({ open, onClose, title, children, size = 'md', footer = null }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeCls = SIZE_CLASS[size] ?? '';

  return (
    <div className="htl-modal-backdrop" onClick={onClose}>
      <div
        className={`htl-modal ${sizeCls}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--line-soft)' }}
        >
          <h3 className="font-display text-xl font-medium" style={{ color: 'var(--forest)' }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--bone-warm)]"
            style={{ color: 'var(--ink-soft)' }}
            aria-label="Kapat"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div
            className="px-6 py-4 border-t flex justify-end gap-2"
            style={{ borderColor: 'var(--line-soft)', background: 'var(--bone)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
