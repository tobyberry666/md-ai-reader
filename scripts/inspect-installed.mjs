// Read shipped sources as data for contract inspection; never evaluate bundle code.
import { openSync, readSync, closeSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const archive = process.env.DSH_ASAR || 'C:/Users/Toby/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';
const fd = openSync(archive, 'r');
const prefix = Buffer.alloc(16);
readSync(fd, prefix, 0, 16, 0);
const header = Buffer.alloc(prefix.readUInt32LE(12));
readSync(fd, header, 0, header.length, 16);
const tree = JSON.parse(header);
const offset = 8 + prefix.readUInt32LE(4);
const packages = new Set(process.argv.slice(2));
let count = 0;
function walk(node, path = '') {
  for (const [name, entry] of Object.entries(node.files || {})) {
    const file = path ? `${path}/${name}` : name;
    if (entry.files) { walk(entry, file); continue; }
    const match = /(?:^|\/)node_modules\/@deepseek-ai\/([^/]+)\/(.*)$/.exec(file);
    if (!match || !packages.has(match[1]) || entry.unpacked) continue;
    if (!/\.(?:js|map|md|json)$/.test(file)) continue;
    const data = Buffer.alloc(entry.size);
    readSync(fd, data, 0, data.length, offset + Number(entry.offset));
    const destination = resolve('.cache/installed', match[1], match[2]);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, data);
    count++;
  }
}
walk(tree);
closeSync(fd);
console.log(`Extracted ${count} source/document files into .cache/installed for ${packages.size} selected packages.`);
