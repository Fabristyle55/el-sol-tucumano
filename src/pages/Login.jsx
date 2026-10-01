import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { TemaToggle } from '../ui';

export const MENSAJES_AUTH = {
  'auth/invalid-credential': 'El email o la contraseña no son correctos.',
  'auth/invalid-email': 'El email no es válido.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
  'auth/email-already-in-use': 'Ya hay una cuenta con ese email. Iniciá sesión.',
  'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
  'auth/network-request-failed': 'No hay conexión. Revisá tu internet.',
};

// Cuentas que crea "npm run seed" para probar cada rol en la presentación.
const DEMO = [
  ['Gerente', 'gerente@elsol.demo'], ['Mostrador', 'mostrador@elsol.demo'], ['Panadero', 'panadero@elsol.demo'],
  ['Depósito', 'deposito@elsol.demo'], ['Repartidor', 'repartidor@elsol.demo'], ['Cliente mayorista', 'cliente@elsol.demo'], ['Cliente minorista', 'minorista@elsol.demo'],
];

export function AuthArte() {
  return (
    <div className="auth-art">
      <div className="auth-deco" aria-hidden="true">
        <img className="auth-sol" src="/marca/sol-512.png" alt="" />
        <span className="auth-aura a" /><span className="auth-aura b" />
        {Array.from({ length: 16 }, (_, k) => <i key={k} style={{ left: `${(k * 37) % 100}%`, width: 3 + (k % 4) * 2, height: 3 + (k % 4) * 2, animationDuration: `${9 + (k % 5) * 2.5}s`, animationDelay: `${-k * 1.3}s` }} />)}
      </div>
      <img className="auth-logo" src="/marca/logo.jpg" alt="Panificación El Sol Siciliano" />
      <div>
        <h1>Sistema de gestión de la panadería</h1>
        <p style={{ marginTop: 12 }}>Pedidos, producción, despacho, stock y compras de Panificación El Sol Siciliano.</p>
      </div>
      <div className="auth-feats">
        <div><span className="ic">✓</span><span><b>Pedidos y reservas</b><span>Por la web o cargados en el mostrador.</span></span></div>
        <div><span className="ic">✓</span><span><b>Producción planificada</b><span>Los insumos se calculan con las recetas.</span></span></div>
        <div><span className="ic">✓</span><span><b>Stock y compras al día</b><span>Avisos antes de quedarse sin insumos.</span></span></div>
      </div>
      <p className="small"><a href="/presentacion/index.html">Conocé el proyecto</a> · Seminario Integrador · UTN FRT</p>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [sacudir, setSacudir] = useState(0);

  async function entrar(e) {
    e.preventDefault();
    setError(''); setInfo(''); setOcupado(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err) {
      setError(MENSAJES_AUTH[err.code] || 'No se pudo iniciar sesión.');
      setSacudir((n) => n + 1);
      setOcupado(false);
    }
  }
  async function recuperar() {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Escribí tu email y después tocá "Olvidé mi contraseña".'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Te mandamos un mail para crear una contraseña nueva.');
    } catch (err) {
      setError(MENSAJES_AUTH[err.code] || 'No se pudo enviar el mail.');
    }
  }

  return (
    <div className="auth">
      <AuthArte />
      <div className="auth-form">
        <div className="auth-top"><TemaToggle /></div>
        <form onSubmit={entrar} key={sacudir} className={sacudir ? 'shake' : ''}>
          <h2>Ingresar al sistema</h2>
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="text" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="pass">Contraseña</label><input id="pass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></div>
          {error && <div className="err-box">{error}</div>}
          {info && <div className="note ok">{info}</div>}
          <button className="btn primary" type="submit" disabled={ocupado}>{ocupado ? 'Ingresando…' : 'Ingresar'}</button>
          <button className="linkbtn small" type="button" onClick={recuperar}>Olvidé mi contraseña</button>
          <p className="small muted">¿Querés hacer pedidos, para tu comercio o para tu casa? <Link to="/registro" className="linkbtn">Creá tu cuenta de cliente</Link></p>
          <div className="demo">
            <span className="lbl">Cuentas de prueba · contraseña elsol2026</span>
            {DEMO.map(([r, m]) => (
              <button key={m} type="button" title={m} onClick={() => { setEmail(m); setPass('elsol2026'); }}>{r}</button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
