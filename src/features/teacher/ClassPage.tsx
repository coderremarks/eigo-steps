import { ArrowLeft, Download, FlaskConical, Trash2, Upload, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BUILT_IN_MODULES } from '../../content';
import { createDemoClass } from '../../domain/demo';
import { classCsv, parseStudentReport } from '../../domain/exchange';
import {
  classFocusAreas,
  classOverview,
  itemAnalysis,
  learnersToSupport,
  studentRows,
  type StudentReport,
} from '../../domain/report';
import { LIMITS } from '../../domain/schema';
import { useAppState, useModules, useStore, useToday } from '../../state/context';
import { Ja, ProgressBar } from '../../ui/common';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { percent, usePageTitle } from '../../ui/format';
import { downloadFile, readTextFile } from '../../ui/files';
import { Illustration } from '../../ui/Illustration';

type Source = 'demo' | 'imported';

export default function ClassPage() {
  usePageTitle('Class overview');
  const store = useStore();
  const modules = useModules();
  const roster = useAppState((state) => state.roster);
  const today = useToday();
  const [source, setSource] = useState<Source>(roster.length > 0 ? 'imported' : 'demo');
  const [message, setMessage] = useState('');

  const demoClass = useMemo(() => createDemoClass(BUILT_IN_MODULES, store.now()), [store]);
  const reports: readonly StudentReport[] = source === 'demo' ? demoClass : roster;
  const rows = useMemo(() => studentRows(reports, modules), [reports, modules]);
  const stats = useMemo(() => classOverview(rows, today), [rows, today]);
  const focus = useMemo(() => classFocusAreas(reports), [reports]);
  const hardest = useMemo(() => itemAnalysis(reports, modules), [reports, modules]);
  const support = useMemo(() => learnersToSupport(rows), [rows]);

  const importFiles = async (files: FileList) => {
    const added: StudentReport[] = [];
    const problems: string[] = [];
    for (const file of Array.from(files).slice(0, 60)) {
      try {
        const result = parseStudentReport(await readTextFile(file, LIMITS.importBytes));
        if ('error' in result) problems.push(`${file.name}: ${result.error}`);
        else added.push(result.report);
      } catch (error) {
        problems.push(
          `${file.name}: ${error instanceof Error ? error.message : 'could not be read'}`,
        );
      }
    }
    // A newer report from the same learner replaces the older one.
    const key = (report: StudentReport) => `${report.classCode}|${report.nickname}`;
    const merged = new Map(roster.map((report) => [key(report), report]));
    for (const report of added) {
      const existing = merged.get(key(report));
      if (!existing || existing.exportedAt < report.exportedAt) merged.set(key(report), report);
    }
    store.setRoster([...merged.values()]);
    setSource('imported');
    setMessage(
      `Imported ${added.length} report${added.length === 1 ? '' : 's'}.${problems.length > 0 ? ` Skipped: ${problems.join('; ')}` : ''}`,
    );
  };

  return (
    <section className="page" aria-labelledby="class-title">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <a href="#/teacher">
          <ArrowLeft aria-hidden="true" /> Teacher mode
        </a>
      </nav>
      <header className="page-header">
        <h1 id="class-title" tabIndex={-1}>
          Class overview <Ja className="title-ja">クラスの状況</Ja>
        </h1>
        <p className="lead">
          Where is the class strong, and what needs re-teaching? Data comes from learner report
          files your students hand in — computed on this device, with no accounts and no server.
        </p>
        <div className="segmented" role="group" aria-label="Data source">
          <button type="button" aria-pressed={source === 'demo'} onClick={() => setSource('demo')}>
            <FlaskConical aria-hidden="true" /> Demo class (synthetic)
          </button>
          <button
            type="button"
            aria-pressed={source === 'imported'}
            onClick={() => setSource('imported')}
          >
            <Users aria-hidden="true" /> Imported reports ({roster.length})
          </button>
        </div>
        <div className="button-row">
          <label className="btn file-btn">
            <Upload aria-hidden="true" /> Import learner reports
            <input
              type="file"
              accept="application/json,.json"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = event.target.files;
                if (files && files.length > 0)
                  void importFiles(files).finally(() => (event.target.value = ''));
              }}
            />
          </label>
          <button
            type="button"
            className="btn"
            disabled={rows.length === 0}
            onClick={() =>
              downloadFile(
                'eigo-steps-class.csv',
                classCsv(rows, modules),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download aria-hidden="true" /> Class results (.csv)
          </button>
          {roster.length > 0 ? (
            <ConfirmButton
              className="btn btn-danger"
              label={
                <>
                  <Trash2 aria-hidden="true" /> Clear imported
                </>
              }
              question="Remove all imported learner reports from this device?"
              confirmLabel="Remove"
              onConfirm={() => {
                store.setRoster([]);
                setSource('demo');
                setMessage('Imported reports removed.');
              }}
            />
          ) : null}
        </div>
        <p className="muted small" role="status" aria-live="polite">
          {message}
        </p>
        {source === 'demo' ? (
          <p className="notice notice-info">
            Demo data: 24 invented learners in class “1-A”. Their answers were simulated on the real
            lesson items, with harder items for known trouble spots (third-person -s, plural -s,
            articles, irregular past).
          </p>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <p className="panel">
          No reports imported yet. Ask students to open{' '}
          <strong>Progress → Share with your teacher</strong>, download their report, and hand in
          the file.
        </p>
      ) : (
        <>
          <ul className="stat-tiles" aria-label="Class summary">
            <li className="stat">
              <span className="stat-value">{stats.learners}</span>
              <span className="stat-label">learners</span>
            </li>
            <li className="stat">
              <span className="stat-value">{stats.averageCompletion}%</span>
              <span className="stat-label">average activities done</span>
            </li>
            <li className="stat">
              <span className="stat-value">{percent(stats.averageQuiz)}</span>
              <span className="stat-label">average lesson check</span>
            </li>
            <li className="stat">
              <span className="stat-value">{stats.activeThisWeek}</span>
              <span className="stat-label">active in the last 7 days</span>
            </li>
          </ul>

          <div className="two-col">
            <section className="panel" aria-labelledby="class-focus-title">
              <h2 id="class-focus-title">What to re-teach</h2>
              <p className="muted small">
                Class-wide first-try accuracy by focus area, weakest first.
              </p>
              <ul className="focus-list">
                {focus.map((area) => (
                  <li
                    key={area.tag}
                    title={`${Math.round(area.accuracy * 100)}% over ${area.answered} answers`}
                  >
                    <div className="focus-head">
                      <span className="focus-label">
                        {area.label} <Ja>{area.ja}</Ja>
                      </span>
                      <span className="focus-value">{Math.round(area.accuracy * 100)}%</span>
                    </div>
                    <ProgressBar
                      value={area.accuracy * 100}
                      label={`${area.label}: ${Math.round(area.accuracy * 100)}%`}
                      tone={area.accuracy < 0.7 ? 'warning' : 'primary'}
                    />
                    <p className="muted small">
                      {area.learnersBelow} learner{area.learnersBelow === 1 ? '' : 's'} below 70% ·{' '}
                      {area.teacherNote}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel" aria-labelledby="support-title">
              <h2 id="support-title">Learners to check in with</h2>
              {support.length === 0 ? (
                <p className="muted">Everyone is on track.</p>
              ) : (
                <ul className="support-list">
                  {support.map(({ row, reason }) => (
                    <li key={`${row.report.classCode}-${row.report.nickname}`}>
                      <Illustration emoji={row.report.avatar} size="sm" />
                      <span>
                        <strong>{row.report.nickname}</strong>
                        <span className="muted small block">{reason}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="panel" aria-labelledby="items-title">
            <h2 id="items-title">Hardest questions (item analysis)</h2>
            <p className="muted small">
              Facility = share of first-try correct answers. The most common wrong answer usually
              shows the misconception.
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Lesson</th>
                    <th scope="col">Facility</th>
                    <th scope="col">Most common wrong answer</th>
                    <th scope="col">Correct answer</th>
                  </tr>
                </thead>
                <tbody>
                  {hardest.map((item) => (
                    <tr key={`${item.moduleId}:${item.itemId}`}>
                      <th scope="row">{item.prompt}</th>
                      <td>{item.moduleTitle}</td>
                      <td>
                        <div className="cell-bar">
                          <ProgressBar
                            value={item.facility * 100}
                            label={`Facility ${Math.round(item.facility * 100)}%`}
                            tone="warning"
                          />
                          <span>
                            {Math.round(item.facility * 100)}%{' '}
                            <span className="muted small">(n={item.attempts})</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.commonWrong[0]
                          ? `“${item.commonWrong[0].answer}” ×${item.commonWrong[0].count}`
                          : '—'}
                      </td>
                      <td>{item.correctAnswer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" aria-labelledby="matrix-title">
            <h2 id="matrix-title">Lesson completion by learner</h2>
            <div className="table-wrap">
              <table className="data-table matrix">
                <thead>
                  <tr>
                    <th scope="col">Learner</th>
                    {modules.map((module) => (
                      <th key={module.id} scope="col" title={module.title}>
                        <Illustration emoji={module.cover} size="xs" />
                        <span className="sr-only">{module.title}</span>
                        <span className="matrix-head" aria-hidden="true">
                          {module.title.split(' ').slice(0, 2).join(' ')}
                        </span>
                      </th>
                    ))}
                    <th scope="col">Avg check</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.report.classCode}-${row.report.nickname}`}>
                      <th scope="row">
                        <span className="lesson-cell">
                          <Illustration emoji={row.report.avatar} size="xs" />
                          {row.report.nickname}
                        </span>
                      </th>
                      {row.modules.map((module) => (
                        <td
                          key={module.moduleId}
                          className={`matrix-cell ${module.passed ? 'passed' : module.percent === 100 ? 'done' : module.percent > 0 ? 'partial' : 'empty'}`}
                        >
                          {module.percent === 0 ? (
                            <span aria-label="not started">–</span>
                          ) : module.quizBest !== undefined ? (
                            <span>
                              {module.passed ? '✓' : '↻'} {module.quizBest}%
                            </span>
                          ) : (
                            <span>{module.percent}% done</span>
                          )}
                        </td>
                      ))}
                      <td>{percent(row.averageQuiz)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              ✓ = passed the lesson check · ↻ = below the pass mark · % done = activities completed
            </p>
          </section>
        </>
      )}
    </section>
  );
}
