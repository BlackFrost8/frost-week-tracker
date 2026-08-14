import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, loadTheme } from './lib/theme';
import './index.css';

// Before the first paint, not in an effect — otherwise every load flashes the
// default palette for a frame before settling into the chosen one. The tab
// name comes off the same read: it is the theme's name, so setting it from
// React would leave the previous one showing until the app mounts.
const storedTheme = loadTheme();
applyTheme(storedTheme.spec);
document.title = storedTheme.name.trim() || 'Week tracker';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found.');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
