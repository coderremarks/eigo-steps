import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { buildSchema, fillSchema, listeningItemSchema, mcqSchema } from '../../../domain/schema';
import type { Task } from '../../../domain/tasks';
import { renderWithServices } from '../../../test/utils';
import { QuestionSet } from './QuestionSet';

const mcq: Task = {
  type: 'mcq',
  id: 'mcq-1',
  skill: 'grammar',
  question: mcqSchema.parse({
    kind: 'mcq',
    id: 'mcq-1',
    prompt: 'Choose the correct sentence.',
    options: ['I like pandas.', 'I like panda.', 'I am like pandas.'],
    answer: 0,
    shuffle: false,
    explanation: 'Animals in general take -s.',
    optionFeedback: ['', 'Almost! Add -s: pandas.', 'Remove “am”.'],
    tags: ['plural-s'],
  }),
};

const fill: Task = {
  type: 'fill',
  id: 'fill-1',
  skill: 'grammar',
  question: fillSchema.parse({
    kind: 'fill',
    id: 'fill-1',
    sentence: 'Ken ___ to school. (go)',
    answers: ['goes'],
    explanation: 'Ken = he → goes.',
    tags: ['third-person-s'],
  }),
};

const build: Task = {
  type: 'build',
  id: 'build-1',
  skill: 'grammar',
  question: buildSchema.parse({
    kind: 'build',
    id: 'build-1',
    prompt: 'ねこが好きです。',
    answer: 'I like cats.',
    distractors: ['cat.'],
    explanation: 'I like + cats.',
  }),
};

const listening: Task = {
  type: 'listening',
  id: 'listen-1',
  skill: 'listening',
  item: listeningItemSchema.parse({
    id: 'listen-1',
    script: [
      { speaker: 'A', text: 'How are you?' },
      { speaker: 'B', text: 'I’m hungry.' },
    ],
    question: 'How is B?',
    options: ['hungry', 'sleepy'],
    answer: 0,
    shuffle: false,
    explanation: 'B says “I’m hungry.”',
  }),
};

describe('QuestionSet', () => {
  it('gives a targeted hint after a first mistake, then accepts a correction (practice mode)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderWithServices(
      <QuestionSet tasks={[mcq]} mode="practice" seed={1} onComplete={onComplete} />,
    );

    await user.click(screen.getByLabelText('I like panda.'));
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText('Almost! Add -s: pandas.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^I like panda\./)).toBeDisabled();

    await user.click(screen.getByLabelText('I like pandas.'));
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText('Animals in general take -s.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /finish/i }));
    expect(onComplete).toHaveBeenCalledWith({
      correct: 0,
      total: 1,
      answers: [
        expect.objectContaining({
          itemId: 'mcq-1',
          firstTryCorrect: false,
          wrongAnswer: 'I like panda.',
          tags: ['plural-s'],
        }),
      ],
    });
  });

  it('shows the model answer after a second mistake', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <QuestionSet tasks={[fill]} mode="practice" seed={1} onComplete={vi.fn()} />,
    );
    const input = screen.getByLabelText('Missing word');

    await user.type(input, 'go{Enter}');
    expect(screen.getByText(/add -s or -es to the verb/i)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'gos{Enter}');
    expect(screen.getByText(/The answer is:/)).toBeInTheDocument();
    expect(screen.getByText('Ken goes to school. (go)')).toBeInTheDocument();
  });

  it('counts a correct first answer typed with a Japanese IME (full-width)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderWithServices(
      <QuestionSet tasks={[fill]} mode="practice" seed={1} onComplete={onComplete} />,
    );
    await user.type(screen.getByLabelText('Missing word'), 'ｇｏｅｓ{Enter}');
    expect(screen.getByText(/Ken = he → goes/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /finish/i }));
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ correct: 1, total: 1 });
  });

  it('builds a sentence from word tiles with word-order feedback', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <QuestionSet tasks={[build]} mode="practice" seed={3} onComplete={vi.fn()} />,
    );
    const bank = screen.getByRole('group', { name: 'Word tiles' });

    await user.click(within(bank).getByRole('button', { name: 'Add “like”' }));
    await user.click(within(bank).getByRole('button', { name: 'Add “I”' }));
    await user.click(within(bank).getByRole('button', { name: 'Add “cats.”' }));
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/right words. Check the order/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear/i }));
    for (const word of ['I', 'like', 'cats.']) {
      await user.click(within(bank).getByRole('button', { name: `Add “${word}”` }));
    }
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText('I like + cats.')).toBeInTheDocument();
  });

  it('plays dialogue audio with two voices and hides the transcript until answered', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const { speech } = renderWithServices(
      <QuestionSet tasks={[listening]} mode="practice" seed={1} onComplete={onComplete} />,
    );

    expect(screen.queryByRole('region', { name: 'Transcript' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^play$/i }));
    expect(speech.spoken.map((line) => [line.text, line.role])).toEqual([
      ['How are you?', 'A'],
      ['I’m hungry.', 'B'],
    ]);
    await user.click(screen.getByRole('button', { name: /slow/i }));
    await user.click(screen.getByRole('button', { name: /play again/i }));
    expect(speech.spoken.at(-1)?.slow).toBe(true);
    expect(screen.getByText('Played 2 times')).toBeInTheDocument();

    await user.click(screen.getByLabelText('hungry'));
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByRole('region', { name: 'Transcript' })).toHaveTextContent('I’m hungry.');

    await user.click(screen.getByRole('button', { name: /finish/i }));
    expect(onComplete.mock.calls[0]?.[0].answers[0]).toMatchObject({
      firstTryCorrect: true,
      plays: 2,
    });
  });

  it('allows one try per question in quiz mode', async () => {
    const user = userEvent.setup();
    const onItemResolved = vi.fn();
    renderWithServices(
      <QuestionSet
        tasks={[mcq, fill]}
        mode="quiz"
        seed={1}
        onComplete={vi.fn()}
        onItemResolved={onItemResolved}
      />,
    );
    await user.click(screen.getByLabelText('I am like pandas.'));
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/The answer is:/)).toBeInTheDocument();
    expect(onItemResolved).toHaveBeenCalledWith(mcq, false);
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument();
  });
});
