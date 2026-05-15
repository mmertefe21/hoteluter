/**
 * HesapFormModal — hesap oluştur / düzenle.
 *
 * - Tip kart-style butonlar (HESAP_TIP_OPTS), seçilince renk default'u o tipinki olur.
 * - Para birimi: oluşturmada serbest, düzenlemede hareketler varsa KİLİTLİ
 *   (bakiye bozulmasın, bunun yerine yeni hesap aç + eskisini pasif yap).
 * - Aktif toggle, açıklama.
 *
 * Props:
 *   open, onClose, onSaved
 *   target           : hesap | null
 *   hesapHareketleri : Array (paraBirimiKilitli kontrolü için)
 *   ana              : string
 */
import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';
import { HESAP_TIP_OPTS, HESAP_TIP_INFO, PARA_BIRIMI_OPTS, PRESET_RENKLER } from '../lib/constants.js';
import { logAksiyon } from '../helpers/aktiviteLog.js';

const DEFAULT_FORM = {
  ad: '',
  tip: 'kasa',
  paraBirimi: 'EUR',
  renk: HESAP_TIP_INFO('kasa').renk,
  aciklama: '',
  aktif: true,
};

const HesapFormModal = ({
  open,
  onClose,
  onSaved,
  target = null,
  hesapHareketleri = [],
  ana = 'EUR',
}) => {
  const { show } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmPasif, setConfirmPasif] = useState(null); // null | 'sil' | 'pasif'

  const harSayisi = useMemo(
    () => (target ? hesapHareketleri.filter((h) => h.hesapId === target.id).length : 0),
    [target, hesapHareketleri]
  );
  const paraBirimiKilitli = !!target && harSayisi > 0;

  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({ ...DEFAULT_FORM, ...target, paraBirimi: target.paraBirimi || ana });
    } else {
      setForm({ ...DEFAULT_FORM, paraBirimi: ana });
    }
  }, [open, target?.id]);

  const save = async () => {
    if (!form.ad?.trim()) return show('Ad zorunlu.', 'error');
    if (!form.paraBirimi) return show('Para birimi seçilmeli.', 'error');

    // Deactivation intercept: mevcut aktif hesap pasif yapılıyorsa onayla
    if (target && target.aktif !== false && form.aktif === false) {
      setConfirmPasif(harSayisi === 0 ? 'sil' : 'pasif');
      return;
    }

    setSaving(true);
    try {
      if (target) {
        const payload = paraBirimiKilitli ? { ...form, paraBirimi: target.paraBirimi } : { ...form };
        await db.update('hesaplar', target.id, payload);
        show('Hesap güncellendi.');
      } else {
        await db.add('hesaplar', { ...form, olusturmaTarihi: new Date().toISOString() });
        show('Hesap eklendi.');
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasifConfirm = async () => {
    const action = confirmPasif;
    setConfirmPasif(null);
    setSaving(true);
    try {
      if (action === 'sil') {
        await db.delete('hesaplar', target.id);
        void logAksiyon({ aksiyon: 'hesap.sil', aciklama: `Hesap silindi: ${target.ad}`, hedefTip: 'hesap', hedefId: target.id });
        show('Hesap silindi.');
      } else {
        const payload = paraBirimiKilitli ? { ...form, paraBirimi: target.paraBirimi } : { ...form };
        await db.update('hesaplar', target.id, payload);
        show('Hesap pasif yapıldı (geçmiş hareketler korundu).');
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
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={target ? 'Hesabı Düzenle' : 'Yeni Hesap'}
      footer={
        <>
          <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="htl-btn htl-btn-primary" onClick={save} disabled={saving}>
            <Icon name="save" size={16} stroke="white" />
            <span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
          </button>
        </>
      }
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="htl-label">Ad *</label>
          <input
            className="htl-input"
            placeholder="Örn: Euro Kasa, TR Banka..."
            value={form.ad || ''}
            onChange={(e) => setForm({ ...form, ad: e.target.value })}
          />
        </div>

        <div className="md:col-span-2">
          <label className="htl-label">Hesap Tipi</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {HESAP_TIP_OPTS.map((t) => {
              const aktif = form.tip === t.v;
              return (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setForm({ ...form, tip: t.v, renk: t.renk })}
                  className="px-3 py-3 rounded-lg flex flex-col items-center gap-1 text-xs font-medium transition"
                  style={{
                    background: aktif ? t.renk : 'var(--bone-warm)',
                    color: aktif ? 'white' : 'var(--ink-soft)',
                    border: `1px solid ${aktif ? t.renk : 'var(--line-soft)'}`,
                  }}
                >
                  <Icon name={t.icon} size={20} stroke={aktif ? 'white' : 'currentColor'} />
                  <span>{t.l}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="htl-label">Renk</label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_RENKLER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm({ ...form, renk: r })}
                className="w-7 h-7 rounded-full transition"
                style={{
                  background: r,
                  outline: form.renk === r ? `2px solid ${r}` : 'none',
                  outlineOffset: form.renk === r ? 2 : 0,
                  boxShadow: form.renk === r ? '0 0 0 1px white, 0 0 0 3px ' + r : 'none',
                }}
                title={r}
              />
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="htl-label">Para Birimi *</label>
          <div className="grid grid-cols-4 gap-2">
            {PARA_BIRIMI_OPTS.map((p) => {
              const aktif = form.paraBirimi === p.v;
              return (
                <button
                  key={p.v}
                  type="button"
                  disabled={paraBirimiKilitli}
                  onClick={() => !paraBirimiKilitli && setForm({ ...form, paraBirimi: p.v })}
                  className="px-3 py-3 rounded-lg flex flex-col items-center gap-1 text-xs font-medium transition"
                  style={{
                    background: aktif ? 'var(--forest)' : 'var(--bone-warm)',
                    color: aktif ? 'var(--bone-light)' : 'var(--ink)',
                    border: `1px solid ${aktif ? 'var(--forest)' : 'var(--line-soft)'}`,
                    opacity: paraBirimiKilitli && !aktif ? 0.4 : 1,
                    cursor: paraBirimiKilitli ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div className="font-display text-xl font-medium">{p.symbol}</div>
                  <div className="text-[10px]">{p.l}</div>
                </button>
              );
            })}
          </div>
          {paraBirimiKilitli && (
            <div
              className="text-xs mt-2 px-3 py-2 rounded-md flex items-start gap-2"
              style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
            >
              <Icon name="lock" size={14} />
              <span>
                Bu hesapta {harSayisi} hareket var, para birimi değiştirilemez. Yeni hesap açıp eski hesabı pasif yapabilirsiniz.
              </span>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="htl-label">Açıklama</label>
          <input
            className="htl-input"
            value={form.aciklama || ''}
            onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-3">
          <div
            className={`htl-switch ${form.aktif ? 'on' : ''}`}
            onClick={() => setForm({ ...form, aktif: !form.aktif })}
          />
          <label className="htl-label" style={{ margin: 0 }}>
            Aktif (kapatılan hesap tahsilatlarda görünmez)
          </label>
        </div>
      </div>
    </Modal>
    <ConfirmModal
      open={!!confirmPasif}
      title={confirmPasif === 'sil' ? 'Hesabı Sil' : 'Hesabı Pasif Yap'}
      msg={
        confirmPasif === 'sil'
          ? `"${form.ad}" hesabında hiç hareket yok. Hesap kalıcı olarak silinecek. Emin misiniz?`
          : `"${form.ad}" hesabında ${harSayisi} hareket var. Hesap pasif yapılacak (tahsilatlarda görünmez), geçmiş hareketler korunacak. Emin misiniz?`
      }
      onConfirm={handlePasifConfirm}
      onCancel={() => setConfirmPasif(null)}
      confirmLabel={confirmPasif === 'sil' ? 'Sil' : 'Pasif Yap'}
      danger={confirmPasif === 'sil'}
    />
    </>
  );
};

export default HesapFormModal;
