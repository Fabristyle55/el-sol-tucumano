// Entrega una imagen de producto guardada en Netlify Blobs. Es pública (las ve el catálogo).
import { getStore } from '@netlify/blobs';

export default async (req) => {
  const k = new URL(req.url).searchParams.get('k') || '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(k)) return new Response('No encontrada', { status: 404 });
  const r = await getStore({ name: 'productos', consistency: 'strong' }).getWithMetadata(k, { type: 'arrayBuffer' });
  if (!r) return new Response('No encontrada', { status: 404 });
  return new Response(r.data, {
    headers: {
      'Content-Type': r.metadata?.contentType || 'image/jpeg',
      // La clave cambia con cada imagen nueva, así que se puede guardar en caché para siempre.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
