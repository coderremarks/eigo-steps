import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { BUILT_IN_MODULES } from '../../content';
import { getActivities } from '../../domain/activities';
import { moduleSchema } from '../../domain/schema';
import { renderWithServices } from '../../test/utils';
import { draftToInput, moduleToDraft, sampleDraft } from './draft';
import LessonEditor from './LessonEditor';

describe('lesson drafts', () => {
  it('round-trips every built-in lesson through the editor format', () => {
    for (const module of BUILT_IN_MODULES) {
      const input = draftToInput(moduleToDraft(module), new Set());
      const parsed = moduleSchema.safeParse(input);
      if (!parsed.success)
        throw new Error(`${module.id}: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`);
      // Nothing is lost: grammar tabs, switcher, option pictures, authored feedback, glossary…
      expect(parsed.data).toEqual({ ...module, source: 'custom' });
    }
  });

  it('turns the sample lesson into a valid lesson with all activity types', () => {
    const lesson = moduleSchema.parse(draftToInput(sampleDraft(), new Set()));
    expect(lesson.id).toBe('what-colour-is-it');
    expect(getActivities(lesson).map((activity) => activity.kind)).toEqual([
      'vocab',
      'match',
      'grammar',
      'practice',
      'listening',
      'quiz',
    ]);
  });
});

describe('LessonEditor', () => {
  it('shows a readable error summary instead of saving an incomplete lesson', async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(<LessonEditor />);
    await user.click(screen.getByRole('button', { name: /Save lesson/ }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('Please fix');
    expect(summary).toHaveTextContent(/Title is required/);
    expect(store.getState().lessons).toHaveLength(0);
  });

  it('creates a lesson from the sample and saves it to the library', async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(<LessonEditor />);
    await user.click(screen.getByRole('button', { name: /Fill with a sample lesson/ }));
    const title = () => screen.getByRole('textbox', { name: /^Title$/ });
    expect(title()).toHaveValue('What Colour Is It?');

    await user.clear(title());
    await user.type(title(), 'Colours for 3-B');
    await user.click(screen.getByRole('button', { name: /Save lesson/ }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Saved “Colours for 3-B”/)).toBeInTheDocument();
    const saved = store.getState().lessons[0]!;
    expect(saved).toMatchObject({
      id: 'colours-for-3-b',
      title: 'Colours for 3-B',
      source: 'custom',
    });
    expect(store.getState().modules.at(-1)?.id).toBe('colours-for-3-b');
  });

  it('opens a built-in lesson as an editable copy', () => {
    renderWithServices(<LessonEditor moduleId="my-day" duplicate />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Duplicate “My Day”');
    expect(screen.getByRole('textbox', { name: /^Title$/ })).toHaveValue('My Day (copy)');
  });
});
