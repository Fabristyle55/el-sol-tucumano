import { useRef, useState } from 'react';
import { api } from '../api';
import { Modal, useAccion, useToast } from '../ui';
import { DibujoPan, ImagenProducto } from './Pan';
import { comprimirImagen, urlImagenIA } from '../imagenes';

/** Cambiar la imagen de un producto: subir foto, generar con IA o volver al dibujo. */
export default function ImagenModal({ producto, onClose }) {
  const [modo, setModo] = useState('foto');
  const [previa, setPrevia] = useState(null); // data URL de la foto elegida
  const [semilla, setSemilla] = useState(() => Math.floor(Math.random() * 1e6));
  const [iaEstado, setIaEstado] = useState('nada'); // nada | cargando | lista | error
  const [arrastrando, setArrastrando] = useState(false);
  const [ocupado, correr] = useAccion();
  const toast = useToast();
  const input = useRef();
  const iaUrl = urlImagenIA(producto.nombre, semilla);

  async function elegir(archivo) {
    if (!archivo) return;
    if (!/^image\//.test(archivo.type)) { toast('Elegí un archivo de imagen (JPG, PNG o WebP).', 'error'); return; }
    try { setPrevia(await comprimirImagen(archivo)); } catch (e) { toast(e.message, 'error'); }
  }
  const guardarFoto = async () => {
    if (await correr(() => api('producto-imagen', { accion: 'subir', productoId: producto.id, dataUrl: previa }), 'Foto guardada')) onClose();
  };
  async function guardarIA() {
    // Intenta copiar la imagen a nuestro almacenamiento; si el navegador no puede, guarda la dirección.
    const r = await correr(async () => {
      try {
        const blob = await fetch(iaUrl).then((x) => { if (!x.ok) throw new Error(); return x.blob(); });
        const dataUrl = await comprimirImagen(blob);
        return await api('producto-imagen', { accion: 'subir', tipo: 'ia', productoId: producto.id, dataUrl });
      } catch {
        return api('producto-imagen', { accion: 'url', productoId: producto.id, url: iaUrl });
      }
    }, 'Imagen generada con IA guardada');
    if (r) onClose();
  }
  const quitar = async () => {
    if (await correr(() => api('producto-imagen', { accion: 'quitar', productoId: producto.id }), 'Vuelve a mostrarse el dibujo')) onClose();
  };
  const generar = () => { setSemilla(Math.floor(Math.random() * 1e6)); setIaEstado('cargando'); };

  return (
    <Modal titulo={`Imagen de ${producto.nombre}`} onClose={onClose} ancho={620}>
      <div className="tabs" role="group" aria-label="Tipo de imagen">
        <button aria-pressed={modo === 'foto'} onClick={() => setModo('foto')}>Subir foto</button>
        <button aria-pressed={modo === 'ia'} onClick={() => { setModo('ia'); if (iaEstado === 'nada') setIaEstado('cargando'); }}>Generar con IA</button>
        <button aria-pressed={modo === 'dibujo'} onClick={() => setModo('dibujo')}>Usar dibujo</button>
      </div>

      {modo === 'foto' && (
        <>
          <div className={`dropzone ${arrastrando ? 'over' : ''}`} onClick={() => input.current.click()}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files[0]); }}>
            {previa ? <img src={previa} alt="Vista previa" /> : (
              <div><b>Arrastrá una foto acá</b><span className="muted small">o tocá para elegirla. Se achica sola antes de subirla.</span></div>
            )}
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => elegir(e.target.files[0])} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {previa && <button className="btn" onClick={() => setPrevia(null)}>Elegir otra</button>}
            <button className="btn primary" disabled={!previa || ocupado} onClick={guardarFoto}>{ocupado ? 'Guardando…' : 'Guardar foto'}</button>
          </div>
        </>
      )}

      {modo === 'ia' && (
        <>
          <div className="ia-marco">
            {iaEstado !== 'error' && <img key={iaUrl} src={iaUrl} alt={`Imagen generada de ${producto.nombre}`} className={iaEstado === 'lista' ? 'lista' : ''}
              onLoad={() => setIaEstado('lista')} onError={() => setIaEstado('error')} />}
            {iaEstado === 'cargando' && <div className="ia-cargando"><span className="ia-sol" /><b>Generando imagen…</b><span className="small">Puede tardar entre 10 y 30 segundos.</span></div>}
            {iaEstado === 'error' && <div className="ia-cargando"><b>No se pudo generar la imagen.</b><span className="small">El servicio gratuito puede estar ocupado. Probá de nuevo.</span></div>}
          </div>
          <p className="muted small" style={{ margin: 0 }}>Se genera con un servicio gratuito de IA a partir del nombre del producto. Si no te gusta, generá otra.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={generar} disabled={ocupado}>Generar otra</button>
            <button className="btn primary" disabled={iaEstado !== 'lista' || ocupado} onClick={guardarIA}>{ocupado ? 'Guardando…' : 'Usar esta imagen'}</button>
          </div>
        </>
      )}

      {modo === 'dibujo' && (
        <>
          <div className="ia-marco dibujo"><DibujoPan nombre={producto.nombre} /></div>
          <p className="muted small" style={{ margin: 0 }}>El dibujo se elige solo según el nombre del producto.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" disabled={!producto.imagen || ocupado} onClick={quitar}>{producto.imagen ? 'Usar el dibujo' : 'Ya se usa el dibujo'}</button>
          </div>
        </>
      )}

      {producto.imagen && modo !== 'dibujo' && (
        <div className="row small muted" style={{ gap: 10 }}>
          <span className="mini-actual"><ImagenProducto producto={producto} /></span>
          Imagen actual: {producto.imagen.tipo === 'ia' ? 'generada con IA' : 'foto'}
        </div>
      )}
    </Modal>
  );
}
