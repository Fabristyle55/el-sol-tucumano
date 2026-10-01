// Proceso programado: todos los domingos a las 3:00 de Argentina hace un respaldo
// completo de la base de datos. Netlify lo ejecuta solo; no se puede llamar desde afuera.
import { crearRespaldo } from '../lib/respaldo.mjs';

export default async () => {
  try {
    const r = await crearRespaldo('automático');
    console.log('Respaldo creado:', r.clave, r.documentos, 'documentos');
    return new Response(JSON.stringify({ clave: r.clave, documentos: r.documentos }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 500 });
  }
};

export const config = { schedule: '0 6 * * 0' };
