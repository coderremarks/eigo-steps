import { Square, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { scorePercent } from '../../domain/grading';
import type { Module } from '../../domain/schema';
import { readingTasks } from '../../domain/tasks';
import { segmentWithGlossary } from '../../domain/text';
import { Ja, SpeakButton } from '../../ui/common';
import { Illustration } from '../../ui/Illustration';
import { useServices, useSettings } from '../../state/context';
import { QuestionSet } from './questions/QuestionSet';
import type { ActivityOutcome } from './types';

/** A short passage with tap-to-see glosses, optional read-aloud, and comprehension questions. */
export function ReadingActivity({
  module,
  seed,
  onComplete,
}: {
  module: Module;
  seed: number;
  onComplete: (outcome: ActivityOutcome) => void;
}) {
  const { speech } = useServices();
  const { slowAudio } = useSettings();
  const reading = module.reading;
  const [active, setActive] = useState<number | null>(null);
  const [readingAloud, setReadingAloud] = useState(false);
  const segments = useMemo(
    () =>
      reading
        ? segmentWithGlossary(
            reading.paragraphs,
            reading.glossary.map((entry) => entry.term),
          )
        : [],
    [reading],
  );
  const tasks = useMemo(() => readingTasks(module), [module]);

  useEffect(() => () => speech.stop(), [speech]);

  if (!reading) return <p>This lesson has no reading text.</p>;
  const gloss = active === null ? undefined : reading.glossary[active];

  return (
    <div className="reading-layout">
      <article className="passage" aria-labelledby="passage-title">
        <header className="passage-header">
          {reading.picture ? <Illustration emoji={reading.picture} size="md" /> : null}
          <h2 id="passage-title">{reading.title}</h2>
          {speech.supported ? (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                if (readingAloud) {
                  speech.stop();
                  setReadingAloud(false);
                  return;
                }
                setReadingAloud(true);
                void speech
                  .speakLines(
                    reading.paragraphs.map((text) => ({ text, role: 'A' as const })),
                    { slow: slowAudio },
                  )
                  .finally(() => setReadingAloud(false));
              }}
            >
              {readingAloud ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              {readingAloud ? 'Stop' : 'Read aloud'}
            </button>
          ) : null}
        </header>
        {segments.map((paragraph, p) => (
          <p key={p} className="passage-paragraph">
            {paragraph.map((segment, s) =>
              segment.glossIndex === undefined ? (
                <span key={s}>{segment.text}</span>
              ) : (
                <button
                  key={s}
                  type="button"
                  className={`gloss-term ${active === segment.glossIndex ? 'active' : ''}`}
                  aria-expanded={active === segment.glossIndex}
                  aria-controls="gloss-panel"
                  onClick={() =>
                    setActive(active === segment.glossIndex ? null : (segment.glossIndex ?? null))
                  }
                >
                  {segment.text}
                </button>
              ),
            )}
          </p>
        ))}
        <div id="gloss-panel" className={`gloss-panel ${gloss ? 'open' : ''}`} aria-live="polite">
          {gloss ? (
            <>
              <p>
                <strong lang="en">{gloss.term}</strong>
                <SpeakButton text={gloss.term} />
                <button
                  type="button"
                  className="icon-btn gloss-close"
                  aria-label="Close word help"
                  onClick={() => setActive(null)}
                >
                  <X aria-hidden="true" />
                </button>
              </p>
              <p>{gloss.meaning}</p>
              <Ja>{gloss.ja}</Ja>
            </>
          ) : (
            <p className="muted small">Tap an underlined word to see what it means.</p>
          )}
        </div>
      </article>

      <section className="reading-questions" aria-labelledby="reading-questions-title">
        <h2 id="reading-questions-title">Questions</h2>
        <QuestionSet
          tasks={tasks}
          mode="practice"
          seed={seed}
          onComplete={(result) =>
            onComplete({
              score: scorePercent(result.correct, result.total),
              correct: result.correct,
              total: result.total,
              answers: result.answers,
            })
          }
        />
      </section>
    </div>
  );
}
