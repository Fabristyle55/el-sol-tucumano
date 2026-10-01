// Agrega a una base ya cargada lo que necesitan las funciones nuevas, sin tocar lo existente:
//  - usuario repartidor@elsol.demo (rol Repartidor)
//  - dos promociones por cantidad y el cupón SOL10 de ejemplo (si no existen)
// Uso:  npm run datos-nuevos   (se puede correr más de una vez)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
initializeApp({ credential: cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const db = getFirestore();
const auth = getAuth();
const PASS = 'elsol2026';

const email = 'repartidor@elsol.demo';
let u;
try { u = await auth.getUserByEmail(email); } catch { u = await auth.createUser({ email, password: PASS, displayName: 'Repartidor (demo)' }); }
await db.doc(`usuarios/${u.uid}`).set({ nombre: 'Repartidor (demo)', email, rol: 'repartidor' }, { merge: true });
console.log('Usuario repartidor listo:', email);

const prods = (await db.collection('productos').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const pf = prods.find((p) => /franc/i.test(p.nombre)) || prods[0];
const promos = [
  ['promo-francés-50', { tipo: 'cantidad', productoId: pf?.id || null, productoNombre: pf?.nombre || 'Todos los productos', minimo: 50, pct: 10, para: 'mayorista', vence: null, nombre: `10% llevando 50 o más ${pf?.nombre || ''}`.trim() }],
  ['promo-todo-100', { tipo: 'cantidad', productoId: null, productoNombre: 'Todos los productos', minimo: 100, pct: 5, para: 'mayorista', vence: null, nombre: '5% llevando 100 o más de cualquier producto' }],
  ['cupon-SOL10', { tipo: 'cupon', codigo: 'SOL10', pct: 10, para: 'todos', vence: null, minimo: 3000, usosMax: 0, usos: 0, nombre: 'Cupón de bienvenida' }],
];
for (const [id, datos] of promos) {
  const ref = db.doc(`promos/${id}`);
  if (!(await ref.get()).exists) await ref.set({ ...datos, activo: true, creado: FieldValue.serverTimestamp(), creadoPor: 'Datos de ejemplo' });
}
console.log('Promociones de ejemplo listas.');

