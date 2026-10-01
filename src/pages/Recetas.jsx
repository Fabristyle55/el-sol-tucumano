import { useState } from 'react';
import { addDoc, collection, deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, useToast } from '../ui';
import { fq, money } from '../util';
import { costoProducto, margen, r3 } from '../../shared/negocio.js';
import { anotar } from '../bitacora';

export default function Recetas() {
  const { perfil } = useAuth();
  const { productos, insumos, insumosPorId } = useData();
  const [verCostos, setVerCostos] = useState(false);
  const toast = useToast();
  const [sel, setSel] = useState(null);
  const [calc, setCalc] = useState(10);
  const [nuevo, setNuevo] = useState(false);
  const [agregar, setAgregar] = useState('');
  const edit = perfil.rol === 'gerente';
  const p = productos.find((x) => x.id === sel) || productos[0];
  if (!p) return <section className="card"><div className="empty">No hay productos cargados.</div></section>;

  const receta = p.receta || {};
  const guardar = async (cambios, msg) => {
    try {
      await updateDoc(doc(db, 'productos', p.id), cambios);
      if (msg) { toast(msg); anotar(perfil, `${msg}: ${p.nombre}`); }
    } catch (e) { toast(`No se pudo guardar: ${e.code || e.message}`, 'error'); }
  };
  const cp = costoProducto(p, insumosPorId);
  const mMay = margen(p.precio, cp.costo);
  const mMin = margen(p.precioMinorista || p.precio, cp.costo);

  return (
    <div className="recipes">
      <div className="plist" role="group" aria-label="Productos">
        {productos.map((x) => <button key={x.id} aria-pressed={x.id === p.id} onClick={() => setSel(x.id)}>{x.nombre}{x.activo === false ? ' (pausado)' : ''}</button>)}
        {edit && <button style={{ color: 'var(--brand)' }} onClick={() => setNuevo(true)}>+ Nuevo producto</button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <section className="card">
          <div className="card-h">
            <div><h2>{p.nombre}</h2><p className="muted small" style={{ margin: '4px 0 0' }}>Cantidades por unidad vendida (una bolsa o paquete).{edit ? '' : ' Solo el gerente puede modificarlas.'}</p></div>
            {edit && (
              <div className="row">
                <label className="small" htmlFor="precio">Mayorista</label>
                <input id="precio" key={`precio-${p.id}-${p.precio}`} className="qty-in num" type="number" min="0" defaultValue={p.precio} onBlur={(e) => +e.target.value !== p.precio && guardar({ precio: Math.max(0, Math.round(+e.target.value || 0)) }, 'Precio mayorista actualizado')} />
                <label className="small" htmlFor="precio-min">Minorista</label>
                <input id="precio-min" key={`pmin-${p.id}-${p.precioMinorista}`} className="qty-in num" type="number" min="0" defaultValue={p.precioMinorista || ''} placeholder={p.precio} onBlur={(e) => +e.target.value !== (p.precioMinorista || 0) && guardar({ precioMinorista: Math.max(0, Math.round(+e.target.value || 0)) }, 'Precio minorista actualizado')} />
                <button className="btn sm" onClick={() => guardar({ activo: p.activo === false }, p.activo === false ? 'Producto activado' : 'Producto pausado en el catálogo')}>{p.activo === false ? 'Activar' : 'Pausar'}</button>
              </div>
            )}
            {!edit && <span className="num muted">{money(p.precio)} mayorista · {money(p.precioMinorista || p.precio)} minorista</span>}
          </div>
          <div className="tbl-wrap"><table>
            <thead><tr><th>Insumo</th><th className="r">Cantidad</th><th>Unidad</th>{edit && <th className="r">Costo</th>}{edit && <th />}</tr></thead>
            <tbody>{Object.entries(receta).map(([iid, x]) => {
              const i = insumosPorId[iid];
              return (
                <tr key={iid}><td>{i?.nombre || iid}</td>
                  <td className="r">{edit
                    ? <input key={`${p.id}-${iid}-${x}`} className="qty-in num" type="number" min="0" step="0.001" defaultValue={x} aria-label={`Cantidad de ${i?.nombre}`}
                      onBlur={(e) => { const v = r3(Math.max(0, +e.target.value || 0)); if (v !== x) guardar({ [`receta.${iid}`]: v }, 'Receta actualizada'); }} />
                    : <span className="num">{fq(x, i?.unidad)}</span>}</td>
                  <td className="muted">{i?.unidad}</td>
                  {edit && <td className="r num muted">{i?.costo > 0 ? money(x * i.costo) : '—'}</td>}
                  {edit && <td className="r"><button className="btn sm ghost-bad" onClick={() => guardar({ [`receta.${iid}`]: deleteField() }, `Se quitó ${i?.nombre}`)}>Quitar</button></td>}
                </tr>
              );
            })}</tbody>
          </table></div>
          {edit && (
            <div className="costos">
              <div><span className="lbl">Costo por unidad</span><b className="num">{money(cp.costo)}</b>{!cp.completo && <span className="small" style={{ color: 'var(--warn)' }}>Faltan costos de insumos</span>}</div>
              <div><span className="lbl">Margen mayorista</span><b className="num" style={{ color: `var(--${mMay.pct < 25 ? 'bad' : 'ok'})` }}>{mMay.pct} %</b><span className="small muted num">{money(mMay.monto)} por unidad</span></div>
              <div><span className="lbl">Margen minorista</span><b className="num" style={{ color: `var(--${mMin.pct < 25 ? 'bad' : 'ok'})` }}>{mMin.pct} %</b><span className="small muted num">{money(mMin.monto)} por unidad</span></div>
            </div>
          )}
          {edit && (
            <div className="row" style={{ marginTop: 12 }}>
              <select value={agregar} onChange={(e) => setAgregar(e.target.value)} aria-label="Insumo a agregar">
                <option value="">Agregar insumo…</option>
                {insumos.filter((i) => !(i.id in receta)).map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
              </select>
              <button className="btn sm" disabled={!agregar} onClick={() => { guardar({ [`receta.${agregar}`]: insumosPorId[agregar].unidad === 'u' ? 1 : 0.01 }, 'Insumo agregado'); setAgregar(''); }}>Agregar</button>
            </div>
          )}
        </section>
        {edit && (
          <section className="card">
            <div className="card-h"><div><h2>Costo y margen de todos los productos</h2><p className="muted small" style={{ margin: '4px 0 0' }}>Calculado con la receta y el costo de cada insumo (se edita en Stock).</p></div>
              <button className="btn sm" onClick={() => setVerCostos(!verCostos)}>{verCostos ? 'Ocultar' : 'Ver tabla'}</button></div>
            {verCostos && <TablaCostos productos={productos} insumosPorId={insumosPorId} />}
          </section>
        )}
        <section className="card">
          <div className="card-h"><h2>Calculadora de tanda</h2><div className="row"><label htmlFor="calc" className="small">Unidades</label><input id="calc" className="qty-in num" type="number" min="1" value={calc} onChange={(e) => setCalc(Math.max(1, Math.floor(+e.target.value || 1)))} /></div></div>
          <div className="lines">{Object.entries(receta).map(([iid, x]) => <div className="line" key={iid}><span>{insumosPorId[iid]?.nombre}</span><span className="num">{fq(r3(x * calc), insumosPorId[iid]?.unidad)} {insumosPorId[iid]?.unidad}</span></div>)}</div>
        </section>
      </div>
      {nuevo && <NuevoProducto perfil={perfil} onClose={() => setNuevo(false)} onCreado={(id) => setSel(id)} cantidad={productos.length} />}
    </div>
  );
}

function TablaCostos({ productos, insumosPorId }) {
  const filas = productos.map((p) => { const c = costoProducto(p, insumosPorId); return { p, c, may: margen(p.precio, c.costo), min: margen(p.precioMinorista || p.precio, c.costo) }; })
    .sort((a, b) => a.may.pct - b.may.pct);
  return (
    <div className="tbl-wrap"><table>
      <thead><tr><th>Producto</th><th className="r">Costo</th><th className="r">Precio mayorista</th><th className="r">Margen</th><th className="r">Precio minorista</th><th className="r">Margen</th></tr></thead>
      <tbody>{filas.map(({ p, c, may, min }) => (
        <tr key={p.id}><td>{p.nombre}{!c.completo && <span className="muted small"> · costo incompleto</span>}</td><td className="r num">{money(c.costo)}</td>
          <td className="r num">{money(p.precio)}</td><td className="r"><span className={`pill ${may.pct < 25 ? 'bad' : may.pct < 40 ? 'warn' : 'ok'}`}>{may.pct} %</span></td>
          <td className="r num">{money(p.precioMinorista || p.precio)}</td><td className="r"><span className={`pill ${min.pct < 25 ? 'bad' : min.pct < 40 ? 'warn' : 'ok'}`}>{min.pct} %</span></td></tr>
      ))}</tbody>
    </table></div>
  );
}

function NuevoProducto({ perfil, onClose, onCreado, cantidad }) {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [precioMin, setPrecioMin] = useState('');
  const crear = async () => {
    if (!nombre.trim() || !(+precio > 0)) { toast('Completá nombre y precio.', 'error'); return; }
    try {
      const ref = await addDoc(collection(db, 'productos'), { nombre: nombre.trim(), precio: Math.round(+precio), precioMinorista: Math.round(+precioMin || 0), activo: true, receta: {}, orden: cantidad + 1, creado: serverTimestamp() });
      toast('Producto creado. Ahora cargá su receta.'); anotar(perfil, `Creó el producto ${nombre.trim()}`); onCreado(ref.id); onClose();
    } catch (e) { toast(`No se pudo crear: ${e.code || e.message}`, 'error'); }
  };
  return (
    <Modal titulo="Nuevo producto" onClose={onClose}>
      <div className="fields2">
        <div className="field"><label htmlFor="np-n">Nombre</label><input id="np-n" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Pan lactal x500g" /></div>
        <div className="field"><label htmlFor="np-p">Precio mayorista</label><input id="np-p" type="number" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} /></div>
        <div className="field"><label htmlFor="np-pm">Precio minorista</label><input id="np-pm" type="number" min="0" value={precioMin} onChange={(e) => setPrecioMin(e.target.value)} /></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Cerrar</button><button className="btn primary" onClick={crear}>Crear</button></div>
    </Modal>
  );
}
