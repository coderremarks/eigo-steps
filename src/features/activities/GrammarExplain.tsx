import { ArrowRight, Check, X } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';

import type { GrammarPoint } from '../../domain/schema';
import { stripHighlights } from '../../domain/text';
import { Bi, Highlighted, Ja, SpeakButton } from '../../ui/common';
import { Illustration } from '../../ui/Illustration';
import { useServices, useSettings } from '../../state/context';
import type { ActivityOutcome } from './types';

/**
 * Interactive grammar explanation: the pattern, colour-highlighted examples by sentence type
 * (tabs), a "switcher" that shows exactly what changes, and common mistakes to reveal.
 */
export function GrammarExplain({
  grammar,
  onComplete,
}: {
  grammar: GrammarPoint;
  onComplete: (outcome: ActivityOutcome) => void;
}) {
  const { speech } = useServices();
  const { slowAudio } = useSettings();
  const [tab, setTab] = useState(0);
  const [choice, setChoice] = useState(0);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const form = grammar.forms[tab];
  const current = grammar.switcher?.options[choice];

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const count = grammar.forms.length;
    const targets: Record<string, number> = {
      ArrowRight: (tab + 1) % count,
      ArrowLeft: (tab - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="grammar">
      <section className="pattern-box" aria-label="Pattern">
        <p className="eyebrow">Pattern</p>
        <p className="pattern">{grammar.pattern}</p>
      </section>
      <Bi en={grammar.explanation.en} ja={grammar.explanation.ja} className="explanation" />

      <section className="grammar-forms">
        <h2 className="sr-only">Examples</h2>
        <div role="tablist" aria-label="Sentence types" className="tabs">
          {grammar.forms.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-selected={tab === index}
              aria-controls={`${id}-panel`}
              tabIndex={tab === index ? 0 : -1}
              className="tab"
              onClick={() => setTab(index)}
              onKeyDown={onTabKey}
            >
              {item.label} <Ja>{item.labelJa}</Ja>
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${tab}`}
          className="tab-panel"
          tabIndex={0}
        >
          <ul className="examples">
            {form?.examples.map((example) => (
              <li key={example.text}>
                <span className="example-en">
                  <Highlighted text={example.text} />
                </span>
                <SpeakButton text={example.text} />
                <Ja className="example-ja">{example.ja}</Ja>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {grammar.switcher && current ? (
        <section className="switcher" aria-labelledby={`${id}-switcher`}>
          <h2 id={`${id}-switcher`}>Try it: {grammar.switcher.prompt}</h2>
          <Ja>{grammar.switcher.promptJa}</Ja>
          <div className="switch-options" role="group" aria-label="Choose">
            {grammar.switcher.options.map((option, index) => (
              <button
                key={option.label}
                type="button"
                className="switch-option"
                aria-pressed={choice === index}
                onClick={() => {
                  setChoice(index);
                  void speech.speak(stripHighlights(option.sentence), { slow: slowAudio });
                }}
              >
                {option.picture ? <Illustration emoji={option.picture} size="sm" /> : null}
                {option.label}
              </button>
            ))}
          </div>
          <p className="switch-result" aria-live="polite">
            <Highlighted text={current.sentence} />
          </p>
          {current.note ? <p className="switch-note">{current.note}</p> : null}
        </section>
      ) : null}

      {grammar.mistakes.length > 0 ? (
        <section className="mistakes">
          <h2>
            Common mistakes <Ja>よくある間違い</Ja>
          </h2>
          <ul>
            {grammar.mistakes.map((mistake, index) => (
              <li key={mistake.wrong} className="mistake-card">
                <p className="mistake-wrong">
                  <X aria-hidden="true" />
                  <span className="sr-only">Incorrect: </span>
                  <s>{mistake.wrong}</s>
                </p>
                {revealed.has(index) ? (
                  <>
                    <p className="mistake-right">
                      <Check aria-hidden="true" />
                      <span className="sr-only">Correct: </span>
                      {mistake.right}
                      <SpeakButton text={mistake.right} />
                    </p>
                    <Bi en={mistake.why} ja={mistake.whyJa} className="mistake-why" />
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => setRevealed((previous) => new Set(previous).add(index))}
                  >
                    Show the correction
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="activity-footer">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onComplete({ score: null, correct: 0, total: 0, answers: [] })}
        >
          I’m ready to practise <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
