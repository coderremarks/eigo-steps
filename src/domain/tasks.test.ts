import { describe, expect, it } from 'vitest';

import { BUILT_IN_MODULES } from '../content';
import { getActivities } from './activities';
import { createDemoClass } from './demo';
import { createRng, hashString, shuffle } from './random';
import {
  classFocusAreas,
  classOverview,
  itemAnalysis,
  learnersToSupport,
  studentRows,
  studentReportSchema,
} from './report';
import { matchingRounds, optionOrder, quizTasks, vocabTask } from './tasks';
import {
  graphemes,
  parseHighlights,
  segmentWithGlossary,
  slugify,
  stripHighlights,
  tokenize,
  uniqueId,
} from './text';

const NOW = new Date('2026-11-18T10:00:00+09:00');
const myDay = BUILT_IN_MODULES.find((module) => module.id === 'my-day')!;

describe('activities', () => {
  it('derives the teaching sequence and stable keys from content', () => {
    const activities = getActivities(myDay);
    expect(activities.map((activity) => activity.key)).toEqual([
      'my-day/vocab',
      'my-day/match',
      'my-day/grammar',
      'my-day/practice',
      'my-day/listening',
      'my-day/reading',
      'my-day/quiz',
    ]);
    expect(
      activities.every((activity) => activity.purpose.length > 40 && activity.instructions.ja),
    ).toBe(true);
  });

  it('uses child-friendly instructions for elementary lessons', () => {
    const hello = BUILT_IN_MODULES[0]!;
    expect(getActivities(hello)[0]!.instructions.en).toMatch(/Tap a card/);
    expect(getActivities(myDay)[0]!.instructions.en).toMatch(/Look at each picture/);
  });
});

describe('lesson check (quiz) generation', () => {
  it('is reproducible for a seed and different across seeds', () => {
    const a = quizTasks(myDay, 42).map((task) => task.id);
    expect(quizTasks(myDay, 42).map((task) => task.id)).toEqual(a);
    expect(quizTasks(myDay, 43).map((task) => task.id)).not.toEqual(a);
  });

  it('mixes vocabulary, grammar and listening without duplicates', () => {
    const tasks = quizTasks(myDay, 7);
    expect(tasks).toHaveLength(myDay.quizLength);
    expect(new Set(tasks.map((task) => task.id)).size).toBe(tasks.length);
    const skills = new Set(tasks.map((task) => task.skill));
    expect(skills).toEqual(new Set(['vocabulary', 'grammar', 'listening']));
  });

  it('builds picture-only listening vocabulary items with audio', () => {
    const task = vocabTask(myDay.vocab[0]!, myDay.vocab, 'audio-to-picture', createRng(1));
    expect(task.type).toBe('mcq');
    if (task.type !== 'mcq') return;
    expect(task.audio).toBe('get up');
    expect(task.question.pictureOnly).toBe(true);
    expect(task.question.options[task.question.answer]!.text).toBe('get up');
    expect(task.question.options).toHaveLength(3);
  });

  it('splits matching into balanced rounds of at most six', () => {
    expect(matchingRounds([1, 2, 3, 4, 5, 6, 7, 8]).map((round) => round.length)).toEqual([4, 4]);
    expect(matchingRounds([1, 2, 3, 4, 5, 6]).map((round) => round.length)).toEqual([6]);
    expect(matchingRounds(Array.from({ length: 13 })).map((round) => round.length)).toEqual([
      5, 4, 4,
    ]);
    expect(matchingRounds([])).toEqual([]);
  });

  it('keeps option order fixed when shuffling is off', () => {
    expect(optionOrder([{ text: 'True' }, { text: 'False' }], false, 99)).toEqual([0, 1]);
    expect(optionOrder([{ text: 'a' }, { text: 'b' }, { text: 'c' }], true, 99).sort()).toEqual([
      0, 1, 2,
    ]);
  });
});

describe('text helpers', () => {
  it('parses [highlights]', () => {
    expect(parseHighlights('I like [dogs].')).toEqual([
      { text: 'I like ', highlight: false },
      { text: 'dogs', highlight: true },
      { text: '.', highlight: false },
    ]);
    expect(stripHighlights('[Do] you like [cats]?')).toBe('Do you like cats?');
  });

  it('glosses the first occurrence of each term, longest first, on word boundaries', () => {
    const [first, second] = segmentWithGlossary(
      ['Go straight. The station is near.', 'The station is big.'],
      ['station', 'Go straight', 'go'],
    );
    expect(
      first!.filter((segment) => segment.glossIndex !== undefined).map((segment) => segment.text),
    ).toEqual(['Go straight', 'station']);
    expect(second!.some((segment) => segment.glossIndex !== undefined)).toBe(false);
    const [none] = segmentWithGlossary(['stationery'], ['station']);
    expect(none!.some((segment) => segment.glossIndex !== undefined)).toBe(false);
  });

  it('tokenises, slugs and de-duplicates ids', () => {
    expect(tokenize(' I  like cats. ')).toEqual(['I', 'like', 'cats.']);
    expect(slugify('What Colour Is It?')).toBe('what-colour-is-it');
    expect(slugify('日本語')).toBe('item');
    expect(uniqueId('a', new Set(['a', 'a-2']))).toBe('a-3');
    expect(graphemes('🐵🐧')).toEqual(['🐵', '🐧']);
  });

  it('shuffles deterministically', () => {
    const rng = createRng(hashString('seed'));
    const again = createRng(hashString('seed'));
    expect(shuffle([1, 2, 3, 4, 5], rng)).toEqual(shuffle([1, 2, 3, 4, 5], again));
  });
});

describe('class dashboard (synthetic class)', () => {
  const reports = createDemoClass(BUILT_IN_MODULES, NOW);
  const rows = studentRows(reports, BUILT_IN_MODULES);

  it('generates 24 valid, pseudonymous learner reports deterministically', () => {
    expect(reports).toHaveLength(24);
    expect(
      reports.every(
        (report) => studentReportSchema.safeParse(JSON.parse(JSON.stringify(report))).success,
      ),
    ).toBe(true);
    expect(reports.every((report) => report.nickname.endsWith('(demo)'))).toBe(true);
    expect(createDemoClass(BUILT_IN_MODULES, NOW)).toEqual(reports);
  });

  it('produces believable class statistics', () => {
    const stats = classOverview(rows, '2026-11-18');
    expect(stats.learners).toBe(24);
    expect(stats.averageCompletion).toBeGreaterThan(30);
    expect(stats.averageCompletion).toBeLessThan(100);
    expect(stats.averageQuiz).not.toBeNull();
  });

  it('ranks known trouble spots among the weakest focus areas', () => {
    const tags = classFocusAreas(reports).map((area) => area.tag);
    expect(tags.slice(0, 6)).toEqual(expect.arrayContaining(['third-person-s']));
  });

  it('runs item analysis with misconceptions and lists learners to support', () => {
    const items = itemAnalysis(reports, BUILT_IN_MODULES);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]!.facility).toBeLessThanOrEqual(items.at(-1)!.facility);
    expect(items.some((item) => item.commonWrong.length > 0)).toBe(true);
    expect(learnersToSupport(rows).length).toBeGreaterThan(0);
  });
});
