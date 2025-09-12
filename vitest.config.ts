import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['tests/**/*', 'dist/**/*', 'vitest.config.ts'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
