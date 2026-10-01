import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const Pill = ({ e }) => <span className={`pill ${e[1]}`}>{e[0]}</span>;

export function Modal({ titulo, onClose, children, ancho }) {
  useEffect(() => {
    const k = (ev) => ev.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} style={ancho ? { width: `min(${ancho}px,100%)` } : undefined}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ id, value, onChange, label, paso = 1 }) {
  return (
    <span className="step">
      <button type="button" onClick={() => onChange(Math.max(0, (value || 0) - paso))} aria-label="Quitar">−</button>
      <input id={id} className="num" type="number" min="0" value={value || 0} aria-label={label}
        onChange={(e) => onChange(Math.max(0, Math.floor(+e.target.value || 0)))} />
      <button type="button" onClick={() => onChange((value || 0) + paso)} aria-label="Agregar">+</button>
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
export const Cargando = () => <div className="empty">Cargando…</div>;
