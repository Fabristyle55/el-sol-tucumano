import { Link } from 'react-router-dom';
import { useData } from '../data';
import { cuando, dRel, dShort, fq, hoy, manana, money, sumarDias } from '../util';
import { proyeccion, vaAProduccion } from '../../shared/negocio.js';
import { Contador } from '../ui';

const COL = { warn: 'var(--warn)', info: 'var(--info)', bad: 'var(--bad)', ok: 'var(--ok)' };

export default function Panel() {
  const d = useData();
  const M = manana();
  const pm = d.pedidos.filter((o) => o.entrega === M && o.estado !== 'cancelado' && vaAProduccion(o));
  const T0 = hoy();
  const ventasHoy = d.ventas.filter((v) => v.dia === T0 && !v.anulada);
  const totalDespacho = ventasHoy.reduce((s, v) => s + v.total, 0);
  const bajosDespacho = d.articulos.filter((a) => a.activo !== false && (a.stock || 0) < (a.minimo || 0));
  const pend = d.pedidos.filter((o) => o.estado === 'pendiente').sort((a, b) => a.numero - b.numero);
  const ops = d.ordenes.filter((o) => o.estado !== 'terminada');
  const al = proyeccion({ insumos: d.insumos, ordenes: d.ordenes, pedidos: d.pedidos, compras: d.compras, productosPorId: d.productosPorId }).filter((i) => i.alerta);
  const listos = d.pedidos.filter((o) => o.estado === 'listo' && vaAProduccion(o));
  const sinPlan = d.pedidos.filter((o) => o.estado === 'confirmado');
  const enCamino = d.compras.filter((c) => c.estado === 'autorizada').length;

  const attn = [];
  pend.forEach((o) => attn.push(['warn', `Pedido #${o.numero} de ${o.clienteNombre} espera tu confirmación`, `${o.tipoCliente === 'minorista' ? 'Minorista' : 'Mayorista'} · ${o.canal === 'web' ? 'Web' : 'Mostrador'} · ${o.modoEntrega === 'retiro' ? 'retira' : 'entrega'} ${dRel(o.entrega).toLowerCase()} · ${money(o.total)}`, '/pedidos?f=pendiente', 'Revisar']));
  if (sinPlan.length) {
    const ds = [...new Set(sinPlan.map((o) => o.entrega))].sort();
    attn.push(['info', `${sinPlan.length} pedidos confirmados sin orden de producción`, `Entregas: ${ds.map(dRel).join(', ').toLowerCase()}`, `/planificacion?d=${ds[0]}`, 'Planificar']);
  }
  al.forEach((i) => attn.push(['bad', `${i.nombre} va a quedar debajo del stock de seguridad`, `Proyectado ${fq(i.proyectado, i.unidad)} ${i.unidad} · seguridad ${fq(i.seguridad, i.unidad)} ${i.unidad}`, '/compras', 'Ver compra']));
  if (bajosDespacho.length) attn.push(['warn', `${bajosDespacho.length} artículos del despacho con poco stock`, bajosDespacho.slice(0, 3).map((a) => a.nombre).join(', ') + (bajosDespacho.length > 3 ? '…' : ''), '/despacho?t=stock', 'Ver']);
  if (listos.length) attn.push(['ok', `${listos.length} pedidos listos para salir a reparto`, listos.slice(0, 3).map((o) => o.clienteNombre).join(', ') + (listos.length > 3 ? '…' : ''), '/pedidos?f=listo', 'Ver']);

  return (
    <>
      <div className="kpis">
        <Link className="kpi" to="/pedidos"><span className="t">Pedidos para mañana</span><span className="v"><Contador valor={pm.length} /></span><span className="s"><Contador valor={pm.reduce((a, o) => a + o.total, 0)} formato={money} /> en pedidos mayoristas</span></Link>
        <Link className="kpi" to="/pedidos?f=pendiente"><span className="t">Por confirmar</span><span className="v"><Contador valor={pend.length} /></span><span className="s">{pend.filter((o) => o.canal === 'web').length} web · {pend.filter((o) => o.canal === 'mostrador').length} mostrador</span></Link>
        <Link className="kpi" to="/produccion"><span className="t">Órdenes de producción abiertas</span><span className="v"><Contador valor={ops.length} /></span><span className="s">{ops.filter((o) => o.estado === 'en_curso').length} en curso</span></Link>
        <Link className="kpi" to="/despacho?t=ventas"><span className="t">Vendido hoy en el despacho</span><span className="v"><Contador valor={totalDespacho} formato={money} /></span><span className="s">{ventasHoy.length} ventas</span></Link>
        <Link className={`kpi ${al.length ? 'alert' : ''}`} to="/compras"><span className="t">Insumos en alerta</span><span className="v"><Contador valor={al.length} /></span><span className="s">{enCamino} compras en camino</span></Link>
      </div>
      <div className="grid32">
        <section className="card">
          <div className="card-h"><h2>Requiere tu atención</h2><span className="muted small">{attn.length} temas</span></div>
          {attn.length ? (
            <div className="attn-list">{attn.map(([c, t, s, to, b], k) => (
              <div className="attn" key={k}><span className="stripe" style={{ background: COL[c] }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 500 }}>{t}</div><div className="muted small">{s}</div></div>
                <Link className="btn sm" to={to}>{b}</Link></div>
            ))}</div>
          ) : <div className="empty">Todo en orden por ahora.</div>}
        </section>
        <section className="card">
          <div className="card-h"><h2>Pedidos por día de entrega</h2><div className="legend"><span style={{ '--c': 'var(--verde)' }}>Web</span><span style={{ '--c': 'var(--rojo)' }}>Mostrador</span></div></div>
          <Grafico pedidos={d.pedidos} />
        </section>
      </div>
      <div className="grid2">
        <section className="card"><div className="card-h"><h2>Más pedidos esta semana</h2><span className="muted small">unidades</span></div><Top pedidos={d.pedidos} /></section>
        <section className="card"><div className="card-h"><h2>Actividad reciente</h2><span className="muted small">trazabilidad</span></div>
          <div className="list">
            {d.actividad.slice(0, 8).map((l) => (
              <div className="li" key={l.id}><span className="when">{cuando(l.fecha)}</span>
                <div className="body"><div>{l.texto}</div><div className="small muted" style={{ marginTop: 2 }}>{l.usuario} · {l.rol}</div></div></div>
            ))}
            {!d.actividad.length && <div className="empty">Todavía no hay actividad.</div>}
          </div>
        </section>
      </div>
    </>
  );
}

function Grafico({ pedidos }) {
  const T = hoy(); const M = manana();
  const dias = []; for (let k = -6; k <= 1; k++) dias.push(sumarDias(T, k));
  const data = dias.map((dd) => {
    const os = pedidos.filter((o) => o.entrega === dd && o.estado !== 'cancelado');
    return { d: dd, w: os.filter((o) => o.canal === 'web').length, m: os.filter((o) => o.canal === 'mostrador').length };
  });
  const max = Math.max(4, ...data.map((x) => x.w + x.m)); const top = Math.ceil(max / 4) * 4;
  const W = 380; const H = 210; const L = 26; const B = 26; const Tp = 14; const bw = (W - L) / dias.length;
  const y = (v) => H - B - (v / top) * (H - B - Tp);
  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Pedidos por día de entrega">
          {[0, 1, 2, 3, 4].map((k) => { const v = (top * k) / 4; return <g key={k}><line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 8} y={y(v) + 4} textAnchor="end">{v}</text></g>; })}
          {data.map((x, i) => {
            const cx = L + i * bw + bw * 0.2; const w = bw * 0.6; const op = x.d > T ? 0.55 : 1;
            const lbl = x.d === T ? 'hoy' : x.d === M ? 'mañ.' : dShort(x.d).split(' ')[0].replace(',', '');
            return (
              <g key={x.d} opacity={op}>
                <rect className="bar" style={{ animationDelay: `${i * 0.06}s` }} x={cx} y={y(x.w)} width={w} height={y(0) - y(x.w)} fill="var(--verde)" rx="3" />
                <rect className="bar" style={{ animationDelay: `${i * 0.06 + 0.15}s` }} x={cx} y={y(x.w + x.m)} width={w} height={y(x.w) - y(x.w + x.m)} fill="var(--rojo)" rx="3" />
                <text x={cx + w / 2} y={y(x.w + x.m) - 5} textAnchor="middle" style={{ fill: 'var(--ink)' }}>{x.w + x.m}</text>
                <text x={cx + w / 2} y={H - 8} textAnchor="middle" style={x.d === T ? { fill: 'var(--ink)', fontWeight: 600 } : undefined}>{lbl}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="muted small" style={{ margin: '6px 0 0' }}>La barra de mañana es lo ya cargado; puede crecer hasta el cierre de pedidos.</p>
    </>
  );
}

function Top({ pedidos }) {
  const T = hoy(); const desde = sumarDias(T, -6); const m = {}; const nom = {};
  pedidos.filter((o) => o.entrega >= desde && o.entrega <= T && o.estado !== 'cancelado').forEach((o) => o.items.forEach((it) => { m[it.productoId] = (m[it.productoId] || 0) + it.cantidad; nom[it.productoId] = it.nombre; }));
  const arr = Object.entries(m).sort((a, b) => b[1] - a[1]); const mx = arr[0]?.[1] || 1;
  if (!arr.length) return <div className="empty">Sin entregas en los últimos 7 días.</div>;
  return (
    <div className="list">{arr.map(([pid, q]) => (
      <div className="li" key={pid} style={{ alignItems: 'center' }}><div className="body">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{nom[pid]}</span><span className="num">{q}</span></div>
        <div className="meter" style={{ width: '100%', marginTop: 5 }}><i style={{ width: `${(q / mx) * 100}%`, background: 'var(--verde)' }} /></div>
      </div></div>
    ))}</div>
  );
}
