import path from 'node:path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@onyu/shared': path.resolve(__dirname, '../../libs/shared/src'),
      '@onyu/bot-api-client': path.resolve(__dirname, '../../libs/bot-api-client/src'),
      'src/': path.resolve(__dirname, 'src') + '/',
    },
  },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
