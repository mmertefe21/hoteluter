/**
 * HesapDetayModal — hesap detay & hareket geçmişi (size=lg).
 *
 * - Üst kart: hesap bilgileri (ad, tip, PB, mevcut bakiye, ana PB karşılığı)
 * - Filtreler: tarih aralığı + hareket tipi (hepsi/tahsilat/gider/transfer/manuel)
 * - Tablo: tarih, tip, açıklama, tutar (renkli), bakiye (running)
 * - Manuel hareket ekle (mini form: tip + tutar + açıklama)
 * - Sil butonları (sadece canDelete=true ise) — onay modali ile
 *
 * Props:
 *   open, onClose
 *   hesap            : hesap object
 *   hesaplar         : Array (bakiyeAna hesabı için)
 *   hesapHareketleri : Array (tüm hareketler — hesap.id ile filtrelenir)
 *   ana              : string
 *   userId           : string
 *   canDelete        : boolean (superadmin)
 *   onAfterChange    : () => void (manuel hareket veya silme sonrası caller refresh)
 */
import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';
import { cevirKur } from '../lib/kur.js';
import {
  HAREKET_TIP_INFO,
  HESAP_TIP_INFO,
  PARA_BIRIMI_INFO,
} from '../lib/constants.js';
import { fmtMoney, fmtDateTR, todayISO } from '../lib/helpers.js';
import { getHesapBakiye, getHesapBakiyeAna } from '../helpers/exchange-utils.js';
import { addManuelHareket } from '../helpers/transfer.js';
import { deleteTahsilatWithHareket } from '../helpers/tahsilat.js';
import { deleteGiderWithHareket } from '../helpers/gider.js';

const TIP_GROUP = {
  all: () => true,
  tahsilat: (h) => h.tip === 'tahsilat',
  gider: (h) => h.tip === 'gider',
  transfer: (h) =>
    ['transfer-giris', 'transfer-cikis', 'doviz-transfer-giris', 'doviz-transfer-cikis'].includes(h.tip),
  manuel: (h) => ['manuel-giris', 'manuel-cikis'].includes(h.tip),
};

const HesapDetayModal = ({
  open,
  onClose,
  hesap,
  hesaplar = [],
  hesapHareketleri = [],
  ana = 'EUR',
  userId = null,
  canDelete = false,
  onAfterChange,
}) => {
  const { show } = useToast();
  const [filterTip, setFilterTip] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showManuel, setShowManuel] = useState(false);
  const [manForm, setManForm] = useState({ tip: 'manuel-giris', tutar: '', aciklama: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFilterTip('all');
    setDateFrom('');
    setDateTo('');
    setShowManuel(false);
    setManForm({ tip: 'manuel-giris', tutar: '', aciklama: '' });
  }, [open, hesap?.id]);

  const tipInfo = hesap ? HESAP_TIP_INFO(hesap.tip) : null;
  const hesapPB = hesap ? hesap.paraBirimi || ana : ana;
  const bakiye = useMemo(
    () => (hesap ? getHesapBakiye(hesap.id, hesapHareketleri) : 0),
    [hesap, hesapHareketleri]
  );
  const bakiyeAna = useMemo(
    () => (hesap ? getHesapBakiyeAna(hesap.id, hesaplar, hesapHareketleri, ana, cevirKur) : null),
    [hesap, hesaplar, hesapHareketleri, ana]
  );

  const filtered = useMemo(() => {
    if (!hesap) return [];
    const tipFn = TIP_GROUP[filterTip] || TIP_GROUP.all;
    return hesapHareketleri
      .filter((h) => h.hesapId === hesap.id)
      .filter(tipFn)
      .filter((h) => {
        if (dateFrom && h.tarih < dateFrom) return false;
        if (dateTo && h.tarih > dateTo) return false;
        return true;
      })
      .sort((a, b) => `${b.tarih}${b._createdAt || ''}`.localeCompare(`${a.tarih}${a._createdAt || ''}`));
  }, [hesap, hesapHareketleri, filterTip, dateFrom, dateTo]);

  // Running balance — en yeniden başlayıp geriye doğru toplar
  const harWithBalance = useMemo(() => {
    let running = bakiye;
    return filtered.map((h) => {
      const before = running;
      running = running - Number(h.tutar || 0);
      return { ...h, balanceAfter: before };
    });
  }, [filtered, bakiye]);

  const saveManuel = async () => {
    const t = Number(manForm.tutar);
    if (!t || t <= 0) return show("Tutar 0'dan büyük olmalı.", 'error');
    setSaving(true);
    try {
      await addManuelHareket(
        {
          hesapId: hesap.id,
          tutar: t,
          tarih: todayISO(),
          tip: manForm.tip,
          aciklama: manForm.aciklama || '',
        },
        userId
      );
      show('Manuel hareket eklendi.');
      setManForm({ tip: 'manuel-giris', tutar: '', aciklama: '' });
      setShowManuel(false);
      onAfterChange?.();
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h) => {
    setConfirmDel(null);
    setSaving(true);
    try {
      if (h.tahsilatId) {
        await deleteTahsilatWithHareket(h.tahsilatId);
        show('Tahsilat ve bağlı hareketler silindi.');
      } else if (h.giderId) {
        await deleteGiderWithHareket(h.giderId);
        show('Gider ve bağlı hareketler silindi.');
      } else if (h.transferId) {
        // Transfer çift hareketten oluşur — transferId ile bağlı tüm hareketleri sil
        const batch = db.batch();
        hesapHareketleri
          .filter((x) => x.transferId === h.transferId)
          .forEach((x) => batch.delete('hesapHareketleri', x.id));
        await batch.commit();
        show('Transfer (her iki taraf) silindi.');
      } else {
        await db.delete('hesapHareketleri', h.id);
        show('Hareket silindi.');
      }
      onAfterChange?.();
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!hesap) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={`${hesap.ad} — Hesap Detayı`}
        footer={
          <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>
            Kapat
          </button>
        }
      >
        <div className="space-y-4">
          <div
            className="rounded-lg p-4 flex items-center justify-between flex-wrap gap-3"
            style={{ background: tipInfo.renk + '15', border: `1px solid ${tipInfo.renk}30` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: tipInfo.renk }}
              >
                <Icon name={tipInfo.icon} size={22} stroke="white" />
              </div>
              <div>
                <div
                  className="font-display text-xl font-medium flex items-center gap-2"
                  style={{ color: 'var(--forest)' }}
                >
                  {hesap.ad}
                  <span
                    className="htl-badge htl-badge-neutral"
                    style={{ fontFamily: 'DM Sans', fontSize: 11 }}
                  >
                    {PARA_BIRIMI_INFO(hesapPB).symbol} {hesapPB}
                  </span>
                  {hesap.aktif === false && (
                    <span className="htl-badge htl-badge-danger" style={{ fontFamily: 'DM Sans', fontSize: 11 }}>
                      Pasif
                    </span>
                  )}
                </div>
                <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                  {tipInfo.l}
                  {hesap.aciklama ? ` · ${hesap.aciklama}` : ''}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                Mevcut Bakiye
              </div>
              <div
                className="font-display text-2xl font-medium"
                style={{ color: bakiye >= 0 ? 'var(--forest)' : 'var(--danger)' }}
              >
                {fmtMoney(bakiye, hesapPB)}
              </div>
              {hesapPB !== ana && bakiyeAna != null && (
                <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                  ≈ {fmtMoney(bakiyeAna, ana)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="htl-label" style={{ marginBottom: 4 }}>Tip</label>
              <select
                className="htl-input"
                style={{ minWidth: 160 }}
                value={filterTip}
                onChange={(e) => setFilterTip(e.target.value)}
              >
                <option value="all">Tümü</option>
                <option value="tahsilat">Tahsilat</option>
                <option value="gider">Gider</option>
                <option value="transfer">Transfer</option>
                <option value="manuel">Manuel</option>
              </select>
            </div>
            <div>
              <label className="htl-label" style={{ marginBottom: 4 }}>Başlangıç</label>
              <input type="date" className="htl-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="htl-label" style={{ marginBottom: 4 }}>Bitiş</label>
              <input type="date" className="htl-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex-1"></div>
            <button
              type="button"
              className="htl-btn htl-btn-accent"
              onClick={() => setShowManuel((v) => !v)}
            >
              <Icon name={showManuel ? 'x' : 'plus'} size={14} stroke="white" />
              <span>{showManuel ? 'Kapat' : 'Manuel Hareket'}</span>
            </button>
          </div>

          {showManuel && (
            <div
              className="rounded-md p-3"
              style={{ background: 'var(--brass-soft)', border: '1px solid var(--brass-light)' }}
            >
              <div className="grid md:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="htl-label" style={{ marginBottom: 4 }}>Yön</label>
                  <select
                    className="htl-input"
                    value={manForm.tip}
                    onChange={(e) => setManForm({ ...manForm, tip: e.target.value })}
                  >
                    <option value="manuel-giris">Manuel Giriş (+)</option>
                    <option value="manuel-cikis">Manuel Çıkış (−)</option>
                  </select>
                </div>
                <div>
                  <label className="htl-label" style={{ marginBottom: 4 }}>Tutar ({hesapPB})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="htl-input"
                    value={manForm.tutar}
                    onChange={(e) => setManForm({ ...manForm, tutar: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="htl-label" style={{ marginBottom: 4 }}>Açıklama</label>
                  <input
                    className="htl-input"
                    placeholder="Düzeltme nedeni..."
                    value={manForm.aciklama}
                    onChange={(e) => setManForm({ ...manForm, aciklama: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  className="htl-btn htl-btn-primary"
                  onClick={saveManuel}
                  disabled={saving}
                >
                  <Icon name="save" size={14} stroke="white" />
                  <span>{saving ? 'Kaydediliyor...' : 'Manuel Hareket Ekle'}</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-display text-base font-medium mb-2" style={{ color: 'var(--forest)' }}>
              Hareket Geçmişi ({harWithBalance.length})
            </h4>
            {harWithBalance.length === 0 ? (
              <div className="htl-empty">Bu filtreye uyan hareket yok.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--line-soft)' }}>
                <table className="htl-table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Tip</th>
                      <th>Açıklama</th>
                      <th className="text-right">Tutar</th>
                      <th className="text-right">Bakiye</th>
                      {canDelete && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {harWithBalance.map((h) => {
                      const ti = HAREKET_TIP_INFO(h.tip);
                      const isPos = Number(h.tutar) >= 0;
                      return (
                        <tr key={h.id}>
                          <td className="text-sm">{fmtDateTR(h.tarih)}</td>
                          <td>
                            <span className={`htl-badge ${isPos ? 'htl-badge-success' : 'htl-badge-danger'}`}>
                              {ti.l}
                            </span>
                          </td>
                          <td className="text-sm">{h.aciklama || '-'}</td>
                          <td
                            className="text-right font-medium"
                            style={{ color: isPos ? 'var(--success)' : 'var(--danger)' }}
                          >
                            {isPos ? '+' : ''}
                            {fmtMoney(h.tutar, hesapPB)}
                          </td>
                          <td className="text-right text-sm" style={{ color: 'var(--ink-soft)' }}>
                            {fmtMoney(h.balanceAfter, hesapPB)}
                          </td>
                          {canDelete && (
                            <td className="text-right">
                              <button
                                type="button"
                                onClick={() => setConfirmDel(h)}
                                className="p-1 rounded hover:bg-[var(--bone-warm)]"
                                title="Sil"
                                style={{ color: 'var(--danger)' }}
                                disabled={saving}
                              >
                                <Icon name="trash-2" size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmDel}
        title="Hareket sil"
        msg={
          confirmDel?.tahsilatId
            ? 'Bu tahsilatı ve bağlı hesap hareketini silmek istediğine emin misin?'
            : confirmDel?.giderId
              ? 'Bu gideri ve bağlı hesap hareketini silmek istediğine emin misin?'
              : confirmDel?.transferId
                ? 'Bu transferin her iki tarafını birden silmek istediğine emin misin?'
                : 'Bu manuel hareketi silmek istediğine emin misin?'
        }
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => handleDelete(confirmDel)}
        confirmLabel="Evet, sil"
        danger
      />
    </>
  );
};

export default HesapDetayModal;
