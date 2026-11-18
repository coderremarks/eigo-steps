import { describe, expect, it } from 'vitest';

import { addDays, currentStreak, daysBetween, toDateString } from './dates';
import { dueCards, introduceCard, isDue, reviewCard, summarizeSrs, type SrsCard } from './srs';

const TODAY = '2026-11-18';

describe('Leitner spaced review', () => {
  it('schedules a newly studied word for tomorrow', () => {
    const card = introduceCard('my-day', 'get-up', TODAY);
    expect(card).toMatchObject({ box: 1, due: '2026-11-19', reviews: 0, lapses: 0 });
    expect(isDue(card, TODAY)).toBe(false);
    expect(isDue(card, '2026-11-19')).toBe(true);
  });

  it('moves a word up one box with growing intervals when remembered', () => {
    let card = introduceCard('m', 'w', TODAY);
    const dues: string[] = [];
    let day = card.due;
    for (let i = 0; i < 5; i += 1) {
      card = reviewCard(card, true, day);
      dues.push(`${card.box}:${daysBetween(day, card.due)}`);
      day = card.due;
    }
    expect(dues).toEqual(['2:1', '3:3', '4:7', '5:14', '5:30']);
  });

  it('sends a forgotten word back to box 1, due again today', () => {
    const card: SrsCard = {
      moduleId: 'm',
      vocabId: 'w',
      box: 4,
      due: TODAY,
      lastReviewed: null,
      reviews: 3,
      lapses: 0,
    };
    expect(reviewCard(card, false, TODAY)).toMatchObject({
      box: 1,
      due: TODAY,
      lapses: 1,
      reviews: 4,
    });
  });

  it('orders due words weakest first and summarises the boxes', () => {
    const cards: SrsCard[] = [
      {
        moduleId: 'm',
        vocabId: 'a',
        box: 3,
        due: '2026-11-10',
        lastReviewed: null,
        reviews: 2,
        lapses: 0,
      },
      {
        moduleId: 'm',
        vocabId: 'b',
        box: 1,
        due: '2026-11-17',
        lastReviewed: null,
        reviews: 1,
        lapses: 1,
      },
      {
        moduleId: 'm',
        vocabId: 'c',
        box: 5,
        due: '2026-12-01',
        lastReviewed: null,
        reviews: 4,
        lapses: 0,
      },
    ];
    expect(dueCards(cards, TODAY).map((card) => card.vocabId)).toEqual(['b', 'a']);
    expect(dueCards(cards, TODAY, 1)).toHaveLength(1);
    expect(summarizeSrs(cards, TODAY)).toEqual({
      learned: 3,
      due: 2,
      mastered: 1,
      byBox: [1, 0, 1, 0, 1],
      nextDue: '2026-12-01',
    });
  });
});

describe('calendar dates', () => {
  it('adds days across months and leap years without time-zone drift', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-11-18', '2026-12-02')).toBe(14);
    expect(toDateString(new Date(2026, 10, 18, 23, 59))).toBe('2026-11-18');
  });

  it('counts a streak that ends today or yesterday', () => {
    expect(currentStreak(['2026-11-16', '2026-11-17', '2026-11-18'], TODAY)).toBe(3);
    expect(currentStreak(['2026-11-16', '2026-11-17'], TODAY)).toBe(2);
    expect(currentStreak(['2026-11-10'], TODAY)).toBe(0);
  });
});
