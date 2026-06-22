import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'vendor', 'noitamap', 'public');
const targetDir = path.join(rootDir, 'public', 'noitamap');

async function copyRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  try {
    await fs.access(sourceDir);
  } catch {
    console.error(`Source directory does not exist: ${sourceDir}`);
    console.error('Did you build noitamap? Run: cd vendor/noitamap && npm install && npm run build');
    process.exit(1);
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  await copyRecursive(sourceDir, targetDir);
  console.log(`Copied noitamap assets to ${targetDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
