import {
  BookOpen,
  ChartColumn,
  GraduationCap,
  Headphones,
  Layers,
  PenLine,
  Repeat,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { navigate } from '../../app/router';
import { useAppState, useStore } from '../../state/context';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { usePageTitle } from '../../ui/format';
import { Illustration } from '../../ui/Illustration';

const FEATURES = [
  {
    icon: Layers,
    title: 'Vocabulary',
    text: 'Illustrated cards with audio and example sentences, picture matching, and Leitner spaced review.',
  },
  {
    icon: PenLine,
    title: 'Grammar',
    text: 'Interactive explanations, multiple choice, fill-in-the-blank and sentence building with targeted feedback.',
  },
  {
    icon: Headphones,
    title: 'Listening',
    text: 'Dialogues with play, replay and slow speed. The transcript appears after answering.',
  },
  {
    icon: BookOpen,
    title: 'Reading',
    text: 'Short, level-appropriate texts with tap-to-see word help and comprehension questions.',
  },
  {
    icon: ChartColumn,
    title: 'Progress',
    text: 'Lesson completion, quiz scores, focus areas to review and transparent next-step suggestions.',
  },
  {
    icon: GraduationCap,
    title: 'Teacher mode',
    text: 'Create lessons, edit vocabulary and questions, preview, print materials and view class insights.',
  },
];

export function LandingPage() {
  usePageTitle('Interactive English for Japanese learners');
  const store = useStore();
  const progress = useAppState((state) => state.progress);
  const returning = useAppState((state) => state.returning);
  const modules = useAppState((state) => state.modules);
  const hasProgress = returning && Object.keys(progress.activities).length > 0;

  return (
    <div className="landing">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-text">
          <p className="eyebrow">CEFR Pre-A1 → A2 · Elementary · Junior high · Adult beginners</p>
          <h1 id="hero-title" tabIndex={-1}>
            English, one step at a time.
            <span className="hero-ja" lang="ja">
              一歩ずつ、英語を。
            </span>
          </h1>
          <p className="lead">
            Eigo Steps is an interactive English platform for Japanese learners: six complete
            lessons that build vocabulary, grammar, listening and reading, with feedback designed
            around the mistakes Japanese speakers actually make — and tools that let teachers
            create, print and track their own lessons.
          </p>
          <div className="hero-actions">
            {hasProgress && !progress.demo ? (
              <ConfirmButton
                className="btn btn-primary btn-large"
                label={
                  <>
                    <Sparkles aria-hidden="true" /> Explore the demo
                  </>
                }
                question="Replace your progress on this device with the demo learner?"
                confirmLabel="Load the demo"
                onConfirm={() => {
                  store.loadDemo();
                  navigate('#/learn');
                }}
              />
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={() => {
                  store.loadDemo();
                  navigate('#/learn');
                }}
              >
                <Sparkles aria-hidden="true" /> Explore the demo
              </button>
            )}
            <a className="btn btn-large" href="#/learn">
              <UserRound aria-hidden="true" />{' '}
              {hasProgress && !progress.demo ? 'Continue learning' : 'Start as a new learner'}
            </a>
            <a className="btn btn-large btn-ghost" href="#/teacher">
              <GraduationCap aria-hidden="true" /> Teacher mode
            </a>
          </div>
          <p className="muted small">
            <ShieldCheck aria-hidden="true" className="inline-icon" /> No registration and no
            personal data: progress is saved only in this browser. The demo uses a synthetic learner
            and a synthetic class.
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          {modules.slice(0, 6).map((module, index) => (
            <span key={module.id} className={`hero-tile tile-${index + 1}`}>
              <Illustration emoji={module.cover} size="lg" />
            </span>
          ))}
        </div>
      </section>

      <section className="feature-grid" aria-labelledby="features-title">
        <h2 id="features-title">What learners and teachers can do</h2>
        <ul>
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="feature">
              <Icon aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title">How every lesson works</h2>
        <ol className="steps">
          <li>
            <strong>Present</strong> new words with pictures and audio.
          </li>
          <li>
            <strong>Notice</strong> the grammar pattern and the typical mistakes.
          </li>
          <li>
            <strong>Practise</strong> with hints first, answers second.
          </li>
          <li>
            <strong>Apply</strong> it in listening and reading.
          </li>
          <li>
            <strong>Check</strong> with a lesson check, then{' '}
            <Repeat aria-hidden="true" className="inline-icon" /> review words on a spaced schedule.
          </li>
        </ol>
        <p>
          <a href="#/about">Read the design rationale and case study →</a>
        </p>
      </section>
    </div>
  );
}
