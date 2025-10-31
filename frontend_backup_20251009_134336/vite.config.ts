import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          chakra: ['@chakra-ui/react', '@chakra-ui/icons'],
          router: ['react-router-dom'],
          state: ['zustand'],
          pages: [
            './src/pages/MainDashboard.tsx',
            './src/pages/SchedulePageV2.tsx',
            './src/pages/PhotoGalleryPage.tsx',
            './src/pages/VideoGalleryPage.tsx',
            './src/pages/AdminPageNew.tsx'
          ],
          components: [
            './src/components/Header.tsx',
            './src/components/MemberManagement.tsx',
            './src/components/GameManagement.tsx'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2015',
    cssCodeSplit: true,
    reportCompressedSize: true
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@chakra-ui/react', 'react-router-dom', 'zustand']
  }
})
