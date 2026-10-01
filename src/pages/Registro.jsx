import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { api } from '../api';
import { LOCALIDADES } from '../util';
import { AuthArte, MENSAJES_AUTH } from './Login';
import { TemaToggle } from '../ui';

/** Alta de un cliente (mayorista o minorista). Con "completar" el usuario ya existe y solo falta el comercio. */
export default function Registro({ completar = false }) {
  const [f, setF] = useState({ tipo: 'minorista', comercio: '', contacto: '', localidad: LOCALIDADES[0], direccion: '', telefono: '', email: '', pass: '' });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError('');
    const may = f.tipo === 'mayorista';
    if (!f.contacto.trim() || (may && !f.comercio.trim())) { setError(may ? 'Completá el nombre del comercio y el tuyo.' : 'Escribí tu nombre.'); return; }
    if (!completar && f.pass.length < 6) { setError('La contraseña tiene que tener al menos 6 caracteres.'); return; }
    setOcupado(true);
    try {
      await api('registrar-cliente', {
        tipo: f.tipo, comercio: f.comercio, contacto: f.contacto, localidad: f.localidad, direccion: f.direccion, telefono: f.telefono,
        ...(completar ? {} : { email: f.email.trim(), password: f.pass }),
      }, { publico: !completar });
      if (!completar) await signInWithEmailAndPassword(auth, f.email.trim(), f.pass);
      // Al crearse el perfil, la app entra sola al catálogo.
    } catch (err) {
      setError(MENSAJES_AUTH[err.code] || err.message || 'No se pudo crear la cuenta.');
      setOcupado(false);
    }
  }

  return (
    <div className="auth">
      <AuthArte />
      <div className="auth-form">
        <div className="auth-top"><TemaToggle /></div>
        <form onSubmit={enviar}>
          <h2>{completar ? 'Completá tus datos de cliente' : 'Crear cuenta de cliente'}</h2>
          {completar && <p className="small muted">Tu usuario no tiene un perfil asignado. Si sos parte del personal, pedile al gerente que te dé de alta.</p>}
          <div className="field"><span style={{ fontSize: 13, fontWeight: 600 }}>¿Para quién comprás?</span>
            <div className="tabs" role="group" aria-label="Tipo de cliente">
              <button type="button" aria-pressed={f.tipo === 'minorista'} onClick={() => setF({ ...f, tipo: 'minorista' })}>Para mi casa (minorista)</button>
              <button type="button" aria-pressed={f.tipo === 'mayorista'} onClick={() => setF({ ...f, tipo: 'mayorista' })}>Para mi comercio (mayorista)</button>
            </div></div>
          {f.tipo === 'mayorista' && <div className="field"><label htmlFor="r-com">Nombre del comercio</label><input id="r-com" type="text" value={f.comercio} onChange={set('comercio')} placeholder="Almacén, despensa, kiosco…" /></div>}
          <div className="field"><label htmlFor="r-con">{f.tipo === 'mayorista' ? 'Tu nombre' : 'Nombre y apellido'}</label><input id="r-con" type="text" value={f.contacto} onChange={set('contacto')} /></div>
          <div className="fields2">
            <div className="field"><label htmlFor="r-loc">Localidad</label><select id="r-loc" value={f.localidad} onChange={set('localidad')}>{LOCALIDADES.map((l) => <option key={l}>{l}</option>)}</select></div>
            <div className="field"><label htmlFor="r-tel">Teléfono</label><input id="r-tel" type="text" inputMode="tel" value={f.telefono} onChange={set('telefono')} /></div>
          </div>
          <div className="field"><label htmlFor="r-dir">Dirección de entrega{f.tipo === 'minorista' ? ' (opcional si retirás en el local)' : ''}</label><input id="r-dir" type="text" value={f.direccion} onChange={set('direccion')} placeholder="Calle, número, referencia" /></div>
          {!completar && (
            <div className="fields2">
              <div className="field"><label htmlFor="r-mail">Email</label><input id="r-mail" type="text" inputMode="email" autoComplete="username" value={f.email} onChange={set('email')} /></div>
              <div className="field"><label htmlFor="r-pass">Contraseña</label><input id="r-pass" type="password" autoComplete="new-password" value={f.pass} onChange={set('pass')} /></div>
            </div>
          )}
          {error && <div className="err-box">{error}</div>}
          <button className="btn primary" type="submit" disabled={ocupado}>{ocupado ? 'Creando cuenta…' : 'Crear cuenta'}</button>
          {completar
            ? <button className="linkbtn small" type="button" onClick={() => signOut(auth)}>Cerrar sesión</button>
            : <p className="small muted">¿Ya tenés cuenta? <Link to="/" className="linkbtn">Ingresá</Link></p>}
        </form>
      </div>
    </div>
  );
}
