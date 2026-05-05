/**
 * ReservationFormModal — yeni/düzenleme rezervasyon (en büyük modal).
 *
 * Bölümler:
 *   1) Üst grid: misafir, oda, tarihler, kişi sayısı, pansiyon, kanal, gece sayısı, durum, notlar
 *   2) Fiyat bölümü: 3 mod (gece / toplam / detay-her-gece-ayrı)
 *   3) Ödeme bölümü (sadece düzenlemede): toplam/ödenen/kalan + tahsilat geçmişi
 *      + "Yeni Ödeme Al" → TahsilatModal'ı rezervasyonId prefill ile açar
 *
 * Çakışma kontrolü: helpers/segmentler.checkOverlap (segment-aware)
 */
import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';
import { addDays, diffDays, todayISO, fmtMoney, fmtDateTR, generateRezKodu } from '../lib/helpers.js';
import { DURUM_OPTS, PANSIYON_OPTS, ODEME_OPTS, HESAP_TIP_INFO } from '../lib/constants.js';
import { checkOverlap } from '../helpers/segmentler.js';
import { deleteTahsilatWithHareket } from '../helpers/tahsilat.js';
import TahsilatModal from './TahsilatModal.jsx';

const DEFAULT = {
  odaId: '', odaTipiId: '', anaMisafirId: '',
  yetiskinSayisi: 2, cocukSayisi: 0,
  girisTarihi: '', cikisTarihi: '',
  durum: 'onayli', pansiyonTipi: 'oda-kahvalti', kanal: 'manuel',
  geceFiyati: 0, toplamTutar: 0,
  fiyatModu: 'gece',
  geceFiyatlari: [],
  notlar: '',
};

const ReservationFormModal = ({
  open,
  onClose,
  onSaved,
  rezervasyon = null,
  prefill = null,
  odalar = [],
  odaTipleri = [],
  misafirler = [],
  hesaplar = [],
  hesapHareketleri = [],
  tahsilatlar = [],
  reservations = [],
  kanallar = [],
  ana = 'EUR',
  userId = null,
}) => {
  const { show } = useToast();
  const [form, setForm] = useState(DEFAULT);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [tahsilatOpen, setTahsilatOpen] = useState(false);
  const [confirmTahDel, setConfirmTahDel] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (rezervasyon) {
      setForm({
        ...DEFAULT,
        ...rezervasyon,
        fiyatModu: rezervasyon.fiyatModu
          || (Array.isArray(rezervasyon.geceFiyatlari) && rezervasyon.geceFiyatlari.length ? 'detay' : 'gece'),
      });
    } else {
      const base = {
        ...DEFAULT,
        girisTarihi: todayISO(),
        cikisTarihi: addDays(todayISO(), 1),
      };
      if (prefill) {
        if (prefill.odaId) base.odaId = prefill.odaId;
        if (prefill.girisTarihi) base.girisTarihi = prefill.girisTarihi;
        if (prefill.cikisTarihi) base.cikisTarihi = prefill.cikisTarihi;
      }
      setForm(base);
    }
    setErr('');
  }, [open, rezervasyon?.id, prefill?.odaId, prefill?.girisTarihi, prefill?.cikisTarihi]);

  const geceSayisi = useMemo(() => {
    if (!form.girisTarihi || !form.cikisTarihi) return 0;
    return Math.max(0, diffDays(form.girisTarihi, form.cikisTarihi));
  }, [form.girisTarihi, form.cikisTarihi]);

  const geceTarihleri = useMemo(() => {
    if (!form.girisTarihi || geceSayisi <= 0) return [];
    return Array.from({ length: geceSayisi }, (_, i) => addDays(form.girisTarihi, i));
  }, [form.girisTarihi, geceSayisi]);

  // Oda seçilince oda tipi otomatik gelsin + varsayılan fiyat
  useEffect(() => {
    if (!form.odaId) return;
    const oda = odalar.find((o) => o.id === form.odaId);
    if (oda && oda.odaTipiId !== form.odaTipiId) {
      const tip = odaTipleri.find((t) => t.id === oda.odaTipiId);
      setForm((f) => ({
        ...f,
        odaTipiId: oda.odaTipiId,
        geceFiyati: f.geceFiyati || tip?.varsayilanFiyat || 0,
      }));
    }
  }, [form.odaId]);

  // Detay moduna girince geceFiyatlari array'ini doldur
  useEffect(() => {
    if (form.fiyatModu !== 'detay') return;
    setForm((f) => {
      const mevcut = Array.isArray(f.geceFiyatlari) ? f.geceFiyatlari : [];
      const yeniArr = Array.from({ length: geceSayisi }, (_, i) => {
        if (mevcut[i] != null && Number(mevcut[i]) > 0) return Number(mevcut[i]);
        return Number(f.geceFiyati) || 0;
      });
      return { ...f, geceFiyatlari: yeniArr };
    });
  }, [form.fiyatModu, geceSayisi]);

  // Toplam ↔ gece fiyatı senkron
  useEffect(() => {
    setForm((f) => {
      if (geceSayisi <= 0) return { ...f, toplamTutar: 0 };
      if (f.fiyatModu === 'toplam') {
        const gf = (Number(f.toplamTutar) || 0) / geceSayisi;
        return { ...f, geceFiyati: gf };
      }
      if (f.fiyatModu === 'detay') {
        const arr = Array.isArray(f.geceFiyatlari) ? f.geceFiyatlari : [];
        const t = arr.reduce((s, x) => s + (Number(x) || 0), 0);
        const gf = geceSayisi > 0 ? t / geceSayisi : 0;
        return { ...f, toplamTutar: t, geceFiyati: gf };
      }
      const t = (Number(f.geceFiyati) || 0) * geceSayisi;
      return { ...f, toplamTutar: t };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fiyatModu, form.geceFiyati, form.toplamTutar, form.geceFiyatlari?.join(','), geceSayisi]);

  const handleSave = async () => {
    setErr('');
    if (!form.odaId) return setErr('Oda seçimi zorunludur.');
    if (!form.anaMisafirId) return setErr('Ana misafir seçimi zorunludur.');
    if (!form.girisTarihi || !form.cikisTarihi) return setErr('Giriş ve çıkış tarihleri zorunludur.');
    if (form.cikisTarihi <= form.girisTarihi) return setErr('Çıkış tarihi giriş tarihinden sonra olmalı.');
    if (checkOverlap(form.odaId, form.girisTarihi, form.cikisTarihi, rezervasyon?.id, reservations)) {
      return setErr('Bu odada seçtiğiniz tarihlerde başka aktif bir rezervasyon var.');
    }

    const payload = {
      ...form,
      geceSayisi,
      yetiskinSayisi: Number(form.yetiskinSayisi) || 0,
      cocukSayisi: Number(form.cocukSayisi) || 0,
      geceFiyati: Number(form.geceFiyati) || 0,
      toplamTutar: Number(form.toplamTutar) || 0,
      fiyatModu: form.fiyatModu || 'gece',
      geceFiyatlari: form.fiyatModu === 'detay' && Array.isArray(form.geceFiyatlari)
        ? form.geceFiyatlari.map((x) => Number(x) || 0)
        : [],
    };

    setSaving(true);
    try {
      if (rezervasyon) {
        await db.update('rezervasyonlar', rezervasyon.id, payload);
        show('Rezervasyon güncellendi.');
      } else {
        payload.rezervasyonKodu = await generateRezKodu(db);
        payload.olusturmaTarihi = new Date().toISOString();
        await db.add('rezervasyonlar', payload);
        show('Rezervasyon oluşturuldu.');
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErr('Hata: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const isExisting = !!rezervasyon;
  const rezTahsilatlar = isExisting
    ? tahsilatlar.filter((t) => t.rezervasyonId === rezervasyon.id)
    : [];
  const odenen = rezTahsilatlar.reduce(
    (s, t) => s + Number(t.tutarAna != null ? t.tutarAna : t.tutar || 0),
    0
  );
  const toplam = Number(form.toplamTutar) || 0;
  const kalan = toplam - odenen;

  const tahsilatSil = async (tahsilatId) => {
    setConfirmTahDel(null);
    try {
      await deleteTahsilatWithHareket(tahsilatId);
      show('Tahsilat silindi.');
      onSaved?.();
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    }
  };

  const aktifKanallar = kanallar.filter((k) => k.aktif !== false);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={rezervasyon ? `Rezervasyon Düzenle — ${rezervasyon.rezervasyonKodu}` : 'Yeni Rezervasyon'}
        footer={
          <>
            <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
            <button type="button" className="htl-btn htl-btn-primary" onClick={handleSave} disabled={saving}>
              <Icon name="save" size={16} stroke="white" />
              <span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
            </button>
          </>
        }
      >
        {err && (
          <div className="mb-4 px-3 py-2 rounded-md text-sm flex items-center gap-2"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <Icon name="alert-circle" size={16} />{err}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="htl-label">Ana Misafir *</label>
            <select className="htl-input" value={form.anaMisafirId || ''} onChange={(e) => setForm({ ...form, anaMisafirId: e.target.value })}>
              <option value="">— Seçiniz —</option>
              {misafirler.map((m) => <option key={m.id} value={m.id}>{m.ad} {m.soyad}{m.telefon ? ` · ${m.telefon}` : ''}</option>)}
            </select>
            {misafirler.length === 0 && (
              <div className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Önce Misafirler sayfasından misafir ekleyin.</div>
            )}
          </div>
          <div>
            <label className="htl-label">Oda *</label>
            <select className="htl-input" value={form.odaId || ''} onChange={(e) => setForm({ ...form, odaId: e.target.value })}>
              <option value="">— Seçiniz —</option>
              {odalar.map((o) => {
                const t = odaTipleri.find((x) => x.id === o.odaTipiId);
                return <option key={o.id} value={o.id}>Oda {o.odaNumarasi} — {t?.ad || ''}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="htl-label">Giriş Tarihi *</label>
            <input type="date" className="htl-input" value={form.girisTarihi || ''} onChange={(e) => setForm({ ...form, girisTarihi: e.target.value })} />
          </div>
          <div>
            <label className="htl-label">Çıkış Tarihi *</label>
            <input type="date" className="htl-input" value={form.cikisTarihi || ''} onChange={(e) => setForm({ ...form, cikisTarihi: e.target.value })} />
          </div>
          <div>
            <label className="htl-label">Yetişkin</label>
            <input type="number" min="1" className="htl-input" value={form.yetiskinSayisi || 0} onChange={(e) => setForm({ ...form, yetiskinSayisi: e.target.value })} />
          </div>
          <div>
            <label className="htl-label">Çocuk</label>
            <input type="number" min="0" className="htl-input" value={form.cocukSayisi || 0} onChange={(e) => setForm({ ...form, cocukSayisi: e.target.value })} />
          </div>
          <div>
            <label className="htl-label">Pansiyon</label>
            <select className="htl-input" value={form.pansiyonTipi || 'oda-kahvalti'} onChange={(e) => setForm({ ...form, pansiyonTipi: e.target.value })}>
              {PANSIYON_OPTS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </div>
          <div>
            <label className="htl-label">Kanal</label>
            <select className="htl-input" value={form.kanal || 'manuel'} onChange={(e) => setForm({ ...form, kanal: e.target.value })}>
              {aktifKanallar.length === 0 && <option value="manuel">Manuel</option>}
              {aktifKanallar.map((k) => <option key={k.kod || k.id} value={k.kod || k.id}>{k.ad}</option>)}
            </select>
          </div>
          <div>
            <label className="htl-label">Gece Sayısı</label>
            <input type="text" className="htl-input" readOnly value={geceSayisi} style={{ background: 'var(--bone-warm)' }} />
          </div>
          <div>
            <label className="htl-label">Durum</label>
            <select className="htl-input" value={form.durum || 'onayli'} onChange={(e) => setForm({ ...form, durum: e.target.value })}>
              {DURUM_OPTS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="htl-label">Notlar</label>
            <textarea rows="2" className="htl-input" value={form.notlar || ''} onChange={(e) => setForm({ ...form, notlar: e.target.value })} />
          </div>
        </div>

        {/* Fiyat */}
        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--line-soft)' }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="font-display text-lg font-medium" style={{ color: 'var(--forest)' }}>
              <Icon name="tag" size={18} className="inline mr-1.5" stroke="var(--brass)" />
              Fiyat ({geceSayisi} gece)
            </h4>
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bone-warm)' }}>
              {[
                { v: 'gece', l: 'Gece Fiyatı' },
                { v: 'toplam', l: 'Toplam Tutar' },
                { v: 'detay', l: 'Gece Bazında' },
              ].map((t) => (
                <button key={t.v} type="button"
                  onClick={() => setForm({ ...form, fiyatModu: t.v })}
                  disabled={t.v === 'detay' && geceSayisi === 0}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition"
                  style={{
                    background: form.fiyatModu === t.v ? 'var(--bone-light)' : 'transparent',
                    color: form.fiyatModu === t.v ? 'var(--forest)' : 'var(--ink-soft)',
                    boxShadow: form.fiyatModu === t.v ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                  }}>{t.l}</button>
              ))}
            </div>
          </div>

          {form.fiyatModu === 'gece' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="htl-label">Gece Fiyatı ({ana})</label>
                <input type="number" min="0" step="0.01" className="htl-input" value={form.geceFiyati || ''} onChange={(e) => setForm({ ...form, geceFiyati: e.target.value })} />
                <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>{geceSayisi} gece × {fmtMoney(form.geceFiyati || 0, ana)}</div>
              </div>
              <div className="flex items-end">
                <div className="rounded-lg p-3 w-full" style={{ background: 'var(--bone-warm)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Toplam Tutar</div>
                  <div className="font-display text-2xl font-medium" style={{ color: 'var(--forest)' }}>{fmtMoney(form.toplamTutar || 0, ana)}</div>
                </div>
              </div>
            </div>
          )}

          {form.fiyatModu === 'toplam' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="htl-label">Toplam Tutar ({ana})</label>
                <input type="number" min="0" step="0.01" className="htl-input" value={form.toplamTutar || ''} onChange={(e) => setForm({ ...form, toplamTutar: e.target.value })} />
              </div>
              <div className="flex items-end">
                <div className="rounded-lg p-3 w-full" style={{ background: 'var(--bone-warm)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Gece Başına</div>
                  <div className="font-display text-2xl font-medium" style={{ color: 'var(--forest)' }}>
                    {geceSayisi > 0 ? fmtMoney((Number(form.toplamTutar) || 0) / geceSayisi, ana) : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {form.fiyatModu === 'detay' && geceSayisi > 0 && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
                {geceTarihleri.map((tarih, i) => (
                  <div key={tarih}>
                    <div className="text-[11px] mb-1 text-center" style={{ color: 'var(--ink-soft)' }}>
                      {new Date(tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                    </div>
                    <input type="number" min="0" step="0.01" className="htl-input"
                      style={{ textAlign: 'center', fontWeight: 500 }}
                      value={(form.geceFiyatlari && form.geceFiyatlari[i] != null) ? form.geceFiyatlari[i] : ''}
                      onChange={(e) => {
                        const yeni = [...(form.geceFiyatlari || [])];
                        yeni[i] = e.target.value;
                        setForm({ ...form, geceFiyatlari: yeni });
                      }} />
                  </div>
                ))}
              </div>
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: 'var(--bone-warm)' }}>
                <div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Toplam Tutar</div>
                  <div className="font-display text-2xl font-medium" style={{ color: 'var(--forest)' }}>{fmtMoney(form.toplamTutar || 0, ana)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Ortalama Gece</div>
                  <div className="font-display text-lg font-medium" style={{ color: 'var(--forest)' }}>{fmtMoney(form.geceFiyati || 0, ana)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ödeme bölümü — sadece düzenlemede */}
        {isExisting && (
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--line-soft)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-display text-lg font-medium" style={{ color: 'var(--forest)' }}>
                <Icon name="wallet" size={18} className="inline mr-1.5" stroke="var(--brass)" />
                Ödeme & Bakiye
              </h4>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg p-3" style={{ background: 'var(--bone-warm)' }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Toplam</div>
                <div className="font-display text-xl font-medium mt-1">{fmtMoney(toplam, ana)}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--success-soft)' }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--success)' }}>Ödenen</div>
                <div className="font-display text-xl font-medium mt-1" style={{ color: 'var(--success)' }}>{fmtMoney(odenen, ana)}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: kalan > 0 ? 'var(--danger-soft)' : 'var(--success-soft)' }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: kalan > 0 ? 'var(--danger)' : 'var(--success)' }}>Kalan</div>
                <div className="font-display text-xl font-medium mt-1" style={{ color: kalan > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtMoney(kalan, ana)}</div>
              </div>
            </div>

            <button
              type="button"
              className="htl-btn htl-btn-accent w-full justify-center mb-3"
              onClick={() => setTahsilatOpen(true)}
              disabled={hesaplar.length === 0}
            >
              <Icon name="plus" size={16} stroke="white" />
              <span>Yeni Ödeme Al{kalan > 0 ? ` (Kalan: ${fmtMoney(kalan, ana)})` : ''}</span>
            </button>

            {rezTahsilatlar.length > 0 && (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--line-soft)' }}>
                <table className="htl-table">
                  <thead>
                    <tr><th>Tarih</th><th>Yöntem</th><th>Hesap</th><th>Açıklama</th><th className="text-right">Tutar</th><th></th></tr>
                  </thead>
                  <tbody>
                    {[...rezTahsilatlar].sort((a, b) => `${b.tarih}`.localeCompare(`${a.tarih}`)).map((t) => {
                      const opt = ODEME_OPTS.find((o) => o.v === t.odemeYontemi);
                      const hesap = hesaplar.find((h) => h.id === t.hesapId);
                      const tipInfo = hesap ? HESAP_TIP_INFO(hesap.tip) : null;
                      return (
                        <tr key={t.id}>
                          <td className="text-sm">{fmtDateTR(t.tarih)}</td>
                          <td><span className="htl-badge htl-badge-info">{opt?.l || t.odemeYontemi}</span></td>
                          <td className="text-sm">
                            {hesap ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: tipInfo.renk }} />
                                <span>{hesap.ad}</span>
                              </div>
                            ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                          </td>
                          <td className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t.aciklama || '-'}</td>
                          <td className="text-right font-medium" style={{ color: 'var(--success)' }}>
                            <div>{fmtMoney(t.tutar, t.paraBirimi || ana)}</div>
                            {t.paraBirimi && t.paraBirimi !== ana && t.tutarAna != null && (
                              <div className="text-[10px] font-normal" style={{ color: 'var(--ink-soft)' }}>≈ {fmtMoney(t.tutarAna, ana)}</div>
                            )}
                          </td>
                          <td>
                            <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setConfirmTahDel(t)}>
                              <Icon name="trash-2" size={14} stroke="var(--danger)" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <ConfirmModal open={!!confirmTahDel} title="Tahsilatı Sil"
          msg="Bu ödeme ve hesap hareketi silinecek. Emin misiniz?"
          onConfirm={() => tahsilatSil(confirmTahDel.id)}
          onCancel={() => setConfirmTahDel(null)} />
      </Modal>

      {isExisting && (
        <TahsilatModal
          open={tahsilatOpen}
          onClose={() => setTahsilatOpen(false)}
          onSaved={onSaved}
          target={null}
          hesaplar={hesaplar}
          hesapHareketleri={hesapHareketleri}
          tahsilatlar={tahsilatlar}
          rezervasyonlar={[rezervasyon]}
          misafirler={misafirler}
          ana={ana}
          userId={userId}
        />
      )}
    </>
  );
};

export default ReservationFormModal;
