import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { STORAGE_KEYS, createMemoryStore } from '../services/storage';
import { renderWithServices } from '../test/utils';
import { App } from './App';
import { parseRoute, routeToHash } from './router';

function go(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('router', () => {
  it('parses valid routes and rejects malformed parameters', () => {
    expect(parseRoute('#/learn/my-day/quiz')).toEqual({
      name: 'activity',
      moduleId: 'my-day',
      kind: 'quiz',
      preview: false,
    });
    expect(parseRoute('#/preview/my-day/vocab')).toMatchObject({ name: 'activity', preview: true });
    expect(parseRoute('#/teacher/duplicate/my-day')).toEqual({
      name: 'teacher-edit',
      moduleId: 'my-day',
      duplicate: true,
    });
    expect(parseRoute('#/learn/my-day/hack')).toMatchObject({ name: 'not-found' });
    expect(parseRoute('#/learn/..%2F..%2Fetc')).toMatchObject({ name: 'not-found' });
    expect(parseRoute('#/learn/<script>')).toMatchObject({ name: 'not-found' });
    for (const hash of [
      '#/',
      '#/learn',
      '#/review',
      '#/progress',
      '#/teacher',
      '#/teacher/class',
      '#/settings',
      '#/about',
    ]) {
      expect(routeToHash(parseRoute(hash))).toBe(hash);
    }
  });
});

describe('App', () => {
  it('lets a recruiter explore the demo without registration', async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /English, one step at a time/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Explore the demo/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Hi, Sora \(demo\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Demo mode' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Suggested next' })).toBeInTheDocument();
    expect(store.getState().progress.demo).toBe(true);
  });

  it('resets demo progress to a fresh learner', async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(<App />);
    act(() => store.loadDemo());
    go('#/learn');
    await user.click(await screen.findByRole('button', { name: 'Start fresh' }));
    // The confirmation happens in the page (browser dialogs are blocked in many embedded views).
    expect(screen.getByRole('group', { name: /start as a new learner/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start fresh' }));
    expect(store.getState().progress.demo).toBe(false);
    expect(Object.keys(store.getState().progress.activities)).toHaveLength(0);
    expect(await screen.findByRole('heading', { level: 1, name: /Welcome!/ })).toBeInTheDocument();
  });

  it('hides Japanese support text when the setting is off', async () => {
    const user = userEvent.setup();
    renderWithServices(<App />);
    go('#/learn/hello-feelings');
    expect(await screen.findByText(/えを見て、おとをきいて/)).toBeInTheDocument();
    go('#/settings');
    await user.click(await screen.findByLabelText(/Japanese support/));
    go('#/learn/hello-feelings');
    await screen.findByRole('heading', { level: 1, name: /Hello! How are you\?/ });
    expect(screen.queryByText(/えを見て、おとをきいて/)).not.toBeInTheDocument();
  });

  it('persists progress on the device and survives corrupted storage', () => {
    const storage = createMemoryStore({
      [STORAGE_KEYS.progress]: '{"version":1,"learner":{"nickname":"<b>x</b>"',
    });
    const first = renderWithServices(<App />, { storage });
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be read/);
    expect(storage.get(`${STORAGE_KEYS.progress}:invalid`)).toContain('"version":1');
    act(() => first.store.loadDemo());
    first.unmount();

    renderWithServices(<App />, { storage });
    go('#/progress');
    expect(screen.getByText(/Sora \(demo\) · saved on this device only/)).toBeInTheDocument();
  });

  it('shows the class dashboard with synthetic data and the spaced-review boxes', async () => {
    renderWithServices(<App />);
    go('#/teacher/class');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Class overview/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Hardest questions/ })).toBeInTheDocument();
    expect(screen.getByText('learners').previousElementSibling).toHaveTextContent('24');
    go('#/review');
    expect(await screen.findByRole('heading', { name: 'Your word boxes' })).toBeInTheDocument();
    expect(screen.getByText('No words yet')).toBeInTheDocument();
  });
});
