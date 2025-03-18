import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'window',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-app': ['firebase/app'],
          'firebase-auth': ['firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          'ai-deps': ['@anthropic-ai/sdk', '@pinecone-database/pinecone'],
          'react-vendor': ['react', 'react-dom'],
          'ui': ['@headlessui/react', '@heroicons/react']
        }
      }
    },
    chunkSizeWarningLimit: 1200
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})
