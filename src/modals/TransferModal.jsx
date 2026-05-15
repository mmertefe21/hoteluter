/**
 * TransferModal — hesaplar arası transfer (aynı PB veya döviz).
 *
 * 2 mod:
 *   - 'normal' : kaynak ve hedef aynı PB → tek tutar (yapTransfer)
 *   - 'doviz'  : farklı PB → çıkan + giren ayrı (yapDovizTransfer)
 * Kaynak/hedef PB'sine göre tab otomatik geçer; kullanıcı manuel de seçebilir
 * ama "aynı PB ama döviz tab'ı" izinli (örn. parite hesaplamak için), "farklı PB ama
 * normal tab'ı" engellidir.
 *
 * Props:
 *   open, onClose, onSaved
 *   hesaplar         : Array
 *   hesapHareketleri : Array (kaynak bakiye preview için)
 *   ana              : string
 *   userId           : string
 */
import { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtMoney, todayISO } from '../lib/helpers.js';
import { cevirKur } from '../lib/kur.js';
import { getHesapBakiye } from '../helpers/exchange-utils.js';
import { yapTransfer, yapDovizTransfer } from '../helpers/transfer.js';
import { logAksiyon } from '../helpers/aktiviteLog.js';

const TransferModal = ({
  open,
  onClose,
  onSaved,
  hesaplar = [],
  hesapHareketleri = [],
  ana = 'EUR',
  userId = null,
  giderKategorileri = [],
}) => {
  const { show } = useToast();
  const [tab, setTab] = useState('normal');
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [komisyonMod, setKomisyonMod] = useState('yuzde');

  const aktifHesaplar = hesaplar.filter((h) => h.aktif !== false);

  useEffect(() => {
    if (!open) return;
    setForm({
      kaynakHesapId: aktifHesaplar[0]?.id || '',
      hedefHesapId: aktifHesaplar[1]?.id || '',
      tutar: '',
      cikanTutar: '',
      girenTutar: '',
      tarih: todayISO(),
      aciklama: '',
      komisyon: '',
    });
    setTab('normal');
    setKomisyonMod('yuzde');
  }, [open]);

  const kaynak = form.kaynakHesapId ? hesaplar.find((h) => h.id === form.kaynakHesapId) : null;
  const hedef = form.hedefHesapId ? hesaplar.find((h) => h.id === form.hedefHesapId) : null;
  const kPB = kaynak?.paraBirimi || ana;
  const hPB = hedef?.paraBirimi || ana;
  const ayniPB = kaynak && hedef && kPB === hPB;
  const canDoviz = !!kaynak && !!hedef && form.kaynakHesapId !== form.hedefHesapId;

  // Kaynak/hedef PB değişince tab otomatik geçişi
  useEffect(() => {
    if (!kaynak || !hedef) return;
    if (!ayniPB && tab === 'normal') setTab('doviz');
    if (ayniPB && tab === 'doviz') setTab('normal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.kaynakHesapId, form.hedefHesapId]);

  const isPosToBank = tab === 'normal' && ayniPB && kaynak?.tip === 'pos' && hedef?.tip === 'banka';
  console.log('isPosToBank debug:', { tab, ayniPB, kaynakTip: kaynak?.tip, hedefTip: hedef?.tip, isPosToBank });
  const komisyonTutar = komisyonMod === 'yuzde'
    ? Number(form.tutar || 0) * Number(form.komisyon || 0) / 100
    : Number(form.komisyon || 0);

  const otoKurDoviz = canDoviz && kPB !== hPB ? cevirKur(1, kPB, hPB) : null;
  const efKur =
    Number(form.cikanTutar) > 0 && Number(form.girenTutar) > 0
      ? Number(form.girenTutar) / Number(form.cikanTutar)
      : null;

  const save = async () => {
    if (!form.kaynakHesapId || !form.hedefHesapId) {
      return show('Kaynak ve hedef hesap seçilmeli.', 'error');
    }
    if (form.kaynakHesapId === form.hedefHesapId) {
      return show('Kaynak ve hedef aynı olamaz.', 'error');
    }

    setSaving(true);
    try {
      if (tab === 'normal') {
        if (!ayniPB) {
          throw new Error('Farklı para birimleri için "Döviz Transferi" sekmesini kullanın.');
        }
        if (!form.tutar || Number(form.tutar) <= 0) {
          throw new Error("Tutar 0'dan büyük olmalı.");
        }
        const k = isPosToBank ? komisyonTutar : 0;
        if (k < 0) throw new Error("Komisyon negatif olamaz.");
        if (k > Number(form.tutar)) throw new Error("Komisyon transfer tutarından büyük olamaz.");
        const bankaMasraflariKat = giderKategorileri.find((g) => g.ad === 'Banka Masrafları');
        const result = await yapTransfer(
          {
            kaynakHesapId: form.kaynakHesapId,
            hedefHesapId: form.hedefHesapId,
            tutar: Number(form.tutar),
            tarih: form.tarih,
            aciklama: form.aciklama || '',
            komisyon: isPosToBank ? k : 0,
            bankaMasraflariKategoriId: (isPosToBank && k > 0) ? (bankaMasraflariKat?.id || null) : null,
          },
          userId,
          ana
        );
        const komisyonNot = isPosToBank && k > 0 ? `, komisyon: ${k.toFixed(2)} ${kPB}` : '';
        void logAksiyon({ aksiyon: 'transfer.olustur', aciklama: `${kaynak.ad} → ${hedef.ad} transfer yaptı, ${form.tutar} ${kPB}${komisyonNot}`, hedefTip: 'transfer', hedefId: result?.transferId ?? null });
        show('Transfer yapıldı.');
      } else {
        if (!form.cikanTutar || Number(form.cikanTutar) <= 0) {
          throw new Error("Çıkan tutar 0'dan büyük olmalı.");
        }
        if (!form.girenTutar || Number(form.girenTutar) <= 0) {
          throw new Error("Giren tutar 0'dan büyük olmalı.");
        }
        const result = await yapDovizTransfer(
          {
            kaynakHesapId: form.kaynakHesapId,
            hedefHesapId: form.hedefHesapId,
            cikanTutar: Number(form.cikanTutar),
            girenTutar: Number(form.girenTutar),
            tarih: form.tarih,
            aciklama: form.aciklama || '',
          },
          userId
        );
        void logAksiyon({ aksiyon: 'transfer.olustur', aciklama: `${kaynak.ad} → ${hedef.ad} transfer yaptı, ${form.cikanTutar} ${kPB}`, hedefTip: 'transfer', hedefId: result?.transferId ?? null });
        show('Döviz transferi yapıldı.');
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const tabDisabled = !ayniPB && kaynak && hedef;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hesaplar Arası Transfer"
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
            disabled={saving}
          >
            <Icon name={tab === 'doviz' ? 'arrow-right-left' : 'arrow-left-right'} size={16} stroke="white" />
            <span>
              {saving
                ? 'Kaydediliyor...'
                : tab === 'doviz'
                  ? 'Döviz Transferi Yap'
                  : 'Transfer Yap'}
            </span>
          </button>
        </>
      }
    >
      <div className="flex gap-1 mb-4 -mt-2 p-1 rounded-lg" style={{ background: 'var(--bone-warm)', width: 'fit-content' }}>
        <button
          type="button"
          disabled={tabDisabled}
          onClick={() => setTab('normal')}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition"
          style={{
            background: tab === 'normal' ? 'var(--bone-light)' : 'transparent',
            color: tab === 'normal' ? 'var(--forest)' : 'var(--ink-soft)',
            boxShadow: tab === 'normal' ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            opacity: tabDisabled ? 0.4 : 1,
            cursor: tabDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          <Icon name="arrow-left-right" size={14} className="inline mr-1" />
          Aynı Para Birimi
        </button>
        <button
          type="button"
          onClick={() => setTab('doviz')}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition"
          style={{
            background: tab === 'doviz' ? 'var(--bone-light)' : 'transparent',
            color: tab === 'doviz' ? 'var(--forest)' : 'var(--ink-soft)',
            boxShadow: tab === 'doviz' ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
          }}
        >
          <Icon name="arrow-right-left" size={14} className="inline mr-1" />
          Döviz Transferi
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="htl-label">Kaynak Hesap (Çıkış)</label>
          <select
            className="htl-input"
            value={form.kaynakHesapId || ''}
            onChange={(e) => setForm({ ...form, kaynakHesapId: e.target.value })}
          >
            <option value="">— Seçiniz —</option>
            {aktifHesaplar.map((h) => {
              const pb = h.paraBirimi || ana;
              return (
                <option key={h.id} value={h.id}>
                  {h.ad} ({fmtMoney(getHesapBakiye(h.id, hesapHareketleri), pb)})
                </option>
              );
            })}
          </select>
          {kaynak && (
            <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
              {kPB} · Bakiye:{' '}
              <strong>{fmtMoney(getHesapBakiye(form.kaynakHesapId, hesapHareketleri), kPB)}</strong>
            </div>
          )}
        </div>

        <div>
          <label className="htl-label">Hedef Hesap (Giriş)</label>
          <select
            className="htl-input"
            value={form.hedefHesapId || ''}
            onChange={(e) => setForm({ ...form, hedefHesapId: e.target.value })}
          >
            <option value="">— Seçiniz —</option>
            {aktifHesaplar.map((h) => {
              const pb = h.paraBirimi || ana;
              return (
                <option key={h.id} value={h.id}>
                  {h.ad} ({pb})
                </option>
              );
            })}
          </select>
          {hedef && (
            <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
              {hPB} · Bakiye:{' '}
              <strong>{fmtMoney(getHesapBakiye(form.hedefHesapId, hesapHareketleri), hPB)}</strong>
            </div>
          )}
        </div>

        {kaynak && hedef && !ayniPB && tab === 'normal' && (
          <div
            className="md:col-span-2 px-3 py-2 rounded-md text-sm flex items-center gap-2"
            style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
          >
            <Icon name="alert-circle" size={16} />
            <span>
              Kaynak ({kPB}) ve hedef ({hPB}) farklı para birimlerinde.{' '}
              <strong>"Döviz Transferi"</strong> sekmesini kullanın.
            </span>
          </div>
        )}

        {tab === 'normal' && ayniPB && (
          <>
            <div>
              <label className="htl-label">Tutar ({kPB}) *</label>
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
              <label className="htl-label">Tarih</label>
              <input
                type="date"
                className="htl-input"
                value={form.tarih || ''}
                onChange={(e) => setForm({ ...form, tarih: e.target.value })}
              />
            </div>
            {isPosToBank && (
              <>
                <div>
                  <label className="htl-label">POS Komisyonu</label>
                  <div className="flex gap-2 items-center">
                    <div className="flex rounded-md overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--line)' }}>
                      <button
                        type="button"
                        onClick={() => setKomisyonMod('yuzde')}
                        className="px-2.5 py-1.5 text-xs font-medium transition"
                        style={{
                          background: komisyonMod === 'yuzde' ? 'var(--brass)' : 'var(--bone-warm)',
                          color: komisyonMod === 'yuzde' ? 'white' : 'var(--ink-soft)',
                        }}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setKomisyonMod('tutar')}
                        className="px-2.5 py-1.5 text-xs font-medium transition"
                        style={{
                          background: komisyonMod === 'tutar' ? 'var(--brass)' : 'var(--bone-warm)',
                          color: komisyonMod === 'tutar' ? 'white' : 'var(--ink-soft)',
                        }}
                      >
                        {kPB}
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="htl-input"
                      placeholder={komisyonMod === 'yuzde' ? '1.65' : '5.00'}
                      value={form.komisyon || ''}
                      onChange={(e) => setForm({ ...form, komisyon: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-end pb-1">
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                    {Number(form.tutar) > 0 ? (
                      <>
                        Gönderilecek: <strong>{Number(form.tutar).toFixed(2)} {kPB}</strong>
                        {' — '}Komisyon: <strong>{komisyonTutar.toFixed(2)} {kPB}{komisyonMod === 'yuzde' && Number(form.komisyon) > 0 ? ` (%${Number(form.komisyon).toFixed(2)})` : ''}</strong>
                        {' — '}Bankaya geçecek: <strong>{(Number(form.tutar) - komisyonTutar).toFixed(2)} {kPB}</strong>
                      </>
                    ) : (
                      <span>POS komisyon alanı — tutar girince hesaplanır.</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'doviz' && kaynak && hedef && (
          <>
            <div>
              <label className="htl-label">Çıkan Tutar ({kPB}) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="htl-input"
                placeholder={`${kPB} olarak`}
                value={form.cikanTutar || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  let yeniGiren = form.girenTutar;
                  if (otoKurDoviz && Number(v) > 0) {
                    yeniGiren = (Number(v) * otoKurDoviz).toFixed(2);
                  }
                  setForm({ ...form, cikanTutar: v, girenTutar: yeniGiren });
                }}
              />
            </div>
            <div>
              <label className="htl-label">Giren Tutar ({hPB}) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="htl-input"
                placeholder={`${hPB} olarak`}
                value={form.girenTutar || ''}
                onChange={(e) => setForm({ ...form, girenTutar: e.target.value })}
              />
            </div>

            <div
              className="md:col-span-2 rounded-md p-3"
              style={{ background: 'var(--brass-soft)', border: '1px solid var(--brass-light)' }}
            >
              <div className="grid md:grid-cols-3 gap-3 items-center text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                    Canlı Kur (referans)
                  </div>
                  <div className="font-display text-base font-medium" style={{ color: 'var(--forest)' }}>
                    {otoKurDoviz ? `1 ${kPB} = ${otoKurDoviz.toFixed(4)} ${hPB}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                    Kullanılan Kur
                  </div>
                  <div className="font-display text-base font-medium" style={{ color: 'var(--brass)' }}>
                    {efKur ? `1 ${kPB} = ${efKur.toFixed(4)} ${hPB}` : '—'}
                  </div>
                </div>
                <div>
                  {otoKurDoviz && (
                    <button
                      type="button"
                      className="htl-btn htl-btn-ghost text-xs"
                      onClick={() => {
                        if (Number(form.cikanTutar) > 0) {
                          setForm({
                            ...form,
                            girenTutar: (Number(form.cikanTutar) * otoKurDoviz).toFixed(2),
                          });
                        }
                      }}
                    >
                      <Icon name="refresh-cw" size={12} />
                      <span>Canlı Kuru Uygula</span>
                    </button>
                  )}
                </div>
              </div>
              {efKur && otoKurDoviz && Math.abs(efKur - otoKurDoviz) / otoKurDoviz > 0.05 && (
                <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: 'var(--warn)' }}>
                  <Icon name="alert-triangle" size={12} />
                  <span>
                    Kullanılan kur canlı kurdan %
                    {((Math.abs(efKur - otoKurDoviz) / otoKurDoviz) * 100).toFixed(1)} sapıyor.
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="htl-label">Tarih</label>
              <input
                type="date"
                className="htl-input"
                value={form.tarih || ''}
                onChange={(e) => setForm({ ...form, tarih: e.target.value })}
              />
            </div>
            <div></div>
          </>
        )}

        <div className="md:col-span-2">
          <label className="htl-label">Açıklama</label>
          <input
            className="htl-input"
            placeholder={
              tab === 'doviz' ? 'Örn: Euro kasadan TL hesaba bozdurma' : 'Örn: Kasa fazlasını bankaya yatırma'
            }
            value={form.aciklama || ''}
            onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TransferModal;
