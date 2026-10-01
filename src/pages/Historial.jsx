import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Vacio, useAccion } from '../ui';
import { api } from '../api';
import { useAuth } from '../auth';
import { aFecha, hhmm } from '../util';
import { descargarExcel } from '../xlsx';

const PASO = 150;
const diaDe = (ts) => { const d = aFecha(ts); return d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d) : ''; };
const diaLargo = (iso) => { const t = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T12:00:00`)); return t.charAt(0).toUpperCase() + t.slice(1); };
// Agrupa por tipo de acción según el texto, para poder filtrar.
const TIPOS = [
  ['pedidos', 'Pedidos', /pedido|reserva/i], ['produccion', 'Producción', /OP-|órdenes|producción/i], ['stock', 'Stock y compras', /ingres|ajust|OC-|compra|insumo|costo/i],
  ['despacho', 'Despacho y caja', /despacho|venta|caja|merma|baja/i], ['cuentas', 'Cuenta corriente', /pago|cuenta corriente|plazo/i], ['catalogo', 'Productos y precios', /precio|receta|producto|imagen|foto/i],
];
const tipoDe = (t) => TIPOS.find(([, , re]) => re.test(t))?.[0] || 'otros';

function Bitacora() {
  const [n, setN] = useState(PASO);
  const [lineas, setLineas] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [usuario, setUsuario] = useState('');
  const [tipo, setTipo] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'actividad'), orderBy('fecha', 'desc'), limit(n)),
    (s) => setLineas(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setLineas([])), [n]);

  if (!lineas) return <section className="card"><Vacio>Cargando…</Vacio></section>;
  const usuarios = [...new Set(lineas.map((l) => l.usuario))].sort();
  const lista = lineas.filter((l) => (!usuario || l.usuario === usuario) && (!tipo || tipoDe(l.texto) === tipo)
    && (!buscar || `${l.texto} ${l.usuario}`.toLowerCase().includes(buscar.toLowerCase())));
  const porDia = [];
  lista.forEach((l) => { const d = diaDe(l.fecha); const g = porDia[porDia.length - 1]; if (g && g.d === d) g.ls.push(l); else porDia.push({ d, ls: [l] }); });
  const exportar = () => descargarExcel(`historial-el-sol-${new Date().toISOString().slice(0, 10)}`, [{
    nombre: 'Historial', filas: [['Fecha', 'Hora', 'Usuario', 'Rol', 'Acción'], ...lista.map((l) => [diaDe(l.fecha), hhmm(l.fecha), l.usuario, l.rol, l.texto])],
  }]);

  return (
    <section className="card">
      <div className="card-h">
        <div className="row">
          <input type="search" placeholder="Buscar: pedido #1052, harina, Laura…" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar en el historial" style={{ minWidth: 240 }} />
          <select value={usuario} onChange={(e) => setUsuario(e.target.value)} aria-label="Usuario"><option value="">Todos los usuarios</option>{usuarios.map((u) => <option key={u}>{u}</option>)}</select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de acción"><option value="">Todas las acciones</option>{TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}<option value="otros">Otras</option></select>
        </div>
        <button className="btn" disabled={!lista.length} onClick={exportar}>Exportar a Excel</button>
      </div>
      {porDia.length ? porDia.map((g) => (
        <div key={g.d} className="hist-dia">
          <h3>{g.d ? diaLargo(g.d) : 'Sin fecha'}</h3>
          <div className="list">{g.ls.map((l) => (
            <div className="li" key={l.id}><span className="when">{hhmm(l.fecha)}</span>
              <div className="body"><div>{l.texto}</div><div className="small muted" style={{ marginTop: 2 }}>{l.usuario} · {l.rol}</div></div></div>
          ))}</div>
        </div>
      )) : <Vacio>No hay acciones con esos filtros.</Vacio>}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <span className="muted small">Mostrando {lista.length} de las últimas {lineas.length} acciones. Nadie puede borrar ni modificar este historial.</span>
        {lineas.length >= n && <button className="btn sm" onClick={() => setN(n + PASO)}>Ver más antiguas</button>}
      </div>
    </section>
  );
}

export default function Historial() {
  const { perfil } = useAuth();
  return <>{perfil.rol === 'gerente' && <Respaldos />}<Bitacora /></>;
}

const tam = (b) => (b > 1e6 ? `${(b / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

/** Respaldos de la base de datos: el automático de los domingos y los que se hacen a mano. */
function Respaldos() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, correr] = useAccion();
  const cargar = () => api('respaldo', { accion: 'listar' }).then((r) => setLista(r.respaldos)).catch((e) => { setError(e.message); setLista([]); });
  useEffect(() => { cargar(); }, []);
  const crear = async () => { if (await correr(() => api('respaldo', { accion: 'crear' }), (r) => `Respaldo hecho: ${r.documentos} documentos`)) cargar(); };
  const bajar = (clave) => correr(async () => {
    const r = await api('respaldo', { accion: 'descargar', clave });
    const url = URL.createObjectURL(new Blob([r.contenido], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${clave}.json` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  const ultimo = lista?.[0];
  return (
    <section className="card">
      <div className="card-h">
        <div><h2>Respaldos de la base de datos</h2><p className="muted small" style={{ margin: '2px 0 0' }}>Todos los domingos a la madrugada se guarda solo una copia completa de los datos. Se conservan las últimas 12.</p></div>
        <button className="btn primary" disabled={ocupado} onClick={crear}>{ocupado ? 'Trabajando…' : 'Hacer un respaldo ahora'}</button>
      </div>
      {error && <div className="note bad">{error}</div>}
      {!lista ? <Vacio>Cargando…</Vacio> : lista.length ? (
        <>
          {ultimo && <p className="small" style={{ margin: '0 0 10px' }}>Último respaldo: <b>{new Date(ultimo.fecha).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })}</b></p>}
          <div className="tbl-wrap"><table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th className="r">Documentos</th><th className="r">Tamaño</th><th /></tr></thead>
            <tbody>{lista.map((r) => (
              <tr key={r.clave}><td>{r.fecha ? new Date(r.fecha).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : r.clave}</td>
                <td className="small">{r.origen || '—'}</td><td className="r num">{(r.documentos || 0).toLocaleString('es-AR')}</td><td className="r num">{r.bytes ? tam(r.bytes) : '—'}</td>
                <td className="r"><button className="btn sm" disabled={ocupado} onClick={() => bajar(r.clave)}>Descargar .json</button></td></tr>
            ))}</tbody>
          </table></div>
        </>
      ) : <Vacio>Todavía no hay respaldos. El primero se hace solo el domingo, o podés hacer uno ahora.</Vacio>}
    </section>
  );
}
