import { copyFileSync } from 'fs';
import { join } from 'path';

copyFileSync(
  join(process.cwd(), 'dist', 'index.html'),
  join(process.cwd(), 'dist', '404.html')
);
console.log('Created 404.html for GitHub Pages routing');

