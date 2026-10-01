import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { useData } from '../data';
import { useToast } from '../ui';
import { aFecha, cuando, dRel, fq, hoy, money } from '../util';
import { estadoCuenta, proyeccion, vencimiento } from '../../shared/negocio.js';

const TEXTO_CLIENTE = {
  confirmado: (p) => `Confirmamos tu pedido #${p.numero}`,
  produccion: (p) => `Tu pedido #${p.numero} está en el horno`,
  listo: (p) => (p.modoEntrega === 'retiro' ? `Tu pedido #${p.numero} está listo para retirar` : `Tu pedido #${p.numero} está listo para salir`),
  en_camino: (p) => `Tu pedido #${p.numero} está en camino`,
  entregado: (p) => `Tu pedido #${p.numero} fue entregado`,
  cancelado: (p) => `Tu pedido #${p.numero} fue cancelado`,
};

/** Arma la lista de avisos de cada rol a partir de los datos en vivo. */
function useListaAvisos() {
  const { perfil } = useAuth();
  const d = useData();
  return useMemo(() => {
    const rol = perfil.rol; const T = hoy(); const out = [];
    const add = (id, tono, texto, sub, to, fecha) => out.push({ id, tono, texto, sub, to, fecha: aFecha(fecha) });
    if (rol === 'cliente') {
      d.pedidos.filter((p) => TEXTO_CLIENTE[p.estado] && p.entrega >= sumar(T, -3)).forEach((p) =>
        add(`${p.id}:${p.estado}`, p.estado === 'cancelado' ? 'bad' : 'ok', TEXTO_CLIENTE[p.estado](p), `${dRel(p.entrega)} · ${money(p.total)}`, '/mis-pedidos', p[`${p.estado}En`] || p.creado));
      return out;
    }
    if (rol === 'gerente') {
      d.pedidos.filter((p) => p.estado === 'pendiente').forEach((p) => add(`pend:${p.id}`, 'warn', `Pedido #${p.numero} de ${p.clienteNombre} para confirmar`, `${p.canal === 'web' ? 'Web' : p.canal === 'fijo' ? 'Pedido fijo' : 'Mostrador'} · ${dRel(p.entrega)} · ${money(p.total)}`, '/pedidos?f=pendiente', p.creado));
      d.clientes.filter((c) => estadoCuenta(c, T).estado === 'vencida').forEach((c) => add(`cc:${c.id}:${c.deudaDesde}`, 'bad', `${c.nombre} tiene la cuenta vencida`, `Debe ${money(c.saldo)}`, '/cuentas?f=vencida'));
    }
    if (['gerente', 'deposito'].includes(rol)) {
      proyeccion({ insumos: d.insumos, ordenes: d.ordenes, pedidos: d.pedidos, compras: d.compras, productosPorId: d.productosPorId }).filter((i) => i.alerta)
        .forEach((i) => add(`ins:${i.id}:${T}`, 'bad', `${i.nombre} va a quedar bajo el stock de seguridad`, `Proyectado ${fq(i.proyectado, i.unidad)} ${i.unidad}`, '/compras'));
      if (rol === 'deposito') d.compras.filter((c) => c.estado === 'autorizada').forEach((c) => add(`compra:${c.id}`, 'info', `Compra autorizada: ${c.insumoNombre || c.insumoId}`, 'Registrá la recepción cuando llegue', '/compras', c.fecha));
    }
    if (['gerente', 'mostrador'].includes(rol)) {
      d.pedidos.filter((p) => p.tipoCliente === 'minorista' && p.estado === 'reservado').forEach((p) => add(`res:${p.id}`, 'info', `Reserva #${p.numero} de ${p.clienteNombre} para preparar`, `${p.modoEntrega === 'retiro' ? 'Retira' : 'Envío'} ${dRel(p.entrega).toLowerCase()} · ${money(p.total)}`, '/despacho?t=reservas', p.creado));
      d.articulos.filter((a) => a.activo !== false && (a.stock || 0) < (a.minimo || 0)).forEach((a) => add(`desp:${a.id}:${T}`, 'warn', `Queda poco ${a.nombre} en el despacho`, `Hay ${a.stock || 0}, mínimo ${a.minimo}`, '/despacho?t=stock'));
      d.articulos.filter((a) => { const v = vencimiento(a, T); return v && v.estado !== 'ok'; }).forEach((a) => add(`vence:${a.id}:${a.vence}`, 'warn', `${a.nombre} ${vencimiento(a, T).estado === 'vencido' ? 'está vencido' : 'vence pronto'}`, 'Ponelo en oferta o registrá la merma', '/despacho?t=stock'));
    }
    if (rol === 'panadero') d.ordenes.filter((o) => o.estado === 'pendiente').forEach((o) => add(`op:${o.id}`, 'warn', `Orden OP-${o.numero}: ${o.cantidad} ${o.productoNombre || ''}`.trim(), `Para el ${dRel(o.fecha).toLowerCase()}`, '/produccion', o.creada));
    if (['repartidor', 'mostrador', 'gerente'].includes(rol)) {
      const listos = d.pedidos.filter((p) => p.entrega === T && p.modoEntrega !== 'retiro' && p.estado === 'listo');
      if (listos.length && rol === 'repartidor') listos.forEach((p) => add(`rep:${p.id}:${p.intentos?.length || 0}`, 'ok', `Pedido #${p.numero} listo para repartir`, `${p.clienteNombre} · ${p.localidad || p.direccion || ''}`, '/entregas', p.listoEn));
      else if (listos.length) add(`rep:${T}:${listos.length}`, 'ok', `${listos.length === 1 ? 'Hay 1 envío listo' : `Hay ${listos.length} envíos listos`} para salir a reparto`, 'Hoja de reparto y modo repartidor', '/entregas');
    }
    return out;
  }, [perfil.rol, d]);
}
const sumar = (iso, n) => { const [y, m, dd] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10); };

const leer = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
const guardar = (k, set) => { try { localStorage.setItem(k, JSON.stringify([...set].slice(-400))); } catch { /* sin almacenamiento */ } };

/** Campanita con los avisos en tiempo real. Avisa con un mensaje (y una notificación del sistema si se permitió) cuando aparece uno nuevo. */
export default function Avisos() {
  const { perfil } = useAuth();
  const { cargando } = useData();
  const lista = useListaAvisos();
  const toast = useToast();
  const clave = `avisos-vistos-${perfil.uid}`;
  const [vistos, setVistos] = useState(() => leer(clave));
  const [abierto, setAbierto] = useState(false);
  const [permiso, setPermiso] = useState(() => (typeof Notification === 'undefined' ? 'no' : Notification.permission));
  const conocidos = useRef(null);
  const caja = useRef();
  const nuevos = lista.filter((a) => !vistos.has(a.id));

  // Avisar solo de lo que aparece mientras la app está abierta (no de todo lo viejo al entrar).
  useEffect(() => {
    if (cargando) return;
    const ids = new Set(lista.map((a) => a.id));
    if (conocidos.current) {
      const recien = lista.filter((a) => !conocidos.current.has(a.id) && !vistos.has(a.id));
      if (recien.length) {
        toast(recien.length === 1 ? recien[0].texto : `${recien.length} avisos nuevos`);
        if (permiso === 'granted' && document.hidden) {
          try { recien.slice(0, 3).forEach((a) => new Notification('El Sol Siciliano', { body: a.texto, icon: '/marca/sol-192.png', tag: a.id })); } catch { /* sin notificaciones */ }
        }
      }
    }
    conocidos.current = ids;
  }, [lista, cargando]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  const marcarLeidos = () => { const s = new Set([...vistos, ...lista.map((a) => a.id)]); setVistos(s); guardar(clave, s); };
  const pedirPermiso = async () => { try { setPermiso(await Notification.requestPermission()); } catch { setPermiso('denied'); } };
  const orden = [...lista].sort((a, b) => (vistos.has(a.id) - vistos.has(b.id)) || ((b.fecha || 0) - (a.fecha || 0)));

  return (
    <div className="avisos" ref={caja}>
      <button type="button" className="icon-btn campana" aria-expanded={abierto} aria-haspopup="true"
        aria-label={nuevos.length ? `Avisos: ${nuevos.length} sin leer` : 'Avisos'} onClick={() => setAbierto(!abierto)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {nuevos.length > 0 && <span className="campana-n" key={nuevos.length}>{nuevos.length > 9 ? '9+' : nuevos.length}</span>}
      </button>
      {abierto && (
        <div className="avisos-panel" role="dialog" aria-label="Avisos">
          <div className="avisos-cab"><b>Avisos</b>{nuevos.length > 0 && <button type="button" className="linkbtn small" onClick={marcarLeidos}>Marcar todo como leído</button>}</div>
          {orden.length ? (
            <ul className="avisos-lista">{orden.slice(0, 25).map((a) => (
              <li key={a.id} className={vistos.has(a.id) ? '' : 'nuevo'}>
                <Link to={a.to} onClick={() => { const s = new Set([...vistos, a.id]); setVistos(s); guardar(clave, s); setAbierto(false); }}>
                  <span className="stripe" style={{ background: `var(--${a.tono})` }} aria-hidden="true" />
                  <span className="av-body"><span className="av-t">{a.texto}</span><span className="muted small">{a.sub}{a.fecha ? ` · ${cuando(a.fecha)}` : ''}</span></span>
                  {!vistos.has(a.id) && <span className="sr-only">(sin leer)</span>}
                </Link>
              </li>
            ))}</ul>
          ) : <div className="empty">No hay avisos. Todo en orden.</div>}
          {permiso === 'default' && <div className="avisos-pie"><button type="button" className="btn sm" onClick={pedirPermiso}>Avisarme aunque esté en otra pestaña</button></div>}
          {permiso === 'denied' && <div className="avisos-pie muted small">Las notificaciones del navegador están bloqueadas para este sitio.</div>}
        </div>
      )}
    </div>
  );
}
