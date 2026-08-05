import type {
  LineLyrics,
  LyricProvider,
  LyricResult,
  SearchSongInfo,
} from '../types';

const headers = {
  Accept: 'application/json',
};

export class BetterLyrics implements LyricProvider {
  public name = 'BetterLyrics';
  public baseUrl = 'https://unison.boidu.dev';

  async search({
    videoId,
    title,
    artist,
    album,
    songDuration,
  }: SearchSongInfo): Promise<LyricResult | null> {
    if (videoId) {
      const byVideoId = await this.safeFetch(
        `/lyrics?v=${encodeURIComponent(videoId)}`,
      );
      const lines = byVideoId ? this.parseTTML(byVideoId.data?.lyrics) : [];
      if (lines.length) {
        return this.toResult(byVideoId, title, artist, lines);
      }
    }

    const song = title.replace(/\s+Video\s*$/i, '');

    let query = new URLSearchParams({ song, artist });
    let data = await this.safeFetch(`/lyrics?${query.toString()}`);
    let lines = data ? this.parseTTML(data.data?.lyrics) : [];
    if (lines.length) {
      return this.toResult(data, title, artist, lines);
    }

    if (album) query.set('album', album);
    if (songDuration) query.set('duration', String(songDuration));
    data = await this.safeFetch(`/lyrics?${query.toString()}`);
    lines = data ? this.parseTTML(data.data?.lyrics) : [];
    if (lines.length) {
      return this.toResult(data, title, artist, lines);
    }

    return null;
  }

  private toResult(
    data: BetterLyricsResponse | null,
    title: string,
    artist: string,
    lines: LineLyrics[],
  ): LyricResult {
    return {
      title: data?.data?.song ?? title,
      artists: [data?.data?.artist ?? artist],
      lines,
    };
  }

  private async safeFetch(path: string): Promise<BetterLyricsResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { headers });
      if (!response.ok) return null;

      const json = (await response.json()) as BetterLyricsResponse;
      if (!json.success || !json.data) return null;
      return json;
    } catch {
      return null;
    }
  }

  private parseTTML(ttml: string | undefined | null): LineLyrics[] {
    if (!ttml) return [];

    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(ttml, 'text/xml');
    } catch {
      return [];
    }

    const elements = Array.from(doc.getElementsByTagName('*'));
    if (elements.some((element) => element.localName === 'parsererror'))
      return [];

    const root = doc.documentElement;
    const timing = getTimingParameters(root);
    const parsedLines: ParsedLine[] = [];

    for (const element of elements) {
      if (element.localName !== 'p') continue;

      const begin = parseTTMLTime(getAttribute(element, 'begin'), timing);
      const end = parseTTMLTime(getAttribute(element, 'end'), timing);
      if (begin === null) continue;

      const text = collectTimedText(element).replace(/\s+/g, ' ').trim();
      if (!text) continue;

      parsedLines.push({ begin, end, text });
    }

    parsedLines.sort(({ begin: beginA }, { begin: beginB }) => beginA - beginB);

    const lines = parsedLines.map(({ begin, end, text }, index) => {
      const next = parsedLines[index + 1];
      const duration =
        end !== null && end > begin
          ? end - begin
          : next && next.begin > begin
            ? next.begin - begin
            : Infinity;

      return {
        time: millisToTime(begin),
        timeInMs: begin,
        duration,
        text,
        status: 'upcoming' as const,
      };
    });

    if (!lines.length) return lines;

    const first = lines[0];
    if (first.timeInMs > 300) {
      lines.unshift({
        time: '00:00.00',
        timeInMs: 0,
        duration: first.timeInMs,
        text: '',
        status: 'upcoming',
      });
    }

    return lines;
  }
}

type ParsedLine = {
  begin: number;
  end: number | null;
  text: string;
};

type TimingParameters = {
  frameRate: number;
  tickRate: number;
};

function collectTimedText(element: Element): string {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const child = node as Element;
    if (child.localName === 'br') {
      text += '\n';
    } else {
      text += collectTimedText(child);
    }
  }
  return text;
}

function getAttribute(element: Element, name: string): string | null {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === name || attribute.name === name) {
      return attribute.value;
    }
  }
  return null;
}

function getTimingParameters(root: Element): TimingParameters {
  const frameRate = parsePositiveNumber(getAttribute(root, 'frameRate')) ?? 30;
  const multiplier = getAttribute(root, 'frameRateMultiplier')
    ?.trim()
    .split(/\s+/)
    .map(Number);
  const adjustedFrameRate =
    multiplier && multiplier.length === 2 && multiplier.every(Number.isFinite)
      ? (frameRate * multiplier[0]) / multiplier[1]
      : frameRate;
  const subFrameRate =
    parsePositiveNumber(getAttribute(root, 'subFrameRate')) ?? 1;
  const tickRate =
    parsePositiveNumber(getAttribute(root, 'tickRate')) ??
    adjustedFrameRate * subFrameRate;

  return {
    frameRate: adjustedFrameRate,
    tickRate,
  };
}

function parseTTMLTime(
  time: string | null,
  { frameRate, tickRate }: TimingParameters,
): number | null {
  if (!time) return null;

  const value = time.trim();
  const clock = value.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (clock) {
    const [, hours, minutes, seconds, fraction = ''] = clock;
    return clockToMilliseconds(hours, minutes, seconds, fraction);
  }

  const shortClock = value.match(/^(\d+):(\d{2})(?:\.(\d+))?$/);
  if (shortClock) {
    const [, minutes, seconds, fraction = ''] = shortClock;
    return clockToMilliseconds('0', minutes, seconds, fraction);
  }

  const frames = value.match(/^(\d+):(\d{2}):(\d{2}):(\d+)$/);
  if (frames) {
    const [, hours, minutes, seconds, frame] = frames;
    const clockMilliseconds = clockToMilliseconds(hours, minutes, seconds, '');
    const frameMilliseconds = (Number(frame) / frameRate) * 1000;
    return Math.round(clockMilliseconds + frameMilliseconds);
  }

  const offset = value.match(/^(\d+(?:\.\d+)?)(h|m|s|ms|f|t)$/);
  if (!offset) {
    const seconds = Number(value);
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
  }

  const amount = Number(offset[1]);
  switch (offset[2]) {
    case 'h':
      return Math.round(amount * 60 * 60 * 1000);
    case 'm':
      return Math.round(amount * 60 * 1000);
    case 's':
      return Math.round(amount * 1000);
    case 'ms':
      return Math.round(amount);
    case 'f':
      return Math.round((amount / frameRate) * 1000);
    case 't':
      return Math.round((amount / tickRate) * 1000);
    default:
      return null;
  }
}

function clockToMilliseconds(
  hours: string,
  minutes: string,
  seconds: string,
  fraction: string,
): number {
  const hoursMilliseconds = Number(hours) * 3600000;
  const minutesMilliseconds = Number(minutes) * 60000;
  const secondsMilliseconds = Number(seconds) * 1000;
  const fractionMilliseconds = fraction ? Number(`0.${fraction}`) * 1000 : 0;

  return Math.round(
    hoursMilliseconds +
      minutesMilliseconds +
      secondsMilliseconds +
      fractionMilliseconds,
  );
}

function parsePositiveNumber(value: string | null): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function millisToTime(millis: number): string {
  const totalMilliseconds = Math.max(0, Math.round(millis));
  const minutes = Math.floor(totalMilliseconds / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const centiseconds = Math.floor((totalMilliseconds % 1000) / 10);

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

type BetterLyricsResponse = {
  success: boolean;
  data?: {
    song?: string;
    artist?: string;
    format?: string;
    syncType?: string;
    lyrics?: string;
    score?: number;
  };
};
