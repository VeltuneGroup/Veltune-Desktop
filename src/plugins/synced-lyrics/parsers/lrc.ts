import { createWordTimings } from '../helpers';

import type { WordLyrics } from '../types';

interface LRCTag {
  tag: string;
  value: string;
}

interface LRCLine {
  time: string;
  timeInMs: number;
  duration: number;
  text: string;
  words?: WordLyrics[];
  isWordSynced?: boolean;
  rawText?: string;
}

interface LRC {
  tags: LRCTag[];
  lines: LRCLine[];
}

const tagRegex = /^\[(?<tag>\w+):\s*(?<value>.+?)\s*\]$/;
const lyricRegex =
  /^\[(?<minutes>\d+):(?<seconds>\d+)\.(?<milliseconds>\d+)\](?<text>.*)$/;
const enhancedWordRegex =
  /<(?<minutes>\d+):(?<seconds>\d+)\.(?<milliseconds>\d+)>/g;

const parseEnhancedWords = (
  rawText: string,
  lineStartMs: number,
  lineDurationMs: number,
) => {
  const matches = Array.from(rawText.matchAll(enhancedWordRegex));
  if (matches.length === 0) {
    const text = rawText.trim();
    return {
      text,
      words: text
        ? createWordTimings(text, lineStartMs, lineDurationMs)
        : undefined,
    };
  }

  const textParts: string[] = [];
  const words: WordLyrics[] = [];

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const groups = match.groups;
    if (!groups) {
      continue;
    }

    const start = match.index ?? 0;
    const contentStart = start + match[0].length;
    const nextStart = matches[index + 1]?.index ?? rawText.length;
    const text = rawText.slice(contentStart, nextStart);
    textParts.push(text);

    if (!text.trim()) {
      continue;
    }

    const timeInMs =
      parseInt(groups.minutes) * 60 * 1000 +
      parseInt(groups.seconds) * 1000 +
      parseInt(groups.milliseconds);

    words.push({
      text,
      timeInMs,
      duration: 0,
    });
  }

  const plainText = textParts.join('').trim();
  if (words.length === 0) {
    return {
      text: plainText,
      words: plainText
        ? createWordTimings(plainText, lineStartMs, lineDurationMs)
        : undefined,
      isWordSynced: false,
    };
  }

  for (let index = 0; index < words.length; index++) {
    const current = words[index];
    const next = words[index + 1];
    const lineEnd = lineStartMs + lineDurationMs;
    current.duration = Math.max(
      (next?.timeInMs ?? lineEnd) - current.timeInMs,
      0,
    );
  }

  return {
    text: plainText,
    words,
    isWordSynced: true,
  };
};

export const LRC = {
  parse: (text: string): LRC => {
    const lrc: LRC = {
      tags: [],
      lines: [],
    };

    let offset = 0;
    let previousLine: LRCLine | null = null;

    for (const line of text.split('\n')) {
      if (!line.trim().startsWith('[')) {
        continue;
      }

      const lyric = line.match(lyricRegex)?.groups;
      if (!lyric) {
        const tag = line.match(tagRegex)?.groups;
        if (tag) {
          if (tag.tag === 'offset') {
            offset = parseInt(tag.value);
            continue;
          }

          lrc.tags.push({
            tag: tag.tag,
            value: tag.value,
          });
        }
        continue;
      }

      const { minutes, seconds, milliseconds, text } = lyric;
      const timeInMs =
        parseInt(minutes) * 60 * 1000 +
        parseInt(seconds) * 1000 +
        parseInt(milliseconds);

      const currentLine: LRCLine = {
        time: `${minutes}:${seconds}:${milliseconds}`,
        timeInMs,
        text: text.trim(),
        duration: Infinity,
        rawText: text,
      };

      if (previousLine) {
        previousLine.duration = timeInMs - previousLine.timeInMs;
      }

      previousLine = currentLine;
      lrc.lines.push(currentLine);
    }

    for (const line of lrc.lines) {
      line.timeInMs += offset;
    }

    if (lrc.lines.length > 0) {
      const lastLine = lrc.lines[lrc.lines.length - 1];
      if (!Number.isFinite(lastLine.duration)) {
        lastLine.duration = 5000;
      }
    }

    const first = lrc.lines.at(0);
    if (first && first.timeInMs > 300) {
      lrc.lines.unshift({
        time: '0:0:0',
        timeInMs: 0,
        duration: first.timeInMs,
        text: '',
      });
    }

    for (const line of lrc.lines) {
      const parsed = parseEnhancedWords(
        line.rawText ?? line.text,
        line.timeInMs,
        Number.isFinite(line.duration) ? line.duration : 0,
      );
      line.text = parsed.text;
      line.words = parsed.words;
      line.isWordSynced = parsed.isWordSynced;
      delete line.rawText;
    }

    return lrc;
  },
};
