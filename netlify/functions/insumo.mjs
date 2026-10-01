// Costo de los insumos (solo el gerente). Se usa para calcular el costo y el margen de cada producto.
import { db, endpoint, HttpError, registrar, texto } from '../lib/servidor.mjs';

export default endpoint(['gerente'], async (b, yo) => {
  const costo = Math.round(Number(b.costo) * 100) / 100;
  if (!(costo >= 0) || costo > 10_000_000) throw new HttpError(400, 'Ingresá un costo válido.');
  const base = db();
  const ref = base.doc(`insumos/${texto(b.insumoId, 60)}`);
  return base.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists) throw new HttpError(404, 'El insumo no existe.');
    const i = s.data();
    t.update(ref, { costo });
    registrar(t, yo, `Actualizó el costo de ${i.nombre}: $${costo.toLocaleString('es-AR')} por ${i.unidad}`);
    return { costo };
  });
});
