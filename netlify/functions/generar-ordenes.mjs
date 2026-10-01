// Planificación (MRP básico): toma los pedidos confirmados de un día de entrega,
// suma la producción extra para el local, calcula los insumos con las recetas,
// controla que alcance el stock y genera una orden de producción por producto.
import { db, endpoint, HttpError, FieldValue, registrar, siguienteNumero, notificar } from '../lib/servidor.mjs';
import { esFecha, totalesPorProducto, explotar, reservado, faltantes, vaAProduccion } from '../../shared/negocio.js';

export default endpoint(['gerente'], async (b, yo) => {
  if (!esFecha(b.fecha)) throw new HttpError(400, 'Fecha inválida.');
  const extra = {};
  for (const [pid, q] of Object.entries(b.extra || {})) {
    const n = Math.floor(Number(q));
    if (n > 0) extra[String(pid)] = n;
  }
  const base = db();
  const res = await base.runTransaction(async (t) => {
    // 1) Lecturas (Firestore exige leer todo antes de escribir)
    const pedSnap = await t.get(base.collection('pedidos').where('entrega', '==', b.fecha).where('estado', '==', 'confirmado'));
    const prodSnap = await t.get(base.collection('productos'));
    const insSnap = await t.get(base.collection('insumos'));
    const abiertas = await t.get(base.collection('ordenes').where('estado', 'in', ['pendiente', 'en_curso']));
    const num = await siguienteNumero(t, 'ordenes', 200);

    const productos = Object.fromEntries(prodSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
    const insumos = Object.fromEntries(insSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
    // Solo los pedidos mayoristas se producen por pedido; los minoristas salen del despacho.
    const pedidos = pedSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(vaAProduccion);

    // 2) Cálculo
    const totales = totalesPorProducto(pedidos);
    for (const [pid, q] of Object.entries(extra)) if (productos[pid]) totales[pid] = (totales[pid] || 0) + q;
    const ids = Object.keys(totales).filter((pid) => totales[pid] > 0);
    if (!ids.length) throw new HttpError(400, 'No hay pedidos confirmados ni producción extra para ese día.');
    const necesario = explotar(totales, productos);
    const falta = faltantes(necesario, insumos, reservado(abiertas.docs.map((d) => d.data())));
    if (falta.length) {
      throw new HttpError(409, `No alcanzan: ${falta.map((f) => `${f.nombre} (faltan ${f.falta} ${f.unidad})`).join(', ')}.`, { faltantes: falta });
    }

    // 3) Escrituras
    let n = num.valor;
    for (const pid of ids) {
      t.set(base.collection('ordenes').doc(), {
        numero: n++,
        fecha: b.fecha,
        productoId: pid,
        productoNombre: productos[pid]?.nombre || pid,
        cantidad: totales[pid],
        extra: extra[pid] || 0,
        insumos: explotar({ [pid]: totales[pid] }, productos),
        estado: 'pendiente',
        pedidos: pedidos.filter((p) => p.items.some((i) => i.productoId === pid)).map((p) => p.id),
        creada: FieldValue.serverTimestamp(),
        creadaPor: yo.nombre || yo.email,
      });
    }
    t.set(base.doc('contadores/ordenes'), { valor: n - 1 });
    for (const p of pedidos) t.update(base.doc(`pedidos/${p.id}`), { estado: 'produccion', produccionEn: FieldValue.serverTimestamp() });
    registrar(t, yo, `Generó ${ids.length} órdenes de producción para el ${b.fecha} (${pedidos.length} pedidos)`);
    return { ordenes: ids.length, pedidos: pedidos.length, fecha: b.fecha };
  });
  await notificar('ordenes_generadas', res);
  return res;
});
