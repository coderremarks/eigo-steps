import AxeBuilder from '@axe-core/playwright';

import { expect, openDemo, test } from './fixtures';

const PAGES = [
  '#/',
  '#/learn',
  '#/learn/my-day',
  '#/learn/my-day/vocab',
  '#/learn/my-day/match',
  '#/learn/my-day/grammar',
  '#/learn/my-day/practice',
  '#/learn/my-day/listening',
  '#/learn/my-day/reading',
  '#/review',
  '#/progress',
  '#/teacher',
  '#/teacher/new',
  '#/teacher/export/my-day',
  '#/teacher/class',
  '#/settings',
  '#/about',
];

test.describe('Accessibility (axe-core, WCAG 2.1 A/AA)', () => {
  for (const path of PAGES) {
    test(`no serious or critical violations on ${path}`, async ({ page }) => {
      await openDemo(page);
      await page.goto(`./${path}`);
      await expect(page.locator('#main h1')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(
        serious.map(
          (violation) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
    });
  }

  test('keyboard users can skip to content and operate a question without a mouse', async ({
    page,
  }) => {
    await page.goto('./#/learn/animals-i-like/practice');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();

    const first = page.locator('.choice input').first();
    await first.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  test('route changes move focus to the new page heading', async ({ page }) => {
    await page.goto('./#/learn');
    await page.getByRole('link', { name: /My Day/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /My Day/ })).toBeFocused();
    await expect(page).toHaveTitle('My Day · Eigo Steps');
  });
});

test.describe('Security and privacy', () => {
  test('the production build ships a strict Content Security Policy', async ({ page }) => {
    await page.goto('./');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  test('imported lesson text is shown as text, never executed', async ({ page }) => {
    await page.goto('./#/teacher');
    const lesson = {
      format: 'eigo-steps/lessons',
      version: 1,
      lessons: [
        {
          id: 'xss-check',
          title: '<img src=x onerror="window.__pwned=1">',
          summary: '<script>window.__pwned=1</script>',
          level: 'A1',
          audiences: ['adult'],
          topic: 'Test',
          cover: '🧪',
          minutes: 10,
          objectives: ['Can resist injection.'],
          successCriteria: ['Nothing runs.'],
          studentInstructions: { en: 'Read.', ja: '' },
          teacherInstructions: { overview: 'Test', steps: ['Test'] },
          feedback: 'Test',
          assessment: { formative: 'Test', summative: 'Test', passMark: 70 },
          vocab: [1, 2, 3, 4].map((n) => ({
            id: `w${n}`,
            word: `word${n}`,
            picture: '🍎',
            example: `Example ${n}.`,
          })),
          source: 'built-in',
        },
      ],
    };
    await page.locator('input[type=file]').setInputFiles({
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(lesson)),
    });
    await expect(page.getByRole('row', { name: /<img src=x/ })).toContainText('Teacher-made');
    await page.goto('./#/learn/xss-check');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('<img src=x onerror=');
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined();
  });
});

test.describe('Mobile layout', () => {
  for (const path of [
    '#/',
    '#/learn',
    '#/learn/around-town/match',
    '#/learn/around-town/reading',
    '#/progress',
    '#/teacher/class',
  ]) {
    test(`no horizontal scrolling on ${path} @mobile`, async ({ page }) => {
      await openDemo(page);
      await page.goto(`./${path}`);
      await expect(page.locator('#main h1')).toBeVisible();
      // Wide tables may scroll inside their own wrapper, but the page itself must not.
      const { overflow, offenders } = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        return {
          overflow: document.documentElement.scrollWidth - width,
          offenders: [...document.querySelectorAll('body *')]
            .filter((element) => element.getBoundingClientRect().right > width + 1)
            .filter((element) => !element.parentElement?.closest('.table-wrap'))
            .slice(0, 8)
            .map(
              (element) => `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`,
            ),
        };
      });
      expect(
        overflow,
        `elements wider than the screen: ${offenders.join(', ')}`,
      ).toBeLessThanOrEqual(1);
    });
  }

  test('the menu opens on small screens and closes after navigating @mobile', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('./#/learn');
    const toggle = page.getByRole('button', { name: 'Menu' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Progress' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: /My progress/ })).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
