import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes rarely; separate chunks stay cached across deploys.
        manualChunks: {
          ethers: ['ethers'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
