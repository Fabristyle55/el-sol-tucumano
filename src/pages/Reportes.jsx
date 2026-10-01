import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../data';
import { Vacio } from '../ui';
import { hoy, mesCorto, money } from '../util';
import { r3, sumarDias } from '../../shared/negocio.js';
import { descargarExcel } from '../xlsx';

const RANGOS = [[3, '3 meses'], [6, '6 meses'], [12, '12 meses']];
const traer = async (col, campo, desde) => (await getDocs(query(collection(db, col), where(campo, '>=', desde)))).docs.map((d) => ({ id: d.id, ...d.data() }));
const mesesDesde = (desde, hasta) => { const out = []; let [y, m] = desde.split('-').map(Number); const [yh, mh] = hasta.split('-').map(Number); while (y < yh || (y === yh && m <= mh)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; };
const aDia = (ts) => { const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d) : ''; };

export default function Reportes() {
  const { insumos, insumosPorId, productosPorId } = useData();
  const [meses, setMeses] = useState(6);
  const [datos, setDatos] = useState(null);
  const [insumo, setInsumo] = useState('h000');
  const [error, setError] = useState('');
  const T = hoy();
  const desde = `${sumarDias(T, -31 * (meses - 1)).slice(0, 7)}-01`;

  useEffect(() => {
    let vivo = true; setDatos(null); setError('');
    Promise.all([
      traer('pedidos', 'entrega', desde), traer('ventas', 'dia', desde),
      traer('movimientos', 'fecha', new Date(`${desde}T00:00:00-03:00`)), traer('mermas', 'dia', desde),
    ]).then(([pedidos, ventas, movimientos, mermas]) => vivo && setDatos({ pedidos, ventas, movimientos, mermas }))
      .catch((e) => vivo && setError(e.code || e.message));
    return () => { vivo = false; };
  }, [desde]);

  const r = useMemo(() => {
    if (!datos) return null;
    const lista = mesesDesde(desde.slice(0, 7), T.slice(0, 7));
    const porMes = Object.fromEntries(lista.map((m) => [m, { may: 0, min: 0, nPed: 0, nVen: 0, merma: 0 }]));
    const prods = {}; const reventa = {};
    const sumarProd = (pid, nombre, q, total, canal) => { const x = (prods[pid] ||= { nombre, may: 0, min: 0, total: 0 }); x[canal] += q; x.total += total; };
    const entregados = datos.pedidos.filter((p) => p.estado === 'entregado' && p.entrega <= T);
    entregados.forEach((p) => {
      const m = porMes[p.entrega.slice(0, 7)]; if (!m) return;
      const may = p.tipoCliente !== 'minorista';
      if (may) m.may += p.total; else m.min += p.total;
      m.nPed++;
      p.items.forEach((i) => { if (i.productoId) sumarProd(i.productoId, i.nombre, i.cantidad, Math.round(i.cantidad * i.precio), may ? 'may' : 'min'); else { const x = (reventa[i.nombre] ||= { q: 0, total: 0, unidad: i.unidad }); x.q = r3(x.q + i.cantidad); x.total += Math.round(i.cantidad * i.precio); } });
    });
    const ventas = datos.ventas.filter((v) => !v.anulada);
    ventas.forEach((v) => {
      const m = porMes[v.dia.slice(0, 7)]; if (!m) return;
      m.min += v.total; m.nVen++;
      v.items.forEach((i) => {
        const pid = i.productoId || (i.articuloId?.startsWith('e-') ? i.articuloId.slice(2) : null);
        if (pid) sumarProd(pid, i.nombre, i.cantidad, i.subtotal, 'min');
        else { const x = (reventa[i.nombre] ||= { q: 0, total: 0, unidad: i.unidad }); x.q = r3(x.q + i.cantidad); x.total += i.subtotal; }
      });
    });
    datos.mermas.forEach((mm) => { const m = porMes[mm.dia.slice(0, 7)]; if (m) m.merma += mm.valor || 0; });
    // Consumo de insumos por mes: salidas por producción
    const consumo = {};
    datos.movimientos.filter((mv) => mv.cantidad < 0 && /^Producción/i.test(mv.motivo || '')).forEach((mv) => {
      const mes = aDia(mv.fecha).slice(0, 7); if (!porMes[mes]) return;
      (consumo[mv.insumoId] ||= {}); consumo[mv.insumoId][mes] = r3((consumo[mv.insumoId][mes] || 0) - mv.cantidad);
    });
    const totMay = lista.reduce((s, k) => s + porMes[k].may, 0);
    const totMin = lista.reduce((s, k) => s + porMes[k].min, 0);
    return {
      lista, porMes, totMay, totMin, total: totMay + totMin, consumo,
      nPed: entregados.filter((p) => p.tipoCliente !== 'minorista').length, nVen: ventas.length,
      merma: lista.reduce((s, k) => s + porMes[k].merma, 0),
      prods: Object.entries(prods).map(([pid, x]) => ({ pid, ...x, nombre: productosPorId[pid]?.nombre || x.nombre })).sort((a, b) => b.total - a.total),
      reventa: Object.entries(reventa).map(([nombre, x]) => ({ nombre, ...x })).sort((a, b) => b.total - a.total),
      entregados, ventas,
    };
  }, [datos, desde, T, productosPorId]);

  const exportar = () => {
    const i = (id) => insumosPorId[id] || { nombre: id, unidad: '' };
    descargarExcel(`reportes-el-sol-${T}`, [
      { nombre: 'Ventas por mes', filas: [['Mes', 'Mayoristas ($)', 'Minoristas ($)', 'Total ($)', '% mayorista', 'Pedidos mayoristas', 'Ventas del despacho', 'Mermas ($)'], ...r.lista.map((k) => { const m = r.porMes[k]; const t = m.may + m.min; return [k, m.may, m.min, t, t ? Math.round((m.may / t) * 100) : 0, m.nPed, m.nVen, m.merma]; })] },
      { nombre: 'Productos', filas: [['Producto', 'Unidades a mayoristas', 'Unidades a minoristas', 'Total ($)'], ...r.prods.map((p) => [p.nombre, p.may, p.min, p.total])] },
      { nombre: 'Reventa', filas: [['Artículo', 'Cantidad', 'Unidad', 'Total ($)'], ...r.reventa.map((x) => [x.nombre, x.q, x.unidad === 'kg' ? 'kg' : 'u', x.total])] },
      { nombre: 'Consumo de insumos', filas: [['Insumo', 'Unidad', ...r.lista], ...Object.entries(r.consumo).map(([id, pm]) => [i(id).nombre, i(id).unidad, ...r.lista.map((k) => pm[k] || 0)])] },
      { nombre: 'Pedidos entregados', filas: [['Número', 'Entrega', 'Cliente', 'Tipo', 'Canal', 'Pago', 'Total ($)'], ...r.entregados.map((p) => [p.numero, p.entrega, p.clienteNombre, p.tipoCliente || 'mayorista', p.canal, p.pago, p.total])] },
      { nombre: 'Ventas del despacho', filas: [['Día', 'Número', 'Pago', 'Artículos', 'Total ($)'], ...r.ventas.map((v) => [v.dia, v.numero, v.pago, v.items.map((x) => `${x.cantidad} ${x.nombre}`).join(' · '), v.total])] },
    ]);
  };

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row"><span className="lbl">Período</span><div className="tabs">{RANGOS.map(([k, l]) => <button key={k} aria-pressed={meses === k} onClick={() => setMeses(k)}>{l}</button>)}</div></div>
        <button className="btn" disabled={!r} onClick={exportar}>Exportar a Excel</button>
      </div>
      {error && <div className="note bad">No se pudieron leer los datos ({error}).</div>}
      {!r ? <section className="card"><Vacio>{error ? 'Sin datos' : 'Calculando…'}</Vacio></section> : (
        <>
          <div className="kpis">
            <div className="kpi"><span className="t">Vendido en el período</span><span className="v">{money(r.total)}</span><span className="s">{r.nPed} pedidos mayoristas · {r.nVen} ventas del despacho</span></div>
            <div className="kpi"><span className="t">Mayoristas</span><span className="v">{r.total ? Math.round((r.totMay / r.total) * 100) : 0} %</span><span className="s">{money(r.totMay)}</span></div>
            <div className="kpi"><span className="t">Minoristas (despacho y reservas)</span><span className="v">{r.total ? Math.round((r.totMin / r.total) * 100) : 0} %</span><span className="s">{money(r.totMin)}</span></div>
            <div className={`kpi ${r.merma ? 'alert' : ''}`}><span className="t">Pérdida por mermas</span><span className="v">{money(r.merma)}</span><span className="s">{r.total ? ((r.merma / r.total) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) : 0} % de lo vendido</span></div>
          </div>
          <section className="card">
            <div className="card-h"><h2>Ventas por mes</h2><div className="legend"><span style={{ '--c': 'var(--verde)' }}>Mayoristas</span><span style={{ '--c': 'var(--serie2)' }}>Minoristas</span></div></div>
            <Barras datos={r.lista.map((k) => ({ k, label: mesCorto(k), valores: [r.porMes[k].may, r.porMes[k].min] }))} colores={['var(--verde)', 'var(--serie2)']} formato={(v) => (v >= 1e6 ? `$${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M` : `$${Math.round(v / 1000)} mil`)} />
          </section>
          <div className="grid2">
            <section className="card">
              <div className="card-h"><h2>Productos más vendidos</h2><span className="muted small">unidades · facturado</span></div>
              {r.prods.length ? <Ranking filas={r.prods.slice(0, 8).map((p) => ({ k: p.pid, nombre: p.nombre, valor: p.total, detalle: `${p.may + p.min} u (${p.may} mayorista · ${p.min} minorista)` }))} /> : <Vacio>Sin ventas en el período.</Vacio>}
            </section>
            <section className="card">
              <div className="card-h"><h2>Reventa más vendida</h2><span className="muted small">lácteos, bebidas, fiambres…</span></div>
              {r.reventa.length ? <Ranking color="var(--serie2)" filas={r.reventa.slice(0, 8).map((x) => ({ k: x.nombre, nombre: x.nombre, valor: x.total, detalle: x.unidad === 'kg' ? `${x.q.toLocaleString('es-AR')} kg` : `${x.q} u` }))} /> : <Vacio>Sin ventas de reventa en el período.</Vacio>}
            </section>
          </div>
          <section className="card">
            <div className="card-h"><h2>Consumo de insumos por mes</h2>
              <select value={insumo} onChange={(e) => setInsumo(e.target.value)} aria-label="Insumo">{insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></div>
            {r.consumo[insumo]
              ? <Barras datos={r.lista.map((k) => ({ k, label: mesCorto(k), valores: [r.consumo[insumo][k] || 0] }))} colores={['var(--verde)']} formato={(v) => `${Math.round(v).toLocaleString('es-AR')} ${insumosPorId[insumo]?.unidad || ''}`} />
              : <Vacio>No hay consumo registrado de {insumosPorId[insumo]?.nombre || 'este insumo'} en el período.</Vacio>}
            <p className="muted small" style={{ margin: '8px 0 0' }}>Sale de lo que se descontó del stock al terminar cada orden de producción.</p>
          </section>
        </>
      )}
    </>
  );
}

/** Barras verticales (apiladas si hay dos series). */
function Barras({ datos, colores, formato }) {
  const max = Math.max(1, ...datos.map((d) => d.valores.reduce((a, b) => a + b, 0)));
  const W = Math.max(1000, datos.length * 80); const H = 260; const L = 8; const B = 30; const Tp = 24; const bw = (W - L) / datos.length;
  const y = (v) => H - B - (v / max) * (H - B - Tp);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 600 }} role="img" aria-label="Gráfico de barras por mes">
        <line x1={L} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line-2)" />
        {datos.map((d, i) => {
          const x = L + i * bw + bw * 0.22; const w = bw * 0.56; let acc = 0;
          const tot = d.valores.reduce((a, b) => a + b, 0);
          return (
            <g key={d.k}>
              {d.valores.map((v, j) => { const y0 = y(acc); acc += v; const y1 = y(acc); return v > 0 ? <rect key={j} className="bar" style={{ animationDelay: `${i * 0.04}s` }} x={x} y={y1} width={w} height={Math.max(0, y0 - y1)} fill={colores[j]} rx="2" /> : null; })}
              {tot > 0 && <text x={x + w / 2} y={y(tot) - 6} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>{formato(tot)}</text>}
              <text x={x + w / 2} y={H - 9} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Ranking({ filas, color = 'var(--verde)' }) {
  const max = filas[0]?.valor || 1;
  return (
    <div className="list">{filas.map((f) => (
      <div className="li" key={f.k} style={{ alignItems: 'center' }}><div className="body">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{f.nombre}</span><span className="num">{money(f.valor)}</span></div>
        <div className="meter" style={{ width: '100%', marginTop: 5 }}><i style={{ width: `${(f.valor / max) * 100}%`, background: color }} /></div>
        <div className="muted small" style={{ marginTop: 3 }}>{f.detalle}</div>
      </div></div>
    ))}</div>
  );
}
