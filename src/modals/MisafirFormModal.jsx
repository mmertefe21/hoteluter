/**
 * MisafirFormModal — misafir ekle/düzenle.
 */
import { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';

const DEFAULT = {
  ad: '', soyad: '', tcKimlik: '', pasaportNo: '', uyruk: 'TR',
  telefon: '', email: '', adres: '', sehir: '', ulke: 'Türkiye', notlar: '',
  dogumTarihi: '',
};

const MisafirFormModal = ({ open, onClose, onSaved, target = null }) => {
  const { show } = useToast();
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(target ? { ...DEFAULT, ...target } : DEFAULT);
  }, [open, target?.id]);

  const save = async () => {
    if (!form.ad?.trim() || !form.soyad?.trim()) return show('Ad ve soyad zorunludur.', 'error');
    setSaving(true);
    try {
      if (target) {
        await db.update('misafirler', target.id, form);
        show('Misafir güncellendi.');
      } else {
        await db.add('misafirler', { ...form, olusturmaTarihi: new Date().toISOString() });
        show('Misafir eklendi.');
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
    <Modal open={open} onClose={onClose} title={target ? 'Misafiri Düzenle' : 'Yeni Misafir'}
      footer={<>
        <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
        <button type="button" className="htl-btn htl-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} stroke="white" /><span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
        </button>
      </>}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div><label className="htl-label">Ad *</label><input className="htl-input" value={form.ad || ''} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></div>
        <div><label className="htl-label">Soyad *</label><input className="htl-input" value={form.soyad || ''} onChange={(e) => setForm({ ...form, soyad: e.target.value })} /></div>
        <div><label className="htl-label">TC Kimlik</label><input className="htl-input" value={form.tcKimlik || ''} onChange={(e) => setForm({ ...form, tcKimlik: e.target.value })} /></div>
        <div><label className="htl-label">Pasaport No</label><input className="htl-input" value={form.pasaportNo || ''} onChange={(e) => setForm({ ...form, pasaportNo: e.target.value })} /></div>
        <div><label className="htl-label">Uyruk</label><input className="htl-input" value={form.uyruk || ''} onChange={(e) => setForm({ ...form, uyruk: e.target.value })} /></div>
        <div><label className="htl-label">Doğum Tarihi</label><input type="date" className="htl-input" value={form.dogumTarihi || ''} onChange={(e) => setForm({ ...form, dogumTarihi: e.target.value })} /></div>
        <div><label className="htl-label">Telefon</label><input className="htl-input" value={form.telefon || ''} onChange={(e) => setForm({ ...form, telefon: e.target.value })} /></div>
        <div><label className="htl-label">E-posta</label><input className="htl-input" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="htl-label">Şehir</label><input className="htl-input" value={form.sehir || ''} onChange={(e) => setForm({ ...form, sehir: e.target.value })} /></div>
        <div><label className="htl-label">Ülke</label><input className="htl-input" value={form.ulke || ''} onChange={(e) => setForm({ ...form, ulke: e.target.value })} /></div>
        <div className="md:col-span-2"><label className="htl-label">Adres</label><input className="htl-input" value={form.adres || ''} onChange={(e) => setForm({ ...form, adres: e.target.value })} /></div>
        <div className="md:col-span-2"><label className="htl-label">Notlar</label><textarea rows="2" className="htl-input" value={form.notlar || ''} onChange={(e) => setForm({ ...form, notlar: e.target.value })} /></div>
      </div>
    </Modal>
  );
};

export default MisafirFormModal;
