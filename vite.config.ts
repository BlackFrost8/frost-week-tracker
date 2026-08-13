import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base: './'` emits relative asset paths, which works both on a GitHub Pages
// project site (user.github.io/<repo>/) and when served from the domain root.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
