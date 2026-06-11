/* Postbuild for GitHub Pages:
   1. Copy index.html to 404.html so unknown paths still load the SPA.
   2. Pre-render a real <route>/index.html for every deep-link route so those
      URLs return HTTP 200 (GitHub Pages serves 404.html with a 404 status,
      which search engines refuse to index). Each copy gets a route-specific
      <title>, canonical and og:url so the indexed pages aren't duplicates. */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SITE = 'https://andyxu.dev';

/* Route → title shown in search results. Keep in sync with windowConfig.ts
   (ROUTE_FOR_WINDOW) and public/sitemap.xml. */
const ROUTES = {
  projects: 'Projects — Andy Xu',
  fun: 'Fun — Andy Xu',
  about: 'About Me — Andy Xu',
  resume: 'Résumé — Andy Xu',
  writings: 'Writings — Andy Xu',
  chess: 'Andy Chess Bot — Andy Xu',
  desktop: 'Desktop — Andy Xu', // shareable, but intentionally not in the sitemap
};

const distPath = join(__dirname, 'dist');
const indexHtmlPath = join(distPath, 'index.html');

try {
  const indexHtml = readFileSync(indexHtmlPath, 'utf8');

  writeFileSync(join(distPath, '404.html'), indexHtml, 'utf8');
  console.log('✓ Copied index.html to 404.html');

  for (const [route, title] of Object.entries(ROUTES)) {
    const url = `${SITE}/${route}/`;
    const html = indexHtml
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(
        /<link rel="canonical" href="[^"]*"/,
        `<link rel="canonical" href="${url}"`,
      )
      .replace(
        /<meta property="og:url" content="[^"]*"/,
        `<meta property="og:url" content="${url}"`,
      )
      .replace(
        /<meta property="og:title" content="[^"]*"/,
        `<meta property="og:title" content="${title}"`,
      );
    const dir = join(distPath, route);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf8');
    console.log(`✓ Pre-rendered /${route}/index.html`);
  }
} catch (error) {
  console.error('Error in postbuild (copy-404.js):', error);
  process.exit(1);
}
