import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The React app talks to the Node API through this proxy in development.
    proxy: { '/api': 'http://localhost:4000' },
    // Allow importing ../shared/questions.json (the offline fallback copy).
    fs: { allow: ['..'] },
  },
});
