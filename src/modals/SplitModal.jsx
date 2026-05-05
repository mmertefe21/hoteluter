/**
 * SplitModal — rezervasyonu farklı odalara böl (segmentler oluşturur).
 *
 * 2 mod:
 *   - target.segmentler boşsa → bölme oluştur (split tarihi + yeni oda)
 *   - target.segmentler doluysa → bölmeyi geri al (ilk segmentin odasına dön)
 *
 * KURAL: Bölünmüş rez tek kayıt kalır. odaId/girisTarihi/cikisTarihi
 * geriye uyum için ilk segment + son çıkış senkron tutulur.
 */
import { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';
import { addDays, diffDays, fmtDateTR } from '../lib/helpers.js';
import { getOdaSegmentleri, checkOverlap } from '../helpers/segmentler.js';

const SplitModal = ({ open, onClose, onSaved, target = null, odalar = [], odaTipleri = [], reservations = [] }) => {
  const { show } = useToast();
  const [splitDate, setSplitDate] = useState('');
  const [yeniOdaId, setYeniOdaId] = useState('');
  const [saving, setSaving] = useState(false);

  const isMulti = target?.segmentler?.length > 0;
  const segs = target ? getOdaSegmentleri(target) : [];

  useEffect(() => {
    if (!open || !target) return;
    if (isMulti) {
      setSplitDate('');
      setYeniOdaId('');
      return;
    }
    if (target.girisTarihi && target.cikisTarihi) {
      const orta = addDays(target.girisTarihi, Math.floor(diffDays(target.girisTarihi, target.cikisTarihi) / 2));
      setSplitDate(orta);
    }
    setYeniOdaId('');
  }, [open, target?.id, isMulti]);

  if (!open || !target) return null;

  // === Bölünmüş: Geri al ===
  if (isMulti) {
    const undoSplit = async () => {
      setSaving(true);
      try {
        const ilk = target.segmentler[0];
        const son = target.segmentler[target.segmentler.length - 1];
        await db.update('rezervasyonlar', target.id, {
          segmentler: [],
          odaId: ilk.odaId,
          odaTipiId: ilk.odaTipiId,
          girisTarihi: ilk.girisTarihi,
          cikisTarihi: son.cikisTarihi,
        });
        show('Bölme kaldırıldı, rezervasyon ilk odaya geri döndü.');
        onSaved?.();
        onClose?.();
      } catch (e) {
        show('Hata: ' + e.message, 'error');
      } finally {
        setSaving(false);
      }
    };

    return (
      <Modal open={open} onClose={onClose} size="md" title="Bölmeyi Geri Al"
        footer={<>
          <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
          <button type="button" className="htl-btn htl-btn-danger" onClick={undoSplit} disabled={saving}>
            <Icon name="undo-2" size={16} stroke="white" /><span>{saving ? '...' : 'Bölmeyi Kaldır'}</span>
          </button>
        </>}
      >
        <p className="text-sm mb-3" style={{ color: 'var(--ink-soft)' }}>
          Bu rezervasyon <strong>{segs.length} bölüm</strong> halinde:
        </p>
        <div className="space-y-2 mb-3">
          {segs.map((s, i) => {
            const oda = odalar.find((o) => o.id === s.odaId);
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded" style={{ background: 'var(--bone-warm)' }}>
                <div className="font-display text-lg" style={{ color: 'var(--brass)' }}>{i + 1}</div>
                <div className="flex-1">
                  <div className="font-medium">Oda {oda?.odaNumarasi || '?'}</div>
                  <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                    {fmtDateTR(s.girisTarihi)} → {fmtDateTR(s.cikisTarihi)} · {diffDays(s.girisTarihi, s.cikisTarihi)} gece
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs px-3 py-2 rounded" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>
          Bölmeyi kaldırınca rezervasyon ilk segment'in odasına geri döner. Tüm tarih aralığı tek odada gözükür.
        </div>
      </Modal>
    );
  }

  // === Bölünmemiş: Yeni böl ===
  const giris = target.girisTarihi;
  const cikis = target.cikisTarihi;
  const minSplit = addDays(giris, 1);
  const maxSplit = addDays(cikis, -1);
  const totalGeceler = diffDays(giris, cikis);
  const ilkParcaGeceler = splitDate ? diffDays(giris, splitDate) : 0;
  const ikinciParcaGeceler = splitDate ? diffDays(splitDate, cikis) : 0;
  const seciliYeniOda = yeniOdaId ? odalar.find((o) => o.id === yeniOdaId) : null;
  const cakisma = yeniOdaId && splitDate
    ? checkOverlap(yeniOdaId, splitDate, cikis, target.id, reservations)
    : false;

  const valid = splitDate >= minSplit && splitDate <= maxSplit && yeniOdaId && yeniOdaId !== target.odaId && !cakisma;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const yeniOda = odalar.find((o) => o.id === yeniOdaId);
      const newSegs = [
        { odaId: target.odaId, odaTipiId: target.odaTipiId, girisTarihi: giris, cikisTarihi: splitDate },
        { odaId: yeniOdaId, odaTipiId: yeniOda.odaTipiId, girisTarihi: splitDate, cikisTarihi: cikis },
      ];
      await db.update('rezervasyonlar', target.id, { segmentler: newSegs });
      show(`Rezervasyon ikiye bölündü: ${ilkParcaGeceler} gece + ${ikinciParcaGeceler} gece`);
      onSaved?.();
      onClose?.();
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="md" title="Rezervasyonu Böl"
      footer={<>
        <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Vazgeç</button>
        <button type="button" className="htl-btn htl-btn-primary" onClick={save} disabled={!valid || saving}>
          <Icon name="scissors" size={16} stroke="white" /><span>{saving ? '...' : 'Böl'}</span>
        </button>
      </>}
    >
      <p className="text-sm mb-3" style={{ color: 'var(--ink-soft)' }}>
        <Icon name="info" size={14} className="inline mr-1" />
        Bu rezervasyonun bir kısmını başka odaya taşı. <strong>Tek hesap olarak kalır</strong>, tahsilat birlikte yönetilir.
      </p>

      <div className="rounded-lg p-3 mb-4" style={{ background: 'var(--bone-warm)' }}>
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--ink-soft)' }}>Mevcut Rezervasyon</div>
        <div className="text-sm">
          <strong>Oda {odalar.find((o) => o.id === target.odaId)?.odaNumarasi || '?'}</strong>
          {' · '}{fmtDateTR(giris)} → {fmtDateTR(cikis)} ({totalGeceler} gece)
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="htl-label">Bölme Tarihi (yeni odaya geçiş günü) *</label>
          <input type="date" className="htl-input" value={splitDate}
            min={minSplit} max={maxSplit}
            onChange={(e) => setSplitDate(e.target.value)} />
          <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
            {minSplit !== maxSplit
              ? `Geçerli aralık: ${fmtDateTR(minSplit)} → ${fmtDateTR(maxSplit)}`
              : 'En az 2 gecelik rezervasyon bölünebilir'}
          </div>
        </div>
        <div>
          <label className="htl-label">Yeni Oda *</label>
          <select className="htl-input" value={yeniOdaId} onChange={(e) => setYeniOdaId(e.target.value)}>
            <option value="">— Seçiniz —</option>
            {odalar.filter((o) => o.id !== target.odaId).map((o) => {
              const tip = odaTipleri.find((t) => t.id === o.odaTipiId);
              return <option key={o.id} value={o.id}>Oda {o.odaNumarasi} ({tip?.ad || '-'})</option>;
            })}
          </select>
          {cakisma && (
            <div className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--danger)' }}>
              <Icon name="alert-circle" size={12} />
              <span>Bu odada {fmtDateTR(splitDate)} → {fmtDateTR(cikis)} aralığında başka rezervasyon var.</span>
            </div>
          )}
        </div>

        {splitDate && yeniOdaId && !cakisma && (
          <div className="rounded-lg p-3 mt-3" style={{ background: 'var(--brass-soft)', border: '1px solid var(--brass-light)' }}>
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--forest)', fontWeight: 600 }}>Önizleme</div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <div className="font-display text-lg" style={{ color: 'var(--brass)' }}>1</div>
                <div className="flex-1">
                  <div><strong>Oda {odalar.find((o) => o.id === target.odaId)?.odaNumarasi}</strong></div>
                  <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>{fmtDateTR(giris)} → {fmtDateTR(splitDate)} · {ilkParcaGeceler} gece</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="font-display text-lg" style={{ color: 'var(--brass)' }}>2</div>
                <div className="flex-1">
                  <div><strong>Oda {seciliYeniOda?.odaNumarasi}</strong></div>
                  <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>{fmtDateTR(splitDate)} → {fmtDateTR(cikis)} · {ikinciParcaGeceler} gece</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SplitModal;
