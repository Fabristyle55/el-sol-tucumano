import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth';
import { DataProvider, useData } from '../data';
import { ROLES } from '../util';
import { MENSAJES_AUTH } from '../pages/Login';
import Entregas from '../pages/Entregas';
import { Ico } from './Ico';
import {
  Inicio, PedidosApp, StockApp, VentasApp, Vender, ReservasApp, ProduccionApp, RecetasApp, ComprasApp, Pedir, MisPedidosApp, Mas,
} from './pantallas';

// Cada rol ve pocas pestañas, las de su trabajo diario. Lo demás queda en la página completa.
const TABS = {
  gerente: [['inicio', 'Inicio', 'inicio'], ['pedidos', 'Pedidos', 'pedidos'], ['stock', 'Stock', 'stock'], ['ventas', 'Ventas', 'ventas']],
  mostrador: [['vender', 'Vender', 'vender'], ['reservas', 'Reservas', 'reservas'], ['pedidos', 'Pedidos', 'pedidos']],
  panadero: [['produccion', 'Producción', 'produccion'], ['recetas', 'Recetas', 'recetas']],
  deposito: [['stock', 'Stock', 'stock'], ['compras', 'Compras', 'compras']],
  repartidor: [['entregas', 'Entregas', 'entregas']],
  cliente: [['pedir', 'Pedir', 'pedir'], ['mis-pedidos', 'Mis pedidos', 'mispedidos']],
};
const PANTALLA = {
  inicio: Inicio, pedidos: PedidosApp, stock: StockApp, ventas: VentasApp, vender: Vender, reservas: ReservasApp,
  produccion: ProduccionApp, recetas: RecetasApp, compras: ComprasApp, entregas: Entregas, pedir: Pedir, 'mis-pedidos': MisPedidosApp, mas: Mas,
};
const TITULO = {
  inicio: 'Inicio', pedidos: 'Pedidos', stock: 'Stock', ventas: 'Ventas de hoy', vender: 'Vender', reservas: 'Reservas', produccion: 'Producción',
  recetas: 'Recetas', compras: 'Compras', entregas: 'Entregas del día', pedir: 'Hacer un pedido', 'mis-pedidos': 'Mis pedidos', mas: 'Más opciones',
};

export default function AppMovil() {
  const { cargando, user, perfil } = useAuth();
  if (cargando) return <div className="am-splash"><img src="/marca/sol-192.png" alt="" /><span>El Sol</span></div>;
  if (!user) return <Ingreso />;
  if (!perfil || !ROLES[perfil.rol]) {
    return (
      <div className="am-splash am-aviso">
        <img src="/marca/sol-192.png" alt="" />
        <p>Tu cuenta todavía no tiene los datos del comercio. Completalos en la página.</p>
        <a className="btn primary" href="/registro">Completar mis datos</a>
      </div>
    );
  }
  return <DataProvider><Marco /></DataProvider>;
}

function Marco() {
  const { perfil } = useAuth();
  const { error } = useData();
  const loc = useLocation();
  const tabs = [...TABS[perfil.rol], ['mas', 'Más', 'mas']];
  const actual = loc.pathname.split('/')[1] || tabs[0][0];
  const enLinea = useEnLinea();

  // El título de la ventana sigue a la pestaña (útil en escritorio y al cambiar de app en el celular).
  useEffect(() => { document.title = `${TITULO[actual] || 'El Sol'} · El Sol App`; }, [actual]);

  return (
    <div className="am">
      <header className="am-top">
        <img src="/marca/sol-192.png" alt="" width="30" height="30" />
        <h1>{TITULO[actual] || 'El Sol'}</h1>
        <span className="am-quien">{perfil.nombre?.split(' ')[0]}</span>
      </header>
      {!enLinea && <div className="am-offline" role="status">Sin conexión. Lo que ves puede no estar actualizado.</div>}
      {error && <div className="am-offline" role="alert">No se pudieron cargar los datos. Revisá la conexión.</div>}
      <main className="am-main" id="contenido">
        <Routes>
          {tabs.map(([k]) => { const P = PANTALLA[k]; return <Route key={k} path={`/${k}`} element={<P />} />; })}
          <Route path="*" element={<Navigate to={`/${tabs[0][0]}`} replace />} />
        </Routes>
      </main>
      <nav className="am-nav" aria-label="Secciones">
        {tabs.map(([k, l, ic]) => (
          <NavLink key={k} to={`/${k}`} className={({ isActive }) => (isActive ? 'on' : '')}>
            <Ico n={ic} /><span>{l}</span>
            <Contador k={k} />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Numerito sobre la pestaña: lo que está esperando que alguien haga algo. */
function Contador({ k }) {
  const { perfil } = useAuth();
  const d = useData();
  let n = 0;
  if (k === 'pedidos' && perfil.rol === 'gerente') n = d.pedidos.filter((p) => p.estado === 'pendiente').length;
  if (k === 'reservas') n = d.pedidos.filter((p) => p.tipoCliente === 'minorista' && p.estado === 'reservado').length;
  if (k === 'produccion') n = d.ordenes.filter((o) => o.estado !== 'terminada').length;
  if (k === 'compras') n = d.compras.filter((c) => c.estado === 'autorizada').length;
  if (k === 'entregas') n = d.pedidos.filter((p) => p.modoEntrega !== 'retiro' && ['listo', 'en_camino'].includes(p.estado)).length;
  return n > 0 ? <b className="am-badge" aria-label={`${n} pendientes`}>{n > 9 ? '9+' : n}</b> : null;
}

function useEnLinea() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true); const b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

const DEMO = [
  ['Gerente', 'gerente@elsol.demo'], ['Mostrador', 'mostrador@elsol.demo'], ['Panadero', 'panadero@elsol.demo'], ['Depósito', 'deposito@elsol.demo'],
  ['Repartidor', 'repartidor@elsol.demo'], ['Cliente', 'cliente@elsol.demo'], ['Minorista', 'minorista@elsol.demo'],
];

// Instaladores publicados en GitHub (siempre la última versión).
const DESCARGAS = 'https://github.com/Fabristyle55/el-sol-tucumano/releases/latest/download/';

function Ingreso() {
  // Dentro de la app instalada (APK, .exe o instalada desde el navegador) no tiene sentido ofrecer la descarga.
  const enApp = window.matchMedia?.('(display-mode: standalone)').matches || /Electron|; wv\)/.test(navigator.userAgent) || !!window.Capacitor;
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const entrar = async (e) => {
    e.preventDefault(); setError(''); setOcupado(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), pass); } catch (err) { setError(MENSAJES_AUTH[err.code] || 'No se pudo iniciar sesión.'); setOcupado(false); }
  };
  return (
    <div className="am-login">
      <div className="am-login-marca">
        <img src="/marca/sol-512.png" alt="" />
        <b>El Sol</b><span>Panificación El Sol Siciliano</span>
      </div>
      <form onSubmit={entrar} className="am-login-form">
        <div className="field"><label htmlFor="am-email">Email</label><input id="am-email" type="text" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="am-pass">Contraseña</label><input id="am-pass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
        {error && <div className="err-box">{error}</div>}
        <button className="btn primary am-xl" type="submit" disabled={ocupado}>{ocupado ? 'Ingresando…' : 'Ingresar'}</button>
        <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>¿No tenés cuenta? <a href="/registro">Registrate como cliente</a></p>
        {!enApp && <p className="small muted am-bajar">Descargá la app: <a href={`${DESCARGAS}ElSolApp.apk`}>Android</a> · <a href={`${DESCARGAS}ElSolApp-Setup-1.0.0.exe`}>Windows</a></p>}
        <div className="am-demo">
          <span>Cuentas de prueba · contraseña elsol2026</span>
          <div>{DEMO.map(([r, m]) => <button key={m} type="button" onClick={() => { setEmail(m); setPass('elsol2026'); }}>{r}</button>)}</div>
        </div>
      </form>
    </div>
  );
}
