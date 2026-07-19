import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OG_BLOCK = `
  <meta property="og:image" content="https://localseoexpress.com/images/logo.svg">
  <meta name="twitter:image" content="https://localseoexpress.com/images/logo.svg">`;

for (const file of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const fp = path.join(ROOT, file);
  let html = fs.readFileSync(fp, 'utf8');
  if (html.includes('og:image')) continue;
  if (html.includes('og:locale')) {
    html = html.replace(
      '<meta property="og:locale" content="en_US">',
      `<meta property="og:locale" content="en_US">${OG_BLOCK}`
    );
  } else if (html.includes('og:site_name')) {
    html = html.replace(
      '<meta property="og:site_name" content="Local SEO Express">',
      `<meta property="og:site_name" content="Local SEO Express">${OG_BLOCK}`
    );
  } else {
    html = html.replace(
      /<link rel="canonical"[^>]+>/,
      (m) => `${m}\n${OG_BLOCK.trim()}`
    );
  }
  fs.writeFileSync(fp, html);
  console.log(`Added og:image to ${file}`);
}
