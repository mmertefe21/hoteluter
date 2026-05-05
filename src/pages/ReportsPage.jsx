/**
 * ReportsPage — Tarih Aralığı + Yıllık Ciro (custom SVG bar chart, Recharts'sız).
 */
import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useCollection, useDoc } from '../lib/db.js';
import { fmtMoney, todayISO, addDays, diffDays } from '../lib/helpers.js';

const ReportsPage = () => {
  const [tab, setTab] = useState('aralik');

  const otel = useDoc('otel', 'main');
  const ana = otel?.anaParaBirimi || 'EUR';
  const reservations = useCollection('rezervasyonlar');
  const tahsilatlar = useCollection('tahsilatlar');
  const giderler = useCollection('giderler');
  const odalar = useCollection('odalar');
  const odaTipleri = useCollection('odaTipleri');

  // === Tarih Aralığı ===
  const today = todayISO();
  const [from, setFrom] = useState(() => addDays(today, -30));
  const [to, setTo] = useState(today);

  const aralikStats = useMemo(() => {
    const sumAna = (list) =>
      list.reduce((s, t) => s + Number(t.tutarAna != null ? t.tutarAna : t.tutar || 0), 0);
    const tahs = tahsilatlar.filter((t) => t.tarih >= from && t.tarih <= to);
    const gid = giderler.filter((g) => g.tarih >= from && g.tarih <= to);
    const totalTah = sumAna(tahs);
    const totalGid = sumAna(gid);
    const net = totalTah - totalGid;

    const aktifDurumlar = ['onayli', 'giris-yapildi', 'cikis-yapildi'];
    const ilgili = reservations.filter((r) =>
      aktifDurumlar.includes(r.durum) && r.girisTarihi <= to && r.cikisTarihi > from
    );
    const gunSayisi = Math.max(1, diffDays(from, to) + 1);
    const totalRoomNights = odalar.length * gunSayisi;

    let doluGece = 0;
    let odaGeliri = 0;
    ilgili.forEach((r) => {
      let d = r.girisTarihi;
      while (d < r.cikisTarihi) {
        if (d >= from && d <= to) {
          doluGece++;
          if (r.fiyatModu === 'detay' && Array.isArray(r.geceFiyatlari)) {
            const idx = diffDays(r.girisTarihi, d);
            odaGeliri += Number(r.geceFiyatlari[idx]) || Number(r.geceFiyati) || 0;
          } else {
            odaGeliri += Number(r.geceFiyati) || 0;
          }
        }
        d = addDays(d, 1);
      }
    });
    const dolulukYuzde = totalRoomNights > 0 ? (doluGece / totalRoomNights) * 100 : 0;
    const adr = doluGece > 0 ? odaGeliri / doluGece : 0;

    return { totalTah, totalGid, net, dolulukYuzde, doluGece, totalRoomNights, adr, odaGeliri, rezSayisi: ilgili.length };
  }, [from, to, tahsilatlar, giderler, reservations, odalar]);

  // === Yıllık ===
  const [yil, setYil] = useState(new Date().getFullYear());

  const yillikStats = useMemo(() => {
    const aylar = Array.from({ length: 12 }, (_, m) => {
      const ayBas = `${yil}-${String(m + 1).padStart(2, '0')}-01`;
      const ayBasD = new Date(yil, m, 1);
      const aySonD = new Date(yil, m + 1, 0);
      const aySon = aySonD.toISOString().slice(0, 10);
      const tahs = tahsilatlar.filter((t) => t.tarih >= ayBas && t.tarih <= aySon);
      const totalTah = tahs.reduce((s, t) => s + Number(t.tutarAna != null ? t.tutarAna : t.tutar || 0), 0);
      const gid = giderler.filter((g) => g.tarih >= ayBas && g.tarih <= aySon);
      const totalGid = gid.reduce((s, g) => s + Number(g.tutarAna != null ? g.tutarAna : g.tutar || 0), 0);
      return {
        m, label: ayBasD.toLocaleDateString('tr-TR', { month: 'short' }),
        tahsilat: totalTah, gider: totalGid, net: totalTah - totalGid,
      };
    });
    const yilTah = aylar.reduce((s, a) => s + a.tahsilat, 0);
    const yilGid = aylar.reduce((s, a) => s + a.gider, 0);
    return { aylar, yilTah, yilGid, yilNet: yilTah - yilGid };
  }, [yil, tahsilatlar, giderler]);

  const maxBar = Math.max(1, ...yillikStats.aylar.map((a) => Math.max(a.tahsilat, a.gider)));
  const chartW = 720, chartH = 260, margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerW = chartW - margin.left - margin.right;
  const innerH = chartH - margin.top - margin.bottom;
  const barGroupW = innerW / 12;
  const barW = (barGroupW - 8) / 2;

  return (
    <div className="space-y-4">
      <div className="htl-card">
        <div className="htl-card-header" style={{ paddingBottom: 0, borderBottom: 'none' }}>
          <div className="flex gap-1 -mb-[1px]" style={{ borderBottom: '1px solid var(--line-soft)', flex: 1 }}>
            <div className={`htl-tab ${tab === 'aralik' ? 'active' : ''}`} onClick={() => setTab('aralik')}>Tarih Aralığı</div>
            <div className={`htl-tab ${tab === 'yillik' ? 'active' : ''}`} onClick={() => setTab('yillik')}>Yıllık Ciro</div>
          </div>
        </div>

        <div className="htl-card-body">
          {tab === 'aralik' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="htl-label">Başlangıç</label>
                  <input type="date" className="htl-input" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <label className="htl-label">Bitiş</label>
                  <input type="date" className="htl-input" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { l: 'Bugün', from: today, to: today },
                    { l: 'Son 7 Gün', from: addDays(today, -6), to: today },
                    { l: 'Son 30 Gün', from: addDays(today, -29), to: today },
                    { l: 'Bu Ay', from: `${today.slice(0, 7)}-01`, to: today },
                  ].map((p) => (
                    <button key={p.l} type="button" className="htl-btn htl-btn-ghost text-xs"
                      onClick={() => { setFrom(p.from); setTo(p.to); }}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="htl-stat">
                  <div className="htl-stat-label">Toplam Tahsilat</div>
                  <div className="htl-stat-value" style={{ fontSize: 24, color: 'var(--success)' }}>{fmtMoney(aralikStats.totalTah, ana)}</div>
                </div>
                <div className="htl-stat">
                  <div className="htl-stat-label">Toplam Gider</div>
                  <div className="htl-stat-value" style={{ fontSize: 24, color: 'var(--danger)' }}>{fmtMoney(aralikStats.totalGid, ana)}</div>
                </div>
                <div className="htl-stat">
                  <div className="htl-stat-label">Net</div>
                  <div className="htl-stat-value" style={{ fontSize: 24, color: aralikStats.net >= 0 ? 'var(--forest)' : 'var(--danger)' }}>{fmtMoney(aralikStats.net, ana)}</div>
                </div>
                <div className="htl-stat">
                  <div className="htl-stat-label">Doluluk</div>
                  <div className="htl-stat-value" style={{ fontSize: 24 }}>%{aralikStats.dolulukYuzde.toFixed(1)}</div>
                  <div className="htl-stat-sub">{aralikStats.doluGece} / {aralikStats.totalRoomNights} oda-gece</div>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-lg p-3" style={{ background: 'var(--bone-warm)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Aktif Rezervasyon</div>
                  <div className="font-display text-xl font-medium mt-1">{aralikStats.rezSayisi}</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'var(--bone-warm)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Oda Geliri (konaklama)</div>
                  <div className="font-display text-xl font-medium mt-1">{fmtMoney(aralikStats.odaGeliri, ana)}</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'var(--bone-warm)' }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>ADR (Ortalama Gece)</div>
                  <div className="font-display text-xl font-medium mt-1">{fmtMoney(aralikStats.adr, ana)}</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'yillik' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button type="button" className="htl-btn htl-btn-ghost" onClick={() => setYil(yil - 1)}>
                    <Icon name="chevron-left" size={16} />
                  </button>
                  <span className="font-display text-2xl font-medium" style={{ color: 'var(--forest)' }}>{yil}</span>
                  <button type="button" className="htl-btn htl-btn-ghost" onClick={() => setYil(yil + 1)} disabled={yil >= new Date().getFullYear()}>
                    <Icon name="chevron-right" size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div><span style={{ color: 'var(--ink-soft)' }}>Tahsilat:</span> <strong style={{ color: 'var(--success)' }}>{fmtMoney(yillikStats.yilTah, ana)}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>Gider:</span> <strong style={{ color: 'var(--danger)' }}>{fmtMoney(yillikStats.yilGid, ana)}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>Net:</span> <strong style={{ color: yillikStats.yilNet >= 0 ? 'var(--forest)' : 'var(--danger)' }}>{fmtMoney(yillikStats.yilNet, ana)}</strong></div>
                </div>
              </div>

              <div className="rounded-lg p-3" style={{ background: 'var(--bone-light)', border: '1px solid var(--line-soft)' }}>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto' }}>
                  {/* Y axis grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((p) => {
                    const y = margin.top + innerH - innerH * p;
                    const value = maxBar * p;
                    return (
                      <g key={p}>
                        <line x1={margin.left} y1={y} x2={margin.left + innerW} y2={y} stroke="var(--line-soft)" strokeWidth="1" />
                        <text x={margin.left - 6} y={y + 4} fontSize="10" textAnchor="end" fill="var(--ink-soft)">{Math.round(value / 1000)}k</text>
                      </g>
                    );
                  })}
                  {/* X axis */}
                  <line x1={margin.left} y1={margin.top + innerH} x2={margin.left + innerW} y2={margin.top + innerH} stroke="var(--line)" strokeWidth="1" />
                  {/* Bars */}
                  {yillikStats.aylar.map((a) => {
                    const xBase = margin.left + a.m * barGroupW + 4;
                    const tahH = (a.tahsilat / maxBar) * innerH;
                    const gidH = (a.gider / maxBar) * innerH;
                    return (
                      <g key={a.m}>
                        <rect x={xBase} y={margin.top + innerH - tahH} width={barW} height={tahH} fill="var(--success)" rx="2" />
                        <rect x={xBase + barW + 4} y={margin.top + innerH - gidH} width={barW} height={gidH} fill="var(--danger)" rx="2" />
                        <text x={xBase + barW} y={margin.top + innerH + 16} fontSize="11" textAnchor="middle" fill="var(--ink-soft)">{a.label}</text>
                      </g>
                    );
                  })}
                </svg>
                <div className="flex justify-center gap-4 text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: 'var(--success)' }} />Tahsilat</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ background: 'var(--danger)' }} />Gider</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="htl-table">
                  <thead>
                    <tr><th>Ay</th><th className="text-right">Tahsilat</th><th className="text-right">Gider</th><th className="text-right">Net</th></tr>
                  </thead>
                  <tbody>
                    {yillikStats.aylar.map((a) => (
                      <tr key={a.m}>
                        <td className="font-medium">{a.label}</td>
                        <td className="text-right" style={{ color: 'var(--success)' }}>{fmtMoney(a.tahsilat, ana)}</td>
                        <td className="text-right" style={{ color: 'var(--danger)' }}>{fmtMoney(a.gider, ana)}</td>
                        <td className="text-right font-medium" style={{ color: a.net >= 0 ? 'var(--forest)' : 'var(--danger)' }}>{fmtMoney(a.net, ana)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
