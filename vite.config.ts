import { defineConfig } from 'vite';

// GitHub Pages serves project sites under /<repo>/, while local dev runs at
// the root. The deploy workflow always runs with CI=true, so this keeps both
// worlds correct without touching the dev workflow.
export default defineConfig({
  // GitHub normalizes the Pages URL to lowercase.
  base: process.env.CI ? '/noita-livemap/' : '/',
});
