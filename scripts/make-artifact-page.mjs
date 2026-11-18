#!/usr/bin/env node
/**
 * Turns dist-artifact/index.html into the page format claude.ai artifacts expect (the host adds
 * its own <!doctype>, <html>, <head> and <body>): keeps the title, stylesheet, module preloads,
 * the app script and the root element. Usage: npm run build:artifact
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'dist-artifact';
const html = await readFile(join(DIR, 'index.html'), 'utf8');

const pick = (pattern) => [...html.matchAll(pattern)].map((match) => match[0]);
// Artifact galleries show the title as the page's name, so keep it to the product name.
const title = '<title>Eigo Steps</title>';
const description = pick(/<meta name="description"[\s\S]*?\/>/g)[0] ?? '';
const links = pick(/<link rel="(?:stylesheet|modulepreload)"[^>]*>/g);
const scripts = pick(/<script type="module"[^>]*><\/script>/g);

const page = [
  title,
  description,
  ...links,
  '<div id="root"></div>',
  '<noscript>Eigo Steps needs JavaScript to run.</noscript>',
  ...scripts,
  '',
].join('\n');

await writeFile(join(DIR, 'eigo-steps.html'), page, 'utf8');

const files = [];
for (const folder of ['assets', 'illustrations']) {
  for (const name of await readdir(join(DIR, folder))) files.push(`${folder}/${name}`);
}
files.push('favicon.svg');
await writeFile(join(DIR, 'files.json'), `${JSON.stringify(files)}\n`, 'utf8');
console.log(`Wrote ${DIR}/eigo-steps.html and a list of ${files.length} supporting files.`);
