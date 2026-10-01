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

const ETIQUETA_ROL = { gerente: 'Gerente', mostrador: 'Mostrador', panadero: 'Panadero', deposito: 'Depósito', repartidor: 'Repartidor', cliente: 'Cliente' };

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

// ---------------------------------------------------------------------------
// Avisos por mail a los clientes (opcional).
// Se activan configurando en Netlify RESEND_API_KEY (cuenta gratis en resend.com)
// y MAIL_FROM (por ejemplo "El Sol Siciliano <pedidos@tudominio.com>").
// Sin esas variables no se envía nada y todo funciona igual.
// ---------------------------------------------------------------------------
export async function enviarMail({ para, asunto, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'El Sol Siciliano <onboarding@resend.dev>';
  if (!key || !para) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [para], subject: asunto, html }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.warn('No se pudo enviar el mail:', r.status, await r.text().catch(() => ''));
    return r.ok;
  } catch (e) {
    console.warn('No se pudo enviar el mail:', e.message);
    return false;
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pesos = (n) => '$' + Math.round(n || 0).toLocaleString('es-AR');
const cantTxt = (n, u) => (u === 'kg' ? `${n} kg` : `${n}`);

function plantilla(titulo, intro, pedido) {
  const filas = (pedido.items || []).map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(cantTxt(i.cantidad, i.unidad))} × ${esc(i.nombre)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${pesos(i.cantidad * i.precio)}</td></tr>`).join('');
  const sitio = process.env.URL || '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#121814">
  <div style="height:4px;background:linear-gradient(90deg,#167B41 0 33%,#fff 33% 66%,#C42A22 66%)"></div>
  <h2 style="margin:20px 0 6px">${esc(titulo)}</h2>
  <p style="margin:0 0 16px;color:#3a433d">${intro}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${filas}
  <tr><td style="padding:10px 0;font-weight:bold">Total</td><td style="padding:10px 0;text-align:right;font-weight:bold">${pesos(pedido.total)}</td></tr></table>
  ${sitio ? `<p style="margin:20px 0"><a href="${sitio}/mis-pedidos" style="background:#167B41;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Ver mis pedidos</a></p>` : ''}
  <p style="color:#69726c;font-size:12px;margin-top:24px">Panificación El Sol Siciliano · Tucumán</p></div>`;
}

/** Busca el mail del cliente de un pedido (ficha del cliente o su usuario web). */
async function mailDelCliente(p) {
  const base = db();
  if (p.clienteId) {
    const c = await base.doc(`clientes/${p.clienteId}`).get();
    if (c.exists && c.data().email) return c.data().email;
  }
  if (p.clienteUid) {
    const u = await base.doc(`usuarios/${p.clienteUid}`).get();
    if (u.exists && u.data().email) return u.data().email;
  }
  return null;
}

/** Aviso al cliente según el evento del pedido. Nunca hace fallar la operación. */
export async function avisarCliente(evento, pedido) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const para = await mailDelCliente(pedido);
    if (!para) return;
    const n = pedido.numero;
    const fecha = pedido.entrega ? pedido.entrega.split('-').reverse().join('/') : '';
    const textos = {
      recibido: [`Recibimos tu pedido #${n}`, `Hola ${esc(pedido.clienteNombre)}, recibimos tu pedido para el ${fecha}. Te avisamos cuando lo confirmemos.`],
      confirmado: [`Pedido #${n} confirmado`, `Tu pedido para el ${fecha} está confirmado y entra en la producción del día.`],
      reserva: [`Reserva #${n} recibida`, `Te guardamos estos productos en el despacho para el ${fecha}. Te avisamos cuando esté lista.`],
      'en-camino': [`Tu pedido #${n} está en camino`, 'Nuestro repartidor ya salió con tu pedido. Llega en el transcurso del día.'],
      'reserva-lista': [`Tu reserva #${n} está lista`, 'Ya preparamos tu reserva. Podés pasar a retirarla por el despacho.'],
    };
    const t = textos[evento];
    if (!t) return;
    await enviarMail({ para, asunto: `${t[0]} · El Sol Siciliano`, html: plantilla(t[0], t[1], pedido) });
  } catch (e) {
    console.warn('Aviso por mail no enviado:', e.message);
  }
}
