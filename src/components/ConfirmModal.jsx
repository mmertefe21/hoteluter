/**
 * ConfirmModal — onay diyaloğu.
 *
 * Props:
 *   open          : boolean
 *   title         : string
 *   msg           : string | ReactNode — açıklama metni
 *   onConfirm     : () => void
 *   onCancel      : () => void
 *   confirmLabel  : string (varsayılan 'Sil')
 *   cancelLabel   : string (varsayılan 'Vazgeç')
 *   danger        : boolean — true ise primary action kırmızı görünür (varsayılan true)
 */
import Modal from './Modal.jsx';

const ConfirmModal = ({
  open,
  title,
  msg,
  onConfirm,
  onCancel,
  confirmLabel = 'Sil',
  cancelLabel = 'Vazgeç',
  danger = true,
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    size="sm"
    footer={
      <>
        <button type="button" className="htl-btn htl-btn-ghost" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`htl-btn ${danger ? 'htl-btn-danger' : 'htl-btn-primary'}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </>
    }
  >
    <p style={{ color: 'var(--ink-soft)' }}>{msg}</p>
  </Modal>
);

export default ConfirmModal;
