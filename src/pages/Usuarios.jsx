import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, useAccion } from '../ui';
import { LOCALIDADES, ROLES, TIPO_LABEL } from '../util';

const PERSONAL = ['gerente', 'mostrador', 'panadero', 'deposito', 'repartidor'];

export default function Usuarios() {
  const { perfil } = useAuth();
  const { usuarios, clientes } = useData();
  const [modal, setModal] = useState(null);
  const [ocupado, correr] = useAccion();
  const personal = usuarios.filter((u) => u.rol !== 'cliente').sort((a, b) => PERSONAL.indexOf(a.rol) - PERSONAL.indexOf(b.rol));

  return (
    <div className="grid2">
      <section className="card">
        <div className="card-h"><h2>Personal</h2><button className="btn primary" onClick={() => setModal('usuario')}>Agregar usuario</button></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Nombre</th><th>Rol</th></tr></thead>
          <tbody>{personal.map((u) => (
            <tr key={u.id}><td><div style={{ fontWeight: 500 }}>{u.nombre}</div><div className="muted small">{u.email}</div></td>
              <td>{u.id === perfil.uid ? ROLES[u.rol].label : (
                <select value={u.rol} disabled={ocupado} aria-label={`Rol de ${u.nombre}`} onChange={(e) => correr(() => api('usuarios', { accion: 'cambiar-rol', uid: u.id, rol: e.target.value }), 'Rol actualizado')}>
                  {PERSONAL.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
                </select>)}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
      <section className="card">
        <div className="card-h"><h2>Clientes</h2><button className="btn" onClick={() => setModal('cliente')}>Agregar cliente</button></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Cliente</th><th>Tipo</th><th>Localidad</th><th>Cuenta web</th></tr></thead>
          <tbody>{clientes.map((c) => (
            <tr key={c.id}><td><div style={{ fontWeight: 500 }}>{c.nombre}</div><div className="muted small">{[c.direccion, c.telefono].filter(Boolean).join(' · ')}</div></td>
              <td>{TIPO_LABEL[c.tipo || 'mayorista']}</td><td>{c.localidad}</td><td>{c.uid ? <span className="chip">{c.email || 'Sí'}</span> : <span className="muted small">Solo mostrador</span>}</td></tr>
          ))}</tbody>
        </table></div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>Los clientes también pueden crear su propia cuenta desde la pantalla de inicio.</p>
      </section>
      {modal === 'usuario' && <NuevoUsuario onClose={() => setModal(null)} />}
      {modal === 'cliente' && <NuevoCliente onClose={() => setModal(null)} />}
    </div>
  );
}

function NuevoUsuario({ onClose }) {
  const [f, setF] = useState({ nombre: '', email: '', password: '', rol: 'mostrador' });
  const [ocupado, correr] = useAccion();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal titulo="Agregar usuario del personal" onClose={onClose}>
      <div className="fields2">
        <div className="field"><label htmlFor="u-n">Nombre</label><input id="u-n" type="text" value={f.nombre} onChange={set('nombre')} /></div>
        <div className="field"><label htmlFor="u-r">Rol</label><select id="u-r" value={f.rol} onChange={set('rol')}>{PERSONAL.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</select></div>
        <div className="field"><label htmlFor="u-e">Email</label><input id="u-e" type="text" inputMode="email" value={f.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="u-p">Contraseña inicial</label><input id="u-p" type="text" value={f.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" /></div>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Pasale el email y la contraseña a la persona. Puede cambiarla con "Olvidé mi contraseña".</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cerrar</button>
        <button className="btn primary" disabled={ocupado} onClick={async () => { if (await correr(() => api('usuarios', { accion: 'crear-usuario', ...f }), (r) => `Usuario ${r.nombre} creado`)) onClose(); }}>Crear usuario</button>
      </div>
    </Modal>
  );
}

function NuevoCliente({ onClose }) {
  const [f, setF] = useState({ tipo: 'mayorista', nombre: '', localidad: LOCALIDADES[0], direccion: '', telefono: '' });
  const [ocupado, correr] = useAccion();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal titulo="Agregar cliente" onClose={onClose}>
      <div className="field"><label htmlFor="c-tp">Tipo</label><select id="c-tp" value={f.tipo} onChange={set('tipo')}><option value="mayorista">Mayorista (comercio)</option><option value="minorista">Minorista (particular)</option></select></div>
      <div className="field"><label htmlFor="c-n">{f.tipo === 'mayorista' ? 'Comercio' : 'Nombre y apellido'}</label><input id="c-n" type="text" value={f.nombre} onChange={set('nombre')} /></div>
      <div className="fields2">
        <div className="field"><label htmlFor="c-l">Localidad</label><select id="c-l" value={f.localidad} onChange={set('localidad')}>{LOCALIDADES.map((l) => <option key={l}>{l}</option>)}</select></div>
        <div className="field"><label htmlFor="c-t">Teléfono</label><input id="c-t" type="text" value={f.telefono} onChange={set('telefono')} /></div>
      </div>
      <div className="field"><label htmlFor="c-d">Dirección</label><input id="c-d" type="text" value={f.direccion} onChange={set('direccion')} /></div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cerrar</button>
        <button className="btn primary" disabled={ocupado} onClick={async () => { if (await correr(() => api('usuarios', { accion: 'crear-cliente', ...f }), (r) => `Cliente ${r.nombre} agregado`)) onClose(); }}>Agregar</button>
      </div>
    </Modal>
  );
}
