/**
 * SettingsPage — 6 sekme.
 *
 * Sekmeler:
 *   - Otel Bilgileri (otel/main singleton)
 *   - Para Birimi & Kur (anaParaBirimi, manuel kur override)
 *   - Kanallar (kanal CRUD)
 *   - Gider Kategorileri (kategori CRUD)
 *   - Yedekleme (export JSON)
 *   - Kullanıcılar (sadece superadmin — UsersPage embedded)
 */
import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useToast } from '../components/Toast.jsx';
import UsersPage from './UsersPage.jsx';
import { db, useCollection, useDoc } from '../lib/db.js';
import { PARA_BIRIMI_OPTS } from '../lib/constants.js';
import {
  getActiveKurlar, fetchKurlar, getManuelKurlar, setManuelKurlar, clearManuelKurlar,
} from '../lib/kur.js';
import { useAuth } from '../lib/auth-mock.jsx';

const SettingsPage = () => {
  const { user } = useAuth();
  const { show } = useToast();
  const [tab, setTab] = useState('otel');
  const isSuper = user?.rol === 'superadmin';

  return (
    <div className="space-y-4">
      <div className="htl-card">
        <div className="htl-card-header" style={{ paddingBottom: 0, borderBottom: 'none' }}>
          <div className="flex gap-1 -mb-[1px] flex-wrap" style={{ borderBottom: '1px solid var(--line-soft)', flex: 1 }}>
            <div className={`htl-tab ${tab === 'otel' ? 'active' : ''}`} onClick={() => setTab('otel')}>Otel Bilgileri</div>
            <div className={`htl-tab ${tab === 'kur' ? 'active' : ''}`} onClick={() => setTab('kur')}>Para Birimi & Kur</div>
            <div className={`htl-tab ${tab === 'kanallar' ? 'active' : ''}`} onClick={() => setTab('kanallar')}>Kanallar</div>
            <div className={`htl-tab ${tab === 'kategoriler' ? 'active' : ''}`} onClick={() => setTab('kategoriler')}>Gider Kategorileri</div>
            <div className={`htl-tab ${tab === 'yedek' ? 'active' : ''}`} onClick={() => setTab('yedek')}>Yedekleme</div>
            {isSuper && (
              <div className={`htl-tab ${tab === 'kullanicilar' ? 'active' : ''}`} onClick={() => setTab('kullanicilar')}>Kullanıcılar</div>
            )}
          </div>
        </div>
        <div className="htl-card-body">
          {tab === 'otel' && <OtelTab />}
          {tab === 'kur' && <KurTab />}
          {tab === 'kanallar' && <KanallarTab />}
          {tab === 'kategoriler' && <KategoriTab />}
          {tab === 'yedek' && <YedekTab />}
          {tab === 'kullanicilar' && isSuper && <UsersPage embedded />}
        </div>
      </div>
    </div>
  );
};

/* ===== OTEL ===== */
const OtelTab = () => {
  const otel = useDoc('otel', 'main');
  const { show } = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(otel || {
      ad: '', adres: '', telefon: '', email: '', vergiNo: '', yildizSayisi: 3,
      anaParaBirimi: 'EUR',
    });
  }, [otel]);

  const save = async () => {
    if (!form.ad?.trim()) return show('Otel adı zorunlu.', 'error');
    setSaving(true);
    try {
      await db.setOtel(form);
      show('Otel bilgileri kaydedildi.');
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
      <div className="md:col-span-2"><label className="htl-label">Otel Adı *</label><input className="htl-input" value={form.ad || ''} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></div>
      <div><label className="htl-label">Telefon</label><input className="htl-input" value={form.telefon || ''} onChange={(e) => setForm({ ...form, telefon: e.target.value })} /></div>
      <div><label className="htl-label">E-posta</label><input type="email" className="htl-input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><label className="htl-label">Vergi No</label><input className="htl-input" value={form.vergiNo || ''} onChange={(e) => setForm({ ...form, vergiNo: e.target.value })} /></div>
      <div><label className="htl-label">Yıldız Sayısı</label><input type="number" min="1" max="5" className="htl-input" value={form.yildizSayisi || 3} onChange={(e) => setForm({ ...form, yildizSayisi: Number(e.target.value) })} /></div>
      <div className="md:col-span-2"><label className="htl-label">Adres</label><textarea rows="2" className="htl-input" value={form.adres || ''} onChange={(e) => setForm({ ...form, adres: e.target.value })} /></div>
      <div className="md:col-span-2">
        <label className="htl-label">Ana Para Birimi (raporlama PB'si)</label>
        <div className="grid grid-cols-4 gap-2">
          {PARA_BIRIMI_OPTS.map((p) => {
            const aktif = form.anaParaBirimi === p.v;
            return (
              <button key={p.v} type="button" onClick={() => setForm({ ...form, anaParaBirimi: p.v })}
                className="px-3 py-3 rounded-lg flex flex-col items-center gap-1 text-xs font-medium transition"
                style={{
                  background: aktif ? 'var(--forest)' : 'var(--bone-warm)',
                  color: aktif ? 'var(--bone-light)' : 'var(--ink)',
                  border: `1px solid ${aktif ? 'var(--forest)' : 'var(--line-soft)'}`,
                }}>
                <div className="font-display text-xl font-medium">{p.symbol}</div>
                <div className="text-[10px]">{p.l}</div>
              </button>
            );
          })}
        </div>
        <div className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>
          Tüm raporlar bu para biriminde gösterilir. Çoklu PB tahsilat/gider'de tutarAna alanı bu PB'ye çevrilir.
        </div>
      </div>
      <div className="md:col-span-2 flex justify-end">
        <button type="button" className="htl-btn htl-btn-primary" onClick={save} disabled={saving}>
          <Icon name="save" size={16} stroke="white" /><span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
        </button>
      </div>
    </div>
  );
};

/* ===== KUR ===== */
const KurTab = () => {
  const { show } = useToast();
  const [kurlar, setKurlar] = useState(getActiveKurlar());
  const [manuel, setManuel] = useState(getManuelKurlar());
  const [loading, setLoading] = useState(false);
  const [manuelForm, setManuelForm] = useState(() => {
    const m = getManuelKurlar();
    return m?.rates || { EUR: 1, USD: '', TRY: '', GBP: '' };
  });

  const refresh = async () => {
    setLoading(true);
    const k = await fetchKurlar();
    setKurlar(getActiveKurlar());
    setLoading(false);
    if (k) show('Kur güncellendi: ' + k.date);
    else show('Kur fetch başarısız.', 'error');
  };

  const saveManuel = () => {
    const rates = {
      EUR: 1,
      USD: Number(manuelForm.USD) || 0,
      TRY: Number(manuelForm.TRY) || 0,
      GBP: Number(manuelForm.GBP) || 0,
    };
    setManuelKurlar({ base: 'EUR', rates, fetchedAt: new Date().toISOString(), source: 'manuel' });
    setManuel({ base: 'EUR', rates });
    setKurlar(getActiveKurlar());
    show('Manuel kur kaydedildi.');
  };

  const removeManuel = () => {
    clearManuelKurlar();
    setManuel(null);
    setKurlar(getActiveKurlar());
    show('Manuel kur kaldırıldı, canlı kura döndü.');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-lg p-4" style={{ background: 'var(--bone-warm)', border: '1px solid var(--line-soft)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <div className="font-display text-base font-medium" style={{ color: 'var(--forest)' }}>Aktif Kur</div>
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              {kurlar
                ? `${kurlar.isManual ? 'Manuel' : 'Canlı (' + (kurlar.source || 'frankfurter') + ')'} · ${kurlar.date || kurlar.fetchedAt?.slice(0, 10) || '?'}`
                : 'Henüz kur yok'}
            </div>
          </div>
          <button type="button" className="htl-btn htl-btn-primary" onClick={refresh} disabled={loading}>
            <Icon name="refresh-cw" size={14} stroke="white" /><span>{loading ? '...' : 'Canlı Kuru Yenile'}</span>
          </button>
        </div>
        {kurlar?.rates && (
          <div className="grid grid-cols-4 gap-2 text-sm">
            {['EUR', 'USD', 'TRY', 'GBP'].map((c) => (
              <div key={c} className="rounded p-2" style={{ background: 'var(--bone-light)' }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>{c}</div>
                <div className="font-mono">{kurlar.rates[c]?.toFixed(4) ?? '-'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg p-4" style={{ background: 'var(--bone-light)', border: '1px solid var(--line-soft)' }}>
        <div className="font-display text-base font-medium mb-3" style={{ color: 'var(--forest)' }}>Manuel Kur Override (1 EUR = ?)</div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {['USD', 'TRY', 'GBP'].map((c) => (
            <div key={c}>
              <label className="htl-label">{c}</label>
              <input type="number" step="0.0001" className="htl-input" value={manuelForm[c] || ''} onChange={(e) => setManuelForm({ ...manuelForm, [c]: e.target.value })} />
            </div>
          ))}
          <div className="flex items-end">
            <button type="button" className="htl-btn htl-btn-primary w-full justify-center" onClick={saveManuel}>
              <Icon name="save" size={14} stroke="white" /><span>Kaydet</span>
            </button>
          </div>
        </div>
        {manuel && (
          <button type="button" className="htl-btn htl-btn-ghost text-xs" onClick={removeManuel}>
            <Icon name="x" size={12} /><span>Manuel kuru kaldır, canlı kura dön</span>
          </button>
        )}
        <div className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>
          Manuel kur localStorage'da tutulur. Canlı kur (Frankfurter / ECB) bağlanamadığında kullanılır veya özel bir kur sabitlemek için.
        </div>
      </div>
    </div>
  );
};

/* ===== KANALLAR ===== */
const KanallarTab = () => {
  const { show } = useToast();
  const list = useCollection('kanallar');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ kod: '', ad: '', aktif: true });
  const [confirmDel, setConfirmDel] = useState(null);

  const save = async () => {
    if (!form.kod?.trim() || !form.ad?.trim()) return show('Kod ve ad zorunlu.', 'error');
    try {
      if (editing) {
        await db.update('kanallar', editing.id, form);
        show('Kanal güncellendi.');
      } else {
        await db.add('kanallar', { ...form, aktif: true });
        show('Kanal eklendi.');
      }
      setEditing(null);
      setForm({ kod: '', ad: '', aktif: true });
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    }
  };

  const startEdit = (k) => { setEditing(k); setForm({ kod: k.kod, ad: k.ad, aktif: k.aktif !== false }); };
  const cancelEdit = () => { setEditing(null); setForm({ kod: '', ad: '', aktif: true }); };

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-3" style={{ background: 'var(--bone-warm)' }}>
        <div className="grid md:grid-cols-3 gap-2 items-end">
          <div>
            <label className="htl-label">Kod *</label>
            <input className="htl-input" placeholder="booking" value={form.kod} onChange={(e) => setForm({ ...form, kod: e.target.value })} />
          </div>
          <div>
            <label className="htl-label">Ad *</label>
            <input className="htl-input" placeholder="Booking.com" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="htl-btn htl-btn-primary flex-1 justify-center" onClick={save}>
              <Icon name="save" size={14} stroke="white" />
              <span>{editing ? 'Güncelle' : 'Ekle'}</span>
            </button>
            {editing && (
              <button type="button" className="htl-btn htl-btn-ghost" onClick={cancelEdit}>İptal</button>
            )}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="htl-empty">Henüz kanal yok. Yukarıdan ekle.</div>
      ) : (
        <table className="htl-table">
          <thead><tr><th>Kod</th><th>Ad</th><th>Aktif</th><th></th></tr></thead>
          <tbody>
            {list.map((k) => (
              <tr key={k.id}>
                <td className="font-mono text-xs">{k.kod}</td>
                <td className="font-medium">{k.ad}</td>
                <td>
                  <span className={`htl-badge ${k.aktif === false ? 'htl-badge-danger' : 'htl-badge-success'}`}>
                    {k.aktif === false ? 'Pasif' : 'Aktif'}
                  </span>
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-light)]" onClick={() => startEdit(k)}>
                      <Icon name="pencil" size={14} stroke="var(--ink-soft)" />
                    </button>
                    <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-light)]" onClick={() => setConfirmDel(k)}>
                      <Icon name="trash-2" size={14} stroke="var(--danger)" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmModal open={!!confirmDel} title="Kanal Sil"
        msg={`"${confirmDel?.ad}" kanalı silinecek.`}
        onConfirm={async () => {
          try { await db.delete('kanallar', confirmDel.id); show('Kanal silindi.'); }
          catch (e) { show('Hata: ' + e.message, 'error'); }
          setConfirmDel(null);
        }}
        onCancel={() => setConfirmDel(null)} />
    </div>
  );
};

/* ===== GİDER KATEGORİLERİ ===== */
const KategoriTab = () => {
  const { show } = useToast();
  const list = useCollection('giderKategorileri');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ad: '', icon: 'tag', renk: '#4a6b85', aktif: true });
  const [confirmDel, setConfirmDel] = useState(null);

  const save = async () => {
    if (!form.ad?.trim()) return show('Ad zorunlu.', 'error');
    try {
      if (editing) {
        await db.update('giderKategorileri', editing.id, form);
        show('Kategori güncellendi.');
      } else {
        await db.add('giderKategorileri', { ...form, aktif: true });
        show('Kategori eklendi.');
      }
      setEditing(null);
      setForm({ ad: '', icon: 'tag', renk: '#4a6b85', aktif: true });
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    }
  };

  const startEdit = (k) => { setEditing(k); setForm({ ad: k.ad, icon: k.icon, renk: k.renk, aktif: k.aktif !== false }); };
  const cancelEdit = () => { setEditing(null); setForm({ ad: '', icon: 'tag', renk: '#4a6b85', aktif: true }); };

  const RENKLER = ['#4a6b85', '#a87842', '#4a7c59', '#8e5572', '#5e6b8e', '#c87f3e', '#a64545', '#6b6b6b'];

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-3" style={{ background: 'var(--bone-warm)' }}>
        <div className="grid md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="htl-label">Ad *</label>
            <input className="htl-input" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
          </div>
          <div>
            <label className="htl-label">İkon (lucide)</label>
            <input className="htl-input" placeholder="users, home, zap..." value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </div>
          <div>
            <label className="htl-label">Renk</label>
            <div className="flex flex-wrap gap-1.5">
              {RENKLER.map((r) => (
                <button key={r} type="button" onClick={() => setForm({ ...form, renk: r })}
                  className="w-7 h-7 rounded-full"
                  style={{ background: r, border: form.renk === r ? '3px solid var(--ink)' : '2px solid transparent' }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="htl-btn htl-btn-primary flex-1 justify-center" onClick={save}>
              <Icon name="save" size={14} stroke="white" />
              <span>{editing ? 'Güncelle' : 'Ekle'}</span>
            </button>
            {editing && (
              <button type="button" className="htl-btn htl-btn-ghost" onClick={cancelEdit}>İptal</button>
            )}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="htl-empty">Henüz kategori yok.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((k) => (
            <div key={k.id} className="rounded-lg p-3 flex items-center gap-3"
              style={{ background: 'var(--bone-light)', border: `1px solid ${k.renk}40` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: k.renk }}>
                <Icon name={k.icon || 'tag'} size={18} stroke="white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{k.ad}</div>
                <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{k.icon || 'tag'}</div>
              </div>
              <div className="flex gap-1">
                <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => startEdit(k)}>
                  <Icon name="pencil" size={14} stroke="var(--ink-soft)" />
                </button>
                <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setConfirmDel(k)}>
                  <Icon name="trash-2" size={14} stroke="var(--danger)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal open={!!confirmDel} title="Kategori Sil"
        msg={`"${confirmDel?.ad}" kategorisi silinecek.`}
        onConfirm={async () => {
          try { await db.delete('giderKategorileri', confirmDel.id); show('Kategori silindi.'); }
          catch (e) { show('Hata: ' + e.message, 'error'); }
          setConfirmDel(null);
        }}
        onCancel={() => setConfirmDel(null)} />
    </div>
  );
};

/* ===== YEDEK ===== */
const YedekTab = () => {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    setBusy(true);
    try {
      const collections = [
        'otel', 'odaTipleri', 'odalar', 'misafirler', 'rezervasyonlar',
        'kanallar', 'tahsilatlar', 'giderKategorileri', 'giderler',
        'hesaplar', 'hesapHareketleri', 'users',
      ];
      const out = { exportedAt: new Date().toISOString(), data: {} };
      for (const c of collections) {
        try {
          out.data[c] = await db.list(c);
        } catch (e) {
          out.data[c] = { error: e.message };
        }
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hoteluter-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      show('Yedek dosyası indirildi.');
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-3">
      <div className="rounded-lg p-4" style={{ background: 'var(--brass-soft)', border: '1px solid var(--brass-light)' }}>
        <div className="flex items-start gap-3">
          <Icon name="download" size={20} stroke="var(--brass)" />
          <div className="flex-1">
            <div className="font-medium" style={{ color: 'var(--forest)' }}>JSON Yedek İndir</div>
            <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>
              Tüm Firestore koleksiyonlarını tek bir JSON dosyası olarak indir. Manuel arşiv veya geri yükleme için.
            </div>
          </div>
          <button type="button" className="htl-btn htl-btn-primary" onClick={exportAll} disabled={busy}>
            <Icon name="download" size={14} stroke="white" />
            <span>{busy ? 'Hazırlanıyor...' : 'İndir'}</span>
          </button>
        </div>
      </div>

      <div className="text-xs px-3 py-2 rounded" style={{ background: 'var(--bone-warm)', color: 'var(--ink-soft)' }}>
        <strong>Not:</strong> Geri yükleme (import) henüz aktif değil. Görev 10 (Firestore Security Rules) sonrası eklenecek.
      </div>
    </div>
  );
};

export default SettingsPage;
