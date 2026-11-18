import { routeToHash } from '../../app/router';
import type { SuggestionTarget } from '../../domain/analytics';

/** Where a "suggested next" item should take the learner. */
export function targetHref(target: SuggestionTarget): string {
  switch (target.type) {
    case 'review':
      return '#/review';
    case 'module':
      return routeToHash({ name: 'module', moduleId: target.moduleId });
    case 'activity':
      return routeToHash({
        name: 'activity',
        moduleId: target.moduleId,
        kind: target.kind,
        preview: false,
      });
  }
}
