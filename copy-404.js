import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = join(__dirname, 'dist');
const indexHtmlPath = join(distPath, 'index.html');
const notFoundHtmlPath = join(distPath, '404.html');

try {
  const indexHtml = readFileSync(indexHtmlPath, 'utf8');
  writeFileSync(notFoundHtmlPath, indexHtml, 'utf8');
  console.log('✓ Copied index.html to 404.html');
} catch (error) {
  console.error('Error copying index.html to 404.html:', error);
  process.exit(1);
}

