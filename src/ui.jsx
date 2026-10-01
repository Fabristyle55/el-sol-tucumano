import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const Pill = ({ e }) => <span className={`pill ${e[1]}`}>{e[0]}</span>;

const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ titulo, onClose, children, ancho }) {
  const caja = useRef();
  const cerrar = useRef(onClose);
  cerrar.current = onClose;
  // Accesibilidad: el foco entra al diálogo, queda atrapado adentro (Tab) y vuelve al botón que lo abrió.
  useEffect(() => {
    const antes = document.activeElement;
    caja.current?.focus({ preventScroll: true });
    const k = (ev) => {
      if (ev.key === 'Escape') { cerrar.current(); return; }
      if (ev.key !== 'Tab' || !caja.current) return;
      const f = [...caja.current.querySelectorAll(FOCUSABLES)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', k);
    const scroll = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = scroll; if (antes?.focus) antes.focus({ preventScroll: true }); };
  }, []);
  // Se dibuja directo en <body> para que cubra toda la pantalla aunque la página tenga animaciones.
  return createPortal(
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={caja} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} style={ancho ? { width: `min(${ancho}px,100%)` } : undefined}>
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
      <div className="sr-only" aria-live="polite">{t && t.tipo !== 'error' ? t.msg : ''}</div>
      <div className="sr-only" aria-live="assertive">{t && t.tipo === 'error' ? t.msg : ''}</div>
      {t && (
        <div key={t.k} className={`toast ${t.tipo === 'error' ? 'err' : ''}`} aria-hidden="true">
          <span className="toast-ic">{t.tipo === 'error' ? '!' : '✓'}</span><span>{t.msg}</span>
          <i className="toast-bar" style={{ animationDuration: t.tipo === 'error' ? '6s' : '3.8s' }} />
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export const Vacio = ({ children }) => <div className="empty">{children}</div>;
/** Esqueleto de carga: bloques con brillo en lugar de un texto, como las apps modernas. */
export const Cargando = ({ filas = 4 }) => (
  <div className="skel-wrap" role="status" aria-live="polite">
    <span className="sr-only">Cargando…</span>
    <div className="skel-row">{[0, 1, 2].map((k) => <div key={k} className="skel skel-kpi" style={{ animationDelay: `${k * 0.1}s` }} />)}</div>
    {Array.from({ length: filas }, (_, k) => <div key={k} className="skel skel-line" style={{ width: `${92 - k * 9}%`, animationDelay: `${0.2 + k * 0.08}s` }} />)}
  </div>
);

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

/** Botón que abre WhatsApp con un mensaje armado. No se muestra si no hay teléfono válido. */
export function BotonWhatsApp({ href, children = 'WhatsApp', className = 'btn sm', titulo }) {
  if (!href) return null;
  return (
    <a className={`${className} wa`} href={href} target="_blank" rel="noopener noreferrer" title={titulo || 'Abrir WhatsApp con el mensaje armado'}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2s.2-1.1.1-1.2-.2-.2-.5-.3z" /></svg>
      {children}
    </a>
  );
}
