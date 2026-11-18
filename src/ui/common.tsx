import { Lightbulb, Turtle, Volume2 } from 'lucide-react';
import { Fragment, useState, type ElementType, type ReactNode } from 'react';

import { AUDIENCE_LABELS, type Audience, type CefrLevel } from '../domain/schema';
import { parseHighlights } from '../domain/text';
import { useServices, useSettings } from '../state/context';

/** English text with optional Japanese support underneath (toggled in Settings). */
export function Bi({
  en,
  ja,
  as: Tag = 'p',
  className = '',
}: {
  en: ReactNode;
  ja?: string;
  as?: ElementType;
  className?: string;
}) {
  const { japaneseSupport } = useSettings();
  return (
    <Tag className={`bi ${className}`.trim()}>
      <span className="bi-en">{en}</span>
      {japaneseSupport && ja ? (
        <span className="bi-ja" lang="ja">
          {ja}
        </span>
      ) : null}
    </Tag>
  );
}

/** Japanese-only support text, hidden when Japanese support is off. */
export function Ja({ children, className = '' }: { children?: string; className?: string }) {
  const { japaneseSupport } = useSettings();
  if (!japaneseSupport || !children) return null;
  return (
    <span className={`ja ${className}`.trim()} lang="ja">
      {children}
    </span>
  );
}

/** Renders "I like [dogs]." with the bracketed part highlighted. */
export function Highlighted({ text }: { text: string }) {
  return (
    <>
      {parseHighlights(text).map((segment, index) =>
        segment.highlight ? (
          <mark key={index} className="hl">
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

export function SpeakButton({
  text,
  label,
  slow,
  className = '',
  onPlay,
}: {
  text: string;
  label?: string;
  slow?: boolean;
  className?: string;
  onPlay?: () => void;
}) {
  const { speech } = useServices();
  const settings = useSettings();
  const [playing, setPlaying] = useState(false);
  if (!speech.supported) return null;
  return (
    <button
      type="button"
      className={`icon-btn speak-btn ${className}`.trim()}
      aria-label={label ?? `Listen: ${text.replace(/[[\]]/g, '')}`}
      data-playing={playing || undefined}
      onClick={() => {
        setPlaying(true);
        onPlay?.();
        void speech
          .speak(text.replace(/[[\]]/g, ''), { slow: slow ?? settings.slowAudio })
          .finally(() => setPlaying(false));
      }}
    >
      {slow ? <Turtle aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
    </button>
  );
}

export function PurposeNote({
  purpose,
  principles,
}: {
  purpose: string;
  principles: readonly string[];
}) {
  const { teachingNotes } = useSettings();
  if (!teachingNotes) return null;
  return (
    <details className="purpose" open>
      <summary>
        <Lightbulb aria-hidden="true" />
        Why this activity? <span className="muted">(teaching note)</span>
      </summary>
      <p>{purpose}</p>
      <ul className="chip-list" aria-label="Learning principles">
        {principles.map((principle) => (
          <li key={principle} className="chip chip-soft">
            {principle}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function LevelBadge({ level, cefrJ }: { level: CefrLevel; cefrJ?: string }) {
  const title = cefrJ && cefrJ !== level ? `CEFR ${level} (CEFR-J ${cefrJ})` : `CEFR ${level}`;
  return (
    <span className={`badge level-${level.toLowerCase()}`} title={title}>
      {level}
      {cefrJ && cefrJ !== level ? <span className="badge-sub">{cefrJ}</span> : null}
    </span>
  );
}

export function AudienceChips({ audiences }: { audiences: readonly Audience[] }) {
  return (
    <ul className="chip-list" aria-label="Recommended for">
      {audiences.map((audience) => (
        <li key={audience} className={`chip chip-${audience}`}>
          {AUDIENCE_LABELS[audience].en}
        </li>
      ))}
    </ul>
  );
}

export function ProgressBar({
  value,
  label,
  tone = 'primary',
}: {
  value: number;
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={`progress-bar tone-${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 52,
  label,
}: {
  percent: number;
  size?: number;
  label: string;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <svg
      className="ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
    >
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} />
      <circle
        className="ring-value"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-text">
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

export function Stars({ count }: { count: 0 | 1 | 2 | 3 }) {
  return (
    <span className="stars" role="img" aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((index) => (
        <span key={index} className={index <= count ? 'star on' : 'star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
