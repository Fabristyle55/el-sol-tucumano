// Proceso programado: todas las noches (20:00 de Argentina) genera los pedidos fijos
// con entrega al día siguiente. Netlify lo ejecuta solo; no se puede llamar desde afuera.
import { generarFijos } from '../lib/pedidos-fijos.mjs';
import { fechaAR } from '../../shared/negocio.js';

export default async () => {
  try {
    const r = await generarFijos(fechaAR(1));
    console.log('Pedidos fijos:', r);
    return new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 500 });
  }
};

export const config = { schedule: '0 23 * * *' };
