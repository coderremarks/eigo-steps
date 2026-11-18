/**
 * Spaced review with a five-box Leitner system.
 *
 * Words enter box 1 when a learner studies them. A correct review moves a word up one box and
 * schedules it further in the future; a mistake sends it back to box 1 so it comes back today.
 * Leitner boxes are simple enough to explain to a nine-year-old ("this word is in box 4!") and to a
 * teacher, while still giving the expanding intervals that make spaced retrieval effective.
 */
import { addDays } from './dates';

export type Box = 1 | 2 | 3 | 4 | 5;

/** Days until the next review after a correct answer moves the word INTO this box. */
export const BOX_INTERVAL_DAYS: Readonly<Record<Box, number>> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
/** A word already in box 5 that is answered correctly again comes back in a month. */
export const MASTERED_INTERVAL_DAYS = 30;
export const MASTERED_BOX: Box = 5;

export interface SrsCard {
  moduleId: string;
  vocabId: string;
  box: Box;
  /** Local calendar date (YYYY-MM-DD) when the word is next due. */
  due: string;
  lastReviewed: string | null;
  reviews: number;
  lapses: number;
}

export function srsKey(moduleId: string, vocabId: string): string {
  return `${moduleId}/${vocabId}`;
}

/** A newly studied word: first review tomorrow (spacing beats cramming). */
export function introduceCard(moduleId: string, vocabId: string, today: string): SrsCard {
  return {
    moduleId,
    vocabId,
    box: 1,
    due: addDays(today, 1),
    lastReviewed: null,
    reviews: 0,
    lapses: 0,
  };
}

export function reviewCard(card: SrsCard, correct: boolean, today: string): SrsCard {
  if (!correct) {
    return {
      ...card,
      box: 1,
      due: today,
      lastReviewed: today,
      reviews: card.reviews + 1,
      lapses: card.lapses + 1,
    };
  }
  const box = Math.min(card.box + 1, MASTERED_BOX) as Box;
  const interval = card.box === MASTERED_BOX ? MASTERED_INTERVAL_DAYS : BOX_INTERVAL_DAYS[box];
  return {
    ...card,
    box,
    due: addDays(today, interval),
    lastReviewed: today,
    reviews: card.reviews + 1,
  };
}

export function isDue(card: SrsCard, today: string): boolean {
  return card.due <= today;
}

/** Due cards, lowest box first (the least-known words), then the most overdue. */
export function dueCards(cards: readonly SrsCard[], today: string, limit = Infinity): SrsCard[] {
  return cards
    .filter((card) => isDue(card, today))
    .sort(
      (a, b) => a.box - b.box || a.due.localeCompare(b.due) || a.vocabId.localeCompare(b.vocabId),
    )
    .slice(0, limit);
}

export interface SrsSummary {
  learned: number;
  due: number;
  mastered: number;
  /** Count of words in boxes 1..5. */
  byBox: [number, number, number, number, number];
  nextDue: string | null;
}

export function summarizeSrs(cards: readonly SrsCard[], today: string): SrsSummary {
  const byBox: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let due = 0;
  let nextDue: string | null = null;
  for (const card of cards) {
    byBox[card.box - 1] = (byBox[card.box - 1] ?? 0) + 1;
    if (isDue(card, today)) due += 1;
    else if (nextDue === null || card.due < nextDue) nextDue = card.due;
  }
  return { learned: cards.length, due, mastered: byBox[4], byBox, nextDue };
}
