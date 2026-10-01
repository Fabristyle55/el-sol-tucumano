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
import { fechaAR, sumarDias, explotar } from '../shared/negocio.js';

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

// Artículos de reventa del despacho: [id, nombre, categoría, unidad, precio, stock, mínimo]
const REVENTA = [
  ['r-leche', 'Leche entera 1 l', 'Lácteos', 'u', 1500, 24, 10],
  ['r-yogur', 'Yogur bebible frutilla 1 l', 'Lácteos', 'u', 2600, 12, 6],
  ['r-queso', 'Queso cremoso', 'Lácteos', 'kg', 9800, 4.5, 2],
  ['r-manteca', 'Manteca 200 g', 'Lácteos', 'u', 2400, 10, 5],
  ['r-jamon', 'Jamón cocido', 'Fiambres', 'kg', 14500, 3.2, 1.5],
  ['r-salame', 'Salame milán', 'Fiambres', 'kg', 16800, 1.1, 1],
  ['r-mortadela', 'Mortadela', 'Fiambres', 'kg', 8900, 2.4, 1],
  ['r-cola', 'Gaseosa cola 2,25 l', 'Bebidas', 'u', 3900, 18, 8],
  ['r-naranja', 'Gaseosa naranja 2,25 l', 'Bebidas', 'u', 3600, 6, 8],
  ['r-agua', 'Agua mineral 1,5 l', 'Bebidas', 'u', 1400, 20, 8],
  ['r-dulce', 'Dulce de leche 400 g', 'Almacén', 'u', 3200, 9, 4],
  ['r-mermelada', 'Mermelada de durazno 454 g', 'Almacén', 'u', 2900, 3, 4],
];
// Stock inicial de los elaborados en el despacho (lo que quedó de la producción del día)
const STOCK_ELABORADOS = { pf: 22, v6: 14, v12: 6, ph: 9, ro: 7, to: 5, pp: 11 };

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
  // Despacho: un artículo por cada producto elaborado + artículos de reventa.
  // merge: true para no pisar el stock si ya existe.
  const existentes = new Set((await db.collection('articulos').get()).docs.map((d) => d.id));
  PRODUCTOS.forEach(([id, nombre]) => {
    const datos = { nombre, productoId: id, tipo: 'elaborado', categoria: 'Panificados', unidad: 'u', minimo: 5, activo: true };
    if (!existentes.has(`e-${id}`)) datos.stock = STOCK_ELABORADOS[id] || 0;
    b.set(db.doc(`articulos/e-${id}`), datos, { merge: true });
  });
  REVENTA.forEach(([id, nombre, categoria, unidad, precio, stock, minimo]) => {
    const datos = { nombre, tipo: 'reventa', categoria, unidad, precio, minimo, activo: true };
    if (!existentes.has(id)) datos.stock = stock;
    b.set(db.doc(`articulos/${id}`), datos, { merge: true });
  });
  await b.commit();
  console.log('✓ Insumos, productos, clientes y artículos del despacho');

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
  // Reservas minoristas de ejemplo (salen del despacho). Se rehacen las de ejemplo anteriores.
  if (!process.argv.includes('--sin-pedidos')) {
    const viejas = await db.collection('pedidos').where('tipoCliente', '==', 'minorista').get();
    const bd = db.batch(); let borradas = 0;
    viejas.docs.forEach((d) => { if (d.data().creadoPor === 'Datos de ejemplo') { bd.delete(d.ref); borradas++; } });
    if (borradas) await bd.commit();
    const precioArt = (aid) => {
      const r = REVENTA.find((x) => x[0] === aid); if (r) return { nombre: r[1], precio: r[4], unidad: r[3] };
      const p = PRODUCTOS.find((x) => `e-${x[0]}` === aid); return { nombre: p[1], precio: p[4], unidad: 'u', productoId: p[0] };
    };
    const uidMin = (await auth.getUserByEmail('minorista@elsol.demo')).uid;
    const H = fechaAR(0);
    const ejemplos = [
      ['m1', 'Laura Gómez', 'Yerba Buena', 'Perú 455', uidMin, 'web', { 'e-pf': 2, 'e-ro': 1, 'r-leche': 2 }],
      ['m2', 'Martín Ibáñez', 'San Miguel de Tucumán', 'Lamadrid 790', null, 'mostrador', { 'e-pp': 2, 'r-cola': 1, 'r-jamon': 0.25 }],
      [null, 'Rosa (clienta del local)', '', '', null, 'mostrador', { 'e-to': 1, 'r-queso': 0.3 }],
    ];
    await db.runTransaction(async (t) => {
      const cref = db.doc('contadores/pedidos');
      const c = await t.get(cref);
      let n = c.exists ? c.data().valor : 1000;
      for (const [cid, nombre, localidad, direccion, uid, canal, its] of ejemplos) {
        const items = Object.entries(its).map(([articuloId, cantidad]) => { const a = precioArt(articuloId); return { articuloId, productoId: a.productoId || null, nombre: a.nombre, unidad: a.unidad, cantidad, precio: a.precio }; });
        t.set(db.collection('pedidos').doc(), {
          numero: ++n, clienteId: cid, clienteUid: uid, clienteNombre: nombre, localidad, direccion, telefono: '',
          tipoCliente: 'minorista', modoEntrega: 'retiro', canal, entrega: H, items,
          total: Math.round(items.reduce((a, i) => a + i.cantidad * i.precio, 0)), pago: 'Efectivo', notas: '', estado: 'reservado',
          creado: FieldValue.serverTimestamp(), creadoPor: 'Datos de ejemplo',
        });
      }
      t.set(cref, { valor: n });
    });
    console.log(`✓ ${ejemplos.length} reservas minoristas de ejemplo`);

    // Ventas de ejemplo del despacho de hoy (solo si todavía no hay ventas)
    const hayVentas = await db.collection('ventas').limit(1).get();
    if (hayVentas.empty) {
      const tickets = [
        [{ 'e-pf': 1, 'r-leche': 1 }, 'Efectivo'], [{ 'e-v6': 2 }, 'Mercado Pago'], [{ 'e-ro': 1, 'r-cola': 1 }, 'Débito'],
        [{ 'r-jamon': 0.2, 'r-queso': 0.25, 'e-pf': 1 }, 'Efectivo'], [{ 'e-pp': 1, 'r-agua': 2 }, 'Transferencia'], [{ 'e-ph': 1 }, 'Efectivo'],
      ];
      const bv = db.batch();
      tickets.forEach(([its, pago], k) => {
        const items = Object.entries(its).map(([articuloId, cantidad]) => { const a = precioArt(articuloId); return { articuloId, nombre: a.nombre, unidad: a.unidad, cantidad, precio: a.precio, subtotal: Math.round(cantidad * a.precio) }; });
        bv.set(db.collection('ventas').doc(), {
          numero: k + 1, fecha: new Date(Date.now() - (6 - k) * 50 * 60000), dia: fechaAR(0), items, pago, cliente: '',
          total: items.reduce((a, i) => a + i.subtotal, 0), vendedor: 'Mostrador (demo)', anulada: false,
        });
      });
      bv.set(db.doc('contadores/ventas'), { valor: tickets.length });
      await bv.commit();
      console.log(`✓ ${tickets.length} ventas de ejemplo en el despacho`);
    }
  }

  await mejoras();
  console.log('\nListo. Iniciá la app con "npm run dev" y entrá con gerente@elsol.demo / ' + PASS);
}

main().catch((e) => { console.error('\n✗ Error:', e.message); process.exit(1); });


// ---------------------------------------------------------------------------
// Datos de las mejoras: costos de insumos, vencimientos y ofertas, mermas,
// cierres de caja, cuenta corriente, pedidos fijos e historial para los reportes.
// Todo es idempotente: no pisa lo que ya se cargó desde el sistema.
// ---------------------------------------------------------------------------
const COSTOS = { h000: 900, h0000: 1100, lev: 6000, sal: 800, azu: 1300, gra: 3500, man: 9000, hue: 250, lec: 1300, ace: 2800, tom: 2200, bol: 25 };

// Generador pseudoaleatorio con semilla (siempre los mismos datos de ejemplo).
function azar(semilla) { let x = semilla; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }

async function enLotes(ops) {
  for (let k = 0; k < ops.length; k += 400) {
    const b = db.batch();
    ops.slice(k, k + 400).forEach(([ref, datos]) => b.set(ref, datos));
    await b.commit();
  }
}

async function mejoras() {
  const H = fechaAR(0);
  const vacia = async (col) => (await db.collection(col).limit(1).get()).empty;

  // Costos de insumos (solo si todavía no tienen)
  const ins = await db.collection('insumos').get();
  const bc = db.batch(); let nc = 0;
  ins.docs.forEach((d) => { if (!(d.data().costo > 0) && COSTOS[d.id]) { bc.update(d.ref, { costo: COSTOS[d.id] }); nc++; } });
  if (nc) await bc.commit();
  console.log(`✓ Costos de ${nc} insumos`);

  // Vencimientos y una oferta de ejemplo en la reventa
  const vences = { 'r-yogur': [2, 0], 'r-jamon': [1, 20], 'r-leche': [6, 0], 'r-queso': [9, 0], 'r-mermelada': [-1, 0] };
  for (const [id, [dias, oferta]] of Object.entries(vences)) {
    const ref = db.doc(`articulos/${id}`); const a = await ref.get();
    if (a.exists && !a.data().vence) await ref.update({ vence: sumarDias(H, dias), ...(oferta ? { oferta } : {}) });
  }
  console.log('✓ Vencimientos y ofertas de ejemplo');

  // Mermas de la última semana y órdenes terminadas con extra para el local
  if (await vacia('mermas')) {
    const r = azar(7); const ops = [];
    for (let k = 1; k <= 6; k++) {
      const dia = sumarDias(H, -k);
      ops.push([db.collection('mermas').doc(), { articuloId: 'e-pf', articuloNombre: 'Pan francés x1kg', productoId: 'pf', unidad: 'u', cantidad: 3 + Math.floor(r() * 3), motivo: 'No se vendió', nota: '', valor: 0, dia, fecha: new Date(`${dia}T21:00:00-03:00`), usuario: 'Mostrador (demo)' }]);
      ops.push([db.collection('mermas').doc(), { articuloId: 'e-v6', articuloNombre: 'Viena x6u', productoId: 'v6', unidad: 'u', cantidad: 1 + Math.floor(r() * 2), motivo: 'No se vendió', nota: '', valor: 0, dia, fecha: new Date(`${dia}T21:00:00-03:00`), usuario: 'Mostrador (demo)' }]);
      ops.push([db.collection('ordenes').doc(), { numero: 100 + k * 2, fecha: dia, productoId: 'pf', productoNombre: 'Pan francés x1kg', cantidad: 12, extra: 12, insumos: {}, estado: 'terminada', pedidos: [], creadaPor: 'Datos de ejemplo' }]);
      ops.push([db.collection('ordenes').doc(), { numero: 101 + k * 2, fecha: dia, productoId: 'v6', productoNombre: 'Viena x6u', cantidad: 6, extra: 6, insumos: {}, estado: 'terminada', pedidos: [], creadaPor: 'Datos de ejemplo' }]);
    }
    ops.push([db.collection('mermas').doc(), { articuloId: 'r-leche', articuloNombre: 'Leche entera 1 l', productoId: null, unidad: 'u', cantidad: 2, motivo: 'Vencido', nota: '', valor: 3000, dia: sumarDias(H, -2), fecha: new Date(), usuario: 'Mostrador (demo)' }]);
    ops.forEach(([, d]) => { if (d.productoId === 'pf' && d.motivo) d.valor = d.cantidad * 3000; if (d.productoId === 'v6' && d.motivo) d.valor = d.cantidad * 1400; });
    await enLotes(ops);
    console.log('✓ Mermas de la última semana');
  }

  // Cierres de caja de los días anteriores
  if (await vacia('cierres')) {
    await enLotes([
      [db.doc(`cierres/${sumarDias(H, -1)}`), { dia: sumarDias(H, -1), fondo: 20000, efectivo: 61800, esperado: 81800, contado: 81800, diferencia: 0, total: 112400, porPago: { Efectivo: 61800, Débito: 28600, 'Mercado Pago': 22000 }, ventas: 21, reservas: 2, notas: '', cerradoPor: 'Mostrador (demo)', fecha: new Date(`${sumarDias(H, -1)}T21:05:00-03:00`) }],
      [db.doc(`cierres/${sumarDias(H, -2)}`), { dia: sumarDias(H, -2), fondo: 20000, efectivo: 54300, esperado: 74300, contado: 73800, diferencia: -500, total: 98700, porPago: { Efectivo: 54300, Transferencia: 18400, Débito: 26000 }, ventas: 19, reservas: 1, notas: 'Faltó cambio de un billete', cerradoPor: 'Mostrador (demo)', fecha: new Date(`${sumarDias(H, -2)}T21:10:00-03:00`) }],
    ]);
    console.log('✓ Cierres de caja de ejemplo');
  }

  // Cuenta corriente: dos comercios con saldo (uno vencido)
  if (await vacia('movCuenta')) {
    const cuentas = [
      ['c2', 'Despensa La Esquina', [[-22, 'cargo', 52600, 'Pedido #921'], [-15, 'cargo', 48900, 'Pedido #934'], [-10, 'pago', 15100, 'Pago en efectivo']]],
      ['c3', 'Minimercado San Cayetano', [[-20, 'cargo', 61000, 'Pedido #925'], [-12, 'pago', 61000, 'Pago en transferencia'], [-6, 'cargo', 45200, 'Pedido #941']]],
    ];
    const ops = [];
    for (const [cid, nombre, movs] of cuentas) {
      let saldo = 0; let desde = null;
      for (const [d, tipo, monto, detalle] of movs) {
        const antes = saldo; saldo += tipo === 'cargo' ? monto : -monto;
        if (tipo === 'cargo' && antes <= 0) desde = sumarDias(H, d);
        if (saldo <= 0) desde = null;
        ops.push([db.collection('movCuenta').doc(), { clienteId: cid, clienteUid: null, clienteNombre: nombre, tipo, monto, detalle, saldo, dia: sumarDias(H, d), fecha: new Date(`${sumarDias(H, d)}T12:00:00-03:00`), usuario: 'Gerente (demo)', ...(tipo === 'pago' ? { medio: detalle.includes('transf') ? 'Transferencia' : 'Efectivo' } : {}) }]);
      }
      await db.doc(`clientes/${cid}`).set({ saldo, ...(desde ? { deudaDesde: desde } : {}) }, { merge: true });
    }
    await enLotes(ops);
    console.log('✓ Cuenta corriente de ejemplo');
  }

  // Pedido fijo del cliente de prueba (lunes, miércoles y viernes)
  const fijo = db.doc('pedidosFijos/c1');
  if (!(await fijo.get()).exists) {
    const c1 = (await db.doc('clientes/c1').get()).data() || {};
    await fijo.set({ clienteId: 'c1', clienteUid: c1.uid || null, clienteNombre: 'Almacén Don Pedro', dias: [1, 3, 5], items: [{ productoId: 'pf', cantidad: 10 }, { productoId: 'v6', cantidad: 6 }], pago: 'Efectivo', modoEntrega: 'envio', activo: true, actualizado: new Date(), actualizadoPor: 'Datos de ejemplo' });
    console.log('✓ Pedido fijo de ejemplo');
  }

  // Historial de 6 meses para los reportes (pedidos entregados, ventas del despacho y consumo de insumos)
  const marca = db.doc('contadores/historico');
  if (!(await marca.get()).exists) {
    const r = azar(42); const ops = []; const prods = Object.fromEntries(PRODUCTOS.map(([id, nombre, , precio, precioMin, receta]) => [id, { nombre, precio, precioMin, receta }]));
    const consumoMes = {};
    let n = 100;
    for (let k = 180; k >= 15; k--) {
      const dia = sumarDias(H, -k);
      if (diaSemanaSeed(dia) === 0) continue; // domingos cerrado
      const mes = dia.slice(0, 7);
      // 2 a 4 pedidos mayoristas entregados por día
      const nped = 2 + Math.floor(r() * 3);
      for (let j = 0; j < nped; j++) {
        const [cid, nombre, localidad] = CLIENTES[Math.floor(r() * CLIENTES.length)];
        const its = {}; const elegidos = PRODUCTOS.filter(() => r() < 0.45); (elegidos.length ? elegidos : [PRODUCTOS[0]]).forEach(([pid]) => { its[pid] = 4 + Math.floor(r() * 12); });
        const items = Object.entries(its).map(([pid, cantidad]) => ({ productoId: pid, nombre: prods[pid].nombre, cantidad, precio: prods[pid].precio }));
        const tot = explotar(its, Object.fromEntries(Object.entries(prods).map(([id, p]) => [id, { receta: p.receta }])));
        consumoMes[mes] ||= {}; Object.entries(tot).forEach(([iid, q]) => { consumoMes[mes][iid] = (consumoMes[mes][iid] || 0) + q; });
        ops.push([db.collection('pedidos').doc(), { numero: ++n, clienteId: cid, clienteUid: null, clienteNombre: nombre, localidad, direccion: '', tipoCliente: 'mayorista', modoEntrega: 'envio', canal: r() < 0.5 ? 'web' : 'mostrador', entrega: dia, entregadoDia: dia, items, total: items.reduce((a, i) => a + i.cantidad * i.precio, 0), pago: 'Efectivo', notas: '', estado: 'entregado', historico: true, creado: new Date(`${dia}T08:00:00-03:00`), creadoPor: 'Datos de ejemplo' }]);
      }
      // Ventas del despacho (desde hace 4 meses)
      if (k <= 120) {
        const nv = 6 + Math.floor(r() * 8);
        const ventas = [];
        for (let j = 0; j < nv; j++) {
          const pid = PRODUCTOS[Math.floor(r() * PRODUCTOS.length)];
          const rev = REVENTA[Math.floor(r() * REVENTA.length)];
          const items = [{ articuloId: `e-${pid[0]}`, productoId: pid[0], nombre: pid[1], unidad: 'u', cantidad: 1 + Math.floor(r() * 2), precio: pid[4] }];
          if (r() < 0.5) items.push({ articuloId: rev[0], productoId: null, nombre: rev[1], unidad: rev[3], cantidad: rev[3] === 'kg' ? 0.25 : 1, precio: rev[4] });
          items.forEach((i) => { i.subtotal = Math.round(i.cantidad * i.precio); });
          ventas.push({ items, total: items.reduce((a, i) => a + i.subtotal, 0) });
        }
        ventas.forEach((v, j) => ops.push([db.collection('ventas').doc(), { numero: 0, historico: true, fecha: new Date(`${dia}T${String(8 + j).padStart(2, '0')}:30:00-03:00`), dia, items: v.items, total: v.total, pago: ['Efectivo', 'Efectivo', 'Débito', 'Mercado Pago', 'Transferencia'][Math.floor(r() * 5)], cliente: '', vendedor: 'Mostrador (demo)', anulada: false }]));
      }
    }
    // Consumo de insumos: un movimiento por insumo y por mes (producción histórica)
    for (const [mes, porIns] of Object.entries(consumoMes)) {
      for (const [iid, q] of Object.entries(porIns)) {
        const i = INSUMOS.find((x) => x[0] === iid);
        ops.push([db.collection('movimientos').doc(), { insumoId: iid, insumoNombre: i?.[1] || iid, cantidad: -Math.round(q * 1.08 * 100) / 100, motivo: `Producción del mes ${mes.split('-').reverse().join('/')} (histórico)`, historico: true, fecha: new Date(`${mes}-27T20:00:00-03:00`), usuario: 'Datos de ejemplo' }]);
      }
    }
    ops.push([marca, { creado: new Date(), documentos: ops.length }]);
    await enLotes(ops);
    console.log(`✓ Historial de 6 meses para los reportes (${ops.length} registros)`);
  }
}

function diaSemanaSeed(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
