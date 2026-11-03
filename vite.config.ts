import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'font-license-notices',
      generateBundle() {
        for (const family of ['dm-sans', 'source-sans-3', 'lora']) {
          this.emitFile({
            type: 'asset',
            fileName: `licenses/${family}-OFL.txt`,
            source: readFileSync(
              new URL(`./node_modules/@fontsource/${family}/LICENSE`, import.meta.url),
              'utf8',
            ),
          });
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@cv/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@cv/renderer': fileURLToPath(new URL('./packages/renderer/src/index.tsx', import.meta.url)),
    },
  },
  test: { include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'] },
});
