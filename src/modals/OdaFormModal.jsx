/**
 * OdaFormModal — oda ekle/düzenle.
 */
import { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';

const ODA_DURUM_OPTS = [
  { v: 'musait', l: 'Müsait' },
  { v: 'temizlik', l: 'Temizlik' },
  { v: 'ariza', l: 'Arıza' },
  { v: 'blokeli', l: 'Blokeli' },
];

const OdaFormModal = ({ open, onClose, onSaved, target = null, odaTipleri = [] }) => {
  const { show } = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(target || { odaTipiId: odaTipleri[0]?.id || '', odaNumarasi: '', kat: 1, durum: 'musait', aciklama: '' });
  }, [open, target?.id]);

  const save = async () => {
    if (!form.odaNumarasi?.toString().trim()) return show('Oda numarası zorunlu.', 'error');
    if (!form.odaTipiId) return show('Oda tipi seçilmeli.', 'error');
    setSaving(true);
    try {
      if (target) {
        await db.update('odalar', target.id, form);
        show('Oda güncellendi.');
      } else {
        await db.add('odalar', form);
        show('Oda eklendi.');
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
    <Modal open={open} onClose={onClose} title={target ? 'Odayı Düzenle' : 'Yeni Oda'}
      footer={<>
        <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
        <button type="button" className="htl-btn htl-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} stroke="white" /><span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
        </button>
      </>}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div><label className="htl-label">Oda Numarası *</label><input className="htl-input" value={form.odaNumarasi || ''} onChange={(e) => setForm({ ...form, odaNumarasi: e.target.value })} /></div>
        <div><label className="htl-label">Kat</label><input type="number" className="htl-input" value={form.kat ?? 1} onChange={(e) => setForm({ ...form, kat: Number(e.target.value) })} /></div>
        <div className="md:col-span-2">
          <label className="htl-label">Oda Tipi *</label>
          <select className="htl-input" value={form.odaTipiId || ''} onChange={(e) => setForm({ ...form, odaTipiId: e.target.value })}>
            <option value="">— Seçiniz —</option>
            {odaTipleri.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
          </select>
          {odaTipleri.length === 0 && (
            <div className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Önce bir oda tipi ekleyin.</div>
          )}
        </div>
        <div>
          <label className="htl-label">Durum</label>
          <select className="htl-input" value={form.durum || 'musait'} onChange={(e) => setForm({ ...form, durum: e.target.value })}>
            {ODA_DURUM_OPTS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
          </select>
        </div>
        <div><label className="htl-label">Açıklama</label><input className="htl-input" value={form.aciklama || ''} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} /></div>
      </div>
    </Modal>
  );
};

export default OdaFormModal;
