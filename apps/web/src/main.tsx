import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './styles.css';
import './styles/tokens.css';
import './styles/primitives.css';
import './styles/hud.css';
import './styles/map.css';
import './styles/sheets.css';
import './styles/pages.css';
import './styles/admin.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el contenedor principal de la aplicación.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
