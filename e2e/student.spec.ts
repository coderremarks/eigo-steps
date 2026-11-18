import { expect, openDemo, spoken, test } from './fixtures';

test.describe('Learner journeys', () => {
  test('a recruiter explores the demo without registering @mobile', async ({ page }) => {
    await openDemo(page);
    await expect(page.getByRole('region', { name: 'Demo mode' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Suggested next' })).toBeVisible();
    await expect(page.locator('.suggestion').first()).toContainText(/Review \d+ words/);
    await expect(page.getByRole('link', { name: /Hello! How are you\?/ })).toBeVisible();
  });

  test('a new learner studies flashcards with audio and progress is saved on the device @mobile', async ({
    page,
  }) => {
    await page.goto('./#/learn/hello-feelings/vocab');
    await page.getByRole('button', { name: 'Listen: happy' }).click();
    await expect.poll(() => spoken(page)).toContain('happy');

    for (let card = 1; card < 8; card += 1) {
      await page.getByRole('button', { name: /^Next/ }).click();
    }
    await page.getByRole('button', { name: 'I studied all the words' }).click();
    await expect(page.getByRole('status')).toContainText('Complete!');
    await expect(page.getByText(/8 words are now in your spaced review/)).toBeVisible();

    // Local-first: the result survives a reload with no server involved.
    await page.goto('./#/learn/hello-feelings');
    await page.reload();
    await expect(page.locator('.activity-list li').first()).toHaveClass(/done/);
    await expect(page.getByText('1 of 7 activities')).toBeVisible();
  });

  test('grammar practice gives a hint first, accepts a correction, then moves on', async ({
    page,
  }) => {
    await page.goto('./#/learn/my-day/practice');
    const input = page.getByLabel('Missing word');
    await input.fill('get');
    await input.press('Enter');
    await expect(page.getByText('Yuki is one person (she). Add -s: gets.')).toBeVisible();

    await input.fill('gets');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('.feedback-correct')).toContainText('get → gets');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Question 2 of 10')).toBeVisible();
  });

  test('listening: replay and slow controls, transcript only after answering', async ({ page }) => {
    await page.goto('./#/learn/cafe-ordering/listening');
    await expect(page.getByRole('region', { name: 'Transcript' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => spoken(page)).toContain('Hello! What would you like?');
    await page.getByRole('button', { name: 'Slow' }).click();
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByText('Played 2 times')).toBeVisible();
    const rates = await page.evaluate(() => window.__spoken.map((entry) => entry.rate));
    expect(Math.min(...rates)).toBeLessThan(0.7);

    await page.getByRole('radio', { name: 'a sandwich and orange juice' }).check({ force: true });
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByRole('region', { name: 'Transcript' })).toContainText(
      'I’d like a sandwich and orange juice, please.',
    );
  });

  test('reading: tap a glossed word to see its meaning, then answer', async ({ page }) => {
    await page.goto('./#/learn/around-town/reading');
    await page.getByRole('button', { name: 'visitors' }).click();
    await expect(page.locator('#gloss-panel')).toContainText('People who come to see a place.');
    await expect(page.locator('#gloss-panel')).toContainText('訪問者');
    await page.getByRole('radio', { name: 'next to a big park' }).check({ force: true });
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('.feedback-correct')).toBeVisible();
  });

  test('a full lesson check records a score and updates Progress', async ({ page }) => {
    await page.goto('./#/learn/hello-feelings/quiz');
    await expect(page.getByText(/Goal: 70% or more/)).toBeVisible();
    for (let i = 0; i < 8; i += 1) {
      await expect(page.getByText(`Question ${i + 1} of 8`)).toBeVisible();
      // Answer whatever kind of question appears (choice, word bank, typing or word tiles).
      const radios = page.locator('.question-card input[type=radio]:not([disabled])');
      const typed = page.getByLabel('Missing word');
      const tiles = page.getByRole('group', { name: 'Word tiles' }).getByRole('button');
      if ((await radios.count()) > 0) await radios.first().check({ force: true });
      else if ((await typed.count()) > 0) await typed.fill('answer');
      else await tiles.first().click();
      await page.getByRole('button', { name: 'Check' }).click();
      await page.getByRole('button', { name: i === 7 ? 'See my result' : 'Next' }).click();
    }
    await expect(page.getByRole('status')).toContainText('%');
    await page.goto('./#/progress');
    const lessons = page.locator('section[aria-labelledby="lessons-title"]');
    await expect(lessons.getByRole('row', { name: /Hello! How are you\?/ })).toContainText(
      /\d+% \(goal 70%\)/,
    );
  });

  test('spaced review session with the demo learner', async ({ page }) => {
    await openDemo(page);
    await page
      .getByRole('link', { name: /Review/ })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: 'Your word boxes' })).toBeVisible();
    await page.getByRole('button', { name: /Start review/ }).click();
    await expect(page.getByText(/Question 1 of \d+/)).toBeVisible();
    await page.locator('.question-card input').first().check({ force: true });
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.locator('.feedback-correct, .feedback-revealed')).toBeVisible();
  });
});
