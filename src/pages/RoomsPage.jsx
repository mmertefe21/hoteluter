/**
 * RoomsPage — Oda Tipleri + Odalar 2 sekmesi.
 */
import { useState } from 'react';
import ListPageShell from '../components/ListPageShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import OdaFormModal from '../modals/OdaFormModal.jsx';
import OdaTipFormModal from '../modals/OdaTipFormModal.jsx';
import { db, useCollection } from '../lib/db.js';
import { useDoc } from '../lib/db.js';
import { fmtMoney } from '../lib/helpers.js';
import { useAuth } from '../lib/auth-mock.jsx';

const ODA_DURUM_BADGE = {
  musait: 'htl-badge-success',
  dolu: 'htl-badge-info',
  temizlik: 'htl-badge-warn',
  ariza: 'htl-badge-danger',
  blokeli: 'htl-badge-neutral',
};

const RoomsPage = () => {
  const { can } = useAuth();
  const { show } = useToast();
  const [tab, setTab] = useState('odalar');

  const otel = useDoc('otel', 'main');
  const ana = otel?.anaParaBirimi || 'EUR';
  const odalar = useCollection('odalar');
  const odaTipleri = useCollection('odaTipleri');

  // Oda state
  const [odaSearch, setOdaSearch] = useState('');
  const [odaCreate, setOdaCreate] = useState(false);
  const [odaEdit, setOdaEdit] = useState(null);
  const [odaDel, setOdaDel] = useState(null);

  // Tip state
  const [tipCreate, setTipCreate] = useState(false);
  const [tipEdit, setTipEdit] = useState(null);
  const [tipDel, setTipDel] = useState(null);

  const filteredOdalar = odalar.filter((o) => {
    if (!odaSearch) return true;
    const t = odaTipleri.find((x) => x.id === o.odaTipiId);
    return `${o.odaNumarasi} ${o.kat} ${t?.ad || ''}`.toLowerCase().includes(odaSearch.toLowerCase());
  }).sort((a, b) => `${a.odaNumarasi}`.localeCompare(`${b.odaNumarasi}`));

  return (
    <>
      <div className="htl-card mb-4">
        <div className="htl-card-header" style={{ paddingBottom: 0, borderBottom: 'none' }}>
          <div className="flex gap-1 -mb-[1px]" style={{ borderBottom: '1px solid var(--line-soft)', flex: 1, flexWrap: 'wrap' }}>
            <div className={`htl-tab ${tab === 'odalar' ? 'active' : ''}`} onClick={() => setTab('odalar')}>Odalar ({odalar.length})</div>
            <div className={`htl-tab ${tab === 'tipler' ? 'active' : ''}`} onClick={() => setTab('tipler')}>Oda Tipleri ({odaTipleri.length})</div>
          </div>
        </div>
      </div>

      {tab === 'odalar' && (
        <>
          <ListPageShell
            title="Odalar"
            icon="door-open"
            search={odaSearch}
            setSearch={setOdaSearch}
            searchPlaceholder="Oda no, kat, tip..."
            onAdd={() => setOdaCreate(true)}
            addLabel="Yeni Oda"
            canAdd={can('odalar', 'ekle') && odaTipleri.length > 0}
          >
            <div className="overflow-x-auto">
              {odaTipleri.length === 0 ? (
                <div className="htl-empty">Önce <button onClick={() => setTab('tipler')} className="underline" style={{ color: 'var(--brass)' }}>oda tipi</button> tanımlayın.</div>
              ) : filteredOdalar.length === 0 ? (
                <div className="htl-empty">Oda bulunamadı.</div>
              ) : (
                <table className="htl-table">
                  <thead><tr><th>Oda No</th><th>Kat</th><th>Tip</th><th>Durum</th><th>Açıklama</th><th></th></tr></thead>
                  <tbody>
                    {filteredOdalar.map((o) => {
                      const t = odaTipleri.find((x) => x.id === o.odaTipiId);
                      const badgeCls = ODA_DURUM_BADGE[o.durum] || 'htl-badge-neutral';
                      return (
                        <tr key={o.id}>
                          <td className="font-medium">{o.odaNumarasi}</td>
                          <td>{o.kat ?? '-'}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: t?.renk || '#999' }} />
                              {t?.ad || '-'}
                            </div>
                          </td>
                          <td><span className={`htl-badge ${badgeCls}`}>{o.durum || 'musait'}</span></td>
                          <td className="text-sm" style={{ color: 'var(--ink-soft)' }}>{o.aciklama || '-'}</td>
                          <td>
                            <div className="flex justify-end gap-1">
                              {can('odalar', 'duzenle') && (
                                <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setOdaEdit(o)}>
                                  <Icon name="pencil" size={14} stroke="var(--ink-soft)" />
                                </button>
                              )}
                              {can('odalar', 'sil') && (
                                <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setOdaDel(o)}>
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
          </ListPageShell>

          <OdaFormModal
            open={odaCreate || !!odaEdit}
            onClose={() => { setOdaCreate(false); setOdaEdit(null); }}
            target={odaEdit}
            odaTipleri={odaTipleri}
          />
          <ConfirmModal
            open={!!odaDel}
            title="Oda Sil"
            msg={`"Oda ${odaDel?.odaNumarasi}" silinecek. Emin misin?`}
            onConfirm={async () => {
              try { await db.delete('odalar', odaDel.id); show('Oda silindi.'); }
              catch (e) { show('Hata: ' + e.message, 'error'); }
              setOdaDel(null);
            }}
            onCancel={() => setOdaDel(null)}
          />
        </>
      )}

      {tab === 'tipler' && (
        <>
          <ListPageShell
            title="Oda Tipleri"
            icon="layers"
            onAdd={() => setTipCreate(true)}
            addLabel="Yeni Oda Tipi"
            canAdd={can('odalar', 'ekle')}
          >
            <div className="htl-card-body">
              {odaTipleri.length === 0 ? (
                <div className="htl-empty">Henüz oda tipi yok. Başlamak için bir tip ekle.</div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {odaTipleri.map((t) => {
                    const odaSayisi = odalar.filter((o) => o.odaTipiId === t.id).length;
                    return (
                      <div key={t.id} className="rounded-lg p-4" style={{ background: 'var(--bone)', border: '1px solid var(--line-soft)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: t.renk }} />
                        <div className="flex items-start justify-between mt-1">
                          <div>
                            <h4 className="font-display text-lg font-medium">{t.ad}</h4>
                            <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>{odaSayisi} oda</div>
                          </div>
                          <div className="flex gap-1">
                            {can('odalar', 'duzenle') && (
                              <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setTipEdit(t)}>
                                <Icon name="pencil" size={14} stroke="var(--ink-soft)" />
                              </button>
                            )}
                            {can('odalar', 'sil') && (
                              <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setTipDel(t)}>
                                <Icon name="trash-2" size={14} stroke="var(--danger)" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
                            <Icon name="user" size={14} />{t.kapasiteYetiskin || 1}
                          </div>
                          <div className="flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
                            <Icon name="baby" size={14} />{t.kapasiteCocuk || 0}
                          </div>
                        </div>
                        <div className="mt-3 font-display text-2xl font-medium" style={{ color: 'var(--forest)' }}>
                          {fmtMoney(t.varsayilanFiyat || 0, ana)}
                          <span className="text-sm font-body font-normal" style={{ color: 'var(--ink-soft)' }}> /gece</span>
                        </div>
                        {t.aciklama && <p className="text-sm mt-2" style={{ color: 'var(--ink-soft)' }}>{t.aciklama}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ListPageShell>

          <OdaTipFormModal
            open={tipCreate || !!tipEdit}
            onClose={() => { setTipCreate(false); setTipEdit(null); }}
            target={tipEdit}
          />
          <ConfirmModal
            open={!!tipDel}
            title="Oda Tipi Sil"
            msg={`"${tipDel?.ad}" silinecek. Bu tipe atanmış odalar etkilenebilir. Emin misin?`}
            onConfirm={async () => {
              try { await db.delete('odaTipleri', tipDel.id); show('Oda tipi silindi.'); }
              catch (e) { show('Hata: ' + e.message, 'error'); }
              setTipDel(null);
            }}
            onCancel={() => setTipDel(null)}
          />
        </>
      )}
    </>
  );
};

export default RoomsPage;
