import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useState } from 'react';

import type { Module } from '../../domain/schema';
import { Highlighted, Ja, SpeakButton } from '../../ui/common';
import { Illustration } from '../../ui/Illustration';
import type { ActivityOutcome } from './types';

/** Illustrated flashcards: picture + word + audio + example sentence (+ Japanese support). */
export function VocabCards({
  module,
  onComplete,
}: {
  module: Module;
  onComplete: (outcome: ActivityOutcome) => void;
}) {
  const words = module.vocab;
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([0]));
  const item = words[index];
  if (!item) return null;

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(words.length - 1, next));
    setIndex(clamped);
    setSeen((previous) => new Set(previous).add(clamped));
  };
  const allSeen = seen.size === words.length;

  return (
    <div className="flashcards">
      <article
        className="flashcard"
        aria-roledescription="flashcard"
        aria-label={`Card ${index + 1} of ${words.length}: ${item.word}`}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') go(index + 1);
          if (event.key === 'ArrowLeft') go(index - 1);
        }}
      >
        <Illustration
          emoji={item.picture}
          label={item.word}
          size="xl"
          className="flashcard-picture"
        />
        <div className="flashcard-body">
          <p className="flashcard-word">
            <span lang="en">{item.word}</span>
            <SpeakButton text={item.word} className="speak-lg" />
            <SpeakButton
              text={item.word}
              slow
              label={`Listen slowly: ${item.word}`}
              className="speak-slow"
            />
          </p>
          <Ja className="flashcard-ja">{item.ja}</Ja>
          {item.note ? <p className="flashcard-note">{item.note}</p> : null}
          <p className="flashcard-example">
            <Highlighted text={item.example} />
            <SpeakButton text={item.example} label="Listen to the example sentence" />
          </p>
          <Ja className="flashcard-example-ja">{item.exampleJa}</Ja>
          <p className="pos muted small">{item.partOfSpeech}</p>
        </div>
      </article>

      <div className="card-nav">
        <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index === 0}>
          <ChevronLeft aria-hidden="true" /> Previous
        </button>
        <span className="card-count" aria-live="polite">
          {index + 1} / {words.length}
        </span>
        <button
          type="button"
          className="btn"
          onClick={() => go(index + 1)}
          disabled={index === words.length - 1}
        >
          Next <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <ol className="card-strip" aria-label="All cards">
        {words.map((word, i) => (
          <li key={word.id}>
            <button
              type="button"
              className={`card-thumb ${i === index ? 'current' : ''} ${seen.has(i) ? 'seen' : ''}`}
              aria-label={`Card ${i + 1}: ${word.word}${seen.has(i) ? ' (seen)' : ''}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => go(i)}
            >
              <Illustration emoji={word.picture} size="xs" />
              {seen.has(i) ? <Check className="thumb-check" aria-hidden="true" /> : null}
            </button>
          </li>
        ))}
      </ol>

      <div className="activity-footer">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!allSeen}
          onClick={() =>
            onComplete({
              score: null,
              correct: 0,
              total: 0,
              answers: [],
              learnedVocab: words.map((word) => word.id),
            })
          }
        >
          {allSeen
            ? 'I studied all the words'
            : `Look at all ${words.length} cards to finish (${seen.size}/${words.length})`}
        </button>
      </div>
    </div>
  );
}
