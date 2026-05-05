/**
 * CalendarPage — Gantt takvim (gece-bazlı bar render).
 *
 * Özellikler:
 *   - 7 / 15 / 30 gün view
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
import SplitModal from '../modals/SplitModal.jsx';
import { db, useCollection, useDoc } from '../lib/db.js';
import { addDays, todayISO, fmtDateTR, fmtDateShort, isWeekend } from '../lib/helpers.js';
import { getOdaSegmentleri, checkOverlap } from '../helpers/segmentler.js';
import { useAuth } from '../lib/auth-mock.jsx';

const CalendarPage = () => {
  const { can, user } = useAuth();
  const { show } = useToast();

  const [startDate, setStartDate] = useState(addDays(todayISO(), -2));
  const [days, setDays] = useState(15);
  const [filterTipId, setFilterTipId] = useState('');
  const [editingRez, setEditingRez] = useState(null);
  const [creating, setCreating] = useState(false);
  const [prefillData, setPrefillData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [rezDrag, setRezDrag] = useState(null);
  const [moveConfirm, setMoveConfirm] = useState(null);
  const [splitTarget, setSplitTarget] = useState(null);

  const otel = useDoc('otel', 'main');
  const ana = otel?.anaParaBirimi || 'EUR';
  const odaTipleri = useCollection('odaTipleri');
  const odalarRaw = useCollection('odalar');
  const odalar = [...odalarRaw].sort((a, b) => `${a.odaNumarasi}`.localeCompare(`${b.odaNumarasi}`));
  const filteredOdalar = filterTipId ? odalar.filter((o) => o.odaTipiId === filterTipId) : odalar;
  const reservationsAll = useCollection('rezervasyonlar');
  const reservations = reservationsAll.filter((r) => r.durum !== 'iptal' && r.durum !== 'no-show');
  const misafirler = useCollection('misafirler');
  const hesaplar = useCollection('hesaplar');
  const hesapHareketleri = useCollection('hesapHareketleri');
  const tahsilatlar = useCollection('tahsilatlar');
  const kanallar = useCollection('kanallar');

  const dateList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(startDate, i)),
    [startDate, days]
  );
  const cellWidth = days >= 30 ? 44 : days >= 15 ? 60 : 80;
  const today = todayISO();

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

  const getResStyle = (res, seg) => {
    const tipId = (seg && seg.odaTipiId) || res.odaTipiId;
    const tip = odaTipleri.find((t) => t.id === tipId);
    return { background: tip?.renk || 'var(--brass)' };
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
    if (checkOverlap(odaId, cellDate, cellDateNext, null, reservations)) return;
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
      if (!checkOverlap(drag.odaId, giris, cikis, null, reservations)) {
        setPrefillData({ odaId: drag.odaId, girisTarihi: giris, cikisTarihi: cikis });
        setCreating(true);
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
              {[7, 15, 30].map((d) => (
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
          <div className="flex gap-2 flex-wrap">
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
              <button type="button" className="htl-btn htl-btn-accent" onClick={() => { setPrefillData(null); setCreating(true); }}>
                <Icon name="plus" size={16} stroke="white" /><span>Yeni Rezervasyon</span>
              </button>
            )}
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
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 180 + dateList.length * cellWidth, position: 'relative' }}>
              <div className="htl-cal-grid" style={{ gridTemplateColumns: `180px repeat(${dateList.length}, ${cellWidth}px)`, borderRadius: '10px 10px 0 0' }}>
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
                  {filteredOdalar.map((oda) => {
                    const tip = odaTipleri.find((t) => t.id === oda.odaTipiId);
                    const resler = getResForRoom(oda.id);
                    const isDropTarget = editMode && rezDrag && rezDrag.startOdaId !== oda.id;
                    const isHovered = isDropTarget && rezDrag.hoverOdaId === oda.id;
                    let dropBlocked = false;
                    if (isHovered && rezDrag.draggedSeg) {
                      dropBlocked = checkOverlap(oda.id, rezDrag.draggedSeg.girisTarihi, rezDrag.draggedSeg.cikisTarihi, rezDrag.rez.id, reservations);
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
                            if (rezDrag.hoverOdaId !== oda.id) {
                              setRezDrag({ ...rezDrag, hoverOdaId: oda.id });
                            }
                          }}
                          onDrop={(e) => {
                            if (!isDropTarget || !rezDrag.draggedSeg) return;
                            e.preventDefault();
                            const overlap = checkOverlap(oda.id, rezDrag.draggedSeg.girisTarihi, rezDrag.draggedSeg.cikisTarihi, rezDrag.rez.id, reservations);
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
                            {dateList.map((d, di) => {
                              const inDrag = isCellInDrag(oda.id, di);
                              return (
                                <div
                                  key={d}
                                  className={`htl-cal-cell ${d === today ? 'today' : ''} ${isWeekend(d) ? 'weekend' : ''}`}
                                  style={{
                                    cursor: editMode ? 'default' : (can('rezervasyon', 'ekle') ? 'cell' : 'default'),
                                    background: inDrag ? 'var(--brass-light)' : undefined,
                                    transition: 'background 0.05s',
                                  }}
                                  onMouseDown={editMode ? undefined : ((e) => handleCellMouseDown(oda.id, di, e))}
                                  onMouseEnter={editMode ? undefined : (() => handleCellMouseEnter(oda.id, di))}
                                />
                              );
                            })}
                          </div>
                          {resler.map(({ rez: res, seg }) => {
                            const pos = computeBar(seg.girisTarihi, seg.cikisTarihi);
                            if (!pos) return null;
                            const m = misafirler.find((x) => x.id === res.anaMisafirId);
                            const isBeingDragged = rezDrag && rezDrag.rez.id === res.id && rezDrag.segIdx === seg._segIdx;
                            const isMulti = seg._isMulti;
                            const segLabel = isMulti ? `${seg._segIdx + 1}/${res.segmentler.length}` : '';
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
                                  ...pos, ...getResStyle(res, seg),
                                  cursor: editMode ? 'grab' : 'pointer',
                                  opacity: isBeingDragged ? 0.4 : 1,
                                  outline: editMode ? '1px dashed rgba(255,255,255,.6)' : 'none',
                                  outlineOffset: -3,
                                }}
                                onClick={() => { if (!editMode) setEditingRez(res); }}
                                title={`${isMulti ? `[${segLabel}] ` : ''}${m ? `${m.ad} ${m.soyad}` : ''} · ${fmtDateTR(seg.girisTarihi)} → ${fmtDateTR(seg.cikisTarihi)}`}
                              >
                                <Icon name={isMulti ? 'link' : (editMode ? 'move' : 'user')} size={12} stroke="white" strokeWidth={2.5} />
                                <span className="ml-1 truncate">{m ? `${m.ad} ${m.soyad}` : res.rezervasyonKodu}{isMulti ? ` · ${segLabel}` : ''}</span>

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

      <ReservationFormModal
        open={creating || !!editingRez}
        onClose={() => { setCreating(false); setEditingRez(null); setPrefillData(null); }}
        rezervasyon={editingRez}
        prefill={prefillData}
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
