// Promociones por cantidad y cupones de descuento.
//   crear / activar / pausar / borrar → solo el gerente
//   validar → cualquier usuario con sesión: revisa un código de cupón antes de confirmar el pedido
// El descuento real se calcula siempre en crear-pedido, con los datos de la base.
import { db, endpoint, HttpError, FieldValue, registrar, texto } from '../lib/servidor.mjs';
import { esFecha, fechaAR, promoVigente, codigoCupon } from '../../shared/negocio.js';

const PARA = ['mayorista', 'minorista', 'todos'];

export default endpoint(['gerente', 'mostrador', 'cliente'], async (b, yo) => {
  const base = db();

  if (b.accion === 'validar') {
    const codigo = codigoCupon(b.codigo);
    if (!codigo) throw new HttpError(400, 'Escribí el código del cupón.');
    const s = await base.doc(`promos/cupon-${codigo}`).get();
    const c = s.exists ? s.data() : null;
    const tipo = yo.rol === 'cliente' ? (yo.tipoCliente || 'mayorista') : (b.tipoCliente === 'minorista' ? 'minorista' : 'mayorista');
    if (!c) throw new HttpError(404, 'Ese cupón no existe. Revisá que esté bien escrito.');
    if (!promoVigente(c, tipo, fechaAR(0))) throw new HttpError(409, c.para && c.para !== 'todos' && c.para !== tipo ? `Ese cupón es solo para clientes ${c.para}s.` : 'Ese cupón ya no está vigente.');
    return { codigo, pct: c.pct, minimo: c.minimo || 0, para: c.para || 'todos', vence: c.vence || null, nombre: c.nombre || '' };
  }

  if (yo.rol !== 'gerente') throw new HttpError(403, 'Solo el gerente maneja las promociones.');

  if (b.accion === 'crear') {
    const tipo = b.tipo === 'cupon' ? 'cupon' : 'cantidad';
    const pct = Math.round(Number(b.pct));
    if (!(pct >= 1 && pct <= 50)) throw new HttpError(400, 'El descuento tiene que ser de 1 a 50 %.');
    const para = PARA.includes(b.para) ? b.para : (tipo === 'cantidad' ? 'mayorista' : 'todos');
    const vence = esFecha(b.vence) ? b.vence : null;
    if (vence && vence < fechaAR(0)) throw new HttpError(400, 'La fecha de vencimiento ya pasó.');
    let ref; let datos;
    if (tipo === 'cantidad') {
      const minimo = Math.floor(Number(b.minimo));
      if (!(minimo >= 2 && minimo <= 10000)) throw new HttpError(400, 'La cantidad mínima tiene que ser de 2 o más unidades.');
      let productoId = null; let productoNombre = 'Todos los productos';
      if (b.productoId) {
        const p = await base.doc(`productos/${texto(b.productoId, 60)}`).get();
        if (!p.exists) throw new HttpError(400, 'El producto elegido no existe.');
        productoId = p.id; productoNombre = p.data().nombre;
      }
      ref = base.collection('promos').doc();
      datos = { tipo, productoId, productoNombre, minimo, pct, para, vence, nombre: texto(b.nombre, 60) || `${pct}% llevando ${minimo} o más` };
    } else {
      const codigo = codigoCupon(b.codigo);
      if (codigo.length < 3) throw new HttpError(400, 'El código tiene que tener al menos 3 letras o números.');
      ref = base.doc(`promos/cupon-${codigo}`);
      if ((await ref.get()).exists) throw new HttpError(409, 'Ya existe un cupón con ese código.');
      const minimo = Math.max(0, Math.round(Number(b.minimo) || 0));
      const usosMax = Math.max(0, Math.floor(Number(b.usosMax) || 0));
      datos = { tipo, codigo, pct, para, vence, minimo, usosMax, usos: 0, nombre: texto(b.nombre, 60) || `Cupón ${codigo}` };
    }
    await base.runTransaction(async (t) => {
      t.set(ref, { ...datos, activo: true, creado: FieldValue.serverTimestamp(), creadoPor: yo.nombre || yo.email });
      registrar(t, yo, `Creó ${tipo === 'cupon' ? `el cupón ${datos.codigo}` : 'la promoción'} "${datos.nombre}" (${pct}% de descuento)`);
    });
    return { id: ref.id };
  }

  const ref = base.doc(`promos/${texto(b.id, 80)}`);
  const s = await ref.get();
  if (!s.exists) throw new HttpError(404, 'La promoción no existe.');
  const nombre = s.data().nombre;
  if (b.accion === 'activar' || b.accion === 'pausar') {
    await base.runTransaction(async (t) => {
      t.update(ref, { activo: b.accion === 'activar' });
      registrar(t, yo, `${b.accion === 'activar' ? 'Activó' : 'Pausó'} la promoción "${nombre}"`);
    });
    return { ok: true };
  }
  if (b.accion === 'borrar') {
    await base.runTransaction(async (t) => {
      t.delete(ref);
      registrar(t, yo, `Borró la promoción "${nombre}"`);
    });
    return { ok: true };
  }
  throw new HttpError(400, 'Acción desconocida.');
});
