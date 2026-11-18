#!/usr/bin/env node
/**
 * Downloads the Noto Emoji SVG illustrations used by the built-in lessons and the UI.
 *
 * Source: https://github.com/googlefonts/noto-emoji (2D/svg), © Google LLC, SIL Open Font License 1.1.
 * The script scans src/ for emoji, fetches only those files, checks each one is a plain SVG (no
 * scripts, event handlers or external references), and writes a manifest the app uses to decide
 * whether to show the bundled SVG or fall back to the device's emoji font.
 *
 * Usage: npm run illustrations
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT_DIR = join(ROOT, 'public', 'illustrations');
const MANIFEST = join(SRC, 'content', 'illustrations.json');
const BASE_URL = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/svg/';
const LICENSE_URL = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/LICENSE';
const MAX_BYTES = 300_000;

/** Same rule as src/ui/illustration.ts: codepoints in hex, FE0F removed, joined by "_". */
function emojiFileName(emoji) {
  const codepoints = [...emoji]
    .map((char) => char.codePointAt(0))
    .filter((cp) => cp !== undefined && cp !== 0xfe0f)
    .map((cp) => cp.toString(16).padStart(4, '0'));
  return `emoji_u${codepoints.join('_')}`;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    )
      yield path;
  }
}

function findEmoji(text) {
  const found = new Set();
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  for (const { segment } of segmenter.segment(text)) {
    if (/\p{Extended_Pictographic}/u.test(segment)) found.add(segment);
  }
  return found;
}

function isSafeSvg(text) {
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (!head.startsWith('<svg') && !head.startsWith('<?xml')) return false;
  return !/<script|<foreignobject|\son[a-z]+\s*=|javascript:|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/)/i.test(
    text,
  );
}

/**
 * Some exported SVGs carry a DOCTYPE with internal entities (Adobe Illustrator namespace
 * shortcuts). DTD processing is an XML attack surface (entity expansion, external entities), so
 * inline the simple internal entities, drop the DOCTYPE, and reject anything else DTD-related.
 */
function sanitizeSvg(text) {
  const entities = new Map();
  let output = text.replace(/<!DOCTYPE[^[>]*(?:\[([\s\S]*?)\])?\s*>/i, (_match, internal = '') => {
    for (const entity of internal.matchAll(/<!ENTITY\s+([A-Za-z_][\w.-]*)\s+"([^"<&%]*)"\s*>/g)) {
      entities.set(entity[1], entity[2]);
    }
    return '';
  });
  // Only entities declared above are expanded; the five predefined XML entities stay as they are.
  output = output.replace(/&([A-Za-z_][\w.-]*);/g, (match, name) => entities.get(name) ?? match);
  output = output.replace(/<\?xml[^>]*\?>/i, '<?xml version="1.0" encoding="UTF-8"?>');
  if (/<!DOCTYPE|<!ENTITY/i.test(output)) return null;
  return output;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const emoji = new Set();
for await (const file of walk(SRC)) {
  for (const e of findEmoji(await readFile(file, 'utf8'))) emoji.add(e);
}

await mkdir(OUT_DIR, { recursive: true });
const available = [];
const missing = [];
for (const e of [...emoji].sort()) {
  const name = emojiFileName(e);
  const target = join(OUT_DIR, `${name}.svg`);
  if (await exists(target)) {
    const current = await readFile(target, 'utf8');
    const clean = sanitizeSvg(current);
    if (clean === null || !isSafeSvg(clean)) {
      missing.push(`${e} (${name}: rejected)`);
      continue;
    }
    if (clean !== current) {
      await writeFile(target, clean, 'utf8');
      console.log(`  ~ ${e}  ${name}.svg (DOCTYPE removed)`);
    }
    available.push(name);
    continue;
  }
  const response = await fetch(`${BASE_URL}${name}.svg`);
  if (!response.ok) {
    missing.push(`${e} (${name})`);
    continue;
  }
  const body = sanitizeSvg(await response.text());
  if (body === null || body.length > MAX_BYTES || !isSafeSvg(body)) {
    missing.push(`${e} (${name}: rejected)`);
    continue;
  }
  await writeFile(target, body, 'utf8');
  available.push(name);
  console.log(`  + ${e}  ${name}.svg`);
}

const licensePath = join(OUT_DIR, 'LICENSE-OFL.txt');
if (!(await exists(licensePath))) {
  const license = await fetch(LICENSE_URL);
  if (license.ok) {
    await writeFile(
      licensePath,
      `Noto Emoji illustrations (2D/svg) from https://github.com/googlefonts/noto-emoji\n\n${await license.text()}`,
      'utf8',
    );
  }
}

await writeFile(MANIFEST, `${JSON.stringify([...new Set(available)].sort(), null, 2)}\n`, 'utf8');
console.log(`\n${available.length} illustrations ready in ${relative(ROOT, OUT_DIR)}`);
if (missing.length > 0) {
  console.log(`Not in Noto (shown with the device emoji font instead): ${missing.join(', ')}`);
}
