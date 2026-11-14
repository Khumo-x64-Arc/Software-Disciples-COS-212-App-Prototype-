import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export type SpeechPart = { key: string; say: string };

/**
 * Wraps the browser's Web Speech API. `speak` takes a list of parts (the
 * question, then each option) and reports which part, and which character in
 * that part, is being spoken, so the UI can highlight words and outline options.
 */
export function useSpeech() {
  const { settings } = useApp();
  const [active, setActive] = useState<{ key: string; char: number } | null>(null);
  const runId = useRef(0);

  const stop = useCallback(() => {
    runId.current += 1;
    if (speechSupported()) window.speechSynthesis.cancel();
    setActive(null);
  }, []);

  const speak = useCallback(
    (parts: SpeechPart[]) => {
      if (!speechSupported() || parts.length === 0) return false;
      window.speechSynthesis.cancel();
      const myRun = ++runId.current;
      // One utterance per part: short utterances avoid Chrome cutting off long
      // speech, and make it trivial to know which option is being read.
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part.say);
        u.rate = settings.rate;
        u.lang = 'en-ZA'; // falls back to the browser's default English voice
        u.onstart = () => myRun === runId.current && setActive({ key: part.key, char: 0 });
        u.onboundary = e => myRun === runId.current && setActive({ key: part.key, char: e.charIndex });
        if (i === parts.length - 1) {
          u.onend = () => myRun === runId.current && setActive(null);
          u.onerror = () => myRun === runId.current && setActive(null);
        }
        window.speechSynthesis.speak(u);
      });
      return true;
    },
    [settings.rate],
  );

  useEffect(() => stop, [stop]);

  return { speak, stop, active, supported: speechSupported() };
}
