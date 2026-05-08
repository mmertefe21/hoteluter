/**
 * GrupDetayModal — grup detay görünümü.
 *
 * - Grup başlığı (ad, renk, iletişim, notlar)
 * - Odalar listesi: rez bilgisi, oda kalan bakiyesi, "Gruptan Çıkar"
 * - "+ Oda Ekle" → GrupRezervasyonModal mevcutGrupId modunda açar
 * - Grup havuz tahsilatları (grupId === bu grup)
 * - Toplam bakiye: Σ(odalar.toplamTutar) - Σ(oda tahsilatları) - Σ(grup havuz tahsilatları)
 *
 * Props:
 *   open, onClose
 *   grupId
 *   gruplar, reservations, odalar, odaTipleri, misafirler, tahsilatlar, hesaplar, kanallar
 *   ana, userId, can
 */
import { useState } from 'react';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { db } from '../lib/db.js';
import { fmtMoney, fmtDateTR } from '../lib/helpers.js';
import GrupRezervasyonModal from './GrupRezervasyonModal.jsx';

const GrupDetayModal = ({
  open,
  onClose,
  grupId,
  gruplar = [],
  reservations = [],
  odalar = [],
  odaTipleri = [],
  misafirler = [],
  tahsilatlar = [],
  kanallar = [],
  ana = 'EUR',
  userId = null,
}) => {
  const { show } = useToast();
  const [odaEkleAcik, setOdaEkleAcik] = useState(false);
  const [confirmCikar, setConfirmCikar] = useState(null);
  const [confirmGrupSil, setConfirmGrupSil] = useState(false);

  const grup = gruplar.find((g) => g.id === grupId);
  if (!grup) return null;

  const grupRezler = reservations.filter((r) => r.grupId === grupId);
  const grupHavuzTah = tahsilatlar.filter((t) => t.grupId === grupId);

  const odaTahsilatToplam = (rezId) =>
    tahsilatlar
      .filter((t) => t.rezervasyonId === rezId)
      .reduce((s, t) => s + Number(t.tutarAna != null ? t.tutarAna : t.tutar || 0), 0);

  const grupHavuzToplam = grupHavuzTah.reduce(
    (s, t) => s + Number(t.tutarAna != null ? t.tutarAna : t.tutar || 0),
    0
  );

  const odalarToplamTutar = grupRezler.reduce((s, r) => s + Number(r.toplamTutar || 0), 0);
  const odalarTahsilatToplam = grupRezler.reduce((s, r) => s + odaTahsilatToplam(r.id), 0);
  const grupBakiye = odalarToplamTutar - odalarTahsilatToplam - grupHavuzToplam;

  const handleCikar = async (rez) => {
    setConfirmCikar(null);
    try {
      await db.update('rezervasyonlar', rez.id, { grupId: null });
      show(`"${rez.rezervasyonKodu}" gruptan çıkarıldı.`);
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    }
  };

  const handleGrupSil = async () => {
    setConfirmGrupSil(false);
    try {
      // Önce tüm rezervasyonların grupId'sini null yap (rez'ler korunur)
      const batch = db.batch();
      grupRezler.forEach((r) => batch.update('rezervasyonlar', r.id, { grupId: null }));
      batch.delete('gruplar', grupId);
      await batch.commit();
      show('Grup silindi (rezervasyonlar gruptan ayrıldı).');
      onClose?.();
    } catch (e) {
      show('Hata: ' + e.message, 'error');
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={`Grup: ${grup.ad}`}
        footer={
          <>
            <button type="button" className="htl-btn htl-btn-ghost" onClick={() => setConfirmGrupSil(true)}
              style={{ color: 'var(--danger)' }}>
              <Icon name="trash-2" size={14} stroke="var(--danger)" /><span>Grubu Sil</span>
            </button>
            <div className="flex-1" />
            <button type="button" className="htl-btn htl-btn-ghost" onClick={onClose}>Kapat</button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Grup başlığı */}
          <div className="rounded-lg p-4 flex items-start justify-between flex-wrap gap-3"
            style={{ background: grup.renk + '15', border: `1px solid ${grup.renk}40` }}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: grup.renk }}>
                <Icon name="users" size={22} stroke="white" />
              </div>
              <div>
                <div className="font-display text-xl font-medium" style={{ color: 'var(--forest)' }}>
                  {grup.ad}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {grupRezler.length} oda · {grup.iletisimKisi || ''}
                  {grup.telefon ? ` · ${grup.telefon}` : ''}
                  {grup.email ? ` · ${grup.email}` : ''}
                </div>
                {grup.notlar && (
                  <div className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>{grup.notlar}</div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Grup Bakiyesi</div>
              <div className="font-display text-2xl font-medium"
                style={{ color: grupBakiye > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {fmtMoney(grupBakiye, ana)}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                {grupBakiye > 0 ? 'kalan' : 'tahsil edildi'}
              </div>
            </div>
          </div>

          {/* Özet sayılar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg p-3" style={{ background: 'var(--bone-warm)' }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>Toplam Tutar</div>
              <div className="font-display text-lg font-medium mt-1">{fmtMoney(odalarToplamTutar, ana)}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--success-soft)' }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--success)' }}>Oda Tahsilatları</div>
              <div className="font-display text-lg font-medium mt-1" style={{ color: 'var(--success)' }}>
                {fmtMoney(odalarTahsilatToplam, ana)}
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--brass-soft)' }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--brass)' }}>Grup Havuzu</div>
              <div className="font-display text-lg font-medium mt-1" style={{ color: 'var(--brass)' }}>
                {fmtMoney(grupHavuzToplam, ana)}
              </div>
            </div>
          </div>

          {/* Odalar listesi */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-display text-base font-medium" style={{ color: 'var(--forest)' }}>
                Odalar ({grupRezler.length})
              </h4>
              <button type="button" className="htl-btn htl-btn-ghost" onClick={() => setOdaEkleAcik(true)}>
                <Icon name="plus" size={14} /><span>Oda Ekle</span>
              </button>
            </div>
            {grupRezler.length === 0 ? (
              <div className="htl-empty">Bu grupta hiç oda yok.</div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--line-soft)' }}>
                <table className="htl-table">
                  <thead>
                    <tr>
                      <th>Oda</th><th>Misafir</th><th>Tarihler</th><th className="text-right">Tutar</th>
                      <th className="text-right">Ödenen</th><th className="text-right">Kalan</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupRezler.map((r) => {
                      const oda = odalar.find((o) => o.id === r.odaId);
                      const m = misafirler.find((x) => x.id === r.anaMisafirId);
                      const odenen = odaTahsilatToplam(r.id);
                      const kalan = Number(r.toplamTutar || 0) - odenen;
                      return (
                        <tr key={r.id}>
                          <td className="text-sm">
                            <div className="font-medium">Oda {oda?.odaNumarasi || '-'}</div>
                            <div className="text-[11px] font-mono" style={{ color: 'var(--ink-faint)' }}>
                              {r.rezervasyonKodu}
                            </div>
                          </td>
                          <td className="text-sm">{m ? `${m.ad} ${m.soyad}` : '—'}</td>
                          <td className="text-sm">{fmtDateTR(r.girisTarihi)} → {fmtDateTR(r.cikisTarihi)}</td>
                          <td className="text-right text-sm">{fmtMoney(r.toplamTutar || 0, ana)}</td>
                          <td className="text-right text-sm" style={{ color: 'var(--success)' }}>
                            {fmtMoney(odenen, ana)}
                          </td>
                          <td className="text-right text-sm font-medium"
                            style={{ color: kalan > 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {fmtMoney(kalan, ana)}
                          </td>
                          <td>
                            <button type="button"
                              className="p-1.5 rounded hover:bg-[var(--bone-warm)]"
                              onClick={() => setConfirmCikar(r)}
                              title="Gruptan çıkar (rez korunur)">
                              <Icon name="user-minus" size={14} stroke="var(--ink-soft)" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Grup havuzu tahsilatları */}
          {grupHavuzTah.length > 0 && (
            <div>
              <h4 className="font-display text-base font-medium mb-2" style={{ color: 'var(--forest)' }}>
                Grup Havuzu Tahsilatları ({grupHavuzTah.length})
              </h4>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--line-soft)' }}>
                <table className="htl-table">
                  <thead>
                    <tr><th>Tarih</th><th>Açıklama</th><th className="text-right">Tutar</th></tr>
                  </thead>
                  <tbody>
                    {[...grupHavuzTah]
                      .sort((a, b) => `${b.tarih}`.localeCompare(`${a.tarih}`))
                      .map((t) => (
                        <tr key={t.id}>
                          <td className="text-sm">{fmtDateTR(t.tarih)}</td>
                          <td className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t.aciklama || 'Tahsilat'}</td>
                          <td className="text-right font-medium" style={{ color: 'var(--success)' }}>
                            {fmtMoney(t.tutarAna != null ? t.tutarAna : t.tutar, ana)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <GrupRezervasyonModal
        open={odaEkleAcik}
        onClose={() => setOdaEkleAcik(false)}
        onSaved={() => setOdaEkleAcik(false)}
        prefill={null}
        mevcutGrupId={grupId}
        gruplarMevcut={gruplar}
        odalar={odalar}
        odaTipleri={odaTipleri}
        misafirler={misafirler}
        kanallar={kanallar}
        reservations={reservations}
        ana={ana}
        userId={userId}
      />

      <ConfirmModal
        open={!!confirmCikar}
        title="Gruptan Çıkar"
        msg={confirmCikar
          ? `"${confirmCikar.rezervasyonKodu}" rezervasyonu gruptan çıkarılacak. Rezervasyon ve tahsilatları korunur, sadece grup bağlantısı kesilir.`
          : ''}
        onConfirm={() => handleCikar(confirmCikar)}
        onCancel={() => setConfirmCikar(null)}
        confirmLabel="Gruptan Çıkar"
      />

      <ConfirmModal
        open={confirmGrupSil}
        title="Grubu Sil"
        msg={`"${grup.ad}" grubu silinecek. Gruba bağlı ${grupRezler.length} rezervasyon korunur (sadece grup bağlantısı kesilir). Grup havuzundaki ${grupHavuzTah.length} tahsilat ise bekleyen kayıtlar olarak kalır — manuel kontrol et.`}
        onConfirm={handleGrupSil}
        onCancel={() => setConfirmGrupSil(false)}
        confirmLabel="Evet, sil"
        danger
      />
    </>
  );
};

export default GrupDetayModal;
