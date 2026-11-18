import { ArrowDown, ArrowLeft, ArrowUp, Eye, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { navigate, routeToHash } from '../../app/router';
import { getActivities } from '../../domain/activities';
import {
  AUDIENCE_LABELS,
  AUDIENCES,
  CEFR_LEVELS,
  PARTS_OF_SPEECH,
  type Audience,
} from '../../domain/schema';
import { TAGS } from '../../domain/tags';
import { uniqueId } from '../../domain/text';
import { useModules, useStore } from '../../state/context';
import { usePageTitle } from '../../ui/format';
import { Illustration } from '../../ui/Illustration';
import { ILLUSTRATION_LIBRARY } from '../../ui/illustrations';
import {
  draftToInput,
  emptyDraft,
  emptyListening,
  emptyMcq,
  emptyQuestion,
  emptyVocab,
  moduleToDraft,
  sampleDraft,
  type Draft,
  type ListeningDraft,
  type McqDraft,
  type OptionDraft,
  type QuestionDraft,
  type VocabDraft,
} from './draft';

// ---------------------------------------------------------------------------------------------
// Small form building blocks
// ---------------------------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  hint,
  multiline = false,
  rows = 3,
  lang,
  required = false,
  maxLength = 1600,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  lang?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? (
          <span className="required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={rows}
          lang={lang}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-required={required || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          lang={lang}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-required={required || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PictureField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="field picture-field">
      <label htmlFor={id}>{label}</label>
      <div className="picture-input">
        <span className="picture-preview" aria-hidden="true">
          {value ? <Illustration emoji={value} size="sm" /> : '—'}
        </span>
        <input
          id={id}
          type="text"
          value={value}
          maxLength={32}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <button
          type="button"
          className="btn btn-small"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          Choose
        </button>
      </div>
      <p id={`${id}-hint`} className="field-hint">
        Type or paste any emoji, or choose from the illustration library.
      </p>
      {open ? (
        <div className="picker-grid" role="group" aria-label="Illustration library">
          {ILLUSTRATION_LIBRARY.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="picker-item"
              aria-label={`Use ${emoji}`}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              <Illustration emoji={emoji} size="sm" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
  open = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="editor-section" open={open}>
      <summary>
        <h2>{title}</h2>
      </summary>
      {description ? <p className="muted">{description}</p> : null}
      {children}
    </details>
  );
}

function ItemToolbar({
  index,
  count,
  label,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  label: string;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="item-toolbar">
      <span className="item-label">{label}</span>
      <button
        type="button"
        className="icon-btn"
        disabled={index === 0}
        aria-label={`Move ${label} up`}
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-btn"
        disabled={index === count - 1}
        aria-label={`Move ${label} down`}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-btn danger"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  );
}

function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

interface ChoiceDraft {
  options: OptionDraft[];
  answer: number;
  optionFeedback: string[];
  shuffle: boolean;
  pictureOnly: boolean;
}

function OptionsEditor<T extends ChoiceDraft>({
  name,
  value,
  onChange,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
}) {
  const { options, answer, optionFeedback } = value;
  const setOption = (index: number, patch: Partial<OptionDraft>) =>
    onChange({
      ...value,
      options: options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    });
  return (
    <fieldset className="options-editor">
      <legend>Options (select the correct one)</legend>
      {options.map((option, index) => (
        <div key={index} className="option-row">
          <input
            type="radio"
            name={name}
            checked={answer === index}
            aria-label={`Option ${index + 1} is correct`}
            onChange={() => onChange({ ...value, answer: index })}
          />
          <input
            type="text"
            value={option.text}
            maxLength={220}
            aria-label={`Option ${index + 1}`}
            onChange={(event) => setOption(index, { text: event.target.value })}
          />
          <input
            type="text"
            className="option-picture"
            value={option.picture}
            maxLength={32}
            placeholder="🖼"
            aria-label={`Picture for option ${index + 1} (optional emoji)`}
            onChange={(event) => setOption(index, { picture: event.target.value })}
          />
          <input
            type="text"
            value={optionFeedback[index] ?? ''}
            maxLength={220}
            placeholder={answer === index ? '(correct answer)' : 'Feedback if chosen (optional)'}
            aria-label={`Feedback for option ${index + 1}`}
            disabled={answer === index}
            onChange={(event) =>
              onChange({
                ...value,
                optionFeedback: options.map((_, i) =>
                  i === index ? event.target.value : (optionFeedback[i] ?? ''),
                ),
              })
            }
          />
          {options.length > 2 ? (
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove option ${index + 1}`}
              onClick={() =>
                onChange({
                  ...value,
                  options: options.filter((_, i) => i !== index),
                  optionFeedback: optionFeedback.filter((_, i) => i !== index),
                  answer: answer === index ? 0 : answer > index ? answer - 1 : answer,
                })
              }
            >
              <Trash2 aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ))}
      {options.length < 5 ? (
        <button
          type="button"
          className="btn btn-small"
          onClick={() =>
            onChange({
              ...value,
              options: [...options, { text: '', picture: '' }],
              optionFeedback: [...optionFeedback, ''],
            })
          }
        >
          <Plus aria-hidden="true" /> Add option
        </button>
      ) : null}
      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={!value.shuffle}
            onChange={(event) => onChange({ ...value, shuffle: !event.target.checked })}
          />{' '}
          Keep this order (e.g. True/False)
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.pictureOnly}
            onChange={(event) => onChange({ ...value, pictureOnly: event.target.checked })}
          />{' '}
          Show pictures only (young learners)
        </label>
      </div>
    </fieldset>
  );
}

const TAG_HINT = `Focus tags drive "areas to review". Comma-separated, e.g. ${Object.keys(TAGS).slice(0, 4).join(', ')}.`;

function McqFields({
  question,
  onChange,
  label,
}: {
  question: McqDraft;
  onChange: (q: McqDraft) => void;
  label: string;
}) {
  return (
    <>
      <Field
        label={`${label}: question`}
        value={question.prompt}
        onChange={(prompt) => onChange({ ...question, prompt })}
        required
      />
      <Field
        label="Question in Japanese (optional)"
        value={question.promptJa}
        lang="ja"
        onChange={(promptJa) => onChange({ ...question, promptJa })}
      />
      <PictureField
        label="Picture (optional)"
        value={question.picture}
        onChange={(picture) => onChange({ ...question, picture })}
      />
      <OptionsEditor name={`answer-${question.key}`} value={question} onChange={onChange} />
      <Field
        label="Explanation (shown after answering)"
        value={question.explanation}
        onChange={(explanation) => onChange({ ...question, explanation })}
        required
      />
      <Field
        label="Focus tags"
        value={question.tags}
        hint={TAG_HINT}
        onChange={(tags) => onChange({ ...question, tags })}
      />
    </>
  );
}

function QuestionFields({
  question,
  onChange,
  label,
}: {
  question: QuestionDraft;
  onChange: (q: QuestionDraft) => void;
  label: string;
}) {
  switch (question.kind) {
    case 'mcq':
      return <McqFields question={question} onChange={onChange} label={label} />;
    case 'fill':
      return (
        <>
          <Field
            label={`${label}: sentence with ___`}
            value={question.sentence}
            hint="Write ___ (three underscores) where the answer goes, e.g. “He ___ tennis.”"
            onChange={(sentence) => onChange({ ...question, sentence })}
            required
          />
          <Field
            label="Japanese meaning (optional)"
            value={question.sentenceJa}
            lang="ja"
            onChange={(sentenceJa) => onChange({ ...question, sentenceJa })}
          />
          <Field
            label="Correct answer(s)"
            value={question.answers}
            hint="Comma-separated if more than one answer is correct."
            onChange={(answers) => onChange({ ...question, answers })}
            required
          />
          <Field
            label="Word bank (optional)"
            value={question.choices}
            hint="Comma-separated choices including the answer. Leave empty to make learners type."
            onChange={(choices) => onChange({ ...question, choices })}
          />
          <PictureField
            label="Picture clue (optional)"
            value={question.picture}
            onChange={(picture) => onChange({ ...question, picture })}
          />
          <Field
            label="Hint after a first mistake (optional)"
            value={question.hint}
            onChange={(hint) => onChange({ ...question, hint })}
          />
          <Field
            label="Common wrong answers (optional, one per line: wrong answer | feedback)"
            value={question.commonErrors}
            multiline
            rows={2}
            hint="Without this, the app still detects a missing -s, wrong past forms and spelling slips automatically."
            onChange={(commonErrors) => onChange({ ...question, commonErrors })}
          />
          <Field
            label="Explanation"
            value={question.explanation}
            onChange={(explanation) => onChange({ ...question, explanation })}
            required
          />
          <Field
            label="Focus tags"
            value={question.tags}
            hint={TAG_HINT}
            onChange={(tags) => onChange({ ...question, tags })}
          />
        </>
      );
    case 'build':
      return (
        <>
          <Field
            label={`${label}: prompt (e.g. the Japanese meaning)`}
            value={question.prompt}
            onChange={(prompt) => onChange({ ...question, prompt })}
            required
          />
          <PictureField
            label="Picture (optional)"
            value={question.picture}
            onChange={(picture) => onChange({ ...question, picture })}
          />
          <Field
            label="Answer sentence"
            value={question.answer}
            hint="Learners rebuild this sentence from word tiles (2–14 words)."
            onChange={(answer) => onChange({ ...question, answer })}
            required
          />
          <Field
            label="Other correct orders (optional, one per line)"
            value={question.alternatives}
            multiline
            rows={2}
            onChange={(alternatives) => onChange({ ...question, alternatives })}
          />
          <Field
            label="Extra wrong tiles (optional)"
            value={question.distractors}
            hint="Comma-separated, e.g. “play, is”."
            onChange={(distractors) => onChange({ ...question, distractors })}
          />
          <Field
            label="Explanation"
            value={question.explanation}
            onChange={(explanation) => onChange({ ...question, explanation })}
            required
          />
          <Field
            label="Focus tags"
            value={question.tags}
            hint={TAG_HINT}
            onChange={(tags) => onChange({ ...question, tags })}
          />
        </>
      );
  }
}

const KIND_LABELS: Record<QuestionDraft['kind'], string> = {
  mcq: 'Multiple choice',
  fill: 'Fill in the blank',
  build: 'Sentence building',
};

// ---------------------------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------------------------

export default function LessonEditor({
  moduleId,
  duplicate = false,
}: {
  moduleId?: string;
  duplicate?: boolean;
}) {
  const store = useStore();
  const modules = useModules();
  const source = moduleId ? modules.find((module) => module.id === moduleId) : undefined;
  const [draft, setDraft] = useState<Draft>(() => {
    if (!source) return emptyDraft();
    if (duplicate || source.source === 'built-in') {
      return moduleToDraft(
        source,
        uniqueId(`${source.id}-copy`, new Set(modules.map((module) => module.id))),
      );
    }
    return moduleToDraft(source);
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  usePageTitle(draft.isNew ? 'Create a lesson' : `Edit: ${draft.title}`);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const activityPreview = useMemo(() => {
    const taken = new Set(modules.map((module) => module.id));
    if (!draft.isNew) taken.delete(draft.id);
    return draftToInput(draft, taken);
  }, [draft, modules]);

  if (moduleId && !source) {
    return (
      <section className="page narrow">
        <h1 tabIndex={-1}>Lesson not found</h1>
        <p>
          <a href="#/teacher">Back to Teacher mode</a>
        </p>
      </section>
    );
  }

  const save = (thenPreview: boolean) => {
    const result = store.saveLesson(activityPreview);
    if (!result.ok) {
      setErrors(result.errors);
      setStatus('');
      window.setTimeout(() => errorRef.current?.focus(), 0);
      return;
    }
    setErrors([]);
    setDraft((current) => ({ ...current, id: result.lesson.id, isNew: false }));
    if (thenPreview) {
      const first = getActivities(result.lesson)[0];
      if (first)
        navigate(
          routeToHash({
            name: 'activity',
            moduleId: result.lesson.id,
            kind: first.kind,
            preview: true,
          }),
        );
      return;
    }
    setStatus(`Saved “${result.lesson.title}” at ${new Date().toLocaleTimeString()}.`);
  };

  const setVocab = (index: number, item: VocabDraft) =>
    update(
      'vocab',
      draft.vocab.map((value, i) => (i === index ? item : value)),
    );
  const setQuestion = (index: number, question: QuestionDraft) =>
    update(
      'practice',
      draft.practice.map((value, i) => (i === index ? question : value)),
    );
  const setListening = (index: number, item: ListeningDraft) =>
    update(
      'listening',
      draft.listening.map((value, i) => (i === index ? item : value)),
    );
  const setReadingQuestion = (index: number, question: McqDraft) =>
    update(
      'readingQuestions',
      draft.readingQuestions.map((value, i) => (i === index ? question : value)),
    );

  return (
    <section className="page editor-page" aria-labelledby="editor-title">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <a href="#/teacher">
          <ArrowLeft aria-hidden="true" /> Teacher mode
        </a>
      </nav>
      <header className="page-header">
        <h1 id="editor-title" tabIndex={-1}>
          {draft.isNew
            ? source
              ? `Duplicate “${source.title}”`
              : 'Create a lesson'
            : `Edit “${draft.title}”`}
        </h1>
        <p className="muted">
          Fields marked * are required. Activities are created automatically from what you add:
          words → cards and matching; grammar → explanation; questions → practice; listening scripts
          → listening; text → reading; and a lesson check from all of them.
        </p>
        {draft.isNew && !source ? (
          <button type="button" className="btn btn-small" onClick={() => setDraft(sampleDraft())}>
            <Sparkles aria-hidden="true" /> Fill with a sample lesson
          </button>
        ) : null}
      </header>

      {errors.length > 0 ? (
        <div className="error-summary" role="alert" tabIndex={-1} ref={errorRef}>
          <h2>
            Please fix {errors.length === 1 ? 'this problem' : 'these problems'} before saving
          </h2>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="editor"
        onSubmit={(event) => {
          event.preventDefault();
          save(false);
        }}
        noValidate
      >
        <Section title="1. Lesson details">
          <div className="field-grid">
            <Field
              label="Title"
              value={draft.title}
              maxLength={60}
              onChange={(value) => update('title', value)}
              required
            />
            <Field
              label="Title in Japanese"
              value={draft.titleJa}
              lang="ja"
              maxLength={60}
              onChange={(value) => update('titleJa', value)}
            />
            <Field
              label="Topic"
              value={draft.topic}
              maxLength={40}
              onChange={(value) => update('topic', value)}
            />
            <PictureField
              label="Cover picture"
              value={draft.cover}
              onChange={(value) => update('cover', value)}
            />
          </div>
          <Field
            label="Summary (one sentence for learners)"
            value={draft.summary}
            maxLength={300}
            onChange={(value) => update('summary', value)}
            required
          />
          <div className="field-grid">
            <div className="field">
              <label htmlFor="level">Target level (CEFR)</label>
              <select
                id="level"
                value={draft.level}
                onChange={(event) => update('level', event.target.value as Draft['level'])}
              >
                {CEFR_LEVELS.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </div>
            <Field
              label="CEFR-J band (optional)"
              value={draft.cefrJ}
              maxLength={20}
              placeholder="e.g. A1.2"
              onChange={(value) => update('cefrJ', value)}
            />
            <div className="field">
              <label htmlFor="minutes">Minutes</label>
              <input
                id="minutes"
                type="number"
                min={5}
                max={120}
                value={draft.minutes}
                onChange={(event) => update('minutes', Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="pass">Pass mark (%)</label>
              <input
                id="pass"
                type="number"
                min={50}
                max={100}
                value={draft.passMark}
                onChange={(event) => update('passMark', Number(event.target.value))}
              />
            </div>
          </div>
          <fieldset className="checkbox-row">
            <legend>Learners</legend>
            {AUDIENCES.map((audience) => (
              <label key={audience}>
                <input
                  type="checkbox"
                  checked={draft.audiences.includes(audience)}
                  onChange={(event) =>
                    update(
                      'audiences',
                      event.target.checked
                        ? [...draft.audiences, audience]
                        : draft.audiences.filter((value: Audience) => value !== audience),
                    )
                  }
                />
                {AUDIENCE_LABELS[audience].en}
              </label>
            ))}
          </fieldset>
          <Field
            label="Learning objectives (one per line, “Can …”)"
            value={draft.objectives}
            multiline
            onChange={(value) => update('objectives', value)}
            required
          />
          <Field
            label="Success criteria (one per line)"
            value={draft.successCriteria}
            multiline
            onChange={(value) => update('successCriteria', value)}
            required
          />
          <div className="field-grid">
            <Field
              label="Student instructions (English)"
              value={draft.studentEn}
              multiline
              onChange={(value) => update('studentEn', value)}
              required
            />
            <Field
              label="Student instructions (Japanese)"
              value={draft.studentJa}
              multiline
              lang="ja"
              onChange={(value) => update('studentJa', value)}
            />
          </div>
        </Section>

        <Section
          title="2. Vocabulary"
          description="At least 4 words create the flashcards and the matching game. Use [brackets] in the example to highlight the word."
        >
          <ol className="item-list">
            {draft.vocab.map((item, index) => (
              <li key={item.key} className="item-card">
                <ItemToolbar
                  index={index}
                  count={draft.vocab.length}
                  label={`Word ${index + 1}${item.word ? ` (${item.word})` : ''}`}
                  onMove={(to) => update('vocab', move(draft.vocab, index, to))}
                  onRemove={() =>
                    update(
                      'vocab',
                      draft.vocab.filter((_, i) => i !== index),
                    )
                  }
                />
                <div className="field-grid">
                  <Field
                    label="Word"
                    value={item.word}
                    maxLength={60}
                    lang="en"
                    onChange={(word) => setVocab(index, { ...item, word })}
                    required
                  />
                  <Field
                    label="Japanese"
                    value={item.ja}
                    lang="ja"
                    maxLength={80}
                    onChange={(ja) => setVocab(index, { ...item, ja })}
                  />
                  <PictureField
                    label="Picture"
                    value={item.picture}
                    onChange={(picture) => setVocab(index, { ...item, picture })}
                  />
                  <div className="field">
                    <label htmlFor={`pos-${item.key}`}>Part of speech</label>
                    <select
                      id={`pos-${item.key}`}
                      value={item.partOfSpeech}
                      onChange={(event) =>
                        setVocab(index, {
                          ...item,
                          partOfSpeech: event.target.value as VocabDraft['partOfSpeech'],
                        })
                      }
                    >
                      {PARTS_OF_SPEECH.map((part) => (
                        <option key={part}>{part}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-grid">
                  <Field
                    label="Example sentence"
                    value={item.example}
                    placeholder="I like [dogs]."
                    onChange={(example) => setVocab(index, { ...item, example })}
                    required
                  />
                  <Field
                    label="Example in Japanese"
                    value={item.exampleJa}
                    lang="ja"
                    onChange={(exampleJa) => setVocab(index, { ...item, exampleJa })}
                  />
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => update('vocab', [...draft.vocab, emptyVocab()])}
          >
            <Plus aria-hidden="true" /> Add a word
          </button>
        </Section>

        <Section title="3. Grammar explanation" open={draft.grammarEnabled}>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={draft.grammarEnabled}
              onChange={(event) => update('grammarEnabled', event.target.checked)}
            />{' '}
            Include a grammar explanation
          </label>
          {draft.grammarEnabled ? (
            <>
              <div className="field-grid">
                <Field
                  label="Grammar title"
                  value={draft.grammarTitle}
                  onChange={(value) => update('grammarTitle', value)}
                  required
                />
                <Field
                  label="Pattern"
                  value={draft.grammarPattern}
                  placeholder="I like + noun-s."
                  onChange={(value) => update('grammarPattern', value)}
                  required
                />
              </div>
              <div className="field-grid">
                <Field
                  label="Explanation (English)"
                  value={draft.grammarEn}
                  multiline
                  onChange={(value) => update('grammarEn', value)}
                  required
                />
                <Field
                  label="Explanation (Japanese)"
                  value={draft.grammarJa}
                  multiline
                  lang="ja"
                  onChange={(value) => update('grammarJa', value)}
                />
              </div>
              <Field
                label="Examples (one per line: English | Japanese)"
                value={draft.grammarExamples}
                multiline
                rows={6}
                hint="Use [brackets] to highlight the grammar, e.g. “He [plays] tennis. | 彼はテニスをします。” Start a line with “# Tab name | タブ名” to group examples into tabs (up to 4)."
                onChange={(value) => update('grammarExamples', value)}
                required
              />
              {draft.grammarSwitcher ? (
                <p className="notice notice-info">
                  This lesson’s interactive sentence switcher (
                  {draft.grammarSwitcher.options.length} choices) is kept as it is.
                </p>
              ) : null}
              <Field
                label="Common mistakes (one per line: wrong | right | why | why in Japanese)"
                value={draft.grammarMistakes}
                multiline
                rows={3}
                onChange={(value) => update('grammarMistakes', value)}
              />
            </>
          ) : null}
        </Section>

        <Section
          title="4. Practice questions"
          description="Mix recognition (multiple choice) with production (fill in the blank, sentence building)."
        >
          <ol className="item-list">
            {draft.practice.map((question, index) => (
              <li key={question.key} className="item-card">
                <ItemToolbar
                  index={index}
                  count={draft.practice.length}
                  label={`Question ${index + 1} · ${KIND_LABELS[question.kind]}`}
                  onMove={(to) => update('practice', move(draft.practice, index, to))}
                  onRemove={() =>
                    update(
                      'practice',
                      draft.practice.filter((_, i) => i !== index),
                    )
                  }
                />
                <QuestionFields
                  question={question}
                  onChange={(value) => setQuestion(index, value)}
                  label={`Question ${index + 1}`}
                />
              </li>
            ))}
          </ol>
          <div className="button-row">
            {(['mcq', 'fill', 'build'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className="btn btn-small"
                onClick={() => update('practice', [...draft.practice, emptyQuestion(kind)])}
              >
                <Plus aria-hidden="true" /> {KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="5. Listening"
          description="Write a short script; it is read aloud by the device’s voices. Start lines with “A:” / “B:” for two speakers."
        >
          <ol className="item-list">
            {draft.listening.map((item, index) => (
              <li key={item.key} className="item-card">
                <ItemToolbar
                  index={index}
                  count={draft.listening.length}
                  label={`Listening ${index + 1}`}
                  onMove={(to) => update('listening', move(draft.listening, index, to))}
                  onRemove={() =>
                    update(
                      'listening',
                      draft.listening.filter((_, i) => i !== index),
                    )
                  }
                />
                <Field
                  label="Script (one line per speaker turn)"
                  value={item.script}
                  multiline
                  lang="en"
                  placeholder={'A: What colour is it?\nB: It’s green.'}
                  onChange={(script) => setListening(index, { ...item, script })}
                  required
                />
                <Field
                  label="Question"
                  value={item.question}
                  onChange={(question) => setListening(index, { ...item, question })}
                  required
                />
                <Field
                  label="Question in Japanese (optional)"
                  value={item.questionJa}
                  lang="ja"
                  onChange={(questionJa) => setListening(index, { ...item, questionJa })}
                />
                <OptionsEditor
                  name={`listen-${item.key}`}
                  value={item}
                  onChange={(value) => setListening(index, value)}
                />
                <Field
                  label="Explanation"
                  value={item.explanation}
                  onChange={(explanation) => setListening(index, { ...item, explanation })}
                  required
                />
                <Field
                  label="Focus tags"
                  value={item.tags}
                  hint={TAG_HINT}
                  onChange={(tags) => setListening(index, { ...item, tags })}
                />
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => update('listening', [...draft.listening, emptyListening()])}
          >
            <Plus aria-hidden="true" /> Add a listening item
          </button>
        </Section>

        <Section title="6. Reading" open={draft.readingEnabled}>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={draft.readingEnabled}
              onChange={(event) => update('readingEnabled', event.target.checked)}
            />{' '}
            Include a reading text
          </label>
          {draft.readingEnabled ? (
            <>
              <div className="field-grid">
                <Field
                  label="Reading title"
                  value={draft.readingTitle}
                  onChange={(value) => update('readingTitle', value)}
                  required
                />
                <PictureField
                  label="Picture (optional)"
                  value={draft.readingPicture}
                  onChange={(value) => update('readingPicture', value)}
                />
              </div>
              <Field
                label="Text (leave an empty line between paragraphs)"
                value={draft.readingText}
                multiline
                rows={6}
                lang="en"
                onChange={(value) => update('readingText', value)}
                required
              />
              <Field
                label="Word help (one per line: word | meaning | Japanese)"
                value={draft.glossary}
                multiline
                rows={3}
                onChange={(value) => update('glossary', value)}
              />
              <ol className="item-list">
                {draft.readingQuestions.map((question, index) => (
                  <li key={question.key} className="item-card">
                    <ItemToolbar
                      index={index}
                      count={draft.readingQuestions.length}
                      label={`Reading question ${index + 1}`}
                      onMove={(to) =>
                        update('readingQuestions', move(draft.readingQuestions, index, to))
                      }
                      onRemove={() =>
                        update(
                          'readingQuestions',
                          draft.readingQuestions.filter((_, i) => i !== index),
                        )
                      }
                    />
                    <McqFields
                      question={question}
                      onChange={(value) => setReadingQuestion(index, value)}
                      label={`Reading question ${index + 1}`}
                    />
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => update('readingQuestions', [...draft.readingQuestions, emptyMcq()])}
              >
                <Plus aria-hidden="true" /> Add a reading question
              </button>
            </>
          ) : null}
        </Section>

        <Section title="7. Teacher notes, feedback & assessment" open={false}>
          <Field
            label="Lesson overview for teachers"
            value={draft.overview}
            multiline
            onChange={(value) => update('overview', value)}
            required
          />
          <Field
            label="Teaching steps (one per line)"
            value={draft.steps}
            multiline
            rows={4}
            onChange={(value) => update('steps', value)}
            required
          />
          <div className="field-grid">
            <Field
              label="Differentiation (one per line)"
              value={draft.differentiation}
              multiline
              onChange={(value) => update('differentiation', value)}
            />
            <Field
              label="Common errors to watch for (one per line)"
              value={draft.commonErrors}
              multiline
              onChange={(value) => update('commonErrors', value)}
            />
          </div>
          <Field
            label="Feedback approach"
            value={draft.feedback}
            multiline
            onChange={(value) => update('feedback', value)}
            required
          />
          <div className="field-grid">
            <Field
              label="Formative assessment"
              value={draft.formative}
              multiline
              onChange={(value) => update('formative', value)}
              required
            />
            <Field
              label="Summative assessment"
              value={draft.summative}
              multiline
              onChange={(value) => update('summative', value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="quiz-length">Lesson check length (questions)</label>
            <input
              id="quiz-length"
              type="number"
              min={4}
              max={20}
              value={draft.quizLength}
              onChange={(event) => update('quizLength', Number(event.target.value))}
            />
          </div>
        </Section>

        <div className="editor-actions">
          <p className="muted small" role="status" aria-live="polite">
            {status}
          </p>
          <a className="btn btn-ghost" href="#/teacher">
            Cancel
          </a>
          <button type="button" className="btn" onClick={() => save(true)}>
            <Eye aria-hidden="true" /> Save &amp; preview
          </button>
          <button type="submit" className="btn btn-primary">
            <Save aria-hidden="true" /> Save lesson
          </button>
        </div>
      </form>
    </section>
  );
}
