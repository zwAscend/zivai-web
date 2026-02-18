import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const devHost = process.env.VITE_DEV_HOST || 'localhost';
const devPort = Number(process.env.VITE_DEV_PORT || 5173);
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: devHost,
    port: devPort,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: devHost,
      port: devPort,
      clientPort: devPort,
    },
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
