import { ArrowRight, Check } from 'lucide-react';
import { useMemo, useState } from 'react';

import { scorePercent } from '../../domain/grading';
import type { ItemAnswer } from '../../domain/progress';
import { createRng, shuffle } from '../../domain/random';
import type { Module } from '../../domain/schema';
import { matchingRounds } from '../../domain/tasks';
import { Illustration } from '../../ui/Illustration';
import { useServices, useSettings } from '../../state/context';
import type { ActivityOutcome } from './types';

/**
 * Picture ↔ word matching in rounds of up to six pairs. Tap (or press Enter on) a picture and a
 * word in either order. Words are spoken when selected, so pre-literate learners can play too.
 * Scoring counts pairs matched without a mistake.
 */
export function Matching({
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
  const rounds = useMemo(
    () => matchingRounds(shuffle(module.vocab, createRng(seed))),
    [module, seed],
  );
  const [round, setRound] = useState(0);
  const [picture, setPicture] = useState<string | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [matched, setMatched] = useState<ReadonlySet<string>>(new Set());
  const [missed, setMissed] = useState<ReadonlyMap<string, string>>(new Map());
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState<string | null>(null);

  const items = useMemo(() => rounds[round] ?? [], [rounds, round]);
  const pictures = useMemo(
    () => shuffle(items, createRng(seed + round * 7 + 1)),
    [items, seed, round],
  );
  const words = useMemo(
    () => shuffle(items, createRng(seed + round * 7 + 3)),
    [items, seed, round],
  );
  const roundDone = items.length > 0 && items.every((item) => matched.has(item.id));
  const lastRound = round === rounds.length - 1;

  const attempt = (pictureId: string, wordId: string) => {
    const target = items.find((item) => item.id === pictureId);
    const chosen = items.find((item) => item.id === wordId);
    if (!target || !chosen) return;
    if (pictureId === wordId) {
      setMatched((previous) => new Set(previous).add(pictureId));
      setMessage(`Matched: ${target.picture} ${target.word}`);
    } else {
      if (!missed.has(pictureId))
        setMissed((previous) => new Map(previous).set(pictureId, chosen.word));
      setMessage(`That picture is not “${chosen.word}”. Try again!`);
      setShake(pictureId);
      window.setTimeout(() => setShake(null), 450);
    }
    setPicture(null);
    setWord(null);
  };

  const selectPicture = (id: string) => {
    if (word) attempt(id, word);
    else setPicture(id === picture ? null : id);
  };
  const selectWord = (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (item) void speech.speak(item.word, { slow: slowAudio });
    if (picture) attempt(picture, id);
    else setWord(id === word ? null : id);
  };

  const finish = () => {
    const answers: ItemAnswer[] = module.vocab.map((item) => ({
      itemId: `vocab-${item.id}`,
      skill: 'vocabulary',
      tags: ['vocabulary'],
      firstTryCorrect: !missed.has(item.id),
      wrongAnswer: missed.get(item.id),
    }));
    const correct = answers.filter((answer) => answer.firstTryCorrect).length;
    onComplete({
      score: scorePercent(correct, answers.length),
      correct,
      total: answers.length,
      answers,
      learnedVocab: module.vocab.map((item) => item.id),
    });
  };

  return (
    <div className="matching">
      <p className="muted">
        Round {round + 1} of {rounds.length} · {items.filter((item) => matched.has(item.id)).length}{' '}
        of {items.length} matched
      </p>
      <div className="match-board">
        <div className="match-column" role="group" aria-label="Pictures">
          {pictures.map((item) => {
            const done = matched.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`match-card match-picture ${picture === item.id ? 'selected' : ''} ${done ? 'done' : ''} ${shake === item.id ? 'shake' : ''}`}
                aria-pressed={picture === item.id}
                aria-label={`Picture: ${item.ja || item.word}${done ? ` (matched: ${item.word})` : ''}`}
                disabled={done}
                onClick={() => selectPicture(item.id)}
              >
                <Illustration emoji={item.picture} size="lg" />
                {done ? (
                  <span className="match-label">
                    <Check aria-hidden="true" /> {item.word}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="match-column" role="group" aria-label="Words">
          {words.map((item) => {
            const done = matched.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                lang="en"
                className={`match-card match-word ${word === item.id ? 'selected' : ''} ${done ? 'done' : ''}`}
                aria-pressed={word === item.id}
                disabled={done}
                onClick={() => selectWord(item.id)}
              >
                {item.word}
              </button>
            );
          })}
        </div>
      </div>
      <p className="match-message" aria-live="polite">
        {message}
      </p>
      {roundDone ? (
        <div className="activity-footer">
          {lastRound ? (
            <button type="button" className="btn btn-primary" onClick={finish}>
              Finish <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setRound(round + 1);
                setMessage('');
              }}
            >
              Next round <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
