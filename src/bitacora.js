// Deja constancia en el historial de lo que el gerente edita directamente desde el navegador
// (recetas, precios y productos). Lo demás lo registra el backend.
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function anotar(perfil, texto) {
  try {
    await addDoc(collection(db, 'actividad'), { texto: String(texto).slice(0, 300), usuario: perfil.nombre || perfil.email, rol: 'Gerente', uid: perfil.uid, fecha: serverTimestamp() });
  } catch { /* el historial nunca frena la edición */ }
}
