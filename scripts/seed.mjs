// Carga los datos iniciales en Firestore: insumos, productos con sus recetas,
// clientes mayoristas y minoristas, usuarios de prueba (uno por rol) y pedidos de ejemplo.
//
// Uso:  npm run seed            → carga todo (no duplica si ya existe)
//       npm run seed -- --sin-pedidos   → no crea pedidos de ejemplo
//
// Necesita el archivo .env con la cuenta de servicio (ver .env.example).
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { fechaAR, sumarDias } from '../shared/negocio.js';

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error('Falta completar el archivo .env (copiá .env.example como .env).');
  process.exit(1);
}
initializeApp({ credential: cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const db = getFirestore();
const auth = getAuth();
const PASS = 'elsol2026';

const INSUMOS = [
  ['h000', 'Harina 000', 'kg', 220, 150, 25, 'bolsa 25 kg', 'Molinos del Norte'],
  ['h0000', 'Harina 0000', 'kg', 95, 100, 25, 'bolsa 25 kg', 'Molinos del Norte'],
  ['lev', 'Levadura fresca', 'kg', 2.5, 3, 0.5, 'pan 500 g', 'Distribuidora Calchaquí'],
  ['sal', 'Sal fina', 'kg', 18, 10, 5, 'paquete 5 kg', 'Distribuidora Calchaquí'],
  ['azu', 'Azúcar', 'kg', 40, 20, 25, 'bolsa 25 kg', 'Distribuidora Calchaquí'],
  ['gra', 'Grasa vacuna', 'kg', 14, 10, 10, 'caja 10 kg', 'Frigorífico Famaillá'],
  ['man', 'Manteca', 'kg', 6, 8, 5, 'caja 5 kg', 'Lácteos Trancas'],
  ['hue', 'Huevos', 'u', 240, 180, 30, 'maple 30 u', 'Granja Los Pinos'],
  ['lec', 'Leche', 'l', 30, 20, 12, 'caja 12 l', 'Lácteos Trancas'],
  ['ace', 'Aceite de girasol', 'l', 12, 10, 5, 'bidón 5 l', 'Distribuidora Calchaquí'],
  ['tom', 'Puré de tomate', 'kg', 14, 8, 6, 'caja 6 kg', 'Distribuidora Calchaquí'],
  ['bol', 'Bolsas de polietileno', 'u', 600, 400, 500, 'paquete 500 u', 'Envases Tucumán'],
];

const PRODUCTOS = [
  // [id, nombre, abreviatura, precio mayorista, precio minorista, receta por unidad]
  ['pf', 'Pan francés x1kg', 'Pf', 2400, 3000, { h000: 0.65, lev: 0.015, sal: 0.012, gra: 0.02, bol: 1 }],
  ['v6', 'Viena x6u', 'V6', 1100, 1400, { h0000: 0.22, lev: 0.006, azu: 0.02, man: 0.02, lec: 0.06, sal: 0.004, bol: 1 }],
  ['v12', 'Viena x12u', 'V12', 2100, 2600, { h0000: 0.44, lev: 0.012, azu: 0.04, man: 0.04, lec: 0.12, sal: 0.008, bol: 1 }],
  ['ph', 'Pan de hamburguesas x8u', 'Ph', 2100, 2600, { h0000: 0.48, lev: 0.012, azu: 0.03, man: 0.03, lec: 0.1, hue: 1, sal: 0.008, bol: 1 }],
  ['ro', 'Rosquillas x500g', 'Ro', 5500, 6900, { h0000: 0.28, azu: 0.09, man: 0.06, hue: 3, lec: 0.04, bol: 1 }],
  ['to', 'Tostadas x1kg', 'To', 6600, 8200, { h000: 0.75, lev: 0.012, azu: 0.05, gra: 0.05, sal: 0.012, bol: 1 }],
  ['pp', 'Prepizzas x6u', 'Pp', 3200, 4000, { h000: 0.9, lev: 0.018, ace: 0.06, sal: 0.018, tom: 0.3, bol: 1 }],
];

const CLIENTES = [
  ['c1', 'Almacén Don Pedro', 'Yerba Buena', 'Av. Aconquija 1450', '381 455-2210'],
  ['c2', 'Despensa La Esquina', 'Banda del Río Salí', 'San Martín 320', '381 422-1876'],
  ['c3', 'Minimercado San Cayetano', 'San Miguel de Tucumán', 'Av. Mate de Luna 2780', '381 430-5512'],
  ['c4', 'Kiosco Ruta 9', 'Tafí Viejo', 'Ruta 9 km 1305', '381 461-0098'],
  ['c5', 'Rotisería El Buen Sabor', 'Las Talitas', 'Av. Belgrano 845', '381 437-7741'],
  ['c6', 'Autoservicio Lules', 'Lules', '25 de Mayo 112', '381 481-3320'],
];

const MINORISTAS = [
  ['m1', 'Laura Gómez', 'Yerba Buena', 'Perú 455', '381 512-3344'],
  ['m2', 'Martín Ibáñez', 'San Miguel de Tucumán', 'Lamadrid 790', '381 598-1122'],
];

const USUARIOS = [
  ['gerente@elsol.demo', 'Gerente (demo)', 'gerente'],
  ['mostrador@elsol.demo', 'Mostrador (demo)', 'mostrador'],
  ['panadero@elsol.demo', 'Panadero (demo)', 'panadero'],
  ['deposito@elsol.demo', 'Depósito (demo)', 'deposito'],
  ['cliente@elsol.demo', 'Pedro (Almacén Don Pedro)', 'cliente', 'mayorista', 'c1'],
  ['minorista@elsol.demo', 'Laura Gómez', 'cliente', 'minorista', 'm1'],
];

async function usuario(email, nombre) {
  try { return await auth.getUserByEmail(email); }
  catch { return auth.createUser({ email, password: PASS, displayName: nombre }); }
}

async function main() {
  console.log(`Proyecto: ${FIREBASE_PROJECT_ID}`);
  const b = db.batch();
  INSUMOS.forEach(([id, nombre, unidad, stock, seguridad, pack, packLabel, proveedor], k) =>
    b.set(db.doc(`insumos/${id}`), { nombre, unidad, stock, seguridad, pack, packLabel, proveedor, orden: k + 1 }, { merge: true }));
  PRODUCTOS.forEach(([id, nombre, abrev, precio, precioMinorista, receta], k) =>
    b.set(db.doc(`productos/${id}`), { nombre, abrev, precio, precioMinorista, receta, activo: true, orden: k + 1 }, { merge: true }));
  CLIENTES.forEach(([id, nombre, localidad, direccion, telefono]) =>
    b.set(db.doc(`clientes/${id}`), { nombre, tipo: 'mayorista', localidad, direccion, telefono }, { merge: true }));
  MINORISTAS.forEach(([id, nombre, localidad, direccion, telefono]) =>
    b.set(db.doc(`clientes/${id}`), { nombre, contacto: nombre, tipo: 'minorista', localidad, direccion, telefono }, { merge: true }));
  await b.commit();
  console.log('✓ Insumos, productos y clientes');

  for (const [email, nombre, rol, tipoCliente, clienteId] of USUARIOS) {
    const u = await usuario(email, nombre);
    const datos = { nombre, email, rol, creado: FieldValue.serverTimestamp() };
    if (rol === 'cliente') {
      Object.assign(datos, { clienteId, tipoCliente });
      await db.doc(`clientes/${clienteId}`).set({ uid: u.uid, email }, { merge: true });
    }
    await db.doc(`usuarios/${u.uid}`).set(datos, { merge: true });
  }
  console.log(`✓ Usuarios de prueba (contraseña: ${PASS})`);

  const hay = await db.collection('pedidos').limit(1).get();
  if (process.argv.includes('--sin-pedidos') || !hay.empty) {
    console.log(hay.empty ? '· Sin pedidos de ejemplo' : '· Ya hay pedidos: no se crean ejemplos');
  } else {
    const prod = Object.fromEntries(PRODUCTOS.map(([id, nombre, , precio, precioMinorista]) => [id, { nombre, precio, precioMinorista }]));
    const cli = Object.fromEntries(CLIENTES.map(([id, nombre, localidad, direccion]) => [id, { nombre, localidad, direccion }]));
    const uidCliente = (await auth.getUserByEmail('cliente@elsol.demo')).uid;
    const M = fechaAR(1);
    const ejemplos = [
      ['c1', 'web', M, { pf: 10, v6: 10, ph: 8 }, 'confirmado'],
      ['c3', 'mostrador', M, { pf: 15, v12: 8, to: 4, pp: 10 }, 'confirmado'],
      ['c2', 'web', M, { v6: 12, ro: 6, pp: 8 }, 'confirmado'],
      ['c5', 'mostrador', M, { ph: 12, pp: 7, v12: 7 }, 'confirmado'],
      ['c4', 'mostrador', M, { pf: 15, v6: 8, ro: 6, to: 6 }, 'confirmado'],
      ['c6', 'mostrador', M, { pf: 8, v6: 6, to: 3 }, 'pendiente'],
      ['c1', 'web', sumarDias(M, 1), { ro: 4, pp: 5 }, 'pendiente'],
      ['c3', 'mostrador', fechaAR(-1), { pf: 20, v6: 10, pp: 8 }, 'entregado'],
      ['c2', 'mostrador', fechaAR(-2), { pf: 12, to: 5, ro: 4 }, 'entregado'],
      ['c5', 'mostrador', fechaAR(-3), { ph: 15, v12: 6 }, 'entregado'],
    ];
    const bp = db.batch();
    let n = 1000;
    for (const [cid, canal, entrega, its, estado] of ejemplos) {
      const items = Object.entries(its).map(([productoId, cantidad]) => ({ productoId, nombre: prod[productoId].nombre, cantidad, precio: prod[productoId].precio }));
      bp.set(db.collection('pedidos').doc(), {
        numero: ++n, clienteId: cid, clienteUid: cid === 'c1' ? uidCliente : null, clienteNombre: cli[cid].nombre,
        localidad: cli[cid].localidad, direccion: cli[cid].direccion, tipoCliente: 'mayorista', modoEntrega: 'envio', canal, entrega, items,
        total: items.reduce((a, i) => a + i.cantidad * i.precio, 0), pago: 'Efectivo', notas: '', estado,
        creado: FieldValue.serverTimestamp(), creadoPor: 'Datos de ejemplo',
      });
    }
    bp.set(db.doc('contadores/pedidos'), { valor: n });
    bp.set(db.collection('actividad').doc(), { texto: 'Se cargaron los datos de ejemplo', usuario: 'Sistema', rol: 'Sistema', fecha: FieldValue.serverTimestamp() });
    await bp.commit();
    console.log(`✓ ${ejemplos.length} pedidos de ejemplo`);
  }
  // Pedidos minoristas de ejemplo (se agregan una sola vez, aunque ya haya otros pedidos)
  const hayMin = await db.collection('pedidos').where('tipoCliente', '==', 'minorista').limit(1).get();
  if (!process.argv.includes('--sin-pedidos') && hayMin.empty) {
    const prod = Object.fromEntries(PRODUCTOS.map(([id, nombre, , , precioMinorista]) => [id, { nombre, precio: precioMinorista }]));
    const uidMin = (await auth.getUserByEmail('minorista@elsol.demo')).uid;
    const M = fechaAR(1);
    const ejemplos = [
      ['m1', 'Laura Gómez', 'Yerba Buena', 'Perú 455', uidMin, 'web', 'retiro', { pf: 2, ro: 1 }, 'pendiente'],
      ['m2', 'Martín Ibáñez', 'San Miguel de Tucumán', 'Lamadrid 790', null, 'mostrador', 'envio', { pp: 2, v6: 1 }, 'confirmado'],
      [null, 'Rosa (cliente del local)', '', '', null, 'mostrador', 'retiro', { to: 1, v12: 1 }, 'confirmado'],
    ];
    await db.runTransaction(async (t) => {
      const cref = db.doc('contadores/pedidos');
      const c = await t.get(cref);
      let n = c.exists ? c.data().valor : 1000;
      for (const [cid, nombre, localidad, direccion, uid, canal, modoEntrega, its, estado] of ejemplos) {
        const items = Object.entries(its).map(([productoId, cantidad]) => ({ productoId, nombre: prod[productoId].nombre, cantidad, precio: prod[productoId].precio }));
        t.set(db.collection('pedidos').doc(), {
          numero: ++n, clienteId: cid, clienteUid: uid, clienteNombre: nombre, localidad, direccion, telefono: '',
          tipoCliente: 'minorista', modoEntrega, canal, entrega: M, items,
          total: items.reduce((a, i) => a + i.cantidad * i.precio, 0), pago: 'Efectivo', notas: '', estado,
          creado: FieldValue.serverTimestamp(), creadoPor: 'Datos de ejemplo',
        });
      }
      t.set(cref, { valor: n });
    });
    console.log(`✓ ${ejemplos.length} pedidos minoristas de ejemplo`);
  }

  console.log('\nListo. Iniciá la app con "npm run dev" y entrá con gerente@elsol.demo / ' + PASS);
}

main().catch((e) => { console.error('\n✗ Error:', e.message); process.exit(1); });
