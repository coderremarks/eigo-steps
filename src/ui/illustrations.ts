import manifest from '../content/illustrations.json';

const AVAILABLE: ReadonlySet<string> = new Set<string>(manifest);
const VARIATION_SELECTOR_16 = String.fromCharCode(0xfe0f);

/** Noto Emoji file name for an emoji: hex codepoints without FE0F, e.g. 🐶 → "emoji_u1f436". */
export function emojiFileName(emoji: string): string {
  const codepoints = [...emoji]
    .map((char) => char.codePointAt(0) ?? 0)
    .filter((codepoint) => codepoint !== 0xfe0f)
    .map((codepoint) => codepoint.toString(16).padStart(4, '0'));
  return `emoji_u${codepoints.join('_')}`;
}

export function hasBundledIllustration(emoji: string): boolean {
  return AVAILABLE.has(emojiFileName(emoji));
}

export function illustrationUrl(emoji: string): string | null {
  const file = emojiFileName(emoji);
  return AVAILABLE.has(file) ? `${import.meta.env.BASE_URL}illustrations/${file}.svg` : null;
}

/** "emoji_u1f436" → "🐶" (adds the emoji presentation selector for older single symbols). */
export function emojiFromFileName(name: string): string {
  const codepoints = name
    .replace(/^emoji_u/, '')
    .split('_')
    .map((hex) => Number.parseInt(hex, 16))
    .filter((value) => Number.isFinite(value));
  const text = String.fromCodePoint(...codepoints);
  return codepoints.length === 1 && (codepoints[0] ?? 0) < 0x1f000
    ? `${text}${VARIATION_SELECTOR_16}`
    : text;
}

/** Every bundled picture, for the teacher's picture picker. */
export const ILLUSTRATION_LIBRARY: readonly string[] = manifest.map(emojiFromFileName);
