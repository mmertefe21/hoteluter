/**
 * ReservationListPage — rezervasyon listesi (ListPageShell + filtreler).
 */
import { useState } from 'react';
import ListPageShell from '../components/ListPageShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import ReservationFormModal from '../modals/ReservationFormModal.jsx';
import { db, useCollection, useDoc } from '../lib/db.js';
import { fmtMoney, fmtDateTR } from '../lib/helpers.js';
import { DURUM_OPTS, DURUM_INFO } from '../lib/constants.js';
import { useAuth } from '../lib/auth-mock.jsx';

const ReservationListPage = () => {
  const { can, user } = useAuth();
  const { show } = useToast();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipId, setFilterTipId] = useState('');
  const [editingRez, setEditingRez] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const otel = useDoc('otel', 'main');
  const ana = otel?.anaParaBirimi || 'EUR';
  const reservations = useCollection('rezervasyonlar');
  const odalar = useCollection('odalar');
  const odaTipleri = useCollection('odaTipleri');
  const misafirler = useCollection('misafirler');
  const hesaplar = useCollection('hesaplar');
  const hesapHareketleri = useCollection('hesapHareketleri');
  const tahsilatlar = useCollection('tahsilatlar');
  const kanallar = useCollection('kanallar');

  const filtered = reservations
    .filter((r) => !filterStatus || r.durum === filterStatus)
    .filter((r) => !filterTipId || r.odaTipiId === filterTipId)
    .filter((r) => {
      if (!search) return true;
      const m = misafirler.find((x) => x.id === r.anaMisafirId);
      const o = odalar.find((x) => x.id === r.odaId);
      const hay = `${r.rezervasyonKodu || ''} ${m?.ad || ''} ${m?.soyad || ''} ${m?.telefon || ''} ${o?.odaNumarasi || ''}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    })
    .sort((a, b) => `${b.girisTarihi}`.localeCompare(`${a.girisTarihi}`));

  const handleDelete = async () => {
    try {
      await db.delete('rezervasyonlar', confirmDel.id);
      show('Rezervasyon silindi.');
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setConfirmDel(null);
    }
  };

  return (
    <>
      <div className="htl-card">
        <div className="htl-card-header">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-faint)' }}>
                <Icon name="search" size={16} />
              </span>
              <input
                className="htl-input"
                placeholder="Misafir, kod, telefon, oda..."
                style={{ paddingLeft: 36, minWidth: 260 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="htl-input" style={{ maxWidth: 180 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Tüm durumlar</option>
              {DURUM_OPTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
            <select className="htl-input" style={{ maxWidth: 180 }} value={filterTipId} onChange={(e) => setFilterTipId(e.target.value)}>
              <option value="">Tüm oda tipleri</option>
              {odaTipleri.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
            </select>
          </div>
          {can('rezervasyon', 'ekle') && (
            <button type="button" className="htl-btn htl-btn-accent" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} stroke="white" /><span>Yeni</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="htl-empty">
              <Icon name="calendar-x" size={32} stroke="var(--ink-faint)" />
              <p className="mt-2">Rezervasyon bulunamadı.</p>
            </div>
          ) : (
            <table className="htl-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Misafir</th>
                  <th>Oda</th>
                  <th>Giriş</th>
                  <th>Çıkış</th>
                  <th>Gece</th>
                  <th>Durum</th>
                  <th className="text-right">Tutar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const m = misafirler.find((x) => x.id === r.anaMisafirId);
                  const o = odalar.find((x) => x.id === r.odaId);
                  const t = odaTipleri.find((x) => x.id === r.odaTipiId);
                  const di = DURUM_INFO(r.durum);
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.rezervasyonKodu || '-'}</td>
                      <td>
                        <div className="font-medium">{m ? `${m.ad} ${m.soyad}` : '—'}</div>
                        <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>{m?.telefon || ''}</div>
                      </td>
                      <td>
                        <div>{o?.odaNumarasi || '-'}</div>
                        <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>{t?.ad || ''}</div>
                      </td>
                      <td>{fmtDateTR(r.girisTarihi)}</td>
                      <td>{fmtDateTR(r.cikisTarihi)}</td>
                      <td>{r.geceSayisi || '-'}</td>
                      <td><span className={`htl-badge htl-badge-${di.badge}`}>{di.l}</span></td>
                      <td className="text-right font-medium">{fmtMoney(r.toplamTutar || 0, ana)}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {can('rezervasyon', 'duzenle') && (
                            <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setEditingRez(r)}>
                              <Icon name="pencil" size={14} stroke="var(--ink-soft)" />
                            </button>
                          )}
                          {can('rezervasyon', 'sil') && (
                            <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setConfirmDel(r)}>
                              <Icon name="trash-2" size={14} stroke="var(--danger)" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ReservationFormModal
        open={creating || !!editingRez}
        onClose={() => { setCreating(false); setEditingRez(null); }}
        rezervasyon={editingRez}
        odalar={odalar}
        odaTipleri={odaTipleri}
        misafirler={misafirler}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        tahsilatlar={tahsilatlar}
        reservations={reservations}
        kanallar={kanallar}
        ana={ana}
        userId={user?.id}
      />

      <ConfirmModal
        open={!!confirmDel}
        title="Rezervasyon Sil"
        msg={`"${confirmDel?.rezervasyonKodu || ''}" rezervasyonu silinecek. Emin misin?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </>
  );
};

export default ReservationListPage;
