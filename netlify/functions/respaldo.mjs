// Respaldos de la base de datos (solo el gerente).
//   listar    → respaldos guardados (el automático corre todos los domingos)
//   crear     → hace un respaldo ahora
//   descargar → devuelve el contenido de un respaldo para bajarlo como archivo .json
import { endpoint, HttpError, db, registrar } from '../lib/servidor.mjs';
import { almacen, crearRespaldo, listarRespaldos } from '../lib/respaldo.mjs';

export default endpoint(['gerente'], async (b, yo) => {
  if (b.accion === 'listar') return { respaldos: await listarRespaldos() };

  if (b.accion === 'crear') {
    const r = await crearRespaldo(`manual (${yo.nombre || yo.email})`);
    const base = db();
    await base.runTransaction(async (t) => registrar(t, yo, `Hizo un respaldo de la base de datos (${r.documentos} documentos)`));
    return { clave: r.clave, documentos: r.documentos, bytes: r.bytes };
  }

  if (b.accion === 'descargar') {
    const clave = String(b.clave || '');
    if (!/^respaldo-[\d-]+$/.test(clave)) throw new HttpError(400, 'Respaldo inválido.');
    const json = await almacen().get(clave, { type: 'text' });
    if (!json) throw new HttpError(404, 'Ese respaldo ya no existe.');
    return { clave, contenido: json };
  }

  throw new HttpError(400, 'Acción desconocida.');
});
