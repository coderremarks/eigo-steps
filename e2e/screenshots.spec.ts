/**
 * Regenerates the portfolio screenshots in docs/screenshots (run: `npm run screenshots`).
 * Uses the same production build and the synthetic demo learner, so images match the live demo.
 */
import { expect, openDemo, test } from './fixtures';

const DIR = 'docs/screenshots';

test.describe.configure({ mode: 'serial' });

test('capture portfolio screenshots', async ({ page }) => {
  test.setTimeout(180_000);
  const shot = async (name: string, fullPage = false) => {
    // Lazy-loaded pages show "Loading…" for a moment: wait for the real heading and pictures.
    await expect(page.locator('#main h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `${DIR}/${name}.png`,
      fullPage,
      animations: 'disabled',
      // A sticky header would be painted mid-page in full-page captures.
      style: '.site-header { position: static !important; }',
    });
  };

  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot('01-landing');

  await openDemo(page);
  await shot('02-student-home');

  await page.goto('./#/learn/animals-i-like/vocab');
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: /^Next/ }).click();
  await shot('03-flashcards');

  await page.goto('./#/learn/animals-i-like/match');
  const firstWord = page.getByRole('group', { name: 'Words' }).getByRole('button').first();
  await firstWord.click();
  await shot('04-matching');

  await page.goto('./#/learn/my-day/grammar');
  await page.getByRole('button', { name: 'She', exact: true }).click();
  await page
    .getByRole('button', { name: /Show the correction/ })
    .first()
    .click();
  await shot('05-grammar', true);

  await page.goto('./#/learn/my-day/practice');
  await page.getByLabel('Missing word').fill('get');
  await page.getByLabel('Missing word').press('Enter');
  await shot('06-practice-hint');

  await page.goto('./#/learn/animals-i-like/practice');
  for (let i = 0; i < 4; i += 1) {
    await page.locator('.question-card input:not([disabled])').first().check({ force: true });
    const bank = page.locator('.word-bank input');
    if ((await bank.count()) > 0) await bank.first().check({ force: true });
    await page.getByRole('button', { name: 'Check' }).click();
    if (await page.getByRole('button', { name: 'Check' }).isVisible()) {
      await page.locator('.question-card input:not([disabled])').first().check({ force: true });
      await page.getByRole('button', { name: 'Check' }).click();
    }
    await page.getByRole('button', { name: 'Next' }).click();
  }
  const bank = page.getByRole('group', { name: 'Word tiles' });
  for (const word of ['I', 'cats.', 'like'])
    await bank.getByRole('button', { name: `Add “${word}”` }).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await shot('07-sentence-builder');

  await page.goto('./#/learn/cafe-ordering/listening');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  await page.getByRole('radio', { name: 'a sandwich and orange juice' }).check({ force: true });
  await page.getByRole('button', { name: 'Check' }).click();
  await shot('08-listening', true);

  await page.goto('./#/learn/my-weekend/reading');
  await page.getByRole('button', { name: 'food stalls' }).click();
  await shot('09-reading');

  await page.goto('./#/progress');
  await shot('10-progress', true);

  await page.goto('./#/review');
  await shot('11-spaced-review');

  await page.goto('./#/teacher');
  await shot('12-teacher-library');

  await page.goto('./#/teacher/new');
  await page.getByRole('button', { name: /Fill with a sample lesson/ }).click();
  await shot('13-lesson-editor');

  await page.goto('./#/teacher/export/my-day');
  await page.getByRole('button', { name: 'Worksheet' }).click();
  await shot('14-export-worksheet');

  await page.goto('./#/teacher/class');
  await shot('15-class-dashboard', true);

  await page.goto('./#/learn/hello-feelings');
  await page.getByText('For teachers: lesson plan, feedback and assessment').click();
  await shot('16-module-teacher-notes', true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/learn');
  await shot('17-mobile-home');
  await page.goto('./#/learn/hello-feelings/listening');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  await shot('18-mobile-listening');
});
