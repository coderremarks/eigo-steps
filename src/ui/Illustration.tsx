import { graphemes } from '../domain/text';
import { emojiFileName, illustrationUrl } from './illustrations';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  emoji: string;
  /** Accessible name. Omit for decorative pictures that sit next to their word. */
  label?: string;
  size?: Size;
  className?: string;
}

/**
 * Lesson pictures. Built-in pictures use bundled Noto Emoji SVGs (consistent on every school
 * device and offline); any other emoji a teacher picks falls back to the device's emoji font.
 */
export function Illustration({ emoji, label, size = 'md', className = '' }: Props) {
  const parts = graphemes(emoji);
  const decorative = !label;
  return (
    <span
      className={`illus illus-${size} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      {parts.map((part, index) => {
        const key = `${emojiFileName(part)}-${index}`;
        const url = illustrationUrl(part);
        return url ? (
          <img key={key} src={url} alt="" draggable={false} decoding="async" />
        ) : (
          <span key={key} className="illus-glyph">
            {part}
          </span>
        );
      })}
    </span>
  );
}
