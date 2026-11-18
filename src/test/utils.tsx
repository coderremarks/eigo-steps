import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

import type { SpeechService, VoiceRole } from '../services/speech';
import { createMemoryStore, type KeyValueStore } from '../services/storage';
import { ServicesProvider } from '../state/ServicesProvider';
import { AppStore } from '../state/store';

/** Records what would have been spoken, so tests can assert on audio without a speech engine. */
export class FakeSpeech implements SpeechService {
  readonly supported = true;
  spoken: { text: string; slow: boolean; role: VoiceRole }[] = [];
  speak(text: string, options: { slow?: boolean; role?: VoiceRole } = {}): Promise<void> {
    this.spoken.push({ text, slow: options.slow ?? false, role: options.role ?? 'A' });
    return Promise.resolve();
  }
  speakLines(
    lines: readonly { text: string; role: VoiceRole }[],
    options: { slow?: boolean } = {},
  ): Promise<void> {
    for (const line of lines)
      this.spoken.push({ text: line.text, slow: options.slow ?? false, role: line.role });
    return Promise.resolve();
  }
  stop(): void {}
  voices() {
    return [{ uri: 'test-voice', name: 'Test Voice', lang: 'en-US' }];
  }
  setPreferredVoice(): void {}
  subscribe(): () => void {
    return () => undefined;
  }
}

export const FIXED_NOW = new Date('2026-11-18T10:00:00+09:00');

export interface TestContext extends RenderResult {
  store: AppStore;
  speech: FakeSpeech;
  storage: KeyValueStore;
}

export function renderWithServices(
  ui: ReactElement,
  options: { storage?: KeyValueStore; now?: Date; speech?: FakeSpeech } = {},
): TestContext {
  const storage = options.storage ?? createMemoryStore();
  const now = options.now ?? FIXED_NOW;
  const store = new AppStore(storage, () => now);
  const speech = options.speech ?? new FakeSpeech();
  const result = render(<ServicesProvider services={{ store, speech }}>{ui}</ServicesProvider>);
  return { ...result, store, speech, storage };
}
