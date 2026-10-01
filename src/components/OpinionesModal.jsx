import { useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth';
import { useData } from '../data';
import { Modal, useToast } from '../ui';
import { cuando } from '../util';
import { Estrellas, ElegirEstrellas } from './Estrellas';
import { ImagenProducto } from './Pan';

/** Opiniones de un producto: lista, promedio y formulario para los clientes. */
export default function OpinionesModal({ producto, onClose }) {
  const { perfil } = useAuth();
  const { opiniones } = useData();
  const toast = useToast();
  const lista = opiniones.filter((o) => o.productoId === producto.id).sort((a, b) => (b.fecha?.toDate?.() || 0) - (a.fecha?.toDate?.() || 0));
  const mia = lista.find((o) => o.uid === perfil.uid);
  const [estrellas, setEstrellas] = useState(mia?.estrellas || 0);
  const [texto, setTexto] = useState(mia?.comentario || '');
  const [ocupado, setOcupado] = useState(false);
  const esCliente = perfil.rol === 'cliente';
  const promedio = lista.length ? lista.reduce((a, o) => a + o.estrellas, 0) / lista.length : 0;
  const barras = [5, 4, 3, 2, 1].map((n) => [n, lista.filter((o) => o.estrellas === n).length]);

  async function guardar() {
    if (!estrellas) { toast('Elegí de 1 a 5 estrellas.', 'error'); return; }
    setOcupado(true);
    try {
      await setDoc(doc(db, 'opiniones', `${producto.id}_${perfil.uid}`), {
        productoId: producto.id, uid: perfil.uid, nombre: perfil.nombre, tipoCliente: perfil.tipoCliente || 'mayorista',
        estrellas, comentario: texto.trim().slice(0, 500), fecha: serverTimestamp(),
      });
      toast(mia ? 'Actualizaste tu opinión' : '¡Gracias por tu opinión!');
    } catch (e) { toast(`No se pudo guardar: ${e.code || e.message}`, 'error'); }
    setOcupado(false);
  }
  async function borrar(o) {
    try { await deleteDoc(doc(db, 'opiniones', o.id)); toast('Opinión eliminada'); if (o.uid === perfil.uid) { setEstrellas(0); setTexto(''); } }
    catch (e) { toast(`No se pudo eliminar: ${e.code || e.message}`, 'error'); }
  }

  return (
    <Modal titulo={producto.nombre} onClose={onClose} ancho={640}>
      <div className="op-resumen">
        <div className="op-img"><ImagenProducto producto={producto} /></div>
        <div className="op-prom">
          <b className="num">{lista.length ? promedio.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : '–'}</b>
          <Estrellas valor={promedio} tam={18} />
          <span className="small muted">{lista.length} {lista.length === 1 ? 'opinión' : 'opiniones'}</span>
        </div>
        <div className="op-barras">
          {barras.map(([n, c]) => (
            <div key={n}><span className="small">{n}★</span><i><b style={{ width: `${lista.length ? (c / lista.length) * 100 : 0}%` }} /></i><span className="small muted num">{c}</span></div>
          ))}
        </div>
      </div>

      {esCliente && (
        <div className="op-form">
          <b>{mia ? 'Tu opinión' : '¿Qué te pareció?'}</b>
          <ElegirEstrellas valor={estrellas} onChange={setEstrellas} />
          <textarea rows={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Contá qué te gustó o qué mejorarías (opcional)" aria-label="Comentario" />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {mia && <button className="btn ghost-bad sm" onClick={() => borrar(mia)}>Borrar mi opinión</button>}
            <button className="btn primary" disabled={ocupado} onClick={guardar}>{mia ? 'Actualizar' : 'Publicar opinión'}</button>
          </div>
        </div>
      )}

      <div className="op-lista">
        {lista.map((o) => (
          <article key={o.id} className="op-item">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 10 }}>
                <span className="op-avatar">{o.nombre?.[0]?.toUpperCase() || '?'}</span>
                <div><b>{o.nombre}</b><div className="small muted">{o.tipoCliente === 'minorista' ? 'Cliente minorista' : 'Cliente mayorista'} · {cuando(o.fecha)}</div></div>
              </div>
              <div className="row"><Estrellas valor={o.estrellas} tam={14} />{perfil.rol === 'gerente' && <button className="btn sm ghost-bad" onClick={() => borrar(o)} aria-label={`Borrar la opinión de ${o.nombre}`}>Borrar</button>}</div>
            </div>
            {o.comentario && <p>{o.comentario}</p>}
          </article>
        ))}
        {!lista.length && <div className="empty">Todavía nadie opinó sobre este producto.{esCliente ? ' ¡Sé el primero!' : ''}</div>}
      </div>
    </Modal>
  );
}
