import { readFile } from 'node:fs/promises';

import { expect, test } from './fixtures';

test.describe('Teacher mode', () => {
  test('create a lesson, preview it as a student, and find it in the library', async ({ page }) => {
    await page.goto('./#/teacher/new');
    await page.getByRole('button', { name: /Fill with a sample lesson/ }).click();
    await page.getByRole('textbox', { name: /^Title$/ }).fill('Colours for 3-B');
    await page.getByRole('button', { name: /Save & preview/ }).click();

    await expect(page).toHaveURL(/#\/preview\/colours-for-3-b\/vocab$/);
    await expect(page.getByText(/Teacher preview — answers are not saved/)).toBeVisible();
    await expect(page.getByText('red', { exact: true }).first()).toBeVisible();

    await page.goto('./#/teacher');
    const row = page.getByRole('row', { name: /Colours for 3-B/ });
    await expect(row).toContainText('Teacher-made');
    await expect(row.getByRole('link', { name: /Edit/ })).toBeVisible();

    // Learners see it in their lesson list too.
    await page.goto('./#/learn');
    await expect(page.getByRole('link', { name: /Colours for 3-B/ })).toContainText('Teacher-made');
  });

  test('the editor blocks invalid lessons with a readable error summary', async ({ page }) => {
    await page.goto('./#/teacher/new');
    await page.getByRole('button', { name: /Save lesson/ }).click();
    const summary = page.getByRole('alert');
    await expect(summary).toContainText('Please fix');
    await expect(summary).toContainText('Title is required');
    await expect(summary).toBeFocused();
  });

  test('export printable materials and lesson/vocabulary files', async ({ page }) => {
    await page.goto('./#/teacher/export/animals-i-like');
    await expect(page.locator('.print-card')).toHaveCount(8);

    await page.getByRole('button', { name: 'Worksheet' }).click();
    await expect(page.getByText(/Part A · Vocabulary/)).toBeVisible();
    await expect(page.getByText(/Put the words in order/)).toBeVisible();
    await page.getByRole('button', { name: 'Answer key' }).click();
    await expect(page.getByRole('heading', { name: 'Answer key' })).toBeVisible();
    await page.getByRole('button', { name: 'Lesson plan' }).click();
    await expect(page.getByText(/Learning objectives/)).toBeVisible();

    const csvDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: /Vocabulary \(.csv\)/ }).click();
    const csv = await csvDownload;
    expect(csv.suggestedFilename()).toBe('animals-i-like-vocabulary.csv');
    expect(await readFile(await csv.path(), 'utf8')).toContain('"rabbit","うさぎ"');

    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: /Lesson file/ }).click();
    const lessonFile = await jsonDownload;
    const text = await readFile(await lessonFile.path(), 'utf8');
    expect(JSON.parse(text)).toMatchObject({
      format: 'eigo-steps/lessons',
      lessons: [{ id: 'animals-i-like' }],
    });

    // A colleague imports the shared file: it becomes a separate, editable lesson.
    await page.goto('./#/teacher');
    await page.locator('input[type=file]').setInputFiles({
      name: 'animals.lesson.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
    await expect(page.getByRole('status')).toContainText('Imported 1 lesson');
    await expect(page.getByRole('row', { name: /Animals I Like/ })).toHaveCount(2);
  });

  test('class overview with synthetic data and imported learner reports', async ({ page }) => {
    await page.goto('./#/teacher/class');
    await expect(page.getByText('Demo data: 24 invented learners')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Hardest questions/ })).toBeVisible();
    await expect(page.locator('.focus-list li').first()).toBeVisible();

    // A learner downloads a report; the teacher imports it.
    await page.goto('./#/progress');
    const reportDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download report/ }).click();
    const report = await readFile(await (await reportDownload).path(), 'utf8');
    await page.goto('./#/teacher/class');
    await page.locator('input[type=file]').setInputFiles({
      name: 'report.json',
      mimeType: 'application/json',
      buffer: Buffer.from(report),
    });
    await expect(page.getByText(/Imported 1 report/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Imported reports \(1\)/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
