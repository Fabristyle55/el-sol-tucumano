import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const Pill = ({ e }) => <span className={`pill ${e[1]}`}>{e[0]}</span>;

export function Modal({ titulo, onClose, children, ancho }) {
  useEffect(() => {
    const k = (ev) => ev.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  // Se dibuja directo en <body> para que cubra toda la pantalla aunque la página tenga animaciones.
  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} style={ancho ? { width: `min(${ancho}px,100%)` } : undefined}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Stepper({ id, value, onChange, label, paso = 1, max }) {
  const dec = paso < 1;
  const norm = (n) => { let x = Math.max(0, dec ? Math.round(n * 1000) / 1000 : Math.floor(n)); if (max !== undefined) x = Math.min(x, max); return x; };
  return (
    <span className="step">
      <button type="button" onClick={() => onChange(norm((value || 0) - paso))} aria-label="Quitar">−</button>
      <input id={id} className="num" type="number" min="0" step={paso} value={value || 0} aria-label={label}
        onChange={(e) => onChange(norm(+e.target.value || 0))} />
      <button type="button" disabled={max !== undefined && (value || 0) >= max} onClick={() => onChange(norm((value || 0) + paso))} aria-label="Agregar">+</button>
    </span>
  );
}

/** Botón que llama al backend, se deshabilita mientras espera y muestra el error. */
export function useAccion() {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const correr = useCallback(async (fn, okMsg) => {
    setOcupado(true);
    try {
      const r = await fn();
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
      return r;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    } finally {
      setOcupado(false);
    }
  }, [toast]);
  return [ocupado, correr];
}

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef();
  const show = useCallback((msg, tipo = 'ok') => {
    setT({ msg, tipo, k: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), tipo === 'error' ? 6000 : 3800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div key={t.k} className={`toast ${t.tipo === 'error' ? 'err' : ''}`} role="status">{t.msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export const Vacio = ({ children }) => <div className="empty">{children}</div>;
export const Cargando = () => <div className="empty">Cargando<span className="loading-dots"><i /><i /><i /></span></div>;

/** Sol del logo, como imagen. */
export const Sol = ({ size = 42, className = '' }) => <img src="/marca/sol-192.png" width={size} height={size} alt="" className={className} />;

/** Botón para alternar tema claro / oscuro (se recuerda en este navegador). */
export function TemaToggle() {
  const actual = () => document.documentElement.getAttribute('data-theme')
    || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [tema, setTema] = useState(actual);
  const cambiar = () => {
    const nuevo = tema === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    try { localStorage.setItem('tema', nuevo); } catch { /* sin almacenamiento */ }
    setTema(nuevo);
  };
  return (
    <button type="button" className="icon-btn" onClick={cambiar} aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'} title={tema === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
      {tema === 'dark'
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
    </button>
  );
}

/** Número que sube animado hasta su valor (para los indicadores). */
export function useContador(valor, ms = 900) {
  const [v, setV] = useState(0);
  const desde = useRef(0);
  useEffect(() => {
    const ini = desde.current;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(valor); desde.current = valor; return undefined; }
    let raf; const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(ini + (valor - ini) * e));
      if (p < 1) raf = requestAnimationFrame(paso); else desde.current = valor;
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor, ms]);
  return v;
}

export function Contador({ valor, formato = (n) => n }) {
  return <>{formato(useContador(valor))}</>;
}
