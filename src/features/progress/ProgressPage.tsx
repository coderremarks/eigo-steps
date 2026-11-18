import { CircleAlert, CircleCheck, Download, Flame, Layers, Repeat, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';

import { routeToHash } from '../../app/router';
import {
  findFocusAreas,
  overview,
  scoreHistory,
  suggestNext,
  summarizeModule,
  summarizeSkills,
  trickyWords,
} from '../../domain/analytics';
import { getActivities } from '../../domain/activities';
import { formatShortDate } from '../../domain/dates';
import { fileSlug, studentReportFile } from '../../domain/exchange';
import { toStudentReport } from '../../domain/report';
import { SKILL_LABELS } from '../../domain/schema';
import { useModules, useProgress, useStore, useToday } from '../../state/context';
import { Ja, ProgressBar } from '../../ui/common';
import { percent, usePageTitle } from '../../ui/format';
import { downloadFile } from '../../ui/files';
import { Illustration } from '../../ui/Illustration';
import { SuggestionList } from '../home/SuggestionList';
import { targetHref } from '../home/targets';

export function ProgressPage() {
  usePageTitle('My progress');
  const store = useStore();
  const progress = useProgress();
  const modules = useModules();
  const today = useToday();
  const [classCode, setClassCode] = useState('');

  const stats = useMemo(() => overview(progress, modules, today), [progress, modules, today]);
  const skills = useMemo(() => summarizeSkills(progress), [progress]);
  const focus = useMemo(() => findFocusAreas(progress, modules), [progress, modules]);
  const suggestions = useMemo(
    () => suggestNext(progress, modules, today, 4),
    [progress, modules, today],
  );
  const tricky = useMemo(() => trickyWords(progress), [progress]);
  const history = useMemo(() => scoreHistory(progress, 10).reverse(), [progress]);
  const titles = useMemo(() => new Map(modules.map((module) => [module.id, module])), [modules]);

  const activityTitle = (moduleId: string, kind: string) => {
    const module = titles.get(moduleId);
    const activity = module ? getActivities(module).find((item) => item.kind === kind) : undefined;
    return { lesson: module?.title ?? moduleId, activity: activity?.title ?? kind };
  };

  return (
    <section className="page" aria-labelledby="progress-title">
      <header className="page-header">
        <h1 id="progress-title" tabIndex={-1}>
          My progress <Ja className="title-ja">学習の記録</Ja>
        </h1>
        <p className="muted">{progress.learner.nickname} · saved on this device only</p>
      </header>

      <ul className="stat-tiles" aria-label="Summary">
        <li className="stat">
          <Trophy aria-hidden="true" />
          <span className="stat-value">
            {stats.lessonsCompleted}
            <span className="stat-of">/{modules.length}</span>
          </span>
          <span className="stat-label">lessons completed</span>
        </li>
        <li className="stat">
          <CircleCheck aria-hidden="true" />
          <span className="stat-value">{stats.activitiesCompleted}</span>
          <span className="stat-label">activities done</span>
        </li>
        <li className="stat">
          <Layers aria-hidden="true" />
          <span className="stat-value">{percent(stats.averageQuiz)}</span>
          <span className="stat-label">average lesson check</span>
        </li>
        <li className="stat">
          <Flame aria-hidden="true" />
          <span className="stat-value">{stats.streak}</span>
          <span className="stat-label">day streak ({stats.activeDays} active days)</span>
        </li>
        <li className="stat">
          <Repeat aria-hidden="true" />
          <span className="stat-value">
            {stats.srs.learned}
            <span className="stat-of"> words</span>
          </span>
          <span className="stat-label">
            {stats.srs.mastered} mastered · {stats.srs.due} due today
          </span>
        </li>
      </ul>

      <div className="two-col">
        <section className="panel" aria-labelledby="next-title">
          <h2 id="next-title">Suggested next activities</h2>
          <SuggestionList suggestions={suggestions} />
        </section>

        <section className="panel" aria-labelledby="focus-title">
          <h2 id="focus-title">
            <CircleAlert aria-hidden="true" /> Areas to review
          </h2>
          {focus.length === 0 && tricky.length === 0 ? (
            <p className="muted">
              Nothing below 70% right now. Areas appear here when your recent first-try accuracy on
              a grammar point or skill drops below 70%.
            </p>
          ) : null}
          {focus.length > 0 ? (
            <ul className="focus-list">
              {focus.map((area) => (
                <li key={area.tag}>
                  <div className="focus-head">
                    <span className="focus-label">
                      {area.label} <Ja>{area.ja}</Ja>
                    </span>
                    <span className="focus-value">{Math.round(area.accuracy * 100)}%</span>
                  </div>
                  <ProgressBar
                    value={area.accuracy * 100}
                    label={`${area.label}: ${Math.round(area.accuracy * 100)}% first-try accuracy`}
                    tone="warning"
                  />
                  <p className="muted small">
                    Based on your last {area.answered} answers.{' '}
                    {area.target ? (
                      <a
                        href={targetHref({
                          type: 'activity',
                          moduleId: area.target.moduleId,
                          kind: area.target.kind,
                        })}
                      >
                        Practise it →
                      </a>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          {tricky.length > 0 ? (
            <>
              <h3>Tricky words</h3>
              <ul className="tricky-words">
                {tricky.map((card) => {
                  const word = titles
                    .get(card.moduleId)
                    ?.vocab.find((item) => item.id === card.vocabId);
                  if (!word) return null;
                  return (
                    <li key={`${card.moduleId}/${card.vocabId}`}>
                      <Illustration emoji={word.picture} size="sm" />
                      <span lang="en">{word.word}</span>
                      <span className="muted small">
                        forgotten {card.lapses}× · box {card.box}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <a className="btn btn-small" href="#/review">
                Review words
              </a>
            </>
          ) : null}
        </section>
      </div>

      <section className="panel" aria-labelledby="skills-title">
        <h2 id="skills-title">First-try accuracy by skill</h2>
        <ul className="bar-list">
          {skills.map((skill) => (
            <li
              key={skill.skill}
              title={
                skill.accuracy === null
                  ? 'No answers yet'
                  : `${Math.round(skill.accuracy * 100)}% of ${skill.answered} answers right on the first try`
              }
            >
              <span className="bar-label">
                {SKILL_LABELS[skill.skill].en} <Ja>{SKILL_LABELS[skill.skill].ja}</Ja>
              </span>
              <ProgressBar
                value={(skill.accuracy ?? 0) * 100}
                label={`${SKILL_LABELS[skill.skill].en} accuracy`}
              />
              <span className="bar-value">
                {skill.accuracy === null ? '—' : `${Math.round(skill.accuracy * 100)}%`}
                <span className="muted small"> ({skill.answered})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="lessons-title">
        <h2 id="lessons-title">Lessons</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Lesson</th>
                <th scope="col">Level</th>
                <th scope="col">Activities</th>
                <th scope="col">Best lesson check</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => {
                const summary = summarizeModule(module, progress);
                return (
                  <tr key={module.id}>
                    <th scope="row">
                      <a href={routeToHash({ name: 'module', moduleId: module.id })}>
                        {module.title}
                      </a>
                    </th>
                    <td>{module.level}</td>
                    <td>
                      <div className="cell-bar">
                        <ProgressBar
                          value={summary.percent}
                          label={`${module.title}: ${summary.percent}% complete`}
                          tone={summary.status === 'completed' ? 'success' : 'primary'}
                        />
                        <span>
                          {summary.completed}/{summary.total}
                        </span>
                      </div>
                    </td>
                    <td>
                      {summary.quizBest === undefined
                        ? '—'
                        : `${summary.quizBest}% (goal ${module.assessment.passMark}%)`}
                    </td>
                    <td>
                      {summary.passed ? (
                        <span className="status-good">✓ Passed</span>
                      ) : summary.status === 'not-started' ? (
                        <span className="muted">Not started</span>
                      ) : summary.quizBest !== undefined ? (
                        <span className="status-warn">↻ Below goal</span>
                      ) : (
                        <span>In progress</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="history-title">
        <h2 id="history-title">Recent scores</h2>
        {history.length === 0 ? (
          <p className="muted">
            Scores from practice, listening, reading and lesson checks will appear here.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Lesson</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {history.map((attempt) => {
                  const names = activityTitle(attempt.moduleId, attempt.kind);
                  return (
                    <tr key={`${attempt.key}-${attempt.at}`}>
                      <td>{formatShortDate(attempt.at.slice(0, 10))}</td>
                      <td>{names.lesson}</td>
                      <td>{names.activity}</td>
                      <td>
                        <div className="cell-bar">
                          <ProgressBar
                            value={attempt.score ?? 0}
                            label={`Score ${attempt.score ?? 0}%`}
                          />
                          <span>
                            {attempt.score}% ({attempt.correct}/{attempt.total})
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="share-title">
        <h2 id="share-title">Share with your teacher</h2>
        <p>
          Download a small report file and hand it in (for example through your school’s classroom
          app). It contains your nickname and learning results only — no name, email or account.
        </p>
        <div className="inline-form">
          <label htmlFor="class-code">Class / number (optional)</label>
          <input
            id="class-code"
            type="text"
            maxLength={12}
            placeholder="e.g. 1-A 12"
            value={classCode}
            onChange={(event) => setClassCode(event.target.value)}
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              const report = toStudentReport(progress, store.now(), classCode);
              downloadFile(
                `eigo-steps-report-${fileSlug(progress.learner.nickname)}.json`,
                studentReportFile(report),
                'application/json',
              );
            }}
          >
            <Download aria-hidden="true" /> Download report
          </button>
        </div>
      </section>
    </section>
  );
}
