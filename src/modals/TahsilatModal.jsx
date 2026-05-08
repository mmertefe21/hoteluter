/**
 * TahsilatModal — tahsilat ekle / düzenle.
 *
 * - Rezervasyon seçimi OPSİYONEL (rezervasyona bağlı veya bağımsız tahsilat).
 * - Para birimi seçince hesap dropdown otomatik o PB'deki aktif hesaplara filtrelenir.
 * - Farklı PB ise kur paneli açılır (canlı kur + manuel + ana PB önizlemesi).
 * - addTahsilatWithHareket / updateTahsilatWithHareket atomik (writeBatch).
 *
 * Props:
 *   open, onClose, onSaved
 *   target          : tahsilat | null  (varsa düzenleme modu)
 *   hesaplar        : Array
 *   rezervasyonlar  : Array (optional — yoksa dropdown gizli)
 *   misafirler      : Array (optional — rezervasyon label'ı için)
 *   tahsilatlar     : Array (optional — kalan borç hesabı için)
 *   ana             : string  (ana para birimi)
 *   userId          : string  (olusturanId)
 */
import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { PARA_BIRIMI_OPTS, ODEME_OPTS } from '../lib/constants.js';
import { fmtMoney, todayISO } from '../lib/helpers.js';
import { cevirKur, getActiveKurlar } from '../lib/kur.js';
import { getHesapBakiye, getRezervasyonOdenen } from '../helpers/exchange-utils.js';
import {
  addTahsilatWithHareket,
  updateTahsilatWithHareket,
} from '../helpers/tahsilat.js';

const TahsilatModal = ({
  open,
  onClose,
  onSaved,
  target = null,
  hesaplar = [],
  hesapHareketleri = [],
  rezervasyonlar = [],
  misafirler = [],
  tahsilatlar = [],
  ana = 'EUR',
  userId = null,
}) => {
  const { show } = useToast();
  const kurlar = getActiveKurlar();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({
        ...target,
        paraBirimi: target.paraBirimi || ana,
        kur: target.kur || 1,
        tahsilatTipi: target.grupId ? 'grup' : 'oda',
      });
    } else {
      const aktifHesaplar = hesaplar.filter((h) => h.aktif !== false);
      const ilkAna = aktifHesaplar.find((h) => (h.paraBirimi || ana) === ana) || aktifHesaplar[0];
      setForm({
        rezervasyonId: '',
        tutar: '',
        tarih: todayISO(),
        odemeYontemi: 'nakit',
        hesapId: ilkAna?.id || '',
        paraBirimi: ana,
        kur: 1,
        aciklama: '',
        tahsilatTipi: 'oda',
      });
    }
  }, [open, target?.id]);

  // Ödeme yöntemi seçilince varsayılan hesap önerisi (hesapId boşsa)
  useEffect(() => {
    if (!open || form.hesapId || !form.odemeYontemi) return;
    const formPB = form.paraBirimi || ana;
    const uygun = hesaplar.filter((h) => h.aktif !== false && (h.paraBirimi || ana) === formPB);
    let onerilen = null;
    if (form.odemeYontemi === 'kredi-karti') onerilen = uygun.find((h) => h.tip === 'pos');
    else if (form.odemeYontemi === 'havale') onerilen = uygun.find((h) => h.tip === 'banka');
    else if (form.odemeYontemi === 'nakit') onerilen = uygun.find((h) => h.tip === 'kasa');
    if (onerilen) setForm((f) => ({ ...f, hesapId: onerilen.id }));
  }, [form.odemeYontemi]);

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

  const aktifRezler = rezervasyonlar.filter(
    (r) => r.durum !== 'iptal' && r.durum !== 'no-show'
  );
  const seciliRez = form.rezervasyonId
    ? rezervasyonlar.find((r) => r.id === form.rezervasyonId)
    : null;
  const seciliRezOdenen = seciliRez
    ? getRezervasyonOdenen(seciliRez.id, tahsilatlar.filter((t) => t.id !== target?.id))
    : 0;
  const seciliRezKalan = seciliRez
    ? Number(seciliRez.toplamTutar || 0) - seciliRezOdenen
    : 0;

  const setPB = (yeniPB) => {
    const yeniUygun = hesaplar.filter(
      (h) => h.aktif !== false && (h.paraBirimi || ana) === yeniPB
    );
    let yeniHesapId = '';
    if (form.odemeYontemi === 'kredi-karti') yeniHesapId = yeniUygun.find((h) => h.tip === 'pos')?.id || '';
    else if (form.odemeYontemi === 'havale') yeniHesapId = yeniUygun.find((h) => h.tip === 'banka')?.id || '';
    else if (form.odemeYontemi === 'nakit') yeniHesapId = yeniUygun.find((h) => h.tip === 'kasa')?.id || '';
    if (!yeniHesapId) yeniHesapId = yeniUygun[0]?.id || '';
    setForm({ ...form, paraBirimi: yeniPB, hesapId: yeniHesapId, kur: yeniPB === ana ? 1 : '' });
  };

  const save = async () => {
    if (!form.hesapId) return show('Hesap seçilmeli.', 'error');
    if (!form.tutar || Number(form.tutar) <= 0) return show("Tutar 0'dan büyük olmalı.", 'error');
    if (uygunHesaplar.length === 0) return show(`${formPB} cinsinden hesap yok.`, 'error');

    // Grup tahsilatı: rez gruplu ise ve "Grup geneli" seçildiyse → rezervasyonId null,
    // grupId rezervasyonun grubuna işaretlenir (havuza yazım).
    const seciliRezDoc = form.rezervasyonId ? rezervasyonlar.find((r) => r.id === form.rezervasyonId) : null;
    const isGrupTahsilat = form.tahsilatTipi === 'grup' && seciliRezDoc?.grupId;

    const payload = {
      rezervasyonId: isGrupTahsilat ? null : (form.rezervasyonId || null),
      grupId: isGrupTahsilat ? seciliRezDoc.grupId : null,
      tutar: Number(form.tutar),
      paraBirimi: formPB,
      kur: isFarkli && Number(form.kur) > 0 ? Number(form.kur) : undefined,
      tarih: form.tarih,
      odemeYontemi: form.odemeYontemi || 'nakit',
      hesapId: form.hesapId,
      aciklama: form.aciklama || '',
    };

    setSaving(true);
    try {
      if (target) {
        await updateTahsilatWithHareket(target.id, payload, ana);
        show('Tahsilat güncellendi.');
      } else {
        await addTahsilatWithHareket(payload, userId, ana);
        show('Tahsilat eklendi, hesaba yansıdı.');
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
      title={target ? 'Tahsilatı Düzenle' : 'Yeni Tahsilat'}
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
      <div className="grid md:grid-cols-3 gap-4">
        {rezervasyonlar.length > 0 && (
          <div className="md:col-span-3">
            <label className="htl-label">Rezervasyon (opsiyonel)</label>
            <select
              className="htl-input"
              value={form.rezervasyonId || ''}
              onChange={(e) => setForm({ ...form, rezervasyonId: e.target.value })}
            >
              <option value="">— Bağımsız tahsilat —</option>
              {aktifRezler.map((r) => {
                const m = misafirler.find((x) => x.id === r.anaMisafirId);
                const odenen = getRezervasyonOdenen(r.id, tahsilatlar);
                const kalan = Number(r.toplamTutar || 0) - odenen;
                return (
                  <option key={r.id} value={r.id}>
                    {r.rezervasyonKodu} — {m ? `${m.ad} ${m.soyad}` : '?'} — Kalan: {fmtMoney(kalan, ana)}
                  </option>
                );
              })}
            </select>
            {seciliRez && (
              <div
                className="mt-2 px-3 py-2 rounded-md text-xs flex items-center gap-3 flex-wrap"
                style={{ background: 'var(--bone-warm)', color: 'var(--ink-soft)' }}
              >
                <span>Toplam: <strong style={{ color: 'var(--ink)' }}>{fmtMoney(seciliRez.toplamTutar, ana)}</strong></span>
                <span>Ödenen: <strong style={{ color: 'var(--success)' }}>{fmtMoney(seciliRezOdenen, ana)}</strong></span>
                <span>
                  Kalan: <strong style={{ color: seciliRezKalan > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtMoney(seciliRezKalan, ana)}</strong>
                </span>
              </div>
            )}
            {seciliRez?.grupId && (
              <div className="mt-2">
                <label className="htl-label">Tahsilat Hedefi</label>
                <div className="flex gap-4 flex-wrap items-center">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={form.tahsilatTipi === 'oda'}
                      onChange={() => setForm({ ...form, tahsilatTipi: 'oda' })} />
                    <span>Bu oda için</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={form.tahsilatTipi === 'grup'}
                      onChange={() => setForm({ ...form, tahsilatTipi: 'grup' })} />
                    <span>Grup geneli için</span>
                  </label>
                </div>
                {form.tahsilatTipi === 'grup' && (
                  <div className="text-[11px] mt-1" style={{ color: 'var(--ink-soft)' }}>
                    Tahsilat grubun ortak havuzuna yazılacak (oda bakiyesinden düşmez).
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

        {uygunHesaplar.length === 0 && (
          <div
            className="md:col-span-3 px-3 py-2 rounded-md text-sm flex items-start gap-2"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
          >
            <Icon name="alert-circle" size={16} />
            <span>
              <strong>{formPB} cinsinden aktif hesap yok.</strong> Önce Hesaplar sekmesinden bir {formPB} hesabı açın.
            </span>
          </div>
        )}

        {isFarkli && uygunHesaplar.length > 0 && (
          <div
            className="md:col-span-3 rounded-md p-3"
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
                <div className="font-display text-xl font-medium" style={{ color: 'var(--forest)' }}>
                  {aktifKur ? fmtMoney(tutarAnaPreview, ana) : '—'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="htl-label">Ödeme Yöntemi</label>
          <select
            className="htl-input"
            value={form.odemeYontemi || 'nakit'}
            onChange={(e) => setForm({ ...form, odemeYontemi: e.target.value })}
          >
            {ODEME_OPTS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
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
            {uygunHesaplar.map((h) => (
              <option key={h.id} value={h.id}>
                {h.ad} ({fmtMoney(getHesapBakiye(h.id, hesapHareketleri), formPB)})
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="htl-label">Açıklama</label>
          <input
            className="htl-input"
            value={form.aciklama || ''}
            onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TahsilatModal;
