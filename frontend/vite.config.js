import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Development me /api ki saari requests backend (port 4000) par forward hoti hain,
// isliye CORS ki tension nahi.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
