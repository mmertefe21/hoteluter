/**
 * DashboardPage — KPI + Bu Ayın İstatistikleri + bugün gelenler/çıkanlar/gemide.
 */
import { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import { useCollection, useDoc } from '../lib/db.js';
import { todayISO, addDays, diffDays, fmtMoney, fmtDateTR } from '../lib/helpers.js';

const DashboardPage = () => {
  const today = todayISO();
  const otel = useDoc('otel', 'main');
  const ana = otel?.anaParaBirimi || 'EUR';

  const reservations = useCollection('rezervasyonlar');
  const odalar = useCollection('odalar');
  const misafirler = useCollection('misafirler');
  const tahsilatlar = useCollection('tahsilatlar');

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const aktifRezler = reservations.filter((r) => r.durum !== 'iptal' && r.durum !== 'no-show');

  const bugunGiris = aktifRezler.filter((r) => r.girisTarihi === today);
  const bugunCikis = aktifRezler.filter((r) => r.cikisTarihi === today);
  const gemide = aktifRezler.filter((r) =>
    r.durum === 'giris-yapildi' ||
    (r.girisTarihi <= today && r.cikisTarihi > today && r.durum === 'onayli')
  );
  const dolulukOrani = odalar.length > 0 ? Math.round((gemide.length / odalar.length) * 100) : 0;

  const sumTutarAna = (filterFn) =>
    tahsilatlar.filter(filterFn).reduce(
      (s, t) => s + Number(t.tutarAna != null ? t.tutarAna : t.tutar || 0),
      0
    );
  const bugunTahsilat = sumTutarAna((t) => t.tarih === today);
  const ayBaslangic = new Date(); ayBaslangic.setDate(1); ayBaslangic.setHours(0, 0, 0, 0);
  const ayBasIso = ayBaslangic.toISOString().slice(0, 10);
  const buAyTahsilat = sumTutarAna((t) => t.tarih >= ayBasIso);

  const monthStats = useMemo(() => {
    const [yyy, mm] = selectedMonth.split('-').map(Number);
    if (!yyy || !mm) return null;
    const ayIlk = new Date(yyy, mm - 1, 1);
    const aySon = new Date(yyy, mm, 0);
    const ilkIso = ayIlk.toISOString().slice(0, 10);
    const sonIso = aySon.toISOString().slice(0, 10);
    const ayGunSayisi = aySon.getDate();
    const totalRoomNights = odalar.length * ayGunSayisi;

    const aktifDurumlar = ['onayli', 'giris-yapildi', 'cikis-yapildi'];
    const ilgili = reservations.filter((r) =>
      aktifDurumlar.includes(r.durum) &&
      r.girisTarihi <= sonIso &&
      r.cikisTarihi > ilkIso
    );

    let doluGece = 0;
    let odaGeliri = 0;
    ilgili.forEach((r) => {
      let d = r.girisTarihi;
      while (d < r.cikisTarihi) {
        if (d >= ilkIso && d <= sonIso) {
          doluGece++;
          if (r.fiyatModu === 'detay' && Array.isArray(r.geceFiyatlari)) {
            const idx = diffDays(r.girisTarihi, d);
            const gf = r.geceFiyatlari[idx];
            odaGeliri += Number(gf) || Number(r.geceFiyati) || 0;
          } else {
            odaGeliri += Number(r.geceFiyati) || 0;
          }
        }
        d = addDays(d, 1);
      }
    });

    const dolulukYuzde = totalRoomNights > 0 ? (doluGece / totalRoomNights) * 100 : 0;
    const adr = doluGece > 0 ? odaGeliri / doluGece : 0;
    const ayLabel = ayIlk.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

    return { dolulukYuzde, rezSayisi: ilgili.length, doluGece, totalRoomNights, adr, odaGeliri, ayLabel };
  }, [selectedMonth, reservations, odalar]);

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const l = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
      opts.push({ v, l });
    }
    return opts;
  }, []);

  const renderRezRow = (r) => {
    const m = misafirler.find((x) => x.id === r.anaMisafirId);
    const oda = odalar.find((x) => x.id === r.odaId);
    return (
      <tr key={r.id}>
        <td className="font-medium">{m ? `${m.ad} ${m.soyad}` : '-'}</td>
        <td>{oda?.odaNumarasi || '-'}</td>
        <td>{r.yetiskinSayisi}Y / {r.cocukSayisi}Ç</td>
        <td>{fmtDateTR(r.girisTarihi)} → {fmtDateTR(r.cikisTarihi)}</td>
        <td className="text-right font-medium">{fmtMoney(r.toplamTutar || 0, ana)}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="htl-stat">
          <div className="htl-stat-label">Doluluk</div>
          <div className="htl-stat-value">%{dolulukOrani}</div>
          <div className="htl-stat-sub">{gemide.length} / {odalar.length} oda dolu</div>
        </div>
        <div className="htl-stat">
          <div className="htl-stat-label">Bugün Giriş</div>
          <div className="htl-stat-value">{bugunGiris.length}</div>
          <div className="htl-stat-sub">rezervasyon</div>
        </div>
        <div className="htl-stat">
          <div className="htl-stat-label">Bugün Çıkış</div>
          <div className="htl-stat-value">{bugunCikis.length}</div>
          <div className="htl-stat-sub">rezervasyon</div>
        </div>
        <div className="htl-stat">
          <div className="htl-stat-label">Bu Ay Tahsilat</div>
          <div className="htl-stat-value" style={{ fontSize: 26 }}>{fmtMoney(buAyTahsilat, ana)}</div>
          <div className="htl-stat-sub">bugün: {fmtMoney(bugunTahsilat, ana)}</div>
        </div>
      </div>

      {monthStats && (
        <div className="htl-card">
          <div className="htl-card-header">
            <div className="flex items-center gap-2">
              <Icon name="bar-chart-3" size={18} stroke="var(--brass)" />
              <h3 className="font-display text-lg font-medium" style={{ color: 'var(--forest)' }}>İstatistikler</h3>
              <span className="text-sm" style={{ color: 'var(--ink-soft)' }}>· {monthStats.ayLabel}</span>
            </div>
            <select className="htl-input" style={{ maxWidth: 200 }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {monthOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="htl-card-body" style={{ padding: 0 }}>
            <div>
              {[
                { icon: 'bar-chart-3', label: 'Doluluk', value: `%${monthStats.dolulukYuzde.toFixed(2)}`, sub: `${monthStats.doluGece} / ${monthStats.totalRoomNights} oda-gece` },
                { icon: 'book-open', label: 'Rezervasyon Sayısı', value: monthStats.rezSayisi, sub: 'aktif rezervasyon' },
                { icon: 'moon', label: 'Konaklanan Gece', value: monthStats.doluGece, sub: 'dolu oda-gece' },
                { icon: 'moon-star', label: 'Olası Toplam Gece', value: monthStats.totalRoomNights, sub: `${odalar.length} oda × ay günü` },
                { icon: 'banknote', label: 'Ortalama Oda Fiyatı (ADR)', value: fmtMoney(monthStats.adr, ana), sub: 'dolu gece başına' },
                { icon: 'wallet', label: 'Toplam Ciro', value: fmtMoney(monthStats.odaGeliri, ana), sub: `${monthStats.doluGece} gece × konaklama bedeli`, highlight: true },
              ].map((row, i) => (
                <div key={i} className="flex items-center px-5 py-4 gap-4" style={{
                  borderTop: i === 0 ? '1px solid var(--line-soft)' : 'none',
                  borderBottom: '1px solid var(--line-soft)',
                  background: row.highlight ? 'var(--brass-soft)' : undefined,
                }}>
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: row.highlight ? 'var(--brass)' : 'var(--bone-warm)' }}>
                    <Icon name={row.icon} size={22} stroke={row.highlight ? 'white' : 'var(--brass)'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ color: row.highlight ? 'var(--forest)' : 'var(--ink-soft)', fontWeight: row.highlight ? 600 : 400 }}>{row.label}</div>
                    {row.sub && <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{row.sub}</div>}
                  </div>
                  <div className="font-display font-medium" style={{ color: 'var(--forest)', fontSize: row.highlight ? 28 : 24 }}>{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="htl-card">
          <div className="htl-card-header">
            <div className="flex items-center gap-2">
              <Icon name="log-in" size={18} stroke="var(--success)" />
              <h3 className="font-display text-lg font-medium">Bugün Gelenler</h3>
            </div>
            <span className="htl-badge htl-badge-success">{bugunGiris.length}</span>
          </div>
          <div className="overflow-x-auto">
            {bugunGiris.length === 0 ? (
              <div className="htl-empty">Bugün giriş yapacak misafir yok.</div>
            ) : (
              <table className="htl-table">
                <thead><tr><th>Misafir</th><th>Oda</th><th>Kişi</th><th>Tarih</th><th className="text-right">Tutar</th></tr></thead>
                <tbody>{bugunGiris.map(renderRezRow)}</tbody>
              </table>
            )}
          </div>
        </div>

        <div className="htl-card">
          <div className="htl-card-header">
            <div className="flex items-center gap-2">
              <Icon name="log-out" size={18} stroke="var(--warn)" />
              <h3 className="font-display text-lg font-medium">Bugün Çıkanlar</h3>
            </div>
            <span className="htl-badge htl-badge-warn">{bugunCikis.length}</span>
          </div>
          <div className="overflow-x-auto">
            {bugunCikis.length === 0 ? (
              <div className="htl-empty">Bugün çıkış yapacak misafir yok.</div>
            ) : (
              <table className="htl-table">
                <thead><tr><th>Misafir</th><th>Oda</th><th>Kişi</th><th>Tarih</th><th className="text-right">Tutar</th></tr></thead>
                <tbody>{bugunCikis.map(renderRezRow)}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="htl-card">
        <div className="htl-card-header">
          <div className="flex items-center gap-2">
            <Icon name="bed-double" size={18} stroke="var(--info)" />
            <h3 className="font-display text-lg font-medium">Otelde</h3>
          </div>
          <span className="htl-badge htl-badge-info">{gemide.length} misafir</span>
        </div>
        <div className="overflow-x-auto">
          {gemide.length === 0 ? (
            <div className="htl-empty">Şu anda otelde misafir yok.</div>
          ) : (
            <table className="htl-table">
              <thead><tr><th>Misafir</th><th>Oda</th><th>Kişi</th><th>Tarih</th><th className="text-right">Tutar</th></tr></thead>
              <tbody>{gemide.map(renderRezRow)}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
