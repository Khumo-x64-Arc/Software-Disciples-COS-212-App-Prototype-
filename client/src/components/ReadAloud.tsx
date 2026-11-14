import { useApp } from '../state/AppContext';
import { useSpeech, type SpeechPart } from '../speech/useSpeech';
import { toSpoken } from '../speech/spoken';

/**
 * Renders text and highlights the word being spoken. Word highlighting is only
 * used when the spoken text matches the display text exactly; otherwise the
 * whole block is outlined while it is read.
 */
export function SpokenText({ text, activeChar }: { text: string; activeChar: number | null }) {
  if (activeChar === null) return <>{text}</>;
  if (toSpoken(text) !== text) return <span className="reading-block">{text}</span>;
  const before = text.slice(0, activeChar);
  const rest = text.slice(activeChar);
  const m = rest.match(/^\S+/);
  const word = m ? m[0] : '';
  return (
    <>
      {before}
      <mark className="reading-word">{word}</mark>
      {rest.slice(word.length)}
    </>
  );
}

/** A "Read aloud" button for a plain block of text, with word highlighting. */
export function ReadAloudText({ id, text, as: Tag = 'p' }: { id: string; text: string; as?: 'p' | 'span' | 'div' }) {
  const { speak, stop, active, supported } = useSpeech();
  const reading = active?.key === id;
  return (
    <Tag className="read-aloud-text">
      <SpokenText text={text} activeChar={reading ? active!.char : null} />{' '}
      <SpeakerButton
        supported={supported}
        reading={reading}
        onRead={() => speak([{ key: id, say: toSpoken(text) }])}
        onStop={stop}
        label="Read aloud"
      />
    </Tag>
  );
}

export function SpeakerButton({
  supported, reading, onRead, onStop, label = 'Read aloud',
}: { supported: boolean; reading: boolean; onRead: () => void; onStop: () => void; label?: string }) {
  if (!supported) {
    return <span className="muted small">(Read aloud is not available in this browser)</span>;
  }
  return reading ? (
    <button type="button" className="speaker reading" onClick={onStop} aria-label="Stop reading">
      <span aria-hidden>■</span> Stop
    </button>
  ) : (
    <button type="button" className="speaker" onClick={onRead} aria-label={label}>
      <span aria-hidden>🔊</span> {label}
    </button>
  );
}

/** Speaks a one-off note if narration is turned on (used by the step player). */
export function useNarration() {
  const { settings } = useApp();
  const speech = useSpeech();
  return {
    ...speech,
    narrate: (key: string, text: string) => {
      if (settings.narration) speech.speak([{ key, say: toSpoken(text) } satisfies SpeechPart]);
    },
  };
}
