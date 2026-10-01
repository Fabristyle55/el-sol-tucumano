// Utilidades del backend: conexión con Firebase Admin, autenticación de cada
// pedido HTTP, manejo de errores, registro de actividad y aviso a n8n.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function credenciales() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new HttpError(500, 'Faltan las variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en el servidor.');
  }
  return cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
}

let _app;
function app() {
  if (!_app) _app = getApps()[0] || initializeApp({ credential: credenciales() });
  return _app;
}
export const db = () => getFirestore(app());
export const adminAuth = () => getAuth(app());
export { FieldValue };

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

/**
 * Envuelve una función del backend:
 *  - solo acepta POST con un token de Firebase válido
 *  - carga el perfil del usuario (colección "usuarios") y controla el rol
 *  - convierte los errores en respuestas JSON con un mensaje legible
 * roles: lista de roles permitidos, null para cualquier usuario con sesión,
 *        o 'publico' para aceptar también pedidos sin sesión (yo = null).
 */
export function endpoint(roles, fn) {
  return async (req) => {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido');
      const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!token && roles === 'publico') {
        const body = await req.json().catch(() => ({}));
        return json((await fn(body || {}, null)) ?? { ok: true });
      }
      if (!token) throw new HttpError(401, 'Iniciá sesión para continuar.');
      let decoded;
      try { decoded = await adminAuth().verifyIdToken(token); }
      catch { throw new HttpError(401, 'Tu sesión venció. Volvé a iniciar sesión.'); }
      const snap = await db().doc(`usuarios/${decoded.uid}`).get();
      const yo = snap.exists
        ? { uid: decoded.uid, email: decoded.email, ...snap.data() }
        : { uid: decoded.uid, email: decoded.email, rol: null, nombre: decoded.email };
      if (Array.isArray(roles) && !roles.includes(yo.rol)) throw new HttpError(403, 'Tu usuario no tiene permiso para esta acción.');
      const body = await req.json().catch(() => ({}));
      const out = await fn(body || {}, yo);
      return json(out ?? { ok: true });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      return json({ error: e.status ? e.message : 'Error interno del servidor.', ...(e.extra || {}) }, status);
    }
  };
}

const ETIQUETA_ROL = { gerente: 'Gerente', mostrador: 'Mostrador', panadero: 'Panadero', deposito: 'Depósito', cliente: 'Cliente' };

/** Registra una línea en la bitácora de actividad (trazabilidad). */
export function registrar(t, yo, texto) {
  t.set(db().collection('actividad').doc(), {
    texto,
    usuario: yo.nombre || yo.email || 'Sistema',
    rol: ETIQUETA_ROL[yo.rol] || 'Sistema',
    fecha: FieldValue.serverTimestamp(),
  });
}

/** Próximo número correlativo (pedidos, órdenes, compras) dentro de una transacción. */
export async function siguienteNumero(t, nombre, inicial) {
  const ref = db().doc(`contadores/${nombre}`);
  const s = await t.get(ref);
  const valor = (s.exists ? s.data().valor : inicial) + 1;
  return { valor, guardar: () => t.set(ref, { valor }) };
}

/**
 * Aviso opcional a n8n (Etapa 1): si está configurada la variable N8N_WEBHOOK_URL,
 * se envía el evento para que n8n mande el Telegram o el mail correspondiente.
 * Si n8n no responde, la operación igual se completa.
 */
export async function notificar(evento, datos) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento, fecha: new Date().toISOString(), ...datos }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    console.warn('No se pudo avisar a n8n:', e.message);
  }
}

export const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);
