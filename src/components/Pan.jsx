import { useEffect, useState } from 'react';

// Dibujos por defecto de los productos (como el limón de CitrusCode, pero de panadería).
// Se elige el dibujo según el nombre del producto. Todos son SVG propios.
const C = { corteza: '#C9822F', dorado: '#E5A54B', miga: '#F6D59A', claro: '#FBE7BF', sombra: '#9C5A1C', tomate: '#CD211D', queso: '#F5CD13', blanco: '#FFFDF5', sesamo: '#FFF1CC', verde: '#167B41' };

function Baguette() {
  return (
    <g>
      <ellipse cx="100" cy="128" rx="78" ry="8" fill="#000" opacity=".08" />
      <g transform="rotate(-18 100 80)">
        <rect x="18" y="62" width="164" height="38" rx="19" fill={C.corteza} />
        <rect x="22" y="64" width="156" height="22" rx="11" fill={C.dorado} />
        {[44, 72, 100, 128, 156].map((x) => <path key={x} d={`M${x - 10} 74 q10 -9 22 -2`} stroke={C.miga} strokeWidth="5" strokeLinecap="round" fill="none" />)}
      </g>
    </g>
  );
}

function Viena() {
  return (
    <g>
      <ellipse cx="100" cy="126" rx="80" ry="8" fill="#000" opacity=".08" />
      {[[32, 56], [72, 46], [112, 56]].map(([x, y], k) => (
        <g key={k}>
          <rect x={x} y={y} width="58" height="66" rx="29" fill={C.corteza} />
          <rect x={x + 6} y={y + 4} width="46" height="40" rx="23" fill={C.dorado} />
          <ellipse cx={x + 22} cy={y + 18} rx="9" ry="5" fill={C.claro} opacity=".7" />
        </g>
      ))}
    </g>
  );
}

function Hamburguesa() {
  const semillas = [[70, 62], [88, 52], [108, 50], [126, 58], [80, 76], [100, 68], [120, 74], [138, 70], [62, 78]];
  return (
    <g>
      <ellipse cx="100" cy="126" rx="70" ry="8" fill="#000" opacity=".08" />
      <path d="M36 98 Q36 38 100 38 Q164 38 164 98 Z" fill={C.dorado} />
      <path d="M36 98 Q36 38 100 38 Q164 38 164 98" fill="none" stroke={C.corteza} strokeWidth="4" />
      <rect x="34" y="96" width="132" height="22" rx="11" fill={C.corteza} />
      <rect x="40" y="98" width="120" height="8" rx="4" fill={C.miga} />
      {semillas.map(([x, y], k) => <ellipse key={k} cx={x} cy={y} rx="4" ry="2.2" fill={C.sesamo} transform={`rotate(${(k * 37) % 60 - 30} ${x} ${y})`} />)}
    </g>
  );
}

function Rosquilla() {
  return (
    <g>
      <ellipse cx="100" cy="128" rx="66" ry="8" fill="#000" opacity=".08" />
      <circle cx="100" cy="78" r="56" fill={C.dorado} />
      <circle cx="100" cy="78" r="56" fill="none" stroke={C.corteza} strokeWidth="4" />
      <path d="M100 26 a52 52 0 1 1 -0.1 0 Z M100 56 a22 22 0 1 0 0.1 0 Z" fill={C.blanco} fillRule="evenodd" opacity=".95" />
      <circle cx="100" cy="78" r="22" fill="#F7F6F1" stroke={C.corteza} strokeWidth="3" />
      {[[70, 50], [132, 56], [140, 92], [66, 100], [104, 122], [86, 38], [124, 116]].map(([x, y], k) => (
        <rect key={k} x={x} y={y} width="8" height="3" rx="1.5" fill={[C.verde, C.tomate, C.queso][k % 3]} transform={`rotate(${k * 47} ${x + 4} ${y + 1.5})`} />
      ))}
    </g>
  );
}

function Tostadas() {
  return (
    <g>
      <ellipse cx="100" cy="128" rx="72" ry="8" fill="#000" opacity=".08" />
      {[0, 1, 2].map((k) => (
        <g key={k} transform={`translate(${k * 14 - 14} ${k * -10}) rotate(${k * 4 - 4} 100 90)`}>
          <path d="M48 118 V70 Q48 42 74 42 Q84 30 100 30 Q116 30 126 42 Q152 42 152 70 V118 Z" fill={C.corteza} />
          <path d="M56 112 V72 Q56 50 78 50 Q86 40 100 40 Q114 40 122 50 Q144 50 144 72 V112 Z" fill={k === 2 ? C.dorado : C.miga} />
          {k === 2 && [[78, 70], [110, 64], [96, 90], [124, 92], [72, 98]].map(([x, y], j) => <circle key={j} cx={x} cy={y} r="2.5" fill={C.sombra} opacity=".35" />)}
        </g>
      ))}
    </g>
  );
}

function Prepizza() {
  return (
    <g>
      <ellipse cx="100" cy="126" rx="76" ry="9" fill="#000" opacity=".08" />
      <ellipse cx="100" cy="88" rx="78" ry="38" fill={C.corteza} />
      <ellipse cx="100" cy="84" rx="70" ry="32" fill={C.dorado} />
      <ellipse cx="100" cy="84" rx="60" ry="26" fill={C.tomate} />
      <ellipse cx="100" cy="84" rx="60" ry="26" fill="#000" opacity=".08" />
      {[[74, 78], [100, 70], [124, 80], [88, 94], [114, 96], [138, 88], [64, 90]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r="2.2" fill={C.verde} />)}
      <path d="M58 72 q12 -10 28 -8" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".35" />
    </g>
  );
}

function Pan() {
  return (
    <g>
      <ellipse cx="100" cy="126" rx="72" ry="8" fill="#000" opacity=".08" />
      <path d="M30 112 Q24 52 100 40 Q176 52 170 112 Z" fill={C.corteza} />
      <path d="M38 106 Q34 58 100 48 Q166 58 162 106 Z" fill={C.dorado} />
      {[64, 92, 120].map((x) => <path key={x} d={`M${x} 60 q14 20 8 40`} stroke={C.miga} strokeWidth="6" strokeLinecap="round" fill="none" />)}
    </g>
  );
}

const DIBUJOS = [
  [/franc[eé]s|baguette|flauta/i, Baguette],
  [/viena|pancho/i, Viena],
  [/hamburgues/i, Hamburguesa],
  [/rosquilla|rosca|dona/i, Rosquilla],
  [/tostada/i, Tostadas],
  [/pizza/i, Prepizza],
];

export function DibujoPan({ nombre = '', className = '' }) {
  const Comp = (DIBUJOS.find(([re]) => re.test(nombre)) || [null, Pan])[1];
  return (
    <svg className={`pan-svg ${className}`} viewBox="0 0 200 150" role="img" aria-label={`Dibujo de ${nombre}`}>
      <Comp />
    </svg>
  );
}

/** Imagen del producto: foto o IA si existe; si no hay (o si falla al cargar), el dibujo. */
export function ImagenProducto({ producto, className = '' }) {
  const url = producto?.imagen?.url;
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [url]);
  if (!url || fallo) return <DibujoPan nombre={producto?.nombre} className={className} />;
  return <img className={`prod-img ${className}`} src={url} alt={producto.nombre} loading="lazy" onError={() => setFallo(true)} />;
}
