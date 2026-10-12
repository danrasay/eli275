// Inlines data/exhibits.json and data/questions.json into src/index.template.html
// and writes the single deployable file, index.html.
// The JSON files stay the source of truth. Run: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

// Minify, and keep the payload inert inside a <script> element.
const inline = (p) =>
  JSON.stringify(JSON.parse(read(p)))
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');

// Function replacers: the data contains "$1.00", which a string replacer would mangle.
const html = read('src/index.template.html')
  .replace('__EXHIBITS_JSON__', () => inline('data/exhibits.json'))
  .replace('__QUESTIONS_JSON__', () => inline('data/questions.json'));

writeFileSync(new URL('index.html', root), html);
console.log(`index.html written, ${Buffer.byteLength(html)} bytes`);
