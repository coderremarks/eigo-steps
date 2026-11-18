/**
 * Answer checking and corrective feedback.
 *
 * Feedback follows a "prompt first, then model" sequence: a first wrong answer gets a hint that
 * points at the cause (e.g. "Ken = he, so add -s") so the learner can self-correct; a second wrong
 * answer shows the correct form with an explanation. The rule-based diagnoses below cover the most
 * frequent, predictable errors of Japanese-speaking beginners, so no paid AI service is needed.
 */
import { tagInfo } from './tags';
import type { BuildQuestion, FillQuestion } from './schema';
import { editDistance, tokenize } from './text';

export type Diagnosis =
  | 'correct'
  | 'empty'
  | 'common-error'
  | 'third-person-s'
  | 'plural-s'
  | 'past-tense'
  | 'irregular-past'
  | 'spelling'
  | 'incomplete'
  | 'extra-words'
  | 'word-order'
  | 'wrong';

export interface CheckResult {
  correct: boolean;
  diagnosis: Diagnosis;
  /** Feedback to show after this attempt (a hint, not the answer). */
  hint: string;
}

/**
 * Normalises typed answers: full-width characters from a Japanese IME become ASCII (ｐｌａｙｓ →
 * plays), curly quotes become straight, case and trailing punctuation are ignored.
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?。！？]+$/u, '')
    .trim();
}

/** Base form → past form for the irregular verbs used at Pre-A1–A2. */
export const IRREGULAR_PAST: Readonly<Record<string, string>> = {
  be: 'was',
  buy: 'bought',
  come: 'came',
  do: 'did',
  drink: 'drank',
  eat: 'ate',
  fall: 'fell',
  find: 'found',
  get: 'got',
  give: 'gave',
  go: 'went',
  have: 'had',
  leave: 'left',
  make: 'made',
  meet: 'met',
  read: 'read',
  ride: 'rode',
  run: 'ran',
  say: 'said',
  see: 'saw',
  sing: 'sang',
  sit: 'sat',
  sleep: 'slept',
  swim: 'swam',
  take: 'took',
  tell: 'told',
  think: 'thought',
  wear: 'wore',
  win: 'won',
  write: 'wrote',
};

const PAST_TO_BASE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(IRREGULAR_PAST).map(([base, past]) => [past, base]),
);

function hasTag(tags: readonly string[], ...wanted: string[]): boolean {
  return wanted.some((tag) => tags.includes(tag));
}

/** "plays" → ["play"], "goes" → ["go"], "studies" → ["study"]. */
function stemsOfSForm(word: string): string[] {
  const stems: string[] = [];
  if (word.endsWith('ies')) stems.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('es')) stems.push(word.slice(0, -2));
  if (word.endsWith('s')) stems.push(word.slice(0, -1));
  return stems;
}

/** Same-length phrases differing only in one word: returns that pair. */
function singleWordDifference(given: string, expected: string): [string, string] | null {
  const a = given.split(' ');
  const b = expected.split(' ');
  if (a.length !== b.length) return null;
  const diffs = a.flatMap((word, index) => (word === b[index] ? [] : [[word, b[index] ?? '']]));
  return diffs.length === 1 ? (diffs[0] as [string, string]) : null;
}

/** Diagnoses a single wrong word against the expected word. */
function diagnoseWord(
  given: string,
  expected: string,
  tags: readonly string[],
): CheckResult | null {
  // Missing -s / -es: "play" for "plays".
  if (stemsOfSForm(expected).includes(given)) {
    if (hasTag(tags, 'plural-s')) {
      return {
        correct: false,
        diagnosis: 'plural-s',
        hint: 'When you talk about many things or a kind of thing in general, add -s: dogs, cats.',
      };
    }
    return {
      correct: false,
      diagnosis: 'third-person-s',
      hint: "Look at the subject. With he, she, it or one person's name, add -s or -es to the verb.",
    };
  }

  // Extra -s after I/you/we/they or after does/did.
  if (
    stemsOfSForm(given).includes(expected) &&
    hasTag(tags, 'third-person-s', 'do-does-questions')
  ) {
    return {
      correct: false,
      diagnosis: 'third-person-s',
      hint: 'No -s here. Use the base form after I, you, we, they — and after does or did.',
    };
  }

  // Past tense.
  const irregularBase = PAST_TO_BASE[expected];
  if (irregularBase !== undefined) {
    if (given === `${irregularBase}ed` || given === `${irregularBase}d`) {
      return {
        correct: false,
        diagnosis: 'irregular-past',
        hint: `Good try! "${irregularBase}" is an irregular verb, so it doesn't use -ed.`,
      };
    }
    if (given === irregularBase || stemsOfSForm(given).includes(irregularBase)) {
      return {
        correct: false,
        diagnosis: 'past-tense',
        hint: `This happened in the past. Change "${irregularBase}" to its past form.`,
      };
    }
  }
  if (expected.endsWith('ed')) {
    const base = expected.slice(0, -2);
    const baseWithE = expected.slice(0, -1);
    if (
      given === base ||
      given === baseWithE ||
      stemsOfSForm(given).some((s) => s === base || s === baseWithE)
    ) {
      return {
        correct: false,
        diagnosis: 'past-tense',
        hint: 'This happened in the past. Add -ed to the verb.',
      };
    }
  }

  // Near miss.
  const distance = editDistance(given, expected);
  const allowed = expected.length >= 7 ? 2 : 1;
  if (expected.length >= 3 && distance > 0 && distance <= allowed) {
    return { correct: false, diagnosis: 'spelling', hint: 'Almost! Check your spelling.' };
  }
  return null;
}

export function checkFill(question: FillQuestion, input: string): CheckResult {
  const given = normalizeAnswer(input);
  if (given === '') {
    return { correct: false, diagnosis: 'empty', hint: 'Type or choose your answer first.' };
  }
  const accepted = question.answers.map(normalizeAnswer);
  if (accepted.includes(given)) {
    return { correct: true, diagnosis: 'correct', hint: '' };
  }

  const known = question.commonErrors.find((error) => normalizeAnswer(error.answer) === given);
  if (known) {
    return { correct: false, diagnosis: 'common-error', hint: known.feedback };
  }

  const expected = accepted[0] ?? '';
  const pair = singleWordDifference(given, expected) ?? [given, expected];
  const diagnosed = diagnoseWord(pair[0], pair[1], question.tags);
  if (diagnosed) return diagnosed;

  return {
    correct: false,
    diagnosis: 'wrong',
    hint: question.hint || 'Not quite. Read the whole sentence again and look for clues.',
  };
}

export function buildTiles(question: BuildQuestion): string[] {
  return [...tokenize(question.answer), ...question.distractors];
}

function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function correctPrefixLength(given: readonly string[], expected: readonly string[]): number {
  let count = 0;
  while (count < given.length && count < expected.length && given[count] === expected[count])
    count += 1;
  return count;
}

export interface BuildCheckResult extends CheckResult {
  /** How many words at the start are already right (for partial feedback). */
  correctPrefix: number;
}

export function checkBuild(question: BuildQuestion, chosen: readonly string[]): BuildCheckResult {
  if (chosen.length === 0) {
    return {
      correct: false,
      diagnosis: 'empty',
      hint: 'Tap the words to build your sentence.',
      correctPrefix: 0,
    };
  }
  const targets = [question.answer, ...question.alternatives].map(tokenize);
  if (
    targets.some(
      (target) => target.length === chosen.length && target.every((word, i) => word === chosen[i]),
    )
  ) {
    return { correct: true, diagnosis: 'correct', hint: '', correctPrefix: chosen.length };
  }

  const expected = targets[0] ?? [];
  const prefix = correctPrefixLength(chosen, expected);
  const progress =
    prefix > 0 ? ` The first ${prefix === 1 ? 'word is' : `${prefix} words are`} right.` : '';

  // Any distractor tile used?
  const remaining = [...expected];
  let usedExtra = false;
  for (const word of chosen) {
    const index = remaining.indexOf(word);
    if (index === -1) usedExtra = true;
    else remaining.splice(index, 1);
  }
  if (usedExtra) {
    return {
      correct: false,
      diagnosis: 'extra-words',
      hint: `One of your words doesn't belong in this sentence.${progress}`,
      correctPrefix: prefix,
    };
  }
  if (chosen.length < expected.length) {
    return {
      correct: false,
      diagnosis: 'incomplete',
      hint: `Some words are missing.${progress}`,
      correctPrefix: prefix,
    };
  }
  if (sameMultiset(chosen, expected)) {
    const orderHint = question.tags.map((tag) => tagInfo(tag).orderHint).find(Boolean);
    return {
      correct: false,
      diagnosis: 'word-order',
      hint: `You have the right words. Check the order.${progress}${orderHint ? ` ${orderHint}` : ''}`,
      correctPrefix: prefix,
    };
  }
  return {
    correct: false,
    diagnosis: 'wrong',
    hint: `Not quite.${progress}`,
    correctPrefix: prefix,
  };
}

export interface ChoiceResult extends CheckResult {
  selected: number;
}

export function checkChoice(
  answer: number,
  selected: number,
  optionFeedback: readonly string[],
): ChoiceResult {
  if (selected === answer) return { correct: true, diagnosis: 'correct', hint: '', selected };
  const specific = optionFeedback[selected]?.trim();
  return {
    correct: false,
    diagnosis: specific ? 'common-error' : 'wrong',
    hint: specific || 'Not quite. Look again and try another answer.',
    selected,
  };
}

const PRAISE = [
  'Great job!',
  'Excellent!',
  "That's right!",
  'Perfect!',
  'Nice work!',
  'Well done!',
];
const PRAISE_JA = [
  'すごい！',
  '正解！',
  'よくできました！',
  'ばっちり！',
  'いいね！',
  'その調子！',
];

export function praise(seed: number): { en: string; ja: string } {
  const index = Math.abs(seed) % PRAISE.length;
  return { en: PRAISE[index] ?? PRAISE[0]!, ja: PRAISE_JA[index] ?? PRAISE_JA[0]! };
}

/** Converts first-try results into a 0–100 score. */
export function scorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export type Stars = 0 | 1 | 2 | 3;

export function starsFor(score: number): Stars {
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  if (score >= 40) return 1;
  return 0;
}

export function completionMessage(score: number, passMark: number): { en: string; ja: string } {
  if (score >= 90) {
    return {
      en: "Excellent! You're ready for the next activity.",
      ja: 'すばらしい！次の活動に進もう。',
    };
  }
  if (score >= passMark) {
    return {
      en: 'Good work! Look again at the ones you missed.',
      ja: 'よくできました！まちがえた問題をもう一度見てみよう。',
    };
  }
  return {
    en: 'Good effort! Review the explanation and try this activity again.',
    ja: 'よくがんばったね！説明を見直して、もう一度チャレンジしよう。',
  };
}
