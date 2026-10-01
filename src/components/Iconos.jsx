// Íconos de línea (estilo Lucide, dibujados a mano) para el menú y el buscador.
const P = {
  panel: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  despacho: 'M3 9l1.5-5h15L21 9M3 9h18v11H3zM3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6',
  pedidos: 'M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 12h6M9 16h4',
  planificacion: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 14h3M13 14h3M8 18h3',
  produccion: 'M12 3c1.5 3 5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5M12 21v-4',
  stock: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  compras: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6M10 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM17 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  recetas: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5M9 7h7M9 11h5',
  productos: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  cuentas: 'M3 6h18v12H3zM3 10h18M7 15h4',
  promociones: 'M9 15l6-6M9.5 9.5h.01M14.5 14.5h.01M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a3 3 0 0 0 0 6v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a3 3 0 0 0 0-6z',
  reportes: 'M3 3v18h18M8 17V11M13 17V7M18 17v-4',
  historial: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  usuarios: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  recorrido: 'M5 3l14 9-14 9z',
  entregas: 'M1 4h13v12H1zM14 8h4l3 3v5h-7M5.5 20.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 20.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  reparto: 'M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3zM9 3v15M15 6v15',
  catalogo: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  'mis-pedidos': 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M7.5 5.5l9 5',
  comprobante: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6',
  buscar: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  pedido: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z',
  cliente: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  tema: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  ok: 'M20 6L9 17l-5-5',
  error: 'M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  flecha: 'M5 12h14M13 6l6 6-6 6',
};

export function Icono({ n, size = 18, className = '' }) {
  const d = P[n];
  if (!d) return null;
  return (
    <svg className={`ico ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
