/**
 * Turns raw progress into the things a learner and a teacher act on: lesson completion, skill
 * accuracy, focus areas that need review, and transparent "what next?" suggestions (each one says
 * why it was suggested).
 */
import { getActivities, type ActivityInfo, type ActivityKind } from './activities';
import { currentStreak } from './dates';
import type { Progress } from './progress';
import { SKILLS, type Module, type Skill } from './schema';
import { dueCards, summarizeSrs, type SrsCard, type SrsSummary } from './srs';
import { tagInfo } from './tags';

export type ModuleStatus = 'not-started' | 'in-progress' | 'completed';

export interface ActivityState {
  info: ActivityInfo;
  completed: boolean;
  bestScore?: number;
  lastScore?: number;
  attempts: number;
}

export interface ModuleSummary {
  moduleId: string;
  activities: ActivityState[];
  completed: number;
  total: number;
  percent: number;
  status: ModuleStatus;
  quizBest?: number;
  passed: boolean;
  /** First activity not yet completed. */
  next?: ActivityInfo;
}

export function summarizeModule(module: Module, progress: Progress): ModuleSummary {
  const activities = getActivities(module).map((info): ActivityState => {
    const record = progress.activities[info.key];
    return {
      info,
      completed: Boolean(record?.completedAt),
      bestScore: record?.bestScore,
      lastScore: record?.lastScore,
      attempts: record?.attempts ?? 0,
    };
  });
  const completed = activities.filter((activity) => activity.completed).length;
  const total = activities.length;
  const quiz = activities.find((activity) => activity.info.kind === 'quiz');
  const quizBest = quiz?.bestScore;
  return {
    moduleId: module.id,
    activities,
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    status: completed === 0 ? 'not-started' : completed === total ? 'completed' : 'in-progress',
    quizBest,
    passed: quizBest !== undefined && quizBest >= module.assessment.passMark,
    next: activities.find((activity) => !activity.completed)?.info,
  };
}

export interface SkillSummary {
  skill: Skill;
  answered: number;
  /** First-try accuracy over all answers (0–1), or null when nothing was answered. */
  accuracy: number | null;
}

export function summarizeSkills(progress: Progress): SkillSummary[] {
  const totals = new Map<Skill, { answered: number; correct: number }>();
  for (const item of Object.values(progress.items)) {
    const entry = totals.get(item.skill) ?? { answered: 0, correct: 0 };
    entry.answered += item.attempts;
    entry.correct += item.firstTryCorrect;
    totals.set(item.skill, entry);
  }
  return SKILLS.map((skill) => {
    const entry = totals.get(skill);
    return {
      skill,
      answered: entry?.answered ?? 0,
      accuracy: entry && entry.answered > 0 ? entry.correct / entry.answered : null,
    };
  });
}

export interface FocusArea {
  tag: string;
  label: string;
  ja: string;
  teacherNote: string;
  /** Recent first-try accuracy (0–1). */
  accuracy: number;
  answered: number;
  /** Where to practise it: the activity where this tag went worst. */
  target: { moduleId: string; kind: ActivityKind } | null;
}

export interface FocusOptions {
  threshold?: number;
  minAnswers?: number;
  limit?: number;
}

/** Tags whose recent first-try accuracy is below the threshold (default 70%). */
export function findFocusAreas(
  progress: Progress,
  modules: readonly Module[],
  options: FocusOptions = {},
): FocusArea[] {
  const { threshold = 0.7, minAnswers = 3, limit = 5 } = options;
  const byTag = new Map<
    string,
    {
      right: number;
      total: number;
      perModule: Map<string, { right: number; total: number; skill: Skill }>;
    }
  >();

  for (const item of Object.values(progress.items)) {
    for (const tag of item.tags) {
      if (tag === 'vocabulary') continue; // words are tracked by spaced review instead
      const entry = byTag.get(tag) ?? {
        right: 0,
        total: 0,
        perModule: new Map<string, { right: number; total: number; skill: Skill }>(),
      };
      const right = item.history.filter(Boolean).length;
      entry.right += right;
      entry.total += item.history.length;
      const moduleEntry = entry.perModule.get(item.moduleId) ?? {
        right: 0,
        total: 0,
        skill: item.skill,
      };
      moduleEntry.right += right;
      moduleEntry.total += item.history.length;
      entry.perModule.set(item.moduleId, moduleEntry);
      byTag.set(tag, entry);
    }
  }

  const known = new Map(modules.map((module) => [module.id, module]));
  const areas: FocusArea[] = [];
  for (const [tag, entry] of byTag) {
    if (entry.total < minAnswers) continue;
    const accuracy = entry.right / entry.total;
    if (accuracy >= threshold) continue;

    let target: FocusArea['target'] = null;
    let worst = Infinity;
    for (const [moduleId, moduleEntry] of entry.perModule) {
      const module = known.get(moduleId);
      if (!module || moduleEntry.total === 0) continue;
      const moduleAccuracy = moduleEntry.right / moduleEntry.total;
      if (moduleAccuracy < worst) {
        worst = moduleAccuracy;
        target = { moduleId, kind: kindForSkill(module, moduleEntry.skill) };
      }
    }
    const info = tagInfo(tag);
    areas.push({
      tag,
      label: info.label,
      ja: info.ja,
      teacherNote: info.teacherNote,
      accuracy,
      answered: entry.total,
      target,
    });
  }
  return areas.sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered).slice(0, limit);
}

function kindForSkill(module: Module, skill: Skill): ActivityKind {
  const kinds = new Set(getActivities(module).map((activity) => activity.kind));
  const preferred: Record<Skill, ActivityKind[]> = {
    grammar: ['practice', 'grammar', 'quiz'],
    listening: ['listening', 'quiz'],
    reading: ['reading'],
    vocabulary: ['match', 'vocab'],
  };
  return preferred[skill].find((kind) => kinds.has(kind)) ?? 'quiz';
}

export interface TrickyWord {
  card: SrsCard;
}

/** Words that keep slipping: forgotten at least twice, or back in box 1 after reviews. */
export function trickyWords(progress: Progress, limit = 6): SrsCard[] {
  return Object.values(progress.srs)
    .filter((card) => card.lapses >= 2 || (card.box === 1 && card.reviews > 0))
    .sort((a, b) => b.lapses - a.lapses || a.box - b.box)
    .slice(0, limit);
}

export type SuggestionTarget =
  | { type: 'review' }
  | { type: 'activity'; moduleId: string; kind: ActivityKind }
  | { type: 'module'; moduleId: string };

export interface Suggestion {
  id: string;
  kind: 'review' | 'practice' | 'continue' | 'retake' | 'start';
  title: string;
  reason: string;
  target: SuggestionTarget;
}

/**
 * Up to `limit` next steps, most valuable first:
 * 1. due spaced-review words, 2. the weakest focus area, 3. the lesson in progress,
 * 4. a lesson check below the pass mark, 5. the next lesson at the right level.
 */
export function suggestNext(
  progress: Progress,
  modules: readonly Module[],
  today: string,
  limit = 3,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const cards = Object.values(progress.srs);
  const due = dueCards(cards, today);
  if (due.length > 0) {
    suggestions.push({
      id: 'review',
      kind: 'review',
      title: `Review ${due.length} ${due.length === 1 ? 'word' : 'words'}`,
      reason: 'These words are due today. Short, spaced reviews help you remember them for longer.',
      target: { type: 'review' },
    });
  }

  const focus = findFocusAreas(progress, modules, { limit: 1 })[0];
  const byId = new Map(modules.map((module) => [module.id, module]));
  if (focus?.target) {
    const module = byId.get(focus.target.moduleId);
    suggestions.push({
      id: `focus-${focus.tag}`,
      kind: 'practice',
      title: `Practise: ${focus.label}`,
      reason: `Your recent first-try accuracy here is ${Math.round(focus.accuracy * 100)}%.${module ? ` Try it again in “${module.title}”.` : ''}`,
      target: { type: 'activity', moduleId: focus.target.moduleId, kind: focus.target.kind },
    });
  }

  const summaries = modules.map((module) => ({
    module,
    summary: summarizeModule(module, progress),
  }));
  const inProgress = summaries
    .filter(({ summary }) => summary.status === 'in-progress' && summary.next)
    .sort((a, b) =>
      lastActivityAt(progress, b.module.id).localeCompare(lastActivityAt(progress, a.module.id)),
    )[0];
  if (inProgress?.summary.next) {
    suggestions.push({
      id: `continue-${inProgress.module.id}`,
      kind: 'continue',
      title: `Continue “${inProgress.module.title}”`,
      reason: `Next up: ${inProgress.summary.next.title} (${inProgress.summary.completed} of ${inProgress.summary.total} activities done).`,
      target: {
        type: 'activity',
        moduleId: inProgress.module.id,
        kind: inProgress.summary.next.kind,
      },
    });
  }

  const toRetake = summaries.find(
    ({ summary }) => summary.quizBest !== undefined && !summary.passed,
  );
  if (toRetake) {
    suggestions.push({
      id: `retake-${toRetake.module.id}`,
      kind: 'retake',
      title: `Retry the lesson check in “${toRetake.module.title}”`,
      reason: `Your best score is ${toRetake.summary.quizBest}%. The goal is ${toRetake.module.assessment.passMark}%.`,
      target: { type: 'activity', moduleId: toRetake.module.id, kind: 'quiz' },
    });
  }

  const nextModule = summaries.find(({ summary }) => summary.status === 'not-started');
  if (nextModule) {
    suggestions.push({
      id: `start-${nextModule.module.id}`,
      kind: 'start',
      title: `Start “${nextModule.module.title}”`,
      reason: `${nextModule.module.level} · ${nextModule.module.minutes} minutes · ${nextModule.module.summary}`,
      target: { type: 'module', moduleId: nextModule.module.id },
    });
  }

  const seen = new Set<string>();
  return suggestions
    .filter((suggestion) => {
      const key = JSON.stringify(suggestion.target);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function lastActivityAt(progress: Progress, moduleId: string): string {
  let latest = '';
  for (const attempt of progress.attempts) {
    if (attempt.moduleId === moduleId && attempt.at > latest) latest = attempt.at;
  }
  return latest;
}

export interface Overview {
  lessonsCompleted: number;
  activitiesCompleted: number;
  averageQuiz: number | null;
  streak: number;
  activeDays: number;
  srs: SrsSummary;
}

export function overview(progress: Progress, modules: readonly Module[], today: string): Overview {
  const summaries = modules.map((module) => summarizeModule(module, progress));
  const quizScores = summaries.flatMap((summary) =>
    summary.quizBest === undefined ? [] : [summary.quizBest],
  );
  return {
    lessonsCompleted: summaries.filter((summary) => summary.status === 'completed').length,
    activitiesCompleted: summaries.reduce((sum, summary) => sum + summary.completed, 0),
    averageQuiz:
      quizScores.length === 0
        ? null
        : Math.round(quizScores.reduce((sum, value) => sum + value, 0) / quizScores.length),
    streak: currentStreak(progress.days, today),
    activeDays: progress.days.length,
    srs: summarizeSrs(Object.values(progress.srs), today),
  };
}

/** Recent scored attempts for the score-history chart, newest last. */
export function scoreHistory(progress: Progress, limit = 12) {
  return progress.attempts.filter((attempt) => attempt.score !== null).slice(-limit);
}
