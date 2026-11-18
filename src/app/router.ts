/**
 * A small hash router. Hash URLs (#/learn/my-day) work on any static host — GitHub Pages, a school
 * file server, even opened from a USB stick — without server rewrite rules. Route parameters are
 * validated (slug pattern, known activity kinds) before any page sees them.
 */
import { useSyncExternalStore } from 'react';

import { isActivityKind, type ActivityKind } from '../domain/activities';
import { SLUG_PATTERN } from '../domain/schema';

export type Route =
  | { name: 'landing' }
  | { name: 'learn' }
  | { name: 'module'; moduleId: string }
  | { name: 'activity'; moduleId: string; kind: ActivityKind; preview: boolean }
  | { name: 'review' }
  | { name: 'progress' }
  | { name: 'teacher' }
  | { name: 'teacher-new' }
  | { name: 'teacher-edit'; moduleId: string; duplicate: boolean }
  | { name: 'teacher-export'; moduleId: string }
  | { name: 'teacher-class' }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'not-found'; path: string };

const isSlug = (value: string | undefined): value is string =>
  value !== undefined && value.length <= 60 && SLUG_PATTERN.test(value);

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0] ?? '';
  const parts = path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
  const [first, second, third] = parts;

  if (parts.length === 0) return { name: 'landing' };
  switch (first ?? '') {
    case 'learn':
      if (parts.length === 1) return { name: 'learn' };
      if (parts.length === 2 && isSlug(second)) return { name: 'module', moduleId: second };
      if (parts.length === 3 && isSlug(second) && third !== undefined && isActivityKind(third)) {
        return { name: 'activity', moduleId: second, kind: third, preview: false };
      }
      break;
    case 'preview':
      if (parts.length === 3 && isSlug(second) && third !== undefined && isActivityKind(third)) {
        return { name: 'activity', moduleId: second, kind: third, preview: true };
      }
      break;
    case 'review':
      if (parts.length === 1) return { name: 'review' };
      break;
    case 'progress':
      if (parts.length === 1) return { name: 'progress' };
      break;
    case 'settings':
      if (parts.length === 1) return { name: 'settings' };
      break;
    case 'about':
      if (parts.length === 1) return { name: 'about' };
      break;
    case 'teacher':
      if (parts.length === 1) return { name: 'teacher' };
      if (parts.length === 2 && second === 'new') return { name: 'teacher-new' };
      if (parts.length === 2 && second === 'class') return { name: 'teacher-class' };
      if (parts.length === 3 && second === 'edit' && isSlug(third)) {
        return { name: 'teacher-edit', moduleId: third, duplicate: false };
      }
      if (parts.length === 3 && second === 'duplicate' && isSlug(third)) {
        return { name: 'teacher-edit', moduleId: third, duplicate: true };
      }
      if (parts.length === 3 && second === 'export' && isSlug(third)) {
        return { name: 'teacher-export', moduleId: third };
      }
      break;
    default:
      break;
  }
  return { name: 'not-found', path };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'landing':
      return '#/';
    case 'learn':
      return '#/learn';
    case 'module':
      return `#/learn/${route.moduleId}`;
    case 'activity':
      return `#/${route.preview ? 'preview' : 'learn'}/${route.moduleId}/${route.kind}`;
    case 'review':
      return '#/review';
    case 'progress':
      return '#/progress';
    case 'teacher':
      return '#/teacher';
    case 'teacher-new':
      return '#/teacher/new';
    case 'teacher-edit':
      return `#/teacher/${route.duplicate ? 'duplicate' : 'edit'}/${route.moduleId}`;
    case 'teacher-export':
      return `#/teacher/export/${route.moduleId}`;
    case 'teacher-class':
      return '#/teacher/class';
    case 'settings':
      return '#/settings';
    case 'about':
      return '#/about';
    case 'not-found':
      return `#/${route.path}`;
  }
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
}

export function useRoute(): Route {
  return parseRoute(useHash());
}

export function navigate(to: Route | string): void {
  const hash = typeof to === 'string' ? to : routeToHash(to);
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

export function href(route: Route): string {
  return routeToHash(route);
}
