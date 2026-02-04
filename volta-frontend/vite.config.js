import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Acceptă conexiuni de pe toate interfețele
    port: 5173,
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/storage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    // Warm up frequently used files - eliminates transform waterfalls on first load
    warmup: {
      clientFiles: [
        './src/App.jsx',
        './src/main.jsx',
        './src/pages/DashboardPage.jsx',
        './src/pages/CoursesPage.jsx',
        './src/pages/LoginPage.jsx',
        './src/components/SplashScreen.jsx',
        './src/contexts/AuthContext.jsx',
      ],
    },
  },
  build: {
    // Code splitting optimization
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks - smaller = faster parallel load
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('axios')) {
              return 'axios-vendor';
            }
            if (id.includes('@dnd-kit')) {
              return 'dnd-vendor';
            }
            if (id.includes('recharts')) {
              return 'charts-vendor';
            }
            return 'vendor';
          }
        },
        // Inline small assets for fewer requests
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    // Optimize chunk size - increased limit for better splitting
    chunkSizeWarningLimit: 1500,
    // Enable source maps for production debugging (optional)
    // Set to true if you need debugging in production, but increases bundle size
    sourcemap: false,
    // Minification
    minify: 'esbuild',
    // Target modern browsers for smaller bundles
    target: 'esnext',
    // Output directory for production build
    outDir: 'dist',
    // Assets directory
    assetsDir: 'assets',
  },
  // Optimize dependencies - pre-bundle for faster dev startup
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      'recharts',
    ],
  },
})
