// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  build: {
    format: 'directory',
    assets: '_assets'
  },
  vite: {
    build: {
      cssCodeSplit: false
    },
    optimizeDeps: {
      exclude: []
    },
    server: {
      watch: {
        usePolling: true
      }
    }
  }
});
