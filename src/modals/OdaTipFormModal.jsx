/**
 * OdaTipFormModal — oda tipi ekle/düzenle.
 */
import { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';

const PRESET_RENKLER = ['#4a6b85', '#a87842', '#4a7c59', '#8e5572', '#5e6b8e', '#c87f3e', '#a64545', '#6b6b6b'];
const DEFAULT = { ad: '', kapasiteYetiskin: 2, kapasiteCocuk: 0, varsayilanFiyat: 0, aciklama: '', renk: PRESET_RENKLER[0] };

const OdaTipFormModal = ({ open, onClose, onSaved, target = null }) => {
  const { show } = useToast();
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(target ? { ...DEFAULT, ...target } : DEFAULT);
  }, [open, target?.id]);

  const save = async () => {
    if (!form.ad?.trim()) return show('Ad zorunlu.', 'error');
    setSaving(true);
    try {
      if (target) {
        await db.update('odaTipleri', target.id, form);
        show('Oda tipi güncellendi.');
      } else {
        await db.add('odaTipleri', form);
        show('Oda tipi eklendi.');
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={target ? 'Oda Tipini Düzenle' : 'Yeni Oda Tipi'}
      footer={<>
        <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
        <button type="button" className="htl-btn htl-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} stroke="white" /><span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
        </button>
      </>}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><label className="htl-label">Ad *</label><input className="htl-input" placeholder="Standart, Deluxe, Suite..." value={form.ad || ''} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></div>
        <div><label className="htl-label">Yetişkin Kapasite</label><input type="number" min="1" className="htl-input" value={form.kapasiteYetiskin || 1} onChange={(e) => setForm({ ...form, kapasiteYetiskin: Number(e.target.value) })} /></div>
        <div><label className="htl-label">Çocuk Kapasite</label><input type="number" min="0" className="htl-input" value={form.kapasiteCocuk || 0} onChange={(e) => setForm({ ...form, kapasiteCocuk: Number(e.target.value) })} /></div>
        <div className="md:col-span-2"><label className="htl-label">Varsayılan Gece Fiyatı</label><input type="number" min="0" step="0.01" className="htl-input" value={form.varsayilanFiyat || 0} onChange={(e) => setForm({ ...form, varsayilanFiyat: Number(e.target.value) })} /></div>
        <div className="md:col-span-2">
          <label className="htl-label">Takvim Rengi</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_RENKLER.map((r) => (
              <button key={r} type="button" onClick={() => setForm({ ...form, renk: r })}
                className="w-9 h-9 rounded-full transition"
                style={{ background: r, border: form.renk === r ? '3px solid var(--ink)' : '2px solid transparent' }} />
            ))}
          </div>
        </div>
        <div className="md:col-span-2"><label className="htl-label">Açıklama</label><textarea rows="2" className="htl-input" value={form.aciklama || ''} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></div>
      </div>
    </Modal>
  );
};

export default OdaTipFormModal;
