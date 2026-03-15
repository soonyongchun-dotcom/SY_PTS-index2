const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../dist');
const src = path.join(distDir, 'index.html');
const dest = path.join(distDir, 'index2.html');

try {
  if (!fs.existsSync(src)) {
    console.warn('dist/index.html not found; skipping index2 copy.');
    process.exit(0);
  }
  fs.copyFileSync(src, dest);
  console.log('Copied dist/index.html to dist/index2.html');
} catch (err) {
  console.error('Failed to copy index.html to index2.html:', err);
  process.exit(1);
}
