/**
 * Untrusted input: teacher-authored lessons, imported files and stored data must be validated,
 * bounded and never executed or rendered as HTML.
 */
import { describe, expect, it } from 'vitest';

import { BUILT_IN_MODULES } from '../content';
import {
  csvCell,
  lessonsFile,
  parseLessonFile,
  parseProgressBackup,
  parseStudentReport,
  toCsv,
  vocabularyCsv,
} from './exchange';
import { createProgress } from './progress';
import { LIMITS, moduleSchema } from './schema';

const NOW = new Date('2026-11-18T10:00:00+09:00');
const base = BUILT_IN_MODULES[0]!;

describe('lesson validation', () => {
  it('strips unknown keys (including __proto__) from imported lessons', () => {
    const raw = JSON.parse(lessonsFile([base], NOW)) as { lessons: Record<string, unknown>[] };
    raw.lessons[0]!.malicious = '<script>alert(1)</script>';
    const withProto = JSON.stringify(raw).replace(
      '"malicious"',
      '"__proto__":{"polluted":true},"malicious"',
    );
    const result = parseLessonFile(withProto, new Set());
    expect(result.errors).toEqual([]);
    expect(result.lessons[0]).not.toHaveProperty('malicious');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('keeps HTML-like text as plain text (rendering escapes it)', () => {
    const lesson = { ...base, id: 'xss-test', title: '<img src=x onerror=alert(1)>' };
    const parsed = moduleSchema.parse(lesson);
    expect(parsed.title).toBe('<img src=x onerror=alert(1)>');
  });

  it('enforces length and count limits', () => {
    expect(moduleSchema.safeParse({ ...base, title: 'x'.repeat(61) }).success).toBe(false);
    expect(
      moduleSchema.safeParse({
        ...base,
        vocab: Array.from({ length: 30 }, (_, i) => ({ ...base.vocab[0]!, id: `w${i}` })),
      }).success,
    ).toBe(false);
  });

  it('checks cross-field rules with readable messages', () => {
    const badAnswer = { ...base, practice: [{ ...base.practice[0]!, answer: 9 }] };
    const result = moduleSchema.safeParse(badAnswer);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(
      'The correct answer must be one of the options',
    );

    const noBlank = {
      ...base,
      practice: [
        { kind: 'fill', id: 'f', sentence: 'No blank here.', answers: ['x'], explanation: 'e' },
      ],
    };
    expect(moduleSchema.safeParse(noBlank).success).toBe(false);

    const duplicateIds = { ...base, vocab: [base.vocab[0]!, base.vocab[0]!] };
    expect(moduleSchema.safeParse(duplicateIds).success).toBe(false);
  });

  it('rejects ids that are not slugs (no path tricks in routes or storage keys)', () => {
    expect(moduleSchema.safeParse({ ...base, id: '../../etc' }).success).toBe(false);
    expect(moduleSchema.safeParse({ ...base, id: '__proto__' }).success).toBe(false);
  });
});

describe('imports', () => {
  it('renames lessons whose id clashes with existing lessons', () => {
    const result = parseLessonFile(lessonsFile([base], NOW), new Set([base.id]));
    expect(result.lessons[0]!.id).toBe(`${base.id}-2`);
    expect(result.lessons[0]!.source).toBe('custom');
  });

  it('rejects oversized, malformed or foreign files', () => {
    expect(parseLessonFile('x'.repeat(LIMITS.importBytes + 1), new Set()).errors[0]).toMatch(
      /too large/,
    );
    expect(parseLessonFile('{not json', new Set()).errors[0]).toMatch(/not valid JSON/);
    expect(parseLessonFile('{"hello":"world"}', new Set()).lessons).toEqual([]);
    expect(parseStudentReport('{"format":"other"}')).toEqual({
      error: 'This is not an Eigo Steps learner report.',
    });
    expect(parseProgressBackup('[]')).toHaveProperty('error');
  });

  it('round-trips a progress backup and never restores it as demo data', () => {
    const progress = { ...createProgress(NOW), demo: true };
    const text = JSON.stringify({
      format: 'eigo-steps/progress-backup',
      version: 1,
      exportedAt: NOW.toISOString(),
      progress,
    });
    const result = parseProgressBackup(text);
    expect('progress' in result && result.progress.demo).toBe(false);
  });
});

describe('CSV export', () => {
  it('quotes cells and neutralises spreadsheet formulas (CSV injection)', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell('+1')).toBe('"\'+1"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvCell('plain, text')).toBe('"plain, text"');
    expect(toCsv([['a', 1]])).toBe('﻿"a","1"\r\n');
  });

  it('exports vocabulary with Japanese and without highlight brackets', () => {
    const csv = vocabularyCsv(base);
    expect(csv).toContain('"happy","うれしい","adjective","I’m happy today!"');
    expect(csv).not.toContain('[');
  });
});
