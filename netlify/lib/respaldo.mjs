// Respaldo de la base de datos: copia todas las colecciones de Firestore a un archivo JSON
// guardado en Netlify Blobs (almacén "respaldos"). Se conservan los últimos MAX_RESPALDOS.
import { getStore } from '@netlify/blobs';
import { db } from './servidor.mjs';
import { fechaAR } from '../../shared/negocio.js';

export const COLECCIONES = [
  'usuarios', 'clientes', 'productos', 'insumos', 'pedidos', 'ordenes', 'compras', 'movimientos', 'actividad',
  'opiniones', 'articulos', 'ventas', 'movDespacho', 'cierres', 'mermas', 'movCuenta', 'pedidosFijos', 'promos', 'contadores',
];
const MAX_RESPALDOS = 12;
export const almacen = () => getStore({ name: 'respaldos', consistency: 'strong' });

// Las fechas de Firestore (Timestamp) se guardan como texto ISO para que el JSON se pueda leer.
const plano = (v) => {
  if (v && typeof v.toDate === 'function') return { _fecha: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(plano);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plano(x)]));
  return v;
};

export async function crearRespaldo(origen = 'automático') {
  const base = db();
  const datos = {};
  const conteo = {};
  for (const c of COLECCIONES) {
    const snap = await base.collection(c).get();
    datos[c] = Object.fromEntries(snap.docs.map((d) => [d.id, plano(d.data())]));
    conteo[c] = snap.size;
  }
  const fecha = new Date().toISOString();
  const clave = `respaldo-${fechaAR(0)}-${fecha.slice(11, 19).replace(/:/g, '')}`;
  const json = JSON.stringify({ sistema: 'El Sol Siciliano', fecha, origen, conteo, datos });
  const store = almacen();
  const total = Object.values(conteo).reduce((a, b) => a + b, 0);
  await store.set(clave, json, { metadata: { fecha, origen, documentos: total, bytes: json.length } });

  // Borra los más viejos.
  const { blobs } = await store.list();
  const viejos = blobs.map((b) => b.key).sort().reverse().slice(MAX_RESPALDOS);
  for (const k of viejos) await store.delete(k);
  return { clave, fecha, documentos: total, bytes: json.length, conteo };
}

export async function listarRespaldos() {
  const store = almacen();
  const { blobs } = await store.list();
  const out = [];
  for (const b of blobs) {
    const m = await store.getMetadata(b.key);
    out.push({ clave: b.key, ...(m?.metadata || {}) });
  }
  return out.sort((a, b) => b.clave.localeCompare(a.clave));
}
