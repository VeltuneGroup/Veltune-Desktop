import { parse } from 'node-html-parser';

import { createWordTimings } from '../helpers';

import type { LineLyrics, WordLyrics } from '../types';

const parseTimeValue = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (/^\d+(?:\.\d+)?s$/.test(normalized)) {
    return parseFloat(normalized) * 1000;
  }

  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    return parseFloat(normalized) * 1000;
  }

  const parts = normalized.split(':').map((part) => part.trim());
  if (parts.length === 2) {
    return (parseFloat(parts[0]) * 60 + parseFloat(parts[1])) * 1000;
  }

  if (parts.length === 3) {
    return (
      (parseFloat(parts[0]) * 60 * 60 +
        parseFloat(parts[1]) * 60 +
        parseFloat(parts[2])) *
      1000
    );
  }

  return null;
};

const buildWordTimingsFromSpans = (
  spans: Array<{
    getAttribute: (name: string) => string | undefined;
    innerText?: string;
    textContent?: string;
  }>,
): WordLyrics[] | undefined => {
  const words = spans
    .map((span) => {
      const begin = span.getAttribute('begin');
      if (!begin) {
        return null;
      }

      const timeInMs = parseTimeValue(begin);
      if (timeInMs === null) {
        return null;
      }

      const end = span.getAttribute('end');
      const dur = span.getAttribute('dur');
      const endInMs = end
        ? parseTimeValue(end)
        : dur
          ? timeInMs + (parseTimeValue(dur) ?? 0)
          : null;

      return {
        text: span.innerText ?? span.textContent ?? '',
        timeInMs,
        duration: Math.max((endInMs ?? timeInMs) - timeInMs, 0),
      } satisfies WordLyrics;
    })
    .filter((word): word is WordLyrics => Boolean(word && word.text.trim()));

  return words.length ? words : undefined;
};

export const TTML = {
  parse: (ttml: string): LineLyrics[] => {
    const root = parse(ttml);
    const lines: LineLyrics[] = [];

    const pTags = root.querySelectorAll('p');

    for (const p of pTags) {
      const begin = p.getAttribute('begin');
      if (!begin) {
        continue;
      }

      const timeInMs = parseTimeValue(begin);
      if (timeInMs === null) {
        continue;
      }

      const text = p.text.trim();
      if (!text) {
        continue;
      }

      const end = p.getAttribute('end');
      const dur = p.getAttribute('dur');
      const endInMs = end
        ? parseTimeValue(end)
        : dur
          ? timeInMs + (parseTimeValue(dur) ?? 0)
          : timeInMs;
      const words = buildWordTimingsFromSpans(p.querySelectorAll('span'));

      lines.push({
        time: begin,
        timeInMs,
        duration: Math.max((endInMs ?? timeInMs) - timeInMs, 0),
        text,
        words,
        isWordSynced: Boolean(words?.length),
        status: 'upcoming',
      });
    }

    for (let i = 0; i < lines.length - 1; i++) {
      if (!lines[i].duration) {
        lines[i].duration = lines[i + 1].timeInMs - lines[i].timeInMs;
      }
    }

    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (!lastLine.duration) {
        lastLine.duration = 5000;
      }
    }

    if (lines.length > 0 && lines[0].timeInMs > 300) {
      lines.unshift({
        time: '0.000',
        timeInMs: 0,
        duration: lines[0].timeInMs,
        text: '',
        status: 'upcoming',
      });
    }

    for (const line of lines) {
      if (line.text.trim() && (!line.words || line.words.length === 0)) {
        line.words = createWordTimings(line.text, line.timeInMs, line.duration);
      }
    }

    return lines;
  },
};
