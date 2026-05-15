/**
 * UsersPage — kullanıcı yönetimi (sadece superadmin görür).
 *
 * embedded prop → Settings içinde tab olarak gösterilirken üst kart başlığını gizle.
 */
import { useState } from 'react';
import ListPageShell from '../components/ListPageShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import KullaniciFormModal from '../modals/KullaniciFormModal.jsx';
import { db, useCollection } from '../lib/db.js';
import { ROLE_LABELS } from '../lib/permissions.js';
import { fmtDateTR } from '../lib/helpers.js';
import { useAuth } from '../lib/auth.jsx';

const fmtTimestamp = (ts) => {
  if (!ts) return '—';
  const d = ts?.toDate?.() ?? new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const UsersPage = ({ embedded = false }) => {
  const { user } = useAuth();
  const { show } = useToast();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const list = useCollection('users');

  const filtered = list.filter((u) => {
    if (!search) return true;
    const hay = `${u.kullaniciAdi || ''} ${u.adSoyad || ''} ${u.email || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  if (user?.rol !== 'superadmin') {
    return (
      <div className="htl-empty">
        <Icon name="lock" size={32} stroke="var(--ink-faint)" />
        <p className="mt-2">Bu sayfa sadece süperadmin tarafından görüntülenebilir.</p>
      </div>
    );
  }

  const Body = (
    <>
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="htl-empty">{search ? 'Eşleşen kullanıcı yok.' : 'Henüz kullanıcı yok. (Görev 9\'da Firebase Auth ile bağlanacak.)'}</div>
        ) : (
          <table className="htl-table">
            <thead><tr><th>Kullanıcı Adı</th><th>Ad Soyad</th><th>E-posta</th><th>Rol</th><th>Durum</th><th>Eklendi</th><th>Son Giriş</th><th>Son Aksiyon</th><th></th></tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono text-xs">{u.kullaniciAdi}</td>
                  <td className="font-medium">{u.adSoyad}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`htl-badge ${u.rol === 'superadmin' ? 'htl-badge-warn' : u.rol === 'admin' ? 'htl-badge-info' : 'htl-badge-neutral'}`}>
                      {ROLE_LABELS[u.rol] || u.rol}
                    </span>
                  </td>
                  <td>
                    <span className={`htl-badge ${u.aktif === false ? 'htl-badge-danger' : 'htl-badge-success'}`}>
                      {u.aktif === false ? 'Pasif' : 'Aktif'}
                    </span>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--ink-soft)' }}>{u.olusturmaTarihi ? fmtDateTR(u.olusturmaTarihi.slice(0, 10)) : '-'}</td>
                  <td className="text-sm" style={{ color: 'var(--ink-soft)' }}>{fmtTimestamp(u.sonGiris)}</td>
                  <td className="text-sm max-w-[200px] truncate" title={u.sonAksiyon || ''}>{u.sonAksiyon || '—'}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setEditing(u)}>
                        <Icon name="pencil" size={14} stroke="var(--ink-soft)" />
                      </button>
                      <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setConfirmDel(u)}>
                        <Icon name="trash-2" size={14} stroke="var(--danger)" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <KullaniciFormModal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        target={editing}
      />
      <ConfirmModal
        open={!!confirmDel}
        title="Kullanıcı Sil"
        msg={`"${confirmDel?.adSoyad || confirmDel?.kullaniciAdi}" silinecek.`}
        onConfirm={async () => {
          try { await db.delete('users', confirmDel.id); show('Kullanıcı silindi.'); }
          catch (e) { show('Hata: ' + e.message, 'error'); }
          setConfirmDel(null);
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-faint)' }}>
              <Icon name="search" size={16} />
            </span>
            <input className="htl-input" placeholder="Ad, e-posta..." style={{ paddingLeft: 36, minWidth: 240 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="htl-btn htl-btn-accent" onClick={() => setCreating(true)}>
            <Icon name="plus" size={14} stroke="white" /><span>Yeni Kullanıcı</span>
          </button>
        </div>
        {Body}
      </div>
    );
  }

  return (
    <ListPageShell
      title="Kullanıcılar"
      icon="user-cog"
      search={search}
      setSearch={setSearch}
      searchPlaceholder="Ad, e-posta..."
      onAdd={() => setCreating(true)}
      addLabel="Yeni Kullanıcı"
      canAdd={true}
    >
      {Body}
    </ListPageShell>
  );
};

export default UsersPage;
