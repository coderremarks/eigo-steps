import { ArrowRight, Check, CircleCheck, CircleX, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import {
  buildTiles,
  checkBuild,
  checkChoice,
  checkFill,
  praise,
  type CheckResult,
} from '../../../domain/grading';
import type { ItemAnswer } from '../../../domain/progress';
import { BLANK } from '../../../domain/schema';
import { createRng, hashString, shuffle } from '../../../domain/random';
import { optionOrder, taskTags, type Task } from '../../../domain/tasks';
import { Ja, ProgressBar, SpeakButton } from '../../../ui/common';
import { langOf } from '../../../ui/format';
import { Illustration } from '../../../ui/Illustration';
import { useSettings } from '../../../state/context';
import { AudioPanel } from './AudioPanel';
import { ChoiceList } from './ChoiceList';

export type QuestionMode = 'practice' | 'quiz';

export interface QuestionSetResult {
  answers: ItemAnswer[];
  correct: number;
  total: number;
}

type Phase = 'answering' | 'retry' | 'correct' | 'revealed';

type Pending =
  | { type: 'choice'; index: number }
  | { type: 'text'; value: string }
  | { type: 'tiles'; words: string[] }
  | null;

interface Props {
  tasks: readonly Task[];
  mode: QuestionMode;
  seed: number;
  onComplete: (result: QuestionSetResult) => void;
  /** Called as soon as each item is resolved (used by spaced review to save as it goes). */
  onItemResolved?: (task: Task, firstTryCorrect: boolean) => void;
  completeLabel?: string;
}

function correctAnswerText(task: Task): string {
  switch (task.type) {
    case 'mcq':
      return task.question.options[task.question.answer]?.text ?? '';
    case 'listening':
      return task.item.options[task.item.answer]?.text ?? '';
    case 'fill':
      return task.question.sentence.replace(BLANK, task.question.answers[0] ?? '');
    case 'build':
      return task.question.answer;
  }
}

function explanationFor(task: Task): string {
  return task.type === 'listening' ? task.item.explanation : task.question.explanation;
}

/**
 * Runs a list of questions with consistent feedback:
 * practice mode → hint after the first mistake, model answer after the second;
 * quiz mode → one try, then the model answer. Scores count first-try answers.
 */
export function QuestionSet({
  tasks,
  mode,
  seed,
  onComplete,
  onItemResolved,
  completeLabel = 'Finish',
}: Props) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [wrongChoices, setWrongChoices] = useState<number[]>([]);
  const [plays, setPlays] = useState(0);
  const answers = useRef<ItemAnswer[]>([]);
  const firstWrong = useRef<string | undefined>(undefined);
  const nextButton = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const task = tasks[index];
  const resolved = phase === 'correct' || phase === 'revealed';
  const taskSeed = (seed ^ hashString(task?.id ?? '')) >>> 0;

  useEffect(() => {
    if (resolved) nextButton.current?.focus();
  }, [resolved]);

  if (!task) return <p>No questions in this activity yet.</p>;

  const resolve = (correct: boolean) => {
    const firstTry = correct && attempts === 0;
    answers.current = [
      ...answers.current,
      {
        itemId: task.id,
        skill: task.skill,
        tags: taskTags(task),
        firstTryCorrect: firstTry,
        wrongAnswer: firstTry ? undefined : firstWrong.current,
        plays: task.type === 'listening' ? plays : undefined,
      },
    ];
    onItemResolved?.(task, firstTry);
  };

  const describe = (current: Pending): { result: CheckResult; text: string } | null => {
    if (!current) return null;
    switch (task.type) {
      case 'mcq':
      case 'listening': {
        if (current.type !== 'choice') return null;
        const source = task.type === 'mcq' ? task.question : task.item;
        return {
          result: checkChoice(source.answer, current.index, source.optionFeedback),
          text: source.options[current.index]?.text ?? '',
        };
      }
      case 'fill':
        if (current.type !== 'text') return null;
        return { result: checkFill(task.question, current.value), text: current.value };
      case 'build':
        if (current.type !== 'tiles') return null;
        return { result: checkBuild(task.question, current.words), text: current.words.join(' ') };
    }
  };

  const check = () => {
    const graded = describe(pending);
    if (!graded) return;
    if (graded.result.diagnosis === 'empty') {
      setHint(graded.result.hint);
      return;
    }
    const nextAttempts = attempts + 1;
    if (graded.result.correct) {
      resolve(true);
      setAttempts(nextAttempts);
      setPhase('correct');
      setHint('');
      return;
    }
    if (firstWrong.current === undefined) firstWrong.current = graded.text.slice(0, 80);
    if (pending?.type === 'choice') setWrongChoices((list) => [...list, pending.index]);
    setHint(graded.result.hint);
    if (mode === 'practice' && nextAttempts < 2) {
      setAttempts(nextAttempts);
      setPhase('retry');
      if (pending?.type === 'choice') setPending(null);
      feedbackRef.current?.focus();
      return;
    }
    setAttempts(nextAttempts);
    resolve(false);
    setPhase('revealed');
  };

  const next = () => {
    if (index + 1 >= tasks.length) {
      const correct = answers.current.filter((answer) => answer.firstTryCorrect).length;
      onComplete({ answers: answers.current, correct, total: tasks.length });
      return;
    }
    setIndex(index + 1);
    setPhase('answering');
    setAttempts(0);
    setHint('');
    setPending(null);
    setWrongChoices([]);
    setPlays(0);
    firstWrong.current = undefined;
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (resolved) next();
    else check();
  };

  const canCheck =
    pending !== null &&
    !(pending.type === 'text' && pending.value.trim() === '') &&
    !(pending.type === 'tiles' && pending.words.length === 0);
  const cheer = praise(taskSeed);

  return (
    <form className="question-set" onSubmit={onSubmit} noValidate>
      <div className="question-progress">
        <span>
          Question {index + 1} of {tasks.length}
        </span>
        <ProgressBar
          value={((index + (resolved ? 1 : 0)) / tasks.length) * 100}
          label="Questions answered"
        />
      </div>

      <div className="question-card" key={task.id}>
        <TaskView
          task={task}
          seed={taskSeed}
          phase={phase}
          pending={pending}
          wrongChoices={wrongChoices}
          onChange={setPending}
          onPlay={() => setPlays((count) => count + 1)}
          onEnter={check}
        />

        <div className="feedback-area" aria-live="polite" ref={feedbackRef} tabIndex={-1}>
          {phase === 'retry' ? (
            <div className="feedback feedback-retry">
              <Lightbulb aria-hidden="true" />
              <div>
                <p className="feedback-title">Not quite — try again!</p>
                <p>{hint}</p>
              </div>
            </div>
          ) : null}
          {phase === 'answering' && hint ? <p className="feedback feedback-info">{hint}</p> : null}
          {phase === 'correct' ? (
            <div className="feedback feedback-correct">
              <CircleCheck aria-hidden="true" />
              <div>
                <p className="feedback-title">
                  {cheer.en} <Ja>{cheer.ja}</Ja>
                </p>
                <p>{explanationFor(task)}</p>
              </div>
            </div>
          ) : null}
          {phase === 'revealed' ? (
            <div className="feedback feedback-revealed">
              <CircleX aria-hidden="true" />
              <div>
                <p className="feedback-title">
                  The answer is: <strong>{correctAnswerText(task)}</strong>
                  <SpeakButton
                    text={correctAnswerText(task)}
                    label="Listen to the correct answer"
                  />
                </p>
                {hint && mode === 'quiz' ? <p>{hint}</p> : null}
                <p>{explanationFor(task)}</p>
              </div>
            </div>
          ) : null}
        </div>

        {task.type === 'listening' && resolved ? <Transcript task={task} /> : null}
      </div>

      <div className="question-actions">
        {resolved ? (
          <button ref={nextButton} type="submit" className="btn btn-primary">
            {index + 1 >= tasks.length ? completeLabel : 'Next'} <ArrowRight aria-hidden="true" />
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!canCheck}>
            <Check aria-hidden="true" /> Check
          </button>
        )}
      </div>
    </form>
  );
}

function Transcript({ task }: { task: Extract<Task, { type: 'listening' }> }) {
  return (
    <section className="transcript" aria-label="Transcript">
      <h3>Transcript</h3>
      <ul>
        {task.item.script.map((line, index) => (
          <li key={index}>
            {line.speaker ? <span className="speaker">{line.speaker}:</span> : null} {line.text}
            <SpeakButton text={line.text} label={`Listen to line ${index + 1}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface ViewProps {
  task: Task;
  seed: number;
  phase: Phase;
  pending: Pending;
  wrongChoices: number[];
  onChange: (pending: Pending) => void;
  onPlay: () => void;
  onEnter: () => void;
}

function TaskView(props: ViewProps) {
  switch (props.task.type) {
    case 'mcq':
      return <McqView {...props} task={props.task} />;
    case 'listening':
      return <ListeningView {...props} task={props.task} />;
    case 'fill':
      return <FillView {...props} task={props.task} />;
    case 'build':
      return <BuildView {...props} task={props.task} />;
  }
}

function McqView({
  task,
  seed,
  phase,
  pending,
  wrongChoices,
  onChange,
}: ViewProps & { task: Extract<Task, { type: 'mcq' }> }) {
  const q = task.question;
  const order = useMemo(() => optionOrder(q.options, q.shuffle, seed), [q, seed]);
  const resolved = phase === 'correct' || phase === 'revealed';
  return (
    <>
      <div className="prompt">
        {q.picture ? (
          <Illustration emoji={q.picture} size="xl" label={`Picture for: ${q.prompt}`} />
        ) : null}
        <div>
          <p className="prompt-text">{q.prompt}</p>
          <Ja className="prompt-ja">{q.promptJa}</Ja>
        </div>
      </div>
      {task.audio ? (
        <AudioPanel lines={[{ text: task.audio, role: 'A' }]} label="Listen to the word" />
      ) : null}
      <ChoiceList
        name={`q-${task.id}`}
        legend={q.prompt}
        options={q.options}
        order={order}
        selected={pending?.type === 'choice' ? pending.index : null}
        wrong={wrongChoices}
        answer={q.answer}
        resolved={resolved}
        pictureOnly={q.pictureOnly}
        onSelect={(index) => onChange({ type: 'choice', index })}
      />
    </>
  );
}

function ListeningView({
  task,
  seed,
  phase,
  pending,
  wrongChoices,
  onChange,
  onPlay,
}: ViewProps & { task: Extract<Task, { type: 'listening' }> }) {
  const { alwaysShowTranscript } = useSettings();
  const item = task.item;
  const order = useMemo(() => optionOrder(item.options, item.shuffle, seed), [item, seed]);
  const resolved = phase === 'correct' || phase === 'revealed';
  const speakers = useMemo(() => {
    const names = [...new Set(item.script.map((line) => line.speaker || 'A'))];
    return item.script.map((line) => ({
      text: line.text,
      role: names.indexOf(line.speaker || 'A') % 2 === 0 ? ('A' as const) : ('B' as const),
    }));
  }, [item]);
  return (
    <>
      <AudioPanel lines={speakers} onPlay={onPlay} label="Listening audio" />
      {alwaysShowTranscript && !resolved ? (
        <p className="transcript-inline">
          <span className="muted">Transcript: </span>
          {item.script
            .map((line) => `${line.speaker ? `${line.speaker}: ` : ''}${line.text}`)
            .join('  ')}
        </p>
      ) : null}
      <div className="prompt">
        <div>
          <p className="prompt-text">{item.question}</p>
          <Ja className="prompt-ja">{item.questionJa}</Ja>
        </div>
      </div>
      <ChoiceList
        name={`q-${task.id}`}
        legend={item.question}
        options={item.options}
        order={order}
        selected={pending?.type === 'choice' ? pending.index : null}
        wrong={wrongChoices}
        answer={item.answer}
        resolved={resolved}
        pictureOnly={item.pictureOnly}
        onSelect={(index) => onChange({ type: 'choice', index })}
      />
      {!resolved ? <p className="muted small">The transcript appears after you answer.</p> : null}
    </>
  );
}

function FillView({
  task,
  seed,
  phase,
  pending,
  onChange,
  onEnter,
}: ViewProps & { task: Extract<Task, { type: 'fill' }> }) {
  const q = task.question;
  const [before = '', after = ''] = q.sentence.split(BLANK);
  const resolved = phase === 'correct' || phase === 'revealed';
  const value = pending?.type === 'text' ? pending.value : '';
  const choices = useMemo(() => shuffle(q.choices, createRng(seed)), [q, seed]);
  const inputId = `fill-${task.id}`;
  return (
    <>
      <div className="prompt">
        {q.picture ? <Illustration emoji={q.picture} size="lg" label="Picture clue" /> : null}
        <div>
          <p className="prompt-text">Complete the sentence.</p>
          <Ja className="prompt-ja">{q.sentenceJa}</Ja>
        </div>
      </div>
      <p className="fill-sentence">
        {before}
        {q.choices.length > 0 ? (
          <span className={`blank ${value ? 'filled' : ''}`} aria-hidden={value ? undefined : true}>
            {value || '＿＿＿'}
          </span>
        ) : (
          <>
            <label htmlFor={inputId} className="sr-only">
              Missing word
            </label>
            <input
              id={inputId}
              className="blank-input"
              type="text"
              lang="en"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={60}
              value={value}
              disabled={resolved}
              onChange={(event) => onChange({ type: 'text', value: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (!resolved) onEnter();
                }
              }}
            />
          </>
        )}
        {after}
      </p>
      {q.choices.length > 0 ? (
        <fieldset className="word-bank">
          <legend className="sr-only">Choose the missing word</legend>
          {choices.map((choice) => (
            <label key={choice} className={`chip-choice ${value === choice ? 'selected' : ''}`}>
              <input
                type="radio"
                name={`bank-${task.id}`}
                value={choice}
                checked={value === choice}
                disabled={resolved}
                onChange={() => onChange({ type: 'text', value: choice })}
              />
              <span>{choice}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="muted small">Type the missing word, then press Check (or Enter).</p>
      )}
    </>
  );
}

function BuildView({
  task,
  seed,
  phase,
  onChange,
}: ViewProps & { task: Extract<Task, { type: 'build' }> }) {
  const q = task.question;
  const tiles = useMemo(
    () =>
      shuffle(
        buildTiles(q).map((word, id) => ({ id, word })),
        createRng(seed),
      ),
    [q, seed],
  );
  const [chosen, setChosen] = useState<number[]>([]);
  const resolved = phase === 'correct' || phase === 'revealed';
  const update = (ids: number[]) => {
    setChosen(ids);
    onChange({
      type: 'tiles',
      words: ids.map((id) => tiles.find((tile) => tile.id === id)?.word ?? ''),
    });
  };
  return (
    <>
      <div className="prompt">
        {q.picture ? <Illustration emoji={q.picture} size="lg" label="Picture clue" /> : null}
        <div>
          <p className="prompt-text">Build the sentence.</p>
          <p className="build-prompt" lang={langOf(q.prompt)}>
            {q.prompt}
          </p>
        </div>
      </div>
      <div className="build-answer" role="group" aria-label="Your sentence">
        {chosen.length === 0 ? <span className="placeholder">Tap the words in order ↓</span> : null}
        {chosen.map((id) => {
          const word = tiles.find((tile) => tile.id === id)?.word ?? '';
          return (
            <button
              key={id}
              type="button"
              className="tile tile-placed"
              disabled={resolved}
              aria-label={`Remove “${word}”`}
              onClick={() => update(chosen.filter((value) => value !== id))}
            >
              {word}
            </button>
          );
        })}
      </div>
      <div className="tile-bank" role="group" aria-label="Word tiles">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="tile"
            disabled={resolved || chosen.includes(tile.id)}
            aria-label={`Add “${tile.word}”`}
            onClick={() => update([...chosen, tile.id])}
          >
            {tile.word}
          </button>
        ))}
      </div>
      {!resolved && chosen.length > 0 ? (
        <button type="button" className="btn btn-ghost btn-small" onClick={() => update([])}>
          Clear
        </button>
      ) : null}
    </>
  );
}
