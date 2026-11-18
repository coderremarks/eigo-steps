import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared fixtures:
 * - a deterministic speech-synthesis stub (headless browsers have no voices), which records
 *   every utterance in window.__spoken so tests can assert on audio;
 * - collection of console errors and of any request that leaves the app's own origin, so every
 *   test also checks "no errors" and "no data sent anywhere".
 */
declare global {
  interface Window {
    __spoken: { text: string; rate: number }[];
  }
}

async function installSpeechStub(page: Page) {
  await page.addInitScript(() => {
    window.__spoken = [];
    class FakeUtterance extends EventTarget {
      text: string;
      rate = 1;
      pitch = 1;
      lang = 'en-US';
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        super();
        this.text = text;
      }
    }
    const voices = [
      {
        name: 'Test English A',
        lang: 'en-US',
        voiceURI: 'test-a',
        default: true,
        localService: true,
      },
      {
        name: 'Test English B',
        lang: 'en-GB',
        voiceURI: 'test-b',
        default: false,
        localService: true,
      },
    ];
    const synth = {
      speaking: false,
      getVoices: () => voices,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      cancel: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      speak(utterance: FakeUtterance) {
        window.__spoken.push({ text: utterance.text, rate: utterance.rate });
        setTimeout(() => utterance.onend?.(), 20);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: FakeUtterance,
      configurable: true,
    });
  });
}

interface Fixtures {
  appErrors: string[];
  foreignRequests: string[];
}

export const test = base.extend<Fixtures>({
  appErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
  },
  foreignRequests: async ({ page, baseURL }, use) => {
    const foreign: string[] = [];
    const origin = new URL(baseURL ?? 'http://localhost').origin;
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'))
        foreign.push(url);
    });
    await use(foreign);
  },
  page: async ({ page }, use) => {
    await installSpeechStub(page);
    page.on('dialog', (dialog) => void dialog.accept());
    await use(page);
  },
});

test.afterEach(({ appErrors, foreignRequests }) => {
  expect(appErrors, 'console errors').toEqual([]);
  expect(foreignRequests, 'requests to other origins').toEqual([]);
});

export { expect };

export async function spoken(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__spoken.map((entry) => entry.text));
}

/** Opens the app with the synthetic demo learner loaded. */
export async function openDemo(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: /Explore the demo/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Hi, Sora \(demo\)/ })).toBeVisible();
}
