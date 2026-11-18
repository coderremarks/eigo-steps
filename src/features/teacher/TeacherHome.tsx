import { Copy, Eye, Pencil, Plus, Printer, Trash2, Upload, Users } from 'lucide-react';
import { useState } from 'react';

import { routeToHash } from '../../app/router';
import { getActivities } from '../../domain/activities';
import { parseLessonFile } from '../../domain/exchange';
import { LIMITS } from '../../domain/schema';
import { useModules, useStore } from '../../state/context';
import { Ja, LevelBadge } from '../../ui/common';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { usePageTitle } from '../../ui/format';
import { readTextFile } from '../../ui/files';
import { Illustration } from '../../ui/Illustration';

export default function TeacherHome() {
  usePageTitle('Teacher mode');
  const store = useStore();
  const modules = useModules();
  const [message, setMessage] = useState<{ tone: 'info' | 'warning'; text: string } | null>(null);

  const importFile = async (file: File) => {
    try {
      const text = await readTextFile(file, LIMITS.importBytes);
      const result = parseLessonFile(text, new Set(modules.map((module) => module.id)));
      const added = store.addLessons(result.lessons);
      const parts = [];
      if (added > 0) parts.push(`Imported ${added} lesson${added === 1 ? '' : 's'}.`);
      if (result.errors.length > 0) parts.push(`Skipped: ${result.errors.join(' ')}`);
      setMessage({ tone: result.errors.length > 0 ? 'warning' : 'info', text: parts.join(' ') });
    } catch (error) {
      setMessage({
        tone: 'warning',
        text: error instanceof Error ? error.message : 'Could not read the file.',
      });
    }
  };

  return (
    <section className="page" aria-labelledby="teacher-title">
      <header className="page-header">
        <h1 id="teacher-title" tabIndex={-1}>
          Teacher mode <Ja className="title-ja">先生用ページ</Ja>
        </h1>
        <p className="lead">
          Create and edit lessons, preview them exactly as students see them, print materials, and
          see where your class needs help. Lessons you create are saved in this browser; share them
          as a lesson file.
        </p>
        <div className="button-row">
          <a className="btn btn-primary" href="#/teacher/new">
            <Plus aria-hidden="true" /> Create a lesson
          </a>
          <a className="btn" href="#/teacher/class">
            <Users aria-hidden="true" /> Class overview
          </a>
          <label className="btn file-btn">
            <Upload aria-hidden="true" /> Import lesson file
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importFile(file);
              }}
            />
          </label>
        </div>
        {message ? (
          <p className={`notice notice-${message.tone}`} role="status">
            {message.text}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="library-title">
        <h2 id="library-title">Lesson library</h2>
        <div className="table-wrap">
          <table className="data-table lesson-table">
            <thead>
              <tr>
                <th scope="col">Lesson</th>
                <th scope="col">Level</th>
                <th scope="col">Content</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => {
                const first = getActivities(module)[0];
                return (
                  <tr key={module.id}>
                    <th scope="row">
                      <span className="lesson-cell">
                        <Illustration emoji={module.cover} size="sm" />
                        <span>
                          {module.title}
                          <span className="muted small block">
                            {module.source === 'custom' ? 'Teacher-made' : 'Built-in'} ·{' '}
                            {module.minutes} min
                          </span>
                        </span>
                      </span>
                    </th>
                    <td>
                      <LevelBadge level={module.level} cefrJ={module.cefrJ} />
                    </td>
                    <td className="small">
                      {module.vocab.length} words · {module.practice.length} questions ·{' '}
                      {module.listening.length} listening ·{' '}
                      {module.reading ? 'reading' : 'no reading'}
                    </td>
                    <td>
                      <div className="action-row">
                        {first ? (
                          <a
                            className="btn btn-small"
                            href={routeToHash({
                              name: 'activity',
                              moduleId: module.id,
                              kind: first.kind,
                              preview: true,
                            })}
                          >
                            <Eye aria-hidden="true" /> Preview
                            <span className="sr-only"> {module.title}</span>
                          </a>
                        ) : null}
                        {module.source === 'custom' ? (
                          <a
                            className="btn btn-small"
                            href={routeToHash({
                              name: 'teacher-edit',
                              moduleId: module.id,
                              duplicate: false,
                            })}
                          >
                            <Pencil aria-hidden="true" /> Edit
                            <span className="sr-only"> {module.title}</span>
                          </a>
                        ) : (
                          <a
                            className="btn btn-small"
                            href={routeToHash({
                              name: 'teacher-edit',
                              moduleId: module.id,
                              duplicate: true,
                            })}
                          >
                            <Copy aria-hidden="true" /> Duplicate &amp; edit
                            <span className="sr-only"> {module.title}</span>
                          </a>
                        )}
                        <a
                          className="btn btn-small"
                          href={routeToHash({ name: 'teacher-export', moduleId: module.id })}
                        >
                          <Printer aria-hidden="true" /> Export
                          <span className="sr-only"> {module.title}</span>
                        </a>
                        {module.source === 'custom' ? (
                          <ConfirmButton
                            className="btn btn-small btn-danger"
                            label={
                              <>
                                <Trash2 aria-hidden="true" /> Delete
                                <span className="sr-only"> {module.title}</span>
                              </>
                            }
                            question={`Delete “${module.title}” and its progress on this device?`}
                            confirmLabel="Delete"
                            onConfirm={() => {
                              store.deleteLesson(module.id);
                              setMessage({ tone: 'info', text: `Deleted “${module.title}”.` });
                            }}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="guide-title">
        <h2 id="guide-title">Quick guide</h2>
        <ol>
          <li>
            <strong>Create a lesson:</strong> add 4+ words, a grammar point, questions, a listening
            script and a short reading. Activities are built automatically in the research-informed
            order.
          </li>
          <li>
            <strong>Preview</strong> any activity as a student (results are not saved in preview).
          </li>
          <li>
            <strong>Export</strong> printable flashcards, a worksheet with answer key and a one-page
            lesson plan, or a lesson file to share with colleagues.
          </li>
          <li>
            <strong>Class overview:</strong> students download a report from their Progress page and
            hand it in; import the files to see class-wide focus areas and the hardest questions. No
            accounts or personal data needed.
          </li>
        </ol>
      </section>
    </section>
  );
}
