import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  // Read without the VITE_ prefix filter so the target stays server-side only.
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://localhost:3000'

  return {
    // The public site owns the origin root; the portal lives under /volunteer-portal/.
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': { target, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
      },
    },
    preview: {
      port: 5174,
      strictPort: true,
      allowedHosts: ['.trycloudflare.com'],
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
