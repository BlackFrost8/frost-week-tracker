import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyStoredTheme } from './lib/theme';
import './index.css';

// Before the first paint, not in an effect — otherwise every load flashes the
// default palette for a frame before settling into the chosen one.
applyStoredTheme();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found.');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
