// Pedidos fijos de los mayoristas: cada comercio puede dejar armado lo que pide
// ciertos días de la semana. Todos los días a la noche se generan los pedidos del
// día siguiente como "pendientes" (el gerente los confirma igual que cualquier otro).
import { db, FieldValue, registrar, siguienteNumero } from './servidor.mjs';
import { diaSemana, precioPara } from '../../shared/negocio.js';

const SISTEMA = { nombre: 'Sistema (pedidos fijos)', rol: null };

/** Genera los pedidos fijos con entrega en la fecha indicada. No duplica si ya existen. */
export async function generarFijos(fecha) {
  const base = db();
  const dia = diaSemana(fecha);
  const fijos = (await base.collection('pedidosFijos').where('activo', '==', true).get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((f) => Array.isArray(f.dias) && f.dias.includes(dia) && f.items?.length);
  let creados = 0; let fallidos = 0;
  for (const f of fijos) {
    let ok = false;
    try { ok = await base.runTransaction(async (t) => {
      const ref = base.doc(`pedidos/fijo_${f.clienteId}_${fecha}`);
      if ((await t.get(ref)).exists) return false;
      const cs = await t.get(base.doc(`clientes/${f.clienteId}`));
      if (!cs.exists) return false;
      const c = cs.data();
      const ps = await t.getAll(...f.items.map((i) => base.doc(`productos/${i.productoId}`)));
      const num = await siguienteNumero(t, 'pedidos', 1000);
      const items = f.items.map((i, k) => (ps[k].exists && ps[k].data().activo !== false
        ? { productoId: i.productoId, nombre: ps[k].data().nombre, cantidad: i.cantidad, precio: precioPara(ps[k].data(), 'mayorista') } : null)).filter(Boolean);
      if (!items.length) return false;
      t.set(ref, {
        numero: num.valor, clienteId: f.clienteId, clienteUid: c.uid || null, clienteNombre: c.nombre,
        localidad: c.localidad || '', direccion: c.direccion || '', telefono: c.telefono || '',
        tipoCliente: 'mayorista', modoEntrega: f.modoEntrega === 'retiro' ? 'retiro' : 'envio', canal: 'fijo', entrega: fecha, items,
        total: Math.round(items.reduce((a, i) => a + i.cantidad * i.precio, 0)), pago: f.pago || 'Efectivo', notas: 'Pedido fijo',
        estado: 'pendiente', creado: FieldValue.serverTimestamp(), creadoPor: SISTEMA.nombre,
      });
      num.guardar();
      registrar(t, SISTEMA, `Pedido fijo #${num.valor} de ${c.nombre} para el ${fecha.split('-').reverse().join('/')}`);
      return true;
    }); } catch (e) { fallidos++; console.error(`Pedido fijo de ${f.clienteId}:`, e.message); }
    if (ok) creados++;
  }
  return { creados, fallidos, revisados: fijos.length, fecha };
}
