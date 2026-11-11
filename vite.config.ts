import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// genmap.html imports ./live-link.mjs and ./genmap-viewer.mjs, which the
// genmap server serves from src/ in normal use. For the Pages build (and any
// static serving of public/genmap.html), copy them next to the built page so
// the relative imports resolve.
function copyViewerModules(): Plugin {
  return {
    name: 'copy-viewer-modules',
    closeBundle() {
      for (const f of ['live-link.mjs', 'genmap-viewer.mjs']) {
        fs.copyFileSync(path.resolve(`src/${f}`), path.resolve(`dist/${f}`));
      }
    },
  };
}

export default defineConfig({
  plugins: [copyViewerModules()],
  // GitHub normalizes the Pages URL to lowercase.
  base: process.env.CI ? '/noita-livemap/' : '/',
});
