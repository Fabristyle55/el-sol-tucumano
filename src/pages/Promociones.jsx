import { useState } from 'react';
import { api } from '../api';
import { useData } from '../data';
import { Modal, Pill, Vacio, useAccion } from '../ui';
import { dLarga, hoy, money } from '../util';
import { promoVigente } from '../../shared/negocio.js';

const PARA_LABEL = { mayorista: 'Mayoristas', minorista: 'Minoristas', todos: 'Todos los clientes' };
const estado = (p) => (p.activo === false ? ['Pausada', 'warn']
  : p.vence && p.vence < hoy() ? ['Vencida', 'bad']
    : p.usosMax > 0 && (p.usos || 0) >= p.usosMax ? ['Agotado', 'bad'] : ['Activa', 'ok']);

/** Promociones por cantidad (automáticas) y cupones con código. Solo el gerente. */
export default function Promociones() {
  const { promos, pedidos } = useData();
  const [nueva, setNueva] = useState(null);
  const [ocupado, correr] = useAccion();
  const porCantidad = promos.filter((p) => p.tipo === 'cantidad').sort((a, b) => (a.productoNombre || '').localeCompare(b.productoNombre || '') || a.minimo - b.minimo);
  const cupones = promos.filter((p) => p.tipo === 'cupon').sort((a, b) => a.codigo.localeCompare(b.codigo));
  const conDesc = pedidos.filter((p) => p.descuento > 0 && p.estado !== 'cancelado');
  const ahorro = conDesc.reduce((s, p) => s + p.descuento, 0);
  const vigentes = promos.filter((p) => promoVigente(p, p.para === 'todos' || !p.para ? 'mayorista' : p.para, hoy())).length;

  const acciones = (p) => (
    <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
      <button className="btn sm" disabled={ocupado} onClick={() => correr(() => api('promo', { accion: p.activo === false ? 'activar' : 'pausar', id: p.id }), p.activo === false ? 'Promoción activada' : 'Promoción pausada')}>{p.activo === false ? 'Activar' : 'Pausar'}</button>
      <button className="btn sm ghost-bad" disabled={ocupado} onClick={() => correr(() => api('promo', { accion: 'borrar', id: p.id }), 'Promoción borrada')}>Borrar</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="kpis kpis-3">
        <div className="kpi"><span className="t">Promociones vigentes</span><span className="v num">{vigentes}</span><span className="s">{porCantidad.length} por cantidad · {cupones.length} cupones</span></div>
        <div className="kpi"><span className="t">Pedidos con descuento</span><span className="v num">{conDesc.length}</span><span className="s">últimas 2 semanas</span></div>
        <div className="kpi"><span className="t">Descuento otorgado</span><span className="v num">{money(ahorro)}</span><span className="s">lo que ahorraron los clientes</span></div>
      </div>

      <section className="card">
        <div className="card-h"><div><h2>Descuentos por cantidad</h2><p className="muted small" style={{ margin: '2px 0 0' }}>Se aplican solos cuando el cliente lleva la cantidad mínima de un producto. Si hay varias, se usa la de mayor descuento.</p></div>
          <button className="btn primary" onClick={() => setNueva('cantidad')}>Nueva promoción</button></div>
        {porCantidad.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Producto</th><th className="r">Desde</th><th className="r">Descuento</th><th>Para</th><th>Vence</th><th>Estado</th><th /></tr></thead>
            <tbody>{porCantidad.map((p) => (
              <tr key={p.id}><td><b>{p.productoNombre}</b><div className="muted small">{p.nombre}</div></td><td className="r num">{p.minimo} u</td><td className="r num">{p.pct}%</td>
                <td>{PARA_LABEL[p.para || 'mayorista']}</td><td className="small">{p.vence ? dLarga(p.vence) : <span className="muted">Sin vencimiento</span>}</td><td><Pill e={estado(p)} /></td><td>{acciones(p)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Vacio>No hay promociones por cantidad. Ejemplo: 10% de descuento llevando 50 o más pan francés.</Vacio>}
      </section>

      <section className="card">
        <div className="card-h"><div><h2>Cupones</h2><p className="muted small" style={{ margin: '2px 0 0' }}>El cliente escribe el código al confirmar el pedido. Se aplica sobre el total, después de las promociones.</p></div>
          <button className="btn primary" onClick={() => setNueva('cupon')}>Nuevo cupón</button></div>
        {cupones.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Código</th><th className="r">Descuento</th><th className="r">Compra mínima</th><th>Para</th><th className="r">Usos</th><th>Vence</th><th>Estado</th><th /></tr></thead>
            <tbody>{cupones.map((p) => (
              <tr key={p.id}><td><span className="chip num">{p.codigo}</span><div className="muted small">{p.nombre}</div></td><td className="r num">{p.pct}%</td><td className="r num">{p.minimo ? money(p.minimo) : '—'}</td>
                <td>{PARA_LABEL[p.para || 'todos']}</td><td className="r num">{p.usos || 0}{p.usosMax ? ` / ${p.usosMax}` : ''}</td>
                <td className="small">{p.vence ? dLarga(p.vence) : <span className="muted">Sin vencimiento</span>}</td><td><Pill e={estado(p)} /></td><td>{acciones(p)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Vacio>No hay cupones. Ejemplo: SOL10 para 10% en la primera compra.</Vacio>}
      </section>
      {nueva && <NuevaPromo tipo={nueva} onClose={() => setNueva(null)} />}
    </div>
  );
}

function NuevaPromo({ tipo, onClose }) {
  const { productos } = useData();
  const cupon = tipo === 'cupon';
  const [f, setF] = useState({ productoId: '', minimo: 50, pct: 10, para: cupon ? 'todos' : 'mayorista', vence: '', codigo: '', usosMax: '', nombre: '' });
  const [ocupado, correr] = useAccion();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async () => { if (await correr(() => api('promo', { accion: 'crear', tipo, ...f }), cupon ? 'Cupón creado' : 'Promoción creada')) onClose(); };
  return (
    <Modal titulo={cupon ? 'Nuevo cupón' : 'Nueva promoción por cantidad'} onClose={onClose}>
      {cupon ? (
        <div className="fields2">
          <div className="field"><label htmlFor="pr-c">Código</label><input id="pr-c" type="text" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="SOL10" /></div>
          <div className="field"><label htmlFor="pr-m">Compra mínima ($)</label><input id="pr-m" type="number" min="0" value={f.minimo} onChange={set('minimo')} /></div>
        </div>
      ) : (
        <div className="fields2">
          <div className="field"><label htmlFor="pr-p">Producto</label><select id="pr-p" value={f.productoId} onChange={set('productoId')}><option value="">Todos los productos</option>{productos.filter((p) => p.activo !== false).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
          <div className="field"><label htmlFor="pr-m">Llevando desde (unidades)</label><input id="pr-m" type="number" min="2" value={f.minimo} onChange={set('minimo')} /></div>
        </div>
      )}
      <div className="fields2">
        <div className="field"><label htmlFor="pr-d">Descuento (%)</label><input id="pr-d" type="number" min="1" max="50" value={f.pct} onChange={set('pct')} /></div>
        <div className="field"><label htmlFor="pr-pa">Para</label><select id="pr-pa" value={f.para} onChange={set('para')}>{Object.entries(PARA_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      <div className="fields2">
        <div className="field"><label htmlFor="pr-v">Vence <span className="muted small">(opcional)</span></label><input id="pr-v" type="date" min={hoy()} value={f.vence} onChange={set('vence')} /></div>
        {cupon
          ? <div className="field"><label htmlFor="pr-u">Usos máximos <span className="muted small">(vacío = sin límite)</span></label><input id="pr-u" type="number" min="0" value={f.usosMax} onChange={set('usosMax')} /></div>
          : <div className="field"><label htmlFor="pr-n">Nombre <span className="muted small">(opcional)</span></label><input id="pr-n" type="text" value={f.nombre} onChange={set('nombre')} placeholder="Promo docena" /></div>}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cerrar</button>
        <button className="btn primary" disabled={ocupado || (cupon && f.codigo.length < 3)} onClick={guardar}>{cupon ? 'Crear cupón' : 'Crear promoción'}</button>
      </div>
    </Modal>
  );
}
