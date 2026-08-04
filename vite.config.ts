/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Project-site GitHub Pages deployment: tumasasmonas-alt.github.io/slime-td/
// Every asset URL must be relative to this base or it 404s once deployed.
export default defineConfig({
  base: '/slime-td/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
