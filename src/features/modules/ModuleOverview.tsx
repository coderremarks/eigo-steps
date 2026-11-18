import { ArrowLeft, CircleCheck, Clock, GraduationCap, Play, Printer, Target } from 'lucide-react';
import { useMemo } from 'react';

import { routeToHash } from '../../app/router';
import { summarizeModule } from '../../domain/analytics';
import { SKILL_LABELS } from '../../domain/schema';
import { useModule, useProgress, useSettings } from '../../state/context';
import { AudienceChips, Bi, Ja, LevelBadge, ProgressBar } from '../../ui/common';
import { usePageTitle } from '../../ui/format';
import { Illustration } from '../../ui/Illustration';

export function ModuleOverview({ moduleId }: { moduleId: string }) {
  const module = useModule(moduleId);
  const progress = useProgress();
  const { teachingNotes } = useSettings();
  usePageTitle(module?.title ?? 'Lesson not found');
  const summary = useMemo(
    () => (module ? summarizeModule(module, progress) : null),
    [module, progress],
  );

  if (!module || !summary) {
    return (
      <section className="page narrow">
        <h1 tabIndex={-1}>Lesson not found</h1>
        <p>
          <a href="#/learn">Back to the lessons</a>
        </p>
      </section>
    );
  }

  const start = summary.next ?? summary.activities[0]?.info;
  const startHref = start
    ? routeToHash({ name: 'activity', moduleId: module.id, kind: start.kind, preview: false })
    : '#/learn';

  return (
    <section className="page module-page" aria-labelledby="module-title">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <a href="#/learn">
          <ArrowLeft aria-hidden="true" /> All lessons
        </a>
      </nav>

      <header className="module-hero">
        <Illustration emoji={module.cover} size="xl" />
        <div>
          <h1 id="module-title" tabIndex={-1}>
            {module.title} <Ja className="title-ja">{module.titleJa}</Ja>
          </h1>
          <p className="lead">{module.summary}</p>
          <div className="module-meta">
            <LevelBadge level={module.level} cefrJ={module.cefrJ} />
            <span className="meta-item">
              <Clock aria-hidden="true" /> {module.minutes} min
            </span>
            <span className="meta-item">{module.topic}</span>
          </div>
          <AudienceChips audiences={module.audiences} />
          <div className="module-progress">
            <ProgressBar
              value={summary.percent}
              label={`${summary.percent}% of activities complete`}
              tone={summary.status === 'completed' ? 'success' : 'primary'}
            />
            <span>
              {summary.completed} of {summary.total} activities
              {summary.quizBest !== undefined ? ` · best lesson check ${summary.quizBest}%` : ''}
            </span>
          </div>
          <div className="hero-actions">
            <a className="btn btn-primary btn-large" href={startHref}>
              <Play aria-hidden="true" />
              {summary.status === 'not-started'
                ? 'Start the lesson'
                : summary.status === 'completed'
                  ? 'Practise again'
                  : `Continue: ${start?.title ?? ''}`}
            </a>
          </div>
        </div>
      </header>

      <div className="module-columns">
        <section className="panel" aria-labelledby="objectives-title">
          <h2 id="objectives-title">
            <Target aria-hidden="true" /> In this lesson you will…
          </h2>
          <ul className="check-list">
            {module.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
          <h3>How you’ll know you did it (success criteria)</h3>
          <ul className="check-list">
            {module.successCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
          <h3>Instructions</h3>
          <Bi en={module.studentInstructions.en} ja={module.studentInstructions.ja} />
        </section>

        <section className="panel" aria-labelledby="activities-title">
          <h2 id="activities-title">Activities</h2>
          <ol className="activity-list">
            {summary.activities.map(({ info, completed, bestScore }) => (
              <li key={info.kind} className={completed ? 'done' : ''}>
                <a
                  href={routeToHash({
                    name: 'activity',
                    moduleId: module.id,
                    kind: info.kind,
                    preview: false,
                  })}
                >
                  <span className="activity-status" aria-hidden="true">
                    {completed ? <CircleCheck /> : <span className="dot" />}
                  </span>
                  <span className="activity-name">
                    {info.title}
                    <span className="muted small">
                      {' '}
                      · {SKILL_LABELS[info.skill].en} · ~{info.minutes} min
                    </span>
                  </span>
                  <span className="activity-score">
                    {completed ? (bestScore !== undefined ? `${bestScore}%` : 'Done') : 'Start'}
                    <span className="sr-only">{completed ? ' (completed)' : ' (not started)'}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {teachingNotes ? <TeacherPanel moduleId={module.id} /> : null}
    </section>
  );
}

function TeacherPanel({ moduleId }: { moduleId: string }) {
  const module = useModule(moduleId);
  if (!module) return null;
  const t = module.teacherInstructions;
  return (
    <details className="panel teacher-panel">
      <summary>
        <GraduationCap aria-hidden="true" /> For teachers: lesson plan, feedback and assessment
      </summary>
      <div className="teacher-grid">
        <section>
          <h3>Overview</h3>
          <p>{t.overview}</p>
          <h3>Teaching steps</h3>
          <ol>
            {t.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <section>
          {t.differentiation.length > 0 ? (
            <>
              <h3>Differentiation</h3>
              <ul>
                {t.differentiation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {t.commonErrors.length > 0 ? (
            <>
              <h3>Common errors to listen for</h3>
              <ul>
                {t.commonErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          <h3>Feedback</h3>
          <p>{module.feedback}</p>
          <h3>Assessment</h3>
          <p>
            <strong>Formative:</strong> {module.assessment.formative}
          </p>
          <p>
            <strong>Summative:</strong> {module.assessment.summative} (pass mark{' '}
            {module.assessment.passMark}%)
          </p>
          <p>
            <a
              className="btn btn-small"
              href={routeToHash({ name: 'teacher-export', moduleId: module.id })}
            >
              <Printer aria-hidden="true" /> Print materials for this lesson
            </a>
          </p>
        </section>
      </div>
    </details>
  );
}
