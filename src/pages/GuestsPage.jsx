/**
 * GuestsPage — misafir CRUD (ListPageShell + MisafirFormModal).
 */
import { useState } from 'react';
import ListPageShell from '../components/ListPageShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import MisafirFormModal from '../modals/MisafirFormModal.jsx';
import { db, useCollection } from '../lib/db.js';
import { useAuth } from '../lib/auth-mock.jsx';

const GuestsPage = () => {
  const { can } = useAuth();
  const { show } = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const list = useCollection('misafirler');
  const filtered = list.filter((m) => {
    if (!search) return true;
    const hay = `${m.ad} ${m.soyad} ${m.telefon || ''} ${m.email || ''} ${m.tcKimlik || ''} ${m.pasaportNo || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  }).sort((a, b) => `${a.ad}${a.soyad}`.localeCompare(`${b.ad}${b.soyad}`));

  const handleDelete = async () => {
    try {
      await db.delete('misafirler', confirmDel.id);
      show('Misafir silindi.');
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    } finally {
      setConfirmDel(null);
    }
  };

  return (
    <>
      <ListPageShell
        title="Misafirler"
        icon="users"
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Ad, soyad, telefon, e-posta, kimlik..."
        onAdd={() => setCreating(true)}
        addLabel="Yeni Misafir"
        canAdd={can('misafirler', 'ekle')}
      >
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="htl-empty">{search ? 'Eşleşen misafir yok.' : 'Henüz misafir yok.'}</div>
          ) : (
            <table className="htl-table">
              <thead><tr><th>Ad Soyad</th><th>Kimlik / Pasaport</th><th>Uyruk</th><th>Telefon</th><th>E-posta</th><th>Şehir</th><th></th></tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.ad} {m.soyad}</td>
                    <td>{m.tcKimlik || m.pasaportNo || '-'}</td>
                    <td>{m.uyruk || '-'}</td>
                    <td>{m.telefon || '-'}</td>
                    <td>{m.email || '-'}</td>
                    <td>{m.sehir || '-'}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {can('misafirler', 'duzenle') && (
                          <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setEditing(m)}>
                            <Icon name="pencil" size={14} stroke="var(--ink-soft)" />
                          </button>
                        )}
                        {can('misafirler', 'sil') && (
                          <button type="button" className="p-1.5 rounded hover:bg-[var(--bone-warm)]" onClick={() => setConfirmDel(m)}>
                            <Icon name="trash-2" size={14} stroke="var(--danger)" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ListPageShell>

      <MisafirFormModal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        target={editing}
      />

      <ConfirmModal
        open={!!confirmDel}
        title="Misafir Sil"
        msg={`"${confirmDel?.ad} ${confirmDel?.soyad}" misafirini silmek istediğine emin misin?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </>
  );
};

export default GuestsPage;
