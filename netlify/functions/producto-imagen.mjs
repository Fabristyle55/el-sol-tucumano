// Imágenes de productos guardadas en Netlify Blobs (almacenamiento gratuito de Netlify).
// Lo usan el gerente y el mostrador para:
//  - subir: una foto ya comprimida en el navegador (data URL JPEG/PNG/WebP)
//  - url:   guardar la dirección de una imagen generada con IA (Pollinations) si no se pudo copiar
//  - quitar: volver al dibujo por defecto
import { getStore } from '@netlify/blobs';
import { db, endpoint, HttpError, FieldValue, registrar, texto } from '../lib/servidor.mjs';

const MAX_BYTES = 1.5 * 1024 * 1024;
const store = () => getStore({ name: 'productos', consistency: 'strong' });

export default endpoint(['gerente', 'mostrador'], async (b, yo) => {
  const base = db();
  const ref = base.doc(`productos/${texto(b.productoId, 60)}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'El producto no existe.');
  const p = snap.data();
  const anterior = p.imagen?.clave;

  let imagen = null;
  if (b.accion === 'subir') {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dataUrl || ''));
    if (!m) throw new HttpError(400, 'La imagen no es válida. Probá con una foto JPG o PNG.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > MAX_BYTES) throw new HttpError(413, 'La imagen es muy pesada. Probá con otra foto.');
    const clave = `${snap.id}-${Date.now()}`;
    await store().set(clave, buf, { metadata: { contentType: m[1] } });
    imagen = { url: `/.netlify/functions/imagen?k=${clave}`, clave, tipo: b.tipo === 'ia' ? 'ia' : 'foto' };
  } else if (b.accion === 'url') {
    const url = String(b.url || '');
    if (!url.startsWith('https://image.pollinations.ai/')) throw new HttpError(400, 'Dirección de imagen no permitida.');
    imagen = { url, clave: null, tipo: 'ia' };
  } else if (b.accion !== 'quitar') {
    throw new HttpError(400, 'Acción desconocida.');
  }

  await ref.update({ imagen: imagen ? { ...imagen, actualizada: FieldValue.serverTimestamp(), por: yo.nombre || yo.email } : FieldValue.delete() });
  if (anterior) await store().delete(anterior).catch(() => {});
  await base.runTransaction(async (t) => {
    registrar(t, yo, imagen ? `Cambió la imagen de ${p.nombre} (${imagen.tipo === 'ia' ? 'generada con IA' : 'foto'})` : `Quitó la imagen de ${p.nombre}`);
  });
  return { imagen };
});
