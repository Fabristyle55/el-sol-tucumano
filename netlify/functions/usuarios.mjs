// Alta de usuarios del personal y de clientes mayoristas (solo el gerente).
import { db, adminAuth, endpoint, HttpError, FieldValue, registrar, texto } from '../lib/servidor.mjs';

const ROLES_PERSONAL = ['gerente', 'mostrador', 'panadero', 'deposito'];

export default endpoint(['gerente'], async (b, yo) => {
  const base = db();

  if (b.accion === 'crear-usuario') {
    const nombre = texto(b.nombre, 80);
    const email = texto(b.email, 120).toLowerCase();
    const rol = b.rol;
    if (!nombre || !email) throw new HttpError(400, 'Completá nombre y email.');
    if (!ROLES_PERSONAL.includes(rol)) throw new HttpError(400, 'Rol inválido.');
    if (String(b.password || '').length < 6) throw new HttpError(400, 'La contraseña tiene que tener al menos 6 caracteres.');
    let u;
    try {
      u = await adminAuth().createUser({ email, password: String(b.password), displayName: nombre });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') throw new HttpError(409, 'Ya existe un usuario con ese email.');
      if (e.code === 'auth/invalid-email') throw new HttpError(400, 'El email no es válido.');
      throw e;
    }
    await base.runTransaction(async (t) => {
      t.set(base.doc(`usuarios/${u.uid}`), { nombre, email, rol, creado: FieldValue.serverTimestamp() });
      registrar(t, yo, `Creó el usuario ${nombre} (${rol})`);
    });
    return { uid: u.uid, nombre, rol };
  }

  if (b.accion === 'cambiar-rol') {
    if (!ROLES_PERSONAL.includes(b.rol)) throw new HttpError(400, 'Rol inválido.');
    if (b.uid === yo.uid) throw new HttpError(400, 'No podés cambiar tu propio rol.');
    const ref = base.doc(`usuarios/${String(b.uid)}`);
    const s = await ref.get();
    if (!s.exists || s.data().rol === 'cliente') throw new HttpError(400, 'Solo se puede cambiar el rol del personal.');
    await ref.update({ rol: b.rol });
    return { ok: true };
  }

  if (b.accion === 'crear-cliente') {
    const nombre = texto(b.nombre, 80);
    if (!nombre) throw new HttpError(400, 'Escribí el nombre del comercio.');
    const ref = base.collection('clientes').doc();
    await base.runTransaction(async (t) => {
      t.set(ref, {
        nombre, tipo: b.tipo === 'minorista' ? 'minorista' : 'mayorista', localidad: texto(b.localidad, 60), direccion: texto(b.direccion, 120),
        telefono: texto(b.telefono, 40), uid: null, creado: FieldValue.serverTimestamp(),
      });
      registrar(t, yo, `Agregó el cliente ${nombre}`);
    });
    return { id: ref.id, nombre };
  }

  throw new HttpError(400, 'Acción desconocida.');
});
