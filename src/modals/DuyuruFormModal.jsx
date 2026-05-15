import { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db, useCollection } from '../lib/db.js';
import { useAuth } from '../lib/auth.jsx';

const ONEM_OPTS = [
  { v: 'bilgi', label: 'Bilgi', icon: 'info', color: '#2563eb', bg: '#eff6ff' },
  { v: 'uyari', label: 'Uyarı', icon: 'alert-triangle', color: '#d97706', bg: '#fffbeb' },
  { v: 'acil', label: 'Acil', icon: 'alert-circle', color: '#dc2626', bg: '#fef2f2' },
];

const DuyuruFormModal = ({ open, onClose, onSaved, target = null }) => {
  const { user } = useAuth();
  const { show } = useToast();
  const users = useCollection('users');
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({ ...target });
    } else {
      setForm({
        baslik: '',
        icerik: '',
        onem: 'bilgi',
        hedef: 'hepsi',
        hedefKullanicilar: [],
        aktif: true,
      });
    }
  }, [open, target]);

  const toggleKullanici = (uid) => {
    const prev = form.hedefKullanicilar || [];
    setForm({
      ...form,
      hedefKullanicilar: prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    });
  };

  const save = async () => {
    if (!form.baslik?.trim()) return show('Başlık zorunlu.', 'error');
    if (form.hedef === 'secili' && !(form.hedefKullanicilar || []).length) {
      return show('En az bir kullanıcı seçin.', 'error');
    }
    setSaving(true);
    try {
      const data = {
        baslik: form.baslik.trim(),
        icerik: form.icerik || '',
        onem: form.onem || 'bilgi',
        hedef: form.hedef || 'hepsi',
        hedefKullanicilar: form.hedef === 'secili' ? (form.hedefKullanicilar || []) : [],
        baslangicTarihi: '2000-01-01',
        bitisTarihi: '2099-12-31',
        aktif: form.aktif !== false,
        okuyanlar: target ? (form.okuyanlar || []) : [],
      };
      if (target) {
        await db.update('duyurular', target.id, data);
        show('Duyuru güncellendi.');
      } else {
        await db.add('duyurular', {
          ...data,
          olusturanId: user?.id || null,
          olusturmaTarihi: new Date().toISOString(),
        });
        show('Duyuru oluşturuldu.');
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const aktifUsers = users.filter((u) => u.aktif !== false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? 'Duyuru Düzenle' : 'Yeni Duyuru'}
      size="lg"
      footer={
        <>
          <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
          <button type="button" className="htl-btn htl-btn-primary" onClick={save} disabled={saving}>
            <Icon name="save" size={16} stroke="white" />
            <span>{saving ? 'Kaydediliyor...' : (target ? 'Güncelle' : 'Oluştur')}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="htl-label">Başlık *</label>
          <input className="htl-input" value={form.baslik || ''} onChange={(e) => setForm({ ...form, baslik: e.target.value })} />
        </div>
        <div>
          <label className="htl-label">İçerik</label>
          <textarea rows={3} className="htl-input" value={form.icerik || ''} onChange={(e) => setForm({ ...form, icerik: e.target.value })} />
        </div>
        <div>
          <label className="htl-label">Önem Seviyesi</label>
          <div className="grid grid-cols-3 gap-2">
            {ONEM_OPTS.map((o) => {
              const secili = form.onem === o.v;
              return (
                <button key={o.v} type="button"
                  onClick={() => setForm({ ...form, onem: o.v })}
                  className="flex items-center gap-2 px-3 py-3 rounded-lg transition text-sm font-medium"
                  style={{
                    background: secili ? o.bg : 'var(--bone-warm)',
                    border: `2px solid ${secili ? o.color : 'transparent'}`,
                    color: secili ? o.color : 'var(--ink-soft)',
                  }}>
                  <Icon name={o.icon} size={16} stroke={secili ? o.color : 'var(--ink-soft)'} />
                  <span>{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="htl-label">Hedef</label>
          <div className="flex gap-4 mb-2">
            {[{ v: 'hepsi', l: 'Tüm kullanıcılar' }, { v: 'secili', l: 'Seçili kullanıcılar' }].map((o) => (
              <label key={o.v} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="duyuruHedef" value={o.v}
                  checked={form.hedef === o.v}
                  onChange={() => setForm({ ...form, hedef: o.v })}
                />
                {o.l}
              </label>
            ))}
          </div>
          {form.hedef === 'secili' && (
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--bone-warm)', maxHeight: 180, overflowY: 'auto' }}>
              {aktifUsers.length === 0 ? (
                <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>Kullanıcılar yükleniyor...</div>
              ) : aktifUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={(form.hedefKullanicilar || []).includes(u.id)}
                    onChange={() => toggleKullanici(u.id)}
                  />
                  <span className="font-medium">{u.adSoyad}</span>
                  <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>({u.kullaniciAdi || u.email || ''})</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" checked={form.aktif !== false} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
          <span>Aktif</span>
        </label>
      </div>
    </Modal>
  );
};

export default DuyuruFormModal;
