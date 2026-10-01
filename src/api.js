// Llamadas al backend (Netlify Functions en Node.js) con el token del usuario.
import { auth } from './firebase';

export async function api(funcion, body = {}, { publico = false } = {}) {
  const u = auth.currentUser;
  if (!u && !publico) throw new Error('Iniciá sesión de nuevo.');
  const headers = { 'Content-Type': 'application/json' };
  if (u) headers.Authorization = `Bearer ${await u.getIdToken()}`;
  let res;
  try {
    res = await fetch(`/.netlify/functions/${funcion}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisá tu internet.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) throw new Error('No se encontró el servidor. ¿Iniciaste la app con "npm run dev" (netlify dev)?');
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}
