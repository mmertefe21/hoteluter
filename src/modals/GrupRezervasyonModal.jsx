/**
 * GrupRezervasyonModal — 2 adımlı grup rezervasyon oluşturma.
 *
 * Adım 1: Grup bilgileri (ad, iletişim, renk, notlar)
 * Adım 2: Oda satırları (her satırda oda + ana misafir + tarih + fiyat)
 *
 * Save flow: writeBatch ile gruplar/{newId} + N adet rezervasyonlar/{newId}
 * (her rez: ...satir + grupId + rezervasyonKodu + olusturmaTarihi + durum:'onayli')
 *
 * Çakışma kontrolü: her satır için checkOverlap (segment-aware), birinde
 * çakışma varsa save iptal edilir (atomik).
 *
 * Edit modu YOK — düzenleme için GrupDetayModal kullanılır.
 *
 * Props:
 *   open, onClose, onSaved(grupId)
 *   prefill         : { odaId?, girisTarihi?, cikisTarihi? } — ilk satıra
 *   mevcutGrupId    : string  — varsa "Yeni grup yaratma, sadece bu gruba oda ekle"
 *                     modunda çalışır (Adım 1 gizli, sadece Adım 2 odalar listesi)
 *   gruplarMevcut   : Array — yeni grup için renk default rotation
 *   odalar, odaTipleri, misafirler, kanallar, reservations
 *   ana, userId
 */
import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';
import { addDays, todayISO, fmtMoney, generateRezKodu } from '../lib/helpers.js';
import { PARA_BIRIMI_INFO, PRESET_RENKLER, PANSIYON_OPTS } from '../lib/constants.js';
import { checkOverlap } from '../helpers/segmentler.js';
import MisafirFormModal from './MisafirFormModal.jsx';

const DEFAULT_GRUP = { ad: '', iletisimKisi: '', telefon: '', email: '', notlar: '', renk: PRESET_RENKLER[0] };

const yeniSatir = (prefill = {}, varsayilanGiris, varsayilanCikis) => ({
  tempId: `s${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  odaId: prefill.odaId || '',
  odaTipiId: '',
  anaMisafirId: '',
  yetiskinSayisi: 2,
  cocukSayisi: 0,
  girisTarihi: prefill.girisTarihi || varsayilanGiris,
  cikisTarihi: prefill.cikisTarihi || varsayilanCikis,
  kanal: 'manuel',
  pansiyonTipi: 'oda-kahvalti',
  geceFiyati: 0,
});

const GrupRezervasyonModal = ({
  open,
  onClose,
  onSaved,
  prefill = null,
  mevcutGrupId = null,
  gruplarMevcut = [],
  odalar = [],
  odaTipleri = [],
  misafirler = [],
  kanallar = [],
  reservations = [],
  ana = 'EUR',
  userId = null,
}) => {
  const { show } = useToast();
  const [step, setStep] = useState(1);
  const [grup, setGrup] = useState(DEFAULT_GRUP);
  const [satirlar, setSatirlar] = useState([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [yeniMisafirFor, setYeniMisafirFor] = useState(null); // { tempId, prefillAd, prefillSoyad }

  useEffect(() => {
    if (!open) return;
    setErr('');
    setStep(mevcutGrupId ? 2 : 1);
    if (!mevcutGrupId) {
      const renkIdx = (gruplarMevcut.length || 0) % PRESET_RENKLER.length;
      setGrup({ ...DEFAULT_GRUP, renk: PRESET_RENKLER[renkIdx] });
    }
    const g = todayISO();
    const c = addDays(g, 1);
    setSatirlar([yeniSatir(prefill || {}, g, c)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mevcutGrupId]);

  const aktifKanallar = kanallar.filter((k) => k.aktif !== false);
  const sortedOdalar = useMemo(
    () => [...odalar].sort((a, b) => `${a.odaNumarasi}`.localeCompare(`${b.odaNumarasi}`)),
    [odalar]
  );

  const updateSatir = (tempId, patch) => {
    setSatirlar((arr) => arr.map((s) => {
      if (s.tempId !== tempId) return s;
      const yeni = { ...s, ...patch };
      // Oda seçildi → odaTipiId + varsayılan fiyat
      if (patch.odaId && patch.odaId !== s.odaId) {
        const oda = odalar.find((o) => o.id === patch.odaId);
        if (oda) {
          yeni.odaTipiId = oda.odaTipiId;
          if (!s.geceFiyati || Number(s.geceFiyati) === 0) {
            const tip = odaTipleri.find((t) => t.id === oda.odaTipiId);
            yeni.geceFiyati = tip?.varsayilanFiyat || 0;
          }
        }
      }
      return yeni;
    }));
  };

  const odaEkle = () => {
    const son = satirlar[satirlar.length - 1];
    setSatirlar((arr) => [
      ...arr,
      yeniSatir({}, son?.girisTarihi || todayISO(), son?.cikisTarihi || addDays(todayISO(), 1)),
    ]);
  };

  const odaSil = (tempId) => {
    if (satirlar.length <= 1) return show('En az 1 oda satırı gerekli.', 'error');
    setSatirlar((arr) => arr.filter((s) => s.tempId !== tempId));
  };

  const ileri = () => {
    if (!grup.ad?.trim()) return setErr('Grup adı zorunludur.');
    setErr('');
    setStep(2);
  };

  const handleSave = async () => {
    setErr('');
    // Validation
    if (!mevcutGrupId && !grup.ad?.trim()) return setErr('Grup adı zorunludur.');
    if (satirlar.length === 0) return setErr('En az 1 oda satırı gerekli.');

    for (const s of satirlar) {
      if (!s.odaId) return setErr('Tüm satırlarda oda seçilmeli.');
      if (!s.anaMisafirId) return setErr('Tüm satırlarda ana misafir seçilmeli.');
      if (!s.girisTarihi || !s.cikisTarihi) return setErr('Tüm satırlarda tarih girilmeli.');
      if (s.cikisTarihi <= s.girisTarihi) return setErr('Çıkış tarihi giriş tarihinden sonra olmalı.');
    }

    // Çakışma kontrolü — satırların kendi aralarındaki ve mevcut rez'lerle
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i];
      // Mevcut rez'lerle çakışma
      if (checkOverlap(s.odaId, s.girisTarihi, s.cikisTarihi, null, reservations)) {
        const oda = odalar.find((o) => o.id === s.odaId);
        return setErr(`Oda ${oda?.odaNumarasi || s.odaId} için tarih çakışması var (mevcut rezervasyon).`);
      }
      // Aynı grup içindeki diğer satırlarla çakışma
      for (let j = i + 1; j < satirlar.length; j++) {
        const o = satirlar[j];
        if (s.odaId === o.odaId
          && !(s.cikisTarihi <= o.girisTarihi || s.girisTarihi >= o.cikisTarihi)) {
          const oda = odalar.find((x) => x.id === s.odaId);
          return setErr(`Oda ${oda?.odaNumarasi || s.odaId} aynı grupta iki kez çakışan tarihte seçilmiş.`);
        }
      }
    }

    setSaving(true);
    try {
      const batch = db.batch();
      let grupId = mevcutGrupId;

      if (!mevcutGrupId) {
        grupId = batch.add('gruplar', {
          ...grup,
          aktif: true,
          olusturmaTarihi: new Date().toISOString(),
          olusturanId: userId,
        });
      }

      for (const s of satirlar) {
        const gece = Math.max(0, Math.round((new Date(s.cikisTarihi) - new Date(s.girisTarihi)) / 86400000));
        const gf = Number(s.geceFiyati) || 0;
        const rezKod = await generateRezKodu(db);
        batch.add('rezervasyonlar', {
          grupId,
          odaId: s.odaId,
          odaTipiId: s.odaTipiId,
          anaMisafirId: s.anaMisafirId,
          yetiskinSayisi: Number(s.yetiskinSayisi) || 0,
          cocukSayisi: Number(s.cocukSayisi) || 0,
          girisTarihi: s.girisTarihi,
          cikisTarihi: s.cikisTarihi,
          geceSayisi: gece,
          durum: 'onayli',
          pansiyonTipi: s.pansiyonTipi || 'oda-kahvalti',
          kanal: s.kanal || 'manuel',
          fiyatModu: 'gece',
          geceFiyati: gf,
          toplamTutar: gf * gece,
          geceFiyatlari: [],
          notlar: '',
          rezervasyonKodu: rezKod,
          olusturmaTarihi: new Date().toISOString(),
        });
      }

      await batch.commit();
      show(mevcutGrupId
        ? `Gruba ${satirlar.length} oda eklendi.`
        : `Grup rezervasyonu oluşturuldu (${satirlar.length} oda).`);
      onSaved?.(grupId);
      onClose?.();
    } catch (e) {
      setErr('Hata: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const setRenk = (r) => setGrup((g) => ({ ...g, renk: r }));

  const toplamGece = satirlar.reduce((s, x) => {
    if (!x.girisTarihi || !x.cikisTarihi) return s;
    return s + Math.max(0, Math.round((new Date(x.cikisTarihi) - new Date(x.girisTarihi)) / 86400000));
  }, 0);
  const toplamTutar = satirlar.reduce((s, x) => {
    const gece = (!x.girisTarihi || !x.cikisTarihi) ? 0
      : Math.max(0, Math.round((new Date(x.cikisTarihi) - new Date(x.girisTarihi)) / 86400000));
    return s + gece * (Number(x.geceFiyati) || 0);
  }, 0);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={mevcutGrupId ? 'Gruba Oda Ekle' : (step === 1 ? 'Yeni Grup — Bilgiler' : 'Yeni Grup — Odalar')}
        footer={
          <>
            {step === 2 && !mevcutGrupId && (
              <button type="button" className="htl-btn htl-btn-ghost" onClick={() => setStep(1)}>
                <Icon name="chevron-left" size={14} /><span>Geri</span>
              </button>
            )}
            <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
            {step === 1 ? (
              <button type="button" className="htl-btn htl-btn-primary" onClick={ileri}>
                <span>İleri</span><Icon name="chevron-right" size={14} stroke="white" />
              </button>
            ) : (
              <button type="button" className="htl-btn htl-btn-primary" onClick={handleSave} disabled={saving}>
                <Icon name="save" size={16} stroke="white" />
                <span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
              </button>
            )}
          </>
        }
      >
        {err && (
          <div className="mb-4 px-3 py-2 rounded-md text-sm flex items-center gap-2"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <Icon name="alert-circle" size={16} />{err}
          </div>
        )}

        {step === 1 && !mevcutGrupId && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="htl-label">Grup Adı *</label>
              <input className="htl-input" placeholder='Örn: "Yılmaz Ailesi", "ABC Ekibi"'
                value={grup.ad} onChange={(e) => setGrup({ ...grup, ad: e.target.value })} />
            </div>
            <div>
              <label className="htl-label">İletişim Kişisi</label>
              <input className="htl-input" value={grup.iletisimKisi} onChange={(e) => setGrup({ ...grup, iletisimKisi: e.target.value })} />
            </div>
            <div>
              <label className="htl-label">Telefon</label>
              <input className="htl-input" value={grup.telefon} onChange={(e) => setGrup({ ...grup, telefon: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="htl-label">E-posta</label>
              <input type="email" className="htl-input" value={grup.email} onChange={(e) => setGrup({ ...grup, email: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="htl-label">Takvim Rengi</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_RENKLER.map((r) => (
                  <button key={r} type="button" onClick={() => setRenk(r)}
                    className="w-9 h-9 rounded-full transition"
                    style={{ background: r, border: grup.renk === r ? '3px solid var(--ink)' : '2px solid transparent' }} />
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="htl-label">Notlar</label>
              <textarea rows="2" className="htl-input" value={grup.notlar} onChange={(e) => setGrup({ ...grup, notlar: e.target.value })} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {satirlar.map((s, idx) => {
              const seciliMisafir = misafirler.find((m) => m.id === s.anaMisafirId) || null;
              return (
                <SatirCard
                  key={s.tempId}
                  idx={idx}
                  satir={s}
                  seciliMisafir={seciliMisafir}
                  odalar={sortedOdalar}
                  odaTipleri={odaTipleri}
                  misafirler={misafirler}
                  aktifKanallar={aktifKanallar}
                  ana={ana}
                  onChange={(patch) => updateSatir(s.tempId, patch)}
                  onSil={() => odaSil(s.tempId)}
                  silEnabled={satirlar.length > 1}
                  onYeniMisafir={(prefillAd, prefillSoyad) => setYeniMisafirFor({ tempId: s.tempId, prefillAd, prefillSoyad })}
                />
              );
            })}

            <button type="button" className="htl-btn htl-btn-ghost w-full justify-center" onClick={odaEkle}>
              <Icon name="plus" size={14} /><span>Oda Ekle</span>
            </button>

            <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: 'var(--bone-warm)' }}>
              <div>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Toplam</div>
                <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>{satirlar.length} oda · {toplamGece} gece</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Toplam Tutar</div>
                <div className="font-display text-2xl font-medium" style={{ color: 'var(--forest)' }}>
                  {fmtMoney(toplamTutar, ana)}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <MisafirFormModal
        open={!!yeniMisafirFor}
        onClose={() => setYeniMisafirFor(null)}
        onSaved={(newId) => {
          if (newId && yeniMisafirFor) {
            updateSatir(yeniMisafirFor.tempId, { anaMisafirId: newId });
          }
          setYeniMisafirFor(null);
        }}
        target={null}
        prefill={yeniMisafirFor ? { ad: yeniMisafirFor.prefillAd, soyad: yeniMisafirFor.prefillSoyad } : null}
      />
    </>
  );
};

/* ============================================================
   SatirCard — bir oda satırı (oda + misafir combobox + tarih + fiyat)
   Combobox pattern ReservationFormModal'dan kopyalanmıştır.
   ============================================================ */
const SatirCard = ({
  idx,
  satir,
  seciliMisafir,
  odalar,
  odaTipleri,
  misafirler,
  aktifKanallar,
  ana,
  onChange,
  onSil,
  silEnabled,
  onYeniMisafir,
}) => {
  const [misafirArama, setMisafirArama] = useState('');
  const [dropdownAcik, setDropdownAcik] = useState(false);

  const filteredMisafirler = useMemo(() => {
    const q = misafirArama.toLowerCase().trim();
    if (!q) {
      return [...misafirler]
        .sort((a, b) => (b.olusturmaTarihi || '').localeCompare(a.olusturmaTarihi || ''))
        .slice(0, 10);
    }
    return misafirler.filter((m) =>
      `${m.ad || ''} ${m.soyad || ''}`.toLowerCase().includes(q)
      || (m.telefon || '').includes(q)
      || (m.tcKimlik || '').includes(q)
    ).slice(0, 10);
  }, [misafirArama, misafirler]);

  const handleSelectMisafir = (id) => {
    onChange({ anaMisafirId: id });
    setMisafirArama('');
    setDropdownAcik(false);
  };
  const handleClearMisafir = () => {
    onChange({ anaMisafirId: '' });
    setMisafirArama('');
    setDropdownAcik(false);
  };
  const handleYeniInline = () => {
    const parts = misafirArama.trim().split(/\s+/);
    const ad = parts[0] || '';
    const soyad = parts.slice(1).join(' ');
    onYeniMisafir(ad, soyad);
    setDropdownAcik(false);
  };

  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bone-light)', border: '1px solid var(--line-soft)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--ink-soft)' }}>
          Oda {idx + 1}
        </span>
        {silEnabled && (
          <button type="button" onClick={onSil}
            className="p-1 rounded hover:bg-[var(--bone-warm)]" title="Bu odayı sil">
            <Icon name="x" size={14} stroke="var(--danger)" />
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="htl-label">Oda *</label>
          <select className="htl-input" value={satir.odaId} onChange={(e) => onChange({ odaId: e.target.value })}>
            <option value="">— Seçiniz —</option>
            {odalar.map((o) => {
              const t = odaTipleri.find((x) => x.id === o.odaTipiId);
              return <option key={o.id} value={o.id}>Oda {o.odaNumarasi} — {t?.ad || ''}</option>;
            })}
          </select>
        </div>

        <div>
          <label className="htl-label">Ana Misafir *</label>
          <div className="relative">
            {seciliMisafir ? (
              <div className="htl-input flex items-center justify-between"
                style={{ background: 'var(--bone-warm)' }}>
                <span className="truncate">
                  <span className="font-medium">{seciliMisafir.ad} {seciliMisafir.soyad}</span>
                  {seciliMisafir.telefon && <span style={{ color: 'var(--ink-soft)' }}> · {seciliMisafir.telefon}</span>}
                </span>
                <button type="button" onClick={handleClearMisafir}
                  className="ml-2 p-1 -m-1 rounded hover:bg-[var(--bone-light)]" title="Seçimi temizle">
                  <Icon name="x" size={14} />
                </button>
              </div>
            ) : (
              <input className="htl-input" type="text" placeholder="Yaz veya seç..."
                value={misafirArama}
                onChange={(e) => { setMisafirArama(e.target.value); setDropdownAcik(true); }}
                onFocus={() => setDropdownAcik(true)}
                onBlur={() => setTimeout(() => setDropdownAcik(false), 200)}
                onKeyDown={(e) => { if (e.key === 'Escape') setDropdownAcik(false); }} />
            )}
            {dropdownAcik && !seciliMisafir && (
              <div className="absolute left-0 right-0 mt-1 rounded-lg shadow-lg overflow-hidden"
                style={{ background: 'var(--bone-light)', border: '1px solid var(--line)', top: '100%', zIndex: 30, maxHeight: '12rem', overflowY: 'auto' }}>
                {filteredMisafirler.length === 0 && !misafirArama.trim() && (
                  <div className="px-3 py-2 text-sm" style={{ color: 'var(--ink-faint)' }}>
                    Henüz misafir yok. Yazıp yeni ekleyin.
                  </div>
                )}
                {filteredMisafirler.map((m) => (
                  <button key={m.id} type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectMisafir(m.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bone-warm)] block">
                    <span className="font-medium">{m.ad} {m.soyad}</span>
                    {m.telefon && <span style={{ color: 'var(--ink-soft)' }}> · {m.telefon}</span>}
                  </button>
                ))}
                {misafirArama.trim() && (
                  <button type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleYeniInline}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bone-warm)] flex items-center gap-2"
                    style={{ borderTop: filteredMisafirler.length > 0 ? '1px solid var(--line-soft)' : 'none', color: 'var(--brass)' }}>
                    <Icon name="plus-circle" size={14} stroke="var(--brass)" />
                    <span>Yeni misafir: <strong>"{misafirArama.trim()}"</strong> oluştur</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="htl-label">Giriş *</label>
          <input type="date" className="htl-input" value={satir.girisTarihi}
            onChange={(e) => onChange({ girisTarihi: e.target.value })} />
        </div>
        <div>
          <label className="htl-label">Çıkış *</label>
          <input type="date" className="htl-input" value={satir.cikisTarihi}
            onChange={(e) => onChange({ cikisTarihi: e.target.value })} />
        </div>
        <div>
          <label className="htl-label">Yetişkin</label>
          <input type="number" min="1" className="htl-input" value={satir.yetiskinSayisi}
            onChange={(e) => onChange({ yetiskinSayisi: e.target.value })} />
        </div>
        <div>
          <label className="htl-label">Çocuk</label>
          <input type="number" min="0" className="htl-input" value={satir.cocukSayisi}
            onChange={(e) => onChange({ cocukSayisi: e.target.value })} />
        </div>
        <div>
          <label className="htl-label">Pansiyon</label>
          <select className="htl-input" value={satir.pansiyonTipi}
            onChange={(e) => onChange({ pansiyonTipi: e.target.value })}>
            {PANSIYON_OPTS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>
        <div>
          <label className="htl-label">Kanal</label>
          <select className="htl-input" value={satir.kanal}
            onChange={(e) => onChange({ kanal: e.target.value })}>
            {aktifKanallar.length === 0 && <option value="manuel">Manuel</option>}
            {aktifKanallar.map((k) => <option key={k.kod || k.id} value={k.kod || k.id}>{k.ad}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="htl-label">Gece Fiyatı ({PARA_BIRIMI_INFO(ana).symbol})</label>
          <input type="number" min="0" step="0.01" className="htl-input" value={satir.geceFiyati}
            onChange={(e) => onChange({ geceFiyati: e.target.value })} />
        </div>
      </div>
    </div>
  );
};

export default GrupRezervasyonModal;
