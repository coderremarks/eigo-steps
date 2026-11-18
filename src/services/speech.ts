/**
 * Audio pronunciation with the browser's built-in speech synthesis (Web Speech API).
 *
 * No paid AI API, no API key, no network request from the app: voices come from the operating
 * system (Windows, ChromeOS, iPadOS, Android all ship English voices). Where speech is not
 * available the UI says so and keeps transcripts available, so the lesson still works.
 * Dialogue lines can use two different voices so learners hear who is speaking.
 */

export type VoiceRole = 'A' | 'B';

export interface VoiceInfo {
  uri: string;
  name: string;
  lang: string;
}

export interface SpeakOptions {
  slow?: boolean;
  role?: VoiceRole;
}

export interface SpeechService {
  readonly supported: boolean;
  speak(text: string, options?: SpeakOptions): Promise<void>;
  speakLines(
    lines: readonly { text: string; role: VoiceRole }[],
    options?: { slow?: boolean },
  ): Promise<void>;
  stop(): void;
  voices(): VoiceInfo[];
  setPreferredVoice(uri: string): void;
  /** Notifies when the voice list changes (browsers load voices asynchronously). */
  subscribe(listener: () => void): () => void;
}

export const NORMAL_RATE = 0.9;
export const SLOW_RATE = 0.6;

const PREFERRED_NAMES = [
  /natural/i,
  /google us english/i,
  /samantha/i,
  /aria/i,
  /jenny/i,
  /zira/i,
  /karen/i,
  /daniel/i,
];

/** Picks a clear English voice: the user's choice, then known high-quality voices, then any en-US. */
export function rankVoices<T extends { name: string; lang: string; voiceURI: string }>(
  voices: readonly T[],
  preferredUri = '',
): T[] {
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  const score = (voice: T) => {
    if (preferredUri && voice.voiceURI === preferredUri) return -100;
    const nameRank = PREFERRED_NAMES.findIndex((pattern) => pattern.test(voice.name));
    const langRank = voice.lang.toLowerCase().replace('_', '-').startsWith('en-us') ? 0 : 10;
    return langRank + (nameRank === -1 ? 50 : nameRank);
  };
  return [...english].sort((a, b) => score(a) - score(b));
}

export function createBrowserSpeech(): SpeechService {
  const synth =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return createSilentSpeech();

  let preferredUri = '';
  let generation = 0;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  synth.addEventListener?.('voiceschanged', notify);

  const ranked = () => rankVoices(synth.getVoices(), preferredUri);

  const speakOne = (text: string, role: VoiceRole, slow: boolean, token: number) =>
    new Promise<void>((resolve) => {
      if (token !== generation) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = ranked();
      const voiceA = voices[0];
      const voiceB = voices.find((voice) => voice.voiceURI !== voiceA?.voiceURI) ?? voiceA;
      const voice = role === 'B' ? voiceB : voiceA;
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'en-US';
      }
      // Without a second voice, a pitch change still tells the two speakers apart.
      utterance.pitch = role === 'B' && voiceB === voiceA ? 1.25 : 1;
      utterance.rate = slow ? SLOW_RATE : NORMAL_RATE;

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      // Some engines never fire "end"; never leave the UI waiting forever.
      const timer = setTimeout(finish, Math.max(2500, (text.length * 140) / utterance.rate));
      utterance.onend = finish;
      utterance.onerror = finish;
      synth.speak(utterance);
    });

  return {
    supported: true,
    async speak(text, options = {}) {
      synth.cancel();
      generation += 1;
      await speakOne(text, options.role ?? 'A', options.slow ?? false, generation);
    },
    async speakLines(lines, options = {}) {
      synth.cancel();
      generation += 1;
      const token = generation;
      for (const line of lines) {
        if (token !== generation) return;
        await speakOne(line.text, line.role, options.slow ?? false, token);
        if (token !== generation) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
    stop() {
      generation += 1;
      synth.cancel();
    },
    voices() {
      return ranked().map((voice) => ({ uri: voice.voiceURI, name: voice.name, lang: voice.lang }));
    },
    setPreferredVoice(uri) {
      preferredUri = uri;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Used where speech synthesis does not exist. */
export function createSilentSpeech(): SpeechService {
  return {
    supported: false,
    speak: () => Promise.resolve(),
    speakLines: () => Promise.resolve(),
    stop: () => undefined,
    voices: () => [],
    setPreferredVoice: () => undefined,
    subscribe: () => () => undefined,
  };
}
