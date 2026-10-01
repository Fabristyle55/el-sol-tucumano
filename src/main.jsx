import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { ToastProvider } from './ui';
import './styles.css';

// App instalable (PWA): solo en la página publicada, no en desarrollo.
if ('serviceWorker' in navigator && import.meta.env?.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// Luz que sigue al mouse en los indicadores (.kpi).
document.addEventListener('pointermove', (e) => {
  const k = e.target.closest?.('.kpi');
  if (!k) return;
  const r = k.getBoundingClientRect();
  k.style.setProperty('--mx', `${e.clientX - r.left}px`);
  k.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
