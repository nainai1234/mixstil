import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Web deployments keep audio inventory behind the API/object-storage origin.
  // Copying the full local `public/audio` catalog into a static site would make
  // every frontend build impractically large.
  publicDir: mode === 'mobile' ? 'public-mobile' : 'public-web',
  build: {
    outDir: mode === 'mobile' ? 'dist-mobile' : 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/lib/i18n.ts')) return 'i18n';
          if (
            id.includes('/src/lib/api.ts')
            || id.includes('/src/lib/domain.ts')
            || id.includes('/src/lib/offlineLibrary.ts')
            || id.includes('/src/context/AudioContext.tsx')
            || id.includes('/src/lib/nativeMediaSession.ts')
          ) return 'app-core';
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8788',
      '/audio': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8788',
      '/exports': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8788',
    },
  },
}))
