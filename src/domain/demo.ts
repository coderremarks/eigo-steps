/**
 * Realistic synthetic learner data for the portfolio demo.
 *
 * Demo data is generated, not hand-typed: simulated learners answer the real lesson items through
 * the same functions the app uses for real answers, so dashboards, focus areas and item analysis
 * behave exactly as they would with a class. Accuracy follows a simple Rasch-style model
 * (learner ability minus item difficulty) with higher difficulty for structures that are known to
 * be hard for Japanese learners (third-person -s, articles, irregular past…). No real person's data
 * is involved; all names are invented pseudonyms.
 */
import { getActivities, type ActivityKind } from './activities';
import { addDays, toDateString } from './dates';
import {
  applyActivityResult,
  applyReview,
  createProgress,
  type ItemAnswer,
  type Progress,
} from './progress';
import { createRng, hashString, randomInt, type Rng } from './random';
import { toStudentReport, type StudentReport } from './report';
import type { Module } from './schema';
import { srsKey } from './srs';
import {
  listeningTasks,
  practiceTasks,
  quizTasks,
  readingTasks,
  type Task,
  taskTags,
} from './tasks';

/** Extra difficulty (in logits) for known L1-transfer trouble spots. */
const TAG_DIFFICULTY: Record<string, number> = {
  'third-person-s': 1.1,
  'plural-s': 0.9,
  articles: 0.9,
  'be-vs-verb': 0.6,
  'past-irregular': 0.7,
  'did-questions': 0.7,
  'past-be': 0.8,
  'listening-numbers': 0.8,
  'listening-time': 0.6,
  'listening-directions': 0.5,
  'do-does-questions': 0.6,
  'spelling-es': 0.5,
  prepositions: 0.4,
  'polite-requests': 0.3,
  'how-much': 0.4,
  'word-order': 0.3,
  'reading-inference': 0.4,
};

function difficulty(task: Task): number {
  const tags = taskTags(task);
  const extra = Math.max(0, ...tags.map((tag) => TAG_DIFFICULTY[tag] ?? 0));
  const typed = task.type === 'fill' && task.question.choices.length === 0 ? 0.4 : 0;
  const build = task.type === 'build' ? 0.3 : 0;
  return -1.2 + extra + typed + build;
}

function probability(ability: number, task: Task): number {
  return 1 / (1 + Math.exp(-(ability - difficulty(task))));
}

/** A plausible wrong answer: the authored "common error" if there is one. */
function wrongAnswer(task: Task, rng: Rng): string {
  switch (task.type) {
    case 'mcq': {
      const wrong = task.question.options.filter((_, index) => index !== task.question.answer);
      return (rng() < 0.7 ? wrong[0] : wrong[wrong.length - 1])?.text ?? '';
    }
    case 'listening': {
      const wrong = task.item.options.filter((_, index) => index !== task.item.answer);
      return (rng() < 0.7 ? wrong[0] : wrong[wrong.length - 1])?.text ?? '';
    }
    case 'fill':
      return (
        task.question.commonErrors[0]?.answer ??
        task.question.choices.find((c) => !task.question.answers.includes(c)) ??
        '?'
      );
    case 'build':
      return '(wrong word order)';
  }
}

function answerTasks(tasks: readonly Task[], ability: number, rng: Rng): ItemAnswer[] {
  return tasks.map((task) => {
    const correct = rng() < probability(ability, task);
    return {
      itemId: task.id,
      skill: task.skill,
      tags: taskTags(task),
      firstTryCorrect: correct,
      wrongAnswer: correct ? undefined : wrongAnswer(task, rng),
    };
  });
}

function tasksFor(module: Module, kind: ActivityKind, seed: number): Task[] {
  switch (kind) {
    case 'practice':
      return practiceTasks(module);
    case 'listening':
      return listeningTasks(module);
    case 'reading':
      return readingTasks(module);
    case 'quiz':
      return quizTasks(module, seed);
    case 'match':
    case 'vocab':
    case 'grammar':
      return [];
  }
}

function vocabAnswers(module: Module, ability: number, rng: Rng): ItemAnswer[] {
  return module.vocab.map((word) => {
    const correct = rng() < 1 / (1 + Math.exp(-(ability + 1.6)));
    return {
      itemId: `vocab-${word.id}`,
      skill: 'vocabulary',
      tags: ['vocabulary'],
      firstTryCorrect: correct,
    };
  });
}

/** Simulates one activity for a learner and records it through the real reducer. */
function simulateActivity(
  progress: Progress,
  module: Module,
  kind: ActivityKind,
  ability: number,
  at: Date,
  rng: Rng,
): Progress {
  if (kind === 'vocab' || kind === 'grammar') {
    return applyActivityResult(
      progress,
      {
        moduleId: module.id,
        kind,
        score: null,
        correct: 0,
        total: 0,
        answers: [],
        learnedVocab: kind === 'vocab' ? module.vocab.map((v) => v.id) : [],
      },
      at,
    );
  }
  const answers =
    kind === 'match'
      ? vocabAnswers(module, ability, rng)
      : answerTasks(
          tasksFor(module, kind, hashString(`${module.id}-${at.toISOString()}`)),
          ability,
          rng,
        );
  const correct = answers.filter((answer) => answer.firstTryCorrect).length;
  const score = answers.length === 0 ? 100 : Math.round((correct / answers.length) * 100);
  return applyActivityResult(
    progress,
    { moduleId: module.id, kind, score, correct, total: answers.length, answers },
    at,
  );
}

function atDay(today: string, daysAgo: number, hour: number, minute: number): Date {
  const [y, m, d] = addDays(today, -daysAgo).split('-').map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, hour, minute);
}

export const DEMO_LEARNER = { nickname: 'Sora (demo)', avatar: '🐧' };

/**
 * The demo learner "Sora": two lessons finished, one in progress, a weak spot in plural -s and
 * in listening for prices, and some words due for review today.
 */
export function createDemoProgress(modules: readonly Module[], now: Date): Progress {
  const today = toDateString(now);
  const rng = createRng(20261118);
  let progress = createProgress(atDay(today, 13, 16, 0), DEMO_LEARNER);
  progress = { ...progress, demo: true };

  const plan: { moduleIndex: number; kinds: ActivityKind[]; daysAgo: number; ability: number }[] = [
    { moduleIndex: 0, kinds: ['vocab', 'match', 'grammar', 'practice'], daysAgo: 12, ability: 1.2 },
    { moduleIndex: 0, kinds: ['listening', 'reading', 'quiz'], daysAgo: 11, ability: 1.0 },
    { moduleIndex: 1, kinds: ['vocab', 'match', 'grammar'], daysAgo: 9, ability: 0.8 },
    { moduleIndex: 1, kinds: ['practice', 'listening'], daysAgo: 8, ability: -0.4 },
    { moduleIndex: 1, kinds: ['reading', 'quiz'], daysAgo: 6, ability: 0.1 },
    { moduleIndex: 2, kinds: ['vocab', 'match', 'grammar'], daysAgo: 3, ability: 0.8 },
    { moduleIndex: 2, kinds: ['practice', 'listening'], daysAgo: 1, ability: -0.3 },
  ];
  for (const step of plan) {
    const module = modules[step.moduleIndex];
    if (!module) continue;
    const available = new Set(getActivities(module).map((a) => a.kind));
    step.kinds.forEach((kind, index) => {
      if (!available.has(kind)) return;
      progress = simulateActivity(
        progress,
        module,
        kind,
        step.ability,
        atDay(today, step.daysAgo, 16, 5 + index * 6),
        rng,
      );
    });
  }

  // Spaced-review history: a few earlier reviews so words sit in different boxes.
  const reviewDays = [11, 9, 7, 5, 3, 1];
  for (const daysAgo of reviewDays) {
    const day = atDay(today, daysAgo, 19, 30);
    const dayString = toDateString(day);
    for (const card of Object.values(progress.srs)) {
      if (card.due > dayString) continue;
      const correct =
        rng() < (card.vocabId === 'elephant' || card.vocabId === 'tired' ? 0.25 : 0.82);
      progress = applyReview(progress, srsKey(card.moduleId, card.vocabId), correct, day);
    }
  }
  return progress;
}

const PSEUDONYMS = [
  'Akane',
  'Daiki',
  'Emi',
  'Haruto',
  'Hina',
  'Itsuki',
  'Kaito',
  'Kana',
  'Koharu',
  'Mei',
  'Minato',
  'Mio',
  'Nanami',
  'Reo',
  'Riko',
  'Ren',
  'Rin',
  'Ryota',
  'Sakura',
  'Shota',
  'Sota',
  'Tsubasa',
  'Yui',
  'Yuto',
] as const;
const CLASS_AVATARS = ['🐼', '🦊', '🐧', '🐨', '🐯', '🐸', '🦉', '🐬', '🐣', '🦄'] as const;

function normal(rng: Rng): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A synthetic junior-high class ("1-A") of `size` learners with varied ability and engagement. */
export function createDemoClass(modules: readonly Module[], now: Date, size = 24): StudentReport[] {
  const today = toDateString(now);
  const rng = createRng(hashString(`class-1a-${modules.map((m) => m.id).join(',')}`));
  const reports: StudentReport[] = [];
  for (let index = 0; index < size; index += 1) {
    const ability = 0.9 + normal(rng) * 0.9;
    const engagement = Math.min(1, Math.max(0.25, 0.65 + normal(rng) * 0.25));
    const nickname = `${PSEUDONYMS[index % PSEUDONYMS.length] ?? 'Learner'} (demo)`;
    let progress = createProgress(atDay(today, 20, 15, 0), {
      nickname,
      avatar: CLASS_AVATARS[index % CLASS_AVATARS.length],
    });
    const lessonsReached = Math.max(1, Math.round(engagement * modules.length));
    let daysAgo = 18;
    for (let m = 0; m < Math.min(lessonsReached, modules.length); m += 1) {
      const module = modules[m];
      if (!module) continue;
      const kinds = getActivities(module).map((activity) => activity.kind);
      const isLast = m === lessonsReached - 1;
      const count = isLast
        ? Math.max(2, Math.round(kinds.length * (0.4 + engagement * 0.6)))
        : kinds.length;
      kinds.slice(0, count).forEach((kind, k) => {
        progress = simulateActivity(
          progress,
          module,
          kind,
          ability,
          atDay(today, Math.max(0, daysAgo), 15 + (k % 3), 10 * k),
          rng,
        );
      });
      daysAgo -= randomInt(rng, 2, 4);
    }
    reports.push(toStudentReport(progress, now, '1-A'));
  }
  return reports;
}
