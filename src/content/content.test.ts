import { describe, expect, it } from 'vitest';

import { getActivities } from '../domain/activities';
import { checkBuild, checkFill, normalizeAnswer } from '../domain/grading';
import { moduleSchema } from '../domain/schema';
import { stripHighlights, tokenize } from '../domain/text';
import { BUILT_IN_MODULES, BUILT_IN_SOURCES } from './index';

describe('built-in curriculum', () => {
  it('has at least six complete modules', () => {
    expect(BUILT_IN_MODULES.length).toBeGreaterThanOrEqual(6);
  });

  it.each(BUILT_IN_SOURCES.map((source) => [source.id, source] as const))(
    '%s passes the same validation as teacher-made lessons',
    (_id, source) => {
      const result = moduleSchema.safeParse(source);
      if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2));
      expect(result.success).toBe(true);
    },
  );

  it('covers Pre-A1, A1 and A2 and all three learner groups', () => {
    const levels = new Set(BUILT_IN_MODULES.map((module) => module.level));
    const audiences = new Set(BUILT_IN_MODULES.flatMap((module) => module.audiences));
    expect([...levels].sort()).toEqual(['A1', 'A2', 'Pre-A1']);
    expect([...audiences].sort()).toEqual(['adult', 'elementary', 'junior-high']);
  });

  it.each(BUILT_IN_MODULES.map((module) => [module.id, module] as const))(
    '%s includes every required educational component',
    (_id, module) => {
      expect(module.objectives.length).toBeGreaterThan(0);
      expect(module.successCriteria.length).toBeGreaterThan(0);
      expect(module.studentInstructions.en).not.toBe('');
      expect(module.studentInstructions.ja).not.toBe('');
      expect(module.teacherInstructions.steps.length).toBeGreaterThan(2);
      expect(module.feedback).not.toBe('');
      expect(module.assessment.formative).not.toBe('');
      expect(module.assessment.summative).not.toBe('');
      // Every skill area is practised in every module.
      const kinds = getActivities(module).map((activity) => activity.kind);
      expect(kinds).toEqual([
        'vocab',
        'match',
        'grammar',
        'practice',
        'listening',
        'reading',
        'quiz',
      ]);
    },
  );

  it.each(BUILT_IN_MODULES.map((module) => [module.id, module] as const))(
    '%s answer keys are consistent with the grader',
    (_id, module) => {
      for (const question of module.practice) {
        if (question.kind === 'fill') {
          for (const answer of question.answers)
            expect(checkFill(question, answer).correct).toBe(true);
          for (const choice of question.choices) {
            const isAnswer = question.answers.some(
              (answer) => normalizeAnswer(answer) === normalizeAnswer(choice),
            );
            expect(checkFill(question, choice).correct).toBe(isAnswer);
          }
          for (const error of question.commonErrors) {
            expect(checkFill(question, error.answer).correct).toBe(false);
          }
        }
        if (question.kind === 'build') {
          expect(checkBuild(question, tokenize(question.answer)).correct).toBe(true);
          for (const distractor of question.distractors) {
            expect(tokenize(question.answer)).not.toContain(distractor);
          }
        }
      }
    },
  );

  it('uses unique module ids and ASCII-safe example highlighting', () => {
    const ids = BUILT_IN_MODULES.map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const module of BUILT_IN_MODULES) {
      for (const item of module.vocab) {
        expect(stripHighlights(item.example)).not.toMatch(/[[\]]/);
      }
    }
  });
});
