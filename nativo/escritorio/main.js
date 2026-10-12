// El Sol App para escritorio (Windows): una ventana propia que abre la app publicada.
// Los datos y las reglas siguen en la nube; acá solo está la ventana.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const URL_APP = process.env.EL_SOL_URL || 'https://elsoltucumano.netlify.app/app/';
const ORIGEN = new URL(URL_APP).origin;

function crearVentana() {
  const win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 380,
    minHeight: 560,
    title: 'El Sol App',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#F4F5F3',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadURL(URL_APP);

  // WhatsApp, Google Maps y cualquier sitio externo se abren en el navegador del sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(ORIGEN)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGEN)) { e.preventDefault(); shell.openExternal(url); }
  });

  // Sin conexión al abrir: muestra un aviso simple y reintenta.
  win.webContents.on('did-fail-load', (_e, codigo) => {
    if (codigo === -3) return; // navegación cancelada, no es un error
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><body style="font-family:Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#F4F5F3;color:#121814"><div style="text-align:center"><h2>No hay conexión</h2><p>El Sol App necesita internet para ver los datos al día.</p><button onclick="location.href='${URL_APP}'" style="padding:10px 18px;border:0;border-radius:8px;background:#167B41;color:#fff;font-size:15px">Reintentar</button></div></body>`)}`);
  });
}

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  crearVentana();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
