/**
 * KullaniciFormModal — kullanıcı ekle/düzenle (UI placeholder).
 *
 * Görev 9'da Firebase Auth ile entegre olacak. Şimdilik:
 *   - Yeni kullanıcı: sadece UI form, gerçek auth yaratımı yok (db'ye yazıyor).
 *   - Düzenleme: profil alanlarını günceller.
 *
 * Yetkiler matrix'i ALL_MODULES'tan dinamik üretilir.
 */
import { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';
import { ALL_MODULES, AKSIYON_LABELS, ROLE_LABELS, getAllActions } from '../lib/permissions.js';

const DEFAULT = {
  kullaniciAdi: '', adSoyad: '', email: '',
  rol: 'kullanici', modulYetkileri: {}, aktif: true,
};

const KullaniciFormModal = ({ open, onClose, onSaved, target = null }) => {
  const { show } = useToast();
  const [form, setForm] = useState(DEFAULT);
  const [sifre, setSifre] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(target ? { ...DEFAULT, ...target } : DEFAULT);
    setSifre('');
  }, [open, target?.id]);

  const toggleAksiyon = (modKey, aksiyon) => {
    setForm((f) => {
      const mevcut = f.modulYetkileri?.[modKey] || [];
      const yeni = mevcut.includes(aksiyon)
        ? mevcut.filter((a) => a !== aksiyon)
        : [...mevcut, aksiyon];
      return { ...f, modulYetkileri: { ...(f.modulYetkileri || {}), [modKey]: yeni } };
    });
  };

  const tumYetkileriVer = () => {
    const yeni = {};
    ALL_MODULES.forEach((m) => { yeni[m.key] = getAllActions(m.key); });
    setForm((f) => ({ ...f, modulYetkileri: yeni }));
  };

  const tumYetkileriKaldir = () => {
    setForm((f) => ({ ...f, modulYetkileri: {} }));
  };

  const save = async () => {
    if (!form.kullaniciAdi?.trim() || !form.adSoyad?.trim() || !form.email?.trim()) {
      return show('Kullanıcı adı, ad soyad ve e-posta zorunludur.', 'error');
    }
    if (!target && (!sifre || sifre.length < 6)) {
      return show('Yeni kullanıcı için şifre en az 6 karakter olmalı.', 'error');
    }
    setSaving(true);
    try {
      if (target) {
        await db.update('users', target.id, form);
        show('Kullanıcı güncellendi.');
      } else {
        // TODO: Görev 9'da createUserWithProfile (Firebase Auth + Firestore)
        await db.add('users', { ...form, olusturmaTarihi: new Date().toISOString() });
        show('Kullanıcı eklendi (UI-only — auth bağlanması Görev 9).', 'info');
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
    <Modal open={open} onClose={onClose} size="lg"
      title={target ? `${target.adSoyad || 'Kullanıcı'} — Düzenle` : 'Yeni Kullanıcı'}
      footer={<>
        <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
        <button type="button" className="htl-btn htl-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} stroke="white" /><span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
        </button>
      </>}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div><label className="htl-label">Kullanıcı Adı *</label><input className="htl-input" value={form.kullaniciAdi || ''} onChange={(e) => setForm({ ...form, kullaniciAdi: e.target.value })} /></div>
        <div><label className="htl-label">Ad Soyad *</label><input className="htl-input" value={form.adSoyad || ''} onChange={(e) => setForm({ ...form, adSoyad: e.target.value })} /></div>
        <div><label className="htl-label">E-posta *</label><input type="email" className="htl-input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        {!target && (
          <div><label className="htl-label">Şifre * (en az 6)</label><input type="password" className="htl-input" value={sifre} onChange={(e) => setSifre(e.target.value)} /></div>
        )}
        <div>
          <label className="htl-label">Rol</label>
          <select className="htl-input" value={form.rol || 'kullanici'} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-3">
          <div className={`htl-switch ${form.aktif ? 'on' : ''}`} onClick={() => setForm({ ...form, aktif: !form.aktif })} />
          <label className="htl-label" style={{ margin: 0 }}>Aktif</label>
        </div>
      </div>

      {form.rol !== 'superadmin' && (
        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="font-display text-base font-medium" style={{ color: 'var(--forest)' }}>
              <Icon name="shield" size={16} className="inline mr-1" stroke="var(--brass)" />
              Modül Yetkileri
            </h4>
            <div className="flex gap-2">
              <button type="button" className="htl-btn htl-btn-ghost text-xs" onClick={tumYetkileriVer}>Tümünü Ver</button>
              <button type="button" className="htl-btn htl-btn-ghost text-xs" onClick={tumYetkileriKaldir}>Tümünü Kaldır</button>
            </div>
          </div>
          <div className="space-y-2">
            {ALL_MODULES.map((m) => {
              const mevcut = form.modulYetkileri?.[m.key] || [];
              return (
                <div key={m.key} className="rounded-md p-3" style={{ background: 'var(--bone-warm)', border: '1px solid var(--line-soft)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name={m.icon} size={16} stroke="var(--brass)" />
                    <span className="font-medium text-sm">{m.ad}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {m.actions.map((a) => {
                      const aktif = mevcut.includes(a);
                      return (
                        <button key={a} type="button" onClick={() => toggleAksiyon(m.key, a)}
                          className="px-2.5 py-1 rounded text-xs font-medium transition"
                          style={{
                            background: aktif ? 'var(--forest)' : 'transparent',
                            color: aktif ? 'var(--bone-light)' : 'var(--ink-soft)',
                            border: `1px solid ${aktif ? 'var(--forest)' : 'var(--line)'}`,
                          }}>
                          {AKSIYON_LABELS[a] || a}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {form.rol === 'superadmin' && (
        <div className="mt-4 px-3 py-2 rounded-md text-sm flex items-center gap-2" style={{ background: 'var(--brass-soft)', color: 'var(--forest)' }}>
          <Icon name="shield-check" size={16} stroke="var(--brass)" />
          <span>Süperadmin tüm yetkilere otomatik sahiptir.</span>
        </div>
      )}
    </Modal>
  );
};

export default KullaniciFormModal;
