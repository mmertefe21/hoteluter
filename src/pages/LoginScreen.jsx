/**
 * LoginScreen — Firebase Auth ile email/şifre girişi.
 *
 * useAuth().login(email, sifre) → success/error döner.
 * Hata mesajları auth.js içinde Türkçeye çevrilmiş halde gelir.
 */
import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../lib/auth.jsx';

const LoginScreen = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const r = await login(email, sifre);
      if (!r.success) setErr(r.error || 'Giriş başarısız.');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-1/2 htl-login-bg relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between p-12 w-full" style={{ color: 'var(--bone-light)' }}>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--brass)' }}>
                <Icon name="hotel" size={22} stroke="white" />
              </div>
              <div className="font-display text-2xl font-medium tracking-tight">Hoteluter</div>
            </div>
          </div>

          <div>
            <div className="font-display italic text-5xl leading-tight mb-6" style={{ color: 'var(--bone-light)' }}>
              Otelinizin<br />
              <span style={{ color: 'var(--brass-light)' }}>her detayı</span><br />
              tek panelde.
            </div>
            <p className="text-sm max-w-md" style={{ color: 'rgba(244,237,224,.7)' }}>
              Rezervasyon, misafir, oda durumu ve ön muhasebe — modern bir otel yönetim deneyimi.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(244,237,224,.5)' }}>
            <span>v1.0 · Görev 7</span><span>·</span><span>Hoteluter © 2026</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-12" style={{ background: 'var(--bone)' }}>
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="md:hidden mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--forest)' }}>
              <Icon name="hotel" size={22} stroke="var(--brass-light)" />
            </div>
            <div className="font-display text-2xl font-medium" style={{ color: 'var(--forest)' }}>Hoteluter</div>
          </div>

          <h1 className="font-display text-3xl font-medium mb-2" style={{ color: 'var(--forest)' }}>Hoş geldiniz</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--ink-soft)' }}>Otel panelinize giriş yapın.</p>

          <div className="mb-4">
            <label className="htl-label">E-posta</label>
            <input className="htl-input" type="email" autoComplete="username" autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@hoteluter.com" />
          </div>
          <div className="mb-4">
            <label className="htl-label">Şifre</label>
            <input className="htl-input" type="password" autoComplete="current-password"
              value={sifre} onChange={(e) => setSifre(e.target.value)} placeholder="••••••••" />
          </div>

          {err && (
            <div className="mb-4 px-3 py-2 rounded-md text-sm flex items-center gap-2"
              style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              <Icon name="alert-circle" size={16} />
              {err}
            </div>
          )}

          <button type="submit" disabled={loading || !email || !sifre}
            className="htl-btn htl-btn-primary w-full justify-center mb-2" style={{ padding: '12px 18px' }}>
            {loading ? <Icon name="loader-2" size={18} className="animate-spin" /> : <Icon name="log-in" size={18} />}
            <span>Giriş Yap</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
