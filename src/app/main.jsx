// El Sol App: versión sencilla y de navegación rápida del sistema, para celular y escritorio.
// Usa la misma sesión, los mismos datos en vivo y el mismo backend que la página completa.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../auth';
import { ToastProvider } from '../ui';
import AppMovil from './AppMovil';
import '../styles.css';
import './app.css';

// Instalable y con arranque rápido: solo en la página publicada.
if ('serviceWorker' in navigator && import.meta.env?.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// Guarda el aviso de "instalar app" para ofrecerlo desde la pestaña Más.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__elSolInstalar = e;
  window.dispatchEvent(new Event('el-sol-instalable'));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/app">
      <AuthProvider>
        <ToastProvider>
          <AppMovil />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
