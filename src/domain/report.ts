/**
 * Class view without a server. A learner can export a small "report for my teacher" file
 * (nickname + learning data only); the teacher imports the files on their own device and the class
 * dashboard is computed locally. In the portfolio demo the same dashboard runs on synthetic data.
 */
import { z } from 'zod';

import { getActivities } from './activities';
import { summarizeModule, summarizeSkills, type SkillSummary } from './analytics';
import { toDateString } from './dates';
import { activityProgressSchema, itemStatSchema, type Progress } from './progress';
import type { ChoiceOption, Module } from './schema';
import { summarizeSrs } from './srs';
import { tagInfo } from './tags';

const keySchema = z
  .string()
  .max(140)
  .regex(/^[a-z0-9][a-z0-9-]*(?:[/:][a-z0-9][a-z0-9-]*)*$/);
const count = z.number().int().min(0).max(1_000_000);

export const REPORT_FORMAT = 'eigo-steps/student-report';

export const studentReportSchema = z.object({
  format: z.literal(REPORT_FORMAT),
  version: z.literal(1),
  nickname: z.string().trim().min(1).max(24),
  avatar: z.string().min(1).max(16).default('🐣'),
  classCode: z.string().trim().max(12).default(''),
  exportedAt: z.string().max(40),
  activities: z.record(keySchema, activityProgressSchema).default({}),
  items: z.record(keySchema, itemStatSchema).default({}),
  words: z.object({ learned: count, mastered: count, due: count }),
  days: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .max(400)
    .default([]),
});

export type StudentReport = z.output<typeof studentReportSchema>;

export function toStudentReport(progress: Progress, now: Date, classCode = ''): StudentReport {
  const srs = summarizeSrs(Object.values(progress.srs), toDateString(now));
  return {
    format: REPORT_FORMAT,
    version: 1,
    nickname: progress.learner.nickname,
    avatar: progress.learner.avatar,
    classCode: classCode.trim().slice(0, 12),
    exportedAt: now.toISOString(),
    activities: progress.activities,
    items: progress.items,
    words: { learned: srs.learned, mastered: srs.mastered, due: srs.due },
    days: progress.days,
  };
}

/** A report viewed as Progress, so the learner analytics can be reused per student. */
export function reportAsProgress(report: StudentReport): Progress {
  return {
    version: 1,
    learner: { nickname: report.nickname, avatar: report.avatar, createdAt: report.exportedAt },
    demo: false,
    activities: report.activities,
    attempts: [],
    items: report.items,
    srs: {},
    days: report.days,
  };
}

export interface StudentRow {
  report: StudentReport;
  completedModules: number;
  completionPercent: number;
  averageQuiz: number | null;
  lastActive: string | null;
  skills: SkillSummary[];
  /** Per module: completion percent and best lesson-check score. */
  modules: { moduleId: string; percent: number; quizBest?: number; passed: boolean }[];
}

export function studentRows(
  reports: readonly StudentReport[],
  modules: readonly Module[],
): StudentRow[] {
  return reports.map((report) => {
    const progress = reportAsProgress(report);
    const summaries = modules.map((module) => summarizeModule(module, progress));
    const totalActivities = summaries.reduce((sum, summary) => sum + summary.total, 0);
    const doneActivities = summaries.reduce((sum, summary) => sum + summary.completed, 0);
    const quizzes = summaries.flatMap((summary) =>
      summary.quizBest === undefined ? [] : [summary.quizBest],
    );
    return {
      report,
      completedModules: summaries.filter((summary) => summary.status === 'completed').length,
      completionPercent:
        totalActivities === 0 ? 0 : Math.round((doneActivities / totalActivities) * 100),
      averageQuiz:
        quizzes.length === 0
          ? null
          : Math.round(quizzes.reduce((a, b) => a + b, 0) / quizzes.length),
      lastActive: report.days.at(-1) ?? null,
      skills: summarizeSkills(progress),
      modules: summaries.map((summary) => ({
        moduleId: summary.moduleId,
        percent: summary.percent,
        quizBest: summary.quizBest,
        passed: summary.passed,
      })),
    };
  });
}

export interface ClassOverview {
  learners: number;
  averageCompletion: number;
  averageQuiz: number | null;
  activeThisWeek: number;
}

export function classOverview(rows: readonly StudentRow[], today: string): ClassOverview {
  const weekAgo = new Date(`${today}T00:00:00Z`);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
  const since = weekAgo.toISOString().slice(0, 10);
  const quizzes = rows.flatMap((row) => (row.averageQuiz === null ? [] : [row.averageQuiz]));
  return {
    learners: rows.length,
    averageCompletion:
      rows.length === 0
        ? 0
        : Math.round(rows.reduce((sum, row) => sum + row.completionPercent, 0) / rows.length),
    averageQuiz:
      quizzes.length === 0 ? null : Math.round(quizzes.reduce((a, b) => a + b, 0) / quizzes.length),
    activeThisWeek: rows.filter((row) => row.lastActive !== null && row.lastActive >= since).length,
  };
}

export interface ClassFocusArea {
  tag: string;
  label: string;
  ja: string;
  teacherNote: string;
  accuracy: number;
  answered: number;
  learnersBelow: number;
}

/** Class-wide first-try accuracy per focus tag, weakest first. */
export function classFocusAreas(
  reports: readonly StudentReport[],
  limit = 6,
  minAnswers = 10,
): ClassFocusArea[] {
  const totals = new Map<
    string,
    { right: number; total: number; perLearner: Map<string, { right: number; total: number }> }
  >();
  reports.forEach((report, index) => {
    for (const item of Object.values(report.items)) {
      for (const tag of item.tags) {
        if (tag === 'vocabulary') continue;
        const entry = totals.get(tag) ?? {
          right: 0,
          total: 0,
          perLearner: new Map<string, { right: number; total: number }>(),
        };
        entry.right += item.firstTryCorrect;
        entry.total += item.attempts;
        const learner = entry.perLearner.get(String(index)) ?? { right: 0, total: 0 };
        learner.right += item.firstTryCorrect;
        learner.total += item.attempts;
        entry.perLearner.set(String(index), learner);
        totals.set(tag, entry);
      }
    }
  });
  return [...totals.entries()]
    .filter(([, entry]) => entry.total >= minAnswers)
    .map(([tag, entry]) => {
      const info = tagInfo(tag);
      const learnersBelow = [...entry.perLearner.values()].filter(
        (l) => l.total > 0 && l.right / l.total < 0.7,
      ).length;
      return {
        tag,
        label: info.label,
        ja: info.ja,
        teacherNote: info.teacherNote,
        accuracy: entry.right / entry.total,
        answered: entry.total,
        learnersBelow,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit);
}

export interface ItemAnalysis {
  moduleId: string;
  moduleTitle: string;
  itemId: string;
  prompt: string;
  correctAnswer: string;
  facility: number;
  attempts: number;
  commonWrong: { answer: string; count: number }[];
}

interface ItemText {
  prompt: string;
  correct: string;
}

function optionText(option: ChoiceOption | undefined): string {
  return option?.text ?? '';
}

function itemTexts(module: Module): Map<string, ItemText> {
  const map = new Map<string, ItemText>();
  for (const q of module.practice) {
    if (q.kind === 'mcq')
      map.set(q.id, { prompt: q.prompt, correct: optionText(q.options[q.answer]) });
    if (q.kind === 'fill') map.set(q.id, { prompt: q.sentence, correct: q.answers[0] ?? '' });
    if (q.kind === 'build') map.set(q.id, { prompt: `Build: ${q.prompt}`, correct: q.answer });
  }
  for (const item of module.listening) {
    map.set(item.id, {
      prompt: `Listening: ${item.question}`,
      correct: optionText(item.options[item.answer]),
    });
  }
  for (const q of module.reading?.questions ?? []) {
    map.set(q.id, { prompt: `Reading: ${q.prompt}`, correct: optionText(q.options[q.answer]) });
  }
  for (const word of module.vocab) {
    map.set(`vocab-${word.id}`, {
      prompt: `Word: ${word.picture} ${word.word}`,
      correct: word.word,
    });
  }
  return map;
}

/** Hardest items for the class (lowest facility index) with their most common wrong answers. */
export function itemAnalysis(
  reports: readonly StudentReport[],
  modules: readonly Module[],
  limit = 6,
  minAttempts = 5,
): ItemAnalysis[] {
  const aggregate = new Map<
    string,
    { attempts: number; right: number; wrong: Map<string, number> }
  >();
  for (const report of reports) {
    for (const [key, item] of Object.entries(report.items)) {
      const entry = aggregate.get(key) ?? {
        attempts: 0,
        right: 0,
        wrong: new Map<string, number>(),
      };
      entry.attempts += item.attempts;
      entry.right += item.firstTryCorrect;
      for (const wrong of item.wrong)
        entry.wrong.set(wrong.answer, (entry.wrong.get(wrong.answer) ?? 0) + wrong.count);
      aggregate.set(key, entry);
    }
  }
  const texts = new Map(modules.map((module) => [module.id, { module, texts: itemTexts(module) }]));
  const results: ItemAnalysis[] = [];
  for (const [key, entry] of aggregate) {
    if (entry.attempts < minAttempts) continue;
    const [moduleId = '', itemId = ''] = key.split(':');
    const source = texts.get(moduleId);
    const text = source?.texts.get(itemId);
    if (!source || !text) continue;
    results.push({
      moduleId,
      moduleTitle: source.module.title,
      itemId,
      prompt: text.prompt,
      correctAnswer: text.correct,
      facility: entry.right / entry.attempts,
      attempts: entry.attempts,
      commonWrong: [...entry.wrong.entries()]
        .map(([answer, count]) => ({ answer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 2),
    });
  }
  return results.sort((a, b) => a.facility - b.facility).slice(0, limit);
}

/** Learners who may need a check-in: low lesson-check average or far behind the class. */
export function learnersToSupport(
  rows: readonly StudentRow[],
  limit = 5,
): { row: StudentRow; reason: string }[] {
  if (rows.length === 0) return [];
  const averageCompletion = rows.reduce((sum, row) => sum + row.completionPercent, 0) / rows.length;
  return rows
    .flatMap((row) => {
      if (row.averageQuiz !== null && row.averageQuiz < 60) {
        return [
          { row, reason: `Lesson-check average ${row.averageQuiz}%`, weight: row.averageQuiz },
        ];
      }
      if (row.completionPercent < averageCompletion / 2) {
        return [
          {
            row,
            reason: `Only ${row.completionPercent}% of activities done (class average ${Math.round(averageCompletion)}%)`,
            weight: 100 + row.completionPercent,
          },
        ];
      }
      return [];
    })
    .sort((a, b) => a.weight - b.weight)
    .slice(0, limit)
    .map(({ row, reason }) => ({ row, reason }));
}

export function moduleActivityCount(module: Module): number {
  return getActivities(module).length;
}
