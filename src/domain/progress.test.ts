import { describe, expect, it } from 'vitest';

import { BUILT_IN_MODULES } from '../content';
import {
  findFocusAreas,
  overview,
  suggestNext,
  summarizeModule,
  summarizeSkills,
  trickyWords,
} from './analytics';
import { createDemoProgress } from './demo';
import {
  applyActivityResult,
  applyReview,
  createProgress,
  forgetModule,
  progressSchema,
  type ItemAnswer,
} from './progress';

const NOW = new Date('2026-11-18T10:00:00+09:00');
const TODAY = '2026-11-18';
const animals = BUILT_IN_MODULES.find((module) => module.id === 'animals-i-like')!;

function answers(tag: string, results: boolean[]): ItemAnswer[] {
  return results.map((firstTryCorrect, index) => ({
    itemId: `${tag}-${index}`,
    skill: 'grammar',
    tags: [tag],
    firstTryCorrect,
    wrongAnswer: firstTryCorrect ? undefined : 'I like dog.',
  }));
}

describe('progress reducers', () => {
  it('records completion, best and last scores and keeps the result schema-valid', () => {
    let progress = createProgress(NOW);
    progress = applyActivityResult(
      progress,
      {
        moduleId: animals.id,
        kind: 'practice',
        score: 50,
        correct: 4,
        total: 8,
        answers: answers('plural-s', [false, true]),
      },
      NOW,
    );
    progress = applyActivityResult(
      progress,
      { moduleId: animals.id, kind: 'practice', score: 75, correct: 6, total: 8, answers: [] },
      NOW,
    );
    progress = applyActivityResult(
      progress,
      { moduleId: animals.id, kind: 'practice', score: 60, correct: 5, total: 8, answers: [] },
      NOW,
    );
    const record = progress.activities['animals-i-like/practice'];
    expect(record).toMatchObject({ attempts: 3, bestScore: 75, lastScore: 60 });
    expect(progress.days).toEqual([TODAY]);
    expect(progressSchema.safeParse(JSON.parse(JSON.stringify(progress))).success).toBe(true);
  });

  it('keeps per-item history, wrong answers and audio plays for item analysis', () => {
    let progress = createProgress(NOW);
    const item: ItemAnswer = {
      itemId: 'q1',
      skill: 'listening',
      tags: ['listening-detail'],
      firstTryCorrect: false,
      wrongAnswer: 'cats',
      plays: 3,
    };
    for (let i = 0; i < 7; i += 1) {
      progress = applyActivityResult(
        progress,
        {
          moduleId: animals.id,
          kind: 'listening',
          score: 0,
          correct: 0,
          total: 1,
          answers: [item],
        },
        NOW,
      );
    }
    const stat = progress.items['animals-i-like:q1']!;
    expect(stat.attempts).toBe(7);
    expect(stat.history).toHaveLength(5);
    expect(stat.wrong).toEqual([{ answer: 'cats', count: 7 }]);
    expect(stat.plays).toBe(21);
  });

  it('adds studied vocabulary to spaced review once and records reviews', () => {
    let progress = createProgress(NOW);
    const result = {
      moduleId: animals.id,
      kind: 'vocab' as const,
      score: null,
      correct: 0,
      total: 0,
      answers: [],
      learnedVocab: ['dog', 'cat'],
    };
    progress = applyActivityResult(progress, result, NOW);
    progress = applyActivityResult(progress, result, NOW);
    expect(Object.keys(progress.srs)).toEqual(['animals-i-like/dog', 'animals-i-like/cat']);
    const tomorrow = new Date('2026-11-19T09:00:00+09:00');
    progress = applyReview(progress, 'animals-i-like/dog', true, tomorrow);
    expect(progress.srs['animals-i-like/dog']).toMatchObject({ box: 2, reviews: 1 });
    expect(applyReview(progress, 'missing/key', true, tomorrow)).toBe(progress);
  });

  it('forgets every trace of a deleted lesson', () => {
    let progress = createProgress(NOW);
    progress = applyActivityResult(
      progress,
      {
        moduleId: 'custom-x',
        kind: 'vocab',
        score: null,
        correct: 0,
        total: 0,
        answers: answers('x', [true]),
        learnedVocab: ['w'],
      },
      NOW,
    );
    const cleaned = forgetModule(progress, 'custom-x');
    expect(cleaned.activities).toEqual({});
    expect(cleaned.items).toEqual({});
    expect(cleaned.srs).toEqual({});
    expect(cleaned.attempts).toEqual([]);
  });

  it('rejects tampered stored progress (bad keys, out-of-range values)', () => {
    const progress = createProgress(NOW);
    const tampered = JSON.parse(JSON.stringify(progress));
    tampered.activities['__proto__/quiz'] = { attempts: 1 };
    expect(progressSchema.safeParse(tampered).success).toBe(false);
    const outOfRange = JSON.parse(JSON.stringify(progress));
    outOfRange.activities['a/quiz'] = { attempts: 1, bestScore: 500 };
    expect(progressSchema.safeParse(outOfRange).success).toBe(false);
  });
});

describe('analytics', () => {
  it('summarises module completion and pass status', () => {
    let progress = createProgress(NOW);
    expect(summarizeModule(animals, progress)).toMatchObject({
      status: 'not-started',
      percent: 0,
      passed: false,
    });
    progress = applyActivityResult(
      progress,
      { moduleId: animals.id, kind: 'quiz', score: 80, correct: 8, total: 10, answers: [] },
      NOW,
    );
    const summary = summarizeModule(animals, progress);
    expect(summary).toMatchObject({
      status: 'in-progress',
      quizBest: 80,
      passed: true,
      completed: 1,
      total: 7,
    });
    expect(summary.next?.kind).toBe('vocab');
  });

  it('finds focus areas below 70% with enough evidence and points to practice', () => {
    let progress = createProgress(NOW);
    progress = applyActivityResult(
      progress,
      {
        moduleId: animals.id,
        kind: 'practice',
        score: 40,
        correct: 2,
        total: 5,
        answers: [
          ...answers('plural-s', [false, false, true, false]),
          ...answers('do-questions', [true, true, true]),
        ],
      },
      NOW,
    );
    const areas = findFocusAreas(progress, BUILT_IN_MODULES);
    expect(areas.map((area) => area.tag)).toEqual(['plural-s']);
    expect(areas[0]).toMatchObject({
      accuracy: 0.25,
      answered: 4,
      target: { moduleId: animals.id, kind: 'practice' },
    });
  });

  it('suggests review first, then the weakest area, then the lesson in progress', () => {
    let progress = createProgress(NOW);
    progress = applyActivityResult(
      progress,
      {
        moduleId: animals.id,
        kind: 'vocab',
        score: null,
        correct: 0,
        total: 0,
        answers: [],
        learnedVocab: ['dog'],
      },
      new Date('2026-11-16T10:00:00+09:00'),
    );
    progress = applyActivityResult(
      progress,
      {
        moduleId: animals.id,
        kind: 'practice',
        score: 25,
        correct: 1,
        total: 4,
        answers: answers('plural-s', [false, false, false, true]),
      },
      NOW,
    );
    const kinds = suggestNext(progress, BUILT_IN_MODULES, TODAY, 5).map(
      (suggestion) => suggestion.kind,
    );
    expect(kinds.slice(0, 3)).toEqual(['review', 'practice', 'continue']);
    expect(kinds).toContain('start');
  });

  it('reports skills and an overview with streaks and word counts', () => {
    const demo = createDemoProgress(BUILT_IN_MODULES, NOW);
    const skills = summarizeSkills(demo);
    expect(skills.map((skill) => skill.skill)).toEqual([
      'vocabulary',
      'grammar',
      'listening',
      'reading',
    ]);
    expect(skills.every((skill) => skill.answered > 0)).toBe(true);
    const stats = overview(demo, BUILT_IN_MODULES, TODAY);
    expect(stats.lessonsCompleted).toBe(2);
    expect(stats.srs.learned).toBe(24);
    expect(stats.streak).toBeGreaterThanOrEqual(1);
    expect(trickyWords(demo).length).toBeGreaterThan(0);
  });
});

describe('demo learner', () => {
  it('is deterministic, valid and clearly marked as demo data', () => {
    const a = createDemoProgress(BUILT_IN_MODULES, NOW);
    const b = createDemoProgress(BUILT_IN_MODULES, NOW);
    expect(a).toEqual(b);
    expect(a.demo).toBe(true);
    expect(a.learner.nickname).toContain('demo');
    expect(progressSchema.safeParse(JSON.parse(JSON.stringify(a))).success).toBe(true);
    expect(findFocusAreas(a, BUILT_IN_MODULES).length).toBeGreaterThan(0);
  });
});
