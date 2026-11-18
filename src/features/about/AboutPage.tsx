import { BookOpen, Brain, Code, Headphones, Lock, PenLine, Users } from 'lucide-react';

import { BUILT_IN_MODULES } from '../../content';
import { AUDIENCE_LABELS } from '../../domain/schema';
import { Ja, LevelBadge } from '../../ui/common';
import { usePageTitle } from '../../ui/format';
import { Illustration } from '../../ui/Illustration';

/** Recruiter- and teacher-facing summary of the project (the full case study is in docs/). */
export default function AboutPage() {
  usePageTitle('About this project');
  return (
    <article className="page about" aria-labelledby="about-title">
      <header className="page-header">
        <p className="eyebrow">Portfolio project · English teaching in Japan</p>
        <h1 id="about-title" tabIndex={-1}>
          About Eigo Steps <Ja className="title-ja">このプロジェクトについて</Ja>
        </h1>
        <p className="lead">
          A working English learning platform designed for Japanese elementary, junior high and
          adult beginner learners (CEFR Pre-A1–A2). It shows how technology can make practice more
          frequent, more personal and more data-informed — without replacing the teacher and without
          collecting children’s personal data.
        </p>
        <div className="button-row">
          <a className="btn btn-primary" href="#/learn">
            Try a lesson
          </a>
          <a className="btn" href="#/teacher">
            Open teacher mode
          </a>
          <a className="btn" href="#/teacher/class">
            See the class dashboard
          </a>
        </div>
      </header>

      <section className="panel">
        <h2>The teaching problem</h2>
        <ul>
          <li>
            Classes of 30–40 students get little individual speaking, listening and feedback time;
            English contact hours are limited, especially in elementary school.
          </li>
          <li>
            Japanese learners make predictable, L1-related errors —{' '}
            <em>“He play tennis”, “I like dog”, “Where is station?”, “It was very enjoy”</em> —
            which need targeted feedback, not just a red ✗.
          </li>
          <li>
            Many learners are anxious about making mistakes in front of classmates. Private,
            low-stakes practice with kind, immediate feedback lowers that barrier.
          </li>
          <li>
            Since the GIGA School programme, students have their own devices — but teachers need
            tools that run in a browser, work with school privacy rules and save preparation time.
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2>Six complete lessons</h2>
        <ul className="about-modules">
          {BUILT_IN_MODULES.map((module) => (
            <li key={module.id}>
              <a href={`#/learn/${module.id}`}>
                <Illustration emoji={module.cover} size="sm" />
                <span>
                  <strong>{module.title}</strong>{' '}
                  <LevelBadge level={module.level} cefrJ={module.cefrJ} />
                  <span className="muted small block">
                    {module.audiences.map((audience) => AUDIENCE_LABELS[audience].en).join(' · ')} ·{' '}
                    {module.topic}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="muted small">
          Every lesson has learning objectives, a target level, student and teacher instructions,
          success criteria, a feedback approach and an assessment strategy (formative + summative).
          Open a lesson and expand “For teachers”.
        </p>
      </section>

      <section className="panel">
        <h2>Learning design — why it works this way</h2>
        <div className="about-grid">
          <div>
            <h3>
              <BookOpen aria-hidden="true" /> Present → practise → apply → check
            </h3>
            <p>
              Each lesson follows the same predictable sequence, so young learners always know what
              comes next and teachers can plan around it.
            </p>
          </div>
          <div>
            <h3>
              <Brain aria-hidden="true" /> Memory that lasts
            </h3>
            <p>
              Words are presented with picture + sound + example (dual coding), recalled immediately
              (retrieval practice) and reviewed on a Leitner spaced schedule.
            </p>
          </div>
          <div>
            <h3>
              <PenLine aria-hidden="true" /> Feedback that teaches
            </h3>
            <p>
              A first mistake gets a hint aimed at the cause (prompt), a second gets the model
              answer and reason. Rule-based diagnosis spots missing -s, wrong past forms and
              word-order problems — no paid AI needed.
            </p>
          </div>
          <div>
            <h3>
              <Headphones aria-hidden="true" /> Listening without anxiety
            </h3>
            <p>
              Learners replay and slow down audio as often as they like; the transcript appears only
              after answering so they really listen, then supports noticing.
            </p>
          </div>
          <div>
            <h3>
              <Users aria-hidden="true" /> Data for teachers
            </h3>
            <p>
              Focus areas, item analysis and “learners to check in with” turn answers into
              re-teaching decisions — from report files, not accounts.
            </p>
          </div>
          <div>
            <h3>
              <Lock aria-hidden="true" /> Privacy by design
            </h3>
            <p>
              No registration, no server, no analytics. Progress stays in the browser; the Content
              Security Policy blocks any connection to other sites. Learners use nicknames.
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>
          <Code aria-hidden="true" /> Engineering
        </h2>
        <ul>
          <li>
            TypeScript (strict) + React, built with Vite; a modular domain layer with no UI code.
          </li>
          <li>
            Every lesson — built-in, teacher-made or imported — is validated with Zod schemas
            (length limits, cross-field checks, unknown keys stripped). Lesson text is always
            rendered as text, never as HTML.
          </li>
          <li>
            Unit and integration tests (Vitest + Testing Library) and browser end-to-end tests
            (Playwright + axe).
          </li>
          <li>
            Accessible: keyboard operable, screen-reader labels, Japanese text marked with
            lang=&quot;ja&quot;, visible focus, reduced motion.
          </li>
          <li>
            Responsive from phones to classroom projectors; printable materials with a print
            stylesheet.
          </li>
          <li>
            Audio uses the device’s built-in speech voices; illustrations are Noto Emoji (SIL OFL
            1.1).
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2>Honest limitations</h2>
        <ul>
          <li>
            Synthetic voices vary by device; a teacher’s own recordings would sound more natural.
          </li>
          <li>
            No speaking or pronunciation assessment yet — the classroom remains the place for
            speaking.
          </li>
          <li>
            Class data travels as files, which is private but less convenient than a school-managed
            server.
          </li>
          <li>
            The effectiveness of the platform has not been measured with real classes yet (see the
            evaluation plan in the case study).
          </li>
        </ul>
        <p>
          The full case study, technical documentation and recruiter guide are in the project’s{' '}
          <code>docs/</code> folder.
        </p>
      </section>
    </article>
  );
}
