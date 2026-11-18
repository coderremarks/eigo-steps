/**
 * Learner progress: what is stored on the device, how it is validated when loaded, and the pure
 * functions that update it. Nothing here identifies a real person: a learner is a nickname and an
 * emoji avatar chosen on the device, and no data ever leaves the browser unless the learner exports
 * a file themselves.
 */
import { z } from 'zod';

import { ACTIVITY_KINDS, activityKey, type ActivityKind } from './activities';
import { toDateString } from './dates';
import { SKILLS, type Skill } from './schema';
import { introduceCard, reviewCard, srsKey, type SrsCard } from './srs';

export const HISTORY_LENGTH = 5;
export const MAX_ATTEMPTS = 300;
export const MAX_DAYS = 400;
export const MAX_WRONG_ANSWERS = 5;

/** Map keys are lowercase slugs joined by "/" or ":" (never "__proto__" and friends). */
const keySchema = z
  .string()
  .max(140)
  .regex(/^[a-z0-9][a-z0-9-]*(?:[/:][a-z0-9][a-z0-9-]*)*$/);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.string().max(40);
const count = z.number().int().min(0).max(1_000_000);
const score = z.number().min(0).max(100);

export const learnerSchema = z.object({
  nickname: z.string().trim().min(1).max(24),
  avatar: z.string().min(1).max(16),
  createdAt: timestamp,
});

export const activityProgressSchema = z.object({
  completedAt: timestamp.optional(),
  bestScore: score.optional(),
  lastScore: score.optional(),
  attempts: count,
});

export const attemptSchema = z.object({
  key: keySchema,
  moduleId: keySchema,
  kind: z.enum(ACTIVITY_KINDS),
  score: score.nullable(),
  correct: count,
  total: count,
  at: timestamp,
});

export const itemStatSchema = z.object({
  moduleId: keySchema,
  skill: z.enum(SKILLS),
  tags: z.array(z.string().max(40)).max(5),
  attempts: count,
  firstTryCorrect: count,
  /** First-try results of the most recent attempts, oldest first. */
  history: z.array(z.boolean()).max(HISTORY_LENGTH),
  /** Most frequent wrong first answers (for teacher item analysis). */
  wrong: z
    .array(z.object({ answer: z.string().max(80), count }))
    .max(MAX_WRONG_ANSWERS)
    .default([]),
  /** Total audio plays (listening items), so teachers can see which recordings needed replays. */
  plays: count.default(0),
  lastAt: timestamp,
});

export const srsCardSchema = z.object({
  moduleId: keySchema,
  vocabId: keySchema,
  box: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  due: dateString,
  lastReviewed: dateString.nullable(),
  reviews: count,
  lapses: count,
});

export const progressSchema = z.object({
  version: z.literal(1),
  learner: learnerSchema,
  /** True while the synthetic demo learner is loaded. */
  demo: z.boolean().default(false),
  activities: z.record(keySchema, activityProgressSchema).default({}),
  attempts: z.array(attemptSchema).max(MAX_ATTEMPTS).default([]),
  items: z.record(keySchema, itemStatSchema).default({}),
  srs: z.record(keySchema, srsCardSchema).default({}),
  days: z.array(dateString).max(MAX_DAYS).default([]),
});

export type Learner = z.output<typeof learnerSchema>;
export type ActivityProgress = z.output<typeof activityProgressSchema>;
export type Attempt = z.output<typeof attemptSchema>;
export type ItemStat = z.output<typeof itemStatSchema>;
export type Progress = z.output<typeof progressSchema>;

export const AVATARS = ['🐣', '🐼', '🦊', '🐧', '🐨', '🐯', '🐸', '🦉', '🐬', '🦄'] as const;

export function createProgress(
  now: Date,
  learner: Partial<Pick<Learner, 'nickname' | 'avatar'>> = {},
): Progress {
  return {
    version: 1,
    learner: {
      nickname: learner.nickname?.trim() || 'Learner',
      avatar: learner.avatar ?? AVATARS[0],
      createdAt: now.toISOString(),
    },
    demo: false,
    activities: {},
    attempts: [],
    items: {},
    srs: {},
    days: [],
  };
}

export function itemKey(moduleId: string, itemId: string): string {
  return `${moduleId}:${itemId}`;
}

/** One answered item inside an activity. */
export interface ItemAnswer {
  itemId: string;
  skill: Skill;
  tags: readonly string[];
  firstTryCorrect: boolean;
  /** The learner's first wrong answer, for item analysis. */
  wrongAnswer?: string;
  /** How many times the audio was played (listening). */
  plays?: number;
}

export interface ActivityResult {
  moduleId: string;
  kind: ActivityKind;
  /** 0–100 for scored activities, null for completion-only ones. */
  score: number | null;
  correct: number;
  total: number;
  answers: readonly ItemAnswer[];
  /** Vocabulary ids to add to spaced review. */
  learnedVocab?: readonly string[];
}

function recordDay(days: readonly string[], today: string): string[] {
  if (days.includes(today)) return [...days];
  return [...days, today].sort().slice(-MAX_DAYS);
}

function updateWrong(wrong: ItemStat['wrong'], answer: string | undefined): ItemStat['wrong'] {
  const text = answer?.trim().slice(0, 80);
  if (!text) return wrong;
  const existing = wrong.find((entry) => entry.answer === text);
  const next = existing
    ? wrong.map((entry) => (entry === existing ? { ...entry, count: entry.count + 1 } : entry))
    : [...wrong, { answer: text, count: 1 }];
  return next.sort((a, b) => b.count - a.count).slice(0, MAX_WRONG_ANSWERS);
}

export function applyAnswers(
  items: Progress['items'],
  moduleId: string,
  answers: readonly ItemAnswer[],
  at: string,
): Progress['items'] {
  const next = { ...items };
  for (const answer of answers) {
    const key = itemKey(moduleId, answer.itemId);
    const previous = next[key];
    next[key] = {
      moduleId,
      skill: answer.skill,
      tags: [...answer.tags].slice(0, 5),
      attempts: (previous?.attempts ?? 0) + 1,
      firstTryCorrect: (previous?.firstTryCorrect ?? 0) + (answer.firstTryCorrect ? 1 : 0),
      history: [...(previous?.history ?? []), answer.firstTryCorrect].slice(-HISTORY_LENGTH),
      wrong: answer.firstTryCorrect
        ? (previous?.wrong ?? [])
        : updateWrong(previous?.wrong ?? [], answer.wrongAnswer),
      plays: (previous?.plays ?? 0) + Math.max(0, Math.min(answer.plays ?? 0, 1000)),
      lastAt: at,
    };
  }
  return next;
}

/** Records a finished activity. Pure: returns a new progress object. */
export function applyActivityResult(
  progress: Progress,
  result: ActivityResult,
  now: Date,
): Progress {
  const at = now.toISOString();
  const today = toDateString(now);
  const key = activityKey(result.moduleId, result.kind);
  const previous = progress.activities[key];
  const activity: ActivityProgress = {
    completedAt: previous?.completedAt ?? at,
    attempts: (previous?.attempts ?? 0) + 1,
    bestScore:
      result.score === null
        ? previous?.bestScore
        : Math.max(previous?.bestScore ?? 0, result.score),
    lastScore: result.score === null ? previous?.lastScore : result.score,
  };

  const srs = { ...progress.srs };
  for (const vocabId of result.learnedVocab ?? []) {
    const cardKey = srsKey(result.moduleId, vocabId);
    if (!srs[cardKey]) srs[cardKey] = introduceCard(result.moduleId, vocabId, today);
  }

  const attempt: Attempt = {
    key,
    moduleId: result.moduleId,
    kind: result.kind,
    score: result.score,
    correct: result.correct,
    total: result.total,
    at,
  };

  return {
    ...progress,
    activities: { ...progress.activities, [key]: activity },
    attempts: [...progress.attempts, attempt].slice(-MAX_ATTEMPTS),
    items: applyAnswers(progress.items, result.moduleId, result.answers, at),
    srs,
    days: recordDay(progress.days, today),
  };
}

/** Records one spaced-review answer. */
export function applyReview(
  progress: Progress,
  cardKey: string,
  correct: boolean,
  now: Date,
): Progress {
  const card = progress.srs[cardKey];
  if (!card) return progress;
  const today = toDateString(now);
  const updated: SrsCard = reviewCard(card, correct, today);
  const answer: ItemAnswer = {
    itemId: `vocab-${card.vocabId}`,
    skill: 'vocabulary',
    tags: ['vocabulary'],
    firstTryCorrect: correct,
  };
  return {
    ...progress,
    srs: { ...progress.srs, [cardKey]: updated },
    items: applyAnswers(progress.items, card.moduleId, [answer], now.toISOString()),
    days: recordDay(progress.days, today),
  };
}

/** Removes everything recorded for one lesson (used when a teacher deletes a custom lesson). */
export function forgetModule(progress: Progress, moduleId: string): Progress {
  const keep = <T extends { moduleId: string }>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).filter(([, value]) => value.moduleId !== moduleId));
  return {
    ...progress,
    activities: Object.fromEntries(
      Object.entries(progress.activities).filter(([key]) => !key.startsWith(`${moduleId}/`)),
    ),
    attempts: progress.attempts.filter((attempt) => attempt.moduleId !== moduleId),
    items: keep(progress.items),
    srs: keep(progress.srs),
  };
}

export function srsCards(progress: Progress): SrsCard[] {
  return Object.values(progress.srs);
}
