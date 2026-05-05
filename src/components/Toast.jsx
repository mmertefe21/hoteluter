/**
 * Toast + ToastProvider
 *
 * useToast().show(msg, type='success') ile bildirim göster.
 * Tipler: success | error | info.
 * 3 sn sonra otomatik kapanır. Üst üste çağrılırsa yeni mesaj eskisini değiştirir.
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import Icon from './Icon.jsx';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
};

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((msg, type = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && <Toast {...toast} />}
    </ToastContext.Provider>
  );
};

const VARIANT_ICON = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info',
};

const VARIANT_BG = {
  info: 'var(--info)',
};

const Toast = ({ msg, type }) => {
  const cls = type === 'success' || type === 'error' ? `htl-toast ${type}` : 'htl-toast';
  const styleOverride = VARIANT_BG[type] ? { background: VARIANT_BG[type] } : undefined;
  return (
    <div className={cls} style={styleOverride} role="status" aria-live="polite">
      <Icon name={VARIANT_ICON[type] || 'check-circle'} size={18} />
      <span>{msg}</span>
    </div>
  );
};

export default Toast;
