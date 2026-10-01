# El Sol Siciliano · Sistema de gestión

Sistema de pedidos, planificación de la producción (MRP básico), stock y compras para la panadería **El Sol Siciliano** (Tucumán).
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
├── public/presentacion/ Sitio de presentación del proyecto
└── tests/               Pruebas de la lógica de negocio
```

## Roles

| Rol | Puede |
|---|---|
| Gerente | Todo: confirmar pedidos, planificar, editar recetas y precios, autorizar compras, dar de alta usuarios |
| Mostrador | Cargar pedidos de clientes que piden en el local y marcar entregas |
| Panadero | Ver y completar las órdenes de producción; ver recetas |
| Depósito | Ver stock, registrar ingresos y ajustes, recibir compras |
| Repartidor | Ver los envíos del día en el celular, cómo llegar, avisar por WhatsApp, cobrar y marcar cada entrega |
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
| repartidor@elsol.demo | Repartidor |
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

La raíz del sitio muestra la presentación del proyecto; "Ingresar al sistema" lleva al login.

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

## Productos: fotos, IA y opiniones

- **Imágenes:** el gerente y el mostrador entran a **Productos → Cambiar imagen** y pueden subir una foto (se achica sola en el navegador), generar una con IA o volver al dibujo. Las fotos se guardan en **Netlify Blobs** (gratis, sin configurar nada). La IA usa el servicio gratuito Pollinations, que no pide clave; por ser gratuito, la imagen lleva una pequeña marca "pollinations.ai".
- **Dibujos por defecto:** si un producto no tiene imagen, se muestra un dibujo según su nombre (pan francés, viena, pan de hamburguesa, rosquilla, tostadas, prepizza o un pan genérico).
- **Opiniones:** los clientes, mayoristas y minoristas, califican cada producto de 1 a 5 estrellas y pueden dejar un comentario. Cada cliente tiene una opinión por producto y la puede editar o borrar; el gerente puede borrar cualquiera.
- **Importante:** las opiniones necesitan las reglas nuevas de `firestore.rules`. Cada vez que cambie ese archivo hay que volver a pegarlo en Firebase → Firestore Database → Reglas → Publicar.

## Pruebas

```bash
npm test
```
Prueban el cálculo de insumos, las reservas, los faltantes y la proyección de compras.

## Funciones agregadas (octubre 2026)

| Función | Dónde | Qué hace |
|---|---|---|
| Cierre de caja | Despacho → Caja | El mostrador cuenta el efectivo al final del día y el sistema lo compara con lo vendido en efectivo (ventas + reservas retiradas). Muestra si sobra o falta. |
| Vencimientos y ofertas | Despacho → Stock | La reventa se carga con fecha de vencimiento. El sistema avisa 3 días antes y permite poner el artículo en oferta (% de descuento). |
| Mermas | Despacho → Stock → Merma | Lo que sobró, venció o se rompió sale del stock y queda registrado. En Planificación se sugiere el "extra para el local" según lo que sobró la última semana. |
| Cuenta corriente | Cuentas corrientes | Los pedidos mayoristas pagados en cuenta corriente se suman al saldo al entregarlos. El gerente registra los pagos y ve las deudas vencidas (plazo por cliente). |
| Hoja de reparto | Pedidos → Hoja de reparto | Pedidos con envío del día agrupados por localidad, con dirección, teléfono y monto a cobrar. Se imprime o se guarda en PDF. |
| Costo y margen | Recetas (y costo por insumo en Stock) | Costo de cada producto según su receta y el margen mayorista y minorista. |
| Pedidos recurrentes | Mis pedidos / Pedidos | "Repetir pedido" y pedido fijo semanal para mayoristas. Una función programada (`pedidos-fijos-cron`) los genera todas las noches a las 20 h como pendientes. |
| Comprobantes | Pedidos, Mis pedidos, Despacho | Remito, comprobante de reserva y ticket de venta, listos para guardar en PDF. |
| Avisos por mail | Automático | Mail al cliente cuando se recibe o confirma su pedido y cuando su reserva está lista. Ver abajo cómo activarlo. |
| Reportes | Reportes | Ventas por mes, productos y reventa más vendidos, consumo de insumos y mayoristas contra minoristas. Exporta a Excel (.xlsx). |
| Historial de cambios | Historial de cambios | Quién hizo cada acción y cuándo, con búsqueda, filtros y exportación a Excel. No se puede borrar ni modificar. |
| App instalable (PWA) | Botón "Instalar la app" | Se puede agregar a la pantalla de inicio del celular o la PC y avisa cuando no hay conexión. |
| Recorrido de demostración | Recorrido de demostración | Un pedido de punta a punta, paso a paso, usando las funciones reales del sistema. Ideal para la presentación. |

## Funciones agregadas (octubre 2026, segunda tanda)

| Función | Dónde | Qué hace |
|---|---|---|
| Rol Repartidor | Entregas del día | Pantalla para el celular con los envíos del día: "Salgo a repartir", cómo llegar (Google Maps), llamar, WhatsApp "Estoy llegando", marcar entregado con lo cobrado o "No pude entregar" con el motivo. Lo cobrado en efectivo entra en el cierre de caja. El pedido pasa por el estado nuevo **En camino**. |
| Avisos por WhatsApp | Pedidos, Despacho → Reservas, Cuentas corrientes, Entregas | Botón que abre WhatsApp con el mensaje ya armado según el estado del pedido o el saldo de la cuenta. No usa ninguna API ni tiene costo. |
| Seguimiento del pedido | Mis pedidos | Línea de tiempo con íconos y la hora de cada paso: recibido, confirmado, en el horno, listo, en camino y entregado (o retirado). |
| Promociones y cupones | Promociones y cupones (gerente), Catálogo, Cargar pedido | Descuento por cantidad (ej.: 10 % llevando 50 o más) que se aplica solo, y cupones con código, compra mínima, vencimiento y límite de usos. El precio final lo calcula siempre el backend. |
| Gráficos en el Panel | Panel | Ventas de los últimos 30 días por día (mayoristas y minoristas) con comparación contra los 30 anteriores, productos que más facturan y margen de cada producto. |
| Campanita de avisos | Arriba a la derecha | Avisos en tiempo real según el rol (pedidos por confirmar, reservas, stock, cuentas vencidas, envíos listos; al cliente, cada cambio de su pedido). Puede mostrar notificaciones del navegador. |
| Accesibilidad y celular | Toda la app | Botones más grandes en pantallas táctiles, diálogos tipo "hoja" en el celular, enlace "Saltar al contenido", foco ordenado en los diálogos y anuncios para lectores de pantalla. |
| Respaldo automático | Historial y respaldos | Todos los domingos se guarda una copia completa de la base de datos (Netlify Blobs, se conservan 12). El gerente puede hacer uno al momento y descargarlo en .json. |

Para una base que ya estaba cargada: `npm run datos-nuevos` crea el usuario repartidor y promociones de ejemplo, y `npm run reglas` publica `firestore.rules` en Firebase sin tener que pegarlas a mano.

### Activar los avisos por mail (opcional)

1. Crear una cuenta gratis en [resend.com](https://resend.com) (100 mails por día) y generar una API key.
2. En Netlify → Site configuration → Environment variables agregar:
   - `RESEND_API_KEY` = la clave de Resend
   - `MAIL_FROM` = por ejemplo `El Sol Siciliano <pedidos@tudominio.com>` (el dominio tiene que estar verificado en Resend; sin dominio propio, Resend solo deja mandar al mail de la cuenta).
3. Volver a publicar el sitio. Sin estas variables el sistema funciona igual, solo que no manda mails.
