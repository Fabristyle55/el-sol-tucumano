import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useData } from '../data';
import { Pill, useAccion } from '../ui';
import { dLarga, estadoDe, fq, hoy, money, sumarDias } from '../util';
import { explotar, totalesPorProducto } from '../../shared/negocio.js';

const NOTA = 'Recorrido de demostración';
const ORDEN = ['pendiente', 'confirmado', 'produccion', 'listo', 'entregado'];

/**
 * Modo presentación: hace un pedido de punta a punta con las funciones reales del sistema
 * (las mismas que usan el mostrador, el gerente y el panadero), paso a paso.
 */
export default function Recorrido() {
  const { pedidos, ordenes, clientes, productos, productosPorId, insumosPorId } = useData();
  const [ocupado, correr] = useAccion();
  const [log, setLog] = useState([]);
  const demo = pedidos.filter((p) => p.notas === NOTA && p.estado !== 'cancelado').sort((a, b) => b.numero - a.numero)[0] || null;
  const paso = !demo ? 0 : ORDEN.indexOf(demo.estado) + 1; // 0..5
  const ops = demo ? ordenes.filter((o) => (o.pedidos || []).includes(demo.id)) : [];
  const insumosDemo = demo ? explotar(totalesPorProducto([demo]), productosPorId) : {};
  const cliente = clientes.find((c) => c.id === 'c1') || clientes.find((c) => (c.tipo || 'mayorista') === 'mayorista');
  const anotar = (t) => setLog((l) => [{ t, k: Date.now() + Math.random() }, ...l].slice(0, 8));

  const acciones = {
    crear: async () => {
      const elegidos = productos.filter((p) => p.activo !== false && Object.keys(p.receta || {}).length).slice(0, 2);
      const r = await correr(() => api('crear-pedido', {
        clienteId: cliente?.id, entrega: sumarDias(hoy(), 2), pago: 'Efectivo', modoEntrega: 'envio', notas: NOTA,
        items: elegidos.map((p, k) => ({ productoId: p.id, cantidad: k ? 4 : 6 })),
      }), (x) => `Pedido #${x.numero} recibido`);
      if (r) anotar(`Se creó el pedido #${r.numero} de ${r.cliente} por ${money(r.total)}. Quedó pendiente de confirmación.`);
    },
    confirmar: async () => {
      const r = await correr(() => api('pedido-estado', { id: demo.id, accion: 'confirmar' }), 'Pedido confirmado');
      if (r) anotar(`El gerente confirmó el pedido #${demo.numero}. Ya cuenta en la proyección de stock y en la planificación.`);
    },
    planificar: async () => {
      const r = await correr(() => api('generar-ordenes', { fecha: demo.entrega, extra: {} }), (x) => `Se generaron ${x.ordenes} órdenes de producción`);
      if (r) anotar(`Se generaron ${r.ordenes} órdenes de producción para el ${dLarga(demo.entrega)} y se reservaron los insumos.`);
    },
    producir: async () => {
      const r = await correr(async () => {
        let n = 0;
        for (const o of ordenes.filter((x) => x.fecha === demo.entrega && x.estado !== 'terminada').sort((a, b) => a.numero - b.numero)) {
          if (o.estado === 'pendiente') await api('orden-estado', { id: o.id, accion: 'empezar' });
          await api('orden-estado', { id: o.id, accion: 'terminar' });
          n++;
        }
        return { n };
      }, (x) => `${x.n} órdenes terminadas`);
      if (r) anotar(`El panadero terminó ${r.n} órdenes: se descontaron los insumos del stock y el pedido quedó listo para reparto.`);
    },
    entregar: async () => {
      const r = await correr(() => api('pedido-estado', { id: demo.id, accion: 'entregar' }), 'Pedido entregado');
      if (r) anotar(`Se entregó el pedido #${demo.numero}. Queda en el historial y en los reportes de ventas.`);
    },
  };

  const PASOS = [
    { t: 'Llega un pedido', d: `Un comercio (${cliente?.nombre || 'cliente mayorista'}) pide pan por la web o el mostrador lo carga. Se calcula el precio mayorista y queda pendiente.`, accion: 'crear', boton: 'Crear el pedido de ejemplo', ver: '/pedidos?f=pendiente' },
    { t: 'El gerente lo confirma', d: 'Al confirmarlo, el pedido entra en la planificación y en la proyección de stock (las alertas de compra ya lo tienen en cuenta).', accion: 'confirmar', boton: 'Confirmar el pedido', ver: '/pedidos?f=confirmado' },
    { t: 'Se planifica la producción (MRP)', d: 'El sistema multiplica lo pedido por cada receta, calcula los insumos, controla que alcance el stock y genera una orden de producción por producto.', accion: 'planificar', boton: 'Generar las órdenes', ver: demo ? `/planificacion?d=${demo.entrega}` : '/planificacion' },
    { t: 'El panadero produce', d: 'El panadero empieza y termina cada orden. Al terminarlas se descuentan los insumos del stock y el pedido pasa a "listo para reparto".', accion: 'producir', boton: 'Producir y terminar las órdenes', ver: '/produccion' },
    { t: 'Sale a reparto y se entrega', d: 'Aparece en la hoja de reparto con la dirección y el monto a cobrar. Al entregarlo se cierra el circuito.', accion: 'entregar', boton: 'Marcar como entregado', ver: demo ? `/reparto?d=${demo.entrega}` : '/reparto' },
  ];

  return (
    <>
      <div className="note">Este recorrido usa las mismas funciones que el resto del sistema: los cambios son reales (stock, órdenes, historial). Sirve para mostrar en vivo cómo un pedido atraviesa todo el proceso.</div>
      <div className="recorrido">
        <div className="pasos">
          {PASOS.map((p, k) => {
            const estado = k < paso ? 'hecho' : k === paso ? 'actual' : 'falta';
            return (
              <section className={`paso ${estado}`} key={p.t}>
                <span className="paso-n">{k < paso ? '✓' : k + 1}</span>
                <div className="paso-body">
                  <div className="row" style={{ justifyContent: 'space-between' }}><h2>{p.t}</h2>{estado === 'hecho' && <Link className="linkbtn small" to={p.ver}>Ver en el sistema</Link>}</div>
                  <p className="muted">{p.d}</p>
                  {k === 2 && paso >= 2 && demo && (
                    <div className="row" style={{ gap: 6 }}>{Object.entries(insumosDemo).map(([iid, q]) => <span className="chip" key={iid}>{insumosPorId[iid]?.nombre}: {fq(q, insumosPorId[iid]?.unidad)} {insumosPorId[iid]?.unidad}</span>)}</div>
                  )}
                  {k === 3 && ops.length > 0 && <div className="row" style={{ gap: 6 }}>{ops.map((o) => <span className="chip" key={o.id}>OP-{o.numero} · {o.cantidad} {o.productoNombre} · {o.estado === 'terminada' ? 'terminada' : o.estado === 'en_curso' ? 'en curso' : 'por hacer'}</span>)}</div>}
                  {estado === 'actual' && <button className="btn primary" disabled={ocupado || (k > 0 && !demo)} onClick={acciones[p.accion]}>{ocupado ? 'Procesando…' : p.boton}</button>}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="card recorrido-lado">
          <div className="card-h"><h2>Pedido de ejemplo</h2>{demo && <Pill e={estadoDe(demo)} />}</div>
          {demo ? (
            <>
              <div className="lines">
                <div className="line"><span>Número</span><b className="num">#{demo.numero}</b></div>
                <div className="line"><span>Cliente</span><span>{demo.clienteNombre}</span></div>
                <div className="line"><span>Entrega</span><span>{dLarga(demo.entrega)}</span></div>
                {demo.items.map((i) => <div className="line" key={i.productoId}><span>{i.cantidad} × {i.nombre}</span><span className="num">{money(i.cantidad * i.precio)}</span></div>)}
              </div>
              <div className="total"><span>Total</span><span className="num">{money(demo.total)}</span></div>
              {paso >= 5 && <div className="note ok">Recorrido completo. <Link className="linkbtn" to={`/comprobante?tipo=pedido&id=${demo.id}`} target="_blank">Ver el remito</Link> · <Link className="linkbtn" to="/historial">Ver el historial</Link></div>}
              {paso >= 5 && <button className="btn" disabled={ocupado} onClick={acciones.crear}>Empezar otro recorrido</button>}
            </>
          ) : <p className="muted small" style={{ margin: 0 }}>Todavía no empezaste. Tocá "Crear el pedido de ejemplo".</p>}
          {log.length > 0 && <div className="list" style={{ marginTop: 12 }}>{log.map((l) => <div className="li small" key={l.k}><div className="body">{l.t}</div></div>)}</div>}
        </aside>
      </div>
    </>
  );
}
