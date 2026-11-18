import { describe, expect, it } from 'vitest';

import {
  checkBuild,
  checkChoice,
  checkFill,
  completionMessage,
  normalizeAnswer,
  scorePercent,
  starsFor,
} from './grading';
import { buildSchema, fillSchema, type BuildQuestion, type FillQuestion } from './schema';

const fill = (overrides: Partial<FillQuestion> & { answers: string[] }): FillQuestion =>
  fillSchema.parse({
    kind: 'fill',
    id: 'q',
    sentence: 'He ___ tennis.',
    explanation: 'He → plays.',
    ...overrides,
  });

const build = (answer: string, extra: Partial<BuildQuestion> = {}): BuildQuestion =>
  buildSchema.parse({ kind: 'build', id: 'b', prompt: 'p', answer, explanation: 'e', ...extra });

describe('normalizeAnswer', () => {
  it('ignores case, spacing, trailing punctuation and curly apostrophes', () => {
    expect(normalizeAnswer('  Don’t  ')).toBe("don't");
    expect(normalizeAnswer('Plays.')).toBe('plays');
    expect(normalizeAnswer('I  am')).toBe('i am');
  });

  it('converts full-width input from a Japanese IME', () => {
    expect(normalizeAnswer('ｐｌａｙｓ')).toBe('plays');
    expect(normalizeAnswer('Ｉ’ｍ')).toBe("i'm");
  });
});

describe('checkFill', () => {
  it('accepts any listed answer', () => {
    const q = fill({ answers: ['plays', 'is playing'] });
    expect(checkFill(q, 'plays').correct).toBe(true);
    expect(checkFill(q, 'Is playing').correct).toBe(true);
  });

  it('asks for an answer when the input is empty', () => {
    expect(checkFill(fill({ answers: ['plays'] }), '   ')).toMatchObject({
      correct: false,
      diagnosis: 'empty',
    });
  });

  it('uses the authored feedback for a known common error first', () => {
    const q = fill({
      answers: ['plays'],
      commonErrors: [{ answer: 'play', feedback: 'Ken = he → plays.' }],
    });
    expect(checkFill(q, 'play')).toMatchObject({
      diagnosis: 'common-error',
      hint: 'Ken = he → plays.',
    });
  });

  it('diagnoses a missing third-person -s', () => {
    expect(checkFill(fill({ answers: ['plays'] }), 'play').diagnosis).toBe('third-person-s');
    expect(checkFill(fill({ answers: ['watches'] }), 'watch').diagnosis).toBe('third-person-s');
  });

  it('diagnoses a missing plural -s when the item is about plurals', () => {
    const q = fill({ sentence: 'I like ___.', answers: ['dogs'], tags: ['plural-s'] });
    expect(checkFill(q, 'dog').diagnosis).toBe('plural-s');
  });

  it('diagnoses over-regularised irregular past forms', () => {
    const q = fill({ sentence: 'I ___ to the zoo.', answers: ['went'], tags: ['past-irregular'] });
    const result = checkFill(q, 'goed');
    expect(result.diagnosis).toBe('irregular-past');
    expect(result.hint).toContain('irregular');
  });

  it('diagnoses a present form used for the past', () => {
    expect(checkFill(fill({ sentence: 'I ___ there.', answers: ['went'] }), 'go').diagnosis).toBe(
      'past-tense',
    );
    expect(
      checkFill(fill({ sentence: 'We ___ TV.', answers: ['watched'] }), 'watch').diagnosis,
    ).toBe('past-tense');
  });

  it('spots near-miss spelling', () => {
    expect(
      checkFill(fill({ sentence: 'I ___ there.', answers: ['visited'] }), 'visted').diagnosis,
    ).toBe('spelling');
  });

  it('falls back to the authored hint', () => {
    expect(
      checkFill(fill({ answers: ['plays'], hint: 'Look at the subject.' }), 'sleeps').hint,
    ).toBe('Look at the subject.');
  });
});

describe('checkBuild', () => {
  const q = build('Do you like elephants?', { distractors: ['Are'], tags: ['do-questions'] });

  it('accepts the exact order and listed alternatives', () => {
    expect(checkBuild(q, ['Do', 'you', 'like', 'elephants?']).correct).toBe(true);
    const alt = build('Ken plays tennis after school.', {
      alternatives: ['After school Ken plays tennis.'],
    });
    expect(checkBuild(alt, ['After', 'school', 'Ken', 'plays', 'tennis.']).correct).toBe(true);
  });

  it('explains word-order mistakes and reports correct leading words', () => {
    const result = checkBuild(q, ['Do', 'like', 'you', 'elephants?']);
    expect(result.diagnosis).toBe('word-order');
    expect(result.correctPrefix).toBe(1);
    expect(result.hint).toContain('first word is right');
    expect(result.hint).toContain('"Do" comes first');
  });

  it('notices distractor tiles and missing words', () => {
    expect(checkBuild(q, ['Are', 'you', 'like', 'elephants?']).diagnosis).toBe('extra-words');
    expect(checkBuild(q, ['Do', 'you', 'like']).diagnosis).toBe('incomplete');
    expect(checkBuild(q, []).diagnosis).toBe('empty');
  });
});

describe('checkChoice', () => {
  it('returns option-specific corrective feedback', () => {
    const result = checkChoice(0, 2, ['', '', 'Remove “am”.']);
    expect(result).toMatchObject({
      correct: false,
      diagnosis: 'common-error',
      hint: 'Remove “am”.',
    });
    expect(checkChoice(0, 1, []).hint).toMatch(/Not quite/);
    expect(checkChoice(1, 1, []).correct).toBe(true);
  });
});

describe('scores', () => {
  it('rounds percentages and maps them to stars and messages', () => {
    expect(scorePercent(2, 3)).toBe(67);
    expect(scorePercent(0, 0)).toBe(0);
    expect(starsFor(95)).toBe(3);
    expect(starsFor(75)).toBe(2);
    expect(starsFor(50)).toBe(1);
    expect(starsFor(10)).toBe(0);
    expect(completionMessage(60, 70).en).toMatch(/try this activity again/);
    expect(completionMessage(80, 70).en).toMatch(/Good work/);
  });
});
