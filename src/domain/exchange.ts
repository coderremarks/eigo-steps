/**
 * Import and export formats: lesson files for sharing between teachers, vocabulary CSV for
 * spreadsheets or flashcard apps, learner reports, progress backups and the class CSV.
 *
 * Every import is treated as untrusted: size-limited, parsed in a try/catch, validated with the
 * content schemas (which strip unknown keys and cap lengths), and given new ids if they would
 * clash with built-in lessons. CSV export neutralises spreadsheet formulas (CSV injection).
 */
import { z } from 'zod';

import { progressSchema, type Progress } from './progress';
import { studentReportSchema, type StudentReport, type StudentRow } from './report';
import { describeIssues, LIMITS, moduleSchema, type Module } from './schema';
import { stripHighlights, uniqueId } from './text';

export const LESSONS_FORMAT = 'eigo-steps/lessons';
export const BACKUP_FORMAT = 'eigo-steps/progress-backup';

// ---------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------

/** Quotes a CSV cell and defuses values a spreadsheet would run as a formula. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const BOM = String.fromCharCode(0xfeff);

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  // BOM so Excel (common in Japanese schools) opens UTF-8 Japanese text correctly.
  return `${BOM}${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function vocabularyCsv(module: Module): string {
  return toCsv([
    ['word', 'japanese', 'part_of_speech', 'example', 'example_japanese', 'note', 'picture'],
    ...module.vocab.map((item) => [
      item.word,
      item.ja,
      item.partOfSpeech,
      stripHighlights(item.example),
      item.exampleJa,
      item.note,
      item.picture,
    ]),
  ]);
}

export function classCsv(rows: readonly StudentRow[], modules: readonly Module[]): string {
  return toCsv([
    [
      'nickname',
      'class',
      'activities_done_percent',
      'lessons_completed',
      'lesson_check_average',
      'last_active',
      ...modules.map((m) => `check_${m.id}`),
    ],
    ...rows.map((row) => [
      row.report.nickname,
      row.report.classCode,
      row.completionPercent,
      row.completedModules,
      row.averageQuiz,
      row.lastActive,
      ...row.modules.map((m) => m.quizBest ?? ''),
    ]),
  ]);
}

// ---------------------------------------------------------------------------------------------
// JSON files
// ---------------------------------------------------------------------------------------------

export function lessonsFile(modules: readonly Module[], now: Date): string {
  return JSON.stringify(
    { format: LESSONS_FORMAT, version: 1, exportedAt: now.toISOString(), lessons: modules },
    null,
    2,
  );
}

export function progressBackupFile(progress: Progress, now: Date): string {
  return JSON.stringify(
    { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), progress },
    null,
    2,
  );
}

export function studentReportFile(report: StudentReport): string {
  return JSON.stringify(report, null, 2);
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (text.length > LIMITS.importBytes) {
    return {
      ok: false,
      error: `The file is too large (limit ${Math.round(LIMITS.importBytes / 1000)} KB).`,
    };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
}

export interface LessonImport {
  lessons: Module[];
  errors: string[];
}

const lessonsEnvelope = z.object({
  format: z.literal(LESSONS_FORMAT),
  version: z.literal(1),
  lessons: z.array(z.unknown()).max(LIMITS.storedLessons),
});

/**
 * Validates a lesson file. Imported lessons always become "custom" lessons; ids that clash with
 * built-in or existing lessons are renamed so nothing is overwritten silently.
 */
export function parseLessonFile(text: string, takenIds: ReadonlySet<string>): LessonImport {
  const json = parseJson(text);
  if (!json.ok) return { lessons: [], errors: [json.error] };

  const envelope = lessonsEnvelope.safeParse(json.value);
  const candidates: unknown[] = envelope.success ? envelope.data.lessons : [json.value];

  const taken = new Set(takenIds);
  const lessons: Module[] = [];
  const errors: string[] = [];
  candidates.forEach((candidate, index) => {
    const result = moduleSchema.safeParse(candidate);
    if (!result.success) {
      errors.push(`Lesson ${index + 1}: ${describeIssues(result.error, 3).join(' ')}`);
      return;
    }
    const id = uniqueId(result.data.id, taken);
    taken.add(id);
    lessons.push({ ...result.data, id, source: 'custom' });
  });
  if (lessons.length === 0 && errors.length === 0) errors.push('No lessons found in the file.');
  return { lessons, errors };
}

export function parseStudentReport(text: string): { report: StudentReport } | { error: string } {
  const json = parseJson(text);
  if (!json.ok) return { error: json.error };
  const result = studentReportSchema.safeParse(json.value);
  if (!result.success) return { error: 'This is not an Eigo Steps learner report.' };
  return { report: result.data };
}

const backupEnvelope = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  progress: progressSchema,
});

export function parseProgressBackup(text: string): { progress: Progress } | { error: string } {
  const json = parseJson(text);
  if (!json.ok) return { error: json.error };
  const result = backupEnvelope.safeParse(json.value);
  if (!result.success) return { error: 'This is not a valid Eigo Steps progress backup.' };
  return { progress: { ...result.data.progress, demo: false } };
}

/** Safe file name from a title, e.g. "Around Town" → "around-town". */
export function fileSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'eigo-steps'
  );
}
