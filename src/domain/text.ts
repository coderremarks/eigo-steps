/** Small, well-tested text helpers shared by the lesson renderer, grading and exporters. */

export interface Segment {
  text: string;
  highlight: boolean;
}

/** Splits "I like [dogs]." into plain and highlighted segments. Unpaired brackets stay literal. */
export function parseHighlights(value: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /\[([^[\]]+)\]/g;
  let last = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: value.slice(last, index), highlight: false });
    segments.push({ text: match[1] ?? '', highlight: true });
    last = index + match[0].length;
  }
  if (last < value.length) segments.push({ text: value.slice(last), highlight: false });
  return segments;
}

export function stripHighlights(value: string): string {
  return value.replace(/\[([^[\]]+)\]/g, '$1');
}

/** Word tiles for sentence building: split on whitespace, keep punctuation attached. */
export function tokenize(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

export interface GlossSegment {
  text: string;
  /** Index into the glossary when this segment is a glossed term. */
  glossIndex?: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Marks the first occurrence of each glossary term across a passage (case-insensitive, whole
 * words, longest terms first so "go straight" wins over "go").
 */
export function segmentWithGlossary(
  paragraphs: readonly string[],
  terms: readonly string[],
): GlossSegment[][] {
  const order = terms
    .map((term, index) => ({ term: term.trim(), index }))
    .filter((entry) => entry.term.length > 0)
    .sort((a, b) => b.term.length - a.term.length);
  const used = new Set<number>();

  return paragraphs.map((paragraph) => {
    let segments: GlossSegment[] = [{ text: paragraph }];
    for (const { term, index } of order) {
      if (used.has(index)) continue;
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}'])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`,
        'iu',
      );
      const next: GlossSegment[] = [];
      for (const segment of segments) {
        if (used.has(index) || segment.glossIndex !== undefined) {
          next.push(segment);
          continue;
        }
        const match = pattern.exec(segment.text);
        if (!match) {
          next.push(segment);
          continue;
        }
        const start = match.index;
        const end = start + match[0].length;
        if (start > 0) next.push({ text: segment.text.slice(0, start) });
        next.push({ text: segment.text.slice(start, end), glossIndex: index });
        if (end < segment.text.length) next.push({ text: segment.text.slice(end) });
        used.add(index);
      }
      segments = next;
    }
    return segments;
  });
}

/** Splits a string into user-perceived characters (so "🐵🐧" becomes two pictures). */
export function graphemes(value: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (part) => part.segment).filter(
      (part) => part.trim() !== '',
    );
  }
  return Array.from(value).filter((part) => part.trim() !== '');
}

/** Levenshtein edit distance (small strings only). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Turns free text into a slug, e.g. for ids of teacher-created items. */
export function slugify(value: string, fallback = 'item'): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/** Returns `base`, or `base-2`, `base-3`… so the id is not in `taken`. */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}
