import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import setupMetadataTests from './services/metadataTestScript';

// Inicializar herramientas de debug para desarrollo
if (import.meta.env.DEV) {
  setupMetadataTests();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
