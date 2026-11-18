import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { BUILT_IN_MODULES } from '../../content';
import { renderWithServices } from '../../test/utils';
import { ActivityPage } from './ActivityPage';

const hello = BUILT_IN_MODULES[0]!;

describe('ActivityPage', () => {
  it('shows bilingual instructions and the educational purpose', () => {
    renderWithServices(<ActivityPage moduleId={hello.id} kind="vocab" preview={false} />);
    expect(screen.getByRole('heading', { level: 1, name: /Learn the words/ })).toBeInTheDocument();
    expect(screen.getByText('Tap a card to hear the word. Say it out loud!')).toBeInTheDocument();
    expect(screen.getByText(/カードをタップして/)).toBeInTheDocument();
    expect(screen.getByText(/Why this activity\?/)).toBeInTheDocument();
    expect(screen.getByText('Dual coding')).toBeInTheDocument();
  });

  it('records vocabulary study and adds the words to spaced review', async () => {
    const user = userEvent.setup();
    const { store, speech } = renderWithServices(
      <ActivityPage moduleId={hello.id} kind="vocab" preview={false} />,
    );

    const finish = screen.getByRole('button', { name: /Look at all 8 cards/ });
    expect(finish).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Listen: happy' }));
    expect(speech.spoken[0]?.text).toBe('happy');
    for (let i = 0; i < 7; i += 1) await user.click(screen.getByRole('button', { name: /^Next/ }));
    await user.click(screen.getByRole('button', { name: 'I studied all the words' }));

    expect(screen.getByRole('status')).toHaveTextContent('Complete!');
    const progress = store.getState().progress;
    expect(progress.activities['hello-feelings/vocab']?.completedAt).toBeDefined();
    expect(Object.keys(progress.srs)).toHaveLength(8);
    expect(screen.getByRole('link', { name: /Next: Match the pictures/ })).toHaveAttribute(
      'href',
      '#/learn/hello-feelings/match',
    );
  });

  it('plays the matching game and scores first-try matches', async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(
      <ActivityPage moduleId={hello.id} kind="match" preview={false} />,
    );
    const pictures = () => screen.getByRole('group', { name: 'Pictures' });
    const words = () => screen.getByRole('group', { name: 'Words' });

    for (let round = 0; round < 2; round += 1) {
      const wordButtons = within(words())
        .getAllByRole('button')
        .filter((button) => !(button as HTMLButtonElement).disabled);
      for (const wordButton of wordButtons) {
        const word = wordButton.textContent ?? '';
        const item = hello.vocab.find((entry) => entry.word === word)!;
        await user.click(wordButton);
        await user.click(
          within(pictures()).getByRole('button', { name: new RegExp(`Picture: ${item.ja}`) }),
        );
      }
      await user.click(screen.getByRole('button', { name: round === 0 ? /Next round/ : /Finish/ }));
    }
    expect(screen.getByRole('status')).toHaveTextContent('100%');
    expect(store.getState().progress.activities['hello-feelings/match']?.bestScore).toBe(100);
  });

  it('does not save results in teacher preview mode', async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(
      <ActivityPage moduleId={hello.id} kind="grammar" preview />,
    );
    expect(screen.getByText(/Teacher preview/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Answer/ }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('I’m sleepy.');
    await user.click(screen.getByRole('button', { name: 'sleepy' }));
    const result = document.querySelector('.switch-result');
    expect(result).toHaveTextContent('I’m sleepy.');
    expect(result?.querySelector('mark')).toHaveTextContent('sleepy');
    await user.click(screen.getAllByRole('button', { name: /Show the correction/ })[0]!);
    expect(screen.getByText('Don’t forget “am”: I + am = I’m.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ready to practise/ }));
    expect(store.getState().progress.activities).toEqual({});
  });

  it('handles unknown lessons gracefully', () => {
    renderWithServices(<ActivityPage moduleId="does-not-exist" kind="quiz" preview={false} />);
    expect(screen.getByRole('heading', { name: 'Activity not found' })).toBeInTheDocument();
  });
});
