import { mkdir, readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const modules = ['documents', 'context', 'remote', 'selection', 'paths', 'bridge', 'reader', 'client'];
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const sources = await Promise.all(modules.map(async name => (await readFile(new URL(`../src/${name}.js`, import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')));
const source = `window.__ModuleLoader__.load({id:"dsh-md-reader",factory:function(require){\n"use strict";\nconst React=require("react");\nconst {MarkdownText}=require("@deepseek-ai/dsh-client-ui-primitives");\nconst READER_CSS=${JSON.stringify(css)};\n${sources.join('\n')}\nreturn {apply,inject};\n}});\n`;
new vm.Script(source, { filename: 'dsh-md-reader/client.js' });
await mkdir(new URL('../lib/', import.meta.url), { recursive: true });
await writeFile(new URL('../lib/client.js', import.meta.url), source);
console.log(`Built lib/client.js (${Buffer.byteLength(source)} bytes)`);
