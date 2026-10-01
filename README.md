# El Sol Tucumano · Sistema de gestión

Sistema de pedidos, planificación de la producción (MRP básico), stock y compras para la panadería **El Sol Tucumano**.
Proyecto del Seminario Integrador · UTN Facultad Regional Tucumán · 2026.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite, React Router |
| Backend | Node.js en Netlify Functions (`netlify/functions`) |
| Base de datos | Firebase Firestore (tiempo real) |
| Usuarios | Firebase Authentication (email y contraseña) con roles |
| Hosting | Netlify |
| Avisos (opcional) | Webhook a n8n → Telegram / Gmail (Etapa 1) |

## Estructura

```
app/
├── src/                 Frontend React
│   ├── pages/           Una pantalla por módulo (Panel, Pedidos, Planificación…)
│   ├── components/      Layout y formulario de pedido
│   ├── auth.jsx         Sesión y perfil (rol) del usuario
│   ├── data.jsx         Suscripciones en tiempo real a Firestore según el rol
│   └── api.js           Llamadas al backend
├── netlify/functions/   Backend en Node.js (reglas del negocio)
├── shared/negocio.js    Cálculo de insumos, reservas y alertas (lo usan frontend y backend)
├── scripts/seed.mjs     Carga de datos iniciales y usuarios de prueba
├── firestore.rules      Reglas de seguridad de la base de datos
└── tests/               Pruebas de la lógica de negocio
```

## Roles

| Rol | Puede |
|---|---|
| Gerente | Todo: confirmar pedidos, planificar, editar recetas y precios, autorizar compras, dar de alta usuarios |
| Mostrador | Cargar pedidos de clientes que piden en el local y marcar entregas |
| Panadero | Ver y completar las órdenes de producción; ver recetas |
| Depósito | Ver stock, registrar ingresos y ajustes, recibir compras |
| Cliente | Mayorista (comercio) o minorista (particular). Hace pedidos desde el catálogo con su lista de precios, elige envío o retiro en el local y sigue el estado |

## Puesta en marcha (una sola vez)

### 1. Instalar programas
- **Node.js 20 o más nuevo** (versión LTS): https://nodejs.org
- **Netlify CLI**: en una terminal, `npm install -g netlify-cli`

### 2. Clave del servidor (cuenta de servicio de Firebase)
El backend necesita una clave para escribir en la base de datos.
1. Firebase → ⚙️ **Configuración del proyecto** → pestaña **Cuentas de servicio** → **Generar nueva clave privada**. Se descarga un archivo `.json`.
2. En la carpeta `app`, copiá `.env.example` y renombrá la copia a `.env`.
3. Abrí el `.json` descargado y pasá a `.env` estos tres valores:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (entre comillas dobles, tal cual, con los `\n`)
4. **No subas nunca el `.json` ni el `.env` a GitHub.** Ya están en `.gitignore`.

### 3. Reglas de seguridad
Firebase → **Firestore Database** → pestaña **Reglas** → borrá lo que hay, pegá el contenido de `firestore.rules` → **Publicar**.

### 4. Instalar y cargar datos de ejemplo
En una terminal, dentro de la carpeta `app`:
```bash
npm install
npm run seed
```
Esto crea los insumos, productos con recetas, clientes, algunos pedidos y un usuario por rol:

| Email | Rol |
|---|---|
| gerente@elsol.demo | Gerente |
| mostrador@elsol.demo | Mostrador |
| panadero@elsol.demo | Panadero |
| deposito@elsol.demo | Depósito |
| cliente@elsol.demo | Cliente mayorista (Almacén Don Pedro) |
| minorista@elsol.demo | Cliente minorista (Laura Gómez) |

Contraseña de todos: **elsol2026**. Cambiala antes de usar el sistema con datos reales.

### 5. Correr la app en tu compu
```bash
npm run dev
```
Abrí http://localhost:8888. Con `netlify dev` funcionan juntos el frontend y el backend.
(`npm run dev:front` levanta solo React en el puerto 5173, sin backend: sirve para trabajar en el diseño.)

## Publicar en Netlify

Las funciones del backend necesitan que Netlify construya el proyecto, así que **no sirve arrastrar la carpeta**. Se publica desde GitHub:

1. Subí la carpeta `app` a un repositorio de GitHub.
2. Netlify → **Add new site** → **Import an existing project** → GitHub → elegí el repositorio.
3. Netlify lee `netlify.toml` solo (build: `npm run build`, carpeta: `dist`).
4. Antes de publicar, en **Site configuration → Environment variables** agregá `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` con los mismos valores del `.env`.
5. **Deploy**. Cada vez que hagas `git push`, Netlify publica la versión nueva.

La raíz del sitio abre directamente el ingreso al sistema.

## Cómo funciona el flujo

1. **Pedido**: el cliente lo hace desde el catálogo (canal web) o el mostrador lo carga (canal mostrador). Puede ser de un cliente **mayorista** o **minorista**: cada producto tiene un precio para cada uno, y el backend aplica el que corresponde. Se elige **envío** o **retiro en el local**. Queda *pendiente*.
2. **Confirmación**: el gerente lo confirma o lo cancela.
3. **Planificación** (`generar-ordenes`): para un día de entrega, suma los pedidos confirmados y la producción extra para el local, multiplica por las recetas y controla que alcance el stock disponible (stock − reservado). Si alcanza, crea una orden de producción por producto, reserva los insumos y pasa los pedidos a *en producción*.
4. **Producción** (`orden-estado`): el panadero empieza y termina cada orden. Al terminarla se descuentan los insumos y se registran los movimientos. Cuando se terminan todas las órdenes del día, los pedidos pasan a *listo para reparto*.
5. **Compras** (`compra`): el sistema calcula el stock proyectado = stock − reservado − pedidos confirmados sin planificar + compras en camino. Si queda por debajo del stock de seguridad, sugiere comprar en múltiplos del envase del proveedor. El gerente autoriza y el depósito registra la recepción.
6. **Entrega**: el pedido se marca como *entregado*.

Cada acción queda registrada en la colección `actividad` con quién la hizo y cuándo.

## Avisos por Telegram o mail (opcional)

Si definís la variable `N8N_WEBHOOK_URL` con la URL de un webhook de n8n, el backend envía un evento en cada paso importante (`pedido_creado`, `pedido_confirmado`, `pedido_cancelado`, `pedido_entregado`, `ordenes_generadas`, `pedidos_listos`, `compra_autorizada`, `cliente_registrado`). Así se pueden reutilizar los flujos de n8n de la Etapa 1 para mandar Telegram al dueño y al repartidor, o mails al cliente.

## Pruebas

```bash
npm test
```
Prueban el cálculo de insumos, las reservas, los faltantes y la proyección de compras.
