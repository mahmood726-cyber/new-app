import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/fixtures/']
    },
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js']
  },
  resolve: {
    alias: {
      '@': '/src',
      '@analysis': '/src/analysis',
      '@extraction': '/src/extraction',
      '@search': '/src/search'
    }
  }
});
