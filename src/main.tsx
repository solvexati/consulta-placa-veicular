import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import AuthGate from './AuthGate';
import './index.css';

// Registra o Service Worker (autoUpdate: aplica novas versões automaticamente)
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);
