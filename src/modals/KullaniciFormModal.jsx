/**
 * KullaniciFormModal — kullanıcı ekle/düzenle.
 *
 * - Yeni kullanıcı: createUserWithProfile (Firebase Auth user + Firestore profil birlikte).
 *   ⚠ Yan etki: createUserWithEmailAndPassword çağırıldığında mevcut oturum yeni
 *   user'a geçer; mevcut admin tekrar login olmak zorunda kalır.
 *   Production'da Cloud Functions ile düzeltilecek.
 * - Düzenleme: sadece Firestore profil update. Email/şifre değişimi kapalı
 *   (admin SDK gerektirir; ileri sürümde Cloud Function veya kullanıcının kendi
 *   şifre değiştirme akışıyla halledilecek).
 *
 * Yetkiler matrix'i ALL_MODULES'tan dinamik üretilir.
 */
import { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';
import { createUserWithProfile } from '../lib/auth.jsx';
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
        // Düzenleme: sadece profil alanları (email değiştirilmez)
        const { email: _ignoredEmail, ...patch } = form;
        await db.update('users', target.id, patch);
        show('Kullanıcı güncellendi.');
      } else {
        // Yeni: Firebase Auth user + Firestore profil birlikte.
        const { email, aktif, ...profile } = form;
        await createUserWithProfile({
          email: email.trim(),
          password: sifre,
          profile: { ...profile, aktif: aktif !== false },
        });
        show('Kullanıcı oluşturuldu. Mevcut oturum yeni kullanıcıya geçti — tekrar giriş yapın.', 'info');
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      const code = e?.code || '';
      let msg = e.message;
      if (code === 'auth/email-already-in-use') msg = 'Bu e-posta zaten kayıtlı.';
      else if (code === 'auth/invalid-email') msg = 'Geçersiz e-posta formatı.';
      else if (code === 'auth/weak-password') msg = 'Şifre en az 6 karakter olmalı.';
      show('Hata: ' + msg, 'error');
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
      {!target && (
        <div className="mb-4 px-3 py-2 rounded-md text-xs flex items-start gap-2"
          style={{ background: 'var(--warn-soft, #fef6e7)', color: 'var(--ink, #2a2a2a)', border: '1px solid var(--warn, #d4a04a)' }}>
          <Icon name="alert-triangle" size={14} stroke="var(--warn, #d4a04a)" className="mt-0.5 flex-shrink-0" />
          <span>
            Yeni kullanıcı oluşturulduğunda mevcut oturumunuz kapanacak ve yeni kullanıcıya geçilecek.
            Tekrar giriş yapmanız gerekebilir. (Bu Firebase'in client-side davranışı; production'da
            Cloud Functions ile düzeltilecek.)
          </span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div><label className="htl-label">Kullanıcı Adı *</label><input className="htl-input" value={form.kullaniciAdi || ''} onChange={(e) => setForm({ ...form, kullaniciAdi: e.target.value })} /></div>
        <div><label className="htl-label">Ad Soyad *</label><input className="htl-input" value={form.adSoyad || ''} onChange={(e) => setForm({ ...form, adSoyad: e.target.value })} /></div>
        <div>
          <label className="htl-label">E-posta * {target && <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>(değiştirilemez)</span>}</label>
          <input type="email" className="htl-input" value={form.email || ''}
            disabled={!!target}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
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
