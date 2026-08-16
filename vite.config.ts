import { defineConfig } from 'vite';

// GitHub Pages serves this as a project site at /rootwaker/ — only prefix
// the base path for production builds so local dev stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/rootwaker/' : '/',
}));
