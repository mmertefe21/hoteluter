/**
 * CalendarPage — Gantt takvim (gece-bazlı bar render).
 *
 * Özellikler:
 *   - 15 / 30 / 45 gün view
 *   - Bugün / +days / -days nav
 *   - Oda tipi filtresi
 *   - Bar tıklayınca rezervasyon düzenleme açılır
 *   - Drag-to-create (boş hücreye basıp sürükle → ReservationFormModal prefill)
 *   - Edit mode: drag-to-move (segment-aware, çakışma kontrolü, onay modali)
 *   - Edit mode: bar üzerinde makas/böl butonu (>60px) → SplitModal
 *   - Bar gece bazlı: çıkış günü hücresi BOŞ kalır (otelcilik kuralı)
 *   - Segmentler: bölünmüş rezde her segment ayrı bar, link icon, 1/N etiketi
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useToast } from '../components/Toast.jsx';
import ReservationFormModal from '../modals/ReservationFormModal.jsx';
import GrupRezervasyonModal from '../modals/GrupRezervasyonModal.jsx';
import GrupDetayModal from '../modals/GrupDetayModal.jsx';
import RezervasyonTipiSecimModal from '../modals/RezervasyonTipiSecimModal.jsx';
import SplitModal from '../modals/SplitModal.jsx';
import { db, useCollection, useDoc } from '../lib/db.js';
import { addDays, todayISO, fmtDateTR, fmtDateShort, isWeekend } from '../lib/helpers.js';
import { getOdaSegmentleri, checkOverlap } from '../helpers/segmentler.js';
import { useAuth } from '../lib/auth.jsx';

const CalendarPage = () => {
  const { can, user } = useAuth();
  const { show } = useToast();

  const [startDate, setStartDate] = useState(addDays(todayISO(), -2));
  const [days, setDays] = useState(30);
  const [filterTipId, setFilterTipId] = useState('');
  const [editingRez, setEditingRez] = useState(null);
  const [tipiSecim, setTipiSecim] = useState(null);
  const [tekRez, setTekRez] = useState(null);
  const [grupRez, setGrupRez] = useState(null);
  const [grupDetay, setGrupDetay] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [rezDrag, setRezDrag] = useState(null);
  const [moveConfirm, setMoveConfirm] = useState(null);
  const [splitTarget, setSplitTarget] = useState(null);
  const [hoveredTipId, setHoveredTipId] = useState(null);
  const [havuz, setHavuz] = useState([]);
  const [havuzDrag, setHavuzDrag] = useState(null);
  const [havuzHoverOdaId, setHavuzHoverOdaId] = useState(null);
  const [panelPos, setPanelPos] = useState({ x: 8, y: 300 });

  const otel = useDoc('otel', 'main');
  const ana = otel?.anaParaBirimi || 'EUR';
  const odaTipleri = useCollection('odaTipleri');
  const odalarRaw = useCollection('odalar');
  const odalar = [...odalarRaw].sort((a, b) => `${a.odaNumarasi}`.localeCompare(`${b.odaNumarasi}`));
  const filteredOdalar = filterTipId ? odalar.filter((o) => o.odaTipiId === filterTipId) : odalar;
  const odaTipiGruplari = useMemo(() => {
    const tipMap = {};
    filteredOdalar.forEach((oda) => {
      const tid = oda.odaTipiId || '__diger__';
      if (!tipMap[tid]) tipMap[tid] = [];
      tipMap[tid].push(oda);
    });
    return Object.entries(tipMap)
      .map(([tid, gr]) => ({
        odaTipi: odaTipleri.find((t) => t.id === tid) || null,
        tipId: tid,
        odalar: [...gr].sort((a, b) =>
          `${a.odaNumarasi}`.localeCompare(`${b.odaNumarasi}`, undefined, { numeric: true })
        ),
      }))
      .sort((a, b) => {
        const aSira = a.odaTipi?.siraNo ?? 999;
        const bSira = b.odaTipi?.siraNo ?? 999;
        if (aSira !== bSira) return aSira - bSira;
        return (a.odaTipi?.ad || 'ÿ').localeCompare(b.odaTipi?.ad || 'ÿ', 'tr');
      });
  }, [filteredOdalar, odaTipleri]);
  const reservationsAll = useCollection('rezervasyonlar');
  const reservations = reservationsAll.filter((r) => r.durum !== 'iptal' && r.durum !== 'no-show');
  const misafirler = useCollection('misafirler');
  const hesaplar = useCollection('hesaplar');
  const hesapHareketleri = useCollection('hesapHareketleri');
  const tahsilatlar = useCollection('tahsilatlar');
  const kanallar = useCollection('kanallar');
  const gruplar = useCollection('gruplar');

  const dateList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(startDate, i)),
    [startDate, days]
  );

  const borcMap = useMemo(() => {
    const map = {};
    reservations.forEach((r) => {
      if (r.grupId) return;
      const odenen = tahsilatlar
        .filter((t) => t.rezervasyonId === r.id)
        .reduce((s, t) => s + Number(t.tutarAna ?? t.tutar ?? 0), 0);
      map[r.id] = (r.toplamTutar || 0) - odenen;
    });
    return map;
  }, [reservations, tahsilatlar]);

  const grupBorcMap = useMemo(() => {
    const map = {};
    gruplar.forEach((g) => {
      const gRezler = reservations.filter((r) => r.grupId === g.id);
      const toplamTutar = gRezler.reduce((s, r) => s + (r.toplamTutar || 0), 0);
      const odaOdenen = tahsilatlar
        .filter((t) => t.rezervasyonId && gRezler.some((r) => r.id === t.rezervasyonId))
        .reduce((s, t) => s + Number(t.tutarAna ?? t.tutar ?? 0), 0);
      const havuzOdenen = tahsilatlar
        .filter((t) => t.grupId === g.id && !t.rezervasyonId)
        .reduce((s, t) => s + Number(t.tutarAna ?? t.tutar ?? 0), 0);
      map[g.id] = toplamTutar - odaOdenen - havuzOdenen;
    });
    return map;
  }, [gruplar, reservations, tahsilatlar]);

  const doluluKMap = useMemo(() => {
    const map = {};
    const toplamOda = filteredOdalar.length;
    dateList.forEach((date) => {
      const doluOdaSet = new Set();
      const rezSet = new Set();
      reservations.forEach((r) => {
        getOdaSegmentleri(r).forEach((s) => {
          if (
            filteredOdalar.some((o) => o.id === s.odaId) &&
            s.girisTarihi <= date &&
            date < s.cikisTarihi
          ) {
            doluOdaSet.add(s.odaId);
            rezSet.add(r.id);
          }
        });
      });
      map[date] = {
        doluOda: doluOdaSet.size,
        rezSayisi: rezSet.size,
        yuzde: toplamOda > 0 ? (doluOdaSet.size / toplamOda) * 100 : 0,
      };
    });
    return map;
  }, [dateList, filteredOdalar, reservations]);

  const cellWidth = days >= 45 ? 34 : days >= 30 ? 44 : 60;
  const today = todayISO();

  const handleSiraDegis = async (tipId, direction) => {
    const idx = odaTipiGruplari.findIndex((g) => g.tipId === tipId);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= odaTipiGruplari.length) return;
    const a = odaTipiGruplari[idx].odaTipi;
    const b = odaTipiGruplari[targetIdx].odaTipi;
    if (!a || !b) return;
    const batch = db.batch();
    // Tüm tipleri normalize et (undefined siraNo'ları mevcut index'e sabitle)
    odaTipiGruplari.forEach((g, i) => {
      if (!g.odaTipi) return;
      if (g.tipId === tipId || g.tipId === odaTipiGruplari[targetIdx].tipId) return;
      if (g.odaTipi.siraNo === undefined || g.odaTipi.siraNo === null || g.odaTipi.siraNo !== i) {
        batch.update('odaTipleri', g.odaTipi.id, { siraNo: i });
      }
    });
    batch.update('odaTipleri', a.id, { siraNo: targetIdx });
    batch.update('odaTipleri', b.id, { siraNo: idx });
    await batch.commit().catch((e) => show('Hata: ' + e.message, 'error'));
  };

  const handleHavuzaAl = (rez) => {
    if (rez.segmentler && rez.segmentler.length > 0) {
      show('Bölünmüş rezervasyonlar havuza alınamaz.', 'error');
      return;
    }
    setHavuz((prev) => {
      if (prev.some((h) => h.rez.id === rez.id)) return prev;
      return [...prev, { rez, origOdaId: rez.odaId, origOdaTipiId: rez.odaTipiId }];
    });
  };

  const handleHavuzIptal = async () => {
    if (havuz.length > 0) {
      try {
        const batch = db.batch();
        havuz.forEach((item) => {
          batch.update('rezervasyonlar', item.rez.id, { odaId: item.origOdaId, odaTipiId: item.origOdaTipiId });
        });
        await batch.commit();
      } catch (e) {
        show('Hata: ' + e.message, 'error');
      }
    }
    setHavuz([]);
    setHavuzDrag(null);
    setHavuzHoverOdaId(null);
  };

  const handleHavuzKaydet = async () => {
    if (havuz.length > 0) {
      show('Çalışma havuzunda ' + havuz.length + ' rezervasyon var. Önce hepsini yerleştirin veya iptal edin.', 'error');
      return;
    }
    setHavuz([]);
    setHavuzDrag(null);
    setHavuzHoverOdaId(null);
    setEditMode(false);
    show('Değişiklikler kaydedildi.');
  };

  const handleHavuzDrop = async (odaId) => {
    if (!havuzDrag) return;
    const { rez } = havuzDrag;
    const hedefOda = odalar.find((o) => o.id === odaId);
    const overlap = checkOverlap(odaId, rez.girisTarihi, rez.cikisTarihi, rez.id, reservations.filter(r => !havuz.some(h => h.rez.id === r.id)));
    if (overlap) {
      show('Bu odada çakışma var, yerleştirilemedi.', 'error');
      setHavuzDrag(null);
      setHavuzHoverOdaId(null);
      return;
    }
    try {
      await db.update('rezervasyonlar', rez.id, {
        odaId,
        odaTipiId: hedefOda?.odaTipiId || rez.odaTipiId,
      });
      const nextHavuz = havuz.filter((h) => h.rez.id !== rez.id);
      setHavuz(nextHavuz);
      setHavuzDrag(null);
      setHavuzHoverOdaId(null);
      show('Rezervasyon yerleştirildi.');
      console.log('havuz after drop:', nextHavuz.length);
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    }
  };

  const handlePanelMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX - panelPos.x;
    const startY = e.clientY - panelPos.y;
    document.body.style.cursor = 'grabbing';
    const onMove = (ev) => setPanelPos({ x: ev.clientX - startX, y: ev.clientY - startY });
    const onUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const getResForRoom = (odaId) => {
    const out = [];
    reservations.forEach((r) => {
      const segs = getOdaSegmentleri(r);
      segs.forEach((s) => {
        if (s.odaId === odaId) out.push({ rez: r, seg: s });
      });
    });
    return out;
  };

  const getResStyle = (res, _seg) => {
    const grup = res.grupId ? gruplar.find((g) => g.id === res.grupId) : null;
    if (grup) return { background: grup.renk };
    if (res.checkOutTarihi) return { background: '#d97706' }; // turuncu — check-out yapıldı
    if (res.checkInTarihi) return { background: '#16a34a' };  // yeşil — check-in yapıldı
    return { background: '#2563eb' }; // mavi — onaylı
  };

  // Gece bazlı bar — çıkış günü boş kalır
  const computeBar = (segGiris, segCikis) => {
    const sonGece = addDays(segCikis, -1);
    if (sonGece < segGiris) return null;
    const startIdx = dateList.indexOf(segGiris);
    const endIdx = dateList.indexOf(sonGece);
    const visibleStart = startIdx >= 0 ? startIdx : (segGiris < dateList[0] ? 0 : -1);
    const visibleEnd = endIdx >= 0 ? endIdx : (sonGece > dateList[dateList.length - 1] ? dateList.length - 1 : -1);
    if (visibleStart === -1 || visibleEnd === -1 || visibleStart > visibleEnd) return null;
    const left = visibleStart * cellWidth + 2;
    const width = (visibleEnd - visibleStart + 1) * cellWidth - 4;
    return { left, width: Math.max(30, width) };
  };

  const handleCellMouseDown = (odaId, dateIdx, e) => {
    if (!can('rezervasyon', 'ekle')) return;
    if (e.button !== 0) return;
    const cellDate = dateList[dateIdx];
    const cellDateNext = addDays(cellDate, 1);
    if (checkOverlap(odaId, cellDate, cellDateNext, null, reservations.filter(r => !havuz.some(h => h.rez.id === r.id)))) return;
    e.preventDefault();
    setMouse({ x: e.clientX, y: e.clientY });
    setDrag({ odaId, startIdx: dateIdx, currentIdx: dateIdx });
  };

  const handleCellMouseEnter = (odaId, dateIdx) => {
    if (!drag) return;
    if (drag.odaId !== odaId) return;
    setDrag((d) => ({ ...d, currentIdx: dateIdx }));
  };

  useEffect(() => {
    if (!drag) return undefined;
    const onMove = (e) => setMouse({ x: e.clientX, y: e.clientY });
    const onUp = () => {
      if (!drag) return;
      const lo = Math.min(drag.startIdx, drag.currentIdx);
      const hi = Math.max(drag.startIdx, drag.currentIdx);
      const giris = dateList[lo];
      const cikis = addDays(dateList[hi], 1);
      if (!checkOverlap(drag.odaId, giris, cikis, null, reservations.filter(r => !havuz.some(h => h.rez.id === r.id)))) {
        setTipiSecim({ prefill: { odaId: drag.odaId, girisTarihi: giris, cikisTarihi: cikis } });
      }
      setDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, dateList, reservations]);

  useEffect(() => {
    if (!editMode) {
      setHavuz([]);
      setHavuzDrag(null);
      setHavuzHoverOdaId(null);
    }
  }, [editMode]);

  const isCellInDrag = (odaId, dateIdx) => {
    if (!drag) return false;
    if (drag.odaId !== odaId) return false;
    const lo = Math.min(drag.startIdx, drag.currentIdx);
    const hi = Math.max(drag.startIdx, drag.currentIdx);
    return dateIdx >= lo && dateIdx <= hi;
  };

  const handleMoveConfirm = async () => {
    const r = moveConfirm.rez;
    const isMulti = r.segmentler && r.segmentler.length > 0;
    try {
      if (isMulti) {
        const newSegs = r.segmentler.map((s, idx) =>
          idx === moveConfirm.segIdx
            ? { ...s, odaId: moveConfirm.yeniOda.id, odaTipiId: moveConfirm.yeniOda.odaTipiId }
            : s
        );
        await db.update('rezervasyonlar', r.id, {
          segmentler: newSegs,
          odaId: newSegs[0].odaId,
          odaTipiId: newSegs[0].odaTipiId,
        });
      } else {
        await db.update('rezervasyonlar', r.id, {
          odaId: moveConfirm.yeniOda.id,
          odaTipiId: moveConfirm.yeniOda.odaTipiId,
        });
      }
      show('Oda değiştirildi.');
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setMoveConfirm(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="htl-card">
        <div className="htl-card-header">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" className="htl-btn htl-btn-ghost" onClick={() => setStartDate(addDays(startDate, -days))}>
              <Icon name="chevron-left" size={16} /><span>-{days}</span>
            </button>
            <button type="button" className="htl-btn htl-btn-ghost" onClick={() => setStartDate(addDays(todayISO(), -2))}>Bugün</button>
            <button type="button" className="htl-btn htl-btn-ghost" onClick={() => setStartDate(addDays(startDate, days))}>
              <span>+{days}</span><Icon name="chevron-right" size={16} />
            </button>
            <input type="date" className="htl-input" style={{ maxWidth: 180 }} value={startDate}
              onChange={(e) => setStartDate(e.target.value)} />

            <div className="flex gap-0.5 p-0.5 rounded-md" style={{ background: 'var(--bone-warm)' }}>
              {[15, 30, 45].map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)}
                  className="px-2.5 py-1 rounded text-xs font-medium transition"
                  style={{
                    background: days === d ? 'var(--bone-light)' : 'transparent',
                    color: days === d ? 'var(--forest)' : 'var(--ink-soft)',
                    boxShadow: days === d ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
                  }}>{d} gün</button>
              ))}
            </div>

            <select className="htl-input" style={{ maxWidth: 200 }} value={filterTipId} onChange={(e) => setFilterTipId(e.target.value)}>
              <option value="">Tüm oda tipleri</option>
              {odaTipleri.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {can('rezervasyon', 'duzenle') && (
                <button type="button" onClick={() => setEditMode(!editMode)} className="htl-btn"
                  style={{
                    background: editMode ? 'var(--brass)' : 'transparent',
                    color: editMode ? 'white' : 'var(--ink-soft)',
                    border: `1px solid ${editMode ? 'var(--brass)' : 'var(--line)'}`,
                  }}>
                  <Icon name={editMode ? 'check' : 'move'} size={16} stroke={editMode ? 'white' : 'currentColor'} />
                  <span>{editMode ? 'Düzenleme Aktif' : 'Düzenleme Modu'}</span>
                </button>
              )}
              {can('rezervasyon', 'ekle') && (
                <button type="button" className="htl-btn htl-btn-accent" onClick={() => setTipiSecim({ prefill: null })}>
                  <Icon name="plus" size={16} stroke="white" /><span>Yeni Rezervasyon</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {editMode ? (
          <div className="px-5 py-2 text-xs flex items-center gap-2" style={{ background: 'var(--brass-soft)', color: 'var(--forest)', borderBottom: '1px solid var(--line-soft)' }}>
            <Icon name="move" size={14} />
            <span><strong>Düzenleme aktif:</strong> Bar'ı başka odaya sürükleyip bırak (tarih sabit, oda değişir). Makas ile böl/birleştir.</span>
          </div>
        ) : can('rezervasyon', 'ekle') && (
          <div className="px-5 py-2 text-xs flex items-center gap-2" style={{ background: 'var(--brass-soft)', color: 'var(--forest)', borderBottom: '1px solid var(--line-soft)' }}>
            <Icon name="info" size={14} />
            <span><strong>İpucu:</strong> Boş hücreye basıp sağa sürükle — yeni rezervasyon prefill olarak açılır.</span>
          </div>
        )}

        <div className="htl-card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
            <div style={{ minWidth: 180 + dateList.length * cellWidth, position: 'relative' }}>
              <div style={{
                  display: 'grid',
                  gridTemplateColumns: `180px repeat(${dateList.length}, ${cellWidth}px)`,
                  borderBottom: '1px solid var(--line-soft)',
                  background: 'var(--bone-light)',
                }}>
                  <div style={{ borderRight: '1px solid var(--line)', padding: '8px 12px', display: 'flex', alignItems: 'flex-end', position: 'sticky', left: 0, background: 'var(--bone-light)', zIndex: 2 }}>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-soft)', fontWeight: 600 }}>Doluluk</span>
                  </div>
                  {(() => {
                    const chartH = 46;
                    const paddingTop = 10;
                    const totalW = dateList.length * cellWidth;
                    const pts = dateList.map((d, i) => {
                      const stat = doluluKMap[d] || { doluOda: 0, yuzde: 0 };
                      return { d, stat, cx: (i + 0.5) * cellWidth, cy: paddingTop + (1 - stat.yuzde / 100) * chartH };
                    });
                    return (
                      <div style={{ gridColumn: `2 / span ${dateList.length}`, height: 72, overflow: 'hidden' }}>
                        <svg width={totalW} height={72} style={{ display: 'block' }}>
                          <polygon
                            points={`0,72 ${pts.map(p => `${p.cx},${p.cy}`).join(' ')} ${totalW},72`}
                            fill="rgba(37,99,235,0.12)"
                            stroke="none"
                          />
                          <polyline
                            points={pts.map(p => `${p.cx},${p.cy}`).join(' ')}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                          />
                          {pts.map(({ d, stat, cx, cy }) => (
                            <g key={d}>
                              <circle cx={cx} cy={cy} r={2.5} fill="#2563eb" />
                              {stat.yuzde > 0 && (
                                <>
                                  <text x={cx} y={cy - 5} textAnchor="middle" fontSize={8} fontWeight="700" fill="var(--forest)">
                                    {stat.yuzde.toFixed(1)}
                                  </text>
                                  <text x={cx} y={69} textAnchor="middle" fontSize={8} fill="#6b6b6b">
                                    {stat.doluOda}
                                  </text>
                                </>
                              )}
                            </g>
                          ))}
                        </svg>
                      </div>
                    );
                  })()}
                </div>
              <div className="htl-cal-grid sticky top-0 z-20 md:static" style={{ gridTemplateColumns: `180px repeat(${dateList.length}, ${cellWidth}px)`, borderRadius: '10px 10px 0 0', background: 'var(--forest)' }}>
                <div className="htl-cal-header-blank" style={{ padding: '8px 12px' }}>
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(244,237,224,.7)' }}>Oda</div>
                </div>
                {dateList.map((d) => (
                  <div key={d} className={`htl-cal-header ${isWeekend(d) ? 'weekend' : ''}`}>
                    <div>{new Date(d).toLocaleDateString('tr-TR', { weekday: 'short' })}</div>
                    <div className="font-display text-sm">{new Date(d).getDate()}</div>
                  </div>
                ))}
              </div>

              {filteredOdalar.length === 0 ? (
                <div className="htl-empty" style={{ borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)', borderRadius: '0 0 10px 10px' }}>
                  Bu filtreye uygun oda yok.
                </div>
              ) : (
                <div className="htl-cal-grid" style={{
                  gridTemplateColumns: `180px repeat(${dateList.length}, ${cellWidth}px)`,
                  borderRadius: '0 0 10px 10px',
                  borderTop: 'none',
                  userSelect: drag ? 'none' : 'auto',
                }}>
                  {odaTipiGruplari.map(({ odaTipi, tipId, odalar: grupOdalar }, idx) => (
                    <Fragment key={tipId}>
                      <div
                        onMouseEnter={() => setHoveredTipId(tipId)}
                        onMouseLeave={() => setHoveredTipId(null)}
                        style={{
                          gridColumn: '1 / -1',
                          background: 'var(--bone-warm)',
                          borderBottom: '1px solid var(--line)',
                          borderTop: '1px solid var(--line-soft)',
                          padding: '5px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: odaTipi?.renk || 'var(--brass)' }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--forest)' }}>
                          {odaTipi?.ad || 'Diğer'}
                        </span>
                        {can('odalar', 'duzenle') && hoveredTipId === tipId && odaTipi && (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleSiraDegis(tipId, 'up')}
                              title="Yukarı taşı"
                              style={{ padding: '2px 4px', borderRadius: 4, background: 'transparent', border: '1px solid var(--line)', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}
                            >
                              <Icon name="chevron-up" size={14} stroke="var(--ink-soft)" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === odaTipiGruplari.length - 1}
                              onClick={() => handleSiraDegis(tipId, 'down')}
                              title="Aşağı taşı"
                              style={{ padding: '2px 4px', borderRadius: 4, background: 'transparent', border: '1px solid var(--line)', cursor: idx === odaTipiGruplari.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === odaTipiGruplari.length - 1 ? 0.3 : 1 }}
                            >
                              <Icon name="chevron-down" size={14} stroke="var(--ink-soft)" />
                            </button>
                          </div>
                        )}
                        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>· {grupOdalar.length} oda</span>
                      </div>
                      {grupOdalar.map((oda) => {
                        const tip = odaTipleri.find((t) => t.id === oda.odaTipiId);
                        const resler = getResForRoom(oda.id);
                        const isRezDropTarget = editMode && rezDrag && rezDrag.startOdaId !== oda.id;
                        const isHavuzDropTarget = editMode && !!havuzDrag;
                        const isDropTarget = isRezDropTarget || isHavuzDropTarget;
                        const isRezHovered = isRezDropTarget && rezDrag.hoverOdaId === oda.id;
                        const isHavuzHovered = isHavuzDropTarget && havuzHoverOdaId === oda.id;
                        const isHovered = isRezHovered || isHavuzHovered;
                        let dropBlocked = false;
                        if (isRezHovered && rezDrag?.draggedSeg) {
                          dropBlocked = checkOverlap(oda.id, rezDrag.draggedSeg.girisTarihi, rezDrag.draggedSeg.cikisTarihi, rezDrag.rez.id, reservations.filter(r => !havuz.some(h => h.rez.id === r.id)));
                        }
                        if (isHavuzHovered && havuzDrag) {
                          dropBlocked = checkOverlap(oda.id, havuzDrag.rez.girisTarihi, havuzDrag.rez.cikisTarihi, havuzDrag.rez.id, reservations.filter(r => !havuz.some(h => h.rez.id === r.id)));
                        }
                        return (
                          <Fragment key={oda.id}>
                            <div className="htl-cal-room-label" style={{
                              background: isHovered ? (dropBlocked ? 'var(--danger-soft)' : 'var(--success-soft)') : undefined,
                              transition: 'background 0.1s',
                            }}>
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tip?.renk || 'var(--brass)' }} />
                              <div>
                                <div className="font-medium">Oda {oda.odaNumarasi}</div>
                                <div className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>{tip?.ad || '-'}</div>
                              </div>
                            </div>
                            <div
                              style={{
                                gridColumn: `2 / span ${dateList.length}`,
                                position: 'relative',
                                background: isHovered ? (dropBlocked ? 'rgba(166,69,69,.08)' : 'rgba(74,124,89,.08)') : undefined,
                                outline: isHovered ? `2px dashed ${dropBlocked ? 'var(--danger)' : 'var(--success)'}` : 'none',
                                outlineOffset: -2,
                                transition: 'background 0.1s',
                              }}
                              onDragOver={(e) => {
                                if (!isDropTarget) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = dropBlocked ? 'none' : 'move';
                                if (isRezDropTarget && rezDrag.hoverOdaId !== oda.id) {
                                  setRezDrag({ ...rezDrag, hoverOdaId: oda.id });
                                }
                                if (isHavuzDropTarget && havuzHoverOdaId !== oda.id) {
                                  setHavuzHoverOdaId(oda.id);
                                }
                              }}
                              onDragLeave={() => {
                                if (isHavuzDropTarget) setHavuzHoverOdaId(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (havuzDrag) {
                                  handleHavuzDrop(oda.id);
                                  return;
                                }
                                if (!isRezDropTarget || !rezDrag?.draggedSeg) return;
                                if (havuz.length > 0) {
                                  show('Çalışma havuzunda rezervasyon var. Önce havuzu kaydedin veya iptal edin.', 'error');
                                  setRezDrag(null);
                                  return;
                                }
                                const overlap = checkOverlap(oda.id, rezDrag.draggedSeg.girisTarihi, rezDrag.draggedSeg.cikisTarihi, rezDrag.rez.id, reservations.filter(r => !havuz.some(h => h.rez.id === r.id)));
                                if (overlap) {
                                  show(`Oda ${oda.odaNumarasi}'da çakışma var, taşınamadı.`, 'error');
                                  setRezDrag(null);
                                  return;
                                }
                                setMoveConfirm({
                                  rez: rezDrag.rez,
                                  yeniOda: oda,
                                  eskiOda: odalar.find((x) => x.id === rezDrag.draggedSeg.odaId),
                                  segIdx: rezDrag.segIdx,
                                });
                                setRezDrag(null);
                              }}
                            >
                              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dateList.length}, ${cellWidth}px)`, position: 'absolute', inset: 0 }}>
                                {(() => {
                                  const isHavuzHL = !!(havuzDrag && havuzHoverOdaId === oda.id);
                                  const isHavuzOverlap = isHavuzHL && checkOverlap(oda.id, havuzDrag.rez.girisTarihi, havuzDrag.rez.cikisTarihi, havuzDrag.rez.id, reservations.filter(r => !havuz.some(h => h.rez.id === r.id)));
                                  return dateList.map((d, di) => {
                                    const inDrag = isCellInDrag(oda.id, di);
                                    const inHavuzRange = isHavuzHL && d >= havuzDrag.rez.girisTarihi && d < havuzDrag.rez.cikisTarihi;
                                    const cellBg = inDrag ? 'var(--brass-light)' : inHavuzRange ? (isHavuzOverlap ? '#fee2e2' : '#fef9c3') : undefined;
                                    return (
                                      <div
                                        key={d}
                                        className={`htl-cal-cell ${d === today ? 'today' : ''} ${isWeekend(d) ? 'weekend' : ''}`}
                                        style={{
                                          cursor: editMode ? 'default' : (can('rezervasyon', 'ekle') ? 'cell' : 'default'),
                                          background: cellBg,
                                          transition: 'background 0.05s',
                                        }}
                                        onMouseDown={editMode ? undefined : ((e) => handleCellMouseDown(oda.id, di, e))}
                                        onMouseEnter={editMode ? undefined : (() => handleCellMouseEnter(oda.id, di))}
                                      />
                                    );
                                  });
                                })()}
                              </div>
                              {resler.map(({ rez: res, seg }) => {
                                const pos = computeBar(seg.girisTarihi, seg.cikisTarihi);
                                if (!pos) return null;
                                const m = misafirler.find((x) => x.id === res.anaMisafirId);
                                const grup = res.grupId ? gruplar.find((g) => g.id === res.grupId) : null;
                                const borc = res.grupId ? (grupBorcMap[res.grupId] ?? 0) : (borcMap[res.id] ?? 0);
                                const isBeingDragged = rezDrag && rezDrag.rez.id === res.id && rezDrag.segIdx === seg._segIdx;
                                const isInHavuz = havuz.some((h) => h.rez.id === res.id);
                                const isMulti = seg._isMulti;
                                const segLabel = isMulti ? `${seg._segIdx + 1}/${res.segmentler.length}` : '';
                                const misafirAd = m ? `${m.ad} ${m.soyad}` : res.rezervasyonKodu;
                                const display = grup ? `${grup.ad} — ${misafirAd}` : misafirAd;
                                const titleText = grup
                                  ? `Grup: ${grup.ad}\n${misafirAd} · ${fmtDateTR(seg.girisTarihi)} → ${fmtDateTR(seg.cikisTarihi)}${isMulti ? ` · ${segLabel}` : ''}`
                                  : `${isMulti ? `[${segLabel}] ` : ''}${m ? `${m.ad} ${m.soyad}` : ''} · ${fmtDateTR(seg.girisTarihi)} → ${fmtDateTR(seg.cikisTarihi)}`;
                                return (
                                  <div key={`${res.id}-${seg._segIdx}`} className="htl-res-bar"
                                    draggable={editMode && can('rezervasyon', 'duzenle')}
                                    onDragStart={(e) => {
                                      if (!editMode) { e.preventDefault(); return; }
                                      setRezDrag({ rez: res, startOdaId: oda.id, hoverOdaId: oda.id, draggedSeg: seg, segIdx: seg._segIdx });
                                      e.dataTransfer.effectAllowed = 'move';
                                      try { e.dataTransfer.setData('text/plain', res.id); } catch (err) { /* ignore */ }
                                    }}
                                    onDragEnd={() => setRezDrag(null)}
                                    style={{
                                      ...pos,
                                      ...(isInHavuz ? { background: 'var(--brass)' } : getResStyle(res, seg)),
                                      position: 'absolute',
                                      cursor: editMode ? 'grab' : 'pointer',
                                      opacity: isBeingDragged ? 0.4 : (isInHavuz ? 0.4 : 1),
                                      outline: editMode ? '1px dashed rgba(255,255,255,.6)' : 'none',
                                      outlineOffset: -3,
                                    }}
                                    onClick={() => {
                                      if (rezDrag) return;
                                      if (isInHavuz) return;
                                      if (res.grupId) setGrupDetay(res.grupId);
                                      else setEditingRez(res);
                                    }}
                                    title={titleText}
                                  >
                                    {grup && (
                                      <div style={{
                                        position: 'absolute',
                                        top: 0, left: 0, right: 0,
                                        height: 5,
                                        background: grup.renk,
                                        borderTopLeftRadius: 4,
                                        borderTopRightRadius: 4,
                                        pointerEvents: 'none',
                                      }} />
                                    )}
                                    <div style={{
                                      position: 'absolute',
                                      top: grup ? 5 : 0,
                                      left: 0, right: 0,
                                      height: 4,
                                      background: borc > 0.01 ? 'var(--danger)' : 'var(--success)',
                                      borderTopLeftRadius: grup ? 0 : 4,
                                      borderTopRightRadius: grup ? 0 : 4,
                                      pointerEvents: 'none',
                                    }} />
                                    <Icon name={grup ? 'users' : (isMulti ? 'link' : (editMode ? 'move' : 'user'))} size={12} stroke="white" strokeWidth={2.5} />
                                    <span className="ml-1 truncate">{display}{isMulti ? ` · ${segLabel}` : ''}</span>

                                    {editMode && can('rezervasyon', 'duzenle') && pos.width > 60 && (
                                      <button
                                        type="button"
                                        draggable={false}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setSplitTarget(res);
                                        }}
                                        title={isMulti ? 'Bölmeyi geri al' : 'Rezervasyonu böl'}
                                        style={{
                                          position: 'absolute',
                                          top: 2, right: 2,
                                          width: 18, height: 18,
                                          padding: 0,
                                          background: 'rgba(255,255,255,.95)',
                                          border: 'none',
                                          borderRadius: 4,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          cursor: 'pointer',
                                          boxShadow: '0 1px 2px rgba(0,0,0,.2)',
                                        }}
                                      >
                                        <Icon name={isMulti ? 'undo-2' : 'scissors'} size={11} stroke="var(--forest)" strokeWidth={2.5} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-3 flex flex-wrap gap-4 items-center text-xs" style={{ borderTop: '1px solid var(--line-soft)', color: 'var(--ink-soft)' }}>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ background: 'var(--brass-soft)' }} />Bugün</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ background: 'var(--bone-warm)' }} />Hafta sonu</div>
            {odaTipleri.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ background: t.renk }} />{t.ad}
              </div>
            ))}
          </div>
        </div>
      </div>

      {editMode && (
        <div
          className="fixed z-50"
          style={{
            left: panelPos.x,
            top: panelPos.y,
            width: 280,
            background: 'var(--bone-light)',
            border: `1px solid ${rezDrag ? 'var(--brass)' : 'var(--forest)'}`,
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,.2)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 96px)',
          }}
          onDragOver={(e) => { if (rezDrag) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
          onDrop={(e) => { e.preventDefault(); if (rezDrag) { handleHavuzaAl(rezDrag.rez); } }}
        >
          <div
            onMouseDown={handlePanelMouseDown}
            style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'grab', userSelect: 'none' }}>
            <Icon name="package" size={16} stroke="var(--brass)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>Çalışma Havuzu (Rezervasyonlar)</span>
            {havuz.length > 0 && (
              <span style={{ fontSize: 11, background: 'var(--brass)', color: 'white', borderRadius: 10, padding: '1px 7px', marginLeft: 'auto', flexShrink: 0 }}>{havuz.length}</span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: havuz.length === 0 ? 0 : 8, minHeight: 140 }}>
            {havuz.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center', padding: '16px' }}>
                Bir barı sürükleyip buraya bırakın
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {havuz.map((item) => {
                  const m = misafirler.find((x) => x.id === item.rez.anaMisafirId);
                  const adSoyad = m ? `${m.ad} ${m.soyad}` : item.rez.rezervasyonKodu;
                  const geceSayisi = Math.round(
                    (new Date(item.rez.cikisTarihi) - new Date(item.rez.girisTarihi)) / 86400000
                  );
                  const eskiOda = odalar.find((o) => o.id === item.origOdaId);
                  const eskiTip = odaTipleri.find((t) => t.id === item.rez.odaTipiId);
                  return (
                    <div
                      key={item.rez.id}
                      draggable
                      onDragStart={(e) => {
                        setHavuzDrag({ rez: item.rez, origOdaId: item.origOdaId });
                        e.dataTransfer.effectAllowed = 'move';
                        try { e.dataTransfer.setData('text/plain', item.rez.id); } catch {}
                      }}
                      onDragEnd={() => setHavuzDrag(null)}
                      style={{
                        background: '#fef9c3',
                        border: '1px solid #fde68a',
                        borderRadius: 8,
                        padding: '10px 12px',
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adSoyad}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 1 }}>
                          {geceSayisi} gece · giriş: {item.rez.girisTarihi}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                          {eskiTip?.ad || '-'} — Oda {eskiOda?.odaNumarasi || '?'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHavuz((prev) => prev.filter((h) => h.rez.id !== item.rez.id))}
                        title="Havuzdan çıkar"
                        style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <Icon name="rotate-ccw" size={14} stroke="var(--ink-soft)" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: 52, left: 8, opacity: 0.25, pointerEvents: 'none' }}>
            <Icon name="move" size={14} stroke="var(--forest)" />
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button type="button" onClick={handleHavuzIptal} title="Tümünü temizle"
                style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <Icon name="rotate-ccw" size={16} stroke="var(--ink-soft)" />
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handleHavuzKaydet}
                  className="htl-btn htl-btn-accent"
                  style={{ background: 'var(--success)', borderColor: 'var(--success)', padding: '7px 14px', fontSize: 13 }}>
                  <Icon name="save" size={14} stroke="white" />
                  <span>Kaydet</span>
                </button>
                <button type="button" onClick={handleHavuzIptal}
                  className="htl-btn htl-btn-ghost"
                  style={{ padding: '7px 14px', fontSize: 13 }}>
                  <span>İptal</span>
                </button>
              </div>
            </div>
        </div>
      )}
      <ReservationFormModal
        open={!!tekRez || !!editingRez}
        onClose={() => { setTekRez(null); setEditingRez(null); }}
        rezervasyon={editingRez}
        prefill={tekRez?.prefill}
        odalar={odalar}
        odaTipleri={odaTipleri}
        misafirler={misafirler}
        hesaplar={hesaplar}
        hesapHareketleri={hesapHareketleri}
        tahsilatlar={tahsilatlar}
        reservations={reservationsAll}
        kanallar={kanallar}
        ana={ana}
        userId={user?.id}
      />

      <RezervasyonTipiSecimModal
        open={!!tipiSecim}
        onClose={() => setTipiSecim(null)}
        prefill={tipiSecim?.prefill}
        onTekSec={(p) => setTekRez({ prefill: p })}
        onGrupSec={(p) => setGrupRez({ prefill: p })}
      />

      <GrupRezervasyonModal
        open={!!grupRez}
        onClose={() => setGrupRez(null)}
        onSaved={() => setGrupRez(null)}
        prefill={grupRez?.prefill}
        gruplarMevcut={gruplar}
        odalar={odalar}
        odaTipleri={odaTipleri}
        misafirler={misafirler}
        kanallar={kanallar}
        reservations={reservationsAll}
        ana={ana}
        userId={user?.id}
      />

      <GrupDetayModal
        open={!!grupDetay}
        onClose={() => setGrupDetay(null)}
        grupId={grupDetay}
        gruplar={gruplar}
        reservations={reservationsAll}
        odalar={odalar}
        odaTipleri={odaTipleri}
        misafirler={misafirler}
        tahsilatlar={tahsilatlar}
        kanallar={kanallar}
        ana={ana}
        userId={user?.id}
      />

      <ConfirmModal
        open={!!moveConfirm}
        title="Oda Değişikliği Onayı"
        msg={moveConfirm
          ? (() => {
              const m = misafirler.find((x) => x.id === moveConfirm.rez.anaMisafirId);
              const ad = m ? `${m.ad} ${m.soyad}` : moveConfirm.rez.rezervasyonKodu;
              const segs = getOdaSegmentleri(moveConfirm.rez);
              const seg = segs[moveConfirm.segIdx] || segs[0];
              const isMulti = segs.length > 1;
              return `"${ad}"${isMulti ? ` ${moveConfirm.segIdx + 1}/${segs.length}. segmenti` : ''} Oda ${moveConfirm.eskiOda?.odaNumarasi || '?'} → Oda ${moveConfirm.yeniOda.odaNumarasi}'a taşınacak (${fmtDateTR(seg.girisTarihi)} → ${fmtDateTR(seg.cikisTarihi)}). Onaylıyor musun?`;
            })()
          : ''}
        onConfirm={handleMoveConfirm}
        onCancel={() => setMoveConfirm(null)}
        confirmLabel="Onayla"
        danger={false}
      />

      <SplitModal
        open={!!splitTarget}
        onClose={() => setSplitTarget(null)}
        target={splitTarget}
        odalar={odalar}
        odaTipleri={odaTipleri}
        reservations={reservationsAll}
      />

      {drag && (() => {
        const lo = Math.min(drag.startIdx, drag.currentIdx);
        const hi = Math.max(drag.startIdx, drag.currentIdx);
        const geceler = (hi - lo) + 1;
        const giris = dateList[lo];
        const cikis = addDays(dateList[hi], 1);
        const oda = odalar.find((o) => o.id === drag.odaId);
        return (
          <div style={{
            position: 'fixed',
            left: mouse.x + 16, top: mouse.y - 12,
            zIndex: 99,
            background: 'var(--forest)',
            color: 'var(--bone-light)',
            padding: '8px 14px',
            borderRadius: 8,
            pointerEvents: 'none',
            fontSize: 13,
            boxShadow: '0 6px 20px rgba(0,0,0,.25)',
            whiteSpace: 'nowrap',
            border: '1px solid var(--brass)',
          }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 500, color: 'var(--brass-light)' }}>
              {geceler} gece
            </div>
            <div style={{ fontSize: 11, opacity: .85, marginTop: 2 }}>
              {fmtDateShort(giris)} → {fmtDateShort(cikis)}
            </div>
            {oda && (
              <div style={{ fontSize: 10, opacity: .7, marginTop: 1 }}>
                Oda {oda.odaNumarasi}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default CalendarPage;
