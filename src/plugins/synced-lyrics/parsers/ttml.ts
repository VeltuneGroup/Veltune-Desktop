import { parse } from 'node-html-parser';

import type { LineLyrics } from '../types';

export const TTML = {
  parse: (ttml: string): LineLyrics[] => {
    const root = parse(ttml);
    const lines: LineLyrics[] = [];

    const pTags = root.querySelectorAll('p');

    for (const p of pTags) {
      const begin = p.getAttribute('begin');
      if (!begin) continue;

      const timeInMs = parseFloat(begin) * 1000;
      const text = p.text.trim();

      if (text) {
        lines.push({
          time: begin,
          timeInMs,
          duration: 0,
          text,
          status: 'upcoming',
        });
      }
    }

    for (let i = 0; i < lines.length - 1; i++) {
      lines[i].duration = lines[i + 1].timeInMs - lines[i].timeInMs;
    }

    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const lastPTag = pTags[pTags.length - 1];
      const end = lastPTag?.getAttribute('end');
      if (end) {
        lastLine.duration = parseFloat(end) * 1000 - lastLine.timeInMs;
      } else {
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

    return lines;
  },
};
