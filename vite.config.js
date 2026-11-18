import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@firebase/database/')) return 'firebase-database';
          if (id.includes('/node_modules/@firebase/auth/')) return 'firebase-auth';
        },
      },
    },
  },
  plugins: [vue(), {
    name: 'offline-shell',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', ...Object.keys(bundle)];
      const template = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8');
      const version = createHash('sha256').update(template + files.join('|')).digest('hex').slice(0, 16);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source:
        template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files)),
      });
    },
  }],
});
