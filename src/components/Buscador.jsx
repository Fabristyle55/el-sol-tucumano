import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth';
import { useData } from '../data';
import { ROLES, VISTAS, dRel, estadoDe, money } from '../util';
import { Icono } from './Iconos';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const coincide = (texto, q) => { const t = norm(texto); return norm(q).split(/\s+/).filter(Boolean).every((p) => t.includes(p)); };
export const atajo = /Mac|iPhone|iPad/.test(typeof navigator !== 'undefined' ? navigator.platform : '') ? '⌘K' : 'Ctrl K';

/** Buscador rápido (Ctrl+K): ir a una pantalla, buscar pedidos, clientes y productos, o cambiar el tema. */
export default function Buscador() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAbierto((x) => !x); }
      else if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) { e.preventDefault(); setAbierto(true); }
    };
    const abrir = () => setAbierto(true);
    document.addEventListener('keydown', k);
    window.addEventListener('abrir-buscador', abrir);
    return () => { document.removeEventListener('keydown', k); window.removeEventListener('abrir-buscador', abrir); };
  }, []);
  return abierto ? <Paleta onClose={() => setAbierto(false)} /> : null;
}

/** Botón que abre el buscador (en el encabezado). */
export function BotonBuscar() {
  return (
    <button type="button" className="buscar-btn" onClick={() => window.dispatchEvent(new Event('abrir-buscador'))} aria-label="Buscar (Ctrl K)">
      <Icono n="buscar" size={16} /><span>Buscar…</span><kbd>{atajo}</kbd>
    </button>
  );
}

function Paleta({ onClose }) {
  const { perfil } = useAuth();
  const d = useData();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef();
  const lista = useRef();
  const antes = useRef(document.activeElement);

  useEffect(() => { input.current?.focus(); const a = antes.current; return () => a?.focus?.(); }, []);

  const rol = ROLES[perfil.rol];
  const rutas = [...rol.vistas, ...(rol.rutas || []).filter((r) => r !== 'comprobante')];
  const grupos = useMemo(() => {
    const ir = (to) => () => nav(to);
    const pantallas = rutas.map((v) => ({ id: `v-${v}`, ico: v, titulo: VISTAS[v][0], sub: VISTAS[v][1], run: ir(`/${v}`) }));
    const acciones = [
      { id: 'a-tema', ico: 'tema', titulo: 'Cambiar tema claro / oscuro', sub: 'Se recuerda en este navegador', run: () => document.querySelector('.side-actions .icon-btn')?.click() },
      { id: 'a-salir', ico: 'salir', titulo: 'Cerrar sesión', sub: perfil.nombre, run: () => signOut(auth) },
    ];
    if (!q.trim()) return [['Ir a', pantallas], ['Acciones', acciones]];
    const out = [];
    const p1 = pantallas.filter((x) => coincide(`${x.titulo} ${x.sub}`, q)); if (p1.length) out.push(['Pantallas', p1]);
    const verPedido = perfil.rol === 'cliente' ? '/mis-pedidos' : perfil.rol === 'repartidor' ? '/entregas' : '/pedidos';
    const peds = d.pedidos.filter((p) => coincide(`#${p.numero} ${p.numero} ${p.clienteNombre} ${p.localidad || ''} ${estadoDe(p)[0]}`, q))
      .sort((a, b) => b.numero - a.numero).slice(0, 6)
      .map((p) => ({ id: `p-${p.id}`, ico: 'pedido', titulo: `Pedido #${p.numero} · ${p.clienteNombre}`, sub: `${estadoDe(p)[0]} · ${dRel(p.entrega)} · ${money(p.total)}`, run: ir(perfil.rol === 'cliente' || perfil.rol === 'repartidor' ? verPedido : `/comprobante?tipo=pedido&id=${p.id}`) }));
    if (peds.length && ['pedidos', 'mis-pedidos', 'entregas'].some((r) => rutas.includes(r))) out.push(['Pedidos', peds]);
    const clis = d.clientes.filter((c) => coincide(`${c.nombre} ${c.localidad || ''} ${c.telefono || ''}`, q)).slice(0, 5)
      .map((c) => ({ id: `c-${c.id}`, ico: 'cliente', titulo: c.nombre, sub: [c.tipo === 'minorista' ? 'Minorista' : 'Mayorista', c.localidad, c.saldo > 0 ? `debe ${money(c.saldo)}` : ''].filter(Boolean).join(' · '), run: ir(perfil.rol === 'gerente' && c.saldo > 0 ? '/cuentas' : rutas.includes('usuarios') ? '/usuarios' : '/pedidos') }));
    if (clis.length && rutas.includes('pedidos')) out.push(['Clientes', clis]);
    const prods = d.productos.filter((p) => coincide(p.nombre, q)).slice(0, 5)
      .map((p) => ({ id: `pr-${p.id}`, ico: 'productos', titulo: p.nombre, sub: `Mayorista ${money(p.precio)}${p.precioMinorista ? ` · minorista ${money(p.precioMinorista)}` : ''}`, run: ir(rutas.includes('recetas') ? '/recetas' : rutas.includes('catalogo') ? '/catalogo' : '/productos') }));
    if (prods.length && (rutas.includes('recetas') || rutas.includes('catalogo') || rutas.includes('productos'))) out.push(['Productos', prods]);
    const a1 = acciones.filter((x) => coincide(x.titulo, q)); if (a1.length) out.push(['Acciones', a1]);
    return out;
  }, [q, d, perfil, nav]); // eslint-disable-line react-hooks/exhaustive-deps

  const planos = grupos.flatMap(([, xs]) => xs);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const elegir = (x) => { onClose(); setTimeout(() => x.run(), 0); };
  const tecla = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(planos.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && planos[sel]) { e.preventDefault(); elegir(planos[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let i = -1;
  return createPortal(
    <div className="paleta-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="paleta" role="dialog" aria-modal="true" aria-label="Buscador">
        <div className="paleta-in">
          <Icono n="buscar" size={18} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={tecla} placeholder="Buscá una pantalla, un pedido, un cliente o un producto…"
            role="combobox" aria-expanded="true" aria-controls="paleta-lista" aria-activedescendant={planos[sel] ? `op-${planos[sel].id}` : undefined} autoComplete="off" spellCheck="false" />
          <kbd>Esc</kbd>
        </div>
        <div className="paleta-lista" id="paleta-lista" role="listbox" ref={lista}>
          {grupos.length ? grupos.map(([g, xs]) => (
            <div key={g} role="group" aria-label={g}>
              <div className="paleta-g">{g}</div>
              {xs.map((x) => { i++; const k = i; return (
                <div key={x.id} id={`op-${x.id}`} role="option" aria-selected={k === sel} className="paleta-op" onMouseMove={() => setSel(k)} onClick={() => elegir(x)}>
                  <span className="paleta-ic"><Icono n={x.ico} size={16} /></span>
                  <span className="paleta-t"><b>{x.titulo}</b><small>{x.sub}</small></span>
                  {k === sel && <Icono n="flecha" size={14} className="paleta-ir" />}
                </div>
              ); })}
            </div>
          )) : <div className="paleta-vacio">No encontramos nada con "{q}".</div>}
        </div>
        <div className="paleta-pie"><span><kbd>↑</kbd><kbd>↓</kbd> moverse</span><span><kbd>Enter</kbd> abrir</span><span><kbd>{atajo}</kbd> abrir o cerrar</span></div>
      </div>
    </div>,
    document.body,
  );
}
