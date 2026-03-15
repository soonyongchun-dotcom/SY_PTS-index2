const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../dist');
const docsDir = path.resolve(__dirname, '../docs');

function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

removeDir(docsDir);
if (!fs.existsSync(distDir)) {
  console.warn('dist folder not found; skipping docs copy.');
  process.exit(0);
}
copyDir(distDir, docsDir);
console.log('Copied dist -> docs (for GitHub Pages)');
