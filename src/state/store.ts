/**
 * The single source of truth for the UI: progress, settings, teacher-made lessons and the imported
 * class roster. A tiny observable store (no framework) with explicit actions; every change is
 * persisted to the device immediately, and every action goes through the pure, unit-tested domain
 * functions.
 */
import { z } from 'zod';

import { BUILT_IN_IDS, BUILT_IN_MODULES } from '../content';
import { createDemoProgress } from '../domain/demo';
import {
  applyActivityResult,
  applyReview,
  createProgress,
  forgetModule,
  progressSchema,
  type ActivityResult,
  type Progress,
} from '../domain/progress';
import { studentReportSchema, type StudentReport } from '../domain/report';
import { describeIssues, LIMITS, moduleSchema, type Module } from '../domain/schema';
import { loadJson, saveJson, STORAGE_KEYS, type KeyValueStore } from '../services/storage';
import { defaultSettings, settingsSchema, type Settings } from './settings';

const lessonsSchema = z.array(moduleSchema).max(LIMITS.storedLessons);
const rosterSchema = z.array(studentReportSchema).max(200);

export interface AppState {
  progress: Progress;
  settings: Settings;
  /** Teacher-made (custom) lessons. */
  lessons: readonly Module[];
  /** Built-in + custom lessons, in display order. */
  modules: readonly Module[];
  /** Learner reports imported by the teacher. */
  roster: readonly StudentReport[];
  /** True when progress was found on this device at start-up. */
  returning: boolean;
  /** Storage keys whose data was invalid and set aside at start-up. */
  recovered: readonly string[];
}

export type SaveLessonResult = { ok: true; lesson: Module } | { ok: false; errors: string[] };

function combine(lessons: readonly Module[]): readonly Module[] {
  return [...BUILT_IN_MODULES, ...lessons];
}

export class AppStore {
  private state: AppState;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly storage: KeyValueStore,
    private readonly clock: () => Date = () => new Date(),
  ) {
    const progress = loadJson(storage, STORAGE_KEYS.progress, progressSchema, () =>
      createProgress(clock()),
    );
    const settings = loadJson(storage, STORAGE_KEYS.settings, settingsSchema, defaultSettings);
    const lessons = loadJson(storage, STORAGE_KEYS.lessons, lessonsSchema, () => []);
    const roster = loadJson(storage, STORAGE_KEYS.classRoster, rosterSchema, () => []);
    const customLessons = lessons.value
      .filter((lesson) => !BUILT_IN_IDS.has(lesson.id))
      .map((lesson) => ({ ...lesson, source: 'custom' as const }));
    this.state = {
      progress: progress.value,
      settings: settings.value,
      lessons: customLessons,
      modules: combine(customLessons),
      roster: roster.value,
      returning: progress.status === 'ok',
      recovered: [progress, settings, lessons, roster]
        .map((loaded, index) =>
          loaded.status === 'recovered' ? Object.values(STORAGE_KEYS)[index] : null,
        )
        .filter((key): key is NonNullable<typeof key> => key !== null),
    };
  }

  readonly getState = (): AppState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  now(): Date {
    return this.clock();
  }

  private update(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    if (patch.progress) saveJson(this.storage, STORAGE_KEYS.progress, this.state.progress);
    if (patch.settings) saveJson(this.storage, STORAGE_KEYS.settings, this.state.settings);
    if (patch.lessons) {
      saveJson(this.storage, STORAGE_KEYS.lessons, this.state.lessons);
      this.state = { ...this.state, modules: combine(this.state.lessons) };
    }
    if (patch.roster) saveJson(this.storage, STORAGE_KEYS.classRoster, this.state.roster);
    this.listeners.forEach((listener) => listener());
  }

  // --- learner ---------------------------------------------------------------------------------

  recordActivity(result: ActivityResult): void {
    this.update({
      progress: applyActivityResult(this.state.progress, result, this.clock()),
      returning: true,
    });
  }

  recordReview(cardKey: string, correct: boolean): void {
    this.update({
      progress: applyReview(this.state.progress, cardKey, correct, this.clock()),
      returning: true,
    });
  }

  updateLearner(patch: { nickname?: string; avatar?: string }): void {
    const nickname = patch.nickname?.trim().slice(0, 24);
    this.update({
      progress: {
        ...this.state.progress,
        learner: {
          ...this.state.progress.learner,
          ...(nickname ? { nickname } : {}),
          ...(patch.avatar ? { avatar: patch.avatar.slice(0, 16) } : {}),
        },
      },
    });
  }

  updateSettings(patch: Partial<Omit<Settings, 'version'>>): void {
    const next = settingsSchema.safeParse({ ...this.state.settings, ...patch });
    if (next.success) this.update({ settings: next.data });
  }

  /** Loads the synthetic demo learner (replaces this device's progress). */
  loadDemo(): void {
    this.update({
      progress: createDemoProgress(BUILT_IN_MODULES, this.clock()),
      settings: { ...this.state.settings, teachingNotes: true },
      returning: true,
    });
  }

  /** Clears all learner progress on this device and starts again. */
  startFresh(learner: { nickname?: string; avatar?: string } = {}): void {
    this.update({ progress: createProgress(this.clock(), learner), returning: true });
  }

  replaceProgress(progress: Progress): void {
    this.update({ progress, returning: true });
  }

  // --- teacher ---------------------------------------------------------------------------------

  saveLesson(input: unknown): SaveLessonResult {
    const parsed = moduleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, errors: describeIssues(parsed.error) };
    if (BUILT_IN_IDS.has(parsed.data.id)) {
      return {
        ok: false,
        errors: ['This lesson id belongs to a built-in lesson. Choose another id.'],
      };
    }
    const lesson: Module = {
      ...parsed.data,
      source: 'custom',
      updatedAt: this.clock().toISOString(),
    };
    const exists = this.state.lessons.some((item) => item.id === lesson.id);
    if (!exists && this.state.lessons.length >= LIMITS.storedLessons) {
      return {
        ok: false,
        errors: [`You can store up to ${LIMITS.storedLessons} lessons. Delete one first.`],
      };
    }
    const lessons = exists
      ? this.state.lessons.map((item) => (item.id === lesson.id ? lesson : item))
      : [...this.state.lessons, lesson];
    this.update({ lessons });
    return { ok: true, lesson };
  }

  addLessons(lessons: readonly Module[]): number {
    const room = Math.max(0, LIMITS.storedLessons - this.state.lessons.length);
    const accepted = lessons
      .slice(0, room)
      .map((lesson) => ({ ...lesson, source: 'custom' as const }));
    if (accepted.length > 0) this.update({ lessons: [...this.state.lessons, ...accepted] });
    return accepted.length;
  }

  deleteLesson(id: string): void {
    if (BUILT_IN_IDS.has(id)) return;
    this.update({
      lessons: this.state.lessons.filter((lesson) => lesson.id !== id),
      progress: forgetModule(this.state.progress, id),
    });
  }

  setRoster(reports: readonly StudentReport[]): void {
    this.update({ roster: reports.slice(0, 200) });
  }
}
