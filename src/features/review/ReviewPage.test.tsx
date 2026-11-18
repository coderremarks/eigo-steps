import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithServices } from '../../test/utils';
import { ReviewPage } from './ReviewPage';

describe('ReviewPage (spaced review)', () => {
  it('reviews due words and moves them between Leitner boxes as answers are given', async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(<ReviewPage />, {
      now: new Date('2026-11-20T10:00:00+09:00'),
    });
    act(() => {
      store.recordActivity({
        moduleId: 'animals-i-like',
        kind: 'vocab',
        score: null,
        correct: 0,
        total: 0,
        answers: [],
        learnedVocab: ['dog', 'cat', 'rabbit', 'panda'],
      });
    });
    // Introduced "today" (Nov 20) → due tomorrow, so nothing is due yet.
    expect(screen.getByRole('heading', { name: /All caught up/ })).toBeInTheDocument();

    // Pretend the words were studied two days ago.
    act(() => {
      const progress = store.getState().progress;
      const srs = Object.fromEntries(
        Object.entries(progress.srs).map(([key, card]) => [key, { ...card, due: '2026-11-19' }]),
      );
      store.replaceProgress({ ...progress, srs });
    });
    expect(screen.getByRole('heading', { name: /4 words to review today/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Start review \(4\)/ }));

    for (let i = 0; i < 4; i += 1) {
      const options = screen.getAllByRole('radio');
      await user.click(options[0]!);
      await user.click(screen.getByRole('button', { name: /check/i }));
      await user.click(screen.getByRole('button', { name: i === 3 ? /Finish review/ : /Next/ }));
    }
    expect(screen.getByRole('status')).toHaveTextContent(/Review done: \d of 4 remembered/);
    const cards = Object.values(store.getState().progress.srs);
    expect(cards.every((card) => card.reviews === 1)).toBe(true);
    expect(cards.every((card) => card.box === 2 || (card.box === 1 && card.lapses === 1))).toBe(
      true,
    );
  });
});
