/**
 * RezervasyonTipiSecimModal — yeni rezervasyon ekleme akışı için seçim modali.
 *
 * 2 büyük kart-buton: Tek Rezervasyon · Grup Rezervasyonu.
 * Prefill objesini seçilen akışa olduğu gibi geçirir.
 *
 * Props:
 *   open, onClose
 *   prefill            : { odaId?, girisTarihi?, cikisTarihi? } | null
 *   onTekSec(prefill)  : tek rezervasyon akışına geç
 *   onGrupSec(prefill) : grup rezervasyon akışına geç
 */
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';

const RezervasyonTipiSecimModal = ({ open, onClose, prefill = null, onTekSec, onGrupSec }) => {
  const handleTek = () => { onTekSec?.(prefill); onClose?.(); };
  const handleGrup = () => { onGrupSec?.(prefill); onClose?.(); };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Rezervasyon Tipi"
      footer={
        <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <button type="button" onClick={handleTek}
          className="rounded-lg p-5 flex flex-col items-center gap-3 transition hover:shadow-md"
          style={{ background: 'var(--bone-light)', border: '1px solid var(--line)' }}>
          <div className="w-14 h-14 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--brass-soft)' }}>
            <Icon name="user" size={28} stroke="var(--brass)" />
          </div>
          <div className="text-center">
            <div className="font-display text-lg font-medium" style={{ color: 'var(--forest)' }}>Tek Rezervasyon</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>Tek oda, tek misafir/aile</div>
          </div>
        </button>

        <button type="button" onClick={handleGrup}
          className="rounded-lg p-5 flex flex-col items-center gap-3 transition hover:shadow-md"
          style={{ background: 'var(--bone-light)', border: '1px solid var(--line)' }}>
          <div className="w-14 h-14 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--brass-soft)' }}>
            <Icon name="users" size={28} stroke="var(--brass)" />
          </div>
          <div className="text-center">
            <div className="font-display text-lg font-medium" style={{ color: 'var(--forest)' }}>Grup Rezervasyonu</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>Çoklu oda, ortak başlık</div>
          </div>
        </button>
      </div>
    </Modal>
  );
};

export default RezervasyonTipiSecimModal;
