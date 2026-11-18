import { ArrowLeft, ArrowRight, Eye, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { routeToHash } from '../../app/router';
import { getActivities, type ActivityInfo, type ActivityKind } from '../../domain/activities';
import { completionMessage, scorePercent, starsFor } from '../../domain/grading';
import { freshSeed } from '../../domain/random';
import { SKILL_LABELS, type Module } from '../../domain/schema';
import { tagInfo } from '../../domain/tags';
import { listeningTasks, practiceTasks, quizTasks } from '../../domain/tasks';
import { useModule, useStore } from '../../state/context';
import { Bi, Ja, PurposeNote, SpeakButton, Stars } from '../../ui/common';
import { usePageTitle } from '../../ui/format';
import { GrammarExplain } from './GrammarExplain';
import { Matching } from './Matching';
import { QuestionSet, type QuestionSetResult } from './questions/QuestionSet';
import { ReadingActivity } from './ReadingActivity';
import type { ActivityOutcome } from './types';
import { VocabCards } from './VocabCards';

export function ActivityPage({
  moduleId,
  kind,
  preview,
}: {
  moduleId: string;
  kind: ActivityKind;
  preview: boolean;
}) {
  const module = useModule(moduleId);
  const activities = useMemo(() => (module ? getActivities(module) : []), [module]);
  const index = activities.findIndex((activity) => activity.kind === kind);
  const activity = activities[index];
  usePageTitle(activity && module ? `${activity.title} – ${module.title}` : 'Activity not found');

  if (!module || !activity) {
    return (
      <section className="page narrow">
        <h1 tabIndex={-1}>Activity not found</h1>
        <p>
          This activity does not exist (the lesson may have been deleted).{' '}
          <a href="#/learn">Back to the lessons</a>
        </p>
      </section>
    );
  }
  return (
    <ActivityRunner
      module={module}
      activities={activities}
      index={index}
      activity={activity}
      preview={preview}
    />
  );
}

function ActivityRunner({
  module,
  activities,
  index,
  activity,
  preview,
}: {
  module: Module;
  activities: ActivityInfo[];
  index: number;
  activity: ActivityInfo;
  preview: boolean;
}) {
  const store = useStore();
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<ActivityOutcome | null>(null);
  const seed = useMemo(() => freshSeed() + attempt, [attempt]);
  const next = activities[index + 1];
  const moduleHref = preview ? '#/teacher' : routeToHash({ name: 'module', moduleId: module.id });
  const hrefFor = (target: ActivityInfo) =>
    routeToHash({ name: 'activity', moduleId: module.id, kind: target.kind, preview });

  const finish = (result: ActivityOutcome) => {
    if (!preview) {
      store.recordActivity({
        moduleId: module.id,
        kind: activity.kind,
        score: result.score,
        correct: result.correct,
        total: result.total,
        answers: result.answers,
        learnedVocab: result.learnedVocab,
      });
    }
    setOutcome(result);
  };
  const fromQuestions = (result: QuestionSetResult) =>
    finish({
      score: scorePercent(result.correct, result.total),
      correct: result.correct,
      total: result.total,
      answers: result.answers,
    });

  return (
    <section className="page activity-page" aria-labelledby="activity-title">
      {preview ? (
        <p className="notice notice-preview">
          <Eye aria-hidden="true" /> Teacher preview — answers are not saved.{' '}
          <a href="#/teacher">Back to Teacher mode</a>
        </p>
      ) : null}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <a href={moduleHref}>
          <ArrowLeft aria-hidden="true" /> {preview ? 'Teacher mode' : module.title}
        </a>
      </nav>
      <header className="activity-header">
        <p className="eyebrow">
          {module.title} · Step {index + 1} of {activities.length} ·{' '}
          {SKILL_LABELS[activity.skill].en}
        </p>
        <h1 id="activity-title" tabIndex={-1}>
          {activity.title} <Ja className="title-ja">{activity.titleJa}</Ja>
        </h1>
        <div className="instructions">
          <Bi en={activity.instructions.en} ja={activity.instructions.ja} />
          <SpeakButton text={activity.instructions.en} label="Listen to the instructions" />
        </div>
        <PurposeNote purpose={activity.purpose} principles={activity.principles} />
      </header>

      {outcome ? (
        <Completion
          module={module}
          activity={activity}
          outcome={outcome}
          nextHref={next ? hrefFor(next) : moduleHref}
          nextLabel={
            next ? `Next: ${next.title}` : preview ? 'Back to Teacher mode' : 'Back to the lesson'
          }
          preview={preview}
          onRetry={() => {
            setOutcome(null);
            setAttempt((value) => value + 1);
          }}
        />
      ) : (
        <div className="activity-body" key={attempt}>
          {activity.kind === 'vocab' ? <VocabCards module={module} onComplete={finish} /> : null}
          {activity.kind === 'match' ? (
            <Matching module={module} seed={seed} onComplete={finish} />
          ) : null}
          {activity.kind === 'grammar' && module.grammar ? (
            <GrammarExplain grammar={module.grammar} onComplete={finish} />
          ) : null}
          {activity.kind === 'practice' ? (
            <QuestionSet
              tasks={practiceTasks(module)}
              mode="practice"
              seed={seed}
              onComplete={fromQuestions}
            />
          ) : null}
          {activity.kind === 'listening' ? (
            <QuestionSet
              tasks={listeningTasks(module)}
              mode="practice"
              seed={seed}
              onComplete={fromQuestions}
            />
          ) : null}
          {activity.kind === 'reading' ? (
            <ReadingActivity module={module} seed={seed} onComplete={finish} />
          ) : null}
          {activity.kind === 'quiz' ? (
            <QuizRunner module={module} seed={seed} onComplete={fromQuestions} />
          ) : null}
        </div>
      )}
    </section>
  );
}

function QuizRunner({
  module,
  seed,
  onComplete,
}: {
  module: Module;
  seed: number;
  onComplete: (result: QuestionSetResult) => void;
}) {
  const tasks = useMemo(() => quizTasks(module, seed), [module, seed]);
  return (
    <>
      <p className="notice notice-info">
        Goal: {module.assessment.passMark}% or more. One try per question — no hints.
      </p>
      <QuestionSet
        tasks={tasks}
        mode="quiz"
        seed={seed}
        onComplete={onComplete}
        completeLabel="See my result"
      />
    </>
  );
}

function Completion({
  module,
  activity,
  outcome,
  nextHref,
  nextLabel,
  preview,
  onRetry,
}: {
  module: Module;
  activity: ActivityInfo;
  outcome: ActivityOutcome;
  nextHref: string;
  nextLabel: string;
  preview: boolean;
  onRetry: () => void;
}) {
  const scored = outcome.score !== null;
  const score = outcome.score ?? 100;
  const message = scored
    ? completionMessage(score, module.assessment.passMark)
    : { en: 'Well done! Activity complete.', ja: 'よくできました！' };
  const missedTags = [
    ...new Set(
      outcome.answers.filter((answer) => !answer.firstTryCorrect).flatMap((answer) => answer.tags),
    ),
  ]
    .filter(
      (tag) =>
        tag !== 'vocabulary' && !tag.startsWith('reading-') && !tag.startsWith('listening-detail'),
    )
    .slice(0, 3);
  const passed = activity.kind === 'quiz' ? score >= module.assessment.passMark : null;

  return (
    <div className="completion" role="status" aria-live="polite">
      <Stars count={starsFor(score)} />
      <h2 className="completion-score">{scored ? `${score}%` : 'Complete!'}</h2>
      {scored ? (
        <p>
          {outcome.correct} of {outcome.total} right on the first try
          {outcome.total - outcome.correct > 0
            ? ' — and you saw the answer to the rest.'
            : '. Perfect!'}
        </p>
      ) : null}
      <Bi en={message.en} ja={message.ja} className="completion-message" />
      {passed !== null ? (
        <p className={`badge-status ${passed ? 'status-good' : 'status-warn'}`}>
          {passed ? '✓ Pass mark reached' : `Not yet: the goal is ${module.assessment.passMark}%`}
        </p>
      ) : null}
      {activity.kind === 'vocab' && !preview ? (
        <p>
          These {outcome.learnedVocab?.length ?? 0} words are now in your spaced review. You will
          see them again tomorrow.
        </p>
      ) : null}
      {missedTags.length > 0 ? (
        <div className="practise-next">
          <h3>Look at this again</h3>
          <ul>
            {missedTags.map((tag) => (
              <li key={tag}>
                {tagInfo(tag).label} <Ja>{tagInfo(tag).ja}</Ja>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview ? <p className="muted">Preview mode: this result was not saved.</p> : null}
      <div className="completion-actions">
        <a className="btn btn-primary" href={nextHref}>
          {nextLabel} <ArrowRight aria-hidden="true" />
        </a>
        {activity.scored ? (
          <button type="button" className="btn" onClick={onRetry}>
            <RotateCcw aria-hidden="true" /> Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
