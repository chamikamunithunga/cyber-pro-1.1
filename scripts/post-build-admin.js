// Post-build script to rename admin.html to index.html for Vercel
import fs from 'fs';
import path from 'path';

const distDir = 'dist-admin';
const adminHtml = path.join(distDir, 'admin.html');
const indexHtml = path.join(distDir, 'index.html');

if (fs.existsSync(adminHtml)) {
  fs.copyFileSync(adminHtml, indexHtml);
  console.log('✅ Copied admin.html to index.html for Vercel deployment');
} else {
  console.warn('⚠️ admin.html not found in dist-admin directory');
}

