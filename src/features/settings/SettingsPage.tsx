import { Download, RotateCcw, Sparkles, Upload, Volume2 } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { navigate } from '../../app/router';
import { parseProgressBackup, progressBackupFile } from '../../domain/exchange';
import { AVATARS, type Progress } from '../../domain/progress';
import { LIMITS } from '../../domain/schema';
import { useProgress, useServices, useSettings, useStore } from '../../state/context';
import { Ja } from '../../ui/common';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { usePageTitle } from '../../ui/format';
import { downloadFile, readTextFile } from '../../ui/files';
import { Illustration } from '../../ui/Illustration';

function Toggle({
  id,
  label,
  labelJa,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  labelJa?: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <input
        id={id}
        type="checkbox"
        className="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={`${id}-desc`}
      />
      <div>
        <label htmlFor={id}>
          {label} <Ja>{labelJa}</Ja>
        </label>
        <p id={`${id}-desc`} className="muted small">
          {description}
        </p>
      </div>
    </div>
  );
}

export function SettingsPage() {
  usePageTitle('Settings');
  const store = useStore();
  const { speech } = useServices();
  const settings = useSettings();
  const progress = useProgress();
  const [nickname, setNickname] = useState(progress.learner.nickname);
  const [message, setMessage] = useState('');
  const [pendingBackup, setPendingBackup] = useState<Progress | null>(null);
  const voices = useSyncExternalStore(
    (listener) => speech.subscribe(listener),
    () => voiceListKey(speech.voices()),
    () => '',
  );
  const voiceList = speech.voices();

  return (
    <section className="page narrow" aria-labelledby="settings-title">
      <h1 id="settings-title" tabIndex={-1}>
        Settings <Ja className="title-ja">設定</Ja>
      </h1>
      <p className="muted" role="status" aria-live="polite">
        {message}
      </p>

      <section className="panel" aria-labelledby="learner-title">
        <h2 id="learner-title">Learner</h2>
        <p className="muted small">
          Use a nickname, not your real name. It is only stored on this device.
        </p>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            store.updateLearner({ nickname });
            setMessage('Nickname saved.');
          }}
        >
          <label htmlFor="nickname">Nickname</label>
          <input
            id="nickname"
            type="text"
            maxLength={24}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
          <button type="submit" className="btn">
            Save
          </button>
        </form>
        <fieldset className="avatar-picker">
          <legend>Avatar</legend>
          {AVATARS.map((avatar) => (
            <label
              key={avatar}
              className={`avatar-option ${progress.learner.avatar === avatar ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="avatar"
                value={avatar}
                checked={progress.learner.avatar === avatar}
                onChange={() => store.updateLearner({ avatar })}
              />
              <Illustration emoji={avatar} size="sm" label={`Avatar ${avatar}`} />
            </label>
          ))}
        </fieldset>
      </section>

      <section className="panel" aria-labelledby="support-title">
        <h2 id="support-title">Learning support</h2>
        <Toggle
          id="ja-support"
          label="Japanese support"
          labelJa="日本語サポート"
          description="Show Japanese translations of instructions, meanings and explanations. Turn it off as learners grow more confident."
          checked={settings.japaneseSupport}
          onChange={(value) => store.updateSettings({ japaneseSupport: value })}
        />
        <Toggle
          id="teaching-notes"
          label="Teaching notes"
          labelJa="指導メモ"
          description="Show “Why this activity?” notes and teacher panels. Useful for teachers and for exploring the demo."
          checked={settings.teachingNotes}
          onChange={(value) => store.updateSettings({ teachingNotes: value })}
        />
        <Toggle
          id="transcripts"
          label="Always show listening transcripts"
          labelJa="スクリプトを常に表示"
          description="Accessibility option for deaf or hard-of-hearing learners, or devices without audio. Normally the transcript appears after answering."
          checked={settings.alwaysShowTranscript}
          onChange={(value) => store.updateSettings({ alwaysShowTranscript: value })}
        />
      </section>

      <section className="panel" aria-labelledby="audio-title">
        <h2 id="audio-title">Audio</h2>
        {speech.supported ? (
          <>
            <Toggle
              id="slow-audio"
              label="Slow audio by default"
              labelJa="ゆっくり再生"
              description="Play words and dialogues at a slower speed. You can always switch speed in each listening task."
              checked={settings.slowAudio}
              onChange={(value) => store.updateSettings({ slowAudio: value })}
            />
            <div className="field" data-voices={voices}>
              <label htmlFor="voice">Voice</label>
              <select
                id="voice"
                value={settings.voiceURI}
                onChange={(event) => {
                  store.updateSettings({ voiceURI: event.target.value });
                  speech.setPreferredVoice(event.target.value);
                }}
              >
                <option value="">Automatic (best available English voice)</option>
                {voiceList.map((voice) => (
                  <option key={voice.uri} value={voice.uri}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-small"
                onClick={() =>
                  void speech.speak('Hello! How are you today?', { slow: settings.slowAudio })
                }
              >
                <Volume2 aria-hidden="true" /> Test voice
              </button>
            </div>
            <p className="muted small">
              Voices come from your device (Windows, ChromeOS, iPadOS, Android). No audio is sent to
              any server by this app.
            </p>
          </>
        ) : (
          <p className="notice notice-warning">
            This browser has no speech synthesis. Transcripts are shown instead.
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="data-title">
        <h2 id="data-title">Your data</h2>
        <p>
          Everything is stored in this browser only (localStorage). Nothing is uploaded. Use a
          backup file to move progress to another device.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              downloadFile(
                'eigo-steps-progress-backup.json',
                progressBackupFile(progress, store.now()),
                'application/json',
              );
              setMessage('Backup downloaded.');
            }}
          >
            <Download aria-hidden="true" /> Download backup
          </button>
          <label className="btn file-btn">
            <Upload aria-hidden="true" /> Restore backup
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                void readTextFile(file, LIMITS.importBytes)
                  .then((text) => {
                    const result = parseProgressBackup(text);
                    if ('error' in result) {
                      setMessage(result.error);
                      return;
                    }
                    setPendingBackup(result.progress);
                  })
                  .catch((error: unknown) => {
                    setMessage(error instanceof Error ? error.message : 'Could not read the file.');
                  });
              }}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              store.loadDemo();
              setMessage('Demo learner loaded.');
              navigate('#/learn');
            }}
          >
            <Sparkles aria-hidden="true" /> Load demo learner
          </button>
          <ConfirmButton
            className="btn btn-danger"
            label={
              <>
                <RotateCcw aria-hidden="true" /> Reset progress
              </>
            }
            question="Reset all progress on this device? This cannot be undone."
            confirmLabel="Reset"
            onConfirm={() => {
              store.startFresh({
                nickname: progress.demo ? 'Learner' : progress.learner.nickname,
                avatar: progress.learner.avatar,
              });
              setMessage('Progress reset.');
            }}
          />
        </div>
        {pendingBackup ? (
          <div className="confirm-panel" role="group" aria-labelledby="backup-question">
            <p id="backup-question">
              Replace the progress on this device with the backup of “
              {pendingBackup.learner.nickname}” ({Object.keys(pendingBackup.activities).length}{' '}
              activities)?
            </p>
            <div className="button-row">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  store.replaceProgress(pendingBackup);
                  setPendingBackup(null);
                  setMessage('Backup restored.');
                }}
              >
                Replace progress
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPendingBackup(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function voiceListKey(voices: readonly { uri: string }[]): string {
  return voices.map((voice) => voice.uri).join('|');
}
