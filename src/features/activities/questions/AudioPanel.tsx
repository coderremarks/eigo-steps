import { Play, RotateCcw, Square, Turtle } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { VoiceRole } from '../../../services/speech';
import { useServices, useSettings } from '../../../state/context';

interface Props {
  lines: readonly { text: string; role: VoiceRole }[];
  onPlay?: () => void;
  label?: string;
}

/** Play / replay / slow / stop controls. Learners control the audio as often as they need. */
export function AudioPanel({ lines, onPlay, label = 'Listen' }: Props) {
  const { speech } = useServices();
  const settings = useSettings();
  const [slow, setSlow] = useState(settings.slowAudio);
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);

  useEffect(() => () => speech.stop(), [speech]);

  if (!speech.supported) {
    return (
      <p className="notice notice-warning">
        Audio is not available on this device. Read the transcript below instead.
      </p>
    );
  }

  const play = () => {
    setPlaying(true);
    setPlays((count) => count + 1);
    onPlay?.();
    void speech.speakLines(lines, { slow }).finally(() => setPlaying(false));
  };

  return (
    <div className="audio-panel" role="group" aria-label={label}>
      {playing ? (
        <button
          type="button"
          className="btn btn-primary btn-play"
          onClick={() => {
            speech.stop();
            setPlaying(false);
          }}
        >
          <Square aria-hidden="true" /> Stop
        </button>
      ) : (
        <button type="button" className="btn btn-primary btn-play" onClick={play}>
          {plays === 0 ? <Play aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
          {plays === 0 ? 'Play' : 'Play again'}
        </button>
      )}
      <button
        type="button"
        className="btn btn-toggle"
        aria-pressed={slow}
        onClick={() => setSlow((value) => !value)}
      >
        <Turtle aria-hidden="true" /> Slow
      </button>
      <span className="muted plays" aria-live="polite">
        {plays === 0 ? 'Not played yet' : `Played ${plays} ${plays === 1 ? 'time' : 'times'}`}
      </span>
    </div>
  );
}
