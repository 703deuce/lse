import fs from 'fs';
const file = process.argv[2];
const isRoot = process.argv[3] === 'root';
let c = fs.readFileSync(file, 'utf8');
if (isRoot) {
  c = c.replace(/href="\//g, (m, offset, str) => {
    // skip https:// in link rel canonical - those use href="https
    return 'href="';
  });
  c = c.replace(/href=""\b/g, 'href="./"');
  c = c.replace(/href="(?!https|mailto|tel|#)([^"]*)"/g, (m, path) => {
    if (!path || path === './') return m;
    return `href="${path}"`;
  });
} else {
  c = c.replace(/href="\//g, 'href="../');
  c = c.replace(/href="\.\.\/"\b/g, 'href="../"');
}
fs.writeFileSync(file, c);
console.log('Fixed', file);
