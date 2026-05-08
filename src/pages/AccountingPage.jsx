/**
 * AccountingPage — Ön Muhasebe.
 *
 * Sekmeler: Hesaplar (kart grid + KPI) · Tahsilatlar · Giderler · Hareketler
 * Modallar: TahsilatModal · GiderModal · TransferModal · HesapFormModal · HesapDetayModal
 */
import { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useToast } from '../components/Toast.jsx';
import TahsilatModal from '../modals/TahsilatModal.jsx';
import GiderModal from '../modals/GiderModal.jsx';
import TransferModal from '../modals/TransferModal.jsx';
import HesapFormModal from '../modals/HesapFormModal.jsx';
import HesapDetayModal from '../modals/HesapDetayModal.jsx';
import { db, useCollection, useDoc } from '../lib/db.js';
import {
  HESAP_TIP_INFO, HAREKET_TIP_INFO, PARA_BIRIMI_INFO, ODEME_OPTS,
} from '../lib/constants.js';
import { fmtMoney, fmtDateTR, todayISO, localISODate } from '../lib/helpers.js';
import { cevirKur } from '../lib/kur.js';
import {
  getHesapBakiye, getHesapBakiyeAna, getToplamBakiyeAna,
} from '../helpers/exchange-utils.js';
import { deleteTahsilatWithHareket } from '../helpers/tahsilat.js';
import { deleteGiderWithHareket } from '../helpers/gider.js';
import { useAuth } from '../lib/auth.jsx';

const AccountingPage = () => {
  const { can, user } = useAuth();
  const { show } = useToast();
  const [tab, setTab] = useState('hesaplar');

  const otel = useDoc('otel', 'main');
  const ana = otel?.anaParaBirimi || 'EUR';
  const hesaplar = useCollection('hesaplar');
  const hesapHareketleri = useCollection('hesapHareketleri');
  const tahsilatlar = useCollection('tahsilatlar');
  const giderler = useCollection('giderler');
  const giderKategorileri = useCollection('giderKategorileri');
  const reservationsAll = useCollection('rezervasyonlar');
  const misafirler = useCollection('misafirler');

  // Modal state
  const [tahsilatOpen, setTahsilatOpen] = useState(false);
  const [editingTah, setEditingTah] = useState(null);
  const [giderOpen, setGiderOpen] = useState(false);
  const [editingGider, setEditingGider] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [hesapFormOpen, setHesapFormOpen] = useState(false);
  const [editingHesap, setEditingHesap] = useState(null);
  const [hesapDetay, setHesapDetay] = useState(null);
  const [confirmDelTah, setConfirmDelTah] = useState(null);
  const [confirmDelGider, setConfirmDelGider] = useState(null);

  const today = todayISO();
  const sumTutarAna = (list) =>
    list.reduce((s, t) => s + Number(t.tutarAna != null ? t.tutarAna : t.tutar || 0), 0);

  const now = new Date();
  const ayBasIso = localISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const yilBas = `${now.getFullYear()}-01-01`;

  const tahsilatBugun = sumTutarAna(tahsilatlar.filter((t) => t.tarih === today));
  const tahsilatAy = sumTutarAna(tahsilatlar.filter((t) => t.tarih >= ayBasIso));
  const tahsilatYil = sumTutarAna(tahsilatlar.filter((t) => t.tarih >= yilBas));

  const toplamBakiye = useMemo(
    () => getToplamBakiyeAna(hesaplar, hesapHareketleri, ana, cevirKur),
    [hesaplar, hesapHareketleri, ana]
  );

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="htl-stat">
            <div className="htl-stat-label">Toplam Bakiye ({ana})</div>
            <div className="htl-stat-value" style={{ fontSize: 26 }}>{fmtMoney(toplamBakiye, ana)}</div>
            <div className="htl-stat-sub">{hesaplar.length} hesap · ana PB</div>
          </div>
          <div className="htl-stat">
            <div className="htl-stat-label">Bugün Tahsilat</div>
            <div className="htl-stat-value" style={{ fontSize: 26 }}>{fmtMoney(tahsilatBugun, ana)}</div>
          </div>
          <div className="htl-stat">
            <div className="htl-stat-label">Bu Ay</div>
            <div className="htl-stat-value" style={{ fontSize: 26 }}>{fmtMoney(tahsilatAy, ana)}</div>
          </div>
          <div className="htl-stat">
            <div className="htl-stat-label">Bu Yıl</div>
            <div className="htl-stat-value" style={{ fontSize: 26 }}>{fmtMoney(tahsilatYil, ana)}</div>
          </div>
        </div>

        <div className="htl-card">
          <div className="htl-card-header" style={{ paddingBottom: 0, borderBottom: 'none' }}>
            <div className="flex gap-1 -mb-[1px]" style={{ borderBottom: '1px solid var(--line-soft)', flex: 1, flexWrap: 'wrap' }}>
              <div className={`htl-tab ${tab === 'hesaplar' ? 'active' : ''}`} onClick={() => setTab('hesaplar')}>Hesaplar</div>
              <div className={`htl-tab ${tab === 'tahsilat' ? 'active' : ''}`} onClick={() => setTab('tahsilat')}>Tahsilatlar</div>
              <div className={`htl-tab ${tab === 'gider' ? 'active' : ''}`} onClick={() => setTab('gider')}>Giderler</div>
              <div className={`htl-tab ${tab === 'hareket' ? 'active' : ''}`} onClick={() => setTab('hareket')}>Hareketler</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {can('onMuhasebe', 'tahsilat') && (
                <button type="button" className="htl-btn htl-btn-accent" onClick={() => { setEditingTah(null); setTahsilatOpen(true); }}>
                  <Icon name="hand-coins" size={14} stroke="white" /><span>Tahsilat</span>
                </button>
              )}
              <button type="button" className="htl-btn htl-btn-primary" onClick={() => { setEditingGider(null); setGiderOpen(true); }}>
                <Icon name="receipt" size={14} stroke="white" /><span>Gider</span>
              </button>
              {can('onMuhasebe', 'transfer') && (
                <button type="button" className="htl-btn" onClick={() => setTransferOpen(true)}
                  style={{ background: 'var(--brass)', color: 'white' }}>
                  <Icon name="arrow-left-right" size={14} stroke="white" /><span>Transfer</span>
                </button>
              )}
              {can('onMuhasebe', 'hesap-yonet') && (
                <button type="button" className="htl-btn htl-btn-ghost" onClick={() => { setEditingHesap(null); setHesapFormOpen(true); }}>
                  <Icon name="plus" size={14} /><span>Yeni Hesap</span>
                </button>
              )}
            </div>
          </div>

          <div className="htl-card-body">
            {tab === 'hesaplar' && (
              hesaplar.length === 0 ? (
                <div className="htl-empty">Henüz hesap yok. "Yeni Hesap" ile bir kasa veya banka hesabı ekle.</div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hesaplar.map((h) => {
                    const pb = h.paraBirimi || ana;
                    const tipInfo = HESAP_TIP_INFO(h.tip);
                    const bakiye = getHesapBakiye(h.id, hesapHareketleri);
                    const bakiyeAna = getHesapBakiyeAna(h.id, hesaplar, hesapHareketleri, ana, cevirKur);
                    return (
                      <div key={h.id} className="rounded-lg p-4 cursor-pointer hover:shadow-md transition"
                        style={{ background: 'var(--bone-light)', border: `1px solid ${tipInfo.renk}40` }}
                        onClick={() => setHesapDetay(h)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: tipInfo.renk }}>
                              <Icon name={tipInfo.icon} size={18} stroke="white" />
                            </div>
                            <div>
                              <div className="font-medium text-sm flex items-center gap-1.5">
                                {h.ad}
                                {h.aktif === false && <span className="htl-badge htl-badge-danger" style={{ fontSize: 9 }}>Pasif</span>}
                              </div>
                              <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                                {tipInfo.l} · {PARA_BIRIMI_INFO(pb).symbol} {pb}
                              </div>
                            </div>
                          </div>
                          {can('onMuhasebe', 'hesap-yonet') && (
                            <button type="button" className="p-1 rounded hover:bg-[var(--bone-warm)]"
                              onClick={(e) => { e.stopPropagation(); setEditingHesap(h); setHesapFormOpen(true); }}>
                              <Icon name="square-pen" size={14} stroke="var(--ink-soft)" />
                            </button>
                          )}
                        </div>
                        <div className="mt-3">
                          <div className="font-display text-2xl font-medium"
                            style={{ color: bakiye >= 0 ? 'var(--forest)' : 'var(--danger)' }}>
                            {fmtMoney(bakiye, pb)}
                          </div>
                          {pb !== ana && bakiyeAna != null && (
                            <div className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                              ≈ {fmtMoney(bakiyeAna, ana)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {tab === 'tahsilat' && (
              <div className="overflow-x-auto">
                {tahsilatlar.length === 0 ? (
                  <div className="htl-empty">Henüz tahsilat yok.</div>
                ) : (
                  <table className="htl-table">
                    <thead>
                      <tr><th>Tarih</th><th>Rezervasyon</th><th>Hesap</th><th>Yöntem</th><th>Açıklama</th><th className="text-right">Tutar</th><th></th></tr>
                    </thead>
                    <tbody>
                      {[...tahsilatlar].sort((a, b) => `${b.tarih}`.localeCompare(`${a.tarih}`)).map((t) => {
                        const hesap = hesaplar.find((h) => h.id === t.hesapId);
                        const rez = reservationsAll.find((r) => r.id === t.rezervasyonId);
                        const m = rez ? misafirler.find((x) => x.id === rez.anaMisafirId) : null;
                        const odm = ODEME_OPTS.find((o) => o.v === t.odemeYontemi);
                        return (
                          <tr key={t.id}>
                            <td className="text-sm">{fmtDateTR(t.tarih)}</td>
                            <td className="text-sm">{rez ? `${rez.rezervasyonKodu}${m ? ` · ${m.ad} ${m.soyad}` : ''}` : <span style={{ color: 'var(--ink-faint)' }}>Bağımsız</span>}</td>
                            <td className="text-sm">{hesap?.ad || '-'}</td>
                            <td><span className="htl-badge htl-badge-info">{odm?.l || t.odemeYontemi}</span></td>
                            <td className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t.aciklama || '-'}</td>
                            <td className="text-right font-medium" style={{ color: 'var(--success)' }}>
                              <div>{fmtMoney(t.tutar, t.paraBirimi || ana)}</div>
                              {t.paraBirimi && t.paraBirimi !== ana && t.tutarAna != null && (
                                <div className="text-[10px] font-normal" style={{ color: 'var(--ink-soft)' }}>≈ {fmtMoney(t.tutarAna, ana)}</div>
                              )}
                            </td>
                            <td>
                              <div className="flex justify-end gap-1">
                                <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => { setEditingTah(t); setTahsilatOpen(true); }}>
                                  <Icon name="pencil" size={14} stroke="var(--ink-soft)" />
                                </button>
                                <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setConfirmDelTah(t)}>
                                  <Icon name="trash-2" size={14} stroke="var(--danger)" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'gider' && (
              <div className="overflow-x-auto">
                {giderler.length === 0 ? (
                  <div className="htl-empty">Henüz gider yok.</div>
                ) : (
                  <table className="htl-table">
                    <thead>
                      <tr><th>Tarih</th><th>Kategori</th><th>Hesap</th><th>Açıklama</th><th className="text-right">Tutar</th><th></th></tr>
                    </thead>
                    <tbody>
                      {[...giderler].sort((a, b) => `${b.tarih}`.localeCompare(`${a.tarih}`)).map((g) => {
                        const kat = giderKategorileri.find((k) => k.id === g.kategoriId);
                        const hesap = hesaplar.find((h) => h.id === g.hesapId);
                        return (
                          <tr key={g.id}>
                            <td className="text-sm">{fmtDateTR(g.tarih)}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: kat?.renk || '#999' }} />
                                <span>{kat?.ad || 'Kategorisiz'}</span>
                              </div>
                            </td>
                            <td className="text-sm">{hesap?.ad || '-'}</td>
                            <td className="text-sm" style={{ color: 'var(--ink-soft)' }}>{g.aciklama || '-'}</td>
                            <td className="text-right font-medium" style={{ color: 'var(--danger)' }}>
                              <div>−{fmtMoney(g.tutar, g.paraBirimi || ana)}</div>
                              {g.paraBirimi && g.paraBirimi !== ana && g.tutarAna != null && (
                                <div className="text-[10px] font-normal" style={{ color: 'var(--ink-soft)' }}>≈ {fmtMoney(g.tutarAna, ana)}</div>
                              )}
                            </td>
                            <td>
                              <div className="flex justify-end gap-1">
                                <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => { setEditingGider(g); setGiderOpen(true); }}>
                                  <Icon name="pencil" size={14} stroke="var(--ink-soft)" />
                                </button>
                                <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setConfirmDelGider(g)}>
                                  <Icon name="trash-2" size={14} stroke="var(--danger)" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'hareket' && (
              <div className="overflow-x-auto">
                {hesapHareketleri.length === 0 ? (
                  <div className="htl-empty">Henüz hesap hareketi yok.</div>
                ) : (
                  <table className="htl-table">
                    <thead>
                      <tr><th>Tarih</th><th>Hesap</th><th>Tip</th><th>Açıklama</th><th className="text-right">Tutar</th></tr>
                    </thead>
                    <tbody>
                      {[...hesapHareketleri].sort((a, b) => `${b.tarih}`.localeCompare(`${a.tarih}`)).slice(0, 200).map((h) => {
                        const hesap = hesaplar.find((x) => x.id === h.hesapId);
                        const pb = hesap?.paraBirimi || ana;
                        const ti = HAREKET_TIP_INFO(h.tip);
                        const isPos = Number(h.tutar) >= 0;
                        return (
                          <tr key={h.id}>
                            <td className="text-sm">{fmtDateTR(h.tarih)}</td>
                            <td className="text-sm">{hesap?.ad || '-'}</td>
                            <td><span className={`htl-badge ${isPos ? 'htl-badge-success' : 'htl-badge-danger'}`}>{ti.l}</span></td>
                            <td className="text-sm" style={{ color: 'var(--ink-soft)' }}>{h.aciklama || '-'}</td>
                            <td className="text-right font-medium" style={{ color: isPos ? 'var(--success)' : 'var(--danger)' }}>
                              {isPos ? '+' : ''}{fmtMoney(h.tutar, pb)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <TahsilatModal
        open={tahsilatOpen}
        onClose={() => { setTahsilatOpen(false); setEditingTah(null); }}
        target={editingTah}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        rezervasyonlar={reservationsAll}
        misafirler={misafirler}
        tahsilatlar={tahsilatlar}
        ana={ana}
        userId={user?.id}
      />

      <GiderModal
        open={giderOpen}
        onClose={() => { setGiderOpen(false); setEditingGider(null); }}
        target={editingGider}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        kategoriler={giderKategorileri}
        ana={ana}
        userId={user?.id}
      />

      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        ana={ana}
        userId={user?.id}
      />

      <HesapFormModal
        open={hesapFormOpen}
        onClose={() => { setHesapFormOpen(false); setEditingHesap(null); }}
        target={editingHesap}
        hesapHareketleri={hesapHareketleri}
        ana={ana}
      />

      <HesapDetayModal
        open={!!hesapDetay}
        onClose={() => setHesapDetay(null)}
        hesap={hesapDetay}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        ana={ana}
        userId={user?.id}
        canDelete={can('onMuhasebe', 'hesap-yonet')}
      />

      <ConfirmModal
        open={!!confirmDelTah}
        title="Tahsilatı Sil"
        msg="Bu tahsilat ve bağlı hesap hareketi silinecek."
        onConfirm={async () => {
          try { await deleteTahsilatWithHareket(confirmDelTah.id); show('Tahsilat silindi.'); }
          catch (e) { show('Hata: ' + e.message, 'error'); }
          setConfirmDelTah(null);
        }}
        onCancel={() => setConfirmDelTah(null)}
      />
      <ConfirmModal
        open={!!confirmDelGider}
        title="Gideri Sil"
        msg="Bu gider ve bağlı hesap hareketi silinecek."
        onConfirm={async () => {
          try { await deleteGiderWithHareket(confirmDelGider.id); show('Gider silindi.'); }
          catch (e) { show('Hata: ' + e.message, 'error'); }
          setConfirmDelGider(null);
        }}
        onCancel={() => setConfirmDelGider(null)}
      />
    </>
  );
};

export default AccountingPage;
