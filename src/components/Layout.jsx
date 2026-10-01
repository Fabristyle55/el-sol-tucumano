import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth';
import { useData } from '../data';
import { ROLES, VISTAS } from '../util';
import { proyeccion } from '../../shared/negocio.js';

export default function Layout() {
  const { perfil } = useAuth();
  const d = useData();
  const { pathname } = useLocation();
  const vista = pathname.slice(1) || ROLES[perfil.rol].vistas[0];
  const [titulo, sub] = VISTAS[vista] || ['', ''];

  const nPend = d.pedidos.filter((p) => p.estado === 'pendiente').length;
  const nOps = d.ordenes.filter((o) => o.estado !== 'terminada').length;
  const nAl = perfil.rol === 'cliente' ? 0
    : proyeccion({ insumos: d.insumos, ordenes: d.ordenes, pedidos: d.pedidos, compras: d.compras, productosPorId: d.productosPorId }).filter((i) => i.alerta).length;
  const badge = {
    pedidos: nPend ? <span className="badge warn" title="Por confirmar">{nPend}</span> : null,
    produccion: nOps ? <span className="badge warn" title="Órdenes abiertas">{nOps}</span> : null,
    compras: nAl ? <span className="badge" title="Insumos en alerta">{nAl}</span> : null,
  };
  const fechaLarga = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><div className="sun" aria-hidden="true" /><div><b>El Sol Tucumano</b><span>Gestión de producción</span></div></div>
        <nav className="nav" aria-label="Secciones">
          {ROLES[perfil.rol].vistas.map((v) => (
            <NavLink key={v} to={`/${v}`}><span>{VISTAS[v][0]}</span>{badge[v]}</NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="user-box"><b>{perfil.nombre}</b><span className="muted">{ROLES[perfil.rol].label}</span></div>
          <button className="linkbtn small" type="button" onClick={() => signOut(auth)}>Cerrar sesión</button>
          <a className="linkbtn small" href="/presentacion/index.html" style={{ textDecoration: 'none' }}>Presentación del proyecto</a>
        </div>
      </aside>
      <main>
        <div className="head">
          <div><h1>{titulo}</h1><p>{sub}</p></div>
          <div className="today">Hoy es <b>{fechaLarga}</b></div>
        </div>
        {d.error && (
          <div className="note bad">
            No se pudieron leer algunos datos ({d.error.code || d.error.message}). Revisá que las reglas de Firestore estén publicadas y que tu usuario tenga un rol asignado.
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
