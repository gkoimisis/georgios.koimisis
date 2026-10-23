/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { contentPlugin } from './scripts/content-plugin';

export default defineConfig({
  // Relative base so the build works on GitHub Pages project sites and Netlify alike.
  base: './',
  plugins: [preact(), contentPlugin()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
