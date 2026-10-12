# El Sol App · versiones para instalar

El Sol App es la versión sencilla y rápida del sistema (`/app`). Se puede usar de tres formas; las tres muestran lo mismo y usan los mismos datos que la página:

| Forma | Para qué | Qué hay que hacer |
|---|---|---|
| **Instalada desde el navegador** | Celular (Android o iPhone) y computadora | Nada que compilar. Ver la sección 1. |
| **APK para Android** | Entregar un archivo `.apk` para instalar en el celular | Compilar en la PC con Android Studio (sección 2). |
| **Instalador para Windows (.exe)** | Entregar un instalador para la computadora | Compilar en la PC con Node.js (sección 3). |

Las versiones APK y .exe son una "ventana" que abre la app publicada en `https://elsoltucumano.netlify.app/app/`. Por eso, **cada mejora que se publica en la página aparece sola en las apps**, sin volver a compilarlas.

---

## 1. Instalar desde el navegador (lo más rápido)

- **Android (Chrome):** entrar a `elsoltucumano.netlify.app/app` → menú ⋮ → **Instalar app**.
- **iPhone (Safari):** entrar a la misma dirección → botón Compartir → **Agregar a pantalla de inicio**.
- **Computadora (Chrome o Edge):** entrar a la dirección → ícono de instalar en la barra de direcciones (o menú → **Instalar El Sol App**).

Queda con su ícono del sol y abre en su propia ventana, sin barra del navegador.

---

## 2. APK para Android (Capacitor)

**Se necesita, una sola vez:** [Node.js 20 o más nuevo](https://nodejs.org) y [Android Studio](https://developer.android.com/studio) (al abrirlo por primera vez, dejar que descargue el SDK).

En una terminal, dentro de la carpeta `app\nativo\android`:

```bash
npm install
npm run preparar
npm run abrir
```

`npm run preparar` crea el proyecto Android (carpeta `android`) y `npm run abrir` lo abre en Android Studio. Ahí:

1. Esperar a que termine de sincronizar (barra de abajo).
2. Menú **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
3. Cuando termina, tocar **locate**: el archivo es `android\app\build\outputs\apk\debug\app-debug.apk`.

Ese `.apk` se pasa al celular (WhatsApp, Drive o cable) y se instala; Android pide permitir "instalar apps de origen desconocido".

**Ícono:** en Android Studio, clic derecho en `app → New → Image Asset` y elegir `icono.png` de esta carpeta.

---

## 3. Instalador para Windows (Electron)

**Se necesita, una sola vez:** [Node.js 20 o más nuevo](https://nodejs.org).

En una terminal, dentro de la carpeta `app\nativo\escritorio`:

```bash
npm install
npm start
npm run dist
```

- `npm start` abre la app en una ventana para probarla.
- `npm run dist` genera el instalador en `dist\ElSolApp-Setup-1.0.0.exe`. Al instalarlo crea el acceso directo en el escritorio y en el menú Inicio.

Windows puede mostrar "Windows protegió su PC" porque el instalador no está firmado: **Más información → Ejecutar de todas formas**.

---

## 4. Sin instalar nada: compilación automática en GitHub

El repositorio tiene una tarea automática (`.github/workflows/apps-nativas.yml`) que compila el `.exe` y el `.apk` en los servidores de GitHub cada vez que se actualiza la rama `apps-nativas`, y los publica en la sección **Releases** del repositorio, listos para descargar.

## Notas

- Si la dirección de la página cambia, se actualiza en `android/capacitor.config.json` (`server.url`) y en `escritorio/main.js` (`URL_APP`).
- WhatsApp y Google Maps se abren en la app o el navegador del dispositivo.
- Sin internet, las apps muestran un aviso para reintentar: los datos se consultan siempre en vivo.
