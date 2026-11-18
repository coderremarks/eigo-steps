import { ArrowRight } from 'lucide-react';

import type { Suggestion } from '../../domain/analytics';
import { targetHref } from './targets';

/** Transparent next steps: each suggestion says why it is suggested. */
export function SuggestionList({ suggestions }: { suggestions: readonly Suggestion[] }) {
  if (suggestions.length === 0) return <p className="muted">You’re all caught up. Great work!</p>;
  return (
    <ul className="suggestions">
      {suggestions.map((suggestion) => (
        <li key={suggestion.id} className={`suggestion suggestion-${suggestion.kind}`}>
          <a href={targetHref(suggestion.target)}>
            <span className="suggestion-title">{suggestion.title}</span>
            <span className="suggestion-reason">{suggestion.reason}</span>
            <ArrowRight aria-hidden="true" className="suggestion-arrow" />
          </a>
        </li>
      ))}
    </ul>
  );
}
