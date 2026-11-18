/**
 * The built-in curriculum: six complete modules from Pre-A1 to A2, ordered by level.
 * Each module is validated against the same schema that guards teacher-made lessons, so a typo in
 * built-in content fails the unit tests instead of reaching a classroom.
 */
import { moduleSchema, type Module } from '../domain/schema';
import helloFeelings from './modules/m1-hello-feelings';
import animals from './modules/m2-animals';
import cafe from './modules/m3-cafe';
import myDay from './modules/m4-my-day';
import aroundTown from './modules/m5-around-town';
import weekend from './modules/m6-weekend';

export const BUILT_IN_SOURCES = [helloFeelings, animals, cafe, myDay, aroundTown, weekend];

export const BUILT_IN_MODULES: readonly Module[] = BUILT_IN_SOURCES.map((source) =>
  moduleSchema.parse({ ...source, source: 'built-in' }),
);

export const BUILT_IN_IDS: ReadonlySet<string> = new Set(
  BUILT_IN_MODULES.map((module) => module.id),
);
