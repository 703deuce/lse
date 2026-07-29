import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const headerInner = fs.readFileSync(path.join(root, 'partials/site-header.html'), 'utf8').trimEnd();
const footerInner = fs.readFileSync(path.join(root, 'partials/site-footer.html'), 'utf8').trimEnd();
const headerRoot = fs.readFileSync(path.join(root, 'partials/site-header-root.html'), 'utf8').trimEnd();
const footerRoot = fs.readFileSync(path.join(root, 'partials/site-footer-root.html'), 'utf8').trimEnd();

const rootIndex = path.join(root, 'index.html');
const htmlFiles = [];

if (fs.existsSync(rootIndex)) htmlFiles.push(rootIndex);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'index.html' && full !== rootIndex) htmlFiles.push(full);
  }
}

walk(root);

const headerRe = /<header class="site-header"[\s\S]*?<\/header>/;
const footerRe = /<footer class="site-footer"[\s\S]*?<\/footer>/;

let count = 0;
for (const file of htmlFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const isRoot = file === rootIndex;
  const header = isRoot ? headerRoot : headerInner;
  const footer = isRoot ? footerRoot : footerInner;

  if (!headerRe.test(content)) continue;

  content = content.replace(headerRe, header);
  content = content.replace(footerRe, footer);
  fs.writeFileSync(file, content);
  count++;
  console.log('Updated', path.relative(root, file));
}

console.log(`Done. Synced ${count} pages.`);
