import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'about/index.html');
let c = fs.readFileSync(file, 'utf8');
c = c.replace(/href="\//g, 'href="../');
fs.writeFileSync(file, c);
console.log('Fixed about/index.html');
