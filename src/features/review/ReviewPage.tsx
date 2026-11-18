import { CalendarCheck, Play, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatShortDate } from '../../domain/dates';
import { createRng, freshSeed } from '../../domain/random';
import type { Module, VocabItem } from '../../domain/schema';
import {
  BOX_INTERVAL_DAYS,
  dueCards,
  srsKey,
  summarizeSrs,
  type Box,
  type SrsCard,
} from '../../domain/srs';
import { vocabTask, type Task, type VocabTaskMode } from '../../domain/tasks';
import { useModules, useProgress, useSettings, useStore, useToday } from '../../state/context';
import { Ja } from '../../ui/common';
import { usePageTitle } from '../../ui/format';
import { Illustration } from '../../ui/Illustration';
import { QuestionSet } from '../activities/questions/QuestionSet';

const SESSION_SIZE = 10;
const BOX_LABELS: Record<Box, string> = {
  1: 'New / tricky',
  2: 'Learning',
  3: 'Getting there',
  4: 'Almost there',
  5: 'Mastered',
};

interface ReviewItem {
  card: SrsCard;
  module: Module;
  word: VocabItem;
}

function reviewItems(cards: readonly SrsCard[], modules: readonly Module[]): ReviewItem[] {
  const byId = new Map(modules.map((module) => [module.id, module]));
  return cards.flatMap((card) => {
    const module = byId.get(card.moduleId);
    const word = module?.vocab.find((item) => item.id === card.vocabId);
    return module && word ? [{ card, module, word }] : [];
  });
}

export function ReviewPage() {
  usePageTitle('Spaced review');
  const store = useStore();
  const progress = useProgress();
  const modules = useModules();
  const today = useToday();
  const { japaneseSupport } = useSettings();
  const [session, setSession] = useState<{
    tasks: Task[];
    keys: Map<string, string>;
    seed: number;
  } | null>(null);
  const [finished, setFinished] = useState<{ correct: number; total: number } | null>(null);

  const cards = useMemo(() => Object.values(progress.srs), [progress.srs]);
  const summary = useMemo(() => summarizeSrs(cards, today), [cards, today]);
  const due = useMemo(
    () => reviewItems(dueCards(cards, today, SESSION_SIZE), modules),
    [cards, today, modules],
  );

  const start = () => {
    const seed = freshSeed();
    const rng = createRng(seed);
    const modes: VocabTaskMode[] = japaneseSupport
      ? ['picture-to-word', 'audio-to-picture', 'meaning-to-word']
      : ['picture-to-word', 'audio-to-picture'];
    const keys = new Map<string, string>();
    const tasks = due.map((item, index) => {
      const task = vocabTask(
        item.word,
        item.module.vocab,
        modes[index % modes.length] ?? 'picture-to-word',
        rng,
      );
      const id = `${item.module.id}--${item.word.id}`;
      keys.set(id, srsKey(item.module.id, item.word.id));
      const renamed: Task = { ...task, id };
      return renamed;
    });
    setFinished(null);
    setSession({ tasks, keys, seed });
  };

  if (session) {
    return (
      <section className="page narrow" aria-labelledby="review-title">
        <h1 id="review-title" tabIndex={-1}>
          Spaced review <Ja className="title-ja">復習</Ja>
        </h1>
        <QuestionSet
          tasks={session.tasks}
          mode="quiz"
          seed={session.seed}
          completeLabel="Finish review"
          onItemResolved={(task, correct) => {
            const key = session.keys.get(task.id);
            if (key) store.recordReview(key, correct);
          }}
          onComplete={(result) => {
            setSession(null);
            setFinished({ correct: result.correct, total: result.total });
          }}
        />
      </section>
    );
  }

  return (
    <section className="page" aria-labelledby="review-title">
      <header className="page-header">
        <h1 id="review-title" tabIndex={-1}>
          Spaced review <Ja className="title-ja">復習</Ja>
        </h1>
        <p className="lead">
          Words come back just before you would forget them. Each correct answer moves a word to the
          next box and the gap gets longer; a mistake sends it back to box 1.
        </p>
      </header>

      {finished ? (
        <div className="completion" role="status">
          <h2>
            Review done: {finished.correct} of {finished.total} remembered
          </h2>
          <p>
            {finished.correct === finished.total
              ? 'Every word moved up a box. See you next time!'
              : 'Missed words went back to box 1, so they will come back soon.'}
          </p>
        </div>
      ) : null}

      <section className="panel" aria-labelledby="boxes-title">
        <h2 id="boxes-title">Your word boxes</h2>
        <ol className="leitner">
          {([1, 2, 3, 4, 5] as Box[]).map((box) => (
            <li key={box} className={`leitner-box box-${box}`}>
              <span className="leitner-count">{summary.byBox[box - 1]}</span>
              <span className="leitner-label">
                Box {box}: {BOX_LABELS[box]}
              </span>
              <span className="muted small">
                {box === 1
                  ? 'every day'
                  : box === 5
                    ? 'every 2–4 weeks'
                    : `after ${BOX_INTERVAL_DAYS[box]} day${BOX_INTERVAL_DAYS[box] === 1 ? '' : 's'}`}
              </span>
            </li>
          ))}
        </ol>
        <p className="muted">
          {summary.learned} words learned · {summary.mastered} mastered
          {summary.nextDue ? ` · next review due ${formatShortDate(summary.nextDue)}` : ''}
        </p>
      </section>

      {due.length > 0 ? (
        <section className="panel review-start" aria-labelledby="due-title">
          <h2 id="due-title">
            <Repeat aria-hidden="true" /> {summary.due} {summary.due === 1 ? 'word' : 'words'} to
            review today
          </h2>
          <ul className="due-words" aria-label="Words in this review">
            {due.map((item) => (
              <li key={srsKey(item.module.id, item.word.id)} title={item.word.word}>
                <Illustration emoji={item.word.picture} size="sm" label={item.word.word} />
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary btn-large" onClick={start}>
            <Play aria-hidden="true" /> Start review ({due.length})
          </button>
        </section>
      ) : (
        <section className="panel" aria-labelledby="none-title">
          <h2 id="none-title">
            <CalendarCheck aria-hidden="true" />{' '}
            {summary.learned === 0 ? 'No words yet' : 'All caught up!'}
          </h2>
          <p>
            {summary.learned === 0
              ? 'Finish “Learn the words” in any lesson and those words will appear here for review.'
              : 'Nothing is due today. Come back tomorrow — short, regular reviews work best.'}
          </p>
          <a className="btn" href="#/learn">
            Go to the lessons
          </a>
        </section>
      )}
    </section>
  );
}
