// Autoregistro de un cliente (mayorista: un comercio; minorista: un particular). Crea la cuenta de acceso, el comercio
// y el perfil con rol "cliente" en un solo paso; después el navegador inicia sesión.
// Si el usuario ya tiene sesión pero le falta el perfil, solo completa el comercio.
import { db, adminAuth, endpoint, HttpError, FieldValue, registrar, notificar, texto } from '../lib/servidor.mjs';

export default endpoint('publico', async (b, yo) => {
  if (yo?.rol) throw new HttpError(409, 'Tu cuenta ya está registrada.');
  const tipo = b.tipo === 'minorista' ? 'minorista' : 'mayorista';
  const contacto = texto(b.contacto, 80);
  // Un minorista es un particular: el "comercio" es su propio nombre.
  const comercio = tipo === 'minorista' ? contacto : texto(b.comercio, 80);
  if (!comercio || !contacto) throw new HttpError(400, tipo === 'minorista' ? 'Escribí tu nombre.' : 'Completá el nombre del comercio y el tuyo.');

  let uid = yo?.uid;
  let email = yo?.email;
  if (!uid) {
    email = texto(b.email, 120).toLowerCase();
    const password = String(b.password || '');
    if (!email) throw new HttpError(400, 'Escribí tu email.');
    if (password.length < 6) throw new HttpError(400, 'La contraseña tiene que tener al menos 6 caracteres.');
    try {
      ({ uid } = await adminAuth().createUser({ email, password, displayName: contacto }));
    } catch (e) {
      if (e.code === 'auth/email-already-exists') throw new HttpError(409, 'Ya hay una cuenta con ese email. Iniciá sesión.');
      if (e.code === 'auth/invalid-email') throw new HttpError(400, 'El email no es válido.');
      if (e.code === 'auth/invalid-password') throw new HttpError(400, 'La contraseña tiene que tener al menos 6 caracteres.');
      throw e;
    }
  }

  const base = db();
  const cref = base.collection('clientes').doc();
  await base.runTransaction(async (t) => {
    t.set(cref, {
      nombre: comercio, contacto, tipo, localidad: texto(b.localidad, 60), direccion: texto(b.direccion, 120),
      telefono: texto(b.telefono, 40), uid, email, creado: FieldValue.serverTimestamp(),
    });
    t.set(base.doc(`usuarios/${uid}`), {
      nombre: contacto, email, rol: 'cliente', tipoCliente: tipo, clienteId: cref.id, creado: FieldValue.serverTimestamp(),
    });
    registrar(t, { nombre: contacto, rol: 'cliente' }, `Se registró el cliente ${tipo} ${comercio}`);
  });
  await notificar('cliente_registrado', { comercio, contacto, email, tipo });
  return { clienteId: cref.id };
});
