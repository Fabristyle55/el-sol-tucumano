import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth';
import { useData } from '../data';
import { ROLES, VISTAS } from '../util';
import { estadoCuenta, fechaAR, proyeccion } from '../../shared/negocio.js';
import { TemaToggle } from '../ui';
import Avisos from './Avisos';
import Buscador, { BotonBuscar } from './Buscador';
import { Icono } from './Iconos';

/** Estado de la conexión y botón para instalar la app (PWA). */
function useApp() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const [instalar, setInstalar] = useState(null);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    const ofrecer = (e) => { e.preventDefault(); setInstalar(e); };
    window.addEventListener('online', on); window.addEventListener('offline', off); window.addEventListener('beforeinstallprompt', ofrecer);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('beforeinstallprompt', ofrecer); };
  }, []);
  return { online, instalar: instalar && (async () => { instalar.prompt(); await instalar.userChoice.catch(() => null); setInstalar(null); }) };
}

/** Navega con una transición suave entre pantallas (View Transitions) si el navegador la soporta. */
export function useIrSuave() {
  const navigate = useNavigate();
  return (to) => {
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reducir) { navigate(to); return; }
    document.startViewTransition(() => flushSync(() => navigate(to)));
  };
}

/** Indicador que se desliza hasta la sección activa del menú. */
function useIndicador(navRef, pathname) {
  const [st, setSt] = useState(null);
  useLayoutEffect(() => {
    const medir = () => {
      const a = navRef.current?.querySelector('a.active');
      if (!a) { setSt(null); return; }
      setSt({ top: a.offsetTop, left: a.offsetLeft, width: a.offsetWidth, height: a.offsetHeight });
      // En el celular el menú es una fila que se desliza: se centra la sección activa.
      const nav = navRef.current;
      if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [navRef, pathname]);
  return st;
}

const iniciales = (n = '') => n.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export default function Layout() {
  const { perfil } = useAuth();
  const d = useData();
  const { pathname } = useLocation();
  const app = useApp();
  const vista = pathname.slice(1) || ROLES[perfil.rol].vistas[0];
  const [titulo, sub] = VISTAS[vista] || ['', ''];

  const nPend = d.pedidos.filter((p) => p.estado === 'pendiente').length;
  const nRes = d.pedidos.filter((p) => p.tipoCliente === 'minorista' && ['reservado', 'listo'].includes(p.estado)).length;
  const nOps = d.ordenes.filter((o) => o.estado !== 'terminada').length;
  const nAl = perfil.rol === 'cliente' ? 0
    : proyeccion({ insumos: d.insumos, ordenes: d.ordenes, pedidos: d.pedidos, compras: d.compras, productosPorId: d.productosPorId }).filter((i) => i.alerta).length;
  const nVenc = perfil.rol === 'gerente' ? d.clientes.filter((c) => estadoCuenta(c, fechaAR(0)).estado === 'vencida').length : 0;
  const badge = {
    pedidos: nPend ? <span className="badge warn" title="Por confirmar">{nPend}</span> : null,
    produccion: nOps ? <span className="badge warn" title="Órdenes abiertas">{nOps}</span> : null,
    despacho: nRes ? <span className="badge n" title="Reservas para preparar o entregar">{nRes}</span> : null,
    compras: nAl ? <span className="badge" title="Insumos en alerta">{nAl}</span> : null,
    cuentas: nVenc ? <span className="badge" title="Cuentas vencidas">{nVenc}</span> : null,
  };
  // Al cambiar de pantalla, el foco va al título para que los lectores de pantalla anuncien dónde se está.
  const h1 = useRef();
  const primera = useRef(true);
  useEffect(() => { if (primera.current) { primera.current = false; return; } h1.current?.focus({ preventScroll: true }); document.title = `${titulo || 'Sistema'} · El Sol Siciliano`; }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const ir = useIrSuave();
  const navRef = useRef();
  const ind = useIndicador(navRef, pathname);
  const fechaLarga = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="app">
      <a className="skip" href="#contenido">Saltar al contenido</a>
      <aside className="side">
        <a className="brand" href="/presentacion/index.html" title="Presentación del proyecto"><img src="/marca/sol-192.png" alt="" /><div><b>El Sol <i>Siciliano</i></b><span>Gestión de producción</span></div></a>
        <nav className="nav" aria-label="Secciones" ref={navRef}>
          {ind && <span className="nav-ind" aria-hidden="true" style={{ transform: `translate(${ind.left}px, ${ind.top}px)`, width: ind.width, height: ind.height }} />}
          {ROLES[perfil.rol].vistas.map((v) => (
            <NavLink key={v} to={`/${v}`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); if (`/${v}` !== pathname) ir(`/${v}`); }}>
              <Icono n={v} /><span className="nav-t">{VISTAS[v][0]}</span>{badge[v]}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="user-box"><span className="avatar" aria-hidden="true">{iniciales(perfil.nombre)}</span><div style={{ minWidth: 0 }}><b>{perfil.nombre}</b><span>{ROLES[perfil.rol].label}</span></div></div>
          <div className="side-actions">
            <button className="btn sm" type="button" onClick={() => signOut(auth)}>Cerrar sesión</button>
            <TemaToggle />
          </div>
          {app.instalar && <button className="btn sm" type="button" onClick={app.instalar}>Instalar la app</button>}
          <a className="linkbtn small solo-escritorio" href="/presentacion/index.html">Presentación del proyecto</a>
        </div>
      </aside>
      <main id="contenido">
        <div className="head">
          <div><h1 ref={h1} tabIndex={-1}>{titulo}</h1><p>{sub}</p></div>
          <div className="head-der"><BotonBuscar /><div className="today"><b>{fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}</b></div><Avisos /></div>
        </div>
        {!app.online && <div className="note warn" role="alert">Sin conexión a internet. Podés seguir mirando, pero los cambios no se van a guardar hasta que vuelva la conexión.</div>}
        {d.error && (
          <div className="note bad">
            No se pudieron leer algunos datos ({d.error.code || d.error.message}). Revisá que las reglas de Firestore estén publicadas y que tu usuario tenga un rol asignado.
          </div>
        )}
        <div className="page" key={pathname}><Outlet /></div>
      </main>
      <Buscador />
    </div>
  );
}
