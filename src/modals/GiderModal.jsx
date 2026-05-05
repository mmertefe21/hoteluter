/**
 * GiderModal — gider ekle / düzenle.
 *
 * Tahsilat ile simetrik akış:
 *   - Kategori kart-style butonlar (renkli, ikonlu)
 *   - Para birimi → filtreli hesap dropdown
 *   - Farklı PB ise kur paneli + ana PB karşılığı önizleme
 *   - addGiderWithHareket / updateGiderWithHareket atomik
 *
 * Props:
 *   open, onClose, onSaved
 *   target           : gider | null
 *   hesaplar         : Array
 *   hesapHareketleri : Array (bakiye preview için)
 *   kategoriler      : Array (giderKategorileri)
 *   ana              : string
 *   userId           : string
 */
import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { PARA_BIRIMI_OPTS, PARA_BIRIMI_INFO } from '../lib/constants.js';
import { fmtMoney, todayISO } from '../lib/helpers.js';
import { cevirKur, getActiveKurlar } from '../lib/kur.js';
import { getHesapBakiye } from '../helpers/exchange-utils.js';
import { addGiderWithHareket, updateGiderWithHareket } from '../helpers/gider.js';

const GiderModal = ({
  open,
  onClose,
  onSaved,
  target = null,
  hesaplar = [],
  hesapHareketleri = [],
  kategoriler = [],
  ana = 'EUR',
  userId = null,
}) => {
  const { show } = useToast();
  const kurlar = getActiveKurlar();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const aktifKategoriler = kategoriler.filter((k) => k.aktif !== false);

  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({
        ...target,
        paraBirimi: target.paraBirimi || ana,
        kur: target.kur || 1,
      });
    } else {
      const aktifHesaplar = hesaplar.filter((h) => h.aktif !== false);
      const ilkAna = aktifHesaplar.find((h) => (h.paraBirimi || ana) === ana) || aktifHesaplar[0];
      setForm({
        kategoriId: aktifKategoriler[0]?.id || '',
        hesapId: ilkAna?.id || '',
        tutar: '',
        paraBirimi: ana,
        kur: 1,
        tarih: todayISO(),
        aciklama: '',
      });
    }
  }, [open, target?.id]);

  const formPB = form.paraBirimi || ana;
  const isFarkli = formPB !== ana;
  const otoKur = useMemo(
    () => (isFarkli && kurlar ? cevirKur(1, formPB, ana, kurlar) : null),
    [isFarkli, formPB, ana, kurlar]
  );
  const aktifKur = isFarkli && Number(form.kur) > 0 ? Number(form.kur) : otoKur;
  const tutarAnaPreview =
    isFarkli && aktifKur ? Number(form.tutar || 0) * aktifKur : Number(form.tutar || 0);

  const uygunHesaplar = hesaplar.filter(
    (h) => h.aktif !== false && (h.paraBirimi || ana) === formPB
  );
  const seciliHesap = form.hesapId ? hesaplar.find((h) => h.id === form.hesapId) : null;
  const hesapPB = seciliHesap ? seciliHesap.paraBirimi || ana : ana;
  const seciliKat = form.kategoriId ? kategoriler.find((k) => k.id === form.kategoriId) : null;
  const mevcutBakiye = form.hesapId ? getHesapBakiye(form.hesapId, hesapHareketleri) : 0;
  const sonrakiBakiye = mevcutBakiye - Number(form.tutar || 0);

  const setPB = (yeniPB) => {
    const yeniUygun = hesaplar.filter(
      (h) => h.aktif !== false && (h.paraBirimi || ana) === yeniPB
    );
    setForm({
      ...form,
      paraBirimi: yeniPB,
      hesapId: yeniUygun[0]?.id || '',
      kur: yeniPB === ana ? 1 : '',
    });
  };

  const save = async () => {
    if (!form.kategoriId) return show('Kategori seçilmeli.', 'error');
    if (!form.hesapId) return show('Hesap seçilmeli.', 'error');
    if (!form.tutar || Number(form.tutar) <= 0) return show("Tutar 0'dan büyük olmalı.", 'error');

    const payload = {
      kategoriId: form.kategoriId,
      hesapId: form.hesapId,
      tutar: Number(form.tutar),
      paraBirimi: formPB,
      kur: isFarkli && Number(form.kur) > 0 ? Number(form.kur) : undefined,
      tarih: form.tarih,
      aciklama: form.aciklama || '',
    };

    setSaving(true);
    try {
      if (target) {
        await updateGiderWithHareket(target.id, payload, ana);
        show('Gider güncellendi.');
      } else {
        await addGiderWithHareket(payload, userId, ana);
        show('Gider kaydedildi, hesaptan düşüldü.');
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
    <Modal
      open={open}
      onClose={onClose}
      title={target ? 'Gideri Düzenle' : 'Yeni Gider'}
      size="lg"
      footer={
        <>
          <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="button"
            className="htl-btn htl-btn-primary"
            onClick={save}
            disabled={saving || uygunHesaplar.length === 0}
          >
            <Icon name="save" size={16} stroke="white" />
            <span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="htl-label">Kategori *</label>
          {aktifKategoriler.length === 0 ? (
            <div
              className="px-3 py-2 rounded-md text-xs flex items-center gap-2"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
            >
              <Icon name="alert-circle" size={14} />
              <span>Aktif kategori yok. Önce Ayarlar &gt; Gider Kategorileri'nden ekleyin.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {aktifKategoriler.map((k) => {
                const aktif = form.kategoriId === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setForm({ ...form, kategoriId: k.id })}
                    className="px-3 py-3 rounded-lg flex items-center gap-2 text-left transition"
                    style={{
                      background: aktif ? k.renk : 'var(--bone-warm)',
                      color: aktif ? 'white' : 'var(--ink)',
                      border: `1px solid ${aktif ? k.renk : 'var(--line-soft)'}`,
                    }}
                  >
                    <Icon name={k.icon || 'tag'} size={16} stroke={aktif ? 'white' : k.renk} />
                    <span className="text-xs font-medium truncate">{k.ad}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="htl-label">Tutar *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="htl-input"
              value={form.tutar || ''}
              onChange={(e) => setForm({ ...form, tutar: e.target.value })}
            />
          </div>
          <div>
            <label className="htl-label">Para Birimi</label>
            <select className="htl-input" value={formPB} onChange={(e) => setPB(e.target.value)}>
              {PARA_BIRIMI_OPTS.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.symbol} {p.l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {uygunHesaplar.length === 0 && (
          <div
            className="px-3 py-2 rounded-md text-sm flex items-start gap-2"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
          >
            <Icon name="alert-circle" size={16} />
            <span>
              <strong>{formPB} cinsinden hesap yok.</strong> Önce Hesaplar sekmesinden bir{' '}
              {PARA_BIRIMI_INFO(formPB).l} hesabı açın.
            </span>
          </div>
        )}

        {isFarkli && uygunHesaplar.length > 0 && (
          <div
            className="rounded-md p-3"
            style={{ background: 'var(--brass-soft)', border: '1px solid var(--brass-light)' }}
          >
            <div className="grid md:grid-cols-2 gap-3 items-end">
              <div>
                <label className="htl-label" style={{ margin: 0, marginBottom: 4 }}>
                  Kur (1 {formPB} = ? {ana})
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    className="htl-input"
                    placeholder={otoKur ? otoKur.toFixed(4) : 'Manuel girin'}
                    value={form.kur || ''}
                    onChange={(e) => setForm({ ...form, kur: e.target.value })}
                  />
                  {otoKur && (
                    <button
                      type="button"
                      className="htl-btn htl-btn-ghost"
                      onClick={() => setForm({ ...form, kur: otoKur.toFixed(4) })}
                      title="Canlı kuru kullan"
                    >
                      <Icon name="refresh-cw" size={14} />
                    </button>
                  )}
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>
                  {otoKur
                    ? `Canlı kur: 1 ${formPB} = ${otoKur.toFixed(4)} ${ana}${kurlar?.isManual ? ' (manuel)' : ''}`
                    : 'Canlı kur yok — manuel girin'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                  Ana PB Karşılığı
                </div>
                <div className="font-display text-xl font-medium" style={{ color: 'var(--danger)' }}>
                  {aktifKur ? fmtMoney(tutarAnaPreview, ana) : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="htl-label">Tarih *</label>
            <input
              type="date"
              className="htl-input"
              value={form.tarih || ''}
              onChange={(e) => setForm({ ...form, tarih: e.target.value })}
            />
          </div>
          <div>
            <label className="htl-label">
              Hesap *{' '}
              <span style={{ textTransform: 'none', color: 'var(--ink-faint)', fontWeight: 'normal' }}>
                (sadece {formPB} hesapları)
              </span>
            </label>
            <select
              className="htl-input"
              value={form.hesapId || ''}
              onChange={(e) => setForm({ ...form, hesapId: e.target.value })}
            >
              <option value="">— Seçiniz —</option>
              {uygunHesaplar.map((h) => {
                const pb = h.paraBirimi || ana;
                return (
                  <option key={h.id} value={h.id}>
                    {h.ad} ({fmtMoney(getHesapBakiye(h.id, hesapHareketleri), pb)})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="htl-label">Açıklama</label>
            <input
              className="htl-input"
              placeholder={seciliKat ? `Örn: ${seciliKat.ad} - Mart` : 'Detay...'}
              value={form.aciklama || ''}
              onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
            />
          </div>
        </div>

        {seciliHesap && Number(form.tutar) > 0 && uygunHesaplar.length > 0 && (
          <div
            className="text-xs flex items-center gap-3 px-3 py-2 rounded-md flex-wrap"
            style={{ background: 'var(--bone-warm)' }}
          >
            <span style={{ color: 'var(--ink-soft)' }}>Bu giderden sonra:</span>
            <span>
              Bakiye:{' '}
              <strong style={{ color: sonrakiBakiye >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {fmtMoney(sonrakiBakiye, hesapPB)}
              </strong>
            </span>
            {isFarkli && aktifKur && (
              <span style={{ color: 'var(--ink-soft)' }}>
                · Raporda:{' '}
                <strong style={{ color: 'var(--danger)' }}>−{fmtMoney(tutarAnaPreview, ana)}</strong>
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default GiderModal;
