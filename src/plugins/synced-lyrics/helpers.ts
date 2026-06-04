import {
  ProviderNames,
  providerRegistry,
  type ProviderName,
} from './providers';

import type {
  LineLyrics,
  LyricQualityTier,
  LyricResult,
  LyricResultMeta,
  SearchSongInfo,
  SongCorrection,
  WordLyrics,
} from './types';

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replaceAll(/\b(feat|ft|official|video|audio|lyrics)\b/g, ' ')
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

const ratio = (left: string, right: string) => {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.includes(right) || right.includes(left)) {
    return (
      Math.min(left.length, right.length) / Math.max(left.length, right.length)
    );
  }

  const leftWords = new Set(left.split(' '));
  const rightWords = new Set(right.split(' '));
  const overlap = Array.from(leftWords).filter((word) =>
    rightWords.has(word),
  ).length;

  return overlap / Math.max(leftWords.size, rightWords.size, 1);
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const createWordTimings = (
  text: string,
  lineStartMs: number,
  lineDurationMs: number,
): WordLyrics[] => {
  const tokens = text.match(/\S+\s*|\s+/g) ?? [];
  const weighted = tokens.map((token) => ({
    text: token,
    weight: Math.max(token.trim().length, token.length > 0 ? 1 : 0),
  }));
  const totalWeight =
    weighted.reduce((sum, token) => sum + token.weight, 0) || 1;

  let cursor = lineStartMs;
  return weighted.map((token, index) => {
    const remaining = lineStartMs + lineDurationMs - cursor;
    const duration =
      index === weighted.length - 1
        ? Math.max(remaining, 0)
        : Math.max(
            Math.round((lineDurationMs * token.weight) / totalWeight),
            0,
          );

    const word = {
      text: token.text,
      timeInMs: cursor,
      duration,
    } satisfies WordLyrics;

    cursor += duration;
    return word;
  });
};

export const enrichLineWords = (lines: LineLyrics[]) => {
  for (const line of lines) {
    if (line.text.trim() && (!line.words || line.words.length === 0)) {
      line.words = createWordTimings(line.text, line.timeInMs, line.duration);
      line.isWordSynced ??= false;
    }
  }

  return lines;
};

const getPreview = (result: LyricResult) => {
  const line = result.lines?.find((entry) => entry.text.trim())?.text;
  if (line) {
    return line.slice(0, 80);
  }

  return (
    result.lyrics
      ?.split('\n')
      .find((entry) => entry.trim())
      ?.slice(0, 80) ?? ''
  );
};

const getDurationDelta = (songInfo: SearchSongInfo, result: LyricResult) => {
  const explicit = result.meta?.durationDeltaMs;
  if (typeof explicit === 'number') {
    return explicit;
  }

  const lines = result.lines;
  if (!lines?.length) {
    return null;
  }

  const lastLine = lines[lines.length - 1];
  const lastEnd = lastLine.timeInMs + lastLine.duration;
  if (!Number.isFinite(lastEnd) || lastEnd <= 0) {
    return null;
  }

  return Math.round(lastEnd - songInfo.songDuration * 1000);
};

const getQualityTier = (result: LyricResult): LyricQualityTier => {
  if (result.lines?.some((line) => line.isWordSynced)) {
    return 'word';
  }

  if (result.lines?.length) {
    return 'synced';
  }

  if (result.lyrics) {
    return 'plain';
  }

  return 'none';
};

const getArtistScore = (songInfo: SearchSongInfo, result: LyricResult) => {
  const expected = songInfo.artist
    .split(/[,&]/g)
    .map((artist) => normalizeText(artist))
    .filter(Boolean);
  const actual = result.artists
    .flatMap((artist) => artist.split(/[,&]/g))
    .map((artist) => normalizeText(artist))
    .filter(Boolean);

  if (!expected.length || !actual.length) {
    return 0;
  }

  let best = 0;
  for (const left of expected) {
    for (const right of actual) {
      best = Math.max(best, ratio(left, right));
    }
  }

  return best;
};

const getTitleScore = (songInfo: SearchSongInfo, result: LyricResult) => {
  const expected = [songInfo.title, songInfo.alternativeTitle]
    .filter((value): value is string => Boolean(value))
    .map(normalizeText)
    .filter(Boolean);
  const actual = normalizeText(result.title);

  if (!expected.length || !actual) {
    return 0;
  }

  return Math.max(...expected.map((value) => ratio(value, actual)));
};

export const buildLyricMeta = (
  provider: ProviderName,
  songInfo: SearchSongInfo,
  result: LyricResult,
): LyricResultMeta => {
  const source = providerRegistry[provider];
  const titleScore = getTitleScore(songInfo, result);
  const artistScore = getArtistScore(songInfo, result);
  const durationDeltaMs = getDurationDelta(songInfo, result);
  const durationScore =
    durationDeltaMs === null
      ? 0.4
      : clamp(1 - Math.abs(durationDeltaMs) / 15000);
  const qualityTier = getQualityTier(result);
  const hasSyncedLyrics = Boolean(result.lines?.length);
  const hasWordTimings = Boolean(
    result.lines?.some((line) => line.isWordSynced),
  );
  const hasPlainLyrics = Boolean(result.lyrics?.trim());
  const hasTranslation = Boolean(
    result.translatedLyrics?.some((line) => line.trim()),
  );
  const exactFromProvider =
    result.meta?.exact === true || provider === ProviderNames.YTMusic;
  const exactMatch =
    exactFromProvider ||
    (titleScore >= 0.9 && artistScore >= 0.9 && durationScore >= 0.75);
  const fallbackUsed = Boolean(result.meta?.fallbackUsed);

  const confidence = clamp(
    (source.baseRank / 100) * 0.2 +
      titleScore * 0.3 +
      artistScore * 0.25 +
      durationScore * 0.15 +
      (hasSyncedLyrics ? 0.05 : 0) +
      (hasWordTimings ? 0.05 : 0),
  );

  const matchedBy = [
    titleScore >= 0.9 ? 'title' : titleScore >= 0.7 ? 'fuzzy-title' : '',
    artistScore >= 0.9 ? 'artist' : artistScore >= 0.7 ? 'fuzzy-artist' : '',
    durationScore >= 0.9
      ? 'duration'
      : durationScore >= 0.7
        ? 'near-duration'
        : '',
    hasWordTimings
      ? 'word-timing'
      : hasSyncedLyrics
        ? 'synced'
        : hasPlainLyrics
          ? 'plain'
          : '',
  ].filter(Boolean);

  return {
    provider,
    confidence,
    exact: exactMatch,
    inexact: !exactMatch || Boolean(result.meta?.inexact),
    sourceQuality: result.meta?.sourceQuality ?? source.sourceQuality,
    qualityTier,
    durationDeltaMs,
    hasWordTimings,
    hasSyncedLyrics,
    hasPlainLyrics,
    hasTranslation,
    matchedBy,
    fallbackUsed,
    preview: getPreview(result),
  };
};

export const normalizeLyricResult = (
  provider: ProviderName,
  songInfo: SearchSongInfo,
  result: LyricResult,
) => {
  if (result.lines) {
    enrichLineWords(result.lines);
  }

  return {
    ...result,
    meta: {
      ...buildLyricMeta(provider, songInfo, result),
      ...result.meta,
    },
  } satisfies LyricResult;
};

export const formatConfidence = (confidence?: number) =>
  `${Math.round((confidence ?? 0) * 100)}%`;

export const formatDurationDelta = (
  durationDeltaMs: number | null | undefined,
) => {
  if (typeof durationDeltaMs !== 'number') {
    return 'n/a';
  }

  const sign = durationDeltaMs > 0 ? '+' : '';
  return `${sign}${Math.round(durationDeltaMs)}ms`;
};

export const makeSongKey = (songInfo: SearchSongInfo) => {
  const title = normalizeText(songInfo.alternativeTitle || songInfo.title);
  const artist = normalizeText(songInfo.artist);
  const album = normalizeText(songInfo.album ?? '');
  const duration = Math.round(songInfo.songDuration);
  return [title, artist, album, duration].join('::');
};

export const mergeSongCorrection = (
  previous: SongCorrection | undefined,
  patch: Partial<SongCorrection>,
): SongCorrection => ({
  provider: patch.provider ?? previous?.provider,
  offsetMs: patch.offsetMs ?? previous?.offsetMs ?? 0,
  updatedAt: Date.now(),
});
