// Cuenta corriente de los comercios mayoristas (solo el gerente).
//   pago  → registra un pago del cliente y baja el saldo
//   plazo → cambia los días de plazo antes de considerar la deuda vencida
import { db, endpoint, HttpError, FieldValue, registrar, texto } from '../lib/servidor.mjs';
import { fechaAR, PAGOS_DESPACHO } from '../../shared/negocio.js';

export default endpoint(['gerente'], async (b, yo) => {
  const base = db();
  const ref = base.doc(`clientes/${texto(b.clienteId, 60)}`);

  if (b.accion === 'pago') {
    const monto = Math.round(Number(b.monto));
    if (!(monto > 0)) throw new HttpError(400, 'Ingresá el monto que pagó el cliente.');
    const medio = PAGOS_DESPACHO.includes(b.medio) ? b.medio : 'Efectivo';
    return base.runTransaction(async (t) => {
      const s = await t.get(ref);
      if (!s.exists) throw new HttpError(404, 'El cliente no existe.');
      const c = s.data();
      const saldo = Math.round(c.saldo || 0) - monto;
      t.update(ref, { saldo, ...(saldo <= 0 ? { deudaDesde: FieldValue.delete() } : {}) });
      t.set(base.collection('movCuenta').doc(), {
        clienteId: s.id, clienteUid: c.uid || null, clienteNombre: c.nombre, tipo: 'pago', monto, medio,
        detalle: texto(b.nota, 120) || `Pago en ${medio.toLowerCase()}`, saldo, dia: fechaAR(0), fecha: FieldValue.serverTimestamp(), usuario: yo.nombre || yo.email,
      });
      registrar(t, yo, `Registró un pago de $${monto.toLocaleString('es-AR')} de ${c.nombre} (cuenta corriente)`);
      return { saldo };
    });
  }

  if (b.accion === 'plazo') {
    const plazoDias = Math.round(Number(b.plazoDias));
    if (!(plazoDias >= 1 && plazoDias <= 90)) throw new HttpError(400, 'El plazo tiene que ser de 1 a 90 días.');
    const s = await ref.get();
    if (!s.exists) throw new HttpError(404, 'El cliente no existe.');
    await ref.update({ plazoDias });
    await base.runTransaction(async (t) => registrar(t, yo, `Cambió el plazo de cuenta corriente de ${s.data().nombre} a ${plazoDias} días`));
    return { plazoDias };
  }

  throw new HttpError(400, 'Acción desconocida.');
});
