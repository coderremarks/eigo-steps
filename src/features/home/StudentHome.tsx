import { ArrowRight, Clock, Repeat } from 'lucide-react';
import { useMemo } from 'react';

import { routeToHash } from '../../app/router';
import { suggestNext, summarizeModule } from '../../domain/analytics';
import { AUDIENCE_LABELS } from '../../domain/schema';
import { dueCards } from '../../domain/srs';
import { useModules, useProgress, useSettings, useStore, useToday } from '../../state/context';
import { AUDIENCE_FILTERS } from '../../state/settings';
import { AudienceChips, Ja, LevelBadge, ProgressRing } from '../../ui/common';
import { usePageTitle } from '../../ui/format';
import { Illustration } from '../../ui/Illustration';
import { SuggestionList } from './SuggestionList';

export function StudentHome() {
  usePageTitle('Lessons');
  const store = useStore();
  const modules = useModules();
  const progress = useProgress();
  const settings = useSettings();
  const today = useToday();

  const suggestions = useMemo(
    () => suggestNext(progress, modules, today),
    [progress, modules, today],
  );
  const due = useMemo(
    () => dueCards(Object.values(progress.srs), today).length,
    [progress.srs, today],
  );
  const visible = modules.filter(
    (module) => settings.audience === 'all' || module.audiences.includes(settings.audience),
  );
  const isNew = Object.keys(progress.activities).length === 0;

  return (
    <section className="page" aria-labelledby="home-title">
      <header className="page-header learner-header">
        <span className="avatar" aria-hidden="true">
          <Illustration emoji={progress.learner.avatar} size="md" />
        </span>
        <div>
          <h1 id="home-title" tabIndex={-1}>
            {isNew ? 'Welcome!' : `Hi, ${progress.learner.nickname}!`}{' '}
            <Ja className="title-ja">{isNew ? 'ようこそ！' : 'こんにちは！'}</Ja>
          </h1>
          <p className="muted">
            {isNew
              ? 'Choose a lesson to start. Your progress is saved on this device.'
              : 'Here is what to do next.'}
          </p>
        </div>
      </header>

      {isNew ? (
        <div className="notice notice-info">
          <p>
            New here? Start with{' '}
            <a href={routeToHash({ name: 'module', moduleId: modules[0]?.id ?? '' })}>
              “{modules[0]?.title}”
            </a>
            , or{' '}
            <button type="button" className="link-btn" onClick={() => store.loadDemo()}>
              load the demo learner
            </button>{' '}
            to see progress tracking and suggestions in action.
          </p>
        </div>
      ) : (
        <section className="panel" aria-labelledby="next-title">
          <h2 id="next-title">Suggested next</h2>
          <SuggestionList suggestions={suggestions} />
        </section>
      )}

      {due > 0 ? (
        <a className="review-callout" href="#/review">
          <Repeat aria-hidden="true" />
          <span>
            <strong>
              {due} {due === 1 ? 'word is' : 'words are'} ready for review
            </strong>
            <span className="muted"> · about {Math.max(1, Math.round(due / 4))} min</span>
          </span>
          <ArrowRight aria-hidden="true" />
        </a>
      ) : null}

      <section aria-labelledby="lessons-title">
        <div className="section-head">
          <h2 id="lessons-title">Lessons</h2>
          <div className="filter-chips" role="group" aria-label="Show lessons for">
            {AUDIENCE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className="chip-toggle"
                aria-pressed={settings.audience === filter}
                onClick={() => store.updateSettings({ audience: filter })}
              >
                {filter === 'all' ? 'All' : AUDIENCE_LABELS[filter].en}
              </button>
            ))}
          </div>
        </div>
        <ul className="module-grid">
          {visible.map((module) => {
            const summary = summarizeModule(module, progress);
            return (
              <li key={module.id}>
                <a
                  className="module-card"
                  href={routeToHash({ name: 'module', moduleId: module.id })}
                >
                  <span className="module-cover">
                    <Illustration emoji={module.cover} size="lg" />
                  </span>
                  <span className="module-info">
                    <span className="module-title">
                      {module.title}
                      {module.source === 'custom' ? (
                        <span className="chip chip-custom">Teacher-made</span>
                      ) : null}
                    </span>
                    <Ja className="module-title-ja">{module.titleJa}</Ja>
                    <span className="module-summary">{module.summary}</span>
                    <span className="module-meta">
                      <LevelBadge level={module.level} cefrJ={module.cefrJ} />
                      <span className="meta-item">
                        <Clock aria-hidden="true" /> {module.minutes} min
                      </span>
                      {summary.quizBest !== undefined ? (
                        <span
                          className={`meta-item ${summary.passed ? 'status-good' : 'status-warn'}`}
                        >
                          Check: {summary.quizBest}% {summary.passed ? '✓' : ''}
                        </span>
                      ) : null}
                    </span>
                    <AudienceChips audiences={module.audiences} />
                  </span>
                  <ProgressRing percent={summary.percent} label={`${summary.percent}% complete`} />
                </a>
              </li>
            );
          })}
        </ul>
        {visible.length === 0 ? <p className="muted">No lessons for this group yet.</p> : null}
      </section>
    </section>
  );
}
