import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';

const Ctx = createContext({ cargando: true, user: null, perfil: null });

/** Sesión de Firebase Auth + perfil del usuario (colección "usuarios", con su rol). */
export function AuthProvider({ children }) {
  const [st, setSt] = useState({ cargando: true, user: null, perfil: null });
  useEffect(() => {
    let cortarPerfil = () => {};
    const cortar = onAuthStateChanged(auth, (u) => {
      cortarPerfil();
      if (!u) { setSt({ cargando: false, user: null, perfil: null }); return; }
      setSt({ cargando: true, user: u, perfil: null });
      cortarPerfil = onSnapshot(
        doc(db, 'usuarios', u.uid),
        (s) => setSt({ cargando: false, user: u, perfil: s.exists() ? { uid: u.uid, ...s.data() } : null }),
        () => setSt({ cargando: false, user: u, perfil: null }),
      );
    });
    return () => { cortar(); cortarPerfil(); };
  }, []);
  return <Ctx.Provider value={st}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
