import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { DataProvider } from './data';
import { ROLES } from './util';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Panel from './pages/Panel';
import Pedidos from './pages/Pedidos';
import Planificacion from './pages/Planificacion';
import Produccion from './pages/Produccion';
import Stock from './pages/Stock';
import Recetas from './pages/Recetas';
import Compras from './pages/Compras';
import Usuarios from './pages/Usuarios';
import Catalogo from './pages/Catalogo';
import Productos from './pages/Productos';
import MisPedidos from './pages/MisPedidos';

const PAGINAS = {
  panel: Panel, pedidos: Pedidos, planificacion: Planificacion, produccion: Produccion, stock: Stock,
  productos: Productos, recetas: Recetas, compras: Compras, usuarios: Usuarios, catalogo: Catalogo, 'mis-pedidos': MisPedidos,
};

export default function App() {
  const { cargando, user, perfil } = useAuth();
  if (cargando) return <div className="spinner"><img src="/marca/sol-192.png" alt="" /><span>Conectando con el sistema<span className="loading-dots"><i /><i /><i /></span></span></div>;

  // Sin sesión: solo login y registro de clientes.
  if (!user) {
    return (
      <Routes>
        <Route path="/registro" element={<Registro />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  // Con sesión pero sin perfil: tiene que completar el registro del comercio.
  if (!perfil || !ROLES[perfil.rol]) return <Registro completar />;

  const vistas = ROLES[perfil.rol].vistas;
  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          {vistas.map((v) => {
            const P = PAGINAS[v];
            return <Route key={v} path={`/${v}`} element={<P />} />;
          })}
          <Route path="*" element={<Navigate to={`/${vistas[0]}`} replace />} />
        </Route>
      </Routes>
    </DataProvider>
  );
}
