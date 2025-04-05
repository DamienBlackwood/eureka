// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
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
