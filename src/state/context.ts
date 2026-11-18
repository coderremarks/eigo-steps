import { createContext, useContext, useSyncExternalStore } from 'react';

import { toDateString } from '../domain/dates';
import type { Module } from '../domain/schema';
import type { SpeechService } from '../services/speech';
import type { AppState, AppStore } from './store';

export interface Services {
  store: AppStore;
  speech: SpeechService;
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}

/** Subscribes to one slice of app state. Selectors must return existing references. */
export function useAppState<T>(selector: (state: AppState) => T): T {
  const { store } = useServices();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export function useStore(): AppStore {
  return useServices().store;
}

export function useSettings() {
  return useAppState((state) => state.settings);
}

export function useProgress() {
  return useAppState((state) => state.progress);
}

export function useModules(): readonly Module[] {
  return useAppState((state) => state.modules);
}

export function useModule(id: string): Module | undefined {
  return useModules().find((module) => module.id === id);
}

/** Today's date on the learner's device (re-read on each render). */
export function useToday(): string {
  return toDateString(useStore().now());
}
