import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth';
import { ROLES_STAFF } from '../shared/negocio.js';
import { hoy, sumarDias, porId } from './util';

/** Suscripción en tiempo real a una consulta de Firestore. */
function useCol(crear, deps) {
  const [st, setSt] = useState({ data: [], cargando: !!crear, error: null });
  useEffect(() => {
    if (!crear) { setSt({ data: [], cargando: false, error: null }); return undefined; }
    setSt((s) => ({ ...s, cargando: true }));
    return onSnapshot(
      crear(),
      (snap) => setSt({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), cargando: false, error: null }),
      (error) => { console.error(error); setSt({ data: [], cargando: false, error }); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return st;
}

const Ctx = createContext(null);

/** Carga los datos que necesita cada rol y los mantiene actualizados en vivo. */
export function DataProvider({ children }) {
  const { perfil } = useAuth();
  const rol = perfil?.rol;
  const staff = ROLES_STAFF.includes(rol);
  const desde = sumarDias(hoy(), -14);

  const productos = useCol(rol ? () => collection(db, 'productos') : null, [rol]);
  const insumos = useCol(staff ? () => collection(db, 'insumos') : null, [staff]);
  const pedidos = useCol(
    staff ? () => query(collection(db, 'pedidos'), where('entrega', '>=', desde))
      : rol === 'cliente' ? () => query(collection(db, 'pedidos'), where('clienteUid', '==', perfil.uid)) : null,
    [staff, rol, perfil?.uid, desde],
  );
  const ordenes = useCol(staff ? () => query(collection(db, 'ordenes'), where('fecha', '>=', sumarDias(hoy(), -7))) : null, [staff]);
  const compras = useCol(staff ? () => collection(db, 'compras') : null, [staff]);
  const clientes = useCol(staff ? () => collection(db, 'clientes') : null, [staff]);
  const actividad = useCol(staff ? () => query(collection(db, 'actividad'), orderBy('fecha', 'desc'), limit(40)) : null, [staff]);
  const movimientos = useCol(staff ? () => query(collection(db, 'movimientos'), orderBy('fecha', 'desc'), limit(40)) : null, [staff]);
  const usuarios = useCol(rol === 'gerente' ? () => collection(db, 'usuarios') : null, [rol]);
  const opiniones = useCol(rol ? () => collection(db, 'opiniones') : null, [rol]);
  const articulos = useCol(rol ? () => collection(db, 'articulos') : null, [rol]);
  const ventas = useCol(staff ? () => query(collection(db, 'ventas'), where('dia', '>=', sumarDias(hoy(), -7))) : null, [staff]);
  const movDespacho = useCol(staff ? () => query(collection(db, 'movDespacho'), orderBy('fecha', 'desc'), limit(40)) : null, [staff]);

  const value = useMemo(() => {
    const prods = [...productos.data].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre));
    const ins = [...insumos.data].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.nombre.localeCompare(b.nombre));
    const errores = [productos, insumos, pedidos, ordenes, compras, clientes].map((x) => x.error).filter(Boolean);
    return {
      productos: prods, productosPorId: porId(prods),
      insumos: ins, insumosPorId: porId(ins),
      pedidos: pedidos.data, ordenes: ordenes.data, compras: compras.data,
      clientes: [...clientes.data].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      actividad: actividad.data, movimientos: movimientos.data, usuarios: usuarios.data, opiniones: opiniones.data,
      articulos: [...articulos.data].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'elaborado' ? -1 : 1) || (a.categoria || '').localeCompare(b.categoria || '') || a.nombre.localeCompare(b.nombre)),
      ventas: ventas.data, movDespacho: movDespacho.data,
      cargando: productos.cargando || pedidos.cargando || insumos.cargando,
      error: errores[0] || null,
    };
  }, [productos, insumos, pedidos, ordenes, compras, clientes, actividad, movimientos, usuarios, opiniones, articulos, ventas, movDespacho]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
