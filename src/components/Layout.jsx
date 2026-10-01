import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth';
import { useData } from '../data';
import { ROLES, VISTAS } from '../util';
import { estadoCuenta, fechaAR, proyeccion } from '../../shared/negocio.js';
import { TemaToggle } from '../ui';

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
  const fechaLarga = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="app">
      <aside className="side">
        <a className="brand" href="/presentacion/index.html" title="Presentación del proyecto"><img src="/marca/sol-192.png" alt="" /><div><b>El Sol <i>Siciliano</i></b><span>Gestión de producción</span></div></a>
        <nav className="nav" aria-label="Secciones">
          {ROLES[perfil.rol].vistas.map((v) => (
            <NavLink key={v} to={`/${v}`}><span>{VISTAS[v][0]}</span>{badge[v]}</NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="user-box"><span className="avatar" aria-hidden="true">{iniciales(perfil.nombre)}</span><div style={{ minWidth: 0 }}><b>{perfil.nombre}</b><span>{ROLES[perfil.rol].label}</span></div></div>
          <div className="side-actions">
            <button className="btn sm" type="button" onClick={() => signOut(auth)}>Cerrar sesión</button>
            <TemaToggle />
          </div>
          {app.instalar && <button className="btn sm" type="button" onClick={app.instalar}>Instalar la app</button>}
          <a className="linkbtn small" href="/presentacion/index.html">Presentación del proyecto</a>
        </div>
      </aside>
      <main>
        <div className="head">
          <div><h1>{titulo}</h1><p>{sub}</p></div>
          <div className="today"><b>{fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}</b></div>
        </div>
        {!app.online && <div className="note warn">Sin conexión a internet. Podés seguir mirando, pero los cambios no se van a guardar hasta que vuelva la conexión.</div>}
        {d.error && (
          <div className="note bad">
            No se pudieron leer algunos datos ({d.error.code || d.error.message}). Revisá que las reglas de Firestore estén publicadas y que tu usuario tenga un rol asignado.
          </div>
        )}
        <div className="page" key={pathname}><Outlet /></div>
      </main>
    </div>
  );
}
